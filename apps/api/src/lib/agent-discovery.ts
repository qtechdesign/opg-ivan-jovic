import { DOCS_API_URL } from "./public-origin";
import {
  POLJE_FARM_SKILL_MD,
  POLJE_SAFETY_SKILL_MD,
} from "./agent-skills";

const MCP_VERSION = "0.8.0";

/** RFC 8288 Link values for homepage (and other HTML). */
export const DISCOVERY_LINK_HEADER = [
  '</.well-known/api-catalog>; rel="api-catalog"',
  '</v1/openapi.json>; rel="service-desc"; type="application/openapi+json"',
  `<${DOCS_API_URL}>; rel="service-doc"`,
  '</.well-known/ai-catalog.json>; rel="describedby"; type="application/json"',
  '</.well-known/mcp/server-card.json>; rel="describedby"; type="application/json"',
].join(", ");

export const HTML_DISCOVERY_LINKS = `<link rel="api-catalog" href="/.well-known/api-catalog" />
  <link rel="service-desc" type="application/openapi+json" href="/v1/openapi.json" />
  <link rel="service-doc" href="${DOCS_API_URL}" />
  <link rel="describedby" type="application/json" href="/.well-known/ai-catalog.json" />
  <link rel="ai-catalog" type="application/json" href="/.well-known/ai-catalog.json" />
  <link rel="describedby" type="application/json" href="/.well-known/mcp/server-card.json" />`;

export const DISCOVERY_CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "public, max-age=3600",
};

export function wantsMarkdown(accept: string | undefined): boolean {
  if (!accept) return false;
  return /\btext\/markdown\b/i.test(accept);
}

export function markdownTokenCount(md: string): number {
  return Math.max(1, Math.round(md.length / 4));
}

export function wwwAuthenticateBearer(origin: string): string {
  return `Bearer realm="polje", resource_metadata="${origin}/.well-known/oauth-protected-resource"`;
}

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text)
  );
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const HTML_MARKDOWN: Record<string, string> = {
  "/": `# Polje — OPG Ivan Jović

Operating system for the farm: land ledger, water, frost, climate analog, live cameras, cash-flow book.

- Site: https://opg-ivanjovic.hr
- Docs: ${DOCS_API_URL}
- API catalog: /.well-known/api-catalog
- MCP: /.well-known/mcp/server-card.json
- ARD: /.well-known/ai-catalog.json
- Auth: /auth.md
- OpenAPI: /v1/openapi.json
- Health: /v1/health

Public live: cameras and cash-flow. Writes need operator or agent token. Dangerous actuators require confirm + audit. Currency EUR cents. Analog climate is Lonjsko polje / Čigoč, not private plot GPS.
`,
  "/land": `# Land

Plot ledger for OPG Ivan Jović: names, hectares, use, plantings. Field map when Maps is configured. GET /v1/plots and /v1/plantings. No exact private GPS in public JSON.
`,
  "/eyes": `# Eyes

Public camera stills and analog live streams (YouTube). Snapshots via GET /v1/cameras. RTSP stays private.
`,
  "/water": `# Water

Rain first. Place a pond on Land, then set depth and banks. Drip lines pack into pump capacity (GET /v1/water/pack). Frost stays on FPS. Analog climate: Lonjsko polje. Valve commands still need confirm on the edge.
`,
  "/frost": `# Frost

FPS LoRa frost watch: idle / watch / armed / spraying. GET /v1/frost/status. Arming and valves need confirm + audit.
`,
  "/klima": `# Climate

Tunnel climate + energy. Analog weather is Open-Meteo for Lonjsko polje. Setpoints need confirm.
`,
  "/hands": `# Hands

Automations and jobs. Drafts are medium risk. Enabling a rule is high risk (confirm + reason). Grok chat cannot confirm.
`,
  "/plan": `# Plan

Build / procurement / todos. Amounts are planning envelopes in EUR cents, not quotes. GET /v1/plan (phases, tasks, orders, where). ICS: GET /v1/plan/calendar.ics. Trello board is public read-only with card thumbs. Price research: POST /v1/plan/research (operator) or MCP research_price.
`,
  "/ledger": `# Ledger

Public cash-flow book (integer cents EUR). Writes need operator. GET /v1/ledger and /v1/ledger/summary.
`,
  "/mail": `# Mail

Farm mailbox. HTML requires operator session. Inbound mail is ingested to D1.
`,
  "/login": `# Login

Operator HTML login. POST /v1/session with email + password → HttpOnly cookie. API clients use Bearer OPERATOR_TOKEN. See /auth.md.
`,
};

export function markdownForPath(pathname: string): string | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  return HTML_MARKDOWN[path] ?? null;
}

