import type { Context } from "hono";
import {
  bootScripts,
  escapeHtml,
  pageOpen,
  shareHead,
} from "../lib/html";
import { farmFromRequest } from "../lib/farm";
import { weatherNow } from "../lib/weather";

type AppEnv = { Bindings: Cloudflare.Env };

const CAMERA_LABEL: Record<string, string> = {
  "cam-yard": "cam_yard",
  "cam-garden": "cam_garden",
  "cam-hay": "cam_hay",
};

export async function renderEyes(c: Context<AppEnv>) {
  const { farm, defaultSlug } = await farmFromRequest(c);

  if (!farm) {
    return c.html(
      `<!DOCTYPE html><html lang="en"><body><p>Farm not seeded.</p></body></html>`,
      503
    );
  }

  const wxSkin = weatherNow(farm.timezone, null);
  return c.html(`${pageOpen({
    title: `Eyes · ${farm.name}`,
    farmName: farm.name,
    farmSlug: farm.slug,
    defaultSlug,
    currentPath: "/eyes",
    pipHtml: `<span class="pip ok">EYES</span>`,
    extraHead: shareHead(c.req.url, `Eyes · ${farm.name}`, "Live stills from the farm — yard, garden, hay."),
    extraCss: `
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
`,
    solar: wxSkin.solar,
    wx: wxSkin.wx,
  })}
  <main class="wide">
    <h1 data-i18n="eyes_title">Eyes</h1>
    <p class="sub" data-i18n="eyes_sub">Live view from the farm — yard, garden, hay. Cameras on this page when the edge has them.</p>
    <div class="eyes-grid" id="grid"></div>
    <footer data-i18n="eyes_footer">House from 1923 · live stills</footer>
  </main>
  </div>
  ${bootScripts()}
  <script>
    const LABELS = ${JSON.stringify(CAMERA_LABEL)};
    const grid = document.getElementById("grid");
    function label(id, fallback) {
      const key = LABELS[id];
      return key ? t(key) : (fallback || id);
    }
    function whenText(iso) {
      if (!iso) return "";
      try {
        return new Date(iso).toLocaleString(loc(), {
          day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
        });
      } catch (e) { return ""; }
    }
    async function load() {
      const res = await fetch("/v1/cameras?farm=" + encodeURIComponent(FARM));
      if (!res.ok) {
        grid.innerHTML = '<p class="dim">' + t("eyes_no_view") + "</p>";
        return;
      }
      const data = await res.json();
      const cams = data.cameras || [];
      if (!cams.length) {
        grid.innerHTML = '<p class="dim">' + t("eyes_none") + "</p>";
        return;
      }
      grid.innerHTML = cams.map((cam) => {
        const has = !!cam.snapshot;
        const bust = has ? ("?t=" + encodeURIComponent(cam.snapshot.captured_at)) : "";
        const img = has
          ? '<img src="/v1/cameras/' + cam.id + '/latest' + bust + '" alt="' + label(cam.id, cam.name) + '" />'
          : '<div class="empty">' + t("eyes_no_image") + "</div>";
        const when = has ? whenText(cam.snapshot.captured_at) : t("eyes_waiting");
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
    document.addEventListener("polje:lang", () => { load(); });
  </script>
</body>
</html>`);
}
