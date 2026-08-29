<?php
// ============================================================
// leichtathletik.de-Scanner (DLV-Ergebnisportal)
// ------------------------------------------------------------
// Zwei Bausteine, beide reines HTML:
//
//   1. Discovery  GET /Competitions/CurrentPast?page=N
//      → absteigend nach Datum, ~24 Wettkämpfe je Seite (≈ 3 Tage).
//        Je Zeile: Datum, Name, Ort, /Competitions/Details/{id}.
//        Seite 1 enthält auch künftige Termine.
//
//   2. Teilnehmerliste  GET /Competitions/Competitoroverview/{id}
//      → vollständige Meldeliste in einem Dokument (keine Paginierung,
//        bei großen Meetings ~1 MB). Je Zeile: Startnummer, Name,
//        Verein, Landesverband, Jahrgang und die gemeldeten Bewerbe.
//
// Damit ist die Trefferprüfung eindeutiger als bei RaceResult: der
// Verein steht in einem eigenen Feld, es gibt keine Volltextsuche,
// deren Rauschen nachkontrolliert werden müsste.
//
// Wichtig: Es ist eine MELDE-, keine Ergebnisliste. Ein Fund heißt
// „war gemeldet", nicht „hat ein Ergebnis". Deshalb wird erst ab dem
// Wettkampftag geprüft und im Panel entsprechend formuliert; der Import
// läuft danach wie bisher über die Ergebnisübersicht.
//
// Hinweis zur Nutzung: ergebnisse.leichtathletik.de liefert eine
// robots.txt mit „User-agent: * / Disallow: /" (Vorlage aus einem
// Bad-Bot-Blocker). Der Scanner tritt deshalb bewusst sparsam auf:
// streng seriell mit 1,5 s Abstand, klar erkennbarer User-Agent,
// Standard-Rückblick nur 14 Tage, und er ist ab Werk ausgeschaltet.
// ============================================================

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/settings.php';
require_once __DIR__ . '/scanner.php';

class Leichtathletik {

    const BASE        = 'https://ergebnisse.leichtathletik.de';
    // Sicherheitsnetz: 555 Seiten gibt es insgesamt, das Fenster braucht ~6
    const MAX_SEITEN  = 20;

    private static float $letzterRequest = 0.0;
    private static int   $requests       = 0;
    private static int   $letzterCode    = 0;
    private static float $abstand        = 1.5;   // wächst bei Drosselung

    public static function requests(): int { return self::$requests; }

