import type { InformeRespuesta } from '../dto/informe-respuesta.schema';
import type { TemaDebilPlano } from './payload';

/**
 * A plan can only aim at topics the server supplied.
 *
 * The plan is not prose. `time-trial.service.ts` asks the bank for
 * exercises by area and topic, so each action is a query waiting to
 * run — and a query for a topic the bank has never heard of returns
 * nothing. The learner taps «practicar esto» and lands on an empty
 * screen, which is worse than not offering the button.
 *
 * A model will invent a plausible topic. Asked about `angulos` it may
 * answer `geometria_basica`, which reads better and matches no row.
 * `strict: true` cannot prevent it: a JSON Schema holds a fixed enum,
 * and the valid topics are different for every learner and every
 * week.
 *
 * So the check happens here, after parsing. Actions that do not match
 * are dropped rather than rejected: three good actions and one
 * invented one should leave three, not nothing. The report is already
 * paid for by then, and most of it is still true.
 */
export function planConTemasReales(
  plan: InformeRespuesta['plan'],
  temas: readonly TemaDebilPlano[],
): InformeRespuesta['plan'] {
  /* Matched on the pair, not on the topic alone: the same topic name
     can appear under two areas, and an action filed under the wrong
     one would draw from the wrong part of the bank. */
  const validos = new Set(temas.map((t) => `${t.area}:${t.tema}`));

  return plan.filter((accion) => validos.has(`${accion.area}:${accion.tema}`));
}
