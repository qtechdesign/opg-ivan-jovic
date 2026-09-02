import { localDateInTz } from "./energy";
import { eurosToCents } from "./money";

export type BuildPhase = {
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
};

export type PlanTask = {
  id: string;
  farm_id: string;
  phase_id: string | null;
  title: string;
  body: string | null;
  status: string;
  due_on: string | null;
  sort: number;
  created_at: string;
  updated_at: string;
};

export type PlanOrder = {
  id: string;
  farm_id: string;
  phase_id: string | null;
  task_id: string | null;
  title: string;
  vendor: string | null;
  url: string | null;
  qty: number;
  unit_cents: number;
  amount_cents: number;
  currency: string;
  status: string;
  due_on: string | null;
  notes: string | null;
  source: string;
  created_at: string;
  updated_at: string;
};

export type PlanEvent = {
  id: string;
  kind: "phase" | "task" | "order";
  title: string;
  start: string;
  end: string | null;
  status: string;
};

export const BUILD_PHASE_STATUSES = ["planned", "active", "done"] as const;
export const PLAN_TASK_STATUSES = ["todo", "doing", "done", "blocked"] as const;
export const PLAN_ORDER_STATUSES = [
  "research",
  "quoted",
  "ordered",
  "received",
  "cancelled",
] as const;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isoDateOrNull(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim().slice(0, 10);
  if (!s) return null;
  return ISO_DATE.test(s) ? s : null;
}

export async function listBuildPhases(
  db: D1Database,
  farmId: string
): Promise<BuildPhase[]> {
  const { results } = await db
    .prepare(
      `SELECT id, farm_id, title, body, starts_on, ends_on, amount_cents, currency, status, sort, created_at
       FROM build_phases WHERE farm_id = ? ORDER BY sort, starts_on, title`
    )
    .bind(farmId)
    .all<BuildPhase>();
  return results ?? [];
}

export async function listPlanTasks(
  db: D1Database,
  farmId: string
): Promise<PlanTask[]> {
  try {
    const { results } = await db
      .prepare(
        `SELECT id, farm_id, phase_id, title, body, status, due_on, sort, created_at, updated_at
         FROM plan_tasks WHERE farm_id = ? ORDER BY status, due_on, sort, title`
      )
      .bind(farmId)
      .all<PlanTask>();
    return results ?? [];
  } catch {
    return [];
  }
}

export async function listPlanOrders(
  db: D1Database,
  farmId: string
): Promise<PlanOrder[]> {
  try {
    const { results } = await db
      .prepare(
        `SELECT id, farm_id, phase_id, task_id, title, vendor, url, qty, unit_cents, amount_cents,
                currency, status, due_on, notes, source, created_at, updated_at
         FROM plan_orders WHERE farm_id = ? ORDER BY status, due_on, title`
      )
      .bind(farmId)
      .all<PlanOrder>();
    return results ?? [];
  } catch {
    return [];
  }
}

export function planTotals(phases: BuildPhase[]): {
  amount_cents: number;
  planned: number;
  active: number;
  done: number;
} {
  let amount_cents = 0;
  let planned = 0;
  let active = 0;
  let done = 0;
  for (const p of phases) {
    amount_cents += p.amount_cents || 0;
    if (p.status === "done") done += 1;
    else if (p.status === "active") active += 1;
    else planned += 1;
  }
  return { amount_cents, planned, active, done };
}

export function orderTotals(orders: PlanOrder[]): {
  amount_cents: number;
  research: number;
  quoted: number;
  ordered: number;
  received: number;
} {
  let amount_cents = 0;
  let research = 0;
  let quoted = 0;
  let ordered = 0;
  let received = 0;
  for (const o of orders) {
    if (o.status === "cancelled") continue;
    amount_cents += o.amount_cents || 0;
    if (o.status === "research") research += 1;
    else if (o.status === "quoted") quoted += 1;
    else if (o.status === "ordered") ordered += 1;
    else if (o.status === "received") received += 1;
  }
  return { amount_cents, research, quoted, ordered, received };
}

export function planWhere(
  phases: BuildPhase[],
  tasks: PlanTask[],
  orders: PlanOrder[],
  timezone: string,
  now = new Date()
) {
  const today = localDateInTz(now, timezone);
  const openTasks = tasks.filter((t) => t.status !== "done");
  const overdue = openTasks.filter((t) => t.due_on && t.due_on < today);
  const dueSoon = openTasks.filter(
    (t) => t.due_on && t.due_on >= today && t.due_on <= addDaysIso(today, 14)
  );
  return {
    today,
    timezone,
    active_phases: phases
      .filter((p) => p.status === "active")
      .map((p) => ({ id: p.id, title: p.title, starts_on: p.starts_on, ends_on: p.ends_on })),
    open_tasks: openTasks.length,
    overdue_tasks: overdue.map((t) => ({
      id: t.id,
      title: t.title,
      due_on: t.due_on,
      status: t.status,
    })),
    due_soon: dueSoon.map((t) => ({
      id: t.id,
      title: t.title,
      due_on: t.due_on,
      status: t.status,
    })),
    orders_research: orders.filter((o) => o.status === "research").length,
    orders_quoted: orders.filter((o) => o.status === "quoted").length,
    orders_open: orders.filter((o) => o.status === "ordered").length,
  };
}

