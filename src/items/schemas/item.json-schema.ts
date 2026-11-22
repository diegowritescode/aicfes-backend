/**
 * The JSON Schema handed to the model, mirroring ItemSchema in
 * item.schema.ts.
 *
 * With structured outputs the API constrains generation to this shape, so
 * a malformed item cannot come back at all. Zod still validates the
 * result: the schema fixes the shape, not the content, and the bounds
 * (lengths, enums) remain the Zod layer's job.
 *
 * Structured outputs require every property to be listed in `required`
 * and `additionalProperties: false` on every object.
 */

const letterMap = (description: string) => ({
  type: 'object',
  properties: {
    A: { type: 'string', description },
    B: { type: 'string', description },
    C: { type: 'string', description },
    D: { type: 'string', description },
  },
  required: ['A', 'B', 'C', 'D'],
  additionalProperties: false,
});

import { FIGURA_JSON_SCHEMA } from '../../figuras/figura.json-schema';

export const ITEM_JSON_SCHEMA = {
  type: 'object',
  properties: {
    area: { type: 'string', enum: ['MAT', 'LC', 'CN', 'SOC', 'ING'] },
    dificultad: { type: 'string', enum: ['facil', 'media', 'alta'] },
    plantilla: { type: 'string', description: 'Nombre de la plantilla o competencia evaluada' },
    contexto: { type: 'string', description: 'Texto, situación o enunciado base (20 a 1200 caracteres)' },
    pregunta: { type: 'string', description: 'La pregunta concreta (10 a 250 caracteres)' },
    opciones: letterMap('Texto de la opción, entre 5 y 180 caracteres'),
    respuesta_correcta: { type: 'string', enum: ['A', 'B', 'C', 'D'] },
    justificacion: { type: 'string', description: 'Por qué la respuesta correcta lo es (50 a 450 caracteres)' },
    tags: {
      type: 'array',
      items: { type: 'string' },
      description: 'Entre 1 y 6 etiquetas de tema',
    },
    distractores: letterMap(
      'Para la opción correcta, exactamente "correcta". Para las demás, el tipo de error que representan',
    ),
    explicaciones: letterMap('Por qué esa opción es correcta o incorrecta (30 a 300 caracteres)'),
    // Strict mode requires every property in `required`, so the figure
    // is made optional by allowing null rather than by omitting it.
    // FIGURA_JSON_SCHEMA is itself an anyOf over the six templates, so
    // the null branch joins that union rather than wrapping it: an
    // anyOf whose only member is another anyOf is not valid here.
    figura: {
      description: FIGURA_JSON_SCHEMA.description,
      anyOf: [...FIGURA_JSON_SCHEMA.anyOf, { type: 'null' }],
    },
  },
  required: [
    'area',
    'dificultad',
    'plantilla',
    'contexto',
    'pregunta',
    'opciones',
    'respuesta_correcta',
    'justificacion',
    'tags',
    'distractores',
    'explicaciones',
    'figura',
  ],
  additionalProperties: false,
} as const;

/** A batch of items, which is what a generation request asks for. */
export const ITEMS_JSON_SCHEMA = {
  type: 'object',
  properties: {
    items: { type: 'array', items: ITEM_JSON_SCHEMA },
  },
  required: ['items'],
  additionalProperties: false,
} as const;
