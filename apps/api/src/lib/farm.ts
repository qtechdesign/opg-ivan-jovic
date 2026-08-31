import type { Context } from "hono";
import type { Farm } from "@polje/schema";

export const DEFAULT_FARM_SLUG = "ivan-jovic";

export function defaultFarmSlug(env?: unknown): string {
  if (env && typeof env === "object" && "DEFAULT_FARM_SLUG" in env) {
    const v = (env as { DEFAULT_FARM_SLUG?: string }).DEFAULT_FARM_SLUG;
    if (typeof v === "string" && v.length > 0) return v;
  }
  return DEFAULT_FARM_SLUG;
}

export function farmSlugFromQuery(
  c: Context<{ Bindings: Cloudflare.Env }>
): string {
  return c.req.query("farm") || defaultFarmSlug(c.env);
}

export async function getFarmBySlug(
  db: D1Database,
  slug: string
): Promise<Farm | null> {
  return db
    .prepare(
      `SELECT id, slug, name, country, timezone, lat, lon, starlink_site, created_at
       FROM farms WHERE slug = ?`
    )
    .bind(slug)
    .first<Farm>();
}

export async function farmFromRequest(
  c: Context<{ Bindings: Cloudflare.Env }>
): Promise<{ slug: string; farm: Farm | null; defaultSlug: string }> {
  const defaultSlug = defaultFarmSlug(c.env);
  const slug = c.req.query("farm") || defaultSlug;
  const farm = await getFarmBySlug(c.env.DB, slug);
  return { slug, farm, defaultSlug };
}
