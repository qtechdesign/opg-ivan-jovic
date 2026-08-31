import { Hono } from "hono";
import {
  ConfirmCommandSchema,
  ConfirmJobSchema,
  CreateAutomationSchema,
  CreateCommandSchema,
  CreateJobSchema,
  EnableAutomationBodySchema,
  LOW_RISK_COMMAND_ACTIONS,
  PatchJobSchema,
  PutAutomationSchema,
  riskForAction,
  type AutomationAction,
} from "@polje/schema";
import { requireOperator, requireOperatorOrIngest } from "../lib/auth";
import { writeAudit } from "../lib/audit";
import { farmSlugFromQuery, getFarmBySlug } from "../lib/farm";
import { parseAction } from "../lib/automations";
import { farmStub } from "../do/farm-runtime";

type AppEnv = { Bindings: Cloudflare.Env };

export const automationsApi = new Hono<AppEnv>();

type AutoRow = {
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

function rowToJson(row: AutoRow) {
  let trigger: unknown = null;
  let action: unknown = null;
  try {
    trigger = JSON.parse(row.trigger_json);
  } catch {
    /* keep null */
  }
  try {
    action = JSON.parse(row.action_json);
  } catch {
    /* keep null */
  }
  return {
    id: row.id,
    farm_id: row.farm_id,
    name: row.name,
    enabled: row.enabled,
    risk: row.risk,
    trigger,
    action,
    trigger_json: row.trigger_json,
    action_json: row.action_json,
    cooldown_sec: row.cooldown_sec,
    last_fired_at: row.last_fired_at,
    last_error: row.last_error,
    created_at: row.created_at,
  };
}

function canEnableWithoutConfirm(risk: string, confirm: boolean): boolean {
  if (risk === "low") return true;
  return confirm === true;
}

// —— Automations ——

automationsApi.get("/v1/automations", async (c) => {
  const slug = farmSlugFromQuery(c);
  const farm = await getFarmBySlug(c.env.DB, slug);
  if (!farm) return c.json({ error: "farm_not_found", slug }, 404);

  const { results } = await c.env.DB.prepare(
    `SELECT id, farm_id, name, enabled, risk, trigger_json, action_json,
            cooldown_sec, last_fired_at, last_error, created_at
     FROM automations WHERE farm_id = ? ORDER BY name`
  )
    .bind(farm.id)
    .all<AutoRow>();

  return c.json({
    farm_id: farm.id,
    automations: (results ?? []).map(rowToJson),
  });
});

automationsApi.post("/v1/automations", async (c) => {
  const denied = await requireOperator(c);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }

  const parsed = CreateAutomationSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "validation", details: parsed.error.flatten() }, 400);
  }

  const farm = await getFarmBySlug(c.env.DB, parsed.data.farm_slug);
  if (!farm) {
    return c.json({ error: "farm_not_found", slug: parsed.data.farm_slug }, 404);
  }

  const risk = riskForAction(parsed.data.action);
  let enabled = 0;
  if (parsed.data.enabled) {
    if (!canEnableWithoutConfirm(risk, parsed.data.confirm)) {
      // Create disabled; return proposal
      enabled = 0;
    } else if (risk !== "low" && !parsed.data.reason) {
      return c.json({ error: "reason_required" }, 400);
    } else {
      enabled = 1;
    }
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const trigger_json = JSON.stringify(parsed.data.trigger);
  const action_json = JSON.stringify(parsed.data.action);

  await c.env.DB.prepare(
    `INSERT INTO automations
       (id, farm_id, name, enabled, risk, trigger_json, action_json, cooldown_sec, last_fired_at, last_error, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?)`
  )
    .bind(
      id,
      farm.id,
      parsed.data.name,
      enabled,
      risk,
      trigger_json,
      action_json,
      parsed.data.cooldown_sec,
      now
    )
    .run();

  await writeAudit(c.env.DB, {
    farm_id: farm.id,
    actor: "user:operator",
    action: "automation.create",
    entity: `automation:${id}`,
    after: {
      name: parsed.data.name,
      risk,
      enabled,
      wanted_enabled: parsed.data.enabled,
      confirm: parsed.data.confirm,
    },
  });

  const proposal =
    parsed.data.enabled && enabled === 0
      ? {
          proposal: true,
          message:
            "High/medium risk automation created disabled. POST /enable with confirm:true + reason.",
        }
      : {};

  return c.json(
    {
      ok: true,
      id,
      risk,
      enabled,
      ...proposal,
    },
    201
  );
});

