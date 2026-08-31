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
      `<!DOCTYPE html><html lang="hr"><body><p>Farm nije seeded.</p></body></html>`,
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
      ? `<li class="dim">Nema zona — pokreni seed.</li>`
      : zoneViews
          .map((z) => {
            const kindHr = z.kind === "frost" ? "mraz" : "kap po kap";
            const accent = z.kind === "frost" ? "ice" : "leaf";
            const last =
              z.last_run != null
                ? new Date(z.last_run.started_at).toLocaleString("hr-HR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "—";
            return `<li class="row zone" data-id="${escapeHtml(z.id)}" data-kind="${escapeHtml(z.kind)}" data-default="${z.default_duration_sec}" data-max="${z.max_duration_sec}">
        <div>
          <span class="name">${escapeHtml(z.name)}</span>
          <span class="kind ${accent}">${kindHr}</span>
          <div class="meta">uređaj ${escapeHtml(z.device_id)} · zadnje ${escapeHtml(last)}</div>
        </div>
        <span class="state ${z.state === "running" ? "run" : ""}">${z.state === "running" ? "RADI" : "MIR"}</span>
      </li>`;
          })
          .join("");

  const options = zoneViews
    .map(
      (z) =>
        `<option value="${escapeHtml(z.id)}">${escapeHtml(z.name)} (${z.kind === "frost" ? "mraz" : "kap"})</option>`
    )
    .join("");

  return c.html(`<!DOCTYPE html>
<html lang="hr" data-solar="day" data-wx="clear" data-farm="${escapeHtml(farm.slug)}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>POLJE · Voda</title>
  <style>${CHASSIS_CSS}
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
  label { display: block; margin-top: 12px; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--spectral-dim); }
  input, select, textarea {
    width: 100%; margin-top: 6px; padding: 10px 12px;
    background: var(--void); color: var(--spectral);
    border: 1px solid var(--hairline); border-radius: 4px; font: inherit;
  }
  .check { display: flex; align-items: center; gap: 8px; margin-top: 12px; text-transform: none; letter-spacing: 0; font-size: 14px; color: var(--spectral); }
  .check input { width: auto; margin: 0; }
  .pip.lock::before { background: var(--ice); }
  .pip.lock.on::before { background: var(--alarm); }
  </style>
</head>
<body>
  <header>
    ${farmBrand(farm.name, farm.slug, defaultSlug)}
    ${siteNav(farm.slug, defaultSlug)}
    <span class="pip lock ${rainLock ? "on" : ""}" id="rain-pip">KIŠA · ${rainLock ? "ZAKLJUČANO" : "OTVORÉNO"}</span>
  </header>
  <main>
    <h1>Voda</h1>
    <p class="sub">Kap po kap + mraz linija · Edge zatvara ventil · confirm za pokretanje</p>

    <section class="panel">
      <h2>Zone</h2>
      <ul id="zones">${zonesHtml}</ul>
    </section>

    <section class="panel admin-only">
      <h2>Pokreni (confirm)</h2>
      <p class="dim">Bez confirm → samo prijedlog. Kap po kap blokira kišni lockout; mraz ne.</p>
      <form id="form-run">
        <label for="zone">Zona</label>
        <select id="zone" required>${options}</select>
        <label for="duration">Trajanje (sek)</label>
        <input id="duration" type="number" min="30" max="3600" value="600" required />
        <label for="reason">Razlog (audit)</label>
        <input id="reason" required minlength="3" maxlength="500" placeholder="npr. vrt suh nakon podneva" />
        <label class="check"><input id="confirm" type="checkbox" /> confirm: true</label>
        <div class="actions"><button class="btn-ghost" type="submit">Pokreni</button></div>
        <div class="msg" id="run-msg"></div>
      </form>
    </section>

    <section class="panel admin-only">
      <h2>Kišni lockout</h2>
      <p class="dim">Samo za drip. Mraz program (kad dođe M4) nije blokiran.</p>
      <form id="form-lock">
        <label class="check"><input id="lock-on" type="checkbox" ${rainLock ? "checked" : ""} /> Uključi lockout</label>
        <label for="lock-reason">Razlog</label>
        <input id="lock-reason" required minlength="3" maxlength="500" placeholder="npr. kiša danas" />
        <label class="check"><input id="lock-confirm" type="checkbox" /> confirm: true</label>
        <div class="actions"><button class="btn-ghost" type="submit">Spremi</button></div>
        <div class="msg" id="lock-msg"></div>
      </form>
    </section>

    ${OPERATOR_GATE_HTML}

    <footer>Edge je write-leader · lokalni timeout gasi ventil · Dewline packing kasnije</footer>
  </main>
  <script>
    ${FARM_SLUG_JS}
    ${OPERATOR_SESSION_JS}

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
          setMsg(msg, "Prijedlog (nije pokrenuto). Uključi confirm: true.", false);
          return;
        }
        if (!res.ok) {
          setMsg(msg, data.error || data.message || ("HTTP " + res.status), true);
          return;
        }
        setMsg(msg, "Poslano · command " + (data.command_id || "").slice(0, 8), false);
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
          setMsg(msg, "Prijedlog. Uključi confirm: true.", false);
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
