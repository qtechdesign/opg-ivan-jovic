import type { Context } from "hono";
import {
  CHASSIS_CSS,
  escapeHtml,
  farmBrand,
  farmPath,
  FARM_SLUG_JS,
  siteNav,
} from "../lib/html";
import { farmFromRequest } from "../lib/farm";
import { OPERATOR_GATE_HTML, OPERATOR_SESSION_JS } from "../lib/operator-ui";

type AppEnv = { Bindings: Cloudflare.Env };

type PlotRow = {
  id: string;
  name: string;
  use_type: string | null;
  notes: string | null;
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

  let plotsHtml = "<li class=\"dim\">Nema parcela — pokreni seed.</li>";
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

  let yardStill = "";
  if (farm) {
    const snap = await c.env.DB.prepare(
      `SELECT s.camera_id, COALESCE(d.name, s.camera_id) AS name
       FROM camera_snapshots s
       LEFT JOIN devices d ON d.id = s.camera_id
       WHERE s.farm_id = ?
       ORDER BY s.captured_at DESC LIMIT 1`
    )
      .bind(farm.id)
      .first<{ camera_id: string; name: string }>();
    if (snap) {
      const eyesHref = farmPath("/eyes", farm.slug, defaultSlug);
      yardStill = `<section class="panel">
      <h2>${escapeHtml(snap.name)} · snimka</h2>
      <a class="thumbs" href="${eyesHref}" style="display:block;max-width:360px">
        <img src="/v1/cameras/${escapeHtml(snap.camera_id)}/latest" alt="${escapeHtml(snap.name)}" style="width:100%;aspect-ratio:16/9;object-fit:cover;display:block;border:1px solid var(--hairline);border-radius:4px" />
      </a>
    </section>`;
    }
  }

  const farmSlug = farm?.slug ?? "";
  const story =
    farm && farm.slug === defaultSlug
      ? "Kuća iz 1923. · hay, vrt, obitelj · Hrvatska"
      : "Predložak za fork · Europe/Zagreb";

  return c.html(`<!DOCTYPE html>
<html lang="hr" data-solar="day" data-wx="clear" data-farm="${escapeHtml(farmSlug)}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>POLJE · ${escapeHtml(title)}</title>
  <style>${CHASSIS_CSS}
  .metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
  .metric { border: 1px solid var(--hairline); border-radius: 4px; padding: 16px; background: color-mix(in oklab, var(--void-soft) 82%, transparent); }
  .metric .n { font-family: ui-monospace, "IBM Plex Mono", monospace; font-size: 28px; line-height: 1; }
  .metric .u { font-size: 12px; letter-spacing: 0.08em; color: var(--spectral-dim); text-transform: uppercase; margin-left: 6px; }
  .metric .l { font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--spectral-dim); margin-top: 8px; }
  .pip.down::before { background: var(--alarm); }
  @media (max-width: 640px) { .metrics { grid-template-columns: 1fr; } }
  .grok-dock {
    position: sticky;
    bottom: 0;
    border-top: 1px solid var(--hairline);
    background: color-mix(in oklab, var(--void) 92%, transparent);
    padding: 10px 16px 14px;
  }
  .grok-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    max-width: 960px;
    margin: 0 auto;
  }
  .grok-label {
    font-size: 11px;
    letter-spacing: 0.12em;
    color: var(--spectral-dim);
  }
  .grok-brief {
    flex: 1 1 160px;
    font-size: 12px;
    font-family: ui-monospace, "IBM Plex Mono", monospace;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .grok-bar input[type="password"],
  .grok-bar input[type="text"] {
    width: auto;
    flex: 1 1 140px;
    min-width: 120px;
    font-family: ui-monospace, "IBM Plex Mono", monospace;
    font-size: 13px;
    height: 36px;
    padding: 0 10px;
  }
  .grok-bar button { height: 36px; }
  .grok-out {
    max-width: 960px;
    margin: 10px auto 0;
    padding: 12px;
    border: 1px solid var(--hairline);
    border-radius: 4px;
    background: var(--void-soft);
    font-family: ui-monospace, "IBM Plex Mono", monospace;
    font-size: 13px;
    white-space: pre-wrap;
    max-height: 220px;
    overflow: auto;
  }
  </style>
</head>
<body>
  <header>
    ${farmBrand(title, farmSlug, defaultSlug)}
    ${siteNav(farmSlug || defaultSlug, defaultSlug)}
    <span class="pip ${statusClass}" id="starlink-pip">STARLINK · —</span>
  </header>
  <main>
    <h1>${escapeHtml(title)}</h1>
    <p class="sub">${story}</p>
    <div class="metrics">
      <div class="metric"><div><span class="n" id="m-temp">—</span><span class="u">°C</span></div><div class="l">Temp</div></div>
      <div class="metric"><div><span class="n" id="m-kw">—</span><span class="u">kW</span></div><div class="l">Solar</div></div>
      <div class="metric"><div><span class="n" id="m-soil">—</span><span class="u">moist</span></div><div class="l">Tlo</div></div>
      <div class="metric"><div><span class="n" id="m-edge">—</span><span class="u">seen</span></div><div class="l">Edge</div></div>
    </div>
    <section class="panel">
      <h2>Voda</h2>
      <ul>
        <li class="row"><span class="name" id="water-lock">Kišni lockout · —</span><span class="meta"><a href="/water">otvori</a></span></li>
        <li class="row"><span class="name" id="water-last">Zadnje kap · —</span><span class="meta" id="water-state">—</span></li>
      </ul>
    </section>
    <section class="panel">
      <h2>Parcele</h2>
      <ul>${plotsHtml}</ul>
    </section>
    ${yardStill}
    <p class="actions">
      <a class="btn-ghost" href="${farmPath("/klima", farmSlug, defaultSlug)}">Klima</a>
      <a class="btn-ghost" href="${farmPath("/water", farmSlug, defaultSlug)}">Voda</a>
      <a class="btn-ghost" href="${farmPath("/eyes", farmSlug, defaultSlug)}">Pogled na farme</a>
      <a class="btn-ghost" href="${farmPath("/land", farmSlug, defaultSlug)}">Zemlja</a>
    </p>
    <footer>Polje is the field. The field was here first. · <a href="/login">Admin</a></footer>
  </main>
  <aside id="grok-dock" class="grok-dock" aria-label="Grok">
    <div class="grok-bar">
      <span class="grok-label">GROK</span>
      <span id="grok-brief" class="grok-brief dim"></span>
      <input id="grok-input" class="admin-only" type="text" autocomplete="off" placeholder="Pitaj farmu…" />
      <button type="button" class="btn-ghost admin-only" id="grok-send">Šalji</button>
    </div>
    <pre id="grok-out" class="grok-out" hidden></pre>
  </aside>
  <script>
    ${FARM_SLUG_JS}
    ${OPERATOR_SESSION_JS}
    const pip = document.getElementById("starlink-pip");
    const elTemp = document.getElementById("m-temp");
    const elKw = document.getElementById("m-kw");
    const elSoil = document.getElementById("m-soil");
    const elEdge = document.getElementById("m-edge");

    function applyLive(live, energy) {
      if (!live) return;
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
        ? new Date(live.edge_seen_at).toLocaleTimeString("hr-HR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
        : "—";
    }

    async function refresh() {
      try {
        const res = await fetch("/v1/overview?farm=" + encodeURIComponent(FARM));
        const data = await res.json();
        applyLive(data.live, data.energy);
        const irr = data.irrigation;
        const elLock = document.getElementById("water-lock");
        const elLast = document.getElementById("water-last");
        const elState = document.getElementById("water-state");
        if (irr && elLock) {
          elLock.textContent = "Kišni lockout · " + (irr.rain_lockout ? "ON" : "OFF");
          const drip = (irr.zones || []).find(z => z.kind === "drip");
          if (elState && drip) elState.textContent = drip.state || "idle";
          if (elLast && irr.last_drip) {
            elLast.textContent = "Zadnje kap · " + new Date(irr.last_drip.started_at).toLocaleString("hr-HR");
          } else if (elLast) {
            elLast.textContent = "Zadnje kap · —";
          }
        }
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

    (function grokDock() {
      const inp = document.getElementById("grok-input");
      const out = document.getElementById("grok-out");
      const brief = document.getElementById("grok-brief");
      const send = document.getElementById("grok-send");
      if (!inp || !send || !out || !brief) return;

      fetch("/v1/grok/briefing/today?farm=" + encodeURIComponent(FARM))
        .then((r) => r.json())
        .then((d) => {
          if (d.briefing && d.briefing.body_hr) {
            brief.textContent = d.briefing.body_hr.slice(0, 120) + (d.briefing.body_hr.length > 120 ? "…" : "");
            brief.title = d.briefing.body_hr + "\\n\\n" + (d.briefing.body_en || "");
          } else {
            brief.textContent = "nema briefinga danas";
          }
        })
        .catch(() => { brief.textContent = ""; });

      async function ask() {
        const message = (inp.value || "").trim();
        if (!message) return;
        out.hidden = false;
        out.textContent = "…";
        send.disabled = true;
        try {
          const res = await fetch("/v1/grok/chat", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ farm_slug: FARM, message }),
          });
          const data = await res.json();
          if (res.status === 401) {
            out.textContent = "Prijavi se (Admin) pa pitaj.";
          } else if (!res.ok) {
            out.textContent = data.error || ("HTTP " + res.status);
          } else {
            out.textContent = data.reply || "(prazno)";
          }
        } catch (e) {
          out.textContent = String(e);
        }
        send.disabled = false;
      }
      send.addEventListener("click", ask);
      inp.addEventListener("keydown", (e) => {
        if (e.key === "Enter") ask();
      });
    })();
    opRefreshGate();
  </script>
</body>
</html>`);
}

