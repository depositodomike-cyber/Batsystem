-- CreateEnum
CREATE TYPE "ConversaOrigem" AS ENUM ('prompt', 'squad');

-- AlterTable
ALTER TABLE "conversas" ADD COLUMN "origem" "ConversaOrigem" NOT NULL DEFAULT 'squad';
ALTER TABLE "conversas" ADD COLUMN "modo" TEXT;
ALTER TABLE "conversas" ALTER COLUMN "squadId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "mensagens" ADD COLUMN "meta" JSONB;

-- CreateIndex
CREATE INDEX "conversas_empresaId_usuarioId_origem_atualizadoEm_idx" ON "conversas"("empresaId", "usuarioId", "origem", "atualizadoEm");
