# 36. The weekly report gets a week, and the plan gets a topic

Date: 2026-11-27

## Status

Accepted

Amends ADR 35, which recorded the first three of these as known
limits.

## Context

ADR 35 shipped a weekly report that was honest but thin. Five gaps
were listed against it, and four of the five turned out to be the
same gap wearing different clothes: **data that was already being
written and never read.**

**The plan could not be executed.** Each action carried `{area,
tema}`, the generate endpoint accepted `tema`, and
`ItemGeneratorService` fed it to the prompt. The chain looked
complete. It was not: `ItemBankService.draw` filtered on area and
difficulty only, and the bank answers *before* the generator. So a
learner told to practise `angulos` got mixed Matemáticas, and nothing
anywhere reported a problem. Worse, `time-trial.service.ts` had been
computing a weak topic on every start, passing it into
`preguntasParaSeccion`, and that function handed it to the generator
and not to the bank — the weakness profile had been deciding nothing
for as long as the bank has been stocked.

This is the failure mode worth naming: the topic died in the one
layer nobody was looking at, two calls deep, with every layer above
it correct. Fixing only the link from the report would have changed
the URL and not the questions.

**There was no week in the weekly report.** `temasDebiles` is
accumulated history with a recency decay and no date filter, so the
report could only speak in the present tense. The prompt had to
forbid «esta semana fallaste en X».

**Nothing connected one week to the next.** Reports were stored with
their plans and never read back, so every Monday started from zero.
A plan nobody is held to is a plan nobody follows.

**Strengths were coarse while weaknesses were fine.** `temasDebiles`
only returns what goes badly, so a strength could only ever be «vas
bien en Lectura Crítica», never «dominas inferencia».

**`Answer.tiempoMs` was written on every answer and read by nobody.**
Every «seconds per question» in the product came from
`StudySession.durationSeconds / totalQuestions`, which counts reading
the prompt, the learner putting the phone down, and the bus ride.

## Decision

**One query closes four of the five.** `Answer` already holds
`itemId`, `tiempoMs` and `createdAt`; `GeneratedItem.tags` holds the
topic. Joining them, grouped in SQL, yields per-topic accuracy *and*
real per-answer time *inside a date range* — which is simultaneously
the window, the per-topic strengths, and the pace figure.

`SemanaRealService` owns it, beside `DebilidadesService` and
deliberately not inside it. The two answer different questions and
must not be merged:

- **The window** licenses the past tense. «Esta semana te fue bien en
  fracciones.»
- **The standing profile** licenses only the present, and is what the
  plan draws from. Drilling should follow a standing weakness, not
  one bad Tuesday.

The payload carries both under separate keys and the prompt is told
which is which, because mixing them is how a report claims a week's
worth of evidence for a two-month-old pattern.

Three measurement decisions inside that query:

**Median, not mean.** One answer left open over lunch is twenty
minutes. A mean of four answers with one of those in it is a number
about lunch. `percentile_cont` plus an upper bound of ten minutes on
`tiempoMs`.

**Slow is relative to the learner, not to the exam.** A uniformly
slow learner has a pacing problem, not a problem with one topic, and
flagging every topic says nothing.

**A lower sample floor than `DebilidadesService` uses.** Four answers
protects a *decision* about what to drill; three protects a *sentence*
in a report, and a week is a much smaller sample than all of history.
With a floor of four most learners would get a report that says
nothing about the week they just lived.

**The plan is scored against the following week.** `leerPlanGuardado`
reads last week's actions defensively out of the `Json` column;
`seguimientoDelPlan` reports, per action, whether it was attempted and
how it went. It does not decide whether the learner improved — that is
the model's sentence to write, and collapsing it into a boolean here
would pre-empt the conclusion.

**The topic now reaches the bank.** `draw` takes an optional `tema`,
filters `tags` by containment, and **tops up from the area when the
topic is thin** rather than returning a short list — practising the
right area now beats practising the right topic in forty seconds, and
a short list would send the caller to the generator and bill for it.
An explicitly requested topic beats the computed weak one, because
the learner tapped it.

**One normaliser, exported.** Topics are stored hyphenated and the
generator wants prose. `time-trial.service.ts` did that `.replace()`
inline at its own call site, which is precisely how the second caller
gets it wrong. `temaLegible` is now the single answer.

## Consequences

The report can say «mejoraste», «no lo practicaste» and «te demoras el
doble en esto» — three statements it could not make before — and each
traces to a column that was already there.

An index was required. `Answer` had none on `createdAt`, so the window
filter was a sequential scan over every answer ever recorded: harmless
on a new install and the slowest query in the service after a year.
`EXPLAIN` against a real database confirmed the plan changes from
`Seq Scan on "Answer"` to `Index Only Scan`. Migration
`20261127120000_indice_answer_created_at`, without `CONCURRENTLY`
because `migrate deploy` wraps each migration in a transaction.

The prompt is `v2`. Old reports keep their version, so «why does mine
read differently from his» still has an answer.

Costs did not change: the payload grew by a few hundred tokens and
the call count is unchanged at one per learner per week.

What this does not solve: an action is credited when the learner
answered anything on its topic, and a learner who drills a topic
badly is credited the same as one who drills it well. The accuracy is
reported beside it, so the model can tell the difference; the
follow-up itself stays a statement of fact rather than a verdict.

The report also still gates on the standing profile needing two weak
topics. A learner with a busy week and no standing weakness gets no
report — they are doing fine, and a plan with nothing to aim at has
nothing to do.
