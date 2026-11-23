import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { planVencido, planVigente, type FilaDePlan } from '../src/calidad/plan';

/**
 * Which plan is in force, which decides how much a learner may spend
 * on model calls in a day.
 *
 * Both directions of error cost something real: too generous gives
 * away generation, too strict cuts off someone who paid.
 */

const AHORA = new Date('2026-11-22T12:00:00.000Z');

function fila(p: Partial<FilaDePlan> = {}): FilaDePlan {
  return { plan: 'gratis', planHasta: null, ...p };
}

test('una cuenta sin tocar está en gratis', () => {
  assert.equal(planVigente(fila(), AHORA), 'gratis');
});

test('un plan pago vigente es pago', () => {
  const vigente = fila({ plan: 'pago', planHasta: new Date('2026-12-22T00:00:00.000Z') });
  assert.equal(planVigente(vigente, AHORA), 'pago');
});

test('un plan pago sin fecha no vence', () => {
  // This is how a lifetime plan, or one granted by hand, is written.
  assert.equal(planVigente(fila({ plan: 'pago', planHasta: null }), AHORA), 'pago');
});

test('un plan pago caducado vuelve a gratis, no a bloqueado', () => {
  /* Not paying is not the same as not being welcome: the learner keeps
     using the app on the free allowance. */
  const caducado = fila({ plan: 'pago', planHasta: new Date('2026-11-01T00:00:00.000Z') });
  assert.equal(planVigente(caducado, AHORA), 'gratis');
});

test('el borde exacto cuenta como vencido', () => {
  // A subscription that ends at this instant has ended.
  const justo = fila({ plan: 'pago', planHasta: new Date(AHORA) });
  assert.equal(planVigente(justo, AHORA), 'gratis');
});

test('semilla ignora las fechas', () => {
  /* Granted on the server to stock the bank. An expiry would mean the
     bank stops filling halfway through for a reason nobody would
     connect to this. */
  const conFechaPasada = fila({ plan: 'semilla', planHasta: new Date('2020-01-01') });
  assert.equal(planVigente(conFechaPasada, AHORA), 'semilla');
});

test('saber si un plan venció, para poder decirlo', () => {
  assert.equal(
    planVencido(fila({ plan: 'pago', planHasta: new Date('2026-11-01') }), AHORA),
    true,
  );
  assert.equal(
    planVencido(fila({ plan: 'pago', planHasta: new Date('2026-12-01') }), AHORA),
    false,
  );
  // A free account never "expired": it never had a plan to lose.
  assert.equal(planVencido(fila(), AHORA), false);
  assert.equal(planVencido(fila({ plan: 'semilla' }), AHORA), false);
});

test('el plan que lee el servicio cambia el tope de verdad', async () => {
  /* The bug this closes: `plan` was a type with a `'gratis'` default
     parameter and nothing ever supplied another value, so a learner on
     the paid plan was metered at the free cap. Reading the row is what
     makes the column mean anything. */
  const { CuotaService } = await import('../src/calidad/cuota.service');

  function servicio(filaDelUsuario: unknown) {
    const costos = { costoUsuario: async () => ({ dolares: 0.5, peticiones: 1 }) };
    const config = { get: () => undefined };
    const prisma = { user: { findUnique: async () => filaDelUsuario } };
    return new CuotaService(costos as never, config as never, prisma as never);
  }

  // Free cap is 0.25 USD/day, so 0.50 spent is already over it.
  const gratis = servicio({ plan: 'gratis', planHasta: null });
  assert.equal(await gratis.planDe('u1'), 'gratis');
  assert.equal((await gratis.estado('u1', 'gratis')).permitido, false);

  // The paid cap is 3.00, so the same spend is fine.
  const pago = servicio({ plan: 'pago', planHasta: new Date('2027-01-01') });
  assert.equal(await pago.planDe('u1'), 'pago');
  assert.equal((await pago.estado('u1', 'pago')).permitido, true);

  // A lapsed subscription is metered as free again.
  const caducado = servicio({ plan: 'pago', planHasta: new Date('2020-01-01') });
  assert.equal(await caducado.planDe('u1'), 'gratis');

  // And an account that does not exist gets the tightest cap, not the
  // loosest: a request for an unknown user is not a reason to be
  // generous.
  const inexistente = servicio(null);
  assert.equal(await inexistente.planDe('fantasma'), 'gratis');
});
