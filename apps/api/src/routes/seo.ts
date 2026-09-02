import { Hono } from "hono";
import { publicOriginFromHost } from "../lib/public-origin";

type AppEnv = { Bindings: Cloudflare.Env };

/** Public HTML surfaces. Login and /v1 stay out of the index. */
const PUBLIC_PATHS: Array<{ path: string; priority: string }> = [
  { path: "/", priority: "1.0" },
  { path: "/land", priority: "0.8" },
  { path: "/eyes", priority: "0.8" },
  { path: "/plan", priority: "0.8" },
  { path: "/water", priority: "0.7" },
  { path: "/frost", priority: "0.7" },
  { path: "/klima", priority: "0.7" },
  { path: "/ledger", priority: "0.7" },
  { path: "/hands", priority: "0.6" },
  { path: "/mail", priority: "0.6" },
];

function publicOrigin(c: { req: { header: (n: string) => string | undefined } }): string {
  return publicOriginFromHost(c.req.header("host"));
}

export const seoApi = new Hono<AppEnv>();

seoApi.get("/robots.txt", (c) => {
  const origin = publicOrigin(c);
  const body = `User-agent: *
Allow: /
Allow: /.well-known/
Disallow: /login
Disallow: /v1/
Disallow: /mcp
Disallow: /mcp/

Sitemap: ${origin}/sitemap.xml
Agentmap: ${origin}/.well-known/ai-catalog.json
`;
  return c.text(body, 200, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "public, max-age=3600",
  });
});

seoApi.get("/sitemap.xml", (c) => {
  const origin = publicOrigin(c);
  const lastmod = new Date().toISOString().slice(0, 10);
  const urls = PUBLIC_PATHS.map(({ path, priority }) => {
    const loc = path === "/" ? `${origin}/` : `${origin}${path}`;
    return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <priority>${priority}</priority>
  </url>`;
  }).join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
});
