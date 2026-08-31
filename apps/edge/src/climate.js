import { DatabaseSync } from "node:sqlite";

/**
 * Local climate failsafe: cache setpoints, heater timeout, battery lockout.
 * Cloud is not the only safety layer.
 */

/**
 * @param {DatabaseSync} db
 */
export function ensureClimateTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS climate_cache (
      zone_id TEXT PRIMARY KEY,
      heat_c REAL,
      cool_c REAL,
      heater_id TEXT,
      cooler_id TEXT,
      sensor_id TEXT,
      battery_id TEXT,
      timeout_sec INTEGER,
      heat_battery_min_pct INTEGER,
      updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS heater_timeout (
      device_id TEXT PRIMARY KEY,
      on_until TEXT,
      updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS metric_cache (
      device_id TEXT NOT NULL,
      metric TEXT NOT NULL,
      value REAL NOT NULL,
      ts TEXT NOT NULL,
      PRIMARY KEY (device_id, metric)
    );
  `);
}

/**
 * @param {{
 *   db: DatabaseSync,
 *   farmId: string,
 *   poljeApi: string,
 *   ingestToken: string,
 *   mqttPublish: (topic: string, payload: string) => void,
 *   wanOk: () => boolean,
 * }} opts
 */
export function createClimateLoop(opts) {
  const { db, farmId, poljeApi, ingestToken, mqttPublish, wanOk } = opts;
  ensureClimateTables(db);

  function putMetric(deviceId, metric, value, ts) {
    db.prepare(
      `INSERT INTO metric_cache (device_id, metric, value, ts)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(device_id, metric) DO UPDATE SET value = excluded.value, ts = excluded.ts`
    ).run(deviceId, metric, value, ts);
  }

  function getMetric(deviceId, metric) {
    return db
      .prepare(
        `SELECT value, ts FROM metric_cache WHERE device_id = ? AND metric = ?`
      )
      .get(deviceId, metric);
  }

  function cacheSetpoint(payload) {
    const zoneId = payload.zone_id;
    if (!zoneId) return;
    db.prepare(
      `INSERT INTO climate_cache
        (zone_id, heat_c, cool_c, heater_id, cooler_id, sensor_id, battery_id, timeout_sec, heat_battery_min_pct, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(zone_id) DO UPDATE SET
         heat_c = excluded.heat_c,
         cool_c = excluded.cool_c,
         heater_id = excluded.heater_id,
         cooler_id = excluded.cooler_id,
         sensor_id = excluded.sensor_id,
         battery_id = excluded.battery_id,
         timeout_sec = excluded.timeout_sec,
         heat_battery_min_pct = excluded.heat_battery_min_pct,
         updated_at = excluded.updated_at`
    ).run(
      zoneId,
      payload.heat_c,
      payload.cool_c,
      payload.heater_id ?? null,
      payload.cooler_id ?? null,
      payload.sensor_id ?? null,
      payload.battery_id ?? "ups-1",
      payload.timeout_sec ?? 1800,
      payload.heat_battery_min_pct ?? 30,
      new Date().toISOString()
    );
  }

  function heaterOff(heaterId, reason) {
    if (!heaterId) return;
    mqttPublish(
      `polje/${farmId}/dev/${heaterId}/cmnd`,
      JSON.stringify({ state: "OFF", timeout_sec: 0, reason })
    );
    db.prepare(`DELETE FROM heater_timeout WHERE device_id = ?`).run(heaterId);
  }

  function heaterOn(heaterId, timeoutSec, reason) {
    if (!heaterId) return;
    const until = new Date(Date.now() + timeoutSec * 1000).toISOString();
    mqttPublish(
      `polje/${farmId}/dev/${heaterId}/cmnd`,
      JSON.stringify({ state: "ON", timeout_sec: timeoutSec, reason })
    );
    db.prepare(
      `INSERT INTO heater_timeout (device_id, on_until, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(device_id) DO UPDATE SET on_until = excluded.on_until, updated_at = excluded.updated_at`
    ).run(heaterId, until, new Date().toISOString());
  }

  function batteryOk(batteryId, minPct) {
    const row = getMetric(batteryId || "ups-1", "battery_pct");
    if (!row) return false;
    return row.value >= minPct;
  }

  async function pollCommands() {
    if (!ingestToken || !wanOk()) return;
    try {
      const q = new URLSearchParams({
        farm: farmId,
        status: "sent",
        action: "setpoint.set",
      });
      const res = await fetch(`${poljeApi}/v1/commands?${q}`, {
        headers: { Authorization: `Bearer ${ingestToken}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      for (const cmd of data.commands || []) {
        let payload = {};
        try {
          payload = JSON.parse(cmd.payload_json || "{}");
        } catch {
          payload = {};
        }
        cacheSetpoint(payload);
        await fetch(`${poljeApi}/v1/commands/${cmd.id}`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${ingestToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: "acked" }),
        });
      }
    } catch (err) {
      console.warn("climate poll commands", err.message || err);
    }
  }

  async function refreshFromCloud() {
    if (!wanOk()) return;
    try {
      const res = await fetch(
        `${poljeApi}/v1/climate/now?farm=${encodeURIComponent(farmId)}`
      );
      if (!res.ok) return;
      const data = await res.json();
      for (const z of data.zones || []) {
        cacheSetpoint({
          zone_id: z.id,
          heat_c: z.heat_c,
          cool_c: z.cool_c,
          heater_id: z.heater_id,
          cooler_id: z.cooler_id,
          sensor_id: z.sensor_id,
          battery_id: z.battery_id,
          timeout_sec: z.timeout_sec,
          heat_battery_min_pct: data.heat_battery_min_pct,
        });
      }
    } catch (err) {
      console.warn("climate now fetch", err.message || err);
    }
  }

  function tickLocal() {
    const now = Date.now();
    const timeouts = db
      .prepare(`SELECT device_id, on_until FROM heater_timeout`)
      .all();
    for (const t of timeouts) {
      if (Date.parse(t.on_until) <= now) {
        heaterOff(t.device_id, "local_timeout");
      }
    }

    const zones = db.prepare(`SELECT * FROM climate_cache`).all();
    for (const z of zones) {
      if (!z.heater_id) continue;
      const minPct = z.heat_battery_min_pct ?? 30;
      if (!batteryOk(z.battery_id, minPct)) {
        heaterOff(z.heater_id, "heat_lockout");
        continue;
      }
      const temp = z.sensor_id
        ? getMetric(z.sensor_id, "temp_c")
        : null;
      if (!temp) continue;
      if (temp.value < z.heat_c) {
        heaterOn(z.heater_id, z.timeout_sec || 1800, "below_heat_setpoint");
      } else {
        heaterOff(z.heater_id, "at_or_above_heat_setpoint");
      }
    }
  }

  return {
    putMetric,
    pollCommands,
    refreshFromCloud,
    tickLocal,
  };
}
