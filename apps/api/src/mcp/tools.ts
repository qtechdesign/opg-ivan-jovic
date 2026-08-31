import {
  AddPlantingNoteInputSchema,
  AskGrokBriefingInputSchema,
  EnableAutomationInputSchema,
  FpsArmProgramInputSchema,
  FpsFrostStatusInputSchema,
  FpsOpenValveInputSchema,
  GetOverviewInputSchema,
  IotBusHealthInputSchema,
  ListReadingsInputSchema,
  LogExpenseInputSchema,
  ProposeAutomationInputSchema,
  RequestSnapshotInputSchema,
  RunIrrigationInputSchema,
  SetActuatorInputSchema,
  SetClimateSetpointInputSchema,
  type Farm,
} from "@polje/schema";
import { z } from "zod";
// Tool handlers take `any` after schema.parse (Zod 4 infer noise).
import { writeAudit } from "../lib/audit";
import { defaultFarmSlug, getFarmBySlug } from "../lib/farm";
import { farmStub } from "../do/farm-runtime";
import type { FarmLiveState } from "../do/farm-runtime";
import { applyClimateSetpoint, climateNow } from "../lib/climate";
import { energyNow } from "../lib/energy";

export type ToolActor =
  | "agent:mcp"
  | "agent:grok"
  | "user:operator"
  | "cron:briefing";

export type ToolRisk = "low" | "medium" | "high";

export type ToolContext = {
  env: Cloudflare.Env;
  actor: ToolActor;
  /** When false, high-risk tools never execute even if confirm=true (Grok chat). */
  allowConfirm: boolean;
};

export type ToolResult = Record<string, unknown>;

