import type { Context } from "hono";
import {
  bootScripts,
  escapeHtml,
  farmPath,
  pageOpen,
  SHARE_DESC,
  shareHead,
  siteFooter,
  TRELLO_LIVE_JS,
} from "../lib/html";
import { farmFromRequest } from "../lib/farm";
import { weatherNow } from "../lib/weather";
import { LAND_MAP_JS } from "../lib/land-map-js";
import { PLOT_USES, plotUseOptionsHtml } from "../lib/plot-uses";
import { formatEur } from "../lib/money";
import { heroR2Key, ogR2Key } from "../lib/og";
import { listBuildPhases, planTotals, type BuildPhase } from "../lib/plan";
import { IVAN_JOVIC_TRELLO_URL, trelloBoardIdForSlug } from "../lib/trello";
import {
  ANALOG_FEEDS,
  analogThumbUrl,
} from "../lib/analog-feeds";

type AppEnv = { Bindings: Cloudflare.Env };

type PlotRow = {
  id: string;
  name: string;
  use_type: string | null;
  notes: string | null;
  hectares: number | null;
  geom_json: string | null;
  holding_id: string | null;
};

type PlantingRow = {
  id: string;
  plot_id: string;
  crop: string;
  variety: string | null;
  stage: string | null;
};

type MediaRow = {
  id: string;
  caption: string | null;
  created_at: string;
};

