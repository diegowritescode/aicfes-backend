import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { graficaLineas as g } from '../src/figuras/grafica-lineas';

/**
 * Biología 2010 question 108 gives four curves as the options and asks
 * which one describes the process, so these shapes have to be
 * distinguishable from each other at a glance.
 */

test('accepts a named shape with no data', () => {
  assert.equal(g.validar({ forma: 'saturacion' }).valida, true);
});

test('accepts an explicit series', () => {
  assert.equal(g.validar({ puntos: [{ x: 0, y: 0 }, { x: 1, y: 5 }] }).valida, true);
});

test('rejects a figure with neither points nor a shape', () => {
  const r = g.validar({});
  assert.equal(r.valida, false);
  assert.match(r.error ?? '', /puntos o una forma/);
});

test('rejects an unknown shape rather than drawing something else', () => {
  assert.equal(g.validar({ forma: 'espiral' as never }).valida, false);
});

test('rejects a series too short to be a line', () => {
  assert.equal(g.validar({ puntos: [{ x: 0, y: 1 }] }).valida, false);
});

test('rejects points that are not numbers', () => {
  assert.equal(g.validar({ puntos: [{ x: 0, y: NaN }, { x: 1, y: 2 }] }).valida, false);
});

test('rejects a series with no spread in x, which cannot be scaled', () => {
  const r = g.validar({ puntos: [{ x: 3, y: 0 }, { x: 3, y: 9 }] });
  assert.equal(r.valida, false);
  assert.match(r.error ?? '', /misma x/);
});

test('the four shapes draw four different curves', () => {
  // If two options shared a path, the question would have two right
  // answers — the exact defect the verifier exists to catch.
  const paths = (['creciente', 'decreciente', 'saturacion', 'campana'] as const).map((forma) => {
    const svg = g.dibujar({ forma });
    return svg.match(/<path d="(M[^"]+)"/)?.[1];
  });
  assert.equal(new Set(paths).size, 4, 'each shape is visually distinct');
});

test('a constant series still draws, instead of collapsing onto the axis', () => {
  const svg = g.dibujar({ forma: 'constante' });
  const d = svg.match(/<path d="(M[^"]+)"/)?.[1] ?? '';
  const ys = [...d.matchAll(/[ML] [\d.]+ ([\d.]+)/g)].map((m) => Number(m[1]));
  assert.ok(ys.length > 2);
  assert.ok(ys.every((y) => y > 20 && y < 200), 'the line sits inside the frame');
});

test('the drawing carries the axis titles the question uses', () => {
  const svg = g.dibujar({ forma: 'creciente', tituloEjeX: 'Tiempo', tituloEjeY: 'Biomasa' });
  assert.ok(svg.includes('Tiempo') && svg.includes('Biomasa'));
});

test('describes its shape in words, for a screen reader', () => {
  const d = g.describir({ forma: 'saturacion', tituloEjeX: 'Tiempo', tituloEjeY: 'Población' });
  assert.match(d, /estabiliza/);
  assert.match(d, /Población/);
});
