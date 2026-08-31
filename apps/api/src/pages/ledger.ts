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

type AppEnv = { Bindings: Cloudflare.Env };

export async function renderLedger(c: Context<AppEnv>) {
  try {
    return await renderLedgerPage(c);
  } catch (err) {
    console.error("renderLedger", err);
    const msg = err instanceof Error ? err.message : String(err);
    return c.html(
      `<!DOCTYPE html><html lang="en"><body><p>Ledger failed to render.</p><pre>${escapeHtml(msg)}</pre></body></html>`,
      500
    );
  }
}

async function renderLedgerPage(c: Context<AppEnv>) {
  const { farm, defaultSlug } = await farmFromRequest(c);

  if (!farm) {
    return c.html(
      `<!DOCTYPE html><html lang="en"><body><p>Farm not seeded.</p></body></html>`,
      503
    );
  }

  const wxSkin = weatherNow(farm.timezone, null);
  return c.html(`${pageOpen({
    title: "POLJE · Ledger",
    farmName: farm.name,
    farmSlug: farm.slug,
    defaultSlug,
    currentPath: "/ledger",
    pipHtml: `<span class="pip ok">LEDGER</span>`,
    extraHead: shareHead(c.req.url, "POLJE · Ledger", "Public cash flow of the OPG. EUR. Not a tax filing."),
    extraCss: `
  .metric .n { color: var(--soil); }
  .metric .n.pos { color: var(--leaf); }
  .metric .n.neg { color: var(--alarm); }
  .kind { font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; }
  .kind.expense { color: var(--alarm); }
  .kind.income { color: var(--leaf); }
  .kind.subsidy { color: var(--hay); }
  .kind.asset { color: var(--soil); }
  .month-table { width: 100%; border-collapse: collapse; font-size: 14px; }
  .month-table th, .month-table td {
    text-align: right; padding: 8px 10px; border-bottom: 1px solid var(--hairline);
    font-family: "IBM Plex Mono", ui-monospace, monospace;
  }
  .month-table th:first-child, .month-table td:first-child { text-align: left; }
  .month-table th {
    font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase;
    color: var(--spectral-dim); font-weight: 500; font-family: inherit;
  }
  .locked { color: var(--spectral-dim); }
  .receipt-link { font-size: 12px; color: var(--spacex-blue); }
  .no-print-hint { font-size: 12px; color: var(--spectral-dim); margin-top: 8px; }
  @media print {
    :root, html {
      --void: #f7f4ee;
      --void-soft: #f7f4ee;
      --spectral: #101218;
      --spectral-dim: #4a4a52;
      --hairline: rgba(16, 18, 24, 0.18);
      --ghost: #fff;
      --ghost-border: rgba(16, 18, 24, 0.25);
      --soil: #6b4a2e;
      --leaf: #2d6b38;
      --hay: #8a6a10;
      --alarm: #8a2a20;
    }
    body { background: #f7f4ee; color: #101218; }
    .topbar, .no-print, .pip, .lang-toggle { display: none !important; }
    .metric .n { color: #6b4a2e; }
    .btn-ghost, button, input, select, textarea, label, form, #token-panel, #op-gate { display: none !important; }
    .panel { background: #fff; border-color: rgba(16,18,24,0.2); break-inside: avoid; }
  }
`,
    solar: wxSkin.solar,
    wx: wxSkin.wx,
  })}
  <main>
    <h1 data-i18n="ledger_title">Ledger</h1>
    <p class="sub" data-i18n="ledger_sub">OPG operating book · EUR · not a tax filing</p>
    <p class="hint no-print" data-i18n="ledger_howto">Public cash flow of the OPG in EUR cents. Empty until money starts. Not a tax filing. Sign in to add income, expense, subsidy, or asset. Receipt files stay with the operator.</p>

    ${OPERATOR_GATE_HTML}
    <div class="actions no-print" style="margin-bottom:16px">
      <button type="button" class="btn-ghost" id="print-btn" data-i18n="ledger_print">Print</button>
    </div>

    <div class="metrics">
      <div class="metric"><div class="n pos" id="n-income">—</div><div class="l" data-i18n="ledger_income">Income</div></div>
      <div class="metric"><div class="n neg" id="n-expense">—</div><div class="l" data-i18n="ledger_expense">Expense</div></div>
      <div class="metric"><div class="n" id="n-subsidy">—</div><div class="l" data-i18n="ledger_subsidy">Subsidy</div></div>
      <div class="metric"><div class="n" id="n-net">—</div><div class="l" data-i18n="ledger_net">Net (income−expense)</div></div>
    </div>

    <section class="panel">
      <h2 data-i18n="ledger_months">Monthly overview (UTC)</h2>
      <table class="month-table">
        <thead>
          <tr>
            <th data-i18n="ledger_month">Month</th>
            <th data-i18n="ledger_income">Income</th>
            <th data-i18n="ledger_expense">Expense</th>
            <th data-i18n="ledger_subsidy">Subsidy</th>
            <th data-i18n="ledger_asset">Asset</th>
          </tr>
        </thead>
        <tbody id="months"><tr><td colspan="5" class="dim" data-i18n="loading">Loading…</td></tr></tbody>
      </table>
      <p class="no-print-hint" id="yield-line"></p>
    </section>

    <section class="panel no-print admin-only">
      <h2 data-i18n="ledger_new">New entry</h2>
      <form id="form-entry">
        <div class="grid2">
          <div>
            <label for="kind" data-i18n="ledger_kind">Kind</label>
            <select id="kind" required>
              <option value="expense" data-i18n="ledger_expense">Expense</option>
              <option value="income" data-i18n="ledger_income">Income</option>
              <option value="subsidy" data-i18n="ledger_subsidy">Subsidy</option>
              <option value="asset" data-i18n="ledger_asset">Asset</option>
            </select>
          </div>
          <div>
            <label for="category" data-i18n="ledger_category">Category</label>
            <select id="category">
              <option value="other" data-i18n="ledger_cat_other">Other</option>
              <option value="feed" data-i18n="ledger_cat_feed">Feed</option>
              <option value="seed" data-i18n="ledger_cat_seed">Seed</option>
              <option value="energy" data-i18n="ledger_cat_energy">Energy</option>
              <option value="repair" data-i18n="ledger_cat_repair">Repair</option>
              <option value="sale" data-i18n="ledger_cat_sale">Sale</option>
              <option value="eu_measure" data-i18n="ledger_cat_eu">EU measure</option>
            </select>
          </div>
        </div>
        <div class="grid2">
          <div>
            <label for="amount" data-i18n="ledger_amount">Amount (EUR)</label>
            <input id="amount" type="number" step="0.01" min="0.01" required placeholder="12.40" />
          </div>
          <div>
            <label for="ts" data-i18n="ledger_date">Date</label>
            <input id="ts" type="date" />
          </div>
        </div>
        <label for="note" data-i18n="ledger_note">Note</label>
        <input id="note" maxlength="2000" data-i18n-placeholder="ledger_note_ph" placeholder="e.g. seed for the garden" />
        <div class="actions"><button class="btn-ghost" type="submit" data-i18n="ledger_save">Save</button></div>
        <div class="msg" id="entry-msg"></div>
      </form>
    </section>

    <section class="panel">
      <h2 data-i18n="ledger_entries">Entries</h2>
      <ul class="msg-list" id="list"><li class="dim" data-i18n="loading">Loading…</li></ul>
    </section>

    <section class="panel no-print admin-only" id="receipt-panel" hidden>
      <h2 data-i18n="ledger_receipt">Receipt</h2>
      <p class="dim" id="receipt-meta"></p>
      <form id="form-receipt">
        <input type="hidden" id="receipt-id" />
        <label for="receipt-file" data-i18n="ledger_file">File (JPEG / PNG / WebP / PDF, max 5 MB)</label>
        <input id="receipt-file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required />
        <div class="actions"><button class="btn-ghost" type="submit" data-i18n="ledger_upload">Upload</button></div>
        <div class="msg" id="receipt-msg"></div>
      </form>
    </section>

    <footer>Polje ledger · integer cents EUR · ${escapeHtml(farm.name)}</footer>
  </main>
  </div>
  ${bootScripts(OPERATOR_SESSION_JS)}
  <script>
    function kindLabel(kind) {
      const map = {
        expense: "ledger_expense",
        income: "ledger_income",
        subsidy: "ledger_subsidy",
        asset: "ledger_asset"
      };
      return t(map[kind] || kind);
    }

    function setMsg(el, text, err) {
      el.textContent = text || "";
      el.className = "msg" + (err ? " err" : "");
    }
    function escapeHtml(s) {
      return String(s || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }
    function formatEur(cents) {
      return new Intl.NumberFormat(loc(), { style: "currency", currency: "EUR" }).format(cents / 100);
    }

    document.getElementById("print-btn").onclick = () => window.print();

    async function loadAll() {
      const list = document.getElementById("list");
      try {
        const [sumRes, listRes] = await Promise.all([
          fetch("/v1/ledger/summary?farm=" + encodeURIComponent(FARM), { credentials: "include" }),
          fetch("/v1/ledger?farm=" + encodeURIComponent(FARM) + "&limit=100", { credentials: "include" })
        ]);
        if (!sumRes.ok) throw new Error("summary " + sumRes.status);
        const sum = await sumRes.json();
        document.getElementById("n-income").textContent = formatEur(sum.income_cents || 0);
        document.getElementById("n-expense").textContent = formatEur(sum.expense_cents || 0);
        document.getElementById("n-subsidy").textContent = formatEur(sum.subsidy_cents || 0);
        const net = sum.operating_net_cents || 0;
        const netEl = document.getElementById("n-net");
        netEl.textContent = formatEur(net);
        netEl.className = "n " + (net >= 0 ? "pos" : "neg");

        const months = sum.months || [];
        const tbody = document.getElementById("months");
        if (months.length === 0) {
          tbody.innerHTML = '<tr><td colspan="5" class="dim">' + t("ledger_empty_months") + "</td></tr>";
        } else {
          tbody.innerHTML = months.map((m) =>
            "<tr><td>" + escapeHtml(m.ym) + "</td>" +
            "<td>" + formatEur(m.income_cents) + "</td>" +
            "<td>" + formatEur(m.expense_cents) + "</td>" +
            "<td>" + formatEur(m.subsidy_cents) + "</td>" +
            "<td>" + formatEur(m.asset_cents) + "</td></tr>"
          ).join("");
        }
        document.getElementById("yield-line").textContent =
          t("ledger_yield", {
            kg: sum.yield_kg != null ? Number(sum.yield_kg).toFixed(1) : "0",
            net: formatEur(sum.cash_net_cents || 0)
          });

        const data = await listRes.json();
        const entries = data.entries || [];
        if (entries.length === 0) {
          list.innerHTML = '<li class="dim">' + t("ledger_empty") + "</li>";
          return;
        }
        list.innerHTML = entries.map((e) => {
          const label = kindLabel(e.kind);
          const receipt = e.receipt_url
            ? ' <button type="button" class="btn-ghost receipt-open admin-only" data-id="' + e.id + '" data-url="' + e.receipt_url + '" style="height:28px;font-size:11px;padding:0 10px">' + t("ledger_receipt") + "</button>"
            : ' <button type="button" class="btn-ghost receipt-add admin-only" data-id="' + e.id + '" style="height:28px;font-size:11px;padding:0 10px">' + t("ledger_add_receipt") + "</button>";
          const del = ' <button type="button" class="btn-ghost entry-del no-print admin-only" data-id="' + e.id + '" style="height:28px;font-size:11px;padding:0 10px">' + t("ledger_delete") + "</button>";
          return '<li><div class="row"><span>' +
            '<span class="kind ' + escapeHtml(e.kind) + '">' + escapeHtml(label) + '</span> ' +
            escapeHtml(e.category || "") +
            (e.note ? " · " + escapeHtml(e.note) : "") +
            '</span><span class="meta">' + formatEur(e.amount_cents) + '</span></div>' +
            '<div class="dim">' + escapeHtml((e.ts || "").slice(0, 10)) + receipt + del + "</div></li>";
        }).join("");

        list.querySelectorAll(".receipt-add").forEach((btn) => {
          btn.onclick = () => {
            document.getElementById("receipt-panel").hidden = false;
            document.getElementById("receipt-id").value = btn.getAttribute("data-id");
            document.getElementById("receipt-meta").textContent = t("ledger_entry", { id: btn.getAttribute("data-id") });
          };
        });
        list.querySelectorAll(".receipt-open").forEach((btn) => {
          btn.onclick = async () => {
            const res = await fetch(btn.getAttribute("data-url"), { credentials: "include" });
            if (!res.ok) return;
            const blob = await res.blob();
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.target = "_blank";
            a.click();
          };
        });
        list.querySelectorAll(".entry-del").forEach((btn) => {
          btn.onclick = async () => {
            if (!confirm(t("ledger_delete_confirm"))) return;
            const res = await fetch("/v1/ledger/" + btn.getAttribute("data-id"), {
              method: "DELETE",
              credentials: "include"
            });
            if (!res.ok) {
              const d = await res.json().catch(() => ({}));
              alert(d.error || res.statusText);
              return;
            }
            loadAll();
          };
        });
      } catch (err) {
        list.innerHTML = '<li class="locked">' + escapeHtml(String(err.message || err)) + "</li>";
      }
    }

    document.getElementById("form-entry").onsubmit = async (e) => {
      e.preventDefault();
      const msg = document.getElementById("entry-msg");
      const amount = Number(document.getElementById("amount").value);
      const dateVal = document.getElementById("ts").value;
      const body = {
        farm_slug: FARM,
        kind: document.getElementById("kind").value,
        category: document.getElementById("category").value,
        amount_eur: amount,
        note: document.getElementById("note").value.trim() || null
      };
      if (dateVal) body.ts = dateVal + "T12:00:00Z";
      try {
        const res = await fetch("/v1/ledger", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || res.statusText);
        setMsg(msg, t("ledger_saved", { id: data.id.slice(0, 8) }));
        document.getElementById("amount").value = "";
        document.getElementById("note").value = "";
        document.getElementById("receipt-panel").hidden = false;
        document.getElementById("receipt-id").value = data.id;
        document.getElementById("receipt-meta").textContent = t("ledger_add_receipt_new");
        loadAll();
      } catch (err) {
        setMsg(msg, String(err.message || err), true);
      }
    };

    document.getElementById("form-receipt").onsubmit = async (e) => {
      e.preventDefault();
      const msg = document.getElementById("receipt-msg");
      const id = document.getElementById("receipt-id").value;
      const file = document.getElementById("receipt-file").files[0];
      if (!id || !file) return setMsg(msg, t("ledger_need_file"), true);
      const fd = new FormData();
      fd.append("file", file);
      try {
        const res = await fetch("/v1/ledger/" + id + "/receipt", {
          method: "POST",
          credentials: "include",
          body: fd
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || res.statusText);
        setMsg(msg, t("ledger_receipt_saved"));
        document.getElementById("receipt-file").value = "";
        loadAll();
      } catch (err) {
        setMsg(msg, String(err.message || err), true);
      }
    };

    opRefreshGate();
    loadAll();
    document.addEventListener("polje:lang", () => { loadAll(); });
  </script>
</body>
</html>`);
}
