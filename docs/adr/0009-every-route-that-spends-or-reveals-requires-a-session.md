# 9. Every route that spends or reveals requires a session

**Status** — accepted

## Context

A review on 22 nov 2026 was checked against production rather than
believed, and one of its findings was real: `GET
/api/items/requests/failed` answered the open internet, and its
`rawModelOutput` field carries the model's unparsed text — questions,
their right answers and their explanations. Two failed generations were
exposed at the time, and every future failure would have accumulated
there.

Two other routes called the generator with no guard at all:
`POST /feedback/generate` and `POST /time-trial/start`. Any account
could spend without limit. The twenty-minute feedback cooldown only
covered regenerating the same session, so starting new ones bought
unlimited model calls.

And `questions` on a time trial was `min(1)` with no maximum, so a
single request could ask for a hundred thousand.

Two of the review's three most serious claims turned out to be false —
`GET /api/items` does not leak answer keys, and the requestId chain it
described does not exist. Verifying first mattered: a real leak and two
imagined ones call for very different reactions.

## Decision

Two categories of route sit behind `SesionRequeridaGuard`, and the
spenders behind `CuotaGuard` as well:

- **Spends money.** Anything that reaches a model. Identity is the
  precondition for a quota: there is nobody to meter until we know
  whose request this is.
- **Reveals bank content or generation diagnostics.** The items, the
  requests, the failures, the raw model output.

Request size is capped in the schema, not checked later: a time trial
is at most 20 questions — above the longest real mode — and two hours.
A ceiling applied after the request is a ceiling applied after the
spending.

## Consequences

The diagnostics are still reachable, which is why they were not simply
deleted: they are how a failed generation gets understood. They now
need a session, which is a weak bar for an admin route and the right
one for a route a learner's token can also open. If these ever need to
be admin-only, that is a separate change.

The guard is tested by reading the controllers as source, because the
failure being prevented is a route added without the decorator —
visible in the file, invisible to a test that only exercises routes
that exist today. Verified by removing a guard: the test fails and
names the route.

One lesson worth keeping: this leak was found by fetching the endpoint,
not by reading the code. The code looked like an admin route. Production
answered anyway.
