import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { repartir, totalDe, type PesoDeArea } from '../src/items/model/reparto-offline';

/**
 * How an offline pool is divided.
 *
 * The invariant that matters most is boring: the pool must contain
 * exactly as many questions as were asked for. A pool that quietly
 * holds nine when ten were promised leaves the toll one question short
 * on the day the learner needs it.
 */

const TODAS = ['MAT', 'LC', 'CN', 'SOC', 'ING'] as const;

test('el total es exactamente el pedido, con cualquier peso', () => {
  /* Rounding each area's share independently is the obvious
     implementation and it hands out the wrong number. This checks the
     arithmetic across sizes rather than at one convenient value. */
  const casos: PesoDeArea[][] = [
    [],
    [{ area: 'MAT', prioridad: 1 }],
    [
      { area: 'MAT', prioridad: 0.9 },
      { area: 'LC', prioridad: 0.1 },
    ],
    TODAS.map((area, i) => ({ area, prioridad: (i + 1) / 3 })),
    TODAS.map((area) => ({ area, prioridad: 0 })),
  ];

  for (const pesos of casos) {
    for (const total of [1, 2, 3, 5, 7, 10, 20, 37, 100]) {
      assert.equal(
        totalDe(repartir(total, pesos)),
        total,
        `con ${pesos.length} pesos y total ${total}`,
      );
    }
  }
});

test('ningún área queda fuera cuando el lote alcanza', () => {
  /* A pool covering two areas makes the toll predictable: the learner
     learns which subject the block will ask about. */
  const reparto = repartir(10, [
    { area: 'MAT', prioridad: 10 },
    { area: 'LC', prioridad: 0.1 },
    { area: 'CN', prioridad: 0 },
    { area: 'SOC', prioridad: 0 },
    { area: 'ING', prioridad: 0 },
  ]);
  assert.equal(reparto.length, 5);
  for (const r of reparto) {
    assert.ok(r.cuantas >= 1, `${r.area} quedó en cero`);
  }
});

test('lo flojo recibe más', () => {
  const reparto = repartir(20, [
    { area: 'MAT', prioridad: 3 },
    { area: 'LC', prioridad: 1 },
  ]);
  const mat = reparto.find((r) => r.area === 'MAT')!.cuantas;
  const lc = reparto.find((r) => r.area === 'LC')!.cuantas;
  assert.ok(mat > lc, `MAT ${mat} debería superar LC ${lc}`);
});

test('sin datos de debilidad, se reparte parejo entre las cinco', () => {
  // The honest answer for a learner the system knows nothing about.
  const reparto = repartir(10, []);
  assert.equal(reparto.length, 5);
  for (const r of reparto) assert.equal(r.cuantas, 2);
});

test('con prioridades todas en cero tampoco se rompe', () => {
  const reparto = repartir(7, TODAS.map((area) => ({ area, prioridad: 0 })));
  assert.equal(totalDe(reparto), 7);
  assert.equal(reparto.length, 5);
});

test('un lote más pequeño que el número de áreas va a lo más flojo', () => {
  /* Two slots and five areas: giving everyone 0.4 of a question serves
     nobody, so the two weakest take them. */
  const reparto = repartir(2, [
    { area: 'MAT', prioridad: 5 },
    { area: 'LC', prioridad: 4 },
    { area: 'CN', prioridad: 1 },
    { area: 'SOC', prioridad: 0 },
    { area: 'ING', prioridad: 0 },
  ]);
  assert.equal(totalDe(reparto), 2);
  assert.deepEqual(
    reparto.map((r) => r.area).sort(),
    ['LC', 'MAT'],
  );
});

test('un lote de cero no pide nada', () => {
  assert.deepEqual(repartir(0, []), []);
  assert.deepEqual(repartir(-5, []), []);
});

test('el reparto es reproducible', () => {
  /* Not random, on purpose: when a learner reports that the toll keeps
     asking the same thing, the pool has to be explainable. */
  const pesos: PesoDeArea[] = [
    { area: 'MAT', prioridad: 2 },
    { area: 'CN', prioridad: 1 },
  ];
  const primero = repartir(13, pesos);
  for (let i = 0; i < 5; i += 1) {
    assert.deepEqual(repartir(13, pesos), primero);
  }
});

test('un área repetida en los pesos no duplica su cupo', () => {
  // Defensive: the caller builds this list from a query.
  const reparto = repartir(6, [
    { area: 'MAT', prioridad: 1 },
    { area: 'MAT', prioridad: 1 },
  ]);
  assert.equal(reparto.length, 1);
  assert.equal(totalDe(reparto), 6);
});
