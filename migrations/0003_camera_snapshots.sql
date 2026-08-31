-- M3: latest camera snapshot metadata (JPEG bytes live in R2)

CREATE TABLE camera_snapshots (
  camera_id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'image/jpeg',
  source TEXT NOT NULL,
  captured_at TEXT NOT NULL
);

CREATE INDEX camera_snapshots_farm ON camera_snapshots(farm_id);
