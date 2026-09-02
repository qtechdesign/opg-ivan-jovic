import {
  DEFAULT_FARM_FLAGS,
  FarmFlagsSchema,
  type FarmFlags,
  type FarmFlagName,
} from "@polje/schema";

export { DEFAULT_FARM_FLAGS };

export const RL_LOGIN = { limit: 10, windowSec: 900 } as const;
export const RL_GROK = { limit: 40, windowSec: 900 } as const;
export const RL_MAIL = { limit: 30, windowSec: 3600 } as const;
export const RL_MAPS = { limit: 20, windowSec: 600 } as const;

export function flagsKey(slug: string): string {
  return `flags:${slug}`;
}

export function farmCacheKey(slug: string): string {
  return `cache:farm:${slug}`;
}

export function rlLoginKey(ip: string): string {
  return `rl:login:${ip}`;
}

export function rlGrokKey(slug: string): string {
  return `rl:grok:${slug}`;
}

export function rlMailKey(slug: string): string {
  return `rl:mail:${slug}`;
}

export function rlMapsKey(ip: string): string {
  return `rl:maps:${ip}`;
}

export function clientIp(c: {
  req: { header: (name: string) => string | undefined };
}): string {
  const cf = c.req.header("cf-connecting-ip");
  if (cf && cf.trim()) return cf.trim();
  const xff = c.req.header("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return "unknown";
}

export async function getFlags(
  kv: KVNamespace | undefined,
  slug: string
): Promise<FarmFlags> {
  if (!kv) return { ...DEFAULT_FARM_FLAGS };
  try {
    const stored = await kv.get(flagsKey(slug), "json");
    const parsed = FarmFlagsSchema.partial().safeParse(stored ?? {});
    if (!parsed.success) return { ...DEFAULT_FARM_FLAGS };
    return { ...DEFAULT_FARM_FLAGS, ...parsed.data };
  } catch {
    return { ...DEFAULT_FARM_FLAGS };
  }
}

export async function setFlags(
  kv: KVNamespace,
  slug: string,
  patch: Partial<FarmFlags>
): Promise<FarmFlags> {
  const next = { ...(await getFlags(kv, slug)), ...patch };
  await kv.put(flagsKey(slug), JSON.stringify(next));
  return next;
}

export async function flagEnabled(
  kv: KVNamespace | undefined,
  slug: string,
  name: FarmFlagName
): Promise<boolean> {
  const flags = await getFlags(kv, slug);
  return flags[name] !== false;
}

export async function consumeRateLimit(
  kv: KVNamespace | undefined,
  key: string,
  limit: number,
  windowSec: number
): Promise<{ allowed: boolean; remaining: number }> {
  if (!kv) return { allowed: true, remaining: limit };
  try {
    const raw = await kv.get(key);
    const n = raw == null ? 0 : Number.parseInt(raw, 10);
    const count = Number.isFinite(n) && n >= 0 ? n : 0;
    if (count >= limit) return { allowed: false, remaining: 0 };
    await kv.put(key, String(count + 1), { expirationTtl: Math.max(60, windowSec) });
    return { allowed: true, remaining: Math.max(0, limit - count - 1) };
  } catch {
    return { allowed: true, remaining: limit };
  }
}

export type MetricEvent =
  | "login"
  | "login_fail"
  | "grok"
  | "briefing"
  | "mail_in"
  | "mail_out"
  | "ingest"
  | "automation"
  | "flag_patch";

export function writeMetric(
  env: { METRICS?: AnalyticsEngineDataset },
  event: MetricEvent,
  slug: string,
  extra?: string
): void {
  try {
    env.METRICS?.writeDataPoint({
      indexes: [slug.slice(0, 96)],
      blobs: [event, extra ?? ""],
      doubles: [1],
    });
  } catch {
    /* analytics is best-effort */
  }
}
