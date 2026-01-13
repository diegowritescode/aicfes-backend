-- CreateEnum
CREATE TYPE "Area" AS ENUM ('MAT', 'LC', 'CN', 'SOC', 'ING');

-- CreateEnum
CREATE TYPE "Dificultad" AS ENUM ('facil', 'media', 'alta');

-- CreateEnum
CREATE TYPE "GenerationStatus" AS ENUM ('PENDING', 'SUCCESS', 'ERROR');

-- CreateTable
CREATE TABLE "GenerationRequest" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "area" "Area" NOT NULL,
    "dificultad" "Dificultad" NOT NULL,
    "tema" TEXT,
    "plantilla" TEXT,
    "n" INTEGER NOT NULL DEFAULT 1,
    "status" "GenerationStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GenerationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedItem" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "area" "Area" NOT NULL,
    "dificultad" "Dificultad" NOT NULL,
    "plantilla" TEXT NOT NULL,
    "contexto" TEXT NOT NULL,
    "pregunta" TEXT NOT NULL,
    "opciones" JSONB NOT NULL,
    "respuesta_correcta" TEXT NOT NULL,
    "justificacion" TEXT NOT NULL,
    "tags" JSONB NOT NULL,
    "distractores" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeneratedItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GenerationRequest_requestId_key" ON "GenerationRequest"("requestId");

-- CreateIndex
CREATE INDEX "GenerationRequest_requestId_idx" ON "GenerationRequest"("requestId");

-- CreateIndex
CREATE INDEX "GenerationRequest_status_idx" ON "GenerationRequest"("status");

-- CreateIndex
CREATE INDEX "GenerationRequest_createdAt_idx" ON "GenerationRequest"("createdAt");

-- CreateIndex
CREATE INDEX "GeneratedItem_requestId_idx" ON "GeneratedItem"("requestId");

-- CreateIndex
CREATE INDEX "GeneratedItem_area_idx" ON "GeneratedItem"("area");

-- CreateIndex
CREATE INDEX "GeneratedItem_createdAt_idx" ON "GeneratedItem"("createdAt");

-- AddForeignKey
ALTER TABLE "GeneratedItem" ADD CONSTRAINT "GeneratedItem_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "GenerationRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
