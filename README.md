# AICFES — exam item generator

An API that generates Colombian ICFES exam items with a language model, and
refuses the ones the model gets wrong.

The interesting part is not the generation. It is the boundary: a model
returns prose, and prose must not reach a database that an exam is built
from. Everything between those two points is this service.

**Stack** — NestJS · TypeScript · PostgreSQL · Prisma · Zod · OpenAI
**Status** — running at [aicfes.deviego.xyz](https://aicfes.deviego.xyz)

---

## The problem

An ICFES item is not free text. It has a context, a question, four options,
exactly one correct answer, a justification, and distractors that have to be
wrong *in the way that area expects* — a maths distractor is a plausible
arithmetic slip, a reading distractor is a plausible misreading.

A language model will happily return four options where two are correct, or
a distractor that is simply another right answer worded differently. Asking
it more nicely does not fix this. Checking its output does.

## How the boundary works

Three layers, each answering one way the model fails.

**Shape** is handled by the API. The request carries a JSON Schema in
strict mode, so generation is constrained to the item structure: a
markdown fence, prose around the object or a missing field cannot come
back at all.

**Correctness** is checked by solving the item a second time. The
verifier sees the question and the options, but not the answer, the
justification or the explanations. An item is rejected when the verdict
disagrees, when the verifier reports it as ambiguous or
multiply-correct, or when it is right but unconfident. This is what
catches an item claiming 2+2=5 with that option marked correct — it
passes every structural check, because it does agree with itself.

**Repetition** is caught twice: a hash of the normalised question
catches an exact repeat for nothing, and cosine distance over pgvector
embeddings catches a reworded one. Numbers survive normalisation, since
three apples and four apples are different items.

Verified items are kept in a bank and served again, least recently used
first. What the model produced is stored either way: a rejected
generation keeps its raw output and a `ParseStatus`, so a failure can be
read back rather than guessed at.

## Figures

Much of the exam cannot be asked in text alone: an angle needs its
triangle, a reading question needs its chart. Figures are drawn from
parameters rather than generated — a template is a function that takes
the question's numbers and returns the SVG.

The model names a template and supplies values; it never draws. An
image model asked for a diagram puts the wrong number on the wrong
side, which makes the question invalid rather than ugly.

Six templates so far, ordered by what the official booklets use: right
triangle, bar chart, data table, line chart, cartesian plane and
laboratory setup. Each costs nothing, weighs 1–4 KB, and produces its
own text alternative from the same values.

The specification is stored, not the image, so correcting a template
corrects every item that uses it.

## Practice sittings

A sitting mirrors a real Saber 11 — five areas weighted as they are
officially, across two sessions of four and a half hours — scaled to the
length the learner has. Scaling hands the rounding remainder back out,
so the parts sum to the whole.

Questions come from the bank, so starting a sitting is a query rather
than dozens of model requests. Grading reports accuracy per area,
weakest first, and the areas under 70% become the study plan.

## Running it

```bash
cp .env.example .env     # set OPENAI_API_KEY and JWT_SECRET
docker compose -f deploy/compose.yml up -d
```

Or against a local database:

```bash
npm ci
npx prisma migrate deploy
npm run start:dev
```

The API documents itself at `/api/docs`.

## Tests

```bash
npm test
```

The suite covers the two places where being almost right is not good
enough: the normalizer, which decides what counts as model output, and the
dashboard maths, which decides what a learner is told about their progress.

CI additionally asserts that the migrations build the schema from scratch
and that none of it has drifted from `schema.prisma`. That gap shipped
once — nine tables lived in the schema and in no migration, so a clean
database could not authenticate anyone — and the check is what keeps it
from shipping twice.

## Deployment

Images are built once in CI and deployed by commit SHA. Postgres stays on
an internal network and is never published. The API container runs
read-only with all capabilities dropped, and Traefik terminates TLS.

## Decisions

Written up in [`docs/adr`](docs/adr). The longer feature-by-feature
documentation is in [`docs/README-detallado.md`](docs/README-detallado.md).
