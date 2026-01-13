import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@Controller('health')
@ApiTags('Health')
export class HealthController {
  constructor(private config: ConfigService) {}

  @Get()
  @ApiOperation({
    summary: 'Verificar estado del servidor',
    description: 'Retorna el estado del servidor, modelo configurado y timestamp actual',
  })
  @ApiResponse({
    status: 200,
    description: 'Servidor operativo',
    schema: {
      type: 'object',
      properties: {
        ok: { type: 'boolean', example: true },
        model: { type: 'string', example: 'gpt-5-mini' },
        ts: { type: 'string', example: '2026-01-13T19:30:00.000Z' },
      },
    },
  })
  health() {
    return {
      ok: true,
      model: this.config.get('OPENAI_MODEL') || 'gpt-5-mini',
      ts: new Date().toISOString(),
    };
  }
}
