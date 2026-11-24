import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  ModeracionGuard,
  SoloSecretoGuard,
} from '../src/common/guards/moderacion.guard';

/**
 * Who may read a queue of minors' reports.
 *
 * Two ways in, and the difference between them is the point (ADR 34):
 * the role is the everyday one and records who acted, the secret
 * grants the role and nothing else.
 *
 * The property easiest to get backwards is still the first one: with
 * no secret configured the queue must be **closed**. Open-when-unset
 * leaks the whole queue the first time someone deploys without the
 * variable, silently.
 */

function guard(opciones: {
  token?: string;
  esModerador?: boolean | null;
}): ModeracionGuard {
  const config = { get: () => opciones.token } as any;
  const prisma = {
    user: {
      findUnique: async () =>
        opciones.esModerador === null || opciones.esModerador === undefined
          ? null
          : { esModerador: opciones.esModerador },
    },
  } as any;
  return new ModeracionGuard(config, prisma);
}

function peticion(opciones: { cabecera?: string; userId?: string } = {}) {
  const req: Record<string, unknown> = {
    headers: opciones.cabecera === undefined ? {} : { 'x-moderacion-token': opciones.cabecera },
  };
  if (opciones.userId) req.userId = opciones.userId;
  return { switchToHttp: () => ({ getRequest: () => req }), req } as any;
}

test('sin token configurado, la cola está cerrada', async () => {
  // The defect this prevents would leak the queue silently.
  assert.equal(await guard({}).canActivate(peticion({ cabecera: 'lo-que-sea' })), false);
  assert.equal(await guard({ token: '' }).canActivate(peticion({ cabecera: 'x' })), false);
  assert.equal(await guard({ token: '   ' }).canActivate(peticion({ cabecera: '   ' })), false);
});

test('un moderador entra con su sesión, sin pegar nada', async () => {
  /* The everyday path. Before the role existed, a moderator had to
     keep the shared secret on their phone. */
  const g = guard({ token: 'secreto-largo-123', esModerador: true });
  assert.equal(await g.canActivate(peticion({ userId: 'u1' })), true);
});

test('un estudiante cualquiera no entra', async () => {
  const g = guard({ token: 'secreto-largo-123', esModerador: false });
  assert.equal(await g.canActivate(peticion({ userId: 'u1' })), false);
});

test('una sesión que ya no existe no entra', async () => {
  const g = guard({ token: 'secreto-largo-123', esModerador: null });
  assert.equal(await g.canActivate(peticion({ userId: 'borrado' })), false);
});

test('el guard anota quién actuó', async () => {
  /* A shared secret cannot answer "who did this". With two
     moderators that is the first thing missing, and it is why the
     role exists. */
  const g = guard({ token: 'secreto-largo-123', esModerador: true });
  const p = peticion({ userId: 'u1' });
  await g.canActivate(p);
  assert.equal(p.req.moderadorId, 'u1');
});

test('el secreto sigue abriendo la cola', async () => {
  /* Kept as a way in so that losing access to the account does not
     lock the only moderator out of a queue minors are reporting to. */
  const g = guard({ token: 'secreto-largo-123' });
  assert.equal(await g.canActivate(peticion({ cabecera: 'secreto-largo-123' })), true);
});

test('con el token equivocado, no pasa', async () => {
  const g = guard({ token: 'secreto-largo-123' });
  assert.equal(await g.canActivate(peticion({ cabecera: 'otro' })), false);
  assert.equal(await g.canActivate(peticion()), false);
});

test('un token de otro largo no rompe la comparación', async () => {
  /* `timingSafeEqual` throws on a length mismatch, so both sides are
     hashed first. Without that, a short token would surface as a 500
     and the error would tell the caller the length was wrong. */
  const g = guard({ token: 'secreto-largo-123' });
  assert.equal(await g.canActivate(peticion({ cabecera: 'x' })), false);
});

test('el espacio alrededor del secreto no cuenta', async () => {
  /* An env var pasted with a trailing newline must not lock out the
     only moderator. */
  const g = guard({ token: '  secreto-largo-123  ' });
  assert.equal(await g.canActivate(peticion({ cabecera: 'secreto-largo-123' })), true);
});

test('otorgar el rol NO lo autoriza el rol', async () => {
  /* The single most important line here. A moderator who could
     appoint other moderators turns one compromised account into every
     account. */
  const base = guard({ token: 'secreto-largo-123', esModerador: true });
  const soloSecreto = new SoloSecretoGuard(base);

  assert.equal(soloSecreto.canActivate(peticion({ userId: 'u1' })), false);
  assert.equal(
    soloSecreto.canActivate(peticion({ userId: 'u1', cabecera: 'secreto-largo-123' })),
    true,
  );
});
