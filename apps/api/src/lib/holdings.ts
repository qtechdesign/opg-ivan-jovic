/** OPG locations (holdings). Fields / ponds / equipment sit inside one of them. */
import type { Farm } from "@polje/schema";
import { parsePlotPolygon, plotFitsHolding, pointInRing, ringCentroid } from "./geom";

export type HoldingRow = {
  id: string;
  farm_id: string;
  name: string;
  notes: string | null;
  geom_json: string | null;
  hectares: number | null;
  created_at: string;
};

export function publicHolding(h: HoldingRow) {
  let hectares = h.hectares ?? null;
  if (h.geom_json) {
    const g = parsePlotPolygon(h.geom_json);
    if (!("error" in g)) hectares = g.hectares;
  }
  return {
    id: h.id,
    name: h.name,
    notes: h.notes,
    geom_json: h.geom_json,
    hectares,
  };
}

export async function listHoldings(
  db: D1Database,
  farmId: string
): Promise<HoldingRow[]> {
  const { results } = await db
    .prepare(
      `SELECT id, farm_id, name, notes, geom_json, hectares, created_at
       FROM holdings WHERE farm_id = ? ORDER BY name`
    )
    .bind(farmId)
    .all<HoldingRow>();
  return results ?? [];
}

/** One-shot: farms.extent_* from 0015 becomes the first location row. */
export async function ensureLegacyHolding(
  db: D1Database,
  farm: Farm
): Promise<void> {
  const n = await db
    .prepare(`SELECT COUNT(*) AS n FROM holdings WHERE farm_id = ?`)
    .bind(farm.id)
    .first<{ n: number }>();
  if ((n?.n ?? 0) > 0) return;
  if (!farm.extent_json) return;
  const g = parsePlotPolygon(farm.extent_json);
  const hectares = "error" in g ? farm.extent_ha ?? null : g.hectares;
  const geom = "error" in g ? farm.extent_json : g.geojson;
  await db
    .prepare(
      `INSERT INTO holdings (id, farm_id, name, notes, geom_json, hectares, created_at)
       VALUES (?, ?, ?, NULL, ?, ?, ?)`
    )
    .bind(
      crypto.randomUUID(),
      farm.id,
      farm.extent_name || farm.name,
      geom,
      hectares,
      new Date().toISOString()
    )
    .run();
}

export function holdingContainingPlot(
  holdings: HoldingRow[],
  plotGeojson: string,
  preferredId?: string | null
): HoldingRow | null {
  if (preferredId) {
    const hit = holdings.find((h) => h.id === preferredId);
    if (hit?.geom_json) {
      const fit = plotFitsHolding(hit.geom_json, plotGeojson);
      if (!("error" in fit)) return hit;
    }
  }
  for (const h of holdings) {
    if (!h.geom_json) continue;
    const fit = plotFitsHolding(h.geom_json, plotGeojson);
    if (!("error" in fit)) return h;
  }
  return null;
}

/** Centroid inside a location — used when nudging a field that already exists. */
export function holdingContainingCentroid(
  holdings: HoldingRow[],
  plotGeojson: string,
  preferredId?: string | null
): HoldingRow | null {
  const plot = parsePlotPolygon(plotGeojson);
  if ("error" in plot) return null;
  const ring = plot.polygon.coordinates[0];
  if (!ring) return null;
  const c = ringCentroid(ring);
  if (!c) return null;
  const order = preferredId
    ? [
        ...holdings.filter((h) => h.id === preferredId),
        ...holdings.filter((h) => h.id !== preferredId),
      ]
    : holdings;
  for (const h of order) {
    if (!h.geom_json) continue;
    const hold = parsePlotPolygon(h.geom_json);
    if ("error" in hold) continue;
    const outer = hold.polygon.coordinates[0];
    if (outer && pointInRing(outer, c[0], c[1])) return h;
  }
  return null;
}

/** New draws: every vertex inside. Edits: centroid inside (corners may poke the line). */
export function assignPlotHolding(
  holdings: HoldingRow[],
  plotGeojson: string,
  preferredId?: string | null,
  opts?: { existing?: boolean }
):
  | { ok: true; holding_id: string | null }
  | { error: "outside_holding" | "bad_holding" } {
  const drawn = holdings.filter((h) => h.geom_json);
  if (drawn.length === 0) return { ok: true, holding_id: null };
  const strict = holdingContainingPlot(holdings, plotGeojson, preferredId);
  if (strict) return { ok: true, holding_id: strict.id };
  if (!opts?.existing) return { error: "outside_holding" };
  const cent = holdingContainingCentroid(holdings, plotGeojson, preferredId);
  if (cent) return { ok: true, holding_id: cent.id };
  return { error: "outside_holding" };
}

export function plotFitsHoldings(
  holdings: HoldingRow[],
  plotGeojson: string,
  preferredId?: string | null
):
  | { ok: true; holding_id: string | null }
  | { error: "outside_holding" | "bad_holding" } {
  const drawn = holdings.filter((h) => h.geom_json);
  if (drawn.length === 0) return { ok: true, holding_id: null };
  const hit = holdingContainingPlot(holdings, plotGeojson, preferredId);
  if (!hit) return { error: "outside_holding" };
  return { ok: true, holding_id: hit.id };
}

export async function syncFarmExtent(
  db: D1Database,
  farmId: string
): Promise<void> {
  const first = await db
    .prepare(
      `SELECT name, geom_json, hectares FROM holdings
       WHERE farm_id = ? AND geom_json IS NOT NULL
       ORDER BY created_at LIMIT 1`
    )
    .bind(farmId)
    .first<{ name: string; geom_json: string; hectares: number | null }>();
  await db
    .prepare(
      `UPDATE farms SET extent_json = ?, extent_name = ?, extent_ha = ? WHERE id = ?`
    )
    .bind(
      first?.geom_json ?? null,
      first?.name ?? null,
      first?.hectares ?? null,
      farmId
    )
    .run();
}
