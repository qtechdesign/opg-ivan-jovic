import { writeAudit } from "./audit";
import type { LiveMetrics } from "./climate";
import { latestReading, metricOf, resolveMetric } from "./climate";

const INVERTER_ID = "inv-1";
const BATTERY_ID = "ups-1";

export function localDateInTz(now: Date, timezone: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(now);
}

export function addDays(localDate: string, days: number): string {
  const [y, m, d] = localDate.split("-").map(Number);
  const utc = Date.UTC(y!, m! - 1, d! + days);
  const dt = new Date(utc);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** UTC instant of local midnight for YYYY-MM-DD in timezone. */
export function startOfLocalDayUtc(localDate: string, timezone: string): string {
  const [y, mo, d] = localDate.split("-").map(Number);
  let guess = Date.UTC(y!, mo! - 1, d!, 0, 0, 0);
  for (let i = -14; i <= 14; i++) {
    const candidate = guess + i * 3600_000;
    if (localDateInTz(new Date(candidate), timezone) !== localDate) continue;
    const prev = candidate - 60_000;
    if (localDateInTz(new Date(prev), timezone) !== localDate) {
      return new Date(candidate).toISOString();
    }
  }
  return new Date(guess).toISOString();
}

async function kwhDeltaSince(
  db: D1Database,
  deviceId: string,
  sinceIso: string
): Promise<number | null> {
  const first = await db
    .prepare(
      `SELECT value FROM readings
       WHERE device_id = ? AND metric = 'kwh' AND ts >= ?
       ORDER BY ts ASC LIMIT 1`
    )
    .bind(deviceId, sinceIso)
    .first<{ value: number }>();
  const last = await db
    .prepare(
      `SELECT value FROM readings
       WHERE device_id = ? AND metric = 'kwh' AND ts >= ?
       ORDER BY ts DESC LIMIT 1`
    )
    .bind(deviceId, sinceIso)
    .first<{ value: number }>();
  if (first == null || last == null) return null;
  const delta = last.value - first.value;
  return delta >= 0 ? delta : null;
}

export async function energyNow(
  db: D1Database,
  farmId: string,
  slug: string,
  timezone: string,
  live: LiveMetrics | null | undefined
) {
  const solar_w =
    (await resolveMetric(db, live, INVERTER_ID, "w"))?.value ?? null;

  const kwhTodayMetric = await resolveMetric(
    db,
    live,
    INVERTER_ID,
    "kwh_today"
  );
  let kwh_today = kwhTodayMetric?.value ?? null;
  if (kwh_today == null) {
    const local = localDateInTz(new Date(), timezone);
    const since = startOfLocalDayUtc(local, timezone);
    kwh_today = await kwhDeltaSince(db, INVERTER_ID, since);
  }

  const battery_pct =
    (await resolveMetric(db, live, BATTERY_ID, "battery_pct"))?.value ?? null;

  const yesterday = addDays(localDateInTz(new Date(), timezone), -1);
  const yrow = await db
    .prepare(
      `SELECT kwh FROM energy_daily
       WHERE farm_id = ? AND local_date = ? AND device_id = ?`
    )
    .bind(farmId, yesterday, INVERTER_ID)
    .first<{ kwh: number | null }>();

  const loadIds = [
    { id: INVERTER_ID, name: "Inverter" },
    { id: "edge-1", name: "Edge" },
    { id: "heater-house-1", name: "Heater" },
  ];
  const loads = [];
  for (const l of loadIds) {
    const w = metricOf(live, l.id, "w") ?? (await latestReading(db, l.id, "w"));
    loads.push({ id: l.id, name: l.name, w: w?.value ?? null });
  }

  return {
    farm_id: farmId,
    slug,
    solar_w,
    kwh_today,
    kwh_yesterday: yrow?.kwh ?? null,
    battery_pct,
    inverter_id: INVERTER_ID,
    loads,
  };
}

export async function energyOverview(
  db: D1Database,
  farmId: string,
  slug: string,
  timezone: string,
  live: LiveMetrics | null | undefined
) {
  const now = await energyNow(db, farmId, slug, timezone, live);
  return {
    solar_w: now.solar_w,
    kwh_today: now.kwh_today,
    battery_pct: now.battery_pct,
  };
}

/** Roll up yesterday's inverter kWh into energy_daily. Idempotent. */
export async function settleEnergyDaily(
  db: D1Database,
  farmId: string,
  timezone: string,
  now = new Date()
): Promise<{ settled: boolean; local_date?: string; kwh?: number | null }> {
  const today = localDateInTz(now, timezone);
  const yesterday = addDays(today, -1);

  const existing = await db
    .prepare(
      `SELECT kwh FROM energy_daily
       WHERE farm_id = ? AND local_date = ? AND device_id = ?`
    )
    .bind(farmId, yesterday, INVERTER_ID)
    .first();
  if (existing) {
    return { settled: false, local_date: yesterday };
  }

  const since = startOfLocalDayUtc(yesterday, timezone);
  const until = startOfLocalDayUtc(today, timezone);

  const first = await db
    .prepare(
      `SELECT value FROM readings
       WHERE device_id = ? AND metric = 'kwh' AND ts >= ? AND ts < ?
       ORDER BY ts ASC LIMIT 1`
    )
    .bind(INVERTER_ID, since, until)
    .first<{ value: number }>();
  const last = await db
    .prepare(
      `SELECT value FROM readings
       WHERE device_id = ? AND metric = 'kwh' AND ts >= ? AND ts < ?
       ORDER BY ts DESC LIMIT 1`
    )
    .bind(INVERTER_ID, since, until)
    .first<{ value: number }>();

  let kwh: number | null = null;
  if (first != null && last != null && last.value >= first.value) {
    kwh = last.value - first.value;
  }

  const peak = await db
    .prepare(
      `SELECT MAX(value) AS peak FROM readings
       WHERE device_id = ? AND metric = 'w' AND ts >= ? AND ts < ?`
    )
    .bind(INVERTER_ID, since, until)
    .first<{ peak: number | null }>();

  if (kwh == null && (peak?.peak == null || peak.peak === null)) {
    return { settled: false, local_date: yesterday, kwh: null };
  }

  const settled_at = now.toISOString();
  await db
    .prepare(
      `INSERT INTO energy_daily (farm_id, local_date, device_id, kwh, w_peak, settled_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(farmId, yesterday, INVERTER_ID, kwh, peak?.peak ?? null, settled_at)
    .run();

  await writeAudit(db, {
    farm_id: farmId,
    actor: "cron:solar-settle",
    action: "energy.settle",
    entity: `inv-1:${yesterday}`,
    after: { local_date: yesterday, kwh, w_peak: peak?.peak ?? null },
  });

  return { settled: true, local_date: yesterday, kwh };
}
