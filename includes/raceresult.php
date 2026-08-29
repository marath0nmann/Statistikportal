<?php
// ============================================================
// RaceResult-Scanner
// ------------------------------------------------------------
// my.raceresult.com hat keinen wettkampfübergreifenden Ergebnis-
// Endpunkt. Die beiden vorhandenen Bausteine werden hier zu einem
// kombiniert:
//
//   1. Discovery  GET /RREvents/list?country=<numISO>&dateFrom=&dateTo=
//      → alle von RaceResult gezeiteten Events eines Landes im Zeitraum
//        (id, name, dateFrom, location, countryCode, lat/lng, …)
//
//   2. Vereinssuche pro Event
//      GET /{id}/results/list?key=…&listname=…&contest=0&r=search&term=…
//      → serverseitige Volltextsuche über alle Teilnehmer (Name, Verein,
//        Startnummer); liefert nur die Treffer, "data":0 wenn nichts passt.
//        Schlüssel + Listenname kommen aus /{id}/results/config
//        (Fallback /{id}/RRPublish/data/config).
//
// Der Scanner speichert nur den Fund. Der eigentliche Import läuft
// unverändert über den bestehenden RaceResult-Importer im Frontend.
//
// Rate-Limit: RaceResult drosselt hart (HTTP 429 schon bei wenigen
// parallelen Requests). Alle Aufrufe laufen deshalb streng seriell mit
// mindestens 1,15 s Abstand.
// ============================================================

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/settings.php';
require_once __DIR__ . '/scanner.php';

class RaceResult {

    const BASE = 'https://my.raceresult.com';
    const FORTSCHRITT = 'rr_scan_fortschritt';

    // Numerische ISO-3166-Länder-IDs (RREvents/list) → ISO-Alpha-2.
    // Die API filtert unscharf; das Alpha-2 dient zur Nachkontrolle.
    const LAENDER = [
        276 => 'DE',
        528 => 'NL',
         56 => 'BE',
        756 => 'CH',
         40 => 'AT',
        250 => 'FR',
        442 => 'LU',
    ];

    private static float $letzterRequest = 0.0;
    private static int   $requests       = 0;

    public static function requests(): int { return self::$requests; }

    // ── Tabellen (idempotent) ────────────────────────────────────────────
    public static function migrate(): void {
        DB::query("CREATE TABLE IF NOT EXISTS " . DB::tbl('rr_events') . " (
            event_id     INT NOT NULL PRIMARY KEY,
            name         VARCHAR(255) NOT NULL DEFAULT '',
            datum        DATE NULL,
            ort          VARCHAR(160) NOT NULL DEFAULT '',
            land         CHAR(2) NOT NULL DEFAULT '',
            status       ENUM('offen','fertig','ohne_ergebnis') NOT NULL DEFAULT 'offen',
            versuche     SMALLINT NOT NULL DEFAULT 0,
            ok_scans     SMALLINT NOT NULL DEFAULT 0,
            treffer      SMALLINT NOT NULL DEFAULT 0,
            letzter_scan DATETIME NULL,
            entdeckt     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            KEY idx_queue (status, datum),
            KEY idx_scan (status, letzter_scan)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        // Nachrüstung: unterscheidet die Gründe, aus denen ein Wettkampf
        // „offen" bleibt – NULL = keine abrufbare Ergebnisseite, 0 = Seite da,
        // aber RaceResult meldet den Wettkampf noch nicht als beendet.
        try {
            DB::query("ALTER TABLE " . DB::tbl('rr_events') . " ADD COLUMN IF NOT EXISTS event_over TINYINT NULL DEFAULT NULL");
        } catch (Throwable $e) {}

        DB::query("CREATE TABLE IF NOT EXISTS " . DB::tbl('rr_funde') . " (
            id           INT AUTO_INCREMENT PRIMARY KEY,
            event_id     INT NOT NULL,
            fund_key     CHAR(32) NOT NULL,
            name         VARCHAR(160) NOT NULL DEFAULT '',
            verein       VARCHAR(160) NOT NULL DEFAULT '',
            jahrgang     VARCHAR(8)   NOT NULL DEFAULT '',
            geschlecht   VARCHAR(4)   NOT NULL DEFAULT '',
            altersklasse VARCHAR(24)  NOT NULL DEFAULT '',
            wettbewerb   VARCHAR(120) NOT NULL DEFAULT '',
            zeit         VARCHAR(40)  NOT NULL DEFAULT '',
            platz        VARCHAR(24)  NOT NULL DEFAULT '',
            ak_platz     VARCHAR(24)  NOT NULL DEFAULT '',
            startnr      VARCHAR(24)  NOT NULL DEFAULT '',
            status       ENUM('neu','erledigt','ignoriert') NOT NULL DEFAULT 'neu',
            gefunden_am  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uk_fund (fund_key),
            KEY idx_event (event_id, status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    }

    // ── HTTP mit Rate-Limit ──────────────────────────────────────────────
    // Gibt [httpCode, body] zurück; body ist '' bei Transportfehlern.
    private static function http(string $url, int $timeout = 20): array {
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
                'Accept-Language: de,en;q=0.8',
                'Referer: ' . self::BASE . '/',
            ],
        ]);
        $body = curl_exec($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);

        self::$letzterRequest = microtime(true);
        self::$requests++;
        return [$code, is_string($body) ? $body : ''];
    }

