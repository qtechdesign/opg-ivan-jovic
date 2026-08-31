import mqtt from "mqtt";

const FARM_ID = process.env.FARM_ID || "ivan-jovic";
const MQTT_URL = process.env.MQTT_URL || "mqtt://127.0.0.1:1883";
const INTERVAL_MS = Number(process.env.SIM_INTERVAL_MS || "10000");
const FROST_SIM = process.env.FROST_SIM === "1";

const client = mqtt.connect(MQTT_URL, {
  clientId: `polje-sim-${Math.random().toString(16).slice(2, 8)}`,
});

let tick = 0;

/** @type {Map<string, ReturnType<typeof setTimeout>>} */
const valveTimers = new Map();
const VALVES = ["valve-garden-drip", "valve-hay-frost"];

/**
 * @param {string} deviceId
 * @param {boolean} on
 */
function publishValveStat(deviceId, on) {
  client.publish(
    `polje/${FARM_ID}/dev/${deviceId}/stat`,
    JSON.stringify({ ts: new Date().toISOString(), on }),
    { retain: true }
  );
}

client.on("connect", () => {
  console.log("simulator connected", MQTT_URL, FROST_SIM ? "(frost sim)" : "");

  for (const id of VALVES) {
    client.subscribe(`polje/${FARM_ID}/dev/${id}/cmnd`);
    publishValveStat(id, false);
  }
  client.subscribe(`polje/${FARM_ID}/dev/heater-house-1/cmnd`);

  client.on("message", (topic, raw) => {
    const m = new RegExp(`^polje/${FARM_ID}/dev/([^/]+)/cmnd$`).exec(topic);
    if (!m) return;
    const deviceId = m[1];
    let data;
    try {
      data = JSON.parse(raw.toString("utf8"));
    } catch {
      return;
    }
    const on =
      data.state === "ON" ||
      data.state === "on" ||
      data.on === true ||
      data.on === 1;
    const duration = Math.min(
      Math.max(Number(data.duration_sec || data.timeout_sec) || 0, 0),
      3600
    );
    const prev = valveTimers.get(deviceId);
    if (prev) clearTimeout(prev);
    publishValveStat(deviceId, on);
    console.log("valve sim", deviceId, on ? "ON" : "OFF", duration || "");
    if (on && duration > 0) {
      valveTimers.set(
        deviceId,
        setTimeout(() => {
          publishValveStat(deviceId, false);
          valveTimers.delete(deviceId);
          console.log("valve sim auto-off", deviceId);
        }, duration * 1000)
      );
    }
  });

  setInterval(() => {
    tick += 1;
    const ts = new Date().toISOString();
    const soil = {
      ts,
      soil: 0.25 + Math.random() * 0.15,
      t: 12 + Math.random() * 8,
    };
    const yard = {
      ts,
      t: 10 + Math.random() * 10,
      rh: 60 + Math.random() * 30,
    };
    const house = {
      ts,
      t: 16 + Math.random() * 4,
      rh: 50 + Math.random() * 20,
    };

    // FPS sensor — cold night when FROST_SIM
    const fpsTemp = FROST_SIM
      ? -1.5 + Math.sin(tick / 5) * 0.8
      : 4 + Math.random() * 6;
    const fps = {
      ts,
      t: fpsTemp,
      rh: FROST_SIM ? 96 + Math.random() * 3 : 70 + Math.random() * 20,
      soil: 0.3 + Math.random() * 0.1,
      vbat: 12.2 + Math.random() * 0.4,
      lux: FROST_SIM ? 0 : 100 + Math.random() * 400,
    };
    const gw = {
      ts,
      ok: true,
      packets: tick * 2,
      nodes: 2,
      gw: "fps-gw-1",
    };

    client.publish(
      `polje/${FARM_ID}/dev/soil-n-1/stat`,
      JSON.stringify(soil)
    );
    client.publish(
      `polje/${FARM_ID}/dev/temp-yard-1/stat`,
      JSON.stringify(yard)
    );
    client.publish(
      `polje/${FARM_ID}/fps/fps-sn-1/stat`,
      JSON.stringify(fps)
    );
    client.publish(
      `polje/${FARM_ID}/dev/fps-sn-1/stat`,
      JSON.stringify(fps)
    );
    client.publish(
      `polje/${FARM_ID}/gw/fps-gw-1/health`,
      JSON.stringify(gw),
      { retain: true }
    );
    client.publish(
      `polje/${FARM_ID}/dev/temp-house-1/stat`,
      JSON.stringify(house)
    );
    const sun = Math.max(0, Math.sin((Date.now() / 1000 / 3600) % 24) * 2800);
    const inv = {
      ts,
      w: Math.round(sun + Math.random() * 80),
      kwh: 12 + (Date.now() % 86400000) / 86400000 * 8,
      kwh_today: (Date.now() % 86400000) / 86400000 * 8,
    };
    client.publish(
      `polje/${FARM_ID}/dev/inv-1/stat`,
      JSON.stringify(inv)
    );
    const ups = {
      ts,
      battery_pct: 55 + Math.random() * 30,
      vbat: 12.4 + Math.random() * 0.4,
    };
    client.publish(
      `polje/${FARM_ID}/dev/ups-1/stat`,
      JSON.stringify(ups)
    );
    client.publish(`polje/${FARM_ID}/sys/starlink`, "up", { retain: true });
    console.log(
      "published",
      ts,
      "soil",
      soil.soil.toFixed(2),
      "fps",
      fps.t.toFixed(1)
    );
  }, INTERVAL_MS);
});
