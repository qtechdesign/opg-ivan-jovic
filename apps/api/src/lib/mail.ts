import PostalMime from "postal-mime";
import {
  AGENT_MAILBOX_ADDRESS,
  AGENT_MAILBOX_NAME,
  type Mailbox,
} from "@polje/schema";
import { writeAudit } from "./audit";

const TEXT_MAX = 100_000;
const RAW_MAX = 2 * 1024 * 1024;
const ATTACH_MAX = 8;
const ATTACH_BYTES = 2 * 1024 * 1024;
const DAYS = 14;

export type FarmEmailSender = {
  send(input: {
    to: string;
    from: { email: string; name?: string };
    subject: string;
    text: string;
    html?: string;
    headers?: Record<string, string>;
  }): Promise<{ messageId?: string } | void>;
};

type MailEnv = {
  DB: D1Database;
  MEDIA: R2Bucket;
  EMAIL?: SendEmail;
};

export type MailboxRow = Mailbox;

export type MailMessageRow = {
  id: string;
  farm_id: string;
  mailbox_id: string;
  thread_id: string;
  direction: "inbound" | "outbound";
  status: string;
  from_addr: string;
  to_addr: string;
  subject: string;
  text_body: string | null;
  message_id_hdr: string | null;
  in_reply_to: string | null;
  references_hdr: string | null;
  cf_message_id: string | null;
  raw_r2_key: string | null;
  attachment_count: number;
  error: string | null;
  ts: string;
};

export function canonicalAddress(addr: string): string {
  const trimmed = addr.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at < 1) return trimmed;
  const local = trimmed.slice(0, at).split("+")[0] ?? trimmed;
  const domain = trimmed.slice(at + 1);
  return `${local}@${domain}`;
}

function clip(s: string | undefined | null, max = TEXT_MAX): string | null {
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

function headerMessageId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim();
  return v.length > 0 ? v : null;
}

export async function getMailboxByAddress(
  db: D1Database,
  address: string
): Promise<MailboxRow | null> {
  return db
    .prepare(
      `SELECT id, farm_id, address, display_name, kind, created_at
       FROM mailboxes WHERE address = ?`
    )
    .bind(canonicalAddress(address))
    .first<MailboxRow>();
}

async function findThreadId(
  db: D1Database,
  farmId: string,
  inReplyTo: string | null,
  referencesHdr: string | null
): Promise<string | null> {
  const ids: string[] = [];
  if (inReplyTo) ids.push(inReplyTo);
  if (referencesHdr) {
    for (const part of referencesHdr.split(/\s+/)) {
      if (part) ids.push(part);
    }
  }
  for (const hid of ids.slice(0, 20)) {
    const row = await db
      .prepare(
        `SELECT thread_id FROM mail_messages
         WHERE farm_id = ? AND message_id_hdr = ? LIMIT 1`
      )
      .bind(farmId, hid)
      .first<{ thread_id: string }>();
    if (row) return row.thread_id;
  }
  return null;
}

