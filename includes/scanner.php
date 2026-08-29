<?php
// ============================================================
// Gemeinsame Helfer der Ergebnis-Scanner
// ------------------------------------------------------------
// RaceResult (includes/raceresult.php) und uitslagen.nl
// (includes/uitslagen.php) melden Funde in derselben Form. Die
// Aufbereitung für die Eintragen-Seite – Athletenzuordnung, Abgleich
// gegen bereits erfasste Ergebnisse, Gruppierung nach Wettkampf – ist
// für beide identisch und steht deshalb hier, ebenso der Fortschritt
// eines laufenden Scans und die Reduktion der Abfragebegriffe.
// ============================================================

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/settings.php';

class Scanner {

    // ── Fortschritt eines laufenden Scans ────────────────────────────────
    // Ein Scanlauf dauert Minuten (jeder Abruf hält 1,15 s Abstand). Ohne
    // Zwischenstand sieht weder das Admin-Panel noch ein Cronjob-Log, wo er
    // gerade steht – und bricht der Lauf ab, bleibt gar keine Spur zurück.
    // Deshalb nach jedem Schritt eine Zeile schreiben; das ist ein einzelner
    // kleiner UPDATE gegenüber ~11 s Netzwerkarbeit je Wettkampf.
    //
    // $key    'rr_scan_fortschritt' | 'uits_scan_fortschritt'
    // $daten  ['phase'=>…, 'i'=>…, 'gesamt'=>…, 'aktuell'=>…, …]
    public static function fortschritt(string $key, array $daten): void {
        $daten['aktualisiert'] = date('Y-m-d H:i:s');
        try { Settings::set($key, json_encode($daten, JSON_UNESCAPED_UNICODE)); } catch (Throwable $e) {}
    }

    // Gemeldeter Stand; 'laeuft' ist false, sobald die Phase abgeschlossen
    // ist oder sich seit 3 Minuten nichts mehr getan hat (abgestürzter Lauf).
    public static function fortschrittLesen(string $key): ?array {
        $roh = Settings::get($key, '');
        if ($roh === '') return null;
        $d = json_decode($roh, true);
        if (!is_array($d)) return null;
        $alter = time() - strtotime($d['aktualisiert'] ?? '');
        $d['alter']  = max(0, $alter);
        $d['laeuft'] = ($d['phase'] ?? '') !== 'fertig' && $alter < 180;
        return $d;
    }

    // Vergleichsform: klein, ohne Umlaute/Sonderzeichen.
    public static function norm(string $s): string {
        $s = mb_strtolower(trim($s));
        $s = strtr($s, ['ä'=>'ae','ö'=>'oe','ü'=>'ue','ß'=>'ss','é'=>'e','è'=>'e','á'=>'a','à'=>'a']);
        return preg_replace('/[^a-z0-9]+/', '', $s);
    }

    // ── Abfragebegriffe ──────────────────────────────────────────────────
    // Die Suchbegriffe wirken multiplikativ: jeder kostet pro Liste einen
    // eigenen Abruf (≥ 1,15 s). Da beide Dienste als Teilstring suchen, ist ein
    // Begriff überflüssig, sobald ein kürzerer in ihm steckt – "TuS Oedt"
    // liefert nichts, was "Oedt" nicht auch liefert. Für die Abfrage bleibt
    // deshalb nur der jeweils kürzeste Begriff übrig; nachkontrolliert wird
    // weiterhin gegen die volle Liste aus begriffe(), damit ein fremder
    // Verein mit ähnlichem Namen nicht durchrutscht.
    public static function sucheBegriffe(array $begriffe): array {
        $out = [];
        foreach ($begriffe as $b) {
            $nb = self::norm($b);
            if ($nb === '') continue;
            $ueberfluessig = false;
            foreach ($begriffe as $a) {
                $na = self::norm($a);
                if ($na === '' || $na === $nb) continue;
                // Kürzerer Begriff steckt im längeren → längeren weglassen
                if (mb_strlen($na) < mb_strlen($nb) && str_contains($nb, $na)) { $ueberfluessig = true; break; }
            }
            if (!$ueberfluessig && !in_array($b, $out, true)) $out[] = $b;
        }
        return $out ?: $begriffe;
    }

