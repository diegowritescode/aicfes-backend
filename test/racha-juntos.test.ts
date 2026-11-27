import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { lunesDe, rachaJuntos } from '../src/duelos/model/racha-juntos';

/**
 * Weeks in a row two learners have duelled.
 *
 * Computed from the duels rather than stored, so the interesting part
 * is the boundary rules: what keeps a streak alive, what breaks it,
 * and what the current week does before anybody has played in it.
 */

const LUNES = new Date('2026-11-23T12:00:00Z');

/** A moment `n` weeks before the reference Monday. */
function semanasAntes(n: number): Date {
  const d = new Date(LUNES);
  d.setUTCDate(d.getUTCDate() - n * 7);
  return d;
}

test('sin duelos no hay racha', () => {
  const r = rachaJuntos([], LUNES);

  assert.equal(r.semanas, 0);
  assert.equal(r.duelos, 0);
  assert.equal(r.estaSemanaYa, false);
});

test('un duelo esta semana es una semana de racha', () => {
  const r = rachaJuntos([LUNES], LUNES);

  assert.equal(r.semanas, 1);
  assert.equal(r.estaSemanaYa, true);
});

test('tres semanas seguidas cuentan tres', () => {
  const r = rachaJuntos([semanasAntes(0), semanasAntes(1), semanasAntes(2)], LUNES);

  assert.equal(r.semanas, 3);
});

test('varios duelos en la misma semana cuentan como una', () => {
  /* The streak is about coming back, not about volume. Otherwise one
     afternoon of five duels would read as five weeks of friendship. */
  const lunes = new Date('2026-11-23T10:00:00Z');
  const miercoles = new Date('2026-11-25T10:00:00Z');
  const viernes = new Date('2026-11-27T10:00:00Z');

  const r = rachaJuntos([lunes, miercoles, viernes], LUNES);

  assert.equal(r.semanas, 1);
  assert.equal(r.duelos, 3, 'el total sí los cuenta todos');
});

test('una semana sin duelos corta la racha', () => {
  /* Weeks 0 and 2 played, week 1 empty: the streak is the current run
     only, which is one. */
  const r = rachaJuntos([semanasAntes(0), semanasAntes(2)], LUNES);

  assert.equal(r.semanas, 1);
});

test('la semana en curso vacía no rompe lo ya logrado', () => {
  /* It is Monday morning for somebody. A streak that resets at
     midnight on Sunday would be lost by most pairs before they had a
     chance to act on it, which teaches them not to look at it. */
  const r = rachaJuntos([semanasAntes(1), semanasAntes(2), semanasAntes(3)], LUNES);

  assert.equal(r.semanas, 3);
  assert.equal(r.estaSemanaYa, false, 'pero sí dice que falta esta semana');
});

test('dos semanas sin jugar sí la rompen', () => {
  /* The grace is one week, not indefinite. */
  const r = rachaJuntos([semanasAntes(2), semanasAntes(3)], LUNES);

  assert.equal(r.semanas, 0);
});

test('duelos viejos sueltos no inflan la racha', () => {
  const r = rachaJuntos([semanasAntes(0), semanasAntes(10), semanasAntes(20)], LUNES);

  assert.equal(r.semanas, 1);
  assert.equal(r.duelos, 3);
});

/**
 * The week boundary.
 */

test('el domingo pertenece a la semana que termina, no a la que empieza', () => {
  /* `getUTCDay` makes Sunday 0, and the off-by-one here would move a
     Sunday duel into the week ahead — breaking a streak the pair had
     just kept alive. */
  const domingo = new Date('2026-11-22T23:00:00Z');
  const lunesPrevio = new Date('2026-11-16T00:00:00Z');

  assert.equal(lunesDe(domingo), lunesPrevio.getTime());
});

test('el lunes a medianoche ya es la semana nueva', () => {
  const lunes = new Date('2026-11-23T00:00:00Z');

  assert.equal(lunesDe(lunes), lunes.getTime());
});

test('dos momentos de la misma semana dan el mismo lunes', () => {
  assert.equal(
    lunesDe(new Date('2026-11-23T00:00:00Z')),
    lunesDe(new Date('2026-11-29T23:59:59Z')),
  );
});
