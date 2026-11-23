# 18. Android first, iOS later

**Status** — accepted

## Context

The study toll — blocking distracting apps until a few questions are
answered — needs platform APIs, and the two platforms differ enough
that one has to come first.

Earlier in this project iOS was treated as the critical path, on the
grounds that Apple's Family Controls entitlement is a human review with
no published timeline. That reasoning was about the obstacle rather than
about the audience.

Market research on 22 nov 2026 measured the audience instead:

- ICFES apps on Google Play carry up to 1,800 reviews. The same apps on
  the App Store carry between 1 and 9.
- 92% of phones in Colombia cost under USD 250.
- ~72% of mobile lines are prepaid, consuming 8.2 GB/month — under half
  of postpaid.

Sources in [INVESTIGACION-MERCADO.md](../INVESTIGACION-MERCADO.md).

## Decision

Android is the first platform for the toll, and for everything else.

It is also the permissive one: `SYSTEM_ALERT_WINDOW` and
`PACKAGE_USAGE_STATS` have no publication restrictions, and
`AccessibilityService` needs a declaration rather than an approval. So
the toll can ship, be used by real learners and be judged on whether
the mechanic works — before any of it depends on a review queue.

iOS follows, and its entitlement request should still go in early
because it is a trámite and trámites wait. But it blocks iOS, not the
product.

## Consequences

The mechanic gets validated with the audience that actually exists
rather than with the one that is easier to build for.

Offline is not optional on either platform. On iOS it is forced —
Apple's shield extension runs in a sandbox with no network, so the
toll's questions must already be on the device. On Android it is forced
by the audience: a prepaid line with 8.2 GB a month and an app that
shows nothing without a connection is an app that gets uninstalled.

The 94 MB APK is expensive for this segment and should come down.

iOS development can proceed locally without the entitlement — Xcode
grants Family Controls for development. Only distribution, TestFlight
included, needs the approval. So the iOS prototype can be built and
tested on a device before the request is answered, which is the
opposite of the order this project previously assumed.

Deciding Android first does not reduce what the toll must respect on
either platform. Google requires in-app disclosure on its own screen,
with affirmative consent, and explicitly forbids relying on the terms
and conditions. That constraint stands regardless of which platform
ships first.