automationsApi.put("/v1/automations/:id", async (c) => {
  const denied = await requireOperator(c);
  if (denied) return denied;

  const id = c.req.param("id");
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }

  const parsed = PutAutomationSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "validation", details: parsed.error.flatten() }, 400);
  }

  const row = await c.env.DB.prepare(
    `SELECT id, farm_id, name, enabled, risk, trigger_json, action_json,
            cooldown_sec, last_fired_at, last_error, created_at
     FROM automations WHERE id = ?`
  )
    .bind(id)
    .first<AutoRow>();

  if (!row) return c.json({ error: "automation_not_found" }, 404);

  const nextName = parsed.data.name ?? row.name;
  const nextTrigger = parsed.data.trigger
    ? JSON.stringify(parsed.data.trigger)
    : row.trigger_json;
  const nextActionObj: AutomationAction | null = parsed.data.action
    ? parsed.data.action
    : parseAction(row.action_json);
  if (!nextActionObj) {
    return c.json({ error: "invalid_action" }, 400);
  }
  const nextAction = JSON.stringify(nextActionObj);
  const nextRisk = riskForAction(nextActionObj);
  const nextCooldown = parsed.data.cooldown_sec ?? row.cooldown_sec;

  let nextEnabled = row.enabled;
  if (parsed.data.enabled === false) {
    nextEnabled = 0;
  } else if (parsed.data.enabled === true) {
    if (!canEnableWithoutConfirm(nextRisk, parsed.data.confirm)) {
      return c.json(
        {
          error: "confirm_required",
          proposal: true,
          risk: nextRisk,
          message: "Enabling requires confirm:true + reason for medium/high risk",
        },
        400
      );
    }
    if (nextRisk !== "low" && !parsed.data.reason) {
      return c.json({ error: "reason_required" }, 400);
    }
    nextEnabled = 1;
  }

  await c.env.DB.prepare(
    `UPDATE automations
     SET name = ?, trigger_json = ?, action_json = ?, risk = ?, cooldown_sec = ?, enabled = ?
     WHERE id = ?`
  )
    .bind(
      nextName,
      nextTrigger,
      nextAction,
      nextRisk,
      nextCooldown,
      nextEnabled,
      id
    )
    .run();

  await writeAudit(c.env.DB, {
    farm_id: row.farm_id,
    actor: "user:operator",
    action: "automation.update",
    entity: `automation:${id}`,
    before: { enabled: row.enabled, risk: row.risk, name: row.name },
    after: {
      enabled: nextEnabled,
      risk: nextRisk,
      name: nextName,
      reason: parsed.data.reason ?? null,
    },
  });

  return c.json({ ok: true, id, enabled: nextEnabled, risk: nextRisk });
});

automationsApi.post("/v1/automations/:id/enable", async (c) => {
  const denied = await requireOperator(c);
  if (denied) return denied;

  const id = c.req.param("id");
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }

  const parsed = EnableAutomationBodySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "validation", details: parsed.error.flatten() }, 400);
  }

  const row = await c.env.DB.prepare(
    `SELECT id, farm_id, name, enabled, risk, trigger_json, action_json,
            cooldown_sec, last_fired_at, last_error, created_at
     FROM automations WHERE id = ?`
  )
    .bind(id)
    .first<AutoRow>();

  if (!row) return c.json({ error: "automation_not_found" }, 404);

  if (!parsed.data.enabled) {
    await c.env.DB.prepare(`UPDATE automations SET enabled = 0 WHERE id = ?`)
      .bind(id)
      .run();
    await writeAudit(c.env.DB, {
      farm_id: row.farm_id,
      actor: "user:operator",
      action: "automation.disable",
      entity: `automation:${id}`,
      before: { enabled: row.enabled },
      after: { enabled: 0 },
    });
    return c.json({ ok: true, id, enabled: 0 });
  }

  if (!canEnableWithoutConfirm(row.risk, parsed.data.confirm)) {
    return c.json(
      {
        error: "confirm_required",
        proposal: true,
        risk: row.risk,
        enabled: row.enabled,
        message: "Enable requires confirm:true + reason",
      },
      400
    );
  }
  if (row.risk !== "low" && !parsed.data.reason) {
    return c.json({ error: "reason_required" }, 400);
  }

  await c.env.DB.prepare(`UPDATE automations SET enabled = 1 WHERE id = ?`)
    .bind(id)
    .run();

  await writeAudit(c.env.DB, {
    farm_id: row.farm_id,
    actor: "user:operator",
    action: "automation.enable",
    entity: `automation:${id}`,
    before: { enabled: row.enabled },
    after: { enabled: 1, reason: parsed.data.reason ?? null, risk: row.risk },
  });

  // Ensure DO tick is scheduled
  try {
    const farm = await c.env.DB.prepare(`SELECT slug FROM farms WHERE id = ?`)
      .bind(row.farm_id)
      .first<{ slug: string }>();
    if (farm) {
      const stub = farmStub(c.env, farm.slug);
      await stub.fetch(
        new Request(`https://do/evaluate?farm_id=${farm.slug}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        })
      );
    }
  } catch {
    /* best-effort */
  }

  return c.json({ ok: true, id, enabled: 1 });
});

automationsApi.post("/v1/automations/:id/fire", async (c) => {
  const denied = await requireOperator(c);
  if (denied) return denied;

  const id = c.req.param("id");
  const row = await c.env.DB.prepare(
    `SELECT id, farm_id FROM automations WHERE id = ?`
  )
    .bind(id)
    .first<{ id: string; farm_id: string }>();

  if (!row) return c.json({ error: "automation_not_found" }, 404);

  const farm = await c.env.DB.prepare(`SELECT slug FROM farms WHERE id = ?`)
    .bind(row.farm_id)
    .first<{ slug: string }>();
  if (!farm) return c.json({ error: "farm_not_found" }, 404);

  const stub = farmStub(c.env, farm.slug);
  const res = await stub.fetch(
    new Request(`https://do/evaluate?farm_id=${farm.slug}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ force_id: id, force_manual: true }),
    })
  );
  const result = (await res.json()) as {
    fired: string[];
    errors: string[];
  };

  await writeAudit(c.env.DB, {
    farm_id: row.farm_id,
    actor: "user:operator",
    action: "automation.fire_manual",
    entity: `automation:${id}`,
    after: result,
  });

  return c.json({ ok: true, ...result }, res.ok ? 200 : 500);
});

