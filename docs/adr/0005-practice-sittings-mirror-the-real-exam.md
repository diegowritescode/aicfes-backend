# 5. Practice sittings mirror the real exam

**Status** — accepted

## Context

A learner could answer questions one at a time, but never sit an exam.
Saber 11 is 254 scored questions across two sessions of four and a half
hours, weighted per area: Lectura Crítica 41, Matemáticas 50, Sociales y
Ciudadanas 50, Ciencias Naturales 58, Inglés 55.

Practice that does not match those proportions produces a score that
cannot be compared to a real one — and nobody practices for nine hours.

## Decision

A sitting scales to the length the learner has while keeping the real
proportions. Scaling floors each area and hands the remainder back out,
so the parts sum to the whole; rounding each area independently loses or
gains questions.

Questions come from the verified bank, so starting a sitting is a query
rather than dozens of model requests. A sitting that cannot be filled
fails and names the short areas, rather than running an exam whose score
is meaningless.

Grading counts unanswered questions as wrong, as the real exam does, and
reports accuracy per area, weakest first. Areas under 70% are the study
plan.

## Consequences

A sitting depends on the bank having enough verified items per area,
which makes bank coverage an operational concern rather than an
afterthought.

The 70% line is a judgement. It is the single number worth revisiting
once there is real data on what predicts improvement.
