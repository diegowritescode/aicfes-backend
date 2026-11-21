/**
 * A figure is a template plus the numbers of the question.
 *
 * The model never draws. It names a template and supplies values, and
 * the drawing is derived from those values — so a label can never sit
 * on the wrong side, and a triangle's angle always matches its sides.
 */

export type PlantillaId =
  | 'trianguloRectangulo'
  | 'graficaBarras'
  | 'tablaDatos'
  | 'planoCartesiano';

export interface FiguraSpec {
  readonly plantilla: PlantillaId;
  readonly parametros: Record<string, unknown>;
  /** What a screen reader says in place of the drawing. */
  readonly alt?: string;
}

/** The outcome of checking a spec before it is stored or drawn. */
export interface ValidacionFigura {
  readonly valida: boolean;
  readonly error?: string;
}

/** Every template implements this, so adding one is a local change. */
export interface Plantilla<P> {
  readonly id: PlantillaId;
  /** Rejects values that cannot describe a real figure. */
  validar(parametros: unknown): ValidacionFigura;
  /** Draws it. Only ever called with parameters that passed validar. */
  dibujar(parametros: P): string;
  /** The text alternative, built from the same values. */
  describir(parametros: P): string;
}
