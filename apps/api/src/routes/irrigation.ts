import { Hono } from "hono";
import {
  PutIrrigationScheduleSchema,
  RainLockoutSchema,
  RunIrrigationSchema,
} from "@polje/schema";
import { requireOperator, requireOperatorOrIngest } from "../lib/auth";
import { writeAudit } from "../lib/audit";
import { farmSlugFromQuery, getFarmBySlug } from "../lib/farm";

type AppEnv = { Bindings: Cloudflare.Env };

type ZoneRow = {
  id: string;
  farm_id: string;
  plot_id: string | null;
  name: string;
  kind: "drip" | "frost";
  device_id: string;
  max_duration_sec: number;
  default_duration_sec: number;
  rain_lockout: number;
  enabled: number;
};

type RunRow = {
  id: string;
  zone_id: string;
  started_at: string;
  ended_at: string | null;
  duration_sec: number;
  source: string;
  command_id: string | null;
  status: string;
  reason: string | null;
};

export const irrigationApi = new Hono<AppEnv>();

async function getRainLockout(db: D1Database, farmId: string): Promise<boolean> {
  const row = await db
    .prepare(`SELECT rain_lockout FROM farm_settings WHERE farm_id = ?`)
    .bind(farmId)
    .first<{ rain_lockout: number }>();
  return (row?.rain_lockout ?? 0) === 1;
}

function isRunning(run: RunRow | null | undefined, now = Date.now()): boolean {
  if (!run) return false;
  if (run.status === "done" || run.status === "failed" || run.status === "cancelled") {
    return false;
  }
  if (run.ended_at) return false;
  const start = Date.parse(run.started_at);
  if (Number.isNaN(start)) return false;
  return now < start + run.duration_sec * 1000;
}

irrigationApi.get("/v1/irrigation/zones", async (c) => {
  const slug = farmSlugFromQuery(c);
  const farm = await getFarmBySlug(c.env.DB, slug);
  if (!farm) return c.json({ error: "farm_not_found", slug }, 404);

  const rain_lockout = await getRainLockout(c.env.DB, farm.id);

  const { results: zones } = await c.env.DB.prepare(
    `SELECT id, farm_id, plot_id, name, kind, device_id,
            max_duration_sec, default_duration_sec, rain_lockout, enabled
     FROM irrigation_zones WHERE farm_id = ? ORDER BY name`
  )
    .bind(farm.id)
    .all<ZoneRow>();

  const { results: recent } = await c.env.DB.prepare(
    `SELECT id, zone_id, started_at, ended_at, duration_sec, source, command_id, status, reason
     FROM irrigation_runs WHERE farm_id = ?
     ORDER BY started_at DESC LIMIT 100`
  )
    .bind(farm.id)
    .all<RunRow>();

  const lastByZone = new Map<string, RunRow>();
  for (const r of recent ?? []) {
    if (!lastByZone.has(r.zone_id)) lastByZone.set(r.zone_id, r);
  }

  return c.json({
    farm_id: farm.id,
    slug: farm.slug,
    rain_lockout,
    frost_armed: false,
    zones: (zones ?? []).map((z) => {
      const last = lastByZone.get(z.id) ?? null;
      return {
        ...z,
        state: isRunning(last) ? "running" : "idle",
        last_run: last,
      };
    }),
  });
});

