-- Resumo Matinal: cache do briefing diário. Só CREATE —
-- nenhuma tabela existente é alterada.

-- CreateTable
CREATE TABLE "briefings" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "dados" JSONB NOT NULL,
    "assinatura" TEXT NOT NULL,
    "geradoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "briefings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "briefings_usuarioId_data_periodo_key" ON "briefings"("usuarioId", "data", "periodo");

-- CreateIndex
CREATE INDEX "briefings_empresaId_idx" ON "briefings"("empresaId");
