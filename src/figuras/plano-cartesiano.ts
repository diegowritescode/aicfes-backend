import type { Plantilla, ValidacionFigura } from './types';

/**
 * Points, lines and parabolas on a labelled grid.
 *
 * Matemáticas asks the learner to read a coordinate, find where two
 * lines meet, or recognise a function from its graph. All of those
 * need the same picture, so one template covers them.
 *
 * The axes are drawn from the data's own range rather than a fixed
 * window: a question about points near 100 should not render them
 * crowded into a corner of a -10..10 grid.
 */

export interface Punto {
  readonly x: number;
  readonly y: number;
  /** Shown beside the point, e.g. "P" or "(2, 3)". */
  readonly etiqueta?: string;
}

export interface Funcion {
  /** y = m·x + b */
  readonly tipo: 'recta';
  readonly m: number;
  readonly b: number;
  readonly etiqueta?: string;
}

export interface Parabola {
  /** y = a·x² + b·x + c */
  readonly tipo: 'parabola';
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly etiqueta?: string;
}

export interface PlanoParams {
  readonly puntos?: readonly Punto[];
  readonly funciones?: ReadonlyArray<Funcion | Parabola>;
  /** Window. Derived from the content when omitted. */
  readonly xMin?: number;
  readonly xMax?: number;
  readonly yMin?: number;
  readonly yMax?: number;
}

const W = 340;
const H = 300;
const PAD = 30;

/** A step that lands on 1, 2 or 5 times a power of ten. */
function pasoLegible(rango: number): number {
  const bruto = rango / 8;
  const potencia = Math.pow(10, Math.floor(Math.log10(bruto || 1)));
  const normal = bruto / potencia;
  const escalon = normal <= 1 ? 1 : normal <= 2 ? 2 : normal <= 5 ? 5 : 10;
  return escalon * potencia;
}

function ventana(p: PlanoParams): { xMin: number; xMax: number; yMin: number; yMax: number } {
  if (
    p.xMin !== undefined &&
    p.xMax !== undefined &&
    p.yMin !== undefined &&
    p.yMax !== undefined
  ) {
    return { xMin: p.xMin, xMax: p.xMax, yMin: p.yMin, yMax: p.yMax };
  }

  const xs = (p.puntos ?? []).map((q) => q.x);
  const ys = (p.puntos ?? []).map((q) => q.y);
  // Zero is always in frame: the axes are part of what is being read.
  xs.push(0);
  ys.push(0);

  const span = Math.max(...xs.map(Math.abs), ...ys.map(Math.abs), 5);
  // A margin, so a point never sits on the frame's edge.
  const limite = Math.ceil(span * 1.25);
  return {
    xMin: p.xMin ?? -limite,
    xMax: p.xMax ?? limite,
    yMin: p.yMin ?? -limite,
    yMax: p.yMax ?? limite,
  };
}

