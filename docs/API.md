# Polje HTTP API

Base: `https://opg-ivanjovic.hr` (also `www` and `*.workers.dev`).

Auth for writes: Cloudflare secrets. Browser: `/login` (email + password) → HttpOnly cookie. API clients: `Authorization: Bearer <OPERATOR_TOKEN>`. Never commit passwords.

## Session

| Method | Path | Notes |
|---|---|---|
| GET | `/login` | admin login HTML |
| GET | `/v1/session` | `{ operator: true\|false }` |
| POST | `/v1/session` | `{ email, password }` → Set-Cookie |
| DELETE | `/v1/session` | clear cookie |

## Public

| Method | Path | Notes |
|---|---|---|
| GET | `/v1/health` | liveness |
| GET | `/v1/farms` | `{ farms: [{ slug, name, timezone }] }` |
| GET | `/v1/farms/:slug` | farm + plots |
| GET | `/v1/plots?farm=ivan-jovic` | plot list |
| GET | `/v1/plantings?farm=ivan-jovic` | plantings + plot_name |
| GET | `/v1/media?farm=ivan-jovic` | growth media metadata |
| GET | `/v1/media/:id` | image bytes from R2 via Worker |
| GET | `/` | overview HTML |
| GET | `/land` | land ledger HTML (M1) |
| GET | `/eyes` | camera stills grid (M3) |
| GET | `/water` | irrigation zones + run (M5) |
| GET | `/klima` | climate + energy (M6) |
| GET | `/hands` | automations + jobs (M9) |
| GET | `/frost` | FPS frost console (M4) |
| GET | `/mail` | farm mailbox HTML |
| GET | `/ledger` | money ledger HTML (M7; amounts public, writes need admin) |
| GET | `/v1/ledger` | list entries (`farm`, `from`, `to`, `kind`, `category`, `limit`) |
| GET | `/v1/ledger/summary` | P&amp;L + monthly buckets |
| GET | `/v1/ledger/:id` | single row + `receipt_url` if present |
| GET | `/v1/mail` | message list (snippet) |
| GET | `/v1/mail/summary` | 14-day volume |
| GET | `/v1/mail/:id` | full message (attachments download still operator) |
| GET | `/v1/cameras?farm=ivan-jovic` | camera devices + last snapshot meta |
| GET | `/v1/cameras/:id/latest` | JPEG from R2 (404 if none) |
| GET | `/v1/fps/nodes?farm=` | LoRa sensors + valves + last metrics |
| GET | `/v1/fps/gateway?farm=` | gateway device + packets |
| GET | `/v1/frost/status?farm=` | `idle\|watch\|armed\|spraying` + temp/rh/dewpoint |
| GET | `/v1/iot/bus?farm=` | mqtt / edge / gateway / nvr / starlink |

HTML pages take optional `?farm=<slug>`. Default is Worker var `DEFAULT_FARM_SLUG` (`ivan-jovic` on this instance). Local seed also applies `demo-opg` (not production). See [`FORK.md`](FORK.md).

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

## FPS / frost (M4)

| Method | Path | Auth | Body / notes |
|---|---|---|---|
| GET | `/v1/fps/nodes` | no | devices with drivers `fps-sensor-node` / `fps-valve` + last readings |
| GET | `/v1/fps/gateway` | no | `fps-lora-gw` device + packet metrics |
| GET | `/v1/frost/status` | no | status, program, live temp/rh, Magnus dewpoint approx |
| GET | `/v1/iot/bus` | no | wraps local health + frost |
| POST | `/v1/fps/program` | operator | program JSON → `frost_programs` + command `fps.program.load` |
| POST | `/v1/fps/arm` | operator | `{ confirm: true, reason }` or **proposal only** → command `fps.arm` / `fps.disarm` |
| POST | `/v1/fps/valves/:id/open` | operator | `{ max_sec, reason, confirm: true }` → `fps.valve.open`; without confirm → proposal |

**Frost exception:** if Edge program is already `armed` and live temp is below threshold, Edge may spray without a second cloud confirm. Still audited. Valve timeout is always local.

See [`docs/FPS.md`](FPS.md).

## Irrigation (M5)

Drip vs frost zone kinds. Edge is write-leader (`valve.open` → MQTT `cmnd` → local timeout OFF). Without `confirm: true` the API returns a **proposal** only (no command). Rain lockout blocks **drip** only — never frost. Schedules default **disabled** in seed. Cloud Cron (`*/5`) is a backup for enabled schedules; Edge keeps a local tick when WAN is down and reports those runs via ingest when Starlink returns.

| Method | Path | Auth | Body / notes |
|---|---|---|---|
| GET | `/v1/irrigation/zones?farm=` | no | zones + last run + `rain_lockout` + idle/running |
| POST | `/v1/irrigation/zones/:id/run` | operator | `{ duration_sec (30–3600), reason, confirm? }` → proposal or `202` + command |
| POST | `/v1/irrigation/rain-lockout?farm=` | operator | `{ enabled, reason, confirm? }` |
| GET | `/v1/irrigation/schedules?farm=&enabled=` | operator or ingest | Edge polls enabled schedules |
| PUT | `/v1/irrigation/schedules/:id` | operator | enabling requires `confirm` + `reason` |
| POST | `/v1/ingest/irrigation-run` | ingest | Edge reports a local schedule fire `{ farm_id, zone_id, duration_sec, started_at, schedule_id? }` — no new command |

`GET /v1/overview` includes an `irrigation` summary. Dashboard: `/water` (Voda).

## Climate + energy (M6)

