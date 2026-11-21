# 2. Migrations are the source of truth for the schema

**Status** — accepted

## Context

`prisma db push` writes the schema straight to a database without
recording a migration. It is convenient while a model is in flux, and it
leaves the migration history behind.

That happened here. Nine models and three enums existed in
`schema.prisma` and in no migration: `User`, `RefreshToken`,
`StudySession`, `Answer`, `XPEvent`, `Feedback`, `TimeTrialMode`,
`MissionDefinition`, `MissionProgress`.

A developer's own database worked, because `db push` had created the
tables locally. A clean database got two tables out of eleven, and
registering or logging in failed against it. `prisma migrate status`
reported "up to date", because it compares applied migrations to the
migration folder, not to the schema.

## Decision

Every schema change ships as a migration. The missing SQL was generated
with `prisma migrate diff` rather than written by hand, so it matches the
schema exactly.

CI applies the migrations to an empty database on every push, and then
runs `migrate diff --exit-code` between the migrations and the schema. A
drift fails the build.

## Consequences

Schema changes take an extra command. In exchange, a clean checkout
produces a working database, which is the minimum a repository owes
anyone who clones it.

The drift check is cheap and catches the exact failure that occurred. A
test for a bug that already shipped is worth more than one for a bug
imagined.
