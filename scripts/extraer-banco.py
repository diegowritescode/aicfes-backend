"""Extracts real exam items from the official booklets.

The booklets are the only asset a competitor cannot copy, and today the
generator never sees them. This turns the readable ones into structured
items so a prompt can carry real examples of the same topic.

Only PDFs that already contain text are read. The scanned 45% needs OCR,
which is a separate job with its own error budget.

Output is JSONL: one item per line, easy to inspect, append and diff.
"""
import json, pathlib, re, sys, unicodedata

# A question starts at a line beginning with its number.
RE_PREGUNTA = re.compile(r'^\s{0,4}(\d{1,3})[.)]\s+(.+)$')
# Options appear as "A." or "A)" at the start of a line.
RE_OPCION = re.compile(r'^\s{0,6}([A-D])[.)]\s+(.+)$')
# Shared stimulus blocks introduce several questions at once.
RE_BLOQUE = re.compile(r'RESPONDA LAS PREGUNTAS?\s+(\d+)\s*(?:A|Y)\s*(\d+)', re.I)

# Booklets are usually named after the subject, not the exam area, so
# the subjects map onto the five areas the exam actually reports.
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
    # Checked last: 'ciencias' alone would swallow 'ciencias sociales'.
    'ciencias': 'CN',
}


def area_de(nombre: str) -> str | None:
    plano = unicodedata.normalize('NFD', nombre.lower())
    plano = ''.join(c for c in plano if unicodedata.category(c) != 'Mn')
    for clave, area in AREAS.items():
        if clave in plano:
            return area
    return None


def limpiar(texto: str) -> str:
    # Scanned-page furniture that would otherwise land inside an item.
    texto = re.sub(r'Saber 11\s*-\s*\w+', ' ', texto)
    texto = re.sub(r'\d+\.?\s*ª?\s*sesi[oó]n', ' ', texto, flags=re.I)
    texto = re.sub(r'[A-Z]{2}\d{6,}', ' ', texto)          # barcodes
    texto = re.sub(r'\s+', ' ', texto)
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

    for linea in lineas:
        m_op = RE_OPCION.match(linea)
        if m_op and actual is not None:
            letra, texto = m_op.group(1), m_op.group(2)
            actual['opciones'][letra] = texto.strip()
            campo = f'op:{letra}'
            continue

        m_pr = RE_PREGUNTA.match(linea)
        if m_pr:
            # A new number only starts an item if the previous one is
            # complete; otherwise it is a numbered list inside a stimulus.
            if actual and len(actual['opciones']) == 4:
                items.append(actual)
            elif actual:
                actual = None
            actual = {
                'numero': int(m_pr.group(1)),
                'enunciado': m_pr.group(2).strip(),
                'opciones': {},
            }
            campo = 'enunciado'
            continue

        if actual is None:
            continue
        if not linea.strip():
            # A blank line is layout, not the end of a sentence: the stem
            # often continues after a page break.
            continue
        # Continuation of whatever field is open.
        if campo == 'enunciado':
            actual['enunciado'] += ' ' + linea.strip()
        elif campo and campo.startswith('op:'):
            actual['opciones'][campo[3:]] += ' ' + linea.strip()

    if actual and len(actual['opciones']) == 4:
        items.append(actual)

    area = area_de(pdf_path.name) or area_de(pdf_path.parent.name)
    salida = []
    for it in items:
        enunciado = limpiar(it['enunciado'])
        opciones = {k: limpiar(v) for k, v in it['opciones'].items()}
        # Guards against fragments the regex happened to match.
        if len(enunciado) < 40 or len(enunciado) > 3000:
            continue
        if any(len(v) < 2 or len(v) > 400 for v in opciones.values()):
            continue
        if len(set(opciones.values())) < 4:
            continue
        salida.append({
            'fuente': pdf_path.name,
            'numero': it['numero'],
            'area': area,
            'enunciado': enunciado,
            'opciones': opciones,
        })
    return salida


def main() -> None:
    root = pathlib.Path(sys.argv[1])
    destino = pathlib.Path(sys.argv[2])
    total = 0
    con_area = 0
    with destino.open('w', encoding='utf-8') as out:
        for pdf in sorted(root.rglob('*.pdf')):
            for item in extraer(pdf):
                out.write(json.dumps(item, ensure_ascii=False) + '\n')
                total += 1
                if item['area']:
                    con_area += 1
    print(f'ítems extraídos: {total}')
    print(f'  con área identificada: {con_area}')


if __name__ == '__main__':
    main()
