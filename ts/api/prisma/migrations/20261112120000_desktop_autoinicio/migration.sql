-- Ambiente local: preferência de iniciar o agente com o Windows (aditiva).
ALTER TABLE "politicas_desktop" ADD COLUMN "autoinicio" BOOLEAN NOT NULL DEFAULT false;
