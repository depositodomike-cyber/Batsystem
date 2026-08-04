-- AlterEnum
ALTER TYPE "ModuloCode" ADD VALUE 'ia_pessoal';

-- AlterTable
ALTER TABLE "assinaturas" ADD COLUMN     "configuracoes" JSONB;
