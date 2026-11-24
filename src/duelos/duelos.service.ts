import { Injectable, Logger } from '@nestjs/common';
import type { Area } from '@prisma/client';
import { PrismaService } from '../persistence/prisma.service';
import { ItemBankService } from '../items/services/item-bank.service';
import { CorreoService } from '../common/correo.service';
import { ConfigService } from '@nestjs/config';
import { asunto, cuerpo } from './model/correo-denuncia';
import { DebilidadesService } from '../calidad/debilidades.service';
import { esVisibleEnBusqueda, validarAlias } from './model/alias';
import {
  decidir,
  expiraEn,
  puedeRetar,
  type MarcadorDeJugador,
} from './model/resultado';

/** Questions per duel. Five is short enough to finish in one sitting. */
const PREGUNTAS_POR_DUELO = 5;

/** Results a search returns. Enough to find a classmate, too few to mine. */
const RESULTADOS_DE_BUSQUEDA = 10;

export interface Fallo {
  readonly ok: false;
  readonly error: { readonly code: string; readonly message: string };
}

function fallo(code: string, message: string): Fallo {
  return { ok: false, error: { code, message } };
}

/**
 * Reads a stored scorecard back out of its Json column.
 *
 * Checked rather than cast. A Json column can hold anything the day
 * someone writes to it by hand or a shape changes, and a bad cast
 * here would settle a duel on `NaN` instead of failing.
 */
function leerMarcador(valor: unknown): MarcadorDeJugador | null {
  if (valor === null || typeof valor !== 'object' || Array.isArray(valor)) return null;
  const v = valor as Record<string, unknown>;
  if (typeof v.aciertos !== 'number' || typeof v.segundos !== 'number') return null;
  return { aciertos: v.aciertos, segundos: v.segundos };
}

/**
 * Asynchronous 1v1 duels.
 *
 * Asynchronous because live play needs both learners present in the
 * same minute, which for someone balancing school and the ICFES means
 * never. Each plays when they can; the duel settles when the second
 * one finishes.
 *
 * Questions come from the verified bank, never generated. A duel is
 * five questions for two people, and paying a model to invent them
 * would make a social feature the most expensive thing in the product.
 */
@Injectable()
export class DuelosService {
  private readonly log = new Logger(DuelosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly banco: ItemBankService,
    private readonly debilidades: DebilidadesService,
    private readonly correo: CorreoService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Claims an alias.
   *
   * The unique index is the authority, not a prior lookup: two learners
   * claiming the same alias in the same second would both pass a check
   * and one would fail on write anyway.
   */
  async ponerAlias(userId: string, entrada: string) {
    const revisado = validarAlias(entrada);
    if (revisado.ok === false) {
      return fallo('ALIAS_INVALIDO', revisado.mensaje);
    }

    try {
      const usuario = await this.prisma.user.update({
        where: { id: userId },
        data: { alias: revisado.alias },
        select: { alias: true, aliasBuscable: true, tutorAutorizoEn: true },
      });
      return { ok: true as const, data: { ...usuario, visible: esVisibleEnBusqueda(usuario) } };
    } catch (e: any) {
      if (e?.code === 'P2002') {
        return fallo('ALIAS_TOMADO', 'Ese nombre ya está en uso. Pruebe otro.');
      }
      throw e;
    }
  }

  /** The learner's own alias settings. */
  async miPerfil(userId: string) {
    const usuario = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { alias: true, aliasBuscable: true, tutorAutorizoEn: true },
    });
    if (!usuario) return fallo('NO_ENCONTRADO', 'Cuenta no encontrada.');

