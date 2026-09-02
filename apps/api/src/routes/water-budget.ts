import { Hono } from "hono";
import { PatchWaterPondSchema, PatchWaterPumpSchema } from "@polje/schema";
import { requireOperator } from "../lib/auth";
import { writeAudit } from "../lib/audit";
import { farmSlugFromQuery, getFarmBySlug } from "../lib/farm";
import { packFarm, loadPumpSettings } from "../lib/dewline-map";
import {
  DEFAULT_BANK_SLOPE,
  DEFAULT_CATCHMENT_FACTOR,
  DEFAULT_POND_DEPTH_M,
  farmWaterBudget,
  haToM2,
  pondGeom,
  pondRainYieldM3,
  plotDemandM3,
  type BudgetPlot,
  type BudgetPond,
} from "../lib/water-budget";
import { ensurePondWork, listPondWorks } from "../lib/water-works";

type AppEnv = { Bindings: Cloudflare.Env };

export const waterBudgetApi = new Hono<AppEnv>();

waterBudgetApi.get("/v1/water/budget", async (c) => {
  const slug = farmSlugFromQuery(c);
  const farm = await getFarmBySlug(c.env.DB, slug);
  if (!farm) return c.json({ error: "farm_not_found" }, 404);

  const { results: plots } = await c.env.DB.prepare(
    `SELECT id, name, use_type, hectares FROM plots WHERE farm_id = ? ORDER BY name`
  )
    .bind(farm.id)
    .all<{
      id: string;
      name: string;
      use_type: string | null;
      hectares: number | null;
    }>();

  const works = await listPondWorks(c.env.DB, farm.id).catch(() => []);
  const byPlot = new Map(works.map((w) => [w.plot_id, w]));

  const budgetPlots: BudgetPlot[] = (plots ?? []).map((p) => {
    const d = plotDemandM3(p.use_type, p.hectares);
    return {
      id: p.id,
      name: p.name,
      use_type: p.use_type,
      hectares: p.hectares,
      irrigation_m3: d.irrigation_m3,
      frost_m3: d.frost_m3,
      total_m3: d.total_m3,
    };
  });

  const budgetPonds: BudgetPond[] = (plots ?? [])
    .filter((p) => p.use_type === "pond")
    .map((p) => {
      const w = byPlot.get(p.id);
      const depth = w?.depth_m ?? DEFAULT_POND_DEPTH_M;
      const slope = w?.bank_slope ?? DEFAULT_BANK_SLOPE;
      const catchF = w?.catchment_factor ?? DEFAULT_CATCHMENT_FACTOR;
      const area = haToM2(p.hectares);
      const geom = pondGeom(area, depth, slope);
      return {
        plot_id: p.id,
        name: p.name,
        hectares: p.hectares,
        depth_m: depth,
        bank_slope: slope,
        catchment_factor: catchF,
        fill_pct: w?.fill_pct ?? null,
        geom,
        yield: pondRainYieldM3(area, catchF),
      };
    });

  return c.json(farmWaterBudget({ plots: budgetPlots, ponds: budgetPonds }));
});

waterBudgetApi.get("/v1/water/pack", async (c) => {
  const slug = farmSlugFromQuery(c);
  const farm = await getFarmBySlug(c.env.DB, slug);
  if (!farm) return c.json({ error: "farm_not_found" }, 404);

  const precipRaw = c.req.query("precip_mm");
  const precipMm =
    precipRaw != null && precipRaw !== "" ? Number(precipRaw) : null;
  if (precipMm != null && !Number.isFinite(precipMm)) {
    return c.json({ error: "invalid_precip_mm" }, 400);
  }

  const packed = await packFarm({
    env: c.env,
    farmId: farm.id,
    precipMm,
  });
  return c.json({ farm_id: farm.id, slug: farm.slug, ...packed });
});

