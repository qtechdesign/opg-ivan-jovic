# Local servers (M2–M3)

Farm LAN boxes. Starlink is uplink only.

## Compose

```bash
cd deploy/edge
cp .env.example .env   # set INGEST_TOKEN; leave CAMERA_*_RTSP empty for placeholders
docker compose up -d mosquitto go2rtc edge
docker compose --profile sim up -d sim         # fake soil/temp
docker compose --profile cameras up -d nvr     # Frigate template (optional)
```

- `mosquitto` — `mqtt.farm.lan:1883` (host 1883)
- `go2rtc` — LAN `:1984` (frame JPEG API; streams from env via `scripts/render-go2rtc-config.sh`)
- `edge` — MQTT → outbox → `/v1/ingest` + camera grabber → `/v1/ingest/media`
- `sim` — MQTT simulator (profile `sim`)
- `nvr` — Frigate stub (profile `cameras`)

Edge metrics: `http://localhost:8788/` (includes `nvr` status).

Local stills: `/var/lib/polje/cameras/{cam-id}/latest.jpg`.

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

Outbox DB: `/var/lib/polje/edge.db` (volume `edge-data`).

See also `docs/STARLINK.md`.
