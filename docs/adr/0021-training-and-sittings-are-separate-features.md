# 21. Training and sittings are separate features, not a flag

**Status** — accepted

Recorded retroactively.

## Context

Training and a mock sitting look similar enough to share code: both
show questions and collect answers. The difference is one behaviour —
training tells you immediately whether you were right, a sitting does
not until you hand it in.

That invites a flag: `mostrarRespuesta: boolean`.

**One feature with a flag.** Rejected. The flag decides whether the
payload includes `respuesta_correcta`, which means a single wrong value
serves the answer key during a graded sitting. There is no louder
failure available in this product and no way to notice it from the
outside: the sitting still works, it is just worthless.

## Decision

Two features, two payload shapes, two code paths.

Training (`shared/pregunta`) returns the full item: the correct answer
and the per-option explanations. That is the point — immediate feedback
is what training is.

A sitting (`features/simulacro`) returns a payload that **does not
contain** those fields, and the service's `select` omits them rather
than deleting them afterwards (`simulacro.service.ts:240-242`). The
comment there says why: anything sent to a browser can be read.

Two schemas, so the client cannot accidentally read a field that was
never sent. Two routes, so a change to one cannot alter the other.

## Consequences

Some duplication between the two features: both render a question and
collect an answer. Accepted, and `shared/` holds what is genuinely
common (the option component, the answer rules).

The separation is enforced by what the database query selects, not by a
filter at the edge. A field that is never fetched cannot be leaked by a
serialisation mistake later.

Grading happens server-side at hand-in, because the client never had
the answers to grade against. That is a consequence rather than a
decision, and it is the right one.

A learner cannot switch a sitting into training mode mid-way. Nobody
has asked for that, and it would reintroduce the flag.
