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

// ── Cross-Domain Login (optional) ────────────────────────────
// Leer lassen = Standalone-Betrieb (Cookie nur für diese Domain)
// '.tus-oedt.de' = Session-Cookie gilt für alle Subdomains
//   → login.tus-oedt.de, statistik.tus-oedt.de, training.tus-oedt.de
define('COOKIE_DOMAIN', '');
