# 17. The tutor explains first, and never gives the letter

**Status** — accepted

Recorded retroactively.

## Context

A learner gets a question wrong. The cheapest useful response is to
show the right answer. It is also close to useless: they learn which
letter, not why their reasoning failed.

The harder question is what to ask for and when.

**Ask the learner to defend their answer, then explain.** Rejected as
the first step, and this was tried: asking for a defence before showing
anything made the stored explanation arrive as a reply to the defence,
which read as a non-sequitur. The learner wrote why they chose B and
got back an explanation that did not mention B.

**Explain first, then ask.** Chosen.

## Decision

Opening a tutoring thread returns the item's stored explanation
immediately and for free — it was written when the item was generated
and costs nothing to serve. Only then does the tutor ask the learner
why they chose what they chose.

The tutor **never states the correct letter**
(`tutoria.service.ts:37`), even when asked directly. The instruction is
in the system prompt in those words. A learner who gets the letter stops
reasoning; one who has to arrive at it keeps going.

A thread is unique per learner and item (`unique(userId, itemId)`) and
survives between attempts. Failing the same question next week resumes
the same conversation rather than starting over.

Six turns maximum (`MAX_TURNOS`, `tutoria.service.ts:31`). Beyond that
the conversation has either worked or is not going to, and each turn is
a model request.

Opening is free; the turns that reach a model are metered.

## Consequences

The learner's own reasoning is stored (`Tutoria.defensa`). That is a
better signal than which letter they picked: "I thought 'however' meant
addition" names a gap that the letter alone hides.

It feeds the weakness profile with a type of error, not just a count.

Six turns is a hard stop with no appeal. A learner mid-explanation at
turn six gets cut off, which is worse for them than for the bill — if
the limit ever moves, it should move for that reason.

Not giving the letter is a product promise a model can break. The
instruction is in the prompt and nothing enforces it in code: a model
that ignores it would hand over the answer and nobody would find out.
Worth a check if the tutor is ever reported as "too helpful".
