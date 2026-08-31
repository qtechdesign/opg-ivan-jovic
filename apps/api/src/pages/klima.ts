import type { Context } from "hono";
import { CHASSIS_CSS, SITE_NAV, escapeHtml } from "../lib/html";

type AppEnv = { Bindings: Cloudflare.Env };

const ZONE_ID = "f1000000-0000-4000-8000-000000000001";

export async function renderKlima(c: Context<AppEnv>) {
  const farm = await c.env.DB.prepare(
    `SELECT id, slug, name FROM farms WHERE slug = 'ivan-jovic'`
  ).first<{ id: string; slug: string; name: string }>();

  if (!farm) {
    return c.html(
      `<!DOCTYPE html><html lang="hr"><body><p>Farm nije seeded.</p></body></html>`,
      503
    );
  }

  return c.html(`<!DOCTYPE html>
<html lang="hr" data-solar="day" data-wx="clear">
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
    <span class="brand">Polje · OPG Ivan Jović</span>
    ${SITE_NAV}
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
      <form id="form-set">
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

    <section class="panel">
      <h2>Operator token</h2>
      <p class="dim">Samo lokalno (sessionStorage). Potrebno za setpoint.</p>
      <label for="token">Token</label>
      <input id="token" type="password" autocomplete="off" />
      <div class="actions">
        <button type="button" class="btn-ghost" id="save-token">Spremi</button>
      </div>
    </section>

    <footer>Cloud predlaže. Edge drži timeout i battery lockout.</footer>
  </main>
  <script>
    const ZONE = ${JSON.stringify(ZONE_ID)};
    const tokenEl = document.getElementById("token");
    tokenEl.value = sessionStorage.getItem("polje_operator") || "";
    document.getElementById("save-token").onclick = () => {
      sessionStorage.setItem("polje_operator", tokenEl.value);
    };
    function authHeaders() {
      const t = sessionStorage.getItem("polje_operator") || "";
      const h = { "Content-Type": "application/json" };
      if (t) h.Authorization = "Bearer " + t;
      return h;
    }
    function fmt(n, d) {
      if (n == null || Number.isNaN(n)) return "—";
      return Number(n).toFixed(d);
    }
    async function refresh() {
      const [cRes, eRes] = await Promise.all([
        fetch("/v1/climate/now?farm=ivan-jovic"),
        fetch("/v1/energy/now?farm=ivan-jovic"),
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
          headers: authHeaders(),
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
  </script>
</body>
</html>`);
}
