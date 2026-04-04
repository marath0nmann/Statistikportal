-- Migration: Externe PBs (Persönliche Bestleistungen außerhalb des eigenen Vereins)
-- Ausführen: einmalig auf dem Server

CREATE TABLE IF NOT EXISTS athlet_pb (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    athlet_id   INT NOT NULL,
    disziplin   VARCHAR(100) NOT NULL,
    resultat    VARCHAR(30)  NOT NULL,
    wettkampf   VARCHAR(200) NULL,
    datum       DATE         NULL,
    erstellt_am DATETIME     NOT NULL DEFAULT NOW(),
    FOREIGN KEY (athlet_id) REFERENCES athleten(id) ON DELETE CASCADE,
    INDEX idx_athlet (athlet_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
