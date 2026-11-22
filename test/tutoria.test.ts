import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { TutoriaService } from '../src/tutoria/tutoria.service';

/**
 * The tutor exists to close the gap between "you failed" and "here is
 * what you got wrong". Two things decide whether it does that, and
 * both are pinned here.
 *
 * It must not hand over the letter. A learner who works out that the
 * tutor can be talked into the answer stops thinking, and the feature
 * becomes an expensive way to cheat.
 *
 * The first reply must cost nothing and arrive instantly. Every item
 * already stores an explanation per option, written at generation
 * time; a modal that takes three seconds to say something gets closed
 * before it says it.
 */

const fuente = readFileSync(
  path.join(__dirname, '../src/tutoria/tutoria.service.ts'),
  'utf-8',
);

function servicio(opciones: {
  tutoria?: Record<string, unknown> | null;
  item?: Record<string, unknown> | null;
  alResponder?: (mensajes: unknown[]) => string;
  mensajesCreados?: unknown[];
}): TutoriaService {
  const creados = opciones.mensajesCreados ?? [];
  const prisma = {
    generatedItem: { findUnique: async () => opciones.item ?? null },
    tutoria: {
      findUnique: async () => opciones.tutoria ?? null,
      findUniqueOrThrow: async () => ({
        id: 't1',
        defensa: (opciones.tutoria as { defensa?: string } | null)?.defensa ?? null,
        mensajes: creados,
      }),
      upsert: async () => ({
        id: 't1',
        itemId: 'i1',
        opcionElegida: (opciones.tutoria as { opcionElegida?: string } | null)?.opcionElegida ?? 'B',
        mensajes: creados.length ? creados : [],
      }),
      update: async () => ({}),
    },
    tutoriaMensaje: {
      create: async ({ data }: { data: unknown }) => {
        creados.push(data);
        return data;
      },
    },
  };
  const openai = {
    createResponse: async (mensajes: unknown[]) =>
      opciones.alResponder ? opciones.alResponder(mensajes) : 'respuesta del tutor',
  };
  const config = { get: () => undefined };
  return new TutoriaService(prisma as never, openai as never, config as never);
}

const item = {
  id: 'i1',
  pregunta: '¿Cuál es el área?',
  contexto: 'Un triángulo de base 4 y altura 3.',
  opciones: { A: '6', B: '12', C: '7', D: '10' },
  respuesta_correcta: 'A',
  justificacion: 'El área es base por altura sobre dos.',
  explicaciones: {
    A: '✅ Correcta: 4×3/2 = 6.',
    B: '❌ Incorrecta: multiplicó base por altura y olvidó dividir.',
  },
};

test('el tutor tiene prohibido dar la letra, de forma explícita', () => {
  // The rule has to survive someone asking, insisting and giving up,
  // which is exactly when a vaguer instruction stops holding.
  assert.match(fuente, /NUNCA digas cuál es la letra correcta/);
  assert.match(fuente, /insiste|se rinde|frustra/);
  assert.match(fuente, /NO SE LA DIGAS/);
});

test('la apertura no llama a ningún modelo', async () => {
  // It is already written: one explanation per option, produced when
  // the item was generated.
  let llamadas = 0;
  const svc = servicio({
    tutoria: { id: 't1', itemId: 'i1', opcionElegida: 'B', mensajes: [] },
    item,
    alResponder: () => {
      llamadas += 1;
      return 'no debería llamarse';
    },
  });

  const estado = await svc.abrir({ userId: 'u1', itemId: 'i1', opcionElegida: 'B' });

  assert.equal(llamadas, 0, 'abrir la tutoría no debe costar una petición');
  const tutor = estado!.mensajes.filter((m) => m.autor === 'tutor');
  assert.ok(tutor.length >= 1);
  assert.match(tutor[0].contenido, /olvidó dividir/);
});

test('la apertura usa la explicación de la opción que eligió', async () => {
  const svc = servicio({
    tutoria: { id: 't1', itemId: 'i1', opcionElegida: 'B', mensajes: [] },
    item,
  });
  const estado = await svc.abrir({ userId: 'u1', itemId: 'i1', opcionElegida: 'B' });
  const tutor = estado!.mensajes.find((m) => m.autor === 'tutor')!;
  // B's explanation, not A's and not the generic justification.
  assert.match(tutor.contenido, /olvidó dividir/);
  assert.ok(!tutor.contenido.includes('✅'), 'no se filtra la de la correcta');
});