waterBudgetApi.patch("/v1/water/pump", async (c) => {
  const denied = await requireOperator(c);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }
  const parsed = PatchWaterPumpSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "validation", details: parsed.error.flatten() }, 400);
  }

  const slug = farmSlugFromQuery(c);
  const farm = await getFarmBySlug(c.env.DB, slug);
  if (!farm) return c.json({ error: "farm_not_found" }, 404);

  const before = await loadPumpSettings(c.env.DB, farm.id);
  const after = {
    main_flow_m3h: parsed.data.main_flow_m3h ?? before.main_flow_m3h,
    cycles_per_day: parsed.data.cycles_per_day ?? before.cycles_per_day,
    well_rate_m3h: parsed.data.well_rate_m3h ?? before.well_rate_m3h,
    water_price_cents: parsed.data.water_price_cents ?? before.water_price_cents,
  };
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `INSERT INTO farm_settings (
       farm_id, rain_lockout, main_flow_m3h, cycles_per_day, well_rate_m3h, water_price_cents, updated_at
     ) VALUES (?, 0, ?, ?, ?, ?, ?)
     ON CONFLICT(farm_id) DO UPDATE SET
       main_flow_m3h = excluded.main_flow_m3h,
       cycles_per_day = excluded.cycles_per_day,
       well_rate_m3h = excluded.well_rate_m3h,
       water_price_cents = excluded.water_price_cents,
       updated_at = excluded.updated_at`
  )
    .bind(
      farm.id,
      after.main_flow_m3h,
      after.cycles_per_day,
      after.well_rate_m3h,
      after.water_price_cents,
      now
    )
    .run();

  await writeAudit(c.env.DB, {
    farm_id: farm.id,
    actor: "user:operator",
    action: "water.pump.patch",
    entity: `farm:${farm.slug}`,
    before,
    after,
  });

  return c.json({ ok: true, ...after });
});

waterBudgetApi.patch("/v1/water/ponds/:plotId", async (c) => {
  const denied = await requireOperator(c);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }
  const parsed = PatchWaterPondSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "validation", details: parsed.error.flatten() }, 400);
  }

  const plotId = c.req.param("plotId");
  const plot = await c.env.DB.prepare(
    `SELECT id, farm_id, name, use_type, hectares FROM plots WHERE id = ?`
  )
    .bind(plotId)
    .first<{
      id: string;
      farm_id: string;
      name: string;
      use_type: string | null;
      hectares: number | null;
    }>();
  if (!plot) return c.json({ error: "plot_not_found" }, 404);
  if (plot.use_type !== "pond") {
    return c.json({ error: "not_a_pond" }, 400);
  }

  const before = await ensurePondWork(c.env.DB, plot.farm_id, plot.id);
  const depth = parsed.data.depth_m ?? before.depth_m;
  const slope = parsed.data.bank_slope ?? before.bank_slope;
  const catchF = parsed.data.catchment_factor ?? before.catchment_factor;
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `UPDATE water_works SET depth_m = ?, bank_slope = ?, catchment_factor = ?, updated_at = ?
     WHERE plot_id = ?`
  )
    .bind(depth, slope, catchF, now, plot.id)
    .run();

  await writeAudit(c.env.DB, {
    farm_id: plot.farm_id,
    actor: "user:operator",
    action: "water.pond.patch",
    entity: `plot:${plot.id}`,
    before,
    after: { depth_m: depth, bank_slope: slope, catchment_factor: catchF },
  });

  const area = haToM2(plot.hectares);
  const geom = pondGeom(area, depth, slope);
  return c.json({
    plot_id: plot.id,
    name: plot.name,
    hectares: plot.hectares,
    depth_m: depth,
    bank_slope: slope,
    catchment_factor: catchF,
    geom,
    yield: pondRainYieldM3(area, catchF),
  });
});

export async function maybeEnsurePondPlot(
  db: D1Database,
  farmId: string,
  plotId: string,
  useType: string | null | undefined
): Promise<void> {
  if (useType !== "pond") return;
  try {
    await ensurePondWork(db, farmId, plotId);
  } catch {
    /* water_works missing until migration 0013 */
  }
}
