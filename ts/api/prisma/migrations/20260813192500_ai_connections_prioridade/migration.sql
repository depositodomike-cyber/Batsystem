-- Múltiplos modelos de IA por modalidade, ordenados por prioridade.
-- As conexões existentes viram o item de prioridade 0 (principal) da lista.

-- DropIndex
DROP INDEX "ai_connections_empresaId_key";

-- DropIndex
DROP INDEX "ai_media_connections_empresaId_kind_key";

-- AlterTable
ALTER TABLE "ai_connections" ADD COLUMN     "priority" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ai_media_connections" ADD COLUMN     "priority" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "ai_connections_empresaId_priority_idx" ON "ai_connections"("empresaId", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "ai_connections_empresaId_provider_model_key" ON "ai_connections"("empresaId", "provider", "model");

-- CreateIndex
CREATE INDEX "ai_media_connections_empresaId_kind_priority_idx" ON "ai_media_connections"("empresaId", "kind", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "ai_media_connections_empresaId_kind_provider_model_key" ON "ai_media_connections"("empresaId", "kind", "provider", "model");
