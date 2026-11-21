import { Injectable } from '@nestjs/common';

/**
 * Normaliza la salida del modelo OpenAI antes de parsear JSON
 * - Elimina markdown y código blocks
 * - Convierte objetos a arrays si es necesario
 * - Limpia whitespace
 * - Detecta y corrige errores comunes
 */
@Injectable()
export class NormalizerService {
  /**
   * Normaliza texto crudo del modelo a JSON limpio
   * @param rawText Salida cruda del modelo
   * @returns Objeto o array normalizado listo para parsear
   */
  normalize(rawText: string): any {
    if (!rawText || typeof rawText !== 'string') {
      throw new Error('Invalid input: rawText must be a non-empty string');
    }

    // 1. Eliminar markdown code blocks (```json ... ```)
    let cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '');

    // 2. Eliminar caracteres de control y espacios extras
    cleaned = cleaned.trim();

    // 3. Intentar parsear
    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch (err) {
      // Si falla, intentar extraer JSON del texto
      const jsonMatch = this.extractJsonFromText(cleaned);
      if (!jsonMatch) {
        throw new Error(`Failed to parse JSON from text: ${err.message}`);
      }
      try {
        parsed = JSON.parse(jsonMatch);
      } catch (e) {
        throw new Error(`Extracted JSON is still invalid: ${e.message}`);
      }
    }

    // 4. Normalizar estructura
    parsed = this.normalizeStructure(parsed);

    return parsed;
  }

  /**
   * Extrae JSON válido del texto crudo
   * Busca el primer { o [ y el último } o ]
   */
  private extractJsonFromText(text: string): string | null {
    const startIdx = text.indexOf('{');
    const arrayStart = text.indexOf('[');

    let begin = startIdx;
    if (arrayStart !== -1 && (startIdx === -1 || arrayStart < startIdx)) {
      begin = arrayStart;
    }

    if (begin === -1) return null;

    // Encontrar el cierre correspondiente
    const isArray = text[begin] === '[';
    const closeChar = isArray ? ']' : '}';
    let depth = 1;
    let end = begin + 1;

    while (end < text.length && depth > 0) {
      if (text[end] === (isArray ? '[' : '{')) {
        depth++;
      } else if (text[end] === closeChar) {
        depth--;
      }
      end++;
    }

    if (depth !== 0) return null;
    return text.substring(begin, end);
  }

  /**
   * Normaliza la estructura: si es objeto, envuelve en array
   * Si es array, retorna tal cual
   */
  private normalizeStructure(parsed: any): any {
    // Si es un array, retornar tal cual
    if (Array.isArray(parsed)) {
      return parsed;
    }

    // Si es un objeto con propiedad "items", extraer array
    if (parsed && typeof parsed === 'object' && parsed.items && Array.isArray(parsed.items)) {
      return parsed.items;
    }

    // Si es un objeto con propiedad "data", extraer array
    if (parsed && typeof parsed === 'object' && parsed.data && Array.isArray(parsed.data)) {
      return parsed.data;
    }

    // Si es un objeto simple (ítem único), envolver en array
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return [parsed];
    }

    throw new Error(`Cannot normalize structure: unexpected type ${typeof parsed}`);
  }

  /**
   * Recorta campos largos de forma segura
   * Respeta límites ICFES para proteger la UI
   */
  trimFieldLengths(item: any): any {
    // Cut to the limit including the ellipsis, so a trimmed field is never
    // longer than the limit it exists to enforce.
    const clip = (value: string, limit: number): string =>
      value.length > limit ? value.substring(0, limit - 3) + '...' : value;

    const limits = {
      contexto: 1200,
      pregunta: 250,
      opciones_field: 180,  // Para cada opción A-D
      justificacion: 450,
      explicaciones_field: 300,  // Para cada explicación A-D
      tags_count: 6,
    };

    if (item.contexto) {
      item.contexto = clip(item.contexto, limits.contexto);
    }

    if (item.pregunta) {
      item.pregunta = clip(item.pregunta, limits.pregunta);
    }

    if (item.opciones) {
      Object.keys(item.opciones).forEach(key => {
        item.opciones[key] = clip(item.opciones[key], limits.opciones_field);
      });
    }

    if (item.justificacion) {
      item.justificacion = clip(item.justificacion, limits.justificacion);
    }

    if (item.explicaciones) {
      Object.keys(item.explicaciones).forEach(key => {
        item.explicaciones[key] = clip(item.explicaciones[key], limits.explicaciones_field);
      });
    }

    if (item.tags && Array.isArray(item.tags) && item.tags.length > limits.tags_count) {
      item.tags = item.tags.slice(0, limits.tags_count);
    }

    return item;
  }
}
