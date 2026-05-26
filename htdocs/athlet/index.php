<?php
// htdocs/athlet/index.php
// Aufgerufen für /athlet/vorname-nachname (via .htaccess im gleichen Verzeichnis)
// Liefert Open-Graph-Tags + JavaScript-Redirect zur SPA.
// Crawler (WhatsApp, Telegram …) sehen den richtigen Seitentitel.

error_reporting(0);
ini_set('display_errors', '0');

// Slug aus REQUEST_URI lesen: /athlet/nadine-hillgruber → nadine-hillgruber
$uri   = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH);
$parts = array_values(array_filter(explode('/', $uri)));
// Letztes Segment nach /athlet/
$raw   = end($parts) ?: '';
$slug  = preg_replace('/[^a-z0-9-]/', '', strtolower($raw));
// Fallback: ?slug=... (falls doch per Query aufgerufen)
if (!$slug) $slug = preg_replace('/[^a-z0-9-]/', '', strtolower($_GET['slug'] ?? ''));

require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/settings.php';

if (!function_exists('_athSlugPHP')) {
    function _athSlugPHP(string $vorname, string $nachname): string {
        $s = strtolower($vorname . '-' . $nachname);
        $s = str_replace(['ä','ö','ü','ß','Ä','Ö','Ü'], ['ae','oe','ue','ss','ae','oe','ue'], $s);
        return preg_replace('/[^a-z0-9]+/', '-', $s);
    }
}

$found = null;
try {
    $athletes = DB::fetchAll(
        'SELECT id, vorname, nachname FROM ' . DB::tbl('athleten') .
        ' WHERE geloescht_am IS NULL OR geloescht_am = ""'
    );
    foreach ($athletes as $a) {
        if (_athSlugPHP($a['vorname'] ?? '', $a['nachname'] ?? '') === $slug) {
            $found = $a; break;
        }
    }
} catch (Exception $e) {
    // DB-Fehler → Fallback-Titel
}

$vereinName = Settings::get('verein_name',    'TuS Oedt');
$untertitel = Settings::get('app_untertitel', 'Leichtathletik-Statistik');
$proto      = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$siteUrl    = $proto . '://' . ($_SERVER['HTTP_HOST'] ?? 'statistik.tus-oedt.de');
$spaUrl     = $siteUrl . '/#athlet/' . $slug;
$canonUrl   = $siteUrl . '/athlet/' . $slug;

if ($found) {
    $name  = trim(($found['vorname'] ?? '') . ' ' . ($found['nachname'] ?? ''));
    $title = $vereinName . ' – ' . $untertitel . ' – ' . $name;
    $desc  = 'Athletenprofil von ' . $name . ' · ' . $vereinName . ' ' . $untertitel;
} else {
    $title = $vereinName . ' – ' . $untertitel;
    $desc  = $untertitel . ' des ' . $vereinName;
}

$esc = fn($s) => htmlspecialchars($s, ENT_QUOTES);
?>
<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title><?= $esc($title) ?></title>
<meta property="og:title"       content="<?= $esc($title) ?>">
<meta property="og:description" content="<?= $esc($desc) ?>">
<meta property="og:url"         content="<?= $esc($canonUrl) ?>">
<meta property="og:type"        content="profile">
<meta property="og:site_name"   content="<?= $esc($vereinName) ?>">
<meta name="twitter:card"        content="summary">
<meta name="twitter:title"       content="<?= $esc($title) ?>">
<meta name="twitter:description" content="<?= $esc($desc) ?>">
<link rel="canonical" href="<?= $esc($canonUrl) ?>">
<script>window.location.replace(<?= json_encode($spaUrl) ?>);</script>
</head>
<body>
<p>Weiterleitung zu <a href="<?= $esc($spaUrl) ?>">Athletenprofil</a>&hellip;</p>
</body>
</html>
