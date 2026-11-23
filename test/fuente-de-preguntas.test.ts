import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { repartirFuentes, rondaViable } from '../src/time-trial/fuente-de-preguntas';

/**
 * Contrarreloj's question source.
 *
 * Every round used to be generated, and the mixed mode made five
 * sequential model calls for questions the bank already held. These
 * assertions pin the arithmetic that decides what gets paid for.
 */

test('un banco lleno no genera nada', () => {
  assert.deepEqual(repartirFuentes(8, 20), { delBanco: 8, porGenerar: 0 });
});

test('un banco corto genera solo el resto', () => {
  /* The case that matters for cost: five from the bank and three
     generated is three requests instead of eight. */
  assert.deepEqual(repartirFuentes(8, 5), { delBanco: 5, porGenerar: 3 });
});

test('un banco vacío se comporta como antes del cambio', () => {
  assert.deepEqual(repartirFuentes(8, 0), { delBanco: 0, porGenerar: 8 });
});

test('no toma del banco más de lo que la ronda pide', () => {
  /* `draw` marks every row it returns as served, so taking eight for
     a round of five would age three items nobody saw. */
  assert.deepEqual(repartirFuentes(5, 50), { delBanco: 5, porGenerar: 0 });
});

test('una ronda sin preguntas no es viable', () => {
  // A timer counting down over an empty screen is worse than an error.
  assert.equal(rondaViable(0), false);
  assert.equal(rondaViable(1), true);
});

test('valores imposibles no producen rondas raras', () => {
  assert.deepEqual(repartirFuentes(-3, 10), { delBanco: 0, porGenerar: 0 });
  assert.deepEqual(repartirFuentes(4, -2), { delBanco: 0, porGenerar: 4 });
});
