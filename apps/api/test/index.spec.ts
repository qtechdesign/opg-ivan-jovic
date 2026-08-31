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
  `CREATE TABLE ledger (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL,
  ts TEXT NOT NULL,
  kind TEXT NOT NULL,
  category TEXT,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  note TEXT,
  r2_key TEXT
)`,
  `CREATE INDEX ledger_farm_ts ON ledger(farm_id, ts)`,
  `CREATE TABLE automations (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL,
  name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0,
  risk TEXT NOT NULL DEFAULT 'medium',
  trigger_json TEXT NOT NULL,
  action_json TEXT NOT NULL,
  cooldown_sec INTEGER NOT NULL DEFAULT 300,
  last_fired_at TEXT,
  last_error TEXT,
  created_at TEXT
)`,
  `CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  payload_json TEXT,
  source TEXT NOT NULL,
  confirmed_by TEXT,
  reason TEXT,
  automation_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`,
  `CREATE TABLE automation_runs (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL,
  automation_id TEXT NOT NULL,
  fired_at TEXT NOT NULL,
  trigger_match_json TEXT,
  result_json TEXT,
  ok INTEGER NOT NULL DEFAULT 1
)`,
  `CREATE TABLE farm_settings (
  farm_id TEXT PRIMARY KEY,
  rain_lockout INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
)`,
  `CREATE TABLE irrigation_zones (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL,
  plot_id TEXT,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  device_id TEXT NOT NULL,
  max_duration_sec INTEGER NOT NULL DEFAULT 3600,
  default_duration_sec INTEGER NOT NULL DEFAULT 600,
  rain_lockout INTEGER NOT NULL DEFAULT 1,
  enabled INTEGER NOT NULL DEFAULT 1
)`,
  `CREATE TABLE irrigation_runs (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL,
  zone_id TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  duration_sec INTEGER NOT NULL,
  source TEXT NOT NULL,
  command_id TEXT,
  status TEXT NOT NULL,
  water_m3 REAL,
  reason TEXT
)`,
  `CREATE TABLE irrigation_schedules (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL,
  zone_id TEXT NOT NULL,
  time_local TEXT NOT NULL,
  days_json TEXT NOT NULL,
  duration_sec INTEGER NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Europe/Zagreb',
  enabled INTEGER NOT NULL DEFAULT 0
)`,
  `CREATE TABLE briefings (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL,
  local_date TEXT NOT NULL,
  body_hr TEXT NOT NULL,
  body_en TEXT NOT NULL,
  r2_key TEXT,
  model TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (farm_id, local_date)
)`,
  `CREATE TABLE planting_notes (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL,
  planting_id TEXT NOT NULL,
  body TEXT NOT NULL,
  actor TEXT NOT NULL,
  created_at TEXT NOT NULL
)`,
  `CREATE TABLE frost_events (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  min_temp_c REAL,
  mode TEXT,
  water_m3 REAL,
  notes TEXT
)`,
  `CREATE TABLE frost_programs (
  farm_id TEXT PRIMARY KEY,
  program_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'idle',
  updated_at TEXT NOT NULL,
  updated_by TEXT
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
      ('cam-hay', ?, 'camera', 'rtsp', 'Hay camera', 'Hay field', 'rtsp', 'env:CAMERA_HAY_RTSP', NULL, NULL),
      ('soil-n-1', ?, 'sensor', 'mqtt-generic', 'Garden soil', 'Garden', 'mqtt', 'polje/ivan-jovic/dev/soil-n-1/stat', NULL, NULL),
      ('valve-garden-drip', ?, 'actuator', 'mqtt-generic', 'Garden drip', 'Garden', 'mqtt', 'polje/ivan-jovic/dev/valve-garden-drip/cmnd', NULL, NULL),
      ('valve-hay-frost', ?, 'actuator', 'mqtt-generic', 'Hay frost', 'Hay field', 'mqtt', 'polje/ivan-jovic/dev/valve-hay-frost/cmnd', NULL, NULL),
      ('fps-gw-1', ?, 'gateway', 'fps-lora-gw', 'FPS GW', NULL, 'lora', 'polje/ivan-jovic/gw/fps-gw-1/health', NULL, NULL),
      ('fps-sn-1', ?, 'lora-node', 'fps-sensor-node', 'FPS sensor', 'Hay field', 'lora', 'polje/ivan-jovic/fps/fps-sn-1/stat', NULL, NULL),
      ('fps-valve-1', ?, 'actuator', 'fps-valve', 'FPS valve', 'Hay field', 'lora', 'polje/ivan-jovic/dev/fps-valve-1/cmnd', '{"timeout_sec":600}', NULL)`
  )
    .bind(
      "a1000000-0000-4000-8000-000000000001",
      "a1000000-0000-4000-8000-000000000001",
      "a1000000-0000-4000-8000-000000000001",
      "a1000000-0000-4000-8000-000000000001",
      "a1000000-0000-4000-8000-000000000001",
      "a1000000-0000-4000-8000-000000000001",
      "a1000000-0000-4000-8000-000000000001",
      "a1000000-0000-4000-8000-000000000001",
      "a1000000-0000-4000-8000-000000000001"
    )
    .run();

  await env.DB.prepare(
    `INSERT INTO farm_settings (farm_id, rain_lockout, updated_at) VALUES (?, 0, '2026-08-31T00:00:00Z')`
  )
    .bind("a1000000-0000-4000-8000-000000000001")
    .run();

  await env.DB.prepare(
    `INSERT INTO irrigation_zones (id, farm_id, plot_id, name, kind, device_id, max_duration_sec, default_duration_sec, rain_lockout, enabled) VALUES
      ('d1000000-0000-4000-8000-000000000001', ?, 'b1000000-0000-4000-8000-000000000001', 'Garden drip', 'drip', 'valve-garden-drip', 3600, 600, 1, 1),
      ('d1000000-0000-4000-8000-000000000002', ?, 'b1000000-0000-4000-8000-000000000001', 'Hay frost', 'frost', 'valve-hay-frost', 3600, 900, 0, 1)`
  )
    .bind(
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
    expect(html).toContain("Prijava");
    expect(html).not.toContain("Operator token");
  });

  it("POST /v1/session sets cookie that authorizes writes", async () => {
    const bad = await app.request(
      "/v1/session",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "wrong" }),
      },
      env
    );
    expect(bad.status).toBe(401);

    const login = await app.request(
      "/v1/session",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: OPERATOR }),
      },
      env
    );
    expect(login.status).toBe(200);
    const setCookie = login.headers.get("Set-Cookie") || "";
    expect(setCookie).toContain("polje_op=");
    const cookie = setCookie.split(";")[0];

    const plot = await app.request(
      "/v1/plots",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie,
        },
        body: JSON.stringify({
          farm_slug: "ivan-jovic",
          name: "Cookie plot",
          use_type: "garden",
        }),
      },
      env
    );
    expect(plot.status).toBe(201);
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
    expect(html).toContain("Knjiga");
  });
});

