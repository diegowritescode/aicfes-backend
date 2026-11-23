# 31. Contrarreloj draws from the bank, entrenar generates

**Status** — accepted

Decided 23 November 2026 by Diego, who asked for whichever option was
best for the product rather than cheapest to build.

## Context

Two paths put questions in front of a learner, and until now both paid
the model for every one of them.

**What the bank holds.** Measured against production on 23 November
2026 via `GET /api/items/bank/stats`: 326 verified items — 53 LC, 68
MAT, 63 SOC, 73 CN, 69 ING — enough to fill a 254-question sitting. A
draw of 60 through `/api/items/lote-offline` returned items at `facil`,
`media` and `alta` across all five areas, so the bank covers the
difficulties the contrarreloj modes ask for (`media` and `alta`).

**Who drew from it.** Only `simulacro.service.ts:76` and
`lote-offline.service.ts:79`. Contrarreloj and entrenar called
`generator.generate` instead:
`time-trial.service.ts`, and `items.controller.ts:218` and `:481` for
entrenar's `/api/items/generate` and `/api/items/generate-mixed`.

**What that cost.** A contrarreloj round of eight questions was eight
model requests for questions that already existed. "Las cinco áreas"
made five such calls **in sequence**, which is the whole of why that
mode felt slow.

Nothing about the client blocked reuse. `esquemas.ts` in the mobile app
already marks `plantilla` optional with the comment that the bank
serves the same questions without it, "Required here, the two sources
could never mix" — the schema was written for this.

## Decision

The two modes are treated differently, because novelty is worth
different amounts in each.

**Contrarreloj draws from the bank first and generates only the
shortfall.** A round is short and the point is pace, so meeting an item
a second time costs a learner little. `draw` orders by `lastServedAt`
ascending, so the least recently seen come first.

**Entrenar keeps generating.** It is the longer, deliberate path where
a learner works through unfamiliar material, and novelty earns its
price there.

Generation stays as the fallback rather than being removed, so a thin
area still fills a round instead of refusing it.

## Consequences

A contrarreloj round normally costs nothing and returns at the speed of
a database query. The mixed mode in particular stops making five
sequential model calls.

A learner who plays contrarreloj heavily will meet repeats. That is the
accepted cost, and it is bounded by `lastServedAt` ordering: the repeat
is always the oldest thing they have seen.

Two details the arithmetic has to respect, both pinned in
`test/fuente-de-preguntas.test.ts`:

- `draw` marks every row it returns as served, so a round must not draw
  more than it will show. Otherwise items age without anyone seeing
  them.
- The mixed mode threads its exclusions across sections. A draw is by
  area and difficulty, so without this two sections of one round could
  serve the same row twice.

The arithmetic lives in `fuente-de-preguntas.ts` as a pure function
rather than inside the service, because testing it through Nest's
injection would mean mocking three services to assert one subtraction.

## Alternatives

**Keep generating everything.** Infinite variety, paid for on every
round. Rejected: the variety is not worth much in a mode whose point is
pace, and the cost recurs for questions already on hand.

**Move entrenar to the bank too.** Rejected for now. Entrenar is where
a learner spends real time, and a repeat there is a wasted session
rather than a cheap one.
