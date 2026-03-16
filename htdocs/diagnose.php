<?php
// ============================================================
// Leichtathletik-Statistik – Diagnose-Tool
// NACH dem Test diese Datei UNBEDINGT löschen!
// ============================================================
$checks = [];

// 1. PHP-Version
$phpOk = version_compare(PHP_VERSION, '8.0.0', '>=');
$checks[] = ['PHP-Version', PHP_VERSION, $phpOk, $phpOk ? 'OK' : 'Mindestens PHP 8.0 benötigt → im KAS PHP-Version umstellen'];

// 2. PDO MySQL
$pdoOk = extension_loaded('pdo_mysql');
$checks[] = ['PDO MySQL Extension', $pdoOk ? 'Verfügbar' : 'FEHLT', $pdoOk, $pdoOk ? 'OK' : 'PDO MySQL nicht geladen – bei all-inkl normalerweise aktiv'];

// 3. config.php lesbar?
$configPath = __DIR__ . '/../includes/config.php';
$configOk = file_exists($configPath);
$checks[] = ['includes/config.php', $configOk ? 'Gefunden' : 'NICHT GEFUNDEN', $configOk, $configOk ? 'OK' : 'Datei fehlt oder falscher Pfad'];

// 4. Datenbank-Verbindung testen
$dbOk = false; $dbMsg = 'config.php nicht geladen';
if ($configOk) {
    require_once $configPath;
    try {
        $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', DB_HOST, DB_PORT, DB_NAME);
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
        $dbOk = true;
        $dbMsg = 'Verbindung erfolgreich zu: ' . DB_NAME;
    } catch (Exception $e) {
        $dbMsg = 'FEHLER: ' . $e->getMessage();
    }
}
$checks[] = ['Datenbankverbindung', $dbMsg, $dbOk, $dbOk ? 'OK' : 'Zugangsdaten in includes/config.php prüfen'];

// 5. Tabellen vorhanden?
$tablesOk = false; $tablesMsg = 'DB-Verbindung nötig';
if ($dbOk) {
    $tables = $pdo->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);
    $needed = ['benutzer','athleten','veranstaltungen','ergebnisse_strasse','ergebnisse_sprint','ergebnisse_mittelstrecke','ergebnisse_sprungwurf','vereinsrekorde'];
    $missing = array_diff($needed, $tables);
    $tablesOk = empty($missing);
    $tablesMsg = $tablesOk
        ? count($tables) . ' Tabellen gefunden'
        : 'Fehlend: ' . implode(', ', $missing) . ' → schema.sql importieren!';
}
$checks[] = ['Datenbanktabellen', $tablesMsg, $tablesOk, $tablesOk ? 'OK' : 'sql/schema.sql in phpMyAdmin importieren'];

// 6. Datensätze?
$dataMsg = '–';
if ($tablesOk) {
    $n = $pdo->query("SELECT COUNT(*) FROM ergebnisse_strasse")->fetchColumn();
    $nb = $pdo->query("SELECT COUNT(*) FROM benutzer")->fetchColumn();
    $na = $pdo->query("SELECT COUNT(*) FROM athleten")->fetchColumn();
    $dataMsg = "Straße: $n | Benutzer: $nb | Athleten: $na";
    if ($n == 0) $dataMsg .= ' → import_data.sql noch importieren!';
}
$checks[] = ['Daten in DB', $dataMsg, $tablesOk && $n > 0, ($tablesOk && $n > 0) ? 'OK' : 'sql/import_data.sql importieren'];

// 7. .htaccess / mod_rewrite
$htOk = file_exists(__DIR__ . '/.htaccess');
$checks[] = ['.htaccess', $htOk ? 'Vorhanden' : 'FEHLT', $htOk, $htOk ? 'OK' : '.htaccess-Datei hochladen'];

// 8. api/ erreichbar
$apiOk = file_exists(__DIR__ . '/api/index.php');
$checks[] = ['api/index.php', $apiOk ? 'Vorhanden' : 'FEHLT', $apiOk, $apiOk ? 'OK' : 'api/index.php hochladen'];

