import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  IDS_PLANTILLA,
  describirFigura,
  dibujarFigura,
  validarFigura,
} from '../src/figuras/registro';
import { FIGURA_JSON_SCHEMA } from '../src/figuras/figura.json-schema';

/** The schema is a union now, one branch per template. */
const ramas = FIGURA_JSON_SCHEMA.anyOf as unknown as ReadonlyArray<{
  description?: string;
  properties: { plantilla: { enum: readonly string[] } };
}>;
const nombresOfrecidos = ramas.map((r) => r.properties.plantilla.enum[0]);

test('every template is reachable by name', () => {
  assert.equal(IDS_PLANTILLA.length, 6);
  for (const id of IDS_PLANTILLA) {
    assert.ok(nombresOfrecidos.includes(id), `${id} offered`);
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
  // The description moved onto each branch when the schema became a
  // union: a template now carries its own, beside its parameters.
  for (const id of IDS_PLANTILLA) {
    const rama = ramas.find((r) => r.properties.plantilla.enum[0] === id);
    assert.ok(rama, `${id} has a branch`);
    assert.ok(rama!.description && rama!.description.length > 20, `${id} is described`);
  }
  // The ladder is the case most likely to be asked for by another name.
  const triangulo = ramas.find(
    (r) => r.properties.plantilla.enum[0] === 'trianguloRectangulo',
  );
  assert.match(triangulo!.description!, /escaleras/);
});

test('rejects a spec that is not an object at all', () => {
  for (const malo of [null, 'triangulo', 42, []]) {
    assert.equal(validarFigura(malo).valida, false, `${JSON.stringify(malo)} rejected`);
  }
});
