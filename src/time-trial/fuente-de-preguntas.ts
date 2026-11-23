/**
 * How many questions a round takes from the bank and how many it has
 * to generate.
 *
 * Pulled out of the service because this is the decision worth
 * testing, and testing it through Nest's injection would mean mocking
 * three services to assert one subtraction.
 *
 * The background: contrarreloj generated every question of every
 * round. The bank holds hundreds of verified items that only a
 * simulacro and the offline pool ever drew from, so a round of eight
 * was eight model requests for questions that already existed — and
 * the mixed mode made five such calls in sequence, which is why it
 * felt slow.
 *
 * Why the bank suits this mode and not entrenar: a round is short and
 * the point is pace, so meeting an item twice costs a learner little.
 * Entrenar is where novelty earns its price.
 */

export interface Reparto {
  /** Taken from the verified bank. Costs nothing. */
  readonly delBanco: number;
  /** Generated, because the bank came up short. */
  readonly porGenerar: number;
}

/**
 * @param pedidas how many the round needs
 * @param disponiblesEnBanco how many the bank actually returned
 */
export function repartirFuentes(pedidas: number, disponiblesEnBanco: number): Reparto {
  /* Negatives and fractions are caller bugs, but they would turn into
     a round with a strange number of questions rather than an error,
     so they are clamped here where it is visible. */
  const necesarias = Math.max(0, Math.floor(pedidas));
  const delBanco = Math.min(necesarias, Math.max(0, Math.floor(disponiblesEnBanco)));

  return { delBanco, porGenerar: necesarias - delBanco };
}

/**
 * Whether a round can start at all.
 *
 * A round with nothing is worse than an error: the learner sees a
 * timer counting down over an empty screen.
 */
export function rondaViable(preguntas: number): boolean {
  return preguntas > 0;
}
