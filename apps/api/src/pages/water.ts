import type { Context } from "hono";
import {
  bootScripts,
  escapeHtml,
  pageOpen,
  shareHead,
} from "../lib/html";
import { farmFromRequest } from "../lib/farm";
import { weatherNow } from "../lib/weather";
import { POND_PREVIEW_JS } from "../lib/pond-preview-js";
import { DEWLINE_SIM_JS } from "../lib/dewline-sim-js";

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
            return `<li class="work-card zone" data-id="${escapeHtml(z.id)}" data-kind="${escapeHtml(z.kind)}" data-default="${z.default_duration_sec}" data-max="${z.max_duration_sec}">
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
    extraHead: shareHead(c.req.url, "POLJE · Water", "Rain first. Pond on the land. Drip and frost on the edge."),
    extraCss: `
  .kind {
    display: inline-block;
    margin-left: 8px;
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 2px 6px;
    border: 1px solid var(--hairline);
    border-radius: 99px;
  }
  .kind.leaf { color: var(--leaf); border-color: color-mix(in oklab, var(--leaf) 50%, transparent); }
  .kind.ice { color: var(--ice); border-color: color-mix(in oklab, var(--ice) 50%, transparent); }
  .state { font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--spectral-dim); }
  .state.run { color: var(--leaf); }
  .pip.lock::before { background: var(--ice); }
  .pip.lock.on::before { background: var(--alarm); }
  .pond-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(7.5rem, 100%), 1fr)); gap: 10px; margin: 12px 0; }
  .pond-stat { border: 1px solid var(--hairline); padding: 10px 12px; border-radius: var(--radius); min-width: 0; }
  .pond-stat b { display: block; font-size: 1.15rem; font-weight: 600; overflow-wrap: anywhere; }
  .pond-stat span { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--spectral-dim); }
  .pond-ok { font-size: 11px; letter-spacing: 0.12em; }
  .pond-ok.ok { color: var(--leaf); }
  .pond-ok.warn { color: var(--alarm); }
  .iso-stage { overflow: hidden; max-width: 100%; border-radius: var(--radius); touch-action: pan-y; }
  #pond-canvas { display: block; width: 100%; height: 280px; border: 1px solid var(--hairline); border-radius: var(--radius); background: #dceff7; touch-action: pan-y; }
  html[data-solar="night"] #pond-canvas,
  html[data-solar="dusk"] #pond-canvas,
  html[data-solar="dawn"] #pond-canvas { background: #11303c; }
  #pack-canvas { display: block; width: 100%; height: 110px; border: 1px solid var(--hairline); border-radius: var(--radius); background: #0a1822; touch-action: pan-y; }
  .pond-tools { display: grid; gap: 14px; margin: 12px 0 0; }
  .pond-tools label { display: flex; flex-direction: column; gap: 4px; font-size: 13px; }
  .pond-tools input[type=range] { width: 100%; }
  .pond-lab { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; font-weight: 600; }
  .pond-lab b { font-variant-numeric: tabular-nums; font-weight: 600; }
  .pond-explain { font-size: 12px; color: var(--spectral-dim); line-height: 1.35; }
  .pond-facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(9.5rem, 100%), 1fr)); gap: 8px; margin: 10px 0 12px; }
  .pond-facts div { border: 1px solid var(--hairline); padding: 8px 10px; border-radius: var(--radius); min-width: 0; }
  .pond-facts b { display: block; font-size: 0.95rem; font-weight: 600; overflow-wrap: anywhere; }
  .pond-facts span { font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--spectral-dim); }
  .pack-clock { font-variant-numeric: tabular-nums; letter-spacing: 0.08em; }
  #pack-scrub { width: 100%; margin: 8px 0; }
  .pack-actions { display: flex; gap: 8px; flex-wrap: wrap; margin: 8px 0; }
  @media (min-width: 720px) {
    #pond-canvas { height: min(52dvh, 560px); }
    #pack-canvas { height: min(18dvh, 140px); }
  }
