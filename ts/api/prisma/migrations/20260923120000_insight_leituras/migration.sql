-- CreateTable
CREATE TABLE "insight_leituras" (
    "insightId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "lidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "insight_leituras_pkey" PRIMARY KEY ("insightId","usuarioId")
);

-- CreateIndex
CREATE INDEX "insight_leituras_usuarioId_idx" ON "insight_leituras"("usuarioId");

-- AddForeignKey
ALTER TABLE "insight_leituras" ADD CONSTRAINT "insight_leituras_insightId_fkey" FOREIGN KEY ("insightId") REFERENCES "insights"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insight_leituras" ADD CONSTRAINT "insight_leituras_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
