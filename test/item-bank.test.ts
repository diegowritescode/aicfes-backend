import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { ItemBankService } from '../src/items/services/item-bank.service';

/**
 * Normalisation decides what counts as the same question, so the bank
 * is only as good as these rules.
 */

const h = ItemBankService.hashQuestion;
const n = ItemBankService.normaliseQuestion;

test('ignores case, accents and punctuation', () => {
  assert.equal(
    n('El Área del Círculo', '¿Cuál es?'),
    n('el area del circulo', 'cual es'),
  );
});

test('collapses runs of whitespace', () => {
  assert.equal(n('Un   texto', 'con\n\nsaltos'), 'un texto con saltos');
});

test('hashes two spellings of the same question alike', () => {
  assert.equal(
    h('El tendero vende manzanas.', '¿Cuánto cuestan TRES?'),
    h('el tendero  vende manzanas', 'cuanto cuestan tres'),
  );
});

test('hashes genuinely different questions differently', () => {
  assert.notEqual(
    h('El tendero vende manzanas.', '¿Cuánto cuestan tres?'),
    h('El tendero vende peras.', '¿Cuánto cuestan tres?'),
  );
});

test('a changed number is a different question', () => {
  // Numbers survive normalisation on purpose: 3 apples and 4 apples are
  // not the same item, however alike the wording.
  assert.notEqual(
    h('Manzanas a 2000 pesos.', '¿Cuánto cuestan 3?'),
    h('Manzanas a 2000 pesos.', '¿Cuánto cuestan 4?'),
  );
});

test('the hash is stable across calls', () => {
  const a = h('Contexto estable', 'Pregunta estable');
  const b = h('Contexto estable', 'Pregunta estable');
  assert.equal(a, b);
  assert.equal(a.length, 64);
});
