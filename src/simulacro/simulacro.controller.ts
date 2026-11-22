import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { SimulacroService } from './simulacro.service';
import { EXAM_BLUEPRINT, TOTAL_QUESTIONS, minutesFor, scaleBlueprint } from './exam-blueprint';

const StartSchema = z.object({
  totalPreguntas: z.number().int().min(5).max(254).default(50),
});

const AnswerSchema = z.object({
  orden: z.number().int().min(0),
  respuesta: z.enum(['A', 'B', 'C', 'D']),
});

const MarcarSchema = z.object({
  orden: z.number().int().min(0),
  marcada: z.boolean(),
});

@Controller('simulacro')
@ApiTags('Simulacro')
export class SimulacroController {
  constructor(private readonly simulacro: SimulacroService) {}

  /**
   * The identity comes from the verified token only. Other controllers
   * here also accept a userId from the body or a header, which lets a
   * caller act as anyone; this one does not.
   */
  private requireUserId(req: { userId?: unknown }): string {
    const id = typeof req?.userId === 'string' ? req.userId.trim() : '';
    if (!id) throw new UnauthorizedException('Se requiere iniciar sesión');
    return id;
  }

  @Get('blueprint')
  @ApiOperation({ summary: 'The real exam structure, and how a sitting scales to it' })
  @ApiResponse({ status: 200, description: 'Areas, question counts and timing.' })
  blueprint() {
    return {
      ok: true,
      data: {
        real: {
          areas: EXAM_BLUEPRINT,
          totalPreguntas: TOTAL_QUESTIONS,
          minutos: minutesFor(TOTAL_QUESTIONS),
        },
        ejemplos: [25, 50, 100].map((n) => ({
          totalPreguntas: n,
          minutos: minutesFor(n),
          areas: scaleBlueprint(n),
        })),
      },
    };
  }

  @Post('start')
  @ApiOperation({ summary: 'Start a sitting drawn from the verified bank' })
  @ApiResponse({ status: 201, description: 'The sitting and its questions, in order.' })
  @ApiResponse({ status: 400, description: 'The bank lacks verified items for some area.' })
  async start(@Body() body: unknown, @Req() req: { userId?: unknown }) {
    const userId = this.requireUserId(req);
    const { totalPreguntas } = StartSchema.parse(body ?? {});
    const sitting = await this.simulacro.start(userId, totalPreguntas);
    return { ok: true, data: sitting };
  }

  @Post(':id/answer')
  @ApiOperation({ summary: 'Record an answer' })
  async answer(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: { userId?: unknown },
  ) {
    const userId = this.requireUserId(req);
    const { orden, respuesta } = AnswerSchema.parse(body);
    const saved = await this.simulacro.answer(id, userId, orden, respuesta);
    // The verdict is deliberately withheld until the sitting is graded,
    // as in the real exam.
    return { ok: true, data: { orden: saved.orden, registrada: true } };
  }

  @Post(':id/finish')
  @ApiOperation({ summary: 'Grade the sitting and return the report' })
  async finish(@Param('id') id: string, @Req() req: { userId?: unknown }) {
    const userId = this.requireUserId(req);
    const graded = await this.simulacro.finish(id, userId);
    return { ok: true, data: graded };
  }

  @Post(':id/marcar')
  @ApiOperation({ summary: 'Flag a question to come back to' })
  async marcar(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: { userId?: unknown },
  ) {
    const userId = this.requireUserId(req);
    const { orden, marcada } = MarcarSchema.parse(body);
    return { ok: true, data: await this.simulacro.marcar(id, userId, orden, marcada) };
  }

  /**
   * The sitting as the learner may see it: questions in order, their
   * current choices, and the time left by the server's clock.
   *
   * This is what a reload or a reconnect asks for. It never carries the
   * correct answers — the service selects around them.
   */
  @Get(':id')
  @ApiOperation({ summary: 'Read a sitting, with its questions and time left' })
  async get(@Param('id') id: string, @Req() req: { userId?: unknown }) {
    const userId = this.requireUserId(req);
    return { ok: true, data: await this.simulacro.estado(id, userId) };
  }

  @Get()
  @ApiOperation({ summary: 'List the learner\'s sittings' })
  async list(@Req() req: { userId?: unknown }) {
    const userId = this.requireUserId(req);
    return { ok: true, data: await this.simulacro.list(userId) };
  }
}

export default SimulacroController;
