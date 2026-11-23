import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../persistence/prisma.service';

/**
 * Judges items by how they perform with real learners.
 *
 * Verification proves an item is correct. It cannot prove the item is
 * *good*: a question everyone answers right teaches nothing, and one
 * almost everyone gets wrong is usually badly worded rather than hard.
 * Only answers from real students separate the two.
 *
 * The thresholds follow standard item analysis: the proportion who
 * answer correctly is the difficulty index (p), and a usable item sits
 * between P_MINIMO and P_MAXIMO below. Below that it is likely broken;
 * above it, it is not measuring anything.
 *
 * The bounds are named rather than repeated here: this comment used to
 * say 0.9 while the constant said 0.95, which is the kind of drift a
 * second copy of a number always produces.
 */

/** Below this share correct, an item is more likely broken than hard. */
const P_MINIMO = 0.2;
/** Above this, the item separates nobody. */
const P_MAXIMO = 0.95;
/** No verdict before this many answers: small samples say nothing. */
const MUESTRA_MINIMA = 20;

export interface SaludItem {
  readonly itemId: string;
  readonly respuestas: number;
  readonly dificultad: number | null;
  readonly tiempoMedioMs: number | null;
  readonly veredicto: 'sano' | 'muy_dificil' | 'muy_facil' | 'distractor_muerto' | 'sin_datos';
  readonly detalle?: string;
}

@Injectable()
export class CalidadService {
  private readonly log = new Logger(CalidadService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Records one answer. Counts are incremented in the database rather
   * than read-modify-written, so concurrent answers cannot lose each
   * other.
   */
  async registrarRespuesta(params: {
    itemId: string;
    opcionElegida: string;
    correcta: boolean;
    tiempoMs: number;
  }): Promise<void> {
    const item = await this.prisma.generatedItem.findUnique({
      where: { id: params.itemId },
      select: { conteoOpciones: true },
    });
    if (!item) return;

    const conteo = (item.conteoOpciones as Record<string, number> | null) ?? {};
    conteo[params.opcionElegida] = (conteo[params.opcionElegida] ?? 0) + 1;

    await this.prisma.generatedItem.update({
      where: { id: params.itemId },
      data: {
        vecesRespondido: { increment: 1 },
        ...(params.correcta ? { vecesCorrecto: { increment: 1 } } : {}),
        // Clamped: a tab left open overnight would otherwise ruin the mean.
        tiempoTotalMs: { increment: BigInt(Math.min(Math.max(params.tiempoMs, 0), 600_000)) },
        conteoOpciones: conteo,
      },
    });
  }

  /** What the numbers say about one item. */
  async salud(itemId: string): Promise<SaludItem> {
    const item = await this.prisma.generatedItem.findUnique({
      where: { id: itemId },
      select: {
        id: true,
        vecesRespondido: true,
        vecesCorrecto: true,
        tiempoTotalMs: true,
        conteoOpciones: true,
      },
    });
    if (!item || item.vecesRespondido < MUESTRA_MINIMA) {
      return {
        itemId,
        respuestas: item?.vecesRespondido ?? 0,
        dificultad: null,
        tiempoMedioMs: null,
        veredicto: 'sin_datos',
        detalle: `se necesitan ${MUESTRA_MINIMA} respuestas`,
      };
    }

    const p = item.vecesCorrecto / item.vecesRespondido;
    const tiempoMedioMs = Number(item.tiempoTotalMs) / item.vecesRespondido;
    const base = { itemId, respuestas: item.vecesRespondido, dificultad: p, tiempoMedioMs };

    if (p < P_MINIMO) {
      return {
        ...base,
        veredicto: 'muy_dificil',
        detalle: `solo ${(p * 100).toFixed(0)}% acierta: probablemente mal redactado`,
      };
    }
    if (p > P_MAXIMO) {
      return {
        ...base,
        veredicto: 'muy_facil',
        detalle: `${(p * 100).toFixed(0)}% acierta: no distingue a nadie`,
      };
    }

    // A distractor nobody ever picks is not doing its job.
    const conteo = (item.conteoOpciones as Record<string, number> | null) ?? {};
    const muertos = ['A', 'B', 'C', 'D'].filter((k) => (conteo[k] ?? 0) === 0);
    if (muertos.length >= 2) {
      return {
        ...base,
        veredicto: 'distractor_muerto',
        detalle: `nadie eligió ${muertos.join(' ni ')}: esos distractores no funcionan`,
      };
    }

    return { ...base, veredicto: 'sano' };
  }

  /**
   * Withdraws the items the numbers condemn.
   *
   * Withdrawn, not deleted: the item stops being served but stays
   * readable, which is what makes the prompt improvable later.
   */
  async retirarDefectuosos(): Promise<{ revisados: number; retirados: number }> {
    const candidatos = await this.prisma.generatedItem.findMany({
      where: { retirado: false, vecesRespondido: { gte: MUESTRA_MINIMA } },
      select: { id: true },
    });

    let retirados = 0;
    for (const { id } of candidatos) {
      const salud = await this.salud(id);
      if (salud.veredicto === 'muy_dificil' || salud.veredicto === 'distractor_muerto') {
        await this.prisma.generatedItem.update({
          where: { id },
          data: { retirado: true, motivoRetiro: salud.detalle ?? salud.veredicto },
        });
        retirados += 1;
      }
    }

    this.log.log(`Revisados ${candidatos.length}, retirados ${retirados}`);
    return { revisados: candidatos.length, retirados };
  }

  /** The bank's health, for an operator rather than a learner. */
  async resumen(): Promise<{
    total: number;
    conDatos: number;
    retirados: number;
    dificultadMedia: number | null;
  }> {
    const [total, retirados, agregado] = await Promise.all([
      this.prisma.generatedItem.count({ where: { verified: true } }),
      this.prisma.generatedItem.count({ where: { retirado: true } }),
      this.prisma.generatedItem.aggregate({
        where: { vecesRespondido: { gte: MUESTRA_MINIMA } },
        _sum: { vecesRespondido: true, vecesCorrecto: true },
        _count: { _all: true },
      }),
    ]);

    const respondidas = agregado._sum.vecesRespondido ?? 0;
    const correctas = agregado._sum.vecesCorrecto ?? 0;
    return {
      total,
      conDatos: agregado._count._all,
      retirados,
      dificultadMedia: respondidas > 0 ? correctas / respondidas : null,
    };
  }
}

export default CalidadService;
