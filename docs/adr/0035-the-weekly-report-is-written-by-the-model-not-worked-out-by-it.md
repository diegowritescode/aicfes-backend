# 35. The weekly report is written by the model, not worked out by it

Date: 2026-11-27

## Status

Accepted. Amended by ADR 36, which closes the limits recorded below:
the seven-day window, the per-topic strengths, the week-to-week
follow-up and the unused per-answer timing.

## Context

A learner wants to know where they stand: what they are good at, what
keeps going wrong, and what to do next week. The obvious build is to
hand a language model a window of answers and ask it for an
assessment.

There was already something close. `Feedback` generates a summary,
strengths, weaknesses and a plan from a single `StudySession`, and it
works. But it answers "how did those eight questions go", and twenty
of those do not add up to a picture. A learner asking how they are
doing is not asking about their last session.

There was also something better and unused. `PerfilDebilidad` holds
one row per learner, area and **topic** — `angulos`, `leyes de
newton` — with how many were answered, how many right, a count of
**what kind of mistake** was made (`error_calculo`,
`confunde_conceptos`, `interpretacion_parcial`) and when the last
failure was. `DebilidadesService.temasDebiles` ranks them with a
priority that decays with age, refuses to name a topic with fewer
than four answers, and is tested. Contrarreloj and the daily mistake
already read it; nothing showed it to the learner.

## Decision

**The model writes the report. It does not work it out.**

Every figure comes from `temasDebiles` and the dashboard, computed
before the prompt is built. The schema the model answers with —
`InformeRespuestaSchema` — contains no numeric field at all, and a
test fails the build if one appears.

The one place the model's output becomes a key is `plan[].area` and
`plan[].tema`, and `planConTemasReales` drops any action whose pair
the server did not supply.

Three consequences follow:

**The week is the unit of idempotency.** `@@unique([userId,
semanaInicio])`, with Monday computed in the learner's own timezone.
Opening the screen twice on a Tuesday reads the stored row. Without
it, a learner in Bogotá who opens the app on Sunday evening — already
Monday in UTC — would be billed for a week they have not lived.

**Generated on request, not on a schedule.** There is no scheduler in
this service: no `@nestjs/schedule`, no queue, no Redis. Adding one
for a job that already has a natural trigger would be infrastructure
for its own sake, and a cron would also write reports for people who
have not opened the app in a month. The first learner each week waits
a few seconds; everyone after reads.

**No report is a normal state.** `hayMateriaParaInforme` requires two
weak topics. Below that the endpoint answers `{ok: true, data: null}`
rather than 404, because a learner who has not answered enough
questions is not an error and the client's failure path is where "no
internet" lives.

## Consequences

A report cannot say anything the data does not contain. That is the
point, and it is also a limit: with no topics, there is nothing to
write, and the screen has to say what is missing instead.

The plan is actionable rather than prose. Each action carries an area
and a topic, which is what `time-trial.service.ts` already uses to ask
the bank for exercises. No embedding or retrieval step was needed —
the retrieval key is the topic, and it is already computed.

Cost is about 0,0015 USD per learner per week with `gpt-5-mini`,
against the 0,009 that `CuotaGuard` reserves for one question. The
reservation is conservative in the right direction, and `ConsumoLlm`
records the spend under its own operation, `informe`, so it can be
read on its own before deciding whether it stays.

A failed model call writes nothing and raises nothing at the learner:
a 502 on the screen that shows their progress reads as the app being
broken, and the report is not something they asked for by name. The
next visit tries again.

What this does not solve: `temasDebiles` is accumulated history with
a recency decay, not a seven-day window. The prompt says so, and the
report says "sigues fallando en X" rather than "esta semana fallaste
en X". A genuinely weekly weakness profile would need a date filter
that model does not have.

**Closed by ADR 36.** `SemanaRealService` adds that date filter by
joining `Answer` to `GeneratedItem`, which also surfaced per-topic
strengths and the per-answer timing that `Answer.tiempoMs` had been
storing unread.
