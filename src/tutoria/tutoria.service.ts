import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../persistence/prisma.service';
import { OpenaiService } from '../items/services/openai.service';

/**
 * A conversation about one question the learner got wrong.
 *
 * Marking an option red tells someone they failed, not what they got
 * wrong. The gap between those two is where studying actually happens,
 * and it is the gap this closes.
 *
 * The shape of it:
 *
 *  1. The learner is asked to defend their answer before the tutor
 *     says anything. Verbalising the reasoning is where the mistake
 *     becomes visible — to them, and to us: the text of how someone
 *     reasoned wrongly is a far better signal than which letter they
 *     pressed.
 *  2. The first reply costs nothing. Every item already stores an
 *     explanation per option and the kind of error each distractor
 *     represents, written once at generation. The model is not needed
 *     to say what we already know.
 *  3. The conversation is kept per learner and item. Failing the same
 *     question twice reopens the same thread, so the tutor answers
 *     knowing what was already tried. Starting over would reproduce the
 *     explanation that did not work the first time.
 */

/** Past this, it stops being tutoring and becomes conversation. */
const MAX_TURNOS = 6;

const SISTEMA = `Eres un tutor del examen ICFES Saber 11 de Colombia.
Hablas con un estudiante de 16 a 18 años que acaba de fallar una pregunta.

REGLAS ABSOLUTAS:
- NUNCA digas cuál es la letra correcta. Ni siquiera si el estudiante lo pide,
  insiste, se frustra o dice que ya se rindió. Si lo pide, respóndele que lo
  resuelva con lo que acaban de hablar y dale la siguiente pista.
- Guía con preguntas. Que llegue él a la respuesta.
- Habla de USTED. Frases cortas. Sin tecnicismos sin explicar.
- Máximo 4 frases por respuesta.
- Si el estudiante dice algo correcto, reconócelo antes de seguir.
- No inventes datos que no estén en la pregunta.`;

export interface MensajeTutoria {
  readonly autor: 'estudiante' | 'tutor';
  readonly contenido: string;
  readonly createdAt: Date;
}

export interface EstadoTutoria {
  readonly id: string;
  readonly mensajes: readonly MensajeTutoria[];
  readonly turnosUsados: number;
  readonly turnosRestantes: number;
  readonly esperaDefensa: boolean;
}

