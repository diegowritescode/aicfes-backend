import { DESCRIPCIONES } from './registro';

/**
 * The figure fragment the model is constrained to, one branch per
 * template.
 *
 * It used to be a single object with `parametros: { additionalProperties:
 * true }`, on the reasoning that six parameter shapes would be
 * unreadable and each template validates its own input anyway. OpenAI's
 * strict mode rejects that outright:
 *
 *   Invalid schema for response_format 'items_icfes': In
 *   context=(... 'figura' ... 'parametros'), 'additionalProperties' is
 *   required to be supplied and to be false.
 *
 * So every request for an area that may carry a figure failed with a
 * 400 before reaching the model. Maths and Ciencias were dead in
 * production; Sociales and Lectura happened to work because their
 * prompts never offer a figure.
 *
 * Writing the branches out costs more lines and buys two things: the
 * request is accepted, and the model can no longer invent a parameter
 * or mix one template's parameters into another.
 *
 * Strict mode also requires that every property be listed in
 * `required`, so an optional parameter is expressed as a union with
 * null rather than by omission.
 */

/** Optional under strict mode: present, but allowed to be null. */
const opcional = (schema: Record<string, unknown>) => ({
  anyOf: [schema, { type: 'null' }],
});

const texto = { type: 'string' } as const;
const numero = { type: 'number' } as const;

function plantilla(
  id: string,
  propiedades: Record<string, unknown>,
): Record<string, unknown> {
  return {
    type: 'object',
    description: DESCRIPCIONES[id as keyof typeof DESCRIPCIONES],
    properties: {
      plantilla: { type: 'string', enum: [id] },
      parametros: {
        type: 'object',
        properties: propiedades,
        required: Object.keys(propiedades),
        additionalProperties: false,
      },
    },
    required: ['plantilla', 'parametros'],
    additionalProperties: false,
  };
}

const TRIANGULO = plantilla('trianguloRectangulo', {
  altura: numero,
  base: numero,
  etiquetaAltura: opcional(texto),
  etiquetaBase: opcional(texto),
  etiquetaHipotenusa: opcional(texto),
  mostrarAngulo: opcional({ type: 'boolean' }),
  contexto: opcional({
    type: 'string',
    enum: ['ninguno', 'escalera', 'rampa'],
  }),
});

const BARRAS = plantilla('graficaBarras', {
  datos: {
    type: 'array',
    items: {
      type: 'object',
      properties: { etiqueta: texto, valor: numero },
      required: ['etiqueta', 'valor'],
      additionalProperties: false,
    },
  },
  tituloEjeX: opcional(texto),
  tituloEjeY: opcional(texto),
  maximoEjeY: opcional(numero),
  mostrarValores: opcional({ type: 'boolean' }),
});

const TABLA = plantilla('tablaDatos', {
  encabezados: { type: 'array', items: texto },
  filas: { type: 'array', items: { type: 'array', items: texto } },
  titulo: opcional(texto),
});

const LINEAS = plantilla('graficaLineas', {
  puntos: opcional({
    type: 'array',
    items: {
      type: 'object',
      properties: { x: numero, y: numero },
      required: ['x', 'y'],
      additionalProperties: false,
    },
  }),
  forma: opcional({
    type: 'string',
    enum: ['creciente', 'decreciente', 'constante', 'saturacion', 'campana'],
  }),
  tituloEjeX: opcional(texto),
  tituloEjeY: opcional(texto),
  sinEscala: opcional({ type: 'boolean' }),
});

const PLANO = plantilla('planoCartesiano', {
  puntos: opcional({
    type: 'array',
    items: {
      type: 'object',
      properties: { x: numero, y: numero, etiqueta: opcional(texto) },
      required: ['x', 'y', 'etiqueta'],
      additionalProperties: false,
    },
  }),
  funciones: opcional({
    type: 'array',
    items: {
      anyOf: [
        {
          type: 'object',
          properties: {
            tipo: { type: 'string', enum: ['recta'] },
            m: numero,
            b: numero,
            etiqueta: opcional(texto),
          },
          required: ['tipo', 'm', 'b', 'etiqueta'],
          additionalProperties: false,
        },
        {
          type: 'object',
          properties: {
            tipo: { type: 'string', enum: ['parabola'] },
            a: numero,
            b: numero,
            c: numero,
            etiqueta: opcional(texto),
          },
          required: ['tipo', 'a', 'b', 'c', 'etiqueta'],
          additionalProperties: false,
        },
      ],
    },
  }),
  xMin: opcional(numero),
  xMax: opcional(numero),
  yMin: opcional(numero),
  yMax: opcional(numero),
});

const MONTAJE = plantilla('montajeExperimental', {
  montajes: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        nombre: texto,
        tipo: opcional({ type: 'string', enum: ['vaso', 'tubo', 'matraz'] }),
        nivel: opcional(numero),
        contenido: opcional(texto),
        condicion: opcional(texto),
      },
      required: ['nombre', 'tipo', 'nivel', 'contenido', 'condicion'],
      additionalProperties: false,
    },
  },
});

export const FIGURA_JSON_SCHEMA = {
  description:
    'Figura que acompaña al ítem. Inclúyela SOLO si la pregunta no se puede responder sin ella.',
  anyOf: [TRIANGULO, BARRAS, TABLA, LINEAS, PLANO, MONTAJE],
} as const;
