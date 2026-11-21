-- CreateEnum
CREATE TYPE "SimulacroStatus" AS ENUM ('en_curso', 'terminado', 'abandonado');

-- CreateTable
CREATE TABLE "Simulacro" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "totalPreguntas" INTEGER NOT NULL,
    "minutos" INTEGER NOT NULL,
    "status" "SimulacroStatus" NOT NULL DEFAULT 'en_curso',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "resultados" JSONB,

    CONSTRAINT "Simulacro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimulacroPregunta" (
    "id" TEXT NOT NULL,
    "simulacroId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "area" "Area" NOT NULL,
    "orden" INTEGER NOT NULL,
    "respuesta" TEXT,
    "correcta" BOOLEAN,
    "respondidaEn" TIMESTAMP(3),

    CONSTRAINT "SimulacroPregunta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Simulacro_userId_startedAt_idx" ON "Simulacro"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "SimulacroPregunta_simulacroId_idx" ON "SimulacroPregunta"("simulacroId");

-- CreateIndex
CREATE UNIQUE INDEX "SimulacroPregunta_simulacroId_orden_key" ON "SimulacroPregunta"("simulacroId", "orden");

-- AddForeignKey
ALTER TABLE "Simulacro" ADD CONSTRAINT "Simulacro_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulacroPregunta" ADD CONSTRAINT "SimulacroPregunta_simulacroId_fkey" FOREIGN KEY ("simulacroId") REFERENCES "Simulacro"("id") ON DELETE CASCADE ON UPDATE CASCADE;

