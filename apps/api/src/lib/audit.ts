export type AuditInput = {
  farm_id: string;
  actor: string;
  action: string;
  entity?: string | null;
  before?: unknown;
  after?: unknown;
};

export async function writeAudit(
  db: D1Database,
  input: AuditInput
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO audit (farm_id, actor, action, entity, before_json, after_json, ts)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      input.farm_id,
      input.actor,
      input.action,
      input.entity ?? null,
      input.before == null ? null : JSON.stringify(input.before),
      input.after == null ? null : JSON.stringify(input.after),
      new Date().toISOString()
    )
    .run();
}
