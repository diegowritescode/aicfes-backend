import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { MODOS, MODOS_RETIRADOS, SEGUNDOS_EXAMEN_REAL } from '../src/time-trial/modos';

/**
 * The ladder is the whole point of this mode, so the arithmetic that
 * makes it a ladder is pinned here.
 *
 * What it replaces: "Reto 5" (5 questions, 300s), "Sprint 10" (10,
 * 600s) and "Explosivo" (3, 180s) — all exactly sixty seconds a
 * question. Three modes that felt different and were not, while the
 * real exam gives 64 seconds. Practising at 60 is practising at exam
 * pace while being told it is a sprint.
 */

test('el examen real da 64 segundos por pregunta', () => {
  // 270 minutes for 254 questions. Every mode is positioned against
  // this number, so if it is wrong the whole ladder is wrong.
  assert.equal(SEGUNDOS_EXAMEN_REAL, Math.round((270 * 60) / 254));
});

test('cada modo cumple el ritmo que declara', () => {
  // The stored pace has to match the arithmetic, or the interface
  // would promise one thing and the clock do another.
  for (const modo of MODOS) {
    const real = Math.round(modo.timeLimitSeconds / modo.questions);
    assert.equal(
      real,
      modo.segundosPorPregunta,
      `${modo.id}: dice ${modo.segundosPorPregunta}s y da ${real}s`,
    );
  }
});

test('los niveles aprietan de verdad', () => {
  // The failure being fixed: three modes that all gave 60 seconds.
  const porNivel = [...MODOS].sort((a, b) => a.nivel - b.nivel);
  const ritmos = [...new Set(porNivel.map((m) => m.segundosPorPregunta))];
  assert.ok(ritmos.length >= 3, 'un escalón necesita ritmos distintos');

  const nivel1 = porNivel.find((m) => m.nivel === 1)!;
  const ultimo = porNivel[porNivel.length - 1];
  assert.ok(
    nivel1.segundosPorPregunta > ultimo.segundosPorPregunta * 2,
    'del primero al último el tiempo debe caer de forma notoria',
  );
});

test('hay un modo exactamente al ritmo del examen', () => {
  // Rehearsing the real thing is the point of the whole feature.
  const real = MODOS.filter((m) => m.segundosPorPregunta === SEGUNDOS_EXAMEN_REAL);
  assert.ok(real.length >= 1, 'falta un modo al ritmo real');
});

test('se empieza con más tiempo del que da el examen', () => {
  const nivel1 = MODOS.filter((m) => m.nivel === 1);
  assert.ok(nivel1.length >= 1);
  for (const modo of nivel1) {
    assert.ok(
      modo.segundosPorPregunta > SEGUNDOS_EXAMEN_REAL,
      'el primer escalón es para entrar en ritmo, no para sufrir',
    );
  }
});

test('casi todos los modos apuntan a la debilidad del estudiante', () => {
  // A fixed area ignores the profile: the old "Reto 5" was always MAT,
  // whoever was playing it. Only the deliberately mixed mode names its
  // own areas.
  const fijos = MODOS.filter((m) => m.area !== null);
  assert.equal(fijos.length, 0, 'ningún modo debería clavar un área');

  const sinMix = MODOS.filter((m) => !m.mix);
  assert.ok(sinMix.length >= 3, 'la mayoría deben seguir el perfil');
});

test('el modo mixto cubre las cinco áreas', () => {
  const mixto = MODOS.find((m) => m.mix);
  assert.ok(mixto, 'falta el modo que imita el examen revuelto');
  const areas = new Set(mixto!.mix!.map((s) => s.area));
  assert.deepEqual([...areas].sort(), ['CN', 'ING', 'LC', 'MAT', 'SOC']);
});

test('los nombres dicen para qué sirve el modo', () => {
  // "Sprint 10" told the learner how many questions, which is the
  // least useful fact about it.
  for (const modo of MODOS) {
    assert.ok(!/^\w+ \d+$/.test(modo.title), `${modo.title} no dice nada`);
    assert.ok(modo.description.length > 30, `${modo.id} necesita explicarse`);
  }
});

test('los modos viejos quedan listados para retirarse', () => {
  // Disabled rather than deleted: a finished session still points at
  // the mode it was played under.
  assert.deepEqual([...MODOS_RETIRADOS].sort(), ['explosivo', 'reto_5', 'sprint_10']);
  const ids = new Set(MODOS.map((m) => m.id));
  for (const viejo of MODOS_RETIRADOS) {
    assert.ok(!ids.has(viejo), `${viejo} no debería seguir ofreciéndose`);
  }
});

test('ninguna sesión pasa de nueve minutos', () => {
  // Contrarreloj is a burst, not a study session: past ten minutes it
  // stops being about pace and starts being about stamina.
  for (const modo of MODOS) {
    assert.ok(
      modo.timeLimitSeconds <= 540,
      `${modo.id} dura ${modo.timeLimitSeconds}s`,
    );
  }
});
