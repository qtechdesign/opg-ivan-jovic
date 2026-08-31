# Local servers (M2)

Farm LAN boxes. Starlink is uplink only.

## Compose

```bash
cd deploy/edge
export INGEST_TOKEN=your-cloudflare-ingest-token
export POLJE_API=https://opg-ivanjovic.hr
docker compose up -d mosquitto edge
docker compose --profile sim up -d sim   # fake soil/temp
```

- `mosquitto` — `mqtt.farm.lan:1883` (mapped to host 1883)
- `edge` — Polje Edge (MQTT → SQLite outbox → `POST /v1/ingest`)
- `sim` — MQTT simulator (profile `sim`)
- `nvr` — Frigate stub (profile `cameras`, M3)

Edge metrics: `http://localhost:8788/`

## Env

| Var | Meaning |
|---|---|
| `INGEST_TOKEN` | Same as Cloudflare `wrangler secret put INGEST_TOKEN` |
| `POLJE_API` | Worker base URL |
| `FARM_ID` | `ivan-jovic` |
| `MQTT_URL` | `mqtt://mosquitto:1883` in compose |

Outbox DB: `/var/lib/polje/edge.db` (volume `edge-data`).
