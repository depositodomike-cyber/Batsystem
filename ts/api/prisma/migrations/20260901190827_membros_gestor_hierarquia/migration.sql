-- AlterTable
ALTER TABLE "membros" ADD COLUMN     "gestorId" TEXT;

-- CreateIndex
CREATE INDEX "membros_empresaId_gestorId_idx" ON "membros"("empresaId", "gestorId");

-- AddForeignKey
ALTER TABLE "membros" ADD CONSTRAINT "membros_gestorId_fkey" FOREIGN KEY ("gestorId") REFERENCES "membros"("id") ON DELETE SET NULL ON UPDATE CASCADE;
