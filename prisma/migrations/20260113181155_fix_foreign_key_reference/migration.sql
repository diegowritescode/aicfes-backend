-- DropForeignKey
ALTER TABLE "GeneratedItem" DROP CONSTRAINT "GeneratedItem_requestId_fkey";

-- AddForeignKey
ALTER TABLE "GeneratedItem" ADD CONSTRAINT "GeneratedItem_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "GenerationRequest"("requestId") ON DELETE CASCADE ON UPDATE CASCADE;
