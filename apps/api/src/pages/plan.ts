import type { Context } from "hono";
import {
  bootScripts,
  escapeHtml,
  pageOpen,
  shareHead,
} from "../lib/html";
import { farmFromRequest } from "../lib/farm";
import { OPERATOR_GATE_HTML, OPERATOR_SESSION_JS } from "../lib/operator-ui";
import { weatherNow } from "../lib/weather";
import { formatEur } from "../lib/money";
import { listBuildPhases, planTotals, type BuildPhase } from "../lib/plan";
import { IVAN_JOVIC_TRELLO_URL, trelloBoardIdForSlug } from "../lib/trello";

type AppEnv = { Bindings: Cloudflare.Env };

function whenLabel(p: BuildPhase): string {
  const a = (p.starts_on || "").slice(0, 10);
  const b = (p.ends_on || "").slice(0, 10);
  if (a && b) return `${a} → ${b}`;
  return a || b || "—";
}

export async function renderPlan(c: Context<AppEnv>) {
  const { farm, defaultSlug } = await farmFromRequest(c);
  if (!farm) {
    return c.html(
      `<!DOCTYPE html><html lang="en"><body><p>Farm not seeded.</p></body></html>`,
      503
    );
  }

  let phases: BuildPhase[] = [];
  try {
    phases = await listBuildPhases(c.env.DB, farm.id);
  } catch {
    phases = [];
  }
  const totals = planTotals(phases);
  const wxSkin = weatherNow(farm.timezone, null);
  const trelloUrl = trelloBoardIdForSlug(farm.slug) ? IVAN_JOVIC_TRELLO_URL : null;

  const listHtml =
    phases.length === 0
      ? `<li class="dim" data-i18n="plan_empty">No phases yet.</li>`
      : phases
          .map((p) => {
            const eur =
              p.amount_cents > 0 ? formatEur(p.amount_cents) : "TBD";
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
      "Build and procurement phases. Time + EUR. Public."
    ),
    solar: wxSkin.solar,
    wx: wxSkin.wx,
  })}
  <main>
    <h1 data-i18n="plan_title">Plan</h1>
    <p class="sub" data-i18n="plan_sub">Build phases · time + EUR · public</p>
    <p class="hint" data-i18n="plan_howto">This is the procurement and works timeline. Anyone can read it. Sign in to add or change a phase. Amounts are integer cents EUR. Write a reason and tick confirm — same rule as water and frost.</p>

    ${OPERATOR_GATE_HTML}

    <div class="metrics">
      <div class="metric"><div class="n">${phases.length}</div><div class="l" data-i18n="plan_title">Plan</div></div>
      <div class="metric"><div class="n">${totals.active}</div><div class="l" data-i18n="plan_active">active</div></div>
      <div class="metric"><div class="n">${totals.done}</div><div class="l" data-i18n="plan_done">done</div></div>
      <div class="metric"><div class="n">${totals.amount_cents > 0 ? escapeHtml(formatEur(totals.amount_cents)) : "—"}</div><div class="l" data-i18n="plan_totals">Envelope</div></div>
    </div>

    <section class="panel">
      <h2 data-i18n="plan_title">Plan</h2>
      <ul class="timeline">${listHtml}</ul>
    </section>

    ${trelloUrl ? `<section class="panel">
      <h2 data-i18n="home_trello_title">Public Trello</h2>
      <p class="hint" data-i18n="home_trello_hint">Follow the same work on the public board. Polje reads lists; writes stay on Trello.</p>
      <div id="trello-live" class="trello-cols"></div>
      <p class="actions"><a class="btn-ghost" href="${trelloUrl}" rel="noreferrer" data-i18n="home_trello_open">Open board</a></p>
    </section>` : ""}

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
        <div class="actions"><button class="btn-ghost" type="submit" data-i18n="plan_save">Save phase</button></div>
        <div class="msg" id="msg"></div>
      </form>
    </section>
  </main>
  </div>
  ${bootScripts(OPERATOR_SESSION_JS)}
  <script>
    document.getElementById("form-phase").onsubmit = async (e) => {
      e.preventDefault();
      const msg = document.getElementById("msg");
      msg.textContent = "";
      msg.className = "msg";
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
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (data.proposal) {
          msg.textContent = data.hint || t("water_proposal");
          return;
        }
        if (!res.ok) {
          msg.className = "msg err";
          msg.textContent = data.error || ("HTTP " + res.status);
          return;
        }
        msg.textContent = t("plan_saved");
        setTimeout(() => location.reload(), 500);
      } catch (err) {
        msg.className = "msg err";
        msg.textContent = String(err);
      }
    };
    opRefreshGate();
    (function trelloLive() {
      const host = document.getElementById("trello-live");
      if (!host) return;
      function esc(s) {
        return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
      }
      fetch("/v1/trello?farm=" + encodeURIComponent(FARM))
        .then((r) => r.json())
        .then((data) => {
          const lists = (data.board && data.board.lists) || [];
          const cols = lists.filter((l) => (l.cards || []).length).slice(0, 4);
          if (!cols.length) return;
          host.innerHTML = cols
            .map((l) => {
              const cards = (l.cards || [])
                .slice(0, 6)
                .map((c) => '<li class="row"><a href="' + esc(c.url) + '" rel="noreferrer">' + esc(c.name) + "</a></li>")
                .join("");
              return '<div class="trello-col"><h3>' + esc(l.name) + "</h3><ul>" + cards + "</ul></div>";
            })
            .join("");
        })
        .catch(() => {});
    })();
  </script>
</body>
</html>`);
}
