-- Public build / procurement phases (time + EUR cents). Viewing is open; writes need confirm.

CREATE TABLE build_phases (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL REFERENCES farms(id),
  title TEXT NOT NULL,
  body TEXT,
  starts_on TEXT,
  ends_on TEXT,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'EUR',
  status TEXT NOT NULL DEFAULT 'planned',
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX build_phases_farm_sort ON build_phases(farm_id, sort);
