<?php
// ============================================================
// TuS Oedt – REST API
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
// ROUTING – globaler Fehler-Wrapper
// ============================================================
try {

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
    // --- TOTP deaktivieren (Admin, für sich selbst) ---
    if ($method === 'DELETE' && $id === 'totp-setup') {
        $user = Auth::requireAdmin();
        Auth::totpDisable($user['id']);
        jsonOk('2FA deaktiviert.');
    }
    // --- Logout ---
    if ($method === 'POST' && $id === 'logout') {
        Auth::logout();
        jsonOk('Abgemeldet.');
    }
    // --- Session prüfen ---
    if ($method === 'GET' && $id === 'me') {
        $user = Auth::check();
        if ($user) jsonOk($user);
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
        $athleten = DB::fetchAll('SELECT id, name_nv FROM ' . DB::tbl('athleten') . ' WHERE aktiv=1 ORDER BY name_nv');
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
            $pace     = sanitize($item['pace'] ?? '');
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
            // Duplikat-Check
            $dup = DB::fetchOne('SELECT id FROM ' . DB::tbl('ergebnisse') . ' WHERE veranstaltung_id=? AND athlet_id=? AND disziplin=? AND resultat=?',
                [$vid, $aid, $disziplin, $resultat]);
            if ($dup) { $skipped++; continue; }
            DB::query("INSERT INTO " . DB::tbl('ergebnisse') . " (veranstaltung_id,athlet_id,altersklasse,disziplin,resultat,pace,ak_platzierung,meisterschaft,import_quelle,erstellt_von) VALUES (?,?,?,?,?,?,?,?,?,?)",
                [$vid,$aid,$ak,$disziplin,$resultat,$pace,$akp,$mstr,$item['import_quelle'] ?? null,$user['id']]);
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
            'athleten' => DB::fetchOne('SELECT COUNT(*) c FROM ' . DB::tbl('athleten') . ' WHERE aktiv=1 AND geloescht_am IS NULL')['c'],
            'rekorde'  => DB::fetchOne('SELECT COUNT(*) c FROM ' . DB::tbl('vereinsrekorde') . '')['c'],
        ];
    } else {
        $stats = [
            'strasse'       => DB::fetchOne('SELECT COUNT(*) c FROM ' . DB::tbl('ergebnisse_strasse') . '')['c'],
            'sprint'        => DB::fetchOne('SELECT COUNT(*) c FROM ' . DB::tbl('ergebnisse_sprint') . '')['c'],
            'mittelstrecke' => DB::fetchOne('SELECT COUNT(*) c FROM ' . DB::tbl('ergebnisse_mittelstrecke') . '')['c'],
            'sprungwurf'    => DB::fetchOne('SELECT COUNT(*) c FROM ' . DB::tbl('ergebnisse_sprungwurf') . '')['c'],
            'athleten'      => DB::fetchOne('SELECT COUNT(*) c FROM ' . DB::tbl('athleten') . ' WHERE aktiv=1')['c'],
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

    // Alle Disziplinen mit fmt sammeln (über alle Tabellen)
    $diszMap = [];
    foreach ($tblsForTimeline as $tblInfo) {
        $tblN = $tblInfo['tbl'];
        $fmtFb = $tblInfo['fmt_fallback'];
        $rows = DB::fetchAll(
            "SELECT DISTINCT e.disziplin, COALESCE(m.fmt_override, k.fmt, ?) AS fmt
             FROM $tblN e
             LEFT JOIN " . DB::tbl('disziplin_mapping') . " m ON m.disziplin=e.disziplin
             LEFT JOIN " . DB::tbl('disziplin_kategorien') . " k ON k.id=m.kategorie_id
             WHERE e.disziplin IS NOT NULL",
            [$fmtFb]
        );
        foreach ($rows as $r) {
            if (!isset($diszMap[$r['disziplin']])) {
                $diszMap[$r['disziplin']] = ['fmt'=>$r['fmt'], 'tbl'=>$tblN];
            }
        }
    }

    $timelineEvents = [];
    foreach ($diszMap as $disz => $dInfo) {
        $fmt  = $dInfo['fmt'] ?? 'min';
        $tblN = $dInfo['tbl'];
        $dir  = ($fmt === 'm') ? 'DESC' : 'ASC';

        // val_sort: für Meter resultat_num, für Zeiten TIME_TO_SEC oder direkt als float
        if ($fmt === 'm') {
            $valExpr = "COALESCE(e.resultat_num, CAST(e.resultat AS DECIMAL(10,3)))";
        } else {
            // Zeitwert: HH:MM:SS -> Sekunden für korrekten numerischen Vergleich
            $valExpr = "CASE WHEN e.resultat REGEXP '^[0-9]+:[0-9]' THEN TIME_TO_SEC(e.resultat) ELSE CAST(e.resultat AS DECIMAL(10,3)) END";
        }

        $ergs = DB::fetchAll(
            "SELECT e.resultat, $valExpr AS val_sort, v.datum, e.altersklasse,
                    $nameExpr AS athlet, a.id AS athlet_id, a.geschlecht
             FROM $tblN e
             JOIN " . DB::tbl('athleten') . " a ON a.id=e.athlet_id
             JOIN " . DB::tbl('veranstaltungen') . " v ON v.id=e.veranstaltung_id
             WHERE e.disziplin=? AND e.resultat IS NOT NULL AND e.resultat != ''
               AND e.geloescht_am IS NULL
             ORDER BY v.datum ASC, e.id ASC",
            [$disz]
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
            $val   = ($fmt === 'm') ? (float)($e['val_sort'] ?? 0) : (float)($e['val_sort'] ?? 0);
            $datum = $e['datum'];
            $g     = $e['geschlecht'] ?? '';
            $ak    = $e['altersklasse'] ?? '';
            $labels = [];
            $vorher = null; // vorheriges Resultat für den primären Label

            // 1. Gesamtbestzeit
            if ($bestGesamt === null ||
                ($dir === 'ASC'  && $val < $bestGesamt) ||
                ($dir === 'DESC' && $val > $bestGesamt)) {
                $prevGesamt = $bestGesamt;
                $bestGesamt = $val;
                $labels[] = $prevGesamt === null ? 'Erste Gesamtleistung' : 'Gesamtbestleistung';
                if ($vorher === null) $vorher = $prevGesamt;
            }
            // 2. Geschlecht M/W
            if ($g === 'M' || $g === 'W') {
                if (!isset($bestByG[$g]) ||
                    ($dir === 'ASC'  && $val < $bestByG[$g]) ||
                    ($dir === 'DESC' && $val > $bestByG[$g])) {
                    $prevByG[$g] = $bestByG[$g] ?? null;
                    $bestByG[$g] = $val;
                    if (!in_array('Gesamtbestleistung', $labels) && !in_array('Erste Gesamtleistung', $labels)) {
                        $isFirst = $prevByG[$g] === null;
                        $labels[] = $isFirst
                            ? (($g === 'M') ? 'Erstes Ergebnis Männer' : 'Erstes Ergebnis Frauen')
                            : (($g === 'M') ? 'Bestleistung Männer' : 'Bestleistung Frauen');
                        if ($vorher === null) $vorher = $prevByG[$g];
                    }
                }
            }
            // 3. Altersklasse
            if ($ak) {
                if (!isset($bestByAK[$ak]) ||
                    ($dir === 'ASC'  && $val < $bestByAK[$ak]) ||
                    ($dir === 'DESC' && $val > $bestByAK[$ak])) {
                    $prevByAK[$ak] = $bestByAK[$ak] ?? null;
                    $bestByAK[$ak] = $val;
                    if (empty($labels)) {
                        $isFirst = $prevByAK[$ak] === null;
                        $labels[] = $isFirst ? 'Erste Leistung ' . $ak : 'Bestleistung ' . $ak;
                        if ($vorher === null) $vorher = $prevByAK[$ak];
                    }
                }
            }
            // 4. Persönliche Bestleistung des Athleten
            $aid = $e['athlet_id'];
            if (!isset($bestByAthlet[$aid]) ||
                ($dir === 'ASC'  && $val < $bestByAthlet[$aid]) ||
                ($dir === 'DESC' && $val > $bestByAthlet[$aid])) {
                $prevByAthlet[$aid] = $bestByAthlet[$aid] ?? null;
                $bestByAthlet[$aid] = $val;
                if (empty($labels)) {
                    $isFirst = $prevByAthlet[$aid] === null;
                    $labels[] = $isFirst ? 'Deb&uuml;t' : 'Pers&ouml;nliche Bestleistung';
                    if ($vorher === null) $vorher = $prevByAthlet[$aid];
                }
            }

            if (!empty($labels)) {
                $prio = (in_array('Gesamtbestleistung', $labels) || in_array('Erste Gesamtleistung', $labels)) ? 0
                      : (in_array('Bestleistung Männer', $labels) || in_array('Bestleistung Frauen', $labels) || in_array('Erstes Ergebnis Männer', $labels) || in_array('Erstes Ergebnis Frauen', $labels) ? 1
                      : (in_array('Pers&ouml;nliche Bestleistung', $labels) || in_array('Deb&uuml;t', $labels) ? 3 : 2));
                // vorher_resultat: numerischen Wert zurück in Rohformat umrechnen ist komplex –
                // wir geben stattdessen den val-Wert (Sekunden/Meter) zurück; Frontend formatiert ihn
                $timelineEvents[] = [
                    'datum'          => $datum,
                    'disziplin'      => $disz,
                    'athlet'         => $e['athlet'],
                    'athlet_id'      => $e['athlet_id'],
                    'resultat'       => $e['resultat'],
                    'vorher_val'     => $vorher,   // numerischer Vorher-Wert (null = erstes Ergebnis)
                    'label'          => implode(' + ', $labels),
                    'fmt'            => $fmt,
                    'priority'       => $prio,
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
             LEFT JOIN " . DB::tbl('disziplin_mapping') . " m ON m.disziplin = pb.disziplin
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
                'label'     => 'Pers&ouml;nliche Bestleistung',
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
         LEFT JOIN " . DB::tbl('disziplin_mapping') . " m ON m.disziplin=e.disziplin
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
                $kd = DB::fetchAll("SELECT disziplin FROM " . DB::tbl('disziplin_mapping') . " WHERE kategorie_id=?", [$kat_row['id']]);
                $knames = array_column($kd, 'disziplin');
                if ($knames) { $where[] = "e.disziplin IN (".implode(',',array_fill(0,count($knames),'?')).")"; $params = array_merge($params, $knames); }
                else { $where[] = '0=1'; }
            }
        }
        if (!empty($_GET['disziplin'])) {
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
            $where[] = 'e.meisterschaft IS NOT NULL';
        }

        $sort   = 'v.datum DESC, e.id DESC';
        $limit  = min((int)($_GET['limit'] ?? 100), 500);
        $offset = (int)($_GET['offset'] ?? 0);

        // Disziplin-Spalte je nach Tabelle
        $diszCol = 'e.disziplin';
        $extraCols = '';
        if ($unified) {
            // Einheitliche Tabelle: pace + distanz immer vorhanden, ak_platz_meisterschaft nicht
            $extraCols = "e.pace, e.distanz, NULL AS ak_platz_meisterschaft,";
        } else {
            $extraCols = ($res==='strasse' ? "e.pace, e.distanz, e.ak_platz_meisterschaft," : "");
        }

        $sql = "SELECT e.id, a.name_nv AS athlet, a.id AS athlet_id, e.altersklasse,
                       e.disziplin, e.resultat,
                       $extraCols
                       e.ak_platzierung, e.meisterschaft,
                       v.kuerzel AS veranstaltung, v.datum, v.ort,
                       b.benutzername AS eingetragen_von, e.erstellt_am,
                       COALESCE(dm.fmt_override, dk.fmt) AS fmt
                FROM $tbl e
                JOIN " . DB::tbl('athleten') . " a ON a.id=e.athlet_id
                JOIN " . DB::tbl('veranstaltungen') . " v ON v.id=e.veranstaltung_id
                LEFT JOIN " . DB::tbl('benutzer') . " b ON b.id=e.erstellt_von
                LEFT JOIN " . DB::tbl('disziplin_mapping') . " dm ON dm.disziplin=e.disziplin
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
                if ($kr) { $kd=DB::fetchAll("SELECT disziplin FROM " . DB::tbl('disziplin_mapping') . " WHERE kategorie_id=?",[$kr['id']]); $kn=array_column($kd,'disziplin'); if ($kn) { $w[]="e.disziplin IN (".implode(',',array_fill(0,count($kn),'?')).")"; $p=array_merge($p,$kn); } else { $w[]='0=1'; } }
            }
            if (!in_array('disziplin',$exclude) && !empty($get['disziplin']))  { $w[]='e.disziplin=?';    $p[]=$get['disziplin']; }
            return array($w, $p);
        };
        $jn = "JOIN " . DB::tbl('athleten') . " a ON a.id=e.athlet_id JOIN " . DB::tbl('veranstaltungen') . " v ON v.id=e.veranstaltung_id";

        // Disziplin-Dropdown: alle Filter aktiv außer disziplin; wenn Kategorie aktiv, schränkt sie ein
        list($wd,$pd) = $buildSubWhere(array('disziplin'));
        $disziplinen = array_column(DB::fetchAll("SELECT DISTINCT e.disziplin FROM $tbl e $jn WHERE ".implode(' AND ',$wd)." ORDER BY e.disziplin", $pd), 'disziplin');

        // AK-Dropdown: alle Filter außer ak
        list($wa,$pa) = $buildSubWhere(array('ak'));
        $aks = array_column(DB::fetchAll("SELECT DISTINCT e.altersklasse FROM $tbl e $jn WHERE ".implode(' AND ',$wa)." AND e.altersklasse IS NOT NULL ORDER BY e.altersklasse", $pa), 'altersklasse');

        // Jahr-Dropdown: alle Filter außer jahr
        list($wj,$pj) = $buildSubWhere(array('jahr'));
        $jahre = array_column(DB::fetchAll("SELECT DISTINCT YEAR(v.datum) j FROM $tbl e $jn WHERE ".implode(' AND ',$wj)." ORDER BY j DESC", $pj), 'j');

        // Kategorien: alle die in den Ergebnissen vorkommen
        $kategorien = array();
        try {
            $kategorien = DB::fetchAll("SELECT k.tbl_key, k.name FROM " . DB::tbl('disziplin_kategorien') . " k WHERE EXISTS (SELECT 1 FROM " . DB::tbl('disziplin_mapping') . " m JOIN $tbl e ON e.disziplin=m.disziplin WHERE m.kategorie_id=k.id) ORDER BY k.reihenfolge, k.name");
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

        $pace    = sanitize($body['pace'] ?? '');
        $distanz = floatOrNull($body['distanz'] ?? null);
        $akpm    = intOrNull($body['ak_platz_meisterschaft'] ?? null);
        $rnum    = ($res === 'sprungwurf') ? floatOrNull($body['resultat'] ?? null) : null;
        if ($unified) {
            DB::query("INSERT INTO " . DB::tbl('ergebnisse') . " (veranstaltung_id,athlet_id,altersklasse,disziplin,distanz,resultat,resultat_num,pace,ak_platzierung,meisterschaft,ak_platz_meisterschaft,erstellt_von) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                [$vid,$aid,$ak,$disziplin,$distanz,$resultat,$rnum,$pace,$akp,$mstr,$akpm,$user['id']]);
        } elseif ($res === 'strasse') {
            DB::query("INSERT INTO " . DB::tbl('ergebnisse_strasse') . " (veranstaltung_id,athlet_id,altersklasse,disziplin,distanz,resultat,pace,ak_platzierung,meisterschaft,ak_platz_meisterschaft,erstellt_von) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                [$vid,$aid,$ak,$disziplin,$distanz,$resultat,$pace,$akp,$mstr,$akpm,$user['id']]);
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
            $pace     = sanitize($item['pace'] ?? '');
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
            // Duplikat-Check
            $dup = DB::fetchOne('SELECT id FROM ' . DB::tbl('ergebnisse') . ' WHERE veranstaltung_id=? AND athlet_id=? AND disziplin=? AND resultat=?',
                [$vid, $aid, $disziplin, $resultat]);
            if ($dup) { $skipped++; continue; }
            DB::query("INSERT INTO " . DB::tbl('ergebnisse') . " (veranstaltung_id,athlet_id,altersklasse,disziplin,resultat,pace,ak_platzierung,meisterschaft,import_quelle,erstellt_von) VALUES (?,?,?,?,?,?,?,?,?,?)",
                [$vid,$aid,$ak,$disziplin,$resultat,$pace,$akp,$mstr,$item['import_quelle'] ?? null,$user['id']]);
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
        if (isset($body['altersklasse']))  { $felder[] = 'altersklasse=?';  $params[] = sanitize($body['altersklasse']); }
        if (isset($body['disziplin']))     { $felder[] = 'disziplin=?';     $params[] = sanitize($body['disziplin']); }
        if (isset($body['resultat'])) {
            $felder[] = 'resultat=?'; $params[] = sanitize($body['resultat']);
            $rv = $body['resultat'];
            if (preg_match('/^\d+:\d/', $rv)) {
                $p = explode(':', $rv);
                $rnum = count($p) === 3 ? $p[0]*3600+$p[1]*60+$p[2] : $p[0]*60+$p[1];
            } else $rnum = floatOrNull($rv);
            $felder[] = 'resultat_num=?'; $params[] = $rnum;
        }
        if (isset($body['pace']))          { $felder[] = 'pace=?';          $params[] = sanitize($body['pace']); }
        if (isset($body['ak_platzierung'])){ $felder[] = 'ak_platzierung=?';$params[] = intOrNull($body['ak_platzierung']); }
        if (isset($body['meisterschaft'])) { $felder[] = 'meisterschaft=?'; $params[] = intOrNull($body['meisterschaft']); }
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
                        v.kuerzel AS veranstaltung, v.datum,
                        COALESCE(dm.fmt_override, dk.fmt, \'min\') AS fmt,
                        COALESCE(dk.name, \'Sonstige\') AS kat_name,
                        COALESCE(dk.reihenfolge, 99) AS kat_sort
                 FROM ' . DB::tbl('ergebnisse') . ' e
                 JOIN ' . DB::tbl('veranstaltungen') . ' v ON v.id=e.veranstaltung_id
                 LEFT JOIN ' . DB::tbl('disziplin_mapping') . ' dm ON dm.disziplin=e.disziplin
                 LEFT JOIN ' . DB::tbl('disziplin_kategorien') . ' dk ON dk.id=dm.kategorie_id
                 WHERE e.athlet_id=? ORDER BY dk.reihenfolge, v.datum DESC', [$id]);
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
            $strasse = DB::fetchAll('SELECT e.*,v.kuerzel AS veranstaltung,v.datum FROM ' . DB::tbl('ergebnisse_strasse') . ' e JOIN ' . DB::tbl('veranstaltungen') . ' v ON v.id=e.veranstaltung_id WHERE e.athlet_id=? ORDER BY v.datum DESC', [$id]);
            $sprint  = DB::fetchAll('SELECT e.*,v.kuerzel AS veranstaltung,v.datum FROM ' . DB::tbl('ergebnisse_sprint') . ' e JOIN ' . DB::tbl('veranstaltungen') . ' v ON v.id=e.veranstaltung_id WHERE e.athlet_id=? ORDER BY v.datum DESC', [$id]);
            $mittel  = DB::fetchAll('SELECT e.*,v.kuerzel AS veranstaltung,v.datum FROM ' . DB::tbl('ergebnisse_mittelstrecke') . ' e JOIN ' . DB::tbl('veranstaltungen') . ' v ON v.id=e.veranstaltung_id WHERE e.athlet_id=? ORDER BY v.datum DESC', [$id]);
            $sw      = DB::fetchAll('SELECT e.*,v.kuerzel AS veranstaltung,v.datum FROM ' . DB::tbl('ergebnisse_sprungwurf') . ' e JOIN ' . DB::tbl('veranstaltungen') . ' v ON v.id=e.veranstaltung_id WHERE e.athlet_id=? ORDER BY v.datum DESC', [$id]);
            jsonOk(compact('athlet','strasse','sprint','mittel','sw'));
        }
    }

    if ($method === 'POST') {
        Auth::requireEditor();
        $nv = sanitize($body['name_nv'] ?? '');
        $nn = sanitize($body['nachname'] ?? '');
        $vn = sanitize($body['vorname'] ?? '');
        if (!$nv || !$nn) jsonErr('Name erforderlich.');
        try {
            DB::query('INSERT INTO ' . DB::tbl('athleten') . ' (name_nv,nachname,vorname,geschlecht) VALUES (?,?,?,?)',
                [$nv, $nn, $vn, sanitize($body['geschlecht'] ?? '')]);
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
        if (isset($body['geburtsdatum'])){ $felder[] = 'geburtsdatum=?';$params[] = $body['geburtsdatum'] ?: null; }
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

    // Disziplinen einer Kategorie ermitteln
    $getDiszByKat = function(string $kat_key) use ($unified, $sys_tbls): array {
        // Versuche Mapping
        try {
            $kr = DB::fetchOne("SELECT id FROM " . DB::tbl('disziplin_kategorien') . " WHERE tbl_key=?", [$kat_key]);
            if ($kr) {
                $cnt = DB::fetchOne("SELECT COUNT(*) AS c FROM " . DB::tbl('disziplin_mapping') . " WHERE kategorie_id=?", [$kr['id']]);
                if ($cnt && (int)$cnt['c'] > 0) {
                    $rows = DB::fetchAll("SELECT disziplin FROM " . DB::tbl('disziplin_mapping') . " WHERE kategorie_id=? ORDER BY disziplin", [$kr['id']]);
                    return array_column($rows, 'disziplin');
                }
            }
        } catch (Exception $e) {}
        // Kein Mapping: direkt aus der richtigen Tabelle
        $tbl = $unified ? 'ergebnisse' : ($sys_tbls[$kat_key][0] ?? null);
        if (!$tbl) return [];
        try {
            $where = $unified ? "WHERE 1=1" : "WHERE 1=1"; // unified hat keine tbl-Trennung mehr
            $rows = DB::fetchAll("SELECT DISTINCT disziplin FROM $tbl WHERE disziplin IS NOT NULL AND disziplin != '' ORDER BY disziplin");
            return array_column($rows, 'disziplin');
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
        $disz = $getDiszByKat($kat);
        if (!$disz) jsonOk([]);
        $counts = [];
        foreach ($disz as $d) {
            $tbl = $getTblForDisz($d);
            $cnt = DB::fetchOne("SELECT COUNT(*) AS c FROM $tbl WHERE disziplin=?", [$d]);
            $counts[] = ['disziplin' => $d, 'cnt' => $cnt ? (int)$cnt['c'] : 0];
        }
        usort($counts, function($a,$b){ return $b['cnt'] - $a['cnt']; });
        jsonOk(array_slice($counts, 0, 5));
    }

    // GET rekorde/disziplinen?kat=
    if ($method === 'GET' && $id === 'disziplinen') {
        $kat  = $_GET['kat'] ?? '';
        $disz = $getDiszByKat($kat);
        $result = [];
        foreach ($disz as $d) {
            $tbl = $getTblForDisz($d);
            $cnt = DB::fetchOne("SELECT COUNT(*) AS c FROM $tbl WHERE disziplin=?", [$d]);
            $result[] = ['disziplin' => $d, 'cnt' => $cnt ? (int)$cnt['c'] : 0];
        }
        usort($result, function($a,$b){ return $b['cnt'] - $a['cnt']; });
        jsonOk($result);
    }

    // GET rekorde?kat=&disz=
    if ($method === 'GET' && !$id) {
        $kat  = $_GET['kat']  ?? '';
        $disz = $_GET['disz'] ?? '';
        if (!$kat || !$disz) jsonErr('kat und disz erforderlich.', 400);

        $tbl = $getTblForDisz($disz);
        $dir = $katInfo[$kat]['sort_dir'] ?? 'ASC';
        $fmt = $katInfo[$kat]['fmt']      ?? 'min';

        $nameExpr = "CONCAT(COALESCE(a.nachname,''), IF(a.vorname IS NOT NULL AND a.vorname != '', CONCAT(', ', a.vorname), ''))";
        $joinVer  = "JOIN " . DB::tbl('veranstaltungen') . " v ON v.id = e.veranstaltung_id";
        $akExpr   = "CASE
                WHEN e.altersklasse IN ('MHK','M','MU8','MU10-12','MU18','MU20','MU23','mJB','mjA','mjB','U18')
                     OR (e.altersklasse REGEXP '^M[0-9]+$' AND CAST(SUBSTRING(e.altersklasse,2) AS UNSIGNED) < 30)
                  THEN 'MHK'
                WHEN e.altersklasse IN ('WHK','W','F','WU8','WU10-U12','WU18','WU23','wjA','wjB')
                     OR (e.altersklasse REGEXP '^W[0-9]+$' AND CAST(SUBSTRING(e.altersklasse,2) AS UNSIGNED) < 30)
                  THEN 'WHK'
                ELSE e.altersklasse
              END";

        $sortCol   = ($fmt === 'm') ? "e.resultat_num" : "e.resultat";
        // Legacy-Tabellen haben resultat als VARCHAR oder FLOAT je nach Tabelle
        if (!$unified && $fmt === 'm') $sortCol = "e.resultat";
        $paceField = ($fmt === 'min' && (strpos($tbl,'strasse') !== false || $unified)) ? ", e.pace" : "";

        $top_gesamt = DB::fetchAll(
            "SELECT e.resultat $paceField, v.datum, $akExpr AS altersklasse,
                    $nameExpr AS athlet, a.id AS athlet_id, a.geschlecht
             FROM $tbl e JOIN " . DB::tbl('athleten') . " a ON a.id = e.athlet_id $joinVer
             WHERE e.disziplin=? ORDER BY $sortCol $dir LIMIT 50", [$disz]);

        $top_m = DB::fetchAll(
            "SELECT e.resultat $paceField, v.datum, $akExpr AS altersklasse,
                    $nameExpr AS athlet, a.id AS athlet_id
             FROM $tbl e JOIN " . DB::tbl('athleten') . " a ON a.id = e.athlet_id $joinVer
             WHERE e.disziplin=? AND (a.geschlecht='M' OR (a.geschlecht IS NULL AND e.altersklasse LIKE 'M%'))
             ORDER BY $sortCol $dir LIMIT 50", [$disz]);

        $top_w = DB::fetchAll(
            "SELECT e.resultat $paceField, v.datum, $akExpr AS altersklasse,
                    $nameExpr AS athlet, a.id AS athlet_id
             FROM $tbl e JOIN " . DB::tbl('athleten') . " a ON a.id = e.athlet_id $joinVer
             WHERE e.disziplin=? AND (a.geschlecht='W' OR (a.geschlecht IS NULL AND (e.altersklasse LIKE 'W%' OR e.altersklasse LIKE 'F%')))
             ORDER BY $sortCol $dir LIMIT 50", [$disz]);

        $aks_rows = DB::fetchAll(
            "SELECT DISTINCT $akExpr AS altersklasse FROM $tbl e
             WHERE e.disziplin=? AND e.altersklasse IS NOT NULL AND e.altersklasse != ''
             ORDER BY altersklasse", [$disz]);
        $all_ak = [];
        foreach ($aks_rows as $ak_row) {
            $ak_val = $ak_row['altersklasse'];
            $ak_results = DB::fetchAll(
                "SELECT e.resultat $paceField, v.datum, $akExpr AS altersklasse,
                        $nameExpr AS athlet, a.id AS athlet_id, a.geschlecht
                 FROM $tbl e JOIN " . DB::tbl('athleten') . " a ON a.id = e.athlet_id $joinVer
                 WHERE e.disziplin=? AND $akExpr=?
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
            $pace     = sanitize($item['pace'] ?? '');
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
            // Duplikat-Check
            $dup = DB::fetchOne('SELECT id FROM ' . DB::tbl('ergebnisse') . ' WHERE veranstaltung_id=? AND athlet_id=? AND disziplin=? AND resultat=?',
                [$vid, $aid, $disziplin, $resultat]);
            if ($dup) { $skipped++; continue; }
            DB::query("INSERT INTO " . DB::tbl('ergebnisse') . " (veranstaltung_id,athlet_id,altersklasse,disziplin,resultat,pace,ak_platzierung,meisterschaft,import_quelle,erstellt_von) VALUES (?,?,?,?,?,?,?,?,?,?)",
                [$vid,$aid,$ak,$disziplin,$resultat,$pace,$akp,$mstr,$item['import_quelle'] ?? null,$user['id']]);
            $imported++;
        }
        jsonOk(['imported' => $imported, 'skipped' => $skipped, 'errors' => $errors]);
    }

    if ($method === 'DELETE' && $id) {
        $cnt = DB::fetchOne("SELECT COUNT(*) AS c FROM " . DB::tbl('disziplin_mapping') . " WHERE kategorie_id=?", [$id])['c'];
        if ($cnt > 0) jsonErr('Kategorie hat noch ' . $cnt . ' zugeordnete Disziplinen. Bitte zuerst umordnen.', 409);
        // Nicht löschen wenn tbl_key einer Systemtabelle entspricht
        $kat = DB::fetchOne("SELECT tbl_key FROM " . DB::tbl('disziplin_kategorien') . " WHERE id=?", [$id]);
        $system = ['strasse','sprint','mittelstrecke','sprungwurf'];
        if ($kat && in_array($kat['tbl_key'], $system)) jsonErr('Systemkategorien können nicht gelöscht werden.', 403);
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
        // Alle bekannten Disziplinen aus der einheitlichen Ergebnistabelle
        $all_disz = [];
        try {
            $rows = DB::fetchAll("SELECT DISTINCT disziplin FROM " . DB::tbl('ergebnisse') . " WHERE disziplin IS NOT NULL AND disziplin != '' ORDER BY disziplin");
            foreach ($rows as $r) {
                $d = $r['disziplin'];
                $all_disz[$d] = ['disziplin' => $d, 'kategorie_id' => null, 'kategorie_name' => null, 'anzeige_name' => null, 'fmt_override' => null, 'kat_fmt' => null];
            }
        } catch (Exception $e) {
            // Fallback auf alte Tabellen falls Migration noch nicht gelaufen
            foreach ($_sys as $skey => $stbl) {
                try {
                    $rows = DB::fetchAll("SELECT DISTINCT disziplin FROM $stbl WHERE disziplin IS NOT NULL AND disziplin != '' ORDER BY disziplin");
                    foreach ($rows as $r) {
                        $d = $r['disziplin'];
                        if (!isset($all_disz[$d])) $all_disz[$d] = ['disziplin'=>$d,'kategorie_id'=>null,'kategorie_name'=>null,'anzeige_name'=>null,'fmt_override'=>null,'kat_fmt'=>null];
                    }
                } catch (Exception $e2) {}
            }
        }
        // Mappings drauflegen
        $mappings = DB::fetchAll(
            "SELECT m.disziplin, m.kategorie_id, m.anzeige_name, m.fmt_override, k.name AS kategorie_name, k.fmt AS kat_fmt
             FROM " . DB::tbl('disziplin_mapping') . " m JOIN " . DB::tbl('disziplin_kategorien') . " k ON k.id = m.kategorie_id");
        foreach ($mappings as $m) {
            if (isset($all_disz[$m['disziplin']])) {
                $all_disz[$m['disziplin']]['kategorie_id']   = $m['kategorie_id'];
                $all_disz[$m['disziplin']]['kategorie_name'] = $m['kategorie_name'];
                $all_disz[$m['disziplin']]['anzeige_name']   = $m['anzeige_name'];
                $all_disz[$m['disziplin']]['fmt_override']   = $m['fmt_override'];
                $all_disz[$m['disziplin']]['kat_fmt']        = $m['kat_fmt'];
            }
        }
        ksort($all_disz);
        jsonOk(array_values($all_disz));
    }

    // POST Mapping setzen (disziplin -> kategorie_id)
    if ($method === 'POST' && !$id) {
        $disziplin    = trim($body['disziplin'] ?? '');
        $kategorie_id = intval($body['kategorie_id'] ?? 0);
        if (!$disziplin || !$kategorie_id) jsonErr('disziplin und kategorie_id erforderlich.', 400);
        DB::query("INSERT INTO " . DB::tbl('disziplin_mapping') . " (disziplin, kategorie_id) VALUES (?,?)
                 ON DUPLICATE KEY UPDATE kategorie_id=VALUES(kategorie_id)", [$disziplin, $kategorie_id]);
        jsonOk(null);
    }

    // PUT Disziplin bearbeiten: anzeige_name + fmt_override
    if ($method === 'PUT' && $id) {
        $disziplin    = urldecode($id);
        $anzeige_name = isset($body['anzeige_name']) ? (trim($body['anzeige_name']) ?: null) : false;
        $fmt_override = isset($body['fmt_override']) ? (trim($body['fmt_override']) ?: null) : false;
        $neuer_name   = isset($body['neuer_name']) ? trim($body['neuer_name']) : null;

        // Spalten automatisch anlegen falls Migration noch nicht ausgeführt
        try {
            DB::query("ALTER TABLE " . DB::tbl('disziplin_mapping') . " ADD COLUMN IF NOT EXISTS anzeige_name VARCHAR(60) NULL");
            DB::query("ALTER TABLE " . DB::tbl('disziplin_mapping') . " ADD COLUMN IF NOT EXISTS fmt_override  VARCHAR(20) NULL");
        } catch (Exception $e) { /* ignorieren – Spalten existieren bereits */ }

        // Disziplin umbenennen in einheitlicher Tabelle
        if ($neuer_name && $neuer_name !== $disziplin) {
            DB::query("UPDATE " . DB::tbl('ergebnisse') . " SET disziplin=? WHERE disziplin=?", [$neuer_name, $disziplin]);
            DB::query("UPDATE " . DB::tbl('disziplin_mapping') . " SET disziplin=? WHERE disziplin=?", [$neuer_name, $disziplin]);
            $disziplin = $neuer_name;
        }

        // anzeige_name + fmt_override setzen (immer, auch wenn nur Rename)
        if ($anzeige_name !== false || $fmt_override !== false) {
            $sets = []; $params = [];
            if ($anzeige_name !== false) { $sets[] = 'anzeige_name=?'; $params[] = $anzeige_name; }
            if ($fmt_override  !== false) { $sets[] = 'fmt_override=?';  $params[] = $fmt_override;  }
            $params[] = $disziplin;
            DB::query("UPDATE " . DB::tbl('disziplin_mapping') . " SET " . implode(',', $sets) . " WHERE disziplin=?", $params);
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
            $pace     = sanitize($item['pace'] ?? '');
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
            // Duplikat-Check
            $dup = DB::fetchOne('SELECT id FROM ' . DB::tbl('ergebnisse') . ' WHERE veranstaltung_id=? AND athlet_id=? AND disziplin=? AND resultat=?',
                [$vid, $aid, $disziplin, $resultat]);
            if ($dup) { $skipped++; continue; }
            DB::query("INSERT INTO " . DB::tbl('ergebnisse') . " (veranstaltung_id,athlet_id,altersklasse,disziplin,resultat,pace,ak_platzierung,meisterschaft,import_quelle,erstellt_von) VALUES (?,?,?,?,?,?,?,?,?,?)",
                [$vid,$aid,$ak,$disziplin,$resultat,$pace,$akp,$mstr,$item['import_quelle'] ?? null,$user['id']]);
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
                    e.resultat, e.pace, e.meisterschaft, e.ak_platzierung,
                    COALESCE(m.fmt_override, k.fmt) AS fmt
             FROM $eTbl e
             JOIN " . DB::tbl('athleten') . " a ON a.id=e.athlet_id
             LEFT JOIN " . DB::tbl('disziplin_mapping') . " m ON m.disziplin=e.disziplin
             LEFT JOIN " . DB::tbl('disziplin_kategorien') . " k ON k.id=m.kategorie_id
             WHERE e.veranstaltung_id=? AND e.geloescht_am IS NULL
             ORDER BY e.disziplin, e.resultat_num ASC, e.resultat ASC",
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
        $dup = DB::fetchOne('SELECT id FROM ' . DB::tbl('ergebnisse') . ' WHERE veranstaltung_id=? AND athlet_id=? AND disziplin=? AND resultat=?',
            [$vid, $aid, $disziplin, $resultat]);
        if ($dup) { $skipped++; continue; }
        DB::query("INSERT INTO " . DB::tbl('ergebnisse') . " (veranstaltung_id,athlet_id,altersklasse,disziplin,resultat,pace,ak_platzierung,meisterschaft,import_quelle,erstellt_von) VALUES (?,?,?,?,?,?,?,?,?,?)",
            [$vid,$aid,$ak,$disziplin,$resultat,$pace,$akp,$mstr,$quelle,$user['id']]);
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
        "SELECT dm.disziplin, dk.name AS kategorie, dk.tbl_key, dk.reihenfolge
         FROM " . DB::tbl('disziplin_mapping') . " dm
         JOIN " . DB::tbl('disziplin_kategorien') . " dk ON dk.id = dm.kategorie_id
         ORDER BY dk.reihenfolge, dm.disziplin"
    );
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



jsonErr('Unbekannte Route.', 404);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'fehler' => $e->getMessage(), 'trace' => $e->getFile().':'.$e->getLine()]);
    exit;
}
