import { Injectable, Logger } from '@nestjs/common';
import { Area } from '@prisma/client';
import { PrismaService } from '../persistence/prisma.service';

/**
 * What actually happened in a date range, per topic.
 *
 * `DebilidadesService` answers a different question and answers it
 * well: what does this learner *carry*, accumulated over months with
 * a recency decay. That is the right input for choosing what to drill
 * next, and the wrong input for a sentence that begins «esta semana».
 *
 * A weekly report built only on that profile cannot say a learner
 * improved, because the profile has no notion of a window — a topic
 * fixed on Tuesday still shows February's failures folded into the
 * same counters. So the report could only speak in the present tense
 * («sigues fallando en X»), which is what ADR 35 recorded as a known
 * limit.
 *
 * This closes it. Everything needed was already stored and never
 * read:
 *
 * - `Answer.itemId` joins an answer back to its item, and
 *   `GeneratedItem.tags` holds the topic.
 * - `Answer.tiempoMs` is written on every answer and read by nobody.
 *   All «seconds per question» in the product comes from
 *   `StudySession.durationSeconds / totalQuestions`, which counts
 *   reading the prompt, the learner putting the phone down, and the
 *   bus ride. Per-answer time is the honest figure and it is per
 *   topic, so «fallas ángulos y encima te demoras el doble ahí» is
 *   available.
 * - `Answer.createdAt` makes the window possible at all.
 *
 * One query, grouped in SQL rather than in JavaScript: a learner with
 * a year of history has thousands of answers, and pulling them into
 * the process to group them would move the cost from the database to
 * the request.
 */

/**
 * Below this many answers on a topic inside the window, a rate is
 * noise.
 *
 * Lower than `DebilidadesService`'s floor of four on purpose. That
 * floor protects a decision — which topic to put in front of someone
 * — and being wrong there wastes their study time. This one protects
 * a sentence in a report, and a week is a much smaller sample than
 * all of history: with a floor of four, most learners would get a
 * report that says nothing about the week they just lived.
 */
const MINIMO_EN_LA_VENTANA = 3;

/** At or above this share correct, inside the window, a topic is a strength. */
const UMBRAL_FUERTE = 0.8;

/** At or below this share correct, inside the window, a topic went badly. */
const UMBRAL_DEBIL = 0.6;

/**
 * Answers slower than this multiple of the learner's own median are
 * «slow». Relative to themselves, not to the exam: a learner who is
 * uniformly slow has a pacing problem, not a problem with one topic,
 * and telling them every topic is slow says nothing.
 */
const FACTOR_LENTO = 1.5;

export interface TemaDeLaSemana {
  readonly area: Area;
  /** As stored: «leyes-de-newton». Use `temaLegible` before showing it. */
  readonly tema: string;
  readonly respondidas: number;
  readonly acertadas: number;
  readonly aciertoPorcentaje: number;
  /**
   * Median seconds per answer on this topic, from `Answer.tiempoMs`.
   * Null when no answer in the window recorded a time — answers
   * predating the column have none.
   */
  readonly segundosMediana: number | null;
}

export interface ResumenDeLaSemana {
  readonly desde: Date;
  readonly hasta: Date;
  readonly respondidas: number;
  readonly acertadas: number;
  readonly aciertoPorcentaje: number;
  /** Median seconds per answer across every topic. Null when untimed. */
  readonly segundosMediana: number | null;
  /** Topics that went well in the window, best first. */
  readonly fuertes: readonly TemaDeLaSemana[];
  /** Topics that went badly in the window, worst first. */
  readonly flojos: readonly TemaDeLaSemana[];
  /**
   * Topics answered noticeably slower than this learner's own median.
   * Separate from accuracy: being right but slow is a real finding,
   * and so is being fast and wrong.
   */
  readonly lentos: readonly TemaDeLaSemana[];
}

interface FilaCruda {
  readonly area: Area;
  readonly tema: string;
  readonly respondidas: bigint | number;
  readonly acertadas: bigint | number;
  readonly mediana_ms: number | null;
}

