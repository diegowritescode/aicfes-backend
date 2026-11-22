import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../persistence/prisma.service';
import { DebilidadesService } from './debilidades.service';

/**
 * One question a day, taken from what this learner already got wrong.
 *
 * Thirty seconds is the cheapest habit there is to keep, and not
 * repeating your own mistake is exactly what the exam rewards. It is
 * also the only feature here that costs nothing to run: the question
 * already exists, already has its explanation, and was already paid
 * for when it was generated.
 *
 * Preference order, cheapest and sharpest first:
 *
 *  1. A question they failed and have not since got right. The actual
 *     mistake, not an approximation of it.
 *  2. Failing that, any question from their weakest topic.
 *  3. Failing that, nothing. A learner with no history is shown their
 *     first session instead, which is more useful than a question
 *     picked at random and called personal.
 */

/** Recently failed means within this window; older is probably learnt. */
const DIAS_VENTANA = 30;

export interface ErrorDelDia {
  readonly itemId: string;
  readonly area: string;
  readonly pregunta: string;
  readonly contexto: string | null;
  readonly opciones: Record<string, string>;
  /** Why this one: the topic, or the date it was missed. */
  readonly motivo: string;
  /** True once answered today, so the card can show it is done. */
  readonly resueltoHoy: boolean;
}

@Injectable()
export class ErrorDelDiaService {
  private readonly log = new Logger(ErrorDelDiaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly debilidades: DebilidadesService,
  ) {}

  /**
   * Today's question, or null when there is nothing honest to offer.
   *
   * The same question all day: the point is one small thing done, not
   * a feed to scroll. It changes when the day does, in the learner's
   * own timezone.
   */
  async paraHoy(userId: string, timeZone = 'UTC'): Promise<ErrorDelDia | null> {
    try {
      const fallado = await this.ultimoFallado(userId, timeZone);
      if (fallado) return fallado;
      return await this.deTemaDebil(userId);
    } catch (error) {
      /* A missing card is a smaller problem than a broken dashboard,
         and this is the least important thing on it. */
      this.log.warn(`No se pudo armar el error del día: ${error}`);
      return null;
    }
  }

  /** A question they got wrong and have not got right since. */
  private async ultimoFallado(
    userId: string,
    timeZone: string,
  ): Promise<ErrorDelDia | null> {
    const desde = new Date(Date.now() - DIAS_VENTANA * 24 * 60 * 60 * 1000);

    const respuestas = await this.prisma.answer.findMany({
      where: {
        itemId: { not: null },
        createdAt: { gte: desde },
        session: { userId },
      },
      select: { itemId: true, isCorrect: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    /* Walking newest first, the first time an item appears is its
       latest outcome. An item last answered correctly has been
       learnt and is not today's problem. */
    const resuelto = new Set<string>();
    const pendientes: Array<{ itemId: string; createdAt: Date }> = [];
    for (const r of respuestas) {
      if (!r.itemId || resuelto.has(r.itemId)) continue;
      resuelto.add(r.itemId);
      if (!r.isCorrect) pendientes.push({ itemId: r.itemId, createdAt: r.createdAt });
    }
    if (pendientes.length === 0) return null;

    /* The oldest outstanding mistake: one left alone for three weeks
       is likelier to still be a gap than yesterday's. */
    const elegido = pendientes[pendientes.length - 1];

    const item = await this.prisma.generatedItem.findUnique({
      where: { id: elegido.itemId },
    });
    if (!item) return null;

    return {
      itemId: item.id,
      area: item.area,
      pregunta: item.pregunta,
      contexto: item.contexto ?? null,
      opciones: item.opciones as Record<string, string>,
      motivo: 'La falló antes. A ver si ahora sí.',
      resueltoHoy: await this.yaRespondioHoy(userId, item.id, timeZone),
    };
  }

  /** Anything from the topic they are weakest in. */
  private async deTemaDebil(userId: string): Promise<ErrorDelDia | null> {
    const temas = await this.debilidades.temasDebiles(userId, 1);
    if (temas.length === 0) return null;

    const tema = temas[0];
    const item = await this.prisma.generatedItem.findFirst({
      where: { area: tema.area },
      orderBy: { createdAt: 'desc' },
    });
    if (!item) return null;

    return {
      itemId: item.id,
      area: item.area,
      pregunta: item.pregunta,
      contexto: item.contexto ?? null,
      opciones: item.opciones as Record<string, string>,
      motivo: `${tema.tema.replace(/-/g, ' ')} le está costando.`,
      resueltoHoy: false,
    };
  }

  /**
   * Whether this item was *got right* today, in their timezone.
   *
   * It used to ask only whether it had been answered, which marked the
   * card done the moment the learner failed it — exactly when it is
   * worth another go. Failing it today is the reason it is today's
   * question, not a reason to put it away.
   */
  private async yaRespondioHoy(
    userId: string,
    itemId: string,
    timeZone: string,
  ): Promise<boolean> {
    const inicio = this.inicioDelDiaLocal(timeZone);
    const acierto = await this.prisma.answer.findFirst({
      where: {
        itemId,
        isCorrect: true,
        createdAt: { gte: inicio },
        session: { userId },
      },
      select: { id: true },
    });
    return Boolean(acierto);
  }

  /**
   * Midnight today where the learner is.
   *
   * A day that turns over at UTC midnight is 7pm in Colombia, so a
   * learner practising in the evening would watch the card reset
   * mid-session.
   */
  private inicioDelDiaLocal(timeZone: string): Date {
    const ahora = new Date();
    try {
      const partes = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(ahora);
      const leer = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? '';
      const local = `${leer('year')}-${leer('month')}-${leer('day')}T00:00:00`;

      /* The offset is read back from the formatter rather than assumed,
         so this holds across daylight saving in the zones that use it. */
      const comoUtc = new Date(`${local}Z`);
      const desfase = this.desfaseMs(comoUtc, timeZone);
      return new Date(comoUtc.getTime() + desfase);
    } catch {
      // An unknown timezone should not break the card.
      const utc = new Date();
      return new Date(Date.UTC(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate()));
    }
  }

  private desfaseMs(fecha: Date, timeZone: string): number {
    const enZona = new Date(fecha.toLocaleString('en-US', { timeZone }));
    const enUtc = new Date(fecha.toLocaleString('en-US', { timeZone: 'UTC' }));
    return enUtc.getTime() - enZona.getTime();
  }
}
