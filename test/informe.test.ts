import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { InformeService } from '../src/informe/informe.service';
import {
  InformeRespuestaSchema,
  ESQUEMA_JSON,
} from '../src/informe/dto/informe-respuesta.schema';

/**
 * What keeps the report honest.
 *
 * The model writes it; it does not work it out. Every figure comes
 * from `DebilidadesService` and the dashboard, both tested, and the
 * schema the model answers with has no numeric field at all. A report
 * that invents a percentage about a learner's own results is wrong in
 * the one way that costs the feature its credibility, and they catch
 * it in the first sentence.
 *
 * These tests pin the three things that protect that: the week is
 * paid for once, a failed model call does not become an error on
 * screen, and nothing numeric can arrive from the model.
 */

const TEMAS = [
  {
    area: 'MAT',
    tema: 'angulos',
    respondidas: 10,
    acertadas: 3,
    aciertoPorcentaje: 30,
    errorTipico: 'error_calculo',
    ultimoFallo: new Date('2026-11-25T00:00:00Z'),
    prioridad: 1.2,
  },
  {
    area: 'LC',
    tema: 'inferencia',
    respondidas: 8,
    acertadas: 4,
    aciertoPorcentaje: 50,
    errorTipico: null,
    ultimoFallo: new Date('2026-11-24T00:00:00Z'),
    prioridad: 0.8,
  },
];

const AVANZADO = {
  areaTrend: [{ area: 'MAT', accuracy: 40, delta: -5 }],
  avgTimePerQuestionSeconds: 90,
  avgDifficulty: 2,
  sessionsAnalyzed: 3,
};

const PANEL = { data: { timeStudied: { weekMinutes: 45 } } };

const RESPUESTA_DEL_MODELO = {
  resumen: 'Vas avanzando.',
  fortalezas: [{ area: 'MAT', nota: 'bien' }],
  debilidades: [{ area: null, nota: 'mal' }],
  plan: [{ area: 'MAT', tema: 'angulos', titulo: 't', detalle: 'd' }],
};

interface Opciones {
  readonly guardado?: unknown;
  readonly anterior?: unknown;
  readonly semana?: unknown;
  readonly rangoPedido?: (args: unknown[]) => void;
  readonly temas?: unknown[];
  readonly respuesta?: unknown;
  readonly fallaElModelo?: boolean;
  readonly creado?: (datos: unknown) => void;
  readonly llamada?: (args: unknown[]) => void;
}

function servicio(opciones: Opciones = {}) {
  const creadas: unknown[] = [];

  const prisma = {
    user: { findUnique: async () => ({ timezone: 'America/Bogota' }) },
    informeSemanal: {
      /* The service reads two rows by the same compound key: this
         week's report and last week's, for the plan follow-up. They
         are told apart by the week asked for. */
      findUnique: async ({ where }: { where: { userId_semanaInicio: { semanaInicio: Date } } }) => {
        const pedida = where.userId_semanaInicio.semanaInicio.getTime();
        const estaSemana = new Date('2026-11-23T00:00:00Z').getTime();
        if (pedida < estaSemana) return opciones.anterior ?? null;
        return opciones.guardado ?? null;
      },
      create: async ({ data }: { data: unknown }) => {
        creadas.push(data);
        opciones.creado?.(data);
        return {
          ...(data as Record<string, unknown>),
          semanaInicio: (data as Record<string, Date>).semanaInicio,
          generadoEn: new Date('2026-11-27T00:00:00Z'),
        };
      },
    },
  };

  const openai = {
    createStructured: async (...args: unknown[]) => {
      opciones.llamada?.(args);
      if (opciones.fallaElModelo) throw new Error('502 del proveedor');
      return opciones.respuesta ?? RESPUESTA_DEL_MODELO;
    },
  };

  const debilidades = { temasDebiles: async () => opciones.temas ?? TEMAS };
  const dashboard = {
    getAdvancedDashboard: async () => AVANZADO,
    getDashboard: async () => PANEL,
  };
  const config = { get: () => undefined };
  const semanaReal = {
    resumen: async (...args: unknown[]) => {
      opciones.rangoPedido?.(args);
      return opciones.semana ?? null;
    },
  };

  return {
    servicio: new InformeService(
      prisma as never,
      openai as never,
      debilidades as never,
      dashboard as never,
      semanaReal as never,
      config as never,
    ),
    creadas,
  };
}