export async function ingestInboundEmail(
  env: MailEnv,
  input: {
    envelopeFrom: string;
    envelopeTo: string;
    raw: ArrayBuffer;
  }
): Promise<{ id: string; thread_id: string; duplicate: boolean } | { rejected: string }> {
  const mailbox = await getMailboxByAddress(env.DB, input.envelopeTo);
  if (!mailbox) {
    return { rejected: "unknown_mailbox" };
  }

  const farm = await env.DB.prepare(`SELECT slug FROM farms WHERE id = ?`)
    .bind(mailbox.farm_id)
    .first<{ slug: string }>();
  const mediaPrefix = farm?.slug ?? mailbox.farm_id;

  const parsed = await PostalMime.parse(input.raw);
  const messageIdHdr = headerMessageId(parsed.messageId ?? null);
  const inReplyTo = headerMessageId(parsed.inReplyTo ?? null);
  const referencesHdr = clip(
    Array.isArray(parsed.references)
      ? parsed.references.join(" ")
      : parsed.references ?? null,
    4000
  );
  const subject = clip(parsed.subject, 200) || "(no subject)";
  const textBody = clip(parsed.text || stripTags(parsed.html || ""), TEXT_MAX);
  const ts = parsed.date
    ? new Date(parsed.date).toISOString()
    : new Date().toISOString();
  const fromAddr = canonicalAddress(
    parsed.from?.address || input.envelopeFrom
  );
  const toAddr = canonicalAddress(input.envelopeTo);

  if (messageIdHdr) {
    const existing = await env.DB.prepare(
      `SELECT id, thread_id FROM mail_messages
       WHERE farm_id = ? AND message_id_hdr = ?`
    )
      .bind(mailbox.farm_id, messageIdHdr)
      .first<{ id: string; thread_id: string }>();
    if (existing) {
      return { id: existing.id, thread_id: existing.thread_id, duplicate: true };
    }
  }

  let threadId = await findThreadId(
    env.DB,
    mailbox.farm_id,
    inReplyTo,
    referencesHdr
  );
  if (!threadId) {
    threadId = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO mail_threads (id, farm_id, mailbox_id, subject, counterpart, last_ts, message_count)
       VALUES (?, ?, ?, ?, ?, ?, 0)`
    )
      .bind(threadId, mailbox.farm_id, mailbox.id, subject, fromAddr, ts)
      .run();
  }

  const id = crypto.randomUUID();
  let rawKey: string | null = null;
  if (input.raw.byteLength > 0 && input.raw.byteLength <= RAW_MAX) {
    rawKey = `${mediaPrefix}/mail/${id}/raw.eml`;
    await env.MEDIA.put(rawKey, input.raw, {
      httpMetadata: { contentType: "message/rfc822" },
      customMetadata: { farm_id: mailbox.farm_id, message_id: id },
    });
  }

  const attachments = (parsed.attachments ?? []).slice(0, ATTACH_MAX);
  const storedAttach: Array<{
    id: string;
    filename: string;
    content_type: string | null;
    size_bytes: number;
    r2_key: string;
  }> = [];

  for (const att of attachments) {
    const content = att.content;
    if (!content) continue;
    let body: Uint8Array;
    if (typeof content === "string") {
      body = new TextEncoder().encode(content);
    } else if (content instanceof Uint8Array) {
      body = content;
    } else if (content instanceof ArrayBuffer) {
      body = new Uint8Array(content);
    } else {
      continue;
    }
    if (body.byteLength > ATTACH_BYTES) continue;
    const attId = crypto.randomUUID();
    const filename = (att.filename || "attachment").replace(/[/\\]/g, "_").slice(0, 180);
    const r2_key = `${mediaPrefix}/mail/${id}/${attId}-${filename}`;
    await env.MEDIA.put(r2_key, body, {
      httpMetadata: { contentType: att.mimeType || "application/octet-stream" },
    });
    storedAttach.push({
      id: attId,
      filename,
      content_type: att.mimeType || null,
      size_bytes: body.byteLength,
      r2_key,
    });
  }

  await env.DB.prepare(
    `INSERT INTO mail_messages (
       id, farm_id, mailbox_id, thread_id, direction, status,
       from_addr, to_addr, subject, text_body, message_id_hdr, in_reply_to,
       references_hdr, cf_message_id, raw_r2_key, attachment_count, error, ts
     ) VALUES (?, ?, ?, ?, 'inbound', 'received', ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL, ?)`
  )
    .bind(
      id,
      mailbox.farm_id,
      mailbox.id,
      threadId,
      fromAddr,
      toAddr,
      subject,
      textBody,
      messageIdHdr,
      inReplyTo,
      referencesHdr,
      rawKey,
      storedAttach.length,
      ts
    )
    .run();

  for (const att of storedAttach) {
    await env.DB.prepare(
      `INSERT INTO mail_attachments (id, message_id, farm_id, filename, content_type, size_bytes, r2_key)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        att.id,
        id,
        mailbox.farm_id,
        att.filename,
        att.content_type,
        att.size_bytes,
        att.r2_key
      )
      .run();
  }

  await env.DB.prepare(
    `UPDATE mail_threads
     SET last_ts = ?, message_count = message_count + 1, counterpart = ?
     WHERE id = ?`
  )
    .bind(ts, fromAddr, threadId)
    .run();

  await writeAudit(env.DB, {
    farm_id: mailbox.farm_id,
    actor: "mail:inbound",
    action: "mail.receive",
    entity: `mail:${id}`,
    after: {
      id,
      thread_id: threadId,
      from: fromAddr,
      to: toAddr,
      subject,
      attachments: storedAttach.length,
    },
  });

  return { id, thread_id: threadId, duplicate: false };
}

