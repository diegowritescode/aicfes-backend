import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../persistence/prisma.service';
import { OpenaiService } from '../items/services/openai.service';
import { DebilidadesService } from '../calidad/debilidades.service';
import { DashboardService } from '../dashboard/dashboard.service';
import { SemanaRealService } from '../calidad/semana-real.service';
import { inicioDeSemana, rotuloDeSemana } from './model/semana';
import {
  aplanarSemana,
  aplanarTemas,
  hayMateriaParaInforme,
  type PayloadDelInforme,
} from './model/payload';
import { leerPlanGuardado, seguimientoDelPlan } from './model/seguimiento';
import { planConTemasReales } from './model/validar-plan';
import {
  ESQUEMA_JSON,
  InformeRespuestaSchema,
  type InformeRespuesta,
} from './dto/informe-respuesta.schema';

/**
 * The weekly report: where this learner stands, and what to do about it.
 *
 * Not `Feedback`, which is a post-mortem of one session. Twenty of
 * those do not add up to a picture, and a learner asking "how am I
 * doing" is not asking about their last eight questions.
 *
 * **The model writes the report. It does not work it out.** Every
 * figure comes from `DebilidadesService` and the dashboard, both
 * tested, and `InformeRespuestaSchema` has no numeric field at all.
 * The one place the model's output touches a key is `plan[].tema`,
 * and `planConTemasReales` drops any it invented.
 *
 * Generated on request rather than on a schedule: there is no
 * scheduler in this service — no `@nestjs/schedule`, no queue, no
 * Redis — and introducing one for a job that already has a natural
 * trigger would be infrastructure for its own sake. The first learner
 * to open the screen each week waits a few seconds; everyone after
 * reads the stored row. A cron would also generate reports for people
 * who have not opened the app in a month.
 */

/* Bumped when the prompt changes in a way that makes old reports read
   differently. Stored per row, so «why does mine look different from
   his» has an answer. */
const PROMPT_VERSION = 'v2';

/* Enough to say something, few enough to act on. The plan is capped
   at three in the prompt for the same reason. */
const TEMAS_EN_EL_INFORME = 5;

/** What the real exam gives per question. The ladder is anchored to it. */
const SEGUNDOS_EXAMEN_REAL = 64;

export interface InformeGuardado {
  readonly semanaInicio: Date;
  readonly semana: string;
  readonly resumen: string;
  readonly fortalezas: unknown;
  readonly debilidades: unknown;
  readonly plan: unknown;
  readonly datos: unknown;
  readonly generadoEn: Date;
}

@Injectable()
export class InformeService {
  private readonly log = new Logger(InformeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly openai: OpenaiService,
    private readonly debilidades: DebilidadesService,
    private readonly dashboard: DashboardService,
    private readonly semanaReal: SemanaRealService,
    private readonly config: ConfigService,
  ) {}

