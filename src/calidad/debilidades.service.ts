import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../persistence/prisma.service';
import { Area } from '@prisma/client';
import { normalizarTema } from './semana-real.service';

/**
 * What a learner keeps getting wrong, and at what grain.
 *
 * The point of the product is not to serve questions; it is to serve
 * the *right* questions. Someone strong in Matemáticas and weak in
 * Sociales gains nothing from a balanced diet, and a learner who fails
 * every question about angles should meet angles tomorrow, not a
 * random walk through the syllabus.
 *
 * Everything this needs was already being generated and thrown away.
 * Each item carries `tags` (the topic) and `distractores`, which label
 * every wrong option by the kind of mistake it represents:
 * error_calculo, interpretacion_parcial, confunde_conceptos. Until now
 * an answer recorded only area, difficulty and right-or-wrong, which
 * is too coarse to act on.
 */

/** Below this many answers on a topic, the rate is noise. */
const MUESTRA_MINIMA = 4;
/** At or below this share correct, a topic counts as weak. */
const UMBRAL_DEBIL = 0.6;
/** A topic untouched for this long stops counting as current. */
const DIAS_VIGENCIA = 45;

export interface TemaDebil {
  readonly area: Area;
  readonly tema: string;
  readonly respondidas: number;
  readonly acertadas: number;
  readonly aciertoPorcentaje: number;
  /** The mistake made most often here, when there is one. */
  readonly errorTipico: string | null;
  readonly ultimoFallo: Date | null;
  /** Higher means more worth practising now. */
  readonly prioridad: number;
}

