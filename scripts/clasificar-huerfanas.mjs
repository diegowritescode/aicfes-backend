/**
 * Separates questions that are genuinely broken from questions that
 * were merely extracted without their stimulus.
 *
 * The verifier was told: "Si la pregunta depende de una imagen que no
 * ves, responde ambigua". It only ever receives text, so every item
 * whose figure, table or reading passage stayed behind in the PDF
 * comes back "ambigua" — indistinguishable, in the output, from a
 * question that is actually ill-posed.
 *
 * Judging by the verdict alone would throw away good questions in
 * exactly the areas with the least material left: Lectura Crítica
 * reads 6% healthy, Ciencias 18%, and those are extraction losses,
 * not defects.
 *
 * Three ways an item can be orphaned, in order of how certain we are:
 *
 *  1. It points at something not in its own text ("la figura", "el
 *     fragmento anterior", "las tablas").
 *  2. It starts mid-sentence, continuing a stem that is not there
 *     ("De esto se concluye que...", "Que la diferencia de potencial
 *     entre las placas sea 100 voltios, significa que").
 *  3. Its neighbours in the same PDF share a stimulus it has lost:
 *     ICFES groups several questions under one text or graph, and the
 *     extractor kept only the first one's context.
 *
 * Nothing here is deleted. Items are labelled so the loader can take
 * the healthy ones now and the orphans can be re-extracted later.
 *
 * Usage:
 *   node scripts/clasificar-huerfanas.mjs <banco.json> <veredictos.json> <salida.json>
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

const clave = (item) =>
  createHash('sha256').update(item.enunciado).digest('hex').slice(0, 16);

/* Explicit references to a stimulus that lives outside the stem.
   "anterior" and "siguiente" are the giveaways: a self-contained
   question has no reason to point anywhere. */
const REFERENCIAS = [
  /\b(la|el|los|las)\s+(figura|gr[áa]fic[ao]|tabla|imagen|esquema|diagrama|mapa|dibujo|ilustraci[óo]n|fotograf[íi]a|plano|circuito|montaje)s?\b/i,
  /\b(seg[úu]n|de acuerdo con|a partir de|con base en|observe|observando|teniendo en cuenta)\s+(la|el|los|las)\s+(figura|gr[áa]fic[ao]|tabla|imagen|esquema|diagrama|texto|fragmento|lectura|informaci[óo]n|datos|enunciado)/i,
  /\b(el|los)\s+(texto|fragmento|poema|cuento|relato|art[íi]culo|verso)s?\s+(anterior|siguiente|citado|le[íi]do)/i,
  /\b(fragmento|texto|lectura|poema)\s+(anterior|siguiente)/i,
  /\banterior(es)?\b.{0,40}\b(gr[áa]fic[ao]|tabla|figura|texto|fragmento|diagrama|esquema|informaci[óo]n|datos)\b/i,
  /\b(gr[áa]fic[ao]|tabla|figura|texto|fragmento|diagrama|esquema)\b.{0,40}\banterior(es)?\b/i,
  /\bde la (situaci[óo]n|experiencia|gr[áa]fica|tabla|figura) (anterior|descrita|planteada)\b/i,
  /\b(en|de) (la|el) (situaci[óo]n|experimento|montaje|circuito) (anterior|descrit[ao]|plantead[ao])\b/i,
];

/* A stem that opens mid-sentence lost the clause it continues.
   "Que la diferencia de potencial ... significa que" is the whole of
   one such item: the setup it refers to is simply absent. */
const COMIENZOS_COLGADOS = [
  /^(de|con|por|en|a)\s+(esto|ello|esta|este|estos|estas|lo anterior|dicha|dicho)\b/i,
  /^(esto|ello|eso|estos|estas|dicha|dicho|dichas|dichos)\b/i,
  /^(por lo (tanto|anterior)|as[íi] pues|entonces|luego|adem[áa]s|tambi[ée]n|sin embargo|no obstante)\b/i,
  /^(que|si|cuando|al|para)\s+(la|el|los|las|un|una)\b.{0,120}\b(significa|implica|indica|quiere decir|se concluye|se deduce|se infiere)\b/i,
  /^(la|el|los|las)\s+(componente|magnitud|resistencia|velocidad|fuerza|carga|corriente|presi[óo]n|temperatura)\b.{0,90}$/i,
  /^comparando\b/i,
  /* A rule matching "artículo + sustantivo + de + sustantivo" was
     here and had to go: it caught any stem opening with a noun and
     its complement, so self-contained philosophy items like "La
     existencia de la divinidad se ha expresado..." were filed as
     orphans. The remaining rules cover the real cases. */
];

/* Names of the people and objects an ICFES set introduces once, in a
   shared preamble, then refers to by name in every question under it.
   A stem that opens with one of these is leaning on that preamble. */
const RE_NOMBRE_SUELTO =
  /^(para|seg[úu]n|de acuerdo con)\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+\s*,/;

