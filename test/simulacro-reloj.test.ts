import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { SimulacroService } from '../src/simulacro/simulacro.service';

/**
 * The clock belongs to the server, and leaving is allowed.
 *
 * Those two rules decide everything about a sitting that survives a
 * closed tab, so they are pinned here. The failure they prevent is the
 * same in both directions: a timer that lives in the browser can be
 * stopped by minimising the window, and a sitting that cannot be left
 * punishes a dropped connection as if it were cheating.
 */

const hace = (minutos: number) => new Date(Date.now() - minutos * 60_000);

function servicio(opciones: {
  sitting?: Record<string, unknown> | null;
  preguntas?: Array<Record<string, unknown>>;
  items?: Array<Record<string, unknown>>;
  alActualizar?: (datos: unknown) => void;
}) {
  const sitting = opciones.sitting ?? null;
  const prisma = {
    simulacro: {
      findFirst: async () =>
        sitting ? { preguntas: opciones.preguntas ?? [], ...sitting } : null,
      update: async ({ data }: { data: unknown }) => {
        opciones.alActualizar?.(data);
        return { ...(sitting as object), ...(data as object) };
      },
    },
    simulacroPregunta: {
      findUnique: async ({ where }: { where: { simulacroId_orden?: { orden: number } } }) => {
        const orden = where.simulacroId_orden?.orden ?? 0;
        return (opciones.preguntas ?? []).find((q) => q.orden === orden) ?? null;
      },
      update: async ({ data }: { data: unknown }) => ({ orden: 0, ...(data as object) }),
    },
    generatedItem: {
      findUnique: async () => ({ respuesta_correcta: 'A' }),
      findMany: async () => opciones.items ?? [],
    },
  };
  return new SimulacroService(prisma as never, {} as never);
}

const abierto = {
  id: 's1',
  userId: 'u1',
  status: 'en_curso',
  startedAt: hace(5),
  minutos: 60,
  totalPreguntas: 2,
  resultados: null,
};

test('el tiempo restante sale del reloj del servidor, no del navegador', async () => {
  const svc = servicio({
    sitting: { ...abierto, startedAt: hace(10), minutos: 60 },
    preguntas: [],
    items: [],
  });
  const estado = await svc.estado('s1', 'u1');
  // 60 minutes allowed, 10 gone: about 50 left. A minute of slack so
  // the test does not depend on how fast it runs.
  assert.ok(estado.segundosRestantes > 49 * 60, String(estado.segundosRestantes));
  assert.ok(estado.segundosRestantes <= 50 * 60);
});

test('cerrar la pestaña no detiene el reloj', async () => {
  // The learner left at minute 5 and came back at minute 40. The time
  // they were away is gone, exactly as in the real sitting.
  const svc = servicio({
    sitting: { ...abierto, startedAt: hace(40), minutos: 60 },
    preguntas: [],
    items: [],
  });
  const estado = await svc.estado('s1', 'u1');
  assert.ok(estado.segundosRestantes <= 20 * 60);
});

test('volver después del tiempo califica en vez de reabrir', async () => {
  let guardado: Record<string, unknown> | null = null;
  const svc = servicio({
    sitting: { ...abierto, startedAt: hace(90), minutos: 60 },
    preguntas: [{ orden: 0, area: 'MAT', itemId: 'i1', correcta: true, marcada: false }],
    items: [],
    alActualizar: (d) => (guardado = d as Record<string, unknown>),
  });

  const estado = await svc.estado('s1', 'u1');
  assert.equal(estado.expirado, true);
  assert.equal(estado.segundosRestantes, 0);
  assert.equal(guardado!.status, 'terminado');
});

test('no se aceptan respuestas después del tiempo', async () => {
  const svc = servicio({
    sitting: { ...abierto, startedAt: hace(90), minutos: 60 },
    preguntas: [{ orden: 0, id: 'q1', area: 'MAT', itemId: 'i1' }],
  });
  await assert.rejects(
    () => svc.answer('s1', 'u1', 0, 'A'),
    /Se acabó el tiempo/,
  );
});

test('se puede cambiar una respuesta ya dada', async () => {
  // The real exam lets you go back and change your mind; only the last
  // choice counts.
  const svc = servicio({
    sitting: abierto,
    preguntas: [{ orden: 0, id: 'q1', area: 'MAT', itemId: 'i1', respuesta: 'B' }],
  });
  const guardada = await svc.answer('s1', 'u1', 0, 'A');
  assert.equal(guardada.respuesta, 'A');
  assert.equal(guardada.correcta, true);
});

test('el controlador no devuelve si acertó', async () => {
  /* The verdict is stored, but the sitting is the one place it must
     not come back: finding out at the end is the point. The service
     returns it, so it is the controller that has to withhold it — and
     that is what this reads, rather than an object built here. */
  const fuente = readFileSync(
    path.join(__dirname, '../src/simulacro/simulacro.controller.ts'),
    'utf-8',
  );
  const cuerpo = fuente.slice(
    fuente.indexOf("@Post(':id/answer')"),
    fuente.indexOf("@Post(':id/marcar')"),
  );
  assert.ok(cuerpo.length > 0, 'no se encontró el método answer');
  assert.match(cuerpo, /registrada: true/);
  assert.ok(
    !/\bcorrecta\b/.test(cuerpo),
    'answer no debe devolver el veredicto al estudiante',
  );
});

test('las preguntas servidas no llevan la respuesta correcta', async () => {
  // The payload reaches a browser. Anything in it can be read.
  const svc = servicio({
    sitting: abierto,
    preguntas: [{ orden: 0, area: 'MAT', itemId: 'i1', respuesta: 'B', marcada: true }],
    items: [
      {
        id: 'i1',
        contexto: 'Un triángulo.',
        pregunta: '¿Cuál es el área?',
        opciones: { A: '6', B: '12' },
        figura: null,
      },
    ],
  });
  const estado = await svc.estado('s1', 'u1');
  const texto = JSON.stringify(estado);
  assert.ok(!/respuesta_correcta/.test(texto));
  assert.ok(!/justificacion/.test(texto));
  assert.equal(estado.preguntas[0].respuesta, 'B', 'su propia elección sí vuelve');
  assert.equal(estado.preguntas[0].marcada, true);
});

test('calificar dos veces no reescribe la nota', async () => {
  let veces = 0;
  const svc = servicio({
    sitting: { ...abierto, status: 'terminado', resultados: { correctas: 3 } },
    preguntas: [],
    alActualizar: () => (veces += 1),
  });
  await svc.finish('s1', 'u1');
  assert.equal(veces, 0, 'una sesión ya calificada se devuelve tal cual');
});

test('iniciar un simulacro no devuelve las preguntas', () => {
  /* The client follows with a read, which is the single place that
     decides what a question may show. A second payload carrying the
     rows would be free to drift from it. */
  const fuente = readFileSync(
    path.join(__dirname, '../src/simulacro/simulacro.service.ts'),
    'utf-8',
  );
  const cuerpo = fuente.slice(
    fuente.indexOf('async start('),
    fuente.indexOf('private segundosRestantes('),
  );
  assert.ok(cuerpo.length > 0, 'no se encontró start');
  assert.ok(
    !/include:\s*\{\s*preguntas/.test(cuerpo),
    'start no debe devolver las preguntas',
  );
});
