<?php
// ============================================================
// Setup-Endpoint – wird nur ausgeführt wenn config.php fehlt
// oder wenn explizit aufgerufen (POST mit setup_token)
// ============================================================
error_reporting(0);
ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');

$configPath = __DIR__ . '/../../includes/config.php';
$schemaPath = __DIR__ . '/../../sql/schema.sql';

function ok(mixed $data): void  { echo json_encode(['ok'=>true,  'data'=>$data]); exit; }
function err(string $msg): void { echo json_encode(['ok'=>false, 'fehler'=>$msg]); exit; }

$method = $_SERVER['REQUEST_METHOD'];
$raw    = file_get_contents('php://input');
$body   = json_decode($raw, true) ?? [];
$action = $body['action'] ?? $_GET['action'] ?? '';

// ── Prüfen ob Setup nötig ist ────────────────────────────────
if ($action === 'check') {
    $configExists = file_exists($configPath);
    if (!$configExists) {
        ok(['setup_needed' => true, 'reason' => 'no_config']);
    }
    // Config existiert – DB-Verbindung prüfen und Tabellen checken
    require_once $configPath;
    try {
        $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=%s',
            DB_HOST, DB_PORT, DB_NAME, DB_CHARSET);
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
        $prefix = defined('TABLE_PREFIX') ? TABLE_PREFIX : '';
        $row = $pdo->query("SELECT COUNT(*) AS c FROM information_schema.tables
            WHERE table_schema = DATABASE()
            AND table_name = " . $pdo->quote($prefix . 'einstellungen'))->fetch(PDO::FETCH_ASSOC);
        if ((int)($row['c'] ?? 0) === 0) {
            ok(['setup_needed' => true, 'reason' => 'no_tables', 'has_config' => true]);
        }
        ok(['setup_needed' => false]);
    } catch (Throwable $e) {
        ok(['setup_needed' => true, 'reason' => 'db_error', 'has_config' => true, 'error' => $e->getMessage()]);
    }
}

// ── DB-Verbindung testen ─────────────────────────────────────
if ($action === 'test_db') {
    $host    = trim($body['db_host']    ?? 'localhost');
    $port    = (int)($body['db_port']   ?? 3306);
    $name    = trim($body['db_name']    ?? '');
    $user    = trim($body['db_user']    ?? '');
    $pass    = $body['db_pass']          ?? '';
    if (!$name || !$user) err('Datenbankname und Benutzer sind erforderlich.');
    try {
        $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $host, $port, $name);
        new PDO($dsn, $user, $pass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
        ok('Verbindung erfolgreich.');
    } catch (Throwable $e) {
        err('Verbindung fehlgeschlagen: ' . $e->getMessage());
    }
}

