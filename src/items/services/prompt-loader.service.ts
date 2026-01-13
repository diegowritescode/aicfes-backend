import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';

@Injectable()
export class PromptLoaderService {
  private base = path.join(process.cwd(), 'prompts');

  async loadDeveloper(area: string): Promise<string> {
    const p = path.join(this.base, area, 'developer.txt');
    try {
      return await fs.readFile(p, 'utf-8');
    } catch (e) {
      throw new HttpException(`Missing developer prompt for area ${area}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async loadUserTemplate(area: string): Promise<string> {
    const p = path.join(this.base, area, 'user_template.txt');
    try {
      return await fs.readFile(p, 'utf-8');
    } catch (e) {
      throw new HttpException(`Missing user_template prompt for area ${area}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  fillUserTemplate(template: string, params: { AREA: string; DIFICULTAD: string; TEMA?: string; PLANTILLA?: string; N: number }) {
    let out = template;
    out = out.replace(/{{AREA}}/g, params.AREA);
    out = out.replace(/{{DIFICULTAD}}/g, params.DIFICULTAD);
    out = out.replace(/{{TEMA}}/g, params.TEMA || '');
    out = out.replace(/{{PLANTILLA}}/g, params.PLANTILLA || '');
    out = out.replace(/{{N}}/g, String(params.N));
    return out;
  }
}

export default PromptLoaderService;
