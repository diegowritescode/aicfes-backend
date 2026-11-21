-- The bank stores verified items for reuse. pgvector powers the
-- near-duplicate check, so the extension has to exist first.
CREATE EXTENSION IF NOT EXISTS vector;

-- AlterTable
ALTER TABLE "GeneratedItem" ADD COLUMN     "embedding" vector(1536),
ADD COLUMN     "lastServedAt" TIMESTAMP(3),
ADD COLUMN     "questionHash" TEXT,
ADD COLUMN     "timesServed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "verifierAnswer" TEXT,
ADD COLUMN     "verifierConfidence" TEXT;

-- CreateIndex
CREATE INDEX "GeneratedItem_verified_area_dificultad_idx" ON "GeneratedItem"("verified", "area", "dificultad");

-- CreateIndex
CREATE UNIQUE INDEX "GeneratedItem_questionHash_key" ON "GeneratedItem"("questionHash");

