import { Hono } from "hono";
import {
  CreatePlantingSchema,
  CreatePlotSchema,
  IngestBatchSchema,
  PatchFarmFlagsSchema,
  PatchPlantingSchema,
  type Planting,
  type Plot,
} from "@polje/schema";
import { requireIngest, requireOperator, requireOperatorOrIngest, isOperator, mintOperatorCookieValue, setOperatorCookieHeader, clearOperatorCookieHeader, requestIsHttps, loginCredentialsOk } from "../lib/auth";
import { writeAudit } from "../lib/audit";
import { defaultFarmSlug, farmSlugFromQuery, getFarm, getFarmBySlug } from "../lib/farm";
import {
  RL_LOGIN,
  clientIp,
  consumeRateLimit,
  getFlags,
  rlLoginKey,
  setFlags,
  writeMetric,
} from "../lib/kv";
import { farmStub } from "../do/farm-runtime";
import { irrigationOverview } from "./irrigation";
import { climateOverview } from "../lib/climate";
import { energyOverview } from "../lib/energy";
import type { FarmLiveState } from "../do/farm-runtime";
import { weatherNow } from "../lib/weather";

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

api.get("/v1/session", async (c) => {
  const slug = defaultFarmSlug(c.env);
  const flags = await getFlags(c.env.KV, slug);
  return c.json({ operator: await isOperator(c), farm: slug, flags });
});

api.post("/v1/session", async (c) => {
  const signing = c.env.OPERATOR_TOKEN;
  if (!signing) {
    return c.json({ error: "operator_token_not_configured" }, 500);
  }
  const ip = clientIp(c);
  const rl = await consumeRateLimit(
    c.env.KV,
    rlLoginKey(ip),
    RL_LOGIN.limit,
    RL_LOGIN.windowSec
  );
  if (!rl.allowed) {
    c.header("Retry-After", "60");
    return c.json({ error: "rate_limited" }, 429);
  }

  let body: { email?: string; password?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }
  const email = String(body.email || "");
  const password = String(body.password || "");
  const slug = defaultFarmSlug(c.env);
  if (!(await loginCredentialsOk(c, email, password))) {
    writeMetric(c.env, "login_fail", slug, ip);
    return c.json({ error: "unauthorized" }, 401);
  }
  const value = await mintOperatorCookieValue(signing);
  c.header("Set-Cookie", setOperatorCookieHeader(value, requestIsHttps(c)));

  const farm = await getFarm(c.env, slug);
  if (farm) {
    await writeAudit(c.env.DB, {
      farm_id: farm.id,
      actor: "user:operator",
      action: "session.login",
      entity: "session",
      after: { via: "cookie", email: email.trim().toLowerCase() },
    });
  }
  writeMetric(c.env, "login", slug);
  return c.json({ ok: true, operator: true });
});

api.get("/v1/flags", async (c) => {
  const slug = farmSlugFromQuery(c);
  const farm = await getFarm(c.env, slug);
  if (!farm) {
    return c.json({ error: "farm_not_found", slug }, 404);
  }
  const flags = await getFlags(c.env.KV, farm.slug);
  return c.json({ farm_id: farm.id, slug: farm.slug, flags });
});

api.patch("/v1/flags", async (c) => {
  const denied = await requireOperator(c);
  if (denied) return denied;
  if (!c.env.KV) {
    return c.json({ error: "kv_not_configured" }, 503);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }
  const parsed = PatchFarmFlagsSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "validation", details: parsed.error.flatten() }, 400);
  }

  const farm = await getFarm(c.env, parsed.data.farm_slug);
  if (!farm) {
    return c.json({ error: "farm_not_found", slug: parsed.data.farm_slug }, 404);
  }

  const before = await getFlags(c.env.KV, farm.slug);
  const flags = await setFlags(c.env.KV, farm.slug, parsed.data.flags);
  await writeAudit(c.env.DB, {
    farm_id: farm.id,
    actor: "user:operator",
    action: "flags.patch",
    entity: `flags:${farm.slug}`,
    before,
    after: { flags, reason: parsed.data.reason },
  });
  writeMetric(c.env, "flag_patch", farm.slug);
  return c.json({ farm_id: farm.id, slug: farm.slug, flags });
});

