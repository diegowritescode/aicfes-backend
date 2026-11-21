-- AlterTable
ALTER TABLE "GeneratedItem" ADD COLUMN     "conteoOpciones" JSONB,
ADD COLUMN     "motivoRetiro" TEXT,
ADD COLUMN     "retirado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tiempoTotalMs" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "vecesCorrecto" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "vecesRespondido" INTEGER NOT NULL DEFAULT 0;

