/**
 * How many weeks in a row two learners have duelled each other.
 *
 * Computed from `Duelo.terminadoEn` rather than stored. A counter
 * column would need a write on every finished duel and a repair job
 * for the weeks nobody played — and it would be wrong in a way nobody
 * notices, because a streak nobody can recompute cannot be checked.
 * The duels are already there; the streak is a view of them.
 *
 * A week, not a day. Two teenagers with classes do not duel daily,
 * and a streak that breaks every Tuesday stops being looked at by the
 * second time it happens. The point is to give a friendship a history,
 * not to run a treadmill.
 *
 * Only finished duels count. An invitation nobody accepted is not
 * time spent together, and letting it count would make the streak
 * something you keep alive by spamming challenges.
 */

/** Weeks are Monday-to-Monday, like the weekly report's. */
const MS_POR_SEMANA = 7 * 24 * 60 * 60 * 1000;

/**
 * The Monday that starts the week a moment falls in, as UTC midnight.
 *
 * UTC rather than a learner's timezone, unlike the weekly report:
 * this is shared between two people who may be in different ones, and
 * a streak that is 4 for one of them and 3 for the other is worse
 * than a streak that moves by a few hours at the boundary.
 */
export function lunesDe(momento: Date): number {
  const d = new Date(
    Date.UTC(momento.getUTCFullYear(), momento.getUTCMonth(), momento.getUTCDate()),
  );
  const dia = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - (dia === 0 ? 6 : dia - 1));
  return d.getTime();
}

export interface RachaJuntos {
  /** Consecutive weeks with at least one finished duel, up to now. */
  readonly semanas: number;
  /** Total finished duels between the two, ever. */
  readonly duelos: number;
  /** True when this week already has one, so the UI can say so. */
  readonly estaSemanaYa: boolean;
}

/**
 * The streak, from the dates of the duels the two have finished.
 *
 * Counts back from the current week while each previous week has at
 * least one duel. The current week being empty does NOT break it:
 * it is Monday morning for somebody, and a streak that resets at
 * midnight on Sunday would be lost by most pairs before they could
 * act on it. It breaks when the week before last is also empty.
 */
export function rachaJuntos(
  terminados: readonly Date[],
  ahora: Date = new Date(),
): RachaJuntos {
  const semanas = new Set(terminados.map((d) => lunesDe(d)));
  const estaSemana = lunesDe(ahora);

  let cursor = semanas.has(estaSemana) ? estaSemana : estaSemana - MS_POR_SEMANA;
  let cuenta = 0;

  while (semanas.has(cursor)) {
    cuenta += 1;
    cursor -= MS_POR_SEMANA;
  }

  return {
    semanas: cuenta,
    duelos: terminados.length,
    estaSemanaYa: semanas.has(estaSemana),
  };
}
