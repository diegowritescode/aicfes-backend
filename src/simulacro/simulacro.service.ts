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
 *
 * The clock belongs to the server.
 *
 * `startedAt` and `minutos` are stored when the sitting opens, and the
 * time left is always computed from them. The browser only draws what
 * the server reports. This is not about distrusting the learner: a
 * timer living in the tab is lost when the tab closes, and browsers
 * throttle background timers, so minimising the window used to hand
 * out free seconds to anyone who did it, deliberately or not.
 *
 * Leaving is allowed. A dropped connection, a flat battery or a mother
 * calling are not cheating, and a sitting that punishes them would be
 * hostile to exactly the students this is for. What leaving does not do
 * is stop the clock: come back within the time and the sitting is
 * waiting, come back after it and it is graded with what was answered —
 * which is what the real exam does too.
 */

/** A question as the learner may see it: never with the answer. */
export interface PreguntaServida {
  readonly orden: number;
  readonly area: string;
  readonly itemId: string;
  readonly contexto: string;
  readonly pregunta: string;
  readonly opciones: unknown;
  readonly tieneFigura: boolean;
  /** Their current choice, so returning restores what they had. */
  readonly respuesta: string | null;
  readonly marcada: boolean;
}

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

    /* Only the sitting itself comes back. The client follows with a
       read, which is the one place that decides what a question may
       show; returning the rows here would be a second such place,
       free to drift from the first. */
    return this.prisma.simulacro.create({
      data: {
        userId,
        totalPreguntas,
        minutos: minutesFor(totalPreguntas),
        preguntas: { create: drawn },
      },
      select: {
        id: true,
        totalPreguntas: true,
        minutos: true,
        startedAt: true,
        status: true,
      },
    });
  }

  /** Seconds left, from the server's clock. Never negative. */
  private segundosRestantes(sitting: { startedAt: Date; minutos: number }): number {
    const fin = sitting.startedAt.getTime() + sitting.minutos * 60_000;
    return Math.max(0, Math.round((fin - Date.now()) / 1000));
  }

  /**
   * Loads a sitting that is still open, closing it first if its time
   * ran out while the learner was away.
   *
   * Every route that changes a sitting goes through here, so there is
   * one place where "is this still running?" is decided and it cannot
   * be answered differently by two of them.
   */
  private async enCurso(simulacroId: string, userId: string) {
    const sitting = await this.prisma.simulacro.findFirst({
      where: { id: simulacroId, userId },
    });
    if (!sitting) throw new NotFoundException('Simulacro no encontrado');
    if (sitting.status !== 'en_curso') {
      throw new BadRequestException('Este simulacro ya terminó');
    }

    if (this.segundosRestantes(sitting) <= 0) {
      /* The time ran out while they were away. Grading it now is the
         honest outcome: the alternative is letting a closed tab buy
         extra minutes, which would make every score meaningless. */
      await this.finish(simulacroId, userId);
      throw new BadRequestException(
        'Se acabó el tiempo de este simulacro. Ya quedó calificado con lo que alcanzó a responder.',
      );
    }

    return sitting;
  }

  /**
   * Records an answer, or changes one already given.
   *
   * Changing it is deliberate: in the real exam you may go back and
   * pick another option, and only the last one counts. The verdict is
   * stored but never returned here — the learner finds out when the
   * sitting is graded, as they would three months later.
   */
  async answer(simulacroId: string, userId: string, orden: number, respuesta: string) {
    const sitting = await this.enCurso(simulacroId, userId);

    const question = await this.prisma.simulacroPregunta.findUnique({
      where: { simulacroId_orden: { simulacroId, orden } },
    });
    if (!question) throw new NotFoundException('Pregunta no encontrada');

    const item = await this.prisma.generatedItem.findUnique({
      where: { id: question.itemId },
      select: { respuesta_correcta: true },
    });

    const saved = await this.prisma.simulacroPregunta.update({
      where: { id: question.id },
      data: {
        respuesta,
        correcta: item?.respuesta_correcta === respuesta,
        respondidaEn: new Date(),
      },
    });

    return { ...saved, segundosRestantes: this.segundosRestantes(sitting) };
  }

  /** Flags a question to come back to, or unflags it. */
  async marcar(simulacroId: string, userId: string, orden: number, marcada: boolean) {
    await this.enCurso(simulacroId, userId);

    const question = await this.prisma.simulacroPregunta.findUnique({
      where: { simulacroId_orden: { simulacroId, orden } },
    });
    if (!question) throw new NotFoundException('Pregunta no encontrada');

    return this.prisma.simulacroPregunta.update({
      where: { id: question.id },
      data: { marcada },
      select: { orden: true, marcada: true },
    });
  }

  /**
   * The whole sitting as the learner may see it: every question, in
   * order, with its text and options but never its answer, plus what
   * they have chosen so far and how long is left.
   *
   * This is what makes coming back work. The browser holds nothing
   * that matters; it asks for this and draws it.
   */
  async estado(simulacroId: string, userId: string) {
    const sitting = await this.prisma.simulacro.findFirst({
      where: { id: simulacroId, userId },
      include: { preguntas: { orderBy: { orden: 'asc' } } },
    });
    if (!sitting) throw new NotFoundException('Simulacro no encontrado');

    /* A sitting whose time has run out is closed on read, so the map
       and the clock cannot disagree about whether it is still running.

       `expirado` is computed from the clock rather than from who did
       the closing: the first request after the time runs out grades
       it, and every later one — the results page among them — has to
       keep reporting that the time ran out, not that it was handed in.
       Otherwise the learner is told they submitted a sitting they
       never got to finish. */
    const seAcaboElTiempo = this.segundosRestantes(sitting) <= 0;
    if (sitting.status === 'en_curso' && seAcaboElTiempo) {
      const graded = await this.finish(simulacroId, userId);
      return { ...graded, preguntas: [], segundosRestantes: 0, expirado: true };
    }

    const items = await this.prisma.generatedItem.findMany({
      where: { id: { in: sitting.preguntas.map((q) => q.itemId) } },
      select: {
        id: true,
        contexto: true,
        pregunta: true,
        opciones: true,
        figura: true,
      },
    });
    const porId = new Map(items.map((i) => [i.id, i]));

    /* respuesta_correcta, justificacion and explicaciones are not in
       the select above, and must not be: this payload reaches the
       browser, where anything sent can be read. */
    const preguntas: PreguntaServida[] = sitting.preguntas.map((q) => {
      const item = porId.get(q.itemId);
      return {
        orden: q.orden,
        area: q.area,
        itemId: q.itemId,
        contexto: item?.contexto ?? '',
        pregunta: item?.pregunta ?? '',
        opciones: item?.opciones ?? {},
        tieneFigura: Boolean(item?.figura),
        respuesta: q.respuesta,
        marcada: q.marcada,
      };
    });

    return {
      id: sitting.id,
      status: sitting.status,
      totalPreguntas: sitting.totalPreguntas,
      minutos: sitting.minutos,
      startedAt: sitting.startedAt,
      segundosRestantes: this.segundosRestantes(sitting),
      resultados: sitting.resultados,
      preguntas,
      expirado: seAcaboElTiempo,
    };
  }

  /**
   * Grades the sitting. Unanswered questions count as wrong, which is
   * how the real exam treats them.
   *
   * Grading twice is not possible: a sitting already graded returns the
   * report it already has. That matters because expiry grades it from
   * whichever request arrives first, and a second one must not reopen
   * or rewrite a score the learner has already seen.
   */
  async finish(simulacroId: string, userId: string) {
    const sitting = await this.prisma.simulacro.findFirst({
      where: { id: simulacroId, userId },
      include: { preguntas: true },
    });
    if (!sitting) throw new NotFoundException('Simulacro no encontrado');
    if (sitting.status !== 'en_curso') return sitting;

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
