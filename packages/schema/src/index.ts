import { z } from "zod";

export const FarmSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1),
  name: z.string().min(1),
  country: z.string().default("HR"),
  timezone: z.string().default("Europe/Zagreb"),
  lat: z.number().nullable().optional(),
  lon: z.number().nullable().optional(),
  starlink_site: z.string().nullable().optional(),
  created_at: z.string(),
});

export type Farm = z.infer<typeof FarmSchema>;

export const PlotSchema = z.object({
  id: z.string().uuid(),
  farm_id: z.string().uuid(),
  name: z.string().min(1),
  hectares: z.number().nullable().optional(),
  use_type: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export type Plot = z.infer<typeof PlotSchema>;

export const PlantingStageSchema = z.enum([
  "planned",
  "seeded",
  "growing",
  "harvest",
  "fallow",
]);

export type PlantingStage = z.infer<typeof PlantingStageSchema>;

export const PlantingSchema = z.object({
  id: z.string().uuid(),
  plot_id: z.string().uuid(),
  crop: z.string().min(1),
  variety: z.string().nullable().optional(),
  planted_on: z.string().nullable().optional(),
  stage: PlantingStageSchema.nullable().optional(),
  expected_harvest: z.string().nullable().optional(),
  yield_kg: z.number().nullable().optional(),
});

export type Planting = z.infer<typeof PlantingSchema>;

export const CreatePlotSchema = z.object({
  farm_slug: z.string().min(1).default("ivan-jovic"),
  name: z.string().min(1).max(120),
  hectares: z.number().positive().nullable().optional(),
  use_type: z.string().max(64).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export type CreatePlot = z.infer<typeof CreatePlotSchema>;

export const CreatePlantingSchema = z.object({
  plot_id: z.string().uuid(),
  crop: z.string().min(1).max(120),
  variety: z.string().max(120).nullable().optional(),
  planted_on: z.string().nullable().optional(),
  stage: PlantingStageSchema.default("planned"),
  expected_harvest: z.string().nullable().optional(),
  yield_kg: z.number().nonnegative().nullable().optional(),
});

export type CreatePlanting = z.infer<typeof CreatePlantingSchema>;

export const PatchPlantingSchema = z
  .object({
    crop: z.string().min(1).max(120).optional(),
    variety: z.string().max(120).nullable().optional(),
    planted_on: z.string().nullable().optional(),
    stage: PlantingStageSchema.optional(),
    expected_harvest: z.string().nullable().optional(),
    yield_kg: z.number().nonnegative().nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "at least one field required",
  });

export type PatchPlanting = z.infer<typeof PatchPlantingSchema>;

export const GrowthMediaSchema = z.object({
  id: z.string().uuid(),
  farm_id: z.string().uuid(),
  plot_id: z.string().uuid().nullable().optional(),
  planting_id: z.string().uuid().nullable().optional(),
  r2_key: z.string().min(1),
  caption: z.string().nullable().optional(),
  content_type: z.string().nullable().optional(),
  created_at: z.string(),
});

export type GrowthMedia = z.infer<typeof GrowthMediaSchema>;

export const FarmWithPlotsSchema = FarmSchema.extend({
  plots: z.array(PlotSchema),
});

export type FarmWithPlots = z.infer<typeof FarmWithPlotsSchema>;

export const HealthSchema = z.object({
  ok: z.literal(true),
  service: z.string(),
  time: z.string(),
});

export type Health = z.infer<typeof HealthSchema>;

export const IngestReadingSchema = z.object({
  device_id: z.string().min(1).max(128),
  metric: z.string().min(1).max(64),
  value: z.number(),
  ts: z.string().min(1),
});

export type IngestReading = z.infer<typeof IngestReadingSchema>;

export const IngestBatchSchema = z.object({
  farm_id: z.string().min(1),
  batch_id: z.string().min(1).max(128),
  sent_at: z.string().min(1),
  readings: z.array(IngestReadingSchema).max(500).default([]),
  health: z
    .object({
      starlink: z.enum(["up", "down"]).optional(),
      gateway: z.string().optional(),
      mqtt: z.string().optional(),
      edge: z.string().optional(),
      nvr: z.enum(["ok", "down", "unconfigured"]).optional(),
      frost: z.enum(["idle", "watch", "armed", "spraying"]).optional(),
    })
    .optional(),
});

export type IngestBatch = z.infer<typeof IngestBatchSchema>;

export const LocalHealthSchema = z.object({
  farm_id: z.string(),
  starlink: z.enum(["up", "down", "unknown"]),
  edge: z.string().optional(),
  mqtt: z.string().optional(),
  gateway: z.string().optional(),
  nvr: z.enum(["ok", "down", "unconfigured"]).optional(),
  edge_seen_at: z.string().nullable(),
  last_ingest_at: z.string().nullable(),
  last_batch_id: z.string().nullable(),
});

export type LocalHealth = z.infer<typeof LocalHealthSchema>;

export const CameraSchema = z.object({
  id: z.string().min(1),
  farm_id: z.string().uuid(),
  name: z.string().min(1),
  zone: z.string().nullable().optional(),
  driver: z.string(),
  protocol: z.string().nullable().optional(),
  last_seen: z.string().nullable().optional(),
  snapshot: z
    .object({
      r2_key: z.string(),
      source: z.enum(["rtsp", "placeholder"]),
      captured_at: z.string(),
      url: z.string(),
    })
    .nullable()
    .optional(),
});

export type Camera = z.infer<typeof CameraSchema>;

export const IrrigationKindSchema = z.enum(["drip", "frost"]);
export type IrrigationKind = z.infer<typeof IrrigationKindSchema>;

export const IrrigationZoneSchema = z.object({
  id: z.string().uuid(),
  farm_id: z.string().uuid(),
  plot_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1),
  kind: IrrigationKindSchema,
  device_id: z.string().min(1),
  max_duration_sec: z.number().int().positive(),
  default_duration_sec: z.number().int().positive(),
  rain_lockout: z.number().int().min(0).max(1),
  enabled: z.number().int().min(0).max(1),
});
export type IrrigationZone = z.infer<typeof IrrigationZoneSchema>;

export const RunIrrigationSchema = z.object({
  duration_sec: z.number().int().min(30).max(3600),
  reason: z.string().min(3).max(500),
  confirm: z.boolean().default(false),
});
export type RunIrrigation = z.infer<typeof RunIrrigationSchema>;

export const RainLockoutSchema = z.object({
  enabled: z.boolean(),
  reason: z.string().min(3).max(500),
  confirm: z.boolean().default(false),
});
export type RainLockout = z.infer<typeof RainLockoutSchema>;

export const IrrigationScheduleSchema = z.object({
  id: z.string().uuid(),
  farm_id: z.string().uuid(),
  zone_id: z.string().uuid(),
  time_local: z.string().regex(/^\d{2}:\d{2}$/),
  days_json: z.string(),
  duration_sec: z.number().int().min(30).max(3600),
  timezone: z.string().default("Europe/Zagreb"),
  enabled: z.number().int().min(0).max(1),
});
export type IrrigationSchedule = z.infer<typeof IrrigationScheduleSchema>;

export const PutIrrigationScheduleSchema = z.object({
  time_local: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  days_json: z.string().optional(),
  duration_sec: z.number().int().min(30).max(3600).optional(),
  timezone: z.string().optional(),
  enabled: z.number().int().min(0).max(1).optional(),
  confirm: z.boolean().default(false),
  reason: z.string().min(3).max(500).optional(),
});
export type PutIrrigationSchedule = z.infer<typeof PutIrrigationScheduleSchema>;

// —— M7 Money / ledger ——

export const LedgerKindSchema = z.enum([
  "expense",
  "income",
  "subsidy",
  "asset",
]);
export type LedgerKind = z.infer<typeof LedgerKindSchema>;

export const LedgerCategorySchema = z.enum([
  "feed",
  "seed",
  "energy",
  "repair",
  "sale",
  "eu_measure",
  "other",
]);
export type LedgerCategory = z.infer<typeof LedgerCategorySchema>;

export const LedgerEntrySchema = z.object({
  id: z.string().uuid(),
  farm_id: z.string().uuid(),
  ts: z.string().min(1),
  kind: LedgerKindSchema,
  category: LedgerCategorySchema.nullable().optional(),
  amount_cents: z.number().int().positive(),
  currency: z.literal("EUR"),
  note: z.string().nullable().optional(),
  r2_key: z.string().nullable().optional(),
});
export type LedgerEntry = z.infer<typeof LedgerEntrySchema>;

/** Accept amount_cents or amount_eur (2 decimals); route stores cents. */
export const CreateLedgerSchema = z
  .object({
    farm_slug: z.string().min(1).default("ivan-jovic"),
    ts: z.string().min(1).optional(),
    kind: LedgerKindSchema,
    category: LedgerCategorySchema.nullable().optional(),
    amount_cents: z.number().int().positive().max(100_000_000).optional(),
    amount_eur: z.number().positive().max(1_000_000).optional(),
    currency: z.enum(["EUR"]).default("EUR"),
    note: z.string().max(2000).nullable().optional(),
  })
  .refine((v) => v.amount_cents != null || v.amount_eur != null, {
    message: "amount_cents or amount_eur required",
  });
export type CreateLedger = z.infer<typeof CreateLedgerSchema>;

export const PatchLedgerSchema = z
  .object({
    ts: z.string().min(1).optional(),
    kind: LedgerKindSchema.optional(),
    category: LedgerCategorySchema.nullable().optional(),
    amount_cents: z.number().int().positive().max(100_000_000).optional(),
    amount_eur: z.number().positive().max(1_000_000).optional(),
    note: z.string().max(2000).nullable().optional(),
  })
  .refine(
    (v) =>
      v.ts !== undefined ||
      v.kind !== undefined ||
      v.category !== undefined ||
      v.amount_cents !== undefined ||
      v.amount_eur !== undefined ||
      v.note !== undefined,
    { message: "at least one field required" }
  );
export type PatchLedger = z.infer<typeof PatchLedgerSchema>;

/** MCP / agent log_expense (M8 uses this; schema lives with ledger). */
export const LogExpenseInputSchema = z.object({
  amount_cents: z.number().int().positive().max(100_000_000),
  category: LedgerCategorySchema.optional(),
  note: z.string().max(500).optional(),
  farm_slug: z.string().min(1).default("ivan-jovic"),
  kind: LedgerKindSchema.default("expense"),
});
export type LogExpenseInput = z.infer<typeof LogExpenseInputSchema>;

export const DEFAULT_FARM_SLUG = "ivan-jovic";

export const ConfirmReasonSchema = z.object({
  reason: z.string().min(3).max(500),
  confirm: z.boolean().default(false),
});
export type ConfirmReason = z.infer<typeof ConfirmReasonSchema>;

// —— M6 Climate + energy ——

export const HEAT_C_MIN = 5;
export const HEAT_C_MAX = 28;
export const COOL_C_MIN = 10;
export const COOL_C_MAX = 35;
export const HEAT_BATTERY_MIN_PCT_DEFAULT = 30;

export const ClimateZoneSchema = z.object({
  id: z.string().uuid(),
  farm_id: z.string().uuid(),
  plot_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1),
  sensor_id: z.string().min(1),
  heater_id: z.string().nullable().optional(),
  cooler_id: z.string().nullable().optional(),
  battery_id: z.string().nullable().optional(),
  heat_c: z.number(),
  cool_c: z.number(),
  heat_c_min: z.number().default(HEAT_C_MIN),
  heat_c_max: z.number().default(HEAT_C_MAX),
  cool_c_min: z.number().default(COOL_C_MIN),
  cool_c_max: z.number().default(COOL_C_MAX),
  timeout_sec: z.number().int().positive().default(1800),
  enabled: z.number().int().min(0).max(1),
});
export type ClimateZone = z.infer<typeof ClimateZoneSchema>;

export const SetClimateSetpointSchema = z
  .object({
    heat_c: z.number().min(HEAT_C_MIN).max(HEAT_C_MAX).optional(),
    cool_c: z.number().min(COOL_C_MIN).max(COOL_C_MAX).optional(),
    confirm: z.boolean().default(false),
    reason: z.string().min(3).max(500),
  })
  .refine((v) => v.heat_c != null || v.cool_c != null, {
    message: "heat_c or cool_c required",
  })
  .refine(
    (v) => v.heat_c == null || v.cool_c == null || v.heat_c < v.cool_c,
    { message: "heat_c must be < cool_c" }
  );
export type SetClimateSetpoint = z.infer<typeof SetClimateSetpointSchema>;

/** MCP / agent: zone in body. `temp_c` aliases `heat_c`. */
export const SetClimateSetpointInputSchema = ConfirmReasonSchema.extend({
  zone_id: z.string().min(1),
  farm_slug: z.string().min(1).default(DEFAULT_FARM_SLUG),
  heat_c: z.number().min(HEAT_C_MIN).max(HEAT_C_MAX).optional(),
  cool_c: z.number().min(COOL_C_MIN).max(COOL_C_MAX).optional(),
  temp_c: z.number().min(HEAT_C_MIN).max(HEAT_C_MAX).optional(),
}).superRefine((v, ctx) => {
  const heat = v.heat_c ?? v.temp_c;
  if (heat == null && v.cool_c == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "heat_c, temp_c, or cool_c required",
    });
  }
  if (heat != null && v.cool_c != null && heat >= v.cool_c) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "heat_c must be < cool_c",
    });
  }
});
export type SetClimateSetpointInput = z.infer<
  typeof SetClimateSetpointInputSchema
