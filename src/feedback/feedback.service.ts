import { Injectable } from '@nestjs/common';
import { PrismaService } from '../persistence/prisma.service';
import { OpenaiService } from '../items/services/openai.service';
import { ConfigService } from '@nestjs/config';
import { FeedbackGenerateInput } from './dto/feedback-generate.schema';
import { FeedbackResponseSchema } from './dto/feedback-response.schema';
import { extractFirstJson } from '../common/utils/json-extract';
import { DashboardStreamService } from '../dashboard/dashboard-stream.service';

const PROMPT_VERSION = 'v1';

@Injectable()
export class FeedbackService {
  constructor(
    private prisma: PrismaService,
    private openai: OpenaiService,
    private config: ConfigService,
    private stream: DashboardStreamService,
  ) {}

  private getCooldownMinutes() {
    return Number(this.config.get('FEEDBACK_COOLDOWN_MINUTES') || 20);
  }

  async getFeedback(sessionId: string, userId: string) {
    return this.prisma.feedback.findFirst({
      where: { sessionId, userId },
    });
  }

  private async buildPayload(sessionId: string, userId: string) {
    const session = await this.prisma.studySession.findFirst({
      where: { id: sessionId, userId },
      select: {
        id: true,
        mode: true,
        area: true,
        dificultad: true,
        startedAt: true,
        endedAt: true,
        durationSeconds: true,
        totalQuestions: true,
        correctQuestions: true,
        timeLimitSeconds: true,
        areaBreakdown: true,
      },
    });

    if (!session) {
      return null;
    }

    const answers = await this.prisma.answer.findMany({
      where: { sessionId: session.id },
      select: {
        isCorrect: true,
        area: true,
        dificultad: true,
      },
    });

    const accuracy = session.totalQuestions > 0 ? session.correctQuestions / session.totalQuestions : 0;
    const avgTimePerQuestionSeconds = session.totalQuestions > 0
      ? Math.round(session.durationSeconds / session.totalQuestions)
      : 0;

    return {
      session: {
        id: session.id,
        mode: session.mode,
        area: session.area,
        dificultad: session.dificultad,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        durationSeconds: session.durationSeconds,
        totalQuestions: session.totalQuestions,
        correctQuestions: session.correctQuestions,
        timeLimitSeconds: session.timeLimitSeconds,
        areaSummary: session.areaBreakdown,
      },
      answersHistory: answers,
      stats: {
        accuracy,
        avgTimePerQuestionSeconds,
      },
    };
  }

  private buildPrompt(data: any, focus: string, language: string) {
    return `Eres un tutor de preparación ICFES. Analiza el desempeño y da feedback práctico.
- Resumen breve (2–3 frases)
- Fortalezas (máx 3)
- Debilidades (máx 3)
- Plan de estudio (máx 3 acciones)
- Observación sobre ritmo (tiempo)

Enfócate en: ${focus}
Idioma: ${language}
Devuelve SOLO JSON con la siguiente estructura:
{
  "summary": "...",
  "strengths": [{"area":"MAT","note":"..."}],
  "weaknesses": [{"area":"LC","note":"..."}],
  "plan": [{"title":"...","detail":"..."}],
  "insights": {
    "avgTimePerQuestionSeconds": 42,
    "accuracy": 0.7,
    "speedNote": "..."
  }
}

Datos:
${JSON.stringify(data)}
`;
  }

  async generateFeedback(input: FeedbackGenerateInput, userId: string) {
    const existing = await this.getFeedback(input.sessionId, userId);
    const now = new Date();

    if (existing && !input.force) {
      return { cached: true, feedback: existing };
    }

    if (existing && input.force) {
      const cooldownMinutes = this.getCooldownMinutes();
      const since = now.getTime() - new Date(existing.generatedAt).getTime();
      if (since < cooldownMinutes * 60 * 1000) {
        return {
          cached: true,
          feedback: existing,
          rateLimited: true,
        };
      }
    }

    const payload = await this.buildPayload(input.sessionId, userId);
    if (!payload) {
      return null;
    }

    const model = this.config.get('OPENAI_FEEDBACK_MODEL') || 'gpt-4o-mini';
    const prompt = this.buildPrompt(payload, input.focus || 'summary', input.language || 'es');
    const responseText = await this.openai.createResponse(
      [{ role: 'user', content: prompt }],
      model,
    );

    const parsedJson = extractFirstJson(responseText);
    const parsed = FeedbackResponseSchema.safeParse(parsedJson);

    if (!parsed.success) {
      return {
        error: {
          code: 'FEEDBACK_PARSE_ERROR',
          message: 'Failed to parse feedback JSON.',
        },
      };
    }

    const data = parsed.data;

    const saved = await this.prisma.feedback.upsert({
      where: { sessionId: input.sessionId },
      update: {
        summary: data.summary,
        strengths: data.strengths,
        weaknesses: data.weaknesses,
        plan: data.plan,
        insights: data.insights,
        generatedAt: now,
        model,
        promptVersion: PROMPT_VERSION,
      },
      create: {
        sessionId: input.sessionId,
        userId,
        summary: data.summary,
        strengths: data.strengths,
        weaknesses: data.weaknesses,
        plan: data.plan,
        insights: data.insights,
        generatedAt: now,
        model,
        promptVersion: PROMPT_VERSION,
      },
    });

    this.stream.publish(userId, 'feedback:ready', { sessionId: input.sessionId });

    return { cached: false, feedback: saved };
  }
}
