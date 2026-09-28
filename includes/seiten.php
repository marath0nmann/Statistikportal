<?php
// ============================================================
// includes/seiten.php
// Serverseitig gerenderte Textfassung öffentlicher Seiten.
//
// Die App ist eine SPA: Inhalte entstehen erst per JavaScript im Browser.
// Werkzeuge ohne JavaScript (KI-Assistenten wie Claude, Suchmaschinen,
// Link-Vorschauen, Screenreader-Proxys) sehen sonst nur eine leere Hülle.
// Diese Klasse liefert deshalb unter Pfad-URLs wie /athlet/<slug>,
// /veranstaltung/<id> und /rekorde/<kategorie>/<disziplin> eine schlichte
// HTML-Fassung mit denselben Daten, die ein nicht angemeldeter Besucher in
// der App sieht. Browser leiten per JavaScript sofort auf die SPA weiter
// (/#athlet/<slug> usw.) – Menschen bemerken die Textfassung nicht.
//
// Sichtbarkeit wie für Gäste in der App:
//   - kein Jahrgang, keine Gruppen (Recht personenbezogene_daten)
//   - Athletenliste nur aktive Athleten (Recht inaktive_athleten_sehen)
//   - nur freigegebene, nicht gelöschte Veranstaltungen
//   - Wartungsmodus → keine Daten
// ============================================================

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/settings.php';
require_once __DIR__ . '/helfer.php';

class Seiten {

    // ── Grundlagen ──────────────────────────────────────────────────────────

    public static function h($s): string {
        return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
    }

    // Wie normalizeUmlauts() + Slug-Bildung im Frontend (09a_utils_shared.js)
    private static function ascii(string $s): string {
        $s = strtr($s, ['ß' => 'ss', 'ä' => 'ae', 'ö' => 'oe', 'ü' => 'ue',
                        'Ä' => 'Ae', 'Ö' => 'Oe', 'Ü' => 'Ue', 'ø' => 'o', 'Ø' => 'O',
                        'æ' => 'ae', 'Æ' => 'Ae', 'œ' => 'oe', 'Œ' => 'Oe', 'ð' => 'd', 'Ð' => 'D']);
        if (class_exists('Normalizer')) {
            $n = Normalizer::normalize($s, Normalizer::FORM_D);
            if ($n !== false) $s = preg_replace('/\p{Mn}/u', '', $n);
        }
        return mb_strtolower($s, 'UTF-8');
    }

    // _athSlug() im Frontend (05_athleten.js) – bewusst ohne Akzent-Entfernung,
    // sonst stimmen die Slugs nicht mit den Links der App überein
    public static function athletSlug(?string $vorname, ?string $nachname): string {
        $s = mb_strtolower(($vorname ?? '') . '-' . ($nachname ?? ''), 'UTF-8');
        $s = strtr($s, ['ä' => 'ae', 'ö' => 'oe', 'ü' => 'ue', 'ß' => 'ss']);
        return trim(preg_replace('/[^a-z0-9]+/', '-', $s), '-');
    }

    // diszSlug() im Frontend (02_app.js): "5.000 m" → "5000-m"
    public static function diszSlug(?string $name): string {
        $s = self::ascii((string)$name);
        $s = preg_replace('/(\d)\.(?=\d{3}\b)/', '$1', $s);
        return trim(preg_replace('/[^a-z0-9]+/', '-', $s), '-');
    }

    public static function datum(?string $iso): string {
        if (!$iso || !preg_match('/^(\d{4})-(\d{2})-(\d{2})/', $iso, $m)) return '';
        return $m[3] . '.' . $m[2] . '.' . $m[1];
    }

    // Ergebnis als Klartext mit Einheit (wie _sharePromptResult() im Frontend)
    public static function resultat($raw, ?string $fmt): string {
        $raw = trim((string)$raw);
        if ($raw === '') return '–';
        $fmt = $fmt ?: 'min';
        if ($fmt === 'm')   return str_replace('.', ',', $raw) . ' m';
        if ($fmt === 'pkt') return $raw . ' Punkte';
        if (strpos($raw, ':') === false) {
            return str_replace('.', ',', $raw) . ($fmt === 's' ? ' s' : '');
        }
        // "00:39:57" → "39:57 min", "3:36:19" → "3:36:19 h", "0:05:30" → "5:30 min"
        $t = $raw;
        while (preg_match('/^0+:/', $t)) $t = preg_replace('/^0+:/', '', $t);
        $t = preg_replace('/^0(?=\d)/', '', $t);
        $t = str_replace('.', ',', $t);
        return $t . (substr_count($t, ':') >= 2 ? ' h' : ' min');
    }

    // Vergleichswert: Sekunden bzw. Meter/Punkte
    public static function wert($raw, ?string $fmt, $num = null): ?float {
        if ($num !== null && $num !== '' && is_numeric($num)) return (float)$num;
        $s = str_replace([',', ';'], '.', trim((string)$raw));
        if ($s === '') return null;
        if ($fmt !== 'm' && $fmt !== 'pkt' && strpos($s, ':') !== false) {
            $p = explode(':', $s);
            $v = 0.0;
            foreach ($p as $teil) $v = $v * 60 + (float)$teil;
            return $v;
        }
        return is_numeric($s) ? (float)$s : null;
    }

    private static function absteigend(?string $fmt, ?string $sortDir): bool {
        if ($sortDir) return strtoupper($sortDir) === 'DESC';
        return $fmt === 'm' || $fmt === 'pkt';
    }

    private static function besser(?float $a, ?float $b, bool $desc): bool {
        if ($a === null) return false;
        if ($b === null) return true;
        return $desc ? $a > $b + 0.0001 : $a < $b - 0.0001;
    }

    private static function gleich(?float $a, ?float $b): bool {
        return $a !== null && $b !== null && abs($a - $b) < 0.001;
    }

