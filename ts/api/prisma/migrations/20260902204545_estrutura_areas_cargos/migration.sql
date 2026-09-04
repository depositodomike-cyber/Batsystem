-- Estrutura organizacional: Áreas e Cargos passam a ser entidades por tenant,
-- no lugar dos catálogos estáticos que viviam em ts/demo/src/app/data/.
--
-- SEM BACKFILL, de propósito. Esta migration é 100% DDL: nenhum UPDATE,
-- DELETE, DROP ou INSERT. Consequências, todas intencionais:
--   • as colunas legadas membros.area / membros.cargo (códigos de texto)
--     ficam intactas e continuam sendo exibidas como fallback;
--   • membros.areaId / membros.cargoId nascem NULOS em toda a base;
--   • as tabelas areas / cargos nascem VAZIAS em toda organização, que é o
--     empty state esperado — cada empresa cadastra as suas.
-- Nenhum registro existente é tocado e nenhum dado fictício é criado.

-- CreateEnum
CREATE TYPE "EstruturaStatus" AS ENUM ('ativo', 'inativo');

-- AlterTable
ALTER TABLE "membros" ADD COLUMN     "areaId" TEXT,
ADD COLUMN     "cargoId" TEXT;

-- CreateTable
CREATE TABLE "areas" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "status" "EstruturaStatus" NOT NULL DEFAULT 'ativo',
    "desativadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cargos" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "status" "EstruturaStatus" NOT NULL DEFAULT 'ativo',
    "desativadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cargos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "areas_empresaId_idx" ON "areas"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "areas_empresaId_nome_key" ON "areas"("empresaId", "nome");

-- CreateIndex
CREATE INDEX "cargos_empresaId_idx" ON "cargos"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "cargos_empresaId_nome_key" ON "cargos"("empresaId", "nome");

-- CreateIndex
CREATE INDEX "membros_empresaId_areaId_idx" ON "membros"("empresaId", "areaId");

-- CreateIndex
CREATE INDEX "membros_empresaId_cargoId_idx" ON "membros"("empresaId", "cargoId");

-- AddForeignKey
ALTER TABLE "membros" ADD CONSTRAINT "membros_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membros" ADD CONSTRAINT "membros_cargoId_fkey" FOREIGN KEY ("cargoId") REFERENCES "cargos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "areas" ADD CONSTRAINT "areas_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cargos" ADD CONSTRAINT "cargos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
