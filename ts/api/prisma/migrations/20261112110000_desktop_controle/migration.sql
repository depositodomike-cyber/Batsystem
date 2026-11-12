-- CreateEnum
CREATE TYPE "DispositivoStatus" AS ENUM ('pendente', 'conectado', 'desconectado', 'inicializando', 'sincronizando', 'atualizando', 'bloqueado', 'erro', 'revogado');

-- CreateEnum
CREATE TYPE "ComandoDesktopStatus" AS ENUM ('pendente', 'entregue', 'concluido', 'falhou', 'expirado', 'interrompido', 'cancelado');

-- AlterTable
ALTER TABLE "execucoes" ADD COLUMN     "contextoExterno" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "origem" TEXT;

-- CreateTable
CREATE TABLE "dispositivos_desktop" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "chavePublica" TEXT,
    "impressaoDigital" TEXT NOT NULL,
    "versaoAgente" TEXT NOT NULL,
    "status" "DispositivoStatus" NOT NULL DEFAULT 'pendente',
    "paradoLocal" BOOLEAN NOT NULL DEFAULT false,
    "politicaAplicada" INTEGER NOT NULL DEFAULT 0,
    "confirmacaoLocalPendente" BOOLEAN NOT NULL DEFAULT false,
    "inventario" JSONB,
    "autoinicio" BOOLEAN NOT NULL DEFAULT false,
    "ultimoContato" TIMESTAMP(3),
    "confirmadoEm" TIMESTAMP(3),
    "revogadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dispositivos_desktop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pareamentos_desktop" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "codigoHash" TEXT NOT NULL,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "usadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pareamentos_desktop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comandos_desktop" (
    "id" TEXT NOT NULL,
    "dispositivoId" TEXT NOT NULL,
    "execucaoId" TEXT,
    "etapaId" TEXT,
    "aprovacaoId" TEXT,
    "operacao" TEXT NOT NULL,
    "parametros" JSONB NOT NULL,
    "risco" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "envelope" JSONB NOT NULL,
    "status" "ComandoDesktopStatus" NOT NULL DEFAULT 'pendente',
    "resultado" JSONB,
    "erro" TEXT,
    "emitidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "entregueEm" TIMESTAMP(3),
    "concluidoEm" TIMESTAMP(3),

    CONSTRAINT "comandos_desktop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nonces_desktop" (
    "dispositivoId" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nonces_desktop_pkey" PRIMARY KEY ("dispositivoId","nonce")
);

-- CreateTable
CREATE TABLE "politicas_desktop" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "permissoes" JSONB NOT NULL DEFAULT '{}',
    "confirmar" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "apps" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "observaveis" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "diretorios" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dominios" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "retencaoDias" INTEGER NOT NULL DEFAULT 90,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "politicas_desktop_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dispositivos_desktop_empresaId_usuarioId_idx" ON "dispositivos_desktop"("empresaId", "usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "pareamentos_desktop_codigoHash_key" ON "pareamentos_desktop"("codigoHash");

-- CreateIndex
CREATE INDEX "pareamentos_desktop_empresaId_usuarioId_idx" ON "pareamentos_desktop"("empresaId", "usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "comandos_desktop_aprovacaoId_key" ON "comandos_desktop"("aprovacaoId");

-- CreateIndex
CREATE INDEX "comandos_desktop_dispositivoId_status_emitidoEm_idx" ON "comandos_desktop"("dispositivoId", "status", "emitidoEm");

-- CreateIndex
CREATE UNIQUE INDEX "comandos_desktop_dispositivoId_nonce_key" ON "comandos_desktop"("dispositivoId", "nonce");

-- CreateIndex
CREATE INDEX "nonces_desktop_criadoEm_idx" ON "nonces_desktop"("criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "politicas_desktop_empresaId_usuarioId_key" ON "politicas_desktop"("empresaId", "usuarioId");

-- AddForeignKey
ALTER TABLE "dispositivos_desktop" ADD CONSTRAINT "dispositivos_desktop_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispositivos_desktop" ADD CONSTRAINT "dispositivos_desktop_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pareamentos_desktop" ADD CONSTRAINT "pareamentos_desktop_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pareamentos_desktop" ADD CONSTRAINT "pareamentos_desktop_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comandos_desktop" ADD CONSTRAINT "comandos_desktop_dispositivoId_fkey" FOREIGN KEY ("dispositivoId") REFERENCES "dispositivos_desktop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comandos_desktop" ADD CONSTRAINT "comandos_desktop_execucaoId_fkey" FOREIGN KEY ("execucaoId") REFERENCES "execucoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nonces_desktop" ADD CONSTRAINT "nonces_desktop_dispositivoId_fkey" FOREIGN KEY ("dispositivoId") REFERENCES "dispositivos_desktop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "politicas_desktop" ADD CONSTRAINT "politicas_desktop_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "politicas_desktop" ADD CONSTRAINT "politicas_desktop_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
