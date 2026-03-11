-- ============================================================
-- Migration: Benutzer ↔ Athlet Verknüpfung
-- Einmalig ausführen
-- ============================================================
ALTER TABLE benutzer
    ADD COLUMN IF NOT EXISTS athlet_id INT NULL DEFAULT NULL
        COMMENT 'Verknüpftes Athletenprofil';

-- Foreign Key separat (kann scheitern wenn schon vorhanden – ignorieren)
ALTER TABLE benutzer
    ADD CONSTRAINT fk_benutzer_athlet
        FOREIGN KEY (athlet_id) REFERENCES athleten(id)
        ON DELETE SET NULL;
