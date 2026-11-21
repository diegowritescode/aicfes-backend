-- CreateTable
CREATE TABLE "ConsumoLlm" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "operacion" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "tokensEntrada" INTEGER NOT NULL,
    "tokensSalida" INTEGER NOT NULL,
    "costoMilicent" INTEGER NOT NULL,
    "exito" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsumoLlm_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConsumoLlm_userId_createdAt_idx" ON "ConsumoLlm"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ConsumoLlm_createdAt_idx" ON "ConsumoLlm"("createdAt");

-- CreateIndex
CREATE INDEX "ConsumoLlm_operacion_idx" ON "ConsumoLlm"("operacion");

