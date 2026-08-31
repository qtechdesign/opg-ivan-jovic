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

export function siteNav(slug: string, defaultSlug: string): string {
  const href = (path: string) => farmPath(path, slug, defaultSlug);
  return `<nav>
      <a href="${href("/")}">Pregled</a>
      <a href="${href("/land")}">Zemlja</a>
      <a href="${href("/water")}">Voda</a>
      <a href="${href("/frost")}">Mraz</a>
      <a href="${href("/klima")}">Klima</a>
      <a href="${href("/eyes")}">Oči</a>
      <a href="${href("/hands")}">Ruke</a>
      <a href="${href("/ledger")}">Knjiga</a>
      <a href="${href("/mail")}">Pošta</a>
      <a href="/login">Admin</a>
    </nav>`;
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
  return `<span class="brand">Polje · ${escapeHtml(name)}</span>${pip}`;
}

/** Default-tenant nav (ivan-jovic). Prefer siteNav(slug, defaultSlug). */
export const SITE_NAV = siteNav("ivan-jovic", "ivan-jovic");

export const FARM_SLUG_JS = `const FARM = document.documentElement.getAttribute("data-farm") || "";`;

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export const CHASSIS_CSS = `
:root {
  --void: #07080a;
  --void-soft: #101218;
  --spectral: #f0f0fa;
  --spectral-dim: #b8b8c6;
  --hairline: rgba(240, 240, 250, 0.16);
  --ghost: rgba(240, 240, 250, 0.08);
  --ghost-border: rgba(240, 240, 250, 0.35);
  --leaf: #3d8c4a;
  --hay: #d4a017;
  --soil: #6b4a2e;
  --ice: #7ec8e3;
  --alarm: #c43c2c;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  min-height: 100vh;
  background: var(--void);
  color: var(--spectral);
  font-family: "IBM Plex Sans", "Bahnschrift", system-ui, sans-serif;
  font-size: 16px;
  line-height: 1.45;
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 48px;
  padding: 0 20px;
  border-bottom: 1px solid var(--hairline);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-size: 12px;
}
header .brand { font-weight: 700; letter-spacing: 0.12em; }
header .pip.farm { margin-left: 12px; color: var(--spectral-dim); }
header .pip.farm::before { background: var(--spectral-dim); }
header nav a {
  color: var(--spectral-dim);
  text-decoration: none;
  margin-left: 16px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-size: 11px;
}
header nav a:hover { color: var(--spectral); }
header nav a[aria-current="page"] { color: var(--spectral); }
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
main { max-width: 820px; margin: 0 auto; padding: 40px 20px; }
h1 {
  font-size: 40px;
  line-height: 0.95;
  letter-spacing: -0.02em;
  margin: 0 0 8px;
  font-weight: 700;
}
.sub { color: var(--spectral-dim); margin: 0 0 32px; }
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
  gap: 12px;
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
}
textarea { min-height: 80px; resize: vertical; }
.actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
.btn-ghost {
  appearance: none;
  background: transparent;
  border: 1px solid var(--ghost-border);
  color: var(--spectral);
  border-radius: 4px;
  padding: 10px 16px;
  font: inherit;
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  text-decoration: none;
  display: inline-block;
}
.btn-ghost:hover { border-color: var(--spectral); }
.btn-alarm {
  appearance: none;
  background: var(--alarm);
  border: 1px solid var(--alarm);
  color: var(--spectral);
  border-radius: 4px;
  padding: 10px 16px;
  font: inherit;
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
}
.msg { margin-top: 10px; font-size: 13px; color: var(--leaf); }
.msg.err { color: var(--alarm); }
body:not(.is-admin) .admin-only { display: none !important; }
body.is-admin header nav a[href="/login"] { display: none; }
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
`;