export const planoCartesiano: Plantilla<PlanoParams> = {
  id: 'planoCartesiano',

  validar(parametros: unknown): ValidacionFigura {
    const p = parametros as Partial<PlanoParams> | null;
    if (!p || typeof p !== 'object') {
      return { valida: false, error: 'los parámetros deben ser un objeto' };
    }
    if (!p.puntos?.length && !p.funciones?.length) {
      return { valida: false, error: 'se necesita al menos un punto o una función' };
    }
    for (const q of p.puntos ?? []) {
      if (!q || !Number.isFinite(q.x) || !Number.isFinite(q.y)) {
        return { valida: false, error: 'todo punto necesita x e y numéricos' };
      }
    }
    if ((p.puntos?.length ?? 0) > 12) {
      return { valida: false, error: 'más de 12 puntos no se lee' };
    }
    for (const f of p.funciones ?? []) {
      if (f.tipo === 'recta') {
        if (!Number.isFinite(f.m) || !Number.isFinite(f.b)) {
          return { valida: false, error: 'una recta necesita m y b numéricos' };
        }
      } else if (f.tipo === 'parabola') {
        if (!Number.isFinite(f.a) || !Number.isFinite(f.b) || !Number.isFinite(f.c)) {
          return { valida: false, error: 'una parábola necesita a, b y c numéricos' };
        }
        if (f.a === 0) {
          return { valida: false, error: 'una parábola con a = 0 es una recta' };
        }
      } else {
        return { valida: false, error: `tipo de función desconocido` };
      }
    }
    if ((p.funciones?.length ?? 0) > 4) {
      return { valida: false, error: 'más de 4 funciones se superponen' };
    }
    const v = ventana(p as PlanoParams);
    if (v.xMax <= v.xMin || v.yMax <= v.yMin) {
      return { valida: false, error: 'la ventana no tiene área' };
    }
    return { valida: true };
  },

  dibujar(p: PlanoParams): string {
    const { xMin, xMax, yMin, yMax } = ventana(p);
    const ancho = W - PAD * 2;
    const alto = H - PAD * 2;
    const px = (x: number) => PAD + ((x - xMin) / (xMax - xMin)) * ancho;
    // y grows upward in maths and downward in SVG.
    const py = (y: number) => PAD + alto - ((y - yMin) / (yMax - yMin)) * alto;

    const piezas: string[] = [];
    const pasoX = pasoLegible(xMax - xMin);
    const pasoY = pasoLegible(yMax - yMin);

    for (let x = Math.ceil(xMin / pasoX) * pasoX; x <= xMax; x += pasoX) {
      piezas.push(
        `<line x1="${px(x).toFixed(1)}" y1="${PAD}" x2="${px(x).toFixed(1)}" y2="${PAD + alto}" stroke="#eef2f6" stroke-width="1"/>`,
      );
    }
    for (let y = Math.ceil(yMin / pasoY) * pasoY; y <= yMax; y += pasoY) {
      piezas.push(
        `<line x1="${PAD}" y1="${py(y).toFixed(1)}" x2="${PAD + ancho}" y2="${py(y).toFixed(1)}" stroke="#eef2f6" stroke-width="1"/>`,
      );
    }

    // Axes, only where zero is inside the window.
    const x0 = px(0);
    const y0 = py(0);
    if (yMin <= 0 && yMax >= 0) {
      piezas.push(
        `<line x1="${PAD}" y1="${y0.toFixed(1)}" x2="${PAD + ancho}" y2="${y0.toFixed(1)}" stroke="#0f172a" stroke-width="1.6"/>`,
      );
    }
    if (xMin <= 0 && xMax >= 0) {
      piezas.push(
        `<line x1="${x0.toFixed(1)}" y1="${PAD}" x2="${x0.toFixed(1)}" y2="${PAD + alto}" stroke="#0f172a" stroke-width="1.6"/>`,
      );
    }

    // Tick labels, skipping zero so the two axes do not overprint it.
    for (let x = Math.ceil(xMin / pasoX) * pasoX; x <= xMax; x += pasoX) {
      if (Math.abs(x) < pasoX / 2) continue;
      piezas.push(
        `<text x="${px(x).toFixed(1)}" y="${(y0 + 14).toFixed(1)}" font-size="10" fill="#64748b" text-anchor="middle">${+x.toFixed(4)}</text>`,
      );
    }
    for (let y = Math.ceil(yMin / pasoY) * pasoY; y <= yMax; y += pasoY) {
      if (Math.abs(y) < pasoY / 2) continue;
      piezas.push(
        `<text x="${(x0 - 6).toFixed(1)}" y="${(py(y) + 3.5).toFixed(1)}" font-size="10" fill="#64748b" text-anchor="end">${+y.toFixed(4)}</text>`,
      );
    }

    // Curves, sampled across the window and clipped to it.
    const colores = ['#0A6CBF', '#03ACBD', '#B8E62E', '#FFB020'];
    (p.funciones ?? []).forEach((f, i) => {
      const n = 120;
      const partes: string[] = [];
      let dibujando = false;
      for (let k = 0; k <= n; k += 1) {
        const x = xMin + ((xMax - xMin) * k) / n;
        const y = f.tipo === 'recta' ? f.m * x + f.b : f.a * x * x + f.b * x + f.c;
        if (y < yMin || y > yMax || !Number.isFinite(y)) {
          // Leaving the window breaks the path rather than drawing a
          // false segment across the frame.
          dibujando = false;
          continue;
        }
        partes.push(`${dibujando ? 'L' : 'M'} ${px(x).toFixed(1)} ${py(y).toFixed(1)}`);
        dibujando = true;
      }
      if (partes.length > 0) {
        piezas.push(
          `<path d="${partes.join(' ')}" fill="none" stroke="${colores[i % colores.length]}" stroke-width="2.4" stroke-linejoin="round"/>`,
        );
      }
    });

    for (const q of p.puntos ?? []) {
      piezas.push(
        `<circle cx="${px(q.x).toFixed(1)}" cy="${py(q.y).toFixed(1)}" r="4.5" fill="#004884"/>`,
      );
      if (q.etiqueta) {
        piezas.push(
          `<text x="${(px(q.x) + 8).toFixed(1)}" y="${(py(q.y) - 7).toFixed(1)}" font-size="12" fill="#0f172a" font-weight="600">${q.etiqueta}</text>`,
        );
      }
    }

    return [
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" width="100%" font-family="system-ui, sans-serif">`,
      `<title>${this.describir(p)}</title>`,
      ...piezas,
      '</svg>',
    ].join('');
  },

  describir(p: PlanoParams): string {
    const partes: string[] = ['Plano cartesiano'];
    if (p.puntos?.length) {
      const lista = p.puntos
        .map((q) => `${q.etiqueta ? q.etiqueta + ' en ' : ''}(${q.x}, ${q.y})`)
        .join(', ');
      partes.push(`con ${p.puntos.length === 1 ? 'el punto' : 'los puntos'} ${lista}`);
    }
    for (const f of p.funciones ?? []) {
      partes.push(
        f.tipo === 'recta'
          ? `con la recta y = ${f.m}x + ${f.b}`
          : `con la parábola y = ${f.a}x² + ${f.b}x + ${f.c}`,
      );
    }
    return partes.join(', ') + '.';
  },
};

export default planoCartesiano;
