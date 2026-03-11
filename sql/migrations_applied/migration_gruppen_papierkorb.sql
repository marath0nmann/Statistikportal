-- ============================================================
-- Migration: Gruppen als Tags + Papierkorb
-- Einmalig ausführen
-- ============================================================

-- 1) Gruppen-Tabellen
CREATE TABLE IF NOT EXISTS gruppen (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(80) NOT NULL UNIQUE,
    erstellt_am DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS athlet_gruppen (
    athlet_id  INT NOT NULL,
    gruppe_id  INT NOT NULL,
    PRIMARY KEY (athlet_id, gruppe_id),
    FOREIGN KEY (athlet_id) REFERENCES athleten(id) ON DELETE CASCADE,
    FOREIGN KEY (gruppe_id) REFERENCES gruppen(id)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bestehende Gruppen-Strings migrieren
INSERT IGNORE INTO gruppen (name)
SELECT DISTINCT TRIM(gruppe) FROM athleten
WHERE gruppe IS NOT NULL AND TRIM(gruppe) != '';

INSERT IGNORE INTO athlet_gruppen (athlet_id, gruppe_id)
SELECT a.id, g.id
FROM athleten a
JOIN gruppen g ON g.name = TRIM(a.gruppe)
WHERE a.gruppe IS NOT NULL AND TRIM(a.gruppe) != '';

-- 2) Papierkorb-Spalten
ALTER TABLE ergebnisse     ADD COLUMN IF NOT EXISTS geloescht_am DATETIME NULL DEFAULT NULL;
ALTER TABLE athleten       ADD COLUMN IF NOT EXISTS geloescht_am DATETIME NULL DEFAULT NULL;
ALTER TABLE veranstaltungen ADD COLUMN IF NOT EXISTS geloescht_am DATETIME NULL DEFAULT NULL;

-- Indizes für schnelle Papierkorb-Abfragen
ALTER TABLE ergebnisse      ADD INDEX IF NOT EXISTS idx_geloescht (geloescht_am);
ALTER TABLE athleten        ADD INDEX IF NOT EXISTS idx_geloescht (geloescht_am);
ALTER TABLE veranstaltungen ADD INDEX IF NOT EXISTS idx_geloescht (geloescht_am);