>;

export const HeatLockoutSchema = z.object({
  battery_min_pct: z.number().int().min(5).max(90),
  confirm: z.boolean().default(false),
  reason: z.string().min(3).max(500),
});
export type HeatLockout = z.infer<typeof HeatLockoutSchema>;

export const ClimateNowSchema = z.object({
  farm_id: z.string(),
  slug: z.string(),
  heat_battery_min_pct: z.number(),
  zones: z.array(z.record(z.unknown())),
});
export type ClimateNow = z.infer<typeof ClimateNowSchema>;

export const EnergyNowSchema = z.object({
  farm_id: z.string(),
  slug: z.string(),
  solar_w: z.number().nullable(),
  kwh_today: z.number().nullable(),
  battery_pct: z.number().nullable(),
  loads: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      w: z.number().nullable(),
    })
  ),
});
export type EnergyNow = z.infer<typeof EnergyNowSchema>;

export const GetOverviewInputSchema = z.object({
  farm_slug: z.string().min(1).default(DEFAULT_FARM_SLUG),
});
export type GetOverviewInput = z.infer<typeof GetOverviewInputSchema>;

export const ListReadingsInputSchema = z.object({
  farm_slug: z.string().min(1).default(DEFAULT_FARM_SLUG),
  device_id: z.string().min(1).max(128).optional(),
  metric: z.string().min(1).max(64).optional(),
  limit: z.number().int().min(1).max(200).default(50),
});
export type ListReadingsInput = z.infer<typeof ListReadingsInputSchema>;

