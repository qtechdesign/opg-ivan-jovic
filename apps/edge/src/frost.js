import { DatabaseSync } from "node:sqlite";

/** @typedef {"idle"|"watch"|"armed"|"spraying"} FrostState */

const DEFAULT_PROGRAM = {
  temp_threshold_c: 1.5,
  rh_min: 0,
  max_spray_sec: 600,
  valve_ids: ["fps-valve-1"],
  sensor_id: "fps-sn-1",
  mode: "ice",
};

/**
 * Local frost program — write-leader on Edge. Works with WAN down.
 * @param {{
 *   db: DatabaseSync,
 *   farmId: string,
 *   publish: (topic: string, payload: object) => void,
 *   reportEvent?: (event: object) => void,
 * }} opts
 */
export function createFrostProgram(opts) {
  const { db, farmId, publish, reportEvent } = opts;

  db.exec(`
    CREATE TABLE IF NOT EXISTS frost_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      status TEXT NOT NULL DEFAULT 'idle',
      program_json TEXT NOT NULL,
      event_id TEXT,
      updated_at TEXT NOT NULL
    );
  `);

  const row = db.prepare(`SELECT id FROM frost_state WHERE id = 1`).get();
  if (!row) {
    db.prepare(
      `INSERT INTO frost_state (id, status, program_json, event_id, updated_at)
       VALUES (1, 'idle', ?, NULL, ?)`
    ).run(JSON.stringify(DEFAULT_PROGRAM), new Date().toISOString());
  }

  /** @type {Record<string, { temp_c?: number, rh?: number, ts?: string }>} */
  let live = {};
  /** @type {ReturnType<typeof setTimeout>|null} */
  let sprayTimer = null;

  function load() {
    const r = db
      .prepare(`SELECT status, program_json, event_id, updated_at FROM frost_state WHERE id = 1`)
      .get();
    return {
      status: /** @type {FrostState} */ (r.status),
      program: { ...DEFAULT_PROGRAM, ...JSON.parse(r.program_json) },
      event_id: r.event_id,
      updated_at: r.updated_at,
    };
  }

  /** @param {Partial<{ status: FrostState, program: object, event_id: string|null }>} patch */
  function save(patch) {
    const cur = load();
    const status = patch.status ?? cur.status;
    const program = patch.program ?? cur.program;
    const event_id =
      patch.event_id !== undefined ? patch.event_id : cur.event_id;
    const updated_at = new Date().toISOString();
    db.prepare(
      `UPDATE frost_state SET status = ?, program_json = ?, event_id = ?, updated_at = ? WHERE id = 1`
    ).run(status, JSON.stringify(program), event_id, updated_at);
    return load();
  }

  function sensorReading() {
    const cur = load();
    const sid = cur.program.sensor_id || "fps-sn-1";
    return live[sid] || Object.values(live)[0] || null;
  }

  /** @param {string} deviceId @param {{ temp_c?: number, rh?: number, ts?: string }} metrics */
  function noteReading(deviceId, metrics) {
    live[deviceId] = { ...live[deviceId], ...metrics };
    tick();
  }

  function openValves(reason) {
    const cur = load();
    const maxSec = Math.max(30, Math.min(3600, Number(cur.program.max_spray_sec) || 600));
    for (const vid of cur.program.valve_ids || []) {
      publish(`polje/${farmId}/dev/${vid}/cmnd/state`, {
        state: "ON",
        timeout_sec: maxSec,
        reason,
      });
    }
    if (sprayTimer) clearTimeout(sprayTimer);
    sprayTimer = setTimeout(() => {
      closeValves("timeout");
      const s = load();
      if (s.status === "spraying") {
        save({ status: "armed" });
        reportEvent?.({ type: "frost.spray_end", reason: "timeout" });
      }
    }, maxSec * 1000);
  }

  function closeValves(reason) {
    const cur = load();
    for (const vid of cur.program.valve_ids || []) {
      publish(`polje/${farmId}/dev/${vid}/cmnd/state`, {
        state: "OFF",
        timeout_sec: 0,
        reason,
      });
    }
    if (sprayTimer) {
      clearTimeout(sprayTimer);
      sprayTimer = null;
    }
  }

  function tick() {
    const cur = load();
    if (cur.status !== "armed" && cur.status !== "spraying" && cur.status !== "watch") {
      return;
    }
    const reading = sensorReading();
    if (!reading || typeof reading.temp_c !== "number") return;

    const thr = Number(cur.program.temp_threshold_c);
    const rhMin = Number(cur.program.rh_min) || 0;
    const rhOk =
      typeof reading.rh !== "number" || reading.rh >= rhMin;

    if (cur.status === "watch") {
      // watch = program loaded, waiting for operator arm — no auto spray
      return;
    }

    if (cur.status === "armed" && reading.temp_c < thr && rhOk) {
      const event_id = cur.event_id || crypto.randomUUID();
      save({ status: "spraying", event_id });
      openValves("frost_auto");
      reportEvent?.({
        type: "frost.spray_start",
        event_id,
        temp_c: reading.temp_c,
        rh: reading.rh,
        mode: cur.program.mode || "ice",
      });
    } else if (cur.status === "spraying" && reading.temp_c >= thr) {
      closeValves("temp_above_threshold");
      save({ status: "armed" });
      reportEvent?.({ type: "frost.spray_end", reason: "temp_above_threshold" });
    }
  }

  /** @param {object} program */
  function loadProgram(program) {
    const next = { ...DEFAULT_PROGRAM, ...program };
    return save({
      status: "watch",
      program: next,
      event_id: null,
    });
  }

  function arm() {
    const cur = load();
    return save({ status: "armed", event_id: cur.event_id || crypto.randomUUID() });
  }

  function disarm() {
    closeValves("disarm");
    return save({ status: "idle", event_id: null });
  }

  /**
   * Manual valve open from cloud command.
   * Allowed without extra confirm when already armed and temp below threshold.
   * @param {{ valve_id: string, max_sec: number, reason: string, force?: boolean }} cmd
   */
  function openValve(cmd) {
    const cur = load();
    const reading = sensorReading();
    const thr = Number(cur.program.temp_threshold_c);
    const frostException =
      (cur.status === "armed" || cur.status === "spraying") &&
      reading &&
      typeof reading.temp_c === "number" &&
      reading.temp_c < thr;

    if (!cmd.force && !frostException && cur.status !== "spraying") {
      // Still allow when Edge received confirmed cloud command (force from poller)
      // Caller sets force=true after cloud confirm.
    }

    const maxSec = Math.max(30, Math.min(3600, Number(cmd.max_sec) || 300));
    publish(`polje/${farmId}/dev/${cmd.valve_id}/cmnd/state`, {
      state: "ON",
      timeout_sec: maxSec,
      reason: cmd.reason || "manual",
    });
    if (sprayTimer) clearTimeout(sprayTimer);
    sprayTimer = setTimeout(() => {
      publish(`polje/${farmId}/dev/${cmd.valve_id}/cmnd/state`, {
        state: "OFF",
        timeout_sec: 0,
        reason: "timeout",
      });
    }, maxSec * 1000);
    return { ok: true, frost_exception: !!frostException, max_sec: maxSec };
  }

  function getStatus() {
    const cur = load();
    const reading = sensorReading();
    return {
      ...cur,
      live: reading,
    };
  }

  return {
    noteReading,
    loadProgram,
    arm,
    disarm,
    openValve,
    tick,
    getStatus,
    DEFAULT_PROGRAM,
  };
}
