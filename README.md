# TuS Oedt – Leichtathletik Statistik
## Version v616 | Stand: März 2026

---

### 📁 Dateistruktur

```
deine-domain.de/
├── index.html              ← Haupt-App (Frontend)
├── app.js                  ← Gesamtes JS (aus modules/ zusammengebaut)
├── app.css                 ← Gesamtes CSS
├── .htaccess               ← URL-Routing & Sicherheit
├── api/
│   └── index.php           ← REST API (alle Endpunkte)
├── includes/
│   ├── config.php          ← Datenbank-Zugangsdaten ← ANPASSEN!
│   ├── db.php              ← Datenbankverbindung
│   ├── auth.php            ← Authentifizierung + 2FA
│   ├── passkey.php         ← WebAuthn/Passkey-Implementierung
│   ├── totp.php            ← TOTP (RFC 6238)
│   └── settings.php        ← Einstellungen-Helper
├── modules/                ← JS-Quellmodule
│   ├── 00_globals.js       ← Globaler State
│   ├── 02a_config.js       ← Konfiguration, Themes
│   ├── 02b_setup.js        ← Ersteinrichtung
│   ├── 02c_auth.js         ← Login, Profil, Passkey-UI
│   ├── 02d_nav.js          ← Navigation, Hash-Routing
│   ├── 03_dashboard.js     ← Timeline, Bestleistungen, Hall of Fame
│   ├── 04_ergebnisse.js    ← Ergebnisliste + Filter
│   ├── 05_athleten.js      ← Athleten-Verwaltung
│   ├── 06_rekorde.js       ← Bestleistungen-Tab
│   ├── 07_eintragen.js     ← Bulk-Eintragen + URL-Import
│   ├── 08_raceresult.js    ← RaceResult-Parser
│   ├── 09*_admin_*.js      ← Admin-Tabs
│   ├── 10_utils.js         ← Hilfsfunktionen
│   ├── 11_mikatiming.js    ← MikaTiming-Import
│   ├── 12_passkey.js       ← Passkey-Verwaltung
│   └── 13_uitslagen.js     ← uitslagen.nl-Import
├── build.sh                ← Build-Script
└── sql/
    ├── schema.sql          ← Datenbankstruktur (einmalig)
    └── import_data.sql     ← Historische Daten (einmalig)
```

---

### ✨ Aktuelle Features (v616)

**Dashboard**
- Konfigurierbare Widget-Layouts (Timeline, Bestleistungen, Veranstaltungen, Hall of Fame)
- Timeline: Vereinsrekorde (Gold/Silber) + persönliche Bestleistungen (Grün)
- Korrekte Label-Logik: WHK/MHK statt "Frauen/Männer" bei merge_ak
- Hall of Fame: Athleten mit Bestenlisten-Titeln

**Bestleistungen / Rekorde**
- Filter nach Kategorie, Disziplin, AK, Geschlecht
- Disziplin-Trennung bei gleichnamigen Disziplinen in verschiedenen Kategorien (mapping_id)
- Pace-Berechnung für alle Disziplinen ≥ 1km

**Ergebnisse**
- Filter nach Athlet, Kategorie, Disziplin, AK, Jahr, Meisterschaft
- Bearbeiten-Dialog mit korrekter mapping_id

**Eintragen (vereinfacht)**
- **Bulk-Eintragen**: Smart-Paste, Datum pro Zeile, Meisterschaft
- **URL-Import** direkt im Paste-Feld (automatische Erkennung):
  - `my.raceresult.com/...` → RaceResult-Import
  - `*.mikatiming.com/...` → MikaTiming-Import
  - `uitslagen.nl/uitslag?id=...` → uitslagen.nl-Import
- Kategorie-Auswahl → gefilterte Disziplin-Vorauswahl
- Debug-Fenster für alle Import-Quellen

**2FA / Sicherheit**
- Passkey (WebAuthn) als Alternative zu TOTP — für alle User
- Login: Passwort → TOTP oder Passkey (je was registriert)
- Passkey-Verwaltung im Profil (hinzufügen/löschen)
- Hash-Routing: F5 stellt aktiven Tab wieder her, Back/Forward funktioniert

