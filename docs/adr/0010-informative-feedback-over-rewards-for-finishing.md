# 10. Informative feedback over rewards for finishing

**Status** — accepted

## Context

The product already has XP, levels, a streak with milestones at 3, 7,
14, 21, 30, 60 and 90 days, five daily missions and an auditable XP
ledger. The natural next step looked like more of it: leaderboards,
badges, bigger rewards.

Research on 22 nov 2026 against primary sources argues against that
step, specifically for this audience and this medium.

- **Gamification in online learning is not a measured win.** The
  meta-analysis (Li, Ma & Shi 2023, 41 studies) reports Hedges
  *g* = 0.822 overall, but *g* = 0.340 with a 95% CI of [−0.131,
  0.812] for online learning — the interval includes zero. The large
  effect comes mostly from classrooms.
- **The effect falls with age.** Primary *g* = 1.293, higher education
  *g* = 0.014. A 16-to-18 audience sits where it fades.
- **Rewards for completing a task undermine intrinsic motivation.**
  Deci, Koestner & Ryan 1999, 128 experiments: completion-contingent
  rewards *d* = −0.36, and "tangible rewards tended to be more
  detrimental for children than college students". A streak is exactly
  that contingency.
- **Informative positive feedback helps**: *d* = +0.33.
- **What retains adolescents is self-regulation.** Maenhout 2022,
  n=186, measured with real usage logs rather than self-report: 44%
  abandoned in week one, and time spent in self-regulation and
  narrative components predicted staying. The chatbot had no relation
  to retention.

This last point also reframes the study toll: blocking distractions
until five questions are answered *is* self-regulation, which makes it
the most defensible mechanic in the product rather than an extra.

## Decision

Keep the gamification that exists. It is built, it works, and removing
it on the strength of a confidence interval would be its own mistake.

Add to it along the axis with evidence behind it: say **why**. The
`XPEvent` table already records a reason for every award —
`session_correct`, `time_trial_bonus`, `answer_correct_adjustment` —
and the app shows only a total. Showing what improved is informative
feedback over the same data.

Two things stay out, and this agrees with what `VISION_PRODUCTO.md`
had already reasoned without citing the studies:

- **No global leaderboard.** Being ranked 4,200th among stressed
  students demotivates. A league of ten, or last week's self, is a
  different proposition.
- **No lives or hearts.** Punishing a wrong answer is backwards here:
  the error is the most valuable datum the system has, since it feeds
  the weakness profile and the question of the day.

The streak keeps its forgiveness, for the same reason.

## Consequences

The toll and the gamification do different jobs: one brings the
learner in, the other makes staying worthwhile. Treating either as a
substitute for the other is the mistake this records.

Effort moves from inventing reward mechanics to explaining existing
ones, which is cheaper and better supported.

The evidence is about averages, not about this app. If measurement
here ever contradicts it, measurement wins — but the default stops
being "copy Duolingo".
