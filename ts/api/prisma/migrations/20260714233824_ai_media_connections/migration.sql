-- CreateEnum
CREATE TYPE "AiMediaKind" AS ENUM ('image', 'video');

-- CreateTable
CREATE TABLE "ai_media_connections" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "kind" "AiMediaKind" NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "apiKeyEncrypted" TEXT NOT NULL,
    "keyLast4" TEXT NOT NULL,
    "status" "AiConnectionStatus" NOT NULL DEFAULT 'ativa',
    "validatedAt" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_media_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_media_connections_empresaId_kind_key" ON "ai_media_connections"("empresaId", "kind");

-- AddForeignKey
ALTER TABLE "ai_media_connections" ADD CONSTRAINT "ai_media_connections_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
