# 6. Figures are drawn from parameters, not generated

**Status** — accepted

## Context

Much of the Saber 11 cannot be asked in text alone. A question about
an angle needs the triangle; one about reading a chart needs the
chart. A visual pass over 243 official booklets found figures
concentrated in Matemáticas and Ciencias Naturales, and three pages of
Sociales from different years with none at all.

Three ways to produce them were considered.

**Generate each figure with an image model.** Rejected, and not for
cost. Image models cannot draw exact diagrams: they put "4 m" where
the stem says 3, or an angle that does not match the sides. In
geometry that is not an ugly picture, it is an invalid question that
teaches something false.

**Keep a library of images and write the numbers on top.** Cheaper,
but rigid. The text cannot reposition when a number is longer, the
angle cannot change when the question asks it to, and it needs an
image tool in the pipeline.

**Draw from parameters.** A template is a function: it takes the
question's numbers and returns the SVG.

## Decision

Twelve templates were planned; six are built, ordered by what the
booklets actually use. The model never draws. It names a template from
an enum it cannot invent and supplies values, which is the part a
language model does well, and the JSON Schema already constraining
generation carries the choice.

Parameters are validated before the item is stored. A figure whose
numbers cannot describe a real drawing — a triangle twelve times
longer than it is tall, a ragged table, a parabola with a zero
coefficient — is rejected like a wrong answer, since the question is
unanswerable either way.

The specification is stored, not the image. The SVG is drawn when the
item is served.

## Consequences

A figure costs nothing and weighs about 1–4 KB. No request to any
model, no image pipeline, no storage.

Correcting a template corrects every item that uses it. Nothing is
regenerated and no learner sees a stale drawing.

Each template produces its own text alternative from the same values,
so a learner using a screen reader is not left with an unanswerable
question.

The cost is coverage: a question needing a figure outside the six
templates cannot have one. That is the right failure — a missing
figure is visible, a wrong one is not.
