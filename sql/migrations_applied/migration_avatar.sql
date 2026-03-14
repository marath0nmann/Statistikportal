-- Migration: Avatar-Spalte für Benutzer
ALTER TABLE benutzer ADD COLUMN IF NOT EXISTS avatar_pfad VARCHAR(120) NULL COMMENT 'Relativer Pfad zum Avatar-Bild';
