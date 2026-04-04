-- ============================================================
-- Statistikportal Leichtathletik – Datenbankschema
-- Version 1.50  |  Stand: April 2026
-- MariaDB / MySQL
-- ============================================================
-- Dieses Schema entspricht dem aktuellen Live-Stand der Datenbank.
-- Alle Tabellen werden mit IF NOT EXISTS angelegt (idempotent).
-- ============================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET FOREIGN_KEY_CHECKS = 0;

-- ------------------------------------------------------------
-- Benutzer & Authentifizierung
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS benutzer (
    id                    INT AUTO_INCREMENT PRIMARY KEY,
    benutzername          VARCHAR(60)  NOT NULL UNIQUE,
    email                 VARCHAR(120) NOT NULL UNIQUE,
    passwort              VARCHAR(255) NOT NULL,
    rolle                 ENUM('admin','editor','athlet','leser') NOT NULL DEFAULT 'leser',
    aktiv                 TINYINT(1)   NOT NULL DEFAULT 1,
    erstellt_am           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    letzter_login         DATETIME     NULL,
    letzter_aktivitaet    DATETIME     NULL,
    totp_secret           VARCHAR(64)  NULL     COMMENT 'Base32-codierter TOTP-Secret',
    totp_aktiv            TINYINT(1)   NOT NULL DEFAULT 0,
    totp_backup           TEXT         NULL,
    totp_pending          VARCHAR(64)  NULL,
    athlet_id             INT          NULL     COMMENT 'Verknuepftes Athletenprofil',
    avatar_pfad           VARCHAR(120) NULL     COMMENT 'Relativer Pfad zum Avatar-Bild',
    email_login_bevorzugt TINYINT(1)   NOT NULL DEFAULT 0,
    geloescht_am          DATETIME     NULL,
    prefs                 JSON         NULL,
    FOREIGN KEY (athlet_id) REFERENCES athleten(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Standard-Admin (Passwort: Admin1234! – bitte sofort aendern!)
INSERT IGNORE INTO benutzer (benutzername, email, passwort, rolle)
VALUES ('admin', 'admin@example.com',
        '$2y$12$92LDTf4nNFMwVpXeQRzmVuTtEMdBGHtCOJqLr0wUbKXZxqfYDO9fy',
        'admin');

-- ------------------------------------------------------------
-- Login-Versuche (Brute-Force-Schutz)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS login_versuche (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    benutzername VARCHAR(80) NOT NULL,
    ip           VARCHAR(45) NOT NULL,
    erfolg       TINYINT(1)  NOT NULL DEFAULT 0,
    methode      VARCHAR(20) NULL,
    erstellt_am  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_lv_user (benutzername),
    INDEX idx_lv_ip   (ip),
    INDEX idx_lv_time (erstellt_am)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Passkeys (WebAuthn)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS passkeys (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    user_id       INT          NOT NULL,
    credential_id VARCHAR(512) NOT NULL,
    public_key    TEXT         NOT NULL,
    aaguid        VARCHAR(64)  DEFAULT '',
    name          VARCHAR(80)  DEFAULT 'Passkey',
    sign_count    INT          NOT NULL DEFAULT 0,
    letzter_login DATETIME     NULL,
    erstellt_am   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_cred (credential_id),
    FOREIGN KEY (user_id) REFERENCES benutzer(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Rollen & Rechte
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rollen (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(60)  NOT NULL UNIQUE,
    rechte      JSON         NOT NULL DEFAULT '[]',
    label       VARCHAR(80)  NULL,
    oeffentlich TINYINT(1)   NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO rollen (name, rechte, label, oeffentlich) VALUES
('admin',  '["vollzugriff","benutzer_verwalten","rekorde_bearbeiten","einstellungen_aendern","alle_ergebnisse","eigene_ergebnisse","lesen","personenbezogene_daten","athleten_details","athleten_editieren","bulk_eintragen","veranstaltung_eintragen","veranstaltung_loeschen","inaktive_athleten_sehen"]', 'Administrator', 1),
('editor', '["alle_ergebnisse","lesen","personenbezogene_daten","athleten_details","athleten_editieren","bulk_eintragen","veranstaltung_eintragen","veranstaltung_loeschen","inaktive_athleten_sehen"]',                                                                                                            'Editor',        1),
('athlet', '["eigene_ergebnisse","lesen","personenbezogene_daten","athleten_details"]',                                                                                                                                                                                                                             'Athlet*in',     1),
('leser',  '["lesen","personenbezogene_daten","athleten_details"]',                                                                                                                                                                                                                                                 'Leser*in',      1);

-- ------------------------------------------------------------
-- Athleten
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS athleten (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    name_nv       VARCHAR(120) NOT NULL UNIQUE,
    nachname      VARCHAR(80)  NOT NULL,
    vorname       VARCHAR(80)  NOT NULL,
    geschlecht    ENUM('M','W','D','') NOT NULL DEFAULT '',
    geburtsjahr   SMALLINT     NULL,
    ak_aktuell    VARCHAR(20)  NULL,
    gruppe        VARCHAR(60)  NULL,
    aktiv         TINYINT(1)   NOT NULL DEFAULT 1,
    erstellt_am   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    geloescht_am  DATETIME     NULL,
    INDEX idx_geloescht (geloescht_am)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Gruppen (z.B. "Senioren")
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gruppen (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(80)  NOT NULL UNIQUE,
    erstellt_am DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Athlet <-> Gruppe (m:n)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS athlet_gruppen (
    athlet_id  INT NOT NULL,
    gruppe_id  INT NOT NULL,
    PRIMARY KEY (athlet_id, gruppe_id),
    FOREIGN KEY (athlet_id) REFERENCES athleten(id) ON DELETE CASCADE,
    FOREIGN KEY (gruppe_id) REFERENCES gruppen(id)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Externe / historische Bestleistungen pro Athlet
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS athlet_pb (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    athlet_id           INT          NOT NULL,
    disziplin           VARCHAR(100) NOT NULL,
    disziplin_mapping_id INT         NULL,
    altersklasse        VARCHAR(20)  NULL,
    resultat            VARCHAR(30)  NOT NULL,
    wettkampf           VARCHAR(200) NULL,
    verein              VARCHAR(120) NULL,
    datum               DATE         NULL,
    erstellt_am         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (athlet_id) REFERENCES athleten(id) ON DELETE CASCADE,
    INDEX idx_athlet (athlet_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Veranstaltungen
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS veranstaltungen (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    kuerzel      VARCHAR(60)   NOT NULL UNIQUE,
    name         VARCHAR(200)  NULL,
    ort          VARCHAR(100)  NULL,
    datum        DATE          NOT NULL,
    genehmigt    TINYINT(1)    NOT NULL DEFAULT 1,
    datenquelle  VARCHAR(1024) NULL,
    erstellt_am  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    geloescht_am DATETIME      NULL,
    INDEX idx_geloescht (geloescht_am)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Disziplin-Kategorien
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS disziplin_kategorien (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    name         VARCHAR(80)        NOT NULL UNIQUE,
    tbl_key      VARCHAR(40)        NOT NULL UNIQUE,
    fmt          VARCHAR(20)        NOT NULL DEFAULT 'min',
    sort_dir     ENUM('ASC','DESC') NOT NULL DEFAULT 'ASC',
    reihenfolge  INT                NOT NULL DEFAULT 99,
    erstellt_am  DATETIME           NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO disziplin_kategorien (id, name, tbl_key, fmt, sort_dir, reihenfolge) VALUES
(1,  'Strasse',       'strasse',       'min', 'ASC',  1),
(2,  'Sprint',        'sprint',        's',   'ASC',  2),
(3,  'Mittelstrecke', 'mittelstrecke', 'min', 'ASC',  3),
(4,  'Sprung & Wurf', 'sprungwurf',    'm',   'DESC', 4),
(25, 'Bahn',          'bahn',          's',   'ASC',  99),
(58, 'Halle',         'halle',         's',   'ASC',  99);

-- ------------------------------------------------------------
-- Disziplin-Mapping (Disziplin -> Kategorie)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS disziplin_mapping (
    id                   INT AUTO_INCREMENT PRIMARY KEY,
    disziplin            VARCHAR(60) NOT NULL,
    kategorie_id         INT         NOT NULL,
    anzeige_name         VARCHAR(60) NULL     COMMENT 'Optionaler Anzeigename (überschreibt Original)',
    fmt_override         VARCHAR(20) NULL,
    kat_suffix_override  VARCHAR(10) NULL,
    hof_exclude          TINYINT(1)  NOT NULL DEFAULT 0,
    distanz              FLOAT       DEFAULT NULL COMMENT 'Streckenlänge in Metern',
    UNIQUE KEY uq_disz_kat (disziplin, kategorie_id),
    FOREIGN KEY (kategorie_id) REFERENCES disziplin_kategorien(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Ergebnisse (einheitliche Tabelle)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ergebnisse (
    id                    INT AUTO_INCREMENT PRIMARY KEY,
    veranstaltung_id      INT         NOT NULL,
    athlet_id             INT         NOT NULL,
    altersklasse          VARCHAR(20) NULL,
    disziplin             VARCHAR(60) NOT NULL,
    disziplin_mapping_id  INT         NULL,
    distanz               FLOAT       NULL,
    resultat              VARCHAR(20) NULL,
    resultat_num          FLOAT       NULL,
    pace                  VARCHAR(20) NULL,
    ak_platzierung        INT         NULL,
    ak_platz_meisterschaft SMALLINT   NULL,
    meisterschaft         INT         NULL,
    import_quelle         VARCHAR(20) DEFAULT 'manuell',
    erstellt_von          INT         NULL,
    erstellt_am           DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    geloescht_am          DATETIME    NULL,
    FOREIGN KEY (veranstaltung_id) REFERENCES veranstaltungen(id),
    FOREIGN KEY (athlet_id)        REFERENCES athleten(id),
    FOREIGN KEY (erstellt_von)     REFERENCES benutzer(id),
    INDEX idx_disziplin          (disziplin),
    INDEX idx_athlet             (athlet_id),
    INDEX idx_disziplin_mapping_id (disziplin_mapping_id),
    INDEX idx_geloescht          (geloescht_am)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Ergebnis-Änderungsanträge (Workflow für Athleten-Rolle)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ergebnis_aenderungen (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    ergebnis_id    INT          NULL    COMMENT 'NULL fuer neue Eintragung (insert)',
    ergebnis_tbl   VARCHAR(60)  NOT NULL DEFAULT 'ergebnisse',
    typ            ENUM('insert','update','delete') NOT NULL,
    neue_werte     JSON         NULL,
    beantragt_von  INT          NOT NULL,
    beantragt_am   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status         ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
    bearbeitet_von INT          NULL,
    bearbeitet_am  DATETIME     NULL,
    kommentar      VARCHAR(500) NULL,
    INDEX idx_status (status),
    INDEX idx_von    (beantragt_von)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Vereinsrekorde
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vereinsrekorde (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    disziplin     VARCHAR(60)  NOT NULL,
    altersklasse  VARCHAR(20)  NOT NULL,
    athlet_id     INT          NULL,
    athlet_name   VARCHAR(120) NULL,
    veranstaltung VARCHAR(200) NULL,
    resultat      VARCHAR(20)  NULL,
    erstellt_am   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (athlet_id) REFERENCES athleten(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Registrierungsanfragen
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS registrierungen (
    id                    INT AUTO_INCREMENT PRIMARY KEY,
    email                 VARCHAR(120) NOT NULL UNIQUE,
    name                  VARCHAR(120) NOT NULL,
    passwort_hash         VARCHAR(255) NOT NULL,
    status                ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
    email_verifiziert     TINYINT(1)   NOT NULL DEFAULT 0,
    email_code_hash       VARCHAR(255) NULL,
    code_expires_at       DATETIME     NULL,
    totp_pending          VARCHAR(64)  NULL,
    totp_secret           VARCHAR(64)  NULL,
    totp_aktiv            TINYINT(1)   NOT NULL DEFAULT 0,
    email_login_bevorzugt TINYINT(1)   NOT NULL DEFAULT 0,
    erstellt_am           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- App-Einstellungen
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS einstellungen (
    schluessel  VARCHAR(80)  NOT NULL PRIMARY KEY,
    wert        TEXT         NOT NULL,
    bezeichnung VARCHAR(200) NOT NULL DEFAULT '',
    gruppe      VARCHAR(60)  NOT NULL DEFAULT 'allgemein'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Altersklassen (Standard-Liste)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ak_standard (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    ak          VARCHAR(20)          NOT NULL UNIQUE,
    geschlecht  ENUM('M','W','D','') NOT NULL DEFAULT '',
    reihenfolge INT                  NOT NULL DEFAULT 99,
    erstellt_am DATETIME             NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO ak_standard (ak, geschlecht, reihenfolge) VALUES
-- Männer Hauptklasse + Masters
('MHK','M',10),('M30','M',30),('M35','M',35),('M40','M',40),('M45','M',45),
('M50','M',50),('M55','M',55),('M60','M',60),('M65','M',65),('M70','M',70),
('M75','M',75),('M80','M',80),('M85','M',85),
-- Frauen Hauptklasse + Masters
('WHK','W',110),('W30','W',130),('W35','W',135),('W40','W',140),('W45','W',145),
('W50','W',150),('W55','W',155),('W60','W',160),('W65','W',165),('W70','W',170),
('W75','W',175),('W80','W',180),('W85','W',185),
-- Männer Jugend
('MU8','M',201),('MU10','M',202),('MU12','M',203),('MU14','M',204),
('MU16','M',205),('MU18','M',206),('MU20','M',207),('MU23','M',208),
-- Frauen Jugend
('WU8','W',301),('WU10','W',302),('WU12','W',303),('WU14','W',304),
('WU16','W',305),('WU18','W',306),('WU20','W',307),('WU23','W',308);

-- ------------------------------------------------------------
-- Altersklassen-Mapping (nicht-standard AK -> Standard-AK)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ak_mapping (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    ak_roh      VARCHAR(20) NOT NULL UNIQUE COMMENT 'Nicht-Standard AK aus Ergebnissen',
    ak_standard VARCHAR(20) NOT NULL       COMMENT 'Zugeordnete Standard-AK',
    erstellt_am DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Seitenaufrufe (Besucher-Tracking, 24h rollierend)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS seitenaufrufe (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    benutzer_id INT          NULL,
    ip          VARCHAR(45)  NULL,
    user_agent  VARCHAR(255) NULL,
    erstellt_am DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_erstellt (erstellt_am)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
