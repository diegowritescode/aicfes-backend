/**
 * Seeds a week of practice history through the public API.
 *
 * The companion to `sembrar-informe-demo.ts`, and the one to use
 * against a deployed server. That one talks to Prisma directly, which
 * is fine locally and impossible in production: the API image is
 * built with `npm ci --omit=dev`, so it has no `ts-node`, and it only
 * copies `dist`, `prisma` and `prompts` — `scripts/` never ships. The
 * container is also `read_only: true` with `cap_drop: ALL`, which is
 * hardening worth keeping rather than working around for a demo.
 *
 * So this one uses only endpoints a signed-in learner already has:
 * `POST /api/auth/login`, `GET /api/items`, `POST
 * /api/study-sessions/start`, `POST /api/answers` and `POST
 * /api/study-sessions/:id/complete`. Nothing privileged, nothing
 * inside the container.
 *
 * That has a consequence worth stating: the answers are real answers
 * on real items, so they feed XP, the streak and `PerfilDebilidad`
 * exactly as a learner's would. Run it on a throwaway account, never
 * on the one you care about — `PerfilDebilidad` decides which
 * questions the app serves, and teaching it that you fail `angulos`
 * will keep serving you `angulos` for weeks. Deleting the answers
 * does not undo it; those are accumulated counters.
 *
 * Usage:
 *   API=https://aicfes-backend.deviego.xyz \
 *   CORREO=demo-informe@aicfes.test CLAVE=... \
 *   npx ts-node scripts/sembrar-informe-via-api.ts
 */

const API = process.env.API ?? 'http://localhost:3000';
const CORREO = process.env.CORREO;
const CLAVE = process.env.CLAVE;

/**
 * The story the data tells.
 *
 * Times are deliberately spread. A first version gave every topic
 * 70-95 seconds and the «slow» list came out empty — which was the
 * code being right: slow means 1.5x the learner's own median, and a
 * learner slow at everything has a pacing problem rather than a topic
 * problem. Uniform times cannot show the feature at all.
 */
const GUION = [
  { area: 'MAT', total: 14, aciertos: 3, segundos: 110 },
  { area: 'MAT', total: 12, aciertos: 10, segundos: 95 },
  { area: 'LC', total: 11, aciertos: 9, segundos: 40 },
  { area: 'CN', total: 8, aciertos: 2, segundos: 55 },
] as const;

interface Item {
  readonly id: string;
  readonly area: string;
  readonly tags?: unknown;
}

async function pedir<T>(
  ruta: string,
  opciones: { metodo?: string; cuerpo?: unknown; token?: string } = {},
): Promise<T> {
  const respuesta = await fetch(`${API}${ruta}`, {
    method: opciones.metodo ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(opciones.token ? { Authorization: `Bearer ${opciones.token}` } : {}),
    },
    ...(opciones.cuerpo ? { body: JSON.stringify(opciones.cuerpo) } : {}),
  });

  const texto = await respuesta.text();

  if (!respuesta.ok) {
    throw new Error(`${opciones.metodo ?? 'GET'} ${ruta} => ${respuesta.status}: ${texto.slice(0, 300)}`);
  }

  return texto ? (JSON.parse(texto) as T) : (undefined as T);
}

/** The topic an item is about, read from its own tags. */
function temaDe(item: Item): string | null {
  const tags = item.tags;
  if (Array.isArray(tags) && typeof tags[0] === 'string') return tags[0];
  return null;
}