export const AddPlantingNoteInputSchema = z.object({
  planting_id: z.string().uuid(),
  body: z.string().min(1).max(2000),
  farm_slug: z.string().min(1).default(DEFAULT_FARM_SLUG),
});
export type AddPlantingNoteInput = z.infer<typeof AddPlantingNoteInputSchema>;

export const RequestSnapshotInputSchema = z.object({
  camera_id: z.string().min(1).max(128),
  farm_slug: z.string().min(1).default(DEFAULT_FARM_SLUG),
});
export type RequestSnapshotInput = z.infer<typeof RequestSnapshotInputSchema>;

export const RunIrrigationInputSchema = ConfirmReasonSchema.extend({
  zone_id: z.string().min(1),
  duration_sec: z.number().int().min(30).max(3600),
  farm_slug: z.string().min(1).default(DEFAULT_FARM_SLUG),
});
export type RunIrrigationInput = z.infer<typeof RunIrrigationInputSchema>;

export const FpsArmProgramInputSchema = ConfirmReasonSchema.extend({
  farm_slug: z.string().min(1).default(DEFAULT_FARM_SLUG),
  program_json: z.string().max(10_000).optional(),
});
export type FpsArmProgramInput = z.infer<typeof FpsArmProgramInputSchema>;

export const FpsOpenValveInputSchema = ConfirmReasonSchema.extend({
  valve_id: z.string().min(1),
  max_sec: z.number().int().min(10).max(3600),
  farm_slug: z.string().min(1).default(DEFAULT_FARM_SLUG),
});
export type FpsOpenValveInput = z.infer<typeof FpsOpenValveInputSchema>;

