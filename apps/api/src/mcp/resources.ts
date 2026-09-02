import { DEFAULT_FARM_SLUG, defaultFarmSlug, getFarmBySlug } from "../lib/farm";
import { ensureLegacyHolding, listHoldings, publicHolding } from "../lib/holdings";
import { farmStub } from "../do/farm-runtime";
import { defaultLedgerWindow, farmLedgerSummary } from "../routes/ledger";
import { irrigationOverview } from "../routes/irrigation";
import { climateNow } from "../lib/climate";
import { energyNow } from "../lib/energy";
import { planBoard } from "../lib/plan";

const DOCS_API = `# Polje HTTP API (summary)

Base: https://opg-ivanjovic.hr

Auth writes: Bearer OPERATOR_TOKEN
MCP / agent: Bearer AGENT_TOKEN
Edge ingest: Bearer INGEST_TOKEN

Key routes: /v1/health, /v1/overview, /v1/plots, /v1/plantings, /v1/cameras,
/v1/climate/now, /v1/energy/now, /v1/ledger, /v1/plan, /v1/plan/calendar.ics, /v1/trello, /v1/local/health, /v1/audit, /v1/grok/chat, /mcp

Full docs: https://docs.opg-ivanjovic.hr/api
`;

const DOCS_SAFETY = `# Polje safety policy

1. Local failsafe first — actuators timeout on the edge; cloud is not the only safety layer.
2. High-risk tools (irrigation, heat, pumps, frost valves, enable_automation) require confirm=true + reason.
3. Without confirm → proposal only. Grok chat cannot confirm high-risk actions.
4. Every write creates an audit event (who / what / why / before / after).
5. Never put camera RTSP URLs, tokens, bank data, or exact private GPS in prompts or public docs.
6. Rain lockout applies to drip, never to frost spray zones.

Full docs: https://docs.opg-ivanjovic.hr/safety
`;

export type ResourceResult =
  | { mimeType: string; text: string }
  | { mimeType: string; blob: Uint8Array }
  | { error: string; status?: number };