function razonHuerfana(item) {
  const texto = item.enunciado.replace(/\s+/g, ' ').trim();

  for (const re of REFERENCIAS) {
    if (re.test(texto)) return 'referencia-a-estimulo';
  }
  for (const re of COMIENZOS_COLGADOS) {
    if (re.test(texto)) return 'empieza-a-media-frase';
  }
  if (RE_NOMBRE_SUELTO.test(texto)) return 'referencia-a-estimulo';

  /* Very short stems carry no situation of their own. The threshold is
     deliberately low: a real ICFES stem that stands alone states its
     premise, which takes more than a dozen words. */
  const palabras = texto.split(/\s+/).length;
  if (palabras <= 12) return 'enunciado-demasiado-corto';

  return null;
}

/* ICFES prints several questions under one shared text or graph. The
   extractor kept the context with the first of them, so the ones that
   follow, in the same file and consecutive numbers, lost it. */
function marcarPorVecindad(items, mapa) {
  const porFuente = new Map();
  for (const item of items) {
    const lista = porFuente.get(item.fuente) ?? [];
    lista.push(item);
    porFuente.set(item.fuente, lista);
  }

  let añadidos = 0;
  for (const lista of porFuente.values()) {
    lista.sort((a, b) => a.numero - b.numero);
    for (let n = 0; n < lista.length; n += 1) {
      const item = lista[n];
      const k = clave(item);
      const entrada = mapa.get(k);
      if (!entrada || entrada.huerfana || entrada.estado !== 'con-problema') continue;

      const vecino = lista[n - 1];
      if (!vecino || vecino.numero !== item.numero - 1) continue;
      const vecinoEntrada = mapa.get(clave(vecino));
      if (!vecinoEntrada?.huerfana) continue;
      if (vecinoEntrada.razon !== 'referencia-a-estimulo') continue;

      entrada.huerfana = true;
      entrada.razon = 'comparte-estimulo-con-vecina';
      añadidos += 1;
    }
  }
  return añadidos;
}

function main() {
  const [rutaBanco, rutaVeredictos, rutaSalida] = process.argv.slice(2);
  if (!rutaBanco || !rutaVeredictos || !rutaSalida) {
    console.error(
      'uso: clasificar-huerfanas.mjs <banco.json> <veredictos.json> <salida.json>',
    );
    process.exit(1);
  }

  const items = JSON.parse(readFileSync(rutaBanco, 'utf-8'));
  const veredictos = existsSync(rutaVeredictos)
    ? JSON.parse(readFileSync(rutaVeredictos, 'utf-8'))
    : {};

  const mapa = new Map();
  for (const item of items) {
    const k = clave(item);
    const v = veredictos[k];

    let estado;
    if (!v) estado = 'sin-verificar';
    else if (v.error || !v.respuesta) estado = 'fallido';
    else if (v.problema === 'ninguno' && v.confianza !== 'baja') estado = 'sano';
    else estado = 'con-problema';

    const razon = razonHuerfana(item);
    mapa.set(k, {
      clave: k,
      fuente: item.fuente,
      numero: item.numero,
      area: item.area,
      estado,
      problema: v?.problema ?? null,
      confianza: v?.confianza ?? null,
      /* An item judged healthy is healthy whatever its stem looks
         like: the model solved it, so nothing was missing. */
      huerfana: estado === 'sano' ? false : Boolean(razon),
      razon: estado === 'sano' ? null : razon,
    });
  }

  const porVecindad = marcarPorVecindad(items, mapa);

  const salida = Array.from(mapa.values());
  writeFileSync(rutaSalida, JSON.stringify(salida, null, 0));

  /* Report */
  const cuenta = (pred) => salida.filter(pred).length;
  const sanos = cuenta((r) => r.estado === 'sano');
  const conProblema = salida.filter((r) => r.estado === 'con-problema');
  const huerfanas = conProblema.filter((r) => r.huerfana);
  const defectuosas = conProblema.filter((r) => !r.huerfana);
  const sinVerificar = cuenta((r) => r.estado === 'sin-verificar');

  console.log(`banco                 ${salida.length}`);
  console.log(`  sanos               ${sanos}`);
  console.log(`  con problema        ${conProblema.length}`);
  console.log(`    huérfanas         ${huerfanas.length}  (les falta el estímulo)`);
  console.log(`    defectuosas       ${defectuosas.length}  (la pregunta en sí falla)`);
  console.log(`  sin verificar       ${sinVerificar}`);
  console.log(`  fallidos            ${cuenta((r) => r.estado === 'fallido')}`);
  console.log(`\nmarcadas por vecindad: ${porVecindad}`);

  const porRazon = {};
  for (const r of huerfanas) porRazon[r.razon] = (porRazon[r.razon] ?? 0) + 1;
  console.log('\nrazón de orfandad:', porRazon);

  console.log('\nárea   sanos  huérfanas  defectuosas  sin verificar');
  const areas = [...new Set(salida.map((r) => r.area))].sort();
  for (const a of areas) {
    const de = (pred) => salida.filter((r) => r.area === a && pred(r)).length;
    console.log(
      a.padEnd(6),
      String(de((r) => r.estado === 'sano')).padEnd(6),
      String(de((r) => r.huerfana)).padEnd(10),
      String(de((r) => r.estado === 'con-problema' && !r.huerfana)).padEnd(12),
      de((r) => r.estado === 'sin-verificar'),
    );
  }
}

main();
