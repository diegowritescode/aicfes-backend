import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenaiService } from './openai.service';
import { VerificadorClaudeService } from './verificador-claude.service';
import type { Item } from '../schemas/item.schema';

/**
 * Checks that the answer an item claims is correct actually is.
 *
 * The schema can only prove an item is internally consistent: that the
 * option marked correct is labelled "correcta". It cannot tell that the
 * arithmetic is wrong, or that two options are both right. An item that
 * says 2+2=5 and marks that option passes every structural check.
 *
 * So the item is solved a second time, by a model that is shown the
 * question and the options but not the answer, not the justification and
 * not the explanations. Agreement is evidence; disagreement means the
 * item is not trustworthy enough to teach from, and it is rejected.
 */

const VERIFIER_SYSTEM = `Eres un evaluador experto del examen ICFES Saber 11 de Colombia.
Recibes una pregunta de opción múltiple con cuatro opciones.
Resuélvela por tu cuenta y responde cuál es la opción correcta.
No expliques tu razonamiento en prosa: responde solo en el formato pedido.
Si la pregunta es ambigua, si más de una opción es defendible, o si
ninguna opción es correcta, indícalo en el campo correspondiente.`;

const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    respuesta: {
      type: 'string',
      enum: ['A', 'B', 'C', 'D'],
      description: 'La opción que consideras correcta',
    },
    confianza: {
      type: 'string',
      enum: ['alta', 'media', 'baja'],
      description: 'Qué tan seguro estás de tu respuesta',
    },
    problema: {
      type: 'string',
      enum: ['ninguno', 'ambigua', 'varias_correctas', 'ninguna_correcta'],
      description: 'Defecto detectado en el ítem, si lo hay',
    },
  },
  required: ['respuesta', 'confianza', 'problema'],
  additionalProperties: false,
} as const;

export interface Verdict {
  readonly respuesta: 'A' | 'B' | 'C' | 'D';
  readonly confianza: 'alta' | 'media' | 'baja';
  readonly problema: 'ninguno' | 'ambigua' | 'varias_correctas' | 'ninguna_correcta';
}

export interface VerificationResult {
  readonly accepted: boolean;
  readonly reason?: string;
  readonly verdict?: Verdict;
}

@Injectable()
export class AnswerVerifierService {
  private readonly log = new Logger(AnswerVerifierService.name);

  constructor(
    private readonly openai: OpenaiService,
    private readonly claude: VerificadorClaudeService,
    private readonly config: ConfigService,
  ) {}

  /** Verification can be turned off, for a cheaper run or a local test. */
  get enabled(): boolean {
    return this.config.get('VERIFY_ANSWERS', 'true') !== 'false';
  }

  async verify(item: Item): Promise<VerificationResult> {
    if (!this.enabled) {
      return { accepted: true, reason: 'verification disabled' };
    }

    // Deliberately partial: the verifier sees only what a student sees.
    const prompt = [
      `Área: ${item.area}`,
      '',
      `Contexto: ${item.contexto}`,
      '',
      `Pregunta: ${item.pregunta}`,
      '',
      `A) ${item.opciones.A}`,
      `B) ${item.opciones.B}`,
      `C) ${item.opciones.C}`,
      `D) ${item.opciones.D}`,
    ].join('\n');

    let verdict: Verdict;
    try {
      // A different family first. A model checking its own work shares
      // its blind spots: having mis-solved the item while writing it, it
      // tends to mis-solve it the same way while checking, and agreement
      // then proves nothing.
      if (this.claude.disponible) {
        verdict = await this.claude.resolver(prompt);
        return this.juzgar(item, verdict);
      }
      verdict = await this.openai.createStructured<Verdict>(
        [
          { role: 'developer', content: VERIFIER_SYSTEM },
          { role: 'user', content: prompt },
        ],
        { schema: VERDICT_SCHEMA as unknown as Record<string, unknown>, schemaName: 'veredicto' },
        this.config.get('OPENAI_VERIFIER_MODEL'),
      );
    } catch (error) {
      // A verifier that cannot be reached must not silently approve.
      const detail = error instanceof Error ? error.message : String(error);
      this.log.warn(`Verifier unavailable, rejecting item: ${detail}`);
      return { accepted: false, reason: `verifier unavailable: ${detail}` };
    }

    return this.juzgar(item, verdict);
  }

  /** The same rules whichever model produced the verdict. */
  private juzgar(item: Item, verdict: Verdict): VerificationResult {
    if (verdict.problema !== 'ninguno') {
      return {
        accepted: false,
        reason: `el verificador reportó: ${verdict.problema}`,
        verdict,
      };
    }

    if (verdict.respuesta !== item.respuesta_correcta) {
      return {
        accepted: false,
        reason: `el verificador respondió ${verdict.respuesta}, el ítem afirma ${item.respuesta_correcta}`,
        verdict,
      };
    }

    if (verdict.confianza === 'baja') {
      return {
        accepted: false,
        reason: 'el verificador acertó pero con confianza baja',
        verdict,
      };
    }

    return { accepted: true, verdict };
  }
}

export default AnswerVerifierService;
