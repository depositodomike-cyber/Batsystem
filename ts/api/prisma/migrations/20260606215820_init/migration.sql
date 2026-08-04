-- CreateEnum
CREATE TYPE "TipoPessoa" AS ENUM ('pj', 'pf');

-- CreateEnum
CREATE TYPE "PlanoCode" AS ENUM ('basico', 'profissional', 'corporativo');

-- CreateEnum
CREATE TYPE "CicloCobranca" AS ENUM ('mensal', 'anual');

-- CreateEnum
CREATE TYPE "ModuloCode" AS ENUM ('performance', 'learning', 'recrutamento', 'projetos');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('owner', 'admin', 'membro');

-- CreateEnum
CREATE TYPE "ConviteStatus" AS ENUM ('pendente', 'aceito');

-- CreateEnum
CREATE TYPE "StatusAssinatura" AS ENUM ('trial', 'ativa', 'inadimplente', 'expirada', 'cancelada');

-- CreateEnum
CREATE TYPE "MetodoPagamento" AS ENUM ('pix', 'cartao', 'boleto');

-- CreateTable
CREATE TABLE "empresas" (
    "id" TEXT NOT NULL,
    "tipoPessoa" "TipoPessoa" NOT NULL,
    "documento" TEXT NOT NULL,
    "razaoSocial" TEXT NOT NULL,
    "nomeFantasia" TEXT,
    "plano" "PlanoCode" NOT NULL,
    "ciclo" "CicloCobranca" NOT NULL,
    "modulos" "ModuloCode"[],
    "setor" TEXT,
    "onboardingConcluidoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "empresas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "telefone" TEXT,
    "avatarUrl" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'membro',
    "trialStartsAt" TIMESTAMP(3) NOT NULL,
    "trialEndsAt" TIMESTAMP(3) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "convites" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'membro',
    "status" "ConviteStatus" NOT NULL DEFAULT 'pendente',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "convites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assinaturas" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "plano" "PlanoCode" NOT NULL,
    "ciclo" "CicloCobranca" NOT NULL,
    "modulos" "ModuloCode"[],
    "status" "StatusAssinatura" NOT NULL DEFAULT 'trial',
    "usuarios" INTEGER NOT NULL DEFAULT 0,
    "posicoes" INTEGER NOT NULL DEFAULT 0,
    "precoUsuario" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "precoPosicao" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sobConsulta" BOOLEAN NOT NULL DEFAULT false,
    "trialStartsAt" TIMESTAMP(3) NOT NULL,
    "trialEndsAt" TIMESTAMP(3) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ativadaEm" TIMESTAMP(3),
    "metodoPagamento" "MetodoPagamento",
    "gatewayRef" TEXT,

    CONSTRAINT "assinaturas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE INDEX "usuarios_empresaId_idx" ON "usuarios"("empresaId");

-- CreateIndex
CREATE INDEX "convites_empresaId_idx" ON "convites"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "convites_empresaId_email_key" ON "convites"("empresaId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "assinaturas_empresaId_key" ON "assinaturas"("empresaId");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "convites" ADD CONSTRAINT "convites_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assinaturas" ADD CONSTRAINT "assinaturas_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
