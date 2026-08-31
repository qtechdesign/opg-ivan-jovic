import { createServer } from "node:http";
import { mkdirSync } from "node:fs";
import mqtt from "mqtt";
import { Outbox } from "./outbox.js";
import { createCameraGrabber } from "./cameras.js";

const FARM_ID = process.env.FARM_ID || "ivan-jovic";
const MQTT_URL = process.env.MQTT_URL || "mqtt://127.0.0.1:1883";
const POLJE_API = (process.env.POLJE_API || "http://127.0.0.1:8787").replace(
  /\/$/,
  ""
);
const INGEST_TOKEN = process.env.INGEST_TOKEN || "";
const DATA_DIR = process.env.POLJE_DATA || "/var/lib/polje";
const FLUSH_MS = Number(process.env.FLUSH_MS || "5000");
const PORT = Number(process.env.PORT || "8788");
const SNAPSHOT_INTERVAL_SEC = Number(process.env.SNAPSHOT_INTERVAL_SEC || "600");
const GO2RTC_URL = process.env.GO2RTC_URL || "http://127.0.0.1:1984";

/** @type {{ device_id: string, metric: string, value: number, ts: string }[]} */
const pending = [];
/** @type {"up"|"down"} */
let starlink = "up";
let mqttOk = "down";

mkdirSync(DATA_DIR, { recursive: true });
const outbox = new Outbox(`${DATA_DIR}/edge.db`);
const cameras = createCameraGrabber({
  dataDir: DATA_DIR,
  poljeApi: POLJE_API,
  ingestToken: INGEST_TOKEN,
  farmId: FARM_ID,
  go2rtcUrl: GO2RTC_URL,
});

/** @param {string} topic */
function topicDeviceId(topic) {
  const m = /^polje\/[^/]+\/dev\/([^/]+)\/stat/.exec(topic);
  return m?.[1] ?? null;
}

/**
 * @param {string} topic
 * @param {Buffer} raw
 */
function normalizePayload(topic, raw) {
  const device_id = topicDeviceId(topic);
  if (!device_id) return [];
  let data;
  try {
    data = JSON.parse(raw.toString("utf8"));
  } catch {
    return [];
  }
  const ts = typeof data.ts === "string" ? data.ts : new Date().toISOString();
  /** @type {{ device_id: string, metric: string, value: number, ts: string }[]} */
  const out = [];
  const map = {
    t: "temp_c",
    temp_c: "temp_c",
    rh: "rh",
    soil: "moisture",
    moisture: "moisture",
    vbat: "battery_pct",
    lux: "lux",
  };
  for (const [k, metric] of Object.entries(map)) {
    if (typeof data[k] === "number") {
      out.push({ device_id, metric, value: data[k], ts });
    }
  }
  return out;
}

async function flushOnce() {
  if (pending.length > 0) {
    const readings = pending.splice(0, pending.length);
    const batch = {
      farm_id: FARM_ID,
      batch_id: crypto.randomUUID(),
      sent_at: new Date().toISOString(),
      readings,
      health: {
        starlink,
        mqtt: mqttOk,
        edge: "ok",
        gateway: "n/a",
        nvr: cameras.getNvrStatus(),
      },
    };
    outbox.enqueue(batch.batch_id, batch);
  }

  const rows = outbox.pending(10);
  for (const row of rows) {
    try {
      const res = await fetch(`${POLJE_API}/v1/ingest`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${INGEST_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: row.payload_json,
      });
      if (res.ok || res.status === 202) {
        outbox.markSent(row.id);
        starlink = "up";
      } else {
        console.error("ingest HTTP", res.status, await res.text());
        outbox.markAttempt(row.id);
        if (res.status >= 500) starlink = "down";
      }
    } catch (err) {
      console.error("ingest network error", err);
      outbox.markAttempt(row.id);
      starlink = "down";
    }
  }
}

function main() {
  if (!INGEST_TOKEN) {
    console.warn("INGEST_TOKEN empty — uploads will 401 until set");
  }

  const client = mqtt.connect(MQTT_URL, {
    reconnectPeriod: 2000,
    clientId: `polje-edge-${FARM_ID}-${Math.random().toString(16).slice(2, 8)}`,
  });

  client.on("connect", () => {
    mqttOk = "ok";
    const topic = `polje/${FARM_ID}/#`;
    client.subscribe(topic, (err) => {
      if (err) console.error("subscribe failed", err);
      else console.log("subscribed", topic);
    });
    client.publish(
      `polje/${FARM_ID}/sys/edge/health`,
      JSON.stringify({ ts: new Date().toISOString(), edge: "ok" }),
      { retain: true }
    );
  });

  client.on("offline", () => {
    mqttOk = "down";
  });

  client.on("message", (topic, payload) => {
    if (topic.includes("/sys/starlink")) {
      const text = payload.toString("utf8").trim().toLowerCase();
      if (text === "up" || text === "down") starlink = text;
      return;
    }
    if (topic.includes("/sys/edge/health")) return;
    pending.push(...normalizePayload(topic, payload));
  });

  setInterval(() => {
    void flushOnce();
  }, FLUSH_MS);

  // Snapshot interval (default 10 min) + urgent poll for snapshot.take commands
  void cameras.tick();
  setInterval(() => {
    void cameras.tick();
  }, SNAPSHOT_INTERVAL_SEC * 1000);
  setInterval(() => {
    void cameras.pollUrgent();
  }, 30000);

  createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        ok: true,
        service: "polje-edge",
        farm_id: FARM_ID,
        mqtt: mqttOk,
        starlink,
        nvr: cameras.getNvrStatus(),
        outbox_pending: outbox.pendingCount(),
      })
    );
  }).listen(PORT, () => {
    console.log(`polje-edge metrics on :${PORT}`);
  });
}

main();