export async function renderHome(c: Context<AppEnv>) {
  const { farm, defaultSlug } = await farmFromRequest(c);

  let plotsHtml = `<li class="dim" data-i18n="home_no_plots">No plots yet — run seed.</li>`;
  if (farm) {
    const { results: plots } = await c.env.DB.prepare(
      `SELECT name, use_type FROM plots WHERE farm_id = ? ORDER BY name`
    )
      .bind(farm.id)
      .all<{ name: string; use_type: string | null }>();

    if (plots && plots.length > 0) {
      plotsHtml = plots
        .map(
          (p) =>
            `<li class="row"><span class="name">${escapeHtml(p.name)}</span>` +
            (p.use_type
              ? ` <span class="meta">${escapeHtml(p.use_type)}</span>`
              : "") +
            `</li>`
        )
        .join("");
    }
  }

  const title = farm?.name ?? "Polje";
  const status = farm ? "ONLINE" : "UNSEEDED";
  const statusClass = farm ? "ok" : "warn";

  const farmSlug = farm?.slug ?? "";
  const storyKey =
    farm && farm.slug === defaultSlug ? "home_story_ivan" : "home_story_fork";
  const storyEn =
    storyKey === "home_story_ivan"
      ? "House from 1923 · hay, garden, family · Croatia"
      : "Template for a fork · Europe/Zagreb";
  const wxSkin = weatherNow(farm?.timezone ?? "Europe/Zagreb", null);

  let heroInner = `<div class="hero-plate" aria-hidden="true"></div>`;
  let stillsHtml = "";
  if (farm) {
    const generated =
      (await c.env.MEDIA.head(heroR2Key(farm.slug))) ||
      (await c.env.MEDIA.head(ogR2Key(farm.slug)));
    if (generated) {
      heroInner = `<img src="/hero.jpg?v=full" alt="${escapeHtml(title)}" />`;
    }
    const { results: snaps } = await c.env.DB.prepare(
      `SELECT s.camera_id, COALESCE(d.name, s.camera_id) AS name
       FROM camera_snapshots s
       LEFT JOIN devices d ON d.id = s.camera_id
       WHERE s.farm_id = ?
       ORDER BY s.captured_at DESC LIMIT 3`
    )
      .bind(farm.id)
      .all<{ camera_id: string; name: string }>();
    if (snaps && snaps.length > 0) {
      if (!generated) {
        heroInner = `<img src="/v1/cameras/${escapeHtml(snaps[0].camera_id)}/latest" alt="${escapeHtml(snaps[0].name)}" />`;
      }
      const eyesHref = farmPath("/eyes", farm.slug, defaultSlug);
      stillsHtml = `<div class="live-stills">${snaps
        .map(
          (s) =>
            `<a href="${eyesHref}"><img src="/v1/cameras/${escapeHtml(s.camera_id)}/latest" alt="${escapeHtml(s.name)}" /></a>`
        )
        .join("")}</div>`;
    } else {
      const eyesHref = farmPath("/eyes", farm.slug, defaultSlug);
      stillsHtml = `<div class="live-stills">${ANALOG_FEEDS.map(
        (f) =>
          `<a href="${eyesHref}"><img src="${escapeHtml(analogThumbUrl(f.youtube_id))}" alt="${escapeHtml(f.title_en)}" /></a>`
      ).join("")}</div>`;
    }
  }
  const hero = `<div class="hero">${heroInner}<div class="hero-scrim"></div><div class="hero-copy"><h1>${escapeHtml(title)}</h1><p class="sub" data-i18n="${storyKey}">${storyEn}</p></div></div>`;

  let phases: BuildPhase[] = [];
  if (farm) {
    try {
      phases = await listBuildPhases(c.env.DB, farm.id);
    } catch {
      phases = [];
    }
  }
  const totals = planTotals(phases);
  const phasesHtml =
    phases.length === 0
      ? `<li class="dim" data-i18n="home_no_phases">No phases yet — add them on Plan.</li>`
      : phases
          .map((p) => {
            const a = (p.starts_on || "").slice(0, 7);
            const b = (p.ends_on || "").slice(0, 7);
            const when = a && b && a !== b ? `${a} → ${b}` : a || b || "—";
            const eur = p.amount_cents > 0 ? formatEur(p.amount_cents) : "TBD";
            return `<li class="phase">
        <div class="when">${escapeHtml(when)}<div class="st ${escapeHtml(p.status)}">${escapeHtml(p.status)}</div></div>
        <div><span class="name">${escapeHtml(p.title)}</span>${p.body ? `<div class="hint" style="margin:4px 0 0">${escapeHtml(p.body)}</div>` : ""}</div>
        <span class="eur">${escapeHtml(eur)}</span>
      </li>`;
          })
          .join("");

  const planHref = farmPath("/plan", farmSlug, defaultSlug);
  const trelloUrl = trelloBoardIdForSlug(farmSlug) ? IVAN_JOVIC_TRELLO_URL : null;

  return c.html(`${pageOpen({
    title: `POLJE · ${title}`,
    farmName: title,
    farmSlug,
    defaultSlug,
    currentPath: "/",
    pipHtml: `<span class="pip ${statusClass}" id="starlink-pip">STARLINK · —</span>`,
    extraHead: shareHead(c.req.url, `POLJE · ${title}`, SHARE_DESC),
    solar: wxSkin.solar,
    wx: wxSkin.wx,
    bodyClass: "page-home",
  })}
    ${hero}
    <main class="wide">
    <div class="intro">
      <div class="metrics">
        <div class="metric"><div><span class="n" id="m-temp">—</span><span class="u">°C</span></div><div class="l">Temp</div></div>
        <div class="metric"><div><span class="n" id="m-kw">—</span><span class="u">kW</span></div><div class="l">Solar</div></div>
        <div class="metric"><div><span class="n" id="m-soil">—</span><span class="u">moist</span></div><div class="l" data-i18n="home_metric_soil">Soil</div></div>
        <div class="metric"><div><span class="n" id="m-edge">—</span><span class="u">seen</span></div><div class="l">Edge</div></div>
      </div>
      <p class="pitch" data-i18n="home_pitch">Polje is the operating system for this family holding: land, water, frost, climate, cameras, and the book. Cloud is the brain and the ledger. The edge on the farm is the muscle and the failsafe. We rebuild OPG Ivan Jović in public so another farm can fork the same stack.</p>
      <p class="hint" data-i18n="analog_wx_hint">Live numbers are a climate analog from Čigoč / Lonjsko polje (Open-Meteo) until sensors sit on this land. Not private GPS.</p>
    </div>
    ${stillsHtml ? `<p class="hint" data-i18n="home_live_stills">Analog live views — not this yard yet</p>${stillsHtml}` : ""}

    <section class="panel howto">
      <h2 data-i18n="home_why_title">Why this exists</h2>
      <p class="hint" data-i18n="home_why">The land is older than the software. House from 1923. Unused for decades. This is the next chapter of that same ground — a family OPG, not a generic IoT toy. Pilot: we publish the plan, the API, and the work so neighbours and other farms can follow.</p>
      <div class="guide">
        <div class="card"><strong data-i18n="home_why_land_title">Family land</strong><span data-i18n="home_why_land">OPG is the Croatian family holding. Plots, water, frost, cameras, and the book live in one console — named for this yard, hay, and garden.</span></div>
        <div class="card"><strong data-i18n="home_why_failsafe_title">Local failsafe</strong><span data-i18n="home_why_failsafe">Starlink can drop. Valves and heaters timeout on the farm. Cloud proposes; a human ticks confirm. No confirm = proposal only.</span></div>
        <div class="card"><strong data-i18n="home_why_open_title">Built in public</strong><span data-i18n="home_why_open">Same work as the public Trello. This console is live — cameras included. The ledger shows cash flow once the OPG starts making money. Tokens and bank credentials stay private.</span></div>
      </div>
    </section>

    <section class="panel howto">
      <h2 data-i18n="home_how_title">How to use this console</h2>
      <div class="guide">
        <a href="${farmPath("/water", farmSlug, defaultSlug)}"><strong data-i18n="nav_water">Water</strong><span data-i18n="home_guide_water">Drip and frost valves. Sign in, write why, tick confirm. No confirm = proposal only.</span></a>
        <a href="${farmPath("/frost", farmSlug, defaultSlug)}"><strong data-i18n="nav_frost">Frost</strong><span data-i18n="home_guide_frost">Load the local program, then ARM. Edge sprays if the night goes to ice. Cloud is not the safety layer.</span></a>
        <a href="${farmPath("/eyes", farmSlug, defaultSlug)}"><strong data-i18n="nav_eyes">Eyes</strong><span data-i18n="home_guide_eyes">Live cameras: yard, garden, hay. Stills now; stream when the edge has it.</span></a>
        <a href="${farmPath("/land", farmSlug, defaultSlug)}"><strong data-i18n="nav_land">Land</strong><span data-i18n="home_guide_land">Plots and plantings. The land ledger — names, stages, growth photos.</span></a>
        <a href="${planHref}"><strong data-i18n="nav_plan">Plan</strong><span data-i18n="home_guide_plan">Build phases with time and EUR. Same board the public Trello follows.</span></a>
        <a href="${farmPath("/ledger", farmSlug, defaultSlug)}"><strong data-i18n="nav_ledger">Ledger</strong><span data-i18n="home_guide_ledger">Public cash flow in cents EUR. Empty until the OPG starts making money. Not a tax filing.</span></a>
      </div>
    </section>

    <section class="panel">
      <h2 data-i18n="home_plan_title">Build plan</h2>
      <p class="hint" data-i18n="home_plan_hint">Procurement and civil works, in order. Amounts are planning envelopes until a quote lands — not a contract.</p>
      <ul class="timeline">${phasesHtml}</ul>
      <p class="actions">
        <a class="btn-ghost" href="${planHref}" data-i18n="home_plan_open">Open the plan builder</a>
        ${totals.amount_cents > 0 ? `<span class="meta">${escapeHtml(formatEur(totals.amount_cents))}</span>` : ""}
      </p>
    </section>

    ${trelloUrl ? `<section class="panel">
      <h2 data-i18n="home_trello_title">Public Trello</h2>
      <p class="hint" data-i18n="home_trello_hint">Follow the same work on the public board. Polje reads lists; writes stay on Trello.</p>
      <div id="trello-live" class="trello-cols"></div>
      <p class="hint"><a href="${trelloUrl}" rel="noreferrer">${trelloUrl}</a></p>
      <p class="actions"><a class="btn-ghost" href="${trelloUrl}" rel="noreferrer" data-i18n="home_trello_open">Open board</a></p>
    </section>` : ""}

    <div class="split">
    <section class="panel">
      <h2 data-i18n="home_water">Water</h2>
      <ul>
        <li class="row"><span class="name" id="water-lock">Rain lockout · —</span><span class="meta"><a href="/water" data-i18n="home_open">open</a></span></li>
        <li class="row"><span class="name" id="water-last">Last drip · —</span><span class="meta" id="water-state">—</span></li>
      </ul>
    </section>
    <section class="panel">
      <h2 data-i18n="home_plots">Plots</h2>
      <ul>${plotsHtml}</ul>
    </section>
    </div>
    <p class="actions">
      <a class="btn-ghost" href="${farmPath("/klima", farmSlug, defaultSlug)}" data-i18n="home_klima">Climate</a>
      <a class="btn-ghost" href="${farmPath("/water", farmSlug, defaultSlug)}" data-i18n="home_water">Water</a>
      <a class="btn-ghost" href="${farmPath("/eyes", farmSlug, defaultSlug)}" data-i18n="home_eyes">View the farm</a>
      <a class="btn-ghost" href="${farmPath("/land", farmSlug, defaultSlug)}" data-i18n="home_land">Land</a>
    </p>
    ${siteFooter()}
  </main>
  </div>
  ${bootScripts(TRELLO_LIVE_JS)}
  <script>
    const pip = document.getElementById("starlink-pip");
    const elTemp = document.getElementById("m-temp");
    const elKw = document.getElementById("m-kw");
    const elSoil = document.getElementById("m-soil");
    const elEdge = document.getElementById("m-edge");

    let lastLive = null;
    let lastEnergy = null;
    let lastIrr = null;

    function applyLive(live, energy) {
      if (!live) return;
      lastLive = live;
      if (energy !== undefined) lastEnergy = energy;
      const star = (live.starlink || "unknown").toUpperCase();
      pip.textContent = "STARLINK · " + star;
      pip.className = "pip " + (live.starlink === "up" ? "ok" : live.starlink === "down" ? "down" : "warn");
      const metrics = live.metrics || {};
      const temp = metrics["fps-sn-1:temp_c"] || metrics["temp-yard-1:temp_c"] || Object.values(metrics).find(m => m.metric === "temp_c");
      const soil = metrics["soil-n-1:moisture"] || Object.values(metrics).find(m => m.metric === "moisture");
      const watts = metrics["inv-1:w"] || Object.values(metrics).find(m => m.metric === "w");
      if (temp) elTemp.textContent = Number(temp.value).toFixed(1);
      if (soil) elSoil.textContent = Number(soil.value).toFixed(2);
      if (energy && energy.solar_w != null) {
        elKw.textContent = (Number(energy.solar_w) / 1000).toFixed(2);
      } else if (watts) {
        elKw.textContent = (Number(watts.value) / 1000).toFixed(2);
      }
      elEdge.textContent = live.edge_seen_at
        ? new Date(live.edge_seen_at).toLocaleTimeString(loc(), { hour: "2-digit", minute: "2-digit", second: "2-digit" })
        : "—";
    }

    function applyWater(irr) {
      const elLock = document.getElementById("water-lock");
      const elLast = document.getElementById("water-last");
      const elState = document.getElementById("water-state");
      if (!irr || !elLock) return;
      elLock.textContent = t("home_rain_lock", { state: irr.rain_lockout ? "ON" : "OFF" });
      const drip = (irr.zones || []).find(z => z.kind === "drip");
      if (elState && drip) elState.textContent = drip.state || "idle";
      if (elLast && irr.last_drip) {
        elLast.textContent = t("home_last_drip", { when: new Date(irr.last_drip.started_at).toLocaleString(loc()) });
      } else if (elLast) {
        elLast.textContent = t("home_last_drip", { when: "—" });
      }
    }

    async function refresh() {
      try {
        const res = await fetch("/v1/overview?farm=" + encodeURIComponent(FARM));
        const data = await res.json();
        applyLive(data.live, data.energy);
        lastIrr = data.irrigation;
        applyWater(lastIrr);
      } catch (e) { console.warn(e); }
    }

    refresh();
    setInterval(refresh, 15000);

    try {
      const proto = location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(proto + "//" + location.host + "/v1/live?farm=" + encodeURIComponent(FARM));
      ws.onmessage = (ev) => {
        if (ev.data === "pong") return;
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === "snapshot" || msg.type === "ingest") applyLive(msg);
        } catch {}
      };
      setInterval(() => { if (ws.readyState === 1) ws.send("ping"); }, 25000);
    } catch (e) { console.warn("ws", e); }

    document.addEventListener("polje:lang", () => {
      if (lastLive) applyLive(lastLive, lastEnergy);
      if (lastIrr) applyWater(lastIrr);
    });
    opRefreshGate();
  </script>
</body>
</html>`);
}

