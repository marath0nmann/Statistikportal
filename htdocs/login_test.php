<?php
// ============================================================
// TuS Oedt – Login-Test
// NACH dem Test sofort löschen!
// ============================================================
require_once __DIR__ . '/../includes/auth.php';
Auth::startSession();

header('Content-Type: text/html; charset=utf-8');

$result = null;
$rawBody = null;
$routeTest = null;

// Test 1: Route-Parsing simulieren
$testRoute = 'auth/login';
$parts = explode('/', $testRoute);
$routeTest = ['res' => $parts[0] ?? '', 'id' => $parts[1] ?? null];

// Test 2: Login direkt versuchen wenn Formular abgeschickt
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $benutzername = $_POST['benutzername'] ?? '';
    $passwort = $_POST['passwort'] ?? '';
    $result = Auth::login($benutzername, $passwort);
}

// Test 3: API-Endpunkt direkt aufrufen
$apiUrl = (isset($_SERVER['HTTPS']) ? 'https' : 'http') . '://' . $_SERVER['HTTP_HOST']
        . dirname($_SERVER['SCRIPT_NAME']) . '/api/index.php?_route=auth%2Flogin';
?>
<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><title>Login-Test</title>
<style>
  body { font-family: Arial, sans-serif; max-width: 700px; margin: 40px auto; padding: 0 20px; background: #f4f6fa; }
  h1 { color: #003087; }
  .card { background: #fff; border-radius: 10px; padding: 24px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,.1); }
  .ok  { color: #1a8a3a; font-weight: 700; }
  .err { color: #cc0000; font-weight: 700; }
  pre  { background: #f0f2f8; padding: 12px; border-radius: 6px; font-size: 12px; overflow-x: auto; }
  input { width: 100%; padding: 8px; margin: 6px 0 14px; border: 1px solid #ccc; border-radius: 6px; font-size: 14px; box-sizing: border-box; }
  button { background: #003087; color: #fff; border: none; padding: 10px 24px; border-radius: 6px; cursor: pointer; font-size: 14px; }
  .warn { background: #fff3cd; border: 1px solid #ffc107; border-radius: 6px; padding: 10px 14px; font-size: 13px; margin-top: 16px; }
</style>
</head>
<body>
<h1>🔍 Login-Test</h1>

<div class="card">
  <h3>1. Route-Parsing</h3>
  <pre>Route: "auth/login"
$res = "<?= $routeTest['res'] ?>"
$id  = "<?= $routeTest['id'] ?>"
<?= ($routeTest['res'] === 'auth' && $routeTest['id'] === 'login')
    ? '✓ Korrekt – Route wird richtig geparst'
    : '✗ FEHLER – Route wird falsch geparst' ?></pre>
</div>

<div class="card">
  <h3>2. Benutzer in Datenbank</h3>
  <?php
  try {
      require_once __DIR__ . '/../includes/db.php';
      $users = DB::fetchAll('SELECT id, benutzername, email, rolle, aktiv, LEFT(passwort,20) AS pw_start FROM benutzer');
      if ($users) {
          echo '<table border="1" cellpadding="6" cellspacing="0" style="width:100%;font-size:13px;border-collapse:collapse">';
          echo '<tr style="background:#f0f2f8"><th>ID</th><th>Benutzername</th><th>E-Mail</th><th>Rolle</th><th>Aktiv</th><th>Passwort-Hash (Anfang)</th></tr>';
          foreach ($users as $u) {
              echo "<tr><td>{$u['id']}</td><td>{$u['benutzername']}</td><td>{$u['email']}</td><td>{$u['rolle']}</td><td>" . ($u['aktiv'] ? '✓' : '✗') . "</td><td>{$u['pw_start']}…</td></tr>";
          }
          echo '</table>';
      } else {
          echo '<p class="err">Keine Benutzer in der Datenbank! import_data.sql importieren.</p>';
      }
  } catch (Exception $e) {
      echo '<p class="err">DB-Fehler: ' . htmlspecialchars($e->getMessage()) . '</p>';
  }
  ?>
</div>

<div class="card">
  <h3>3. Login direkt testen</h3>
  <?php if ($result !== null): ?>
    <p class="<?= $result['ok'] ? 'ok' : 'err' ?>">
      <?= $result['ok'] ? '✓ Login erfolgreich! Rolle: ' . $result['rolle'] : '✗ ' . htmlspecialchars($result['fehler']) ?>
    </p>
  <?php endif; ?>
  <form method="POST">
    <label>Benutzername:</label>
    <input type="text" name="benutzername" value="admin">
    <label>Passwort:</label>
    <input type="password" name="passwort" value="">
    <button type="submit">Login testen</button>
  </form>
</div>

<div class="card">
  <h3>4. API-URL für manuellen Test</h3>
  <p>Diese URL im Browser aufrufen (GET – erwartet "Nicht eingeloggt"):</p>
  <pre><a href="api/index.php?_route=auth%2Fme" target="_blank">api/index.php?_route=auth%2Fme</a></pre>
  <p>Die Login-Route erwartet einen POST – nicht per Browser-URL testbar.</p>
</div>

<div class="warn">⚠️ Diese Datei (<code>login_test.php</code>) nach dem Test sofort löschen!</div>
</body>
</html>
