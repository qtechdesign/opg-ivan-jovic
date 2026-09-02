/**
 * First-principles farm water: net irrigation demand from plot use +
 * rain-fed pond storage (trapezoidal basin).
 *
 * Climate analog: Čigoč / Lonjsko polje (same as analog.ts) — not private GPS.
 * Net irrigation mm is already after typical continental rain (FAO-style
 * supplemental), so we do not subtract rainfall again from crop demand.
 * Pond yield does use annual rain minus open-water evaporation.
 */

export const ANALOG_RAIN_MM = 880;
export const OPEN_WATER_EVAP_MM = 1000;
export const FIELD_RUNOFF = 0.35;
export const DRY_SEASON_FRACTION = 0.5;
export const DEFAULT_POND_DEPTH_M = 2.2;
export const DEFAULT_BANK_SLOPE = 2.5;
export const DEFAULT_CATCHMENT_FACTOR = 4;
export const FREEBOARD_M = 0.3;

/** Supplemental irrigation mm/year by plot use (continental HR). */
export const IRRIGATION_MM: Record<string, number> = {
  garden: 350,
  herbs: 320,
  berries: 340,
  nursery: 380,
  greenhouse: 650,
  polytunnel: 520,
  orchard: 240,
  hops: 220,
  vineyard: 160,
  botanic: 280,
  research: 260,
  arable: 140,
  hay: 40,
  pasture: 30,
  livestock: 50,
  bees: 10,
  compost: 20,
  yard: 15,
  forest: 0,
  fallow: 0,
  other: 20,
  pond: 0,
};

/** Overhead frost nights on bloom-sensitive uses (mm/year, not drip). */
export const FROST_MM: Record<string, number> = {
  orchard: 70,
  vineyard: 50,
  hops: 40,
  botanic: 40,
  berries: 30,
  nursery: 20,
};

export type PondGeom = {
  area_m2: number;
  depth_m: number;
  bank_slope: number;
  bottom_m2: number;
  volume_m3: number;
  usable_m3: number;
  too_steep: boolean;
};

export function haToM2(ha: number | null | undefined): number {
  if (ha == null || !Number.isFinite(ha) || ha <= 0) return 0;
  return ha * 10_000;
}

export function plotDemandM3(
  useType: string | null | undefined,
  hectares: number | null | undefined
): { irrigation_m3: number; frost_m3: number; total_m3: number; mm: number } {
  const ha = hectares != null && hectares > 0 ? hectares : 0;
  const use = useType || "other";
  const mm = IRRIGATION_MM[use] ?? IRRIGATION_MM.other ?? 20;
  const frostMm = FROST_MM[use] ?? 0;
  const irrigation_m3 = round1(ha * mm * 10);
  const frost_m3 = round1(ha * frostMm * 10);
  return { irrigation_m3, frost_m3, total_m3: round1(irrigation_m3 + frost_m3), mm };
}

/**
 * Truncated-pyramid pond. Equivalent square top; banks inset by depth×slope
 * on each side (H:V, so slope=2.5 → 2.5 m horizontal per 1 m depth).
 */
export function pondGeom(
  areaM2: number,
  depthM: number,
  bankSlope: number
): PondGeom {
  const area_m2 = Math.max(0, areaM2);
  const depth_m = clamp(depthM, 0.4, 8);
  const bank_slope = clamp(bankSlope, 1, 6);
  if (area_m2 < 4) {
    return {
      area_m2,
      depth_m,
      bank_slope,
      bottom_m2: 0,
      volume_m3: 0,
      usable_m3: 0,
      too_steep: area_m2 > 0,
    };
  }
  const sideTop = Math.sqrt(area_m2);
  const inset = depth_m * bank_slope;
  let sideBot = sideTop - 2 * inset;
  let too_steep = false;
  if (sideBot < 0.8) {
    too_steep = true;
    sideBot = 0.8;
  }
  const bottom_m2 = sideBot * sideBot;
  const volume_m3 =
    (depth_m / 3) * (area_m2 + bottom_m2 + Math.sqrt(area_m2 * bottom_m2));
  const liveFrac = Math.max(0.35, (depth_m - FREEBOARD_M) / depth_m);
  const usable_m3 = volume_m3 * liveFrac * 0.92;
  return {
    area_m2: round1(area_m2),
    depth_m: round2(depth_m),
    bank_slope: round2(bank_slope),
    bottom_m2: round1(bottom_m2),
    volume_m3: round1(volume_m3),
    usable_m3: round1(usable_m3),
    too_steep,
  };
}

export function pondRainYieldM3(
  areaM2: number,
  catchmentFactor: number,
  rainMm = ANALOG_RAIN_MM,
  evapMm = OPEN_WATER_EVAP_MM
): { rain_on_pond_m3: number; evap_m3: number; catchment_m3: number; net_m3: number } {
  const a = Math.max(0, areaM2);
  const factor = clamp(catchmentFactor, 1, 40);
  const rain_on_pond_m3 = (a * rainMm) / 1000;
  const evap_m3 = (a * evapMm) / 1000;
  const extra = a * Math.max(0, factor - 1);
  const catchment_m3 = (extra * rainMm * FIELD_RUNOFF) / 1000;
  const net_m3 = rain_on_pond_m3 - evap_m3 + catchment_m3;
  return {
    rain_on_pond_m3: round1(rain_on_pond_m3),
    evap_m3: round1(evap_m3),
    catchment_m3: round1(catchment_m3),
    net_m3: round1(net_m3),
  };
}

export type BudgetPlot = {
  id: string;
  name: string;
  use_type: string | null;
  hectares: number | null;
  irrigation_m3: number;
  frost_m3: number;
  total_m3: number;
};

export type BudgetPond = {
  plot_id: string;
  name: string;
  hectares: number | null;
  depth_m: number;
  bank_slope: number;
  catchment_factor: number;
  fill_pct: number | null;
  geom: PondGeom;
  yield: ReturnType<typeof pondRainYieldM3>;
};

export function farmWaterBudget(input: {
  plots: BudgetPlot[];
  ponds: BudgetPond[];
}) {
  const demand_irrigation_m3 = round1(
    input.plots.reduce((s, p) => s + p.irrigation_m3, 0)
  );
  const demand_frost_m3 = round1(
    input.plots.reduce((s, p) => s + p.frost_m3, 0)
  );
  const demand_year_m3 = round1(demand_irrigation_m3 + demand_frost_m3);
  const storage_need_m3 = round1(
    demand_irrigation_m3 * DRY_SEASON_FRACTION + demand_frost_m3
  );
  const storage_usable_m3 = round1(
    input.ponds.reduce((s, p) => s + p.geom.usable_m3, 0)
  );
  const rain_net_m3 = round1(input.ponds.reduce((s, p) => s + p.yield.net_m3, 0));
  const gap_m3 = round1(storage_need_m3 - storage_usable_m3);
  return {
    climate: {
      place: "Čigoč, Lonjsko polje",
      rain_mm: ANALOG_RAIN_MM,
      evap_mm: OPEN_WATER_EVAP_MM,
      note: "Climate analog until on-farm gauges. Not private GPS.",
    },
    demand_irrigation_m3,
    demand_frost_m3,
    demand_year_m3,
    storage_need_m3,
    storage_usable_m3,
    rain_net_m3,
    gap_m3,
    ok: gap_m3 <= 0,
    plots: input.plots,
    ponds: input.ponds,
  };
}

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
