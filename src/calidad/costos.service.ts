import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../persistence/prisma.service';

/**
 * What each model request costs, and who it was for.
 *
 * Pricing a subscription needs the cost of serving one learner for a
 * month. Nothing recorded it, so any price would have been a guess —
 * and a subscription priced below its serving cost loses more money the
 * better it sells.
 *
 * Money is held in thousandths of a cent as integers. Floating point
 * drifts over millions of rows, and one request can cost a fraction of
 * a cent, so cents alone would round most of them to zero.
 */

/** US dollars per million tokens. */
interface Precio {
  readonly entrada: number;
  readonly salida: number;
}

const PRECIOS: Record<string, Precio> = {
  'gpt-5-mini': { entrada: 0.25, salida: 2.0 },
  'gpt-5': { entrada: 1.25, salida: 10.0 },
  'gpt-4o-mini': { entrada: 0.15, salida: 0.6 },
  'claude-opus-5-5': { entrada: 4.0, salida: 20.0 },
  'claude-sonnet-5-5': { entrada: 2.0, salida: 10.0 },
  'claude-haiku-5-5': { entrada: 0.1, salida: 0.5 },
  'text-embedding-3-small': { entrada: 0.02, salida: 0 },
};

/** Used when a model is not in the table, so cost is never silently zero. */
const PRECIO_DESCONOCIDO: Precio = { entrada: 5.0, salida: 20.0 };

export type Operacion = 'generar' | 'verificar' | 'embedding' | 'retroalimentacion';

@Injectable()
export class CostosService {
  private readonly log = new Logger(CostosService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Thousandths of a cent for a request, rounded up so it is never free. */
  static calcular(modelo: string, tokensEntrada: number, tokensSalida: number): number {
    const precio = PRECIOS[modelo] ?? PRECIO_DESCONOCIDO;
    const dolares =
      (tokensEntrada / 1_000_000) * precio.entrada + (tokensSalida / 1_000_000) * precio.salida;
    return Math.ceil(dolares * 100_000);
  }

  /**
   * Records one request. Never throws: a failure to write a cost row
   * must not fail the learner's request that produced it.
   */
  async registrar(params: {
    userId?: string | null;
    operacion: Operacion;
    modelo: string;
    tokensEntrada: number;
    tokensSalida: number;
    exito?: boolean;
  }): Promise<void> {
    try {
      await this.prisma.consumoLlm.create({
        data: {
          userId: params.userId ?? null,
          operacion: params.operacion,
          modelo: params.modelo,
          tokensEntrada: params.tokensEntrada,
          tokensSalida: params.tokensSalida,
          costoMilicent: CostosService.calcular(
            params.modelo,
            params.tokensEntrada,
            params.tokensSalida,
          ),
          exito: params.exito ?? true,
        },
      });
    } catch (error) {
      this.log.warn(`Could not record cost: ${error}`);
    }
  }

  /** What one learner has cost over a window, in US dollars. */
  async costoUsuario(userId: string, desde: Date): Promise<{ dolares: number; peticiones: number }> {
    const r = await this.prisma.consumoLlm.aggregate({
      where: { userId, createdAt: { gte: desde } },
      _sum: { costoMilicent: true },
      _count: { _all: true },
    });
    return {
      dolares: (r._sum.costoMilicent ?? 0) / 100_000,
      peticiones: r._count._all,
    };
  }

  /**
   * The number a price is set from: what the median learner costs, not
   * the mean. A handful of heavy users pull the mean far above what
   * most people actually cost.
   */
  async costoPorUsuario(desde: Date): Promise<{
    usuarios: number;
    medianaDolares: number;
    promedioDolares: number;
    p90Dolares: number;
    totalDolares: number;
  }> {
    const filas = await this.prisma.consumoLlm.groupBy({
      by: ['userId'],
      where: { userId: { not: null }, createdAt: { gte: desde } },
      _sum: { costoMilicent: true },
    });

    const costos = filas
      .map((f) => (f._sum.costoMilicent ?? 0) / 100_000)
      .sort((a, b) => a - b);

    if (costos.length === 0) {
      return { usuarios: 0, medianaDolares: 0, promedioDolares: 0, p90Dolares: 0, totalDolares: 0 };
    }

    const total = costos.reduce((s, c) => s + c, 0);
    const en = (q: number) => costos[Math.min(costos.length - 1, Math.floor(costos.length * q))] ?? 0;

    return {
      usuarios: costos.length,
      medianaDolares: en(0.5),
      promedioDolares: total / costos.length,
      p90Dolares: en(0.9),
      totalDolares: total,
    };
  }

  /** Where the money goes, by operation. */
  async porOperacion(desde: Date): Promise<Array<{ operacion: string; dolares: number; peticiones: number }>> {
    const filas = await this.prisma.consumoLlm.groupBy({
      by: ['operacion'],
      where: { createdAt: { gte: desde } },
      _sum: { costoMilicent: true },
      _count: { _all: true },
    });
    return filas
      .map((f) => ({
        operacion: f.operacion,
        dolares: (f._sum.costoMilicent ?? 0) / 100_000,
        peticiones: f._count._all,
      }))
      .sort((a, b) => b.dolares - a.dolares);
  }
}

export default CostosService;
