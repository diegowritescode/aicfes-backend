import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { tablaDatos as t } from '../src/figuras/tabla-datos';

/** The points-and-paths table from the 2020 Matemáticas session. */
const real = {
  encabezados: ['Punto inicial', 'Punto final', 'Camino recto', 'Camino curvo'],
  filas: [
    ['P', 'Q', '3 m', '3,5 m'],
    ['P', 'R', '4 m', '4,5 m'],
    ['Q', 'S', '4 m', '4,5 m'],
    ['Q', 'R', '5 m', 'No hay camino'],
    ['S', 'R', '3 m', '3,5 m'],
  ],
};

test('accepts a real table from the 2020 booklet', () => {
  assert.equal(t.validar(real).valida, true);
});

test('rejects a ragged table, where figure and question disagree', () => {
  const r = t.validar({ ...real, filas: [['P', 'Q', '3 m']] });
  assert.equal(r.valida, false);
  assert.match(r.error ?? '', /3 celdas y se esperaban 4/);
});

test('rejects shapes that cannot be read', () => {
  assert.equal(t.validar({ encabezados: ['solo'], filas: [['a']] }).valida, false);
  const anchas = Array.from({ length: 7 }, (_, i) => `c${i}`);
  assert.equal(t.validar({ encabezados: anchas, filas: [anchas] }).valida, false);
  assert.equal(t.validar({ ...real, filas: [] }).valida, false);
});

test('every cell the question states appears in the drawing', () => {
  const svg = t.dibujar(real);
  assert.ok(svg.includes('No hay camino'), 'a text cell survives');
  assert.ok(svg.includes('3,5 m'), 'a decimal comma survives');
  assert.ok(svg.includes('Punto inicial'), 'headers survive');
});

test('cell text cannot inject markup', () => {
  // Cells come from the model, so they are untrusted input.
  const svg = t.dibujar({
    encabezados: ['a', 'b'],
    filas: [['<script>x</script>', 'r & d']],
  });
  assert.ok(!svg.includes('<script>'), 'no raw tag reaches the output');
  assert.ok(svg.includes('&lt;script&gt;'), 'it is escaped instead');
  assert.ok(svg.includes('r &amp; d'), 'ampersands are escaped');
});

test('columns widen to fit their longest cell', () => {
  const angosta = t.dibujar({ encabezados: ['a', 'b'], filas: [['1', '2']] });
  const ancha = t.dibujar({
    encabezados: ['a', 'b'],
    filas: [['1', 'una celda considerablemente más larga']],
  });
  const w = (s: string) => Number(s.match(/viewBox="0 0 ([\d.]+)/)?.[1]);
  assert.ok(w(ancha) > w(angosta), 'the wider content gets a wider table');
});

test('describes every cell for a screen reader', () => {
  const d = t.describir(real);
  assert.match(d, /Punto inicial/);
  assert.ok(d.includes('No hay camino'));
});
