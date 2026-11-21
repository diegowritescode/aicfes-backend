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
   */
  async draw(params: {
    area: string;
    dificultad?: string;
    limit: number;
    excludeIds?: string[];
  }): Promise<Array<Record<string, unknown>>> {
    const items = await this.prisma.generatedItem.findMany({
      where: {
        verified: true,
        area: params.area as never,
        ...(params.dificultad ? { dificultad: params.dificultad as never } : {}),
        ...(params.excludeIds?.length ? { id: { notIn: params.excludeIds } } : {}),
      },
      orderBy: [{ lastServedAt: { sort: 'asc', nulls: 'first' } }, { timesServed: 'asc' }],
      take: params.limit,
    });

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
}

export default ItemBankService;
