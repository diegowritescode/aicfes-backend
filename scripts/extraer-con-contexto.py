"""Extracts exam items together with the stimulus they depend on.

The first extractor defined RE_BLOQUE and never used it: it kept only
what followed a question number, so the shared reading passage, table or
graph introduced by "RESPONDA LAS PREGUNTAS 1 Y 2 DE ACUERDO CON LA
SIGUIENTE INFORMACIÓN" was dropped. Every question under that heading
arrived without the thing it asks about.

That is why Lectura Crítica reads 6% healthy and Ciencias 18%: those
areas lean hardest on shared passages and figures, so most of their
items were orphaned on extraction, not defective.

This version carries the block forward. Each question under a heading
keeps the passage in `contexto`, so the generator sees a complete item
and the verifier can actually solve it.

What is still lost: anything that is a picture. A graph is pixels, and
no amount of text parsing recovers it, so items whose passage is a
figure are flagged `necesita_figura` rather than silently shipped
broken.

Usage:
  python scripts/extraer-con-contexto.py <carpeta-pdfs> <salida.jsonl> [--area LC]
"""
import json
import pathlib
import re
import sys
import unicodedata

RE_PREGUNTA = re.compile(r'^\s{0,4}(\d{1,3})[.)]\s+(.+)$')
RE_OPCION = re.compile(r'^\s{0,6}([A-D])[.)]\s+(.+)$')

# The heading that opens a shared block, in the wordings the booklets
# actually use. The numbers tell us which questions it covers.
RE_BLOQUE = re.compile(
    r'(?:RESPONDA|CONTESTE)\s+(?:LAS?\s+)?PREGUNTAS?\s+'
    r'(\d{1,3})\s*(?:A|Y|HASTA(?:\s+LA)?)\s*(?:LA\s+)?(\d{1,3})',
    re.I,
)
# Some blocks introduce a single question.
RE_BLOQUE_UNO = re.compile(
    r'(?:RESPONDA|CONTESTE)\s+(?:LA\s+)?PREGUNTA\s+(\d{1,3})\b',
    re.I,
)
# A block heading with no numbers at all still marks a boundary.
RE_BLOQUE_SUELTO = re.compile(
    r'(?:DE\s+ACUERDO\s+CON|CON\s+BASE\s+EN|A\s+PARTIR\s+DE|SEG[UÚ]N)\s+'
    r'(?:EL|LA|LOS|LAS)\s+(?:SIGUIENTE|ANTERIOR)S?\s*'
    r'(?:INFORMACI[OÓ]N|TEXTO|GR[AÁ]FIC[AO]|TABLA|FIGURA|LECTURA|ESQUEMA)',
    re.I,
)
# Wording that says the stimulus is a picture, which text cannot carry.
RE_ES_FIGURA = re.compile(
    r'\b(gr[aá]fic[ao]|figura|tabla|esquema|diagrama|imagen|mapa|dibujo|plano|circuito|montaje|ilustraci[oó]n)\b',
    re.I,
)
# The stem pointing at a picture of its own, rather than at the passage
# a heading introduced.
RE_FIGURA_PROPIA = re.compile(
    r'\b(como se (ilustra|muestra|indica|observa|ve)|seg[uú]n (la|el) (figura|gr[aá]fic[ao]|esquema|diagrama)|'
    r'(en|de) la figura (adjunta|siguiente|anterior)|se muestra en la figura|'
    r'la figura (muestra|representa|ilustra))\b',
    re.I,
)

AREAS = {
    'matem': 'MAT', 'aritmet': 'MAT', 'geometr': 'MAT', 'algebra': 'MAT',
    'estadist': 'MAT', 'calculo': 'MAT', 'trigonometr': 'MAT',
    'lectura': 'LC', 'critica': 'LC', 'lenguaje': 'LC', 'espanol': 'LC',
    'ciencias nat': 'CN', 'biolog': 'CN', 'quimic': 'CN', 'fisica': 'CN',
    'ambiental': 'CN',
    'sociales': 'SOC', 'ciudadan': 'SOC', 'filosof': 'SOC', 'historia': 'SOC',
    'geografia': 'SOC', 'politic': 'SOC', 'economia': 'SOC', 'constitucion': 'SOC',
    'violencia': 'SOC',
    'ingles': 'ING', 'english': 'ING',
    'ciencias': 'CN',
}

MAX_CONTEXTO = 6000


