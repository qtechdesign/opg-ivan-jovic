import { Hono } from "hono";
import {
  CreateLedgerSchema,
  LedgerCategorySchema,
  LedgerKindSchema,
  PatchLedgerSchema,
  type LedgerEntry,
} from "@polje/schema";
import { requireOperator } from "../lib/auth";
import { writeAudit } from "../lib/audit";
import { farmSlugFromQuery, getFarmBySlug } from "../lib/farm";
import { eurosToCents } from "../lib/money";

type AppEnv = { Bindings: Cloudflare.Env };

const RECEIPT_MAX = 5 * 1024 * 1024;
const RECEIPT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

export const ledgerApi = new Hono<AppEnv>();

export type LedgerMonth = {
  ym: string;
  income_cents: number;
  expense_cents: number;
  subsidy_cents: number;
  asset_cents: number;
};

export type LedgerSummary = {
  from: string;
  to: string;
  income_cents: number;
  expense_cents: number;
  subsidy_cents: number;
  asset_cents: number;
  operating_net_cents: number;
  cash_net_cents: number;
  yield_kg: number;
  months: LedgerMonth[];
};

export function defaultLedgerWindow(): { from: string; to: string } {
  const year = new Date().getUTCFullYear();
  return {
    from: `${year}-01-01T00:00:00Z`,
    to: `${year}-12-31T23:59:59Z`,
  };
}

export async function farmLedgerSummary(
  db: D1Database,
  farmId: string,
  from: string,
  to: string
): Promise<LedgerSummary> {
  const { results: rows } = await db
    .prepare(
      `SELECT kind, amount_cents, substr(ts, 1, 7) AS ym
       FROM ledger
       WHERE farm_id = ? AND ts >= ? AND ts <= ?`
    )
    .bind(farmId, from, to)
    .all<{ kind: string; amount_cents: number; ym: string }>();

  let income_cents = 0;
  let expense_cents = 0;
  let subsidy_cents = 0;
  let asset_cents = 0;
  const monthMap = new Map<string, LedgerMonth>();

  for (const r of rows ?? []) {
    const m = monthMap.get(r.ym) ?? {
      ym: r.ym,
      income_cents: 0,
      expense_cents: 0,
      subsidy_cents: 0,
      asset_cents: 0,
    };
    if (r.kind === "income") {
      income_cents += r.amount_cents;
      m.income_cents += r.amount_cents;
    } else if (r.kind === "expense") {
      expense_cents += r.amount_cents;
      m.expense_cents += r.amount_cents;
    } else if (r.kind === "subsidy") {
      subsidy_cents += r.amount_cents;
      m.subsidy_cents += r.amount_cents;
    } else if (r.kind === "asset") {
      asset_cents += r.amount_cents;
      m.asset_cents += r.amount_cents;
    }
    monthMap.set(r.ym, m);
  }

  const months = [...monthMap.values()].sort((a, b) =>
    a.ym.localeCompare(b.ym)
  );

  const yieldRow = await db
    .prepare(
      `SELECT COALESCE(SUM(p.yield_kg), 0) AS yield_kg
       FROM plantings p
       JOIN plots pl ON pl.id = p.plot_id
       WHERE pl.farm_id = ?`
    )
    .bind(farmId)
    .first<{ yield_kg: number }>();

  return {
    from,
    to,
    income_cents,
    expense_cents,
    subsidy_cents,
    asset_cents,
    operating_net_cents: income_cents - expense_cents,
    cash_net_cents: income_cents + subsidy_cents - expense_cents - asset_cents,
    yield_kg: yieldRow?.yield_kg ?? 0,
    months,
  };
}

type LedgerRow = {
  id: string;
  farm_id: string;
  ts: string;
  kind: string;
  category: string | null;
  amount_cents: number;
  currency: string;
  note: string | null;
  r2_key: string | null;
};

function resolveCents(
  amount_cents: number | undefined,
  amount_eur: number | undefined
): number | null {
  if (amount_cents != null) return amount_cents;
  if (amount_eur != null) {
    const cents = eurosToCents(amount_eur);
    return cents >= 1 ? cents : null;
  }
  return null;
}

