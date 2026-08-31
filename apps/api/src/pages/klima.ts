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

const ZONE_ID = "f1000000-0000-4000-8000-000000000001";

export async function renderKlima(c: Context<AppEnv>) {
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
  <title>POLJE · Klima</title>
  <style>${CHASSIS_CSS}
  main { max-width: 960px; }
  .metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
  .metric { border: 1px solid var(--hairline); border-radius: 4px; padding: 16px; background: color-mix(in oklab, var(--void-soft) 82%, transparent); }
  .metric .n { font-family: ui-monospace, "IBM Plex Mono", monospace; font-size: 24px; line-height: 1.1; }
  .metric .l { font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--spectral-dim); margin-top: 8px; }
  .telemetry { width: 100%; border-collapse: collapse; font-family: ui-monospace, "IBM Plex Mono", monospace; font-size: 13px; }
  .telemetry th, .telemetry td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--hairline); }
  .telemetry th { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--spectral-dim); font-weight: 500; font-family: inherit; }
  .telemetry td.num { text-align: right; }
  .lock { color: var(--hay); }
  .lock.alarm { color: var(--alarm); }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  @media (max-width: 720px) { .metrics { grid-template-columns: 1fr 1fr; } .grid2 { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <header>
    ${farmBrand(farm.name, farm.slug, defaultSlug)}
    ${siteNav(farm.slug, defaultSlug)}
    <span class="pip ok">KLIMA</span>
  </header>
  <main>
    <h1>Klima</h1>
    <p class="sub">Stara kuća · grijanje / hlađenje · energija · ${escapeHtml(farm.name)}</p>

    <div class="metrics">
      <div class="metric"><div class="n" id="n-temp">—</div><div class="l">Temp °C</div></div>
      <div class="metric"><div class="n" id="n-kw">—</div><div class="l">Solar kW</div></div>
      <div class="metric"><div class="n" id="n-kwh">—</div><div class="l">Danas kWh</div></div>
      <div class="metric"><div class="n" id="n-bat">—</div><div class="l">Baterija %</div></div>
    </div>

    <section class="panel">
      <h2>Old house climate</h2>
      <p class="dim" id="zone-line">Učitavanje…</p>
      <p class="lock" id="lock-line"></p>
      <form id="form-set" class="admin-only">
        <div class="grid2">
          <div>
            <label for="heat_c">Grijanje °C (5–28)</label>
            <input id="heat_c" name="heat_c" type="number" step="0.5" min="5" max="28" required />
          </div>
          <div>
            <label for="cool_c">Hlađenje °C (10–35)</label>
            <input id="cool_c" name="cool_c" type="number" step="0.5" min="10" max="35" required />
          </div>
        </div>
        <label for="reason">Razlog</label>
        <input id="reason" name="reason" required minlength="3" maxlength="500" placeholder="npr. noć u kući" />
        <label><input type="checkbox" id="confirm" style="width:auto;margin-right:8px" /> confirm: true</label>
        <div class="actions">
          <button type="submit" class="btn-ghost">Postavi setpoint</button>
        </div>
        <div class="msg" id="set-msg"></div>
      </form>
    </section>

    <section class="panel">
      <h2>Energija</h2>
      <table class="telemetry">
        <thead>
          <tr><th>Metrika</th><th class="num">Vrijednost</th></tr>
        </thead>
        <tbody id="energy-rows">
          <tr><td colspan="2" class="dim">Učitavanje…</td></tr>
        </tbody>
      </table>
    </section>

    ${OPERATOR_GATE_HTML}

    <footer>Cloud predlaže. Edge drži timeout i battery lockout.</footer>
  </main>
  <script>
    ${FARM_SLUG_JS}
    ${OPERATOR_SESSION_JS}
    const ZONE = ${JSON.stringify(ZONE_ID)};
    function fmt(n, d) {
      if (n == null || Number.isNaN(n)) return "—";
      return Number(n).toFixed(d);
    }
    async function refresh() {
      const [cRes, eRes] = await Promise.all([
        fetch("/v1/climate/now?farm=" + encodeURIComponent(FARM)),
        fetch("/v1/energy/now?farm=" + encodeURIComponent(FARM)),
      ]);
      const climate = await cRes.json();
      const energy = await eRes.json();
      const z = (climate.zones || [])[0];
      if (z) {
        document.getElementById("n-temp").textContent = fmt(z.temp_c, 1);
        document.getElementById("heat_c").value = z.heat_c;
        document.getElementById("cool_c").value = z.cool_c;
        document.getElementById("zone-line").textContent =
          z.name + " · heat " + z.heat_c + " °C · cool " + z.cool_c + " °C · timeout " + z.timeout_sec + " s";
        const lock = document.getElementById("lock-line");
        lock.textContent = z.heat_blocked
          ? "HEAT LOCKOUT · baterija < " + climate.heat_battery_min_pct + "%"
          : "Lockout prag " + climate.heat_battery_min_pct + "%";
        lock.className = "lock" + (z.heat_blocked ? " alarm" : "");
      }
      document.getElementById("n-kw").textContent = energy.solar_w == null ? "—" : (energy.solar_w / 1000).toFixed(2);
      document.getElementById("n-kwh").textContent = fmt(energy.kwh_today, 2);
      document.getElementById("n-bat").textContent = fmt(energy.battery_pct, 0);
      const rows = [
        ["Solar now W", energy.solar_w],
        ["Danas kWh", energy.kwh_today],
        ["Jučer kWh", energy.kwh_yesterday],
        ["Baterija %", energy.battery_pct],
      ];
      for (const l of energy.loads || []) {
        rows.push([l.name + " W", l.w]);
      }
      document.getElementById("energy-rows").innerHTML = rows.map(([k, v]) =>
        "<tr><td>" + k + "</td><td class=\\"num\\">" + (v == null ? "—" : v) + "</td></tr>"
      ).join("");
    }
    document.getElementById("form-set").onsubmit = async (ev) => {
      ev.preventDefault();
      const msg = document.getElementById("set-msg");
      msg.textContent = "";
      msg.className = "msg";
      const body = {
        heat_c: Number(document.getElementById("heat_c").value),
        cool_c: Number(document.getElementById("cool_c").value),
        reason: document.getElementById("reason").value,
        confirm: document.getElementById("confirm").checked,
      };
      try {
        const res = await fetch("/v1/climate/zones/" + ZONE + "/setpoint", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (data.proposal) {
          msg.textContent = "Prijedlog — označi confirm da pošalješ naredbu.";
        } else if (!res.ok) {
          msg.className = "msg err";
          msg.textContent = data.error + (data.message ? ": " + data.message : "");
        } else {
          msg.textContent = "Poslano · " + (data.command_id || "ok");
          await refresh();
        }
      } catch (e) {
        msg.className = "msg err";
        msg.textContent = String(e);
      }
    };
    refresh();
    setInterval(refresh, 15000);
    opRefreshGate();
  </script>
</body>
</html>`);
}
