# 12. Costs are integers, and rounding goes against us

**Status** — accepted

Recorded retroactively.

## Context

Every model call has a price, and the daily cap is in dollars rather
than in questions (see [ADR 13](0013-the-cap-is-money-not-questions.md)).
That makes the cost ledger the thing the cap reads, so its arithmetic
decides whether the cap means anything.

Three ways to store a price were available.

**Floating-point dollars.** Rejected: `0.1 + 0.2` is not `0.3`, and a
ledger summed thousands of times a day accumulates error in whichever
direction the rounding happens to fall. A cap compared against a drifting
total is a cap nobody can reason about.

**Integer cents.** Too coarse. A single generation costs on the order
of a cent, so a cent is the whole unit of measurement — half the rows
would round to zero and the free cap, at 25 cents a day, would be
unmeasurable.

**Integer thousandths of a cent.** Chosen.

## Decision

`ConsumoLlm.costoMilicent` is an integer in thousandths of a cent:
100,000 units to the dollar (`costos.service.ts:54`). Reading a total
divides by 100,000 at the edge (`costos.service.ts:98`).

Rounding is `Math.ceil`, not `Math.round`
(`costos.service.ts:54`). Every row is charged at least its true cost
and usually a hair more. Over a day of requests that difference is
cents; what it buys is that the ledger can never report less than what
was actually spent, which is the direction that matters when the number
is deciding whether to allow a paid request.

An unknown model is charged at `PRECIO_DESCONOCIDO` rather than at zero
(`costos.service.ts:51`). A model nobody has priced yet is a model that
would otherwise be free to call without limit — the cheapest mistake to
make and the most expensive to discover.

Writing a cost row never throws (`costos.service.ts:57-59`). A failed
ledger write must not fail the learner's request that produced it: the
work was already done and the money already spent, so refusing to
deliver it punishes the learner for our bookkeeping.

## Consequences

The cap is comparable against a number that cannot drift.

Prices live in a table in code (`PRECIOS`), so a provider's price change
is a code change. That is deliberate: a price read from configuration is
a price that can be set wrong on one host and right on another, and the
ledger would then disagree with itself across deploys.

The never-throw rule means a database problem loses cost rows silently.
Combined with ADR 11, a learner can briefly spend unmetered during a
database outage. Bounded, logged, and the right trade.

Integers in thousandths of a cent are not obvious to read in a query.
`costoMilicent / 100000` gives dollars; the column name is the only
hint, which is why it says `milicent` rather than `costo`.