export const SetActuatorInputSchema = ConfirmReasonSchema.extend({
  device_id: z.string().min(1),
  state: z.enum(["on", "off"]),
  timeout_sec: z.number().int().min(1).max(3600),
  farm_slug: z.string().min(1).default(DEFAULT_FARM_SLUG),
});
export type SetActuatorInput = z.infer<typeof SetActuatorInputSchema>;

export const ProposeAutomationInputSchema = z.object({
  name: z.string().min(1).max(120),
  trigger_json: z.string().min(2).max(5000),
  action_json: z.string().min(2).max(5000),
  farm_slug: z.string().min(1).default(DEFAULT_FARM_SLUG),
});
export type ProposeAutomationInput = z.infer<
  typeof ProposeAutomationInputSchema
>;

export const EnableAutomationInputSchema = ConfirmReasonSchema.extend({
  automation_id: z.string().uuid(),
  farm_slug: z.string().min(1).default(DEFAULT_FARM_SLUG),
});
export type EnableAutomationInput = z.infer<typeof EnableAutomationInputSchema>;

export const AskGrokBriefingInputSchema = z.object({
  farm_slug: z.string().min(1).default(DEFAULT_FARM_SLUG),
  force: z.boolean().default(false),
});
export type AskGrokBriefingInput = z.infer<typeof AskGrokBriefingInputSchema>;

