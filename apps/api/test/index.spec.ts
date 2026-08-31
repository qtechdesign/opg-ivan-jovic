import { env } from "cloudflare:test";
import { describe, expect, it, beforeAll } from "vitest";
import app from "../src/index";

const OPERATOR = "test-operator-token";

const MIGRATION = [
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
  `CREATE TABLE plantings (
  id TEXT PRIMARY KEY,
  plot_id TEXT NOT NULL,
  crop TEXT NOT NULL,
  variety TEXT,
  planted_on TEXT,
  stage TEXT,
  expected_harvest TEXT,
  yield_kg REAL
)`,
  `CREATE TABLE audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  farm_id TEXT NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  entity TEXT,
  before_json TEXT,
  after_json TEXT,
  ts TEXT NOT NULL
)`,
  `CREATE TABLE growth_media (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL,
  plot_id TEXT,
  planting_id TEXT,
  r2_key TEXT NOT NULL,
  caption TEXT,
  content_type TEXT,
  created_at TEXT NOT NULL
)`,
];

async function migrateAndSeed() {
  for (const statement of MIGRATION) {
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
      ('b1000000-0000-4000-8000-000000000001', ?, 'House yard', NULL, 'yard', NULL)`
  )
    .bind("a1000000-0000-4000-8000-000000000001")
    .run();
}

function authJson() {
  return {
    Authorization: `Bearer ${OPERATOR}`,
    "Content-Type": "application/json",
  };
}

describe("polje M1", () => {
  beforeAll(async () => {
    // Override operator token for tests via binding from vitest config
    await migrateAndSeed();
  });

  it("GET /v1/health", async () => {
    const res = await app.request("/v1/health", {}, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; service: string };
    expect(body.ok).toBe(true);
    expect(body.service).toBe("polje");
  });

  it("POST /v1/plots without token → 401", async () => {
    const res = await app.request(
      "/v1/plots",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Test" }),
      },
      env
    );
    expect(res.status).toBe(401);
  });

  it("POST /v1/plots with token creates + audit", async () => {
    const res = await app.request(
      "/v1/plots",
      {
        method: "POST",
        headers: authJson(),
        body: JSON.stringify({
          farm_slug: "ivan-jovic",
          name: "Orchard test",
          use_type: "orchard",
        }),
      },
      env
    );
    expect(res.status).toBe(201);
    const plot = (await res.json()) as { id: string; name: string };
    expect(plot.name).toBe("Orchard test");

    const auditRes = await app.request(
      "/v1/audit?farm=ivan-jovic&limit=5",
      { headers: { Authorization: `Bearer ${OPERATOR}` } },
      env
    );
    expect(auditRes.status).toBe(200);
    const audit = (await auditRes.json()) as {
      audit: Array<{ action: string }>;
    };
    expect(audit.audit.some((a) => a.action === "plot.create")).toBe(true);
  });

  it("POST planting + PATCH stage with audit", async () => {
    const create = await app.request(
      "/v1/plantings",
      {
        method: "POST",
        headers: authJson(),
        body: JSON.stringify({
          plot_id: "b1000000-0000-4000-8000-000000000001",
          crop: "Krumpir",
          stage: "seeded",
        }),
      },
      env
    );
    expect(create.status).toBe(201);
    const planting = (await create.json()) as { id: string; stage: string };
    expect(planting.stage).toBe("seeded");

    const patch = await app.request(
      `/v1/plantings/${planting.id}`,
      {
        method: "PATCH",
        headers: authJson(),
        body: JSON.stringify({ stage: "growing" }),
      },
      env
    );
    expect(patch.status).toBe(200);
    const updated = (await patch.json()) as { stage: string };
    expect(updated.stage).toBe("growing");

    const auditRes = await app.request(
      "/v1/audit?farm=ivan-jovic&limit=20",
      { headers: { Authorization: `Bearer ${OPERATOR}` } },
      env
    );
    const audit = (await auditRes.json()) as {
      audit: Array<{ action: string }>;
    };
    expect(audit.audit.some((a) => a.action === "planting.patch")).toBe(true);
  });

  it("GET /land returns HTML", async () => {
    const res = await app.request("/land", {}, env);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Zemlja");
    expect(html).toContain("Operator token");
  });
});
