# Polje HTTP API

Base: `https://opg-ivanjovic.hr` (also `www` and `*.workers.dev`).

Auth for writes: `Authorization: Bearer <OPERATOR_TOKEN>` (Cloudflare secret).

## Public

| Method | Path | Notes |
|---|---|---|
| GET | `/v1/health` | liveness |
| GET | `/v1/farms/:slug` | farm + plots |
| GET | `/v1/plots?farm=ivan-jovic` | plot list |
| GET | `/v1/plantings?farm=ivan-jovic` | plantings + plot_name |
| GET | `/v1/media?farm=ivan-jovic` | growth media metadata |
| GET | `/v1/media/:id` | image bytes from R2 via Worker |
| GET | `/` | overview HTML |
| GET | `/land` | land ledger HTML (M1) |

## Operator (Bearer)

| Method | Path | Body |
|---|---|---|
| POST | `/v1/plots` | `{ farm_slug, name, hectares?, use_type?, notes? }` |
| POST | `/v1/plantings` | `{ plot_id, crop, variety?, planted_on?, stage?, … }` |
| PATCH | `/v1/plantings/:id` | `{ stage?, yield_kg?, crop?, … }` |
| POST | `/v1/media` | multipart: `file`, optional `plot_id`, `planting_id`, `caption`, `farm_slug` |
| GET | `/v1/audit?farm=ivan-jovic&limit=50` | recent audit rows |

## Edge ingest (M2)

| Method | Path | Auth | Body |
|---|---|---|---|
| POST | `/v1/ingest` | Bearer `INGEST_TOKEN` | `{ farm_id, batch_id, sent_at, readings[], health? }` → Queue → FarmRuntime DO |
| GET | `/v1/overview?farm=ivan-jovic` | no | farm + live DO snapshot |
| GET | `/v1/local/health?farm=ivan-jovic` | no | starlink / edge / last_ingest |
| WS | `/v1/live?farm=ivan-jovic` | no | live metric events from DO |

Idempotent on `batch_id` (24h). See `docs/IOT.md` and `docs/LOCAL-SERVERS.md`.

Every write inserts an `audit` row (`user:operator` or `edge`).

JPEG / PNG / WebP only, max 5 MB. R2 key: `{slug}/growth/{uuid}.{ext}`.