`,
    solar: wxSkin.solar,
    wx: wxSkin.wx,
  })}
  <main>
    <h1 data-i18n="water_title">Water</h1>
    <p class="sub" data-i18n="water_sub">Rain into the pond · then drip and frost · edge closes the valve</p>
    <p class="hint" data-i18n="water_howto">Yearly need comes from the fields on Land. Place a pond on the map, then set depth and banks here. Viewing is open. Commands need sign-in. Rain lockout blocks drip, never an armed frost line.</p>

    <section class="panel" id="akumulacija">
      <h2 data-i18n="water_pond_title">Accumulation</h2>
      <p class="hint" data-i18n="water_pond_hint">First rain, then a dug basin. The isometric model is the farm: pond, pump, drip. Analog climate is Lonjsko polje (~880 mm rain, ~1000 mm evaporation). Storage target is the dry season, not the whole year. Draw the pond on Land, then set depth and banks here. Play the day in Pack — pipes light and the pond drops.</p>
      <div class="pond-stats">
        <div class="pond-stat"><span data-i18n="water_pond_year">Year demand</span><b id="wb-demand">—</b></div>
        <div class="pond-stat"><span data-i18n="water_pond_need">Dry-season store</span><b id="wb-need">—</b></div>
        <div class="pond-stat"><span data-i18n="water_pond_live">Pond live</span><b id="wb-store">—</b></div>
        <div class="pond-stat"><span data-i18n="water_pond_rain">Rain net</span><b id="wb-rain">—</b></div>
        <div class="pond-stat"><span data-i18n="water_pond_gap">Gap</span><b id="wb-gap">—</b><div class="pond-ok" id="wb-ok"></div></div>
      </div>
      <p class="dim" id="pond-empty" data-i18n="water_pond_empty">No pond on the land yet. Scene below is a 25×25 m example. On Land, tap Place pond and walk the corners to size the real basin.</p>
      <div id="pond-facts" class="pond-facts">
        <div><span data-i18n="water_pond_f_top">Top (equal-area square)</span><b id="pf-top">—</b></div>
        <div><span data-i18n="water_pond_f_bot">Bottom</span><b id="pf-bot">—</b></div>
        <div><span data-i18n="water_pond_f_dig">Dig / water</span><b id="pf-dig">—</b></div>
        <div><span data-i18n="water_pond_f_bank">Banks</span><b id="pf-bank">—</b></div>
        <div><span data-i18n="water_pond_f_vol">Usable</span><b id="pf-vol">—</b></div>
        <div><span data-i18n="water_pond_f_catch">Catchment</span><b id="pf-catch">—</b></div>
        <div><span data-i18n="water_pond_f_ha">On the land</span><b id="pf-ha">—</b></div>
      </div>
      <div class="iso-stage"><canvas id="pond-canvas" aria-label="Isometric farm water model"></canvas></div>
      <div id="pond-tools" class="pond-tools">
        <label>
          <span class="pond-lab"><span data-i18n="water_pond_depth">Dig depth</span><b id="pond-depth-val">2.2 m</b></span>
          <input id="pond-depth" type="range" min="0.8" max="5" step="0.1" value="2.2" />
          <span class="pond-explain" data-i18n="water_pond_depth_help">How deep we excavate. The top 0.3 m stays empty (freeboard) so a storm does not overtop the banks.</span>
        </label>
        <label>
          <span class="pond-lab"><span data-i18n="water_pond_slope">Bank slope</span><b id="pond-slope-val">1 : 2.5</b></span>
          <input id="pond-slope" type="range" min="1.2" max="4" step="0.1" value="2.5" />
          <span class="pond-explain" data-i18n="water_pond_slope_help">1 m down for this many metres out. 2–3 is a farm dugout you can mow. 1.2 is a steep clay cut — more volume, harder banks.</span>
        </label>
        <label>
          <span class="pond-lab"><span data-i18n="water_pond_catch">Field that drains here</span><b id="pond-catch-val">4×</b></span>
          <input id="pond-catch" type="range" min="1" max="12" step="0.5" value="4" />
          <span class="pond-explain" data-i18n="water_pond_catch_help">How many times the pond’s surface of field sheds into it. Rain on that extra land, at 35% runoff. 1× is only the water surface.</span>
        </label>
        <button type="button" class="btn-ghost admin-only" id="pond-save" hidden data-i18n="water_pond_save">Save pond</button>
      </div>
      <h3 data-i18n="water_pond_by_plot">Need by field</h3>
      <ul id="wb-plots"></ul>
    </section>

    <section class="panel" id="dewline">
      <h2 data-i18n="water_pack_title">Pack</h2>
      <p class="hint" data-i18n="water_pack_hint">Drip lines share the pump. Concurrent flow never exceeds main m³/h; the same valve box never overlaps. Frost stays on the FPS program and is not packed here. Play the day to see pond drawdown.</p>
      <div class="pond-stats">
        <div class="pond-stat"><span data-i18n="water_pack_peak">Peak flow</span><b id="pack-peak">—</b></div>
        <div class="pond-stat"><span data-i18n="water_pack_day">Day volume</span><b id="pack-day">—</b></div>
        <div class="pond-stat"><span data-i18n="water_pack_pump">Pump</span><b id="pack-pump">—</b></div>
        <div class="pond-stat"><span data-i18n="water_pack_saved">Rain vs city</span><b id="pack-saved">—</b></div>
      </div>
      <p class="pond-ok warn" id="pack-starved" hidden data-i18n="water_pack_starved">Pond empty during a run — starved.</p>
      <p class="pack-clock" id="pack-clock">05:00</p>
      <div class="pack-actions">
        <button type="button" class="btn-ghost" id="pack-play" data-i18n="water_pack_play">Play</button>
        <button type="button" class="btn-ghost" id="pack-reset" data-i18n="water_pack_reset">Reset</button>
      </div>
      <input id="pack-scrub" type="range" min="0" max="1439" value="300" />
      <canvas id="pack-canvas" aria-label="Packed drip schedule"></canvas>
      <ul id="pack-slots"></ul>
      <div id="pack-tools" class="pond-tools admin-only" hidden>
        <label><span data-i18n="water_pack_main">Main flow (m³/h)</span>
          <input id="pack-main" type="range" min="1" max="40" step="0.5" value="8" />
        </label>
        <label><span data-i18n="water_pack_cycles">Cycles / day</span>
          <input id="pack-cycles" type="range" min="1" max="4" step="1" value="1" />
        </label>
        <label><span data-i18n="water_pack_well">Well (m³/h)</span>
          <input id="pack-well" type="range" min="0" max="20" step="0.5" value="0" />
        </label>
        <label><span data-i18n="water_pack_price">City water (cents / m³)</span>
          <input id="pack-price" type="range" min="0" max="500" step="10" value="240" />
        </label>
        <button type="button" class="btn-ghost" id="pack-save" data-i18n="water_pack_save">Save pump</button>
      </div>
    </section>

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
        <div class="actions"><button class="btn-primary" type="submit" data-i18n="water_start">Start</button></div>
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
        <div class="actions"><button class="btn-primary" type="submit" data-i18n="water_save">Save</button></div>
        <div class="msg" id="lock-msg"></div>
      </form>
    </section>

    <footer data-i18n="water_footer">Edge is write-leader · local timeout closes the valve · drip packed into the pump</footer>
  </main>
  </div>
  ${bootScripts(POND_PREVIEW_JS, DEWLINE_SIM_JS)}
  <script>
    function setMsg(el, text, err) {
      el.textContent = text;
      el.className = err ? "msg err" : "msg";
    }

    function pickZone(id) {
      const sel = document.getElementById("zone");
      if (sel) sel.value = id;
      document.querySelectorAll(".zone").forEach((el) => {
        el.classList.toggle("is-on", el.dataset.id === id);
      });
      const li = document.querySelector('.zone[data-id="' + id + '"]');
      if (li) {
        document.getElementById("duration").value = li.dataset.default || 600;
        document.getElementById("duration").max = li.dataset.max || 3600;
      }
    }
    document.getElementById("zones").addEventListener("click", (e) => {
      const li = e.target.closest(".zone");
      if (li) pickZone(li.dataset.id);
    });
    document.getElementById("zone").addEventListener("change", (e) => {
      pickZone(e.target.value);
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
