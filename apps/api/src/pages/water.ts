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

type ZoneView = {
  id: string;
  name: string;
  kind: string;
  device_id: string;
  default_duration_sec: number;
  max_duration_sec: number;
  state: string;
  last_run: {
    started_at: string;
    duration_sec: number;
    status: string;
  } | null;
};

export async function renderWater(c: Context<AppEnv>) {
  const { farm, defaultSlug } = await farmFromRequest(c);

  if (!farm) {
    return c.html(
      `<!DOCTYPE html><html lang="en"><body><p>Farm not seeded.</p></body></html>`,
      503
    );
  }

  const settings = await c.env.DB.prepare(
    `SELECT rain_lockout FROM farm_settings WHERE farm_id = ?`
  )
    .bind(farm.id)
    .first<{ rain_lockout: number }>();
  const rainLock = (settings?.rain_lockout ?? 0) === 1;

  const { results: zones } = await c.env.DB.prepare(
    `SELECT id, name, kind, device_id, default_duration_sec, max_duration_sec
     FROM irrigation_zones WHERE farm_id = ? AND enabled = 1 ORDER BY name`
  )
    .bind(farm.id)
    .all<{
      id: string;
      name: string;
      kind: string;
      device_id: string;
      default_duration_sec: number;
      max_duration_sec: number;
    }>();

  const { results: recent } = await c.env.DB.prepare(
    `SELECT zone_id, started_at, duration_sec, status
     FROM irrigation_runs WHERE farm_id = ?
     ORDER BY started_at DESC LIMIT 50`
  )
    .bind(farm.id)
    .all<{
      zone_id: string;
      started_at: string;
      duration_sec: number;
      status: string;
    }>();

  const lastByZone = new Map<string, (typeof recent extends (infer T)[] | undefined ? T : never)>();
  for (const r of recent ?? []) {
    if (!lastByZone.has(r.zone_id)) lastByZone.set(r.zone_id, r);
  }

  const now = Date.now();
  const zoneViews: ZoneView[] = (zones ?? []).map((z) => {
    const last = lastByZone.get(z.id) ?? null;
    let state = "idle";
    if (last && last.status !== "done" && last.status !== "failed" && last.status !== "cancelled") {
      const start = Date.parse(last.started_at);
      if (!Number.isNaN(start) && now < start + last.duration_sec * 1000) {
        state = "running";
      }
    }
    return {
      ...z,
      state,
      last_run: last
        ? {
            started_at: last.started_at,
            duration_sec: last.duration_sec,
            status: last.status,
          }
        : null,
    };
  });

  const zonesHtml =
    zoneViews.length === 0
      ? `<li class="dim" data-i18n="water_no_zones">No zones — run seed.</li>`
      : zoneViews
          .map((z) => {
            const kindKey = z.kind === "frost" ? "water_kind_frost" : "water_kind_drip";
            const kindEn = z.kind === "frost" ? "frost" : "drip";
            const accent = z.kind === "frost" ? "ice" : "leaf";
            const last =
              z.last_run != null
                ? new Date(z.last_run.started_at).toLocaleString("en-GB", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "—";
            return `<li class="row zone" data-id="${escapeHtml(z.id)}" data-kind="${escapeHtml(z.kind)}" data-default="${z.default_duration_sec}" data-max="${z.max_duration_sec}">
        <div>
          <span class="name">${escapeHtml(z.name)}</span>
          <span class="kind ${accent}" data-i18n="${kindKey}">${kindEn}</span>
          <div class="meta">device ${escapeHtml(z.device_id)} · last ${escapeHtml(last)}</div>
        </div>
        <span class="state ${z.state === "running" ? "run" : ""}" data-i18n="${z.state === "running" ? "water_running" : "water_idle"}">${z.state === "running" ? "RUN" : "IDLE"}</span>
      </li>`;
          })
          .join("");

  const options = zoneViews
    .map(
      (z) =>
        `<option value="${escapeHtml(z.id)}">${escapeHtml(z.name)} (${z.kind === "frost" ? "frost" : "drip"})</option>`
    )
    .join("");

  const wxSkin = weatherNow(farm.timezone, null);
  return c.html(`${pageOpen({
    title: "POLJE · Water",
    farmName: farm.name,
    farmSlug: farm.slug,
    defaultSlug,
    currentPath: "/water",
    pipHtml: `<span class="pip lock ${rainLock ? "on" : ""}" id="rain-pip" data-i18n="${rainLock ? "rain_locked" : "rain_open"}">${rainLock ? "RAIN · LOCKED" : "RAIN · OPEN"}</span>`,
    extraHead: shareHead(c.req.url, "POLJE · Water", "Drip and frost line. Edge closes the valve."),
    extraCss: `
  .kind {
    display: inline-block;
    margin-left: 8px;
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 2px 6px;
    border: 1px solid var(--hairline);
    border-radius: 4px;
  }
  .kind.leaf { color: var(--leaf); border-color: color-mix(in oklab, var(--leaf) 50%, transparent); }
  .kind.ice { color: var(--ice); border-color: color-mix(in oklab, var(--ice) 50%, transparent); }
  .state { font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--spectral-dim); }
  .state.run { color: var(--leaf); }
  .zone { cursor: default; }
  .check { display: flex; align-items: center; gap: 8px; margin-top: 12px; text-transform: none; letter-spacing: 0; font-size: 14px; color: var(--spectral); }
  .check input { width: auto; margin: 0; }
  .pip.lock::before { background: var(--ice); }
  .pip.lock.on::before { background: var(--alarm); }
`,
    solar: wxSkin.solar,
    wx: wxSkin.wx,
  })}
  <main>
    <h1 data-i18n="water_title">Water</h1>
    <p class="sub" data-i18n="water_sub">Drip + frost line · Edge closes the valve · confirm to start</p>
    <p class="hint" data-i18n="water_howto">Viewing is open. Commands need sign-in. Pick a zone, set seconds, write why, tick confirm. Without confirm the cloud only stores a proposal. Rain lockout blocks drip, never an armed frost line. The edge closes the valve on timeout.</p>

    <section class="panel">
      <h2 data-i18n="water_zones">Zones</h2>
      <ul id="zones">${zonesHtml}</ul>
    </section>

    <section class="panel admin-only">
      <h2 data-i18n="water_run">Start (confirm)</h2>
      <p class="dim" data-i18n="water_run_hint">Without confirm → proposal only. Drip is blocked by rain lockout; frost is not.</p>
      <form id="form-run">
        <label for="zone" data-i18n="water_zone">Zone</label>
        <select id="zone" required>${options}</select>
        <label for="duration" data-i18n="water_duration">Duration (sec)</label>
        <input id="duration" type="number" min="30" max="3600" value="600" required />
        <label for="reason" data-i18n="water_reason">Reason (audit)</label>
        <input id="reason" required minlength="3" maxlength="500" data-i18n-placeholder="water_reason_ph" placeholder="e.g. garden dry after noon" />
        <label class="check"><input id="confirm" type="checkbox" /> confirm: true</label>
        <div class="actions"><button class="btn-ghost" type="submit" data-i18n="water_start">Start</button></div>
        <div class="msg" id="run-msg"></div>
      </form>
    </section>

    <section class="panel admin-only">
      <h2 data-i18n="water_lockout">Rain lockout</h2>
      <p class="dim" data-i18n="water_lockout_hint">Drip only. Frost program is not blocked.</p>
      <form id="form-lock">
        <label class="check"><input id="lock-on" type="checkbox" ${rainLock ? "checked" : ""} /> <span data-i18n="water_lockout_on">Enable lockout</span></label>
        <label for="lock-reason" data-i18n="water_reason_label">Reason</label>
        <input id="lock-reason" required minlength="3" maxlength="500" data-i18n-placeholder="water_lockout_ph" placeholder="e.g. rain today" />
        <label class="check"><input id="lock-confirm" type="checkbox" /> confirm: true</label>
        <div class="actions"><button class="btn-ghost" type="submit" data-i18n="water_save">Save</button></div>
        <div class="msg" id="lock-msg"></div>
      </form>
    </section>

    ${OPERATOR_GATE_HTML}

    <footer data-i18n="water_footer">Edge is write-leader · local timeout closes the valve · Dewline packing later</footer>
  </main>
  </div>
  ${bootScripts(OPERATOR_SESSION_JS)}
  <script>
    function setMsg(el, text, err) {
      el.textContent = text;
      el.className = err ? "msg err" : "msg";
    }

    document.getElementById("zone").addEventListener("change", (e) => {
      const opt = e.target.selectedOptions[0];
      const li = document.querySelector('.zone[data-id="' + e.target.value + '"]');
      if (li) document.getElementById("duration").value = li.dataset.default || 600;
      document.getElementById("duration").max = li ? li.dataset.max : 3600;
    });

    document.getElementById("form-run").addEventListener("submit", async (e) => {
      e.preventDefault();
      const msg = document.getElementById("run-msg");
      const body = {
        duration_sec: Number(document.getElementById("duration").value),
        reason: document.getElementById("reason").value.trim(),
        confirm: document.getElementById("confirm").checked,
      };
      const zoneId = document.getElementById("zone").value;
      try {
        const res = await fetch("/v1/irrigation/zones/" + zoneId + "/run", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (data.proposal) {
          setMsg(msg, t("water_proposal"), false);
          return;
        }
        if (!res.ok) {
          setMsg(msg, data.error || data.message || ("HTTP " + res.status), true);
          return;
        }
        setMsg(msg, t("water_sent", { id: (data.command_id || "").slice(0, 8) }), false);
        document.getElementById("confirm").checked = false;
        setTimeout(() => location.reload(), 800);
      } catch (err) {
        setMsg(msg, String(err), true);
      }
    });

    document.getElementById("form-lock").addEventListener("submit", async (e) => {
      e.preventDefault();
      const msg = document.getElementById("lock-msg");
      const body = {
        enabled: document.getElementById("lock-on").checked,
        reason: document.getElementById("lock-reason").value.trim(),
        confirm: document.getElementById("lock-confirm").checked,
      };
      try {
        const res = await fetch("/v1/irrigation/rain-lockout?farm=" + encodeURIComponent(FARM), {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (data.proposal) {
          setMsg(msg, t("water_proposal_lock"), false);
          return;
        }
        if (!res.ok) {
          setMsg(msg, data.error || ("HTTP " + res.status), true);
          return;
        }
        setMsg(msg, "Lockout: " + (data.rain_lockout ? "ON" : "OFF"), false);
        document.getElementById("lock-confirm").checked = false;
        setTimeout(() => location.reload(), 600);
      } catch (err) {
        setMsg(msg, String(err), true);
      }
    });

    opRefreshGate();
  </script>
</body>
</html>`);
}
