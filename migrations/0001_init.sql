-- M0 schema: Polje D1 ledger (bible §7)
-- UUIDs as TEXT. Timestamps UTC ISO-8601. Money in integer cents EUR.

CREATE TABLE farms (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'HR',
  timezone TEXT NOT NULL DEFAULT 'Europe/Zagreb',
  lat REAL,
  lon REAL,
  starlink_site TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE plots (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL REFERENCES farms(id),
  name TEXT NOT NULL,
  hectares REAL,
  use_type TEXT,
  notes TEXT
);

CREATE TABLE plantings (
  id TEXT PRIMARY KEY,
  plot_id TEXT NOT NULL REFERENCES plots(id),
  crop TEXT NOT NULL,
  variety TEXT,
  planted_on TEXT,
  stage TEXT,
  expected_harvest TEXT,
  yield_kg REAL
);

CREATE TABLE animals (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL REFERENCES farms(id),
  species TEXT,
  tag TEXT,
  count INTEGER,
  notes TEXT
);

CREATE TABLE devices (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL REFERENCES farms(id),
  kind TEXT NOT NULL,
  driver TEXT NOT NULL,
  name TEXT NOT NULL,
  zone TEXT,
  protocol TEXT,
  address TEXT,
  config_json TEXT,
  last_seen TEXT
);

CREATE TABLE readings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL REFERENCES devices(id),
  metric TEXT NOT NULL,
  value REAL NOT NULL,
  ts TEXT NOT NULL
);
CREATE INDEX readings_device_ts ON readings(device_id, ts);

CREATE TABLE commands (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL REFERENCES farms(id),
  device_id TEXT NOT NULL,
  action TEXT NOT NULL,
  payload_json TEXT,
  source TEXT NOT NULL,
  status TEXT NOT NULL,
  confirmed_by TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE automations (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL REFERENCES farms(id),
  name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  trigger_json TEXT NOT NULL,
  action_json TEXT NOT NULL
);

CREATE TABLE ledger (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL REFERENCES farms(id),
  ts TEXT NOT NULL,
  kind TEXT NOT NULL,
  category TEXT,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  note TEXT,
  r2_key TEXT
);

CREATE TABLE audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  farm_id TEXT NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  entity TEXT,
  before_json TEXT,
  after_json TEXT,
  ts TEXT NOT NULL
);

CREATE TABLE frost_events (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL REFERENCES farms(id),
  started_at TEXT NOT NULL,
  ended_at TEXT,
  min_temp_c REAL,
  mode TEXT,
  water_m3 REAL,
  notes TEXT
);
