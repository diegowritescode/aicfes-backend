import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { AnswerVerifierService, type Verdict } from '../src/items/services/answer-verifier.service';
import type { Item } from '../src/items/schemas/item.schema';

/**
 * The verifier is the only thing standing between a confidently wrong
 * item and a student studying from it, so its decisions are pinned here.
 */

const item = {
  area: 'MAT',
  dificultad: 'media',
  plantilla: 'aritmética',
  contexto: 'Un tendero vende manzanas a 2000 pesos cada una.',
  pregunta: '¿Cuánto cuestan tres manzanas?',
  opciones: { A: '4000 pesos', B: '5000 pesos', C: '6000 pesos', D: '8000 pesos' },
  respuesta_correcta: 'C',
  justificacion: 'Tres manzanas a dos mil pesos cada una suman seis mil pesos en total.',
  tags: ['multiplicación'],
  distractores: { A: 'omite un factor', B: 'suma mal', C: 'correcta', D: 'multiplica de más' },
  explicaciones: {
    A: 'Cuatro mil corresponde a dos manzanas, no a tres unidades.',
    B: 'Cinco mil no resulta de ninguna operación válida sobre el enunciado.',
    C: 'Tres por dos mil es igual a seis mil pesos, que es lo pedido.',
    D: 'Ocho mil corresponde a cuatro manzanas en lugar de tres unidades.',
  },
} as unknown as Item;

/** Stands in for the model, returning whatever the test needs. */
const verifierWith = (verdict: Verdict | Error, enabled = true) => {
  const openai = {
    createStructured: async () => {
      if (verdict instanceof Error) throw verdict;
      return verdict;
    },
  };
  // Cross-family verification off here: these tests pin the judging
  // rules, which are the same whichever model produced the verdict.
  const claude = { disponible: false, resolver: async () => verdict as Verdict };
  const config = { get: (_k: string, d?: string) => (enabled ? d ?? 'true' : 'false') };
  return new AnswerVerifierService(openai as never, claude as never, config as never);
};

test('accepts an item the verifier solves the same way', async () => {
  const result = await verifierWith({ respuesta: 'C', confianza: 'alta', problema: 'ninguno' }).verify(item);
  assert.equal(result.accepted, true);
});

test('rejects an item whose claimed answer the verifier disagrees with', async () => {
  const result = await verifierWith({ respuesta: 'A', confianza: 'alta', problema: 'ninguno' }).verify(item);
  assert.equal(result.accepted, false);
  assert.match(result.reason ?? '', /respondió A/);
});

test('rejects an item the verifier reports as ambiguous, even when it agrees', async () => {
  const result = await verifierWith({ respuesta: 'C', confianza: 'alta', problema: 'ambigua' }).verify(item);
  assert.equal(result.accepted, false);
  assert.match(result.reason ?? '', /ambigua/);
});

test('rejects an item where more than one option is defensible', async () => {
  const result = await verifierWith({
    respuesta: 'C',
    confianza: 'alta',
    problema: 'varias_correctas',
  }).verify(item);
  assert.equal(result.accepted, false);
});

test('rejects a correct answer the verifier is not confident about', async () => {
  const result = await verifierWith({ respuesta: 'C', confianza: 'baja', problema: 'ninguno' }).verify(item);
  assert.equal(result.accepted, false);
  assert.match(result.reason ?? '', /confianza baja/);
});

test('rejects rather than approves when the verifier cannot be reached', async () => {
  // Failing open would let every item through exactly when the check is
  // broken, which is the worst moment to stop checking.
  const result = await verifierWith(new Error('timeout')).verify(item);
  assert.equal(result.accepted, false);
  assert.match(result.reason ?? '', /unavailable/);
});

test('passes everything through when verification is switched off', async () => {
  const result = await verifierWith(new Error('never called'), false).verify(item);
  assert.equal(result.accepted, true);
});

test('prefers the other model family when it is available', async () => {
  // The two must not be asked the same thing by the same model: that is
  // the whole point of the second family.
  let openaiLlamado = false;
  const openai = {
    createStructured: async () => {
      openaiLlamado = true;
      return { respuesta: 'A', confianza: 'alta', problema: 'ninguno' };
    },
  };
  const claude = {
    disponible: true,
    resolver: async () => ({ respuesta: 'C', confianza: 'alta', problema: 'ninguno' }),
  };
  const config = { get: (_k: string, d?: string) => d ?? 'true' };
  const service = new AnswerVerifierService(openai as never, claude as never, config as never);

  const result = await service.verify(item);
  assert.equal(result.accepted, true, 'Claude agreed with C, so the item stands');
  assert.equal(openaiLlamado, false, 'the generating family was not asked to check itself');
});

test('falls back to the single family when the other is not configured', async () => {
  const claude = {
    disponible: false,
    resolver: async () => {
      throw new Error('should not be called');
    },
  };
  const openai = {
    createStructured: async () => ({ respuesta: 'C', confianza: 'alta', problema: 'ninguno' }),
  };
  const config = { get: (_k: string, d?: string) => d ?? 'true' };
  const service = new AnswerVerifierService(openai as never, claude as never, config as never);

  assert.equal((await service.verify(item)).accepted, true);
});
