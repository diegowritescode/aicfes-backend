import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  diasDesdeElPerdon,
  rachaConPerdon,
} from '../src/dashboard/utils/racha-perdon';

/**
 * A streak that survives one missed day a month.
 *
 * A streak that snaps after one bad day punishes the learner for the
 * thing the product exists to help with, which is the contingency ADR
 * 10 records as measuring negative. The question each test answers is
 * where the line sits: forgiving too much makes the number a lie,
 * forgiving too little makes it a punishment.
 */

const HOY = '2026-11-23';

test('sin huecos, la racha cuenta normal', () => {
  const r = rachaConPerdon(['2026-11-21', '2026-11-22', '2026-11-23'], HOY);
  assert.equal(r.dias, 3);
  assert.equal(r.perdonUsado, false);
});

test('un día saltado se perdona y la racha sigue', () => {
  /* Studied Friday and Sunday, missed Saturday. Three days of effort
     and the old rule would report one. */
  const r = rachaConPerdon(['2026-11-20', '2026-11-21', '2026-11-23'], HOY);
  assert.equal(r.dias, 3);
  assert.equal(r.perdonUsado, true);
  assert.equal(r.diaPerdonado, '2026-11-22');
});

test('dos días seguidos sin estudiar sí rompen', () => {
  // Not a gap to forgive: a streak that keeps rising for someone who
  // is not there is a number that means nothing.
  const r = rachaConPerdon(['2026-11-19', '2026-11-20', '2026-11-23'], HOY);
  assert.equal(r.dias, 1);
  assert.equal(r.perdonUsado, false);
});

test('estudiar día por medio no es una racha', () => {
  /* Three separate gaps. The first version of this test expected the
     most recent one to be forgiven, which would have reported a
     streak of two — but a forgiveness is for a bad day inside a
     habit, and this is the habit being every other day.
     
     What stops it is the thirty-day rule working as intended: an
     earlier gap counts as a forgiveness already spent, so the next
     one is refused. */
  const r = rachaConPerdon(
    ['2026-11-17', '2026-11-19', '2026-11-21', '2026-11-23'],
    HOY,
    diasDesdeElPerdon(['2026-11-17', '2026-11-19', '2026-11-21', '2026-11-23'], HOY),
  );
  assert.equal(r.dias, 1);
  assert.equal(r.perdonUsado, false);
});

test('el perdón no se repite antes de treinta días', () => {
  const sinDerecho = rachaConPerdon(['2026-11-20', '2026-11-21', '2026-11-23'], HOY, 5);
  assert.equal(sinDerecho.dias, 1);
  assert.equal(sinDerecho.perdonUsado, false);

  const conDerecho = rachaConPerdon(['2026-11-20', '2026-11-21', '2026-11-23'], HOY, 31);
  assert.equal(conDerecho.dias, 3);
});

test('faltar ayer también se perdona', () => {
  /* The most common way a streak breaks: studied up to the day
     before yesterday, missed yesterday, opened the app today. */
  const r = rachaConPerdon(['2026-11-20', '2026-11-21'], HOY);
  assert.equal(r.dias, 2);
  assert.equal(r.perdonUsado, true);
  assert.equal(r.diaPerdonado, '2026-11-22');
});

test('tres días sin aparecer no se rescatan', () => {
  const r = rachaConPerdon(['2026-11-18', '2026-11-19', '2026-11-20'], HOY);
  assert.equal(r.dias, 0);
});

test('sin historial no hay racha', () => {
  assert.equal(rachaConPerdon([], HOY).dias, 0);
});

test('fechas repetidas no inflan la racha', () => {
  // Several sessions in one day is one day.
  const r = rachaConPerdon(['2026-11-23', '2026-11-23', '2026-11-22'], HOY);
  assert.equal(r.dias, 2);
});

test('un solo día de estudio es una racha de uno', () => {
  assert.equal(rachaConPerdon([HOY], HOY).dias, 1);
});

test('el hueco de ahora no cuenta como un perdón ya gastado', () => {
  /* The defect that shipped: `diasDesdeElPerdon` found the gap the
     forgiveness was about to cover and reported it as one already
     spent, so the rule refused itself. Verified against production —
     a learner who missed yesterday got a streak of one. */
  const fechas = ['2026-11-20', '2026-11-21', '2026-11-23'];
  assert.equal(diasDesdeElPerdon(fechas, HOY), Infinity);

  const r = rachaConPerdon(fechas, HOY, diasDesdeElPerdon(fechas, HOY));
  assert.equal(r.dias, 3);
  assert.equal(r.perdonUsado, true);
});

test('un perdón viejo de verdad sí bloquea otro', () => {
  // Studied daily for a stretch, with one gap three weeks ago.
  const fechas = [
    '2026-11-01', '2026-11-03', '2026-11-04', '2026-11-05',
    '2026-11-20', '2026-11-21', '2026-11-23',
  ];
  assert.ok(diasDesdeElPerdon(fechas, HOY) < 30);
});
