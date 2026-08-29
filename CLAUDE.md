# Statistikportal Leichtathletik

## Aktuelle Version: v1547

Live: https://statistik.tus-oedt.de  
Hosting: all-inkl.com Shared Hosting → `/html/statistik/`

## Projektstruktur

```
htdocs/               → Web-Root
  index.html          → Einstiegspunkt (SPA), enthält Cache-Buster ?v=NNN
  js/                 → Frontend-Module (Vanilla JS)
    02_app.js         → Login, Registrierung, Passwort-Reset, Navigation, renderPage()
    04_ergebnisse.js  → Ergebnisse-Seite inkl. externe Ergebnisse
    05_athleten.js    → Athletenprofil, PB-Verwaltung
    07_eintragen.js   → Bulk-Eintragen, alle Importer
    08_admin.js       → Admin-Panel
    09_utils.js       → Hilfsfunktionen (fmtTime, showModal, ...)
    09b_tabellenfilter.js → Gemeinsame Filterleiste aller Tabellen (Suche + Spalte/Wert-Regeln)
    10_veranstaltungen.js → Regelmäßige Veranstaltungen + Zeitstrahl
    13_uitslagen.js   → uitslagen.nl + evenementen Importer
  api/index.php       → REST-API (alle Endpunkte, ~5000 Zeilen)
  api/setup.php       → Ersteinrichtung
  opcache-clear.php   → Nach jedem Deploy aufrufen: /opcache-clear.php
includes/             → PHP-Bibliotheken (außerhalb Web-Root)
  auth.php            → Session/Auth/TOTP/Passkey
  db.php              → Datenbankzugriff (MariaDB)
  settings.php        → Vereinseinstellungen
  config.sample.php   → Konfigurationsvorlage (→ config.php)
build.sh              → Versionszähler + ZIP-Build
CHANGELOG.md          → Versionshistorie
```

## Deployment

**Nach jeder Änderung immer sofort committen und pushen – ohne auf Bestätigung zu warten.**  
GitHub Actions deployed automatisch per FTP nach all-inkl.com (`/html/statistik/`). Kein ZIP-Export nötig.

**Claude-Workflow nach jeder Änderung (IMMER, ohne Ausnahme):**
1. `CHANGELOG.md`: neue Bullet-Zeile oben in `## vCUR` einfügen
2. Versionsnummer um 1 erhöhen:
   - `index.html`: alle `?v=NNN` Cache-Buster + `header-version`-Span (`v=NNN` → `v=NNN+1`)
   - `CHANGELOG.md`: `## vCUR` → `## vNNN+1`
3. `git add <geänderte Dateien>`, `git commit`, `git push`
4. Pull Request als Draft erstellen (falls noch keiner existiert)
5. Auto-Merge aktivieren (`mcp__github__enable_pr_auto_merge`, SQUASH) – falls nicht möglich (Feature im Repo deaktiviert), PR manuell mergen sobald CI grün ist (`mcp__github__merge_pull_request`)
6. PR-Aktivität abonnieren (`mcp__github__subscribe_pr_activity`) und auf CI-Ergebnisse/Review-Kommentare reagieren

**Wichtig:** PHP OPcache auf dem Server wird per GitHub Actions automatisch geleert (`opcache-clear.php`).

## Technisches

- **Frontend**: Vanilla JS, keine Build-Toolchain, SPA mit Hash-Routing
- **Backend**: PHP 8.x, MariaDB (all-inkl.com Shared Hosting)
- **Auth**: Session + TOTP + Passkey (3-Schritt-Login)
- **JS validieren**: `node -e "new Function(require('fs').readFileSync('htdocs/js/DATEI.js','utf8'))"`

## Wichtige Patterns

**Kein URL-Rewriting:** Die API ist nur als `api/index.php?_route=<route>`
erreichbar (alternativ `api/index.php/<route>` per PATH_INFO). `/(api)/<route>`
allein ergibt einen Apache-404 – relevant für Cronjob-URLs.

**API-Aufrufe (Frontend):**
```js
var r = await apiGet('veranstaltungen?limit=10');
var r = await apiPost('ergebnisse/bulk', { items: [...] });
var r = await apiPut('veranstaltungen/42', { genehmigt: 1 });
var r = await apiDel('externe-ergebnisse/7');
```

