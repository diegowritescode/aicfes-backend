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
      findUnique: async () => opciones.guardado ?? null,
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

  return {
    servicio: new InformeService(
      prisma as never,
      openai as never,
      debilidades as never,
      dashboard as never,
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