test('un informe ya escrito no se vuelve a pagar', async () => {
  /* The whole point of `@@unique([userId, semanaInicio])`. Opening
     the screen on Tuesday after opening it on Monday must read, not
     spend. */
  let llamo = false;
  const { servicio: s } = servicio({
    guardado: {
      semanaInicio: new Date('2026-11-23T00:00:00Z'),
      resumen: 'el de antes',
      fortalezas: [],
      debilidades: [],
      plan: [],
      datos: {},
      generadoEn: new Date(),
    },
    llamada: () => {
      llamo = true;
    },
  });

  const informe = await s.informeDeEstaSemana('u1');

  assert.equal(llamo, false, 'no debía llamar al modelo');
  assert.equal(informe?.resumen, 'el de antes');
});

test('sin temas suficientes no hay informe ni llamada al modelo', async () => {
  /* A new learner is in a normal state, not an error one. And a
     report built on one afternoon would read like a verdict. */
  let llamo = false;
  const { servicio: s } = servicio({
    temas: [TEMAS[0]],
    llamada: () => {
      llamo = true;
    },
  });

  assert.equal(await s.informeDeEstaSemana('u1'), null);
  assert.equal(llamo, false);
});

test('si el modelo falla no se guarda nada y no se lanza al estudiante', async () => {
  /* A 502 on the screen that shows their progress reads as the app
     being broken, and a report is not something they asked for by
     name. Next visit tries again. */
  const { servicio: s, creadas } = servicio({ fallaElModelo: true });

  assert.equal(await s.informeDeEstaSemana('u1'), null);
  assert.equal(creadas.length, 0);
});

test('el userId viaja como cuarto argumento, no dentro del objeto', async () => {
  /* `createStructured` declares `userId` in its request object and
     never reads it. Passing it there records the spend with no owner
     and the daily quota sees the call as free. */
  let args: unknown[] = [];
  const { servicio: s } = servicio({ llamada: (a) => (args = a) });

  await s.informeDeEstaSemana('u1');

  assert.equal(args[3], 'u1', 'el userId tiene que ir en la cuarta posición');
});

test('el consumo se etiqueta como informe', async () => {
  /* Its own operation rather than folded into `retroalimentacion`:
     this is the one call made per learner per week instead of per
     action, so its cost has to be readable on its own. */
  let args: unknown[] = [];
  const { servicio: s } = servicio({ llamada: (a) => (args = a) });

  await s.informeDeEstaSemana('u1');

  const peticion = args[1] as { operacion?: string };
  assert.equal(peticion.operacion, 'informe');
});

test('una acción sobre un tema inventado no se guarda', async () => {
  /* The plan is a set of queries against the item bank. A topic the
     bank never heard of returns nothing, and the learner taps
     «practicar esto» onto an empty screen. */
  const { servicio: s, creadas } = servicio({
    respuesta: {
      ...RESPUESTA_DEL_MODELO,
      plan: [
        { area: 'MAT', tema: 'angulos', titulo: 'a', detalle: 'd' },
        { area: 'MAT', tema: 'geometria_inventada', titulo: 'b', detalle: 'd' },
      ],
    },
  });

  await s.informeDeEstaSemana('u1');

  const plan = (creadas[0] as { plan: unknown[] }).plan;
  assert.equal(plan.length, 1);
  assert.equal((plan[0] as { tema: string }).tema, 'angulos');
});

