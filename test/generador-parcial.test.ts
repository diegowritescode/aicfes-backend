import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';

/**
 * Asking for three questions and receiving two is the normal outcome
 * when the quality checks do their job: an item is a duplicate of one
 * already in the bank, or the cross-model verifier will not confirm
 * its answer.
 *
 * The generator used to answer that case with an empty list. A learner
 * asking for three practice questions was told "no se pudo generar"
 * while two verified, already-paid-for questions were thrown away —
 * which is also how this was found, running the app as a student.
 *
 * Driving the real generator here would mean standing up OpenAI, the
 * bank and the verifier, so the source is read instead: this pins the
 * decision, which is the part that was wrong.
 */

const fuente = readFileSync(
  path.join(__dirname, '../src/items/services/item-generator.service.ts'),
  'utf-8',
);

/** The block that runs when fewer items than asked for survive. */
function bloqueDeFaltantes(): string {
  const marca = 'if (validatedItems.length !== n)';
  const inicio = fuente.indexOf(marca);
  assert.ok(inicio > 0, 'el generador sigue comparando la cantidad pedida');
  // Up to the corrective retry message, which is the other branch.
  const fin = fuente.indexOf('ERROR CRÍTICO', inicio);
  assert.ok(fin > inicio);
  return fuente.slice(inicio, fin);
}

test('un resultado incompleto se entrega, no se descarta', () => {
  const bloque = bloqueDeFaltantes();
  assert.ok(
    !/items:\s*\[\]/.test(bloque),
    'tras los reintentos ya no debe devolver una lista vacía',
  );
  assert.ok(
    /parseStatus:\s*'OK'/.test(bloque),
    'lo que pasó las verificaciones es un resultado válido',
  );
});

test('las preguntas parciales también se barajan', () => {
  // Without this the correct answer keeps the position the model gave
  // it, which over a session is a pattern a learner can exploit.
  const bloque = bloqueDeFaltantes();
  assert.match(bloque, /randomizeCorrectAnswerPosition/);
});

test('se informa cuántas preguntas se entregaron', () => {
  const bloque = bloqueDeFaltantes();
  assert.match(
    bloque,
    /parseError:/,
    'la respuesta dice que llegaron menos de las pedidas',
  );
});

test('sin ningún ítem válido sigue siendo un fallo', () => {
  // Nothing usable is a real failure and must stay one: the learner
  // should be told, not handed an empty practice session.
  const marca = 'if (validatedItems.length === 0)';
  const inicio = fuente.indexOf(marca);
  assert.ok(inicio > 0);
  const bloque = fuente.slice(inicio, inicio + 600);
  assert.match(bloque, /parseStatus:\s*'FAIL'/);
});
