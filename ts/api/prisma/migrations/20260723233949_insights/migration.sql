-- CreateEnum
CREATE TYPE "InsightSeveridade" AS ENUM ('secondary', 'warning', 'success', 'light');

-- CreateTable
CREATE TABLE "insights" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'Insight',
    "severidade" "InsightSeveridade" NOT NULL DEFAULT 'light',
    "liderado" TEXT,
    "origem" TEXT NOT NULL DEFAULT 'Manual',
    "memoriaId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "insights_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "insights_empresaId_idx" ON "insights"("empresaId");

-- AddForeignKey
ALTER TABLE "insights" ADD CONSTRAINT "insights_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
