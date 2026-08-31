import { writeAudit } from "./audit";
import type { LiveMetric } from "../do/farm-runtime";

export type LiveMetrics = Record<string, LiveMetric>;

export type ClimateZoneRow = {
  id: string;
  farm_id: string;
  plot_id: string | null;
  name: string;
  sensor_id: string;
  heater_id: string | null;
  cooler_id: string | null;
  battery_id: string | null;
  heat_c: number;
  cool_c: number;
  heat_c_min: number;
  heat_c_max: number;
  cool_c_min: number;
  cool_c_max: number;
  timeout_sec: number;
  enabled: number;
};

export type MetricPoint = { value: number; ts: string } | null;

export function metricOf(
  live: LiveMetrics | null | undefined,
  deviceId: string,
  metric: string
): MetricPoint {
  const row = live?.[`${deviceId}:${metric}`];
  if (!row) return null;
  return { value: row.value, ts: row.ts };
}

export async function latestReading(
  db: D1Database,
  deviceId: string,
  metric: string
): Promise<MetricPoint> {
  const row = await db
    .prepare(
      `SELECT value, ts FROM readings WHERE device_id = ? AND metric = ?
       ORDER BY ts DESC LIMIT 1`
    )
    .bind(deviceId, metric)
    .first<{ value: number; ts: string }>();
  return row ?? null;
}

export async function resolveMetric(
  db: D1Database,
  live: LiveMetrics | null | undefined,
  deviceId: string,
  metric: string
): Promise<MetricPoint> {
  return (
    metricOf(live, deviceId, metric) ??
    (await latestReading(db, deviceId, metric))
  );
}

export async function getHeatLockoutPct(
  db: D1Database,
  farmId: string
): Promise<number> {
  const row = await db
    .prepare(
      `SELECT heat_battery_min_pct FROM climate_settings WHERE farm_id = ?`
    )
    .bind(farmId)
    .first<{ heat_battery_min_pct: number }>();
  return row?.heat_battery_min_pct ?? 30;
}

export async function listClimateZones(
  db: D1Database,
  farmId: string
): Promise<ClimateZoneRow[]> {
  const { results } = await db
    .prepare(
      `SELECT id, farm_id, plot_id, name, sensor_id, heater_id, cooler_id, battery_id,
              heat_c, cool_c, heat_c_min, heat_c_max, cool_c_min, cool_c_max,
              timeout_sec, enabled
       FROM climate_zones WHERE farm_id = ? ORDER BY name`
    )
    .bind(farmId)
    .all<ClimateZoneRow>();
  return results ?? [];
}

export async function climateNow(
  db: D1Database,
  farmId: string,
  slug: string,
  live: LiveMetrics | null | undefined
) {
  const heat_battery_min_pct = await getHeatLockoutPct(db, farmId);
  const zones = await listClimateZones(db, farmId);
  const out = [];
  for (const z of zones) {
    const temp = await resolveMetric(db, live, z.sensor_id, "temp_c");
    const rh = await resolveMetric(db, live, z.sensor_id, "rh");
    const batId = z.battery_id || "ups-1";
    const battery = await resolveMetric(db, live, batId, "battery_pct");
    const heatBlocked =
      battery == null || battery.value < heat_battery_min_pct;
    out.push({
      ...z,
      temp_c: temp?.value ?? null,
      rh: rh?.value ?? null,
      battery_pct: battery?.value ?? null,
      heat_blocked: heatBlocked,
    });
  }
  return {
    farm_id: farmId,
    slug,
    heat_battery_min_pct,
    zones: out,
  };
}

export async function climateOverview(
  db: D1Database,
  farmId: string,
  live: LiveMetrics | null | undefined
) {
  const now = await climateNow(db, farmId, "", live);
  const z = now.zones[0];
  return {
    heat_battery_min_pct: now.heat_battery_min_pct,
    zone_count: now.zones.length,
    heat_c: z?.heat_c ?? null,
    cool_c: z?.cool_c ?? null,
    temp_c: z?.temp_c ?? null,
    heat_blocked: z?.heat_blocked ?? false,
  };
}

export type SetpointApplyInput = {
  zone: ClimateZoneRow;
  farmId: string;
  heat_c?: number;
  cool_c?: number;
  reason: string;
  confirm: boolean;
  actor: string;
  live: LiveMetrics | null | undefined;
};