export async function renderLand(c: Context<AppEnv>) {
  const { farm, defaultSlug } = await farmFromRequest(c);

  if (!farm) {
    return c.html(
      `<!DOCTYPE html><html lang="en"><body><p>Farm not seeded.</p></body></html>`,
      404
    );
  }

  const { results: plots } = await c.env.DB.prepare(
    `SELECT id, name, use_type, notes, hectares, geom_json, holding_id FROM plots WHERE farm_id = ? ORDER BY name`
  )
    .bind(farm.id)
    .all<PlotRow>();

  const { results: plantings } = await c.env.DB.prepare(
    `SELECT p.id, p.plot_id, p.crop, p.variety, p.stage
     FROM plantings p
     JOIN plots pl ON pl.id = p.plot_id
     WHERE pl.farm_id = ?
     ORDER BY p.crop`
  )
    .bind(farm.id)
    .all<PlantingRow>();

  const { results: media } = await c.env.DB.prepare(
    `SELECT id, caption, created_at FROM growth_media
     WHERE farm_id = ? ORDER BY created_at DESC LIMIT 12`
  )
    .bind(farm.id)
    .all<MediaRow>();

  const byPlot = new Map<string, PlantingRow[]>();
  for (const p of plantings ?? []) {
    const list = byPlot.get(p.plot_id) ?? [];
    list.push(p);
    byPlot.set(p.plot_id, list);
  }

  const plotOptions = (plots ?? [])
    .map(
      (p) =>
        `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`
    )
    .join("");

  const plantingOptions = (plantings ?? [])
    .map(
      (p) =>
        `<option value="${escapeHtml(p.id)}">${escapeHtml(p.crop)}${
          p.variety ? " · " + escapeHtml(p.variety) : ""
        }</option>`
    )
    .join("");

  const plotsHtml =
    plots && plots.length > 0
      ? plots
          .map((plot) => {
            const kids = byPlot.get(plot.id) ?? [];
            const nest =
              kids.length === 0
                ? `<ul class="nest"><li class="dim" data-i18n="land_no_plantings">No plantings</li></ul>`
                : `<ul class="nest">${kids
                    .map(
                      (k) =>
                        `<li class="row"><span>${escapeHtml(k.crop)}${
                          k.variety
                            ? ` <span class="dim">(${escapeHtml(k.variety)})</span>`
                            : ""
                        }</span><span class="status">${escapeHtml(
                          (k.stage || "planned").toUpperCase()
                        )}</span></li>`
                    )
                    .join("")}</ul>`;
            const ha =
              plot.geom_json && plot.hectares != null
                ? ` · ${plot.hectares} ha`
                : "";
            const known = PLOT_USES.some((u) => u.id === plot.use_type);
            const typeHtml = plot.use_type
              ? known
                ? `<span data-i18n="plot_use_${escapeHtml(plot.use_type)}">${escapeHtml(plot.use_type)}</span>`
                : escapeHtml(plot.use_type)
              : "—";
            return `<li class="plot-hit" data-plot-id="${escapeHtml(plot.id)}">
              <div class="row"><span>${escapeHtml(plot.name)}</span>
              <span class="meta">${typeHtml}${ha}</span></div>
              ${nest}
            </li>`;
          })
          .join("")
      : `<li class="dim" data-i18n="land_no_plots">No plots</li>`;

  const thumbs =
    media && media.length > 0
      ? media
          .map(
            (m) =>
              `<a href="/v1/media/${escapeHtml(m.id)}" title="${escapeHtml(
                m.caption || m.created_at
              )}"><img src="/v1/media/${escapeHtml(m.id)}" alt="${escapeHtml(
                m.caption || "growth"
              )}" loading="lazy" /></a>`
          )
          .join("")
      : `<p class="dim" data-i18n="land_no_photos">No growth photos yet.</p>`;

  const wxSkin = weatherNow(farm.timezone, null);
  const mapsKey = String(c.env.GOOGLE_MAPS_API_KEY || "");
  return c.html(`${pageOpen({
    title: "POLJE · Land",
    farmName: farm.name,
    farmSlug: farm.slug,
    defaultSlug,
    currentPath: "/land",
    pipHtml: `<span class="pip ok">LAND</span>`,
    extraHead: shareHead(c.req.url, "POLJE · Land", "Plots and plantings · OPG Ivan Jović."),
    extraCss: `
  .nest { margin: 0 0 8px 16px; }
  .status { font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--spectral-dim); }
  .farm-map-wrap { position: relative; margin: 8px 0 0; overflow: hidden; max-width: 100%; overscroll-behavior: contain; }
  .farm-map { height: min(48dvh, 380px); width: 100%; max-width: 100%; border: 1px solid var(--hairline); border-radius: var(--radius); background: var(--void-soft); touch-action: pan-x pan-y; }
  @media (min-width: 720px) {
    .farm-map { height: min(62dvh, 640px); }
  }
  .map-search-row { display: flex; gap: 8px; margin: 0 0 8px; flex-wrap: wrap; }
  .map-search-row input { flex: 1; min-width: 0; }
  .map-chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 10px; }
  .map-chip { font: inherit; font-size: 12px; letter-spacing: 0.04em; text-transform: uppercase; padding: 8px 12px; border: 1px solid var(--hairline); background: var(--ghost); color: inherit; cursor: pointer; border-radius: 99px; }
  .map-chip.is-on { border-color: var(--leaf); color: var(--leaf); }
  .map-chip.is-empty { opacity: 0.55; border-style: dashed; }
  .map-chip-hold { border-style: dashed; letter-spacing: 0.06em; }
  .map-chip-hold.is-on { border-color: var(--paper, #f4f1e8); color: inherit; }
  .map-search-row .btn-ghost[hidden] { display: none !important; }
  .plot-label-hold { background: rgba(16,18,24,0.72); color: #f4f1e8 !important; }
  .map-total { font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--spectral-dim); margin: 0 0 8px; }
  .map-new { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin: 8px 0; }
  .map-new[hidden] { display: none !important; }
  .map-new input, .map-new select { flex: 1; min-width: 8rem; }
  .plot-hit { cursor: pointer; border-radius: var(--radius); }
  .plot-hit.is-on { outline: 1px solid var(--leaf); }
  .map-card a { color: inherit; }
  .map-toast { position: absolute; left: 10px; right: 10px; bottom: 10px; z-index: 5; margin: 0; padding: 8px 10px; background: color-mix(in oklab, var(--void) 92%, transparent); border-radius: var(--radius); }
  .map-toast[hidden] { display: none !important; }
  .plot-label { background: rgba(255,255,255,0.92); padding: 2px 7px; border-radius: 2px; }
  .map-card { font: inherit; min-width: 0; max-width: min(240px, 70vw); }
  .map-card-del { margin-top: 8px; font: inherit; font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; }
  .map-chip-new { border-style: dashed; }
  .map-search-row .btn-ghost.is-on { border-color: var(--leaf); color: var(--leaf); }
  .land-book { width: 100%; border-collapse: collapse; font-size: 14px; }
  .land-book th, .land-book td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--hairline); }
  .land-book th { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--spectral-dim); }
  .land-book-row { cursor: pointer; }
  .land-book-row.is-on td { color: var(--leaf); }
  .land-book-hold td { color: var(--spectral-dim); }
  .map-tools { position: absolute; left: 8px; top: 8px; z-index: 6; display: flex; flex-wrap: wrap; gap: 6px; }
  .map-tools .btn-ghost, .map-tools .btn-primary { padding: 6px 10px; font-size: 11px; }
