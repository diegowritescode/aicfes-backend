import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SesionRequeridaGuard } from '../common/guards/sesion-requerida.guard';
import { DuelosService } from './duelos.service';
import { AmigosService } from './amigos.service';
import {
  buscableSchema,
  buscarSchema,
  denunciarSchema,
  entregarSchema,
  ponerAliasSchema,
  retarSchema,
} from './dto/duelos.schema';

/**
 * Duels, aliases and the moderation that alias search requires.
 *
 * Every route needs a session. There is no public surface here: an
 * unauthenticated alias search would be a way to enumerate a user base
 * of minors.
 *
 * Moderation lives in this controller rather than its own module
 * because it is not a separate feature. Alias search is what creates
 * the need to block and report, and splitting them would make it
 * possible to ship the search without them.
 */
@ApiTags('duelos')
@Controller('duelos')
@UseGuards(SesionRequeridaGuard)
export class DuelosController {
  constructor(
    private readonly duelos: DuelosService,
    private readonly amigos: AmigosService,
  ) {}

  /** The token is the only trustworthy source of identity. */
  private userId(req: any): string {
    const bruto = req?.userId;
    return typeof bruto === 'string' ? bruto.trim() : '';
  }

  private invalido(mensaje: string) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: mensaje } };
  }

  @Get('perfil')
  @ApiOperation({ summary: 'Mi alias y si aparezco en búsquedas' })
  async perfil(@Req() req: any) {
    return this.duelos.miPerfil(this.userId(req));
  }

  @Post('alias')
  @ApiOperation({ summary: 'Escoger o cambiar mi alias' })
  async alias(@Req() req: any, @Body() body: unknown) {
    const parsed = ponerAliasSchema.safeParse(body);
    if (!parsed.success) return this.invalido('Escriba un nombre.');
    return this.duelos.ponerAlias(this.userId(req), parsed.data.alias);
  }

  @Post('buscable')
  @ApiOperation({ summary: 'Aparecer o no en las búsquedas de otros' })
  async buscable(@Req() req: any, @Body() body: unknown) {
    const parsed = buscableSchema.safeParse(body);
    if (!parsed.success) return this.invalido('Falta el valor.');
    return this.duelos.cambiarBuscable(this.userId(req), parsed.data.buscable);
  }

  /**
   * Records the guardian's authorisation.
   *
   * Self-declared, which is what an app can do. Ley 1581 de 2012
   * requires it to process a minor's personal data; verifying it is a
   * problem no mobile form solves. What matters is that it is
   * explicit, dated, and that nothing social works without it.
   */
  @Post('autorizacion-tutor')
  @ApiOperation({ summary: 'Declarar que mi acudiente autorizó la cuenta' })
  async autorizacion(@Req() req: any) {
    return this.duelos.registrarAutorizacionDeTutor(this.userId(req));
  }

  @Get('buscar')
  @ApiOperation({ summary: 'Buscar a alguien por su alias' })
  async buscar(@Req() req: any, @Query() query: unknown) {
    const parsed = buscarSchema.safeParse(query);
    /* A short term returns nothing rather than an error: someone is
       mid-typing, and an error on the second keystroke reads as a
       broken screen. */
    if (!parsed.success) return { ok: true, data: [] };
    return this.duelos.buscar(this.userId(req), parsed.data.q);
  }

  @Post('retar')
  @ApiOperation({ summary: 'Retar a alguien a un duelo' })
  async retar(@Req() req: any, @Body() body: unknown) {
    const parsed = retarSchema.safeParse(body);
    if (!parsed.success) return this.invalido('Falta a quién retar.');
    return this.duelos.retar(this.userId(req), parsed.data.rivalId);
  }

  @Get()
  @ApiOperation({ summary: 'Mis duelos' })
  async mios(@Req() req: any) {
    return this.duelos.mios(this.userId(req));
  }

  @Post(':id/aceptar')
  @ApiOperation({ summary: 'Aceptar un reto' })
  async aceptar(@Req() req: any, @Param('id') id: string) {
    return this.duelos.aceptar(this.userId(req), id);
  }

  @Post(':id/rechazar')
  @ApiOperation({ summary: 'Rechazar un reto' })
  async rechazar(@Req() req: any, @Param('id') id: string) {
    return this.duelos.rechazar(this.userId(req), id);
  }

  @Get(':id/preguntas')
  @ApiOperation({ summary: 'Las preguntas del duelo, sin las respuestas' })
  async preguntas(@Req() req: any, @Param('id') id: string) {
    return this.duelos.preguntas(this.userId(req), id);
  }

  @Post(':id/entregar')
  @ApiOperation({ summary: 'Entregar mi ronda del duelo' })
  async entregar(@Req() req: any, @Param('id') id: string, @Body() body: unknown) {
    const parsed = entregarSchema.safeParse(body);
    if (!parsed.success) return this.invalido('Respuestas inválidas.');
    return this.duelos.entregar({
      userId: this.userId(req),
      dueloId: id,
      /* Mapped rather than passed through: Zod's inferred type marks
         the fields optional here, and the service's contract does
         not. Spelling them out is also the clearer statement of what
         crosses into the grading path. */
      respuestas: parsed.data.respuestas.map((r) => ({
        itemId: String(r.itemId),
        eleccion: String(r.eleccion),
      })),
      segundos: parsed.data.segundos,
    });
  }

  /**
   * The people this learner duels often.
   *
   * Above the blocked list on purpose: both are lists of people, and
   * the friendly one is the one opened daily.
   */
  @Get('amigos')
  @ApiOperation({ summary: 'Mis amigos y las solicitudes pendientes' })
  async amigosMios(@Req() req: any) {
    return this.amigos.mios(this.userId(req));
  }

  @Post('amigos/:id')
  @ApiOperation({ summary: 'Pedirle a alguien ser amigos' })
  async pedirAmistad(@Req() req: any, @Param('id') id: string) {
    return this.amigos.pedir(this.userId(req), id);
  }

  @Post('amigos/solicitud/:id/aceptar')
  @ApiOperation({ summary: 'Aceptar una solicitud' })
  async aceptarAmistad(@Req() req: any, @Param('id') id: string) {
    return this.amigos.responder(this.userId(req), id, true);
  }

  @Post('amigos/solicitud/:id/rechazar')
  @ApiOperation({ summary: 'Rechazar una solicitud' })
  async rechazarAmistad(@Req() req: any, @Param('id') id: string) {
    return this.amigos.responder(this.userId(req), id, false);
  }

  @Delete('amigos/:id')
  @ApiOperation({ summary: 'Quitar a alguien de mis amigos' })
  async quitarAmigo(@Req() req: any, @Param('id') id: string) {
    return this.amigos.quitar(this.userId(req), id);
  }

  @Get('bloqueados')
  @ApiOperation({ summary: 'A quiénes he bloqueado' })
  async bloqueados(@Req() req: any) {
    return this.duelos.bloqueados(this.userId(req));
  }

  @Post('bloquear/:id')
  @ApiOperation({ summary: 'Bloquear a alguien' })
  async bloquear(@Req() req: any, @Param('id') id: string) {
    return this.duelos.bloquear(this.userId(req), id);
  }

  @Delete('bloquear/:id')
  @ApiOperation({ summary: 'Desbloquear a alguien' })
  async desbloquear(@Req() req: any, @Param('id') id: string) {
    return this.duelos.desbloquear(this.userId(req), id);
  }

  @Post('denunciar')
  @ApiOperation({ summary: 'Denunciar a alguien. Bloquea de inmediato.' })
  async denunciar(@Req() req: any, @Body() body: unknown) {
    const parsed = denunciarSchema.safeParse(body);
    if (!parsed.success) return this.invalido('Falta a quién denunciar y por qué.');
    return this.duelos.denunciar({
      userId: this.userId(req),
      denunciadoId: parsed.data.denunciadoId,
      motivo: parsed.data.motivo,
      detalle: parsed.data.detalle,
    });
  }
}
