<?php
// htdocs/veranstaltung/index.php
// /veranstaltung/<id> → Veranstaltung mit allen Vereinsergebnissen als Textfassung,
// /veranstaltung/     → Veranstaltungen eines Jahres (?jahr=YYYY).
// Browser werden per JavaScript sofort zur SPA (/#veranstaltung/<id>) weitergeleitet.
// Aufbereitung: includes/seiten.php

error_reporting(0);
ini_set('display_errors', '0');

$id = '';
try {
    require_once __DIR__ . '/../../includes/seiten.php';
    $teile = Seiten::pfadTeile('veranstaltung');
    $id    = preg_match('/^\d+/', $teile[0] ?? '', $m) ? $m[0] : '';
    Seiten::veranstaltung($id);
} catch (\Throwable $e) {
    $ziel = '/#' . ($id !== '' ? 'veranstaltung/' . $id : 'veranstaltungen');
    echo '<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>Statistik</title>'
       . '<script>window.location.replace(' . json_encode($ziel) . ');</script></head>'
       . '<body><p><a href="' . htmlspecialchars($ziel, ENT_QUOTES) . '">Weiter zur App</a></p></body></html>';
}
