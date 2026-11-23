import { Body, Controller, Get, Param, Post, Query, Req, Res } from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { DashboardStreamService } from './dashboard-stream.service';
import { StudySessionSchema } from './dto/study-session.schema';
import { AnswerInput, AnswersPayloadSchema } from './dto/answers.schema';
import { CalidadService } from '../calidad/calidad.service';
import { DebilidadesService } from '../calidad/debilidades.service';
import { ErrorDelDiaService } from '../calidad/error-del-dia.service';
import { HeartbeatSchema } from './dto/heartbeat.schema';
import { StartSessionSchema } from './dto/start-session.schema';
import { CompleteSessionSchema } from './dto/complete-session.schema';
import { Response } from 'express';

@Controller()
@ApiTags('Dashboard')
export class DashboardController {
  constructor(
    private dashboardService: DashboardService,
    private dashboardStream: DashboardStreamService,
    private calidad: CalidadService,
    private debilidades: DebilidadesService,
    private errorDelDia: ErrorDelDiaService,
  ) {}

  private pickString(value: unknown) {
    if (Array.isArray(value)) {
      return value[0];
    }

    return typeof value === 'string' ? value : undefined;
  }

  private getUserId(req: any) {
    // The token is the only trustworthy source. A header, query or
    // body field is supplied by the caller, so accepting any of them
    // let anyone read and write another learner's data.
    const candidate = this.pickString(req?.userId);
    return candidate && candidate.trim() ? candidate.trim() : null;
  }

  @Get('dashboard')
  @ApiOperation({
    summary: 'Dashboard data',
    description: 'Returns all dashboard widgets in a single payload.',
  })
  @ApiQuery({
    name: 'userId',
    required: false,
    description: 'Fallback user ID when no auth is present.',
  })
  @ApiResponse({
    status: 200,
    description: 'Dashboard payload',
  })
  async getDashboard(@Req() req: any, @Query('userId') userIdQuery?: string) {
    const userId = this.getUserId(req);
    if (!userId) {
      return {
        ok: false,
        error: {
          code: 'USER_ID_REQUIRED',
          message: 'Inicia sesión: esta ruta requiere un token válido.',
        },
        meta: {},
      };
    }

    const result = await this.dashboardService.getDashboard(userId);

    return {
      ok: true,
      data: result.data,
      meta: {
        userId,
        cached: result.cached,
        cacheExpiresInSeconds: result.cacheExpiresInSeconds,
      },
    };
  }

