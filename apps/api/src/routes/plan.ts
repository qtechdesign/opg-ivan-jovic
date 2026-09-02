import { Hono } from "hono";
import { requireOperator } from "../lib/auth";
import { writeAudit } from "../lib/audit";
import { farmSlugFromQuery, getFarmBySlug } from "../lib/farm";
import { eurosToCents } from "../lib/money";
import {
  BUILD_PHASE_STATUSES,
  PLAN_ORDER_STATUSES,
  PLAN_TASK_STATUSES,
  amountFromQuote,
  insertPlanOrder,
  insertPlanTask,
  isoDateOrNull,
  listBuildPhases,
  planBoard,
  planTotals,
  renderPlanIcs,
  type PlanOrder,
  type PlanTask,
} from "../lib/plan";
import { researchPricesOnline } from "../lib/price-research";
import { publicOriginFromHost } from "../lib/public-origin";
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
    const board = await planBoard(c.env.DB, farm.id, farm.timezone);
    return c.json({
      farm_id: farm.id,
      slug: farm.slug,
      timezone: farm.timezone,
      ics: `/v1/plan/calendar.ics?farm=${encodeURIComponent(farm.slug)}`,
      ...board,
    });
  } catch {
    const phases = await listBuildPhases(c.env.DB, farm.id).catch(() => []);
    return c.json({
      farm_id: farm.id,
      slug: farm.slug,
      timezone: farm.timezone,
      totals: planTotals(phases),
      order_totals: {
        amount_cents: 0,
        research: 0,
        quoted: 0,
        ordered: 0,
        received: 0,
      },
      phases,
      tasks: [],
      orders: [],
      where: {
        today: null,
        timezone: farm.timezone,
        active_phases: [],
        open_tasks: 0,
        overdue_tasks: [],
        due_soon: [],
        orders_research: 0,
        orders_quoted: 0,
        orders_open: 0,
      },
      events: [],
      ics: `/v1/plan/calendar.ics?farm=${encodeURIComponent(farm.slug)}`,
    });
  }
});

