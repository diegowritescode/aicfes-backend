# 23. The schema constrains the model, not the prompt

**Status** — accepted

Recorded retroactively. Sharpens
[ADR 1](0001-validate-model-output-instead-of-trusting-it.md), which
established that output is validated; this is about where the format
is specified.

## Context

Generation asks for JSON with a particular shape. Two places can
describe that shape: the prompt, in prose, and the JSON Schema the API
enforces.

Having both seemed harmless and was not. Instructions in the prompt
("return an object with a `parametros` field containing…") drift from
the schema as the schema changes, and the model then satisfies the
prose and fails the schema — or worse, satisfies both in different
ways on different calls.

A specific failure made this concrete. The figure specification was
first modelled as an open `parametros` object. OpenAI's strict mode
**rejects an open object**, and the rejection arrived as a generation
failure for Matemáticas and Ciencias Naturales in production — the two
areas that need figures.

## Decision

The JSON Schema is the only authority on format. Instructions about
shape were removed from the prompts
(`1d90a1c`); the prompts describe what to write, not how to encode it.

A figure is a discriminated union: one branch per template, each with
its own required parameters, combined with `anyOf`
(`item.json-schema.ts:55`). Strict mode accepts that because every
branch is closed.

Zod schemas on our side use `.strict()` (`item.schema.ts:9,16,23`), so
a field the model invents is an error rather than silently ignored.

The template name comes from an enum the model cannot invent. It picks
from a list and supplies values, which is the part a language model
does well — see
[ADR 6](0006-figures-are-drawn-from-parameters.md).

## Consequences

One place to change when the shape changes, and the model is
constrained by the thing that actually enforces it.

A new figure template means a new branch in the union. More verbose
than an open object, and the verbosity is what makes strict mode
possible.

`.strict()` means a field added server-side in a response breaks a
client that has not been updated. That is the intended direction for
generation — an unexpected field is a bug — and the opposite of the
rule at the HTTP boundary, where unknown keys pass through so the
backend can evolve. Two different rules for two different problems,
worth not confusing.

The schema is large and hand-maintained. There is no generation of it
from the Zod types, so the two can drift. Nothing checks that today.
