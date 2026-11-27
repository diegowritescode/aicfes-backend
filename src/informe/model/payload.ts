import type { TemaDebil } from '../../calidad/debilidades.service';

/**
 * What the model is given, and nothing else.
 *
 * Every number here is already computed by code that is tested. The
 * model's job is to write them up, not to work them out: a report
 * where it inferred "you are weak at angles" from raw answers is a
 * report that lies the first time it infers wrong, and the learner
 * notices in the opening sentence.
 *
 * So this type is the contract that keeps it honest. If a figure is
 * not in here, the model has no way to know it, and the schema it
 * answers with has no numeric field for it to invent one.
 */

export interface AreaDelInforme {
  readonly area: string;
  readonly aciertoPorcentaje: number;
  /** Change against the week before, in points. Negative is worse. */
  readonly delta: number;
}

export interface PayloadDelInforme {
  /** «del 23 al 29 de noviembre». The model quotes it, never computes it. */
  readonly semana: string;
  readonly sesionesEstaSemana: number;
  readonly minutosEstaSemana: number;
  readonly porArea: readonly AreaDelInforme[];
  /** Seconds per question this week, against the 64 the real exam gives. */
  readonly segundosPorPregunta: number;
  readonly segundosDelExamenReal: number;
  /**
   * The weak topics, worst first.
   *
   * Accumulated history with a recency decay, NOT a seven-day window:
   * `temasDebiles` weighs `ultimoFallo` into its priority but never
   * filters by date. The prompt has to say so, or the report claims a
   * week's worth of evidence for something that took two months to
   * show up.
   */
  readonly temasDebiles: readonly TemaDebilPlano[];
  /** True when the learner did nothing this week. Changes the tone. */
  readonly semanaVacia: boolean;
}

export interface TemaDebilPlano {
  readonly area: string;
  readonly tema: string;
  readonly aciertoPorcentaje: number;
  readonly respondidas: number;
  /** «error_calculo», «confunde_conceptos». Null when no pattern stands out. */
  readonly errorTipico: string | null;
}

/**
 * The floor under which there is no honest report to write.
 *
 * `temasDebiles` already refuses to name a topic with fewer than four
 * answers, so with no topics at all there is nothing to say that is
 * not a guess. A report built on one afternoon of practice would read
 * like a verdict, and the learner would believe it.
 *
 * Two topics rather than one: a single weak topic is a sentence, not
 * a report, and the plan would have one action in it.
 */
export const TEMAS_MINIMOS = 2;

export function hayMateriaParaInforme(temas: readonly TemaDebil[]): boolean {
  return temas.length >= TEMAS_MINIMOS;
}

/** Drops `prioridad` and `ultimoFallo`: ranking is the server's business. */
export function aplanarTemas(temas: readonly TemaDebil[]): TemaDebilPlano[] {
  return temas.map((t) => ({
    area: t.area,
    tema: t.tema,
    aciertoPorcentaje: t.aciertoPorcentaje,
    respondidas: t.respondidas,
    errorTipico: t.errorTipico,
  }));
}
