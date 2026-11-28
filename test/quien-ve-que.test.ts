import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  NUNCA_VIAJAN,
  amistadQueManda,
  muestraCaraACara,
  muestraProgreso,
  puedeAbrir,
  relacionCon,
} from '../src/duelos/model/quien-ve-que';

/**
 * What one 16-year-old is allowed to learn about another.
 *
 * The profile a stranger can open is new, and it is the first surface
 * in this app where somebody who is not your friend reads numbers
 * about you. The rule has to be provable without a database, which is
 * why it lives in functions that take booleans.
 *
 * The tests that matter here are the negative ones. A bug that shows
 * too little is a complaint; a bug that shows too much cannot be
 * taken back once a phone has rendered it.
 */

test('un desconocido no ve el progreso por defecto', () => {
  /* The whole point of the opt-in. A new account has
     `progresoPublico: false`, so somebody who merely found you by
     alias gets your name and your description and nothing else. */
  assert.equal(
    muestraProgreso({ esAmigo: false, progresoPublico: false }),
    false,
  );
});

test('un desconocido ve el progreso solo si se encendió', () => {
  assert.equal(
    muestraProgreso({ esAmigo: false, progresoPublico: true }),
    true,
  );
});

test('un amigo ve el progreso aunque esté apagado', () => {
  /* Accepting a friend request IS the consent. Making friends pass
     the public switch too would mean a learner who keeps their
     numbers private has no way to share them with the one person
     they actually duel. */
  assert.equal(
    muestraProgreso({ esAmigo: true, progresoPublico: false }),
    true,
  );
});

test('el cara a cara es solo entre amigos', () => {
  assert.equal(muestraCaraACara({ esAmigo: true }), true);
  assert.equal(muestraCaraACara({ esAmigo: false }), false);
});

const ABIERTO = {
  esAmigo: false,
  aliasBuscable: true,
  tutorAutorizo: true,
  hayBloqueo: false,
  tieneAlias: true,
};

test('un perfil buscable y autorizado se abre', () => {
  assert.equal(puedeAbrir(ABIERTO), true);
});

test('un bloqueo cierra el perfil incluso entre amigos', () => {
  /* People block friends — that is often exactly who they block. A
     block that an existing friendship could override would be no
     block at all. */
  assert.equal(
    puedeAbrir({ ...ABIERTO, esAmigo: true, hayBloqueo: true }),
    false,
  );
});

test('quien apagó la búsqueda no se abre por id', () => {
  /* The hole this closes: search hid them, but anybody holding the id
     from an earlier search could still open the profile. Turning the
     switch off has to work retroactively or it does not work. */
  assert.equal(puedeAbrir({ ...ABIERTO, aliasBuscable: false }), false);
});

test('sin autorización del acudiente no se abre', () => {
  /* Ley 1581 de 2012. Nothing social works before it is declared,
     and this profile is social. */
  assert.equal(puedeAbrir({ ...ABIERTO, tutorAutorizo: false }), false);
});

test('un amigo abre el perfil aunque la búsqueda esté apagada', () => {
  /* Otherwise turning search off would silently break the friend
     list you already have, which is not what that switch says. */
  assert.equal(
    puedeAbrir({
      ...ABIERTO,
      esAmigo: true,
      aliasBuscable: false,
      tutorAutorizo: false,
    }),
    true,
  );
});

test('una cuenta sin alias no se abre para nadie', () => {
  assert.equal(
    puedeAbrir({ ...ABIERTO, esAmigo: true, tieneAlias: false }),
    false,
  );
});

test('la relación distingue quién pidió', () => {
  /* The screen draws a different button for each, and getting this
     backwards offers «Aceptar» on a request the learner sent. */
  assert.equal(
    relacionCon('yo', { estado: 'pendiente', pidioId: 'yo' }),
    'solicitud-enviada',
  );
  assert.equal(
    relacionCon('yo', { estado: 'pendiente', pidioId: 'otro' }),
    'solicitud-recibida',
  );
  assert.equal(relacionCon('yo', { estado: 'aceptada', pidioId: 'otro' }), 'amigos');
  assert.equal(relacionCon('yo', null), 'ninguna');
});

