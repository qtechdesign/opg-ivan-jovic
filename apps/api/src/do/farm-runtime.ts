import { DurableObject } from "cloudflare:workers";
import type { IngestBatch } from "@polje/schema";

export type MetricKey = string; // `${device_id}:${metric}`

export type LiveMetric = {
  device_id: string;
  metric: string;
  value: number;
  ts: string;
};

export type FarmLiveState = {
  farm_id: string;
  starlink: "up" | "down" | "unknown";
  edge?: string;
  mqtt?: string;
  gateway?: string;
  nvr?: "ok" | "down" | "unconfigured";
  edge_seen_at: string | null;
  last_ingest_at: string | null;
  last_batch_id: string | null;
  metrics: Record<MetricKey, LiveMetric>;
};

type Env = Cloudflare.Env;

const BATCH_TTL_MS = 24 * 60 * 60 * 1000;

export class FarmRuntime extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair("ping", "pong")
    );
  }

  private async loadState(farmId: string): Promise<FarmLiveState> {
    const stored = await this.ctx.storage.get<FarmLiveState>("state");
    if (stored) return stored;
    return {
      farm_id: farmId,
      starlink: "unknown",
      edge_seen_at: null,
      last_ingest_at: null,
      last_batch_id: null,
      metrics: {},
    };
  }

  private async saveState(state: FarmLiveState): Promise<void> {
    await this.ctx.storage.put("state", state);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const farmId = url.searchParams.get("farm_id") || "ivan-jovic";

    if (url.pathname === "/ws" || request.headers.get("Upgrade") === "websocket") {
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("Expected WebSocket", { status: 426 });
      }
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server);
      const state = await this.loadState(farmId);
      server.send(JSON.stringify({ type: "snapshot", ...state }));
      return new Response(null, { status: 101, webSocket: client });
    }

    if (url.pathname === "/overview" && request.method === "GET") {
      const state = await this.loadState(farmId);
      return Response.json(state);
    }

    if (url.pathname === "/health" && request.method === "GET") {
      const state = await this.loadState(farmId);
      return Response.json({
        farm_id: state.farm_id,
        starlink: state.starlink,
        edge: state.edge,
        mqtt: state.mqtt,
        gateway: state.gateway,
        nvr: state.nvr,
        edge_seen_at: state.edge_seen_at,
        last_ingest_at: state.last_ingest_at,
        last_batch_id: state.last_batch_id,
      });
    }

    if (url.pathname === "/ingest" && request.method === "POST") {
      const batch = (await request.json()) as IngestBatch;
      const result = await this.applyIngest(batch);
      return Response.json(result, { status: result.duplicate ? 200 : 202 });
    }

    return new Response("Not found", { status: 404 });
  }

  async applyIngest(batch: IngestBatch): Promise<{
    ok: boolean;
    duplicate: boolean;
    applied: number;
  }> {
    const seenKey = `batch:${batch.batch_id}`;
    const seen = await this.ctx.storage.get<number>(seenKey);
    if (seen) {
      return { ok: true, duplicate: true, applied: 0 };
    }

    const state = await this.loadState(batch.farm_id);
    const now = new Date().toISOString();

    for (const r of batch.readings) {
      const key = `${r.device_id}:${r.metric}`;
      state.metrics[key] = {
        device_id: r.device_id,
        metric: r.metric,
        value: r.value,
        ts: r.ts,
      };
    }

    if (batch.health?.starlink) state.starlink = batch.health.starlink;
    if (batch.health?.edge) state.edge = batch.health.edge;
    if (batch.health?.mqtt) state.mqtt = batch.health.mqtt;
    if (batch.health?.gateway) state.gateway = batch.health.gateway;
    if (batch.health?.nvr) state.nvr = batch.health.nvr;
    state.edge_seen_at = now;
    state.last_ingest_at = batch.sent_at || now;
    state.last_batch_id = batch.batch_id;
    state.farm_id = batch.farm_id;

    await this.saveState(state);
    await this.ctx.storage.put(seenKey, Date.now());
    // Best-effort TTL cleanup via alarm of old keys is overkill; overwrite is fine.
    await this.ctx.storage.setAlarm(Date.now() + BATCH_TTL_MS);

    // Persist readings + device last_seen to D1 (best-effort)
    try {
      if (batch.readings.length > 0) {
        const stmts = batch.readings.map((r) =>
          this.env.DB.prepare(
            `INSERT INTO readings (device_id, metric, value, ts) VALUES (?, ?, ?, ?)`
          ).bind(r.device_id, r.metric, r.value, r.ts)
        );
        const deviceIds = [...new Set(batch.readings.map((r) => r.device_id))];
        for (const id of deviceIds) {
          stmts.push(
            this.env.DB.prepare(
              `UPDATE devices SET last_seen = ? WHERE id = ?`
            ).bind(now, id)
          );
        }
        await this.env.DB.batch(stmts);
      }

      await this.env.DB.prepare(
        `INSERT INTO audit (farm_id, actor, action, entity, before_json, after_json, ts)
         VALUES (?, 'edge', 'ingest.batch', ?, NULL, ?, ?)`
      )
        .bind(
          "a1000000-0000-4000-8000-000000000001",
          `batch:${batch.batch_id}`,
          JSON.stringify({
            batch_id: batch.batch_id,
            readings: batch.readings.length,
            health: batch.health ?? null,
          }),
          now
        )
        .run();
    } catch (err) {
      console.error("D1 flush after ingest failed", err);
    }

    this.broadcast({ type: "ingest", ...state });
    return { ok: true, duplicate: false, applied: batch.readings.length };
  }

  private broadcast(payload: unknown): void {
    const msg = JSON.stringify(payload);
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(msg);
      } catch {
        /* ignore dead sockets */
      }
    }
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (typeof message === "string" && message === "ping") {
      ws.send("pong");
      return;
    }
    // Clients may request a fresh snapshot
    if (typeof message === "string" && message === "snapshot") {
      const state = await this.loadState("ivan-jovic");
      ws.send(JSON.stringify({ type: "snapshot", ...state }));
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string) {
    ws.close(code, reason);
  }

  async alarm() {
    // Prune batch idempotency keys older than TTL
    const all = await this.ctx.storage.list<number>({ prefix: "batch:" });
    const cutoff = Date.now() - BATCH_TTL_MS;
    const toDelete: string[] = [];
    for (const [key, ts] of all) {
      if (typeof ts === "number" && ts < cutoff) toDelete.push(key);
    }
    if (toDelete.length) await this.ctx.storage.delete(toDelete);
  }
}

export function farmStub(env: Env, farmId: string) {
  const id = env.FARM.idFromName(farmId);
  return env.FARM.get(id);
}
