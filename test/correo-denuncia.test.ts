import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { asunto, cuerpo, type DatosDeDenuncia } from '../src/duelos/model/correo-denuncia';

/**
 * The report email.
 *
 * It is about a minor, sent through a third-party service, and it
 * lives in an inbox for years. So what it does *not* carry matters as
 * much as what it does.
 */

function datos(cambios: Partial<DatosDeDenuncia> = {}): DatosDeDenuncia {
  return {
    motivo: 'acoso',
    aliasDenunciado: 'problema',
    aliasDenunciante: 'camilo',
    totales: 1,
    personas: 1,
    abiertas: 1,
    ...cambios,
  };
}

test('el asunto lleva el patrón adelante', () => {
  /* Three different people reporting one account is the fact that
     changes what you do next. Buried under "nueva denuncia" it
     wastes the only line that is always read. */
  assert.match(asunto(datos({ personas: 3, totales: 3 })), /3 personas denunciaron/);
  assert.match(asunto(datos({ personas: 2, totales: 2 })), /segunda persona/);
});

test('una sola denuncia dice el motivo', () => {
  assert.match(asunto(datos()), /acoso/);
  assert.match(asunto(datos()), /problema/);
});

test('una cuenta sin alias no rompe el asunto', () => {
  const linea = asunto(datos({ aliasDenunciado: null }));
  assert.match(linea, /una cuenta/);
  assert.ok(!linea.includes('null'));
});

test('el cuerpo nunca lleva lo que escribió el estudiante', () => {
  /* A harassment report can quote the harassment. Forwarding a
     minor's account of it into an inbox, through a third party, adds
     exposure without adding a decision — the detail is in the app,
     behind the moderation token. */
  const texto = cuerpo(datos());
  assert.ok(!texto.includes('detalle'));
  assert.match(texto, /está en la app/);
});

test('el cuerpo no lleva identificadores ni correos', () => {
  const texto = cuerpo(datos());
  assert.ok(!texto.includes('@'), 'no debe llevar direcciones');
  assert.ok(!/[0-9a-f]{20,}/.test(texto), 'no debe llevar ids');
});

test('distingue tres quejas de una persona de una de tres', () => {
  const unaPersona = cuerpo(datos({ totales: 3, personas: 1 }));
  const tresPersonas = cuerpo(datos({ totales: 3, personas: 3 }));
  assert.match(unaPersona, /3 denuncias de 1 persona\b/);
  assert.match(tresPersonas, /3 denuncias de 3 personas distintas/);
});

test('dice que el bloqueo ya ocurrió', () => {
  /* Otherwise the reader's first thought is that a minor is waiting
     for them to act before the harassment stops. */
  assert.match(cuerpo(datos()), /no espera/);
});

test('dice cuántas esperan', () => {
  assert.match(cuerpo(datos({ abiertas: 1 })), /única sin revisar/);
  assert.match(cuerpo(datos({ abiertas: 4 })), /4 denuncias sin revisar/);
});
