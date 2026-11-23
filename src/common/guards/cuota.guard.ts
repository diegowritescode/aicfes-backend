import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { CuotaService } from '../../calidad/cuota.service';

/**
 * Stops a learner once the day's allowance is spent.
 *
 * Runs after SesionRequeridaGuard, so req.userId is already known.
 *
 * The reply carries what was spent, the cap, and when it resets, so the
 * interface can say "vuelve mañana" with a time rather than failing
 * blankly. 429 rather than 403: this is a rate problem, and it clears
 * on its own.
 */
@Injectable()
export class CuotaGuard implements CanActivate {
  private readonly log = new Logger(CuotaGuard.name);

  constructor(private readonly cuota: CuotaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const userId = typeof req?.userId === 'string' ? req.userId.trim() : '';
    if (!userId) return true; // SesionRequeridaGuard owns this case.

    const pedidas = this.cuantasPide(req?.body);
    /* The plan decides the cap, and it is read rather than assumed.
       Before this, every call fell through to the `'gratis'` default
       and a paying learner got the free allowance. */
    const plan = await this.cuota.planDe(userId);
    const estado = await this.cuota.puedeGenerar(userId, pedidas, plan);

    if (!estado.permitido) {
      this.log.log(
        `Cuota agotada para ${userId}: ${estado.gastado.toFixed(4)} de ${estado.tope} USD`,
      );
      throw new HttpException(
        {
          ok: false,
          items: [],
          error: {
            code: 'CUOTA_AGOTADA',
            message:
              estado.gastado >= estado.tope
                ? 'Llegaste al límite de práctica de hoy. Mañana sigues.'
                : `Son demasiadas preguntas para lo que te queda hoy. Puedes pedir hasta ${this.cuota.preguntasRestantes(estado)}.`,
            restanteHoy: this.cuota.preguntasRestantes(estado),
            reinicia: estado.reinicia.toISOString(),
          },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  /**
   * How many questions this request asks for, across both shapes the
   * API accepts: `n` for a single area, or a list of sections.
   */
  private cuantasPide(body: unknown): number {
    if (!body || typeof body !== 'object') return 1;
    const cuerpo = body as Record<string, unknown>;

    if (Array.isArray(cuerpo.sections)) {
      const suma = cuerpo.sections.reduce((total: number, seccion: unknown) => {
        const n = Number((seccion as Record<string, unknown>)?.n);
        return total + (Number.isFinite(n) && n > 0 ? n : 0);
      }, 0);
      return Math.max(1, suma);
    }

    const n = Number(cuerpo.n);
    return Number.isFinite(n) && n > 0 ? n : 1;
  }
}
