import type { Area } from '@prisma/client';

/**
 * How an offline pool is divided between a learner's weak areas.
 *
 * Separate from the service and pure, because this is the part worth
 * testing: a pool that spends every slot on one area leaves the toll
 * asking the same kind of question all week, and a pool spread evenly
 * ignores what the learner is actually bad at.
 */

export interface PesoDeArea {
  readonly area: Area;
  /** Higher means more worth practising. From `PerfilDebilidad`. */
  readonly prioridad: number;
}

export interface Reparto {
  readonly area: Area;
  readonly cuantas: number;
}

const TODAS: readonly Area[] = ['MAT', 'LC', 'CN', 'SOC', 'ING'];

/**
 * Slots per area, proportional to priority, with a floor of one.
 *
 * Every area gets at least one question even when the learner has
 * never failed there. Two reasons: a pool covering only two areas
 * makes the toll predictable, and an area with no data is "not
 * measured" rather than "strong".
 *
 * With no priorities at all the pool is spread evenly, which is the
 * honest answer for a learner the system knows nothing about.
 */
export function repartir(total: number, pesos: readonly PesoDeArea[]): Reparto[] {
  if (total <= 0) return [];

  const areas = pesos.length > 0 ? pesos.map((p) => p.area) : [...TODAS];
  const unicas = [...new Set(areas)];

  /* When the pool is smaller than the number of areas, the highest
     priorities take what there is: everyone getting a fraction of a
     question serves nobody. */
  if (total <= unicas.length) {
    const ordenadas = [...unicas].sort(
      (a, b) => prioridadDe(b, pesos) - prioridadDe(a, pesos),
    );
    return ordenadas.slice(0, total).map((area) => ({ area, cuantas: 1 }));
  }

  const base = unicas.map((area) => ({ area, cuantas: 1, exacto: 0 }));
  let restante = total - unicas.length;

  const suma = unicas.reduce((s, a) => s + Math.max(0, prioridadDe(a, pesos)), 0);

  if (suma <= 0) {
    /* No priorities: hand out the remainder round-robin. Deliberately
       not random — a reproducible pool is one we can reason about when
       a learner reports something odd. */
    let i = 0;
    while (restante > 0) {
      base[i % base.length]!.cuantas += 1;
      i += 1;
      restante -= 1;
    }
    return base.map(({ area, cuantas }) => ({ area, cuantas }));
  }

  /* Proportional share of the remainder, floored, with the leftover to
     the largest fractions. Rounding each share independently would
     hand out more or fewer slots than asked for. */
  for (const b of base) {
    b.exacto = (Math.max(0, prioridadDe(b.area, pesos)) / suma) * restante;
    const entero = Math.floor(b.exacto);
    b.cuantas += entero;
    restante -= entero;
  }

  const porResto = [...base].sort(
    (a, b) =>
      (b.exacto % 1) - (a.exacto % 1) ||
      prioridadDe(b.area, pesos) - prioridadDe(a.area, pesos),
  );
  let j = 0;
  while (restante > 0) {
    porResto[j % porResto.length]!.cuantas += 1;
    j += 1;
    restante -= 1;
  }

  return base.map(({ area, cuantas }) => ({ area, cuantas }));
}

function prioridadDe(area: Area, pesos: readonly PesoDeArea[]): number {
  return pesos.find((p) => p.area === area)?.prioridad ?? 0;
}

/** What the pool adds up to, for the caller that promised a number. */
export function totalDe(reparto: readonly Reparto[]): number {
  return reparto.reduce((s, r) => s + r.cuantas, 0);
}