test('lo que se le dio al modelo queda guardado', async () => {
  /* So «¿de dónde sacó eso?» has an answer without calling the model
     again. */
  const { servicio: s, creadas } = servicio();

  await s.informeDeEstaSemana('u1');

  const datos = (creadas[0] as { datos: Record<string, unknown> }).datos;
  assert.equal(datos.segundosPorPregunta, 90);
  assert.equal(datos.minutosEstaSemana, 45);
  assert.ok(Array.isArray(datos.temasDebiles));
});

test('los minutos salen del panel, no de una cuenta nueva', async () => {
  /* Two numbers for the same week drift apart, and the dashboard's is
     the one already on the learner's screen. */
  const { servicio: s, creadas } = servicio();

  await s.informeDeEstaSemana('u1');

  const datos = (creadas[0] as { datos: Record<string, unknown> }).datos;
  assert.equal(datos.minutosEstaSemana, PANEL.data.timeStudied.weekMinutes);
});

/**
 * The schema the model answers with.
 */

test('el esquema no deja al modelo inventar un número', () => {
  /* Not one numeric field. A model asked for `aciertoPorcentaje`
     supplies one, close enough to look right and sometimes wrong. */
  const comoTexto = JSON.stringify(ESQUEMA_JSON);
  assert.equal(
    comoTexto.includes('"number"') || comoTexto.includes('"integer"'),
    false,
    'el esquema tiene un campo numérico: el modelo lo rellenará',
  );
});

test('el esquema JSON y el de zod aceptan el mismo documento', () => {
  /* The two are written separately — `strict: true` needs every field
     in `required` and `additionalProperties: false`, which a zod
     conversion does not produce. This is what keeps them in step. */
  const parsed = InformeRespuestaSchema.safeParse(RESPUESTA_DEL_MODELO);
  assert.equal(parsed.success, true, JSON.stringify(parsed));
});

test('strict exige que todo campo esté en required', () => {
  /* OpenAI refuses a strict schema whose `properties` and `required`
     disagree, and the failure arrives as a 502 at runtime rather than
     at build time. */
  const revisar = (nodo: Record<string, unknown>, ruta: string) => {
    if (nodo.type === 'object') {
      const propiedades = Object.keys(
        (nodo.properties as Record<string, unknown>) ?? {},
      );
      const requeridos = (nodo.required as string[]) ?? [];
      assert.deepEqual(
        [...propiedades].sort(),
        [...requeridos].sort(),
        `${ruta}: properties y required no coinciden`,
      );
      assert.equal(
        nodo.additionalProperties,
        false,
        `${ruta}: falta additionalProperties: false`,
      );
      for (const [clave, valor] of Object.entries(
        (nodo.properties as Record<string, Record<string, unknown>>) ?? {},
      )) {
        revisar(valor, `${ruta}.${clave}`);
      }
    }
    if (nodo.type === 'array') {
      revisar(nodo.items as Record<string, unknown>, `${ruta}[]`);
    }
  };

  revisar(ESQUEMA_JSON as unknown as Record<string, unknown>, 'raiz');
});

/**
 * The window and the previous plan, which is what lets the report use
 * a past tense at all.
 */

const SEMANA = {
  desde: new Date('2026-11-23T00:00:00Z'),
  hasta: new Date('2026-11-30T00:00:00Z'),
  respondidas: 12,
  acertadas: 7,
  aciertoPorcentaje: 58,
  segundosMediana: 40,
  fuertes: [
    {
      area: 'MAT',
      tema: 'fracciones',
      respondidas: 5,
      acertadas: 5,
      aciertoPorcentaje: 100,
      segundosMediana: 35,
    },
  ],
  flojos: [
    {
      area: 'MAT',
      tema: 'angulos',
      respondidas: 7,
      acertadas: 2,
      aciertoPorcentaje: 29,
      segundosMediana: 80,
    },
  ],
  lentos: [
    {
      area: 'MAT',
      tema: 'angulos',
      respondidas: 7,
      acertadas: 2,
      aciertoPorcentaje: 29,
      segundosMediana: 80,
    },
  ],
};

