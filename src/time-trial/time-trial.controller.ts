import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TimeTrialService } from './time-trial.service';
import { TimeTrialStartSchema } from './dto/time-trial-start.schema';

@Controller('time-trial')
@ApiTags('TimeTrial')
export class TimeTrialController {
  constructor(private timeTrialService: TimeTrialService) {}

  private pickString(value: unknown) {
    if (Array.isArray(value)) {
      return value[0];
    }

    return typeof value === 'string' ? value : undefined;
  }

  private getUserId(req: any, body?: any) {
    const tokenUserId = this.pickString(req?.userId);
    const headerId = this.pickString(req?.headers?.['x-user-id'] || req?.headers?.['x-userid']);
    const bodyId = this.pickString(body?.userId);
    const candidate = tokenUserId || headerId || bodyId;
    return candidate && candidate.trim() ? candidate.trim() : null;
  }

  @Get('modes')
  @ApiOperation({ summary: 'List time trial modes' })
  @ApiResponse({ status: 200, description: 'Available time trial modes.' })
  async listModes() {
    const data = await this.timeTrialService.listModes();
    return { ok: true, data, meta: {} };
  }

  @Post('start')
  @ApiOperation({ summary: 'Start time trial' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        modeId: { type: 'string' },
        custom: {
          type: 'object',
          properties: {
            area: { type: 'string', enum: ['MAT', 'LC', 'CN', 'SOC', 'ING'] },
            dificultad: { type: 'string', enum: ['facil', 'media', 'alta'] },
            timeLimitSeconds: { type: 'number' },
            questions: { type: 'number' },
          },
        },
      },
    },
  })
  async start(@Body() body: any, @Req() req: any) {
    const userId = this.getUserId(req, body);
    if (!userId) {
      return {
        ok: false,
        error: { code: 'USER_ID_REQUIRED', message: 'Send Authorization header or X-User-Id.' },
        meta: {},
      };
    }

    const parsed = TimeTrialStartSchema.safeParse(body);
    if (!parsed.success) {
      return {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid time trial payload.', details: parsed.error.errors },
        meta: { userId },
      };
    }

    if (!parsed.data.modeId && !parsed.data.custom) {
      return {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'modeId or custom is required.' },
        meta: { userId },
      };
    }

    const result = await this.timeTrialService.startTimeTrial({
      userId,
      modeId: parsed.data.modeId,
      custom: parsed.data.custom as
        | {
            area: string;
            dificultad: string;
            timeLimitSeconds: number;
            questions: number;
          }
        | undefined,
    });

    if (!result.ok) {
      return { ...result, meta: { userId } };
    }

    return { ok: true, data: result.data, meta: { userId } };
  }
}
