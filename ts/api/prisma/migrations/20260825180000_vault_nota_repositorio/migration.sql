-- Isola o índice de notas por repositório.
--
-- Até aqui `vault_notas` só era escopada por empresa, e o `finalize` do sync
-- ("apaga tudo que não veio nesta lista") rodava sobre o tenant inteiro: abrir
-- o Repositório com o repositório B apagava as notas do A. A leitura também não
-- filtrava, então a IA respondia misturando notas de contextos diferentes.
--
-- As linhas existentes são descartadas de propósito: não há como saber a que
-- repositório cada uma pertencia, e a tabela é um cache reconstruível — a fonte
-- de verdade são os .md na máquina do usuário. Cada repositório reindexa
-- sozinho na primeira vez que o Repositório for aberto.
DELETE FROM "vault_notas";

ALTER TABLE "vault_notas" ADD COLUMN "repositorioId" TEXT NOT NULL;

-- A unicidade passa a incluir o repositório: dois repositórios podem ter um
-- "README.md" cada sem que o upsert de um sobrescreva o do outro.
DROP INDEX "vault_notas_empresaId_path_key";
CREATE UNIQUE INDEX "vault_notas_empresaId_repositorioId_path_key"
  ON "vault_notas"("empresaId", "repositorioId", "path");

DROP INDEX "vault_notas_empresaId_idx";
CREATE INDEX "vault_notas_empresaId_repositorioId_idx"
  ON "vault_notas"("empresaId", "repositorioId");

-- `vault_notas_fts_idx` (GIN sobre to_tsvector) é preservado: ele não depende
-- das colunas alteradas e o Prisma não o gerencia, então recriá-lo aqui
-- causaria divergência com a migration que o criou.
