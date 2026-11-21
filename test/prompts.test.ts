import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { IDS_PLANTILLA } from '../src/figuras/registro';

/**
 * The prompts are the one part of the system with no compiler. These
 * catch the two ways they go wrong: naming a template that does not
 * exist, and telling the model to format JSON the API already
 * constrains.
 */

const AREAS = readdirSync('prompts').filter((d) => !d.startsWith('.'));
const leer = (area: string, archivo: string) =>
  readFileSync(join('prompts', area, archivo), 'utf-8');

test('every area has both prompts', () => {
  assert.ok(AREAS.length >= 5, 'the five exam areas');
  for (const area of AREAS) {
    assert.ok(leer(area, 'developer.txt').length > 200, `${area} developer`);
    assert.ok(leer(area, 'user_template.txt').length > 50, `${area} template`);
  }
});

test('no prompt names a template that does not exist', () => {
  // A prompt offering "diagramaDeVenn" produces items the schema then
  // rejects, and the failure reads as a model problem.
  for (const area of AREAS) {
    const texto = leer(area, 'developer.txt');
    // Only camelCase words: the prose says "montaje" and "tabla" as
    // ordinary Spanish, and those are not template names.
    const nombrados = [...texto.matchAll(/\b([a-z]+[A-Z][a-zA-Z]+)\b/g)].map(
      (m) => m[1] as string,
    );
    for (const nombre of nombrados) {
      assert.ok(
        IDS_PLANTILLA.includes(nombre as never),
        `${area} names "${nombre}", which is not a template`,
      );
    }
  }
});

test('no prompt tells the model how to shape its JSON', () => {
  // The API enforces the schema. A prompt that also gives shape rules
  // can only contradict it, as one did by forbidding the wrapper the
  // schema requires.
  for (const area of AREAS) {
    for (const archivo of ['developer.txt', 'user_template.txt']) {
      const texto = leer(area, archivo);
      assert.doesNotMatch(texto, /ARRAY JSON|OBJETO JSON|wrapper/i, `${area}/${archivo}`);
    }
  }
});

test('no prompt leaves a heading with nothing under it', () => {
  for (const area of AREAS) {
    const texto = leer(area, 'developer.txt');
    assert.doesNotMatch(texto, /FORMATO DE SALIDA[^\n]*:\s*\n\s*\n/, `${area} has an empty heading`);
  }
});

test('the areas that use figures say so, and the text areas do not oversell them', () => {
  // Three pages of Sociales from different years carried no figure at
  // all, so its prompt must not invite one by default.
  assert.match(leer('MAT', 'developer.txt'), /trianguloRectangulo/);
  assert.match(leer('CN', 'developer.txt'), /montajeExperimental/);
  assert.match(leer('LC', 'developer.txt'), /Casi nunca lleva figura/);
  assert.match(leer('SOC', 'developer.txt'), /rara vez/);
});
