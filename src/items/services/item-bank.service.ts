import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { PrismaService } from '../../persistence/prisma.service';
import type { Item } from '../schemas/item.schema';
import { hashQuestion, normaliseQuestion } from '../../common/question-hash';

/**
 * The bank of verified items.
 *
 * Generating a fresh item for every question is slow, costs a request
 * each time, and produces the same question repeatedly with nothing to
 * notice it. Verified items are kept, deduplicated and served again.
 *
 * Duplicates are caught twice. An exact repeat is caught by a hash of
 * the normalised question, which costs nothing. A reworded repeat is
 * caught by cosine distance between embeddings, which costs one small
 * request but catches what the hash cannot.
 */

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;

@Injectable()
export class ItemBankService {
  private readonly log = new Logger(ItemBankService.name);
  private readonly client: OpenAI;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.client = new OpenAI({ apiKey: this.config.get<string>('OPENAI_API_KEY') });
  }

  /** Above this cosine similarity two questions count as the same. */
  private get threshold(): number {
    return Number(this.config.get('DEDUP_THRESHOLD') ?? 0.92);
  }

  // One definition of sameness, shared with the write path.
  static normaliseQuestion = normaliseQuestion;
  static hashQuestion = hashQuestion;

  async embed(text: string): Promise<number[]> {
    const resp = await this.client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
      dimensions: EMBEDDING_DIMENSIONS,
    });
    const vector = resp.data[0]?.embedding;
    if (!vector) throw new Error('embedding request returned no vector');
    return vector;
  }

  /**
   * Whether this item already exists in the bank, exactly or in
   * substance. Returns the id of what it duplicates, when it does.
   */
  async findDuplicate(item: Item): Promise<{ id: string; reason: string } | null> {
    const hash = ItemBankService.hashQuestion(item.contexto, item.pregunta);

    const exact = await this.prisma.generatedItem.findFirst({
      where: { questionHash: hash },
      select: { id: true },
    });
    if (exact) return { id: exact.id, reason: 'pregunta idéntica' };

    // The embedding costs a request, so it only runs once the free check
    // has passed.
    let vector: number[];
    try {
      vector = await this.embed(ItemBankService.normaliseQuestion(item.contexto, item.pregunta));
    } catch (error) {
      // Without an embedding the near-duplicate check cannot run. Say so
      // rather than claiming the item is unique.
      this.log.warn(`Embedding unavailable, near-duplicate check skipped: ${error}`);
      return null;
    }

    const literal = `[${vector.join(',')}]`;
    const near = await this.prisma.$queryRawUnsafe<Array<{ id: string; similarity: number }>>(
      `SELECT id, 1 - (embedding <=> $1::vector) AS similarity
         FROM "GeneratedItem"
        WHERE embedding IS NOT NULL
          AND area = $2::"Area"
        ORDER BY embedding <=> $1::vector
        LIMIT 1`,
      literal,
      item.area,
    );

    const closest = near[0];
    if (closest && closest.similarity >= this.threshold) {
      return {
        id: closest.id,
        reason: `similar a un ítem existente (${closest.similarity.toFixed(3)})`,
      };
    }

    return null;
  }

  /** Stores the embedding and hash alongside an item already written. */
  async indexItem(itemId: string, item: Item): Promise<void> {
    const hash = ItemBankService.hashQuestion(item.contexto, item.pregunta);
    try {
      const vector = await this.embed(
        ItemBankService.normaliseQuestion(item.contexto, item.pregunta),
      );
      await this.prisma.$executeRawUnsafe(
        `UPDATE "GeneratedItem" SET embedding = $1::vector, "questionHash" = $2 WHERE id = $3`,
        `[${vector.join(',')}]`,
        hash,
        itemId,
      );
    } catch (error) {
      // An item without an embedding is still usable; it just will not
      // participate in near-duplicate detection.
      this.log.warn(`Could not index item ${itemId}: ${error}`);
      await this.prisma.generatedItem
        .update({ where: { id: itemId }, data: { questionHash: hash } })
        .catch(() => undefined);
    }
  }

  /**
   * Draws verified items from the bank, least recently served first, so
   * a learner meets the whole bank rather than the same few items.
   *
   * `tema` narrows to one topic, and it is what makes a weekly plan
   * actionable. Without it the bank answered «area + difficulty» and
   * nothing more, so a learner told to practise `angulos` got mixed
   * Matemáticas: the topic travelled all the way from the plan to the
   * request and died here, silently, which is the worst place for it
   * to die because every layer above looked correct.
   *
   * The filter is a `tags` containment check, matching how
   * `DebilidadesService` reads the same column, so the topic a
   * weakness was recorded under is the topic that draws it back.
   *
   * It degrades instead of failing. A topic with too few verified
   * items would otherwise return a short list and the caller would
   * generate the rest — correct but slow and paid for. So a draw that
   * comes up short of `minimoPorTema` falls back to the area, because
   * practising the right area now beats practising the right topic in
   * forty seconds.
   */
  async draw(params: {
    area: string;
    dificultad?: string;
    tema?: string;
    limit: number;
    excludeIds?: string[];
  }): Promise<Array<Record<string, unknown>>> {
    const base = {
      verified: true,
      area: params.area as never,
      ...(params.dificultad ? { dificultad: params.dificultad as never } : {}),
      ...(params.excludeIds?.length ? { id: { notIn: params.excludeIds } } : {}),
    };

    const orden = [
      { lastServedAt: { sort: 'asc', nulls: 'first' } },
      { timesServed: 'asc' },
    ] as never;

    let items: Array<{ id: string }> = [];

    if (params.tema) {
      /* `array_contains` on a Json column, which is how the topic was
         written: `tags` is a JSON array of strings. Normalised to the
         stored spelling first — topics live hyphenated, and callers
         hand them over as prose. */
      const tema = params.tema.trim().toLowerCase().replace(/\s+/g, '-');

      items = (await this.prisma.generatedItem.findMany({
        where: { ...base, tags: { array_contains: [tema] } },
        orderBy: orden,
        take: params.limit,
      })) as never;

      if (items.length < params.limit) {
        this.log.debug(
          `El banco tiene ${items.length} de ${params.limit} en ${tema}; completando por área`,
        );
        /* Topping up rather than discarding: the topic-matched items
           are the best ones available and throwing them away to
           re-query the area would serve worse questions. */
        const faltan = params.limit - items.length;
        const yaTomados = items.map((i) => i.id);
        const relleno = await this.prisma.generatedItem.findMany({
          where: {
            ...base,
            id: {
              notIn: [...(params.excludeIds ?? []), ...yaTomados],
            },
          },
          orderBy: orden,
          take: faltan,
        });
        items = [...items, ...(relleno as never)];
      }
    } else {
      items = (await this.prisma.generatedItem.findMany({
        where: base,
        orderBy: orden,
        take: params.limit,
      })) as never;
    }

    if (items.length > 0) {
      await this.prisma.generatedItem.updateMany({
        where: { id: { in: items.map((i) => i.id) } },
        data: { timesServed: { increment: 1 }, lastServedAt: new Date() },
      });
    }

    return items as unknown as Array<Record<string, unknown>>;
  }

  /** How many verified items the bank holds, by area. */
  async stats(): Promise<Array<{ area: string; count: number }>> {
    const rows = await this.prisma.generatedItem.groupBy({
      by: ['area'],
      where: { verified: true },
      _count: { _all: true },
    });
    return rows.map((r) => ({ area: String(r.area), count: r._count._all }));
  }

  /**
   * How many verified items each area can supply, and the largest
   * sitting that can be drawn from them right now.
   *
   * Only verified items are drawable, so this is the number that
   * decides whether a simulacro can start. A sitting refuses to start
   * short — one missing an area would report a score that cannot be
   * compared to a real one — so until this existed the only way to
   * find out was to try starting one and read the 400.
   */
  async inventario(): Promise<{
    porArea: Array<{ area: string; verificados: number; paraExamenCompleto: number }>;
    total: number;
    simulacroMaximo: number;
  }> {
    const filas = await this.prisma.generatedItem.groupBy({
      by: ['area'],
      _count: { _all: true },
      where: { verified: true },
    });

    const verificados: Record<string, number> = {};
    for (const fila of filas) verificados[String(fila.area)] = fila._count._all;

    /* The real exam's shape. A shorter sitting scales these
       proportions, so the largest one the bank can fill is bounded by
       whichever area runs out first. */
    const EXAMEN: Record<string, number> = { LC: 41, MAT: 50, SOC: 50, CN: 58, ING: 55 };
    const TOTAL = Object.values(EXAMEN).reduce((s, n) => s + n, 0);

    let simulacroMaximo = 0;
    for (let n = TOTAL; n >= 5; n -= 1) {
      const alcanza = Object.entries(EXAMEN).every(([area, preguntas]) => {
        const necesita = Math.max(1, Math.floor((preguntas * n) / TOTAL));
        return (verificados[area] ?? 0) >= necesita;
      });
      if (alcanza) {
        simulacroMaximo = n;
        break;
      }
    }

    return {
      porArea: (['LC', 'MAT', 'SOC', 'CN', 'ING'] as const).map((area) => ({
        area,
        verificados: verificados[area] ?? 0,
        paraExamenCompleto: EXAMEN[area],
      })),
      total: Object.values(verificados).reduce((s, n) => s + n, 0),
      simulacroMaximo,
    };
  }
}
