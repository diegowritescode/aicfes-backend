import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { InformeService } from './informe.service';
import { SesionRequeridaGuard } from '../common/guards/sesion-requerida.guard';
import { CuotaGuard } from '../common/guards/cuota.guard';

/**
 * The weekly report.
 *
 * One route, and it is a GET that may write: the report for a week is
 * generated the first time somebody asks for it and read every time
 * after. A POST would be more honest about that and would make the
 * screen do two requests to show one card, which is the wrong trade —
 * `@@unique([userId, semanaInicio])` already makes the write happen
 * at most once per learner per week.
 *
 * `CuotaGuard` is on it because it can spend a model call. The guard
 * counts a body with no `n` as one question (~0,009 USD) and the
 * report costs about 0,0015 with `gpt-5-mini`, so the reservation is
 * conservative in the right direction.
 */
@Controller('informe-semanal')
@ApiTags('Informe')
export class InformeController {
  constructor(private readonly informe: InformeService) {}

  private pickString(value: unknown) {
    if (Array.isArray(value)) return value[0];
    return typeof value === 'string' ? value : undefined;
  }

  private getUserId(req: any) {
    // The token is the only trustworthy source. A header or body
    // field is supplied by the caller, so accepting either let anyone
    // read another learner's report.
    const candidato = this.pickString(req?.userId);
    return candidato && candidato.trim() ? candidato.trim() : null;
  }

  @Get()
  @UseGuards(SesionRequeridaGuard, CuotaGuard)
  @ApiOperation({ summary: 'El informe de esta semana, generándolo si falta' })
  @ApiResponse({
    status: 200,
    description:
      'El informe, o data: null cuando todavía no hay suficiente para escribir uno',
  })
  async deEstaSemana(@Req() req: any) {
    const userId = this.getUserId(req);
    if (!userId) {
      return {
        ok: false,
        error: { code: 'USER_ID_REQUIRED', message: 'Falta la sesión.' },
      };
    }

    const informe = await this.informe.informeDeEstaSemana(userId);

    /* `ok: true` with a null body, not a 404. A learner who has not
       answered enough questions yet is in a normal state, not an
       error one, and the screen says what is missing. A 404 here
       would show up in the client's failure path beside «no hay
       internet». */
    return { ok: true, data: informe };
  }
}
