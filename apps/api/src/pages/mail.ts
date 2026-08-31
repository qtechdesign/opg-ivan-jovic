import type { Context } from "hono";
import {
  bootScripts,
  escapeHtml,
  pageOpen,
  shareHead,
} from "../lib/html";
import { farmFromRequest } from "../lib/farm";
import { requireOperatorHtml } from "../lib/auth";
import { OPERATOR_GATE_HTML, OPERATOR_SESSION_JS } from "../lib/operator-ui";
import { AGENT_MAILBOX_ADDRESS } from "@polje/schema";
import { weatherNow } from "../lib/weather";

type AppEnv = { Bindings: Cloudflare.Env };

export async function renderMail(c: Context<AppEnv>) {
  const denied = await requireOperatorHtml(c);
  if (denied) return denied;

  const { farm, defaultSlug } = await farmFromRequest(c);

  if (!farm) {
    return c.html(
      `<!DOCTYPE html><html lang="en"><body><p>Farm not seeded.</p></body></html>`,
      503
    );
  }

  const wxSkin = weatherNow(farm.timezone, null);
  return c.html(`${pageOpen({
    title: "POLJE · Mail",
    farmName: farm.name,
    farmSlug: farm.slug,
    defaultSlug,
    currentPath: "/mail",
    pipHtml: `<span class="pip ok">MAIL</span>`,
    extraHead: shareHead(c.req.url, "POLJE · Mail", "Farm mailbox. Send is admin only."),
    extraCss: `
  .chart { width: 100%; height: 140px; display: block; }
  .legend { display: flex; gap: 16px; margin-top: 8px; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--spectral-dim); }
  .swatch { display: inline-block; width: 8px; height: 8px; margin-right: 6px; }
  .msg-list li { cursor: pointer; }
  .msg-list li:hover { background: var(--ghost); }
  .dir { font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; }
  .dir.in { color: var(--leaf); }
  .dir.out { color: var(--hay); }
  .dir.fail { color: var(--alarm); }
  .body-pre {
    white-space: pre-wrap;
    font-size: 14px;
    line-height: 1.5;
    color: var(--spectral);
    margin: 0;
  }
  .locked { color: var(--spectral-dim); }
`,
    solar: wxSkin.solar,
    wx: wxSkin.wx,
    bodyClass: "is-admin",
  })}
  <main>
    <h1 data-i18n="mail_title">Mail</h1>
    <p class="sub"><span data-i18n="mail_title">Mail</span> · ${escapeHtml(AGENT_MAILBOX_ADDRESS)}</p>

    ${OPERATOR_GATE_HTML}

    <div class="metrics">
      <div class="metric"><div class="n" id="n-in">—</div><div class="l">Inbound</div></div>
      <div class="metric"><div class="n" id="n-out">—</div><div class="l">Outbound</div></div>
      <div class="metric"><div class="n" id="n-threads">—</div><div class="l">Threads</div></div>
      <div class="metric"><div class="n" id="n-fail">—</div><div class="l">Failed</div></div>
    </div>

    <section class="panel">
      <h2 data-i18n="mail_traffic">14 days · traffic</h2>
      <svg class="chart" id="chart" viewBox="0 0 640 140" role="img" aria-label="Mail volume"></svg>
      <div class="legend">
        <span><span class="swatch" style="background:var(--leaf)"></span>Inbound</span>
        <span><span class="swatch" style="background:var(--hay)"></span>Outbound</span>
      </div>
    </section>

    <section class="panel">
      <h2 data-i18n="mail_messages">Messages</h2>
      <ul class="msg-list" id="list"><li class="dim" data-i18n="loading">Loading…</li></ul>
    </section>

    <section class="panel" id="detail-panel" hidden>
      <h2 data-i18n="mail_message">Message</h2>
      <p class="meta" id="detail-meta"></p>
      <pre class="body-pre" id="detail-body"></pre>
      <ul id="detail-att"></ul>
    </section>

    <section class="panel admin-only">
      <h2 data-i18n="mail_send">Send (confirm)</h2>
      <p class="dim">From is always ${escapeHtml(AGENT_MAILBOX_ADDRESS)}. Needs confirm + reason — agents use the same path later.</p>
      <form id="form-send">
        <label for="send-to">To</label>
        <input id="send-to" type="email" required maxlength="320" placeholder="partner@example.com" />
        <label for="send-subject">Subject</label>
        <input id="send-subject" required maxlength="200" />
        <label for="send-text">Text</label>
        <textarea id="send-text" required maxlength="100000"></textarea>
        <label for="send-reason" data-i18n="mail_reason">Reason (audit)</label>
        <input id="send-reason" required minlength="3" maxlength="500" placeholder="e.g. quote reply to contractor" />
        <label><input id="send-confirm" type="checkbox" style="width:auto;margin-right:8px" /> confirm: true</label>
        <div class="actions"><button class="btn-ghost" type="submit" data-i18n="mail_send_btn">Send</button></div>
        <div class="msg" id="send-msg"></div>
      </form>
    </section>

    <footer>Ledger only · Grok auto-reply is later (M8) · Cloudflare Email Service</footer>
  </main>
  </div>
  ${bootScripts(OPERATOR_SESSION_JS)}
  <script>
    function setMsg(el, text, err) {
      el.textContent = text || "";
      el.className = "msg" + (err ? " err" : "");
    }


    function drawChart(days) {
      const svg = document.getElementById("chart");
      const w = 640, h = 140, padL = 8, padR = 8, padT = 12, padB = 28;
      const innerW = w - padL - padR;
      const innerH = h - padT - padB;
      const max = Math.max(1, ...days.map(d => d.inbound + d.outbound));
      const slot = innerW / days.length;
      const bar = Math.max(4, slot * 0.36);
      let html = "";
      days.forEach((d, i) => {
        const x = padL + i * slot + slot * 0.18;
        const inH = (d.inbound / max) * innerH;
        const outH = (d.outbound / max) * innerH;
        const yBase = padT + innerH;
        html += '<rect x="' + x + '" y="' + (yBase - inH) + '" width="' + bar + '" height="' + inH + '" fill="#3d8c4a"/>';
        html += '<rect x="' + (x + bar + 2) + '" y="' + (yBase - outH) + '" width="' + bar + '" height="' + outH + '" fill="#d4a017"/>';
        if (i % 2 === 0) {
          html += '<text x="' + (x + bar) + '" y="' + (h - 8) + '" fill="#b8b8c6" font-size="9" text-anchor="middle">' + d.date.slice(5) + '</text>';
        }
      });
      svg.innerHTML = html;
    }

    async function loadAll() {
      const list = document.getElementById("list");
      try {
        const [sumRes, listRes] = await Promise.all([
          fetch("/v1/mail/summary?farm=" + encodeURIComponent(FARM), { credentials: "include" }),
          fetch("/v1/mail?farm=" + encodeURIComponent(FARM), { credentials: "include" })
        ]);
        if (sumRes.status === 401 || listRes.status === 401) {
          location.href = "/login?next=" + encodeURIComponent(location.pathname + location.search);
          return;
        }
        if (!sumRes.ok) throw new Error("summary " + sumRes.status);
        const sum = await sumRes.json();
        document.getElementById("n-in").textContent = sum.totals.inbound;
        document.getElementById("n-out").textContent = sum.totals.outbound;
        document.getElementById("n-threads").textContent = sum.totals.threads;
        document.getElementById("n-fail").textContent = sum.totals.failed;
        drawChart(sum.days || []);

        const data = await listRes.json();
        const msgs = data.messages || [];
        if (msgs.length === 0) {
          list.innerHTML = '<li class="dim">' + t("mail_empty") + "</li>";
          return;
        }
        list.innerHTML = msgs.map((m) => {
          const dir = m.status === "failed" ? "fail" : (m.direction === "inbound" ? "in" : "out");
          const label = m.status === "failed" ? "FAIL" : (m.direction === "inbound" ? "IN" : "OUT");
          const who = m.direction === "inbound" ? m.from_addr : m.to_addr;
          return '<li data-id="' + m.id + '"><div class="row"><span>' +
            '<span class="dir ' + dir + '">' + label + '</span> ' +
            escapeHtml(m.subject) + '</span><span class="meta">' + escapeHtml(m.ts.slice(0,16).replace("T"," ")) +
            '</span></div><div class="dim">' + escapeHtml(who) +
            (m.snippet ? " · " + escapeHtml(m.snippet) : "") + "</div></li>";
        }).join("");
        list.querySelectorAll("li[data-id]").forEach((li) => {
          li.onclick = () => openMsg(li.getAttribute("data-id"));
        });
      } catch (err) {
        list.innerHTML = '<li class="locked">' + escapeHtml(String(err.message || err)) + "</li>";
      }
    }

    async function openMsg(id) {
      const panel = document.getElementById("detail-panel");
      const meta = document.getElementById("detail-meta");
      const body = document.getElementById("detail-body");
      const att = document.getElementById("detail-att");
      panel.hidden = false;
      meta.textContent = t("loading");
      body.textContent = "";
      att.innerHTML = "";
      try {
        const res = await fetch("/v1/mail/" + id, { credentials: "include" });
        const m = await res.json();
        if (!res.ok) throw new Error(m.error || res.statusText);
        meta.textContent = (m.direction || "").toUpperCase() + " · " + m.from_addr + " → " + m.to_addr + " · " + (m.status || "");
        body.textContent = m.text_body || t("mail_no_text");
        const files = m.attachments || [];
        att.innerHTML = files.map((a) =>
          '<li><button type="button" class="btn-ghost att-dl admin-only" data-url="' + a.url + '" data-name="' + escapeHtml(a.filename) + '">' + escapeHtml(a.filename) + "</button></li>"
        ).join("");
        att.querySelectorAll(".att-dl").forEach((btn) => {
          btn.onclick = async () => {
            const res = await fetch(btn.getAttribute("data-url"), { credentials: "include" });
            if (!res.ok) return;
            const blob = await res.blob();
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = btn.getAttribute("data-name") || "attachment";
            a.click();
          };
        });
        document.getElementById("send-to").value = m.direction === "inbound" ? m.from_addr : m.to_addr;
        document.getElementById("send-subject").value = (m.subject || "").startsWith("Re:") ? m.subject : "Re: " + m.subject;
        document.getElementById("form-send").dataset.thread = m.thread_id || "";
      } catch (err) {
        meta.textContent = String(err.message || err);
      }
    }

    document.getElementById("form-send").onsubmit = async (e) => {
      e.preventDefault();
      const msg = document.getElementById("send-msg");
      if (!document.getElementById("send-confirm").checked) {
        return setMsg(msg, t("mail_need_confirm"), true);
      }
      const body = {
        farm_slug: FARM,
        to: document.getElementById("send-to").value.trim(),
        subject: document.getElementById("send-subject").value.trim(),
        text: document.getElementById("send-text").value,
        confirm: true,
        reason: document.getElementById("send-reason").value.trim()
      };
      const thread = document.getElementById("form-send").dataset.thread;
      if (thread) body.thread_id = thread;
      try {
        const res = await fetch("/v1/mail/send", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || res.statusText);
        setMsg(msg, t("mail_sent", { status: data.status, id: data.id }));
        document.getElementById("send-text").value = "";
        document.getElementById("send-confirm").checked = false;
        loadAll();
      } catch (err) {
        setMsg(msg, String(err.message || err), true);
      }
    };

    function escapeHtml(s) {
      return String(s || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }

    opRefreshGate();
    loadAll();
    document.addEventListener("polje:lang", () => { loadAll(); });
  </script>
</body>
</html>`);
}