  /**
   * This week's report, generated if it does not exist yet.
   *
   * Returns null when there is not enough to write about, which is a
   * normal state for a new learner and not an error: the screen says
   * what is missing rather than showing an empty report.
   */
  async informeDeEstaSemana(userId: string): Promise<InformeGuardado | null> {
    const usuario = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });

    const semanaInicio = inicioDeSemana(new Date(), usuario?.timezone ?? 'UTC');

    const guardado = await this.prisma.informeSemanal.findUnique({
      where: { userId_semanaInicio: { userId, semanaInicio } },
    });

    if (guardado) {
      return {
        semanaInicio: guardado.semanaInicio,
        semana: rotuloDeSemana(guardado.semanaInicio),
        resumen: guardado.resumen,
        fortalezas: guardado.fortalezas,
        debilidades: guardado.debilidades,
        plan: guardado.plan,
        datos: guardado.datos,
        generadoEn: guardado.generadoEn,
      };
    }

    return this.generar(userId, semanaInicio);
  }

  /**
   * The numbers, before the model sees them.
   *
   * Public because it is worth being able to answer «what would the
   * report say» without paying for one, and because the screen uses
   * the same figures to show its own cards.
   */
  async datosDelInforme(
    userId: string,
    semanaInicio: Date,
  ): Promise<PayloadDelInforme | null> {
    /* The window is the seven days the report is about, not «the last
       seven days from now»: the report for a given week has to read
       the same on Tuesday as on Friday, and a rolling window would
       make a stored report disagree with its own `datos`. */
    const finDeSemana = new Date(semanaInicio);
    finDeSemana.setUTCDate(finDeSemana.getUTCDate() + 7);

    const [temas, avanzado, panel, semana, anterior] = await Promise.all([
      this.debilidades.temasDebiles(userId, TEMAS_EN_EL_INFORME),
      this.dashboard.getAdvancedDashboard(userId),
      this.dashboard.getDashboard(userId),
      this.semanaReal.resumen(userId, semanaInicio, finDeSemana),
      this.informeAnterior(userId, semanaInicio),
    ]);

    if (!hayMateriaParaInforme(temas)) return null;

    return {
      semana: rotuloDeSemana(semanaInicio),
      sesionesEstaSemana: avanzado.sessionsAnalyzed,
      /* The dashboard's own figure, not one recomputed here: two
         numbers for the same week drift apart, and this is the one
         already on the learner's screen. */
      minutosEstaSemana: panel.data.timeStudied.weekMinutes,
      porArea: avanzado.areaTrend.map((t) => ({
        area: t.area,
        aciertoPorcentaje: t.accuracy,
        delta: t.delta,
      })),
      segundosPorPregunta: avanzado.avgTimePerQuestionSeconds,
      segundosDelExamenReal: SEGUNDOS_EXAMEN_REAL,
      temasDebiles: aplanarTemas(temas),
      semana7dias: aplanarSemana(semana),
      /* Last week's plan, scored against this week's answers. Empty
         on a first report, which the prompt is told to read as «no
         hay con qué comparar» rather than as a failure to comply. */
      planAnterior: seguimientoDelPlan(leerPlanGuardado(anterior?.plan), semana),
      semanaVacia: avanzado.sessionsAnalyzed === 0,
    };
  }

  /**
   * The report immediately before this one, if there is one.
   *
   * Ordered by week rather than by `generadoEn` so a backfilled row
   * cannot pass itself off as the most recent. Only the week before
   * is of interest: comparing against a report from two months ago
   * would let the model say «cumpliste» about a plan the learner has
   * long forgotten.
   */
  private async informeAnterior(userId: string, semanaInicio: Date) {
    const semanaPrevia = new Date(semanaInicio);
    semanaPrevia.setUTCDate(semanaPrevia.getUTCDate() - 7);

    return this.prisma.informeSemanal.findUnique({
      where: { userId_semanaInicio: { userId, semanaInicio: semanaPrevia } },
      select: { plan: true },
    });
  }

  private async generar(
    userId: string,
    semanaInicio: Date,
  ): Promise<InformeGuardado | null> {
    const datos = await this.datosDelInforme(userId, semanaInicio);
    if (!datos) return null;

    const modelo =
      this.config.get<string>('OPENAI_INFORME_MODEL') ?? 'gpt-5-mini';

    let respuesta: InformeRespuesta;
    try {
      const crudo = await this.openai.createStructured<unknown>(
        [
          { role: 'developer', content: SISTEMA },
          { role: 'user', content: JSON.stringify(datos) },
        ],
        {
          schema: ESQUEMA_JSON as unknown as Record<string, unknown>,
          schemaName: 'informe_semanal',
          operacion: 'informe',
        },
        modelo,
        /* The fourth argument, not `request.userId`: `createStructured`
           declares that field and never reads it, so passing it inside
           the object records the spend with no owner and the daily
           quota sees this call as free. */
        userId,
      );

      respuesta = InformeRespuestaSchema.parse(crudo);
    } catch (error) {
      /* No stored row and no exception thrown at the learner: a report
         is not something they asked for by name, and a 502 on the
         screen that shows their progress would read as the app being
         broken. Next visit tries again. */
      const detalle = error instanceof Error ? error.message : String(error);
      this.log.warn(`No se pudo generar el informe de ${userId}: ${detalle}`);
      return null;
    }

    const plan = planConTemasReales(respuesta.plan, datos.temasDebiles);

    /* `create` rather than `upsert`, inside a catch for the unique
       violation: two requests racing on a Monday morning should leave
       one report and one invoice, and the second one reads what the
       first wrote instead of overwriting it. */
    try {
      const fila = await this.prisma.informeSemanal.create({
        data: {
          userId,
          semanaInicio,
          resumen: respuesta.resumen,
          fortalezas: respuesta.fortalezas,
          debilidades: respuesta.debilidades,
          plan,
          datos: datos as unknown as object,
          modelo,
          promptVersion: PROMPT_VERSION,
        },
      });

      return {
        semanaInicio: fila.semanaInicio,
        semana: datos.semana,
        resumen: fila.resumen,
        fortalezas: fila.fortalezas,
        debilidades: fila.debilidades,
        plan: fila.plan,
        datos: fila.datos,
        generadoEn: fila.generadoEn,
      };
    } catch {
      const existente = await this.prisma.informeSemanal.findUnique({
        where: { userId_semanaInicio: { userId, semanaInicio } },
      });
      if (!existente) throw new Error('no se pudo guardar el informe');

      return {
        semanaInicio: existente.semanaInicio,
        semana: rotuloDeSemana(existente.semanaInicio),
        resumen: existente.resumen,
        fortalezas: existente.fortalezas,
        debilidades: existente.debilidades,
        plan: existente.plan,
        datos: existente.datos,
        generadoEn: existente.generadoEn,
      };
    }
  }
}

