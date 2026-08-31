import { Hono } from "hono";
import { requireOperator } from "../lib/auth";
import { writeAudit } from "../lib/audit";
import { farmSlugFromQuery, getFarmBySlug } from "../lib/farm";
import { eurosToCents } from "../lib/money";
import {
  BUILD_PHASE_STATUSES,
  listBuildPhases,
  planTotals,
} from "../lib/plan";
import {
  fetchPublicTrelloBoard,
  trelloBoardIdForSlug,
} from "../lib/trello";

type AppEnv = { Bindings: Cloudflare.Env };

export const planApi = new Hono<AppEnv>();

planApi.get("/v1/plan", async (c) => {
  const slug = farmSlugFromQuery(c);
  const farm = await getFarmBySlug(c.env.DB, slug);
  if (!farm) return c.json({ error: "farm_not_found", slug }, 404);
  try {
    const phases = await listBuildPhases(c.env.DB, farm.id);
    return c.json({
      farm_id: farm.id,
      slug: farm.slug,
      totals: planTotals(phases),
      phases,
    });
  } catch {
    return c.json({
      farm_id: farm.id,
      slug: farm.slug,
      totals: { amount_cents: 0, planned: 0, active: 0, done: 0 },
      phases: [],
    });
  }
});

planApi.get("/v1/trello", async (c) => {
  const slug = farmSlugFromQuery(c);
  const farm = await getFarmBySlug(c.env.DB, slug);
  if (!farm) return c.json({ error: "farm_not_found", slug }, 404);
  const boardId = trelloBoardIdForSlug(farm.slug);
  if (!boardId) {
    return c.json({ farm_id: farm.id, slug: farm.slug, board: null });
  }
  try {
    const board = await fetchPublicTrelloBoard(boardId);
    return c.json({ farm_id: farm.id, slug: farm.slug, board });
  } catch {
    return c.json({ farm_id: farm.id, slug: farm.slug, board: null });
  }
});

planApi.post("/v1/plan", async (c) => {
  const denied = await requireOperator(c);
  if (denied) return denied;

  let body: {
    farm_slug?: string;
    title?: string;
    body?: string;
    starts_on?: string;
    ends_on?: string;
    amount_eur?: number;
    status?: string;
    sort?: number;
    confirm?: boolean;
    reason?: string;
  } = {};
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }

  if (body.confirm !== true) {
    return c.json(
      {
        proposal: true,
        hint: "confirm: true + reason required to add a build phase (time + money).",
      },
      200
    );
  }
  const reason = (body.reason || "").trim();
  if (reason.length < 3) return c.json({ error: "reason_required" }, 400);

  const title = (body.title || "").trim();
  if (title.length < 2) return c.json({ error: "title_required" }, 400);

  const status = (body.status || "planned").trim();
  if (!BUILD_PHASE_STATUSES.includes(status as (typeof BUILD_PHASE_STATUSES)[number])) {
    return c.json({ error: "invalid_status" }, 400);
  }

  const slug = body.farm_slug || farmSlugFromQuery(c);
  const farm = await getFarmBySlug(c.env.DB, slug);
  if (!farm) return c.json({ error: "farm_not_found", slug }, 404);

  const amount_cents = eurosToCents(Number(body.amount_eur) || 0);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const row = {
    id,
    farm_id: farm.id,
    title,
    body: (body.body || "").trim() || null,
    starts_on: (body.starts_on || "").trim() || null,
    ends_on: (body.ends_on || "").trim() || null,
    amount_cents,
    currency: "EUR",
    status,
    sort: Number.isFinite(body.sort) ? Number(body.sort) : 0,
    created_at: now,
  };

  await c.env.DB.prepare(
    `INSERT INTO build_phases (id, farm_id, title, body, starts_on, ends_on, amount_cents, currency, status, sort, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      row.id,
      row.farm_id,
      row.title,
      row.body,
      row.starts_on,
      row.ends_on,
      row.amount_cents,
      row.currency,
      row.status,
      row.sort,
      row.created_at
    )
    .run();

  await writeAudit(c.env.DB, {
    farm_id: farm.id,
    actor: "user:operator",
    action: "plan.create",
    entity: `phase:${id}`,
    after: { ...row, reason },
  });

  return c.json({ ok: true, phase: row }, 201);
});

planApi.patch("/v1/plan/:id", async (c) => {
  const denied = await requireOperator(c);
  if (denied) return denied;

  let body: {
    title?: string;
    body?: string;
    starts_on?: string;
    ends_on?: string;
    amount_eur?: number;
    status?: string;
    sort?: number;
    confirm?: boolean;
    reason?: string;
  } = {};
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }

  if (body.confirm !== true) {
    return c.json(
      { proposal: true, hint: "confirm: true + reason required to change a phase." },
      200
    );
  }
  const reason = (body.reason || "").trim();
  if (reason.length < 3) return c.json({ error: "reason_required" }, 400);

  const id = c.req.param("id");
  const existing = await c.env.DB.prepare(
    `SELECT id, farm_id, title, body, starts_on, ends_on, amount_cents, currency, status, sort, created_at
     FROM build_phases WHERE id = ?`
  ).bind(id).first<{
    id: string;
    farm_id: string;
    title: string;
    body: string | null;
    starts_on: string | null;
    ends_on: string | null;
    amount_cents: number;
    currency: string;
    status: string;
    sort: number;
    created_at: string;
  }>();
  if (!existing) return c.json({ error: "not_found" }, 404);

  const status = body.status != null ? String(body.status).trim() : existing.status;
  if (!BUILD_PHASE_STATUSES.includes(status as (typeof BUILD_PHASE_STATUSES)[number])) {
    return c.json({ error: "invalid_status" }, 400);
  }

  const next = {
    title: body.title != null ? String(body.title).trim() : existing.title,
    body: body.body != null ? String(body.body).trim() || null : existing.body,
    starts_on:
      body.starts_on != null ? String(body.starts_on).trim() || null : existing.starts_on,
    ends_on: body.ends_on != null ? String(body.ends_on).trim() || null : existing.ends_on,
    amount_cents:
      body.amount_eur != null ? eurosToCents(Number(body.amount_eur) || 0) : existing.amount_cents,
    status,
    sort: body.sort != null && Number.isFinite(body.sort) ? Number(body.sort) : existing.sort,
  };

  await c.env.DB.prepare(
    `UPDATE build_phases SET title = ?, body = ?, starts_on = ?, ends_on = ?, amount_cents = ?, status = ?, sort = ?
     WHERE id = ?`
  )
    .bind(
      next.title,
      next.body,
      next.starts_on,
      next.ends_on,
      next.amount_cents,
      next.status,
      next.sort,
      id
    )
    .run();

  await writeAudit(c.env.DB, {
    farm_id: existing.farm_id,
    actor: "user:operator",
    action: "plan.patch",
    entity: `phase:${id}`,
    before: existing,
    after: { ...next, reason },
  });

  return c.json({ ok: true, id, ...next });
});
