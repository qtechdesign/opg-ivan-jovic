# AGENTS.md — Polje

Public bible: [`OPG-IVAN-JOVIC.md`](OPG-IVAN-JOVIC.md). Read it before editing.

## Non-negotiables (short)

1. **Local failsafe first** — actuators timeout locally; cloud is not the only safety layer.
2. **Confirm dangerous writes** — irrigation, heat, pumps/heaters from agents need `confirm: true` + audit.
3. **Every action is an event** — who / what / why / before / after.
4. **EUR + HR context** — cents EUR, ISO-8601 UTC; no invented legal advice.
5. **Public by default, secrets never** — tokens, camera URLs, bank data stay private.
6. **Starlink-aware** — buffer on edge; small JSON; snapshots before streams.
7. **Local servers are first-class** — MQTT / LoRa / frost / schedules run on-farm.
8. **Qtech FPS is a living fork** — lands in `forks/qtech` (M4); do not rewrite from scratch.
9. **Buy now, build when money allows** — OTS local-API devices equal citizens with FPS.
10. **One farm, many zones** — `farm_id` always; first slug `ivan-jovic`.
11. **Own the stack** — Linux on the land; open source or documented local API only.

## Repo layout (target)

See bible §6. M0 creates Worker + D1 + Mosquitto stub. `apps/web`, `apps/edge`, `forks/qtech` arrive in later modules.

## Module order

M0 skeleton → M1 land ledger → M2 edge + ingest → M3 cameras → M4 FPS LoRa → M5 irrigation → M6 climate/energy → M7 money → M8 MCP/Grok → M9 automations → M10 public fork kit.

**Do not skip M0–M4 to chase robots.**

## Agent rules

- Do not commit secrets (`.dev.vars`, API keys).
- Do not enable high-risk automations in seed data.
- Prefer small PRs / one module per change.
- Always add an audit event when adding a new write path.
- Prefer: *Follow OPG-IVAN-JOVIC.md. Implement only module Mx. Keep types in packages/schema.*
- Forks keep `farm_id` on every row. Do not commit this instance’s Wrangler D1/R2/domain ids as if they were yours. See [`docs/FORK.md`](docs/FORK.md).

## Public hostnames

- `https://opg-ivanjovic.hr`
- `https://www.opg-ivanjovic.hr`
