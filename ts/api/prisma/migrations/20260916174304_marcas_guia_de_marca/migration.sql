-- CreateTable
CREATE TABLE "marcas" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "conteudo" JSONB NOT NULL,
    "logoClaro" TEXT,
    "logoEscuro" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marcas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "marcas_empresaId_idx" ON "marcas"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "marcas_empresaId_nome_key" ON "marcas"("empresaId", "nome");

-- AddForeignKey
ALTER TABLE "marcas" ADD CONSTRAINT "marcas_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
