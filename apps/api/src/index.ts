import { Hono } from "hono";
import type { Farm, Plot } from "@polje/schema";

type Bindings = Cloudflare.Env;

const app = new Hono<{ Bindings: Bindings }>();

app.get("/v1/health", (c) => {
  return c.json({
    ok: true as const,
    service: c.env.SERVICE_NAME || "polje",
    time: new Date().toISOString(),
  });
});

app.get("/v1/farms/:slug", async (c) => {
  const slug = c.req.param("slug");

  const farm = await c.env.DB.prepare(
    `SELECT id, slug, name, country, timezone, lat, lon, starlink_site, created_at
     FROM farms WHERE slug = ?`
  )
    .bind(slug)
    .first<Farm>();

  if (!farm) {
    return c.json({ error: "farm_not_found", slug }, 404);
  }

  const { results: plots } = await c.env.DB.prepare(
    `SELECT id, farm_id, name, hectares, use_type, notes
     FROM plots WHERE farm_id = ? ORDER BY name`
  )
    .bind(farm.id)
    .all<Plot>();

  return c.json({ ...farm, plots: plots ?? [] });
});

app.get("/", async (c) => {
  const farm = await c.env.DB.prepare(
    `SELECT id, slug, name, timezone FROM farms WHERE slug = 'ivan-jovic'`
  ).first<{ id: string; slug: string; name: string; timezone: string }>();

  let plotsHtml = "<li class=\"dim\">Nema parcela — pokreni seed.</li>";
  if (farm) {
    const { results: plots } = await c.env.DB.prepare(
      `SELECT name, use_type FROM plots WHERE farm_id = ? ORDER BY name`
    )
      .bind(farm.id)
      .all<{ name: string; use_type: string | null }>();

    if (plots && plots.length > 0) {
      plotsHtml = plots
        .map(
          (p) =>
            `<li><span class="name">${escapeHtml(p.name)}</span>` +
            (p.use_type
              ? ` <span class="meta">${escapeHtml(p.use_type)}</span>`
              : "") +
            `</li>`
        )
        .join("");
    }
  }

  const title = farm?.name ?? "Polje";
  const status = farm ? "ONLINE" : "UNSEEDED";
  const statusClass = farm ? "ok" : "warn";

  const html = `<!DOCTYPE html>
<html lang="hr" data-solar="day" data-wx="clear">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>POLJE · ${escapeHtml(title)}</title>
  <style>
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
    main { max-width: 720px; margin: 0 auto; padding: 40px 20px; }
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
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid var(--hairline);
      font-size: 15px;
    }
    li:last-child { border-bottom: none; }
    .meta { color: var(--spectral-dim); font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; }
    .dim { color: var(--spectral-dim); }
    a.btn-ghost {
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
    }
    a.btn-ghost:hover { background: rgba(240,240,250,0.16); }
    footer {
      margin-top: 40px;
      color: var(--spectral-dim);
      font-size: 12px;
      letter-spacing: 0.06em;
    }
  </style>
</head>
<body>
  <header>
    <span class="brand">Polje · OPG Ivan Jović</span>
    <span class="pip ${statusClass}">${status}</span>
  </header>
  <main>
    <h1>${escapeHtml(title)}</h1>
    <p class="sub">Konzola farme · M0 skeleton · Europa/Zagreb</p>
    <section class="panel">
      <h2>Parcele</h2>
      <ul>${plotsHtml}</ul>
    </section>
    <p>
      <a class="btn-ghost" href="/v1/farms/ivan-jovic">JSON · /v1/farms/ivan-jovic</a>
      &nbsp;
      <a class="btn-ghost" href="/v1/health">Health</a>
    </p>
    <footer>Polje is the field. The field was here first.</footer>
  </main>
</body>
</html>`;

  return c.html(html);
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default app;
