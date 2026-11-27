-- What a learner is carrying, written once a week.
--
-- Separate from `Feedback`, which is tied to one session by
-- `sessionId @unique`: that one answers "how did those eight questions
-- go", and twenty of them do not add up to "where do I stand".
--
-- The unique pair is the point. A week is the unit of idempotency, so
-- the second request inside one reads the stored row instead of
-- spending another call to the model. Without it, opening the screen
-- twice on a Tuesday is two invoices for the same report.
--
-- `datos` keeps what was handed to the model verbatim. The numbers in
-- a report come from `PerfilDebilidad`, already computed, and keeping
-- the input is how "where did it get that" gets answered later without
-- calling the model again.

-- CreateTable
CREATE TABLE "InformeSemanal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "semanaInicio" TIMESTAMP(3) NOT NULL,
    "resumen" TEXT NOT NULL,
    "fortalezas" JSONB NOT NULL,
    "debilidades" JSONB NOT NULL,
    "plan" JSONB NOT NULL,
    "datos" JSONB NOT NULL,
    "generadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modelo" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,

    CONSTRAINT "InformeSemanal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InformeSemanal_userId_generadoEn_idx" ON "InformeSemanal"("userId", "generadoEn");

-- CreateIndex
CREATE UNIQUE INDEX "InformeSemanal_userId_semanaInicio_key" ON "InformeSemanal"("userId", "semanaInicio");

-- AddForeignKey
ALTER TABLE "InformeSemanal" ADD CONSTRAINT "InformeSemanal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