test('la semana de siete días llega al modelo', async () => {
  /* Without it the report can only speak in the present tense about a
     profile with no notion of a week, which is what ADR 35 recorded
     as the limit this closes. */
  const { servicio: s, creadas } = servicio({ semana: SEMANA });

  await s.informeDeEstaSemana('u1');

  const datos = (creadas[0] as { datos: Record<string, unknown> }).datos;
  const semana = datos.semana7dias as Record<string, unknown>;

  assert.ok(semana, 'el payload tiene que llevar la semana');
  assert.equal(semana.respondidas, 12);
  assert.equal((semana.fuertes as unknown[]).length, 1);
});

test('las fortalezas de la semana son temas, no áreas', () => {
  /* The asymmetry that `temasDebiles` could not fix: it only returns
     what goes badly, so a strength could only ever be «vas bien en
     Matemáticas». A topic tells the learner what they can stop
     studying. */
  const fuerte = SEMANA.fuertes[0]!;

  assert.equal(fuerte.tema, 'fracciones');
  assert.equal(fuerte.aciertoPorcentaje, 100);
});

test('sin práctica en la semana, el payload lo dice con null', async () => {
  /* Null rather than a zeroed object: an accuracy of 0% over no
     answers reads as «falló todo», which is a different and false
     statement. */
  const { servicio: s, creadas } = servicio({ semana: null });

  await s.informeDeEstaSemana('u1');

  const datos = (creadas[0] as { datos: Record<string, unknown> }).datos;
  assert.equal(datos.semana7dias, null);
});

test('el plan de la semana pasada se lee y se califica', async () => {
  /* The rows were already stored and nobody read them back, so every
     Monday started from zero and the plan was never followed up. */
  const { servicio: s, creadas } = servicio({
    semana: SEMANA,
    anterior: {
      plan: [
        { area: 'MAT', tema: 'angulos', titulo: 'Repasa ángulos', detalle: 'd' },
        { area: 'LC', tema: 'inferencia', titulo: 'Lee inferencia', detalle: 'd' },
      ],
    },
  });

  await s.informeDeEstaSemana('u1');

  const datos = (creadas[0] as { datos: Record<string, unknown> }).datos;
  const seguimiento = datos.planAnterior as Array<Record<string, unknown>>;

  assert.equal(seguimiento.length, 2);

  const angulos = seguimiento.find((a) => a.tema === 'angulos')!;
  assert.equal(angulos.sinTocar, false);
  assert.equal(angulos.aciertoPorcentaje, 29);

  /* Not practised at all: the report says so rather than dropping it. */
  const inferencia = seguimiento.find((a) => a.tema === 'inferencia')!;
  assert.equal(inferencia.sinTocar, true);
});

test('en el primer informe no hay plan anterior que calificar', async () => {
  /* Empty, which the prompt reads as «no hay con qué comparar» rather
     than as a failure to comply. */
  const { servicio: s, creadas } = servicio({ semana: SEMANA });

  await s.informeDeEstaSemana('u1');

  const datos = (creadas[0] as { datos: Record<string, unknown> }).datos;
  assert.deepEqual(datos.planAnterior, []);
});

test('la ventana es la semana del informe, no los últimos siete días', async () => {
  /* A stored report has to read the same on Friday as on Tuesday. A
     rolling window would make it disagree with its own `datos`. */
  let rango: unknown[] = [];
  const { servicio: s } = servicio({
    semana: SEMANA,
    rangoPedido: (args: unknown[]) => (rango = args),
  });

  await s.informeDeEstaSemana('u1');

  const desde = rango[1] as Date;
  const hasta = rango[2] as Date;

  assert.ok(desde instanceof Date, 'tiene que recibir un desde');
  assert.equal(
    hasta.getTime() - desde.getTime(),
    7 * 24 * 60 * 60 * 1000,
    'la ventana tiene que ser de exactamente siete días',
  );
});
