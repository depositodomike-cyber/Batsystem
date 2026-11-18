-- CreateTable
CREATE TABLE "telegram_codigos_vinculo" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "repositorioId" TEXT,
    "codigoHash" TEXT NOT NULL,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "usadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telegram_codigos_vinculo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_vinculos" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "repositorioId" TEXT,
    "telegramUserId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "username" TEXT,
    "nome" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimaComunicacaoEm" TIMESTAMP(3),
    "revogadoEm" TIMESTAMP(3),

    CONSTRAINT "telegram_vinculos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_mensagens" (
    "id" TEXT NOT NULL,
    "vinculoId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "messageId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "texto" TEXT,
    "legenda" TEXT,
    "transcricao" TEXT,
    "audioFileId" TEXT,
    "audioMime" TEXT,
    "audioNome" TEXT,
    "audioTamanho" INTEGER,
    "audioDuracao" INTEGER,
    "audio" BYTEA,
    "status" TEXT NOT NULL DEFAULT 'recebida',
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "erro" TEXT,
    "proximaTentativaEm" TIMESTAMP(3),
    "recebidaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processadaEm" TIMESTAMP(3),
    "entregueEm" TIMESTAMP(3),
    "repositorioPath" TEXT,

    CONSTRAINT "telegram_mensagens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_cursor" (
    "id" TEXT NOT NULL,
    "offset" BIGINT NOT NULL DEFAULT 0,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_cursor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "telegram_codigos_vinculo_codigoHash_key" ON "telegram_codigos_vinculo"("codigoHash");

-- CreateIndex
CREATE INDEX "telegram_codigos_vinculo_empresaId_usuarioId_idx" ON "telegram_codigos_vinculo"("empresaId", "usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_vinculos_usuarioId_key" ON "telegram_vinculos"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_vinculos_telegramUserId_key" ON "telegram_vinculos"("telegramUserId");

-- CreateIndex
CREATE INDEX "telegram_mensagens_vinculoId_status_idx" ON "telegram_mensagens"("vinculoId", "status");

-- CreateIndex
CREATE INDEX "telegram_mensagens_status_proximaTentativaEm_idx" ON "telegram_mensagens"("status", "proximaTentativaEm");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_mensagens_chatId_messageId_key" ON "telegram_mensagens"("chatId", "messageId");

-- AddForeignKey
ALTER TABLE "telegram_codigos_vinculo" ADD CONSTRAINT "telegram_codigos_vinculo_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_codigos_vinculo" ADD CONSTRAINT "telegram_codigos_vinculo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_vinculos" ADD CONSTRAINT "telegram_vinculos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_vinculos" ADD CONSTRAINT "telegram_vinculos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_mensagens" ADD CONSTRAINT "telegram_mensagens_vinculoId_fkey" FOREIGN KEY ("vinculoId") REFERENCES "telegram_vinculos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
