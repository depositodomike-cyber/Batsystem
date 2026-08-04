-- CreateTable
CREATE TABLE "squad_starter_actions" (
    "id" TEXT NOT NULL,
    "squadId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "squad_starter_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "squad_starter_actions_squadId_order_idx" ON "squad_starter_actions"("squadId", "order");

-- AddForeignKey
ALTER TABLE "squad_starter_actions" ADD CONSTRAINT "squad_starter_actions_squadId_fkey" FOREIGN KEY ("squadId") REFERENCES "squads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
