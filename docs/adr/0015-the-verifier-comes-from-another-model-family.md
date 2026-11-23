# 15. The verifier comes from another model family

**Status** — accepted

Recorded retroactively. Extends
[ADR 4](0004-the-model-proposes-the-system-decides.md), which
established that generated items are checked before being served but
not by whom.

## Context

Every generated item is solved by a model before it enters the bank. If
the verifier's answer disagrees with the stated one, the item is
rejected.

The question is which model verifies.

**The same model that wrote it.** Cheapest, and worthless where it
matters most. A model that misreads a question the same way twice
confirms its own mistake. The blind spots that produce a wrong answer
are exactly the blind spots that fail to notice it.

**A larger model from the same provider.** Better — it does not share
the smaller model's capacity limits — but it does share its training
and its tokenizer, so systematic errors survive.

**A model from a different family.** Chosen.

## Decision

Verification prefers Anthropic when `ANTHROPIC_API_KEY` is configured
(`verificador-claude.service.ts:45`), and falls back to a larger
OpenAI model otherwise (`answer-verifier.service.ts:119`, default
`gpt-5`).

Without the key, the service logs that cross-family verification is off
(`verificador-claude.service.ts:48`) rather than failing silently. A
weaker check that announces itself is better than a weaker check that
looks like the strong one.

An unreachable verifier rejects the item rather than approving it. See
[ADR 11](0011-failures-lean-toward-the-learner-except-on-correctness.md)
for why that direction.

## Consequences

Two providers, two keys, two bills. The verification cost is real and
is recorded like any other (`ConsumoLlm`).

A disagreement is not proof the item is wrong — it is proof that two
independent models do not agree, which is enough reason not to serve it
to someone preparing for an exam. Items rejected this way are not
retried.

The fallback matters more than it looks: a deploy that forgets
`ANTHROPIC_API_KEY` silently downgrades to same-provider verification
and keeps working. The log line is the only signal, so it is worth
grepping for after a deploy.

Local bank-filling has used the `claude` CLI against a personal
subscription, which is fine for local work and **not** for production:
a consumer subscription is not licensed for commercial use. Production
goes through the API.
