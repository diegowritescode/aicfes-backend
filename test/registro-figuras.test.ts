import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  FIGURA_JSON_SCHEMA,
  IDS_PLANTILLA,
  describirFigura,
  dibujarFigura,
  validarFigura,
} from '../src/figuras/registro';

test('every template is reachable by name', () => {
  assert.equal(IDS_PLANTILLA.length, 6);
  for (const id of IDS_PLANTILLA) {
    assert.ok(FIGURA_JSON_SCHEMA.properties.plantilla.enum.includes(id), `${id} offered`);
  }
});

test('an invented template name is rejected with the real ones listed', () => {
  const r = validarFigura({ plantilla: 'diagramaDeVenn', parametros: {} });
  assert.equal(r.valida, false);
  assert.match(r.error ?? '', /Disponibles/);
  assert.match(r.error ?? '', /trianguloRectangulo/);
});

test('a template with impossible parameters is rejected', () => {
  // The name is right, the numbers are not: a figure nobody can read
  // makes the question unanswerable, like a wrong answer does.
  const r = validarFigura({ plantilla: 'trianguloRectangulo', parametros: { altura: 0, base: 3 } });
  assert.equal(r.valida, false);
});

test('a valid spec validates, draws and describes itself', () => {
  const spec = {
    plantilla: 'trianguloRectangulo' as const,
    parametros: { altura: 4, base: 3, etiquetaAltura: '4 m', etiquetaBase: '3 m' },
  };
  assert.equal(validarFigura(spec).valida, true);
  const svg = dibujarFigura(spec);
  assert.match(svg, /^<svg/);
  assert.ok(svg.includes('>4 m<'));
  assert.match(describirFigura(spec), /triángulo rectángulo/i);
});

test('an explicit alt text overrides the generated one', () => {
  const d = describirFigura({
    plantilla: 'graficaBarras',
    parametros: { datos: [{ etiqueta: 'a', valor: 1 }, { etiqueta: 'b', valor: 2 }] },
    alt: 'Una descripción escrita a mano',
  });
  assert.equal(d, 'Una descripción escrita a mano');
});

test('the schema tells the model what each template is for', () => {
  const texto = FIGURA_JSON_SCHEMA.properties.plantilla.description;
  for (const id of IDS_PLANTILLA) {
    assert.ok(texto.includes(id), `${id} is described`);
  }
  // The ladder is the case most likely to be asked for by another name.
  assert.match(texto, /escaleras/);
});

test('rejects a spec that is not an object at all', () => {
  for (const malo of [null, 'triangulo', 42, []]) {
    assert.equal(validarFigura(malo).valida, false, `${JSON.stringify(malo)} rejected`);
  }
});