// —— Jobs ——

automationsApi.get("/v1/jobs", async (c) => {
  const denied = await requireOperator(c);
  if (denied) return denied;

  const slug = farmSlugFromQuery(c);
  const farm = await getFarmBySlug(c.env.DB, slug);
  if (!farm) return c.json({ error: "farm_not_found", slug }, 404);

  const status = c.req.query("status");
  let sql = `SELECT id, farm_id, kind, status, payload_json, source, confirmed_by, reason, automation_id, created_at, updated_at
             FROM jobs WHERE farm_id = ?`;
  const binds: string[] = [farm.id];
  if (status) {
    sql += ` AND status = ?`;
    binds.push(status);
  }
  sql += ` ORDER BY created_at DESC LIMIT 100`;

  const { results } = await c.env.DB.prepare(sql).bind(...binds).all();
  return c.json({ farm_id: farm.id, jobs: results ?? [] });
});

automationsApi.post("/v1/jobs", async (c) => {
  const denied = await requireOperator(c);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }

  const parsed = CreateJobSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "validation", details: parsed.error.flatten() }, 400);
  }

  const farm = await getFarmBySlug(c.env.DB, parsed.data.farm_slug);
  if (!farm) {
    return c.json({ error: "farm_not_found", slug: parsed.data.farm_slug }, 404);
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  // Metal / AI jobs start proposed; scene/note may queue
  const status =
    parsed.data.kind === "scene" || parsed.data.kind === "note"
      ? "queued"
      : "proposed";

  await c.env.DB.prepare(
    `INSERT INTO jobs (id, farm_id, kind, status, payload_json, source, confirmed_by, reason, automation_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'ui', NULL, ?, NULL, ?, ?)`
  )
    .bind(
      id,
      farm.id,
      parsed.data.kind,
      status,
      parsed.data.payload ? JSON.stringify(parsed.data.payload) : null,
      parsed.data.reason ?? null,
      now,
      now
    )
    .run();

  await writeAudit(c.env.DB, {
    farm_id: farm.id,
    actor: "user:operator",
    action: "job.create",
    entity: `job:${id}`,
    after: { kind: parsed.data.kind, status },
  });

  return c.json({ ok: true, id, status, kind: parsed.data.kind }, 201);
});

automationsApi.post("/v1/jobs/:id/confirm", async (c) => {
  const denied = await requireOperator(c);
  if (denied) return denied;

  const id = c.req.param("id");
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }

  const parsed = ConfirmJobSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        error: "confirm_required",
        proposal: true,
        message: "confirm:true + reason required",
        details: parsed.error.flatten(),
      },
      400
    );
  }

  const row = await c.env.DB.prepare(
    `SELECT id, farm_id, kind, status FROM jobs WHERE id = ?`
  )
    .bind(id)
    .first<{ id: string; farm_id: string; kind: string; status: string }>();

  if (!row) return c.json({ error: "job_not_found" }, 404);
  if (row.status !== "proposed") {
    return c.json({ error: "invalid_status", status: row.status }, 400);
  }

  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `UPDATE jobs SET status = 'confirmed', confirmed_by = 'user:operator', reason = ?, updated_at = ? WHERE id = ?`
  )
    .bind(parsed.data.reason, now, id)
    .run();

  await writeAudit(c.env.DB, {
    farm_id: row.farm_id,
    actor: "user:operator",
    action: "job.confirm",
    entity: `job:${id}`,
    before: { status: row.status },
    after: { status: "confirmed", reason: parsed.data.reason },
  });

  return c.json({ ok: true, id, status: "confirmed" });
});

