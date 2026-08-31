import type { Context } from "hono";
import {
  CHASSIS_CSS,
  escapeHtml,
  farmBrand,
  FARM_SLUG_JS,
  siteNav,
} from "../lib/html";
import { farmFromRequest } from "../lib/farm";

type AppEnv = { Bindings: Cloudflare.Env };

const CAMERA_LABEL: Record<string, string> = {
  "cam-yard": "Dvorište",
  "cam-garden": "Vrt",
  "cam-hay": "Sijeno",
};

export async function renderEyes(c: Context<AppEnv>) {
  const { farm, defaultSlug } = await farmFromRequest(c);

  if (!farm) {
    return c.html(
      `<!DOCTYPE html><html lang="hr"><body><p>Farm nije seeded.</p></body></html>`,
      503
    );
  }

  return c.html(`<!DOCTYPE html>
<html lang="hr" data-solar="day" data-wx="clear" data-farm="${escapeHtml(farm.slug)}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Oči · ${escapeHtml(farm.name)}</title>
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
    letter-spacing: 0.08em;
  }
  .eye-meta {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
    padding: 12px 14px;
    border-top: 1px solid var(--hairline);
  }
  .eye-meta .name { font-size: 15px; letter-spacing: 0.04em; }
  .eye-meta .when {
    font-size: 12px;
    color: var(--spectral-dim);
    white-space: nowrap;
  }
  @media (max-width: 900px) {
    .eyes-grid { grid-template-columns: 1fr; }
  }
  </style>
</head>
<body>
  <header>
    ${farmBrand(farm.name, farm.slug, defaultSlug)}
    ${siteNav(farm.slug, defaultSlug)}
    <span class="pip ok">OČI</span>
  </header>
  <main>
    <h1>Oči</h1>
    <p class="sub">Pogled s ruba farme — dvorište, vrt, sijeno. Još nema kamera na stupu; ovo su mjesta koja čekaju.</p>
    <div class="eyes-grid" id="grid"></div>
    <footer>Kuća iz 1923. · slike, ne stream</footer>
  </main>
  <script>
    ${FARM_SLUG_JS}
    const LABELS = ${JSON.stringify(CAMERA_LABEL)};
    const grid = document.getElementById("grid");
    function label(id, fallback) { return LABELS[id] || fallback || id; }
    function whenText(iso) {
      if (!iso) return "";
      try {
        return new Date(iso).toLocaleString("hr-HR", {
          day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
        });
      } catch (e) { return ""; }
    }
    async function load() {
      const res = await fetch("/v1/cameras?farm=" + encodeURIComponent(FARM));
      if (!res.ok) {
        grid.innerHTML = '<p class="dim">Trenutačno nema pogleda.</p>';
        return;
      }
      const data = await res.json();
      const cams = data.cameras || [];
      if (!cams.length) {
        grid.innerHTML = '<p class="dim">Još nema kamera.</p>';
        return;
      }
      grid.innerHTML = cams.map((cam) => {
        const has = !!cam.snapshot;
        const bust = has ? ("?t=" + encodeURIComponent(cam.snapshot.captured_at)) : "";
        const img = has
          ? '<img src="/v1/cameras/' + cam.id + '/latest' + bust + '" alt="' + label(cam.id, cam.name) + '" />'
          : '<div class="empty">Još nema slike</div>';
        const when = has ? whenText(cam.snapshot.captured_at) : "čeka kameru";
        return (
          '<article class="eye">' +
            '<div class="eye-frame">' + img + '</div>' +
            '<div class="eye-meta">' +
              '<span class="name">' + label(cam.id, cam.name) + '</span>' +
              '<span class="when">' + when + '</span>' +
            '</div>' +
          '</article>'
        );
      }).join("");
    }
    load();
  </script>
</body>
</html>`);
}
