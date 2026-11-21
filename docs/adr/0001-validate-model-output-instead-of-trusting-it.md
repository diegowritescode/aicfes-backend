# 1. Validate model output instead of trusting it

**Status** — accepted

## Context

The service asks a language model for ICFES exam items. The model returns
text. An item is a structured object with constraints that matter: exactly
one correct answer, four options, distractors that are wrong in the way
their area expects.

Models return markdown fences, prose around the JSON, an `items` envelope,
a single object where a list was asked for, two correct answers, or a
distractor that is a second right answer worded differently. Prompting
reduces how often this happens. It does not make it stop.

## Decision

Treat model output as untrusted input, the way a request body is untrusted.
Nothing the model produces reaches the database without passing a schema
and a set of content rules.

The pipeline is normalize, validate the shape with Zod, validate the
content against the rules for the area, then trim to display limits.
Rejections are stored with the raw output and a `ParseStatus`.

## Consequences

Some generations are discarded and the user waits for a retry. That is the
cost, and it is the right one: a wrong item in a practice exam teaches
someone the wrong thing.

Keeping the raw output means a failure can be read back later. Without it,
a rejection is a dead end and the prompt cannot be improved from evidence.

The validation rules are now the specification of what an item is. They
belong in tests, which is why the normalizer is the most tested unit here.
