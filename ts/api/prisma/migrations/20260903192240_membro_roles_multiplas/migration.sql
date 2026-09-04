-- CreateTable
CREATE TABLE "membro_roles" (
    "id" TEXT NOT NULL,
    "membroId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "membro_roles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "membro_roles_roleId_idx" ON "membro_roles"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "membro_roles_membroId_roleId_key" ON "membro_roles"("membroId", "roleId");

-- AddForeignKey
ALTER TABLE "membro_roles" ADD CONSTRAINT "membro_roles_membroId_fkey" FOREIGN KEY ("membroId") REFERENCES "membros"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membro_roles" ADD CONSTRAINT "membro_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Backfill (escrito à mão: o `prisma migrate dev` gera só o DDL acima).
--
-- `membros.roleId` é lida AQUI pela última vez. Depois disto a fonte de verdade
-- é `membro_roles`, e o código novo nunca mais escreve a coluna. Sem este
-- backfill, todo membro que hoje tem role perderia o acesso.
--
-- `id` determinístico no par (membroId, roleId): rodar de novo colide tanto na
-- PK quanto na unique, e o ON CONFLICT no par cobre as duas. `criadoEm` fica de
-- fora porque o DEFAULT CURRENT_TIMESTAMP acima já resolve — um NOW() aqui
-- traria timestamptz com o fuso da sessão que aplicou a migration.
-- ---------------------------------------------------------------------------
INSERT INTO "membro_roles" ("id", "membroId", "roleId")
SELECT 'mr_' || md5(m."id" || ':' || m."roleId"), m."id", m."roleId"
FROM "membros" m
WHERE m."roleId" IS NOT NULL
ON CONFLICT ("membroId", "roleId") DO NOTHING;

-- Backfill VERIFICADO. Um INSERT ... SELECT que não pega nada sai com sucesso,
-- e a aplicação subiria com TODO MUNDO SEM ROLE — sem erro e sem log. O
-- Postgres roda o arquivo de migration numa transação, então esta exceção
-- reverte o CREATE TABLE junto. Banco novo: 0 linhas de origem, 0 faltando,
-- passa sem caso especial.
DO $$
DECLARE faltando bigint;
BEGIN
  SELECT count(*) INTO faltando
  FROM "membros" m
  WHERE m."roleId" IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM "membro_roles" mr
      WHERE mr."membroId" = m."id" AND mr."roleId" = m."roleId"
    );
  IF faltando > 0 THEN
    RAISE EXCEPTION 'Backfill de membro_roles incompleto: % membro(s) com roleId sem vinculo', faltando;
  END IF;
END $$;
