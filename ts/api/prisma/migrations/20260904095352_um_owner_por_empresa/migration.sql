-- Um único proprietário por organização, garantido pelo banco.
--
-- Escrita à mão: o Prisma não expressa índice PARCIAL no schema, então
-- `migrate dev` não gera esta linha e o `prisma migrate diff` não a vê como
-- drift.
--
-- Por que no banco e não só no service: `Usuario.role` era write-once em
-- `CompaniesService.cadastrar()` e agora ganha uma segunda via de escrita (a
-- transferência de propriedade). Fora dela ainda existem o seed de demo e o SQL
-- manual, e "dois owners" é um estado que NADA no código revalida — o
-- `skip-if-unchanged` de `MembrosService.resolverRoles` nunca reexamina um
-- vínculo Owner já atribuído. Este índice é o que torna o estado impossível em
-- vez de improvável.
--
-- É ele também que força a ordem "rebaixar antes de promover" dentro da
-- transação de transferência: o Postgres checa índice único por STATEMENT, não
-- no commit.
--
-- PARCIAL de propósito: não força a EXISTÊNCIA de um owner, só a unicidade.
-- Organizações em estado zero-owner (possível por SQL manual) continuam
-- carregando em vez de virarem 500.
--
-- Verificado antes de aplicar: nenhuma empresa tinha dois owners.
--   SELECT "empresaId", count(*) FROM usuarios WHERE role='owner'
--    GROUP BY 1 HAVING count(*) > 1;
CREATE UNIQUE INDEX "usuarios_um_owner_por_empresa"
    ON "usuarios" ("empresaId")
 WHERE "role" = 'owner';
