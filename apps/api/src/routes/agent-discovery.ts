import { Hono } from "hono";
import { publicOriginFromHost } from "../lib/public-origin";
import {
  DISCOVERY_CORS,
  DISCOVERY_LINK_HEADER,
  apiCatalog,
  authMarkdown,
  aiCatalog,
  jwksDocument,
  llmsTxt,
  markdownForPath,
  markdownTokenCount,
  mcpServerCard,
  oauthAuthorizationServer,
  oauthProtectedResource,
  openApiDocument,
  skillsIndex,
  wantsMarkdown,
} from "../lib/agent-discovery";
import {
  POLJE_FARM_SKILL_MD,
  POLJE_SAFETY_SKILL_MD,
} from "../lib/agent-skills";


type AppEnv = { Bindings: Cloudflare.Env };

function originOf(c: { req: { header: (n: string) => string | undefined } }): string {
  return publicOriginFromHost(c.req.header("host"));
}

function jsonDoc(
  c: { body: (data: string, status: 200, headers: Record<string, string>) => Response },
  body: unknown,
  contentType: string
): Response {
  return c.body(JSON.stringify(body), 200, {
    "Content-Type": contentType,
    ...DISCOVERY_CORS,
  });
}

function mdDoc(
  c: {
    body: (data: string, status: 200, headers: Record<string, string>) => Response;
  },
  md: string
): Response {
  return c.body(md, 200, {
    "Content-Type": "text/markdown; charset=utf-8",
    "x-markdown-tokens": String(markdownTokenCount(md)),
    Vary: "Accept",
    ...DISCOVERY_CORS,
  });
}

export const agentDiscoveryApi = new Hono<AppEnv>();

/** Markdown negotiation for public HTML paths (Worker fallback if zone converter is off). */
export function maybeMarkdownResponse(
  path: string,
  accept: string | undefined
): { body: string; tokens: number } | null {
  if (!wantsMarkdown(accept)) return null;
  const md = markdownForPath(path);
  if (!md) return null;
  return { body: md, tokens: markdownTokenCount(md) };
}

export { DISCOVERY_LINK_HEADER };

agentDiscoveryApi.get("/.well-known/api-catalog", (c) => {
  return jsonDoc(
    c,
    apiCatalog(originOf(c)),
    "application/linkset+json"
  );
});

agentDiscoveryApi.get("/.well-known/mcp/server-card.json", (c) => {
  return jsonDoc(c, mcpServerCard(originOf(c)), "application/json");
});

agentDiscoveryApi.get("/.well-known/ai-catalog.json", (c) => {
  return jsonDoc(c, aiCatalog(originOf(c)), "application/json");
});

agentDiscoveryApi.get("/.well-known/oauth-protected-resource", (c) => {
  return jsonDoc(c, oauthProtectedResource(originOf(c)), "application/json");
});

agentDiscoveryApi.get("/.well-known/oauth-authorization-server", (c) => {
  return jsonDoc(c, oauthAuthorizationServer(originOf(c)), "application/json");
});

agentDiscoveryApi.get("/.well-known/openid-configuration", (c) => {
  return jsonDoc(c, oauthAuthorizationServer(originOf(c)), "application/json");
});

agentDiscoveryApi.get("/.well-known/jwks.json", (c) => {
  return jsonDoc(c, jwksDocument(), "application/json");
});

agentDiscoveryApi.get("/.well-known/agent-skills/index.json", async (c) => {
  return jsonDoc(c, await skillsIndex(), "application/json");
});

agentDiscoveryApi.get("/.well-known/agent-skills/polje-farm/SKILL.md", (c) => {
  return mdDoc(c, POLJE_FARM_SKILL_MD);
});

agentDiscoveryApi.get("/.well-known/agent-skills/polje-safety/SKILL.md", (c) => {
  return mdDoc(c, POLJE_SAFETY_SKILL_MD);
});

agentDiscoveryApi.get("/auth.md", (c) => {
  return mdDoc(c, authMarkdown(originOf(c)));
});

agentDiscoveryApi.get("/llms.txt", (c) => {
  return c.text(llmsTxt(originOf(c)), 200, {
    "Content-Type": "text/plain; charset=utf-8",
    ...DISCOVERY_CORS,
  });
});

agentDiscoveryApi.get("/v1/openapi.json", (c) => {
  return jsonDoc(c, openApiDocument(originOf(c)), "application/openapi+json");
});

agentDiscoveryApi.all("/v1/oauth/token", (c) => {
  if (c.req.method !== "POST") {
    c.header("Allow", "POST");
    return c.json(
      {
        error: "invalid_request",
        error_description:
          "Polje does not issue OAuth tokens. Provision AGENT_TOKEN with the operator. See /auth.md",
      },
      405
    );
  }
  return c.json(
    {
      error: "invalid_grant",
      error_description:
        "Polje does not mint OAuth access tokens. The operator provisions Bearer AGENT_TOKEN. See /auth.md",
    },
    400
  );
});
