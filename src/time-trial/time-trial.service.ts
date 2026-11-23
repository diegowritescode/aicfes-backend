import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../persistence/prisma.service';
import { ItemGeneratorService } from '../items/services/item-generator.service';
import { PersistenceService } from '../persistence/persistence.service';
import { nanoid } from 'nanoid';
import { DashboardService } from '../dashboard/dashboard.service';
import { Area, Dificultad } from '@prisma/client';
import { MODOS, MODOS_RETIRADOS } from './modos';
import { DebilidadesService } from '../calidad/debilidades.service';
import { ItemBankService } from '../items/services/item-bank.service';
import { repartirFuentes } from './fuente-de-preguntas';

@Injectable()
export class TimeTrialService {
  private readonly log = new Logger(TimeTrialService.name);

  constructor(
    private prisma: PrismaService,
    private generator: ItemGeneratorService,
    private persistence: PersistenceService,
    private dashboardService: DashboardService,
    private debilidades: DebilidadesService,
    private banco: ItemBankService,
  ) {}

  async listModes() {
    await this.ensureDefaultModes();
    return this.prisma.timeTrialMode.findMany({
      where: { enabled: true },
      orderBy: [{ nivel: 'asc' }, { segundosPorPregunta: 'desc' }],
    });
  }

  private async ensureDefaultModes() {
    await Promise.all(
      MODOS.map((modo) => {
        const campos = {
          title: modo.title,
          description: modo.description,
          timeLimitSeconds: modo.timeLimitSeconds,
          questions: modo.questions,
          area: (modo.area as Area) || null,
          dificultad: (modo.dificultad as Dificultad) || null,
          mix: modo.mix ? (modo.mix as unknown as object) : undefined,
          nivel: modo.nivel,
          segundosPorPregunta: modo.segundosPorPregunta,
          enabled: true,
        };
        return this.prisma.timeTrialMode.upsert({
          where: { id: modo.id },
          update: campos,
          create: { id: modo.id, ...campos },
        });
      }),
    );

    /* Disabled rather than deleted: a finished session still points at
       the mode it was played under, and deleting it would orphan the
       learner's own history. */
    await this.prisma.timeTrialMode.updateMany({
      where: { id: { in: MODOS_RETIRADOS } },
      data: { enabled: false },
    });
  }

  /**
   * Questions for one section: from the bank first, generated for the
   * rest.
   *
   * Contrarreloj used to generate every question of every round. The
   * bank holds 326 verified items that only a simulacro and the
   * offline pool ever drew from, so a round of eight was eight model
   * requests for questions that already existed — and the mixed mode
   * made five such calls in sequence, which is why it felt slow.
   *
   * The bank is right for this mode in particular. A round is short
   * and the point is pace, not novelty, so meeting an item twice
   * costs a learner little; `draw` orders by `lastServedAt` so the
   * least recently seen come first. Entrenar still generates, where
   * novelty is the point.
   *
   * Generation is the fallback rather than the path, so a thin area
   * still fills a round instead of refusing it.
   */
  private async preguntasParaSeccion(section: {
    area: string;
    dificultad: string;
    n: number;
    tema?: string;
    plantilla?: string;
    userId?: string | null;
    excluir?: readonly string[];
  }) {
    let delBanco: Array<Record<string, unknown>> = [];
    try {
      delBanco = await this.banco.draw({
        area: section.area,
        dificultad: section.dificultad,
        limit: section.n,
        excludeIds: [...(section.excluir ?? [])],
      });
    } catch (e) {
      /* A bank failure must not stop someone from practising: the
         generator still answers. */
      this.log.warn(`Banco no disponible para ${section.area}: ${String(e)}`);
    }

    const reparto = repartirFuentes(section.n, delBanco.length);
    const usados = delBanco.slice(0, reparto.delBanco).map((i) => this.aItem(i));

    if (reparto.porGenerar === 0) {
      return { items: usados, requestId: null as string | null };
    }

    const generados = await this.generateForSection({
      ...section,
      n: reparto.porGenerar,
    });
    return {
      items: [...usados, ...generados.items],
      requestId: generados.requestId,
      error: generados.error,
    };
  }

  /**
   * A bank row in the shape the client reads.
   *
   * The same fields the offline pool sends (`lote-offline.service.ts`),
   * and the mobile schema already accepts them: `plantilla` is
   * optional there precisely so the two sources can mix.
   */
  private aItem(item: Record<string, unknown>) {
    return {
      id: String(item.id),
      area: item.area,
      dificultad: String(item.dificultad),
      contexto: (item.contexto as string | null) ?? null,
      pregunta: String(item.pregunta),
      opciones: item.opciones,
      respuesta_correcta: String(item.respuesta_correcta),
      justificacion: (item.justificacion as string | undefined) ?? undefined,
      explicaciones: (item.explicaciones as Record<string, string> | null) ?? null,
      distractores: (item.distractores as Record<string, string> | null) ?? null,
      figura: item.figura ?? null,
      tags: (item.tags as string[] | undefined) ?? undefined,
    };
  }

