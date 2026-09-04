-- CreateEnum
CREATE TYPE "MembroStatus" AS ENUM ('ativo', 'convite_pendente', 'inativo');

-- CreateTable
CREATE TABLE "membros" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "usuarioId" TEXT,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "area" TEXT,
    "cargo" TEXT,
    "status" "MembroStatus" NOT NULL DEFAULT 'convite_pendente',
    "convidadoEm" TIMESTAMP(3),
    "desativadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "membros_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "membros_empresaId_idx" ON "membros"("empresaId");

-- CreateIndex
CREATE INDEX "membros_empresaId_status_idx" ON "membros"("empresaId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "membros_empresaId_email_key" ON "membros"("empresaId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "membros_empresaId_usuarioId_key" ON "membros"("empresaId", "usuarioId");

-- AddForeignKey
ALTER TABLE "membros" ADD CONSTRAINT "membros_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membros" ADD CONSTRAINT "membros_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill (escrito à mão, aditivo e idempotente): todo usuário existente ganha
-- o seu membro ativo, para a listagem já abrir preenchida em qualquer ambiente.
-- Só INSERT, guardado por NOT EXISTS — nenhum UPDATE, DELETE ou DROP.
-- gen_random_uuid() é nativo no PG 13+ (local é 16, Neon é 15/16); os ids desta
-- leva ficam UUID e os criados pela API ficam cuid() — ambos são TEXT opaco.
INSERT INTO "membros" ("id", "empresaId", "usuarioId", "nome", "email", "status", "criadoEm", "atualizadoEm")
SELECT gen_random_uuid()::text,
       u."empresaId",
       u."id",
       u."nome",
       u."email",
       'ativo'::"MembroStatus",
       u."criadoEm",
       NOW()
FROM "usuarios" u
WHERE NOT EXISTS (
  SELECT 1 FROM "membros" m WHERE m."usuarioId" = u."id"
);