    // calcDlvAK() im Frontend (07_eintragen.js)
    public static function dlvAk($jahrgang, ?string $geschlecht, int $jahr): string {
        if (!$jahrgang) return '';
        $alter = $jahr - (int)$jahrgang;
        if ($alter < 5) return '';
        $g = preg_match('/^[WwFf]/', (string)$geschlecht) ? 'W' : 'M';
        if ($alter < 13) return $g . 'U12';
        if ($alter < 15) return $g . 'U14';
        if ($alter < 17) return $g . 'U16';
        if ($alter < 19) return $g . 'U18';
        if ($alter < 21) return $g . 'U20';
        if ($alter < 23) return $g . 'U23';
        if ($alter < 30) return $g . 'HK';
        return $g . min(75, intdiv($alter, 5) * 5);
    }

    private static function mstrMap(): array {
        $map = [];
        foreach (json_decode(Settings::get('meisterschaften_liste', '[]') ?: '[]', true) ?: [] as $m) {
            if (!empty($m['id']) && !empty($m['label'])) $map[(int)$m['id']] = $m['label'];
        }
        return $map;
    }

    private static function mstrText(array $e, array $mstr): string {
        if (empty($e['meisterschaft'])) return '';
        $lbl = $mstr[(int)$e['meisterschaft']] ?? ('Meisterschaft ' . $e['meisterschaft']);
        if (!preg_match('/meisterschaft/i', $lbl)) $lbl .= '-Meisterschaften';
        if (!empty($e['ak_platz_meisterschaft'])) $lbl .= ' – ' . (int)$e['ak_platz_meisterschaft'] . '. Platz';
        return $lbl;
    }

    private static function name(array $a): string {
        return trim(($a['vorname'] ?? '') . ' ' . ($a['nachname'] ?? ''));
    }

    // "Nachname, Vorname" → "Vorname Nachname"
    private static function nameNv(?string $nv): string {
        $p = explode(', ', (string)$nv, 2);
        return count($p) === 2 ? trim($p[1] . ' ' . $p[0]) : (string)$nv;
    }

    // ── URLs ────────────────────────────────────────────────────────────────

    // Basis-URL der App, z.B. https://statistik.tus-oedt.de (ohne Schrägstrich).
    // Die Seiten liegen eine Ebene unter der App (/athlet/index.php usw.).
    public static function basis(): string {
        $https = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
        $host  = $_SERVER['HTTP_HOST'] ?? 'statistik.tus-oedt.de';
        if (!preg_match('/^[a-z0-9.\-]+(:\d+)?$/i', $host)) $host = 'statistik.tus-oedt.de';
        $pfad  = rtrim(str_replace('\\', '/', dirname(dirname($_SERVER['SCRIPT_NAME'] ?? '/x/index.php'))), '/');
        return ($https ? 'https' : 'http') . '://' . $host . $pfad;
    }

    // Slug/ID aus der Anfrage: /athlet/nadine-hillgruber → ['nadine-hillgruber']
    public static function pfadTeile(string $bereich): array {
        $uri = (string)parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
        $uri = rawurldecode($uri);
        $pos = strpos($uri, '/' . $bereich . '/');
        $rest = $pos === false ? '' : substr($uri, $pos + strlen($bereich) + 2);
        $rest = preg_replace('#^index\.php/?#', '', $rest);
        return array_values(array_filter(explode('/', $rest), 'strlen'));
    }

    // ── Seitenrahmen ────────────────────────────────────────────────────────