    // Greift die Reduktion nicht ("TuS Oedt" und "TuS 1911 Oedt" enthalten
    // einander nicht), gibt es oft trotzdem ein gemeinsames Wort, das beide
    // abdeckt. Das längste in allen Begriffen enthaltene Wort ist der
    // Vorschlag fürs Admin-Panel – ab 4 Zeichen, damit "SV" o.ä. nicht
    // vorgeschlagen wird. Rückgabe in der Schreibweise des ersten Begriffs.
    public static function begriffVorschlag(array $begriffe): string {
        if (count($begriffe) < 2) return '';
        $woerter = [];
        foreach ($begriffe as $b) {
            $w = [];
            foreach (preg_split('/\s+/', trim($b), -1, PREG_SPLIT_NO_EMPTY) ?: [] as $t) {
                $n = self::norm($t);
                if ($n !== '') $w[$n] = $t;
            }
            if (!$w) return '';
            $woerter[] = $w;
        }
        $gemeinsam = $woerter[0];
        foreach (array_slice($woerter, 1) as $w) $gemeinsam = array_intersect_key($gemeinsam, $w);
        if (!$gemeinsam) return '';

        $beste = '';
        foreach ($gemeinsam as $n => $original) {
            if (mb_strlen($n) >= 4 && mb_strlen($n) > mb_strlen(self::norm($beste))) $beste = $original;
        }
        // Nur vorschlagen, wenn das Wort wirklich kürzer ist als jeder Begriff
        foreach ($begriffe as $b) { if (self::norm($b) === self::norm($beste)) return ''; }
        return $beste;
    }

    // Namensform unterscheidet sich je Quelle ("Vorname Nachname" vs.
    // "Nachname, Vorname") → Vergleich über sortierte Namensteile.
    public static function namensKey(string $n): string {
        $t = preg_split('/[\s,]+/', mb_strtolower(trim($n)), -1, PREG_SPLIT_NO_EMPTY) ?: [];
        $t = array_map([self::class, 'norm'], $t);
        sort($t);
        return implode(' ', array_filter($t));
    }

    // ── Funde nach Wettkampf gruppieren ──────────────────────────────────
    // $rows  Fundzeilen inkl. Wettkampfdaten (event_id, event_name, datum,
    //        ort, optional land) – so, wie beide Scanner sie liefern.
    // $urlFn Wettkampf-ID → Link auf die Ergebnisseite des Dienstleisters.
    //
    // Ergänzt je Fund die Athleten-ID (sofern ein Profil auf den Namen
    // passt) und das Kennzeichen `bekannt` (Ergebnis am selben Tag für
    // dieselbe Person bereits erfasst). Wettkämpfe, bei denen jede Zeile
    // schon erfasst ist, fallen ganz heraus.
    public static function gruppiere(array $rows, callable $urlFn): array {
        if (!$rows) return [];

        $athIdx = [];
        foreach (DB::fetchAll('SELECT id, vorname, nachname, geschlecht, geburtsjahr FROM ' . DB::tbl('athleten')) as $a) {
            $athIdx[self::namensKey($a['vorname'] . ' ' . $a['nachname'])] = $a;
        }

        // Bereits erfasste Ergebnisse an den Wettkampftagen der Funde
        $daten   = array_values(array_unique(array_filter(array_column($rows, 'datum'))));
        $bekannt = [];
        if ($daten) {
            $ph  = implode(',', array_fill(0, count($daten), '?'));
            $sql = 'SELECT v.datum, a.vorname, a.nachname
                      FROM ' . DB::tbl('ergebnisse') . ' erg
                      JOIN ' . DB::tbl('veranstaltungen') . ' v ON v.id = erg.veranstaltung_id
                      JOIN ' . DB::tbl('athleten') . ' a ON a.id = erg.athlet_id
                     WHERE erg.geloescht_am IS NULL AND v.datum IN (' . $ph . ')';
            foreach (DB::fetchAll($sql, $daten) as $r) {
                $bekannt[$r['datum'] . '|' . self::namensKey($r['vorname'] . ' ' . $r['nachname'])] = true;
            }
        }

        $events = [];
        foreach ($rows as $r) {
            $eid = (string)$r['event_id'];
            if (!isset($events[$eid])) {
                $events[$eid] = [
                    'event_id' => $r['event_id'],
                    'name'     => $r['event_name'],
                    'datum'    => $r['datum'],
                    'ort'      => $r['ort'],
                    'land'     => $r['land'] ?? '',
                    'url'      => $urlFn($r['event_id']),
                    'funde'    => [],
                ];
            }
            $nk  = self::namensKey($r['name']);
            $ath = $athIdx[$nk] ?? null;
            $events[$eid]['funde'][] = [
                'id'           => (int)$r['id'],
                'name'         => $r['name'],
                'verein'       => $r['verein'],
                'jahrgang'     => $r['jahrgang']   ?? '',
                'geschlecht'   => $r['geschlecht'] ?? '',
                'altersklasse' => $r['altersklasse'],
                'wettbewerb'   => $r['wettbewerb'],
                'zeit'         => $r['zeit'],
                'platz'        => $r['platz'],
                'ak_platz'     => $r['ak_platz'] ?? '',
                'startnr'      => $r['startnr']  ?? '',
                'athlet_id'    => $ath ? (int)$ath['id'] : null,
                'bekannt'      => isset($bekannt[$r['datum'] . '|' . $nk]),
            ];
        }

        $out = [];
        foreach ($events as $e) {
            foreach ($e['funde'] as $f) { if (!$f['bekannt']) { $out[] = $e; break; } }
        }
        return array_values($out);
    }
}
