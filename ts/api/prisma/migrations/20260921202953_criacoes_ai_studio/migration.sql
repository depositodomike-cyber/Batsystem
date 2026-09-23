-- CreateEnum
CREATE TYPE "CriacaoTipo" AS ENUM ('apresentacao', 'planilha');

-- CreateEnum
CREATE TYPE "CriacaoStatus" AS ENUM ('rascunho', 'planejando', 'plano_pronto', 'gerando', 'concluido', 'erro');

-- CreateTable
CREATE TABLE "criacoes" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "repositorioId" TEXT,
    "tipo" "CriacaoTipo" NOT NULL,
    "status" "CriacaoStatus" NOT NULL DEFAULT 'rascunho',
    "etapa" TEXT NOT NULL DEFAULT 'configuracao',
    "titulo" TEXT NOT NULL DEFAULT '',
    "dados" JSONB NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "criacoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "criacoes_empresaId_usuarioId_atualizadoEm_idx" ON "criacoes"("empresaId", "usuarioId", "atualizadoEm");

-- CreateIndex
CREATE INDEX "criacoes_empresaId_usuarioId_tipo_status_atualizadoEm_idx" ON "criacoes"("empresaId", "usuarioId", "tipo", "status", "atualizadoEm");

-- AddForeignKey
ALTER TABLE "criacoes" ADD CONSTRAINT "criacoes_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "criacoes" ADD CONSTRAINT "criacoes_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
