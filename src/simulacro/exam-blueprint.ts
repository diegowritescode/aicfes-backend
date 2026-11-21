/**
 * The shape of a real Saber 11 sitting.
 *
 * The exam runs as two sessions of four and a half hours. The first
 * carries Lectura Crítica, Matemáticas and Sociales; the second carries
 * Ciencias Naturales, Inglés and the repeat of Matemáticas and Lectura
 * Crítica that the official sitting includes.
 *
 * The counts below are the scored questions per area. A practice sitting
 * is only useful if its proportions match, so these drive both how many
 * items a simulation draws and how its score is reported.
 *
 * Source: ICFES Guía de Orientación Saber 11. Figures restated across
 * current guides as 254 scored questions in two 4h30 sessions.
 */

export interface AreaBlueprint {
  readonly area: 'LC' | 'MAT' | 'SOC' | 'CN' | 'ING';
  readonly label: string;
  /** Scored questions in a real sitting. */
  readonly questions: number;
  /** Which of the two sessions it falls in. */
  readonly session: 1 | 2;
}

export const EXAM_BLUEPRINT: readonly AreaBlueprint[] = [
  { area: 'LC', label: 'Lectura Crítica', questions: 41, session: 1 },
  { area: 'MAT', label: 'Matemáticas', questions: 50, session: 1 },
  { area: 'SOC', label: 'Sociales y Ciudadanas', questions: 50, session: 1 },
  { area: 'CN', label: 'Ciencias Naturales', questions: 58, session: 2 },
  { area: 'ING', label: 'Inglés', questions: 55, session: 2 },
];

/** Minutes per session in the real sitting. */
export const SESSION_MINUTES = 270;

export const TOTAL_QUESTIONS = EXAM_BLUEPRINT.reduce((sum, a) => sum + a.questions, 0);

/**
 * A shorter sitting that keeps the real proportions.
 *
 * A full 254-question exam takes nine hours, which nobody sits through
 * for practice. Scaling preserves what matters — the weight of each area
 * — while fitting the time a learner actually has.
 */
export function scaleBlueprint(totalQuestions: number): Array<AreaBlueprint & { scaled: number }> {
  const ratio = totalQuestions / TOTAL_QUESTIONS;

  // Round down first, then hand out what rounding lost to the areas with
  // the largest remainder. Without this the parts do not sum to the whole.
  const withExact = EXAM_BLUEPRINT.map((a) => {
    const exact = a.questions * ratio;
    const floor = Math.max(1, Math.floor(exact));
    return { ...a, floor, remainder: exact - Math.floor(exact) };
  });

  let assigned = withExact.reduce((sum, a) => sum + a.floor, 0);
  const order = [...withExact].sort((x, y) => y.remainder - x.remainder);
  const extra = new Map<string, number>();

  let i = 0;
  while (assigned < totalQuestions && order.length > 0) {
    const pick = order[i % order.length];
    if (pick) {
      extra.set(pick.area, (extra.get(pick.area) ?? 0) + 1);
      assigned += 1;
    }
    i += 1;
  }

  return withExact.map(({ floor, remainder: _r, ...rest }) => ({
    ...rest,
    scaled: floor + (extra.get(rest.area) ?? 0),
  }));
}

/** Minutes for a sitting of this length, at the real exam's pace. */
export function minutesFor(totalQuestions: number): number {
  const perQuestion = (SESSION_MINUTES * 2) / TOTAL_QUESTIONS;
  return Math.round(totalQuestions * perQuestion);
}
