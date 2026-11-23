/**
 * Where a learner's XP came from.
 *
 * The ledger has recorded a reason for every award since it was built
 * and nothing ever showed it: the app displays a total. That makes the
 * number arbitrary from the outside, and an arbitrary number is a
 * reward rather than feedback — which is the distinction that decides
 * whether it helps (informative feedback, d = +0.33) or hurts
 * (completion-contingent reward, d = −0.36).
 *
 * Pure so the grouping and the wording can be tested without a
 * database.
 */

/** The reasons the ledger writes, from `dashboard.service.ts`. */
export type RazonXp =
  | 'session_correct'
  | 'session_time'
  | 'time_trial_bonus'
  | 'answer_correct_adjustment'
  | 'mission_completed';

export interface EventoXp {
  readonly reason: string;
  readonly amount: number;
  readonly createdAt: Date;
}

export interface FilaDesglose {
  readonly razon: string;
  /** Written for a learner, not a log. */
  readonly etiqueta: string;
  readonly xp: number;
  readonly veces: number;
}

/* What each reason means, in words a 16-year-old reads without
   decoding. The keys are the stored values; an unknown reason falls
   back to something honest rather than to the raw string, because a
   learner should never be shown `answer_correct_adjustment`. */
const ETIQUETAS: Record<string, string> = {
  session_correct: 'Respuestas correctas',
  answer_correct_adjustment: 'Respuestas correctas',
  session_time: 'Tiempo estudiando',
  time_trial_bonus: 'Rapidez en contrarreloj',
  mission_completed: 'Retos completados',
};

/**
 * XP grouped by what earned it, largest first.
 *
 * Grouped rather than listed: a learner wants to know that most of
 * their XP came from getting things right, not to scroll two hundred
 * rows. `session_correct` and `answer_correct_adjustment` collapse
 * together because they are the same thing to a learner — one is the
 * session's estimate and the other its correction.
 */
export function desglosar(eventos: readonly EventoXp[]): FilaDesglose[] {
  const porEtiqueta = new Map<string, { xp: number; veces: number; razon: string }>();

  for (const e of eventos) {
    const etiqueta = ETIQUETAS[e.reason] ?? 'Otros';
    const fila = porEtiqueta.get(etiqueta) ?? { xp: 0, veces: 0, razon: e.reason };
    fila.xp += e.amount;
    fila.veces += 1;
    porEtiqueta.set(etiqueta, fila);
  }

  return [...porEtiqueta]
    .map(([etiqueta, f]) => ({ razon: f.razon, etiqueta, xp: f.xp, veces: f.veces }))
    /* Negative adjustments can exist — a correction that removes XP —
       so the sort is by amount and not by count. */
    .sort((a, b) => b.xp - a.xp);
}

/**
 * The one sentence worth putting under the level.
 *
 * Names the biggest source, because that is the actionable part: a
 * learner whose XP is mostly time knows that answering would move it
 * faster.
 */
export function resumirDesglose(filas: readonly FilaDesglose[]): string | null {
  const conXp = filas.filter((f) => f.xp > 0);
  if (conXp.length === 0) return null;

  const total = conXp.reduce((s, f) => s + f.xp, 0);
  const mayor = conXp[0]!;
  const porcentaje = Math.round((mayor.xp / total) * 100);

  /* Below a third, no source dominates and saying one does would
     misinform. */
  if (porcentaje < 34) return null;

  return `${porcentaje}% de tu XP viene de: ${mayor.etiqueta.toLowerCase()}.`;
}
