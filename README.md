# Polje — OPG Ivan Jović

House from **1923**. Birth house of grandmother Katica. Hay, cows, family labour. The farm sat unused for ~30 years. This software is the next chapter of that same ground: an operating system for a Croatian family holding (**OPG**).

**Polje** (`polje` = field) is the platform name. First tenant: **OPG Ivan Jović**. Built so another family farm can fork the same roadmap.

## Live

- https://opg-ivanjovic.hr
- https://www.opg-ivanjovic.hr
- Debug: https://polje.quiet-lab-19ab.workers.dev
- API: `GET /v1/health`, `GET /v1/farms/ivan-jovic`, land at `/land`, water at `/water`, eyes at `/eyes`, frost at `/frost`, money at `/ledger`, MCP at `/mcp`
- Docs: [`docs/API.md`](docs/API.md) · [`docs/MCP.md`](docs/MCP.md) · [`docs/FPS.md`](docs/FPS.md)

If local DNS still cannot resolve the `.hr` names, query Cloudflare (`dig @1.1.1.1 opg-ivanjovic.hr`) — custom domains are attached and serving.

## Stack (M0–M9)

| Piece | Role |
|---|---|
| Cloudflare Worker (Hono) | HTTP API + HTML console + MCP `/mcp` + Grok chat |
| D1 | Relational ledger (farms, plots, plantings, irrigation, frost, finance, briefings, audit, …) |
| R2 `polje-media` | Growth diary photos + ledger receipts + briefings |
| Queue `polje-ingest` + FarmRuntime DO | Live telemetry + WS + automation ticks |
| Cron `*/5` | Irrigation schedule backup + 06:00 Zagreb briefing gate |
| Polje Edge + Mosquitto + go2rtc | Farm LAN ingest / cameras / valve write-leader (`deploy/edge`) |
| FPS fork `forks/qtech` | LoRa gateway + SensorNode / ValveController lineage |
| xAI Grok | Operator chat + daily briefing (`XAI_API_KEY`) |

Full bible: [`OPG-IVAN-JOVIC.md`](OPG-IVAN-JOVIC.md).

## Secrets

| Where | What |
|---|---|
| `.dev.vars` (gitignored) | Local Wrangler secrets — copy from `.dev.vars.example` |
| Cloudflare Secrets | Production — `OPERATOR_TOKEN`, `INGEST_TOKEN`, `AGENT_TOKEN`, `XAI_API_KEY` (optional `OPERATOR_NOTIFY_EMAIL`) |
| GitHub Actions secrets | CI only — `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` |

Cursor MCP: copy [`.cursor/mcp.json.example`](.cursor/mcp.json.example) → `.cursor/mcp.json` with `AGENT_TOKEN`.
## Quickstart

```bash
npm install
cp .dev.vars.example .dev.vars
npm run db:migrate:local
npm run seed:local
npm run dev
```

Then:

- http://127.0.0.1:8787/
- http://127.0.0.1:8787/land
- http://127.0.0.1:8787/water
- http://127.0.0.1:8787/eyes
- http://127.0.0.1:8787/frost
- http://127.0.0.1:8787/ledger
- http://127.0.0.1:8787/v1/overview?farm=ivan-jovic
- http://127.0.0.1:8787/v1/irrigation/zones?farm=ivan-jovic

Local MQTT + Edge (optional):

```bash
cd deploy/edge
export INGEST_TOKEN=dev-ingest-token-change-me
export POLJE_API=http://host.docker.internal:8787
docker compose up -d mosquitto edge
docker compose --profile sim up -d sim
```

See [`docs/LOCAL-SERVERS.md`](docs/LOCAL-SERVERS.md).

## FPS fork (M4)

Living fork at [`forks/qtech`](forks/qtech) (subtree of [qtechdesign/qtech](https://github.com/qtechdesign/qtech), MIT).

```bash
# already in tree; pull upstream later:
git subtree pull --prefix=forks/qtech https://github.com/qtechdesign/qtech.git master --squash
```

Gateway publishes MQTT to `mqtt.farm.lan` via `lib_cloud_polje.py` (Firebase optional). Radio hardware is optional — sim profile covers M4 without LoRa. Docs: [`docs/FPS.md`](docs/FPS.md), [`docs/HARDWARE.md`](docs/HARDWARE.md).

Credit: Frost Protection System inherited from [qtechdesign/qtech](https://github.com/qtechdesign/qtech) (MIT). See [`forks/qtech/NOTICE`](forks/qtech/NOTICE).

## Agents

See [`AGENTS.md`](AGENTS.md) and `.cursor/rules/`. Roadmap: [`docs/ROADMAP.md`](docs/ROADMAP.md).

## License

MIT — see [`LICENSE`](LICENSE).
