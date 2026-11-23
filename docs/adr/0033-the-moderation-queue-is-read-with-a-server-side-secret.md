# 33. The moderation queue is read with a server-side secret

**Status** — accepted

Decided 23 November 2026. This pays the open obligation recorded in
ADR 32.

## Context

ADR 32 shipped alias search with `Bloqueo` and `Denuncia` in the same
migration, and closed by naming what was still missing:

> Moderation now needs a human. `Denuncia` rows accumulate with
> `estado: abierta` and nothing reads them yet. A report that nobody
> ever reads is worse than no report button, because it promises an
> intervention that does not come.

The screens already promise it. `ModalDenuncia` tells a learner that
"una persona de nuestro equipo va a revisar lo que nos contó". That
sentence was true of the intent and false of the system.

**Who the moderator is, today:** one person, the founder. There is no
team, no administration interface, and no second account.

## Decision

A shared secret in the environment, `MODERACION_TOKEN`, sent as
`x-moderacion-token`.

**Not a `role` column on `User`.** Two reasons. A permission system
built for a team that does not exist is a guess about a team that does
not exist. And the row granting the permission would live in the same
database being moderated — the account under review and the authority
reviewing it in one table.

**The secret is set on the server over SSH**, like `OPENAI_API_KEY`
(ADR 24's deploy is manual for related reasons). It never passes
through anything else.

**Closed when the variable is absent.** With no `MODERACION_TOKEN` the
routes refuse everyone, and the guard logs why. Open-when-unset is the
shape of defect that leaks a queue of minors' reports the first time
someone deploys without the variable, and it does so silently. Pinned
by `test/moderacion-guard.test.ts` and verified against a running
server: 403 to every request, with and without a header.

**The comparison hashes both sides first.** `timingSafeEqual` throws on
a length mismatch, so comparing raw strings would surface a short token
as a 500 — and the error would tell the caller the length was wrong.

**The queue is ordered oldest first.** A report waiting three days is
the one that has failed the learner who sent it.

**Each row carries how many *distinct people* reported the account**,
not only a total. Three complaints from one person and one each from
three people look identical in a total and are not the same thing.
Verified: two reporters on one account returned `totales=2
personas=2`.

**The action is removal from search, not deletion.** The learner keeps
their account, their history and their alias, and stops being findable.
Deleting a minor's account over a report nobody has verified is not a
call to automate — and invisibility stops the harassment either way,
because every duel starts with a search. Open duels are cancelled at
the same time, or the account stays on other learners' screens after
being taken out of search.

**Closing a report records which kind of closing it was.** `revisada`
and `descartada` both close it; "we looked and found nothing" and "we
acted" are different answers to the same learner.

**The controller is hidden from the API documentation**
(`@ApiExcludeController`). The guard is the protection; this is that a
documented queue of minors' reports invites the attempt.

## Consequences

The promise in `ModalDenuncia` is now true. Someone can read the queue
and act on it.

**It still requires a person to look.** `GET /moderacion/pendientes`
returns `abiertas` and `diasDeLaMasAntigua` precisely so the question
"is anyone attending this?" can be answered in one request — but
nothing yet asks it on a schedule, and nobody is notified. That is the
next obligation, smaller than this one and real: a queue that is
readable and unread is only one step better than unreadable.

There is no moderation interface, only HTTP routes. Adequate for one
moderator with a terminal; it is not adequate for a second person who
is not an engineer.

The secret is shared, so it cannot say *who* acted. With one moderator
that distinction does not exist. With two it would be the first thing
missing, and that is when the `role` column rejected above becomes the
right answer.

## Alternatives

**A `role` column and a session-based guard.** Rejected for now on the
grounds above; it is the right answer the moment there is a second
moderator.

**Email the reports.** Rejected in ADR 32 and still rejected: a report
arriving as a notification gets lost, and the pattern across reporters
is invisible in an inbox.

**Nothing — leave the rows accumulating.** This is what ADR 32 called
worse than having no report button.
