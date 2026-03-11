-- ============================================================
-- Migration: 4 Ergebnistabellen → 1 einheitliche Tabelle
-- Einmalig ausführen!
-- ============================================================

-- 1. Neue einheitliche Tabelle anlegen
CREATE TABLE IF NOT EXISTS ergebnisse (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    veranstaltung_id INT          NOT NULL,
    athlet_id        INT          NOT NULL,
    altersklasse     VARCHAR(20)  NULL,
    disziplin        VARCHAR(60)  NOT NULL,
    distanz          FLOAT        NULL,
    resultat         VARCHAR(20)  NULL,   -- einheitlich als String (hh:mm:ss oder Dezimal als Text)
    resultat_num     FLOAT        NULL,   -- numerisch für Sortierung/Vergleich
    pace             VARCHAR(20)  NULL,   -- nur Straße
    ak_platzierung   INT          NULL,
    meisterschaft    INT          NULL,
    import_quelle    VARCHAR(20)  DEFAULT 'manuell',
    erstellt_von     INT          NULL,
    erstellt_am      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (veranstaltung_id) REFERENCES veranstaltungen(id),
    FOREIGN KEY (athlet_id)        REFERENCES athleten(id),
    FOREIGN KEY (erstellt_von)     REFERENCES benutzer(id),
    INDEX idx_disziplin (disziplin),
    INDEX idx_athlet    (athlet_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Daten aus ergebnisse_strasse übernehmen
INSERT INTO ergebnisse
    (veranstaltung_id, athlet_id, altersklasse, disziplin, distanz,
     resultat, resultat_num, pace, ak_platzierung, meisterschaft,
     import_quelle, erstellt_von, erstellt_am)
SELECT veranstaltung_id, athlet_id, altersklasse, disziplin, distanz,
       resultat, NULL, pace, ak_platzierung, meisterschaft,
       import_quelle, erstellt_von, erstellt_am
FROM ergebnisse_strasse;

-- 3. Daten aus ergebnisse_sprint übernehmen
INSERT INTO ergebnisse
    (veranstaltung_id, athlet_id, altersklasse, disziplin, distanz,
     resultat, resultat_num, ak_platzierung, meisterschaft,
     import_quelle, erstellt_von, erstellt_am)
SELECT veranstaltung_id, athlet_id, altersklasse, disziplin, distanz,
       resultat, NULL, ak_platzierung, meisterschaft,
       import_quelle, erstellt_von, erstellt_am
FROM ergebnisse_sprint;

-- 4. Daten aus ergebnisse_mittelstrecke übernehmen
INSERT INTO ergebnisse
    (veranstaltung_id, athlet_id, altersklasse, disziplin,
     resultat, resultat_num, ak_platzierung, meisterschaft,
     import_quelle, erstellt_von, erstellt_am)
SELECT veranstaltung_id, athlet_id, altersklasse, disziplin,
       resultat, resultat_dezimal, ak_platzierung, meisterschaft,
       import_quelle, erstellt_von, erstellt_am
FROM ergebnisse_mittelstrecke;

-- 5. Daten aus ergebnisse_sprungwurf übernehmen
--    resultat war FLOAT (Meter) → als String speichern, numerisch übernehmen
INSERT INTO ergebnisse
    (veranstaltung_id, athlet_id, altersklasse, disziplin,
     resultat, resultat_num, ak_platzierung, meisterschaft,
     import_quelle, erstellt_von, erstellt_am)
SELECT veranstaltung_id, athlet_id, altersklasse, disziplin,
       CAST(resultat AS CHAR), resultat, ak_platzierung, meisterschaft,
       import_quelle, erstellt_von, erstellt_am
FROM ergebnisse_sprungwurf;

-- 6. Alte Tabellen umbenennen (NICHT löschen – Sicherheitsnetz)
RENAME TABLE
    ergebnisse_strasse       TO ergebnisse_strasse_alt,
    ergebnisse_sprint        TO ergebnisse_sprint_alt,
    ergebnisse_mittelstrecke TO ergebnisse_mittelstrecke_alt,
    ergebnisse_sprungwurf    TO ergebnisse_sprungwurf_alt;
