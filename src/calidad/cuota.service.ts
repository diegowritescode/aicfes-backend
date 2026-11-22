import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CostosService } from './costos.service';

/**
 * How much a learner may spend in a day.
 *
 * Until now nothing stopped anyone: a request may ask for up to
 * MAX_ITEMS questions, and nothing limited how many requests a single
 * account could make. At roughly a cent a question, a loop on a free
 * account drains the OpenAI balance, and the first sign of it would
 * have been the bill.
 *
 * The cap is money, not questions. Questions vary in cost by model, by
 * area and by how long the text is, so a cap of "50 questions a day"
 * prices one learner at five times another. Spend is what we actually
 * pay, so spend is what we limit.
 *
 * The day is UTC, and the window is calendar-based rather than rolling:
 * a learner who hits the cap knows it clears at midnight, instead of
 * trickling back in a way nobody can predict.
 */

export type Plan = 'gratis' | 'pago';

export interface EstadoCuota {
  readonly permitido: boolean;
  readonly plan: Plan;
  /** Dollars spent so far today. */
  readonly gastado: number;
  /** The day's allowance in dollars. */
  readonly tope: number;
  /** Dollars left; zero once the cap is reached. */
  readonly restante: number;
  /** When the allowance resets. */
  readonly reinicia: Date;
}

@Injectable()
export class CuotaService {
  private readonly log = new Logger(CuotaService.name);

  constructor(
    private readonly costos: CostosService,
    private readonly config: ConfigService,
  ) {}

  private tope(plan: Plan): number {
    /* Defaults, in dollars per day. The free tier is set near what a
       genuine study session costs — around twenty-five questions —
       rather than at a round number, so a real learner never meets it
       and a script does so within seconds. */
    const gratis = Number(this.config.get('CUOTA_DIARIA_GRATIS_USD') ?? 0.25);
    const pago = Number(this.config.get('CUOTA_DIARIA_PAGO_USD') ?? 3.0);
    const valor = plan === 'pago' ? pago : gratis;
    return Number.isFinite(valor) && valor > 0 ? valor : 0.25;
  }

  private inicioDelDia(ahora = new Date()): Date {
    return new Date(
      Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate()),
    );
  }

  private finDelDia(ahora = new Date()): Date {
    const inicio = this.inicioDelDia(ahora);
    return new Date(inicio.getTime() + 24 * 60 * 60 * 1000);
  }

  /** What this learner has spent today, and whether they may spend more. */
  async estado(userId: string, plan: Plan = 'gratis'): Promise<EstadoCuota> {
    const tope = this.tope(plan);
    const desde = this.inicioDelDia();

    let gastado = 0;
    try {
      ({ dolares: gastado } = await this.costos.costoUsuario(userId, desde));
    } catch (error) {
      /* If spend cannot be read we let the request through. A database
         hiccup should not lock every learner out of the product; the
         cap exists to stop runaway use, not to be a second gate on
         availability. The miss is bounded by one request. */
      this.log.warn(`No se pudo leer el gasto de ${userId}: ${error}`);
      return {
        permitido: true,
        plan,
        gastado: 0,
        tope,
        restante: tope,
        reinicia: this.finDelDia(),
      };
    }

    const restante = Math.max(0, tope - gastado);
    return {
      permitido: gastado < tope,
      plan,
      gastado,
      tope,
      restante,
      reinicia: this.finDelDia(),
    };
  }

  /**
   * Whether a request for `preguntas` items should start.
   *
   * The check is made before the work, on what has already been spent:
   * what this request will cost is not known until the models have
   * answered. A learner just under the cap may therefore overrun it by
   * one request, which is the price of not charging for work before
   * doing it. The overrun is bounded by MAX_ITEMS.
   */
  async puedeGenerar(
    userId: string,
    preguntas: number,
    plan: Plan = 'gratis',
  ): Promise<EstadoCuota> {
    const estado = await this.estado(userId, plan);
    if (!estado.permitido) return estado;

    /* A request big enough to blow through the whole allowance at once
       is refused even when the learner has spent nothing: without this
       a single call for a hundred questions clears the cap before the
       first check ever runs. */
    const costoEstimado = preguntas * this.costoPorPregunta();
    if (costoEstimado > estado.restante) {
      return { ...estado, permitido: false };
    }
    return estado;
  }

  /** Measured, not guessed: generation plus cross-model verification. */
  private costoPorPregunta(): number {
    const valor = Number(this.config.get('COSTO_ESTIMADO_PREGUNTA_USD') ?? 0.009);
    return Number.isFinite(valor) && valor > 0 ? valor : 0.009;
  }

  /** How many questions still fit in today's allowance. */
  preguntasRestantes(estado: EstadoCuota): number {
    return Math.max(0, Math.floor(estado.restante / this.costoPorPregunta()));
  }
}