/**
 * The prompt.
 *
 * Inline rather than in `prompts/`, matching `tutoria.service.ts`:
 * that directory holds the per-area item generators, which are long
 * and change independently. This one is short and changes with the
 * schema it answers.
 */
const SISTEMA = `Eres el tutor de un estudiante colombiano de 16 a 18 años que
se prepara para el examen ICFES Saber 11.

Escribes un informe semanal sobre cómo va. Recibes datos ya calculados
en JSON. Tu trabajo es redactarlos, no deducirlos.

REGLAS QUE NO PUEDES ROMPER:

1. No inventes ni un solo número. Los porcentajes, los temas y los
   conteos vienen en los datos. Si algo no está, no lo menciones.
2. El plan solo puede apuntar a temas que aparecen en "temasDebiles",
   usando exactamente el mismo "area" y el mismo "tema". Un tema que
   te inventes se descarta y el estudiante se queda sin esa parte del
   plan.
3. Máximo 3 acciones en el plan. Un plan de seis cosas no lo empieza
   nadie.
4. Máximo 3 fortalezas y 3 debilidades.
5. Hay DOS clases de evidencia y no se mezclan:

   - "semana7dias" es lo que pasó en estos siete días. De ahí SÍ
     puedes hablar en pasado: "esta semana te fue bien en X",
     "bajaste en Y".
   - "temasDebiles" es lo que arrastra desde antes, sin filtro de
     fecha. De ahí NO puedes hablar en pasado de la semana. Di
     "sigues fallando en X" o "X te viene costando".

   Si "semana7dias" es null, no hubo práctica medible en la semana:
   no digas nada en pasado sobre ella.

6. "planAnterior" es el plan de la semana pasada y cómo le fue. Si
   está vacío, es su primer informe: no hay con qué comparar y no se
   lo menciones. Si una acción trae "sinTocar": true, no la practicó;
   dilo sin regañar, una vez. Si trae un "aciertoPorcentaje", úsalo
   para decirle si le sirvió. Si "aciertoPorcentaje" es null pero
   "sinTocar" es false, sí practicó pero fue muy poco para sacar un
   porcentaje: di que lo tocó, sin cifra.

CÓMO HABLAS:

- Tutéalo. Nunca "usted".
- Directo y corto. El resumen son dos o tres frases.
- Sin regañar y sin felicitar de más. Una debilidad es información
  para actuar, no un reproche; y decirle que va bien cuando no va bien
  le quita la razón para estudiar.
- Nada de jerga pedagógica. "Confundes los conceptos" sí;
  "presentas dificultades en la apropiación conceptual" no.
- Si "semanaVacia" es verdadero, no finjas que practicó. Dile qué
  tiene pendiente y ya.

SOBRE EL RITMO:

"segundosPorPregunta" contra "segundosDelExamenReal" dice si le va a
alcanzar el tiempo. Si va más lento, menciónalo una vez; si va más
rápido pero falla, eso también importa: contestar rápido y mal es un
problema distinto a no alcanzar.

"semana7dias.lentos" son los temas donde se demora mucho más que su
propio promedio. Es dato aparte del acierto: puede acertar y aun así
irle a costar el tiempo en el examen. Si un tema aparece en "lentos"
y además en "flojos", eso es lo primero que hay que decirle.

Las fortalezas buenas salen de "semana7dias.fuertes", que son temas
concretos. "Vas bien en Matemáticas" dice menos que "te salieron bien
las fracciones": lo segundo le dice qué ya no tiene que estudiar.

SOBRE LOS TIPOS DE ERROR:

"errorTipico" es qué clase de error comete en ese tema:
- "error_calculo": sabe el concepto, se equivoca en las cuentas.
- "confunde_conceptos": mezcla dos ideas parecidas.
- "interpretacion_parcial": lee la mitad del enunciado.
Esto es lo más útil que le puedes decir, porque cada uno se arregla de
una forma distinta. Úsalo en el plan.`;
