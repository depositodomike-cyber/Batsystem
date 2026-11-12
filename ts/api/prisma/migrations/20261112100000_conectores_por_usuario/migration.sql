-- Conectores pessoais (Gmail, Outlook, Google Agenda, Google Drive) passam a
-- pertencer a um USUÁRIO; os da organização continuam da empresa.
--
-- Nada é apagado: a única coisa removida é o índice único antigo
-- (empresaId, connectorId), substituído por (empresaId, connectorId, titular).

-- 1. Colunas novas (titular "" = conexão da organização).
ALTER TABLE "empresa_conectores" ADD COLUMN     "titular" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "usuarioId" TEXT;

-- 2. Conexões pessoais que já existiam: o banco não guardava quem conectou.
--    Por decisão de produto, passam a ser do OWNER da empresa (o mais antigo,
--    se houver mais de um; sem owner, o usuário mais antigo da empresa).
UPDATE "empresa_conectores" ec
SET "usuarioId" = dono.id,
    "titular"   = dono.id
FROM (
  SELECT DISTINCT ON (u."empresaId") u."empresaId", u.id
  FROM "usuarios" u
  ORDER BY u."empresaId", (u.role = 'owner') DESC, u."criadoEm" ASC
) AS dono
WHERE dono."empresaId" = ec."empresaId"
  AND ec."connectorId" IN ('gmail', 'outlook', 'google-calendar', 'google-drive');

-- 3. Troca da unicidade.
DROP INDEX "empresa_conectores_empresaId_connectorId_key";

CREATE UNIQUE INDEX "empresa_conectores_empresaId_connectorId_titular_key" ON "empresa_conectores"("empresaId", "connectorId", "titular");

CREATE INDEX "empresa_conectores_usuarioId_idx" ON "empresa_conectores"("usuarioId");

ALTER TABLE "empresa_conectores" ADD CONSTRAINT "empresa_conectores_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
