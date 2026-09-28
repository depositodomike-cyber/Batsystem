-- AlterTable
ALTER TABLE "insights" ADD COLUMN     "analise" TEXT,
ADD COLUMN     "evidencias" TEXT[] DEFAULT ARRAY[]::TEXT[];

