<?php
// ============================================================
// Migrations – kleiner Runner für idempotente DB-Migrationen.
// Wird per Stub aus Login/Planung/Training mitgeladen.
//
// Aufrufer übergibt einen Settings-Versionskey (z. B. "plan_db_version")
// und ein Array [versionsnummer => stmts]. stmts ist entweder eine Liste
// SQL-Strings oder eine Closure für komplexe PHP-Migrationen.
//
// Beispiel:
//   Migrations::run('plan_db_version', [
//       1 => ['CREATE TABLE IF NOT EXISTS … (…)'],
//       2 => ['ALTER TABLE … ADD COLUMN …'],
//       3 => function () { /* eigene Logik */ },
//   ]);
// ============================================================

class Migrations {
    public static function run(string $versionKey, array $migs): void {
        static $done = [];
        if (isset($done[$versionKey])) return;
        $done[$versionKey] = true;

        if (!$migs) return;
        ksort($migs); // aufsteigende Reihenfolge erzwingen

        $current = (int) Settings::get($versionKey, '0');
        if ($current >= max(array_keys($migs))) return; // Fast-Path

        foreach ($migs as $num => $stmts) {
            if ($num <= $current) continue;
            if (is_callable($stmts)) {
                try { $stmts(); }
                catch (Throwable $e) { error_log("[$versionKey {$num}] " . $e->getMessage()); }
            } else {
                foreach ((array)$stmts as $sql) {
                    try { DB::query($sql); }
                    catch (Throwable $e) { error_log("[$versionKey {$num}] " . $e->getMessage()); }
                }
            }
            Settings::set($versionKey, (string) $num);
            $current = $num;
        }
    }
}
