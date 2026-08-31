-- Seed Demo OPG (local + CI only). Do not apply with --remote.
-- Generic placeholder farm for forks. No family story, GPS, or real mailbox.
-- Device IDs are globally unique (devices.id is a table PK).

DELETE FROM irrigation_runs WHERE farm_id = 'a2000000-0000-4000-8000-000000000001';
DELETE FROM irrigation_schedules WHERE farm_id = 'a2000000-0000-4000-8000-000000000001';
DELETE FROM irrigation_zones WHERE farm_id = 'a2000000-0000-4000-8000-000000000001';
DELETE FROM farm_settings WHERE farm_id = 'a2000000-0000-4000-8000-000000000001';
DELETE FROM camera_snapshots WHERE farm_id = 'a2000000-0000-4000-8000-000000000001';
DELETE FROM readings WHERE device_id IN (
  'demo-soil-1', 'demo-temp-1', 'demo-edge-1',
  'demo-cam-yard', 'demo-valve-drip'
);
DELETE FROM devices WHERE farm_id = 'a2000000-0000-4000-8000-000000000001';
DELETE FROM plots WHERE farm_id = 'a2000000-0000-4000-8000-000000000001';
DELETE FROM farms WHERE id = 'a2000000-0000-4000-8000-000000000001';

INSERT INTO farms (id, slug, name, country, timezone, lat, lon, starlink_site, created_at)
VALUES (
  'a2000000-0000-4000-8000-000000000001',
  'demo-opg',
  'Demo OPG',
  'HR',
  'Europe/Zagreb',
  NULL,
  NULL,
  NULL,
  '2026-08-31T00:00:00Z'
);

INSERT INTO plots (id, farm_id, name, hectares, use_type, notes) VALUES
  ('b2000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'Yard', NULL, 'yard', NULL),
  ('b2000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000001', 'Hay field', NULL, 'hay', NULL),
  ('b2000000-0000-4000-8000-000000000003', 'a2000000-0000-4000-8000-000000000001', 'Garden', NULL, 'garden', 'Copy this seed, then rename plots for your land.');

INSERT INTO devices (id, farm_id, kind, driver, name, zone, protocol, address, config_json, last_seen) VALUES
  ('demo-soil-1', 'a2000000-0000-4000-8000-000000000001', 'sensor', 'mqtt-generic', 'Garden soil moisture', 'Garden', 'mqtt', 'polje/demo-opg/dev/demo-soil-1/stat', NULL, NULL),
  ('demo-temp-1', 'a2000000-0000-4000-8000-000000000001', 'sensor', 'mqtt-generic', 'Yard air temp', 'Yard', 'mqtt', 'polje/demo-opg/dev/demo-temp-1/stat', NULL, NULL),
  ('demo-edge-1', 'a2000000-0000-4000-8000-000000000001', 'gateway', 'mqtt-generic', 'Polje Edge', NULL, 'mqtt', 'polje/demo-opg/sys/edge/health', NULL, NULL),
  ('demo-cam-yard', 'a2000000-0000-4000-8000-000000000001', 'camera', 'rtsp', 'Yard camera', 'Yard', 'rtsp', 'env:CAMERA_YARD_RTSP', '{"go2rtc_src":"demo-cam-yard"}', NULL),
  ('demo-valve-drip', 'a2000000-0000-4000-8000-000000000001', 'actuator', 'mqtt-generic', 'Garden drip valve', 'Garden', 'mqtt', 'polje/demo-opg/dev/demo-valve-drip/cmnd', NULL, NULL);

INSERT INTO farm_settings (farm_id, rain_lockout, updated_at)
VALUES ('a2000000-0000-4000-8000-000000000001', 0, '2026-08-31T00:00:00Z');

INSERT INTO irrigation_zones (id, farm_id, plot_id, name, kind, device_id, max_duration_sec, default_duration_sec, rain_lockout, enabled) VALUES
  ('d2000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000003', 'Garden drip', 'drip', 'demo-valve-drip', 3600, 600, 1, 1);

-- Schedules disabled (no high-risk automations in seed)
INSERT INTO irrigation_schedules (id, farm_id, zone_id, time_local, days_json, duration_sec, timezone, enabled) VALUES
  ('e2000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000001', '06:00', '[1,2,3,4,5,6,0]', 600, 'Europe/Zagreb', 0);
