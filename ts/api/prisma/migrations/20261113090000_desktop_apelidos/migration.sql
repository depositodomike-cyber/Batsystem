-- Ambiente local: apelidos de aplicativos (aditiva).
ALTER TABLE "politicas_desktop" ADD COLUMN "apelidos" JSONB NOT NULL DEFAULT '{}';
