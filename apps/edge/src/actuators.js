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
 *   deviceIds?: string[],
 * }} opts
 */
export function createActuatorController(opts) {
  const { farmId, poljeApi, ingestToken, mqttPublish } = opts;
  /** @type {string[]} */
  let deviceIds = opts.deviceIds || [
    "valve-garden-drip",
    "valve-hay-frost",
  ];
  /** @type {Map<string, ReturnType<typeof setTimeout>>} */
  const timers = new Map();
  /** @type {Map<string, { slot: string, at: number }>} */
  const localScheduleFired = new Map();
  /** @type {unknown[]} */
  let schedulesCache = [];

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
    } catch (err) {
      console.warn("schedule poll", err.message || err);
    }
  }

  /**
   * Local schedule tick — runs even if WAN is down (uses last cached schedules).
   * When WAN is up, prefers cloud-created commands (dedupe via poll).
   */
  async function tickSchedules(wanUp) {
    const now = new Date();
    for (const s of schedulesCache) {
      if (!s || !s.enabled) continue;
      if (!isDueLocal(now, s.time_local, s.days_json, s.timezone || "Europe/Zagreb")) {
        continue;
      }
      const slot = `${s.id}:${dayKey(now, s.timezone || "Europe/Zagreb")}:${s.time_local}`;
      const prev = localScheduleFired.get(s.id);
      if (prev && prev.slot === slot) continue;

      localScheduleFired.set(s.id, { slot, at: Date.now() });

      if (wanUp) {
        // Cloud cron may already have inserted a command; poll will pick it up.
        // If no pending command appears, fall through to local MQTT after a short wait.
        await pollCommands();
        continue;
      }

      // Offline: fire locally with timeout
      const duration = Math.min(
        Math.max(Number(s.duration_sec) || 600, 30),
        HARD_CAP_SEC
      );
      const deviceId = s.device_id;
      if (!deviceId) {
        // schedule cache may lack device_id — look up from zone via last known
        console.warn("offline schedule missing device_id", s.id);
        continue;
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
      console.log("offline schedule run", s.id, deviceId, duration);
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