type ToolDef = {
  name: string;
  description: string;
  risk: ToolRisk;
  // Avoid coupling to a specific Zod major (workspace may resolve 3 vs 4).
  inputSchema: {
    safeParse: (data: unknown) => {
      success: boolean;
      data?: unknown;
      error?: { flatten: () => unknown };
    };
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  execute: (ctx: ToolContext, input: any) => Promise<ToolResult>;
};

function proposal(
  tool: string,
  input: Record<string, unknown>,
  note?: string
): ToolResult {
  return {
    status: "proposal",
    tool,
    input,
    message:
      note ??
      "Set confirm=true and provide reason to execute. High-risk actions are proposals until confirmed.",
  };
}

function moduleNotReady(module: string, tool: string): ToolResult {
  return {
    error: "module_not_ready",
    module,
    tool,
    message: `${module} is not implemented yet. No command was sent.`,
  };
}

async function resolveFarm(
  env: Cloudflare.Env,
  slug: string
): Promise<Farm | null> {
  return getFarmBySlug(env.DB, slug || defaultFarmSlug(env));
}

async function getOverview(
  ctx: ToolContext,
  input: any
): Promise<ToolResult> {
  const farm = await resolveFarm(ctx.env, input.farm_slug);
  if (!farm) return { error: "farm_not_found", slug: input.farm_slug };

  const stub = farmStub(ctx.env, farm.slug);
  const liveRes = await stub.fetch(
    new Request(`https://do/overview?farm_id=${encodeURIComponent(farm.slug)}`)
  );
  const live = await liveRes.json();

  const { results: plots } = await ctx.env.DB.prepare(
    `SELECT id, name, use_type FROM plots WHERE farm_id = ? ORDER BY name`
  )
    .bind(farm.id)
    .all();

  return {
    farm: {
      id: farm.id,
      slug: farm.slug,
      name: farm.name,
      timezone: farm.timezone,
    },
    plots: plots ?? [],
    live,
  };
}

async function listReadings(
  ctx: ToolContext,
  input: any
): Promise<ToolResult> {
  const farm = await resolveFarm(ctx.env, input.farm_slug);
  if (!farm) return { error: "farm_not_found", slug: input.farm_slug };

  let sql = `SELECT r.id, r.device_id, r.metric, r.value, r.ts
             FROM readings r
             JOIN devices d ON d.id = r.device_id
             WHERE d.farm_id = ?`;
  const binds: (string | number)[] = [farm.id];

  if (input.device_id) {
    sql += ` AND r.device_id = ?`;
    binds.push(input.device_id);
  }
  if (input.metric) {
    sql += ` AND r.metric = ?`;
    binds.push(input.metric);
  }
  sql += ` ORDER BY r.ts DESC LIMIT ?`;
  binds.push(input.limit);

  const { results } = await ctx.env.DB.prepare(sql).bind(...binds).all();
  return { farm_id: farm.id, readings: results ?? [] };
}

async function addPlantingNote(
  ctx: ToolContext,
  input: any
): Promise<ToolResult> {
  const farm = await resolveFarm(ctx.env, input.farm_slug);
  if (!farm) return { error: "farm_not_found", slug: input.farm_slug };

  const planting = await ctx.env.DB.prepare(
    `SELECT p.id FROM plantings p
     JOIN plots pl ON pl.id = p.plot_id
     WHERE p.id = ? AND pl.farm_id = ?`
  )
    .bind(input.planting_id, farm.id)
    .first<{ id: string }>();

  if (!planting) return { error: "planting_not_found" };

  const id = crypto.randomUUID();
  const created_at = new Date().toISOString();
  await ctx.env.DB.prepare(
    `INSERT INTO planting_notes (id, farm_id, planting_id, body, actor, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(id, farm.id, input.planting_id, input.body, ctx.actor, created_at)
    .run();

  const note = {
    id,
    farm_id: farm.id,
    planting_id: input.planting_id,
    body: input.body,
    actor: ctx.actor,
    created_at,
  };

  await writeAudit(ctx.env.DB, {
    farm_id: farm.id,
    actor: ctx.actor,
    action: "planting.note",
    entity: `planting:${input.planting_id}`,
    after: note,
  });

  return { ok: true, note };
}

async function logExpense(
  ctx: ToolContext,
  input: any
): Promise<ToolResult> {
  const farm = await resolveFarm(ctx.env, input.farm_slug);
  if (!farm) return { error: "farm_not_found", slug: input.farm_slug };

  const id = crypto.randomUUID();
  const ts = new Date().toISOString();
  await ctx.env.DB.prepare(
    `INSERT INTO ledger (id, farm_id, ts, kind, category, amount_cents, currency, note, r2_key)
     VALUES (?, ?, ?, ?, ?, ?, 'EUR', ?, NULL)`
  )
    .bind(
      id,
      farm.id,
      ts,
      input.kind,
      input.category ?? null,
      input.amount_cents,
      input.note ?? null
    )
    .run();

  const row = {
    id,
    farm_id: farm.id,
    ts,
    kind: input.kind,
    category: input.category ?? null,
    amount_cents: input.amount_cents,
    currency: "EUR",
    note: input.note ?? null,
  };

  await writeAudit(ctx.env.DB, {
    farm_id: farm.id,
    actor: ctx.actor,
    action: "ledger.create",
    entity: `ledger:${id}`,
    after: row,
  });

  return { ok: true, entry: row };
}

async function requestSnapshot(
  ctx: ToolContext,
  input: any
): Promise<ToolResult> {
  const farm = await resolveFarm(ctx.env, input.farm_slug);
  if (!farm) return { error: "farm_not_found", slug: input.farm_slug };

  const cam = await ctx.env.DB.prepare(
    `SELECT id, farm_id, name FROM devices WHERE id = ? AND farm_id = ? AND kind = 'camera'`
  )
    .bind(input.camera_id, farm.id)
    .first<{ id: string; farm_id: string; name: string }>();

  if (!cam) return { error: "camera_not_found" };

  const cmdId = crypto.randomUUID();
  const created_at = new Date().toISOString();
  await ctx.env.DB.prepare(
    `INSERT INTO commands (id, farm_id, device_id, action, payload_json, source, status, confirmed_by, created_at)
     VALUES (?, ?, ?, 'snapshot.take', ?, ?, 'sent', ?, ?)`
  )
    .bind(
      cmdId,
      cam.farm_id,
      cam.id,
      JSON.stringify({ reason: "mcp/agent" }),
      ctx.actor.startsWith("agent") ? "grok" : "api",
      ctx.actor,
      created_at
    )
    .run();

  await writeAudit(ctx.env.DB, {
    farm_id: cam.farm_id,
    actor: ctx.actor,
    action: "camera.snapshot.request",
    entity: `camera:${cam.id}`,
    after: { command_id: cmdId },
  });

  return {
    ok: true,
    command_id: cmdId,
    camera_id: cam.id,
    status: "sent",
  };
}

async function iotBusHealth(
  ctx: ToolContext,
  input: any
): Promise<ToolResult> {
  const farm = await resolveFarm(ctx.env, input.farm_slug);
  if (!farm) return { error: "farm_not_found", slug: input.farm_slug };

  const stub = farmStub(ctx.env, farm.slug);
  const res = await stub.fetch(
    new Request(`https://do/health?farm_id=${encodeURIComponent(farm.slug)}`)
  );
  return (await res.json()) as ToolResult;
}

function highRiskGate(
  ctx: ToolContext,
  tool: string,
  input: { confirm?: boolean; reason?: string } & Record<string, unknown>,
  module: string
): ToolResult | null {
  const confirm = ctx.allowConfirm && input.confirm === true;
  if (!confirm) {
    const { confirm: _c, ...rest } = input;
    return proposal(tool, rest as Record<string, unknown>);
  }
  return moduleNotReady(module, tool);
}

async function runIrrigation(
  ctx: ToolContext,
  input: any
): Promise<ToolResult> {
  const blocked = highRiskGate(ctx, "run_irrigation", input as any, "M5");
  if (blocked) return blocked;
  return moduleNotReady("M5", "run_irrigation");
}

async function setClimateSetpoint(
  ctx: ToolContext,
  input: any
): Promise<ToolResult> {
  const confirm = ctx.allowConfirm && input.confirm === true;
  if (!confirm) {
    const { confirm: _c, ...rest } = input;
    return proposal("set_climate_setpoint", rest as Record<string, unknown>);
  }

  const farm = await resolveFarm(ctx.env, input.farm_slug);
  if (!farm) return { error: "farm_not_found", slug: input.farm_slug };

  const zone = await ctx.env.DB.prepare(
    `SELECT id, farm_id, plot_id, name, sensor_id, heater_id, cooler_id, battery_id,
            heat_c, cool_c, heat_c_min, heat_c_max, cool_c_min, cool_c_max,
            timeout_sec, enabled
     FROM climate_zones WHERE id = ? AND farm_id = ?`
  )
    .bind(input.zone_id, farm.id)
    .first();
  if (!zone) return { error: "zone_not_found" };

  const stub = farmStub(ctx.env, farm.slug);
  const liveRes = await stub.fetch(
    new Request(`https://do/overview?farm_id=${encodeURIComponent(farm.slug)}`)
  );
  const liveState = (await liveRes.json()) as FarmLiveState;

  const result = await applyClimateSetpoint(ctx.env.DB, {
    zone: zone as any,
    farmId: farm.id,
    heat_c: input.heat_c ?? input.temp_c,
    cool_c: input.cool_c,
    reason: input.reason,
    confirm: true,
    actor: ctx.actor,
    live: liveState.metrics ?? {},
  });
  return result as ToolResult;
}

async function fpsFrostStatus(
  _ctx: ToolContext,
  _input: any
): Promise<ToolResult> {
  return {
    status: "not_ready",
    module: "M4",
    message: "FPS / LoRa not wired yet. Frost status unavailable.",
  };
}

async function fpsArmProgram(
  ctx: ToolContext,
  input: any
): Promise<ToolResult> {
  const blocked = highRiskGate(ctx, "fps_arm_program", input as any, "M4");
  if (blocked) return blocked;
  return moduleNotReady("M4", "fps_arm_program");
}

async function fpsOpenValve(
  ctx: ToolContext,
  input: any
): Promise<ToolResult> {
  const blocked = highRiskGate(ctx, "fps_open_valve", input as any, "M4");
  if (blocked) return blocked;
  return moduleNotReady("M4", "fps_open_valve");
}

async function setActuator(
  ctx: ToolContext,
  input: any
): Promise<ToolResult> {
  const blocked = highRiskGate(ctx, "set_actuator", input as any, "M9");
  if (blocked) return blocked;
  return moduleNotReady("M9", "set_actuator");
}

async function proposeAutomation(
  ctx: ToolContext,
  input: any
): Promise<ToolResult> {
  const farm = await resolveFarm(ctx.env, input.farm_slug);
  if (!farm) return { error: "farm_not_found", slug: input.farm_slug };

  // Validate JSON shape without enabling
  try {
    JSON.parse(input.trigger_json);
    JSON.parse(input.action_json);
  } catch {
    return { error: "invalid_json", hint: "trigger_json and action_json must be JSON strings" };
  }

  const id = crypto.randomUUID();
  const created_at = new Date().toISOString();
  await ctx.env.DB.prepare(
    `INSERT INTO automations (id, farm_id, name, enabled, trigger_json, action_json, created_at)
     VALUES (?, ?, ?, 0, ?, ?, ?)`
  )
    .bind(
      id,
      farm.id,
      input.name,
      input.trigger_json,
      input.action_json,
      created_at
    )
    .run();

  const draft = {
    id,
    farm_id: farm.id,
    name: input.name,
    enabled: 0,
    trigger_json: input.trigger_json,
    action_json: input.action_json,
    created_at,
  };

  await writeAudit(ctx.env.DB, {
    farm_id: farm.id,
    actor: ctx.actor,
    action: "automation.propose",
    entity: `automation:${id}`,
    after: draft,
  });

  return {
    ok: true,
    status: "draft",
    automation: draft,
    message: "Draft saved with enabled=0. enable_automation requires M9 + confirm.",
  };
}

async function enableAutomation(
  ctx: ToolContext,
  input: any
): Promise<ToolResult> {
  const blocked = highRiskGate(ctx, "enable_automation", input as any, "M9");
  if (blocked) return blocked;
  return moduleNotReady("M9", "enable_automation");
}

/** Lazy import to avoid circular deps with briefing.ts */
async function askGrokBriefing(
  ctx: ToolContext,
  input: any
): Promise<ToolResult> {
  const { generateBriefing } = await import("../lib/briefing");
  return generateBriefing(ctx.env, {
    farmSlug: input.farm_slug,
    force: input.force,
    actor: ctx.actor,
  });
}

export const TOOL_DEFS: ToolDef[] = [
  {
    name: "get_overview",
    description: "Live farm overview: plots + Durable Object metrics and health.",
    risk: "low",
    inputSchema: GetOverviewInputSchema,
    execute: getOverview,
  },
  {
    name: "list_readings",
    description: "List recent sensor readings for the farm (optional device_id / metric).",
    risk: "low",
    inputSchema: ListReadingsInputSchema,
    execute: listReadings,
  },
  {
    name: "add_planting_note",
    description: "Add a note to a planting (growth diary text).",
    risk: "low",
    inputSchema: AddPlantingNoteInputSchema,
    execute: addPlantingNote,
  },
  {
    name: "log_expense",
    description: "Log a ledger entry in integer cents EUR (expense/income/subsidy/asset).",
    risk: "medium",
    inputSchema: LogExpenseInputSchema,
    execute: logExpense,
  },
  {
    name: "request_snapshot",
    description: "Queue a camera snapshot.take command for Edge to grab.",
    risk: "low",
    inputSchema: RequestSnapshotInputSchema,
    execute: requestSnapshot,
  },
  {
    name: "iot_bus_health",
    description: "MQTT / edge / Starlink / NVR health from FarmRuntime.",
    risk: "low",
    inputSchema: IotBusHealthInputSchema,
    execute: iotBusHealth,
  },
  {
    name: "fps_frost_status",
    description: "FPS frost status (M4 — not ready until LoRa fork).",
    risk: "low",
    inputSchema: FpsFrostStatusInputSchema,
    execute: fpsFrostStatus,
  },
  {
    name: "run_irrigation",
    description:
      "Run an irrigation zone. Requires confirm=true + reason. Blocked until M5.",
    risk: "high",
    inputSchema: RunIrrigationInputSchema,
    execute: runIrrigation,
  },
  {
    name: "set_climate_setpoint",
    description:
      "Set climate zone heat/cool setpoints. Requires confirm=true + reason. Battery lockout if heating.",
    risk: "high",
    inputSchema: SetClimateSetpointInputSchema,
    execute: setClimateSetpoint,
  },
  {
    name: "fps_arm_program",
    description:
      "Arm frost program on edge. Requires confirm=true + reason. Blocked until M4.",
    risk: "high",
    inputSchema: FpsArmProgramInputSchema,
    execute: fpsArmProgram,
  },
  {
    name: "fps_open_valve",
    description:
      "Open FPS frost valve. Requires confirm=true + reason + max_sec. Blocked until M4.",
    risk: "high",
    inputSchema: FpsOpenValveInputSchema,
    execute: fpsOpenValve,
  },
  {
    name: "set_actuator",
    description:
      "Turn actuator on/off with timeout_sec. Requires confirm=true + reason. Blocked until M9.",
    risk: "high",
    inputSchema: SetActuatorInputSchema,
    execute: setActuator,
  },
  {
    name: "propose_automation",
    description: "Save an automation draft (enabled=0). Does not enable.",
    risk: "medium",
    inputSchema: ProposeAutomationInputSchema,
    execute: proposeAutomation,
  },
  {
    name: "enable_automation",
    description:
      "Enable a draft automation. Requires confirm=true + reason. Blocked until M9.",
    risk: "high",
    inputSchema: EnableAutomationInputSchema,
    execute: enableAutomation,
  },
  {
    name: "ask_grok_briefing",
    description: "Generate or return today's Croatian + English farm briefing.",
    risk: "low",
    inputSchema: AskGrokBriefingInputSchema,
    execute: askGrokBriefing,
  },
];

export function getTool(name: string) {
  return TOOL_DEFS.find((t) => t.name === name);
}

export async function runTool(
  name: string,
  ctx: ToolContext,
  rawInput: unknown
): Promise<ToolResult> {
  const tool = getTool(name);
  if (!tool) return { error: "unknown_tool", name };

  const parsed = tool.inputSchema.safeParse(rawInput ?? {});
  if (!parsed.success) {
    return {
      error: "validation",
      details: parsed.error?.flatten?.() ?? parsed.error,
    };
  }

  return tool.execute(ctx, parsed.data);
}

/** OpenAI/xAI-style function definitions for the chat tool loop. */
export function grokToolDefinitions() {
  return TOOL_DEFS.map((t) => {
    const jsonSchema = zToJsonSchemaLite(
      t.inputSchema as { toJSONSchema?: () => Record<string, unknown> }
    );
    return {
      type: "function" as const,
      name: t.name,
      description: `[${t.risk}] ${t.description}`,
      parameters: jsonSchema,
    };
  });
}

/** Minimal Zod → JSON Schema for xAI tool params (object schemas only). */
function zToJsonSchemaLite(schema: {
  toJSONSchema?: () => Record<string, unknown>;
}): Record<string, unknown> {
  if (typeof schema.toJSONSchema === "function") {
    try {
      return schema.toJSONSchema();
    } catch {
      /* fall through */
    }
  }
  return {
    type: "object",
    additionalProperties: true,
    description: "Tool arguments",
  };
}
