# 19. The bank is reused, not regenerated

**Status** — accepted

Recorded retroactively.

## Context

The first version generated questions on every request. A learner
practising Matemáticas twice paid for two sets of items, and the first
set was discarded.

That is the wrong shape for this product twice over. Generation costs
money per item and takes minutes, so it is the most expensive operation
in the system; and a verified item is the most valuable thing in it,
because it survived cross-model verification
([ADR 15](0015-the-verifier-comes-from-another-model-family.md)).
Throwing it away after one use discards the expensive part.

## Decision

Generated items are stored and served again. Generation happens to
**stock** the bank, not to answer a request.

Items are drawn least-recently-served first: `lastServedAt` ascending
with nulls first, then `timesServed` ascending
(`item-bank.service.ts:144`). An item nobody has seen comes before one
served last week, which comes before one served twice.

Only `verified: true` items are drawn (`item-bank.service.ts:139`). An
item that failed verification stays in the table — it is evidence about
what the generator gets wrong — and is never served.

Serving updates both counters in one `updateMany`
(`item-bank.service.ts:148-152`), so a draw of ten items is one write.

The caller can exclude ids (`excludeIds`), which is how a single
session avoids repeating an item it already showed.

## Consequences

Practice is nearly free once the bank is stocked. That is what makes a
254-question sitting possible at all: generating it on demand would
cost more than the sitting is worth and take longer than a learner
would wait.

The bank has to be stocked before anyone can use the product, which is
why `semilla` accounts exist
([ADR 13](0013-the-cap-is-money-not-questions.md)) and why the free cap
would otherwise stop the person filling it.

A learner who practises the same area for long enough will see repeats.
Least-recently-served delays that as long as the bank allows, and the
bank's size is therefore a product constraint, not just a cost one.

`timesServed` counts draws, not answers. An item drawn into a session
the learner abandoned still counts as served and goes to the back of
the queue. That is a small unfairness in the ordering and not worth
fixing: the cost of an item seen slightly later is nothing.
