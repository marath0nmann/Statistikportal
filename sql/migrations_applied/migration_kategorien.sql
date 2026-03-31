-- Migration: Disziplin-Kategorien-Verwaltung
-- Einmalig ausführen nach dem Update auf die neue Version

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS disziplin_kategorien (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(80)  NOT NULL UNIQUE,
    tbl_key     VARCHAR(40)  NOT NULL UNIQUE,
    fmt         VARCHAR(20)  NOT NULL DEFAULT 'min',
    sort_dir    ENUM('ASC','DESC') NOT NULL DEFAULT 'ASC',
    reihenfolge INT          NOT NULL DEFAULT 99,
    erstellt_am DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO disziplin_kategorien (name, tbl_key, fmt, sort_dir, reihenfolge) VALUES
  ('Straße',         'strasse',       'min',  'ASC',  1),
  ('Sprint',         'sprint',        's',    'ASC',  2),
  ('Mittelstrecke',  'mittelstrecke', 'min',  'ASC',  3),
  ('Sprung & Wurf',  'sprungwurf',    'm',    'DESC', 4);

CREATE TABLE IF NOT EXISTS disziplin_mapping (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    disziplin    VARCHAR(60) NOT NULL,
    kategorie_id INT         NOT NULL,
    UNIQUE KEY uq_disz (disziplin),
    FOREIGN KEY (kategorie_id) REFERENCES disziplin_kategorien(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bestehende Disziplinen automatisch mappen
INSERT IGNORE INTO disziplin_mapping (disziplin, kategorie_id)
  SELECT DISTINCT e.disziplin, k.id
  FROM ergebnisse_strasse e
  JOIN disziplin_kategorien k ON k.tbl_key = 'strasse'
  WHERE e.disziplin IS NOT NULL AND e.disziplin != '';

INSERT IGNORE INTO disziplin_mapping (disziplin, kategorie_id)
  SELECT DISTINCT e.disziplin, k.id
  FROM ergebnisse_sprint e
  JOIN disziplin_kategorien k ON k.tbl_key = 'sprint'
  WHERE e.disziplin IS NOT NULL AND e.disziplin != '';

INSERT IGNORE INTO disziplin_mapping (disziplin, kategorie_id)
  SELECT DISTINCT e.disziplin, k.id
  FROM ergebnisse_mittelstrecke e
  JOIN disziplin_kategorien k ON k.tbl_key = 'mittelstrecke'
  WHERE e.disziplin IS NOT NULL AND e.disziplin != '';

INSERT IGNORE INTO disziplin_mapping (disziplin, kategorie_id)
  SELECT DISTINCT e.disziplin, k.id
  FROM ergebnisse_sprungwurf e
  JOIN disziplin_kategorien k ON k.tbl_key = 'sprungwurf'
  WHERE e.disziplin IS NOT NULL AND e.disziplin != '';

-- Migration Teil 2: Disziplin-spezifisches Format und Anzeigename
ALTER TABLE disziplin_mapping
  ADD COLUMN IF NOT EXISTS anzeige_name VARCHAR(60) NULL COMMENT 'Optionaler Anzeigename (überschreibt Original)',
  ADD COLUMN IF NOT EXISTS fmt_override  VARCHAR(20) NULL COMMENT 'Optionales Format (überschreibt Kategorieformat)';