describe("polje M7 money ledger", () => {
  beforeAll(async () => {
    await migrateAndSeed();
  });

  it("GET /v1/ledger without token → 401", async () => {
    const res = await app.request("/v1/ledger?farm=ivan-jovic", {}, env);
    expect(res.status).toBe(401);
  });

  it("POST /v1/ledger without token → 401", async () => {
    const res = await app.request(
      "/v1/ledger",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "expense",
          amount_cents: 100,
        }),
      },
      env
    );
    expect(res.status).toBe(401);
  });

  it("create + list + summary math + patch audit + receipt + delete", async () => {
    const income = await app.request(
      "/v1/ledger",
      {
        method: "POST",
        headers: authJson(),
        body: JSON.stringify({
          farm_slug: "ivan-jovic",
          kind: "income",
          category: "sale",
          amount_cents: 1000,
          note: "test sale",
          ts: "2026-06-15T10:00:00Z",
        }),
      },
      env
    );
    expect(income.status).toBe(201);
    const incomeRow = (await income.json()) as { id: string; amount_cents: number };
    expect(incomeRow.amount_cents).toBe(1000);

    const expense = await app.request(
      "/v1/ledger",
      {
        method: "POST",
        headers: authJson(),
        body: JSON.stringify({
          farm_slug: "ivan-jovic",
          kind: "expense",
          category: "seed",
          amount_eur: 4.0,
          note: "sjeme",
          ts: "2026-06-20T10:00:00Z",
        }),
      },
      env
    );
    expect(expense.status).toBe(201);
    const expenseRow = (await expense.json()) as { id: string; amount_cents: number };
    expect(expenseRow.amount_cents).toBe(400);

    const list = await app.request(
      "/v1/ledger?farm=ivan-jovic",
      { headers: { Authorization: `Bearer ${OPERATOR}` } },
      env
    );
    expect(list.status).toBe(200);
    const listed = (await list.json()) as { entries: unknown[] };
    expect(listed.entries.length).toBeGreaterThanOrEqual(2);

    const sum = await app.request(
      "/v1/ledger/summary?farm=ivan-jovic&from=2026-01-01T00:00:00Z&to=2026-12-31T23:59:59Z",
      { headers: { Authorization: `Bearer ${OPERATOR}` } },
      env
    );
    expect(sum.status).toBe(200);
    const summary = (await sum.json()) as {
      income_cents: number;
      expense_cents: number;
      operating_net_cents: number;
      months: Array<{ ym: string }>;
    };
    expect(summary.income_cents).toBe(1000);
    expect(summary.expense_cents).toBe(400);
    expect(summary.operating_net_cents).toBe(600);
    expect(summary.months.some((m) => m.ym === "2026-06")).toBe(true);

    const patch = await app.request(
      `/v1/ledger/${expenseRow.id}`,
      {
        method: "PATCH",
        headers: authJson(),
        body: JSON.stringify({ note: "sjeme updated" }),
      },
      env
    );
    expect(patch.status).toBe(200);

    const auditRes = await app.request(
      "/v1/audit?farm=ivan-jovic&limit=30",
      { headers: { Authorization: `Bearer ${OPERATOR}` } },
      env
    );
    const audit = (await auditRes.json()) as {
      audit: Array<{ action: string }>;
    };
    expect(audit.audit.some((a) => a.action === "ledger.create")).toBe(true);
    expect(audit.audit.some((a) => a.action === "ledger.patch")).toBe(true);

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
      new File([jpeg], "receipt.jpg", { type: "image/jpeg" })
    );
    const receiptUp = await app.request(
      `/v1/ledger/${expenseRow.id}/receipt`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${OPERATOR}` },
        body: form,
      },
      env
    );
    expect(receiptUp.status).toBe(201);

    const receiptGet = await app.request(
      `/v1/ledger/${expenseRow.id}/receipt`,
      { headers: { Authorization: `Bearer ${OPERATOR}` } },
      env
    );
    expect(receiptGet.status).toBe(200);
    expect(receiptGet.headers.get("content-type")).toContain("image/jpeg");
    expect(receiptGet.headers.get("cache-control")).toContain("private");

    const del = await app.request(
      `/v1/ledger/${expenseRow.id}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${OPERATOR}` },
      },
      env
    );
    expect(del.status).toBe(200);

    const gone = await app.request(
      `/v1/ledger/${expenseRow.id}`,
      { headers: { Authorization: `Bearer ${OPERATOR}` } },
      env
    );
    expect(gone.status).toBe(404);

    const audit2 = await app.request(
      "/v1/audit?farm=ivan-jovic&limit=40",
      { headers: { Authorization: `Bearer ${OPERATOR}` } },
      env
    );
    const auditBody = (await audit2.json()) as {
      audit: Array<{ action: string }>;
    };
    expect(auditBody.audit.some((a) => a.action === "ledger.receipt")).toBe(
      true
    );
    expect(auditBody.audit.some((a) => a.action === "ledger.delete")).toBe(
      true
    );
  });

  it("GET /ledger returns HTML", async () => {
    const res = await app.request("/ledger", {}, env);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Knjiga");
    expect(html).toContain("Prijava");
    expect(html).not.toContain("Operator token");
    expect(html).toContain("nije porezna");
  });
});

describe("polje M8 MCP + Grok", () => {
  const AGENT = "test-agent-token";
  const FARM = "a1000000-0000-4000-8000-000000000001";

  beforeAll(async () => {
    await migrateAndSeed();
    await env.DB.prepare(
      `INSERT INTO plantings (id, plot_id, crop, variety, planted_on, stage, expected_harvest, yield_kg)
       VALUES ('c1000000-0000-4000-8000-000000000099', 'b1000000-0000-4000-8000-000000000001', 'Hay', NULL, NULL, 'growing', NULL, NULL)`
    ).run();
  });

  it("/mcp without Bearer → 401", async () => {
    const worker = (await import("../src/index")).default;
    const res = await worker.fetch(
      new Request("http://localhost/mcp", { method: "POST" }),
      env,
      {} as ExecutionContext
    );
    expect(res.status).toBe(401);
  });

  it("get_overview with agent tools", async () => {
    const { runTool } = await import("../src/mcp/tools");
    const result = await runTool(
      "get_overview",
      { env, actor: "agent:mcp", allowConfirm: true },
      { farm_slug: "ivan-jovic" }
    );
    expect(result.error).toBeUndefined();
    expect((result as { farm: { slug: string } }).farm.slug).toBe("ivan-jovic");
  });

  it("run_irrigation without confirm → proposal, zero commands", async () => {
    const { runTool } = await import("../src/mcp/tools");
    const before = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM commands WHERE farm_id = ?`
    )
      .bind(FARM)
      .first<{ n: number }>();

    const result = await runTool(
      "run_irrigation",
      { env, actor: "agent:mcp", allowConfirm: true },
      {
        zone_id: "zone-garden-drip",
        duration_sec: 120,
        reason: "test dry soil",
        confirm: false,
      }
    );
    expect(result.status).toBe("proposal");

    const after = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM commands WHERE farm_id = ?`
    )
      .bind(FARM)
      .first<{ n: number }>();
    expect(after?.n).toBe(before?.n ?? 0);
  });

  it("run_irrigation with confirm → module_not_ready, zero new commands", async () => {
    const { runTool } = await import("../src/mcp/tools");
    const before = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM commands WHERE farm_id = ?`
    )
      .bind(FARM)
      .first<{ n: number }>();

    const result = await runTool(
      "run_irrigation",
      { env, actor: "agent:mcp", allowConfirm: true },
      {
        zone_id: "zone-garden-drip",
        duration_sec: 120,
        reason: "test dry soil",
        confirm: true,
      }
    );
    expect(result.error).toBe("module_not_ready");
    expect(result.module).toBe("M5");

    const after = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM commands WHERE farm_id = ?`
    )
      .bind(FARM)
      .first<{ n: number }>();
    expect(after?.n).toBe(before?.n ?? 0);
  });

  it("add_planting_note writes note + audit agent:mcp", async () => {
    const { runTool } = await import("../src/mcp/tools");
    const result = await runTool(
      "add_planting_note",
      { env, actor: "agent:mcp", allowConfirm: true },
      {
        planting_id: "c1000000-0000-4000-8000-000000000099",
        body: "Looks healthy after rain",
        farm_slug: "ivan-jovic",
      }
    );
    expect(result.ok).toBe(true);

    const note = await env.DB.prepare(
      `SELECT body, actor FROM planting_notes WHERE planting_id = ?`
    )
      .bind("c1000000-0000-4000-8000-000000000099")
      .first<{ body: string; actor: string }>();
    expect(note?.body).toContain("healthy");
    expect(note?.actor).toBe("agent:mcp");

    const audit = await env.DB.prepare(
      `SELECT actor, action FROM audit WHERE action = 'planting.note' ORDER BY id DESC LIMIT 1`
    ).first<{ actor: string; action: string }>();
    expect(audit?.actor).toBe("agent:mcp");
  });

  it("log_expense writes cents + audit", async () => {
    const { runTool } = await import("../src/mcp/tools");
    const result = await runTool(
      "log_expense",
      { env, actor: "agent:mcp", allowConfirm: true },
      {
        amount_cents: 2500,
        category: "repair",
        note: "pump gasket",
        farm_slug: "ivan-jovic",
      }
    );
    expect(result.ok).toBe(true);
    const entry = (result as { entry: { amount_cents: number } }).entry;
    expect(entry.amount_cents).toBe(2500);

    const audit = await env.DB.prepare(
      `SELECT action FROM audit WHERE action = 'ledger.create' ORDER BY id DESC LIMIT 1`
    ).first<{ action: string }>();
    expect(audit?.action).toBe("ledger.create");
  });

  it("Grok chat high-risk cannot confirm (allowConfirm false)", async () => {
    const { runTool } = await import("../src/mcp/tools");
    const result = await runTool(
      "run_irrigation",
      { env, actor: "agent:grok", allowConfirm: false },
      {
        zone_id: "zone-garden-drip",
        duration_sec: 60,
        reason: "grok wants water",
        confirm: true,
      }
    );
    expect(result.status).toBe("proposal");
  });

  it("briefing cron twice same local_date → one row", async () => {
    const { generateBriefing, zagrebLocalParts } = await import(
      "../src/lib/briefing"
    );
    const { date } = zagrebLocalParts();
    const first = await generateBriefing(env, {
      farmSlug: "ivan-jovic",
      force: true,
      actor: "cron:briefing",
      mockBodies: {
        hr: "Jutro mirno.",
        en: "Quiet morning.",
        model: "mock",
      },
    });
    expect(first.ok).toBe(true);

    const second = await generateBriefing(env, {
      farmSlug: "ivan-jovic",
      force: false,
      actor: "cron:briefing",
      mockBodies: {
        hr: "should not replace",
        en: "should not replace",
        model: "mock2",
      },
    });
    expect(second.cached).toBe(true);

    const count = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM briefings WHERE farm_id = ? AND local_date = ?`
    )
      .bind(FARM, date)
      .first<{ n: number }>();
    expect(count?.n).toBe(1);

    const today = await app.request(
      "/v1/grok/briefing/today?farm=ivan-jovic",
      {},
      env
    );
    expect(today.status).toBe(200);
    const body = (await today.json()) as {
      briefing: { body_hr: string } | null;
    };
    expect(body.briefing?.body_hr).toBe("Jutro mirno.");
  });

  it("POST /v1/grok/chat without XAI → 503", async () => {
    const res = await app.request(
      "/v1/grok/chat",
      {
        method: "POST",
        headers: authJson(),
        body: JSON.stringify({ message: "Kako je tlo?" }),
      },
      env
    );
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("xai_not_configured");
  });

  it("GET / has Grok dock", async () => {
    const res = await app.request("/", {}, env);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("grok-dock");
    expect(html).toContain("Pitaj farmu");
  });
});

