/**
 * What the rival already scored, when they went first.
 *
 * The whole asynchronous duel works without this, and that is the
 * problem: a learner opens a round, answers five questions in silence,
 * and only at the end discovers they were racing anybody. Nothing on
 * screen while they play says a race is happening.
 *
 * The server already knows. `Duelo.resultadoRetador` and
 * `resultadoRival` are written as each player finishes, so when the
 * second player opens the round the first player's score is sitting in
 * the row being read. It was simply never sent.
 *
 * What travels is a score and a time, and never an answer. A duel
 * decided by whoever reads the response body is not a duel, which is
 * why `preguntas` already refuses to send `respuesta_correcta`. The
 * same rule applies here: knowing «Camilo got 4 of 5» tells you how
 * hard to try. Knowing WHICH four would tell you what to answer.
 */

/** A finished player's score, as stored in the duel row. */
export interface MarcadorDeJugador {
  readonly aciertos: number;
  readonly segundos: number;
}

/** What the player about to play is told about the one who went first. */
export interface MarcaABatir {
  readonly aciertos: number;
  readonly segundos: number;
  readonly deCuantas: number;
}

/**
 * Reads a stored marker defensively.
 *
 * The column is `Json?`, so what comes back is whatever was written
 * there — including from an older version of this code. A duel that
 * crashes the round because a field is missing is worse than one with
 * no pressure.
 */
export function leerMarca(crudo: unknown, deCuantas: number): MarcaABatir | null {
  if (!crudo || typeof crudo !== 'object') return null;

  const m = crudo as Record<string, unknown>;
  const aciertos = m.aciertos;
  const segundos = m.segundos;

  if (typeof aciertos !== 'number' || !Number.isFinite(aciertos)) return null;
  if (typeof segundos !== 'number' || !Number.isFinite(segundos)) return null;

  /* A score outside the round's own length is corrupt, not low. */
  if (aciertos < 0 || aciertos > deCuantas) return null;

  return {
    aciertos: Math.floor(aciertos),
    segundos: Math.max(0, Math.floor(segundos)),
    deCuantas,
  };
}

/**
 * The rival's mark, if there is one to show this player.
 *
 * Returns null when the rival has not played, which is the common
 * case for whoever opens first. «Nadie ha jugado todavía» is not a
 * mark to beat and must not be rendered as one — a zero on screen
 * would read as the rival having scored nothing.
 */
export function marcaDelRival(params: {
  readonly soyRetador: boolean;
  readonly resultadoRetador: unknown;
  readonly resultadoRival: unknown;
  readonly deCuantas: number;
}): MarcaABatir | null {
  const suyo = params.soyRetador ? params.resultadoRival : params.resultadoRetador;
  return leerMarca(suyo, params.deCuantas);
}

/**
 * How many right answers this player needs to win outright.
 *
 * Computed here rather than on the phone so both players are told the
 * same thing by the same rule. The tie-break is time: with equal
 * scores the faster player wins, so matching the rival's score is not
 * enough unless this player is also faster — and nobody knows their
 * own time until they finish.
 */
export function paraGanar(marca: MarcaABatir): number {
  /* Beating the score outright needs one more. Capped at the round's
     length: when the rival got everything right, «6 de 5» is not an
     instruction, and the honest answer is that the only way through
     is a perfect round answered faster. */
  return Math.min(marca.aciertos + 1, marca.deCuantas);
}

/** True when the rival left no room to win on score alone. */
export function soloPorTiempo(marca: MarcaABatir): boolean {
  return marca.aciertos >= marca.deCuantas;
}
