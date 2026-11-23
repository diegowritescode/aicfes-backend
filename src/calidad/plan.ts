/**
 * What plan an account is actually on, as opposed to what its row says.
 *
 * A row reading `pago` with a date in the past is a lapsed
 * subscription, not a paying learner. Deciding that here, as a pure
 * function, rather than inside the query means it can be tested
 * without a database — and the rule is worth testing, because getting
 * it wrong in the generous direction means giving away model calls and
 * in the strict direction means cutting off someone who paid.
 */

export type Plan = 'gratis' | 'pago' | 'semilla';

export interface FilaDePlan {
  readonly plan: Plan;
  readonly planHasta: Date | null;
}

/**
 * The plan in force right now.
 *
 * A paid plan with no end date does not expire — that is how a lifetime
 * or an admin-granted plan is written. A paid plan whose date has
 * passed falls back to `gratis`, so the learner keeps using the app
 * with the free allowance rather than being locked out: not paying is
 * not the same as not being welcome.
 *
 * `semilla` ignores dates entirely. It is granted on the server to
 * stock the bank, and an expiry would mean the bank stops filling
 * halfway through for a reason nobody would connect to this.
 */
export function planVigente(fila: FilaDePlan, ahora = new Date()): Plan {
  if (fila.plan === 'semilla') return 'semilla';
  if (fila.plan !== 'pago') return 'gratis';
  if (!fila.planHasta) return 'pago';
  return fila.planHasta.getTime() > ahora.getTime() ? 'pago' : 'gratis';
}

/** Whether a paid plan has run out, for the message that says so. */
export function planVencido(fila: FilaDePlan, ahora = new Date()): boolean {
  return (
    fila.plan === 'pago' &&
    fila.planHasta !== null &&
    fila.planHasta.getTime() <= ahora.getTime()
  );
}
