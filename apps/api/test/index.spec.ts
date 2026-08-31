import { env } from "cloudflare:test";
import { describe, expect, it, beforeAll } from "vitest";
import app from "../src/index";

const MIGRATION_STATEMENTS = [
  `CREATE TABLE farms (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'HR',
  timezone TEXT NOT NULL DEFAULT 'Europe/Zagreb',
  lat REAL,
  lon REAL,
  starlink_site TEXT,
  created_at TEXT NOT NULL
)`,
  `CREATE TABLE plots (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL,
  name TEXT NOT NULL,
  hectares REAL,
  use_type TEXT,
  notes TEXT
)`,
];

async function migrateAndSeed() {
  for (const statement of MIGRATION_STATEMENTS) {
    await env.DB.prepare(statement).run();
  }

  await env.DB.prepare(
    `INSERT INTO farms (id, slug, name, country, timezone, lat, lon, starlink_site, created_at)
     VALUES (?, 'ivan-jovic', 'OPG Ivan Jović', 'HR', 'Europe/Zagreb', NULL, NULL, NULL, '2026-08-31T00:00:00Z')`
  )
    .bind("a1000000-0000-4000-8000-000000000001")
    .run();
  await env.DB.prepare(
    `INSERT INTO plots (id, farm_id, name, hectares, use_type, notes) VALUES
      ('b1000000-0000-4000-8000-000000000001', ?, 'House yard', NULL, 'yard', NULL),
      ('b1000000-0000-4000-8000-000000000002', ?, 'Hay field', NULL, 'hay', NULL)`
  )
    .bind(
      "a1000000-0000-4000-8000-000000000001",
      "a1000000-0000-4000-8000-000000000001"
    )
    .run();
}

describe("polje M0", () => {
  beforeAll(async () => {
    await migrateAndSeed();
  });

  it("GET /v1/health", async () => {
    const res = await app.request("/v1/health", {}, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      service: string;
      time: string;
    };
    expect(body.ok).toBe(true);
    expect(body.service).toBe("polje");
    expect(typeof body.time).toBe("string");
  });

  it("GET /v1/farms/ivan-jovic", async () => {
    const res = await app.request("/v1/farms/ivan-jovic", {}, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      slug: string;
      name: string;
      plots: unknown[];
    };
    expect(body.slug).toBe("ivan-jovic");
    expect(body.name).toBe("OPG Ivan Jović");
    expect(Array.isArray(body.plots)).toBe(true);
    expect(body.plots.length).toBeGreaterThanOrEqual(2);
  });

  it("GET /v1/farms/missing → 404", async () => {
    const res = await app.request("/v1/farms/no-such-farm", {}, env);
    expect(res.status).toBe(404);
  });
});
