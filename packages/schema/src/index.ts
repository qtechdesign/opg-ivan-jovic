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
  edge_seen_at: z.string().nullable(),
  last_ingest_at: z.string().nullable(),
  last_batch_id: z.string().nullable(),
});

export type LocalHealth = z.infer<typeof LocalHealthSchema>;