  private async generateForSection(section: {
    area: string;
    dificultad: string;
    n: number;
    tema?: string;
    plantilla?: string;
    userId?: string | null;
  }) {
    const requestId = nanoid();
    await this.persistence.createGenerationRequest({
      requestId,
      area: section.area as any,
      dificultad: section.dificultad as any,
      tema: section.tema,
      plantilla: section.plantilla,
      n: section.n,
    });

    const result = await this.generator.generate(
      {
        area: section.area,
        dificultad: section.dificultad,
        tema: section.tema,
        plantilla: section.plantilla,
        n: section.n,
      },
      requestId,
      section.userId,
    );

    if (result.items.length === 0) {
      await this.persistence.markGenerationError(
        requestId,
        result.parseError || 'No valid items generated',
        result.rawModelOutput,
      );
      return { items: [], requestId, error: result.parseError || 'No valid items generated' };
    }

    const guardados = await this.persistence.saveGeneratedItems({
      requestId,
      items: result.items,
      rawModelOutput: result.rawModelOutput,
      parseStatus: result.parseStatus,
      parseError: result.parseError,
    });

    /* Without the stored id the client cannot say which item it
       answered, so every contrarreloj answer was invisible to both the
       weakness profile and the item-quality numbers. */
    const conId = result.items.map((item, i) => ({ ...item, id: guardados[i]?.id }));
    return { items: conId, requestId };
  }

  async startTimeTrial(params: {
    userId: string;
    modeId?: string;
    custom?: {
      area: string;
      dificultad: string;
      timeLimitSeconds: number;
      questions: number;
    };
  }) {
    await this.ensureDefaultModes();

    let mode: any = null;
    let mix: Array<{ area: string; dificultad: string; n: number }> | null = null;
    let area: string | null = null;
    let dificultad: string | null = null;
    let timeLimitSeconds: number;
    let questions: number;

    if (params.modeId) {
      mode = await this.prisma.timeTrialMode.findUnique({ where: { id: params.modeId } });
      if (!mode || !mode.enabled) {
        return { ok: false, error: { code: 'MODE_NOT_FOUND', message: 'Mode not found.' } };
      }

      timeLimitSeconds = mode.timeLimitSeconds;
      questions = mode.questions;
      mix = (mode.mix as any) || null;
      area = mode.area || null;
      dificultad = mode.dificultad || null;
    } else if (params.custom) {
      timeLimitSeconds = params.custom.timeLimitSeconds;
      questions = params.custom.questions;
      area = params.custom.area;
      dificultad = params.custom.dificultad;
    } else {
      return { ok: false, error: { code: 'INVALID_REQUEST', message: 'modeId or custom is required.' } };
    }

    if (timeLimitSeconds < 60 || questions < 1) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid time limit or questions.' } };
    }

    const items: any[] = [];

    if (mix && mix.length > 0) {
      /* Carried across sections: the areas differ, but a bank draw is
         by area and difficulty, and without this two sections could
         serve the same row twice in one round. */
      const yaServidos: string[] = [];
      for (const section of mix) {
        const result = await this.preguntasParaSeccion({
          ...section,
          userId: params.userId,
          excluir: yaServidos,
        });
        if (result.items.length > 0) {
          items.push(...result.items);
          for (const item of result.items) yaServidos.push(String(item.id));
        }
      }
    } else {
      /* A mode that names no area aims at whatever this learner is
         weakest in. Drilling someone on what they already know is the
         most common way study time gets wasted, and the profile exists
         precisely to answer this question.

         A learner with too little history has no weakest area yet, so
         it falls back to the mode's own area, then to Matemáticas. */
      const objetivo =
        area ?? (await this.areaDebil(params.userId)) ?? 'MAT';
      const nivel = dificultad ?? 'media';
      const result = await this.preguntasParaSeccion({
        area: objetivo,
        dificultad: nivel,
        n: questions,
        tema: await this.temaDebil(params.userId, objetivo as Area),
        userId: params.userId,
      });
      if (result.items.length > 0) {
        items.push(...result.items);
      }
      area = objetivo;
      dificultad = nivel;
    }

    const session = await this.dashboardService.startTimeTrialSession({
      userId: params.userId,
      modeId: mode ? mode.id : null,
      timeLimitSeconds,
      questions,
      area: area || (mix && mix.length > 0 ? mix[0].area : 'MAT'),
      dificultad: dificultad || null,
      mix,
    });

    return {
      ok: true,
      data: {
        sessionId: session.sessionId,
        timeLimitSeconds,
        items,
      },
    };
  }

  /** The area this learner is weakest in, or null if we cannot tell. */
  private async areaDebil(userId: string): Promise<string | null> {
    try {
      return await this.debilidades.areaPrioritaria(userId);
    } catch {
      // A profile lookup must never stop someone from practising.
      return null;
    }
  }

  /**
   * The topic worth drilling inside that area.
   *
   * Returns undefined when the profile has too little to go on, which
   * leaves the generator free to pick — better than narrowing a new
   * learner onto a topic chosen from three answers.
   */
  private async temaDebil(userId: string, area: Area): Promise<string | undefined> {
    try {
      const temas = await this.debilidades.temasDebiles(userId, 1, area);
      return temas[0]?.tema.replace(/-/g, ' ');
    } catch {
      return undefined;
    }
  }
}
