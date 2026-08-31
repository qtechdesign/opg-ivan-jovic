import type { Context } from "hono";
import { CHASSIS_CSS, escapeHtml } from "../lib/html";

type AppEnv = { Bindings: Cloudflare.Env };

export async function renderEyes(c: Context<AppEnv>) {
  const farm = await c.env.DB.prepare(
    `SELECT id, slug, name FROM farms WHERE slug = 'ivan-jovic'`
  ).first<{ id: string; slug: string; name: string }>();

  if (!farm) {
    return c.html(
      `<!DOCTYPE html><html lang="hr"><body><p>Farm nije seeded.</p></body></html>`,
      503
    );
  }

  return c.html(`<!DOCTYPE html>
<html lang="hr" data-solar="day" data-wx="clear">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>POLJE · Oči</title>
  <style>${CHASSIS_CSS}
  main { max-width: 1100px; }
  .eyes-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }
  .eye {
    border: 1px solid var(--hairline);
    border-radius: 4px;
    background: color-mix(in oklab, var(--void-soft) 82%, transparent);
    overflow: hidden;
  }
  .eye-frame {
    aspect-ratio: 16 / 9;
    background: #0a0b0e;
    position: relative;
  }
  .eye-frame img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .eye-frame .empty {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--spectral-dim);
    font-size: 12px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  .eye-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    border-top: 1px solid var(--hairline);
  }
  .eye-meta .name {
    font-size: 13px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .badge {
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--hay);
  }
  .badge.live { color: var(--leaf); }
  .badge.offline { color: var(--spectral-dim); }
  .badge.none { color: var(--alarm); }
  @media (max-width: 900px) {
    .eyes-grid { grid-template-columns: 1fr; }
  }
  </style>
</head>
<body>
  <header>
    <span class="brand">Polje · OPG Ivan Jović</span>
    <nav>
      <a href="/">Pregled</a>
      <a href="/land">Zemlja</a>
      <a href="/eyes">Oči</a>
    </nav>
    <span class="pip ok">OČI</span>
  </header>
  <main>
    <h1>Oči</h1>
    <p class="sub">Lokalni NVR · snimke (ne live stream) · ${escapeHtml(farm.name)}</p>

    <section class="panel">
      <h2>Operator token</h2>
      <p class="dim">Isti token kao na Zemlja — sessionStorage. Za „Snimka sada“.</p>
      <label for="token">Operator token</label>
      <input id="token" type="password" autocomplete="off" placeholder="Bearer secret" />
      <div class="actions">
        <button type="button" class="btn-ghost" id="save-token">Spremi u session</button>
        <button type="button" class="btn-ghost" id="clear-token">Obriši</button>
        <button type="button" class="btn-ghost" id="refresh">Osvježi</button>
      </div>
      <div class="msg" id="token-msg"></div>
    </section>

    <div class="eyes-grid" id="grid"></div>
    <footer>Snapshots only · RTSP stays on the farm · Starlink-friendly</footer>
  </main>
  <script>
    const TOKEN_KEY = "polje_operator_token";
    const tokenEl = document.getElementById("token");
    const msg = document.getElementById("token-msg");
    const grid = document.getElementById("grid");
    tokenEl.value = sessionStorage.getItem(TOKEN_KEY) || "";

    document.getElementById("save-token").onclick = () => {
      sessionStorage.setItem(TOKEN_KEY, tokenEl.value.trim());
      msg.textContent = "Spremljeno.";
      msg.className = "msg";
    };
    document.getElementById("clear-token").onclick = () => {
      sessionStorage.removeItem(TOKEN_KEY);
      tokenEl.value = "";
      msg.textContent = "Obrisano.";
      msg.className = "msg";
    };
    document.getElementById("refresh").onclick = () => load();

    function authHeaders() {
      const t = sessionStorage.getItem(TOKEN_KEY) || tokenEl.value.trim();
      return t ? { Authorization: "Bearer " + t } : {};
    }

    function badge(source, hasSnap) {
      if (!hasSnap) return { cls: "badge none", text: "NO STILL" };
      if (source === "rtsp") return { cls: "badge live", text: "LIVE" };
      return { cls: "badge offline", text: "OFFLINE" };
    }

    async function snapNow(id) {
      const res = await fetch("/v1/cameras/" + id + "/snapshot", {
        method: "POST",
        headers: authHeaders(),
      });
      if (res.status === 401) {
        msg.textContent = "401 — trebam operator token.";
        msg.className = "msg err";
        return;
      }
      if (!res.ok) {
        msg.textContent = "Greška " + res.status;
        msg.className = "msg err";
        return;
      }
      msg.textContent = "Naredba poslana — Edge snima uskoro.";
      msg.className = "msg";
      setTimeout(load, 8000);
    }

    async function load() {
      const res = await fetch("/v1/cameras?farm=ivan-jovic");
      if (!res.ok) {
        grid.innerHTML = '<p class="dim">Nema kamera.</p>';
        return;
      }
      const data = await res.json();
      const cams = data.cameras || [];
      if (!cams.length) {
        grid.innerHTML = '<p class="dim">Nema kamera — pokreni seed.</p>';
        return;
      }
      grid.innerHTML = cams.map((cam) => {
        const has = !!cam.snapshot;
        const b = badge(cam.snapshot && cam.snapshot.source, has);
        const bust = has ? ("?t=" + encodeURIComponent(cam.snapshot.captured_at)) : "";
        const img = has
          ? '<img src="/v1/cameras/' + cam.id + '/latest' + bust + '" alt="' + cam.name + '" />'
          : '<div class="empty">NO STILL</div>';
        return (
          '<article class="eye" data-id="' + cam.id + '">' +
            '<div class="eye-frame">' + img + '</div>' +
            '<div class="eye-meta">' +
              '<span class="name">' + cam.name + '</span>' +
              '<span class="' + b.cls + '">' + b.text + '</span>' +
            '</div>' +
            '<div class="actions" style="padding:0 12px 12px">' +
              '<button type="button" class="btn-ghost snap-btn" data-id="' + cam.id + '">Snimka sada</button>' +
            '</div>' +
          '</article>'
        );
      }).join("");
      grid.querySelectorAll(".snap-btn").forEach((btn) => {
        btn.addEventListener("click", () => snapNow(btn.getAttribute("data-id")));
      });
    }
    load();
  </script>
</body>
</html>`);
}
