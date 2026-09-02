import {
  analogLiveOn,
  fetchAnalogObservation,
  syntheticObservation,
} from "./analog";
import {
  buildSchedule,
  type IrrigationLine,
  type SystemParams,
  type WeatherDay,
} from "./dewline-pack";
import {
  computeSavings,
  defaultTankOpts,
  tankSeries,
  tankStateAt,
} from "./dewline-tank";
import { ANALOG_RAIN_MM, haToM2, pondGeom } from "./water-budget";
import { listPondWorks } from "./water-works";

export const DEFAULT_MAIN_FLOW_M3H = 8;
export const DEFAULT_DRIP_FLOW_M3H = 1.2;
export const DEFAULT_CYCLES_PER_DAY = 1;
export const DEFAULT_WATER_PRICE_CENTS = 240;
export const DEFAULT_WELL_RATE_M3H = 0;

export type ZoneRow = {
  id: string;
  name: string;
  kind: string;
  default_duration_sec: number;
  flow_m3h: number | null;
  valve_box: string | null;
};

export type PumpRow = {
  main_flow_m3h: number | null;
  cycles_per_day: number | null;
  well_rate_m3h: number | null;
  water_price_cents: number | null;
};

export function zoneToLine(z: ZoneRow): IrrigationLine {
  const flow =
    z.flow_m3h != null && Number.isFinite(z.flow_m3h) && z.flow_m3h > 0
      ? z.flow_m3h
      : DEFAULT_DRIP_FLOW_M3H;
  const durationMin = Math.max(1, Math.round((z.default_duration_sec || 600) / 60));
  return {
    lineId: z.id,
    valveBox: (z.valve_box ?? "").trim(),
    valveNumber: z.id.slice(0, 8),
    zone: z.name,
    type: "drip",
    flowM3h: flow,
    durationMin,
  };
}

export async function loadPumpSettings(
  db: D1Database,
  farmId: string
): Promise<{
  main_flow_m3h: number;
  cycles_per_day: number;
  well_rate_m3h: number;
  water_price_cents: number;
}> {
  try {
    const row = await db
      .prepare(
        `SELECT main_flow_m3h, cycles_per_day, well_rate_m3h, water_price_cents
         FROM farm_settings WHERE farm_id = ?`
      )
      .bind(farmId)
      .first<PumpRow>();
    return {
      main_flow_m3h: numOr(row?.main_flow_m3h, DEFAULT_MAIN_FLOW_M3H),
      cycles_per_day: Math.max(
        1,
        Math.min(4, Math.round(numOr(row?.cycles_per_day, DEFAULT_CYCLES_PER_DAY)))
      ),
      well_rate_m3h: Math.max(0, numOr(row?.well_rate_m3h, DEFAULT_WELL_RATE_M3H)),
      water_price_cents: Math.max(
        0,
        Math.round(numOr(row?.water_price_cents, DEFAULT_WATER_PRICE_CENTS))
      ),
    };
  } catch {
    return {
      main_flow_m3h: DEFAULT_MAIN_FLOW_M3H,
      cycles_per_day: DEFAULT_CYCLES_PER_DAY,
      well_rate_m3h: DEFAULT_WELL_RATE_M3H,
      water_price_cents: DEFAULT_WATER_PRICE_CENTS,
    };
  }
}

export async function loadDripZones(
  db: D1Database,
  farmId: string
): Promise<ZoneRow[]> {
  try {
    const { results } = await db
      .prepare(
        `SELECT id, name, kind, default_duration_sec, flow_m3h, valve_box
         FROM irrigation_zones
         WHERE farm_id = ? AND enabled = 1 AND kind = 'drip'
         ORDER BY name`
      )
      .bind(farmId)
      .all<ZoneRow>();
    return results ?? [];
  } catch {
    const { results } = await db
      .prepare(
        `SELECT id, name, kind, default_duration_sec
         FROM irrigation_zones
         WHERE farm_id = ? AND enabled = 1 AND kind = 'drip'
         ORDER BY name`
      )
      .bind(farmId)
      .all<Omit<ZoneRow, "flow_m3h" | "valve_box">>();
    return (results ?? []).map((z) => ({
      ...z,
      flow_m3h: null,
      valve_box: null,
    }));
  }
}

export async function pondStorage(db: D1Database, farmId: string): Promise<{
  storage_m3: number;
  catchment_m2: number;
  initial_pct: number;
}> {
  const { results: plots } = await db
    .prepare(`SELECT id, hectares FROM plots WHERE farm_id = ? AND use_type = 'pond'`)
    .bind(farmId)
    .all<{ id: string; hectares: number | null }>();
  const works = await listPondWorks(db, farmId).catch(() => []);
  const byPlot = new Map(works.map((w) => [w.plot_id, w]));
  let storage = 0;
  let catchment = 0;
  let fill: number | null = null;
  for (const p of plots ?? []) {
    const w = byPlot.get(p.id);
    const area = haToM2(p.hectares);
    const depth = w?.depth_m ?? 2.2;
    const slope = w?.bank_slope ?? 2.5;
    const factor = w?.catchment_factor ?? 4;
    const geom = pondGeom(area, depth, slope);
    storage += geom.usable_m3;
    catchment += area * factor;
    if (fill == null && w?.fill_pct != null) fill = w.fill_pct;
  }
  return {
    storage_m3: Math.round(storage * 10) / 10,
    catchment_m2: Math.round(catchment * 10) / 10,
    initial_pct: fill != null ? Math.min(100, Math.max(0, fill)) : 80,
  };
}

