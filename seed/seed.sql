-- Seed OPG Ivan Jović (idempotent-ish: delete + insert by known IDs)
-- Do not invent hectares / GPS — fill when measured on the land.

DELETE FROM readings WHERE device_id IN ('soil-n-1', 'temp-yard-1', 'edge-1');
DELETE FROM devices WHERE farm_id = 'a1000000-0000-4000-8000-000000000001';
DELETE FROM plots WHERE farm_id = 'a1000000-0000-4000-8000-000000000001';
DELETE FROM farms WHERE id = 'a1000000-0000-4000-8000-000000000001';

INSERT INTO farms (id, slug, name, country, timezone, lat, lon, starlink_site, created_at)
VALUES (
  'a1000000-0000-4000-8000-000000000001',
  'ivan-jovic',
  'OPG Ivan Jović',
  'HR',
  'Europe/Zagreb',
  NULL,
  NULL,
  NULL,
  '2026-08-31T00:00:00Z'
);

INSERT INTO plots (id, farm_id, name, hectares, use_type, notes) VALUES
  ('b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'House yard', NULL, 'yard', NULL),
  ('b1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'Hay field', NULL, 'hay', NULL),
  ('b1000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000001', 'Pasture', NULL, 'pasture', NULL),
  ('b1000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000001', 'Garden', NULL, 'garden', 'Zones later: Garden drip (drip), Hay/orchard frost line (frost), Old house climate (climate)');

-- M2 stub devices for MQTT simulator (no GPS / secrets)
INSERT INTO devices (id, farm_id, kind, driver, name, zone, protocol, address, config_json, last_seen) VALUES
  ('soil-n-1', 'a1000000-0000-4000-8000-000000000001', 'sensor', 'mqtt-generic', 'Garden soil moisture', 'Garden', 'mqtt', 'polje/ivan-jovic/dev/soil-n-1/stat', NULL, NULL),
  ('temp-yard-1', 'a1000000-0000-4000-8000-000000000001', 'sensor', 'mqtt-generic', 'Yard air temp', 'House yard', 'mqtt', 'polje/ivan-jovic/dev/temp-yard-1/stat', NULL, NULL),
  ('edge-1', 'a1000000-0000-4000-8000-000000000001', 'gateway', 'mqtt-generic', 'Polje Edge', NULL, 'mqtt', 'polje/ivan-jovic/sys/edge/health', NULL, NULL);
