import type { Context } from "hono";
import {
  bootScripts,
  escapeHtml,
  pageOpen,
  shareHead,
  TRELLO_LIVE_JS,
} from "../lib/html";
import { farmFromRequest } from "../lib/farm";
import { weatherNow } from "../lib/weather";
import { formatEur } from "../lib/money";
import { localDateInTz } from "../lib/energy";
import {
  planBoard,
  type BuildPhase,
  type PlanOrder,
  type PlanTask,
} from "../lib/plan";
import { IVAN_JOVIC_TRELLO_URL, trelloBoardIdForSlug } from "../lib/trello";

type AppEnv = { Bindings: Cloudflare.Env };

function whenLabel(p: BuildPhase): string {
  const a = (p.starts_on || "").slice(0, 10);
  const b = (p.ends_on || "").slice(0, 10);
  if (a && b) return `${a} → ${b}`;
  return a || b || "—";
}

function phaseOptions(phases: BuildPhase[]): string {
  return `<option value="">—</option>${phases
    .map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.title)}</option>`)
    .join("")}`;
}

function tasksHtml(tasks: PlanTask[], status: string): string {
  const rows = tasks.filter((t) =>
    status === "todo" ? t.status === "todo" || t.status === "blocked" : t.status === status
  );
  if (!rows.length) return `<p class="dim">—</p>`;
  return rows
    .map((t) => {
      const due = t.due_on ? escapeHtml(t.due_on) : "";
      return `<div class="kanban-card" data-id="${escapeHtml(t.id)}">
        <span><strong>${escapeHtml(t.title)}</strong>${t.body ? `<div class="hint">${escapeHtml(t.body)}</div>` : ""}${due ? `<div class="meta">${due}</div>` : ""}</span>
        <span class="admin-only actions" style="margin:0">
          ${t.status !== "todo" ? `<button type="button" class="btn-ghost btn-task" data-id="${escapeHtml(t.id)}" data-status="todo">Todo</button>` : ""}
          ${t.status !== "doing" ? `<button type="button" class="btn-ghost btn-task" data-id="${escapeHtml(t.id)}" data-status="doing">Doing</button>` : ""}
          ${t.status !== "done" ? `<button type="button" class="btn-ghost btn-task" data-id="${escapeHtml(t.id)}" data-status="done">Done</button>` : ""}
        </span>
      </div>`;
    })
    .join("");
}

function ordersHtml(orders: PlanOrder[]): string {
  if (!orders.length) return `<p class="dim" data-i18n="plan_orders_empty">No procurement lines yet.</p>`;
  return orders
    .map((o) => {
      const eur = o.amount_cents > 0 ? formatEur(o.amount_cents) : "TBD";
      const link = o.url
        ? `<a href="${escapeHtml(o.url)}" rel="noreferrer">${escapeHtml(o.vendor || o.title)}</a>`
        : escapeHtml(o.vendor || "—");
      return `<div class="order-row">
        <span><strong>${escapeHtml(o.title)}</strong><div class="meta">${escapeHtml(o.status)} · ${link}${o.due_on ? ` · ${escapeHtml(o.due_on)}` : ""}</div></span>
        <span class="eur">${escapeHtml(eur)}</span>
      </div>`;
    })
    .join("");
}

export async function renderPlan(c: Context<AppEnv>) {
  const { farm, defaultSlug } = await farmFromRequest(c);
  if (!farm) {
    return c.html(
      `<!DOCTYPE html><html lang="en"><body><p>Farm not seeded.</p></body></html>`,
      503
    );
  }

  let board;
  try {
    board = await planBoard(c.env.DB, farm.id, farm.timezone);
  } catch {
    board = {
      phases: [] as BuildPhase[],
      tasks: [] as PlanTask[],
      orders: [] as PlanOrder[],
      totals: { amount_cents: 0, planned: 0, active: 0, done: 0 },
      order_totals: { amount_cents: 0, research: 0, quoted: 0, ordered: 0, received: 0 },
      where: {
        today: localDateInTz(new Date(), farm.timezone),
        timezone: farm.timezone,
        active_phases: [],
        open_tasks: 0,
        overdue_tasks: [] as Array<{ id: string; title: string; due_on: string | null; status: string }>,
        due_soon: [] as Array<{ id: string; title: string; due_on: string | null; status: string }>,
        orders_research: 0,
        orders_quoted: 0,
        orders_open: 0,
      },
      events: [],
    };
  }

  const { phases, tasks, orders, totals, order_totals, where, events } = board;
  const wxSkin = weatherNow(farm.timezone, null);
  const trelloUrl = trelloBoardIdForSlug(farm.slug) ? IVAN_JOVIC_TRELLO_URL : null;
  const icsHref = `/v1/plan/calendar.ics?farm=${encodeURIComponent(farm.slug)}`;

  const listHtml =
    phases.length === 0
      ? `<li class="dim" data-i18n="plan_empty">No phases yet.</li>`
      : phases
          .map((p) => {
            const eur = p.amount_cents > 0 ? formatEur(p.amount_cents) : "TBD";
            return `<li class="phase" data-id="${escapeHtml(p.id)}">
        <div class="when">${escapeHtml(whenLabel(p))}<div class="st ${escapeHtml(p.status)}">${escapeHtml(p.status)}</div></div>
        <div>
          <span class="name">${escapeHtml(p.title)}</span>
          ${p.body ? `<div class="hint" style="margin:4px 0 0">${escapeHtml(p.body)}</div>` : ""}
        </div>
        <span class="eur">${escapeHtml(eur)}</span>
      </li>`;
          })
          .join("");

  const whereBits = [
    where.active_phases.length
      ? `Active: ${where.active_phases.map((p) => p.title).join(", ")}`
      : "No active phase",
    `${where.open_tasks} open tasks`,
    where.overdue_tasks.length ? `${where.overdue_tasks.length} overdue` : "none overdue",
    `${where.orders_research} research / ${where.orders_open} ordered`,
  ].join(" · ");

  return c.html(`${pageOpen({
    title: "POLJE · Plan",
    farmName: farm.name,
    farmSlug: farm.slug,
    defaultSlug,
    currentPath: "/plan",
    pipHtml: `<span class="pip ok">PLAN</span>`,
    extraHead: shareHead(
      c.req.url,
      "POLJE · Plan",
      "Build, todos, procurement, calendar. Time + EUR. Public."
    ),
    solar: wxSkin.solar,
    wx: wxSkin.wx,
  })}
  <main>
    <h1 data-i18n="plan_title">Plan</h1>
    <p class="sub" data-i18n="plan_sub">Big picture · todos · procurement · calendar</p>
    <p class="hint" data-i18n="plan_howto">Public board for the farm: phases (time + EUR envelope), a todo list, and procurement research. Amounts are integer cents EUR, not quotes. Sign in to write. Committing an order needs confirm + reason — same rule as water. Grok can research prices and propose tasks; it cannot confirm spend.</p>
    <p class="hint">${escapeHtml(whereBits)}</p>

    <div class="metrics">
      <div class="metric"><div class="n">${phases.length}</div><div class="l" data-i18n="plan_title">Plan</div></div>
      <div class="metric"><div class="n">${totals.active}</div><div class="l" data-i18n="plan_active">active</div></div>
      <div class="metric"><div class="n">${where.open_tasks}</div><div class="l" data-i18n="plan_tasks">tasks</div></div>
      <div class="metric"><div class="n">${order_totals.amount_cents > 0 ? escapeHtml(formatEur(order_totals.amount_cents)) : "—"}</div><div class="l" data-i18n="plan_orders">Procurement</div></div>
    </div>

    <section class="panel">
      <h2 data-i18n="plan_big">Big picture</h2>
      <ul class="timeline">${listHtml}</ul>
    </section>

    <section class="panel">
      <h2 data-i18n="plan_tasks">Todos</h2>
      <div class="kanban">
        <div class="kanban-col"><h3 data-i18n="plan_todo">Todo</h3>${tasksHtml(tasks, "todo")}</div>
        <div class="kanban-col"><h3 data-i18n="plan_doing">Doing</h3>${tasksHtml(tasks, "doing")}</div>
        <div class="kanban-col"><h3 data-i18n="plan_task_done">Done</h3>${tasksHtml(tasks, "done")}</div>
      </div>
    </section>

    <section class="panel">
      <h2 data-i18n="plan_orders">Procurement</h2>
      <p class="hint" data-i18n="plan_orders_hint">Research and quotes first. Ordered/received needs confirm. Not a ledger posting until you book it in Knjiga.</p>
      ${ordersHtml(orders)}
    </section>

    <section class="panel">
      <h2 data-i18n="plan_cal">Calendar</h2>
      <p class="hint"><a href="${icsHref}" data-i18n="plan_ics">Subscribe (ICS)</a> — Google / Apple / Outlook. Dates are farm-local Europe/Zagreb all-day events.</p>
      <div class="cal-nav">
        <button type="button" class="btn-ghost" id="cal-prev">←</button>
        <strong id="cal-label"></strong>
        <button type="button" class="btn-ghost" id="cal-next">→</button>
      </div>
      <div class="cal-grid" id="cal-grid"></div>
    </section>

    ${trelloUrl ? `<section class="panel">
      <h2 data-i18n="home_trello_title">Public Trello</h2>
      <p class="hint" data-i18n="home_trello_hint">Follow the same work on the public board. Polje reads lists and card pictures; writes stay on Trello.</p>
      <div id="trello-live" class="trello-cols"></div>
      <p class="actions"><a class="btn-ghost" href="${trelloUrl}" rel="noreferrer" data-i18n="home_trello_open">Open board</a></p>
    </section>` : ""}

    <section class="panel admin-only">
      <h2 data-i18n="plan_new_task">New todo</h2>
      <form id="form-task">
        <label for="task-title" data-i18n="plan_title_field">Title</label>
        <input id="task-title" required maxlength="200" />
        <label for="task-body" data-i18n="plan_body">Note</label>
        <textarea id="task-body" maxlength="2000"></textarea>
        <div class="grid2">
          <div>
            <label for="task-due" data-i18n="plan_due">Due</label>
            <input id="task-due" type="date" />
          </div>
          <div>
            <label for="task-phase" data-i18n="plan_phase">Phase</label>
            <select id="task-phase">${phaseOptions(phases)}</select>
          </div>
        </div>
        <div class="actions"><button class="btn-primary" type="submit" data-i18n="plan_save_task">Save todo</button></div>
        <div class="msg" id="task-msg"></div>
      </form>
    </section>

    <section class="panel admin-only">
      <h2 data-i18n="plan_new_order">New procurement line</h2>
      <form id="form-order">
        <label for="order-title" data-i18n="plan_title_field">Title</label>
        <input id="order-title" required maxlength="200" />
        <div class="grid2">
          <div>
            <label for="order-vendor" data-i18n="plan_vendor">Vendor</label>
            <input id="order-vendor" maxlength="120" />
          </div>
          <div>
            <label for="order-url">URL</label>
            <input id="order-url" type="url" maxlength="2000" />
          </div>
        </div>
        <div class="grid2">
          <div>
            <label for="order-amount" data-i18n="plan_amount">Amount (EUR)</label>
            <input id="order-amount" type="number" step="0.01" min="0" placeholder="0" />
          </div>
          <div>
            <label for="order-due" data-i18n="plan_due">Due</label>
            <input id="order-due" type="date" />
          </div>
        </div>
        <label for="order-status" data-i18n="plan_status">Status</label>
        <select id="order-status">
          <option value="research">research</option>
          <option value="quoted">quoted</option>
          <option value="ordered">ordered</option>
        </select>
        <label for="order-reason" data-i18n="plan_reason">Reason (if ordered)</label>
        <input id="order-reason" maxlength="500" />
        <label class="check"><input id="order-confirm" type="checkbox" /> confirm: true</label>
        <div class="actions"><button class="btn-primary" type="submit" data-i18n="plan_save_order">Save line</button></div>
        <div class="msg" id="order-msg"></div>
      </form>
    </section>

    <section class="panel admin-only">
      <h2 data-i18n="plan_research">Price research</h2>
      <p class="hint" data-i18n="plan_research_hint">Grok searches the web from the Worker. Results are notes — tick save to drop them into procurement as research.</p>
      <form id="form-research">
        <label for="research-q" data-i18n="plan_research_q">What to buy</label>
        <input id="research-q" required maxlength="400" placeholder="HDPE pond liner 1 mm 500 m² Croatia" />
        <label class="check"><input id="research-save" type="checkbox" /> save as research lines</label>
        <div class="actions"><button class="btn-ghost" type="submit" data-i18n="plan_research_go">Research</button></div>
        <pre class="hint" id="research-out"></pre>
      </form>
    </section>

    <section class="panel admin-only">
      <h2 data-i18n="plan_new">New phase</h2>
      <form id="form-phase">
        <label for="title" data-i18n="plan_title_field">Title</label>
        <input id="title" required maxlength="200" />
        <label for="body" data-i18n="plan_body">Note</label>
        <textarea id="body" maxlength="2000"></textarea>
        <div class="grid2">
          <div>
            <label for="starts_on" data-i18n="plan_start">Start (ISO date)</label>
            <input id="starts_on" type="date" />
          </div>
          <div>
            <label for="ends_on" data-i18n="plan_end">End (ISO date)</label>
            <input id="ends_on" type="date" />
          </div>
        </div>
        <div class="grid2">
          <div>
            <label for="amount" data-i18n="plan_amount">Amount (EUR)</label>
            <input id="amount" type="number" step="0.01" min="0" placeholder="0" />
          </div>
          <div>
            <label for="status" data-i18n="plan_status">Status</label>
            <select id="status">
              <option value="planned" data-i18n="plan_planned">planned</option>
              <option value="active" data-i18n="plan_active">active</option>
              <option value="done" data-i18n="plan_done">done</option>
            </select>
          </div>
        </div>
        <label for="sort" data-i18n="plan_sort">Sort</label>
        <input id="sort" type="number" value="${phases.length + 1}" />
        <label for="reason" data-i18n="plan_reason">Reason (audit)</label>
        <input id="reason" required minlength="3" maxlength="500" data-i18n-placeholder="plan_reason_ph" placeholder="e.g. civil works quote from contractor" />
        <label class="check"><input id="confirm" type="checkbox" /> confirm: true</label>
        <div class="actions"><button class="btn-primary" type="submit" data-i18n="plan_save">Save phase</button></div>
        <div class="msg" id="msg"></div>
      </form>
    </section>
  </main>
  </div>
  ${bootScripts(TRELLO_LIVE_JS)}
  <script>
    const PLAN_EVENTS = ${JSON.stringify(events).replace(/</g, "\\u003c")};

    function jsonHeaders() { return { "Content-Type": "application/json" }; }
    function setMsg(el, text, err) {
      if (!el) return;
      el.textContent = text || "";
      el.className = "msg" + (err ? " err" : "");
    }

    document.getElementById("form-phase").onsubmit = async (e) => {
      e.preventDefault();
      const msg = document.getElementById("msg");
      const body = {
        title: document.getElementById("title").value.trim(),
        body: document.getElementById("body").value.trim(),
        starts_on: document.getElementById("starts_on").value,
        ends_on: document.getElementById("ends_on").value,
        amount_eur: Number(document.getElementById("amount").value || 0),
        status: document.getElementById("status").value,
        sort: Number(document.getElementById("sort").value || 0),
        reason: document.getElementById("reason").value.trim(),
        confirm: document.getElementById("confirm").checked,
      };
      try {
        const res = await fetch("/v1/plan", {
          method: "POST", credentials: "include", headers: jsonHeaders(),
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (data.proposal) { setMsg(msg, data.hint || t("water_proposal")); return; }
        if (!res.ok) { setMsg(msg, data.error || ("HTTP " + res.status), true); return; }
        setMsg(msg, t("plan_saved"));
        setTimeout(() => location.reload(), 400);
      } catch (err) { setMsg(msg, String(err), true); }
    };

    document.getElementById("form-task").onsubmit = async (e) => {
      e.preventDefault();
      const msg = document.getElementById("task-msg");
      const body = {
        title: document.getElementById("task-title").value.trim(),
        body: document.getElementById("task-body").value.trim(),
        due_on: document.getElementById("task-due").value,
        phase_id: document.getElementById("task-phase").value || undefined,
      };
      try {
        const res = await fetch("/v1/plan/tasks", {
          method: "POST", credentials: "include", headers: jsonHeaders(),
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) { setMsg(msg, data.error || ("HTTP " + res.status), true); return; }
        setMsg(msg, t("plan_saved"));
        setTimeout(() => location.reload(), 400);
      } catch (err) { setMsg(msg, String(err), true); }
    };

    document.querySelectorAll(".btn-task").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        const status = btn.getAttribute("data-status");
        await fetch("/v1/plan/tasks/" + id, {
          method: "PATCH", credentials: "include", headers: jsonHeaders(),
          body: JSON.stringify({ status }),
        });
        location.reload();
      });
    });

    document.getElementById("form-order").onsubmit = async (e) => {
      e.preventDefault();
      const msg = document.getElementById("order-msg");
      const body = {
        title: document.getElementById("order-title").value.trim(),
        vendor: document.getElementById("order-vendor").value.trim(),
        url: document.getElementById("order-url").value.trim(),
        amount_eur: Number(document.getElementById("order-amount").value || 0),
        due_on: document.getElementById("order-due").value,
        status: document.getElementById("order-status").value,
        reason: document.getElementById("order-reason").value.trim(),
        confirm: document.getElementById("order-confirm").checked,
      };
      try {
        const res = await fetch("/v1/plan/orders", {
          method: "POST", credentials: "include", headers: jsonHeaders(),
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (data.proposal) { setMsg(msg, data.hint || t("water_proposal")); return; }
        if (!res.ok) { setMsg(msg, data.error || ("HTTP " + res.status), true); return; }
        setMsg(msg, t("plan_saved"));
        setTimeout(() => location.reload(), 400);
      } catch (err) { setMsg(msg, String(err), true); }
    };

    document.getElementById("form-research").onsubmit = async (e) => {
      e.preventDefault();
      const out = document.getElementById("research-out");
      out.textContent = "…";
      try {
        const res = await fetch("/v1/plan/research", {
          method: "POST", credentials: "include", headers: jsonHeaders(),
          body: JSON.stringify({
            query: document.getElementById("research-q").value.trim(),
            save: document.getElementById("research-save").checked,
          }),
        });
        const data = await res.json();
        if (!res.ok) { out.textContent = data.error || ("HTTP " + res.status); return; }
        out.textContent = (data.quotes || []).map((q) =>
          (q.vendor || "") + " · " + (q.amount_eur != null ? q.amount_eur + " €" : "TBD") + " · " + (q.url || q.title)
        ).join("\\n") || data.raw || t("plan_saved");
        if (data.saved && data.saved.length) setTimeout(() => location.reload(), 800);
      } catch (err) { out.textContent = String(err); }
    };

    (function calendar() {
      const grid = document.getElementById("cal-grid");
      const label = document.getElementById("cal-label");
      if (!grid || !label) return;
      let cursor = new Date();
      cursor.setDate(1);
      function ymd(d) {
        return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
      }
      function draw() {
        const y = cursor.getFullYear();
        const m = cursor.getMonth();
        label.textContent = cursor.toLocaleString(undefined, { month: "long", year: "numeric" });
        const first = new Date(y, m, 1);
        const startPad = (first.getDay() + 6) % 7;
        const days = new Date(y, m + 1, 0).getDate();
        const cells = [];
        for (let i = 0; i < startPad; i++) cells.push('<div class="cal-cell"></div>');
        for (let day = 1; day <= days; day++) {
          const iso = y + "-" + String(m + 1).padStart(2, "0") + "-" + String(day).padStart(2, "0");
          const evs = PLAN_EVENTS.filter((e) => e.start <= iso && (e.end || e.start) >= iso).slice(0, 3);
          cells.push('<div class="cal-cell"><div class="d">' + day + "</div>" +
            evs.map((e) => '<span class="ev ' + e.kind + '">' + String(e.title).replace(/[<>]/g, "") + "</span>").join("") +
            "</div>");
        }
        grid.innerHTML = cells.join("");
      }
      document.getElementById("cal-prev").onclick = () => { cursor.setMonth(cursor.getMonth() - 1); draw(); };
      document.getElementById("cal-next").onclick = () => { cursor.setMonth(cursor.getMonth() + 1); draw(); };
      draw();
    })();
  </script>
</body>
</html>`);
}