test('una solicitud rechazada deja volver a pedir', () => {
  /* The row survives the rejection. If it read as anything but
     «ninguna», a single rejection would lock the pair out of ever
     being friends. */
  assert.equal(
    relacionCon('yo', { estado: 'rechazada', pidioId: 'yo' }),
    'ninguna',
  );
});

test('con dos filas de amistad, la aceptada manda', () => {
  /* `@@unique` is on the ordered pair, so A→B and B→A can both
     exist: each asked the other at the same time. Reading whichever
     row the planner returned first made a real friend look like a
     pending request — progress hidden, «Enviar solicitud» offered to
     somebody already on the friends list. */
  const filas = [
    { estado: 'pendiente', pidioId: 'yo' },
    { estado: 'aceptada', pidioId: 'otro' },
  ];

  assert.equal(amistadQueManda(filas)?.estado, 'aceptada');
  assert.equal(amistadQueManda([...filas].reverse())?.estado, 'aceptada');
});

test('sin aceptada, manda la pendiente', () => {
  const filas = [
    { estado: 'rechazada', pidioId: 'yo' },
    { estado: 'pendiente', pidioId: 'otro' },
  ];

  assert.equal(amistadQueManda(filas)?.estado, 'pendiente');
});

test('sin filas no hay amistad', () => {
  assert.equal(amistadQueManda([]), null);
});

const FUENTE = readFileSync(
  join(__dirname, '..', 'src', 'duelos', 'perfil-publico.service.ts'),
  'utf8',
);

/** The service with its comments removed, so prose cannot match. */
const CODIGO = FUENTE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

/** The body of `ver`'s returned object, which is what reaches a phone. */
function respuestaDeVer(): string {
  const desde = CODIGO.indexOf('return {\n      ok: true as const,');
  assert.notEqual(desde, -1, 'cambió la forma de la respuesta de ver()');
  return CODIGO.slice(desde, CODIGO.indexOf('\n  }', desde));
}

test('ningún campo identificatorio viaja en la respuesta', () => {
  /* Asserted against what is RETURNED, not against what is selected.
     Two fields have to be read to answer the request at all — the
     timezone, because a streak needs to know when «today» starts for
     the other learner, and `tutorAutorizoEn`, because an unauthorised
     account may not be opened. Reading them is required; sending
     them is the leak. An earlier version of this test asserted on the
     select and failed against correct code for exactly that reason.

     Reads the source because the alternative needs a live database,
     and a stub would pass while the real response leaked. */
  const respuesta = respuestaDeVer();
  for (const campo of NUNCA_VIAJAN) {
    assert.ok(
      !respuesta.includes(campo),
      `el perfil público devuelve ${campo}, que no puede viajar`,
    );
  }
});

test('la zona horaria y la autorización se leen pero no se devuelven', () => {
  /* The positive half: if a refactor stopped reading these, the
     streak would be computed in the wrong day boundary and an
     unauthorised account would become readable — both silent. */
  assert.ok(/timezone:\s*true/.test(CODIGO), 'ya no se lee la zona horaria');
  assert.ok(
    /tutorAutorizoEn:\s*true/.test(CODIGO),
    'ya no se lee la autorización del acudiente',
  );
});

test('las áreas con pocas preguntas no se muestran', () => {
  /* One lucky answer is not «100% en Matemáticas». Showing that to a
     stranger is a lie about the learner in both directions. */
  assert.ok(
    /MINIMO_PREGUNTAS_POR_AREA/.test(CODIGO),
    'se quitó el mínimo de preguntas por área',
  );
  assert.ok(
    /questions\s*>=\s*MINIMO_PREGUNTAS_POR_AREA/.test(CODIGO),
    'el mínimo ya no filtra las áreas',
  );
});