irrigationApi.post("/v1/irrigation/zones/:id/run", async (c) => {
  const denied = await requireOperator(c);
  if (denied) return denied;

  const id = c.req.param("id");
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }

  const parsed = RunIrrigationSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "validation", details: parsed.error.flatten() }, 400);
  }

  const zone = await c.env.DB.prepare(
    `SELECT id, farm_id, plot_id, name, kind, device_id,
            max_duration_sec, default_duration_sec, rain_lockout, enabled
     FROM irrigation_zones WHERE id = ?`
  )
    .bind(id)
    .first<ZoneRow>();

  if (!zone) return c.json({ error: "zone_not_found" }, 404);
  if (!zone.enabled) return c.json({ error: "zone_disabled" }, 409);

  const duration_sec = Math.min(parsed.data.duration_sec, zone.max_duration_sec);
  if (duration_sec < 30) {
    return c.json({ error: "duration_too_short", min: 30 }, 400);
  }

  const proposal = {
    proposal: true as const,
    zone_id: zone.id,
    zone_name: zone.name,
    kind: zone.kind,
    device_id: zone.device_id,
    duration_sec,
    max_duration_sec: zone.max_duration_sec,
    reason: parsed.data.reason,
    rain_lockout_applies: zone.kind === "drip",
  };

  if (parsed.data.confirm !== true) {
    return c.json(proposal, 200);
  }

  const farmRain = await getRainLockout(c.env.DB, zone.farm_id);
  if (zone.kind === "drip" && farmRain) {
    return c.json(
      {
        error: "rain_lockout",
        message: "Drip blocked while farm rain lockout is on. Frost zones are not blocked.",
      },
      409
    );
  }

  const cmdId = crypto.randomUUID();
  const runId = crypto.randomUUID();
  const now = new Date().toISOString();
  const payload = {
    zone_id: zone.id,
    duration_sec,
    timeout_sec: duration_sec,
    reason: parsed.data.reason,
  };

  await c.env.DB.prepare(
    `INSERT INTO commands (id, farm_id, device_id, action, payload_json, source, status, confirmed_by, created_at)
     VALUES (?, ?, ?, 'valve.open', ?, 'ui', 'sent', 'user:operator', ?)`
  )
    .bind(cmdId, zone.farm_id, zone.device_id, JSON.stringify(payload), now)
    .run();

  await c.env.DB.prepare(
    `INSERT INTO irrigation_runs
       (id, farm_id, zone_id, started_at, ended_at, duration_sec, source, command_id, status, water_m3, reason)
     VALUES (?, ?, ?, ?, NULL, ?, 'ui', ?, 'sent', NULL, ?)`
  )
    .bind(runId, zone.farm_id, zone.id, now, duration_sec, cmdId, parsed.data.reason)
    .run();

  await writeAudit(c.env.DB, {
    farm_id: zone.farm_id,
    actor: "user:operator",
    action: "irrigation.run",
    entity: `zone:${zone.id}`,
    before: { state: "idle" },
    after: {
      run_id: runId,
      command_id: cmdId,
      duration_sec,
      reason: parsed.data.reason,
      kind: zone.kind,
      device_id: zone.device_id,
    },
  });

  return c.json(
    {
      ok: true,
      proposal: false,
      run_id: runId,
      command_id: cmdId,
      zone_id: zone.id,
      device_id: zone.device_id,
      duration_sec,
      status: "sent",
    },
    202
  );
});

irrigationApi.post("/v1/irrigation/rain-lockout", async (c) => {
  const denied = await requireOperator(c);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }

  const parsed = RainLockoutSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "validation", details: parsed.error.flatten() }, 400);
  }

  const slug = farmSlugFromQuery(c);
  const farm = await getFarmBySlug(c.env.DB, slug);
  if (!farm) return c.json({ error: "farm_not_found", slug }, 404);

  const before = await getRainLockout(c.env.DB, farm.id);
  const after = parsed.data.enabled;

  if (parsed.data.confirm !== true) {
    return c.json(
      {
        proposal: true,
        rain_lockout: after,
        before,
        reason: parsed.data.reason,
      },
      200
    );
  }

  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `INSERT INTO farm_settings (farm_id, rain_lockout, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(farm_id) DO UPDATE SET
       rain_lockout = excluded.rain_lockout,
       updated_at = excluded.updated_at`
  )
    .bind(farm.id, after ? 1 : 0, now)
    .run();

  await writeAudit(c.env.DB, {
    farm_id: farm.id,
    actor: "user:operator",
    action: "irrigation.rain_lockout",
    entity: `farm:${farm.slug}`,
    before: { rain_lockout: before },
    after: { rain_lockout: after, reason: parsed.data.reason },
  });

  return c.json({ ok: true, rain_lockout: after });
});

irrigationApi.get("/v1/irrigation/schedules", async (c) => {
  const denied = await requireOperatorOrIngest(c);
  if (denied) return denied;

  const slug = farmSlugFromQuery(c);
  const farm = await getFarmBySlug(c.env.DB, slug);
  if (!farm) return c.json({ error: "farm_not_found", slug }, 404);

  const enabledOnly = c.req.query("enabled") === "1";
  let sql = `SELECT s.id, s.farm_id, s.zone_id, s.time_local, s.days_json, s.duration_sec, s.timezone, s.enabled,
                    z.device_id, z.kind
             FROM irrigation_schedules s
             JOIN irrigation_zones z ON z.id = s.zone_id
             WHERE s.farm_id = ?`;
  if (enabledOnly) sql += ` AND s.enabled = 1`;
  sql += ` ORDER BY s.time_local`;

  const { results } = await c.env.DB.prepare(sql).bind(farm.id).all();
  return c.json({ farm_id: farm.id, schedules: results ?? [] });
});

