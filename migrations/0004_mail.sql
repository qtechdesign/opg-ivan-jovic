-- Agentic mailbox ledger (Cloudflare Email Service).
-- Platform identity: farm@opg-ivanjovic.hr — not a personal inbox.
-- Money stays integer cents elsewhere. Timestamps UTC ISO-8601. farm_id always.

CREATE TABLE mailboxes (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL REFERENCES farms(id),
  address TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'agent',
  created_at TEXT NOT NULL
);

CREATE TABLE mail_threads (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL REFERENCES farms(id),
  mailbox_id TEXT NOT NULL REFERENCES mailboxes(id),
  subject TEXT NOT NULL,
  counterpart TEXT NOT NULL,
  last_ts TEXT NOT NULL,
  message_count INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX mail_threads_farm_last ON mail_threads(farm_id, last_ts);

CREATE TABLE mail_messages (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL REFERENCES farms(id),
  mailbox_id TEXT NOT NULL REFERENCES mailboxes(id),
  thread_id TEXT NOT NULL REFERENCES mail_threads(id),
  direction TEXT NOT NULL,
  status TEXT NOT NULL,
  from_addr TEXT NOT NULL,
  to_addr TEXT NOT NULL,
  subject TEXT NOT NULL,
  text_body TEXT,
  message_id_hdr TEXT,
  in_reply_to TEXT,
  references_hdr TEXT,
  cf_message_id TEXT,
  raw_r2_key TEXT,
  attachment_count INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  ts TEXT NOT NULL
);
CREATE INDEX mail_messages_farm_ts ON mail_messages(farm_id, ts);
CREATE INDEX mail_messages_thread ON mail_messages(thread_id, ts);
CREATE UNIQUE INDEX mail_messages_msgid ON mail_messages(farm_id, message_id_hdr)
  WHERE message_id_hdr IS NOT NULL;

CREATE TABLE mail_attachments (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL REFERENCES mail_messages(id),
  farm_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  content_type TEXT,
  size_bytes INTEGER,
  r2_key TEXT NOT NULL
);
CREATE INDEX mail_attachments_message ON mail_attachments(message_id);
