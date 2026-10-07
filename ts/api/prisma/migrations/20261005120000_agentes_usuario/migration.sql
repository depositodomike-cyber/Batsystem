-- Agentes personalizados do usuário: tabela nova e isolada. Só CREATE —
-- nenhuma tabela existente é alterada.

-- CreateTable
CREATE TABLE "agentes_usuario" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "mencao" TEXT NOT NULL,
    "descricao" TEXT NOT NULL DEFAULT '',
    "instrucoes" TEXT NOT NULL DEFAULT '',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "excluidoEm" TIMESTAMP(3),

    CONSTRAINT "agentes_usuario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agentes_usuario_empresaId_usuarioId_idx" ON "agentes_usuario"("empresaId", "usuarioId");
