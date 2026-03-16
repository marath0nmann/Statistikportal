<?php
// NOTFALL: TOTP-Reset – SOFORT NACH NUTZUNG LÖSCHEN!
require_once __DIR__ . '/../../includes/auth.php';
Auth::startSession();
header('Content-Type: application/json');

$token = $_GET['token'] ?? '';
$expectedToken = substr(hash('sha256', date('Y-m-d') . 'statistik-emergency-2026'), 0, 16);

if ($token !== $expectedToken) {
    http_response_code(403);
    echo json_encode(['fehler' => 'Ungültiger Token.', 'token_fuer_heute' => $expectedToken]);
    exit;
}

// Alle User mit totp_aktiv=1 deaktivieren (egal ob Secret vorhanden)
$affected = DB::fetchAll(
    'SELECT id, benutzername, totp_aktiv,
     CASE WHEN totp_secret IS NULL THEN "NULL" ELSE "vorhanden" END AS secret_status
     FROM ' . DB::tbl('benutzer') . ' WHERE totp_aktiv = 1'
);

foreach ($affected as $u) {
    DB::query(
        'UPDATE ' . DB::tbl('benutzer') .
        ' SET totp_aktiv = 0, totp_secret = NULL, totp_pending = NULL WHERE id = ?',
        [$u['id']]
    );
}

echo json_encode([
    'ok'      => true,
    'fixed'   => $affected,
    'hinweis' => 'SOFORT LOESCHEN: /api/emergency_totp_reset.php'
]);
