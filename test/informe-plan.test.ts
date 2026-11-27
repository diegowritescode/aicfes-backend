import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { planConTemasReales } from '../src/informe/model/validar-plan';
import { hayMateriaParaInforme, aplanarTemas } from '../src/informe/model/payload';
import type { TemaDebil } from '../src/calidad/debilidades.service';

/**
 * The plan is a set of queries, not prose.
 *
 * Each action carries an area and a topic, and those two go straight
 * to the item bank when the learner taps «practicar esto». A model
 * that invents a nicer-sounding topic — `geometria_basica` where the
 * profile says `angulos` — produces an action that looks right and
 * returns no exercises at all.
 *
 * `strict: true` cannot stop it: a JSON Schema holds one fixed enum
 * and the valid topics differ per learner and per week. So the rule
 * lives here and these tests are what keep it.
 */

const TEMAS = [
  { area: 'MAT', tema: 'angulos', aciertoPorcentaje: 30, respondidas: 10, errorTipico: 'error_calculo' },
  { area: 'LC', tema: 'inferencia', aciertoPorcentaje: 45, respondidas: 8, errorTipico: null },
] as const;

function accion(area: string, tema: string) {
  return { area: area as 'MAT', tema, titulo: 't', detalle: 'd' };
}

test('una acción sobre un tema real se conserva', () => {
  const plan = planConTemasReales([accion('MAT', 'angulos')], TEMAS);
  assert.equal(plan.length, 1);
  assert.equal(plan[0].tema, 'angulos');
});

test('un tema inventado se descarta', () => {
  const plan = planConTemasReales([accion('MAT', 'geometria_basica')], TEMAS);
  assert.equal(plan.length, 0);
});

test('el área también tiene que coincidir', () => {
  /* The same topic name can exist under two areas, and an action
     filed under the wrong one draws from the wrong part of the bank. */
  const plan = planConTemasReales([accion('LC', 'angulos')], TEMAS);
  assert.equal(plan.length, 0);
});

test('una acción inventada no se lleva por delante a las buenas', () => {
  /* The report is already paid for by the time this runs. Three true
     actions and one invented one should leave three, not nothing. */
  const plan = planConTemasReales(
    [accion('MAT', 'angulos'), accion('MAT', 'inventado'), accion('LC', 'inferencia')],
    TEMAS,
  );
  assert.equal(plan.length, 2);
  assert.deepEqual(
    plan.map((a) => a.tema),
    ['angulos', 'inferencia'],
  );
});

test('sin temas conocidos no sobrevive ninguna acción', () => {
  const plan = planConTemasReales([accion('MAT', 'angulos')], []);
  assert.equal(plan.length, 0);
});

/**
 * The floor under which there is nothing honest to write.
 */

function tema(parcial: Partial<TemaDebil> = {}): TemaDebil {
  return {
    area: 'MAT' as TemaDebil['area'],
    tema: 'angulos',
    respondidas: 10,
    acertadas: 3,
    aciertoPorcentaje: 30,
    errorTipico: 'error_calculo',
    ultimoFallo: new Date(),
    prioridad: 1,
    ...parcial,
  };
}

test('un solo tema débil no da para un informe', () => {
  /* One weak topic is a sentence, not a report, and the plan it
     produces has a single action in it. */
  assert.equal(hayMateriaParaInforme([tema()]), false);
});

test('sin ningún tema tampoco', () => {
  assert.equal(hayMateriaParaInforme([]), false);
});

test('dos temas ya dan para escribir', () => {
  assert.equal(hayMateriaParaInforme([tema(), tema({ tema: 'fracciones' })]), true);
});

test('al aplanar no viaja la prioridad', () => {
  /* Ranking is the server's business. Handing the model a priority
     score invites it to quote one, and a number in a report about a
     learner's own results has to be one they could check. */
  const plano = aplanarTemas([tema()]);
  assert.equal('prioridad' in plano[0], false);
  assert.equal('ultimoFallo' in plano[0], false);
  assert.equal(plano[0].aciertoPorcentaje, 30);
});
