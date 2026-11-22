-- A question flagged to come back to, like the scratch sheet handed
-- out in the real sitting. Independent of whether it is answered.
ALTER TABLE "SimulacroPregunta"
  ADD COLUMN IF NOT EXISTS "marcada" BOOLEAN NOT NULL DEFAULT false;
