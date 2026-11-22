-- Where a mode sits in the ladder, and the pace it actually sets.
-- The three modes being replaced all worked out to 60 seconds a
-- question, so there was no ladder to be in: the real exam gives 64.
ALTER TABLE "TimeTrialMode" ADD COLUMN "nivel" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "TimeTrialMode" ADD COLUMN "segundosPorPregunta" INTEGER NOT NULL DEFAULT 64;

-- Retire the old modes rather than deleting them: a finished session
-- still points at the mode it was played under.
UPDATE "TimeTrialMode" SET "enabled" = false
WHERE id IN ('sprint_10', 'reto_5', 'explosivo');
