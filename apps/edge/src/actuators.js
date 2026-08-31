/**
 * Irrigation actuators — Edge is write-leader.
 * Cloud command → MQTT cmnd → local timeout OFF → ACK.
 */

const HARD_CAP_SEC = 3600;

/**
 * @param {{
 *   farmId: string,
 *   poljeApi: string,
 *   ingestToken: string,
 *   mqttPublish: (topic: string, payload: string) => void,
 *   sqlite?: import("node:sqlite").DatabaseSync,
 *   deviceIds?: string[],
 * }} opts
 */
export function createActuatorController(opts) {
  const { farmId, poljeApi, ingestToken, mqttPublish, sqlite } = opts;
  /** @type {string[]} */
  let deviceIds = opts.deviceIds || [
    "valve-garden-drip",
    "valve-hay-frost",
  ];
  /** @type {Map<string, ReturnType<typeof setTimeout>>} */
  const timers = new Map();
  /** @type {Set<string>} */
  const firedMemory = new Set();
  /** @type {unknown[]} */
  let schedulesCache = [];

  if (sqlite) {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS irrigation_schedules_cache (
        id TEXT PRIMARY KEY,
        zone_id TEXT,
        device_id TEXT,
        time_local TEXT,
        days_json TEXT,
        duration_sec INTEGER,
        timezone TEXT,
        enabled INTEGER,
        payload_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS irrigation_schedule_fired (
        schedule_id TEXT NOT NULL,
        slot TEXT NOT NULL,
        fired_at TEXT NOT NULL,
        PRIMARY KEY (schedule_id, slot)
      );
      CREATE TABLE IF NOT EXISTS irrigation_offline_reports (
        id TEXT PRIMARY KEY,
        zone_id TEXT NOT NULL,
        device_id TEXT,
        schedule_id TEXT,
        duration_sec INTEGER NOT NULL,
        started_at TEXT NOT NULL,
        reason TEXT,
        flushed INTEGER NOT NULL DEFAULT 0
      );
    `);
    try {
      const rows = sqlite
        .prepare(`SELECT payload_json FROM irrigation_schedules_cache WHERE enabled = 1`)
        .all();
      schedulesCache = rows.map((r) => JSON.parse(r.payload_json));
    } catch {
      /* empty cache */
    }
  }

  function cmndTopic(deviceId) {
    return `polje/${farmId}/dev/${deviceId}/cmnd`;
  }

  /**
   * @param {string} deviceId
   * @param {boolean} on
   * @param {number} [durationSec]
   */
  function publishValve(deviceId, on, durationSec) {
    const payload = {
      on,
      ts: new Date().toISOString(),
      ...(on && durationSec
        ? { duration_sec: durationSec, timeout_sec: durationSec }
        : {}),
    };
    mqttPublish(cmndTopic(deviceId), JSON.stringify(payload));
  }

  /** Safe default: all irrigation valves OFF */
  function failsafeOff() {
    for (const id of deviceIds) {
      const t = timers.get(id);
      if (t) clearTimeout(t);
      timers.delete(id);
      publishValve(id, false);
    }
    console.log("actuators failsafe OFF", deviceIds.join(","));
  }

  /**
   * @param {string} cmdId
   * @param {string} status
   */
  async function patchCommand(cmdId, status) {
    if (!ingestToken) return;
    try {
      await fetch(`${poljeApi}/v1/commands/${cmdId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${ingestToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });
    } catch (err) {
      console.warn("patch command", cmdId, err.message || err);
    }
  }

  /**
   * @param {{
   *   id: string,
   *   device_id: string,
   *   payload_json: string | null,
   * }} cmd
   */
  async function executeValveOpen(cmd) {
    let duration = 600;
    try {
      const p = cmd.payload_json ? JSON.parse(cmd.payload_json) : {};
      if (typeof p.duration_sec === "number") duration = p.duration_sec;
      else if (typeof p.timeout_sec === "number") duration = p.timeout_sec;
    } catch {
      /* use default */
    }
    duration = Math.min(Math.max(duration, 30), HARD_CAP_SEC);

    const existing = timers.get(cmd.device_id);
    if (existing) clearTimeout(existing);

    publishValve(cmd.device_id, true, duration);
    console.log("valve.open", cmd.device_id, duration, "sec");

    timers.set(
      cmd.device_id,
      setTimeout(() => {
        publishValve(cmd.device_id, false);
        timers.delete(cmd.device_id);
        console.log("valve.timeout OFF", cmd.device_id);
      }, duration * 1000)
    );

    await patchCommand(cmd.id, "acked");
  }

  async function pollCommands() {
    if (!ingestToken) return;
    try {
      const q = new URLSearchParams({
        farm: farmId,
        status: "sent",
        action: "valve.open",
      });
      const res = await fetch(`${poljeApi}/v1/commands?${q}`, {
        headers: { Authorization: `Bearer ${ingestToken}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      for (const cmd of data.commands || []) {
        if (!deviceIds.includes(cmd.device_id)) {
          deviceIds = [...new Set([...deviceIds, cmd.device_id])];
        }
        await executeValveOpen(cmd);
      }
    } catch (err) {
      console.warn("actuator poll", err.message || err);
    }
  }

  async function refreshSchedules() {
    if (!ingestToken) return;
    try {
      const q = new URLSearchParams({ farm: farmId, enabled: "1" });
      const res = await fetch(`${poljeApi}/v1/irrigation/schedules?${q}`, {
        headers: { Authorization: `Bearer ${ingestToken}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      schedulesCache = data.schedules || [];
      if (sqlite) {
        const now = new Date().toISOString();
        sqlite.exec(`DELETE FROM irrigation_schedules_cache`);
        const ins = sqlite.prepare(
          `INSERT INTO irrigation_schedules_cache
             (id, zone_id, device_id, time_local, days_json, duration_sec, timezone, enabled, payload_json, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );
        for (const s of schedulesCache) {
          ins.run(
            s.id,
            s.zone_id || "",
            s.device_id || "",
            s.time_local || "",
            s.days_json || "[]",
            Number(s.duration_sec) || 600,
            s.timezone || "Europe/Zagreb",
            s.enabled ? 1 : 0,
            JSON.stringify(s),
            now
          );
        }
      }
    } catch (err) {
      console.warn("schedule poll", err.message || err);
      if (sqlite && schedulesCache.length === 0) {
        try {
          const rows = sqlite
            .prepare(`SELECT payload_json FROM irrigation_schedules_cache WHERE enabled = 1`)
            .all();
          schedulesCache = rows.map((r) => JSON.parse(r.payload_json));
        } catch {
          /* keep empty */
        }
      }
    }
  }

  /**
   * Local schedule tick — Edge is write-leader.
   * Due window fires MQTT even if WAN is up (unless this valve is already ON).
   * Cloud Cron is backup only. Offline fires are reported when WAN returns.
   */
  async function tickSchedules(wanUp) {
    if (wanUp) {
      await flushReports();
      await pollCommands();
    }
    const now = new Date();
    for (const s of schedulesCache) {
      if (!s || !s.enabled) continue;
      if (!isDueLocal(now, s.time_local, s.days_json, s.timezone || "Europe/Zagreb")) {
        continue;
      }
      const slot = `${s.id}:${dayKey(now, s.timezone || "Europe/Zagreb")}:${s.time_local}`;
      if (wasFired(s.id, slot)) continue;
      if (s.device_id && timers.has(s.device_id)) {
        markFired(s.id, slot);
        continue;
      }
      fireLocal(s);
      markFired(s.id, slot);
    }
    if (wanUp) await flushReports();
  }

  /**
   * @param {string} scheduleId
   * @param {string} slot
   */
  function wasFired(scheduleId, slot) {
    const key = `${scheduleId}:${slot}`;
    if (firedMemory.has(key)) return true;
    if (sqlite) {
      const row = sqlite
        .prepare(
          `SELECT slot FROM irrigation_schedule_fired WHERE schedule_id = ? AND slot = ?`
        )
        .get(scheduleId, slot);
      return !!row;
    }
    return false;
  }

  /**
   * @param {string} scheduleId
   * @param {string} slot
   */
  function markFired(scheduleId, slot) {
    firedMemory.add(`${scheduleId}:${slot}`);
    if (sqlite) {
      sqlite
        .prepare(
          `INSERT OR IGNORE INTO irrigation_schedule_fired (schedule_id, slot, fired_at)
           VALUES (?, ?, ?)`
        )
        .run(scheduleId, slot, new Date().toISOString());
    }
  }

  /** @param {any} s */
  function fireLocal(s) {
    const duration = Math.min(
      Math.max(Number(s.duration_sec) || 600, 30),
      HARD_CAP_SEC
    );
    const deviceId = s.device_id;
    if (!deviceId) {
      console.warn("offline schedule missing device_id", s.id);
      return;
    }
    if (!deviceIds.includes(deviceId)) deviceIds.push(deviceId);
    const existing = timers.get(deviceId);
    if (existing) clearTimeout(existing);
    publishValve(deviceId, true, duration);
    timers.set(
      deviceId,
      setTimeout(() => {
        publishValve(deviceId, false);
        timers.delete(deviceId);
      }, duration * 1000)
    );
    queueReport(s, duration);
    console.log("offline schedule run", s.id, deviceId, duration);
  }

  /**
   * @param {any} s
   * @param {number} duration
   */
  function queueReport(s, duration) {
    if (!sqlite || !s.zone_id) return;
    try {
      sqlite
        .prepare(
          `INSERT INTO irrigation_offline_reports
             (id, zone_id, device_id, schedule_id, duration_sec, started_at, reason, flushed)
           VALUES (?, ?, ?, ?, ?, ?, ?, 0)`
        )
        .run(
          crypto.randomUUID(),
          s.zone_id,
          s.device_id || "",
          s.id || "",
          duration,
          new Date().toISOString(),
          `schedule ${s.id || "local"}`
        );
    } catch (err) {
      console.warn("queue irrigation report", err.message || err);
    }
  }

  async function flushReports() {
    if (!sqlite || !ingestToken) return;
    let rows = [];
    try {
      rows = sqlite
        .prepare(`SELECT * FROM irrigation_offline_reports WHERE flushed = 0`)
        .all();
    } catch {
      return;
    }
    for (const r of rows) {
      try {
        const res = await fetch(`${poljeApi}/v1/ingest/irrigation-run`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${ingestToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            farm_id: farmId,
            zone_id: r.zone_id,
            duration_sec: r.duration_sec,
            started_at: r.started_at,
            reason: r.reason || undefined,
            schedule_id: r.schedule_id || undefined,
          }),
        });
        if (res.ok) {
          sqlite
            .prepare(`UPDATE irrigation_offline_reports SET flushed = 1 WHERE id = ?`)
            .run(r.id);
        } else {
          console.warn("irrigation report http", res.status, r.id);
        }
      } catch (err) {
        console.warn("irrigation report", r.id, err.message || err);
      }
    }
  }

  return {
    failsafeOff,
    pollCommands,
    refreshSchedules,
    tickSchedules,
    getDeviceIds: () => [...deviceIds],
    setDeviceIds: (ids) => {
      deviceIds = [...ids];
    },
  };
}

/**
 * @param {Date} now
 * @param {string} timeLocal
 * @param {string} daysJson
 * @param {string} timezone
 */
function isDueLocal(now, timeLocal, daysJson, timezone) {
  const [hh, mm] = timeLocal.split(":").map(Number);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return false;
  let days = [];
  try {
    days = JSON.parse(daysJson);
  } catch {
    return false;
  }
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const bits = fmt.formatToParts(now);
  const hour = Number(bits.find((p) => p.type === "hour")?.value);
  const minute = Number(bits.find((p) => p.type === "minute")?.value);
  const weekday = bits.find((p) => p.type === "weekday")?.value ?? "";
  const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dow = dayMap[weekday];
  if (dow === undefined || !days.includes(dow)) return false;
  const nowMins = hour * 60 + minute;
  const target = hh * 60 + mm;
  return nowMins >= target && nowMins < target + 2;
}

/**
 * @param {Date} now
 * @param {string} timezone
 */
function dayKey(now, timezone) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
