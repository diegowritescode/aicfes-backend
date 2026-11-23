/**
 * What an alias may be, and what it may not.
 *
 * Alias search was chosen over invitation codes knowing the cost: it
 * lets any learner find any other, and the audience is 16-18. So the
 * rules here are not cosmetic — an alias is the only thing a stranger
 * sees before deciding whom to challenge, and the only field in this
 * product that one learner writes and another reads.
 *
 * Pure and separate from the service because every rule here is a
 * decision someone could reasonably disagree with, and a decision
 * deserves a test rather than a reading of a regular expression.
 */

export const LARGO_MINIMO = 3;
export const LARGO_MAXIMO = 16;

/**
 * Letters, digits, underscore and dot. No spaces and no accents.
 *
 * Accents are excluded for a reason that is not laziness: `camilo` and
 * `camiló` look alike at a glance on a phone, and an alias whose point
 * is to be recognised by a classmate must not be confusable with
 * another account's. Unicode confusables are the same problem one step
 * further, which is why the set is this small.
 */
const PERMITIDOS = /^[a-z0-9_.]+$/;

/** Reserved so nobody can impersonate the product or moderation. */
const RESERVADOS = new Set([
  'aicfes',
  'admin',
  'administrador',
  'soporte',
  'moderador',
  'moderacion',
  'icfes',
  'oficial',
  'staff',
  'ayuda',
  'equipo',
]);

export type RechazoDeAlias =
  | 'vacio'
  | 'corto'
  | 'largo'
  | 'caracteres'
  | 'reservado'
  | 'solo_puntuacion';

export interface AliasValidado {
  readonly ok: true;
  /** Lowercased, so the unique index is effectively case-insensitive. */
  readonly alias: string;
}

export interface AliasRechazado {
  readonly ok: false;
  readonly motivo: RechazoDeAlias;
  /** Said to the learner, in their language, without jargon. */
  readonly mensaje: string;
}

const MENSAJES: Record<RechazoDeAlias, string> = {
  vacio: 'Escriba un nombre.',
  corto: `El nombre necesita al menos ${LARGO_MINIMO} letras.`,
  largo: `El nombre no puede pasar de ${LARGO_MAXIMO} letras.`,
  caracteres: 'Use solo letras sin tildes, números, punto y guion bajo.',
  reservado: 'Ese nombre está reservado. Escoja otro.',
  solo_puntuacion: 'El nombre necesita al menos una letra o número.',
};

/**
 * Normalises and checks an alias.
 *
 * Trimmed and lowercased before checking, so `  Camilo ` and `camilo`
 * are the same alias rather than two accounts a classmate cannot tell
 * apart.
 */
export function validarAlias(entrada: string): AliasValidado | AliasRechazado {
  const limpio = entrada.trim().toLowerCase();

  const rechazo = (motivo: RechazoDeAlias): AliasRechazado => ({
    ok: false,
    motivo,
    mensaje: MENSAJES[motivo],
  });

  if (limpio.length === 0) return rechazo('vacio');
  if (limpio.length < LARGO_MINIMO) return rechazo('corto');
  if (limpio.length > LARGO_MAXIMO) return rechazo('largo');
  if (!PERMITIDOS.test(limpio)) return rechazo('caracteres');

  /* `...` and `_._` pass the character check and are unreadable. An
     alias has to be sayable out loud to a classmate. */
  if (!/[a-z0-9]/.test(limpio)) return rechazo('solo_puntuacion');

  if (RESERVADOS.has(limpio)) return rechazo('reservado');

  return { ok: true, alias: limpio };
}

/**
 * Whether this account may appear in someone else's search results.
 *
 * Three conditions, all required, written in the order of how much
 * they matter.
 *
 * `tutorAutorizo` comes first because Colombia's Ley 1581 de 2012
 * requires a guardian's authorisation to process a minor's personal
 * data, and an alias strangers can search for is exactly that. Without
 * it the account still works — training, simulacros, the toll — and is
 * simply invisible.
 *
 * `buscable` is the learner's own switch, separate from having an alias
 * on purpose: the decision that exposes someone to strangers should be
 * revocable without losing the name their friends know them by.
 */
export function esVisibleEnBusqueda(cuenta: {
  readonly alias: string | null;
  readonly aliasBuscable: boolean;
  readonly tutorAutorizoEn: Date | null;
}): boolean {
  if (cuenta.tutorAutorizoEn === null) return false;
  if (!cuenta.aliasBuscable) return false;
  return cuenta.alias !== null;
}
