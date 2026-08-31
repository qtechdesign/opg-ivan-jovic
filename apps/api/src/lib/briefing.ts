import { writeAudit } from "./audit";
import { defaultFarmSlug, getFarmBySlug } from "./farm";
import { farmStub } from "../do/farm-runtime";
import type { ToolActor } from "../mcp/tools";
import { callXaiText } from "./grok";

export type BriefingOptions = {
  farmSlug?: string;
  force?: boolean;
  actor: ToolActor;
  /** Injected for tests — skip xAI when provided */
  mockBodies?: { hr: string; en: string; model?: string };
};

export function zagrebLocalParts(date = new Date()): {
  date: string;
  hour: number;
} {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Zagreb",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "00";
  let hour = Number(get("hour"));
  // Some engines emit "24" for midnight
  if (hour === 24) hour = 0;
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    hour,
  };
}

async function buildRollup(env: Cloudflare.Env, farmId: string, slug: string) {
  const stub = farmStub(env, slug);
  const liveRes = await stub.fetch(
    new Request(`https://do/overview?farm_id=${encodeURIComponent(slug)}`)
  );
  const live = await liveRes.json();

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const readings = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM readings r
     JOIN devices d ON d.id = r.device_id
     WHERE d.farm_id = ? AND r.ts >= ?`
  )
    .bind(farmId, since)
    .first<{ n: number }>();

  const audit = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM audit WHERE farm_id = ? AND ts >= ?`
  )
    .bind(farmId, since)
    .first<{ n: number }>();

  const snaps = await env.DB.prepare(
    `SELECT camera_id, captured_at FROM camera_snapshots WHERE farm_id = ?`
  )
    .bind(farmId)
    .all<{ camera_id: string; captured_at: string }>();

  const mail = await env.DB.prepare(
    `SELECT
       SUM(CASE WHEN direction = 'inbound' THEN 1 ELSE 0 END) AS inbound,
       SUM(CASE WHEN direction = 'outbound' THEN 1 ELSE 0 END) AS outbound
     FROM mail_messages WHERE farm_id = ? AND ts >= ?`
  )
    .bind(farmId, since)
    .first<{ inbound: number | null; outbound: number | null }>();

  const plots = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM plots WHERE farm_id = ?`
  )
    .bind(farmId)
    .first<{ n: number }>();

  return {
    live,
    readings_24h: readings?.n ?? 0,
    audit_24h: audit?.n ?? 0,
    camera_snapshots: snaps.results ?? [],
    mail_24h: {
      inbound: mail?.inbound ?? 0,
      outbound: mail?.outbound ?? 0,
    },
    plots: plots?.n ?? 0,
  };
}

function parseBriefingText(raw: string): { hr: string; en: string } {
  const hrMatch = raw.match(/===HR===\s*([\s\S]*?)(?:===EN===|$)/i);
  const enMatch = raw.match(/===EN===\s*([\s\S]*?)$/i);
  const hr = (hrMatch?.[1] ?? raw).trim();
  const en = (enMatch?.[1] ?? raw).trim();
  return { hr: hr.slice(0, 8000), en: en.slice(0, 8000) };
}

export async function generateBriefing(
  env: Cloudflare.Env,
  opts: BriefingOptions
): Promise<Record<string, unknown>> {
  const slug = opts.farmSlug || defaultFarmSlug(env);
  const farm = await getFarmBySlug(env.DB, slug);
  if (!farm) return { error: "farm_not_found", slug };

  const { date: localDate } = zagrebLocalParts();

  if (!opts.force) {
    const existing = await env.DB.prepare(
      `SELECT id, farm_id, local_date, body_hr, body_en, r2_key, model, created_at
       FROM briefings WHERE farm_id = ? AND local_date = ?`
    )
      .bind(farm.id, localDate)
      .first();
    if (existing) {
      return { ok: true, cached: true, briefing: existing };
    }
  }

  let body_hr: string;
  let body_en: string;
  let model: string;

  if (opts.mockBodies) {
    body_hr = opts.mockBodies.hr;
    body_en = opts.mockBodies.en;
    model = opts.mockBodies.model ?? "mock";
  } else {
    if (!env.XAI_API_KEY) {
      return { error: "xai_not_configured" };
    }
    const rollup = await buildRollup(env, farm.id, farm.slug);
    const prompt = `You are the Polje farm operator brain for ${farm.name} (timezone Europe/Zagreb).