export async function readPoljeResource(
  env: Cloudflare.Env,
  uri: string
): Promise<ResourceResult> {
  const url = new URL(uri);

  if (url.protocol !== "polje:") {
    return { error: "unsupported_scheme" };
  }

  const path = url.hostname + url.pathname; // e.g. farm/ivan-jovic/overview or docs/api
  // polje://farm/ivan-jovic/overview → hostname=farm, pathname=/ivan-jovic/overview
  // Actually for polje://farm/ivan-jovic/overview:
  //   hostname = farm, pathname = /ivan-jovic/overview
  // For polje://docs/api: hostname = docs, pathname = /api

  if (url.hostname === "docs") {
    if (url.pathname === "/api" || url.pathname === "/api/") {
      return { mimeType: "text/markdown", text: DOCS_API };
    }
    if (url.pathname === "/safety" || url.pathname === "/safety/") {
      return { mimeType: "text/markdown", text: DOCS_SAFETY };
    }
    return { error: "resource_not_found" };
  }

  if (url.hostname !== "farm") {
    return { error: "resource_not_found" };
  }

  const parts = url.pathname.replace(/^\/+/, "").split("/");
  // ivan-jovic / overview | plots | devices | local | audit | cameras / {id} / latest | energy | ...
  const slug = parts[0] || defaultFarmSlug(env);
  const kind = parts[1] || "overview";

  const farm = await getFarmBySlug(env.DB, slug);
  if (!farm) return { error: "farm_not_found", status: 404 };

  if (kind === "overview") {
    const stub = farmStub(env, farm.slug);
    const liveRes = await stub.fetch(
      new Request(`https://do/overview?farm_id=${encodeURIComponent(farm.slug)}`)
    );
    const live = await liveRes.json();
    const { results: plots } = await env.DB.prepare(
      `SELECT id, name, use_type FROM plots WHERE farm_id = ? ORDER BY name`
    )
      .bind(farm.id)
      .all();
    return {
      mimeType: "application/json",
      text: JSON.stringify({
        farm: {
          id: farm.id,
          slug: farm.slug,
          name: farm.name,
          timezone: farm.timezone,
        },
        plots: plots ?? [],
        live,
      }),
    };
  }

  if (kind === "plots") {
    const { results: plots } = await env.DB.prepare(
      `SELECT id, farm_id, name, hectares, use_type, notes, geom_json, holding_id FROM plots WHERE farm_id = ? ORDER BY name`
    )
      .bind(farm.id)
      .all();
    const { results: plantings } = await env.DB.prepare(
      `SELECT p.id, p.plot_id, p.crop, p.variety, p.planted_on, p.stage, p.expected_harvest, p.yield_kg
       FROM plantings p JOIN plots pl ON pl.id = p.plot_id WHERE pl.farm_id = ? ORDER BY p.crop`
    )
      .bind(farm.id)
      .all();
    await ensureLegacyHolding(env.DB, farm);
    const holdings = (await listHoldings(env.DB, farm.id)).map(publicHolding);
    return {
      mimeType: "application/json",
      text: JSON.stringify({
        holdings,
        plots: plots ?? [],
        plantings: plantings ?? [],
      }),
    };
  }

  if (kind === "devices") {
    const { results } = await env.DB.prepare(
      `SELECT id, farm_id, kind, driver, name, zone, protocol, last_seen
       FROM devices WHERE farm_id = ? ORDER BY name`
    )
      .bind(farm.id)
      .all();
    return {
      mimeType: "application/json",
      text: JSON.stringify({ devices: results ?? [] }),
    };
  }

  if (kind === "local") {
    const stub = farmStub(env, farm.slug);
    const res = await stub.fetch(
      new Request(`https://do/health?farm_id=${encodeURIComponent(farm.slug)}`)
    );
    return { mimeType: "application/json", text: await res.text() };
  }

  if (kind === "audit") {
    const limit = Math.min(
      100,
      Math.max(1, Number(url.searchParams.get("limit") || "50") || 50)
    );
    const { results } = await env.DB.prepare(
      `SELECT id, farm_id, actor, action, entity, before_json, after_json, ts
       FROM audit WHERE farm_id = ? ORDER BY id DESC LIMIT ?`
    )
      .bind(farm.id, limit)
      .all();
    return {
      mimeType: "application/json",
      text: JSON.stringify({ audit: results ?? [] }),
    };
  }

  if (kind === "cameras" && parts[2] && parts[3] === "latest") {
    const cameraId = parts[2];
    const row = await env.DB.prepare(
      `SELECT camera_id, r2_key, content_type FROM camera_snapshots
       WHERE camera_id = ? AND farm_id = ?`
    )
      .bind(cameraId, farm.id)
      .first<{ camera_id: string; r2_key: string; content_type: string }>();
    if (!row) return { error: "snapshot_not_found", status: 404 };
    const obj = await env.MEDIA.get(row.r2_key);
    if (!obj) return { error: "object_missing", status: 404 };
    const bytes = new Uint8Array(await obj.arrayBuffer());
    return { mimeType: row.content_type || "image/jpeg", blob: bytes };
  }

  if (kind === "ledger") {
    const window = defaultLedgerWindow();
    const from = url.searchParams.get("from") || window.from;
    const to = url.searchParams.get("to") || window.to;
    const summary = await farmLedgerSummary(env.DB, farm.id, from, to);
    return {
      mimeType: "application/json",
      text: JSON.stringify({
        farm_id: farm.id,
        slug: farm.slug,
        ...summary,
      }),
    };
  }

  if (kind === "climate") {
    const stub = farmStub(env, farm.slug);
    const liveRes = await stub.fetch(
      new Request(`https://do/overview?farm_id=${encodeURIComponent(farm.slug)}`)
    );
    const live = (await liveRes.json()) as { metrics?: Record<string, unknown> };
    const body = await climateNow(
      env.DB,
      farm.id,
      farm.slug,
      (live.metrics ?? {}) as import("../lib/climate").LiveMetrics
    );
    return { mimeType: "application/json", text: JSON.stringify(body) };
  }

  if (kind === "energy") {
    const stub = farmStub(env, farm.slug);
    const liveRes = await stub.fetch(
      new Request(`https://do/overview?farm_id=${encodeURIComponent(farm.slug)}`)
    );
    const live = (await liveRes.json()) as { metrics?: Record<string, unknown> };
    const body = await energyNow(
      env.DB,
      farm.id,
      farm.slug,
      farm.timezone,
      (live.metrics ?? {}) as import("../lib/climate").LiveMetrics
    );
    return { mimeType: "application/json", text: JSON.stringify(body) };
  }

  if (kind === "irrigation") {
    const state = await irrigationOverview(env.DB, farm.id);
    return {
      mimeType: "application/json",
      text: JSON.stringify({
        farm_id: farm.id,
        slug: farm.slug,
        ...state,
      }),
    };
  }

  if (kind === "fps") {
    const prog = await env.DB.prepare(
      `SELECT program_json, status, updated_at FROM frost_programs WHERE farm_id = ?`
    )
      .bind(farm.id)
      .first<{ program_json: string; status: string; updated_at: string }>();
    const stub = farmStub(env, farm.slug);
    const liveRes = await stub.fetch(
      new Request(`https://do/overview?farm_id=${encodeURIComponent(farm.slug)}`)
    );
    const live = (await liveRes.json()) as { frost?: string };
    return {
      mimeType: "application/json",
      text: JSON.stringify({
        farm_id: farm.id,
        slug: farm.slug,
        status: live.frost || prog?.status || "idle",
        program_updated_at: prog?.updated_at ?? null,
      }),
    };
  }

  if (kind === "plan") {
    const board = await planBoard(env.DB, farm.id, farm.timezone);
    return {
      mimeType: "application/json",
      text: JSON.stringify({
        farm_id: farm.id,
        slug: farm.slug,
        timezone: farm.timezone,
        ...board,
      }),
    };
  }

  return { error: "resource_not_found" };
}

export const STATIC_RESOURCE_URIS = [
  `polje://farm/${DEFAULT_FARM_SLUG}/overview`,
  `polje://farm/${DEFAULT_FARM_SLUG}/plots`,
  `polje://farm/${DEFAULT_FARM_SLUG}/devices`,
  `polje://farm/${DEFAULT_FARM_SLUG}/local`,
  `polje://farm/${DEFAULT_FARM_SLUG}/energy`,
  `polje://farm/${DEFAULT_FARM_SLUG}/climate`,
  `polje://farm/${DEFAULT_FARM_SLUG}/irrigation`,
  `polje://farm/${DEFAULT_FARM_SLUG}/fps`,
  `polje://farm/${DEFAULT_FARM_SLUG}/plan`,
  `polje://farm/${DEFAULT_FARM_SLUG}/ledger`,
  `polje://farm/${DEFAULT_FARM_SLUG}/audit`,
  "polje://docs/api",
  "polje://docs/safety",
] as const;
