import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../persistence/prisma.service';

/**
 * Reading and acting on reports.
 *
 * This exists because the alternative is a report button nobody
 * attends, which is worse than no report button: it promises an
 * intervention that does not come. ADR 32 recorded that as the open
 * obligation of alias search, and this is it being paid.
 */
@Injectable()
export class ModeracionService {
  private readonly log = new Logger(ModeracionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * The queue: open reports, oldest first.
   *
   * Oldest first rather than newest, because a report waiting three
   * days is the one that has failed the learner who sent it.
   *
   * Each row carries **how many reports that account has**, which is
   * the signal no single report contains: the same alias reported by
   * three different learners is a pattern, and one report is a
   * complaint.
   */
  async cola(limite = 50) {
    const denuncias = await this.prisma.denuncia.findMany({
      where: { estado: 'abierta' },
      orderBy: { creadoEn: 'asc' },
      take: Math.min(Math.max(1, limite), 200),
      select: {
        id: true,
        motivo: true,
        detalle: true,
        creadoEn: true,
        denunciado: { select: { id: true, alias: true, aliasBuscable: true, createdAt: true } },
        /* The reporter's alias, not their email. Whoever reads this
           queue needs to tell two reports apart, not to contact
           anyone. */
        denunciante: { select: { id: true, alias: true } },
      },
    });

    const denunciados = [...new Set(denuncias.map((d) => d.denunciado.id))];
    const conteos = await this.prisma.denuncia.groupBy({
      by: ['denunciadoId'],
      where: { denunciadoId: { in: denunciados } },
      _count: { _all: true },
    });
    const porCuenta = new Map(conteos.map((c) => [c.denunciadoId, c._count._all]));

    /* How many distinct learners reported each account. Three
       complaints from one person and one each from three people look
       the same in a total and are not the same thing. */
    const distintos = await this.prisma.denuncia.findMany({
      where: { denunciadoId: { in: denunciados } },
      select: { denunciadoId: true, denuncianteId: true },
      distinct: ['denunciadoId', 'denuncianteId'],
    });
    const personasPorCuenta = new Map<string, number>();
    for (const d of distintos) {
      personasPorCuenta.set(d.denunciadoId, (personasPorCuenta.get(d.denunciadoId) ?? 0) + 1);
    }

    return {
      ok: true as const,
      data: denuncias.map((d) => ({
        ...d,
        denunciasTotales: porCuenta.get(d.denunciado.id) ?? 1,
        personasQueLoDenunciaron: personasPorCuenta.get(d.denunciado.id) ?? 1,
      })),
    };
  }

  /** How many are waiting, so the number can be checked without reading. */
  async pendientes() {
    const abiertas = await this.prisma.denuncia.count({ where: { estado: 'abierta' } });
    const masAntigua = await this.prisma.denuncia.findFirst({
      where: { estado: 'abierta' },
      orderBy: { creadoEn: 'asc' },
      select: { creadoEn: true },
    });

    return {
      ok: true as const,
      data: {
        abiertas,
        /* Days the oldest has waited. The number that says whether
           this queue is being attended at all. */
        diasDeLaMasAntigua: masAntigua
          ? Math.floor((Date.now() - masAntigua.creadoEn.getTime()) / 86_400_000)
          : null,
      },
    };
  }

  /**
   * Marks a report reviewed or dismissed.
   *
   * Both are closing it; the difference is what was found, and it is
   * kept because "we looked and there was nothing" and "we acted" are
   * different answers to the same learner.
   */
  async resolver(params: { id: string; estado: 'revisada' | 'descartada' }) {
    const existe = await this.prisma.denuncia.findUnique({
      where: { id: params.id },
      select: { estado: true },
    });
    if (!existe) {
      return { ok: false as const, error: { code: 'NO_ENCONTRADA', message: 'No existe.' } };
    }

    await this.prisma.denuncia.update({
      where: { id: params.id },
      data: { estado: params.estado, revisadoEn: new Date() },
    });

    this.log.log(`Denuncia ${params.id} marcada ${params.estado}.`);
    return { ok: true as const, data: { estado: params.estado } };
  }

  /**
   * Takes an account out of search.
   *
   * The action short of deleting anything: the learner keeps their
   * account, their history and their alias, and stops being findable.
   * Deleting a minor's account over a report nobody has verified is
   * not a call this product should make automatically — and
   * invisibility stops the harassment either way, because every duel
   * starts with a search.
   */
  async retirarDeBusqueda(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { aliasBuscable: false },
    });

    /* Open duels go too. Leaving them would keep this account on
       other learners' screens after it was taken out of search. */
    const cancelados = await this.prisma.duelo.updateMany({
      where: {
        estado: { in: ['pendiente', 'en_curso'] },
        OR: [{ retadorId: userId }, { rivalId: userId }],
      },
      data: { estado: 'cancelado' },
    });

    this.log.log(`Cuenta ${userId} retirada de búsqueda; ${cancelados.count} duelos cancelados.`);
    return { ok: true as const, data: { aliasBuscable: false, duelosCancelados: cancelados.count } };
  }

  /** Everything reported about one account, to judge a pattern. */
  async historialDe(userId: string) {
    const denuncias = await this.prisma.denuncia.findMany({
      where: { denunciadoId: userId },
      orderBy: { creadoEn: 'desc' },
      take: 100,
      select: {
        id: true,
        motivo: true,
        detalle: true,
        estado: true,
        creadoEn: true,
        revisadoEn: true,
        denunciante: { select: { id: true, alias: true } },
      },
    });

    const cuenta = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, alias: true, aliasBuscable: true, createdAt: true },
    });

    return { ok: true as const, data: { cuenta, denuncias } };
  }
}
