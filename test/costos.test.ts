import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { CostosService } from '../src/items/services/costos.service';

/**
 * These numbers decide what a subscription has to cost, so the
 * arithmetic is pinned rather than trusted.
 */

const c = CostosService.calcular;

test('prices a known model from its published rate', () => {
  // gpt-5-mini: $0.25 per million in, $2.00 per million out.
  // 1M in + 1M out = $2.25 = 225,000 thousandths of a cent.
  assert.equal(c('gpt-5-mini', 1_000_000, 1_000_000), 225_000);
});

test('a small request still costs something', () => {
  // Rounded up on purpose: a thousand requests of "free" is not free.
  const costo = c('gpt-5-mini', 100, 10);
  assert.ok(costo > 0, 'a tiny request is not free');
});

test('an unknown model is priced high, never at zero', () => {
  // Silently costing nothing is how a bill becomes a surprise.
  const desconocido = c('modelo-que-no-existe', 1_000_000, 1_000_000);
  assert.ok(desconocido > 0);
  assert.ok(desconocido >= c('gpt-5-mini', 1_000_000, 1_000_000));
});

test('output tokens cost more than input, as the rates say', () => {
  const entrada = c('claude-opus-5-5', 1_000_000, 0);
  const salida = c('claude-opus-5-5', 0, 1_000_000);
  assert.ok(salida > entrada, '$20 out against $4 in');
  assert.equal(salida / entrada, 5);
});

test('embeddings have no output cost', () => {
  assert.equal(c('text-embedding-3-small', 0, 1_000_000), 0);
  assert.ok(c('text-embedding-3-small', 1_000_000, 0) > 0);
});

test('cost scales linearly with tokens', () => {
  const uno = c('gpt-5-mini', 1_000_000, 1_000_000);
  const diez = c('gpt-5-mini', 10_000_000, 10_000_000);
  assert.equal(diez, uno * 10);
});

test('is always a whole number of thousandths', () => {
  // Money held as a float drifts over millions of rows.
  for (const n of [1, 37, 999, 123_456]) {
    assert.ok(Number.isInteger(c('gpt-5-mini', n, n)), `integer for ${n}`);
  }
});
