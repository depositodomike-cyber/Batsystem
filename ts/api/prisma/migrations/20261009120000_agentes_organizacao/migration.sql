-- Agentes da ORGANIZAÇÃO (Configurações da organização → IA → Agentes).
-- Mesma tabela dos agentes personalizados: a coluna nova e nula diz o escopo.
-- Nulo = agente pessoal (como todas as linhas existentes); preenchido = agente
-- compartilhado com a organização (`usuarioId` passa a ser quem o criou).

-- AlterTable
ALTER TABLE "agentes_usuario" ADD COLUMN "organizacaoId" TEXT;

-- CreateIndex
CREATE INDEX "agentes_usuario_empresaId_organizacaoId_idx" ON "agentes_usuario"("empresaId", "organizacaoId");
