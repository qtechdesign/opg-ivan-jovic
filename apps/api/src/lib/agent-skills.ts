/** Polje agent skills (Agent Skills Discovery RFC v0.2.0). Digests are SHA-256 of these exact bytes. */

export const POLJE_FARM_SKILL_MD = `# Polje farm operations

Use this skill when operating **OPG Ivan Jović** through Polje (farm OS: land, water, frost, climate, cameras, ledger).

## Stack

- HTTP API: \`https://opg-ivanjovic.hr/v1/\` — public GETs, writes need operator session or \`Bearer OPERATOR_TOKEN\`.
- MCP: \`https://opg-ivanjovic.hr/mcp\` — Streamable HTTP. Auth: \`Authorization: Bearer AGENT_TOKEN\` (operator-provisioned; see \`/auth.md\`).
- OpenAPI: \`/v1/openapi.json\`. Docs: https://docs.opg-ivanjovic.hr/api
- Discovery: \`/.well-known/api-catalog\`, \`/.well-known/mcp/server-card.json\`, \`/.well-known/ai-catalog.json\`. DNS-AID HTTPS/SVCB at \`_index._agents.opg-ivanjovic.hr\` and \`_mcp._agents.opg-ivanjovic.hr\`.

First tenant slug: \`ivan-jovic\`. Always pass \`farm_id\` / \`farm\` so other OPGs can fork.

## Public reads (no token)

Overview, plots, plantings, weather analog, frost status, cameras metadata, ledger list/summary, plan, Trello board. Amounts are integer **cents EUR**. Dates ISO-8601 UTC.

Do not ask for or store RTSP URLs, bank credentials, or exact private GPS.

## MCP tools

Low risk: \`get_overview\`, \`list_readings\`, \`add_planting_note\`, \`request_snapshot\`, \`iot_bus_health\`, \`fps_frost_status\`, \`ask_grok_briefing\`, \`get_plan\`, \`propose_plan_task\`, \`research_price\`.

Medium: \`log_expense\`, \`propose_automation\` (draft only, \`enabled=0\`), \`propose_plan_order\` (always \`research\`).

High (require \`confirm: true\` + \`reason\`, audited): \`run_irrigation\`, \`set_climate_setpoint\`, \`fps_arm_program\`, \`fps_open_valve\`, \`set_actuator\`, \`enable_automation\`.

Grok chat cannot confirm high-risk tools.

## Local failsafe

Cloud is brain + ledger. Edge (MQTT / FPS / Shelly) is muscle. Actuators timeout locally; never treat a cloud ACK as the only safety layer.
`;

export const POLJE_SAFETY_SKILL_MD = `# Polje safety and confirm

Use this skill before any irrigation, heat, pump, frost valve, or automation-enable action on Polje.

## Confirm

Dangerous writes need JSON \`confirm: true\` plus a human-readable \`reason\`. The Worker writes an audit event (who / what / why / before / after). Missing confirm → reject.

## Never

- Do not invent legal, HSE, or subsidy advice.
- Do not enable high-risk automations in seed or demo data.
- Do not commit secrets (\`AGENT_TOKEN\`, \`OPERATOR_TOKEN\`, \`INGEST_TOKEN\`, RTSP, bank).
- Do not skip local timeout on actuators.
- Currency is EUR cents only.

## Tokens

- Browser operator: \`POST /v1/session\` cookie.
- API operator: \`Bearer OPERATOR_TOKEN\`.
- MCP agents: \`Bearer AGENT_TOKEN\` (provisioned by the operator; no public self-registration).
- Edge ingest: \`Bearer INGEST_TOKEN\`.

See \`/auth.md\` and \`/.well-known/oauth-protected-resource\`.
`;
