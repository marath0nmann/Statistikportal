<?php
// htdocs/athlet/index.php
// /athlet/<vorname-nachname> → Athletenprofil als Textfassung + OG-Tags,
// /athlet/                   → Liste der aktiven Athleten.
// Browser werden per JavaScript sofort zur SPA (/#athlet/<slug>) weitergeleitet.
// Aufbereitung: includes/seiten.php

error_reporting(0);
ini_set('display_errors', '0');

$teile = [];
$slug  = '';
try {
    require_once __DIR__ . '/../../includes/seiten.php';
    $teile = Seiten::pfadTeile('athlet');
    $slug  = preg_replace('/[^a-z0-9-]/', '', strtolower($teile[0] ?? ($_GET['slug'] ?? '')));
    Seiten::athlet($slug);
} catch (\Throwable $e) {
    // DB nicht erreichbar o.ä. → nur Weiterleitung
    $ziel = '/#' . ($slug !== '' ? 'athlet/' . $slug : 'athleten');
    echo '<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>Statistik</title>'
       . '<script>window.location.replace(' . json_encode($ziel) . ');</script></head>'
       . '<body><p><a href="' . htmlspecialchars($ziel, ENT_QUOTES) . '">Weiter zur App</a></p></body></html>';
}
