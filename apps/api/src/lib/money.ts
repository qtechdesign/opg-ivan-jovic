/** Format integer cents EUR for HR UI. */
export function formatEur(cents: number): string {
  const neg = cents < 0;
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  const s = `${whole},${String(frac).padStart(2, "0")} €`;
  return neg ? `−${s}` : s;
}

/** Convert euros (float) to integer cents. */
export function eurosToCents(eur: number): number {
  return Math.round(eur * 100);
}
