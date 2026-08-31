# OPG Ivan Jović — Farm OS (Polje)

> Public project bible for Cursor + Grok.
> First instance: **OPG Ivan Jović**. Open platform so other family farms can fork the same roadmap.

**Status:** v0 — start building  
**Runtime:** Cloudflare Workers + on-farm local servers  
**Brain:** xAI Grok API (`grok-4.6` for ops / Grok Build for coding)  
**Repo target:** public GitHub  
**Connectivity:** Starlink uplink + private LoRa / LAN on the field  
**Hardware lineage:** fork of **FPS | Frost Protection System** — [`qtechdesign/qtech`](https://github.com/qtechdesign/qtech) (MIT)  

---

## 1. Why this exists

The land is older than the software.

House from **1923**. Birth house of grandmother **Katica**. Family of four daughters. Father **Vinko**, mother **Jana**. Cows, hayfields, work from first light. School was rare — only Katica went; the other sisters stayed because the land needed hands. The farm sat unused for ~30 years.

This platform is the next chapter of that same ground:

- rebuild and run **OPG Ivan Jović** as a living family agricultural holding
- control growth, water, frost, climate, energy, cameras, money, and robots from one system
- run IoT and automations on **local farm servers** first; Cloudflare is the public brain and the off-site ledger
- grow the existing **Qtech FPS** stack in this repo (fork + continue), do not rewrite it from scratch
- expose a clean **HTTP API + MCP** so Grok (and other agents) can operate the farm
- publish the roadmap so another OPG can clone it instead of starting from zero

**OPG** (Obiteljsko poljoprivredno gospodarstvo) is the Croatian legal form for a family farm: agriculture plus related side activities, built on family land, labour, and knowledge. This software must respect that — it is an operating system for a family holding, not a generic IoT toy.

Platform name in code: **Polje** (`polje` = field).

---

## 2. Product promise

One control plane for the farm:

| Domain | What the platform does |
|---|---|
| Growth | plots, crops, livestock, stages, yields, photos, notes |
| Water | irrigation zones, schedules, soil moisture, rain lockout, Dewline-style packing of lines into pump capacity |
| Frost (FPS) | LoRa multisensor nodes, valve controllers, PIP 2.0 spray, 100% RH / ice-layer frost nights |
| Climate | greenhouse / store / house heating + cooling setpoints |
| Energy | solar + MPPT (FPS boards), battery, loads, Starlink power budget |
| Eyes | cameras, local NVR, live snapshot/stream, event clips |
| Hands | automations, scenes, robot/job queue, local MQTT / Node-RED |
| IoT fabric | LoRa field net + Wi-Fi/Ethernet LAN + MQTT + optional Home Assistant |
| Local servers | Polje Edge, MQTT broker, LoRa gateway, NVR, local DB — farm works if Starlink dies |
| Money | invoices, costs, subsidies, yield vs spend |
| Brain | Grok operator that reads state and proposes / executes actions |
| Open | public API + MCP so Cursor, Grok Bot, and other farms can plug in |

**Rule:** the cloud is the brain and the ledger. The field edge is the muscle and the failsafe. If Starlink or Cloudflare dies, pumps and heaters must not run wild. Local controllers keep last-known-safe state.

---

## 3. Non-negotiables

1. **Local failsafe first.** Every actuator (valve, heater, cooler, feeder) has a local timeout and a safe default (usually OFF / last-safe). Cloud cannot be the only safety layer.
2. **Confirm dangerous writes.** Irrigation longer than X minutes, heat above Y °C, any pump/heater ON from an agent → requires `confirm: true` + audit log. Grok can *propose*; humans or a signed policy *commit*.
3. **Every action is an event.** Who / what / why / before / after. Agents included.
4. **EUR + Croatian context.** Currency EUR. Dates ISO-8601. Optional HR labels in UI. Do not invent legal advice; keep a `compliance/` folder for OPG notes.
5. **Public by default, secrets never.** Code, schemas, MCP, roadmap, live camera stills, and the operating cash-flow book = public. Tokens, RTSP URLs, exact GPS of private cameras, bank credentials = private.
6. **Starlink-aware.** Assume intermittent rural uplink. Buffer telemetry on-edge. Prefer small JSON over fat video. Snapshots first, streams second.
7. **Local servers are first-class.** MQTT, LoRa gateway, FPS valve logic, camera NVR and irrigation schedules must run on-farm. Cloud is sync + brain + remote access, not the only runtime.
8. **Qtech / FPS is a living fork.** [`qtechdesign/qtech`](https://github.com/qtechdesign/qtech) lands in `forks/qtech` and **stays**. The Qtech server, gateway, firmware and apps are extended and modified as OPG Ivan Jović grows — new plots, new valves, new sensors, new cloud bindings. Do not freeze FPS as a museum copy.
9. **Buy now, build when money allows.** Ship the farm with out-of-the-box IoT that still obeys rule 11 (Shelly *local* API / Tasmota, RTSP cameras, MQTT, Frigate, cheap soil probes, inverters with Modbus/SunSpec). Custom FPS hardware, firmware and the Qtech server get the next engineering hours **when cashflow and EU/OPG measures allow**. Polje must treat OTS devices and FPS devices as equal citizens behind `DeviceDriver`.
10. **One farm, many zones.** First tenant is OPG Ivan Jović. Schema must still support `farm_id` so forks work.
11. **Own the stack. Linux first. Open or API-local.** Every piece of equipment we buy or build must be **open source**, **or** controllable through a documented **local API / protocol** we can call from Linux without a vendor app and without a mandatory vendor cloud. The farm must stay fully controllable as it grows. If a box only works through a closed phone app or a rented cloud, it does not land on this land.

---

## 4. Tech stack

### Cloud (Cloudflare)

| Piece | Use |
|---|---|
| **Workers** | HTTP API, auth, webhooks, MCP Streamable HTTP |
| **Durable Objects** | live farm state, WebSocket hub (dashboard + cameras events), device sessions, automation engine |
| **D1** | relational source of truth (plots, devices, finance, audit) |
| **KV** | feature flags, farm-row cache (~60s), rate limits (login / Grok / mail send). Session is an HttpOnly cookie; D1 stays the ledger. Do not store secrets or tokens in KV. |
| **R2** | photos, growth timelapses, invoice PDFs, model artifacts, edge telemetry dumps |
| **Queues** | ingest telemetry, run automations, notify, generate Grok summaries |
| **Cron Triggers** | schedules (irrigation windows, daily briefing, solar settle) |
| **Analytics Engine** | cheap counters (login, ingest, mail, Grok) — query in the dashboard, not a second ledger |
| **Workers AI / optional** | only if needed; primary LLM is xAI |
| **Cloudflare Stream** (optional later) | recorded clips; do not put raw 24/7 video through a Worker |
| **Access + Zero Trust** | optional later; operator login is `/login` + cookie today |
| **Wrangler** | deploy |

### Edge + local servers (farm LAN)

Starlink is only the uplink. The farm has its own small datacenter.

| Box | Role | Runs |
|---|---|---|
| **Polje Edge** (Pi 5 / NUC / industrial PC, **Linux**) | farm OS runtime | MQTT bridge, ingest outbox, local rules, API cache, SQLite/LiteFS |
| **FPS LoRa gateway** | field radio | `qtech-lora-gateway` (Python on Linux) from the FPS fork; talks to sensor nodes + valve controllers |
| **MQTT broker** | IoT bus | Mosquitto or EMQX on LAN (`mqtt.farm.lan`) |
| **NVR** | cameras | Frigate or go2rtc + local disk; snapshots synced to R2 when uplink is up |
| **Optional HA** | family UI / Zigbee | Home Assistant on Linux; Polje is source of truth, HA is a driver + dashboard |
| **Optional Node-RED** | glue | one-off vendor adapters until a real driver exists |
| **UPS + solar** | stay up | FPS MPPT boards + house inverter with local Modbus/SunSpec; Starlink + edge + LoRa gateway on UPS |

**OS rule:** farm servers run **Linux** (Debian or Ubuntu LTS, or Raspberry Pi OS). No Windows box as a required runtime. No vendor appliance that we cannot SSH into or replace with a Linux service. Developer laptops can be anything; production on the land is Linux.

Local hostnames (example):

```
mqtt.farm.lan        1883 / 8883
edge.farm.lan        Polje Edge HTTP + metrics
lora.farm.lan        FPS gateway
nvr.farm.lan         cameras
ha.farm.lan          Home Assistant (optional)
```

Edge box jobs:

- MQTT or HTTPS ingest to Cloudflare when Starlink is up
- camera snapshot grabber (RTSP → JPEG on interval)
- local rules: if cloud unreachable > N min, close non-frost valves / hold climate
- **frost nights are local-only capable** — FPS valve controller must fire from LoRa + local temp even with zero WAN

### IoT devices

Abstract every device behind `DeviceDriver`. First drivers:

| Driver | Used for |
|---|---|
| `fps-sensor-node` | Qtech FPS multisensor (temp, RH, light, soil), 3 min cadence, solar/12V |
| `fps-valve` | Qtech FPS valve controller firmware |
| `fps-lora-gw` | qtech-lora-gateway health + packet counter |
| `mqtt-generic` | any topic/payload JSON |
| `shelly` | relays, PM, add-on sensors |
| `tasmota` | cheap ESP valves / sockets |
| `modbus-tcp` | pumps, VFDs, some inverters |
| `sunspec` / `solaredge` / `growatt` | solar inverter |
| `onvif` / `rtsp` | cameras |
| `ha-entity` | optional Home Assistant entities as devices |

Sensors: air temp/RH (FPS + extra), soil moisture, leaf wetness (frost), tank level, flow, kWh, battery %, door, wind if you add an anemometer (frost model needs it).

Actuators: FPS frost valves / PIP 2.0 spray lines, drip irrigation solenoids, pumps, heaters, fans, lights, future robot jobs.

Procurement filter for every SKU (pass at least one column, plus Linux reachable):

| Allowed | Not allowed |
|---|---|
| Open-source firmware (Tasmota, ESPHome, FPS fork, Frigate, Mosquitto) | Device that *only* works via vendor cloud / closed app |
| Documented **local** HTTP / MQTT / Modbus / SunSpec / ONVIF / RTSP / LoRa we can call from Linux | “Works with Alexa only”, account-gated API with no LAN mode |
| Camera with RTSP/ONVIF on the LAN | Camera that records only in a vendor app |
| Inverter / pump with Modbus-TCP or SunSpec | Inverter that exports data only through a phone portal |
| Robot / CNC / future machine with open or documented API | Black-box machine we cannot script |

Cloud extras from a vendor are optional. **Local control is mandatory.** If the internet dies, Linux on the farm must still read sensors and stop or run valves.

### Brain

- **xAI API** `https://api.x.ai/v1`
- Default model: `grok-4.6`
- Fast/cheap path (alerts classify, embed captions): lighter Grok SKU if you add one later
- Operator chat in the dashboard calls Grok with **tool use** against Polje API / MCP
- Cursor builds the repo; **Grok Bot** (xAI Grok Bot on a cloud computer, or a Worker cron + GitHub) opens PRs, writes daily farm notes, files issues from anomalies

### Client

- Phase 1: server-rendered or lightweight dashboard (Hono + HTML/HTMX or Vite if needed)
- Phase 2: PWA for phone in the field (offline notes + photo upload)
- Live view: DO WebSocket for metrics; camera = snapshot grid + optional HLS later

### Languages

- TypeScript everywhere on Cloudflare
- Edge agent: TypeScript (Bun) or Python — pick **TypeScript** so Cursor stays in one language
- Infra: `wrangler.jsonc`. Deploy with Wrangler CLI from the farm machine (`npm run deploy`), not GitHub Actions.

### UI stack

- Web: Hono + HTML first, then a thin Vite layer if needed
- Tokens in `packages/ui/tokens.css` + `weather.ts`
- Type: **D-DIN** / **D-DIN Bold** (OFL industrial, same family SpaceX uses). Fallback: `IBM Plex Sans`, `Bahnschrift`, `system-ui`
- No Material, no generic shadcn purple. Ghost chrome + photography + weather tokens.

Full rules: **§24 Design system**.

---

## 5. Architecture

```
                    ┌──────────────────────────┐
   Operator phone   │  Dashboard / PWA         │
   Cursor / Grok    │  MCP client              │
                    └────────────┬─────────────┘
                                 │ HTTPS / WS / MCP
                    ┌────────────▼─────────────┐
                    │  Cloudflare Worker       │
                    │  API + Auth + MCP        │
                    └─┬──────────┬──────────┬──┘
                      │          │          │
              ┌───────▼──┐  ┌────▼────┐  ┌──▼─────────┐
              │ D1 + KV  │  │   R2    │  │ Queues     │
              │ ledger   │  │ media   │  │ jobs       │
              └──────────┘  └─────────┘  └──┬─────────┘
                                            │
                                 ┌──────────▼──────────┐
                                 │ Durable Object      │
                                 │ FarmRuntime         │
                                 │ live state + rules  │
                                 └──────────┬──────────┘
                                            │
                                 ┌──────────▼──────────┐
                                 │ xAI Grok API        │
                                 │ briefings / tools   │
                                 └─────────────────────┘

   Farm LAN (Starlink uplink only)
   ┌─────────────────────────────────────────────────────────────┐
   │  mqtt.farm.lan     edge.farm.lan     lora.farm.lan  nvr     │
   │  Polje Edge ── MQTT ── FPS LoRa GW ── field nodes           │
   │       │                │                                    │
   │       │                ├─ FPS SensorNode (LoRa)             │
   │       │                └─ FPS ValveController (LoRa)        │
   │       ├─ drip valves / pumps (MQTT, Shelly, Modbus)         │
   │       ├─ climate / solar / UPS                              │
   │       └─ cameras → NVR → snapshots                          │
   │  Local rules + frost program run HERE even if WAN is down   │
   └─────────────────────────────────────────────────────────────┘
```

**Local vs cloud split**

| Must work offline on farm LAN | May live in Cloudflare |
|---|---|
| FPS frost program, valve timeouts | Grok chat, daily briefing |
| Irrigation schedule already loaded | Ledger / receipts / subsidies |
| MQTT broker, LoRa gateway | Public API + MCP for remote agents |
| Camera record to local disk | Snapshot archive on R2 |
| Last 7–30 days SQLite readings | Long history, rollups, audit search |

**Control vs data plane**

- Control plane Worker: farms, users, API keys, billing-ish finance config
- Data plane: one Durable Object per farm (`FarmRuntime:{farm_id}`) holds live telemetry, open WS connections, and the automation tick. D1 is the durable ledger. Do not put high-frequency sensor writes only in D1 — buffer in the DO, flush aggregates to D1 / R2.

---

## 6. Repo layout (create this first)

```
polje/
  README.md
  OPG-IVAN-JOVIC.md
  AGENTS.md
  LICENSE
  wrangler.jsonc
  package.json
  tsconfig.json
  .github/workflows/deploy.yml
  apps/
    api/                    ← Cloudflare Worker
    web/                    ← dashboard
    edge/                   ← Polje Edge (farm server)
    mqtt-bridge/            ← LAN MQTT → outbox → Worker
    mcp/
  packages/
    schema/
    drivers/                ← fps-*, mqtt, shelly, onvif, modbus
  forks/
    qtech/                  ← git subtree/submodule of github.com/qtechdesign/qtech
      FPS/
        tools/
          app/              ← Android / iOS FPS apps (keep, wrap later)
          firmware/
            Qtech_FPS_SensorNode
            Qtech_FPS_ValveController
            Qtech_FPS_SSN_ver2.0
            qtech-lora-gateway   ← Python LoRa GW; point cloud at Polje not only Firebase
          hardware/
            FPS_v2.0/
            FPS_v3.0/       ← controller + MPPT Altium
            3D model/
            Calibration.md
  docs/
    API.md
    MCP.md
    IOT.md
    LOCAL-SERVERS.md
    FPS.md
    HARDWARE.md
    STARLINK.md
    FINANCE.md
    ROADMAP.md
    FORK.md
  deploy/
    edge/                   ← docker-compose for farm box (mosquitto, edge, frigate, optional ha)
    gateway/                ← LoRa GW unit file / compose
  compliance/
    OPG-HR.md
  seed/
    opg-ivan-jovic.json
```

### How to bring FPS in (do this in M0/M1)

```bash
# preferred: subtree so the fork lives and grows inside this repo
git subtree add --prefix=forks/qtech https://github.com/qtechdesign/qtech.git master --squash

# pull upstream later
git subtree pull --prefix=forks/qtech https://github.com/qtechdesign/qtech.git master --squash
```

Rules for the fork:

- Keep FPS firmware / hardware / apps in `forks/qtech` with original layout
- New Polje bindings go in `packages/drivers/fps-*` and `apps/edge`, not by rewriting Kotlin/Python in place on day one
- First code change inside the fork: make `qtech-lora-gateway` publish MQTT to `mqtt.farm.lan` and HTTP ingest to Polje Edge, instead of only Firebase (`lib_cloud_firebase.py`)
- Hardware files (Altium, STEP, calibration) stay; they are the physical lineage of the farm
- LICENSE is MIT — keep attribution to Qtech Design in README and `forks/qtech/NOTICE`

---

## 7. Data model (D1, first cut)

Use UUIDs. Timestamps in UTC. Money in integer **cents EUR**.

```sql
-- farms
CREATE TABLE farms (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,          -- 'ivan-jovic'
  name TEXT NOT NULL,                 -- 'OPG Ivan Jović'
  country TEXT NOT NULL DEFAULT 'HR',
  timezone TEXT NOT NULL DEFAULT 'Europe/Zagreb',
  lat REAL,
  lon REAL,
  starlink_site TEXT,                 -- human label only
  created_at TEXT NOT NULL
);

CREATE TABLE plots (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL,
  name TEXT NOT NULL,                 -- 'Hay north', 'Garden', 'Old house yard'
  hectares REAL,
  use_type TEXT,                      -- pasture | hay | garden | orchard | yard | greenhouse | other
  notes TEXT
);

CREATE TABLE plantings (
  id TEXT PRIMARY KEY,
  plot_id TEXT NOT NULL,
  crop TEXT NOT NULL,
  variety TEXT,
  planted_on TEXT,
  stage TEXT,                         -- planned | seeded | growing | harvest | fallow
  expected_harvest TEXT,
  yield_kg REAL
);

CREATE TABLE animals (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL,
  species TEXT,                       -- cow | hen | bee | other
  tag TEXT,
  count INTEGER,
  notes TEXT
);

CREATE TABLE devices (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL,
  kind TEXT NOT NULL,                 -- sensor | actuator | camera | inverter | gateway | lora-node
  driver TEXT NOT NULL,               -- fps-sensor-node | fps-valve | fps-lora-gw | mqtt-generic | shelly | onvif | ...
  name TEXT NOT NULL,
  zone TEXT,
  protocol TEXT,                      -- lora | mqtt | http | modbus | rtsp
  address TEXT,                       -- LoRa addr / MQTT topic / IP
  config_json TEXT,                   -- non-secret config
  last_seen TEXT
);

CREATE TABLE readings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  metric TEXT NOT NULL,               -- temp_c | rh | moisture | flow_lpm | w | kwh | battery_pct
  value REAL NOT NULL,
  ts TEXT NOT NULL
);
CREATE INDEX readings_device_ts ON readings(device_id, ts);

CREATE TABLE commands (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  action TEXT NOT NULL,               -- valve.open | setpoint.set | snapshot.take
  payload_json TEXT,
  source TEXT NOT NULL,               -- ui | schedule | grok | api
  status TEXT NOT NULL,               -- proposed | confirmed | sent | acked | failed | cancelled
  confirmed_by TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE automations (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL,
  name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  trigger_json TEXT NOT NULL,
  action_json TEXT NOT NULL
);

CREATE TABLE ledger (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL,
  ts TEXT NOT NULL,
  kind TEXT NOT NULL,                 -- expense | income | subsidy | asset
  category TEXT,                      -- feed | seed | energy | repair | sale | eu_measure
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  note TEXT,
  r2_key TEXT                         -- receipt
);

CREATE TABLE audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  farm_id TEXT NOT NULL,
  actor TEXT NOT NULL,                -- user:ivan | agent:grok | edge | fps-gw
  action TEXT NOT NULL,
  entity TEXT,
  before_json TEXT,
  after_json TEXT,
  ts TEXT NOT NULL
);

CREATE TABLE frost_events (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  min_temp_c REAL,
  mode TEXT,                          -- spray | fog | watch | aborted
  water_m3 REAL,
  notes TEXT
);
```

Time-series note: raw high-frequency readings may live in R2 (parquet/jsonl per day) with D1 holding rollups (hourly/daily). Start simple: D1 + periodic prune.

---

## 8. HTTP API (Worker)

Public hostnames (first farm): `https://opg-ivanjovic.hr` and `https://www.opg-ivanjovic.hr` (apex + www; API under `/v1`).

Base (generic forks): `https://api.polje.example/v1`

Auth:

- Operator session (Cloudflare Access or signed cookie)
- Service token for Edge (`Authorization: Bearer farm_...`)
- Agent token for Grok / MCP (`Authorization: Bearer agent_...`) with scoped permissions

### Core routes

```
GET    /v1/health
GET    /v1/farms/:slug
GET    /v1/farms/:slug/overview          # live snapshot for dashboard + Grok

GET    /v1/plots
POST   /v1/plots
GET    /v1/plantings
POST   /v1/plantings
PATCH  /v1/plantings/:id                 # stage, yield

GET    /v1/devices
POST   /v1/devices
GET    /v1/devices/:id/readings?from&to&metric
POST   /v1/ingest                        # edge telemetry batch

POST   /v1/commands                      # create command
POST   /v1/commands/:id/confirm
GET    /v1/commands?status=

GET    /v1/automations
PUT    /v1/automations/:id

GET    /v1/cameras
GET    /v1/cameras/:id/latest            # jpeg from R2
POST   /v1/cameras/:id/snapshot          # ask edge to grab now
GET    /v1/stream/:cameraId              # later; signed, short-lived

GET    /v1/energy/now
GET    /v1/climate/now
GET    /v1/irrigation/zones
POST   /v1/irrigation/zones/:id/run      # duration_sec + confirm

GET    /v1/fps/nodes                     # LoRa sensor + valve map
GET    /v1/fps/gateway
POST   /v1/fps/program                   # load frost program to edge (offline-capable)
POST   /v1/fps/valves/:id/open           # confirm + max_sec; frost exception documented
GET    /v1/frost/status                  # watch | armed | spraying | idle
GET    /v1/iot/bus                       # MQTT + LoRa health
GET    /v1/local/health                  # each farm server box

GET    /v1/ledger
POST   /v1/ledger

GET    /v1/audit

POST   /v1/grok/chat                     # operator chat, tools bound to this farm
GET    /v1/grok/briefing/today

WS     /v1/live                          # DO: metrics + events
```

### Ingest payload (edge → cloud)

```json
{
  "farm_id": "ivan-jovic",
  "sent_at": "2026-08-31T10:00:00Z",
  "readings": [
    { "device_id": "soil-n-1", "metric": "moisture", "value": 0.31, "ts": "2026-08-31T09:59:50Z" },
    { "device_id": "inv-1", "metric": "w", "value": 2400, "ts": "2026-08-31T09:59:50Z" }
  ],
  "health": { "starlink": "up", "gateway": "ok" }
}
```

Idempotent: include `batch_id`. Worker writes to Queue → consumer updates DO + D1 rollup.

---

## 9. MCP server

Ship MCP so Cursor, Claude, Grok, and other agents can operate the farm with the same tools.

Transport:

- **stdio** for local Cursor (`npx polje-mcp`)
- **Streamable HTTP** on the Worker at `/mcp` for Grok Bot / remote agents

### Resources (read)

| URI | Meaning |
|---|---|
| `polje://farm/ivan-jovic/overview` | live summary JSON |
| `polje://farm/ivan-jovic/plots` | plots + plantings |
| `polje://farm/ivan-jovic/devices` | device list + last_seen |
| `polje://farm/ivan-jovic/energy` | solar / battery now |
| `polje://farm/ivan-jovic/climate` | temp/RH/setpoints |
| `polje://farm/ivan-jovic/irrigation` | zones + last run |
| `polje://farm/ivan-jovic/fps` | LoRa nodes, gateway, frost status |
| `polje://farm/ivan-jovic/local` | edge / mqtt / nvr / starlink health |
| `polje://farm/ivan-jovic/cameras/{id}/latest` | image |
| `polje://farm/ivan-jovic/ledger?from=` | money |
| `polje://farm/ivan-jovic/audit?limit=50` | recent actions |
| `polje://docs/api` | this API |
| `polje://docs/safety` | safety policy |

### Tools (write / act)

| Tool | Risk | Notes |
|---|---|---|
| `get_overview` | low | no side effect |
| `list_readings` | low | |
| `add_planting_note` | low | |
| `log_expense` | medium | money write |
| `request_snapshot` | low | |
| `set_climate_setpoint` | high | needs confirm + range check |
| `run_irrigation` | high | duration cap, rain lockout, confirm |
| `fps_frost_status` | low | live FPS + dewpoint / wet-bulb style summary |
| `fps_arm_program` | high | push frost program to edge; confirm |
| `fps_open_valve` | high | max_sec + reason; frost nights allowed by policy |
| `set_actuator` | high | ON/OFF with timeout_sec required |
| `iot_bus_health` | low | MQTT, LoRa GW, edge, NVR |
| `propose_automation` | medium | writes draft, does not enable |
| `enable_automation` | high | confirm |
| `ask_grok_briefing` | low | generates text into R2 + D1 |

Tool design rule: high-risk tools take `confirm: boolean` and `reason: string`. If `confirm !== true`, return a proposal object, do not act.

Example tool schema:

```json
{
  "name": "run_irrigation",
  "description": "Run an irrigation zone for a limited duration. Requires confirm=true. Blocked if rain lockout is on.",
  "inputSchema": {
    "type": "object",
    "required": ["zone_id", "duration_sec", "reason"],
    "properties": {
      "zone_id": { "type": "string" },
      "duration_sec": { "type": "integer", "minimum": 30, "maximum": 3600 },
      "reason": { "type": "string" },
      "confirm": { "type": "boolean", "default": false }
    }
  }
}
```

Publish `docs/MCP.md` generated from the same zod schemas as the HTTP API. One source of truth in `packages/schema`.

---

## 10. Grok integration

### Operator chat

`POST /v1/grok/chat`

Worker sends:

- system prompt: farm name, timezone, safety policy, current overview JSON
- tools = MCP/API tools
- user message

Use xAI Responses API:

```
POST https://api.x.ai/v1/responses
Authorization: Bearer $XAI_API_KEY
model: grok-4.6
```

Never put the xAI key on the edge device. Only the Worker holds it.

### Daily briefing (Cron)

Every morning 06:00 Europe/Zagreb:

1. Pull 24h rollup: weather, soil, solar kWh, irrigation runtime, camera events, ledger deltas
2. Ask Grok for a short Croatian + English briefing
3. Store in D1 + optional X post draft (do not auto-post)
4. Notify operator (email / Telegram / web push — start with one channel)

### Grok Bot + Cursor loop

You code in **Cursor**. Automation:

1. GitHub repo public
2. Issues labeled `farm`, `bug`, `hardware`, `finance`
3. Grok Bot (or Worker cron) reads anomalies from audit/readings and opens GitHub issues:
   - “Valve zone-3 ran 3× yesterday, moisture still low — check emitter”
4. Cursor implements; Wrangler deploys on main
5. Optional: Grok Bot comments on PR with farm-impact notes

`AGENTS.md` must say:

- Read this bible before editing
- Do not commit secrets
- Do not enable high-risk automations in seed data
- Prefer small PRs per module
- Always add an audit event when adding a new write path

---

## 11. Modules to build (order)

Build in this order so something real exists every week.

### M0 — Skeleton (day 1–2)

- Wrangler Worker hello world
- D1 schema migrate
- `GET /v1/health`
- Seed farm `ivan-jovic`
- README + this file in repo
- GitHub Action deploy to `workers.dev`

### M1 — Ledger of the land

- plots, plantings, notes
- simple web list
- photo upload → R2 (growth diary)

### M2 — Local servers + ingest

- `deploy/edge/docker-compose.yml`: Mosquitto + Polje Edge + optional Frigate
- Edge agent stub that posts fake then real readings
- MQTT topics convention (see §21)
- FarmRuntime Durable Object
- `/v1/overview` + `/v1/local/health` + WS live
- Starlink up/down banner
- Outbox queue on disk when WAN is down

### M3 — Cameras (local NVR first)

- ONVIF/RTSP into Frigate / go2rtc on `nvr.farm.lan`
- latest.jpg via Edge → R2 when uplink up
- dashboard grid from local or R2
- motion later, not now

### M4 — FPS fork + LoRa field net

- `git subtree add` `qtechdesign/qtech` → `forks/qtech`
- Document hardware (SensorNode, ValveController, SSN 2.0, MPPT, PIP 2.0)
- Run `qtech-lora-gateway` on `lora.farm.lan` if a gateway already exists; otherwise skip radio and use OTS MQTT devices
- First fork change: Qtech server / gateway publishes MQTT + Polje ingest (keep Firebase optional)
- Drivers `fps-sensor-node`, `fps-valve`, `fps-lora-gw` **and** OTS drivers in parallel
- Frost status + `frost_events` table
- Local frost program that does **not** need Cloudflare
- New FPS hardware revisions are a funded milestone, not an M4 gate

### M5 — Irrigation (drip + FPS spray)

- drip zones as devices (Shelly / Tasmota / Modbus)
- FPS spray lines as a separate zone type (`frost` vs `drip`)
- `run_irrigation` with cap + confirm
- rain lockout for drip (never lock out an armed frost program)
- schedule via local Edge + cloud Cron backup
- later: Dewline-style pack of lines into pump L/min capacity

### M6 — Climate + energy

- setpoints for heating/cooling
- solar now / today kWh
- “do not heat if battery < X%” rule

### M7 — Money

- ledger CRUD
- monthly rollup
- receipt images
- simple P&L for the OPG

### M8 — MCP + Grok operator

- MCP HTTP on Worker
- chat box in dashboard
- daily briefing
- Cursor MCP config committed as example (`mcp.json.example`)

### M9 — Automations + robots

- rule engine inside FarmRuntime (tick on DO alarm)
- job queue for “robot mow / future AI build tasks”
- keep human confirm for anything that moves metal or water

### M10 — Public fork kit

- `docs/FORK.md`
- strip Jović-specific seed
- example second farm `demo-opg`

Do not skip M0–M4 to chase robots. Without local MQTT, LoRa, and audit, robots are theatre. Frost protection is allowed to ship before robots.

---

## 12. First farm seed (OPG Ivan Jović)

Use placeholders until you measure real plots.

```json
{
  "slug": "ivan-jovic",
  "name": "OPG Ivan Jović",
  "timezone": "Europe/Zagreb",
  "story": "1923 house. Katica, Vinko, Jana. Four daughters. Hay and cows. Rebuild with software, solar, and machines.",
  "plots": [
    { "name": "House yard", "use_type": "yard" },
    { "name": "Hay field", "use_type": "hay" },
    { "name": "Pasture", "use_type": "pasture" },
    { "name": "Garden", "use_type": "garden" }
  ],
  "zones": [
    { "name": "Garden drip", "kind": "drip" },
    { "name": "Hay / orchard frost line", "kind": "frost" },
    { "name": "Old house climate", "kind": "climate" }
  ],
  "iot": {
    "mqtt": "mqtt.farm.lan:1883",
    "lora_gateway": "lora.farm.lan",
    "edge": "edge.farm.lan",
    "nvr": "nvr.farm.lan"
  },
  "fps_fork": "forks/qtech"
}
```

Fill hectares, GPS, and device IDs when you walk the land with a phone.

---

## 13. FPS fork — what we inherit

Upstream: [github.com/qtechdesign/qtech](https://github.com/qtechdesign/qtech)  
Default branch: `master` · License: MIT · Language on GitHub: Kotlin (mobile) + Python gateway + firmware + Altium

FPS is a **frost protection system**: keep a crop at ~100% RH and use irrigation (latent heat / ice layer 0–2 °C) on frost nights. That is not the same as summer drip. Polje must keep both zone types.

| Piece in upstream | Path | What Polje does with it |
|---|---|---|
| Mission / vision | `README.md` | Keep credit; link from our README |
| Multisensor node | `FPS/tools/firmware/Qtech_FPS_SensorNode` + `Qtech_FPS_SSN_ver2.0` | Driver `fps-sensor-node`; 3 min sample, sleep, solar 12 V / logic 5 V |
| Valve controller | `FPS/tools/firmware/Qtech_FPS_ValveController` | Driver `fps-valve`; local timeout required |
| LoRa gateway | `FPS/tools/firmware/qtech-lora-gateway` | Run on `lora.farm.lan`; today talks Firebase (`lib_cloud_firebase.py`, `mqtt_FB_Admin.py`). Add `lib_cloud_polje.py` that publishes MQTT + HTTPS ingest |
| Android / iOS apps | `FPS/tools/app/` | Keep building; later they call Polje API instead of only legacy cloud |
| Hardware v2 / v3 | `FPS/tools/hardware/FPS_v2.0`, `FPS_v3.0` | Controller + MPPT boards — energy + frost on the same lineage |
| PIP 2.0 sprayer | README spec | 5 m range @ 1 bar, 1.2–2.0 mm/m²/h, 1–4 bar uniform flow — model as frost emitters |
| Fog note | README | Optional later mode on `frost_events.mode` |

Frost safety (extra, on top of global confirm rules):

- Armed frost program **overrides** drip rain-lockout
- Valve open from Grok still needs `confirm` unless the local program is already `armed` and temp is below threshold
- Water budget: log `water_m3` on every frost event
- Wind + temp + RH from nodes feed the decision; do not spray blind

Dewline (Qtech irrigation scheduler) is a sister idea: pack irrigation lines into pump capacity. Implement as a Polje automation later (`pack_irrigation_lines`), not as a blocked M0 task.

### How FPS and money work together

The farm cannot wait for a perfect custom stack.

| Phase | Money | What we do |
|---|---|---|
| **Now** | Tight | Run Polje + **Linux** local servers. Use **out-of-the-box** gear that is open source or locally API-controllable: Tasmota/ESPHome, Shelly *local* HTTP/MQTT, cheap temp/RH, RTSP/ONVIF cameras, Frigate, inverter with Modbus/SunSpec. No vendor-cloud-only SKUs. Keep existing FPS boards in service if they already sit on the land. |
| **As the farm grows** | Operating cash | **Extend and modify the Qtech server** in `forks/qtech`: Polje ingest instead of only Firebase, MQTT on `lora.farm.lan`, extra node IDs, new valve maps, farm-specific frost programs. Small firmware patches only when a field bug forces it. |
| **When money allows** | Surplus / grant / OPG measure | Continue **developing FPS**: next SensorNode / ValveController / MPPT revision, better LoRa, PIP lines, fog mode, calibrated frost model, mobile apps pointed at Polje API. Hardware in `FPS/tools/hardware` is the backlog, not a blocker. |

Rule for Cursor: never block a planting season on custom PCB work. If a Shelly can open a drip line this week, ship the Shelly driver. If an FPS valve already exists, wrap it. When budget opens, pick the next FPS ticket from `docs/FPS.md` and grow the fork — same repo, same farm_id.

---

## 14. IoT fabric

Topic convention on `mqtt.farm.lan`:

```
polje/{farm_id}/dev/{device_id}/stat/#     readings, online
polje/{farm_id}/dev/{device_id}/cmnd/#     commands
polje/{farm_id}/fps/{node_id}/stat         raw LoRa decoded
polje/{farm_id}/gw/{gw_id}/health
polje/{farm_id}/sys/edge/health
polje/{farm_id}/sys/starlink               up | down
```

Payload (keep tiny for LoRa):

```json
{ "ts": "2026-08-31T09:59:50Z", "t": 1.2, "rh": 97.4, "lux": 0, "soil": 0.28, "vbat": 12.4 }
```

LoRa:

- Private FPS network first (as designed, up to ~10 km, respect HR radio rules)
- Gateway bridges LoRa → MQTT on LAN, then Edge outbox → Cloudflare
- Do not require LoRaWAN join-server in M4; wrap the existing Qtech packet format

LAN devices (Wi-Fi / Ethernet) use the same MQTT tree so Grok and the dashboard never care which radio a sensor uses.

---

## 15. Local servers

`deploy/edge/docker-compose.yml` (farm NUC / Pi):

```yaml
# sketch — implement in M2
services:
  mosquitto:
    image: eclipse-mosquitto
    ports: ["1883:1883", "8883:8883"]
    restart: unless-stopped
  edge:
    build: ../../apps/edge
    environment:
      MQTT_URL: mqtt://mosquitto:1883
      POLJE_API: https://api.example.workers.dev
      INGEST_TOKEN: ${INGEST_TOKEN}
      FARM_ID: ivan-jovic
    restart: unless-stopped
    volumes:
      - edge-data:/var/lib/polje   # sqlite + outbox
  nvr:
    image: ghcr.io/blakeblackshear/frigate:stable
    restart: unless-stopped
    profiles: ["cameras"]
  homeassistant:
    image: ghcr.io/home-assistant/home-assistant:stable
    profiles: ["ha"]
    restart: unless-stopped
```

LoRa gateway stays close to the existing Python app (`forks/qtech/FPS/tools/firmware/qtech-lora-gateway`). systemd unit or a second compose file under `deploy/gateway/`.

Local persistence:

- SQLite on Edge (`/var/lib/polje/edge.db`) — last N days of readings + pending commands
- Outbox table: rows uploaded when Starlink returns
- NVR disk is local and large; Cloudflare R2 only gets snapshots + event clips

Split-brain rule: Edge is write-leader for actuators. Cloud command → Edge ACK → device. Cloud never talks to a valve IP across the public internet if we can avoid it.

---

## 16. Starlink + cameras + power

`docs/STARLINK.md` should cover:

- dish placement away from hay dust / tractor lines
- local LAN: wired to edge box, Wi‑Fi only for phones
- power: dish + edge + cameras on a UPS; solar later covers the UPS
- bandwidth budget:
  - telemetry: tiny
  - snapshot every 5–15 min per camera: fine
  - 4K live 24/7: not fine — on-demand only
- failover: if uplink down, edge keeps schedules and safe defaults

Cameras:

- prefer cameras you can pull RTSP from (no vendor cloud required)
- edge takes JPEG, uploads to Worker `/v1/ingest/media`
- never commit public RTSP URLs

---

## 17. Security

- Secrets in Cloudflare Worker secrets + `.dev.vars` locally (gitignored)
- Device tokens rotatable
- MQTT on LAN: user/pass or mTLS later; never expose 1883 on Starlink WAN
- Prefer devices we can SSH, flash, or call on the LAN from Linux; reject lock-in SKUs at purchase time
- LoRa is not encryption-by-default in early FPS — treat radio as physical-security-zone, not internet
- Signed short-lived URLs for R2 images
- CORS tight
- Rate-limit `/v1/ingest` and `/v1/commands`
- MCP remote endpoint requires agent token + farm scope
- Separate roles: `owner`, `family`, `agent`, `edge`, `fps-gw`, `public-read`
- No public write MCP without auth — even if the repo is public

---

## 18. Cursor bootstrap

When you open the empty repo in Cursor, do this in order:

1. Paste this file at repo root.
2. Create `AGENTS.md` (short version of sections 3, 6, 11).
3. `npm create` / init Worker with Hono on Cloudflare.
4. Add D1, KV, R2, Queue bindings in `wrangler.jsonc`.
5. Implement M0 until `/v1/health` and seed farm return JSON.
6. Connect MCP in `.cursor/mcp.json` pointing at local stdio server.
7. Ask Cursor: “Implement M1 from OPG-IVAN-JOVIC.md. Do not invent extra scope.”

Prompt style that works:

> Follow OPG-IVAN-JOVIC.md. Implement only module M2. Keep types in packages/schema. Add tests for ingest validation. Do not enable real actuators.

---

## 19. Environment

```bash
# Worker
XAI_API_KEY=
FARM_JWT_SECRET=
INGEST_TOKEN=
AGENT_TOKEN=

# Edge / local
MQTT_URL=mqtt://mqtt.farm.lan:1883
MQTT_USER=
MQTT_PASS=
FARM_ID=ivan-jovic

# Optional
TELEGRAM_BOT_TOKEN=
GITHUB_TOKEN=          # Grok Bot issues
```

```jsonc
// wrangler.jsonc (sketch)
{
  "name": "polje-api",
  "main": "apps/api/src/index.ts",
  "compatibility_date": "2026-08-01",
  "d1_databases": [{ "binding": "DB", "database_name": "polje" }],
  "kv_namespaces": [{ "binding": "KV", "id": "..." }],
  "r2_buckets": [{ "binding": "MEDIA", "bucket_name": "polje-media" }],
  "queues": {
    "producers": [{ "binding": "INGEST", "queue": "polje-ingest" }],
    "consumers": [{ "queue": "polje-ingest" }]
  },
  "durable_objects": {
    "bindings": [{ "name": "FARM", "class_name": "FarmRuntime" }]
  },
  "triggers": { "crons": ["0 4 * * *"] }
}
```

Cron `0 4 * * *` is 06:00 Zagreb during CEST (UTC+2). Adjust for CET or use a Worker that computes local time.

---

## 20. Public GitHub story

README should say, in this order:

1. One paragraph: 1923 family farm → software-defined OPG
2. What Polje is
3. Screenshot / overview JSON example
4. Quickstart (fork, wrangler, seed)
5. Link to API.md + MCP.md + FPS.md
6. Credit: FPS inherited from [qtechdesign/qtech](https://github.com/qtechdesign/qtech) (MIT)
7. Hardware bill of materials (FPS nodes + cheap LAN IoT)
8. Roadmap checkboxes
9. “If you run an OPG, open an issue with your crop mix”

Do not put family personal documents in git. Story is enough.

Suggested repo name: `opg-ivan-jovic` or `polje-os`.

---

## 21. Success criteria (first 30 days)

You are winning if:

- [ ] Worker live on Cloudflare
- [ ] Seed farm returns overview JSON
- [ ] `forks/qtech` is in the repo (subtree from qtechdesign/qtech)
- [ ] Mosquitto + Polje Edge run on a local box (`docker compose up`)
- [ ] At least one real sensor hits MQTT (FPS node or cheap temp/RH)
- [ ] LoRa gateway health visible at `/v1/local/health` or `/v1/fps/gateway`
- [ ] At least one camera snapshot lands locally and optionally in R2
- [ ] One drip zone can be run with confirm + audit row
- [ ] Frost program can be armed on Edge without WAN
- [ ] Grok daily briefing arrives
- [ ] MCP `get_overview` works from Cursor
- [ ] Public repo has docs another farmer can follow

You are not winning if there is a beautiful mock UI and no device has ever spoken.

---

## 22. Language

- Code, API, MCP names: English
- Operator UI: Croatian first, English toggle
- Grok briefings: both
- Comments in code: English

---

## 23. Immediate next command for Cursor

```
Create the polje monorepo from OPG-IVAN-JOVIC.md module M0.
Use Hono on Cloudflare Workers.
Add D1 schema from section 7 (include frost_events and device protocol/address).
Seed farm slug ivan-jovic.
GET /v1/health and GET /v1/farms/ivan-jovic must work locally with wrangler dev.
Add deploy/edge/docker-compose.yml with Mosquitto only (Edge app can be a stub).
Document in README that FPS will be added with:
  git subtree add --prefix=forks/qtech https://github.com/qtechdesign/qtech.git master --squash
No UI framework yet. No live valves.
Commit message: "M0: worker skeleton, D1 schema, seed OPG Ivan Jović, local MQTT compose"
```

Then stop. Next: subtree the FPS repo, then M2 (Edge + outbox).

---

## 24. Design system — SpaceX chassis, family farm payload

File for tokens later: `packages/ui/tokens.css`, `packages/ui/weather.ts`, `docs/DESIGN.md` (copy this section).

### Intent

Qtech’s public face is agri-tech documentary: frost gifs, irrigation, morning dew (*Rosa ujutro: priroda piše poeziju na travi*). SpaceX’s public face is a black stage where photography does the talking — D-DIN, uppercase tracking, ghost buttons, almost no chrome.

Polje steals the **chassis** from SpaceX and puts the **field** where the rocket photo would be.

- Structure, type, motion, density = aerospace briefing
- Colour and atmosphere = weather on this land (day / night / rain / snow / frost)
- Soul = 1923 family holding, not a startup landing page

The UI is a **mission console for a family farm**. It should feel like you could brief a launch, then walk out to the hay field.

### What we copy from SpaceX

| Rule | Do this |
|---|---|
| Canvas | Default night console is near-black, not grey-blue dashboard sludge |
| Type | Industrial DIN. Display is uppercase or wide-tracked. Body is readable, not all-caps paragraphs |
| Chrome | Hairline borders `1px solid rgba(240,240,250,0.16)`. No drop shadows. No fat cards. No 24px rounded app-store tiles |
| CTA | Ghost button: translucent fill + spectral border. One solid accent button per view max |
| Photography | Full-bleed scene behind the overview (live camera still or weather plate). Type sits on a 40–60% black/white scrim |
| Density | Numbers are large. Labels are small and tracked. Status is a word: `ARMED` `IDLE` `SPRAYING` `STARLINK DOWN` |

### What we change for the farm (the tweak)

- SpaceX is almost only black/white. Polje is allowed **four living accents** pulled from the holding: leaf, hay, frost-ice, soil. They appear as status, charts, weather washes — never as a rainbow theme pack.
- SpaceX photography is rockets. Ours is **this farm + this sky**: yard, hay, FPS spray, old house, cows if they return.
- Qtech energy: frost, water, dew, microclimate. Frost mode is a first-class skin, not an icon in a menu.
- Family: Croatian labels welcome. Warmth lives in copy and photos, not in Comic rounded buttons.

### Type

```
Display:  D-DIN Bold, 11px letter-spacing on hero, line-height 0.95
          40–72px on overview titles, 24–32px section
UI/body:  D-DIN Regular or IBM Plex Sans
          16px body / 14px labels / 12px meta tracked 0.08em
Mono:     IBM Plex Mono or ui-monospace for telemetry (12.4 °C, 2.4 kW)
```

Do not use Inter as the brand face. Inter is the default internet. Headlines may stay Latin-only uppercase; Croatian body uses normal sentence case (čćžšđ must stay readable — **never uppercase-only for paragraphs**).

### Static tokens (chassis)

```css
:root {
  --void:        #07080a;
  --void-soft:   #101218;
  --spectral:    #f0f0fa;
  --spectral-dim:#b8b8c6;
  --hairline:    rgba(240, 240, 250, 0.16);
  --ghost:       rgba(240, 240, 250, 0.08);
  --ghost-border:rgba(240, 240, 250, 0.35);
  --ink-on-light:#101218;

  --leaf:        #3d8c4a;   /* growing, drip ok, online */
  --hay:         #d4a017;   /* warning, harvest, low battery */
  --ice:         #7ec8e3;   /* frost armed, dew, night-cold */
  --soil:        #6b4a2e;   /* earth, ledger, plots */
  --alarm:       #c43c2c;   /* fail, valve stuck, starlink dead */
  --spacex-blue: #005288;   /* rare: links, focus ring only */
}
```

Accent usage: one accent per widget. A frost panel is ice. A yield panel is hay. A plot map is soil + leaf. Do not put all four on one button.

### Weather is the theme engine

Sky comes from **on-farm sensors first** (FPS temp/RH/lux), then a public forecast as fallback (open-meteo, no vendor lock-in). Worker/Edge writes a tiny document:

```json
{
  "solar": "day" | "dawn" | "dusk" | "night",
  "wx": "clear" | "cloud" | "rain" | "snow" | "frost" | "fog",
  "temp_c": 1.2,
  "lux": 0,
  "updated_at": "2026-08-31T21:00:00Z"
}
```

Dashboard root:

```html
<html data-solar="night" data-wx="frost">
```

CSS switches atmosphere. Chrome stays the same (DIN, ghosts, hairlines). Only canvas, wash, and accent breathing change. Transition 800–1200ms, no party strobe.

| `data-solar` + `data-wx` | Canvas | Wash / mood | Accent lean |
|---|---|---|---|
| day + clear | `#eef2e6` warm paper | soft hay light from top | leaf + hay |
| day + cloud | `#d9dee4` | flat cool grey | soil |
| day + rain | `#c5d0d4` | vertical rain film 4–8% opacity, slight blur on hero | spacex-blue |
| day + snow | `#e8eef2` | falling speckle, high key | ice |
| night + clear | `#07080a` | starfield 2–3% dots, spectral type | ice |
| night + rain | `#0a1014` | dark rain film, wet reflections on hairlines | ice + blue |
| night + snow | `#12161c` | slow speckle, quieter | ice |
| any + frost | night-lean even at dawn | ice hairline glow, status `FROST` | **ice only** |
| any + fog | desaturate 20%, lift midtones | Qtech dew mood | spectral |

Implementation notes (be this specific):

- Set attributes from `/v1/weather/now` every 5 min + on WS event
- Rain/snow overlay is a CSS `background-image` repeating linear-gradient or a tiny canvas, `pointer-events: none`, `mix-blend-mode: screen` at night / `multiply` by day
- Hero photo: latest yard camera if lux > threshold, else a still plate per weather (`public/plates/night-frost.jpg` …)
- Do not autoplay loud video behind the console
- Respect `prefers-reduced-motion`: freeze speckle and rain
- Print / PDF ledger ignores weather skins — always light paper

### Layout (mission console)

```
┌─────────────────────────────────────────────────────────┐
│ POLJE · OPG IVAN JOVIĆ          21:04  −0.4°C  FROST    │  48px top bar, tracked
├──────────┬──────────────────────────────────────────────┤
│ NAV      │ HERO still + scrim                           │
│ overview │   4 big numbers: temp · kW · moisture · €    │
│ land     │ SCENE cards as hairline panels, not tiles    │
│ water    │                                              │
│ frost    ├──────────────────────────────────────────────┤
│ energy   │ telemetry table mono                         │
│ eyes     │ cameras 3-col, 16:9, no rounded-2xl          │
│ ledger   │                                              │
│ grok     │                                              │
└──────────┴──────────────────────────────────────────────┘
```

- Max content width for text: 72ch. Console grids can go full.
- Sidebar 220px, collapses to icons on phone.
- Top bar always shows: solar icon, wx word, Starlink pip (`UP` green leaf / `DOWN` alarm).

### Components

**Ghost button (primary chrome)**

```css
.btn-ghost {
  background: var(--ghost);
  color: var(--spectral);
  border: 1px solid var(--ghost-border);
  border-radius: 4px;          /* SpaceX, not 9999px pill */
  padding: 0 20px;
  height: 40px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-size: 13px;
}
.btn-ghost:hover { background: rgba(240,240,250,0.16); }
```

On day themes, invert: ink on light, hairline dark.

**Solid button** — only for confirm-danger (`ARMED`, `RUN DRIP`). Fill `--alarm` or `--ice` depending on frost vs drip. Must stay rectangular 4px.

**Panel** — `background: color-mix(in oklab, var(--void-soft) 82%, transparent)`; `border: 1px solid var(--hairline)`; radius 4px; no shadow.

**Number** — 32–48px mono, unit 12px tracked next to it (`°C`, `kW`, `m³`).

**Status word** — 11px tracked uppercase: `IDLE` `ARMED` `SPRAYING` `FAULT`.

**Grok dock** — right or bottom hairline drawer, mono input, no chat-bubble clipart.

### Motion

- 180ms ease for hover
- 800–1200ms for weather attribute change
- Numbers tick, they do not bounce
- Valve state: instant. Do not animate a valve “for delight”

### Imagery

- Prefer live farm stills over stock
- Qtech-style documentary: equipment in the field, ice on grass, irrigation lines — not smiling-stock-farmers
- Darken photos with `linear-gradient(180deg, rgba(7,8,10,0.15), rgba(7,8,10,0.72))` at night
- Day clear uses a lighter scrim so hay colour survives

### Do not

- Purple AI gradients
- Glassmorphism stacks
- 3D farm illustrations
- All-caps Croatian paragraphs
- Auto theme from OS only — **farm weather wins** over `prefers-color-scheme` (use OS only if sensors are dead)
- Putting the SpaceX logo or Falcon photos on this product

### Cursor rule

When generating UI, read this section first. Implement weather as `data-solar` + `data-wx` on `<html>`, tokens in CSS variables, D-DIN, 4px radius, ghost buttons. If a generated screen looks like a generic SaaS analytics template, throw it away.

---

*Polje is the field. The field was here first. The software serves it.*