export type SetpointApplyResult =
  | {
      ok: true;
      proposal: true;
      zone_id: string;
      zone_name: string;
      heat_c: number;
      cool_c: number;
      reason: string;
    }
  | {
      ok: true;
      proposal: false;
      command_id: string;
      zone_id: string;
      device_id: string | null;
      heat_c: number;
      cool_c: number;
      timeout_sec: number;
      status: string;
    }
  | { ok: false; error: string; status: number; message?: string };

export async function applyClimateSetpoint(
  db: D1Database,
  input: SetpointApplyInput
): Promise<SetpointApplyResult> {
  const { zone } = input;
  if (!zone.enabled) {
    return { ok: false, error: "zone_disabled", status: 409 };
  }

  const nextHeat = input.heat_c ?? zone.heat_c;
  const nextCool = input.cool_c ?? zone.cool_c;

  if (nextHeat < zone.heat_c_min || nextHeat > zone.heat_c_max) {
    return {
      ok: false,
      error: "heat_out_of_range",
      status: 400,
      message: `heat_c must be ${zone.heat_c_min}–${zone.heat_c_max}`,
    };
  }
  if (nextCool < zone.cool_c_min || nextCool > zone.cool_c_max) {
    return {
      ok: false,
      error: "cool_out_of_range",
      status: 400,
      message: `cool_c must be ${zone.cool_c_min}–${zone.cool_c_max}`,
    };
  }
  if (nextHeat >= nextCool) {
    return {
      ok: false,
      error: "heat_c must be < cool_c",
      status: 400,
    };
  }

  if (!input.confirm) {
    return {
      ok: true,
      proposal: true,
      zone_id: zone.id,
      zone_name: zone.name,
      heat_c: nextHeat,
      cool_c: nextCool,
      reason: input.reason,
    };
  }

  const temp = await resolveMetric(db, input.live, zone.sensor_id, "temp_c");
  const wouldHeat = temp == null || temp.value < nextHeat;
  if (wouldHeat) {
    const batId = zone.battery_id || "ups-1";
    const battery = await resolveMetric(db, input.live, batId, "battery_pct");
    const minPct = await getHeatLockoutPct(db, input.farmId);
    if (battery == null || battery.value < minPct) {
      return {
        ok: false,
        error: "heat_lockout",
        status: 409,
        message: `Do not heat if battery < ${minPct}%`,
      };
    }
  }

  const cmdId = crypto.randomUUID();
  const now = new Date().toISOString();
  const deviceId = zone.heater_id || zone.sensor_id;
  const payload = {
    zone_id: zone.id,
    heat_c: nextHeat,
    cool_c: nextCool,
    timeout_sec: zone.timeout_sec,
    reason: input.reason,
    heater_id: zone.heater_id,
    cooler_id: zone.cooler_id,
    sensor_id: zone.sensor_id,
    battery_id: zone.battery_id,
  };

  await db
    .prepare(
      `UPDATE climate_zones SET heat_c = ?, cool_c = ? WHERE id = ?`
    )
    .bind(nextHeat, nextCool, zone.id)
    .run();

  await db
    .prepare(
      `INSERT INTO commands (id, farm_id, device_id, action, payload_json, source, status, confirmed_by, created_at)
       VALUES (?, ?, ?, 'setpoint.set', ?, 'ui', 'sent', ?, ?)`
    )
    .bind(
      cmdId,
      input.farmId,
      deviceId,
      JSON.stringify(payload),
      input.actor,
      now
    )
    .run();

  await writeAudit(db, {
    farm_id: input.farmId,
    actor: input.actor,
    action: "climate.setpoint",
    entity: `zone:${zone.id}`,
    before: { heat_c: zone.heat_c, cool_c: zone.cool_c },
    after: {
      heat_c: nextHeat,
      cool_c: nextCool,
      command_id: cmdId,
      reason: input.reason,
    },
  });

  return {
    ok: true,
    proposal: false,
    command_id: cmdId,
    zone_id: zone.id,
    device_id: deviceId,
    heat_c: nextHeat,
    cool_c: nextCool,
    timeout_sec: zone.timeout_sec,
    status: "sent",
  };
}
