-- AlterTable
ALTER TABLE "vault_notas" ADD COLUMN     "categoriasHash" TEXT;

-- CreateTable
CREATE TABLE "vault_categorias" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "repositorioId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "definicao" TEXT,
    "confirmada" BOOLEAN NOT NULL DEFAULT false,
    "propostas" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vault_categorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vault_nota_categorias" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "repositorioId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "categoriaSlug" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vault_nota_categorias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vault_categorias_empresaId_repositorioId_idx" ON "vault_categorias"("empresaId", "repositorioId");

-- CreateIndex
CREATE UNIQUE INDEX "vault_categorias_empresaId_repositorioId_slug_key" ON "vault_categorias"("empresaId", "repositorioId", "slug");

-- CreateIndex
CREATE INDEX "vault_nota_categorias_empresaId_repositorioId_path_idx" ON "vault_nota_categorias"("empresaId", "repositorioId", "path");

-- CreateIndex
CREATE INDEX "vault_nota_categorias_empresaId_repositorioId_categoriaSlug_idx" ON "vault_nota_categorias"("empresaId", "repositorioId", "categoriaSlug");

-- CreateIndex
CREATE UNIQUE INDEX "vault_nota_categorias_empresaId_repositorioId_path_categori_key" ON "vault_nota_categorias"("empresaId", "repositorioId", "path", "categoriaSlug");

-- AddForeignKey
ALTER TABLE "vault_categorias" ADD CONSTRAINT "vault_categorias_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_nota_categorias" ADD CONSTRAINT "vault_nota_categorias_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
