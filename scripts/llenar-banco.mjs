#!/usr/bin/env node
/**
 * Stocks the item bank until every area can supply a full sitting.
 *
 * A simulacro refuses to start short — a sitting missing an area would
 * report a score that cannot be compared to a real one — so the bank
 * is the gate on the whole feature. The real exam is 254 questions
 * split LC 41, MAT 50, SOC 50, CN 58, ING 55, and `draw()` hands out
 * distinct items, so that many have to exist at once.
 *
 * How it behaves, and why:
 *
 *  - Small batches. A failed request loses one batch, not an hour, and
 *    the quota check prices a whole request up front: one call for a
 *    hundred items is refused outright.
 *  - It re-reads the bank between rounds instead of counting what it
 *    asked for. Generation produces items; verification decides which
 *    ones survive, and only the survivors can be drawn. Counting
 *    requests would report a full bank while the simulacro still
 *    failed.
 *  - It stops on a quota refusal rather than hammering. The cap is
 *    there to bound a runaway, and a script that retries past it is
 *    the runaway.
 *  - It stops when a round adds nothing. If verification is rejecting
 *    everything in an area, more requests will not fix it, and the
 *    spend is real.
 */

const API = process.env.AICFES_API ?? 'https://aicfes-backend.deviego.xyz';
const TOKEN = process.env.AICFES_TOKEN;
const LOTE = Number(process.env.LOTE ?? 5);
const DIFICULTADES = ['facil', 'media', 'alta'];

/** The real exam, which is what a full sitting has to be able to draw. */
const META = { LC: 41, MAT: 50, SOC: 50, CN: 58, ING: 55 };
/** Spare copies, so two sittings in a row are not the same questions. */
const MARGEN = Number(process.env.MARGEN ?? 1.2);

if (!TOKEN) {
  console.error('Falta AICFES_TOKEN');
  process.exit(1);
}

const cabeceras = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${TOKEN}`,
};

/**
 * Verified items per area, read back from the bank.
 *
 * Only verified items can be drawn, so this is the number that decides
 * whether a sitting can start. Anything else would be a count of work
 * done rather than of bank available.
 */
async function inventario() {
  const r = await fetch(`${API}/api/items/bank/stats`, { headers: cabeceras });
  if (!r.ok) return null;
  const cuerpo = await r.json().catch(() => null);
  const datos = cuerpo?.data ?? cuerpo;
  const porArea = {};
  for (const fila of datos?.porArea ?? datos?.areas ?? []) {
    const area = fila.area ?? fila.name;
    const n = Number(fila.verificados ?? fila.verified ?? fila.count ?? 0);
    if (area) porArea[area] = n;
  }
  return Object.keys(porArea).length ? porArea : null;
}

async function generar(area, dificultad, n) {
  const r = await fetch(`${API}/api/items/generate`, {
    method: 'POST',
    headers: cabeceras,
    body: JSON.stringify({ area, dificultad, n }),
  });
  const cuerpo = await r.json().catch(() => ({}));
  if (r.status === 429) {
    return { cuota: true, mensaje: cuerpo?.error?.message ?? 'cuota agotada' };
  }
  if (!r.ok || cuerpo?.ok === false) {
    return { error: cuerpo?.error?.message ?? `HTTP ${r.status}` };
  }
  return { items: (cuerpo.items ?? []).length };
}

const objetivo = Object.fromEntries(
  Object.entries(META).map(([a, n]) => [a, Math.ceil(n * MARGEN)]),
);

console.log('Meta por área (examen real × margen):');
for (const [a, n] of Object.entries(objetivo)) console.log(`  ${a}: ${n}`);
console.log();

let ronda = 0;
let gastoAprox = 0;

for (;;) {
  ronda += 1;
  const verificados = await inventario();
  if (!verificados) {
    console.error('No se pudo leer el inventario del banco.');
    process.exit(1);
  }

  const faltan = {};
  for (const [area, meta] of Object.entries(objetivo)) {
    const tengo = Number(verificados[area] ?? 0);
    if (tengo < meta) faltan[area] = meta - tengo;
  }

  const total = Object.values(faltan).reduce((s, n) => s + n, 0);
  console.log(
    `── Ronda ${ronda} · faltan ${total} · ` +
      Object.entries(verificados)
        .map(([a, n]) => `${a}:${n}`)
        .join(' '),
  );

  if (total === 0) {
    console.log('\nBanco completo.');
    break;
  }

  let agregadosEstaRonda = 0;

  for (const [area, cuantos] of Object.entries(faltan)) {
    const pedir = Math.min(LOTE, cuantos);
    /* Spread across difficulties so the bank is not all easy items,
       which would make every sitting score high and mean nothing. */
    const dificultad = DIFICULTADES[ronda % DIFICULTADES.length];

    process.stdout.write(`   ${area} ${dificultad} ×${pedir} … `);
    const r = await generar(area, dificultad, pedir);

    if (r.cuota) {
      console.log(`CUOTA: ${r.mensaje}`);
      console.log('\nSe alcanzó el tope de hoy. Vuelva a correrlo mañana.');
      process.exit(0);
    }
    if (r.error) {
      console.log(`error: ${r.error}`);
      continue;
    }
    console.log(`${r.items} generados`);
    agregadosEstaRonda += r.items;
    gastoAprox += r.items * 0.0117;
  }

  if (agregadosEstaRonda === 0) {
    console.log(
      '\nUna ronda entera sin agregar nada. La verificación está rechazando todo; ' +
        'parar aquí en vez de seguir gastando.',
    );
    break;
  }

  console.log(`   (gasto aproximado acumulado: $${gastoAprox.toFixed(2)})`);
}

const final = await inventario();
console.log('\nInventario final:', JSON.stringify(final));
console.log(`Gasto aproximado de esta corrida: $${gastoAprox.toFixed(2)}`);
