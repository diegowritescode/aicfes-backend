/**
 * A streak that survives one missed day a month.
 *
 * A streak that snaps after one bad day punishes the learner for the
 * thing the product exists to help with — and the research behind ADR
 * 10 says that contingency is the one that measures negative on
 * intrinsic motivation. Duolingo sells a "streak freeze" for exactly
 * this reason; here it is free, because charging for it would turn a
 * study habit into a thing to protect with money.
 *
 * One a month, applied automatically. A forgiveness the learner has
 * to remember to spend is a forgiveness that fails on the day they
 * forgot, which is the day they needed it.
 */

/** YYYY-MM-DD, as the streak already uses. */
type Fecha = string;

function diffDias(a: Fecha, b: Fecha): number {
  const ms = Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

export interface RachaConPerdon {
  readonly dias: number;
  /** Whether the forgiveness is holding the streak up right now. */
  readonly perdonUsado: boolean;
  /** The gap it covered, for a screen that wants to say so. */
  readonly diaPerdonado: Fecha | null;
}

/**
 * The current streak, allowing one gap.
 *
 * `desdeElPerdonAnterior` is how many days since the last one was
 * spent; a forgiveness is only available once every thirty.
 */
export function rachaConPerdon(
  fechasDeEstudio: readonly Fecha[],
  hoy: Fecha,
  diasDesdeElPerdonAnterior = Infinity,
): RachaConPerdon {
  const dias = [...new Set(fechasDeEstudio)].sort();
  if (dias.length === 0) return { dias: 0, perdonUsado: false, diaPerdonado: null };

  const ultimo = dias[dias.length - 1]!;
  const desdeElUltimo = diffDias(hoy, ultimo);

  /* Two days without studying is not a gap to forgive, it is a
     stopped streak. Forgiving it would mean the number keeps rising
     for someone who is not there. */
  if (desdeElUltimo > 2) return { dias: 0, perdonUsado: false, diaPerdonado: null };

  const puedePerdonar = diasDesdeElPerdonAnterior >= 30;

  /* A gap between today and the last study day counts too: missing
     yesterday is the most common way a streak breaks. */
  let perdonado: Fecha | null = null;
  if (desdeElUltimo === 2) {
    if (!puedePerdonar) return { dias: 0, perdonUsado: false, diaPerdonado: null };
    perdonado = restarDias(hoy, 1);
  }

  let cuenta = 1;
  for (let i = dias.length - 2; i >= 0; i -= 1) {
    const hueco = diffDias(dias[i + 1]!, dias[i]!);

    if (hueco === 1) {
      cuenta += 1;
      continue;
    }

    /* Exactly one day missing, and a forgiveness still unspent:
       bridge it and keep counting. Two or more is a real break. */
    if (hueco === 2 && perdonado === null && puedePerdonar) {
      perdonado = restarDias(dias[i + 1]!, 1);
      cuenta += 1;
      continue;
    }

    break;
  }

  return { dias: cuenta, perdonUsado: perdonado !== null, diaPerdonado: perdonado };
}

function restarDias(fecha: Fecha, n: number): Fecha {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/**
 * When the last forgiveness was spent, deduced from the history.
 *
 * No new table: a forgiveness is not a thing the learner owns, it is
 * a reading of their dates. The most recent single-day gap inside a
 * run of study days is where one was used — anything longer was a
 * break, and anything shorter was not a gap.
 *
 * Deducing beats storing here because the two cannot disagree. A
 * column could drift from the dates it describes; this cannot.
 */
export function ultimoPerdon(
  fechasDeEstudio: readonly Fecha[],
  hoy: Fecha,
): Fecha | null {
  const dias = [...new Set(fechasDeEstudio)].sort();

  /* Newest first: the most recent gap is the one that matters, since
     a forgiveness older than thirty days no longer blocks another. */
  for (let i = dias.length - 1; i > 0; i -= 1) {
    if (diffDias(dias[i]!, dias[i - 1]!) === 2) {
      return restarDias(dias[i]!, 1);
    }
  }

  /* And the gap between the last study day and today, which is the
     one a learner is living through right now. */
  if (dias.length > 0 && diffDias(hoy, dias[dias.length - 1]!) === 2) {
    return restarDias(hoy, 1);
  }

  return null;
}

/** Days since the last forgiveness, or Infinity if there was none. */
export function diasDesdeElPerdon(
  fechasDeEstudio: readonly Fecha[],
  hoy: Fecha,
): number {
  const ultimo = ultimoPerdon(fechasDeEstudio, hoy);
  return ultimo === null ? Infinity : diffDias(hoy, ultimo);
}
