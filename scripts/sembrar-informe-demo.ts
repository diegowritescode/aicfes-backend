/**
 * Seeds one disposable learner with enough practice history to make
 * the weekly report say something interesting.
 *
 * Why a separate user and not the real one: `Answer` is not an
 * isolated table. Every row feeds XP, the streak, the dashboard and
 * `PerfilDebilidad` — and `PerfilDebilidad` decides which questions
 * the app serves. Seeding forty failed answers on `angulos` does not
 * just paint a report; it teaches the app that this learner is bad at
 * angles and it will keep serving angles for weeks. Deleting the
 * answers afterwards does not undo it, because those are accumulated
 * counters rather than a view.
 *
 * So everything here hangs off one user, and `--borrar` removes that
 * user. The foreign keys cascade, so the sessions, answers, weakness
 * rows and reports go with it.
 *
 * Run:
 *   npx ts-node scripts/sembrar-informe-demo.ts
 *   npx ts-node scripts/sembrar-informe-demo.ts --borrar
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CORREO = 'demo-informe@aicfes.test';

/**
 * The story the data tells.
 *
 * Shaped so each section of the card has something to show, and so
 * the interesting combinations exist:
 *
 * - `angulos`: fails it AND is slow at it. The most useful finding in
 *   the report and the one a percentage alone cannot express.
 * - `fracciones`: gets it right but slowly. Would pass unnoticed in
 *   any accuracy-only view, and loses the real exam on time.
 * - `ecuaciones` and `comprension`: solid and fast. They give the
 *   report real strengths to name per topic rather than per area, and
 *   they are what pulls the median down far enough for «slow» to mean
 *   something.
 * - `leyes-de-newton`: a plain weakness, neither fast nor slow.
 *
 * The times are deliberately spread. A first version of this script
 * gave every topic 70-95 seconds, and `lentos` came out empty — which
 * was the code being right: «slow» is 1.5x the learner's own median,
 * and a learner slow at everything has a pacing problem rather than a
 * topic problem. Seeding uniform times cannot show the feature at all.
 *
 * `inferencia` is deliberately ABSENT. It is in last week's plan and
 * in the standing weakness profile, with no answers this week, which
 * is the only way to see «no lo practicaste» on screen.
 */
const GUION = [
  { area: 'MAT', tema: 'angulos', total: 14, aciertos: 3, segundos: 110 },
  { area: 'MAT', tema: 'fracciones', total: 12, aciertos: 10, segundos: 95 },
  { area: 'MAT', tema: 'ecuaciones', total: 10, aciertos: 9, segundos: 35 },
  { area: 'LC', tema: 'comprension', total: 11, aciertos: 9, segundos: 40 },
  { area: 'CN', tema: 'leyes-de-newton', total: 8, aciertos: 2, segundos: 55 },
] as const;

/**
 * A standing weakness with no practice this week.
 *
 * Written into `PerfilDebilidad` only, never into `Answer`, so the
 * window does not see it and last week's plan shows it as untouched.
 */
const SIN_PRACTICAR = {
  area: 'LC',
  tema: 'inferencia',
  total: 10,
  aciertos: 3,
} as const;

/** Which mistake each topic tends to produce, for the error-type line. */
const ERROR_POR_TEMA: Record<string, string> = {
  angulos: 'error_calculo',
  inferencia: 'interpretacion_parcial',
  'leyes-de-newton': 'confunde_conceptos',
};

function lunesDeEstaSemana(): Date {
  const hoy = new Date();
  const medianoche = new Date(
    Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate()),
  );
  const dia = medianoche.getUTCDay();
  medianoche.setUTCDate(medianoche.getUTCDate() - (dia === 0 ? 6 : dia - 1));
  return medianoche;
}

async function borrar() {
  const usuario = await prisma.user.findUnique({ where: { email: CORREO } });
  if (!usuario) {
    console.log(`No existe ${CORREO}. Nada que borrar.`);
    return;
  }
  /* One delete: every table involved has ON DELETE CASCADE back to
     User, which is what makes a disposable user safe to seed. */
  await prisma.user.delete({ where: { id: usuario.id } });
  console.log(`Borrado ${CORREO} y todo lo que colgaba de él.`);
}

