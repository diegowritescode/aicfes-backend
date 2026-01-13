import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

@Injectable()
export class OpenaiService {
  private client: any;
  constructor(private config: ConfigService) {
    const key = this.config.get('OPENAI_API_KEY');
    if (!key) throw new Error('OPENAI_API_KEY not set');
    this.client = new OpenAI({ apiKey: key });
  }

  async createResponse(messages: Array<{ role: 'developer' | 'user'; content: string }>): Promise<string> {
    const model = this.config.get('OPENAI_MODEL') || 'gpt-5-mini';
    // Concatenate messages into a single input to Responses API
    const input = messages.map((m) => `${m.role}:
${m.content}`).join('\n\n');
    try {
      const resp = await this.client.responses.create({ model, input });
      // Try common response text locations
      // modern SDK provides output_text
      if (resp.output_text) return resp.output_text;
      if (resp.output && Array.isArray(resp.output) && resp.output.length) {
        const out = resp.output.map((o) => (o.content || []).map((c) => c.text || c.content).join('\n')).join('\n');
        return out;
      }
      return String(resp);
    } catch (e) {
      throw new HttpException('OpenAI request failed', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}

export default OpenaiService;