def sin_tildes(texto: str) -> str:
    plano = unicodedata.normalize('NFD', texto.lower())
    return ''.join(c for c in plano if unicodedata.category(c) != 'Mn')


def area_de(nombre: str) -> str | None:
    plano = sin_tildes(nombre)
    for clave, area in AREAS.items():
        if clave in plano:
            return area
    return None


def limpiar(texto: str) -> str:
    texto = re.sub(r'Saber 11\s*-\s*\w+', ' ', texto)
    texto = re.sub(r'\d+\.?\s*ª?\s*sesi[oó]n', ' ', texto, flags=re.I)
    texto = re.sub(r'[A-Z]{2}\d{6,}', ' ', texto)
    # Page furniture that PyMuPDF reads in the same flow as the text:
    # the per-question timer and the question-number strip printed along
    # the page. Both landed inside option D, e.g. "El exceso de
    # nutrientes. 2 min 1 2 3 4 5 6 7".
    texto = re.sub(r'\s*\d{1,3}\s*min\b.*$', '', texto, flags=re.I)
    texto = re.sub(r'(?:\s+\d{1,3}\b){4,}\s*$', '', texto)
    texto = re.sub(r'\s+', ' ', texto)
    return texto.strip()


def limpiar_contexto(texto: str) -> str:
    """Keeps paragraph breaks: a reading passage is meant to be read."""
    texto = re.sub(r'Saber 11\s*-\s*\w+', ' ', texto)
    texto = re.sub(r'[A-Z]{2}\d{6,}', ' ', texto)
    texto = re.sub(r'^\s*\d{1,3}\s*$', '', texto, flags=re.M)   # page numbers
    texto = re.sub(r'[ \t]+', ' ', texto)
    texto = re.sub(r'\n{3,}', '\n\n', texto)
    return texto.strip()