    // RaceResult liefert in Listen-/Config-JSON gelegentlich rohe
    // Steuerzeichen (Umbrüche in Kopfzeilen) – json_decode bricht daran ab.
    private static function jsonDecode(string $body): mixed {
        return json_decode(preg_replace('/[\x00-\x1F]/', ' ', $body), true);
    }

    // ── 1. Discovery ─────────────────────────────────────────────────────
    // Alle Events eines Landes im Zeitraum. $landId ist die numerische
    // ISO-ID (DE=276). Die API filtert unscharf, deshalb Nachkontrolle
    // über countryCode.
    public static function events(int $landId, string $von, string $bis): array {
        $url = self::BASE . '/RREvents/list?country=' . $landId
             . '&dateFrom=' . $von . '&dateTo=' . $bis
             . '&limit=2000&modes=&lang=de';
        [$code, $body] = self::http($url);
        if ($code !== 200) return [];
        $j = self::jsonDecode($body);
        if (!is_array($j)) return [];

        $iso = self::LAENDER[$landId] ?? '';
        $out = [];
        foreach ($j as $sektion) {
            foreach (($sektion['Events'] ?? []) as $e) {
                $id = (int)($e['id'] ?? 0);
                if (!$id) continue;
                if ($iso && ($e['countryCode'] ?? '') !== $iso) continue;
                $out[$id] = $e;
            }
        }
        return $out;
    }

    // ── 2a. Event-Config (Key + Listen + Abschluss-Flag) ─────────────────
    // Gibt ['key' => …, 'listen' => […], 'over' => bool] zurück oder null,
    // wenn das Event keine öffentliche Ergebnisseite hat.
    //
    // `EventOver` ist RaceResults eigenes Kennzeichen dafür, dass die
    // Zeitmessung abgeschlossen ist – am Wettkampftag steht es auf False,
    // spätestens am Folgetag auf True. Damit muss der Scanner nicht mehr
    // über zwei Durchgänge raten, ob eine Liste vollständig ist.
    //
    // Wichtig: Listen sind oft an einen Contest gebunden ("Contest":"1").
    // Ein Abruf mit contest=0 antwortet dann mit 404 "list not found" –
    // der Contest muss aus dem Listeneintrag übernommen werden. Nur wenn
    // eine Liste selbst Contest 0 meldet, deckt ein Abruf alle Wettbewerbe ab.
    public static function config(int $eventId): ?array {
        $pfade = [
            '/results/config?lang=de&noVisitor=1&oldFavs=',
            '/RRPublish/data/config?lang=de&page=results&noVisitor=1',
        ];
        foreach ($pfade as $p) {
            [$code, $body] = self::http(self::BASE . '/' . $eventId . $p);
            if ($code !== 200) continue;
            $c = self::jsonDecode($body);
            if (!is_array($c) || empty($c['key'])) continue;

            // Kandidaten aus TabConfig.Lists und lists/list einsammeln.
            // lists ist mal ein Objekt (Name => Contest), mal eine Liste
            // von Objekten mit Name/Contest.
            $kandidaten = [];
            $add = function (string $name, string $contest) use (&$kandidaten) {
                $name = trim($name);
                if ($name === '') return;
                $k = $name . '|' . $contest;
                if (!isset($kandidaten[$k])) $kandidaten[$k] = ['name' => $name, 'contest' => $contest];
            };
            foreach (($c['TabConfig']['Lists'] ?? []) as $l) {
                if (is_array($l)) $add((string)($l['Name'] ?? ''), (string)($l['Contest'] ?? '0'));
            }
            $roh = $c['lists'] ?? $c['list'] ?? [];
            if (is_array($roh)) {
                foreach ($roh as $k => $v) {
                    if (is_array($v))        $add((string)($v['Name'] ?? $k), (string)($v['Contest'] ?? '0'));
                    elseif (is_scalar($v))   $add((string)$k, (string)$v);
                }
            }
            if (!$kandidaten) continue;

            $listen = self::listenWaehlen(array_values($kandidaten));
            if (!$listen) continue;

            $over = $c['EventOver'] ?? null;
            return [
                'key'    => (string)$c['key'],
                'listen' => $listen,
                'over'   => ($over === true || $over === 'True' || $over === 1 || $over === '1'),
            ];
        }
        return null;
    }

