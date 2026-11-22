import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { TutoriaService } from './tutoria.service';
import { SesionRequeridaGuard } from '../common/guards/sesion-requerida.guard';
import { CuotaGuard } from '../common/guards/cuota.guard';

/**
 * The tutoring conversation for one wrong answer.
 *
 * Everything here is behind the session guard: a conversation belongs
 * to a learner, and the service keys every lookup on their id, so one
 * learner cannot read another's thread.
 */
@Controller('tutoria')
@UseGuards(SesionRequeridaGuard)
export class TutoriaController {
  constructor(private readonly tutoria: TutoriaService) {}

  private userId(req: { userId?: unknown }): string {
    return typeof req.userId === 'string' ? req.userId : '';
  }

  /** Opens or reopens the thread for an item the learner just failed. */
  @Post(':itemId/abrir')
  async abrir(
    @Param('itemId') itemId: string,
    @Body() body: { opcionElegida?: string },
    @Req() req: any,
  ) {
    const estado = await this.tutoria.abrir({
      userId: this.userId(req),
      itemId,
      opcionElegida: body?.opcionElegida ?? '',
    });
    if (!estado) {
      return { ok: false, error: { code: 'ITEM_NO_ENCONTRADO', message: 'No encontramos esa pregunta.' } };
    }
    return { ok: true, data: estado };
  }

  /* The defence now reaches a model — it is answered by something
     that has read it, rather than with a canned line written before
     the learner typed anything — so it is metered like any other turn. */
  @Post(':itemId/defensa')
  @UseGuards(CuotaGuard)
  async defensa(
    @Param('itemId') itemId: string,
    @Body() body: { defensa?: string },
    @Req() req: any,
  ) {
    const texto = (body?.defensa ?? '').trim();
    if (texto.length < 3) {
      return {
        ok: false,
        error: {
          code: 'DEFENSA_VACIA',
          message: 'Escriba por qué eligió esa opción, aunque sea en pocas palabras.',
        },
      };
    }
    const estado = await this.tutoria.defender({
      userId: this.userId(req),
      itemId,
      defensa: texto,
    });
    if (!estado) {
      return { ok: false, error: { code: 'TUTORIA_NO_ENCONTRADA', message: 'Abra la tutoría primero.' } };
    }
    return { ok: true, data: estado };
  }

  @Post(':itemId/mensaje')
  @UseGuards(CuotaGuard)
  async mensaje(
    @Param('itemId') itemId: string,
    @Body() body: { mensaje?: string },
    @Req() req: any,
  ) {
    const texto = (body?.mensaje ?? '').trim();
    if (texto.length < 1) {
      return { ok: false, error: { code: 'MENSAJE_VACIO', message: 'Escriba su pregunta.' } };
    }
    const estado = await this.tutoria.responder({
      userId: this.userId(req),
      itemId,
      mensaje: texto,
    });
    if (!estado) {
      return { ok: false, error: { code: 'TUTORIA_NO_ENCONTRADA', message: 'Abra la tutoría primero.' } };
    }
    return { ok: true, data: estado };
  }

  @Post(':itemId/resuelto')
  async resuelto(@Param('itemId') itemId: string, @Req() req: any) {
    await this.tutoria.resolver(this.userId(req), itemId);
    return { ok: true, data: { resuelto: true } };
  }

  @Get(':itemId')
  async leer(@Param('itemId') itemId: string, @Req() req: any) {
    const estado = await this.tutoria.abrir({
      userId: this.userId(req),
      itemId,
      opcionElegida: '',
    });
    if (!estado) {
      return { ok: false, error: { code: 'ITEM_NO_ENCONTRADO', message: 'No encontramos esa pregunta.' } };
    }
    return { ok: true, data: estado };
  }
}
