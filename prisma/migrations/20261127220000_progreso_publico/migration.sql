-- Opt-in: whether a learner's progress travels to someone who found
-- them by alias but is not their friend.
--
-- DEFAULT false on purpose. Every existing account agreed to being
-- findable, not to being measured by strangers; a default of true
-- would change that agreement for all of them at deploy time.
ALTER TABLE "User" ADD COLUMN "progresoPublico" BOOLEAN NOT NULL DEFAULT false;