export function calendarEvents(
  phases: BuildPhase[],
  tasks: PlanTask[],
  orders: PlanOrder[]
): PlanEvent[] {
  const events: PlanEvent[] = [];
  for (const p of phases) {
    const start = p.starts_on || p.ends_on;
    if (!start) continue;
    events.push({
      id: `phase:${p.id}`,
      kind: "phase",
      title: p.title,
      start,
      end: p.ends_on,
      status: p.status,
    });
  }
  for (const t of tasks) {
    if (!t.due_on) continue;
    events.push({
      id: `task:${t.id}`,
      kind: "task",
      title: t.title,
      start: t.due_on,
      end: t.due_on,
      status: t.status,
    });
  }
  for (const o of orders) {
    if (!o.due_on || o.status === "cancelled") continue;
    events.push({
      id: `order:${o.id}`,
      kind: "order",
      title: o.title,
      start: o.due_on,
      end: o.due_on,
      status: o.status,
    });
  }
  events.sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title));
  return events;
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function icsDate(iso: string): string {
  return iso.replace(/-/g, "").slice(0, 8);
}

function icsEscape(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function nextDate(iso: string): string {
  return addDaysIso(iso, 1);
}

export function renderPlanIcs(opts: {
  farmName: string;
  slug: string;
  origin: string;
  events: PlanEvent[];
}): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Polje//Plan//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsEscape(`${opts.farmName} plan`)}`,
  ];
  for (const ev of opts.events) {
    const end = ev.end && ev.end >= ev.start ? nextDate(ev.end) : nextDate(ev.start);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${icsEscape(ev.id)}@${opts.slug}.polje`,
      `DTSTAMP:${icsDate(ev.start)}T000000Z`,
      `DTSTART;VALUE=DATE:${icsDate(ev.start)}`,
      `DTEND;VALUE=DATE:${icsDate(end)}`,
      `SUMMARY:${icsEscape(ev.title)}`,
      `CATEGORIES:${ev.kind}`,
      `STATUS:${ev.status === "done" || ev.status === "received" ? "CONFIRMED" : "TENTATIVE"}`,
      `URL:${opts.origin}/plan`,
      "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}

export async function planBoard(
  db: D1Database,
  farmId: string,
  timezone: string
) {
  const phases = await listBuildPhases(db, farmId);
  const tasks = await listPlanTasks(db, farmId);
  const orders = await listPlanOrders(db, farmId);
  return {
    phases,
    tasks,
    orders,
    totals: planTotals(phases),
    order_totals: orderTotals(orders),
    where: planWhere(phases, tasks, orders, timezone),
    events: calendarEvents(phases, tasks, orders),
  };
}

export async function insertPlanTask(
  db: D1Database,
  row: Omit<PlanTask, "created_at" | "updated_at"> & {
    created_at?: string;
    updated_at?: string;
  }
): Promise<PlanTask> {
  const now = new Date().toISOString();
  const created_at = row.created_at ?? now;
  const updated_at = row.updated_at ?? now;
  await db
    .prepare(
      `INSERT INTO plan_tasks (id, farm_id, phase_id, title, body, status, due_on, sort, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      row.id,
      row.farm_id,
      row.phase_id,
      row.title,
      row.body,
      row.status,
      row.due_on,
      row.sort,
      created_at,
      updated_at
    )
    .run();
  return { ...row, created_at, updated_at };
}

export async function insertPlanOrder(
  db: D1Database,
  row: Omit<PlanOrder, "created_at" | "updated_at"> & {
    created_at?: string;
    updated_at?: string;
  }
): Promise<PlanOrder> {
  const now = new Date().toISOString();
  const created_at = row.created_at ?? now;
  const updated_at = row.updated_at ?? now;
  await db
    .prepare(
      `INSERT INTO plan_orders
         (id, farm_id, phase_id, task_id, title, vendor, url, qty, unit_cents, amount_cents,
          currency, status, due_on, notes, source, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      row.id,
      row.farm_id,
      row.phase_id,
      row.task_id,
      row.title,
      row.vendor,
      row.url,
      row.qty,
      row.unit_cents,
      row.amount_cents,
      row.currency,
      row.status,
      row.due_on,
      row.notes,
      row.source,
      created_at,
      updated_at
    )
    .run();
  return { ...row, created_at, updated_at };
}

export function amountFromQuote(opts: {
  qty: number;
  amount_eur?: number | null;
  unit_cents?: number | null;
}): { qty: number; unit_cents: number; amount_cents: number } {
  const qty = Number.isFinite(opts.qty) && opts.qty > 0 ? opts.qty : 1;
  const amount_cents =
    opts.amount_eur != null
      ? eurosToCents(Number(opts.amount_eur) || 0)
      : Math.round((opts.unit_cents || 0) * qty);
  const unit_cents =
    opts.unit_cents != null
      ? Math.round(opts.unit_cents)
      : qty > 0
        ? Math.round(amount_cents / qty)
        : amount_cents;
  return { qty, unit_cents, amount_cents };
}
