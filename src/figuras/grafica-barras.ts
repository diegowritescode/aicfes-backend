import type { Plantilla, ValidacionFigura } from './types';

/**
 * A bar chart with labelled axes.
 *
 * Common across Matemáticas, Sociales and Ciencias: the question shows
 * a distribution and asks what it says, or what is wrong with how it
 * was drawn. Bars are computed from the values, so a bar can never be
 * the wrong height for its number — which is exactly the error one real
 * item asks the student to spot.
 */

export interface BarrasParams {
  readonly datos: ReadonlyArray<{ readonly etiqueta: string; readonly valor: number }>;
  readonly tituloEjeX?: string;
  readonly tituloEjeY?: string;
  /** Forces the top of the scale; otherwise it comes from the data. */
  readonly maximoEjeY?: number;
  /** Writes each value above its bar. */
  readonly mostrarValores?: boolean;
}

const W = 460;
const H = 300;
const PAD_L = 56;
const PAD_B = 58;
const PAD_T = 28;
const PAD_R = 18;

export const graficaBarras: Plantilla<BarrasParams> = {
  id: 'graficaBarras',

  validar(parametros: unknown): ValidacionFigura {
    const p = parametros as Partial<BarrasParams> | null;
    if (!p || typeof p !== 'object' || !Array.isArray(p.datos)) {
      return { valida: false, error: 'datos debe ser un arreglo' };
    }
    if (p.datos.length < 2 || p.datos.length > 10) {
      return { valida: false, error: 'la gráfica necesita entre 2 y 10 barras' };
    }
    for (const d of p.datos) {
      if (!d || typeof d.etiqueta !== 'string' || !d.etiqueta.trim()) {
        return { valida: false, error: 'cada barra necesita una etiqueta' };
      }
      if (typeof d.valor !== 'number' || !Number.isFinite(d.valor) || d.valor < 0) {
        return { valida: false, error: `valor inválido para «${d.etiqueta}»` };
      }
    }
    if (p.datos.every((d) => d.valor === 0)) {
      return { valida: false, error: 'todos los valores son cero: no hay nada que leer' };
    }
    if (p.maximoEjeY !== undefined) {
      const mayor = Math.max(...p.datos.map((d) => d.valor));
      if (typeof p.maximoEjeY !== 'number' || p.maximoEjeY < mayor) {
        return { valida: false, error: 'maximoEjeY no puede ser menor que el valor más alto' };
      }
    }
    return { valida: true };
  },

  dibujar(p: BarrasParams): string {
    const mayor = Math.max(...p.datos.map((d) => d.valor));
    // Round the top up to something a reader can divide: ticks land on
    // whole numbers rather than on 7.3333.
    const bruto = p.maximoEjeY ?? mayor;
    const paso = Math.pow(10, Math.floor(Math.log10(bruto || 1)));
    const tope = p.maximoEjeY ?? Math.ceil(bruto / paso) * paso;

    const anchoUtil = W - PAD_L - PAD_R;
    const altoUtil = H - PAD_T - PAD_B;
    const ranura = anchoUtil / p.datos.length;
    const anchoBarra = Math.min(ranura * 0.62, 64);

    const piezas: string[] = [];

    // Horizontal guides, five of them, labelled.
    const divisiones = 5;
    for (let i = 0; i <= divisiones; i += 1) {
      const v = (tope / divisiones) * i;
      const y = PAD_T + altoUtil - (altoUtil / divisiones) * i;
      piezas.push(
        `<line x1="${PAD_L}" y1="${y}" x2="${W - PAD_R}" y2="${y}" stroke="#e2e8f0" stroke-width="1"/>`,
        `<text x="${PAD_L - 10}" y="${y + 4}" font-size="12" fill="#64748b" text-anchor="end">${Number.isInteger(v) ? v : v.toFixed(1)}</text>`,
      );
    }

    p.datos.forEach((d, i) => {
      const alto = tope === 0 ? 0 : (d.valor / tope) * altoUtil;
      const x = PAD_L + ranura * i + (ranura - anchoBarra) / 2;
      const y = PAD_T + altoUtil - alto;
      piezas.push(
        `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${anchoBarra.toFixed(1)}" height="${alto.toFixed(1)}" fill="#0A6CBF" rx="3"/>`,
      );
      if (p.mostrarValores) {
        piezas.push(
          `<text x="${(x + anchoBarra / 2).toFixed(1)}" y="${(y - 7).toFixed(1)}" font-size="12" fill="#0f172a" text-anchor="middle" font-weight="600">${d.valor}</text>`,
        );
      }
      piezas.push(
        `<text x="${(x + anchoBarra / 2).toFixed(1)}" y="${H - PAD_B + 20}" font-size="12" fill="#334155" text-anchor="middle">${d.etiqueta}</text>`,
      );
    });

    // Axes last, so they sit above the guides.
    piezas.push(
      `<line x1="${PAD_L}" y1="${PAD_T}" x2="${PAD_L}" y2="${PAD_T + altoUtil}" stroke="#0f172a" stroke-width="2"/>`,
      `<line x1="${PAD_L}" y1="${PAD_T + altoUtil}" x2="${W - PAD_R}" y2="${PAD_T + altoUtil}" stroke="#0f172a" stroke-width="2"/>`,
    );

    if (p.tituloEjeX) {
      piezas.push(
        `<text x="${PAD_L + anchoUtil / 2}" y="${H - 8}" font-size="12.5" fill="#0f172a" text-anchor="middle" font-weight="600">${p.tituloEjeX}</text>`,
      );
    }
    if (p.tituloEjeY) {
      piezas.push(
        `<text x="14" y="${PAD_T + altoUtil / 2}" font-size="12.5" fill="#0f172a" text-anchor="middle" font-weight="600" transform="rotate(-90 14 ${PAD_T + altoUtil / 2})">${p.tituloEjeY}</text>`,
      );
    }

    return [
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" width="100%" font-family="system-ui, sans-serif">`,
      `<title>${this.describir(p)}</title>`,
      ...piezas,
      '</svg>',
    ].join('');
  },

  describir(p: BarrasParams): string {
    const partes = p.datos.map((d) => `${d.etiqueta}: ${d.valor}`).join('; ');
    const eje = p.tituloEjeY ? ` en ${p.tituloEjeY}` : '';
    return `Gráfica de barras${eje}. ${partes}.`;
  },
};

export default graficaBarras;
