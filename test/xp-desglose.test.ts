import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { desglosar, resumirDesglose, type EventoXp } from '../src/dashboard/xp-desglose';

/**
 * Where a learner's XP came from.
 *
 * The ledger has recorded a reason for every award since it was built
 * and nothing ever showed it. A total with no explanation is a reward;
 * the same number with its source is feedback, and that distinction is
 * what decides whether it helps or hurts.
 */

function ev(reason: string, amount: number): EventoXp {
  return { reason, amount, createdAt: new Date('2026-11-23T10:00:00Z') };
}

test('agrupa por lo que ganó el XP, lo mayor primero', () => {
  const filas = desglosar([
    ev('session_time', 10),
    ev('session_correct', 40),
    ev('mission_completed', 25),
  ]);
  assert.deepEqual(
    filas.map((f) => f.etiqueta),
    ['Respuestas correctas', 'Retos completados', 'Tiempo estudiando'],
  );
  assert.equal(filas[0]!.xp, 40);
});

test('las dos razones de acierto cuentan como una', () => {
  /* `session_correct` is the session's estimate and
     `answer_correct_adjustment` its correction. Two rows saying
     "respuestas correctas" would be an implementation detail leaking
     into a learner's screen. */
  const filas = desglosar([
    ev('session_correct', 30),
    ev('answer_correct_adjustment', 10),
  ]);
  assert.equal(filas.length, 1);
  assert.equal(filas[0]!.xp, 40);
  assert.equal(filas[0]!.veces, 2);
});

test('una razón desconocida no se le muestra en crudo', () => {
  // A learner must never be shown `algo_nuevo_sin_etiqueta`.
  const filas = desglosar([ev('algo_nuevo_sin_etiqueta', 5)]);
  assert.equal(filas[0]!.etiqueta, 'Otros');
});

test('un ajuste negativo no desordena el resultado', () => {
  /* Corrections can remove XP. Sorting by count instead of by amount
     would put a single large award below many small ones. */
  const filas = desglosar([
    ev('session_correct', 100),
    ev('answer_correct_adjustment', -20),
    ev('session_time', 5),
    ev('session_time', 5),
    ev('session_time', 5),
  ]);
  assert.equal(filas[0]!.etiqueta, 'Respuestas correctas');
  assert.equal(filas[0]!.xp, 80);
});

test('sin eventos, no hay desglose ni frase', () => {
  assert.deepEqual(desglosar([]), []);
  assert.equal(resumirDesglose([]), null);
});

test('la frase nombra la fuente mayor con su porcentaje', () => {
  const filas = desglosar([ev('session_correct', 80), ev('session_time', 20)]);
  const frase = resumirDesglose(filas);
  assert.match(frase ?? '', /80%/);
  assert.match(frase ?? '', /respuestas correctas/);
});

test('si nada domina, no se afirma que algo domina', () => {
  /* Three sources at a third each: saying "40% viene de X" would be
     true of nothing and misleading about everything. */
  const filas = desglosar([
    ev('session_correct', 30),
    ev('session_time', 30),
    ev('mission_completed', 30),
  ]);
  assert.equal(resumirDesglose(filas), null);
});

test('la frase ignora las filas en cero o negativas', () => {
  const filas = desglosar([ev('session_correct', 50), ev('answer_correct_adjustment', 0)]);
  const frase = resumirDesglose(filas);
  assert.match(frase ?? '', /100%/);
});
