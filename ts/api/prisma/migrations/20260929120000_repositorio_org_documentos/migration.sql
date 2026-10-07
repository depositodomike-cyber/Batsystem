-- Repositório da organização: tabela nova e isolada. Só CREATE — nenhuma
-- tabela existente é alterada.

-- CreateTable
CREATE TABLE "repositorio_org_documentos" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "organizacaoId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "conteudo" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'processando',
    "erro" TEXT,
    "adicionadoPorId" TEXT NOT NULL,
    "adicionadoPorNome" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repositorio_org_documentos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "repositorio_org_documentos_empresaId_organizacaoId_idx" ON "repositorio_org_documentos"("empresaId", "organizacaoId");
