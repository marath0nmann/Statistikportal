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

$body = [];
if (in_array($method, ['POST','PUT','PATCH'])) {
    $raw = file_get_contents('php://input');
    $body = json_decode($raw, true) ?? [];
}

function jsonOk(mixed $data): void {
    echo json_encode(['ok' => true, 'data' => $data]);
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

// ============================================================
// AUTH
// ============================================================
if ($res === 'auth') {
    // --- Login Schritt 1: Passwort ---
    if ($method === 'POST' && $id === 'login') {
        $result = Auth::loginStep1($body['benutzername'] ?? '', $body['passwort'] ?? '');
        if (!$result['ok']) jsonErr($result['fehler'], 401);
        if (!empty($result['totp_required'])) {
            // Kein vollständiger Login – TOTP noch ausstehend
            jsonOk([
                'totp_required' => true,
                'totp_setup'    => !empty($result['totp_setup']),
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

    // ── Passkey: Login Challenge (Schritt 2 – Alternative zu TOTP) ──
    if ($method === 'POST' && $id === 'passkey-auth-challenge') {
        if (empty($_SESSION['totp_pending_user'])) jsonErr('Keine ausstehende Anmeldung.', 401);
        Passkey::migrate();
        $uid = (int)$_SESSION['totp_pending_user'];
        $options = Passkey::authChallenge($uid);
        jsonOk($options);
    }
    // ── Passkey: Login Response verifizieren ──
    if ($method === 'POST' && $id === 'passkey-auth-verify') {
        $result = Passkey::authVerify($body['credential'] ?? []);
        if (!$result['ok']) jsonErr($result['fehler'], 401);
        // Passkey OK → einloggen
        $uid  = (int)$_SESSION['passkey_auth_user_id_done'] ?? (int)$_SESSION['totp_pending_user'];
        // totp_pending_user wurde in authVerify noch nicht gelöscht (uid bereits gecheckt)
        $uid  = (int)($_SESSION['totp_pending_user'] ?? 0);
        unset($_SESSION['totp_pending_user']);
        $user = DB::fetchOne('SELECT * FROM ' . DB::tbl('benutzer') . ' WHERE id = ? AND aktiv = 1', [$uid]);
        if (!$user) jsonErr('Benutzer nicht gefunden.', 401);
        $loginResult = Auth::finalizeLoginPublic($user);
        jsonOk(['rolle' => $loginResult['rolle'], 'name' => $loginResult['name']]);
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
        $user   = Auth::requireLogin();
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
    if ($method === 'DELETE' && $id === 'passkeys' && $path[2]) {
        $user = Auth::requireLogin();
        $pkId = (int)$path[2];
        if (!Passkey::delete($pkId, $user['id'])) jsonErr('Nicht gefunden oder keine Berechtigung.', 404);
        jsonOk(null);
    }
    // --- Logout ---
    if ($method === 'POST' && $id === 'logout') {
        Auth::logout();
        jsonOk('Abgemeldet.');
    }
    // --- Session prüfen ---
    if ($method === 'GET' && $id === 'me') {
        $user = Auth::check();
        if ($user) {
            // totp_aktiv + Passkey-Status ergänzen
            $row = DB::fetchOne('SELECT totp_aktiv FROM ' . DB::tbl('benutzer') . ' WHERE id = ?', [$user['id']]);
            $user['totp_aktiv']  = !empty($row['totp_aktiv']);
            try { Passkey::migrate(); } catch (\Exception $e) {}
            $user['has_passkey'] = Passkey::userHasPasskey($user['id']);
            jsonOk($user);
        }
        else jsonErr('Nicht eingeloggt.', 401);
    }
    // --- Passwort ändern ---
    if ($method === 'POST' && $id === 'passwort') {
        $user    = Auth::requireLogin();
        $aktuell = $body['aktuell'] ?? '';
        $neu     = $body['neu']     ?? '';
        if (strlen($neu) < 8) jsonErr('Neues Passwort muss mindestens 8 Zeichen haben.');
        $row = DB::fetchOne('SELECT passwort FROM ' . DB::tbl('benutzer') . ' WHERE id = ?', [$user['id']]);
        if (!$row || !password_verify($aktuell, $row['passwort']))
            jsonErr('Aktuelles Passwort ist falsch.', 401);
        $hash = password_hash($neu, PASSWORD_BCRYPT, ['cost' => 12]);
        DB::query('UPDATE ' . DB::tbl('benutzer') . ' SET passwort = ? WHERE id = ?', [$hash, $user['id']]);
        jsonOk('Passwort geändert.');
    }

    // ── REGISTRIERUNG ────────────────────────────────────────
    // Schritt 1: Registrierung starten, E-Mail-Bestätigungscode senden
    if ($method === 'POST' && $id === 'register-start') {
        $email    = strtolower(trim($body['email']    ?? ''));
        $nickname = trim($body['name'] ?? '');
        $pw       = $body['passwort'] ?? '';

        if (!preg_match('/@' . preg_quote(Settings::get('email_domain','vy99.de'), '/') . '$/', $email))
            jsonErr('Nur @' . Settings::get('email_domain','vy99.de') . ' E-Mail-Adressen sind zugelassen.');
        if (strlen($nickname) < 2)  jsonErr('Nickname muss mindestens 2 Zeichen haben.');
        if (!preg_match('/^[\w\-. äöüÄÖÜß]{2,40}$/u', $nickname))
            jsonErr('Nickname enthält ungültige Zeichen (max. 40 Zeichen).');
        if (strlen($pw) < 12) jsonErr('Passwort muss mindestens 12 Zeichen haben.');
        $groups = 0;
        if (preg_match('/[A-Z]/', $pw)) $groups++;
        if (preg_match('/[a-z]/', $pw)) $groups++;
        if (preg_match('/[0-9]/', $pw)) $groups++;
        if (preg_match('/[^A-Za-z0-9]/', $pw)) $groups++;
        if ($groups < 3) jsonErr('Passwort muss mindestens 3 von 4 Zeichengruppen enthalten (Groß-, Kleinbuchstaben, Zahlen, Sonderzeichen).');

        // Prüfen ob E-Mail oder Nickname schon vergeben
        if (DB::fetchOne('SELECT id FROM ' . DB::tbl('benutzer') . ' WHERE email = ?', [$email]) ||
            DB::fetchOne('SELECT id FROM ' . DB::tbl('registrierungen') . ' WHERE email = ? AND status != ?', [$email, 'rejected']))
            jsonErr('Diese E-Mail-Adresse ist bereits registriert oder in Bearbeitung.');
        if (DB::fetchOne('SELECT id FROM ' . DB::tbl('benutzer') . ' WHERE benutzername = ?', [$nickname]) ||
            DB::fetchOne('SELECT id FROM ' . DB::tbl('registrierungen') . ' WHERE name = ? AND status = ?', [$nickname, 'pending']))
            jsonErr('Dieser Nickname ist bereits vergeben. Bitte wähle einen anderen.');

        $code      = str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $codeHash  = password_hash($code, PASSWORD_BCRYPT, ['cost' => 10]);
        $pwHash    = password_hash($pw, PASSWORD_BCRYPT, ['cost' => 12]);

        // Alte abgelehnte Einträge löschen
        DB::query('DELETE FROM ' . DB::tbl('registrierungen') . ' WHERE email = ?', [$email]);

        DB::query(
            'INSERT INTO ' . DB::tbl('registrierungen') . ' (email, name, passwort_hash, email_code_hash, code_expires_at)
             VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 30 MINUTE))',
            [$email, $nickname, $pwHash, $codeHash]
        );

        // E-Mail senden
        $subject = Settings::get('verein_name','Mein Verein e.V.') . ' – Bestätigungscode: ' . $code;
        $msg     = "Hallo " . $nickname . ",\n\n" .
                   "dein Bestätigungscode für die Registrierung lautet:\n\n" .
                   "    " . $code . "\n\n" .
                   "Dieser Code ist 30 Minuten gültig.\n\n" .
                   "Wenn du keine Registrierung beantragt hast, ignoriere diese E-Mail.\n\n" .
                   Settings::get('verein_name','Mein Verein e.V.') . ' ' . Settings::get('app_untertitel','Leichtathletik-Statistik');
        @mail($email, $subject, $msg, "From: " . Settings::get('noreply_email','noreply@vy99.de') . "\r\nContent-Type: text/plain; charset=utf-8");

        jsonOk('Code gesendet.');
    }

    // Schritt 1b: Code erneut senden
    if ($method === 'POST' && $id === 'register-resend') {
        $email = strtolower(trim($body['email'] ?? ''));
        $reg   = DB::fetchOne('SELECT * FROM ' . DB::tbl('registrierungen') . ' WHERE email = ? AND status = ?', [$email, 'pending']);
        if (!$reg) jsonErr('Registrierung nicht gefunden.');

        $code     = str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $codeHash = password_hash($code, PASSWORD_BCRYPT, ['cost' => 10]);
        DB::query('UPDATE ' . DB::tbl('registrierungen') . ' SET email_code_hash = ?, code_expires_at = DATE_ADD(NOW(), INTERVAL 30 MINUTE) WHERE email = ?',
            [$codeHash, $email]);

        $subject = Settings::get('verein_name','Mein Verein e.V.') . ' – Neuer Bestätigungscode: ' . $code;
        $msg     = "Dein neuer Bestätigungscode lautet:\n\n    " . $code . "\n\n(gültig 30 Minuten)\n\n" . Settings::get('verein_name','Mein Verein e.V.');
        @mail($email, $subject, $msg, "From: " . Settings::get('noreply_email','noreply@vy99.de') . "\r\nContent-Type: text/plain; charset=utf-8");

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

        // Admin-Benachrichtigung
        $admins = DB::fetchAll("SELECT email FROM " . DB::tbl('benutzer') . " WHERE rolle = 'admin' AND aktiv = 1");
        foreach ($admins as $admin) {
            $msg = "Neue Registrierungsanfrage:\n\nName: " . $reg['name'] .
                   "\nE-Mail: " . $reg['email'] . "\n\nBitte in der Admin-Oberfläche freigeben.";
            @mail($admin['email'], Settings::get('verein_name','Mein Verein e.V.') . ' – Neue Registrierung: ' . $reg['name'], $msg,
                  "From: " . Settings::get('noreply_email','noreply@vy99.de') . "\r\nContent-Type: text/plain; charset=utf-8");
        }
        jsonOk('Registrierung abgeschlossen. Warte auf Admin-Freigabe.');
    }

    // Admin: alle Registrierungen abrufen
    if ($method === 'GET' && $id === 'registrierungen') {
        Auth::requireAdmin();
        $rows = DB::fetchAll(
            'SELECT id, email, name, status, email_verifiziert, totp_aktiv, erstellt_am
             FROM ' . DB::tbl('registrierungen') . ' ORDER BY erstellt_am DESC'
        );
        jsonOk($rows);
    }

    // Admin: Registrierung genehmigen
    if ($method === 'POST' && $parts[2] === 'genehmigen') {
        Auth::requireAdmin();
        $regId    = (int)$id;
        $athletId = !empty($body['athlet_id']) ? (int)$body['athlet_id'] : null;
        $reg = DB::fetchOne('SELECT * FROM ' . DB::tbl('registrierungen') . ' WHERE id = ?', [$regId]);
        if (!$reg) jsonErr('Registrierung nicht gefunden.');
        if ($reg['status'] !== 'pending') jsonErr('Bereits bearbeitet.');

        // Benutzerkonto anlegen
        $bname = explode('@', $reg['email'])[0]; // Vorschlag: lokaler Teil der E-Mail
        // Eindeutigen Benutzernamen sicherstellen
        $base = $bname; $suffix = 0;
        while (DB::fetchOne('SELECT id FROM ' . DB::tbl('benutzer') . ' WHERE benutzername = ?', [$bname])) {
            $bname = $base . (++$suffix);
        }
        DB::query(
            'INSERT INTO ' . DB::tbl('benutzer') . ' (benutzername, email, passwort, rolle, aktiv, totp_secret, totp_aktiv, totp_backup, athlet_id)
             VALUES (?, ?, ?, ?, 1, ?, 1, ?, ?)',
            [$bname, $reg['email'], $reg['passwort_hash'], 'leser',
             $reg['totp_secret'], '[]', $athletId]
        );
        DB::query('UPDATE ' . DB::tbl('registrierungen') . ' SET status = ? WHERE id = ?', ['approved', $regId]);

        // Benachrichtigungs-Mail
        $msg = "Hallo " . $reg['name'] . ",\n\ndeine Registrierung wurde genehmigt!\n\n" .
               "Benutzername: " . $bname . "\n\nDu kannst dich jetzt einloggen.\n\n" . Settings::get('verein_name','Mein Verein e.V.');
        @mail($reg['email'], Settings::get('verein_name','Mein Verein e.V.') . ' – Registrierung genehmigt', $msg,
              "From: " . Settings::get('noreply_email','noreply@vy99.de') . "\r\nContent-Type: text/plain; charset=utf-8");

        jsonOk(['benutzername' => $bname]);
    }

    // Admin: Registrierung ablehnen
    if ($method === 'POST' && $parts[2] === 'ablehnen') {
        Auth::requireAdmin();
        $regId = (int)$id;
        DB::query('UPDATE ' . DB::tbl('registrierungen') . ' SET status = ? WHERE id = ?', ['rejected', $regId]);

        $reg = DB::fetchOne('SELECT email, name FROM ' . DB::tbl('registrierungen') . ' WHERE id = ?', [$regId]);
        if ($reg) {
            $msg = "Hallo " . $reg['name'] . ",\n\nleider wurde deine Registrierungsanfrage abgelehnt.\n\n" .
                   "Bei Fragen wende dich an den Verein.\n\n" . Settings::get('verein_name','Mein Verein e.V.');
            @mail($reg['email'], Settings::get('verein_name','Mein Verein e.V.') . ' – Registrierung abgelehnt', $msg,
                  "From: " . Settings::get('noreply_email','noreply@vy99.de') . "\r\nContent-Type: text/plain; charset=utf-8");
        }
        jsonOk('Abgelehnt.');
    }
}

// ============================================================
// UPLOAD – Logo (nur Admin)
// ============================================================
if ($res === 'upload' && $id === 'logo') {
    Auth::requireAdmin();
    if ($method !== 'POST' && $method !== 'DELETE') jsonErr('Methode nicht erlaubt.', 405);

    // Logo löschen
    if ($method === 'DELETE') {
        foreach (['png','jpg','gif','svg','webp'] as $e) {
            $alt = __DIR__ . '/../uploads/logo.' . $e;
            if (file_exists($alt)) @unlink($alt);
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
// EINSTELLUNGEN (öffentlich lesbar, Schreiben nur Admin)
// ============================================================
if ($res === 'einstellungen') {
    // Öffentliche Konfig (alle Einstellungen ohne Auth lesbar – kein Geheimnis)
    if ($method === 'GET' && !$id) {
        jsonOk(Settings::all());
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
                'dashboard_timeline_limit','version_nur_admins',
                'adressleiste_farbe','dashboard_layout',
                'footer_datenschutz_url','footer_nutzung_url','footer_impressum_url',
                'disziplin_kategorie_suffix',
                'footer_datenschutz_text','footer_nutzung_text','footer_impressum_text',
                'jugend_aks',
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
    // Jugend-AKs aus Settings laden
    $jugendAksJson = Settings::get('jugend_aks') ?: '';
    $jugendAks = $jugendAksJson ? (json_decode($jugendAksJson, true) ?: []) : [];
    // Fallback: Standard-Jugend-AKs wenn noch keine Konfiguration vorhanden
    if (empty($jugendAks)) {
        $jugendAks = ['MHK','M','MU8','MU10-12','MU18','MU20','MU23','mJB','mjA','mjB','U18',
                      'WHK','W','F','WU8','WU10-U12','WU18','WU23','wjA','wjB'];
    }
    // M* Jugend → MHK, W* Jugend → WHK
    $mAks = []; $wAks = [];
    foreach ($jugendAks as $ak) {
        if (strtoupper(substr($ak,0,1)) === 'W' || in_array($ak, ['F'])) $wAks[] = $ak;
        else $mAks[] = $ak;
    }
    $mList = implode("','", array_map('addslashes', $mAks));
    $wList = implode("','", array_map('addslashes', $wAks));
    return "CASE
        WHEN $alias.altersklasse IN ('$mList') THEN 'MHK'
        WHEN $alias.altersklasse IN ('$wList') THEN 'WHK'
        ELSE $alias.altersklasse END";
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
migrateResultatNum();

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
    if (preg_match('/^(\d{1,2}):(\d{2})$/', $r, $m)) {
        $min = (int)$m[1]; $sec = (int)$m[2];
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
                        a.name_nv AS athlet_name
                 FROM ' . DB::tbl('benutzer') . ' b
                 LEFT JOIN ' . DB::tbl('athleten') . ' a ON a.id = b.athlet_id
                 ORDER BY b.benutzername'
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
        $bname = sanitize($body['benutzername'] ?? '');
        $email = sanitize($body['email'] ?? '');
        $pw    = $body['passwort'] ?? '';
        $rolle = in_array($body['rolle'] ?? '', ['admin','editor','leser']) ? $body['rolle'] : 'leser';
        if (!$bname || !$email || strlen($pw) < 8)
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
            }
        }
        if (!$felder) jsonErr('Keine Änderungen.');
        $params[] = $id;
        DB::query('UPDATE ' . DB::tbl('benutzer') . ' SET ' . implode(',', $felder) . ' WHERE id=?', $params);
        jsonOk('Gespeichert.');
    }
    // Bulk-Import: POST ergebnisse/bulk
    if ($method === 'POST' && $id === 'bulk') {
        $user = Auth::requireEditor();
        $items = $body['items'] ?? [];
        if (!is_array($items) || !count($items)) jsonErr('Keine Einträge.');
        $imported = 0; $skipped = 0; $errors = [];
        foreach ($items as $idx => $item) {
            $datum    = sanitize($item['datum'] ?? '');
            $ort      = sanitize($item['ort'] ?? '');
            $evname   = sanitize($item['veranstaltung_name'] ?? '');
            $aid      = intOrNull($item['athlet_id'] ?? null);
            $ak       = sanitize($item['altersklasse'] ?? '');
            $disziplin= sanitize($item['disziplin'] ?? '');
            $resultat = sanitize($item['resultat'] ?? '');
            // pace wird nicht mehr gespeichert (wird on-the-fly berechnet)
            $akp      = intOrNull($item['ak_platzierung'] ?? null);
            $mstr     = intOrNull($item['meisterschaft'] ?? null);
            if (!$datum || !$ort || !$aid || !$disziplin || !$resultat) {
                $errors[] = "Zeile " . ($idx+1) . ": Pflichtfeld fehlt";
                $skipped++; continue;
            }
            $kuerzel = date('d.m.Y', strtotime($datum)) . ' ' . $ort;
            $v = DB::fetchOne('SELECT id FROM ' . DB::tbl('veranstaltungen') . ' WHERE kuerzel=?', [$kuerzel]);
            if (!$v) {
                DB::query('INSERT INTO ' . DB::tbl('veranstaltungen') . ' (kuerzel,name,ort,datum) VALUES (?,?,?,?)',
                    [$kuerzel, $evname ?: $kuerzel, $ort, $datum]);
                $vid = DB::lastInsertId();
            } else $vid = $v['id'];
            // Duplikat-Check (nur nicht-gelöschte Einträge)
            $dup = DB::fetchOne('SELECT id FROM ' . DB::tbl('ergebnisse') . ' WHERE veranstaltung_id=? AND athlet_id=? AND disziplin=? AND resultat=? AND geloescht_am IS NULL',
                [$vid, $aid, $disziplin, $resultat]);
            if ($dup) { $skipped++; continue; }
            $dmIns633 = DB::fetchOne("SELECT id FROM " . DB::tbl('disziplin_mapping') . " WHERE disziplin=?", [$disziplin]);
            DB::query("INSERT INTO " . DB::tbl('ergebnisse') . " (veranstaltung_id,athlet_id,altersklasse,disziplin,disziplin_mapping_id,resultat,ak_platzierung,meisterschaft,import_quelle,erstellt_von) VALUES (?,?,?,?,?,?,?,?,?,?)",
                [$vid,$aid,$ak,$disziplin,$dmIns633 ? (int)$dmIns633['id'] : null,$resultat,$akp,$mstr,$item['import_quelle'] ?? null,$user['id']]);
            $imported++;
        }
        jsonOk(['imported' => $imported, 'skipped' => $skipped, 'errors' => $errors]);
    }

    if ($method === 'DELETE' && $id) {
        if ((int)$id === (int)$user['id']) jsonErr('Eigenen Account nicht löschbar.');
        DB::query('DELETE FROM ' . DB::tbl('benutzer') . ' WHERE id=?', [$id]);
        jsonOk('Gelöscht.');
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
            $valExpr = "CASE WHEN e.resultat REGEXP '^[0-9]+:[0-9]' THEN TIME_TO_SEC(e.resultat) ELSE CAST(e.resultat AS DECIMAL(10,3)) END";
        }

        // Filter: per mapping_id wenn vorhanden, sonst per disziplin-Name
        $ergWhere = $mappingId
            ? "e.disziplin_mapping_id=?"
            : "e.disziplin=? AND e.disziplin_mapping_id IS NULL";
        $ergParam = $mappingId ? (int)$mappingId : $disz;

        // merge_ak: Jugend-AKs zu MHK/WHK zusammenfassen (aus Settings)
        $mergeAKTl = ($_GET['merge_ak_tl'] ?? '1') !== '0';
        $akExprTl  = buildAkCaseExpr($mergeAKTl);
        $ergs = DB::fetchAll(
            "SELECT e.resultat, $valExpr AS val_sort, v.datum, ($akExprTl) AS altersklasse,
                    $nameExpr AS athlet, a.id AS athlet_id, a.geschlecht
             FROM $tblN e
             JOIN " . DB::tbl('athleten') . " a ON a.id=e.athlet_id
             JOIN " . DB::tbl('veranstaltungen') . " v ON v.id=e.veranstaltung_id
             WHERE $ergWhere AND e.resultat IS NOT NULL AND e.resultat != ''
               AND e.geloescht_am IS NULL
             ORDER BY v.datum ASC, e.id ASC",
            [$ergParam]
        );

        $bestGesamt   = null;
        $bestByG      = [];
        $bestByAK     = [];
        $bestByAthlet = [];
        // Vorherige Werte (für Vergleich in der Timeline)
        $prevGesamt   = null;
        $prevByG      = [];
        $prevByAK     = [];
        $prevByAthlet = [];

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

            // ── CLUB-LABELS ────────────────────────────────────────────────
            // 1. Gesamtbestzeit (Gold)
            if ($bestGesamt === null ||
                ($dir === 'ASC'  && $val < $bestGesamt) ||
                ($dir === 'DESC' && $val > $bestGesamt)) {
                $prevGesamt = $bestGesamt;
                $bestGesamt = $val;
                $labelClub = $prevGesamt === null ? 'Erste Gesamtleistung' : 'Gesamtbestleistung';
                if ($vorher === null) $vorher = $prevGesamt;
            }
            // 2. Geschlechts-Bestleistung (Gold wenn kein Gesamt-Label, sonst überdeckt)
            if (!$labelClub && ($g === 'M' || $g === 'W')) {
                if (!isset($bestByG[$g]) ||
                    ($dir === 'ASC'  && $val < $bestByG[$g]) ||
                    ($dir === 'DESC' && $val > $bestByG[$g])) {
                    $prevByG[$g] = $bestByG[$g] ?? null;
                    $bestByG[$g] = $val;
                    $isFirst = $prevByG[$g] === null;
                    $labelClub = $isFirst
                        ? (($g === 'M') ? 'Erstes Ergebnis M' : 'Erstes Ergebnis W')
                        : (($g === 'M') ? 'Bestleistung Männer' : 'Bestleistung Frauen');
                    if ($vorher === null) $vorher = $prevByG[$g];
                }
            }
            // 3. AK-Bestleistung (Silber) — immer prüfen, unabhängig von Gesamt/Geschlecht
            if ($ak) {
                if (!isset($bestByAK[$ak]) ||
                    ($dir === 'ASC'  && $val < $bestByAK[$ak]) ||
                    ($dir === 'DESC' && $val > $bestByAK[$ak])) {
                    $prevByAK[$ak] = $bestByAK[$ak] ?? null;
                    $bestByAK[$ak] = $val;
                    // Nur als AK-Label setzen wenn kein höherwertiges Gesamt/Geschlecht-Label
                    if (!$labelClub) {
                        $isFirst = $prevByAK[$ak] === null;
                        $labelClub = $isFirst ? 'Erste Leistung ' . $ak : 'Bestleistung ' . $ak;
                        if ($vorher === null) $vorher = $prevByAK[$ak];
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

    // Externe PBs in die Timeline aufnehmen (nur wenn Datum gesetzt)
    try {
        $pbRows = DB::fetchAll(
            "SELECT pb.disziplin, pb.resultat, pb.datum,
                    $nameExpr AS athlet, a.id AS athlet_id,
                    COALESCE(m.fmt_override, k.fmt, 'min') AS fmt
             FROM " . DB::tbl('athlet_pb') . " pb
             JOIN " . DB::tbl('athleten') . " a ON a.id = pb.athlet_id
             LEFT JOIN " . DB::tbl('disziplin_mapping') . " m ON m.disziplin=pb.disziplin
             LEFT JOIN " . DB::tbl('disziplin_kategorien') . " k ON k.id = m.kategorie_id
             WHERE pb.datum IS NOT NULL
             ORDER BY pb.datum DESC"
        );
        foreach ($pbRows as $pb) {
            $fmt = $pb['fmt'] ?? 'min';
            $timelineEvents[] = [
                'datum'     => $pb['datum'],
                'disziplin' => $pb['disziplin'],
                'athlet'    => $pb['athlet'],
                'athlet_id' => $pb['athlet_id'],
                'resultat'  => $pb['resultat'],
                'label'     => 'PB',
                'fmt'       => $fmt,
                'priority'  => 1,
                'extern'    => true,
            ];
        }
    } catch (\Exception $e) { /* athlet_pb noch nicht migriert */ }

    // Nochmals sortieren (PBs eingemischt)
    usort($timelineEvents, function($a, $b) {
        $cmp = strcmp($b['datum'], $a['datum']);
        return $cmp !== 0 ? $cmp : ($a['priority'] - $b['priority']);
    });
    $rekordeTimeline = array_slice($timelineEvents, 0, min((int)($_GET['timeline_limit'] ?? 20), 200));

    // Aktuelle Ergebnisse (mit fmt-Info aus disziplin_mapping)
    $recent = DB::fetchAll(
        "SELECT a.name_nv AS athlet, a.id AS athlet_id, e.altersklasse, e.disziplin,
                e.resultat, e.pace, e.meisterschaft,
                v.kuerzel AS veranstaltung, v.datum,
                COALESCE(m.fmt_override, k.fmt) AS fmt
         FROM $eTbl e
         JOIN " . DB::tbl('athleten') . " a ON a.id=e.athlet_id
         JOIN " . DB::tbl('veranstaltungen') . " v ON v.id=e.veranstaltung_id
         LEFT JOIN " . DB::tbl('disziplin_mapping') . " m ON m.id=e.disziplin_mapping_id
         LEFT JOIN " . DB::tbl('disziplin_kategorien') . " k ON k.id=m.kategorie_id
         WHERE e.geloescht_am IS NULL
         ORDER BY v.datum DESC, e.id DESC LIMIT 20"
    );

    jsonOk(compact('stats','rekordeTimeline','recent'));
}


// ============================================================
// ERGEBNISSE
// ============================================================
$ergebnisTabellen = ['strasse','sprint','mittelstrecke','sprungwurf'];
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
                       v.kuerzel AS veranstaltung, v.datum, v.ort, v.ort AS veranstaltung_ort, v.name AS veranstaltung_name,
                       b.benutzername AS eingetragen_von, e.erstellt_am,
                       COALESCE(dm.fmt_override, dk.fmt) AS fmt,
                       dk.name AS kategorie_name, dk.tbl_key AS kategorie_key
                FROM $tbl e
                JOIN " . DB::tbl('athleten') . " a ON a.id=e.athlet_id
                JOIN " . DB::tbl('veranstaltungen') . " v ON v.id=e.veranstaltung_id
                LEFT JOIN " . DB::tbl('benutzer') . " b ON b.id=e.erstellt_von
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
        $user = Auth::requireEditor();
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

        // pace wird nicht mehr gespeichert
        $distanz = floatOrNull($body['distanz'] ?? null);
        $akpm    = intOrNull($body['ak_platz_meisterschaft'] ?? null);
        $rnum    = ($res === 'sprungwurf') ? floatOrNull($body['resultat'] ?? null) : null;
        if ($unified) {
            $dmId = null;
            $dmRow = DB::fetchOne("SELECT id FROM " . DB::tbl('disziplin_mapping') . " WHERE disziplin=?", [$disziplin]);
            if ($dmRow) $dmId = (int)$dmRow['id'];
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

    // Bulk-Import: POST ergebnisse/bulk
    if ($method === 'POST' && $id === 'bulk') {
        $user = Auth::requireEditor();
        $items = $body['items'] ?? [];
        if (!is_array($items) || !count($items)) jsonErr('Keine Einträge.');
        $imported = 0; $skipped = 0; $errors = [];
        foreach ($items as $idx => $item) {
            $datum    = sanitize($item['datum'] ?? '');
            $ort      = sanitize($item['ort'] ?? '');
            $evname   = sanitize($item['veranstaltung_name'] ?? '');
            $aid      = intOrNull($item['athlet_id'] ?? null);
            $ak       = sanitize($item['altersklasse'] ?? '');
            $disziplin= sanitize($item['disziplin'] ?? '');
            $resultat = sanitize($item['resultat'] ?? '');
            // pace wird nicht mehr gespeichert (wird on-the-fly berechnet)
            $akp      = intOrNull($item['ak_platzierung'] ?? null);
            $mstr     = intOrNull($item['meisterschaft'] ?? null);
            if (!$datum || !$ort || !$aid || !$disziplin || !$resultat) {
                $errors[] = "Zeile " . ($idx+1) . ": Pflichtfeld fehlt";
                $skipped++; continue;
            }
            $kuerzel = date('d.m.Y', strtotime($datum)) . ' ' . $ort;
            $v = DB::fetchOne('SELECT id FROM ' . DB::tbl('veranstaltungen') . ' WHERE kuerzel=?', [$kuerzel]);
            if (!$v) {
                DB::query('INSERT INTO ' . DB::tbl('veranstaltungen') . ' (kuerzel,name,ort,datum) VALUES (?,?,?,?)',
                    [$kuerzel, $evname ?: $kuerzel, $ort, $datum]);
                $vid = DB::lastInsertId();
            } else $vid = $v['id'];
            // Duplikat-Check (nur nicht-gelöschte Einträge)
            $dup = DB::fetchOne('SELECT id FROM ' . DB::tbl('ergebnisse') . ' WHERE veranstaltung_id=? AND athlet_id=? AND disziplin=? AND resultat=? AND geloescht_am IS NULL',
                [$vid, $aid, $disziplin, $resultat]);
            if ($dup) { $skipped++; continue; }
            $dmBulk = DB::fetchOne("SELECT id FROM " . DB::tbl('disziplin_mapping') . " WHERE disziplin=?", [$disziplin]);
            DB::query("INSERT INTO " . DB::tbl('ergebnisse') . " (veranstaltung_id,athlet_id,altersklasse,disziplin,disziplin_mapping_id,resultat,ak_platzierung,meisterschaft,import_quelle,erstellt_von) VALUES (?,?,?,?,?,?,?,?,?,?)",
                [$vid,$aid,$ak,$disziplin,$dmBulk ? (int)$dmBulk['id'] : null,$resultat,$akp,$mstr,$item['import_quelle'] ?? null,$user['id']]);
            $imported++;
        }
        jsonOk(['imported' => $imported, 'skipped' => $skipped, 'errors' => $errors]);
    }

    if ($method === 'PUT' && $id) {
        $user = Auth::requireEditor();
        $row = DB::fetchOne("SELECT erstellt_von FROM $tbl WHERE id=?", [$id]);
        if (!$row) jsonErr('Nicht gefunden.', 404);
        if (!Auth::isAdmin() && $row['erstellt_von'] != $user['id'])
            jsonErr('Keine Berechtigung.', 403);
        $felder = []; $params = [];
        if (isset($body['athlet_id']) && Auth::isAdmin()) {
            $aid = (int)$body['athlet_id'];
            if ($aid > 0) { $felder[] = 'athlet_id=?'; $params[] = $aid; }
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
        $user = Auth::requireEditor();
        // Editoren dürfen nur eigene, Admins alle
        $row = DB::fetchOne("SELECT erstellt_von FROM $tbl WHERE id=?", [$id]);
        if (!$row) jsonErr('Nicht gefunden.', 404);
        if (!Auth::isAdmin() && $row['erstellt_von'] != $user['id'])
            jsonErr('Keine Berechtigung.', 403);
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
        Auth::requireEditor();
        $athletId = (int)$id;
        $pbId     = isset($parts[3]) ? (int)$parts[3] : null;

        if ($method === 'GET') {
            $rows = DB::fetchAll(
                'SELECT id, disziplin, resultat, wettkampf, datum FROM ' . DB::tbl('athlet_pb') . '
                 WHERE athlet_id=? ORDER BY disziplin',
                [$athletId]);
            jsonOk($rows);
        }
        if ($method === 'POST') {
            $disz = sanitize($body['disziplin'] ?? '');
            $res2 = sanitize($body['resultat']  ?? '');
            if (!$disz || !$res2) jsonErr('Disziplin und Ergebnis erforderlich.');
            $dat = ($body['datum'] ?? '') ?: null;
            $wk  = sanitize($body['wettkampf'] ?? '');
            DB::query(
                'INSERT INTO ' . DB::tbl('athlet_pb') . ' (athlet_id, disziplin, resultat, wettkampf, datum) VALUES (?,?,?,?,?)',
                [$athletId, $disz, $res2, $wk ?: null, $dat]);
            jsonOk(['id' => DB::lastInsertId()]);
        }
        if ($method === 'PUT' && $pbId) {
            $disz = sanitize($body['disziplin'] ?? '');
            $res2 = sanitize($body['resultat']  ?? '');
            if (!$disz || !$res2) jsonErr('Disziplin und Ergebnis erforderlich.');
            $dat = ($body['datum'] ?? '') ?: null;
            $wk  = sanitize($body['wettkampf'] ?? '');
            DB::query(
                'UPDATE ' . DB::tbl('athlet_pb') . ' SET disziplin=?, resultat=?, wettkampf=?, datum=? WHERE id=? AND athlet_id=?',
                [$disz, $res2, $wk ?: null, $dat, $pbId, $athletId]);
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
            "SELECT a.*, $anzSql AS anz_ergebnisse
             FROM " . DB::tbl('athleten') . " a WHERE $baseWhere ORDER BY a.name_nv", $params);
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

    if ($method === 'GET' && $id) {
        $hasDelColA = DB::fetchOne("SHOW COLUMNS FROM " . DB::tbl('athleten') . " LIKE 'geloescht_am'");
        $athlet = $hasDelColA
            ? DB::fetchOne('SELECT * FROM ' . DB::tbl('athleten') . ' WHERE id=? AND geloescht_am IS NULL', [$id])
            : DB::fetchOne('SELECT * FROM ' . DB::tbl('athleten') . ' WHERE id=?', [$id]);
        if (!$athlet) jsonErr('Nicht gefunden.', 404);
        try {
            $athlet['gruppen'] = DB::fetchAll('SELECT g.id, g.name FROM ' . DB::tbl('gruppen') . ' g JOIN ' . DB::tbl('athlet_gruppen') . ' ag ON ag.gruppe_id=g.id WHERE ag.athlet_id=? ORDER BY g.name', [$id]);
        } catch (\Exception $e) { $athlet['gruppen'] = []; }
        if ($unified) {
            $alle = DB::fetchAll(
                'SELECT e.id, e.disziplin, e.resultat, e.pace, e.altersklasse, e.meisterschaft,
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
            jsonOk(compact('athlet','kategorien'));
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
        usort($counts, function($a,$b){ return $b['cnt'] - $a['cnt']; });
        jsonOk(array_slice($counts, 0, 5));
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
            $diszCond  = "e.disziplin=?";
            $diszParam = $disz;
        }

        $nameExpr = "CONCAT(COALESCE(a.nachname,''), IF(a.vorname IS NOT NULL AND a.vorname != '', CONCAT(', ', a.vorname), ''))";
        $joinVer  = "JOIN " . DB::tbl('veranstaltungen') . " v ON v.id = e.veranstaltung_id";
        $mergeAK  = ($_GET['merge_ak'] ?? '1') !== '0';
        $akExpr   = buildAkCaseExpr($mergeAK);

        // Sortierung: resultat_num für unified (Sekunden numerisch), LPAD für Legacy-VARCHAR
        if ($fmt === 'm') {
            $sortCol = $unified ? "e.resultat_num" : "e.resultat";
        } else {
            // Zeitformat: resultat_num wenn vorhanden (Sekunden), sonst LPAD für konsistenten Stringvergleich
            $sortCol = $unified ? "COALESCE(e.resultat_num, TIME_TO_SEC(e.resultat))"
                                : "LPAD(e.resultat, 10, '0')";
        }
        $paceField = ($fmt === 'min' && (strpos($tbl,'strasse') !== false || $unified)) ? ", e.pace" : "";

        $top_gesamt = DB::fetchAll(
            "SELECT e.resultat $paceField, v.datum, $akExpr AS altersklasse,
                    $nameExpr AS athlet, a.id AS athlet_id, a.geschlecht
             FROM $tbl e JOIN " . DB::tbl('athleten') . " a ON a.id = e.athlet_id $joinVer
             WHERE $diszCond AND e.geloescht_am IS NULL
               AND a.geloescht_am IS NULL AND v.geloescht_am IS NULL
             ORDER BY $sortCol $dir LIMIT 50", [$diszParam]);

        $top_m = DB::fetchAll(
            "SELECT e.resultat $paceField, v.datum, $akExpr AS altersklasse,
                    $nameExpr AS athlet, a.id AS athlet_id
             FROM $tbl e JOIN " . DB::tbl('athleten') . " a ON a.id = e.athlet_id $joinVer
             WHERE $diszCond AND e.geloescht_am IS NULL
               AND a.geloescht_am IS NULL AND v.geloescht_am IS NULL
               AND (a.geschlecht='M' OR (a.geschlecht IS NULL AND e.altersklasse LIKE 'M%'))
             ORDER BY $sortCol $dir LIMIT 50", [$diszParam]);

        $top_w = DB::fetchAll(
            "SELECT e.resultat $paceField, v.datum, $akExpr AS altersklasse,
                    $nameExpr AS athlet, a.id AS athlet_id
             FROM $tbl e JOIN " . DB::tbl('athleten') . " a ON a.id = e.athlet_id $joinVer
             WHERE $diszCond AND e.geloescht_am IS NULL
               AND a.geloescht_am IS NULL AND v.geloescht_am IS NULL
               AND (a.geschlecht='W' OR (a.geschlecht IS NULL AND (e.altersklasse LIKE 'W%' OR e.altersklasse LIKE 'F%')))
             ORDER BY $sortCol $dir LIMIT 50", [$diszParam]);

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
            $ak_results = DB::fetchAll(
                "SELECT e.resultat $paceField, v.datum, $akExpr AS altersklasse,
                        $nameExpr AS athlet, a.id AS athlet_id, a.geschlecht
                 FROM $tbl e JOIN " . DB::tbl('athleten') . " a ON a.id = e.athlet_id $joinVer
                 WHERE e.disziplin=? AND $akExpr=?
                   AND e.geloescht_am IS NULL AND a.geloescht_am IS NULL AND v.geloescht_am IS NULL
                 ORDER BY $sortCol $dir LIMIT 50", [$disz, $ak_val]);
            $all_ak[$ak_val] = $ak_results;
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
    // Bulk-Import: POST ergebnisse/bulk
    if ($method === 'POST' && $id === 'bulk') {
        $user = Auth::requireEditor();
        $items = $body['items'] ?? [];
        if (!is_array($items) || !count($items)) jsonErr('Keine Einträge.');
        $imported = 0; $skipped = 0; $errors = [];
        foreach ($items as $idx => $item) {
            $datum    = sanitize($item['datum'] ?? '');
            $ort      = sanitize($item['ort'] ?? '');
            $evname   = sanitize($item['veranstaltung_name'] ?? '');
            $aid      = intOrNull($item['athlet_id'] ?? null);
            $ak       = sanitize($item['altersklasse'] ?? '');
            $disziplin= sanitize($item['disziplin'] ?? '');
            $resultat = sanitize($item['resultat'] ?? '');
            // pace wird nicht mehr gespeichert (wird on-the-fly berechnet)
            $akp      = intOrNull($item['ak_platzierung'] ?? null);
            $mstr     = intOrNull($item['meisterschaft'] ?? null);
            if (!$datum || !$ort || !$aid || !$disziplin || !$resultat) {
                $errors[] = "Zeile " . ($idx+1) . ": Pflichtfeld fehlt";
                $skipped++; continue;
            }
            $kuerzel = date('d.m.Y', strtotime($datum)) . ' ' . $ort;
            $v = DB::fetchOne('SELECT id FROM ' . DB::tbl('veranstaltungen') . ' WHERE kuerzel=?', [$kuerzel]);
            if (!$v) {
                DB::query('INSERT INTO ' . DB::tbl('veranstaltungen') . ' (kuerzel,name,ort,datum) VALUES (?,?,?,?)',
                    [$kuerzel, $evname ?: $kuerzel, $ort, $datum]);
                $vid = DB::lastInsertId();
            } else $vid = $v['id'];
            // Duplikat-Check (nur nicht-gelöschte Einträge)
            $dup = DB::fetchOne('SELECT id FROM ' . DB::tbl('ergebnisse') . ' WHERE veranstaltung_id=? AND athlet_id=? AND disziplin=? AND resultat=? AND geloescht_am IS NULL',
                [$vid, $aid, $disziplin, $resultat]);
            if ($dup) { $skipped++; continue; }
            $dmBulk = DB::fetchOne("SELECT id FROM " . DB::tbl('disziplin_mapping') . " WHERE disziplin=?", [$disziplin]);
            DB::query("INSERT INTO " . DB::tbl('ergebnisse') . " (veranstaltung_id,athlet_id,altersklasse,disziplin,disziplin_mapping_id,resultat,ak_platzierung,meisterschaft,import_quelle,erstellt_von) VALUES (?,?,?,?,?,?,?,?,?,?)",
                [$vid,$aid,$ak,$disziplin,$dmBulk ? (int)$dmBulk['id'] : null,$resultat,$akp,$mstr,$item['import_quelle'] ?? null,$user['id']]);
            $imported++;
        }
        jsonOk(['imported' => $imported, 'skipped' => $skipped, 'errors' => $errors]);
    }

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
            UNIQUE KEY uq_disz (disziplin),
            FOREIGN KEY (kategorie_id) REFERENCES disziplin_kategorien(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        try { DB::query("ALTER TABLE " . DB::tbl('disziplin_mapping') . " ADD COLUMN IF NOT EXISTS anzeige_name VARCHAR(60) NULL"); } catch (Exception $e) {}
        try { DB::query("ALTER TABLE " . DB::tbl('disziplin_mapping') . " ADD COLUMN IF NOT EXISTS fmt_override  VARCHAR(20) NULL"); } catch (Exception $e) {}
        try { DB::query("ALTER TABLE " . DB::tbl('disziplin_mapping') . " ADD COLUMN IF NOT EXISTS kat_suffix_override VARCHAR(10) NULL"); } catch (Exception $e) {}
        try { DB::query("ALTER TABLE " . DB::tbl('disziplin_mapping') . " ADD COLUMN IF NOT EXISTS hof_exclude TINYINT(1) NOT NULL DEFAULT 0"); } catch (Exception $e) {}
        // Basis: alle mapping-Einträge (mapping.id als Key → kein Überschreiben bei gleichem Namen)
        $all_disz = [];
        $mappings = DB::fetchAll(
            "SELECT m.id, m.disziplin, m.kategorie_id, m.fmt_override,
                    COALESCE(m.kat_suffix_override,'') AS kat_suffix_override,
                    COALESCE(m.hof_exclude,0) AS hof_exclude,
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
        DB::query("INSERT INTO " . DB::tbl('disziplin_mapping') . "
                   (disziplin, kategorie_id, fmt_override, kat_suffix_override, hof_exclude)
                   VALUES (?,?,?,?,?)
                   ON DUPLICATE KEY UPDATE kategorie_id=VALUES(kategorie_id),
                   fmt_override=VALUES(fmt_override), kat_suffix_override=VALUES(kat_suffix_override),
                   hof_exclude=VALUES(hof_exclude)",
                  [$disziplin, $kategorie_id, $fmt_override ?: null, $kat_suffix ?: null, $hof_exclude]);
        // disziplin_mapping_id in ergebnisse aktualisieren
        $mapping = DB::fetchOne("SELECT id FROM " . DB::tbl('disziplin_mapping') . " WHERE disziplin=? AND kategorie_id=?", [$disziplin, $kategorie_id]);
        if ($mapping) {
            DB::query("UPDATE " . DB::tbl('ergebnisse') . " SET disziplin_mapping_id=? WHERE disziplin=?", [$mapping['id'], $disziplin]);
        }
        jsonOk(['id' => $mapping ? (int)$mapping['id'] : null]);
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
            // disziplin_mapping_id befüllen
            DB::query("UPDATE " . DB::tbl('ergebnisse') . " e JOIN " . DB::tbl('disziplin_mapping') . " m ON m.disziplin=e.disziplin SET e.disziplin_mapping_id=m.id WHERE e.disziplin_mapping_id IS NULL");
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
    // Bulk-Import: POST ergebnisse/bulk
    if ($method === 'POST' && $id === 'bulk') {
        $user = Auth::requireEditor();
        $items = $body['items'] ?? [];
        if (!is_array($items) || !count($items)) jsonErr('Keine Einträge.');
        $imported = 0; $skipped = 0; $errors = [];
        foreach ($items as $idx => $item) {
            $datum    = sanitize($item['datum'] ?? '');
            $ort      = sanitize($item['ort'] ?? '');
            $evname   = sanitize($item['veranstaltung_name'] ?? '');
            $aid      = intOrNull($item['athlet_id'] ?? null);
            $ak       = sanitize($item['altersklasse'] ?? '');
            $disziplin= sanitize($item['disziplin'] ?? '');
            $resultat = sanitize($item['resultat'] ?? '');
            // pace wird nicht mehr gespeichert (wird on-the-fly berechnet)
            $akp      = intOrNull($item['ak_platzierung'] ?? null);
            $mstr     = intOrNull($item['meisterschaft'] ?? null);
            if (!$datum || !$ort || !$aid || !$disziplin || !$resultat) {
                $errors[] = "Zeile " . ($idx+1) . ": Pflichtfeld fehlt";
                $skipped++; continue;
            }
            $kuerzel = date('d.m.Y', strtotime($datum)) . ' ' . $ort;
            $v = DB::fetchOne('SELECT id FROM ' . DB::tbl('veranstaltungen') . ' WHERE kuerzel=?', [$kuerzel]);
            if (!$v) {
                DB::query('INSERT INTO ' . DB::tbl('veranstaltungen') . ' (kuerzel,name,ort,datum) VALUES (?,?,?,?)',
                    [$kuerzel, $evname ?: $kuerzel, $ort, $datum]);
                $vid = DB::lastInsertId();
            } else $vid = $v['id'];
            // Duplikat-Check (nur nicht-gelöschte Einträge)
            $dup = DB::fetchOne('SELECT id FROM ' . DB::tbl('ergebnisse') . ' WHERE veranstaltung_id=? AND athlet_id=? AND disziplin=? AND resultat=? AND geloescht_am IS NULL',
                [$vid, $aid, $disziplin, $resultat]);
            if ($dup) { $skipped++; continue; }
            $dmBulk = DB::fetchOne("SELECT id FROM " . DB::tbl('disziplin_mapping') . " WHERE disziplin=?", [$disziplin]);
            DB::query("INSERT INTO " . DB::tbl('ergebnisse') . " (veranstaltung_id,athlet_id,altersklasse,disziplin,disziplin_mapping_id,resultat,ak_platzierung,meisterschaft,import_quelle,erstellt_von) VALUES (?,?,?,?,?,?,?,?,?,?)",
                [$vid,$aid,$ak,$disziplin,$dmBulk ? (int)$dmBulk['id'] : null,$resultat,$akp,$mstr,$item['import_quelle'] ?? null,$user['id']]);
            $imported++;
        }
        jsonOk(['imported' => $imported, 'skipped' => $skipped, 'errors' => $errors]);
    }

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
if ($res === 'mika-fetch' && $method === 'GET') {
    Auth::requireLogin();
    $baseUrl = rtrim($_GET['base_url'] ?? '', '/') . '/';
    $club    = trim($_GET['club'] ?? '');
    if (!$baseUrl || !preg_match('/^https?:\/\/[a-zA-Z0-9._\-]+\.mikatiming\.(?:com|de|net)\//i', $baseUrl))
        jsonErr('Ungültige MikaTiming-URL.', 400);

    $ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0 Safari/537.36';
    $cookieFile = tempnam(sys_get_temp_dir(), 'mika_');

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
        }
        // Ort aus JSON-LD, meta oder Seitentext
        if (preg_match('/"addressLocality"\s*:\s*"([^"]+)"/i', $mainHtml, $lm)) $eventOrt = $lm[1];
        elseif (preg_match('/"location"\s*:\s*\{[^}]*"name"\s*:\s*"([^"]+)"/i', $mainHtml, $lm)) $eventOrt = $lm[1];
        // Aus Event-Namen: Stadt erkennen (auch GROSSBUCHSTABEN → Title Case)
        if (!$eventOrt && $eventName) {
            if (preg_match('/\b(M[uü]nchen|Berlin|Hamburg|Frankfurt|K[oö]ln|Stuttgart|D[uü]sseldorf|Leipzig|Dresden|Hannover|Bremen|M[uü]nster|Dortmund|Essen|Duisburg|Bochum|Wuppertal|Bonn|Gelsenkirchen|Aachen|Bielefeld|Mannheim|Augsburg|Wiesbaden|M[oö]nchengladbach|Braunschweig|Kiel|Halle|Magdeburg|Erfurt|Rostock|Mainz|L[uü]beck|Osnabr[uü]ck|Oldenburg|Freiburg|Heidelberg|Darmstadt|Regensburg|W[uü]rzburg|Ingolstadt|Ulm|Heilbronn|Pforzheim|Oberhausen|Hagen|Hamm|M[uü]lheim|Saarbr[uü]cken|Potsdam|G[oö]ttingen|Kassel|Paderborn|Trier|Jena|Gera|Cottbus|Schwerin|Viersen|Krefeld|Kleve|Moers|Neuss|Solingen|Leverkusen|Remscheid|Rees|Viersen)\b/ui', $eventName, $om)) {
                $eventOrt = $om[1];
            }
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

    // 2. Suche mit fpid=search + event= (nötig für korrekte idp-Links)
    $searchUrl = $baseUrl . '?pid=search&fpid=search&lang=DE&pidp=start'
        . '&search%5Bclub%5D=' . urlencode($club)
        . '&search%5Bage_class%5D=%25&search%5Bsex%5D=%25&search%5Bnation%5D=%25'
        . '&search_sort=name'
        . ($eventId ? '&event=' . urlencode($eventId) . '&search_event=' . urlencode($eventId) : '');
    $searchHtml = mikaCurl($searchUrl, $cookieFile, $ua);
    $debug = ['searchUrl' => $searchUrl, 'htmlLen' => strlen($searchHtml)];

    // Ergebniszeilen: li mit event-Klasse + idp-Link
    $results = [];
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

        $results[] = [
            'name' => trim($name), 'contest' => $evId ?: 'Unbekannt',
            'netto' => '', 'ak' => $ak,
            'platz_ak' => $placeAK, 'platz_ges' => $placeGes,
            'event_id' => $evId, 'idp' => $idp, 'club' => $club,
        ];
    }
    $debug['rowsFound'] = count($results);

    // 3. Detailseite pro Athlet: Zeit + AK
    foreach ($results as &$res) {
        $idp = $res['idp']; $evId = $res['event_id'];
        // Basis-Suchparameter beibehalten für Cookie-Kontext
        $detailUrl = $baseUrl . '?content=detail&fpid=search&pid=search&lang=DE'
            . '&idp=' . urlencode($idp) . '&event=' . urlencode($evId) . '&pidp=start'
            . '&search%5Bclub%5D=' . urlencode($club)
            . '&search%5Bage_class%5D=%25&search%5Bsex%5D=%25&search%5Bnation%5D=%25'
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
// VERANSTALTUNGEN
// ============================================================
// VERANSTALTUNGEN
// ============================================================
if ($res === 'veranstaltungen' && $method === 'GET') {
    // Öffentlich zugänglich
    $eTbl = ergebnisTbl('strasse', $unified, $_sys);
    $limit = min((int)($_GET['limit'] ?? 10), 50);
    $offset = (int)($_GET['offset'] ?? 0);
    $veranst = DB::fetchAll(
        "SELECT v.id, v.kuerzel, v.name, v.ort, v.datum,
                COUNT(e.id) AS anz_ergebnisse,
                COUNT(DISTINCT e.athlet_id) AS anz_athleten
         FROM " . DB::tbl('veranstaltungen') . " v
         LEFT JOIN $eTbl e ON e.veranstaltung_id = v.id AND e.geloescht_am IS NULL
         WHERE v.geloescht_am IS NULL
         GROUP BY v.id
         ORDER BY v.datum DESC
         LIMIT $limit OFFSET $offset"
    );
    $total = DB::fetchOne("SELECT COUNT(*) c FROM " . DB::tbl('veranstaltungen') . " WHERE geloescht_am IS NULL")['c'];
    foreach ($veranst as &$v) {
        $v['ergebnisse'] = DB::fetchAll(
            "SELECT a.name_nv AS athlet, a.id AS athlet_id, e.altersklasse, e.disziplin,
                    e.resultat, e.pace, e.meisterschaft, e.ak_platzierung, e.ak_platz_meisterschaft,
                    COALESCE(m.fmt_override, k.fmt) AS fmt
             FROM $eTbl e
             JOIN " . DB::tbl('athleten') . " a ON a.id=e.athlet_id
             LEFT JOIN " . DB::tbl('disziplin_mapping') . " m ON m.id=e.disziplin_mapping_id
             LEFT JOIN " . DB::tbl('disziplin_kategorien') . " k ON k.id=m.kategorie_id
             WHERE e.veranstaltung_id=? AND e.geloescht_am IS NULL
             ORDER BY e.resultat_num ASC, e.resultat ASC",
            [$v['id']]
        );
    }
    unset($v);
    jsonOk(compact('veranst','total'));
}

if ($res === 'veranstaltungen' && $method === 'PUT' && $id) {
    Auth::requireEditor();
    $felder = []; $params = [];
    if (isset($body['name']))  { $felder[] = 'name=?';  $params[] = sanitize($body['name'] ?? '') ?: null; }
    if (!empty($body['datum'])){ $felder[] = 'datum=?'; $params[] = $body['datum']; }
    if (isset($body['ort']))   { $felder[] = 'ort=?';   $params[] = sanitize($body['ort'] ?? '') ?: null; }
    if (!$felder) jsonErr('Keine Änderungen.');
    $params[] = $id;
    DB::query('UPDATE ' . DB::tbl('veranstaltungen') . ' SET ' . implode(',', $felder) . ' WHERE id=?', $params);
    jsonOk('Gespeichert.');
}

if ($res === 'veranstaltungen' && $method === 'DELETE' && $id) {
    Auth::requireAdmin();
    $eTbl = ergebnisTbl('strasse', $unified, $_sys);
    $anz = DB::fetchOne("SELECT COUNT(*) c FROM $eTbl WHERE veranstaltung_id=? AND geloescht_am IS NULL", [$id])['c'];
    // Ergebnisse der Veranstaltung ebenfalls in Papierkorb
    DB::query("UPDATE $eTbl SET geloescht_am=NOW() WHERE veranstaltung_id=? AND geloescht_am IS NULL", [$id]);
    DB::query("UPDATE " . DB::tbl('veranstaltungen') . " SET geloescht_am=NOW() WHERE id=?", [$id]);
    jsonOk('In Papierkorb verschoben (' . $anz . ' Ergebnisse ebenfalls).');
}


// ============================================================
// ERGEBNISSE/BULK
// ============================================================
if ($res === 'ergebnisse' && $method === 'POST' && $id === 'bulk') {
    $user = Auth::requireEditor();
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
        $pace      = sanitize($item['pace'] ?? '');
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
            $kuerzel = date('d.m.Y', strtotime($datum)) . ' ' . $ort;
            $v = DB::fetchOne('SELECT id FROM ' . DB::tbl('veranstaltungen') . ' WHERE kuerzel=?', [$kuerzel]);
            if (!$v) {
                DB::query('INSERT INTO ' . DB::tbl('veranstaltungen') . ' (kuerzel,name,ort,datum) VALUES (?,?,?,?)',
                    [$kuerzel, $evname ?: $kuerzel, $ort, $datum]);
                $vid = DB::lastInsertId();
            } else $vid = $v['id'];
        }
        $dup = DB::fetchOne('SELECT id FROM ' . DB::tbl('ergebnisse') . ' WHERE veranstaltung_id=? AND athlet_id=? AND disziplin=? AND resultat=? AND geloescht_am IS NULL',
            [$vid, $aid, $disziplin, $resultat]);
        if ($dup) { $skipped++; continue; }
        $dmInfo = DB::fetchOne("SELECT dm.id, dk.fmt FROM " . DB::tbl('disziplin_mapping') . " dm LEFT JOIN " . DB::tbl('disziplin_kategorien') . " dk ON dk.tbl_key = (SELECT tbl_key FROM " . DB::tbl('disziplin_kategorien') . " dk2 WHERE dk2.id = dm.kategorie_id LIMIT 1) WHERE dm.disziplin=?", [$disziplin]);
        $dmFmt = $dmInfo['fmt'] ?? 'min';
        [$resultat, $rnum] = normalizeResultat($resultat, $dmFmt);
        DB::query("INSERT INTO " . DB::tbl('ergebnisse') . " (veranstaltung_id,athlet_id,altersklasse,disziplin,disziplin_mapping_id,resultat,resultat_num,pace,ak_platzierung,meisterschaft,ak_platz_meisterschaft,import_quelle,erstellt_von) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
            [$vid,$aid,$ak,$disziplin,$dmInfo ? (int)$dmInfo['id'] : null,$resultat,$rnum,$pace,$akp,$mstr,$akpm,$quelle,$user['id']]);
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
        jsonOk(['ergebnisse' => $ergebnisse, 'athleten' => $athleten, 'veranstaltungen' => $veranst]);
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
            DB::query("DELETE FROM $eTbl WHERE geloescht_am IS NOT NULL");
            DB::query("DELETE FROM " . DB::tbl('athleten') . " WHERE geloescht_am IS NOT NULL");
            DB::query("DELETE FROM " . DB::tbl('veranstaltungen') . " WHERE geloescht_am IS NOT NULL");
            jsonOk('Papierkorb geleert.');
        }

        if (!$rid) jsonErr('Ungültige ID.');

        if ($rtyp === 'ergebnis') {
            DB::query("DELETE FROM $eTbl WHERE id=? AND geloescht_am IS NOT NULL", [$rid]);
        } elseif ($rtyp === 'athlet') {
            DB::query("DELETE FROM " . DB::tbl('athleten') . " WHERE id=? AND geloescht_am IS NOT NULL", [$rid]);
        } elseif ($rtyp === 'veranstaltung') {
            DB::query("DELETE FROM $eTbl WHERE veranstaltung_id=? AND geloescht_am IS NOT NULL", [$rid]);
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
                $valExpr = "CASE WHEN e.resultat REGEXP '^[0-9]+:[0-9]' THEN TIME_TO_SEC(e.resultat) ELSE CAST(e.resultat AS DECIMAL(10,3)) END";
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

            // Geschlechts-Bestleistung → "Gesamtbestleistung Männer/Frauen" (gold)
            // Die frühere "Gesamtbestleistung über alle" entfällt
            foreach ($bestGAid as $g => $aid) {
                $addTitel($aid, $g === 'M' ? 'Gesamtbestleistung Männer' : 'Gesamtbestleistung Frauen', $bestGDatum[$g]);
            }
            foreach ($bestAKAid as $ak => $aid) {
                $addTitel($aid, 'Bestleistung ' . $ak, $bestAKDatum[$ak]);
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
        foreach ($ath['titel'] as $t) {
            $byDisz[$t['disziplin']][] = ['label' => $t['label'], 'datum' => $t['datum']];
        }
        $ath['disziplinen'] = $byDisz;
        $ath['titelCount']  = array_sum(array_map('count', $byDisz));
        unset($ath['titel']);
    }
    unset($ath);

    // Absteigende Sortierung nach Titelanzahl
    usort($hof, function ($a, $b) {
        return $b['titelCount'] - $a['titelCount'];
    });

    jsonOk($hof);
}

jsonErr('Unbekannte Route.', 404);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'fehler' => $e->getMessage(), 'trace' => $e->getFile().':'.$e->getLine()]);
    exit;
}
