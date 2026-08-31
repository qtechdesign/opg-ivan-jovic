import { HTML_LANG, I18N_HEAD_JS, I18N_JS, langToggle } from "./i18n";
import { brandMarkSvg, FAVICON_LINKS } from "./brand";

export function farmQuery(slug: string, defaultSlug: string): string {
  if (!slug || slug === defaultSlug) return "";
  return `?farm=${encodeURIComponent(slug)}`;
}

export function farmPath(
  path: string,
  slug: string,
  defaultSlug: string
): string {
  return `${path}${farmQuery(slug, defaultSlug)}`;
}

function ico(paths: string): string {
  return `<svg class="nav-ico" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round">${paths}</svg>`;
}

const NAV: Array<{
  path: string;
  key: string;
  label: string;
  icon: string;
  external?: boolean;
}> = [
  {
    path: "/",
    key: "nav_overview",
    label: "Overview",
    icon: ico(
      `<rect x="3" y="3" width="8" height="8"/><rect x="13" y="3" width="8" height="8"/><rect x="3" y="13" width="8" height="8"/><rect x="13" y="13" width="8" height="8"/>`
    ),
  },
  {
    path: "/land",
    key: "nav_land",
    label: "Land",
    icon: ico(
      `<path d="M3 18 L8 10 L12 14 L16 8 L21 18 Z"/><path d="M3 18 H21"/>`
    ),
  },
  {
    path: "/water",
    key: "nav_water",
    label: "Water",
    icon: ico(`<path d="M12 3 C12 3 6 11 6 15 a6 6 0 0 0 12 0 C18 11 12 3 12 3 Z"/>`),
  },
  {
    path: "/frost",
    key: "nav_frost",
    label: "Frost",
    icon: ico(
      `<path d="M12 2 V22 M4 7 L20 17 M20 7 L4 17 M7 4 L17 20 M17 4 L7 20"/>`
    ),
  },
  {
    path: "/klima",
    key: "nav_klima",
    label: "Climate",
    icon: ico(
      `<circle cx="12" cy="12" r="4"/><path d="M12 2 V5 M12 19 V22 M2 12 H5 M19 12 H22 M4.9 4.9 L7 7 M17 17 L19.1 19.1 M19.1 4.9 L17 7 M7 17 L4.9 19.1"/>`
    ),
  },
  {
    path: "/eyes",
    key: "nav_eyes",
    label: "Eyes",
    icon: ico(
      `<path d="M2 12 C6 6 18 6 22 12 C18 18 6 18 2 12 Z"/><circle cx="12" cy="12" r="3"/>`
    ),
  },
  {
    path: "/hands",
    key: "nav_hands",
    label: "Hands",
    icon: ico(
      `<path d="M8 11 V6 a2 2 0 0 1 4 0 V11 M12 11 V5 a2 2 0 0 1 4 0 V12 M16 12 V7 a2 2 0 0 1 4 0 V14 c0 4-3 7-8 7 s-8-3-8-7 V13 a2 2 0 0 1 4 0"/>`
    ),
  },
  {
    path: "/ledger",
    key: "nav_ledger",
    label: "Ledger",
    icon: ico(
      `<path d="M6 4 H18 a1 1 0 0 1 1 1 V20 H7 a2 2 0 0 1-2-2 V6 a2 2 0 0 1 2-2 Z"/><path d="M9 9 H16 M9 13 H16"/>`
    ),
  },
  {
    path: "/plan",
    key: "nav_plan",
    label: "Plan",
    icon: ico(
      `<path d="M4 6 H20 M4 12 H20 M4 18 H14"/><circle cx="18" cy="18" r="3"/>`
    ),
  },
  {
    path: "/mail",
    key: "nav_mail",
    label: "Mail",
    icon: ico(
      `<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3 7 L12 13 L21 7"/>`
    ),
  },
  {
    path: "https://docs.opg-ivanjovic.hr",
    key: "nav_docs",
    label: "Docs",
    external: true,
    icon: ico(
      `<path d="M7 3 H14 L19 8 V21 H7 Z"/><path d="M14 3 V8 H19"/><path d="M9 12 H17 M9 16 H15"/>`
    ),
  },
  {
    path: "/login",
    key: "nav_admin",
    label: "Admin",
    icon: ico(
      `<circle cx="12" cy="8" r="3"/><path d="M5 20 c1.5-4 4-6 7-6 s5.5 2 7 6"/>`
    ),
  },
];

