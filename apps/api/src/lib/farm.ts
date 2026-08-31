import type { Farm } from "@polje/schema";

export const DEFAULT_FARM_SLUG = "ivan-jovic";

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
