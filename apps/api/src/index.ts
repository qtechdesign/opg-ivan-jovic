import { Hono } from "hono";
import type { IngestBatch } from "@polje/schema";
import { api } from "./routes/api";
import { renderHome, renderLand } from "./pages/land";
import { renderEyes } from "./pages/eyes";
import { FarmRuntime, farmStub } from "./do/farm-runtime";

type Bindings = Cloudflare.Env;

const app = new Hono<{ Bindings: Bindings }>();

app.route("/", api);
app.get("/", (c) => renderHome(c));
app.get("/land", (c) => renderLand(c));
app.get("/eyes", (c) => renderEyes(c));

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

const worker = {
  fetch: app.fetch.bind(app),
  queue: handleQueue,
};

export default worker;
export { FarmRuntime };
