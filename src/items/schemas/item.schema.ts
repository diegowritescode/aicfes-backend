import { z } from 'zod';

export const OptionSchema = z.object({
  A: z.string().min(5, 'Opción A muy corta').max(180, 'Opción A muy larga'),
  B: z.string().min(5, 'Opción B muy corta').max(180, 'Opción B muy larga'),
  C: z.string().min(5, 'Opción C muy corta').max(180, 'Opción C muy larga'),
  D: z.string().min(5, 'Opción D muy corta').max(180, 'Opción D muy larga'),
}).strict();

export const ErrorTypeSchema = z.object({
  A: z.string().min(1),
  B: z.string().min(1),
  C: z.string().min(1),
  D: z.string().min(1),
}).strict();

export const ExplicacionesSchema = z.object({
  A: z.string().min(30, 'Explicación A muy corta').max(300, 'Explicación A muy larga'),
  B: z.string().min(30, 'Explicación B muy corta').max(300, 'Explicación B muy larga'),
  C: z.string().min(30, 'Explicación C muy corta').max(300, 'Explicación C muy larga'),
  D: z.string().min(30, 'Explicación D muy corta').max(300, 'Explicación D muy larga'),
}).strict();

export const ItemSchema = z
  .object({
    area: z.enum(['MAT', 'LC', 'CN', 'SOC', 'ING']),
    dificultad: z.enum(['facil', 'media', 'alta']),
    plantilla: z.string().min(3, 'Plantilla muy corta').max(300, 'Plantilla muy larga'),
    contexto: z.string().min(20, 'Contexto muy corto').max(1200, 'Contexto muy largo'),
    pregunta: z.string().min(10, 'Pregunta muy corta').max(250, 'Pregunta muy larga'),
    opciones: OptionSchema,
    respuesta_correcta: z.enum(['A', 'B', 'C', 'D']),
    justificacion: z.string().min(50, 'Justificación muy corta').max(450, 'Justificación muy larga'),
    tags: z.array(z.string().min(2).max(50)).min(1, 'Al menos 1 tag').max(6, 'Máximo 6 tags'),
    distractores: ErrorTypeSchema,
    explicaciones: ExplicacionesSchema,
  })
  .strict()
  .refine(
    (data) => data.distractores[data.respuesta_correcta] === 'correcta',
    {
      message: `Distractor de respuesta correcta (${data => data.respuesta_correcta}) debe ser "correcta"`,
      path: ['distractores'],
    }
  );

export type Item = z.infer<typeof ItemSchema>;

export default ItemSchema;

