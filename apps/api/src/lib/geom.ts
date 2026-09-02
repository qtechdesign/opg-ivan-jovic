/** GeoJSON Polygon (lng, lat) for plot boundaries. */

const MAX_VERTICES = 200;
const EARTH_M = 6371000;

export type LngLat = [number, number];

export type PlotPolygon = {
  type: "Polygon";
  coordinates: LngLat[][];
};

function isLngLat(p: unknown): p is LngLat {
  return (
    Array.isArray(p) &&
    p.length === 2 &&
    typeof p[0] === "number" &&
    typeof p[1] === "number" &&
    Number.isFinite(p[0]) &&
    Number.isFinite(p[1]) &&
    p[0] >= -180 &&
    p[0] <= 180 &&
    p[1] >= -90 &&
    p[1] <= 90
  );
}

function closeRing(ring: LngLat[]): LngLat[] {
  if (ring.length === 0) return ring;
  const a = ring[0];
  const b = ring[ring.length - 1];
  if (!a || !b) return ring;
  if (a[0] === b[0] && a[1] === b[1]) return ring;
  return [...ring, [a[0], a[1]]];
}

/** Shoelace on sphere (authalic approximation). */
export function ringHectares(ring: LngLat[]): number {
  const closed = closeRing(ring);
  if (closed.length < 4) return 0;
  let area = 0;
  for (let i = 0; i < closed.length - 1; i++) {
    const a = closed[i];
    const b = closed[i + 1];
    if (!a || !b) continue;
    const lng1 = (a[0] * Math.PI) / 180;
    const lat1 = (a[1] * Math.PI) / 180;
    const lng2 = (b[0] * Math.PI) / 180;
    const lat2 = (b[1] * Math.PI) / 180;
    area += (lng2 - lng1) * (2 + Math.sin(lat1) + Math.sin(lat2));
  }
  const m2 = Math.abs((area * EARTH_M * EARTH_M) / 2);
  return Math.round((m2 / 10000) * 10000) / 10000;
}

function openRing(ring: LngLat[]): LngLat[] {
  const closed = closeRing(ring);
  if (closed.length < 2) return closed;
  return closed.slice(0, -1);
}

/** Ray-cast. Boundary counts as inside. */
export function pointInRing(ring: LngLat[], lng: number, lat: number): boolean {
  const pts = openRing(ring);
  if (pts.length < 3) return false;
  if (pointOnRing(ring, lng, lat)) return true;
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i];
    const b = pts[j];
    if (!a || !b) continue;
    const yi = a[1];
    const yj = b[1];
    const xi = a[0];
    const xj = b[0];
    const hit =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi || Number.EPSILON) + xi;
    if (hit) inside = !inside;
  }
  return inside;
}

export function pointOnRing(ring: LngLat[], lng: number, lat: number, eps = 1.5e-6): boolean {
  const pts = closeRing(ring);
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (!a || !b) continue;
    if (pointOnSegment(a, b, lng, lat, eps)) return true;
  }
  return false;
}

function pointOnSegment(
  a: LngLat,
  b: LngLat,
  lng: number,
  lat: number,
  eps: number
): boolean {
  const minX = Math.min(a[0], b[0]) - eps;
  const maxX = Math.max(a[0], b[0]) + eps;
  const minY = Math.min(a[1], b[1]) - eps;
  const maxY = Math.max(a[1], b[1]) + eps;
  if (lng < minX || lng > maxX || lat < minY || lat > maxY) return false;
  const cross = (lng - a[0]) * (b[1] - a[1]) - (lat - a[1]) * (b[0] - a[0]);
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return Math.abs(cross) / len <= eps;
}

/** Closest point on the ring (lng/lat). */
export function nearestOnRing(
  ring: LngLat[],
  lng: number,
  lat: number
): LngLat {
  const pts = closeRing(ring);
  let best: LngLat = pts[0] ?? [lng, lat];
  let bestD = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (!a || !b) continue;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy || 1;
    let t = ((lng - a[0]) * dx + (lat - a[1]) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const p: LngLat = [a[0] + t * dx, a[1] + t * dy];
    const d = (p[0] - lng) * (p[0] - lng) + (p[1] - lat) * (p[1] - lat);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

export function ringCentroid(ring: LngLat[]): LngLat | null {
  const pts = openRing(ring);
  if (!pts.length) return null;
  let lng = 0;
  let lat = 0;
  for (const p of pts) {
    lng += p[0];
    lat += p[1];
  }
  return [lng / pts.length, lat / pts.length];
}

export function ringContainsRing(outer: LngLat[], inner: LngLat[]): boolean {
  const pts = openRing(inner);
  if (pts.length < 3) return false;
  for (const p of pts) {
    if (!p || !pointInRing(outer, p[0], p[1])) return false;
  }
  return true;
}

export function plotFitsHolding(
  holdingJson: string | null | undefined,
  plotGeojson: string
): { ok: true } | { error: "outside_holding" | "bad_holding" } {
  if (!holdingJson) return { ok: true };
  const hold = parsePlotPolygon(holdingJson);
  if ("error" in hold) return { error: "bad_holding" };
  const plot = parsePlotPolygon(plotGeojson);
  if ("error" in plot) return { error: "outside_holding" };
  const outer = hold.polygon.coordinates[0];
  const inner = plot.polygon.coordinates[0];
  if (!outer || !inner) return { error: "outside_holding" };
  if (!ringContainsRing(outer, inner)) return { error: "outside_holding" };
  return { ok: true };
}

export function parsePlotPolygon(
  raw: unknown
): { polygon: PlotPolygon; geojson: string; hectares: number } | { error: string } {
  let obj: unknown = raw;
  if (typeof raw === "string") {
    const s = raw.trim();
    if (s === "" || s === "null") return { error: "empty" };
    try {
      obj = JSON.parse(s);
    } catch {
      return { error: "invalid_json" };
    }
  }
  if (!obj || typeof obj !== "object") return { error: "not_object" };
  const g = obj as { type?: string; coordinates?: unknown };
  if (g.type !== "Polygon" || !Array.isArray(g.coordinates) || !g.coordinates[0]) {
    return { error: "need_polygon" };
  }
  const outer = g.coordinates[0];
  if (!Array.isArray(outer) || outer.length < 3) return { error: "too_few_points" };
  if (outer.length > MAX_VERTICES) return { error: "too_many_points" };
  const pts: LngLat[] = [];
  for (const p of outer) {
    if (!isLngLat(p)) return { error: "bad_coordinate" };
    pts.push([p[0], p[1]]);
  }
  const ring = closeRing(pts);
  if (ring.length < 4) return { error: "too_few_points" };
  const polygon: PlotPolygon = { type: "Polygon", coordinates: [ring] };
  const hectares = ringHectares(ring);
  return { polygon, geojson: JSON.stringify(polygon), hectares };
}