test('la apertura explica y pregunta en un solo mensaje', async () => {
  // Without an explicit invitation the learner does not know whether
  // to restate their reasoning or just leave. Split across two
  // messages it read as the panel saying the same thing twice.
  const svc = servicio({
    tutoria: { id: 't1', itemId: 'i1', opcionElegida: 'B', mensajes: [] },
    item,
  });
  const estado = await svc.abrir({ userId: 'u1', itemId: 'i1', opcionElegida: 'B' });
  const deTutor = estado!.mensajes.filter((m) => m.autor === 'tutor');
  assert.equal(deTutor.length, 1, 'la apertura es un turno, no dos');
  assert.match(deTutor[0].contenido, /olvidó dividir/);
  assert.match(deTutor[0].contenido, /Qué fue lo que pensó/i);
});

test('la defensa la responde el modelo, no una frase guardada', async () => {
  // The canned line was written when the item was generated, so it
  // cannot address what the learner just typed. Answering with it read
  // as a non-sequitur.
  let vioLaDefensa = false;
  const svc = servicio({
    tutoria: {
      id: 't1',
      itemId: 'i1',
      opcionElegida: 'B',
      mensajes: [{ autor: 'tutor', contenido: 'explicación', createdAt: new Date() }],
    },
    item,
    alResponder: (mensajes) => {
      vioLaDefensa = JSON.stringify(mensajes).includes('Multipliqué 4 por 3');
      return 'Eso mismo: le faltó dividir entre dos.';
    },
  });

  const estado = await svc.defender({
    userId: 'u1',
    itemId: 'i1',
    defensa: 'Multipliqué 4 por 3.',
  });

  assert.ok(vioLaDefensa, 'el modelo debe recibir lo que el estudiante escribió');
  const ultimo = estado!.mensajes[estado!.mensajes.length - 1];
  assert.match(ultimo.contenido, /le faltó dividir/);
});

test('se guarda la defensa del estudiante', async () => {
  // The text of how someone reasoned wrongly is a better signal than
  // which letter they pressed, and nothing else captures it.
  const svc = servicio({
    tutoria: { id: 't1', itemId: 'i1', opcionElegida: 'B', mensajes: [] },
    item,
  });
  const estado = await svc.defender({
    userId: 'u1',
    itemId: 'i1',
    defensa: 'Multipliqué 4 por 3 y me dio 12.',
  });
  const suyo = estado!.mensajes.find((m) => m.autor === 'estudiante')!;
  assert.match(suyo.contenido, /Multipliqué 4 por 3/);
});

test('la conversación se corta a los seis turnos', async () => {
  const previos = Array.from({ length: 6 }, (_, i) => ({
    autor: 'estudiante',
    contenido: `turno ${i}`,
    createdAt: new Date(),
  }));
  let llamadas = 0;
  const svc = servicio({
    tutoria: { id: 't1', itemId: 'i1', opcionElegida: 'B', defensa: 'ya', mensajes: previos },
    item,
    mensajesCreados: [...previos],
    alResponder: () => {
      llamadas += 1;
      return 'no debería';
    },
  });

  const estado = await svc.responder({ userId: 'u1', itemId: 'i1', mensaje: '¿y ahora?' });
  assert.equal(llamadas, 0, 'pasado el límite no se gasta una petición más');
  assert.equal(estado!.turnosRestantes, 0);
});

test('si el modelo falla, lo dice en vez de inventar', async () => {
  const svc = servicio({
    tutoria: { id: 't1', itemId: 'i1', opcionElegida: 'B', defensa: 'ya', mensajes: [] },
    item,
    alResponder: () => {
      throw new Error('502 del proveedor');
    },
  });
  const estado = await svc.responder({ userId: 'u1', itemId: 'i1', mensaje: 'no entiendo' });
  const ultimo = estado!.mensajes[estado!.mensajes.length - 1];
  assert.match(ultimo.contenido, /No pude responder/);
  assert.ok(!/502/.test(ultimo.contenido), 'el error técnico no se le muestra al estudiante');
});

test('el contexto que ve el modelo lleva la respuesta marcada como secreta', async () => {
  let visto = '';
  const svc = servicio({
    tutoria: { id: 't1', itemId: 'i1', opcionElegida: 'B', defensa: 'ya', mensajes: [] },
    item,
    alResponder: (mensajes) => {
      visto = JSON.stringify(mensajes);
      return 'ok';
    },
  });
  await svc.responder({ userId: 'u1', itemId: 'i1', mensaje: '¿cuál es?' });
  // The model needs to know the answer to guide towards it; what
  // matters is that it is labelled as not to be handed over.
  assert.match(visto, /NO SE LA DIGAS/);
  assert.match(visto, /NUNCA digas cuál es la letra/);
});

test('la tutoría es por estudiante y pregunta, no por sesión', () => {
  // Failing the same question twice has to reopen the same thread:
  // starting over would reproduce the explanation that already did
  // not work.
  const schema = readFileSync(
    path.join(__dirname, '../prisma/schema.prisma'),
    'utf-8',
  );
  assert.match(schema, /@@unique\(\[userId, itemId\]\)/);
});
