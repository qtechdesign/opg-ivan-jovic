import { Hono } from "hono";
import {
  CreatePlantingSchema,
  CreatePlotSchema,
  PatchPlantingSchema,
  type Planting,
  type Plot,
} from "@polje/schema";
import { requireOperator } from "../lib/auth";
import { writeAudit } from "../lib/audit";
import { DEFAULT_FARM_SLUG, getFarmBySlug } from "../lib/farm";

type AppEnv = { Bindings: Cloudflare.Env };

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export const api = new Hono<AppEnv>();

api.get("/v1/health", (c) => {
  return c.json({
    ok: true as const,
    service: c.env.SERVICE_NAME || "polje",
    time: new Date().toISOString(),
  });
});

api.get("/v1/farms/:slug", async (c) => {
  const slug = c.req.param("slug");
  const farm = await getFarmBySlug(c.env.DB, slug);
  if (!farm) {
    return c.json({ error: "farm_not_found", slug }, 404);
  }

  const { results: plots } = await c.env.DB.prepare(
    `SELECT id, farm_id, name, hectares, use_type, notes
     FROM plots WHERE farm_id = ? ORDER BY name`
  )
    .bind(farm.id)
    .all<Plot>();

  return c.json({ ...farm, plots: plots ?? [] });
});

api.get("/v1/plots", async (c) => {
  const slug = c.req.query("farm") || DEFAULT_FARM_SLUG;
  const farm = await getFarmBySlug(c.env.DB, slug);
  if (!farm) {
    return c.json({ error: "farm_not_found", slug }, 404);
  }

  const { results } = await c.env.DB.prepare(
    `SELECT id, farm_id, name, hectares, use_type, notes
     FROM plots WHERE farm_id = ? ORDER BY name`
  )
    .bind(farm.id)
    .all<Plot>();

  return c.json({ farm_id: farm.id, slug: farm.slug, plots: results ?? [] });
});

api.post("/v1/plots", async (c) => {
  const denied = await requireOperator(c);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }

  const parsed = CreatePlotSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "validation", details: parsed.error.flatten() }, 400);
  }

  const farm = await getFarmBySlug(c.env.DB, parsed.data.farm_slug);
  if (!farm) {
    return c.json({ error: "farm_not_found", slug: parsed.data.farm_slug }, 404);
  }

  const id = crypto.randomUUID();
  const plot: Plot = {
    id,
    farm_id: farm.id,
    name: parsed.data.name,
    hectares: parsed.data.hectares ?? null,
    use_type: parsed.data.use_type ?? null,
    notes: parsed.data.notes ?? null,
  };

  await c.env.DB.prepare(
    `INSERT INTO plots (id, farm_id, name, hectares, use_type, notes)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(
      plot.id,
      plot.farm_id,
      plot.name,
      plot.hectares,
      plot.use_type,
      plot.notes
    )
    .run();

  await writeAudit(c.env.DB, {
    farm_id: farm.id,
    actor: "user:operator",
    action: "plot.create",
    entity: `plot:${id}`,
    after: plot,
  });

  return c.json(plot, 201);
});

api.get("/v1/plantings", async (c) => {
  const slug = c.req.query("farm") || DEFAULT_FARM_SLUG;
  const farm = await getFarmBySlug(c.env.DB, slug);
  if (!farm) {
    return c.json({ error: "farm_not_found", slug }, 404);
  }

  const { results } = await c.env.DB.prepare(
    `SELECT p.id, p.plot_id, p.crop, p.variety, p.planted_on, p.stage,
            p.expected_harvest, p.yield_kg, pl.name AS plot_name
     FROM plantings p
     JOIN plots pl ON pl.id = p.plot_id
     WHERE pl.farm_id = ?
     ORDER BY p.crop`
  )
    .bind(farm.id)
    .all<Planting & { plot_name: string }>();

  return c.json({
    farm_id: farm.id,
    slug: farm.slug,
    plantings: results ?? [],
  });
});

api.post("/v1/plantings", async (c) => {
  const denied = await requireOperator(c);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }

  const parsed = CreatePlantingSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "validation", details: parsed.error.flatten() }, 400);
  }

  const plot = await c.env.DB.prepare(
    `SELECT id, farm_id, name, hectares, use_type, notes FROM plots WHERE id = ?`
  )
    .bind(parsed.data.plot_id)
    .first<Plot>();

  if (!plot) {
    return c.json({ error: "plot_not_found" }, 404);
  }

  const id = crypto.randomUUID();
  const planting: Planting = {
    id,
    plot_id: plot.id,
    crop: parsed.data.crop,
    variety: parsed.data.variety ?? null,
    planted_on: parsed.data.planted_on ?? null,
    stage: parsed.data.stage,
    expected_harvest: parsed.data.expected_harvest ?? null,
    yield_kg: parsed.data.yield_kg ?? null,
  };

  await c.env.DB.prepare(
    `INSERT INTO plantings (id, plot_id, crop, variety, planted_on, stage, expected_harvest, yield_kg)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      planting.id,
      planting.plot_id,
      planting.crop,
      planting.variety,
      planting.planted_on,
      planting.stage,
      planting.expected_harvest,
      planting.yield_kg
    )
    .run();

  await writeAudit(c.env.DB, {
    farm_id: plot.farm_id,
    actor: "user:operator",
    action: "planting.create",
    entity: `planting:${id}`,
    after: planting,
  });

  return c.json(planting, 201);
});

