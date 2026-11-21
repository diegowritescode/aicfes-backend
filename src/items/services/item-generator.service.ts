import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PromptLoaderService } from './prompt-loader.service';
import { OpenaiService } from './openai.service';
import { NormalizerService } from './normalizer.service';
import { ValidatorsService } from './validators.service';
import { AnswerVerifierService } from './answer-verifier.service';
import { ItemBankService } from './item-bank.service';
import { ReferenciaService } from './referencia.service';
import { ITEMS_JSON_SCHEMA } from '../schemas/item.json-schema';
import { ItemSchema } from '../schemas/item.schema';
import { z } from 'zod';
import { ConfigService } from '@nestjs/config';

/**
 * Servicio de generación de ítems ICFES
 * Orquesta: prompts → OpenAI → normalización → validación → retorno
 */
@Injectable()
export class ItemGeneratorService {
  constructor(
    private promptLoader: PromptLoaderService,
    private openai: OpenaiService,
    private normalizer: NormalizerService,
    private validators: ValidatorsService,
    private verifier: AnswerVerifierService,
    private bank: ItemBankService,
    private referencia: ReferenciaService,
    private config: ConfigService
  ) {}

  /**
   * Randomiza la posición de la respuesta correcta en las opciones
   * Reorganiza opciones, respuesta_correcta, distractores y explicaciones
   */
  private randomizeCorrectAnswerPosition(item: any): any {
    const positions = ['A', 'B', 'C', 'D'];
    // Seleccionar posición aleatoria para la respuesta correcta (0-3)
    const randomIndex = Math.floor(Math.random() * 4);
    const newCorrectPosition = positions[randomIndex];

    // Si ya está en la posición aleatoria, no hacer nada
    if (item.respuesta_correcta === newCorrectPosition) {
      return item;
    }

    // Mapeo: vieja posición → nueva posición
    const mapping: Record<string, string> = {};
    const oldPositions = [...positions];
    const newPositions = [...positions];

    // Reordenar: mover respuesta correcta a newCorrectPosition
    const oldCorrectPos = item.respuesta_correcta;
    const indexOfNew = newPositions.indexOf(newCorrectPosition);
    const indexOfOld = oldPositions.indexOf(oldCorrectPos);

    // Swap: posición vieja de correcta ↔ nueva posición de correcta
    [newPositions[indexOfOld], newPositions[indexOfNew]] = [newPositions[indexOfNew], newPositions[indexOfOld]];

    // Construir mapeo: newPositions[i] es donde va oldPositions[i]
    for (let i = 0; i < 4; i++) {
      mapping[oldPositions[i]] = newPositions[i];
    }

    // Crear nuevas opciones reordenadas
    const newOpciones: Record<string, string> = {};
    const newDistractores: Record<string, string> = {};
    const newExplicaciones: Record<string, string> = {};

    for (const oldPos of positions) {
      const newPos = mapping[oldPos];
      newOpciones[newPos] = item.opciones[oldPos];
      newDistractores[newPos] = item.distractores[oldPos];
      newExplicaciones[newPos] = item.explicaciones[oldPos];
    }

    return {
      ...item,
      opciones: newOpciones,
      respuesta_correcta: newCorrectPosition,
      distractores: newDistractores,
      explicaciones: newExplicaciones,
    };
  }

  private getCorrectiveMessageForValidation(errors: string[]): string {
    // Si los errores son sobre "Plantilla muy corta"
    if (errors[0] && errors[0].includes('Plantilla muy corta')) {
      return `ERROR CRÍTICO: La propiedad "plantilla" es INVÁLIDA.
LA PLANTILLA DEBE SER UN NOMBRE DESCRIPTIVO DE MÍNIMO 3 CARACTERES.
Ejemplos válidos: "suma simple", "problemas con context", "conversiones", "multiplicacion basica", etc.
NO devuelvas plantilla vacía ni "string" ni "plantilla sugerida".
Devuelve plantillas DESCRIPTIVAS de mínimo 3 caracteres.`;
    }
    
    // Si los errores son sobre tipos de distractores, dar mensaje específico
    if (errors[0] && errors[0].includes('tipo') && errors[0].includes('no permitido')) {
      return `ERROR: Tipos de distractores incorrectos. 
Los tipos deben coincidir EXACTAMENTE con los permitidos para el área.
Revisa el mensaje de error anterior y usa SOLO los tipos listados como "Permitidos".
Cada opción (A, B, C, D) debe tener UN SOLO tipo de distractor.`;
    }
    
    // Si son errores de opciones muy cortas
    if (errors[0] && errors[0].includes('muy corta')) {
      return `ERROR: Opciones MUY CORTAS.
CADA opción (A, B, C, D) DEBE tener MÍNIMO 5 caracteres significativos.
Las opciones deben ser frases o valores completos, no palabras sueltas.
Ejemplo correcto: "El valor de x es 15" (más de 5 caracteres).`;
    }

    // Mensaje genérico de validación
    return `Tu salida anterior no pasó validación.
Devuelve JSON VÁLIDO con EXACTAMENTE el esquema requerido.
Revisa los tipos de distractores y las longitudes de opciones.
Si n=1 devuelve objeto, si n>1 devuelve array de n objetos.`;
  }

