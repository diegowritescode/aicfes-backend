-- AlterTable
ALTER TABLE "User" ADD COLUMN     "esModerador" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "moderadorDesde" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "User_esModerador_idx" ON "User"("esModerador");
