-- CreateEnum
CREATE TYPE "DueloEstado" AS ENUM ('pendiente', 'en_curso', 'terminado', 'cancelado');

-- CreateEnum
CREATE TYPE "DenunciaMotivo" AS ENUM ('alias_ofensivo', 'acoso', 'suplantacion', 'otro');

-- CreateEnum
CREATE TYPE "DenunciaEstado" AS ENUM ('abierta', 'revisada', 'descartada');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "alias" TEXT,
ADD COLUMN     "aliasBuscable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "tutorAutorizoEn" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Duelo" (
    "id" TEXT NOT NULL,
    "retadorId" TEXT NOT NULL,
    "rivalId" TEXT NOT NULL,
    "estado" "DueloEstado" NOT NULL DEFAULT 'pendiente',
    "itemIds" TEXT[],
    "resultadoRetador" JSONB,
    "resultadoRival" JSONB,
    "ganadorId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiraEn" TIMESTAMP(3) NOT NULL,
    "terminadoEn" TIMESTAMP(3),

    CONSTRAINT "Duelo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bloqueo" (
    "id" TEXT NOT NULL,
    "bloqueadorId" TEXT NOT NULL,
    "bloqueadoId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bloqueo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Denuncia" (
    "id" TEXT NOT NULL,
    "denuncianteId" TEXT NOT NULL,
    "denunciadoId" TEXT NOT NULL,
    "motivo" "DenunciaMotivo" NOT NULL,
    "detalle" TEXT,
    "estado" "DenunciaEstado" NOT NULL DEFAULT 'abierta',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revisadoEn" TIMESTAMP(3),

    CONSTRAINT "Denuncia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Duelo_retadorId_creadoEn_idx" ON "Duelo"("retadorId", "creadoEn");

-- CreateIndex
CREATE INDEX "Duelo_rivalId_estado_idx" ON "Duelo"("rivalId", "estado");

-- CreateIndex
CREATE INDEX "Bloqueo_bloqueadorId_idx" ON "Bloqueo"("bloqueadorId");

-- CreateIndex
CREATE UNIQUE INDEX "Bloqueo_bloqueadorId_bloqueadoId_key" ON "Bloqueo"("bloqueadorId", "bloqueadoId");

-- CreateIndex
CREATE INDEX "Denuncia_estado_creadoEn_idx" ON "Denuncia"("estado", "creadoEn");

-- CreateIndex
CREATE INDEX "Denuncia_denunciadoId_idx" ON "Denuncia"("denunciadoId");

-- CreateIndex
CREATE UNIQUE INDEX "User_alias_key" ON "User"("alias");

-- AddForeignKey
ALTER TABLE "Duelo" ADD CONSTRAINT "Duelo_retadorId_fkey" FOREIGN KEY ("retadorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Duelo" ADD CONSTRAINT "Duelo_rivalId_fkey" FOREIGN KEY ("rivalId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bloqueo" ADD CONSTRAINT "Bloqueo_bloqueadorId_fkey" FOREIGN KEY ("bloqueadorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bloqueo" ADD CONSTRAINT "Bloqueo_bloqueadoId_fkey" FOREIGN KEY ("bloqueadoId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Denuncia" ADD CONSTRAINT "Denuncia_denuncianteId_fkey" FOREIGN KEY ("denuncianteId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Denuncia" ADD CONSTRAINT "Denuncia_denunciadoId_fkey" FOREIGN KEY ("denunciadoId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

