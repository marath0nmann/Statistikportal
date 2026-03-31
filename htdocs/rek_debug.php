<?php
// Statistikportal – Rekorde Debug – NACH TEST LÖSCHEN
ini_set('display_errors', 1);
error_reporting(E_ALL);
require_once __DIR__ . '/../includes/db.php';

header('Content-Type: text/plain; charset=utf-8');

// 1. MariaDB-Version
$v = DB::fetchOne('SELECT VERSION() AS v');
echo "MariaDB Version: " . $v['v'] . "\n\n";

// 2. Tabellen prüfen
foreach (['ergebnisse_strasse','ergebnisse_sprint','ergebnisse_mittelstrecke','ergebnisse_sprungwurf'] as $tbl) {
    $cnt = DB::fetchOne("SELECT COUNT(*) AS c FROM $tbl");
    echo "$tbl: " . $cnt['c'] . " Zeilen\n";
}

echo "\n";

// 3. CONCAT testen
try {
    $r = DB::fetchOne("SELECT CONCAT(COALESCE(nachname,''), IF(vorname IS NOT NULL AND vorname != '', CONCAT(', ', vorname), '')) AS name FROM athleten LIMIT 1");
    echo "CONCAT Test: OK – " . $r['name'] . "\n";
} catch (Exception $e) {
    echo "CONCAT FEHLER: " . $e->getMessage() . "\n";
}

// 4. Disziplinen abfragen
try {
    $rows = DB::fetchAll("SELECT DISTINCT disziplin FROM ergebnisse_strasse WHERE disziplin IS NOT NULL AND disziplin != '' ORDER BY disziplin");
    echo "\nDisziplinen Straße: " . implode(', ', array_column($rows, 'disziplin')) . "\n";
} catch (Exception $e) {
    echo "Disziplinen FEHLER: " . $e->getMessage() . "\n";
}

// 5. Top10 Test
try {
    $rows = DB::fetchAll("SELECT e.resultat, e.datum FROM ergebnisse_strasse e WHERE e.disziplin = '10km Straße' ORDER BY e.resultat ASC LIMIT 3");
    echo "\nTop3 10km Straße:\n";
    foreach ($rows as $r) echo "  " . $r['resultat'] . " – " . $r['datum'] . "\n";
} catch (Exception $e) {
    echo "Top10 FEHLER: " . $e->getMessage() . "\n";
}

// 6. ROW_NUMBER Test
try {
    $rows = DB::fetchAll("SELECT sub.* FROM (
        SELECT e.altersklasse, e.resultat,
               ROW_NUMBER() OVER (PARTITION BY e.altersklasse ORDER BY e.resultat ASC) AS rn
        FROM ergebnisse_strasse e
        WHERE e.disziplin = '10km Straße' AND e.altersklasse IS NOT NULL
    ) sub WHERE rn <= 2 LIMIT 6");
    echo "\nROW_NUMBER Test: OK – " . count($rows) . " Zeilen\n";
} catch (Exception $e) {
    echo "ROW_NUMBER FEHLER: " . $e->getMessage() . "\n";
}
