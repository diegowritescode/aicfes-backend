import { Injectable } from '@nestjs/common';
import { PrismaService } from '../persistence/prisma.service';
import { esVisibleEnBusqueda } from './model/alias';

import type { Fallo } from './duelos.service';

function fallo(code: string, message: string): Fallo {
  return { ok: false, error: { code, message } };
}

/** Friends a learner may have. High enough to never matter, low enough to bound a query. */
const MAXIMO_DE_AMIGOS = 100;

/**
 * The people a learner duels often.
 *
 * Exists because searching by alias every time is absurd when you
 * always compete with the same three classmates.
 *
 * **Mutual by construction.** A one-sided list would let a stranger
 * add a minor and challenge them without that minor agreeing to
 * anything — a second discovery surface on top of the one alias
 * search already has to justify.
 */
@Injectable()
export class AmigosService {
  constructor(private readonly prisma: PrismaService) {}

  /** Everyone this learner is connected to, and the requests pending. */
  async mios(userId: string) {
    const [filas, bloqueos] = await Promise.all([
      this.prisma.amistad.findMany({
        where: {
          OR: [{ pidioId: userId }, { recibioId: userId }],
          estado: { in: ['pendiente', 'aceptada'] },
        },
        orderBy: { creadoEn: 'desc' },
        take: MAXIMO_DE_AMIGOS * 2,
        select: {
          id: true,
          estado: true,
          creadoEn: true,
          pidioId: true,
          pidio: { select: { id: true, alias: true } },
          recibio: { select: { id: true, alias: true } },
        },
      }),
      this.prisma.bloqueo.findMany({
        where: { OR: [{ bloqueadorId: userId }, { bloqueadoId: userId }] },
        select: { bloqueadorId: true, bloqueadoId: true },
      }),
    ]);

    /* A blocked person disappears from the friend list without the
       friendship being deleted: unblocking restores it, and the block
       is what decides visibility either way. */
    const invisibles = new Set<string>();
    for (const b of bloqueos) {
      invisibles.add(b.bloqueadorId);
      invisibles.add(b.bloqueadoId);
    }

    const visibles = filas.filter((f) => {
      const otro = f.pidioId === userId ? f.recibio : f.pidio;
      return !invisibles.has(otro.id);
    });

    const conOtro = visibles.map((f) => ({
      id: f.id,
      estado: f.estado,
      creadoEn: f.creadoEn,
      yoPedi: f.pidioId === userId,
      /* Named rather than described by role: a learner thinks "Camilo",
         not "the person I sent a request to". */
      amigo: f.pidioId === userId ? f.recibio : f.pidio,
    }));

    return {
      ok: true as const,
      data: {
        amigos: conOtro.filter((f) => f.estado === 'aceptada'),
        /* Split, because they are different things to act on: one
           needs an answer and the other needs patience. */
        porResponder: conOtro.filter((f) => f.estado === 'pendiente' && !f.yoPedi),
        enviadas: conOtro.filter((f) => f.estado === 'pendiente' && f.yoPedi),
      },
    };
  }

  /** Asks someone to be a duelling partner. */
  async pedir(userId: string, otroId: string) {
    if (userId === otroId) {
      return fallo('A_SI_MISMO', 'No puede agregarse a usted mismo.');
    }

    const [otro, bloqueo, yaHay, cuantos] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: otroId },
        select: { alias: true, aliasBuscable: true, tutorAutorizoEn: true },
      }),
      this.prisma.bloqueo.findFirst({
        where: {
          OR: [
            { bloqueadorId: userId, bloqueadoId: otroId },
            { bloqueadorId: otroId, bloqueadoId: userId },
          ],
        },
        select: { id: true },
      }),
      this.prisma.amistad.findFirst({
        where: {
          OR: [
            { pidioId: userId, recibioId: otroId },
            { pidioId: otroId, recibioId: userId },
          ],
        },
        select: { id: true, estado: true, pidioId: true },
      }),
      this.prisma.amistad.count({
        where: {
          estado: 'aceptada',
          OR: [{ pidioId: userId }, { recibioId: userId }],
        },
      }),
    ]);

    /* A blocked pair and an invisible account are reported the same
       way, as in `puedeRetar`: telling someone "this person blocked
       you" confirms the account exists and that a specific person
       acted against them. */
    if (bloqueo || !otro || !esVisibleEnBusqueda(otro)) {
      return fallo('NO_DISPONIBLE', 'No puede agregar a esta persona.');
    }

    if (cuantos >= MAXIMO_DE_AMIGOS) {
      return fallo('DEMASIADOS', 'Llegó al límite de amigos.');
    }

    if (yaHay) {
      if (yaHay.estado === 'aceptada') {
        return fallo('YA_SON_AMIGOS', 'Ya son amigos.');
      }
      if (yaHay.estado === 'pendiente') {
        /* The other person asked first: this is an acceptance, not a
           second request. Two pending rows for one pair would leave
           both learners waiting on each other. */
        if (yaHay.pidioId === otroId) return this.responder(userId, yaHay.id, true);
        return fallo('YA_PEDIDA', 'Ya le envió una solicitud.');
      }
      /* Refused before. Asking again is allowed, but only by
         replacing the old row — a refused request that vanishes is a
         way to pester someone every day, and this at least leaves one
         row to count. */
      await this.prisma.amistad.update({
        where: { id: yaHay.id },
        data: { estado: 'pendiente', pidioId: userId, recibioId: otroId, resueltaEn: null },
      });
      return { ok: true as const, data: { estado: 'pendiente' } };
    }

    await this.prisma.amistad.create({
      data: { pidioId: userId, recibioId: otroId },
    });

    return { ok: true as const, data: { estado: 'pendiente' } };
  }

  /** Accepts or declines a request. */
  async responder(userId: string, amistadId: string, acepta: boolean) {
    const amistad = await this.prisma.amistad.findUnique({
      where: { id: amistadId },
      select: { recibioId: true, estado: true },
    });

    if (!amistad || amistad.recibioId !== userId) {
      return fallo('NO_ENCONTRADA', 'Esa solicitud no existe.');
    }
    if (amistad.estado !== 'pendiente') {
      return fallo('YA_RESPONDIDA', 'Esa solicitud ya no está pendiente.');
    }

    await this.prisma.amistad.update({
      where: { id: amistadId },
      data: { estado: acepta ? 'aceptada' : 'rechazada', resueltaEn: new Date() },
    });

    return { ok: true as const, data: { estado: acepta ? 'aceptada' : 'rechazada' } };
  }

  /** Removes a friend, in either direction. */
  async quitar(userId: string, otroId: string) {
    await this.prisma.amistad.deleteMany({
      where: {
        OR: [
          { pidioId: userId, recibioId: otroId },
          { pidioId: otroId, recibioId: userId },
        ],
      },
    });
    return { ok: true as const, data: { quitado: true } };
  }
}
