<?php
// ============================================================
// Leichtathletik-Statistik – REST API
// api/index.php
// ============================================================

// Fehler unterdrücken – nie HTML ausgeben
error_reporting(0);
ini_set('display_errors', '0');

// Session ZUERST starten, bevor jegliche Ausgabe
require_once __DIR__ . '/../../includes/auth.php';
Auth::startSession();

// Danach Content-Type Header setzen
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/settings.php';

// Passkey-Tabelle anlegen wenn nötig (idempotent)
try { Passkey::migrate(); } catch (Exception $e) {}

$method = $_SERVER['REQUEST_METHOD'];
// Route aus GET-Parameter, URL-dekodiert
$path = trim(urldecode($_GET['_route'] ?? ''), '/');
// Fallback: PATH_INFO (wenn mod_rewrite aktiv ist)
if (!$path && !empty($_SERVER['PATH_INFO'])) {
    $path = trim($_SERVER['PATH_INFO'], '/');
}
$parts  = explode('/', $path);
$res    = $parts[0] ?? '';
$id     = $parts[1] ?? null;

// CORS-Präflight für uits-receive (muss vor allen anderen Headers kommen)
if ($res === 'uits-receive' && $method === 'OPTIONS') {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, X-Uits-Token');
    http_response_code(204);
    exit;
}

$body = [];
if (in_array($method, ['POST','PUT','PATCH'])) {
    $raw = file_get_contents('php://input');
    $body = json_decode($raw, true) ?? [];
}
// Aktivitätsstempel bei jedem eingeloggten Request aktualisieren
if (!empty($_SESSION['user_id'])) {
    try { DB::query('UPDATE ' . DB::tbl('benutzer') . ' SET letzter_aktivitaet = NOW() WHERE id = ?', [(int)$_SESSION['user_id']]); } catch (\Exception $e) {}
}

function jsonOk(mixed $data): void {
    $out = json_encode(['ok' => true, 'data' => $data], JSON_INVALID_UTF8_SUBSTITUTE);
    if ($out === false) {
        // Fallback: ungültige UTF-8-Bytes bereinigen und erneut versuchen
        array_walk_recursive($data, function(&$v) {
            if (is_string($v)) $v = mb_convert_encoding($v, 'UTF-8', 'UTF-8');
        });
        $out = json_encode(['ok' => true, 'data' => $data], JSON_INVALID_UTF8_SUBSTITUTE);
    }
    echo $out ?: json_encode(['ok' => false, 'fehler' => 'JSON-Encoding-Fehler']);
    exit;
}
function jsonErr(string $msg, int $code = 400): void {
    http_response_code($code);
    echo json_encode(['ok' => false, 'fehler' => $msg]);
    exit;
}
function sanitize(mixed $v): ?string {
    if ($v === null || $v === '') return null;
    return htmlspecialchars(strip_tags((string)$v), ENT_QUOTES, 'UTF-8');
}
function intOrNull(mixed $v): ?int {
    return ($v !== null && $v !== '') ? (int)$v : null;
}
function floatOrNull(mixed $v): ?float {
    return ($v !== null && $v !== '') ? (float)$v : null;
}

// Passwort-Hashing Hilfsfunktionen
function hashCode(string $code): string { return password_hash($code, PASSWORD_BCRYPT, ['cost' => 10]); }
function hashPw(string $pw): string    { return password_hash($pw,   PASSWORD_BCRYPT, ['cost' => 12]); }

// ============================================================
// HILFSFUNKTION: Disziplin automatisch mappen falls fehlend
// ============================================================
function autoMapDisziplin(string $disziplin): void {
    if (!$disziplin) return;
    $exists = DB::fetchOne('SELECT id FROM ' . DB::tbl('disziplin_mapping') . ' WHERE disziplin=?', [$disziplin]);
    if ($exists) return;
    $dl = mb_strtolower($disziplin);
    $katKey = null;
    if (preg_match('/km|marathon|meile|mile|straße|cross|walking/i', $disziplin)) {
        $katKey = 'strasse';
    } elseif (preg_match('/(100|200|300|400)\s*m|sprint|hürde|hurdle/i', $disziplin)) {
        $katKey = 'sprint';
    } elseif (preg_match('/(800|1000|1500|2000|3000|5000|10000)\s*m|steeple/i', $disziplin)) {
        $katKey = 'mittelstrecke';
    } elseif (preg_match('/sprung|wurf|kugel|speer|hammer|diskus|weit|hoch|stab|drei/i', $disziplin)) {
        $katKey = 'sprungwurf';
    }
    if ($katKey) {
        $kat = DB::fetchOne('SELECT id FROM ' . DB::tbl('disziplin_kategorien') . ' WHERE tbl_key=?', [$katKey]);
        if ($kat) {
            DB::query('INSERT IGNORE INTO ' . DB::tbl('disziplin_mapping') . ' (disziplin, kategorie_id) VALUES (?,?)',
                [$disziplin, $kat['id']]);
        }
    }
}

// ============================================================
// HILFSFUNKTIONEN
// ============================================================

function diszSortKey(string $s): float {
    $n = preg_replace('/\.(?=\d{3}(?:\D|$))/', '', $s);
    if (preg_match('/^([\d]+(?:[.,]\d+)?)\s*(km|m)/i', $n, $m)) {
        $num = (float)str_replace(',', '.', $m[1]);
        return strtolower($m[2]) === 'km' ? $num * 1000 : $num;
    }
    return PHP_INT_MAX;
}

function sortDisziplinen(array &$arr, string $key = 'disziplin'): void {
    usort($arr, function($a, $b) use ($key) {
        $ka = diszSortKey($a[$key] ?? '');
        $kb = diszSortKey($b[$key] ?? '');
        if ($ka !== $kb) return $ka <=> $kb;
        return strcmp($a[$key] ?? '', $b[$key] ?? '');
    });
}

// ============================================================
// ROUTING – globaler Fehler-Wrapper
// ============================================================
try {

// Auto-Migration: avatar_pfad Spalte
try { DB::query("ALTER TABLE " . DB::tbl('benutzer') . " ADD COLUMN IF NOT EXISTS avatar_pfad VARCHAR(120) NULL COMMENT 'Relativer Pfad zum Avatar-Bild'"); } catch (\Exception $e) {}
try { DB::query("ALTER TABLE " . DB::tbl('registrierungen') . " ADD COLUMN IF NOT EXISTS email_login_bevorzugt TINYINT(1) NOT NULL DEFAULT 0"); } catch (\Exception $e) {}
try { DB::query("ALTER TABLE " . DB::tbl('benutzer') . " ADD COLUMN IF NOT EXISTS email_login_bevorzugt TINYINT(1) NOT NULL DEFAULT 0"); } catch (\Exception $e) {}
try { DB::query("ALTER TABLE " . DB::tbl('benutzer') . " ADD COLUMN IF NOT EXISTS letzter_aktivitaet DATETIME NULL"); } catch (\Exception $e) {}
try { DB::query("ALTER TABLE " . DB::tbl('athlet_pb') . " ADD COLUMN IF NOT EXISTS verein VARCHAR(120) NULL"); } catch (\Exception $e) {}
try { DB::query("ALTER TABLE " . DB::tbl('athlet_pb') . " ADD COLUMN IF NOT EXISTS disziplin_mapping_id INT NULL"); } catch (\Exception $e) {}
try { DB::query("ALTER TABLE " . DB::tbl('athlet_pb') . " ADD COLUMN IF NOT EXISTS altersklasse VARCHAR(20) NULL"); } catch (\Exception $e) {}
try { DB::query("ALTER TABLE " . DB::tbl('athlet_pb') . " ADD COLUMN IF NOT EXISTS veranstaltung_id INT NULL"); } catch (\Exception $e) {}
try { DB::query("ALTER TABLE " . DB::tbl('athlet_pb') . " ADD COLUMN IF NOT EXISTS erstellt_von INT NULL"); } catch (\Exception $e) {}
try { DB::query("ALTER TABLE " . DB::tbl('veranstaltungen') . " ADD COLUMN IF NOT EXISTS genehmigt TINYINT(1) NOT NULL DEFAULT 1"); } catch (\Exception $e) {}
try { DB::query("ALTER TABLE " . DB::tbl('veranstaltungen') . " ADD COLUMN IF NOT EXISTS datenquelle VARCHAR(1024) NULL DEFAULT NULL"); } catch (\Exception $e) {}
// v942: Veranstaltungsserien (jährlich wiederkehrende Veranstaltungen)
try { DB::query("CREATE TABLE IF NOT EXISTS " . DB::tbl('veranstaltung_serien') . " (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(200) NOT NULL,
    kuerzel     VARCHAR(60)  NOT NULL UNIQUE,
    erstellt_am DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"); } catch (\Exception $e) {}
try { DB::query("ALTER TABLE " . DB::tbl('veranstaltungen') . " ADD COLUMN IF NOT EXISTS serie_id INT NULL"); } catch (\Exception $e) {}
try { DB::query("ALTER TABLE " . DB::tbl('benutzer') . " ADD COLUMN IF NOT EXISTS geloescht_am DATETIME NULL"); } catch (\Exception $e) {}
try { DB::query("ALTER TABLE " . DB::tbl('benutzer') . " ADD COLUMN IF NOT EXISTS reset_code_hash VARCHAR(255) NULL"); } catch (\Exception $e) {}
try { DB::query("ALTER TABLE " . DB::tbl('benutzer') . " ADD COLUMN IF NOT EXISTS reset_code_expires DATETIME NULL"); } catch (\Exception $e) {}
try { DB::query("ALTER TABLE " . DB::tbl('athleten') . " MODIFY COLUMN geschlecht ENUM('M','W','D','') NOT NULL DEFAULT ''"); } catch (\Exception $e) {}
// Migration: Rollen-System (rollen-Tabelle)
try { DB::query("CREATE TABLE IF NOT EXISTS " . DB::tbl('rollen') . " (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(60) NOT NULL UNIQUE,
    rechte JSON NOT NULL DEFAULT '[]',
    label VARCHAR(80) NULL,
    oeffentlich TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"); } catch (\Exception $e) {}
// Spalten nachträglich ergänzen (bestehende Installationen)
try { DB::query("ALTER TABLE " . DB::tbl('rollen') . " ADD COLUMN IF NOT EXISTS label VARCHAR(80) NULL"); } catch (\Exception $e) {}
try { DB::query("ALTER TABLE " . DB::tbl('rollen') . " ADD COLUMN IF NOT EXISTS oeffentlich TINYINT(1) NOT NULL DEFAULT 1"); } catch (\Exception $e) {}
// Migration: Rechte zu Systemrollen hinzufügen
try {
    $sysRollenRechte = [
        'admin'  => ['personenbezogene_daten','athleten_details','athleten_editieren','bulk_eintragen','veranstaltung_eintragen','veranstaltung_loeschen','inaktive_athleten_sehen'],
        'editor' => ['personenbezogene_daten','athleten_details','athleten_editieren','bulk_eintragen','veranstaltung_eintragen','veranstaltung_loeschen','inaktive_athleten_sehen'],
        'athlet' => ['personenbezogene_daten','athleten_details'],
        'leser'  => ['personenbezogene_daten','athleten_details'],
    ];
    foreach ($sysRollenRechte as $_sysrolle => $_newRights) {
        $row = DB::fetchOne('SELECT id, rechte FROM ' . DB::tbl('rollen') . ' WHERE name = ?', [$_sysrolle]);
        if ($row) {
            $r = json_decode($row['rechte'] ?? '[]', true) ?: [];
            $changed = false;
            foreach ($_newRights as $_nr) {
                if (!in_array($_nr, $r)) { $r[] = $_nr; $changed = true; }
            }
            if ($changed) DB::query('UPDATE ' . DB::tbl('rollen') . ' SET rechte = ? WHERE id = ?', [json_encode($r), $row['id']]);
        }
    }
} catch (\Exception $e) {}
// Seitenaufrufe-Tabelle für Besucher-Tracking
try { DB::query("CREATE TABLE IF NOT EXISTS " . DB::tbl('seitenaufrufe') . "
    (id INT AUTO_INCREMENT PRIMARY KEY, benutzer_id INT NULL, ip VARCHAR(45) NULL,
     user_agent VARCHAR(255) NULL, erstellt_am DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
     INDEX idx_erstellt (erstellt_am)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"); } catch (\Exception $e) {}
// Seitenaufruf tracken
if ($method === 'GET' && $res === 'ping') {
    $bId = isset($_SESSION['user_id']) ? (int)$_SESSION['user_id'] : null;
    $ip  = $_SERVER['REMOTE_ADDR'] ?? null;
    $ua  = substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 255);
    try { DB::query('INSERT INTO ' . DB::tbl('seitenaufrufe') . ' (benutzer_id,ip,user_agent) VALUES (?,?,?)', [$bId, $ip, $ua]); } catch (\Exception $e) {}
    try { DB::query('DELETE FROM ' . DB::tbl('seitenaufrufe') . ' WHERE erstellt_am < DATE_SUB(NOW(), INTERVAL 24 HOUR)'); } catch (\Exception $e) {}
    jsonOk(['pong' => true]);
}

// Migration: benutzername = email für alle Benutzer ohne Athlet-Verknüpfung
try { DB::query("
    UPDATE " . DB::tbl('benutzer') . " b
    SET b.benutzername = b.email
    WHERE b.benutzername != b.email
      AND b.benutzername NOT REGEXP '^[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}$'
"); } catch (\Exception $e) {}

// Migration: inaktive_athleten_sehen zu admin + editor Rollen hinzufügen
try {
    $adminRolle = DB::fetchOne("SELECT rechte FROM " . DB::tbl('rollen') . " WHERE name='admin'");
    if ($adminRolle) {
        $r = json_decode($adminRolle['rechte'] ?? '[]', true) ?: [];
        if (!in_array('inaktive_athleten_sehen', $r)) {
            $r[] = 'inaktive_athleten_sehen';
            DB::query("UPDATE " . DB::tbl('rollen') . " SET rechte=? WHERE name='admin'", [json_encode($r)]);
        }
    }
    $editorRolle = DB::fetchOne("SELECT rechte FROM " . DB::tbl('rollen') . " WHERE name='editor'");
    if ($editorRolle) {
        $r = json_decode($editorRolle['rechte'] ?? '[]', true) ?: [];
        if (!in_array('inaktive_athleten_sehen', $r)) {
            $r[] = 'inaktive_athleten_sehen';
            DB::query("UPDATE " . DB::tbl('rollen') . " SET rechte=? WHERE name='editor'", [json_encode($r)]);
        }
    }
} catch (\Exception $e) {}

// Migration: externe_ergebnisse_sehen Recht zu bestehenden Admin/Editor-Rollen
try {
    foreach (['admin','editor'] as $_rn) {
        $_rRow = DB::fetchOne('SELECT id, rechte FROM ' . DB::tbl('rollen') . ' WHERE name=?', [$_rn]);
        if ($_rRow) {
            $_rRechte = json_decode($_rRow['rechte'] ?? '[]', true) ?: [];
            if (!in_array('externe_ergebnisse_sehen', $_rRechte)) {
                $_rRechte[] = 'externe_ergebnisse_sehen';
                DB::query('UPDATE ' . DB::tbl('rollen') . ' SET rechte=? WHERE id=?', [json_encode($_rRechte), $_rRow['id']]);
            }
        }
    }
} catch (\Exception $e) {}
// Migration: methode-Spalte für login_versuche
try { DB::query("ALTER TABLE " . DB::tbl('login_versuche') . " ADD COLUMN IF NOT EXISTS methode VARCHAR(20) NULL"); } catch (\Exception $e) {}

// Standard-Rollen anlegen falls leer
try {
    if (!DB::fetchOne('SELECT id FROM ' . DB::tbl('rollen') . ' LIMIT 1')) {
        $defaultRollen = [
            ['admin',  '["vollzugriff","benutzer_verwalten","rekorde_bearbeiten","einstellungen_aendern","alle_ergebnisse","eigene_ergebnisse","lesen","personenbezogene_daten","veranstaltung_eintragen","veranstaltung_loeschen","inaktive_athleten_sehen","externe_ergebnisse_sehen"]', 'Administrator', 1],
            ['editor', '["alle_ergebnisse","lesen","personenbezogene_daten","veranstaltung_eintragen","veranstaltung_loeschen","inaktive_athleten_sehen","externe_ergebnisse_sehen"]', 'Editor', 1],
            ['athlet', '["eigene_ergebnisse","lesen","personenbezogene_daten"]', 'Athlet*in', 1],
            ['leser',  '["lesen","personenbezogene_daten"]', 'Leser*in', 1],
        ];
        foreach ($defaultRollen as $r) {
            DB::query('INSERT IGNORE INTO ' . DB::tbl('rollen') . ' (name, rechte, label, oeffentlich) VALUES (?,?,?,?)', $r);
        }
    }
} catch (\Exception $e) {}
// Migration: athlet-Rolle + Genehmigungssystem
try { DB::query("ALTER TABLE " . DB::tbl('benutzer') . " MODIFY COLUMN rolle ENUM('admin','editor','athlet','leser') NOT NULL DEFAULT 'leser'"); } catch (\Exception $e) {}
try { DB::query("CREATE TABLE IF NOT EXISTS " . DB::tbl('ergebnis_aenderungen') . " (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ergebnis_id INT NULL COMMENT 'NULL fuer neue Eintragung (insert)',
    ergebnis_tbl VARCHAR(60) NOT NULL DEFAULT 'ergebnisse',
    typ ENUM('insert','update','delete') NOT NULL,
    neue_werte JSON NULL,
    beantragt_von INT NOT NULL,
    beantragt_am DATETIME NOT NULL DEFAULT NOW(),
    status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
    bearbeitet_von INT NULL,
    bearbeitet_am DATETIME NULL,
    kommentar VARCHAR(500) NULL,
    INDEX idx_status (status),
    INDEX idx_von (beantragt_von)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"); } catch (\Exception $e) {}
// ak_platz_meisterschaft in allen Ergebnis-Tabellen
foreach (['ergebnisse','ergebnisse_strasse','ergebnisse_sprint','ergebnisse_mittelstrecke','ergebnisse_sprungwurf'] as $_emt) {
    try { DB::query("ALTER TABLE " . DB::tbl($_emt) . " ADD COLUMN IF NOT EXISTS ak_platz_meisterschaft SMALLINT NULL"); } catch (\Exception $e) {}
}
unset($_emt);

// Einheitliche Tabelle vorhanden?
$_tblCheck = DB::fetchOne("SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='ergebnisse'");
$unified = $_tblCheck && (int)$_tblCheck['c'] > 0;
// Mapping: alte tbl_key -> Tabelle (Fallback)
$_sys = ['strasse'=>'ergebnisse_strasse','sprint'=>'ergebnisse_sprint',
          'mittelstrecke'=>'ergebnisse_mittelstrecke','sprungwurf'=>'ergebnisse_sprungwurf'];
// Hilfsfunktion: Ergebnistabelle für alten Key
function ergebnisTbl(string $key, bool $unified, array $sys): string {
    return $unified ? 'ergebnisse' : ($sys[$key] ?? 'ergebnisse_strasse');
}

// Migration: approved insert-Anträge ohne ergebnis_id nachträglich verarbeiten
try {
    $stuckAntraege = DB::fetchAll(
        'SELECT * FROM ' . DB::tbl('ergebnis_aenderungen') .
        ' WHERE typ=? AND status=? AND ergebnis_id IS NULL',
        ['insert', 'approved']
    );
    foreach ($stuckAntraege as $sa) {
        $sv = json_decode($sa['neue_werte'] ?? '{}', true) ?: [];
        $svid = intOrNull($sv['veranstaltung_id'] ?? null);
        $said = intOrNull($sv['athlet_id'] ?? null);
        $sdisz = $sv['disziplin'] ?? '';
        $sdmId = intOrNull($sv['disziplin_mapping_id'] ?? null);
        $sres = $sv['resultat'] ?? '';
        $sak = $sv['altersklasse'] ?? '';
        $svon = intOrNull($sv['erstellt_von'] ?? null);
        if ($svid && $said && $sdisz && $sres) {
            DB::query(
                'INSERT INTO ' . DB::tbl('ergebnisse') .
                ' (veranstaltung_id,athlet_id,disziplin,disziplin_mapping_id,resultat,altersklasse,erstellt_von)'
                . ' VALUES (?,?,?,?,?,?,?)',
                [$svid,$said,$sdisz,$sdmId,$sres,$sak,$svon]
            );
            $snewId = DB::lastInsertId();
            DB::query('UPDATE ' . DB::tbl('ergebnis_aenderungen') . ' SET ergebnis_id=? WHERE id=?', [$snewId, $sa['id']]);
            DB::query('UPDATE ' . DB::tbl('veranstaltungen') . ' SET genehmigt=1 WHERE id=?', [$svid]);
        }
    }
} catch (\Exception $e) {}

// ============================================================
// AUTH
// ============================================================
if ($res === 'auth') {
    // --- Login Vorstufe: Benutzer identifizieren (kein Passwort) ---
    if ($method === 'POST' && $id === 'identify') {
        $ident = trim($body['benutzername'] ?? '');
        if (!$ident) jsonErr('Bitte Benutzername oder E-Mail eingeben.', 400);
        $user = DB::fetchOne(
            'SELECT id, benutzername, email FROM ' . DB::tbl('benutzer') . ' WHERE (benutzername = ? OR email = ?) AND aktiv = 1',
            [$ident, $ident]
        );
        if (!$user) {
            // Absichtlich vage, kein User-Enum
            jsonOk(['found' => false, 'has_passkey' => false]);
        }
        try { Passkey::migrate(); } catch (\Exception $e) {}
        $hasPasskey = Passkey::userHasPasskey($user['id']);
        // User-ID in Session für nachfolgende Passkey-Auth
        $_SESSION['identify_user_id'] = $user['id'];
        session_write_close();
        jsonOk(['found' => true, 'has_passkey' => $hasPasskey]);
    }

    // --- Login Schritt 1: Passwort ---
    if ($method === 'POST' && $id === 'login') {
        $result = Auth::loginStep1($body['benutzername'] ?? '', $body['passwort'] ?? '');
        if (!$result['ok']) jsonErr($result['fehler'], 401);
        if (!empty($result['totp_required'])) {
            // Kein vollständiger Login – 2FA noch ausstehend
            jsonOk([
                'totp_required'         => true,
                'totp_setup'            => !empty($result['totp_setup']),
                'has_totp'              => !empty($result['has_totp']),
                'has_passkey'           => !empty($result['has_passkey']),
                'email_login_bevorzugt' => !empty($result['email_login_bevorzugt']),
            ]);
        }
        jsonOk(['rolle' => $result['rolle'], 'name' => $result['name']]);
    }
    // --- Login Schritt 2: TOTP-Code ---
    if ($method === 'POST' && $id === 'totp-verify') {
        $result = Auth::loginStep2($body['code'] ?? '');
        if (!$result['ok']) jsonErr($result['fehler'], 401);
        jsonOk(['rolle' => $result['rolle'], 'name' => $result['name']]);
    }
    // --- TOTP Setup initialisieren (QR-Code ausgeben) ---
    if ($method === 'GET' && $id === 'totp-setup') {
        // Für eingeloggte User: pending session setzen damit totpSetupInit funktioniert
        $loggedIn = Auth::check();
        if ($loggedIn && empty($_SESSION['totp_pending_user'])) {
            $_SESSION['totp_pending_user'] = $loggedIn['id'];
        }
        $result = Auth::totpSetupInit();
        if (!$result['ok']) jsonErr($result['fehler'], 403);
        jsonOk($result);
    }
    // --- TOTP Setup bestätigen (Code verifizieren, Backup-Codes ausgeben) ---
    if ($method === 'POST' && $id === 'totp-setup') {
        $result = Auth::totpSetupConfirm($body['code'] ?? '');
        if (!$result['ok']) jsonErr($result['fehler'], 400);
        jsonOk($result);
    }
    // --- TOTP deaktivieren (für sich selbst, alle eingeloggten User) ---
    if ($method === 'DELETE' && $id === 'totp-setup') {
        $user = Auth::requireLogin();
        // Sicherheits-Check: mindestens eine 2FA-Methode muss bleiben
        try { Passkey::migrate(); } catch (\Exception $e) {}
        if (!Passkey::userHasPasskey($user['id'])) {
            jsonErr('Kein Passkey registriert \u2013 TOTP kann nicht deaktiviert werden (kein 2FA-Fallback).', 409);
        }
        Auth::totpDisable($user['id']);
        jsonOk('TOTP deaktiviert.');
    }

    // ── Passkey: Login Challenge (Schritt 2 oder 3 – aus identify oder totp_pending) ──
    if ($method === 'POST' && $id === 'passkey-auth-challenge') {
        $uid = (int)($_SESSION['totp_pending_user'] ?? $_SESSION['identify_user_id'] ?? 0);
        if (!$uid) jsonErr('Keine ausstehende Anmeldung.', 401);
        Passkey::migrate();
        $options = Passkey::authChallenge($uid);
        jsonOk($options);
    }
    // ── Passkey: Discoverable-Challenge (ohne Benutzername) ──
    if ($method === 'POST' && $id === 'passkey-auth-challenge-discover') {
        // Stateless: Challenge wird HMAC-signiert zurückgegeben, kein Session-Lock
        Passkey::migrate();
        $challenge = random_bytes(32);
        $ts        = time();
        $secret    = defined('SESSION_NAME') ? SESSION_NAME : 'stat';
        $token     = hash_hmac('sha256', base64_encode($challenge) . '|' . $ts, $secret);
        jsonOk([
            'challenge'        => base64_encode($challenge),
            'token'            => $token,
            'ts'               => $ts,
            'timeout'          => 60000,
            'rpId'             => Passkey::getRpIdPublic(),
            'userVerification' => 'preferred',
            'allowCredentials' => [],
        ]);
    }
    // ── Passkey: Login Response verifizieren ──
    // --- Login Schritt 3 Alternative: E-Mail-Code senden ---
    if ($method === 'POST' && $id === 'email-code-send') {
        if (empty($_SESSION['totp_pending_user'])) jsonErr('Keine ausstehende Anmeldung.', 401);
        $uid  = (int)$_SESSION['totp_pending_user'];
        $user = DB::fetchOne('SELECT benutzername, email FROM ' . DB::tbl('benutzer') . ' WHERE id = ? AND aktiv = 1', [$uid]);
        if (!$user || !$user['email']) jsonErr('Keine E-Mail-Adresse hinterlegt.', 400);
        $code     = str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $codeHash = hashCode($code);
        // Code in Session speichern (5 Minuten)
        $_SESSION['email_login_code_hash'] = $codeHash;
        $_SESSION['email_login_code_exp']  = time() + 300;
        $subject = Settings::get('verein_name','Mein Verein e.V.') . ' – Login-Code: ' . $code;
        $msg     = "Hallo " . $user['benutzername'] . ",\n\n" .
                   "dein Login-Bestätigungscode lautet:\n\n" .
                   "    " . $code . "\n\n" .
                   "Dieser Code ist 5 Minuten gültig.\n\n" .
                   "Wenn du das nicht warst, ignoriere diese E-Mail.\n\n" .
                   Settings::get('verein_name','Mein Verein e.V.') . ' ' . Settings::get('app_untertitel','Leichtathletik-Statistik');
        @mail($user['email'], $subject, $msg, "From: " . Settings::get('noreply_email','') . "\r\nContent-Type: text/plain; charset=utf-8");
        jsonOk('Code gesendet.');
    }

    // --- Login Schritt 3 Alternative: E-Mail-Code verifizieren ---
    if ($method === 'POST' && $id === 'email-code-verify') {
        if (empty($_SESSION['totp_pending_user'])) jsonErr('Keine ausstehende Anmeldung.', 401);
        if (empty($_SESSION['email_login_code_hash']) || ($_SESSION['email_login_code_exp'] ?? 0) < time())
            jsonErr('Code abgelaufen. Bitte neuen Code anfordern.', 400);
        $code = trim($body['code'] ?? '');
        if (!password_verify($code, $_SESSION['email_login_code_hash']))
            jsonErr('Ungültiger Code.', 401);
        $uid  = (int)$_SESSION['totp_pending_user'];
        $user = DB::fetchOne('SELECT * FROM ' . DB::tbl('benutzer') . ' WHERE id = ? AND aktiv = 1', [$uid]);
        if (!$user) jsonErr('Benutzer nicht gefunden.', 401);
        unset($_SESSION['totp_pending_user'], $_SESSION['email_login_code_hash'], $_SESSION['email_login_code_exp']);
        $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
        try { DB::query('INSERT INTO ' . DB::tbl('login_versuche') . ' (benutzername, ip, erfolg, methode) VALUES (?, ?, 1, ?)', [$user['email'], $ip, 'email']); } catch (\Exception $e) {}
        jsonOk(Auth::finalizeLoginPublic($user));
    }

    if ($method === 'POST' && $id === 'passkey-auth-verify') {
        $isDiscover = !empty($body['discover_token']);
        if ($isDiscover) {
            // Stateless Discover-Flow: HMAC-Token prüfen
            $token  = $body['discover_token'];
            $ts     = (int)($body['discover_ts'] ?? 0);
            $chal   = $body['discover_challenge'] ?? '';
            $secret = defined('SESSION_NAME') ? SESSION_NAME : 'stat';
            $expect = hash_hmac('sha256', $chal . '|' . $ts, $secret);
            if (!hash_equals($expect, $token))    jsonErr('Ungültiges Challenge-Token.', 401);
            if (time() - $ts > 120)               jsonErr('Challenge abgelaufen.', 401);
            // Passkey-Assertion direkt prüfen (challenge aus body, kein Session-Lookup)
            $result = Passkey::authVerifyStateless($body['credential'] ?? [], base64_decode($chal));
            if (!$result['ok']) jsonErr($result['fehler'], 401);
            $credId = $body['credential']['id'] ?? '';
            $pk = $credId ? DB::fetchOne('SELECT user_id FROM ' . DB::tbl('passkeys') . ' WHERE credential_id = ?', [$credId]) : null;
            if (!$pk) jsonErr('Passkey keinem Benutzer zugeordnet.', 401);
            $uid = (int)$pk['user_id'];
        } else {
            $result = Passkey::authVerify($body['credential'] ?? []);
            if (!$result['ok']) jsonErr($result['fehler'], 401);
            $uid = (int)($_SESSION['totp_pending_user'] ?? $_SESSION['identify_user_id'] ?? 0);
            unset($_SESSION['totp_pending_user'], $_SESSION['identify_user_id']);
            if (!$uid) jsonErr('Keine ausstehende Anmeldung.', 401);
        }
        $user = DB::fetchOne('SELECT * FROM ' . DB::tbl('benutzer') . ' WHERE id = ? AND aktiv = 1', [$uid]);
        if (!$user) jsonErr('Benutzer nicht gefunden.', 401);
        $loginResult = Auth::finalizeLoginPublic($user);
        $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
        try { DB::query('INSERT INTO ' . DB::tbl('login_versuche') . ' (benutzername, ip, erfolg, methode) VALUES (?, ?, 1, ?)', [$user['email'], $ip, 'passkey']); } catch (\Exception $e) {}
        jsonOk(['rolle' => $loginResult['rolle'], 'name' => $loginResult['name'], 'vorname' => $loginResult['vorname'] ?? '', 'email' => $loginResult['email'] ?? '']);
    }
    // ── Passkey: Registrierung Challenge (eingeloggt, für Profil) ──
    if ($method === 'GET' && $id === 'passkey-reg-challenge') {
        $user = Auth::requireLogin();
        Passkey::migrate();
        $options = Passkey::registrationChallenge($user['id']);
        jsonOk($options);
    }
    // ── Passkey: Registrierung bestätigen ──
    if ($method === 'POST' && $id === 'passkey-reg-verify') {
        $user = Auth::requireLogin();
        $result = Passkey::registrationVerify($body['credential'] ?? [], $body['name'] ?? 'Passkey');
        if (!$result['ok']) jsonErr($result['fehler'], 400);
        jsonOk(['name' => $result['name']]);
    }
    // ── Passkey: Liste der eigenen Passkeys ──
    if ($method === 'GET' && $id === 'passkeys') {
        $user = Auth::requireLogin();
        Passkey::migrate();
        jsonOk(Passkey::listForUser($user['id']));
    }
    // ── Passkey: Löschen ──
    if ($method === 'DELETE' && $id === 'passkeys' && !empty($parts[2])) {
        $user = Auth::requireLogin();
        $pkId = (int)$parts[2];
        if (!Passkey::delete($pkId, $user['id'])) jsonErr('Nicht gefunden oder keine Berechtigung.', 404);
        jsonOk(null);
    }
    // --- Logout ---
    // Konto löschen (in Papierkorb – 30 Tage Wiederherstellung)
    if ($method === 'DELETE' && $id === 'konto') {
        $user = Auth::requireLogin();
        $uid = (int)$user['id'];
        // Vom Athletenprofil trennen + geloescht_am setzen
        // athlet_id bleibt erhalten bis zur endgültigen Löschung aus dem Papierkorb
        DB::query('UPDATE ' . DB::tbl('benutzer') . ' SET aktiv = 0, geloescht_am = NOW() WHERE id = ?', [$uid]);
        Auth::logout();
        jsonOk(['msg' => 'Konto gelöscht.']);
    }

    if ($method === 'POST' && $id === 'logout') {
        Auth::logout();
        jsonOk('Abgemeldet.');
    }
    // --- SSO-Status: Session-Check für Login-Portal-Redirect ---
    if ($method === 'GET' && $id === 'sso-status') {
        $user = Auth::check();
        if ($user) {
            jsonOk(['eingeloggt' => true, 'name' => $user['name'], 'rolle' => $user['rolle']]);
        } else {
            jsonOk(['eingeloggt' => false]);
        }
    }
    // --- Session prüfen ---
    if ($method === 'GET' && $id === 'me') {
        if (Auth::check()) {
            try { DB::query('UPDATE ' . DB::tbl('benutzer') . ' SET letzter_aktivitaet = NOW() WHERE id = ?', [$_SESSION['user_id']]); } catch (\Exception $e) {}
        }
        $user = Auth::check();
        if (!$user) jsonErr('Nicht eingeloggt.', 401);
        // totp_aktiv + Passkey-Status
        $row = DB::fetchOne('SELECT totp_aktiv, avatar_pfad, email, athlet_id FROM ' . DB::tbl('benutzer') . ' WHERE id = ?', [$user['id']]);
        $user['totp_aktiv']  = !empty($row['totp_aktiv']);
        $user['avatar']      = $row['avatar_pfad'] ?? null;
        $user['email']       = $row['email'] ?? '';
        // Vorname aus verknüpftem Athletenprofil
        $vorname = '';
        if (!empty($row['athlet_id'])) {
            $ath = DB::fetchOne('SELECT vorname, nachname FROM ' . DB::tbl('athleten') . ' WHERE id = ?', [$row['athlet_id']]);
            if ($ath) { $vorname = $ath['vorname'] ?? ''; $user['nachname'] = $ath['nachname'] ?? ''; }
        }
        $user['vorname']   = $vorname;
        $user['athlet_id']  = !empty($row['athlet_id']) ? (int)$row['athlet_id'] : null;
        // Rechte der eigenen Rolle mitsenden
        $rolleRow = DB::fetchOne('SELECT rechte FROM ' . DB::tbl('rollen') . ' WHERE name = ?', [$user['rolle']]);
        $user['rechte'] = $rolleRow ? (json_decode($rolleRow['rechte'] ?? '[]', true) ?: []) : [];
        try { Passkey::migrate(); } catch (\Exception $e) {}
        $user['has_passkey'] = Passkey::userHasPasskey($user['id']);
        jsonOk($user);
    }
    // --- Online-Status: welche Athleten sind gerade eingeloggt (aktiv < 5 Min) ---
    if ($method === 'GET' && $id === 'online-status') {
        if (!Auth::check()) jsonErr('Nicht eingeloggt.', 401);
        try {
            $rows = DB::fetchAll(
                'SELECT id, athlet_id FROM ' . DB::tbl('benutzer') .
                ' WHERE aktiv = 1 AND letzter_aktivitaet >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)'
            );
            jsonOk([
                'user_ids'   => array_values(array_column($rows, 'id')),
                'athlet_ids' => array_values(array_filter(array_column($rows, 'athlet_id'))),
            ]);
        } catch (\Exception $e) { jsonOk(['user_ids'=>[],'athlet_ids'=>[]]); }
    }
    // --- User-Präferenzen lesen ---
    if ($method === 'GET' && $id === 'prefs') {
        $user = Auth::requireLogin();
        $row  = DB::fetchOne('SELECT prefs FROM ' . DB::tbl('benutzer') . ' WHERE id = ?', [$user['id']]);
        $prefs = ($row && $row['prefs']) ? json_decode($row['prefs'], true) : [];
        jsonOk($prefs ?: (object)[]);
    }
    // --- User-Präferenzen speichern ---
    if ($method === 'PUT' && $id === 'prefs') {
        $user = Auth::requireLogin();
        $prefs = $body ?? [];
        // Nur erlaubte Keys
        $allowed = ['rek_merge_ak','rek_unique','rek_hl_cur','rek_hl_prev'];
        $save = [];
        foreach ($allowed as $k) {
            if (array_key_exists($k, $prefs)) $save[$k] = (bool)$prefs[$k];
        }
        // Migration: prefs-Spalte anlegen falls nicht vorhanden
        try { DB::query('ALTER TABLE ' . DB::tbl('benutzer') . ' ADD COLUMN IF NOT EXISTS prefs JSON NULL'); } catch (\Exception $e) {}
        // Bestehende Prefs laden und mergen
        $row  = DB::fetchOne('SELECT prefs FROM ' . DB::tbl('benutzer') . ' WHERE id = ?', [$user['id']]);
        $existing = ($row && $row['prefs']) ? json_decode($row['prefs'], true) : [];
        $merged = array_merge($existing ?: [], $save);
        DB::query('UPDATE ' . DB::tbl('benutzer') . ' SET prefs = ? WHERE id = ?', [json_encode($merged), $user['id']]);
        jsonOk($merged);
    }
    // --- Passwort ändern ---
    if ($method === 'POST' && $id === 'passwort') {
        $user = Auth::requireLogin();
        $aktuell = $body['aktuell'] ?? '';
        $neu     = $body['neu']     ?? '';
        if (strlen($neu) < 8) jsonErr('Neues Passwort muss mindestens 8 Zeichen haben.');
        $row = DB::fetchOne('SELECT passwort FROM ' . DB::tbl('benutzer') . ' WHERE id = ?', [$user['id']]);
        if (!$row || !password_verify($aktuell, $row['passwort']))
            jsonErr('Aktuelles Passwort ist falsch.', 401);
        $hash = hashPw($neu);
        DB::query('UPDATE ' . DB::tbl('benutzer') . ' SET passwort = ? WHERE id = ?', [$hash, $user['id']]);
        jsonOk('Passwort geändert.');
    }

    // ── REGISTRIERUNG ────────────────────────────────────────
    // Login-Portal aktiv → Registrierung wird dort verwaltet; direkte API-Aufrufe blocken
    if (in_array($id, ['register-start','register-resend','register-verify-email',
                        'register-totp-init','register-totp-confirm','register-email-2fa'])
        && Settings::get('login_portal_aktiv') === '1'
        && Settings::get('login_portal_url')) {
        $portalUrl = rtrim(Settings::get('login_portal_url'), '/');
        jsonErr('Registrierung läuft über das Login-Portal (' . $portalUrl . '). Bitte dort registrieren.', 400);
    }

    // Login-Portal aktiv ohne shared RP-ID → Passkey-Verwaltung muss auf dem Login-Portal erfolgen,
    // da rpId an dessen Domain gebunden ist. Hier registrierte Passkeys wären dort unbrauchbar.
    // Ausnahme: passkey_rp_id gesetzt → beide Portale nutzen dieselbe rpId, Registrierung hier OK.
    if (in_array($id, ['passkey-reg-challenge', 'passkey-reg-verify'])
        && Settings::get('login_portal_aktiv') === '1'
        && Settings::get('login_portal_url')
        && !Settings::get('passkey_rp_id', '')) {
        $portalUrl = rtrim(Settings::get('login_portal_url'), '/');
        jsonErr('Passkey-Verwaltung läuft über das Login-Portal (' . $portalUrl . '). Bitte dort einrichten.', 400);
    }

    // Schritt 1: Registrierung starten, E-Mail-Bestätigungscode senden
    if ($method === 'POST' && $id === 'register-start') {
        $email    = strtolower(trim($body['email']    ?? ''));
        $pw       = $body['passwort'] ?? '';

        $emailDomainSetting = Settings::get('email_domain','');
        if ($emailDomainSetting && !preg_match('/@' . preg_quote($emailDomainSetting, '/') . '$/', $email))
            jsonErr('Nur @' . $emailDomainSetting . ' E-Mail-Adressen sind zugelassen.');
        if (strlen($pw) < 12) jsonErr('Passwort muss mindestens 12 Zeichen haben.');
        $groups = 0;
        if (preg_match('/[A-Z]/', $pw)) $groups++;
        if (preg_match('/[a-z]/', $pw)) $groups++;
        if (preg_match('/[0-9]/', $pw)) $groups++;
        if (preg_match('/[^A-Za-z0-9]/', $pw)) $groups++;
        if ($groups < 3) jsonErr('Passwort muss mindestens 3 von 4 Zeichengruppen enthalten (Groß-, Kleinbuchstaben, Zahlen, Sonderzeichen).');

        // Prüfen ob E-Mail schon als aktiver (nicht gelöschter) Benutzer vergeben
        if (DB::fetchOne('SELECT id FROM ' . DB::tbl('benutzer') . ' WHERE email = ? AND geloescht_am IS NULL', [$email]))
            jsonErr('Diese E-Mail-Adresse ist bereits registriert.');
        // Kein aktives Konto mehr vorhanden (oben geprüft) → approved-Altlasten immer bereinigen
        // Damit können gelöschte oder hartgelöschte Accounts sich neu registrieren
        DB::query('DELETE FROM ' . DB::tbl('registrierungen') . ' WHERE email = ?', [$email]);
        // pending und rejected: werden unten gelöscht und neu angelegt

        $code      = str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $codeHash  = hashCode($code);
        $pwHash    = hashPw($pw);

        // Alte Einträge löschen (abgelehnte + abgelaufene pending)
        DB::query('DELETE FROM ' . DB::tbl('registrierungen') . ' WHERE email = ? AND status != ?', [$email, 'approved']);

        // name = Lokalpart der E-Mail als Anzeigename-Vorschlag
        $nameVorschlag = explode('@', $email)[0];
        DB::query(
            'INSERT INTO ' . DB::tbl('registrierungen') . ' (email, name, passwort_hash, email_code_hash, code_expires_at)
             VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 30 MINUTE))',
            [$email, $nameVorschlag, $pwHash, $codeHash]
        );

        // E-Mail senden
        $subject = Settings::get('verein_name','Mein Verein e.V.') . ' – Bestätigungscode: ' . $code;
        $msg     = "Hallo " . $nickname . ",\n\n" .
                   "dein Bestätigungscode für die Registrierung lautet:\n\n" .
                   "    " . $code . "\n\n" .
                   "Dieser Code ist 30 Minuten gültig.\n\n" .
                   "Wenn du keine Registrierung beantragt hast, ignoriere diese E-Mail.\n\n" .
                   Settings::get('verein_name','Mein Verein e.V.') . ' ' . Settings::get('app_untertitel','Leichtathletik-Statistik');
        @mail($email, $subject, $msg, "From: " . Settings::get('noreply_email','') . "\r\nContent-Type: text/plain; charset=utf-8");

        jsonOk('Code gesendet.');
    }

    // Schritt 1b: Code erneut senden
    if ($method === 'POST' && $id === 'register-resend') {
        $email = strtolower(trim($body['email'] ?? ''));
        $reg   = DB::fetchOne('SELECT * FROM ' . DB::tbl('registrierungen') . ' WHERE email = ? AND status = ?', [$email, 'pending']);
        if (!$reg) jsonErr('Registrierung nicht gefunden.');

        $code     = str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $codeHash = hashCode($code);
        DB::query('UPDATE ' . DB::tbl('registrierungen') . ' SET email_code_hash = ?, code_expires_at = DATE_ADD(NOW(), INTERVAL 30 MINUTE) WHERE email = ?',
            [$codeHash, $email]);

        $subject = Settings::get('verein_name','Mein Verein e.V.') . ' – Neuer Bestätigungscode: ' . $code;
        $msg     = "Dein neuer Bestätigungscode lautet:\n\n    " . $code . "\n\n(gültig 30 Minuten)\n\n" . Settings::get('verein_name','Mein Verein e.V.');
        @mail($email, $subject, $msg, "From: " . Settings::get('noreply_email','') . "\r\nContent-Type: text/plain; charset=utf-8");

        jsonOk('Code erneut gesendet.');
    }

    // Schritt 2: E-Mail bestätigen
    if ($method === 'POST' && $id === 'register-verify-email') {
        $email = strtolower(trim($body['email'] ?? ''));
        $code  = trim($body['code'] ?? '');
        $reg   = DB::fetchOne(
            'SELECT * FROM ' . DB::tbl('registrierungen') . ' WHERE email = ? AND status = ? AND code_expires_at > NOW()',
            [$email, 'pending']
        );
        if (!$reg) jsonErr('Registrierung nicht gefunden oder Code abgelaufen.');
        if (!password_verify($code, $reg['email_code_hash']))
            jsonErr('Ungültiger Code. Bitte überprüfe die E-Mail.');

        DB::query('UPDATE ' . DB::tbl('registrierungen') . ' SET email_verifiziert = 1 WHERE email = ?', [$email]);
        jsonOk('E-Mail bestätigt.');
    }

    // Schritt 3a: TOTP-Setup für Registrierung initialisieren
    if ($method === 'POST' && $id === 'register-totp-init') {
        $email = strtolower(trim($body['email'] ?? ''));
        $reg   = DB::fetchOne('SELECT * FROM ' . DB::tbl('registrierungen') . ' WHERE email = ? AND email_verifiziert = 1 AND status = ?', [$email, 'pending']);
        if (!$reg) jsonErr('E-Mail noch nicht bestätigt.');

        $secret = TOTP::generateSecret();
        DB::query('UPDATE ' . DB::tbl('registrierungen') . ' SET totp_pending = ? WHERE email = ?', [$secret, $email]);

        $uri   = TOTP::getUri($secret, $email);
        $qrUrl = TOTP::getQrUrl($uri);
        jsonOk(['secret' => $secret, 'qr_url' => $qrUrl, 'uri' => $uri]);
    }

    // Schritt 3b: TOTP-Code bestätigen → Registrierung abschließen
    if ($method === 'POST' && $id === 'register-totp-confirm') {
        $email  = strtolower(trim($body['email']  ?? ''));
        $code   = trim($body['code']   ?? '');
        $reg    = DB::fetchOne(
            'SELECT * FROM ' . DB::tbl('registrierungen') . ' WHERE email = ? AND email_verifiziert = 1 AND status = ?',
            [$email, 'pending']
        );
        if (!$reg || empty($reg['totp_pending']))
            jsonErr('Setup nicht initialisiert oder E-Mail nicht bestätigt.');
        if (!TOTP::verify($reg['totp_pending'], $code))
            jsonErr('Ungültiger Code. Bitte erneut versuchen.');

        DB::query('UPDATE ' . DB::tbl('registrierungen') . ' SET totp_aktiv = 1, totp_secret = ? WHERE email = ?',
            [$reg['totp_pending'], $email]);

        $autoFreigabe = Settings::get('registrierung_auto_freigabe','0') === '1';
        $admins = DB::fetchAll("SELECT email FROM " . DB::tbl('benutzer') . " WHERE rolle = 'admin' AND aktiv = 1");
        if ($autoFreigabe) {
            $regNow = DB::fetchOne('SELECT * FROM ' . DB::tbl('registrierungen') . ' WHERE email = ? AND status = ?', [$email, 'pending']);
            if ($regNow) {
                $bname2 = $regNow['email'];
                DB::query(
                    'INSERT INTO ' . DB::tbl('benutzer') . ' (benutzername, email, passwort, rolle, aktiv, totp_secret, totp_aktiv, totp_backup, email_login_bevorzugt) VALUES (?,?,?,?,1,?,?,?,?)',
                    [$bname2, $regNow['email'], $regNow['passwort_hash'], 'leser',
                     $regNow['totp_secret'], (int)$regNow['totp_aktiv'], '[]', 0]
                );
                DB::query('UPDATE ' . DB::tbl('registrierungen') . ' SET status = ? WHERE email = ?', ['approved', $email]);
                $approvedMsg = "Hallo " . $regNow['name'] . ",\n\ndeine Registrierung wurde bestätigt! Du kannst dich jetzt einloggen.\n\n" . Settings::get('verein_name','');
                @mail($regNow['email'], Settings::get('verein_name','') . ' – Registrierung bestätigt', $approvedMsg, "From: " . Settings::get('noreply_email','') . "\r\nContent-Type: text/plain; charset=utf-8");
                foreach ($admins as $admin) {
                    $msg = "Neue Registrierung (automatisch freigegeben):\n\nE-Mail: " . $reg['email'] . "\n\n" . Settings::get('verein_name','');
                    @mail($admin['email'], Settings::get('verein_name','Mein Verein e.V.') . ' – Neue Registrierung: ' . $reg['email'], $msg,
                          "From: " . Settings::get('noreply_email','') . "\r\nContent-Type: text/plain; charset=utf-8");
                }
                jsonOk(['auto_freigabe' => true]);
            }
        }
        foreach ($admins as $admin) {
            $msg = "Neue Registrierungsanfrage:\n\nE-Mail: " . $reg['email'] . "\n\nBitte in der Admin-Oberfläche unter Benutzer freigeben.";
            @mail($admin['email'], Settings::get('verein_name','Mein Verein e.V.') . ' – Neue Registrierung: ' . $reg['email'], $msg,
                  "From: " . Settings::get('noreply_email','') . "\r\nContent-Type: text/plain; charset=utf-8");
        }
        jsonOk('Registrierung abgeschlossen. Warte auf Admin-Freigabe.');
    }

    // Schritt 3 Alternative: E-Mail-Code statt TOTP wählen
    if ($method === 'POST' && $id === 'register-email-2fa') {
        $email = strtolower(trim($body['email'] ?? ''));
        $reg   = DB::fetchOne('SELECT * FROM ' . DB::tbl('registrierungen') . ' WHERE email = ? AND email_verifiziert = 1 AND status = ?', [$email, 'pending']);
        if (!$reg) jsonErr('E-Mail nicht bestätigt oder Registrierung nicht gefunden.');
        // Kein TOTP — E-Mail-Login bevorzugt
        DB::query('UPDATE ' . DB::tbl('registrierungen') . ' SET totp_aktiv = 0, email_login_bevorzugt = 1 WHERE email = ?', [$email]);
        $autoFreigabe2 = Settings::get('registrierung_auto_freigabe','0') === '1';
        $admins2 = DB::fetchAll("SELECT email FROM " . DB::tbl('benutzer') . " WHERE rolle = 'admin' AND aktiv = 1");
        if ($autoFreigabe2) {
            $regNow2 = DB::fetchOne('SELECT * FROM ' . DB::tbl('registrierungen') . ' WHERE email = ? AND status = ?', [$email, 'pending']);
            if ($regNow2) {
                $bname3 = $regNow2['email'];
                DB::query(
                    'INSERT INTO ' . DB::tbl('benutzer') . ' (benutzername, email, passwort, rolle, aktiv, totp_aktiv, totp_backup, email_login_bevorzugt) VALUES (?,?,?,?,1,0,?,1)',
                    [$bname3, $regNow2['email'], $regNow2['passwort_hash'], 'leser', '[]']
                );
                DB::query('UPDATE ' . DB::tbl('registrierungen') . ' SET status = ? WHERE email = ?', ['approved', $email]);
                $approvedMsg2 = "Hallo " . $regNow2['name'] . ",\n\ndeine Registrierung wurde bestätigt! Du kannst dich jetzt einloggen.\n\n" . Settings::get('verein_name','');
                @mail($regNow2['email'], Settings::get('verein_name','') . ' – Registrierung bestätigt', $approvedMsg2, "From: " . Settings::get('noreply_email','') . "\r\nContent-Type: text/plain; charset=utf-8");
                foreach ($admins2 as $admin) {
                    $msg = "Neue Registrierung (automatisch freigegeben):\n\nE-Mail: " . $reg['email'] . "\n\n" . Settings::get('verein_name','');
                    @mail($admin['email'], Settings::get('verein_name','') . ' – Neue Registrierung: ' . $reg['email'], $msg,
                          "From: " . Settings::get('noreply_email','') . "\r\nContent-Type: text/plain; charset=utf-8");
                }
                jsonOk(['auto_freigabe' => true]);
            }
        }
        foreach ($admins2 as $admin) {
            $msg = "Neue Registrierungsanfrage (E-Mail-Login):\n\nE-Mail: " . $reg['email'] . "\n\nBitte in der Admin-Oberfläche unter Benutzer freigeben.";
            @mail($admin['email'], Settings::get('verein_name','') . ' – Neue Registrierung: ' . $reg['email'], $msg,
                  "From: " . Settings::get('noreply_email','') . "\r\nContent-Type: text/plain; charset=utf-8");
        }
        jsonOk('Registrierung abgeschlossen. Warte auf Admin-Freigabe.');
    }

    // ── Passwort vergessen – Schritt 1: Code senden ─────────────────────────
    if ($method === 'POST' && $id === 'reset-request') {
        $email = strtolower(trim($body['email'] ?? ''));
        if (!$email) jsonErr('Bitte E-Mail-Adresse angeben.');
        // Benutzer suchen (nicht gelöschte)
        $user = DB::fetchOne('SELECT id, email FROM ' . DB::tbl('benutzer') . ' WHERE email=? AND aktiv=1 AND geloescht_am IS NULL', [$email]);
        // Keine Info ob Account existiert (Security)
        if ($user) {
            $code    = str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);
            $hash    = password_hash($code, PASSWORD_DEFAULT);
            $expires = date('Y-m-d H:i:s', strtotime('+15 minutes'));
            // Speichere in Benutzer-Tabelle (temp-Felder falls vorhanden, sonst prefs)
            try {
                DB::query('UPDATE ' . DB::tbl('benutzer') . ' SET reset_code_hash=?, reset_code_expires=? WHERE id=?',
                    [$hash, $expires, $user['id']]);
            } catch (\Exception $e) {
                // Fallback: code in prefs speichern
                $prefs = json_decode(DB::fetchOne('SELECT prefs FROM ' . DB::tbl('benutzer') . ' WHERE id=?', [$user['id']])['prefs'] ?? '{}', true) ?: [];
                $prefs['_reset'] = ['h' => $hash, 'e' => $expires];
                DB::query('UPDATE ' . DB::tbl('benutzer') . ' SET prefs=? WHERE id=?', [json_encode($prefs), $user['id']]);
            }
            $msg = "Dein Code zum Zurücksetzen des Passworts lautet:\n\n    " . $code .
                   "\n\n(gültig 15 Minuten)\n\n" . Settings::get('verein_name','');
            @mail($user['email'], Settings::get('verein_name','') . ' – Passwort zurücksetzen', $msg,
                  "From: " . Settings::get('noreply_email','') . "\r\nContent-Type: text/plain; charset=utf-8");
        }
        jsonOk('Falls ein Konto mit dieser E-Mail existiert, wurde ein Code gesendet.');
    }

    // ── Passwort vergessen – Schritt 2: Code prüfen + Passwort setzen ────────
    if ($method === 'POST' && $id === 'reset-confirm') {
        $email   = strtolower(trim($body['email'] ?? ''));
        $code    = trim($body['code'] ?? '');
        $newPw   = $body['passwort'] ?? '';
        if (!$email || !$code || !$newPw) jsonErr('Alle Felder erforderlich.');
        if (strlen($newPw) < 12) jsonErr('Passwort muss mindestens 12 Zeichen haben.');
        $user = DB::fetchOne('SELECT id, prefs, reset_code_hash, reset_code_expires FROM ' . DB::tbl('benutzer') . ' WHERE email=? AND aktiv=1 AND geloescht_am IS NULL', [$email]);
        if (!$user) jsonErr('Ungültiger oder abgelaufener Code.', 400);
        // Code aus reset_code_hash oder prefs lesen
        $storedHash    = $user['reset_code_hash'] ?? null;
        $storedExpires = $user['reset_code_expires'] ?? null;
        if (!$storedHash) {
            $prefs = json_decode($user['prefs'] ?? '{}', true) ?: [];
            $storedHash    = $prefs['_reset']['h'] ?? null;
            $storedExpires = $prefs['_reset']['e'] ?? null;
        }
        if (!$storedHash || !$storedExpires) jsonErr('Kein Reset-Code angefordert.', 400);
        if (strtotime($storedExpires) < time()) jsonErr('Code abgelaufen. Bitte erneut anfordern.', 400);
        if (!password_verify($code, $storedHash)) jsonErr('Ungültiger Code.', 400);
        // Passwort setzen + Code löschen
        $hash = Auth::hashPasswort($newPw);
        try {
            DB::query('UPDATE ' . DB::tbl('benutzer') . ' SET passwort=?, reset_code_hash=NULL, reset_code_expires=NULL WHERE id=?', [$hash, $user['id']]);
        } catch (\Exception $e) {
            // Fallback: prefs-Reset löschen
            $prefs = json_decode($user['prefs'] ?? '{}', true) ?: [];
            unset($prefs['_reset']);
            DB::query('UPDATE ' . DB::tbl('benutzer') . ' SET passwort=?, prefs=? WHERE id=?', [$hash, json_encode($prefs), $user['id']]);
        }
        jsonOk('Passwort wurde erfolgreich geändert.');
    }

    // Admin: alle Registrierungen abrufen
    if ($method === 'GET' && $id === 'registrierungen') {
        Auth::requireAdmin();
        $rows = DB::fetchAll(
            'SELECT id, email, name, status, email_verifiziert, totp_aktiv, email_login_bevorzugt, erstellt_am
             FROM ' . DB::tbl('registrierungen') . ' ORDER BY erstellt_am DESC'
        );
        // Bereits zugeordnete Athleten-IDs ermitteln
        $zugeordnet = DB::fetchAll('SELECT athlet_id FROM ' . DB::tbl('benutzer') . ' WHERE athlet_id IS NOT NULL');
        $zugeordneteIds = array_column($zugeordnet, 'athlet_id');
        jsonOk(['registrierungen' => $rows, 'zugeordnete_athleten' => $zugeordneteIds]);
    }

    // Admin: Registrierung genehmigen
    if ($method === 'POST' && ($parts[3] ?? '') === 'genehmigen') {
        Auth::requireAdmin();
        $regId    = (int)($parts[2] ?? 0);
        $athletId = !empty($body['athlet_id']) ? (int)$body['athlet_id'] : null;
        $reg = DB::fetchOne('SELECT * FROM ' . DB::tbl('registrierungen') . ' WHERE id = ?', [$regId]);
        if (!$reg) jsonErr('Registrierung nicht gefunden.');
        if ($reg['status'] !== 'pending') jsonErr('Bereits bearbeitet.');

        // Benutzerkonto anlegen
        // benutzername = E-Mail (primäre Kennung, kein separater Nickname mehr)
        $bname = $reg['email'];
        // email_login_bevorzugt: kein TOTP wenn User E-Mail-Code gewählt hat
        $useEmailLogin = !empty($reg['email_login_bevorzugt']);
        DB::query(
            'INSERT INTO ' . DB::tbl('benutzer') . ' (benutzername, email, passwort, rolle, aktiv, totp_secret, totp_aktiv, totp_backup, athlet_id, email_login_bevorzugt)
             VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?)',
            [$bname, $reg['email'], $reg['passwort_hash'], $athletId ? 'athlet' : 'leser',
             $useEmailLogin ? null : $reg['totp_secret'],
             $useEmailLogin ? 0 : 1,
             $useEmailLogin ? '[]' : '[]',
             $athletId, $useEmailLogin ? 1 : 0]
        );
        DB::query('UPDATE ' . DB::tbl('registrierungen') . ' SET status = ? WHERE id = ?', ['approved', $regId]);

        // Benachrichtigungs-Mail
        $msg = "Hallo " . $reg['name'] . ",\n\ndeine Registrierung wurde genehmigt!\n\n" .
               "Benutzername: " . $bname . "\n\nDu kannst dich jetzt einloggen.\n\n" . Settings::get('verein_name','Mein Verein e.V.');
        @mail($reg['email'], Settings::get('verein_name','Mein Verein e.V.') . ' – Registrierung genehmigt', $msg,
              "From: " . Settings::get('noreply_email','') . "\r\nContent-Type: text/plain; charset=utf-8");

        jsonOk(['benutzername' => $bname]);
    }

    // Admin: Registrierung ablehnen
    if ($method === 'POST' && ($parts[3] ?? '') === 'ablehnen') {
        Auth::requireAdmin();
        $regId = (int)($parts[2] ?? 0);
        DB::query('UPDATE ' . DB::tbl('registrierungen') . ' SET status = ? WHERE id = ?', ['rejected', $regId]);

        $reg = DB::fetchOne('SELECT email, name FROM ' . DB::tbl('registrierungen') . ' WHERE id = ?', [$regId]);
        if ($reg) {
            $msg = "Hallo " . $reg['name'] . ",\n\nleider wurde deine Registrierungsanfrage abgelehnt.\n\n" .
                   "Bei Fragen wende dich an den Verein.\n\n" . Settings::get('verein_name','Mein Verein e.V.');
            @mail($reg['email'], Settings::get('verein_name','Mein Verein e.V.') . ' – Registrierung abgelehnt', $msg,
                  "From: " . Settings::get('noreply_email','') . "\r\nContent-Type: text/plain; charset=utf-8");
        }
        jsonOk('Abgelehnt.');
    }
}

// ============================================================
// UPLOAD – Logo (nur Admin)
// ============================================================

// ── Favicon-Generierung aus GD-Image ──────────────────────────────────────
function generateIco(array $gdImages): string {
    $entries = [];
    $bitmaps = [];
    $offset  = 6 + count($gdImages) * 16;
    foreach ($gdImages as $img) {
        $w = imagesx($img); $h = imagesy($img);
        ob_start(); imagepng($img); $png = ob_get_clean();
        $len = strlen($png);
        $entries[] = pack('CCCCSSII',
            $w >= 256 ? 0 : $w, $h >= 256 ? 0 : $h,
            0, 0, 1, 32, $len, $offset);
        $bitmaps[] = $png;
        $offset += $len;
    }
    $ico = pack('SSS', 0, 1, count($gdImages));
    foreach ($entries as $e) $ico .= $e;
    foreach ($bitmaps as $b) $ico .= $b;
    return $ico;
}

if ($res === 'upload' && $id === 'logo') {
    Auth::requireAdmin();
    if ($method !== 'POST' && $method !== 'DELETE') jsonErr('Methode nicht erlaubt.', 405);

    // Logo löschen
    if ($method === 'DELETE') {
        foreach (['png','jpg','gif','svg','webp'] as $e) {
            $alt = __DIR__ . '/../uploads/logo.' . $e;
            if (file_exists($alt)) @unlink($alt);
        }
        // favicon.ico, favicon.svg, apple-touch-icon.png ebenfalls löschen
        foreach (['favicon.ico', 'favicon.svg', 'apple-touch-icon.png'] as $fn) {
            $f = __DIR__ . '/../' . $fn;
            if (file_exists($f)) @unlink($f);
        }
        Settings::set('logo_datei', '');
        jsonOk('Logo gelöscht.');
    }

    $file = $_FILES['logo'] ?? null;
    if (!$file || $file['error'] !== UPLOAD_ERR_OK) {
        jsonErr('Kein Bild empfangen oder Upload-Fehler.');
    }

    // Typ prüfen – nur Bilder erlaubt
    $erlaubteTypes = ['image/png' => 'png', 'image/jpeg' => 'jpg',
                      'image/gif' => 'gif', 'image/svg+xml' => 'svg',
                      'image/webp' => 'webp'];
    $mime = mime_content_type($file['tmp_name']);
    if (!isset($erlaubteTypes[$mime])) {
        jsonErr('Nur PNG, JPG, GIF, SVG und WebP sind erlaubt.');
    }

    // Maximalgröße: 2 MB
    if ($file['size'] > 2 * 1024 * 1024) {
        jsonErr('Datei zu groß (max. 2 MB).');
    }

    $ext     = $erlaubteTypes[$mime];
    $ziel    = __DIR__ . '/../uploads/logo.' . $ext;

    // Alte Logo-Dateien löschen
    foreach (['png','jpg','gif','svg','webp'] as $e) {
        $alt = __DIR__ . '/../uploads/logo.' . $e;
        if (file_exists($alt)) @unlink($alt);
    }

    if (!move_uploaded_file($file['tmp_name'], $ziel)) {
        jsonErr('Speichern fehlgeschlagen.');
    }

    $pfad = 'uploads/logo.' . $ext;
    Settings::set('logo_datei', $pfad);

    // Favicons aus Logo generieren
    $htdocsRoot = __DIR__ . '/..';
    if ($ext === 'svg') {
        // SVG: direkt als favicon.svg kopieren (Browser nutzen es nativ)
        @copy($ziel, $htdocsRoot . '/favicon.svg');
        // favicon.ico + apple-touch-icon aus SVG können wir serverseitig nicht ohne
        // externe Bibliothek rastern → vorhandene Dateien löschen damit kein Mismatch
        @unlink($htdocsRoot . '/favicon.ico');
        @unlink($htdocsRoot . '/apple-touch-icon.png');
    } elseif (function_exists('imagecreatefromstring')) {
        $src = @imagecreatefromstring(file_get_contents($ziel));
        if ($src) {
            $ow = imagesx($src); $oh = imagesy($src);
            // Quadratisch zuschneiden (zentriert)
            $side = min($ow, $oh);
            $sx = (int)(($ow - $side) / 2);
            $sy = (int)(($oh - $side) / 2);

            // Hilfsfunktion: skaliertes Bild erzeugen
            $makeScaled = function(int $sz) use ($src, $ow, $oh, $side, $sx, $sy) {
                $dst = imagecreatetruecolor($sz, $sz);
                imagealphablending($dst, false);
                imagesavealpha($dst, true);
                $transparent = imagecolorallocatealpha($dst, 0, 0, 0, 127);
                imagefill($dst, 0, 0, $transparent);
                imagecopyresampled($dst, $src, 0, 0, $sx, $sy, $sz, $sz, $side, $side);
                return $dst;
            };

            // favicon.ico (16, 32, 48 px)
            $icoImages = [];
            foreach ([16, 32, 48] as $sz) $icoImages[] = $makeScaled($sz);
            $icoData = generateIco($icoImages);
            foreach ($icoImages as $img) imagedestroy($img);
            @file_put_contents($htdocsRoot . '/favicon.ico', $icoData);

            // apple-touch-icon.png (180 px) – für Safari Favoriten / Homescreen
            $icon180 = $makeScaled(180);
            ob_start(); imagepng($icon180); $pngData = ob_get_clean();
            imagedestroy($icon180);
            @file_put_contents($htdocsRoot . '/apple-touch-icon.png', $pngData);

            // favicon.svg löschen falls vorher ein SVG-Logo aktiv war
            @unlink($htdocsRoot . '/favicon.svg');

            imagedestroy($src);
        }
    }

    jsonOk(['pfad' => $pfad]);
}

// ============================================================
// UPLOAD – Avatar (eigener Benutzer)
// ============================================================
if ($res === 'upload' && $id === 'avatar') {
    $user = Auth::requireLogin();
    if ($method !== 'POST' && $method !== 'DELETE') jsonErr('Methode nicht erlaubt.', 405);

    $uid    = (int)$user['id'];
    $prefix = 'avatar_' . $uid;

    if ($method === 'DELETE') {
        foreach (['png','jpg','webp','jpeg'] as $e) {
            $f = __DIR__ . '/../uploads/' . $prefix . '.' . $e;
            if (file_exists($f)) @unlink($f);
        }
        try { DB::query('UPDATE ' . DB::tbl('benutzer') . ' SET avatar_pfad = NULL WHERE id = ?', [$uid]); } catch (\Exception $e) {}
        jsonOk('Avatar gelöscht.');
    }

    $file = $_FILES['avatar'] ?? null;
    if (!$file || $file['error'] !== UPLOAD_ERR_OK) {
        $errMsg = ['','Datei zu groß (PHP)','Datei zu groß (HTML)','Teilweise hochgeladen','Keine Datei','','Kein temp-Verzeichnis','Schreibfehler'];
        jsonErr('Upload-Fehler: ' . ($errMsg[$file['error'] ?? 0] ?? 'Unbekannt'));
    }

    // Nur Rastergrafiken (kein SVG)
    $erlaubteTypes = ['image/png'=>'png','image/jpeg'=>'jpg','image/webp'=>'webp','image/gif'=>'gif'];
    $mime = mime_content_type($file['tmp_name']);
    if (!isset($erlaubteTypes[$mime])) jsonErr('Nur PNG, JPG, WebP oder GIF sind erlaubt.');

    // Max 10 MB
    if ($file['size'] > 10 * 1024 * 1024) jsonErr('Datei zu groß (max. 10 MB).');

    // Alte Avatare löschen
    foreach (['png','jpg','webp','jpeg','gif'] as $e) {
        $alt = __DIR__ . '/../uploads/' . $prefix . '.' . $e;
        if (file_exists($alt)) @unlink($alt);
    }

    // Bild optimieren mit GD (auf 400×400 verkleinern, als JPEG speichern)
    $ziel = __DIR__ . '/../uploads/' . $prefix . '.jpg';
    $saved = false;
    if (function_exists('imagecreatefromstring')) {
        $src = @imagecreatefromstring(file_get_contents($file['tmp_name']));
        if ($src) {
            $ow = imagesx($src); $oh = imagesy($src);
            $maxSize = 400;
            // Crop-Koordinaten aus POST (optional, vom Frontend-Cropper)
            $cx = isset($_POST['cx']) ? (int)$_POST['cx'] : 0;
            $cy = isset($_POST['cy']) ? (int)$_POST['cy'] : 0;
            $cw = isset($_POST['cw']) ? (int)$_POST['cw'] : $ow;
            $ch = isset($_POST['ch']) ? (int)$_POST['ch'] : $oh;
            // Sicherstellen dass Crop-Werte valide
            $cx = max(0, min($cx, $ow-1));
            $cy = max(0, min($cy, $oh-1));
            $cw = max(1, min($cw, $ow-$cx));
            $ch = max(1, min($ch, $oh-$cy));
            // Zielgröße: quadratisch, max 400px
            $outSize = min($cw, $ch, $maxSize);
            $dst = imagecreatetruecolor($outSize, $outSize);
            imagecopyresampled($dst, $src, 0, 0, $cx, $cy, $outSize, $outSize, $cw, $ch);
            imagedestroy($src);
            if (@imagejpeg($dst, $ziel, 88)) $saved = true;
            imagedestroy($dst);
        }
    }
    // Fallback: Datei direkt speichern ohne Optimierung
    if (!$saved) {
        $ext  = $erlaubteTypes[$mime];
        $ziel = __DIR__ . '/../uploads/' . $prefix . '.' . $ext;
        if (!move_uploaded_file($file['tmp_name'], $ziel)) jsonErr('Speichern fehlgeschlagen.');
    }

    $pfad = 'uploads/' . $prefix . '.jpg';
    if (!$saved) $pfad = 'uploads/' . $prefix . '.' . ($erlaubteTypes[$mime] ?? 'jpg');
    try { DB::query('UPDATE ' . DB::tbl('benutzer') . ' SET avatar_pfad = ? WHERE id = ?', [$pfad, $uid]); } catch (\Exception $e) {}
    jsonOk(['pfad' => $pfad]);
}

// ============================================================
// ADMIN DASHBOARD
// ============================================================
if ($res === 'admin-dashboard' && $method === 'GET') {
    $adminUser = Auth::requireAdmin(); // $adminUser['id'] ist die sichere User-ID

    // 1. System-Info
    $phpVersion = PHP_VERSION;
    $dbVersion = 'unbekannt';
    try { $dbVersion = DB::fetchOne('SELECT VERSION() AS v')['v'] ?? 'unbekannt'; } catch (\Exception $e) {}

    // DB-Größe in MB
    $dbSize = null;
    try {
        $dbName = DB::fetchOne('SELECT DATABASE() AS d')['d'] ?? null;
        if ($dbName) {
            $row = DB::fetchOne(
                "SELECT ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS mb
                 FROM information_schema.tables WHERE table_schema = ?", [$dbName]
            );
            $dbSize = (float)($row['mb'] ?? 0);
        }
    } catch (\Exception $e) {}

    // 2. Aktive Benutzer: aktueller Admin + seitenaufrufe der letzten 10 Min
    $aktiveBenutzer = [];
    $geseheneIds = [];
    $__myUid = (int)($adminUser['id'] ?? 0); // aus requireAdmin() – sicher
    if ($__myUid) {
        try {
            $meRow = DB::fetchOne('SELECT b.id, b.benutzername, b.email, b.rolle, b.avatar_pfad FROM ' . DB::tbl('benutzer') . ' b WHERE b.id=? AND b.aktiv=1', [$__myUid]);
            if ($meRow) {
                // Name aus verknüpftem Athletenprofil laden
                $meName = $meRow['email'] ?? $meRow['benutzername'];
                try { $ath = DB::fetchOne('SELECT CONCAT(vorname,\' \',nachname) AS n FROM ' . DB::tbl('athleten') . ' a JOIN ' . DB::tbl('benutzer') . ' b2 ON b2.athlet_id=a.id WHERE b2.id=?', [$__myUid]); if ($ath && trim($ath['n'])) $meName = trim($ath['n']); } catch(\Exception $e) {}
                $aktiveBenutzer[] = ['id' => (int)$meRow['id'], 'name' => $meName, 'rolle' => $meRow['rolle'], 'seit' => date('Y-m-d H:i:s'), 'avatar' => $meRow['avatar_pfad']];
                $geseheneIds[$__myUid] = true;
            }
        } catch (\Exception $e) {}
    }
    try {
        $rows = DB::fetchAll(
            "SELECT b.id, b.benutzername, b.email, b.rolle,
                    MAX(s.erstellt_am) AS letzter_aktivitaet, b.avatar_pfad,
                    CONCAT(MAX(a.vorname), ' ', MAX(a.nachname)) AS athlet_name
             FROM " . DB::tbl('seitenaufrufe') . " s
             JOIN " . DB::tbl('benutzer') . " b ON b.id = s.benutzer_id
             LEFT JOIN " . DB::tbl('athleten') . " a ON a.id = b.athlet_id
             WHERE s.erstellt_am >= DATE_SUB(NOW(), INTERVAL 10 MINUTE)
               AND b.aktiv = 1
             GROUP BY b.id
             ORDER BY letzter_aktivitaet DESC"
        );
        foreach ($rows as $r) {
            if (!empty($geseheneIds[(int)$r['id']])) continue;
            $aktiveBenutzer[] = [
                'id'          => (int)$r['id'],
                'name'        => (isset($r['athlet_name']) && trim($r['athlet_name']) !== ' ') ? trim($r['athlet_name']) : ($r['email'] ?? $r['benutzername']),
                'benutzername'=> $r['benutzername'],
                'rolle'       => $r['rolle'],
                'seit'        => $r['letzter_aktivitaet'],
                'avatar'      => $r['avatar_pfad'],
            ];
        }
    } catch (\Exception $e) {}

    // 3. Gäste + Besucher (letzten 15 Min aus seitenaufrufe, benutzer_id=NULL)
    $gaeste = [];
    try {
        $gRows = DB::fetchAll(
            "SELECT ip, user_agent, MAX(erstellt_am) AS zuletzt, COUNT(*) AS aufrufe
             FROM " . DB::tbl('seitenaufrufe') . "
             WHERE benutzer_id IS NULL AND erstellt_am >= DATE_SUB(NOW(), INTERVAL 15 MINUTE)
             GROUP BY ip, user_agent ORDER BY zuletzt DESC LIMIT 50"
        );
        // GeoIP via ip-api.com (server-seitig, HTTP erlaubt, max 45/min)
        $geoCache = [];
        foreach ($gRows as $g) {
            $ip = $g['ip'] ?? null;
            $country = null;
            if ($ip && !in_array($ip, ['127.0.0.1','::1']) && !str_starts_with($ip,'192.168.') && !str_starts_with($ip,'10.')) {
                if (!isset($geoCache[$ip])) {
                    try {
                        $ctx = stream_context_create(['http' => ['timeout' => 2, 'ignore_errors' => true]]);
                        $json = @file_get_contents('http://ip-api.com/json/' . urlencode($ip) . '?fields=country,countryCode,city&lang=de', false, $ctx);
                        $geo  = $json ? json_decode($json, true) : null;
                        $geoCache[$ip] = ($geo && ($geo['status'] ?? '') !== 'fail') ? $geo : null;
                    } catch (\Exception $e) { $geoCache[$ip] = null; }
                }
                $geo = $geoCache[$ip];
                if ($geo) {
                    $country     = trim(($geo['city'] ?? '') . ($geo['city'] ? ', ' : '') . ($geo['country'] ?? ''));
                    $countryCode = strtoupper($geo['countryCode'] ?? '');
                }
            }
            $gaeste[] = [
                'ip'          => $ip,
                'country'     => $country,
                'countryCode' => $countryCode ?? null,
                'user_agent'  => $g['user_agent'],
                'zuletzt'     => $g['zuletzt'],
                'aufrufe'     => (int)$g['aufrufe'],
            ];
        }
    } catch (\Exception $e) {}

    // 4. Letzte Login-Versuche – einfache Abfrage ohne JOIN
    $letzteLogins = [];
    try {
        // Login-Versuche der letzten 5 Tage
        $lvRows = DB::fetchAll(
            'SELECT lv.benutzername, lv.ip, lv.erfolg, lv.erstellt_am,'
            . ' COALESCE(lv.methode, NULL) AS methode'
            . ' FROM ' . DB::tbl('login_versuche') . ' lv'
            . ' WHERE lv.erstellt_am >= DATE_SUB(NOW(), INTERVAL 5 DAY)'
            . ' ORDER BY lv.erstellt_am DESC LIMIT 200'
        );
        // Benutzer-Namen per separater Abfrage (robust gegenüber fehlenden Spalten)
        $bNamen = [];
        try {
            $bRows = DB::fetchAll('SELECT benutzername, email, vorname, nachname, rolle FROM ' . DB::tbl('benutzer'));
            foreach ($bRows as $b) {
                $vn = trim(($b['vorname'] ?? '') . ' ' . ($b['nachname'] ?? ''));
                $entry = ['name' => $vn ?: ($b['email'] ?? $b['benutzername']), 'email' => $b['email'] ?? null, 'rolle' => $b['rolle'] ?? null];
                $bNamen[$b['benutzername']] = $entry;
                if (!empty($b['email'])) $bNamen[$b['email']] = $entry;
                // Athlet-Vorname als zusätzlicher Lookup (historische Einträge vor E-Mail-Migration)
                if (!empty($vn)) $bNamen[$vn] = $entry;
            }
        } catch (\Exception $e) {}
        // GeoIP-Cache
        $loginGeoCache = [];
        foreach ($lvRows as $l) {
            $lip = $l['ip'] ?? null;
            $lcountry = null; $lcountryCode = null;
            if ($lip && !in_array($lip, ['127.0.0.1','::1']) && substr($lip,0,8)!=='192.168.' && substr($lip,0,3)!=='10.') {
                if (!isset($loginGeoCache[$lip])) {
                    try { $ctx = stream_context_create(['http'=>['timeout'=>2,'ignore_errors'=>true]]); $gj = @file_get_contents('http://ip-api.com/json/'.urlencode($lip).'?fields=country,countryCode&lang=de',false,$ctx); $gg=$gj?json_decode($gj,true):null; $loginGeoCache[$lip]=($gg&&($gg['status']??'')!=='fail')?$gg:null; } catch(\Exception $e){ $loginGeoCache[$lip]=null; }
                }
                if ($loginGeoCache[$lip]) { $lcountry=$loginGeoCache[$lip]['country']??null; $lcountryCode=strtoupper($loginGeoCache[$lip]['countryCode']??''); }
            }
            $bInfo = $bNamen[$l['benutzername']] ?? null;
            $letzteLogins[] = [
                'benutzername'  => $l['benutzername'],
                'anzeigeName'   => $bInfo ? $bInfo['name'] : $l['benutzername'],
                'email'         => $bInfo['email'] ?? null,
                'rolle'         => $bInfo['rolle'] ?? null,
                'ip'            => $lip,
                'country'       => $lcountry,
                'countryCode'   => $lcountryCode,
                'erfolg'        => (bool)$l['erfolg'],
                'methode'       => $l['methode'] ?? null,
                'datum'         => $l['erstellt_am'],
            ];
        }
    } catch (\Exception $e) {}

        // 5. Zählstatistiken    // 5. Zählstatistiken – jede Abfrage separat try/catch
    $stats = [
        'benutzer'=>0,'aeltesterBenutzer'=>null,'neusterBenutzer'=>null,'neusterBenutzerDatum'=>null,
        'athleten'=>0,'athletenAktiv'=>0,'ergebnisse'=>0,'erstesErgebnisDatum'=>null,
        'ergebnisseProJahr'=>0,'veranstaltungen'=>0,'veranstaltungenProJahr'=>0,
        'externePBs'=>0,'importiert'=>0,'disziplinen'=>0,'portalSeit'=>null,
        'antraege'=>0,'registrierungen'=>0,'papierkorb'=>0
    ];
    try { $stats['benutzer'] = (int)(DB::fetchOne("SELECT COUNT(*) c FROM " . DB::tbl('benutzer') . " WHERE aktiv=1 AND geloescht_am IS NULL")['c'] ?? 0); } catch(\Exception $e) {}
    try { $r2 = DB::fetchOne("SELECT MIN(erstellt_am) AS d FROM " . DB::tbl('benutzer')); $stats['aeltesterBenutzer'] = $r2['d'] ?? null; $stats['portalSeit'] = $r2['d'] ?? null; } catch(\Exception $e) {}
    try { $nr = DB::fetchOne("SELECT benutzername, email, erstellt_am FROM " . DB::tbl('benutzer') . " WHERE aktiv=1 AND geloescht_am IS NULL ORDER BY erstellt_am DESC LIMIT 1"); $stats['neusterBenutzer'] = $nr ? ($nr['benutzername'] ?: $nr['email']) : null; $stats['neusterBenutzerDatum'] = $nr['erstellt_am'] ?? null; } catch(\Exception $e) {}
    try { $stats['athleten'] = (int)(DB::fetchOne("SELECT COUNT(*) c FROM " . DB::tbl('athleten') . " WHERE geloescht_am IS NULL")['c'] ?? 0); } catch(\Exception $e) {}
    try { $stats['athletenAktiv'] = (int)(DB::fetchOne("SELECT COUNT(*) c FROM " . DB::tbl('athleten') . " WHERE aktiv=1 AND geloescht_am IS NULL")['c'] ?? 0); } catch(\Exception $e) {}
    try { $stats['ergebnisse'] = (int)(DB::fetchOne("SELECT COUNT(*) c FROM " . DB::tbl('ergebnisse') . " WHERE geloescht_am IS NULL")['c'] ?? 0); } catch(\Exception $e) {}
    try { $ed = DB::fetchOne("SELECT MIN(v.datum) AS d FROM " . DB::tbl('ergebnisse') . " e JOIN " . DB::tbl('veranstaltungen') . " v ON v.id=e.veranstaltung_id WHERE e.geloescht_am IS NULL"); $stats['erstesErgebnisDatum'] = $ed['d'] ?? null; } catch(\Exception $e) {}
    if ($stats['erstesErgebnisDatum'] && $stats['ergebnisse']) { $years = max(1,(time()-strtotime($stats['erstesErgebnisDatum']))/31557600); $stats['ergebnisseProJahr'] = round($stats['ergebnisse']/$years,1); }
    try { $stats['veranstaltungen'] = (int)(DB::fetchOne("SELECT COUNT(*) c FROM " . DB::tbl('veranstaltungen') . " WHERE geloescht_am IS NULL")['c'] ?? 0); } catch(\Exception $e) {}
    if ($stats['erstesErgebnisDatum'] && $stats['veranstaltungen']) { $years2 = max(1,(time()-strtotime($stats['erstesErgebnisDatum']))/31557600); $stats['veranstaltungenProJahr'] = round($stats['veranstaltungen']/$years2,1); }
    try { $stats['externePBs'] = (int)(DB::fetchOne("SELECT COUNT(*) c FROM " . DB::tbl('athlet_pb'))['c'] ?? 0); } catch(\Exception $e) {}
    try { $stats['importiert'] = (int)(DB::fetchOne("SELECT COUNT(*) c FROM " . DB::tbl('ergebnisse') . " WHERE import_quelle IS NOT NULL AND geloescht_am IS NULL")['c'] ?? 0); } catch(\Exception $e) {}
    try { $stats['disziplinen'] = (int)(DB::fetchOne("SELECT COUNT(*) c FROM " . DB::tbl('disziplin_mapping'))['c'] ?? 0); } catch(\Exception $e) {}
    try { $stats['antraege'] = (int)(DB::fetchOne("SELECT COUNT(*) c FROM " . DB::tbl('ergebnis_aenderungen') . " WHERE status='pending'")['c'] ?? 0); } catch(\Exception $e) {}
    try { $hasRegTbl = DB::fetchOne("SHOW TABLES LIKE '" . DB::tbl('registrierungen') . "'"); $stats['registrierungen'] = $hasRegTbl ? (int)(DB::fetchOne("SELECT COUNT(*) c FROM " . DB::tbl('registrierungen') . " WHERE status='pending'")['c'] ?? 0) : 0; } catch(\Exception $e) {}
    try { $stats['papierkorb'] = (int)(DB::fetchOne("SELECT COUNT(*) c FROM " . DB::tbl('ergebnisse') . " WHERE geloescht_am IS NOT NULL")['c'] ?? 0); } catch(\Exception $e) {}

    // 6. Seitenaufrufe heute vs. gestern
    $aufrufe = [];
    try {
        $aufrufe['heute']    = (int)(DB::fetchOne("SELECT COUNT(*) c FROM " . DB::tbl('seitenaufrufe') . " WHERE DATE(erstellt_am)=CURDATE()")['c'] ?? 0);
        $aufrufe['gestern']  = (int)(DB::fetchOne("SELECT COUNT(*) c FROM " . DB::tbl('seitenaufrufe') . " WHERE DATE(erstellt_am)=DATE_SUB(CURDATE(),INTERVAL 1 DAY)")['c'] ?? 0);
        $aufrufe['7tage']    = (int)(DB::fetchOne("SELECT COUNT(*) c FROM " . DB::tbl('seitenaufrufe') . " WHERE erstellt_am >= DATE_SUB(NOW(),INTERVAL 7 DAY)")['c'] ?? 0);
    } catch (\Exception $e) {}

    jsonOk(compact('phpVersion','dbVersion','dbSize','aktiveBenutzer','gaeste','letzteLogins','stats','aufrufe'));
}

// ============================================================
// EINSTELLUNGEN (öffentlich lesbar, Schreiben nur Admin)
// ============================================================
if ($res === 'einstellungen') {
    // Öffentliche Konfig (alle Einstellungen ohne Auth lesbar – kein Geheimnis)
    if ($method === 'GET' && !$id) {
        $cfg = Settings::all();
        // Rollennamen/Labels immer mitsenden (für rolleLabel() im Frontend)
        try {
            $rollenRows = DB::fetchAll('SELECT name, label, oeffentlich FROM ' . DB::tbl('rollen'));
            $cfg['rollen_labels'] = $rollenRows;
        } catch (\Exception $e) { $cfg['rollen_labels'] = []; }
        jsonOk($cfg);
    }
    // Einzelne Einstellung (Admin)
    if ($method === 'PUT' || $method === 'POST') {
        Auth::requireAdmin();
        if ($id) {
            // PUT einstellungen/{schluessel}
            $wert = $body['wert'] ?? '';
            Settings::set(urldecode($id), (string)$wert);
            jsonOk('Gespeichert.');
        } else {
            // POST einstellungen – mehrere auf einmal
            $erlaubt = [
                'verein_name','verein_kuerzel','app_untertitel','logo_datei',
                'email_domain','noreply_email',
                'farbe_primary','farbe_accent',
                'dashboard_timeline_limit','registrierung_auto_freigabe','version_nur_admins',
                'adressleiste_farbe','dashboard_layout',
                'footer_datenschutz_url','footer_nutzung_url','footer_impressum_url','github_repo','github_token','github_token_expires',
                'disziplin_kategorie_suffix',
                'footer_datenschutz_text','footer_nutzung_text','footer_impressum_text',
                'jugend_aks',
                'wartung_aktiv','wartung_nachricht',
                'kategoriegruppen',
                'meisterschaften_liste',
                'top_disziplinen',
                'login_portal_aktiv','login_portal_url','login_portal_apps','passkey_rp_id',
            ];
            $save = [];
            foreach ($erlaubt as $k) {
                if (isset($body[$k])) $save[$k] = (string)$body[$k];
            }
            if (!$save) jsonErr('Keine gültigen Felder.');
            Settings::setMany($save);
            jsonOk('Gespeichert.');
        }
    }
    // Mit Metadaten (Admin-UI)
    if ($method === 'GET' && $id === 'meta') {
        Auth::requireAdmin();
        jsonOk(Settings::allWithMeta());
    }
}

// Hilfsfunktion: AK-CASE-Expression aus Settings oder Fallback-Hardcode
function buildAkCaseExpr(bool $merge, string $alias = 'e'): string {
    if (!$merge) return $alias . '.altersklasse';

    // jugend_aks zuerst laden (haben Priorität vor ak_mapping)
    $jugendAksJson = Settings::get('jugend_aks') ?: '';
    $jugendAks = $jugendAksJson ? (json_decode($jugendAksJson, true) ?: []) : [];
    if (empty($jugendAks)) {
        $jugendAks = ['MHK','M','MU8','MU10-12','MU18','MU20','MU23','mJB','mjA','mjB','U18',
                      'WHK','W','F','WU8','WU10-U12','WU18','WU23','wjA','wjB'];
    }
    $mAks = []; $wAks = [];
    foreach ($jugendAks as $ak) {
        if (strtoupper(substr($ak,0,1)) === 'W' || in_array($ak, ['F'])) $wAks[] = $ak;
        else $mAks[] = $ak;
    }

    // ak_mapping: Normalisierung von Nicht-Standard-AKs; jugend_aks-Zielwerte werden
    // direkt zu MHK/WHK aufgelöst, damit jugend_aks nicht durch ak_mapping umgangen wird.
    $mappingCases = '';
    try {
        $maps = DB::fetchAll("SELECT ak_roh, ak_standard FROM " . DB::tbl('ak_mapping'));
        foreach ($maps as $m) {
            $roh = addslashes($m['ak_roh']);
            $std = $m['ak_standard'];
            if (in_array($std, $mAks)) {
                $mappingCases .= "WHEN $alias.altersklasse='" . $roh . "' THEN 'MHK'\n        ";
            } elseif (in_array($std, $wAks)) {
                $mappingCases .= "WHEN $alias.altersklasse='" . $roh . "' THEN 'WHK'\n        ";
            } else {
                $mappingCases .= "WHEN $alias.altersklasse='" . $roh . "' THEN '" . addslashes($std) . "'\n        ";
            }
        }
    } catch (Exception $e) {}

    $mList = implode("','", array_map('addslashes', $mAks));
    $wList = implode("','", array_map('addslashes', $wAks));
    // jugend_aks IN-Clauses kommen VOR ak_mapping, damit explizit konfigurierte
    // Jugend-AKs nicht durch einen ak_mapping-Eintrag (z.B. AK→AK selbst) blockiert werden.
    return "CASE\n        "
        . "WHEN $alias.altersklasse IN ('$mList') THEN 'MHK'\n"
        . "        WHEN $alias.altersklasse IN ('$wList') THEN 'WHK'\n"
        . "        {$mappingCases}"
        . "ELSE $alias.altersklasse END";
}

// Einmalig: resultat_num für Altdaten nachberechnen (Zeitformate H:MM:SS)
// Läuft nur wenn noch NULL-Einträge vorhanden sind
function migrateResultatNum(): void {
    try {
        $tbl = DB::tbl('ergebnisse');
        $cnt = DB::fetchOne("SELECT COUNT(*) AS c FROM $tbl WHERE resultat_num IS NULL AND resultat REGEXP '^[0-9]{1,2}:[0-9]{2}'");
        if (!$cnt || (int)$cnt['c'] === 0) return;
        // MAX 500 pro Request um Timeout zu vermeiden
        DB::query("UPDATE $tbl SET resultat_num = TIME_TO_SEC(resultat) WHERE resultat_num IS NULL AND resultat REGEXP '^[0-9]{1,2}:[0-9]{2}:[0-9]{2}' LIMIT 500");
        DB::query("UPDATE $tbl SET resultat_num = TIME_TO_SEC(CONCAT('00:', resultat)) WHERE resultat_num IS NULL AND resultat REGEXP '^[0-9]{1,2}:[0-9]{2}$' LIMIT 500");
        // Zeiten normalisieren: "4:28:29" → "04:28:29"
        DB::query("UPDATE $tbl SET resultat = CONCAT(LPAD(SUBSTRING_INDEX(resultat,':',1),2,'0'), SUBSTRING(resultat, LOCATE(':',resultat))) WHERE resultat_num IS NOT NULL AND resultat REGEXP '^[0-9]:[0-9]{2}:' LIMIT 500");
    } catch (Exception $e) { /* ignorieren */ }
}
// Einmalig: MM:SS-Zeiten mit MM≥60 → H:MM:SS normalisieren (z.B. "64:30" → "01:04:30")
function migrateNormalizeOverflowTimes(): void {
    try {
        $tables = [DB::tbl('ergebnisse'), DB::tbl('athlet_pb')];
        foreach ($tables as $tbl) {
            DB::query(
                "UPDATE $tbl SET resultat = CONCAT(
                    LPAD(CAST(SUBSTRING_INDEX(resultat,':',1) AS UNSIGNED) DIV 60, 2, '0'), ':',
                    LPAD(CAST(SUBSTRING_INDEX(resultat,':',1) AS UNSIGNED) MOD 60, 2, '0'), ':',
                    LPAD(CAST(SUBSTRING_INDEX(resultat,':',-1) AS UNSIGNED), 2, '0')
                 )
                 WHERE resultat REGEXP '^[0-9]{2,3}:[0-9]{2}$'
                   AND CAST(SUBSTRING_INDEX(resultat,':',1) AS UNSIGNED) >= 60
                 LIMIT 500"
            );
        }
    } catch (Exception $e) { /* ignorieren */ }
}
migrateResultatNum();
migrateNormalizeOverflowTimes();

// Hilfsfunktion: Zeit-String normalisieren und resultat_num berechnen
// "4:28:29" → "04:28:29", gibt [normalisiert, sekunden] zurück
function normalizeResultat(string $r, string $fmt = 'min'): array {
    $r = trim($r);
    if ($fmt === 'm' || is_numeric($r)) {
        // Meter/numerisch: unverändert
        return [$r, is_numeric($r) ? (float)$r : null];
    }
    // Zeitformat: H:MM:SS oder MM:SS
    if (preg_match('/^(\d{1,2}):(\d{2}):(\d{2})$/', $r, $m)) {
        $h = (int)$m[1]; $min = (int)$m[2]; $sec = (int)$m[3];
        $norm = sprintf('%02d:%02d:%02d', $h, $min, $sec);
        return [$norm, $h*3600 + $min*60 + $sec];
    }
    if (preg_match('/^(\d{1,3}):(\d{2})$/', $r, $m)) {
        $min = (int)$m[1]; $sec = (int)$m[2];
        if ($min >= 60) {
            $h = intdiv($min, 60); $min = $min % 60;
            $norm = sprintf('%02d:%02d:%02d', $h, $min, $sec);
            return [$norm, $h*3600 + $min*60 + $sec];
        }
        $norm = sprintf('%02d:%02d', $min, $sec);
        return [$norm, $min*60 + $sec];
    }
    return [$r, null];
}

if ($res === 'altersklassen' && $method === 'GET') {
    Auth::requireAdmin();
    $rows = DB::fetchAll(
        "SELECT e.altersklasse, COUNT(*) AS anzahl
         FROM " . DB::tbl('ergebnisse') . " e
         WHERE e.altersklasse IS NOT NULL AND e.altersklasse != '' AND e.geloescht_am IS NULL
         GROUP BY e.altersklasse
         ORDER BY e.altersklasse ASC"
    );
    // Aktuelle Jugend-AK-Konfiguration laden
    $jugendAksJson = Settings::get('jugend_aks') ?: '';
    $jugendAks = $jugendAksJson ? (json_decode($jugendAksJson, true) ?: []) : [];
    foreach ($rows as &$row) {
        $row['is_jugend'] = in_array($row['altersklasse'], $jugendAks);
    }
    unset($row);
    jsonOk($rows);
}

// ============================================================
// BENUTZER (nur Admin)
// ============================================================
if ($res === 'benutzer') {
    $user = Auth::requireAdmin();

    if ($method === 'GET' && !$id) {
        // Versuche mit athlet_id JOIN, Fallback ohne (falls Migration noch nicht ausgeführt)
        try {
            $rows = DB::fetchAll(
                'SELECT b.id, b.benutzername, b.email, b.rolle, b.aktiv,
                        b.erstellt_am, b.letzter_login, b.athlet_id,
                        b.avatar_pfad, b.email_login_bevorzugt, b.totp_aktiv,
                        a.name_nv AS athlet_name,
                        a.vorname  AS athlet_vorname,
                        a.nachname AS athlet_nachname,
                        COALESCE(NULLIF(TRIM(CONCAT(a.vorname,\' \',a.nachname)),\'\'),b.email) AS name,
                        (SELECT COUNT(*) FROM ' . DB::tbl('passkeys') . ' p WHERE p.user_id = b.id) AS passkey_count
                 FROM ' . DB::tbl('benutzer') . ' b
                 LEFT JOIN ' . DB::tbl('athleten') . ' a ON a.id = b.athlet_id
                 WHERE b.geloescht_am IS NULL
                 ORDER BY b.email'
            );
        } catch (\Exception $e) {
            $rows = DB::fetchAll(
                'SELECT id, benutzername, email, rolle, aktiv,
                        erstellt_am, letzter_login,
                        NULL AS athlet_id, NULL AS athlet_name
                 FROM ' . DB::tbl('benutzer') . ' ORDER BY benutzername'
            );
        }
        $athleten = DB::fetchAll('SELECT id, name_nv, geschlecht FROM ' . DB::tbl('athleten') . ' WHERE aktiv=1 ORDER BY name_nv');
        jsonOk(['benutzer' => $rows, 'athleten' => $athleten]);
    }
    if ($method === 'POST') {
        $email = strtolower(trim($body['email'] ?? ''));
        $bname = sanitize($body['benutzername'] ?? '') ?: $email;
        $pw    = $body['passwort'] ?? '';
        $rolle = in_array($body['rolle'] ?? '', ['admin','editor','athlet','leser']) ? $body['rolle'] : 'leser';
        if (!$email || strlen($pw) < 8)
            jsonErr('Benutzername, E-Mail und Passwort (min. 8 Zeichen) erforderlich.');
        try {
            DB::query('INSERT INTO ' . DB::tbl('benutzer') . ' (benutzername,email,passwort,rolle) VALUES (?,?,?,?)',
                [$bname, $email, Auth::hashPasswort($pw), $rolle]);
            jsonOk(['id' => DB::lastInsertId()]);
        } catch (\Exception $e) {
            jsonErr('Benutzername oder E-Mail bereits vorhanden.');
        }
    }
    if ($method === 'PUT' && $id) {
        $felder = [];
        $params = [];
        if (!empty($body['email']))        { $felder[] = 'email=?';        $params[] = sanitize($body['email']); }
        if (!empty($body['rolle']))        { $felder[] = 'rolle=?';        $params[] = $body['rolle']; }
        if (isset($body['aktiv']))         { $felder[] = 'aktiv=?';        $params[] = $body['aktiv'] ? 1 : 0; }
        if (!empty($body['passwort']) && strlen($body['passwort']) >= 8)
            { $felder[] = 'passwort=?'; $params[] = Auth::hashPasswort($body['passwort']); }
        // athlet_id: null = Verknüpfung aufheben, int = zuordnen (nur wenn Spalte existiert)
        if (array_key_exists('athlet_id', $body)) {
            $col = DB::fetchOne("SHOW COLUMNS FROM " . DB::tbl('benutzer') . " LIKE 'athlet_id'");
            if ($col) {
                $felder[] = 'athlet_id=?';
                $params[] = $body['athlet_id'] ? (int)$body['athlet_id'] : null;
                // Rolle automatisch anpassen: athlet_id gesetzt → 'athlet', entfernt → 'leser'
                // (nur wenn Rolle nicht bereits admin/editor und nicht explizit im Body gesetzt)
                if (!array_key_exists('rolle', $body)) {
                    $curRow = DB::fetchOne('SELECT rolle FROM ' . DB::tbl('benutzer') . ' WHERE id=?', [$id]);
                    $curRolle = $curRow['rolle'] ?? 'leser';
                    if ($body['athlet_id'] && in_array($curRolle, ['leser','athlet'])) {
                        $felder[] = 'rolle=?'; $params[] = 'athlet';
                    } elseif (!$body['athlet_id'] && $curRolle === 'athlet') {
                        $felder[] = 'rolle=?'; $params[] = 'leser';
                    }
                }
            }
        }
        if (array_key_exists('email_login_bevorzugt', $body)) {
            $felder[] = 'email_login_bevorzugt=?';
            $params[] = $body['email_login_bevorzugt'] ? 1 : 0;
        }
        if (!$felder) jsonErr('Keine Änderungen.');
        $params[] = $id;
        DB::query('UPDATE ' . DB::tbl('benutzer') . ' SET ' . implode(',', $felder) . ' WHERE id=?', $params);
        jsonOk('Gespeichert.');
    }
    if ($method === 'DELETE' && $id && empty($parts[2])) {
        if ((int)$id === (int)$user['id']) jsonErr('Eigenen Account nicht löschbar.');
        DB::query('DELETE FROM ' . DB::tbl('benutzer') . ' WHERE id=?', [$id]);
        jsonOk('Gelöscht.');
    }
    // ── Admin: Passkeys eines Users ──
    if ($method === 'GET' && $id && ($parts[2] ?? '') === 'passkeys') {
        $pks = DB::fetchAll(
            'SELECT id, name, aaguid, letzter_login, erstellt_am FROM ' . DB::tbl('passkeys') .
            ' WHERE user_id = ? ORDER BY erstellt_am DESC',
            [(int)$id]
        );
        jsonOk($pks);
    }
    if ($method === 'DELETE' && $id && ($parts[2] ?? '') === 'passkeys' && !empty($parts[3])) {
        $pkId = (int)$parts[3];
        $stmt = DB::query('DELETE FROM ' . DB::tbl('passkeys') . ' WHERE id = ? AND user_id = ?', [$pkId, (int)$id]);
        if (!$stmt->rowCount()) jsonErr('Passkey nicht gefunden.', 404);
        jsonOk(null);
    }
    // ── Admin: TOTP eines Users zurücksetzen ──
    if ($method === 'DELETE' && $id && ($parts[2] ?? '') === 'totp') {
        DB::query(
            'UPDATE ' . DB::tbl('benutzer') . ' SET totp_secret = NULL, totp_aktiv = 0, totp_pending = NULL, totp_backup = NULL WHERE id = ?',
            [(int)$id]
        );
        jsonOk('TOTP zurückgesetzt.');
    }
}

// ============================================================
// DASHBOARD
// ============================================================
if ($res === 'dashboard' && $method === 'GET') {
    // Öffentlich zugänglich
    $eTbl = ergebnisTbl('strasse', $unified, $_sys);
    if ($unified) {
        $stats = [
            'gesamt'   => DB::fetchOne('SELECT COUNT(*) c FROM ' . DB::tbl('ergebnisse') . ' WHERE geloescht_am IS NULL')['c'],
            'athleten' => DB::fetchOne('SELECT COUNT(*) c FROM ' . DB::tbl('athleten') . ' WHERE geloescht_am IS NULL')['c'],
            'rekorde'  => DB::fetchOne('SELECT COUNT(*) c FROM ' . DB::tbl('vereinsrekorde') . '')['c'],
        ];
    } else {
        $stats = [
            'strasse'       => DB::fetchOne('SELECT COUNT(*) c FROM ' . DB::tbl('ergebnisse_strasse') . '')['c'],
            'sprint'        => DB::fetchOne('SELECT COUNT(*) c FROM ' . DB::tbl('ergebnisse_sprint') . '')['c'],
            'mittelstrecke' => DB::fetchOne('SELECT COUNT(*) c FROM ' . DB::tbl('ergebnisse_mittelstrecke') . '')['c'],
            'sprungwurf'    => DB::fetchOne('SELECT COUNT(*) c FROM ' . DB::tbl('ergebnisse_sprungwurf') . '')['c'],
            'athleten'      => DB::fetchOne('SELECT COUNT(*) c FROM ' . DB::tbl('athleten') . '')['c'],
            'rekorde'       => DB::fetchOne('SELECT COUNT(*) c FROM ' . DB::tbl('vereinsrekorde') . '')['c'],
        ];
    }

    // Rekord-Timeline: alle Tabellen berücksichtigen (unified oder alle Legacy-Tabellen)
    $nameExpr = "CONCAT(COALESCE(a.nachname,''), IF(a.vorname IS NOT NULL AND a.vorname != '', CONCAT(', ', a.vorname), ''))";

    // Alle verfügbaren Ergebnistabellen bestimmen
    $tblsForTimeline = $unified
        ? [['tbl'=>'ergebnisse','fmt_fallback'=>null]]
        : [
            ['tbl'=>'ergebnisse_strasse',      'fmt_fallback'=>'min'],
            ['tbl'=>'ergebnisse_sprint',        'fmt_fallback'=>'s'],
            ['tbl'=>'ergebnisse_mittelstrecke', 'fmt_fallback'=>'min'],
            ['tbl'=>'ergebnisse_sprungwurf',    'fmt_fallback'=>'m'],
          ];

    // Alle Disziplinen mit fmt sammeln – nach mapping_id gruppieren (eindeutig!)
    $diszMap = [];
    foreach ($tblsForTimeline as $tblInfo) {
        $tblN = $tblInfo['tbl'];
        $fmtFb = $tblInfo['fmt_fallback'];
        $rows = DB::fetchAll(
            "SELECT DISTINCT e.disziplin, e.disziplin_mapping_id,
                    COALESCE(m.fmt_override, k.fmt, ?) AS fmt,
                    k.name AS kategorie_name
             FROM $tblN e
             LEFT JOIN " . DB::tbl('disziplin_mapping') . " m ON m.id=e.disziplin_mapping_id
             LEFT JOIN " . DB::tbl('disziplin_kategorien') . " k ON k.id=m.kategorie_id
             WHERE e.disziplin IS NOT NULL",
            [$fmtFb]
        );
        foreach ($rows as $r) {
            // Schlüssel = mapping_id wenn vorhanden, sonst disziplin-Name
            $key = $r['disziplin_mapping_id'] ? 'm'.$r['disziplin_mapping_id'] : 'd_'.$r['disziplin'];
            if (!isset($diszMap[$key])) {
                $diszMap[$key] = [
                    'fmt'           => $r['fmt'],
                    'tbl'           => $tblN,
                    'disziplin'     => $r['disziplin'],
                    'mapping_id'    => $r['disziplin_mapping_id'],
                    'kategorie_name'=> $r['kategorie_name'] ?? null,
                ];
            }
        }
    }
    // Sortieren
    uasort($diszMap, function($a, $b) {
        $ka = diszSortKey($a['disziplin']); $kb = diszSortKey($b['disziplin']);
        return $ka !== $kb ? $ka <=> $kb : strcmp($a['disziplin'], $b['disziplin']);
    });

    $timelineEvents = [];
    foreach ($diszMap as $dKey => $dInfo) {
        $fmt      = $dInfo['fmt'] ?? 'min';
        $tblN     = $dInfo['tbl'];
        $disz     = $dInfo['disziplin'];
        $mappingId= $dInfo['mapping_id'];
        $dir      = ($fmt === 'm') ? 'DESC' : 'ASC';

        if ($fmt === 'm') {
            $valExpr = "COALESCE(e.resultat_num, CAST(e.resultat AS DECIMAL(10,3)))";
        } else {
            $valExpr = "CASE
                    WHEN e.resultat REGEXP '^[0-9]{1,2}:[0-9]{2}:[0-9]{2}' THEN TIME_TO_SEC(e.resultat)
                    WHEN e.resultat REGEXP '^[0-9]+:[0-9]' THEN TIME_TO_SEC(CONCAT('00:', REPLACE(REPLACE(e.resultat, ',', '.'), ';', '.')))
                    ELSE CAST(REPLACE(e.resultat, ',', '.') AS DECIMAL(10,3)) END";
        }

        // Filter: per mapping_id wenn vorhanden, sonst per disziplin-Name
        $ergWhere = $mappingId
            ? "e.disziplin_mapping_id=?"
            : "e.disziplin=? AND e.disziplin_mapping_id IS NULL";
        $ergParam = $mappingId ? (int)$mappingId : $disz;

        // merge_ak: Jugend-AKs zu MHK/WHK zusammenfassen (aus Settings)
        $mergeAKTl = ($_GET['merge_ak_tl'] ?? '1') !== '0';
        $akExprTl    = buildAkCaseExpr($mergeAKTl);
        $akExprTlPb  = buildAkCaseExpr($mergeAKTl, 'pb');
        $pbErgWhere  = $mappingId
            ? "pb.disziplin_mapping_id=?"
            : "pb.disziplin=? AND pb.disziplin_mapping_id IS NULL";
        // valExpr für athlet_pb (alias pb statt e)
        $pbValExpr = str_replace(['e.resultat_num', 'e.resultat'], ['NULL', 'pb.resultat'], $valExpr);
        $extOnly = $dInfo['ext_only'] ?? false;
        if ($extOnly) {
            // Nur externe Ergebnisse für diese Disziplin
            $ergs = DB::fetchAll(
                "SELECT pb.resultat, $pbValExpr AS val_sort, pb.datum, ($akExprTlPb) AS altersklasse,
                        $nameExpr AS athlet, a.id AS athlet_id, a.geschlecht
                 FROM " . DB::tbl('athlet_pb') . " pb
                 JOIN " . DB::tbl('athleten') . " a ON a.id=pb.athlet_id
                 WHERE $pbErgWhere AND pb.resultat IS NOT NULL AND pb.resultat != ''
                   AND pb.datum IS NOT NULL
                 ORDER BY pb.datum ASC, pb.id ASC",
                [$ergParam]
            );
        } else {
            $ergs = DB::fetchAll(
                "SELECT e.resultat, $valExpr AS val_sort, v.datum, ($akExprTl) AS altersklasse,
                        $nameExpr AS athlet, a.id AS athlet_id, a.geschlecht
                 FROM $tblN e
                 JOIN " . DB::tbl('athleten') . " a ON a.id=e.athlet_id
                 JOIN " . DB::tbl('veranstaltungen') . " v ON v.id=e.veranstaltung_id
                 WHERE $ergWhere AND e.resultat IS NOT NULL AND e.resultat != ''
                   AND e.geloescht_am IS NULL
                 UNION ALL
                 SELECT pb.resultat, $pbValExpr AS val_sort, pb.datum, ($akExprTlPb) AS altersklasse,
                        $nameExpr AS athlet, a.id AS athlet_id, a.geschlecht
                 FROM " . DB::tbl('athlet_pb') . " pb
                 JOIN " . DB::tbl('athleten') . " a ON a.id=pb.athlet_id
                 WHERE $pbErgWhere AND pb.resultat IS NOT NULL AND pb.resultat != ''
                   AND pb.datum IS NOT NULL
                 ORDER BY datum ASC, 1 ASC",
                [$ergParam, $ergParam]
            );
        }

        $bestGesamt   = null;
        $bestByG      = [];
        $bestByAK     = [];
        $bestByAthlet = [];
        // Vorherige Werte (für Vergleich in der Timeline)
        $prevGesamt   = null;
        $prevByG      = [];
        $prevByAK     = [];
        $prevByAthlet = [];
        // Datum wann der jeweilige Bestwert zuletzt gesetzt wurde
        // → für Co-Debüt-Erkennung (gleiches Datum = kein echter Vorgänger)
        $bestGesamtDatum = null;
        $bestByGDatum    = [];
        $bestByAKDatum   = [];
        // Datum des allerersten Ergebnisses in dieser Disziplin
        // Alle Ergebnisse an diesem Tag → "Erste Gesamtleistung"
        $firstEverDatum  = null;

        // fmt auto-korrigieren: wenn Resultate HH:MM:SS-Format haben, ist es 'min' nicht 's'
        if ($fmt === 's' && !empty($ergs)) {
            $firstRes = $ergs[0]['resultat'] ?? '';
            if (preg_match('/^\d{2}:\d{2}:\d{2}/', $firstRes)) {
                $fmt = 'min';
                $dir = 'ASC';
            }
        }

        foreach ($ergs as $e) {
            $val   = (float)($e['val_sort'] ?? 0);
            $datum = $e['datum'];
            $g     = $e['geschlecht'] ?? '';
            $ak    = $e['altersklasse'] ?? '';

            // ── Zwei unabhängige Label-Spuren ──────────────────────────────
            // label_club  = vereinsbezogen (Gold/Silber): Gesamt, Geschlecht, AK
            // label_pers  = persönlich (Grün):            Debüt, PB
            $labelClub = null;  // null = kein vereinsbezogenes Ereignis
            $labelPers = null;  // null = kein persönliches Ereignis
            $vorher    = null;
            $vorherClub = null;
            $vorherPers = null;

            // ── CLUB-LABELS ────────────────────────────────────────────────
            // Sonderfall: Alle Ergebnisse am allerersten Tag dieser Disziplin
            // erhalten "Erste Gesamtleistung" — unabhängig von der Reihenfolge
            if ($firstEverDatum !== null && $datum === $firstEverDatum && $bestGesamt !== null) {
                $labelClub = 'Erste Gesamtleistung';
                if ($g === 'M' || $g === 'W') {
                    if (!isset($bestByG[$g]) || ($dir==='ASC' ? $val<$bestByG[$g] : $val>$bestByG[$g])) {
                        $bestByG[$g] = $val; $bestByGDatum[$g] = $datum;
                    }
                }
                if ($ak) {
                    if (!isset($bestByAK[$ak]) || ($dir==='ASC' ? $val<$bestByAK[$ak] : $val>$bestByAK[$ak])) {
                        $bestByAK[$ak] = $val; $bestByAKDatum[$ak] = $datum;
                    }
                }
            // 1. Gesamtbestzeit (Gold)
            } elseif ($bestGesamt === null ||
                ($dir === 'ASC'  && $val < $bestGesamt) ||
                ($dir === 'DESC' && $val > $bestGesamt)) {
                $prevGesamt      = $bestGesamt;
                $prevGesamtDatum = $bestGesamtDatum;
                $bestGesamt      = $val;
                $bestGesamtDatum = $datum;
                // Erstes Ergebnis überhaupt → firstEverDatum merken
                if ($prevGesamt === null) $firstEverDatum = $datum;
                // Co-Debüt: vorheriger Bestwert am selben Tag → kein echter Vorgänger
                $sameDayGesamt = ($prevGesamt !== null && $prevGesamtDatum === $datum);
                $labelClub = ($prevGesamt === null || $sameDayGesamt) ? 'Erste Gesamtleistung' : 'Gesamtbestleistung';
                $vorherClub = (!$sameDayGesamt) ? ($prevGesamt ?? null) : null;
                if ($vorher === null && !$sameDayGesamt) $vorher = $prevGesamt;
                // Geschlechts-Bestleistung mitaktualisieren (prevByG sichern!)
                if ($g === 'M' || $g === 'W') {
                    $prevByG[$g]      = $bestByG[$g] ?? null;
                    $prevByGDatum     = $bestByGDatum[$g] ?? null;
                    $bestByG[$g]      = $val;
                    $bestByGDatum[$g] = $datum;
                }
            }
            // 2. Geschlechts-/Hauptklassen-Bestleistung (Gold wenn kein Gesamt-Label)
            if (!$labelClub && ($g === 'M' || $g === 'W')) {
                if (!isset($bestByG[$g]) ||
                    ($dir === 'ASC'  && $val < $bestByG[$g]) ||
                    ($dir === 'DESC' && $val > $bestByG[$g])) {
                    $prevByG[$g]      = $bestByG[$g] ?? null;
                    $prevByGDatum     = $bestByGDatum[$g] ?? null;
                    $bestByG[$g]      = $val;
                    $bestByGDatum[$g] = $datum;
                    // Co-Debüt: vorheriger Bestwert am selben Tag → kein echter Vorgänger
                    $sameDayG = ($prevByG[$g] !== null && $prevByGDatum === $datum);
                    $isFirst  = ($prevByG[$g] === null || $sameDayG);
                    // Bei merge_ak: WHK/MHK statt "Frauen"/"Männer" wenn AK eine Hauptklasse ist
                    $gLabel = ($ak === 'WHK') ? 'WHK' : (($ak === 'MHK') ? 'MHK'
                            : (($g === 'M') ? 'Männer' : 'Frauen'));
                    $labelClub = $isFirst
                        ? "Erstes Ergebnis $gLabel"
                        : "Bestleistung $gLabel";
                    $vorherClub = (!$sameDayG) ? ($prevByG[$g] ?? null) : null; // Vereins-Vorgänger
                    if ($vorher === null && !$sameDayG) $vorher = $prevByG[$g];
                }
            }
            // 3. AK-Bestleistung (Silber) — immer prüfen, unabhängig von Gesamt/Geschlecht
            if ($ak) {
                if (!isset($bestByAK[$ak]) ||
                    ($dir === 'ASC'  && $val < $bestByAK[$ak]) ||
                    ($dir === 'DESC' && $val > $bestByAK[$ak])) {
                    $prevByAK[$ak]      = $bestByAK[$ak] ?? null;
                    $prevByAKDatum      = $bestByAKDatum[$ak] ?? null;
                    $bestByAK[$ak]      = $val;
                    $bestByAKDatum[$ak] = $datum;
                    // Nur als AK-Label setzen wenn kein höherwertiges Gesamt/Geschlecht-Label
                    if (!$labelClub) {
                        // Co-Debüt: vorheriger AK-Bestwert am selben Tag → kein echter Vorgänger
                        $sameDayAK = ($prevByAK[$ak] !== null && $prevByAKDatum === $datum);
                        $isFirst   = ($prevByAK[$ak] === null || $sameDayAK);
                        $labelClub = $isFirst ? 'Erste Leistung ' . $ak : 'Bestleistung ' . $ak;
                        $vorherClub = (!$sameDayAK) ? ($prevByAK[$ak] ?? null) : null;
                        if ($vorher === null && !$sameDayAK) $vorher = $prevByAK[$ak];
                    }
                }
            }

            // ── PERSÖNLICHE LABELS ─────────────────────────────────────────
            // Debüt = erste Leistung des Athleten in dieser Disziplin
            // PB    = neue persönliche Bestleistung (nicht erstes Ergebnis)
            $aid = $e['athlet_id'];
            if (!isset($bestByAthlet[$aid]) ||
                ($dir === 'ASC'  && $val < $bestByAthlet[$aid]) ||
                ($dir === 'DESC' && $val > $bestByAthlet[$aid])) {
                $prevByAthlet[$aid] = $bestByAthlet[$aid] ?? null;
                $bestByAthlet[$aid] = $val;
                $isFirst = $prevByAthlet[$aid] === null;
                $labelPers = $isFirst ? 'Debüt' : 'PB';
                if ($vorher === null) $vorher = $prevByAthlet[$aid];
                $vorherPers = $prevByAthlet[$aid]; // immer separat merken
            }

            // ── Nur eintragen wenn mindestens ein Label gesetzt ────────────
            if ($labelClub !== null || $labelPers !== null) {
                // Priorität für Sortierung: niedrigster Wert gewinnt bei gleichem Datum
                // Club-Labels haben immer höhere Priorität als persönliche
                $prio = 3; // default: PB/Debüt
                if ($labelClub) {
                    if (strpos($labelClub, 'Gesamt') !== false) $prio = 0;
                    elseif (strpos($labelClub, 'Männer') !== false || strpos($labelClub, 'Frauen') !== false
                         || strpos($labelClub, 'Ergebnis M') !== false || strpos($labelClub, 'Ergebnis W') !== false) $prio = 1;
                    else $prio = 2; // AK
                }
                $timelineEvents[] = [
                    'datum'               => $datum,
                    'disziplin'           => $disz,
                    'disziplin_mapping_id'=> $mappingId,
                    'kategorie_name'      => $dInfo['kategorie_name'] ?? null,
                    'athlet'              => $e['athlet'],
                    'athlet_id'           => $e['athlet_id'],
                    'resultat'            => $e['resultat'],
                    'vorher_val'          => $vorher,
                    'vorher_club'         => $vorherClub ?? null,
                    'vorher_pers'         => $vorherPers ?? null,
                    'label_club'          => $labelClub,
                    'label_pers'          => $labelPers,
                    // label für Rückwärtskompatibilität (höherwertiges Label)
                    'label'               => $labelClub ?? $labelPers,
                    'fmt'                 => $fmt,
                    'priority'            => $prio,
                ];
            }
        }
    }
    usort($timelineEvents, function($a, $b) {
        $cmp = strcmp($b['datum'], $a['datum']);
        return $cmp !== 0 ? $cmp : ($a['priority'] - $b['priority']);
    });

    // (athlet_pb wird bereits per UNION in Phase 1 berücksichtigt)
    $rekordeTimeline = array_slice($timelineEvents, 0, min((int)($_GET['timeline_limit'] ?? 20), 200));

    // Aktuelle Ergebnisse (mit fmt-Info aus disziplin_mapping)
    $recent = DB::fetchAll(
        "SELECT a.name_nv AS athlet, a.id AS athlet_id, e.altersklasse, e.disziplin,
                e.disziplin_mapping_id, k.name AS kategorie_name, k.tbl_key,
                e.resultat, e.meisterschaft,
                v.kuerzel AS veranstaltung, v.datum,
                COALESCE(m.fmt_override, k.fmt) AS fmt
         FROM $eTbl e
         JOIN " . DB::tbl('athleten') . " a ON a.id=e.athlet_id
         JOIN " . DB::tbl('veranstaltungen') . " v ON v.id=e.veranstaltung_id
         LEFT JOIN " . DB::tbl('disziplin_mapping') . " m ON m.id=e.disziplin_mapping_id
         LEFT JOIN " . DB::tbl('disziplin_kategorien') . " k ON k.id=m.kategorie_id
         WHERE e.geloescht_am IS NULL AND v.genehmigt = 1
         ORDER BY v.datum DESC, e.id DESC LIMIT 20"
    );

    jsonOk(compact('stats','rekordeTimeline','recent'));
}

// ============================================================
// ERGEBNISSE
// ============================================================
$ergebnisTabellen = ['strasse','sprint','mittelstrecke','sprungwurf','bahn','cross','halle'];
if (in_array($res, $ergebnisTabellen)) {
    Auth::requireLogin();
    $tbl = ergebnisTbl($res, $unified, $_sys);

    if ($method === 'GET' && !$id) {
        // Filter-Parameter
        $where = ['1=1'];
        $params = [];
        if (!empty($_GET['athlet_id'])) {
            $where[] = 'e.athlet_id=?'; $params[] = (int)$_GET['athlet_id'];
        }
        if (!empty($_GET['athlet'])) {
            $where[] = 'a.name_nv LIKE ?'; $params[] = '%'.$_GET['athlet'].'%';
        }
        if (!empty($_GET['kategorie'])) {
            $kat_row = DB::fetchOne("SELECT id FROM " . DB::tbl('disziplin_kategorien') . " WHERE tbl_key=?", [$_GET['kategorie']]);
            if ($kat_row) {
                $kd = DB::fetchAll("SELECT id FROM " . DB::tbl('disziplin_mapping') . " WHERE kategorie_id=?", [$kat_row['id']]);
                $kids = array_column($kd, 'id');
                if ($kids) { $where[] = "e.disziplin_mapping_id IN (".implode(',',array_fill(0,count($kids),'?')).")"; $params = array_merge($params, $kids); }
                else { $where[] = '0=1'; }
            }
        }
        if (!empty($_GET['disziplin_mapping_id'])) {
            $where[] = 'e.disziplin_mapping_id=?'; $params[] = (int)$_GET['disziplin_mapping_id'];
        } elseif (!empty($_GET['disziplin'])) {
            $where[] = 'e.disziplin=?'; $params[] = $_GET['disziplin'];
        }
        if (!empty($_GET['ak'])) {
            $where[] = 'e.altersklasse=?'; $params[] = $_GET['ak'];
        }
        if (!empty($_GET['jahr'])) {
            $where[] = 'YEAR(v.datum)=?'; $params[] = (int)$_GET['jahr'];
        }
        if (!empty($_GET['suche'])) {
            $s = '%'.$_GET['suche'].'%';
            $where[] = '(a.name_nv LIKE ? OR e.disziplin LIKE ? OR v.kuerzel LIKE ?)';
            $params = array_merge($params, [$s,$s,$s]);
        }
        if (!empty($_GET['meisterschaft'])) {
            $mstrRaw = $_GET['meisterschaft'];
            if ($mstrRaw === '1') {
                // Legacy: nur "hat Meisterschaft"
                $where[] = 'e.meisterschaft IS NOT NULL';
            } else {
                // Kommagetrennte IDs: z.B. "1,3,5"
                $mstrIds = array_filter(array_map('intval', explode(',', $mstrRaw)));
                if ($mstrIds) {
                    $where[] = 'e.meisterschaft IN (' . implode(',', array_fill(0, count($mstrIds), '?')) . ')';
                    $params  = array_merge($params, $mstrIds);
                }
            }
        }

        $sortMap = [
            'datum'    => 'v.datum',
            'athlet'   => 'a.name_nv',
            'ak'       => 'e.altersklasse',
            'disziplin'=> 'e.disziplin',
            'resultat' => 'e.resultat_num',
            'platz'    => 'e.ak_platzierung',
        ];
        $sortKey = $_GET['sort'] ?? 'datum';
        $sortDir = strtoupper($_GET['dir'] ?? 'DESC') === 'ASC' ? 'ASC' : 'DESC';
        $sortCol = $sortMap[$sortKey] ?? 'v.datum';
        $sort    = "$sortCol $sortDir, e.id DESC";
        $limit  = min((int)($_GET['limit'] ?? 100), 500);
        $offset = (int)($_GET['offset'] ?? 0);

        // Disziplin-Spalte je nach Tabelle
        $diszCol = 'e.disziplin';
        $extraCols = '';
        if ($unified) {
            // Einheitliche Tabelle: pace + distanz + ak_platz_meisterschaft vorhanden (seit v493)
            $extraCols = "e.pace, e.distanz, e.ak_platz_meisterschaft,";
        } else {
            // ak_platz_meisterschaft in allen Tabellen die es haben (ab v493 überall vorhanden)
            $hasPace  = in_array($res, ['strasse']);
            $hasAkPM  = in_array($res, ['strasse', 'sprint', 'mittelstrecke', 'sprungwurf']);
            $extraCols = ($hasPace  ? "e.pace, e.distanz, " : "") .
                         ($hasAkPM  ? "e.ak_platz_meisterschaft," : "NULL AS ak_platz_meisterschaft,");
        }

        $sql = "SELECT e.id, a.name_nv AS athlet, a.id AS athlet_id, e.altersklasse,
                       e.disziplin, e.disziplin_mapping_id, e.resultat,
                       $extraCols
                       e.ak_platzierung, e.meisterschaft,
                       e.veranstaltung_id,
                       v.kuerzel AS veranstaltung, v.datum, v.ort, v.ort AS veranstaltung_ort, v.name AS veranstaltung_name, v.datenquelle AS veranstaltung_quelle,
                       v.serie_id AS verknuepfte_serie_id, v.name AS verknuepfte_veranstaltung_name,
                       COALESCE(CONCAT(ab.vorname,' ',ab.nachname), b.benutzername) AS eingetragen_von, e.erstellt_am,
                       COALESCE(dm.fmt_override, dk.fmt) AS fmt,
                       dk.name AS kategorie_name, dk.tbl_key AS kategorie_key
                FROM $tbl e
                JOIN " . DB::tbl('athleten') . " a ON a.id=e.athlet_id
                JOIN " . DB::tbl('veranstaltungen') . " v ON v.id=e.veranstaltung_id
                LEFT JOIN " . DB::tbl('benutzer') . " b ON b.id=e.erstellt_von
                LEFT JOIN " . DB::tbl('athleten') . " ab ON ab.id=b.athlet_id
                LEFT JOIN " . DB::tbl('disziplin_mapping') . " dm ON dm.id=e.disziplin_mapping_id
                LEFT JOIN " . DB::tbl('disziplin_kategorien') . " dk ON dk.id=dm.kategorie_id
                WHERE e.geloescht_am IS NULL AND " . implode(' AND ', $where) . "
                ORDER BY $sort
                LIMIT $limit OFFSET $offset";

        $rows  = DB::fetchAll($sql, $params);
        $total = DB::fetchOne("SELECT COUNT(*) c FROM $tbl e
                JOIN " . DB::tbl('athleten') . " a ON a.id=e.athlet_id
                JOIN " . DB::tbl('veranstaltungen') . " v ON v.id=e.veranstaltung_id
                WHERE " . implode(' AND ', $where), $params)['c'];

        // Distinct-Werte für Filter-Dropdowns
        // Hilfsfunktion: Filter-WHERE ohne bestimmte Keys neu aufbauen
        $get = $_GET; // Superglobal in lokale Variable kopieren (Closure-kompatibel)
        $buildSubWhere = function(array $exclude) use ($get, $tbl) {
            $w = ['1=1']; $p = [];
            if (!in_array('athlet_id',$exclude) && !empty($get['athlet_id']))  { $w[]='e.athlet_id=?';    $p[]=(int)$get['athlet_id']; }
            if (!in_array('athlet',$exclude)    && !empty($get['athlet']))     { $w[]='a.name_nv LIKE ?'; $p[]='%'.$get['athlet'].'%'; }
            if (!in_array('ak',$exclude)        && !empty($get['ak']))         { $w[]='e.altersklasse=?'; $p[]=$get['ak']; }
            if (!in_array('jahr',$exclude)      && !empty($get['jahr']))       { $w[]='YEAR(v.datum)=?';  $p[]=(int)$get['jahr']; }
            if (!in_array('meisterschaft',$exclude) && !empty($get['meisterschaft'])) { $w[]='e.meisterschaft IS NOT NULL'; }
            if (!in_array('suche',$exclude)     && !empty($get['suche']))      { $s='%'.$get['suche'].'%'; $w[]='(a.name_nv LIKE ? OR e.disziplin LIKE ? OR v.kuerzel LIKE ?)'; $p=array_merge($p,[$s,$s,$s]); }
            if (!in_array('kategorie',$exclude) && !empty($get['kategorie'])) {
                $kr = DB::fetchOne("SELECT id FROM " . DB::tbl('disziplin_kategorien') . " WHERE tbl_key=?", [$get['kategorie']]);
                if ($kr) { $kd=DB::fetchAll("SELECT id FROM " . DB::tbl('disziplin_mapping') . " WHERE kategorie_id=?",[$kr['id']]); $kids3=array_column($kd,'id'); if ($kids3) { $w[]="e.disziplin_mapping_id IN (".implode(',',array_fill(0,count($kids3),'?')).")"; $p=array_merge($p,$kids3); } else { $w[]='0=1'; } }
            }
            if (!in_array('disziplin',$exclude) && !empty($get['disziplin']))  { $w[]='e.disziplin=?';    $p[]=$get['disziplin']; }
            return array($w, $p);
        };
        $jn = "JOIN " . DB::tbl('athleten') . " a ON a.id=e.athlet_id JOIN " . DB::tbl('veranstaltungen') . " v ON v.id=e.veranstaltung_id";

        // Disziplin-Dropdown: alle Filter aktiv außer disziplin; wenn Kategorie aktiv, schränkt sie ein
        list($wd,$pd) = $buildSubWhere(array('disziplin'));
        $diszRaw = DB::fetchAll("SELECT DISTINCT e.disziplin, e.disziplin_mapping_id, dk.name AS kategorie_name FROM $tbl e $jn LEFT JOIN " . DB::tbl('disziplin_mapping') . " dm ON dm.id=e.disziplin_mapping_id LEFT JOIN " . DB::tbl('disziplin_kategorien') . " dk ON dk.id=dm.kategorie_id WHERE ".implode(' AND ',$wd), $pd);
        sortDisziplinen($diszRaw);
        $disziplinen = $diszRaw;

        // AK-Dropdown: alle Filter außer ak
        list($wa,$pa) = $buildSubWhere(array('ak'));
        $aks = array_column(DB::fetchAll("SELECT DISTINCT e.altersklasse FROM $tbl e $jn WHERE ".implode(' AND ',$wa)." AND e.altersklasse IS NOT NULL ORDER BY e.altersklasse", $pa), 'altersklasse');

        // Jahr-Dropdown: alle Filter außer jahr
        list($wj,$pj) = $buildSubWhere(array('jahr'));
        $jahre = array_column(DB::fetchAll("SELECT DISTINCT YEAR(v.datum) j FROM $tbl e $jn WHERE ".implode(' AND ',$wj)." ORDER BY j DESC", $pj), 'j');

        // Kategorien: alle die in den Ergebnissen vorkommen
        $kategorien = array();
        try {
            $kategorien = DB::fetchAll("SELECT k.tbl_key, k.name FROM " . DB::tbl('disziplin_kategorien') . " k WHERE EXISTS (SELECT 1 FROM " . DB::tbl('disziplin_mapping') . " m JOIN $tbl e ON e.disziplin_mapping_id=m.id WHERE m.kategorie_id=k.id) ORDER BY k.reihenfolge, k.name");
        } catch (Exception $ex) {}

        jsonOk(compact('rows','total','disziplinen','aks','jahre','kategorien'));
    }

    if ($method === 'POST') {
        $user = Auth::requireAthlet(); // leser darf Ergebnisse eintragen
        // Veranstaltung anlegen/finden
        $datum  = sanitize($body['datum'] ?? '');
        $ort    = sanitize($body['ort'] ?? '');
        $evname = sanitize($body['veranstaltung_name'] ?? '');
        if (!$datum || !$ort) jsonErr('Datum und Ort erforderlich.');
        $kuerzel = date('d.m.Y', strtotime($datum)) . ' ' . $ort;
        $v = DB::fetchOne('SELECT id FROM ' . DB::tbl('veranstaltungen') . ' WHERE kuerzel=?', [$kuerzel]);
        if (!$v) {
            DB::query('INSERT INTO ' . DB::tbl('veranstaltungen') . ' (kuerzel,name,ort,datum) VALUES (?,?,?,?)',
                [$kuerzel, $evname ?: $kuerzel, $ort, $datum]);
            $vid = DB::lastInsertId();
        } else $vid = $v['id'];

        // Athlet finden
        $aid = intOrNull($body['athlet_id'] ?? null);
        if (!$aid) jsonErr('Athlet erforderlich.');

        $ak       = sanitize($body['altersklasse'] ?? '');
        $disziplin= sanitize($body['disziplin'] ?? '');
        $resultat = sanitize($body['resultat'] ?? '');
        $akp      = intOrNull($body['ak_platzierung'] ?? null);
        $mstr     = intOrNull($body['meisterschaft'] ?? null);
        if (!$disziplin || !$resultat) jsonErr('Disziplin und Ergebnis erforderlich.');

        // distanz und pace aus disziplin_mapping (nicht mehr aus body)
        $akpm    = intOrNull($body['ak_platz_meisterschaft'] ?? null);
        $rnum    = ($res === 'sprungwurf') ? floatOrNull($body['resultat'] ?? null) : null;
        if ($unified) {
            $dmRow = DB::fetchOne("SELECT id, distanz FROM " . DB::tbl('disziplin_mapping') . " WHERE disziplin=?", [$disziplin]);
            $dmId  = $dmRow ? (int)$dmRow['id'] : null;
            $distanz = $dmRow ? $dmRow['distanz'] : null;
            DB::query("INSERT INTO " . DB::tbl('ergebnisse') . " (veranstaltung_id,athlet_id,altersklasse,disziplin,disziplin_mapping_id,distanz,resultat,resultat_num,ak_platzierung,meisterschaft,ak_platz_meisterschaft,erstellt_von) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                [$vid,$aid,$ak,$disziplin,$dmId,$distanz,$resultat,$rnum,$akp,$mstr,$akpm,$user['id']]);
        } elseif ($res === 'strasse') {
            DB::query("INSERT INTO " . DB::tbl('ergebnisse_strasse') . " (veranstaltung_id,athlet_id,altersklasse,disziplin,distanz,resultat,ak_platzierung,meisterschaft,ak_platz_meisterschaft,erstellt_von) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                [$vid,$aid,$ak,$disziplin,$distanz,$resultat,$akp,$mstr,$akpm,$user['id']]);
        } elseif ($res === 'sprint') {
            DB::query("INSERT INTO " . DB::tbl('ergebnisse_sprint') . " (veranstaltung_id,athlet_id,altersklasse,disziplin,distanz,resultat,ak_platzierung,meisterschaft,erstellt_von) VALUES (?,?,?,?,?,?,?,?,?)",
                [$vid,$aid,$ak,$disziplin,$distanz,$resultat,$akp,$mstr,$user['id']]);
        } elseif ($res === 'mittelstrecke') {
            DB::query("INSERT INTO " . DB::tbl('ergebnisse_mittelstrecke') . " (veranstaltung_id,athlet_id,altersklasse,disziplin,resultat,ak_platzierung,meisterschaft,erstellt_von) VALUES (?,?,?,?,?,?,?,?)",
                [$vid,$aid,$ak,$disziplin,$resultat,$akp,$mstr,$user['id']]);
        } elseif ($res === 'sprungwurf') {
            DB::query("INSERT INTO " . DB::tbl('ergebnisse_sprungwurf') . " (veranstaltung_id,athlet_id,altersklasse,disziplin,resultat,ak_platzierung,meisterschaft,erstellt_von) VALUES (?,?,?,?,?,?,?,?)",
                [$vid,$aid,$ak,$disziplin,$rnum,$akp,$mstr,$user['id']]);
        }
        jsonOk(['id' => DB::lastInsertId()]);
    }
    if ($method === 'PUT' && $id) {
        $user = Auth::requireAthlet();
        $row = DB::fetchOne("SELECT erstellt_von FROM $tbl WHERE id=?", [$id]);
        if (!$row) jsonErr('Nicht gefunden.', 404);
        if (!Auth::canEditAll() && $row['erstellt_von'] != $user['id'])
            jsonErr('Keine Berechtigung.', 403);
        // Athlet: Änderungsantrag statt direkter Speicherung
        if (Auth::isAthlet()) {
            DB::query('INSERT INTO ' . DB::tbl('ergebnis_aenderungen') . ' (ergebnis_id,ergebnis_tbl,typ,neue_werte,beantragt_von) VALUES (?,?,?,?,?)',
                [$id, $tbl, 'update', json_encode($body), $user['id']]);
            jsonOk(['pending' => true, 'msg' => '\u00c4nderungsantrag gestellt. Ein Editor wird ihn pr\u00fcfen.']);
        }
        $felder = []; $params = [];
        if (isset($body['athlet_id']) && Auth::isAdmin()) {
            $aid = (int)$body['athlet_id'];
            if ($aid > 0) { $felder[] = 'athlet_id=?'; $params[] = $aid; }
            // Auto: leser->athlet wenn Profil gesetzt; athlet->leser wenn entfernt
            $curRolle = DB::fetchOne('SELECT rolle FROM ' . DB::tbl('benutzer') . ' WHERE id=?', [(int)$bid])['rolle'] ?? '';
            if ($aid && $curRolle === 'leser') { $felder[] = 'rolle=?'; $params[] = 'athlet'; }
            elseif (!$aid && $curRolle === 'athlet') { $felder[] = 'rolle=?'; $params[] = 'leser'; }
        }
        if (isset($body['altersklasse']))  { $felder[] = 'altersklasse=?';  $params[] = sanitize($body['altersklasse']); }
        if (isset($body['disziplin'])) {
            $felder[] = 'disziplin=?'; $params[] = sanitize($body['disziplin']);
            // disziplin_mapping_id: direkt aus Body wenn vorhanden, sonst per Lookup
            if (isset($body['disziplin_mapping_id']) && is_numeric($body['disziplin_mapping_id'])) {
                $felder[] = 'disziplin_mapping_id=?'; $params[] = (int)$body['disziplin_mapping_id'];
            } else {
                $dmUpd = DB::fetchOne("SELECT id FROM " . DB::tbl('disziplin_mapping') . " WHERE disziplin=?", [sanitize($body['disziplin'])]);
                $felder[] = 'disziplin_mapping_id=?'; $params[] = $dmUpd ? (int)$dmUpd['id'] : null;
            }
        } elseif (isset($body['disziplin_mapping_id']) && is_numeric($body['disziplin_mapping_id'])) {
            // Nur mapping_id geändert (Bahn→Straße), Disziplinname bleibt gleich
            $felder[] = 'disziplin_mapping_id=?'; $params[] = (int)$body['disziplin_mapping_id'];
        }
        if (isset($body['resultat'])) {
            $felder[] = 'resultat=?'; $params[] = sanitize($body['resultat']);
            $rv = $body['resultat'];
            if (preg_match('/^\d+:\d/', $rv)) {
                $p = explode(':', $rv);
                $rnum = count($p) === 3 ? $p[0]*3600+$p[1]*60+$p[2] : $p[0]*60+$p[1];
            } else $rnum = floatOrNull($rv);
            $felder[] = 'resultat_num=?'; $params[] = $rnum;
        }
        // pace wird nicht mehr aktualisiert
        if (isset($body['ak_platzierung'])){ $felder[] = 'ak_platzierung=?';$params[] = intOrNull($body['ak_platzierung']); }
        if (isset($body['meisterschaft'])) { $felder[] = 'meisterschaft=?'; $params[] = intOrNull($body['meisterschaft']); }
        if (array_key_exists('ak_platz_meisterschaft', $body)) { $felder[] = 'ak_platz_meisterschaft=?'; $params[] = intOrNull($body['ak_platz_meisterschaft']); }
        if (!$felder) jsonErr('Keine Felder zum Aktualisieren.');
        $params[] = $id;
        DB::query("UPDATE $tbl SET " . implode(',', $felder) . " WHERE id=?", $params);
        jsonOk('OK');
    }

    if ($method === 'DELETE' && $id) {
        $user = Auth::requireAthlet();
        // editor/admin: sofort; athlet: nur eigene mit Genehmigung
        $row = DB::fetchOne("SELECT erstellt_von FROM $tbl WHERE id=?", [$id]);
        if (!$row) jsonErr('Nicht gefunden.', 404);
        if (!Auth::canEditAll() && $row['erstellt_von'] != $user['id'])
            jsonErr('Keine Berechtigung.', 403);
        if (Auth::isAthlet()) {
            DB::query('INSERT INTO ' . DB::tbl('ergebnis_aenderungen') . ' (ergebnis_id,ergebnis_tbl,typ,neue_werte,beantragt_von) VALUES (?,?,?,?,?)',
                [$id, $tbl, 'delete', null, $user['id']]);
            jsonOk(['pending' => true, 'msg' => 'L\u00f6schantrag gestellt.']);
        }
        DB::query("UPDATE $tbl SET geloescht_am=NOW() WHERE id=?", [$id]);
        jsonOk('In Papierkorb verschoben.');
    }
}

// ============================================================
// ATHLETEN
// ============================================================
if ($res === 'athleten-aktivitaet' && $method === 'GET') {
    // datum liegt in veranstaltungen, nicht in ergebnisse → JOIN nötig
    $eT = DB::tbl('ergebnisse');
    $vT = DB::tbl('veranstaltungen');
    $rows = DB::fetchAll(
        "SELECT e.athlet_id, YEAR(MAX(v.datum)) AS letzte_aktivitaet
         FROM $eT e
         JOIN $vT v ON v.id = e.veranstaltung_id
         WHERE e.geloescht_am IS NULL AND v.datum IS NOT NULL
         GROUP BY e.athlet_id");
    $map = [];
    foreach ($rows as $r) { $map[(int)$r['athlet_id']] = (int)$r['letzte_aktivitaet']; }
    jsonOk($map);
}

if ($res === 'athleten') {
    // GET ist öffentlich; schreibende Methoden erfordern Login
    if ($method !== 'GET') Auth::requireLogin();

    // ── Sub-Ressource: externe PBs  /athleten/{id}/pb[/{pbid}] ──
    if ($id && ($parts[2] ?? '') === 'pb') {
        $user = Auth::requireLogin();
        // Athleten dürfen nur eigene PBs schreiben; Editoren/Admins dürfen alle
        $athletId = (int)$id;
        $isEditorOrAdmin = in_array($user['rolle'], ['admin','editor']);
        if (!$isEditorOrAdmin) {
            $buRow = DB::fetchOne('SELECT athlet_id FROM ' . DB::tbl('benutzer') . ' WHERE id=?', [$user['id']]);
            if (!$buRow || (int)($buRow['athlet_id'] ?? 0) !== $athletId) jsonErr('Keine Berechtigung.', 403);
        }
        $pbId     = isset($parts[3]) ? (int)$parts[3] : null;

        if ($method === 'GET') {
            $rows = DB::fetchAll(
                'SELECT pb.id, pb.disziplin, pb.resultat, pb.wettkampf, pb.datum, pb.verein, pb.altersklasse,
                        pb.disziplin_mapping_id,
                        COALESCE(dm.fmt_override, dk.fmt, \'min\') AS fmt,
                        COALESCE(dk.name, \'Sonstige\') AS kat_name,
                        COALESCE(dk.reihenfolge, 99) AS kat_sort,
                        COALESCE(dm.disziplin, pb.disziplin) AS disziplin_mapped
                 FROM ' . DB::tbl('athlet_pb') . ' pb
                 LEFT JOIN ' . DB::tbl('disziplin_mapping') . ' dm ON dm.id=pb.disziplin_mapping_id
                 LEFT JOIN ' . DB::tbl('disziplin_kategorien') . ' dk ON dk.id=dm.kategorie_id
                 WHERE pb.athlet_id=? ORDER BY dk.reihenfolge, pb.disziplin',
                [$athletId]);
            jsonOk($rows);
        }
        if ($method === 'POST') {
            $disz = sanitize($body['disziplin'] ?? '');
            $res2 = sanitize($body['resultat']  ?? '');
            if (!$disz || !$res2) jsonErr('Disziplin und Ergebnis erforderlich.');
            $dat = ($body['datum'] ?? '') ?: null;
            $wk  = sanitize($body['wettkampf'] ?? '');
            $vr   = sanitize($body['verein']    ?? '');
            $ak   = sanitize($body['altersklasse'] ?? '');
            $dmId = intOrNull($body['disziplin_mapping_id'] ?? null);
            $pbUser = Auth::requireLogin();
            DB::query(
                'INSERT INTO ' . DB::tbl('athlet_pb') . ' (athlet_id, disziplin, resultat, wettkampf, datum, verein, altersklasse, disziplin_mapping_id, erstellt_von) VALUES (?,?,?,?,?,?,?,?,?)',
                [$athletId, $disz, $res2, $wk ?: null, $dat, $vr ?: null, $ak ?: null, $dmId, $pbUser['id']]);
            jsonOk(['id' => DB::lastInsertId()]);
        }
        if ($method === 'PUT' && $pbId) {
            $disz = sanitize($body['disziplin'] ?? '');
            $res2 = sanitize($body['resultat']  ?? '');
            if (!$disz || !$res2) jsonErr('Disziplin und Ergebnis erforderlich.');
            $dat = ($body['datum'] ?? '') ?: null;
            $wk  = sanitize($body['wettkampf'] ?? '');
            $vr   = sanitize($body['verein']    ?? '');
            $ak   = sanitize($body['altersklasse'] ?? '');
            $dmId = intOrNull($body['disziplin_mapping_id'] ?? null);
            DB::query(
                'UPDATE ' . DB::tbl('athlet_pb') . ' SET disziplin=?, resultat=?, wettkampf=?, datum=?, verein=?, altersklasse=?, disziplin_mapping_id=? WHERE id=? AND athlet_id=?',
                [$disz, $res2, $wk ?: null, $dat, $vr ?: null, $ak ?: null, $dmId, $pbId, $athletId]);
            jsonOk('OK');
        }
        if ($method === 'DELETE' && $pbId) {
            DB::query('DELETE FROM ' . DB::tbl('athlet_pb') . ' WHERE id=? AND athlet_id=?', [$pbId, $athletId]);
            jsonOk('OK');
        }
        jsonErr('Methode nicht erlaubt.', 405);
    }

    if ($method === 'GET' && !$id) {
        $s = sanitize($_GET['suche'] ?? '');
        // Prüfe ob geloescht_am existiert (Migration ggf. noch nicht ausgeführt)
        $hasDelCol = DB::fetchOne("SHOW COLUMNS FROM " . DB::tbl('athleten') . " LIKE 'geloescht_am'");
        $baseWhere = $hasDelCol ? 'a.geloescht_am IS NULL' : '1=1';
        $params = [];
        if ($s) { $baseWhere .= ' AND a.name_nv LIKE ?'; $params[] = '%'.$s.'%'; }
        $anzSql = $unified
            ? "(SELECT COUNT(*) FROM " . DB::tbl('ergebnisse') . " WHERE athlet_id=a.id AND geloescht_am IS NULL)"
            : "(SELECT COUNT(*) FROM " . DB::tbl('ergebnisse_strasse') . " WHERE athlet_id=a.id)
               +(SELECT COUNT(*) FROM " . DB::tbl('ergebnisse_sprint') . " WHERE athlet_id=a.id)
               +(SELECT COUNT(*) FROM " . DB::tbl('ergebnisse_mittelstrecke') . " WHERE athlet_id=a.id)
               +(SELECT COUNT(*) FROM " . DB::tbl('ergebnisse_sprungwurf') . " WHERE athlet_id=a.id)";
        $rows = DB::fetchAll(
            "SELECT a.*, $anzSql AS anz_ergebnisse, b.avatar_pfad
             FROM " . DB::tbl('athleten') . " a
             LEFT JOIN " . DB::tbl('benutzer') . " b ON b.athlet_id = a.id
             WHERE $baseWhere ORDER BY a.name_nv", $params);
        // Gruppen je Athlet hinzufügen (defensiv: Tabelle könnte noch fehlen)
        try {
            foreach ($rows as &$row) {
                $row['gruppen'] = DB::fetchAll(
                    'SELECT g.id, g.name FROM ' . DB::tbl('gruppen') . ' g JOIN ' . DB::tbl('athlet_gruppen') . ' ag ON ag.gruppe_id=g.id WHERE ag.athlet_id=? ORDER BY g.name',
                    [$row['id']]);
            }
            unset($row);
        } catch (\Exception $e) {
            foreach ($rows as &$row) { $row['gruppen'] = []; }
            unset($row);
        }
        jsonOk($rows);
    }

    // ── Sub-Ressource: Auszeichnungen (HoF-Daten) für einen Athleten ──
    if ($method === 'GET' && $id && ($parts[2] ?? '') === 'auszeichnungen') {
        $athletId = (int)$id;
        // Vereinsbestleistungen aus HoF-Logik (vereinfacht: nur für diesen Athleten)
        $result = ['bestleistungen' => [], 'meisterschaften' => []];

        // Meisterschafts-Titel (1. Platz + Meisterschaft)
        $mstrListRaw = '';
        try { $mstrListRaw = DB::fetchOne('SELECT wert FROM ' . DB::tbl('einstellungen') . ' WHERE schluessel = ?', ['meisterschaften_liste'])['wert'] ?? ''; } catch(\Exception $e) {}
        $mstrMap = [];
        foreach (json_decode($mstrListRaw ?: '[]', true) ?: [] as $m) {
            if (!empty($m['id']) && !empty($m['label'])) $mstrMap[(int)$m['id']] = $m['label'];
        }
        if ($unified && !empty($mstrMap)) {
            $akExpr = buildAkCaseExpr(true);
            try {
                $firstPlaces = DB::fetchAll(
                    'SELECT e.meisterschaft, e.disziplin, e.altersklasse,' .
                    ' COALESCE(k.name, \'Sonstige\') AS kat_name, v.datum' .
                    ' FROM ' . DB::tbl('ergebnisse') . ' e' .
                    ' JOIN ' . DB::tbl('veranstaltungen') . ' v ON v.id = e.veranstaltung_id' .
                    ' LEFT JOIN ' . DB::tbl('disziplin_mapping') . ' m ON m.id = e.disziplin_mapping_id' .
                    ' LEFT JOIN ' . DB::tbl('disziplin_kategorien') . ' k ON k.id = m.kategorie_id' .
                    ' WHERE e.athlet_id = ? AND e.ak_platzierung = 1 AND e.meisterschaft IS NOT NULL AND e.geloescht_am IS NULL',
                    [$athletId]
                );
                // Athleten-Geschlecht für Suffix
                $athRow = DB::fetchOne('SELECT geschlecht FROM ' . DB::tbl('athleten') . ' WHERE id = ?', [$athletId]);
                $geschlecht = $athRow['geschlecht'] ?? '';
                $mSuffix = $geschlecht === 'M' ? '-Meister' : ($geschlecht === 'W' ? '-Meisterin' : '-Meister/in');
                foreach ($firstPlaces as $fp) {
                    $mId   = (int)($fp['meisterschaft'] ?? 0);
                    $mName = $mstrMap[$mId] ?? null;
                    if (!$mName) continue;
                    $disz = $fp['disziplin'] ?? '';
                    $kat  = $fp['kat_name'] ?? '';
                    $jahr = (int)substr($fp['datum'] ?? '', 0, 4);
                    $_sep = preg_match('/e$/i', $mName) ? ' ' : '-';
                    $label = $mName . $_sep . ltrim($mSuffix, '-') . ' ' . $disz . ($kat && $kat !== 'Sonstige' ? ' (' . $kat . ')' : '');
                    $result['meisterschaften'][] = ['label' => $label, 'jahr' => $jahr, 'disz' => $disz, 'kat' => $kat, 'mstr' => $mName];
                }
            } catch(\Exception $e) {}
        }

        // Vereinsbestleistungen: identische Logik wie Hall of Fame
        // Athlet-Geschlecht einmalig laden
        $athRow2 = DB::fetchOne('SELECT geschlecht FROM ' . DB::tbl('athleten') . ' WHERE id=?', [$athletId]);
        $athGeschlecht2 = $athRow2['geschlecht'] ?? '';
        if ($unified) {
            // AK-Merge-Ausdruck EINMALIG vor der Disziplin-Schleife bauen (wie HoF)
            $akExprAusz = buildAkCaseExpr(true);
            // Alle Disziplinen aller Athleten laden (wie HoF) – then check if this athlete holds a record
            $diszListAll = DB::fetchAll(
                "SELECT DISTINCT e.disziplin, e.disziplin_mapping_id,
                 COALESCE(m.fmt_override, k.fmt, 'min') AS fmt,
                 COALESCE(k.sort_dir,'ASC') AS sort_dir,
                 COALESCE(m.hof_exclude, 0) AS hof_exclude,
                 COALESCE(k.name, 'Sonstige') AS kat_name,
                 COALESCE(k.reihenfolge, 99) AS kat_sort
                 FROM " . DB::tbl('ergebnisse') . " e
                 LEFT JOIN " . DB::tbl('disziplin_mapping') . " m ON m.id=e.disziplin_mapping_id
                 LEFT JOIN " . DB::tbl('disziplin_kategorien') . " k ON k.id=m.kategorie_id
                 WHERE e.geloescht_am IS NULL
                 ORDER BY COALESCE(k.reihenfolge, 99), e.disziplin",
                []
            );
            foreach ($diszListAll as $dRow) {
                if (!empty($dRow['hof_exclude'])) continue;
                $disz    = $dRow['disziplin']; $mappingId = $dRow['disziplin_mapping_id'] ?? null;
                $fmt     = $dRow['fmt'] ?? 'min'; $dir = strtoupper($dRow['sort_dir'] ?? 'ASC');
                $katName = $dRow['kat_name'] ?? 'Sonstige';
                $valExpr = $fmt === 'm'
                    ? "COALESCE(e.resultat_num, CAST(e.resultat AS DECIMAL(10,3)))"
                    : "CASE WHEN e.resultat REGEXP '^[0-9]{1,2}:[0-9]{2}:[0-9]{2}' THEN TIME_TO_SEC(e.resultat)
                           WHEN e.resultat REGEXP '^[0-9]+:[0-9]' THEN TIME_TO_SEC(CONCAT('00:', REPLACE(e.resultat,',','.')))
                           ELSE CAST(REPLACE(e.resultat,',','.') AS DECIMAL(10,3)) END";
                $hofWhere = $mappingId ? 'e.disziplin_mapping_id = ?' : 'e.disziplin = ?';
                $hofParam = $mappingId ?? $disz;
                // Bestes dieses Athleten in dieser Disziplin
                $bestMe = DB::fetchOne(
                    "SELECT ($valExpr) AS val FROM " . DB::tbl('ergebnisse') . " e WHERE $hofWhere AND e.athlet_id=? AND e.geloescht_am IS NULL ORDER BY val $dir LIMIT 1",
                    [$hofParam, $athletId]
                );
                if (!$bestMe) continue;
                $myVal = (float)$bestMe['val'];
                // 1. Gesamtbestleistung?
                $bestAll = DB::fetchOne("SELECT ($valExpr) AS val FROM " . DB::tbl('ergebnisse') . " e WHERE $hofWhere AND e.geloescht_am IS NULL ORDER BY val $dir LIMIT 1", [$hofParam]);
                $isGesamtBest = $bestAll && abs($myVal - (float)$bestAll['val']) < 0.001;
                if ($isGesamtBest) {
                    $result['bestleistungen'][] = ['disziplin' => $disz, 'label' => 'Gesamtbestleistung', 'kat_name' => $katName];
                    // Kein continue – AK-Checks laufen weiter (andere Jahre = andere AK-Rekorde)
                }
                // 2. Geschlechts-Bestleistung? (nur wenn nicht bereits Tier 1)
                if (!$isGesamtBest && ($athGeschlecht2 === 'M' || $athGeschlecht2 === 'W')) {
                    $bestG = DB::fetchOne(
                        "SELECT ($valExpr) AS val FROM " . DB::tbl('ergebnisse') . " e JOIN " . DB::tbl('athleten') . " a ON a.id=e.athlet_id WHERE $hofWhere AND a.geschlecht=? AND e.geloescht_am IS NULL ORDER BY val $dir LIMIT 1",
                        [$hofParam, $athGeschlecht2]
                    );
                    if ($bestG && abs($myVal - (float)$bestG['val']) < 0.001) {
                        $gLabel = $athGeschlecht2 === 'M' ? 'Gesamtbestleistung Männer' : 'Gesamtbestleistung Frauen';
                        $result['bestleistungen'][] = ['disziplin' => $disz, 'label' => $gLabel, 'kat_name' => $katName];
                    }
                }
                // 3. AK-Bestleistung? (immer prüfen, unabhängig von Gesamt/Geschlecht – wie HoF)
                // Altersklasse(n) dieses Athleten in dieser Disziplin ermitteln
                // AKs dieses Athleten MIT merge (identisch zu HoF)
                $myAKs = DB::fetchAll(
                    "SELECT DISTINCT ($akExprAusz) AS altersklasse FROM " . DB::tbl('ergebnisse') . " e WHERE $hofWhere AND e.athlet_id=? AND ($akExprAusz) IS NOT NULL AND ($akExprAusz) != '' AND e.geloescht_am IS NULL",
                    [$hofParam, $athletId]
                );
                foreach ($myAKs as $akRow) {
                    $ak = $akRow['altersklasse'];
                    // Bestes in dieser (merged) AK über alle Athleten
                    $bestAK = DB::fetchOne(
                        "SELECT ($valExpr) AS val FROM " . DB::tbl('ergebnisse') . " e WHERE $hofWhere AND ($akExprAusz)=? AND e.geloescht_am IS NULL ORDER BY val $dir LIMIT 1",
                        [$hofParam, $ak]
                    );
                    // Bestes dieses Athleten in dieser (merged) AK
                    $bestMeAK = DB::fetchOne(
                        "SELECT ($valExpr) AS val FROM " . DB::tbl('ergebnisse') . " e WHERE $hofWhere AND e.athlet_id=? AND ($akExprAusz)=? AND e.geloescht_am IS NULL ORDER BY val $dir LIMIT 1",
                        [$hofParam, $athletId, $ak]
                    );
                    if ($bestAK && $bestMeAK && abs((float)$bestMeAK['val'] - (float)$bestAK['val']) < 0.001) {
                        // Überspringen wenn identisch mit bereits gezählter Gesamtbestleistung
                        if ($isGesamtBest && abs((float)$bestMeAK['val'] - $myVal) < 0.001) continue;
                        $akLbl = preg_replace('/\s+[0-9]+[,.]?[0-9]*\s*kg$/i', '', $ak);
                        $result['bestleistungen'][] = ['disziplin' => $disz, 'label' => 'Bestleistung ' . $akLbl, 'kat_name' => $katName];
                    }
                }
            }
        }

        jsonOk($result);
    }

    if ($method === 'GET' && $id) {
        $hasDelColA = DB::fetchOne("SHOW COLUMNS FROM " . DB::tbl('athleten') . " LIKE 'geloescht_am'");
        $athlet = $hasDelColA
            ? DB::fetchOne('SELECT a.*, b.avatar_pfad FROM ' . DB::tbl('athleten') . ' a LEFT JOIN ' . DB::tbl('benutzer') . ' b ON b.athlet_id=a.id WHERE a.id=? AND a.geloescht_am IS NULL', [$id])
            : DB::fetchOne('SELECT a.*, b.avatar_pfad FROM ' . DB::tbl('athleten') . ' a LEFT JOIN ' . DB::tbl('benutzer') . ' b ON b.athlet_id=a.id WHERE a.id=?', [$id]);
        if (!$athlet) jsonErr('Nicht gefunden.', 404);
        try {
            $athlet['gruppen'] = DB::fetchAll('SELECT g.id, g.name FROM ' . DB::tbl('gruppen') . ' g JOIN ' . DB::tbl('athlet_gruppen') . ' ag ON ag.gruppe_id=g.id WHERE ag.athlet_id=? ORDER BY g.name', [$id]);
        } catch (\Exception $e) { $athlet['gruppen'] = []; }
        // Avatar aus verknüpftem Benutzer laden
        $bUser = DB::fetchOne('SELECT avatar_pfad FROM ' . DB::tbl('benutzer') . ' WHERE athlet_id = ? AND aktiv = 1 LIMIT 1', [$id]);
        $athlet['avatar_pfad'] = $bUser ? $bUser['avatar_pfad'] : null;
        if ($unified) {
            $alle = DB::fetchAll(
                'SELECT e.id, e.disziplin, e.disziplin_mapping_id, e.resultat, e.pace, e.altersklasse, e.meisterschaft,
                        v.kuerzel AS veranstaltung, v.ort AS veranstaltung_ort, v.name AS veranstaltung_name, v.datum,
                        COALESCE(dm.fmt_override, dk.fmt, \'min\') AS fmt,
                        COALESCE(dk.name, \'Sonstige\') AS kat_name,
                        COALESCE(dk.reihenfolge, 99) AS kat_sort
                 FROM ' . DB::tbl('ergebnisse') . ' e
                 JOIN ' . DB::tbl('veranstaltungen') . ' v ON v.id=e.veranstaltung_id
                 LEFT JOIN ' . DB::tbl('disziplin_mapping') . ' dm ON dm.id=e.disziplin_mapping_id
                 LEFT JOIN ' . DB::tbl('disziplin_kategorien') . ' dk ON dk.id=dm.kategorie_id
                 WHERE e.athlet_id=? AND e.geloescht_am IS NULL ORDER BY dk.reihenfolge, v.datum DESC', [$id]);
            // Gruppieren nach Kategorie
            $kategorien = [];
            foreach ($alle as $row) {
                $kn = $row['kat_name'];
                if (!isset($kategorien[$kn])) {
                    $kategorien[$kn] = [
                        'name' => $kn,
                        'fmt'  => $row['fmt'],
                        'ergebnisse' => []
                    ];
                }
                $kategorien[$kn]['ergebnisse'][] = $row;
            }
            $kategorien = array_values($kategorien);
            // Externe PBs mitsenden
            $pbs = DB::fetchAll('SELECT pb.id, pb.disziplin, pb.resultat, pb.wettkampf, pb.datum, pb.verein, pb.altersklasse,
                        pb.disziplin_mapping_id,
                        COALESCE(dm.fmt_override, dk.fmt, \'min\') AS fmt,
                        COALESCE(dk.name, \'Sonstige\') AS kat_name,
                        COALESCE(dk.reihenfolge, 99) AS kat_sort,
                        COALESCE(dm.disziplin, pb.disziplin) AS disziplin_mapped
                 FROM ' . DB::tbl('athlet_pb') . ' pb
                 LEFT JOIN ' . DB::tbl('disziplin_mapping') . ' dm ON dm.id=pb.disziplin_mapping_id
                 LEFT JOIN ' . DB::tbl('disziplin_kategorien') . ' dk ON dk.id=dm.kategorie_id
                 WHERE pb.athlet_id=? ORDER BY dk.reihenfolge, pb.disziplin', [(int)$id]);
            jsonOk(compact('athlet','kategorien','pbs'));
        } else {
            $strasse = DB::fetchAll('SELECT e.*,v.kuerzel AS veranstaltung,v.ort AS veranstaltung_ort,v.name AS veranstaltung_name,v.datum FROM ' . DB::tbl('ergebnisse_strasse') . ' e JOIN ' . DB::tbl('veranstaltungen') . ' v ON v.id=e.veranstaltung_id WHERE e.athlet_id=? AND e.geloescht_am IS NULL ORDER BY v.datum DESC', [$id]);
            $sprint  = DB::fetchAll('SELECT e.*,v.kuerzel AS veranstaltung,v.ort AS veranstaltung_ort,v.name AS veranstaltung_name,v.datum FROM ' . DB::tbl('ergebnisse_sprint') . ' e JOIN ' . DB::tbl('veranstaltungen') . ' v ON v.id=e.veranstaltung_id WHERE e.athlet_id=? AND e.geloescht_am IS NULL ORDER BY v.datum DESC', [$id]);
            $mittel  = DB::fetchAll('SELECT e.*,v.kuerzel AS veranstaltung,v.ort AS veranstaltung_ort,v.name AS veranstaltung_name,v.datum FROM ' . DB::tbl('ergebnisse_mittelstrecke') . ' e JOIN ' . DB::tbl('veranstaltungen') . ' v ON v.id=e.veranstaltung_id WHERE e.athlet_id=? AND e.geloescht_am IS NULL ORDER BY v.datum DESC', [$id]);
            $sw      = DB::fetchAll('SELECT e.*,v.kuerzel AS veranstaltung,v.ort AS veranstaltung_ort,v.name AS veranstaltung_name,v.datum FROM ' . DB::tbl('ergebnisse_sprungwurf') . ' e JOIN ' . DB::tbl('veranstaltungen') . ' v ON v.id=e.veranstaltung_id WHERE e.athlet_id=? AND e.geloescht_am IS NULL ORDER BY v.datum DESC', [$id]);
            jsonOk(compact('athlet','strasse','sprint','mittel','sw'));
        }
    }

    if ($method === 'POST') {
        Auth::requireEditor();
        $nv = sanitize($body['name_nv'] ?? '');
        $nn = sanitize($body['nachname'] ?? '');
        $vn = sanitize($body['vorname'] ?? '');
        if (!$nv || !$nn) jsonErr('Name erforderlich.');
        $gebj = intOrNull($body['geburtsjahr'] ?? null);
        try {
            DB::query('INSERT INTO ' . DB::tbl('athleten') . ' (name_nv,nachname,vorname,geschlecht,geburtsjahr) VALUES (?,?,?,?,?)',
                [$nv, $nn, $vn, sanitize($body['geschlecht'] ?? ''), $gebj]);
            $newId = DB::lastInsertId();
            // Gruppen zuordnen
            if (!empty($body['gruppen']) && is_array($body['gruppen'])) {
                foreach ($body['gruppen'] as $gname) {
                    $gname = trim(sanitize($gname));
                    if (!$gname) continue;
                    $g = DB::fetchOne('SELECT id FROM ' . DB::tbl('gruppen') . ' WHERE name=?', [$gname]);
                    if (!$g) { DB::query('INSERT INTO ' . DB::tbl('gruppen') . ' (name) VALUES (?)', [$gname]); $gid = DB::lastInsertId(); }
                    else $gid = $g['id'];
                    DB::query('INSERT IGNORE INTO ' . DB::tbl('athlet_gruppen') . ' (athlet_id,gruppe_id) VALUES (?,?)', [$newId, $gid]);
                }
            }
            jsonOk(['id' => $newId]);
        } catch (\Exception $e) {
            jsonErr('Athlet bereits vorhanden.');
        }
    }

    if ($method === 'POST' && $id && ($parts[2] ?? '') === 'profil-antrag') {
        $user = Auth::requireLogin();
        $athletId = (int)$id;
        // Prüfe ob dieser Athlet dem eingeloggten User gehört
        $buRow = DB::fetchOne('SELECT athlet_id FROM ' . DB::tbl('benutzer') . ' WHERE id = ?', [$user['id']]);
        if (!$buRow || (int)$buRow['athlet_id'] !== $athletId) jsonErr('Keine Berechtigung.', 403);
        // Erlaubte Felder
        $allowed = ['vorname','nachname','geschlecht','geburtsjahr'];
        $changes = [];
        foreach ($allowed as $f) {
            if (array_key_exists($f, $body)) $changes[$f] = $body[$f];
        }
        if (!$changes) jsonErr('Keine Änderungen angegeben.');
        DB::query('INSERT INTO ' . DB::tbl('ergebnis_aenderungen') .
            ' (ergebnis_id, ergebnis_tbl, typ, neue_werte, beantragt_von) VALUES (?,?,?,?,?)',
            [$athletId, 'athleten', 'update', json_encode($changes), $user['id']]);
        jsonOk(['pending' => true, 'msg' => 'Änderungsantrag gestellt. Wird von einem Editor oder Admin geprüft.']);
    }

    if ($method === 'PUT' && $id) {
        Auth::requireEditor();
        $felder = []; $params = [];
        if (isset($body['nachname']))    { $felder[] = 'nachname=?';    $params[] = sanitize($body['nachname']); }
        if (isset($body['vorname']))     { $felder[] = 'vorname=?';     $params[] = sanitize($body['vorname']); }
        if (isset($body['name_nv']))     { $felder[] = 'name_nv=?';     $params[] = sanitize($body['name_nv']); }
        if (isset($body['geschlecht']))  { $felder[] = 'geschlecht=?';  $params[] = sanitize($body['geschlecht']); }
        if (isset($body['ak_aktuell']))  { $felder[] = 'ak_aktuell=?';  $params[] = sanitize($body['ak_aktuell']); }
        if (isset($body['gruppe']))      { $felder[] = 'gruppe=?';      $params[] = sanitize($body['gruppe']); }
        if (isset($body['geburtsjahr'])){ $felder[] = 'geburtsjahr=?';$params[] = ($body['geburtsjahr'] ? intval($body['geburtsjahr']) : null); }
        if (isset($body['aktiv']))       { $felder[] = 'aktiv=?';       $params[] = (int)$body['aktiv']; }
        if (!$felder) jsonErr('Keine Änderungen.');
        $params[] = $id;
        try {
            DB::query('UPDATE ' . DB::tbl('athleten') . ' SET ' . implode(',', $felder) . ' WHERE id=?', $params);
        } catch (\Exception $e) {
            jsonErr('Name bereits vorhanden.');
        }
        // Gruppen aktualisieren (falls mitgesendet)
        if (isset($body['gruppen']) && is_array($body['gruppen'])) {
            DB::query('DELETE FROM ' . DB::tbl('athlet_gruppen') . ' WHERE athlet_id=?', [$id]);
            foreach ($body['gruppen'] as $gname) {
                $gname = trim(sanitize($gname));
                if (!$gname) continue;
                $g = DB::fetchOne('SELECT id FROM ' . DB::tbl('gruppen') . ' WHERE name=?', [$gname]);
                if (!$g) { DB::query('INSERT INTO ' . DB::tbl('gruppen') . ' (name) VALUES (?)', [$gname]); $gid = DB::lastInsertId(); }
                else $gid = $g['id'];
                DB::query('INSERT IGNORE INTO ' . DB::tbl('athlet_gruppen') . ' (athlet_id,gruppe_id) VALUES (?,?)', [$id, $gid]);
            }
        }
        jsonOk('Gespeichert.');
    }

    if ($method === 'DELETE' && $id) {
        Auth::requireAdmin();
        $eTbl = ergebnisTbl('strasse', $unified, $_sys);
        $anz = DB::fetchOne("SELECT COUNT(*) c FROM $eTbl WHERE athlet_id=? AND geloescht_am IS NULL", [$id])['c'];
        if ($anz > 0)
            jsonErr('Athlet hat ' . $anz . ' aktive Ergebnisse und kann nicht gelöscht werden.', 409);
        DB::query("UPDATE " . DB::tbl('athleten') . " SET geloescht_am=NOW() WHERE id=?", [$id]);
        jsonOk('In Papierkorb verschoben.');
    }
}

if ($res === 'rekorde') {
    // Bestleistungen sind öffentlich zugänglich (kein Login erforderlich)

    // Prüfe ob einheitliche Tabelle bereits existiert
    $tblCheck = DB::fetchOne("SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='ergebnisse'");
    $unified = $tblCheck && (int)$tblCheck['c'] > 0;

    // Legacy-Mapping: alte Tabellen je nach Disziplin-Mapping
    $sys_tbls = [
        'strasse'       => ['ergebnisse_strasse',      'ASC',  'min'],
        'sprint'        => ['ergebnisse_sprint',        'ASC',  's'],
        'mittelstrecke' => ['ergebnisse_mittelstrecke', 'ASC',  'min'],
        'sprungwurf'    => ['ergebnisse_sprungwurf',    'DESC', 'm'],
    ];

    // Kategorieinfo aus disziplin_kategorien
    $katInfo = [];
    try {
        $rows = DB::fetchAll("SELECT tbl_key, sort_dir, fmt FROM " . DB::tbl('disziplin_kategorien') . "");
        foreach ($rows as $r) $katInfo[$r['tbl_key']] = $r;
    } catch (Exception $e) {}
    // Fallback: sys_tbls
    foreach ($sys_tbls as $k => $v) {
        if (!isset($katInfo[$k])) $katInfo[$k] = ['tbl_key'=>$k,'sort_dir'=>$v[1],'fmt'=>$v[2]];
    }

    // Disziplinen einer Kategorie ermitteln – gibt [{disziplin, mapping_id}] zurück
    $getDiszByKat = function(string $kat_key) use ($unified, $sys_tbls): array {
        try {
            $kr = DB::fetchOne("SELECT id FROM " . DB::tbl('disziplin_kategorien') . " WHERE tbl_key=?", [$kat_key]);
            if ($kr) {
                $rows = DB::fetchAll("SELECT id AS mapping_id, disziplin FROM " . DB::tbl('disziplin_mapping') . " WHERE kategorie_id=?", [$kr['id']]);
                if ($rows) {
                    sortDisziplinen($rows);
                    return $rows;
                }
            }
        } catch (Exception $e) {}
        // Fallback: direkt aus Ergebnisse (ohne Mapping)
        $tbl = $unified ? 'ergebnisse' : ($sys_tbls[$kat_key][0] ?? null);
        if (!$tbl) return [];
        try {
            $rows = DB::fetchAll("SELECT DISTINCT disziplin, NULL AS mapping_id FROM $tbl WHERE disziplin IS NOT NULL AND disziplin != '' AND geloescht_am IS NULL");
            sortDisziplinen($rows);
            return $rows;
        } catch (Exception $e) { return []; }
    };

    // Quelltabelle für eine Disziplin ermitteln (Legacy)
    $getTblForDisz = function(string $disz) use ($unified, $sys_tbls): string {
        if ($unified) return 'ergebnisse';
        foreach ($sys_tbls as $k => $v) {
            try {
                $ex = DB::fetchOne("SELECT 1 FROM {$v[0]} WHERE disziplin=? LIMIT 1", [$disz]);
                if ($ex) return $v[0];
            } catch (Exception $e) {}
        }
        return 'ergebnisse_strasse'; // Fallback
    };

    // GET rekorde/top-disziplinen?kat=
    if ($method === 'GET' && $id === 'top-disziplinen') {
        $kat  = $_GET['kat'] ?? '';
        $diszList = $getDiszByKat($kat);
        if (!$diszList) jsonOk([]);
        $counts = [];
        foreach ($diszList as $d) {
            $tbl = $getTblForDisz($d['disziplin']);
            if ($d['mapping_id']) {
                $cnt = DB::fetchOne("SELECT COUNT(*) AS c FROM $tbl WHERE disziplin_mapping_id=? AND geloescht_am IS NULL", [$d['mapping_id']]);
            } else {
                $cnt = DB::fetchOne("SELECT COUNT(*) AS c FROM $tbl WHERE disziplin=? AND disziplin_mapping_id IS NULL AND geloescht_am IS NULL", [$d['disziplin']]);
            }
            $counts[] = ['disziplin' => $d['disziplin'], 'mapping_id' => $d['mapping_id'], 'cnt' => $cnt ? (int)$cnt['c'] : 0];
        }
        // Favorisierte Disziplinen aus Einstellungen
        $favJson = Settings::get('top_disziplinen','');
        $favListRaw = $favJson ? (json_decode($favJson, true) ?: []) : [];
        // Favoriten als mapping_id-Array (Integer); alte Name-Arrays ignorieren
        $favList = array_values(array_filter(array_map('intval', $favListRaw), function($v){ return $v > 0; }));
        // Zuerst: favorisierte (in konfigurierter Reihenfolge), dann: Rest nach Häufigkeit
        $favResult = [];  // mapping_id -> $c
        $restResult = [];
        foreach ($counts as $c) {
            if ($c['mapping_id'] && in_array((int)$c['mapping_id'], $favList)) $favResult[(int)$c['mapping_id']] = $c;
            else $restResult[] = $c;
        }
        // Favorisierte in konfigurierter Reihenfolge
        $orderedFav = [];
        foreach ($favList as $fid) {
            if (isset($favResult[$fid])) $orderedFav[] = $favResult[$fid];
        }
        usort($restResult, function($a,$b){ return $b['cnt'] - $a['cnt']; });
        if ($orderedFav) {
            // Favoriten konfiguriert: NUR Favoriten (sortiert nach Anzahl), keine weiteren
            usort($orderedFav, function($a,$b){ return $b['cnt'] - $a['cnt']; });
            jsonOk($orderedFav);
        } else {
            // Keine Favoriten: Top 5 nach Häufigkeit
            jsonOk(array_slice($restResult, 0, 5));
        }
    }

    // GET rekorde/disziplinen?kat=
    if ($method === 'GET' && $id === 'disziplinen') {
        $kat  = $_GET['kat'] ?? '';
        $diszList = $getDiszByKat($kat);
        $result = [];
        foreach ($diszList as $d) {
            $tbl = $getTblForDisz($d['disziplin']);
            if ($d['mapping_id']) {
                $cnt = DB::fetchOne("SELECT COUNT(*) AS c FROM $tbl WHERE disziplin_mapping_id=? AND geloescht_am IS NULL", [$d['mapping_id']]);
            } else {
                $cnt = DB::fetchOne("SELECT COUNT(*) AS c FROM $tbl WHERE disziplin=? AND disziplin_mapping_id IS NULL AND geloescht_am IS NULL", [$d['disziplin']]);
            }
            $result[] = ['disziplin' => $d['disziplin'], 'mapping_id' => $d['mapping_id'], 'cnt' => $cnt ? (int)$cnt['c'] : 0];
        }
        usort($result, function($a,$b){ return $b['cnt'] - $a['cnt']; });
        jsonOk($result);
    }

    // GET rekorde?kat=&disz=&mapping_id=
    if ($method === 'GET' && !$id) {
        $kat       = $_GET['kat']        ?? '';
        $disz      = $_GET['disz']       ?? '';
        $mappingId = isset($_GET['mapping_id']) && is_numeric($_GET['mapping_id']) ? (int)$_GET['mapping_id'] : null;
        if (!$kat || !$disz) jsonErr('kat und disz erforderlich.', 400);

        $tbl = $getTblForDisz($disz);
        $dir = $katInfo[$kat]['sort_dir'] ?? 'ASC';
        $fmt = $katInfo[$kat]['fmt']      ?? 'min';

        // Filter-Kondition und Parameter je nach mapping_id
        if ($mappingId) {
            $diszCond  = "e.disziplin_mapping_id=?";
            $diszParam = $mappingId;
        } else {
            // Fallback: mapping_id aus (kat, disz) ermitteln
            $katRow = DB::fetchOne("SELECT id FROM " . DB::tbl('disziplin_kategorien') . " WHERE tbl_key=?", [$kat]);
            $mRow   = $katRow ? DB::fetchOne(
                "SELECT id FROM " . DB::tbl('disziplin_mapping') . " WHERE disziplin=? AND kategorie_id=?",
                [$disz, $katRow['id']]
            ) : null;
            if ($mRow) {
                $diszCond  = "e.disziplin_mapping_id=?";
                $diszParam = $mRow['id'];
            } else {
                // Letzter Fallback: nur per Name (kann bei gleichnamigen Disziplinen mischen)
                $diszCond  = "e.disziplin=?";
                $diszParam = $disz;
            }
        }

        $nameExpr = "CONCAT(COALESCE(a.nachname,''), IF(a.vorname IS NOT NULL AND a.vorname != '', CONCAT(', ', a.vorname), ''))";
        $joinVer  = "JOIN " . DB::tbl('veranstaltungen') . " v ON v.id = e.veranstaltung_id";
        $mergeAK  = ($_GET['merge_ak'] ?? '1') !== '0';
        $akExpr   = buildAkCaseExpr($mergeAK);

        // Sortierung: denselben valExpr wie Timeline verwenden (korrekte Umrechnung)
        if ($fmt === 'm') {
            $sortCol = "COALESCE(e.resultat_num, CAST(e.resultat AS DECIMAL(10,3)))";
        } else {
            // MM:SS.x → TIME_TO_SEC(CONCAT('00:',resultat)) für korrekte Sekunden
            // CONCAT('00:') wandelt '16:07' → '00:16:07' = 967s statt 58020s (HH:MM)
            $sortCol = $unified
                ? "COALESCE(e.resultat_num,
                    CASE WHEN e.resultat REGEXP '^[0-9]{1,2}:[0-9]{2}:[0-9]{2}'
                         THEN TIME_TO_SEC(e.resultat)
                         WHEN e.resultat REGEXP '^[0-9]+:[0-9]'
                         THEN TIME_TO_SEC(CONCAT('00:',REPLACE(REPLACE(e.resultat,',','.'),';','.')))
                         ELSE CAST(REPLACE(e.resultat,',','.') AS DECIMAL(10,3)) END)"
                : "LPAD(e.resultat, 10, '0')";
        }
        $paceField = ($fmt === 'min' && (strpos($tbl,'strasse') !== false || $unified)) ? ", e.pace" : "";

        // Hilfsfunktion: Bestleistung pro Athlet
        // Strategie: SQL liefert ALLE Ergebnisse sortiert nach Ergebnis,
        // PHP dedupliziert (erster Treffer pro athlet_id = Bestleistung).
        // Einfach, robust, ohne GROUP-BY/Subquery-Aliasing-Probleme.
        $pbDedup = function(array $rows) use ($unique): array {
            if (!$unique) return $rows;
            $seen = []; $out = [];
            foreach ($rows as $r) {
                $aid = $r['athlet_id'];
                if (!isset($seen[$aid])) { $seen[$aid] = true; $out[] = $r; }
            }
            return $out;
        };

        $all_rows = DB::fetchAll(
            "SELECT e.resultat $paceField, v.datum, $akExpr AS altersklasse,
                    $nameExpr AS athlet, a.id AS athlet_id, a.geschlecht
             FROM $tbl e JOIN " . DB::tbl('athleten') . " a ON a.id = e.athlet_id $joinVer
             WHERE $diszCond AND e.geloescht_am IS NULL
               AND a.geloescht_am IS NULL AND v.geloescht_am IS NULL
             ORDER BY $sortCol $dir", [$diszParam]);

        $top_gesamt = array_slice($pbDedup($all_rows), 0, 50);

        $top_m = array_slice($pbDedup(array_values(array_filter($all_rows, function($r) {
            return $r['geschlecht'] === 'M' || ($r['geschlecht'] === null && strpos((string)$r['altersklasse'], 'M') === 0);
        }))), 0, 50);

        $top_w = array_slice($pbDedup(array_values(array_filter($all_rows, function($r) {
            return $r['geschlecht'] === 'W' || ($r['geschlecht'] === null && (strpos((string)$r['altersklasse'], 'W') === 0 || strpos((string)$r['altersklasse'], 'F') === 0));
        }))), 0, 50);

        $aks_rows = DB::fetchAll(
            "SELECT DISTINCT $akExpr AS altersklasse FROM $tbl e
             JOIN " . DB::tbl('veranstaltungen') . " v ON v.id = e.veranstaltung_id
             JOIN " . DB::tbl('athleten') . " a ON a.id = e.athlet_id
             WHERE $diszCond AND e.altersklasse IS NOT NULL AND e.altersklasse != ''
               AND e.geloescht_am IS NULL AND a.geloescht_am IS NULL AND v.geloescht_am IS NULL
             ORDER BY altersklasse", [$diszParam]);
        $all_ak = [];
        foreach ($aks_rows as $ak_row) {
            $ak_val = $ak_row['altersklasse'];
            $ak_rows_raw = array_values(array_filter($all_rows, function($r) use ($ak_val) {
                return (string)$r['altersklasse'] === (string)$ak_val;
            }));
            $all_ak[$ak_val] = array_slice($pbDedup($ak_rows_raw), 0, 50);
        }

        jsonOk([
            'gesamt'  => $top_gesamt,
            'maenner' => $top_m,
            'frauen'  => $top_w,
            'by_ak'   => $all_ak,
            'dir'     => $dir,
            'kat'     => $kat,
            'disz'    => $disz,
        ]);
    }
}

// ============================================================
// DISZIPLIN-KATEGORIEN (Admin)
// ============================================================
if ($res === 'kategorien') {
    // GET ist öffentlich; schreibende Methoden erfordern Admin
    if ($method !== 'GET') Auth::requireAdmin();

    // GET alle Kategorien mit Disziplin-Anzahl
    if ($method === 'GET' && !$id) {
        DB::query("CREATE TABLE IF NOT EXISTS disziplin_kategorien (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(80) NOT NULL UNIQUE,
            tbl_key VARCHAR(40) NOT NULL UNIQUE,
            fmt VARCHAR(20) NOT NULL DEFAULT 'min',
            sort_dir ENUM('ASC','DESC') NOT NULL DEFAULT 'ASC',
            reihenfolge INT NOT NULL DEFAULT 99,
            erstellt_am DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        DB::query("INSERT IGNORE INTO " . DB::tbl('disziplin_kategorien') . " (name,tbl_key,fmt,sort_dir,reihenfolge) VALUES
            ('Straße','strasse','min','ASC',1),
            ('Sprint','sprint','s','ASC',2),
            ('Mittelstrecke','mittelstrecke','min','ASC',3),
            ('Sprung & Wurf','sprungwurf','m','DESC',4)");
        // disz_anzahl = Anzahl gemappter Disziplinen pro Kategorie (aus einheitlicher Tabelle)
        $rows = DB::fetchAll(
            "SELECT k.*, COUNT(m.id) AS disz_anzahl
             FROM " . DB::tbl('disziplin_kategorien') . " k
             LEFT JOIN " . DB::tbl('disziplin_mapping') . " m ON m.kategorie_id = k.id
             GROUP BY k.id ORDER BY k.reihenfolge, k.name");
        jsonOk($rows);
    }

    // POST neue Kategorie
    if ($method === 'POST' && !$id) {
        $name     = trim($body['name'] ?? '');
        $tbl_key  = trim($body['tbl_key'] ?? '');
        $fmt      = $body['fmt']      ?? 'min';
        $sort_dir = $body['sort_dir'] ?? 'ASC';
        $reihenfolge = intval($body['reihenfolge'] ?? 99);
        if (!$name || !$tbl_key) jsonErr('Name und Schlüssel erforderlich.', 400);
        if (!preg_match('/^[a-z0-9_]+$/', $tbl_key)) jsonErr('Schlüssel: nur a-z, 0-9, _', 400);
        DB::query("INSERT INTO " . DB::tbl('disziplin_kategorien') . " (name,tbl_key,fmt,sort_dir,reihenfolge) VALUES (?,?,?,?,?)",
            [$name, $tbl_key, $fmt, $sort_dir, $reihenfolge]);
        jsonOk(['id' => DB::lastInsertId()]);
    }

    // PUT Kategorie umbenennen/ändern
    if ($method === 'PUT' && $id) {
        $name     = trim($body['name'] ?? '');
        $fmt      = $body['fmt']      ?? null;
        $sort_dir = $body['sort_dir'] ?? null;
        $reihenfolge = isset($body['reihenfolge']) ? intval($body['reihenfolge']) : null;
        $sets = []; $params = [];
        if ($name)        { $sets[] = 'name=?';        $params[] = $name; }
        if ($fmt)         { $sets[] = 'fmt=?';          $params[] = $fmt; }
        if ($sort_dir)    { $sets[] = 'sort_dir=?';     $params[] = $sort_dir; }
        if ($reihenfolge !== null) { $sets[] = 'reihenfolge=?'; $params[] = $reihenfolge; }
        if (!$sets) jsonErr('Nichts zu aktualisieren.', 400);
        $params[] = $id;
        DB::query("UPDATE " . DB::tbl('disziplin_kategorien') . " SET " . implode(',', $sets) . " WHERE id=?", $params);
        jsonOk(null);
    }

    // DELETE Kategorie (nur wenn keine Disziplinen zugeordnet)
    if ($method === 'DELETE' && $id) {
        $cnt = DB::fetchOne("SELECT COUNT(*) AS c FROM " . DB::tbl('disziplin_mapping') . " WHERE kategorie_id=?", [$id])['c'];
        if ($cnt > 0) jsonErr('Kategorie hat noch ' . $cnt . ' zugeordnete Disziplinen. Bitte zuerst umordnen.', 409);
        // Systemkategorien nur sperren wenn ihre Legacy-Tabelle noch Daten enthält
        $kat = DB::fetchOne("SELECT tbl_key FROM " . DB::tbl('disziplin_kategorien') . " WHERE id=?", [$id]);
        $sysTbls = ['strasse'=>'ergebnisse_strasse','sprint'=>'ergebnisse_sprint',
                    'mittelstrecke'=>'ergebnisse_mittelstrecke','sprungwurf'=>'ergebnisse_sprungwurf'];
        if ($kat && isset($sysTbls[$kat['tbl_key']])) {
            $legacyTbl = DB::tbl($sysTbls[$kat['tbl_key']]);
            try {
                $legacyCnt = DB::fetchOne("SELECT COUNT(*) AS c FROM $legacyTbl WHERE geloescht_am IS NULL")['c'];
                if ($legacyCnt > 0) jsonErr('Legacy-Tabelle enthält noch ' . $legacyCnt . ' Einträge. Bitte zuerst migrieren.', 409);
            } catch (Exception $e) { /* Tabelle existiert nicht → OK */ }
        }
        DB::query("DELETE FROM " . DB::tbl('disziplin_kategorien') . " WHERE id=?", [$id]);
        jsonOk(null);
    }
}

// ============================================================
// DISZIPLIN-MAPPING (Admin)
// ============================================================
if ($res === 'disziplin-mapping') {
    Auth::requireAdmin();

    // GET alle Disziplinen aller Kategorien mit Mapping
    if ($method === 'GET' && !$id) {
        // Tabellen + Spalten automatisch anlegen (idempotent)
        DB::query("CREATE TABLE IF NOT EXISTS disziplin_kategorien (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(80) NOT NULL UNIQUE,
            tbl_key VARCHAR(40) NOT NULL UNIQUE,
            fmt VARCHAR(20) NOT NULL DEFAULT 'min',
            sort_dir ENUM('ASC','DESC') NOT NULL DEFAULT 'ASC',
            reihenfolge INT NOT NULL DEFAULT 99,
            erstellt_am DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        DB::query("INSERT IGNORE INTO " . DB::tbl('disziplin_kategorien') . " (name,tbl_key,fmt,sort_dir,reihenfolge) VALUES
            ('Straße','strasse','min','ASC',1),
            ('Sprint','sprint','s','ASC',2),
            ('Mittelstrecke','mittelstrecke','min','ASC',3),
            ('Sprung & Wurf','sprungwurf','m','DESC',4)");
        DB::query("CREATE TABLE IF NOT EXISTS disziplin_mapping (
            id INT AUTO_INCREMENT PRIMARY KEY,
            disziplin VARCHAR(60) NOT NULL,
            kategorie_id INT NOT NULL,
            anzeige_name VARCHAR(60) NULL,
            fmt_override VARCHAR(20) NULL,
            UNIQUE KEY uq_disz_kat (disziplin, kategorie_id),
            FOREIGN KEY (kategorie_id) REFERENCES disziplin_kategorien(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        // Migration: alter UNIQUE KEY (nur disziplin) → (disziplin, kategorie_id)
        try { DB::query("ALTER TABLE " . DB::tbl('disziplin_mapping') . " DROP INDEX uq_disz"); } catch (Exception $e) {}
        try { DB::query("ALTER TABLE " . DB::tbl('disziplin_mapping') . " DROP INDEX disziplin"); } catch (Exception $e) {}
        try { DB::query("ALTER TABLE " . DB::tbl('disziplin_mapping') . " ADD UNIQUE KEY uq_disz_kat (disziplin, kategorie_id)"); } catch (Exception $e) {}
        try { DB::query("ALTER TABLE " . DB::tbl('disziplin_mapping') . " ADD COLUMN IF NOT EXISTS anzeige_name VARCHAR(60) NULL"); } catch (Exception $e) {}
        try { DB::query("ALTER TABLE " . DB::tbl('disziplin_mapping') . " ADD COLUMN IF NOT EXISTS fmt_override  VARCHAR(20) NULL"); } catch (Exception $e) {}
        try { DB::query("ALTER TABLE " . DB::tbl('disziplin_mapping') . " ADD COLUMN IF NOT EXISTS kat_suffix_override VARCHAR(10) NULL"); } catch (Exception $e) {}
        try { DB::query("ALTER TABLE " . DB::tbl('disziplin_mapping') . " ADD COLUMN IF NOT EXISTS hof_exclude TINYINT(1) NOT NULL DEFAULT 0"); } catch (Exception $e) {}
        // v630: distanz in disziplin_mapping
        try { DB::query("ALTER TABLE " . DB::tbl('disziplin_mapping') . " ADD COLUMN IF NOT EXISTS distanz FLOAT DEFAULT NULL COMMENT 'Streckenlänge in Metern'"); } catch (Exception $e) {}
        // v634: ak_standard und ak_mapping Tabellen
        try { DB::query("CREATE TABLE IF NOT EXISTS " . DB::tbl('ak_standard') . " (
            id INT AUTO_INCREMENT PRIMARY KEY,
            ak VARCHAR(20) NOT NULL UNIQUE,
            geschlecht ENUM('M','W','D','') NOT NULL DEFAULT '',
            reihenfolge INT NOT NULL DEFAULT 99,
            erstellt_am DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"); } catch (Exception $e) {}
        try { DB::query("CREATE TABLE IF NOT EXISTS " . DB::tbl('ak_mapping') . " (
            id INT AUTO_INCREMENT PRIMARY KEY,
            ak_roh VARCHAR(20) NOT NULL UNIQUE COMMENT 'Nicht-Standard AK aus Ergebnissen',
            ak_standard VARCHAR(20) NOT NULL COMMENT 'Zugeordnete Standard-AK',
            erstellt_am DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"); } catch (Exception $e) {}
        // v634: Standard-AKs vorbelegen falls leer
        try {
            $akStdCnt = DB::fetchOne("SELECT COUNT(*) AS c FROM " . DB::tbl('ak_standard'));
            if (!$akStdCnt || (int)$akStdCnt['c'] === 0) {
                $stdAks = [
                    // Männer HK + Masters
                    ['MHK','M',10],['M30','M',30],['M35','M',35],['M40','M',40],['M45','M',45],
                    ['M50','M',50],['M55','M',55],['M60','M',60],['M65','M',65],['M70','M',70],
                    ['M75','M',75],['M80','M',80],['M85','M',85],
                    // Frauen HK + Masters
                    ['WHK','W',110],['W30','W',130],['W35','W',135],['W40','W',140],['W45','W',145],
                    ['W50','W',150],['W55','W',155],['W60','W',160],['W65','W',165],['W70','W',170],
                    ['W75','W',175],['W80','W',180],['W85','W',185],
                    // Männer Jugend
                    ['MU8','M',201],['MU10','M',202],['MU12','M',203],['MU14','M',204],
                    ['MU16','M',205],['MU18','M',206],['MU20','M',207],['MU23','M',208],
                    // Frauen Jugend
                    ['WU8','W',301],['WU10','W',302],['WU12','W',303],['WU14','W',304],
                    ['WU16','W',305],['WU18','W',306],['WU20','W',307],['WU23','W',308],
                ];
                foreach ($stdAks as $a) {
                    DB::query("INSERT IGNORE INTO " . DB::tbl('ak_standard') . " (ak,geschlecht,reihenfolge) VALUES (?,?,?)", $a);
                }
            }
        } catch (Exception $e) {}
        // v630: pace aus ergebnisse nicht mehr befüllen (war on-the-fly berechnet)
        // v630: disziplin_mapping.distanz befüllen aus bekannten Werten
        try {
            $hasDist = DB::fetchOne("SELECT COUNT(*) AS c FROM " . DB::tbl('disziplin_mapping') . " WHERE distanz IS NOT NULL");
            if (!$hasDist || (int)$hasDist['c'] === 0) {
                $distMap = [1=>10000,2=>15000,3=>21097.5,4=>5000,5=>42195,6=>100000,7=>1000,8=>1800,
                            9=>600,10=>8000,11=>500,12=>7000,13=>63300,14=>30000,15=>50000,17=>800,
                            32=>60,33=>200,34=>100,35=>200,36=>400,37=>400,38=>50,39=>300,
                            40=>60,41=>80,42=>100,43=>110,44=>300,45=>400,46=>75,47=>50,
                            63=>1500,64=>800,65=>3000,66=>1000,67=>5000,68=>2000,69=>10000,
                            70=>800,71=>3000,135=>300,136=>16500,137=>3000,139=>5000,
                            140=>4200,141=>2000,142=>3500,143=>6000,144=>7500,145=>11100,
                            146=>5200,147=>16100,148=>4100,149=>8100,150=>1500];
                foreach ($distMap as $mid => $dist) {
                    DB::query("UPDATE " . DB::tbl('disziplin_mapping') . " SET distanz=? WHERE id=? AND distanz IS NULL", [$dist, $mid]);
                }
            }
        } catch (Exception $e) {}
        // v630: ergebnisse.distanz aus mapping synchronisieren
        try {
            DB::query("UPDATE " . DB::tbl('ergebnisse') . " e
                       JOIN " . DB::tbl('disziplin_mapping') . " dm ON dm.id=e.disziplin_mapping_id
                       SET e.distanz=dm.distanz WHERE e.distanz IS NULL AND dm.distanz IS NOT NULL");
        } catch (Exception $e) {}
        // v630: ergebnisse.disziplin aus mapping normalisieren
        try {
            DB::query("UPDATE " . DB::tbl('ergebnisse') . " e
                       JOIN " . DB::tbl('disziplin_mapping') . " dm ON dm.id=e.disziplin_mapping_id
                       SET e.disziplin=dm.disziplin WHERE e.disziplin != dm.disziplin");
        } catch (Exception $e) {}
        // v632: Hallen-Ergebnisse die fälschlich in Bahn/Straße-Mapping landen
        // Für alle Veranstaltungen deren Name 'halle' enthält:
        // Bekannte Bahn→Halle-Mappings (gleicher Disziplin-Name, andere Kategorie)
        $halleFixMap = [
            // [disziplin, falsches mapping_id (Bahn/Str.), korrektes mapping_id (Halle)]
            ['800m',    17, 70],   // Straße → Halle
            ['800m',    64, 70],   // Bahn   → Halle
            ['200m',    35, 33],   // Bahn   → Halle
            ['400m',    36, 37],   // Bahn   → Halle
            ['1.500m',  63, 150],  // Bahn   → Halle
            ['3.000m',  65, 71],   // Bahn   → Halle
            ['1.000m',  66, null], // Bahn   → kein Halle-Äquivalent
            ['50m',     38, 47],   // Bahn   → Halle
        ];
        try {
            foreach ($halleFixMap as $fix) {
                if (!$fix[2]) continue; // kein Halle-Äquivalent
                // Nur updaten wenn das Ziel-Mapping wirklich existiert
                $halleExists = DB::fetchOne("SELECT id FROM " . DB::tbl('disziplin_mapping') . " WHERE id=?", [$fix[2]]);
                if (!$halleExists) continue;
                DB::query(
                    "UPDATE " . DB::tbl('ergebnisse') . " e
                     JOIN " . DB::tbl('veranstaltungen') . " v ON v.id=e.veranstaltung_id
                     SET e.disziplin_mapping_id=?
                     WHERE e.disziplin=? AND e.disziplin_mapping_id=?
                       AND e.geloescht_am IS NULL
                       AND (v.name LIKE '%Halle%' OR v.name LIKE '%halle%'
                            OR v.kuerzel LIKE '%Halle%')",
                    [$fix[2], $fix[0], $fix[1]]
                );
            }
        } catch (Exception $e) {}
        // Basis: alle mapping-Einträge (mapping.id als Key → kein Überschreiben bei gleichem Namen)
        $all_disz = [];
        $mappings = DB::fetchAll(
            "SELECT m.id, m.disziplin, m.kategorie_id, m.fmt_override,
                    COALESCE(m.kat_suffix_override,'') AS kat_suffix_override,
                    COALESCE(m.hof_exclude,0) AS hof_exclude,
                    m.distanz,
                    k.name AS kategorie_name, k.fmt AS kat_fmt
             FROM " . DB::tbl('disziplin_mapping') . " m
             JOIN " . DB::tbl('disziplin_kategorien') . " k ON k.id = m.kategorie_id
");
        sortDisziplinen($mappings);
        foreach ($mappings as $m) {
            $all_disz['m' . $m['id']] = [
                'id'             => (int)$m['id'],
                'disziplin'      => $m['disziplin'],
                'kategorie_id'   => $m['kategorie_id'],
                'kategorie_name' => $m['kategorie_name'],
                'fmt_override'   => $m['fmt_override'],
                'kat_suffix_override' => $m['kat_suffix_override'],
                'hof_exclude'    => (int)$m['hof_exclude'],
                'distanz'        => isset($m['distanz']) ? $m['distanz'] : null,
                'kat_fmt'        => $m['kat_fmt'],
                'ergebnis_anzahl'=> 0,
                'quelle_tbl'     => '',
            ];
        }
        // Disziplinen aus ergebnisse die noch kein Mapping haben
        try {
            $rows = DB::fetchAll("SELECT DISTINCT disziplin FROM " . DB::tbl('ergebnisse') . " WHERE disziplin IS NOT NULL AND disziplin != '' AND geloescht_am IS NULL ORDER BY disziplin");
            foreach ($rows as $r) {
                $d = $r['disziplin'];
                $found = false;
                foreach ($all_disz as &$entry) { if ($entry['disziplin'] === $d) { $found = true; break; } }
                unset($entry);
                if (!$found) {
                    $all_disz['u_' . $d] = ['id' => null, 'disziplin' => $d, 'kategorie_id' => null, 'kategorie_name' => null, 'fmt_override' => null, 'kat_suffix_override' => '', 'hof_exclude' => 0, 'kat_fmt' => null, 'ergebnis_anzahl' => 0, 'quelle_tbl' => ''];
                }
            }
        } catch (Exception $e) {}
        // Ergebnisanzahl pro mapping-id
        try {
            $counts = DB::fetchAll("SELECT disziplin_mapping_id, COUNT(*) AS anz FROM " . DB::tbl('ergebnisse') . " WHERE geloescht_am IS NULL AND disziplin_mapping_id IS NOT NULL GROUP BY disziplin_mapping_id");
            foreach ($counts as $c) {
                $k = 'm' . $c['disziplin_mapping_id'];
                if (isset($all_disz[$k])) $all_disz[$k]['ergebnis_anzahl'] = (int)$c['anz'];
            }
            // Fallback: unkategorisierte Ergebnisse per disziplin-Name zählen
            $counts2 = DB::fetchAll("SELECT disziplin, COUNT(*) AS anz FROM " . DB::tbl('ergebnisse') . " WHERE geloescht_am IS NULL AND disziplin_mapping_id IS NULL GROUP BY disziplin");
            foreach ($counts2 as $c) {
                $k = 'u_' . $c['disziplin'];
                if (isset($all_disz[$k])) $all_disz[$k]['ergebnis_anzahl'] = (int)$c['anz'];
            }
        } catch (Exception $e) {}
        sortDisziplinen($all_disz);
        jsonOk(array_values($all_disz));
    }

    // POST Mapping setzen (disziplin -> kategorie_id)
    if ($method === 'POST' && !$id) {
        $disziplin    = trim($body['disziplin'] ?? '');
        $kategorie_id = intval($body['kategorie_id'] ?? 0);
        if (!$disziplin || !$kategorie_id) jsonErr('disziplin und kategorie_id erforderlich.', 400);
        $fmt_override     = isset($body['fmt_override'])     ? trim($body['fmt_override'])     : null;
        $kat_suffix       = isset($body['kat_suffix_override']) ? trim($body['kat_suffix_override']) : null;
        $hof_exclude      = isset($body['hof_exclude'])      ? (int)$body['hof_exclude']       : 0;
        $distanz_mapping  = isset($body['distanz']) && $body['distanz'] !== '' && $body['distanz'] !== null
                            ? floatOrNull($body['distanz']) : null;
        // Prüfen ob (disziplin, kategorie_id) bereits existiert
        $existing = DB::fetchOne(
            "SELECT id FROM " . DB::tbl('disziplin_mapping') . " WHERE disziplin=? AND kategorie_id=?",
            [$disziplin, $kategorie_id]
        );
        if ($existing) {
            // Nur Metadaten updaten, NICHT kategorie_id (das wäre eine Neuanlage)
            DB::query("UPDATE " . DB::tbl('disziplin_mapping') .
                      " SET fmt_override=?, kat_suffix_override=?, hof_exclude=?, distanz=COALESCE(?,distanz) WHERE id=?",
                      [$fmt_override ?: null, $kat_suffix ?: null, $hof_exclude, $distanz_mapping, $existing['id']]);
            jsonOk(['id' => (int)$existing['id']]);
        }
        // Prüfen ob der Name in einer ANDEREN Kategorie existiert → sauber als neuer Eintrag anlegen
        DB::query("INSERT INTO " . DB::tbl('disziplin_mapping') . "
                   (disziplin, kategorie_id, fmt_override, kat_suffix_override, hof_exclude, distanz)
                   VALUES (?,?,?,?,?,?)",
                  [$disziplin, $kategorie_id, $fmt_override ?: null, $kat_suffix ?: null, $hof_exclude, $distanz_mapping]);
        $newId = DB::lastInsertId();
        // NICHT pauschal alle Ergebnisse umhängen — neue Disziplin hat noch keine
        jsonOk(['id' => (int)$newId]);
    }

    // DELETE Disziplin (nur wenn keine Ergebnisse)
    if ($method === 'DELETE' && $id) {
        $disziplin = urldecode($id);
        $anz = DB::fetchOne(
            "SELECT COUNT(*) AS c FROM " . DB::tbl('ergebnisse') .
            " WHERE disziplin=? AND geloescht_am IS NULL", [$disziplin]
        );
        if ($anz && $anz['c'] > 0) jsonErr('Disziplin hat noch ' . $anz['c'] . ' Ergebnis(se).', 409);
        DB::query("DELETE FROM " . DB::tbl('disziplin_mapping') . " WHERE disziplin=?", [$disziplin]);
        jsonOk(null);
    }

    // PUT Disziplin bearbeiten: anzeige_name + fmt_override
    if ($method === 'PUT' && $id) {
        // ID kann numerisch (mapping.id) oder Disziplin-Name sein
        $mappingId = is_numeric($id) ? (int)$id : null;
        if ($mappingId) {
            $row = DB::fetchOne("SELECT disziplin FROM " . DB::tbl('disziplin_mapping') . " WHERE id=?", [$mappingId]);
            $disziplin = $row ? $row['disziplin'] : urldecode($id);
        } else {
            $disziplin = urldecode($id);
        }
        $anzeige_name = isset($body['anzeige_name']) ? (trim($body['anzeige_name']) ?: null) : false;
        $fmt_override = isset($body['fmt_override']) ? (trim($body['fmt_override']) ?: null) : false;
        $neuer_name   = isset($body['neuer_name']) ? trim($body['neuer_name']) : null;

        // Spalten automatisch anlegen falls Migration noch nicht ausgeführt
        try {
            DB::query("ALTER TABLE " . DB::tbl('disziplin_mapping') . " ADD COLUMN IF NOT EXISTS fmt_override        VARCHAR(20) NULL");
            DB::query("ALTER TABLE " . DB::tbl('disziplin_mapping') . " ADD COLUMN IF NOT EXISTS kat_suffix_override VARCHAR(10) NULL");
            DB::query("ALTER TABLE " . DB::tbl('disziplin_mapping') . " ADD COLUMN IF NOT EXISTS hof_exclude         TINYINT(1)  NOT NULL DEFAULT 0");
            DB::query("ALTER TABLE " . DB::tbl('ergebnisse') . " ADD COLUMN IF NOT EXISTS disziplin_mapping_id INT NULL");
            DB::query("ALTER TABLE " . DB::tbl('ergebnisse') . " ADD INDEX IF NOT EXISTS idx_dmid (disziplin_mapping_id)");
            // UNIQUE-Key ändern falls noch alter Stand
            try { DB::query("ALTER TABLE " . DB::tbl('disziplin_mapping') . " DROP INDEX disziplin"); } catch (Exception $e) {}
            try { DB::query("ALTER TABLE " . DB::tbl('disziplin_mapping') . " ADD UNIQUE KEY uq_disz_kat (disziplin, kategorie_id)"); } catch (Exception $e) {}
            // disziplin_mapping_id befüllen — NUR wenn eindeutig (genau 1 Mapping für den Namen)
            DB::query("UPDATE " . DB::tbl('ergebnisse') . " e
                JOIN " . DB::tbl('disziplin_mapping') . " m ON m.disziplin = e.disziplin
                JOIN (
                    SELECT disziplin FROM " . DB::tbl('disziplin_mapping') . "
                    GROUP BY disziplin HAVING COUNT(*) = 1
                ) AS eindeutig ON eindeutig.disziplin = e.disziplin
                SET e.disziplin_mapping_id = m.id
                WHERE e.disziplin_mapping_id IS NULL");
        } catch (Exception $e) { /* ignorieren */ }

        // Disziplin umbenennen – in Transaktion damit beide Updates atomar sind
        if ($neuer_name && $neuer_name !== $disziplin) {
            // Prüfen ob Zielname + gleiche Kategorie bereits existiert (Unique-Key Verletzung)
            $currentKat = DB::fetchOne("SELECT kategorie_id FROM " . DB::tbl('disziplin_mapping') . " WHERE " . ($mappingId ? "id=?" : "disziplin=?"), [$mappingId ?: $disziplin]);
            $katId = $currentKat ? $currentKat['kategorie_id'] : null;
            $exists = $katId ? DB::fetchOne("SELECT 1 FROM " . DB::tbl('disziplin_mapping') . " WHERE disziplin=? AND kategorie_id=?", [$neuer_name, $katId]) : null;
            if ($exists) {
                jsonErr('Disziplin „' . $neuer_name . '" existiert bereits in dieser Kategorie.', 409);
                exit;
            }
            DB::get()->beginTransaction();
            try {
                DB::query("UPDATE " . DB::tbl('ergebnisse') . " SET disziplin=? WHERE disziplin=?", [$neuer_name, $disziplin]);
                DB::query("UPDATE " . DB::tbl('disziplin_mapping') . " SET disziplin=? WHERE disziplin=?", [$neuer_name, $disziplin]);
                DB::get()->commit();
            } catch (Exception $e) {
                DB::get()->rollBack();
                jsonErr('Umbenennung fehlgeschlagen: ' . $e->getMessage(), 500);
                exit;
            }
            $disziplin = $neuer_name;
        }

        // Felder aktualisieren
        $sets = []; $params = [];
        if ($anzeige_name !== false) { $sets[] = 'anzeige_name=?'; $params[] = $anzeige_name; }
        if ($fmt_override  !== false) { $sets[] = 'fmt_override=?';  $params[] = $fmt_override;  }
        $kat_sfx = isset($body['kat_suffix_override']) ? (trim($body['kat_suffix_override']) ?: null) : false;
        if ($kat_sfx !== false) { $sets[] = 'kat_suffix_override=?'; $params[] = $kat_sfx; }
        if (isset($body['hof_exclude'])) { $sets[] = 'hof_exclude=?'; $params[] = (int)$body['hof_exclude']; }
        if (array_key_exists('distanz', $body)) { $sets[] = 'distanz=?'; $params[] = $body['distanz'] !== null && $body['distanz'] !== '' ? (float)$body['distanz'] : null; }
        if ($sets) {
            if ($mappingId) {
                $params[] = $mappingId;
                DB::query("UPDATE " . DB::tbl('disziplin_mapping') . " SET " . implode(',', $sets) . " WHERE id=?", $params);
            } else {
                $params[] = $disziplin;
                DB::query("UPDATE " . DB::tbl('disziplin_mapping') . " SET " . implode(',', $sets) . " WHERE disziplin=?", $params);
            }
        }

        jsonOk(null);
    }

    // DELETE Mapping entfernen
    if ($method === 'DELETE' && $id) {
        // id = URL-kodierter Disziplinname
        $disziplin = urldecode($id);
        DB::query("DELETE FROM " . DB::tbl('disziplin_mapping') . " WHERE disziplin=?", [$disziplin]);
        jsonOk(null);
    }
}

// ============================================================
// AUTOCOMPLETE Athleten
// ============================================================
function mikaAjaxCurl(string $url, string $referer, string $cookieFile, string $ua, array &$debugOut = [], string $postBody = ''): string {
    $ch = curl_init($url);
    $origin = preg_replace('#(https?://[^/]+).*#', '$1', $referer);
    $headers = [
        'Accept: application/json, text/javascript, */*; q=0.01',
        'Accept-Language: de-DE,de;q=0.9',
        'X-Requested-With: XMLHttpRequest',
        'Origin: ' . $origin,
        'Referer: ' . $referer,
    ];
    $opts = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_ENCODING       => '',
        CURLOPT_COOKIEJAR      => $cookieFile,
        CURLOPT_COOKIEFILE     => $cookieFile,
        CURLOPT_USERAGENT      => $ua,
        CURLOPT_TIMEOUT        => 15,
    ];
    if ($postBody !== '') {
        $opts[CURLOPT_POST]       = true;
        $opts[CURLOPT_POSTFIELDS] = $postBody;
        $headers[] = 'Content-Type: application/x-www-form-urlencoded; charset=UTF-8';
    }
    $opts[CURLOPT_HTTPHEADER] = $headers;
    curl_setopt_array($ch, $opts);
    $r    = curl_exec($ch);
    $info = curl_getinfo($ch);
    curl_close($ch);
    $debugOut['http_status'] = $info['http_code'];
    $debugOut['response_len'] = strlen($r ?: '');
    return $r ?: '';
}

function mikaCurl(string $url, string $cookieFile, string $ua): string {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_COOKIEJAR      => $cookieFile,
        CURLOPT_COOKIEFILE     => $cookieFile,
        CURLOPT_USERAGENT      => $ua,
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_HTTPHEADER     => ['Accept: text/html', 'Accept-Language: de-DE,de;q=0.9'],
    ]);
    $r = curl_exec($ch); curl_close($ch);
    return $r ?: '';
}

function mikaPostCurl(string $url, string $postData, string $cookieFile, string $ua): string {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $postData,
        CURLOPT_COOKIEJAR      => $cookieFile,
        CURLOPT_COOKIEFILE     => $cookieFile,
        CURLOPT_USERAGENT      => $ua,
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_HTTPHEADER     => [
            'Accept: text/html,application/xhtml+xml',
            'Accept-Language: de-DE,de;q=0.9',
            'Content-Type: application/x-www-form-urlencoded',
            'Origin: ' . rtrim($url, '/'),
            'Referer: ' . $url,
        ],
    ]);
    $r = curl_exec($ch); curl_close($ch);
    return $r ?: '';
}

/**
 * Führt mehrere POST-Requests parallel aus (curl_multi).
 * Liefert [key => responseHtml, ...] in Eingabe-Reihenfolge.
 *
 * WICHTIG: Teilt NICHT den Cookie-File zwischen parallelen Requests (curl kann nicht gleichzeitig
 * in denselben Jar schreiben). Jeder Request bekommt eine Kopie als read-only, Session bleibt
 * über den initialen mainHtml-Aufruf gesetzt, was für r.mikatiming.com ausreicht.
 * Verwendet in v1104 für parallele Event-Suchen (HM/10L/5L/BL/KL/JL1) statt sequenzieller foreach.
 */
function mikaPostCurlMulti(string $url, array $postBodies, string $cookieFile, string $ua): array {
    if (empty($postBodies)) return [];
    $mh = curl_multi_init();
    $handles = [];
    $headers = [
        'Accept: text/html,application/xhtml+xml',
        'Accept-Language: de-DE,de;q=0.9',
        'Content-Type: application/x-www-form-urlencoded',
        'Origin: ' . rtrim($url, '/'),
        'Referer: ' . $url,
    ];
    foreach ($postBodies as $key => $body) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $body,
            CURLOPT_COOKIEFILE     => $cookieFile, // read-only (kein JAR, sonst Race-Condition)
            CURLOPT_USERAGENT      => $ua,
            CURLOPT_TIMEOUT        => 15,
            CURLOPT_HTTPHEADER     => $headers,
        ]);
        curl_multi_add_handle($mh, $ch);
        $handles[$key] = $ch;
    }
    // Alle parallel ausführen
    $running = null;
    do {
        curl_multi_exec($mh, $running);
        if ($running) curl_multi_select($mh, 2.0);
    } while ($running > 0);
    $out = [];
    foreach ($handles as $key => $ch) {
        $out[$key] = (string)(curl_multi_getcontent($ch) ?: '');
        curl_multi_remove_handle($mh, $ch);
        curl_close($ch);
    }
    curl_multi_close($mh);
    return $out;
}

if ($res === 'mika-fetch' && $method === 'GET') {
    Auth::requireLogin();
    $baseUrl = rtrim($_GET['base_url'] ?? '', '/') . '/';
    $club    = trim($_GET['club'] ?? '');
    if (!$baseUrl || !preg_match('/^https?:\/\/[a-zA-Z0-9._\-]+\.mikatiming\.(?:com|de|net)\//i', $baseUrl))
        jsonErr('Ungültige MikaTiming-URL.', 400);

    $ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0 Safari/537.36';
    $cookieFile = tempnam(sys_get_temp_dir(), 'mika_');

    // 1. Hauptseite: Session-Cookie + Datum/Ort/EventName
    $mainHtml = mikaCurl($baseUrl, $cookieFile, $ua);
    $eventName = ''; $eventDate = ''; $eventOrt = '';
    if ($mainHtml) {
        if (preg_match('/<title[^>]*>([^<]+)<\/title>/i', $mainHtml, $tm)) {
            $title = html_entity_decode(trim($tm[1]), ENT_QUOTES, 'UTF-8');
            if (preg_match('/(\d{2})\.(\d{2})\.(\d{4})/', $title, $dm))
                $eventDate = $dm[3].'-'.$dm[2].'-'.$dm[1];
            $eventName = preg_replace('/,?\s*\d{2}\.\d{2}\.\d{4}.*/', '', $title);
            $eventName = preg_replace('/\s*[:|].*/', '', $eventName);
            $eventName = trim($eventName);
        }
        // Datum aus Meta og:description, datePublished oder structured data
        if (!$eventDate) {
            if (preg_match('/"startDate"\s*:\s*"(\d{4}-\d{2}-\d{2})/i', $mainHtml, $dm)) $eventDate = $dm[1];
            elseif (preg_match('/datePublished.*?(\d{4}-\d{2}-\d{2})/i', $mainHtml, $dm)) $eventDate = $dm[1];
            elseif (preg_match('/(\d{2})\.(\d{2})\.(\d{4})/', $mainHtml, $dm)) $eventDate = $dm[3].'-'.$dm[2].'-'.$dm[1];
            // v1105: Deutsches Textformat "19. April 2026" (mika:timing Seitenheader)
            elseif (preg_match('/(\d{1,2})\.\s*(Januar|Februar|M[aä]rz|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+(\d{4})/ui', $mainHtml, $dm)) {
                $monate = ['januar'=>'01','februar'=>'02','märz'=>'03','maerz'=>'03','april'=>'04','mai'=>'05','juni'=>'06','juli'=>'07','august'=>'08','september'=>'09','oktober'=>'10','november'=>'11','dezember'=>'12'];
                $mKey = mb_strtolower($dm[2], 'UTF-8');
                if (isset($monate[$mKey])) $eventDate = $dm[3] . '-' . $monate[$mKey] . '-' . str_pad($dm[1], 2, '0', STR_PAD_LEFT);
            }
        }
        // Ort aus JSON-LD, meta oder Seitentext
        if (preg_match('/"addressLocality"\s*:\s*"([^"]+)"/i', $mainHtml, $lm)) $eventOrt = $lm[1];
        elseif (preg_match('/"location"\s*:\s*\{[^}]*"name"\s*:\s*"([^"]+)"/i', $mainHtml, $lm)) $eventOrt = $lm[1];
        // Aus Event-Namen: Stadt erkennen (auch GROSSBUCHSTABEN → Title Case)
        if (!$eventOrt && $eventName) {
            if (preg_match('/\b(M[uü]nchen|Berlin|Hamburg|Frankfurt|K[oö]ln|Stuttgart|D[uü]sseldorf|Leipzig|Dresden|Hannover|Bremen|M[uü]nster|Dortmund|Essen|Duisburg|Bochum|Wuppertal|Bonn|Gelsenkirchen|Aachen|Bielefeld|Mannheim|Augsburg|Wiesbaden|M[oö]nchengladbach|Braunschweig|Kiel|Halle|Magdeburg|Erfurt|Rostock|Mainz|L[uü]beck|Osnabr[uü]ck|Oldenburg|Freiburg|Heidelberg|Darmstadt|Regensburg|W[uü]rzburg|Ingolstadt|Ulm|Heilbronn|Pforzheim|Oberhausen|Hagen|Hamm|M[uü]lheim|Saarbr[uü]cken|Potsdam|G[oö]ttingen|Kassel|Paderborn|Trier|Jena|Gera|Cottbus|Schwerin|Viersen|Krefeld|Kleve|Moers|Neuss|Solingen|Leverkusen|Remscheid|Rees|Viersen|T[oö]nisvorst|Oedt|Kempen|Grefrath|Willich|Meerbusch|Erkelenz|Mettmann|Nettetal|Geldern|Goch|Xanten|Wesel|Emmerich|Bocholt|Dorsten|Gladbeck|Marl|Recklinghausen|Herne|Witten|Iserlohn|Hamm)\b/ui', $eventName, $om)) {
                $eventOrt = $om[1];
            }
        }
        // v1105: Ort aus Subdomain ableiten, wenn nicht anders gefunden (Heuristik)
        //        z.B. apfelbluetenlauf.r.mikatiming.com → nur wenn Name eindeutig eine Stadt benennt
        //        (kein Fallback für Event-Namen wie "apfelbluetenlauf", nur wenn Subdomain Stadt ist)
        if (!$eventOrt && preg_match('#https?://([a-z0-9_-]+)\.r\.mikatiming\.(?:com|de|net)#i', $baseUrl, $sm)) {
            $subdomain = strtolower($sm[1]);
            // Bekannte Mapping-Tabelle Event-Subdomain → Austragungsort (nur wenn absolut eindeutig)
            $knownHosts = [
                'apfelbluetenlauf' => 'Tönisvorst',
                'berliner-halbmarathon' => 'Berlin',
                'berlinmarathon' => 'Berlin',
                'berlinerhm' => 'Berlin',
                'vienna' => 'Wien',
                'linzmarathon' => 'Linz',
                'boston' => 'Boston',
                'koelnmarathon' => 'Köln',
                'frankfurtmarathon' => 'Frankfurt',
                'hamburg-marathon' => 'Hamburg',
                'muenchenmarathon' => 'München',
            ];
            if (isset($knownHosts[$subdomain])) $eventOrt = $knownHosts[$subdomain];
        }
        // Ort normalisieren: MÜNCHEN → München (Title Case)
        if ($eventOrt) {
            $eventOrt = mb_convert_case($eventOrt, MB_CASE_TITLE, 'UTF-8');
        }
    }

    // Event-ID aus URL ableiten (z.B. M_2EF3BRLP2 oder HM_ABC)
    // URL-Parameter event= lesen falls angegeben
    $eventId = $_GET['event_id'] ?? '';

    // Event-ID aus übergebener URL oder aus Hauptseite extrahieren
    $inputUrl = $_GET['base_url'] ?? '';
    if (!$eventId && $inputUrl) {
        parse_str(parse_url($inputUrl, PHP_URL_QUERY) ?: '', $uParams);
        $eventId = $uParams['event'] ?? $uParams['search_event'] ?? '';
    }
    // Aus Hauptseite: ersten verfügbaren Event-ID aus Search-Form extrahieren
    if (!$eventId && $mainHtml) {
        // <option value="M_2EF3BRLP2"> oder search_event=M_2EF3BRLP2
        if (preg_match('/search_event=([A-Z0-9_]+)/i', $mainHtml, $em)) $eventId = $em[1];
        elseif (preg_match('/[?&]event=([A-Z][A-Z0-9_]{3,})/i', $mainHtml, $em)) $eventId = $em[1];
        elseif (preg_match('/<option[^>]+value="([A-Z][A-Z0-9_]{3,})"/', $mainHtml, $em)) $eventId = $em[1];
    }
    $debug['eventId'] = $eventId;

    // 2. Interface-Erkennung: alle r.mikatiming.com-Sites nutzen den Form-POST-Pfad
    //    (historisch v2-JSON-API probiert, aber die antwortet seit Jahren still mit 0 Byte)
    //    → Priorisiere den bewährten POST-Pfad. v2 nur als letzter Fallback.
    $hasSearchProvider = strpos($mainHtml, 'SearchProvider.js') !== false;
    $hasSimpleSearchName = strpos($mainHtml, 'simple-search-name') !== false;
    $hasSearchForm = strpos($mainHtml, 'name="search[name]"') !== false || strpos($mainHtml, "name='search[name]'") !== false;
    // newInterface ist der default, wenn die Seite irgendeinen Marker hat, der auf klassischen Form-POST zeigt
    $isNewInterface = $hasSimpleSearchName || $hasSearchForm || $hasSearchProvider;
    // v2 nur als Ausweich-Fallback, wenn newInterface leer liefert
    $isV2Interface = $hasSearchProvider;
    $nameSearch = trim($_GET['name'] ?? '');
    $debug = [
        'hasSearchProvider' => $hasSearchProvider,
        'hasSimpleSearchName' => $hasSimpleSearchName,
        'hasSearchForm' => $hasSearchForm,
        'isNewInterface' => $isNewInterface,
        'isV2Interface_fallback' => $isV2Interface,
        'nameSearch' => $nameSearch,
        'mainHtmlLen' => strlen($mainHtml),
        'mainHtmlHead' => substr($mainHtml, 0, 200),
    ];

    if (false /* v2-JSON-API seit v1095 nie funktioniert (Server liefert HTTP 200 mit 0 Byte) - deaktiviert in v1103; newInterface-POST ist zuverlässig */) {
        // V2-Interface: JSON-API via content=ajax2&func=getList + X-Requested-With Header
        $searchName = $nameSearch ?: $club;

        // Event-IDs aus getSearchFields ermitteln
        $sfUrl  = $baseUrl . '?content=ajax2&func=getSearchFields'
                . '&options%5Bb%5D%5Bsearch%5D%5Bevent%5D=HM'
                . '&options%5Blang%5D=DE&options%5Bpid%5D=start';
        $sfJson = mikaAjaxCurl($sfUrl, $baseUrl, $cookieFile, $ua);
        $sfData = $sfJson ? @json_decode($sfJson, true) : null;
        $eventIds = [];
        if ($sfData && isset($sfData['branches']['search']['fields']['event']['data'])) {
            foreach ($sfData['branches']['search']['fields']['event']['data'] as $ev) {
                $evVal = is_array($ev['v']) ? $ev['v'][0] : $ev['v'];
                if ($evVal && $evVal !== '%') $eventIds[] = $evVal;
            }
        }
        if (empty($eventIds)) $eventIds = ['HM', '10L', '5L'];
        $debug['v2EventIds'] = $eventIds;

        // Such-Session initialisieren: pid=search GET-Aufruf (wie der Browser es tut, bevor getList klappt)
        $searchPageUrl = $baseUrl . '?pid=search&fpid=search&lang=DE&pidp=start';
        mikaCurl($searchPageUrl, $cookieFile, $ua);

        $searchReferer = $searchPageUrl . '&search%5Bname%5D=' . urlencode($searchName) . '&search%5Bage_class%5D=%25&search%5Bsex%5D=%25';

        $allResults = [];
        foreach ($eventIds as $evId) {
            // SearchProvider.js uses POST with options[string], options[pid], options[event] + full b-tree
            $listBaseUrl = $baseUrl . '?content=ajax2&func=getList';
            $postBody = http_build_query([
                'options' => [
                    'string'  => $searchName,
                    'pid'     => 'search',
                    'fpid'    => 'search',
                    'pidp'    => 'start',
                    'event'   => $evId,
                    'b'       => [
                        'search' => [
                            'event'     => $evId,
                            'age_class' => '%',
                            'sex'       => '%',
                            'nation'    => '%',
                            'name'      => $searchName,
                            'firstname' => '',
                            'start_no'  => '',
                        ],
                        'lists'  => ['event' => $evId],
                    ],
                    'lang'    => 'DE',
                ],
            ]);
            $curlDbg = [];
            $listJson = mikaAjaxCurl($listBaseUrl, $searchReferer, $cookieFile, $ua, $curlDbg, $postBody);
            $debug['v2_' . $evId . '_len'] = strlen($listJson);
            if ($evId === $eventIds[0]) $debug['v2_curl_first'] = $curlDbg + ['postBodyLen' => strlen($postBody), 'postBodySample' => substr($postBody, 0, 120)];
            if (!$listJson) continue;
            $listData = @json_decode($listJson, true);
            if (!$listData) continue;

            // Daten aus branches.list.data extrahieren
            $rows = $listData['branches']['list']['data'] ?? ($listData['list']['data'] ?? ($listData['data'] ?? []));
            $header = $listData['branches']['list']['header'] ?? ($listData['list']['header'] ?? []);
            $debug['v2_' . $evId . '_rows'] = count($rows);

            // Header-Index-Mapping: Spaltennamen → Positionen
            $hIdx = [];
            foreach ($header as $hi => $hCol) {
                $hName = is_array($hCol) ? ($hCol['name'] ?? $hCol[0] ?? '') : $hCol;
                $hIdx[strtolower($hName)] = $hi;
            }

            foreach ($rows as $row) {
                // Unterstütze sowohl Array- als auch Objekt-Rows
                $getCol = function($keys) use ($row, $hIdx) {
                    foreach ((array)$keys as $k) {
                        if (isset($row[$k])) return trim(strip_tags((string)$row[$k]));
                        if (isset($hIdx[$k]) && isset($row[$hIdx[$k]])) return trim(strip_tags((string)$row[$hIdx[$k]]));
                    }
                    return '';
                };
                $name = $getCol(['name','fullname','n','Name']);
                if (!$name) {
                    // Fallback: erstes String-Feld mit Komma (Nachname, Vorname)
                    foreach ($row as $v) {
                        $vs = trim(strip_tags((string)$v));
                        if (strpos($vs, ',') !== false && strlen($vs) > 4 && strlen($vs) < 60) { $name = $vs; break; }
                    }
                }
                if (!$name) continue;
                $netto   = $getCol(['netto','time','result','t','zeit','finish_netto']);
                $ak      = $getCol(['age_class','ak','class','category','AK']);
                $platzAk = $getCol(['place_age','place_ak','platz_ak','rank_ak','place_category']);
                $platzGs = $getCol(['place_all','place_ges','platz_ges','rank']);
                $liClub  = $getCol(['club','verein','team']);
                $idp     = $getCol(['idp','id','ID']);
                if (!$idp) $idp = $evId . '_' . md5($name);
                if (isset($allResults[$idp])) continue;
                $allResults[$idp] = [
                    'name' => $name, 'contest' => $evId,
                    'netto' => $netto, 'ak' => $ak,
                    'platz_ak' => $platzAk, 'platz_ges' => $platzGs,
                    'event_id' => $evId, 'idp' => $idp, 'club' => $liClub,
                    '_fromV2' => true,
                ];
            }
        }

        $results = array_values($allResults);
        $debug['v2RowsTotal'] = count($results);
        if (!empty($results)) {
            $debug['firstResult'] = $results[0];
            @unlink($cookieFile);
            jsonOk(['results' => $results, 'eventName' => $eventName, 'eventDate' => $eventDate, 'eventOrt' => $eventOrt, 'debug' => $debug]);
        }
        // V2 lieferte 0 Treffer → Fallback auf POST-basiertes Interface (zuverlässig für moderne Sites)
        $debug['v2_fallback'] = 'v2_empty_trying_new_interface';
        $isNewInterface = true;
    }

    if ($isNewInterface) {
        // Neue Interface: POST pro Event-Typ
        $searchName = $nameSearch ?: $club;
        // Event-IDs aus Hauptseite extrahieren oder Defaults
        $eventIds = [];
        preg_match_all('/value="([A-Z0-9]{1,5}L?[0-9]?)"[^>]*>[^<]+(?:km|Lauf|Marathon)/i', $mainHtml, $evm);
        foreach ($evm[1] as $ev) $eventIds[] = $ev;
        // Fallback auf option-Values aus select (event-Select hat die Wettbewerbe: HM/10L/5L/BL/KL/JL1 etc.)
        preg_match_all('/<option[^>]+value="([A-Z0-9]{1,6})"/', $mainHtml, $opm);
        foreach ($opm[1] as $ev) { if (!in_array($ev,$eventIds) && preg_match('/^[A-Z0-9]{1,6}$/',$ev)) $eventIds[] = $ev; }
        if (empty($eventIds)) $eventIds = ['HM','10L','5L'];
        $eventIds = array_unique(array_slice($eventIds, 0, 10));
        $debug['newIf_eventIds'] = $eventIds;

        $searchUrl = $baseUrl . '?pid=search&pidp=start';
        $allResults = [];

        // WICHTIG (v1103): Der MikaTiming-Server liefert nur dann echte Ergebnisse
        // wenn ALLE versteckten Form-Felder mitgeschickt werden:
        //   lang=DE, startpage=start_responsive, startpage_type=search, event=<EVID>
        // Ohne diese Felder kommt HTTP 200 mit leerem Ergebnis-Gerüst zurück.
        // Im Browser via DevTools verifiziert (2026/Apfelblütenlauf).
        // v1104: Alle Event-POSTs parallel ausführen (curl_multi) statt sequenziell.
        //        Reduziert Namens-Suche-Zeit von ~6×RTT auf 1×RTT (~6× schneller).
        $postBodiesByEvent = [];
        foreach ($eventIds as $_evLoop) {
            $postFields = [
                'lang'               => 'DE',
                'startpage'          => 'start_responsive',
                'startpage_type'     => 'search',
                'event'              => $_evLoop,
                'search[name]'       => $nameSearch ?: '',
                'search[firstname]'  => '',
                'search[start_no]'   => '',
            ];
            // Club-Suche: wenn kein Namens-Query aktiv, stattdessen nach Verein filtern
            if (!$nameSearch && $club !== '') {
                $postFields['search[club]'] = $club;
            }
            $postBodiesByEvent[$_evLoop] = http_build_query($postFields);
        }
        $htmlByEvent = mikaPostCurlMulti($searchUrl, $postBodiesByEvent, $cookieFile, $ua);

        foreach ($htmlByEvent as $_evLoop => $html) {
            $debug['newIf_' . $_evLoop . '_len'] = strlen($html);
            if (!$html) continue;

        // Parse results from POST response

            $dom2 = new DOMDocument('1.0', 'UTF-8');
            @$dom2->loadHTML('<?xml encoding="UTF-8">' . $html);
            $xp2 = new DOMXPath($dom2);
            $liNodes2 = $xp2->query('//li[contains(@class,"list-group-item") and not(contains(@class,"list-group-header")) and not(contains(@class,"list-info"))]');
            foreach ($liNodes2 as $li) {
                $liHtml2 = $dom2->saveHTML($li);
                $idp = '';
                foreach ($xp2->query('.//a[@href]', $li) as $a) {
                    $href = $a->getAttribute('href');
                    if (preg_match('/[?&]idp=([A-Z0-9]{8,})/i', $href, $im)) { $idp = $im[1]; break; }
                }
                if (!$idp) continue;
                $name = '';
                foreach ($xp2->query('.//*[contains(@class,"type-fullname") or contains(@class,"name-standard") or contains(@class,"fullname")]', $li) as $n) {
                    $t = trim($n->textContent);
                    if ($t) { $name = preg_replace('/\s*\([A-Z]{2,3}\)\s*$/', '', $t); break; }
                }
                if (!$name) {
                    // Fallback: erster Text-Knoten mit Komma (Nachname, Vorname)
                    foreach ($xp2->query('.//td|.//div[contains(@class,"list-field")]', $li) as $td) {
                        $t = trim($td->textContent);
                        if (strpos($t, ',') !== false && strlen($t) > 4 && strlen($t) < 60) { $name = $t; break; }
                    }
                }
                if (!$name) continue;
                $liClub = '';
                foreach ($xp2->query('.//*[contains(@class,"club") or contains(@class,"f-club")]', $li) as $n) {
                    $t = trim($n->textContent); if ($t) { $liClub = $t; break; }
                }
                $placeGes = ''; $placeAK = '';
                foreach ($xp2->query('.//*[contains(@class,"place-primary") or contains(@class,"place_all")]', $li) as $n) {
                    $t = trim($n->textContent); if (ctype_digit($t)) { $placeGes = $t; break; }
                }
                foreach ($xp2->query('.//*[contains(@class,"place-secondary") or contains(@class,"place_age")]', $li) as $n) {
                    $t = trim($n->textContent); if (ctype_digit($t)) { $placeAK = $t; break; }
                }
                // Event-ID aus idp-Link extrahieren
                $evId = "";
                foreach ($xp2->query('.//a[@href]', $li) as $a) {
                    $href = $a->getAttribute('href');
                    if (preg_match('/[?&]event=([A-Z0-9]{1,5})/i', $href, $evm)) { $evId = $evm[1]; break; }
                }
                // Neue Interface: Felder via type-* Klassen + list-label extrahieren
                // Hilfsfunktion: Wert = Gesamttext minus Label-Text
                $liNetto = ''; $liAK = '';

                // Zeit: type-time, Label "Ziel" = Nettozeit
                foreach ($xp2->query('.//*[contains(@class,"type-time")]', $li) as $tn) {
                    $labelEl = $xp2->query('.//*[contains(@class,"list-label")]', $tn)->item(0);
                    $label = $labelEl ? trim($labelEl->textContent) : '';
                    if ($label === 'Ziel' || $label === 'Zeit' || $label === '') {
                        $raw = trim(str_replace($label, '', $tn->textContent));
                        if (preg_match('/\b(\d{1,2}:\d{2}:\d{2})\b/', $raw, $tm)) { $liNetto = $tm[1]; break; }
                    }
                }
                // AK + Verein: type-field, unterschieden via list-label
                foreach ($xp2->query('.//*[contains(@class,"type-field")]', $li) as $fn) {
                    $labelEl = $xp2->query('.//*[contains(@class,"list-label")]', $fn)->item(0);
                    $label = $labelEl ? trim($labelEl->textContent) : '';
                    $raw = trim(str_replace($label, '', $fn->textContent));
                    if ($label === 'AK' && $raw && !$liAK) $liAK = $raw;
                    if ($label === 'Verein' && $raw && !$liClub) $liClub = $raw;
                }
                // Fallback: irgendein H:MM:SS im Li-HTML
                if (!$liNetto) {
                    $liRawHtml = strip_tags($dom2->saveHTML($li));
                    if (preg_match_all('/(\d{1,2}:\d{2}:\d{2})/', $liRawHtml, $tms)) {
                        foreach ($tms[1] as $tmCandidate) {
                            // Uhrzeiten (z.B. 11:41:54) ausschließen – Laufzeiten meist < 10h
                            list($h,$m,$s) = explode(':', $tmCandidate);
                            if ((int)$h <= 9 && (int)$m < 60 && (int)$s < 60) {
                                $liNetto = $tmCandidate; break;
                            }
                        }
                    }
                }
                if (!isset($allResults[$idp])) {
                    // Debug für ersten Fund
                    if (!isset($debug['firstLiClasses'])) {
                        preg_match_all('/class="([^"]+)"/', $dom2->saveHTML($li), $cm2);
                        $allCl = []; foreach ($cm2[1] as $cs) foreach (explode(' ',$cs) as $cl) if (trim($cl)) $allCl[trim($cl)]=1;
                        $debug['firstLiClasses'] = array_keys($allCl);
                        $debug['firstLiText'] = mb_substr(strip_tags($dom2->saveHTML($li)), 0, 300);
                        $debug['firstLiNetto'] = $liNetto;
                        $debug['firstLiClub'] = $liClub;
                        $debug['firstLiAK'] = $liAK;
                    }
                    $allResults[$idp] = [
                        'name' => trim($name), 'contest' => $evId,
                        'netto' => $liNetto, 'ak' => $liAK,
                        'platz_ak' => $placeAK, 'platz_ges' => $placeGes,
                        'event_id' => $evId, 'idp' => $idp, 'club' => $liClub,
                    ];
                }
        } // end parse block per LI
        } // end foreach ($eventIds as $_evLoop)
        $results = array_values($allResults);
        $debug['rowsFound'] = count($results);
        if (!empty($results)) $debug['firstResult'] = $results[0];

        // contestMap setzen + neues Interface markieren (kein Detail-Fetch nötig)
        $contestMap = ['HM'=>'Halbmarathon','10L'=>'10km','5L'=>'5km'];
        foreach ($results as &$res) {
            if (isset($contestMap[$res['event_id']])) $res['contest'] = $contestMap[$res['event_id']];
            $res['_fromNewInterface'] = true;
        }
        unset($res);

        // Ort aus og:description wenn noch nicht bekannt (neues Interface hat kein JSON-LD)
        if (!$eventOrt && $mainHtml) {
            if (preg_match('/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i', $mainHtml, $dm)
                || preg_match('/<meta[^>]+content="([^"]+)"[^>]+property="og:description"/i', $mainHtml, $dm)) {
                $desc = trim($dm[1]);
                if ($desc && strlen($desc) < 60 && stripos($desc, 'timing') === false) $eventOrt = $desc;
            }
        }
        // Wenn newInterface auch 0 Treffer lieferte → 2. Fallback auf oldInterface (GET-basiert)
        if (empty($results)) {
            $debug['newInterface_fallback'] = 'empty_trying_old_interface';
            $isNewInterface = false;
        } else {
            @unlink($cookieFile);
            jsonOk(['results' => $results, 'eventName' => $eventName, 'eventDate' => $eventDate, 'eventOrt' => $eventOrt, 'debug' => $debug]);
        }
    }

    if (!$isNewInterface) {
        // Altes Interface: GET-Suche
        if ($nameSearch) {
            // Namensuche: zuerst ohne Event-Filter (funktioniert für viele Sites)
            // Nur wenn nötig: Event-ID-Loop als Fallback (für Sites wie 2016 die pro-Event suchen müssen)
            $oldResults = [];

            // Schritt 1: Ohne Event-Filter suchen
            $urlNoEvent = $baseUrl . '?pid=search&fpid=search&lang=DE&pidp=start'
                . '&search%5Bname%5D=' . urlencode($nameSearch)
                . '&search%5Bage_class%5D=%25&search%5Bsex%5D=%25&search%5Bnation%5D=%25'
                . '&search_sort=name';
            $htmlNoEvent = mikaCurl($urlNoEvent, $cookieFile, $ua);
            $debug['noEventHtmlLen'] = strlen($htmlNoEvent);

            // Parse results from no-event search
            $domNE = new DOMDocument('1.0', 'UTF-8');
            @$domNE->loadHTML('<?xml encoding="UTF-8">' . $htmlNoEvent);
            $xpNE = new DOMXPath($domNE);
            foreach ($xpNE->query('//li[contains(@class,"list-group-item") and not(contains(@class,"list-group-header")) and not(contains(@class,"list-info"))]') as $li) {
                $idp = '';
                foreach ($xpNE->query('.//a[@href]', $li) as $a) {
                    $href = $a->getAttribute('href');
                    if (preg_match('/[?&]idp=([A-Z0-9]{8,})/i', $href, $im)) { $idp = $im[1]; break; }
                }
                if (!$idp) continue;
                $evIdFromLink = '';
                foreach ($xpNE->query('.//a[@href]', $li) as $a) {
                    $href = $a->getAttribute('href');
                    if (preg_match('/[?&]event=([A-Z0-9]{1,10})/i', $href, $em)) { $evIdFromLink = $em[1]; break; }
                }
                $name = '';
                foreach ($xpNE->query('.//*[contains(@class,"fullname")]', $li) as $n) {
                    $t = trim($n->textContent);
                    if ($t) { $name = preg_replace('/\s*\([A-Z]{2,3}\)\s*$/', '', $t); break; }
                }
                if (!$name) continue;
                $liClub2 = '';
                foreach ($xpNE->query('.//*[contains(@class,"club") or contains(@class,"f-club")]', $li) as $n) {
                    $t = trim($n->textContent); if ($t) { $liClub2 = $t; break; }
                }
                $placeGes2 = ''; $placeAK2 = '';
                foreach ($xpNE->query('.//*[contains(@class,"place-primary")]', $li) as $n) {
                    $t = trim($n->textContent); if (ctype_digit($t)) { $placeGes2 = $t; break; }
                }
                foreach ($xpNE->query('.//*[contains(@class,"place-secondary")]', $li) as $n) {
                    $t = trim($n->textContent); if (ctype_digit($t)) { $placeAK2 = $t; break; }
                }
                $oldResults[$idp] = [
                    'name' => trim($name), 'contest' => $evIdFromLink ?: 'Unbekannt',
                    'netto' => '', 'ak' => '', 'platz_ak' => $placeAK2, 'platz_ges' => $placeGes2,
                    'event_id' => $evIdFromLink, 'idp' => $idp, 'club' => $liClub2,
                ];
            }
            $debug['noEventResults'] = count($oldResults);

            // Schritt 2: Falls keine Ergebnisse → Event-ID-Loop als Fallback (z.B. für 2016er Sites)
            if (empty($oldResults)) {
                $oldEventIds = ['HM','10L','5L','M','10K','5K','10KM','5KM','HLM'];
                preg_match_all('/<option[^>]+value="([A-Z0-9]{1,5}L?)"[^>]*>/i', $mainHtml, $oem);
                foreach ($oem[1] as $ev) if (!in_array($ev, $oldEventIds)) $oldEventIds[] = $ev;
                if ($eventId && !in_array($eventId, $oldEventIds)) $oldEventIds[] = $eventId;
                $debug['oldEventIds'] = $oldEventIds;
                foreach ($oldEventIds as $oEvId) {
                $url = $baseUrl . '?pid=search&fpid=search&lang=DE&pidp=start'
                    . '&search%5Bname%5D=' . urlencode($nameSearch)
                    . '&search%5Bage_class%5D=%25&search%5Bsex%5D=%25&search%5Bnation%5D=%25'
                    . '&search_sort=name'
                    . ($oEvId ? '&event=' . urlencode($oEvId) . '&search_event=' . urlencode($oEvId) : '');
                $html = mikaCurl($url, $cookieFile, $ua);
                $debug['oldSearch'][$oEvId ?: 'all'] = strlen($html);
                // Ergebnisse parsen und mit $oEvId als contest mergen
                $domO = new DOMDocument('1.0', 'UTF-8');
                @$domO->loadHTML('<?xml encoding="UTF-8">' . $html);
                $xpO = new DOMXPath($domO);
                foreach ($xpO->query('//li[contains(@class,"list-group-item") and not(contains(@class,"list-group-header")) and not(contains(@class,"list-info"))]') as $li) {
                    $idp = '';
                    foreach ($xpO->query('.//a[@href]', $li) as $a) {
                        $href = $a->getAttribute('href');
                        if (preg_match('/[?&]idp=([A-Z0-9]{8,})/i', $href, $im)) { $idp = $im[1]; break; }
                    }
                    if (!$idp || isset($oldResults[$idp])) continue;
                    $name = '';
                    foreach ($xpO->query('.//*[contains(@class,"fullname")]', $li) as $n) {
                        $t = trim($n->textContent);
                        if ($t) { $name = preg_replace('/\s*\([A-Z]{2,3}\)\s*$/', '', $t); break; }
                    }
                    if (!$name) continue;
                    $liClub2 = '';
                    foreach ($xpO->query('.//*[contains(@class,"club") or contains(@class,"f-club")]', $li) as $n) {
                        $t = trim($n->textContent); if ($t) { $liClub2 = $t; break; }
                    }
                    $placeGes2 = ''; $placeAK2 = '';
                    foreach ($xpO->query('.//*[contains(@class,"place-primary")]', $li) as $n) {
                        $t = trim($n->textContent); if (ctype_digit($t)) { $placeGes2 = $t; break; }
                    }
                    foreach ($xpO->query('.//*[contains(@class,"place-secondary")]', $li) as $n) {
                        $t = trim($n->textContent); if (ctype_digit($t)) { $placeAK2 = $t; break; }
                    }
                    $oldResults[$idp] = [
                        'name' => trim($name), 'contest' => $oEvId ?: 'Unbekannt',
                        'netto' => '', 'ak' => '', 'platz_ak' => $placeAK2, 'platz_ges' => $placeGes2,
                        'event_id' => $oEvId, 'idp' => $idp, 'club' => $liClub2,
                    ];
                }
                } // end foreach $oldEventIds
            } // end if(empty($oldResults)) — Event-ID-Loop Fallback
            // $searchHtml für den nachfolgenden Parser: leer lassen, direkt $results setzen
            $searchHtml = '<html></html>';
            // Inject results before the main parser runs (wird von if(!$isNewInterface) Block genutzt)
            // Stattdessen: direkt zu den Detail-Fetches springen
            // Wir überschreiben $results nach dem Haupt-Parser
            $debug['oldNameResults'] = count($oldResults);
            // Übergabe via global scope trick: serialize in temp var
            $_oldNameResults = array_values($oldResults);
        } else {
            $searchUrl = $baseUrl . '?pid=search&fpid=search&lang=DE&pidp=start'
                . '&search%5Bclub%5D=' . urlencode($club)
                . '&search%5Bage_class%5D=%25&search%5Bsex%5D=%25&search%5Bnation%5D=%25'
                . '&search_sort=name'
                . ($eventId ? '&event=' . urlencode($eventId) . '&search_event=' . urlencode($eventId) : '');
            $searchHtml = mikaCurl($searchUrl, $cookieFile, $ua);
        }
        $debug['htmlLen'] = strlen($searchHtml);
    }

    if (!$isNewInterface) {
    // Ergebniszeilen: li mit event-Klasse + idp-Link
    $results = [];
    // Wenn Namensuche multi-event vorab gesammelt: direkt übernehmen
    if (!empty($_oldNameResults)) {
        $results = $_oldNameResults;
    } else {
    // DOMDocument für robustes Parsing
    $dom = new DOMDocument('1.0', 'UTF-8');
    @$dom->loadHTML('<?xml encoding="UTF-8">' . $searchHtml);
    $xpath = new DOMXPath($dom);
    // Alle li mit class enthaltend "list-group-item" aber nicht "header"
    $liNodes = $xpath->query('//li[contains(@class,"list-group-item") and not(contains(@class,"list-group-header")) and not(contains(@class,"list-info"))]');
    foreach ($liNodes as $li) {
        $liClass = $li->getAttribute('class');
        $liHtml  = $dom->saveHTML($li);

        // Teilnehmer-IDP aus Link
        $idp = '';
        $anchors = $xpath->query('.//a[@href]', $li);
        foreach ($anchors as $a) {
            $href = $a->getAttribute('href');
            if (preg_match('/[?&]idp=([A-Z0-9]{8,})/i', $href, $im)) { $idp = $im[1]; break; }
        }
        if (!$idp) continue;

        // Event-ID
        $evId = $eventId ?: '';
        if (preg_match('/\bevent-([A-Z0-9_]+)\b/i', $liClass, $em)) $evId = $em[1];

        // Name: Element mit Klassen die "fullname" enthalten
        $name = '';
        $nameNodes = $xpath->query('.//*[contains(@class,"fullname")]', $li);
        foreach ($nameNodes as $n) {
            $t = trim($n->textContent);
            if ($t) { $name = preg_replace('/\s*\([A-Z]{2,3}\)\s*$/', '', $t); break; }
        }
        if (!$name) continue;

        // Plätze
        $placeGes = '';
        $pgNodes = $xpath->query('.//*[contains(@class,"place-primary") or contains(@class,"place_all")]', $li);
        foreach ($pgNodes as $n) { $t = trim($n->textContent); if (ctype_digit($t)) { $placeGes = $t; break; } }

        $placeAK = '';
        $pakNodes = $xpath->query('.//*[contains(@class,"place-secondary") or contains(@class,"place_age")]', $li);
        foreach ($pakNodes as $n) { $t = trim($n->textContent); if (ctype_digit($t)) { $placeAK = $t; break; } }

        $ak = '';
        $akNodes = $xpath->query('.//*[contains(@class,"age_class")]', $li);
        foreach ($akNodes as $n) { $t = trim($n->textContent); if ($t) { $ak = $t; break; } }

        // Tatsächlicher Vereinsname aus Suchergebnisliste
        $liClub = '';
        $clubNodes = $xpath->query('.//*[contains(@class,"club") or contains(@class,"f-club") or contains(@class,"nation_team")]', $li);
        foreach ($clubNodes as $n) { $t = trim($n->textContent); if ($t) { $liClub = $t; break; } }

        $results[] = [
            'name' => trim($name), 'contest' => $evId ?: 'Unbekannt',
            'netto' => '', 'ak' => $ak,
            'platz_ak' => $placeAK, 'platz_ges' => $placeGes,
            'event_id' => $evId, 'idp' => $idp, 'club' => $liClub ?: $club,
        ];
    }
    $debug['rowsFound'] = count($results);
    } // end DOMDocument else

    // 3. Detailseite pro Athlet: Zeit + AK
    foreach ($results as &$res) {
        $idp = $res['idp']; $evId = $res['event_id'];
        // Basis-Suchparameter beibehalten für Cookie-Kontext
        // Detail-URL: bei Namensuche ohne Club-Filter (sonst falscher Cookie-Kontext)
        $detailUrl = $baseUrl . '?content=detail&fpid=search&pid=search&lang=DE'
            . '&idp=' . urlencode($idp) . '&event=' . urlencode($evId) . '&pidp=start'
            . (!empty($_oldNameResults)
                ? '&search%5Bname%5D=&search%5Bage_class%5D=%25&search%5Bsex%5D=%25'
                : '&search%5Bclub%5D=' . urlencode($club) . '&search%5Bage_class%5D=%25&search%5Bsex%5D=%25%5Bnation%5D=%25'
              )
            . '&search_sort=name&search_event=' . urlencode($evId);
        $dHtml = mikaCurl($detailUrl, $cookieFile, $ua);
        if (!$dHtml) continue;

        // Zeit + Details aus DOM des Detail-HTML
        // DOMDocument für Detailseite
        $detailDom = new DOMDocument('1.0', 'UTF-8');
        @$detailDom->loadHTML('<?xml encoding="UTF-8">' . $dHtml);
        $detailXpath = new DOMXPath($detailDom);

        // Zeit: f-time_finish_netto — nur reines Zeit-Pattern extrahieren
        foreach (['f-time_finish_netto', 'f-time_finish_brutto'] as $tcls) {
            $tNodes = $detailXpath->query('//*[contains(@class,"' . $tcls . '")]');
            foreach ($tNodes as $tn) {
                $t = trim($tn->textContent);
                // Nur Zeit-Pattern: H:MM:SS oder H:MM
                if (preg_match('/\b(\d{1,2}:\d{2}:\d{2}|\d{1,2}:\d{2})\b/', $t, $tm)) {
                    $res['netto'] = $tm[1]; break 2;
                }
            }
        }

        // AK: aus Suchliste (z.B. "AK40") oder Detail f-_type_age_class
        // Geschlecht aus Detail-HTML ableiten: "Männer" / "Frauen" in Überschriften
        $sex = '';
        if (preg_match('/\b(Frauen|Women|weiblich|Female)\b/i', $dHtml)) $sex = 'W';
        elseif (preg_match('/\b(Männer|Men|männlich|Male)\b/i', $dHtml)) $sex = 'M';
        // AK-Zahl aus f-_type_age_class
        $akNum = '';
        $akNodes = $detailXpath->query('//*[contains(@class,"f-_type_age_class") or contains(@class,"f-type_age_class")]');
        foreach ($akNodes as $an) { $t = trim($an->textContent); if ($t && $t !== '0' && is_numeric($t)) { $akNum = $t; break; } }
        // AK aufbauen: M40, W45 etc.
        if ($akNum) {
            $res['ak'] = ($sex ?: '') . $akNum;
        } elseif ($res['ak']) {
            // Suchliste lieferte z.B. "AK40" → Prefix aus $sex oder weglassen
            if (preg_match('/^AK(\d+)$/i', $res['ak'], $akm)) {
                $res['ak'] = ($sex ?: '') . $akm[1];
            }
        }
        // Fallback: kein Geschlecht gefunden → AK-Prefix aus Event-Kontext
        // M_ = Männer, W_ oder F_ = Frauen
        if ($res['ak'] && !preg_match('/^[MW]/', $res['ak'])) {
            $evPfx = strtoupper(preg_replace('/_.*$/', '', $evId));
            if (in_array($evPfx, ['W','F','HW'])) $res['ak'] = 'W' . ltrim($res['ak'], 'AK');
            elseif (in_array($evPfx, ['M','HM','H'])) $res['ak'] = 'M' . ltrim($res['ak'], 'AK');
        }

        // Platz AK aus f-place_age
        if (!$res['platz_ak']) {
            $pakNodes = $detailXpath->query('//*[contains(@class,"f-place_age")]');
            foreach ($pakNodes as $pn) { $t = trim($pn->textContent); if (ctype_digit($t)) { $res['platz_ak'] = $t; break; } }
        }

        // Wettbewerbsname: "Gesamt" Abschnitt überspringen, contest aus Event-Prefix
        $contestPfx = strtoupper(preg_replace('/_.*$/', '', $evId));
        $contestMap = ['M'=>'Marathon','HM'=>'Halbmarathon','10K'=>'10km','5K'=>'5km','H'=>'Halbmarathon'];
        if (isset($contestMap[$contestPfx])) $res['contest'] = $contestMap[$contestPfx];

        if (!isset($debug['detailSample'])) {
            $sample = [];
            $allNodes = $detailXpath->query('//*[@class]');
            foreach ($allNodes as $n) {
                $t = trim($n->textContent);
                $c = $n->getAttribute('class');
                if ($t && strlen($t) < 30 && strpos($c,'f-') !== false)
                    $sample[] = $c . ': ' . $t;
            }
            // Auch roh: f-time im HTML?
            $debug['detailHasTime'] = strpos($dHtml, 'f-time_finish_netto') !== false;
            $debug['detailLen'] = strlen($dHtml);
            $debug['detailFields'] = array_slice($sample, 0, 15);
            $debug['detailUrl'] = $detailUrl;
        }
    }
    unset($res);

    @unlink($cookieFile);
    jsonOk(['results' => $results, 'eventName' => $eventName, 'eventDate' => $eventDate, 'eventOrt' => $eventOrt, 'debug' => $debug]);

    } // end old interface
}

if ($res === 'rr-fetch' && $method === 'GET') {
    Auth::requireLogin();

    // Zweig A: proxy_url → beliebige Seite auf RaceResult Event-ID prüfen
    if (!empty($_GET['proxy_url'])) {
        $proxyUrl = filter_var($_GET['proxy_url'], FILTER_VALIDATE_URL);
        if (!$proxyUrl) jsonErr('Ungültige URL.', 400);
        $ctx = stream_context_create(['http' => [
            'timeout'       => 10,
            'user_agent'    => 'Mozilla/5.0 (compatible)',
            'header'        => "Accept: text/html\r\n",
            'ignore_errors' => true,
        ]]);
        $html = @file_get_contents($proxyUrl, false, $ctx);
        if ($html === false) jsonErr('Seite konnte nicht geladen werden.', 502);

        $foundId = null;

        // 1. Inline-Script: RRPublish(element, 334519, ...) oder new RRPublish(..., 334519, ...)
        if (preg_match('/RRPublish\s*\([^,)]+,\s*(\d{4,7})\s*[,)]/i', $html, $m)) {
            $foundId = $m[1];
        }
        // 2. URL-Muster: raceresult.com/334519/
        if (!$foundId && preg_match('/raceresult\.com\/(\d{4,7})\//i', $html, $m)) {
            $foundId = $m[1];
        }
        // 3. data-Attribute
        if (!$foundId && preg_match('/data-(?:event|rrid|event-id)\s*=\s*["\'](\d{4,7})["\']/i', $html, $m)) {
            $foundId = $m[1];
        }
        // 4. Script-src mit raceresult.com/EVENTID/
        if (!$foundId && preg_match('/<script[^>]+src=["\'][^"\']*raceresult\.com\/(\d{4,7})\//i', $html, $m)) {
            $foundId = $m[1];
        }
        // 5. Inline-Scripts: numerisches Argument an Publish-ähnliche Konstrukte
        if (!$foundId) {
            preg_match_all('/<script[^>]*>(.*?)<\/script>/si', $html, $sm);
            foreach ($sm[1] as $s) {
                if (preg_match('/raceresult\.com\/(\d{4,7})\//i', $s, $m)) {
                    $foundId = $m[1]; break;
                }
                if (preg_match('/[Pp]ublish\s*\([^)]{0,80}?[,\s](\d{5,7})[,\s)]/i', $s, $m)) {
                    $foundId = $m[1]; break;
                }
            }
        }

        jsonOk(['event_id' => $foundId]);
    }

    // Zweig B: event_id → RaceResult-Seite fetchen (bisherige Logik)
    $eventId = preg_replace('/[^0-9]/', '', $_GET['event_id'] ?? '');
    if (!$eventId) jsonErr('event_id fehlt.', 400);
    $url = 'https://my.raceresult.com/' . $eventId . '/results';
    $ctx = stream_context_create(['http' => [
        'timeout'     => 8,
        'user_agent'  => 'Mozilla/5.0',
        'header'      => "Accept: text/html
",
        'ignore_errors' => true,
    ]]);
    $html = @file_get_contents($url, false, $ctx);
    if ($html === false) jsonErr('Fetch fehlgeschlagen.', 502);
    // <title>2. Reeser Rheinlauf, 05.10.2025 : : my.race|result</title>
    $title = '';
    if (preg_match('/<title[^>]*>([^<]+)<\/title>/i', $html, $m)) {
        $title = trim($m[1]);
    }
    // Datum aus Titel extrahieren: DD.MM.YYYY oder YYYY-MM-DD (auch Bereich YYYY-MM-DD/YYYY-MM-DD)
    $date = '';
    if (preg_match('/(\d{2})\.(\d{2})\.(\d{4})/', $title, $dm)) {
        $date = $dm[3] . '-' . $dm[2] . '-' . $dm[1]; // → YYYY-MM-DD
    } elseif (preg_match('/(\d{4})-(\d{2})-(\d{2})/', $title, $dm)) {
        $date = $dm[1] . '-' . $dm[2] . '-' . $dm[3]; // erstes ISO-Datum
    }
    // Ort: verschiedene Quellen versuchen
    $location = '';
    // 1. JSON-LD: "location":{"name":"Rees"} oder "addressLocality":"Rees"
    if (preg_match('/"location"\s*:\s*\{[^}]*"name"\s*:\s*"([^"]+)"/i', $html, $lm)) {
        $location = trim($lm[1]);
    }
    if (!$location && preg_match('/"addressLocality"\s*:\s*"([^"]+)"/i', $html, $lm)) {
        $location = trim($lm[1]);
    }
    // 2. og:location oder data-city
    if (!$location && preg_match('/<meta[^>]+property=["\']+og:location["\']+[^>]+content=["\']+([^"\']+)["\']+/', $html, $lm)) {
        $location = trim($lm[1]);
    }
    if (!$location && preg_match('/data-(?:city|location|ort)=["\']+([^"\']+)["\']+/', $html, $lm)) {
        $location = trim($lm[1]);
    }
    // 3. HTML-Snippet für Debug
    $htmlSnippet = substr(strip_tags(preg_replace('/<script[^>]*>.*?<\/script>/si', '', $html)), 0, 600);

    jsonOk(['title' => $title, 'date' => $date, 'location' => $location, 'htmlSnippet' => $htmlSnippet]);
}

if ($res === 'autocomplete' && $id === 'athleten') {
    Auth::requireLogin();
    $q = '%' . sanitize($_GET['q'] ?? '') . '%';
    $rows = DB::fetchAll('SELECT id, name_nv, ak_aktuell, geschlecht FROM ' . DB::tbl('athleten') . ' WHERE name_nv LIKE ? AND aktiv=1 ORDER BY name_nv LIMIT 20', [$q]);
    jsonOk($rows);
}

// ============================================================
// VERANSTALTUNG-SERIEN (v942)
// ============================================================

// GET veranstaltung-serien – Liste aller Serien
if ($res === 'veranstaltung-serien' && $method === 'GET' && !$id) {
    $sTbl = DB::tbl('veranstaltung_serien');
    $vTbl = DB::tbl('veranstaltungen');
    $serien = DB::fetchAll(
        "SELECT s.id, s.name, s.kuerzel,
                COUNT(v.id) AS anz_veranstaltungen,
                MIN(YEAR(v.datum)) AS jahr_von,
                MAX(YEAR(v.datum)) AS jahr_bis,
                (SELECT v2.ort FROM $vTbl v2
                   WHERE v2.serie_id = s.id AND v2.geloescht_am IS NULL AND v2.ort IS NOT NULL AND v2.ort <> ''
                   ORDER BY v2.datum DESC LIMIT 1) AS ort_letzte,
                (SELECT v3.name FROM $vTbl v3
                   WHERE v3.serie_id = s.id AND v3.geloescht_am IS NULL
                   ORDER BY v3.datum DESC LIMIT 1) AS name_letzte
         FROM $sTbl s
         LEFT JOIN $vTbl v ON v.serie_id = s.id AND v.geloescht_am IS NULL
         GROUP BY s.id, s.name, s.kuerzel
         ORDER BY s.name"
    );
    jsonOk($serien);
}

// GET veranstaltung-serien/{id} – Serien-Detail: Veranstaltungen nach Jahr
if ($res === 'veranstaltung-serien' && $method === 'GET' && $id) {
    $sTbl = DB::tbl('veranstaltung_serien');
    $vTbl = DB::tbl('veranstaltungen');
    $eTbl = ergebnisTbl('strasse', $unified, $_sys);

    $serie = DB::fetchOne("SELECT * FROM $sTbl WHERE id=?", [$id]);
    if (!$serie) jsonErr('Serie nicht gefunden.', 404);

    // Bestleistungen-Modus: ?disz=&mapping_id=&merge_ak=
    if (isset($_GET['disz']) && $_GET['disz'] !== '') {
        $disz      = $_GET['disz'];
        $mappingId = isset($_GET['mapping_id']) && is_numeric($_GET['mapping_id']) ? (int)$_GET['mapping_id'] : null;
        $mergeAK   = ($_GET['merge_ak'] ?? '1') !== '0';
        $unique    = ($_GET['unique']    ?? '1') !== '0';

        // Kategorie-Meta ermitteln
        $katRow = null;
        if ($mappingId) {
            $katRow = DB::fetchOne(
                "SELECT k.tbl_key, k.fmt, k.sort_dir FROM " . DB::tbl('disziplin_mapping') . " m
                 JOIN " . DB::tbl('disziplin_kategorien') . " k ON k.id=m.kategorie_id
                 WHERE m.id=?", [$mappingId]
            );
        }
        $fmt     = $katRow['fmt']      ?? 'min';
        $sortDir = $katRow['sort_dir'] ?? 'ASC';

        // Disziplin-Bedingung
        if ($mappingId) {
            $diszCond  = "e.disziplin_mapping_id=?";
            $diszParam = $mappingId;
        } else {
            $diszCond  = "e.disziplin=?";
            $diszParam = $disz;
        }

        if ($fmt === 'm') {
            $sortCol = "COALESCE(e.resultat_num, CAST(e.resultat AS DECIMAL(10,3)))";
        } else {
            $sortCol = $unified
                ? "COALESCE(e.resultat_num,
                    CASE WHEN e.resultat REGEXP '^[0-9]{1,2}:[0-9]{2}:[0-9]{2}'
                         THEN TIME_TO_SEC(e.resultat)
                         WHEN e.resultat REGEXP '^[0-9]+:[0-9]'
                         THEN TIME_TO_SEC(CONCAT('00:',REPLACE(REPLACE(e.resultat,',','.'),';','.')))
                         ELSE CAST(REPLACE(e.resultat,',','.') AS DECIMAL(10,3)) END)"
                : "LPAD(e.resultat, 10, '0')";
        }

        $akExpr    = buildAkCaseExpr($mergeAK);
        $nameExpr  = "CONCAT(COALESCE(a.nachname,''), IF(a.vorname IS NOT NULL AND a.vorname != '', CONCAT(', ', a.vorname), ''))";

        $all_rows = DB::fetchAll(
            "SELECT e.resultat, $sortCol AS _sv, v.datum, $akExpr AS altersklasse,
                    $nameExpr AS athlet, a.id AS athlet_id, a.geschlecht
             FROM $eTbl e
             JOIN " . DB::tbl('athleten') . " a ON a.id=e.athlet_id
             JOIN $vTbl v ON v.id=e.veranstaltung_id
             WHERE $diszCond AND v.serie_id=? AND e.geloescht_am IS NULL
               AND a.geloescht_am IS NULL AND v.geloescht_am IS NULL AND v.genehmigt=1
             ORDER BY _sv $sortDir", [$diszParam, $id]
        );

        $pbDedup = function(array $rows) use ($unique): array {
            if (!$unique) return $rows;
            $seen = []; $out = [];
            foreach ($rows as $r) {
                $aid = $r['athlet_id'];
                if (!isset($seen[$aid])) { $seen[$aid] = true; $out[] = $r; }
            }
            return $out;
        };

        $limit  = $unique ? 50 : 500;
        $gesamt = array_slice($pbDedup($all_rows), 0, $limit);
        $maenner = array_slice($pbDedup(array_values(array_filter($all_rows, function($r) {
            return $r['geschlecht'] === 'M';
        }))), 0, $limit);
        $frauen = array_slice($pbDedup(array_values(array_filter($all_rows, function($r) {
            return $r['geschlecht'] === 'W';
        }))), 0, $limit);

        // AK-Bestleistungen
        $aks_raw = array_unique(array_column($all_rows, 'altersklasse'));
        $by_ak = [];
        foreach ($aks_raw as $ak_val) {
            if (!$ak_val) continue;
            $ak_rows = array_values(array_filter($all_rows, function($r) use ($ak_val) {
                return (string)$r['altersklasse'] === (string)$ak_val;
            }));
            $by_ak[$ak_val] = array_slice($pbDedup($ak_rows), 0, $limit);
        }

        jsonOk(compact('gesamt','maenner','frauen','by_ak','fmt','sortDir'));
    }

    // Teilnahmen-Ranking: ?teilnahmen=1
    if (isset($_GET['teilnahmen'])) {
        $pbTbl = DB::tbl('athlet_pb');
        $aTbl  = DB::tbl('athleten');
        // Vereins-Teilnahmen (pro Jahr = eine Teilnahme, egal wie viele Distanzen)
        $vereinsRows = DB::fetchAll(
            "SELECT a.id AS athlet_id, a.name_nv AS athlet, a.geschlecht,
                    COUNT(DISTINCT YEAR(v.datum)) AS teilnahmen,
                    MIN(v.datum) AS erstes_jahr, MAX(v.datum) AS letztes_jahr,
                    0 AS nur_extern
             FROM $eTbl e
             JOIN $aTbl a ON a.id=e.athlet_id
             JOIN $vTbl v ON v.id=e.veranstaltung_id
             WHERE v.serie_id=? AND e.geloescht_am IS NULL
               AND a.geloescht_am IS NULL AND v.geloescht_am IS NULL AND v.genehmigt=1
             GROUP BY a.id, a.name_nv, a.geschlecht",
            [$id]
        );
        // Externe Teilnahmen (athlet_pb mit veranstaltung_id in dieser Serie)
        $externRows = DB::fetchAll(
            "SELECT a.id AS athlet_id, a.name_nv AS athlet, a.geschlecht,
                    COUNT(DISTINCT YEAR(v.datum)) AS teilnahmen,
                    MIN(v.datum) AS erstes_jahr, MAX(v.datum) AS letztes_jahr,
                    1 AS nur_extern
             FROM $pbTbl pb
             JOIN $aTbl a ON a.id=pb.athlet_id
             JOIN $vTbl v ON v.id=pb.veranstaltung_id
             WHERE v.serie_id=? AND pb.veranstaltung_id IS NOT NULL
               AND a.geloescht_am IS NULL AND v.geloescht_am IS NULL AND v.genehmigt=1
             GROUP BY a.id, a.name_nv, a.geschlecht",
            [$id]
        );
        // Mergen: Vereinsathleten bekommen extern=false; reine Extern-Athleten extern=true
        $vereinsIds = array_column($vereinsRows, 'athlet_id');
        $merged = $vereinsRows;
        foreach ($externRows as $er) {
            $idx = array_search($er['athlet_id'], $vereinsIds);
            if ($idx !== false) {
                // Athlet hat beides: externe Starts addieren, extern=mixed
                $merged[$idx]['teilnahmen'] += $er['teilnahmen'];
                $merged[$idx]['extern_teilnahmen'] = (int)$er['teilnahmen'];
                $merged[$idx]['nur_extern'] = 0;
            } else {
                $er['extern_teilnahmen'] = (int)$er['teilnahmen'];
                $merged[] = $er;
            }
        }
        usort($merged, function($a, $b) {
            // 1. Gesamt-Teilnahmen absteigend
            $cmp = $b['teilnahmen'] <=> $a['teilnahmen'];
            if ($cmp !== 0) return $cmp;
            // 2. Vereins-Teilnahmen absteigend (= Gesamt minus externe)
            $aVerein = (int)$a['teilnahmen'] - (int)($a['extern_teilnahmen'] ?? 0);
            $bVerein = (int)$b['teilnahmen'] - (int)($b['extern_teilnahmen'] ?? 0);
            $cmp2 = $bVerein <=> $aVerein;
            if ($cmp2 !== 0) return $cmp2;
            // 3. Alphabetisch
            return strcmp($a['athlet'], $b['athlet']);
        });
        // Jahre pro Athlet (Verein + Extern)
        $detailVerein = DB::fetchAll(
            "SELECT DISTINCT e.athlet_id, YEAR(v.datum) AS jahr, 0 AS extern
             FROM $eTbl e JOIN $vTbl v ON v.id=e.veranstaltung_id
             WHERE v.serie_id=? AND e.geloescht_am IS NULL
               AND v.geloescht_am IS NULL AND v.genehmigt=1",
            [$id]
        );
        $detailExtern = DB::fetchAll(
            "SELECT DISTINCT pb.athlet_id, YEAR(v.datum) AS jahr, 1 AS extern
             FROM $pbTbl pb JOIN $vTbl v ON v.id=pb.veranstaltung_id
             WHERE v.serie_id=? AND pb.veranstaltung_id IS NOT NULL
               AND v.geloescht_am IS NULL AND v.genehmigt=1",
            [$id]
        );
        $jahreMap = [];
        foreach (array_merge($detailVerein, $detailExtern) as $row) {
            $aid2 = $row['athlet_id'];
            $jahr = (int)$row['jahr'];
            if (!isset($jahreMap[$aid2][$jahr])) {
                $jahreMap[$aid2][$jahr] = ['extern' => (bool)$row['extern']];
            } elseif (!$row['extern']) {
                $jahreMap[$aid2][$jahr]['extern'] = false; // Vereins-Start gewinnt
            }
        }
        foreach ($merged as &$r) {
            $jm = $jahreMap[$r['athlet_id']] ?? [];
            ksort($jm);
            $r['jahre']       = array_keys($jm);
            $r['jahre_extern'] = array_values(array_map(function($v){return $v['extern'];}, $jm));
            // Teilnahmen-Anzahl = Anzahl eindeutige Jahre (exakte Übereinstimmung mit Tabellenpunkten)
            $r['teilnahmen']  = count($jm);
        }
        unset($r);
        jsonOk($merged);
    }

    // Disziplinen-Liste: ?disziplinen=1
    if (isset($_GET['disziplinen'])) {
        $disz_rows = DB::fetchAll(
            "SELECT DISTINCT e.disziplin, e.disziplin_mapping_id,
                    m.anzeige_name, k.name AS kategorie_name, k.tbl_key, k.reihenfolge,
                    COUNT(e.id) AS cnt
             FROM $eTbl e
             JOIN $vTbl v ON v.id=e.veranstaltung_id
             LEFT JOIN " . DB::tbl('disziplin_mapping') . " m ON m.id=e.disziplin_mapping_id
             LEFT JOIN " . DB::tbl('disziplin_kategorien') . " k ON k.id=m.kategorie_id
             WHERE v.serie_id=? AND e.geloescht_am IS NULL
               AND v.geloescht_am IS NULL AND v.genehmigt=1
             GROUP BY e.disziplin, e.disziplin_mapping_id
             ORDER BY k.reihenfolge, e.disziplin", [$id]
        );
        jsonOk($disz_rows);
    }

    // Standard: Serien-Info + Veranstaltungen nach Jahr
    $veranst = DB::fetchAll(
        "SELECT v.id, v.kuerzel, v.name, v.ort, v.datum, v.datenquelle,
                YEAR(v.datum) AS jahr,
                COUNT(e.id) AS anz_ergebnisse,
                COUNT(DISTINCT e.athlet_id) AS anz_athleten
         FROM $vTbl v
         LEFT JOIN $eTbl e ON e.veranstaltung_id=v.id AND e.geloescht_am IS NULL
         WHERE v.serie_id=? AND v.geloescht_am IS NULL AND v.genehmigt=1
         GROUP BY v.id
         ORDER BY v.datum DESC", [$id]
    );

    foreach ($veranst as &$v) {
        $vereinErg = DB::fetchAll(
            "SELECT a.name_nv AS athlet, a.id AS athlet_id, e.altersklasse, e.disziplin,
                    e.disziplin_mapping_id, k.name AS kategorie_name, k.tbl_key,
                    e.resultat, e.meisterschaft, e.ak_platzierung, e.ak_platz_meisterschaft,
                    COALESCE(m.fmt_override, k.fmt) AS fmt,
                    0 AS extern
             FROM $eTbl e
             JOIN " . DB::tbl('athleten') . " a ON a.id=e.athlet_id
             LEFT JOIN " . DB::tbl('disziplin_mapping') . " m ON m.id=e.disziplin_mapping_id
             LEFT JOIN " . DB::tbl('disziplin_kategorien') . " k ON k.id=m.kategorie_id
             WHERE e.veranstaltung_id=? AND e.geloescht_am IS NULL
             ORDER BY e.resultat_num ASC, e.resultat ASC",
            [$v['id']]
        );
        $externErg = [];
        try {
            $externErg = DB::fetchAll(
                "SELECT a.name_nv AS athlet, a.id AS athlet_id, pb.altersklasse, pb.disziplin,
                        pb.disziplin_mapping_id, k.name AS kategorie_name, k.tbl_key,
                        pb.resultat, NULL AS meisterschaft, NULL AS ak_platzierung, NULL AS ak_platz_meisterschaft,
                        COALESCE(m.fmt_override, k.fmt) AS fmt,
                        1 AS extern
                 FROM " . DB::tbl('athlet_pb') . " pb
                 JOIN " . DB::tbl('athleten') . " a ON a.id=pb.athlet_id
                 LEFT JOIN " . DB::tbl('disziplin_mapping') . " m ON m.id=pb.disziplin_mapping_id
                 LEFT JOIN " . DB::tbl('disziplin_kategorien') . " k ON k.id=m.kategorie_id
                 WHERE pb.veranstaltung_id=?",
                [$v['id']]
            );
        } catch (\Exception $e) {}
        $v['ergebnisse'] = array_merge($vereinErg, $externErg);
    }
    unset($v);

    jsonOk(compact('serie','veranst'));
}

// POST veranstaltung-serien – neue Serie anlegen
if ($res === 'veranstaltung-serien' && $method === 'POST') {
    Auth::requireRecht('veranstaltung_eintragen');
    $name    = trim(sanitize($body['name'] ?? ''));
    if (!$name) jsonErr('Name erforderlich.', 400);
    // Kürzel automatisch aus Name generieren (nicht mehr vom User eingegeben)
    $kuerzel = strtoupper(preg_replace('/[^A-Z0-9]+/i', '-', $name));
    $kuerzel = trim($kuerzel, '-');
    $kuerzel = substr($kuerzel, 0, 30);
    $sTbl = DB::tbl('veranstaltung_serien');
    // Eindeutigkeit sicherstellen
    $base = $kuerzel; $i = 2;
    while (DB::fetchOne("SELECT id FROM $sTbl WHERE kuerzel=?", [$kuerzel])) {
        $kuerzel = $base . '-' . $i++;
    }
    DB::query("INSERT INTO $sTbl (name, kuerzel) VALUES (?,?)", [$name, $kuerzel]);
    $newId = DB::lastInsertId();
    jsonOk(['id' => $newId]);
}

// PUT veranstaltung-serien/{id} – Serie bearbeiten
if ($res === 'veranstaltung-serien' && $method === 'PUT' && $id) {
    Auth::requireRecht('veranstaltung_eintragen');
    $sTbl  = DB::tbl('veranstaltung_serien');
    $felder = []; $params = [];
    if (isset($body['name'])) {
        $felder[] = 'name=?'; $params[] = sanitize($body['name']);
        // Kürzel automatisch mitaktualisieren
        $autoKuerzel = strtoupper(preg_replace('/[^A-Z0-9]+/i', '-', sanitize($body['name'])));
        $autoKuerzel = trim(substr(trim($autoKuerzel, '-'), 0, 30));
        if ($autoKuerzel) { $felder[] = 'kuerzel=?'; $params[] = $autoKuerzel; }
    }
    if (!$felder) jsonErr('Keine Änderungen.');
    $params[] = $id;
    DB::query("UPDATE $sTbl SET " . implode(',', $felder) . " WHERE id=?", $params);
    jsonOk('Gespeichert.');
}

// DELETE veranstaltung-serien/{id} – Serie löschen (Veranstaltungen bleiben, serie_id → NULL)
if ($res === 'veranstaltung-serien' && $method === 'DELETE' && $id) {
    Auth::requireRecht('veranstaltung_loeschen');
    $sTbl = DB::tbl('veranstaltung_serien');
    $vTbl = DB::tbl('veranstaltungen');
    DB::query("UPDATE $vTbl SET serie_id=NULL WHERE serie_id=?", [$id]);
    DB::query("DELETE FROM $sTbl WHERE id=?", [$id]);
    jsonOk('Serie gel&ouml;scht.');
}

// ============================================================
// VERANSTALTUNGEN
// ============================================================
// Ausstehende Veranstaltungen (genehmigt=0) – nur Admin/Editor
if ($res === 'veranstaltungen' && $method === 'GET' && isset($_GET['pending'])) {
    Auth::requireRecht('veranstaltung_eintragen');
    // Unveröffentlicht (genehmigt=0)
    $pending = DB::fetchAll(
        "SELECT v.id, v.kuerzel, v.name, v.ort, v.datum,
                COUNT(e.id) AS anz_ergebnisse,
                COUNT(DISTINCT e.athlet_id) AS anz_athleten,
                0 AS geloescht
         FROM " . DB::tbl('veranstaltungen') . " v
         LEFT JOIN " . DB::tbl('ergebnisse') . " e ON e.veranstaltung_id = v.id AND e.geloescht_am IS NULL
         WHERE v.geloescht_am IS NULL AND v.genehmigt = 0
         GROUP BY v.id"
    );
    // Gelöscht aber mit Ergebnissen (versehentlich gelöscht)
    $geloescht = DB::fetchAll(
        "SELECT v.id, v.kuerzel, v.name, v.ort, v.datum,
                COUNT(e.id) AS anz_ergebnisse,
                COUNT(DISTINCT e.athlet_id) AS anz_athleten,
                1 AS geloescht
         FROM " . DB::tbl('veranstaltungen') . " v
         JOIN " . DB::tbl('ergebnisse') . " e ON e.veranstaltung_id = v.id AND e.geloescht_am IS NULL
         WHERE v.geloescht_am IS NOT NULL
         GROUP BY v.id"
    );
    jsonOk(['pending' => array_merge($pending, $geloescht)]);
}

if ($res === 'veranstaltungen' && $method === 'GET') {
    // Öffentlich zugänglich
    $eTbl = ergebnisTbl('strasse', $unified, $_sys);
    $isSearch = trim($_GET['suche'] ?? '') !== '';
    $maxLimit = $isSearch ? 200 : 50; // Für Suche höheres Limit erlauben
    $limit = min((int)($_GET['limit'] ?? 10), $maxLimit);
    $offset = (int)($_GET['offset'] ?? 0);
    $suche = trim($_GET['suche'] ?? '');
    $whereExtra = '';
    $searchParams = [];
    if (!empty($_GET['id'])) {
        $whereExtra = ' AND v.id=?';
        $searchParams = [(int)$_GET['id']];
        $limit = 1;
    } elseif ($suche !== '') {
        $s = '%' . $suche . '%';
        $whereExtra = ' AND (v.name LIKE ? OR v.kuerzel LIKE ? OR v.ort LIKE ?)';
        $searchParams = [$s, $s, $s];
    }
    $veranst = DB::fetchAll(
        "SELECT v.id, v.kuerzel, v.name, v.ort, v.datum, v.datenquelle, v.serie_id,
                COUNT(e.id) AS anz_ergebnisse,
                COUNT(DISTINCT e.athlet_id) AS anz_athleten
         FROM " . DB::tbl('veranstaltungen') . " v
         LEFT JOIN $eTbl e ON e.veranstaltung_id = v.id AND e.geloescht_am IS NULL
         WHERE v.geloescht_am IS NULL AND v.genehmigt = 1$whereExtra
         GROUP BY v.id, v.datenquelle, v.serie_id
         ORDER BY v.datum DESC
         LIMIT $limit OFFSET $offset",
        $searchParams
    );
    $total = DB::fetchOne("SELECT COUNT(*) c FROM " . DB::tbl('veranstaltungen') . " v WHERE v.geloescht_am IS NULL AND v.genehmigt = 1$whereExtra", $searchParams)['c'];
    foreach ($veranst as &$v) {
        $vereinErg = DB::fetchAll(
            "SELECT a.name_nv AS athlet, a.id AS athlet_id, e.altersklasse, e.disziplin,
                    e.disziplin_mapping_id, k.name AS kategorie_name, k.tbl_key,
                    e.resultat, e.meisterschaft, e.ak_platzierung, e.ak_platz_meisterschaft,
                    COALESCE(m.fmt_override, k.fmt) AS fmt,
                    0 AS extern
             FROM $eTbl e
             JOIN " . DB::tbl('athleten') . " a ON a.id=e.athlet_id
             LEFT JOIN " . DB::tbl('disziplin_mapping') . " m ON m.id=e.disziplin_mapping_id
             LEFT JOIN " . DB::tbl('disziplin_kategorien') . " k ON k.id=m.kategorie_id
             WHERE e.veranstaltung_id=? AND e.geloescht_am IS NULL
             ORDER BY e.resultat_num ASC, e.resultat ASC",
            [$v['id']]
        );
        $externErg = [];
        try {
            $externErg = DB::fetchAll(
                "SELECT a.name_nv AS athlet, a.id AS athlet_id, pb.altersklasse, pb.disziplin,
                        pb.disziplin_mapping_id, k.name AS kategorie_name, k.tbl_key,
                        pb.resultat, NULL AS meisterschaft, NULL AS ak_platzierung, NULL AS ak_platz_meisterschaft,
                        COALESCE(m.fmt_override, k.fmt) AS fmt,
                        1 AS extern
                 FROM " . DB::tbl('athlet_pb') . " pb
                 JOIN " . DB::tbl('athleten') . " a ON a.id=pb.athlet_id
                 LEFT JOIN " . DB::tbl('disziplin_mapping') . " m ON m.id=pb.disziplin_mapping_id
                 LEFT JOIN " . DB::tbl('disziplin_kategorien') . " k ON k.id=m.kategorie_id
                 WHERE pb.veranstaltung_id=?",
                [$v['id']]
            );
        } catch (\Exception $e) {}
        $v['ergebnisse'] = array_merge($vereinErg, $externErg);
    }
    unset($v);
    // Serien mit Ergebnisanzahl, nach Suche gefiltert
    $serienWhere = '';
    $serienParams = [];
    if ($suche !== '') {
        $serienWhere = " WHERE s.name LIKE ? OR s.kuerzel LIKE ?";
        $serienParams = ['%'.$suche.'%', '%'.$suche.'%'];
    }
    $vTbl2  = DB::tbl('veranstaltungen');
    $pbTbl2 = DB::tbl('athlet_pb');
    $sTbl2  = DB::tbl('veranstaltung_serien');
    $serien = DB::fetchAll(
        "SELECT s.id, s.name, s.kuerzel,
                (SELECT COUNT(*) FROM $eTbl ei
                 JOIN $vTbl2 vi ON vi.id=ei.veranstaltung_id
                 WHERE vi.serie_id=s.id AND vi.geloescht_am IS NULL AND vi.genehmigt=1 AND ei.geloescht_am IS NULL)
                +
                (SELECT COUNT(*) FROM $pbTbl2 pi
                 JOIN $vTbl2 vpi ON vpi.id=pi.veranstaltung_id
                 WHERE vpi.serie_id=s.id AND vpi.geloescht_am IS NULL AND vpi.genehmigt=1 AND pi.veranstaltung_id IS NOT NULL)
                AS anz_ergebnisse,
                (SELECT COUNT(DISTINCT ei2.athlet_id) FROM $eTbl ei2
                 JOIN $vTbl2 vi2 ON vi2.id=ei2.veranstaltung_id
                 WHERE vi2.serie_id=s.id AND vi2.geloescht_am IS NULL AND vi2.genehmigt=1 AND ei2.geloescht_am IS NULL)
                +
                (SELECT COUNT(DISTINCT pi2.athlet_id) FROM $pbTbl2 pi2
                 JOIN $vTbl2 vpi2 ON vpi2.id=pi2.veranstaltung_id
                 WHERE vpi2.serie_id=s.id AND vpi2.geloescht_am IS NULL AND vpi2.genehmigt=1 AND pi2.veranstaltung_id IS NOT NULL
                 AND pi2.athlet_id NOT IN (
                   SELECT ei3.athlet_id FROM $eTbl ei3
                   JOIN $vTbl2 vi3 ON vi3.id=ei3.veranstaltung_id
                   WHERE vi3.serie_id=s.id AND vi3.geloescht_am IS NULL AND vi3.genehmigt=1 AND ei3.geloescht_am IS NULL
                 )) AS anz_athleten,
                COUNT(DISTINCT v.id) AS anz_austragungen,
                MIN(YEAR(v.datum))   AS jahr_von,
                MAX(YEAR(v.datum))   AS jahr_bis
         FROM $sTbl2 s
         LEFT JOIN $vTbl2 v ON v.serie_id=s.id AND v.geloescht_am IS NULL AND v.genehmigt=1
         $serienWhere
         GROUP BY s.id, s.name, s.kuerzel
         ORDER BY anz_ergebnisse DESC",
        $serienParams
    );
    jsonOk(compact('veranst','total','serien'));
}

if ($res === 'veranstaltungen' && $method === 'PUT' && $id) {
    Auth::requireRecht('veranstaltung_eintragen');
    $felder = []; $params = [];
    if (isset($body['name']))        { $felder[] = 'name=?';        $params[] = sanitize($body['name'] ?? '') ?: null; }
    if (!empty($body['datum']))      { $felder[] = 'datum=?';       $params[] = $body['datum']; }
    if (isset($body['ort']))         { $felder[] = 'ort=?';         $params[] = sanitize($body['ort'] ?? '') ?: null; }
    if (isset($body['genehmigt']))   { $felder[] = 'genehmigt=?';   $params[] = $body['genehmigt'] ? 1 : 0; }
    if (array_key_exists('serie_id', $body)) { $felder[] = 'serie_id=?'; $params[] = $body['serie_id'] ? (int)$body['serie_id'] : null; }
    if (!empty($body['restore']))    { $felder[] = 'geloescht_am=NULL'; } // Aus Papierkorb wiederherstellen
    if (!$felder) jsonErr('Keine Änderungen.');
    $params[] = $id;
    DB::query('UPDATE ' . DB::tbl('veranstaltungen') . ' SET ' . implode(',', $felder) . ' WHERE id=?', $params);
    jsonOk('Gespeichert.');
}

if ($res === 'veranstaltungen' && $method === 'DELETE' && $id) {
    Auth::requireRecht('veranstaltung_loeschen');
    $eTbl = ergebnisTbl('strasse', $unified, $_sys);
    // Ergebnisse aus ALLEN Tabellen soft-löschen (unified + legacy)
    $anz = 0;
    try { $anz += (int)(DB::fetchOne("SELECT COUNT(*) c FROM " . DB::tbl('ergebnisse') . " WHERE veranstaltung_id=? AND geloescht_am IS NULL", [$id])['c'] ?? 0); } catch (\Exception $e) {}
    try { DB::query("UPDATE " . DB::tbl('ergebnisse') . " SET geloescht_am=NOW() WHERE veranstaltung_id=? AND geloescht_am IS NULL", [$id]); } catch (\Exception $e) {}
    try { DB::query("UPDATE $eTbl SET geloescht_am=NOW() WHERE veranstaltung_id=? AND geloescht_am IS NULL", [$id]); } catch (\Exception $e) {}
    DB::query("UPDATE " . DB::tbl('veranstaltungen') . " SET geloescht_am=NOW() WHERE id=?", [$id]);
    jsonOk('In Papierkorb verschoben (' . $anz . ' Ergebnisse ebenfalls).');
}

// ============================================================
// EXTERNE ERGEBNISSE (athlet_pb) – Ergebnisse-Seite
// ============================================================
if ($res === 'externe-ergebnisse' && $method === 'GET' && !$id) {
    $user = Auth::requireRecht('externe_ergebnisse_sehen');
    $pbTbl = DB::tbl('athlet_pb');
    $aTbl  = DB::tbl('athleten');
    $vTbl  = DB::tbl('veranstaltungen');
    $dmTbl = DB::tbl('disziplin_mapping');
    $dkTbl = DB::tbl('disziplin_kategorien');
    $where = ['1=1']; $params = [];
    if (!empty($_GET['athlet']))   { $where[] = 'a.name_nv LIKE ?'; $params[] = '%'.$_GET['athlet'].'%'; }
    if (!empty($_GET['athlet_id'])) { $where[] = 'pb.athlet_id=?'; $params[] = (int)$_GET['athlet_id']; }
    if (!empty($_GET['disziplin_mapping_id'])) { $where[] = 'pb.disziplin_mapping_id=?'; $params[] = (int)$_GET['disziplin_mapping_id']; }
    elseif (!empty($_GET['disziplin'])) { $where[] = 'pb.disziplin=?'; $params[] = $_GET['disziplin']; }
    if (!empty($_GET['ak'])) { $where[] = 'pb.altersklasse=?'; $params[] = $_GET['ak']; }
    if (!empty($_GET['jahr'])) { $where[] = 'YEAR(pb.datum)=?'; $params[] = (int)$_GET['jahr']; }
    if (!empty($_GET['athlet'])) {} // already handled
    $sortMap = ['datum'=>'pb.datum','athlet'=>'a.name_nv','ak'=>'pb.altersklasse','disziplin'=>'pb.disziplin','resultat'=>'pb.resultat'];
    $sortKey = $_GET['sort'] ?? 'datum'; $sortDir = strtoupper($_GET['dir'] ?? 'DESC') === 'ASC' ? 'ASC' : 'DESC';
    $sortCol = $sortMap[$sortKey] ?? 'pb.datum';
    $limit = min((int)($_GET['limit'] ?? 100), 500); $offset = (int)($_GET['offset'] ?? 0);
    $wStr = implode(' AND ', $where);
    $sql = "SELECT pb.id, a.name_nv AS athlet, a.id AS athlet_id, pb.altersklasse,
                   pb.disziplin, pb.disziplin_mapping_id, pb.resultat,
                   pb.datum, pb.wettkampf AS veranstaltung, pb.veranstaltung_id,
                   NULL AS ort, NULL AS veranstaltung_ort,
                   COALESCE(v.name, pb.wettkampf) AS veranstaltung_name,
                   NULL AS veranstaltung_quelle,
                   v.serie_id AS verknuepfte_serie_id,
                   v.name AS verknuepfte_veranstaltung_name,
                   COALESCE(CONCAT(ab.vorname,' ',ab.nachname), b.benutzername) AS eingetragen_von,
                   pb.datum AS erstellt_am,
                   NULL AS ak_platzierung, NULL AS meisterschaft, NULL AS ak_platz_meisterschaft,
                   COALESCE(dm.fmt_override, dk.fmt) AS fmt,
                   dk.name AS kategorie_name, dk.tbl_key AS kategorie_key,
                   1 AS extern
            FROM $pbTbl pb
            JOIN $aTbl a ON a.id=pb.athlet_id
            LEFT JOIN $vTbl v ON v.id=pb.veranstaltung_id
            LEFT JOIN " . DB::tbl('benutzer') . " b ON b.id=pb.erstellt_von
            LEFT JOIN $aTbl ab ON ab.id=b.athlet_id
            LEFT JOIN $dmTbl dm ON dm.id=pb.disziplin_mapping_id
            LEFT JOIN $dkTbl dk ON dk.id=dm.kategorie_id
            WHERE a.geloescht_am IS NULL AND $wStr
            ORDER BY $sortCol $sortDir, pb.id DESC LIMIT $limit OFFSET $offset";
    $rows  = DB::fetchAll($sql, $params);
    $total = (int)DB::fetchOne("SELECT COUNT(*) c FROM $pbTbl pb JOIN $aTbl a ON a.id=pb.athlet_id WHERE a.geloescht_am IS NULL AND $wStr", $params)['c'];
    $disziplinen = DB::fetchAll("SELECT DISTINCT pb.disziplin, pb.disziplin_mapping_id, dk.name AS kategorie_name FROM $pbTbl pb LEFT JOIN $dmTbl dm ON dm.id=pb.disziplin_mapping_id LEFT JOIN $dkTbl dk ON dk.id=dm.kategorie_id WHERE 1=1 ORDER BY pb.disziplin");
    $aks   = array_column(DB::fetchAll("SELECT DISTINCT pb.altersklasse FROM $pbTbl pb WHERE pb.altersklasse IS NOT NULL ORDER BY pb.altersklasse"), 'altersklasse');
    $jahre = array_column(DB::fetchAll("SELECT DISTINCT YEAR(pb.datum) j FROM $pbTbl pb WHERE pb.datum IS NOT NULL ORDER BY j DESC"), 'j');
    jsonOk(compact('rows','total','disziplinen','aks','jahre','kategorien') + ['kategorien'=>[]]);
}

// externe-ergebnisse DELETE
if ($res === 'externe-ergebnisse' && $method === 'DELETE' && $id) {
    $user = Auth::requireEditor();
    DB::query('DELETE FROM ' . DB::tbl('athlet_pb') . ' WHERE id=?', [(int)$id]);
    jsonOk('Gelöscht.');
}

// externe-ergebnisse PUT (edit)
if ($res === 'externe-ergebnisse' && $method === 'PUT' && $id) {
    $user = Auth::requireEditor();
    $felder = []; $params = [];
    if (isset($body['disziplin']))          { $felder[] = 'disziplin=?';          $params[] = sanitize($body['disziplin']); }
    if (isset($body['disziplin_mapping_id'])){ $felder[] = 'disziplin_mapping_id=?'; $params[] = intOrNull($body['disziplin_mapping_id']); }
    if (isset($body['resultat']))           { $felder[] = 'resultat=?';           $params[] = sanitize($body['resultat']); }
    if (isset($body['altersklasse']))       { $felder[] = 'altersklasse=?';       $params[] = sanitize($body['altersklasse']) ?: null; }
    if (isset($body['wettkampf']))          { $felder[] = 'wettkampf=?';          $params[] = sanitize($body['wettkampf']); }
    if (isset($body['datum']))              { $felder[] = 'datum=?';              $params[] = sanitize($body['datum']) ?: null; }
    if (array_key_exists('veranstaltung_id', $body)) {
        $felder[] = 'veranstaltung_id=?';
        $params[] = $body['veranstaltung_id'] ? (int)$body['veranstaltung_id'] : null;
    }
    if (!$felder) jsonErr('Keine Änderungen.');
    $params[] = (int)$id;
    DB::query('UPDATE ' . DB::tbl('athlet_pb') . ' SET ' . implode(',', $felder) . ' WHERE id=?', $params);
    jsonOk('Gespeichert.');
}

// ERGEBNISSE/BULK
// ============================================================
    // Eigenes Ergebnis (Athlet trägt für sich selbst ein → Genehmigung)
if ($res === 'ergebnisse' && $method === 'POST' && $id === 'eigenes') {
    $user = Auth::requireLogin();
    if (!$user['id']) jsonErr('Nicht eingeloggt.', 401);
    // Athlet-ID aus Benutzerprofil
    $buRow = DB::fetchOne('SELECT athlet_id FROM ' . DB::tbl('benutzer') . ' WHERE id = ?', [$user['id']]);
    $athId = $buRow ? intOrNull($buRow['athlet_id']) : null;
    if (!$athId) jsonErr('Kein Athletenprofil verknüpft.');

    $disziplin = sanitize($body['disziplin'] ?? '');
    $dmId      = intOrNull($body['disziplin_mapping_id'] ?? null);
    $resultat  = sanitize($body['resultat'] ?? '');
    $ak        = sanitize($body['altersklasse'] ?? '');
    if (!$disziplin || !$resultat) jsonErr('Disziplin und Ergebnis erforderlich.');

    // Veranstaltung: bestehende oder neue
    $vid = intOrNull($body['veranstaltung_id'] ?? null);
    if (!$vid) {
        $datum  = sanitize($body['datum'] ?? '');
        $ort    = sanitize($body['ort'] ?? '');
        $evname = sanitize($body['veranstaltung_name'] ?? '');
        if (!$datum || !$ort) jsonErr('Datum und Ort erforderlich.');
        $kuerzel = date('d.m.Y', strtotime($datum)) . ' ' . $ort;
        // Neue Veranstaltung anlegen (vorab – Ergebnis bleibt pending)
        $v = DB::fetchOne('SELECT id FROM ' . DB::tbl('veranstaltungen') . ' WHERE kuerzel=?', [$kuerzel]);
        if (!$v) {
            DB::query('INSERT INTO ' . DB::tbl('veranstaltungen') . ' (kuerzel,name,ort,datum,genehmigt) VALUES (?,?,?,?,0)',
                [$kuerzel, $evname ?: $kuerzel, $ort, $datum]);
            $vid = DB::lastInsertId();
        } else $vid = $v['id'];
    }

    // Ergebnis als Antrag speichern
    $neueWerte = json_encode(['veranstaltung_id'=>$vid,'athlet_id'=>$athId,'disziplin'=>$disziplin,
        'disziplin_mapping_id'=>$dmId,'resultat'=>$resultat,'altersklasse'=>$ak,
        'erstellt_von'=>$user['id']]);
    DB::query('INSERT INTO ' . DB::tbl('ergebnis_aenderungen') .
        ' (ergebnis_id,ergebnis_tbl,typ,neue_werte,beantragt_von) VALUES (?,?,?,?,?)',
        [null, 'ergebnisse', 'insert', $neueWerte, $user['id']]);
    jsonOk(['pending' => true, 'msg' => 'Ergebnis eingereicht. Wird von einem Editor geprüft.']);
}

if ($res === 'ergebnisse' && $method === 'POST' && $id === 'bulk') {
    $user = Auth::requireEditor(); // nur Admin/Editor darf Bulk-Eintragen
    $items = $body['items'] ?? [];
    if (!is_array($items) || !count($items)) jsonErr('Keine Einträge.');
    $imported = 0; $skipped = 0; $errors = [];
    foreach ($items as $idx => $item) {
        $datum     = sanitize($item['datum'] ?? '');
        $ort       = sanitize($item['ort'] ?? '');
        $evname    = sanitize($item['veranstaltung_name'] ?? '');
        $vid       = intOrNull($item['veranstaltung_id'] ?? null);
        $aid       = intOrNull($item['athlet_id'] ?? null);
        $ak        = sanitize($item['altersklasse'] ?? '');
        $disziplin = sanitize($item['disziplin'] ?? '');
        $resultat  = sanitize($item['resultat'] ?? '');
        // $pace wird nicht mehr gespeichert (on-the-fly berechnet)
        $akp       = intOrNull($item['ak_platzierung'] ?? null);
        $mstr      = intOrNull($item['meisterschaft'] ?? null);
        $akpm      = intOrNull($item['ak_platz_meisterschaft'] ?? null);
        $quelle    = sanitize($item['import_quelle'] ?? '');
        // Validierung: bei bestehender Veranstaltung kein Datum/Ort nötig
        if (!$vid && (!$datum || !$ort)) {
            $errors[] = 'Zeile ' . ($idx+1) . ': Datum und Ort oder bestehende Veranstaltung erforderlich';
            $skipped++; continue;
        }
        if (!$aid || !$disziplin || !$resultat) {
            $errors[] = 'Zeile ' . ($idx+1) . ': Pflichtfeld fehlt';
            $skipped++; continue;
        }
        if ($vid) {
            // Bestehende Veranstaltung – Existenz prüfen
            $vRow = DB::fetchOne('SELECT id,ort,datum FROM ' . DB::tbl('veranstaltungen') . ' WHERE id=?', [$vid]);
            if (!$vRow) { $errors[] = 'Zeile ' . ($idx+1) . ': Veranstaltung nicht gefunden'; $skipped++; continue; }
        } else {
            $kuerzel  = date('d.m.Y', strtotime($datum)) . ' ' . $ort;
            $serieId  = isset($item['serie_id']) && is_numeric($item['serie_id']) ? (int)$item['serie_id'] : null;
            $v = DB::fetchOne('SELECT id FROM ' . DB::tbl('veranstaltungen') . ' WHERE kuerzel=?', [$kuerzel]);
            if (!$v) {
                DB::query('INSERT INTO ' . DB::tbl('veranstaltungen') . ' (kuerzel,name,ort,datum,serie_id) VALUES (?,?,?,?,?)',
                    [$kuerzel, $evname ?: $kuerzel, $ort, $datum, $serieId]);
                $vid = DB::lastInsertId();
            } else {
                $vid = $v['id'];
                // Serie nachträglich setzen wenn noch keine zugeordnet
                if ($serieId) DB::query('UPDATE ' . DB::tbl('veranstaltungen') . ' SET serie_id=? WHERE id=? AND serie_id IS NULL', [$serieId, $vid]);
            }
        }
        // mapping_id: vom Client bevorzugen (exakter Kategorie-Treffer)
        $midFromClient = isset($item['disziplin_mapping_id']) && is_numeric($item['disziplin_mapping_id']) ? (int)$item['disziplin_mapping_id'] : null;
        if ($midFromClient) {
            $dmInfo = DB::fetchOne("SELECT dm.id, dk.fmt FROM " . DB::tbl('disziplin_mapping') . " dm LEFT JOIN " . DB::tbl('disziplin_kategorien') . " dk ON dk.id=dm.kategorie_id WHERE dm.id=?", [$midFromClient]);
        } else {
            $dmInfo = DB::fetchOne("SELECT dm.id, dk.fmt FROM " . DB::tbl('disziplin_mapping') . " dm LEFT JOIN " . DB::tbl('disziplin_kategorien') . " dk ON dk.tbl_key = (SELECT tbl_key FROM " . DB::tbl('disziplin_kategorien') . " dk2 WHERE dk2.id = dm.kategorie_id LIMIT 1) WHERE dm.disziplin=? ORDER BY dm.id LIMIT 1", [$disziplin]);
        }
        $dmFmt = $dmInfo['fmt'] ?? 'min';
        [$resultat, $rnum] = normalizeResultat($resultat, $dmFmt);

        // Externes Ergebnis (nicht für den Verein) → athlet_pb statt ergebnisse
        $isExtern = !empty($item['extern']);
        if ($isExtern) {
            $wettkampf = trim(($evname ?: '') . ($ort ? ', ' . $ort : '') . ($datum ? ' (' . $datum . ')' : ''));
            $dupPb = DB::fetchOne('SELECT id FROM ' . DB::tbl('athlet_pb') . ' WHERE athlet_id=? AND disziplin=? AND resultat=?',
                [$aid, $disziplin, $resultat]);
            if ($dupPb) { $skipped++; continue; }
            // Auch gegen interne Ergebnisse prüfen (falls bereits als Vereinsergebnis vorhanden)
            $dupInt = DB::fetchOne('SELECT id FROM ' . DB::tbl('ergebnisse') . ' WHERE athlet_id=? AND disziplin=? AND resultat=? AND geloescht_am IS NULL',
                [$aid, $disziplin, $resultat]);
            if ($dupInt) { $skipped++; continue; }
            DB::query('INSERT INTO ' . DB::tbl('athlet_pb') . ' (athlet_id, disziplin, disziplin_mapping_id, resultat, wettkampf, datum, altersklasse, veranstaltung_id, erstellt_von) VALUES (?,?,?,?,?,?,?,?,?)',
                [$aid, $disziplin, $dmInfo ? (int)$dmInfo['id'] : null, $resultat, $wettkampf, $datum ?: null, $ak, $vid ?: null, $user['id'] ?? null]);
            autoMapDisziplin($disziplin);
            $imported++;
            continue;
        }

        $dup = DB::fetchOne('SELECT id FROM ' . DB::tbl('ergebnisse') . ' WHERE veranstaltung_id=? AND athlet_id=? AND disziplin=? AND resultat=? AND geloescht_am IS NULL',
            [$vid, $aid, $disziplin, $resultat]);
        if ($dup) { $skipped++; continue; }
        // Auch gegen externe Ergebnisse prüfen (athlet_pb)
        $dupExt = DB::fetchOne('SELECT id FROM ' . DB::tbl('athlet_pb') . ' WHERE athlet_id=? AND disziplin=? AND resultat=? AND (veranstaltung_id=? OR veranstaltung_id IS NULL)',
            [$aid, $disziplin, $resultat, $vid]);
        if ($dupExt) { $skipped++; continue; }
        DB::query("INSERT INTO " . DB::tbl('ergebnisse') . " (veranstaltung_id,athlet_id,altersklasse,disziplin,disziplin_mapping_id,resultat,resultat_num,ak_platzierung,meisterschaft,ak_platz_meisterschaft,import_quelle,erstellt_von) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
            [$vid,$aid,$ak,$disziplin,$dmInfo ? (int)$dmInfo['id'] : null,$resultat,$rnum,$akp,$mstr,$akpm,$quelle,$user['id']]);
        autoMapDisziplin($disziplin);
        $imported++;
    }
    jsonOk(['imported' => $imported, 'skipped' => $skipped, 'errors' => $errors]);
}

// ============================================================
// DISZIPLINEN-LISTE für Frontend-Dropdown
// ============================================================
if ($res === 'disziplinen' && $method === 'GET') {
    // Öffentlich – wird für Bestleistungen ohne Login benötigt
    $rows = DB::fetchAll(
        "SELECT dm.id, dm.disziplin, dk.name AS kategorie, dk.tbl_key, dk.reihenfolge, COALESCE(dm.kat_suffix_override,'') AS kat_suffix_override
         FROM " . DB::tbl('disziplin_mapping') . " dm
         JOIN " . DB::tbl('disziplin_kategorien') . " dk ON dk.id = dm.kategorie_id
         ORDER BY dk.reihenfolge"
    );
    // Innerhalb jeder Kategorie nach numerischem Wert sortieren
    usort($rows, function($a, $b) {
        if ($a['reihenfolge'] !== $b['reihenfolge']) return $a['reihenfolge'] <=> $b['reihenfolge'];
        $ka = diszSortKey($a['disziplin']);
        $kb = diszSortKey($b['disziplin']);
        return $ka !== $kb ? $ka <=> $kb : strcmp($a['disziplin'], $b['disziplin']);
    });
    jsonOk($rows);
}

// ============================================================
// GRUPPEN
// ============================================================
if ($res === 'gruppen') {
    Auth::requireLogin();
    if ($method === 'GET') {
        $rows = DB::fetchAll(
            "SELECT g.id, g.name, COUNT(ag.athlet_id) AS anz_athleten
             FROM " . DB::tbl('gruppen') . " g
             LEFT JOIN " . DB::tbl('athlet_gruppen') . " ag ON ag.gruppe_id = g.id
             GROUP BY g.id ORDER BY g.name"
        );
        jsonOk($rows);
    }
    if ($method === 'POST') {
        Auth::requireEditor();
        $name = sanitize($body['name'] ?? '');
        if (!$name) jsonErr('Name erforderlich.');
        try {
            DB::query('INSERT INTO ' . DB::tbl('gruppen') . ' (name) VALUES (?)', [$name]);
            jsonOk(['id' => DB::lastInsertId()]);
        } catch (\Exception $e) { jsonErr('Gruppe bereits vorhanden.'); }
    }
    if ($method === 'DELETE' && $id) {
        Auth::requireAdmin();
        DB::query('DELETE FROM ' . DB::tbl('gruppen') . ' WHERE id=?', [$id]);
        jsonOk('Gelöscht.');
    }
}

// ============================================================
// PAPIERKORB
// ============================================================
// Tabelle für ignorierte Duplikat-Paare (lazy create)
    try { DB::query("CREATE TABLE IF NOT EXISTS " . DB::tbl('duplikate_ignoriert') . " (
        id1 INT NOT NULL,
        id2 INT NOT NULL,
        ignoriert_am DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id1, id2)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"); } catch (\Exception $e) {}

// ============================================================
// ADMIN – DUPLIKATE
// ============================================================
if ($res === 'admin' && !empty($parts[1]) && $parts[1] === 'duplikate' && $method === 'GET') {
    Auth::requireAdmin();
    $eTbl = ergebnisTbl('strasse', $unified, $_sys);
    $nameExpr = "CONCAT(COALESCE(a.nachname,''), IF(a.vorname IS NOT NULL AND a.vorname != '', CONCAT(', ', a.vorname), ''))";
    // Finde Duplikate: gleicher Athlet, gleiche Disziplin, ähnliches Ergebnis (Toleranz 2s/0.01m)
    // Toleranz über resultat_num (numerisch), ohne AK und Platzierung
    $dups = DB::fetchAll(
        "SELECT e1.id AS id1, e2.id AS id2,
                $nameExpr AS athlet, e1.athlet_id AS athlet_id1, e2.athlet_id AS athlet_id2,
                e1.disziplin,
                e1.resultat AS res1, e1.altersklasse AS ak1,
                e1.ak_platzierung AS akp1, e1.meisterschaft AS mstr1,
                e1.ak_platz_meisterschaft AS mstr_platz1,
                e1.disziplin_mapping_id AS mid1,
                e2.resultat AS res2, e2.altersklasse AS ak2,
                e2.ak_platzierung AS akp2, e2.meisterschaft AS mstr2,
                e2.ak_platz_meisterschaft AS mstr_platz2,
                e2.disziplin_mapping_id AS mid2,
                COALESCE(k1.tbl_key, 'strasse') AS tbl_key1,
                COALESCE(k2.tbl_key, 'strasse') AS tbl_key2,
                COALESCE(k1.fmt, 'min') AS fmt1, COALESCE(k2.fmt, 'min') AS fmt2,
                v1.datum AS dat1, v1.kuerzel AS veranst1, v1.id AS vid1,
                v2.datum AS dat2, v2.kuerzel AS veranst2, v2.id AS vid2,
                e1.resultat_num AS rnum1, e2.resultat_num AS rnum2,
                COALESCE(
                    NULLIF(TRIM(CONCAT(COALESCE(a1.vorname,''),' ',COALESCE(a1.nachname,''))),'' ),
                    b1.benutzername, e1.import_quelle, '–') AS eingetragen_von1,
                COALESCE(
                    NULLIF(TRIM(CONCAT(COALESCE(a2.vorname,''),' ',COALESCE(a2.nachname,''))),'' ),
                    b2.benutzername, e2.import_quelle, '–') AS eingetragen_von2
         FROM $eTbl e1
         JOIN $eTbl e2 ON e2.athlet_id=e1.athlet_id
             AND e2.disziplin=e1.disziplin
             AND e2.id > e1.id
             AND e2.geloescht_am IS NULL
         JOIN " . DB::tbl('athleten') . " a ON a.id=e1.athlet_id
         JOIN " . DB::tbl('veranstaltungen') . " v1 ON v1.id=e1.veranstaltung_id
         JOIN " . DB::tbl('veranstaltungen') . " v2 ON v2.id=e2.veranstaltung_id
         LEFT JOIN " . DB::tbl('disziplin_mapping') . " dm1 ON dm1.id=e1.disziplin_mapping_id
         LEFT JOIN " . DB::tbl('disziplin_kategorien') . " k1 ON k1.id=dm1.kategorie_id
         LEFT JOIN " . DB::tbl('disziplin_mapping') . " dm2 ON dm2.id=e2.disziplin_mapping_id
         LEFT JOIN " . DB::tbl('disziplin_kategorien') . " k2 ON k2.id=dm2.kategorie_id
         LEFT JOIN " . DB::tbl('benutzer') . " b1 ON b1.id=e1.erstellt_von
         LEFT JOIN " . DB::tbl('athleten') . " a1 ON a1.id=b1.athlet_id
         LEFT JOIN " . DB::tbl('benutzer') . " b2 ON b2.id=e2.erstellt_von
         LEFT JOIN " . DB::tbl('athleten') . " a2 ON a2.id=b2.athlet_id
         LEFT JOIN " . DB::tbl('duplikate_ignoriert') . " di
               ON (di.id1=e1.id AND di.id2=e2.id) OR (di.id1=e2.id AND di.id2=e1.id)
         WHERE e1.geloescht_am IS NULL
           AND e1.resultat_num IS NOT NULL AND e2.resultat_num IS NOT NULL
           AND ABS(e1.resultat_num - e2.resultat_num) <= 2
           AND v1.datum = v2.datum
           AND di.id1 IS NULL
         ORDER BY athlet, e1.disziplin, e1.resultat_num
         LIMIT 500"
    );
    jsonOk($dups);
}

if ($res === 'admin' && !empty($parts[1]) && $parts[1] === 'duplikate' && $method === 'POST' && !empty($parts[2])) {
    // POST admin/duplikate/ignorieren – Paar dauerhaft ignorieren
    Auth::requireAdmin();
    $diTbl = DB::tbl('duplikate_ignoriert');
    $ids = array_map('intval', explode('-', $parts[2]));
    if (count($ids) !== 2 || !$ids[0] || !$ids[1]) jsonErr('Ungültige IDs.', 400);
    sort($ids);
    try {
        DB::query("INSERT IGNORE INTO $diTbl (id1, id2) VALUES (?,?)", $ids);
    } catch (\Exception $e) { jsonErr('Fehler: ' . $e->getMessage(), 500); }
    jsonOk('Ignoriert.');
}

if ($res === 'admin' && !empty($parts[1]) && $parts[1] === 'duplikate' && $method === 'DELETE' && !empty($parts[2])) {
    Auth::requireAdmin();
    $eTbl = ergebnisTbl('strasse', $unified, $_sys);
    $id = (int)$parts[2];
    DB::query("UPDATE $eTbl SET geloescht_am=NOW() WHERE id=?", [$id]);
    jsonOk('In Papierkorb verschoben.');
}

// ============================================================
// ADMIN – VERWAISTE VERANSTALTUNGEN
// ============================================================
if ($res === 'admin' && !empty($parts[1]) && $parts[1] === 'verwaist' && $method === 'GET') {
    Auth::requireAdmin();
    $eTbl = ergebnisTbl('strasse', $unified, $_sys);
    $vTbl = DB::tbl('veranstaltungen');
    $rows = DB::fetchAll(
        "SELECT v.id, v.kuerzel, v.name, v.ort, v.datum, v.genehmigt, v.erstellt_am
         FROM $vTbl v
         LEFT JOIN $eTbl e ON e.veranstaltung_id=v.id AND e.geloescht_am IS NULL
         WHERE v.geloescht_am IS NULL
         GROUP BY v.id, v.kuerzel, v.name, v.ort, v.datum, v.genehmigt, v.erstellt_am
         HAVING COUNT(e.id) = 0
         ORDER BY v.datum DESC
         LIMIT 500"
    );
    jsonOk($rows);
}

if ($res === 'admin' && !empty($parts[1]) && $parts[1] === 'verwaist' && $method === 'DELETE' && !empty($parts[2])) {
    Auth::requireAdmin();
    $id = (int)$parts[2];
    DB::query("UPDATE " . DB::tbl('veranstaltungen') . " SET geloescht_am=NOW() WHERE id=? AND geloescht_am IS NULL", [$id]);
    jsonOk('In Papierkorb verschoben.');
}

if ($res === 'papierkorb') {
    Auth::requireAdmin();
    $eTbl = ergebnisTbl('strasse', $unified, $_sys);

    if ($method === 'GET') {
        $ergebnisse = DB::fetchAll(
            "SELECT 'ergebnis' AS typ, e.id, a.name_nv AS label,
                    e.disziplin AS detail, e.resultat, e.geloescht_am,
                    v.kuerzel AS veranstaltung
             FROM $eTbl e
             JOIN " . DB::tbl('athleten') . " a ON a.id=e.athlet_id
             JOIN " . DB::tbl('veranstaltungen') . " v ON v.id=e.veranstaltung_id
             WHERE e.geloescht_am IS NOT NULL
             ORDER BY e.geloescht_am DESC LIMIT 200"
        );
        $athleten = DB::fetchAll(
            "SELECT 'athlet' AS typ, id, name_nv AS label,
                    NULL AS detail, NULL AS resultat, geloescht_am,
                    NULL AS veranstaltung
             FROM " . DB::tbl('athleten') . " WHERE geloescht_am IS NOT NULL
             ORDER BY geloescht_am DESC LIMIT 100"
        );
        $veranst = DB::fetchAll(
            "SELECT 'veranstaltung' AS typ, id, COALESCE(name,kuerzel) AS label,
                    kuerzel AS detail, NULL AS resultat, geloescht_am,
                    NULL AS veranstaltung
             FROM " . DB::tbl('veranstaltungen') . " WHERE geloescht_am IS NOT NULL
             ORDER BY geloescht_am DESC LIMIT 100"
        );
        $benutzer = DB::fetchAll(
            "SELECT 'benutzer' AS typ, b.id,
                    COALESCE(NULLIF(TRIM(CONCAT(COALESCE(a.vorname,''),' ',COALESCE(a.nachname,''))),''),(b.benutzername)) AS label,
                    b.email AS detail, NULL AS resultat, b.geloescht_am,
                    NULL AS veranstaltung
             FROM " . DB::tbl('benutzer') . " b
             LEFT JOIN " . DB::tbl('athleten') . " a ON a.id = b.athlet_id
             WHERE b.geloescht_am IS NOT NULL
             ORDER BY b.geloescht_am DESC LIMIT 100"
        );
        jsonOk(['ergebnisse' => $ergebnisse, 'athleten' => $athleten, 'veranstaltungen' => $veranst, 'benutzer' => $benutzer]);
    }

    // Wiederherstellen: POST papierkorb/{typ}/{id}
    if ($method === 'POST') {
        $typ = $id; // z.B. "ergebnis/42" → wird als $id="ergebnis" + $sub über extra routing behandelt
        // Routing: _route = papierkorb/{typ}/{id}
        $parts = explode('/', trim($_GET['_route'] ?? '', '/'));
        // parts: ['papierkorb', typ, id]
        $rtyp = $parts[1] ?? '';
        $rid  = (int)($parts[2] ?? 0);
        if (!$rid) jsonErr('Ungültige ID.');

        if ($rtyp === 'ergebnis') {
            DB::query("UPDATE $eTbl SET geloescht_am=NULL WHERE id=?", [$rid]);
        } elseif ($rtyp === 'athlet') {
            DB::query("UPDATE " . DB::tbl('athleten') . " SET geloescht_am=NULL WHERE id=?", [$rid]);
        } elseif ($rtyp === 'veranstaltung') {
            DB::query("UPDATE " . DB::tbl('veranstaltungen') . " SET geloescht_am=NULL WHERE id=?", [$rid]);
            // Ergebnisse der Veranstaltung ebenfalls wiederherstellen
            DB::query("UPDATE $eTbl SET geloescht_am=NULL WHERE veranstaltung_id=? AND geloescht_am IS NOT NULL", [$rid]);
        } elseif ($rtyp === 'benutzer') {
            // Konto reaktivieren – athlet_id bleibt erhalten
            DB::query("UPDATE " . DB::tbl('benutzer') . " SET geloescht_am=NULL, aktiv=1 WHERE id=?", [$rid]);
        } else jsonErr('Unbekannter Typ.');
        jsonOk('Wiederhergestellt.');
    }

    // Endgültig löschen: DELETE papierkorb/{typ}/{id}  –oder–  DELETE papierkorb/alle
    if ($method === 'DELETE') {
        $parts = explode('/', trim($_GET['_route'] ?? '', '/'));
        $rtyp = $parts[1] ?? '';
        $rid  = (int)($parts[2] ?? 0);

        // Papierkorb komplett leeren
        if ($rtyp === 'alle') {
            // Alle Ergebnistabellen leeren (unified + legacy)
            try { DB::query("DELETE FROM " . DB::tbl('ergebnisse') . " WHERE geloescht_am IS NOT NULL"); } catch (\Exception $e) {}
            try { DB::query("DELETE FROM $eTbl WHERE geloescht_am IS NOT NULL"); } catch (\Exception $e) {}
            DB::query("DELETE FROM " . DB::tbl('athleten') . " WHERE geloescht_am IS NOT NULL");
            DB::query("DELETE FROM " . DB::tbl('veranstaltungen') . " WHERE geloescht_am IS NOT NULL");
            // Benutzer: erst athlet_id trennen, dann löschen
            DB::query("UPDATE " . DB::tbl('benutzer') . " SET athlet_id=NULL WHERE geloescht_am IS NOT NULL");
            DB::query("DELETE FROM " . DB::tbl('benutzer') . " WHERE geloescht_am IS NOT NULL");
            jsonOk('Papierkorb geleert.');
        }

        if (!$rid) jsonErr('Ungültige ID.');

        if ($rtyp === 'ergebnis') {
            DB::query("DELETE FROM $eTbl WHERE id=? AND geloescht_am IS NOT NULL", [$rid]);
        } elseif ($rtyp === 'athlet') {
            DB::query("DELETE FROM " . DB::tbl('athleten') . " WHERE id=? AND geloescht_am IS NOT NULL", [$rid]);
        } elseif ($rtyp === 'benutzer') {
            // Erst athlet_id trennen, dann endgültig löschen
            DB::query("UPDATE " . DB::tbl('benutzer') . " SET athlet_id=NULL WHERE id=? AND geloescht_am IS NOT NULL", [$rid]);
            DB::query("DELETE FROM " . DB::tbl('benutzer') . " WHERE id=? AND geloescht_am IS NOT NULL", [$rid]);
        } elseif ($rtyp === 'veranstaltung') {
            // Ergebnisse aus allen Tabellen löschen (FK constraint!)
            try { DB::query("DELETE FROM " . DB::tbl('ergebnisse') . " WHERE veranstaltung_id=? AND geloescht_am IS NOT NULL", [$rid]); } catch (\Exception $e) {}
            try { DB::query("DELETE FROM $eTbl WHERE veranstaltung_id=? AND geloescht_am IS NOT NULL", [$rid]); } catch (\Exception $e) {}
            DB::query("DELETE FROM " . DB::tbl('veranstaltungen') . " WHERE id=? AND geloescht_am IS NOT NULL", [$rid]);
        } else jsonErr('Unbekannter Typ.');
        jsonOk('Endgültig gelöscht.');
    }
}

// ============================================================
// HALL OF FAME
// ============================================================
if ($res === 'hall-of-fame' && $method === 'GET') {
    // Immer: aktuell gültige Bestleistungen (= bestes Ergebnis je Kategorie über alle Zeiten)
    $athletMap = [];

    if ($unified) {
        // Alle Disziplinen laden mit fmt + sort_dir aus disziplin_mapping/kategorien
        $katFilter = isset($_GET['kat']) && $_GET['kat'] !== '' ? $_GET['kat'] : null;
        $diszListSql = "SELECT DISTINCT e.disziplin, e.disziplin_mapping_id,
                    COALESCE(m.fmt_override, k.fmt, 'min') AS fmt,
                    COALESCE(k.sort_dir, 'ASC') AS sort_dir,
                    k.tbl_key AS kat_key,
                    COALESCE(m.hof_exclude, 0) AS hof_exclude
             FROM " . DB::tbl('ergebnisse') . " e
             LEFT JOIN " . DB::tbl('disziplin_mapping') . " m ON m.id=e.disziplin_mapping_id
             LEFT JOIN " . DB::tbl('disziplin_kategorien') . " k ON k.id = m.kategorie_id
             WHERE e.geloescht_am IS NULL AND e.resultat IS NOT NULL";
        $diszParams = [];
        if ($katFilter) {
            // Kommagetrennte Kategorie-Keys (z.B. "strasse,sprint")
            $katKeys = array_filter(array_map('trim', explode(',', $katFilter)));
            if ($katKeys) {
                $placeholders = implode(',', array_fill(0, count($katKeys), '?'));
                $diszListSql .= " AND k.tbl_key IN ($placeholders)";
                $diszParams  = array_merge($diszParams, $katKeys);
            }
        }
        $diszList = DB::fetchAll($diszListSql, $diszParams);
        sortDisziplinen($diszList);

        // Jugend-AK zusammenfassen: aus Settings-Konfiguration
        $mergeAK = ($_GET['merge_ak'] ?? '1') !== '0';
        $akExpr  = buildAkCaseExpr($mergeAK);

        foreach ($diszList as $dRow) {
            if (!empty($dRow['hof_exclude'])) continue; // aus Hall of Fame ausgeschlossen
            $disz      = $dRow['disziplin'];
            $mappingId = $dRow['disziplin_mapping_id'] ?? null;

            // val_sort: wie in Bestleistungen – COALESCE(resultat_num, TIME_TO_SEC oder CAST)
            $fmt = $dRow['fmt'] ?? 'min';
            if ($fmt === 'm') {
                $valExpr = "COALESCE(e.resultat_num, CAST(e.resultat AS DECIMAL(10,3)))";
            } else {
                $valExpr = "CASE
                    WHEN e.resultat REGEXP '^[0-9]{1,2}:[0-9]{2}:[0-9]{2}' THEN TIME_TO_SEC(e.resultat)
                    WHEN e.resultat REGEXP '^[0-9]+:[0-9]' THEN TIME_TO_SEC(CONCAT('00:', REPLACE(REPLACE(e.resultat, ',', '.'), ';', '.')))
                    ELSE CAST(REPLACE(e.resultat, ',', '.') AS DECIMAL(10,3)) END";
            }

            // Filter per mapping_id (eindeutig) oder disziplin-Name (Fallback)
            $hofWhere = $mappingId
                ? "e.disziplin_mapping_id = ?"
                : "e.disziplin = ?";
            $hofParam = $mappingId ?? $disz;

            // Alle Ergebnisse dieser Disziplin laden
            $ergs = DB::fetchAll(
                "SELECT e.resultat, ($valExpr) AS val_sort, " . $akExpr . " AS altersklasse,
                        a.id AS athlet_id, a.name_nv, a.vorname, a.nachname, a.geschlecht,
                        b.avatar_pfad, v.datum
                 FROM " . DB::tbl('ergebnisse') . " e
                 JOIN " . DB::tbl('athleten') . " a ON a.id = e.athlet_id
                 JOIN " . DB::tbl('veranstaltungen') . " v ON v.id = e.veranstaltung_id
                 LEFT JOIN " . DB::tbl('benutzer') . " b ON b.athlet_id = a.id
                 WHERE $hofWhere AND e.geloescht_am IS NULL
                   AND e.resultat IS NOT NULL
                 ORDER BY v.datum ASC",
                [$hofParam]
            );
            if (empty($ergs)) continue;

            // Sortierrichtung aus disziplin_mapping (zuverlässiger als Regex)
            $dir = strtoupper($dRow['sort_dir'] ?? 'ASC');
            // Fallback: Regex wenn sort_dir fehlt
            if ($dir !== 'ASC' && $dir !== 'DESC') {
                $firstRes = $ergs[0]['resultat'] ?? '';
                $dir = preg_match('/^\d{1,2}:\d{2}/', $firstRes) ? 'ASC' : 'DESC';
            }

            // Athleten-Map befüllen (einmalig pro Athlet)
            foreach ($ergs as $e) {
                $aid = (int)$e['athlet_id'];
                if (!isset($athletMap[$aid])) {
                    $vn = trim($e['vorname'] ?? '');
                    $nn = trim($e['nachname'] ?? '');
                    $athletMap[$aid] = [
                        'id'         => $aid,
                        'name'       => $vn ? ($vn . ' ' . $nn) : $e['name_nv'],
                        'avatar'     => $e['avatar_pfad'],
                        'geschlecht' => $e['geschlecht'] ?? '',
                        'titel'      => [],
                    ];
                }
            }

            // Bestleistungen ermitteln: bestes Ergebnis je Kategorie
            $bestGesamt = null; $bestGesamtAid = null; $bestGesamtDatum = null;
            $bestByG    = []; $bestGAid = []; $bestGDatum = [];
            $bestByAK   = []; $bestAKAid = []; $bestAKDatum = [];

            foreach ($ergs as $e) {
                $val   = (float)($e['val_sort'] ?? 0);
                if ($val <= 0) continue; // ungültiger Wert überspringen
                $aid   = (int)$e['athlet_id'];
                $g     = $e['geschlecht'] ?? '';
                $ak    = $e['altersklasse'] ?? '';
                $datum = $e['datum'] ?? '';

                // 1. Gesamtbestleistung
                if ($bestGesamt === null
                    || ($dir === 'ASC'  && $val < $bestGesamt)
                    || ($dir === 'DESC' && $val > $bestGesamt)) {
                    $bestGesamt = $val; $bestGesamtAid = $aid; $bestGesamtDatum = $datum;
                }

                // 2. Bestleistung je Geschlecht
                if ($g === 'M' || $g === 'W') {
                    if (!isset($bestByG[$g])
                        || ($dir === 'ASC'  && $val < $bestByG[$g])
                        || ($dir === 'DESC' && $val > $bestByG[$g])) {
                        $bestByG[$g] = $val; $bestGAid[$g] = $aid; $bestGDatum[$g] = $datum;
                    }
                }

                // 3. Bestleistung je Altersklasse
                if ($ak !== '') {
                    if (!isset($bestByAK[$ak])
                        || ($dir === 'ASC'  && $val < $bestByAK[$ak])
                        || ($dir === 'DESC' && $val > $bestByAK[$ak])) {
                        $bestByAK[$ak] = $val; $bestAKAid[$ak] = $aid; $bestAKDatum[$ak] = $datum;
                    }
                }
            }

            // Titel zuweisen (nur wenn Athlet in athletMap bekannt)
            $addTitel = function(int $aid, string $label, string $datum) use ($disz, &$athletMap): void {
                if (isset($athletMap[$aid])) {
                    $athletMap[$aid]['titel'][] = ['disziplin' => $disz, 'label' => $label, 'datum' => $datum];
                }
            };

            // 3-Tier-System identisch zu auszeichnungen-Endpoint:
            // Tier 1: Gesamtbestleistung (beste über ALLE Geschlechter+AKs) → skip Tier 2+3
            // Tier 2: Geschlechts-Bestleistung → "Gesamtbestleistung Männer/Frauen"
            // Tier 3: AK-Bestleistung (immer prüfen, unabhängig von Tier 2)
            $hasGesamtBest = []; // aids die Tier-1 haben
            if ($bestGesamtAid !== null && isset($athletMap[$bestGesamtAid])) {
                $addTitel($bestGesamtAid, 'Gesamtbestleistung', $bestGesamtDatum);
                $hasGesamtBest[$bestGesamtAid] = true;
            }
            // Tier 2: Geschlechts-Bestleistung (nur wenn NICHT bereits Tier-1)
            foreach ($bestGAid as $g => $aid) {
                if (!empty($hasGesamtBest[$aid])) continue;
                $addTitel($aid, $g === 'M' ? 'Gesamtbestleistung Männer' : 'Gesamtbestleistung Frauen', $bestGDatum[$g]);
            }
            // Tier 3: AK-Bestleistung (immer, unabhängig von Tier 1+2)
            // Ausnahme: wenn identischer Wert wie Gesamtbestleistung → bereits durch Tier 1 abgedeckt
            foreach ($bestAKAid as $ak => $aid) {
                if (!empty($hasGesamtBest[$aid]) && abs($bestByAK[$ak] - $bestGesamt) < 0.001) continue;
                $akNorm = preg_replace('/\s+[0-9]+[,.]?[0-9]*\s*kg$/i', '', $ak);
                $addTitel($aid, 'Bestleistung ' . $akNorm, $bestAKDatum[$ak]);
            }
        }

        // ── Meisterschafts-Titel: 1. Platz in einer Meisterschaft ──
        $mstrListRaw = '';
        try { $mstrListRaw = DB::fetchOne('SELECT wert FROM ' . DB::tbl('einstellungen') . ' WHERE schluessel = ?', ['meisterschaften_liste'])['wert'] ?? ''; } catch(\Exception $e) {}
        $mstrMap = [];
        foreach (json_decode($mstrListRaw ?: '[]', true) ?: [] as $m) {
            if (!empty($m['id']) && !empty($m['label'])) $mstrMap[(int)$m['id']] = $m['label'];
        }

        if (!empty($mstrMap)) {
            // Nur die tatsächlich vorhandene Tabelle verwenden (unified → ergebnisse)
            $_hofTbls = $unified ? [DB::tbl('ergebnisse')] : [DB::tbl('ergebnisse_strasse'), DB::tbl('ergebnisse_sprint'), DB::tbl('ergebnisse_mittelstrecke'), DB::tbl('ergebnisse_sprungwurf')];
            foreach ($_hofTbls as $_mTbl) {
                try {
                    $colCheck = DB::fetchOne("SHOW COLUMNS FROM $_mTbl LIKE 'ak_platz_meisterschaft'");
                    if (!$colCheck) continue;
                    $firstPlaces = DB::fetchAll(
                        'SELECT e.athlet_id, e.meisterschaft, e.altersklasse, e.disziplin,'
                        . ' COALESCE(e.disziplin_mapping_id, 0) AS mapping_id,'
                        . ' COALESCE(k.name, \'Sonstige\') AS kat_name, v.datum'
                        . ' FROM ' . $_mTbl . ' e'
                        . ' JOIN ' . DB::tbl('veranstaltungen') . ' v ON v.id = e.veranstaltung_id'
                        . ' LEFT JOIN ' . DB::tbl('disziplin_mapping') . ' m ON m.id = e.disziplin_mapping_id'
                        . ' LEFT JOIN ' . DB::tbl('disziplin_kategorien') . ' k ON k.id = m.kategorie_id'
                        . ' WHERE e.ak_platzierung = 1 AND e.meisterschaft IS NOT NULL AND e.geloescht_am IS NULL',
                        []
                    );
                    foreach ($firstPlaces as $fp) {
                        $aid   = (int)$fp['athlet_id'];
                        $mId   = (int)$fp['meisterschaft'];
                        $mName = $mstrMap[$mId] ?? null;
                        if (!$mName || !isset($athletMap[$aid])) continue;
                        $ak    = $fp['altersklasse'] ?? '';
                        $disz  = $fp['disziplin'] ?? '';
                        $katNm = $fp['kat_name'] ?? 'Sonstige';
                        // Label: Meisterschaft + Disziplin (ohne AK)
                        $titelLabel = '🥇 ' . $mName . ' ' . $disz;
                        $athletMap[$aid]['titel'][] = [
                            'disziplin'    => $disz,
                            'kat_name'     => $katNm,
                            'label'        => $titelLabel,
                            'ak'           => $ak,
                            'datum'        => $fp['datum'],
                            'is_meisterschaft' => true
                        ];
                    }
                } catch(\Exception $e) {}
            }
        }
    }

    // Nur Athleten mit mindestens einem Titel
    $hof = array_values(array_filter($athletMap, function ($a) {
        return !empty($a['titel']);
    }));

    // Titel je Athlet nach Disziplin gruppieren
    foreach ($hof as &$ath) {
        $byDisz = [];
        $mTitel = [];
        foreach ($ath['titel'] as $t) {
            if (!empty($t['is_meisterschaft'])) {
                $mTitel[] = ['label' => $t['label'], 'datum' => $t['datum'], 'disziplin' => $t['disziplin'] ?? '', 'kat_name' => $t['kat_name'] ?? '', 'ak' => $t['ak'] ?? '', 'jahr' => (int)substr($t['datum'] ?? '', 0, 4)];
            } else {
                $byDisz[$t['disziplin']][] = ['label' => $t['label'], 'datum' => $t['datum']];
            }
        }
        $ath['disziplinen']         = $byDisz;
        $ath['meisterschaftsTitel'] = $mTitel;
        $ath['titelCount']          = array_sum(array_map('count', $byDisz)) + count($mTitel);
        unset($ath['titel']);
    }
    unset($ath);

    // Score: Meisterschafts-Titel zählen 3x, Bestleistungen 1x
    foreach ($hof as &$ath) {
        $score = 0;
        foreach ($ath['disziplinen'] as $disz => $titels) {
            foreach ($titels as $t) {
                $score += !empty($t['is_meisterschaft']) ? 3 : 1;
            }
        }
        if (!empty($ath['meisterschaftsTitel'])) {
            foreach ($ath['meisterschaftsTitel'] as $t) { $score += 3; }
        }
        $ath['score'] = $score;
    }
    unset($ath);

    // Absteigende Sortierung nach Score (Meisterschaften gewichtet 3x)
    usort($hof, function ($a, $b) {
        return $b['score'] - $a['score'] ?: $b['titelCount'] - $a['titelCount'];
    });

    jsonOk($hof);
}

// ── uitslagen.nl Proxy ────────────────────────────────────────────
// la-fetch: file_get_contents-Handler entfernt (curl-Handler weiter unten)

if ($res === 'uits-fetch' && $method === 'GET') {
    Auth::requireLogin();
    $url = trim($_GET['url'] ?? '');
    if (!$url || !preg_match('/^https?:\/\/(evenementen\.)?uitslagen\.nl\//i', $url))
        jsonErr('Ungültige uitslagen.nl-URL.', 400);

    $ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0 Safari/537.36';
    $cookieFile = tempnam(sys_get_temp_dir(), 'uits_cookie_');

    // Basis-URL der evenementen-Seite ableiten (z.B. https://evenementen.uitslagen.nl/2026/enschedemarathon/)
    // und zuerst laden, damit der Server eine Session-Cookie setzt.
    // Ohne diese Session gibt evenementen.uitslagen.nl für Unterseiten (menu.php, uitslag.php)
    // nur eine abgespeckte Antwort zurück, die keine <option>-Elemente enthält.
    if (preg_match('#^(https?://evenementen\.uitslagen\.nl/\d{4}/[^/]+/)#i', $url, $bm)) {
        $basePreFetch = $bm[1];
        if ($basePreFetch !== $url) {
            $chPre = curl_init($basePreFetch);
            curl_setopt_array($chPre, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_FOLLOWLOCATION => true,
                CURLOPT_USERAGENT      => $ua,
                CURLOPT_TIMEOUT        => 10,
                CURLOPT_COOKIEJAR      => $cookieFile,
                CURLOPT_COOKIEFILE     => $cookieFile,
                CURLOPT_HTTPHEADER     => [
                    'Accept: text/html,application/xhtml+xml',
                    'Accept-Language: nl-NL,nl;q=0.9',
                ],
            ]);
            curl_exec($chPre);
            curl_close($chPre);
        }
    }

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_USERAGENT      => $ua,
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_COOKIEJAR      => $cookieFile,
        CURLOPT_COOKIEFILE     => $cookieFile,
        CURLOPT_HTTP_VERSION   => CURL_HTTP_VERSION_2_0, // HTTP/2 ändert ALPN im TLS-Handshake → anderer JA3
        CURLOPT_HTTPHEADER     => [
            'Accept: text/html,application/xhtml+xml',
            'Accept-Language: nl-NL,nl;q=0.9,de;q=0.8',
            'Referer: ' . (isset($bm[1]) ? $bm[1] : $url),
        ],
    ]);
    $html     = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    @unlink($cookieFile);

    // Fallback: Wenn curl SPA-Shell bekommt (>50KB ohne <option>-Elemente),
    // PHP-Streams versuchen — hat anderen TLS-JA3-Fingerprint als libcurl
    if ($html && strlen($html) > 50000 && strpos($html, '<option') === false) {
        $ctx = stream_context_create([
            'ssl' => [
                'verify_peer'       => true,
                'verify_peer_name'  => true,
                'allow_self_signed' => false,
                'disable_compression' => true,
                'SNI_enabled'       => true,
                'ciphers'           => 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384',
            ],
            'http' => [
                'user_agent'      => $ua,
                'follow_location' => true,
                'max_redirects'   => 5,
                'timeout'         => 15,
                'header'          => [
                    'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language: nl-NL,nl;q=0.9,de;q=0.8',
                    'Referer: ' . (isset($bm[1]) ? $bm[1] : $url),
                    'Connection: keep-alive',
                ],
            ],
        ]);
        $htmlStream = @file_get_contents($url, false, $ctx);
        if ($htmlStream && strlen($htmlStream) < 50000 && (strpos($htmlStream, '<option') !== false || strpos($htmlStream, '<tr') !== false)) {
            $html = $htmlStream; // Stream-Fallback hat echte Daten geliefert
        }
    }

    if (!$html || $httpCode >= 400)
        jsonErr('uitslagen.nl nicht erreichbar (HTTP ' . $httpCode . ').', 502);

    // Charset aus HTML-Meta erkennen (windows-1252 bei älteren evenementen-Seiten)
    $srcCharset = mb_detect_encoding($html, ['UTF-8', 'Windows-1252', 'ISO-8859-1'], true) ?: 'UTF-8';
    if ($srcCharset !== 'UTF-8') {
        $html = mb_convert_encoding($html, 'UTF-8', $srcCharset);
    } else {
        $html = mb_convert_encoding($html, 'UTF-8', 'UTF-8');
    }
    jsonOk(['html' => $html]);
}

// ── uits-token: Einmal-Token für manuellen Browser-Import generieren ─────────
if ($res === 'uits-token' && $method === 'GET') {
    Auth::requireLogin();
    $token = bin2hex(random_bytes(16));
    // Token in Session speichern (max 5 Minuten gültig)
    $_SESSION['uits_token']    = $token;
    $_SESSION['uits_token_ts'] = time();
    $_SESSION['uits_data']     = null;
    jsonOk(['token' => $token]);
}

// ── uits-receive: Daten vom Browser-Extraktor empfangen (CORS erlaubt) ───────
// OPTIONS-Präflight wird bereits früh (Zeile ~37) abgefangen.
if ($res === 'uits-receive' && $method === 'POST') {
    // CORS: Browser (evenementen.uitslagen.nl) darf zu uns posten
    header('Access-Control-Allow-Origin: *');
    $token = $_GET['token'] ?? ($_SERVER['HTTP_X_UITS_TOKEN'] ?? '');
    if (!$token) { http_response_code(400); echo json_encode(['ok'=>false,'error'=>'Token fehlt']); exit; }

    // Token in irgendeiner Session finden (da Browser-Context anderen Origin hat, nutzen wir File-Cache)
    $cacheFile = sys_get_temp_dir() . '/uits_' . preg_replace('/[^a-f0-9]/', '', $token) . '.json';
    $body = file_get_contents('php://input');
    if (!$body) { http_response_code(400); echo json_encode(['ok'=>false,'error'=>'Kein Body']); exit; }
    $data = json_decode($body, true);
    if (!$data) { http_response_code(400); echo json_encode(['ok'=>false,'error'=>'JSON-Parse-Fehler']); exit; }
    // Daten speichern (mit Ablaufzeit)
    $data['_received_at'] = time();
    file_put_contents($cacheFile, json_encode($data));
    header('Access-Control-Allow-Origin: *');
    echo json_encode(['ok'=>true,'rows'=>count($data['rows']??[])]);
    exit;
}
if ($res === 'uits-receive' && $method === 'GET') {
    Auth::requireLogin();
    $token = trim($_GET['token'] ?? '');
    if (!$token || !preg_match('/^[a-f0-9]{32}$/', $token)) jsonErr('Ungültiger Token', 400);
    $cacheFile = sys_get_temp_dir() . '/uits_' . $token . '.json';
    if (!file_exists($cacheFile)) { jsonOk(['ready' => false]); }
    $data = json_decode(file_get_contents($cacheFile), true);
    @unlink($cacheFile); // einmalig abrufen + löschen
    if (!$data || (time() - ($data['_received_at']??0)) > 600) jsonErr('Token abgelaufen', 410);
    jsonOk(['ready' => true, 'data' => $data]);
}

if ($res === 'la-fetch' && $method === 'GET') {
    Auth::requireLogin();
    $url = trim($_GET['url'] ?? '');
    if (!$url || !preg_match('/^https?:\/\/ergebnisse\.leichtathletik\.de\//i', $url))
        jsonErr('Ungültige leichtathletik.de-URL.', 400);

    $ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0 Safari/537.36';
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_USERAGENT      => $ua,
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_HTTPHEADER     => [
            'Accept: text/html,application/xhtml+xml',
            'Accept-Language: de-DE,de;q=0.9',
        ],
    ]);
    $html = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if (!$html || $httpCode >= 400)
        jsonErr('leichtathletik.de nicht erreichbar (HTTP ' . $httpCode . ').', 502);

    jsonOk(['html' => $html]);
}

// ============================================================
// ALTERSKLASSEN-VERWALTUNG (Admin)
// ============================================================
if ($res === 'ak-standard') {
    Auth::requireAdmin();

    if ($method === 'GET') {
        $std = DB::fetchAll("SELECT ak, geschlecht, reihenfolge FROM " . DB::tbl('ak_standard') . " ORDER BY reihenfolge, ak");
        jsonOk($std);
    }

    if ($method === 'POST') {
        $ak  = trim($body['ak'] ?? '');
        $g   = in_array($body['geschlecht'] ?? '', ['M','W','D','']) ? ($body['geschlecht'] ?? '') : '';
        $rei = (int)($body['reihenfolge'] ?? 99);
        if (!$ak) jsonErr('AK erforderlich.', 400);
        DB::query("INSERT INTO " . DB::tbl('ak_standard') . " (ak,geschlecht,reihenfolge) VALUES (?,?,?)
                   ON DUPLICATE KEY UPDATE geschlecht=VALUES(geschlecht), reihenfolge=VALUES(reihenfolge)",
            [$ak, $g, $rei]);
        jsonOk(null);
    }

    if ($method === 'DELETE' && $id) {
        DB::query("DELETE FROM " . DB::tbl('ak_standard') . " WHERE ak=?", [urldecode($id)]);
        // Zugehörige Mappings entfernen
        DB::query("DELETE FROM " . DB::tbl('ak_mapping') . " WHERE ak_standard=?", [urldecode($id)]);
        jsonOk(null);
    }
}

if ($res === 'ak-mapping') {
    Auth::requireAdmin();

    if ($method === 'GET') {
        // Alle verwendeten AKs + ihre Mappings + ob sie Standard sind
        $used = DB::fetchAll(
            "SELECT e.altersklasse AS ak, COUNT(*) AS anzahl
             FROM " . DB::tbl('ergebnisse') . " e
             WHERE e.altersklasse IS NOT NULL AND e.altersklasse != '' AND e.geloescht_am IS NULL
             GROUP BY e.altersklasse ORDER BY e.altersklasse"
        );
        $std = array_column(DB::fetchAll("SELECT ak FROM " . DB::tbl('ak_standard')), 'ak');
        $mappings = [];
        foreach (DB::fetchAll("SELECT ak_roh, ak_standard FROM " . DB::tbl('ak_mapping')) as $m) {
            $mappings[$m['ak_roh']] = $m['ak_standard'];
        }
        foreach ($used as &$row) {
            $row['is_standard'] = in_array($row['ak'], $std);
            $row['mapped_to']   = $mappings[$row['ak']] ?? null;
        }
        jsonOk(['used' => $used, 'standard' => $std]);
    }

    if ($method === 'POST') {
        // Bulk-Save: [{ak_roh, ak_standard}]
        $items = $body['mappings'] ?? [];
        foreach ($items as $item) {
            $roh = trim($item['ak_roh'] ?? '');
            $std = trim($item['ak_standard'] ?? '');
            if (!$roh) continue;
            if ($std) {
                DB::query("INSERT INTO " . DB::tbl('ak_mapping') . " (ak_roh, ak_standard) VALUES (?,?)
                           ON DUPLICATE KEY UPDATE ak_standard=VALUES(ak_standard)", [$roh, $std]);
            } else {
                DB::query("DELETE FROM " . DB::tbl('ak_mapping') . " WHERE ak_roh=?", [$roh]);
            }
        }
        jsonOk(null);
    }
}

// ============================================================
// ERGEBNIS-AENDERUNGSANTRAEGE
// ============================================================
if ($res === 'ergebnis-aenderungen') {
    if ($method === 'GET') {
        $user = Auth::requireAthlet();
        if (Auth::canEditAll()) {
            $rows = DB::fetchAll(
                'SELECT ea.*,
                        b.benutzername AS beantragt_von_name,
                        CONCAT(a.vorname, \' \', a.nachname) AS beantragt_von_athlet,
                        b2.benutzername AS bearbeitet_von_name,
                        CONCAT(a2.vorname, \' \', a2.nachname) AS bearbeitet_von_athlet
                 FROM ' . DB::tbl('ergebnis_aenderungen') . ' ea
                 LEFT JOIN ' . DB::tbl('benutzer') . ' b  ON b.id  = ea.beantragt_von
                 LEFT JOIN ' . DB::tbl('athleten') . ' a  ON a.id  = b.athlet_id
                 LEFT JOIN ' . DB::tbl('benutzer') . ' b2 ON b2.id = ea.bearbeitet_von
                 LEFT JOIN ' . DB::tbl('athleten') . ' a2 ON a2.id = b2.athlet_id
                 WHERE ea.status = ? ORDER BY ea.beantragt_am DESC',
                [$_GET['status'] ?? 'pending']
            );
        } else {
            $rows = DB::fetchAll('SELECT * FROM ' . DB::tbl('ergebnis_aenderungen') . ' WHERE beantragt_von = ? ORDER BY beantragt_am DESC', [$user['id']]);
        }
        // Veranstaltungsdetails anreichern
        foreach ($rows as &$row) {
            $nv = json_decode($row['neue_werte'] ?? '{}', true) ?: [];
            $vid = intOrNull($nv['veranstaltung_id'] ?? null);
            // Für delete/update: Veranstaltung aus ergebnis laden
            if (!$vid && $row['ergebnis_id']) {
                try {
                    $ergRow = DB::fetchOne('SELECT veranstaltung_id FROM ' . DB::tbl('ergebnisse') . ' WHERE id=?', [$row['ergebnis_id']]);
                    $vid = intOrNull($ergRow['veranstaltung_id'] ?? null);
                } catch (\Exception $e) {}
            }
            if ($vid) {
                try {
                    $vRow = DB::fetchOne('SELECT name, ort, datum FROM ' . DB::tbl('veranstaltungen') . ' WHERE id=?', [$vid]);
                    if ($vRow) { $row['veranstaltung_name'] = $vRow['name']; $row['veranstaltung_ort'] = $vRow['ort']; $row['veranstaltung_datum'] = $vRow['datum']; }
                } catch (\Exception $e) {}
            }
        }
        unset($row);
        jsonOk($rows);
    }
    if ($method === 'POST' && $id) {
        $user = Auth::requireEditor();
        $action = $body['action'] ?? '';
        if (!in_array($action, ['approve','reject'])) jsonErr('Ungueltige Aktion.', 400);
        $antrag = DB::fetchOne('SELECT * FROM ' . DB::tbl('ergebnis_aenderungen') . ' WHERE id = ?', [$id]);
        if (!$antrag || $antrag['status'] !== 'pending') jsonErr('Antrag nicht gefunden oder bereits bearbeitet.', 404);
        if ($action === 'approve') {
            $tbl2 = DB::tbl($antrag['ergebnis_tbl']);
            if ($antrag['typ'] === 'insert') {
                // Neues Ergebnis anlegen
                $vals = json_decode($antrag['neue_werte'] ?? '{}', true) ?: [];
                $vid2  = intOrNull($vals['veranstaltung_id'] ?? null);
                $aid2  = intOrNull($vals['athlet_id'] ?? null);
                $disz2 = $vals['disziplin'] ?? '';
                $dmId2 = intOrNull($vals['disziplin_mapping_id'] ?? null);
                $res2  = $vals['resultat'] ?? '';
                $ak2   = $vals['altersklasse'] ?? '';
                $von2  = intOrNull($vals['erstellt_von'] ?? null);
                if ($vid2 && $aid2 && $disz2 && $res2) {
                    DB::query(
                        'INSERT INTO ' . DB::tbl('ergebnisse') .
                        ' (veranstaltung_id,athlet_id,disziplin,disziplin_mapping_id,resultat,altersklasse,erstellt_von)'
                        . ' VALUES (?,?,?,?,?,?,?)',
                        [$vid2,$aid2,$disz2,$dmId2,$res2,$ak2,$von2]
                    );
                    $newErgId = DB::lastInsertId();
                    // ergebnis_id im Antrag speichern (für spätere Referenz)
                    DB::query('UPDATE ' . DB::tbl('ergebnis_aenderungen') . ' SET ergebnis_id=? WHERE id=?', [$newErgId, $id]);
                    // Veranstaltung genehmigen falls sie als pending angelegt wurde
                    DB::query('UPDATE ' . DB::tbl('veranstaltungen') . ' SET genehmigt=1 WHERE id=?', [$vid2]);
                }
            } elseif ($antrag['typ'] === 'delete') {
                DB::query("UPDATE $tbl2 SET geloescht_am=NOW() WHERE id=?", [$antrag['ergebnis_id']]);
            } elseif ($antrag['typ'] === 'update') {
                $vals = json_decode($antrag['neue_werte'] ?? '{}', true) ?: [];
                $f2 = []; $p2 = [];
                // Athletenprofil-Änderung
                if ($tbl2 === DB::tbl('athleten')) {
                    foreach (['vorname','nachname','geschlecht','geburtsjahr'] as $k2) {
                        if (array_key_exists($k2, $vals)) { $f2[] = "$k2=?"; $p2[] = $vals[$k2]; }
                    }
                    // name_nv neu berechnen wenn vor-/nachname geändert
                    if (isset($vals['vorname']) || isset($vals['nachname'])) {
                        $cur = DB::fetchOne('SELECT vorname, nachname FROM ' . DB::tbl('athleten') . ' WHERE id=?', [$antrag['ergebnis_id']]);
                        $vn = $vals['vorname'] ?? ($cur['vorname'] ?? '');
                        $nn = $vals['nachname'] ?? ($cur['nachname'] ?? '');
                        $f2[] = 'name_nv=?'; $p2[] = $nn . ', ' . $vn;
                    }
                } else {
                    foreach (['altersklasse','disziplin','resultat','ak_platzierung','meisterschaft'] as $k2) {
                        if (array_key_exists($k2, $vals)) { $f2[] = "$k2=?"; $p2[] = $vals[$k2]; }
                    }
                }
                if ($f2) { $p2[] = $antrag['ergebnis_id']; DB::query("UPDATE $tbl2 SET ".implode(',',$f2)." WHERE id=?", $p2); }
            }
        }
        DB::query('UPDATE ' . DB::tbl('ergebnis_aenderungen') . ' SET status=?,bearbeitet_von=?,bearbeitet_am=NOW(),kommentar=? WHERE id=?',
            [$action === 'approve' ? 'approved' : 'rejected', $user['id'], $body['kommentar'] ?? null, $id]);
        jsonOk($action === 'approve' ? 'Genehmigt.' : 'Abgelehnt.');
    }
}

// ============================================================
// ROLLEN-VERWALTUNG
// ============================================================
if ($res === 'rollen') {
    Auth::requireAdmin();
    if ($method === 'GET') {
        $rows = DB::fetchAll('SELECT * FROM ' . DB::tbl('rollen') . ' ORDER BY id');
        $defaultLabels = ['admin'=>'Administrator','editor'=>'Editor','athlet'=>'Athlet*in','leser'=>'Leser*in'];
        foreach ($rows as &$r) {
            $r['rechte']     = json_decode($r['rechte'] ?? '[]', true) ?: [];
            $r['label']      = $r['label'] ?: ($defaultLabels[$r['name']] ?? $r['name']);
            $r['oeffentlich'] = (int)($r['oeffentlich'] ?? 1);
        }
        jsonOk($rows);
    }
    if ($method === 'POST') {
        $name   = trim($body['name'] ?? '');
        $rechte = $body['rechte'] ?? [];
        $validRechte = ['vollzugriff','benutzer_verwalten','rekorde_bearbeiten','einstellungen_aendern','alle_ergebnisse','eigene_ergebnisse','lesen','externe_ergebnisse_sehen'];
        $rechte = array_values(array_intersect((array)$rechte, $validRechte));
        if (!$name || strlen($name) < 2) jsonErr('Name erforderlich (min. 2 Zeichen).');
        if ($id) {
            $existing = DB::fetchOne('SELECT name FROM ' . DB::tbl('rollen') . ' WHERE id=?', [(int)$id]);
            $existingName = $existing['name'] ?? '';
            $label      = trim($body['label'] ?? '');
            $oeffentlich = isset($body['oeffentlich']) ? (int)(bool)$body['oeffentlich'] : 1;
            // Systemrollen (admin/athlet/leser): nur Name + Label + oeffentlich änderbar, Rechte unveränderbar
            if (in_array($existingName, ['admin','athlet','leser'])) {
                DB::query('UPDATE ' . DB::tbl('rollen') . ' SET name=?, label=?, oeffentlich=? WHERE id=?', [$name, $label ?: null, $oeffentlich, (int)$id]);
                jsonOk('Aktualisiert.');
            }
            DB::query('UPDATE ' . DB::tbl('rollen') . ' SET name=?, rechte=?, label=?, oeffentlich=? WHERE id=?', [$name, json_encode($rechte), $label ?: null, $oeffentlich, (int)$id]);
            jsonOk('Aktualisiert.');
        } else {
            try {
                $label      = trim($body['label'] ?? '');
                $oeffentlich = isset($body['oeffentlich']) ? (int)(bool)$body['oeffentlich'] : 1;
                DB::query('INSERT INTO ' . DB::tbl('rollen') . ' (name, rechte, label, oeffentlich) VALUES (?,?,?,?)', [$name, json_encode($rechte), $label ?: null, $oeffentlich]);
                jsonOk(['id' => DB::lastInsertId()]);
            } catch (\Exception $e) { jsonErr('Rollenname bereits vergeben.'); }
        }
    }
    if ($method === 'DELETE' && $id) {
        $row = DB::fetchOne('SELECT name FROM ' . DB::tbl('rollen') . ' WHERE id=?', [$id]);
        if ($row && in_array($row['name'], ['admin','athlet','leser'])) jsonErr('Diese Rolle kann nicht gelöscht werden.');
        DB::query('DELETE FROM ' . DB::tbl('rollen') . ' WHERE id=?', [(int)$id]);
        jsonOk('Gelöscht.');
    }
}

jsonErr('Unbekannte Route.', 404);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'fehler' => $e->getMessage(), 'trace' => $e->getFile().':'.$e->getLine()]);
    exit;
}