**Routing:**
- `state.tab` = aktiver Haupttab
- `state.veranstView` = 'list' | 'serien' | 'serie-detail' (Veranstaltungen-Sub-State)
- `state.serieId` = ID der aktuellen Serie
- `syncHash()` → URL-Hash aktualisieren
- `renderPage()` → aktuelle Seite neu rendern
- `navigate('veranstaltungen')` → Tab wechseln (setzt Sub-State zurück)

**Auth-Klasse (PHP):**
- `Auth::requireLogin()` → gibt `$user` zurück oder 401
- `Auth::requireEditor()` → gibt `$user` zurück oder 403
- `Auth::requireRecht('recht_name')` → gibt `$user` zurück oder 403
- Kein `Auth::getUserRechte()` (existiert nicht!)

**Tabellen-Filterleiste (`09b_tabellenfilter.js`):**
Jede Tabelle mit Suchfeld nutzt dieselbe Leiste: Freitextsuche + beliebig viele
Regeln „Spalte + Wert"; die Auswahllisten zeigen nur erreichbare Werte mit Trefferzahl.
```js
tfInit('orte', {
  platzhalter: 'Name, Region…',
  rows:    function() { return _orteCache; },      // Grunddaten (clientseitig)
  suche:   function(o) { return [o.name, o.land]; },
  spalten: [{ key: 'land', label: 'Land', wert: function(o) { return o.land || ''; } }],
  onChange: function() { /* Tabellenteil neu zeichnen */ }
});
// HTML einmalig einsetzen: tfBarHtml('orte')   → danach nur tfRefresh('orte')
// Filtern: tfFilter('orte', rows)
```
Optionen: `absteigend` (Jahr/Datum), `anzeige` (codierte Werte lesbar machen),
`wildcard: true` (`*`/`?` in der Suche), `entprellung: 300` (serverseitige Seiten).
Serverseitig paginierte Tabellen (Ergebnisse, Veranstaltungsliste) setzen statt `rows`
ein `facetten: function(key)` und schicken ihre Regeln als `f[spalte]=wert` plus
`facetten=spalte1,spalte2` an die API (`ergRegelWhere()` / `ergFacetten()` in `api/index.php`).

**showModal:**
```js
showModal(html)              // normal
showModal(html, true)        // wide
showModal(html, false, true) // (noClose-Parameter wird ignoriert, Verhalten identisch)
```
Modals schließen **ausschließlich per Button** – Klick außerhalb des Modals hat keine Wirkung.

**fmtTime():** gibt HTML zurück (`<span style="...">h</span>`) → für Tooltips/title-Attribute immer Klartext-Formatierung verwenden und HTML-escapen.

## Datenmodell (wichtige Tabellen)

| Tabelle | Zweck |
|---|---|
| `ergebnisse` | Vereinsergebnisse (mit `veranstaltung_id`) |
| `athlet_pb` | Externe Ergebnisse (mit optionaler `veranstaltung_id`, `erstellt_von`) |
| `veranstaltungen` | Veranstaltungen (`genehmigt`, `serie_id`) |
| `veranstaltung_serien` | Regelmäßige Veranstaltungen |
| `benutzer` | Login, Rollen, Passkey, TOTP, `reset_code_hash` |
| `rollen` | Rollen mit JSON-Rechte-Array |

**Rollen-Rechte (u.a.):**
- `alle_ergebnisse`, `eigene_ergebnisse`, `lesen`, `vollzugriff`
- `externe_ergebnisse_sehen` (Admin+Editor default)
- `inaktive_athleten_sehen`, `veranstaltung_eintragen`, `veranstaltung_loeschen`

## Admin-Tabs
system, benutzer, registrierungen, disziplinen, altersklassen, meisterschaften, orte, darstellung (UI-Label „Einstellungen“), quellen (Ergebnis-Scanner), dashboard_cfg, antraege, wartung, papierkorb

## Bulk-Import-Quellen
- RaceResult (`my.raceresult.com`, `my4.raceresult.com`)
- ACN Timing (`acn-timing.com` / `chronorace.be`)
- Leichtathletik.de
- Uitslagen.nl / Evenementen.uitslagen.nl

### ACN Timing API
- Discovery: `results.chronorace.be/api/results/table/search/{ctx}/{raceId}?pageSize=1`
- Daten: `results.chronorace.be/api/results/table/search/{ctx}/{raceId}?pageSize=12000`
- Event-Name: `prod.chronorace.be/api/Event/view/{uuid}` → `.Title`
- ctx-Format: `YYYYMMDD_ort` (z.B. `20260329_venlo`)
- HTML-stripping: `/<.*$/` (nicht `/<[^>]+>/g` wegen Geschwindigkeitsangaben wie "20.4 km/h")

