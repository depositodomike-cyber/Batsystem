-- Chaves de API viram entidade própria (AiCredential). Cada modelo na fila
-- aponta para uma credencial; várias chaves do mesmo provedor passam a ser
-- possíveis, e uma chave OpenAI pode servir Texto e Imagem.

-- CreateTable
CREATE TABLE "ai_credentials" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "nome" TEXT,
    "apiKeyEncrypted" TEXT NOT NULL,
    "keyLast4" TEXT NOT NULL,
    "status" "AiConnectionStatus" NOT NULL DEFAULT 'ativa',
    "validatedAt" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_credentials_empresaId_idx" ON "ai_credentials"("empresaId");

-- AddForeignKey
ALTER TABLE "ai_credentials" ADD CONSTRAINT "ai_credentials_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Uma credencial por (empresa, provedor, últimos 4 dígitos). Agrupa Sonnet e
-- Opus que o tenant cadastrou com a mesma chave; colisões de last4 distintas
-- são raras o bastante para a migração one-shot.
INSERT INTO "ai_credentials" ("id", "empresaId", "provider", "apiKeyEncrypted", "keyLast4", "status", "validatedAt", "criadoEm", "atualizadoEm")
SELECT
    'cred_' || md5(s."empresaId" || ':' || s.provider || ':' || s."keyLast4"),
    s."empresaId",
    s.provider,
    s."apiKeyEncrypted",
    s."keyLast4",
    s.status,
    s."validatedAt",
    s."criadoEm",
    CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT ON ("empresaId", provider, "keyLast4")
        "empresaId",
        provider,
        "apiKeyEncrypted",
        "keyLast4",
        status,
        "validatedAt",
        "criadoEm"
    FROM (
        SELECT "empresaId", "provider"::text AS provider, "apiKeyEncrypted", "keyLast4", status, "validatedAt", "criadoEm"
        FROM "ai_connections"
        UNION ALL
        SELECT "empresaId", "provider", "apiKeyEncrypted", "keyLast4", status, "validatedAt", "criadoEm"
        FROM "ai_media_connections"
    ) u
    ORDER BY "empresaId", provider, "keyLast4",
        CASE WHEN status = 'invalida' THEN 0 ELSE 1 END,
        "criadoEm" DESC
) s;

-- Texto: liga à credencial e remove a chave duplicada.
ALTER TABLE "ai_connections" ADD COLUMN "credentialId" TEXT;

UPDATE "ai_connections"
SET "credentialId" = 'cred_' || md5("empresaId" || ':' || "provider"::text || ':' || "keyLast4");

ALTER TABLE "ai_connections" ALTER COLUMN "credentialId" SET NOT NULL;

DROP INDEX "ai_connections_empresaId_provider_model_key";

ALTER TABLE "ai_connections"
    DROP COLUMN "provider",
    DROP COLUMN "apiKeyEncrypted",
    DROP COLUMN "keyLast4",
    DROP COLUMN "status",
    DROP COLUMN "validatedAt";

CREATE UNIQUE INDEX "ai_connections_empresaId_credentialId_model_key" ON "ai_connections"("empresaId", "credentialId", "model");

ALTER TABLE "ai_connections" ADD CONSTRAINT "ai_connections_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "ai_credentials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Mídia: o mesmo recorte.
ALTER TABLE "ai_media_connections" ADD COLUMN "credentialId" TEXT;

UPDATE "ai_media_connections"
SET "credentialId" = 'cred_' || md5("empresaId" || ':' || "provider" || ':' || "keyLast4");

ALTER TABLE "ai_media_connections" ALTER COLUMN "credentialId" SET NOT NULL;

DROP INDEX "ai_media_connections_empresaId_kind_provider_model_key";

ALTER TABLE "ai_media_connections"
    DROP COLUMN "provider",
    DROP COLUMN "apiKeyEncrypted",
    DROP COLUMN "keyLast4",
    DROP COLUMN "status",
    DROP COLUMN "validatedAt";

CREATE UNIQUE INDEX "ai_media_connections_empresaId_kind_credentialId_model_key" ON "ai_media_connections"("empresaId", "kind", "credentialId", "model");

ALTER TABLE "ai_media_connections" ADD CONSTRAINT "ai_media_connections_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "ai_credentials"("id") ON DELETE CASCADE ON UPDATE CASCADE;
