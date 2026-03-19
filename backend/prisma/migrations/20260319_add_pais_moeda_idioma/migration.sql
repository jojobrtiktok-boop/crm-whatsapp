-- AlterTable: add pais, moeda, idioma to usuarios
ALTER TABLE "usuarios" ADD COLUMN IF NOT EXISTS "pais" TEXT NOT NULL DEFAULT 'BR';
ALTER TABLE "usuarios" ADD COLUMN IF NOT EXISTS "moeda" TEXT NOT NULL DEFAULT 'BRL';
ALTER TABLE "usuarios" ADD COLUMN IF NOT EXISTS "idioma" TEXT NOT NULL DEFAULT 'pt';
