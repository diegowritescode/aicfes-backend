import { Injectable } from '@nestjs/common';
import { PrismaService } from '../persistence/prisma.service';
import { ItemGeneratorService } from '../items/services/item-generator.service';
import { PersistenceService } from '../persistence/persistence.service';
import { nanoid } from 'nanoid';
import { DashboardService } from '../dashboard/dashboard.service';
import { Area, Dificultad } from '@prisma/client';
import { MODOS, MODOS_RETIRADOS } from './modos';
import { DebilidadesService } from '../calidad/debilidades.service';

@Injectable()
export class TimeTrialService {
  constructor(
    private prisma: PrismaService,
    private generator: ItemGeneratorService,
    private persistence: PersistenceService,
    private dashboardService: DashboardService,
    private debilidades: DebilidadesService,
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
      for (const section of mix) {
        const result = await this.generateForSection({ ...section, userId: params.userId });
        if (result.items.length > 0) {
          items.push(...result.items);
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
      const result = await this.generateForSection({
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