export async function renderLand(c: Context<AppEnv>) {
  const { farm, defaultSlug } = await farmFromRequest(c);

  if (!farm) {
    return c.html(
      `<!DOCTYPE html><html lang="hr"><body><p>Farm not seeded.</p></body></html>`,
      404
    );
  }

  const { results: plots } = await c.env.DB.prepare(
    `SELECT id, name, use_type, notes FROM plots WHERE farm_id = ? ORDER BY name`
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
                ? `<ul class="nest"><li class="dim">Nema sađenja</li></ul>`
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
            return `<li>
              <div class="row"><span>${escapeHtml(plot.name)}</span>
              <span class="meta">${escapeHtml(plot.use_type || "—")}</span></div>
              ${nest}
            </li>`;
          })
          .join("")
      : `<li class="dim">Nema parcela</li>`;

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
      : `<p class="dim">Još nema fotografija rasta.</p>`;

  return c.html(`<!DOCTYPE html>
<html lang="hr" data-solar="day" data-wx="clear" data-farm="${escapeHtml(farm.slug)}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>POLJE · Zemlja</title>
  <style>${CHASSIS_CSS}</style>
</head>
<body>
  <header>
    ${farmBrand(farm.name, farm.slug, defaultSlug)}
    ${siteNav(farm.slug, defaultSlug)}
    <span class="pip ok">LAND</span>
  </header>
  <main>
    <h1>Zemlja</h1>
    <p class="sub">Ledger parcela i sađenja · ${escapeHtml(farm.name)}</p>

    ${OPERATOR_GATE_HTML}


    <section class="panel">
      <h2>Parcele i sađenja</h2>
      <ul>${plotsHtml}</ul>
    </section>

    <section class="panel admin-only">
      <h2>Nova parcela</h2>
      <form id="form-plot">
        <label for="plot-name">Naziv</label>
        <input id="plot-name" name="name" required maxlength="120" />
        <div class="grid2">
          <div>
            <label for="plot-use">Tip</label>
            <select id="plot-use" name="use_type">
              <option value="yard">yard</option>
              <option value="hay">hay</option>
              <option value="pasture">pasture</option>
              <option value="garden">garden</option>
              <option value="orchard">orchard</option>
              <option value="greenhouse">greenhouse</option>
              <option value="other">other</option>
            </select>
          </div>
          <div>
            <label for="plot-ha">Hektari (opcionalno)</label>
            <input id="plot-ha" name="hectares" type="number" step="0.01" min="0" />
          </div>
        </div>
        <label for="plot-notes">Bilješke</label>
        <textarea id="plot-notes" name="notes" maxlength="2000"></textarea>
        <div class="actions"><button class="btn-ghost" type="submit">Spremi parcelu</button></div>
        <div class="msg" id="plot-msg"></div>
      </form>
    </section>

    <section class="panel admin-only">
      <h2>Novo sađenje</h2>
      <form id="form-planting">
        <label for="plant-plot">Parcela</label>
        <select id="plant-plot" name="plot_id" required>${plotOptions}</select>
        <div class="grid2">
          <div>
            <label for="plant-crop">Usjev</label>
            <input id="plant-crop" name="crop" required maxlength="120" />
          </div>
          <div>
            <label for="plant-variety">Sorta</label>
            <input id="plant-variety" name="variety" maxlength="120" />
          </div>
        </div>
        <div class="grid2">
          <div>
            <label for="plant-stage">Faza</label>
            <select id="plant-stage" name="stage">
              <option value="planned">planned</option>
              <option value="seeded">seeded</option>
              <option value="growing">growing</option>
              <option value="harvest">harvest</option>
              <option value="fallow">fallow</option>
            </select>
          </div>
          <div>
            <label for="plant-on">Posađeno (ISO datum)</label>
            <input id="plant-on" name="planted_on" placeholder="2026-08-31" />
          </div>
        </div>
        <div class="actions"><button class="btn-ghost" type="submit">Spremi sađenje</button></div>
        <div class="msg" id="plant-msg"></div>
      </form>
    </section>

    <section class="panel admin-only">
      <h2>Ažuriraj fazu</h2>
      <form id="form-patch">
        <label for="patch-id">Sađenje</label>
        <select id="patch-id" name="id" required>${plantingOptions}</select>
        <label for="patch-stage">Nova faza</label>
        <select id="patch-stage" name="stage">
          <option value="planned">planned</option>
          <option value="seeded">seeded</option>
          <option value="growing">growing</option>
          <option value="harvest">harvest</option>
          <option value="fallow">fallow</option>
        </select>
        <label for="patch-yield">Prinos kg (opcionalno)</label>
        <input id="patch-yield" name="yield_kg" type="number" step="0.1" min="0" />
        <div class="actions"><button class="btn-ghost" type="submit">Ažuriraj</button></div>
        <div class="msg" id="patch-msg"></div>
      </form>
    </section>

    <section class="panel">
      <h2>Fotografija rasta</h2>
      <form id="form-media" class="admin-only">
        <label for="media-file">JPEG / PNG / WebP ≤ 5 MB</label>
        <input id="media-file" name="file" type="file" accept="image/jpeg,image/png,image/webp" required />
        <label for="media-plot">Parcela (opcionalno)</label>
        <select id="media-plot" name="plot_id">
          <option value="">—</option>
          ${plotOptions}
        </select>
        <label for="media-planting">Sađenje (opcionalno)</label>
        <select id="media-planting" name="planting_id">
          <option value="">—</option>
          ${plantingOptions}
        </select>
        <label for="media-caption">Opis</label>
        <input id="media-caption" name="caption" maxlength="500" />
        <div class="actions"><button class="btn-ghost" type="submit">Upload</button></div>
        <div class="msg" id="media-msg"></div>
      </form>
      <div class="thumbs">${thumbs}</div>
    </section>

    <footer>Polje is the field. The field was here first.</footer>
  </main>
  <script>
    ${FARM_SLUG_JS}
    ${OPERATOR_SESSION_JS}

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
        setMsg(msg, "Parcela spremljena · " + data.id);
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
        setMsg(msg, "Sađenje spremljeno · " + data.id);
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
        setMsg(msg, "Ažurirano · " + (data.stage || ""));
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
      if (!file) return setMsg(msg, "Odaberi datoteku", true);
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