export const IotBusHealthInputSchema = z.object({
  farm_slug: z.string().min(1).default(DEFAULT_FARM_SLUG),
});
export type IotBusHealthInput = z.infer<typeof IotBusHealthInputSchema>;

export const FpsFrostStatusInputSchema = z.object({
  farm_slug: z.string().min(1).default(DEFAULT_FARM_SLUG),
});
export type FpsFrostStatusInput = z.infer<typeof FpsFrostStatusInputSchema>;

export const GrokChatSchema = z.object({
  farm_slug: z.string().min(1).default(DEFAULT_FARM_SLUG),
  message: z.string().min(1).max(4000),
});
export type GrokChat = z.infer<typeof GrokChatSchema>;

export const BriefingSchema = z.object({
  id: z.string().uuid(),
  farm_id: z.string().uuid(),
  local_date: z.string().min(10).max(10),
  body_hr: z.string(),
  body_en: z.string(),
  r2_key: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  created_at: z.string(),
});
export type Briefing = z.infer<typeof BriefingSchema>;

export const PlantingNoteSchema = z.object({
  id: z.string().uuid(),
  farm_id: z.string().uuid(),
  planting_id: z.string().uuid(),
  body: z.string().min(1).max(2000),
  actor: z.string(),
  created_at: z.string(),
});
export type PlantingNote = z.infer<typeof PlantingNoteSchema>;

// —— M9 Automations + robots ——

export const AutomationRiskSchema = z.enum(["low", "medium", "high"]);
export type AutomationRisk = z.infer<typeof AutomationRiskSchema>;

export const JobKindSchema = z.enum([
  "robot.mow",
  "robot.inspect",
  "ai.build",
  "scene",
  "note",
]);
export type JobKind = z.infer<typeof JobKindSchema>;

export const JobStatusSchema = z.enum([
  "proposed",
  "queued",
  "confirmed",
  "running",
  "done",
  "failed",
  "cancelled",
]);
export type JobStatus = z.infer<typeof JobStatusSchema>;

export const AutomationTriggerSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("schedule"),
    cron: z.string().min(9).max(64),
    timezone: z.string().default("Europe/Zagreb"),
  }),
  z.object({
    type: z.literal("metric"),
    device_id: z.string().min(1).max(128),
    metric: z.string().min(1).max(64),
    op: z.enum(["lt", "gt", "eq"]),
    value: z.number(),
    for_sec: z.number().int().positive().optional(),
  }),
  z.object({
    type: z.literal("health"),
    field: z.enum(["starlink", "mqtt", "edge", "nvr"]),
    equals: z.string().min(1).max(64),
  }),
  z.object({
    type: z.literal("manual"),
  }),
]);
export type AutomationTrigger = z.infer<typeof AutomationTriggerSchema>;

