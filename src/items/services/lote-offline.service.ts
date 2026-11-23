import { Injectable, Logger } from '@nestjs/common';
import type { Area } from '@prisma/client';
import { ItemBankService } from './item-bank.service';
import { DebilidadesService } from '../../calidad/debilidades.service';
import { repartir, type PesoDeArea } from '../model/reparto-offline';

/**
 * A pool of questions for a phone with no connection.
 *
 * The study toll needs these on the device before they are needed, for
 * two reasons that both make it a hard requirement rather than a
 * convenience. Apple's shield extension runs in a sandbox that cannot
 * make network requests, so a toll that fetches a question cannot work
 * at all on iOS. And the median Colombian prepaid line carries about
 * 8.2 GB a month, so an Android toll that downloads on demand fails
 * exactly when data has run out — which is late in the month, every
 * month.
 *
 * Nothing here generates. The pool is drawn from the verified bank,
 * so stocking it costs no model requests.
 */

/** Items in a pool. Enough for several blocks without being a download. */
const TAMANO_POR_OMISION = 20;
const TAMANO_MAXIMO = 60;

export interface PreguntaDelLote {
  readonly id: string;
  readonly area: Area;
  readonly dificultad: string;
  readonly contexto: string | null;
  readonly pregunta: string;
  readonly opciones: Record<string, string>;
  /* The pool carries the answer, unlike a sitting
     (`simulacro.service.ts`). The toll marks the attempt on the device
     with no network, so it has to. The exposure is real and bounded:
     someone with filesystem access on a rooted phone can read the
     answers to these items, which is why the pool is small, rotates,
     and never overlaps a graded sitting's question list. */
  readonly respuesta_correcta: string;
  readonly explicaciones: Record<string, string> | null;
  readonly figura: unknown;
}

@Injectable()
export class LoteOfflineService {
  private readonly log = new Logger(LoteOfflineService.name);

  constructor(
    private readonly banco: ItemBankService,
    private readonly debilidades: DebilidadesService,
  ) {}

  /**
   * Questions to keep on the device, weighted toward what this learner
   * gets wrong.
   *
   * `excluir` is the ids the phone already holds, so a refresh tops up
   * the pool instead of replacing it: re-downloading questions the
   * device already has is the one cost this feature exists to avoid.
   */
  async paraUsuario(params: {
    userId: string;
    total?: number;
    excluir?: readonly string[];
  }): Promise<PreguntaDelLote[]> {
    const total = Math.min(
      Math.max(1, params.total ?? TAMANO_POR_OMISION),
      TAMANO_MAXIMO,
    );

    const pesos = await this.pesosDe(params.userId);
    const reparto = repartir(total, pesos);

    const preguntas: PreguntaDelLote[] = [];
    const yaElegidos = new Set<string>(params.excluir ?? []);

    for (const { area, cuantas } of reparto) {
      const items = await this.banco.draw({
        area,
        limit: cuantas,
        excludeIds: [...yaElegidos],
      });

      for (const item of items) {
        preguntas.push(this.aPregunta(item));
        yaElegidos.add(String(item.id));
      }
    }

    /* A short pool is served rather than refused. An area with nothing
       verified left contributes nothing, and a toll with fifteen
       questions still works — where an error would leave the learner
       with a block they cannot clear. */
    if (preguntas.length < total) {
      this.log.log(
        `Lote corto para ${params.userId}: ${preguntas.length} de ${total} pedidas`,
      );
    }

    return preguntas;
  }

  /** Weak areas as weights, or nothing when the learner is new. */
  private async pesosDe(userId: string): Promise<PesoDeArea[]> {
    const temas = await this.debilidades.temasDebiles(userId, 15);

    /* Topics roll up to areas: the pool is drawn per area because the
       bank is indexed that way. The topic still matters — it is what
       orders the draw within an area — but it is not a slot. */
    const porArea = new Map<Area, number>();
    for (const t of temas) {
      porArea.set(t.area, (porArea.get(t.area) ?? 0) + t.prioridad);
    }

    return [...porArea].map(([area, prioridad]) => ({ area, prioridad }));
  }

  private aPregunta(item: Record<string, unknown>): PreguntaDelLote {
    return {
      id: String(item.id),
      area: item.area as Area,
      dificultad: String(item.dificultad),
      contexto: (item.contexto as string | null) ?? null,
      pregunta: String(item.pregunta),
      opciones: item.opciones as Record<string, string>,
      respuesta_correcta: String(item.respuesta_correcta),
      explicaciones: (item.explicaciones as Record<string, string> | null) ?? null,
      figura: item.figura ?? null,
    };
  }
}
