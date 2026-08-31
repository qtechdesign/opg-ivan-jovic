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

export async function renderFrost(c: Context<AppEnv>) {
  const { farm, defaultSlug } = await farmFromRequest(c);

  if (!farm) {
    return c.html(
      `<!DOCTYPE html><html lang="hr"><body><p>Farm nije seeded.</p></body></html>`,
      503
    );
  }

  return c.html(`<!DOCTYPE html>
<html lang="hr" data-solar="night" data-wx="clear" id="frost-html" data-farm="${escapeHtml(farm.slug)}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Mraz · ${escapeHtml(farm.name)}</title>
  <style>${CHASSIS_CSS}
  main { max-width: 820px; }
  .status-big {
    font-size: 28px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--ice, #7ec8e3);
    margin: 0 0 8px;
  }
  .metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px; }
  .metric { border: 1px solid var(--hairline); border-radius: 4px; padding: 16px; background: color-mix(in oklab, var(--void-soft) 82%, transparent); }
  .metric .n { font-family: ui-monospace, "IBM Plex Mono", monospace; font-size: 28px; line-height: 1; }
  .metric .u { font-size: 12px; letter-spacing: 0.08em; color: var(--spectral-dim); text-transform: uppercase; margin-left: 6px; }
  .metric .l { font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--spectral-dim); margin-top: 8px; }
  .btn-ice {
    display: inline-flex; align-items: center; height: 40px; padding: 0 20px;
    background: var(--ice, #7ec8e3); color: var(--void); border: none; border-radius: 4px;
    letter-spacing: 0.08em; text-transform: uppercase; font-size: 13px; cursor: pointer; font-family: inherit; font-weight: 700;
  }
  html[data-wx="frost"] { --hairline: color-mix(in oklab, var(--ice, #7ec8e3) 45%, transparent); }
  @media (max-width: 640px) { .metrics { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <header>
    ${farmBrand(farm.name, farm.slug, defaultSlug)}
    ${siteNav(farm.slug, defaultSlug)}
    <span class="pip" id="frost-pip">MRAZ · —</span>
  </header>
  <main>
    <h1>Mraz</h1>
    <p class="sub">FPS LoRa · lokalni program · led 0–2 °C</p>
    <p class="status-big" id="frost-status">—</p>
    <div class="metrics">
      <div class="metric"><div><span class="n" id="m-temp">—</span><span class="u">°C</span></div><div class="l">FPS temp</div></div>
      <div class="metric"><div><span class="n" id="m-rh">—</span><span class="u">% RH</span></div><div class="l">Vlažnost</div></div>
      <div class="metric"><div><span class="n" id="m-dp">—</span><span class="u">°C</span></div><div class="l">Točka rose</div></div>
    </div>
    <section class="panel admin-only">
      <h2>Program</h2>
      <div class="grid2">
        <div>
          <label>Prag °C</label>
          <input id="thr" type="number" step="0.1" value="1.5" />
        </div>
        <div>
          <label>Max spray (s)</label>
          <input id="maxsec" type="number" step="30" value="600" />
        </div>
      </div>
      <label>Razlog (obavezno za ARM)</label>
      <input id="reason" type="text" placeholder="npr. noćni mraz" maxlength="500" />
      <div class="actions">
        <button type="button" class="btn-ghost" id="btn-load">Učitaj program</button>
        <button type="button" class="btn-ice" id="btn-arm">ARM</button>
        <button type="button" class="btn-ghost" id="btn-disarm">DISARM</button>
      </div>
      <p class="msg" id="msg"></p>
    </section>
    <section class="panel admin-only">
      <h2>Ventil</h2>
      <div class="grid2">
        <div>
          <label>max_sec</label>
          <input id="valve-sec" type="number" value="300" min="30" max="3600" />
        </div>
        <div>
          <label>Razlog</label>
          <input id="valve-reason" type="text" placeholder="ručno otvaranje" />
        </div>
      </div>
      <div class="actions">
        <button type="button" class="btn-ghost" id="btn-valve-propose">Prijedlog</button>
        <button type="button" class="btn-ice" id="btn-valve-open">Otvori (confirm)</button>
      </div>
      <p class="msg" id="valve-msg"></p>
    </section>
    <section class="panel">
      <h2>Čvorovi</h2>
      <ul id="nodes"><li class="dim">Učitavanje…</li></ul>
    </section>
    ${OPERATOR_GATE_HTML}
    <footer>Lokalni failsafe. Cloud nije jedini sloj sigurnosti.</footer>
  </main>
  <script>
    ${FARM_SLUG_JS}
    ${OPERATOR_SESSION_JS}
    function jsonHeaders() {
      return { "Content-Type": "application/json" };
    }
    const elStatus = document.getElementById("frost-status");
    const elPip = document.getElementById("frost-pip");
    const elHtml = document.getElementById("frost-html");
    const elTemp = document.getElementById("m-temp");
    const elRh = document.getElementById("m-rh");
    const elDp = document.getElementById("m-dp");
    const elMsg = document.getElementById("msg");
    const elValveMsg = document.getElementById("valve-msg");
    const elNodes = document.getElementById("nodes");

    function setMsg(el, text, err) {
      el.textContent = text || "";
      el.className = "msg" + (err ? " err" : "");
    }

    async function refresh() {
      try {
        const res = await fetch("/v1/frost/status?farm=" + encodeURIComponent(FARM));
        const data = await res.json();
        const st = (data.status || "idle").toUpperCase();
        elStatus.textContent = st;
        elPip.textContent = "MRAZ · " + st;
        elPip.className = "pip " + (data.status === "armed" || data.status === "spraying" ? "ok" : "warn");
        if (data.status === "armed" || data.status === "spraying") {
          elHtml.setAttribute("data-wx", "frost");
        } else {
          elHtml.setAttribute("data-wx", "clear");
        }
        if (data.live?.temp_c != null) elTemp.textContent = Number(data.live.temp_c).toFixed(1);
        if (data.live?.rh != null) elRh.textContent = Number(data.live.rh).toFixed(0);
        if (data.live?.dewpoint_c != null) elDp.textContent = Number(data.live.dewpoint_c).toFixed(1);
        if (data.program) {
          if (data.program.temp_threshold_c != null) document.getElementById("thr").value = data.program.temp_threshold_c;
          if (data.program.max_spray_sec != null) document.getElementById("maxsec").value = data.program.max_spray_sec;
        }
      } catch (e) { console.warn(e); }

      try {
        const res = await fetch("/v1/fps/nodes?farm=" + encodeURIComponent(FARM));
        const data = await res.json();
        const nodes = data.nodes || [];
        if (!nodes.length) {
          elNodes.innerHTML = '<li class="dim">Nema FPS čvorova — pokreni seed.</li>';
        } else {
          elNodes.innerHTML = nodes.map(n => {
            const m = n.metrics || {};
            const bits = Object.keys(m).slice(0, 4).map(k => k + "=" + Number(m[k]).toFixed(1)).join(" · ");
            return '<li class="row"><span class="name">' + n.name + '</span><span class="meta">' + (bits || n.driver) + '</span></li>';
          }).join("");
        }
      } catch (e) { console.warn(e); }
    }

    document.getElementById("btn-load").onclick = async () => {
      const body = {
        farm_slug: FARM,
        temp_threshold_c: Number(document.getElementById("thr").value),
        max_spray_sec: Number(document.getElementById("maxsec").value),
        valve_ids: ["fps-valve-1"],
        sensor_id: "fps-sn-1",
        mode: "ice",
      };
      const res = await fetch("/v1/fps/program", {
        method: "POST",
        credentials: "include",
        headers: jsonHeaders(),
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setMsg(elMsg, res.ok ? "Program učitan → watch" : (data.error || "greška"), !res.ok);
      refresh();
    };

    async function arm(armFlag) {
      const reason = document.getElementById("reason").value.trim();
      if (!reason) {
        const res = await fetch("/v1/fps/arm", {
          method: "POST",
          credentials: "include",
          headers: jsonHeaders(),
          body: JSON.stringify({ farm_slug: FARM, arm: armFlag, confirm: false }),
        });
        const data = await res.json();
        setMsg(elMsg, data.hint || JSON.stringify(data), false);
        return;
      }
      const res = await fetch("/v1/fps/arm", {
        method: "POST",
        credentials: "include",
        headers: jsonHeaders(),
        body: JSON.stringify({ farm_slug: FARM, arm: armFlag, confirm: true, reason }),
      });
      const data = await res.json();
      setMsg(elMsg, res.ok ? (armFlag ? "ARMED" : "DISARMED") : (data.error || "greška"), !res.ok);
      refresh();
    }
    document.getElementById("btn-arm").onclick = () => arm(true);
    document.getElementById("btn-disarm").onclick = () => arm(false);

    document.getElementById("btn-valve-propose").onclick = async () => {
      const res = await fetch("/v1/fps/valves/fps-valve-1/open", {
        method: "POST",
        credentials: "include",
        headers: jsonHeaders(),
        body: JSON.stringify({
          max_sec: Number(document.getElementById("valve-sec").value),
          reason: document.getElementById("valve-reason").value || "test",
          confirm: false,
        }),
      });
      const data = await res.json();
      setMsg(elValveMsg, data.hint || JSON.stringify(data), false);
    };

    document.getElementById("btn-valve-open").onclick = async () => {
      const reason = document.getElementById("valve-reason").value.trim() || "manual open";
      const res = await fetch("/v1/fps/valves/fps-valve-1/open", {
        method: "POST",
        credentials: "include",
        headers: jsonHeaders(),
        body: JSON.stringify({
          max_sec: Number(document.getElementById("valve-sec").value),
          reason,
          confirm: true,
        }),
      });
      const data = await res.json();
      setMsg(elValveMsg, res.ok ? ("sent " + data.command_id) : (data.error || "greška"), !res.ok);
    };

    refresh();
    setInterval(refresh, 10000);
    opRefreshGate();
  </script>
</body>
</html>`);
}
