import { Injectable } from '@nestjs/common';
import { PrismaService } from '../persistence/prisma.service';
import {
  calculateAreaProgress,
  calculateLevel,
  calculateStreak,
  formatDateInTimeZone,
  isStudyDay,
  normalizeTimeZone,
} from '../dashboard/utils/dashboard-math';
import { rachaConPerdon, diasDesdeElPerdon } from '../dashboard/utils/racha-perdon';
import type { Area } from '../dashboard/utils/dashboard-math';
import {
  amistadQueManda,
  muestraCaraACara,
  muestraProgreso,
  puedeAbrir,
  relacionCon,
} from './model/quien-ve-que';

/** Subjects are only shown once there is enough to be fair about. */
const MINIMO_PREGUNTAS_POR_AREA = 10;

type Fallo = { ok: false; error: { code: string; message: string } };

function fallo(code: string, message: string): Fallo {
  return { ok: false, error: { code, message } };
}

/**
 * What one learner may see of another.
 *
 * Split from `DuelosService` because the question it answers is not
 * "how do duels work" but "who is allowed to know what", and that
 * question has exactly three answers:
 *
 *   - **Yourself.** Everything, always.
 *   - **A friend.** Everything, because an accepted friendship is
 *     consent given to a named person. Plus the head-to-head record,
 *     which only exists between two people.
 *   - **Anyone else.** The alias and the description always, because
 *     those are what a learner writes in order to be found. The
 *     progress only if they turned `progresoPublico` on.
 *
 * The flag is deliberately not `aliasBuscable`. That one means "I want
 * to be findable". It has never meant "I want strangers to see how I
 * am doing in mathematics", and reading it that way would change what
 * every learner who already picked an alias agreed to.
 *
 * What never travels, to anybody: the email, the plan, the timezone,
 * `createdAt`, and when the account was last active. The first four
 * are identifying, and the last is the one field that tells a stranger
 * when a minor is awake and holding their phone.
 */
