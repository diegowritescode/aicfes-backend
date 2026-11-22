import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { ItemBankService } from '../src/items/services/item-bank.service';

/**
 * How large a sitting the bank can fill.
 *
 * A simulacro refuses to start short, so this number is the gate on
 * the whole feature. Getting it wrong in the optimistic direction is
 * the expensive mistake: the interface would offer a sitting that then
 * fails with a 400 after the learner chose it.
 */

function servicio(verificados: Record<string, number>): ItemBankService {
  const prisma = {
    generatedItem: {
      groupBy: async () =>
        Object.entries(verificados).map(([area, n]) => ({
          area,
          _count: { _all: n },
        })),
    },
  };
  const config = { get: () => 'sk-test-no-usada' };
  return new ItemBankService(prisma as never, config as never);
}

test('un banco vacío no permite ningún simulacro', async () => {
  const inv = await servicio({}).inventario();
  assert.equal(inv.simulacroMaximo, 0);
  assert.equal(inv.total, 0);
});

test('el área más floja es la que manda', async () => {
  /* Plenty of everything except English. The sitting is bounded by
     whichever area runs out first, not by the total — a bank of a
     thousand maths items still cannot fill one sitting. */
  const inv = await servicio({ LC: 100, MAT: 100, SOC: 100, CN: 100, ING: 1 }).inventario();
  // ING needs floor(55n/254) ≥ 1, so n can only reach about 9 before
  // it needs a second English item.
  assert.ok(inv.simulacroMaximo < 15, `fue ${inv.simulacroMaximo}`);
  assert.ok(inv.simulacroMaximo >= 5);
});

test('un banco completo permite el examen entero', async () => {
  const inv = await servicio({ LC: 41, MAT: 50, SOC: 50, CN: 58, ING: 55 }).inventario();
  assert.equal(inv.simulacroMaximo, 254);
});

test('el máximo que informa es realmente servible', async () => {
  /* The number is a promise: the interface offers that sitting, and
     start() then draws against the same proportions. If this ever
     rounds the optimistic way, the learner picks a sitting that fails
     with a 400 after choosing it. */
  const verificados = { LC: 9, MAT: 11, SOC: 11, CN: 13, ING: 12 };
  const inv = await servicio(verificados).inventario();

  const EXAMEN: Record<string, number> = { LC: 41, MAT: 50, SOC: 50, CN: 58, ING: 55 };
  const TOTAL = 254;
  for (const [area, preguntas] of Object.entries(EXAMEN)) {
    const necesita = Math.max(1, Math.floor((preguntas * inv.simulacroMaximo) / TOTAL));
    assert.ok(
      (verificados[area as keyof typeof verificados] ?? 0) >= necesita,
      `${area} necesita ${necesita} y hay ${verificados[area as keyof typeof verificados]}`,
    );
  }
});

test('informa cuánto falta para el examen completo', async () => {
  const inv = await servicio({ LC: 5, MAT: 24, SOC: 2, CN: 2, ING: 3 }).inventario();
  const ing = inv.porArea.find((a) => a.area === 'ING')!;
  assert.equal(ing.verificados, 3);
  assert.equal(ing.paraExamenCompleto, 55);
});

test('un área sin ningún ítem aparece en cero, no ausente', async () => {
  // CN was missing entirely from the bank, and an area absent from the
  // report reads as "fine" rather than as the thing blocking everything.
  const inv = await servicio({ MAT: 24 }).inventario();
  const cn = inv.porArea.find((a) => a.area === 'CN');
  assert.ok(cn, 'CN debe aparecer');
  assert.equal(cn!.verificados, 0);
});
