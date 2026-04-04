-- ============================================================
-- Statistikportal Leichtathletik – Datenbankschema
-- Version 1.49  |  Stand: März 2026
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
    id            INT AUTO_INCREMENT PRIMARY KEY,
    benutzername  VARCHAR(60)  NOT NULL UNIQUE,
    email         VARCHAR(120) NOT NULL UNIQUE,
    passwort      VARCHAR(255) NOT NULL,
    rolle         ENUM('admin','editor','leser') NOT NULL DEFAULT 'leser',
    aktiv         TINYINT(1)   NOT NULL DEFAULT 1,
    erstellt_am   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    letzter_login DATETIME     NULL,
    totp_secret   VARCHAR(64)  NULL     COMMENT 'Base32-codierter TOTP-Secret',
    totp_aktiv    TINYINT(1)   NOT NULL DEFAULT 0,
    totp_backup   TEXT         NULL,
    totp_pending  VARCHAR(64)  NULL,
    athlet_id     INT          NULL     COMMENT 'Verknuepftes Athletenprofil',
    avatar_pfad   VARCHAR(120) NULL     COMMENT 'Relativer Pfad zum Avatar-Bild'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Standard-Admin (Passwort: Admin1234! – bitte sofort aendern!)
INSERT IGNORE INTO benutzer (benutzername, email, passwort, rolle)
VALUES ('admin', 'admin@tus-oedt.de',
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
    erstellt_am  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ------------------------------------------------------------
-- Athleten
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS athleten (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    name_nv       VARCHAR(120) NOT NULL UNIQUE,
    nachname      VARCHAR(80)  NOT NULL,
    vorname       VARCHAR(80)  NOT NULL,
    geschlecht    ENUM('M','W','D','') DEFAULT '',
    geburtsjahr   SMALLINT     NULL,
    ak_aktuell    VARCHAR(20)  NULL,
    gruppe        VARCHAR(60)  NULL,
    aktiv         TINYINT(1)   NOT NULL DEFAULT 1,
    erstellt_am   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    geloescht_am  DATETIME     NULL
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
    id          INT AUTO_INCREMENT PRIMARY KEY,
    athlet_id   INT          NOT NULL,
    disziplin   VARCHAR(100) NOT NULL,
    resultat    VARCHAR(30)  NOT NULL,
    wettkampf   VARCHAR(200) NULL,
    datum       DATE         NULL,
    erstellt_am DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (athlet_id) REFERENCES athleten(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Veranstaltungen
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS veranstaltungen (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    kuerzel      VARCHAR(60)  NOT NULL UNIQUE,
    name         VARCHAR(200) NULL,
    ort          VARCHAR(100) NULL,
    datum        DATE         NOT NULL,
    erstellt_am  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    geloescht_am DATETIME     NULL
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
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    disziplin           VARCHAR(60) NOT NULL,
    kategorie_id        INT         NOT NULL,
    fmt_override        VARCHAR(20) NULL,
    kat_suffix_override VARCHAR(10) NULL,
    hof_exclude         TINYINT(1)  NOT NULL DEFAULT 0,
    UNIQUE KEY uq_disz_kat (disziplin, kategorie_id),
    FOREIGN KEY (kategorie_id) REFERENCES disziplin_kategorien(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Ergebnisse (einheitliche Tabelle)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ergebnisse (
    id                   INT AUTO_INCREMENT PRIMARY KEY,
    veranstaltung_id     INT         NOT NULL,
    athlet_id            INT         NOT NULL,
    altersklasse         VARCHAR(20) NULL,
    disziplin            VARCHAR(60) NOT NULL,
    disziplin_mapping_id INT         NULL,
    distanz          FLOAT       NULL,
    resultat         VARCHAR(20) NULL,
    resultat_num     FLOAT       NULL,
    pace             VARCHAR(20) NULL,
    ak_platzierung   INT         NULL,
    meisterschaft    INT         NULL,
    import_quelle    VARCHAR(20) DEFAULT 'manuell',
    erstellt_von     INT         NULL,
    erstellt_am      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    geloescht_am     DATETIME    NULL,
    FOREIGN KEY (veranstaltung_id) REFERENCES veranstaltungen(id),
    FOREIGN KEY (athlet_id)        REFERENCES athleten(id),
    FOREIGN KEY (erstellt_von)     REFERENCES benutzer(id)
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

SET FOREIGN_KEY_CHECKS = 1;

-- ------------------------------------------------------------
-- Registrierungsanfragen (v162)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS registrierungen (
    id                INT AUTO_INCREMENT PRIMARY KEY,
    email             VARCHAR(120) NOT NULL UNIQUE,
    name              VARCHAR(120) NOT NULL,
    passwort_hash     VARCHAR(255) NOT NULL,
    status            ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
    email_verifiziert TINYINT(1)   NOT NULL DEFAULT 0,
    email_code_hash   VARCHAR(255) NULL,
    code_expires_at   DATETIME     NULL,
    totp_pending      VARCHAR(64)  NULL,
    totp_secret       VARCHAR(64)  NULL,
    totp_aktiv        TINYINT(1)   NOT NULL DEFAULT 0,
    erstellt_am       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- App-Einstellungen (v172)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS einstellungen (
    schluessel  VARCHAR(80)   NOT NULL PRIMARY KEY,
    wert        TEXT          NOT NULL,
    bezeichnung VARCHAR(200)  NOT NULL DEFAULT '',
    gruppe      VARCHAR(60)   NOT NULL DEFAULT 'allgemein'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