    return {
      ok: true as const,
      data: { ...usuario, visible: esVisibleEnBusqueda(usuario) },
    };
  }

  /** Turns alias search on or off without losing the alias. */
  async cambiarBuscable(userId: string, buscable: boolean) {
    const usuario = await this.prisma.user.update({
      where: { id: userId },
      data: { aliasBuscable: buscable },
      select: { alias: true, aliasBuscable: true, tutorAutorizoEn: true },
    });
    return { ok: true as const, data: { ...usuario, visible: esVisibleEnBusqueda(usuario) } };
  }

  /**
   * Records that a guardian authorised this account.
   *
   * Self-declared, which is what an app can do: Ley 1581 de 2012
   * requires the authorisation, and verifying it is a problem no
   * mobile form solves. What matters is that it is explicit, dated,
   * and that nothing social works without it.
   */
  async registrarAutorizacionDeTutor(userId: string) {
    const usuario = await this.prisma.user.update({
      where: { id: userId },
      data: { tutorAutorizoEn: new Date() },
      select: { alias: true, aliasBuscable: true, tutorAutorizoEn: true },
    });
    return { ok: true as const, data: { ...usuario, visible: esVisibleEnBusqueda(usuario) } };
  }

  /**
   * Finds learners by alias.
   *
   * Prefix match, not substring: `cam` finds `camilo`, and `ilo` does
   * not. A substring search over every alias is a way to enumerate the
   * user base, which is the thing this feature must not become.
   *
   * Blocks are applied in both directions, so neither party appears to
   * the other.
   */
  async buscar(userId: string, termino: string) {
    const limpio = termino.trim().toLowerCase();
    if (limpio.length < 2) {
      return { ok: true as const, data: [] };
    }

    const bloqueos = await this.prisma.bloqueo.findMany({
      where: { OR: [{ bloqueadorId: userId }, { bloqueadoId: userId }] },
      select: { bloqueadorId: true, bloqueadoId: true },
    });
    const invisibles = new Set<string>([userId]);
    for (const b of bloqueos) {
      invisibles.add(b.bloqueadorId);
      invisibles.add(b.bloqueadoId);
    }

    const encontrados = await this.prisma.user.findMany({
      where: {
        alias: { startsWith: limpio },
        aliasBuscable: true,
        tutorAutorizoEn: { not: null },
        id: { notIn: [...invisibles] },
      },
      select: { id: true, alias: true },
      orderBy: { alias: 'asc' },
      take: RESULTADOS_DE_BUSQUEDA,
    });

    return { ok: true as const, data: encontrados };
  }

  /** Blocks another learner, in one direction but effective both ways. */
  async bloquear(userId: string, bloqueadoId: string) {
    if (userId === bloqueadoId) {
      return fallo('A_SI_MISMO', 'No puede bloquearse a usted mismo.');
    }

    await this.prisma.bloqueo.upsert({
      where: { bloqueadorId_bloqueadoId: { bloqueadorId: userId, bloqueadoId } },
      update: {},
      create: { bloqueadorId: userId, bloqueadoId },
    });

    /* Open duels between them are cancelled rather than left running.
       A block that leaves an active duel in place still shows the
       blocked learner's name on a screen every day. */
    await this.prisma.duelo.updateMany({
      where: {
        estado: { in: ['pendiente', 'en_curso'] },
        OR: [
          { retadorId: userId, rivalId: bloqueadoId },
          { retadorId: bloqueadoId, rivalId: userId },
        ],
      },
      data: { estado: 'cancelado' },
    });

    return { ok: true as const, data: { bloqueado: true } };
  }

  async desbloquear(userId: string, bloqueadoId: string) {
    await this.prisma.bloqueo.deleteMany({
      where: { bloqueadorId: userId, bloqueadoId },
    });
    return { ok: true as const, data: { bloqueado: false } };
  }

  /** Who this learner has blocked, for the screen that lists them. */
  async bloqueados(userId: string) {
    const filas = await this.prisma.bloqueo.findMany({
      where: { bloqueadorId: userId },
      select: { bloqueado: { select: { id: true, alias: true } }, creadoEn: true },
      orderBy: { creadoEn: 'desc' },
    });
    return { ok: true as const, data: filas };
  }

  /**
   * Reports another learner for a human to review.
   *
   * Stored rather than emailed: a report arriving as a notification
   * gets lost, and the same alias reported by three different learners
   * is a signal no single message carries.
   */
  async denunciar(params: {
    userId: string;
    denunciadoId: string;
    motivo: 'alias_ofensivo' | 'acoso' | 'suplantacion' | 'otro';
    detalle?: string;
  }) {
    if (params.userId === params.denunciadoId) {
      return fallo('A_SI_MISMO', 'No puede denunciarse a usted mismo.');
    }

    await this.prisma.denuncia.create({
      data: {
        denuncianteId: params.userId,
        denunciadoId: params.denunciadoId,
        motivo: params.motivo,
        detalle: params.detalle?.trim().slice(0, 1000) || null,
      },
    });

    /* Reporting blocks as well. Someone reporting harassment wants it
       to stop now, not after a review. */
    await this.bloquear(params.userId, params.denunciadoId);

    /* Not awaited, and failures are swallowed inside. A learner's
       report must not depend on a mail provider being reachable:
       the row is saved and the queue is readable either way. */
    void this.avisarPorCorreo(params);

    return {
      ok: true as const,
      data: { recibida: true, bloqueado: true },
    };
  }

  /**
   * Tells whoever moderates that a report arrived.
   *
   * Email rather than push. The queue was readable only from inside
   * the app, so a report sent at noon waited until someone happened
   * to open it — and push would not fix that either: it needs the app
   * installed, the device reachable and the notification not
   * dismissed. An email waits in an inbox.
   *
   * Silent when `MODERACION_CORREO` is unset, like the moderation
   * queue is closed without its token: a feature that needs an
   * address and has none should do nothing, not guess.
   */
  private async avisarPorCorreo(params: {
    userId: string;
    denunciadoId: string;
    motivo: 'alias_ofensivo' | 'acoso' | 'suplantacion' | 'otro';
  }): Promise<void> {
    const destino = this.config.get<string>('MODERACION_CORREO')?.trim();
    if (!destino) return;

    try {
      const [denunciado, denunciante, totales, abiertas, distintos] = await Promise.all([
        this.prisma.user.findUnique({
          where: { id: params.denunciadoId },
          select: { alias: true },
        }),
        this.prisma.user.findUnique({
          where: { id: params.userId },
          select: { alias: true },
        }),
        this.prisma.denuncia.count({ where: { denunciadoId: params.denunciadoId } }),
        this.prisma.denuncia.count({ where: { estado: 'abierta' } }),
        this.prisma.denuncia.findMany({
          where: { denunciadoId: params.denunciadoId },
          select: { denuncianteId: true },
          distinct: ['denuncianteId'],
        }),
      ]);

      const datos = {
        motivo: params.motivo,
        aliasDenunciado: denunciado?.alias ?? null,
        aliasDenunciante: denunciante?.alias ?? null,
        totales,
        personas: distintos.length,
        abiertas,
      };

      await this.correo.enviar({
        para: destino,
        asunto: asunto(datos),
        texto: cuerpo(datos),
      });
    } catch (e) {
      /* Reaching here means the notification failed, not the report.
         The row is already saved and the block already applied. */
      this.log.error(`No se pudo avisar de la denuncia: ${String(e)}`);
    }
  }

  /** Challenges another learner. */
  async retar(userId: string, rivalId: string) {
    const [retador, rival] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { tutorAutorizoEn: true },
      }),
      this.prisma.user.findUnique({
        where: { id: rivalId },
        select: { alias: true, aliasBuscable: true, tutorAutorizoEn: true },
      }),
    ]);

    if (!retador) return fallo('NO_ENCONTRADO', 'Cuenta no encontrada.');
    /* A missing rival is reported the same way as a hidden one, so an
       id cannot be probed for existence. */
    const rivalVisible = rival ? esVisibleEnBusqueda(rival) : false;

    const desde = new Date();
    desde.setHours(0, 0, 0, 0);

    const [bloqueo, abiertos, hoy] = await Promise.all([
      this.prisma.bloqueo.findFirst({
        where: {
          OR: [
            { bloqueadorId: userId, bloqueadoId: rivalId },
            { bloqueadorId: rivalId, bloqueadoId: userId },
          ],
        },
        select: { id: true },
      }),
      this.prisma.duelo.count({
        where: {
          estado: { in: ['pendiente', 'en_curso'] },
          OR: [
            { retadorId: userId, rivalId },
            { retadorId: rivalId, rivalId: userId },
          ],
        },
      }),
      this.prisma.duelo.count({
        where: { retadorId: userId, creadoEn: { gte: desde } },
      }),
    ]);

    const permiso = puedeRetar({
      retadorId: userId,
      rivalId,
      hayBloqueo: bloqueo !== null,
      rivalVisible,
      retadorAutorizado: retador.tutorAutorizoEn !== null,
      duelosAbiertosConEseRival: abiertos,
      invitacionesHoy: hoy,
    });

    if (!permiso.puede) {
      return fallo(permiso.motivo!.toUpperCase(), permiso.mensaje!);
    }

    const itemIds = await this.elegirPreguntas(userId, rivalId);
    if (itemIds.length < PREGUNTAS_POR_DUELO) {
      return fallo(
        'BANCO_INSUFICIENTE',
        'No hay preguntas suficientes para un duelo ahora. Intente más tarde.',
      );
    }

    const creadoEn = new Date();
    const duelo = await this.prisma.duelo.create({
      data: {
        retadorId: userId,
        rivalId,
        itemIds,
        creadoEn,
        expiraEn: expiraEn(creadoEn),
      },
      select: { id: true, estado: true, expiraEn: true },
    });

    return { ok: true as const, data: duelo };
  }

  /**
   * The five questions both players answer.
   *
   * Drawn from the bank across areas, weighted to neither player's
   * weakness. Aiming at one player's weak areas would hand the other a
   * duel they are likelier to win for a reason that has nothing to do
   * with how they played.
   */
  private async elegirPreguntas(unoId: string, otroId: string): Promise<string[]> {
    const AREAS: readonly Area[] = ['MAT', 'LC', 'CN', 'SOC', 'ING'];
    const ids: string[] = [];

    for (const area of AREAS) {
      if (ids.length >= PREGUNTAS_POR_DUELO) break;
      try {
        const items = await this.banco.draw({ area, limit: 1, excludeIds: ids });
        for (const item of items) ids.push(String(item.id));
      } catch (e) {
        this.log.warn(`Banco sin ${area} para un duelo: ${String(e)}`);
      }
    }

    return ids.slice(0, PREGUNTAS_POR_DUELO);
  }

  /** Accepts a challenge. */
  async aceptar(userId: string, dueloId: string) {
    const duelo = await this.prisma.duelo.findUnique({
      where: { id: dueloId },
      select: { rivalId: true, estado: true, expiraEn: true },
    });

    if (!duelo || duelo.rivalId !== userId) {
      return fallo('NO_ENCONTRADO', 'Ese duelo no existe.');
    }
    if (duelo.estado !== 'pendiente') {
      return fallo('YA_RESPONDIDO', 'Ese reto ya no está pendiente.');
    }
    if (duelo.expiraEn.getTime() < Date.now()) {
      await this.prisma.duelo.update({
        where: { id: dueloId },
        data: { estado: 'cancelado' },
      });
      return fallo('EXPIRADO', 'Ese reto ya venció.');
    }

    await this.prisma.duelo.update({
      where: { id: dueloId },
      data: { estado: 'en_curso' },
    });
    return { ok: true as const, data: { estado: 'en_curso' } };
  }

  /** Declines a challenge. */
  async rechazar(userId: string, dueloId: string) {
    const duelo = await this.prisma.duelo.findUnique({
      where: { id: dueloId },
      select: { rivalId: true, estado: true },
    });
    if (!duelo || duelo.rivalId !== userId) {
      return fallo('NO_ENCONTRADO', 'Ese duelo no existe.');
    }
    if (duelo.estado !== 'pendiente') {
      return fallo('YA_RESPONDIDO', 'Ese reto ya no está pendiente.');
    }

    await this.prisma.duelo.update({
      where: { id: dueloId },
      data: { estado: 'cancelado' },
    });
    return { ok: true as const, data: { estado: 'cancelado' } };
  }

  /**
   * Records one player's finished round and settles the duel if both
   * are done.
   *
   * The answers are graded here rather than trusted from the client:
   * a duel is the one place in this product where a learner has a
   * reason to lie about their own score.
   */
  async entregar(params: {
    userId: string;
    dueloId: string;
    respuestas: ReadonlyArray<{ itemId: string; eleccion: string }>;
    segundos: number;
  }) {
    const duelo = await this.prisma.duelo.findUnique({
      where: { id: params.dueloId },
      select: {
        id: true,
        retadorId: true,
        rivalId: true,
        estado: true,
        itemIds: true,
        resultadoRetador: true,
        resultadoRival: true,
      },
    });

    if (!duelo) return fallo('NO_ENCONTRADO', 'Ese duelo no existe.');

    const esRetador = duelo.retadorId === params.userId;
    const esRival = duelo.rivalId === params.userId;
    if (!esRetador && !esRival) {
      return fallo('NO_ENCONTRADO', 'Ese duelo no existe.');
    }
    if (duelo.estado !== 'en_curso') {
      return fallo('NO_EN_CURSO', 'Ese duelo no está en curso.');
    }

    const yaEntregado = esRetador ? duelo.resultadoRetador : duelo.resultadoRival;
    if (yaEntregado) {
      return fallo('YA_ENTREGADO', 'Ya entregó este duelo.');
    }

    const marcador = await this.calificar(duelo.itemIds, params.respuestas, params.segundos);

    const campo = esRetador ? 'resultadoRetador' : 'resultadoRival';
    const actualizado = await this.prisma.duelo.update({
      where: { id: duelo.id },
      data: { [campo]: marcador as object },
      select: { resultadoRetador: true, resultadoRival: true },
    });

    const delRetador = leerMarcador(actualizado.resultadoRetador);
    const delRival = leerMarcador(actualizado.resultadoRival);

    if (!delRetador || !delRival) {
      return {
        ok: true as const,
        data: { estado: 'en_curso', miMarcador: marcador, esperandoAlOtro: true },
      };
    }

    const veredicto = decidir(delRetador, delRival);
    const ganadorId =
      veredicto.tipo === 'empate'
        ? null
        : veredicto.tipo === 'retador'
          ? duelo.retadorId
          : duelo.rivalId;

    await this.prisma.duelo.update({
      where: { id: duelo.id },
      data: { estado: 'terminado', ganadorId, terminadoEn: new Date() },
    });

    return {
      ok: true as const,
      data: {
        estado: 'terminado',
        miMarcador: marcador,
        delOtro: esRetador ? delRival : delRetador,
        gane: ganadorId === params.userId,
        empate: ganadorId === null,
      },
    };
  }

  /** Grades a round against the bank's stored answers. */
  private async calificar(
    itemIds: readonly string[],
    respuestas: ReadonlyArray<{ itemId: string; eleccion: string }>,
    segundos: number,
  ): Promise<MarcadorDeJugador> {
    const items = await this.prisma.generatedItem.findMany({
      where: { id: { in: [...itemIds] } },
      select: { id: true, respuesta_correcta: true },
    });

    const correcta = new Map(items.map((i) => [i.id, i.respuesta_correcta]));
    let aciertos = 0;
    const contadas = new Set<string>();

    for (const r of respuestas) {
      /* Only the duel's own questions count, and each at most once: a
         client that sends the same correct answer five times must not
         score five. */
      if (!itemIds.includes(r.itemId) || contadas.has(r.itemId)) continue;
      contadas.add(r.itemId);
      if (correcta.get(r.itemId) === r.eleccion) aciertos += 1;
    }

    return { aciertos, segundos: Math.max(0, Math.floor(segundos)) };
  }

  /** The duels this learner has, newest first. */
  async mios(userId: string) {
    const filas = await this.prisma.duelo.findMany({
      where: { OR: [{ retadorId: userId }, { rivalId: userId }] },
      select: {
        id: true,
        estado: true,
        creadoEn: true,
        expiraEn: true,
        ganadorId: true,
        retadorId: true,
        resultadoRetador: true,
        resultadoRival: true,
        retador: { select: { id: true, alias: true } },
        rival: { select: { id: true, alias: true } },
      },
      orderBy: { creadoEn: 'desc' },
      take: 30,
    });

    return {
      ok: true as const,
      data: filas.map((d) => {
        const soyRetador = d.retadorId === userId;
        return {
          id: d.id,
          estado: d.estado,
          creadoEn: d.creadoEn,
          expiraEn: d.expiraEn,
          /* The other player, named rather than described by role: a
             learner thinks "my duel with Camilo", not "the duel where I
             am the challenger". */
          contra: soyRetador ? d.rival : d.retador,
          yoRete: soyRetador,
          miMarcador: soyRetador ? d.resultadoRetador : d.resultadoRival,
          marcadorDelOtro: soyRetador ? d.resultadoRival : d.resultadoRetador,
          gane: d.ganadorId === null ? null : d.ganadorId === userId,
        };
      }),
    };
  }

  /** The questions of a duel, without their answers. */
  async preguntas(userId: string, dueloId: string) {
    const duelo = await this.prisma.duelo.findUnique({
      where: { id: dueloId },
      select: { retadorId: true, rivalId: true, estado: true, itemIds: true },
    });

    if (!duelo || (duelo.retadorId !== userId && duelo.rivalId !== userId)) {
      return fallo('NO_ENCONTRADO', 'Ese duelo no existe.');
    }
    if (duelo.estado !== 'en_curso') {
      return fallo('NO_EN_CURSO', 'Ese duelo no está en curso.');
    }

    const items = await this.prisma.generatedItem.findMany({
      where: { id: { in: duelo.itemIds } },
      /* No `respuesta_correcta` and no `explicaciones`: both players
         are scored on these questions, so sending the answer would
         make the duel decided by whoever reads the response body. */
      select: {
        id: true,
        area: true,
        dificultad: true,
        contexto: true,
        pregunta: true,
        opciones: true,
        figura: true,
      },
    });

    /* Ordered as stored, so both players see the same sequence. */
    const porId = new Map(items.map((i) => [i.id, i]));
    const ordenados = duelo.itemIds.map((id) => porId.get(id)).filter(Boolean);

    return { ok: true as const, data: ordenados };
  }
}
