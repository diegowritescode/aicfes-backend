import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { planoCartesiano as p } from '../src/figuras/plano-cartesiano';

/**
 * A learner reads coordinates off this grid, so a point drawn in the
 * wrong place makes the question unanswerable rather than merely ugly.
 */

const circulos = (svg: string) =>
  [...svg.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)"/g)].map((m) => ({
    cx: Number(m[1]),
    cy: Number(m[2]),
  }));

test('accepts points, a line and a parabola', () => {
  assert.equal(p.validar({ puntos: [{ x: 2, y: 3 }] }).valida, true);
  assert.equal(p.validar({ funciones: [{ tipo: 'recta', m: 2, b: -1 }] }).valida, true);
  assert.equal(p.validar({ funciones: [{ tipo: 'parabola', a: 1, b: 0, c: -4 }] }).valida, true);
});

test('rejects an empty figure', () => {
  const r = p.validar({});
  assert.equal(r.valida, false);
  assert.match(r.error ?? '', /punto o una función/);
});

test('rejects a parabola that is really a line', () => {
  const r = p.validar({ funciones: [{ tipo: 'parabola', a: 0, b: 2, c: 1 }] });
  assert.equal(r.valida, false);
  assert.match(r.error ?? '', /a = 0/);
});

test('rejects coordinates that are not numbers', () => {
  assert.equal(p.validar({ puntos: [{ x: 1, y: Infinity }] }).valida, false);
});

test('rejects more than it can show legibly', () => {
  const muchos = Array.from({ length: 13 }, (_, i) => ({ x: i, y: i }));
  assert.equal(p.validar({ puntos: muchos }).valida, false);
});

test('y grows upward, as in maths and not as in SVG', () => {
  const svg = p.dibujar({ puntos: [{ x: 0, y: 1 }, { x: 0, y: 5 }] });
  const [bajo, alto] = circulos(svg);
  // A larger y must render nearer the top, which is a smaller cy.
  assert.ok((alto?.cy ?? 0) < (bajo?.cy ?? 0), 'y = 5 sits above y = 1');
});

test('a point and its reflection land either side of an axis', () => {
  const svg = p.dibujar({ puntos: [{ x: -3, y: 0 }, { x: 3, y: 0 }] });
  const [izq, der] = circulos(svg);
  assert.ok((izq?.cx ?? 0) < (der?.cx ?? 0));
  // Symmetric about x = 0, so equally far from the midpoint.
  const medio = ((izq?.cx ?? 0) + (der?.cx ?? 0)) / 2;
  assert.ok(Math.abs(medio - 170) < 2, 'centred on the frame');
});

test('the window grows with the data instead of cropping it', () => {
  // A question about values near 100 must not draw them off-frame.
  const svg = p.dibujar({ puntos: [{ x: 100, y: 80, etiqueta: 'P' }] });
  const [punto] = circulos(svg);
  assert.ok(punto, 'the point is drawn');
  assert.ok((punto?.cx ?? 0) > 30 && (punto?.cx ?? 0) < 310, 'inside the frame');
  assert.ok(svg.includes('>P<'), 'its label too');
});

test('a curve leaving the window is cut, not drawn across the frame', () => {
  // y = 100x exits almost immediately; a single M..L would otherwise
  // slash a false straight line over the whole picture.
  const svg = p.dibujar({
    funciones: [{ tipo: 'recta', m: 100, b: 0 }],
    xMin: -10, xMax: 10, yMin: -10, yMax: 10,
  });
  const d = svg.match(/<path d="([^"]+)"/)?.[1] ?? '';
  const puntosTrazados = (d.match(/[ML]/g) ?? []).length;
  assert.ok(puntosTrazados < 40, 'only the visible part is drawn');
});

test('a parabola is drawn as a curve, not as segments between two points', () => {
  const svg = p.dibujar({
    funciones: [{ tipo: 'parabola', a: 1, b: 0, c: -4 }],
    xMin: -5, xMax: 5, yMin: -5, yMax: 10,
  });
  const d = svg.match(/<path d="([^"]+)"/)?.[1] ?? '';
  assert.ok((d.match(/L/g) ?? []).length > 20, 'sampled densely enough to curve');
});

test('describes its contents for a screen reader', () => {
  const d = p.describir({
    puntos: [{ x: 2, y: 3, etiqueta: 'A' }],
    funciones: [{ tipo: 'recta', m: 2, b: -1 }],
  });
  assert.match(d, /A en \(2, 3\)/);
  assert.match(d, /y = 2x \+ -1/);
});
