# Statistikportal – Leichtathletik
## Version v1470 | Stand: August 2026 

**Die komplette Statistik-Plattform für deinen Leichtathletik-Verein.**  
Vereinsrekorde, Bestleistungen, Veranstaltungen und Athletenprofile – alles an einem Ort, schnell, sicher und ohne externe Abhängigkeiten.

PHP/MariaDB · läuft auf jedem Standard-Webhosting (all-inkl.com & Co.) · Vanilla JS/CSS · keine externen Frameworks · keine Build-Toolchain · keine versteckten Kosten.

---

## ✨ Was das Portal kann

### 📊 Dashboard, das mitdenkt
Dein persönliches Cockpit nach dem Login: eine **Timeline** zeigt frische Vereinsrekorde in Gold und Silber neben den persönlichen Bestleistungen in Grün – auf einen Blick erkennst du, was diese Saison passiert ist. Die **Hall of Fame** rückt die Top-Athleten mit Avatar und Titeln ins Rampenlicht. Daneben die **nächsten und letzten Veranstaltungen** und ein Widget mit den eigenen Bestleistungen. Der gesamte Aufbau ist im Admin-Bereich frei konfigurierbar – jeder Verein gestaltet sein eigenes Dashboard.

### 🏆 Vereinsrekorde & Bestleistungen
Jeder Rekord wird mit **Pace-Berechnung** (für alle Distanzen ab 1 km), Vorgängerwerten („war 2:37:42 h") und farbiger Hervorhebung des aktuellen Jahres präsentiert. Filtere nach Kategorie, Disziplin, Altersklasse und Geschlecht – inklusive intelligenter **AK-Mergung** (alle Jugend-AKs werden automatisch zu MHK/WHK gruppiert) und einer **Unique-Ansicht**, die nur das beste Ergebnis je Disziplin zeigt. Lieblings-Disziplinen erscheinen ganz oben, leere Disziplinen verschwinden automatisch – die Ansicht bleibt aufgeräumt. Alle Filter merkt sich das Portal **pro Nutzer dauerhaft**.

### 📅 Jahresübersicht
Der Jahresrückblick des Vereins: Über eine Jahresauswahl (mit Ereigniszähler je Jahrgang) sind alle relevanten Ereignisse eines Jahres abrufbar – **Meisterschafts-Titel sowie zweite und dritte Plätze**, gruppiert nach Meisterschaftsart in der Wertigkeit aus dem Admin-Bereich, dazu die **neuen Vereinsrekorde und Bestleistungen** aus derselben Quelle wie das Dashboard-Widget „Neueste Bestleistungen" – mit demselben Filter (Vereinsrekord, Bestleistung M/W, Bestleistung AK, PB & Debüt) und optional nur für favorisierte Disziplinen. Eine Kennzahlenleiste fasst das Jahr zusammen. Standardmäßig sind alle Ereignisse **nach Athlet\*in gebündelt** – mit Avatar und Kurzbilanz, sortiert nach Wertigkeit; per Umschalter gibt es die chronologische Ansicht mit Monatsgliederung.

### 🏃 Athleten im Karten-Layout
Die öffentliche Athleten-Übersicht präsentiert jedes Mitglied auf einer eigenen Karte – mit **Avatar, Vereinsrekord- und Bestleistungs-Badges** und einer übersichtlichen Trennung zwischen aktiven und inaktiven Athleten. Klick aufs Profil öffnet alle Ergebnisse, sortiert nach favorisierten Disziplinen und mit Ergebniszählern. Auf dem Desktop fünf Spalten breit, auf dem Smartphone perfekt gestapelt.

### 📋 Ergebnisse griffbereit
Die zentrale Ergebnisliste filtert nach **Athlet, Kategorie, Disziplin, AK, Jahr und Meisterschaft** – jede Spalte ist sortierbar, jeder Eintrag inline editierbar. Externe Ergebnisse (auswärts errungen) lassen sich separat ein- und ausblenden. Zeitformate werden automatisch normalisiert: aus „64:30" wird „1:04:30" – auch im Import.

### 🎯 Veranstaltungen & Serien
Lege **regelmäßige Veranstaltungen** als Serie an – das Portal sortiert sie automatisch nach kalendarischer Nähe (die nächste anstehende oben) und zeigt für jede Serie eine eigene Bestleistungs-Auswertung über alle Jahre, geteilt nach Geschlecht und Altersklasse. Einzelveranstaltungen erscheinen mit Ergebnislisten, Meisterschafts-Platzierungen und externen Beiträgen.

### ⚡ Bulk-Eintragen mit URL-Import
**Einfach Ergebnisliste reinkopieren – fertig.** Der Smart-Paste-Parser erkennt Name, Disziplin, AK, Platz, Datum und Zeit unabhängig von der Reihenfolge. Akzente und Umlaute werden tolerant gematcht („André" findet auch „Andre"), die passende Veranstaltungs-Serie wird automatisch vorgeschlagen.

Noch schneller: **Einfach die URL einer Ergebnisseite einfügen** – das Portal holt sich die Daten direkt:

| Quelle | Was wird automatisch importiert |
|---|---|
| **RaceResult** (`my.raceresult.com`) | Komplette Ergebnislisten inkl. tief verschachtelter AK-Filter |
| **MikaTiming** (`*.mikatiming.com`) | Alle Vereinsteilnehmer, Ort & Datum aus dem Eventnamen erkannt |
| **ACN Timing / Chronorace** (`acn-timing.com`, `chronorace.be`) | Live-Strecken mit dynamischer Spaltenerkennung |
| **uitslagen.nl** | Einzelevents per ID |
| **evenementen.uitslagen.nl** | Alle Strecken eines Events automatisch |
| **Leichtathletik.de** | Wettkampfprotokolle |

Ein eingebautes **Debug-Fenster** zeigt bei jedem Import HTTP-Status, Trefferanzahl und Parsing-Schritte – falls eine Quelle mal nicht mitspielt, weißt du sofort, woran es liegt.

Für eigene Ergebnisse gibt es eine kompakte Eingabemaske mit „Speichern & Neues"-Button für schnelle Mehrfacheingaben.

### 🔐 Login & Sicherheit auf Bank-Niveau
**3-Schritt-Login** mit moderner Mehrfaktor-Authentifizierung:
1. E-Mail oder Benutzername  
2. Passwort **oder Passkey** (Touch ID, Face ID, Windows Hello, YubiKey…)  
3. Zweiter Faktor: **TOTP** (Google Authenticator & Co.), **Passkey** oder **6-stelliger E-Mail-Code**

Dazu: **Passwort-Reset per E-Mail**, **Brute-Force-Schutz** (max. 10 Fehlversuche je IP), **Login-Versuchs-Logging** für Admins, und ein **granulares Rollensystem** mit anpassbaren Rechten (Admin, Editor, Athlet, Leser – plus eigene Rollen).

Der **Avatar aus dem Athletenprofil** erscheint nach dem Login sofort im Header – inklusive Online-Status-Punkt.

### 🌐 Optionales Single Sign-On
Mehrere Vereinsdienste an einer Domain? Das **integrierte Login-Portal-Modul** ermöglicht Cross-Domain-SSO via Shared Session Cookie – ein Login, alle Apps. Ein Schalter im Admin reicht zum Aktivieren; ohne Konfiguration bleibt alles standalone.

### 🛠️ Admin-Bereich, der alles kann

**Benutzerverwaltung:** Anlegen, bearbeiten, deaktivieren, Rollen zuweisen. Eigene Rollen mit Bitmask-Rechten erstellen. 2FA (Passkey/TOTP) für einzelne Nutzer zurücksetzen. Ausstehende Registrierungen werden direkt mit Badge-Zähler im Benutzer-Tab angezeigt – Genehmigung mit einem Klick. Admins werden automatisch per E-Mail über neue Registrierungen informiert.

**Disziplinen:** Kategorie-Mapping per Drag-Klick, Format-Overrides (Sekunden, Minuten, Hundertstel, Meter), Favoriten-Stern direkt in der Tabelle, automatische **Distanz-Erkennung aus dem Namen** („Halbmarathon" → 21097,5 m), Hall-of-Fame-Ausschluss-Toggle, Sortierung per Spaltenkopf, „Anlegen & Nächste" für schnelles Mehrfacherfassen.

**Altersklassen:** Verwaltung mit AK→Kategorie-Zuordnung und Jugend-AK-Mapping (MU18/MU20 → MHK/WHK).

**Meisterschaften:** Frei konfigurierbare Typen (Olympia, WM, EM, DM, NRW-Meisterschaften …) mit eigenen Farben und Medaillen-Symbolen.

**Veranstaltungen-Tab:** Vollständige Übersicht mit **Wildcard-Suche** (`*Stadt*`, `Marathon?`), Jahr- und Status-Filtern. Bulk-Aktionen für mehrere Einträge gleichzeitig: Genehmigen, Sperren, Löschen, **Umbenennen mit Suchen & Ersetzen**, Ort setzen, **Startnummern automatisch durchnumerieren** (alt → neu), Serie zuweisen oder neu anlegen. Serien-Zugehörigkeit als Tag direkt unter dem Namen sichtbar.

**Anträge:** Athleten können Korrekturen an ihren Ergebnissen vorschlagen – Admins bekommen die Anträge gebündelt und können mit einem Klick zustimmen oder ablehnen.

**Papierkorb:** Nichts ist endgültig gelöscht. Versehentlich entfernte Athleten, Ergebnisse und Veranstaltungen lassen sich jederzeit wiederherstellen.

**Einstellungen:** Vereinsname, Logo, **Theme-Farben (Primary/Accent)** mit automatisch berechneten Kontrastvarianten, Footer-Texte (Datenschutz, Impressum, Nutzungsbedingungen) als bearbeitbare Templates, Auto-Freigabe für Veranstaltungen und eigene Ergebnisse, Login-Portal-Konfiguration, Adressleisten-Färbung im Browser (`theme-color`).

**Dashboard-Editor:** Widget-Layout per Konfigurations-UI – Timeline-Limit, Auto-Fill, Merge-AK-Optionen.

**Geburtsjahr-Bulk-Import:** CSV-Import (Semikolon-getrennt, Excel-kompatibel) mit Vorschau und Match-Status für ganze Jahrgangs-Listen.

**System-Info:** Letzte Logins pro Nutzer, Aktivitäts-Tracking, Statistiken zu Ergebnissen/Veranstaltungen pro Jahr, OPcache-Clear auf Knopfdruck.

### 📱 Mobil-First & Dark Mode
Komplett responsives Design – auf dem Smartphone werden Vereinsrekorde als Karten gestapelt statt als 9-Spalten-Tabelle gequetscht, der mobile Header zeigt Logo, Versionsnummer und aktuellen Seitentitel, ein **Burger-Drawer** öffnet die Navigation. Der **Dark Mode** schaltet automatisch nach Systemeinstellung. Toast-Notifications, Modals mit Außenklick-Schließen, Live-Suchfelder mit Debounce und Keyboard-Navigation – moderne Web-UX, die sich nicht hinter App-Frontends verstecken muss.

### 🔄 Daten-Integrität
**Soft-Delete überall:** kein Datensatz wird hart gelöscht, alles landet im Papierkorb. **Audit-Logs** für Login-Versuche, **Ergebnis-Änderungsanträge** mit Status-Historie, **automatische DDL-Migrationen** beim API-Start (das Schema bleibt immer aktuell, ohne manuelle SQL-Skripte).

### 🚀 Wartungsarm & schnell
Cache-Buster auf allen JS/CSS-Dateien (`?v=NNN`), parallele HTTP-Requests beim MikaTiming-Import (~6× schneller), Pagination, Lazy Loading. **Kein Build-Step, keine npm-Dependencies** – einfach Dateien hochladen, GitHub Actions deployed automatisch und leert den OPcache.

---

## 📁 Dateistruktur

```
deine-domain.de/
├── index.html              ← Haupt-App (Single-Page), Cache-Buster ?v=NNN
├── js/
│   ├── 02_app.js           ← Login, Navigation, renderPage()
│   ├── 04_ergebnisse.js    ← Ergebnisse-Seite
│   ├── 05_athleten.js      ← Athletenprofil, PB-Verwaltung
│   ├── 07_eintragen.js     ← Bulk-Eintragen, Importer
│   ├── 08_admin.js         ← Admin-Panel
│   ├── 09_utils.js         ← Hilfsfunktionen (fmtTime, showModal, …)
│   ├── 10_veranstaltungen.js ← Veranstaltungen + Zeitstrahl
│   └── 13_uitslagen.js     ← uitslagen.nl / evenementen Importer
├── api/
│   └── index.php           ← REST API (alle Endpunkte)
├── includes/               ← außerhalb Web-Root
│   ├── config.php          ← DB-Zugangsdaten  ← ANPASSEN (nicht committen!)
│   ├── db.php              ← Datenbankverbindung
│   ├── auth.php            ← Authentifizierung + 2FA
│   ├── passkey.php         ← WebAuthn/Passkey
│   ├── totp.php            ← TOTP (RFC 6238)
│   └── settings.php        ← Einstellungen-Helper
└── sql/
    ├── schema.sql          ← Datenbankstruktur (einmalig ausführen)
    └── import_data.sql     ← Historische Daten (optional)
```

> **Hinweis:** `includes/config.php` enthält Zugangsdaten und darf **nicht** in Git committet werden. Siehe `.gitignore`.

---

## 🔧 Setup (Neuinstallation)

### 1. Datenbank anlegen (all-inkl.com KAS)
KAS → Datenbanken → Neue MySQL-Datenbank. Notiere: Host, Name, Benutzer, Passwort.

### 2. `includes/config.php` anlegen
```php
<?php
define('DB_HOST',          'localhost');
define('DB_NAME',          'p123456_statistik');
define('DB_USER',          'p123456_statistik');
define('DB_PASS',          'DEIN_PASSWORT');
define('DB_CHARSET',       'utf8mb4');
define('TABLE_PREFIX',     '');
define('SESSION_NAME',     'stat_session');
define('SESSION_LIFETIME', 86400 * 30);
```

### 3. Datenbankstruktur importieren
phpMyAdmin → Datenbank auswählen → Importieren → `sql/schema.sql`

### 4. Historische Daten importieren *(optional)*
phpMyAdmin → Importieren → `sql/import_data.sql`

### 5. Dateien per FTP hochladen
Alle Dateien ins Web-Verzeichnis. `includes/config.php` **nicht** öffentlich zugänglich machen.

---

## 🛠️ Deployment

GitHub Actions deployed automatisch per FTP nach all-inkl.com (`/html/statistik/`) und leert den PHP OPcache.  
Keine manuelle ZIP-Erstellung nötig – einfach committen und pushen.

---

## 🗄️ API-Endpunkte (Auswahl)

| Methode | Endpunkt | Beschreibung |
|---------|----------|--------------|
| GET | `disziplinen` | Disziplinen mit mapping_id + Ergebnisanzahl |
| GET | `rekorde` | Bestleistungen (Filter: kat, disz, mapping_id, merge_ak) |
| GET | `jahres-bestleistungen` | Jahresrückblick (Filter: jahr, typen, fav, merge_ak) |
| GET | `ergebnisse` | Ergebnisliste mit Filtern |
| POST | `ergebnisse/bulk` | Bulk-Import |
| PUT | `ergebnisse/{id}` | Ergebnis bearbeiten |
| GET | `veranstaltungen` | Veranstaltungsliste mit Filtern |
| GET/PUT | `veranstaltung-serien` | Regelmäßige Veranstaltungen (inkl. ort_letzte) |
| GET | `rr-fetch` | RaceResult-Proxy |
| GET | `mika-fetch` | MikaTiming-Proxy |
| GET | `uits-fetch` | uitslagen.nl-Proxy |
| POST | `auth/identify` | Login Schritt 1 (E-Mail) |
| POST | `auth/login` | Login Schritt 2 (Passwort) |
| POST | `auth/email-code-send` | 2FA E-Mail-Code anfordern |
| POST | `auth/email-code-verify` | 2FA E-Mail-Code prüfen |
| GET/PUT | `auth/prefs` | Nutzer-Präferenzen (Bestleistungen-Filter) |
| GET/POST/DELETE | `rollen` | Rollen & Rechte verwalten |

---

## ⚙️ Auto-Migrationen

Die API führt beim Start automatisch DDL-Migrationen aus (`ALTER TABLE … ADD COLUMN IF NOT EXISTS`):
- `benutzer`: `avatar_pfad`, `totp_pending`, `email_login_bevorzugt`, `prefs`
- `disziplin_mapping`: `fmt_override`, `kat_suffix_override`, `hof_exclude`, `distanz`, UNIQUE KEY `uq_disz_kat`
- `ergebnisse`: `disziplin_mapping_id`, `ak_platz_meisterschaft`
- `veranstaltungen`: `serie_id`
- `passkeys` Tabelle (WebAuthn)
- `rollen` Tabelle (Standard-Rollen: admin, editor, athlet, leser)
