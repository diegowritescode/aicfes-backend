/**
 * Verifies the extracted reference bank with the local `claude` CLI.
 *
 * Runs on your own machine against your own subscription — this is you
 * checking your own material once, not a service answering users. The
 * deployed verifier uses the API and is a separate path.
 *
 * Each item is solved without being shown its options' roles, and the
 * verdict is recorded beside it. Items whose verdict reports ambiguity
 * or multiple correct answers are the ones worth dropping: the
 * generator should not imitate a broken question.
 *
 * Writes progress after every item, so an interrupted run resumes.
 *
 * Usage:
 *   node scripts/verificar-banco-local.mjs <banco.json> <salida.json> [limite]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

const INSTRUCCION = `Eres un evaluador del examen ICFES Saber 11 de Colombia.
Resuelve la pregunta por tu cuenta y responde SOLO con este JSON, sin texto alrededor:
{"respuesta":"A|B|C|D","confianza":"alta|media|baja","problema":"ninguno|ambigua|varias_correctas|ninguna_correcta"}
Usa "problema" para señalar si la pregunta es ambigua, si más de una opción es defendible,
o si ninguna lo es. Si la pregunta depende de una imagen que no ves, responde "ambigua".`;

/* The extractor let the next block's header run on into the last
   option, so an item could end with "D) 1 : 5 RESPONDA LAS PREGUNTAS
   12 Y 13 DE ACUERDO CON LA SIGUIENTE INFORMACIÓN Dentro de una caja
   hermética...". Asked to answer questions that are not there, the
   model abandoned the JSON format and replied in prose — which the
   parser recorded as a failure, 317 times. */
const ARRASTRE =
  /\s*(RESPONDA\s+(LAS?\s+)?PREGUNTAS?\b|CONTESTE\s+(LAS?\s+)?PREGUNTAS?\b|DE\s+ACUERDO\s+CON\s+LA\s+SIGUIENTE\s+INFORMACI[ÓO]N\b|RESPONDA\s+DE\s+ACUERDO\b).*$/is;

function limpiarArrastre(texto) {
  return (texto ?? '').replace(ARRASTRE, '').trim();
}

function prompt(item) {
  const opciones = ['A', 'B', 'C', 'D']
    .map((k) => `${k}) ${limpiarArrastre(item.opciones[k])}`)
    .join('\n');
  const enunciado = limpiarArrastre(item.enunciado);
  return `${INSTRUCCION}\n\nÁrea: ${item.area}\n${enunciado}\n\n${opciones}`;
}

/* Some stems are missing the text or figure they refer to. That is a
   verdict ("ambigua"), not a failure, so the retry says so outright
   rather than letting the model ask for the missing material. */
const REINTENTO = `\n\nIMPORTANTE: responde ÚNICAMENTE con el JSON pedido, en una sola línea.
No expliques, no razones en voz alta, no pidas material adicional.
Si falta el texto, la gráfica o la información a la que la pregunta se refiere,
responde {"respuesta":"A","confianza":"baja","problema":"ambigua"}.`;

function extraerJson(stdout) {
  const limpio = stdout.replace(/```json\n?|```/g, '').trim();
  const inicio = limpio.indexOf('{');
  const fin = limpio.lastIndexOf('}');
  if (inicio === -1 || fin === -1) return null;
  try {
    return JSON.parse(limpio.slice(inicio, fin + 1));
  } catch {
    return null;
  }
}

async function pedir(texto) {
  // The prompt goes as an argument: piping to stdin races the CLI's
  // own 3-second wait and it proceeds without the input.
  const { stdout } = await run('claude', ['-p', texto], {
    maxBuffer: 1024 * 1024,
    timeout: 180_000,
  });
  return stdout;
}

async function verificar(item) {
  const base = prompt(item);

  const primera = extraerJson(await pedir(base));
  if (primera) return primera;

  const segunda = extraerJson(await pedir(base + REINTENTO));
  if (segunda) return segunda;

  throw new Error('sin JSON tras reintento');
}

async function main() {
  const [entrada, salida, limiteArg] = process.argv.slice(2);
  if (!entrada || !salida) {
    console.error('uso: verificar-banco-local.mjs <banco.json> <salida.json> [limite]');
    process.exit(1);
  }

  const items = JSON.parse(readFileSync(entrada, 'utf-8'));
  // Resume: anything already judged is left alone.
  const hechos = existsSync(salida) ? JSON.parse(readFileSync(salida, 'utf-8')) : {};
  // The stem identifies the question; fuente#numero does not — the
  // same number appears in many files, so 2,374 items collapsed to
  // 1,223 keys and each verdict overwrote another.
  const clave = (i) => createHash('sha256').update(i.enunciado).digest('hex').slice(0, 16);

  /* A recorded error is not a verdict. Items that failed before are
     retried, so fixing the prompt actually reaches the 317 that the
     run-on header broke. Real verdicts are still left alone. */
  const pendientes = items.filter((i) => {
    const previo = hechos[clave(i)];
    return !previo || previo.error || !previo.respuesta;
  });
  const total = limiteArg ? Math.min(Number(limiteArg), pendientes.length) : pendientes.length;

  console.log(`${items.length} ítems, ${Object.keys(hechos).length} ya verificados`);
  console.log(`verificando ${total} ahora\n`);

  let sanos = 0;
  let problematicos = 0;
  let fallidos = 0;

  for (let n = 0; n < total; n += 1) {
    const item = pendientes[n];
    try {
      const veredicto = await verificar(item);
      hechos[clave(item)] = veredicto;
      if (veredicto.problema === 'ninguno' && veredicto.confianza !== 'baja') sanos += 1;
      else problematicos += 1;
    } catch (error) {
      hechos[clave(item)] = { error: String(error).slice(0, 120) };
      fallidos += 1;
    }

    // Written every time: a run interrupted at item 900 keeps 900.
    writeFileSync(salida, JSON.stringify(hechos, null, 0));
    process.stdout.write(
      `\r  ${n + 1}/${total}  sanos ${sanos}  con problema ${problematicos}  fallidos ${fallidos}`,
    );
  }

  console.log('\n');
  const veredictos = Object.values(hechos).filter((v) => v.respuesta);
  const porProblema = {};
  for (const v of veredictos) porProblema[v.problema] = (porProblema[v.problema] ?? 0) + 1;
  console.log('veredictos por tipo:', porProblema);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