async function main() {
  if (!CORREO || !CLAVE) {
    console.error(
      'Falta CORREO o CLAVE.\n\n' +
        '  API=https://aicfes-backend.deviego.xyz \\\n' +
        '  CORREO=demo-informe@aicfes.test CLAVE=tu-clave \\\n' +
        '  npx ts-node scripts/sembrar-informe-via-api.ts\n',
    );
    process.exit(1);
  }

  console.log(`Entrando como ${CORREO} en ${API}`);

  const sesion = await pedir<{ accessToken?: string; token?: string; data?: { accessToken?: string } }>(
    '/api/auth/login',
    { metodo: 'POST', cuerpo: { email: CORREO, password: CLAVE } },
  );

  const token = sesion.accessToken ?? sesion.token ?? sesion.data?.accessToken;
  if (!token) {
    throw new Error(`El login no devolvió token: ${JSON.stringify(sesion).slice(0, 200)}`);
  }

  console.log('Sesión abierta.');

  let respuestasTotales = 0;
  const porTema = new Map<string, { total: number; aciertos: number; segundos: number }>();

  for (const paso of GUION) {
    /* Real items from the bank, so `itemId` points at a row whose
       `tags` the report can read. An invented id would be dropped and
       the window would come back empty — which is the exact shape of
       the bug this feature fixed. */
    const listado = await pedir<{ items?: Item[]; data?: Item[] }>(
      `/api/items?area=${paso.area}&limit=${paso.total}`,
      { token },
    );

    const items = listado.items ?? listado.data ?? [];
    const conTema = items.filter((i) => temaDe(i) !== null);

    if (conTema.length === 0) {
      console.log(`  ${paso.area}: el banco no tiene ítems con tema. Saltando.`);
      continue;
    }

    const ahora = new Date();

    const sesionEstudio = await pedir<{ sessionId?: string; id?: string; data?: { sessionId?: string } }>(
      '/api/study-sessions/start',
      {
        metodo: 'POST',
        token,
        cuerpo: {
          mode: 'contrarreloj',
          area: paso.area,
          dificultad: 'media',
          startedAt: ahora.toISOString(),
        },
      },
    );

    const sessionId =
      sesionEstudio.sessionId ?? sesionEstudio.id ?? sesionEstudio.data?.sessionId;
    if (!sessionId) {
      throw new Error(`No hubo sessionId: ${JSON.stringify(sesionEstudio).slice(0, 200)}`);
    }

    const respuestas = [];
    for (let i = 0; i < paso.total; i += 1) {
      const item = conTema[i % conTema.length]!;
      const correcta = i < paso.aciertos;
      const tema = temaDe(item)!;

      const previo = porTema.get(tema) ?? { total: 0, aciertos: 0, segundos: paso.segundos };
      porTema.set(tema, {
        total: previo.total + 1,
        aciertos: previo.aciertos + (correcta ? 1 : 0),
        segundos: paso.segundos,
      });

      respuestas.push({
        sessionId,
        questionIndex: i,
        area: paso.area,
        dificultad: 'media',
        selectedAnswer: correcta ? 'A' : 'B',
        isCorrect: correcta,
        itemId: item.id,
        /* Jittered so a median is a median of something. */
        tiempoMs: (paso.segundos + (i % 5) - 2) * 1000,
      });
    }

    await pedir('/api/answers', { metodo: 'POST', token, cuerpo: { answers: respuestas } });

    await pedir(`/api/study-sessions/${sessionId}/complete`, {
      metodo: 'POST',
      token,
      cuerpo: {
        endedAt: new Date().toISOString(),
        durationSeconds: paso.total * paso.segundos,
        totalQuestions: paso.total,
        correctQuestions: paso.aciertos,
      },
    });

    respuestasTotales += paso.total;
    console.log(
      `  ${paso.area}: ${paso.total} respuestas, ${paso.aciertos} correctas, ~${paso.segundos}s cada una`,
    );
  }

  console.log(`\nSembradas ${respuestasTotales} respuestas.\n`);
  console.log('Por tema:');
  for (const [tema, d] of porTema) {
    const pct = Math.round((d.aciertos / d.total) * 100);
    console.log(`  ${tema}: ${d.total} respondidas, ${pct}% acierto, ~${d.segundos}s`);
  }
  console.log('\nAbre la pestaña Yo en la app. El primero que la abra esta semana');
  console.log('espera unos segundos: el informe se genera ahí y se guarda.');
}

main().catch((error) => {
  console.error('\nFalló:', error instanceof Error ? error.message : error);
  process.exit(1);
});