api.delete("/v1/session", (c) => {
  c.header("Set-Cookie", clearOperatorCookieHeader(requestIsHttps(c)));
  return c.json({ ok: true, operator: false });
});

api.get("/v1/farms", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT slug, name, timezone FROM farms ORDER BY slug`
  ).all<{ slug: string; name: string; timezone: string }>();
  return c.json({ farms: results ?? [] });
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
  const slug = farmSlugFromQuery(c);
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
  const slug = farmSlugFromQuery(c);
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

api.get("/v1/devices", async (c) => {
  const slug = farmSlugFromQuery(c);
  const farm = await getFarmBySlug(c.env.DB, slug);
  if (!farm) {
    return c.json({ error: "farm_not_found", slug }, 404);
  }

  const { results } = await c.env.DB.prepare(
    `SELECT id, farm_id, kind, driver, name, zone, protocol, last_seen
     FROM devices WHERE farm_id = ? ORDER BY name`
  )
    .bind(farm.id)
    .all();

  return c.json({ farm_id: farm.id, slug: farm.slug, devices: results ?? [] });
});

api.get("/v1/devices/:id/readings", async (c) => {
  const id = c.req.param("id");
  const device = await c.env.DB.prepare(
    `SELECT id, farm_id FROM devices WHERE id = ?`
  )
    .bind(id)
    .first<{ id: string; farm_id: string }>();
  if (!device) {
    return c.json({ error: "device_not_found" }, 404);
  }

  const metric = c.req.query("metric");
  const limit = Math.min(
    200,
    Math.max(1, Number(c.req.query("limit") || "50") || 50)
  );

  let sql = `SELECT id, device_id, metric, value, ts FROM readings WHERE device_id = ?`;
  const binds: (string | number)[] = [id];
  if (metric) {
    sql += ` AND metric = ?`;
    binds.push(metric);
  }
  sql += ` ORDER BY ts DESC LIMIT ?`;
  binds.push(limit);

  const { results } = await c.env.DB.prepare(sql).bind(...binds).all();
  return c.json({
    device_id: id,
    farm_id: device.farm_id,
    readings: results ?? [],
  });
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

  const slug = String(form.get("farm_slug") || defaultFarmSlug(c.env));
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
  const slug = farmSlugFromQuery(c);
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

  const slug = farmSlugFromQuery(c);
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

api.post("/v1/ingest", async (c) => {
  const denied = await requireIngest(c);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }

  const parsed = IngestBatchSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "validation", details: parsed.error.flatten() }, 400);
  }

  const farm =
    (await getFarmBySlug(c.env.DB, parsed.data.farm_id)) ||
    (await c.env.DB.prepare(
      `SELECT id, slug, name, country, timezone, lat, lon, starlink_site, created_at
       FROM farms WHERE id = ?`
    )
      .bind(parsed.data.farm_id)
      .first());

  if (!farm) {
    return c.json({ error: "farm_not_found", farm_id: parsed.data.farm_id }, 404);
  }

  const batch = {
    ...parsed.data,
    farm_id: farm.slug,
  };

  await c.env.INGEST.send(batch);
  return c.json(
    { ok: true, queued: true, batch_id: batch.batch_id, farm: farm.slug },
    202
  );
});

api.get("/v1/overview", async (c) => {
  const slug = farmSlugFromQuery(c);
  const farm = await getFarm(c.env, slug);
  if (!farm) {
    return c.json({ error: "farm_not_found", slug }, 404);
  }

  const stub = farmStub(c.env, farm.slug);
  const liveRes = await stub.fetch(
    new Request(`https://do/overview?farm_id=${encodeURIComponent(farm.slug)}`)
  );
  const live = await liveRes.json();

  const { results: plots } = await c.env.DB.prepare(
    `SELECT id, name, use_type FROM plots WHERE farm_id = ? ORDER BY name`
  )
    .bind(farm.id)
    .all();

  let irrigation = null;
  try {
    irrigation = await irrigationOverview(c.env.DB, farm.id);
  } catch {
    irrigation = null;
  }

  const liveState = live as FarmLiveState;
  const metrics = liveState.metrics ?? {};

  let climate = null;
  try {
    climate = await climateOverview(c.env.DB, farm.id, metrics);
  } catch {
    climate = null;
  }

  let energy = null;
  try {
    energy = await energyOverview(
      c.env.DB,
      farm.id,
      farm.slug,
      farm.timezone,
      metrics
    );
  } catch {
    energy = null;
  }

  const flags = await getFlags(c.env.KV, farm.slug);

  return c.json({
    farm: {
      id: farm.id,
      slug: farm.slug,
      name: farm.name,
      timezone: farm.timezone,
    },
    plots: plots ?? [],
    live,
    irrigation,
    climate,
    energy,
    flags,
  });
});