export async function sendFarmMail(
  env: MailEnv,
  input: {
    farm_id: string;
    to: string;
    subject: string;
    text: string;
    html?: string;
    thread_id?: string;
    actor: string;
    reason: string;
  }
): Promise<{ id: string; status: string; cf_message_id: string | null; error?: string }> {
  const mailbox = await getMailboxByAddress(env.DB, AGENT_MAILBOX_ADDRESS);
  if (!mailbox || mailbox.farm_id !== input.farm_id) {
    throw new Error("mailbox_not_found");
  }
  if (!env.EMAIL) {
    throw new Error("email_not_configured");
  }

  const toAddr = canonicalAddress(input.to);
  const ts = new Date().toISOString();
  const text = clip(input.text, TEXT_MAX) || "";
  const subject = clip(input.subject, 200) || "(no subject)";

  let threadId = input.thread_id ?? null;
  let inReplyTo: string | null = null;
  let referencesHdr: string | null = null;
  if (threadId) {
    const thread = await env.DB.prepare(
      `SELECT id FROM mail_threads WHERE id = ? AND farm_id = ?`
    )
      .bind(threadId, mailbox.farm_id)
      .first();
    if (!thread) throw new Error("thread_not_found");
    const last = await env.DB.prepare(
      `SELECT message_id_hdr, references_hdr FROM mail_messages
       WHERE thread_id = ? AND message_id_hdr IS NOT NULL
       ORDER BY ts DESC LIMIT 1`
    )
      .bind(threadId)
      .first<{ message_id_hdr: string; references_hdr: string | null }>();
    if (last?.message_id_hdr) {
      inReplyTo = last.message_id_hdr;
      referencesHdr = last.references_hdr
        ? `${last.references_hdr} ${last.message_id_hdr}`
        : last.message_id_hdr;
    }
  } else {
    threadId = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO mail_threads (id, farm_id, mailbox_id, subject, counterpart, last_ts, message_count)
       VALUES (?, ?, ?, ?, ?, ?, 0)`
    )
      .bind(threadId, mailbox.farm_id, mailbox.id, subject, toAddr, ts)
      .run();
  }

  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO mail_messages (
       id, farm_id, mailbox_id, thread_id, direction, status,
       from_addr, to_addr, subject, text_body, message_id_hdr, in_reply_to,
       references_hdr, cf_message_id, raw_r2_key, attachment_count, error, ts
     ) VALUES (?, ?, ?, ?, 'outbound', 'queued', ?, ?, ?, ?, NULL, ?, ?, NULL, NULL, 0, NULL, ?)`
  )
    .bind(
      id,
      mailbox.farm_id,
      mailbox.id,
      threadId,
      AGENT_MAILBOX_ADDRESS,
      toAddr,
      subject,
      text,
      inReplyTo,
      referencesHdr,
      ts
    )
    .run();

  const headers: Record<string, string> = {};
  if (inReplyTo) {
    headers["In-Reply-To"] = inReplyTo;
    headers["References"] = referencesHdr || inReplyTo;
  }

  const sender = env.EMAIL as unknown as FarmEmailSender;
  let cfId: string | null = null;
  let status: "sent" | "failed" = "sent";
  let error: string | null = null;
  try {
    const result = await sender.send({
      to: toAddr,
      from: { email: AGENT_MAILBOX_ADDRESS, name: AGENT_MAILBOX_NAME },
      subject,
      text,
      html: input.html,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
    });
    cfId = result && "messageId" in result ? result.messageId ?? null : null;
  } catch (err) {
    status = "failed";
    const e = err as { code?: string; message?: string };
    error = [e.code, e.message].filter(Boolean).join(" ") || "send_failed";
  }

  await env.DB.prepare(
    `UPDATE mail_messages SET status = ?, cf_message_id = ?, error = ? WHERE id = ?`
  )
    .bind(status, cfId, error, id)
    .run();

  await env.DB.prepare(
    `UPDATE mail_threads
     SET last_ts = ?, message_count = message_count + 1, counterpart = ?
     WHERE id = ?`
  )
    .bind(ts, toAddr, threadId)
    .run();

  await writeAudit(env.DB, {
    farm_id: mailbox.farm_id,
    actor: input.actor,
    action: status === "sent" ? "mail.send" : "mail.send_failed",
    entity: `mail:${id}`,
    after: {
      id,
      to: toAddr,
      subject,
      reason: input.reason,
      status,
      cf_message_id: cfId,
      error,
    },
  });

  return { id, status, cf_message_id: cfId, error: error ?? undefined };
}

