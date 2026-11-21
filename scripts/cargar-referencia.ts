/**
 * Loads extracted exam items into the reference bank.
 *
 * Each item needs an embedding, which is one request apiece, so this
 * runs as a script rather than at startup: a few thousand items cost a
 * few cents once, and the generator reads them from then on.
 *
 * Safe to re-run. Items already present are skipped by hash, so an
 * interrupted load resumes instead of duplicating.
 *
 * Usage: npx tsx scripts/cargar-referencia.ts <banco.json> [limite]
 */
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';
import { createHash } from 'node:crypto';

interface ItemExtraido {
  fuente: string;
  numero: number;
  area: string | null;
  enunciado: string;
  opciones: Record<string, string>;
}

const EMBEDDING_MODEL = 'text-embedding-3-small';
const DIMENSIONS = 1536;
const LOTE = 64;

function normalise(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main(): Promise<void> {
  const [ruta, limiteArg] = process.argv.slice(2);
  if (!ruta) {
    console.error('uso: cargar-referencia.ts <banco.json> [limite]');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const todos = JSON.parse(readFileSync(ruta, 'utf-8')) as ItemExtraido[];
  const conArea = todos.filter((i) => i.area);
  const limite = limiteArg ? Number(limiteArg) : conArea.length;
  const items = conArea.slice(0, limite);

  console.log(`${items.length} ítems con área, de ${todos.length} extraídos`);

  let creados = 0;
  let saltados = 0;
  let fallidos = 0;

  for (let i = 0; i < items.length; i += LOTE) {
    const lote = items.slice(i, i + LOTE);

    // Skip what is already loaded before spending on embeddings.
    const conHash = lote.map((item) => ({
      item,
      hash: createHash('sha256').update(normalise(item.enunciado)).digest('hex'),
    }));
    const existentes = new Set(
      (
        await prisma.itemReferencia.findMany({
          where: { hash: { in: conHash.map((c) => c.hash) } },
          select: { hash: true },
        })
      ).map((r) => r.hash),
    );
    const nuevos = conHash.filter((c) => !existentes.has(c.hash));
    saltados += conHash.length - nuevos.length;
    if (nuevos.length === 0) continue;

    // One request per batch rather than per item.
    let vectores: number[][];
    try {
      const resp = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: nuevos.map((n) => normalise(n.item.enunciado).slice(0, 8000)),
        dimensions: DIMENSIONS,
      });
      vectores = resp.data.map((d) => d.embedding);
    } catch (error) {
      console.warn(`lote ${i / LOTE}: ${error}`);
      fallidos += nuevos.length;
      continue;
    }

    for (const [j, { item, hash }] of nuevos.entries()) {
      const vector = vectores[j];
      if (!vector) {
        fallidos += 1;
        continue;
      }
      try {
        await prisma.$executeRawUnsafe(
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
        creados += 1;
      } catch (error) {
        console.warn(`${item.fuente} #${item.numero}: ${error}`);
        fallidos += 1;
      }
    }

    process.stdout.write(`\r  ${creados} cargados, ${saltados} ya estaban, ${fallidos} fallaron`);
  }

  console.log(`\nlisto: ${creados} cargados, ${saltados} saltados, ${fallidos} fallidos`);

  const porArea = await prisma.itemReferencia.groupBy({
    by: ['area'],
    _count: { _all: true },
  });
  for (const fila of porArea) {
    console.log(`  ${fila.area}: ${fila._count._all}`);
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
