import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export class Outbox {
  /** @param {string} path */
  constructor(path) {
    mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS outbox (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_id TEXT UNIQUE NOT NULL,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        sent_at TEXT
      );
    `);
  }

  /**
   * @param {string} batchId
   * @param {unknown} payload
   */
  enqueue(batchId, payload) {
    this.db
      .prepare(
        `INSERT OR IGNORE INTO outbox (batch_id, payload_json, created_at)
         VALUES (?, ?, ?)`
      )
      .run(batchId, JSON.stringify(payload), new Date().toISOString());
  }

  /** @param {number} [limit] */
  pending(limit = 10) {
    return this.db
      .prepare(
        `SELECT id, batch_id, payload_json, attempts FROM outbox
         WHERE sent_at IS NULL
         ORDER BY id ASC LIMIT ?`
      )
      .all(limit);
  }

  pendingCount() {
    const row = this.db
      .prepare(`SELECT COUNT(*) AS n FROM outbox WHERE sent_at IS NULL`)
      .get();
    return row.n;
  }

  /** @param {number} id */
  markSent(id) {
    this.db
      .prepare(`UPDATE outbox SET sent_at = ? WHERE id = ?`)
      .run(new Date().toISOString(), id);
  }

  /** @param {number} id */
  markAttempt(id) {
    this.db
      .prepare(`UPDATE outbox SET attempts = attempts + 1 WHERE id = ?`)
      .run(id);
  }
}