@Injectable()
export class PerfilPublicoService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Reads another learner's profile as this learner is allowed to see
   * it.
   *
   * A block in either direction answers exactly as a missing account
   * does. Saying «that person exists but has blocked you» hands the
   * blocked learner a way to confirm the account and a reason to go
   * looking for them elsewhere.
   */
  async ver(userId: string, otroId: string) {
    if (!otroId.trim()) return fallo('NO_ENCONTRADO', 'Perfil no disponible.');

    /* Yourself is not a case this route handles. The app already has
       `GET duelos/perfil` for that, it returns fields this one must
       never return, and answering here too would mean two places that
       have to agree about what you may see of yourself. */
    if (userId === otroId) {
      return fallo('A_SI_MISMO', 'Use su propio perfil.');
    }

    const bloqueo = await this.prisma.bloqueo.findFirst({
      where: {
        OR: [
          { bloqueadorId: userId, bloqueadoId: otroId },
          { bloqueadorId: otroId, bloqueadoId: userId },
        ],
      },
      select: { id: true },
    });

    const otro = await this.prisma.user.findUnique({
      where: { id: otroId },
      select: {
        id: true,
        alias: true,
        descripcion: true,
        timezone: true,
        aliasBuscable: true,
        tutorAutorizoEn: true,
        progresoPublico: true,
        avatar: true,
        avatarColor: true,
      },
    });

    if (!otro) return fallo('NO_ENCONTRADO', 'Perfil no disponible.');

    /* Every row between these two, not the first one found.
       `@@unique([pidioId, recibioId])` is on the ORDERED pair, so
       two rows can exist at once — A asked B while B was asking A.
       A `findFirst` over both directions would then return whichever
       the planner reached first, and an accepted friendship read as
       a pending request: the progress hidden and the button offering
       «Enviar solicitud» to somebody who is already a friend. */
    const filas = await this.prisma.amistad.findMany({
      where: {
        OR: [
          { pidioId: userId, recibioId: otroId },
          { pidioId: otroId, recibioId: userId },
        ],
      },
      select: {
        id: true,
        estado: true,
        pidioId: true,
        resueltaEn: true,
        creadoEn: true,
      },
    });

    const amistad = amistadQueManda(filas);

    const esAmigo = amistad?.estado === 'aceptada';

    /* Every «may they?» in one place, decided by functions that a
       test can call with three booleans instead of three fixtures. */
    const abre = puedeAbrir({
      esAmigo,
      aliasBuscable: otro.aliasBuscable,
      tutorAutorizo: otro.tutorAutorizoEn !== null,
      hayBloqueo: bloqueo !== null,
      tieneAlias: otro.alias !== null,
    });
    /* One answer for blocked, unfindable, aliasless and nonexistent.
       Telling a stranger «that account exists but you may not see it»
       confirms the account to exactly the person who should not be
       probing for it. */
    if (!abre) return fallo('NO_ENCONTRADO', 'Perfil no disponible.');

    const conProgreso = muestraProgreso({
      esAmigo,
      progresoPublico: otro.progresoPublico,
    });
    const conCaraACara = muestraCaraACara({ esAmigo });

    const [progreso, cara] = await Promise.all([
      conProgreso ? this.progresoDe(otroId, otro.timezone) : Promise.resolve(null),
      conCaraACara ? this.caraACara(userId, otroId) : Promise.resolve(null),
    ]);

    return {
      ok: true as const,
      data: {
        id: otro.id,
        alias: otro.alias,
        descripcion: otro.descripcion,
        /* The figure they picked. Not gated behind `progresoPublico`:
           that flag covers how they are doing in mathematics, and an
           avatar is not progress — it is how they chose to be seen,
           by anyone who can already read their alias. Hiding it would
           show a stranger initials while their friends see a fox, and
           the same person would look like two accounts. */
        avatar: otro.avatar,
        avatarColor: otro.avatarColor,
        /* What the screen needs to decide which button to draw, said
           once by the server. The app working this out from a friend
           list it may not have loaded is how you get a «Enviar
           solicitud» button on somebody who is already your friend. */
        relacion: relacionCon(userId, amistad),
        amigosDesde: esAmigo ? (amistad?.resueltaEn ?? amistad?.creadoEn ?? null) : null,
        /* Null rather than absent, and a flag beside it. A profile
           with no numbers and no explanation reads as a profile that
           failed to load; this way the screen can say «no comparte su
           progreso» instead of showing a blank. */
        progreso,
        progresoOculto: !conProgreso,
        caraACara: cara,
      },
    };
  }

  /**
   * Level, streak and subjects — the same numbers the learner sees on
   * their own dashboard, computed the same way.
   *
   * Reuses the dashboard's pure functions rather than reimplementing
   * them. Two codepaths producing a level would eventually disagree,
   * and a profile that says level 7 while the owner's own screen says
   * 6 is a bug nobody can explain.
   */
  private async progresoDe(otroId: string, timezone: string) {
    const zona = normalizeTimeZone(timezone);
    const ahora = new Date();
    const hoy = formatDateInTimeZone(ahora, zona);

    const [sesiones, xp] = await Promise.all([
      this.prisma.studySession.findMany({
        where: { userId: otroId },
        select: {
          area: true,
          mode: true,
          endedAt: true,
          durationSeconds: true,
          totalQuestions: true,
          correctQuestions: true,
        },
        orderBy: { endedAt: 'asc' },
      }),
      this.prisma.xPEvent.aggregate({
        where: { userId: otroId },
        _sum: { amount: true },
      }),
    ]);

    const diasDeEstudio: string[] = [];
    for (const s of sesiones) {
      if (isStudyDay({ durationSeconds: s.durationSeconds, totalQuestions: s.totalQuestions })) {
        diasDeEstudio.push(formatDateInTimeZone(s.endedAt, zona));
      }
    }

    const base = calculateStreak(diasDeEstudio, hoy);
    const perdonada = rachaConPerdon(
      diasDeEstudio,
      hoy,
      diasDesdeElPerdon(diasDeEstudio, hoy),
    );

    const nivel = calculateLevel(xp._sum.amount || 0);

    /* Lifetime, not the last seven days. A visitor is asking "is this
       person any good", and a week's window makes somebody who was
       busy last week look like they cannot do mathematics. */
    const areas = calculateAreaProgress(
      sesiones.map((s) => ({
        area: s.area as Area,
        totalQuestions: s.totalQuestions,
        correctQuestions: s.correctQuestions,
      })),
    ).filter((a) => a.questions >= MINIMO_PREGUNTAS_POR_AREA);

    const rachaActual = Math.max(base.currentDays, perdonada.dias);

    return {
      nivel: nivel.level,
      /* The bar, so a visitor sees movement inside the level rather
         than a number that sits still for days. Not the lifetime
         total: that is a figure to compare yourself against, and it
         belongs on your own screen. */
      xpDelNivel: nivel.currentXp,
      xpParaSubir: nivel.nextLevelXp,
      racha: rachaActual,
      rachaMasLarga: base.longestDays,
      /* Only subjects with enough answers behind them. A learner who
         got one question right is not "100% in mathematics", and
         showing that to a stranger is both a lie and a reason not to
         open the app again. */
      areas,
      logros: this.logrosDe(sesiones, rachaActual, ahora),
    };
  }

  /**
   * Which achievements this learner has earned.
   *
   * Only the earned ones, and only their titles. The dashboard's own
   * list carries every achievement with its progress bar — «3 de 10
   * sesiones de Matemáticas» — and that half is a list of what
   * somebody has not managed to do yet. Theirs to look at; nobody
   * else's to read.
   *
   * The three definitions are the dashboard's, restated against the
   * sessions already in hand rather than fetched again. They are
   * duplicated knowingly: `getAchievements` builds its list with the
   * viewer's own progress woven in, so there is nothing to call that
   * would answer «what has this other person earned». If a fourth
   * achievement is added there and not here, this profile silently
   * stops showing it — hence the guard test that counts both lists.
   */
  private logrosDe(
    sesiones: ReadonlyArray<{ area: string; mode: string; endedAt: Date }>,
    racha: number,
    ahora: Date,
  ): string[] {
    const ganados: string[] = [];

    if (racha >= 7) ganados.push('Racha de 7 días');

    const deMatematicas = sesiones.filter((s) => s.area === 'MAT').length;
    if (deMatematicas >= 10) ganados.push('10 sesiones de Matemáticas');

    const haceUnaSemana = new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000);
    const contrarrelojes = sesiones.filter(
      (s) => s.mode === 'contrarreloj' && s.endedAt >= haceUnaSemana,
    ).length;
    if (contrarrelojes >= 5) ganados.push('5 contrarreloj en una semana');

    return ganados;
  }

  /**
   * Wins, losses and ties between these two, over every duel they
   * have ever finished.
   *
   * Counted in the database rather than fetched and tallied. An
   * earlier version read the last 50 rows with `take` and then
   * counted them in JavaScript, which is right until the 51st duel
   * and then quietly wrong: two learners who play daily would see
   * their record stop moving with no sign anything was truncated.
   * A capped total has to say it is capped, and the honest fix is
   * not to cap it — three counts cost less than fetching 50 rows.
   */
  private async caraACara(userId: string, otroId: string) {
    const entreLosDos = {
      estado: 'terminado' as const,
      terminadoEn: { not: null },
      OR: [
        { retadorId: userId, rivalId: otroId },
        { retadorId: otroId, rivalId: userId },
      ],
    };

    const [jugados, ganados, perdidos] = await Promise.all([
      this.prisma.duelo.count({ where: entreLosDos }),
      this.prisma.duelo.count({ where: { ...entreLosDos, ganadorId: userId } }),
      this.prisma.duelo.count({ where: { ...entreLosDos, ganadorId: otroId } }),
    ]);

    return {
      jugados,
      ganados,
      perdidos,
      /* Said explicitly. `jugados - ganados - perdidos` is correct
         and the screen should not have to know that. */
      empatados: jugados - ganados - perdidos,
    };
  }
}