function withReceiptUrl(row: LedgerRow) {
  return {
    ...row,
    receipt_url: row.r2_key ? `/v1/ledger/${row.id}/receipt` : null,
  };
}

ledgerApi.get("/v1/ledger/summary", async (c) => {
  const denied = await requireOperator(c);
  if (denied) return denied;

  const slug = farmSlugFromQuery(c);
  const farm = await getFarmBySlug(c.env.DB, slug);
  if (!farm) return c.json({ error: "farm_not_found", slug }, 404);

  const window = defaultLedgerWindow();
  const from = c.req.query("from") || window.from;
  const to = c.req.query("to") || window.to;

  const summary = await farmLedgerSummary(c.env.DB, farm.id, from, to);

  return c.json({
    farm_id: farm.id,
    slug: farm.slug,
    ...summary,
  });
});

ledgerApi.get("/v1/ledger", async (c) => {
  const denied = await requireOperator(c);
  if (denied) return denied;

  const slug = farmSlugFromQuery(c);
  const farm = await getFarmBySlug(c.env.DB, slug);
  if (!farm) return c.json({ error: "farm_not_found", slug }, 404);

  const limit = Math.min(
    200,
    Math.max(1, Number(c.req.query("limit") || "50") || 50)
  );
  const from = c.req.query("from");
  const to = c.req.query("to");
  const kind = c.req.query("kind");
  const category = c.req.query("category");

  if (kind && !LedgerKindSchema.safeParse(kind).success) {
    return c.json({ error: "invalid_kind" }, 400);
  }
  if (category && !LedgerCategorySchema.safeParse(category).success) {
    return c.json({ error: "invalid_category" }, 400);
  }

  let sql = `SELECT id, farm_id, ts, kind, category, amount_cents, currency, note, r2_key
             FROM ledger WHERE farm_id = ?`;
  const binds: (string | number)[] = [farm.id];
  if (from) {
    sql += ` AND ts >= ?`;
    binds.push(from);
  }
  if (to) {
    sql += ` AND ts <= ?`;
    binds.push(to);
  }
  if (kind) {
    sql += ` AND kind = ?`;
    binds.push(kind);
  }
  if (category) {
    sql += ` AND category = ?`;
    binds.push(category);
  }
  sql += ` ORDER BY ts DESC LIMIT ?`;
  binds.push(limit);

  const { results } = await c.env.DB.prepare(sql).bind(...binds).all<LedgerRow>();

  return c.json({
    farm_id: farm.id,
    slug: farm.slug,
    entries: (results ?? []).map(withReceiptUrl),
  });
});

ledgerApi.get("/v1/ledger/:id", async (c) => {
  const denied = await requireOperator(c);
  if (denied) return denied;

  const id = c.req.param("id");
  const row = await c.env.DB.prepare(
    `SELECT id, farm_id, ts, kind, category, amount_cents, currency, note, r2_key
     FROM ledger WHERE id = ?`
  )
    .bind(id)
    .first<LedgerRow>();

  if (!row) return c.json({ error: "ledger_not_found" }, 404);
  return c.json(withReceiptUrl(row));
});

