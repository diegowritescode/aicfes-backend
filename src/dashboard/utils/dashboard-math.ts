export const AREAS = ['MAT', 'LC', 'CN', 'SOC', 'ING'] as const;
export type Area = (typeof AREAS)[number];

export const STUDY_MODES = ['generacion_libre', 'contrarreloj', 'test'] as const;
export type StudyMode = (typeof STUDY_MODES)[number];

export const LEVEL_XP = 500;
export const STUDY_DAY_MIN_SECONDS = 300;
export const STUDY_DAY_MIN_QUESTIONS = 3;

const DEFAULT_MILESTONES = [3, 7, 14, 21, 30, 60, 90];

export const DIFFICULTY_MULTIPLIERS: Record<'facil' | 'media' | 'alta', number> = {
  facil: 1,
  media: 1.3,
  alta: 1.7,
};

export function getDifficultyMultiplier(dificultad?: 'facil' | 'media' | 'alta') {
  if (!dificultad) {
    return 1;
  }
  return DIFFICULTY_MULTIPLIERS[dificultad] || 1;
}

export type AreaProgressItem = {
  area: Area;
  accuracy: number;
  questions: number;
};

export type StreakResult = {
  currentDays: number;
  longestDays: number;
  lastStudyDate: string;
  nextMilestoneDays: number;
};

export function calculateLevel(totalXp: number) {
  const safeTotal = Math.max(0, Math.floor(totalXp));
  const level = Math.floor(safeTotal / LEVEL_XP) + 1;
  const currentXp = safeTotal % LEVEL_XP;

  return {
    level,
    totalXp: safeTotal,
    currentXp,
    nextLevelXp: LEVEL_XP,
  };
}

export function calculateAreaProgress(
  sessions: Array<{ area: Area; totalQuestions: number; correctQuestions: number }>,
  areas: readonly Area[] = AREAS,
): AreaProgressItem[] {
  const totals = new Map<Area, { correct: number; total: number }>();
  areas.forEach((area) => totals.set(area, { correct: 0, total: 0 }));

  for (const session of sessions) {
    const entry = totals.get(session.area) || { correct: 0, total: 0 };
    const totalQuestions = Math.max(0, session.totalQuestions);
    const correctQuestions = Math.max(0, session.correctQuestions);

    entry.total += totalQuestions;
    entry.correct += Math.min(correctQuestions, totalQuestions);
    totals.set(session.area, entry);
  }

  return areas.map((area) => {
    const entry = totals.get(area) || { correct: 0, total: 0 };
    const accuracy = entry.total > 0 ? Math.round((entry.correct / entry.total) * 100) : 0;

    return {
      area,
      accuracy,
      questions: entry.total,
    };
  });
}

export function isStudyDay(session: { durationSeconds: number; totalQuestions: number }) {
  return (
    session.durationSeconds >= STUDY_DAY_MIN_SECONDS ||
    session.totalQuestions >= STUDY_DAY_MIN_QUESTIONS
  );
}

export function normalizeTimeZone(timeZone?: string) {
  if (!timeZone) {
    return 'UTC';
  }

  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return 'UTC';
  }
}

export function formatDateInTimeZone(date: Date, timeZone: string) {
  const safeTimeZone = normalizeTimeZone(timeZone);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: safeTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function dateStringToUtcMs(dateString: string) {
  const [year, month, day] = dateString.split('-').map((value) => Number(value));
  return Date.UTC(year, month - 1, day);
}

export function diffDays(leftDate: string, rightDate: string) {
  const leftMs = dateStringToUtcMs(leftDate);
  const rightMs = dateStringToUtcMs(rightDate);
  return Math.round((leftMs - rightMs) / (24 * 60 * 60 * 1000));
}

export function calculateStreak(
  studyDates: string[],
  todayDate: string,
  milestones: number[] = DEFAULT_MILESTONES,
): StreakResult {
  const uniqueDates = Array.from(new Set(studyDates)).sort();

  if (uniqueDates.length === 0) {
    return {
      currentDays: 0,
      longestDays: 0,
      lastStudyDate: '',
      nextMilestoneDays: milestones[0] || 0,
    };
  }

  const lastStudyDate = uniqueDates[uniqueDates.length - 1];
  const daysSinceLast = diffDays(todayDate, lastStudyDate);

  let currentDays = 0;
  if (daysSinceLast <= 1) {
    currentDays = 1;
    for (let i = uniqueDates.length - 2; i >= 0; i -= 1) {
      const previous = uniqueDates[i];
      if (diffDays(lastStudyDate, previous) === currentDays) {
        currentDays += 1;
      } else {
        break;
      }
    }
  }

  let longestDays = 1;
  let run = 1;
  for (let i = 1; i < uniqueDates.length; i += 1) {
    if (diffDays(uniqueDates[i], uniqueDates[i - 1]) === 1) {
      run += 1;
    } else {
      run = 1;
    }
    if (run > longestDays) {
      longestDays = run;
    }
  }

  const nextMilestone = milestones.find((milestone) => milestone > currentDays);

  return {
    currentDays,
    longestDays,
    lastStudyDate,
    nextMilestoneDays: nextMilestone ?? currentDays + 7,
  };
}