    // Pro Contest genau eine Liste – sonst würde jeder Wettkampf vielfach
    // abgefragt. Bevorzugt werden echte Ergebnislisten; Start-/Team-/
    // Live-Listen fallen weg, sofern danach noch etwas übrig bleibt.
    private static function listenWaehlen(array $kandidaten): array {
        $brauchbar = array_values(array_filter($kandidaten, fn($l) => !self::listeGesperrt($l['name'])));
        if (!$brauchbar) $brauchbar = $kandidaten;

        // Ergebnis-/Zieleinlauflisten zuerst
        usort($brauchbar, function ($a, $b) {
            return self::listenRang($a['name']) <=> self::listenRang($b['name']);
        });

        $proContest = [];
        foreach ($brauchbar as $l) {
            if (!isset($proContest[$l['contest']])) $proContest[$l['contest']] = $l;
        }
        // Deckt eine Liste alle Wettbewerbe ab (Contest 0), genügt sie allein
        if (isset($proContest['0'])) return [$proContest['0']];
        return array_slice(array_values($proContest), 0, 4);
    }

    private static function listenRang(string $name): int {
        $n = mb_strtoupper($name);
        if (str_contains($n, 'ERGEBNIS') || str_contains($n, 'RESULT')) return 0;
        if (str_contains($n, 'ZIELEINLAUF') || str_contains($n, 'FINISH')) return 1;
        return 2;
    }

    // Start-/Team-/Live-Listen taugen nicht für Ergebnisfunde.
    private static function listeGesperrt(string $name): bool {
        $n = mb_strtoupper($name);
        if (str_starts_with($n, 'Z_') || str_starts_with($n, '__')) return true;
        foreach (['STAFF','RELAY','MANNSCHAFT','TEAM','LIVE','LEADERBOARD',
                  'PARTICIPANTS','TEILNEHMER','MELDELISTE','STARTLISTE','STATISTI'] as $b) {
            if (str_contains($n, $b)) return true;
        }
        return false;
    }

    // ── 2b. Vereinssuche in einem Event ──────────────────────────────────
    // Gibt die Trefferzeilen als Assoc-Arrays zurück, null bei HTTP-Fehler.
    public static function suche(int $eventId, string $key, string $listname, string $contest, string $begriff): ?array {
        $url = self::BASE . '/' . $eventId . '/results/list'
             . '?key=' . rawurlencode($key)
             . '&listname=' . rawurlencode($listname)
             . '&page=results&contest=' . rawurlencode($contest) . '&r=search&l=9999'
             . '&term=' . rawurlencode($begriff);
        [$code, $body] = self::http($url);
        if ($code !== 200) return null;
        $j = self::jsonDecode($body);
        if (!is_array($j)) return null;

        $felder = $j['DataFields'] ?? [];
        if (!is_array($felder) || !$felder) return [];
        $map = self::feldMap($felder);

        $treffer = [];
        self::zeilenSammeln($j['data'] ?? null, '', count($felder), $treffer);

        $out = [];
        foreach ($treffer as [$wettbewerb, $zeile]) {
            $out[] = [
                'wettbewerb'   => $wettbewerb,
                'name'         => self::feld($zeile, $map, 'name'),
                'vorname'      => self::feld($zeile, $map, 'vorname'),
                'verein'       => self::feld($zeile, $map, 'verein'),
                'jahrgang'     => self::feld($zeile, $map, 'jahrgang'),
                'geschlecht'   => self::feld($zeile, $map, 'geschlecht'),
                'altersklasse' => self::feld($zeile, $map, 'ak'),
                'zeit'         => self::feld($zeile, $map, 'zeit'),
                'platz'        => self::feld($zeile, $map, 'platz'),
                'ak_platz'     => self::feld($zeile, $map, 'ak_platz'),
                'startnr'      => self::feld($zeile, $map, 'startnr'),
                // Rohwerte für den Rückfall in funde(), falls die Liste keine
                // eigene Vereinsspalte hat.
                '_roh'         => array_map(fn($v) => is_scalar($v) ? trim(strip_tags((string)$v)) : '', $zeile),
            ];
        }
        return $out;
    }

