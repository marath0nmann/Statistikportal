<?php
// ============================================================
// Uitslagen.nl-Scanner
// ------------------------------------------------------------
// Anders als RaceResult hat uitslagen.nl eine seitenweite Volltext-
// suche über alle veröffentlichten Ergebnisse:
//
//   GET https://uitslagen.nl/results.php?naam=<Begriff>&gbjr=&exct=&next=
//   → { "html": "<div class=\"card\">…", "next": "<Cursor>" }
//
// Gesucht wird über Name, Woonplaats UND Vereniging – ein einziger
// Abruf je Suchbegriff liefert also alle Starts unseres Vereins,
// nach Wettkampf gruppiert und absteigend nach Datum. Eine Discovery
// über einen Wettkampfkalender wie bei RaceResult entfällt damit
// komplett, ebenso die Warteschlange je Wettkampf.
//
// Da die Suche auch Woonplaats und Namen trifft ("Oedt" ist auch ein
// Ort), wird jede Zeile gegen das Feld Woonplaats/Vereniging nach-
// kontrolliert – dieselbe Regel wie beim RaceResult-Scanner.
//
// Der Scanner speichert nur den Fund. Der Import läuft unverändert
// über den bestehenden uitslagen.nl-Importer im Frontend.
// ============================================================

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/settings.php';
require_once __DIR__ . '/scanner.php';

class Uitslagen {

    const BASE   = 'https://uitslagen.nl';
    // Sicherheitsnetz gegen endloses Blättern (der Cursor ist undokumentiert)
    const MAX_SEITEN = 12;

    private static float $letzterRequest = 0.0;
    private static int   $requests       = 0;

    public static function requests(): int { return self::$requests; }

    // ── Tabelle (idempotent) ─────────────────────────────────────────────
    // Keine Event-Warteschlange nötig: die Suche liefert Wettkampf und
    // Ergebnis in einem Zug. Die Wettkampfdaten stehen deshalb direkt am
    // Fund; gruppiert wird erst beim Ausliefern.
    public static function migrate(): void {
        DB::query("CREATE TABLE IF NOT EXISTS " . DB::tbl('uits_funde') . " (
            id           INT AUTO_INCREMENT PRIMARY KEY,
            event_id     VARCHAR(24) NOT NULL,
            fund_key     CHAR(32) NOT NULL,
            event_name   VARCHAR(255) NOT NULL DEFAULT '',
            datum        DATE NULL,
            ort          VARCHAR(160) NOT NULL DEFAULT '',
            name         VARCHAR(160) NOT NULL DEFAULT '',
            verein       VARCHAR(160) NOT NULL DEFAULT '',
            altersklasse VARCHAR(24)  NOT NULL DEFAULT '',
            wettbewerb   VARCHAR(120) NOT NULL DEFAULT '',
            zeit         VARCHAR(40)  NOT NULL DEFAULT '',
            platz        VARCHAR(24)  NOT NULL DEFAULT '',
            status       ENUM('neu','erledigt','ignoriert') NOT NULL DEFAULT 'neu',
            gefunden_am  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uk_fund (fund_key),
            KEY idx_event (event_id, status),
            KEY idx_datum (status, datum)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    }

    // ── HTTP mit Rate-Limit ──────────────────────────────────────────────
    // uitslagen.nl drosselt nicht erkennbar; der Abstand bleibt trotzdem,
    // weil pro Lauf ohnehin nur eine Handvoll Abrufe anfällt.
    private static function http(string $url, int $timeout = 25): array {
        $wartet = 1.15 - (microtime(true) - self::$letzterRequest);
        if ($wartet > 0) usleep((int)($wartet * 1000000));

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS      => 3,
            CURLOPT_TIMEOUT        => $timeout,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_USERAGENT      => 'Mozilla/5.0 (compatible; StatistikportalBot/1.0)',
            CURLOPT_HTTPHEADER     => [
                'Accept: application/json, text/plain, */*',
                'Accept-Language: nl,de;q=0.8,en;q=0.6',
                'Referer: ' . self::BASE . '/zoek.php',
                'X-Requested-With: XMLHttpRequest',
            ],
        ]);
        $body = curl_exec($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);

