# 4. The model proposes, the system decides

**Status** — accepted

## Context

The service asks a language model for exam items. Three failures matter,
and prompting addresses none of them reliably:

- **Shape.** Markdown fences, prose around the JSON, a missing field.
- **Correctness.** An item whose marked answer is wrong. The structural
  checks could only prove an item agreed with itself: one claiming 2+2=5,
  with that option labelled `correcta`, passed every one of them.
- **Repetition.** The same question generated again, with nothing to
  notice.

## Decision

Three layers, each answering one failure.

**Shape** is handled by the API. The request carries a JSON Schema in
strict mode, so generation is constrained to the item structure and a
malformed item cannot come back.

**Correctness** is checked by solving the item a second time. The
verifier sees the question and the options, but not the answer, the
justification or the explanations. The item is rejected when the verdict
disagrees, when the verifier reports it as ambiguous or multiply-correct,
or when it is right but unconfident.

**Repetition** is caught twice: a hash of the normalised question for an
exact repeat, costing nothing, and cosine distance over pgvector
embeddings for a reworded one. The cheap check runs first.

## Consequences

Items are discarded, and a learner waits while another is generated.
That is the intended trade: a wrong item in a practice exam teaches
someone the wrong thing, and a repeated one wastes their session.

Verification costs a second request per item. The bank is what makes
that affordable — the cost is paid once and the item is reused.

A verifier that cannot be reached rejects rather than approves. Failing
open would admit everything at exactly the moment the check stopped
working.

The embedding threshold is a judgement, not a fact. It is configurable
through `DEDUP_THRESHOLD`, default 0.92.