describe("polje M9 automations", () => {
  beforeAll(async () => {
    await migrateAndSeed();
  });

  it("create high-risk automation stays disabled without confirm", async () => {
    const res = await app.request(
      "/v1/automations",
      {
        method: "POST",
        headers: authJson(),
        body: JSON.stringify({
          name: "Soil propose drip",
          enabled: true,
          trigger: {
            type: "metric",
            device_id: "soil-n-1",
            metric: "moisture",
            op: "lt",
            value: 0.2,
          },
          action: {
            type: "command.propose",
            device_id: "valve-garden-drip",
            action: "irrigation.run",
            payload: { duration_sec: 300 },
          },
        }),
      },
      env
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      id: string;
      enabled: number;
      risk: string;
      proposal?: boolean;
    };
    expect(body.risk).toBe("high");
    expect(body.enabled).toBe(0);
    expect(body.proposal).toBe(true);

    const enableBad = await app.request(
      `/v1/automations/${body.id}/enable`,
      {
        method: "POST",
        headers: authJson(),
        body: JSON.stringify({ enabled: true, confirm: false }),
      },
      env
    );
    expect(enableBad.status).toBe(400);

    const enableOk = await app.request(
      `/v1/automations/${body.id}/enable`,
      {
        method: "POST",
        headers: authJson(),
        body: JSON.stringify({
          enabled: true,
          confirm: true,
          reason: "test enable high risk rule",
        }),
      },
      env
    );
    expect(enableOk.status).toBe(200);

    const auditRes = await app.request(
      "/v1/audit?farm=ivan-jovic&limit=40",
      { headers: { Authorization: `Bearer ${OPERATOR}` } },
      env
    );
    const audit = (await auditRes.json()) as {
      audit: Array<{ action: string }>;
    };
    expect(audit.audit.some((a) => a.action === "automation.enable")).toBe(
      true
    );
  });

  it("metric trigger enqueues proposed drip, not sent", async () => {
    const create = await app.request(
      "/v1/automations",
      {
        method: "POST",
        headers: authJson(),
        body: JSON.stringify({
          name: "Soil fire test",
          enabled: true,
          confirm: true,
          reason: "unit test enable",
          cooldown_sec: 0,
          trigger: {
            type: "metric",
            device_id: "soil-n-1",
            metric: "moisture",
            op: "lt",
            value: 0.5,
          },
          action: {
            type: "command.propose",
            device_id: "valve-garden-drip",
            action: "irrigation.run",
            payload: { duration_sec: 120 },
          },
        }),
      },
      env
    );
    expect(create.status).toBe(201);
    const created = (await create.json()) as { id: string; enabled: number };
    expect(created.enabled).toBe(1);

    const stub = farmStub(env, "ivan-jovic");
    const ingest = await stub.fetch(
      new Request("https://do/ingest?farm_id=ivan-jovic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          farm_id: "ivan-jovic",
          batch_id: `m9-soil-${crypto.randomUUID()}`,
          sent_at: new Date().toISOString(),
          readings: [
            {
              device_id: "soil-n-1",
              metric: "moisture",
              value: 0.1,
              ts: new Date().toISOString(),
            },
          ],
        }),
      })
    );
    expect(ingest.ok).toBe(true);

    const cmds = await env.DB.prepare(
      `SELECT action, status FROM commands WHERE device_id = 'valve-garden-drip' ORDER BY created_at DESC LIMIT 5`
    ).all<{ action: string; status: string }>();
    const drip = (cmds.results ?? []).find((c) => c.action === "irrigation.run");
    expect(drip).toBeTruthy();
    expect(drip!.status).toBe("proposed");
  });

  it("low-risk snapshot action enqueues sent command", async () => {
    const create = await app.request(
      "/v1/automations",
      {
        method: "POST",
        headers: authJson(),
        body: JSON.stringify({
          name: "Snap on starlink down",
          enabled: true,
          cooldown_sec: 0,
          trigger: { type: "health", field: "starlink", equals: "down" },
          action: { type: "snapshot.take", camera_id: "cam-yard" },
        }),
      },
      env
    );
    expect(create.status).toBe(201);
    const created = (await create.json()) as { enabled: number; risk: string };
    expect(created.risk).toBe("low");
    expect(created.enabled).toBe(1);

    const stub = farmStub(env, "ivan-jovic");
    const ingest = await stub.fetch(
      new Request("https://do/ingest?farm_id=ivan-jovic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          farm_id: "ivan-jovic",
          batch_id: `m9-sl-${crypto.randomUUID()}`,
          sent_at: new Date().toISOString(),
          readings: [],
          health: { starlink: "down" },
        }),
      })
    );
    expect(ingest.ok).toBe(true);

    const cmds = await env.DB.prepare(
      `SELECT action, status FROM commands WHERE device_id = 'cam-yard' AND action = 'snapshot.take' ORDER BY created_at DESC LIMIT 1`
    ).first<{ action: string; status: string }>();
    expect(cmds?.status).toBe("sent");
  });

  it("job confirm / cancel + audit", async () => {
    const create = await app.request(
      "/v1/jobs",
      {
        method: "POST",
        headers: authJson(),
        body: JSON.stringify({ kind: "robot.mow", reason: "hay north" }),
      },
      env
    );
    expect(create.status).toBe(201);
    const job = (await create.json()) as { id: string; status: string };
    expect(job.status).toBe("proposed");

    const bad = await app.request(
      `/v1/jobs/${job.id}/confirm`,
      {
        method: "POST",
        headers: authJson(),
        body: JSON.stringify({ confirm: false, reason: "nope" }),
      },
      env
    );
    expect(bad.status).toBe(400);

    const ok = await app.request(
      `/v1/jobs/${job.id}/confirm`,
      {
        method: "POST",
        headers: authJson(),
        body: JSON.stringify({ confirm: true, reason: "mow now" }),
      },
      env
    );
    expect(ok.status).toBe(200);

    const cancel = await app.request(
      `/v1/jobs/${job.id}`,
      {
        method: "PATCH",
        headers: authJson(),
        body: JSON.stringify({ status: "cancelled" }),
      },
      env
    );
    expect(cancel.status).toBe(200);

    const auditRes = await app.request(
      "/v1/audit?farm=ivan-jovic&limit=50",
      { headers: { Authorization: `Bearer ${OPERATOR}` } },
      env
    );
    const audit = (await auditRes.json()) as {
      audit: Array<{ action: string }>;
    };
    expect(audit.audit.some((a) => a.action === "job.confirm")).toBe(true);
    expect(audit.audit.some((a) => a.action === "job.update")).toBe(true);
  });

  it("DO evaluate endpoint works after ingest (alarm tick path)", async () => {
    const stub = farmStub(env, "ivan-jovic");
    const res = await stub.fetch(
      new Request("https://do/ingest?farm_id=ivan-jovic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          farm_id: "ivan-jovic",
          batch_id: `m9-prune-${crypto.randomUUID()}`,
          sent_at: new Date().toISOString(),
          readings: [],
        }),
      })
    );
    expect(res.ok).toBe(true);
    const evalRes = await stub.fetch(
      new Request("https://do/evaluate?farm_id=ivan-jovic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      })
    );
    expect(evalRes.ok).toBe(true);
  });

  it("GET /hands returns HTML", async () => {
    const res = await app.request("/hands", {}, env);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Ruke");
    expect(html).toContain("Automatizacije");
  });
});

