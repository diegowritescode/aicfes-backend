# 29. The dashboard streams, with polling as the fallback

**Status** — accepted

Recorded retroactively.

## Context

The dashboard shows numbers that change while a learner is looking at
them: a finished session, a new answer, a recomputed weakness profile.
Reloading to see them defeats the point.

**Polling only.** Simple and it works everywhere, but the dashboard
payload is expensive to assemble — it is cached for two minutes for
exactly that reason (`dashboard.service.ts:20`) — so a short interval
costs real work and a long one is not live.

**WebSockets.** Bidirectional, which this is not: the server has
everything to say and the client nothing. That buys a protocol upgrade,
a second transport to operate and proxies to configure, for traffic
that only ever flows one way.

**Server-sent events.** One direction, plain HTTP, reconnects on its
own in the browser. The right shape for the problem.

## Decision

`GET /dashboard/stream` holds the connection open
(`dashboard.controller.ts:88-125`): event-stream content type, caching
off, keep-alive, `flushHeaders()` to commit them before anything is
written (`dashboard.controller.ts:116-119`), then the client is
registered and sent a `dashboard:init` with the current payload so it
renders immediately instead of waiting for the first change
(`dashboard.controller.ts:122-125`).

Clients are held per user in a `Map<string, Set<StreamClient>>`
(`dashboard-stream.service.ts:11`), so one learner's open tabs all
receive an update and one learner's events never reach another's. Each
connection gets a 25-second `ping` to keep intermediaries from closing
an idle stream (`dashboard-stream.service.ts:19-21`), and `res.on(
'close')` unregisters it and clears the timer
(`dashboard-stream.service.ts:23-25,30-33`).

Writes push rather than the client pulling. Anything that changes the
dashboard calls `clearCache` and the update is published to whatever
streams are open (`dashboard.service.ts:158-166`), reusing a still-warm
cache entry when there is one and marking it `cached: true` so the
client knows which it got.

**Polling stays as the documented fallback.** A browser's `EventSource`
cannot send custom headers, so the stream is reached with cookie auth or
`?userId=` (`docs/DASHBOARD_SSE.md:68`), and where SSE is blocked
entirely the client polls every 15–30 seconds
(`docs/DASHBOARD_SSE.md:72-73`). The plain `GET /dashboard` route
returns `cached` and `cacheExpiresInSeconds`
(`dashboard.controller.ts:82-83`) so a polling client can time itself
against the cache instead of guessing.

## Consequences

A learner sees the dashboard change without reloading, and the
expensive payload is assembled on writes rather than on a timer.

**It is correct only on a single process, and that is the real defect.**
The cache is a `static` map on the class
(`dashboard.service.ts:132`) and the client registry is an instance
field on a singleton provider
(`dashboard-stream.service.ts:11`), so both live in process memory.
With two replicas:

- A learner polling hits whichever replica the balancer picks, so they
  can see a two-minute-old payload from replica B immediately after
  replica A recomputed — `clearCache` only clears the replica it ran on.
- A learner's stream is held by one replica. If the write that should
  notify them lands on the other, `publish` finds no bucket for that
  user and returns (`dashboard-stream.service.ts:47-50`). The update is
  dropped silently; nothing logs it and the client has no way to know.

The deploy survives this only because it runs a single API container:
`deploy/compose.yml` declares one service with no `replicas` or `scale`,
so there is one process by default. Nothing *enforces* that — scaling
the service up would break the dashboard quietly, with no error anywhere
to say why. Doing it properly needs the cache and the fan-out moved to
something shared, Redis pub/sub being the obvious shape, and until then
the polling fallback is not a nicety but the only thing that eventually
converges.

A dropped update is also invisible within one process. `publish` is
fire-and-forget into `res.write` with no acknowledgement
(`dashboard-stream.service.ts:52-60`), so a client on a dead-but-not-yet-
closed socket silently misses events until `close` fires or it polls.
