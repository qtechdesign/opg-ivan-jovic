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
      `<!DOCTYPE html><html lang="en"><body><p>Farm not seeded.</p></body></html>`,
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
      ? `<li class="dim" data-i18n="hands_no_autos">No automations — run seed / M9 migration.</li>`
      : autos
          .map((a) => {
            const pip = a.enabled ? "ok" : "warn";
            const riskClass =
              a.risk === "high"
                ? "risk-high"
                : a.risk === "low"
                  ? "risk-low"
                  : "risk-medium";
            return `<li class="row hands-row" data-id="${escapeHtml(a.id)}">
        <span>
          <span class="pip ${pip}" style="margin-right:8px">${a.enabled ? "ON" : "OFF"}</span>
          <span class="name">${escapeHtml(a.name)}</span>
          <span class="meta ${riskClass}"> · ${escapeHtml(a.risk)}</span>
          ${a.last_fired_at ? `<span class="meta"> · last ${escapeHtml(a.last_fired_at)}</span>` : ""}
          ${a.last_error ? `<span class="meta risk-high"> · ${escapeHtml(a.last_error)}</span>` : ""}
        </span>
        <span class="actions admin-only" style="margin:0">
          <button type="button" class="btn-ghost btn-fire" data-id="${escapeHtml(a.id)}" data-i18n="hands_fire">Fire</button>
          ${
            a.enabled
              ? `<button type="button" class="btn-ghost btn-disable" data-id="${escapeHtml(a.id)}" data-i18n="hands_disable">Disable</button>`
              : `<button type="button" class="btn-alarm btn-enable" data-id="${escapeHtml(a.id)}" data-risk="${escapeHtml(a.risk)}" data-i18n="hands_enable">Enable</button>`
          }
        </span>
      </li>`;
          })
          .join("");

  const jobsHtml =
    jobs.length === 0
      ? `<li class="dim" data-i18n="hands_no_jobs">Job queue empty.</li>`
      : jobs
          .map(
            (j) => `<li class="row hands-row" data-job="${escapeHtml(j.id)}">
        <span>
          <span class="name">${escapeHtml(j.kind)}</span>
          <span class="meta"> · ${escapeHtml(j.status)}</span>
          ${j.reason ? `<span class="meta"> · ${escapeHtml(j.reason)}</span>` : ""}
        </span>
        <span class="actions admin-only" style="margin:0">
          ${
            j.status === "proposed"
              ? `<button type="button" class="btn-alarm btn-job-confirm" data-id="${escapeHtml(j.id)}" data-i18n="hands_confirm">Confirm</button>
                 <button type="button" class="btn-ghost btn-job-cancel" data-id="${escapeHtml(j.id)}" data-i18n="hands_cancel">Cancel</button>`
              : j.status === "queued" || j.status === "confirmed"
                ? `<button type="button" class="btn-ghost btn-job-cancel" data-id="${escapeHtml(j.id)}" data-i18n="hands_cancel">Cancel</button>`
                : ""
          }
        </span>
      </li>`
          )
          .join("");

  const proposedHtml =
    proposed.length === 0
      ? `<li class="dim" data-i18n="hands_no_cmds">No proposed commands.</li>`
      : proposed
          .map(
            (p) => `<li class="row hands-row">
        <span>
          <span class="name">${escapeHtml(p.action)}</span>
          <span class="meta"> · ${escapeHtml(p.device_id)}</span>
        </span>
        <span class="actions admin-only" style="margin:0">
          <button type="button" class="btn-alarm btn-cmd-confirm" data-id="${escapeHtml(p.id)}" data-i18n="hands_confirm">Confirm</button>
        </span>
      </li>`
          )
          .join("");

  const wxSkin = weatherNow(farm.timezone, null);
  return c.html(`${pageOpen({
    title: "POLJE · Hands",
    farmName: farm.name,
    farmSlug: farm.slug,
    defaultSlug,
    currentPath: "/hands",
    pipHtml: `<span class="pip ok">HANDS</span>`,
    extraHead: shareHead(c.req.url, "POLJE · Hands", "Automations and jobs. Cloud proposes. Human confirms water and metal."),
    solar: wxSkin.solar,
    wx: wxSkin.wx,
  })}
  <main>
    <h1 data-i18n="hands_title">Hands</h1>
    <p class="sub"><span data-i18n="hands_autos">Automations</span> + job queue · ${escapeHtml(farm.name)}</p>
    <p class="hint" data-i18n="hands_howto">Automations and the job queue. High-risk rules stay off until you enable with confirm + reason. Cloud proposes; you confirm water and metal.</p>

    ${OPERATOR_GATE_HTML}

    <section class="panel">
      <h2 data-i18n="hands_autos">Automations</h2>
      <p class="dim" data-i18n="hands_autos_hint">High/medium risk does not enable without confirm:true + reason. Seed rules start off.</p>
      <ul id="auto-list">${autoHtml}</ul>
      <div class="admin-only">
      <label for="enable-reason" data-i18n="hands_enable_reason">Reason (to enable)</label>
      <input id="enable-reason" maxlength="500" placeholder="e.g. test rule overnight" />
      <label><input id="enable-confirm" type="checkbox" style="width:auto;margin-right:8px" /> confirm: true</label>
      <div class="msg" id="auto-msg"></div>
      </div>
    </section>

    <section class="panel">
      <h2 data-i18n="hands_jobs">Job queue (robot / AI)</h2>
      <ul id="job-list">${jobsHtml}</ul>
      <div class="admin-only">
      <h2 style="margin-top:24px" data-i18n="hands_new_job">New job</h2>
      <form id="form-job">
        <label for="job-kind" data-i18n="hands_kind">Kind</label>
        <select id="job-kind">
          <option value="robot.mow">robot.mow</option>
          <option value="robot.inspect">robot.inspect</option>
          <option value="ai.build">ai.build</option>
          <option value="scene">scene</option>
          <option value="note">note</option>
        </select>
        <label for="job-reason" data-i18n="hands_note">Note</label>
        <input id="job-reason" maxlength="500" data-i18n-placeholder="hands_optional" placeholder="optional" />
        <div class="actions"><button class="btn-ghost" type="submit" data-i18n="hands_create">Create (proposed)</button></div>
      </form>
      <div class="msg" id="job-msg"></div>
      </div>
    </section>

    <section class="panel">
      <h2 data-i18n="hands_proposed">Proposed commands</h2>
      <p class="dim" data-i18n="hands_proposed_hint">Water / actuators stay proposed until you confirm. Edge only executes snapshot.take.</p>
      <ul id="cmd-list">${proposedHtml}</ul>
      <div class="admin-only">
      <label for="cmd-reason" data-i18n="hands_confirm_reason">Confirm reason</label>
      <input id="cmd-reason" maxlength="500" placeholder="e.g. garden dry, run drip 10m" />
      <label><input id="cmd-confirm" type="checkbox" style="width:auto;margin-right:8px" /> confirm: true</label>
      <div class="msg" id="cmd-msg"></div>
      </div>
    </section>

    <footer data-i18n="hands_footer">M9 Hands · local failsafe first · cloud proposes, human confirms metal and water</footer>
  </main>
  </div>
  ${bootScripts(OPERATOR_SESSION_JS)}
  <script>
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
        setMsg(msg, res.ok ? t("hands_fired", { body: JSON.stringify(body.fired || []) }) : (body.error || res.status), !res.ok);
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
        setMsg(msg, res.ok ? t("hands_disabled") : (body.error || res.status), !res.ok);
        if (res.ok) location.reload();
        return;
      }
      if (btn.classList.contains("btn-enable")) {
        const reason = document.getElementById("enable-reason").value.trim();
        const confirm = document.getElementById("enable-confirm").checked;
        const risk = btn.getAttribute("data-risk");
        if (risk !== "low" && (!confirm || reason.length < 3)) {
          setMsg(msg, t("hands_need_confirm"), true);
          return;
        }
        const res = await fetch("/v1/automations/" + id + "/enable", {
          method: "POST",
          credentials: "include",
          headers: jsonHeaders(),
          body: JSON.stringify({ enabled: true, confirm, reason: reason || undefined }),
        });
        const body = await res.json().catch(() => ({}));
        setMsg(msg, res.ok ? t("hands_enabled") : (body.message || body.error || res.status), !res.ok);
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
          farm_slug: FARM || undefined,
          kind: document.getElementById("job-kind").value,
          reason: document.getElementById("job-reason").value.trim() || undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      setMsg(msg, res.ok ? t("hands_job_created", { id: body.id, status: body.status }) : (body.error || res.status), !res.ok);
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
          setMsg(msg, t("hands_need_confirm_check"), true);
          return;
        }
        const res = await fetch("/v1/jobs/" + id + "/confirm", {
          method: "POST",
          credentials: "include",
          headers: jsonHeaders(),
          body: JSON.stringify({ confirm: true, reason }),
        });
        const body = await res.json().catch(() => ({}));
        setMsg(msg, res.ok ? t("hands_confirmed") : (body.message || body.error || res.status), !res.ok);
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
        setMsg(msg, res.ok ? t("hands_cancelled") : (body.error || res.status), !res.ok);
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
        setMsg(msg, t("hands_need_confirm"), true);
        return;
      }
      const res = await fetch("/v1/commands/" + btn.getAttribute("data-id") + "/confirm", {
        method: "POST",
        credentials: "include",
          headers: jsonHeaders(),
        body: JSON.stringify({ confirm: true, reason }),
      });
      const body = await res.json().catch(() => ({}));
      setMsg(msg, res.ok ? t("hands_cmd_sent") : (body.message || body.error || res.status), !res.ok);
      if (res.ok) location.reload();
    });

    opRefreshGate();
  </script>
</body>
</html>`);
}
