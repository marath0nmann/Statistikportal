<?php
// NOTFALL-DIAGNOSE – SOFORT NACH NUTZUNG LÖSCHEN!
require_once __DIR__ . '/../../includes/auth.php';
Auth::startSession();
header('Content-Type: application/json');

$token = $_GET['token'] ?? '';
$expectedToken = substr(hash('sha256', date('Y-m-d') . 'statistik-emergency-2026'), 0, 16);
if ($token !== $expectedToken) {
    http_response_code(403);
    echo json_encode(['fehler' => 'Ungültiger Token.', 'token_heute' => $expectedToken]);
    exit;
}

// DB-Status aller User
$users = DB::fetchAll('SELECT id, benutzername, totp_aktiv, totp_secret IS NULL AS secret_null FROM ' . DB::tbl('benutzer'));

// Passkeys-Tabelle prüfen
$passkeys = [];
try {
    Passkey::migrate();
    $passkeys = DB::fetchAll('SELECT id, user_id, name, credential_id FROM ' . DB::tbl('passkeys'));
} catch (Exception $e) {
    $passkeys = ['error' => $e->getMessage()];
}

// has_passkey pro User
$hasPasskeyMap = [];
foreach ($users as $u) {
    try {
        $hasPasskeyMap[$u['benutzername']] = Passkey::userHasPasskey($u['id']);
    } catch (Exception $e) {
        $hasPasskeyMap[$u['benutzername']] = 'ERROR: ' . $e->getMessage();
    }
}

echo json_encode([
    'users'        => $users,
    'passkeys'     => $passkeys,
    'has_passkey'  => $hasPasskeyMap,
], JSON_PRETTY_PRINT);
