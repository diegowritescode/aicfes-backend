# 34. Moderation is a role; the secret only grants it

**Status** — accepted. Amends [ADR 33](0033-the-moderation-queue-is-read-with-a-server-side-secret.md).

Decided 24 November 2026 by Diego, who asked why it was a token and
not a role.

## Context

ADR 33 chose a shared secret and rejected a `role` column, for two
reasons. One holds up. The other did not survive contact with use.

**What held up:** the row granting the permission would live in the
same database being moderated. Anyone who reaches that database could
make themselves a moderator and read every report a minor has filed.

**What did not:** "a permission system built for a team that does not
exist". The sentence sounded like restraint and was a guess, and the
cost it ignored showed up the same day.

Using a shared secret daily meant the secret had to live on the
moderator's phone, which meant a screen to paste it into — and that
screen sat behind a drawer entry that only appears *once the device
holds a token*. A door whose key is inside the room. Nobody could get
in the first time, and it was found by being asked "how do I open the
page?" and having no answer.

A secret also cannot say **who** acted. With one moderator that is
invisible; with two it is the first thing missing.

## Decision

Both, with different jobs.

**The role is the everyday way in.** `User.esModerador`, checked on
each request. A moderator signs in like any learner and the queue is
there: nothing to paste, nothing kept on a phone that can be lost.
The request carries `moderadorId` afterwards, so routes can record
who acted.

**The secret grants the role, and nothing else.** `POST
/moderacion/otorgar` takes an email and is guarded by
`SoloSecretoGuard` — which accepts the secret and *refuses the role*.
That refusal is the whole design: a moderator who could appoint other
moderators turns one compromised account into every account. Verified
against a running server: a moderator calling `otorgar` gets 403.

This keeps ADR 33's surviving reason. The authority still does not
come from a row anyone with database access could write for
themselves — writing it requires a secret that lives only on the
server, set over SSH like `OPENAI_API_KEY`.

**The secret also still opens the queue.** Losing access to the
account must not lock the only moderator out of a queue minors are
reporting into.

**Closed when the secret is unset**, unchanged from ADR 33, and still
the property most easily got backwards: open-when-unset leaks the
whole queue the first time someone deploys without the variable, and
does it silently.

**`esModerador` rides along in `GET /duelos/perfil`**, which the app
already reads on launch. A separate route for one boolean is a second
request to fail on a phone with one bar.

## Consequences

A moderator opens the app and Denuncias is simply there. The paste
screen stays, reachable from the duel settings, because the secret
remains a valid way in — but it is no longer the only one, and no
longer the first one.

`moderadorDesde` records when the role was granted. "Who has this,
and since when" is the first question asked when something goes
wrong, and a boolean cannot answer it.

Granting is by email rather than by id, because that is what the
person running the command knows. Looking up an id in the database
first is the step this endpoint exists to avoid.

**What is still missing:** nothing records *which* moderator resolved
a given report. The request now knows `moderadorId`; `Denuncia` has
no column for it. With one moderator that changes nothing, and it is
the obvious next step the moment there are two.

Verified end to end against a running server on 24 November 2026: a
learner without the role gets 403; the same learner cannot grant it
to themselves; the secret grants it; the role then opens the queue
with no header; a moderator cannot appoint another; the role can be
taken away and access ends with it.

## Alternatives

**A role granted by editing the database.** Rejected: every new
moderator becomes an SSH session with `psql`, and the authority would
come from a row that writing itself is the attack.

**Keep the secret only.** Rejected on the grounds above — it has no
first-time path and cannot attribute an action.

**Grant the role through the role.** Rejected, and refused in code: it
makes one compromised moderator account into all of them.
