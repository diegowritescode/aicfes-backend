/**
 * The figures a learner may pick, and the only list that decides.
 *
 * The client draws these; the server does not. What the server owns
 * is which slugs exist, because the column is free text and a client
 * is not a source of truth. Without this list a crafted request
 * stores `avatar: "../../etc/passwd"` or a string of markup, and it
 * renders on somebody else's profile screen — the learner whose
 * avatar it is never asked for that and cannot remove it.
 *
 * Why drawn figures and not photographs: the accounts belong to
 * minors and a profile is visible to a stranger who found them by
 * alias. A picked figure gives the same «this profile is mine» with
 * none of the upload surface — no storage, no cropping, no EXIF
 * coordinates giving away where a child lives, and nothing to
 * moderate. The trade is deliberate and recorded in an ADR.
 *
 * Animals, objects and symbols. No human faces, no flags, no
 * religious symbols: a face invites «which one looks like me», and
 * the other two invite a fight in a product for teenagers.
 *
 * Slugs are Spanish because the whole product is, and they are what
 * the database stores. Renaming one is a migration, not an edit.
 */
export const AVATARES = [
  // Animals: the ones a 16-year-old picks without thinking.
  'zorro',
  'pulpo',
  'buho',
  'tortuga',
  'gato',
  'perro',
  'delfin',
  'leon',
  'rana',
  'abeja',
  'pinguino',
  'mariposa',
  // Objects, for whoever does not want an animal.
  'cohete',
  'cactus',
  'guitarra',
  'libro',
  'balon',
  'cafe',
  'bicicleta',
  'audifonos',
  // Symbols and shapes.
  'rayo',
  'estrella',
  'luna',
  'planeta',
] as const;

export type Avatar = (typeof AVATARES)[number];

/** How many background colours the client has. Keep in step with `colorAvatar`. */
export const COLORES_DE_AVATAR = 8;

/**
 * Whether a slug is one of ours.
 *
 * Takes `unknown` on purpose: this guards the boundary where a JSON
 * body arrives, and typing the parameter as `string` would make the
 * caller cast before the check that exists to avoid casting.
 */
export function esAvatarValido(valor: unknown): valor is Avatar {
  return typeof valor === 'string' && (AVATARES as readonly string[]).includes(valor);
}

/**
 * Whether a colour index is one the client can draw.
 *
 * `Number.isInteger` and not `typeof === 'number'`: `3.5` and `NaN`
 * are both numbers and neither is a palette slot. A float would be
 * stored, read back, and index the palette as `undefined` — an
 * unpainted avatar on a profile, which is the failure this project
 * has already shipped once with a button.
 */
export function esColorValido(valor: unknown): valor is number {
  return Number.isInteger(valor) && (valor as number) >= 0 && (valor as number) < COLORES_DE_AVATAR;
}

/**
 * What `null` means, said once.
 *
 * An account that never picked anything keeps initials on a colour
 * derived from its alias. That is not a missing value to be filled
 * in — it is a working avatar, and it is what every account had
 * before these columns existed.
 */
export const SIN_ESCOGER = null;
