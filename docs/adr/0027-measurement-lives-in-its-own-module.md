# 27. Measurement lives in its own module

**Status** — accepted

Recorded retroactively.

## Context

Several things in this system are measured as a side effect of
something else happening. Generating an item costs money that has to be
recorded. Answering a question produces data for item quality
([ADR 20](0020-item-quality-is-measured-with-real-answers.md)) and for
the weakness profile. The measurement is not the feature; it is what
the feature leaves behind.

The question is where that code lives. Nest resolves providers through
module imports, so the answer is a graph question, not a taste question.

**Inside `items`.** The generator is where cost is incurred, so it
reads as the natural home. But `dashboard` records an answer the moment
a learner submits one (`dashboard.controller.ts:474,485`), so
`dashboard` would have to import `items`. `items` already imports
`dashboard` (`items.module.ts:14,17`), so that closes a cycle.

**Inside `dashboard`.** Same problem from the other side. `items` would
have to import `dashboard` for the cost recorder, which it does, while
`dashboard` would be importing nothing from `items` — until the next
thing that measures at generation time.

Nest can be made to tolerate a cycle with `forwardRef`, which works and
costs nothing at runtime. It is still two modules that cannot be
reasoned about separately, for no gain.

## Decision

Measurement is its own module, and the reason is written where someone
would look for it (`calidad.module.ts:9-13`).

`CalidadModule` provides and exports five services — `CalidadService`,
`CostosService`, `CuotaService`, `DebilidadesService`,
`ErrorDelDiaService` — and imports only `PersistenceModule`
(`calidad.module.ts:14-18`).

**The dependency runs one way, always.** Nothing under `src/calidad/`
imports from `items` or `dashboard`. Four modules import
`CalidadModule`: `items` (`items.module.ts:13,17`), `dashboard`
(`dashboard.module.ts:2,9`), `time-trial`
(`time-trial.module.ts:7,10`) and `tutoria`
(`tutoria.module.ts:6,9`). None of them is imported back.

## Consequences

Any feature can record a measurement by importing one module, and the
fourth and fifth consumers cost nothing structurally — `time-trial` and
`tutoria` arrived later and needed no rearranging. The alternative
would have forced a cycle on each one.

`CalidadModule` knows nothing about who records into it, so a
measurement cannot reach back into the feature that produced it. That is
the constraint that keeps the direction honest, and it is why cost
recording has to be fire-and-forget rather than something the generator
awaits (see
[ADR 28](0028-cost-is-recorded-after-the-answer-is-sent.md)).

The cost is a module whose name describes a cross-section rather than a
feature. "Calidad" now holds cost accounting, quota enforcement, the
weakness profile and the error of the day, which have little to do with
each other beyond all being things measured about a learner. Someone
looking for quota logic will not guess it is there.

Nothing enforces the direction. The import graph is one way today
because nobody has written the import that would break it; there is no
lint rule and no test that would fail if someone did.
