import { Injectable } from '@nestjs/common';
import { desglosar, resumirDesglose } from './xp-desglose';
import { rachaConPerdon, diasDesdeElPerdon } from './utils/racha-perdon';
import { PrismaService } from '../persistence/prisma.service';
import {
  Area,
  calculateAreaProgress,
  calculateLevel,
  calculateStreak,
  getDifficultyMultiplier,
  formatDateInTimeZone,
  isStudyDay,
  normalizeTimeZone,
} from './utils/dashboard-math';
import { StudySessionInput } from './dto/study-session.schema';
import { AnswerInput } from './dto/answers.schema';
import { Area as PrismaArea, MissionRecurrence, MissionType, StudyMode as PrismaStudyMode } from '@prisma/client';
import { StartSessionInput } from './dto/start-session.schema';
import { CompleteSessionInput } from './dto/complete-session.schema';
import { DashboardStreamService } from './dashboard-stream.service';

const CACHE_TTL_MS = 2 * 60 * 1000;
const XP_PER_CORRECT = 10;
const XP_PER_MINUTE = 1;

const DEFAULT_MISSIONS: Array<{
  id: string;
  title: string;
  description: string;
  type: MissionType;
  target: number;
  xpReward: number;
  recurrence: MissionRecurrence;
  area?: PrismaArea;
}> = [
  {
    id: 'daily_questions_mat',
    title: 'Responder 5 preguntas de Matematicas',
    description: 'Completa preguntas de matematicas para sumar XP.',
    type: 'questions_by_area',
    target: 5,
    xpReward: 40,
    recurrence: 'daily',
    area: 'MAT',
  },
  {
    id: 'daily_review_explanations',
    title: 'Revisar 2 explicaciones',
    description: 'Refuerza tus errores revisando explicaciones.',
    type: 'review_explanations',
    target: 2,
    xpReward: 30,
    recurrence: 'daily',
  },
  {
    id: 'daily_time_trial',
    title: 'Practicar contrarreloj',
    description: 'Completa una sesion contrarreloj hoy.',
    type: 'time_trial_sessions',
    target: 1,
    xpReward: 60,
    recurrence: 'daily',
  },
  {
    id: 'daily_review_test',
    title: 'Analizar ultima prueba',
    description: 'Revisa tu ultima prueba tipo test.',
    type: 'review_test',
    target: 1,
    xpReward: 50,
    recurrence: 'daily',
  },
  {
    id: 'daily_sessions_completed',
    title: 'Completa 3 sesiones hoy',
    description: 'Suma sesiones y gana XP extra.',
    type: 'sessions_completed',
    target: 3,
    xpReward: 80,
    recurrence: 'daily',
  },
];

type MissionItem = {
  id: string;
  title: string;
  status: 'done' | 'pending';
  progress: number;
  target: number;
  xpReward: number;
};

type DashboardData = {
  streak: {
    currentDays: number;
    longestDays: number;
    nextMilestoneDays: number;
    lastStudyDate: string;
    /* Whether a missed day is being forgiven right now. Worth saying
       out loud: a learner who knows they skipped yesterday and sees
       the streak unbroken would otherwise think the number is
       wrong. */
    perdonUsado: boolean;
  };
  level: {
    level: number;
    totalXp: number;
    currentXp: number;
    nextLevelXp: number;
  };
  timeStudied: {
    weekMinutes: number;
    lastSessionAt: string;
  };
  missions: {
    total: number;
    completed: number;
    items: MissionItem[];
  };
  areaProgress: Array<{ area: Area; accuracy: number; questions: number }>;
  suggestedChallenge: {
    title: string;
    description: string;
    xpReward: number;
  };
  modeCards: Record<
    'generacion_libre' | 'contrarreloj',
    {
      status: 'active' | 'recommended';
      lastSessionAt: string;
      recommendation: string;
      sessionsThisWeek: number;
    }
  >;
};

@Injectable()
export class DashboardService {
  private static cache = new Map<string, { data: DashboardData; expiresAt: number }>();

  constructor(private prisma: PrismaService, private stream: DashboardStreamService) {}

  clearCache(userId: string) {
    DashboardService.cache.delete(userId);
  }

  private getCache(userId: string) {
    const entry = DashboardService.cache.get(userId);
    if (!entry) {
      return null;
    }

    if (entry.expiresAt <= Date.now()) {
      DashboardService.cache.delete(userId);
      return null;
    }

    return entry;
  }