@Injectable()
export class SemanaRealService {
  private readonly log = new Logger(SemanaRealService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Per-topic results strictly inside a date range.
   *
   * Returns null on a database error rather than throwing: this feeds
   * a report, and a report is not worth failing the screen that shows
   * a learner their progress. The caller treats null as «no window
   * data» and writes the report without it.
   */
  async resumen(
    userId: string,
    desde: Date,
    hasta: Date,
  ): Promise<ResumenDeLaSemana | null> {
    try {
      const filas = await this.filas(userId, desde, hasta);
      return this.componer(filas, desde, hasta);
    } catch (error) {
      this.log.warn(`No se pudo leer la semana de ${userId}: ${error}`);
      return null;
    }
  }

  /**
   * The one query.
   *
   * `jsonb_array_elements_text(i.tags)` turns an item's topic array
   * into rows, so an item tagged with two topics counts under both —
   * matching how `DebilidadesService.registrar` already accumulates
   * it. Without that the two would disagree about the same answer.
   *
   * `percentile_cont` for the middle rather than `avg`: one answer
   * left open while the learner went to lunch is twenty minutes, and
   * a mean of four answers with one of those in it is a number about
   * lunch. A median cannot be dragged by a single outlier, which is
   * the whole failure mode of per-answer timing.
   *
   * `tiempoMs` is filtered to a sane band inside the aggregate. Zero
   * and negatives are clock skew; the upper bound is the point past
   * which the learner was no longer answering.
   */
  private async filas(userId: string, desde: Date, hasta: Date) {
    return this.prisma.$queryRaw<FilaCruda[]>`
      SELECT
        a.area AS area,
        tag.value AS tema,
        COUNT(*) AS respondidas,
        COUNT(*) FILTER (WHERE a."isCorrect") AS acertadas,
        percentile_cont(0.5) WITHIN GROUP (
          ORDER BY a."tiempoMs"
        ) FILTER (
          WHERE a."tiempoMs" IS NOT NULL
            AND a."tiempoMs" > 0
            AND a."tiempoMs" < 600000
        ) AS mediana_ms
      FROM "Answer" a
      JOIN "StudySession" s ON s.id = a."sessionId"
      JOIN "GeneratedItem" i ON i.id = a."itemId"
      CROSS JOIN LATERAL jsonb_array_elements_text(i.tags) AS tag(value)
      WHERE s."userId" = ${userId}
        AND a."createdAt" >= ${desde}
        AND a."createdAt" < ${hasta}
        AND a.area IS NOT NULL
      GROUP BY a.area, tag.value
      HAVING COUNT(*) >= ${MINIMO_EN_LA_VENTANA}
    `;
  }

  /**
   * Sorting the rows into the three lists.
   *
   * Pure, so the thresholds are testable without a database. The
   * query returns `bigint` for counts because Postgres `COUNT` is
   * `bigint`; `Number()` is safe here because a learner answering
   * more than 2^53 questions in a week is not the failure mode worth
   * guarding.
   */
  private componer(
    filas: readonly FilaCruda[],
    desde: Date,
    hasta: Date,
  ): ResumenDeLaSemana {
    const temas: TemaDeLaSemana[] = filas.map((fila) => {
      const respondidas = Number(fila.respondidas);
      const acertadas = Number(fila.acertadas);
      const mediana = fila.mediana_ms === null ? null : Number(fila.mediana_ms);

      return {
        area: fila.area,
        tema: fila.tema,
        respondidas,
        acertadas,
        aciertoPorcentaje:
          respondidas > 0 ? Math.round((acertadas / respondidas) * 100) : 0,
        segundosMediana: mediana === null ? null : Math.round(mediana / 1000),
      };
    });

    const respondidas = temas.reduce((suma, t) => suma + t.respondidas, 0);
    const acertadas = temas.reduce((suma, t) => suma + t.acertadas, 0);

    /* The learner's own middle, weighted by nothing: each topic's
       median counts once. Weighting by answer count would let one
       heavily drilled topic define «normal pace» for the others. */
    const medianas = temas
      .map((t) => t.segundosMediana)
      .filter((s): s is number => s !== null)
      .sort((a, b) => a - b);

    /* The true middle, averaging the two central values on an even
       count. Taking `medianas[length / 2]` instead picks the HIGHER
       of the two, which with exactly two topics makes the slower one
       its own baseline — so it can never be flagged as slow. A test
       caught that: a learner with one normal topic and one at triple
       the time got an empty slow list. */
    const segundosMediana = mediana(medianas);

    return {
      desde,
      hasta,
      respondidas,
      acertadas,
      aciertoPorcentaje:
        respondidas > 0 ? Math.round((acertadas / respondidas) * 100) : 0,
      segundosMediana,
      fuertes: temas
        .filter((t) => t.aciertoPorcentaje >= UMBRAL_FUERTE * 100)
        .sort((a, b) => b.aciertoPorcentaje - a.aciertoPorcentaje),
      flojos: temas
        .filter((t) => t.aciertoPorcentaje <= UMBRAL_DEBIL * 100)
        .sort((a, b) => a.aciertoPorcentaje - b.aciertoPorcentaje),
      /* Slow is measured against this learner, and only when there is
         a median to measure against. A learner with no timed answers
         gets no slow list rather than a list built on a guess. */
      lentos:
        segundosMediana === null
          ? []
          : temas
              .filter(
                (t) =>
                  t.segundosMediana !== null &&
                  t.segundosMediana >= segundosMediana * FACTOR_LENTO,
              )
              .sort((a, b) => (b.segundosMediana ?? 0) - (a.segundosMediana ?? 0)),
    };
  }
}

/**
 * The middle of a sorted list of numbers.
 *
 * Averaged on an even count rather than taking either neighbour. The
 * off-by-one it replaces was not visible in any single-topic case and
 * only appeared with exactly two.
 */
function mediana(ordenados: readonly number[]): number | null {
  if (ordenados.length === 0) return null;

  const medio = Math.floor(ordenados.length / 2);

  if (ordenados.length % 2 === 1) return ordenados[medio]!;

  return Math.round((ordenados[medio - 1]! + ordenados[medio]!) / 2);
}

/**
 * The stored topic as the item generator wants it.
 *
 * Topics are stored hyphenated (`leyes-de-newton`) and the generator
 * takes a topic as prose, feeding it into a prompt and into
 * `ReferenciaService`'s similarity search. `time-trial.service.ts`
 * already does this `.replace()` inline at its own call site, which
 * is exactly how a second caller gets it wrong: the hyphenated form
 * matches no reference example and the bank quietly returns nothing
 * useful.
 *
 * Exported from here so every caller shares one answer.
 */
export function temaLegible(tema: string): string {
  return tema.replace(/-/g, ' ');
}
