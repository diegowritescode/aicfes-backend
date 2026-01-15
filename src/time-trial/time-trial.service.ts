import { Injectable } from '@nestjs/common';
import { PrismaService } from '../persistence/prisma.service';
import { ItemGeneratorService } from '../items/services/item-generator.service';
import { PersistenceService } from '../persistence/persistence.service';
import { nanoid } from 'nanoid';
import { DashboardService } from '../dashboard/dashboard.service';
import { Area, Dificultad } from '@prisma/client';

const DEFAULT_MODES = [
  {
    id: 'sprint_10',
    title: 'Sprint 10',
    description: '10 preguntas mixtas en 10 minutos',
    timeLimitSeconds: 600,
    questions: 10,
    mix: [
      { area: 'MAT', dificultad: 'media', n: 2 },
      { area: 'LC', dificultad: 'media', n: 3 },
      { area: 'CN', dificultad: 'media', n: 2 },
      { area: 'SOC', dificultad: 'media', n: 2 },
      { area: 'ING', dificultad: 'media', n: 1 },
    ],
  },
  {
    id: 'reto_5',
    title: 'Reto 5',
    description: '5 preguntas de area objetivo en 5 minutos',
    timeLimitSeconds: 300,
    questions: 5,
    area: 'MAT',
    dificultad: 'media',
  },
  {
    id: 'explosivo',
    title: 'Explosivo',
    description: '3 preguntas dificiles en 3 minutos',
    timeLimitSeconds: 180,
    questions: 3,
    area: 'LC',
    dificultad: 'alta',
  },
];

@Injectable()
export class TimeTrialService {
  constructor(
    private prisma: PrismaService,
    private generator: ItemGeneratorService,
    private persistence: PersistenceService,
    private dashboardService: DashboardService,
  ) {}

  async listModes() {
    await this.ensureDefaultModes();
    return this.prisma.timeTrialMode.findMany({ where: { enabled: true } });
  }

  private async ensureDefaultModes() {
    await Promise.all(
      DEFAULT_MODES.map((mode) =>
        this.prisma.timeTrialMode.upsert({
          where: { id: mode.id },
          update: {
            title: mode.title,
            description: mode.description,
            timeLimitSeconds: mode.timeLimitSeconds,
            questions: mode.questions,
            area: (mode.area as Area) || null,
            dificultad: (mode.dificultad as Dificultad) || null,
            mix: (mode as any).mix || null,
            enabled: true,
          },
          create: {
            id: mode.id,
            title: mode.title,
            description: mode.description,
            timeLimitSeconds: mode.timeLimitSeconds,
            questions: mode.questions,
            area: (mode.area as Area) || null,
            dificultad: (mode.dificultad as Dificultad) || null,
            mix: (mode as any).mix || null,
            enabled: true,
          },
        }),
      ),
    );
  }

  private async generateForSection(section: {
    area: string;
    dificultad: string;
    n: number;
    tema?: string;
    plantilla?: string;
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
    );

    if (result.items.length === 0) {
      await this.persistence.markGenerationError(
        requestId,
        result.parseError || 'No valid items generated',
        result.rawModelOutput,
      );
      return { items: [], requestId, error: result.parseError || 'No valid items generated' };
    }

    await this.persistence.saveGeneratedItems({
      requestId,
      items: result.items,
      rawModelOutput: result.rawModelOutput,
      parseStatus: result.parseStatus,
      parseError: result.parseError,
    });

    return { items: result.items, requestId };
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
        const result = await this.generateForSection(section);
        if (result.items.length > 0) {
          items.push(...result.items);
        }
      }
    } else if (area && dificultad) {
      const result = await this.generateForSection({ area, dificultad, n: questions });
      if (result.items.length > 0) {
        items.push(...result.items);
      }
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
}