  /**
   * Genera ítems ICFES y retorna salida normalizada
   * @param params Parámetros: area, dificultad, tema?, plantilla?, n
   * @param requestId ID de request para logging
   * @returns {items: Item[], rawModelOutput: string, parseStatus: 'OK'|'FAIL', parseError?: string}
   */
  async generate(
    params: { area: string; dificultad: string; tema?: string; plantilla?: string; n: number },
    requestId?: string
  ): Promise<{
    items: any[];
    rawModelOutput: string;
    parseStatus: 'OK' | 'FAIL';
    parseError?: string;
  }> {
    const { area, dificultad, tema, plantilla, n } = params;
    const maxRetries = 1; // Solo 1 reintento como se especifica

    const developer = await this.promptLoader.loadDeveloper(area);
    const template = await this.promptLoader.loadUserTemplate(area);
    const userPrompt = this.promptLoader.fillUserTemplate(template, {
      AREA: area,
      DIFICULTAD: dificultad,
      TEMA: tema,
      PLANTILLA: plantilla,
      N: n,
    });

    // Real items from the official booklets, shown before the request.
    // Without them the model writes from its training memory, which is
    // the same memory any competitor has; the booklets are not.
    const ejemplos = await this.referencia.ejemplosPara({ area, tema, plantilla });
    const bloqueEjemplos = this.referencia.formatearEjemplos(ejemplos);
    if (ejemplos.length > 0) {
      console.log(`[${requestId}] ${ejemplos.length} ítems oficiales como referencia`);
    }

    let messages: Array<{ role: 'developer' | 'user'; content: string }> = [
      { role: 'developer', content: developer },
      ...(bloqueEjemplos ? [{ role: 'user' as const, content: bloqueEjemplos }] : []),
      { role: 'user', content: userPrompt },
    ];

    let lastRawOutput = '';
    let lastParseError = '';

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[${requestId}] Attempt ${attempt + 1}/${maxRetries + 1}: calling OpenAI`);

        // Constrained to the item schema: the model cannot return a
        // markdown fence, prose around the object, or a missing field.
        const structured = await this.openai.createStructured<{ items: unknown[] }>(
          messages,
          { schema: ITEMS_JSON_SCHEMA as unknown as Record<string, unknown>, schemaName: 'items_icfes' },
        );
        const respText = JSON.stringify(structured);
        lastRawOutput = respText;

        console.log(`[${requestId}] Raw output length: ${respText.length} chars`);

        // 1. Normalizar salida del modelo
        let normalized: any;
        try {
          normalized = this.normalizer.normalize(respText);
        } catch (normErr) {
          lastParseError = `Normalization failed: ${normErr.message}`;
          console.warn(`[${requestId}] ${lastParseError}`);
          if (attempt >= maxRetries) {
            return {
              items: [],
              rawModelOutput: respText,
              parseStatus: 'FAIL',
              parseError: lastParseError,
            };
          }
          // Reintento
          const msg = `Tu salida anterior no es JSON válido.
Devuelve SOLO JSON válido sin texto adicional.
${normErr.message}`;
          messages.push({ role: 'user', content: msg });
          continue;
        }

        // Asegurar que es array
        const candidates = Array.isArray(normalized) ? normalized : [normalized];

        // 2. Validar cada ítem
        const validatedItems: any[] = [];
        const validationErrors: string[] = [];

        for (let i = 0; i < candidates.length; i++) {
          const item = candidates[i];

          try {
            // Recortar campos largos
            const trimmed = this.normalizer.trimFieldLengths(item);

            // Validar schema básico
            const validated = ItemSchema.parse(trimmed);

            // Validar distractores por área
            const distRes = this.validators.validateDistractorsByArea(area, validated.distractores);
            if (!distRes.valid) {
              throw new Error(`Distractores inválidos para ${area}: ${distRes.errors.join('; ')}`);
            }

            // Validar que respuesta correcta esté marcada como "correcta"
            const correctRes = this.validators.validateCorrectAnswerType(
              validated.respuesta_correcta,
              validated.distractores
            );
            if (!correctRes.valid) {
              throw new Error(correctRes.error);
            }

            // Validar que opciones y distractores coincidan
            const matchRes = this.validators.validateOpcionesDistractoresMatch(
              validated.opciones,
              validated.distractores
            );
            if (!matchRes.valid) {
              throw new Error(matchRes.error);
            }

            // Rejected before verification, which costs a request: an
            // item already in the bank is not worth checking again.
            const duplicate = await this.bank.findDuplicate(validated);
            if (duplicate) {
              throw new Error(`duplicado: ${duplicate.reason}`);
            }

            // Structural checks only prove the item is self-consistent.
            // Solving it independently is what catches an answer that is
            // confidently wrong.
            const verification = await this.verifier.verify(validated);
            if (!verification.accepted) {
              throw new Error(`verificación: ${verification.reason}`);
            }

            validatedItems.push(validated);
          } catch (itemErr) {
            validationErrors.push(`Ítem ${i}: ${itemErr.message}`);
          }
        }

        // 3. Verificar cantidad de ítems válidos
        if (validatedItems.length === 0) {
          lastParseError = `No items passed validation: ${validationErrors.join('; ')}`;
          console.warn(`[${requestId}] ${lastParseError}`);
          if (attempt >= maxRetries) {
            return {
              items: [],
              rawModelOutput: respText,
              parseStatus: 'FAIL',
              parseError: lastParseError,
            };
          }
          const msg = this.getCorrectiveMessageForValidation(validationErrors);
          messages.push({ role: 'user', content: msg });
          continue;
        }

        // 4. Verificar que tenemos exactamente n ítems
        if (validatedItems.length !== n) {
          lastParseError = `Expected ${n} items but got ${validatedItems.length}`;
          console.warn(`[${requestId}] ${lastParseError}`);
          if (attempt >= maxRetries) {
            // Después de reintentos, si aún no tenemos la cantidad exacta, retornar error
            return {
              items: [],
              rawModelOutput: respText,
              parseStatus: 'FAIL',
              parseError: lastParseError,
            };
          }
          // Reintento con mensaje correctivo DETALLADO
          const correctiveMsg = `ERROR CRÍTICO: Se solicitaron EXACTAMENTE ${n} ítems pero solo generaste ${validatedItems.length}.

INSTRUCCIÓN ABSOLUTA: Debe haber EXACTAMENTE ${n} objetos JSON en el array.

CONTEO OBLIGATORIO:
- Ítem 1 de ${n}: {...}
- Ítem 2 de ${n}: {...}
${n > 2 ? `- Ítem 3 de ${n}: {...}` : ''}
${n > 3 ? `- Ítem 4 de ${n}: {...}` : ''}
${n > 4 ? `- Ítem 5 de ${n}: {...}` : ''}
${n > 5 ? `- ... hasta Ítem ${n} de ${n}: {...}` : ''}

Devuelve UN ARRAY JSON con EXACTAMENTE ${n} objetos.
Cada objeto tiene las 10 propiedades: area, dificultad, plantilla, contexto, pregunta, opciones, respuesta_correcta, justificacion, tags, distractores, explicaciones.
NO devuelvas wrapper {"items": ...}. Solo el array.`;
          messages.push({ role: 'user', content: correctiveMsg });
          continue;
        }

        console.log(`[${requestId}] Successfully validated ${validatedItems.length} items`);
        
        // 5. Randomizar posición de respuesta correcta en cada ítem
        const randomizedItems = validatedItems.map((item) => this.randomizeCorrectAnswerPosition(item));

        return {
          items: randomizedItems,
          rawModelOutput: respText,
          parseStatus: 'OK',
        };
      } catch (err) {
        lastParseError = err.message || 'Unknown error';
        console.warn(`[${requestId}] Error on attempt ${attempt + 1}:`, lastParseError);

        if (attempt >= maxRetries) {
          return {
            items: [],
            rawModelOutput: lastRawOutput,
            parseStatus: 'FAIL',
            parseError: lastParseError,
          };
        }

        // Agregar mensaje correctivo y reintentar
        const msg = this.getCorrectiveMessageForValidation([lastParseError]);
        messages.push({ role: 'user', content: msg });
      }
    }

    // Nunca debería llegar aquí
    return {
      items: [],
      rawModelOutput: lastRawOutput,
      parseStatus: 'FAIL',
      parseError: 'Unknown error: exhausted retries',
    };
  }
}
