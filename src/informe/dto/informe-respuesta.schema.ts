import { z } from 'zod';

/**
 * What the model is allowed to answer.
 *
 * **There is not one number in here.** Every figure the report shows
 * comes from `PerfilDebilidad` and the dashboard, and the screen reads
 * it from `datos`, not from this. A model asked for `aciertoPorcentaje`
 * will supply one, it will be close enough to look right, and it will
 * sometimes be wrong — which in a report about a learner's own results
 * is the one error that costs the whole feature its credibility.
 *
 * `plan[].area` and `plan[].tema` look like an exception and are not:
 * they are keys the server handed over, and the service rejects a plan
 * whose topics it did not supply. They exist because the plan has to
 * be actionable — `time-trial.service.ts` asks the bank for exercises
 * by area and topic, and «repasa ángulos» as prose is not a query.
 */

const AREAS = ['MAT', 'LC', 'CN', 'SOC', 'ING'] as const;

export const InformeRespuestaSchema = z.object({
  /* Two or three sentences. Longer than that and nobody reads past
     the first, which is where the one useful thing has to be. */
  resumen: z.string().min(1),

  fortalezas: z
    .array(
      z.object({
        /* Nullable, not optional: `strict: true` puts every field in
           `required`, so the model always sends the key and sends
           null when the note is not about one area in particular. */
        area: z.enum(AREAS).nullable(),
        nota: z.string().min(1),
      }),
    )
    .default([]),

  debilidades: z
    .array(
      z.object({
        area: z.enum(AREAS).nullable(),
        nota: z.string().min(1),
      }),
    )
    .default([]),

  /* The week's work, as things that can be started. Three at most:
     a plan with six actions is a plan nobody begins. */
  plan: z
    .array(
      z.object({
        area: z.enum(AREAS),
        /* One of the topics the server supplied. Checked after
           parsing, because a json_schema cannot hold a per-request
           enum and a plan aimed at a topic the bank never heard of
           returns no exercises at all. */
        tema: z.string().min(1),
        titulo: z.string().min(1),
        detalle: z.string().min(1),
      }),
    )
    .default([]),
});

export type InformeRespuesta = z.infer<typeof InformeRespuestaSchema>;

/**
 * The same shape as a JSON Schema, for `createStructured`.
 *
 * Written out rather than derived: `strict: true` needs every field
 * in `required` and `additionalProperties: false` everywhere, which
 * is not what a zod-to-json-schema conversion produces by default.
 * The two are kept in step by `informe.test.ts`, which parses a
 * document shaped like this one through the zod schema.
 */
export const ESQUEMA_JSON = {
  type: 'object',
  additionalProperties: false,
  required: ['resumen', 'fortalezas', 'debilidades', 'plan'],
  properties: {
    resumen: { type: 'string' },
    fortalezas: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['area', 'nota'],
        properties: {
          area: { type: ['string', 'null'], enum: [...AREAS, null] },
          nota: { type: 'string' },
        },
      },
    },
    debilidades: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['area', 'nota'],
        properties: {
          area: { type: ['string', 'null'], enum: [...AREAS, null] },
          nota: { type: 'string' },
        },
      },
    },
    plan: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['area', 'tema', 'titulo', 'detalle'],
        properties: {
          area: { type: 'string', enum: [...AREAS] },
          tema: { type: 'string' },
          titulo: { type: 'string' },
          detalle: { type: 'string' },
        },
      },
    },
  },
} as const;
