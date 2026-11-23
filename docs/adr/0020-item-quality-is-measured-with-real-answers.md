# 20. Item quality is measured with real answers

**Status** — accepted

Recorded retroactively.

## Context

A question that almost everyone gets wrong is either hard or broken,
and the difference matters: a hard item belongs in the bank, a broken
one teaches something false.

**Ask a model to judge it.** Already happens at generation
([ADR 15](0015-the-verifier-comes-from-another-model-family.md)), and
it catches items whose stated answer is wrong. It cannot catch an item
that is technically correct but unanswerable as written, or one whose
distractor is accidentally also correct, or one whose wording misleads
everyone the same way. A model does not experience confusion.

Only answers from real learners separate those cases.

## Decision

Quality is computed from `Answer` rows, using standard item analysis
(`calidad.service.ts`):

| Measure | Threshold | Meaning |
|---|---|---|
| p (share correct) | < 0.2 | more likely broken than hard |
| p | > 0.95 | separates nobody |
| sample | < 20 answers | no verdict at all |

The verdicts are named rather than scored: `sano`, `muy_dificil`,
`muy_facil`, `distractor_muerto`, `sin_datos`. A name says what to do;
a number invites a threshold argument.

`distractor_muerto` is its own verdict because an option nobody ever
picks is a four-option question functioning as a three-option one,
which makes it easier than it looks and is invisible in p alone. That
is what `conteoOpciones` is for.

A failing item is **retired, not deleted**: `retirado` and
`motivoRetiro`. Answers reference items without a foreign key
(see [Modelo de datos](../MODELO-DE-DATOS.md)), so a learner's history
from October stays meaningful even after the item stops being served.

Below twenty answers there is no verdict. A small sample says nothing,
and acting on it would retire items for being unlucky.

## Consequences

Quality improves as the bank is used, with no extra model calls. The
measurement is free.

It is also slow: twenty answers on an item takes a while with few
learners. Early in the product's life most items read `sin_datos`,
which is honest rather than useless.

Writing this ADR found a small drift: the doc comment said a usable
item sits "roughly between 0.2 and 0.9" while `P_MAXIMO` was `0.95`.
The comment now names the constants instead of repeating their values,
which is the only way a second copy of a number stays right.

The thresholds are not configurable. That is deliberate — an item
analysis threshold set per deploy is a threshold that means different
things on different hosts — but it does mean changing one is a code
change.