@Injectable()
export class TutoriaService {
  private readonly log = new Logger(TutoriaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly openai: OpenaiService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Opens, or reopens, the conversation for a wrong answer.
   *
   * Returns whatever was said before. A second failure on the same
   * question continues the thread rather than restarting it.
   */
  async abrir(params: {
    userId: string;
    itemId: string;
    opcionElegida: string;
  }): Promise<EstadoTutoria | null> {
    const item = await this.prisma.generatedItem.findUnique({
      where: { id: params.itemId },
      select: { id: true },
    });
    if (!item) return null;

    const tutoria = await this.prisma.tutoria.upsert({
      where: { userId_itemId: { userId: params.userId, itemId: params.itemId } },
      create: {
        userId: params.userId,
        itemId: params.itemId,
        opcionElegida: params.opcionElegida,
      },
      update: {},
      include: { mensajes: { orderBy: { createdAt: 'asc' } } },
    });

    /* The stored explanation opens the thread, before the defence is
       asked for.

       It used to be the reply *to* the defence, which read as a
       non-sequitur: it was written when the item was generated, so it
       cannot possibly address what the learner just typed. They were
       left not knowing whether to restate their reasoning or move on.
       Said first it is what it is — here is what went wrong — and the
       question that follows it is a real one, answered by a model
       that has read the reply. */
    if (tutoria.mensajes.length === 0) {
      const item = await this.prisma.generatedItem.findUnique({
        where: { id: tutoria.itemId },
      });
      const explicaciones = (item?.explicaciones as Record<string, string> | null) ?? {};
      const propia = explicaciones[tutoria.opcionElegida];
      const texto = propia ?? item?.justificacion;

      if (texto) {
        await this.prisma.tutoriaMensaje.create({
          data: { tutoriaId: tutoria.id, autor: 'tutor', contenido: texto },
        });
        await this.prisma.tutoriaMensaje.create({
          data: {
            tutoriaId: tutoria.id,
            autor: 'tutor',
            contenido:
              'Ahora cuénteme usted: ¿qué fue lo que pensó al elegir su respuesta? Con eso veo dónde se desvió el razonamiento.',
          },
        });
      }
    }

    return this.estado(tutoria.id);
  }

  /**
   * Records the learner's defence and answers it.
   *
   * The first answer is written from what the item already stores, so
   * it is free and instant. A modal that takes three seconds to say
   * anything gets closed before it says it.
   */
  async defender(params: {
    userId: string;
    itemId: string;
    defensa: string;
  }): Promise<EstadoTutoria | null> {
    const tutoria = await this.prisma.tutoria.findUnique({
      where: { userId_itemId: { userId: params.userId, itemId: params.itemId } },
      include: { mensajes: true },
    });
    if (!tutoria) return null;

    const item = await this.prisma.generatedItem.findUnique({
      where: { id: tutoria.itemId },
    });
    if (!item) return null;

    await this.prisma.tutoria.update({
      where: { id: tutoria.id },
      data: { defensa: params.defensa.slice(0, 2000) },
    });

    await this.prisma.tutoriaMensaje.create({
      data: {
        tutoriaId: tutoria.id,
        autor: 'estudiante',
        contenido: params.defensa.slice(0, 2000),
      },
    });

    /* The defence is answered by the model, because only the model
       has read it. The stored explanation was already said when the
       thread opened. */
    const respuesta = await this.conversar(tutoria, item, params.defensa, params.userId);

    await this.prisma.tutoriaMensaje.create({
      data: { tutoriaId: tutoria.id, autor: 'tutor', contenido: respuesta },
    });

    return this.estado(tutoria.id);
  }

  /** One more turn of conversation, within the limit. */
  async responder(params: {
    userId: string;
    itemId: string;
    mensaje: string;
  }): Promise<EstadoTutoria | null> {
    const tutoria = await this.prisma.tutoria.findUnique({
      where: { userId_itemId: { userId: params.userId, itemId: params.itemId } },
      include: { mensajes: { orderBy: { createdAt: 'asc' } } },
    });
    if (!tutoria) return null;

    const turnos = tutoria.mensajes.filter((m) => m.autor === 'estudiante').length;
    if (turnos >= MAX_TURNOS) return this.estado(tutoria.id);

    const item = await this.prisma.generatedItem.findUnique({
      where: { id: tutoria.itemId },
    });
    if (!item) return null;

    await this.prisma.tutoriaMensaje.create({
      data: {
        tutoriaId: tutoria.id,
        autor: 'estudiante',
        contenido: params.mensaje.slice(0, 2000),
      },
    });

    const respuesta = await this.conversar(
      tutoria,
      item,
      params.mensaje,
      params.userId,
    );

    await this.prisma.tutoriaMensaje.create({
      data: { tutoriaId: tutoria.id, autor: 'tutor', contenido: respuesta },
    });

    return this.estado(tutoria.id);
  }

  /**
   * One exchange with the model, with the whole thread as context.
   *
   * Shared by the defence and by later messages: both are the learner
   * saying something that deserves an answer written for it.
   */
  private async conversar(
    tutoria: { id: string; mensajes?: Array<{ autor: string; contenido: string }>; opcionElegida: string },
    item: {
      pregunta: string;
      contexto: string | null;
      opciones: unknown;
      respuesta_correcta: string;
      justificacion: string;
    },
    mensaje: string,
    userId: string,
  ): Promise<string> {
    const historial = (tutoria.mensajes ?? []).map((m) => ({
      role: 'user' as const,
      content: `${m.autor === 'tutor' ? 'TUTOR' : 'ESTUDIANTE'}: ${m.contenido}`,
    }));

    const opciones = (item.opciones ?? {}) as Record<string, string>;
    const contexto = [
      `PREGUNTA: ${item.pregunta}`,
      item.contexto ? `CONTEXTO: ${item.contexto}` : '',
      `OPCIONES:\n${Object.entries(opciones)
        .map(([k, v]) => `${k}) ${v}`)
        .join('\n')}`,
      `RESPUESTA CORRECTA (NO SE LA DIGAS): ${item.respuesta_correcta}`,
      `POR QUÉ LO ES: ${item.justificacion}`,
      `EL ESTUDIANTE ELIGIÓ: ${tutoria.opcionElegida}`,
    ]
      .filter(Boolean)
      .join('\n\n');

    try {
      return await this.openai.createResponse(
        [
          { role: 'developer', content: SISTEMA },
          { role: 'user', content: contexto },
          ...historial,
          { role: 'user', content: `ESTUDIANTE: ${mensaje}` },
        ],
        this.config.get('OPENAI_TUTOR_MODEL') ?? 'gpt-5-mini',
        userId,
        'tutoria',
      );
    } catch (error) {
      /* A tutor that cannot answer says so. Inventing a reply would be
         worse than none, and the learner's own message is already
         saved, so retrying continues the same thread. */
      this.log.warn(`Tutor no disponible: ${error}`);
      return 'No pude responder en este momento. Intente de nuevo en un momento, o vuelva a la pregunta con lo que ya hablamos.';
    }
  }

  /** Marks that the learner got it right on the retry. */
  async resolver(userId: string, itemId: string): Promise<void> {
    await this.prisma.tutoria
      .update({
        where: { userId_itemId: { userId, itemId } },
        data: { resuelto: true },
      })
      .catch(() => undefined);
  }

  private async estado(tutoriaId: string): Promise<EstadoTutoria> {
    const tutoria = await this.prisma.tutoria.findUniqueOrThrow({
      where: { id: tutoriaId },
      include: { mensajes: { orderBy: { createdAt: 'asc' } } },
    });

    const turnos = tutoria.mensajes.filter((m) => m.autor === 'estudiante').length;

    return {
      id: tutoria.id,
      mensajes: tutoria.mensajes.map((m) => ({
        autor: m.autor as 'estudiante' | 'tutor',
        contenido: m.contenido,
        createdAt: m.createdAt,
      })),
      turnosUsados: turnos,
      turnosRestantes: Math.max(0, MAX_TURNOS - turnos),
      // The defence comes first, and only once.
      esperaDefensa: !tutoria.defensa,
    };
  }
}