def extraer(pdf_path: pathlib.Path) -> list[dict]:
    import pymupdf
    try:
        doc = pymupdf.open(pdf_path)
    except Exception:
        return []

    lineas: list[str] = []
    for page in doc:
        lineas.extend(page.get_text().split('\n'))
    doc.close()

    items: list[dict] = []
    actual: dict | None = None
    campo: str | None = None

    # The block currently in force, and the passage being collected.
    bloque: dict | None = None
    recogiendo_contexto = False
    buffer_contexto: list[str] = []

    def cerrar_contexto() -> None:
        nonlocal recogiendo_contexto
        if bloque is not None and buffer_contexto:
            bloque['texto'] = limpiar_contexto('\n'.join(buffer_contexto))
        recogiendo_contexto = False

    def guardar_actual() -> None:
        nonlocal actual
        if actual and len(actual['opciones']) == 4:
            items.append(actual)
        actual = None

    for linea in lineas:
        # A block heading starts a new stimulus and ends the previous one.
        m_bloque = RE_BLOQUE.search(linea)
        m_uno = RE_BLOQUE_UNO.search(linea) if not m_bloque else None
        m_suelto = (
            RE_BLOQUE_SUELTO.search(linea)
            if not m_bloque and not m_uno
            else None
        )

        if m_bloque or m_uno or m_suelto:
            guardar_actual()
            cerrar_contexto()
            if m_bloque:
                desde, hasta = int(m_bloque.group(1)), int(m_bloque.group(2))
            elif m_uno:
                desde = hasta = int(m_uno.group(1))
            else:
                # No numbers: it governs until the next heading.
                desde, hasta = 0, 10**6
            bloque = {
                'desde': desde,
                'hasta': hasta,
                'texto': '',
                'encabezado': linea.strip(),
            }
            buffer_contexto = []
            recogiendo_contexto = True
            campo = None
            continue

        m_op = RE_OPCION.match(linea)
        if m_op and actual is not None:
            letra, texto = m_op.group(1), m_op.group(2)
            actual['opciones'][letra] = texto.strip()
            campo = f'op:{letra}'
            continue

        m_pr = RE_PREGUNTA.match(linea)
        if m_pr:
            numero = int(m_pr.group(1))
            # A numbered line inside a passage is a list, not a question:
            # only treat it as one once we have left the passage, or when
            # the number falls inside the block's declared range.
            dentro_del_rango = (
                bloque is not None and bloque['desde'] <= numero <= bloque['hasta']
            )
            if recogiendo_contexto and not dentro_del_rango:
                buffer_contexto.append(linea)
                continue

            # A block covering questions 1 to 2 has nothing to say about
            # question 9. Letting it stand gave a question about a coil
            # the passage about charged plates: wrong context reads as
            # if it belonged, which is worse than having none.
            if (
                bloque is not None
                and bloque['hasta'] < 10**6
                and numero > bloque['hasta']
            ):
                bloque = None

            cerrar_contexto()
            if actual and len(actual['opciones']) == 4:
                items.append(actual)
            actual = {
                'numero': numero,
                'enunciado': m_pr.group(2).strip(),
                'opciones': {},
                # The passage is attached by value: later blocks must not
                # rewrite the context of questions already collected.
                'contexto': (bloque or {}).get('texto', ''),
                'encabezado': (bloque or {}).get('encabezado', ''),
            }
            campo = 'enunciado'
            continue

        if recogiendo_contexto:
            buffer_contexto.append(linea)
            if sum(len(x) for x in buffer_contexto) > MAX_CONTEXTO:
                cerrar_contexto()
            continue

        if actual is None:
            continue
        if not linea.strip():
            continue
        if campo == 'enunciado':
            actual['enunciado'] += ' ' + linea.strip()
        elif campo and campo.startswith('op:'):
            actual['opciones'][campo[3:]] += ' ' + linea.strip()

    guardar_actual()

    area = area_de(pdf_path.name) or area_de(pdf_path.parent.name)
    salida = []
    # Booklets restart their numbering per section, so the same number
    # appears many times in one file and the parser can also re-read a
    # question across a page break. The stem identifies an item; the
    # number does not. The first reading wins, because a later duplicate
    # is usually the one that picked up a neighbour's options.
    vistos: set[str] = set()
    for it in items:
        enunciado = limpiar(it['enunciado'])
        opciones = {k: limpiar(v) for k, v in it['opciones'].items()}
        contexto = it.get('contexto', '')

        # With a passage attached, a short stem is complete, so the old
        # 40-character floor only has to apply when it stands alone.
        minimo = 15 if contexto else 40
        if len(enunciado) < minimo or len(enunciado) > 3000:
            continue
        if any(len(v) < 2 or len(v) > 400 for v in opciones.values()):
            continue
        if len(set(opciones.values())) < 4:
            continue

        huella = sin_tildes(enunciado)[:160]
        if huella in vistos:
            continue
        vistos.add(huella)

        # A heading that announces a figure, with little or no text under
        # it, means the stimulus is a picture we did not capture.
        encabezado = it.get('encabezado', '')
        necesita_figura = bool(
            RE_ES_FIGURA.search(encabezado) and len(contexto) < 200
        )

        # A stem that points at its own figure ("como se ilustra en la
        # figura") carries a picture, not the passage above it. Physics
        # booklets run such questions one after another under a stale
        # heading, so an item about a coil was inheriting a passage
        # about charged plates — a wrong context is worse than none,
        # because it reads as if it belonged.
        if RE_FIGURA_PROPIA.search(enunciado):
            contexto = ''
            necesita_figura = True

        salida.append({
            'fuente': pdf_path.name,
            'numero': it['numero'],
            'area': area,
            'enunciado': enunciado,
            'opciones': opciones,
            'contexto': contexto,
            'necesita_figura': necesita_figura,
        })
    return salida


def main() -> None:
    root = pathlib.Path(sys.argv[1])
    destino = pathlib.Path(sys.argv[2])
    solo_area = None
    if '--area' in sys.argv:
        solo_area = sys.argv[sys.argv.index('--area') + 1]

    total = con_contexto = con_figura = 0
    por_area: dict[str, int] = {}

    with destino.open('w', encoding='utf-8') as out:
        for pdf in sorted(root.rglob('*.pdf')):
            for item in extraer(pdf):
                if solo_area and item['area'] != solo_area:
                    continue
                out.write(json.dumps(item, ensure_ascii=False) + '\n')
                total += 1
                if item['contexto']:
                    con_contexto += 1
                if item['necesita_figura']:
                    con_figura += 1
                if item['area']:
                    por_area[item['area']] = por_area.get(item['area'], 0) + 1

    print(f'ítems extraídos: {total}')
    print(f'  con contexto adjunto: {con_contexto}')
    print(f'  marcados necesita_figura: {con_figura}')
    print(f'  por área: {por_area}')


if __name__ == '__main__':
    main()