ledgerApi.post("/v1/ledger", async (c) => {
  const denied = await requireOperator(c);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }

  const parsed = CreateLedgerSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "validation", details: parsed.error.flatten() }, 400);
  }

  if (parsed.data.currency && parsed.data.currency !== "EUR") {
    return c.json({ error: "currency_must_be_eur" }, 400);
  }

  const amount_cents = resolveCents(
    parsed.data.amount_cents,
    parsed.data.amount_eur
  );
  if (amount_cents == null || amount_cents < 1) {
    return c.json({ error: "invalid_amount" }, 400);
  }

  const farm = await getFarmBySlug(c.env.DB, parsed.data.farm_slug);
  if (!farm) {
    return c.json({ error: "farm_not_found", slug: parsed.data.farm_slug }, 404);
  }

  const id = crypto.randomUUID();
  const ts = parsed.data.ts || new Date().toISOString();
  const entry: LedgerEntry = {
    id,
    farm_id: farm.id,
    ts,
    kind: parsed.data.kind,
    category: parsed.data.category ?? null,
    amount_cents,
    currency: "EUR",
    note: parsed.data.note ?? null,
    r2_key: null,
  };

  await c.env.DB.prepare(
    `INSERT INTO ledger (id, farm_id, ts, kind, category, amount_cents, currency, note, r2_key)
     VALUES (?, ?, ?, ?, ?, ?, 'EUR', ?, NULL)`
  )
    .bind(
      entry.id,
      entry.farm_id,
      entry.ts,
      entry.kind,
      entry.category,
      entry.amount_cents,
      entry.note
    )
    .run();

  await writeAudit(c.env.DB, {
    farm_id: farm.id,
    actor: "user:operator",
    action: "ledger.create",
    entity: `ledger:${id}`,
    after: entry,
  });

  return c.json(
    withReceiptUrl({
      ...entry,
      category: entry.category ?? null,
      note: entry.note ?? null,
      r2_key: null,
    }),
    201
  );
});

ledgerApi.patch("/v1/ledger/:id", async (c) => {
  const denied = await requireOperator(c);
  if (denied) return denied;

  const id = c.req.param("id");
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }

  const parsed = PatchLedgerSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "validation", details: parsed.error.flatten() }, 400);
  }

  const before = await c.env.DB.prepare(
    `SELECT id, farm_id, ts, kind, category, amount_cents, currency, note, r2_key
     FROM ledger WHERE id = ?`
  )
    .bind(id)
    .first<LedgerRow>();

  if (!before) return c.json({ error: "ledger_not_found" }, 404);

  let amount_cents = before.amount_cents;
  if (
    parsed.data.amount_cents !== undefined ||
    parsed.data.amount_eur !== undefined
  ) {
    const next = resolveCents(
      parsed.data.amount_cents,
      parsed.data.amount_eur
    );
    if (next == null || next < 1) {
      return c.json({ error: "invalid_amount" }, 400);
    }
    amount_cents = next;
  }

  const next: LedgerRow = {
    id: before.id,
    farm_id: before.farm_id,
    ts: parsed.data.ts ?? before.ts,
    kind: parsed.data.kind ?? before.kind,
    category:
      parsed.data.category !== undefined
        ? parsed.data.category
        : before.category,
    amount_cents,
    currency: "EUR",
    note: parsed.data.note !== undefined ? parsed.data.note : before.note,
    r2_key: before.r2_key,
  };

  await c.env.DB.prepare(
    `UPDATE ledger
     SET ts = ?, kind = ?, category = ?, amount_cents = ?, note = ?
     WHERE id = ?`
  )
    .bind(next.ts, next.kind, next.category, next.amount_cents, next.note, id)
    .run();

  await writeAudit(c.env.DB, {
    farm_id: before.farm_id,
    actor: "user:operator",
    action: "ledger.patch",
    entity: `ledger:${id}`,
    before,
    after: next,
  });

  return c.json(withReceiptUrl(next));
});

ledgerApi.delete("/v1/ledger/:id", async (c) => {
  const denied = await requireOperator(c);
  if (denied) return denied;

  const id = c.req.param("id");
  const before = await c.env.DB.prepare(
    `SELECT id, farm_id, ts, kind, category, amount_cents, currency, note, r2_key
     FROM ledger WHERE id = ?`
  )
    .bind(id)
    .first<LedgerRow>();

  if (!before) return c.json({ error: "ledger_not_found" }, 404);

  if (before.r2_key) {
    try {
      await c.env.MEDIA.delete(before.r2_key);
    } catch {
      /* best-effort */
    }
  }

  await c.env.DB.prepare(`DELETE FROM ledger WHERE id = ?`).bind(id).run();

  await writeAudit(c.env.DB, {
    farm_id: before.farm_id,
    actor: "user:operator",
    action: "ledger.delete",
    entity: `ledger:${id}`,
    before,
  });

  return c.json({ ok: true, id });
});

