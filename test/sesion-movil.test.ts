import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { AuthController } from '../src/auth/auth.controller';

/**
 * Where the refresh token is written, and for whom.
 *
 * The rule has two halves and both matter. A browser must keep
 * receiving nothing in the body, because its token lives in an
 * httpOnly cookie where an XSS cannot reach it. A native app must
 * receive it, because it has no cookie jar — and reading only the
 * cookie is why the mobile session expired after seven days and
 * dropped the learner at the sign-in screen with no explanation.
 *
 * Getting either half wrong is silent: the web leaks a credential, or
 * the phone stops refreshing and nobody finds out for a week.
 */

/** The controller with its collaborators stubbed: these tests are
    about one decision, not about signing tokens. */
function controlador(): any {
  return new AuthController({} as any, { get: () => undefined } as any);
}

const datos = {
  userId: 'u1',
  email: 'a@b.co',
  timezone: 'America/Bogota',
  token: 'jwt-de-acceso',
  tokenType: 'Bearer',
  expiresIn: '7d',
  refreshToken: 'el-refresh-secreto',
  refreshTokenExpiresAt: '2027-01-01T00:00:00.000Z',
};

function pedir(cabeceras: Record<string, unknown>): boolean {
  return controlador().esClienteNativo({ headers: cabeceras } as any);
}

test('el móvil se declara y es reconocido', () => {
  assert.equal(pedir({ 'x-cliente': 'movil' }), true);
  // Case and padding are the caller's business, not ours.
  assert.equal(pedir({ 'x-cliente': 'Movil' }), true);
  assert.equal(pedir({ 'x-cliente': '  MOVIL  ' }), true);
});

test('un navegador no es cliente nativo', () => {
  assert.equal(pedir({}), false);
  assert.equal(pedir({ 'x-cliente': 'web' }), false);
  assert.equal(pedir({ 'x-cliente': '' }), false);
  // A header arriving twice must not be read as a match by accident.
  assert.equal(pedir({ 'x-cliente': ['web', 'movil'] }), false);
});

test('el navegador NO recibe el refresh token en el cuerpo', () => {
  /* This is the half that protects the web. If it ever starts
     appearing here, an XSS can read a credential that used to be out
     of JavaScript's reach. */
  const cuerpo = controlador().cuerpoDeSesion(datos, false);
  assert.equal(cuerpo.refreshToken, undefined);
  assert.equal(cuerpo.refreshTokenExpiresAt, undefined);
  assert.equal(
    JSON.stringify(cuerpo).includes('el-refresh-secreto'),
    false,
    'el refresh token apareció en la respuesta de un navegador',
  );
});

test('el móvil SÍ lo recibe, con su vencimiento', () => {
  const cuerpo = controlador().cuerpoDeSesion(datos, true);
  assert.equal(cuerpo.refreshToken, 'el-refresh-secreto');
  assert.equal(cuerpo.refreshTokenExpiresAt, '2027-01-01T00:00:00.000Z');
});

test('lo demás llega igual a los dos', () => {
  // The decision is about one field. A client that stopped receiving
  // its own id or token would be broken in a far louder way.
  for (const nativo of [true, false]) {
    const cuerpo = controlador().cuerpoDeSesion(datos, nativo);
    assert.equal(cuerpo.userId, 'u1');
    assert.equal(cuerpo.email, 'a@b.co');
    assert.equal(cuerpo.token, 'jwt-de-acceso');
    assert.equal(cuerpo.expiresIn, '7d');
    assert.equal(cuerpo.timezone, 'America/Bogota');
  }
});
