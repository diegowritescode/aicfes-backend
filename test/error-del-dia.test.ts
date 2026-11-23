import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { ErrorDelDiaService } from '../src/calidad/error-del-dia.service';

/**
 * One question a day, taken from what the learner already got wrong.
 *
 * The rules that decide *which* question are the whole feature, so
 * they are pinned here: a mistake they have since corrected is not
 * today's problem, and a learner with no history gets nothing rather
 * than a random question dressed up as personal.
 */

const hace = (dias: number) => new Date(Date.now() - dias * 24 * 60 * 60 * 1000);

const item = {
  id: 'i1',
  area: 'MAT',
  pregunta: '¿Cuál es el área del triángulo?',
  contexto: 'Base 4, altura 3.',
  opciones: { A: '6', B: '12', C: '7', D: '10' },
};

function servicio(opciones: {
  respuestas?: Array<{ itemId: string | null; isCorrect: boolean; createdAt: Date }>;
  item?: Record<string, unknown> | null;
  temasDebiles?: Array<Record<string, unknown>>;
  respuestaDeHoy?: boolean;
  aciertoDeHoy?: boolean;
  /** A one-question session finished today: the card was already done. */
  yaHizoLaDeHoy?: boolean;
  falla?: boolean;
}): ErrorDelDiaService {
  const prisma = {
    answer: {
      findMany: async () => {
        if (opciones.falla) throw new Error('base caída');
        return opciones.respuestas ?? [];
      },
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        // The query asks for a *correct* answer today; the stub has to
        // respect that filter or the test proves nothing.
        if (where?.isCorrect === true && !opciones.aciertoDeHoy) return null;
        return opciones.aciertoDeHoy || opciones.respuestaDeHoy ? { id: 'a1' } : null;
      },
    },
    generatedItem: {
      findUnique: async () => opciones.item ?? item,
      findFirst: async () => opciones.item ?? item,
    },
    studySession: {
      /* The card is one question a day, and a one-question session
         finished today is the evidence that today's was done. Default
         null: these cases are about picking a question, not about
         having already picked one. */
      findFirst: async () => (opciones.yaHizoLaDeHoy ? { id: 's1' } : null),
    },
  };
  const debilidades = {
    temasDebiles: async () => opciones.temasDebiles ?? [],
  };
  return new ErrorDelDiaService(prisma as never, debilidades as never);
}

test('sin historial no inventa una pregunta', async () => {
  // A random question called "su error de hoy" is a lie, and the
  // learner finds out the first time they look at it.
  const hoy = await servicio({ respuestas: [] }).paraHoy('u1');
  assert.equal(hoy, null);
});

test('elige una que el estudiante falló', async () => {
  const hoy = await servicio({
    respuestas: [{ itemId: 'i1', isCorrect: false, createdAt: hace(2) }],
  }).paraHoy('u1');
  assert.equal(hoy?.itemId, 'i1');
  assert.match(hoy!.motivo, /falló antes/);
});

test('un error ya corregido deja de contar', async () => {
  // Newest first: the latest outcome for an item is what counts, and
  // getting it right afterwards means it was learnt.
  const hoy = await servicio({
    respuestas: [
      { itemId: 'i1', isCorrect: true, createdAt: hace(1) },
      { itemId: 'i1', isCorrect: false, createdAt: hace(5) },
    ],
  }).paraHoy('u1');
  assert.equal(hoy, null);
});

test('prefiere el error más viejo sin resolver', async () => {
  // One left alone for three weeks is likelier to still be a gap than
  // yesterday's.
  const hoy = await servicio({
    respuestas: [
      { itemId: 'nuevo', isCorrect: false, createdAt: hace(1) },
      { itemId: 'viejo', isCorrect: false, createdAt: hace(20) },
    ],
    item: { ...item, id: 'viejo' },
  }).paraHoy('u1');
  assert.equal(hoy?.itemId, 'viejo');
});

test('sin errores pendientes cae al tema más flojo', async () => {
  const hoy = await servicio({
    respuestas: [{ itemId: 'i1', isCorrect: true, createdAt: hace(1) }],
    temasDebiles: [{ area: 'MAT', tema: 'angulos-internos' }],
  }).paraHoy('u1');
  assert.ok(hoy);
  assert.match(hoy!.motivo, /angulos internos/);
});

test('se marca hecha solo cuando la acertó hoy', async () => {
  const hoy = await servicio({
    respuestas: [{ itemId: 'i1', isCorrect: false, createdAt: hace(2) }],
    aciertoDeHoy: true,
  }).paraHoy('u1');
  assert.equal(hoy?.resueltoHoy, true);
});

test('fallarla hoy no la da por hecha', async () => {
  // The bug this replaces: asking only whether it had been answered
  // closed the card the moment the learner failed it, which is exactly
  // when it deserves another go. Failing it today is the reason it is
  // today's question.
  const hoy = await servicio({
    respuestas: [{ itemId: 'i1', isCorrect: false, createdAt: hace(2) }],
    respuestaDeHoy: true,
  }).paraHoy('u1');
  assert.equal(hoy?.resueltoHoy, false);
});

test('no devuelve la respuesta correcta', async () => {
  // It is a question to answer, not to read: shipping the key would
  // make the whole thing pointless.
  const hoy = await servicio({
    respuestas: [{ itemId: 'i1', isCorrect: false, createdAt: hace(2) }],
  }).paraHoy('u1');
  const texto = JSON.stringify(hoy);
  assert.ok(!/respuesta_correcta/.test(texto));
  assert.ok(!/justificacion/.test(texto));
});

test('si la consulta falla, la tarjeta desaparece sin romper nada', async () => {
  // A missing card is a smaller problem than a broken dashboard, and
  // this is the least important thing on it.
  const hoy = await servicio({ falla: true }).paraHoy('u1');
  assert.equal(hoy, null);
});

test('una zona horaria inválida no tumba la tarjeta', async () => {
  const hoy = await servicio({
    respuestas: [{ itemId: 'i1', isCorrect: false, createdAt: hace(2) }],
  }).paraHoy('u1', 'Marte/Olympus');
  assert.ok(hoy);
});

test('una vez hecha la del día, no hay otra hasta mañana', async () => {
  /* Reported from a phone: answering the card produced another
     question, then another. "Tu pregunta de hoy" turned into a feed,
     and the name stopped being true. */
  const svc = servicio({
    respuestas: [{ itemId: 'i1', isCorrect: false, createdAt: new Date() }],
    yaHizoLaDeHoy: true,
  });
  assert.equal(await svc.paraHoy('u1', 'America/Bogota'), null);
});

test('con errores pendientes y sin haberla hecho, sí hay pregunta', async () => {
  // The other half: the guard must not swallow the card entirely.
  const svc = servicio({
    respuestas: [{ itemId: 'i1', isCorrect: false, createdAt: new Date() }],
    yaHizoLaDeHoy: false,
  });
  assert.notEqual(await svc.paraHoy('u1', 'America/Bogota'), null);
});
