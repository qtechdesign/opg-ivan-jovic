# Local servers (M2–M6)

Farm LAN boxes. Starlink is uplink only.

## Compose (edge box)

```bash
cd deploy/edge
cp .env.example .env   # set INGEST_TOKEN; leave CAMERA_*_RTSP empty for placeholders
docker compose up -d mosquitto go2rtc edge
docker compose --profile sim up -d sim         # fake soil/temp + valve echo
docker compose --profile cameras up -d nvr     # Frigate template (optional)
```

- `mosquitto` — `mqtt.farm.lan:1883` (host 1883)
- `go2rtc` — LAN `:1984` (frame JPEG API; streams from env via `scripts/render-go2rtc-config.sh`)
- `edge` — MQTT → outbox → `/v1/ingest` + camera grabber + **irrigation actuators** + **climate failsafe** (poll `setpoint.set`, heater timeout, battery lockout)
- `sim` — MQTT simulator (profile `sim`) — sensors + valve `cmnd` → `stat` echo
- `nvr` — Frigate stub (profile `cameras`)

Edge metrics: `http://localhost:8788/` (includes `nvr`, `actuators`, outbox).

Local stills: `/var/lib/polje/cameras/{cam-id}/latest.jpg`.

## Irrigation failsafe

- Boot / MQTT reconnect: all known irrigation valves published **OFF**
- Every `valve.open` carries `timeout_sec`; Edge `setTimeout` turns OFF even if WAN dies
- Schedules: Edge caches enabled schedules in SQLite and ticks locally (write-leader). Cloud Cron (`*/5`) is backup only. Offline fires POST `/v1/ingest/irrigation-run` when WAN returns.

## Climate failsafe (M6)

- Cached setpoints from `setpoint.set` / `GET /v1/climate/now`
- Heater `cmnd` `{ state: "ON"|"OFF", timeout_sec }` — Edge turns OFF on local timeout or if `ups-1` `battery_pct` &lt; X (default 30)
- WAN hold: keep last setpoints for `CLIMATE_WAN_HOLD_MS` (default 15 min) when Starlink is down
- Cloud Cron settles yesterday `inv-1` kWh into `energy_daily`

## LoRa gateway (optional)

```bash
cd deploy/gateway
cp .env.example .env
# Prefer bare-metal on Pi: python3 polje_main.py (see docs/FPS.md)
docker compose --profile radio up -d   # MQTT smoke only without serial
```

Without radio hardware, **skip** gateway — Edge sim is enough for drip M5.

## Env

| Var | Meaning |
|---|---|
| `INGEST_TOKEN` | Same as Cloudflare `wrangler secret put INGEST_TOKEN` |
| `POLJE_API` | Worker base URL |
| `FARM_ID` | `ivan-jovic` |
| `MQTT_URL` | `mqtt://mosquitto:1883` in compose |
| `SNAPSHOT_INTERVAL_SEC` | default `600` |
| `CLIMATE_WAN_HOLD_MS` | default 15 min — keep last climate setpoints when WAN is down |
| `GO2RTC_URL` | `http://go2rtc:1984` |
| `CAMERA_YARD_RTSP` etc. | optional; empty → OFFLINE placeholder JPEG |
| `FROST_SIM` | `1` on sim for cold-night sequence (M4) |

Outbox DB: `/var/lib/polje/edge.db` (volume `edge-data`).

See also `docs/STARLINK.md`, `docs/IOT.md`, `docs/FPS.md`.
