-- CreateEnum
CREATE TYPE "ExecucaoStatus" AS ENUM ('planejando', 'executando', 'aguardando_aprovacao', 'concluida', 'falhou', 'cancelada', 'interrompida');

-- CreateEnum
CREATE TYPE "EtapaStatus" AS ENUM ('pendente', 'executando', 'aguardando_aprovacao', 'concluida', 'falhou', 'pulada', 'negada');

-- CreateEnum
CREATE TYPE "AprovacaoStatus" AS ENUM ('pendente', 'aprovada', 'negada', 'expirada');

-- CreateTable
CREATE TABLE "execucoes" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "conversaId" TEXT,
    "organizacaoId" TEXT,
    "repositorioId" TEXT,
    "pedido" TEXT NOT NULL,
    "status" "ExecucaoStatus" NOT NULL DEFAULT 'planejando',
    "plano" JSONB,
    "resultado" TEXT,
    "erro" TEXT,
    "tokensEntrada" INTEGER NOT NULL DEFAULT 0,
    "tokensSaida" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "concluidaEm" TIMESTAMP(3),

    CONSTRAINT "execucoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "etapas_execucao" (
    "id" TEXT NOT NULL,
    "execucaoId" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "ferramenta" TEXT,
    "descricao" TEXT NOT NULL,
    "dependeDe" TEXT[],
    "entrada" JSONB,
    "saida" JSONB,
    "erro" TEXT,
    "status" "EtapaStatus" NOT NULL DEFAULT 'pendente',
    "chaveIdempotencia" TEXT,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "iniciadaEm" TIMESTAMP(3),
    "concluidaEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "etapas_execucao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aprovacoes_acao" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "execucaoId" TEXT NOT NULL,
    "etapaId" TEXT NOT NULL,
    "solicitanteId" TEXT NOT NULL,
    "decididoPorId" TEXT,
    "ferramenta" TEXT NOT NULL,
    "risco" TEXT NOT NULL,
    "resumo" TEXT NOT NULL,
    "entrada" JSONB NOT NULL,
    "hashEntrada" TEXT NOT NULL,
    "revisao" JSONB,
    "status" "AprovacaoStatus" NOT NULL DEFAULT 'pendente',
    "motivo" TEXT,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "decididoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aprovacoes_acao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registros_auditoria" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "usuarioId" TEXT,
    "execucaoId" TEXT,
    "etapaId" TEXT,
    "evento" TEXT NOT NULL,
    "ferramenta" TEXT,
    "risco" TEXT,
    "detalhes" JSONB,
    "idRequisicao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registros_auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "execucoes_empresaId_usuarioId_criadoEm_idx" ON "execucoes"("empresaId", "usuarioId", "criadoEm");

-- CreateIndex
CREATE INDEX "execucoes_status_idx" ON "execucoes"("status");

-- CreateIndex
CREATE UNIQUE INDEX "etapas_execucao_chaveIdempotencia_key" ON "etapas_execucao"("chaveIdempotencia");

-- CreateIndex
CREATE INDEX "etapas_execucao_execucaoId_ordem_idx" ON "etapas_execucao"("execucaoId", "ordem");

-- CreateIndex
CREATE UNIQUE INDEX "etapas_execucao_execucaoId_chave_key" ON "etapas_execucao"("execucaoId", "chave");

-- CreateIndex
CREATE UNIQUE INDEX "aprovacoes_acao_etapaId_key" ON "aprovacoes_acao"("etapaId");

-- CreateIndex
CREATE INDEX "aprovacoes_acao_empresaId_status_criadoEm_idx" ON "aprovacoes_acao"("empresaId", "status", "criadoEm");

-- CreateIndex
CREATE INDEX "aprovacoes_acao_execucaoId_idx" ON "aprovacoes_acao"("execucaoId");

-- CreateIndex
CREATE INDEX "registros_auditoria_empresaId_criadoEm_idx" ON "registros_auditoria"("empresaId", "criadoEm");

-- CreateIndex
CREATE INDEX "registros_auditoria_execucaoId_criadoEm_idx" ON "registros_auditoria"("execucaoId", "criadoEm");

-- AddForeignKey
ALTER TABLE "execucoes" ADD CONSTRAINT "execucoes_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execucoes" ADD CONSTRAINT "execucoes_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execucoes" ADD CONSTRAINT "execucoes_conversaId_fkey" FOREIGN KEY ("conversaId") REFERENCES "conversas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "etapas_execucao" ADD CONSTRAINT "etapas_execucao_execucaoId_fkey" FOREIGN KEY ("execucaoId") REFERENCES "execucoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aprovacoes_acao" ADD CONSTRAINT "aprovacoes_acao_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aprovacoes_acao" ADD CONSTRAINT "aprovacoes_acao_execucaoId_fkey" FOREIGN KEY ("execucaoId") REFERENCES "execucoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aprovacoes_acao" ADD CONSTRAINT "aprovacoes_acao_etapaId_fkey" FOREIGN KEY ("etapaId") REFERENCES "etapas_execucao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aprovacoes_acao" ADD CONSTRAINT "aprovacoes_acao_solicitanteId_fkey" FOREIGN KEY ("solicitanteId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aprovacoes_acao" ADD CONSTRAINT "aprovacoes_acao_decididoPorId_fkey" FOREIGN KEY ("decididoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registros_auditoria" ADD CONSTRAINT "registros_auditoria_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registros_auditoria" ADD CONSTRAINT "registros_auditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registros_auditoria" ADD CONSTRAINT "registros_auditoria_execucaoId_fkey" FOREIGN KEY ("execucaoId") REFERENCES "execucoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

