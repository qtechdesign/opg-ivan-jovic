# Polje — OPG Ivan Jović

House from **1923**. Birth house of grandmother Katica. Hay, cows, family labour. The farm sat unused for ~30 years. This software is the next chapter of that same ground: an operating system for a Croatian family holding (**OPG**).

**Polje** (`polje` = field) is the platform name. First tenant: **OPG Ivan Jović**. Built so another family farm can fork the same roadmap.

## Live

- https://opg-ivanjovic.hr
- https://www.opg-ivanjovic.hr
- Debug: https://polje.quiet-lab-19ab.workers.dev
- API: `GET /v1/health`, `GET /v1/farms/ivan-jovic`, land at `/land`, eyes at `/eyes`
- Docs: [`docs/API.md`](docs/API.md)

If local DNS still cannot resolve the `.hr` names, query Cloudflare (`dig @1.1.1.1 opg-ivanjovic.hr`) — custom domains are attached and serving.

## Stack (M0–M3)

| Piece | Role |
|---|---|
| Cloudflare Worker (Hono) | HTTP API + HTML console (`/`, `/land`, `/eyes`) |
| D1 | Relational ledger (farms, plots, plantings, audit, …) |
| R2 `polje-media` | Growth diary photos |
| Queue `polje-ingest` + FarmRuntime DO | Live telemetry + WS |
| Polje Edge + Mosquitto | Farm LAN ingest / outbox (`deploy/edge`) |

Later: Frigate cameras, FPS LoRa fork, MCP, Grok. Full bible: [`OPG-IVAN-JOVIC.md`](OPG-IVAN-JOVIC.md).

## Secrets

| Where | What |
|---|---|
| `.dev.vars` (gitignored) | Local Wrangler secrets — copy from `.dev.vars.example` |
| Cloudflare Secrets | Production — `INGEST_TOKEN`, `OPERATOR_TOKEN` (later: `XAI_API_KEY`, …) |
| GitHub Actions secrets | CI only — `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` |

Never commit `.env`, `.dev.vars`, or real tokens. Non-secret config stays in `wrangler.jsonc` `vars`.

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
- http://127.0.0.1:8787/eyes
- http://127.0.0.1:8787/v1/overview?farm=ivan-jovic

Local MQTT + Edge (optional):

```bash
cd deploy/edge
export INGEST_TOKEN=dev-ingest-token-change-me
export POLJE_API=http://host.docker.internal:8787
docker compose up -d mosquitto edge
docker compose --profile sim up -d sim
```

See [`docs/LOCAL-SERVERS.md`](docs/LOCAL-SERVERS.md).

## FPS fork (M4 — not yet)

When ready:

```bash
git subtree add --prefix=forks/qtech https://github.com/qtechdesign/qtech.git master --squash
```

Credit: Frost Protection System inherited from [qtechdesign/qtech](https://github.com/qtechdesign/qtech) (MIT).

## Agents

See [`AGENTS.md`](AGENTS.md) and `.cursor/rules/`. Roadmap: [`docs/ROADMAP.md`](docs/ROADMAP.md).

## License

MIT — see [`LICENSE`](LICENSE).
