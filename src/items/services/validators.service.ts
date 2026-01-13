import { Injectable } from '@nestjs/common';

/**
 * Valida que los distractores por área cumplan con tipos permitidos
 * Cada área tiene sus propios tipos de errores semánticos válidos
 */
@Injectable()
export class ValidatorsService {
  // Tipos permitidos por área
  private allowedDistractorsByArea: Record<string, Set<string>> = {
    MAT: new Set([
      'correcta',
      'error_calculo',
      'interpretacion_parcial',
      'confunde_conceptos',
      'operacion_incorrecta',
      'unidad_incorrecta',
      'redondeo_incorrecto',
    ]),
    LC: new Set([
      'correcta',
      'interpretacion_literal',
      'inferencia_falsa',
      'fuera_de_contexto',
      'contradiccion',
      'generalizacion_indebida',
      'confunde_argumentos',
    ]),
    CN: new Set([
      'correcta',
      'confunde_conceptos',
      'error_causal',
      'informacion_incompleta',
      'dato_incorrecto',
      'invierte_relacion',
      'mezcla_sistemas',
    ]),
    SOC: new Set([
      'correcta',
      'confusion_derechos_deberes',
      'marco_normativo_incorrecto',
      'generalizacion_indebida',
      'inferencia_falsa',
      'exageracion',
      'contexto_historico_incorrecto',
    ]),
    ING: new Set([
      'correcta',
      'confunde_vocabulario',
      'error_gramatical',
      'error_pronunciacion',
      'significado_incorrecto',
      'traduce_literalmente',
      'contexto_incorrecto',
    ]),
  };

  /**
   * Valida que los distractores de un ítem sean válidos para su área
   * @param area Área de conocimiento
   * @param distractores Objeto con tipos de error {A: string, B: string, ...}
   * @returns {valid: boolean, invalidTypes: string[], errors: string[]}
   */
  validateDistractorsByArea(area: string, distractores: any): {
    valid: boolean;
    invalidTypes: string[];
    errors: string[];
  } {
    const errors: string[] = [];
    const invalidTypes: string[] = [];

    // Validar que el área existe
    if (!this.allowedDistractorsByArea[area]) {
      return {
        valid: false,
        invalidTypes: [],
        errors: [`Área desconocida: ${area}`],
      };
    }

    // Validar que existen exactamente 4 distractores (A, B, C, D)
    const keys = Object.keys(distractores || {});
    if (keys.length !== 4 || !['A', 'B', 'C', 'D'].every(k => keys.includes(k))) {
      errors.push('Distractores debe tener exactamente las claves A, B, C, D');
      return {
        valid: false,
        invalidTypes,
        errors,
      };
    }

    // Validar cada distractor
    const allowedSet = this.allowedDistractorsByArea[area];
    Object.entries(distractores).forEach(([letra, tipo]: [string, any]) => {
      if (typeof tipo !== 'string') {
        errors.push(`Distractor ${letra}: debe ser string, recibió ${typeof tipo}`);
        return;
      }

      if (!allowedSet.has(tipo)) {
        invalidTypes.push(`${letra}: "${tipo}"`);
        errors.push(
          `Distractor ${letra}: tipo "${tipo}" no permitido para área ${area}. ` +
          `Permitidos: ${Array.from(allowedSet).join(', ')}`
        );
      }
    });

    return {
      valid: errors.length === 0,
      invalidTypes,
      errors,
    };
  }

  /**
   * Valida que la respuesta correcta sea marcada como "correcta" en distractores
   * @param respuestaCorrecta Letra correcta (A-D)
   * @param distractores Objeto con tipos de error
   * @returns {valid: boolean, error?: string}
   */
  validateCorrectAnswerType(respuestaCorrecta: string, distractores: any): {
    valid: boolean;
    error?: string;
  } {
    if (!distractores || !distractores[respuestaCorrecta]) {
      return {
        valid: false,
        error: `Distractor para respuesta correcta ${respuestaCorrecta} no existe`,
      };
    }

    if (distractores[respuestaCorrecta] !== 'correcta') {
      return {
        valid: false,
        error: `Distractor para ${respuestaCorrecta} debe ser "correcta", recibió "${distractores[respuestaCorrecta]}"`,
      };
    }

    return { valid: true };
  }

  /**
   * Obtiene lista de tipos permitidos para una área
   */
  getAllowedTypesForArea(area: string): string[] {
    if (!this.allowedDistractorsByArea[area]) {
      return [];
    }
    return Array.from(this.allowedDistractorsByArea[area]);
  }

  /**
   * Valida que opciones y distractores tengan las mismas claves (A-D)
   */
  validateOpcionesDistractoresMatch(opciones: any, distractores: any): {
    valid: boolean;
    error?: string;
  } {
    if (!opciones || !distractores) {
      return {
        valid: false,
        error: 'Opciones y distractores no pueden ser null',
      };
    }

    const opcionesKeys = Object.keys(opciones).sort();
    const distactorKeys = Object.keys(distractores).sort();

    if (opcionesKeys.join() !== distactorKeys.join()) {
      return {
        valid: false,
        error: `Claves en opciones (${opcionesKeys.join()}) no coinciden con distractores (${distactorKeys.join()})`,
      };
    }

    return { valid: true };
  }
}
