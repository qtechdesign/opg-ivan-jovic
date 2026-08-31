import { Hono } from "hono";
import {
  ArmFrostSchema,
  LoadFrostProgramSchema,
  OpenFpsValveSchema,
  type FrostProgram,
} from "@polje/schema";
import { requireOperator } from "../lib/auth";
import { writeAudit } from "../lib/audit";
import { farmSlugFromQuery, getFarmBySlug } from "../lib/farm";
import { farmStub } from "../do/farm-runtime";

type AppEnv = { Bindings: Cloudflare.Env };

const FPS_NODE_DRIVERS = new Set(["fps-sensor-node", "fps-valve"]);

/** Magnus approximation — dewpoint °C from temp °C and RH %. */
export function dewpointC(tempC: number, rh: number): number | null {
  if (!Number.isFinite(tempC) || !Number.isFinite(rh) || rh <= 0) return null;
  const a = 17.27;
  const b = 237.7;
  const alpha = (a * tempC) / (b + tempC) + Math.log(rh / 100);
  return (b * alpha) / (a - alpha);
}

export const fpsApi = new Hono<AppEnv>();

fpsApi.get("/v1/fps/nodes", async (c) => {
  const slug = farmSlugFromQuery(c);
  const farm = await getFarmBySlug(c.env.DB, slug);
  if (!farm) return c.json({ error: "farm_not_found", slug }, 404);

  const { results: devices } = await c.env.DB.prepare(
    `SELECT id, farm_id, kind, driver, name, zone, protocol, address, config_json, last_seen
     FROM devices WHERE farm_id = ? AND driver IN ('fps-sensor-node', 'fps-valve')
     ORDER BY name`
  )
    .bind(farm.id)
    .all();

  const stub = farmStub(c.env, farm.slug);
  const liveRes = await stub.fetch(
    new Request(`https://do/overview?farm_id=${encodeURIComponent(farm.slug)}`)
  );
  const live = (await liveRes.json()) as {
    metrics?: Record<string, { device_id: string; metric: string; value: number; ts: string }>;
  };
  const metrics = live.metrics || {};

  const nodes = (devices ?? []).map((d) => {
    const row = d as {
      id: string;
      driver: string;
      name: string;
      zone: string | null;
      last_seen: string | null;
      kind: string;
      protocol: string | null;
    };
    const last: Record<string, number> = {};
    for (const m of Object.values(metrics)) {
      if (m.device_id === row.id) last[m.metric] = m.value;
    }
    return { ...row, metrics: last };
  });

  return c.json({ farm_id: farm.id, slug: farm.slug, nodes });
});

fpsApi.get("/v1/fps/gateway", async (c) => {
  const slug = farmSlugFromQuery(c);
  const farm = await getFarmBySlug(c.env.DB, slug);
  if (!farm) return c.json({ error: "farm_not_found", slug }, 404);

  const gw = await c.env.DB.prepare(
    `SELECT id, farm_id, kind, driver, name, zone, protocol, address, config_json, last_seen
     FROM devices WHERE farm_id = ? AND driver = 'fps-lora-gw' LIMIT 1`
  )
    .bind(farm.id)
    .first();

  const stub = farmStub(c.env, farm.slug);
  const liveRes = await stub.fetch(
    new Request(`https://do/overview?farm_id=${encodeURIComponent(farm.slug)}`)
  );
  const live = (await liveRes.json()) as {
    gateway?: string;
    metrics?: Record<string, { device_id: string; metric: string; value: number }>;
  };

  const packets =
    gw && live.metrics
      ? live.metrics[`${(gw as { id: string }).id}:packets`]?.value
      : undefined;
  const nodes =
    gw && live.metrics
      ? live.metrics[`${(gw as { id: string }).id}:nodes`]?.value
      : undefined;

  return c.json({
    farm_id: farm.id,
    slug: farm.slug,
    gateway: gw ?? null,
    health: live.gateway ?? "unconfigured",
    packets: packets ?? null,
    nodes: nodes ?? null,
  });
});

