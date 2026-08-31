-- M1: growth diary media metadata (objects live in R2)

CREATE TABLE growth_media (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL,
  plot_id TEXT,
  planting_id TEXT,
  r2_key TEXT NOT NULL,
  caption TEXT,
  content_type TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX growth_media_farm_ts ON growth_media(farm_id, created_at);
