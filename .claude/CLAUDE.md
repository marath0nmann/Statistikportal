# TuS Oedt Leichtathletik Statistikportal

## Projektstruktur

```
htdocs/           → Web-Root (auf all-inkl.com unter /html/statistik/)
  index.html      → Einstiegspunkt (SPA)
  app.js          → Gesamte Frontend-Logik (~800KB, vanilla JS)
  app.css         → Styles
  api/index.php   → REST-API (alle Endpunkte)
  api/setup.php   → Ersteinrichtung
includes/         → PHP-Bibliotheken (außerhalb Web-Root)
  auth.php        → Session/Auth/TOTP/Passkey
  db.php          → Datenbankzugriff (MariaDB)
  settings.php    → Vereinseinstellungen
  config.sample.php → Konfigurationsvorlage (→ config.php)
sql/              → Schema und Migrationen
```

## Konfiguration

Kopiere `includes/config.sample.php` nach `includes/config.php` und trage DB-Zugangsdaten ein.

## Commit & Deployment

Claude Code arbeitet direkt im GitHub-Repo. Auf Anweisung des Benutzers:

1. Version erhöhen (aktuelle Version in dieser Datei nachführen)
2. `htdocs/index.html`: alle `v\d+`-Vorkommen und `?v=\d+`-Cache-Buster ersetzen
3. `COMMIT_EDITMSG`: Commit-Message eintragen (Format: `vXXX: Kurzbeschreibung`)
4. `CHANGELOG.md`: neuen Eintrag oben einfügen (Format: `## vXXX – Titel\n\n- Punkt\n\n---`)
5. `README.md`: Versionszeile aktualisieren (`## Version vXXX | Stand: Monat Jahr`)
6. `git add` relevante Dateien, `git commit`, `git push`

GitHub Actions deployed automatisch per FTP nach all-inkl.com (`/html/statistik/`).

Kein ZIP-Export mehr nötig.

## Technisches

- **Frontend**: Vanilla JS, keine Build-Toolchain, SPA mit Hash-Routing (#ergebnisse, #veranstaltungen, etc.)
- **Backend**: PHP 8.x, MariaDB (all-inkl.com Shared Hosting)
- **Auth**: Session + TOTP + Passkey (3-Schritt-Login)
- **JS-Syntax prüfen**: `node --check htdocs/app.js` oder `node -e "new Function(require('fs').readFileSync('htdocs/app.js','utf8'))"`

## Aktuelle Version: v924

### Wichtige Patterns

**API-Aufrufe (Frontend):**
```js
var r = await apiGet('veranstaltungen?limit=10');
var r = await apiPost('ergebnisse/bulk', { items: [...] });
var r = await apiPut('veranstaltungen/42', { genehmigt: 1 });
```

**Routing:**
- `state.tab` = aktiver Haupttab
- `syncHash()` → URL-Hash aktualisieren
- `renderPage()` → aktuelle Seite neu rendern
- `navigate('veranstaltungen')` → Tab wechseln

**Admin-Tabs:** system, benutzer, registrierungen, disziplinen, altersklassen, meisterschaften, darstellung, dashboard_cfg, antraege, papierkorb

**Bulk-Import-Quellen:** RaceResult (my.raceresult.com), ACN Timing (acn-timing.com), Leichtathletik.de, Uitslagen.nl

### ACN Timing API
- Discovery: `results.chronorace.be/api/results/table/search/{ctx}/{raceId}?pageSize=1`
- Daten: `results.chronorace.be/api/results/table/search/{ctx}/{raceId}?pageSize=12000`
- Event-Name: `prod.chronorace.be/api/Event/view/{uuid}` → `.Title`
- ctx-Format: `YYYYMMDD_ort` (z.B. `20260329_venlo`)