export const AutomationActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("snapshot.take"),
    camera_id: z.string().min(1).max(128),
  }),
  z.object({
    type: z.literal("notify.draft"),
    subject: z.string().min(1).max(200),
    body: z.string().min(1).max(5000),
  }),
  z.object({
    type: z.literal("job.enqueue"),
    kind: JobKindSchema,
    payload: z.record(z.unknown()).optional(),
  }),
  z.object({
    type: z.literal("command.propose"),
    device_id: z.string().min(1).max(128),
    action: z.string().min(1).max(64),
    payload: z.record(z.unknown()).optional(),
  }),
]);
export type AutomationAction = z.infer<typeof AutomationActionSchema>;

/** Low-risk command actions that may auto-`sent` without human confirm. */
export const LOW_RISK_COMMAND_ACTIONS = ["snapshot.take"] as const;

export function riskForAction(action: AutomationAction): AutomationRisk {
  if (action.type === "snapshot.take") return "low";
  if (action.type === "notify.draft") return "medium";
  if (action.type === "job.enqueue") {
    if (action.kind === "robot.mow" || action.kind === "robot.inspect") {
      return "high";
    }
    return "medium";
  }
  if (action.type === "command.propose") {
    if (
      (LOW_RISK_COMMAND_ACTIONS as readonly string[]).includes(action.action)
    ) {
      return "low";
    }
    return "high";
  }
  return "high";
}

export const AutomationSchema = z.object({
  id: z.string().uuid(),
  farm_id: z.string().uuid(),
  name: z.string().min(1).max(120),
  enabled: z.number().int().min(0).max(1),
  risk: AutomationRiskSchema,
  trigger_json: z.string(),
  action_json: z.string(),
  cooldown_sec: z.number().int().nonnegative(),
  last_fired_at: z.string().nullable().optional(),
  last_error: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
});
export type Automation = z.infer<typeof AutomationSchema>;

export const CreateAutomationSchema = z.object({
  farm_slug: z.string().min(1).default(DEFAULT_FARM_SLUG),
  name: z.string().min(1).max(120),
  trigger: AutomationTriggerSchema,
  action: AutomationActionSchema,
  cooldown_sec: z.number().int().min(0).max(86400).default(300),
  enabled: z.boolean().default(false),
  confirm: z.boolean().default(false),
  reason: z.string().min(3).max(500).optional(),
});
export type CreateAutomation = z.infer<typeof CreateAutomationSchema>;

export const PutAutomationSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  trigger: AutomationTriggerSchema.optional(),
  action: AutomationActionSchema.optional(),
  cooldown_sec: z.number().int().min(0).max(86400).optional(),
  enabled: z.boolean().optional(),
  confirm: z.boolean().default(false),
  reason: z.string().min(3).max(500).optional(),
});
export type PutAutomation = z.infer<typeof PutAutomationSchema>;

export const EnableAutomationBodySchema = z.object({
  confirm: z.boolean().default(false),
  reason: z.string().min(3).max(500).optional(),
  enabled: z.boolean().default(true),
});
export type EnableAutomationBody = z.infer<typeof EnableAutomationBodySchema>;