export function siteNav(
  slug: string,
  defaultSlug: string,
  currentPath = "/"
): string {
  const href = (path: string) =>
    path.startsWith("http") ? path : farmPath(path, slug, defaultSlug);
  const items = NAV.map((item) => {
    const url = href(item.path);
    const current =
      !item.external && item.path === currentPath
        ? ` aria-current="page"`
        : "";
    const extra = item.external ? ` rel="noreferrer"` : "";
    return `<a href="${url}" class="nav-a"${current}${extra} title="${item.label}">${item.icon}<span data-i18n="${item.key}">${item.label}</span></a>`;
  });
  return `<nav class="rail-nav">${items.join("")}</nav>`;
}

export function farmBrand(
  name: string,
  slug: string,
  defaultSlug: string
): string {
  const pip =
    slug && slug !== defaultSlug
      ? `<span class="pip farm">${escapeHtml(slug)}</span>`
      : "";
  return `<a class="brand" href="${farmPath("/", slug, defaultSlug)}">${brandMarkSvg()}<span class="brand-text">Polje · ${escapeHtml(name)}</span></a>${pip}`;
}

/** Default-tenant nav (ivan-jovic). Prefer siteNav(slug, defaultSlug, path). */
export const SITE_NAV = siteNav("ivan-jovic", "ivan-jovic");

export function siteFooter(): string {
  return `<footer><span data-i18n="footer_field">Polje is the field. The field was here first.</span> · <a href="https://docs.opg-ivanjovic.hr" data-i18n="nav_docs">Docs</a> · <a href="/login" data-i18n="nav_admin">Admin</a></footer>`;
}

export const FARM_SLUG_JS = `const FARM = document.documentElement.getAttribute("data-farm") || "";`;

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export const SHARE_DESC =
  "Operating system for OPG Ivan Jović — land, water, frost, climate, cameras.";

export function shareHead(pageUrl: string, title: string, description: string): string {
  let origin = "https://opg-ivanjovic.hr";
  let canonical = pageUrl;
  try {
    const u = new URL(pageUrl);
    origin = u.origin;
    canonical = `${u.origin}${u.pathname}`;
  } catch {
    /* keep defaults */
  }
  // Square 800×800 JPEG (WhatsApp). X large-card wants ~1200×628 / 1.91:1 —
  // summary_large_image + 1:1 is a common reason the preview image is dropped.
  const image = `${origin}/og.jpg?v=3`;
  return `<meta name="description" content="${escapeHtml(description)}" />
  <link rel="canonical" href="${escapeHtml(canonical)}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Polje" />
  <meta property="og:url" content="${escapeHtml(canonical)}" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${escapeHtml(image)}" />
  <meta property="og:image:secure_url" content="${escapeHtml(image)}" />
  <meta property="og:image:type" content="image/jpeg" />
  <meta property="og:image:width" content="800" />
  <meta property="og:image:height" content="800" />
  <meta property="og:image:alt" content="${escapeHtml(title)}" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(image)}" />
  <meta name="twitter:image:alt" content="${escapeHtml(title)}" />
  <link rel="image_src" href="${escapeHtml(image)}" />`;
}

export const FONT_LINKS = `<link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet" />`;