ledgerApi.post("/v1/ledger/:id/receipt", async (c) => {
  const denied = await requireOperator(c);
  if (denied) return denied;

  const id = c.req.param("id");
  const row = await c.env.DB.prepare(
    `SELECT id, farm_id, ts, kind, category, amount_cents, currency, note, r2_key
     FROM ledger WHERE id = ?`
  )
    .bind(id)
    .first<LedgerRow>();

  if (!row) return c.json({ error: "ledger_not_found" }, 404);

  const farm = await c.env.DB.prepare(
    `SELECT id, slug FROM farms WHERE id = ?`
  )
    .bind(row.farm_id)
    .first<{ id: string; slug: string }>();

  if (!farm) return c.json({ error: "farm_not_found" }, 404);

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
  let contentType = fileType;
  let ext = "bin";

  if (
    fileType === "image/jpeg" ||
    fileType === "image/jpg" ||
    (!fileType && (fileName.endsWith(".jpg") || fileName.endsWith(".jpeg")))
  ) {
    contentType = "image/jpeg";
    ext = "jpg";
  } else if (fileType === "image/png" || (!fileType && fileName.endsWith(".png"))) {
    contentType = "image/png";
    ext = "png";
  } else if (
    fileType === "image/webp" ||
    (!fileType && fileName.endsWith(".webp"))
  ) {
    contentType = "image/webp";
    ext = "webp";
  } else if (
    fileType === "application/pdf" ||
    (!fileType && fileName.endsWith(".pdf"))
  ) {
    contentType = "application/pdf";
    ext = "pdf";
  } else if (!RECEIPT_TYPES.has(fileType)) {
    return c.json(
      {
        error: "unsupported_type",
        allowed: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
      },
      400
    );
  }

  if (file.size > RECEIPT_MAX) {
    return c.json({ error: "file_too_large", max_bytes: RECEIPT_MAX }, 400);
  }

  if (row.r2_key && row.r2_key !== `${farm.slug}/ledger/${id}.${ext}`) {
    try {
      await c.env.MEDIA.delete(row.r2_key);
    } catch {
      /* best-effort */
    }
  }

  const r2_key = `${farm.slug}/ledger/${id}.${ext}`;
  const bytes = await file.arrayBuffer();
  await c.env.MEDIA.put(r2_key, bytes, {
    httpMetadata: { contentType },
    customMetadata: { ledger_id: id, farm_id: farm.id },
  });

  await c.env.DB.prepare(`UPDATE ledger SET r2_key = ? WHERE id = ?`)
    .bind(r2_key, id)
    .run();

  await writeAudit(c.env.DB, {
    farm_id: row.farm_id,
    actor: "user:operator",
    action: "ledger.receipt",
    entity: `ledger:${id}`,
    before: { r2_key: row.r2_key },
    after: { r2_key, content_type: contentType },
  });

  return c.json(
    {
      ok: true,
      id,
      r2_key,
      content_type: contentType,
      receipt_url: `/v1/ledger/${id}/receipt`,
    },
    201
  );
});

ledgerApi.get("/v1/ledger/:id/receipt", async (c) => {
  const denied = await requireOperator(c);
  if (denied) return denied;

  const id = c.req.param("id");
  const row = await c.env.DB.prepare(
    `SELECT id, r2_key FROM ledger WHERE id = ?`
  )
    .bind(id)
    .first<{ id: string; r2_key: string | null }>();

  if (!row) return c.json({ error: "ledger_not_found" }, 404);
  if (!row.r2_key) return c.json({ error: "receipt_not_found" }, 404);

  const obj = await c.env.MEDIA.get(row.r2_key);
  if (!obj) return c.json({ error: "object_missing" }, 404);

  const headers = new Headers();
  headers.set(
    "Content-Type",
    obj.httpMetadata?.contentType || "application/octet-stream"
  );
  headers.set("Cache-Control", "private, max-age=3600");
  return new Response(obj.body, { headers });
});
