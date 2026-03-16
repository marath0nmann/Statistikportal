<?php
// ============================================================
// Leichtathletik-Statistik – Passwort zurücksetzen
// NACH dem Test sofort löschen!
// ============================================================
require_once __DIR__ . '/../includes/db.php';

$msg = '';
$newHash = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $pw = $_POST['passwort'] ?? '';
    $pw2 = $_POST['passwort2'] ?? '';

    if (strlen($pw) < 8) {
        $msg = '<p style="color:#cc0000">❌ Passwort muss mindestens 8 Zeichen haben.</p>';
    } elseif ($pw !== $pw2) {
        $msg = '<p style="color:#cc0000">❌ Passwörter stimmen nicht überein.</p>';
    } else {
        $newHash = password_hash($pw, PASSWORD_BCRYPT, ['cost' => 12]);
        DB::query('UPDATE benutzer SET passwort = ? WHERE benutzername = ?', [$newHash, 'admin']);
        $msg = '<p style="color:#1a8a3a;font-weight:700">✅ Passwort für "admin" erfolgreich gesetzt!</p>';
    }
}
?>
<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><title>Passwort zurücksetzen</title>
<style>
  body { font-family: Arial, sans-serif; max-width: 480px; margin: 60px auto; padding: 0 20px; background: #f4f6fa; }
  h1 { color: #003087; }
  .card { background: #fff; border-radius: 10px; padding: 28px; box-shadow: 0 2px 8px rgba(0,0,0,.1); }
  label { display: block; font-size: 12px; font-weight: 700; color: #5a6a8a; text-transform: uppercase; margin-bottom: 4px; }
  input { width: 100%; padding: 9px 12px; border: 1.5px solid #d0d8e8; border-radius: 7px; font-size: 14px; margin-bottom: 14px; box-sizing: border-box; }
  button { background: #003087; color: #fff; border: none; padding: 11px 28px; border-radius: 7px; cursor: pointer; font-size: 15px; font-weight: 700; }
  .warn { background: #fff3cd; border: 1px solid #ffc107; border-radius: 6px; padding: 10px 14px; font-size: 13px; margin-top: 20px; }
</style>
</head>
<body>
<h1>🔑 Passwort zurücksetzen</h1>
<div class="card">
  <?= $msg ?>
  <form method="POST">
    <label>Neues Passwort (min. 8 Zeichen)</label>
    <input type="password" name="passwort" placeholder="Neues Passwort" autofocus>
    <label>Passwort wiederholen</label>
    <input type="password" name="passwort2" placeholder="Wiederholen">
    <button type="submit">Passwort setzen</button>
  </form>
  <?php if ($newHash): ?>
    <p style="margin-top:16px;font-size:12px;color:#5a6a8a">Erzeugter Hash: <code><?= htmlspecialchars(substr($newHash,0,30)) ?>…</code></p>
  <?php endif; ?>
</div>
<div class="warn">⚠️ Diese Datei (<code>pw_reset.php</code>) nach dem Setzen des Passworts sofort löschen!</div>
</body>
</html>
