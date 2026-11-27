import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { inicioDeSemana, rotuloDeSemana } from '../src/informe/model/semana';

/**
 * The week is what keeps a report from being paid for twice.
 *
 * `InformeSemanal` is unique on `[userId, semanaInicio]`, so opening
 * the screen on Tuesday after opening it on Monday reads the stored
 * row instead of calling the model again. That guarantee is exactly
 * as good as this function: if two moments inside one week disagree
 * about which Monday they belong to, the unique index does nothing
 * and the learner is billed twice.
 *
 * The timezone cases are the ones that matter. The server runs in UTC
 * and the learners are in Bogotá, five hours behind: every Sunday
 * evening there is already Monday here.
 */

const BOGOTA = 'America/Bogota';

test('todos los días de una semana apuntan al mismo lunes', () => {
  /* 24 Nov 2026 is a Tuesday. Monday is the 23rd. */
  const lunes = inicioDeSemana(new Date('2026-11-23T15:00:00Z'), 'UTC');

  for (const dia of [23, 24, 25, 26, 27, 28, 29]) {
    const fecha = new Date(`2026-11-${dia}T15:00:00Z`);
    assert.equal(
      inicioDeSemana(fecha, 'UTC').toISOString(),
      lunes.toISOString(),
      `el día ${dia} debería caer en la misma semana`,
    );
  }
});

test('el lunes siguiente empieza una semana nueva', () => {
  const estaSemana = inicioDeSemana(new Date('2026-11-29T23:59:00Z'), 'UTC');
  const siguiente = inicioDeSemana(new Date('2026-11-30T00:01:00Z'), 'UTC');

  assert.notEqual(estaSemana.toISOString(), siguiente.toISOString());
});

test('el domingo pertenece a la semana que termina, no a la que empieza', () => {
  /* The off-by-one worth a test of its own: `getUTCDay()` calls Sunday
     0, and stepping back one day instead of six would file it under
     the week about to begin. */
  const domingo = inicioDeSemana(new Date('2026-11-29T12:00:00Z'), 'UTC');
  const miercoles = inicioDeSemana(new Date('2026-11-25T12:00:00Z'), 'UTC');

  assert.equal(domingo.toISOString(), miercoles.toISOString());
  assert.equal(domingo.toISOString(), '2026-11-23T00:00:00.000Z');
});

test('el lunes es el inicio, no el domingo', () => {
  const inicio = inicioDeSemana(new Date('2026-11-25T12:00:00Z'), 'UTC');
  assert.equal(inicio.getUTCDay(), 1);
});

test('la semana se decide en la zona del estudiante, no en la del servidor', () => {
  /* Monday 23 Nov at 02:00 UTC is still Sunday 22 at 21:00 in Bogotá.
     The learner has not started a new week yet, and a server that
     said otherwise would hand them a report for a week they have not
     lived. */
  const momento = new Date('2026-11-23T02:00:00Z');

  assert.equal(inicioDeSemana(momento, 'UTC').toISOString(), '2026-11-23T00:00:00.000Z');
  assert.equal(inicioDeSemana(momento, BOGOTA).toISOString(), '2026-11-16T00:00:00.000Z');
});

test('una zona horaria inválida no rompe el cálculo', () => {
  /* `timezone` is a free string on `User`. A broken one must degrade
     to UTC, not throw: a learner with a bad value in that column
     would otherwise lose the whole screen. */
  const inicio = inicioDeSemana(new Date('2026-11-25T12:00:00Z'), 'Marte/Olympus');
  assert.equal(inicio.toISOString(), '2026-11-23T00:00:00.000Z');
});

test('el rótulo dice el rango completo', () => {
  const inicio = new Date('2026-11-23T00:00:00Z');
  assert.equal(rotuloDeSemana(inicio), 'del 23 al 29 de noviembre');
});

test('una semana a caballo entre dos meses nombra los dos', () => {
  /* 30 Nov 2026 is a Monday, so that week ends on 6 December. A label
     that said «del 30 al 6 de diciembre» would read as a week that
     runs backwards. */
  const inicio = new Date('2026-11-30T00:00:00Z');
  assert.equal(rotuloDeSemana(inicio), 'del 30 de noviembre al 6 de diciembre');
});
