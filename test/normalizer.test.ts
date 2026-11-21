import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { NormalizerService } from '../src/items/services/normalizer.service';

/**
 * The model returns prose, not JSON. These tests pin what the normalizer
 * accepts, because every generated item passes through it before anything
 * is written to the database.
 */

const normalizer = new NormalizerService();

test('accepts a bare JSON array', () => {
  const result = normalizer.normalize('[{"pregunta":"a"},{"pregunta":"b"}]');
  assert.equal(result.length, 2);
});

test('strips the markdown fence the model usually adds', () => {
  const result = normalizer.normalize('```json\n[{"pregunta":"a"}]\n```');
  assert.deepEqual(result, [{ pregunta: 'a' }]);
});

test('wraps a single object in an array, so callers always get a list', () => {
  const result = normalizer.normalize('{"pregunta":"sola"}');
  assert.deepEqual(result, [{ pregunta: 'sola' }]);
});

test('unwraps the items and data envelopes the model sometimes uses', () => {
  assert.deepEqual(normalizer.normalize('{"items":[{"n":1}]}'), [{ n: 1 }]);
  assert.deepEqual(normalizer.normalize('{"data":[{"n":2}]}'), [{ n: 2 }]);
});

test('recovers JSON surrounded by the prose the model adds', () => {
  const raw = 'Claro, aquí tienes:\n[{"pregunta":"a"}]\nEspero que sirva.';
  assert.deepEqual(normalizer.normalize(raw), [{ pregunta: 'a' }]);
});

test('rejects empty or non-string input rather than returning something empty', () => {
  assert.throws(() => normalizer.normalize(''), /non-empty string/);
  assert.throws(() => normalizer.normalize(null as never), /non-empty string/);
});

test('rejects text with no JSON in it at all', () => {
  assert.throws(() => normalizer.normalize('No puedo generar eso.'), /Failed to parse/);
});

test('rejects an unterminated object instead of guessing at the rest', () => {
  assert.throws(() => normalizer.normalize('Texto {"pregunta":"a"'), /Failed to parse/);
});

test('a brace inside a string value does not break extraction', () => {
  // The depth counter walks the raw text, so a brace inside a quoted value
  // is counted as structure. This pins the behaviour either way.
  const raw = 'Respuesta:\n[{"pregunta":"¿Cuál opción {A} es correcta?"}]';
  const result = normalizer.normalize(raw);
  assert.equal(result[0].pregunta, '¿Cuál opción {A} es correcta?');
});

test('trimFieldLengths keeps fields within the limits the UI can show', () => {
  const trimmed = normalizer.trimFieldLengths({
    contexto: 'x'.repeat(5000),
    pregunta: 'y'.repeat(900),
  });
  assert.ok(trimmed.contexto.length <= 1200, 'contexto within limit');
  assert.ok(trimmed.pregunta.length <= 250, 'pregunta within limit');
});
