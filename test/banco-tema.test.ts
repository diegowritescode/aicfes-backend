import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { ItemBankService } from '../src/items/services/item-bank.service';

/**
 * Drawing from the bank by topic.
 *
 * This is the hole that made the weekly plan decorative, and it was
 * not where it looked. The plan carries `{area, tema}`, the generate
 * endpoint accepts `tema`, and `ItemGeneratorService` feeds it to the
 * prompt — so the chain looked complete. But the bank is consulted
 * *before* the generator, and `draw` filtered on area and difficulty
 * only. A learner told to practise `angulos` got mixed Matemáticas
 * from the bank and never reached the generator at all.
 *
 * The topic died in the one layer nobody was looking at, which is why
 * passing it through the URL alone would have fixed the visible half
 * and left the behaviour unchanged.
 */

interface Llamada {
  readonly where: Record<string, unknown>;
  readonly take?: number;
}

function banco(opciones: { porTema?: unknown[]; porArea?: unknown[] } = {}) {
  const llamadas: Llamada[] = [];

  const prisma = {
    generatedItem: {
      findMany: async (args: Llamada) => {
        llamadas.push(args);
        /* Second call is the area top-up: the service asks for the
           topic first and completes from the area only if short. */
        const esPorTema = 'tags' in (args.where ?? {});
        return esPorTema ? (opciones.porTema ?? []) : (opciones.porArea ?? []);
      },
      updateMany: async () => ({ count: 0 }),
    },
  };

  /* The constructor builds an OpenAI client, so `config` has to
     answer `get`. No network call happens on this path — `draw` never
     embeds. */
  const config = { get: () => 'sk-test-no-sirve' };

  return {
    servicio: new ItemBankService(prisma as never, config as never),
    llamadas,
  };
}

const ITEM = (id: string) => ({ id, area: 'MAT', tags: ['angulos'] });

test('sin tema, el banco filtra solo por área como antes', async () => {
  /* Three of the four callers pass no topic. They must keep working
     exactly as they did. */
  const { servicio, llamadas } = banco({ porArea: [ITEM('a'), ITEM('b')] });

  await servicio.draw({ area: 'MAT', limit: 2 });

  assert.equal(llamadas.length, 1);
  assert.equal('tags' in llamadas[0]!.where, false, 'no debía filtrar por tags');
});

test('con tema, el banco filtra por el tag del tema', async () => {
  const { servicio, llamadas } = banco({ porTema: [ITEM('a'), ITEM('b')] });

  await servicio.draw({ area: 'MAT', tema: 'angulos', limit: 2 });

  const where = llamadas[0]!.where;
  assert.deepEqual(where.tags, { array_contains: ['angulos'] });
});

test('el tema en prosa se normaliza a como está guardado', async () => {
  /* Topics are stored hyphenated («leyes-de-newton») and callers hand
     them over as prose. Without this the filter matches no row and
     the bank silently falls back to the area — the same bug with a
     different cause. */
  const { servicio, llamadas } = banco({ porTema: [ITEM('a')] });

  await servicio.draw({ area: 'MAT', tema: 'Leyes De Newton', limit: 1 });

  assert.deepEqual(llamadas[0]!.where.tags, {
    array_contains: ['leyes-de-newton'],
  });
});

test('si el tema no alcanza, se completa por área sin perder lo del tema', async () => {
  /* Topic-matched items are the best available. Discarding them to
     re-query the area would serve worse questions, and failing
     outright would send the caller to the generator — correct, slow
     and paid for. */
  const { servicio, llamadas } = banco({
    porTema: [ITEM('tema-1')],
    porArea: [ITEM('area-1'), ITEM('area-2')],
  });

  const items = await servicio.draw({ area: 'MAT', tema: 'angulos', limit: 3 });

  assert.equal(llamadas.length, 2, 'tenía que completar con una segunda consulta');
  assert.equal(items.length, 3);
  assert.equal((items[0] as { id: string }).id, 'tema-1', 'lo del tema va primero');
});

test('el relleno no repite lo que ya trajo el tema', async () => {
  /* The same item served twice in one drill is a bug the learner
     notices immediately. */
  const { servicio, llamadas } = banco({
    porTema: [ITEM('tema-1')],
    porArea: [ITEM('area-1')],
  });

  await servicio.draw({ area: 'MAT', tema: 'angulos', limit: 2 });

  const excluidos = (llamadas[1]!.where.id as { notIn: string[] }).notIn;
  assert.ok(excluidos.includes('tema-1'), 'el relleno tiene que excluir lo ya tomado');
});

test('el relleno respeta los excludeIds que pidió el llamador', async () => {
  /* `duelos.service.ts` passes them to avoid repeating a question
     inside one duel. Dropping them in the top-up would reintroduce
     exactly what the caller asked to prevent. */
  const { servicio, llamadas } = banco({
    porTema: [ITEM('tema-1')],
    porArea: [ITEM('area-1')],
  });

  await servicio.draw({
    area: 'MAT',
    tema: 'angulos',
    limit: 2,
    excludeIds: ['ya-visto'],
  });

  const excluidos = (llamadas[1]!.where.id as { notIn: string[] }).notIn;
  assert.ok(excluidos.includes('ya-visto'));
  assert.ok(excluidos.includes('tema-1'));
});

test('si el tema alcanza, no hay segunda consulta', async () => {
  const { servicio, llamadas } = banco({ porTema: [ITEM('a'), ITEM('b')] });

  await servicio.draw({ area: 'MAT', tema: 'angulos', limit: 2 });

  assert.equal(llamadas.length, 1);
});
