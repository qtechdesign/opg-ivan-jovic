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

export async function renderFrost(c: Context<AppEnv>) {
  const { farm, defaultSlug } = await farmFromRequest(c);

  if (!farm) {
    return c.html(
      `<!DOCTYPE html><html lang="en"><body><p>Farm not seeded.</p></body></html>`,
      503
    );
  }

  const wxSkin = weatherNow(farm.timezone, null);
  return c.html(`${pageOpen({
    title: `Frost · ${farm.name}`,
    farmName: farm.name,
    farmSlug: farm.slug,
    defaultSlug,
    currentPath: "/frost",
    pipHtml: `<span class="pip" id="frost-pip">FROST · —</span>`,
    extraHead: shareHead(c.req.url, `Frost · ${farm.name}`, "FPS LoRa frost protection. Local failsafe first."),
    htmlId: "frost-html",
    solar: wxSkin.solar,
    wx: wxSkin.wx,
    extraCss: `
  .status-big {
    font-size: 28px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--ice);
    margin: 0 0 8px;
  }
  .btn-ice {
    display: inline-flex; align-items: center; height: 40px; padding: 0 20px;
    background: var(--ice); color: var(--void); border: none; border-radius: 4px;
    letter-spacing: 0.08em; text-transform: uppercase; font-size: 13px; cursor: pointer; font-family: inherit; font-weight: 700;
  }
`,
  })}
  <main>
    <h1 data-i18n="frost_title">Frost</h1>
    <p class="sub" data-i18n="frost_sub">FPS LoRa · local program · ice 0–2 °C</p>
    <p class="hint" data-i18n="frost_howto">This is FPS LoRa frost protection. Load the program, then ARM with a reason. The local node sprays if temperature drops — Cloudflare is not the safety layer. Open valve also needs confirm.</p>
    <p class="status-big" id="frost-status">—</p>
    <div class="metrics cols-3">
      <div class="metric"><div><span class="n" id="m-temp">—</span><span class="u">°C</span></div><div class="l">FPS temp</div></div>
      <div class="metric"><div><span class="n" id="m-rh">—</span><span class="u">% RH</span></div><div class="l" data-i18n="frost_humidity">Humidity</div></div>
      <div class="metric"><div><span class="n" id="m-dp">—</span><span class="u">°C</span></div><div class="l" data-i18n="frost_dewpoint">Dew point</div></div>
    </div>
    <section class="panel admin-only">
      <h2 data-i18n="frost_program">Program</h2>
      <div class="grid2">
        <div>
          <label data-i18n="frost_threshold">Threshold °C</label>
          <input id="thr" type="number" step="0.1" value="1.5" />
        </div>
        <div>
          <label data-i18n="frost_max_spray">Max spray (s)</label>
          <input id="maxsec" type="number" step="30" value="600" />
        </div>
      </div>
      <label data-i18n="frost_reason_arm">Reason (required to ARM)</label>
      <input id="reason" type="text" data-i18n-placeholder="frost_reason_ph" placeholder="e.g. night frost" maxlength="500" />
      <div class="actions">
        <button type="button" class="btn-ghost" id="btn-load" data-i18n="frost_load">Load program</button>
        <button type="button" class="btn-ice" id="btn-arm">ARM</button>
        <button type="button" class="btn-ghost" id="btn-disarm">DISARM</button>
      </div>
      <p class="msg" id="msg"></p>
    </section>
    <section class="panel admin-only">
      <h2 data-i18n="frost_valve">Valve</h2>
      <div class="grid2">
        <div>
          <label>max_sec</label>
          <input id="valve-sec" type="number" value="300" min="30" max="3600" />
        </div>
        <div>
          <label data-i18n="frost_reason">Reason</label>
          <input id="valve-reason" type="text" data-i18n-placeholder="frost_reason_valve_ph" placeholder="manual open" />
        </div>
      </div>
      <div class="actions">
        <button type="button" class="btn-ghost" id="btn-valve-propose" data-i18n="frost_propose">Propose</button>
        <button type="button" class="btn-ice" id="btn-valve-open" data-i18n="frost_open">Open (confirm)</button>
      </div>
      <p class="msg" id="valve-msg"></p>
    </section>
    <section class="panel">
      <h2 data-i18n="frost_nodes">Nodes</h2>
      <ul id="nodes"><li class="dim" data-i18n="loading">Loading…</li></ul>
    </section>
    <section class="panel">
      <h2 data-i18n="frost_events">Recent events</h2>
      <ul id="events"><li class="dim" data-i18n="frost_no_events">No spray events.</li></ul>
    </section>
    ${OPERATOR_GATE_HTML}
    <footer data-i18n="frost_footer">Local failsafe. Cloud is not the only safety layer.</footer>
  </main>
  </div>
  ${bootScripts(OPERATOR_SESSION_JS)}
  <script>
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
    const elEvents = document.getElementById("events");

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
        elPip.textContent = t("frost_pip", { state: st });
        elPip.className = "pip " + (data.status === "armed" || data.status === "spraying" ? "ok" : "warn");
        if (data.status === "armed" || data.status === "spraying" || data.status === "watch") {
          elHtml.setAttribute("data-wx", "frost");
          elHtml.setAttribute("data-force-wx", "frost");
        } else {
          elHtml.removeAttribute("data-force-wx");
        }
        if (data.live?.temp_c != null) elTemp.textContent = Number(data.live.temp_c).toFixed(1);
        if (data.live?.rh != null) elRh.textContent = Number(data.live.rh).toFixed(0);
        if (data.live?.dewpoint_c != null) elDp.textContent = Number(data.live.dewpoint_c).toFixed(1);
        if (data.program) {
          if (data.program.temp_threshold_c != null) document.getElementById("thr").value = data.program.temp_threshold_c;
          if (data.program.max_spray_sec != null) document.getElementById("maxsec").value = data.program.max_spray_sec;
        }
        const ev = data.recent_events || [];
        if (!ev.length) {
          elEvents.innerHTML = '<li class="dim">' + t("frost_no_events") + "</li>";
        } else {
          elEvents.innerHTML = ev.map((e) => {
            const start = (e.started_at || "").replace("T", " ").slice(0, 16);
            const end = e.ended_at ? " → " + String(e.ended_at).slice(11, 16) : " " + t("frost_active");
            const t = e.min_temp_c != null ? Number(e.min_temp_c).toFixed(1) + "°C" : "";
            return '<li class="row"><span class="name">' + start + end + '</span><span class="meta">' + (e.mode || "") + " " + t + "</span></li>";
          }).join("");
        }
      } catch (e) { console.warn(e); }

      try {
        const res = await fetch("/v1/fps/nodes?farm=" + encodeURIComponent(FARM));
        const data = await res.json();
        const nodes = data.nodes || [];
        if (!nodes.length) {
          elNodes.innerHTML = '<li class="dim">' + t("frost_no_nodes") + "</li>";
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
      setMsg(elMsg, res.ok ? t("frost_program_ok") : (data.error || t("frost_error")), !res.ok);
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
      setMsg(elMsg, res.ok ? (armFlag ? "ARMED" : "DISARMED") : (data.error || t("frost_error")), !res.ok);
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
      setMsg(elValveMsg, res.ok ? ("sent " + data.command_id) : (data.error || t("frost_error")), !res.ok);
    };

    refresh();
    setInterval(refresh, 10000);
    document.addEventListener("polje:lang", () => { refresh(); });
    opRefreshGate();
  </script>
</body>
</html>`);
}
