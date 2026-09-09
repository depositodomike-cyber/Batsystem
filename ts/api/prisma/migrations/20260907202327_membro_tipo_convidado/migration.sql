-- CreateEnum
CREATE TYPE "MembroTipo" AS ENUM ('membro', 'convidado');

-- AlterTable
ALTER TABLE "membros" ADD COLUMN     "tipo" "MembroTipo" NOT NULL DEFAULT 'membro';

-- ---------------------------------------------------------------------------
-- Aditiva e sem backfill, e as duas coisas saem do DEFAULT acima: toda linha
-- existente passa a valer 'membro', que é exatamente o que ela sempre foi.
-- Nenhum registro vira convidado por consequência desta migration.
--
-- A role de sistema `convidado` NÃO é criada aqui. Ela nasce por
-- `garantirRolesDeSistema`, que já é o mecanismo da Owner: um INSERT por
-- empresa neste arquivo duplicaria a lista de permissões do catálogo em SQL, e
-- ficaria desatualizado no dia em que o catálogo mudasse.
-- ---------------------------------------------------------------------------
