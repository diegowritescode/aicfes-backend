import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  decidir,
  expiraEn,
  puedeRetar,
  HORAS_PARA_ACEPTAR,
  INVITACIONES_POR_DIA,
} from '../src/duelos/model/resultado';

/** Who wins, and who may challenge whom. */

test('gana quien acierta más, aunque tarde más', () => {
  /* The ordering is the product decision. Scoring time first would
     teach a learner to answer fast and wrong, and the ICFES gives 64
     seconds a question because the questions need thinking. */
  const v = decidir({ aciertos: 4, segundos: 300 }, { aciertos: 3, segundos: 60 });
  assert.deepEqual(v, { tipo: 'retador' });
});

test('con los mismos aciertos, desempata el tiempo', () => {
  assert.deepEqual(
    decidir({ aciertos: 3, segundos: 200 }, { aciertos: 3, segundos: 150 }),
    { tipo: 'rival' },
  );
});

test('iguales en todo es empate, no una moneda al aire', () => {
  // A tiebreak on who challenged would decide it on nothing either did.
  assert.deepEqual(
    decidir({ aciertos: 3, segundos: 120 }, { aciertos: 3, segundos: 120 }),
    { tipo: 'empate' },
  );
});

const BASE = {
  retadorId: 'a',
  rivalId: 'b',
  hayBloqueo: false,
  rivalVisible: true,
  retadorAutorizado: true,
  duelosAbiertosConEseRival: 0,
  invitacionesHoy: 0,
};

test('un reto normal procede', () => {
  assert.equal(puedeRetar(BASE).puede, true);
});

test('nadie se reta a sí mismo', () => {
  assert.equal(puedeRetar({ ...BASE, rivalId: 'a' }).motivo, 'a_si_mismo');
});

test('el bloqueo corta el reto', () => {
  assert.equal(puedeRetar({ ...BASE, hayBloqueo: true }).motivo, 'bloqueado');
});

test('bloqueo y no-buscable dicen lo mismo al estudiante', () => {
  /* Telling someone "this person blocked you" confirms the account
     exists and that a specific person acted against them, which is
     something a blocked user can act on. The distinction stays in the
     code for the logs and is lost on the way to the screen. */
  const porBloqueo = puedeRetar({ ...BASE, hayBloqueo: true });
  const porInvisible = puedeRetar({ ...BASE, rivalVisible: false });
  assert.notEqual(porBloqueo.motivo, porInvisible.motivo);
  assert.equal(porBloqueo.mensaje, porInvisible.mensaje);
});

test('el bloqueo se evalúa antes que la visibilidad', () => {
  /* Otherwise a blocked learner could tell the two apart by trying
     against an account they know is searchable. */
  const ambos = puedeRetar({ ...BASE, hayBloqueo: true, rivalVisible: false });
  assert.equal(ambos.motivo, 'bloqueado');
});

test('sin autorización del acudiente no se puede retar', () => {
  assert.equal(
    puedeRetar({ ...BASE, retadorAutorizado: false }).motivo,
    'sin_autorizacion',
  );
});

test('un solo duelo abierto por pareja', () => {
  /* Without this, a stranger fills someone's screen with invitations
     they must dismiss one by one: harassment through an ordinary
     feature. */
  assert.equal(
    puedeRetar({ ...BASE, duelosAbiertosConEseRival: 1 }).motivo,
    'duelo_abierto',
  );
});

test('hay techo de invitaciones por día', () => {
  assert.equal(puedeRetar({ ...BASE, invitacionesHoy: INVITACIONES_POR_DIA - 1 }).puede, true);
  assert.equal(
    puedeRetar({ ...BASE, invitacionesHoy: INVITACIONES_POR_DIA }).motivo,
    'demasiados_hoy',
  );
});

test('toda negativa trae mensaje y ninguna aprobación lo trae', () => {
  const negada = puedeRetar({ ...BASE, rivalId: 'a' });
  assert.ok(negada.mensaje && negada.mensaje.length > 0);
  assert.equal(puedeRetar(BASE).mensaje, undefined);
});

test('la invitación expira', () => {
  // One that never expires leaves a notification nobody can clear.
  const creado = new Date('2026-11-23T10:00:00Z');
  const fin = expiraEn(creado);
  assert.equal(fin.getTime() - creado.getTime(), HORAS_PARA_ACEPTAR * 3600 * 1000);
});
