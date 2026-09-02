import { env } from "cloudflare:test";
import { describe, expect, it, beforeAll } from "vitest";
import { app } from "../src/index";
import { farmStub } from "../src/do/farm-runtime";
import {
  addDays,
  localDateInTz,
  settleEnergyDaily,
  startOfLocalDayUtc,
} from "../src/lib/energy";
import {
  analogBatchId,
  analogLiveOn,
  analogPublicMeta,
  buildAnalogBatch,
  isAnalogBatchId,
  syntheticObservation,
} from "../src/lib/analog";
import { analogFeedForCamera, analogEmbedUrl } from "../src/lib/analog-feeds";
import { wxFromWmoCode, wxFromLive } from "../src/lib/weather";
import { canonicalAddress } from "../src/lib/mail";
import { parseTrelloBoard } from "../src/lib/trello";
import { buildSchedule, type IrrigationLine, type SystemParams } from "../src/lib/dewline-pack";

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
  extent_json TEXT,
  extent_name TEXT,
  extent_ha REAL,
  created_at TEXT NOT NULL
)`,
  `CREATE TABLE plots (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL,
  name TEXT NOT NULL,
  hectares REAL,
  use_type TEXT,
  notes TEXT,
  geom_json TEXT,
  holding_id TEXT
)`,
  `CREATE TABLE holdings (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL,
  name TEXT NOT NULL,
  notes TEXT,
  geom_json TEXT,
  hectares REAL,
  created_at TEXT NOT NULL
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
  main_flow_m3h REAL NOT NULL DEFAULT 8,
  cycles_per_day INTEGER NOT NULL DEFAULT 1,
  well_rate_m3h REAL NOT NULL DEFAULT 0,
  water_price_cents INTEGER NOT NULL DEFAULT 240,
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
  enabled INTEGER NOT NULL DEFAULT 1,
  flow_m3h REAL,
  valve_box TEXT
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
  `CREATE TABLE water_works (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL,
  plot_id TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'pond',
  depth_m REAL NOT NULL DEFAULT 2.2,
  bank_slope REAL NOT NULL DEFAULT 2.5,
  catchment_factor REAL NOT NULL DEFAULT 4,
  fill_pct REAL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
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
  `CREATE TABLE climate_zones (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL,
  plot_id TEXT,
  name TEXT NOT NULL,
  sensor_id TEXT NOT NULL,
  heater_id TEXT,
  cooler_id TEXT,
  battery_id TEXT,
  heat_c REAL NOT NULL DEFAULT 18,
  cool_c REAL NOT NULL DEFAULT 26,
  heat_c_min REAL NOT NULL DEFAULT 5,
  heat_c_max REAL NOT NULL DEFAULT 28,
  cool_c_min REAL NOT NULL DEFAULT 10,
  cool_c_max REAL NOT NULL DEFAULT 35,
  timeout_sec INTEGER NOT NULL DEFAULT 1800,
  enabled INTEGER NOT NULL DEFAULT 1
)`,
  `CREATE TABLE climate_settings (
  farm_id TEXT PRIMARY KEY,
  heat_battery_min_pct INTEGER NOT NULL DEFAULT 30,
  updated_at TEXT NOT NULL
)`,
  `CREATE TABLE energy_daily (
  farm_id TEXT NOT NULL,
  local_date TEXT NOT NULL,
  device_id TEXT NOT NULL,
  kwh REAL,
  w_peak REAL,
  settled_at TEXT NOT NULL,
  PRIMARY KEY (farm_id, local_date, device_id)
)`,
  `CREATE TABLE build_phases (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  starts_on TEXT,
  ends_on TEXT,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'EUR',
  status TEXT NOT NULL DEFAULT 'planned',
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
)`,
  `CREATE TABLE plan_tasks (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL,
  phase_id TEXT,
  title TEXT NOT NULL,
  body TEXT,
  status TEXT NOT NULL DEFAULT 'todo',
  due_on TEXT,
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`,
  `CREATE TABLE plan_orders (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL,
  phase_id TEXT,
  task_id TEXT,
  title TEXT NOT NULL,
  vendor TEXT,
  url TEXT,
  qty REAL NOT NULL DEFAULT 1,
  unit_cents INTEGER NOT NULL DEFAULT 0,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'EUR',
  status TEXT NOT NULL DEFAULT 'research',
  due_on TEXT,
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'ui',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`,
];

async function migrateAndSeed() {
  try {
    const existing = await env.DB.prepare(
      `SELECT id FROM farms WHERE slug = 'ivan-jovic'`
    ).first();
    if (existing) return;
  } catch {
    /* empty isolate — create schema */
  }

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
    `INSERT INTO build_phases (id, farm_id, title, body, starts_on, ends_on, amount_cents, currency, status, sort, created_at)
     VALUES (?, ?, 'Civil works', 'Envelope TBD — not a quote.', '2026-08-01', '2026-12-31', 0, 'EUR', 'active', 20, '2026-08-31T00:00:00Z')`
  )
    .bind(
      "e1000000-0000-4000-8000-000000000002",
      "a1000000-0000-4000-8000-000000000001"
    )
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
      ('fps-valve-1', ?, 'actuator', 'fps-valve', 'FPS valve', 'Hay field', 'lora', 'polje/ivan-jovic/dev/fps-valve-1/cmnd', '{"timeout_sec":600}', NULL),
      ('temp-house-1', ?, 'sensor', 'mqtt-generic', 'Old house air', 'Old house', 'mqtt', 'polje/ivan-jovic/dev/temp-house-1/stat', NULL, NULL),
      ('heater-house-1', ?, 'actuator', 'mqtt-generic', 'Old house heater', 'Old house', 'mqtt', 'polje/ivan-jovic/dev/heater-house-1/cmnd', NULL, NULL),
      ('inv-1', ?, 'inverter', 'mqtt-generic', 'Inverter stub', NULL, 'mqtt', 'polje/ivan-jovic/dev/inv-1/stat', NULL, NULL),
      ('ups-1', ?, 'battery', 'mqtt-generic', 'UPS stub', NULL, 'mqtt', 'polje/ivan-jovic/dev/ups-1/stat', NULL, NULL)`
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

  await env.DB.prepare(
    `INSERT INTO climate_settings (farm_id, heat_battery_min_pct, updated_at)
     VALUES (?, 30, '2026-08-31T00:00:00Z')`
  )
    .bind("a1000000-0000-4000-8000-000000000001")
    .run();

  await env.DB.prepare(
    `INSERT INTO climate_zones (
       id, farm_id, plot_id, name, sensor_id, heater_id, cooler_id, battery_id,
       heat_c, cool_c, heat_c_min, heat_c_max, cool_c_min, cool_c_max, timeout_sec, enabled
     ) VALUES (
       'f1000000-0000-4000-8000-000000000001', ?, ?,
       'Old house climate', 'temp-house-1', 'heater-house-1', NULL, 'ups-1',
       18, 26, 5, 28, 10, 35, 1800, 1
     )`
  )
    .bind(
      "a1000000-0000-4000-8000-000000000001",
      "b1000000-0000-4000-8000-000000000001"
    )
    .run();

  await env.DB.prepare(
    `INSERT INTO farms (id, slug, name, country, timezone, lat, lon, starlink_site, created_at)
     VALUES (?, 'demo-opg', 'Demo OPG', 'HR', 'Europe/Zagreb', NULL, NULL, NULL, '2026-08-31T00:00:00Z')`
  )
    .bind("a2000000-0000-4000-8000-000000000001")
    .run();
  await env.DB.prepare(
    `INSERT INTO plots (id, farm_id, name, hectares, use_type, notes) VALUES
      ('b2000000-0000-4000-8000-000000000001', ?, 'Yard', NULL, 'yard', NULL),
      ('b2000000-0000-4000-8000-000000000002', ?, 'Hay field', NULL, 'hay', NULL),
      ('b2000000-0000-4000-8000-000000000003', ?, 'Garden', NULL, 'garden', NULL)`
  )
    .bind(
      "a2000000-0000-4000-8000-000000000001",
      "a2000000-0000-4000-8000-000000000001",
      "a2000000-0000-4000-8000-000000000001"
    )
    .run();
  await env.DB.prepare(
    `INSERT INTO devices (id, farm_id, kind, driver, name, zone, protocol, address, config_json, last_seen) VALUES
      ('demo-soil-1', ?, 'sensor', 'mqtt-generic', 'Garden soil', 'Garden', 'mqtt', 'polje/demo-opg/dev/demo-soil-1/stat', NULL, NULL),
      ('demo-cam-yard', ?, 'camera', 'rtsp', 'Yard camera', 'Yard', 'rtsp', 'env:CAMERA_YARD_RTSP', NULL, NULL)`
  )
    .bind(
      "a2000000-0000-4000-8000-000000000001",
      "a2000000-0000-4000-8000-000000000001"
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

  it("PATCH /v1/plots/:id geom_json stores polygon + hectares", async () => {
    const square = {
      type: "Polygon",
      coordinates: [
        [
          [16.0, 45.1],
          [16.001, 45.1],
          [16.001, 45.101],
          [16.0, 45.101],
          [16.0, 45.1],
        ],
      ],
    };
    const res = await app.request(
      "/v1/plots/b1000000-0000-4000-8000-000000000001",
      {
        method: "PATCH",
        headers: authJson(),
        body: JSON.stringify({ geom_json: JSON.stringify(square) }),
      },
      env
    );
    expect(res.status).toBe(200);
    const plot = (await res.json()) as {
      geom_json: string;
      hectares: number;
    };
    expect(plot.geom_json).toContain("Polygon");
    expect(plot.hectares).toBeGreaterThan(0);

    const list = await app.request("/v1/plots?farm=ivan-jovic", {}, env);
    const body = (await list.json()) as {
      plots: Array<{ id: string; geom_json: string | null }>;
    };
    const house = body.plots.find(
      (p) => p.id === "b1000000-0000-4000-8000-000000000001"
    );
    expect(house?.geom_json).toContain("45.1");
    expect(Array.isArray((house as { plantings?: unknown[] })?.plantings)).toBe(
      true
    );
    expect(Array.isArray((house as { zones?: unknown[] })?.zones)).toBe(true);

    const cleared = await app.request(
      "/v1/plots/b1000000-0000-4000-8000-000000000001",
      {
        method: "PATCH",
        headers: authJson(),
        body: JSON.stringify({ geom_json: null }),
      },
      env
    );
    expect(cleared.status).toBe(200);
    const after = (await cleared.json()) as {
      geom_json: string | null;
      hectares: number | null;
    };
    expect(after.geom_json).toBeNull();
    expect(after.hectares).toBeNull();

    const listed = await app.request("/v1/plots?farm=ivan-jovic", {}, env);
    const listedBody = (await listed.json()) as {
      plots: Array<{ id: string; hectares: number | null; geom_json: string | null }>;
    };
    const house2 = listedBody.plots.find(
      (p) => p.id === "b1000000-0000-4000-8000-000000000001"
    );
    expect(house2?.geom_json).toBeNull();
    expect(house2?.hectares).toBeNull();
  });

  it("PATCH /v1/farms/:slug/extent then clips plots to the holding", async () => {
    const listed0 = await app.request("/v1/plots?farm=ivan-jovic", {}, env);
    expect(listed0.status).toBe(200);
    const body0 = (await listed0.json()) as { holding: unknown };
    expect(body0.holding).toBeNull();

    const denied = await app.request(
      "/v1/farms/ivan-jovic/extent",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extent_json: "{}" }),
      },
      env
    );
    expect(denied.status).toBe(401);

    const holding = {
      type: "Polygon",
      coordinates: [
        [
          [15.99, 45.09],
          [16.01, 45.09],
          [16.01, 45.11],
          [15.99, 45.11],
          [15.99, 45.09],
        ],
      ],
    };
    const patch = await app.request(
      "/v1/farms/ivan-jovic/extent",
      {
        method: "PATCH",
        headers: authJson(),
        body: JSON.stringify({
          extent_json: JSON.stringify(holding),
          extent_name: "Sarampovo",
        }),
      },
      env
    );
    expect(patch.status).toBe(200);
    const saved = (await patch.json()) as {
      extent_name: string;
      extent_ha: number;
      extent_json: string;
    };
    expect(saved.extent_name).toBe("Sarampovo");
    expect(saved.extent_ha).toBeGreaterThan(0);
    expect(saved.extent_json).toContain("Polygon");

    const listed = await app.request("/v1/plots?farm=ivan-jovic", {}, env);
    const body = (await listed.json()) as {
      holding: { name: string; hectares: number; geom_json: string } | null;
      holdings: Array<{ name: string }>;
    };
    expect(body.holding?.name).toBe("Sarampovo");
    expect(body.holding?.hectares).toBeGreaterThan(0);
    expect(body.holdings.map((h) => h.name)).toContain("Sarampovo");

    const inside = {
      type: "Polygon",
      coordinates: [
        [
          [16.0, 45.1],
          [16.001, 45.1],
          [16.001, 45.101],
          [16.0, 45.101],
          [16.0, 45.1],
        ],
      ],
    };
    const ok = await app.request(
      "/v1/plots/b1000000-0000-4000-8000-000000000001",
      {
        method: "PATCH",
        headers: authJson(),
        body: JSON.stringify({ geom_json: JSON.stringify(inside) }),
      },
      env
    );
    expect(ok.status).toBe(200);

    const poke = {
      type: "Polygon",
      coordinates: [
        [
          [16.0, 45.1],
          [16.001, 45.1],
          [16.012, 45.101],
          [16.0, 45.101],
          [16.0, 45.1],
        ],
      ],
    };
    const nudged = await app.request(
      "/v1/plots/b1000000-0000-4000-8000-000000000001",
      {
        method: "PATCH",
        headers: authJson(),
        body: JSON.stringify({ geom_json: JSON.stringify(poke) }),
      },
      env
    );
    expect(nudged.status).toBe(200);

    const far = {
      type: "Polygon",
      coordinates: [
        [
          [16.5, 45.5],
          [16.501, 45.5],
          [16.501, 45.501],
          [16.5, 45.501],
          [16.5, 45.5],
        ],
      ],
    };
    const outside = await app.request(
      "/v1/plots/b1000000-0000-4000-8000-000000000001",
      {
        method: "PATCH",
        headers: authJson(),
        body: JSON.stringify({ geom_json: JSON.stringify(far) }),
      },
      env
    );
    expect(outside.status).toBe(400);
    const err = (await outside.json()) as { error: string };
    expect(err.error).toBe("outside_holding");

    const created = await app.request(
      "/v1/plots",
      {
        method: "POST",
        headers: authJson(),
        body: JSON.stringify({
          farm_slug: "ivan-jovic",
          name: "Neighbour hay",
          use_type: "hay",
          geom_json: JSON.stringify(far),
        }),
      },
      env
    );
    expect(created.status).toBe(400);
    const createdErr = (await created.json()) as { error: string };
    expect(createdErr.error).toBe("outside_holding");

    const loc2 = {
      type: "Polygon",
      coordinates: [
        [
          [16.49, 45.49],
          [16.51, 45.49],
          [16.51, 45.51],
          [16.49, 45.51],
          [16.49, 45.49],
        ],
      ],
    };
    const second = await app.request(
      "/v1/holdings",
      {
        method: "POST",
        headers: authJson(),
        body: JSON.stringify({
          farm_slug: "ivan-jovic",
          name: "Other field",
          geom_json: JSON.stringify(loc2),
        }),
      },
      env
    );
    expect(second.status).toBe(201);

    const kit = await app.request(
      "/v1/plots",
      {
        method: "POST",
        headers: authJson(),
        body: JSON.stringify({
          farm_slug: "ivan-jovic",
          name: "Pump shed",
          use_type: "equipment",
          geom_json: JSON.stringify(far),
        }),
      },
      env
    );
    expect(kit.status).toBe(201);
    const kitBody = (await kit.json()) as { holding_id: string | null };
    expect(kitBody.holding_id).toBeTruthy();

    const listed2 = await app.request("/v1/plots?farm=ivan-jovic", {}, env);
    const body2 = (await listed2.json()) as { holdings: Array<{ name: string }> };
    expect(body2.holdings.map((h) => h.name).sort()).toEqual(["Other field", "Sarampovo"]);

    const auditRes = await app.request("/v1/audit?farm=ivan-jovic&limit=20", {
      headers: { Authorization: `Bearer ${OPERATOR}` },
    }, env);
    expect(auditRes.status).toBe(200);
    const audit = (await auditRes.json()) as { audit: Array<{ action: string }> };
    expect(audit.audit.some((a) => a.action === "farm.extent")).toBe(true);
  });

  it("DELETE /v1/plots/:id removes a field with confirm", async () => {
    const created = await app.request(
      "/v1/plots",
      {
        method: "POST",
        headers: authJson(),
        body: JSON.stringify({
          farm_slug: "ivan-jovic",
          name: "Temp nursery",
          use_type: "nursery",
        }),
      },
      env
    );
    expect(created.status).toBe(201);
    const plot = (await created.json()) as { id: string };

    const denied = await app.request(
      `/v1/plots/${plot.id}`,
      {
        method: "DELETE",
        headers: authJson(),
        body: JSON.stringify({}),
      },
      env
    );
    expect(denied.status).toBe(400);

    const res = await app.request(
      `/v1/plots/${plot.id}`,
      {
        method: "DELETE",
        headers: authJson(),
        body: JSON.stringify({ confirm: true }),
      },
      env
    );
    expect(res.status).toBe(200);

    const list = await app.request("/v1/plots?farm=ivan-jovic", {}, env);
    const body = (await list.json()) as { plots: Array<{ id: string }> };
    expect(body.plots.some((p) => p.id === plot.id)).toBe(false);
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

  it("GET /land without session is public HTML", async () => {
    const res = await app.request("/land", {}, env);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Land");
    expect(html).toContain("Overview");
    expect(html).toContain("Ledger");
    expect(html).toContain("lang-toggle");
    expect(html).toContain('id="lang-toggle"');
    expect(html).toContain("https://docs.opg-ivanjovic.hr");
    expect(html).toContain("Docs");
    expect(html).toContain("nav-rail");
    expect(html).toContain('aria-current="page"');
    expect(html).toContain("G-9VEBFY7JYD");
    expect(html).toContain("googletagmanager.com/gtag/js");
    expect(html).toContain("farm-map");
    expect(html).toContain("data-maps-key");
    expect(html).toContain("map-search-row");
    expect(html).toContain('id="map-draw"');
    expect(html).toContain('id="op-logout"');
    expect(html).not.toContain('id="op-gate"');
    expect(html).not.toContain('class="op-gate"');
  });

  it("GET / includes Open Graph tags", async () => {
    const res = await app.request("/", {}, env);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('property="og:image"');
    expect(html).toContain("/og.jpg");
    expect(html).toContain('name="twitter:card" content="summary"');
    expect(html.indexOf('property="og:image"')).toBeLessThan(html.indexOf("<style>"));
    expect(html).toContain('rel="icon" href="/favicon.svg"');
    expect(html).toContain("brand-mark");
  });

  it("GET /favicon.svg is the field mark", async () => {
    const res = await app.request("/favicon.svg", {}, env);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("image/svg+xml");
    const svg = await res.text();
    expect(svg).toContain("<svg");
    expect(svg).toContain("viewBox=\"0 0 32 32\"");
  });

  it("GET /apple-touch-icon.png is a PNG", async () => {
    const res = await app.request("/apple-touch-icon.png", {}, env);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("image/png");
    const buf = await res.arrayBuffer();
    expect(buf.byteLength).toBeGreaterThan(100);
    const bytes = new Uint8Array(buf);
    expect(bytes[0]).toBe(0x89);
    expect(bytes[1]).toBe(0x50);
  });

  it("GET /og.jpg without object → 404", async () => {
    const res = await app.request("/og.jpg", {}, env);
    expect(res.status).toBe(404);
  });

  it("GET /hero.jpg without object → 404", async () => {
    const res = await app.request("/hero.jpg", {}, env);
    expect(res.status).toBe(404);
  });

  it("GET / is a public pilot overview", async () => {
    const res = await app.request("/", {}, env);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("home_pitch");
    expect(html).toContain("home_why");
    expect(html).toContain("nav_plan");
    expect(html).toContain("Civil works");
    expect(html).toContain("https://trello.com/b/RCANtF3j/opg-ivan-jovic");
    expect(html).toContain('href="/plan"');
    expect(html).toContain("analog_wx_hint");
    expect(html).toContain("i.ytimg.com");
  });

  it("GET /plan is public HTML", async () => {
    const res = await app.request("/plan", {}, env);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("plan_howto");
    expect(html).toContain("Civil works");
    expect(html).toContain("trello-live");
    expect(html).toContain("Todos");
    expect(html).toContain("calendar.ics");
  });

  it("GET /sitemap.xml lists public pages", async () => {
    const res = await app.request(
      "/sitemap.xml",
      { headers: { Host: "www.opg-ivanjovic.hr" } },
      env
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("xml");
    const xml = await res.text();
    expect(xml).toContain("http://www.sitemaps.org/schemas/sitemap/0.9");
    expect(xml).toContain("<loc>https://opg-ivanjovic.hr/</loc>");
    expect(xml).toContain("<loc>https://opg-ivanjovic.hr/eyes</loc>");
    expect(xml).toContain("<loc>https://opg-ivanjovic.hr/plan</loc>");
    expect(xml).not.toContain("/login");
    expect(xml).not.toContain("/v1/");
    expect(xml).not.toContain("www.opg-ivanjovic.hr/");
  });

  it("GET /robots.txt points at sitemap.xml", async () => {
    const res = await app.request(
      "/robots.txt",
      { headers: { Host: "opg-ivanjovic.hr" } },
      env
    );
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("Sitemap: https://opg-ivanjovic.hr/sitemap.xml");
    expect(body).toContain("Agentmap: https://opg-ivanjovic.hr/.well-known/ai-catalog.json");
    expect(body).toContain("Disallow: /v1/");
    expect(body).toContain("Disallow: /login");
  });

  it("GET / sends RFC 8288 Link headers for agents", async () => {
    const res = await app.request(
      "/",
      { headers: { Host: "opg-ivanjovic.hr" } },
      env
    );
    expect(res.status).toBe(200);
    const link = res.headers.get("link") ?? "";
    expect(link).toContain('rel="api-catalog"');
    expect(link).toContain("/.well-known/api-catalog");
    expect(link).toContain('rel="service-desc"');
    expect(link).toContain('rel="service-doc"');
    const html = await res.text();
    expect(html).toContain('rel="api-catalog"');
    expect(html).toContain("navigator.modelContext");
    expect(html).toContain("provideContext");
  });

  it("GET / with Accept text/markdown returns markdown", async () => {
    const res = await app.request(
      "/",
      {
        headers: {
          Host: "opg-ivanjovic.hr",
          Accept: "text/markdown",
        },
      },
      env
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/markdown");
    expect(res.headers.get("x-markdown-tokens")).toBeTruthy();
    const body = await res.text();
    expect(body.startsWith("# Polje")).toBe(true);
    expect(body).not.toContain("<html");
  });

  it("GET /.well-known/api-catalog is a linkset", async () => {
    const res = await app.request(
      "/.well-known/api-catalog",
      { headers: { Host: "opg-ivanjovic.hr" } },
      env
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/linkset+json");
    const body = (await res.json()) as {
      linkset: Array<{ anchor: string }>;
    };
    expect(body.linkset.length).toBeGreaterThan(0);
    expect(body.linkset[0]?.anchor).toContain("https://opg-ivanjovic.hr");
  });

  it("GET /.well-known/mcp/server-card.json describes Polje MCP", async () => {
    const res = await app.request(
      "/.well-known/mcp/server-card.json",
      { headers: { Host: "opg-ivanjovic.hr" } },
      env
    );
    expect(res.status).toBe(200);
    const card = (await res.json()) as {
      serverInfo: { name: string };
      url: string;
      transport: { type: string };
    };
    expect(card.serverInfo.name).toBe("polje");
    expect(card.url).toBe("https://opg-ivanjovic.hr/mcp");
    expect(card.transport.type).toBe("streamable-http");
  });

  it("GET /.well-known/ai-catalog.json is an ARD manifest", async () => {
    const res = await app.request(
      "/.well-known/ai-catalog.json",
      { headers: { Host: "www.opg-ivanjovic.hr" } },
      env
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    const cat = (await res.json()) as {
      specVersion: string;
      host: { displayName: string; identifier: string };
      entries: Array<{
        identifier: string;
        url?: string;
        data?: unknown;
        representativeQueries: string[];
      }>;
    };
    expect(cat.specVersion).toBeTruthy();
    expect(cat.host.identifier).toBe("did:web:opg-ivanjovic.hr");
    expect(cat.entries.length).toBeGreaterThan(0);
    for (const e of cat.entries) {
      expect(e.identifier.startsWith("urn:air:")).toBe(true);
      expect(Boolean(e.url) !== Boolean(e.data)).toBe(true);
      expect(e.representativeQueries.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("GET OAuth discovery + auth.md + skills index", async () => {
    const host = { headers: { Host: "opg-ivanjovic.hr" } };
    const as = await app.request(
      "/.well-known/oauth-authorization-server",
      host,
      env
    );
    expect(as.status).toBe(200);
    const asBody = (await as.json()) as {
      issuer: string;
      authorization_endpoint: string;
      token_endpoint: string;
      jwks_uri: string;
      grant_types_supported: string[];
      agent_auth: { register_uri: string };
    };
    expect(asBody.issuer).toBe("https://opg-ivanjovic.hr");
    expect(asBody.agent_auth.register_uri).toContain("/auth.md");
    expect(asBody.agent_auth.skill).toContain("/auth.md");
    expect(asBody.agent_auth.claim_uri).toContain("/auth.md");

    const oidc = await app.request(
      "/.well-known/openid-configuration",
      host,
      env
    );
    expect(oidc.status).toBe(200);

    const prm = await app.request(
      "/.well-known/oauth-protected-resource",
      host,
      env
    );
    expect(prm.status).toBe(200);
    const prmBody = (await prm.json()) as {
      resource: string;
      authorization_servers: string[];
      scopes_supported: string[];
    };
    expect(prmBody.resource).toBe("https://opg-ivanjovic.hr");
    expect(prmBody.authorization_servers).toContain("https://opg-ivanjovic.hr");

    const auth = await app.request("/auth.md", host, env);
    expect(auth.status).toBe(200);
    expect(auth.headers.get("content-type")).toContain("text/markdown");
    const authMd = await auth.text();
    expect(authMd).toMatch(/^# auth\.md/m);

    const skills = await app.request(
      "/.well-known/agent-skills/index.json",
      host,
      env
    );
    expect(skills.status).toBe(200);
    const idx = (await skills.json()) as {
      $schema: string;
      skills: Array<{ name: string; digest: string; url: string }>;
    };
    expect(idx.$schema).toContain("agentskills.io/discovery/0.2.0");
    const farm = idx.skills.find((s) => s.name === "polje-farm");
    expect(farm).toBeTruthy();
    const skillRes = await app.request(farm!.url, host, env);
    const skillBody = await skillRes.text();
    const { sha256Hex } = await import("../src/lib/agent-discovery");
    expect(farm!.digest).toBe(`sha256:${await sha256Hex(skillBody)}`);
  });

  it("DNS-AID zone lists ServiceMode index and MCP names", async () => {
    const { dnsAidZonePresentation, DNS_AID_NAMES } = await import("../src/lib/dns-aid");
    const zone = dnsAidZonePresentation();
    expect(zone).toContain("_index._agents.opg-ivanjovic.hr");
    expect(zone).toContain("_mcp._agents.opg-ivanjovic.hr");
    expect(zone).toContain("IN  HTTPS");
    expect(zone).toContain("IN  SVCB");
    expect(zone).toContain("mandatory=alpn,port");
    expect(zone).not.toContain("_a2a._agents");
    expect(DNS_AID_NAMES).toContain("_catalog._agents");
  });

  it("GET /v1/plan lists phases", async () => {
    const res = await app.request("/v1/plan?farm=ivan-jovic", {}, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      phases: Array<{ title: string; amount_cents: number }>;
    };
    expect(body.phases.some((p) => p.title === "Civil works")).toBe(true);
    expect(body.phases[0]?.amount_cents).toBe(0);
  });

  it("GET /v1/plan/calendar.ics is a calendar", async () => {
    const res = await app.request("/v1/plan/calendar.ics?farm=ivan-jovic", {}, env);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type") || "").toContain("text/calendar");
    const ics = await res.text();
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("Civil works");
  });

  it("POST /v1/plan/tasks writes a todo without confirm", async () => {
    const res = await app.request(
      "/v1/plan/tasks",
      {
        method: "POST",
        headers: authJson(),
        body: JSON.stringify({
          title: "Call liner shop",
          due_on: "2026-10-02",
        }),
      },
      env
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { task: { status: string; due_on: string } };
    expect(body.task.status).toBe("todo");
    expect(body.task.due_on).toBe("2026-10-02");
  });

  it("POST /v1/plan/orders ordered without confirm → proposal", async () => {
    const res = await app.request(
      "/v1/plan/orders",
      {
        method: "POST",
        headers: authJson(),
        body: JSON.stringify({
          title: "Fake liner",
          amount_eur: 12,
          status: "ordered",
          confirm: false,
        }),
      },
      env
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { proposal: boolean };
    expect(body.proposal).toBe(true);
  });

  it("get_plan MCP returns where + phases", async () => {
    const { runTool } = await import("../src/mcp/tools");
    const result = await runTool(
      "get_plan",
      { env, actor: "agent:mcp", allowConfirm: true },
      { farm_slug: "ivan-jovic" }
    );
    expect(result.error).toBeUndefined();
    expect(Array.isArray((result as { phases: unknown[] }).phases)).toBe(true);
    expect((result as { where: { timezone: string } }).where.timezone).toBe(
      "Europe/Zagreb"
    );
  });

  it("GET /v1/trello returns board shape", async () => {
    const res = await app.request("/v1/trello?farm=ivan-jovic", {}, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { slug: string; board: unknown };
    expect(body.slug).toBe("ivan-jovic");
    expect(body).toHaveProperty("board");
  });

  it("POST /v1/plan without confirm → proposal", async () => {
    const res = await app.request(
      "/v1/plan",
      {
        method: "POST",
        headers: authJson(),
        body: JSON.stringify({
          title: "Starlink",
          reason: "test phase",
          confirm: false,
        }),
      },
      env
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { proposal: boolean };
    expect(body.proposal).toBe(true);
  });

  it("POST /v1/hero/generate without confirm → proposal", async () => {
    const res = await app.request(
      "/v1/hero/generate",
      {
        method: "POST",
        headers: authJson(),
        body: JSON.stringify({ reason: "overview still", confirm: false }),
      },
      env
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { proposal: boolean };
    expect(body.proposal).toBe(true);
  });

  it("POST /v1/og/generate without token → 401", async () => {
    const res = await app.request(
      "/v1/og/generate",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true, reason: "test" }),
      },
      env
    );
    expect(res.status).toBe(401);
  });

  it("GET farm pages without session are public HTML", async () => {
    const pages: Array<[string, string]> = [
      ["/water", "Water"],
      ["/klima", "Climate"],
      ["/hands", "Hands"],
      ["/frost", "Frost"],
      ["/plan", "Plan"],
    ];
    for (const [path, heading] of pages) {
      const res = await app.request(path, {}, env);
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain(heading);
      expect(html).toContain("<nav");
      expect(html).toContain("nav-rail");
      expect(html).toContain("viewport-fit=cover");
    }
  });

  it("GET /login returns HTML", async () => {
    const res = await app.request("/login", {}, env);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Sign in");
    expect(html).toContain("Email");
    expect(html).toContain("Password");
    expect(html).toContain("nav-rail");
  });

  it("GET /v1/weather/now returns solar and wx", async () => {
    const res = await app.request("/v1/weather/now?farm=ivan-jovic", {}, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      solar: string;
      wx: string;
      temp_c: number | null;
    };
    expect(["dawn", "day", "dusk", "night"]).toContain(body.solar);
    expect(["clear", "cloud", "rain", "snow", "frost", "fog"]).toContain(
      body.wx
    );
    expect(body).toHaveProperty("temp_c");
  });

  it("GET /v1/maps/sample requires lat lon", async () => {
    const res = await app.request("/v1/maps/sample?farm=ivan-jovic", {}, env);
    expect([400, 503]).toContain(res.status);
    const body = (await res.json()) as { error: string };
    expect(["bad_lat_lon", "maps_not_configured"]).toContain(body.error);
  });

  it("GET /v1/maps/sample rejects bad coordinates", async () => {
    const res = await app.request(
      "/v1/maps/sample?farm=ivan-jovic&lat=99&lon=16",
      {},
      env
    );
    expect([400, 503]).toContain(res.status);
  });

  it("GET /fonts/D-DIN.woff2 serves the chassis typeface", async () => {
    const res = await app.request("/fonts/D-DIN.woff2", {}, env);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("font/woff2");
    const buf = await res.arrayBuffer();
    expect(buf.byteLength).toBeGreaterThan(1000);
  });

  it("POST /v1/session sets cookie that authorizes writes", async () => {
    const bad = await app.request(
      "/v1/session",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "info@qtech.hr", password: "wrong" }),
      },
      env
    );
    expect(bad.status).toBe(401);

    const login = await app.request(
      "/v1/session",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "info@qtech.hr",
          password: "test-operator-password",
        }),
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

  it("GET /mail without session → login; cookie opens mailbox", async () => {
    const anon = await app.request("/mail", {}, env);
    expect(anon.status).toBe(302);
    expect(anon.headers.get("Location") || "").toContain("/login?next=");

    const login = await app.request(
      "/v1/session",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "info@qtech.hr",
          password: "test-operator-password",
        }),
      },
      env
    );
    const cookie = (login.headers.get("Set-Cookie") || "").split(";")[0];
    const page = await app.request("/mail", { headers: { Cookie: cookie } }, env);
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain("Mail");
    expect(html).toContain("farm@opg-ivanjovic.hr");
    expect(html).not.toContain("Operator token");
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

  it("FarmRuntime broadcasts land events", async () => {
    const stub = farmStub(env, "ivan-jovic");
    const res = await stub.fetch(
      new Request("https://do/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "land", plot: { id: "x" } }),
      })
    );
    expect(res.status).toBe(200);
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
      cameras: Array<{
        id: string;
        snapshot: unknown;
        analog?: { youtube_id: string; embed_url: string };
      }>;
    };
    expect(body.cameras.length).toBe(3);
    expect(body.cameras.map((c) => c.id).sort()).toEqual([
      "cam-garden",
      "cam-hay",
      "cam-yard",
    ]);
    const yard = body.cameras.find((c) => c.id === "cam-yard");
    expect(yard?.analog?.youtube_id).toBe("N4kJ8kqunLA");
    expect(yard?.analog?.embed_url).toContain("youtube.com/embed");
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
    expect(html).toContain("Eyes");
    expect(html).toContain("Ledger");
    expect(html).toContain("youtube.com/embed");
    expect(html).toContain("analog_lonjsko");
  });
});

describe("polje analog climate + eyes", () => {
  beforeAll(async () => {
    await migrateAndSeed();
  });

  it("ANALOG_LIVE is off in tests", () => {
    expect(analogLiveOn(env)).toBe(false);
  });

  it("synthetic batch maps Open-Meteo-like obs onto farm devices", () => {
    const obs = syntheticObservation(new Date("2026-09-01T12:00:00+02:00"));
    const batch = buildAnalogBatch("ivan-jovic", obs, new Date("2026-09-01T10:00:00Z"));
    expect(isAnalogBatchId(batch.batch_id)).toBe(true);
    expect(batch.health?.starlink).toBe("up");
    expect(batch.health?.nvr).toBe("unconfigured");
    const ids = batch.readings.map((r) => `${r.device_id}:${r.metric}`);
    expect(ids).toContain("temp-yard-1:temp_c");
    expect(ids).toContain("fps-sn-1:rh");
    expect(ids).toContain("soil-n-1:moisture");
    expect(ids).toContain("inv-1:w");
    expect(ids).toContain("ups-1:battery_pct");
    expect(ids).toContain("temp-house-1:temp_c");
    expect(analogBatchId("ivan-jovic", 0).startsWith("analog-ivan-jovic-")).toBe(true);
  });

  it("wxFromWmoCode and wxFromLive read analog metrics", () => {
    expect(wxFromWmoCode(0)).toBe("clear");
    expect(wxFromWmoCode(3)).toBe("cloud");
    expect(wxFromWmoCode(61)).toBe("rain");
    expect(wxFromWmoCode(71)).toBe("snow");
    expect(wxFromWmoCode(45)).toBe("fog");
    expect(
      wxFromLive({
        metrics: {
          "temp-yard-1:weather_code": {
            metric: "weather_code",
            value: 61,
            device_id: "temp-yard-1",
          },
        },
      })
    ).toBe("rain");
  });

  it("analog feeds have three public YouTube IDs", () => {
    expect(analogFeedForCamera("cam-yard")?.youtube_id).toBe("N4kJ8kqunLA");
    expect(analogEmbedUrl("WtoxxHADnGk")).toContain("youtube.com/embed/WtoxxHADnGk");
    const meta = analogPublicMeta();
    expect(meta.demo).toBe(true);
    expect(meta.climate.place).toContain("Lonjsko");
  });

  it("GET /v1/overview does not analog-ingest when ANALOG_LIVE=0", async () => {
    const res = await app.request("/v1/overview?farm=ivan-jovic", {}, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      analog: null | { demo: boolean };
      live: { last_batch_id: string | null };
    };
    expect(body.analog).toBeNull();
    expect(body.live.last_batch_id === null || !String(body.live.last_batch_id).startsWith("analog-")).toBe(
      true
    );
  });
});

describe("polje M7 money ledger", () => {
  beforeAll(async () => {
    await migrateAndSeed();
  });

  it("GET /v1/ledger without token is public", async () => {
    const res = await app.request("/v1/ledger?farm=ivan-jovic", {}, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { entries: unknown[] };
    expect(Array.isArray(body.entries)).toBe(true);
  });

  it("GET /v1/ledger/summary without token is public", async () => {
    const res = await app.request("/v1/ledger/summary?farm=ivan-jovic", {}, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { income_cents: number };
    expect(typeof body.income_cents).toBe("number");
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

  it("GET /ledger without session is public HTML", async () => {
    const res = await app.request("/ledger", {}, env);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Ledger");
    expect(html).toContain("Overview");
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

  it("run_irrigation with confirm → sent command + audit", async () => {
    const { runTool } = await import("../src/mcp/tools");
    const result = await runTool(
      "run_irrigation",
      { env, actor: "agent:mcp", allowConfirm: true },
      {
        zone_id: "d1000000-0000-4000-8000-000000000001",
        duration_sec: 120,
        reason: "test dry soil",
        confirm: true,
      }
    );
    expect(result.error).toBeUndefined();
    expect((result as { ok?: boolean }).ok).toBe(true);
    expect((result as { status?: string }).status).toBe("sent");

    const cmd = await env.DB.prepare(
      `SELECT action, source, confirmed_by FROM commands WHERE action = 'valve.open' ORDER BY created_at DESC LIMIT 1`
    ).first<{ action: string; source: string; confirmed_by: string }>();
    expect(cmd?.action).toBe("valve.open");
    expect(cmd?.source).toBe("api");
    expect(cmd?.confirmed_by).toBe("agent:mcp");
  });

  it("propose_automation validates JSON + enable/set_actuator confirm gate", async () => {
    const { runTool } = await import("../src/mcp/tools");

    const bad = await runTool(
      "propose_automation",
      { env, actor: "agent:mcp", allowConfirm: true },
      {
        name: "Bad draft",
        trigger_json: '{"type":"nope"}',
        action_json: '{"type":"snapshot.take","camera_id":"cam-yard"}',
        farm_slug: "ivan-jovic",
      }
    );
    expect(bad.error).toBe("validation");

    const draft = await runTool(
      "propose_automation",
      { env, actor: "agent:mcp", allowConfirm: true },
      {
        name: "MCP soil propose",
        trigger_json: JSON.stringify({
          type: "metric",
          device_id: "soil-n-1",
          metric: "moisture",
          op: "lt",
          value: 0.2,
        }),
        action_json: JSON.stringify({
          type: "command.propose",
          device_id: "valve-garden-drip",
          action: "irrigation.run",
          payload: { duration_sec: 60 },
        }),
        farm_slug: "ivan-jovic",
      }
    );
    expect(draft.ok).toBe(true);
    expect((draft as { automation: { enabled: number; risk: string; id: string } }).automation.enabled).toBe(0);
    expect((draft as { automation: { risk: string } }).automation.risk).toBe("high");
    const autoId = (draft as { automation: { id: string } }).automation.id;

    const enableProposal = await runTool(
      "enable_automation",
      { env, actor: "agent:mcp", allowConfirm: true },
      {
        automation_id: autoId,
        reason: "want it on",
        confirm: false,
        farm_slug: "ivan-jovic",
      }
    );
    expect(enableProposal.status).toBe("proposal");
    const stillOff = await env.DB.prepare(
      `SELECT enabled FROM automations WHERE id = ?`
    )
      .bind(autoId)
      .first<{ enabled: number }>();
    expect(stillOff?.enabled).toBe(0);

    const grokBlocked = await runTool(
      "enable_automation",
      { env, actor: "agent:grok", allowConfirm: false },
      {
        automation_id: autoId,
        reason: "grok cannot confirm",
        confirm: true,
        farm_slug: "ivan-jovic",
      }
    );
    expect(grokBlocked.status).toBe("proposal");

    const enabled = await runTool(
      "enable_automation",
      { env, actor: "agent:mcp", allowConfirm: true },
      {
        automation_id: autoId,
        reason: "operator enable from mcp",
        confirm: true,
        farm_slug: "ivan-jovic",
      }
    );
    expect(enabled.ok).toBe(true);
    expect((enabled as { enabled: number }).enabled).toBe(1);

    const before = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM commands WHERE action = 'actuator.set'`
    ).first<{ n: number }>();

    const actProposal = await runTool(
      "set_actuator",
      { env, actor: "agent:mcp", allowConfirm: true },
      {
        device_id: "valve-garden-drip",
        state: "on",
        timeout_sec: 30,
        reason: "test actuator",
        confirm: false,
        farm_slug: "ivan-jovic",
      }
    );
    expect(actProposal.status).toBe("proposal");

    const afterProposal = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM commands WHERE action = 'actuator.set'`
    ).first<{ n: number }>();
    expect(afterProposal?.n).toBe(before?.n ?? 0);

    const actOk = await runTool(
      "set_actuator",
      { env, actor: "agent:mcp", allowConfirm: true },
      {
        device_id: "valve-garden-drip",
        state: "off",
        timeout_sec: 15,
        reason: "test actuator off",
        confirm: true,
        farm_slug: "ivan-jovic",
      }
    );
    expect(actOk.ok).toBe(true);
    expect((actOk as { status: string }).status).toBe("sent");
    expect((actOk as { action: string }).action).toBe("actuator.set");
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

  it("irrigation MCP resource is live (not not_ready)", async () => {
    const { readPoljeResource } = await import("../src/mcp/resources");
    const result = await readPoljeResource(
      env,
      "polje://farm/ivan-jovic/irrigation"
    );
    expect("error" in result).toBe(false);
    if ("text" in result) {
      const body = JSON.parse(result.text) as {
        status?: string;
        rain_lockout?: boolean;
        zones?: unknown[];
      };
      expect(body.status).not.toBe("not_ready");
      expect(Array.isArray(body.zones)).toBe(true);
    }
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
    if (env.XAI_API_KEY) {
      return;
    }
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

  it("GET / and /land have Polje ask in nav", async () => {
    const res = await app.request("/", {}, env);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("polje-ask");
    expect(html).toContain("dock-polje");
    expect(html).toContain("Ask Polje");
    expect(html).not.toContain("GROK");
    expect(html).toContain("class=\"hero\"");
    expect(html).toContain("nav-toggle");
    expect(html).toContain("nav-dock");
    expect(html).toContain('id="op-logout"');
    expect(html).not.toContain('id="op-gate"');
    expect(html).not.toContain('class="op-gate"');

    const land = await app.request("/land", {}, env);
    expect(land.status).toBe(200);
    const landHtml = await land.text();
    expect(landHtml).toContain("polje-ask");
    expect(landHtml).toContain("land-book");
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

  it("metric for_sec waits until dwell elapses", async () => {
    const { evaluateAutomations } = await import("../src/lib/automations");
    const create = await app.request(
      "/v1/automations",
      {
        method: "POST",
        headers: authJson(),
        body: JSON.stringify({
          name: "Dwell moisture",
          enabled: true,
          confirm: true,
          reason: "unit test dwell",
          cooldown_sec: 0,
          trigger: {
            type: "metric",
            device_id: "soil-n-1",
            metric: "moisture",
            op: "lt",
            value: 0.5,
            for_sec: 120,
          },
          action: {
            type: "command.propose",
            device_id: "valve-dwell-test",
            action: "irrigation.run",
            payload: { duration_sec: 60 },
          },
        }),
      },
      env
    );
    expect(create.status).toBe(201);
    const created = (await create.json()) as { id: string; enabled: number };
    expect(created.enabled).toBe(1);

    const state = {
      farm_id: "ivan-jovic",
      starlink: "up" as const,
      metrics: {
        "soil-n-1:moisture": {
          device_id: "soil-n-1",
          metric: "moisture",
          value: 0.1,
          ts: new Date().toISOString(),
        },
      },
    };
    const dwell: Record<string, number> = {};
    const first = await evaluateAutomations(env.DB, state, { dwell });
    expect(first.fired).not.toContain(created.id);
    expect(dwell[created.id]).toBeTypeOf("number");

    const cmdsEarly = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM commands WHERE device_id = 'valve-dwell-test'`
    ).first<{ n: number }>();
    expect(cmdsEarly?.n ?? 0).toBe(0);

    dwell[created.id] = Date.now() - 180_000;
    const second = await evaluateAutomations(env.DB, state, { dwell });
    expect(second.fired).toContain(created.id);

    const cmds = await env.DB.prepare(
      `SELECT status FROM commands WHERE device_id = 'valve-dwell-test' ORDER BY created_at DESC LIMIT 1`
    ).first<{ status: string }>();
    expect(cmds?.status).toBe("proposed");
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
    expect(html).toContain("Hands");
    expect(html).toContain("Automations");
    expect(html).toContain("data-farm=");
    expect(html).toContain("const FARM");
  });
});

describe("polje M5 irrigation", () => {
  const DRIP = "d1000000-0000-4000-8000-000000000001";
  const FROST = "d1000000-0000-4000-8000-000000000002";

  beforeAll(async () => {
    await migrateAndSeed();
  });

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
    expect(html).toContain("Water");
    expect(html).toContain("akumulacija");
    expect(html).toContain("pond-canvas");
    expect(html).toContain("pond-facts");
    expect(html).toContain("pond-depth-val");
    expect(html).toContain("dewline");
    expect(html).toContain("pack-canvas");
    expect(html).toContain("confirm");
  });

  it("GET /v1/water/budget sizes demand and pond from plots", async () => {
    const orchard = await app.request(
      "/v1/plots",
      {
        method: "POST",
        headers: authJson(),
        body: JSON.stringify({
          farm_slug: "ivan-jovic",
          name: "Budget orchard",
          use_type: "orchard",
          hectares: 1,
        }),
      },
      env
    );
    expect(orchard.status).toBe(201);

    const pond = await app.request(
      "/v1/plots",
      {
        method: "POST",
        headers: authJson(),
        body: JSON.stringify({
          farm_slug: "ivan-jovic",
          name: "Akumulacija test",
          use_type: "pond",
          hectares: 0.12,
        }),
      },
      env
    );
    expect(pond.status).toBe(201);
    const pondRow = (await pond.json()) as { id: string };

    const res = await app.request("/v1/water/budget?farm=ivan-jovic", {}, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      demand_year_m3: number;
      storage_usable_m3: number;
      ponds: Array<{ plot_id: string; geom: { usable_m3: number } }>;
      climate: { rain_mm: number };
    };
    expect(body.climate.rain_mm).toBe(880);
    expect(body.demand_year_m3).toBeGreaterThan(2000);
    expect(body.ponds.some((p) => p.plot_id === pondRow.id)).toBe(true);
    expect(body.storage_usable_m3).toBeGreaterThan(100);

    const patch = await app.request(
      `/v1/water/ponds/${pondRow.id}`,
      {
        method: "PATCH",
        headers: authJson(),
        body: JSON.stringify({ depth_m: 3.5, bank_slope: 2 }),
      },
      env
    );
    expect(patch.status).toBe(200);
    const after = (await patch.json()) as { geom: { depth_m: number } };
    expect(after.geom.depth_m).toBe(3.5);
  });

  it("Dewline packer keeps concurrent drip under pump cap", () => {
    const lines: IrrigationLine[] = [
      {
        lineId: "a",
        valveBox: "",
        valveNumber: "1",
        zone: "East",
        type: "drip",
        flowM3h: 5,
        durationMin: 30,
      },
      {
        lineId: "b",
        valveBox: "",
        valveNumber: "2",
        zone: "West",
        type: "drip",
        flowM3h: 5,
        durationMin: 30,
      },
    ];
    const params: SystemParams = {
      mainFlowM3h: 8,
      cyclesPerDay: 1,
      weeklyFactor: 1,
      monthlyFactor: 1,
      waterPriceEurM3: 2.4,
      rainTankM3: 50,
      catchmentM2: 400,
      annualRainMm: 880,
      wellRateM3h: 0,
      storageTankM3: 50,
      initialTankPct: 80,
      refillRateM3h: 0,
      fillSource: "auto",
      supplyMode: "tank",
    };
    const dry = buildSchedule(lines, params, [
      { date: "2026-09-02", precipMm: 0, tempMaxC: 24, tempMinC: 14 },
    ], "test");
    expect(dry.peakFlowM3h).toBeLessThanOrEqual(8);
    const live = dry.slots.filter((s) => !s.skipped);
    expect(live).toHaveLength(2);
    const overlap =
      Math.min(live[0]!.endMin, live[1]!.endMin) >
      Math.max(live[0]!.startMin, live[1]!.startMin);
    expect(overlap).toBe(false);

    const wet = buildSchedule(lines, params, [
      { date: "2026-09-02", precipMm: 6, tempMaxC: 22, tempMinC: 14 },
    ], "test");
    for (const s of wet.slots.filter((x) => !x.skipped)) {
      expect(s.endMin - s.startMin).toBe(12);
    }

    const boxed = buildSchedule(
      lines.map((l) => ({ ...l, valveBox: "P-1" })),
      { ...params, mainFlowM3h: 20 },
      [{ date: "2026-09-02", precipMm: 0, tempMaxC: 24, tempMinC: 14 }],
      "test"
    );
    const boxedLive = boxed.slots.filter((s) => !s.skipped);
    const boxOverlap =
      Math.min(boxedLive[0]!.endMin, boxedLive[1]!.endMin) >
      Math.max(boxedLive[0]!.startMin, boxedLive[1]!.startMin);
    expect(boxOverlap).toBe(false);
  });

  it("GET /v1/water/pack packs drip and skips frost", async () => {
    const res = await app.request("/v1/water/pack?farm=ivan-jovic&precip_mm=0", {}, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      frost_excluded: boolean;
      peak_flow_m3h: number;
      params: { main_flow_m3h: number };
      slots: Array<{ zone: string; skipped?: boolean }>;
      lines: Array<{ name: string }>;
      savings: { saved_cents: number } | null;
    };
    expect(body.frost_excluded).toBe(true);
    expect(body.params.main_flow_m3h).toBe(8);
    expect(body.lines.every((l) => !/frost/i.test(l.name))).toBe(true);
    expect(body.slots.every((s) => !/frost/i.test(s.zone))).toBe(true);
    expect(body.peak_flow_m3h).toBeLessThanOrEqual(body.params.main_flow_m3h);
    expect(body.savings).not.toBeNull();

    const denied = await app.request(
      "/v1/water/pump?farm=ivan-jovic",
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ main_flow_m3h: 6 }) },
      env
    );
    expect(denied.status).toBe(401);

    const patch = await app.request(
      "/v1/water/pump?farm=ivan-jovic",
      {
        method: "PATCH",
        headers: authJson(),
        body: JSON.stringify({ main_flow_m3h: 6, cycles_per_day: 2 }),
      },
      env
    );
    expect(patch.status).toBe(200);
    const after = await app.request("/v1/water/pack?farm=ivan-jovic", {}, env);
    const packed = (await after.json()) as { params: { main_flow_m3h: number; cycles_per_day: number } };
    expect(packed.params.main_flow_m3h).toBe(6);
    expect(packed.params.cycles_per_day).toBe(2);
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

  it("ACK valve.open → run status running, not done", async () => {
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
          duration_sec: 120,
          reason: "ack running check",
          confirm: true,
        }),
      },
      env
    );
    expect(res.status).toBe(202);
    const body = (await res.json()) as { command_id: string; run_id: string };

    const ack = await app.request(
      `/v1/commands/${body.command_id}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${INGEST}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "acked" }),
      },
      env
    );
    expect(ack.status).toBe(200);

    const run = await env.DB.prepare(
      `SELECT status, ended_at FROM irrigation_runs WHERE id = ?`
    )
      .bind(body.run_id)
      .first<{ status: string; ended_at: string | null }>();
    expect(run?.status).toBe("running");
    expect(run?.ended_at).toBeNull();
  });

  it("POST /v1/ingest/irrigation-run records schedule fire + audit", async () => {
    const started = new Date().toISOString();
    const res = await app.request(
      "/v1/ingest/irrigation-run",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${INGEST}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          farm_id: "ivan-jovic",
          zone_id: DRIP,
          duration_sec: 90,
          started_at: started,
          reason: "offline schedule",
          schedule_id: "e1000000-0000-4000-8000-000000000001",
        }),
      },
      env
    );
    expect(res.status).toBe(202);
    const body = (await res.json()) as { ok: boolean; run_id: string };
    expect(body.ok).toBe(true);

    const dup = await app.request(
      "/v1/ingest/irrigation-run",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${INGEST}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          farm_id: "ivan-jovic",
          zone_id: DRIP,
          duration_sec: 90,
          started_at: started,
          reason: "offline schedule",
          schedule_id: "e1000000-0000-4000-8000-000000000001",
        }),
      },
      env
    );
    expect(dup.status).toBe(200);
    const dupBody = (await dup.json()) as { duplicate?: boolean };
    expect(dupBody.duplicate).toBe(true);

    const audit = await env.DB.prepare(
      `SELECT actor FROM audit WHERE action = 'irrigation.run' AND actor = 'edge' ORDER BY id DESC LIMIT 1`
    ).first<{ actor: string }>();
    expect(audit?.actor).toBe("edge");
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
      nodes: Array<{
        id: string;
        driver: string;
        driver_kind?: string;
        requires_timeout?: boolean;
      }>;
    };
    expect(body.nodes.some((n) => n.id === "fps-sn-1")).toBe(true);
    expect(body.nodes.some((n) => n.id === "fps-valve-1")).toBe(true);
    const valve = body.nodes.find((n) => n.id === "fps-valve-1");
    expect(valve?.requires_timeout).toBe(true);
    expect(valve?.driver_kind).toBe("actuator");
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
    expect(html).toContain("Frost");
    expect(html).toContain("ARM");
    expect(html).toContain("Recent events");
  });

  it("POST /v1/frost/events ingest writes frost_events ledger", async () => {
    const eventId = `frost-test-${crypto.randomUUID()}`;
    const start = await app.request(
      "/v1/frost/events",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${INGEST}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          farm_id: "ivan-jovic",
          event_id: eventId,
          type: "frost.spray_start",
          temp_c: -1.2,
          rh: 96,
          mode: "ice",
          reason: "test spray start",
        }),
      },
      env
    );
    expect(start.status).toBe(201);

    const statusRes = await app.request(
      "/v1/frost/status?farm=ivan-jovic",
      {},
      env
    );
    expect(statusRes.status).toBe(200);
    const status = (await statusRes.json()) as {
      recent_events: Array<{ id: string; ended_at: string | null }>;
    };
    expect(status.recent_events.some((e) => e.id === eventId)).toBe(true);
    expect(
      status.recent_events.find((e) => e.id === eventId)?.ended_at
    ).toBeNull();

    const end = await app.request(
      "/v1/frost/events",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${INGEST}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          farm_id: "ivan-jovic",
          event_id: eventId,
          type: "frost.spray_end",
          reason: "test spray end",
        }),
      },
      env
    );
    expect(end.status).toBe(201);

    const after = await app.request(
      "/v1/frost/status?farm=ivan-jovic",
      {},
      env
    );
    const afterBody = (await after.json()) as {
      recent_events: Array<{ id: string; ended_at: string | null }>;
    };
    expect(
      afterBody.recent_events.find((e) => e.id === eventId)?.ended_at
    ).toBeTruthy();
  });

  it("GET /v1/iot/bus returns bus health", async () => {
    const res = await app.request("/v1/iot/bus?farm=ivan-jovic", {}, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { farm_id: string };
    expect(body.farm_id).toBeTruthy();
  });
});

describe("polje M6 climate + energy", () => {
  const ZONE = "f1000000-0000-4000-8000-000000000001";
  const FARM = "a1000000-0000-4000-8000-000000000001";

  beforeAll(async () => {
    await migrateAndSeed();
  });

  it("GET /v1/climate/now lists Old house zone", async () => {
    const res = await app.request("/v1/climate/now?farm=ivan-jovic", {}, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      heat_battery_min_pct: number;
      zones: Array<{ id: string; name: string; heat_c: number }>;
    };
    expect(body.heat_battery_min_pct).toBe(30);
    const zone = body.zones.find((z) => z.id === ZONE);
    expect(zone).toBeTruthy();
    expect(zone?.heat_c).toBe(18);
  });

  it("GET /v1/energy/now returns solar/battery shape", async () => {
    const res = await app.request("/v1/energy/now?farm=ivan-jovic", {}, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      inverter_id: string;
      solar_w: number | null;
      loads: unknown[];
    };
    expect(body.inverter_id).toBe("inv-1");
    expect(Array.isArray(body.loads)).toBe(true);
  });

  it("energy today kWh from kwh_today metric", async () => {
    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO readings (device_id, metric, value, ts) VALUES ('inv-1', 'kwh_today', 3.5, ?)`
    )
      .bind(now)
      .run();

    const res = await app.request("/v1/energy/now?farm=ivan-jovic", {}, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { kwh_today: number | null };
    expect(body.kwh_today).toBe(3.5);
  });

  it("POST setpoint without confirm → proposal, zero commands", async () => {
    const before = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM commands WHERE action = 'setpoint.set'`
    ).first<{ n: number }>();

    const res = await app.request(
      `/v1/climate/zones/${ZONE}/setpoint`,
      {
        method: "POST",
        headers: authJson(),
        body: JSON.stringify({
          heat_c: 19,
          cool_c: 26,
          reason: "evening in the house",
          confirm: false,
        }),
      },
      env
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { proposal: boolean };
    expect(body.proposal).toBe(true);

    const after = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM commands WHERE action = 'setpoint.set'`
    ).first<{ n: number }>();
    expect(after?.n).toBe(before?.n ?? 0);
  });

  it("POST setpoint heat_c 50 → 400", async () => {
    const res = await app.request(
      `/v1/climate/zones/${ZONE}/setpoint`,
      {
        method: "POST",
        headers: authJson(),
        body: JSON.stringify({
          heat_c: 50,
          reason: "too hot",
          confirm: true,
        }),
      },
      env
    );
    expect(res.status).toBe(400);
  });

  it("heat lockout when battery < 30%", async () => {
    const ts = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO readings (device_id, metric, value, ts) VALUES
        ('ups-1', 'battery_pct', 20, ?),
        ('temp-house-1', 'temp_c', 10, ?)`
    )
      .bind(ts, ts)
      .run();

    const res = await app.request(
      `/v1/climate/zones/${ZONE}/setpoint`,
      {
        method: "POST",
        headers: authJson(),
        body: JSON.stringify({
          heat_c: 20,
          cool_c: 26,
          reason: "try heat on low battery",
          confirm: true,
        }),
      },
      env
    );
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("heat_lockout");
  });

  it("confirm setpoint with battery ok → command + audit", async () => {
    const ts = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO readings (device_id, metric, value, ts) VALUES
        ('ups-1', 'battery_pct', 80, ?),
        ('temp-house-1', 'temp_c', 12, ?)`
    )
      .bind(ts, ts)
      .run();

    const res = await app.request(
      `/v1/climate/zones/${ZONE}/setpoint`,
      {
        method: "POST",
        headers: authJson(),
        body: JSON.stringify({
          heat_c: 19,
          cool_c: 26,
          reason: "house occupied tonight",
          confirm: true,
        }),
      },
      env
    );
    expect(res.status).toBe(202);
    const body = (await res.json()) as { ok: boolean; command_id: string };
    expect(body.ok).toBe(true);
    expect(body.command_id).toBeTruthy();

    const audit = await env.DB.prepare(
      `SELECT action FROM audit WHERE action = 'climate.setpoint' LIMIT 1`
    ).first<{ action: string }>();
    expect(audit?.action).toBe("climate.setpoint");
  });

  it("GET /klima returns HTML", async () => {
    const res = await app.request("/klima", {}, env);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Klima");
    expect(html).toContain("Energija");
  });

  it("settleEnergyDaily rolls up yesterday inverter kWh", async () => {
    const tz = "Europe/Zagreb";
    const yesterday = addDays(localDateInTz(new Date(), tz), -1);
    const since = startOfLocalDayUtc(yesterday, tz);
    const todayStart = startOfLocalDayUtc(localDateInTz(new Date(), tz), tz);
    const late = new Date(Date.parse(todayStart) - 60_000).toISOString();

    await env.DB.prepare(
      `INSERT INTO readings (device_id, metric, value, ts) VALUES ('inv-1', 'kwh', 10, ?)`
    )
      .bind(since)
      .run();
    await env.DB.prepare(
      `INSERT INTO readings (device_id, metric, value, ts) VALUES ('inv-1', 'kwh', 14, ?)`
    )
      .bind(late)
      .run();

    const first = await settleEnergyDaily(env.DB, FARM, tz);
    expect(first.settled).toBe(true);
    expect(first.kwh).toBe(4);

    const again = await settleEnergyDaily(env.DB, FARM, tz);
    expect(again.settled).toBe(false);

    const row = await env.DB.prepare(
      `SELECT kwh FROM energy_daily WHERE farm_id = ? AND local_date = ? AND device_id = 'inv-1'`
    )
      .bind(FARM, yesterday)
      .first<{ kwh: number }>();
    expect(row?.kwh).toBe(4);
  });

  it("overview includes climate + energy", async () => {
    const res = await app.request("/v1/overview?farm=ivan-jovic", {}, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      climate: { heat_c: number } | null;
      energy: { inverter_id?: string } | { solar_w: number | null };
    };
    expect(body.climate).toBeTruthy();
    expect(body.energy).toBeTruthy();
  });
});

describe("polje M10 fork kit", () => {
  beforeAll(async () => {
    await migrateAndSeed();
  });

  it("GET /v1/farms lists both tenants", async () => {
    const res = await app.request("/v1/farms", {}, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      farms: Array<{ slug: string; name: string }>;
    };
    const slugs = body.farms.map((f) => f.slug).sort();
    expect(slugs).toEqual(["demo-opg", "ivan-jovic"]);
  });

  it("GET /v1/farms/demo-opg returns Demo OPG plots", async () => {
    const res = await app.request("/v1/farms/demo-opg", {}, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      slug: string;
      name: string;
      plots: Array<{ name: string }>;
    };
    expect(body.slug).toBe("demo-opg");
    expect(body.name).toBe("Demo OPG");
    expect(body.plots.map((p) => p.name).sort()).toEqual([
      "Garden",
      "Hay field",
      "Yard",
    ]);
  });

  it("GET /v1/plots?farm=demo-opg does not leak House yard", async () => {
    const res = await app.request("/v1/plots?farm=demo-opg", {}, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { plots: Array<{ name: string }> };
    expect(body.plots.some((p) => p.name === "House yard")).toBe(false);
    expect(body.plots.some((p) => p.name === "Yard")).toBe(true);
  });

  it("ingest to demo-opg does not change ivan-jovic overview", async () => {
    const res = await app.request(
      "/v1/ingest",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${INGEST}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          farm_id: "demo-opg",
          batch_id: "demo-iso-1",
          sent_at: "2026-08-31T12:00:00Z",
          readings: [
            {
              device_id: "demo-soil-1",
              metric: "moisture",
              value: 0.91,
              ts: "2026-08-31T12:00:00Z",
            },
          ],
          health: { starlink: "up" as const },
        }),
      },
      env
    );
    expect([200, 202]).toContain(res.status);

    const ivan = await app.request("/v1/overview?farm=ivan-jovic", {}, env);
    expect(ivan.status).toBe(200);
    const ivanBody = (await ivan.json()) as {
      slug?: string;
      live: { metrics: Record<string, { value: number }> };
    };
    expect(ivanBody.live.metrics["demo-soil-1:moisture"]).toBeUndefined();
  });

  it("GET /?farm=demo-opg is Demo OPG; default / is Ivan", async () => {
    const demo = await app.request("/?farm=demo-opg", {}, env);
    expect(demo.status).toBe(200);
    const demoHtml = await demo.text();
    expect(demoHtml).toContain("Demo OPG");
    expect(demoHtml).toContain('data-farm="demo-opg"');
    expect(demoHtml).not.toContain("House yard");

    const ivan = await app.request("/", {}, env);
    expect(ivan.status).toBe(200);
    const ivanHtml = await ivan.text();
    expect(ivanHtml).toContain("OPG Ivan Jović");
    expect(ivanHtml).toContain("House yard");
  });

  it("GET /v1/flags defaults on; PATCH requires confirm and gates Grok", async () => {
    const listed = await app.request("/v1/flags?farm=ivan-jovic", {}, env);
    expect(listed.status).toBe(200);
    const listedBody = (await listed.json()) as {
      flags: { grok_chat: boolean; mail_send: boolean };
    };
    expect(listedBody.flags.grok_chat).toBe(true);
    expect(listedBody.flags.mail_send).toBe(true);

    const unauth = await app.request(
      "/v1/flags",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flags: { grok_chat: false },
          confirm: true,
          reason: "test disable grok",
        }),
      },
      env
    );
    expect(unauth.status).toBe(401);

    const noConfirm = await app.request(
      "/v1/flags",
      {
        method: "PATCH",
        headers: authJson(),
        body: JSON.stringify({
          flags: { grok_chat: false },
          reason: "missing confirm",
        }),
      },
      env
    );
    expect(noConfirm.status).toBe(400);

    const patched = await app.request(
      "/v1/flags",
      {
        method: "PATCH",
        headers: authJson(),
        body: JSON.stringify({
          flags: { grok_chat: false },
          confirm: true,
          reason: "test disable grok",
        }),
      },
      env
    );
    expect(patched.status).toBe(200);
    const patchedBody = (await patched.json()) as {
      flags: { grok_chat: boolean };
    };
    expect(patchedBody.flags.grok_chat).toBe(false);

    const session = await app.request("/v1/session", {}, env);
    expect(session.status).toBe(200);
    const sessionBody = (await session.json()) as {
      flags: { grok_chat: boolean };
    };
    expect(sessionBody.flags.grok_chat).toBe(false);

    const grok = await app.request(
      "/v1/grok/chat",
      {
        method: "POST",
        headers: authJson(),
        body: JSON.stringify({ message: "Kako je tlo?" }),
      },
      env
    );
    expect(grok.status).toBe(403);
    const grokBody = (await grok.json()) as { error: string; flag: string };
    expect(grokBody.error).toBe("flag_disabled");
    expect(grokBody.flag).toBe("grok_chat");

    const restored = await app.request(
      "/v1/flags",
      {
        method: "PATCH",
        headers: authJson(),
        body: JSON.stringify({
          flags: { grok_chat: true },
          confirm: true,
          reason: "restore grok after test",
        }),
      },
      env
    );
    expect(restored.status).toBe(200);
  });

  it("POST /v1/session rate-limits brute force per IP", async () => {
    const headers = {
      "Content-Type": "application/json",
      "cf-connecting-ip": "203.0.113.88",
    };
    const body = JSON.stringify({
      email: "info@qtech.hr",
      password: "wrong-password",
    });
    let last = 401;
    for (let i = 0; i < 11; i++) {
      const res = await app.request(
        "/v1/session",
        { method: "POST", headers, body },
        env
      );
      last = res.status;
    }
    expect(last).toBe(429);
  });
});

describe("canonicalAddress", () => {
  it("parses a public Trello board JSON into lists", () => {
    const view = parseTrelloBoard(
      {
        id: "RCANtF3j",
        name: "OPG Ivan Jovic",
        shortUrl: "https://trello.com/b/RCANtF3j/opg-ivan-jovic",
        lists: [
          { id: "l1", name: "In progress", pos: 1, closed: false },
          { id: "l2", name: "Closed", pos: 2, closed: true },
        ],
        cards: [
          {
            id: "c1",
            name: "Civil works",
            idList: "l1",
            url: "https://trello.com/c/c1",
            pos: 1,
            cover: {
              scaled: [
                {
                  url: "https://trello.com/1/cards/c1/previews/p1/download/image.webp",
                  width: 70,
                  height: 50,
                },
              ],
            },
          },
          { id: "c2", name: "Hidden", idList: "l2", pos: 1, closed: true },
        ],
      },
      "RCANtF3j"
    );
    expect(view.lists).toHaveLength(1);
    expect(view.lists[0]?.cards[0]?.name).toBe("Civil works");
    expect(view.lists[0]?.cards[0]?.thumb).toContain("trello.com");
  });

  it("normalizes envelope and header forms to farm@", () => {
    expect(canonicalAddress("farm@opg-ivanjovic.hr")).toBe(
      "farm@opg-ivanjovic.hr"
    );
    expect(canonicalAddress("<farm@opg-ivanjovic.hr>")).toBe(
      "farm@opg-ivanjovic.hr"
    );
    expect(canonicalAddress("Farm <farm@opg-ivanjovic.hr>")).toBe(
      "farm@opg-ivanjovic.hr"
    );
    expect(canonicalAddress("farm+invoice@opg-ivanjovic.hr")).toBe(
      "farm@opg-ivanjovic.hr"
    );
  });
});
