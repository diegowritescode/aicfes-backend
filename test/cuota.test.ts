import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { CuotaService } from '../src/calidad/cuota.service';
import { SesionRequeridaGuard } from '../src/common/guards/sesion-requerida.guard';
import { CuotaGuard } from '../src/common/guards/cuota.guard';

/**
 * These guards are what stands between an open endpoint and the OpenAI
 * bill, so the cases that matter are pinned: the anonymous caller, the
 * learner who has spent their day, and the single request large enough
 * to clear the cap before any check could run.
 */

function servicio(opciones: {
  gastado: number;
  topeGratis?: number;
  costoPregunta?: number;
  falla?: boolean;
}): CuotaService {
  const costos = {
    costoUsuario: async () => {
      if (opciones.falla) throw new Error('base de datos caída');
      return { dolares: opciones.gastado, peticiones: 1 };
    },
  };
  const config = {
    get: (clave: string) => {
      if (clave === 'CUOTA_DIARIA_GRATIS_USD') return opciones.topeGratis ?? 0.25;
      if (clave === 'COSTO_ESTIMADO_PREGUNTA_USD') return opciones.costoPregunta ?? 0.009;
      return undefined;
    },
  };
  return new CuotaService(costos as never, config as never);
}

function contexto(req: unknown) {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as never;
}

test('un pedido anónimo no pasa', () => {
  const guard = new SesionRequeridaGuard();
  assert.throws(() => guard.canActivate(contexto({})), /AUTENTICACION_REQUERIDA|Inicie sesión/);
});

test('un userId en blanco cuenta como anónimo', () => {
  const guard = new SesionRequeridaGuard();
  assert.throws(() => guard.canActivate(contexto({ userId: '   ' })));
});

test('un usuario autenticado pasa', () => {
  const guard = new SesionRequeridaGuard();
  assert.equal(guard.canActivate(contexto({ userId: 'u1' })), true);
});

test('deja practicar a quien no ha gastado', async () => {
  const estado = await servicio({ gastado: 0 }).puedeGenerar('u1', 5);
  assert.equal(estado.permitido, true);
});

test('corta a quien ya gastó el día', async () => {
  const estado = await servicio({ gastado: 0.25 }).puedeGenerar('u1', 1);
  assert.equal(estado.permitido, false);
  assert.equal(estado.restante, 0);
});

test('rechaza un pedido que por sí solo supera lo que queda', async () => {
  // The hole the cap had to close: one call for a hundred questions
  // costs ~$0.90 against a $0.25 day, and checking only what was spent
  // before would have waved it through.
  const estado = await servicio({ gastado: 0 }).puedeGenerar('u1', 100);
  assert.equal(estado.permitido, false);
});

test('un pedido que cabe justo sí pasa', async () => {
  // $0.25 / $0.009 = 27 questions.
  const estado = await servicio({ gastado: 0 }).puedeGenerar('u1', 27);
  assert.equal(estado.permitido, true);
});

test('si no se puede leer el gasto, no se bloquea al estudiante', async () => {
  // A database hiccup must not lock everyone out of the product: the
  // cap exists to stop runaway use, not to be a second gate on
  // availability. The miss is bounded by one request.
  const estado = await servicio({ gastado: 0, falla: true }).puedeGenerar('u1', 5);
  assert.equal(estado.permitido, true);
});

test('la cuota se reinicia a la medianoche UTC siguiente', async () => {
  const estado = await servicio({ gastado: 0 }).estado('u1');
  assert.equal(estado.reinicia.getUTCHours(), 0);
  assert.ok(estado.reinicia.getTime() > Date.now());
});

test('un tope mal configurado cae en el valor por defecto', async () => {
  const estado = await servicio({ gastado: 0, topeGratis: -5 }).estado('u1');
  assert.equal(estado.tope, 0.25);
});

test('el guard suma las secciones de un pedido mixto', async () => {
  const guard = new CuotaGuard(servicio({ gastado: 0 }));
  const req = {
    userId: 'u1',
    body: { sections: [{ n: 50 }, { n: 50 }] },
  };
  await assert.rejects(
    () => guard.canActivate(contexto(req)),
    (error: unknown) => {
      // HttpException keeps the payload in .response, not in .message.
      const cuerpo = (error as { response: { error: { code: string } } }).response.error;
      assert.equal(cuerpo.code, 'CUOTA_AGOTADA');
      return true;
    },
  );
});

test('el guard deja pasar un pedido mixto pequeño', async () => {
  const guard = new CuotaGuard(servicio({ gastado: 0 }));
  const req = { userId: 'u1', body: { sections: [{ n: 5 }, { n: 5 }] } };
  assert.equal(await guard.canActivate(contexto(req)), true);
});

test('el guard informa cuántas preguntas caben todavía', async () => {
  const guard = new CuotaGuard(servicio({ gastado: 0.1 }));
  const req = { userId: 'u1', body: { n: 100 } };
  try {
    await guard.canActivate(contexto(req));
    assert.fail('debió rechazar');
  } catch (error) {
    const cuerpo = (error as { response: { error: Record<string, unknown> } }).response.error;
    assert.equal(cuerpo.code, 'CUOTA_AGOTADA');
    // $0.15 left at $0.009 each.
    assert.equal(cuerpo.restanteHoy, 16);
    assert.ok(typeof cuerpo.reinicia === 'string');
  }
});

test('el guard no se interpone cuando no hay usuario', async () => {
  // SesionRequeridaGuard owns that case and runs first; this one must
  // not swallow it with a confusing quota error.
  const guard = new CuotaGuard(servicio({ gastado: 999 }));
  assert.equal(await guard.canActivate(contexto({ body: { n: 1 } })), true);
});