api.patch("/v1/plantings/:id", async (c) => {
  const denied = await requireOperator(c);
  if (denied) return denied;

  const id = c.req.param("id");
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }

  const parsed = PatchPlantingSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "validation", details: parsed.error.flatten() }, 400);
  }

  const before = await c.env.DB.prepare(
    `SELECT p.id, p.plot_id, p.crop, p.variety, p.planted_on, p.stage,
            p.expected_harvest, p.yield_kg, pl.farm_id
     FROM plantings p
     JOIN plots pl ON pl.id = p.plot_id
     WHERE p.id = ?`
  )
    .bind(id)
    .first<Planting & { farm_id: string }>();

  if (!before) {
    return c.json({ error: "planting_not_found" }, 404);
  }

  const next: Planting = {
    id: before.id,
    plot_id: before.plot_id,
    crop: parsed.data.crop ?? before.crop,
    variety:
      parsed.data.variety !== undefined ? parsed.data.variety : before.variety,
    planted_on:
      parsed.data.planted_on !== undefined
        ? parsed.data.planted_on
        : before.planted_on,
    stage: parsed.data.stage ?? before.stage,
    expected_harvest:
      parsed.data.expected_harvest !== undefined
        ? parsed.data.expected_harvest
        : before.expected_harvest,
    yield_kg:
      parsed.data.yield_kg !== undefined
        ? parsed.data.yield_kg
        : before.yield_kg,
  };

  await c.env.DB.prepare(
    `UPDATE plantings
     SET crop = ?, variety = ?, planted_on = ?, stage = ?, expected_harvest = ?, yield_kg = ?
     WHERE id = ?`
  )
    .bind(
      next.crop,
      next.variety,
      next.planted_on,
      next.stage,
      next.expected_harvest,
      next.yield_kg,
      id
    )
    .run();

  const { farm_id: _f, ...beforePlanting } = before;
  await writeAudit(c.env.DB, {
    farm_id: before.farm_id,
    actor: "user:operator",
    action: "planting.patch",
    entity: `planting:${id}`,
    before: beforePlanting,
    after: next,
  });

  return c.json(next);
});

