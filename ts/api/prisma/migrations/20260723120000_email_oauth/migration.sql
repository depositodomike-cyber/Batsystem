-- AlterTable
ALTER TABLE "empresa_conectores" ADD COLUMN     "refreshTokenEncrypted" TEXT,
ADD COLUMN     "tokenExpiresAt" TIMESTAMP(3);
