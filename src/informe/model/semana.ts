import { formatDateInTimeZone } from '../../dashboard/utils/dashboard-math';

/**
 * Which week a moment belongs to, for a learner in their own timezone.
 *
 * The week is the report's unit of idempotency: `@@unique([userId,
 * semanaInicio])` is what makes opening the screen twice on a Tuesday
 * read the stored row instead of paying for a second call to the
 * model. That guarantee is only as good as this function, so it is
 * pure and tested rather than inlined into the service.
 *
 * Monday, because that is the week a student lives in: a report that
 * resets on Sunday night would split a weekend of studying across two
 * of them, and the plan it carries is for school days.
 *
 * Computed in the learner's timezone and stored as UTC midnight. A
 * learner in Bogotá who opens the app at 23:00 on Sunday is still in
 * last week, and the server being five hours ahead must not decide
 * otherwise.
 */
export function inicioDeSemana(ahora: Date, zona: string): Date {
  /* The local calendar date first, as a string, because that is the
     only way to ask "what day is it there" without reimplementing
     offsets. `formatDateInTimeZone` already normalises an invalid
     zone to UTC rather than throwing. */
  const fechaLocal = formatDateInTimeZone(ahora, zona);
  const [anio, mes, dia] = fechaLocal.split('-').map(Number);

  /* Built in UTC on purpose: this is a key, not a moment. Using the
     local constructor would make the stored value depend on the
     server's own zone, and the same Tuesday would hash to two
     different weeks after a deploy to a machine in another region. */
  const medianoche = new Date(Date.UTC(anio, mes - 1, dia));

  /* getUTCDay: 0 is Sunday. Monday is the start, so Sunday steps back
     six days and not one — the off-by-one that would put Sunday in
     the week about to begin. */
  const diaSemana = medianoche.getUTCDay();
  const diasDesdeLunes = diaSemana === 0 ? 6 : diaSemana - 1;

  medianoche.setUTCDate(medianoche.getUTCDate() - diasDesdeLunes);
  return medianoche;
}

/**
 * How the week reads to a learner: «del 24 al 30 de noviembre».
 *
 * In the report rather than on the screen because the report is also
 * read back weeks later, and a heading that says «esta semana» on a
 * stored document is a heading that lies by then.
 */
export function rotuloDeSemana(inicio: Date): string {
  const fin = new Date(inicio);
  fin.setUTCDate(fin.getUTCDate() + 6);

  const mes = (d: Date) =>
    [
      'enero',
      'febrero',
      'marzo',
      'abril',
      'mayo',
      'junio',
      'julio',
      'agosto',
      'septiembre',
      'octubre',
      'noviembre',
      'diciembre',
    ][d.getUTCMonth()];

  const mismoMes = inicio.getUTCMonth() === fin.getUTCMonth();

  return mismoMes
    ? `del ${inicio.getUTCDate()} al ${fin.getUTCDate()} de ${mes(fin)}`
    : `del ${inicio.getUTCDate()} de ${mes(inicio)} al ${fin.getUTCDate()} de ${mes(fin)}`;
}