export function documentStart(opts: {
  title: string;
  farmSlug: string;
  extraCss?: string;
  extraHead?: string;
  htmlId?: string;
  solar?: string;
  wx?: string;
  forceWx?: string;
}): string {
  const id = opts.htmlId ? ` id="${escapeHtml(opts.htmlId)}"` : "";
  const force = opts.forceWx
    ? ` data-force-wx="${escapeHtml(opts.forceWx)}"`
    : "";
  return `<!DOCTYPE html>
<html ${HTML_LANG} data-solar="${escapeHtml(opts.solar ?? "night")}" data-wx="${escapeHtml(opts.wx ?? "clear")}"${force}${id} data-farm="${escapeHtml(opts.farmSlug)}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>${escapeHtml(opts.title)}</title>
  ${FAVICON_LINKS}
  ${opts.extraHead ?? ""}
  ${FONT_LINKS}
  ${I18N_HEAD_JS}
  <style>${CHASSIS_CSS}${opts.extraCss ?? ""}</style>
</head>`;
}

export function pageChrome(opts: {
  farmName: string;
  slug: string;
  defaultSlug: string;
  currentPath: string;
  pipHtml: string;
}): string {
  return `<div class="nav-scrim" id="nav-scrim" hidden></div>
  <header class="topbar">
    <button type="button" class="nav-toggle" id="nav-toggle" aria-expanded="false" aria-controls="nav-rail">
      <span class="nav-toggle-bars" aria-hidden="true"></span>
    </button>
    ${farmBrand(opts.farmName, opts.slug, opts.defaultSlug)}
    <div class="topbar-live" aria-live="polite">
      <span id="wx-clock">—</span>
      <span id="wx-temp">—</span>
      <span id="wx-word">—</span>
    </div>
    ${langToggle()}
    ${opts.pipHtml}
  </header>
  <aside class="nav-rail" id="nav-rail">
    ${siteNav(opts.slug, opts.defaultSlug, opts.currentPath)}
  </aside>`;
}

export const CHROME_JS = `
    (function () {
      const toggle = document.getElementById("nav-toggle");
      const scrim = document.getElementById("nav-scrim");
      function setOpen(on) {
        document.body.classList.toggle("nav-open", on);
        if (toggle) toggle.setAttribute("aria-expanded", on ? "true" : "false");
        if (scrim) scrim.hidden = !on;
      }
      if (toggle) {
        toggle.setAttribute("aria-label", t("nav_menu"));
        toggle.addEventListener("click", () => setOpen(!document.body.classList.contains("nav-open")));
      }
      if (scrim) scrim.addEventListener("click", () => setOpen(false));
      document.addEventListener("keydown", (e) => { if (e.key === "Escape") setOpen(false); });
      document.addEventListener("polje:lang", () => {
        if (toggle) toggle.setAttribute("aria-label", t("nav_menu"));
      });
    })();
`.trim();

export const WEATHER_JS = `
    (function () {
      const WX_KEYS = { clear: "wx_clear", frost: "wx_frost", fog: "wx_fog", cloud: "wx_cloud", rain: "wx_rain", snow: "wx_snow" };
      let lastWx = document.documentElement.getAttribute("data-wx") || "clear";
      async function refreshWx() {
        try {
          const res = await fetch("/v1/weather/now?farm=" + encodeURIComponent(FARM));
          if (!res.ok) return;
          const d = await res.json();
          const force = document.documentElement.getAttribute("data-force-wx");
          const solar = d.solar || "night";
          const wx = force || d.wx || "clear";
          lastWx = wx;
          document.documentElement.setAttribute("data-solar", solar);
          document.documentElement.setAttribute("data-wx", wx);
          const clock = document.getElementById("wx-clock");
          const tempEl = document.getElementById("wx-temp");
          const word = document.getElementById("wx-word");
          if (clock) clock.textContent = new Date().toLocaleTimeString(loc(), { hour: "2-digit", minute: "2-digit" });
          if (tempEl) tempEl.textContent = d.temp_c == null || d.temp_c === undefined ? "—" : Number(d.temp_c).toFixed(1) + "°C";
          if (word) word.textContent = t(WX_KEYS[wx] || "wx_clear");
        } catch (e) {}
      }
      document.addEventListener("polje:lang", () => {
        const word = document.getElementById("wx-word");
        if (word) word.textContent = t(WX_KEYS[lastWx] || "wx_clear");
      });
      refreshWx();
      setInterval(refreshWx, 300000);
    })();
`.trim();

