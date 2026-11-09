-- Perfil Pessoal do usuário: tabela nova e isolada. Só CREATE —
-- nenhuma tabela existente é alterada.

-- CreateTable
CREATE TABLE "perfis_pessoais" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "dados" JSONB NOT NULL DEFAULT '{}',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "perfis_pessoais_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "perfis_pessoais_usuarioId_key" ON "perfis_pessoais"("usuarioId");

-- CreateIndex
CREATE INDEX "perfis_pessoais_empresaId_idx" ON "perfis_pessoais"("empresaId");
