import type { FiguraSpec, PlantillaId, ValidacionFigura } from './types';
import { trianguloRectangulo } from './triangulo-rectangulo';
import { graficaBarras } from './grafica-barras';
import { tablaDatos } from './tabla-datos';
import { graficaLineas } from './grafica-lineas';
import { planoCartesiano } from './plano-cartesiano';
import { montajeExperimental } from './montaje-experimental';

/**
 * Every template, in one place.
 *
 * The model picks a name from here and supplies values; nothing else
 * can be asked for. Adding a template means adding one entry, and the
 * JSON Schema the model sees is generated from this map rather than
 * written beside it, so the two cannot drift apart.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PLANTILLAS: Record<PlantillaId, any> = {
  trianguloRectangulo,
  graficaBarras,
  tablaDatos,
  graficaLineas,
  planoCartesiano,
  montajeExperimental,
};

export const IDS_PLANTILLA = Object.keys(PLANTILLAS) as PlantillaId[];

/** What each template is for, shown to the model so it can choose. */
export const DESCRIPCIONES: Record<PlantillaId, string> = {
  trianguloRectangulo:
    'Triángulo rectángulo con sus lados rotulados. Sirve para escaleras apoyadas, rampas, sombras, cables tensados y cualquier pregunta de ángulos o Pitágoras.',
  graficaBarras: 'Gráfica de barras con ejes rotulados, para comparar cantidades entre categorías.',
  tablaDatos: 'Tabla de datos con encabezados y filas, para presentar mediciones o registros.',
  graficaLineas:
    'Gráfica de líneas, para mostrar cómo cambia una magnitud. Acepta una serie de puntos o una tendencia con nombre.',
  planoCartesiano: 'Plano cartesiano con puntos, rectas o parábolas sobre una cuadrícula rotulada.',
  montajeExperimental:
    'Montaje de laboratorio: varios recipientes con su contenido y la condición de cada uno, para comparar tratamientos.',
};

export function existePlantilla(id: string): id is PlantillaId {
  return Object.prototype.hasOwnProperty.call(PLANTILLAS, id);
}

/**
 * Checks a spec before anything is stored. A figure whose parameters
 * do not describe a real drawing is rejected like a wrong answer is:
 * the question would be unanswerable either way.
 */
export function validarFigura(spec: unknown): ValidacionFigura {
  const s = spec as Partial<FiguraSpec> | null;
  if (!s || typeof s !== 'object') {
    return { valida: false, error: 'la figura debe ser un objeto' };
  }
  if (typeof s.plantilla !== 'string' || !existePlantilla(s.plantilla)) {
    return {
      valida: false,
      error: `plantilla desconocida: ${String(s.plantilla)}. Disponibles: ${IDS_PLANTILLA.join(', ')}`,
    };
  }
  return PLANTILLAS[s.plantilla].validar(s.parametros);
}

/** Draws a spec that has already passed validation. */
export function dibujarFigura(spec: FiguraSpec): string {
  const plantilla = PLANTILLAS[spec.plantilla];
  if (!plantilla) throw new Error(`plantilla desconocida: ${spec.plantilla}`);
  return plantilla.dibujar(spec.parametros);
}

/** The text alternative, for a learner using a screen reader. */
export function describirFigura(spec: FiguraSpec): string {
  const plantilla = PLANTILLAS[spec.plantilla];
  if (!plantilla) return '';
  return spec.alt ?? plantilla.describir(spec.parametros);
}

