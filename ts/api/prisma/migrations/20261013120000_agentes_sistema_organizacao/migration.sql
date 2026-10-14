-- Agentes pré-programados (catálogo do sistema) editáveis POR ORGANIZAÇÃO.
-- Uma linha da organização com `sistemaId` substitui, só naquela organização,
-- o agente do sistema de mesmo id: viva, é a versão editada; excluída, o
-- agente some da organização. O catálogo (tabela de squads) não é tocado.

-- AlterTable
ALTER TABLE "agentes_usuario" ADD COLUMN "sistemaId" TEXT;
