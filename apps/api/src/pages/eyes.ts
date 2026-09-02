import type { Context } from "hono";
import {
  bootScripts,
  escapeHtml,
  pageOpen,
  shareHead,
} from "../lib/html";
import { farmFromRequest } from "../lib/farm";
import { weatherNow } from "../lib/weather";
import {
  ANALOG_FEEDS,
  analogEmbedUrl,
  LONJSKO_POLJE_CAM_URL,
} from "../lib/analog-feeds";

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
  const analogGrid = ANALOG_FEEDS.map((f) => {
    const embed = analogEmbedUrl(f.youtube_id);
    const nameKey = CAMERA_LABEL[f.camera_id] || f.camera_id;
    return `<article class="eye">
      <div class="eye-frame"><iframe src="${escapeHtml(embed)}" title="${escapeHtml(f.title_en)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>
      <div class="eye-meta"><span class="name" data-i18n="${escapeHtml(nameKey)}">${escapeHtml(f.title_en)}</span><span class="when" data-i18n="analog_eyes_live">LIVE analog</span></div>
      <div class="eye-place">${escapeHtml(f.place_en)}</div>
    </article>`;
  }).join("");
  return c.html(`${pageOpen({
    title: `Eyes · ${farm.name}`,
    farmName: farm.name,
    farmSlug: farm.slug,
    defaultSlug,
    currentPath: "/eyes",
    pipHtml: `<span class="pip ok">EYES</span>`,
    extraHead: shareHead(c.req.url, `Eyes · ${farm.name}`, "Analog live streams until the yard NVR is up — storks and countryside like Lonjsko polje."),
    extraCss: `
  .eye {
    border: 1px solid var(--hairline);
    border-radius: var(--radius);
    background: color-mix(in oklab, var(--void-soft) 82%, transparent);
    overflow: hidden;
  }
  .eye-frame {
    aspect-ratio: 16 / 9;
    background: #0a0b0e;
    position: relative;
  }
  .eye-frame img, .eye-frame iframe {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    border: 0;
    position: absolute;
    inset: 0;
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
  .eye-place {
    padding: 0 14px 12px;
    font-size: 12px;
    color: var(--spectral-dim);
  }
`,
    solar: wxSkin.solar,
    wx: wxSkin.wx,
  })}
  <main class="wide">
    <h1 data-i18n="eyes_title">Eyes</h1>
    <p class="sub" data-i18n="eyes_sub">Analog live — yard, garden, hay. Real NVR cameras land with the civil works.</p>
    <p class="hint" data-i18n="eyes_howto">These are public countryside and stork livestreams from a climate-similar landscape (Lonjsko polje analog), not cameras on this plot. Mute autoplay. Yard NVR replaces them when it is up.</p>
    <div class="eyes-grid" id="grid">${analogGrid}</div>
    <p class="hint"><a href="${LONJSKO_POLJE_CAM_URL}" rel="noreferrer" data-i18n="analog_lonjsko">Closer analog: Lonjsko polje stork village (HR)</a></p>
    <footer data-i18n="eyes_footer">House from 1923 · analog live until NVR</footer>
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
    let analogLocked = true;
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
      const hasAnalog = cams.some((cam) => cam.analog && cam.analog.embed_url);
      if (hasAnalog && analogLocked) return;
      analogLocked = hasAnalog;
      grid.innerHTML = cams.map((cam) => {
        const analog = cam.analog;
        const place = analog
          ? (LANG === "hr" ? analog.place_hr : analog.place_en)
          : "";
        let frame;
        if (analog && analog.embed_url) {
          frame = '<iframe src="' + analog.embed_url + '" title="' + label(cam.id, cam.name) + '" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>';
        } else if (cam.snapshot) {
          const bust = cam.snapshot.captured_at ? ("?t=" + encodeURIComponent(cam.snapshot.captured_at)) : "";
          frame = '<a href="/v1/cameras/' + cam.id + '/latest' + bust + '" target="_blank" rel="noreferrer"><img src="/v1/cameras/' + cam.id + '/latest' + bust + '" alt="' + label(cam.id, cam.name) + '" /></a>';
        } else {
          frame = '<div class="empty">' + t("eyes_no_image") + "</div>";
        }
        const when = analog
          ? t("analog_eyes_live")
          : (cam.snapshot && cam.snapshot.captured_at ? whenText(cam.snapshot.captured_at) : t("eyes_waiting"));
        return (
          '<article class="eye">' +
            '<div class="eye-frame">' + frame + '</div>' +
            '<div class="eye-meta">' +
              '<span class="name">' + label(cam.id, cam.name) + '</span>' +
              '<span class="when">' + when + '</span>' +
            '</div>' +
            (place ? '<div class="eye-place">' + place + "</div>" : "") +
          '</article>'
        );
      }).join("");
    }
    load();
    setInterval(load, 30000);
    document.addEventListener("polje:lang", () => { analogLocked = false; load(); });
  </script>
</body>
</html>`);
}