@Injectable()
export class DebilidadesService {
  private readonly log = new Logger(DebilidadesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Folds one answer into the learner's profile.
   *
   * Never throws: losing a profile update must not cost the learner
   * their answer. The caller records the answer first and calls this
   * afterwards.
   */
  async registrar(params: {
    userId: string;
    itemId: string;
    opcionElegida: string;
    correcta: boolean;
  }): Promise<void> {
    try {
      const item = await this.prisma.generatedItem.findUnique({
        where: { id: params.itemId },
        select: { area: true, tags: true, distractores: true },
      });
      if (!item) return;

      const temas = this.temasDe(item.tags);
      if (temas.length === 0) return;

      /* The kind of mistake, read from the option the learner chose.
         A correct answer has no mistake to record. */
      const tipoError = params.correcta
        ? null
        : this.tipoErrorDe(item.distractores, params.opcionElegida);

      await Promise.all(
        temas.map((tema) =>
          this.acumular({
            userId: params.userId,
            area: item.area,
            tema,
            correcta: params.correcta,
            tipoError,
          }),
        ),
      );
    } catch (error) {
      this.log.warn(`No se pudo registrar la debilidad: ${error}`);
    }
  }

  /** One row per topic, read-modify-written inside a transaction. */
  private async acumular(params: {
    userId: string;
    area: Area;
    tema: string;
    correcta: boolean;
    tipoError: string | null;
  }): Promise<void> {
    const { userId, area, tema, correcta, tipoError } = params;

    await this.prisma.$transaction(async (tx) => {
      const existente = await tx.perfilDebilidad.findUnique({
        where: { userId_area_tema: { userId, area, tema } },
        select: { tipoErrores: true },
      });

      /* Counting mistake types means reading the map, so the whole
         update runs in a transaction: two answers arriving together
         must not lose each other's count. */
      const conteo = (existente?.tipoErrores as Record<string, number> | null) ?? {};
      if (tipoError) conteo[tipoError] = (conteo[tipoError] ?? 0) + 1;

      await tx.perfilDebilidad.upsert({
        where: { userId_area_tema: { userId, area, tema } },
        create: {
          userId,
          area,
          tema,
          respondidas: 1,
          acertadas: correcta ? 1 : 0,
          tipoErrores: conteo,
          ultimoFallo: correcta ? null : new Date(),
        },
        update: {
          respondidas: { increment: 1 },
          ...(correcta ? { acertadas: { increment: 1 } } : {}),
          tipoErrores: conteo,
          ...(correcta ? {} : { ultimoFallo: new Date() }),
        },
      });
    });
  }

  /**
   * The topics worth practising, strongest need first.
   *
   * A topic needs a minimum number of answers before it counts: two
   * wrong out of three is not evidence of anything, and acting on it
   * would send a learner to drill something they simply have not met
   * yet.
   */
  async temasDebiles(userId: string, limite = 5, area?: Area): Promise<TemaDebil[]> {
    const filas = await this.prisma.perfilDebilidad.findMany({
      where: {
        userId,
        ...(area ? { area } : {}),
        respondidas: { gte: MUESTRA_MINIMA },
      },
    });

    const ahora = Date.now();
    const vigenciaMs = DIAS_VIGENCIA * 24 * 60 * 60 * 1000;

    return filas
      .map((fila) => {
        const acierto = fila.respondidas > 0 ? fila.acertadas / fila.respondidas : 0;
        const conteo = (fila.tipoErrores as Record<string, number> | null) ?? {};
        const errorTipico =
          Object.entries(conteo).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

        /* Priority combines how badly it goes with how recent it is.
           What someone failed in March should not outrank what they
           failed last week: knowledge moves, and a stale weakness is
           often one they have since fixed elsewhere. */
        const fallos = fila.respondidas - fila.acertadas;
        const antiguedad = fila.ultimoFallo
          ? Math.min(1, (ahora - fila.ultimoFallo.getTime()) / vigenciaMs)
          : 1;
        const frescura = 1 - antiguedad * 0.6;
        const prioridad = (1 - acierto) * Math.log2(1 + fallos) * frescura;

        return {
          area: fila.area,
          tema: fila.tema,
          respondidas: fila.respondidas,
          acertadas: fila.acertadas,
          aciertoPorcentaje: Math.round(acierto * 100),
          errorTipico,
          ultimoFallo: fila.ultimoFallo,
          prioridad: Number(prioridad.toFixed(4)),
        };
      })
      /* The sample floor is applied here as well as in the query. In
         the query alone it is invisible to anyone reading the rule,
         and a future caller passing its own rows would silently lose
         it — which is exactly what a test caught. */
      .filter((t) => t.respondidas >= MUESTRA_MINIMA)
      .filter((t) => t.aciertoPorcentaje <= UMBRAL_DEBIL * 100)
      .sort((a, b) => b.prioridad - a.prioridad)
      .slice(0, limite);
  }

  /**
   * Which area to put in front of the learner next.
   *
   * Returns null until there is enough to go on, so a new learner is
   * not pushed anywhere by a profile built from three answers.
   */
  async areaPrioritaria(userId: string): Promise<Area | null> {
    const filas = await this.prisma.perfilDebilidad.groupBy({
      by: ['area'],
      where: { userId },
      _sum: { respondidas: true, acertadas: true },
    });

    const candidatas = filas
      .map((fila) => {
        const respondidas = fila._sum.respondidas ?? 0;
        const acertadas = fila._sum.acertadas ?? 0;
        return { area: fila.area, respondidas, acierto: respondidas ? acertadas / respondidas : 1 };
      })
      .filter((f) => f.respondidas >= MUESTRA_MINIMA * 2);

    if (candidatas.length === 0) return null;
    return candidatas.sort((a, b) => a.acierto - b.acierto)[0].area;
  }

  /** Topics from an item's tags, normalised so they group together. */
  private temasDe(tags: unknown): string[] {
    if (!Array.isArray(tags)) return [];
    const vistos = new Set<string>();
    for (const bruto of tags) {
      if (typeof bruto !== 'string') continue;
      /* One definition, shared with the weekly window. Both read the
         same `tags` column, and a topic spelled two ways is a topic
         the report's plan cannot match against what was practised. */
      const tema = normalizarTema(bruto);
      /* A one-word tag like "facil" says nothing about the subject,
         and an essay is not a topic either. */
      if (tema.length < 3 || tema.length > 40) continue;
      vistos.add(tema);
    }
    // More than three tags on one item means the model was listing
    // rather than classifying; the first three are the useful ones.
    return [...vistos].slice(0, 3);
  }

  /** The error type the chosen option represents. */
  private tipoErrorDe(distractores: unknown, opcion: string): string | null {
    if (!distractores || typeof distractores !== 'object') return null;
    const tipo = (distractores as Record<string, unknown>)[opcion];
    if (typeof tipo !== 'string' || tipo === 'correcta') return null;
    return tipo;
  }
}
