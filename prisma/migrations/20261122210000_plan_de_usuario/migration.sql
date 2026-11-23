-- What a learner's plan is, which until now existed only as a
-- TypeScript type with no row behind it.
--
-- `cuota.service.ts` has had `Plan = 'gratis' | 'pago' | 'semilla'`
-- and a daily cap for each since the quota was built, but nothing
-- ever assigned one: every call fell through to the `'gratis'`
-- default parameter. The caps were real and the plan was not, so
-- there was no way to let a paying learner spend more.
--
-- Names match the TypeScript union exactly. Two spellings of the same
-- idea is how they drift apart.
CREATE TYPE "Plan" AS ENUM ('gratis', 'pago', 'semilla');

-- Defaults to `gratis` rather than to NULL, so an account nobody has
-- touched is metered. A plan that had to be set before it meant
-- anything would make every new row unlimited until someone
-- remembered to set it.
ALTER TABLE "User" ADD COLUMN "plan" "Plan" NOT NULL DEFAULT 'gratis';

-- When a paid plan lapses. NULL on a free account, and NULL on a paid
-- one that does not expire, so the column cannot be read as "expired"
-- by accident: the code asks whether a date exists and is in the past.
ALTER TABLE "User" ADD COLUMN "planHasta" TIMESTAMP(3);

-- The one query this pair exists to answer: which subscriptions have
-- run out.
--
-- Not a partial index, though `planHasta IS NOT NULL` would be a
-- smaller one: Prisma cannot express a WHERE clause on an index, so a
-- partial index here would be invisible to the schema and the next
-- `prisma migrate` would see it as drift and drop it. Matching what
-- the schema can declare is worth more than the few pages saved.
CREATE INDEX "User_plan_planHasta_idx" ON "User" ("plan", "planHasta");
