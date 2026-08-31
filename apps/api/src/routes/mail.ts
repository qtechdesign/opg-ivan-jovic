import { Hono } from "hono";
import { SendMailSchema } from "@polje/schema";
import { requireOperator } from "../lib/auth";
import { farmSlugFromQuery, getFarmBySlug } from "../lib/farm";
import {
  getMailboxByAddress,
  mailSummary,
  sendFarmMail,
} from "../lib/mail";
import { AGENT_MAILBOX_ADDRESS } from "@polje/schema";

type AppEnv = { Bindings: Cloudflare.Env };

export const mailApi = new Hono<AppEnv>();

mailApi.get("/v1/mail/summary", async (c) => {
  const denied = await requireOperator(c);
  if (denied) return denied;

  const slug = farmSlugFromQuery(c);
  const farm = await getFarmBySlug(c.env.DB, slug);
  if (!farm) return c.json({ error: "farm_not_found", slug }, 404);

  const summary = await mailSummary(c.env.DB, farm.id);
  return c.json({ farm_id: farm.id, slug: farm.slug, ...summary });
});

mailApi.get("/v1/mail", async (c) => {
  const denied = await requireOperator(c);
  if (denied) return denied;

  const slug = farmSlugFromQuery(c);
  const farm = await getFarmBySlug(c.env.DB, slug);
  if (!farm) return c.json({ error: "farm_not_found", slug }, 404);

  const limit = Math.min(100, Math.max(1, Number(c.req.query("limit") || "40") || 40));
  const { results } = await c.env.DB.prepare(
    `SELECT id, farm_id, mailbox_id, thread_id, direction, status,
            from_addr, to_addr, subject,
            substr(COALESCE(text_body, ''), 1, 160) AS snippet,
            attachment_count, ts
     FROM mail_messages WHERE farm_id = ?
     ORDER BY ts DESC LIMIT ?`
  )
    .bind(farm.id, limit)
    .all();

  const mailbox = await getMailboxByAddress(c.env.DB, AGENT_MAILBOX_ADDRESS);
  return c.json({
    farm_id: farm.id,
    mailbox: mailbox?.address ?? AGENT_MAILBOX_ADDRESS,
    messages: results ?? [],
  });
});

mailApi.get("/v1/mail/:id", async (c) => {
  const denied = await requireOperator(c);
  if (denied) return denied;

  const id = c.req.param("id");
  const row = await c.env.DB.prepare(
    `SELECT id, farm_id, mailbox_id, thread_id, direction, status,
            from_addr, to_addr, subject, text_body, message_id_hdr,
            in_reply_to, cf_message_id, attachment_count, error, ts
     FROM mail_messages WHERE id = ?`
  )
    .bind(id)
    .first();

  if (!row) return c.json({ error: "mail_not_found" }, 404);

  const { results: attachments } = await c.env.DB.prepare(
    `SELECT id, filename, content_type, size_bytes FROM mail_attachments WHERE message_id = ?`
  )
    .bind(id)
    .all();

  return c.json({
    ...row,
    attachments: (attachments ?? []).map((a) => ({
      ...a,
      url: `/v1/mail/attachments/${(a as { id: string }).id}`,
    })),
  });
});

mailApi.get("/v1/mail/attachments/:id", async (c) => {
  const denied = await requireOperator(c);
  if (denied) return denied;

  const id = c.req.param("id");
  const row = await c.env.DB.prepare(
    `SELECT id, filename, content_type, r2_key FROM mail_attachments WHERE id = ?`
  )
    .bind(id)
    .first<{ id: string; filename: string; content_type: string | null; r2_key: string }>();

  if (!row) return c.json({ error: "attachment_not_found" }, 404);

  const obj = await c.env.MEDIA.get(row.r2_key);
  if (!obj) return c.json({ error: "object_missing" }, 404);

  const headers = new Headers();
  headers.set(
    "Content-Type",
    row.content_type || obj.httpMetadata?.contentType || "application/octet-stream"
  );
  headers.set(
    "Content-Disposition",
    `attachment; filename="${row.filename.replace(/"/g, "")}"`
  );
  headers.set("Cache-Control", "private, max-age=3600");
  return new Response(obj.body, { headers });
});

mailApi.post("/v1/mail/send", async (c) => {
  const denied = await requireOperator(c);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }

  const parsed = SendMailSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "validation", details: parsed.error.flatten() }, 400);
  }

  const farm = await getFarmBySlug(c.env.DB, parsed.data.farm_slug);
  if (!farm) {
    return c.json({ error: "farm_not_found", slug: parsed.data.farm_slug }, 404);
  }

  try {
    const result = await sendFarmMail(c.env, {
      farm_id: farm.id,
      to: parsed.data.to,
      subject: parsed.data.subject,
      text: parsed.data.text,
      html: parsed.data.html,
      thread_id: parsed.data.thread_id,
      actor: "user:operator",
      reason: parsed.data.reason,
    });
    return c.json(result, result.status === "sent" ? 201 : 502);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "send_failed";
    if (msg === "email_not_configured") {
      return c.json({ error: msg }, 503);
    }
    const status = msg === "mailbox_not_found" || msg === "thread_not_found" ? 404 : 500;
    return c.json({ error: msg }, status);
  }
});
