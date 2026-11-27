import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A duel round must never carry the answers, and now it carries more.
 *
 * `preguntas` grew: it used to send five questions and now sends the
 * rival's score too. That is the pressure the feature is for — a
 * learner answering in silence never knew they were racing anybody.
 * Growing the payload is exactly when a leak gets added by accident,
 * so this pins what may and may not travel.
 *
 * Knowing «Camilo got 4 of 5» tells a learner how hard to try.
 * Knowing WHICH four would tell them what to answer. A duel decided by
 * whoever reads the response body is not a duel.
 *
 * Reads the source: the real call needs a duel row, two users and five
 * bank items, and a stub of that would pass while the live select
 * leaked.
 */

const FUENTE = readFileSync(
  join(__dirname, '..', 'src', 'duelos', 'duelos.service.ts'),
  'utf8',
);

/** The body of `preguntas`, comments stripped. */
function cuerpo(): string {
  const desde = FUENTE.indexOf('async preguntas(');
  assert.notEqual(desde, -1, 'preguntas ya no se llama así');
  const resto = FUENTE.slice(desde);
  /* Ends at the next jsdoc block, which is the next method. */
  const hasta = resto.indexOf('\n  /**');
  const trozo = hasta === -1 ? resto : resto.slice(0, hasta);

  return trozo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

test('la ronda no manda la respuesta correcta', () => {
  assert.ok(
    !/respuesta_correcta/.test(cuerpo()),
    'respuesta_correcta en la ronda: el duelo lo gana quien lea la respuesta HTTP',
  );
});

test('la ronda no manda las explicaciones', () => {
  /* They name the right option in prose. */
  assert.ok(
    !/explicaciones/.test(cuerpo()),
    'las explicaciones nombran la opción correcta en palabras',
  );
});

test('la ronda manda la marca del rival', () => {
  const c = cuerpo();

  assert.match(c, /marcaDelRival/, 'sin la marca no hay presión: era el punto');
  assert.match(c, /paraGanar/);
});

test('la marca es un número, no las respuestas del rival', () => {
  const c = cuerpo();

  /* The mark is a score and a time. If it ever carried which
     questions the rival got right, it would be a cheat sheet. */
  assert.ok(
    !/resultadoRetador:\s*true[\s\S]{0,200}eleccion/.test(c),
    'las elecciones del rival viajarían con la marca',
  );
});

test('la ronda sigue exigiendo ser uno de los dos jugadores', () => {
  const c = cuerpo();

  assert.match(
    c,
    /retadorId !== userId && duelo\.rivalId !== userId/,
    'se perdió la comprobación de que quien pide es uno de los dos',
  );
  assert.match(c, /NO_EN_CURSO/, 'se perdió la comprobación de estado');
});
