# 8. The client renews before it reports a lost session

**Status** — accepted

## Context

With refresh tokens reaching the phone (ADR 7), something had to decide
when to use one. A 401 has two meanings that look identical to the
screen receiving it: the access token aged out, which is fixable
without telling anyone, or the session is genuinely over, which is the
only case where a sign-in form is honest.

Reporting both as "su sesión expiró" sends a learner to re-enter a
password for a session that was one request away from working.

## Decision

The HTTP client renews once on a 401 and repeats the request. Only if
the renewal fails does the failure reach the caller.

Three places deliberately do not renew:

- **Public routes.** A 401 from sign-in means the password was wrong.
  Renewing there would replace a useful message with a misleading one,
  and there is no session to renew.
- **A request that is already the retry.** A route answering 401 for a
  reason renewal cannot fix — a permission, say — would otherwise
  retry forever and hang the screen that called it.
- **Any other status.** The quota is not the session; neither is a
  server error.

When to renew proactively is a pure decision and lives in
`features/sesion/model/renovacion.ts`: a token is renewed a day before
it expires, because a learner opening the app on a bus with one bar
should already carry one that works. A token that cannot be parsed is
renewed rather than trusted — being wrong costs one request, being
wrong the other way costs the session.

`sesionPerdida` is a separate function from `convieneRenovar` because
the two lead to different screens: one is silent housekeeping, the
other is the sign-in form.

## Consequences

An expired token is invisible to the learner, which is the point.

The retry doubles the requests of the one call that triggers it. That
is bounded by the no-loop rule and by the shared renewal, and it only
happens once per renewal.

The renewer is registered at startup rather than imported, so the
dependency runs one way: the client cannot import the feature that
imports the client. The cost is that forgetting to register it leaves
renewal silently disabled — so it is called at module scope in the root
layout, not in an effect, where a cold start's first requests would
race it.

Removing the no-loop guard makes the test hang rather than fail. That
is how it was verified, and it is worth knowing: a hang in that file
means that condition, not a slow test.
