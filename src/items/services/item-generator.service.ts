import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PromptLoaderService } from './prompt-loader.service';
import { OpenaiService } from './openai.service';
import { NormalizerService } from './normalizer.service';
import { ValidatorsService } from './validators.service';
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
    private config: ConfigService
  ) {}

  private correctiveMessage = `Tu salida anterior no cumplió el esquema requerido. 
Devuelve SOLO JSON válido exactamente con el esquema solicitado. 
No incluyas texto adicional ni markdown.
JSON debe ser: si n=1 un objeto, si n>1 un array de objetos.`;

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

    let messages: Array<{ role: 'developer' | 'user'; content: string }> = [
      { role: 'developer', content: developer },
      { role: 'user', content: userPrompt },
    ];

    let lastRawOutput = '';
    let lastParseError = '';

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[${requestId}] Attempt ${attempt + 1}/${maxRetries + 1}: calling OpenAI`);

        // Obtener respuesta del modelo
        const respText = await this.openai.createResponse(messages);
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
          messages.push({ role: 'user', content: this.correctiveMessage });
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
          messages.push({ role: 'user', content: this.correctiveMessage });
          continue;
        }

        // 4. Verificar que tenemos exactamente n ítems (o al menos algunos)
        if (validatedItems.length !== n) {
          console.warn(
            `[${requestId}] Expected ${n} items but got ${validatedItems.length}, continuing anyway`
          );
        }

        console.log(`[${requestId}] Successfully validated ${validatedItems.length} items`);
        return {
          items: validatedItems,
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
        messages.push({ role: 'user', content: this.correctiveMessage });
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
