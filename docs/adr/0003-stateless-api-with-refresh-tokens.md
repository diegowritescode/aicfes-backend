# 3. Stateless access tokens with stored refresh tokens

**Status** — accepted

## Context

The API serves a single-page application. Sessions need to survive a
reload without asking the learner to sign in every time, and a stolen
token needs to stop working.

## Decision

Short-lived JWT access tokens, verified in process with no database read.
Refresh tokens are rows in `RefreshToken`, so they can be revoked.

## Consequences

Authorizing a request costs no query, which matters because the dashboard
and the study session poll.

Revocation is possible but not instant: an access token stays valid until
it expires. The expiry is short for that reason.

Storing refresh tokens means the database is on the path for sign-in and
rotation only, not for every authorized request.