async function sembrar() {
  const existente = await prisma.user.findUnique({
    where: { email: CORREO },
    select: { id: true, passwordHash: true },
  });

  /* Reusing an existing row is the intended path, not an error. The
     recommended order is to register this email through the app so
     its own sign-up writes the password hash — nothing here should —
     and then seed the history onto the user that already exists.

     Seeding twice would double every count, so existing history is
     cleared first. The report row too: it is keyed by week, and a
     stale one would be read instead of generated. */
  let usuario: { id: string };

  if (existente) {
    const sesiones = await prisma.studySession.deleteMany({
      where: { userId: existente.id },
    });
    await prisma.perfilDebilidad.deleteMany({ where: { userId: existente.id } });
    await prisma.informeSemanal.deleteMany({ where: { userId: existente.id } });
    /* The generation request too: its `requestId` is unique and does
       NOT hang off the user, so leaving it behind makes the second run
       fail on the insert. Deleting it cascades to its items. */
    await prisma.generationRequest.deleteMany({
      where: { requestId: `demo-${existente.id}` },
    });

    console.log(
      `Reusando ${CORREO}` +
        (existente.passwordHash ? ' (tiene contraseña, puedes entrar con él)' : ' (sin contraseña)') +
        `. Limpié ${sesiones.count} sesiones previas.`,
    );
    usuario = { id: existente.id };
  } else {
    /* No password written here: the app's own sign-up is the only
       thing that should ever write a hash. A user created this way
       can hold a report but cannot sign in. */
    usuario = await prisma.user.create({
      data: {
        email: CORREO,
        timezone: 'America/Bogota',
      },
      select: { id: true },
    });
    console.log(`Creado ${CORREO} sin contraseña.`);
  }

  const lunes = lunesDeEstaSemana();

  /* Items have to exist, because the report joins answers to items to
     read the topic out of `tags`. Without this join there is no topic
     and the whole window is empty — which is exactly the shape of the
     bug this feature fixed. */
  const request = await prisma.generationRequest.create({
    data: {
      requestId: `demo-${usuario.id}`,
      area: 'MAT',
      dificultad: 'media',
      n: 1,
      status: 'SUCCESS',
    },
  });

  let respuestasCreadas = 0;

  for (const paso of GUION) {
    const item = await prisma.generatedItem.create({
      data: {
        requestId: request.requestId,
        area: paso.area as never,
        dificultad: 'media',
        plantilla: 'demo',
        contexto: `Contexto de práctica sobre ${paso.tema.replace(/-/g, ' ')}.`,
        pregunta: `Pregunta de práctica sobre ${paso.tema.replace(/-/g, ' ')}.`,
        opciones: { A: 'A', B: 'B', C: 'C', D: 'D' },
        respuesta_correcta: 'A',
        justificacion: 'Sembrado para ver el informe.',
        /* The topic lives here, as a JSON array, which is what both
           `DebilidadesService` and the new window query read. */
        tags: [paso.tema],
        distractores: {
          B: ERROR_POR_TEMA[paso.tema] ?? 'error_calculo',
          C: ERROR_POR_TEMA[paso.tema] ?? 'error_calculo',
          D: ERROR_POR_TEMA[paso.tema] ?? 'error_calculo',
        },
        verified: true,
      },
    });

    /* Spread across the week, two days in, so the answers are inside
       the window the report asks for and not on its boundary. */
    const cuando = new Date(lunes);
    cuando.setUTCDate(cuando.getUTCDate() + 2);
    cuando.setUTCHours(18, 0, 0, 0);

    const sesion = await prisma.studySession.create({
      data: {
        userId: usuario.id,
        mode: 'contrarreloj',
        area: paso.area as never,
        dificultad: 'media',
        startedAt: cuando,
        endedAt: cuando,
        durationSeconds: paso.total * paso.segundos,
        totalQuestions: paso.total,
        correctQuestions: paso.aciertos,
      },
    });

    for (let i = 0; i < paso.total; i += 1) {
      const correcta = i < paso.aciertos;

      await prisma.answer.create({
        data: {
          sessionId: sesion.id,
          questionIndex: i,
          area: paso.area as never,
          dificultad: 'media',
          selectedAnswer: correcta ? 'A' : 'B',
          isCorrect: correcta,
          itemId: item.id,
          /* The figure that was being stored and never read. Jittered
             so the median is a median of something. */
          tiempoMs: (paso.segundos + (i % 5) - 2) * 1000,
          createdAt: cuando,
        },
      });
      respuestasCreadas += 1;
    }

    /* The standing weakness profile, written as `DebilidadesService`
       would have: one row per topic, with the mistake counts. The
       report gates on this, so seeding answers alone would leave it
       with nothing to write. */
    const fallos = paso.total - paso.aciertos;
    const tipoError = ERROR_POR_TEMA[paso.tema];

    await prisma.perfilDebilidad.create({
      data: {
        userId: usuario.id,
        area: paso.area as never,
        tema: paso.tema,
        respondidas: paso.total,
        acertadas: paso.aciertos,
        tipoErrores: tipoError ? { [tipoError]: fallos } : {},
        ultimoFallo: fallos > 0 ? cuando : null,
      },
    });
  }

  /* The standing weakness with no answers this week. Only the profile
     row, so the window query cannot see it — which is what makes last
     week's plan show «no lo practicaste» for this one. */
  const haceDosSemanas = new Date(lunes);
  haceDosSemanas.setUTCDate(haceDosSemanas.getUTCDate() - 10);

  await prisma.perfilDebilidad.create({
    data: {
      userId: usuario.id,
      area: SIN_PRACTICAR.area as never,
      tema: SIN_PRACTICAR.tema,
      respondidas: SIN_PRACTICAR.total,
      acertadas: SIN_PRACTICAR.aciertos,
      tipoErrores: { interpretacion_parcial: SIN_PRACTICAR.total - SIN_PRACTICAR.aciertos },
      ultimoFallo: haceDosSemanas,
    },
  });

  /* Last week's report, so the follow-up section has something to
     score. Its plan points at `angulos` (practised, still bad) and
     `inferencia` (not practised at all), which are the two states
     worth seeing on screen. */
  const semanaPasada = new Date(lunes);
  semanaPasada.setUTCDate(semanaPasada.getUTCDate() - 7);

  await prisma.informeSemanal.create({
    data: {
      userId: usuario.id,
      semanaInicio: semanaPasada,
      resumen: 'Informe sembrado de la semana pasada, para ver el seguimiento.',
      fortalezas: [{ area: 'MAT', nota: 'Vas bien en ecuaciones.' }],
      debilidades: [{ area: 'MAT', nota: 'Ángulos te está costando.' }],
      plan: [
        {
          area: 'MAT',
          tema: 'angulos',
          titulo: 'Repasa ángulos',
          detalle: 'Cinco preguntas de ángulos, despacio.',
        },
        {
          area: 'LC',
          tema: 'inferencia',
          titulo: 'Practica inferencia',
          detalle: 'Lee el enunciado completo antes de responder.',
        },
      ],
      datos: {},
      modelo: 'sembrado',
      promptVersion: 'sembrado',
    },
  });

  console.log(`
Sembrado ${CORREO}
  usuario:     ${usuario.id}
  temas:       ${GUION.length}
  respuestas:  ${respuestasCreadas}
  semana:      ${lunes.toISOString().slice(0, 10)} (lunes, hora Bogotá)

Qué debería mostrar el informe:
  - Seguimiento: ángulos practicado y sigue mal; inferencia SIN TOCAR.
  - Salió bien:  ecuaciones y comprensión.
  - Te demoras:  ángulos y fracciones (110s y 95s contra mediana ~55s).
  - Te cuesta:   ángulos, leyes de newton, inferencia.

Para verlo en el celular: regístrate en la app con ${CORREO}
(cualquier contraseña) y vuelve a correr este script. Reusa el usuario
que ya exista y le cuelga la historia, así entras con tu contraseña.

Para borrarlo todo:
  npx ts-node scripts/sembrar-informe-demo.ts --borrar
`);
}

async function main() {
  if (process.argv.includes('--borrar')) {
    await borrar();
  } else {
    await sembrar();
  }
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error('Falló:', error instanceof Error ? error.message : error);
  await prisma.$disconnect();
  process.exit(1);
});