api.post("/v1/media", async (c) => {
  const denied = await requireOperator(c);
  if (denied) return denied;

  let form: FormData;
  try {
    form = await c.req.formData();
  } catch {
    return c.json({ error: "invalid_multipart" }, 400);
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return c.json({ error: "file_required" }, 400);
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return c.json(
      { error: "unsupported_type", allowed: [...ALLOWED_TYPES] },
      400
    );
  }

  if (file.size > MAX_BYTES) {
    return c.json({ error: "file_too_large", max_bytes: MAX_BYTES }, 400);
  }

  const slug = String(form.get("farm_slug") || DEFAULT_FARM_SLUG);
  const farm = await getFarmBySlug(c.env.DB, slug);
  if (!farm) {
    return c.json({ error: "farm_not_found", slug }, 404);
  }

  const plotIdRaw = form.get("plot_id");
  const plantingIdRaw = form.get("planting_id");
  const plot_id =
    typeof plotIdRaw === "string" && plotIdRaw.length > 0 ? plotIdRaw : null;
  const planting_id =
    typeof plantingIdRaw === "string" && plantingIdRaw.length > 0
      ? plantingIdRaw
      : null;
  const captionRaw = form.get("caption");
  const caption =
    typeof captionRaw === "string" && captionRaw.trim()
      ? captionRaw.trim().slice(0, 500)
      : null;

  if (plot_id) {
    const plot = await c.env.DB.prepare(
      `SELECT id FROM plots WHERE id = ? AND farm_id = ?`
    )
      .bind(plot_id, farm.id)
      .first();
    if (!plot) {
      return c.json({ error: "plot_not_found" }, 404);
    }
  }

  if (planting_id) {
    const planting = await c.env.DB.prepare(
      `SELECT p.id FROM plantings p
       JOIN plots pl ON pl.id = p.plot_id
       WHERE p.id = ? AND pl.farm_id = ?`
    )
      .bind(planting_id, farm.id)
      .first();
    if (!planting) {
      return c.json({ error: "planting_not_found" }, 404);
    }
  }

  const ext =
    file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const id = crypto.randomUUID();
  const r2_key = `${farm.slug}/growth/${id}.${ext}`;
  const created_at = new Date().toISOString();
  const bytes = await file.arrayBuffer();

  await c.env.MEDIA.put(r2_key, bytes, {
    httpMetadata: { contentType: file.type },
    customMetadata: {
      farm_id: farm.id,
      media_id: id,
    },
  });

  await c.env.DB.prepare(
    `INSERT INTO growth_media (id, farm_id, plot_id, planting_id, r2_key, caption, content_type, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      farm.id,
      plot_id,
      planting_id,
      r2_key,
      caption,
      file.type,
      created_at
    )
    .run();

  const media = {
    id,
    farm_id: farm.id,
    plot_id,
    planting_id,
    r2_key,
    caption,
    content_type: file.type,
    created_at,
    url: `/v1/media/${id}`,
  };

  await writeAudit(c.env.DB, {
    farm_id: farm.id,
    actor: "user:operator",
    action: "media.upload",
    entity: `media:${id}`,
    after: { id, r2_key, plot_id, planting_id, caption },
  });

  return c.json(media, 201);
});

api.get("/v1/media", async (c) => {
  const slug = c.req.query("farm") || DEFAULT_FARM_SLUG;
  const farm = await getFarmBySlug(c.env.DB, slug);
  if (!farm) {
    return c.json({ error: "farm_not_found", slug }, 404);
  }

  const limit = Math.min(
    50,
    Math.max(1, Number(c.req.query("limit") || "24") || 24)
  );

  const { results } = await c.env.DB.prepare(
    `SELECT id, farm_id, plot_id, planting_id, r2_key, caption, content_type, created_at
     FROM growth_media WHERE farm_id = ?
     ORDER BY created_at DESC LIMIT ?`
  )
    .bind(farm.id, limit)
    .all();

  return c.json({
    farm_id: farm.id,
    media: (results ?? []).map((m) => ({
      ...m,
      url: `/v1/media/${(m as { id: string }).id}`,
    })),
  });
});

api.get("/v1/media/:id", async (c) => {
  const id = c.req.param("id");
  const row = await c.env.DB.prepare(
    `SELECT id, r2_key, content_type FROM growth_media WHERE id = ?`
  )
    .bind(id)
    .first<{ id: string; r2_key: string; content_type: string | null }>();

  if (!row) {
    return c.json({ error: "media_not_found" }, 404);
  }

  const obj = await c.env.MEDIA.get(row.r2_key);
  if (!obj) {
    return c.json({ error: "object_missing" }, 404);
  }

  const headers = new Headers();
  headers.set(
    "Content-Type",
    row.content_type || obj.httpMetadata?.contentType || "application/octet-stream"
  );
  headers.set("Cache-Control", "public, max-age=3600");
  return new Response(obj.body, { headers });
});

api.get("/v1/audit", async (c) => {
  const denied = await requireOperator(c);
  if (denied) return denied;

  const slug = c.req.query("farm") || DEFAULT_FARM_SLUG;
  const farm = await getFarmBySlug(c.env.DB, slug);
  if (!farm) {
    return c.json({ error: "farm_not_found", slug }, 404);
  }

  const limit = Math.min(
    100,
    Math.max(1, Number(c.req.query("limit") || "50") || 50)
  );

  const { results } = await c.env.DB.prepare(
    `SELECT id, farm_id, actor, action, entity, before_json, after_json, ts
     FROM audit WHERE farm_id = ?
     ORDER BY id DESC LIMIT ?`
  )
    .bind(farm.id, limit)
    .all();

  return c.json({ farm_id: farm.id, audit: results ?? [] });
});
