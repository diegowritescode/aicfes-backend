# 13. The cap is money, not questions

**Status** — accepted

Recorded retroactively.

## Context

Generation costs real money per request, so something has to limit it.
The obvious limit is a count: "fifty questions a day".

A count is wrong here, and measurably so. What a question costs varies
with the model used, the area (a reading-comprehension item carries a
whole passage; a Matemáticas item is three lines), the length of the
answer, and whether a figure has to be specified. The same "fifty
questions" can differ several-fold in cost between two learners who
study different subjects.

A count also cannot be reasoned about from the only number that
matters, which is the bill.

## Decision

The cap is in dollars per day, per account
(`cuota.service.ts:53-55`):

| Plan | Daily cap |
|---|---|
| `gratis` | 0.25 USD |
| `pago` | 3.00 USD |
| `semilla` | 10.00 USD |

The free cap is set near what a genuine study session costs — around
twenty-five questions — rather than at a round number. A real learner
should never meet it; a script meets it in seconds. That is the whole
point of the number.

The check runs **before** the work, against what has already been
spent, because what this request will cost is not known until the
models have answered. A learner just under the cap can therefore
overrun it by one request. That is the price of not charging for work
before doing it, and it is bounded by `MAX_ITEMS`.

A single request large enough to clear the whole allowance is refused
even when the learner has spent nothing (`cuota.service.ts:147-153`).
Without that, one call for a hundred questions passes the check — which
saw a spend of zero — and the cap never applies.

The day resets at UTC midnight (`cuota.service.ts:111-119`), so a
learner who hits the cap knows when it clears rather than having it
trickle back unpredictably.

`semilla` accounts are named in `USUARIOS_SEMILLA` on the server, not
flagged in the database. Stocking the bank is a few hundred items in an
afternoon, which is exactly the shape the free cap exists to stop — and
a list in the environment is visible in the config and empty unless
someone deliberately writes it, where a database flag could be set by
accident.

## Consequences

The cap tracks the bill, which is the only number worth capping.

It depends on the cost ledger being right, which is why that ledger
uses integers and rounds against us (see
[ADR 12](0012-costs-are-integers-and-round-against-us.md)).

A learner cannot be told "you have twelve questions left" exactly —
only approximately, by dividing what remains by an estimated cost per
question (`COSTO_ESTIMADO_PREGUNTA_USD`, measured at 0.009). The
message says "puedes pedir hasta N", which is honest about being an
estimate without saying so out loud.

The UTC day means the reset lands at 7pm in Colombia, not at midnight.
That is wrong for a learner and is noted as such: the error-of-the-day
feature already uses the learner's own timezone, and the cap should
eventually do the same.
