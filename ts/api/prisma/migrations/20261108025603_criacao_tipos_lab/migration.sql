-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CriacaoTipo" ADD VALUE 'analise';
ALTER TYPE "CriacaoTipo" ADD VALUE 'artigo';
ALTER TYPE "CriacaoTipo" ADD VALUE 'ata';
ALTER TYPE "CriacaoTipo" ADD VALUE 'carrossel';
ALTER TYPE "CriacaoTipo" ADD VALUE 'dashboard';
ALTER TYPE "CriacaoTipo" ADD VALUE 'imagem';
ALTER TYPE "CriacaoTipo" ADD VALUE 'melhorar';
ALTER TYPE "CriacaoTipo" ADD VALUE 'video';
