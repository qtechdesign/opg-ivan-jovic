import {
  AutomationActionSchema,
  AutomationTriggerSchema,
  LOW_RISK_COMMAND_ACTIONS,
  riskForAction,
  type AutomationAction,
  type AutomationTrigger,
  type JobKind,
} from "@polje/schema";
import { writeAudit } from "./audit";

/** Live DO snapshot shape used by the rule engine (avoids circular import). */
export type AutomationEvalState = {
  farm_id: string;
  starlink: "up" | "down" | "unknown";
  edge?: string;
  mqtt?: string;
  gateway?: string;
  nvr?: "ok" | "down" | "unconfigured";
  metrics: Record<
    string,
    { device_id: string; metric: string; value: number; ts: string }
  >;
};

export type AutomationRow = {
  id: string;
  farm_id: string;
  name: string;
  enabled: number;
  risk: string;
  trigger_json: string;
  action_json: string;
  cooldown_sec: number;
  last_fired_at: string | null;
  last_error: string | null;
  created_at: string | null;
};

export type DispatchResult = {
  ok: boolean;
  kind: string;
  entity?: string;
  status?: string;
  error?: string;
};

/** Match a 5-field cron (min hour day month weekday) in a timezone. */
export function cronMatches(
  cron: string,
  now: Date,
  timezone: string
): boolean {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return false;

  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    minute: "numeric",
    hour: "numeric",
    day: "numeric",
    month: "numeric",
    weekday: "short",
  });
  const bag: Record<string, string> = {};
  for (const p of fmt.formatToParts(now)) {
    if (p.type !== "literal") bag[p.type] = p.value;
  }

  const minute = Number(bag.minute);
  const hour = Number(bag.hour);
  const day = Number(bag.day);
  const month = Number(bag.month);
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const weekday = weekdayMap[bag.weekday ?? ""] ?? -1;

  const fields = [minute, hour, day, month, weekday];
  return parts.every((part, i) => fieldMatches(part, fields[i]!));
}

function fieldMatches(expr: string, value: number): boolean {
  if (expr === "*") return true;
  for (const chunk of expr.split(",")) {
    if (chunk.includes("/")) {
      const [range, stepStr] = chunk.split("/");
      const step = Number(stepStr);
      if (!step || Number.isNaN(step)) continue;
      const base = range === "*" ? 0 : Number(range);
      if (!Number.isNaN(base) && (value - base) % step === 0 && value >= base) {
        return true;
      }
      continue;
    }
    if (chunk.includes("-")) {
      const [a, b] = chunk.split("-").map(Number);
      if (!Number.isNaN(a) && !Number.isNaN(b) && value >= a! && value <= b!) {
        return true;
      }
      continue;
    }
    if (Number(chunk) === value) return true;
  }
  return false;
}

