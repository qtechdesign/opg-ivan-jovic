import { Hono } from "hono";
import { requireOperator } from "../lib/auth";
import { writeAudit } from "../lib/audit";
import { farmSlugFromQuery, getFarmBySlug } from "../lib/farm";
import {
  DEFAULT_HERO_PROMPT,
  DEFAULT_OG_PROMPT,
  OG_WHATSAPP_MAX_BYTES,
  heroR2Key,
  heroSourceR2Key,
  imagineOgJpeg,
  ogR2Key,
  ogSourceR2Key,
  putOgImage,
} from "../lib/og";

type AppEnv = { Bindings: Cloudflare.Env };

export const ogApi = new Hono<AppEnv>();

ogApi.get("/og.jpg", async (c) => {
  const slug = farmSlugFromQuery(c);
  const obj = await c.env.MEDIA.get(ogR2Key(slug));
  if (!obj) {
    // JSON 404 on an image URL poisons X/WhatsApp crawler cache.
    return new Response(null, {
      status: 404,
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "no-store" },
    });
  }

  const headers = new Headers();
  headers.set(
    "Content-Type",
    obj.httpMetadata?.contentType || "image/jpeg"
  );
  headers.set("Cache-Control", "public, max-age=86400");
  headers.set("Content-Disposition", "inline; filename=\"og.jpg\"");
  if (typeof obj.size === "number") {
    headers.set("Content-Length", String(obj.size));
  }
  return new Response(obj.body, { headers });
});

ogApi.get("/hero.jpg", async (c) => {
  const slug = farmSlugFromQuery(c);
  const obj =
    (await c.env.MEDIA.get(heroR2Key(slug))) ||
    (await c.env.MEDIA.get(ogR2Key(slug)));
  if (!obj) return c.json({ error: "hero_not_generated" }, 404);

  const headers = new Headers();
  headers.set(
    "Content-Type",
    obj.httpMetadata?.contentType || "image/jpeg"
  );
  headers.set("Cache-Control", "public, max-age=300");
  headers.set("Content-Disposition", "inline; filename=\"hero.jpg\"");
  if (typeof obj.size === "number") {
    headers.set("Content-Length", String(obj.size));
  }
  return new Response(obj.body, { headers });
});

ogApi.post("/v1/og/generate", async (c) => {
  const denied = await requireOperator(c);
  if (denied) return denied;

  let body: { farm_slug?: string; prompt?: string; confirm?: boolean; reason?: string } =
    {};
  try {
    body = await c.req.json();
  } catch {
    /* empty ok */
  }

  if (body.confirm !== true) {
    return c.json(
      {
        proposal: true,
        hint: "confirm: true + reason required to spend xAI Imagine and overwrite the share image.",
      },
      200
    );
  }
  const reason = (body.reason || "").trim();
  if (reason.length < 3) {
    return c.json({ error: "reason_required" }, 400);
  }

  if (!c.env.XAI_API_KEY) {
    return c.json({ error: "xai_not_configured" }, 503);
  }

  const slug = body.farm_slug || farmSlugFromQuery(c);
  const farm = await getFarmBySlug(c.env.DB, slug);
  if (!farm) return c.json({ error: "farm_not_found", slug }, 404);

  const prompt = (body.prompt || DEFAULT_OG_PROMPT).trim();

  try {
    const imagined = await imagineOgJpeg({
      apiKey: c.env.XAI_API_KEY,
      prompt,
    });
    await c.env.MEDIA.put(ogSourceR2Key(farm.slug), imagined.bytes, {
      httpMetadata: { contentType: imagined.contentType },
    });
    const stored = await putOgImage(
      c.env.MEDIA,
      farm.slug,
      imagined.bytes,
      imagined.contentType
    );

    await writeAudit(c.env.DB, {
      farm_id: farm.id,
      actor: "user:operator",
      action: "og.generate",
      entity: `og:${farm.slug}`,
      after: {
        key: stored.key,
        bytes: stored.bytes,
        content_type: imagined.contentType,
        whatsapp_ok: stored.whatsapp_ok,
        reason,
      },
    });

    return c.json({
      ok: true,
      farm_id: farm.id,
      slug: farm.slug,
      url: "/og.jpg",
      ...stored,
      content_type: imagined.contentType,
      whatsapp_max_bytes: OG_WHATSAPP_MAX_BYTES,
      hint: stored.whatsapp_ok
        ? "Ready for WhatsApp / Open Graph."
        : "File is larger than WhatsApp likes. Run `npm run og:imagine` locally to JPEG-compress under 200 KB.",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "imagine_failed";
    return c.json({ error: msg }, 502);
  }
});

ogApi.post("/v1/hero/generate", async (c) => {
  const denied = await requireOperator(c);
  if (denied) return denied;

  let body: { farm_slug?: string; prompt?: string; confirm?: boolean; reason?: string } =
    {};
  try {
    body = await c.req.json();
  } catch {
    /* empty ok */
  }

  if (body.confirm !== true) {
    return c.json(
      {
        proposal: true,
        hint: "confirm: true + reason required to spend xAI Imagine and overwrite the overview still.",
      },
      200
    );
  }
  const reason = (body.reason || "").trim();
  if (reason.length < 3) {
    return c.json({ error: "reason_required" }, 400);
  }

  if (!c.env.XAI_API_KEY) {
    return c.json({ error: "xai_not_configured" }, 503);
  }

  const slug = body.farm_slug || farmSlugFromQuery(c);
  const farm = await getFarmBySlug(c.env.DB, slug);
  if (!farm) return c.json({ error: "farm_not_found", slug }, 404);

  const prompt = (body.prompt || DEFAULT_HERO_PROMPT).trim();

  try {
    const imagined = await imagineOgJpeg({
      apiKey: c.env.XAI_API_KEY,
      prompt,
    });
    await c.env.MEDIA.put(heroSourceR2Key(farm.slug), imagined.bytes, {
      httpMetadata: { contentType: imagined.contentType },
    });
    await c.env.MEDIA.put(heroR2Key(farm.slug), imagined.bytes, {
      httpMetadata: { contentType: imagined.contentType || "image/jpeg" },
    });

    await writeAudit(c.env.DB, {
      farm_id: farm.id,
      actor: "user:operator",
      action: "hero.generate",
      entity: `hero:${farm.slug}`,
      after: {
        key: heroR2Key(farm.slug),
        bytes: imagined.bytes.byteLength,
        content_type: imagined.contentType,
        reason,
      },
    });

    return c.json({
      ok: true,
      farm_id: farm.id,
      slug: farm.slug,
      url: "/hero.jpg",
      bytes: imagined.bytes.byteLength,
      content_type: imagined.contentType,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "imagine_failed";
    return c.json({ error: msg }, 502);
  }
});
