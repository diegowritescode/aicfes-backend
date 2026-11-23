# 28. Cost is recorded after the answer is sent

**Status** — accepted

Recorded retroactively.

## Context

Every model request has a price, and pricing a subscription needs to
know what serving one learner for a month actually costs
(`costos.service.ts:6-10`). So each request writes a `ConsumoLlm` row.

That write sits on the path of a learner waiting for a question. Two
ways to place it.

**Await the write before replying.** Correct accounting, and it makes
the learner pay for our bookkeeping: a database round trip added to
every generation, and — worse — a failed insert turning a perfectly
good question into an error. The money is already spent by then. The
model has been called, the tokens are billed, the item exists. Refusing
to hand it over because we could not write a row about it loses the
question *and* the row.

**Record it off the response path.** The cost row is our problem, not
the learner's.

## Decision

Cost recording is fire-and-forget. `registrar` is declared as returning
`void` and discards the promise with an explicit `void` operator
(`openai.service.ts:68-76`), so neither call site awaits it: the plain
request (`openai.service.ts:53`) and the schema-constrained one
(`openai.service.ts:121`) both record and return immediately.

It is belt and braces, because the promise nobody awaits would
otherwise reject unhandled. `CostosService.registrar` catches its own
failure and logs a warning (`costos.service.ts:85-87`), with the reason
written above it: a failure to write a cost row must not fail the
learner's request that produced it (`costos.service.ts:58-59`).

The same reasoning governs indexing, which needs an embedding request
per item and so runs after the response is on its way
(`items.controller.ts:270-276`).

**Checking the cap is the opposite case and stays blocking.**
`CuotaGuard` awaits `planDe` and `puedeGenerar` before the route runs
(`cuota.guard.ts:36-37`), because that decides whether to spend at all
(see [ADR 13](0013-the-cap-is-money-not-questions.md)). Recording what
was spent is after the fact; deciding whether to spend is not. Both
touch the same module ([ADR 27](0027-measurement-lives-in-its-own-module.md)),
and the difference is whether the answer changes what we do next.

## Consequences

A learner never waits on accounting, and a database hiccup degrades the
books rather than the product.

The books can therefore be short. A row lost to a failed insert, or to
the process exiting between the reply and the write, is lost silently —
there is no retry and no queue. All that survives is a warning in the
log. Since cost is read as a median across many requests
(`costos.service.ts:103-107`), a few missing rows move the number
slightly rather than invalidating it, which is why this is acceptable
here and would not be in billing a customer.

The cap is enforced against what was recorded, so a learner whose cost
rows went missing gets slightly more than their plan allows. The error
leans toward the learner, which is the house rule
([ADR 11](0011-failures-lean-toward-the-learner-except-on-correctness.md)).

Tests cannot observe the write by awaiting the call. Anything checking
that a cost row was written has to poll or wait, and nothing in the
code points that out.

Token counts are read defensively — `usage?.input_tokens ?? 0`
(`openai.service.ts:72-75`) — so a response shaped differently than
expected records a request at zero cost rather than crashing a
background promise. An unknown *model*, by contrast, is priced high on
purpose so cost is never silently zero (`costos.service.ts:33-34`).
Those two defaults disagree, and only the second one is deliberate.
