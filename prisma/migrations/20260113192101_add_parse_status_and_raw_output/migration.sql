-- CreateEnum
CREATE TYPE "ParseStatus" AS ENUM ('OK', 'FAIL');

-- AlterTable
ALTER TABLE "GenerationRequest" ADD COLUMN     "normalizedItemsCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "parseError" TEXT,
ADD COLUMN     "parseStatus" "ParseStatus",
ADD COLUMN     "rawModelOutput" TEXT;

-- CreateIndex
CREATE INDEX "GenerationRequest_parseStatus_idx" ON "GenerationRequest"("parseStatus");