export function parseTrigger(json: string): AutomationTrigger | null {
  try {
    const parsed = AutomationTriggerSchema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function parseAction(json: string): AutomationAction | null {
  try {
    const parsed = AutomationActionSchema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function triggerMatches(
  trigger: AutomationTrigger,
  state: AutomationEvalState,
  now: Date,
  opts?: { forceManual?: boolean }
): { matched: boolean; detail: Record<string, unknown> } {
  if (trigger.type === "manual") {
    return {
      matched: !!opts?.forceManual,
      detail: { type: "manual", forced: !!opts?.forceManual },
    };
  }

  if (trigger.type === "schedule") {
    const tz = trigger.timezone || "Europe/Zagreb";
    const ok = cronMatches(trigger.cron, now, tz);
    return { matched: ok, detail: { type: "schedule", cron: trigger.cron, tz } };
  }

  if (trigger.type === "metric") {
    const key = `${trigger.device_id}:${trigger.metric}`;
    const live = state.metrics[key];
    if (!live) {
      return { matched: false, detail: { type: "metric", key, missing: true } };
    }
    let ok = false;
    if (trigger.op === "lt") ok = live.value < trigger.value;
    else if (trigger.op === "gt") ok = live.value > trigger.value;
    else ok = live.value === trigger.value;
    return {
      matched: ok,
      detail: {
        type: "metric",
        key,
        value: live.value,
        op: trigger.op,
        threshold: trigger.value,
      },
    };
  }

  if (trigger.type === "health") {
    const map: Record<string, string | undefined> = {
      starlink: state.starlink,
      mqtt: state.mqtt,
      edge: state.edge,
      nvr: state.nvr,
    };
    const current = map[trigger.field] ?? "unknown";
    return {
      matched: current === trigger.equals,
      detail: {
        type: "health",
        field: trigger.field,
        current,
        equals: trigger.equals,
      },
    };
  }

  return { matched: false, detail: { type: "unknown" } };
}

function isLowRiskCommandAction(action: string): boolean {
  return (LOW_RISK_COMMAND_ACTIONS as readonly string[]).includes(action);
}

/** Metal-moving job kinds always land as proposed until human confirm. */
export function jobInitialStatus(kind: JobKind): "proposed" | "queued" {
  if (kind === "robot.mow" || kind === "robot.inspect") return "proposed";
  if (kind === "ai.build") return "proposed";
  return "queued";
}

export async function dispatchAction(
  db: D1Database,
  opts: {
    farmUuid: string;
    action: AutomationAction;
    source: string;
    actor: string;
    automationId?: string | null;
    reason?: string;
  }
): Promise<DispatchResult> {
  const now = new Date().toISOString();
  const { farmUuid, action, source, actor, automationId, reason } = opts;

  if (action.type === "snapshot.take") {
    const cam = await db
      .prepare(
        `SELECT id FROM devices WHERE id = ? AND farm_id = ? AND kind = 'camera'`
      )
      .bind(action.camera_id, farmUuid)
      .first<{ id: string }>();
    if (!cam) {
      return { ok: false, kind: "snapshot.take", error: "camera_not_found" };
    }
    const cmdId = crypto.randomUUID();
    await db
      .prepare(
        `INSERT INTO commands (id, farm_id, device_id, action, payload_json, source, status, confirmed_by, created_at)
         VALUES (?, ?, ?, 'snapshot.take', ?, ?, 'sent', ?, ?)`
      )
      .bind(
        cmdId,
        farmUuid,
        cam.id,
        JSON.stringify({ reason: reason ?? "automation", automation_id: automationId }),
        source,
        actor,
        now
      )
      .run();
    await writeAudit(db, {
      farm_id: farmUuid,
      actor,
      action: "command.create",
      entity: `command:${cmdId}`,
      after: { action: "snapshot.take", status: "sent", automation_id: automationId },
    });
    return { ok: true, kind: "snapshot.take", entity: cmdId, status: "sent" };
  }

  if (action.type === "notify.draft") {
    const jobId = crypto.randomUUID();
    const payload = JSON.stringify({
      subject: action.subject,
      body: action.body,
    });
    await db
      .prepare(
        `INSERT INTO jobs (id, farm_id, kind, status, payload_json, source, confirmed_by, reason, automation_id, created_at, updated_at)
         VALUES (?, ?, 'note', 'proposed', ?, ?, NULL, ?, ?, ?, ?)`
      )
      .bind(
        jobId,
        farmUuid,
        payload,
        source,
        reason ?? "notify.draft",
        automationId ?? null,
        now,
        now
      )
      .run();
    await writeAudit(db, {
      farm_id: farmUuid,
      actor,
      action: "job.create",
      entity: `job:${jobId}`,
      after: { kind: "note", status: "proposed", automation_id: automationId },
    });
    return { ok: true, kind: "notify.draft", entity: jobId, status: "proposed" };
  }

  if (action.type === "job.enqueue") {
    const jobId = crypto.randomUUID();
    const status = jobInitialStatus(action.kind);
    await db
      .prepare(
        `INSERT INTO jobs (id, farm_id, kind, status, payload_json, source, confirmed_by, reason, automation_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)`
      )
      .bind(
        jobId,
        farmUuid,
        action.kind,
        status,
        action.payload ? JSON.stringify(action.payload) : null,
        source,
        reason ?? `automation ${action.kind}`,
        automationId ?? null,
        now,
        now
      )
      .run();
    await writeAudit(db, {
      farm_id: farmUuid,
      actor,
      action: "job.create",
      entity: `job:${jobId}`,
      after: { kind: action.kind, status, automation_id: automationId },
    });
    return { ok: true, kind: "job.enqueue", entity: jobId, status };
  }

  if (action.type === "command.propose") {
    const status = isLowRiskCommandAction(action.action) ? "sent" : "proposed";
    const cmdId = crypto.randomUUID();
    await db
      .prepare(
        `INSERT INTO commands (id, farm_id, device_id, action, payload_json, source, status, confirmed_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        cmdId,
        farmUuid,
        action.device_id,
        action.action,
        JSON.stringify({
          ...(action.payload ?? {}),
          automation_id: automationId,
          reason: reason ?? "automation",
        }),
        source,
        status,
        status === "sent" ? actor : null,
        now
      )
      .run();
    await writeAudit(db, {
      farm_id: farmUuid,
      actor,
      action: "command.create",
      entity: `command:${cmdId}`,
      after: {
        device_id: action.device_id,
        action: action.action,
        status,
        automation_id: automationId,
      },
    });
    return { ok: true, kind: "command.propose", entity: cmdId, status };
  }

  return { ok: false, kind: "unknown", error: "unsupported_action" };
}

export async function evaluateAutomations(
  db: D1Database,
  state: AutomationEvalState,
  opts?: { forceId?: string; forceManual?: boolean }
): Promise<{ fired: string[]; errors: string[] }> {
  const fired: string[] = [];
  const errors: string[] = [];

  const farm = await db
    .prepare(
      `SELECT id, slug, timezone FROM farms WHERE slug = ? OR id = ?`
    )
    .bind(state.farm_id, state.farm_id)
    .first<{ id: string; slug: string; timezone: string }>();

  if (!farm) {
    return { fired, errors: ["farm_not_found"] };
  }

  let rows: AutomationRow[];
  if (opts?.forceId) {
    const one = await db
      .prepare(
        `SELECT id, farm_id, name, enabled, risk, trigger_json, action_json,
                cooldown_sec, last_fired_at, last_error, created_at
         FROM automations WHERE id = ? AND farm_id = ?`
      )
      .bind(opts.forceId, farm.id)
      .first<AutomationRow>();
    rows = one ? [one] : [];
  } else {
    const { results } = await db
      .prepare(
        `SELECT id, farm_id, name, enabled, risk, trigger_json, action_json,
                cooldown_sec, last_fired_at, last_error, created_at
         FROM automations WHERE farm_id = ? AND enabled = 1`
      )
      .bind(farm.id)
      .all<AutomationRow>();
    rows = results ?? [];
  }

  const now = new Date();
  const nowIso = now.toISOString();

  for (const row of rows) {
    const trigger = parseTrigger(row.trigger_json);
    const action = parseAction(row.action_json);
    if (!trigger || !action) {
      errors.push(`${row.id}:invalid_json`);
      await db
        .prepare(`UPDATE automations SET last_error = ? WHERE id = ?`)
        .bind("invalid trigger/action json", row.id)
        .run();
      continue;
    }

    const match = triggerMatches(trigger, state, now, {
      forceManual: opts?.forceManual && opts?.forceId === row.id,
    });
    if (!match.matched) continue;

    if (row.last_fired_at && row.cooldown_sec > 0 && !opts?.forceManual) {
      const last = Date.parse(row.last_fired_at);
      if (!Number.isNaN(last) && now.getTime() - last < row.cooldown_sec * 1000) {
        continue;
      }
    }

    const actor = opts?.forceManual ? "user:operator" : "agent:automation";
    const source = opts?.forceManual ? "ui" : "schedule";

    try {
      const result = await dispatchAction(db, {
        farmUuid: farm.id,
        action,
        source,
        actor,
        automationId: row.id,
        reason: `automation:${row.name}`,
      });

      const runId = crypto.randomUUID();
      await db
        .prepare(
          `INSERT INTO automation_runs (id, farm_id, automation_id, fired_at, trigger_match_json, result_json, ok)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          runId,
          farm.id,
          row.id,
          nowIso,
          JSON.stringify(match.detail),
          JSON.stringify(result),
          result.ok ? 1 : 0
        )
        .run();

      await db
        .prepare(
          `UPDATE automations SET last_fired_at = ?, last_error = ? WHERE id = ?`
        )
        .bind(nowIso, result.ok ? null : result.error ?? "dispatch_failed", row.id)
        .run();

      await writeAudit(db, {
        farm_id: farm.id,
        actor,
        action: "automation.fire",
        entity: `automation:${row.id}`,
        after: { result, trigger: match.detail },
      });

      if (result.ok) fired.push(row.id);
      else errors.push(`${row.id}:${result.error}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${row.id}:${msg}`);
      await db
        .prepare(`UPDATE automations SET last_error = ? WHERE id = ?`)
        .bind(msg.slice(0, 500), row.id)
        .run();
    }
  }

  return { fired, errors };
}

export { riskForAction };
