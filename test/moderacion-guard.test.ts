import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { ModeracionGuard } from '../src/common/guards/moderacion.guard';

/**
 * Who may read a queue of minors' reports.
 *
 * The property that matters most is the one that is easiest to get
 * backwards: with no secret configured the queue must be **closed**,
 * not open. Open-when-unset is the shape of defect that leaks the
 * whole queue the first time someone deploys without the variable, and
 * it does so silently.
 */

function guard(token?: string): ModeracionGuard {
  const config = { get: () => token } as any;
  return new ModeracionGuard(config);
}

function peticion(cabecera?: string) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers: cabecera === undefined ? {} : { 'x-moderacion-token': cabecera } }),
    }),
  } as any;
}

test('sin token configurado, la cola está cerrada', () => {
  // The defect this prevents would leak the queue silently.
  assert.equal(guard(undefined).canActivate(peticion('lo-que-sea')), false);
  assert.equal(guard('').canActivate(peticion('lo-que-sea')), false);
  assert.equal(guard('   ').canActivate(peticion('   ')), false);
});

test('con el token correcto, pasa', () => {
  assert.equal(guard('secreto-largo-123').canActivate(peticion('secreto-largo-123')), true);
});

test('con el token equivocado, no pasa', () => {
  assert.equal(guard('secreto-largo-123').canActivate(peticion('otro')), false);
});

test('sin cabecera, no pasa', () => {
  assert.equal(guard('secreto-largo-123').canActivate(peticion(undefined)), false);
  assert.equal(guard('secreto-largo-123').canActivate(peticion('')), false);
});

test('un token de otro largo no rompe la comparación', () => {
  /* `timingSafeEqual` throws on a length mismatch, so the comparison
     hashes both sides first. Without that, a short token would
     surface as a 500 instead of a refusal — and the error would tell
     the caller the length was wrong. */
  assert.equal(guard('secreto-largo-123').canActivate(peticion('x')), false);
  assert.equal(guard('x').canActivate(peticion('secreto-largo-123')), false);
});

test('el espacio alrededor del secreto no cuenta', () => {
  /* An env var pasted with a trailing newline is the most likely way
     this is set, and it must not lock out the only moderator. */
  assert.equal(guard('  secreto-largo-123  ').canActivate(peticion('secreto-largo-123')), true);
});
