import type { Plantilla, ValidacionFigura } from './types';

/**
 * A line chart: one quantity against another.
 *
 * Common in Ciencias Naturales, where a question shows how something
 * changes and asks what that says. It also appears as the *options*
 * themselves — Biología 2010 question 108 gives four curves and asks
 * which describes the process — so a figure is not always one per
 * item, and this template has to be cheap enough to draw four times.
 *
 * Supports an explicit series of points, or a named shape when the
 * question only cares about the trend rather than the values.
 */

export type Forma = 'creciente' | 'decreciente' | 'constante' | 'saturacion' | 'campana';

export interface LineasParams {
  /** Explicit points. Takes precedence over `forma`. */
  readonly puntos?: ReadonlyArray<{ readonly x: number; readonly y: number }>;
  /** A trend, when the question is about shape rather than values. */
  readonly forma?: Forma;
  readonly tituloEjeX?: string;
  readonly tituloEjeY?: string;
  /** Hides the numbers, for a question that is purely about shape. */
  readonly sinEscala?: boolean;
}

const W = 320;
const H = 220;
const PAD_L = 46;
const PAD_B = 44;
const PAD_T = 16;
const PAD_R = 14;

/** Twenty points is enough for a smooth curve at this size. */
function puntosDeForma(forma: Forma): Array<{ x: number; y: number }> {
  const n = 20;
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    let y: number;
    switch (forma) {
      case 'creciente':
        y = t;
        break;
      case 'decreciente':
        y = 1 - t;
        break;
      case 'constante':
        y = 0.5;
        break;
      case 'saturacion':
        // Rises fast, then flattens: the classic growth-to-a-ceiling curve.
        y = 1 - Math.exp(-3.2 * t);
        break;
      case 'campana':
        y = Math.exp(-Math.pow((t - 0.5) * 3.4, 2));
        break;
    }
    return { x: t, y };
  });
}

export const graficaLineas: Plantilla<LineasParams> = {
  id: 'graficaLineas',

  validar(parametros: unknown): ValidacionFigura {
    const p = parametros as Partial<LineasParams> | null;
    if (!p || typeof p !== 'object') {
      return { valida: false, error: 'los parámetros deben ser un objeto' };
    }
    if (!p.puntos && !p.forma) {
      return { valida: false, error: 'se necesita una serie de puntos o una forma' };
    }
    if (p.forma && !['creciente', 'decreciente', 'constante', 'saturacion', 'campana'].includes(p.forma)) {
      return { valida: false, error: `forma desconocida: ${p.forma}` };
    }
    if (p.puntos) {
      if (!Array.isArray(p.puntos) || p.puntos.length < 2) {
        return { valida: false, error: 'una línea necesita al menos 2 puntos' };
      }
      if (p.puntos.length > 200) {
        return { valida: false, error: 'más de 200 puntos no aporta nada legible' };
      }
      for (const pt of p.puntos) {
        if (!pt || !Number.isFinite(pt.x) || !Number.isFinite(pt.y)) {
          return { valida: false, error: 'todos los puntos necesitan x e y numéricos' };
        }
      }
      // A flat series would divide by zero when scaling; it is also a
      // constant, which the named shape says more clearly.
      const xs = p.puntos.map((q) => q.x);
      if (Math.max(...xs) === Math.min(...xs)) {
        return { valida: false, error: 'todos los puntos comparten la misma x' };
      }
    }
    return { valida: true };
  },

  dibujar(p: LineasParams): string {
    const datos = p.puntos ?? puntosDeForma(p.forma ?? 'creciente');

    const xs = datos.map((d) => d.x);
    const ys = datos.map((d) => d.y);
    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    // The baseline is zero only when the data itself varies. Forcing it
    // on a flat series is what pinned a constant line to the top edge.
    const yReal = Math.min(...ys);
    const yMaxDato = Math.max(...ys);
    const yMinDato = yMaxDato === yReal ? yReal : Math.min(0, yReal);
    // A flat series has no range. Pad it symmetrically so the line
    // sits mid-frame; without this it pins to the top edge, which
    // reads as a maximum rather than as "unchanging".
    const plano = yMaxDato === yMinDato;
    const margen = plano ? Math.max(Math.abs(yMaxDato), 1) : 0;
    const yMin = yMinDato - margen;
    const rangoY = yMaxDato + margen - yMin || 1;

    const ancho = W - PAD_L - PAD_R;
    const alto = H - PAD_T - PAD_B;
    const px = (x: number) => PAD_L + ((x - xMin) / (xMax - xMin)) * ancho;
    const py = (y: number) => PAD_T + alto - ((y - yMin) / rangoY) * alto;

    const piezas: string[] = [];

    if (!p.sinEscala) {
      for (let i = 0; i <= 4; i += 1) {
        const y = PAD_T + alto - (alto / 4) * i;
        piezas.push(
          `<line x1="${PAD_L}" y1="${y}" x2="${W - PAD_R}" y2="${y}" stroke="#eef2f6" stroke-width="1"/>`,
        );
      }
    }

    const d = datos
      .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${px(pt.x).toFixed(1)} ${py(pt.y).toFixed(1)}`)
      .join(' ');
    piezas.push(`<path d="${d}" fill="none" stroke="#0A6CBF" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`);

    // Axes above the curve, so the line never covers them.
    piezas.push(
      `<line x1="${PAD_L}" y1="${PAD_T}" x2="${PAD_L}" y2="${PAD_T + alto}" stroke="#0f172a" stroke-width="1.8"/>`,
      `<line x1="${PAD_L}" y1="${PAD_T + alto}" x2="${W - PAD_R}" y2="${PAD_T + alto}" stroke="#0f172a" stroke-width="1.8"/>`,
    );
    // Arrowheads: these axes mean "increasing", not a measured range.
    piezas.push(
      `<path d="M ${PAD_L} ${PAD_T} l -4 7 l 8 0 z" fill="#0f172a"/>`,
      `<path d="M ${W - PAD_R} ${PAD_T + alto} l -7 -4 l 0 8 z" fill="#0f172a"/>`,
    );

    if (p.tituloEjeX) {
      piezas.push(
        `<text x="${PAD_L + ancho / 2}" y="${H - 8}" font-size="11.5" fill="#0f172a" text-anchor="middle" font-weight="600">${p.tituloEjeX}</text>`,
      );
    }
    if (p.tituloEjeY) {
      const cy = PAD_T + alto / 2;
      piezas.push(
        `<text x="13" y="${cy}" font-size="11.5" fill="#0f172a" text-anchor="middle" font-weight="600" transform="rotate(-90 13 ${cy})">${p.tituloEjeY}</text>`,
      );
    }

    return [
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" width="100%" font-family="system-ui, sans-serif">`,
      `<title>${this.describir(p)}</title>`,
      ...piezas,
      '</svg>',
    ].join('');
  },

  describir(p: LineasParams): string {
    const ejes =
      p.tituloEjeY && p.tituloEjeX ? `${p.tituloEjeY} frente a ${p.tituloEjeX}` : 'una magnitud';
    if (p.forma) {
      const texto: Record<Forma, string> = {
        creciente: 'que aumenta de forma constante',
        decreciente: 'que disminuye de forma constante',
        constante: 'que se mantiene igual',
        saturacion: 'que aumenta rápido al principio y luego se estabiliza',
        campana: 'que sube hasta un máximo y después baja',
      };
      return `Gráfica de ${ejes} ${texto[p.forma]}.`;
    }
    const n = p.puntos?.length ?? 0;
    return `Gráfica de ${ejes}, trazada sobre ${n} puntos.`;
  },
};

export default graficaLineas;
