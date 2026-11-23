import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { StartSessionSchema } from '../src/dashboard/dto/start-session.schema';

/**
 * The toll's own study mode.
 *
 * It has to be accepted by the API and present in the enum, and both
 * halves fail quietly. A mode the schema rejects comes back as a 400,
 * and the phone's offline queue then retries five times and discards
 * the work — so a learner who cleared a toll block without data would
 * lose it, and nothing would say so.
 */

function leer(relativa: string): string {
  return readFileSync(path.join(__dirname, '..', relativa), 'utf8');
}

test('la API acepta el modo peaje', () => {
  const r = StartSessionSchema.safeParse({
    mode: 'peaje',
    area: 'MAT',
    startedAt: new Date().toISOString(),
  });
  assert.equal(r.success, true, 'el modo peaje fue rechazado por el esquema');
});

test('los modos que ya existían siguen valiendo', () => {
  for (const mode of ['generacion_libre', 'contrarreloj', 'test']) {
    const r = StartSessionSchema.safeParse({
      mode,
      area: 'MAT',
      startedAt: new Date().toISOString(),
    });
    assert.equal(r.success, true, `${mode} dejó de ser válido`);
  }
});

test('un modo inventado sigue siendo rechazado', () => {
  // The enum is a contract, not a suggestion: a typo in a client
  // should fail here rather than land as a row nobody can group by.
  const r = StartSessionSchema.safeParse({
    mode: 'lo-que-sea',
    area: 'MAT',
    startedAt: new Date().toISOString(),
  });
  assert.equal(r.success, false);
});

test('peaje está en el enum de la base, no sólo en el esquema', () => {
  /* Two places have to agree. Prisma would reject the write with a
     value the database does not know, which the API would surface as a
     500 after the schema had already said yes. */
  const schema = leer('prisma/schema.prisma');
  const enumStudyMode = schema.slice(
    schema.indexOf('enum StudyMode'),
    schema.indexOf('}', schema.indexOf('enum StudyMode')),
  );
  assert.match(enumStudyMode, /\bpeaje\b/, 'falta peaje en el enum StudyMode');

  const migracion = leer('prisma/migrations/20261122230000_modo_peaje/migration.sql');
  assert.match(migracion, /ADD VALUE IF NOT EXISTS 'peaje'/);
});

test('MIXTO no es un área: el esquema sólo acepta las cinco', () => {
  /* Verified against production on 22 nov 2026. The mobile client's
     type says `Area | 'MIXTO'`, and passing MIXTO through meant every
     mixed training run failed to open a session — quietly, because
     nothing read the result. The client now maps it to the area the
     run drew most from. */
  const r = StartSessionSchema.safeParse({
    mode: 'test',
    area: 'MIXTO',
    startedAt: new Date().toISOString(),
  });
  assert.equal(r.success, false, 'MIXTO pasó, y el cliente cuenta con que no');
});
