-- CreateEnum
CREATE TYPE "RoleTipo" AS ENUM ('sistema', 'personalizada');

-- AlterTable
ALTER TABLE "membros" ADD COLUMN     "roleId" TEXT;

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "tipo" "RoleTipo" NOT NULL DEFAULT 'personalizada',
    "codigo" TEXT,
    "permissoes" TEXT[],
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "roles_empresaId_idx" ON "roles"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "roles_empresaId_nome_key" ON "roles"("empresaId", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "roles_empresaId_codigo_key" ON "roles"("empresaId", "codigo");

-- CreateIndex
CREATE INDEX "membros_empresaId_roleId_idx" ON "membros"("empresaId", "roleId");

-- AddForeignKey
ALTER TABLE "membros" ADD CONSTRAINT "membros_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
