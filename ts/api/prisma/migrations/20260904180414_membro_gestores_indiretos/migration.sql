-- CreateTable
CREATE TABLE "membro_gestores_indiretos" (
    "id" TEXT NOT NULL,
    "membroId" TEXT NOT NULL,
    "gestorIndiretoId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "membro_gestores_indiretos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "membro_gestores_indiretos_gestorIndiretoId_idx" ON "membro_gestores_indiretos"("gestorIndiretoId");

-- CreateIndex
CREATE UNIQUE INDEX "membro_gestores_indiretos_membroId_gestorIndiretoId_key" ON "membro_gestores_indiretos"("membroId", "gestorIndiretoId");

-- AddForeignKey
ALTER TABLE "membro_gestores_indiretos" ADD CONSTRAINT "membro_gestores_indiretos_membroId_fkey" FOREIGN KEY ("membroId") REFERENCES "membros"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membro_gestores_indiretos" ADD CONSTRAINT "membro_gestores_indiretos_gestorIndiretoId_fkey" FOREIGN KEY ("gestorIndiretoId") REFERENCES "membros"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Escrito à mão daqui para baixo: o `migrate dev` gera só o DDL acima.
--
-- O Prisma não expressa CHECK no schema, e por isso `migrate diff` também não
-- o vê como drift — mesma situação de `usuarios_um_owner_por_empresa`.
--
-- Auto-associação é a única metade da regra que cabe no banco. A outra ("o
-- gestor DIRETO de um membro não pode estar também na lista de indiretos dele")
-- compara com `membros.gestorId`, em outra tabela, e vive em
-- `resolverGestoresIndiretos` no service. Não procure por ela aqui.
-- ---------------------------------------------------------------------------
ALTER TABLE "membro_gestores_indiretos"
  ADD CONSTRAINT "membro_gestores_indiretos_nao_a_si_mesmo"
  CHECK ("membroId" <> "gestorIndiretoId");

-- ---------------------------------------------------------------------------
-- SEM BACKFILL, de propósito.
--
-- `membro_roles` precisou de um porque `membros.roleId` já carregava o dado e
-- ignorá-lo tiraria o acesso de todo mundo. Aqui não existe coluna de origem:
-- a única "fonte" imaginável seria a cadeia de `gestorId` (avô, bisavô…), e
-- materializá-la seria CRIAR relação automática — precisamente o que esta
-- versão recusa, porque superior hierárquico já é dedutível da árvore e um
-- espelho dele poderia divergir dela.
--
-- A tabela nasce vazia e todo membro existente responde `[]`, que é o estado
-- válido e esperado. Também não há o bloco `DO $$ ... RAISE EXCEPTION` da
-- migration de roles: aquele existe porque um `INSERT ... SELECT` que não pega
-- nada sai com SUCESSO, e a aplicação subiria com todo mundo sem role, sem
-- erro e sem log. Sem backfill não existe esse modo de falha silenciosa — a
-- ausência do bloco aqui é consequência, não esquecimento.
-- ---------------------------------------------------------------------------