**Admin**
- Dashboard-Layout-Editor
- Altersklassen-Verwaltung
- Meisterschaftstypen konfigurierbar
- Disziplin-Mapping: UNIQUE auf `(disziplin, kategorie_id)` — gleicher Name in verschiedenen Kategorien möglich

---

### 🔧 Schritt-für-Schritt-Setup (Neuinstallation)

#### 1. Datenbank anlegen (all-inkl.com KAS)
1. KAS → Datenbanken → Neue MySQL-Datenbank
2. Notiere: Datenbankname, Benutzer, Passwort, Host

#### 2. `includes/config.php` anlegen
```php
<?php
define('DB_HOST',    'localhost');
define('DB_NAME',    'p123456_statistik');
define('DB_USER',    'p123456_statistik');
define('DB_PASS',    'DEIN_PASSWORT');
define('DB_CHARSET', 'utf8mb4');
define('TABLE_PREFIX', '');
define('SESSION_NAME',     'stat_session');
define('SESSION_LIFETIME', 86400 * 30);
```

#### 3. Datenbankstruktur importieren (phpMyAdmin)
1. Datenbank auswählen → Importieren
2. `sql/schema.sql` hochladen → OK

#### 4. Historische Daten importieren (optional)
1. `sql/import_data.sql` hochladen → OK

#### 5. Dateien per FTP hochladen
Alle Dateien ins Web-Verzeichnis.  
**WICHTIG:** `includes/config.php` niemals öffentlich zugänglich machen.

---

### 🛠️ Entwicklung & Build

```bash
bash /home/claude/dev/build.sh
```

Erzeugt:
- `htdocs/app.js` aus allen Modulen (concateniert)
- Versionsnummer in `index.html` gebumt
- ZIP-Paket in `/mnt/user-data/outputs/tus-oedt-statistik-vXXX.zip`

**Nach jedem Build aktualisieren:**
- `COMMIT_EDITMSG` — Kurzbeschreibung der Änderungen
- `README.md` — Version + Features
- `CHANGELOG.md` — Detaillierter Eintrag

---

### 🗄️ Wichtige API-Endpunkte

| Methode | Endpunkt | Beschreibung |
|---------|----------|--------------|
| GET | `disziplinen` | Alle Disziplinen mit mapping_id |
| GET | `rekorde?kat=&disz=&mapping_id=&merge_ak=` | Bestleistungen |
| GET | `ergebnisse?...` | Ergebnisliste mit Filtern |
| POST | `ergebnisse/bulk` | Bulk-Import (`items`-Array) |
| PUT | `ergebnisse/{id}` | Ergebnis bearbeiten |
| GET | `rr-fetch?event_id=&r=` | RaceResult-Proxy |
| GET | `mika-fetch?base_url=&club=` | MikaTiming-Proxy |
| GET | `uits-fetch?url=` | uitslagen.nl-Proxy |
| GET | `auth/passkey-reg-challenge` | Passkey-Registrierung |
| POST | `auth/passkey-reg-verify` | Passkey speichern |
| POST | `auth/passkey-auth-challenge` | Passkey-Login |
| POST | `auth/passkey-auth-verify` | Passkey-Login verifizieren |

---

### 🏷️ Disziplin-System

Disziplinen sind eindeutig über `disziplin_mapping_id` identifiziert.  
„5.000m (Bahn)" und „5.000m (Cross)" haben **denselben Namen** aber **verschiedene IDs**.

- UNIQUE KEY: `(disziplin, kategorie_id)` — gleicher Name in verschiedenen Kategorien erlaubt
- `mapping_id` muss bei allen API-Calls übergeben werden (Rekorde, Ergebnisse-Filter)

---

### ⚙️ Auto-Migrationen

Die API führt beim Start automatisch `ALTER TABLE … ADD COLUMN IF NOT EXISTS` aus für:
- `benutzer.avatar_pfad`
- `benutzer.totp_pending`
- `disziplin_mapping.*` (anzeige_name, fmt_override, kat_suffix_override, hof_exclude)
- `disziplin_mapping`: UNIQUE KEY `uq_disz_kat (disziplin, kategorie_id)`
- `ergebnisse.disziplin_mapping_id`
- `ergebnisse*.ak_platz_meisterschaft`
- `passkeys` Tabelle (WebAuthn)
