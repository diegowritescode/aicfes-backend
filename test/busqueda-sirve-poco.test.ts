import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * What a search over other learners is allowed to return.
 *
 * These are accounts of 16-to-18-year-olds made with a school email.
 * The search exists so somebody can find a classmate and challenge
 * them, and it carries the description so the person about to send a
 * friend request can tell whether this is who they meant.
 *
 * It must not carry the streak, the wins or the losses. Those are a
 * record of how somebody plays, which they did not write to be found
 * by, and serving them to any account that can type the first two
 * letters of an alias turns this search into a directory of minors'
 * results. They stay behind an accepted friendship, which is what
 * `perfilDeAmigo` is for.
 *
 * Reads the source because the real query needs a database and three
 * fixtures — a searchable alias, a guardian authorisation and a block
 * in each direction — and a stub of that would pass while the live
 * select leaked.
 */

const FUENTE = readFileSync(
  join(__dirname, '..', 'src', 'duelos', 'duelos.service.ts'),
  'utf8',
);

/** The body of `buscar`, comments stripped. */
function cuerpoDeBuscar(): string {
  const desde = FUENTE.indexOf('async buscar(');
  assert.notEqual(desde, -1, 'buscar ya no se llama así');
  const resto = FUENTE.slice(desde);
  const hasta = resto.indexOf('\n  /** Blocks');
  const cuerpo = hasta === -1 ? resto.slice(0, resto.indexOf('\n  async ', 10)) : resto.slice(0, hasta);

  return cuerpo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

test('la búsqueda devuelve alias y descripción', () => {
  const cuerpo = cuerpoDeBuscar();

  assert.match(cuerpo, /alias: true/, 'sin alias no hay nada que reconocer');
  assert.match(
    cuerpo,
    /descripcion: true/,
    'sin descripción no se puede saber si es la persona que se busca',
  );
});

test('la búsqueda no devuelve racha, ganados ni perdidos', () => {
  const cuerpo = cuerpoDeBuscar();

  for (const campo of ['racha', 'ganados', 'perdidos']) {
    assert.ok(
      !new RegExp(`${campo}`).test(cuerpo),
      `${campo} en el select de buscar: eso es solo para amistades aceptadas`,
    );
  }
});

test('la búsqueda no devuelve nada con lo que contactar a nadie', () => {
  const cuerpo = cuerpoDeBuscar();

  /* An email or a guardian's email in a search result is a way to
     reach a minor outside the app entirely. */
  for (const campo of ['email', 'correo', 'tutorEmail', 'telefono']) {
    assert.ok(
      !new RegExp(campo, 'i').test(cuerpo),
      `${campo} en el select de buscar: es una vía de contacto fuera de la app`,
    );
  }
});

test('las tres defensas de la búsqueda siguen puestas', () => {
  const cuerpo = cuerpoDeBuscar();

  /* Each of these is what makes serving anything at all acceptable.
     Losing one silently widens who can be found, and nothing in the
     type system would notice. */
  assert.match(
    cuerpo,
    /aliasBuscable: true/,
    'se perdió el filtro de alias buscable: ahora aparece quien no quiso aparecer',
  );
  assert.match(
    cuerpo,
    /tutorAutorizoEn/,
    'se perdió el filtro de autorización del tutor',
  );
  assert.match(
    cuerpo,
    /invisibles/,
    'se perdió el filtro de bloqueos: un bloqueado vuelve a ser encontrable',
  );
});
