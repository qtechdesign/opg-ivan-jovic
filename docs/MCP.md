# Polje MCP

Streamable HTTP MCP for Cursor, Grok, and other agents. Same tools as the HTTP API / Grok chat loop.

## Endpoint

| Env | URL |
|---|---|
| Local | `http://127.0.0.1:8787/mcp` |
| Production | `https://opg-ivanjovic.hr/mcp` |

Auth: `Authorization: Bearer <AGENT_TOKEN>` on every request. Unauthenticated → 401.

Cursor example: copy [`.cursor/mcp.json.example`](../.cursor/mcp.json.example) to `.cursor/mcp.json` and set `AGENT_TOKEN`.

Transport: Cloudflare Agents SDK `createMcpHandler` (MCP SDK v2, `legacy: "reject"`). No public write MCP without auth.

## Resources (read)

| URI | Meaning |
|---|---|
| `polje://farm/ivan-jovic/overview` | live summary JSON |
| `polje://farm/ivan-jovic/plots` | plots + plantings |
| `polje://farm/ivan-jovic/devices` | device list + last_seen |
| `polje://farm/ivan-jovic/local` | edge / mqtt / nvr / starlink health |
| `polje://farm/ivan-jovic/cameras/{id}/latest` | JPEG snapshot |
| `polje://farm/ivan-jovic/ledger` | P&L + monthly buckets (`?from=` `?to=` UTC) |
| `polje://farm/ivan-jovic/audit` | recent audit (`?limit=50`) |
| `polje://docs/api` | API summary |
| `polje://docs/safety` | safety policy |

Not ready (return `{ status: "not_ready", module }`): `energy`, `climate` (M6). Irrigation/FPS HTTP exists; MCP resource stubs remain until they share the same helper as HTTP.

## Tools

| Tool | Risk | Status |
|---|---|---|
| `get_overview` | low | live |
| `list_readings` | low | live |
| `add_planting_note` | low | live |
| `log_expense` | medium | thin write to `ledger` (cents EUR) |
| `request_snapshot` | low | live (queues Edge command) |
| `iot_bus_health` | low | live |
| `ask_grok_briefing` | low | live (xAI + D1/R2) |
| `fps_frost_status` | low | M4 stub |
| `run_irrigation` | high | M5 — proposal / `module_not_ready` |
| `set_climate_setpoint` | high | M6 — proposal / `module_not_ready` |
| `fps_arm_program` | high | M4 — proposal / `module_not_ready` |
| `fps_open_valve` | high | M4 — proposal / `module_not_ready` |
| `set_actuator` | high | M9 — proposal / `module_not_ready` |
| `propose_automation` | medium | draft only (`enabled=0`) |
| `enable_automation` | high | M9 — proposal / `module_not_ready` |

### Confirm rule

High-risk tools take `confirm: boolean` and `reason: string`.

- `confirm !== true` → return a **proposal** object; do not act.
- `confirm === true` on an unimplemented module → `{ error: "module_not_ready", module }` and **no** `commands` row.
- Grok operator chat **cannot** confirm high-risk tools (`allowConfirm: false`).

Every write inserts an `audit` row (`actor: agent:mcp` or `agent:grok`).

Schemas live in `packages/schema` (Zod). Tool registry: `apps/api/src/mcp/tools.ts`.