export function bootScripts(...extra: string[]): string {
  return `<script>
    ${I18N_JS}
    ${FARM_SLUG_JS}
    ${CHROME_JS}
    ${WEATHER_JS}
    ${extra.join("\n")}
  </script>`;
}

export function pageOpen(opts: {
  title: string;
  farmName: string;
  farmSlug: string;
  defaultSlug: string;
  currentPath: string;
  pipHtml: string;
  extraCss?: string;
  extraHead?: string;
  htmlId?: string;
  solar?: string;
  wx?: string;
  forceWx?: string;
  bodyClass?: string;
}): string {
  const bodyClass = opts.bodyClass
    ? ` class="${escapeHtml(opts.bodyClass)}"`
    : "";
  return `${documentStart(opts)}
<body${bodyClass}>
  ${pageChrome({
    farmName: opts.farmName,
    slug: opts.farmSlug,
    defaultSlug: opts.defaultSlug,
    currentPath: opts.currentPath,
    pipHtml: opts.pipHtml,
  })}
  <div class="workspace">`;
}

export const CHASSIS_CSS = `
@font-face {
  font-family: "D-DIN";
  src: url("/fonts/D-DIN.woff2") format("woff2");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
  unicode-range: U+0000-00FF;
}
@font-face {
  font-family: "D-DIN";
  src: url("/fonts/D-DIN-Bold.woff2") format("woff2");
  font-weight: 700;
  font-style: normal;
  font-display: swap;
  unicode-range: U+0000-00FF;
}
:root {
  --void: #07080a;
  --void-soft: #101218;
  --spectral: #f0f0fa;
  --spectral-dim: #b8b8c6;
  --hairline: rgba(240, 240, 250, 0.16);
  --ghost: rgba(240, 240, 250, 0.08);
  --ghost-border: rgba(240, 240, 250, 0.35);
  --ink-on-light: #101218;
  --leaf: #3d8c4a;
  --hay: #d4a017;
  --soil: #6b4a2e;
  --ice: #7ec8e3;
  --alarm: #c43c2c;
  --spacex-blue: #005288;
  --rail: 220px;
  --topbar: 48px;
  --safe-b: env(safe-area-inset-bottom, 0px);
  --safe-t: env(safe-area-inset-top, 0px);
}
html[data-solar="day"][data-wx="clear"] {
  --void: #eef2e6;
  --void-soft: #e4ead8;
  --spectral: #101218;
  --spectral-dim: #4a4a52;
  --hairline: rgba(16, 18, 24, 0.16);
  --ghost: rgba(16, 18, 24, 0.06);
  --ghost-border: rgba(16, 18, 24, 0.28);
}
html[data-solar="day"][data-wx="cloud"] {
  --void: #d9dee4;
  --void-soft: #cfd5dc;
  --spectral: #101218;
  --spectral-dim: #4a4a52;
  --hairline: rgba(16, 18, 24, 0.16);
  --ghost: rgba(16, 18, 24, 0.06);
  --ghost-border: rgba(16, 18, 24, 0.28);
}
html[data-solar="dawn"],
html[data-solar="dusk"] {
  --void: #12141a;
  --void-soft: #1a1c24;
  --spectral: #f0f0fa;
  --spectral-dim: #b8b8c6;
}
html[data-wx="frost"] {
  --void: #07080a;
  --void-soft: #0c1016;
  --spectral: #f0f0fa;
  --spectral-dim: #b8b8c6;
  --hairline: color-mix(in oklab, var(--ice) 45%, transparent);
  --ghost-border: color-mix(in oklab, var(--ice) 40%, transparent);
}
* { box-sizing: border-box; }
html, body { min-height: 100%; }
body {
  margin: 0;
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--void);
  color: var(--spectral);
  font-family: "IBM Plex Sans", "D-DIN", system-ui, sans-serif;
  font-size: 16px;
  line-height: 1.45;
  display: grid;
  grid-template-columns: 1fr;
  grid-template-rows: calc(var(--topbar) + var(--safe-t)) minmax(0, 1fr);
  transition: background-color 900ms ease, color 900ms ease;
}
html[data-solar="night"][data-wx="clear"] body {
  background-image:
    radial-gradient(1px 1px at 12% 22%, rgba(240,240,250,0.28), transparent),
    radial-gradient(1px 1px at 78% 18%, rgba(240,240,250,0.2), transparent),
    radial-gradient(1px 1px at 42% 68%, rgba(240,240,250,0.16), transparent),
    radial-gradient(1px 1px at 88% 72%, rgba(240,240,250,0.22), transparent);
}
@media (prefers-reduced-motion: reduce) {
  body { transition: none; }
  html[data-solar="night"][data-wx="clear"] body { background-image: none; }
}
html[data-i18n-pending] body { visibility: hidden; }

.topbar {
  grid-column: 1 / -1;
  grid-row: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: var(--topbar);
  padding: var(--safe-t) 12px 0 max(12px, env(safe-area-inset-left, 0px));
  padding-right: max(12px, env(safe-area-inset-right, 0px));
  border-bottom: 1px solid var(--hairline);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-size: 12px;
  background: color-mix(in oklab, var(--void) 92%, transparent);
  z-index: 40;
}
.brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  flex-shrink: 1;
  min-width: 0;
  color: inherit;
  text-decoration: none;
  font-family: "IBM Plex Sans", system-ui, sans-serif;
}
.brand-mark {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  display: block;
}
.brand-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.topbar .pip.farm { margin-left: 8px; color: var(--spectral-dim); }
.topbar .pip.farm::before { background: var(--spectral-dim); }
.topbar-live {
  display: none;
  align-items: center;
  gap: 12px;
  margin-left: auto;
  color: var(--spectral-dim);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.1em;
  white-space: nowrap;
}
.topbar .lang-toggle { margin-left: auto; }
.topbar .pip { flex-shrink: 0; }
.nav-toggle {
  appearance: none;
  width: 44px;
  height: 44px;
  margin: 0;
  padding: 0;
  border: 1px solid var(--hairline);
  border-radius: 4px;
  background: transparent;
  color: var(--spectral);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.nav-toggle-bars,
.nav-toggle-bars::before,
.nav-toggle-bars::after {
  display: block;
  width: 16px;
  height: 1.5px;
  background: currentColor;
  position: relative;
}
.nav-toggle-bars::before,
.nav-toggle-bars::after {
  content: "";
  position: absolute;
  left: 0;
}
.nav-toggle-bars::before { top: -5px; }
.nav-toggle-bars::after { top: 5px; }
.nav-scrim {
  position: fixed;
  inset: 0;
  background: rgba(7,8,10,0.55);
  z-index: 45;
}
.nav-rail {
  position: fixed;
  top: calc(var(--topbar) + var(--safe-t));
  left: 0;
  bottom: 0;
  width: min(280px, 86vw);
  background: var(--void);
  border-right: 1px solid var(--hairline);
  z-index: 50;
  transform: translateX(-105%);
  transition: transform 180ms ease;
  overflow-y: auto;
  padding: 12px 0 calc(16px + var(--safe-b));
}
body.nav-open .nav-rail { transform: translateX(0); }
.rail-nav { display: flex; flex-direction: column; gap: 2px; }
.nav-a {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 44px;
  padding: 0 16px;
  color: var(--spectral-dim);
  text-decoration: none;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-size: 12px;
}
.nav-a:hover { color: var(--spectral); background: var(--ghost); }
.nav-a[aria-current="page"] { color: var(--spectral); }
.nav-ico { width: 18px; height: 18px; flex-shrink: 0; }
.lang-toggle {
  display: inline-flex;
  flex-shrink: 0;
  border: 1px solid var(--hairline);
  border-radius: 4px;
  overflow: hidden;
}
.lang-btn {
  appearance: none;
  background: transparent;
  border: 0;
  color: var(--spectral-dim);
  font: inherit;
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  min-width: 36px;
  min-height: 36px;
  padding: 0 10px;
  cursor: pointer;
}
.lang-btn + .lang-btn { border-left: 1px solid var(--hairline); }
.lang-btn[aria-pressed="true"] {
  background: var(--ghost);
  color: var(--spectral);
}
.pip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  letter-spacing: 0.1em;
}
.pip::before {
  content: "";
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--hay);
}
.pip.ok::before { background: var(--leaf); }
.pip.warn::before { background: var(--hay); }
.pip.down::before { background: var(--alarm); }

.workspace {
  grid-row: 2;
  grid-column: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
main {
  flex: 1;
  width: 100%;
  max-width: 960px;
  margin: 0 auto;
  padding: 24px 20px calc(32px + var(--safe-b));
}
main.wide { max-width: 1100px; }
h1 {
  font-size: clamp(26px, 5vw, 40px);
  line-height: 1.05;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  margin: 0 0 8px;
  font-weight: 700;
  font-family: "IBM Plex Sans", system-ui, sans-serif;
}
.sub { color: var(--spectral-dim); margin: 0 0 28px; }
.panel {
  border: 1px solid var(--hairline);
  border-radius: 4px;
  padding: 20px;
  margin-bottom: 20px;
  background: color-mix(in oklab, var(--void-soft) 82%, transparent);
}
.panel h2 {
  margin: 0 0 12px;
  font-size: 12px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--spectral-dim);
  font-weight: 600;
}
.dim { color: var(--spectral-dim); font-size: 14px; }
.meta { color: var(--spectral-dim); font-size: 12px; letter-spacing: 0.06em; }
ul { list-style: none; padding: 0; margin: 0; }
li.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 10px 0;
  border-bottom: 1px solid var(--hairline);
}
li.row:last-child { border-bottom: none; }
.name { font-weight: 600; }
label {
  display: block;
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--spectral-dim);
  margin: 12px 0 6px;
}
input, textarea, select {
  width: 100%;
  background: var(--void);
  border: 1px solid var(--ghost-border);
  border-radius: 4px;
  color: var(--spectral);
  padding: 10px 12px;
  font: inherit;
  font-size: 16px;
}
textarea { min-height: 80px; resize: vertical; }
.actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
.check { display: flex; align-items: center; gap: 8px; margin-top: 12px; text-transform: none; letter-spacing: 0; font-size: 14px; color: var(--spectral); }
.check input { width: auto; margin: 0; }
.btn-ghost {
  appearance: none;
  background: var(--ghost);
  border: 1px solid var(--ghost-border);
  color: var(--spectral);
  border-radius: 4px;
  padding: 0 16px;
  height: 40px;
  font: inherit;
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.btn-ghost:hover { background: rgba(240, 240, 250, 0.16); border-color: var(--spectral); }
html[data-solar="day"] .btn-ghost:hover { background: rgba(16, 18, 24, 0.08); }
[hidden] { display: none !important; }
.btn-alarm {
  appearance: none;
  background: var(--alarm);
  border: 1px solid var(--alarm);
  color: #f0f0fa;
  border-radius: 4px;
  padding: 0 16px;
  height: 40px;
  font: inherit;
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
}
.msg { margin-top: 10px; font-size: 13px; color: var(--leaf); }
.msg.err { color: var(--alarm); }
body:not(.is-admin) .admin-only { display: none !important; }
body.is-admin .nav-a[href="/login"] { display: none; }
.risk-high { color: var(--alarm); }
.risk-medium { color: var(--hay); }
.risk-low { color: var(--leaf); }
footer {
  margin-top: 48px;
  padding-top: 16px;
  border-top: 1px solid var(--hairline);
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--spectral-dim);
}
footer a { color: inherit; text-decoration: none; }
footer a:hover { color: var(--spectral); }
a { color: var(--spacex-blue); }
.nav-a, .pip, .panel h2, label, .metric .l, .metric .u, .btn-ghost, .lang-btn, .nav-toggle {
  font-family: "D-DIN", "IBM Plex Sans", system-ui, sans-serif;
}
.metrics {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 16px;
}
.metric {
  border: 1px solid var(--hairline);
  border-radius: 4px;
  padding: 16px;
  background: color-mix(in oklab, var(--void-soft) 82%, transparent);
}
.metric .n {
  font-family: "IBM Plex Mono", ui-monospace, monospace;
  font-size: clamp(22px, 5vw, 32px);
  line-height: 1;
}
.metric .u {
  font-size: 12px;
  letter-spacing: 0.08em;
  color: var(--spectral-dim);
  text-transform: uppercase;
  margin-left: 6px;
}
.metric .l {
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--spectral-dim);
  margin-top: 8px;
}
.grid2 { display: grid; grid-template-columns: 1fr; gap: 12px; }
.metrics.cols-3 { grid-template-columns: 1fr 1fr; }
.eyes-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}
.thumbs {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 8px;
  margin-top: 12px;
}
.thumbs img { width: 100%; aspect-ratio: 4/3; object-fit: cover; border: 1px solid var(--hairline); border-radius: 4px; }
.hero {
  position: relative;
  min-height: 0;
  width: 100%;
  background: var(--void-soft);
}
.hero img {
  width: 100%;
  height: auto;
  aspect-ratio: 2172 / 724;
  object-fit: contain;
  object-position: center;
  display: block;
}
.hero-plate {
  aspect-ratio: 2172 / 724;
  background:
    linear-gradient(180deg, rgba(7,8,10,0.15), rgba(7,8,10,0.72)),
    radial-gradient(ellipse at 30% 20%, color-mix(in oklab, var(--hay) 18%, transparent), transparent 50%),
    var(--void-soft);
}
.hero-scrim {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(7,8,10,0.02), rgba(7,8,10,0.48));
  pointer-events: none;
}
html[data-solar="day"] .hero-scrim {
  background: linear-gradient(180deg, rgba(238,242,230,0.04), rgba(16,18,24,0.48));
}
.hero-copy {
  position: absolute;
  left: 16px;
  right: 16px;
  bottom: 12px;
  z-index: 1;
}
.hero-copy h1 {
  color: #f0f0fa;
  font-size: clamp(22px, 4vw, 32px);
  margin: 0 0 4px;
}
.hero-copy .sub { color: rgba(240,240,250,0.82); margin: 0; font-size: 13px; }
.grok-dock {
  position: sticky;
  bottom: 0;
  border-top: 1px solid var(--hairline);
  background: color-mix(in oklab, var(--void) 92%, transparent);
  padding: 10px 16px calc(14px + var(--safe-b));
  z-index: 20;
}
.grok-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  max-width: 1100px;
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
  font-family: "IBM Plex Mono", ui-monospace, monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.grok-bar input[type="text"] {
  width: auto;
  flex: 1 1 160px;
  min-width: 120px;
  font-family: "IBM Plex Mono", ui-monospace, monospace;
  font-size: 16px;
  height: 40px;
  padding: 0 10px;
}
.grok-bar button { height: 40px; }
.grok-out {
  max-width: 1100px;
  margin: 10px auto 0;
  padding: 12px;
  border: 1px solid var(--hairline);
  border-radius: 4px;
  background: var(--void-soft);
  font-family: "IBM Plex Mono", ui-monospace, monospace;
  font-size: 13px;
  white-space: pre-wrap;
  max-height: 220px;
  overflow: auto;
}

.page-home main { padding-top: 12px; padding-bottom: 96px; }
.page-home .intro {
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;
  margin: 0 0 18px;
}
.page-home .metrics { margin-bottom: 0; }
.page-home .metric { padding: 10px 12px; }
.page-home .metric .n { font-size: clamp(18px, 3.6vw, 24px); }
.page-home .metric .l { margin-top: 4px; }
.page-home .panel { padding: 14px 16px; margin-bottom: 14px; }
.page-home .split { display: grid; grid-template-columns: 1fr; gap: 14px; }
.howto { margin: 0 0 14px; }
.hint {
  font-size: 14px;
  color: var(--spectral-dim);
  margin: 0 0 14px;
  letter-spacing: 0;
  text-transform: none;
  line-height: 1.45;
}
.pitch { font-size: 15px; max-width: 68ch; margin: 0; line-height: 1.4; }
.guide {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
  margin-bottom: 8px;
}
.guide a, .guide .card {
  border: 1px solid var(--hairline);
  padding: 14px 16px;
  text-decoration: none;
  color: inherit;
  border-radius: 4px;
  background: color-mix(in oklab, var(--void-soft) 82%, transparent);
}
.guide a:hover { border-color: var(--ghost-border); }
.guide a strong, .guide .card strong {
  display: block;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-size: 12px;
}
.guide a span, .guide .card span {
  display: block;
  color: var(--spectral-dim);
  font-size: 14px;
  letter-spacing: 0;
  text-transform: none;
  margin-top: 4px;
}
.timeline { list-style: none; padding: 0; margin: 0; }
.phase {
  display: grid;
  grid-template-columns: 1fr;
  gap: 6px;
  padding: 14px 0;
  border-bottom: 1px solid var(--hairline);
}
.phase:last-child { border-bottom: none; }
.phase .when {
  font-family: "IBM Plex Mono", ui-monospace, monospace;
  font-size: 12px;
  color: var(--spectral-dim);
}
.phase .eur {
  font-family: "IBM Plex Mono", ui-monospace, monospace;
  font-size: 14px;
  white-space: nowrap;
}
.st { font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--spectral-dim); }
.st.active { color: var(--hay); }
.st.done { color: var(--leaf); }
.trello-cols {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}
.trello-col {
  border: 1px solid var(--hairline);
  border-radius: 4px;
  padding: 12px;
}
.trello-col h3 {
  margin: 0 0 8px;
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--spectral-dim);
  font-weight: 600;
}
.live-stills { display: flex; gap: 8px; flex-wrap: wrap; margin: 0 0 16px; }
.live-stills a { display: block; width: 120px; }
.live-stills img { width: 100%; aspect-ratio: 16/10; object-fit: cover; border: 1px solid var(--hairline); border-radius: 4px; }

@media (min-width: 720px) {
  body {
    grid-template-columns: 56px minmax(0, 1fr);
  }
  .workspace { grid-column: 2; }
  .nav-toggle { display: none; }
  .nav-scrim { display: none !important; }
  .nav-rail {
    position: static;
    grid-row: 2;
    grid-column: 1;
    width: 56px;
    transform: none;
    transition: none;
  }
  .nav-a { justify-content: center; padding: 0; }
  .nav-a span {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }
  .topbar-live { display: flex; }
  .topbar .lang-toggle { margin-left: 0; }
  .metrics { grid-template-columns: repeat(2, 1fr); }
  .metrics.cols-3 { grid-template-columns: repeat(3, 1fr); }
  .grid2 { grid-template-columns: 1fr 1fr; }
  .eyes-grid { grid-template-columns: 1fr 1fr; }
  .page-home .split { grid-template-columns: 1fr 1fr; }
  .guide { grid-template-columns: 1fr 1fr; }
  .phase { grid-template-columns: 140px 1fr auto; align-items: start; }
  .trello-cols { grid-template-columns: repeat(2, 1fr); }
}

@media (min-width: 1100px) {
  body { grid-template-columns: var(--rail) minmax(0, 1fr); }
  .nav-rail { width: var(--rail); }
  .nav-a { justify-content: flex-start; padding: 0 16px; }
  .nav-a span {
    position: static;
    width: auto;
    height: auto;
    overflow: visible;
    clip: auto;
  }
  .metrics { grid-template-columns: repeat(4, 1fr); }
  .eyes-grid { grid-template-columns: repeat(3, 1fr); }
  h1 { font-size: 40px; }
  .guide { grid-template-columns: 1fr 1fr 1fr; }
  .trello-cols { grid-template-columns: repeat(3, 1fr); }
}

@media (max-width: 719px) {
  .topbar .pip { display: none; }
  .hands-row .actions { width: 100%; }
}

@media print {
  .nav-rail, .nav-toggle, .nav-scrim, .topbar-live, .grok-dock { display: none !important; }
  body { display: block; grid-template-columns: none; }
  .workspace { display: block; }
}
`;
