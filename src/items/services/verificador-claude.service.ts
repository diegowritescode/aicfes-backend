import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import type { Verdict } from './answer-verifier.service';

/**
 * Solves an item with a model from a different family than the one that
 * wrote it.
 *
 * A model checking its own work shares its blind spots: if it mis-solved
 * the question while generating, it tends to mis-solve it the same way
 * while verifying, and agreement then proves nothing. Two families fail
 * differently, so agreement between them is evidence rather than an echo.
 *
 * Unavailable when no Anthropic key is configured, and the caller falls
 * back to the single-family verifier.
 */

const SISTEMA = `Eres un evaluador experto del examen ICFES Saber 11 de Colombia.
Recibes una pregunta de opción múltiple con cuatro opciones.
Resuélvela por tu cuenta y responde cuál es la correcta.
Si la pregunta es ambigua, si más de una opción es defendible, o si
ninguna lo es, indícalo en el campo correspondiente.`;

const ESQUEMA_VEREDICTO = {
  type: 'object',
  properties: {
    respuesta: { type: 'string', enum: ['A', 'B', 'C', 'D'] },
    confianza: { type: 'string', enum: ['alta', 'media', 'baja'] },
    problema: {
      type: 'string',
      enum: ['ninguno', 'ambigua', 'varias_correctas', 'ninguna_correcta'],
    },
  },
  required: ['respuesta', 'confianza', 'problema'],
  additionalProperties: false,
} as const;

@Injectable()
export class VerificadorClaudeService {
  private readonly log = new Logger(VerificadorClaudeService.name);
  private readonly client: Anthropic | null;

  constructor(private readonly config: ConfigService) {
    const key = this.config.get<string>('ANTHROPIC_API_KEY');
    this.client = key ? new Anthropic({ apiKey: key }) : null;
    if (!key) {
      this.log.warn('ANTHROPIC_API_KEY not set: cross-family verification is off');
    }
  }

  get disponible(): boolean {
    return this.client !== null;
  }

  async resolver(prompt: string): Promise<Verdict> {
    if (!this.client) throw new Error('Anthropic client not configured');

    const resp = await this.client.messages.create({
      model: this.config.get('ANTHROPIC_VERIFIER_MODEL') ?? 'claude-opus-5-5',
      max_tokens: 2048,
      system: SISTEMA,
      messages: [{ role: 'user', content: prompt }],
      // The schema constrains generation, so the reply cannot arrive as
      // prose that then has to be parsed out.
      output_config: {
        format: {
          type: 'json_schema',
          schema: ESQUEMA_VEREDICTO as unknown as Record<string, unknown>,
        },
      },
    } as Parameters<Anthropic['messages']['create']>[0]);

    const bloque = (resp as { content?: Array<{ type: string; text?: string }> }).content?.find(
      (b) => b.type === 'text',
    );
    if (!bloque?.text) throw new Error('empty response from the verifier');
    return JSON.parse(bloque.text) as Verdict;
  }
}

export default VerificadorClaudeService;