automationsApi.patch("/v1/jobs/:id", async (c) => {
  const denied = await requireOperatorOrIngest(c);
  if (denied) return denied;

  const id = c.req.param("id");
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }

  const parsed = PatchJobSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "validation", details: parsed.error.flatten() }, 400);
  }

  const row = await c.env.DB.prepare(
    `SELECT id, farm_id, status FROM jobs WHERE id = ?`
  )
    .bind(id)
    .first<{ id: string; farm_id: string; status: string }>();

  if (!row) return c.json({ error: "job_not_found" }, 404);

  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `UPDATE jobs SET status = ?, reason = COALESCE(?, reason), updated_at = ? WHERE id = ?`
  )
    .bind(parsed.data.status, parsed.data.reason ?? null, now, id)
    .run();

  await writeAudit(c.env.DB, {
    farm_id: row.farm_id,
    actor: "user:operator",
    action: "job.update",
    entity: `job:${id}`,
    before: { status: row.status },
    after: { status: parsed.data.status, reason: parsed.data.reason ?? null },
  });

  return c.json({ ok: true, id, status: parsed.data.status });
});

// —— Commands (create + confirm) ——

automationsApi.post("/v1/commands", async (c) => {
  const denied = await requireOperator(c);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }

  const parsed = CreateCommandSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "validation", details: parsed.error.flatten() }, 400);
  }

  const farm = await getFarmBySlug(c.env.DB, parsed.data.farm_slug);
  if (!farm) {
    return c.json({ error: "farm_not_found", slug: parsed.data.farm_slug }, 404);
  }

  const low = (LOW_RISK_COMMAND_ACTIONS as readonly string[]).includes(
    parsed.data.action
  );
  let status: "sent" | "proposed";
  if (low) {
    status = "sent";
  } else if (parsed.data.confirm === true && parsed.data.reason) {
    status = "sent";
  } else {
    status = "proposed";
  }

  const cmdId = crypto.randomUUID();
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `INSERT INTO commands (id, farm_id, device_id, action, payload_json, source, status, confirmed_by, created_at)
     VALUES (?, ?, ?, ?, ?, 'api', ?, ?, ?)`
  )
    .bind(
      cmdId,
      farm.id,
      parsed.data.device_id,
      parsed.data.action,
      JSON.stringify({
        ...(parsed.data.payload ?? {}),
        reason: parsed.data.reason ?? null,
      }),
      status,
      status === "sent" ? "user:operator" : null,
      now
    )
    .run();

  await writeAudit(c.env.DB, {
    farm_id: farm.id,
    actor: "user:operator",
    action: "command.create",
    entity: `command:${cmdId}`,
    after: {
      device_id: parsed.data.device_id,
      action: parsed.data.action,
      status,
      confirm: parsed.data.confirm,
    },
  });

  if (status === "proposed") {
    return c.json(
      {
        ok: true,
        command_id: cmdId,
        status: "proposed",
        proposal: true,
        message: "High-risk command stored as proposed. POST /confirm with confirm:true.",
      },
      202
    );
  }

  return c.json({ ok: true, command_id: cmdId, status: "sent" }, 202);
});

automationsApi.post("/v1/commands/:id/confirm", async (c) => {
  const denied = await requireOperator(c);
  if (denied) return denied;

  const id = c.req.param("id");
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }

  const parsed = ConfirmCommandSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        error: "confirm_required",
        proposal: true,
        message: "confirm:true + reason required",
      },
      400
    );
  }

  const row = await c.env.DB.prepare(
    `SELECT id, farm_id, device_id, action, status FROM commands WHERE id = ?`
  )
    .bind(id)
    .first<{
      id: string;
      farm_id: string;
      device_id: string;
      action: string;
      status: string;
    }>();

  if (!row) return c.json({ error: "command_not_found" }, 404);
  if (row.status !== "proposed") {
    return c.json({ error: "invalid_status", status: row.status }, 400);
  }

  await c.env.DB.prepare(
    `UPDATE commands SET status = 'sent', confirmed_by = 'user:operator' WHERE id = ?`
  )
    .bind(id)
    .run();

  await writeAudit(c.env.DB, {
    farm_id: row.farm_id,
    actor: "user:operator",
    action: "command.confirm",
    entity: `command:${id}`,
    before: { status: row.status },
    after: { status: "sent", reason: parsed.data.reason },
  });

  return c.json({ ok: true, id, status: "sent" });
});