### Ergebnis-Scanner (proaktive Funde)
Beide melden Starts des eigenen Vereins auf der Eintragen-Seite; der Import läuft
unverändert über die bestehenden Importer. Konfiguration für beide:
**Admin → 🔎 Quellen** (`renderAdminQuellen()` in `08_admin.js`, Tab-Id `quellen`). Gemeinsame Aufbereitung in
`includes/scanner.php` (`Scanner::gruppiere()` → Athletenzuordnung + Abgleich
gegen erfasste Ergebnisse), gemeinsames Panel-Rendering in `_bkFundePanelHtml()`.

| Quelle | Bibliothek | Verfahren | Cron |
|---|---|---|---|
| RaceResult | `includes/raceresult.php` | Discovery je Land + Volltextsuche je Event, Warteschlange `rr_events`; durchsucht wird erst, wenn die Config `EventOver` meldet | `api/index.php?_route=rr-scan&token=…` (stündlich) |
| uitslagen.nl | `includes/uitslagen.php` | Eine seitenweite Volltextsuche je Suchbegriff (`/results.php?naam=…`), keine Discovery | `api/index.php?_route=uits-scan&token=…` (täglich) |
| leichtathletik.de | `includes/leichtathletik.php` | Discovery über `/Competitions/CurrentPast?page=N` + Teilnehmerliste je Wettkampf, Warteschlange `la_events` | `api/index.php?_route=la-scan&token=…` (stündlich) |

Fortschritt: Tabelle `scan_laeufe`, **eine Zeile je Lauf** (`Scanner::laufStart()`,
`laufFortschritt()`, `laeufe()`). Nicht ein Wert je Quelle – von einer Quelle können
mehrere Läufe gleichzeitig laufen (Cronjob + Panel), die sich sonst überschreiben.
Das Admin-Panel pollt sie über die `*-scan-status`-Routen und zeigt je Lauf eine Leiste. Scan-Routen geben vorher die Session
frei (`session_write_close()`), sonst blockiert die Sperre jede Statusabfrage.
Abfragebegriffe werden über `Scanner::sucheBegriffe()` reduziert (Teilstring-Suche),
geprüft wird gegen die volle Liste.
Abbruch: `POST scan-stop {lauf}` setzt `scan_laeufe.abbruch`; die Schleife liest das
Kennzeichen **direkt per SQL** (`Settings` cacht je Anfrage, der Scan *ist* eine Anfrage).

leichtathletik.de wertet eine **Meldeliste** aus: ein Fund heißt „war gemeldet",
nicht „hat ein Ergebnis". Datum mehrtägiger Wettkämpfe = letzter Tag.

Nicht proaktiv (nur manueller Import): ACN Timing.

### PB-Prioritäten
- Prio 0: Gesamtbestleistung
- Prio 1: Geschlecht-Bestleistung
- Prio 2: Altersklassen-Bestleistung
- Prio 3: Persönliche Bestleistung pro Athlet

## Login-Portal (Cross-Domain SSO)

**Architektur:** Shared-Session via `COOKIE_DOMAIN` (z.B. `.tus-oedt.de`)

**Einstellungen:**
- `login_portal_aktiv` (`0`/`1`) — Redirect zum Login-Portal ein/aus
- `login_portal_url` — URL des Login-Portals (z.B. `https://login.tus-oedt.de`)
- `login_portal_apps` — JSON-Array der registrierten Apps

**Voraussetzungen:**
- Gleiche DB, gleicher `TABLE_PREFIX`, gleicher `SESSION_NAME`
- `COOKIE_DOMAIN` in beiden `config.php` identisch (z.B. `.tus-oedt.de`)
- Shared PHP-Klassen (`auth.php`, `db.php`, etc.) im Login-Portal `includes/`

**Flow:**
1. App-Frontend: `auth/me` → 401 + `login_portal_aktiv=1` → Redirect zu Login-Portal
2. Login-Portal: Login → Session-Cookie mit `domain=.tus-oedt.de`
3. Redirect zurück zur App → `auth/me` erkennt Session

**Standalone-Modus:** `login_portal_aktiv=0` (Default) → Statistikportal nutzt eigenen Login wie bisher. Keine Änderung am Verhalten.
