-- Canonical first-tenant seed lives in seed/opg-ivan-jovic.sql
-- Local also applies seed/demo-opg.sql (never remote). See docs/FORK.md.
-- This file mirrors opg-ivan-jovic.sql so older docs that mention seed/seed.sql still work.

-- Seed OPG Ivan Jović (idempotent-ish: delete + insert by known IDs)
-- Do not invent hectares / GPS — fill when measured on the land.
-- Never put RTSP URLs here — use deploy/edge/.env CAMERA_*_RTSP.

DELETE FROM irrigation_runs WHERE farm_id = 'a1000000-0000-4000-8000-000000000001';
DELETE FROM irrigation_schedules WHERE farm_id = 'a1000000-0000-4000-8000-000000000001';
DELETE FROM irrigation_zones WHERE farm_id = 'a1000000-0000-4000-8000-000000000001';
DELETE FROM farm_settings WHERE farm_id = 'a1000000-0000-4000-8000-000000000001';
DELETE FROM automation_runs WHERE farm_id = 'a1000000-0000-4000-8000-000000000001';
DELETE FROM jobs WHERE farm_id = 'a1000000-0000-4000-8000-000000000001';
DELETE FROM automations WHERE farm_id = 'a1000000-0000-4000-8000-000000000001';
DELETE FROM camera_snapshots WHERE farm_id = 'a1000000-0000-4000-8000-000000000001';
DELETE FROM readings WHERE device_id IN (
  'soil-n-1', 'temp-yard-1', 'edge-1',
  'cam-yard', 'cam-garden', 'cam-hay',
  'valve-garden-drip', 'valve-hay-frost',
  'fps-gw-1', 'fps-sn-1', 'fps-valve-1'
);
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
  ('b1000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000001', 'Garden', NULL, 'garden', 'Zones: Garden drip (drip), Hay/orchard frost line (frost). Climate → M6.');

-- M2 sensors + M3 cameras + M5 irrigation valves + M4 FPS stubs
INSERT INTO devices (id, farm_id, kind, driver, name, zone, protocol, address, config_json, last_seen) VALUES
  ('soil-n-1', 'a1000000-0000-4000-8000-000000000001', 'sensor', 'mqtt-generic', 'Garden soil moisture', 'Garden', 'mqtt', 'polje/ivan-jovic/dev/soil-n-1/stat', NULL, NULL),
  ('temp-yard-1', 'a1000000-0000-4000-8000-000000000001', 'sensor', 'mqtt-generic', 'Yard air temp', 'House yard', 'mqtt', 'polje/ivan-jovic/dev/temp-yard-1/stat', NULL, NULL),
  ('edge-1', 'a1000000-0000-4000-8000-000000000001', 'gateway', 'mqtt-generic', 'Polje Edge', NULL, 'mqtt', 'polje/ivan-jovic/sys/edge/health', NULL, NULL),
  ('cam-yard', 'a1000000-0000-4000-8000-000000000001', 'camera', 'rtsp', 'Yard camera', 'House yard', 'rtsp', 'env:CAMERA_YARD_RTSP', '{"go2rtc_src":"cam-yard"}', NULL),
  ('cam-garden', 'a1000000-0000-4000-8000-000000000001', 'camera', 'rtsp', 'Garden camera', 'Garden', 'rtsp', 'env:CAMERA_GARDEN_RTSP', '{"go2rtc_src":"cam-garden"}', NULL),
  ('cam-hay', 'a1000000-0000-4000-8000-000000000001', 'camera', 'rtsp', 'Hay field camera', 'Hay field', 'rtsp', 'env:CAMERA_HAY_RTSP', '{"go2rtc_src":"cam-hay"}', NULL),
  ('valve-garden-drip', 'a1000000-0000-4000-8000-000000000001', 'actuator', 'mqtt-generic', 'Garden drip valve', 'Garden', 'mqtt', 'polje/ivan-jovic/dev/valve-garden-drip/cmnd', NULL, NULL),
  ('valve-hay-frost', 'a1000000-0000-4000-8000-000000000001', 'actuator', 'mqtt-generic', 'Hay frost spray valve', 'Hay field', 'mqtt', 'polje/ivan-jovic/dev/valve-hay-frost/cmnd', NULL, NULL),
  ('fps-gw-1', 'a1000000-0000-4000-8000-000000000001', 'gateway', 'fps-lora-gw', 'FPS LoRa gateway', NULL, 'lora', 'polje/ivan-jovic/gw/fps-gw-1/health', NULL, NULL),
  ('fps-sn-1', 'a1000000-0000-4000-8000-000000000001', 'lora-node', 'fps-sensor-node', 'FPS hay sensor', 'Hay field', 'lora', 'polje/ivan-jovic/fps/fps-sn-1/stat', NULL, NULL),
  ('fps-valve-1', 'a1000000-0000-4000-8000-000000000001', 'actuator', 'fps-valve', 'FPS frost valve', 'Hay field', 'lora', 'polje/ivan-jovic/dev/fps-valve-1/cmnd', '{"timeout_sec":600}', NULL);

INSERT INTO farm_settings (farm_id, rain_lockout, updated_at)
VALUES ('a1000000-0000-4000-8000-000000000001', 0, '2026-08-31T00:00:00Z');

INSERT INTO irrigation_zones (id, farm_id, plot_id, name, kind, device_id, max_duration_sec, default_duration_sec, rain_lockout, enabled) VALUES
  ('d1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000004', 'Garden drip', 'drip', 'valve-garden-drip', 3600, 600, 1, 1),
  ('d1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000002', 'Hay / orchard frost line', 'frost', 'valve-hay-frost', 3600, 900, 0, 1);

-- Schedules disabled by default (no high-risk automations in seed)
INSERT INTO irrigation_schedules (id, farm_id, zone_id, time_local, days_json, duration_sec, timezone, enabled) VALUES
  ('e1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', '06:00', '[1,2,3,4,5,6,0]', 600, 'Europe/Zagreb', 0);

-- M9 example automations: always disabled in seed
INSERT INTO automations (id, farm_id, name, enabled, risk, trigger_json, action_json, cooldown_sec, last_fired_at, last_error, created_at) VALUES
  (
    'f1000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000001',
    'Garden soil low → propose drip',
    0,
    'high',
    '{"type":"metric","device_id":"soil-n-1","metric":"moisture","op":"lt","value":0.25}',
    '{"type":"command.propose","device_id":"valve-garden-drip","action":"irrigation.run","payload":{"duration_sec":600}}',
    3600,
    NULL,
    NULL,
    '2026-08-31T00:00:00Z'
  ),
  (
    'f1000000-0000-4000-8000-000000000002',
    'a1000000-0000-4000-8000-000000000001',
    'Starlink down → yard snapshot',
    0,
    'low',
    '{"type":"health","field":"starlink","equals":"down"}',
    '{"type":"snapshot.take","camera_id":"cam-yard"}',
    900,
    NULL,
    NULL,
    '2026-08-31T00:00:00Z'
  );