export async function weatherForPack(
  env: Cloudflare.Env,
  precipOverride: number | null
): Promise<WeatherDay[]> {
  const date = new Date().toISOString().slice(0, 10);
  if (precipOverride != null && Number.isFinite(precipOverride)) {
    return [{ date, precipMm: Math.max(0, precipOverride), tempMaxC: 24, tempMinC: 14 }];
  }
  const obs = analogLiveOn(env)
    ? await fetchAnalogObservation()
    : syntheticObservation();
  return [
    {
      date,
      precipMm: obs.precip_mm,
      tempMaxC: obs.temp_c,
      tempMinC: Math.round((obs.temp_c - 8) * 10) / 10,
    },
  ];
}

export async function packFarm(opts: {
  env: Cloudflare.Env;
  farmId: string;
  precipMm?: number | null;
}): Promise<Record<string, unknown>> {
  const [pump, zones, pond, weather] = await Promise.all([
    loadPumpSettings(opts.env.DB, opts.farmId),
    loadDripZones(opts.env.DB, opts.farmId),
    pondStorage(opts.env.DB, opts.farmId),
    weatherForPack(opts.env, opts.precipMm ?? null),
  ]);

  const lines = zones.map(zoneToLine);
  const storage = Math.max(0, pond.storage_m3);
  const params: SystemParams = {
    mainFlowM3h: pump.main_flow_m3h,
    cyclesPerDay: pump.cycles_per_day,
    weeklyFactor: 1,
    monthlyFactor: 1,
    waterPriceEurM3: pump.water_price_cents / 100,
    rainTankM3: storage,
    catchmentM2: pond.catchment_m2,
    annualRainMm: ANALOG_RAIN_MM,
    wellRateM3h: pump.well_rate_m3h,
    storageTankM3: storage,
    initialTankPct: pond.initial_pct,
    refillRateM3h: 0,
    fillSource: pump.well_rate_m3h > 0 ? "well" : "auto",
    supplyMode: "tank",
  };

  const result = buildSchedule(
    lines,
    params,
    weather,
    "Drip packed into pump capacity. Frost is a separate FPS program and is never rain-skipped with drip."
  );

  const tankOpts = defaultTankOpts(params);
  tankOpts.todayPrecipMm = weather[0]?.precipMm ?? 0;
  const series = storage > 0 ? tankSeries(result, tankOpts, 10) : [];
  const tankEnd = tankStateAt(result, 24 * 60, tankOpts);
  const savings = computeSavings(result, params);

  return {
    frost_excluded: true,
    params: {
      main_flow_m3h: pump.main_flow_m3h,
      cycles_per_day: pump.cycles_per_day,
      well_rate_m3h: pump.well_rate_m3h,
      water_price_cents: pump.water_price_cents,
      storage_m3: storage,
      catchment_m2: pond.catchment_m2,
      initial_tank_pct: pond.initial_pct,
    },
    lines: lines.map((l, i) => ({
      zone_id: l.lineId,
      name: l.zone,
      flow_m3h: l.flowM3h,
      duration_min: l.durationMin,
      valve_box: l.valveBox || null,
      defaulted_flow: zones[i]?.flow_m3h == null,
    })),
    slots: result.slots,
    flow_timeline: result.flowTimeline,
    peak_flow_m3h: result.peakFlowM3h,
    total_m3_day: result.totalM3Day,
    total_m3_week: result.totalM3Week,
    total_m3_month: result.totalM3Month,
    total_m3_year: result.totalM3Year,
    rain_adjusted_days: result.rainAdjustedDays,
    rationale: result.rationale,
    weather: result.weather,
    tank_series: series,
    tank_end: {
      fill_pct: Math.round(tankEnd.fillPct * 10) / 10,
      level_m3: tankEnd.levelM3,
      starved: tankEnd.starved,
      from_pond_m3: tankEnd.fromTankM3,
      from_well_m3: tankEnd.fromWellM3,
    },
    savings: savings
      ? {
          annual_rain_mm: savings.annualRainMm,
          rain_harvest_m3: Math.round(savings.rainHarvestM3 * 10) / 10,
          well_harvest_m3: Math.round(savings.wellHarvestM3 * 10) / 10,
          year_m3: Math.round(savings.yearM3 * 10) / 10,
          municipal_cents: Math.round(savings.municipalCostEur * 100),
          saved_cents: Math.round(savings.savedEur * 100),
          saved_pct: Math.round(savings.savedPct * 10) / 10,
        }
      : null,
  };
}

function numOr(v: number | null | undefined, fallback: number): number {
  if (v == null || !Number.isFinite(Number(v))) return fallback;
  return Number(v);
}
