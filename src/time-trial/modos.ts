/**
 * The contrarreloj ladder.
 *
 * The three modes it replaces — "Reto 5", "Sprint 10", "Explosivo" —
 * all worked out to sixty seconds a question, so there was no
 * progression and no pressure: the real exam gives 270 minutes for 254
 * questions, which is 64 seconds each. Practising at 60 is practising
 * at exam pace while being told it is a sprint.
 *
 * The ladder is anchored to that number. Below it you are building up,
 * at it you are rehearsing the real thing, above it you are buying
 * yourself margin for the questions that need thinking.
 *
 * Names say what the mode is for. "Sprint 10" told a learner how many
 * questions, which is the least useful fact about it.
 */

/** The real exam's pace: 270 minutes for 254 questions. */
export const SEGUNDOS_EXAMEN_REAL = 64;

export interface ModoContrarreloj {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly timeLimitSeconds: number;
  readonly questions: number;
  readonly segundosPorPregunta: number;
  /** Order in the ladder, for the interface to show progress. */
  readonly nivel: number;
  /** Fixed area, or null to aim at the learner's weakest. */
  readonly area: string | null;
  readonly dificultad: string | null;
  readonly mix?: ReadonlyArray<{ area: string; dificultad: string; n: number }>;
}

export const MODOS: readonly ModoContrarreloj[] = [
  {
    id: 'calentamiento',
    title: 'Calentamiento',
    description: 'Un poco más de tiempo del que da el examen. Para entrar en ritmo.',
    timeLimitSeconds: 540,
    questions: 6,
    segundosPorPregunta: 90,
    nivel: 1,
    // Aimed at whatever the learner is weakest in.
    area: null,
    dificultad: 'media',
  },
  {
    id: 'ritmo-real',
    title: 'Ritmo real',
    description: 'Exactamente el tiempo que tendrá el día del examen: 64 segundos por pregunta.',
    timeLimitSeconds: 512,
    questions: 8,
    segundosPorPregunta: 64,
    nivel: 2,
    area: null,
    dificultad: 'media',
  },
  {
    id: 'bajo-presion',
    title: 'Bajo presión',
    description: 'Menos tiempo del real, para que el día del examen le sobre.',
    timeLimitSeconds: 360,
    questions: 8,
    segundosPorPregunta: 45,
    nivel: 3,
    area: null,
    dificultad: 'alta',
  },
  {
    id: 'muerte-subita',
    title: 'Muerte súbita',
    description: 'Medio minuto por pregunta. O lo ve de una, o lo pierde.',
    timeLimitSeconds: 150,
    questions: 5,
    segundosPorPregunta: 30,
    nivel: 4,
    area: null,
    dificultad: 'alta',
  },
  {
    id: 'simulacro-mixto',
    title: 'Las cinco áreas',
    description: 'Una de cada área, como viene el examen: revuelto y sin avisar.',
    timeLimitSeconds: 320,
    questions: 5,
    segundosPorPregunta: 64,
    nivel: 2,
    area: null,
    dificultad: null,
    mix: [
      { area: 'MAT', dificultad: 'media', n: 1 },
      { area: 'LC', dificultad: 'media', n: 1 },
      { area: 'CN', dificultad: 'media', n: 1 },
      { area: 'SOC', dificultad: 'media', n: 1 },
      { area: 'ING', dificultad: 'media', n: 1 },
    ],
  },
];

/** The ids that are no longer offered, so they can be retired. */
export const MODOS_RETIRADOS = ['sprint_10', 'reto_5', 'explosivo'];
