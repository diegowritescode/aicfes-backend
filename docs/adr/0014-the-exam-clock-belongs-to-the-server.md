# 14. The exam clock belongs to the server

**Status** — accepted

Recorded retroactively.

## Context

A sitting is 254 questions in 270 minutes. Something has to decide when
time is up.

**A countdown in the client.** The obvious choice, and wrong in a way
that only shows up on a phone. Browsers throttle timers in a hidden
tab; a backgrounded app gets no timer at all. A learner who switches
away and comes back would find a clock that stopped while they were
gone — and the fix for that would be trusting the device's own clock,
which the learner can simply change.

**The server decides, and the client displays.** Chosen.

## Decision

`startedAt` and `minutos` are stored when the sitting begins, and the
remaining time is computed from the server's clock each time it is
asked (`simulacro.service.ts:113-117`). The client renders what it is
told; it never decides.

Every route that changes a sitting loads it through one function, which
closes it first if its time ran out while the learner was away
(`simulacro.service.ts:119-127`). One place decides "is this still
running?", so two routes cannot answer differently.

Leaving does not penalise. The clock does not pause either: a sitting
mirrors the real exam, where walking out of the room does not stop time
(see [ADR 5](0005-practice-sittings-mirror-the-real-exam.md)).

The remaining time is never negative — `Math.max(0, …)` — so a client
that polls after expiry gets zero rather than a negative number it
would have to special-case.

## Consequences

Changing the device clock does nothing, which is what makes the score
comparable to a real sitting.

Closing a sitting is lazy: it happens on the next request that touches
it, not on a timer. A sitting whose time ran out and that nobody ever
opens again stays `en_curso` in the database until someone does. That
is acceptable — nothing reads an abandoned sitting — but a query
counting open sittings will overcount, and anyone writing one should
know.

The client still needs a countdown to show, and it will drift from the
server's. It is refreshed on each request, so the drift is bounded by
how often the learner interacts. The number on screen is an
approximation of a truth held elsewhere, which is the correct
relationship.
