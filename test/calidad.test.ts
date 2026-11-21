import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { CalidadService } from '../src/items/services/calidad.service';

/**
 * These thresholds decide which items reach a paying learner, so the
 * boundaries are pinned rather than left to drift.
 */

const conItem = (item: Record<string, unknown> | null) =>
  new CalidadService({
    generatedItem: { findUnique: async () => item },
  } as never);

const base = { id: 'x', tiempoTotalMs: BigInt(30_000 * 40), conteoOpciones: { A: 10, B: 10, C: 10, D: 10 } };

test('says nothing until there are enough answers', async () => {
  const s = await conItem({ ...base, vecesRespondido: 19, vecesCorrecto: 10 }).salud('x');
  assert.equal(s.veredicto, 'sin_datos');
  assert.equal(s.dificultad, null);
});

test('a middling item is healthy', async () => {
  const s = await conItem({ ...base, vecesRespondido: 40, vecesCorrecto: 24 }).salud('x');
  assert.equal(s.veredicto, 'sano');
  assert.equal(s.dificultad, 0.6);
});

test('almost nobody right means badly written, not hard', async () => {
  const s = await conItem({ ...base, vecesRespondido: 40, vecesCorrecto: 4 }).salud('x');
  assert.equal(s.veredicto, 'muy_dificil');
  assert.match(s.detalle ?? '', /mal redactado/);
});

test('almost everybody right means it separates nobody', async () => {
  const s = await conItem({ ...base, vecesRespondido: 40, vecesCorrecto: 39 }).salud('x');
  assert.equal(s.veredicto, 'muy_facil');
});

test('distractors nobody picks are reported', async () => {
  const s = await conItem({
    ...base,
    vecesRespondido: 40,
    vecesCorrecto: 24,
    conteoOpciones: { A: 0, B: 0, C: 24, D: 16 },
  }).salud('x');
  assert.equal(s.veredicto, 'distractor_muerto');
  assert.match(s.detalle ?? '', /A ni B/);
});

test('one unpicked distractor is tolerated', async () => {
  // Three live options still discriminate; two dead ones do not.
  const s = await conItem({
    ...base,
    vecesRespondido: 40,
    vecesCorrecto: 24,
    conteoOpciones: { A: 0, B: 8, C: 24, D: 8 },
  }).salud('x');
  assert.equal(s.veredicto, 'sano');
});

test('the mean time comes from the total', async () => {
  const s = await conItem({
    ...base,
    vecesRespondido: 40,
    vecesCorrecto: 24,
    tiempoTotalMs: BigInt(1_200_000),
  }).salud('x');
  assert.equal(s.tiempoMedioMs, 30_000);
});

test('an item that does not exist reports no data rather than throwing', async () => {
  const s = await conItem(null).salud('desconocido');
  assert.equal(s.veredicto, 'sin_datos');
});
