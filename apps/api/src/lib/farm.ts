import type { Context } from "hono";
import type { Farm } from "@polje/schema";
import { farmCacheKey } from "./kv";

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

const FARM_CACHE_TTL_SEC = 60;

/** D1 lookup with a short KV cache. Source of truth stays D1. */
export async function getFarm(
  env: { DB: D1Database; KV?: KVNamespace },
  slug: string
): Promise<Farm | null> {
  const key = farmCacheKey(slug);
  if (env.KV) {
    try {
      const hit = await env.KV.get<Farm>(key, "json");
      if (hit?.id && hit.slug === slug) return hit;
    } catch {
      /* miss */
    }
  }
  const farm = await getFarmBySlug(env.DB, slug);
  if (farm && env.KV) {
    try {
      await env.KV.put(key, JSON.stringify(farm), {
        expirationTtl: FARM_CACHE_TTL_SEC,
      });
    } catch {
      /* cache is best-effort */
    }
  }
  return farm;
}

export async function farmFromRequest(
  c: Context<{ Bindings: Cloudflare.Env }>
): Promise<{ slug: string; farm: Farm | null; defaultSlug: string }> {
  const defaultSlug = defaultFarmSlug(c.env);
  const slug = c.req.query("farm") || defaultSlug;
  const farm = await getFarm(c.env, slug);
  return { slug, farm, defaultSlug };
}
