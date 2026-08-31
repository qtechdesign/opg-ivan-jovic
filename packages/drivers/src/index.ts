/** Shared device driver contract for FPS + OTS devices. */

export type DriverKind =
  | "sensor"
  | "actuator"
  | "camera"
  | "inverter"
  | "gateway"
  | "lora-node";

export type DriverProtocol = "lora" | "mqtt" | "http" | "modbus" | "rtsp" | string;

export type DecodedReading = {
  metric: string;
  value: number;
};

export type DeviceDriver = {
  id: string;
  kind: DriverKind;
  protocol: DriverProtocol;
  /** Decode a tiny MQTT/JSON payload into metric readings. */
  decode: (payload: Record<string, unknown>) => DecodedReading[];
  /** Actuator writes require timeout_sec (fps-valve). */
  requiresTimeout?: boolean;
};

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export const mqttGeneric: DeviceDriver = {
  id: "mqtt-generic",
  kind: "sensor",
  protocol: "mqtt",
  decode(payload) {
    const out: DecodedReading[] = [];
    const map: Record<string, string> = {
      t: "temp_c",
      temp_c: "temp_c",
      rh: "rh",
      soil: "moisture",
      moisture: "moisture",
      vbat: "battery_pct",
      lux: "lux",
    };
    for (const [k, metric] of Object.entries(map)) {
      const v = num(payload[k]);
      if (v != null) out.push({ metric, value: v });
    }
    return out;
  },
};

export const fpsSensorNode: DeviceDriver = {
  id: "fps-sensor-node",
  kind: "lora-node",
  protocol: "lora",
  decode(payload) {
    const out: DecodedReading[] = [];
    const map: Record<string, string> = {
      t: "temp_c",
      temp_c: "temp_c",
      tp1: "temp_c",
      rh: "rh",
      hum: "rh",
      soil: "moisture",
      soi: "moisture",
      moisture: "moisture",
      vbat: "battery_pct",
      bat: "battery_pct",
      lux: "lux",
      wsp: "wind_ms",
      wdr: "wind_deg",
    };
    for (const [k, metric] of Object.entries(map)) {
      let v = num(payload[k]);
      if (v == null) continue;
      if ((k === "soi" || k === "soil") && v > 1) v = v / 100;
      // avoid duplicate metrics if both aliases present
      if (out.some((r) => r.metric === metric)) continue;
      out.push({ metric, value: v });
    }
    return out;
  },
};

export const fpsValve: DeviceDriver = {
  id: "fps-valve",
  kind: "actuator",
  protocol: "lora",
  requiresTimeout: true,
  decode(payload) {
    const out: DecodedReading[] = [];
    const on = payload.on ?? payload.valve_open;
    if (typeof on === "boolean") {
      out.push({ metric: "valve_open", value: on ? 1 : 0 });
    } else {
      const v = num(on);
      if (v != null) out.push({ metric: "valve_open", value: v });
    }
    const t = num(payload.t) ?? num(payload.tp1) ?? num(payload.temp_c);
    if (t != null) out.push({ metric: "temp_c", value: t });
    const bat = num(payload.vbat) ?? num(payload.bat);
    if (bat != null) out.push({ metric: "battery_pct", value: bat });
    return out;
  },
};

export const fpsLoraGw: DeviceDriver = {
  id: "fps-lora-gw",
  kind: "gateway",
  protocol: "lora",
  decode(payload) {
    const out: DecodedReading[] = [];
    const packets = num(payload.packets);
    if (packets != null) out.push({ metric: "packets", value: packets });
    const nodes = num(payload.nodes);
    if (nodes != null) out.push({ metric: "nodes", value: nodes });
    return out;
  },
};

export const DRIVERS: Record<string, DeviceDriver> = {
  "mqtt-generic": mqttGeneric,
  "fps-sensor-node": fpsSensorNode,
  "fps-valve": fpsValve,
  "fps-lora-gw": fpsLoraGw,
};

export function getDriver(id: string): DeviceDriver | undefined {
  return DRIVERS[id];
}
