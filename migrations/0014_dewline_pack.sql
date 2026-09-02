-- M5 Dewline pack: pump capacity + optional per-zone flow / valve box.
ALTER TABLE farm_settings ADD COLUMN main_flow_m3h REAL NOT NULL DEFAULT 8;
ALTER TABLE farm_settings ADD COLUMN cycles_per_day INTEGER NOT NULL DEFAULT 1;
ALTER TABLE farm_settings ADD COLUMN well_rate_m3h REAL NOT NULL DEFAULT 0;
ALTER TABLE farm_settings ADD COLUMN water_price_cents INTEGER NOT NULL DEFAULT 240;

ALTER TABLE irrigation_zones ADD COLUMN flow_m3h REAL;
ALTER TABLE irrigation_zones ADD COLUMN valve_box TEXT;
