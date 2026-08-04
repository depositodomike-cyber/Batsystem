-- CreateTable
CREATE TABLE "empresa_conectores" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "connectorId" TEXT NOT NULL,
    "origem" TEXT NOT NULL DEFAULT 'app',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "empresa_conectores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mcp_api_keys" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "last4" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "revogadaEm" TIMESTAMP(3),

    CONSTRAINT "mcp_api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "empresa_conectores_empresaId_idx" ON "empresa_conectores"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "empresa_conectores_empresaId_connectorId_key" ON "empresa_conectores"("empresaId", "connectorId");

-- CreateIndex
CREATE UNIQUE INDEX "mcp_api_keys_keyHash_key" ON "mcp_api_keys"("keyHash");

-- CreateIndex
CREATE INDEX "mcp_api_keys_empresaId_idx" ON "mcp_api_keys"("empresaId");

-- AddForeignKey
ALTER TABLE "empresa_conectores" ADD CONSTRAINT "empresa_conectores_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_api_keys" ADD CONSTRAINT "mcp_api_keys_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
