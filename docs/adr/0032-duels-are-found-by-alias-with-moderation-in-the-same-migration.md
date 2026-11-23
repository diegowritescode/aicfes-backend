# 32. Duels are found by alias, with moderation in the same migration

**Status** — accepted

Decided 23 November 2026 by Diego, choosing alias search over
invitation codes after being shown the privacy cost of each.

## Context

The product vision lists asynchronous 1v1 duels as the one minigame
worth building — "es lo que hizo crecer a Duolingo. Social sin la
presión de estar en vivo."

Building it required answering a question the product had never had to
answer: **how does one learner identify another?** Until now nothing
was social. `User` carried an optional email and nothing else a person
would recognise, and showing emails would have exposed the personal
data of minors to each other.

**The audience makes this a safety decision, not a UX one.** The
learners are 16-18. Anything that lets one of them find another also
lets an adult find one of them.

Three options were put to the decision, with their costs stated:

- **Invitation code.** A learner generates `DUELO-7KX2`, sends it over
  WhatsApp, the other pastes it. Nobody can search for anybody, so
  there is no user base to enumerate and no way for a stranger to make
  contact. WhatsApp is already the channel this age group uses.
- **Searchable alias.** More convenient, and it opens discovery between
  minors.
- **Duel against your own result from last week.** No social surface at
  all; the vision already mentions it as the decent form of ranking.

Diego chose the searchable alias.

## Decision

Alias search, with the obligations it creates built in the same
migration rather than deferred.

**Moderation is not a later phase.** `Bloqueo` and `Denuncia` ship in
the migration that adds `alias`. A release where search exists and
blocking does not is a window in which a minor being harassed has no
way to stop it, and "we will add blocking next sprint" describes
exactly that window.

**A guardian's authorisation gates searchability**, not account
creation. Colombia's Ley 1581 de 2012 requires the authorisation of a
representative to process a minor's personal data, and an alias
strangers can search for is such processing. Without it the account
works fully — training, simulacros, the toll, the review section — and
is simply invisible to other learners. It is self-declared, dated, and
stored in `tutorAutorizoEn`; an app cannot verify it, and recording it
explicitly is what it can do.

**Searchability is separate from having an alias.** `aliasBuscable` can
be turned off while keeping the name friends know. The decision that
exposes someone to strangers should be revocable without losing the
identity.

**Aliases are lowercased on write** and restricted to `[a-z0-9_.]`.
Accents are excluded for a reason that is not laziness: `camilo` and
`camiló` are indistinguishable at a glance on a phone, and an
invitation landing on the wrong person is worse than a rejected alias.
Verified against a running server: `CAMILO` was refused against an
existing `camilo`.

**A block and a hidden account are reported identically.** Both return
"No puede retar a esta persona." Telling someone "this person blocked
you" confirms the account exists and that a specific person acted
against them, which is something a blocked user can act on. The
distinction is kept in the code for the logs and lost on the way to
the screen, and the block is evaluated *first* so the two cannot be
told apart by probing.

**Reporting blocks immediately.** Someone reporting harassment wants it
to stop now, not after a review.

**Blocking cancels open duels between the pair.** A block that left an
active duel in place would keep showing the blocked learner's name on
a screen every day.

**Accuracy decides a duel; time only breaks ties.** Scoring time first
would teach a learner to answer fast and wrong, and the ICFES gives 64
seconds a question precisely because the questions need thinking. An
exact tie on both counts is a tie: inventing a tiebreak would decide
the match on something neither player did better.

**Answers are graded on the server and the questions are served
without them.** A duel is the one place in this product where a learner
has a reason to lie about their own score, and `GET
/duelos/:id/preguntas` omits `respuesta_correcta` and `explicaciones`
so the duel cannot be won by reading the response body.

**Questions come from the verified bank, never generated** (ADR 31).
Five questions for two players is not worth a model request, and it is
the same reasoning that moved contrarreloj.

**Rate limits are harassment limits.** One open duel per pair and
twenty invitations a day. Without the first, a stranger can fill
someone's screen with invitations they must dismiss one by one — which
is harassment carried out through an ordinary feature.

## Consequences

Any learner with an authorisation on file can be found by any other.
That is the accepted cost of the choice, and it is why everything
above exists.

Moderation now needs a human. `Denuncia` rows accumulate with
`estado: abierta` and nothing reads them yet. A report that nobody ever
reads is worse than no report button, because it promises an
intervention that does not come. **This is the open obligation of this
ADR**: before duels reach real learners, there has to be a way to read
the queue and act on it.

The alias is the first free-text field one learner writes and another
reads. The character set and the reserved names bound what can be put
there, but an alias that is offensive while spelled in plain letters is
only reachable through `Denuncia`.

Verified against a running server on 23 November 2026: search returns
nothing before the guardian's authorisation; a duel cannot be started
without the challenger's own; five questions arrive without their
answers; 5 correct in 200 seconds beats 3 correct in 100; a second
submission is refused; blocking hides both parties from each other and
cancels the open duel; reporting blocks immediately.

## Alternatives

**Invitation codes.** Recommended, and not chosen. It captures the real
social value — competing with the friend in your classroom — without
building a discovery surface for minors.

**Ship search now, moderate later.** Rejected on the grounds above.

**Alias validation on the client only.** Rejected: the client is not
the authority on anything another learner will read.
