# TuS Oedt – Leichtathletik Statistik
## Version 1.67 | Stand: März 2026

---

### 📁 Dateistruktur

```
deine-domain.de/
├── index.html              ← Haupt-App (Frontend)
├── .htaccess               ← URL-Routing & Sicherheit
├── api/
│   └── index.php           ← REST API (alle Endpunkte)
├── includes/
│   ├── config.php          ← Datenbank-Zugangsdaten ← ANPASSEN!
│   ├── db.php              ← Datenbankverbindung
│   ├── auth.php            ← Authentifizierung + TOTP
│   └── totp.php            ← 2-Faktor-Authentifizierung
└── sql/
    ├── schema.sql          ← Datenbankstruktur (einmalig ausführen)
    └── import_data.sql     ← Alle historischen Daten (einmalig)
```

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
```

#### 3. Datenbankstruktur importieren (phpMyAdmin)
1. Deine Datenbank auswählen → Reiter **Importieren**
2. Datei `sql/schema.sql` hochladen → **OK**

#### 4. Daten importieren
1. Reiter **Importieren**
2. Datei `sql/import_data.sql` hochladen → **OK**
   *(~1.620 Ergebnisse, 511 Veranstaltungen, 195 Athleten – dauert ca. 10–30 Sek.)*

#### 5. Dateien per FTP hochladen
Alle Dateien in dein Web-Verzeichnis hochladen.

**WICHTIG:** `includes/` enthält Passwörter!
Sicherste Variante: `includes/` **oberhalb** des Web-Verzeichnisses:
```
/www/htdocs/p123456/         ← öffentlich
    index.html, api/, ...
/www/private/includes/       ← NICHT öffentlich!
    config.php, db.php, auth.php, totp.php
```
Dann in `api/index.php` den Pfad anpassen:
```php
require_once __DIR__ . '/../../private/includes/db.php';
require_once __DIR__ . '/../../private/includes/auth.php';
```

#### 6. Ersten Login testen
- **URL:** `https://deine-domain.de/`
- **Benutzername:** `admin`
- **Passwort:** `Admin1234!`
- **→ Passwort sofort ändern!**

---

### ♻️ Update von einer älteren Version

Falls du bereits eine ältere Version im Einsatz hast und ein Backup (SQL-Dump) erstellt hast:

1. Den Dump **nicht neu importieren** – deine Daten sind bereits da.
2. Nur die PHP-Dateien und `index.html` per FTP überschreiben.
3. Datenbankstruktur ist bereits aktuell (alle Migrationen wurden durchgeführt).

---

### 🆕 Änderungen in Version 1.67

- **Einheitliche `ergebnisse`-Tabelle** für alle Disziplinen (Straße, Bahn, Halle, Sprung/Wurf)
- **Disziplin-Mapping** mit konfigurierbaren Kategorien
- **Gruppen-System** (z.B. „Senioren")
- **2-Faktor-Authentifizierung** (TOTP, z.B. Google Authenticator)
- **Athlet-Bestleistungen** (externe PBs eintragbar)
- **Papierkorb** für gelöschte Einträge
- **Veranstaltungs-Namen** editierbar
- **Bahn- & Hallen-Kategorien** ergänzt

---

### 👥 Benutzer-Rollen

| Rolle    | Rechte |
|----------|--------|
| `admin`  | Vollzugriff, Benutzer verwalten, Vereinsrekorde bearbeiten |
| `editor` | Ergebnisse eintragen, eigene Einträge löschen |
| `leser`  | Nur Ansicht |

---

### 🔒 Sicherheitshinweise

1. **Passwort sofort ändern** nach erstem Login
2. **HTTPS** verwenden (Let's-Encrypt via KAS)
3. `sql/`-Verzeichnis nach dem Import **löschen** oder per `.htaccess` sperren
4. **2FA aktivieren** (Admin → Konto → 2-Faktor einrichten)
5. Regelmäßige **Datenbank-Backups** über das KAS einrichten

---

### 📋 API-Endpunkte (Übersicht)

```
POST   api/auth/login              Login (Schritt 1)
POST   api/auth/totp-verify        Login (Schritt 2: TOTP)
POST   api/auth/logout             Logout
GET    api/auth/me                 Eingeloggter Benutzer
POST   api/auth/passwort           Passwort ändern

GET    api/dashboard               Dashboard-Daten

GET    api/ergebnisse              Alle Ergebnisse (gefiltert)
GET    api/strasse                 Straßenlauf-Ergebnisse
GET    api/sprint                  Sprint-Ergebnisse
GET    api/mittelstrecke           Mittelstrecke-Ergebnisse
GET    api/sprungwurf              Sprung & Wurf-Ergebnisse
POST   api/{kategorie}             Neues Ergebnis
DELETE api/{kategorie}/{id}        Ergebnis löschen
POST   api/ergebnisse/bulk         Massenimport

GET    api/athleten                Alle Athleten
GET    api/athleten/{id}           Athlet + alle Ergebnisse
POST   api/athleten/{id}/pb        Externe PB eintragen

GET    api/rekorde                 Bestenlisten
GET    api/rekorde/disziplinen     Disziplinen einer Kategorie

GET    api/kategorien              Disziplin-Kategorien
GET    api/disziplin-mapping       Disziplin-Zuordnungen (Admin)

GET    api/veranstaltungen         Veranstaltungen

GET    api/benutzer                Alle Benutzer (Admin)
POST   api/benutzer                Neuer Benutzer (Admin)

GET    api/gruppen                 Gruppen
GET    api/papierkorb              Papierkorb (Admin)
```

---

### ❓ Häufige Probleme

**„500 Internal Server Error"**
→ PHP-Version prüfen: KAS → PHP-Version → mind. **PHP 8.1** auswählen

**„Access denied for user"**
→ Datenbank-Zugangsdaten in `includes/config.php` prüfen

**Login funktioniert, aber Daten fehlen**
→ `sql/import_data.sql` noch nicht importiert

**Logo wird nicht angezeigt**
→ Logo lokal als `assets/logo.png` speichern und Pfad in `index.html` anpassen

---

*TuS Oedt Leichtathletik Statistik · Version 1.67 · März 2026*
