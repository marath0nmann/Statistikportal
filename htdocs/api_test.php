<?php
// Temporäre Diagnosedatei – nach Fehlersuche löschen!
error_reporting(E_ALL);
ini_set('display_errors', 1);

$configPath = __DIR__ . '/../../includes/config.php';
if (!file_exists($configPath)) { die("config.php nicht gefunden: $configPath"); }
require_once $configPath;
require_once __DIR__ . '/../../includes/db.php';

header('Content-Type: application/json');

$tests = [];

// 1) Login-Endpunkt simulieren
try {
    $row = DB::fetchOne('SELECT id, benutzername, rolle, totp_aktiv FROM benutzer WHERE aktiv=1 LIMIT 1');
    $tests['benutzer_query'] = $row ? 'OK: ' . $row['benutzername'] : 'Keine aktiven Benutzer';
} catch (Exception $e) {
    $tests['benutzer_query'] = 'FEHLER: ' . $e->getMessage();
}

// 2) athlet_id Spalte?
try {
    $col = DB::fetchOne("SHOW COLUMNS FROM benutzer LIKE 'athlet_id'");
    $tests['benutzer_athlet_id'] = $col ? 'Spalte vorhanden' : 'Spalte FEHLT (migration_athlet_benutzer.sql noch nicht ausgeführt?)';
} catch (Exception $e) {
    $tests['benutzer_athlet_id'] = 'FEHLER: ' . $e->getMessage();
}

// 3) geloescht_am in ergebnisse?
try {
    $col = DB::fetchOne("SHOW COLUMNS FROM ergebnisse LIKE 'geloescht_am'");
    $tests['ergebnisse_geloescht_am'] = $col ? 'Spalte vorhanden' : 'Spalte FEHLT';
} catch (Exception $e) {
    $tests['ergebnisse_geloescht_am'] = 'FEHLER: ' . $e->getMessage();
}

// 4) gruppen-Tabelle?
try {
    $cnt = DB::fetchOne("SELECT COUNT(*) c FROM gruppen");
    $tests['gruppen_tabelle'] = 'OK: ' . $cnt['c'] . ' Einträge';
} catch (Exception $e) {
    $tests['gruppen_tabelle'] = 'FEHLER: ' . $e->getMessage();
}

// 5) athleten geloescht_am?
try {
    $col = DB::fetchOne("SHOW COLUMNS FROM athleten LIKE 'geloescht_am'");
    $tests['athleten_geloescht_am'] = $col ? 'Spalte vorhanden' : 'Spalte FEHLT';
} catch (Exception $e) {
    $tests['athleten_geloescht_am'] = 'FEHLER: ' . $e->getMessage();
}

// 6) PHP-Version + Extensions
$tests['php_version'] = PHP_VERSION;
$tests['pdo_mysql'] = extension_loaded('pdo_mysql') ? 'OK' : 'FEHLT';

// 7) Session-Test
session_start();
$tests['session'] = session_id() ? 'OK: ' . session_id() : 'FEHLER';

echo json_encode($tests, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
