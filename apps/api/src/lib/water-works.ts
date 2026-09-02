import {
  DEFAULT_BANK_SLOPE,
  DEFAULT_CATCHMENT_FACTOR,
  DEFAULT_POND_DEPTH_M,
} from "./water-budget";

export type WaterWorkRow = {
  id: string;
  farm_id: string;
  plot_id: string;
  kind: string;
  depth_m: number;
  bank_slope: number;
  catchment_factor: number;
  fill_pct: number | null;
};

export async function ensurePondWork(
  db: D1Database,
  farmId: string,
  plotId: string
): Promise<WaterWorkRow> {
  const existing = await db
    .prepare(
      `SELECT id, farm_id, plot_id, kind, depth_m, bank_slope, catchment_factor, fill_pct
       FROM water_works WHERE plot_id = ?`
    )
    .bind(plotId)
    .first<WaterWorkRow>();
  if (existing) return existing;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO water_works
        (id, farm_id, plot_id, kind, depth_m, bank_slope, catchment_factor, fill_pct, created_at, updated_at)
       VALUES (?, ?, ?, 'pond', ?, ?, ?, NULL, ?, ?)`
    )
    .bind(
      id,
      farmId,
      plotId,
      DEFAULT_POND_DEPTH_M,
      DEFAULT_BANK_SLOPE,
      DEFAULT_CATCHMENT_FACTOR,
      now,
      now
    )
    .run();
  return {
    id,
    farm_id: farmId,
    plot_id: plotId,
    kind: "pond",
    depth_m: DEFAULT_POND_DEPTH_M,
    bank_slope: DEFAULT_BANK_SLOPE,
    catchment_factor: DEFAULT_CATCHMENT_FACTOR,
    fill_pct: null,
  };
}

export async function listPondWorks(
  db: D1Database,
  farmId: string
): Promise<WaterWorkRow[]> {
  const { results } = await db
    .prepare(
      `SELECT id, farm_id, plot_id, kind, depth_m, bank_slope, catchment_factor, fill_pct
       FROM water_works WHERE farm_id = ? AND kind = 'pond'`
    )
    .bind(farmId)
    .all<WaterWorkRow>();
  return results ?? [];
}
