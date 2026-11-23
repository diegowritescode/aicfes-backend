# 25. The contrarreloj ladder is anchored to the real exam's pace

**Status** — accepted

Recorded retroactively.

## Context

The real exam gives 270 minutes for 254 questions, which is 64 seconds
each (`modos.ts:18-19`). A timed-practice feature has to decide what
"timed" means, and the first three modes decided it badly.

**The modes it replaces.** "Reto 5", "Sprint 10" and "Explosivo" all
worked out to sixty seconds a question (`modos.ts:4-8`). Three modes,
one pace — so there was no ladder to climb, and the mode named for
explosiveness was *slower* than the exam it was preparing someone for.
A learner who beat "Explosivo" had not practised under pressure; they
had practised at exam pace while being told it was a sprint.

The names were the second problem. "Sprint 10" tells a learner how many
questions, which is the least useful fact about a mode
(`modos.ts:14-15`).

## Decision

One number anchors the ladder, and the modes sit around it: below 64
seconds you are building up, at it you are rehearsing the real thing,
above it you are buying margin for the questions that need thinking
(`modos.ts:10-12`).

Five modes, each with a `nivel` so the interface can show where on the
ladder a learner is (`modos.ts:36-100`):

| Mode | Seconds/question | Nivel |
|---|---|---|
| Calentamiento | 90 | 1 |
| Ritmo real | 64 | 2 |
| Las cinco áreas | 64 | 2 |
| Bajo presión | 45 | 3 |
| Muerte súbita | 30 | 4 |

The names say what the mode is for rather than how long it is.

**No mode fixes an area.** Every one has `area: null`
(`modos.ts:46,57,68,79,90`), which sends the question picker to the
learner's weakness profile instead: `areaPrioritaria` for the area and
`temasDebiles` for the topic inside it
(`time-trial.service.ts:215,231`). A mode is a pace, not a subject. The
exception is "Las cinco áreas", which carries a `mix` of one question
per area because the point of that mode is the switching
(`modos.ts:92-98`).

**Retired modes are disabled, not deleted.** `MODOS_RETIRADOS` holds
the three old ids (`modos.ts:103`) and `ensureDefaultModes` sets
`enabled: false` on them rather than removing the rows
(`time-trial.service.ts:55-58`). A finished session still points at the
mode it was played under, so deleting the mode would orphan the
learner's own history (`time-trial.service.ts:52-54`).

## Consequences

The hardest mode is now genuinely harder than the exam, so finishing it
means something. That was not true before.

Both the pace lookups fail soft. `areaDebil` and `temaDebil` catch and
return null or undefined (`time-trial.service.ts:216-219,233-235`), so a
profile lookup can never stop someone from practising; they just get a
mode the generator chose for itself.

The anchor is a constant in source, not configuration. If ICFES changes
the exam's length the ladder is wrong until someone edits the file —
which is the right trade, since a pace that differs per deploy is a
pace that means nothing.

The per-mode `segundosPorPregunta` values are written out by hand, so
nothing in `src/` reads `SEGUNDOS_EXAMEN_REAL`. The tests do, and they
are what hold the anchor: `test/modos-contrarreloj.test.ts` asserts
that the constant equals `round(270 * 60 / 254)`, that at least one
mode sits exactly at it, and that every level-1 mode gives more time
than it — "el primer escalón es para entrar en ritmo, no para sufrir".

So a mode added with a pace that ignores 64 does fail a check, as long
as it is added to `MODOS`. A mode inserted straight into the database
would not be checked, but it would also not survive the next
`listModes` upsert.

Because the modes are upserted on every `listModes` call
(`time-trial.service.ts:22,44-49`), editing a mode in the database does
not survive the next request. The file is the source of truth, which is
intended, but it means there is no way to tune a mode without a deploy.