export function authMarkdown(origin: string): string {
  return `# auth.md

Polje does not run a public OAuth authorization-code issuer. Agents cannot self-register. The operator provisions bearer tokens.

## Audience

- Human operator (browser cookie or \`OPERATOR_TOKEN\`)
- MCP / HTTP agents (\`AGENT_TOKEN\`)
- On-farm edge ingest (\`INGEST_TOKEN\`) — devices, not public agents

## Register

There is no \`POST /agent/auth\`. Ask the operator (mailto:info@qtech.hr) for an \`AGENT_TOKEN\` if you have a legitimate farm task. Tokens are farm-scoped secrets; never commit them.

## Use

\`Authorization: Bearer <AGENT_TOKEN>\` on \`${origin}/mcp\` (MCP Streamable HTTP).

Public GETs (\`/v1/health\`, overview, plots, ledger list, cameras metadata) need no token.

Writes and high-risk actuators need operator or agent token, \`confirm: true\`, a reason, and an audit event. Local edge timeout still applies.

## Discovery

- Protected resource: ${origin}/.well-known/oauth-protected-resource
- Authorization server metadata: ${origin}/.well-known/oauth-authorization-server
- OpenID discovery alias: ${origin}/.well-known/openid-configuration
- JWKS (no JWT issuance): ${origin}/.well-known/jwks.json

The \`token_endpoint\` documents this provisioning model. It does not mint tokens.
`;
}

export function llmsTxt(origin: string): string {
  return `# Polje — OPG Ivan Jović

> Farm operating system: land, water, frost, climate, cameras, cash-flow.

- Home: ${origin}/
- API docs: ${DOCS_API_URL}
- OpenAPI: ${origin}/v1/openapi.json
- MCP: ${origin}/mcp
- Auth: ${origin}/auth.md
- Catalog: ${origin}/.well-known/api-catalog
`;
}

export function apiCatalog(origin: string) {
  return {
    linkset: [
      {
        anchor: `${origin}/v1/`,
        "service-desc": [
          {
            href: `${origin}/v1/openapi.json`,
            type: "application/openapi+json",
          },
        ],
        "service-doc": [
          {
            href: DOCS_API_URL,
            type: "text/html",
          },
        ],
        status: [{ href: `${origin}/v1/health` }],
      },
      {
        anchor: `${origin}/mcp`,
        "service-desc": [
          {
            href: `${origin}/.well-known/mcp/server-card.json`,
            type: "application/json",
          },
        ],
        "service-doc": [
          {
            href: DOCS_API_URL,
            type: "text/html",
          },
        ],
        status: [{ href: `${origin}/v1/health` }],
      },
    ],
  };
}

export function mcpServerCard(origin: string) {
  return {
    serverInfo: {
      name: "polje",
      version: MCP_VERSION,
    },
    description:
      "Polje MCP for OPG Ivan Jović: live overview, sensors, irrigation/frost/climate commands (confirm + audit), ledger, and Grok briefing. Bearer AGENT_TOKEN. Local failsafe first.",
    url: `${origin}/mcp`,
    transport: { type: "streamable-http" },
    capabilities: { tools: true, resources: true },
  };
}