irrigationApi.put("/v1/irrigation/schedules/:id", async (c) => {
  const denied = await requireOperator(c);
  if (denied) return denied;

  const id = c.req.param("id");
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }

  const parsed = PutIrrigationScheduleSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "validation", details: parsed.error.flatten() }, 400);
  }

  const before = await c.env.DB.prepare(
    `SELECT id, farm_id, zone_id, time_local, days_json, duration_sec, timezone, enabled
     FROM irrigation_schedules WHERE id = ?`
  )
    .bind(id)
    .first<{
      id: string;
      farm_id: string;
      zone_id: string;
      time_local: string;
      days_json: string;
      duration_sec: number;
      timezone: string;
      enabled: number;
    }>();

  if (!before) return c.json({ error: "schedule_not_found" }, 404);

  const next = {
    time_local: parsed.data.time_local ?? before.time_local,
    days_json: parsed.data.days_json ?? before.days_json,
    duration_sec: parsed.data.duration_sec ?? before.duration_sec,
    timezone: parsed.data.timezone ?? before.timezone,
    enabled:
      parsed.data.enabled !== undefined ? parsed.data.enabled : before.enabled,
  };

  const enabling = next.enabled === 1 && before.enabled === 0;
  if (enabling && parsed.data.confirm !== true) {
    return c.json(
      {
        proposal: true,
        schedule_id: id,
        before,
        after: next,
        reason: parsed.data.reason ?? null,
        hint: "Enabling a schedule requires confirm: true and reason",
      },
      200
    );
  }

  if (enabling && (!parsed.data.reason || parsed.data.reason.length < 3)) {
    return c.json({ error: "reason_required_to_enable" }, 400);
  }

  await c.env.DB.prepare(
    `UPDATE irrigation_schedules
     SET time_local = ?, days_json = ?, duration_sec = ?, timezone = ?, enabled = ?
     WHERE id = ?`
  )
    .bind(
      next.time_local,
      next.days_json,
      next.duration_sec,
      next.timezone,
      next.enabled,
      id
    )
    .run();

  await writeAudit(c.env.DB, {
    farm_id: before.farm_id,
    actor: "user:operator",
    action: "irrigation.schedule.put",
    entity: `schedule:${id}`,
    before,
    after: { ...next, reason: parsed.data.reason ?? null },
  });

  return c.json({ ok: true, id, ...next });
});

/** Shared helper for overview + cron */
export async function irrigationOverview(
  db: D1Database,
  farmId: string
): Promise<{
  rain_lockout: boolean;
  frost_armed: boolean;
  zones: { id: string; name: string; kind: string; state: string }[];
  last_drip: RunRow | null;
}> {
  const rain_lockout = await getRainLockout(db, farmId);
  const { results: zones } = await db
    .prepare(
      `SELECT id, name, kind FROM irrigation_zones WHERE farm_id = ? AND enabled = 1 ORDER BY name`
    )
    .bind(farmId)
    .all<{ id: string; name: string; kind: string }>();

  const { results: recent } = await db
    .prepare(
      `SELECT id, zone_id, started_at, ended_at, duration_sec, source, command_id, status, reason
       FROM irrigation_runs WHERE farm_id = ?
       ORDER BY started_at DESC LIMIT 50`
    )
    .bind(farmId)
    .all<RunRow>();

  const lastByZone = new Map<string, RunRow>();
  for (const r of recent ?? []) {
    if (!lastByZone.has(r.zone_id)) lastByZone.set(r.zone_id, r);
  }

  let last_drip: RunRow | null = null;
  for (const z of zones ?? []) {
    if (z.kind !== "drip") continue;
    const r = lastByZone.get(z.id);
    if (r) {
      last_drip = r;
      break;
    }
  }

  return {
    rain_lockout,
    frost_armed: false,
    zones: (zones ?? []).map((z) => ({
      id: z.id,
      name: z.name,
      kind: z.kind,
      state: isRunning(lastByZone.get(z.id)) ? "running" : "idle",
    })),
    last_drip,
  };
}

