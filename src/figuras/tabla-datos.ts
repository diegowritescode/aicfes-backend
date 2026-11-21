import type { Plantilla, ValidacionFigura } from './types';

/**
 * A data table.
 *
 * The most common figure in the official booklets: one page of the 2020
 * Matemáticas session carries two of them. Questions give a table and
 * ask what follows from it, so the cells must match the question
 * exactly — which is the whole argument for drawing rather than pasting.
 *
 * Rendered as SVG rather than HTML so a figure is one kind of thing
 * everywhere: same sizing, same export, same alt text.
 */

export interface TablaParams {
  readonly encabezados: readonly string[];
  readonly filas: ReadonlyArray<readonly string[]>;
  readonly titulo?: string;
}

const COL_MIN = 72;
const ROW_H = 34;
const PAD = 12;
const CHAR_W = 7.4;

export const tablaDatos: Plantilla<TablaParams> = {
  id: 'tablaDatos',

  validar(parametros: unknown): ValidacionFigura {
    const p = parametros as Partial<TablaParams> | null;
    if (!p || typeof p !== 'object') {
      return { valida: false, error: 'los parámetros deben ser un objeto' };
    }
    if (!Array.isArray(p.encabezados) || p.encabezados.length < 2) {
      return { valida: false, error: 'la tabla necesita al menos 2 columnas' };
    }
    if (p.encabezados.length > 6) {
      return { valida: false, error: 'más de 6 columnas no cabe legible' };
    }
    if (!Array.isArray(p.filas) || p.filas.length < 1 || p.filas.length > 12) {
      return { valida: false, error: 'la tabla necesita entre 1 y 12 filas' };
    }
    // A ragged table means the question and the figure disagree about
    // what the data is, which is worse than an ugly drawing.
    for (const [i, fila] of p.filas.entries()) {
      if (!Array.isArray(fila) || fila.length !== p.encabezados.length) {
        return {
          valida: false,
          error: `la fila ${i + 1} tiene ${Array.isArray(fila) ? fila.length : 0} celdas y se esperaban ${p.encabezados.length}`,
        };
      }
      if (fila.some((c) => typeof c !== 'string')) {
        return { valida: false, error: `la fila ${i + 1} tiene celdas que no son texto` };
      }
    }
    return { valida: true };
  },

  dibujar(p: TablaParams): string {
    // Width each column from its widest cell, so nothing is clipped.
    const anchos = p.encabezados.map((h, c) => {
      const masLargo = Math.max(h.length, ...p.filas.map((f) => (f[c] ?? '').length));
      return Math.max(COL_MIN, masLargo * CHAR_W + PAD * 2);
    });

    const ancho = anchos.reduce((a, b) => a + b, 0);
    const tituloAlto = p.titulo ? 30 : 0;
    const alto = tituloAlto + ROW_H * (p.filas.length + 1);

    const piezas: string[] = [];
    if (p.titulo) {
      piezas.push(
        `<text x="${ancho / 2}" y="20" font-size="13.5" font-weight="600" fill="#0f172a" text-anchor="middle">${esc(p.titulo)}</text>`,
      );
    }

    const y0 = tituloAlto;

    // Header band.
    piezas.push(
      `<rect x="0" y="${y0}" width="${ancho}" height="${ROW_H}" fill="#004884"/>`,
    );
    let x = 0;
    p.encabezados.forEach((h, c) => {
      const w = anchos[c] ?? COL_MIN;
      piezas.push(
        `<text x="${x + w / 2}" y="${y0 + ROW_H / 2 + 5}" font-size="13" font-weight="600" fill="#ffffff" text-anchor="middle">${esc(h)}</text>`,
      );
      x += w;
    });

    // Body, banded so a long row is still easy to follow across.
    p.filas.forEach((fila, r) => {
      const y = y0 + ROW_H * (r + 1);
      if (r % 2 === 1) {
        piezas.push(`<rect x="0" y="${y}" width="${ancho}" height="${ROW_H}" fill="#f1f5f9"/>`);
      }
      let cx = 0;
      fila.forEach((celda, c) => {
        const w = anchos[c] ?? COL_MIN;
        piezas.push(
          `<text x="${cx + w / 2}" y="${y + ROW_H / 2 + 5}" font-size="13" fill="#0f172a" text-anchor="middle">${esc(celda)}</text>`,
        );
        cx += w;
      });
    });

    // Grid on top of the fills.
    for (let r = 0; r <= p.filas.length + 1; r += 1) {
      const y = y0 + ROW_H * r;
      piezas.push(`<line x1="0" y1="${y}" x2="${ancho}" y2="${y}" stroke="#cbd5e1" stroke-width="1"/>`);
    }
    let gx = 0;
    for (let c = 0; c <= p.encabezados.length; c += 1) {
      piezas.push(
        `<line x1="${gx}" y1="${y0}" x2="${gx}" y2="${alto}" stroke="#cbd5e1" stroke-width="1"/>`,
      );
      gx += anchos[c] ?? 0;
    }

    return [
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ancho} ${alto}" role="img" width="100%" font-family="system-ui, sans-serif">`,
      `<title>${esc(this.describir(p))}</title>`,
      ...piezas,
      '</svg>',
    ].join('');
  },

  describir(p: TablaParams): string {
    const cabecera = p.encabezados.join(', ');
    const cuerpo = p.filas
      .map((f) => f.map((c, i) => `${p.encabezados[i]}: ${c}`).join(', '))
      .join('. ');
    return `${p.titulo ? p.titulo + '. ' : ''}Tabla con columnas ${cabecera}. ${cuerpo}.`;
  },
};

/** Cell text is data, so it cannot be trusted to be markup-safe. */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default tablaDatos;
