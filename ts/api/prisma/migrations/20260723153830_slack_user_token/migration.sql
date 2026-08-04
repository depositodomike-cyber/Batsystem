-- AlterTable
ALTER TABLE "empresa_conectores" ADD COLUMN     "userId" TEXT,
ADD COLUMN     "userScopes" TEXT,
ADD COLUMN     "userTokenEncrypted" TEXT;
