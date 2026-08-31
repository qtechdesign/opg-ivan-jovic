export type BuildPhase = {
  id: string;
  farm_id: string;
  title: string;
  body: string | null;
  starts_on: string | null;
  ends_on: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  sort: number;
  created_at: string;
};

export const BUILD_PHASE_STATUSES = ["planned", "active", "done"] as const;

export async function listBuildPhases(
  db: D1Database,
  farmId: string
): Promise<BuildPhase[]> {
  const { results } = await db
    .prepare(
      `SELECT id, farm_id, title, body, starts_on, ends_on, amount_cents, currency, status, sort, created_at
       FROM build_phases WHERE farm_id = ? ORDER BY sort, starts_on, title`
    )
    .bind(farmId)
    .all<BuildPhase>();
  return results ?? [];
}

export function planTotals(phases: BuildPhase[]): {
  amount_cents: number;
  planned: number;
  active: number;
  done: number;
} {
  let amount_cents = 0;
  let planned = 0;
  let active = 0;
  let done = 0;
  for (const p of phases) {
    amount_cents += p.amount_cents || 0;
    if (p.status === "done") done += 1;
    else if (p.status === "active") active += 1;
    else planned += 1;
  }
  return { amount_cents, planned, active, done };
}
