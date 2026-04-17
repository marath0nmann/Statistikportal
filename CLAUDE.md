# Statistikportal Leichtathletik

## Aktuelle Version: v1002

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
login-portal/         → Zentrales Login-Portal (optional)
  htdocs/index.html   → SPA (Login, Registrierung, Passwort-Reset, App-Auswahl)
  htdocs/api/index.php → Auth-API (nutzt gleiche DB + Session)
  includes/           → Shared PHP-Klassen (werden von build.sh kopiert)
  README.md           → Setup-Anleitung
CHANGELOG.md          → Versionshistorie
```

## Deployment

Build-Befehl: `cd /home/claude/portal/Statistikportal && bash build.sh`

Das Skript:
1. Erhöht die Version automatisch (liest aktuelle aus `index.html`)
2. Ersetzt alle `?v=NNN` Cache-Buster in `index.html`
3. Baut `paket_vNNN.zip` → `/mnt/user-data/outputs/`

**Namenskonvention (IMMER einhalten):**
- ZIP-Datei heißt `paket_vNNN.zip` (z.B. `paket_v1006.zip`)
- Der Ordner **innerhalb** der ZIP heißt ebenfalls `paket_vNNN` (z.B. `paket_v1006/`)
- Version wird **immer automatisch** um 1 erhöht – nie manuell setzen

**`build.sh` aktualisiert automatisch – kein manuelles Eingreifen:**
- `index.html` → Versionsnummer + alle `?v=NNN` Cache-Buster
- `README.md` → Versionsnummer + aktuelles Datum
- `COMMIT_EDITMSG` → erste `-`-Zeile aus dem obersten CHANGELOG-Eintrag
- `CHANGELOG.md` → Versionsnummer im obersten Eintrag (`## vCUR` → `## vNEW`)

**Claude-Workflow vor jedem Build (NUR das ist manuell):**
1. `CHANGELOG.md`: neuen Eintrag **oben** einfügen: `## vNNN\n- Beschreibung`
2. `bash build.sh` ausführen → Rest läuft automatisch

Deploy-Workflow:
1. ZIP per FTP auf all-inkl.com hochladen und entpacken
2. `https://statistik.tus-oedt.de/opcache-clear.php` aufrufen → OPcache leeren
3. Nur **eine** ZIP deployen (kein Doppel-Deploy mehr nötig)

**Wichtig:** PHP OPcache auf dem Server war Ursache des „erst zweiter Deploy wirkt"-Problems.
`opcache-clear.php` löst das zuverlässig nach dem ersten Deploy.

## Technisches

- **Frontend**: Vanilla JS, keine Build-Toolchain, SPA mit Hash-Routing
- **Backend**: PHP 8.x, MariaDB (all-inkl.com Shared Hosting)
- **Auth**: Session + TOTP + Passkey (3-Schritt-Login)
- **JS validieren**: `node -e "new Function(require('fs').readFileSync('htdocs/js/DATEI.js','utf8'))"`

## Wichtige Patterns

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

**showModal:**
```js
showModal(html)              // normal, Klick außerhalb schließt
showModal(html, true)        // wide
showModal(html, false, true) // noClose: Klick außerhalb schließt NICHT
```

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
system, benutzer, registrierungen, disziplinen, altersklassen, meisterschaften, darstellung, dashboard_cfg, antraege, papierkorb

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
