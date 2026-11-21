import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Area } from '@prisma/client';
import { PrismaService } from '../persistence/prisma.service';
import { ItemBankService } from '../items/services/item-bank.service';
import { minutesFor, scaleBlueprint } from './exam-blueprint';

/**
 * A practice sitting drawn from the bank.
 *
 * Items come from the bank rather than being generated, so starting a
 * sitting is one query instead of dozens of model requests. The bank
 * grows as items are generated elsewhere, and the sitting keeps the real
 * exam's proportions whatever its length.
 */

export interface AreaScore {
  readonly area: string;
  readonly correctas: number;
  readonly total: number;
  readonly porcentaje: number;
}

@Injectable()
export class SimulacroService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bank: ItemBankService,
  ) {}

  /**
   * Starts a sitting, drawing items per area in the exam's proportions.
   * Fails rather than starting short: a sitting missing an area would
   * report a score that cannot be compared to a real one.
   */
  async start(userId: string, totalPreguntas: number) {
    if (totalPreguntas < 5 || totalPreguntas > 254) {
      throw new BadRequestException('Un simulacro va de 5 a 254 preguntas');
    }

    const plan = scaleBlueprint(totalPreguntas);
    const drawn: Array<{ itemId: string; area: Area; orden: number }> = [];
    const shortfalls: string[] = [];
    let orden = 0;

    for (const area of plan) {
      const items = await this.bank.draw({ area: area.area, limit: area.scaled });
      if (items.length < area.scaled) {
        shortfalls.push(`${area.label}: ${items.length} de ${area.scaled}`);
      }
      for (const item of items) {
        drawn.push({ itemId: String(item.id), area: area.area as Area, orden: orden++ });
      }
    }

    if (shortfalls.length > 0) {
      throw new BadRequestException(
        `El banco no tiene suficientes ítems verificados — ${shortfalls.join('; ')}. ` +
          'Genera más ítems en esas áreas antes de iniciar el simulacro.',
      );
    }

    return this.prisma.simulacro.create({
      data: {
        userId,
        totalPreguntas,
        minutos: minutesFor(totalPreguntas),
        preguntas: { create: drawn },
      },
      include: { preguntas: { orderBy: { orden: 'asc' } } },
    });
  }

  /** Records an answer and whether it was right. */
  async answer(simulacroId: string, userId: string, orden: number, respuesta: string) {
    const sitting = await this.prisma.simulacro.findFirst({
      where: { id: simulacroId, userId },
    });
    if (!sitting) throw new NotFoundException('Simulacro no encontrado');
    if (sitting.status !== 'en_curso') {
      throw new BadRequestException('Este simulacro ya terminó');
    }

    const question = await this.prisma.simulacroPregunta.findUnique({
      where: { simulacroId_orden: { simulacroId, orden } },
    });
    if (!question) throw new NotFoundException('Pregunta no encontrada');

    const item = await this.prisma.generatedItem.findUnique({
      where: { id: question.itemId },
      select: { respuesta_correcta: true },
    });

    return this.prisma.simulacroPregunta.update({
      where: { id: question.id },
      data: {
        respuesta,
        correcta: item?.respuesta_correcta === respuesta,
        respondidaEn: new Date(),
      },
    });
  }

  /**
   * Grades the sitting. Unanswered questions count as wrong, which is
   * how the real exam treats them.
   */
  async finish(simulacroId: string, userId: string) {
    const sitting = await this.prisma.simulacro.findFirst({
      where: { id: simulacroId, userId },
      include: { preguntas: true },
    });
    if (!sitting) throw new NotFoundException('Simulacro no encontrado');

    const byArea = new Map<string, { correctas: number; total: number }>();
    for (const q of sitting.preguntas) {
      const entry = byArea.get(q.area) ?? { correctas: 0, total: 0 };
      entry.total += 1;
      if (q.correcta === true) entry.correctas += 1;
      byArea.set(q.area, entry);
    }

    const areas: AreaScore[] = [...byArea.entries()].map(([area, s]) => ({
      area,
      correctas: s.correctas,
      total: s.total,
      porcentaje: s.total === 0 ? 0 : Math.round((s.correctas / s.total) * 1000) / 10,
    }));

    const correctas = areas.reduce((sum, a) => sum + a.correctas, 0);
    const total = areas.reduce((sum, a) => sum + a.total, 0);

    const resultados = {
      correctas,
      total,
      porcentaje: total === 0 ? 0 : Math.round((correctas / total) * 1000) / 10,
      areas: areas.sort((a, b) => a.porcentaje - b.porcentaje),
      // The weakest areas first: that ordering is the study plan.
      recomendacion: areas
        .filter((a) => a.porcentaje < 70)
        .map((a) => a.area),
    };

    return this.prisma.simulacro.update({
      where: { id: simulacroId },
      // Prisma's JSON input rejects readonly arrays, so the report is
      // handed over as plain data.
      data: {
        status: 'terminado',
        finishedAt: new Date(),
        resultados: JSON.parse(JSON.stringify(resultados)),
      },
    });
  }

  async get(simulacroId: string, userId: string) {
    const sitting = await this.prisma.simulacro.findFirst({
      where: { id: simulacroId, userId },
      include: { preguntas: { orderBy: { orden: 'asc' } } },
    });
    if (!sitting) throw new NotFoundException('Simulacro no encontrado');
    return sitting;
  }

  async list(userId: string) {
    return this.prisma.simulacro.findMany({
      where: { userId },
      orderBy: { startedAt: 'desc' },
      take: 20,
    });
  }
}

export default SimulacroService;
