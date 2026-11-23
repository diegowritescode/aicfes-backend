# 7. A native client holds its own refresh token

**Status** — accepted

Supersedes part of [3](0003-stateless-api-with-refresh-tokens.md), which
assumed a browser.

## Context

ADR 3 put refresh tokens in rows so they could be revoked, and the
controller wrote them to an httpOnly cookie. That is right for the
single-page application it was written for: a cookie JavaScript cannot
read is a cookie an XSS cannot steal.

The mobile app has no cookie jar the server can rely on. Reading only
the cookie meant `POST /auth/refresh` could never be called from the
phone, so the access token expired after seven days and the learner
was returned to the sign-in screen with nothing on screen to explain
why. It looked like being signed out at random.

Three ways out were considered.

**Lengthen the access token to 30 or 90 days.** Simplest, and the
reason to reject it is revocation: a stolen token would work for
months, and ADR 3 chose stored refresh tokens precisely so that a
session could be ended.

**Ask for the password again every week.** Safe and expensive. Real
usage logs of adolescents show 44% abandon a daily-habit app in week
one; a weekly password prompt is friction placed exactly where the
product can least afford it.

**Send the token in the body, to native clients only.** Chosen.

## Decision

A client that cannot hold a cookie says so with an `X-Cliente: movil`
header and receives `refreshToken` and `refreshTokenExpiresAt` in the
response body. A browser keeps receiving neither.

`POST /auth/refresh` reads the cookie first and falls back to the body,
so web behaviour is unchanged.

On the device the token is stored in `expo-secure-store`: the Keychain
on iOS, EncryptedSharedPreferences on Android. That is a stronger place
than a cookie, not a weaker one — the operating system encrypts it and
no other app can read it.

The header selects where an already-issued token is written. It is not
a credential and grants nothing: a browser that sent it would receive
its own token, in its own response, which it could already use.

## Consequences

The phone can renew, so a learner who opens the app most days should
not meet the sign-in screen again.

Renewal has to be shared. The dashboard fires several requests at once,
so an expired token produces several 401s together, and the server
rotates the refresh token on use — a second renewal would present one
the first reply had already invalidated, signing the learner out by the
mechanism meant to keep them in. The client therefore coordinates: the
first caller starts the renewal and the rest await the same promise.

The web keeps its XSS protection, and that half is the one worth
testing, because a leak there would be silent. A test asserts the
token is absent from a browser's response; removing the condition makes
it fail and name what appeared.

The header is a new thing a client must remember. A native client that
forgets it gets no refresh token and stops renewing quietly, which is
why the mobile client sets it in one place, for every request.
