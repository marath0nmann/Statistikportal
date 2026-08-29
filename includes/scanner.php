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

    // ── Läufe: Fortschritt und Abbruch je Lauf ───────────────────────────
    // Ein Scanlauf dauert Minuten. Ohne Zwischenstand sieht niemand, wo er
    // steht, und ein Abbruch hinterlässt keine Spur. Der Stand liegt in
    // einer eigenen Tabelle mit einer Zeile je Lauf – nicht in einem Wert
    // je Quelle: Sonst überschreiben sich zwei gleichzeitige Läufe
    // derselben Quelle gegenseitig (Cronjob und „Jetzt scannen"), und die
    // Anzeige springt zwischen beiden hin und her.
    //
    // Eine Zeile je Lauf heißt außerdem: jeder Lauf schreibt nur sein
    // eigenes UPDATE. Ein gemeinsames JSON müsste gelesen, ergänzt und
    // zurückgeschrieben werden – zwei Prozesse würden sich überholen.
    public static function laufTabelle(): void {
        DB::query("CREATE TABLE IF NOT EXISTS " . DB::tbl('scan_laeufe') . " (
            id           CHAR(12) NOT NULL PRIMARY KEY,
            quelle       VARCHAR(8) NOT NULL DEFAULT '',
            phase        VARCHAR(16) NOT NULL DEFAULT 'start',
            i            INT NOT NULL DEFAULT 0,
            gesamt       INT NOT NULL DEFAULT 0,
            aktuell      VARCHAR(255) NOT NULL DEFAULT '',
            neue_funde   INT NOT NULL DEFAULT 0,
            requests     INT NOT NULL DEFAULT 0,
            abbruch      TINYINT NOT NULL DEFAULT 0,
            ausloeser    VARCHAR(32) NOT NULL DEFAULT '',
            begonnen     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            aktualisiert DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            KEY idx_quelle (quelle, aktualisiert)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    }

    // Neuen Lauf anlegen; gibt die Lauf-ID zurück.
    public static function laufStart(string $quelle, ?string $ausloeser = ''): string {
        try {
            self::laufTabelle();
            // Alte Läufe aufräumen – die Tabelle ist reine Anzeige
            DB::query('DELETE FROM ' . DB::tbl('scan_laeufe') . ' WHERE aktualisiert < NOW() - INTERVAL 2 DAY');
            $id = bin2hex(random_bytes(6));
            DB::query('INSERT INTO ' . DB::tbl('scan_laeufe') . ' (id, quelle, phase, aktuell, ausloeser) VALUES (?,?,?,?,?)',
                [$id, $quelle, 'start', 'Lauf gestartet', mb_substr((string)$ausloeser, 0, 32)]);
            return $id;
        } catch (Throwable $e) { return ''; }
    }

    public static function laufFortschritt(string $id, array $d): void {
        if ($id === '') return;
        try {
            DB::query('UPDATE ' . DB::tbl('scan_laeufe') . '
                          SET phase = ?, i = ?, gesamt = ?, aktuell = ?, neue_funde = ?, requests = ?,
                              aktualisiert = NOW()
                        WHERE id = ?',
                [(string)($d['phase'] ?? 'scan'), (int)($d['i'] ?? 0), (int)($d['gesamt'] ?? 0),
                 mb_substr((string)($d['aktuell'] ?? ''), 0, 255),
                 (int)($d['neue_funde'] ?? 0), (int)($d['requests'] ?? 0), $id]);
        } catch (Throwable $e) {}
    }

    // Abbruch: Der Lauf hält seine HTTP-Anfrage minutenlang offen und
    // arbeitet dank ignore_user_abort weiter, wenn der Aufrufer geht.
    // Deshalb ein Kennzeichen in seiner eigenen Zeile, das die Schleife
    // zwischen zwei Wettkämpfen liest – direkt per SQL, denn Settings hält
    // seinen Cache je Anfrage und der ganze Lauf IST eine Anfrage.
    public static function laufAbbrechen(string $id): int {
        try {
            self::laufTabelle();
            return DB::query('UPDATE ' . DB::tbl('scan_laeufe') . " SET abbruch = 1 WHERE id = ? AND phase <> 'fertig'",
                [$id])->rowCount();
        } catch (Throwable $e) { return 0; }
    }

    public static function laufAbbruchGewuenscht(string $id): bool {
        if ($id === '') return false;
        try {
            $r = DB::fetchOne('SELECT abbruch FROM ' . DB::tbl('scan_laeufe') . ' WHERE id = ?', [$id]);
        } catch (Throwable $e) { return false; }
        return !empty($r['abbruch']);
    }

    // Läufe einer Quelle: alle noch laufenden plus der zuletzt beendete.
    // „Laufend" heißt: Phase nicht 'fertig' und in den letzten 3 Minuten
    // gemeldet – ein abgestürzter Lauf verschwindet damit von selbst.
    public static function laeufe(string $quelle): array {
        try {
            self::laufTabelle();
            $rows = DB::fetchAll(
                'SELECT * FROM ' . DB::tbl('scan_laeufe') . '
                  WHERE quelle = ? AND (phase <> ? OR aktualisiert > NOW() - INTERVAL 2 MINUTE)
                  ORDER BY begonnen DESC LIMIT 8',
                [$quelle, 'fertig']);
        } catch (Throwable $e) { return []; }

        $out = [];
        foreach ($rows as $r) {
            $alter = time() - strtotime($r['aktualisiert']);
            $out[] = [
                'id'         => $r['id'],
                'phase'      => $r['phase'],
                'i'          => (int)$r['i'],
                'gesamt'     => (int)$r['gesamt'],
                'aktuell'    => $r['aktuell'],
                'neue_funde' => (int)$r['neue_funde'],
                'requests'   => (int)$r['requests'],
                'ausloeser'  => $r['ausloeser'],
                'begonnen'   => $r['begonnen'],
                'alter'      => max(0, $alter),
                'abbruch'    => (int)$r['abbruch'],
                'laeuft'     => $r['phase'] !== 'fertig' && $alter < 180,
            ];
        }
        return $out;
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
    //        ort, optional land) – so, wie die Scanner sie liefern. Felder,
    //        die eine Quelle nicht kennt (leichtathletik.de meldet aus der
    //        Meldeliste weder Zeit noch Platz), dürfen fehlen.
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
                'altersklasse' => $r['altersklasse'] ?? '',
                'wettbewerb'   => $r['wettbewerb']   ?? '',
                'zeit'         => $r['zeit']         ?? '',
                'platz'        => $r['platz']        ?? '',
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