Write a short daily farm briefing from this 24h rollup JSON.
Do NOT invent actuator actions. Do NOT include secrets, camera URLs, tokens, or bank data.
Respond EXACTLY in this format:
===HR===
(2-5 short sentences in Croatian)
===EN===
(2-5 short sentences in English)

ROLLUP:
${JSON.stringify(rollup)}`;

    const text = await callXaiText(env.XAI_API_KEY, prompt);
    const parsed = parseBriefingText(text);
    body_hr = parsed.hr;
    body_en = parsed.en;
    model = "grok-4.6";
  }

  const id = crypto.randomUUID();
  const created_at = new Date().toISOString();
  const r2_key = `${farm.slug}/briefings/${localDate}.md`;
  const md = `# Briefing ${localDate} — ${farm.name}\n\n## HR\n\n${body_hr}\n\n## EN\n\n${body_en}\n`;

  await env.MEDIA.put(r2_key, md, {
    httpMetadata: { contentType: "text/markdown; charset=utf-8" },
  });

  await env.DB.prepare(
    `INSERT INTO briefings (id, farm_id, local_date, body_hr, body_en, r2_key, model, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(farm_id, local_date) DO UPDATE SET
       body_hr = excluded.body_hr,
       body_en = excluded.body_en,
       r2_key = excluded.r2_key,
       model = excluded.model,
       created_at = excluded.created_at,
       id = excluded.id`
  )
    .bind(id, farm.id, localDate, body_hr, body_en, r2_key, model, created_at)
    .run();

  const briefing = {
    id,
    farm_id: farm.id,
    local_date: localDate,
    body_hr,
    body_en,
    r2_key,
    model,
    created_at,
  };

  await writeAudit(env.DB, {
    farm_id: farm.id,
    actor: opts.actor,
    action: "grok.briefing",
    entity: `briefing:${localDate}`,
    after: { id, local_date: localDate, model },
  });

  // Optional notify email
  const notifyTo = env.OPERATOR_NOTIFY_EMAIL;
  if (notifyTo && env.EMAIL) {
    try {
      const { sendFarmMail } = await import("./mail");
      await sendFarmMail(env, {
        farm_id: farm.id,
        to: notifyTo,
        subject: `Polje briefing ${localDate}`,
        text: `${body_hr}\n\n---\n\n${body_en}`,
        reason: "daily_briefing",
        actor: opts.actor,
      });
    } catch (err) {
      console.error("briefing notify failed", err);
    }
  }

  return { ok: true, cached: false, briefing };
}

export async function getTodayBriefing(env: Cloudflare.Env, farmSlug: string) {
  const farm = await getFarmBySlug(env.DB, farmSlug);
  if (!farm) return null;
  const { date } = zagrebLocalParts();
  return env.DB.prepare(
    `SELECT id, farm_id, local_date, body_hr, body_en, r2_key, model, created_at
     FROM briefings WHERE farm_id = ? AND local_date = ?`
  )
    .bind(farm.id, date)
    .first();
}

/** Cron entry: only runs at 06:00 Europe/Zagreb. */
export async function maybeRunMorningBriefing(
  env: Cloudflare.Env
): Promise<{ ran: boolean; reason?: string; result?: Record<string, unknown> }> {
  const { hour, date } = zagrebLocalParts();
  if (hour !== 6) {
    return { ran: false, reason: `hour_${hour}_not_6` };
  }

  const slug = defaultFarmSlug(env);
  const farm = await getFarmBySlug(env.DB, slug);
  if (!farm) return { ran: false, reason: "farm_not_found" };

  const existing = await env.DB.prepare(
    `SELECT id FROM briefings WHERE farm_id = ? AND local_date = ?`
  )
    .bind(farm.id, date)
    .first();
  if (existing) {
    return { ran: false, reason: "already_exists" };
  }

  const result = await generateBriefing(env, {
    farmSlug: slug,
    force: false,
    actor: "cron:briefing",
  });
  return { ran: true, result };
}
