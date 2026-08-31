-- M9 automations + robot/job queue
-- Extend M0 automations table; add jobs + run history.

ALTER TABLE automations ADD COLUMN risk TEXT NOT NULL DEFAULT 'medium';
ALTER TABLE automations ADD COLUMN cooldown_sec INTEGER NOT NULL DEFAULT 300;
ALTER TABLE automations ADD COLUMN last_fired_at TEXT;
ALTER TABLE automations ADD COLUMN last_error TEXT;
ALTER TABLE automations ADD COLUMN created_at TEXT;

CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL REFERENCES farms(id),
  kind TEXT NOT NULL,                 -- robot.mow | robot.inspect | ai.build | scene | note
  status TEXT NOT NULL,               -- proposed | queued | confirmed | running | done | failed | cancelled
  payload_json TEXT,
  source TEXT NOT NULL,               -- ui | schedule | api | automation
  confirmed_by TEXT,
  reason TEXT,
  automation_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX jobs_farm_status ON jobs(farm_id, status, created_at);
CREATE INDEX jobs_farm_ts ON jobs(farm_id, created_at);

CREATE TABLE automation_runs (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL REFERENCES farms(id),
  automation_id TEXT NOT NULL REFERENCES automations(id),
  fired_at TEXT NOT NULL,
  trigger_match_json TEXT,
  result_json TEXT,
  ok INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX automation_runs_farm_ts ON automation_runs(farm_id, fired_at);
CREATE INDEX automation_runs_auto_ts ON automation_runs(automation_id, fired_at);