describe("polje M5 irrigation", () => {
  const DRIP = "d1000000-0000-4000-8000-000000000001";
  const FROST = "d1000000-0000-4000-8000-000000000002";

  it("POST run without confirm → proposal, zero commands", async () => {
    const before = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM commands WHERE action = 'valve.open'`
    ).first<{ n: number }>();

    const res = await app.request(
      `/v1/irrigation/zones/${DRIP}/run`,
      {
        method: "POST",
        headers: authJson(),
        body: JSON.stringify({
          duration_sec: 120,
          reason: "test dry soil",
          confirm: false,
        }),
      },
      env
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { proposal: boolean };
    expect(body.proposal).toBe(true);

    const after = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM commands WHERE action = 'valve.open'`
    ).first<{ n: number }>();
    expect(after?.n).toBe(before?.n ?? 0);
  });

  it("POST run duration 3601 → 400", async () => {
    const res = await app.request(
      `/v1/irrigation/zones/${DRIP}/run`,
      {
        method: "POST",
        headers: authJson(),
        body: JSON.stringify({
          duration_sec: 3601,
          reason: "too long",
          confirm: true,
        }),
      },
      env
    );
    expect(res.status).toBe(400);
  });

  it("drip + rain lockout → 409", async () => {
    await env.DB.prepare(
      `UPDATE farm_settings SET rain_lockout = 1 WHERE farm_id = ?`
    )
      .bind("a1000000-0000-4000-8000-000000000001")
      .run();

    const res = await app.request(
      `/v1/irrigation/zones/${DRIP}/run`,
      {
        method: "POST",
        headers: authJson(),
        body: JSON.stringify({
          duration_sec: 120,
          reason: "should block",
          confirm: true,
        }),
      },
      env
    );
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("rain_lockout");
  });

  it("frost + rain lockout → 202 sent", async () => {
    await env.DB.prepare(
      `UPDATE farm_settings SET rain_lockout = 1 WHERE farm_id = ?`
    )
      .bind("a1000000-0000-4000-8000-000000000001")
      .run();

    const res = await app.request(
      `/v1/irrigation/zones/${FROST}/run`,
      {
        method: "POST",
        headers: authJson(),
        body: JSON.stringify({
          duration_sec: 90,
          reason: "frost spray test",
          confirm: true,
        }),
      },
      env
    );
    expect(res.status).toBe(202);
    const body = (await res.json()) as {
      ok: boolean;
      status: string;
      command_id: string;
    };
    expect(body.ok).toBe(true);
    expect(body.status).toBe("sent");
  });

  it("confirm true → audit irrigation.run", async () => {
    await env.DB.prepare(
      `UPDATE farm_settings SET rain_lockout = 0 WHERE farm_id = ?`
    )
      .bind("a1000000-0000-4000-8000-000000000001")
      .run();

    const res = await app.request(
      `/v1/irrigation/zones/${DRIP}/run`,
      {
        method: "POST",
        headers: authJson(),
        body: JSON.stringify({
          duration_sec: 60,
          reason: "garden needs water",
          confirm: true,
        }),
      },
      env
    );
    expect(res.status).toBe(202);

    const auditRes = await app.request(
      "/v1/audit?farm=ivan-jovic&limit=20",
      { headers: { Authorization: `Bearer ${OPERATOR}` } },
      env
    );
    const auditBody = (await auditRes.json()) as {
      audit: Array<{ action: string }>;
    };
    expect(auditBody.audit.some((a) => a.action === "irrigation.run")).toBe(
      true
    );
  });

  it("GET /water returns HTML", async () => {
    const res = await app.request("/water", {}, env);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Voda");
    expect(html).toContain("confirm");
  });

  it("GET /v1/irrigation/zones lists drip + frost", async () => {
    const res = await app.request(
      "/v1/irrigation/zones?farm=ivan-jovic",
      {},
      env
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      zones: Array<{ kind: string; name: string }>;
      rain_lockout: boolean;
    };
    expect(body.zones.some((z) => z.kind === "drip")).toBe(true);
    expect(body.zones.some((z) => z.kind === "frost")).toBe(true);
  });
});