export function aiCatalog(origin: string) {
  const host = origin.replace(/^https:\/\//, "");
  return {
    specVersion: "1.0",
    host: {
      displayName: "Polje — OPG Ivan Jović",
      identifier: `did:web:${host}`,
    },
    entries: [
      {
        identifier: `urn:air:${host}:server:mcp`,
        displayName: "Polje MCP server",
        type: "application/mcp-server-card+json",
        url: `${origin}/.well-known/mcp/server-card.json`,
        representativeQueries: [
          "what is the farm overview on Polje",
          "MCP tools for irrigation confirm on OPG Ivan Jovic",
          "frost status via Polje MCP",
        ],
      },
      {
        identifier: `urn:air:${host}:api:http`,
        displayName: "Polje HTTP API",
        type: "application/openapi+json",
        url: `${origin}/v1/openapi.json`,
        representativeQueries: [
          "OpenAPI for opg-ivanjovic.hr",
          "list plots and plantings JSON API",
          "public ledger summary in EUR cents",
        ],
      },
      {
        identifier: `urn:air:${host}:catalog:rfc9727`,
        displayName: "Polje API catalog",
        type: "application/linkset+json",
        url: `${origin}/.well-known/api-catalog`,
        representativeQueries: [
          "RFC 9727 api-catalog for Polje",
          "where is the farm health endpoint",
        ],
      },
      {
        identifier: `urn:air:${host}:skills:index`,
        displayName: "Polje agent skills",
        type: "application/json",
        url: `${origin}/.well-known/agent-skills/index.json`,
        representativeQueries: [
          "how to operate Polje with confirm true",
          "agent skill for OPG Ivan Jovic farm safety",
        ],
      },
    ],
  };
}

export function oauthProtectedResource(origin: string) {
  return {
    resource: origin,
    authorization_servers: [origin],
    scopes_supported: ["mcp", "operator"],
    bearer_methods_supported: ["header"],
    resource_documentation: `${origin}/auth.md`,
  };
}

export function oauthAuthorizationServer(origin: string) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/login`,
    token_endpoint: `${origin}/v1/oauth/token`,
    jwks_uri: `${origin}/.well-known/jwks.json`,
    grant_types_supported: ["client_credentials"],
    response_types_supported: ["token"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: ["mcp", "operator"],
    service_documentation: `${origin}/auth.md`,
    agent_auth: {
      skill: `${origin}/auth.md`,
      register_uri: `${origin}/auth.md`,
      claim_uri: `${origin}/auth.md`,
      identity_types_supported: ["anonymous"],
      anonymous: {
        credential_types_supported: ["api_key"],
        claim_uri: `${origin}/auth.md`,
      },
    },
  };
}

export function jwksDocument() {
  return { keys: [] as unknown[] };
}

export function openApiDocument(origin: string) {
  return {
    openapi: "3.1.0",
    info: {
      title: "Polje",
      version: MCP_VERSION,
      description:
        "Farm OS HTTP API for OPG Ivan Jović. Public GETs; writes need operator cookie or Bearer OPERATOR_TOKEN. MCP is /mcp with Bearer AGENT_TOKEN. See /auth.md.",
      contact: { email: "info@qtech.hr" },
    },
    servers: [{ url: origin }],
    paths: {
      "/v1/health": {
        get: {
          summary: "Liveness",
          operationId: "health",
          responses: { "200": { description: "ok" } },
        },
      },
      "/v1/overview": {
        get: {
          summary: "Live farm overview",
          parameters: [
            {
              name: "farm",
              in: "query",
              schema: { type: "string" },
            },
          ],
          responses: { "200": { description: "overview JSON" } },
        },
      },
      "/v1/plots": {
        get: {
          summary: "Plots",
          parameters: [
            { name: "farm", in: "query", schema: { type: "string" } },
          ],
          responses: { "200": { description: "plot list" } },
        },
      },
      "/v1/weather/now": {
        get: {
          summary: "Analog weather now",
          parameters: [
            { name: "farm", in: "query", schema: { type: "string" } },
          ],
          responses: { "200": { description: "solar + wx" } },
        },
      },
      "/v1/water/pack": {
        get: {
          summary: "Dewline-style drip pack into pump capacity",
          parameters: [
            { name: "farm", in: "query", schema: { type: "string" } },
            { name: "precip_mm", in: "query", schema: { type: "number" } },
          ],
          responses: { "200": { description: "slots, peak flow, tank series, savings cents" } },
        },
      },
      "/v1/frost/status": {
        get: {
          summary: "FPS frost status",
          parameters: [
            { name: "farm", in: "query", schema: { type: "string" } },
          ],
          responses: { "200": { description: "frost status" } },
        },
      },
      "/v1/ledger/summary": {
        get: {
          summary: "Public cash-flow summary (EUR cents)",
          parameters: [
            { name: "farm", in: "query", schema: { type: "string" } },
          ],
          responses: { "200": { description: "P&L buckets" } },
        },
      },
      "/mcp": {
        post: {
          summary: "MCP Streamable HTTP",
          security: [{ bearerAuth: [] }],
          responses: {
            "200": { description: "MCP" },
            "401": { description: "need AGENT_TOKEN" },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          description: "AGENT_TOKEN or OPERATOR_TOKEN. See /auth.md.",
        },
      },
    },
  };
}

export async function skillsIndex() {
  const skills = [
    {
      name: "polje-farm",
      type: "skill-md" as const,
      description:
        "Operate OPG Ivan Jović through Polje HTTP and MCP: public reads, confirm+audit writes, EUR cents, no secrets.",
      url: "/.well-known/agent-skills/polje-farm/SKILL.md",
      body: POLJE_FARM_SKILL_MD,
    },
    {
      name: "polje-safety",
      type: "skill-md" as const,
      description:
        "Confirm, audit, and token rules before irrigation, frost, heat, or enabling automations on Polje.",
      url: "/.well-known/agent-skills/polje-safety/SKILL.md",
      body: POLJE_SAFETY_SKILL_MD,
    },
  ];
  const listed = [];
  for (const s of skills) {
    listed.push({
      name: s.name,
      type: s.type,
      description: s.description,
      url: s.url,
      digest: `sha256:${await sha256Hex(s.body)}`,
    });
  }
  return {
    $schema: "https://schemas.agentskills.io/discovery/0.2.0/schema.json",
    skills: listed,
  };
}

export function skillBody(name: string): string | null {
  if (name === "polje-farm") return POLJE_FARM_SKILL_MD;
  if (name === "polje-safety") return POLJE_SAFETY_SKILL_MD;
  return null;
}
