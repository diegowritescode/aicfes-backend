import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { TimeTrialService } from '../src/time-trial/time-trial.service';

/**
 * The topic reaching the bank from contrarreloj.
 *
 * `preguntasParaSeccion` has always *accepted* a topic and passed it
 * to the generator. It did not pass it to `banco.draw`, and the bank
 * answers first and most of the time — so `temaDebil` computed a
 * topic on every start and nothing it decided changed a single
 * question the learner saw.
 *
 * The service takes six collaborators, so these tests reach the one
 * method that matters rather than standing the whole thing up. What
 * is being pinned is narrow and was wrong for months: the argument
 * arrives at the bank.
 */

function servicio(opciones: { temaDebil?: string } = {}) {
  const pedidoAlBanco: Array<Record<string, unknown>> = [];

  const banco = {
    draw: async (params: Record<string, unknown>) => {
      pedidoAlBanco.push(params);
      /* Returning a full draw on purpose: an empty one sends the
         method on to the generator, and the assertion here is about
         what the bank was asked for, which has already happened. */
      return Array.from({ length: Number(params.limit) }, (_, i) => ({
        id: `item-${i}`,
        area: params.area,
        dificultad: params.dificultad,
        pregunta: 'q',
        opciones: { A: 'a', B: 'b', C: 'c', D: 'd' },
        respuesta_correcta: 'A',
        justificacion: 'j',
        tags: ['angulos'],
      }));
    },
  };

  const debilidades = {
    temasDebiles: async () =>
      opciones.temaDebil ? [{ tema: opciones.temaDebil }] : [],
  };

  const instancia = new TimeTrialService(
    null as never,
    null as never,
    null as never,
    null as never,
    debilidades as never,
    banco as never,
  );

  return { instancia, pedidoAlBanco };
}

/** `preguntasParaSeccion` is private; the behaviour under test is its own. */
function seccion(instancia: TimeTrialService, params: Record<string, unknown>) {
  return (
    instancia as unknown as {
      preguntasParaSeccion: (p: Record<string, unknown>) => Promise<unknown>;
    }
  ).preguntasParaSeccion(params);
}

test('el tema de la sección llega al banco', async () => {
  /* The whole bug: it reached the generator and not the bank, so the
     weakness profile had no effect on what was served. */
  const { instancia, pedidoAlBanco } = servicio();

  await seccion(instancia, {
    area: 'MAT',
    dificultad: 'media',
    n: 5,
    tema: 'angulos',
  });

  assert.equal(pedidoAlBanco.length, 1);
  assert.equal(pedidoAlBanco[0]!.tema, 'angulos');
});

test('sin tema, el banco lo recibe como undefined y filtra por área', async () => {
  /* Simulacro and duelos draw without a topic and must be unchanged. */
  const { instancia, pedidoAlBanco } = servicio();

  await seccion(instancia, { area: 'LC', dificultad: 'media', n: 3 });

  assert.equal(pedidoAlBanco[0]!.tema, undefined);
  assert.equal(pedidoAlBanco[0]!.area, 'LC');
});

test('un fallo del banco no impide practicar', async () => {
  /* Pre-existing behaviour worth keeping: the generator still
     answers, so a bank outage does not stop a learner. */
  const banco = {
    draw: async () => {
      throw new Error('banco caído');
    },
  };
  const instancia = new TimeTrialService(
    null as never,
    null as never,
    null as never,
    null as never,
    { temasDebiles: async () => [] } as never,
    banco as never,
  );

  /* It must reach the generator rather than throw. With a null
     generator that is itself a throw, so the assertion is that the
     failure is NOT the bank's. */
  await assert.rejects(
    () => seccion(instancia, { area: 'MAT', dificultad: 'media', n: 1 }) as Promise<unknown>,
    (error: Error) => !/banco caído/.test(error.message),
    'el fallo del banco no debía propagarse',
  );
});