// 9. Sessions funktionieren?
session_start();
$_SESSION['test'] = 'ok';
$sessOk = ($_SESSION['test'] === 'ok');
$checks[] = ['PHP Sessions', $sessOk ? 'Funktionieren' : 'FEHLER', $sessOk, 'OK'];

$allOk = !in_array(false, array_column($checks, 2));
?>
<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<title>Statistikportal – Diagnose</title>
<style>
  body { font-family: Arial, sans-serif; max-width: 760px; margin: 40px auto; padding: 0 20px; background: #f4f6fa; color: #1a2340; }
  h1 { color: #003087; border-bottom: 3px solid #cc0000; padding-bottom: 10px; }
  .card { background: #fff; border-radius: 10px; padding: 24px; box-shadow: 0 2px 12px rgba(0,48,135,.1); margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #003087; color: #fff; padding: 10px 14px; text-align: left; font-size: 13px; }
  td { padding: 10px 14px; border-bottom: 1px solid #e8ecf5; font-size: 13px; vertical-align: top; }
  tr:last-child td { border: none; }
  .ok   { color: #1a8a3a; font-weight: 700; }
  .err  { color: #cc0000; font-weight: 700; }
  .tag-ok  { background: #d4edda; color: #1a8a3a; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; }
  .tag-err { background: #fde8e8; color: #cc0000; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; }
  .banner { padding: 16px 20px; border-radius: 8px; font-weight: 700; margin-bottom: 20px; font-size: 15px; }
  .banner-ok  { background: #d4edda; color: #1a8a3a; border: 1px solid #a3d9b1; }
  .banner-err { background: #fde8e8; color: #cc0000; border: 1px solid #f5b0b0; }
  .warn { background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 12px 16px; font-size: 13px; margin-top: 16px; }
  code { background: #f0f2f8; padding: 1px 6px; border-radius: 3px; font-size: 12px; }
</style>
</head>
<body>
<h1>🔍 Statistikportal – Diagnose</h1>

<div class="banner <?= $allOk ? 'banner-ok' : 'banner-err' ?>">
  <?= $allOk ? '✅ Alle Checks bestanden – die App sollte funktionieren!' : '❌ Es gibt Probleme – Details in der Tabelle unten' ?>
</div>

<div class="card">
  <table>
    <thead><tr><th>Check</th><th>Status</th><th>Details / Lösung</th></tr></thead>
    <tbody>
      <?php foreach ($checks as [$name, $val, $ok, $fix]): ?>
      <tr>
        <td><strong><?= htmlspecialchars($name) ?></strong></td>
        <td><span class="<?= $ok ? 'tag-ok' : 'tag-err' ?>"><?= $ok ? '✓ OK' : '✗ FEHLER' ?></span></td>
        <td>
          <span class="<?= $ok ? 'ok' : 'err' ?>"><?= htmlspecialchars($val) ?></span>
          <?php if (!$ok): ?><br><small style="color:#555"><?= htmlspecialchars($fix) ?></small><?php endif; ?>
        </td>
      </tr>
      <?php endforeach; ?>
    </tbody>
  </table>
</div>

<div class="warn">
  ⚠️ <strong>Sicherheitshinweis:</strong> Diese Datei (<code>diagnose.php</code>) nach dem Test sofort löschen!
  Sie zeigt interne Systeminformationen.
</div>

<div class="card" style="margin-top:20px">
  <strong>Serverinfo:</strong><br>
  PHP: <?= PHP_VERSION ?> |
  Server: <?= $_SERVER['SERVER_SOFTWARE'] ?? 'unbekannt' ?> |
  Dokument-Root: <?= $_SERVER['DOCUMENT_ROOT'] ?? '–' ?><br>
  Aktuelle Datei: <?= __FILE__ ?>
</div>
</body>
</html>
