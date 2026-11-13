-- Ambiente local: desfazer comando direto (aditiva).
ALTER TABLE "comandos_desktop" ADD COLUMN "desfazDe" TEXT;
CREATE UNIQUE INDEX "comandos_desktop_desfazDe_key" ON "comandos_desktop"("desfazDe");
