import mqtt from "mqtt";

const FARM_ID = process.env.FARM_ID || "ivan-jovic";
const MQTT_URL = process.env.MQTT_URL || "mqtt://127.0.0.1:1883";
const INTERVAL_MS = Number(process.env.SIM_INTERVAL_MS || "10000");

const client = mqtt.connect(MQTT_URL, {
  clientId: `polje-sim-${Math.random().toString(16).slice(2, 8)}`,
});

client.on("connect", () => {
  console.log("simulator connected", MQTT_URL);
  setInterval(() => {
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
    client.publish(
      `polje/${FARM_ID}/dev/soil-n-1/stat`,
      JSON.stringify(soil)
    );
    client.publish(
      `polje/${FARM_ID}/dev/temp-yard-1/stat`,
      JSON.stringify(yard)
    );
    client.publish(`polje/${FARM_ID}/sys/starlink`, "up", { retain: true });
    console.log("published", ts, soil.soil.toFixed(2), yard.t.toFixed(1));
  }, INTERVAL_MS);
});
