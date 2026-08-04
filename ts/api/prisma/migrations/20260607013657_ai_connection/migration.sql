-- CreateEnum
CREATE TYPE "AiProvider" AS ENUM ('anthropic', 'openai');

-- CreateEnum
CREATE TYPE "AiConnectionStatus" AS ENUM ('ativa', 'invalida');

-- CreateTable
CREATE TABLE "ai_connections" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "provider" "AiProvider" NOT NULL,
    "model" TEXT NOT NULL,
    "apiKeyEncrypted" TEXT NOT NULL,
    "keyLast4" TEXT NOT NULL,
    "status" "AiConnectionStatus" NOT NULL DEFAULT 'ativa',
    "validatedAt" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_connections_empresaId_key" ON "ai_connections"("empresaId");

-- AddForeignKey
ALTER TABLE "ai_connections" ADD CONSTRAINT "ai_connections_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