planApi.get("/v1/plan/calendar.ics", async (c) => {
  const slug = farmSlugFromQuery(c);
  const farm = await getFarmBySlug(c.env.DB, slug);
  if (!farm) return c.json({ error: "farm_not_found", slug }, 404);
  const board = await planBoard(c.env.DB, farm.id, farm.timezone);
  const origin = publicOriginFromHost(c.req.header("host"));
  const ics = renderPlanIcs({
    farmName: farm.name,
    slug: farm.slug,
    origin,
    events: board.events,
  });
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="${farm.slug}-plan.ics"`,
      "Cache-Control": "public, max-age=300",
    },
  });
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
    starts_on: isoDateOrNull(body.starts_on),
    ends_on: isoDateOrNull(body.ends_on),
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
      body.starts_on != null ? isoDateOrNull(body.starts_on) : existing.starts_on,
    ends_on: body.ends_on != null ? isoDateOrNull(body.ends_on) : existing.ends_on,
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

planApi.post("/v1/plan/tasks", async (c) => {
  const denied = await requireOperator(c);
  if (denied) return denied;
  let body: {
    farm_slug?: string;
    title?: string;
    body?: string;
    phase_id?: string;
    due_on?: string;
    status?: string;
    sort?: number;
  } = {};
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }
  const title = (body.title || "").trim();
  if (title.length < 2) return c.json({ error: "title_required" }, 400);
  const status = (body.status || "todo").trim();
  if (!PLAN_TASK_STATUSES.includes(status as (typeof PLAN_TASK_STATUSES)[number])) {
    return c.json({ error: "invalid_status" }, 400);
  }
  const slug = body.farm_slug || farmSlugFromQuery(c);
  const farm = await getFarmBySlug(c.env.DB, slug);
  if (!farm) return c.json({ error: "farm_not_found", slug }, 404);

  const row = await insertPlanTask(c.env.DB, {
    id: crypto.randomUUID(),
    farm_id: farm.id,
    phase_id: body.phase_id || null,
    title,
    body: (body.body || "").trim() || null,
    status,
    due_on: isoDateOrNull(body.due_on),
    sort: Number.isFinite(body.sort) ? Number(body.sort) : 0,
  });
  await writeAudit(c.env.DB, {
    farm_id: farm.id,
    actor: "user:operator",
    action: "plan.task.create",
    entity: `task:${row.id}`,
    after: row,
  });
  return c.json({ ok: true, task: row }, 201);
});

planApi.patch("/v1/plan/tasks/:id", async (c) => {
  const denied = await requireOperator(c);
  if (denied) return denied;
  let body: {
    title?: string;
    body?: string;
    phase_id?: string | null;
    due_on?: string | null;
    status?: string;
    sort?: number;
  } = {};
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }
  const id = c.req.param("id");
  const existing = await c.env.DB.prepare(
    `SELECT id, farm_id, phase_id, title, body, status, due_on, sort, created_at, updated_at
     FROM plan_tasks WHERE id = ?`
  ).bind(id).first<PlanTask>();
  if (!existing) return c.json({ error: "not_found" }, 404);
  const status = body.status != null ? String(body.status).trim() : existing.status;
  if (!PLAN_TASK_STATUSES.includes(status as (typeof PLAN_TASK_STATUSES)[number])) {
    return c.json({ error: "invalid_status" }, 400);
  }
  const next = {
    title: body.title != null ? String(body.title).trim() : existing.title,
    body: body.body != null ? String(body.body).trim() || null : existing.body,
    phase_id:
      body.phase_id !== undefined ? body.phase_id || null : existing.phase_id,
    due_on: body.due_on !== undefined ? isoDateOrNull(body.due_on) : existing.due_on,
    status,
    sort: body.sort != null && Number.isFinite(body.sort) ? Number(body.sort) : existing.sort,
  };
  const updated_at = new Date().toISOString();
  await c.env.DB.prepare(
    `UPDATE plan_tasks SET title = ?, body = ?, phase_id = ?, due_on = ?, status = ?, sort = ?, updated_at = ?
     WHERE id = ?`
  )
    .bind(
      next.title,
      next.body,
      next.phase_id,
      next.due_on,
      next.status,
      next.sort,
      updated_at,
      id
    )
    .run();
  await writeAudit(c.env.DB, {
    farm_id: existing.farm_id,
    actor: "user:operator",
    action: "plan.task.patch",
    entity: `task:${id}`,
    before: existing,
    after: next,
  });
  return c.json({ ok: true, id, ...next, updated_at });
});

planApi.post("/v1/plan/orders", async (c) => {
  const denied = await requireOperator(c);
  if (denied) return denied;
  let body: {
    farm_slug?: string;
    title?: string;
    vendor?: string;
    url?: string;
    qty?: number;
    amount_eur?: number;
    phase_id?: string;
    due_on?: string;
    notes?: string;
    status?: string;
    confirm?: boolean;
    reason?: string;
  } = {};
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }
  const title = (body.title || "").trim();
  if (title.length < 2) return c.json({ error: "title_required" }, 400);
  const status = (body.status || "research").trim();
  if (!PLAN_ORDER_STATUSES.includes(status as (typeof PLAN_ORDER_STATUSES)[number])) {
    return c.json({ error: "invalid_status" }, 400);
  }
  const moneyCommit = status === "ordered" || status === "received";
  if (moneyCommit && body.confirm !== true) {
    return c.json(
      {
        proposal: true,
        hint: "confirm: true + reason required to mark a procurement line ordered/received.",
      },
      200
    );
  }
  if (moneyCommit && (body.reason || "").trim().length < 3) {
    return c.json({ error: "reason_required" }, 400);
  }
  const slug = body.farm_slug || farmSlugFromQuery(c);
  const farm = await getFarmBySlug(c.env.DB, slug);
  if (!farm) return c.json({ error: "farm_not_found", slug }, 404);
  const money = amountFromQuote({
    qty: Number(body.qty) || 1,
    amount_eur: body.amount_eur,
  });
  const row = await insertPlanOrder(c.env.DB, {
    id: crypto.randomUUID(),
    farm_id: farm.id,
    phase_id: body.phase_id || null,
    task_id: null,
    title,
    vendor: (body.vendor || "").trim() || null,
    url: (body.url || "").trim() || null,
    qty: money.qty,
    unit_cents: money.unit_cents,
    amount_cents: money.amount_cents,
    currency: "EUR",
    status,
    due_on: isoDateOrNull(body.due_on),
    notes: (body.notes || "").trim() || null,
    source: "ui",
  });
  await writeAudit(c.env.DB, {
    farm_id: farm.id,
    actor: "user:operator",
    action: "plan.order.create",
    entity: `order:${row.id}`,
    after: { ...row, reason: (body.reason || "").trim() || null },
  });
  return c.json({ ok: true, order: row }, 201);
});

planApi.patch("/v1/plan/orders/:id", async (c) => {
  const denied = await requireOperator(c);
  if (denied) return denied;
  let body: {
    title?: string;
    vendor?: string;
    url?: string;
    qty?: number;
    amount_eur?: number;
    phase_id?: string | null;
    due_on?: string | null;
    notes?: string;
    status?: string;
    confirm?: boolean;
    reason?: string;
  } = {};
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }
  const id = c.req.param("id");
  const existing = await c.env.DB.prepare(
    `SELECT id, farm_id, phase_id, task_id, title, vendor, url, qty, unit_cents, amount_cents,
            currency, status, due_on, notes, source, created_at, updated_at
     FROM plan_orders WHERE id = ?`
  ).bind(id).first<PlanOrder>();
  if (!existing) return c.json({ error: "not_found" }, 404);
  const status = body.status != null ? String(body.status).trim() : existing.status;
  if (!PLAN_ORDER_STATUSES.includes(status as (typeof PLAN_ORDER_STATUSES)[number])) {
    return c.json({ error: "invalid_status" }, 400);
  }
  const moneyCommit =
    status === "ordered" ||
    status === "received" ||
    (existing.status !== "ordered" &&
      existing.status !== "received" &&
      (status === "ordered" || status === "received"));
  if (moneyCommit && body.confirm !== true) {
    return c.json(
      {
        proposal: true,
        hint: "confirm: true + reason required to commit a procurement order.",
      },
      200
    );
  }
  if (moneyCommit && (body.reason || "").trim().length < 3) {
    return c.json({ error: "reason_required" }, 400);
  }
  const money = amountFromQuote({
    qty: body.qty != null ? Number(body.qty) : existing.qty,
    amount_eur: body.amount_eur,
    unit_cents: body.amount_eur == null ? existing.unit_cents : undefined,
  });
  const next = {
    title: body.title != null ? String(body.title).trim() : existing.title,
    vendor: body.vendor != null ? String(body.vendor).trim() || null : existing.vendor,
    url: body.url != null ? String(body.url).trim() || null : existing.url,
    qty: money.qty,
    unit_cents: money.unit_cents,
    amount_cents: body.amount_eur != null ? money.amount_cents : existing.amount_cents,
    phase_id: body.phase_id !== undefined ? body.phase_id || null : existing.phase_id,
    due_on: body.due_on !== undefined ? isoDateOrNull(body.due_on) : existing.due_on,
    notes: body.notes != null ? String(body.notes).trim() || null : existing.notes,
    status,
  };
  if (body.amount_eur == null) {
    next.qty = body.qty != null ? Number(body.qty) || existing.qty : existing.qty;
    next.unit_cents = existing.unit_cents;
    next.amount_cents = existing.amount_cents;
  }
  const updated_at = new Date().toISOString();
  await c.env.DB.prepare(
    `UPDATE plan_orders
     SET title = ?, vendor = ?, url = ?, qty = ?, unit_cents = ?, amount_cents = ?,
         phase_id = ?, due_on = ?, notes = ?, status = ?, updated_at = ?
     WHERE id = ?`
  )
    .bind(
      next.title,
      next.vendor,
      next.url,
      next.qty,
      next.unit_cents,
      next.amount_cents,
      next.phase_id,
      next.due_on,
      next.notes,
      next.status,
      updated_at,
      id
    )
    .run();
  await writeAudit(c.env.DB, {
    farm_id: existing.farm_id,
    actor: "user:operator",
    action: "plan.order.patch",
    entity: `order:${id}`,
    before: existing,
    after: { ...next, reason: (body.reason || "").trim() || null },
  });
  return c.json({ ok: true, id, ...next, updated_at });
});

planApi.post("/v1/plan/research", async (c) => {
  const denied = await requireOperator(c);
  if (denied) return denied;
  let body: {
    farm_slug?: string;
    query?: string;
    save?: boolean;
    phase_id?: string;
  } = {};
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }
  const query = (body.query || "").trim();
  if (query.length < 3) return c.json({ error: "query_required" }, 400);
  if (!c.env.XAI_API_KEY) {
    return c.json({ error: "xai_not_configured" }, 503);
  }
  const slug = body.farm_slug || farmSlugFromQuery(c);
  const farm = await getFarmBySlug(c.env.DB, slug);
  if (!farm) return c.json({ error: "farm_not_found", slug }, 404);

  let result;
  try {
    result = await researchPricesOnline(c.env.XAI_API_KEY, query);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: "research_failed", detail: msg.slice(0, 300) }, 502);
  }

  const saved: PlanOrder[] = [];
  if (body.save && result.quotes.length) {
    for (const q of result.quotes) {
      const money = amountFromQuote({
        qty: 1,
        amount_eur: q.amount_eur,
      });
      const row = await insertPlanOrder(c.env.DB, {
        id: crypto.randomUUID(),
        farm_id: farm.id,
        phase_id: body.phase_id || null,
        task_id: null,
        title: q.title,
        vendor: q.vendor,
        url: q.url,
        qty: 1,
        unit_cents: money.unit_cents,
        amount_cents: money.amount_cents,
        currency: "EUR",
        status: "research",
        due_on: null,
        notes: q.notes,
        source: "grok",
      });
      saved.push(row);
    }
    await writeAudit(c.env.DB, {
      farm_id: farm.id,
      actor: "user:operator",
      action: "plan.research.save",
      entity: `research:${query.slice(0, 80)}`,
      after: { query, saved: saved.length },
    });
  }

  return c.json({
    ok: true,
    query,
    quotes: result.quotes,
    saved,
    model: result.model,
  });
});
