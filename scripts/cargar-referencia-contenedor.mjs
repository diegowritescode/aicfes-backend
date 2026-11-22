/**
 * Loads reference items into ItemReferencia, from inside the API
 * container.
 *
 * Same logic as scripts/cargar-referencia.ts, written as plain ESM
 * because the runtime image ships only dist/ — there is no tsx in it,
 * and the API key lives on the server, so the load has to run there.
 *
 * Safe to re-run: items already present are skipped by hash before
 * any embedding is paid for, so an interrupted load resumes.
 *
 * Usage: node cargar-referencia.mjs <banco.json> [limite]
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const DIMENSIONS = 1536;
const LOTE = 64;

function normalise(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  const [ruta, limiteArg] = process.argv.slice(2);
  if (!ruta) {
    console.error('uso: cargar-referencia.mjs <banco.json> [limite]');
    process.exit(1);
  }
  if (!process.env.OPENAI_API_KEY) {
    console.error('falta OPENAI_API_KEY');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const todos = JSON.parse(readFileSync(ruta, 'utf-8'));
  const conArea = todos.filter((i) => i.area);
  const items = limiteArg ? conArea.slice(0, Number(limiteArg)) : conArea;

  console.log(`${items.length} ítems con área, de ${todos.length} en el archivo`);

  let creados = 0;
  let saltados = 0;
  let fallidos = 0;

  for (let i = 0; i < items.length; i += LOTE) {
    const lote = items.slice(i, i + LOTE);

    const conHash = lote.map((item) => ({
      item,
      hash: createHash('sha256').update(normalise(item.enunciado)).digest('hex'),
    }));

    // Check before spending: embeddings cost money, lookups do not.
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

    let vectores;
    try {
      const resp = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: nuevos.map((n) => normalise(n.item.enunciado).slice(0, 8000)),
        dimensions: DIMENSIONS,
      });
      vectores = resp.data.map((d) => d.embedding);
    } catch (error) {
      console.warn(`\nlote ${i / LOTE}: ${error}`);
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
        console.warn(`\n${item.fuente} #${item.numero}: ${error}`);
        fallidos += 1;
      }
    }

    process.stdout.write(
      `\r  ${creados} cargados, ${saltados} ya estaban, ${fallidos} fallaron`,
    );
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