fpsApi.get("/v1/frost/status", async (c) => {
  const slug = farmSlugFromQuery(c);
  const farm = await getFarmBySlug(c.env.DB, slug);
  if (!farm) return c.json({ error: "farm_not_found", slug }, 404);

  const prog = await c.env.DB.prepare(
    `SELECT program_json, status, updated_at FROM frost_programs WHERE farm_id = ?`
  )
    .bind(farm.id)
    .first<{ program_json: string; status: string; updated_at: string }>();

  let program: FrostProgram | null = null;
  if (prog?.program_json) {
    try {
      program = JSON.parse(prog.program_json) as FrostProgram;
    } catch {
      program = null;
    }
  }

  const stub = farmStub(c.env, farm.slug);
  const liveRes = await stub.fetch(
    new Request(`https://do/overview?farm_id=${encodeURIComponent(farm.slug)}`)
  );
  const live = (await liveRes.json()) as {
    frost?: string;
    metrics?: Record<string, { metric: string; value: number; ts: string; device_id: string }>;
  };

  const sensorId = program?.sensor_id || "fps-sn-1";
  const metrics = live.metrics || {};
  const temp =
    metrics[`${sensorId}:temp_c`] ||
    Object.values(metrics).find((m) => m.metric === "temp_c" && m.device_id.startsWith("fps-"));
  const rh =
    metrics[`${sensorId}:rh`] ||
    Object.values(metrics).find((m) => m.metric === "rh" && m.device_id.startsWith("fps-"));

  const temp_c = temp?.value ?? null;
  const rh_pct = rh?.value ?? null;
  const dewpoint =
    temp_c != null && rh_pct != null ? dewpointC(temp_c, rh_pct) : null;

  const status = live.frost || prog?.status || "idle";

  const { results: events } = await c.env.DB.prepare(
    `SELECT id, started_at, ended_at, min_temp_c, mode, water_m3, notes
     FROM frost_events WHERE farm_id = ? ORDER BY started_at DESC LIMIT 5`
  )
    .bind(farm.id)
    .all();

  return c.json({
    farm_id: farm.id,
    slug: farm.slug,
    status,
    program,
    updated_at: prog?.updated_at ?? null,
    live: {
      temp_c,
      rh: rh_pct,
      dewpoint_c: dewpoint != null ? Math.round(dewpoint * 10) / 10 : null,
      sensor_id: sensorId,
    },
    recent_events: events ?? [],
  });
});

fpsApi.get("/v1/iot/bus", async (c) => {
  const slug = farmSlugFromQuery(c);
  const farm = await getFarmBySlug(c.env.DB, slug);
  if (!farm) return c.json({ error: "farm_not_found", slug }, 404);

  const stub = farmStub(c.env, farm.slug);
  const res = await stub.fetch(
    new Request(`https://do/health?farm_id=${encodeURIComponent(farm.slug)}`)
  );
  const health = await res.json();
  const overviewRes = await stub.fetch(
    new Request(`https://do/overview?farm_id=${encodeURIComponent(farm.slug)}`)
  );
  const overview = (await overviewRes.json()) as { frost?: string };

  return c.json({
    farm_id: farm.id,
    slug: farm.slug,
    ...(health as object),
    frost: overview.frost ?? "idle",
  });
});

