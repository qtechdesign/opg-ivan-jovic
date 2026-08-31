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

type AutoRow = {
  id: string;
  name: string;
  enabled: number;
  risk: string;
  last_fired_at: string | null;
  last_error: string | null;
  cooldown_sec: number;
};

type JobRow = {
  id: string;
  kind: string;
  status: string;
  reason: string | null;
  created_at: string;
};

type CmdRow = {
  id: string;
  device_id: string;
  action: string;
  status: string;
  created_at: string;
};

export async function renderHands(c: Context<AppEnv>) {
  const { farm, defaultSlug } = await farmFromRequest(c);

  if (!farm) {
    return c.html(
      `<!DOCTYPE html><html lang="hr"><body><p>Farm nije seeded.</p></body></html>`,
      503
    );
  }

  let autos: AutoRow[] = [];
  let jobs: JobRow[] = [];
  let proposed: CmdRow[] = [];
  try {
    const a = await c.env.DB.prepare(
      `SELECT id, name, enabled, risk, last_fired_at, last_error, cooldown_sec
       FROM automations WHERE farm_id = ? ORDER BY name`
    )
      .bind(farm.id)
      .all<AutoRow>();
    autos = a.results ?? [];
  } catch {
    /* migration not applied */
  }
  try {
    const j = await c.env.DB.prepare(
      `SELECT id, kind, status, reason, created_at FROM jobs
       WHERE farm_id = ? ORDER BY created_at DESC LIMIT 30`
    )
      .bind(farm.id)
      .all<JobRow>();
    jobs = j.results ?? [];
  } catch {
    /* migration not applied */
  }
  try {
    const cmds = await c.env.DB.prepare(
      `SELECT id, device_id, action, status, created_at FROM commands
       WHERE farm_id = ? AND status = 'proposed' ORDER BY created_at DESC LIMIT 20`
    )
      .bind(farm.id)
      .all<CmdRow>();
    proposed = cmds.results ?? [];
  } catch {
    /* ignore */
  }

  const autoHtml =
    autos.length === 0
      ? `<li class="dim">Nema automatizacija — pokreni seed / migraciju M9.</li>`
      : autos
          .map((a) => {
            const pip = a.enabled ? "ok" : "warn";
            const riskClass =
              a.risk === "high"
                ? "risk-high"
                : a.risk === "low"
                  ? "risk-low"
                  : "risk-medium";
            return `<li class="row" data-id="${escapeHtml(a.id)}">
        <span>
          <span class="pip ${pip}" style="margin-right:8px">${a.enabled ? "ON" : "OFF"}</span>
          <span class="name">${escapeHtml(a.name)}</span>
          <span class="meta ${riskClass}"> · ${escapeHtml(a.risk)}</span>
          ${a.last_fired_at ? `<span class="meta"> · zadnje ${escapeHtml(a.last_fired_at)}</span>` : ""}
          ${a.last_error ? `<span class="meta risk-high"> · ${escapeHtml(a.last_error)}</span>` : ""}
        </span>
        <span class="actions" style="margin:0">
          <button type="button" class="btn-ghost btn-fire" data-id="${escapeHtml(a.id)}">Pokreni</button>
          ${
            a.enabled
              ? `<button type="button" class="btn-ghost btn-disable" data-id="${escapeHtml(a.id)}">Isključi</button>`
              : `<button type="button" class="btn-alarm btn-enable" data-id="${escapeHtml(a.id)}" data-risk="${escapeHtml(a.risk)}">Uključi</button>`
          }
        </span>
      </li>`;
          })
          .join("");

  const jobsHtml =
    jobs.length === 0
      ? `<li class="dim">Red poslova prazan.</li>`
      : jobs
          .map(
            (j) => `<li class="row" data-job="${escapeHtml(j.id)}">
        <span>
          <span class="name">${escapeHtml(j.kind)}</span>
          <span class="meta"> · ${escapeHtml(j.status)}</span>
          ${j.reason ? `<span class="meta"> · ${escapeHtml(j.reason)}</span>` : ""}
        </span>
        <span class="actions" style="margin:0">
          ${
            j.status === "proposed"
              ? `<button type="button" class="btn-alarm btn-job-confirm" data-id="${escapeHtml(j.id)}">Potvrdi</button>
                 <button type="button" class="btn-ghost btn-job-cancel" data-id="${escapeHtml(j.id)}">Otkaži</button>`
              : j.status === "queued" || j.status === "confirmed"
                ? `<button type="button" class="btn-ghost btn-job-cancel" data-id="${escapeHtml(j.id)}">Otkaži</button>`
                : ""
          }
        </span>
      </li>`
          )
          .join("");

  const proposedHtml =
    proposed.length === 0
      ? `<li class="dim">Nema predloženih naredbi.</li>`
      : proposed
          .map(
            (p) => `<li class="row">
        <span>
          <span class="name">${escapeHtml(p.action)}</span>
          <span class="meta"> · ${escapeHtml(p.device_id)}</span>
        </span>
        <span class="actions" style="margin:0">
          <button type="button" class="btn-alarm btn-cmd-confirm" data-id="${escapeHtml(p.id)}">Potvrdi</button>
        </span>
      </li>`
          )
          .join("");

  return c.html(`<!DOCTYPE html>
<html lang="hr" data-solar="day" data-wx="clear">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>POLJE · Ruke</title>
  <style>${CHASSIS_CSS}
  main { max-width: 960px; }
  </style>
</head>
<body>
  <header>
    <span class="brand">Polje · OPG Ivan Jović</span>
    ${SITE_NAV}
    <span class="pip ok">RUKE</span>
  </header>
  <main>
    <h1>Ruke</h1>
    <p class="sub">Automatizacije + red poslova · voda / toplina / metal treba confirm · ${escapeHtml(farm.name)}</p>

    ${OPERATOR_GATE_HTML}

    <section class="panel">
      <h2>Automatizacije</h2>
      <p class="dim">High/medium risk se ne uključuje bez confirm:true + razlog. Seed pravila su isključena.</p>
      <ul id="auto-list">${autoHtml}</ul>
      <label for="enable-reason">Razlog (za uključivanje)</label>
      <input id="enable-reason" maxlength="500" placeholder="npr. test rule overnight" />
      <label><input id="enable-confirm" type="checkbox" style="width:auto;margin-right:8px" /> confirm: true</label>
      <div class="msg" id="auto-msg"></div>
    </section>

    <section class="panel">
      <h2>Red poslova (robot / AI)</h2>
      <ul id="job-list">${jobsHtml}</ul>
      <h2 style="margin-top:24px">Novi posao</h2>
      <form id="form-job">
        <label for="job-kind">Vrsta</label>
        <select id="job-kind">
          <option value="robot.mow">robot.mow</option>
          <option value="robot.inspect">robot.inspect</option>
          <option value="ai.build">ai.build</option>
          <option value="scene">scene</option>
          <option value="note">note</option>
        </select>
        <label for="job-reason">Napomena</label>
        <input id="job-reason" maxlength="500" placeholder="opcionalno" />
        <div class="actions"><button class="btn-ghost" type="submit">Stvori (proposed)</button></div>
      </form>
      <div class="msg" id="job-msg"></div>
    </section>

    <section class="panel">
      <h2>Predložene naredbe</h2>
      <p class="dim">Voda / aktuatori ostaju proposed dok ne potvrdiš. Edge izvršava samo snapshot.take.</p>
      <ul id="cmd-list">${proposedHtml}</ul>
      <label for="cmd-reason">Razlog potvrde</label>
      <input id="cmd-reason" maxlength="500" placeholder="npr. garden dry, run drip 10m" />
      <label><input id="cmd-confirm" type="checkbox" style="width:auto;margin-right:8px" /> confirm: true</label>
      <div class="msg" id="cmd-msg"></div>
    </section>

    <footer>M9 Hands · local failsafe first · cloud predlaže, čovjek potvrđuje metal i vodu</footer>
  </main>
  <script>
    ${OPERATOR_SESSION_JS}

    function jsonHeaders() {
      return { "Content-Type": "application/json" };
    }
    function setMsg(el, text, err) {
      el.textContent = text || "";
      el.className = "msg" + (err ? " err" : "");
    }

    document.getElementById("auto-list").addEventListener("click", async (ev) => {
      const btn = ev.target.closest("button");
      if (!btn) return;
      const id = btn.getAttribute("data-id");
      const msg = document.getElementById("auto-msg");
      if (btn.classList.contains("btn-fire")) {
        const res = await fetch("/v1/automations/" + id + "/fire", {
          method: "POST",
          credentials: "include",
          headers: jsonHeaders(),
          body: "{}",
        });
        const body = await res.json().catch(() => ({}));
        setMsg(msg, res.ok ? ("Pokrenuto: " + JSON.stringify(body.fired || [])) : (body.error || res.status), !res.ok);
        if (res.ok) setTimeout(() => location.reload(), 600);
        return;
      }
      if (btn.classList.contains("btn-disable")) {
        const res = await fetch("/v1/automations/" + id + "/enable", {
          method: "POST",
          credentials: "include",
          headers: jsonHeaders(),
          body: JSON.stringify({ enabled: false }),
        });
        const body = await res.json().catch(() => ({}));
        setMsg(msg, res.ok ? "Isključeno." : (body.error || res.status), !res.ok);
        if (res.ok) location.reload();
        return;
      }
      if (btn.classList.contains("btn-enable")) {
        const reason = document.getElementById("enable-reason").value.trim();
        const confirm = document.getElementById("enable-confirm").checked;
        const risk = btn.getAttribute("data-risk");
        if (risk !== "low" && (!confirm || reason.length < 3)) {
          setMsg(msg, "Potrebno confirm: true + razlog (≥3).", true);
          return;
        }
        const res = await fetch("/v1/automations/" + id + "/enable", {
          method: "POST",
          credentials: "include",
          headers: jsonHeaders(),
          body: JSON.stringify({ enabled: true, confirm, reason: reason || undefined }),
        });
        const body = await res.json().catch(() => ({}));
        setMsg(msg, res.ok ? "Uključeno." : (body.message || body.error || res.status), !res.ok);
        if (res.ok) location.reload();
      }
    });

    document.getElementById("form-job").onsubmit = async (ev) => {
      ev.preventDefault();
      const msg = document.getElementById("job-msg");
      const res = await fetch("/v1/jobs", {
        method: "POST",
        credentials: "include",
          headers: jsonHeaders(),
        body: JSON.stringify({
          kind: document.getElementById("job-kind").value,
          reason: document.getElementById("job-reason").value.trim() || undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      setMsg(msg, res.ok ? ("Posao " + body.id + " · " + body.status) : (body.error || res.status), !res.ok);
      if (res.ok) setTimeout(() => location.reload(), 500);
    };

    document.getElementById("job-list").addEventListener("click", async (ev) => {
      const btn = ev.target.closest("button");
      if (!btn) return;
      const id = btn.getAttribute("data-id");
      const msg = document.getElementById("job-msg");
      if (btn.classList.contains("btn-job-confirm")) {
        const reason = document.getElementById("enable-reason").value.trim() ||
          document.getElementById("cmd-reason").value.trim() ||
          "operator confirm job";
        if (!document.getElementById("enable-confirm").checked &&
            !document.getElementById("cmd-confirm").checked) {
          setMsg(msg, "Označi confirm: true (gore ili dolje) + razlog.", true);
          return;
        }
        const res = await fetch("/v1/jobs/" + id + "/confirm", {
          method: "POST",
          credentials: "include",
          headers: jsonHeaders(),
          body: JSON.stringify({ confirm: true, reason }),
        });
        const body = await res.json().catch(() => ({}));
        setMsg(msg, res.ok ? "Potvrđeno." : (body.message || body.error || res.status), !res.ok);
        if (res.ok) location.reload();
        return;
      }
      if (btn.classList.contains("btn-job-cancel")) {
        const res = await fetch("/v1/jobs/" + id, {
          method: "PATCH",
          credentials: "include",
          headers: jsonHeaders(),
          body: JSON.stringify({ status: "cancelled" }),
        });
        const body = await res.json().catch(() => ({}));
        setMsg(msg, res.ok ? "Otkazano." : (body.error || res.status), !res.ok);
        if (res.ok) location.reload();
      }
    });

    document.getElementById("cmd-list").addEventListener("click", async (ev) => {
      const btn = ev.target.closest("button.btn-cmd-confirm");
      if (!btn) return;
      const msg = document.getElementById("cmd-msg");
      const reason = document.getElementById("cmd-reason").value.trim();
      const confirm = document.getElementById("cmd-confirm").checked;
      if (!confirm || reason.length < 3) {
        setMsg(msg, "Potrebno confirm: true + razlog.", true);
        return;
      }
      const res = await fetch("/v1/commands/" + btn.getAttribute("data-id") + "/confirm", {
        method: "POST",
        credentials: "include",
          headers: jsonHeaders(),
        body: JSON.stringify({ confirm: true, reason }),
      });
      const body = await res.json().catch(() => ({}));
      setMsg(msg, res.ok ? "Naredba sent." : (body.message || body.error || res.status), !res.ok);
      if (res.ok) location.reload();
    });

    opRefreshGate();
  </script>
</body>
</html>`);
}
