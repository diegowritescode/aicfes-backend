-- The figure a learner picked, and the colour behind it.
--
-- Both nullable with no default, which is what keeps this additive:
-- every account that exists keeps the avatar it already had, because
-- null means «derive it from the alias» and that is exactly what the
-- code did before these columns existed.
ALTER TABLE "User" ADD COLUMN "avatar" VARCHAR(24);
ALTER TABLE "User" ADD COLUMN "avatarColor" INTEGER;
