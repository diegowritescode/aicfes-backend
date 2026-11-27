import type { TemaDebil } from '../../calidad/debilidades.service';
import type { ResumenDeLaSemana, TemaDeLaSemana } from '../../calidad/semana-real.service';

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
 *
 * There are two kinds of evidence in here and they answer different
 * questions. Keeping them apart is the whole reason the report can
 * use a past tense at all:
 *
 * - `semana7dias` is what happened in these seven days. It can say
 *   «mejoraste» and «empeoraste», because it is a window.
 * - `temasDebiles` is what the learner carries, accumulated with a
 *   recency decay and no date filter. It can only say «te viene
 *   costando», and it is what the plan draws from, because drilling
 *   should follow the standing weakness and not one bad Tuesday.
 *
 * The prompt is told which is which. Mixing them is how a report
 * claims a week's worth of evidence for something that took two
 * months to show up.
 */

export interface AreaDelInforme {
  readonly area: string;
  readonly aciertoPorcentaje: number;
  /** Change against the week before, in points. Negative is worse. */
  readonly delta: number;
}

/** One topic as it went inside the window. */
export interface TemaDeLaSemanaPlano {
  readonly area: string;
  readonly tema: string;
  readonly aciertoPorcentaje: number;
  readonly respondidas: number;
  /** Median seconds per answer here. Null when nothing was timed. */
  readonly segundosMediana: number | null;
}

/**
 * What this week looked like, from `Answer` rows inside the range.
 *
 * Separate from `temasDebiles` and never merged with it. This is the
 * only part of the payload that licenses a past-tense sentence.
 */
export interface SemanaDelInforme {
  readonly respondidas: number;
  readonly aciertoPorcentaje: number;
  /** Median seconds per answer across topics, from `Answer.tiempoMs`. */
  readonly segundosMediana: number | null;
  /** Topics that went well in these seven days. */
  readonly fuertes: readonly TemaDeLaSemanaPlano[];
  /** Topics that went badly in these seven days. */
  readonly flojos: readonly TemaDeLaSemanaPlano[];
  /**
   * Topics answered much slower than this learner's own median.
   * Being right but slow is a finding the exam punishes, and it is
   * invisible in an accuracy percentage.
   */
  readonly lentos: readonly TemaDeLaSemanaPlano[];
}

/**
 * How last week's plan turned out.
 *
 * Without this the report is written from scratch every Monday and
 * can never say «cumpliste» or «llevas tres semanas con esto». The
 * rows were already being stored and nobody read them back.
 *
 * `aciertoPorcentaje` is measured in the week just ended for a topic
 * the previous plan pointed at. That is the only honest way to score
 * a plan: it asked the learner to practise X, so the question is how
 * X went afterwards.
 */
export interface SeguimientoDelPlan {
  readonly area: string;
  readonly tema: string;
  readonly titulo: string;
  /** Answers on this topic during the week just measured. */
  readonly respondidas: number;
  /** Accuracy on it this week, or null when it was not practised. */
  readonly aciertoPorcentaje: number | null;
  /**
   * True when the learner did nothing on it. The report should say so
   * plainly rather than pretending the action did not exist.
   */
  readonly sinTocar: boolean;
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
   * show up. `semana7dias` is the part that may be spoken of in the
   * past tense.
   */
  readonly temasDebiles: readonly TemaDebilPlano[];
  /**
   * These seven days specifically. Null when the join found nothing —
   * a learner who did not practise, or whose answers predate
   * `Answer.itemId`.
   */
  readonly semana7dias: SemanaDelInforme | null;
  /**
   * Last week's plan and what became of it. Empty on a first report.
   */
  readonly planAnterior: readonly SeguimientoDelPlan[];
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
 *
 * The standing weakness profile is still what gates the report, even
 * now that the window exists. A learner can have a busy week with no
 * standing weakness — they are doing fine, and a report whose plan
 * has nothing to aim at is a report with nothing to do.
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

/**
 * How many topics of each kind reach the prompt.
 *
 * Three, not all of them. The window can turn up a dozen topics in a
 * heavy week, and a prompt listing all of them produces a report that
 * lists all of them — which is a spreadsheet, not advice. The cap is
 * applied here rather than in the query because the query's job is to
 * be complete and this is an editorial decision.
 */
const TEMAS_POR_LISTA = 3;

function aplanarTemaDeSemana(tema: TemaDeLaSemana): TemaDeLaSemanaPlano {
  return {
    area: tema.area,
    tema: tema.tema,
    aciertoPorcentaje: tema.aciertoPorcentaje,
    respondidas: tema.respondidas,
    segundosMediana: tema.segundosMediana,
  };
}

/** The window, shaped for the prompt. Null in, null out. */
export function aplanarSemana(
  resumen: ResumenDeLaSemana | null,
): SemanaDelInforme | null {
  if (!resumen) return null;

  /* Nothing answered means nothing to report about the week, which is
     different from a database error and reads the same to the model:
     either way there is no window evidence, and the report falls back
     to the standing profile. */
  if (resumen.respondidas === 0) return null;

  return {
    respondidas: resumen.respondidas,
    aciertoPorcentaje: resumen.aciertoPorcentaje,
    segundosMediana: resumen.segundosMediana,
    fuertes: resumen.fuertes.slice(0, TEMAS_POR_LISTA).map(aplanarTemaDeSemana),
    flojos: resumen.flojos.slice(0, TEMAS_POR_LISTA).map(aplanarTemaDeSemana),
    lentos: resumen.lentos.slice(0, TEMAS_POR_LISTA).map(aplanarTemaDeSemana),
  };
}