api.get("/v1/weather/now", async (c) => {
  const slug = farmSlugFromQuery(c);
  const farm = await getFarmBySlug(c.env.DB, slug);
  if (!farm) {
    return c.json({ error: "farm_not_found", slug }, 404);
  }
  const stub = farmStub(c.env, farm.slug);
  const liveRes = await stub.fetch(
    new Request(`https://do/overview?farm_id=${encodeURIComponent(farm.slug)}`)
  );
  const live = (await liveRes.json()) as FarmLiveState;
  return c.json(weatherNow(farm.timezone, live));
});

api.get("/v1/local/health", async (c) => {
  const slug = farmSlugFromQuery(c);
  const farm = await getFarmBySlug(c.env.DB, slug);
  if (!farm) {
    return c.json({ error: "farm_not_found", slug }, 404);
  }

  const stub = farmStub(c.env, farm.slug);
  const res = await stub.fetch(
    new Request(`https://do/health?farm_id=${encodeURIComponent(farm.slug)}`)
  );
  return new Response(res.body, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
});

api.get("/v1/live", async (c) => {
  const slug = farmSlugFromQuery(c);
  const upgrade = c.req.header("Upgrade");
  if (upgrade !== "websocket") {
    return c.json({ error: "expected_websocket", hint: "Upgrade: websocket" }, 426);
  }

  const stub = farmStub(c.env, slug);
  return stub.fetch(
    new Request(`https://do/ws?farm_id=${encodeURIComponent(slug)}`, c.req.raw)
  );
});

const SNAPSHOT_MAX = 2 * 1024 * 1024;

api.get("/v1/cameras", async (c) => {
  const slug = farmSlugFromQuery(c);
  const farm = await getFarmBySlug(c.env.DB, slug);
  if (!farm) {
    return c.json({ error: "farm_not_found", slug }, 404);
  }

  const { results: cameras } = await c.env.DB.prepare(
    `SELECT id, farm_id, name, zone, driver, protocol, last_seen
     FROM devices WHERE farm_id = ? AND kind = 'camera' ORDER BY name`
  )
    .bind(farm.id)
    .all<{
      id: string;
      farm_id: string;
      name: string;
      zone: string | null;
      driver: string;
      protocol: string | null;
      last_seen: string | null;
    }>();

  const { results: snaps } = await c.env.DB.prepare(
    `SELECT camera_id, r2_key, source, captured_at FROM camera_snapshots WHERE farm_id = ?`
  )
    .bind(farm.id)
    .all<{
      camera_id: string;
      r2_key: string;
      source: string;
      captured_at: string;
    }>();

  const snapMap = new Map((snaps ?? []).map((s) => [s.camera_id, s]));

  return c.json({
    farm_id: farm.id,
    slug: farm.slug,
    cameras: (cameras ?? []).map((cam) => {
      const s = snapMap.get(cam.id);
      return {
        ...cam,
        snapshot: s
          ? {
              r2_key: s.r2_key,
              source: s.source,
              captured_at: s.captured_at,
              url: `/v1/cameras/${cam.id}/latest`,
            }
          : null,
      };
    }),
  });
});

api.get("/v1/cameras/:id/latest", async (c) => {
  const id = c.req.param("id");
  const row = await c.env.DB.prepare(
    `SELECT camera_id, r2_key, content_type FROM camera_snapshots WHERE camera_id = ?`
  )
    .bind(id)
    .first<{ camera_id: string; r2_key: string; content_type: string }>();

  if (!row) {
    return c.json({ error: "snapshot_not_found" }, 404);
  }

  const obj = await c.env.MEDIA.get(row.r2_key);
  if (!obj) {
    return c.json({ error: "object_missing" }, 404);
  }

  const bytes = await obj.arrayBuffer();
  const headers = new Headers();
  headers.set("Content-Type", row.content_type || "image/jpeg");
  headers.set("Cache-Control", "public, max-age=60");
  return new Response(bytes, { headers });
});

api.post("/v1/cameras/:id/snapshot", async (c) => {
  const denied = await requireOperator(c);
  if (denied) return denied;

  const id = c.req.param("id");
  const cam = await c.env.DB.prepare(
    `SELECT id, farm_id, name FROM devices WHERE id = ? AND kind = 'camera'`
  )
    .bind(id)
    .first<{ id: string; farm_id: string; name: string }>();

  if (!cam) {
    return c.json({ error: "camera_not_found" }, 404);
  }

  const cmdId = crypto.randomUUID();
  const created_at = new Date().toISOString();
  await c.env.DB.prepare(
    `INSERT INTO commands (id, farm_id, device_id, action, payload_json, source, status, confirmed_by, created_at)
     VALUES (?, ?, ?, 'snapshot.take', ?, 'ui', 'sent', 'user:operator', ?)`
  )
    .bind(
      cmdId,
      cam.farm_id,
      cam.id,
      JSON.stringify({ reason: "manual" }),
      created_at
    )
    .run();

  await writeAudit(c.env.DB, {
    farm_id: cam.farm_id,
    actor: "user:operator",
    action: "camera.snapshot.request",
    entity: `camera:${cam.id}`,
    after: { command_id: cmdId },
  });

  return c.json(
    { ok: true, command_id: cmdId, camera_id: cam.id, status: "sent" },
    202
  );
});

api.get("/v1/commands", async (c) => {
  const denied = await requireOperatorOrIngest(c);
  if (denied) return denied;

  const slug = farmSlugFromQuery(c);
  const farm = await getFarmBySlug(c.env.DB, slug);
  if (!farm) {
    return c.json({ error: "farm_not_found", slug }, 404);
  }

  const status = c.req.query("status") || "sent";
  const action = c.req.query("action");
  const deviceId = c.req.query("device_id");

  let sql = `SELECT id, farm_id, device_id, action, payload_json, source, status, created_at
             FROM commands WHERE farm_id = ? AND status = ?`;
  const binds: (string | number)[] = [farm.id, status];
  if (action) {
    sql += ` AND action = ?`;
    binds.push(action);
  }
  if (deviceId) {
    sql += ` AND device_id = ?`;
    binds.push(deviceId);
  }
  sql += ` ORDER BY created_at ASC LIMIT 50`;

  const { results } = await c.env.DB.prepare(sql).bind(...binds).all();
  return c.json({ farm_id: farm.id, commands: results ?? [] });
});

api.patch("/v1/commands/:id", async (c) => {
  const denied = await requireOperatorOrIngest(c);
  if (denied) return denied;

  const id = c.req.param("id");
  let body: { status?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }

  const status = body.status;
  if (!status || !["acked", "failed", "cancelled"].includes(status)) {
    return c.json({ error: "invalid_status" }, 400);
  }

  const row = await c.env.DB.prepare(
    `SELECT id, farm_id, device_id, action, status FROM commands WHERE id = ?`
  )
    .bind(id)
    .first<{
      id: string;
      farm_id: string;
      device_id: string;
      action: string;
      status: string;
    }>();

  if (!row) {
    return c.json({ error: "command_not_found" }, 404);
  }

  await c.env.DB.prepare(`UPDATE commands SET status = ? WHERE id = ?`)
    .bind(status, id)
    .run();

  if (row.action === "valve.open") {
    if (status === "acked") {
      // Edge ACK means the valve is ON with a local timeout — not finished yet.
      await c.env.DB.prepare(
        `UPDATE irrigation_runs SET status = 'running' WHERE command_id = ? AND status = 'sent'`
      )
        .bind(id)
        .run();
    } else {
      const runStatus = status === "failed" ? "failed" : "cancelled";
      await c.env.DB.prepare(
        `UPDATE irrigation_runs
         SET status = ?, ended_at = COALESCE(ended_at, ?)
         WHERE command_id = ?`
      )
        .bind(runStatus, new Date().toISOString(), id)
        .run();
    }
  }

  await writeAudit(c.env.DB, {
    farm_id: row.farm_id,
    actor: "edge",
    action: "command.update",
    entity: `command:${id}`,
    before: { status: row.status },
    after: { status },
  });

  return c.json({ ok: true, id, status });
});

api.post("/v1/ingest/media", async (c) => {
  const denied = await requireIngest(c);
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
  const fileType = (file.type || "").toLowerCase();
  const fileName = (file.name || "").toLowerCase();
  const isJpeg =
    fileType === "image/jpeg" ||
    fileType === "image/jpg" ||
    (!fileType && (fileName.endsWith(".jpg") || fileName.endsWith(".jpeg")));
  if (!isJpeg) {
    return c.json({ error: "unsupported_type", allowed: ["image/jpeg"] }, 400);
  }
  if (file.size > SNAPSHOT_MAX) {
    return c.json({ error: "file_too_large", max_bytes: SNAPSHOT_MAX }, 400);
  }

  const camera_id = String(form.get("camera_id") || "");
  if (!camera_id) {
    return c.json({ error: "camera_id_required" }, 400);
  }

  const sourceRaw = String(form.get("source") || "placeholder");
  const source = sourceRaw === "rtsp" ? "rtsp" : "placeholder";
  const slug = String(form.get("farm_slug") || defaultFarmSlug(c.env));
  const farm = await getFarmBySlug(c.env.DB, slug);
  if (!farm) {
    return c.json({ error: "farm_not_found", slug }, 404);
  }

  const cam = await c.env.DB.prepare(
    `SELECT id FROM devices WHERE id = ? AND farm_id = ? AND kind = 'camera'`
  )
    .bind(camera_id, farm.id)
    .first();
  if (!cam) {
    return c.json({ error: "camera_not_found" }, 404);
  }

  const captured_at = new Date().toISOString();
  const r2_key = `${farm.slug}/cameras/${camera_id}/latest.jpg`;
  const bytes = await file.arrayBuffer();

  await c.env.MEDIA.put(r2_key, bytes, {
    httpMetadata: { contentType: "image/jpeg" },
    customMetadata: { camera_id, source },
  });

  await c.env.DB.prepare(
    `INSERT INTO camera_snapshots (camera_id, farm_id, r2_key, content_type, source, captured_at)
     VALUES (?, ?, ?, 'image/jpeg', ?, ?)
     ON CONFLICT(camera_id) DO UPDATE SET
       r2_key = excluded.r2_key,
       content_type = excluded.content_type,
       source = excluded.source,
       captured_at = excluded.captured_at`
  )
    .bind(camera_id, farm.id, r2_key, source, captured_at)
    .run();

  await c.env.DB.prepare(`UPDATE devices SET last_seen = ? WHERE id = ?`)
    .bind(captured_at, camera_id)
    .run();

  await writeAudit(c.env.DB, {
    farm_id: farm.id,
    actor: "edge",
    action: "camera.snapshot",
    entity: `camera:${camera_id}`,
    after: { r2_key, source, captured_at },
  });

  return c.json(
    {
      ok: true,
      camera_id,
      r2_key,
      source,
      captured_at,
      url: `/v1/cameras/${camera_id}/latest`,
    },
    201
  );
});