        self::$letzterRequest = microtime(true);
        self::$requests++;
        return [$code, is_string($body) ? $body : ''];
    }

    // ── Suchbegriffe ─────────────────────────────────────────────────────
    // Eigene Liste, sonst die des RaceResult-Scanners, sonst Vereinsdaten.
    public static function begriffe(): array {
        $roh = trim(Settings::get('uits_scan_begriffe', ''));
        if ($roh === '') $roh = trim(Settings::get('rr_scan_begriffe', ''));
        if ($roh === '') {
            $roh = Settings::get('verein_name', '') . ',' . Settings::get('verein_kuerzel', '');
        }
        $out = [];
        foreach (explode(',', $roh) as $b) {
            $b = trim($b);
            // Rechtsformen weglassen – die Suche arbeitet als Teilstring
            $b = trim(preg_replace('/\b(e\.?\s?V\.?|eV)\b\.?$/i', '', $b));
            if (mb_strlen($b) >= 3 && !in_array($b, $out, true)) $out[] = $b;
        }
        return $out;
    }

    public static function norm(string $s): string { return Scanner::norm($s); }

    // Tags entfernen, Entities auflösen, Leerraum normalisieren.
    private static function text(string $html): string {
        $t = preg_replace('/<[^>]*>/', ' ', $html);
        $t = html_entity_decode($t, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $t = str_replace("\xc2\xa0", ' ', $t);
        return trim(preg_replace('/\s+/u', ' ', $t));
    }

    // ── Antwort zerlegen ─────────────────────────────────────────────────
    // Aufbau je Treffer:
    //   div.card[onclick=location='/<id>']
    //     div.event-name            → Wettkampfname
    //     div.event-info > span[0]  → Ort   (span[1] = Datum in Langform)
    //     div.caption-inner         → "M45, Korte cross" (AK + Bewerb)
    //     div.tr  →  td.bold = Platz, div.naam, div.wpl, td.tijd = Zeit
    //
    // Das Datum kommt aus der Wettkampf-ID (die ersten acht Stellen sind
    // YYYYMMDD) – zuverlässiger als die niederländische Langform, die als
    // Rückfall dient.
    public static function parse(string $html): array {
        $events = [];
        // Karten trennen: an jedem Kartenanfang aufsplitten, erstes Stück verwerfen
        $karten = preg_split('/(?=<div class="card")/', $html);
        foreach ($karten as $karte) {
            if (!preg_match('/onclick\s*=\s*"location\s*=\s*\'\/(\d+)\'/', $karte, $m)) continue;
            $eid = $m[1];

            $name  = preg_match('/<div class="event-name">(.*?)<\/div>/s', $karte, $m2) ? self::text($m2[1]) : '';
            $ort   = '';
            $lang  = '';
            if (preg_match('/<div class="event-info">(.*?)<\/div>\s*<\/div>/s', $karte, $mi)
                && preg_match_all('/<span>(.*?)<\/span>/s', $mi[1], $ms)) {
                $ort  = self::text($ms[1][0] ?? '');
                $lang = self::text($ms[1][1] ?? '');
            }
            $datum = self::datumAusId($eid) ?: self::datumAusText($lang);

            // Abschnitte: jede caption leitet einen Bewerb ein
            $zeilen = [];
            $bloecke = preg_split('/(?=<div class="caption">)/', $karte);
            foreach ($bloecke as $block) {
                if (!preg_match('/<span class="caption-inner">(.*?)<\/span>/s', $block, $mc)) continue;
                [$ak, $bewerb] = self::bewerb(self::text($mc[1]));

                preg_match_all('/<div class="tr">(.*?)(?=<div class="tr">|<div class="caption">|$)/s', $block, $mr);
                foreach ($mr[1] as $tr) {
                    $naam = preg_match('/<div class="naam">(.*?)<\/div>/s', $tr, $mn) ? self::text($mn[1]) : '';
                    $wpl  = preg_match('/<div class="wpl">(.*?)<\/div>/s',  $tr, $mw) ? self::text($mw[1]) : '';
                    if ($naam === '') continue;

                    $platz = preg_match('/<div class="td bold">(.*?)<\/div>/s', $tr, $mp) ? self::text($mp[1]) : '';

                    // Zeitspalten: die erste ist bei manchen Läufen die
                    // Bruttozeit, die letzte gefüllte ist die offizielle.
                    $zeit = '';
                    if (preg_match_all('/<div class="td tijd">(.*?)<\/div>/s', $tr, $mt)) {
                        foreach ($mt[1] as $z) { $z = self::text($z); if ($z !== '') $zeit = $z; }
                    }

                    $zeilen[] = [
                        'name'         => $naam,
                        'verein'       => $wpl,
                        'altersklasse' => $ak,
                        'wettbewerb'   => $bewerb,
                        'zeit'         => $zeit,
                        'platz'        => $platz,
                    ];
                }
            }
            if (!$zeilen) continue;

            $events[] = [
                'event_id' => $eid,
                'name'     => $name,
                'datum'    => $datum,
                'ort'      => $ort,
                'zeilen'   => $zeilen,
            ];
        }
        return $events;
    }

    // "M45, Korte cross" → ['M45', 'Korte cross'];  ohne AK-Präfix bleibt
    // die ganze Angabe der Bewerb.
    //
    // Als Klasse gilt ein kurzer Kopf ohne Leerzeichen, der entweder eine
    // Zahl enthält (M45, V50) oder mit M/V/W/J beginnt – uitslagen.nl führt
    // dort auch Formen wie "Mrecr"/"Vrecr" (recreant). Alles andere bleibt
    // Teil des Bewerbs, damit aus "Korte cross" keine Klasse wird.
    private static function bewerb(string $s): array {
        $t = explode(',', $s, 2);
        if (count($t) !== 2) return ['', $s];
        $kopf = trim($t[0]);
        if ($kopf !== '' && mb_strlen($kopf) <= 6 && !str_contains($kopf, ' ')
            && (preg_match('/\d/', $kopf) || preg_match('/^[MWVJ][a-z]*$/ui', $kopf))) {
            return [$kopf, trim($t[1])];
        }
        return ['', $s];
    }

    // Die Wettkampf-ID beginnt mit YYYYMMDD (z.B. 2025110916317).
    private static function datumAusId(string $eid): string {
        if (!preg_match('/^(\d{4})(\d{2})(\d{2})/', $eid, $m)) return '';
        if (!checkdate((int)$m[2], (int)$m[3], (int)$m[1])) return '';
        return $m[1] . '-' . $m[2] . '-' . $m[3];
    }

    // Rückfall: "Zondag 9 november 2025"
    private static function datumAusText(string $s): string {
        static $monate = ['januari'=>1,'februari'=>2,'maart'=>3,'april'=>4,'mei'=>5,'juni'=>6,
                          'juli'=>7,'augustus'=>8,'september'=>9,'oktober'=>10,'november'=>11,'december'=>12];
        if (!preg_match('/(\d{1,2})\s+([a-zA-Zé]+)\s+(\d{4})/u', $s, $m)) return '';
        $mon = $monate[mb_strtolower($m[2])] ?? 0;
        if (!$mon) return '';
        return sprintf('%04d-%02d-%02d', (int)$m[3], $mon, (int)$m[1]);
    }

    // ── Hauptlauf ────────────────────────────────────────────────────────
    // $tage  Rückblick-Fenster; ältere Treffer werden übergangen. Die Suche
    //        liefert die gesamte Historie (bis 2003) – ohne Fenster würde
    //        der erste Lauf Jahre alter Ergebnisse melden.
    public static function scan(int $tage = 0, int $maxSekunden = 120, string $ausloeser = ''): array {
        self::migrate();
        $start = microtime(true);
        // Eigene Zeile je Lauf – zwei gleichzeitige Läufe derselben Quelle
        // (Cronjob und „Jetzt scannen") sollen sich nicht überschreiben.
        $laufId = Scanner::laufStart('uits', $ausloeser);

        $tage     = $tage > 0 ? $tage : max(1, (int)Settings::get('uits_scan_tage', '30'));
        $begriffe = self::begriffe();
        $grenze   = date('Y-m-d', strtotime("-$tage days"));

        // Wie bei RaceResult kostet jeder Begriff einen eigenen Abruf und
        // die Suche arbeitet als Teilstring – kürzere Begriffe decken die
        // längeren mit ab. Geprüft wird weiterhin gegen die volle Liste.
        $abfrage = Scanner::sucheBegriffe($begriffe);

        $stat = ['events' => 0, 'treffer' => 0, 'neue_funde' => 0, 'seiten' => 0,
                 'requests' => 0, 'abgebrochen' => false, 'begriffe' => $begriffe,
                 'abfrage_begriffe' => $abfrage, 'ab' => $grenze, 'lauf_id' => $laufId];
        if (!$begriffe) {
            $stat['fehler'] = 'Keine Suchbegriffe konfiguriert.';
            Scanner::laufFortschritt($laufId, ['phase' => 'fertig', 'fehler' => $stat['fehler']]);
            return $stat;
        }

        Scanner::laufFortschritt($laufId, [
            'phase' => 'start', 'begonnen' => date('Y-m-d H:i:s'),
            'i' => 0, 'gesamt' => count($abfrage), 'aktuell' => 'Lauf gestartet', 'neue_funde' => 0,
        ]);

        $gesehen = [];
        $nr = 0;
        foreach ($abfrage as $begriff) {
            $next = '';
            $nr++;
            for ($seite = 0; $seite < self::MAX_SEITEN; $seite++) {
                Scanner::laufFortschritt($laufId, [
                    'phase'   => 'scan', 'begonnen' => date('Y-m-d H:i:s', (int)$start),
                    'i'       => $nr, 'gesamt' => count($abfrage),
                    'aktuell' => 'Suche „' . $begriff . '"' . ($seite ? ' – Seite ' . ($seite + 1) : ''),
                    'neue_funde' => $stat['neue_funde'], 'requests' => self::$requests,
                ]);
                if (microtime(true) - $start > $maxSekunden) { $stat['abgebrochen'] = true; break 2; }
                if (Scanner::laufAbbruchGewuenscht($laufId)) { $stat['abbruch'] = true; break 2; }

                $url = self::BASE . '/results.php?naam=' . rawurlencode($begriff)
                     . '&gbjr=&exct=&next=' . rawurlencode($next);
                [$code, $body] = self::http($url);
                if ($code !== 200 || $body === '') {
                    $stat['fehler'] = 'uitslagen.nl nicht erreichbar (HTTP ' . $code . ').';
                    break;
                }
                $json = json_decode($body, true);
                if (!is_array($json) || !isset($json['html'])) {
                    $stat['fehler'] = 'Unerwartete Antwort von uitslagen.nl.';
                    break;
                }
                $stat['seiten']++;

                $zuAlt = false;
                foreach (self::parse($json['html']) as $ev) {
                    // Absteigend nach Datum – ab dem ersten zu alten
                    // Wettkampf lohnt kein Weiterblättern mehr.
                    if ($ev['datum'] !== '' && $ev['datum'] < $grenze) { $zuAlt = true; continue; }
                    if (isset($gesehen[$ev['event_id']])) continue;
                    $gesehen[$ev['event_id']] = true;

                    $stat['events']++;
                    $stat['treffer']    += count($ev['zeilen']);
                    $stat['neue_funde'] += self::funde($ev, $begriffe);
                }

                $next = trim((string)($json['next'] ?? ''));
                if ($next === '' || $zuAlt) break;
            }
        }

        $stat['requests'] = self::$requests;
        $stat['dauer']    = round(microtime(true) - $start, 1);
        Scanner::laufFortschritt($laufId, [
            'phase' => 'fertig', 'i' => count($abfrage), 'gesamt' => count($abfrage),
            'aktuell' => !empty($stat['abbruch']) ? 'Abgebrochen'
                         : ($stat['abgebrochen'] ? 'Zeitlimit erreicht' : 'Lauf beendet'),
            'neue_funde' => $stat['neue_funde'], 'requests' => $stat['requests'],
        ]);
        Settings::set('uits_scan_letzter_lauf', date('Y-m-d H:i:s'));
        Settings::set('uits_scan_letzter_status', json_encode($stat, JSON_UNESCAPED_UNICODE));
        return $stat;
    }

    // Trefferzeilen ablegen. Die Suche greift auch auf Name und Woonplaats
    // zu – deshalb nur Zeilen behalten, deren Feld Woonplaats/Vereniging
    // wirklich einen der Suchbegriffe enthält.
    private static function funde(array $ev, array $begriffe): int {
        $normBegriffe = array_map([self::class, 'norm'], $begriffe);
        $neu = 0;
        foreach ($ev['zeilen'] as $z) {
            $verein = trim($z['verein']);
            if ($verein === '') continue;
            $nv = self::norm($verein);
            $passt = false;
            foreach ($normBegriffe as $b) { if ($b !== '' && str_contains($nv, $b)) { $passt = true; break; } }
            if (!$passt) continue;

            $key = md5('uits|' . $ev['event_id'] . '|' . self::norm($z['name']) . '|'
                     . self::norm($z['wettbewerb']) . '|' . self::norm($z['zeit']));
            $neu += DB::query(
                'INSERT IGNORE INTO ' . DB::tbl('uits_funde') . '
                 (event_id, fund_key, event_name, datum, ort, name, verein, altersklasse, wettbewerb, zeit, platz)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?)',
                [$ev['event_id'], $key,
                 mb_substr($ev['name'], 0, 255), $ev['datum'] !== '' ? $ev['datum'] : null,
                 mb_substr($ev['ort'], 0, 160),
                 mb_substr($z['name'], 0, 160), mb_substr($verein, 0, 160),
                 mb_substr($z['altersklasse'], 0, 24), mb_substr($z['wettbewerb'], 0, 120),
                 mb_substr($z['zeit'], 0, 40), mb_substr($z['platz'], 0, 24)]
            )->rowCount();
        }
        return $neu;
    }
}
