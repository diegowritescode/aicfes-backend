import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { leerPlanGuardado, seguimientoDelPlan } from '../src/informe/model/seguimiento';

/**
 * Holding the learner to last week's plan.
 *
 * The reports were already stored with their plans, and nobody read
 * them back, so every Monday started from zero: the report could
 * never say «cumpliste lo de la semana pasada» or «llevas tres
 * semanas con el mismo tema». A plan nobody is held to is a plan
 * nobody follows.
 *
 * Two things are worth pinning: a plan read out of a `Json` column
 * cannot crash the week's report however malformed it is, and an
 * action is only credited against work on its own area AND topic.
 */

function semana(
  temas: Array<{
    area: string;
    tema: string;
    respondidas: number;
    aciertoPorcentaje: number;
  }>,
) {
  return {
    desde: new Date('2026-11-23T00:00:00Z'),
    hasta: new Date('2026-11-30T00:00:00Z'),
    respondidas: temas.reduce((s, t) => s + t.respondidas, 0),
    acertadas: 0,
    aciertoPorcentaje: 0,
    segundosMediana: 30,
    /* Every topic goes in `flojos`: the function reads all three
       lists as one set, and which list a topic came from is not its
       business. */
    fuertes: [],
    flojos: temas.map((t) => ({ ...t, segundosMediana: 30 })),
    lentos: [],
  } as never;
}

const PLAN = [{ area: 'MAT', tema: 'angulos', titulo: 'Repasa ángulos' }];

test('una acción que el estudiante no tocó se marca sinTocar', () => {
  /* Said plainly once, not hidden. A report that quietly drops the
     action pretends the plan never existed. */
  const r = seguimientoDelPlan(PLAN, semana([]));

  assert.equal(r.length, 1);
  assert.equal(r[0]!.sinTocar, true);
  assert.equal(r[0]!.respondidas, 0);
  assert.equal(r[0]!.aciertoPorcentaje, null);
});

test('una acción practicada trae su acierto de esta semana', () => {
  /* The only honest way to score a plan: it asked for practice on X,
     so the question is how X went afterwards. */
  const r = seguimientoDelPlan(
    PLAN,
    semana([{ area: 'MAT', tema: 'angulos', respondidas: 8, aciertoPorcentaje: 75 }]),
  );

  assert.equal(r[0]!.sinTocar, false);
  assert.equal(r[0]!.respondidas, 8);
  assert.equal(r[0]!.aciertoPorcentaje, 75);
});

test('con muy pocas respuestas se oculta el porcentaje pero no el intento', () => {
  /* «Bajaste a 33%» about three questions is a number the learner
     will quote back, and it does not mean what it says. */
  const r = seguimientoDelPlan(
    PLAN,
    semana([{ area: 'MAT', tema: 'angulos', respondidas: 2, aciertoPorcentaje: 50 }]),
  );

  assert.equal(r[0]!.sinTocar, false);
  assert.equal(r[0]!.respondidas, 2);
  assert.equal(r[0]!.aciertoPorcentaje, null);
});

test('el mismo tema en otra área no cuenta como cumplido', () => {
  /* Topic names repeat across areas. Crediting work in one to a plan
     about the other tells the learner they did something they did
     not. */
  const r = seguimientoDelPlan(
    PLAN,
    semana([{ area: 'LC', tema: 'angulos', respondidas: 9, aciertoPorcentaje: 90 }]),
  );

  assert.equal(r[0]!.sinTocar, true);
});

test('sin semana medida, todo queda sinTocar', () => {
  /* Null is «no window evidence», which is not «did nothing» — but
     for a plan the two produce the same honest statement: there is
     nothing to show that it was done. */
  const r = seguimientoDelPlan(PLAN, null);

  assert.equal(r[0]!.sinTocar, true);
});

test('un plan vacío no inventa seguimiento', () => {
  assert.deepEqual(seguimientoDelPlan([], semana([])), []);
});

/**
 * Reading a plan back out of a `Json` column.
 */

test('un plan que no es arreglo no rompe el informe', () => {
  /* The column is `Json`: a row written by an older prompt version,
     or hand-edited in psql, must not crash this week's report. */
  assert.deepEqual(leerPlanGuardado(null), []);
  assert.deepEqual(leerPlanGuardado(undefined), []);
  assert.deepEqual(leerPlanGuardado('no soy un plan'), []);
  assert.deepEqual(leerPlanGuardado({ area: 'MAT' }), []);
});

test('una acción sin area o sin tema se descarta, el resto sobrevive', () => {
  /* Dropping the broken one rather than the whole plan: three good
     actions and one malformed should leave three. */
  const r = leerPlanGuardado([
    { area: 'MAT', tema: 'angulos', titulo: 'a' },
    { area: 'MAT' },
    { tema: 'solo-tema' },
    null,
    'texto',
    { area: 'LC', tema: 'inferencia', titulo: 'b' },
  ]);

  assert.equal(r.length, 2);
  assert.deepEqual(
    r.map((a) => a.tema),
    ['angulos', 'inferencia'],
  );
});

test('una acción sin título usa el tema como título', () => {
  /* Better than an empty string in the prompt, which would make the
     model invent what the action was. */
  const r = leerPlanGuardado([{ area: 'MAT', tema: 'angulos' }]);

  assert.equal(r[0]!.titulo, 'angulos');
});