    // data ist verschachtelt: {"#1_Marathon": {"#1_Weiblich": [[…],[…]]}}.
    // Gruppenschlüssel "#N_Titel" → Titel; die oberste Ebene ist der Wettbewerb.
    private static function zeilenSammeln($knoten, string $wettbewerb, int $spalten, array &$out): void {
        if (is_array($knoten) && $knoten && array_is_list($knoten)) {
            // Zeilenliste oder Liste von Gruppen
            foreach ($knoten as $z) {
                if (is_array($z) && $z && array_is_list($z) && !is_array($z[0])) {
                    // Zeile – Zählwerte wie [15] aussortieren
                    if (count($z) >= max(3, $spalten - 2)) $out[] = [$wettbewerb, $z];
                } else {
                    self::zeilenSammeln($z, $wettbewerb, $spalten, $out);
                }
            }
            return;
        }
        if (is_array($knoten)) {
            foreach ($knoten as $k => $v) {
                $titel = preg_replace('/^#\d+_/', '', (string)$k);
                self::zeilenSammeln($v, $wettbewerb !== '' ? $wettbewerb : $titel, $spalten, $out);
            }
        }
    }

    // DataFields → Spaltenindizes. Die Feldnamen sind RaceResult-Ausdrücke
    // wie nau([VereinOrt]) oder StatusZeit([ErgebnisNetto]).
    private static function feldMap(array $felder): array {
        $m = [];
        foreach ($felder as $i => $roh) {
            $f = mb_strtolower((string)$roh);
            $setz = function(string $k) use (&$m, $i) { if (!isset($m[$k])) $m[$k] = $i; };

            // „AnzeigeTitel" ist in RaceResult-Vorlagen ein gängiger Name für
            // die Anzeigespalte des Teilnehmers – wurde sie nicht erkannt,
            // blieb der Name leer und die Zeile fiel in funde() heraus,
            // obwohl der Verein passte.
            if (str_contains($f, 'anzeigename') || str_contains($f, 'anzeigetitel')
                || str_contains($f, 'fullname') || str_contains($f, 'displayname')
                || str_contains($f, 'teilnehmer') || str_contains($f, 'participant')
                || str_contains($f, 'flname') || str_contains($f, 'lfname')
                || preg_match('/\[name\]|^name$/', $f))                  $setz('name');
            elseif (str_contains($f, 'nachname') || str_contains($f, 'lastname')) $setz('name');
            elseif (str_contains($f, 'vorname') || str_contains($f, 'firstname'))  $setz('vorname');
            elseif (str_contains($f, 'verein') || str_contains($f, 'club'))        $setz('verein');
            elseif (str_contains($f, 'akpl') || str_contains($f, 'agegrouprank'))  $setz('ak_platz');
            elseif (str_contains($f, 'agegroup') || str_contains($f, 'akabk'))     $setz('ak');
            elseif (str_contains($f, 'zeit') || str_contains($f, 'time'))          $setz('zeit');
            elseif (str_contains($f, 'autorank') || str_contains($f, 'overallrank')
                || preg_match('/^rank1/', $f) || str_contains($f, 'platz'))        $setz('platz');
            elseif ($f === 'year' || $f === 'yob' || str_contains($f, 'jahrgang')
                || str_contains($f, 'birthyear'))                                  $setz('jahrgang');
            elseif ($f === 'mwd' || str_contains($f, 'geschlecht')
                || str_contains($f, 'gender') || $f === 'sex')                     $setz('geschlecht');
            elseif ($f === 'bib' || str_contains($f, 'startnummer'))               $setz('startnr');
        }
        return $m;
    }

