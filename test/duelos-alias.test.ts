import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  esVisibleEnBusqueda,
  validarAlias,
  LARGO_MAXIMO,
} from '../src/duelos/model/alias';

/**
 * Alias rules.
 *
 * Alias search was chosen over invitation codes knowing it lets any
 * learner find any other, with an audience of 16-18. These assertions
 * are what stands between that choice and its worst version.
 */

test('normaliza antes de aceptar', () => {
  const r = validarAlias('  Camilo  ');
  assert.equal(r.ok, true);
  assert.equal(r.ok && r.alias, 'camilo');
});

test('dos escrituras del mismo nombre dan el mismo alias', () => {
  /* The unique index is on the stored value, so normalising here is
     what makes it case-insensitive. Two accounts a classmate cannot
     tell apart would make an invitation land on the wrong person. */
  const a = validarAlias('CAMILO');
  const b = validarAlias('camilo');
  assert.equal(a.ok && a.alias, b.ok && b.alias);
});

test('rechaza tildes y espacios', () => {
  // `camilo` and `camiló` are confusable at a glance on a phone.
  assert.equal(validarAlias('camiló').ok, false);
  assert.equal(validarAlias('cami lo').ok, false);
});

test('rechaza nombres que suplantan al producto', () => {
  for (const nombre of ['aicfes', 'Soporte', 'MODERADOR']) {
    const r = validarAlias(nombre);
    assert.equal(r.ok, false, nombre);
    assert.equal(!r.ok && r.motivo, 'reservado');
  }
});

test('rechaza un alias de pura puntuación', () => {
  // Passes the character check and cannot be said out loud.
  const r = validarAlias('..._');
  assert.equal(r.ok, false);
  assert.equal(!r.ok && r.motivo, 'solo_puntuacion');
});

test('respeta los dos extremos de largo', () => {
  assert.equal(validarAlias('ab').ok, false);
  assert.equal(validarAlias('abc').ok, true);
  assert.equal(validarAlias('a'.repeat(LARGO_MAXIMO)).ok, true);
  assert.equal(validarAlias('a'.repeat(LARGO_MAXIMO + 1)).ok, false);
});

test('cada rechazo trae un mensaje para el estudiante', () => {
  for (const entrada of ['', 'ab', 'a'.repeat(99), 'camiló', '...', 'admin']) {
    const r = validarAlias(entrada);
    assert.equal(r.ok, false, entrada);
    assert.ok(!r.ok && r.mensaje.length > 0, entrada);
  }
});

/**
 * Searchability. The condition that matters legally is the guardian's
 * authorisation: Ley 1581 de 2012 requires it to process a minor's
 * personal data, and an alias strangers can search for is that.
 */

const AUTORIZADO = new Date('2026-11-01T00:00:00Z');

test('sin autorización del acudiente no aparece, aunque tenga alias', () => {
  assert.equal(
    esVisibleEnBusqueda({ alias: 'camilo', aliasBuscable: true, tutorAutorizoEn: null }),
    false,
  );
});

test('la migración no expone a nadie', () => {
  /* `aliasBuscable` defaults to true for existing rows, which would be
     alarming on its own. It is safe only because `tutorAutorizoEn` is
     null for every one of them and is checked first. This test is here
     so that ordering cannot be changed without someone noticing. */
  assert.equal(
    esVisibleEnBusqueda({ alias: null, aliasBuscable: true, tutorAutorizoEn: null }),
    false,
  );
});

test('el estudiante puede apagar la búsqueda sin perder el alias', () => {
  assert.equal(
    esVisibleEnBusqueda({ alias: 'camilo', aliasBuscable: false, tutorAutorizoEn: AUTORIZADO }),
    false,
  );
  assert.equal(
    esVisibleEnBusqueda({ alias: 'camilo', aliasBuscable: true, tutorAutorizoEn: AUTORIZADO }),
    true,
  );
});

test('sin alias no aparece ni con todo lo demás en orden', () => {
  assert.equal(
    esVisibleEnBusqueda({ alias: null, aliasBuscable: true, tutorAutorizoEn: AUTORIZADO }),
    false,
  );
});