`,
    solar: wxSkin.solar,
    wx: wxSkin.wx,
  })}
  <main>
    <h1 data-i18n="land_title">Land</h1>
    <p class="sub"><span data-i18n="land_plots">Plots and plantings</span> · ${escapeHtml(farm.name)}</p>
    <p class="hint" data-i18n="land_howto">Plots and plantings are the land ledger. Viewing is open. Sign in to add a plot, planting, stage, or growth photo.</p>

    <section class="panel">
      <h2 data-i18n="land_map">Fields</h2>
      <p class="hint" data-i18n="land_map_howto">First draw each location you farm (e.g. Sarampovo). Then pasture, orchard, hay, pond, equipment only inside that line. Tap a shape: Adjust corners, or Move to drag the whole field. While drawing, tap once per corner — a drag pans the map.</p>
      <div class="map-search-row no-print">
        <input id="map-search" type="search" autocomplete="off" data-i18n-placeholder="land_map_search_ph" placeholder="Town or field…" />
        <button type="button" class="btn-ghost" id="map-go" data-i18n="land_map_go">Go</button>
        <button type="button" class="btn-ghost admin-only" id="map-holding" data-i18n="land_map_holding">New location</button>
        <button type="button" class="btn-ghost admin-only" id="map-draw" data-i18n="land_map_draw">Draw field</button>
        <button type="button" class="btn-ghost admin-only" id="map-pond" data-i18n="land_map_pond">Place pond</button>
        <button type="button" class="btn-ghost admin-only" id="map-equip" data-i18n="land_map_equip">Place equipment</button>
        <button type="button" class="btn-ghost admin-only" id="map-edit" data-i18n="land_map_edit">Adjust corners</button>
        <button type="button" class="btn-ghost admin-only" id="map-move" data-i18n="land_map_move">Move</button>
      </div>
      <p class="map-total no-print" id="map-total"></p>
      <div id="map-chips" class="map-chips no-print"></div>
      <div id="map-new" class="map-new no-print" hidden>
        <input id="map-new-name" maxlength="120" data-i18n-placeholder="land_name" placeholder="Name" />
        <select id="map-new-use">${plotUseOptionsHtml("garden")}</select>
        <button type="button" class="btn-primary" id="map-new-save" data-i18n="land_save_plot">Save plot</button>
      </div>
      <div class="farm-map-wrap">
        <div class="map-tools no-print admin-only">
          <button type="button" class="btn-primary" id="map-done" hidden data-i18n="land_map_done">Done</button>
          <button type="button" class="btn-ghost" id="map-undo" hidden data-i18n="land_map_undo">Undo corner</button>
          <button type="button" class="btn-ghost" id="map-cancel" hidden data-i18n="land_map_cancel">Cancel</button>
        </div>
        <div id="farm-map" class="farm-map" data-farm-name="${escapeHtml(farm.name)}" data-lat="${farm.lat ?? ""}" data-lon="${farm.lon ?? ""}" data-maps-key="${escapeHtml(mapsKey)}"></div>
        <div class="map-toast msg" id="map-msg" hidden></div>
      </div>
    </section>

    <section class="panel">
      <h2 data-i18n="land_book">Where things sit</h2>
      <p class="hint" data-i18n="land_book_hint">Each location, then the fields, ponds, and equipment drawn inside it.</p>
      <div style="overflow-x:auto">
        <table class="land-book">
          <thead>
            <tr>
              <th data-i18n="land_book_loc">Location</th>
              <th data-i18n="land_name">Name</th>
              <th data-i18n="land_type">Type</th>
              <th data-i18n="land_hectares">Hectares</th>
            </tr>
          </thead>
          <tbody id="land-book-body"></tbody>
        </table>
      </div>
    </section>

    <section class="panel">
      <h2 data-i18n="land_plots">Plots and plantings</h2>
      <ul>${plotsHtml}</ul>
    </section>

    <section class="panel admin-only">
      <h2 data-i18n="land_new_plot">New plot</h2>
      <form id="form-plot">
        <label for="plot-name" data-i18n="land_name">Name</label>
        <input id="plot-name" name="name" required maxlength="120" />
        <div class="grid2">
          <div>
            <label for="plot-use" data-i18n="land_type">Type</label>
            <select id="plot-use" name="use_type">
              ${plotUseOptionsHtml("garden")}
            </select>
          </div>
          <div>
            <label for="plot-ha" data-i18n="land_hectares">Hectares (optional)</label>
            <input id="plot-ha" name="hectares" type="number" step="0.01" min="0" />
          </div>
        </div>
        <label for="plot-notes" data-i18n="land_notes">Notes</label>
        <textarea id="plot-notes" name="notes" maxlength="2000"></textarea>
        <div class="actions"><button class="btn-primary" type="submit" data-i18n="land_save_plot">Save plot</button></div>
        <div class="msg" id="plot-msg"></div>
      </form>
    </section>

    <section class="panel admin-only">
      <h2 data-i18n="land_new_planting">New planting</h2>
      <form id="form-planting">
        <label for="plant-plot" data-i18n="land_plot">Plot</label>
        <select id="plant-plot" name="plot_id" required>${plotOptions}</select>
        <div class="grid2">
          <div>
            <label for="plant-crop" data-i18n="land_crop">Crop</label>
            <input id="plant-crop" name="crop" required maxlength="120" />
          </div>
          <div>
            <label for="plant-variety" data-i18n="land_variety">Variety</label>
            <input id="plant-variety" name="variety" maxlength="120" />
          </div>
        </div>
        <div class="grid2">
          <div>
            <label for="plant-stage" data-i18n="land_stage">Stage</label>
            <select id="plant-stage" name="stage">
              <option value="planned">planned</option>
              <option value="seeded">seeded</option>
              <option value="growing">growing</option>
              <option value="harvest">harvest</option>
              <option value="fallow">fallow</option>
            </select>
          </div>
          <div>
            <label for="plant-on" data-i18n="land_planted">Planted (ISO date)</label>
            <input id="plant-on" name="planted_on" placeholder="2026-08-31" />
          </div>
        </div>
        <div class="actions"><button class="btn-primary" type="submit" data-i18n="land_save_planting">Save planting</button></div>
        <div class="msg" id="plant-msg"></div>
      </form>
    </section>

    <section class="panel admin-only">
      <h2 data-i18n="land_update_stage">Update stage</h2>
      <form id="form-patch">
        <label for="patch-id" data-i18n="land_planting">Planting</label>
        <select id="patch-id" name="id" required>${plantingOptions}</select>
        <label for="patch-stage" data-i18n="land_new_stage">New stage</label>
        <select id="patch-stage" name="stage">
          <option value="planned">planned</option>
          <option value="seeded">seeded</option>
          <option value="growing">growing</option>
          <option value="harvest">harvest</option>
          <option value="fallow">fallow</option>
        </select>
        <label for="patch-yield" data-i18n="land_yield">Yield kg (optional)</label>
        <input id="patch-yield" name="yield_kg" type="number" step="0.1" min="0" />
        <div class="actions"><button class="btn-ghost" type="submit" data-i18n="land_update">Update</button></div>
        <div class="msg" id="patch-msg"></div>
      </form>
    </section>

    <section class="panel">
      <h2 data-i18n="land_growth_photo">Growth photo</h2>
      <form id="form-media" class="admin-only">
        <label for="media-file">JPEG / PNG / WebP ≤ 5 MB</label>
        <input id="media-file" name="file" type="file" accept="image/jpeg,image/png,image/webp" required />
        <label for="media-plot" data-i18n="land_plot_opt">Plot (optional)</label>
        <select id="media-plot" name="plot_id">
          <option value="">—</option>
          ${plotOptions}
        </select>
        <label for="media-planting" data-i18n="land_planting_opt">Planting (optional)</label>
        <select id="media-planting" name="planting_id">
          <option value="">—</option>
          ${plantingOptions}
        </select>
        <label for="media-caption" data-i18n="land_caption">Caption</label>
        <input id="media-caption" name="caption" maxlength="500" />
        <div class="actions"><button class="btn-ghost" type="submit">Upload</button></div>
        <div class="msg" id="media-msg"></div>
      </form>
      <div class="thumbs">${thumbs}</div>
    </section>

    ${siteFooter()}
  </main>
  </div>
  ${bootScripts(LAND_MAP_JS)}
  <script>
    function jsonHeaders() {
      return { "Content-Type": "application/json" };
    }

    function setMsg(el, text, err) {
      el.textContent = text || "";
      el.className = "msg" + (err ? " err" : "");
    }


    document.getElementById("form-plot").onsubmit = async (e) => {
      e.preventDefault();
      const msg = document.getElementById("plot-msg");
      const ha = document.getElementById("plot-ha").value;
      const body = {
        farm_slug: FARM,
        name: document.getElementById("plot-name").value.trim(),
        use_type: document.getElementById("plot-use").value,
        notes: document.getElementById("plot-notes").value.trim() || null,
        hectares: ha ? Number(ha) : null
      };
      try {
        const res = await fetch("/v1/plots", {
          method: "POST",
          credentials: "include",
          headers: jsonHeaders(),
          body: JSON.stringify(body)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || res.statusText);
        setMsg(msg, t("land_plot_saved", { id: data.id }));
        location.reload();
      } catch (err) {
        setMsg(msg, String(err.message || err), true);
      }
    };

    document.getElementById("form-planting").onsubmit = async (e) => {
      e.preventDefault();
      const msg = document.getElementById("plant-msg");
      const body = {
        plot_id: document.getElementById("plant-plot").value,
        crop: document.getElementById("plant-crop").value.trim(),
        variety: document.getElementById("plant-variety").value.trim() || null,
        stage: document.getElementById("plant-stage").value,
        planted_on: document.getElementById("plant-on").value.trim() || null
      };
      try {
        const res = await fetch("/v1/plantings", {
          method: "POST",
          credentials: "include",
          headers: jsonHeaders(),
          body: JSON.stringify(body)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || res.statusText);
        setMsg(msg, t("land_planting_saved", { id: data.id }));
        location.reload();
      } catch (err) {
        setMsg(msg, String(err.message || err), true);
      }
    };

    document.getElementById("form-patch").onsubmit = async (e) => {
      e.preventDefault();
      const msg = document.getElementById("patch-msg");
      const id = document.getElementById("patch-id").value;
      const y = document.getElementById("patch-yield").value;
      const body = {
        stage: document.getElementById("patch-stage").value
      };
      if (y) body.yield_kg = Number(y);
      try {
        const res = await fetch("/v1/plantings/" + id, {
          method: "PATCH",
          credentials: "include",
          headers: jsonHeaders(),
          body: JSON.stringify(body)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || res.statusText);
        setMsg(msg, t("land_updated", { stage: data.stage || "" }));
        location.reload();
      } catch (err) {
        setMsg(msg, String(err.message || err), true);
      }
    };

    document.getElementById("form-media").onsubmit = async (e) => {
      e.preventDefault();
      const msg = document.getElementById("media-msg");
      const fd = new FormData();
      const file = document.getElementById("media-file").files[0];
      if (!file) return setMsg(msg, t("land_pick_file"), true);
      fd.append("file", file);
      fd.append("farm_slug", FARM);
      const plot = document.getElementById("media-plot").value;
      const planting = document.getElementById("media-planting").value;
      const caption = document.getElementById("media-caption").value.trim();
      if (plot) fd.append("plot_id", plot);
      if (planting) fd.append("planting_id", planting);
      if (caption) fd.append("caption", caption);
      try {
        const res = await fetch("/v1/media", {
          method: "POST",
          credentials: "include",
          body: fd
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || res.statusText);
        setMsg(msg, "Upload OK · " + data.id);
        location.reload();
      } catch (err) {
        setMsg(msg, String(err.message || err), true);
      }
    };

    opRefreshGate();
  </script>
</body>
</html>`);
}
