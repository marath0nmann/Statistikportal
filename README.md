# TuS Oedt – Leichtathletik Statistik
## Version v519 | Stand: März 2026

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
│   ├── auth.php            ← Authentifizierung + TOTP
│   └── totp.php            ← 2-Faktor-Authentifizierung
├── modules/                ← JS-Quellmodule (00–11)
│   ├── 00_globals.js
│   ├── 02a_config.js       ← Meisterschaftstypen, Badges, Themes
│   ├── 03_dashboard.js     ← Timeline, Bestleistungen, Hall of Fame
│   ├── 04_ergebnisse.js    ← Ergebnisliste + Bearbeiten-Dialog
│   ├── 06_rekorde.js       ← Bestleistungen-Tab
│   ├── 07_eintragen.js     ← Bulk-Eintragen + Smart-Paste
│   ├── 08_raceresult.js    ← RaceResult-Import
│   ├── 09*.js              ← Admin-Tabs
│   ├── 10_utils.js         ← Gemeinsame Hilfsfunktionen
│   └── 11_mikatiming.js    ← MikaTiming-Import
├── build.sh                ← Build-Script (concateniert Module → app.js)
└── sql/
    ├── schema.sql          ← Datenbankstruktur (einmalig ausführen)
    └── import_data.sql     ← Historische Daten (einmalig)
```

---

### ✨ Aktuelle Features (v519)

**Dashboard**
- Konfigurierbare Widget-Layouts (Statistik-Karten, Timeline, Veranstaltungen, Hall of Fame)
- Hall-of-Fame-Widget: Athleten mit Bestenlisten-Titeln, sortiert nach Titelanzahl
- Timeline: zwei Label-Spuren (Vereinsrekorde gold/silber + persönlich grün), Filterung nach Typ
- Neueste Bestleistungen mit Kategorie-Suffix immer korrekt (Race Condition gefixt)

**Bestleistungen / Rekorde**
- Bestleistungen nach Kategorie, Disziplin (mit Suffix), AK, Geschlecht
- Pace-Berechnung für alle Disziplinen ≥ 1 km
- Medal-Badges: Gold/Silber/Bronze mit farbigem Hintergrund

**Ergebnisse**
- Filter nach Athlet, Kategorie, Disziplin, AK, Jahr, Meisterschaft (Mehrfachauswahl)
- Bearbeiten-Dialog: Kategorie-Filter + Disziplin mit Suffix + korrekte `mapping_id`

**Eintragen**
- **Bulk-Eintragen**: Smart-Paste (parst Veranstaltung, AK, Datum, Disziplin, Name, Zeit, Platz aus Clipboard-Text), Datum pro Zeile, Meisterschaft
- **RaceResult-Import**: my.raceresult.com, automatisches Athlet-Matching, Modal für unbekannte Athleten (zuordnen / neu anlegen / überspringen), AK-Platz-Berechnung, Meisterschaft + Platz MS
- **MikaTiming-Import**: cURL-Proxy, Session-Persistenz, Meisterschaft + Platz MS
- **Meisterschaft-Checkbox**: aktiviert Meisterschaft-Spalten + wendet gewählten Typ sofort auf alle Zeilen an; Platz MS aus AK-Platz vorbelegt

**Admin**
- Dashboard-Layout-Editor
- Altersklassen-Verwaltung (Jugend-AKs konfigurierbar)
- Meisterschaftstypen konfigurierbar (Olympia, WM, EM, DM, NRW, NR, Regio + eigene)
- Footer-URLs, Club-Logo, Farben, Dark Mode

---

### 🔧 Schritt-für-Schritt-Setup (Neuinstallation)

#### 1. Datenbank bei all-inkl anlegen
1. KAS öffnen → **Datenbanken**
2. Neue MySQL-Datenbank anlegen
3. Notiere: **Datenbankname**, **Benutzer**, **Passwort**, **Host**

#### 2. `includes/config.php` anlegen
```php
<?php
define('DB_HOST', 'localhost');
define('DB_NAME', 'p123456_statistik');   // ← dein Datenbankname
define('DB_USER', 'p123456_statistik');   // ← dein Datenbankbenutzer
define('DB_PASS', 'DEIN_PASSWORT');       // ← dein Passwort
define('TBL_PREFIX', 'tus_');             // ← Tabellen-Präfix
```

#### 3. Datenbankstruktur importieren (phpMyAdmin)
1. Deine Datenbank auswählen → Reiter **Importieren**
2. Datei `sql/schema.sql` hochladen → **OK**

#### 4. Daten importieren
1. Reiter **Importieren**
2. Datei `sql/import_data.sql` hochladen → **OK**

#### 5. Dateien per FTP hochladen
Alle Dateien in dein Web-Verzeichnis hochladen.  
**WICHTIG:** `includes/config.php` niemals öffentlich zugänglich machen.

---

### 🛠️ Entwicklung & Build

```bash
# app.js + app.css aus Modulen bauen und ZIP erzeugen
bash /home/claude/dev/build.sh
```

Die Version wird automatisch in `app.js`, `app.css` und `index.html` eingetragen (via `sed`).  
Output: `/mnt/user-data/outputs/tus-oedt-statistik-vXXX.zip`

**Modul-Reihenfolge** (build.sh):
```
00_globals → 02a_config → 02b_setup → 02c_auth → 02d_nav →
03_dashboard → 04_ergebnisse → 05_veranstaltungen → 06_rekorde →
07_eintragen → 08_raceresult → 09*_admin_* → 10_utils → 11_mikatiming
```

---

### 🗄️ Wichtige API-Endpunkte

| Methode | Endpunkt | Beschreibung |
|---------|----------|--------------|
| GET | `disziplinen` | Alle Disziplinen mit Kategorie + mapping_id |
| GET | `rekorde?kat=&disz=&merge_ak=` | Bestleistungen |
| GET | `ergebnisse?...` | Ergebnisliste mit Filtern |
| POST | `ergebnisse/bulk` | Bulk-Import (inkl. meisterschaft, ak_platz_meisterschaft) |
| PUT | `ergebnisse/{id}` | Ergebnis bearbeiten (disziplin_mapping_id direkt) |
| GET | `mika-fetch?base_url=&club=` | MikaTiming Proxy |
| GET | `altersklassen` | Verwendete AKs + Jugend-Status |
| POST | `einstellungen` | Einstellungen speichern (jugend_aks, meisterschaft_typen, …) |
| POST | `athleten` | Athlet anlegen (name_nv, vorname, nachname, geschlecht, geburtsjahr) |

---

### 🏷️ Disziplin-System

Disziplinen sind eindeutig über `disziplin_mapping_id` identifiziert — nicht über den Namen.  
„800m (Bahn)" und „800m (Straße)" haben **denselben Namen** aber **verschiedene IDs**.

- `diszMitKat(disziplin, mappingId)` → Anzeigename mit Suffix
- `kat_suffix_override`: Pro Disziplin konfigurierbares Suffix (Admin → Disziplinen)

---

### ⚙️ Auto-Migrationen

Die API führt beim Start automatisch `ALTER TABLE … ADD COLUMN IF NOT EXISTS` aus für:
- `benutzer.avatar_pfad`
- `disziplin_mapping.*` (anzeige_name, fmt_override, kat_suffix_override, hof_exclude)
- `ergebnisse.disziplin_mapping_id`
- `ergebnisse*.ak_platz_meisterschaft` (alle 5 Tabellen)
