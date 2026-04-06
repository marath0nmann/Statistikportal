# Statistikportal – Leichtathletik
## Version v955 | Stand: April 2026

Webbasiertes Statistikportal für den Leichtathletik-Bereich.  
PHP/MariaDB · Shared Hosting (all-inkl.com) · Vanilla JS/CSS · keine externen Frameworks

---

## ✨ Features (aktueller Stand)

### Dashboard
- Konfigurierbare Widget-Layouts: Timeline, Bestleistungen, Veranstaltungen, Hall of Fame
- Timeline: Vereinsrekorde (Gold/Silber) + persönliche Bestleistungen (Grün)
- Korrekte AK-Labels (WHK/MHK bei merge_ak)
- Hall of Fame: Athleten mit Bestenlisten-Titeln + Avatar

### Bestleistungen / Rekorde
- Filter nach Kategorie, Disziplin, AK, Geschlecht
- Disziplin-Trennung via `mapping_id` (gleicher Name in verschiedenen Kategorien möglich)
- Favorisierte Disziplinen erscheinen immer zuerst (konfigurierbar im Admin)
- Pace-Berechnung für alle Disziplinen ≥ 1 km
- Filtereinstellungen (mergeAK, unique, Jahres-Highlight) pro Nutzer persistent

### Ergebnisse
- Filter nach Athlet, Kategorie, Disziplin, AK, Jahr, Meisterschaft
- Inline-Bearbeiten-Dialog mit korrekter `mapping_id`

### Eintragen
- **Bulk-Eintragen**: Smart-Paste, Datum pro Zeile, Meisterschaft wählbar
- **URL-Import** direkt im Paste-Feld (automatische Erkennung):
  - `my.raceresult.com/…` → RaceResult (inkl. tief verschachtelter AK-Listen)
  - `*.mikatiming.com/…` → MikaTiming
  - `uitslagen.nl/uitslag?id=…` → uitslagen.nl
  - `evenementen.uitslagen.nl/JJJJ/slug/` → evenementen.uitslagen.nl (alle Strecken automatisch)
- Debug-Fenster für alle Import-Quellen

### Login & Sicherheit
- **3-Schritt-Login**: E-Mail → Passwort/Passkey → 2FA (TOTP, Passkey oder E-Mail-Code)
- Passkey (WebAuthn) als primäre oder alternative Anmeldung
- E-Mail-Verifizierungscode als 2FA-Fallback (6-stellig, 5 Min.)
- Passwort-Reset per E-Mail
- Avatar aus Athletenprofil wird nach Login sofort angezeigt

### Veranstaltungen
- **Veranstaltungsserien**: Gruppen für jährlich wiederkehrende Veranstaltungen
  - Bestleistungen pro Serie (Gesamt, Frauen/Männer, nach AK)
  - Ergebnisse nach Jahr sortiert

### Admin
- **Benutzer**: Verwaltung + Rollenzuweisung; Rollen-Manager (anlegen, bearbeiten, löschen)
- **Registrierungen**: Genehmigen/Ablehnen, Athlet-Zuordnung, Badge mit offenem Zähler
- **Disziplinen**: Kategorie-Mapping, Format-Overrides, Favoriten mit Ergebnisanzahl-Badge
- **Altersklassen**: Verwaltung + Kategoriezuweisung
- **Meisterschaften**: Typen konfigurierbar (Olympia, WM, EM, DM, NRW, …)
- **Darstellung**: Theme, Clubname, Logo, Footer-Texte (Datenschutz, Impressum, AGB)
- **Dashboard-Editor**: Widget-Layout konfigurierbar
- **Anträge**: Ergebnis-Änderungsanträge durch Athleten
- **Papierkorb**: Gelöschte Einträge wiederherstellen

---

## 📁 Dateistruktur

```
deine-domain.de/
├── index.html              ← Haupt-App (Single-Page)
├── app.js                  ← Gesamtes Frontend-JS (konkateniert)
├── app.css                 ← Gesamtes CSS
├── api/
│   └── index.php           ← REST API (alle Endpunkte)
├── includes/
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

## 🛠️ Entwicklung & Build

```bash
python3 /home/claude/build.py <neue_version> "<commit_msg>" "<changelog_eintrag>"
```

Das Skript:
- Kopiert das aktuelle `paket_vXXX`-Verzeichnis
- Bumpt die Versionsnummer in `index.html`
- Schreibt `COMMIT_EDITMSG`, aktualisiert `CHANGELOG.md` und `README.md`
- Erzeugt `tus-oedt-statistik-vXXX.zip` in `/mnt/user-data/outputs/`

---

## 🗄️ API-Endpunkte (Auswahl)

| Methode | Endpunkt | Beschreibung |
|---------|----------|--------------|
| GET | `disziplinen` | Disziplinen mit mapping_id + Ergebnisanzahl |
| GET | `rekorde` | Bestleistungen (Filter: kat, disz, mapping_id, merge_ak) |
| GET | `ergebnisse` | Ergebnisliste mit Filtern |
| POST | `ergebnisse/bulk` | Bulk-Import |
| PUT | `ergebnisse/{id}` | Ergebnis bearbeiten |
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
- `passkeys` Tabelle (WebAuthn)
- `rollen` Tabelle (Standard-Rollen: admin, editor, athlet, leser)