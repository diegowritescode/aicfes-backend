-- CreateEnum
CREATE TYPE "EstadoDeAmistad" AS ENUM ('pendiente', 'aceptada', 'rechazada');

-- CreateTable
CREATE TABLE "Amistad" (
    "id" TEXT NOT NULL,
    "pidioId" TEXT NOT NULL,
    "recibioId" TEXT NOT NULL,
    "estado" "EstadoDeAmistad" NOT NULL DEFAULT 'pendiente',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resueltaEn" TIMESTAMP(3),

    CONSTRAINT "Amistad_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Amistad_pidioId_estado_idx" ON "Amistad"("pidioId", "estado");

-- CreateIndex
CREATE INDEX "Amistad_recibioId_estado_idx" ON "Amistad"("recibioId", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "Amistad_pidioId_recibioId_key" ON "Amistad"("pidioId", "recibioId");

-- AddForeignKey
ALTER TABLE "Amistad" ADD CONSTRAINT "Amistad_pidioId_fkey" FOREIGN KEY ("pidioId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Amistad" ADD CONSTRAINT "Amistad_recibioId_fkey" FOREIGN KEY ("recibioId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

