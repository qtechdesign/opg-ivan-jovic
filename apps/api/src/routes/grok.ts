import { Hono } from "hono";
import { GrokChatSchema } from "@polje/schema";
import { requireOperator } from "../lib/auth";
import { defaultFarmSlug, farmSlugFromQuery, getFarm } from "../lib/farm";
import { writeAudit } from "../lib/audit";
import { runGrokChat } from "../lib/grok";
import { getTodayBriefing, generateBriefing } from "../lib/briefing";
import {
  RL_GROK,
  consumeRateLimit,
  flagEnabled,
  rlGrokKey,
  writeMetric,
} from "../lib/kv";

type AppEnv = { Bindings: Cloudflare.Env };

export const grokApi = new Hono<AppEnv>();

grokApi.post("/v1/grok/chat", async (c) => {
  const denied = await requireOperator(c);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }

  const parsed = GrokChatSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "validation", details: parsed.error.flatten() }, 400);
  }

  const farm = await getFarm(c.env, parsed.data.farm_slug);
  if (!farm) {
    return c.json({ error: "farm_not_found", slug: parsed.data.farm_slug }, 404);
  }

  if (!(await flagEnabled(c.env.KV, farm.slug, "grok_chat"))) {
    return c.json({ error: "flag_disabled", flag: "grok_chat" }, 403);
  }

  const rl = await consumeRateLimit(
    c.env.KV,
    rlGrokKey(farm.slug),
    RL_GROK.limit,
    RL_GROK.windowSec
  );
  if (!rl.allowed) {
    c.header("Retry-After", "60");
    return c.json({ error: "rate_limited" }, 429);
  }

  if (!c.env.XAI_API_KEY) {
    return c.json({ error: "xai_not_configured" }, 503);
  }

  try {
    const result = await runGrokChat(c.env, {
      farmSlug: farm.slug,
      message: parsed.data.message,
    });

    await writeAudit(c.env.DB, {
      farm_id: farm.id,
      actor: "agent:grok",
      action: "grok.chat",
      entity: `farm:${farm.slug}`,
      after: {
        message: parsed.data.message.slice(0, 200),
        tool_calls: result.tool_calls.map((t) => t.name),
        model: result.model,
      },
    });
    writeMetric(c.env, "grok", farm.slug);

    return c.json({
      farm_id: farm.id,
      slug: farm.slug,
      reply: result.reply,
      tool_calls: result.tool_calls,
      model: result.model,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "grok_failed";
    if (msg === "xai_not_configured") {
      return c.json({ error: "xai_not_configured" }, 503);
    }
    console.error("grok chat", err);
    return c.json({ error: "grok_failed", detail: msg.slice(0, 300) }, 502);
  }
});

grokApi.get("/v1/grok/briefing/today", async (c) => {
  const slug = farmSlugFromQuery(c);
  const farm = await getFarm(c.env, slug);
  if (!farm) return c.json({ error: "farm_not_found", slug }, 404);

  const briefing = await getTodayBriefing(c.env, farm.slug);
  if (!briefing) {
    return c.json({ farm_id: farm.id, slug: farm.slug, briefing: null }, 200);
  }
  return c.json({ farm_id: farm.id, slug: farm.slug, briefing });
});

/** Operator-triggered regenerate (optional convenience; MCP ask_grok_briefing also works). */
grokApi.post("/v1/grok/briefing", async (c) => {
  const denied = await requireOperator(c);
  if (denied) return denied;

  let body: { farm_slug?: string; force?: boolean } = {};
  try {
    body = await c.req.json();
  } catch {
    /* empty ok */
  }

  const result = await generateBriefing(c.env, {
    farmSlug: body.farm_slug || defaultFarmSlug(c.env),
    force: body.force === true,
    actor: "user:operator",
  });

  if (result.error === "xai_not_configured") {
    return c.json(result, 503);
  }
  if (result.error === "farm_not_found") {
    return c.json(result, 404);
  }
  if (result.error === "flag_disabled") {
    return c.json(result, 403);
  }
  return c.json(result);
});
