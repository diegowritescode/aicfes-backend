import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  leerMarca,
  marcaDelRival,
  paraGanar,
  soloPorTiempo,
} from '../src/duelos/model/marca-a-batir';

test('un marcador guardado se lee', () => {
  const m = leerMarca({ aciertos: 4, segundos: 52 }, 5);
  assert.deepEqual(m, { aciertos: 4, segundos: 52, deCuantas: 5 });
});

test('nada guardado no es un cero', () => {
  /* The common case for whoever opens first. A zero on screen would
     read as the rival having scored nothing. */
  assert.equal(leerMarca(null, 5), null);
  assert.equal(leerMarca(undefined, 5), null);
  assert.equal(leerMarca({}, 5), null);
});

test('un marcador corrupto no rompe la ronda', () => {
  /* The column is `Json?`: what comes back is whatever was written,
     including by an older version of this code. */
  assert.equal(leerMarca({ aciertos: 'cuatro', segundos: 52 }, 5), null);
  assert.equal(leerMarca({ aciertos: 4 }, 5), null);
  assert.equal(leerMarca({ aciertos: NaN, segundos: 1 }, 5), null);
  assert.equal(leerMarca('4 de 5', 5), null);
});

test('un acierto fuera de la ronda es corrupto, no bajo', () => {
  assert.equal(leerMarca({ aciertos: 7, segundos: 10 }, 5), null);
  assert.equal(leerMarca({ aciertos: -1, segundos: 10 }, 5), null);
});

test('los segundos negativos se recortan a cero', () => {
  const m = leerMarca({ aciertos: 3, segundos: -5 }, 5);
  assert.equal(m?.segundos, 0);
});

test('el retador ve la marca del rival, y al contrario', () => {
  const datos = {
    resultadoRetador: { aciertos: 5, segundos: 40 },
    resultadoRival: { aciertos: 2, segundos: 90 },
    deCuantas: 5,
  };

  assert.equal(marcaDelRival({ soyRetador: true, ...datos })?.aciertos, 2);
  assert.equal(marcaDelRival({ soyRetador: false, ...datos })?.aciertos, 5);
});

test('quien abre primero no ve ninguna marca', () => {
  const m = marcaDelRival({
    soyRetador: true,
    resultadoRetador: null,
    resultadoRival: null,
    deCuantas: 5,
  });
  assert.equal(m, null);
});

test('para ganar hace falta uno más', () => {
  assert.equal(paraGanar({ aciertos: 3, segundos: 60, deCuantas: 5 }), 4);
  assert.equal(paraGanar({ aciertos: 0, segundos: 60, deCuantas: 5 }), 1);
});

test('contra una ronda perfecta no se pide una imposible', () => {
  /* «6 de 5» is not an instruction. */
  assert.equal(paraGanar({ aciertos: 5, segundos: 40, deCuantas: 5 }), 5);
  assert.equal(soloPorTiempo({ aciertos: 5, segundos: 40, deCuantas: 5 }), true);
  assert.equal(soloPorTiempo({ aciertos: 4, segundos: 40, deCuantas: 5 }), false);
});
