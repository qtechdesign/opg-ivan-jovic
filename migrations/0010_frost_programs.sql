-- M4: frost program ledger (frost_events already in 0001_init)

CREATE TABLE IF NOT EXISTS frost_programs (
  farm_id TEXT PRIMARY KEY REFERENCES farms(id),
  program_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'idle',
  updated_at TEXT NOT NULL,
  updated_by TEXT
);
