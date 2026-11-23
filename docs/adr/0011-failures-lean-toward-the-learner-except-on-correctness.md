# 11. Failures lean toward the learner, except on correctness

**Status** — accepted

Recorded retroactively: the decision was made in the code and never
written down, and the asymmetry looks like an inconsistency until the
reason is stated.

## Context

Two guards sit in front of the same generation path and fail in
opposite directions.

`CuotaService.estado` cannot read what a learner has spent today — the
database is slow, or down. It **allows** the request
(`cuota.service.ts:130-144`).

`AnswerVerifierService.verify` cannot reach the verifying model. It
**rejects** the item (`answer-verifier.service.ts:122-127`).

Written as a rule, "fail open" and "fail closed" in the same request
path reads like someone forgot to be consistent.

## Decision

The direction of failure follows what the guard protects.

**The quota protects money, and money is recoverable.** A database
hiccup that locked every learner out of the product would be a worse
outcome than one request's worth of overspend. The cap exists to stop
runaway use, not to act as a second availability gate, and the miss is
bounded by a single request.

**The verifier protects correctness, and a wrong answer is not
recoverable.** An item that enters the bank unverified gets served, and
a learner who studies a question whose stated answer is wrong learns
something false — then carries it into the exam. There is no later
check that catches it.

So: a failure to measure costs us money. A failure to verify costs the
learner their preparation. The second is worse, so it is the one that
fails closed.

## Consequences

A quota reading that fails lets a request through at the free cap. The
log records it (`cuota.service.ts:135`), so a pattern of these is
visible rather than silent.

A verifier outage stops the bank from growing. That is the intended
behaviour and it is noisy: generation starts returning "verifier
unavailable", which is the right thing to notice.

`VERIFY_ANSWERS=false` exists and turns verification off entirely. It
is for local work. Setting it in production would quietly convert the
closed failure into an open one, which is the single most damaging
configuration mistake available in this system — worth knowing before
someone reaches for it to unblock a deploy.

The two directions have to stay explained. The next guard written here
should state which thing it protects before choosing how it fails.
