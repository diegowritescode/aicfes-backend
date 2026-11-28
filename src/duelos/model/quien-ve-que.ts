/**
 * Who is allowed to see what of another learner's profile.
 *
 * Pulled out of the service as plain functions so the rule can be
 * tested without a database. The service is where the rows come from;
 * this is where the decision is made, and a decision this consequential
 * should be provable by a test that takes three booleans rather than
 * one that needs a block, a friendship and a guardian authorisation
 * fixtured into Postgres first.
 *
 * These accounts belong to 16-to-18-year-olds. Every function here
 * defaults to showing less.
 */

/** How this learner stands with the one whose profile they opened. */
export type Relacion =
  | 'amigos'
  | 'solicitud-enviada'
  | 'solicitud-recibida'
  | 'ninguna';

export type EstadoDeAmistad = {
  estado: string;
  pidioId: string;
};

/**
 * Which of the four states this pair is in, seen from `userId`.
 *
 * Returned by the server rather than worked out by the app, because
 * the app would have to load a friend list and a request list to work
 * it out — and a screen that guesses draws «Enviar solicitud» on
 * somebody who is already a friend.
 *
 * Anything that is neither accepted nor pending is `'ninguna'`: a
 * rejected request leaves a row behind, and that row must not stop
 * someone from asking again later.
 */
export function relacionCon(
  userId: string,
  amistad: EstadoDeAmistad | null | undefined,
): Relacion {
  if (!amistad) return 'ninguna';
  if (amistad.estado === 'aceptada') return 'amigos';
  if (amistad.estado !== 'pendiente') return 'ninguna';
  return amistad.pidioId === userId ? 'solicitud-enviada' : 'solicitud-recibida';
}

/**
 * The row that decides the relationship, when there is more than one.
 *
 * `@@unique([pidioId, recibioId])` is on the ORDERED pair, so a pair
 * of learners can hold two rows at once: A asked B at the same moment
 * B asked A. Reading «the first one found» then makes the answer
 * depend on the query planner — and an accepted friendship read as a
 * pending request hides the progress and offers «Enviar solicitud»
 * to somebody who is already a friend.
 *
 * An acceptance wins over anything else on the pair. If one row says
 * «aceptada» they are friends, whatever the other row says.
 */
export function amistadQueManda<T extends { estado: string }>(
  filas: readonly T[],
): T | null {
  return (
    filas.find((f) => f.estado === 'aceptada') ??
    filas.find((f) => f.estado === 'pendiente') ??
    filas[0] ??
    null
  );
}

/**
 * Whether a profile may be opened at all.
 *
 * A friend may always open it: the friendship was accepted by the
 * person being looked at, and it is consent given to a named account.
 *
 * Anyone else may open it only under the same conditions that would
 * have let them find it in the first place — the alias is searchable
 * and a guardian authorised the account. Without this check a learner
 * who switched search off could still be opened by anybody holding
 * their id from before, which is exactly the exposure the switch was
 * flipped to stop.
 */
export function puedeAbrir(entrada: {
  esAmigo: boolean;
  aliasBuscable: boolean;
  tutorAutorizo: boolean;
  hayBloqueo: boolean;
  tieneAlias: boolean;
}): boolean {
  /* First and unconditional. A block outranks a friendship: people
     block friends, and that is often precisely who they are blocking. */
  if (entrada.hayBloqueo) return false;
  /* No alias means the account was never set up to be seen socially.
     There is nothing to show and nothing to send a request to. */
  if (!entrada.tieneAlias) return false;
  if (entrada.esAmigo) return true;
  return entrada.aliasBuscable && entrada.tutorAutorizo;
}

/**
 * Whether the numbers travel: level, streak, subjects, achievements.
 *
 * A friend always sees them. A stranger sees them only if this learner
 * turned `progresoPublico` on, which is off by default and separate
 * from being findable.
 *
 * The two are kept apart on purpose. `aliasBuscable` means «I want to
 * be found». It has never meant «I want strangers reading how I am
 * doing in mathematics», and treating one as the other would change
 * what every learner who already picked an alias agreed to.
 */
export function muestraProgreso(entrada: {
  esAmigo: boolean;
  progresoPublico: boolean;
}): boolean {
  return entrada.esAmigo || entrada.progresoPublico;
}

/**
 * Whether the head-to-head record travels.
 *
 * Friends only, and not because the numbers are sensitive — they are
 * about both people equally. It is that a win-loss record against
 * somebody you have never played is always 0-0, and a profile that
 * shows 0-0 to every stranger is noise on every profile.
 */
export function muestraCaraACara(entrada: { esAmigo: boolean }): boolean {
  return entrada.esAmigo;
}

/**
 * Fields that must never reach another learner, whatever the
 * relationship.
 *
 * Listed so a test can assert against the list instead of against
 * prose in a comment. The first four identify the account off-app;
 * the last two say when a minor is awake and holding their phone.
 */
export const NUNCA_VIAJAN = [
  'email',
  'passwordHash',
  'passwordSalt',
  'plan',
  'planHasta',
  'timezone',
  'createdAt',
  'updatedAt',
  'esModerador',
  'moderadorDesde',
  'tutorAutorizoEn',
] as const;
