import { test } from 'node:test';
import * as assert from 'assert';
import {
  AVATARES,
  COLORES_DE_AVATAR,
  esAvatarValido,
  esColorValido,
} from '../src/duelos/model/avatares';

/**
 * The avatar catalogue is a boundary, so it is tested like one.
 *
 * The column is free text and the client is not an authority. Every
 * case here is something a crafted request would try, plus the two
 * shapes that a float or a renamed slug would quietly produce.
 */

test('acepta los avatares del catálogo', () => {
  for (const slug of AVATARES) {
    assert.ok(esAvatarValido(slug), `${slug} debería ser válido`);
  }
});

test('rechaza lo que no está en el catálogo', () => {
  for (const malo of [
    'dragon',
    'ZORRO',
    'zorro ',
    '',
    '../../etc/passwd',
    '<script>alert(1)</script>',
    'zorro;DROP TABLE "User"',
  ]) {
    assert.equal(esAvatarValido(malo), false, `${malo} no debería pasar`);
  }
});

test('rechaza lo que no es una cadena', () => {
  for (const malo of [null, undefined, 3, {}, [], true, () => 'zorro']) {
    assert.equal(esAvatarValido(malo), false);
  }
});

test('los slugs son únicos', () => {
  assert.equal(new Set(AVATARES).size, AVATARES.length);
});

test('los slugs son seguros para una URL y para la columna', () => {
  for (const slug of AVATARES) {
    assert.match(slug, /^[a-z]{3,24}$/, `${slug} debe ser minúsculas sin acentos`);
  }
});

test('hay suficientes para que escoger signifique algo', () => {
  /* Fewer than a dozen and «escoge tu avatar» is a list, not a
     choice: two learners in the same classroom collide immediately. */
  assert.ok(AVATARES.length >= 20, `solo hay ${AVATARES.length}`);
});

test('acepta los colores de la paleta', () => {
  for (let i = 0; i < COLORES_DE_AVATAR; i += 1) {
    assert.ok(esColorValido(i));
  }
});

test('rechaza colores fuera de la paleta', () => {
  for (const malo of [-1, COLORES_DE_AVATAR, 99, 1.5, NaN, Infinity, '3', null, undefined]) {
    assert.equal(esColorValido(malo), false, `${String(malo)} no debería pasar`);
  }
});
