import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FeedbackService } from './feedback.service';
import { FeedbackGenerateSchema } from './dto/feedback-generate.schema';
import { SesionRequeridaGuard } from '../common/guards/sesion-requerida.guard';
import { CuotaGuard } from '../common/guards/cuota.guard';

@Controller('feedback')
@ApiTags('Feedback')
export class FeedbackController {
  constructor(private feedbackService: FeedbackService) {}

  private pickString(value: unknown) {
    if (Array.isArray(value)) {
      return value[0];
    }

    return typeof value === 'string' ? value : undefined;
  }

  private getUserId(req: any) {
    // The token is the only trustworthy source. A header or body
    // field is supplied by the caller, so accepting either let
    // anyone read and write another learner's data.
    const candidate = this.pickString(req?.userId);
    return candidate && candidate.trim() ? candidate.trim() : null;
  }

  /* Writing a plan is a model request, so it is metered like any
     other. The twenty-minute cooldown only covers regenerating the
     same session: a caller that starts new sessions was buying
     unlimited model calls for free. */
  @Post('generate')
  @UseGuards(SesionRequeridaGuard, CuotaGuard)
  @ApiOperation({ summary: 'Generate feedback for a session' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['sessionId'],
      properties: {
        sessionId: { type: 'string' },
        mode: { type: 'string', enum: ['generacion_libre', 'contrarreloj', 'tecnica'] },
        focus: { type: 'string', enum: ['summary', 'strengths', 'weaknesses', 'plan'] },
        language: { type: 'string', default: 'es' },
        force: { type: 'boolean' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Feedback generated or cached.' })
  async generate(@Body() body: any, @Req() req: any) {
    const userId = this.getUserId(req);
    if (!userId) {
      return {
        ok: false,
        error: { code: 'USER_ID_REQUIRED', message: 'Send Authorization header or X-User-Id.' },
        meta: {},
      };
    }

    const parsed = FeedbackGenerateSchema.safeParse(body);
    if (!parsed.success) {
      return {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid payload.', details: parsed.error.errors },
        meta: { userId },
      };
    }

    const result = await this.feedbackService.generateFeedback(parsed.data, userId);
    if (!result) {
      return {
        ok: false,
        error: { code: 'SESSION_NOT_FOUND', message: 'Session not found.' },
        meta: { userId },
      };
    }

    if ((result as any).error) {
      return {
        ok: false,
        error: (result as any).error,
        meta: { userId },
      };
    }

    const cached = (result as any).cached;
    return {
      ok: true,
      data: (result as any).feedback,
      meta: { sessionId: parsed.data.sessionId, cached },
    };
  }

  @Get(':sessionId')
  @ApiOperation({ summary: 'Get feedback by session' })
  @ApiResponse({ status: 200, description: 'Feedback payload.' })
  async get(@Param('sessionId') sessionId: string, @Req() req: any) {
    const userId = this.getUserId(req);
    if (!userId) {
      return {
        ok: false,
        error: { code: 'USER_ID_REQUIRED', message: 'Send Authorization header or X-User-Id.' },
        meta: {},
      };
    }

    const feedback = await this.feedbackService.getFeedback(sessionId, userId);
    if (!feedback) {
      return {
        ok: false,
        error: { code: 'NOT_FOUND', message: 'No feedback available.' },
        meta: { sessionId },
      };
    }

    return {
      ok: true,
      data: feedback,
      meta: { sessionId, cached: true },
    };
  }

  @Post(':sessionId/regenerate')
  @UseGuards(SesionRequeridaGuard, CuotaGuard)
  @ApiOperation({ summary: 'Regenerate feedback' })
  @ApiResponse({ status: 200, description: 'Feedback regenerated.' })
  async regenerate(@Param('sessionId') sessionId: string, @Req() req: any) {
    const userId = this.getUserId(req);
    if (!userId) {
      return {
        ok: false,
        error: { code: 'USER_ID_REQUIRED', message: 'Send Authorization header or X-User-Id.' },
        meta: {},
      };
    }

    const result = await this.feedbackService.generateFeedback(
      {
        sessionId,
        force: true,
        language: 'es',
        focus: 'summary',
      },
      userId,
    );

    if (!result) {
      return {
        ok: false,
        error: { code: 'SESSION_NOT_FOUND', message: 'Session not found.' },
        meta: { sessionId },
      };
    }

    if ((result as any).error) {
      return {
        ok: false,
        error: (result as any).error,
        meta: { sessionId },
      };
    }

    return {
      ok: true,
      data: (result as any).feedback,
      meta: { sessionId, cached: (result as any).cached },
    };
  }
}
