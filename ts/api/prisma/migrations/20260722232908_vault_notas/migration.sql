-- CreateTable
CREATE TABLE "vault_notas" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vault_notas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vault_notas_empresaId_idx" ON "vault_notas"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "vault_notas_empresaId_path_key" ON "vault_notas"("empresaId", "path");

-- AddForeignKey
ALTER TABLE "vault_notas" ADD CONSTRAINT "vault_notas_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Full-text search index (portuguese) sobre título + conteúdo, usado pela
-- recuperação do /ai/prompt (websearch_to_tsquery). Expressão IMMUTABLE porque
-- a config de idioma é literal.
CREATE INDEX "vault_notas_fts_idx" ON "vault_notas"
  USING GIN (to_tsvector('portuguese', coalesce("titulo", '') || ' ' || coalesce("conteudo", '')));