export const JobSchema = z.object({
  id: z.string().uuid(),
  farm_id: z.string().uuid(),
  kind: JobKindSchema,
  status: JobStatusSchema,
  payload_json: z.string().nullable().optional(),
  source: z.string(),
  confirmed_by: z.string().nullable().optional(),
  reason: z.string().nullable().optional(),
  automation_id: z.string().uuid().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Job = z.infer<typeof JobSchema>;

export const CreateJobSchema = z.object({
  farm_slug: z.string().min(1).default(DEFAULT_FARM_SLUG),
  kind: JobKindSchema,
  payload: z.record(z.unknown()).optional(),
  reason: z.string().min(3).max(500).optional(),
});
export type CreateJob = z.infer<typeof CreateJobSchema>;

export const ConfirmJobSchema = z.object({
  confirm: z.literal(true),
  reason: z.string().min(3).max(500),
});
export type ConfirmJob = z.infer<typeof ConfirmJobSchema>;

export const PatchJobSchema = z.object({
  status: z.enum(["cancelled", "done", "failed", "running"]),
  reason: z.string().max(500).optional(),
});
export type PatchJob = z.infer<typeof PatchJobSchema>;

export const CreateCommandSchema = z.object({
  farm_slug: z.string().min(1).default(DEFAULT_FARM_SLUG),
  device_id: z.string().min(1).max(128),
  action: z.string().min(1).max(64),
  payload: z.record(z.unknown()).optional(),
  confirm: z.boolean().default(false),
  reason: z.string().min(3).max(500).optional(),
});
export type CreateCommand = z.infer<typeof CreateCommandSchema>;

export const ConfirmCommandSchema = z.object({
  confirm: z.literal(true),
  reason: z.string().min(3).max(500),
});
export type ConfirmCommand = z.infer<typeof ConfirmCommandSchema>;

// —— Mail (agent mailbox) ——

export const AGENT_MAILBOX_ADDRESS = "farm@opg-ivanjovic.hr";
export const AGENT_MAILBOX_NAME = "OPG Ivan Jović";

export const MailDirectionSchema = z.enum(["inbound", "outbound"]);
export type MailDirection = z.infer<typeof MailDirectionSchema>;

export const MailStatusSchema = z.enum([
  "received",
  "queued",
  "sent",
  "failed",
]);
export type MailStatus = z.infer<typeof MailStatusSchema>;

export const MailboxSchema = z.object({
  id: z.string().uuid(),
  farm_id: z.string().uuid(),
  address: z.string().email(),
  display_name: z.string().min(1),
  kind: z.string(),
  created_at: z.string(),
});
export type Mailbox = z.infer<typeof MailboxSchema>;

export const MailMessageSchema = z.object({
  id: z.string().uuid(),
  farm_id: z.string().uuid(),
  mailbox_id: z.string().uuid(),
  thread_id: z.string().uuid(),
  direction: MailDirectionSchema,
  status: MailStatusSchema,
  from_addr: z.string(),
  to_addr: z.string(),
  subject: z.string(),
  text_body: z.string().nullable().optional(),
  message_id_hdr: z.string().nullable().optional(),
  in_reply_to: z.string().nullable().optional(),
  cf_message_id: z.string().nullable().optional(),
  attachment_count: z.number().int().nonnegative(),
  ts: z.string(),
});
export type MailMessage = z.infer<typeof MailMessageSchema>;

export const SendMailSchema = z.object({
  farm_slug: z.string().min(1).default(DEFAULT_FARM_SLUG),
  to: z.string().email().max(320),
  subject: z.string().min(1).max(200),
  text: z.string().min(1).max(100_000),
  html: z.string().max(200_000).optional(),
  thread_id: z.string().uuid().optional(),
  confirm: z.literal(true),
  reason: z.string().min(3).max(500),
});
export type SendMail = z.infer<typeof SendMailSchema>;

// —— M4 FPS / frost ——

export const FrostStatusSchema = z.enum(["idle", "watch", "armed", "spraying"]);
export type FrostStatus = z.infer<typeof FrostStatusSchema>;

export const FrostProgramSchema = z.object({
  temp_threshold_c: z.number().min(-20).max(10).default(1.5),
  rh_min: z.number().min(0).max(100).default(0),
  max_spray_sec: z.number().int().min(30).max(3600).default(600),
  valve_ids: z.array(z.string().min(1)).min(1).default(["fps-valve-1"]),
  sensor_id: z.string().min(1).default("fps-sn-1"),
  mode: z.enum(["ice", "fog"]).default("ice"),
});
export type FrostProgram = z.infer<typeof FrostProgramSchema>;

export const LoadFrostProgramSchema = FrostProgramSchema.extend({
  farm_slug: z.string().min(1).default("ivan-jovic"),
});
export type LoadFrostProgram = z.infer<typeof LoadFrostProgramSchema>;

export const ArmFrostSchema = z.object({
  farm_slug: z.string().min(1).default("ivan-jovic"),
  arm: z.boolean().default(true),
  confirm: z.boolean().default(false),
  reason: z.string().min(3).max(500).optional(),
});
export type ArmFrost = z.infer<typeof ArmFrostSchema>;

export const OpenFpsValveSchema = z.object({
  max_sec: z.number().int().min(30).max(3600),
  reason: z.string().min(3).max(500),
  confirm: z.boolean().default(false),
});
export type OpenFpsValve = z.infer<typeof OpenFpsValveSchema>;
