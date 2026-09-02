-- M5: rainwater accumulation (pond) design params. Fill % later from sensors.
CREATE TABLE water_works (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL REFERENCES farms(id),
  plot_id TEXT NOT NULL REFERENCES plots(id),
  kind TEXT NOT NULL DEFAULT 'pond',
  depth_m REAL NOT NULL DEFAULT 2.2,
  bank_slope REAL NOT NULL DEFAULT 2.5,
  catchment_factor REAL NOT NULL DEFAULT 4,
  fill_pct REAL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX water_works_plot ON water_works(plot_id);
CREATE INDEX water_works_farm ON water_works(farm_id);