export async function mailSummary(db: D1Database, farmId: string) {
  const totals = await db
    .prepare(
      `SELECT
         SUM(CASE WHEN direction = 'inbound' THEN 1 ELSE 0 END) AS inbound,
         SUM(CASE WHEN direction = 'outbound' THEN 1 ELSE 0 END) AS outbound,
         SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
         COUNT(*) AS messages
       FROM mail_messages WHERE farm_id = ?`
    )
    .bind(farmId)
    .first<{
      inbound: number | null;
      outbound: number | null;
      failed: number | null;
      messages: number | null;
    }>();

  const threads = await db
    .prepare(`SELECT COUNT(*) AS n FROM mail_threads WHERE farm_id = ?`)
    .bind(farmId)
    .first<{ n: number }>();

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - (DAYS - 1));
  since.setUTCHours(0, 0, 0, 0);
  const sinceIso = since.toISOString();

  const { results: rows } = await db
    .prepare(
      `SELECT substr(ts, 1, 10) AS day, direction, COUNT(*) AS n
       FROM mail_messages
       WHERE farm_id = ? AND ts >= ?
       GROUP BY day, direction`
    )
    .bind(farmId, sinceIso)
    .all<{ day: string; direction: string; n: number }>();

  const byDay = new Map<string, { inbound: number; outbound: number }>();
  for (let i = 0; i < DAYS; i++) {
    const d = new Date(since);
    d.setUTCDate(since.getUTCDate() + i);
    const key = d.toISOString().slice(0, 10);
    byDay.set(key, { inbound: 0, outbound: 0 });
  }
  for (const r of rows ?? []) {
    const slot = byDay.get(r.day);
    if (!slot) continue;
    if (r.direction === "inbound") slot.inbound = r.n;
    if (r.direction === "outbound") slot.outbound = r.n;
  }

  return {
    mailbox: AGENT_MAILBOX_ADDRESS,
    name: AGENT_MAILBOX_NAME,
    totals: {
      inbound: totals?.inbound ?? 0,
      outbound: totals?.outbound ?? 0,
      failed: totals?.failed ?? 0,
      messages: totals?.messages ?? 0,
      threads: threads?.n ?? 0,
    },
    days: [...byDay.entries()].map(([date, v]) => ({ date, ...v })),
  };
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
