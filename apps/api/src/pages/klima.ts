import type { Context } from "hono";
import {
  bootScripts,
  escapeHtml,
  pageOpen,
  shareHead,
} from "../lib/html";
import { farmFromRequest } from "../lib/farm";
import { weatherNow } from "../lib/weather";

type AppEnv = { Bindings: Cloudflare.Env };

const ZONE_ID = "f1000000-0000-4000-8000-000000000001";

export async function renderKlima(c: Context<AppEnv>) {
  const { farm, defaultSlug } = await farmFromRequest(c);

  if (!farm) {
    return c.html(
      `<!DOCTYPE html><html lang="en"><body><p>Farm not seeded.</p></body></html>`,
      503
    );
  }

  const wxSkin = weatherNow(farm.timezone, null);
  return c.html(`${pageOpen({
    title: "POLJE · Climate",
    farmName: farm.name,
    farmSlug: farm.slug,
    defaultSlug,
    currentPath: "/klima",
    pipHtml: `<span class="pip ok">CLIMATE</span>`,
    extraHead: shareHead(c.req.url, "POLJE · Climate", "Old house heat and cool. Solar and battery on the land."),
    extraCss: `
  .telemetry { width: 100%; max-width: 100%; border-collapse: collapse; font-family: "IBM Plex Mono", ui-monospace, monospace; font-size: 13px; }
  .telemetry th, .telemetry td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--hairline); }
  .telemetry th { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--spectral-dim); font-weight: 500; font-family: inherit; }
  .telemetry td.num { text-align: right; }
  .lock { color: var(--hay); }
  .lock.alarm { color: var(--alarm); }
  @media (max-width: 719px) {
    .telemetry { font-size: 12px; display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; overscroll-behavior-x: contain; }
    .telemetry th, .telemetry td { padding: 8px 6px; }
  }
`,
    solar: wxSkin.solar,
    wx: wxSkin.wx,
  })}
  <main>
    <h1 data-i18n="klima_title">Climate</h1>
    <p class="sub"><span data-i18n="klima_old_house">Old house climate</span> · ${escapeHtml(farm.name)}</p>
    <p class="hint" data-i18n="klima_howto">Old house heat and cool. Setpoint writes need sign-in, a reason, and confirm. Heat stays off if battery is below the lockout.</p>

    <div class="metrics">
      <div class="metric"><div class="n" id="n-temp">—</div><div class="l">Temp °C</div></div>
      <div class="metric"><div class="n" id="n-kw">—</div><div class="l">Solar kW</div></div>
      <div class="metric"><div class="n" id="n-kwh">—</div><div class="l" data-i18n="klima_today_kwh">Today kWh</div></div>
      <div class="metric"><div class="n" id="n-bat">—</div><div class="l" data-i18n="klima_battery">Battery %</div></div>
    </div>

    <section class="panel">
      <h2 data-i18n="klima_old_house">Old house climate</h2>
      <p class="dim" id="zone-line">—</p>
      <p class="lock" id="lock-line"></p>
      <form id="form-set" class="admin-only">
        <div class="grid2">
          <div>
            <label for="heat_c" data-i18n="klima_heat">Heat °C (5–28)</label>
            <input id="heat_c" name="heat_c" type="number" step="0.5" min="5" max="28" required />
          </div>
          <div>
            <label for="cool_c" data-i18n="klima_cool">Cool °C (10–35)</label>
            <input id="cool_c" name="cool_c" type="number" step="0.5" min="10" max="35" required />
          </div>
        </div>
        <label for="reason" data-i18n="klima_reason">Reason</label>
        <input id="reason" name="reason" required minlength="3" maxlength="500" data-i18n-placeholder="klima_reason_ph" placeholder="e.g. night in the house" />
        <label class="check"><input type="checkbox" id="confirm" /> confirm: true</label>
        <div class="actions">
          <button type="submit" class="btn-primary" data-i18n="klima_set">Set setpoint</button>
        </div>
        <div class="msg" id="set-msg"></div>
      </form>
    </section>

    <section class="panel">
      <h2 data-i18n="klima_energy">Energy</h2>
      <table class="telemetry">
        <thead>
          <tr><th data-i18n="klima_metric">Metric</th><th class="num" data-i18n="klima_value">Value</th></tr>
        </thead>
        <tbody id="energy-rows">
          <tr><td colspan="2" class="dim" data-i18n="loading">Loading…</td></tr>
        </tbody>
      </table>
    </section>

    <footer data-i18n="klima_footer">Cloud proposes. Edge holds timeout and battery lockout.</footer>
  </main>
  </div>
  ${bootScripts()}
  <script>
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
          ? t("klima_heat_lock", { pct: climate.heat_battery_min_pct })
          : t("klima_lock_threshold", { pct: climate.heat_battery_min_pct });
        lock.className = "lock" + (z.heat_blocked ? " alarm" : "");
      }
      document.getElementById("n-kw").textContent = energy.solar_w == null ? "—" : (energy.solar_w / 1000).toFixed(2);
      document.getElementById("n-kwh").textContent = fmt(energy.kwh_today, 2);
      document.getElementById("n-bat").textContent = fmt(energy.battery_pct, 0);
      const rows = [
        ["Solar now W", energy.solar_w],
        [t("klima_today"), energy.kwh_today],
        [t("klima_yesterday"), energy.kwh_yesterday],
        [t("klima_battery"), energy.battery_pct],
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
          msg.textContent = t("klima_proposal");
        } else if (!res.ok) {
          msg.className = "msg err";
          msg.textContent = data.error + (data.message ? ": " + data.message : "");
        } else {
          msg.textContent = t("klima_sent", { id: data.command_id || "ok" });
          await refresh();
        }
      } catch (e) {
        msg.className = "msg err";
        msg.textContent = String(e);
      }
    };
    refresh();
    setInterval(refresh, 15000);
    document.addEventListener("polje:lang", () => { refresh(); });
    opRefreshGate();
  </script>
</body>
</html>`);
}
