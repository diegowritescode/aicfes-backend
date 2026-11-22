import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { ITEMS_JSON_SCHEMA } from '../src/items/schemas/item.json-schema';
import { IDS_PLANTILLA } from '../src/figuras/registro';

/**
 * The schema we send is checked against OpenAI's strict-mode rules
 * here, because the only other place it gets checked is production.
 *
 * It failed there: `parametros` carried `additionalProperties: true`,
 * every request for an area that may include a figure came back as a
 * 400 before reaching the model, and Matemáticas and Ciencias were
 * simply dead. Sociales and Lectura worked by luck — their prompts
 * never offer a figure.
 *
 * Strict mode requires, for every object in the tree:
 *   - additionalProperties: false
 *   - every property listed in `required`
 */

type Nodo = Record<string, unknown>;

function recorrer(nodo: unknown, ruta: string, visitar: (n: Nodo, ruta: string) => void): void {
  if (!nodo || typeof nodo !== 'object') return;
  if (Array.isArray(nodo)) {
    nodo.forEach((hijo, i) => recorrer(hijo, `${ruta}[${i}]`, visitar));
    return;
  }
  const n = nodo as Nodo;
  if (n.type === 'object') visitar(n, ruta);

  for (const [clave, valor] of Object.entries(n)) {
    recorrer(valor, `${ruta}.${clave}`, visitar);
  }
}

test('todo objeto del esquema prohíbe propiedades extra', () => {
  const faltantes: string[] = [];
  recorrer(ITEMS_JSON_SCHEMA, 'raiz', (nodo, ruta) => {
    if (nodo.additionalProperties !== false) faltantes.push(ruta);
  });
  assert.deepEqual(
    faltantes,
    [],
    `objetos sin additionalProperties:false → ${faltantes.join(', ')}`,
  );
});

test('todo objeto declara required con todas sus propiedades', () => {
  const malos: string[] = [];
  recorrer(ITEMS_JSON_SCHEMA, 'raiz', (nodo, ruta) => {
    const props = Object.keys((nodo.properties as Nodo) ?? {});
    if (props.length === 0) return;
    const required = (nodo.required as string[]) ?? [];
    const sueltas = props.filter((p) => !required.includes(p));
    if (sueltas.length) malos.push(`${ruta}: ${sueltas.join(',')}`);
  });
  assert.deepEqual(malos, [], `propiedades fuera de required → ${malos.join(' | ')}`);
});

test('el esquema ofrece una rama por plantilla, más null', () => {
  const item = (ITEMS_JSON_SCHEMA as any).properties.items.items;
  const ramas = item.properties.figura.anyOf as Nodo[];

  const nombres = ramas
    .filter((r) => r.type === 'object')
    .map((r) => ((r.properties as any).plantilla.enum as string[])[0]);

  assert.deepEqual(
    [...nombres].sort(),
    [...IDS_PLANTILLA].sort(),
    'cada plantilla registrada necesita su rama en el esquema',
  );
  assert.ok(
    ramas.some((r) => r.type === 'null'),
    'un ítem sin figura debe seguir siendo válido',
  );
});

test('una plantilla no puede recibir los parámetros de otra', () => {
  const item = (ITEMS_JSON_SCHEMA as any).properties.items.items;
  const ramas = (item.properties.figura.anyOf as Nodo[]).filter((r) => r.type === 'object');

  const triangulo = ramas.find(
    (r) => ((r.properties as any).plantilla.enum as string[])[0] === 'trianguloRectangulo',
  );
  const params = Object.keys((triangulo as any).properties.parametros.properties);

  assert.ok(params.includes('altura'), 'el triángulo necesita su altura');
  assert.ok(!params.includes('datos'), 'datos pertenece a la gráfica de barras');
});
