import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { PrismaService } from '../../persistence/prisma.service';
import { hashQuestion } from '../../common/question-hash';

/**
 * Real items from the official booklets, retrieved as examples.
 *
 * Without this the model writes from its training memory, which is the
 * same memory any competitor's model has. The booklets are the one
 * asset that cannot be copied, so the generator reads from them: shown
 * five real items on a topic, it imitates the register, the length and
 * the way distractors are built, instead of guessing at them.
 *
 * Reference items are never served to a learner. They are evidence for
 * the generator, not practice material.
 */

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;

export interface ItemReferencia {
  readonly fuente: string;
  readonly numero: number;
  readonly area: string;
  readonly enunciado: string;
  readonly opciones: Record<string, string>;
}

@Injectable()
export class ReferenciaService {
  private readonly log = new Logger(ReferenciaService.name);
  private readonly client: OpenAI;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.client = new OpenAI({ apiKey: this.config.get<string>('OPENAI_API_KEY') });
  }

  private async embed(text: string): Promise<number[]> {
    const resp = await this.client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text.slice(0, 8000),
      dimensions: EMBEDDING_DIMENSIONS,
    });
    const vector = resp.data[0]?.embedding;
    if (!vector) throw new Error('embedding request returned no vector');
    return vector;
  }

  /**
   * The closest real items to what is about to be generated.
   *
   * Falls back to the most recent items of the area when the embedding
   * cannot be produced: examples from the right area still beat none,
   * and a generation should not fail because a side request did.
   */
  async ejemplosPara(params: {
    area: string;
    tema?: string;
    plantilla?: string;
    limite?: number;
  }): Promise<ItemReferencia[]> {
    const limite = params.limite ?? 4;
    const consulta = [params.tema, params.plantilla, params.area].filter(Boolean).join(' ');

    try {
      const vector = await this.embed(consulta || params.area);
      const filas = await this.prisma.$queryRawUnsafe<
        Array<{ fuente: string; numero: number; area: string; enunciado: string; opciones: unknown }>
      >(
        `SELECT fuente, numero, area::text AS area, enunciado, opciones
           FROM "ItemReferencia"
          WHERE area = $2::"Area" AND embedding IS NOT NULL
          ORDER BY embedding <=> $1::vector
          LIMIT $3`,
        `[${vector.join(',')}]`,
        params.area,
        limite,
      );
      if (filas.length > 0) {
        return filas.map((f) => ({ ...f, opciones: f.opciones as Record<string, string> }));
      }
    } catch (error) {
      this.log.warn(`Retrieval by similarity failed, falling back to area: ${error}`);
    }

    const porArea = await this.prisma.itemReferencia.findMany({
      where: { area: params.area as never },
      take: limite,
      orderBy: { createdAt: 'desc' },
    });
    return porArea.map((f) => ({
      fuente: f.fuente,
      numero: f.numero,
      area: String(f.area),
      enunciado: f.enunciado,
      opciones: f.opciones as Record<string, string>,
    }));
  }

  /**
   * Renders the examples for the prompt.
   *
   * Deliberately omits which option is correct. The generator is being
   * shown how an item is written, not taught the answers, and leaving
   * the key out keeps it from copying a question wholesale.
   */
  formatearEjemplos(ejemplos: readonly ItemReferencia[]): string {
    if (ejemplos.length === 0) return '';
    const bloques = ejemplos.map((e, i) => {
      const opciones = ['A', 'B', 'C', 'D']
        .map((k) => `  ${k}. ${e.opciones[k] ?? ''}`)
        .join('\n');
      return `EJEMPLO ${i + 1} (${e.fuente}, pregunta ${e.numero}):\n${e.enunciado}\n${opciones}`;
    });
    return [
      'ÍTEMS REALES DEL EXAMEN OFICIAL, para que imites su estilo:',
      '',
      bloques.join('\n\n'),
      '',
      'Observa su extensión, su registro y cómo se construyen los distractores.',
      'NO copies ninguno: escribe ítems nuevos con ese mismo estilo.',
    ].join('\n');
  }

  /** Stores one reference item with its embedding. */
  async indexar(item: ItemReferencia): Promise<'creado' | 'duplicado' | 'error'> {
    const hash = hashQuestion(item.enunciado, '');
    const existe = await this.prisma.itemReferencia.findUnique({ where: { hash } });
    if (existe) return 'duplicado';

    try {
      const vector = await this.embed(item.enunciado);
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO "ItemReferencia" (id, fuente, numero, area, enunciado, opciones, hash, embedding, "createdAt")
         VALUES (gen_random_uuid()::text, $1, $2, $3::"Area", $4, $5::jsonb, $6, $7::vector, now())
         ON CONFLICT (hash) DO NOTHING`,
        item.fuente,
        item.numero,
        item.area,
        item.enunciado,
        JSON.stringify(item.opciones),
        hash,
        `[${vector.join(',')}]`,
      );
      return 'creado';
    } catch (error) {
      this.log.warn(`Could not index reference item: ${error}`);
      return 'error';
    }
  }

  async estadisticas(): Promise<Array<{ area: string; total: number }>> {
    const filas = await this.prisma.itemReferencia.groupBy({
      by: ['area'],
      _count: { _all: true },
    });
    return filas.map((f) => ({ area: String(f.area), total: f._count._all }));
  }
}

export default ReferenciaService;
