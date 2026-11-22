import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';

/**
 * Spend has to carry the learner who caused it.
 *
 * CostosService.registrar accepted a userId from the beginning and
 * nothing ever passed one, so production held 55 cost rows and not one
 * of them had an owner. The daily quota reads exactly that column, so
 * it was reading zero for everybody: the cap existed, was tested, and
 * limited nothing.
 *
 * It is the kind of break that passes every unit test — both sides are
 * correct on their own — so the seam is pinned here instead.
 */

const leer = (ruta: string) =>
  readFileSync(path.join(__dirname, '..', ruta), 'utf-8');

test('las dos entradas a OpenAI aceptan el usuario', () => {
  const fuente = leer('src/items/services/openai.service.ts');
  for (const metodo of ['createResponse', 'createStructured']) {
    const inicio = fuente.indexOf(`async ${metodo}`);
    assert.ok(inicio > 0, `${metodo} existe`);
    // Up to the return type, not to the first brace: the parameter
    // list contains braces of its own.
    const firma = fuente.slice(inicio, fuente.indexOf('): Promise<', inicio));
    assert.match(firma, /userId\?: string \| null/, `${metodo} recibe userId`);
  }
});

test('el costo se graba con el usuario, no suelto', () => {
  const fuente = leer('src/items/services/openai.service.ts');
  const inicio = fuente.indexOf('private registrar(');
  const bloque = fuente.slice(inicio, inicio + 600);
  assert.match(bloque, /userId: userId \?\? null/);
});

test('generar, verificar y retroalimentar atribuyen su gasto', () => {
  // The three paths that spend money. Any one of them left out puts
  // part of the bill back into the unowned pile.
  const generador = leer('src/items/services/item-generator.service.ts');
  assert.match(
    generador,
    /createStructured<\{ items: unknown\[\] \}>\([\s\S]{0,300}userId,/,
    'la generación pasa el usuario',
  );
  assert.match(
    generador,
    /verifier\.verify\(validated, userId\)/,
    'la verificación pasa el usuario',
  );

  const verificador = leer('src/items/services/answer-verifier.service.ts');
  assert.match(verificador, /async verify\(item: Item, userId\?: string \| null\)/);

  const feedback = leer('src/feedback/feedback.service.ts');
  assert.match(
    feedback,
    /createResponse\([\s\S]{0,200}userId,/,
    'la retroalimentación pasa el usuario',
  );
});

test('contrarreloj atribuye lo que gasta', () => {
  // It generates several sections per session and was the last path to
  // be joined up.
  const fuente = leer('src/time-trial/time-trial.service.ts');
  assert.match(fuente, /userId\?: string \| null;/, 'la sección lleva usuario');
  assert.match(fuente, /requestId,\s*\n\s*section\.userId,/, 'y lo pasa al generador');
});
