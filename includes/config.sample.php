<?php
// ── Datenbankverbindung ──────────────────────────────────────
define('DB_HOST',    'localhost');
define('DB_PORT',    3306);
define('DB_NAME',    'DATENBANKNAME');
define('DB_USER',    'DATENBANKBENUTZER');
define('DB_PASS',    'DATENBANKPASSWORT');
define('DB_CHARSET', 'utf8mb4');

// ── Tabellen-Prefix (leer = kein Prefix) ────────────────────
// Beispiel: 'stat_' → Tabellen heißen stat_benutzer, stat_athleten, …
define('TABLE_PREFIX', '');

// ── Session ──────────────────────────────────────────────────
define('SESSION_NAME',     'stat_session');
define('SESSION_LIFETIME', 86400 * 30); // 30 Tage