    // ── Tabellen (idempotent) ────────────────────────────────────────────
    public static function migrate(): void {
        DB::query("CREATE TABLE IF NOT EXISTS " . DB::tbl('la_events') . " (
            event_id     INT NOT NULL PRIMARY KEY,
            name         VARCHAR(255) NOT NULL DEFAULT '',
            datum        DATE NULL,
            ort          VARCHAR(160) NOT NULL DEFAULT '',
            status       ENUM('offen','fertig','ohne_liste') NOT NULL DEFAULT 'offen',
            versuche     SMALLINT NOT NULL DEFAULT 0,
            treffer      SMALLINT NOT NULL DEFAULT 0,
            letzter_scan DATETIME NULL,
            entdeckt     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            KEY idx_queue (status, datum),
            KEY idx_scan (status, letzter_scan)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        DB::query("CREATE TABLE IF NOT EXISTS " . DB::tbl('la_funde') . " (
            id           INT AUTO_INCREMENT PRIMARY KEY,
            event_id     INT NOT NULL,
            fund_key     CHAR(32) NOT NULL,
            name         VARCHAR(160) NOT NULL DEFAULT '',
            verein       VARCHAR(160) NOT NULL DEFAULT '',
            lv           VARCHAR(16)  NOT NULL DEFAULT '',
            jahrgang     VARCHAR(8)   NOT NULL DEFAULT '',
            startnr      VARCHAR(24)  NOT NULL DEFAULT '',
            wettbewerb   VARCHAR(160) NOT NULL DEFAULT '',
            status       ENUM('neu','erledigt','ignoriert') NOT NULL DEFAULT 'neu',
            gefunden_am  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uk_fund (fund_key),
            KEY idx_event (event_id, status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    }

    // ── HTTP mit Rate-Limit ──────────────────────────────────────────────
    private static function http(string $url, int $timeout = 40): array {
        $wartet = self::$abstand - (microtime(true) - self::$letzterRequest);
        if ($wartet > 0) usleep((int)($wartet * 1000000));

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS      => 3,
            CURLOPT_TIMEOUT        => $timeout,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_ENCODING       => '',   // gzip – die Seiten sind groß
            CURLOPT_USERAGENT      => 'Mozilla/5.0 (compatible; StatistikportalBot/1.0)',
            CURLOPT_HTTPHEADER     => [
                'Accept: text/html,application/xhtml+xml',
                'Accept-Language: de-DE,de;q=0.9',
            ],
        ]);
        $body = curl_exec($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);

        self::$letzterRequest = microtime(true);
        self::$requests++;
        self::$letzterCode = $code;
        // Drosselt die Seite, für den Rest des Laufs langsamer werden
        if ($code === 429 || $code === 503) self::$abstand = min(6.0, self::$abstand + 1.0);
        return [$code, is_string($body) ? $body : ''];
    }

    // Vorübergehende Störung (Drosselung, Serverfehler, Transportfehler) im
    // Unterschied zu „diese Seite gibt es nicht". Ein solcher Fehlschlag darf
    // keinen Versuch verbrauchen: sonst schreibt eine halbe Stunde Serverlast
    // einen Wettkampf dauerhaft ab – bei nur drei erlaubten Versuchen geht das
    // schnell. Gelernt am RaceResult-Scanner (v1547).
    private static function voruebergehend(): bool {
        return in_array(self::$letzterCode, [0, 408, 425, 429, 500, 502, 503, 504], true);
    }

    // Suchbegriffe: eigene Liste, sonst die des RaceResult-Scanners,
    // sonst die Vereinsdaten.
    public static function begriffe(): array {
        $roh = trim(Settings::get('la_scan_begriffe', ''));
        if ($roh === '') $roh = trim(Settings::get('rr_scan_begriffe', ''));
        if ($roh === '') {
            $roh = Settings::get('verein_name', '') . ',' . Settings::get('verein_kuerzel', '');
        }
        $out = [];
        foreach (explode(',', $roh) as $b) {
            $b = trim(preg_replace('/\b(e\.?\s?V\.?|eV)\b\.?$/i', '', trim($b)));
            if (mb_strlen($b) >= 3 && !in_array($b, $out, true)) $out[] = $b;
        }
        return $out;
    }

    private static function text(string $html): string {
        $t = preg_replace('/<[^>]*>/', ' ', $html);
        $t = html_entity_decode($t, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $t = str_replace("\xc2\xa0", ' ', $t);
        return trim(preg_replace('/\s+/u', ' ', $t));
    }

    // ── 1. Discovery ─────────────────────────────────────────────────────
    // Eine Seite der Wettkampfliste. Gibt [id => [name, datum, ort]] zurück
    // sowie das älteste Datum der Seite, damit der Aufrufer weiß, wann das
    // Rückblick-Fenster verlassen ist.
    public static function seite(int $nr): array {
        $url = self::BASE . '/Competitions/CurrentPast' . ($nr > 1 ? '?page=' . $nr : '');
        [$code, $html] = self::http($url);
        if ($code !== 200 || $html === '') return [];

        // Je Zeile stehen drei Links auf dieselbe Details-URL (Datum, Name, Ort)
        if (!preg_match('/<tbody>(.*?)<\/tbody>/s', $html, $tb)) return [];
        preg_match_all('/<tr>(.*?)<\/tr>/s', $tb[1], $zeilen);

        $out = [];
        foreach ($zeilen[1] as $tr) {
            if (!preg_match('/\/Competitions\/Details\/(\d+)/', $tr, $mid)) continue;
            preg_match_all('/<td[^>]*>(.*?)<\/td>/s', $tr, $tds);
            $tdListe = $tds[1] ?? [];

            // Spalten: [0] Bild, [1] Datum (<time>), [2] Name, [3] Ort.
            // Datum positionell aus <time> lesen, nicht über Mustererkennung:
            // mehrtägige Wettkämpfe stehen als Zeitraum („25 - 26.08.2026")
            // und würden sonst als Name durchgehen.
            $datum = preg_match('/<time>(.*?)<\/time>/s', $tr, $mt)
                ? self::datum(self::text($mt[1])) : '';

            // Name und Ort aus dem Details-Link der Zelle, nicht aus dem
            // ganzen Zellentext: in der Namensspalte steht bei Wettkämpfen
            // mit Zeitplan zusätzlich ein „CIS"-Link, der sonst am Namen
            // kleben bliebe („… Hochsprungmeeting Heilbronn CIS").
            $ausZelle = function (?string $td) use ($mid): string {
                if ($td === null) return '';
                if (preg_match('/<a[^>]*href="[^"]*\/Competitions\/Details\/' . $mid[1] . '"[^>]*>(.*?)<\/a>/s', $td, $ma))
                    return self::text($ma[1]);
                return self::text($td);
            };

            $out[(int)$mid[1]] = [
                'name'  => $ausZelle($tdListe[2] ?? null),
                'ort'   => $ausZelle($tdListe[3] ?? null),
                'datum' => $datum,
            ];
        }
        return $out;
    }

    // Datumsangabe der Liste → ISO. Mehrtägige Wettkämpfe stehen als
    // Zeitraum („25 - 26.08.2026", „30.08. - 01.09.2026"); maßgeblich ist
    // der letzte Tag, denn erst danach ist die Veranstaltung gelaufen.
    public static function datum(string $s): string {
        if (!preg_match_all('/(\d{1,2})\.(\d{1,2})\.(\d{4})/', $s, $m, PREG_SET_ORDER)) return '';
        $letzte = end($m);
        if (!checkdate((int)$letzte[2], (int)$letzte[1], (int)$letzte[3])) return '';
        return sprintf('%04d-%02d-%02d', (int)$letzte[3], (int)$letzte[2], (int)$letzte[1]);
    }

    // ── 2. Teilnehmerliste ───────────────────────────────────────────────
    // Gibt die Meldezeilen zurück oder null, wenn keine Liste vorliegt.
    // Aufbau je Zeile (div.entryline):
    //   col-1     firstline  → Startnummer
    //   col-2     firstline  → Name, secondline → Verein
    //   col-42p   firstline  → Landesverband, secondline → Jahrgang
    //   col-last             → gemeldete Bewerbe (Links)
    public static function meldeliste(int $eventId): ?array {
        [$code, $html] = self::http(self::BASE . '/Competitions/Competitoroverview/' . $eventId);
        if ($code !== 200 || $html === '') return null;

        preg_match_all('/<div class="entryline">(.*?)(?=<div class="entryline">|<div class="blockfooter"|<\/body)/s', $html, $m);
        if (!$m[1]) return null;

        $out = [];
        foreach ($m[1] as $zeile) {
            $spalte = function (string $klasse) use ($zeile): array {
                if (!preg_match('/<div[^>]*class="[^"]*\b' . $klasse . '\b[^"]*"[^>]*>(.*?)(?=<div[^>]*class="[^"]*\bcol-|$)/s', $zeile, $c))
                    return ['', ''];
                preg_match_all('/<div class="(firstline|secondline)">(.*?)<\/div>/s', $c[1], $z);
                $erste = $zweite = '';
                foreach ($z[1] as $i => $art) {
                    if ($art === 'firstline'  && $erste  === '') $erste  = self::text($z[2][$i]);
                    if ($art === 'secondline' && $zweite === '') $zweite = self::text($z[2][$i]);
                }
                return [$erste, $zweite];
            };

            [$startnr]        = $spalte('col-1');
            [$name, $verein]  = $spalte('col-2');
            [$lv, $jahrgang]  = $spalte('col-42p');
            if ($name === '') continue;

            // Bewerbe stehen als Links in der letzten Spalte
            $bewerbe = [];
            if (preg_match('/<div[^>]*class="[^"]*\bcol-last\b[^"]*"[^>]*>(.*)$/s', $zeile, $cl)) {
                preg_match_all('/<a[^>]*>(.*?)<\/a>/s', $cl[1], $ml);
                foreach ($ml[1] as $b) { $b = self::text($b); if ($b !== '') $bewerbe[] = $b; }
            }

            $out[] = [
                'startnr'    => $startnr,
                'name'       => $name,
                'verein'     => $verein,
                'lv'         => $lv,
                'jahrgang'   => $jahrgang,
                'wettbewerb' => implode(', ', array_slice(array_unique($bewerbe), 0, 12)),
            ];
        }
        return $out;
    }

    // ── Hauptlauf ────────────────────────────────────────────────────────
    public static function scan(int $budget = 0, int $maxSekunden = 240, bool $discovery = true, string $ausloeser = ''): array {
        self::migrate();
        $start = microtime(true);
        // Eigene Zeile je Lauf – zwei gleichzeitige Läufe derselben Quelle
        // (Cronjob und „Jetzt scannen") sollen sich nicht überschreiben.
        $laufId = Scanner::laufStart('la', $ausloeser);

        $budget  = $budget > 0 ? $budget : max(1, (int)Settings::get('la_scan_budget', '40'));
        $fenster = max(1, min(60, (int)Settings::get('la_scan_tage', '14')));
        $begriffe = self::begriffe();
        $heute   = date('Y-m-d');
        $grenze  = date('Y-m-d', strtotime("-$fenster days"));

        $stat = ['neue_events' => 0, 'gescannt' => 0, 'gedrosselt' => 0, 'treffer' => 0, 'neue_funde' => 0,
                 'seiten' => 0, 'requests' => 0, 'abgebrochen' => false,
                 'begriffe' => $begriffe, 'ab' => $grenze, 'lauf_id' => $laufId];
        if (!$begriffe) {
            $stat['fehler'] = 'Keine Suchbegriffe konfiguriert.';
            Scanner::laufFortschritt($laufId, ['phase' => 'fertig', 'fehler' => $stat['fehler']]);
            return $stat;
        }

        Scanner::laufFortschritt($laufId, [
            'phase' => 'start', 'begonnen' => date('Y-m-d H:i:s'),
            'i' => 0, 'gesamt' => 0, 'aktuell' => 'Lauf gestartet', 'neue_funde' => 0,
        ]);

        // ── Discovery: Seiten durchgehen, bis das Fenster verlassen ist ──
        $letzteDiscovery = Settings::get('la_scan_discovery_am', '');
        if ($discovery && $letzteDiscovery !== $heute) {
            for ($seite = 1; $seite <= self::MAX_SEITEN; $seite++) {
                if (microtime(true) - $start > $maxSekunden) { $stat['abgebrochen'] = true; break; }
                if (Scanner::laufAbbruchGewuenscht($laufId)) { $stat['abbruch'] = true; break; }
                Scanner::laufFortschritt($laufId, [
                    'phase' => 'discovery', 'begonnen' => date('Y-m-d H:i:s', (int)$start),
                    'i' => $seite, 'gesamt' => 0, 'neue_funde' => 0,
                    'aktuell' => 'Wettkampfliste, Seite ' . $seite,
                ]);
                $events = self::seite($seite);
                if (!$events) break;
                $stat['seiten']++;

                $zuAlt = false;
                foreach ($events as $eid => $e) {
                    if ($e['datum'] !== '' && $e['datum'] < $grenze) { $zuAlt = true; continue; }
                    $stat['neue_events'] += DB::query(
                        'INSERT IGNORE INTO ' . DB::tbl('la_events') . ' (event_id, name, datum, ort) VALUES (?,?,?,?)',
                        [$eid, mb_substr($e['name'], 0, 255), $e['datum'] !== '' ? $e['datum'] : null, mb_substr($e['ort'], 0, 160)]
                    )->rowCount();
                }
                // Die Liste ist absteigend sortiert – ab der ersten zu alten
                // Zeile lohnt keine weitere Seite.
                if ($zuAlt) break;
            }
            if (!$stat['abgebrochen']) Settings::set('la_scan_discovery_am', $heute);
        }

        // ── Warteschlange: Wettkämpfe, deren Termin vorbei ist ──────────
        // Die Meldeliste ändert sich nach dem Wettkampf nicht mehr, ein
        // erfolgreicher Abruf genügt also – anders als bei RaceResult, wo
        // Ergebnislisten nachwachsen.
        $queue = DB::fetchAll(
            'SELECT * FROM ' . DB::tbl('la_events') . '
              WHERE status = ? AND datum IS NOT NULL AND datum <= CURDATE() AND datum >= ?
                -- Gestaffelte Abkühlzeit: eine Teilnehmerliste, die beim
                -- ersten Blick fehlte, ist oft Stunden später da.
                AND (letzter_scan IS NULL
                     OR (versuche <  3 AND letzter_scan < NOW() - INTERVAL 3 HOUR)
                     OR (versuche >= 3 AND letzter_scan < NOW() - INTERVAL 20 HOUR))
              ORDER BY datum DESC
              LIMIT ' . (int)$budget,
            ['offen', $grenze]
        );

        $nr = 0;
        foreach ($queue as $ev) {
            if (microtime(true) - $start > $maxSekunden) { $stat['abgebrochen'] = true; break; }
            if (Scanner::laufAbbruchGewuenscht($laufId)) { $stat['abbruch'] = true; break; }
            $eid = (int)$ev['event_id'];
            $nr++;
            Scanner::laufFortschritt($laufId, [
                'phase' => 'scan', 'begonnen' => date('Y-m-d H:i:s', (int)$start),
                'i' => $nr, 'gesamt' => count($queue),
                'aktuell' => trim(($ev['datum'] ?? '') . ' ' . ($ev['name'] ?? ('Wettkampf ' . $eid))),
                'neue_funde' => $stat['neue_funde'], 'requests' => self::$requests,
            ]);

            $zeilen = self::meldeliste($eid);
            if ($zeilen === null && self::voruebergehend()) {
                // Nur gestört – kein Fehlversuch, kommt später wieder dran
                $stat['gedrosselt']++;
                DB::query('UPDATE ' . DB::tbl('la_events') . ' SET letzter_scan = NOW() WHERE event_id = ?', [$eid]);
                continue;
            }
            if ($zeilen === null) {
                // Keine Teilnehmerliste – begrenzt nachfassen
                $neuerStatus = ((int)$ev['versuche'] + 1 >= 3 || $ev['datum'] < date('Y-m-d', strtotime('-21 days')))
                    ? 'ohne_liste' : 'offen';
                DB::query('UPDATE ' . DB::tbl('la_events') . ' SET versuche = versuche + 1, letzter_scan = NOW(), status = ? WHERE event_id = ?',
                    [$neuerStatus, $eid]);
                continue;
            }

            [$neu, $passend] = self::funde($eid, $zeilen, $begriffe);
            $stat['gescannt']++;
            $stat['treffer']    += $passend;
            $stat['neue_funde'] += $neu;

            DB::query(
                'UPDATE ' . DB::tbl('la_events') . '
                    SET versuche = versuche + 1, treffer = ?, letzter_scan = NOW(), status = ?
                  WHERE event_id = ?',
                [min(32000, count($zeilen)), 'fertig', $eid]
            );
        }

        // Ein Lauf ohne jede Arbeit sieht sonst aus wie ein Fehler.
        if (!$stat['gescannt'] && !$stat['gedrosselt'] && !$stat['neue_events']) {
            $z = DB::fetchOne(
                'SELECT SUM(status = ?) AS offen,
                        SUM(status = ? AND datum >= ? AND datum <= CURDATE()) AS im_fenster,
                        SUM(status = ?) AS fertig
                   FROM ' . DB::tbl('la_events'), ['offen', 'offen', $grenze, 'fertig']) ?: [];
            $offen  = (int)($z['offen'] ?? 0);
            $imFens = (int)($z['im_fenster'] ?? 0);
            $stat['hinweis'] = $offen === 0
                ? 'Nichts zu tun: alle bekannten Wettkämpfe sind geprüft (' . (int)($z['fertig'] ?? 0) . ').'
                : ($imFens === 0
                    ? 'Nichts zu tun: die ' . $offen . ' offenen Wettkämpfe liegen außerhalb des Fensters ab ' . $grenze . '.'
                    : 'Nichts zu tun: die ' . $imFens . ' offenen Wettkämpfe im Fenster wurden erst vor kurzem geprüft (Abkühlzeit 3 h).');
        }

        $stat['requests'] = self::$requests;
        $stat['dauer']    = round(microtime(true) - $start, 1);
        Scanner::laufFortschritt($laufId, [
            'phase' => 'fertig', 'i' => $stat['gescannt'], 'gesamt' => $stat['gescannt'],
            'aktuell' => !empty($stat['abbruch']) ? 'Abgebrochen'
                         : ($stat['abgebrochen'] ? 'Zeitlimit erreicht' : 'Lauf beendet'),
            'neue_funde' => $stat['neue_funde'], 'requests' => $stat['requests'],
        ]);
        Settings::set('la_scan_letzter_lauf', date('Y-m-d H:i:s'));
        Settings::set('la_scan_letzter_status', json_encode($stat, JSON_UNESCAPED_UNICODE));
        return $stat;
    }

    // Meldezeilen unseres Vereins ablegen. Der Verein steht hier in einem
    // eigenen Feld – geprüft wird trotzdem per Teilstring, weil dieselbe
    // Abteilung mal mit, mal ohne Zusatz geführt wird.
    // Rückgabe: [neu eingefügt, insgesamt passende Zeilen]
    private static function funde(int $eventId, array $zeilen, array $begriffe): array {
        $normBegriffe = array_map([Scanner::class, 'norm'], $begriffe);
        $neu = 0;
        $passend = 0;
        foreach ($zeilen as $z) {
            $verein = trim($z['verein']);
            if ($verein === '') continue;
            $nv = Scanner::norm($verein);
            $passt = false;
            foreach ($normBegriffe as $b) { if ($b !== '' && str_contains($nv, $b)) { $passt = true; break; } }
            if (!$passt) continue;
            $passend++;

            $key = md5('la|' . $eventId . '|' . Scanner::norm($z['name']) . '|' . Scanner::norm($z['startnr']));
            $neu += DB::query(
                'INSERT IGNORE INTO ' . DB::tbl('la_funde') . '
                 (event_id, fund_key, name, verein, lv, jahrgang, startnr, wettbewerb)
                 VALUES (?,?,?,?,?,?,?,?)',
                [$eventId, $key,
                 mb_substr($z['name'], 0, 160), mb_substr($verein, 0, 160),
                 mb_substr($z['lv'], 0, 16), mb_substr($z['jahrgang'], 0, 8),
                 mb_substr($z['startnr'], 0, 24), mb_substr($z['wettbewerb'], 0, 160)]
            )->rowCount();
        }
        return [$neu, $passend];
    }
}
