-- Plan board: todos + procurement lines under build_phases (time + EUR cents).
-- Viewing is public. Task writes need operator. Orders that commit money need confirm.

CREATE TABLE plan_tasks (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL REFERENCES farms(id),
  phase_id TEXT,
  title TEXT NOT NULL,
  body TEXT,
  status TEXT NOT NULL DEFAULT 'todo',
  due_on TEXT,
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX plan_tasks_farm_status ON plan_tasks(farm_id, status, due_on);
CREATE INDEX plan_tasks_phase ON plan_tasks(phase_id);

CREATE TABLE plan_orders (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL REFERENCES farms(id),
  phase_id TEXT,
  task_id TEXT,
  title TEXT NOT NULL,
  vendor TEXT,
  url TEXT,
  qty REAL NOT NULL DEFAULT 1,
  unit_cents INTEGER NOT NULL DEFAULT 0,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'EUR',
  status TEXT NOT NULL DEFAULT 'research',
  due_on TEXT,
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'ui',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX plan_orders_farm_status ON plan_orders(farm_id, status, due_on);
CREATE INDEX plan_orders_phase ON plan_orders(phase_id);
