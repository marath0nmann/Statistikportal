<?php
// athlet.php – Open-Graph-Tags für Athlet-Profillinks
// Wird aufgerufen via .htaccess: /athlet/vorname-nachname → athlet.php?slug=vorname-nachname
// Gibt OG-Meta-Tags aus und leitet den Browser sofort zur SPA weiter.
// Crawler (WhatsApp, Telegram, Twitter, …) sehen die korrekten Meta-Tags.

error_reporting(0);
ini_set('display_errors', '0');

require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/settings.php';

$slug = preg_replace('/[^a-z0-9-]/', '', strtolower($_GET['slug'] ?? ''));
if (!$slug) { header('Location: /'); exit; }

function _athSlugPHP(string $vorname, string $nachname): string {
    $s = strtolower($vorname . '-' . $nachname);
    $s = str_replace(['ä','ö','ü','ß','Ä','Ö','Ü'], ['ae','oe','ue','ss','ae','oe','ue'], $s);
    return preg_replace('/[^a-z0-9]+/', '-', $s);
}

$found = null;
try {
    $athletes = DB::fetchAll(
        'SELECT id, vorname, nachname FROM ' . DB::tbl('athleten') .
        ' WHERE geloescht_am IS NULL OR geloescht_am = ""'
    );
    foreach ($athletes as $a) {
        if (_athSlugPHP($a['vorname'] ?? '', $a['nachname'] ?? '') === $slug) {
            $found = $a;
            break;
        }
    }
} catch (Exception $e) {
    // DB-Fehler → stumm, Fallback-Titel
}

$vereinName  = Settings::get('verein_name',    'TuS Oedt');
$untertitel  = Settings::get('app_untertitel', 'Leichtathletik-Statistik');
$siteUrl     = rtrim((isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' ? 'https' : 'http') .
               '://' . ($_SERVER['HTTP_HOST'] ?? 'statistik.tus-oedt.de'), '/');
$spaUrl      = $siteUrl . '/#athlet/' . $slug;
$canonUrl    = $siteUrl . '/athlet/' . $slug;

if ($found) {
    $name  = trim(($found['vorname'] ?? '') . ' ' . ($found['nachname'] ?? ''));
    $title = $vereinName . ' – ' . $untertitel . ' – ' . $name;
    $desc  = 'Athletenprofil von ' . $name . ' · ' . $vereinName . ' ' . $untertitel;
} else {
    $title = $vereinName . ' – ' . $untertitel;
    $desc  = $untertitel . ' des ' . $vereinName;
}

$titleH = htmlspecialchars($title,   ENT_QUOTES);
$descH  = htmlspecialchars($desc,    ENT_QUOTES);
$canonH = htmlspecialchars($canonUrl, ENT_QUOTES);
$spaH   = htmlspecialchars($spaUrl,  ENT_QUOTES);
?>
<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title><?= $titleH ?></title>
<!-- Open Graph -->
<meta property="og:title"       content="<?= $titleH ?>">
<meta property="og:description" content="<?= $descH ?>">
<meta property="og:url"         content="<?= $canonH ?>">
<meta property="og:type"        content="profile">
<meta property="og:site_name"   content="<?= htmlspecialchars($vereinName, ENT_QUOTES) ?>">
<!-- Twitter Card -->
<meta name="twitter:card"        content="summary">
<meta name="twitter:title"       content="<?= $titleH ?>">
<meta name="twitter:description" content="<?= $descH ?>">
<!-- Canonical -->
<link rel="canonical" href="<?= $canonH ?>">
<!-- Sofort-Redirect für Browser (Crawler ignorieren JS) -->
<script>window.location.replace(<?= json_encode($spaUrl) ?>);</script>
</head>
<body>
<p>Weiterleitung zu <a href="<?= $spaH ?>">Athletenprofil</a>&hellip;</p>
</body>
</html>
