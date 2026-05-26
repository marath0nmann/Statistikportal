<?php
// htdocs/athlet/index.php
// OG-Tags für Athlet-Profillinks + sofortiger JS-Redirect zur SPA.
// Aufruf: /athlet/vorname-nachname → via .htaccess → index.php

error_reporting(0);
ini_set('display_errors', '0');

// Slug aus REQUEST_URI: /athlet/nadine-hillgruber → nadine-hillgruber
$uri   = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
$parts = array_values(array_filter(explode('/', $uri)));
$raw   = end($parts) ?: '';
$slug  = preg_replace('/[^a-z0-9-]/', '', strtolower($raw));
if (!$slug) $slug = preg_replace('/[^a-z0-9-]/', '', strtolower($_GET['slug'] ?? ''));

// Defaults (greifen wenn DB nicht verfügbar)
$vereinName = 'TuS Oedt';
$untertitel = 'Leichtathletik-Statistik';
$found      = null;

// Alles in einem try-catch – jeder Fehler führt zum sauberen Fallback
try {
    require_once __DIR__ . '/../../includes/db.php';
    require_once __DIR__ . '/../../includes/settings.php';

    $vereinName = Settings::get('verein_name',    'TuS Oedt');
    $untertitel = Settings::get('app_untertitel', 'Leichtathletik-Statistik');

    // geloescht_am-Spalte optional (Migration)
    try {
        $athletes = DB::fetchAll(
            'SELECT id, vorname, nachname FROM ' . DB::tbl('athleten') . ' WHERE geloescht_am IS NULL'
        );
    } catch (Exception $e) {
        $athletes = DB::fetchAll('SELECT id, vorname, nachname FROM ' . DB::tbl('athleten'));
    }

    foreach ($athletes as $a) {
        $s = strtolower(($a['vorname'] ?? '') . '-' . ($a['nachname'] ?? ''));
        $s = str_replace(['ä','ö','ü','ß'], ['ae','oe','ue','ss'], $s);
        $s = preg_replace('/[^a-z0-9]+/', '-', $s);
        if ($s === $slug) { $found = $a; break; }
    }
} catch (Exception $e) {
    // DB nicht erreichbar → Fallback-Titel
}

$proto    = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$siteUrl  = $proto . '://' . ($_SERVER['HTTP_HOST'] ?? 'statistik.tus-oedt.de');
$spaUrl   = $siteUrl . '/#athlet/' . $slug;
$canonUrl = $siteUrl . '/athlet/' . $slug;

if ($found) {
    $name  = trim(($found['vorname'] ?? '') . ' ' . ($found['nachname'] ?? ''));
    $title = $vereinName . ' – ' . $untertitel . ' – ' . $name;
    $desc  = 'Athletenprofil von ' . $name . ' · ' . $vereinName . ' ' . $untertitel;
} else {
    $title = $vereinName . ' – ' . $untertitel;
    $desc  = $untertitel . ' des ' . $vereinName;
}

function _h(string $s): string { return htmlspecialchars($s, ENT_QUOTES, 'UTF-8'); }
?>
<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title><?= _h($title) ?></title>
<meta property="og:title"       content="<?= _h($title) ?>">
<meta property="og:description" content="<?= _h($desc) ?>">
<meta property="og:url"         content="<?= _h($canonUrl) ?>">
<meta property="og:type"        content="profile">
<meta property="og:site_name"   content="<?= _h($vereinName) ?>">
<meta name="twitter:card"        content="summary">
<meta name="twitter:title"       content="<?= _h($title) ?>">
<meta name="twitter:description" content="<?= _h($desc) ?>">
<link rel="canonical" href="<?= _h($canonUrl) ?>">
<script>window.location.replace(<?= json_encode($spaUrl) ?>);</script>
</head>
<body>
<p>Weiterleitung zu <a href="<?= _h($spaUrl) ?>">Athletenprofil</a>&hellip;</p>
</body>
</html>
