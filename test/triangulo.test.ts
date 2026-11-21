import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { trianguloRectangulo as t } from '../src/figuras/triangulo-rectangulo';

/**
 * The point of drawing from parameters is that the picture cannot
 * disagree with the question, so these pin that it does not.
 */

test('accepts a plain 3-4-5 triangle', () => {
  assert.equal(t.validar({ altura: 4, base: 3 }).valida, true);
});

test('rejects sides that are not positive numbers', () => {
  for (const bad of [{ altura: 0, base: 3 }, { altura: -2, base: 3 }, { altura: 4 }, null, 'x']) {
    assert.equal(t.validar(bad).valida, false, `should reject ${JSON.stringify(bad)}`);
  }
});

test('rejects a sliver no reader could measure', () => {
  const r = t.validar({ altura: 200, base: 3 });
  assert.equal(r.valida, false);
  assert.match(r.error ?? '', /ilegible/);
});

test('the drawing carries the numbers the question states', () => {
  const svg = t.dibujar({ altura: 4, base: 3 });
  assert.match(svg, /<svg/);
  assert.ok(svg.includes('>3<'), 'base label present');
  assert.ok(svg.includes('>4<'), 'height label present');
  // 3-4-5: the hypotenuse is a whole number, so it is drawn.
  assert.ok(svg.includes('>5<'), 'hypotenuse computed, not assumed');
});

test('an unknown hypotenuse is left as a question mark', () => {
  const svg = t.dibujar({ altura: 4, base: 5 });
  assert.ok(svg.includes('>?<'), 'non-integer hypotenuse is not invented');
});

test('labels override the raw numbers, so units survive', () => {
  const svg = t.dibujar({ altura: 4, base: 3, etiquetaBase: '3 m', etiquetaAltura: '4 m' });
  assert.ok(svg.includes('>3 m<') && svg.includes('>4 m<'));
});

test('the figure scales, so small and large numbers both draw the same shape', () => {
  const chico = t.dibujar({ altura: 4, base: 3 });
  const grande = t.dibujar({ altura: 400, base: 300 });
  const puntos = (s: string) => s.match(/points="([^"]+)"/)?.[1];
  assert.equal(puntos(chico), puntos(grande), 'same proportions, same drawing');
});

test('every figure describes itself for a screen reader', () => {
  const d = t.describir({ altura: 4, base: 3, contexto: 'escalera' });
  assert.match(d, /escalera/);
  assert.match(d, /3/);
  assert.match(d, /4/);
});
