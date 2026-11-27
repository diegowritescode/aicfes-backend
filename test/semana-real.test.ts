import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  SemanaRealService,
  normalizarTema,
  temaLegible,
} from '../src/calidad/semana-real.service';

/**
 * The seven-day window, and why it had to exist.
 *
 * `DebilidadesService` answers «what does this learner carry» and has
 * no date filter at all, so a report built only on it could never say
 * «mejoraste esta semana» — it would be claiming a week's evidence
 * for something that took two months to show. ADR 35 recorded that as
 * a known limit. These tests pin the thing that closes it.
 *
 * The SQL itself was verified against a real PostgreSQL with seeded
 * rows covering each case below; what is tested here is the policy
 * applied to the rows that come back, which is where the thresholds
 * live and where a wrong one is invisible.
 */

interface Fila {
  tema: string;
  aciertoPorcentaje: number;
  respondidas: number;
  segundosMediana: number | null;
}

/** The private sorter, reached without a database. */
function componer(filas: unknown[]) {
  const servicio = new SemanaRealService(null as never);
  const desde = new Date('2026-11-23T00:00:00Z');
  const hasta = new Date('2026-11-30T00:00:00Z');
  return (
    servicio as unknown as {
      componer: (f: unknown[], d: Date, h: Date) => ReturnType<SemanaRealService['resumen']>;
    }
  ).componer(filas, desde, hasta) as never as {
    respondidas: number;
    acertadas: number;
    aciertoPorcentaje: number;
    segundosMediana: number | null;
    fuertes: Array<Fila>;
    flojos: Array<Fila>;
    lentos: Array<Fila>;
  };
}

function fila(
  tema: string,
  respondidas: number,
  acertadas: number,
  medianaMs: number | null = 30000,
) {
  return { area: 'MAT', tema, respondidas, acertadas, mediana_ms: medianaMs };
}

test('un tema con 100% de acierto es fortaleza, no debilidad', () => {
  /* The asymmetry this fixes: `temasDebiles` only ever returns what
     goes badly, so strengths could only be stated per area. «Te
     salieron bien las fracciones» tells a learner what they no longer
     have to study; «vas bien en Matemáticas» does not. */
  const r = componer([fila('fracciones', 4, 4)]);

  assert.equal(r.fuertes.length, 1);
  assert.equal(r.fuertes[0]!.tema, 'fracciones');
  assert.equal(r.flojos.length, 0);
});

test('un tema con 25% de acierto es flojo', () => {
  const r = componer([fila('angulos', 4, 1)]);

  assert.equal(r.flojos.length, 1);
  assert.equal(r.flojos[0]!.aciertoPorcentaje, 25);
  assert.equal(r.fuertes.length, 0);
});

test('un tema a mitad de camino no es ni fuerte ni flojo', () => {
  /* 70%: above the weak threshold, below the strong one. Reporting it
     as either would be the report asserting something the numbers do
     not say. */
  const r = componer([fila('ecuaciones', 10, 7)]);

  assert.equal(r.fuertes.length, 0);
  assert.equal(r.flojos.length, 0);
  /* Still counted in the totals: it happened. */
  assert.equal(r.respondidas, 10);
});

test('lento se mide contra el propio estudiante, no contra el examen', () => {
  /* A learner who is uniformly slow has a pacing problem, not a
     problem with one topic, and listing every topic as slow says
     nothing. So the comparison is against their own median. */
  const r = componer([
    fila('rapido', 4, 2, 20000),
    fila('normal', 4, 2, 30000),
    fila('lentisimo', 4, 2, 90000),
  ]);

  assert.deepEqual(
    r.lentos.map((t) => t.tema),
    ['lentisimo'],
  );
});

test('sin tiempos medidos no hay lista de lentos', () => {
  /* Answers recorded before `Answer.tiempoMs` existed have none.
     Guessing a pace from them would put a topic on the slow list on
     no evidence. */
  const r = componer([fila('angulos', 4, 1, null), fila('fracciones', 4, 4, null)]);

  assert.equal(r.segundosMediana, null);
  assert.equal(r.lentos.length, 0);
});

test('un tema puede ser flojo y lento a la vez', () => {
  /* The most useful finding in the whole report, and invisible in an
     accuracy percentage on its own: failing it AND taking twice as
     long is the topic to start with. */
  const r = componer([
    fila('normal', 4, 2, 30000),
    fila('angulos', 6, 1, 95000),
  ]);

  assert.ok(r.flojos.some((t) => t.tema === 'angulos'));
  assert.ok(r.lentos.some((t) => t.tema === 'angulos'));
});

test('acertar rápido no cuenta como lento', () => {
  const r = componer([
    fila('normal', 4, 2, 30000),
    fila('facil', 5, 5, 12000),
  ]);

  assert.equal(r.lentos.length, 0);
  assert.ok(r.fuertes.some((t) => t.tema === 'facil'));
});

test('los milisegundos se devuelven en segundos', () => {
  /* The prompt talks in seconds because the learner does. Leaving
     milliseconds in would have the report say «te demoras 90000». */
  const r = componer([fila('angulos', 4, 1, 45000)]);

  assert.equal(r.fuertes.concat(r.flojos)[0]!.segundosMediana, 45);
});

