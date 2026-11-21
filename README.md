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

Raw model text passes through four stages before a row is written:

1. **Normalize** — strip the markdown fence, recover JSON from surrounding
   prose, unwrap the `items` or `data` envelope the model sometimes adds,
   and wrap a lone object in an array so callers always get a list.
2. **Validate the shape** — a Zod schema over every field. Anything that
   does not match is rejected, not coerced.
3. **Validate the content** — distractors are checked against the rules for
   their area, the correct answer is checked for type agreement with the
   distractors, and the options are checked against the distractor list.
4. **Trim** — fields are cut to the lengths the interface can display,
   ellipsis included in the limit.

What the model produced is stored either way. A rejected generation keeps
its raw output and a `ParseStatus`, so a failure can be read back and
understood rather than guessed at.

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
