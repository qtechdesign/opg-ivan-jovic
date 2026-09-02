import { Hono } from "hono";
import { HeatLockoutSchema, SetClimateSetpointSchema } from "@polje/schema";
import { requireOperator } from "../lib/auth";
import { writeAudit } from "../lib/audit";
import { farmSlugFromQuery, getFarmBySlug } from "../lib/farm";
import { loadLiveWithAnalog } from "../lib/analog";
import {
  applyClimateSetpoint,
  climateNow,
  getHeatLockoutPct,
  type ClimateZoneRow,
  type LiveMetrics,
} from "../lib/climate";
import { energyNow } from "../lib/energy";

type AppEnv = { Bindings: Cloudflare.Env };

export const climateApi = new Hono<AppEnv>();

async function liveFor(
  env: Cloudflare.Env,
  slug: string
): Promise<LiveMetrics> {
  const state = await loadLiveWithAnalog(env, slug);
  return state.metrics ?? {};
}

climateApi.get("/v1/climate/now", async (c) => {
  const slug = farmSlugFromQuery(c);
  const farm = await getFarmBySlug(c.env.DB, slug);
  if (!farm) return c.json({ error: "farm_not_found", slug }, 404);
  const live = await liveFor(c.env, farm.slug);
  const body = await climateNow(c.env.DB, farm.id, farm.slug, live);
  return c.json(body);
});

climateApi.get("/v1/energy/now", async (c) => {
  const slug = farmSlugFromQuery(c);
  const farm = await getFarmBySlug(c.env.DB, slug);
  if (!farm) return c.json({ error: "farm_not_found", slug }, 404);
  const live = await liveFor(c.env, farm.slug);
  const body = await energyNow(
    c.env.DB,
    farm.id,
    farm.slug,
    farm.timezone,
    live
  );
  return c.json(body);
});

climateApi.post("/v1/climate/zones/:id/setpoint", async (c) => {
  const denied = await requireOperator(c);
  if (denied) return denied;

  const id = c.req.param("id");
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }

  const parsed = SetClimateSetpointSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "validation", details: parsed.error.flatten() }, 400);
  }

  const row = await c.env.DB.prepare(
    `SELECT id, farm_id, plot_id, name, sensor_id, heater_id, cooler_id, battery_id,
            heat_c, cool_c, heat_c_min, heat_c_max, cool_c_min, cool_c_max,
            timeout_sec, enabled
     FROM climate_zones WHERE id = ?`
  )
    .bind(id)
    .first<ClimateZoneRow>();

  if (!row) return c.json({ error: "zone_not_found" }, 404);

  const farm = await c.env.DB.prepare(
    `SELECT slug FROM farms WHERE id = ?`
  )
    .bind(row.farm_id)
    .first<{ slug: string }>();
  const live = farm ? await liveFor(c.env, farm.slug) : {};

  const result = await applyClimateSetpoint(c.env.DB, {
    zone: row,
    farmId: row.farm_id,
    heat_c: parsed.data.heat_c,
    cool_c: parsed.data.cool_c,
    reason: parsed.data.reason,
    confirm: parsed.data.confirm === true,
    actor: "user:operator",
    live,
  });

  if (!result.ok) {
    return c.json(
      { error: result.error, message: result.message },
      result.status as 400 | 409
    );
  }
  if (result.proposal) {
    return c.json(result, 200);
  }
  return c.json(result, 202);
});

climateApi.post("/v1/climate/heat-lockout", async (c) => {
  const denied = await requireOperator(c);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }

  const parsed = HeatLockoutSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "validation", details: parsed.error.flatten() }, 400);
  }

  const slug = farmSlugFromQuery(c);
  const farm = await getFarmBySlug(c.env.DB, slug);
  if (!farm) return c.json({ error: "farm_not_found", slug }, 404);

  const before = await getHeatLockoutPct(c.env.DB, farm.id);

  if (parsed.data.confirm !== true) {
    return c.json({
      proposal: true,
      battery_min_pct: parsed.data.battery_min_pct,
      current: before,
      reason: parsed.data.reason,
    });
  }

  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `INSERT INTO climate_settings (farm_id, heat_battery_min_pct, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(farm_id) DO UPDATE SET
       heat_battery_min_pct = excluded.heat_battery_min_pct,
       updated_at = excluded.updated_at`
  )
    .bind(farm.id, parsed.data.battery_min_pct, now)
    .run();

  await writeAudit(c.env.DB, {
    farm_id: farm.id,
    actor: "user:operator",
    action: "climate.heat_lockout",
    entity: `farm:${farm.slug}`,
    before: { heat_battery_min_pct: before },
    after: {
      heat_battery_min_pct: parsed.data.battery_min_pct,
      reason: parsed.data.reason,
    },
  });

  return c.json({
    ok: true,
    proposal: false,
    battery_min_pct: parsed.data.battery_min_pct,
  });
});
