-- M1: many OPG locations (Sarampovo, another field, …). Plots sit in one holding.
CREATE TABLE holdings (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL,
  name TEXT NOT NULL,
  notes TEXT,
  geom_json TEXT,
  hectares REAL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_holdings_farm ON holdings (farm_id);
ALTER TABLE plots ADD COLUMN holding_id TEXT;
