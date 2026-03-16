<?php
// NOTFALL: TOTP-Reset für gesperrten Account
// SOFORT NACH NUTZUNG LÖSCHEN!
require_once __DIR__ . '/../../includes/auth.php';
Auth::startSession();
header('Content-Type: application/json');

$token = $_GET['token'] ?? '';
// Einmal-Token: SHA256 des aktuellen Datums + fixer Salt
$expectedToken = substr(hash('sha256', date('Y-m-d') . 'statistik-emergency-2026'), 0, 16);

if ($token !== $expectedToken) {
    http_response_code(403);
    echo json_encode(['fehler' => 'Ungültiger Token. Token für heute: ' . $expectedToken]);
    exit;
}

// Alle User mit totp_aktiv=1 aber totp_secret=NULL finden und fixen
$broken = DB::fetchAll(
    'SELECT id, benutzername FROM ' . DB::tbl('benutzer') .
    ' WHERE totp_aktiv = 1 AND (totp_secret IS NULL OR totp_secret = "")'
);

foreach ($broken as $u) {
    DB::query('UPDATE ' . DB::tbl('benutzer') . ' SET totp_aktiv = 0 WHERE id = ?', [$u['id']]);
}

echo json_encode(['ok' => true, 'fixed' => $broken, 'hinweis' => 'Datei jetzt löschen!']);
