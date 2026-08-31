import { env } from "cloudflare:test";
import { describe, expect, it, beforeAll } from "vitest";
import { app } from "../src/index";
import { farmStub } from "../src/do/farm-runtime";

const OPERATOR = "test-operator-token";
const INGEST = "test-ingest-token";

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
  `CREATE TABLE devices (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  driver TEXT NOT NULL,
  name TEXT NOT NULL,
  zone TEXT,
  protocol TEXT,
  address TEXT,
  config_json TEXT,
  last_seen TEXT
)`,
  `CREATE TABLE readings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  metric TEXT NOT NULL,
  value REAL NOT NULL,
  ts TEXT NOT NULL
)`,
  `CREATE TABLE commands (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  action TEXT NOT NULL,
  payload_json TEXT,
  source TEXT,
  status TEXT NOT NULL,
  confirmed_by TEXT,
  created_at TEXT NOT NULL
)`,
  `CREATE TABLE camera_snapshots (
  camera_id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'image/jpeg',
  source TEXT NOT NULL,
  captured_at TEXT NOT NULL
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
  await env.DB.prepare(
    `INSERT INTO devices (id, farm_id, kind, driver, name, zone, protocol, address, config_json, last_seen) VALUES
      ('cam-yard', ?, 'camera', 'rtsp', 'Yard camera', 'House yard', 'rtsp', 'env:CAMERA_YARD_RTSP', NULL, NULL),
      ('cam-garden', ?, 'camera', 'rtsp', 'Garden camera', 'Garden', 'rtsp', 'env:CAMERA_GARDEN_RTSP', NULL, NULL),
      ('cam-hay', ?, 'camera', 'rtsp', 'Hay camera', 'Hay field', 'rtsp', 'env:CAMERA_HAY_RTSP', NULL, NULL)`
  )
    .bind(
      "a1000000-0000-4000-8000-000000000001",
      "a1000000-0000-4000-8000-000000000001",
      "a1000000-0000-4000-8000-000000000001"
    )
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

  it("POST /v1/ingest without token → 401", async () => {
    const res = await app.request(
      "/v1/ingest",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          farm_id: "ivan-jovic",
          batch_id: "b1",
          sent_at: new Date().toISOString(),
          readings: [],
        }),
      },
      env
    );
    expect(res.status).toBe(401);
  });

  it("FarmRuntime applies ingest + overview", async () => {
    const stub = farmStub(env, "ivan-jovic");
    const batch = {
      farm_id: "ivan-jovic",
      batch_id: "test-batch-1",
      sent_at: "2026-08-31T12:00:00Z",
      readings: [
        {
          device_id: "soil-n-1",
          metric: "moisture",
          value: 0.33,
          ts: "2026-08-31T12:00:00Z",
        },
      ],
      health: { starlink: "up" as const, edge: "ok", mqtt: "ok" },
    };
    const apply = await stub.fetch(
      new Request("https://do/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(batch),
      })
    );
    expect(apply.status).toBe(202);
    const first = (await apply.json()) as { duplicate: boolean; applied: number };
    expect(first.duplicate).toBe(false);
    expect(first.applied).toBe(1);

    const dup = await stub.fetch(
      new Request("https://do/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(batch),
      })
    );
    const second = (await dup.json()) as { duplicate: boolean };
    expect(second.duplicate).toBe(true);

    const overview = await app.request("/v1/overview?farm=ivan-jovic", {}, env);
    expect(overview.status).toBe(200);
    const body = (await overview.json()) as {
      live: { starlink: string; metrics: Record<string, { value: number }> };
    };
    expect(body.live.starlink).toBe("up");
    expect(body.live.metrics["soil-n-1:moisture"].value).toBe(0.33);
  });
});

describe("polje M3 cameras", () => {
  beforeAll(async () => {
    await migrateAndSeed();
  });

  it("GET /v1/cameras lists three cameras", async () => {
    const res = await app.request("/v1/cameras?farm=ivan-jovic", {}, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      cameras: Array<{ id: string; snapshot: unknown }>;
    };
    expect(body.cameras.length).toBe(3);
    expect(body.cameras.map((c) => c.id).sort()).toEqual([
      "cam-garden",
      "cam-hay",
      "cam-yard",
    ]);
  });

  it("POST /v1/cameras/:id/snapshot without token → 401", async () => {
    const res = await app.request(
      "/v1/cameras/cam-yard/snapshot",
      { method: "POST" },
      env
    );
    expect(res.status).toBe(401);
  });

  it("POST /v1/ingest/media upserts latest + GET latest 200", async () => {
    // Minimal JPEG (1x1)
    const jpeg = Uint8Array.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
      0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
      0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
      0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
      0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
      0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32,
      0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
      0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00,
      0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
      0x09, 0x0a, 0x0b, 0xff, 0xc4, 0x00, 0xb5, 0x10, 0x00, 0x02, 0x01, 0x03,
      0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04, 0x00, 0x00, 0x01, 0x7d,
      0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06,
      0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xa1, 0x08,
      0x23, 0x42, 0xb1, 0xc1, 0x15, 0x52, 0xd1, 0xf0, 0x24, 0x33, 0x62, 0x72,
      0x82, 0x09, 0x0a, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x25, 0x26, 0x27, 0x28,
      0x29, 0x2a, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45,
      0x46, 0x47, 0x48, 0x49, 0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59,
      0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x73, 0x74, 0x75,
      0x76, 0x77, 0x78, 0x79, 0x7a, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89,
      0x8a, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3,
      0xa4, 0xa5, 0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6,
      0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3, 0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9,
      0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xe1, 0xe2,
      0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf1, 0xf2, 0xf3, 0xf4,
      0xf5, 0xf6, 0xf7, 0xf8, 0xf9, 0xfa, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01,
      0x00, 0x00, 0x3f, 0x00, 0x7b, 0xdf, 0xff, 0xd9,
    ]);

    const form = new FormData();
    form.append(
      "file",
      new File([jpeg], "latest.jpg", { type: "image/jpeg" })
    );
    form.append("camera_id", "cam-yard");
    form.append("source", "placeholder");
    form.append("farm_slug", "ivan-jovic");

    const up = await app.request(
      "/v1/ingest/media",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${INGEST}` },
        body: form,
      },
      env
    );
    expect(up.status).toBe(201);

    const latest = await app.request("/v1/cameras/cam-yard/latest", {}, env);
    expect(latest.status).toBe(200);
    expect(latest.headers.get("content-type")).toContain("image/jpeg");

    const list = await app.request("/v1/cameras?farm=ivan-jovic", {}, env);
    const body = (await list.json()) as {
      cameras: Array<{ id: string; snapshot: { source: string } | null }>;
    };
    const yard = body.cameras.find((c) => c.id === "cam-yard");
    expect(yard?.snapshot?.source).toBe("placeholder");
  });

  it("GET /eyes returns HTML", async () => {
    const res = await app.request("/eyes", {}, env);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Oči");
    expect(html).toContain("Snimka sada");
  });
});
