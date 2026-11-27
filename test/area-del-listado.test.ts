import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { AREAS } from '../src/dashboard/utils/dashboard-math';

/**
 * `GET /api/items?area=X` must reject an unknown area, not break on it.
 *
 * The handler used to write `area as any`, which handed Prisma whatever
 * arrived in the query string. The column is an enum, so an unknown value
 * raised a driver error that Nest returned as a 500 — and a 500 tells the
 * caller the server is broken when the truth is that the request was
 * wrong. `?area=matematicas` is a plain mistake, and the reply has to say
 * whose mistake it is.
 *
 * These read the source rather than call the handler. The route is behind
 * `SesionRequeridaGuard`, so exercising it needs a Nest context, a request
 * with a session and a database; a stub of all three would be more
 * fragile than the six lines it guards, and would pass while the real
 * route was still casting.
 */

const FUENTE = readFileSync(
  join(__dirname, '..', 'src', 'items', 'items.controller.ts'),
  'utf8',
);

/**
 * Just the body of `listItems`, with its comments stripped.
 *
 * The comments have to go, and finding that out cost a run: the comment
 * that explains why `area as any` was wrong contains the words `area as
 * any`, so the first version of this test failed against the fixed code
 * and blamed its own documentation. A guard that reads source has to read
 * the code and nothing else.
 */
function cuerpoDeListItems(): string {
  const desde = FUENTE.indexOf('async listItems(');
  assert.notEqual(desde, -1, 'listItems ya no se llama así: actualiza este test');
  const resto = FUENTE.slice(desde);
  /* The next decorated method ends it. The file has more handlers after. */
  const hasta = resto.indexOf('\n  @');
  const cuerpo = hasta === -1 ? resto : resto.slice(0, hasta);

  return cuerpo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

test('el área no se castea a any: se comprueba', () => {
  const cuerpo = cuerpoDeListItems();

  assert.ok(
    !/area as any/.test(cuerpo),
    '`area as any` volvió: un área desconocida vuelve a dar 500 en vez de 400',
  );
  assert.ok(
    /AREAS/.test(cuerpo),
    'listItems ya no consulta AREAS, así que nada comprueba el área',
  );
});

test('un área desconocida se responde 400, no 500', () => {
  const cuerpo = cuerpoDeListItems();

  assert.ok(
    /HttpStatus\.BAD_REQUEST/.test(cuerpo),
    'el área inválida ya no responde 400',
  );
  assert.ok(
    /AREA_INVALIDA/.test(cuerpo),
    'el código de error AREA_INVALIDA desapareció: el cliente no puede distinguirlo',
  );
});

test('el límite no numérico no llega a Prisma como NaN', () => {
  const cuerpo = cuerpoDeListItems();

  assert.ok(
    /Number\.isFinite/.test(cuerpo),
    '`parseInt` sin comprobar: ?limit=abc manda take: NaN y da 500',
  );
});

test('la lista de áreas que se comprueba es la única que hay', () => {
  /* If AREAS and the enum in the schema ever drift, the handler would
     refuse an area the database accepts, or accept one it rejects. */
  const esquema = readFileSync(
    join(__dirname, '..', 'prisma', 'schema.prisma'),
    'utf8',
  );

  for (const area of AREAS) {
    assert.ok(
      esquema.includes(area),
      `el área ${area} está en AREAS pero no en schema.prisma`,
    );
  }
});
