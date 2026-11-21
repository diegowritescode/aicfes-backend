import type { Plantilla, ValidacionFigura } from './types';

/**
 * A right triangle with its sides labelled.
 *
 * One template covers the ladder against the wall, the ramp, the pole's
 * shadow and the tensioned cable: they are the same figure with
 * different nouns, which is exactly why it is worth drawing from
 * parameters instead of storing four pictures.
 */

export interface TrianguloParams {
  /** The vertical side. */
  readonly altura: number;
  /** The horizontal side. */
  readonly base: number;
  /** Labels. The hypotenuse may be left unlabelled when it is the unknown. */
  readonly etiquetaAltura?: string;
  readonly etiquetaBase?: string;
  readonly etiquetaHipotenusa?: string;
  /** Marks the angle at the base, which most questions ask about. */
  readonly mostrarAngulo?: boolean;
  /** Draws a wall and ground, turning the triangle into a ladder scene. */
  readonly contexto?: 'ninguno' | 'escalera' | 'rampa';
}

const W = 420;
const H = 300;
const PAD = 56;

function esFinitoPositivo(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0;
}

export const trianguloRectangulo: Plantilla<TrianguloParams> = {
  id: 'trianguloRectangulo',

  validar(parametros: unknown): ValidacionFigura {
    const p = parametros as Partial<TrianguloParams> | null;
    if (!p || typeof p !== 'object') {
      return { valida: false, error: 'los parámetros deben ser un objeto' };
    }
    if (!esFinitoPositivo(p.altura)) {
      return { valida: false, error: 'altura debe ser un número positivo' };
    }
    if (!esFinitoPositivo(p.base)) {
      return { valida: false, error: 'base debe ser un número positivo' };
    }
    // A side far longer than the other draws as a sliver no one can read.
    const razon = Math.max(p.altura, p.base) / Math.min(p.altura, p.base);
    if (razon > 12) {
      return {
        valida: false,
        error: `la razón entre los lados (${razon.toFixed(1)}) hace la figura ilegible`,
      };
    }
    return { valida: true };
  },

  dibujar(p: TrianguloParams): string {
    // Scale so the longer side fills the frame: the drawing stays
    // readable whether the question says 3 and 4 or 300 and 400.
    const escala = Math.min((W - PAD * 2) / p.base, (H - PAD * 2) / p.altura);
    const b = p.base * escala;
    const a = p.altura * escala;

    const x0 = PAD;
    const y0 = H - PAD;
    const xBase = x0 + b;
    const yTop = y0 - a;

    const hipotenusa = Math.hypot(p.altura, p.base);
    const anguloGrados = (Math.atan2(p.altura, p.base) * 180) / Math.PI;

    const contexto = p.contexto ?? 'ninguno';
    const piezas: string[] = [];

    // Ground, always: it tells the reader which way is down.
    piezas.push(
      `<line x1="${x0 - 24}" y1="${y0}" x2="${xBase + 24}" y2="${y0}" stroke="#94a3b8" stroke-width="2"/>`,
    );
    if (contexto === 'escalera') {
      piezas.push(
        `<line x1="${x0}" y1="${y0}" x2="${x0}" y2="${yTop - 24}" stroke="#94a3b8" stroke-width="2"/>`,
      );
    }

    // The triangle.
    piezas.push(
      `<polygon points="${x0},${y0} ${xBase},${y0} ${x0},${yTop}" fill="#0A6CBF" fill-opacity="0.08" stroke="#004884" stroke-width="2.5" stroke-linejoin="round"/>`,
    );

    // The right angle, as the small square that marks it.
    const m = 14;
    piezas.push(
      `<path d="M ${x0} ${y0 - m} L ${x0 + m} ${y0 - m} L ${x0 + m} ${y0}" fill="none" stroke="#004884" stroke-width="2"/>`,
    );

    if (p.mostrarAngulo) {
      const r = 34;
      const ax = xBase - r;
      const ay = y0;
      const bx = xBase - r * Math.cos((anguloGrados * Math.PI) / 180);
      const by = y0 - r * Math.sin((anguloGrados * Math.PI) / 180);
      piezas.push(
        `<path d="M ${ax} ${ay} A ${r} ${r} 0 0 1 ${bx} ${by}" fill="none" stroke="#03ACBD" stroke-width="2.5"/>`,
        `<text x="${xBase - r - 16}" y="${y0 - 12}" font-size="15" fill="#03ACBD" font-weight="600">θ</text>`,
      );
    }

    const etiqueta = (x: number, y: number, texto: string, anchor = 'middle') =>
      `<text x="${x}" y="${y}" font-size="15" fill="#0f172a" text-anchor="${anchor}" font-family="system-ui, sans-serif">${texto}</text>`;

    piezas.push(etiqueta(x0 + b / 2, y0 + 24, p.etiquetaBase ?? String(p.base)));
    piezas.push(etiqueta(x0 - 12, y0 - a / 2, p.etiquetaAltura ?? String(p.altura), 'end'));
    piezas.push(
      etiqueta(
        x0 + b / 2 + 22,
        y0 - a / 2 - 10,
        p.etiquetaHipotenusa ?? (Number.isInteger(hipotenusa) ? String(hipotenusa) : '?'),
        'start',
      ),
    );

    return [
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" width="100%">`,
      `<title>${this.describir(p)}</title>`,
      ...piezas,
      '</svg>',
    ].join('');
  },

  describir(p: TrianguloParams): string {
    const base = p.etiquetaBase ?? String(p.base);
    const altura = p.etiquetaAltura ?? String(p.altura);
    const escena =
      p.contexto === 'escalera'
        ? 'Una escalera apoyada en una pared formando un triángulo rectángulo'
        : p.contexto === 'rampa'
          ? 'Una rampa que forma un triángulo rectángulo con el suelo'
          : 'Un triángulo rectángulo';
    return `${escena}. La base mide ${base} y la altura ${altura}.`;
  },
};

export default trianguloRectangulo;
