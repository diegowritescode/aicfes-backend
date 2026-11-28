import { test, describe } from 'node:test';
import * as assert from 'assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The privacy policy has to be reachable, and it has to be true.
 *
 * Google Play requires a privacy-policy URL that is public, needs no
 * sign-in, and stays up. Two independent things can break that, and
 * both have broken silently before:
 *
 * 1. The file is served from `public/`, which `main.ts` mounts from
 *    `__dirname/../public`. That folder was not copied into the Docker
 *    image at all, so in production the mount pointed at a path that
 *    did not exist and express fell through to a 404. Nothing logged.
 *
 * 2. The policy makes factual claims about where data goes. A claim
 *    that stops being true is worse than no policy: it is a false
 *    statement to a minor and a Data safety mismatch, and Play treats
 *    a mismatch as grounds for removal.
 *
 * So this test pins both: the Dockerfile must carry the file, and the
 * sentences that are load-bearing must still be in it. It cannot
 * verify the claims are true — only that removing one is deliberate.
 */

const raiz = join(__dirname, '..');
const politica = readFileSync(join(raiz, 'public', 'privacidad.html'), 'utf8');
const dockerfile = readFileSync(join(raiz, 'Dockerfile'), 'utf8');

/* Instructions only. The comment above the COPY explains why the whole
   folder is NOT copied, and contains the very string the next test
   looks for — so reading the raw file made the guard fail on its own
   documentation. A guard that trips on a comment teaches people to
   stop writing comments. */
const instrucciones = dockerfile
  .split('\n')
  .filter((linea) => !linea.trimStart().startsWith('#'))
  .join('\n');

describe('la política de privacidad', () => {
  test('entra en la imagen de Docker', () => {
    assert.match(
      instrucciones,
      /COPY[^\n]*public\/privacidad\.html/,
      'el Dockerfile ya no copia privacidad.html: la URL que Play revisa va a dar 404',
    );
  });

  test('no publica la consola del generador', () => {
    /* `COPY public ./public` would put `index.html` and `app.js` — an
       operator tool — on the open internet. The endpoint behind them
       is guarded, so nothing is spent, but the folder is the wrong
       unit to copy: whatever lands there next ships too. */
    assert.doesNotMatch(
      instrucciones,
      /COPY[^\n]*\spublic\s+\.\/public/,
      'el Dockerfile copia toda la carpeta public/, que incluye la consola del generador',
    );
  });

  test('dice que el uso de apps no sale del teléfono', () => {
    assert.match(
      politica,
      /no sale de tu teléfono/i,
      'desapareció la afirmación central sobre el permiso de acceso al uso',
    );
  });

  test('no promete que el servidor está en la Unión Europea', () => {
    /* It is in Boston, on Hostinger. The first draft of this policy
       said the European Union, which was invented rather than
       measured — and a wrong jurisdiction is the kind of error that
       voids the transfer authorisation it claims to obtain. */
    assert.doesNotMatch(
      politica,
      /Unión Europea/i,
      'la política volvió a afirmar que el servidor está en la UE; está en Estados Unidos',
    );
    assert.match(
      politica,
      /Estados Unidos/,
      'la política ya no dice dónde está el servidor',
    );
  });

  test('nombra a cada tercero que recibe datos', () => {
    for (const tercero of ['OpenAI', 'Resend', 'Hostinger']) {
      assert.match(
        politica,
        new RegExp(tercero),
        `la política ya no nombra a ${tercero}, que sí recibe datos`,
      );
    }
  });

  test('da una dirección de contacto y de borrado', () => {
    assert.match(
      politica,
      /privacidad@aicfes\.deviego\.xyz/,
      'sin dirección de contacto no hay forma de ejercer los derechos que la política promete',
    );
  });

  test('no carga nada desde un CDN', () => {
    /* `helmet` sets `defaultSrc 'self'`. A stylesheet or script from a
       CDN is blocked by the app's own CSP, so the page would render
       unstyled exactly when a reviewer opens it. */
    assert.doesNotMatch(
      politica,
      /https?:\/\/(cdn|cdnjs|unpkg|fonts)\./i,
      'la política carga un recurso externo que el CSP del servidor bloquea',
    );
  });
});
