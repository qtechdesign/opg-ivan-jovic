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
header nav a {
  color: var(--spectral-dim);
  text-decoration: none;
  margin-left: 16px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-size: 11px;
}
header nav a:hover { color: var(--spectral); }
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
main { max-width: 820px; margin: 0 auto; padding: 40px 20px; }
h1 {
  font-size: 40px;
  line-height: 0.95;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  margin: 0 0 12px;
  font-weight: 700;
}
.sub { color: var(--spectral-dim); font-size: 14px; margin-bottom: 32px; }
.panel {
  background: color-mix(in oklab, var(--void-soft) 82%, transparent);
  border: 1px solid var(--hairline);
  border-radius: 4px;
  padding: 20px;
  margin-bottom: 16px;
}
.panel h2 {
  margin: 0 0 12px;
  font-size: 12px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--spectral-dim);
  font-weight: 500;
}
ul { list-style: none; margin: 0; padding: 0; }
li {
  padding: 10px 0;
  border-bottom: 1px solid var(--hairline);
  font-size: 15px;
}
li:last-child { border-bottom: none; }
.row { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
.meta { color: var(--spectral-dim); font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; }
.status {
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--leaf);
}
.dim { color: var(--spectral-dim); }
.nest { margin: 8px 0 0 16px; padding: 0; border: none; }
.nest li { border-bottom: none; padding: 4px 0; font-size: 14px; }
label {
  display: block;
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--spectral-dim);
  margin: 12px 0 6px;
}
input, select, textarea {
  width: 100%;
  background: var(--ghost);
  border: 1px solid var(--hairline);
  border-radius: 4px;
  color: var(--spectral);
  padding: 10px 12px;
  font: inherit;
}
textarea { min-height: 72px; resize: vertical; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
@media (max-width: 640px) { .grid2 { grid-template-columns: 1fr; } }
.btn-ghost, button.btn-ghost {
  display: inline-flex;
  align-items: center;
  height: 40px;
  padding: 0 20px;
  background: var(--ghost);
  color: var(--spectral);
  border: 1px solid var(--ghost-border);
  border-radius: 4px;
  text-decoration: none;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-size: 13px;
  cursor: pointer;
  font-family: inherit;
}
.btn-ghost:hover, button.btn-ghost:hover { background: rgba(240,240,250,0.16); }
.actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 16px; }
.msg { margin-top: 12px; font-size: 13px; color: var(--hay); min-height: 1.2em; }
.msg.err { color: var(--alarm); }
.thumbs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 12px; }
.thumbs a {
  display: block;
  aspect-ratio: 16/9;
  border: 1px solid var(--hairline);
  border-radius: 4px;
  overflow: hidden;
  background: var(--void-soft);
}
.thumbs img { width: 100%; height: 100%; object-fit: cover; display: block; }
footer {
  margin-top: 40px;
  color: var(--spectral-dim);
  font-size: 12px;
  letter-spacing: 0.06em;
}
`.trim();
