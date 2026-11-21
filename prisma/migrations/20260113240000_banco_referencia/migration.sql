-- CreateTable
CREATE TABLE "ItemReferencia" (
    "id" TEXT NOT NULL,
    "fuente" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "area" "Area" NOT NULL,
    "enunciado" TEXT NOT NULL,
    "opciones" JSONB NOT NULL,
    "hash" TEXT NOT NULL,
    "embedding" vector(1536),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemReferencia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ItemReferencia_hash_key" ON "ItemReferencia"("hash");

-- CreateIndex
CREATE INDEX "ItemReferencia_area_idx" ON "ItemReferencia"("area");

