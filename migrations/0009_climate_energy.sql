-- M6 climate + energy: setpoints, battery heat lockout, daily solar rollup

CREATE TABLE climate_zones (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL REFERENCES farms(id),
  plot_id TEXT REFERENCES plots(id),
  name TEXT NOT NULL,
  sensor_id TEXT NOT NULL REFERENCES devices(id),
  heater_id TEXT REFERENCES devices(id),
  cooler_id TEXT REFERENCES devices(id),
  battery_id TEXT REFERENCES devices(id),
  heat_c REAL NOT NULL DEFAULT 18,
  cool_c REAL NOT NULL DEFAULT 26,
  heat_c_min REAL NOT NULL DEFAULT 5,
  heat_c_max REAL NOT NULL DEFAULT 28,
  cool_c_min REAL NOT NULL DEFAULT 10,
  cool_c_max REAL NOT NULL DEFAULT 35,
  timeout_sec INTEGER NOT NULL DEFAULT 1800,
  enabled INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX climate_zones_farm ON climate_zones(farm_id);

CREATE TABLE climate_settings (
  farm_id TEXT PRIMARY KEY REFERENCES farms(id),
  heat_battery_min_pct INTEGER NOT NULL DEFAULT 30,
  updated_at TEXT NOT NULL
);

CREATE TABLE energy_daily (
  farm_id TEXT NOT NULL REFERENCES farms(id),
  local_date TEXT NOT NULL,
  device_id TEXT NOT NULL,
  kwh REAL,
  w_peak REAL,
  settled_at TEXT NOT NULL,
  PRIMARY KEY (farm_id, local_date, device_id)
);

CREATE INDEX energy_daily_farm_date ON energy_daily(farm_id, local_date);
