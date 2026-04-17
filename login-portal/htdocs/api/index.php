<?php
// ============================================================
// Login-Portal – REST API
// Zentrales Authentifizierungs-Portal für alle Vereins-Apps
// ============================================================

error_reporting(0);
ini_set('display_errors', '0');

// Shared includes laden (gleiche PHP-Klassen wie Statistikportal)
require_once __DIR__ . '/../../includes/auth.php';
Auth::startSession();

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/settings.php';

// Passkey-Tabelle anlegen wenn nötig
try { Passkey::migrate(); } catch (Exception $e) {}

$method = $_SERVER['REQUEST_METHOD'];
$path   = trim(urldecode($_GET['_route'] ?? ''), '/');
if (!$path && !empty($_SERVER['PATH_INFO'])) {
    $path = trim($_SERVER['PATH_INFO'], '/');
}
$parts  = explode('/', $path);
$res    = $parts[0] ?? '';
$id     = $parts[1] ?? null;

$body = [];
if (in_array($method, ['POST','PUT','PATCH'])) {
    $raw  = file_get_contents('php://input');
    $body = json_decode($raw, true) ?? [];
}

function jsonOk(mixed $data): void {
    echo json_encode(['ok' => true, 'data' => $data], JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}
function jsonErr(string $msg, int $code = 400): void {
    http_response_code($code);
    echo json_encode(['ok' => false, 'fehler' => $msg]);
    exit;
}
function hashCode(string $code): string { return password_hash($code, PASSWORD_BCRYPT, ['cost' => 10]); }
function hashPw(string $pw): string    { return password_hash($pw,   PASSWORD_BCRYPT, ['cost' => 12]); }

// ============================================================
// CORS: Erlaubte App-Origins aus Einstellungen
// ============================================================
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin) {
    // Alle registrierten App-URLs als erlaubte Origins
    $appsJson = Settings::get('login_portal_apps', '[]');
    $apps = json_decode($appsJson, true) ?: [];
    $allowedOrigins = array_map(function($a) {
        return rtrim($a['url'] ?? '', '/');
    }, $apps);
    // Auch die eigene Login-Portal-URL erlauben
    $loginUrl = Settings::get('login_portal_url', '');
    if ($loginUrl) $allowedOrigins[] = rtrim($loginUrl, '/');

    if (in_array($origin, $allowedOrigins)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Access-Control-Allow-Credentials: true');
        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type');
    }
}
if ($method === 'OPTIONS') { http_response_code(204); exit; }

// ============================================================
// ROUTEN
// ============================================================

// --- Einstellungen (öffentlich, für Branding) ---
if ($res === 'einstellungen' && $method === 'GET') {
    $cfg = Settings::all();
    // Nur relevante Felder für Login-Portal senden
    jsonOk([
        'verein_name'     => $cfg['verein_name'] ?? '',
        'verein_kuerzel'  => $cfg['verein_kuerzel'] ?? '',
        'app_untertitel'  => $cfg['app_untertitel'] ?? '',
        'logo_datei'      => $cfg['logo_datei'] ?? '',
        'farbe_primary'   => $cfg['farbe_primary'] ?? '#cc0000',
        'farbe_accent'    => $cfg['farbe_accent'] ?? '#003087',
        'email_domain'    => $cfg['email_domain'] ?? '',
        'noreply_email'   => $cfg['noreply_email'] ?? '',
        'login_portal_apps' => $cfg['login_portal_apps'] ?? '[]',
        'registrierung_auto_freigabe' => $cfg['registrierung_auto_freigabe'] ?? '0',
    ]);
}

// --- Registrierte Apps auflisten ---
if ($res === 'apps' && $method === 'GET') {
    $appsJson = Settings::get('login_portal_apps', '[]');
    $apps = json_decode($appsJson, true) ?: [];
    jsonOk($apps);
}

