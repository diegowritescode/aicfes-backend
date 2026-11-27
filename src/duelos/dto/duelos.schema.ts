import { z } from 'zod';

/**
 * Validation at the HTTP boundary.
 *
 * Duels are the one place in this product where a learner has a reason
 * to send something other than what the app sends: their own score. So
 * these schemas are not formalities — everything they let through
 * reaches the grading path.
 */

export const ponerAliasSchema = z.object({
  /* Length and characters are checked again in `validarAlias`, which
     is the authority. This bound exists so a megabyte of text is
     rejected before anything looks at it. */
  alias: z.string().min(1).max(64),
});

/**
 * The line a learner writes about themselves.
 *
 * Capped at the same 120 the column is. Free text written by minors
 * and read by minors, so the length is part of the moderation
 * surface: long enough to say «me falta física», short enough that it
 * cannot hold a phone number and a plea.
 *
 * An empty string clears it, which is why `min` is 0: «I removed my
 * bio» is a thing a learner does, and forcing them to write something
 * to stop saying the old thing would be worse.
 */
export const ponerDescripcionSchema = z.object({
  descripcion: z.string().max(120),
});

export const buscarSchema = z.object({
  q: z.string().min(2).max(32),
});

export const retarSchema = z.object({
  rivalId: z.string().min(1).max(64),
});

export const buscableSchema = z.object({
  buscable: z.boolean(),
});

export const denunciarSchema = z.object({
  denunciadoId: z.string().min(1).max(64),
  motivo: z.enum(['alias_ofensivo', 'acoso', 'suplantacion', 'otro']),
  detalle: z.string().max(1000).optional(),
});

export const entregarSchema = z.object({
  /* At most five, because a duel has five questions. A longer list is
     either a bug or an attempt to score more than once per question;
     the service dedupes as well, and this stops it earlier. */
  respuestas: z
    .array(
      z.object({
        itemId: z.string().min(1).max(64),
        eleccion: z.enum(['A', 'B', 'C', 'D']),
      }),
    )
    .max(5),
  /* Capped at an hour. Elapsed time comes from the client, which can
     lie about it — but it only breaks ties and never outranks
     accuracy, so the worst a liar wins is a tiebreak. An uncapped
     number would let someone send an absurd value into the
     comparison. */
  segundos: z.number().int().min(0).max(3600),
});
