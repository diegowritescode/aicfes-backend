/**
 * What the report email says.
 *
 * Pure, because every line here is a decision about what a moderator
 * needs at 7am on a phone, and because an email that goes out wrong
 * cannot be recalled.
 *
 * The constraint that shapes it: **this email is about a minor, sent
 * over a third-party service, and it lives in an inbox for years.**
 * So it carries what is needed to decide whether to act, and nothing
 * more — no free text the reporting learner wrote, no email
 * addresses, no identifiers beyond the aliases the learners chose to
 * show each other.
 */

export interface DatosDeDenuncia {
  readonly motivo: 'alias_ofensivo' | 'acoso' | 'suplantacion' | 'otro';
  readonly aliasDenunciado: string | null;
  readonly aliasDenunciante: string | null;
  /** Reports about the account, in total. */
  readonly totales: number;
  /** How many *different* learners reported it. */
  readonly personas: number;
  /** Open reports waiting, including this one. */
  readonly abiertas: number;
}

const MOTIVOS: Record<DatosDeDenuncia['motivo'], string> = {
  acoso: 'Acoso',
  alias_ofensivo: 'Nombre ofensivo',
  suplantacion: 'Suplantación',
  otro: 'Otra cosa',
};

/**
 * The subject line, which is the whole email on a phone's lock screen.
 *
 * It leads with the pattern when there is one. Three different people
 * reporting the same account is the fact that changes what you do
 * next, and burying it under "nueva denuncia" wastes the only line
 * that is always read.
 */
export function asunto(datos: DatosDeDenuncia): string {
  const quien = datos.aliasDenunciado ?? 'una cuenta';

  if (datos.personas >= 3) {
    return `AICFES: ${datos.personas} personas denunciaron a ${quien}`;
  }
  if (datos.personas === 2) {
    return `AICFES: segunda persona denuncia a ${quien}`;
  }
  return `AICFES: denuncia sobre ${quien} (${MOTIVOS[datos.motivo].toLowerCase()})`;
}

/**
 * The body, in plain text.
 *
 * Plain and not HTML on purpose: it is read on a phone, it has to
 * survive every client, and there is nothing here that formatting
 * would clarify.
 *
 * **The learner's own words are not included.** A report about
 * harassment can quote the harassment, and forwarding a minor's
 * account of it into an inbox — through a third-party service — adds
 * exposure without adding a decision. The detail is in the app,
 * behind the moderation token, which is where it belongs.
 */
export function cuerpo(datos: DatosDeDenuncia): string {
  const lineas = [
    `Motivo: ${MOTIVOS[datos.motivo]}`,
    `Sobre: ${datos.aliasDenunciado ?? '(sin alias)'}`,
    `Denunció: ${datos.aliasDenunciante ?? '(sin alias)'}`,
    '',
  ];

  if (datos.totales > 1) {
    lineas.push(
      `Esa cuenta acumula ${datos.totales} denuncias de ${datos.personas} ` +
        `${datos.personas === 1 ? 'persona' : 'personas distintas'}.`,
    );
  } else {
    lineas.push('Primera denuncia sobre esa cuenta.');
  }

  lineas.push(
    '',
    datos.abiertas === 1
      ? 'Es la única sin revisar.'
      : `Hay ${datos.abiertas} denuncias sin revisar.`,
    '',
    'Lo que escribió quien denunció está en la app, en Denuncias.',
    'Ya bloqueamos a esa cuenta para quien denunció: el bloqueo no espera',
    'a la revisión.',
    '',
    '— AICFES',
  );

  return lineas.join('\n');
}
