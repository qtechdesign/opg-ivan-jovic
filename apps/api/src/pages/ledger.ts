import type { Context } from "hono";
import {
  CHASSIS_CSS,
  escapeHtml,
  farmBrand,
  FARM_SLUG_JS,
  siteNav,
} from "../lib/html";
import { farmFromRequest } from "../lib/farm";
import { OPERATOR_GATE_HTML, OPERATOR_SESSION_JS } from "../lib/operator-ui";

type AppEnv = { Bindings: Cloudflare.Env };

export async function renderLedger(c: Context<AppEnv>) {
  const { farm, defaultSlug } = await farmFromRequest(c);

  if (!farm) {
    return c.html(
      `<!DOCTYPE html><html lang="hr"><body><p>Farm nije seeded.</p></body></html>`,
      503
    );
  }

  return c.html(`<!DOCTYPE html>
<html lang="hr" data-solar="day" data-wx="clear" data-farm="${escapeHtml(farm.slug)}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>POLJE · Knjiga</title>
  <style>${CHASSIS_CSS}
  main { max-width: 960px; }
  .metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
  .metric { border: 1px solid var(--hairline); border-radius: 4px; padding: 16px; background: color-mix(in oklab, var(--void-soft) 82%, transparent); }
  .metric .n { font-family: ui-monospace, "IBM Plex Mono", monospace; font-size: 24px; line-height: 1.1; color: var(--soil); }
  .metric .n.pos { color: var(--leaf); }
  .metric .n.neg { color: var(--alarm); }
  .metric .l { font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--spectral-dim); margin-top: 8px; }
  .kind { font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; }
  .kind.expense { color: var(--alarm); }
  .kind.income { color: var(--leaf); }
  .kind.subsidy { color: var(--hay); }
  .kind.asset { color: var(--soil); }
  .month-table { width: 100%; border-collapse: collapse; font-size: 14px; }
  .month-table th, .month-table td {
    text-align: right; padding: 8px 10px; border-bottom: 1px solid var(--hairline);
    font-family: ui-monospace, "IBM Plex Mono", monospace;
  }
  .month-table th:first-child, .month-table td:first-child { text-align: left; }
  .month-table th {
    font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase;
    color: var(--spectral-dim); font-weight: 500; font-family: inherit;
  }
  .locked { color: var(--spectral-dim); }
  .receipt-link { font-size: 12px; color: var(--spacex-blue, #005288); }
  .no-print-hint { font-size: 12px; color: var(--spectral-dim); margin-top: 8px; }
  @media (max-width: 720px) { .metrics { grid-template-columns: 1fr 1fr; } }
  @media print {
    :root {
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
    header nav, .no-print, .pip { display: none !important; }
    header { border-color: rgba(16,18,24,0.2); }
    .metric .n { color: #6b4a2e; }
    .btn-ghost, button, input, select, textarea, label, form, #token-panel, #op-gate { display: none !important; }
    .panel { background: #fff; border-color: rgba(16,18,24,0.2); break-inside: avoid; }
  }
  </style>
</head>
<body>
  <header>
    ${farmBrand(farm.name, farm.slug, defaultSlug)}
    ${siteNav(farm.slug, defaultSlug)}
    <span class="pip ok">KNJIGA</span>
  </header>
  <main>
    <h1>Knjiga</h1>
    <p class="sub">Operativna knjiga OPG-a · EUR · nije porezna prijava</p>

    ${OPERATOR_GATE_HTML}
    <div class="actions no-print" style="margin-bottom:16px">
      <button type="button" class="btn-ghost" id="print-btn">Ispis</button>
    </div>

    <div class="metrics">
      <div class="metric"><div class="n pos" id="n-income">—</div><div class="l">Prihod</div></div>
      <div class="metric"><div class="n neg" id="n-expense">—</div><div class="l">Trošak</div></div>
      <div class="metric"><div class="n" id="n-subsidy">—</div><div class="l">Subvencija</div></div>
      <div class="metric"><div class="n" id="n-net">—</div><div class="l">Neto (prihod−trošak)</div></div>
    </div>

    <section class="panel">
      <h2>Mjesečni pregled (UTC)</h2>
      <table class="month-table">
        <thead>
          <tr><th>Mjesec</th><th>Prihod</th><th>Trošak</th><th>Subvencija</th><th>Imovina</th></tr>
        </thead>
        <tbody id="months"><tr><td colspan="5" class="locked">Prijavi se.</td></tr></tbody>
      </table>
      <p class="no-print-hint" id="yield-line"></p>
    </section>

    <section class="panel no-print">
      <h2>Nova stavka</h2>
      <form id="form-entry">
        <div class="grid2">
          <div>
            <label for="kind">Vrsta</label>
            <select id="kind" required>
              <option value="expense">Trošak</option>
              <option value="income">Prihod</option>
              <option value="subsidy">Subvencija</option>
              <option value="asset">Imovina</option>
            </select>
          </div>
          <div>
            <label for="category">Kategorija</label>
            <select id="category">
              <option value="other">Ostalo</option>
              <option value="feed">Hrana / krmivo</option>
              <option value="seed">Sjeme</option>
              <option value="energy">Energija</option>
              <option value="repair">Popravak</option>
              <option value="sale">Prodaja</option>
              <option value="eu_measure">EU mjera</option>
            </select>
          </div>
        </div>
        <div class="grid2">
          <div>
            <label for="amount">Iznos (EUR)</label>
            <input id="amount" type="number" step="0.01" min="0.01" required placeholder="12.40" />
          </div>
          <div>
            <label for="ts">Datum</label>
            <input id="ts" type="date" />
          </div>
        </div>
        <label for="note">Napomena</label>
        <input id="note" maxlength="2000" placeholder="npr. sjeme za vrt" />
        <div class="actions"><button class="btn-ghost" type="submit">Spremi</button></div>
        <div class="msg" id="entry-msg"></div>
      </form>
    </section>

    <section class="panel">
      <h2>Stavke</h2>
      <ul class="msg-list" id="list"><li class="locked">Prijavi se da vidiš knjigu.</li></ul>
    </section>

    <section class="panel no-print" id="receipt-panel" hidden>
      <h2>Račun / potvrda</h2>
      <p class="dim" id="receipt-meta"></p>
      <form id="form-receipt">
        <input type="hidden" id="receipt-id" />
        <label for="receipt-file">Datoteka (JPEG / PNG / WebP / PDF, max 5 MB)</label>
        <input id="receipt-file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required />
        <div class="actions"><button class="btn-ghost" type="submit">Prenesi</button></div>
        <div class="msg" id="receipt-msg"></div>
      </form>
    </section>

    <footer>Polje knjiga · integer cents EUR · ${escapeHtml(farm.name)}</footer>
  </main>
  <script>
    ${FARM_SLUG_JS}
    ${OPERATOR_SESSION_JS}
    window.poljeOnLogin = () => loadAll();

    const KIND_HR = {
      expense: "Trošak",
      income: "Prihod",
      subsidy: "Subvencija",
      asset: "Imovina"
    };

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
      const neg = cents < 0;
      const abs = Math.abs(cents);
      const whole = Math.floor(abs / 100);
      const frac = abs % 100;
      const s = whole + "," + String(frac).padStart(2, "0") + " €";
      return neg ? "−" + s : s;
    }

    document.getElementById("print-btn").onclick = () => window.print();

    async function loadAll() {
      const list = document.getElementById("list");
      try {
        const [sumRes, listRes] = await Promise.all([
          fetch("/v1/ledger/summary?farm=" + encodeURIComponent(FARM), { credentials: "include" }),
          fetch("/v1/ledger?farm=" + encodeURIComponent(FARM) + "&limit=100", { credentials: "include" })
        ]);
        if (sumRes.status === 401 || listRes.status === 401) {
          list.innerHTML = '<li class="locked">401 — operator token.</li>';
          document.getElementById("months").innerHTML =
            '<tr><td colspan="5" class="locked">401</td></tr>';
          return;
        }
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
          tbody.innerHTML = '<tr><td colspan="5" class="dim">Nema stavki u razdoblju.</td></tr>';
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
          "Prinos (suma plantings.yield_kg): " + (sum.yield_kg != null ? Number(sum.yield_kg).toFixed(1) : "0") + " kg · cash neto: " + formatEur(sum.cash_net_cents || 0);

        const data = await listRes.json();
        const entries = data.entries || [];
        if (entries.length === 0) {
          list.innerHTML = '<li class="dim">Prazno. Unesi prvu stavku.</li>';
          return;
        }
        list.innerHTML = entries.map((e) => {
          const label = KIND_HR[e.kind] || e.kind;
          const receipt = e.receipt_url
            ? ' <button type="button" class="btn-ghost receipt-open" data-id="' + e.id + '" data-url="' + e.receipt_url + '" style="height:28px;font-size:11px;padding:0 10px">Račun</button>'
            : ' <button type="button" class="btn-ghost receipt-add" data-id="' + e.id + '" style="height:28px;font-size:11px;padding:0 10px">+ Račun</button>';
          const del = ' <button type="button" class="btn-ghost entry-del no-print" data-id="' + e.id + '" style="height:28px;font-size:11px;padding:0 10px">Obriši</button>';
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
            document.getElementById("receipt-meta").textContent = "Stavka " + btn.getAttribute("data-id");
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
            if (!confirm("Obrisati stavku?")) return;
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
        setMsg(msg, "Spremljeno · " + data.id.slice(0, 8));
        document.getElementById("amount").value = "";
        document.getElementById("note").value = "";
        document.getElementById("receipt-panel").hidden = false;
        document.getElementById("receipt-id").value = data.id;
        document.getElementById("receipt-meta").textContent = "Dodaj račun za novu stavku (opcionalno)";
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
      if (!id || !file) return setMsg(msg, "Datoteka i stavka potrebni", true);
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
        setMsg(msg, "Račun spremljen");
        document.getElementById("receipt-file").value = "";
        loadAll();
      } catch (err) {
        setMsg(msg, String(err.message || err), true);
      }
    };

    opRefreshGate().then((on) => { if (on) loadAll(); });
  </script>
</body>
</html>`);
}