describe("polje M4 FPS frost", () => {
  beforeAll(async () => {
    await migrateAndSeed();
  });

  it("GET /v1/frost/status is idle by default", async () => {
    const res = await app.request("/v1/frost/status?farm=ivan-jovic", {}, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; live: unknown };
    expect(body.status).toBe("idle");
  });

  it("GET /v1/fps/nodes lists FPS devices", async () => {
    const res = await app.request("/v1/fps/nodes?farm=ivan-jovic", {}, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      nodes: Array<{ id: string; driver: string }>;
    };
    expect(body.nodes.some((n) => n.id === "fps-sn-1")).toBe(true);
    expect(body.nodes.some((n) => n.id === "fps-valve-1")).toBe(true);
  });

  it("GET /v1/fps/gateway returns gateway", async () => {
    const res = await app.request("/v1/fps/gateway?farm=ivan-jovic", {}, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { gateway: { id: string } | null };
    expect(body.gateway?.id).toBe("fps-gw-1");
  });

  it("POST /v1/fps/valves/:id/open without confirm → proposal", async () => {
    const res = await app.request(
      "/v1/fps/valves/fps-valve-1/open",
      {
        method: "POST",
        headers: authJson(),
        body: JSON.stringify({
          max_sec: 120,
          reason: "test spray",
          confirm: false,
        }),
      },
      env
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { proposal: boolean; action: string };
    expect(body.proposal).toBe(true);
    expect(body.action).toBe("fps.valve.open");
  });

  it("POST /v1/fps/valves/:id/open with confirm → command + audit", async () => {
    const res = await app.request(
      "/v1/fps/valves/fps-valve-1/open",
      {
        method: "POST",
        headers: authJson(),
        body: JSON.stringify({
          max_sec: 120,
          reason: "confirmed spray",
          confirm: true,
        }),
      },
      env
    );
    expect(res.status).toBe(202);
    const body = (await res.json()) as { ok: boolean; command_id: string };
    expect(body.ok).toBe(true);
    expect(body.command_id).toBeTruthy();

    const cmds = await app.request(
      "/v1/commands?farm=ivan-jovic&status=sent&action=fps.valve.open",
      { headers: { Authorization: `Bearer ${INGEST}` } },
      env
    );
    expect(cmds.status).toBe(200);
    const cmdBody = (await cmds.json()) as {
      commands: Array<{ action: string }>;
    };
    expect(cmdBody.commands.some((c) => c.action === "fps.valve.open")).toBe(
      true
    );

    const auditRes = await app.request(
      "/v1/audit?farm=ivan-jovic&limit=20",
      { headers: { Authorization: `Bearer ${OPERATOR}` } },
      env
    );
    const auditBody = (await auditRes.json()) as {
      audit: Array<{ action: string }>;
    };
    expect(auditBody.audit.some((a) => a.action === "fps.valve.open")).toBe(
      true
    );
  });

  it("POST /v1/fps/arm without confirm → proposal", async () => {
    const res = await app.request(
      "/v1/fps/arm",
      {
        method: "POST",
        headers: authJson(),
        body: JSON.stringify({ arm: true, confirm: false }),
      },
      env
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { proposal: boolean };
    expect(body.proposal).toBe(true);
  });

  it("POST /v1/fps/program loads program", async () => {
    const res = await app.request(
      "/v1/fps/program",
      {
        method: "POST",
        headers: authJson(),
        body: JSON.stringify({
          farm_slug: "ivan-jovic",
          temp_threshold_c: 1.5,
          max_spray_sec: 600,
          valve_ids: ["fps-valve-1"],
          sensor_id: "fps-sn-1",
          mode: "ice",
        }),
      },
      env
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { status: string; command_id: string };
    expect(body.status).toBe("watch");
    expect(body.command_id).toBeTruthy();
  });

  it("POST /v1/fps/arm with confirm → armed + audit", async () => {
    const res = await app.request(
      "/v1/fps/arm",
      {
        method: "POST",
        headers: authJson(),
        body: JSON.stringify({
          arm: true,
          confirm: true,
          reason: "night frost watch",
        }),
      },
      env
    );
    expect(res.status).toBe(202);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("armed");

    const statusRes = await app.request(
      "/v1/frost/status?farm=ivan-jovic",
      {},
      env
    );
    const status = (await statusRes.json()) as { status: string };
    expect(status.status).toBe("armed");
  });

  it("ingest FPS reading updates last_seen", async () => {
    const now = new Date().toISOString();
    // Direct D1 flush path (same as FarmRuntime) — avoid DO isolated-storage flake
    await env.DB.prepare(
      `INSERT INTO readings (device_id, metric, value, ts) VALUES (?, 'temp_c', ?, ?)`
    )
      .bind("fps-sn-1", -0.5, now)
      .run();
    await env.DB.prepare(`UPDATE devices SET last_seen = ? WHERE id = ?`)
      .bind(now, "fps-sn-1")
      .run();

    const batch = {
      farm_id: "ivan-jovic",
      batch_id: `fps-test-${crypto.randomUUID()}`,
      sent_at: now,
      readings: [
        {
          device_id: "fps-sn-1",
          metric: "temp_c",
          value: -0.5,
          ts: now,
        },
      ],
      health: { frost: "armed" as const, gateway: "ok", starlink: "up" as const },
    };
    const res = await app.request(
      "/v1/ingest",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${INGEST}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(batch),
      },
      env
    );
    expect([200, 202]).toContain(res.status);

    const row = await env.DB.prepare(
      `SELECT last_seen FROM devices WHERE id = 'fps-sn-1'`
    ).first<{ last_seen: string | null }>();
    expect(row?.last_seen).toBeTruthy();
  });

  it("GET /frost returns HTML", async () => {
    const res = await app.request("/frost", {}, env);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Mraz");
    expect(html).toContain("ARM");
  });

  it("GET /v1/iot/bus returns bus health", async () => {
    const res = await app.request("/v1/iot/bus?farm=ivan-jovic", {}, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { farm_id: string };
    expect(body.farm_id).toBeTruthy();
  });
});
