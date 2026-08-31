import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { TOOL_DEFS, runTool, type ToolContext } from "./tools";
import { readPoljeResource, STATIC_RESOURCE_URIS } from "./resources";
import { DEFAULT_FARM_SLUG } from "../lib/farm";
import { timingSafeEqualString } from "../lib/auth";

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

export function createPoljeMcpServer(ctx: ToolContext): McpServer {
  const server = new McpServer({
    name: "polje",
    version: "0.8.0",
  });

  for (const tool of TOOL_DEFS) {
    const shape = (tool.inputSchema as { shape?: Record<string, unknown> })
      .shape;
    server.registerTool(
      tool.name,
      {
        description: `[${tool.risk}] ${tool.description}`,
        // Zod 4 shapes are compatible at runtime; cast for MCP SDK typings.
        inputSchema: (shape ?? {}) as Record<string, never>,
      },
      async (args: Record<string, unknown>) => {
        const result = await runTool(tool.name, ctx, args);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }
    );
  }

  for (const uri of STATIC_RESOURCE_URIS) {
    const name = uri.replace(/^polje:\/\//, "").replace(/\//g, "_");
    server.registerResource(
      name,
      uri,
      {
        description: `Polje resource ${uri}`,
        mimeType: "application/json",
      },
      async (resourceUri: { href: string } | string) => {
        const href =
          typeof resourceUri === "string" ? resourceUri : resourceUri.href;
        const result = await readPoljeResource(ctx.env, href);
        if ("error" in result) {
          return {
            contents: [
              {
                uri: href,
                mimeType: "application/json",
                text: JSON.stringify(result),
              },
            ],
          };
        }
        if ("blob" in result) {
          return {
            contents: [
              {
                uri: href,
                mimeType: result.mimeType,
                blob: bytesToBase64(result.blob),
              },
            ],
          };
        }
        return {
          contents: [
            {
              uri: href,
              mimeType: result.mimeType,
              text: result.text,
            },
          ],
        };
      }
    );
  }

  server.registerResource(
    "camera_latest",
    `polje://farm/${DEFAULT_FARM_SLUG}/cameras/{id}/latest`,
    {
      description: "Latest JPEG snapshot for a camera id",
      mimeType: "image/jpeg",
    },
    async (resourceUri: { href: string } | string) => {
      const href =
        typeof resourceUri === "string" ? resourceUri : resourceUri.href;
      const result = await readPoljeResource(ctx.env, href);
      if ("error" in result) {
        return {
          contents: [
            {
              uri: href,
              mimeType: "application/json",
              text: JSON.stringify(result),
            },
          ],
        };
      }
      if ("blob" in result) {
        return {
          contents: [
            {
              uri: href,
              mimeType: result.mimeType,
              blob: bytesToBase64(result.blob),
            },
          ],
        };
      }
      return {
        contents: [
          {
            uri: href,
            mimeType: result.mimeType,
            text: result.text,
          },
        ],
      };
    }
  );

  return server;
}

export async function requireAgentToken(
  request: Request,
  env: Cloudflare.Env
): Promise<Response | null> {
  const expected = env.AGENT_TOKEN;
  if (!expected) {
    return Response.json({ error: "agent_token_not_configured" }, { status: 500 });
  }
  const header = request.headers.get("Authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) {
    return Response.json(
      { error: "unauthorized", hint: "Bearer AGENT_TOKEN" },
      { status: 401 }
    );
  }
  const ok = await timingSafeEqualString(match[1].trim(), expected);
  if (!ok) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}

export function createPoljeMcpHandler(env: Cloudflare.Env) {
  const ctx: ToolContext = {
    env,
    actor: "agent:mcp",
    allowConfirm: true,
  };
  return createMcpHandler(() => createPoljeMcpServer(ctx), {
    route: "/mcp",
    legacy: "reject",
    allowedHostnames: [
      "opg-ivanjovic.hr",
      "www.opg-ivanjovic.hr",
      "polje.quiet-lab-19ab.workers.dev",
      "localhost",
      "127.0.0.1",
    ],
  });
}
