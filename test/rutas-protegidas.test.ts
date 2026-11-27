import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';

/**
 * Which routes must not be reachable anonymously.
 *
 * This reads the controllers as text rather than booting Nest, which
 * is deliberate: the failure being prevented is someone adding a route
 * and forgetting the decorator, and that is visible in the source.
 *
 * It is pinned because the hole was real. `GET /api/items/requests/failed`
 * answered the open internet with `rawModelOutput` — the model's
 * unparsed text, carrying questions, their right answers and their
 * explanations. Verified against production on 22 nov 2026 before it
 * was closed.
 */

function leer(relativa: string): string {
  return readFileSync(path.join(__dirname, '..', relativa), 'utf8');
}

/**
 * The decorators attached to a route.
 *
 * Nest does not care whether `@UseGuards` sits above or below the
 * `@Get`, so this looks both ways: a window before the route for
 * guards written above it, and everything up to the method signature
 * for guards written below. Looking only backwards is how the first
 * version of this test failed on a route that was correctly guarded.
 */
function decoradoresDe(fuente: string, ruta: string): string {
  const indice = fuente.indexOf(ruta);
  assert.ok(indice > 0, `no encontré la ruta ${ruta} en el controlador`);

  const antes = fuente.slice(Math.max(0, indice - 1200), indice);
  /* Forward only to where the method itself starts: past that we would
     be reading the next route's decorators and a missing guard would
     pass. */
  const resto = fuente.slice(indice + ruta.length);
  const finMetodo = resto.search(/\n\s{2}(?:async\s+)?[A-Za-z_$][\w$]*\s*\(/);
  const despues = finMetodo === -1 ? resto.slice(0, 1200) : resto.slice(0, finMetodo);

  return antes + ruta + despues;
}

test('las rutas que exponen el banco exigen sesión', () => {
  const fuente = leer('src/items/items.controller.ts');

  const rutas = [
    "@Get('requests/failed')",
    "@Get('requests')",
    /* The offline pool carries `respuesta_correcta`, because the toll
       marks the attempt on a device with no network. Anonymous access
       to it would hand out answer keys. */
    "@Get('lote-offline')",
    "@Get('requests/:requestId')",
    "@Get('requests/:requestId/status')",
    "@Delete('requests/:requestId/cancel')",
  ];

  for (const ruta of rutas) {
    const contexto = decoradoresDe(fuente, ruta);
    assert.match(
      contexto,
      /@UseGuards\([^)]*SesionRequeridaGuard/,
      `${ruta} quedó sin SesionRequeridaGuard: es alcanzable sin iniciar sesión`,
    );
  }
});

test('la ruta que gasta en el modelo exige sesión y cuota', () => {
  // Identity is the precondition for a quota: there is nobody to meter
  // until we know whose request this is.
  for (const [archivo, ruta] of [
    ['src/items/items.controller.ts', "@Post('generate')"],
    ['src/items/items.controller.ts', "@Post('generate-mixed')"],
    ['src/feedback/feedback.controller.ts', "@Post('generate')"],
    ['src/time-trial/time-trial.controller.ts', "@Post('start')"],
    /* A GET that can write: the weekly report is generated the first
       time somebody asks for it. The verb hides the spend, so the
       guard matters more here than on a POST. */
    ['src/informe/informe.controller.ts', '@Get()'],
  ] as const) {
    const contexto = decoradoresDe(leer(archivo), ruta);
    assert.match(
      contexto,
      /@UseGuards\([^)]*SesionRequeridaGuard/,
      `${archivo} ${ruta} sin SesionRequeridaGuard`,
    );
    assert.match(
      contexto,
      /@UseGuards\([^)]*CuotaGuard/,
      `${archivo} ${ruta} sin CuotaGuard: gasta sin tope`,
    );
  }
});

test('el contrarreloj no acepta una petición sin tope', async () => {
  /* Without a maximum, one request could ask for a hundred thousand
     questions and the quota would not notice until the bill arrived.
     The ceiling has to be on the way in. */
  const { TimeTrialCustomSchema } = await import(
    '../src/time-trial/dto/time-trial-start.schema'
  );

  const base = { area: 'MAT', dificultad: 'media', timeLimitSeconds: 300 };

  assert.equal(TimeTrialCustomSchema.safeParse({ ...base, questions: 8 }).success, true);
  assert.equal(
    TimeTrialCustomSchema.safeParse({ ...base, questions: 100_000 }).success,
    false,
    'un contrarreloj de cien mil preguntas sigue siendo aceptado',
  );
  assert.equal(
    TimeTrialCustomSchema.safeParse({ ...base, timeLimitSeconds: 86_400 }).success,
    false,
    'un contrarreloj de un día entero sigue siendo aceptado',
  );
});
