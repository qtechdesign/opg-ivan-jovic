import { createServer } from "node:http";
import { mkdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import mqtt from "mqtt";
import { Outbox } from "./outbox.js";
import { createCameraGrabber } from "./cameras.js";
import { createClimateLoop } from "./climate.js";
import { createFrostProgram } from "./frost.js";
import { createActuatorController } from "./actuators.js";

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
const CLIMATE_TICK_MS = Number(process.env.CLIMATE_TICK_MS || "15000");
const WAN_HOLD_MS = Number(process.env.CLIMATE_WAN_HOLD_MS || String(15 * 60 * 1000));

/** @type {{ device_id: string, metric: string, value: number, ts: string }[]} */
const pending = [];
/** @type {"up"|"down"} */
let starlink = "up";
let mqttOk = "down";
let lastWanOk = Date.now();
/** @type {"ok"|"down"|"unconfigured"} */
let gatewayHealth = "unconfigured";
let gatewaySeenAt = null;

mkdirSync(DATA_DIR, { recursive: true });
const outbox = new Outbox(`${DATA_DIR}/edge.db`);
const frostDb = new DatabaseSync(`${DATA_DIR}/frost.db`);

/** @type {import("mqtt").MqttClient | null} */
let mqttClient = null;

const cameras = createCameraGrabber({
  dataDir: DATA_DIR,
  poljeApi: POLJE_API,
  ingestToken: INGEST_TOKEN,
  farmId: FARM_ID,
  go2rtcUrl: GO2RTC_URL,
});

const climate = createClimateLoop({
  db: outbox.db,
  farmId: FARM_ID,
  poljeApi: POLJE_API,
  ingestToken: INGEST_TOKEN,
  mqttPublish: (topic, payload) => {
    if (!mqttClient?.connected) return;
    mqttClient.publish(topic, payload, { qos: 1 });
  },
  wanOk: () => Date.now() - lastWanOk < WAN_HOLD_MS,
});

const frost = createFrostProgram({
  db: frostDb,
  farmId: FARM_ID,
  publish: (topic, payload) => {
    if (!mqttClient?.connected) return;
    mqttClient.publish(topic, JSON.stringify(payload));
  },
  reportEvent: (event) => {
    if (event.type === "frost.spray_start" && event.event_id) {
      pending.push({
        device_id: "fps-gw-1",
        metric: "frost_active",
        value: 1,
        ts: new Date().toISOString(),
      });
    }
    if (event.type === "frost.spray_end") {
      pending.push({
        device_id: "fps-gw-1",
        metric: "frost_active",
        value: 0,
        ts: new Date().toISOString(),
      });
    }
    if (!INGEST_TOKEN || !event.event_id) return;
    void fetch(`${POLJE_API}/v1/frost/events`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${INGEST_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        farm_id: FARM_ID,
        event_id: event.event_id,
        type: event.type,
        temp_c: event.temp_c,
        rh: event.rh,
        mode: event.mode,
        reason: event.reason,
      }),
    }).catch((err) => console.warn("frost event ingest", err.message || err));
  },
});

/**
 * @param {string} topic
 * @returns {{ kind: "dev"|"fps"|"gw"|"other", id: string|null }}
 */
function parseTopic(topic) {
  let m = /^polje\/[^/]+\/dev\/([^/]+)\/stat/.exec(topic);
  if (m) return { kind: "dev", id: m[1] };
  m = /^polje\/[^/]+\/fps\/([^/]+)\/stat/.exec(topic);
  if (m) return { kind: "fps", id: m[1] };
  m = /^polje\/[^/]+\/gw\/([^/]+)\/health/.exec(topic);
  if (m) return { kind: "gw", id: m[1] };
  return { kind: "other", id: null };
}

/**
 * @param {string} topic
 * @param {Buffer} raw
 */
function normalizePayload(topic, raw) {
  const parsed = parseTopic(topic);
  if (parsed.kind === "gw" && parsed.id) {
    let data;
    try {
      data = JSON.parse(raw.toString("utf8"));
    } catch {
      return [];
    }
    gatewayHealth = data.ok === false ? "down" : "ok";
    gatewaySeenAt = new Date().toISOString();
    const ts = typeof data.ts === "string" ? data.ts : gatewaySeenAt;
    /** @type {{ device_id: string, metric: string, value: number, ts: string }[]} */
    const out = [];
    if (typeof data.packets === "number") {
      out.push({ device_id: parsed.id, metric: "packets", value: data.packets, ts });
    }
    if (typeof data.nodes === "number") {
      out.push({ device_id: parsed.id, metric: "nodes", value: data.nodes, ts });
    }
    return out;
  }

  if (parsed.kind !== "dev" && parsed.kind !== "fps") return [];
  const device_id = parsed.id;
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
    tp1: "temp_c",
    rh: "rh",
    hum: "rh",
    soil: "moisture",
    soi: "moisture",
    moisture: "moisture",
    vbat: "battery_v",
    battery_v: "battery_v",
    battery_pct: "battery_pct",
    bat: "battery_pct",
    lux: "lux",
    on: "valve_open",
    valve_open: "valve_open",
    packets: "packets",
    nodes: "nodes",
    wsp: "wind_ms",
    wdr: "wind_deg",
    w: "w",
    kwh: "kwh",
    kwh_today: "kwh_today",
  };
  /** @type {Record<string, number>} */
  const seen = {};
  for (const [k, metric] of Object.entries(map)) {
    if (typeof data[k] !== "number" && typeof data[k] !== "boolean") continue;
    let value = typeof data[k] === "boolean" ? (data[k] ? 1 : 0) : data[k];
    if ((k === "soi" || k === "soil") && value > 1) value = value / 100;
    if (seen[metric] != null) continue;
    seen[metric] = value;
    out.push({ device_id, metric, value, ts });
  }

  const frostMetrics = {};
  if (seen.temp_c != null) frostMetrics.temp_c = seen.temp_c;
  if (seen.rh != null) frostMetrics.rh = seen.rh;
  if (Object.keys(frostMetrics).length) {
    frost.noteReading(device_id, { ...frostMetrics, ts });
  }

  return out;
}

