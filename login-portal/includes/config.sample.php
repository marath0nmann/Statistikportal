<?php
// ── Login-Portal: Datenbankverbindung ───────────────────────
// WICHTIG: Gleiche Zugangsdaten wie im Statistikportal!
define('DB_HOST',    'localhost');
define('DB_PORT',    3306);
define('DB_NAME',    'DATENBANKNAME');
define('DB_USER',    'DATENBANKBENUTZER');
define('DB_PASS',    'DATENBANKPASSWORT');
define('DB_CHARSET', 'utf8mb4');

// ── Tabellen-Prefix (muss identisch zum Statistikportal sein!)
define('TABLE_PREFIX', '');

// ── Session (muss identisch zum Statistikportal sein!) ──────
define('SESSION_NAME',     'stat_session');
define('SESSION_LIFETIME', 86400 * 30); // 30 Tage

// ── Cross-Domain Login ──────────────────────────────────────
// PFLICHT für Login-Portal: Cookie-Domain auf Parent-Domain setzen
// Damit gilt der Session-Cookie für alle Subdomains
define('COOKIE_DOMAIN', '.tus-oedt.de');
