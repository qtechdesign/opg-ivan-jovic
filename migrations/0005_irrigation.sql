-- M5 irrigation: drip + frost zones, runs, schedules, farm rain lockout

CREATE TABLE farm_settings (
  farm_id TEXT PRIMARY KEY REFERENCES farms(id),
  rain_lockout INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE irrigation_zones (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL REFERENCES farms(id),
  plot_id TEXT REFERENCES plots(id),
  name TEXT NOT NULL,
  kind TEXT NOT NULL,                 -- drip | frost
  device_id TEXT NOT NULL REFERENCES devices(id),
  max_duration_sec INTEGER NOT NULL DEFAULT 3600,
  default_duration_sec INTEGER NOT NULL DEFAULT 600,
  rain_lockout INTEGER NOT NULL DEFAULT 1,
  enabled INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX irrigation_zones_farm ON irrigation_zones(farm_id);

CREATE TABLE irrigation_runs (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL REFERENCES farms(id),
  zone_id TEXT NOT NULL REFERENCES irrigation_zones(id),
  started_at TEXT NOT NULL,
  ended_at TEXT,
  duration_sec INTEGER NOT NULL,
  source TEXT NOT NULL,               -- ui | schedule | api
  command_id TEXT,
  status TEXT NOT NULL,               -- sent | running | done | failed | cancelled
  water_m3 REAL,
  reason TEXT
);

CREATE INDEX irrigation_runs_zone_ts ON irrigation_runs(zone_id, started_at);
CREATE INDEX irrigation_runs_farm_ts ON irrigation_runs(farm_id, started_at);

CREATE TABLE irrigation_schedules (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL REFERENCES farms(id),
  zone_id TEXT NOT NULL REFERENCES irrigation_zones(id),
  time_local TEXT NOT NULL,           -- HH:MM
  days_json TEXT NOT NULL,            -- [0-6] Sun=0
  duration_sec INTEGER NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Europe/Zagreb',
  enabled INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX irrigation_schedules_farm ON irrigation_schedules(farm_id);
