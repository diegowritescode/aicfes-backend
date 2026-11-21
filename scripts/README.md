# Scripts

## `extraer-banco.py`

Reads the official booklets and writes one JSON item per line.

```bash
python3 scripts/extraer-banco.py <carpeta-de-pdfs> banco.jsonl
```

Only PDFs that already contain text are read — roughly 55% of the
material. The rest are scans and would need OCR, which is a separate
job with its own error budget.

A stem is not required to end in punctuation: the ICFES style leaves it
open and the option completes the sentence.

## `cargar-referencia.ts`

Loads extracted items into the reference bank with their embeddings, so
the generator can retrieve real examples of a topic.

```bash
DATABASE_URL=... OPENAI_API_KEY=... npx tsx scripts/cargar-referencia.ts scripts/banco-referencia.json
```

Costs one embedding request per batch of 64. At current rates the
bundled 2,374 items are a few cents, paid once.

Safe to re-run: items already loaded are skipped by hash before any
embedding is requested, so an interrupted load resumes rather than
duplicating or paying twice.

Load a subset first to check the wiring:

```bash
npx tsx scripts/cargar-referencia.ts scripts/banco-referencia.json 20
```

## `banco-referencia.json`

2,374 items extracted from the official booklets, by area:

| Área | Ítems |
|---|---|
| SOC | 854 |
| CN | 795 |
| MAT | 362 |
| LC | 211 |
| ING | 152 |

These are never served to a learner. They are the examples the
generator reasons from, which is what keeps generated items in the
register of the real exam.
