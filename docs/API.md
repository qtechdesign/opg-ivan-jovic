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
| GET | `/eyes` | camera stills grid (M3) |
| GET | `/v1/cameras?farm=ivan-jovic` | camera devices + last snapshot meta |
| GET | `/v1/cameras/:id/latest` | JPEG from R2 (404 if none) |

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

## Cameras (M3)

| Method | Path | Auth | Body / notes |
|---|---|---|---|
| POST | `/v1/ingest/media` | Bearer `INGEST_TOKEN` | multipart: `file` (JPEG ≤2MB), `camera_id`, `source` (`rtsp`\|`placeholder`), `farm_slug` → R2 `{slug}/cameras/{id}/latest.jpg` + upsert `camera_snapshots` |
| POST | `/v1/cameras/:id/snapshot` | operator | queue `snapshot.take` command (`sent`); Edge polls |
| GET | `/v1/commands?farm=&status=sent&action=snapshot.take` | operator or ingest | Edge command poll |
| PATCH | `/v1/commands/:id` | operator or ingest | `{ status: "acked"\|"failed"\|"cancelled" }` |

No `/v1/stream/:id` in M3. See `docs/STARLINK.md`.

Every write inserts an `audit` row (`user:operator` or `edge`).

JPEG / PNG / WebP only, max 5 MB. R2 key: `{slug}/growth/{uuid}.{ext}`.