    private static function feld(array $zeile, array $map, string $k): string {
        if (!isset($map[$k])) return '';
        $v = $zeile[$map[$k]] ?? '';
        return trim(strip_tags((string)$v));
    }

    // ── Suchbegriffe ─────────────────────────────────────────────────────
    // Explizit konfigurierte Begriffe, sonst Vereinsname + Kurzbezeichnung.
    public static function begriffe(): array {
        $roh = trim(Settings::get('rr_scan_begriffe', ''));
        if ($roh === '') {
            $roh = Settings::get('verein_name', '') . ',' . Settings::get('verein_kuerzel', '');
        }
        $out = [];
        foreach (explode(',', $roh) as $b) {
            $b = trim($b);
            // Rechtsformen weglassen – RaceResult sucht als Teilstring
            $b = trim(preg_replace('/\b(e\.?\s?V\.?|eV)\b\.?$/i', '', $b));
            if (mb_strlen($b) >= 3 && !in_array($b, $out, true)) $out[] = $b;
        }
        return $out;
    }

    // Vergleichsform: klein, ohne Umlaute/Sonderzeichen.
    public static function norm(string $s): string {
        $s = mb_strtolower(trim($s));
        $s = strtr($s, ['ä'=>'ae','ö'=>'oe','ü'=>'ue','ß'=>'ss','é'=>'e','è'=>'e','á'=>'a','à'=>'a']);
        return preg_replace('/[^a-z0-9]+/', '', $s);
    }

