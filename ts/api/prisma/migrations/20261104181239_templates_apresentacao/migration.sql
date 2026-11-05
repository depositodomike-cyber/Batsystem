-- CreateTable
CREATE TABLE "templates_apresentacao" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "contexto" TEXT,
    "formato" TEXT NOT NULL,
    "arquivoNome" TEXT NOT NULL,
    "arquivoMime" TEXT NOT NULL,
    "arquivoTamanho" INTEGER NOT NULL,
    "arquivo" BYTEA NOT NULL,
    "estrutura" JSONB NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "templates_apresentacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "templates_apresentacao_empresaId_idx" ON "templates_apresentacao"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "templates_apresentacao_empresaId_nome_key" ON "templates_apresentacao"("empresaId", "nome");

-- AddForeignKey
ALTER TABLE "templates_apresentacao" ADD CONSTRAINT "templates_apresentacao_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
