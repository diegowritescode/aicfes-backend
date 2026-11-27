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
 * The shape of the week, per area.
 *
 * Topics are NOT listed here, and that is the point. A first version
 * named `angulos` and `fracciones`, and asking contrarreloj for
 * `angulos` came back with `pitagoras` and `proporcionalidad`: the
 * bank has no topic called `angulos`, so the topic filter matched
 * nothing and the area top-up answered instead. The degradation
 * worked exactly as designed, and the seed was fiction.
 *
 * So the topics are read off the items the server actually serves,
 * and the script shapes accuracy and pace around whatever comes back.
 *
 * `rapido` and `lento` are what make the «slow» list mean something:
 * slow is 1.5x the learner's own median, so a seed where every topic
 * takes the same time produces an empty list no matter how slow it is.
 */
const GUION = [
  { area: 'MAT', preguntas: 8, aciertos: 2, segundos: 110 },
  { area: 'MAT', preguntas: 8, aciertos: 7, segundos: 100 },
  { area: 'LC', preguntas: 8, aciertos: 7, segundos: 35 },
  { area: 'CN', preguntas: 8, aciertos: 2, segundos: 45 },
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

  const sesion = await pedir<{
    token?: string;
    accessToken?: string;
    data?: { token?: string; accessToken?: string };
  }>('/api/auth/login', {
    metodo: 'POST',
    cuerpo: { email: CORREO, password: CLAVE },
  });

  /* `data.token` first: that is what this API actually answers with.
     The others are kept as fallbacks rather than guesses — the first
     run of this script looked for `accessToken` at the top level and
     failed on a login that had in fact succeeded. */
  const token =
    sesion.data?.token ?? sesion.data?.accessToken ?? sesion.token ?? sesion.accessToken;
  if (!token) {
    throw new Error(`El login no devolvió token: ${JSON.stringify(sesion).slice(0, 200)}`);
  }

  console.log('Sesión abierta.');

  let respuestasTotales = 0;
  const porTema = new Map<string, { total: number; aciertos: number; segundos: number }>();

  for (const paso of GUION) {
    /* Questions come from contrarreloj, not from `GET /api/items`.
       Two reasons: that route answered 500 in production because a
       bare `findMany` returns `tiempoTotalMs`, a BigInt that
       `JSON.stringify` refuses — a pre-existing bug nothing had hit
       because the app never calls it. And contrarreloj is the path a
       learner actually takes, so seeding through it exercises the
       same code the feature changed. */
    const ronda = await pedir<{
      data?: { sessionId?: string; items?: Item[] };
      sessionId?: string;
      items?: Item[];
    }>('/api/time-trial/start', {
      metodo: 'POST',
      token,
      cuerpo: {
        custom: {
          area: paso.area,
          dificultad: 'media',
          questions: paso.preguntas,
          timeLimitSeconds: paso.preguntas * 64,
        },
      },
    });

    const sessionId = ronda.data?.sessionId ?? ronda.sessionId;
    const items = ronda.data?.items ?? ronda.items ?? [];

    if (!sessionId || items.length === 0) {
      console.log(`  ${paso.area}: la ronda no trajo preguntas. Saltando.`);
      continue;
    }

    const respuestas = items.map((item, i) => {
      const correcta = i < paso.aciertos;
      const tema = temaDe(item);

      if (tema) {
        const previo = porTema.get(tema) ?? {
          total: 0,
          aciertos: 0,
          segundos: paso.segundos,
        };
        porTema.set(tema, {
          total: previo.total + 1,
          aciertos: previo.aciertos + (correcta ? 1 : 0),
          segundos: paso.segundos,
        });
      }

      return {
        sessionId,
        questionIndex: i,
        area: paso.area,
        dificultad: 'media',
        selectedAnswer: correcta ? 'A' : 'B',
        isCorrect: correcta,
        itemId: item.id,
        /* Jittered so a median is a median of something. */
        tiempoMs: (paso.segundos + (i % 5) - 2) * 1000,
      };
    });

    await pedir('/api/answers', {
      metodo: 'POST',
      token,
      cuerpo: { answers: respuestas },
    });

    await pedir(`/api/study-sessions/${sessionId}/complete`, {
      metodo: 'POST',
      token,
      cuerpo: {
        endedAt: new Date().toISOString(),
        durationSeconds: respuestas.length * paso.segundos,
        totalQuestions: respuestas.length,
        correctQuestions: Math.min(paso.aciertos, respuestas.length),
      },
    });

    respuestasTotales += respuestas.length;
    console.log(
      `  ${paso.area}: ${respuestas.length} respuestas, ${Math.min(paso.aciertos, respuestas.length)} correctas, ~${paso.segundos}s cada una`,
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
