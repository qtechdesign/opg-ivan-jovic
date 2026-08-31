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
