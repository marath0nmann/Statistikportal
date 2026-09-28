<?php
// htdocs/rekorde/index.php
// /rekorde/                          → Vereinsrekorde aller Kategorien
// /rekorde/<kategorie>               → Vereinsrekorde einer Kategorie
// /rekorde/<kategorie>/<disziplin>   → Bestenliste einer Disziplin
// Browser werden per JavaScript sofort zur SPA (/#rekorde/…) weitergeleitet.
// Aufbereitung: includes/seiten.php

error_reporting(0);
ini_set('display_errors', '0');

$teile = [];
try {
    require_once __DIR__ . '/../../includes/seiten.php';
    $teile = array_map(function($t) { return preg_replace('/[^a-z0-9_-]/', '', strtolower($t)); },
                       array_slice(Seiten::pfadTeile('rekorde'), 0, 2));
    Seiten::rekorde($teile);
} catch (\Throwable $e) {
    $ziel = '/#' . implode('/', array_merge(['rekorde'], $teile));
    echo '<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>Statistik</title>'
       . '<script>window.location.replace(' . json_encode($ziel) . ');</script></head>'
       . '<body><p><a href="' . htmlspecialchars($ziel, ENT_QUOTES) . '">Weiter zur App</a></p></body></html>';
}