    // ── Hauptlauf ────────────────────────────────────────────────────────
    // $budget      max. Events pro Lauf, $maxSekunden Wanduhr-Deckel.
    // $discovery   false = nur Warteschlange abarbeiten.
    // $tage überschreibt das eingestellte Rückblick-Fenster für einen
    // einzelnen Lauf – gedacht zum Aufholen eines Rückstands.
    public static function scan(int $budget = 0, int $maxSekunden = 240, bool $discovery = true, int $tage = 0): array {
        self::migrate();
        $start = microtime(true);

        $budget    = $budget > 0 ? $budget : max(1, (int)Settings::get('rr_scan_budget', '60'));
        $fenster   = $tage > 0 ? min(365, $tage) : max(1, min(60, (int)Settings::get('rr_scan_tage', '14')));
        $begriffe  = self::begriffe();
        $heute     = date('Y-m-d');
        $grenze    = date('Y-m-d', strtotime("-$fenster days"));

        // Abfragebegriffe (reduziert) vs. Prüfbegriffe (vollständig)
        $abfrage = Scanner::sucheBegriffe($begriffe);

        $stat = ['neue_events' => 0, 'gescannt' => 0, 'nicht_final' => 0, 'treffer' => 0,
                 'neue_funde' => 0, 'requests' => 0, 'abgebrochen' => false,
                 'begriffe' => $begriffe, 'abfrage_begriffe' => $abfrage, 'ab' => $grenze];
        if (!$begriffe) {
            $stat['fehler'] = 'Keine Suchbegriffe konfiguriert.';
            Scanner::fortschritt(self::FORTSCHRITT, ['phase' => 'fertig', 'fehler' => $stat['fehler']]);
            return $stat;
        }

        Scanner::fortschritt(self::FORTSCHRITT, [
            'phase' => 'start', 'begonnen' => date('Y-m-d H:i:s'),
            'i' => 0, 'gesamt' => 0, 'aktuell' => 'Lauf gestartet', 'neue_funde' => 0,
        ]);

        // ── Discovery: neue Events der letzten $fenster Tage einsammeln ──
        // Ein ausdrücklich übergebenes Fenster (?tage=…) erzwingt die
        // Discovery auch dann, wenn sie heute schon lief – sonst brächte ein
        // Aufhol-Lauf nichts: die Tagessperre hätte ihn mit dem alten,
        // kleineren Fenster abgehakt.
        $letzteDiscovery = Settings::get('rr_scan_discovery_am', '');
        if ($discovery && ($tage > 0 || $letzteDiscovery !== $heute)) {
            $laender = array_filter(array_map('intval', explode(',', Settings::get('rr_scan_laender', '276,528,56'))));
            foreach ($laender as $landId) {
                if (!isset(self::LAENDER[$landId])) continue;
                Scanner::fortschritt(self::FORTSCHRITT, [
                    'phase' => 'discovery', 'begonnen' => date('Y-m-d H:i:s', (int)$start),
                    'i' => 0, 'gesamt' => 0, 'neue_funde' => 0,
                    'aktuell' => 'Wettkampfsuche ' . self::LAENDER[$landId],
                ]);
                $events = self::events($landId, $grenze, $heute);
                foreach ($events as $eid => $e) {
                    $n = DB::query(
                        'INSERT IGNORE INTO ' . DB::tbl('rr_events') . ' (event_id, name, datum, ort, land) VALUES (?,?,?,?,?)',
                        [$eid, mb_substr((string)($e['name'] ?? ''), 0, 255), $e['dateFrom'] ?? null,
                         mb_substr((string)($e['location'] ?? ''), 0, 160), self::LAENDER[$landId]]
                    )->rowCount();
                    $stat['neue_events'] += $n;
                }
                if (microtime(true) - $start > $maxSekunden) { $stat['abgebrochen'] = true; break; }
            }
            if (!$stat['abgebrochen']) Settings::set('rr_scan_discovery_am', $heute);
        }

        // ── Warteschlange: offene Events, deren Termin vorbei ist ────────
        $queue = DB::fetchAll(
            'SELECT * FROM ' . DB::tbl('rr_events') . '
              WHERE status = ? AND datum IS NOT NULL AND datum <= CURDATE()
                -- Auch nach unten begrenzen: sonst bleiben Wettkämpfe, die
                -- unter einem früher größeren Fenster entdeckt wurden, für
                -- immer in der Warteschlange und belegen das Budget. Wird das
                -- Fenster wieder vergrößert, kommen sie von selbst zurück.
                AND datum >= ?
                -- Abkühlzeit: Wettkämpfe, die noch nicht abgeschlossen waren,
                -- lohnen einen neuen Blick schon nach 3 Stunden – ein Lauf
                -- vom Vormittag ist am Abend fertig. Die früheren 20 h
                -- stammten aus der Zwei-Durchgang-Regel und sind erst nach
                -- mehreren Fehlversuchen sinnvoll.
                AND (letzter_scan IS NULL
                     OR (versuche <  8 AND letzter_scan < NOW() - INTERVAL 3 HOUR)
                     OR (versuche >= 8 AND letzter_scan < NOW() - INTERVAL 20 HOUR))
              -- Wettkämpfe vergangener Tage zuerst: die von heute sind
              -- meist noch nicht abgeschlossen und würden den Platz im
              -- Budget belegen, ohne verwertbare Listen zu liefern.
              ORDER BY (datum < CURDATE()) DESC, letzter_scan IS NULL DESC, datum DESC
              LIMIT ' . (int)$budget,
            ['offen', $grenze]
        );

        $nr = 0;
        foreach ($queue as $ev) {
            if (microtime(true) - $start > $maxSekunden) { $stat['abgebrochen'] = true; break; }
            $eid = (int)$ev['event_id'];
            $nr++;
            Scanner::fortschritt(self::FORTSCHRITT, [
                'phase'   => 'scan', 'begonnen' => date('Y-m-d H:i:s', (int)$start),
                'i'       => $nr, 'gesamt' => count($queue),
                'aktuell' => trim(($ev['datum'] ?? '') . ' ' . ($ev['name'] ?? ('Event ' . $eid))),
                'neue_funde' => $stat['neue_funde'], 'requests' => self::$requests,
            ]);

            $cfg = self::config($eid);
            if (!$cfg) {
                // Noch keine öffentliche Ergebnisseite – begrenzt nachfassen
                $neuerStatus = ((int)$ev['versuche'] + 1 >= 6 || $ev['datum'] < date('Y-m-d', strtotime('-21 days')))
                    ? 'ohne_ergebnis' : 'offen';
                DB::query('UPDATE ' . DB::tbl('rr_events') . ' SET versuche = versuche + 1, letzter_scan = NOW(), event_over = NULL, status = ? WHERE event_id = ?',
                    [$neuerStatus, $eid]);
                continue;
            }

            // Noch nicht abgeschlossen → gar nicht erst durchsuchen. Das spart
            // die Suchabrufe und verhindert Funde mit vorläufigen Zeiten, die
            // beim späteren Lauf als zweiter Fund derselben Person auftauchen
            // würden (der Schlüssel enthält die Zeit).
            if (!$cfg['over']) {
                $stat['nicht_final']++;
                $neuerStatus = ($ev['datum'] < date('Y-m-d', strtotime('-21 days'))) ? 'ohne_ergebnis' : 'offen';
                DB::query('UPDATE ' . DB::tbl('rr_events') . ' SET versuche = versuche + 1, letzter_scan = NOW(), event_over = 0, status = ? WHERE event_id = ?',
                    [$neuerStatus, $eid]);
                continue;
            }

            // Je Contest eine Liste abfragen; einzelne nicht abrufbare Listen
            // überspringen, solange mindestens eine geantwortet hat.
            $zeilen = [];
            $erfolg = false;
            foreach ($cfg['listen'] as $liste) {
                $rowsListe = [];
                foreach ($abfrage as $begriff) {
                    $r = self::suche($eid, $cfg['key'], $liste['name'], $liste['contest'], $begriff);
                    if ($r === null) { $rowsListe = null; break; }
                    foreach ($r as $z) $rowsListe[] = $z;
                }
                if ($rowsListe === null) continue;
                $erfolg = true;
                foreach ($rowsListe as $z) $zeilen[] = $z;
            }

            if (!$erfolg) {
                // Config da, aber keine Liste abrufbar – wie eine fehlende
                // Ergebnisseite begrenzt nachfassen, sonst bleibt das Event
                // dauerhaft in der Warteschlange.
                $neuerStatus = ((int)$ev['versuche'] + 1 >= 6 || $ev['datum'] < date('Y-m-d', strtotime('-21 days')))
                    ? 'ohne_ergebnis' : 'offen';
                DB::query('UPDATE ' . DB::tbl('rr_events') . ' SET versuche = versuche + 1, letzter_scan = NOW(), event_over = NULL, status = ? WHERE event_id = ?',
                    [$neuerStatus, $eid]);
                continue;
            }

            $neu = self::funde($eid, $zeilen, $begriffe);
            $stat['gescannt']++;
            $stat['treffer']    += count($zeilen);
            $stat['neue_funde'] += $neu;

            // RaceResult meldet den Wettkampf als abgeschlossen (EventOver),
            // die Liste ändert sich also nicht mehr – ein Durchgang genügt.
            // Früher waren es zwei im Abstand von 20 h; das war doppelt so
            // teuer und trotzdem nur geraten.
            $okScans = (int)$ev['ok_scans'] + 1;
            $fertig  = true;
            DB::query(
                'UPDATE ' . DB::tbl('rr_events') . '
                    SET ok_scans = ?, versuche = versuche + 1, treffer = ?, letzter_scan = NOW(),
                        event_over = 1, status = ?
                  WHERE event_id = ?',
                [$okScans, min(32000, count($zeilen)), $fertig ? 'fertig' : 'offen', $eid]
            );
        }

        // Ein Lauf ohne jede Arbeit sieht sonst aus wie ein Fehler. Sagen,
        // warum nichts zu tun war.
        if (!$stat['gescannt'] && !$stat['nicht_final'] && !$stat['neue_events']) {
            $z = DB::fetchOne(
                'SELECT SUM(status = ?) AS offen,
                        SUM(status = ? AND datum >= ? AND datum <= CURDATE()) AS im_fenster,
                        SUM(status = ?) AS fertig
                   FROM ' . DB::tbl('rr_events'), ['offen', 'offen', $grenze, 'fertig']) ?: [];
            $offen  = (int)($z['offen'] ?? 0);
            $imFens = (int)($z['im_fenster'] ?? 0);
            $stat['hinweis'] = $offen === 0
                ? 'Nichts zu tun: alle bekannten Wettkämpfe sind geprüft ('
                  . (int)($z['fertig'] ?? 0) . ').'
                : ($imFens === 0
                    ? 'Nichts zu tun: die ' . $offen . ' offenen Wettkämpfe liegen außerhalb des Fensters ab '
                      . $grenze . '. Mit &tage=N erneut starten.'
                    : 'Nichts zu tun: die ' . $imFens . ' offenen Wettkämpfe im Fenster wurden erst vor '
                      . 'kurzem geprüft (Abkühlzeit 3 h). Später erneut starten.');
        }

        $stat['requests'] = self::$requests;
        $stat['dauer']    = round(microtime(true) - $start, 1);
        Scanner::fortschritt(self::FORTSCHRITT, [
            'phase' => 'fertig', 'i' => $stat['gescannt'], 'gesamt' => $stat['gescannt'],
            'aktuell' => $stat['abgebrochen'] ? 'Zeitlimit erreicht' : 'Lauf beendet',
            'neue_funde' => $stat['neue_funde'], 'requests' => $stat['requests'],
        ]);
        Settings::set('rr_scan_letzter_lauf', date('Y-m-d H:i:s'));
        Settings::set('rr_scan_letzter_status', json_encode($stat, JSON_UNESCAPED_UNICODE));
        return $stat;
    }

    // Trefferzeilen ablegen. Die Volltextsuche trifft auch Namen und
    // Startnummern – deshalb nur Zeilen behalten, deren Vereinsfeld
    // wirklich einen der Suchbegriffe enthält. Fehlt eine Vereinsspalte,
    // wird die Zeile verworfen (sonst überwiegt das Rauschen).
    private static function funde(int $eventId, array $zeilen, array $begriffe): int {
        $normBegriffe = array_map([self::class, 'norm'], $begriffe);
        // Nur mehrteilige Begriffe taugen für den Rückfall unten: „TuS Oedt"
        // ist eindeutig genug, „Oedt" allein wäre auch ein Wohnort.
        $eindeutig = [];
        foreach ($begriffe as $i => $b) {
            if (count(preg_split('/\s+/', trim($b), -1, PREG_SPLIT_NO_EMPTY) ?: []) >= 2)
                $eindeutig[] = $normBegriffe[$i];
        }

        $neu = 0;
        foreach ($zeilen as $z) {
            $verein = trim($z['verein'] ?? '');

            // Manche Ergebnislisten führen gar keine Vereinsspalte (sie zeigen
            // z.B. nur den Wohnort). Dann ist die Zeile nicht verloren: die
            // serverseitige Suche hat ja irgendwo getroffen. Ein mehrteiliger
            // Begriff, der in einem der Rohfelder steht, wird deshalb als
            // Vereinsangabe übernommen.
            if ($verein === '' && $eindeutig && !empty($z['_roh'])) {
                foreach ($z['_roh'] as $wert) {
                    $nw = self::norm((string)$wert);
                    foreach ($eindeutig as $b) {
                        if ($b !== '' && str_contains($nw, $b)) { $verein = trim((string)$wert); break 2; }
                    }
                }
            }
            if ($verein === '') continue;

            $nv = self::norm($verein);
            $passt = false;
            foreach ($normBegriffe as $b) { if ($b !== '' && str_contains($nv, $b)) { $passt = true; break; } }
            if (!$passt) continue;

            $name = trim($z['name'] ?? '');
            if ($name !== '' && ($z['vorname'] ?? '') !== '') $name = trim($z['vorname'] . ' ' . $name);
            if ($name === '') continue;

            $key = md5($eventId . '|' . self::norm($name) . '|' . self::norm($z['wettbewerb'] ?? '') . '|' . self::norm($z['zeit'] ?? ''));
            $n = DB::query(
                'INSERT IGNORE INTO ' . DB::tbl('rr_funde') . '
                 (event_id, fund_key, name, verein, jahrgang, geschlecht, altersklasse, wettbewerb, zeit, platz, ak_platz, startnr)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
                [$eventId, $key,
                 mb_substr($name, 0, 160), mb_substr($verein, 0, 160),
                 mb_substr($z['jahrgang'] ?? '', 0, 8), mb_substr($z['geschlecht'] ?? '', 0, 4),
                 mb_substr($z['altersklasse'] ?? '', 0, 24), mb_substr($z['wettbewerb'] ?? '', 0, 120),
                 mb_substr($z['zeit'] ?? '', 0, 40), mb_substr($z['platz'] ?? '', 0, 24),
                 mb_substr($z['ak_platz'] ?? '', 0, 24), mb_substr($z['startnr'] ?? '', 0, 24)]
            )->rowCount();
            $neu += $n;
        }
        return $neu;
    }
}