async function flushOnce() {
  const frostStatus = frost.getStatus();
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
        gateway: gatewayHealth,
        nvr: cameras.getNvrStatus(),
        frost: frostStatus.status,
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
        lastWanOk = Date.now();
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

async function pollFrostCommands() {
  if (!INGEST_TOKEN) return;
  try {
    const actions = [
      "fps.program.load",
      "fps.arm",
      "fps.disarm",
      "fps.valve.open",
    ];
    for (const action of actions) {
      const url = `${POLJE_API}/v1/commands?farm=${encodeURIComponent(FARM_ID)}&status=sent&action=${encodeURIComponent(action)}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${INGEST_TOKEN}` },
      });
      if (!res.ok) continue;
      const data = await res.json();
      for (const cmd of data.commands || []) {
        let payload = {};
        try {
          payload = cmd.payload_json ? JSON.parse(cmd.payload_json) : {};
        } catch {
          payload = {};
        }
        try {
          if (action === "fps.program.load") {
            frost.loadProgram(payload.program || payload);
          } else if (action === "fps.arm") {
            frost.arm();
          } else if (action === "fps.disarm") {
            frost.disarm();
          } else if (action === "fps.valve.open") {
            frost.openValve({
              valve_id: cmd.device_id || payload.valve_id,
              max_sec: payload.max_sec || 300,
              reason: payload.reason || "cloud",
              force: true,
            });
          }
          await fetch(`${POLJE_API}/v1/commands/${cmd.id}`, {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${INGEST_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ status: "acked" }),
          });
        } catch (err) {
          console.error("frost command failed", action, err);
          await fetch(`${POLJE_API}/v1/commands/${cmd.id}`, {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${INGEST_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ status: "failed" }),
          });
        }
      }
    }
  } catch (err) {
    console.warn("pollFrostCommands", err.message || err);
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
  mqttClient = client;

  const actuators = createActuatorController({
    farmId: FARM_ID,
    poljeApi: POLJE_API,
    ingestToken: INGEST_TOKEN,
    sqlite: outbox.db,
    mqttPublish: (topic, payload) => {
      client.publish(topic, payload, { qos: 1 });
    },
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
    actuators.failsafeOff();
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
    if (topic.includes("/cmnd")) return;
    const readings = normalizePayload(topic, payload);
    for (const r of readings) {
      climate.putMetric(r.device_id, r.metric, r.value, r.ts);
    }
    pending.push(...readings);
  });

  setInterval(() => {
    void flushOnce();
  }, FLUSH_MS);

  void cameras.tick();
  setInterval(() => {
    void cameras.tick();
  }, SNAPSHOT_INTERVAL_SEC * 1000);
  setInterval(() => {
    void cameras.pollUrgent();
  }, 30000);
  setInterval(() => {
    void pollFrostCommands();
  }, 5000);
  setInterval(() => {
    void climate.pollCommands();
    climate.tickLocal();
  }, CLIMATE_TICK_MS);
  setInterval(() => {
    void climate.refreshFromCloud();
  }, 120000);
  void climate.refreshFromCloud();
  setInterval(() => {
    void actuators.pollCommands();
  }, 15000);
  setInterval(() => {
    void actuators.refreshSchedules();
    void actuators.tickSchedules(starlink === "up" && mqttOk === "ok");
  }, 60000);
  void actuators.refreshSchedules();
  setInterval(() => {
    frost.tick();
    // Mark gateway down if no health for 10 min
    if (
      gatewaySeenAt &&
      Date.now() - Date.parse(gatewaySeenAt) > 10 * 60 * 1000
    ) {
      gatewayHealth = "down";
    }
  }, 15000);

  createServer((_req, res) => {
    const fs = frost.getStatus();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        ok: true,
        service: "polje-edge",
        farm_id: FARM_ID,
        mqtt: mqttOk,
        starlink,
        gateway: gatewayHealth,
        nvr: cameras.getNvrStatus(),
        frost: fs.status,
        frost_live: fs.live,
        actuators: actuators.getDeviceIds(),
        outbox_pending: outbox.pendingCount(),
      })
    );
  }).listen(PORT, () => {
    console.log(`polje-edge metrics on :${PORT}`);
  });
}

main();
