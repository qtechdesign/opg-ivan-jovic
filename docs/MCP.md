# Polje MCP

Streamable HTTP MCP for Cursor, Grok, and other agents. Same tools as the HTTP API / Grok chat loop.

## Endpoint

| Env | URL |
|---|---|
| Local | `http://127.0.0.1:8787/mcp` |
| Production | `https://opg-ivanjovic.hr/mcp` |

Auth: `Authorization: Bearer <AGENT_TOKEN>` on every request. Unauthenticated → 401.

`AGENT_TOKEN` is **not** from xAI. It is a Polje secret we generate (same idea as `OPERATOR_TOKEN` / `INGEST_TOKEN`). Production value lives in Cloudflare Worker secrets (`npx wrangler secret put AGENT_TOKEN`). Local: `.dev.vars`.

Cursor: copy [`.cursor/mcp.json.example`](../.cursor/mcp.json.example) to `.cursor/mcp.json` and put the real bearer value. Production MCP:

```json
{
  "mcpServers": {
    "polje": {
      "url": "https://opg-ivanjovic.hr/mcp",
      "headers": {
        "Authorization": "Bearer <AGENT_TOKEN from Cloudflare secrets>"
      }
    }
  }
}
```

Transport: Cloudflare Agents SDK `createMcpHandler` (MCP SDK v2, `legacy: "reject"`). No public write MCP without auth.

## Resources (read)

| URI | Meaning |
|---|---|
| `polje://farm/ivan-jovic/overview` | live summary JSON |
| `polje://farm/ivan-jovic/plots` | plots + plantings |
| `polje://farm/ivan-jovic/devices` | device list + last_seen |
| `polje://farm/ivan-jovic/local` | edge / mqtt / nvr / starlink health |
| `polje://farm/ivan-jovic/energy` | solar / battery now (M6) |
| `polje://farm/ivan-jovic/climate` | climate zones + setpoints (M6) |
| `polje://farm/ivan-jovic/irrigation` | zones + last run (M5) |
| `polje://farm/ivan-jovic/fps` | frost status |
| `polje://farm/ivan-jovic/cameras/{id}/latest` | JPEG snapshot |
| `polje://farm/ivan-jovic/ledger` | P&L + monthly buckets (`?from=` `?to=` UTC) |
| `polje://farm/ivan-jovic/audit` | recent audit (`?limit=50`) |
| `polje://docs/api` | API summary |
| `polje://docs/safety` | safety policy |

## Tools

| Tool | Risk | Status |
|---|---|---|
| `get_overview` | low | live |
| `list_readings` | low | live |
| `add_planting_note` | low | live |
| `log_expense` | medium | ledger write (cents EUR) |
| `request_snapshot` | low | queues Edge command |
| `iot_bus_health` | low | live |
| `ask_grok_briefing` | low | xAI + D1/R2 |
| `fps_frost_status` | low | live frost summary |
| `run_irrigation` | high | live; rain lockout for drip |
| `set_climate_setpoint` | high | live M6 |
| `fps_arm_program` | high | live; confirm + reason |
| `fps_open_valve` | high | live; confirm + max_sec |
| `set_actuator` | high | live; `actuator.set` `sent` after confirm (Grok cannot confirm) |
| `propose_automation` | medium | live draft `enabled=0`; Zod trigger/action + `risk` |
| `enable_automation` | high | live; confirm + reason (Grok cannot confirm) |

### Confirm rule

High-risk tools take `confirm: boolean` and `reason: string`.

- `confirm !== true` → **proposal** only; do not act.
- Grok operator chat **cannot** confirm high-risk tools (`allowConfirm: false`).

Every write inserts an `audit` row (`actor: agent:mcp` or `agent:grok`).

Schemas live in `packages/schema` (Zod). Tool registry: `apps/api/src/mcp/tools.ts`.
