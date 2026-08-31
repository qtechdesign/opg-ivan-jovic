-- M7: index for farm ledger queries by time
CREATE INDEX IF NOT EXISTS ledger_farm_ts ON ledger(farm_id, ts);
