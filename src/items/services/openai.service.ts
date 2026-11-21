import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

export interface StructuredRequest {
  /** The JSON Schema the reply must satisfy. */
  readonly schema: Record<string, unknown>;
  /** A name for the schema, required by the API. */
  readonly schemaName: string;
  readonly temperature?: number;
}

@Injectable()
export class OpenaiService {
  private readonly log = new Logger(OpenaiService.name);
  private client: OpenAI;

  constructor(private config: ConfigService) {
    const key = this.config.get<string>('OPENAI_API_KEY');
    if (!key) throw new Error('OPENAI_API_KEY not set');
    const timeoutMs = Number(this.config.get('OPENAI_TIMEOUT_MS') || 180000);
    this.client = new OpenAI({ apiKey: key, timeout: timeoutMs });
  }

  /**
   * Free-form text. Kept for the feedback path, which reads as prose.
   */
  async createResponse(
    messages: Array<{ role: 'developer' | 'user'; content: string }>,
    overrideModel?: string,
  ): Promise<string> {
    const model = overrideModel || this.config.get('OPENAI_MODEL') || 'gpt-5-mini';
    try {
      const resp = await this.client.responses.create({
        model,
        input: messages.map((m) => ({
          role: m.role === 'developer' ? ('system' as const) : ('user' as const),
          content: m.content,
        })),
      });
      return resp.output_text ?? '';
    } catch (error) {
      // The provider's message says which limit or key failed; losing it
      // turns every failure into the same unactionable 500.
      const detail = error instanceof Error ? error.message : String(error);
      this.log.error(`OpenAI request failed: ${detail}`);
      throw new HttpException(
        `OpenAI request failed: ${detail}`,
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  /**
   * A reply the API constrains to a JSON Schema.
   *
   * This is what removes the recovery work downstream: the model cannot
   * return a markdown fence, prose around the object, or a missing field,
   * because generation itself is constrained to the schema.
   */
  async createStructured<T>(
    messages: Array<{ role: 'developer' | 'user'; content: string }>,
    request: StructuredRequest,
    overrideModel?: string,
  ): Promise<T> {
    const model = overrideModel || this.config.get('OPENAI_MODEL') || 'gpt-5-mini';

    try {
      const resp = await this.client.responses.create({
        model,
        input: messages.map((m) => ({
          role: m.role === 'developer' ? ('system' as const) : ('user' as const),
          content: m.content,
        })),
        text: {
          format: {
            type: 'json_schema',
            name: request.schemaName,
            schema: request.schema as Record<string, unknown>,
            strict: true,
          },
        },
      } as Parameters<typeof this.client.responses.create>[0]);

      const text = (resp as { output_text?: string }).output_text;
      if (!text) {
        throw new Error('the model returned an empty response');
      }

      // Under strict mode this parse cannot fail on shape, only on a
      // refusal or a truncated reply, both of which are worth surfacing.
      return JSON.parse(text) as T;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.log.error(`Structured request failed: ${detail}`);
      throw new HttpException(
        `OpenAI structured request failed: ${detail}`,
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}

export default OpenaiService;
