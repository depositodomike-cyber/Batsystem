-- AlterTable
ALTER TABLE "conversas" ADD COLUMN "repositorioId" TEXT;

-- CreateIndex
CREATE INDEX "conversas_repo_origem_idx" ON "conversas"("empresaId", "usuarioId", "repositorioId", "origem", "atualizadoEm");
