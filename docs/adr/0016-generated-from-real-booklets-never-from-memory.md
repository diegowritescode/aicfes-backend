# 16. Items are generated from real booklets, never from memory

**Status** — accepted

Recorded retroactively.

## Context

An ICFES question has a particular shape: a stimulus, a stem that
depends on it, four options where the wrong ones are wrong in
recognisable ways. A model asked to "write a Saber 11 question" writes
something that resembles one at a glance and misses that shape.

**Rely on the model's training.** It has seen ICFES questions. But what
it reproduces is an average of everything it has seen labelled as an
exam question, and the specific conventions — how Lectura Crítica
phrases an inference item, what counts as a plausible distractor in
Matemáticas — are exactly what averaging destroys.

## Decision

Generation is retrieval-augmented. Each request pulls four real items
from the same area out of `ItemReferencia` — 2,374 items extracted from
official booklets (`scripts/README.md:42`) — and the model writes with
those in front of it.

The reference items are **evidence, never content**. They are not served
to a learner under any route. Two separate reasons: they are copyrighted
material, and the point is to produce new questions rather than to
redistribute old ones.

The right answer is withheld from the reference material in the prompt.
A model shown the answer tends to write a question whose answer is in
the same position for the same reason.

The reference bank is indexed by a hash of the stem, not by
`fuente#numero` (`064fe56`). Booklet numbering collides across years:
indexing by source and number collapsed 2,374 items into 1,223.

## Consequences

Generation cost includes a similarity search over the reference bank
per item. Measured and accepted.

The quality of generated items depends on the breadth of the reference
bank. The areas with the most reference material — SOC 854, CN 795 —
produce the most faithful items; ING, with 152, produces the least.
That is visible in the bank and worth watching.

A question whose area has no reference items would be generated from
the model's memory alone. That case does not arise today because all
five areas have material, but nothing enforces it.

`ItemReferencia` has an embedding column with no vector index, so the
similarity search is a sequential scan over the area. At 2,374 rows
this is cheap; it will not stay cheap.
