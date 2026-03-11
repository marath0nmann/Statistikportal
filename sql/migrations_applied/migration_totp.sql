-- ============================================================
-- Migration: 2FA / TOTP für Admin-Accounts
-- Einmalig ausführen
-- ============================================================

ALTER TABLE benutzer
    ADD COLUMN IF NOT EXISTS totp_secret      VARCHAR(64)  NULL     COMMENT 'Base32-codierter TOTP-Secret',
    ADD COLUMN IF NOT EXISTS totp_aktiv       TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '1 = 2FA aktiviert und bestätigt',
    ADD COLUMN IF NOT EXISTS totp_backup      TEXT         NULL     COMMENT 'JSON-Array gehashter Backup-Codes',
    ADD COLUMN IF NOT EXISTS totp_pending     VARCHAR(64)  NULL     COMMENT 'Noch nicht bestätigter neuer Secret';

-- Sicherheitsindex: Login-Versuche tracken (optional, für Brute-Force-Schutz)
CREATE TABLE IF NOT EXISTS login_versuche (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    benutzername VARCHAR(80) NOT NULL,
    ip          VARCHAR(45)  NOT NULL,
    erfolg      TINYINT(1)   NOT NULL DEFAULT 0,
    erstellt_am DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_lv_user (benutzername),
    INDEX idx_lv_ip   (ip),
    INDEX idx_lv_time (erstellt_am)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- Migration: Benutzer ↔ Athlet Verknüpfung
-- ============================================================
ALTER TABLE benutzer
    ADD COLUMN IF NOT EXISTS athlet_id INT NULL DEFAULT NULL
        COMMENT 'Verknüpftes Athletenprofil',
    ADD CONSTRAINT IF NOT EXISTS fk_benutzer_athlet
        FOREIGN KEY (athlet_id) REFERENCES athleten(id)
        ON DELETE SET NULL;