  private setCache(userId: string, data: DashboardData) {
    DashboardService.cache.set(userId, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  }

  private async emitDashboardUpdate(userId: string, reason: string) {
    const cached = this.getCache(userId);
    if (cached) {
      this.stream.publish(userId, 'dashboard:update', { reason, data: cached.data, cached: true });
      return;
    }

    const result = await this.getDashboard(userId);
    this.stream.publish(userId, 'dashboard:update', { reason, data: result.data, cached: false });
  }

  private async ensureUser(userId: string, timezone?: string) {
    const safeTimeZone = normalizeTimeZone(timezone);

    return this.prisma.user.upsert({
      where: { id: userId },
      update: timezone ? { timezone: safeTimeZone } : {},
      create: {
        id: userId,
        timezone: safeTimeZone,
      },
    });
  }

  private calculateSessionXp(input: StudySessionInput & { timeLimitSeconds?: number }) {
    const multiplier = getDifficultyMultiplier(input.dificultad);
    const xpFromCorrect = Math.round(Math.max(0, input.correctQuestions) * XP_PER_CORRECT * multiplier);
    if (input.mode === 'contrarreloj') {
      const totalQuestions = Math.max(0, input.totalQuestions);
      const accuracy = totalQuestions > 0 ? input.correctQuestions / totalQuestions : 0;
      const timeLimitSeconds = input.timeLimitSeconds || 0;
      const speedFactor =
        timeLimitSeconds > 0
          ? Math.max(0, (timeLimitSeconds - input.durationSeconds) / timeLimitSeconds)
          : 0;
      const bonusXp = accuracy >= 0.5 ? Math.round(speedFactor * totalQuestions * 4) : 0;

      return {
        correctXp: xpFromCorrect,
        timeXp: 0,
        bonusXp,
        total: xpFromCorrect + bonusXp,
      };
    }

    const xpFromTime = Math.floor(Math.max(0, input.durationSeconds) / 60) * XP_PER_MINUTE;
    return {
      correctXp: xpFromCorrect,
      timeXp: xpFromTime,
      bonusXp: 0,
      total: xpFromCorrect + xpFromTime,
    };
  }

  async createStudySession(userId: string, input: StudySessionInput) {
    const user = await this.ensureUser(userId, input.timezone);
    const xpAwarded = this.calculateSessionXp(input);

    const session = await this.prisma.$transaction(async (tx) => {
      const created = await tx.studySession.create({
        data: {
          userId: user.id,
          mode: input.mode as PrismaStudyMode,
          area: input.area as PrismaArea,
          dificultad: input.dificultad,
          tema: input.tema || null,
          startedAt: new Date(input.startedAt),
          endedAt: new Date(input.endedAt),
          durationSeconds: input.durationSeconds,
          totalQuestions: input.totalQuestions,
          correctQuestions: input.correctQuestions,
          correctXpAwarded: xpAwarded.correctXp,
          timeXpAwarded: xpAwarded.timeXp,
        },
      });

      if (xpAwarded.correctXp > 0) {
        await tx.xPEvent.create({
          data: {
            userId: user.id,
            amount: xpAwarded.correctXp,
            reason: 'session_correct',
            meta: {
              mode: input.mode,
              area: input.area,
              dificultad: input.dificultad,
              totalQuestions: input.totalQuestions,
              correctQuestions: input.correctQuestions,
            },
          },
        });
      }

      if (xpAwarded.timeXp > 0) {
        await tx.xPEvent.create({
          data: {
            userId: user.id,
            amount: xpAwarded.timeXp,
            reason: 'session_time',
            meta: {
              mode: input.mode,
              area: input.area,
              durationSeconds: input.durationSeconds,
            },
          },
        });
      }

      if (xpAwarded.bonusXp > 0) {
        await tx.xPEvent.create({
          data: {
            userId: user.id,
            amount: xpAwarded.bonusXp,
            reason: 'time_trial_bonus',
            meta: {
              mode: input.mode,
              area: input.area,
              totalQuestions: input.totalQuestions,
              durationSeconds: input.durationSeconds,
            },
          },
        });
      }

      return created;
    });
    this.clearCache(user.id);
    await this.emitDashboardUpdate(user.id, 'session_created');

    return {
      sessionId: session.id,
      xpAwarded: xpAwarded.total,
    };
  }

  async startStudySession(userId: string, input: StartSessionInput) {
    const user = await this.ensureUser(userId, input.timezone);
    const startedAt = new Date(input.startedAt);

    const session = await this.prisma.studySession.create({
      data: {
        userId: user.id,
        mode: input.mode as PrismaStudyMode,
        area: input.area as PrismaArea,
        dificultad: input.dificultad,
        tema: input.tema || null,
        startedAt,
        endedAt: startedAt,
        durationSeconds: 0,
        totalQuestions: 0,
        correctQuestions: 0,
        correctXpAwarded: 0,
        timeXpAwarded: 0,
      },
      select: { id: true, startedAt: true },
    });

    this.clearCache(user.id);
    await this.emitDashboardUpdate(user.id, 'session_started');

    return {
      sessionId: session.id,
      startedAt: session.startedAt.toISOString(),
    };
  }

  async startTimeTrialSession(params: {
    userId: string;
    modeId?: string | null;
    timeLimitSeconds: number;
    questions: number;
    area: string;
    dificultad?: string | null;
    mix?: Array<{ area: string; dificultad: string; n: number }> | null;
  }) {
    const user = await this.ensureUser(params.userId);
    const startedAt = new Date();

    const session = await this.prisma.studySession.create({
      data: {
        userId: user.id,
        mode: 'contrarreloj',
        modeId: params.modeId || null,
        timeLimitSeconds: params.timeLimitSeconds,
        questions: params.questions,
        area: params.area as PrismaArea,
        dificultad: (params.dificultad as any) || null,
        tema: null,
        startedAt,
        endedAt: startedAt,
        durationSeconds: 0,
        totalQuestions: 0,
        correctQuestions: 0,
        correctXpAwarded: 0,
        timeXpAwarded: 0,
        areaBreakdown: params.mix
          ? params.mix.map((entry) => ({
              area: entry.area,
              totalQuestions: entry.n,
              correctQuestions: 0,
            }))
          : null,
      },
      select: { id: true, startedAt: true },
    });

    this.clearCache(user.id);
    await this.emitDashboardUpdate(user.id, 'time_trial_started');

    return {
      sessionId: session.id,
      startedAt: session.startedAt.toISOString(),
    };
  }

  async completeStudySession(userId: string, sessionId: string, input: CompleteSessionInput) {
    const session = await this.prisma.studySession.findFirst({
      where: { id: sessionId, userId },
      select: {
        id: true,
        mode: true,
        area: true,
        dificultad: true,
        startedAt: true,
        correctXpAwarded: true,
        timeXpAwarded: true,
        timeLimitSeconds: true,
      },
    });

    if (!session) {
      return null;
    }

    const xpAwarded = this.calculateSessionXp({
      mode: session.mode as any,
      area: session.area as any,
      dificultad: session.dificultad || undefined,
      tema: undefined,
      startedAt: session.startedAt.toISOString(),
      endedAt: input.endedAt,
      durationSeconds: input.durationSeconds,
      totalQuestions: input.totalQuestions,
      correctQuestions: input.correctQuestions,
      timeLimitSeconds: session.timeLimitSeconds || undefined,
    });

    const deltaCorrect = xpAwarded.correctXp - (session.correctXpAwarded || 0);
    const deltaTime = xpAwarded.timeXp - (session.timeXpAwarded || 0);
    const deltaBonus = xpAwarded.bonusXp;

    const operations: Array<ReturnType<typeof this.prisma.studySession.update> | ReturnType<typeof this.prisma.xPEvent.create>> = [
      this.prisma.studySession.update({
        where: { id: session.id },
        data: {
          endedAt: new Date(input.endedAt),
          durationSeconds: input.durationSeconds,
          totalQuestions: input.totalQuestions,
          correctQuestions: input.correctQuestions,
          correctXpAwarded: xpAwarded.correctXp,
          timeXpAwarded: xpAwarded.timeXp,
          areaBreakdown: input.areaSummary ? input.areaSummary : undefined,
        },
      }),
    ];

    if (deltaCorrect !== 0) {
      operations.push(
        this.prisma.xPEvent.create({
          data: {
            userId,
            amount: deltaCorrect,
            reason: 'session_correct',
            meta: {
              sessionId,
              mode: session.mode,
              area: session.area,
              dificultad: session.dificultad,
              totalQuestions: input.totalQuestions,
              correctQuestions: input.correctQuestions,
            },
          },
        }),
      );
    }

    if (deltaTime !== 0) {
      operations.push(
        this.prisma.xPEvent.create({
          data: {
            userId,
            amount: deltaTime,
            reason: 'session_time',
            meta: {
              sessionId,
              mode: session.mode,
              area: session.area,
              durationSeconds: input.durationSeconds,
            },
          },
        }),
      );
    }

    if (deltaBonus > 0) {
      operations.push(
        this.prisma.xPEvent.create({
          data: {
            userId,
            amount: deltaBonus,
            reason: 'time_trial_bonus',
            meta: {
              sessionId,
              mode: session.mode,
              area: session.area,
              totalQuestions: input.totalQuestions,
              durationSeconds: input.durationSeconds,
              timeLimitSeconds: session.timeLimitSeconds,
            },
          },
        }),
      );
    }

    await this.prisma.$transaction(operations);
    this.clearCache(userId);
    await this.emitDashboardUpdate(userId, 'session_completed');

    return {
      sessionId,
      xpAwarded: xpAwarded.total,
      xpDelta: deltaCorrect + deltaTime + deltaBonus,
    };
  }

  async validateSessionOwnership(userId: string, sessionIds: string[]) {
    if (sessionIds.length === 0) {
      return [] as string[];
    }

    const owned = await this.prisma.studySession.findMany({
      where: {
        id: { in: sessionIds },
        userId,
      },
      select: { id: true },
    });

    const ownedSet = new Set(owned.map((session) => session.id));
    return sessionIds.filter((sessionId) => !ownedSet.has(sessionId));
  }

  async createAnswers(userId: string, answers: AnswerInput[]) {
    if (answers.length === 0) {
      return { inserted: 0, xpAdjusted: 0 };
    }

    const sessionIds = Array.from(new Set(answers.map((answer) => answer.sessionId)));
    const sessions = await this.prisma.studySession.findMany({
      where: { id: { in: sessionIds }, userId },
      select: { id: true, dificultad: true, correctXpAwarded: true, totalQuestions: true },
    });
    const sessionById = new Map(sessions.map((session) => [session.id, session]));

    const created = await this.prisma.answer.createMany({
      data: answers.map((answer) => ({
        sessionId: answer.sessionId,
        questionIndex: answer.questionIndex,
        area: answer.area ?? null,
        dificultad: answer.dificultad ?? null,
        selectedAnswer: answer.selectedAnswer ?? null,
        isCorrect: answer.isCorrect,
        // Accepted by the schema but dropped on the way in, so every
        // answer so far says only "wrong, in MAT" — with no way back to
        // the topic or the kind of mistake.
        itemId: answer.itemId ?? null,
        tiempoMs: answer.tiempoMs ?? null,
      })),
    });

    let totalAdjustment = 0;
    const updates: Array<ReturnType<typeof this.prisma.studySession.update>> = [];
    const xpEvents: Array<ReturnType<typeof this.prisma.xPEvent.create>> = [];

    for (const session of sessions) {
      const answersForSession = answers.filter((answer) => answer.sessionId === session.id);
      if (answersForSession.length === 0) {
        continue;
      }
      if (answersForSession.length < session.totalQuestions) {
        continue;
      }

      let desiredCorrectXp = 0;
      for (const answer of answersForSession) {
        if (!answer.isCorrect) {
          continue;
        }
        const multiplier = getDifficultyMultiplier(answer.dificultad || session.dificultad || undefined);
        desiredCorrectXp += Math.round(XP_PER_CORRECT * multiplier);
      }

      const delta = desiredCorrectXp - (session.correctXpAwarded || 0);
      if (delta !== 0) {
        totalAdjustment += delta;
        updates.push(
          this.prisma.studySession.update({
            where: { id: session.id },
            data: { correctXpAwarded: desiredCorrectXp },
          }),
        );
        xpEvents.push(
          this.prisma.xPEvent.create({
            data: {
              userId,
              amount: delta,
              reason: 'answer_correct_adjustment',
              meta: {
                sessionId: session.id,
                desiredCorrectXp,
                previousCorrectXp: session.correctXpAwarded,
              },
            },
          }),
        );
      }
    }

    if (updates.length > 0 || xpEvents.length > 0) {
      await this.prisma.$transaction([...updates, ...xpEvents]);
    }

    this.clearCache(userId);
    await this.emitDashboardUpdate(userId, 'answers_created');

    return {
      inserted: created.count,
      xpAdjusted: totalAdjustment,
    };
  }

  async recordHeartbeat(params: {
    userId: string;
    sessionId: string;
    elapsedSeconds: number;
    endedAt?: string;
  }) {
    const session = await this.prisma.studySession.findFirst({
      where: { id: params.sessionId, userId: params.userId },
      select: { id: true, durationSeconds: true },
    });

    if (!session) {
      return null;
    }

    const nextDuration = Math.max(session.durationSeconds || 0, params.elapsedSeconds);
    const updates: any = {
      durationSeconds: nextDuration,
      lastHeartbeatAt: new Date(),
    };

    if (params.endedAt) {
      updates.endedAt = new Date(params.endedAt);
    }

    const updated = await this.prisma.studySession.update({
      where: { id: session.id },
      data: updates,
      select: { id: true, durationSeconds: true, endedAt: true, lastHeartbeatAt: true },
    });

    this.clearCache(params.userId);
    await this.emitDashboardUpdate(params.userId, 'heartbeat');

    return updated;
  }

  async applySessionAreaSummary(params: {
    userId: string;
    sessionId: string;
    areaSummary: Array<{ area: PrismaArea; totalQuestions: number; correctQuestions: number }>;
  }) {
    const session = await this.prisma.studySession.findFirst({
      where: { id: params.sessionId, userId: params.userId },
      select: { id: true },
    });

    if (!session) {
      return null;
    }

    const totalQuestions = params.areaSummary.reduce(
      (sum, entry) => sum + Math.max(0, entry.totalQuestions || 0),
      0,
    );
    const correctQuestions = params.areaSummary.reduce(
      (sum, entry) =>
        sum + Math.max(0, Math.min(entry.correctQuestions || 0, entry.totalQuestions || 0)),
      0,
    );

    const updated = await this.prisma.studySession.update({
      where: { id: session.id },
      data: {
        totalQuestions,
        correctQuestions,
        areaBreakdown: params.areaSummary,
      },
      select: { id: true, totalQuestions: true, correctQuestions: true },
    });

    this.clearCache(params.userId);
    await this.emitDashboardUpdate(params.userId, 'session_seeded');

    return updated;
  }

  private async ensureDefaultMissions() {
    await Promise.all(
      DEFAULT_MISSIONS.map((mission) =>
        this.prisma.missionDefinition.upsert({
          where: { id: mission.id },
          update: {
            title: mission.title,
            description: mission.description,
            type: mission.type,
            target: mission.target,
            xpReward: mission.xpReward,
            recurrence: mission.recurrence,
            area: mission.area ?? null,
          },
          create: {
            id: mission.id,
            title: mission.title,
            description: mission.description,
            type: mission.type,
            target: mission.target,
            xpReward: mission.xpReward,
            recurrence: mission.recurrence,
            area: mission.area ?? null,
          },
        }),
      ),
    );

    const definitions = await this.prisma.missionDefinition.findMany({
      where: { id: { in: DEFAULT_MISSIONS.map((mission) => mission.id) } },
    });

    const byId = new Map(definitions.map((mission) => [mission.id, mission]));
    return DEFAULT_MISSIONS.map((mission) => byId.get(mission.id)).filter(Boolean);
  }

  private async buildMissions(params: {
    userId: string;
    todayDate: string;
    timeZone: string;
    sessions: Array<{
      id: string;
      mode: PrismaStudyMode;
      area: PrismaArea;
      endedAt: Date;
      totalQuestions: number;
      correctQuestions: number;
      areaBreakdown?: any;
    }>;
    answers: Array<{
      isCorrect: boolean;
      area: PrismaArea | null;
      dificultad: string | null;
      session: {
        endedAt: Date;
        area: PrismaArea;
        mode: PrismaStudyMode;
      };
    }>;
    now: Date;
  }) {
    const { userId, todayDate, timeZone, sessions, answers, now } = params;
    const missionDefinitions = await this.ensureDefaultMissions();

    const sessionsToday = sessions.filter(
      (session) => formatDateInTimeZone(session.endedAt, timeZone) === todayDate,
    );

    const answersToday = answers.filter(
      (answer) => formatDateInTimeZone(answer.session.endedAt, timeZone) === todayDate,
    );

    const totalQuestionsByArea = new Map<PrismaArea, number>();
    let incorrectQuestions = 0;
    let totalQuestionsCount = 0;

    if (answersToday.length > 0) {
      for (const answer of answersToday) {
        totalQuestionsCount += 1;
        const area = answer.area || answer.session.area;
        totalQuestionsByArea.set(area, (totalQuestionsByArea.get(area) || 0) + 1);
        if (!answer.isCorrect) {
          incorrectQuestions += 1;
        }
      }
    } else {
      for (const session of sessionsToday) {
        const breakdown = session.areaBreakdown as Array<{
          area: PrismaArea;
          totalQuestions: number;
          correctQuestions: number;
        }> | null;

        if (breakdown && Array.isArray(breakdown) && breakdown.length > 0) {
          for (const entry of breakdown) {
            totalQuestionsByArea.set(
              entry.area,
              (totalQuestionsByArea.get(entry.area) || 0) + Math.max(0, entry.totalQuestions),
            );
            const incorrect = Math.max(0, entry.totalQuestions - entry.correctQuestions);
            incorrectQuestions += incorrect;
            totalQuestionsCount += Math.max(0, entry.totalQuestions);
          }
        } else {
          totalQuestionsByArea.set(
            session.area,
            (totalQuestionsByArea.get(session.area) || 0) + Math.max(0, session.totalQuestions),
          );

          const incorrect = Math.max(0, session.totalQuestions - session.correctQuestions);
          incorrectQuestions += incorrect;
          totalQuestionsCount += Math.max(0, session.totalQuestions);
        }
      }
    }

    const timeTrialSessions = sessionsToday.filter((session) => session.mode === 'contrarreloj').length;
    const testSessions = sessionsToday.filter((session) => session.mode === 'test').length;
    const totalSessions = sessionsToday.length;

    const existingProgress = await this.prisma.missionProgress.findMany({
      where: {
        userId,
        date: todayDate,
        missionId: { in: missionDefinitions.map((mission) => mission.id) },
      },
    });

    const progressByMission = new Map(
      existingProgress.map((progress) => [progress.missionId, progress]),
    );

    const upserts: Array<ReturnType<typeof this.prisma.missionProgress.upsert>> = [];
    const xpEvents: Array<ReturnType<typeof this.prisma.xPEvent.create>> = [];

    const items: MissionItem[] = missionDefinitions.map((mission) => {
      let progressValue = 0;

      switch (mission.type) {
        case 'questions_by_area':
          if (mission.area) {
            progressValue = totalQuestionsByArea.get(mission.area) || 0;
          }
          break;
        case 'review_explanations':
          progressValue = incorrectQuestions;
          break;
        case 'time_trial_sessions':
          progressValue = timeTrialSessions;
          break;
        case 'review_test':
          progressValue = testSessions;
          break;
        case 'sessions_completed':
          progressValue = totalSessions;
          break;
        default:
          progressValue = 0;
      }

      const cappedProgress = Math.min(mission.target, Math.max(0, progressValue));
      const existing = progressByMission.get(mission.id);
      const isCompleted = cappedProgress >= mission.target;
      const completedAt = existing?.completedAt || (isCompleted ? now : null);

      upserts.push(
        this.prisma.missionProgress.upsert({
          where: {
            userId_missionId_date: {
              userId,
              missionId: mission.id,
              date: todayDate,
            },
          },
          update: {
            progress: cappedProgress,
            completedAt,
          },
          create: {
            userId,
            missionId: mission.id,
            date: todayDate,
            progress: cappedProgress,
            completedAt,
          },
        }),
      );

      if (isCompleted && !existing?.completedAt) {
        xpEvents.push(
          this.prisma.xPEvent.create({
            data: {
              userId,
              amount: mission.xpReward,
              reason: 'mission_completed',
              meta: {
                missionId: mission.id,
                date: todayDate,
              },
            },
          }),
        );
      }

      return {
        id: mission.id,
        title: mission.title,
        status: isCompleted ? 'done' : 'pending',
        progress: cappedProgress,
        target: mission.target,
        xpReward: mission.xpReward,
      };
    });

    if (upserts.length > 0 || xpEvents.length > 0) {
      await this.prisma.$transaction([...upserts, ...xpEvents]);
    }

    const completed = items.filter((mission) => mission.status === 'done').length;

    return {
      total: items.length,
      completed,
      items,
    };
  }

  async getDashboard(userId: string) {
    const cached = this.getCache(userId);
    if (cached) {
      return {
        data: cached.data,
        cached: true,
        cacheExpiresInSeconds: Math.max(0, Math.ceil((cached.expiresAt - Date.now()) / 1000)),
      };
    }

    const user = await this.ensureUser(userId);
    const timeZone = normalizeTimeZone(user.timezone);
    const now = new Date();
    const todayDate = formatDateInTimeZone(now, timeZone);

    const sessions = await this.prisma.studySession.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        mode: true,
        area: true,
        startedAt: true,
        endedAt: true,
        durationSeconds: true,
        totalQuestions: true,
        correctQuestions: true,
        areaBreakdown: true,
      },
      orderBy: { endedAt: 'asc' },
    });

    const studyDates: string[] = [];
    for (const session of sessions) {
      if (isStudyDay({ durationSeconds: session.durationSeconds, totalQuestions: session.totalQuestions })) {
        studyDates.push(formatDateInTimeZone(session.endedAt, timeZone));
      }
    }

    /* The streak, with one missed day a month forgiven. A streak that
       snaps after one bad day punishes the learner for exactly what
       the product exists to help with — see ADR 10. */
    const base = calculateStreak(studyDates, todayDate);
    const perdonada = rachaConPerdon(
      studyDates,
      todayDate,
      diasDesdeElPerdon(studyDates, todayDate),
    );
    const streak = {
      ...base,
      currentDays: Math.max(base.currentDays, perdonada.dias),
      perdonUsado: perdonada.perdonUsado,
    };

    const xpAggregate = await this.prisma.xPEvent.aggregate({
      where: { userId: user.id },
      _sum: { amount: true },
    });
    const totalXp = xpAggregate._sum.amount || 0;
    const level = calculateLevel(totalXp);

    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekSessions = sessions.filter((session) => session.endedAt >= weekStart);
    const answers = await this.prisma.answer.findMany({
      where: {
        session: {
          userId: user.id,
          endedAt: { gte: weekStart },
        },
      },
      select: {
        isCorrect: true,
        area: true,
        dificultad: true,
        session: {
          select: {
            endedAt: true,
            area: true,
            mode: true,
            dificultad: true,
          },
        },
      },
    });
    const weekSeconds = weekSessions.reduce(
      (total, session) => total + Math.max(0, session.durationSeconds),
      0,
    );

    const lastSessionAt = sessions.length > 0 ? sessions[sessions.length - 1].endedAt : null;

    const timeStudied = {
      weekMinutes: Math.floor(weekSeconds / 60),
      lastSessionAt: lastSessionAt ? lastSessionAt.toISOString() : '',
    };

    let areaProgress = calculateAreaProgress(
      weekSessions.map((session) => ({
        area: session.area as Area,
        totalQuestions: session.totalQuestions,
        correctQuestions: session.correctQuestions,
      })),
    );

    if (answers.length > 0) {
      const answerAreaStats = new Map<Area, { total: number; correct: number }>();
      for (const area of ['MAT', 'LC', 'CN', 'SOC', 'ING'] as Area[]) {
        answerAreaStats.set(area, { total: 0, correct: 0 });
      }
      for (const answer of answers) {
        const area = (answer.area || answer.session.area) as Area;
        const entry = answerAreaStats.get(area) || { total: 0, correct: 0 };
        entry.total += 1;
        if (answer.isCorrect) {
          entry.correct += 1;
        }
        answerAreaStats.set(area, entry);
      }
      areaProgress = Array.from(answerAreaStats.entries()).map(([area, entry]) => ({
        area,
        accuracy: entry.total > 0 ? Math.round((entry.correct / entry.total) * 100) : 0,
        questions: entry.total,
      }));
    } else {
      const areaTotals = new Map<Area, { total: number; correct: number }>();
      for (const area of ['MAT', 'LC', 'CN', 'SOC', 'ING'] as Area[]) {
        areaTotals.set(area, { total: 0, correct: 0 });
      }

      for (const session of weekSessions) {
        const breakdown = session.areaBreakdown as Array<{
          area: Area;
          totalQuestions: number;
          correctQuestions: number;
        }> | null;

        if (breakdown && Array.isArray(breakdown) && breakdown.length > 0) {
          for (const entry of breakdown) {
            const agg = areaTotals.get(entry.area) || { total: 0, correct: 0 };
            agg.total += Math.max(0, entry.totalQuestions || 0);
            agg.correct += Math.max(0, Math.min(entry.correctQuestions || 0, entry.totalQuestions || 0));
            areaTotals.set(entry.area, agg);
          }
        } else {
          const agg = areaTotals.get(session.area as Area) || { total: 0, correct: 0 };
          agg.total += Math.max(0, session.totalQuestions);
          agg.correct += Math.max(0, Math.min(session.correctQuestions, session.totalQuestions));
          areaTotals.set(session.area as Area, agg);
        }
      }

      areaProgress = Array.from(areaTotals.entries()).map(([area, entry]) => ({
        area,
        accuracy: entry.total > 0 ? Math.round((entry.correct / entry.total) * 100) : 0,
        questions: entry.total,
      }));
    }

    const missions = await this.buildMissions({
      userId: user.id,
      todayDate,
      timeZone,
      sessions,
      answers,
      now,
    });

    const suggestedChallenge = this.buildSuggestedChallenge({
      streak,
      areaProgress,
      missions,
      sessions,
      timeZone,
    });

    const modeCards = {
      generacion_libre: this.buildModeCard('generacion_libre', sessions, weekSessions, now),
      contrarreloj: this.buildModeCard('contrarreloj', sessions, weekSessions, now),
    };

    const data: DashboardData = {
      streak: {
        perdonUsado: streak.perdonUsado ?? false,
        currentDays: streak.currentDays,
        longestDays: streak.longestDays,
        nextMilestoneDays: streak.nextMilestoneDays,
        lastStudyDate: streak.lastStudyDate,
      },
      level,
      timeStudied,
      missions,
      areaProgress,
      suggestedChallenge,
      modeCards,
    };

    this.setCache(user.id, data);

    return {
      data,
      cached: false,
      cacheExpiresInSeconds: Math.ceil(CACHE_TTL_MS / 1000),
    };
  }

  /**
   * The XP ledger for one learner, grouped by what earned it.
   *
   * Bounded and recent-first: the ledger grows without limit, and the
   * oldest events of a long-running account would change no percentage
   * a learner acts on.
   */
  async getXpDesglose(userId: string) {
    const user = await this.ensureUser(userId);
    const eventos = await this.prisma.xPEvent.findMany({
      where: { userId: user.id },
      select: { reason: true, amount: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    const filas = desglosar(eventos);
    return { filas, frase: resumirDesglose(filas), eventos: eventos.length };
  }

  async getAchievements(userId: string) {
    const user = await this.ensureUser(userId);
    const timeZone = normalizeTimeZone(user.timezone);
    const now = new Date();
    const todayDate = formatDateInTimeZone(now, timeZone);

    const sessions = await this.prisma.studySession.findMany({
      where: { userId: user.id },
      select: { endedAt: true, mode: true, area: true, durationSeconds: true, totalQuestions: true },
    });

    const studyDates: string[] = [];
    for (const session of sessions) {
      if (isStudyDay({ durationSeconds: session.durationSeconds, totalQuestions: session.totalQuestions })) {
        studyDates.push(formatDateInTimeZone(session.endedAt, timeZone));
      }
    }

    /* The streak, with one missed day a month forgiven. A streak that
       snaps after one bad day punishes the learner for exactly what
       the product exists to help with — see ADR 10. */
    const base = calculateStreak(studyDates, todayDate);
    const perdonada = rachaConPerdon(
      studyDates,
      todayDate,
      diasDesdeElPerdon(studyDates, todayDate),
    );
    const streak = {
      ...base,
      currentDays: Math.max(base.currentDays, perdonada.dias),
      perdonUsado: perdonada.perdonUsado,
    };

    const matSessions = sessions.filter((session) => session.area === 'MAT').length;
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const timeTrialWeek = sessions.filter(
      (session) => session.mode === 'contrarreloj' && session.endedAt >= weekStart,
    ).length;

    const achievements = [
      {
        id: 'streak_7',
        title: 'Racha 7 dias',
        description: 'Mantener 7 dias consecutivos de estudio.',
        target: 7,
        progress: Math.min(streak.currentDays, 7),
        achieved: streak.currentDays >= 7,
        achievedAt: streak.currentDays >= 7 ? todayDate : '',
      },
      {
        id: 'mat_sessions_10',
        title: '10 sesiones de Matematicas',
        description: 'Completa 10 sesiones en Matematicas.',
        target: 10,
        progress: Math.min(matSessions, 10),
        achieved: matSessions >= 10,
        achievedAt: matSessions >= 10 ? todayDate : '',
      },
      {
        id: 'time_trial_5_week',
        title: '5 contrarreloj en una semana',
        description: 'Completa 5 sesiones contrarreloj en 7 dias.',
        target: 5,
        progress: Math.min(timeTrialWeek, 5),
        achieved: timeTrialWeek >= 5,
        achievedAt: timeTrialWeek >= 5 ? todayDate : '',
      },
    ];

    return achievements;
  }

  async getAdvancedDashboard(userId: string) {
    const user = await this.ensureUser(userId);
    const now = new Date();
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const prevWeekStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const sessions = await this.prisma.studySession.findMany({
      where: {
        userId: user.id,
        endedAt: { gte: prevWeekStart },
      },
      select: {
        endedAt: true,
        area: true,
        durationSeconds: true,
        totalQuestions: true,
        correctQuestions: true,
        dificultad: true,
      },
    });

    const answers = await this.prisma.answer.findMany({
      where: {
        session: {
          userId: user.id,
          endedAt: { gte: prevWeekStart },
        },
      },
      select: {
        isCorrect: true,
        dificultad: true,
        session: {
          select: {
            endedAt: true,
          },
        },
      },
    });

    const currentWeekSessions = sessions.filter((session) => session.endedAt >= weekStart);
    const prevWeekSessions = sessions.filter(
      (session) => session.endedAt < weekStart && session.endedAt >= prevWeekStart,
    );

    const currentArea = calculateAreaProgress(
      currentWeekSessions.map((session) => ({
        area: session.area as Area,
        totalQuestions: session.totalQuestions,
        correctQuestions: session.correctQuestions,
      })),
    );
    const prevArea = calculateAreaProgress(
      prevWeekSessions.map((session) => ({
        area: session.area as Area,
        totalQuestions: session.totalQuestions,
        correctQuestions: session.correctQuestions,
      })),
    );

    const areaTrend = currentArea.map((entry) => {
      const prev = prevArea.find((item) => item.area === entry.area);
      const delta = prev ? entry.accuracy - prev.accuracy : entry.accuracy;
      return {
        area: entry.area,
        accuracy: entry.accuracy,
        delta,
      };
    });

    const totalQuestions = currentWeekSessions.reduce(
      (sum, session) => sum + Math.max(0, session.totalQuestions),
      0,
    );
    const totalSeconds = currentWeekSessions.reduce(
      (sum, session) => sum + Math.max(0, session.durationSeconds),
      0,
    );
    const avgTimePerQuestionSeconds = totalQuestions > 0 ? Math.round(totalSeconds / totalQuestions) : 0;

    const answerScores = answers
      .filter((answer) => answer.session.endedAt >= weekStart)
      .map((answer) => {
        if (answer.dificultad === 'alta') return 3;
        if (answer.dificultad === 'media') return 2;
        if (answer.dificultad === 'facil') return 1;
        return 0;
      })
      .filter((score) => score > 0);

    const sessionScores = currentWeekSessions
      .map((session) => {
        if (session.dificultad === 'alta') return 3;
        if (session.dificultad === 'media') return 2;
        if (session.dificultad === 'facil') return 1;
        return 0;
      })
      .filter((score) => score > 0);

    const difficultyScores = answerScores.length > 0 ? answerScores : sessionScores;

    const avgDifficulty =
      difficultyScores.length > 0
        ? Number((difficultyScores.reduce((sum, score) => sum + score, 0) / difficultyScores.length).toFixed(2))
        : 0;

    return {
      areaTrend,
      avgTimePerQuestionSeconds,
      avgDifficulty,
      sessionsAnalyzed: currentWeekSessions.length,
    };
  }

  async getDashboardDebug(userId: string) {
    const user = await this.ensureUser(userId);
    const timeZone = normalizeTimeZone(user.timezone);
    const now = new Date();
    const todayDate = formatDateInTimeZone(now, timeZone);
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const sessions = await this.prisma.studySession.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        endedAt: true,
        durationSeconds: true,
        totalQuestions: true,
        correctQuestions: true,
        area: true,
        mode: true,
      },
    });

    const answers = await this.prisma.answer.findMany({
      where: { session: { userId: user.id } },
      select: {
        sessionId: true,
        isCorrect: true,
        area: true,
        dificultad: true,
      },
    });

    const studyDates = sessions
      .filter((session) =>
        isStudyDay({ durationSeconds: session.durationSeconds, totalQuestions: session.totalQuestions }),
      )
      .map((session) => formatDateInTimeZone(session.endedAt, timeZone));

    const weekSessions = sessions.filter((session) => session.endedAt >= weekStart);
    const lastSessionAt = sessions.length ? sessions.sort((a, b) => a.endedAt.getTime() - b.endedAt.getTime()).pop() : null;

    return {
      userId: user.id,
      timeZone,
      todayDate,
      sessionsCount: sessions.length,
      answersCount: answers.length,
      studyDates,
      weekSessionsCount: weekSessions.length,
      lastSessionAt: lastSessionAt ? lastSessionAt.endedAt.toISOString() : '',
    };
  }

  private buildModeCard(
    mode: PrismaStudyMode,
    sessions: Array<{ endedAt: Date; mode: PrismaStudyMode }>,
    weekSessions: Array<{ endedAt: Date; mode: PrismaStudyMode }>,
    now: Date,
  ): { status: 'active' | 'recommended'; lastSessionAt: string; recommendation: string; sessionsThisWeek: number } {
    const sessionsForMode = sessions.filter((session) => session.mode === mode);
    const lastSession = sessionsForMode.length
      ? sessionsForMode[sessionsForMode.length - 1].endedAt
      : null;

    const weekCount = weekSessions.filter((session) => session.mode === mode).length;
    const daysSince = lastSession ? Math.floor((now.getTime() - lastSession.getTime()) / 86400000) : null;
    const recommended = lastSession ? daysSince !== null && daysSince >= 2 : true;

    const recommendation =
      mode === 'contrarreloj'
        ? 'Completa una sesion contrarreloj para sumar XP.'
        : 'Practica un tema corto en generacion libre.';

    return {
      status: (recommended ? 'recommended' : 'active') as 'active' | 'recommended',
      lastSessionAt: lastSession ? lastSession.toISOString() : '',
      recommendation,
      sessionsThisWeek: weekCount,
    };
  }

  private buildSuggestedChallenge(params: {
    streak: { currentDays: number };
    areaProgress: Array<{ area: Area; accuracy: number }>;
    missions: { items: MissionItem[] };
    sessions: Array<{ endedAt: Date; mode: PrismaStudyMode }>;
    timeZone: string;
  }) {
    const { streak, areaProgress, missions, sessions, timeZone } = params;
    const now = new Date();

    if (streak.currentDays === 0) {
      return {
        title: 'Completa 1 sesion hoy',
        description: 'Activa tu racha y gana XP.',
        xpReward: 50,
      };
    }

    const weakest = areaProgress.reduce((current, entry) => {
      if (!current) return entry;
      return entry.accuracy < current.accuracy ? entry : current;
    }, null as { area: Area; accuracy: number } | null);

    if (weakest && weakest.accuracy < 50) {
      const label = this.getAreaLabel(weakest.area);
      return {
        title: `Practica 5 preguntas de ${label}`,
        description: `Mejora tu precision en ${label}.`,
        xpReward: 60,
      };
    }

    const lastTimeTrial = sessions
      .filter((session) => session.mode === 'contrarreloj')
      .sort((a, b) => a.endedAt.getTime() - b.endedAt.getTime())
      .pop();

    if (!lastTimeTrial) {
      return {
        title: 'Prueba una sesion contrarreloj',
        description: 'Suma XP y desbloquea logros.',
        xpReward: 60,
      };
    }

    const lastTrialDate = formatDateInTimeZone(lastTimeTrial.endedAt, timeZone);
    const todayDate = formatDateInTimeZone(now, timeZone);
    const daysSince = Math.abs(
      (new Date(todayDate).getTime() - new Date(lastTrialDate).getTime()) / 86400000,
    );
    if (daysSince >= 7) {
      return {
        title: 'Retoma contrarreloj esta semana',
        description: 'Completa 1 sesion para mantener ritmo.',
        xpReward: 70,
      };
    }

    const pendingMission = missions.items
      .filter((mission) => mission.status === 'pending')
      .sort((left, right) => right.xpReward - left.xpReward)[0];

    if (pendingMission) {
      return {
        title: `Completa: ${pendingMission.title}`,
        description: `Gana +${pendingMission.xpReward} XP`,
        xpReward: pendingMission.xpReward,
      };
    }

    return {
      title: 'Mantener racha activa',
      description: 'Estudia hoy para mantener la racha.',
      xpReward: 50,
    };
  }

  private getAreaLabel(area: Area) {
    switch (area) {
      case 'MAT':
        return 'Matematicas';
      case 'LC':
        return 'Lectura critica';
      case 'CN':
        return 'Ciencias naturales';
      case 'SOC':
        return 'Sociales';
      case 'ING':
        return 'Ingles';
      default:
        return area;
    }
  }
}