Heating/cooling setpoints for the old house. Solar now (W) and today kWh from `inv-1`. Heat lockout: do not heat if `ups-1` battery &lt; X% (default **30**). Without `confirm: true` the API returns a **proposal** only (no command, no zone write). Edge is write-leader: local heater timeout + battery lockout even if Starlink is down. Cron (`*/5`) settles yesterday’s inverter kWh into `energy_daily`.

| Method | Path | Auth | Body / notes |
|---|---|---|---|
| GET | `/v1/climate/now?farm=` | no | zones + live temp/rh/battery + `heat_blocked` |
| GET | `/v1/energy/now?farm=` | no | `solar_w`, `kwh_today`, `kwh_yesterday`, `battery_pct`, loads |
| POST | `/v1/climate/zones/:id/setpoint` | operator | `{ heat_c? (5–28), cool_c? (10–35), reason, confirm? }` → proposal or `202` + `setpoint.set` |
| POST | `/v1/climate/heat-lockout?farm=` | operator | `{ battery_min_pct (5–90), reason, confirm? }` |

Heat while battery is missing or below X → `409 heat_lockout`. `GET /v1/overview` includes `climate` + `energy`. Dashboard: `/klima` (Klima).

## Automations + jobs (M9)

Rule engine ticks inside `FarmRuntime` (DO alarm every 60s + after ingest). High-risk actions (water / heat / metal) always enqueue `proposed` until human confirm. Seed automations are **disabled**.

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/v1/automations?farm=` | no | list rules |
| POST | `/v1/automations` | operator | create; enabling medium/high needs `confirm`+`reason` |
| PUT | `/v1/automations/:id` | operator | update; disable always allowed |
| POST | `/v1/automations/:id/enable` | operator | `{ enabled, confirm?, reason? }` |
| POST | `/v1/automations/:id/fire` | operator | manual scene fire |
| GET | `/v1/jobs?farm=&status=` | operator | job queue |
| POST | `/v1/jobs` | operator | robot/AI jobs start `proposed` (scene/note → `queued`) |
| POST | `/v1/jobs/:id/confirm` | operator | `{ confirm: true, reason }` → `confirmed` |
| PATCH | `/v1/jobs/:id` | operator or ingest | `{ status: cancelled\|done\|failed\|running }` |
| POST | `/v1/commands` | operator | create; high-risk → `proposed` unless confirm |
| POST | `/v1/commands/:id/confirm` | operator | `proposed` → `sent` |

Triggers: `schedule` (cron), `metric` (`for_sec` optional dwell), `health`, `manual`.  
Actions: `snapshot.take` (low → `sent`), `notify.draft`, `job.enqueue`, `command.propose` (high → `proposed`).

MCP wrap: `propose_automation` (draft), `enable_automation` / `set_actuator` (high-risk; `confirm:true` + reason; Grok chat cannot confirm).

Dashboard: `/hands` (Ruke).

## Money (M7)

Integer **cents EUR**; `kind` is the sign. Months are UTC (`substr(ts, 1, 7)`). Operational book — not a tax filing. **GET list/summary is public.** Writes, receipt upload, and receipt bytes need operator.

| Method | Path | Notes |
|---|---|---|
| GET | `/v1/ledger` | public. `farm`, `from`, `to`, `kind`, `category`, `limit` (max 200). Newest first. |
| GET | `/v1/ledger/summary` | public. P&amp;L + monthly buckets for `from`/`to` (default current UTC year). `operating_net` = income − expense; `cash_net` = income + subsidy − expense − asset. Includes `yield_kg` sum from plantings. |
| GET | `/v1/ledger/:id` | public. Single row + `receipt_url` if present. |
| POST | `/v1/ledger` | operator. `{ farm_slug, kind, category?, amount_cents? \| amount_eur?, ts?, note? }` — audit `ledger.create` |
| PATCH | `/v1/ledger/:id` | operator. kind / category / amount / ts / note — audit `ledger.patch` |
| DELETE | `/v1/ledger/:id` | operator. Hard delete + R2 receipt — audit `ledger.delete` |
| POST | `/v1/ledger/:id/receipt` | operator. multipart `file` (JPEG/PNG/WebP/PDF ≤5 MB) → R2 `{slug}/ledger/{id}.{ext}` |
| GET | `/v1/ledger/:id/receipt` | operator. Bytes; `Cache-Control: private` |

`kind`: `expense` \| `income` \| `subsidy` \| `asset`.  
`category`: `feed` \| `seed` \| `energy` \| `repair` \| `sale` \| `eu_measure` \| `other`.

## Grok operator (M8)

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/v1/grok/chat` | operator | `{ farm_slug?, message }` → xAI `grok-4.6` with Polje tools. High-risk tools cannot be confirmed by Grok. |
| GET | `/v1/grok/briefing/today?farm=` | no | Today's HR+EN briefing or `null` |
| POST | `/v1/grok/briefing` | operator | `{ farm_slug?, force? }` regenerate today |

Worker secret `XAI_API_KEY` required for chat/briefing generation. Missing → 503 `xai_not_configured`.

Cron (`*/5`) also gates a morning briefing at **06:00 Europe/Zagreb** (idempotent per `local_date`). Optional `OPERATOR_NOTIFY_EMAIL` sends via Email Service.

Dashboard: Grok dock on `/` (Pregled).

## MCP (M8)

| Method | Path | Auth | Notes |
|---|---|---|---|
| * | `/mcp` | Bearer `AGENT_TOKEN` | Streamable HTTP MCP (Agents SDK v2). See [`docs/MCP.md`](MCP.md). |

`GET /v1/devices?farm=` and `GET /v1/devices/:id/readings` are public read helpers used by agents.