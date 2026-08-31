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

Every write inserts an `audit` row (`user:operator`).

JPEG / PNG / WebP only, max 5 MB. R2 key: `{slug}/growth/{uuid}.{ext}`.
