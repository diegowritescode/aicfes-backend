import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { DuelosService } from '../src/duelos/duelos.service';

/**
 * Who may read whose profile.
 *
 * The users are minors. Alias search exists so they are found by name
 * and not browsed, and `aliasBuscable` lets them leave that index
 * without losing their alias. A profile endpoint that answered for
 * any id would undo both: the search becomes a directory and the
 * setting stops meaning anything.
 *
 * So the rule is friendship, checked server-side on every read, and
 * these tests are about the cases where it must refuse.
 */

interface Opciones {
  readonly amistad?: unknown;
  /** True to make the account lookup come back empty. */
  readonly sinCuenta?: boolean;
  readonly bloqueo?: unknown;
  readonly otro?: unknown;
  readonly duelos?: unknown[];
}

function servicio(opciones: Opciones = {}) {
  const prisma = {
    amistad: { findFirst: async () => opciones.amistad ?? null },
    bloqueo: { findFirst: async () => opciones.bloqueo ?? null },
    user: {
      /* `sinCuenta` rather than `otro: null`: `null ?? default`
         returns the default, so passing null could not express «the
         account is missing» at all. The first version of this test
         did exactly that and failed on its own stub. */
      findUnique: async () =>
        opciones.sinCuenta
          ? null
          : (opciones.otro ?? { id: 'u2', alias: 'camilo', descripcion: null }),
    },
    duelo: { findMany: async () => opciones.duelos ?? [] },
  };

  return new DuelosService(
    prisma as never,
    null as never,
    null as never,
    null as never,
    null as never,
  );
}

const AMISTAD = {
  id: 'a1',
  resueltaEn: new Date('2026-10-01T00:00:00Z'),
  creadoEn: new Date('2026-09-28T00:00:00Z'),
};

test('sin amistad no se entrega el perfil', async () => {
  /* The whole guard. Without it, any id typed into the URL returns a
     minor's alias and bio. */
  const r = (await servicio().perfilDeAmigo('u1', 'u2')) as { ok: boolean };

  assert.equal(r.ok, false);
});

test('la negativa no confirma que la cuenta exista', async () => {
  /* «That person is not your friend» tells a stranger the account is
     real, which is exactly what someone probing for it wants. The
     message is the same as for a missing account. */
  const sinAmistad = (await servicio().perfilDeAmigo('u1', 'u2')) as {
    error: { code: string; message: string };
  };
  const sinCuenta = (await servicio({
    amistad: AMISTAD,
    sinCuenta: true,
  }).perfilDeAmigo('u1', 'u2')) as { error: { code: string; message: string } };

  assert.equal(sinAmistad.error.code, sinCuenta.error.code);
  assert.equal(sinAmistad.error.message, sinCuenta.error.message);
});

test('un bloqueo en cualquier dirección cierra el perfil', async () => {
  /* Blocking has to work both ways: someone who blocked you should
     not have their profile readable by you, and you should not be
     readable by them. A one-directional check leaves the person who
     blocked still exposed. */
  const r = (await servicio({
    amistad: AMISTAD,
    bloqueo: { id: 'b1' },
  }).perfilDeAmigo('u1', 'u2')) as { ok: boolean };

  assert.equal(r.ok, false);
});

test('con amistad se entrega alias y descripción', async () => {
  const r = (await servicio({ amistad: AMISTAD }).perfilDeAmigo('u1', 'u2')) as {
    ok: boolean;
    data: Record<string, unknown>;
  };

  assert.equal(r.ok, true);
  assert.equal(r.data.alias, 'camilo');
});

test('el perfil no lleva correo ni plan', async () => {
  /* Read by another minor. Every extra field is one more thing that
     cannot be taken back, and nothing on that screen needs these. */
  const r = (await servicio({
    amistad: AMISTAD,
    otro: { id: 'u2', alias: 'camilo', descripcion: 'hola' },
  }).perfilDeAmigo('u1', 'u2')) as { data: Record<string, unknown> };

  assert.equal('email' in r.data, false);
  assert.equal('plan' in r.data, false);
  assert.equal('passwordHash' in r.data, false);
});

test('la racha sale de los duelos terminados entre los dos', async () => {
  const ahora = new Date();
  const r = (await servicio({
    amistad: AMISTAD,
    duelos: [
      { terminadoEn: ahora, ganadorId: 'u1' },
      { terminadoEn: ahora, ganadorId: 'u2' },
    ],
  }).perfilDeAmigo('u1', 'u2')) as {
    data: { racha: { duelos: number }; ganados: number; perdidos: number };
  };

  assert.equal(r.data.racha.duelos, 2);
  assert.equal(r.data.ganados, 1);
  assert.equal(r.data.perdidos, 1);
});

test('un empate no cuenta como ganado ni perdido', async () => {
  /* `ganadorId` is null on a tie, and counting it for either side
     would make the record not add up to the number of duels. */
  const r = (await servicio({
    amistad: AMISTAD,
    duelos: [{ terminadoEn: new Date(), ganadorId: null }],
  }).perfilDeAmigo('u1', 'u2')) as { data: { ganados: number; perdidos: number } };

  assert.equal(r.data.ganados, 0);
  assert.equal(r.data.perdidos, 0);
});

test('sin duelos juntos el perfil sigue abriendo', async () => {
  /* Two people who just became friends have no history, and that is
     a normal state rather than an empty screen. */
  const r = (await servicio({ amistad: AMISTAD }).perfilDeAmigo('u1', 'u2')) as {
    ok: boolean;
    data: { racha: { semanas: number } };
  };

  assert.equal(r.ok, true);
  assert.equal(r.data.racha.semanas, 0);
});
