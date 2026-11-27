import type { ResumenDeLaSemana } from '../../calidad/semana-real.service';
import type { SeguimientoDelPlan } from './payload';

/**
 * Scoring last week's plan against what the learner actually did.
 *
 * The reports were already being stored, with their plans, and nobody
 * read them back. So every Monday the report started from zero: it
 * could never say «cumpliste lo de la semana pasada», never say
 * «llevas tres semanas con el mismo tema», and a plan nobody is ever
 * held to is a plan nobody follows.
 *
 * Pure, and separate from the service, because the interesting part
 * is the policy — what counts as having done an action — and that is
 * worth stating in one readable place and testing without a database.
 *
 * The rule: an action was attempted if the learner answered anything
 * on its topic inside the window. Not «did they improve»: improving
 * is what the report discusses, and collapsing it into a boolean here
 * would decide the model's conclusion for it. The model gets the
 * number and the verdict is its sentence to write.
 */

/**
 * Below this many answers the learner did touch the topic, but not
 * enough for an accuracy to mean anything. The percentage is withheld
 * rather than shown, so the report cannot say «bajaste a 33%» about
 * three questions.
 */
const MINIMO_PARA_UN_PORCENTAJE = 3;

interface AccionAnterior {
  readonly area: string;
  readonly tema: string;
  readonly titulo: string;
}

/**
 * Reads a stored plan back out of a `Json` column.
 *
 * Defensive because the column is `Json` and the shape is only as
 * good as whatever wrote it: a row written by an older prompt
 * version, or hand-edited in psql, must not crash this week's
 * report. Anything unrecognisable is skipped.
 */
export function leerPlanGuardado(plan: unknown): AccionAnterior[] {
  if (!Array.isArray(plan)) return [];

  return plan.flatMap((accion) => {
    if (typeof accion !== 'object' || accion === null) return [];
    const campo = accion as Record<string, unknown>;

    const area = campo.area;
    const tema = campo.tema;
    const titulo = campo.titulo;

    if (typeof area !== 'string' || typeof tema !== 'string') return [];

    return [
      {
        area,
        tema,
        titulo: typeof titulo === 'string' ? titulo : tema,
      },
    ];
  });
}

/**
 * What became of each action, measured in the week just ended.
 *
 * Matched on the `area:tema` pair rather than the topic alone, for
 * the same reason `planConTemasReales` does: the same topic name can
 * appear under two areas, and crediting work in one to a plan about
 * the other would tell the learner they did something they did not.
 */
export function seguimientoDelPlan(
  planAnterior: readonly AccionAnterior[],
  semana: ResumenDeLaSemana | null,
): SeguimientoDelPlan[] {
  /* Every topic the window saw, strong, weak or merely slow. The
     three lists in `ResumenDeLaSemana` are views over one set of
     rows, so a topic that landed in none of them — mid accuracy, not
     slow — would otherwise look untouched. */
  const porTema = new Map(
    [...(semana?.fuertes ?? []), ...(semana?.flojos ?? []), ...(semana?.lentos ?? [])].map(
      /* Keyed as a plain string: the window types `area` as the Prisma
         `Area` enum while a stored plan read back out of a `Json`
         column is only ever `string`. Keeping the key loose here is
         what lets the two be compared at all, and `leerPlanGuardado`
         is the place that already refused anything that is not a
         string. */
      (t) => [`${t.area}:${t.tema}` as string, t] as const,
    ),
  );

  return planAnterior.map((accion) => {
    const visto = porTema.get(`${accion.area}:${accion.tema}`);

    if (!visto) {
      return {
        area: accion.area,
        tema: accion.tema,
        titulo: accion.titulo,
        respondidas: 0,
        aciertoPorcentaje: null,
        sinTocar: true,
      };
    }

    return {
      area: accion.area,
      tema: accion.tema,
      titulo: accion.titulo,
      respondidas: visto.respondidas,
      /* Withheld under the floor: a percentage computed from two
         answers is a number the learner will quote back, and it does
         not mean what it says. */
      aciertoPorcentaje:
        visto.respondidas >= MINIMO_PARA_UN_PORCENTAJE ? visto.aciertoPorcentaje : null,
      sinTocar: false,
    };
  });
}