    // $o: titel, beschreibung, pfad (kanonisch, z.B. "athlet/x"), spa (Hash ohne #),
    //     inhalt (HTML), status (HTTP), og_typ
    public static function ausgeben(array $o): void {
        $basis   = self::basis();
        $verein  = self::verein();
        $canon   = $basis . '/' . ltrim($o['pfad'] ?? '', '/');
        $spa     = $basis . '/#' . ($o['spa'] ?? '');
        $titel   = $o['titel'] ?? $verein;
        $desc    = $o['beschreibung'] ?? '';
        $status  = (int)($o['status'] ?? 200);
        if ($status !== 200) http_response_code($status);
        header('Content-Type: text/html; charset=utf-8');
        header('Cache-Control: public, max-age=300');
        if ($status !== 200) header('X-Robots-Tag: noindex');

        $h = [self::class, 'h'];
        echo '<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>' . $h($titel) . '</title>
<meta name="description" content="' . $h($desc) . '">
<meta property="og:title" content="' . $h($titel) . '">
<meta property="og:description" content="' . $h($desc) . '">
<meta property="og:url" content="' . $h($canon) . '">
<meta property="og:type" content="' . $h($o['og_typ'] ?? 'website') . '">
<meta property="og:site_name" content="' . $h($verein) . '">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="' . $h($titel) . '">
<meta name="twitter:description" content="' . $h($desc) . '">
<link rel="canonical" href="' . $h($canon) . '">
<script>window.location.replace(' . json_encode($spa, JSON_UNESCAPED_SLASHES | JSON_HEX_TAG) . ');</script>
<style>
body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;max-width:960px;margin:0 auto;padding:16px;color:#1a1a1a;background:#fff;line-height:1.45}
table{border-collapse:collapse;width:100%;margin:8px 0 20px;font-size:14px}
th,td{border-bottom:1px solid #ddd;padding:4px 8px;text-align:left;vertical-align:top}
th{background:#f4f4f4}
h1{margin-bottom:4px}h2{margin-top:28px;border-bottom:2px solid #cc0000;padding-bottom:2px}
a{color:#003087}.klein{color:#555;font-size:13px}
</style>
</head>
<body>
<nav class="klein"><a href="' . $h($basis . '/') . '">' . $h($verein . ' – ' . self::untertitel()) . '</a> ·
<a href="' . $h($basis . '/veranstaltung/') . '">Veranstaltungen</a> ·
<a href="' . $h($basis . '/rekorde/') . '">Bestenlisten</a> ·
<a href="' . $h($basis . '/athlet/') . '">Athleten</a></nav>
<main>
' . ($o['inhalt'] ?? '') . '
</main>
<footer class="klein"><p>Textfassung für Programme ohne JavaScript. Die interaktive Ansicht: <a href="' . $h($spa) . '">' . $h($spa) . '</a></p></footer>
</body>
</html>';
    }

    public static function verein(): string {
        try { return Settings::get('verein_name', 'TuS Oedt') ?: 'TuS Oedt'; } catch (\Throwable $e) { return 'TuS Oedt'; }
    }
    public static function untertitel(): string {
        try { return Settings::get('app_untertitel', 'Leichtathletik-Statistik') ?: 'Statistik'; } catch (\Throwable $e) { return 'Statistik'; }
    }

    // Nur Weiterleitung, keine Daten (DB-Fehler, Wartung)
    public static function leer(string $pfad, string $spa, string $titel = '', int $status = 200, string $text = ''): void {
        self::ausgeben([
            'titel'  => $titel ?: self::verein() . ' – ' . self::untertitel(),
            'pfad'   => $pfad, 'spa' => $spa, 'status' => $status,
            'inhalt' => '<p>' . self::h($text ?: 'Weiterleitung zur App …') . '</p>',
        ]);
    }

    public static function wartung(): bool {
        try { return Settings::get('wartung_aktiv', '0') === '1'; } catch (\Throwable $e) { return false; }
    }

    // Link auf die Veranstaltungsseite – nur für freigegebene Veranstaltungen,
    // die anderen haben keine öffentliche Seite
    private static function veranstLink(array $r): string {
        $n = $r['vname'] ?? '';
        if ($n === '' || $n === null) return '–';
        if (!empty($r['vid']) && (int)($r['genehmigt'] ?? 0) === 1) {
            return '<a href="' . self::h(self::basis() . '/veranstaltung/' . $r['vid']) . '">' . self::h($n) . '</a>';
        }
        return self::h($n);
    }

    private static function tabelle(array $kopf, array $zeilen): string {
        $o = '<table><thead><tr>';
        foreach ($kopf as $k) $o .= '<th>' . self::h($k) . '</th>';
        $o .= '</tr></thead><tbody>';
        foreach ($zeilen as $z) {
            $o .= '<tr>';
            foreach ($z as $zelle) $o .= '<td>' . $zelle . '</td>';   // Zellen sind bereits HTML
            $o .= '</tr>';
        }
        return $o . '</tbody></table>';
    }

    // ── Vereinsbestwerte (Rekorde gesamt / Geschlecht / AK) ─────────────────
    // Eine Abfrage über alle Vereinsergebnisse, Auswertung in PHP. Gleiche
    // Grundmenge wie die Bestenliste der App (extern=0, nichts Gelöschtes),
    // AK zusammengefasst wie dort (buildAkCaseExpr).

    private static ?array $bestCache = null;

    private static function vereinsErgebnisse(): array {
        $akExpr = buildAkCaseExpr(true);
        return DB::fetchAll(
            "SELECT e.athlet_id, e.disziplin, e.disziplin_mapping_id AS mid, e.resultat, e.resultat_num,
                    ($akExpr) AS ak, a.geschlecht, a.vorname, a.nachname, v.datum, v.id AS vid, v.genehmigt,
                    COALESCE(v.name, v.kuerzel) AS vname,
                    COALESCE(m.fmt_override, k.fmt, 'min') AS fmt, k.sort_dir, k.tbl_key, k.name AS kat_name,
                    COALESCE(k.reihenfolge, 99) AS kat_sort, COALESCE(m.hof_exclude, 0) AS hof_exclude,
                    COALESCE(m.disziplin, e.disziplin) AS disz_name
             FROM " . DB::tbl('ergebnisse') . " e
             JOIN " . DB::tbl('athleten') . " a ON a.id = e.athlet_id
             JOIN " . DB::tbl('veranstaltungen') . " v ON v.id = e.veranstaltung_id
             LEFT JOIN " . DB::tbl('disziplin_mapping') . " m ON m.id = e.disziplin_mapping_id
             LEFT JOIN " . DB::tbl('disziplin_kategorien') . " k ON k.id = m.kategorie_id
             WHERE e.geloescht_am IS NULL AND e.extern = 0
               AND a.geloescht_am IS NULL AND v.geloescht_am IS NULL"
        );
    }

    private static function geschlechtVon(array $r): string {
        if ($r['geschlecht'] === 'M' || $r['geschlecht'] === 'W') return $r['geschlecht'];
        if ($r['geschlecht'] === null || $r['geschlecht'] === '') {
            $ak = (string)$r['ak'];
            if (str_starts_with($ak, 'M')) return 'M';
            if (str_starts_with($ak, 'W') || str_starts_with($ak, 'F')) return 'W';
        }
        return '';
    }

    // Bestwerte je Disziplin: ['gesamt' => w, 'M' => w, 'W' => w, 'ak' => [ak => w]]
    private static function bestwerte(): array {
        if (self::$bestCache !== null) return self::$bestCache;
        $best = [];
        foreach (self::vereinsErgebnisse() as $r) {
            $key  = $r['mid'] ? 'm' . $r['mid'] : 'd' . $r['disziplin'];
            $desc = self::absteigend($r['fmt'], $r['sort_dir']);
            $w    = self::wert($r['resultat'], $r['fmt'], $r['resultat_num']);
            if ($w === null) continue;
            $b = &$best[$key];
            if ($b === null) $b = ['gesamt' => null, 'M' => null, 'W' => null, 'ak' => []];
            if (self::besser($w, $b['gesamt'], $desc)) $b['gesamt'] = $w;
            $g = self::geschlechtVon($r);
            if ($g && self::besser($w, $b[$g], $desc)) $b[$g] = $w;
            $ak = (string)$r['ak'];
            if ($ak !== '' && self::besser($w, $b['ak'][$ak] ?? null, $desc)) $b['ak'][$ak] = $w;
            unset($b);
        }
        return self::$bestCache = $best;
    }

    // ── Athletenprofil ──────────────────────────────────────────────────────

    public static function athletFinden(string $slug): ?array {
        foreach (DB::fetchAll('SELECT * FROM ' . DB::tbl('athleten') . ' WHERE geloescht_am IS NULL') as $a) {
            if (self::athletSlug($a['vorname'], $a['nachname']) === $slug) return $a;
        }
        return null;
    }

    public static function athlet(string $slug): void {
        $pfad = 'athlet/' . $slug;
        if ($slug === '') { self::athletListe(); return; }
        if (self::wartung()) { self::leer($pfad, $pfad); return; }
        $a = self::athletFinden($slug);
        if (!$a) {
            self::leer($pfad, $pfad, '', 404, 'Athlet nicht gefunden.');
            return;
        }
        $h      = [self::class, 'h'];
        $basis  = self::basis();
        $verein = self::verein();
        $name   = self::name($a);
        $mstr   = self::mstrMap();

        $alle = DB::fetchAll(
            "SELECT e.id, e.disziplin, e.disziplin_mapping_id AS mid, e.resultat, e.resultat_num, e.altersklasse,
                    e.ak_platzierung, e.meisterschaft, e.ak_platz_meisterschaft, e.extern, e.verein,
                    v.id AS vid, COALESCE(v.name, v.kuerzel) AS vname, v.datum, v.genehmigt,
                    COALESCE(o.name, v.ort) AS ort,
                    COALESCE(m.fmt_override, k.fmt, 'min') AS fmt, k.sort_dir,
                    COALESCE(k.name, 'Sonstige') AS kat_name, COALESCE(k.reihenfolge, 99) AS kat_sort,
                    COALESCE(m.hof_exclude, 0) AS hof_exclude, COALESCE(m.disziplin, e.disziplin) AS disz_name
             FROM " . DB::tbl('ergebnisse') . " e
             LEFT JOIN " . DB::tbl('veranstaltungen') . " v ON v.id = e.veranstaltung_id
             LEFT JOIN " . DB::tbl('orte') . " o ON o.id = v.ort_id
             LEFT JOIN " . DB::tbl('disziplin_mapping') . " m ON m.id = e.disziplin_mapping_id
             LEFT JOIN " . DB::tbl('disziplin_kategorien') . " k ON k.id = m.kategorie_id
             WHERE e.athlet_id = ? AND e.geloescht_am IS NULL AND (v.id IS NULL OR v.geloescht_am IS NULL)
             ORDER BY v.datum DESC, e.id DESC",
            [(int)$a['id']]
        );

        $anz    = count($alle);
        $anzExt = count(array_filter($alle, function($e) { return (int)$e['extern'] === 1; }));
        $ak     = ($a['geschlecht'] ?? '') ? self::dlvAk($a['geburtsjahr'] ?? null, $a['geschlecht'], (int)date('Y')) : '';
        $geschl = ['M' => 'männlich', 'W' => 'weiblich', 'D' => 'divers'][$a['geschlecht'] ?? ''] ?? '';


        // ── Persönliche Bestleistungen je Disziplin (Verein + extern, wie App)
        $pb = [];
        foreach ($alle as $e) {
            if ((int)$e['hof_exclude'] === 1) continue;
            $key = $e['mid'] ? 'm' . $e['mid'] : 'd' . $e['disziplin'];
            $w   = self::wert($e['resultat'], $e['fmt'], $e['resultat_num']);
            if ($w === null) continue;
            $desc = self::absteigend($e['fmt'], $e['sort_dir']);
            if (!isset($pb[$key]) || self::besser($w, $pb[$key]['_w'], $desc)) $pb[$key] = $e + ['_w' => $w];
        }
        uasort($pb, function($x, $y) {
            return [(int)$x['kat_sort'], diszSortKey($x['disz_name']), $x['disz_name']]
               <=> [(int)$y['kat_sort'], diszSortKey($y['disz_name']), $y['disz_name']];
        });

        // ── Vereinsbestleistungen dieses Athleten (nur Vereinsergebnisse)
        $best  = self::bestwerte();
        $ausz  = [];
        $eigen = [];   // key → ['w' => bester Wert, 'ak' => [ak => bester Wert]]
        $akExpr = buildAkCaseExpr(true);
        $akRows = DB::fetchAll(
            "SELECT e.disziplin, e.disziplin_mapping_id AS mid, e.resultat, e.resultat_num, ($akExpr) AS ak,
                    COALESCE(m.fmt_override, k.fmt, 'min') AS fmt, k.sort_dir, COALESCE(m.hof_exclude, 0) AS hof_exclude,
                    COALESCE(m.disziplin, e.disziplin) AS disz_name, COALESCE(k.name, 'Sonstige') AS kat_name
             FROM " . DB::tbl('ergebnisse') . " e
             JOIN " . DB::tbl('veranstaltungen') . " v ON v.id = e.veranstaltung_id
             LEFT JOIN " . DB::tbl('disziplin_mapping') . " m ON m.id = e.disziplin_mapping_id
             LEFT JOIN " . DB::tbl('disziplin_kategorien') . " k ON k.id = m.kategorie_id
             WHERE e.athlet_id = ? AND e.extern = 0 AND e.geloescht_am IS NULL AND v.geloescht_am IS NULL",
            [(int)$a['id']]
        );
        foreach ($akRows as $r) {
            if ((int)$r['hof_exclude'] === 1) continue;
            $key  = $r['mid'] ? 'm' . $r['mid'] : 'd' . $r['disziplin'];
            $w    = self::wert($r['resultat'], $r['fmt'], $r['resultat_num']);
            if ($w === null) continue;
            $desc = self::absteigend($r['fmt'], $r['sort_dir']);
            if (!isset($eigen[$key])) $eigen[$key] = ['w' => null, 'ak' => [], 'disz' => $r['disz_name'], 'kat' => $r['kat_name']];
            if (self::besser($w, $eigen[$key]['w'], $desc)) $eigen[$key]['w'] = $w;
            $akr = (string)$r['ak'];
            if ($akr !== '' && self::besser($w, $eigen[$key]['ak'][$akr] ?? null, $desc)) $eigen[$key]['ak'][$akr] = $w;
        }
        foreach ($eigen as $key => $ei) {
            $b = $best[$key] ?? null;
            if (!$b) continue;
            $gesamt = self::gleich($ei['w'], $b['gesamt']);
            if ($gesamt) $ausz[] = ['Vereinsrekord (Gesamtbestleistung)', $ei['disz'], $ei['kat']];
            $g = $a['geschlecht'] ?? '';
            if (!$gesamt && ($g === 'M' || $g === 'W') && self::gleich($ei['w'], $b[$g])) {
                $ausz[] = [$g === 'M' ? 'Vereinsrekord Männer' : 'Vereinsrekord Frauen', $ei['disz'], $ei['kat']];
            }
            foreach ($ei['ak'] as $akr => $w) {
                if (!self::gleich($w, $b['ak'][$akr] ?? null)) continue;
                if ($gesamt && self::gleich($w, $ei['w'])) continue;
                $ausz[] = ['Vereinsbestleistung ' . preg_replace('/\s+[0-9]+[,.]?[0-9]*\s*kg$/i', '', $akr), $ei['disz'], $ei['kat']];
            }
        }
        // Meisterschaftsplatzierungen
        $titel = [];
        foreach ($alle as $e) {
            if (empty($e['meisterschaft'])) continue;
            $titel[] = $e;
        }

        // ── HTML
        $o  = '<h1>' . $h($name) . '</h1>';
        $o .= '<p>Athletenprofil · ' . $h($verein . ' – ' . self::untertitel()) . '</p>';
        $o .= '<ul>';
        if ($geschl) $o .= '<li>Geschlecht: ' . $h($geschl) . '</li>';
        if ($ak)     $o .= '<li>Altersklasse ' . date('Y') . ': ' . $h($ak) . '</li>';
        $o .= '<li>Erfasste Ergebnisse: ' . $anz . ($anzExt ? ' (davon ' . $anzExt . ' nicht für ' . $h($verein) . ' gestartet)' : '') . '</li>';
        if ($pb) $o .= '<li>Disziplinen mit Bestleistung: ' . count($pb) . '</li>';
        $o .= '</ul>';

        if ($ausz) {
            $o .= '<h2>Vereinsrekorde und Vereinsbestleistungen</h2><ul>';
            foreach ($ausz as $x) $o .= '<li>' . $h($x[0]) . ' – ' . $h($x[1]) . ($x[2] && $x[2] !== 'Sonstige' ? ' (' . $h($x[2]) . ')' : '') . '</li>';
            $o .= '</ul>';
        }
        if ($titel) {
            $o .= '<h2>Meisterschaften</h2>';
            $z = [];
            foreach ($titel as $e) {
                $z[] = [$h(self::datum($e['datum'])), $h(self::mstrText($e, $mstr)), $h($e['disz_name']),
                        $h(self::resultat($e['resultat'], $e['fmt'])), $h($e['altersklasse'] ?? ''), self::veranstLink($e)];
            }
            $o .= self::tabelle(['Datum', 'Meisterschaft', 'Disziplin', 'Ergebnis', 'AK', 'Veranstaltung'], $z);
        }

        if ($pb) {
            $o .= '<h2>Persönliche Bestleistungen</h2>';
            $z = [];
            foreach ($pb as $e) {
                $z[] = [$h($e['kat_name']), $h($e['disz_name']), '<strong>' . $h(self::resultat($e['resultat'], $e['fmt'])) . '</strong>',
                        $h(self::datum($e['datum'])), self::veranstLink($e),
                        (int)$e['extern'] === 1 ? $h('für ' . ($e['verein'] ?: 'anderen Verein / ohne Verein')) : ''];
            }
            $o .= self::tabelle(['Kategorie', 'Disziplin', 'Bestleistung', 'Datum', 'Veranstaltung', 'Hinweis'], $z);
        }

        if ($alle) {
            $o .= '<h2>Alle Ergebnisse</h2>';
            $z = [];
            foreach ($alle as $e) {
                $z[] = [$h(self::datum($e['datum'])), self::veranstLink($e), $h($e['ort'] ?? ''), $h($e['disz_name']),
                        $h(self::resultat($e['resultat'], $e['fmt'])), $h($e['altersklasse'] ?? ''),
                        $e['ak_platzierung'] ? (int)$e['ak_platzierung'] . '.' : '',
                        $h(self::mstrText($e, $mstr)),
                        (int)$e['extern'] === 1 ? $h('für ' . ($e['verein'] ?: 'anderen Verein / ohne Verein')) : ''];
            }
            $o .= self::tabelle(['Datum', 'Veranstaltung', 'Ort', 'Disziplin', 'Ergebnis', 'AK', 'Platz AK', 'Meisterschaft', 'Hinweis'], $z);
        } else {
            $o .= '<p>Noch keine Ergebnisse erfasst.</p>';
        }

        $desc = 'Athletenprofil von ' . $name . ' · ' . $verein . ' ' . self::untertitel()
              . ' · ' . $anz . ' ' . ($anz === 1 ? 'Ergebnis' : 'Ergebnisse');
        self::ausgeben([
            'titel' => $verein . ' – Statistik – ' . $name, 'beschreibung' => $desc,
            'pfad' => $pfad, 'spa' => $pfad, 'og_typ' => 'profile', 'inhalt' => $o,
        ]);
    }

    public static function athletListe(): void {
        if (self::wartung()) { self::leer('athlet/', 'athleten'); return; }
        $h = [self::class, 'h'];
        $basis = self::basis();
        // Gäste sehen in der App nur aktive Athleten, ohne Jahrgang/Geschlecht
        $rows = DB::fetchAll('SELECT vorname, nachname FROM ' . DB::tbl('athleten') .
                             ' WHERE geloescht_am IS NULL AND aktiv = 1 ORDER BY nachname, vorname');
        $o = '<h1>Athleten</h1><p>Aktive Athlet:innen von ' . $h(self::verein()) . ': ' . count($rows) . '</p><ul>';
        foreach ($rows as $a) {
            $o .= '<li><a href="' . $h($basis . '/athlet/' . self::athletSlug($a['vorname'], $a['nachname'])) . '">'
                . $h(trim(($a['nachname'] ?? '') . ', ' . ($a['vorname'] ?? ''), ', ')) . '</a></li>';
        }
        $o .= '</ul>';
        self::ausgeben([
            'titel' => self::verein() . ' – Statistik – Athleten', 'beschreibung' => 'Athleten von ' . self::verein(),
            'pfad' => 'athlet/', 'spa' => 'athleten', 'inhalt' => $o,
        ]);
    }

    // ── Veranstaltung ───────────────────────────────────────────────────────

    public static function veranstaltung(string $teil): void {
        if ($teil === '') { self::veranstaltungListe(); return; }
        $id   = (int)$teil;   // "/veranstaltung/42" oder "/veranstaltung/42-stadtlauf"
        $pfad = 'veranstaltung/' . $id;
        if (self::wartung()) { self::leer($pfad, $pfad); return; }
        $v = $id ? DB::fetchOne(
            "SELECT v.*, COALESCE(o.name, v.ort) AS ort_name, o.land_code, s.name AS serie_name, s.id AS serie_id
             FROM " . DB::tbl('veranstaltungen') . " v
             LEFT JOIN " . DB::tbl('orte') . " o ON o.id = v.ort_id
             LEFT JOIN " . DB::tbl('veranstaltung_serien') . " s ON s.id = v.serie_id
             WHERE v.id = ? AND v.geloescht_am IS NULL AND v.genehmigt = 1", [$id]) : null;
        if (!$v) {
            self::leer($pfad, $pfad, '', 404, 'Veranstaltung nicht gefunden.');
            return;
        }
        $h      = [self::class, 'h'];
        $basis  = self::basis();
        $verein = self::verein();
        $mstr   = self::mstrMap();
        $titel  = $v['name'] ?: $v['kuerzel'] ?: 'Veranstaltung';

        $ergs = DB::fetchAll(
            "SELECT a.vorname, a.nachname, e.altersklasse, e.disziplin, e.disziplin_mapping_id AS mid,
                    e.resultat, e.resultat_num, e.ak_platzierung, e.meisterschaft, e.ak_platz_meisterschaft,
                    e.extern, e.verein, COALESCE(m.fmt_override, k.fmt, 'min') AS fmt, k.sort_dir,
                    COALESCE(k.name, 'Sonstige') AS kat_name, COALESCE(k.reihenfolge, 99) AS kat_sort,
                    COALESCE(m.disziplin, e.disziplin) AS disz_name
             FROM " . DB::tbl('ergebnisse') . " e
             JOIN " . DB::tbl('athleten') . " a ON a.id = e.athlet_id
             LEFT JOIN " . DB::tbl('disziplin_mapping') . " m ON m.id = e.disziplin_mapping_id
             LEFT JOIN " . DB::tbl('disziplin_kategorien') . " k ON k.id = m.kategorie_id
             WHERE e.veranstaltung_id = ? AND e.geloescht_am IS NULL AND a.geloescht_am IS NULL",
            [$id]
        );
        // Nach Disziplin gruppieren, Disziplinen wie in der App sortieren, darin nach Ergebnis
        $gruppen = [];
        foreach ($ergs as $e) {
            $key = $e['mid'] ? 'm' . $e['mid'] : 'd' . $e['disziplin'];
            $gruppen[$key][] = $e;
        }
        uasort($gruppen, function($x, $y) {
            return [diszSortKey($x[0]['disz_name']), $x[0]['disz_name']] <=> [diszSortKey($y[0]['disz_name']), $y[0]['disz_name']];
        });
        $athleten = [];
        $anzExt = 0;
        foreach ($ergs as $e) {
            $athleten[self::name($e)] = true;
            if ((int)$e['extern'] === 1) $anzExt++;
        }

        $o  = '<h1>' . $h($titel) . '</h1><ul>';
        $o .= '<li>Datum: ' . $h(self::datum($v['datum'])) . '</li>';
        if ($v['ort_name']) $o .= '<li>Ort: ' . $h($v['ort_name']) . ($v['land_code'] ? ' (' . $h($v['land_code']) . ')' : '') . '</li>';
        if ($v['serie_name']) $o .= '<li>Veranstaltungsreihe: ' . $h($v['serie_name']) . '</li>';
        $o .= '<li>Ergebnisse: ' . count($ergs) . ' von ' . count($athleten) . ' Athlet:innen'
            . ($anzExt ? ' (davon ' . $anzExt . ' nicht für ' . $h($verein) . ' gestartet)' : '') . '</li>';
        if (!empty($v['datenquelle']) && preg_match('#^https?://#i', $v['datenquelle'])) {
            $o .= '<li>Offizielle Ergebnisliste: <a href="' . $h($v['datenquelle']) . '">' . $h($v['datenquelle']) . '</a></li>';
        }
        $o .= '</ul>';

        foreach ($gruppen as $rows) {
            $desc = self::absteigend($rows[0]['fmt'], $rows[0]['sort_dir']);
            usort($rows, function($x, $y) use ($desc) {
                $a = self::wert($x['resultat'], $x['fmt'], $x['resultat_num']) ?? INF;
                $b = self::wert($y['resultat'], $y['fmt'], $y['resultat_num']) ?? INF;
                return $desc ? $b <=> $a : $a <=> $b;
            });
            $kat = $rows[0]['kat_name'];
            $o .= '<h2>' . $h($rows[0]['disz_name']) . ($kat && $kat !== 'Sonstige' ? ' <span class="klein">(' . $h($kat) . ')</span>' : '') . '</h2>';
            $z = [];
            foreach ($rows as $e) {
                $n = self::name($e);
                $z[] = ['<a href="' . $h($basis . '/athlet/' . self::athletSlug($e['vorname'], $e['nachname'])) . '">' . $h($n) . '</a>',
                        $h($e['altersklasse'] ?? ''), '<strong>' . $h(self::resultat($e['resultat'], $e['fmt'])) . '</strong>',
                        $e['ak_platzierung'] ? (int)$e['ak_platzierung'] . '.' : '',
                        $h(self::mstrText($e, $mstr)),
                        (int)$e['extern'] === 1 ? $h('für ' . ($e['verein'] ?: 'anderen Verein / ohne Verein')) : $h($verein)];
            }
            $o .= self::tabelle(['Athlet:in', 'AK', 'Ergebnis', 'Platz AK', 'Meisterschaft', 'Gestartet für'], $z);
        }
        if (!$ergs) $o .= '<p>Keine Ergebnisse erfasst.</p>';

        $desc = $titel . ' am ' . self::datum($v['datum']) . ($v['ort_name'] ? ' in ' . $v['ort_name'] : '')
              . ' · ' . count($ergs) . ' Ergebnisse von ' . $verein;
        self::ausgeben([
            'titel' => $verein . ' – Statistik – ' . $titel . ' (' . self::datum($v['datum']) . ')',
            'beschreibung' => $desc, 'pfad' => $pfad, 'spa' => $pfad, 'og_typ' => 'article', 'inhalt' => $o,
        ]);
    }

    public static function veranstaltungListe(): void {
        if (self::wartung()) { self::leer('veranstaltung/', 'veranstaltungen'); return; }
        $h = [self::class, 'h'];
        $basis = self::basis();
        $vT = DB::tbl('veranstaltungen');
        $jahre = array_map(function($r) { return (int)$r['j']; }, DB::fetchAll(
            "SELECT DISTINCT YEAR(datum) AS j FROM $vT WHERE geloescht_am IS NULL AND genehmigt = 1 AND datum IS NOT NULL ORDER BY j DESC"));
        $jahr = isset($_GET['jahr']) && in_array((int)$_GET['jahr'], $jahre, true) ? (int)$_GET['jahr'] : ($jahre[0] ?? (int)date('Y'));
        $rows = DB::fetchAll(
            "SELECT v.id, v.name, v.kuerzel, v.datum, COALESCE(o.name, v.ort) AS ort,
                    (SELECT COUNT(*) FROM " . DB::tbl('ergebnisse') . " e WHERE e.veranstaltung_id = v.id AND e.geloescht_am IS NULL) AS anz
             FROM $vT v LEFT JOIN " . DB::tbl('orte') . " o ON o.id = v.ort_id
             WHERE v.geloescht_am IS NULL AND v.genehmigt = 1 AND YEAR(v.datum) = ?
             ORDER BY v.datum DESC, v.id DESC", [$jahr]);
        $o = '<h1>Veranstaltungen ' . $jahr . '</h1><p class="klein">Jahre: ';
        $o .= implode(' · ', array_map(function($j) use ($h, $basis, $jahr) {
            return $j === $jahr ? '<strong>' . $j . '</strong>' : '<a href="' . $h($basis . '/veranstaltung/?jahr=' . $j) . '">' . $j . '</a>';
        }, $jahre)) . '</p>';
        $z = [];
        foreach ($rows as $v) {
            $z[] = [$h(self::datum($v['datum'])),
                    '<a href="' . $h($basis . '/veranstaltung/' . $v['id']) . '">' . $h($v['name'] ?: $v['kuerzel']) . '</a>',
                    $h($v['ort'] ?? ''), (int)$v['anz']];
        }
        $o .= self::tabelle(['Datum', 'Veranstaltung', 'Ort', 'Ergebnisse'], $z);
        self::ausgeben([
            'titel' => self::verein() . ' – Statistik – Veranstaltungen ' . $jahr,
            'beschreibung' => 'Veranstaltungen mit Ergebnissen von ' . self::verein() . ' im Jahr ' . $jahr,
            'pfad' => 'veranstaltung/' . (isset($_GET['jahr']) ? '?jahr=' . $jahr : ''), 'spa' => 'veranstaltungen', 'inhalt' => $o,
        ]);
    }

    // ── Bestenlisten (Rekorde) ──────────────────────────────────────────────

    private static function kategorien(): array {
        return DB::fetchAll('SELECT id, name, tbl_key, fmt, sort_dir, COALESCE(reihenfolge, 99) AS reihenfolge FROM '
                            . DB::tbl('disziplin_kategorien') . ' ORDER BY reihenfolge, name');
    }

    // /rekorde/, /rekorde/<kat>, /rekorde/<kat>/<disziplin-slug>
    public static function rekorde(array $teile): void {
        $katKey = strtolower($teile[0] ?? '');
        $slug   = strtolower($teile[1] ?? '');
        $pfad   = 'rekorde/' . implode('/', array_filter([$katKey, $slug], 'strlen'));
        if (self::wartung()) { self::leer($pfad, $pfad ?: 'rekorde'); return; }
        $h      = [self::class, 'h'];
        $basis  = self::basis();
        $verein = self::verein();

        $kats = self::kategorien();
        $kat  = null;
        foreach ($kats as $k) if ($k['tbl_key'] === $katKey) $kat = $k;
        if ($katKey !== '' && !$kat) { self::leer($pfad, 'rekorde', '', 404, 'Kategorie nicht gefunden.'); return; }

        $alle = self::vereinsErgebnisse();

        // ── Übersicht: Disziplinen mit Vereinsrekord gesamt / Männer / Frauen
        if ($slug === '') {
            $je = [];   // mid → Liste der Ergebnisse
            foreach ($alle as $r) {
                if (!$r['mid'] || !$r['tbl_key']) continue;
                if ($kat && $r['tbl_key'] !== $kat['tbl_key']) continue;
                $je[$r['tbl_key']][$r['mid']][] = $r;
            }
            $o = '<h1>Vereinsbestenlisten' . ($kat ? ' – ' . $h($kat['name']) : '') . '</h1>'
               . '<p>Beste Leistungen von ' . $h($verein) . ' je Disziplin (nur für den Verein erzielte Ergebnisse).</p>';
            foreach ($kats as $k) {
                if (empty($je[$k['tbl_key']])) continue;
                $o .= '<h2><a href="' . $h($basis . '/rekorde/' . $k['tbl_key']) . '">' . $h($k['name']) . '</a></h2>';
                $gruppen = $je[$k['tbl_key']];
                uasort($gruppen, function($x, $y) {
                    return [diszSortKey($x[0]['disz_name']), $x[0]['disz_name']] <=> [diszSortKey($y[0]['disz_name']), $y[0]['disz_name']];
                });
                $z = [];
                foreach ($gruppen as $rows) {
                    $top = self::bestenliste($rows, 1);
                    $zelle = function($lst) use ($h) {
                        if (!$lst) return '';
                        $r = $lst[0];
                        return '<strong>' . $h(self::resultat($r['resultat'], $r['fmt'])) . '</strong> ' . $h(self::name($r)) . ' (' . $h(substr((string)$r['datum'], 0, 4)) . ')';
                    };
                    $z[] = ['<a href="' . $h($basis . '/rekorde/' . $k['tbl_key'] . '/' . self::diszSlug($rows[0]['disz_name'])) . '">' . $h($rows[0]['disz_name']) . '</a>',
                            $zelle($top['gesamt']), $zelle($top['M']), $zelle($top['W']), count($rows)];
                }
                $o .= self::tabelle(['Disziplin', 'Vereinsrekord', 'Männer', 'Frauen', 'Ergebnisse'], $z);
            }
            self::ausgeben([
                'titel' => $verein . ' – Statistik – Bestenlisten' . ($kat ? ' ' . $kat['name'] : ''),
                'beschreibung' => 'Vereinsrekorde und Bestenlisten von ' . $verein,
                'pfad' => $pfad, 'spa' => $kat ? 'rekorde/' . $kat['tbl_key'] : 'rekorde', 'inhalt' => $o,
            ]);
            return;
        }

        // ── Einzelne Disziplin (Slug; ältere Links enthalten die mapping_id)
        $rows = [];
        foreach ($alle as $r) {
            if (!$r['mid'] || ($kat && $r['tbl_key'] !== $kat['tbl_key'])) continue;
            if (ctype_digit($slug) ? (int)$r['mid'] === (int)$slug : self::diszSlug($r['disz_name']) === $slug) $rows[] = $r;
        }
        if (!$rows) { self::leer($pfad, 'rekorde' . ($kat ? '/' . $kat['tbl_key'] : ''), '', 404, 'Disziplin nicht gefunden.'); return; }
        // Gleichnamige Disziplinen verschiedener Kategorien nicht mischen
        $mid  = (int)$rows[0]['mid'];
        $rows = array_values(array_filter($rows, function($r) use ($mid) { return (int)$r['mid'] === $mid; }));
        $disz = $rows[0]['disz_name'];
        $kn   = $rows[0]['kat_name'];

        $top = self::bestenliste($rows, 20);
        $liste = function(array $lst, bool $mitAk = true) use ($h, $basis): string {
            $z = []; $i = 0;
            foreach ($lst as $r) {
                $z[] = [++$i . '.', '<strong>' . $h(self::resultat($r['resultat'], $r['fmt'])) . '</strong>',
                        '<a href="' . $h($basis . '/athlet/' . self::athletSlug($r['vorname'], $r['nachname'])) . '">' . $h(self::name($r)) . '</a>',
                        $h((string)$r['ak']), $h(self::datum($r['datum'])),
                        self::veranstLink($r)];
            }
            return self::tabelle(['Rang', 'Ergebnis', 'Athlet:in', 'AK', 'Datum', 'Veranstaltung'], $z);
        };
        $o  = '<h1>Bestenliste ' . $h($disz) . ($kn ? ' <span class="klein">(' . $h($kn) . ')</span>' : '') . '</h1>';
        $o .= '<p>Vereinsinterne Bestenliste von ' . $h($verein) . ': je Athlet:in das beste Ergebnis, nur für den Verein erzielte Leistungen. '
            . '<a href="' . $h($basis . '/rekorde/' . $rows[0]['tbl_key']) . '">Alle Disziplinen der Kategorie</a></p>';
        $o .= '<h2>Gesamt</h2>' . $liste($top['gesamt']);
        if ($top['M']) $o .= '<h2>Männer</h2>' . $liste($top['M']);
        if ($top['W']) $o .= '<h2>Frauen</h2>' . $liste($top['W']);
        if ($top['ak']) {
            $o .= '<h2>Bestleistungen je Altersklasse</h2>';
            $z = [];
            foreach ($top['ak'] as $ak => $lst) {
                $r = $lst[0];
                $z[] = [$h($ak), '<strong>' . $h(self::resultat($r['resultat'], $r['fmt'])) . '</strong>',
                        '<a href="' . $h($basis . '/athlet/' . self::athletSlug($r['vorname'], $r['nachname'])) . '">' . $h(self::name($r)) . '</a>',
                        $h(self::datum($r['datum'])),
                        self::veranstLink($r)];
            }
            $o .= self::tabelle(['AK', 'Ergebnis', 'Athlet:in', 'Datum', 'Veranstaltung'], $z);
        }
        $spa = 'rekorde/' . $rows[0]['tbl_key'] . '/' . self::diszSlug($disz);
        self::ausgeben([
            'titel' => $verein . ' – Statistik – Bestenliste ' . $disz,
            'beschreibung' => 'Vereinsrekord und Bestenliste ' . $disz . ' von ' . $verein,
            'pfad' => $spa, 'spa' => $spa, 'inhalt' => $o,
        ]);
    }

    // Bestenlisten einer Disziplin, je Athlet nur das beste Ergebnis.
    // Liefert ['gesamt' => [...], 'M' => [...], 'W' => [...], 'ak' => [ak => [...]]]
    private static function bestenliste(array $rows, int $limit): array {
        $desc = self::absteigend($rows[0]['fmt'], $rows[0]['sort_dir']);
        foreach ($rows as &$r) $r['_w'] = self::wert($r['resultat'], $r['fmt'], $r['resultat_num']);
        unset($r);
        $rows = array_values(array_filter($rows, function($r) { return $r['_w'] !== null; }));
        usort($rows, function($x, $y) use ($desc) {
            return ($desc ? $y['_w'] <=> $x['_w'] : $x['_w'] <=> $y['_w']) ?: strcmp((string)$x['datum'], (string)$y['datum']);
        });
        $dedup = function(array $lst) use ($limit): array {
            $seen = []; $out = [];
            foreach ($lst as $r) {
                if (isset($seen[$r['athlet_id']])) continue;
                $seen[$r['athlet_id']] = true;
                $out[] = $r;
                if (count($out) >= $limit) break;
            }
            return $out;
        };
        $res = ['gesamt' => $dedup($rows), 'M' => [], 'W' => [], 'ak' => []];
        foreach (['M', 'W'] as $g) {
            $res[$g] = $dedup(array_values(array_filter($rows, function($r) use ($g) { return self::geschlechtVon($r) === $g; })));
        }
        $akMap = [];
        foreach ($rows as $r) if ((string)$r['ak'] !== '') $akMap[(string)$r['ak']][] = $r;
        ksort($akMap, SORT_NATURAL);
        foreach ($akMap as $ak => $lst) $res['ak'][$ak] = array_slice($lst, 0, 1);
        return $res;
    }
}