test('los totales suman todos los temas, fuertes y flojos', () => {
  const r = componer([fila('a', 4, 4), fila('b', 6, 1)]);

  assert.equal(r.respondidas, 10);
  assert.equal(r.acertadas, 5);
  assert.equal(r.aciertoPorcentaje, 50);
});

test('COUNT de Postgres llega como bigint y no rompe la cuenta', () => {
  /* `COUNT(*)` is `bigint`, which arrives as a JS BigInt. Arithmetic
     mixing BigInt and Number throws at runtime, and the failure would
     only appear against a real database. */
  const r = componer([
    /* `BigInt(...)` rather than `4n`: the project targets below
       ES2020 and a literal does not compile. The value is what
       matters — `COUNT(*)` arrives as a JS BigInt either way. */
    {
      area: 'MAT',
      tema: 'angulos',
      respondidas: BigInt(4),
      acertadas: BigInt(1),
      mediana_ms: 30000,
    },
  ]);

  assert.equal(r.respondidas, 4);
  assert.equal(r.aciertoPorcentaje, 25);
});

test('sin filas, el resumen está vacío pero no roto', () => {
  const r = componer([]);

  assert.equal(r.respondidas, 0);
  assert.equal(r.aciertoPorcentaje, 0);
  assert.equal(r.segundosMediana, null);
  assert.deepEqual(r.fuertes, []);
});

test('un fallo de base de datos no tumba el informe', async () => {
  /* The report is not worth failing the screen that shows a learner
     their progress. Null means «no window evidence» and the report is
     written from the standing profile. */
  const prisma = {
    $queryRaw: async () => {
      throw new Error('connection reset');
    },
  };
  const servicio = new SemanaRealService(prisma as never);

  const r = await servicio.resumen('u1', new Date(), new Date());

  assert.equal(r, null);
});

test('el tema guardado se vuelve prosa para el generador', () => {
  /* Topics are stored hyphenated and the generator takes prose, both
     for its prompt and for `ReferenciaService`'s similarity search.
     `time-trial.service.ts` did this `.replace()` inline at its own
     call site, which is exactly how a second caller gets it wrong. */
  assert.equal(temaLegible('leyes-de-newton'), 'leyes de newton');
  assert.equal(temaLegible('angulos'), 'angulos');
});

/**
 * One spelling for one topic.
 *
 * Found in production, not in a test: the weekly report's plan said
 * `razonamientocuantitativo` while the window said
 * `razonamiento_cuantitativo`. Same topic, two names, so a topic the
 * learner HAD practised scored as «no lo practicaste» and the plan
 * pointed at a string no item in the bank carries.
 *
 * The cause was ordering: `temasDe` stripped characters not in
 * `[a-z0-9\s-]` before turning spaces into hyphens, and `_` is not in
 * that set — so `razonamiento_cuantitativo` lost the underscore
 * entirely instead of having it converted.
 */

test('el guion bajo se vuelve guion, no se borra', () => {
  /* The bank tags with underscores. Stripping them produced topics no
     item carries, which is the worst kind of wrong: the plan looks
     fine and matches nothing. */
  assert.equal(normalizarTema('razonamiento_cuantitativo'), 'razonamiento-cuantitativo');
  assert.equal(normalizarTema('idea_principal'), 'idea-principal');
  assert.equal(normalizarTema('lectura_tablas'), 'lectura-tablas');
});

test('los espacios y los acentos se normalizan como antes', () => {
  /* The behaviour that was already right must not regress. */
  assert.equal(normalizarTema('leyes de newton'), 'leyes-de-newton');
  assert.equal(normalizarTema('Álgebra Básica'), 'algebra-basica');
});

test('no quedan guiones dobles ni en los bordes', () => {
  /* Converting underscores can create runs, and a topic keyed on
     `-raro-` would not match `raro`. */
  assert.equal(normalizarTema('__raro__'), 'raro');
  assert.equal(normalizarTema('a _ b'), 'a-b');
  assert.equal(normalizarTema('  espacios  '), 'espacios');
});

test('dos escrituras del mismo tema se suman en una sola fila', () => {
  /* The bank is not consistent, so the same topic arrives spelled two
     ways in one window. Keeping them apart would split the evidence
     and could put one half in «fuertes» and the other in «flojos». */
  const r = componer([
    { area: 'MAT', tema: 'razonamiento_cuantitativo', respondidas: 4, acertadas: 1, mediana_ms: 100000 },
    { area: 'MAT', tema: 'razonamiento-cuantitativo', respondidas: 6, acertadas: 1, mediana_ms: 100000 },
  ]);

  const todos = [...r.fuertes, ...r.flojos];
  assert.equal(todos.length, 1, 'tenían que fundirse en una fila');
  assert.equal(todos[0]!.tema, 'razonamiento-cuantitativo');
  assert.equal(todos[0]!.respondidas, 10);
  assert.equal(todos[0]!.aciertoPorcentaje, 20);
});

test('un tema de otra área no se funde con el de esta', () => {
  /* Same topic name under two areas is two topics: merging them would
     credit work in one to the other. */
  const r = componer([
    { area: 'MAT', tema: 'inferencia', respondidas: 4, acertadas: 4, mediana_ms: 30000 },
    { area: 'LC', tema: 'inferencia', respondidas: 4, acertadas: 1, mediana_ms: 30000 },
  ]);

  assert.equal(r.fuertes.length, 1);
  assert.equal(r.flojos.length, 1);
});
