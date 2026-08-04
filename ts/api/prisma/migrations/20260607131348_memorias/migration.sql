-- CreateEnum
CREATE TYPE "MemoriaConfianca" AS ENUM ('alta', 'media', 'baixa');

-- CreateTable
CREATE TABLE "memorias" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "origem" TEXT NOT NULL DEFAULT 'Manual',
    "confianca" "MemoriaConfianca" NOT NULL DEFAULT 'alta',
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "fixada" BOOLEAN NOT NULL DEFAULT false,
    "aprendidaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memorias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "memorias_empresaId_ativa_idx" ON "memorias"("empresaId", "ativa");

-- CreateIndex
CREATE INDEX "memorias_empresaId_fixada_idx" ON "memorias"("empresaId", "fixada");

-- AddForeignKey
ALTER TABLE "memorias" ADD CONSTRAINT "memorias_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