fpsApi.post("/v1/fps/program", async (c) => {
  const denied = await requireOperator(c);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }

  const parsed = LoadFrostProgramSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "validation", details: parsed.error.flatten() }, 400);
  }

  const farm = await getFarmBySlug(c.env.DB, parsed.data.farm_slug);
  if (!farm) {
    return c.json({ error: "farm_not_found", slug: parsed.data.farm_slug }, 404);
  }

  const { farm_slug: _s, ...program } = parsed.data;
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `INSERT INTO frost_programs (farm_id, program_json, status, updated_at, updated_by)
     VALUES (?, ?, 'watch', ?, 'user:operator')
     ON CONFLICT(farm_id) DO UPDATE SET
       program_json = excluded.program_json,
       status = 'watch',
       updated_at = excluded.updated_at,
       updated_by = excluded.updated_by`
  )
    .bind(farm.id, JSON.stringify(program), now)
    .run();

  const cmdId = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO commands (id, farm_id, device_id, action, payload_json, source, status, confirmed_by, created_at)
     VALUES (?, ?, 'fps-gw-1', 'fps.program.load', ?, 'ui', 'sent', 'user:operator', ?)`
  )
    .bind(cmdId, farm.id, JSON.stringify({ program }), now)
    .run();

  await writeAudit(c.env.DB, {
    farm_id: farm.id,
    actor: "user:operator",
    action: "fps.program.load",
    entity: `frost_program:${farm.id}`,
    after: { program, command_id: cmdId },
  });

  return c.json({ ok: true, program, command_id: cmdId, status: "watch" }, 201);
});

fpsApi.post("/v1/fps/arm", async (c) => {
  const denied = await requireOperator(c);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }

  const parsed = ArmFrostSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "validation", details: parsed.error.flatten() }, 400);
  }

  const farm = await getFarmBySlug(c.env.DB, parsed.data.farm_slug);
  if (!farm) {
    return c.json({ error: "farm_not_found", slug: parsed.data.farm_slug }, 404);
  }

  const wantArm = parsed.data.arm;
  const action = wantArm ? "fps.arm" : "fps.disarm";
  const nextStatus = wantArm ? "armed" : "idle";

  if (!parsed.data.confirm) {
    return c.json({
      proposal: true,
      action,
      status: nextStatus,
      reason_required: true,
      hint: "Resend with confirm: true and reason to commit",
    });
  }

  if (!parsed.data.reason || parsed.data.reason.length < 3) {
    return c.json({ error: "reason_required" }, 400);
  }

  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `INSERT INTO frost_programs (farm_id, program_json, status, updated_at, updated_by)
     VALUES (?, '{}', ?, ?, 'user:operator')
     ON CONFLICT(farm_id) DO UPDATE SET
       status = excluded.status,
       updated_at = excluded.updated_at,
       updated_by = excluded.updated_by`
  )
    .bind(farm.id, nextStatus, now)
    .run();

  const cmdId = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO commands (id, farm_id, device_id, action, payload_json, source, status, confirmed_by, created_at)
     VALUES (?, ?, 'fps-gw-1', ?, ?, 'ui', 'sent', 'user:operator', ?)`
  )
    .bind(
      cmdId,
      farm.id,
      action,
      JSON.stringify({ reason: parsed.data.reason }),
      now
    )
    .run();

  await writeAudit(c.env.DB, {
    farm_id: farm.id,
    actor: "user:operator",
    action,
    entity: `frost:${farm.id}`,
    after: {
      status: nextStatus,
      reason: parsed.data.reason,
      command_id: cmdId,
    },
  });

  return c.json({ ok: true, status: nextStatus, command_id: cmdId }, 202);
});

fpsApi.post("/v1/fps/valves/:id/open", async (c) => {
  const denied = await requireOperator(c);
  if (denied) return denied;

  const valveId = c.req.param("id");
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }

  const parsed = OpenFpsValveSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "validation", details: parsed.error.flatten() }, 400);
  }

  const valve = await c.env.DB.prepare(
    `SELECT id, farm_id, driver FROM devices WHERE id = ? AND driver = 'fps-valve'`
  )
    .bind(valveId)
    .first<{ id: string; farm_id: string; driver: string }>();

  if (!valve) {
    return c.json({ error: "valve_not_found", id: valveId }, 404);
  }

  if (!parsed.data.confirm) {
    return c.json({
      proposal: true,
      action: "fps.valve.open",
      valve_id: valveId,
      max_sec: parsed.data.max_sec,
      reason: parsed.data.reason,
      hint: "Resend with confirm: true to commit. If frost is already armed and temp below threshold, Edge may spray without a second confirm.",
    });
  }

  const now = new Date().toISOString();
  const cmdId = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO commands (id, farm_id, device_id, action, payload_json, source, status, confirmed_by, created_at)
     VALUES (?, ?, ?, 'fps.valve.open', ?, 'ui', 'sent', 'user:operator', ?)`
  )
    .bind(
      cmdId,
      valve.farm_id,
      valveId,
      JSON.stringify({
        max_sec: parsed.data.max_sec,
        reason: parsed.data.reason,
      }),
      now
    )
    .run();

  await writeAudit(c.env.DB, {
    farm_id: valve.farm_id,
    actor: "user:operator",
    action: "fps.valve.open",
    entity: `device:${valveId}`,
    after: {
      max_sec: parsed.data.max_sec,
      reason: parsed.data.reason,
      command_id: cmdId,
    },
  });

  return c.json(
    { ok: true, command_id: cmdId, valve_id: valveId, status: "sent" },
    202
  );
});

// silence unused in case of tree-shake
void FPS_NODE_DRIVERS;