// ── Setup abschließen: config.php schreiben + Tabellen anlegen ──
if ($action === 'install') {
    // Eingaben validieren
    $host    = trim($body['db_host']    ?? 'localhost');
    $port    = (int)($body['db_port']   ?? 3306);
    $name    = trim($body['db_name']    ?? '');
    $user    = trim($body['db_user']    ?? '');
    $pass    = $body['db_pass']          ?? '';
    $prefix  = preg_replace('/[^a-zA-Z0-9_]/', '', $body['table_prefix'] ?? '');
    $adminPw = $body['admin_password']   ?? '';

    // Schritt-3-Konfigurationswerte (alle optional, Defaults greifen wenn leer)
    $cfg = [
        'verein_name'    => trim($body['verein_name']    ?? ''),
        'verein_kuerzel' => trim($body['verein_kuerzel'] ?? ''),
        'app_untertitel' => trim($body['app_untertitel'] ?? 'Leichtathletik-Statistik'),
        'farbe_primary'  => trim($body['farbe_primary']  ?? '#cc0000'),
        'farbe_accent'   => trim($body['farbe_accent']   ?? '#003087'),
        'email_domain'   => trim($body['email_domain']   ?? 'vy99.de'),
        'noreply_email'  => trim($body['noreply_email']  ?? 'noreply@vy99.de'),
    ];

    if (!$name || !$user)   err('Datenbankname und Benutzer sind erforderlich.');
    if (strlen($adminPw) < 8) err('Admin-Passwort muss mindestens 8 Zeichen haben.');

    // DB-Verbindung testen
    try {
        $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $host, $port, $name);
        $pdo = new PDO($dsn, $user, $pass, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
    } catch (Throwable $e) {
        err('Datenbankverbindung fehlgeschlagen: ' . $e->getMessage());
    }

    // Schema laden und Prefix einsetzen
    if (!file_exists($schemaPath)) err('schema.sql nicht gefunden.');
    $sql = file_get_contents($schemaPath);

    // Alle Tabellennamen mit Prefix versehen
    $tables = [
        'benutzer','login_versuche','athleten','gruppen','athlet_gruppen',
        'athlet_pb','veranstaltungen','disziplin_kategorien','disziplin_mapping',
        'ergebnisse','vereinsrekorde','registrierungen','einstellungen',
    ];
    if ($prefix) {
        foreach ($tables as $t) {
            $sql = preg_replace('/\b' . preg_quote($t, '/') . '\b/', $prefix . $t, $sql);
        }
    }

    // SQL-Statements ausführen
    $pdo->exec('SET FOREIGN_KEY_CHECKS = 0');
    $statements = array_filter(array_map('trim', explode(';', $sql)));
    $errors = [];
    foreach ($statements as $stmt) {
        if (!$stmt || str_starts_with($stmt, '--') || str_starts_with($stmt, 'SET')) continue;
        try { $pdo->exec($stmt . ';'); }
        catch (Throwable $e) { $errors[] = substr($e->getMessage(), 0, 120); }
    }
    $pdo->exec('SET FOREIGN_KEY_CHECKS = 1');

    // Admin-Passwort in benutzer-Tabelle setzen
    $hash = password_hash($adminPw, PASSWORD_BCRYPT);
    try {
        $pdo->prepare("UPDATE `{$prefix}benutzer` SET passwort = ? WHERE rolle = 'admin' LIMIT 1")
            ->execute([$hash]);
    } catch (Throwable $e) {
        $errors[] = 'Admin-PW: ' . $e->getMessage();
    }

    // Schritt-3-Konfiguration in einstellungen schreiben
    $cfgDefs = [
        'verein_name'    => ['Vereinsname',                        'verein'],
        'verein_kuerzel' => ['Kurzbezeichnung (Header)',            'verein'],
        'app_untertitel' => ['App-Untertitel',                     'verein'],
        'farbe_primary'  => ['Hauptfarbe (Primär)',                 'farben'],
        'farbe_accent'   => ['Akzentfarbe',                        'farben'],
        'email_domain'   => ['Zugelassene E-Mail-Domain',          'registrierung'],
        'noreply_email'  => ['Absender-E-Mail (System-Mails)',      'registrierung'],
    ];
    foreach ($cfg as $key => $val) {
        if ($val === '') continue; // Leere Werte → Default aus settings.php greift
        [$bez, $grp] = $cfgDefs[$key];
        try {
            $pdo->prepare(
                "INSERT INTO `{$prefix}einstellungen` (schluessel, wert, bezeichnung, gruppe)
                 VALUES (?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE wert = VALUES(wert)"
            )->execute([$key, $val, $bez, $grp]);
        } catch (Throwable $e) {
            $errors[] = "Einstellung '$key': " . $e->getMessage();
        }
    }

    // config.php schreiben
    $sessionName = 'stat_' . substr(md5($name . $prefix), 0, 8);
    $config = "<?php\n" .
        "// Automatisch generiert vom Setup-Wizard\n" .
        "define('DB_HOST',    " . var_export($host, true)   . ");\n" .
        "define('DB_PORT',    " . (int)$port                . ");\n" .
        "define('DB_NAME',    " . var_export($name, true)   . ");\n" .
        "define('DB_USER',    " . var_export($user, true)   . ");\n" .
        "define('DB_PASS',    " . var_export($pass, true)   . ");\n" .
        "define('DB_CHARSET', 'utf8mb4');\n" .
        "define('TABLE_PREFIX', " . var_export($prefix, true) . ");\n" .
        "define('SESSION_NAME',     " . var_export($sessionName, true) . ");\n" .
        "define('SESSION_LIFETIME', 86400 * 30);\n";

    if (file_put_contents($configPath, $config) === false) {
        err('config.php konnte nicht geschrieben werden. Bitte Schreibrechte auf includes/ prüfen.');
    }

    ok(['warnings' => $errors, 'config_written' => true]);
}

// ── Nur Tabellen anlegen (config existiert bereits) ──────────
if ($action === 'create_tables') {
    if (!file_exists($configPath)) err('config.php fehlt – bitte vollständiges Setup ausführen.');
    require_once $configPath;
    try {
        $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', DB_HOST, DB_PORT, DB_NAME);
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    } catch (Throwable $e) {
        err('DB-Verbindung fehlgeschlagen: ' . $e->getMessage());
    }

    $prefix = defined('TABLE_PREFIX') ? TABLE_PREFIX : '';
    $sql    = file_get_contents($schemaPath);
    $tables = [
        'benutzer','login_versuche','athleten','gruppen','athlet_gruppen',
        'athlet_pb','veranstaltungen','disziplin_kategorien','disziplin_mapping',
        'ergebnisse','vereinsrekorde','registrierungen','einstellungen',
    ];
    if ($prefix) {
        foreach ($tables as $t) {
            $sql = preg_replace('/\b' . preg_quote($t, '/') . '\b/', $prefix . $t, $sql);
        }
    }

    $pdo->exec('SET FOREIGN_KEY_CHECKS = 0');
    $errors = [];
    foreach (array_filter(array_map('trim', explode(';', $sql))) as $stmt) {
        if (!$stmt || str_starts_with($stmt, '--') || str_starts_with($stmt, 'SET')) continue;
        try { $pdo->exec($stmt . ';'); }
        catch (Throwable $e) { $errors[] = substr($e->getMessage(), 0, 120); }
    }
    $pdo->exec('SET FOREIGN_KEY_CHECKS = 1');
    ok(['warnings' => $errors]);
}

err('Unbekannte Action.');
