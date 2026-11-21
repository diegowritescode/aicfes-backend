import type { Plantilla, ValidacionFigura } from './types';

/**
 * A laboratory setup: containers with labelled contents, and the
 * conditions each one is under.
 *
 * Ciencias Naturales asks the learner to compare treatments and say
 * what the experiment shows. The picture is always the same kind of
 * thing — several vessels side by side, each with a level, a label
 * and a condition — so it draws from a list rather than needing an
 * illustration per question.
 */

export type Recipiente = 'vaso' | 'tubo' | 'matraz';

export interface Montaje {
  /** What the vessel is called, e.g. "Montaje 1" or "Control". */
  readonly nombre: string;
  readonly tipo?: Recipiente;
  /** How full it is, 0 to 1. */
  readonly nivel?: number;
  /** What is in it, written below the vessel. */
  readonly contenido?: string;
  /** The condition it is under, written above it. */
  readonly condicion?: string;
}

export interface MontajeParams {
  readonly montajes: readonly Montaje[];
}

const ALTO = 240;
const ANCHO_CELDA = 112;
const CUERPO_ALTO = 96;

function dibujarRecipiente(tipo: Recipiente, cx: number, base: number, nivel: number): string[] {
  const piezas: string[] = [];
  const h = CUERPO_ALTO;
  const relleno = Math.max(0, Math.min(1, nivel)) * (h - 8);

  if (tipo === 'tubo') {
    const w = 26;
    const x = cx - w / 2;
    const y = base - h;
    piezas.push(
      `<path d="M ${x} ${y} L ${x} ${base - w / 2} A ${w / 2} ${w / 2} 0 0 0 ${x + w} ${base - w / 2} L ${x + w} ${y}" fill="#ffffff" stroke="#334155" stroke-width="2"/>`,
    );
    if (relleno > 0) {
      const yl = base - relleno;
      piezas.push(
        `<path d="M ${x + 1.5} ${Math.max(yl, y + 2)} L ${x + 1.5} ${base - w / 2} A ${w / 2 - 1.5} ${w / 2 - 1.5} 0 0 0 ${x + w - 1.5} ${base - w / 2} L ${x + w - 1.5} ${Math.max(yl, y + 2)} Z" fill="#0A6CBF" fill-opacity="0.35"/>`,
      );
    }
    return piezas;
  }

  if (tipo === 'matraz') {
    const wTop = 18;
    const wBase = 58;
    const cuello = 30;
    const y = base - h;
    piezas.push(
      `<path d="M ${cx - wTop / 2} ${y} L ${cx - wTop / 2} ${y + cuello} L ${cx - wBase / 2} ${base} L ${cx + wBase / 2} ${base} L ${cx + wTop / 2} ${y + cuello} L ${cx + wTop / 2} ${y} Z" fill="#ffffff" stroke="#334155" stroke-width="2"/>`,
    );
    if (relleno > 0) {
      // Clipped to the flask outline, so liquid never spills past glass.
      const yl = base - Math.min(relleno, h - cuello - 2);
      const anchoEn = (yy: number) =>
        wTop + ((wBase - wTop) * (yy - (y + cuello))) / (h - cuello);
      const w = anchoEn(yl);
      piezas.push(
        `<path d="M ${cx - w / 2} ${yl} L ${cx - wBase / 2 + 1.5} ${base - 1.5} L ${cx + wBase / 2 - 1.5} ${base - 1.5} L ${cx + w / 2} ${yl} Z" fill="#0A6CBF" fill-opacity="0.35"/>`,
      );
    }
    return piezas;
  }

  // vaso
  const w = 54;
  const x = cx - w / 2;
  const y = base - h;
  piezas.push(
    `<path d="M ${x} ${y} L ${x} ${base} L ${x + w} ${base} L ${x + w} ${y}" fill="#ffffff" stroke="#334155" stroke-width="2"/>`,
  );
  if (relleno > 0) {
    piezas.push(
      `<rect x="${x + 1.5}" y="${base - relleno}" width="${w - 3}" height="${relleno - 1.5}" fill="#0A6CBF" fill-opacity="0.35"/>`,
    );
  }
  return piezas;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export const montajeExperimental: Plantilla<MontajeParams> = {
  id: 'montajeExperimental',

  validar(parametros: unknown): ValidacionFigura {
    const p = parametros as Partial<MontajeParams> | null;
    if (!p || !Array.isArray(p.montajes)) {
      return { valida: false, error: 'montajes debe ser un arreglo' };
    }
    if (p.montajes.length < 2 || p.montajes.length > 5) {
      // One vessel is not an experiment: there is nothing to compare.
      return { valida: false, error: 'un montaje comparativo lleva de 2 a 5 recipientes' };
    }
    for (const m of p.montajes) {
      if (!m || typeof m.nombre !== 'string' || !m.nombre.trim()) {
        return { valida: false, error: 'cada recipiente necesita un nombre' };
      }
      if (m.tipo && !['vaso', 'tubo', 'matraz'].includes(m.tipo)) {
        return { valida: false, error: `tipo de recipiente desconocido: ${m.tipo}` };
      }
      if (m.nivel !== undefined && (!Number.isFinite(m.nivel) || m.nivel < 0 || m.nivel > 1)) {
        return { valida: false, error: `nivel fuera de 0 a 1 en «${m.nombre}»` };
      }
    }
    return { valida: true };
  },

  dibujar(p: MontajeParams): string {
    const n = p.montajes.length;
    const ancho = ANCHO_CELDA * n;
    const base = ALTO - 74;
    const piezas: string[] = [];

    p.montajes.forEach((m, i) => {
      const cx = ANCHO_CELDA * i + ANCHO_CELDA / 2;

      if (m.condicion) {
        piezas.push(
          `<text x="${cx}" y="26" font-size="11.5" fill="#004884" text-anchor="middle" font-weight="600">${esc(m.condicion)}</text>`,
        );
      }
      piezas.push(...dibujarRecipiente(m.tipo ?? 'vaso', cx, base, m.nivel ?? 0.6));
      // The bench, so the vessels read as standing on something.
      piezas.push(
        `<line x1="${cx - 40}" y1="${base}" x2="${cx + 40}" y2="${base}" stroke="#94a3b8" stroke-width="2.5"/>`,
      );
      piezas.push(
        `<text x="${cx}" y="${base + 22}" font-size="12.5" fill="#0f172a" text-anchor="middle" font-weight="600">${esc(m.nombre)}</text>`,
      );
      if (m.contenido) {
        piezas.push(
          `<text x="${cx}" y="${base + 39}" font-size="11" fill="#475569" text-anchor="middle">${esc(m.contenido)}</text>`,
        );
      }
    });

    return [
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ancho} ${ALTO}" role="img" width="100%" font-family="system-ui, sans-serif">`,
      `<title>${esc(this.describir(p))}</title>`,
      ...piezas,
      '</svg>',
    ].join('');
  },

  describir(p: MontajeParams): string {
    const partes = p.montajes.map((m) => {
      const trozos = [m.nombre];
      if (m.contenido) trozos.push(`con ${m.contenido}`);
      if (m.condicion) trozos.push(`a ${m.condicion}`);
      if (m.nivel !== undefined) trozos.push(`lleno al ${Math.round(m.nivel * 100)}%`);
      return trozos.join(', ');
    });
    return `Montaje experimental con ${p.montajes.length} recipientes. ${partes.join('. ')}.`;
  },
};

export default montajeExperimental;