// ============================================================
// AUTH-Routen
// ============================================================
if ($res === 'auth') {

    // --- Session prüfen ---
    if ($method === 'GET' && $id === 'me') {
        $user = Auth::check();
        if (!$user) jsonErr('Nicht eingeloggt.', 401);
        $row = DB::fetchOne('SELECT totp_aktiv, avatar_pfad, email, athlet_id FROM ' . DB::tbl('benutzer') . ' WHERE id = ?', [$user['id']]);
        $user['totp_aktiv'] = !empty($row['totp_aktiv']);
        $user['avatar']     = $row['avatar_pfad'] ?? null;
        $user['email']      = $row['email'] ?? '';
        $vorname = '';
        if (!empty($row['athlet_id'])) {
            $ath = DB::fetchOne('SELECT vorname FROM ' . DB::tbl('athleten') . ' WHERE id = ?', [$row['athlet_id']]);
            if ($ath) $vorname = $ath['vorname'] ?? '';
        }
        $user['vorname'] = $vorname;
        try { Passkey::migrate(); } catch (\Exception $e) {}
        $user['has_passkey'] = Passkey::userHasPasskey($user['id']);
        jsonOk($user);
    }

    // --- Identify (Benutzername/E-Mail → Passkey-Check) ---
    if ($method === 'POST' && $id === 'identify') {
        $ident = trim($body['ident'] ?? '');
        if (!$ident) jsonErr('Benutzername oder E-Mail erforderlich.');
        $user = DB::fetchOne(
            'SELECT id, email FROM ' . DB::tbl('benutzer') . ' WHERE (benutzername = ? OR email = ?) AND aktiv = 1',
            [$ident, $ident]
        );
        if (!$user) jsonErr('Kein Konto mit dieser Kennung gefunden.', 404);
        try { Passkey::migrate(); } catch (\Exception $e) {}
        $hasPasskey = Passkey::userHasPasskey($user['id']);
        $_SESSION['identify_user_id'] = $user['id'];
        session_write_close();
        jsonOk(['found' => true, 'has_passkey' => $hasPasskey]);
    }

    // --- Login Schritt 1: Passwort ---
    if ($method === 'POST' && $id === 'login') {
        $result = Auth::loginStep1($body['benutzername'] ?? '', $body['passwort'] ?? '');
        if (!$result['ok']) jsonErr($result['fehler'], 401);
        if (!empty($result['totp_required'])) {
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
        jsonOk(['rolle' => $result['rolle'], 'name' => $result['name'], 'vorname' => $result['vorname'] ?? '']);
    }

    // --- TOTP Setup ---
    if ($method === 'GET' && $id === 'totp-setup') {
        $loggedIn = Auth::check();
        if ($loggedIn && empty($_SESSION['totp_pending_user'])) {
            $_SESSION['totp_pending_user'] = $loggedIn['id'];
        }
        $result = Auth::totpSetupInit();
        if (!$result['ok']) jsonErr($result['fehler'], 403);
        jsonOk($result);
    }
    if ($method === 'POST' && $id === 'totp-setup') {
        $result = Auth::totpSetupConfirm($body['code'] ?? '');
        if (!$result['ok']) jsonErr($result['fehler'], 400);
        jsonOk($result);
    }

    // --- Passkey: Auth Challenge ---
    if ($method === 'POST' && $id === 'passkey-auth-challenge') {
        $uid = (int)($_SESSION['totp_pending_user'] ?? $_SESSION['identify_user_id'] ?? 0);
        if (!$uid) jsonErr('Keine ausstehende Anmeldung.', 401);
        Passkey::migrate();
        $options = Passkey::authChallenge($uid);
        jsonOk($options);
    }

    // --- Passkey: Discoverable Challenge ---
    if ($method === 'POST' && $id === 'passkey-auth-challenge-discover') {
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

    // --- Passkey: Auth Verify ---
    if ($method === 'POST' && $id === 'passkey-auth-verify') {
        $isDiscover = !empty($body['discover_token']);
        if ($isDiscover) {
            $token  = $body['discover_token'];
            $ts     = (int)($body['discover_ts'] ?? 0);
            $chal   = $body['discover_challenge'] ?? '';
            $secret = defined('SESSION_NAME') ? SESSION_NAME : 'stat';
            $expect = hash_hmac('sha256', $chal . '|' . $ts, $secret);
            if (!hash_equals($expect, $token))    jsonErr('Ungültiges Challenge-Token.', 401);
            if (time() - $ts > 120)               jsonErr('Challenge abgelaufen.', 401);
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
        jsonOk(['rolle' => $loginResult['rolle'], 'name' => $loginResult['name'], 'vorname' => $loginResult['vorname'] ?? '']);
    }

    // --- E-Mail-Code senden ---
    if ($method === 'POST' && $id === 'email-code-send') {
        if (empty($_SESSION['totp_pending_user'])) jsonErr('Keine ausstehende Anmeldung.', 401);
        $uid  = (int)$_SESSION['totp_pending_user'];
        $user = DB::fetchOne('SELECT benutzername, email FROM ' . DB::tbl('benutzer') . ' WHERE id = ? AND aktiv = 1', [$uid]);
        if (!$user || !$user['email']) jsonErr('Keine E-Mail-Adresse hinterlegt.', 400);
        $code     = str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $codeHash = hashCode($code);
        $_SESSION['email_login_code_hash'] = $codeHash;
        $_SESSION['email_login_code_exp']  = time() + 300;
        $subject = Settings::get('verein_name','Verein') . ' – Login-Code: ' . $code;
        $msg     = "Hallo " . $user['benutzername'] . ",\n\ndein Login-Code lautet:\n\n    " . $code . "\n\nDieser Code ist 5 Minuten gültig.\n\n" . Settings::get('verein_name','Verein');
        @mail($user['email'], $subject, $msg, "From: " . Settings::get('noreply_email','') . "\r\nContent-Type: text/plain; charset=utf-8");
        jsonOk('Code gesendet.');
    }

    // --- E-Mail-Code verifizieren ---
    if ($method === 'POST' && $id === 'email-code-verify') {
        if (empty($_SESSION['totp_pending_user'])) jsonErr('Keine ausstehende Anmeldung.', 401);
        if (empty($_SESSION['email_login_code_hash']) || ($_SESSION['email_login_code_exp'] ?? 0) < time())
            jsonErr('Code abgelaufen.', 400);
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

    // --- Logout ---
    if ($method === 'POST' && $id === 'logout') {
        Auth::logout();
        jsonOk('Abgemeldet.');
    }

    // ============================================================
    // REGISTRIERUNG
    // ============================================================
    if ($method === 'POST' && $id === 'register-start') {
        $email = trim($body['email'] ?? '');
        $name  = trim($body['name']  ?? '');
        $pw    = $body['passwort'] ?? '';
        if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) jsonErr('Gültige E-Mail erforderlich.');
        if (!$name)  jsonErr('Name erforderlich.');
        if (strlen($pw) < 8) jsonErr('Passwort muss mind. 8 Zeichen haben.');
        // E-Mail-Domain prüfen
        $domain = Settings::get('email_domain', '');
        if ($domain && !str_ends_with(strtolower($email), '@' . strtolower($domain))) {
            jsonErr('Nur E-Mail-Adressen mit @' . $domain . ' sind erlaubt.');
        }
        // Bereits registriert?
        $exists = DB::fetchOne('SELECT id FROM ' . DB::tbl('benutzer') . ' WHERE email = ? AND aktiv = 1', [$email]);
        if ($exists) jsonErr('Diese E-Mail-Adresse ist bereits registriert.');
        // Alte Registrierungen löschen
        DB::query('DELETE FROM ' . DB::tbl('registrierungen') . ' WHERE email = ? AND status != ?', [$email, 'approved']);
        // Bestätigungscode
        $code     = str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $codeHash = hashCode($code);
        DB::query(
            'INSERT INTO ' . DB::tbl('registrierungen') . ' (email, name, passwort_hash, email_code_hash, code_expires_at) VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 30 MINUTE))',
            [$email, $name, hashPw($pw), $codeHash]
        );
        $subject = Settings::get('verein_name','Verein') . ' – Bestätigungscode: ' . $code;
        $msg     = "Hallo " . $name . ",\n\ndein Bestätigungscode:\n\n    " . $code . "\n\nGültig für 30 Minuten.\n\n" . Settings::get('verein_name','Verein');
        @mail($email, $subject, $msg, "From: " . Settings::get('noreply_email','') . "\r\nContent-Type: text/plain; charset=utf-8");
        jsonOk('Code gesendet.');
    }

    if ($method === 'POST' && $id === 'register-verify-email') {
        $email = trim($body['email'] ?? '');
        $code  = trim($body['code']  ?? '');
        $reg = DB::fetchOne(
            'SELECT * FROM ' . DB::tbl('registrierungen') . ' WHERE email = ? AND status = ? AND code_expires_at > NOW()',
            [$email, 'pending']
        );
        if (!$reg) jsonErr('Registrierung nicht gefunden oder Code abgelaufen.');
        if (!password_verify($code, $reg['email_code_hash'])) jsonErr('Ungültiger Code.');
        DB::query('UPDATE ' . DB::tbl('registrierungen') . ' SET email_verifiziert = 1 WHERE email = ?', [$email]);
        jsonOk('E-Mail bestätigt.');
    }

    if ($method === 'POST' && $id === 'register-totp-init') {
        $email = trim($body['email'] ?? '');
        $reg = DB::fetchOne('SELECT * FROM ' . DB::tbl('registrierungen') . ' WHERE email = ? AND email_verifiziert = 1 AND status = ?', [$email, 'pending']);
        if (!$reg) jsonErr('Registrierung nicht gefunden.');
        $secret = \TOTP::generateSecret();
        DB::query('UPDATE ' . DB::tbl('registrierungen') . ' SET totp_pending = ? WHERE email = ?', [$secret, $email]);
        $uri   = \TOTP::getUri($secret, $email);
        $qrUrl = \TOTP::getQrUrl($uri);
        jsonOk(['secret' => $secret, 'qr_url' => $qrUrl, 'uri' => $uri]);
    }

    if ($method === 'POST' && $id === 'register-totp-confirm') {
        $email = trim($body['email'] ?? '');
        $code  = trim($body['code']  ?? '');
        $reg = DB::fetchOne(
            'SELECT * FROM ' . DB::tbl('registrierungen') . ' WHERE email = ? AND email_verifiziert = 1 AND status = ?',
            [$email, 'pending']
        );
        if (!$reg || empty($reg['totp_pending'])) jsonErr('Kein TOTP-Setup gefunden.');
        if (!\TOTP::verify($reg['totp_pending'], $code)) jsonErr('Ungültiger Code.');
        $backupPlain  = \TOTP::generateBackupCodes();
        $backupHashed = array_map(fn($c) => password_hash($c, PASSWORD_BCRYPT, ['cost' => 10]), $backupPlain);
        $autoFreigabe = Settings::get('registrierung_auto_freigabe', '0') === '1';
        $status = $autoFreigabe ? 'approved' : 'pending';

        DB::query('UPDATE ' . DB::tbl('registrierungen') . ' SET totp_secret = ?, totp_backup = ?, status = ? WHERE email = ?',
            [$reg['totp_pending'], json_encode($backupHashed), $status, $email]);

        if ($autoFreigabe) {
            // Sofort Benutzerkonto anlegen
            DB::query('INSERT INTO ' . DB::tbl('benutzer') . ' (benutzername, email, passwort, rolle, totp_secret, totp_aktiv, totp_backup, aktiv) VALUES (?, ?, ?, ?, ?, 1, ?, 1)',
                [$reg['name'], $email, $reg['passwort_hash'], 'leser', $reg['totp_pending'], json_encode($backupHashed)]);
        }
        jsonOk([
            'backup_codes'  => $backupPlain,
            'auto_freigabe' => $autoFreigabe,
            'status'        => $status,
        ]);
    }

    if ($method === 'POST' && $id === 'register-skip-totp') {
        $email = trim($body['email'] ?? '');
        $reg = DB::fetchOne('SELECT * FROM ' . DB::tbl('registrierungen') . ' WHERE email = ? AND email_verifiziert = 1 AND status = ?', [$email, 'pending']);
        if (!$reg) jsonErr('Registrierung nicht gefunden.');
        $autoFreigabe = Settings::get('registrierung_auto_freigabe', '0') === '1';
        $status = $autoFreigabe ? 'approved' : 'pending';
        DB::query('UPDATE ' . DB::tbl('registrierungen') . ' SET status = ? WHERE email = ?', [$status, $email]);
        if ($autoFreigabe) {
            DB::query('INSERT INTO ' . DB::tbl('benutzer') . ' (benutzername, email, passwort, rolle, aktiv) VALUES (?, ?, ?, ?, 1)',
                [$reg['name'], $email, $reg['passwort_hash'], 'leser']);
        }
        jsonOk(['auto_freigabe' => $autoFreigabe, 'status' => $status]);
    }

    // ============================================================
    // PASSWORT-RESET
    // ============================================================
    if ($method === 'POST' && $id === 'reset-request') {
        $email = trim($body['email'] ?? '');
        if (!$email) jsonErr('E-Mail erforderlich.');
        $user = DB::fetchOne('SELECT id, benutzername, email FROM ' . DB::tbl('benutzer') . ' WHERE email = ? AND aktiv = 1', [$email]);
        // Immer OK zurückgeben (kein User-Enumeration)
        if ($user) {
            $code     = str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);
            $codeHash = hashCode($code);
            DB::query('UPDATE ' . DB::tbl('benutzer') . ' SET reset_code_hash = ?, reset_code_exp = DATE_ADD(NOW(), INTERVAL 15 MINUTE) WHERE id = ?', [$codeHash, $user['id']]);
            $subject = Settings::get('verein_name','Verein') . ' – Passwort-Reset-Code: ' . $code;
            $msg     = "Hallo " . $user['benutzername'] . ",\n\ndein Reset-Code:\n\n    " . $code . "\n\nGültig für 15 Minuten.\n\n" . Settings::get('verein_name','Verein');
            @mail($user['email'], $subject, $msg, "From: " . Settings::get('noreply_email','') . "\r\nContent-Type: text/plain; charset=utf-8");
        }
        jsonOk('Falls ein Konto existiert, wurde ein Code gesendet.');
    }

    if ($method === 'POST' && $id === 'reset-verify') {
        $email = trim($body['email'] ?? '');
        $code  = trim($body['code']  ?? '');
        $newPw = $body['passwort'] ?? '';
        if (strlen($newPw) < 8) jsonErr('Passwort muss mind. 8 Zeichen haben.');
        $user = DB::fetchOne('SELECT * FROM ' . DB::tbl('benutzer') . ' WHERE email = ? AND aktiv = 1 AND reset_code_exp > NOW()', [$email]);
        if (!$user || empty($user['reset_code_hash'])) jsonErr('Code abgelaufen oder ungültig.');
        if (!password_verify($code, $user['reset_code_hash'])) jsonErr('Ungültiger Code.');
        DB::query('UPDATE ' . DB::tbl('benutzer') . ' SET passwort = ?, reset_code_hash = NULL, reset_code_exp = NULL WHERE id = ?', [hashPw($newPw), $user['id']]);
        jsonOk('Passwort geändert.');
    }
}

// Fallback
http_response_code(404);
echo json_encode(['ok' => false, 'fehler' => 'Route nicht gefunden: ' . $res . '/' . ($id ?? '')]);
