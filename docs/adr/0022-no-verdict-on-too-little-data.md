# 22. No verdict on too little data

**Status** — accepted

Recorded retroactively. The same principle appears in three places and
is worth stating once.

## Context

Several features answer questions of the form "what is this learner bad
at?" or "is this item broken?". All of them can produce an answer from
one data point, and all of those answers are noise.

A learner who missed one Matemáticas question is not weak at
Matemáticas. An item answered twice has no measurable difficulty. A
streak computed from today alone is not a streak.

Showing noise as fact is worse than showing nothing, because the
learner acts on it: a weakness profile built from one answer sends them
to practise the wrong thing, and they have no way to know.

## Decision

Each feature declares a floor and says "sin medir" below it.

| Feature | Floor | Where |
|---|---|---|
| Weakness profile | 4 answers per topic | `debilidades.service.ts:23` |
| Item quality | 20 answers | `calidad.service.ts` |
| Study day (for the streak) | 5 minutes **or** 3 questions | `dashboard-math.ts:81` |

Below the floor the answer is an explicit absence, not a zero and not a
default. `areaPrioritaria` is `null` rather than the least-bad guess;
item quality reads `sin_datos`; an area with no answers is "sin medir",
which is not the same as "fuerte".

The floors differ because the questions differ. Four answers is enough
to notice a pattern a learner would recognise; twenty is the standard
minimum for an item analysis, where the number has to support a
statistic.

The study-day floor is an **or** (`isStudyDay`,
`dashboard-math.ts:81`): either five minutes of session time or three
questions answered.

This record first described it as an **and** — three questions in
twenty seconds is not a day of study, and neither is five minutes with
the app open and nothing answered. That is the stricter rule and it is
not the one that runs. The `or` was found by exercising the flow
against a database rather than by reading the file, which is the only
reason it was caught.

Leaving it as `or` is the kinder reading and probably right: a learner
who answers three questions on a bad day has studied, and a learner
who spends five minutes reading an explanation without answering has
too. The looseness it allows — three fast guesses count as a day — is
a cost of the streak itself, not of this threshold, and the streak is
already the mechanic with the weakest evidence behind it (see
[ADR 10](0010-informative-feedback-over-rewards-for-finishing.md)).

## Consequences

A new learner sees fewer claims about themselves, which is correct. The
product has less to say on day one and what it says is true.

The error-of-the-day card shows **nothing** to a learner with no
history, rather than a random question labelled "tu error de hoy" — a
lie they would spot immediately and that would cost the feature its
credibility.

The floors are constants in code, not configuration. A floor set per
deploy would mean the same learner is "weak at Matemáticas" on one host
and not on another.

Nothing enforces this for a feature added later. It is a convention
held by this record and by the three places that follow it.
