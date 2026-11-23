import { Injectable, Logger } from '@nestjs/common';
import type { Area } from '@prisma/client';
import { PrismaService } from '../persistence/prisma.service';

/**
 * Every question this learner got wrong and has not got right since.
 *
 * The question of the day shows one. That is a nudge: something small
 * to do today. It is not a tool — a learner who wants to work through
 * their mistakes cannot see how many there are, which areas they fall
 * in, or whether they are making progress, and answering one produced
 * another with no sense of an end.
 *
 * This is the tool. The two coexist on purpose.
 */

/** How far back a mistake still counts. Older than this and the
    learner has moved on; carrying it forward is noise. */
const DIAS_VENTANA = 30;

export interface ErrorPendiente {
  readonly itemId: string;
  readonly area: Area;
  readonly pregunta: string;
  readonly contexto: string | null;
  readonly opciones: Record<string, string>;
  readonly respuesta_correcta: string;
  readonly explicaciones: Record<string, string> | null;
  /** When they last got it wrong. */
  readonly falladaEn: Date;
  /** How many times, which is what makes one worth doing first. */
  readonly veces: number;
}

export interface ResumenRepaso {
  readonly pendientes: number;
  readonly corregidos: number;
  readonly porArea: ReadonlyArray<{ area: Area; pendientes: number }>;
}

@Injectable()
export class RepasoService {
  private readonly log = new Logger(RepasoService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Outstanding mistakes, worst first.
   *
   * "Worst" is how often it was missed, then how long ago: a question
   * failed four times is a gap, one failed once is a slip.
   */
  async pendientes(params: {
    userId: string;
    area?: Area;
    limite?: number;
  }): Promise<ErrorPendiente[]> {
    const limite = Math.min(Math.max(1, params.limite ?? 20), 50);
    const desde = new Date(Date.now() - DIAS_VENTANA * 24 * 60 * 60 * 1000);

    const respuestas = await this.prisma.answer.findMany({
      where: {
        itemId: { not: null },
        createdAt: { gte: desde },
        session: { userId: params.userId },
        ...(params.area ? { area: params.area } : {}),
      },
      select: { itemId: true, isCorrect: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    /* Newest first, so the first time an item appears is its latest
       outcome. One last answered correctly has been learnt and is not
       outstanding — that is the rule that makes this list shrink. */
    const visto = new Set<string>();
    const fallos = new Map<string, { veces: number; ultima: Date }>();

    for (const r of respuestas) {
      if (!r.itemId) continue;
      if (!visto.has(r.itemId)) {
        visto.add(r.itemId);
        if (r.isCorrect) continue; // learnt
        fallos.set(r.itemId, { veces: 0, ultima: r.createdAt });
      }
      const fila = fallos.get(r.itemId);
      if (fila && !r.isCorrect) fila.veces += 1;
    }

    if (fallos.size === 0) return [];

    const items = await this.prisma.generatedItem.findMany({
      where: { id: { in: [...fallos.keys()] }, retirado: false },
      select: {
        id: true,
        area: true,
        pregunta: true,
        contexto: true,
        opciones: true,
        respuesta_correcta: true,
        explicaciones: true,
      },
    });

    return items
      .map((i) => {
        const f = fallos.get(i.id)!;
        return {
          itemId: i.id,
          area: i.area,
          pregunta: i.pregunta,
          contexto: i.contexto ?? null,
          opciones: i.opciones as Record<string, string>,
          respuesta_correcta: i.respuesta_correcta,
          explicaciones: (i.explicaciones as Record<string, string> | null) ?? null,
          falladaEn: f.ultima,
          veces: f.veces,
        };
      })
      .sort((a, b) => b.veces - a.veces || a.falladaEn.getTime() - b.falladaEn.getTime())
      .slice(0, limite);
  }

  /**
   * The counts, so the screen can show progress rather than a list
   * that never visibly ends.
   */
  async resumen(userId: string): Promise<ResumenRepaso> {
    const desde = new Date(Date.now() - DIAS_VENTANA * 24 * 60 * 60 * 1000);

    const respuestas = await this.prisma.answer.findMany({
      where: {
        itemId: { not: null },
        createdAt: { gte: desde },
        session: { userId },
      },
      select: { itemId: true, area: true, isCorrect: true },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    const visto = new Set<string>();
    const porArea = new Map<Area, number>();
    let pendientes = 0;
    let corregidos = 0;

    for (const r of respuestas) {
      if (!r.itemId || visto.has(r.itemId)) continue;
      visto.add(r.itemId);
      if (r.isCorrect) {
        corregidos += 1;
        continue;
      }
      pendientes += 1;
      if (r.area) porArea.set(r.area, (porArea.get(r.area) ?? 0) + 1);
    }

    return {
      pendientes,
      corregidos,
      porArea: [...porArea]
        .map(([area, n]) => ({ area, pendientes: n }))
        .sort((a, b) => b.pendientes - a.pendientes),
    };
  }
}