/** Insert valve.open from an enabled schedule if due and not recently run. */
export async function tickIrrigationSchedules(
  db: D1Database,
  farmId: string,
  farmUuid: string,
  timezone: string
): Promise<number> {
  const { results: schedules } = await db
    .prepare(
      `SELECT s.id, s.zone_id, s.time_local, s.days_json, s.duration_sec, s.timezone,
              z.device_id, z.kind, z.max_duration_sec, z.enabled AS zone_enabled
       FROM irrigation_schedules s
       JOIN irrigation_zones z ON z.id = s.zone_id
       WHERE s.farm_id = ? AND s.enabled = 1`
    )
    .bind(farmUuid)
    .all<{
      id: string;
      zone_id: string;
      time_local: string;
      days_json: string;
      duration_sec: number;
      timezone: string;
      device_id: string;
      kind: string;
      max_duration_sec: number;
      zone_enabled: number;
    }>();

  if (!schedules?.length) return 0;

  const rain = await getRainLockout(db, farmUuid);
  let created = 0;
  const now = new Date();

  for (const s of schedules) {
    if (!s.zone_enabled) continue;
    if (s.kind === "drip" && rain) continue;

    const tz = s.timezone || timezone || "Europe/Zagreb";
    if (!isScheduleDue(now, s.time_local, s.days_json, tz)) continue;

    const recent = await db
      .prepare(
        `SELECT id FROM irrigation_runs
         WHERE zone_id = ? AND source = 'schedule'
           AND started_at >= ?
         LIMIT 1`
      )
      .bind(s.zone_id, new Date(now.getTime() - s.duration_sec * 1000).toISOString())
      .first();
    if (recent) continue;

    // Dedupe: pending command for this device already sent
    const pending = await db
      .prepare(
        `SELECT id FROM commands
         WHERE farm_id = ? AND device_id = ? AND action = 'valve.open' AND status = 'sent'
         LIMIT 1`
      )
      .bind(farmUuid, s.device_id)
      .first();
    if (pending) continue;

    const duration_sec = Math.min(s.duration_sec, s.max_duration_sec, 3600);
    const cmdId = crypto.randomUUID();
    const runId = crypto.randomUUID();
    const ts = now.toISOString();
    const payload = {
      zone_id: s.zone_id,
      duration_sec,
      timeout_sec: duration_sec,
      reason: `schedule:${s.id}`,
      schedule_id: s.id,
    };

    await db
      .prepare(
        `INSERT INTO commands (id, farm_id, device_id, action, payload_json, source, status, confirmed_by, created_at)
         VALUES (?, ?, ?, 'valve.open', ?, 'schedule', 'sent', 'cron', ?)`
      )
      .bind(cmdId, farmUuid, s.device_id, JSON.stringify(payload), ts)
      .run();

    await db
      .prepare(
        `INSERT INTO irrigation_runs
           (id, farm_id, zone_id, started_at, ended_at, duration_sec, source, command_id, status, water_m3, reason)
         VALUES (?, ?, ?, ?, NULL, ?, 'schedule', ?, 'sent', NULL, ?)`
      )
      .bind(runId, farmUuid, s.zone_id, ts, duration_sec, cmdId, `schedule:${s.id}`)
      .run();

    await writeAudit(db, {
      farm_id: farmUuid,
      actor: "cron",
      action: "irrigation.run",
      entity: `zone:${s.zone_id}`,
      after: {
        run_id: runId,
        command_id: cmdId,
        schedule_id: s.id,
        duration_sec,
        source: "schedule",
      },
    });
    created += 1;
  }

  return created;
}

function isScheduleDue(
  now: Date,
  timeLocal: string,
  daysJson: string,
  timezone: string
): boolean {
  const parts = timeLocal.split(":");
  const hh = Number(parts[0]);
  const mm = Number(parts[1]);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return false;

  let days: number[] = [];
  try {
    days = JSON.parse(daysJson) as number[];
  } catch {
    return false;
  }

  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const bits = fmt.formatToParts(now);
  const hour = Number(bits.find((p) => p.type === "hour")?.value);
  const minute = Number(bits.find((p) => p.type === "minute")?.value);
  const weekday = bits.find((p) => p.type === "weekday")?.value ?? "";
  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const dow = dayMap[weekday];
  if (dow === undefined || !days.includes(dow)) return false;

  // Due within the current 5-minute cron window
  const nowMins = hour * 60 + minute;
  const target = hh * 60 + mm;
  return nowMins >= target && nowMins < target + 5;
}
