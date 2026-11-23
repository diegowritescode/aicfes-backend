import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Who may read the moderation queue.
 *
 * A shared secret in the environment rather than a role on `User`,
 * for one reason: there is no administration interface and no second
 * person. A `role` column would be a permission system built for a
 * team that does not exist, and the row granting it would live in the
 * same database the moderator is moderating.
 *
 * The secret is set on the server over SSH, like `OPENAI_API_KEY`, so
 * it never passes through anything else.
 *
 * **Closed by default.** With no `MODERACION_TOKEN` configured the
 * routes refuse everyone. The alternative — open when unset — is the
 * shape of defect that leaks a queue of minors' reports, and it would
 * do so silently.
 */
@Injectable()
export class ModeracionGuard implements CanActivate {
  private readonly log = new Logger(ModeracionGuard.name);

  constructor(private readonly config: ConfigService) {}

  canActivate(contexto: ExecutionContext): boolean {
    const esperado = this.config.get<string>('MODERACION_TOKEN');
    if (!esperado || esperado.trim().length === 0) {
      this.log.warn('MODERACION_TOKEN no está configurado: la cola queda cerrada.');
      return false;
    }

    const peticion = contexto.switchToHttp().getRequest();
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
