import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiExcludeController, ApiOperation } from '@nestjs/swagger';
import { z } from 'zod';
import { ModeracionGuard, SoloSecretoGuard } from '../common/guards/moderacion.guard';
import { ModeracionService } from './moderacion.service';

const resolverSchema = z.object({
  estado: z.enum(['revisada', 'descartada']),
});

const otorgarSchema = z.object({
  email: z.string().email().max(200),
});

/**
 * The moderation queue.
 *
 * Behind a shared secret set on the server, not a session: there is no
 * administration interface and no second person yet, and a `role`
 * column would live in the same database being moderated.
 *
 * Hidden from the public API documentation. The routes are guarded, so
 * this is not the protection — it is that a documented queue of
 * minors' reports invites the attempt.
 */
@ApiExcludeController()
@Controller('moderacion')
@UseGuards(ModeracionGuard)
export class ModeracionController {
  constructor(private readonly moderacion: ModeracionService) {}

  /**
   * Grants the moderator role.
   *
   * `SoloSecretoGuard`, not the ordinary one: this is the single
   * route a moderator must not be able to call. Otherwise the first
   * moderator can appoint the second, and one compromised account
   * becomes all of them.
   */
  @Post('otorgar')
  @UseGuards(SoloSecretoGuard)
  @ApiOperation({ summary: 'Dar el rol de moderador a una cuenta' })
  async otorgar(@Body() body: unknown) {
    const parsed = otorgarSchema.safeParse(body);
    if (!parsed.success) {
      return {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'Falta el correo.' },
      };
    }
    return this.moderacion.otorgarRol(parsed.data.email);
  }

  @Post('quitar')
  @UseGuards(SoloSecretoGuard)
  @ApiOperation({ summary: 'Quitar el rol de moderador' })
  async quitar(@Body() body: unknown) {
    const parsed = otorgarSchema.safeParse(body);
    if (!parsed.success) {
      return {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'Falta el correo.' },
      };
    }
    return this.moderacion.quitarRol(parsed.data.email);
  }

  @Get('moderadores')
  @UseGuards(SoloSecretoGuard)
  @ApiOperation({ summary: 'Quiénes moderan, y desde cuándo' })
  async moderadores() {
    return this.moderacion.moderadores();
  }

  /** How many reports are waiting, and how long the oldest has waited. */
  @Get('pendientes')
  @ApiOperation({ summary: 'Cuántas denuncias esperan' })
  async pendientes() {
    return this.moderacion.pendientes();
  }

  @Get('cola')
  @ApiOperation({ summary: 'Denuncias abiertas, la más vieja primero' })
  async cola(@Query('limite') limiteStr?: string) {
    const pedido = Number(limiteStr);
    return this.moderacion.cola(Number.isFinite(pedido) && pedido > 0 ? pedido : undefined);
  }

  @Get('cuenta/:id')
  @ApiOperation({ summary: 'Todo lo denunciado sobre una cuenta' })
  async cuenta(@Param('id') id: string) {
    return this.moderacion.historialDe(id);
  }

  @Post('denuncia/:id/resolver')
  @ApiOperation({ summary: 'Cerrar una denuncia como revisada o descartada' })
  async resolver(@Param('id') id: string, @Body() body: unknown) {
    const parsed = resolverSchema.safeParse(body);
    if (!parsed.success) {
      return {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'estado debe ser revisada o descartada.' },
      };
    }
    return this.moderacion.resolver({ id, estado: parsed.data.estado });
  }

  /**
   * Takes an account out of search and cancels its open duels.
   *
   * Nothing is deleted. A minor keeps their account, their history and
   * their alias; they stop being findable, which stops the harassment
   * because every duel starts with a search.
   */
  @Post('cuenta/:id/retirar-de-busqueda')
  @ApiOperation({ summary: 'Sacar una cuenta de las búsquedas' })
  async retirar(@Param('id') id: string) {
    return this.moderacion.retirarDeBusqueda(id);
  }
}
