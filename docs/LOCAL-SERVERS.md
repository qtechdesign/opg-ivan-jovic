# Local servers (M2–M5)

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
- `edge` — MQTT → outbox → `/v1/ingest` + camera grabber + **irrigation actuators** (poll `valve.open`, local timeout OFF, schedule tick)
- `sim` — MQTT simulator (profile `sim`) — sensors + valve `cmnd` → `stat` echo
- `nvr` — Frigate stub (profile `cameras`)

Edge metrics: `http://localhost:8788/` (includes `nvr`, `actuators`, outbox).

Local stills: `/var/lib/polje/cameras/{cam-id}/latest.jpg`.

## Irrigation failsafe

- Boot / MQTT reconnect: all known irrigation valves published **OFF**
- Every `valve.open` carries `timeout_sec`; Edge `setTimeout` turns OFF even if WAN dies
- Schedules: Edge caches enabled schedules; local tick when Starlink is down; cloud Cron (`*/5`) is backup only

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
| `GO2RTC_URL` | `http://go2rtc:1984` |
| `CAMERA_YARD_RTSP` etc. | optional; empty → OFFLINE placeholder JPEG |
| `FROST_SIM` | `1` on sim for cold-night sequence (M4) |

Outbox DB: `/var/lib/polje/edge.db` (volume `edge-data`).

See also `docs/STARLINK.md`, `docs/IOT.md`, `docs/FPS.md`.
