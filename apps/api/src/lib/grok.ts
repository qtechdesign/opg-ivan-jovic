import {
  grokToolDefinitions,
  runTool,
  type ToolContext,
  type ToolResult,
} from "../mcp/tools";
import { getFarmBySlug, defaultFarmSlug } from "./farm";
import { farmStub } from "../do/farm-runtime";

const XAI_URL = "https://api.x.ai/v1/responses";
const MODEL = "grok-4.6";
const MAX_ROUNDS = 5;

export type XaiFetch = typeof fetch;

type XaiContentPart =
  | { type: string; text?: string }
  | { type: "output_text"; text: string };

type XaiOutputItem =
  | {
      type: "message";
      role?: string;
      content?: XaiContentPart[] | string;
    }
  | {
      type: "function_call";
      name: string;
      arguments: string;
      call_id?: string;
      id?: string;
    }
  | {
      type: "function_call_output";
      call_id: string;
      output: string;
    };

type XaiResponse = {
  id?: string;
  output?: XaiOutputItem[];
  output_text?: string;
  error?: { message?: string };
};

function extractText(resp: XaiResponse): string {
  if (resp.output_text) return resp.output_text;
  const parts: string[] = [];
  for (const item of resp.output ?? []) {
    if (item.type === "message") {
      if (typeof item.content === "string") {
        parts.push(item.content);
      } else if (Array.isArray(item.content)) {
        for (const c of item.content) {
          if (c.text) parts.push(c.text);
        }
      }
    }
  }
  return parts.join("\n").trim();
}

function extractFunctionCalls(resp: XaiResponse): Array<{
  name: string;
  arguments: string;
  call_id: string;
}> {
  const out: Array<{ name: string; arguments: string; call_id: string }> = [];
  for (const item of resp.output ?? []) {
    if (item.type === "function_call") {
      out.push({
        name: item.name,
        arguments: item.arguments,
        call_id: item.call_id || item.id || crypto.randomUUID(),
      });
    }
  }
  return out;
}

export async function callXaiText(
  apiKey: string,
  userPrompt: string,
  fetchImpl: XaiFetch = fetch
): Promise<string> {
  const res = await fetchImpl(XAI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      input: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`xai_error ${res.status}: ${body.slice(0, 500)}`);
  }
  const data = (await res.json()) as XaiResponse;
  return extractText(data) || "(empty briefing)";
}

async function callXai(
  apiKey: string,
  body: Record<string, unknown>,
  fetchImpl: XaiFetch
): Promise<XaiResponse> {
  const res = await fetchImpl(XAI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`xai_error ${res.status}: ${text.slice(0, 500)}`);
  }
  return (await res.json()) as XaiResponse;
}

export type GrokChatResult = {
  reply: string;
  tool_calls: Array<{ name: string; input: unknown; result: ToolResult }>;
  model: string;
};

export async function runGrokChat(
  env: Cloudflare.Env,
  opts: {
    farmSlug?: string;
    message: string;
    fetchImpl?: XaiFetch;
  }
): Promise<GrokChatResult> {
  if (!env.XAI_API_KEY) {
    throw new Error("xai_not_configured");
  }

  const slug = opts.farmSlug || defaultFarmSlug(env);
  const farm = await getFarmBySlug(env.DB, slug);
  if (!farm) throw new Error("farm_not_found");

  const stub = farmStub(env, farm.slug);
  const liveRes = await stub.fetch(
    new Request(`https://do/overview?farm_id=${encodeURIComponent(farm.slug)}`)
  );
  const live = await liveRes.json();

  const system = `You are the Polje farm operator assistant for ${farm.name}.
Timezone: Europe/Zagreb. Currency: EUR (cents in ledger).
Safety: You may PROPOSE high-risk actions (irrigation, heat, valves, actuators, enable_automation) but you must NEVER set confirm=true. Humans confirm.
Do not invent sensor values. Prefer get_overview / list_readings / iot_bus_health.
Never reveal tokens, camera RTSP URLs, bank data, or exact private GPS.
Respond in Croatian first when the user writes Croatian; otherwise English. Keep answers short and concrete.

Current overview JSON:
${JSON.stringify({ farm: { slug: farm.slug, name: farm.name }, live })}`;

  const tools = grokToolDefinitions();
  const toolCtx: ToolContext = {
    env,
    actor: "agent:grok",
    allowConfirm: false,
  };

  const fetchImpl = opts.fetchImpl ?? fetch;
  const toolCallsLog: GrokChatResult["tool_calls"] = [];

  // Conversation as Responses API input list
  let input: unknown[] = [
    { role: "system", content: system },
    { role: "user", content: opts.message },
  ];

  let lastText = "";

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const resp = await callXai(
      env.XAI_API_KEY,
      {
        model: MODEL,
        input,
        tools,
        tool_choice: "auto",
      },
      fetchImpl
    );

    const calls = extractFunctionCalls(resp);
    lastText = extractText(resp);

    if (calls.length === 0) {
      break;
    }

    // Append model output then tool results for next round
    input = [...input, ...(resp.output ?? [])];

    for (const call of calls) {
      let parsed: unknown = {};
      try {
        parsed = JSON.parse(call.arguments || "{}");
      } catch {
        parsed = {};
      }
      // Strip confirm from Grok — defense in depth
      if (parsed && typeof parsed === "object" && "confirm" in parsed) {
        (parsed as { confirm?: boolean }).confirm = false;
      }

      const result = await runTool(call.name, toolCtx, parsed);
      toolCallsLog.push({ name: call.name, input: parsed, result });

      input.push({
        type: "function_call_output",
        call_id: call.call_id,
        output: JSON.stringify(result),
      });
    }
  }

  return {
    reply: lastText || "(nema odgovora)",
    tool_calls: toolCallsLog,
    model: MODEL,
  };
}
