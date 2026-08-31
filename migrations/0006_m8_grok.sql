-- M8 MCP + Grok: daily briefings + planting notes for agents

CREATE TABLE briefings (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL REFERENCES farms(id),
  local_date TEXT NOT NULL,
  body_hr TEXT NOT NULL,
  body_en TEXT NOT NULL,
  r2_key TEXT,
  model TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (farm_id, local_date)
);

CREATE INDEX briefings_farm_date ON briefings(farm_id, local_date);

CREATE TABLE planting_notes (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL REFERENCES farms(id),
  planting_id TEXT NOT NULL REFERENCES plantings(id),
  body TEXT NOT NULL,
  actor TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX planting_notes_planting ON planting_notes(planting_id, created_at);
CREATE INDEX planting_notes_farm ON planting_notes(farm_id, created_at);