  @Get('dashboard/stream')
  @ApiOperation({
    summary: 'Dashboard realtime stream (SSE)',
    description: 'Server-sent events stream with realtime dashboard updates.',
  })
  @ApiQuery({
    name: 'userId',
    required: false,
    description: 'Fallback user ID when no auth is present.',
  })
  async streamDashboard(
    @Req() req: any,
    @Res() res: Response,
    @Query('userId') userIdQuery?: string,
  ) {
    const userId = this.getUserId(req);
    if (!userId) {
      res.status(400).json({
        ok: false,
        error: {
          code: 'USER_ID_REQUIRED',
          message: 'Send Authorization header or X-User-Id.',
        },
        meta: {},
      });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    this.dashboardStream.addClient(userId, res);

    const initial = await this.dashboardService.getDashboard(userId);
    res.write(`event: dashboard:init\n`);
    res.write(`data: ${JSON.stringify(initial.data)}\n\n`);
  }

  @Post('study-sessions')
  @ApiOperation({
    summary: 'Create study session',
    description: 'Stores a study session summary and awards XP.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: [
        'mode',
        'area',
        'startedAt',
        'endedAt',
        'durationSeconds',
        'totalQuestions',
        'correctQuestions',
      ],
      properties: {
        userId: { type: 'string', description: 'Fallback user ID when no auth is present.' },
        timezone: { type: 'string', description: 'IANA timezone like America/Bogota.' },
        mode: { type: 'string', enum: ['generacion_libre', 'contrarreloj', 'test'] },
        area: { type: 'string', enum: ['MAT', 'LC', 'CN', 'SOC', 'ING'] },
        dificultad: { type: 'string', enum: ['facil', 'media', 'alta'] },
        tema: { type: 'string' },
        startedAt: { type: 'string', format: 'date-time' },
        endedAt: { type: 'string', format: 'date-time' },
        durationSeconds: { type: 'number' },
        totalQuestions: { type: 'number' },
        correctQuestions: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Study session stored.' })
  async createStudySession(@Body() body: any, @Req() req: any) {
    const userId = this.getUserId(req);
    if (!userId) {
      return {
        ok: false,
        error: {
          code: 'USER_ID_REQUIRED',
          message: 'Send X-User-Id header or userId in body.',
        },
        meta: {},
      };
    }

    const parsed = StudySessionSchema.safeParse(body);
    if (!parsed.success) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid study session payload.',
          details: parsed.error.errors,
        },
        meta: {
          userId,
        },
      };
    }

    const input = parsed.data;
    if (input.correctQuestions > input.totalQuestions) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'correctQuestions cannot exceed totalQuestions.',
        },
        meta: {
          userId,
        },
      };
    }

    const startedAt = new Date(input.startedAt);
    const endedAt = new Date(input.endedAt);
    if (endedAt.getTime() < startedAt.getTime()) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'endedAt must be after startedAt.',
        },
        meta: {
          userId,
        },
      };
    }

    const result = await this.dashboardService.createStudySession(userId, input);

    return {
      ok: true,
      data: result,
      meta: {
        userId,
      },
    };
  }

  @Post('study-sessions/start')
  @ApiOperation({
    summary: 'Start study session',
    description: 'Creates a session before the user finishes to enable heartbeats.',
  })
  @ApiResponse({ status: 200, description: 'Session started.' })
  async startSession(@Body() body: any, @Req() req: any) {
    const userId = this.getUserId(req);
    if (!userId) {
      return {
        ok: false,
        error: {
          code: 'USER_ID_REQUIRED',
          message: 'Send Authorization header or X-User-Id.',
        },
        meta: {},
      };
    }

    const parsed = StartSessionSchema.safeParse(body);
    if (!parsed.success) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid start session payload.',
          details: parsed.error.errors,
        },
        meta: { userId },
      };
    }

    const result = await this.dashboardService.startStudySession(userId, parsed.data);
    return {
      ok: true,
      data: result,
      meta: { userId },
    };
  }

  @Post('study-sessions/:sessionId/complete')
  @ApiOperation({
    summary: 'Complete study session',
    description: 'Finalizes a previously started session with results.',
  })
  @ApiResponse({ status: 200, description: 'Session completed.' })
  async completeSession(
    @Param('sessionId') sessionId: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    const userId = this.getUserId(req);
    if (!userId) {
      return {
        ok: false,
        error: {
          code: 'USER_ID_REQUIRED',
          message: 'Send Authorization header or X-User-Id.',
        },
        meta: {},
      };
    }

    const parsed = CompleteSessionSchema.safeParse(body);
    if (!parsed.success) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid complete session payload.',
          details: parsed.error.errors,
        },
        meta: { userId },
      };
    }

    if (parsed.data.correctQuestions > parsed.data.totalQuestions) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'correctQuestions cannot exceed totalQuestions.',
        },
        meta: { userId },
      };
    }

    if (parsed.data.areaSummary && parsed.data.areaSummary.length > 0) {
      let sumTotal = 0;
      let sumCorrect = 0;
      for (const entry of parsed.data.areaSummary) {
        if (entry.correctQuestions > entry.totalQuestions) {
          return {
            ok: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'areaSummary correctQuestions cannot exceed totalQuestions.',
            },
            meta: { userId },
          };
        }
        sumTotal += entry.totalQuestions;
        sumCorrect += entry.correctQuestions;
      }

      if (sumTotal <= 0) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'areaSummary totalQuestions must be > 0.',
          },
          meta: { userId },
        };
      }

      parsed.data.totalQuestions = sumTotal;
      parsed.data.correctQuestions = sumCorrect;
    }

    const result = await this.dashboardService.completeStudySession(userId, sessionId, parsed.data);
    if (!result) {
      return {
        ok: false,
        error: {
          code: 'SESSION_NOT_FOUND',
          message: 'Session not found for user.',
        },
        meta: { userId },
      };
    }

    return {
      ok: true,
      data: result,
      meta: { userId },
    };
  }

  /**
   * GET /api/error-del-dia
   *
   * One question taken from what this learner already got wrong. Its
   * own route rather than part of the dashboard payload: the card is
   * the least important thing on the page, and should never be what
   * makes the rest of it wait.
   */
  @Get('error-del-dia')
  async obtenerErrorDelDia(@Req() req: any) {
    const userId = this.getUserId(req);
    if (!userId) {
      return {
        ok: false,
        error: { code: 'USER_ID_REQUIRED', message: 'Inicia sesión para ver tu pregunta de hoy.' },
      };
    }

    const zona = typeof req.query?.timeZone === 'string' ? req.query.timeZone : 'UTC';
    const pregunta = await this.errorDelDia.paraHoy(userId, zona);
    return { ok: true, data: pregunta };
  }

  @Post('answers')
  @ApiOperation({
    summary: 'Create answers',
    description: 'Stores per-question answers for a session.',
  })
  @ApiBody({
    schema: {
      oneOf: [
        {
          type: 'array',
          items: {
            type: 'object',
            required: ['sessionId', 'questionIndex', 'isCorrect'],
            properties: {
              sessionId: { type: 'string' },
              questionIndex: { type: 'number' },
              selectedAnswer: { type: 'string' },
              isCorrect: { type: 'boolean' },
            },
          },
        },
        {
          type: 'object',
          required: ['answers'],
          properties: {
            userId: { type: 'string' },
            answers: {
              type: 'array',
              items: {
                type: 'object',
                required: ['sessionId', 'questionIndex', 'isCorrect'],
                properties: {
                  sessionId: { type: 'string' },
                  questionIndex: { type: 'number' },
                  selectedAnswer: { type: 'string' },
                  isCorrect: { type: 'boolean' },
                },
              },
            },
          },
        },
      ],
    },
  })
  @ApiResponse({ status: 200, description: 'Answers stored.' })
  async createAnswers(@Body() body: any, @Req() req: any, @Query('userId') userIdQuery?: string) {
    const parsed = AnswersPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid answers payload.',
          details: parsed.error.errors,
        },
        meta: {},
      };
    }

    const payload = parsed.data as any;
    const answers = (Array.isArray(payload) ? payload : payload.answers) as AnswerInput[];
    const userId = this.getUserId(req);

    if (!userId) {
      return {
        ok: false,
        error: {
          code: 'USER_ID_REQUIRED',
          message: 'Inicia sesión: esta ruta requiere un token válido.',
        },
        meta: {},
      };
    }

    // How each item performs is what tells a badly written question from
    // a hard one, and it can only be learned from real answers. Recorded
    // alongside the answer rather than instead of it: a failure here
    // must not cost the learner their progress.
    const conItem = answers.filter(
      (a) => typeof a.itemId === 'string' && a.itemId.length > 0,
    );
    void Promise.all([
      ...conItem.map((a) =>
        this.calidad.registrarRespuesta({
          itemId: a.itemId as string,
          opcionElegida: a.selectedAnswer ?? '',
          correcta: a.isCorrect,
          tiempoMs: a.tiempoMs ?? 0,
        }),
      ),
      // The same answers, read the other way round: item quality asks
      // whether the question is any good, the weakness profile asks
      // what this learner keeps getting wrong.
      ...conItem.map((a) =>
        this.debilidades.registrar({
          userId,
          itemId: a.itemId as string,
          opcionElegida: a.selectedAnswer ?? '',
          correcta: a.isCorrect,
        }),
      ),
    ]).catch((error) => console.warn('No se pudo registrar la calidad:', error));

    const sessionIds: string[] = Array.from(
      new Set(
        answers
          .map((answer) => (typeof answer.sessionId === 'string' ? answer.sessionId : ''))
          .filter((sessionId) => sessionId.length > 0),
      ),
    );
    const invalidSessionIds = await this.dashboardService.validateSessionOwnership(userId, sessionIds);
    if (invalidSessionIds.length > 0) {
      return {
        ok: false,
        error: {
          code: 'INVALID_SESSION',
          message: 'One or more sessions do not belong to the user.',
          details: invalidSessionIds,
        },
        meta: {
          userId,
        },
      };
    }

    const result = await this.dashboardService.createAnswers(userId, answers);

    return {
      ok: true,
      data: result,
      meta: {
        userId,
      },
    };
  }

  @Post('study-sessions/:sessionId/heartbeat')
  @ApiOperation({
    summary: 'Heartbeat update for a study session',
    description: 'Updates elapsed time to prevent losing time if the user exits early.',
  })
  @ApiResponse({ status: 200, description: 'Heartbeat stored.' })
  async heartbeat(
    @Param('sessionId') sessionId: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    const userId = this.getUserId(req);
    if (!userId) {
      return {
        ok: false,
        error: {
          code: 'USER_ID_REQUIRED',
          message: 'Send Authorization header or X-User-Id.',
        },
        meta: {},
      };
    }

    const parsed = HeartbeatSchema.safeParse(body);
    if (!parsed.success) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid heartbeat payload.',
          details: parsed.error.errors,
        },
        meta: { userId },
      };
    }

    const result = await this.dashboardService.recordHeartbeat({
      userId,
      sessionId,
      elapsedSeconds: parsed.data.elapsedSeconds,
      endedAt: parsed.data.endedAt,
    });

    if (!result) {
      return {
        ok: false,
        error: {
          code: 'SESSION_NOT_FOUND',
          message: 'Session not found for user.',
        },
        meta: { userId },
      };
    }

    return {
      ok: true,
      data: result,
      meta: { userId },
    };
  }

  /**
   * GET /api/xp-desglose
   *
   * Where this learner's XP came from. The ledger has recorded a
   * reason for every award since it was built and nothing ever showed
   * it, so the app displayed a total with no explanation — a reward
   * rather than feedback, which is the distinction that decides
   * whether the number helps or hurts.
   *
   * Grouped by source rather than listed: a learner wants to know that
   * most of their XP came from getting things right, not to scroll two
   * hundred rows.
   */
  @Get('xp-desglose')
  @ApiOperation({ summary: 'De dónde viene el XP del estudiante' })
  @ApiResponse({ status: 200, description: 'XP agrupado por su origen.' })
  async getXpDesglose(@Req() req: any) {
    const userId = this.getUserId(req);
    if (!userId) {
      return {
        ok: false,
        error: { code: 'USER_ID_REQUIRED', message: 'Inicia sesión.' },
        meta: {},
      };
    }

    const { filas, frase, eventos } = await this.dashboardService.getXpDesglose(userId);

    return { ok: true, data: { filas, frase }, meta: { eventos } };
  }

  @Get('achievements')
  @ApiOperation({ summary: 'Achievements list' })
  @ApiResponse({ status: 200, description: 'Achievements and progress.' })
  async getAchievements(@Req() req: any, @Query('userId') userIdQuery?: string) {
    const userId = this.getUserId(req);
    if (!userId) {
      return {
        ok: false,
        error: {
          code: 'USER_ID_REQUIRED',
          message: 'Send Authorization header or X-User-Id.',
        },
        meta: {},
      };
    }

    const achievements = await this.dashboardService.getAchievements(userId);
    return {
      ok: true,
      data: achievements,
      meta: { userId },
    };
  }

  @Get('dashboard/advanced')
  @ApiOperation({ summary: 'Advanced dashboard metrics' })
  @ApiResponse({ status: 200, description: 'Advanced metrics for trends and difficulty.' })
  async getAdvanced(@Req() req: any, @Query('userId') userIdQuery?: string) {
    const userId = this.getUserId(req);
    if (!userId) {
      return {
        ok: false,
        error: {
          code: 'USER_ID_REQUIRED',
          message: 'Send Authorization header or X-User-Id.',
        },
        meta: {},
      };
    }

    const data = await this.dashboardService.getAdvancedDashboard(userId);
    return {
      ok: true,
      data,
      meta: { userId },
    };
  }

  @Get('dashboard/debug')
  @ApiOperation({ summary: 'Dashboard debug payload' })
  @ApiResponse({ status: 200, description: 'Debug payload for dashboard calculations.' })
  async getDebug(@Req() req: any, @Query('userId') userIdQuery?: string) {
    const userId = this.getUserId(req);
    if (!userId) {
      return {
        ok: false,
        error: {
          code: 'USER_ID_REQUIRED',
          message: 'Send Authorization header or X-User-Id.',
        },
        meta: {},
      };
    }

    const data = await this.dashboardService.getDashboardDebug(userId);
    return {
      ok: true,
      data,
      meta: { userId },
    };
  }
}
