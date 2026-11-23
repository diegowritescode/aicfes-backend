/**
 * Who won a duel, and whether one may be started at all.
 *
 * Both players answer the same five questions, so the comparison is
 * fair by construction. What remains is deciding what "winning" means
 * when the two numbers disagree.
 */

export interface MarcadorDeJugador {
  readonly aciertos: number;
  /** Seconds spent. Only breaks a tie; never outranks accuracy. */
  readonly segundos: number;
}

export type Veredicto =
  | { readonly tipo: 'retador' }
  | { readonly tipo: 'rival' }
  | { readonly tipo: 'empate' };

/**
 * Accuracy first, time only to break a tie.
 *
 * The order is the whole product decision. Scoring time first would
 * teach a learner to answer fast and wrong, and the ICFES gives 64
 * seconds a question precisely because the questions need thinking. A
 * duel is meant to make practice social, not to train recklessness.
 *
 * An exact tie on both counts is a tie. Inventing a tiebreak — who
 * answered first, who challenged — would decide the match on something
 * neither player did better.
 */
export function decidir(
  retador: MarcadorDeJugador,
  rival: MarcadorDeJugador,
): Veredicto {
  if (retador.aciertos !== rival.aciertos) {
    return retador.aciertos > rival.aciertos ? { tipo: 'retador' } : { tipo: 'rival' };
  }

  if (retador.segundos !== rival.segundos) {
    return retador.segundos < rival.segundos ? { tipo: 'retador' } : { tipo: 'rival' };
  }

  return { tipo: 'empate' };
}

export type MotivoDeRechazo =
  | 'a_si_mismo'
  | 'bloqueado'
  | 'rival_no_buscable'
  | 'sin_autorizacion'
  | 'duelo_abierto'
  | 'demasiados_hoy';

/**
 * How many duels one learner may open against the same rival at once.
 *
 * One. Without this, a stranger can fill someone's screen with
 * invitations they have to dismiss one by one, which is harassment
 * carried out through an ordinary feature.
 */
export const DUELOS_ABIERTOS_POR_PAREJA = 1;

/**
 * How many invitations one learner may send in a day, to anyone.
 *
 * Twenty is far above what a learner with friends would send and far
 * below what someone working through a list of search results would.
 */
export const INVITACIONES_POR_DIA = 20;

export interface PermisoParaRetar {
  readonly puede: boolean;
  readonly motivo?: MotivoDeRechazo;
  readonly mensaje?: string;
}

const MENSAJES: Record<MotivoDeRechazo, string> = {
  a_si_mismo: 'No puede retarse a usted mismo.',
  bloqueado: 'No puede retar a esta persona.',
  rival_no_buscable: 'No puede retar a esta persona.',
  sin_autorizacion:
    'Para retar a alguien, primero necesita la autorización de su acudiente en Ajustes.',
  duelo_abierto: 'Ya tiene un duelo abierto con esta persona. Termínelo primero.',
  demasiados_hoy: 'Llegó al límite de retos por hoy. Vuelva mañana.',
};

/**
 * Whether this challenge may be created.
 *
 * `bloqueado` and `rival_no_buscable` deliberately say the same thing
 * to the learner. Telling someone "this person blocked you" confirms
 * the account exists and that a specific person acted against them,
 * which is information a blocked user can act on. The distinction is
 * kept in the code for the logs and lost on the way to the screen.
 */
export function puedeRetar(contexto: {
  readonly retadorId: string;
  readonly rivalId: string;
  /** Either direction: a block stops contact both ways. */
  readonly hayBloqueo: boolean;
  readonly rivalVisible: boolean;
  readonly retadorAutorizado: boolean;
  readonly duelosAbiertosConEseRival: number;
  readonly invitacionesHoy: number;
}): PermisoParaRetar {
  const no = (motivo: MotivoDeRechazo): PermisoParaRetar => ({
    puede: false,
    motivo,
    mensaje: MENSAJES[motivo],
  });

  if (contexto.retadorId === contexto.rivalId) return no('a_si_mismo');

  /* Checked before the rival's visibility so that a blocked learner
     cannot distinguish "blocked me" from "not searchable" by timing or
     by trying a second account. */
  if (contexto.hayBloqueo) return no('bloqueado');
  if (!contexto.rivalVisible) return no('rival_no_buscable');

  if (!contexto.retadorAutorizado) return no('sin_autorizacion');

  if (contexto.duelosAbiertosConEseRival >= DUELOS_ABIERTOS_POR_PAREJA) {
    return no('duelo_abierto');
  }

  if (contexto.invitacionesHoy >= INVITACIONES_POR_DIA) return no('demasiados_hoy');

  return { puede: true };
}

/** How long an invitation stays acceptable. */
export const HORAS_PARA_ACEPTAR = 48;

/**
 * When an invitation stops being acceptable.
 *
 * An invitation that never expires leaves a notification a learner
 * cannot clear and a duel neither player will finish.
 */
export function expiraEn(creadoEn: Date): Date {
  return new Date(creadoEn.getTime() + HORAS_PARA_ACEPTAR * 60 * 60 * 1000);
}
