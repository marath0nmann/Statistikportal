<?php
// includes/helfer.php
// Gemeinsame Hilfsfunktionen für die REST-API (api/index.php) und die
// serverseitig gerenderten Seiten (includes/seiten.php).
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/settings.php';

function diszSortKey(string $s): float {
    $n = preg_replace('/\.(?=\d{3}(?:\D|$))/', '', $s);
    if (preg_match('/^([\d]+(?:[.,]\d+)?)\s*(km|m)/i', $n, $m)) {
        $num = (float)str_replace(',', '.', $m[1]);
        return strtolower($m[2]) === 'km' ? $num * 1000 : $num;
    }
    return PHP_INT_MAX;
}

function sortDisziplinen(array &$arr, string $key = 'disziplin'): void {
    usort($arr, function($a, $b) use ($key) {
        $ka = diszSortKey($a[$key] ?? '');
        $kb = diszSortKey($b[$key] ?? '');
        if ($ka !== $kb) return $ka <=> $kb;
        return strcmp($a[$key] ?? '', $b[$key] ?? '');
    });
}

// Hilfsfunktion: AK-CASE-Expression aus Settings oder Fallback-Hardcode
function buildAkCaseExpr(bool $merge, string $alias = 'e'): string {
    if (!$merge) return $alias . '.altersklasse';

    // jugend_aks zuerst laden (haben Priorität vor ak_mapping)
    $jugendAksJson = Settings::get('jugend_aks') ?: '';
    $jugendAks = $jugendAksJson ? (json_decode($jugendAksJson, true) ?: []) : [];
    if (empty($jugendAks)) {
        $jugendAks = ['MHK','M','MU8','MU10-12','MU18','MU20','MU23','mJB','mjA','mjB','U18',
                      'WHK','W','F','WU8','WU10-U12','WU18','WU23','wjA','wjB'];
    }
    $mAks = []; $wAks = [];
    foreach ($jugendAks as $ak) {
        if (strtoupper(substr($ak,0,1)) === 'W' || in_array($ak, ['F'])) $wAks[] = $ak;
        else $mAks[] = $ak;
    }

    // ak_mapping: Normalisierung von Nicht-Standard-AKs; jugend_aks-Zielwerte werden
    // direkt zu MHK/WHK aufgelöst, damit jugend_aks nicht durch ak_mapping umgangen wird.
    $mappingCases = '';
    try {
        $maps = DB::fetchAll("SELECT ak_roh, ak_standard FROM " . DB::tbl('ak_mapping'));
        foreach ($maps as $m) {
            $roh = addslashes($m['ak_roh']);
            $std = $m['ak_standard'];
            if (in_array($std, $mAks)) {
                $mappingCases .= "WHEN $alias.altersklasse='" . $roh . "' THEN 'MHK'\n        ";
            } elseif (in_array($std, $wAks)) {
                $mappingCases .= "WHEN $alias.altersklasse='" . $roh . "' THEN 'WHK'\n        ";
            } else {
                $mappingCases .= "WHEN $alias.altersklasse='" . $roh . "' THEN '" . addslashes($std) . "'\n        ";
            }
        }
    } catch (Exception $e) {}

    $mList = implode("','", array_map('addslashes', $mAks));
    $wList = implode("','", array_map('addslashes', $wAks));
    // jugend_aks IN-Clauses kommen VOR ak_mapping, damit explizit konfigurierte
    // Jugend-AKs nicht durch einen ak_mapping-Eintrag (z.B. AK→AK selbst) blockiert werden.
    return "CASE\n        "
        . "WHEN $alias.altersklasse IN ('$mList') THEN 'MHK'\n"
        . "        WHEN $alias.altersklasse IN ('$wList') THEN 'WHK'\n"
        . "        {$mappingCases}"
        . "ELSE $alias.altersklasse END";
}
