-- CreateTable
CREATE TABLE "squads" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "icon" TEXT,
    "description" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "squads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "squad_agents" (
    "id" TEXT NOT NULL,
    "squadId" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "who" TEXT NOT NULL,
    "contribution" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "model" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "squad_agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "squad_starter_questions" (
    "id" TEXT NOT NULL,
    "squadId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "squad_starter_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "squad_pins" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "squadId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "squad_pins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "squads_slug_key" ON "squads"("slug");

-- CreateIndex
CREATE INDEX "squads_active_order_idx" ON "squads"("active", "order");

-- CreateIndex
CREATE INDEX "squad_agents_squadId_order_idx" ON "squad_agents"("squadId", "order");

-- CreateIndex
CREATE INDEX "squad_starter_questions_squadId_order_idx" ON "squad_starter_questions"("squadId", "order");

-- CreateIndex
CREATE INDEX "squad_pins_usuarioId_idx" ON "squad_pins"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "squad_pins_usuarioId_squadId_key" ON "squad_pins"("usuarioId", "squadId");

-- AddForeignKey
ALTER TABLE "squad_agents" ADD CONSTRAINT "squad_agents_squadId_fkey" FOREIGN KEY ("squadId") REFERENCES "squads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "squad_starter_questions" ADD CONSTRAINT "squad_starter_questions_squadId_fkey" FOREIGN KEY ("squadId") REFERENCES "squads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "squad_pins" ADD CONSTRAINT "squad_pins_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "squad_pins" ADD CONSTRAINT "squad_pins_squadId_fkey" FOREIGN KEY ("squadId") REFERENCES "squads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
