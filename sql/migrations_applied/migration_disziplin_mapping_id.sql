-- Migration: disziplin_mapping_id in ergebnisse + UNIQUE-Key Änderung
-- Ausführen einmalig auf dem Server

-- 1. UNIQUE-Constraint auf disziplin_mapping ändern
ALTER TABLE disziplin_mapping DROP INDEX disziplin;
ALTER TABLE disziplin_mapping ADD UNIQUE KEY uq_disz_kat (disziplin, kategorie_id);

-- 2. Neue Spalten in disziplin_mapping (falls noch nicht vorhanden)
ALTER TABLE disziplin_mapping
    ADD COLUMN IF NOT EXISTS fmt_override        VARCHAR(20) NULL,
    ADD COLUMN IF NOT EXISTS kat_suffix_override VARCHAR(10) NULL,
    ADD COLUMN IF NOT EXISTS hof_exclude         TINYINT(1)  NOT NULL DEFAULT 0;

-- 3. disziplin_mapping_id in ergebnisse hinzufügen
ALTER TABLE ergebnisse
    ADD COLUMN IF NOT EXISTS disziplin_mapping_id INT NULL,
    ADD INDEX idx_disziplin_mapping_id (disziplin_mapping_id);

-- 4. disziplin_mapping_id befüllen (JOIN auf disziplin-Name)
UPDATE ergebnisse e
    JOIN disziplin_mapping m ON m.disziplin = e.disziplin
    SET e.disziplin_mapping_id = m.id
    WHERE e.disziplin_mapping_id IS NULL;

-- Fertig. Ergebnisse ohne Mapping-Eintrag behalten disziplin_mapping_id = NULL
-- (unkategorisierte Disziplinen).
