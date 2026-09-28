-- CreateEnum
CREATE TYPE "DirecionamentoTipo" AS ENUM ('priorizar_assunto', 'ajustar_insights');

-- CreateEnum
CREATE TYPE "DirecionamentoPrioridade" AS ENUM ('normal', 'alta');

-- CreateEnum
CREATE TYPE "InsightFeedbackMotivo" AS ENUM ('nao_relevante', 'ja_conhecia', 'conclusao_incorreta', 'nao_quero_assunto', 'outro');

-- AlterTable
ALTER TABLE "insights" ADD COLUMN     "direcionamentoId" TEXT;

-- CreateTable
CREATE TABLE "insight_direcionamentos" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "DirecionamentoTipo" NOT NULL,
    "instrucao" TEXT NOT NULL,
    "areaId" TEXT,
    "prioridade" "DirecionamentoPrioridade" NOT NULL DEFAULT 'normal',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insight_direcionamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insight_feedbacks" (
    "insightId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "util" BOOLEAN NOT NULL,
    "motivo" "InsightFeedbackMotivo",
    "comentario" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insight_feedbacks_pkey" PRIMARY KEY ("insightId","usuarioId")
);

-- CreateIndex
CREATE INDEX "insight_direcionamentos_empresaId_ativo_idx" ON "insight_direcionamentos"("empresaId", "ativo");

-- CreateIndex
CREATE INDEX "insight_feedbacks_usuarioId_idx" ON "insight_feedbacks"("usuarioId");

-- AddForeignKey
ALTER TABLE "insights" ADD CONSTRAINT "insights_direcionamentoId_fkey" FOREIGN KEY ("direcionamentoId") REFERENCES "insight_direcionamentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insight_direcionamentos" ADD CONSTRAINT "insight_direcionamentos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insight_direcionamentos" ADD CONSTRAINT "insight_direcionamentos_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insight_direcionamentos" ADD CONSTRAINT "insight_direcionamentos_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insight_feedbacks" ADD CONSTRAINT "insight_feedbacks_insightId_fkey" FOREIGN KEY ("insightId") REFERENCES "insights"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insight_feedbacks" ADD CONSTRAINT "insight_feedbacks_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

