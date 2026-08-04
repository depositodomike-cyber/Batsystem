-- AlterTable
ALTER TABLE "empresa_conectores" ADD COLUMN     "accessTokenEncrypted" TEXT,
ADD COLUMN     "scopes" TEXT,
ADD COLUMN     "teamId" TEXT,
ADD COLUMN     "teamName" TEXT;
