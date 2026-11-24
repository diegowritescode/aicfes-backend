import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../../persistence/prisma.service';

/**
 * Who may read the moderation queue.
 *
 * Two ways in, and they are not interchangeable (ADR 34).
 *
 * **The role** is the everyday one. A moderator signs in like any
 * learner and the queue is simply there — nothing to paste, nothing
 * to keep on a phone that can be lost. It also records *who* acted,
 * which a shared secret cannot.
 *
 * **The secret** grants the role and nothing else. It stays on the
 * server, set over SSH like `OPENAI_API_KEY`. Keeping it out of daily
 * use is the point: the authority to moderate must not come from a
 * row that anyone with database access could write for themselves,
 * and the one endpoint that writes that row is the one it guards.
 *
 * Closed when neither applies, and closed when the secret is unset —
 * open-when-unset is the defect shape that leaks a queue of minors'
 * reports the first time someone deploys without the variable.
 */
@Injectable()
export class ModeracionGuard implements CanActivate {
  private readonly log = new Logger(ModeracionGuard.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const peticion = contexto.switchToHttp().getRequest();

    /* The role first: it is the path a moderator uses every day, and
       it costs one indexed lookup. */
    const userId = typeof peticion?.userId === 'string' ? peticion.userId.trim() : '';
    if (userId) {
      const usuario = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { esModerador: true },
      });
      if (usuario?.esModerador) {
        /* Recorded on the request so routes can say who acted. With a
           shared secret this was unknowable. */
        peticion.moderadorId = userId;
        return true;
      }
    }

    return this.secretoValido(peticion);
  }

  /**
   * Whether the request carries the server-side secret.
   *
   * Public to the module so `POST /moderacion/otorgar` can require it
   * specifically: granting the role is the one thing a role must not
   * authorise, or the first moderator could appoint everyone.
   */
  secretoValido(peticion: { headers?: Record<string, unknown> }): boolean {
    const esperado = this.config.get<string>('MODERACION_TOKEN');
    if (!esperado || esperado.trim().length === 0) {
      this.log.warn('MODERACION_TOKEN no está configurado: la cola queda cerrada.');
      return false;
    }

    const entregado = peticion?.headers?.['x-moderacion-token'];
    if (typeof entregado !== 'string' || entregado.length === 0) return false;

    /* Hashed to a fixed length before comparing, so `timingSafeEqual`
       never throws on a length mismatch — and so the comparison does
       not leak the secret's length either. */
    const a = createHash('sha256').update(entregado).digest();
    const b = createHash('sha256').update(esperado.trim()).digest();
    return timingSafeEqual(a, b);
  }
}

/**
 * The secret alone, for granting the role.
 *
 * Separate from the guard above because granting must *not* accept
 * the role: a moderator who could appoint other moderators turns one
 * compromised account into every account.
 */
@Injectable()
export class SoloSecretoGuard implements CanActivate {
  constructor(private readonly moderacion: ModeracionGuard) {}

  canActivate(contexto: ExecutionContext): boolean {
    return this.moderacion.secretoValido(contexto.switchToHttp().getRequest());
  }
}
