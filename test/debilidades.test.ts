import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { DebilidadesService } from '../src/calidad/debilidades.service';

/**
 * The profile decides what a learner is shown tomorrow, so the rules
 * that keep it honest are pinned here: how few answers is too few to
 * act on, and how a weakness fades once it stops being recent.
 */

/** A service with its Prisma calls stubbed to fixed rows. */
function servicio(filas: unknown[]): DebilidadesService {
  const prisma = {
    perfilDebilidad: {
      findMany: async () => filas,
      groupBy: async () => [],
    },
  };
  return new DebilidadesService(prisma as never);
}

const hace = (dias: number) => new Date(Date.now() - dias * 24 * 60 * 60 * 1000);

function fila(over: Record<string, unknown> = {}) {
  return {
    area: 'MAT',
    tema: 'angulos',
    respondidas: 10,
    acertadas: 3,
    tipoErrores: { error_calculo: 5, confunde_conceptos: 2 },
    ultimoFallo: hace(1),
    ...over,
  };
}

test('no opina sobre un tema con pocas respuestas', async () => {
  // Two wrong out of three is not evidence of anything, and acting on
  // it sends the learner to drill something they have barely met.
  const temas = await servicio([fila({ respondidas: 3, acertadas: 1 })]).temasDebiles('u1');
  assert.equal(temas.length, 0);
});

test('un tema que va bien no es una debilidad', async () => {
  const temas = await servicio([fila({ respondidas: 10, acertadas: 9 })]).temasDebiles('u1');
  assert.equal(temas.length, 0);
});

test('un tema que va mal sí lo es', async () => {
  const temas = await servicio([fila()]).temasDebiles('u1');
  assert.equal(temas.length, 1);
  assert.equal(temas[0].tema, 'angulos');
  assert.equal(temas[0].aciertoPorcentaje, 30);
});

test('nombra el error que más se repite', async () => {
  // This is what the tutoring modal opens with, so it has to be the
  // mistake actually made most often, not whichever came first.
  const temas = await servicio([fila()]).temasDebiles('u1');
  assert.equal(temas[0].errorTipico, 'error_calculo');
});

test('una debilidad vieja pesa menos que una reciente', async () => {
  const temas = await servicio([
    fila({ tema: 'vieja', ultimoFallo: hace(60) }),
    fila({ tema: 'reciente', ultimoFallo: hace(1) }),
  ]).temasDebiles('u1');

  // Same numbers, different dates: what someone failed in March should
  // not outrank what they failed last week.
  assert.equal(temas[0].tema, 'reciente');
});

test('con el mismo acierto, pesa más quien falló más veces', async () => {
  const temas = await servicio([
    fila({ tema: 'pocos', respondidas: 5, acertadas: 1 }),
    fila({ tema: 'muchos', respondidas: 50, acertadas: 10 }),
  ]).temasDebiles('u1');

  // 20% both ways, but one is four wrong answers and the other forty.
  assert.equal(temas[0].tema, 'muchos');
});

test('devuelve como máximo lo que se le pide', async () => {
  const filas = Array.from({ length: 10 }, (_, i) => fila({ tema: `tema-${i}` }));
  const temas = await servicio(filas).temasDebiles('u1', 3);
  assert.equal(temas.length, 3);
});

test('no empuja a nadie sin datos suficientes', async () => {
  // A new learner must not be pushed anywhere by a profile built from
  // three answers.
  const area = await servicio([]).areaPrioritaria('u1');
  assert.equal(area, null);
});

test('un tema sin fallos registrados no rompe el cálculo', async () => {
  const temas = await servicio([
    fila({ ultimoFallo: null, acertadas: 2, respondidas: 10 }),
  ]).temasDebiles('u1');
  assert.equal(temas.length, 1);
  assert.ok(Number.isFinite(temas[0].prioridad));
});
