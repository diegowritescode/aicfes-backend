-- Which item an answer belongs to. Without it the answer cannot be
-- joined back to the question's topic or to the kind of mistake the
-- chosen option represents, so every answer so far has told us only
-- "got it wrong in MAT" — too coarse to act on.
-- Nullable: answers recorded before this have no item to point at.
ALTER TABLE "Answer" ADD COLUMN "itemId" TEXT;
ALTER TABLE "Answer" ADD COLUMN "tiempoMs" INTEGER;
CREATE INDEX "Answer_itemId_idx" ON "Answer"("itemId");

-- What a learner keeps getting wrong, and at what grain.
CREATE TABLE "PerfilDebilidad" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "area" "Area" NOT NULL,
    "tema" TEXT NOT NULL,
    "respondidas" INTEGER NOT NULL DEFAULT 0,
    "acertadas" INTEGER NOT NULL DEFAULT 0,
    "tipoErrores" JSONB NOT NULL DEFAULT '{}',
    "ultimoFallo" TIMESTAMP(3),
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PerfilDebilidad_pkey" PRIMARY KEY ("id")
);

-- One row per learner, area and topic: the upsert key.
CREATE UNIQUE INDEX "PerfilDebilidad_userId_area_tema_key"
    ON "PerfilDebilidad"("userId", "area", "tema");
CREATE INDEX "PerfilDebilidad_userId_area_idx"
    ON "PerfilDebilidad"("userId", "area");

ALTER TABLE "PerfilDebilidad" ADD CONSTRAINT "PerfilDebilidad_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
