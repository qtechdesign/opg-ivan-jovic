import { Hono } from "hono";
import type { IngestBatch } from "@polje/schema";
import { api } from "./routes/api";
import { mailApi } from "./routes/mail";
import { grokApi } from "./routes/grok";
import { irrigationApi, tickIrrigationSchedules } from "./routes/irrigation";
import { waterBudgetApi } from "./routes/water-budget";
import { climateApi } from "./routes/climate";
import { ledgerApi } from "./routes/ledger";
import { automationsApi } from "./routes/automations";
import { fpsApi } from "./routes/fps";
import { ogApi } from "./routes/og";
import { fontsApi } from "./routes/fonts";
import { planApi } from "./routes/plan";
import { seoApi } from "./routes/seo";
import {
  agentDiscoveryApi,
  DISCOVERY_LINK_HEADER,
  maybeMarkdownResponse,
} from "./routes/agent-discovery";
import { renderHome, renderLand } from "./pages/land";
import { renderPlan } from "./pages/plan";
import { renderEyes } from "./pages/eyes";
import { renderWater } from "./pages/water";
import { renderHands } from "./pages/hands";
import { renderMail } from "./pages/mail";
import { renderLedger } from "./pages/ledger";
import { renderFrost } from "./pages/frost";
import { renderKlima } from "./pages/klima";
import { renderLogin } from "./pages/login";
import { settleEnergyDaily } from "./lib/energy";
import { FarmRuntime, farmStub } from "./do/farm-runtime";
import { defaultFarmSlug, getFarm } from "./lib/farm";
import { ingestInboundEmail } from "./lib/mail";
import { maybeRunMorningBriefing } from "./lib/briefing";
import { maybeIngestAnalog } from "./lib/analog";
import { writeMetric } from "./lib/kv";
import {
  createPoljeMcpHandler,
  requireAgentToken,
} from "./mcp/server";

type Bindings = Cloudflare.Env;

const app = new Hono<{ Bindings: Bindings }>();

app.use("*", async (c, next) => {
  if (c.req.method === "GET") {
    const md = maybeMarkdownResponse(c.req.path, c.req.header("Accept"));
    if (md) {
      return c.body(md.body, 200, {
        "Content-Type": "text/markdown; charset=utf-8",
        "x-markdown-tokens": String(md.tokens),
        Vary: "Accept",
        Link: DISCOVERY_LINK_HEADER,
      });
    }
  }
  await next();
  if (c.req.method !== "GET") return;
  const ct = c.res.headers.get("content-type") ?? "";
  if (c.req.path === "/" || ct.includes("text/html")) {
    c.header("Link", DISCOVERY_LINK_HEADER);
    const vary = c.res.headers.get("Vary");
    if (!vary || !/\bAccept\b/i.test(vary)) {
      c.header("Vary", vary ? `${vary}, Accept` : "Accept");
    }
  }
});

app.route("/", agentDiscoveryApi);
app.route("/", api);
app.route("/", mailApi);
app.route("/", grokApi);
app.route("/", irrigationApi);
app.route("/", waterBudgetApi);
app.route("/", climateApi);
app.route("/", ledgerApi);
app.route("/", automationsApi);
app.route("/", fpsApi);
app.route("/", ogApi);
app.route("/", fontsApi);
app.route("/", planApi);
app.route("/", seoApi);
app.get("/", (c) => renderHome(c));
app.get("/login", (c) => renderLogin(c));
app.get("/eyes", (c) => renderEyes(c));
app.get("/land", (c) => renderLand(c));
app.get("/frost", (c) => renderFrost(c));
app.get("/water", (c) => renderWater(c));
app.get("/hands", (c) => renderHands(c));
app.get("/mail", (c) => renderMail(c));
app.get("/ledger", (c) => renderLedger(c));
app.get("/klima", (c) => renderKlima(c));
app.get("/plan", (c) => renderPlan(c));

async function handleQueue(
  batch: MessageBatch<IngestBatch>,
  env: Bindings
): Promise<void> {
  for (const msg of batch.messages) {
    try {
      const body = msg.body;
      const stub = farmStub(env, body.farm_id);
      const res = await stub.fetch(
        new Request("https://do/ingest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      );
      if (!res.ok) {
        console.error("ingest apply failed", res.status, await res.text());
        msg.retry();
        continue;
      }
      msg.ack();
    } catch (err) {
      console.error("ingest queue error", err);
      msg.retry();
    }
  }
}

export { app };

async function handleEmail(
  message: ForwardableEmailMessage,
  env: Bindings,
  _ctx: ExecutionContext
): Promise<void> {
  const raw = await new Response(message.raw).arrayBuffer();
  try {
    const result = await ingestInboundEmail(env, {
      envelopeFrom: message.from,
      envelopeTo: message.to,
      raw,
    });
    if ("rejected" in result) {
      // Routing already sent this address to us. Bounce was 555 Unknown mailbox.
      console.error("mail ingest skipped", message.to, result.rejected);
    } else {
      writeMetric(env, "mail_in", defaultFarmSlug(env));
    }
  } catch (err) {
    console.error("mail ingest error", message.to, err);
    throw err;
  }
}

async function handleScheduled(
  _controller: ScheduledController,
  env: Bindings,
  _ctx: ExecutionContext
): Promise<void> {
  const slug = defaultFarmSlug(env);
  const farm = await getFarm(env, slug);
  if (farm) {
    try {
      const n = await tickIrrigationSchedules(
        env.DB,
        farm.slug,
        farm.id,
        farm.timezone
      );
      if (n > 0) console.log("irrigation cron created", n, "commands");
    } catch (err) {
      console.error("irrigation cron error", err);
    }
    try {
      const settle = await settleEnergyDaily(env.DB, farm.id, farm.timezone);
      if (settle.settled) {
        console.log("solar settle", settle.local_date, settle.kwh);
      }
    } catch (err) {
      console.error("solar settle cron error", err);
    }
    try {
      const analog = await maybeIngestAnalog(env, farm.slug);
      if (analog) console.log("analog climate ingest", farm.slug);
    } catch (err) {
      console.error("analog climate cron error", err);
    }
  } else {
    console.warn("cron: farm not found", slug);
  }

  try {
    const result = await maybeRunMorningBriefing(env);
    console.log("briefing cron", result.ran, result.reason ?? "ok");
  } catch (err) {
    console.error("briefing cron error", err);
  }
}

const worker = {
  async fetch(
    request: Request,
    env: Bindings,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/mcp" || url.pathname.startsWith("/mcp/")) {
      const denied = await requireAgentToken(request, env);
      if (denied) return denied;
      return createPoljeMcpHandler(env)(request, env, ctx);
    }
    return app.fetch(request, env, ctx);
  },
  queue: handleQueue,
  email: handleEmail,
  scheduled: handleScheduled,
};

export default worker;
export { FarmRuntime };
