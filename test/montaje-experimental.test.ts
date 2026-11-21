import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { montajeExperimental as m } from '../src/figuras/montaje-experimental';

const valido = {
  montajes: [
    { nombre: 'Montaje 1', contenido: 'agua', condicion: '10 °C', nivel: 0.5 },
    { nombre: 'Montaje 2', contenido: 'agua', condicion: '40 °C', nivel: 0.5 },
  ],
};

test('accepts a two-vessel comparison', () => {
  assert.equal(m.validar(valido).valida, true);
});

test('rejects a single vessel, which compares nothing', () => {
  const r = m.validar({ montajes: [{ nombre: 'Uno' }] });
  assert.equal(r.valida, false);
  assert.match(r.error ?? '', /de 2 a 5/);
});

test('rejects more vessels than fit side by side', () => {
  const seis = Array.from({ length: 6 }, (_, i) => ({ nombre: `M${i}` }));
  assert.equal(m.validar({ montajes: seis }).valida, false);
});

test('rejects a fill level outside zero to one', () => {
  const r = m.validar({ montajes: [{ nombre: 'A', nivel: 1.5 }, { nombre: 'B' }] });
  assert.equal(r.valida, false);
  assert.match(r.error ?? '', /nivel fuera/);
});

test('rejects an unknown vessel rather than drawing a default', () => {
  assert.equal(
    m.validar({ montajes: [{ nombre: 'A', tipo: 'probeta' as never }, { nombre: 'B' }] }).valida,
    false,
  );
});

test('every label the question states appears in the drawing', () => {
  const svg = m.dibujar(valido);
  for (const texto of ['Montaje 1', 'Montaje 2', 'agua', '10 °C', '40 °C']) {
    assert.ok(svg.includes(texto), `${texto} is drawn`);
  }
});

test('a fuller vessel draws more liquid', () => {
  const alturas = [0.2, 0.9].map((nivel) => {
    const svg = m.dibujar({ montajes: [{ nombre: 'A', nivel }, { nombre: 'B', nivel }] });
    return Number(svg.match(/<rect[^>]*height="([\d.]+)"/)?.[1] ?? 0);
  });
  assert.ok((alturas[1] ?? 0) > (alturas[0] ?? 0), 'level drives the drawing');
});

test('an empty vessel draws no liquid at all', () => {
  const svg = m.dibujar({ montajes: [{ nombre: 'A', nivel: 0 }, { nombre: 'B', nivel: 0 }] });
  assert.ok(!svg.includes('fill-opacity="0.35"'), 'nothing inside');
});

test('the three vessel shapes draw differently', () => {
  const formas = (['vaso', 'tubo', 'matraz'] as const).map(
    (tipo) => m.dibujar({ montajes: [{ nombre: 'A', tipo }, { nombre: 'B', tipo }] }).length,
  );
  assert.equal(new Set(formas).size, 3, 'each shape is its own drawing');
});

test('labels cannot inject markup', () => {
  // Labels come from the model, so they are untrusted input.
  const svg = m.dibujar({
    montajes: [{ nombre: '<script>x</script>' }, { nombre: 'B & C' }],
  });
  assert.ok(!svg.includes('<script>'));
  assert.ok(svg.includes('&lt;script&gt;') && svg.includes('B &amp; C'));
});

test('describes each vessel for a screen reader', () => {
  const d = m.describir(valido);
  assert.match(d, /Montaje 1, con agua, a 10 °C/);
  assert.match(d, /50%/);
});
