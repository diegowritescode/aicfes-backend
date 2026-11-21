import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { graficaBarras as g } from '../src/figuras/grafica-barras';

/** Data taken from a real 2020 booklet item. */
const datos = [
  { etiqueta: 'Entre 0 y 2,9', valor: 8 },
  { etiqueta: 'Entre 3 y 5,9', valor: 12 },
  { etiqueta: 'Entre 6 y 9', valor: 10 },
];

test('accepts a real item from the 2020 booklet', () => {
  assert.equal(g.validar({ datos }).valida, true);
});

test('rejects charts too small or too crowded to read', () => {
  assert.equal(g.validar({ datos: [{ etiqueta: 'a', valor: 1 }] }).valida, false);
  const muchas = Array.from({ length: 11 }, (_, i) => ({ etiqueta: `b${i}`, valor: i + 1 }));
  assert.equal(g.validar({ datos: muchas }).valida, false);
});

test('rejects values that cannot be drawn', () => {
  assert.equal(g.validar({ datos: [{ etiqueta: 'a', valor: -3 }, ...datos] }).valida, false);
  assert.equal(g.validar({ datos: [{ etiqueta: '', valor: 3 }, ...datos] }).valida, false);
});

test('rejects an all-zero chart, which says nothing', () => {
  const r = g.validar({ datos: [{ etiqueta: 'a', valor: 0 }, { etiqueta: 'b', valor: 0 }] });
  assert.equal(r.valida, false);
  assert.match(r.error ?? '', /cero/);
});

test('rejects an axis top below the tallest bar', () => {
  const r = g.validar({ datos, maximoEjeY: 5 });
  assert.equal(r.valida, false);
  assert.match(r.error ?? '', /menor/);
});

test('bar heights are proportional to their values', () => {
  const svg = g.dibujar({ datos });
  const alturas = [...svg.matchAll(/<rect[^>]*height="([\d.]+)"/g)].map((m) => Number(m[1]));
  assert.equal(alturas.length, 3);
  const [a, b, c] = alturas as [number, number, number];
  // 8 : 12 : 10 — the middle bar is the tallest, and 12/8 = 1.5.
  assert.ok(b > c && c > a, 'order follows the data');
  assert.ok(Math.abs(b / a - 12 / 8) < 0.01, 'ratio matches the values');
});

test('the labels the question uses survive into the drawing', () => {
  const svg = g.dibujar({ datos, tituloEjeY: 'Frecuencia absoluta', tituloEjeX: 'Peso (libras)' });
  assert.ok(svg.includes('Frecuencia absoluta'));
  assert.ok(svg.includes('Peso (libras)'));
  assert.ok(svg.includes('Entre 3 y 5,9'));
});

test('describes itself with every value, for a screen reader', () => {
  const d = g.describir({ datos, tituloEjeY: 'Frecuencia absoluta' });
  assert.match(d, /Frecuencia absoluta/);
  for (const row of datos) assert.ok(d.includes(String(row.valor)));
});
