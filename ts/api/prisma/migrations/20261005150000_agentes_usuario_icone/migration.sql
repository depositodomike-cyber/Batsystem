-- Ícone opcional do avatar do agente personalizado. Coluna nova e nula —
-- linhas existentes ficam como estão (avatar com iniciais).

-- AlterTable
ALTER TABLE "agentes_usuario" ADD COLUMN "icone" TEXT;
