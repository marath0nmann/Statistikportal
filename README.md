# Statistikportal – Leichtathletik
## Version v1236 | Stand: May 2026 

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
- Disziplinen mit 0 Ergebnissen werden ausgeblendet
- Disziplin-Trennung via `mapping_id` (gleicher Name in verschiedenen Kategorien möglich)
- Favorisierte Disziplinen erscheinen immer zuerst (konfigurierbar im Admin)
- Pace-Berechnung für alle Disziplinen ≥ 1 km
- Filtereinstellungen (mergeAK, unique, Jahres-Highlight) pro Nutzer persistent

### Ergebnisse
- Filter nach Athlet, Kategorie, Disziplin, AK, Jahr, Meisterschaft
- Inline-Bearbeiten-Dialog mit korrekter `mapping_id`

### Eintragen
- **Bulk-Eintragen**: Smart-Paste, Datum pro Zeile, Meisterschaft wählbar
- **Eigenes Ergebnis eintragen**: Reset- und „Speichern & Neues"-Button; Suchfeld „Bestehende Veranstaltung"
- **URL-Import** direkt im Paste-Feld (automatische Erkennung):
  - `my.raceresult.com/…` → RaceResult (inkl. tief verschachtelter AK-Listen)
  - `*.mikatiming.com/…` → MikaTiming (parallele Event-POSTs, Orts-/Datum-Erkennung)
  - `acn-timing.com` / `chronorace.be` → ACN Timing (alle Strecken, dynamische Spaltenerkennung)
  - `uitslagen.nl/uitslag?id=…` → uitslagen.nl
  - `evenementen.uitslagen.nl/JJJJ/slug/` → evenementen.uitslagen.nl (alle Strecken automatisch)
- Debug-Fenster für alle Import-Quellen

### Login & Sicherheit
- **3-Schritt-Login**: E-Mail → Passwort/Passkey → 2FA (TOTP, Passkey oder E-Mail-Code)
- Passkey (WebAuthn) als primäre oder alternative Anmeldung; RP-ID konfigurierbar (portalübergreifend)
- E-Mail-Verifizierungscode als 2FA-Fallback (6-stellig, 5 Min.)
- Passwort-Reset per E-Mail
- Avatar aus Athletenprofil wird nach Login sofort angezeigt
- **Login-Portal (SSO)**: optionaler Cross-Domain-Login via Shared Session Cookie (`login_portal_aktiv`)

### Athleten
- Öffentliche Athleten-Seite im Karten-Layout (5 Spalten Desktop) mit Vereinsrekord-/Bestleistungs-Badges
- Aufteilung in „Aktive Athleten" (Ergebnis in diesem/letztem Jahr) und „Inaktive Athleten"
- Athletenprofil: favorisierte Disziplinen erscheinen zuerst (farblich hervorgehoben), Ergebnisanzahl je Disziplin

### Veranstaltungen
- **Regelmäßige Veranstaltungen**: sortierbare Tabelle (MMDD-Schlüssel: nächste anstehende oben)
  - Bestleistungen pro Serie (Gesamt, Frauen/Männer, nach AK)
  - Ergebnisse nach Jahr sortiert

### Admin
- **Benutzer**: Verwaltung + Rollenzuweisung; Rollen-Manager (anlegen, bearbeiten, löschen); 2FA-Reset (Passkey/TOTP) pro Nutzer; ausstehende Registrierungen direkt im Benutzer-Tab (Badge mit Zähler)
- **Disziplinen**: Kategorie-Mapping, Format-Overrides, Favoriten; Distanz-Feld (automatisch aus Namen abgeleitet); HoF-Ausschluss-Toggle direkt in der Tabelle; Sortierung per Spaltenkopf; „Anlegen & Nächste"-Button
- **Altersklassen**: Verwaltung + Kategoriezuweisung
- **Meisterschaften**: Typen konfigurierbar (Olympia, WM, EM, DM, NRW, …)
- **Veranstaltungen**: Übersicht aller Veranstaltungen (Suche, Jahr-/Status-Filter, Sortierung); Bulk-Aktionen: Genehmigen, Sperren, Löschen, Umbenennen (Suchen & Ersetzen, Wildcard), Ort setzen, Durchnumerieren (Startnummer), Serie zuweisen; Serien-Tag unter dem Veranstaltungsnamen
- **Einstellungen**: Theme, Clubname, Logo, Footer-Texte; auto-approve für neue Veranstaltungen und eigene Ergebnisse; Login-Portal-Konfiguration
- **Dashboard-Editor**: Widget-Layout konfigurierbar
- **Anträge**: Ergebnis-Änderungsanträge durch Athleten
- **Papierkorb**: Gelöschte Einträge wiederherstellen

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
