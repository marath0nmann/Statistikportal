# Login-Portal – Zentrales Authentifizierungsportal

## Übersicht

Das Login-Portal ist eine eigenständige Webanwendung, die die Authentifizierung für mehrere Vereins-Apps zentralisiert. Es nutzt die gleiche Datenbank und Session-Infrastruktur wie das Statistikportal.

## Architektur

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  login.tus-oedt.de│     │statistik.tus-oedt│     │training.tus-oedt │
│  (Login-Portal)   │◄────│  (Statistik)     │     │  (zukünftig)     │
│                   │     │                   │     │                   │
│  Shared Session   │────►│  Shared Session   │────►│  Shared Session   │
│  Cookie: .tus-oedt.de                                                │
└──────────────────┘     └──────────────────┘     └──────────────────┘
        │                         │                         │
        └─────────────────────────┼─────────────────────────┘
                                  ▼
                        ┌──────────────────┐
                        │   Gemeinsame DB   │
                        │   (MariaDB)       │
                        └──────────────────┘
```

## Voraussetzungen

1. **Gleiche Datenbank** – Login-Portal und Statistikportal nutzen die selbe DB
2. **Gleicher `SESSION_NAME`** – In beiden `config.php` identisch
3. **`COOKIE_DOMAIN`** – In beiden `config.php` auf `.tus-oedt.de` (oder eure Parent-Domain) gesetzt
4. **Shared PHP-Klassen** – `auth.php`, `db.php`, `settings.php`, `totp.php`, `passkey.php` müssen im `includes/`-Verzeichnis des Login-Portals liegen

## Setup auf all-inkl.com

### 1. Subdomain anlegen

Im KAS-Admin eine neue Subdomain `login.tus-oedt.de` erstellen und auf einen eigenen Ordner zeigen lassen, z.B.:

```
/www/htdocs/USERNAME/login/htdocs/
```

### 2. Dateien hochladen

```
/www/htdocs/USERNAME/
├── login/
│   ├── htdocs/           ← Document-Root von login.tus-oedt.de
│   │   ├── index.html
│   │   ├── api/index.php
│   │   └── opcache-clear.php
│   └── includes/
│       ├── config.php     ← EIGENE config.php (gleiche DB!)
│       ├── auth.php       ← Kopie/Symlink vom Statistikportal
│       ├── db.php         ← Kopie/Symlink
│       ├── settings.php   ← Kopie/Symlink
│       ├── totp.php       ← Kopie/Symlink
│       └── passkey.php    ← Kopie/Symlink
│
├── statistik/
│   ├── htdocs/           ← Document-Root von statistik.tus-oedt.de
│   └── includes/
│       └── config.php     ← mit COOKIE_DOMAIN='.tus-oedt.de'
```

### 3. config.php einrichten

`login/includes/config.php` erstellen (Vorlage: `config.sample.php`):

```php
<?php
define('DB_HOST',    'localhost');
define('DB_PORT',    3306);
define('DB_NAME',    'GLEICHE_DB_WIE_STATISTIK');
define('DB_USER',    'GLEICHER_USER');
define('DB_PASS',    'GLEICHES_PASSWORT');
define('DB_CHARSET', 'utf8mb4');
define('TABLE_PREFIX', '');  // identisch!
define('SESSION_NAME',     'stat_session');  // identisch!
define('SESSION_LIFETIME', 86400 * 30);
define('COOKIE_DOMAIN', '.tus-oedt.de');  // PFLICHT!
```

### 4. Statistikportal anpassen

In der `config.php` des Statistikportals ebenfalls `COOKIE_DOMAIN` setzen:

```php
define('COOKIE_DOMAIN', '.tus-oedt.de');
```

### 5. Einstellungen im Admin-Panel

Im Statistikportal unter **Admin → Darstellung**:

- **Zentrales Login-Portal aktivieren**: ✅
- **Login-Portal URL**: `https://login.tus-oedt.de`

### 6. Apps registrieren

Im Statistikportal unter **Admin → Darstellung → Login-Portal** die Apps als JSON in der DB-Einstellung `login_portal_apps` konfigurieren:

```json
[
  {
    "name": "Statistikportal",
    "url": "https://statistik.tus-oedt.de",
    "icon": "📊",
    "farbe": "#cc0000",
    "beschreibung": "Leichtathletik-Statistiken & Ergebnisse"
  },
  {
    "name": "Trainingsportal",
    "url": "https://training.tus-oedt.de",
    "icon": "🏃",
    "farbe": "#003087",
    "beschreibung": "Trainingspläne & Dokumentation"
  }
]
```

## Funktionsweise

### Login-Flow

1. User besucht `statistik.tus-oedt.de`
2. `auth/me` → 401 (keine Session)
3. Frontend erkennt `login_portal_aktiv=1` → Redirect zu `login.tus-oedt.de?redirect=https://statistik.tus-oedt.de`
4. Login-Portal zeigt Login-Formular
5. Nach erfolgreichem Login: Session-Cookie mit `domain=.tus-oedt.de`
6. Redirect zurück zu `statistik.tus-oedt.de`
7. `auth/me` → 200 (Session erkannt über Shared Cookie)

### Standalone-Betrieb

Wenn `login_portal_aktiv=0` (Default), funktioniert das Statistikportal wie bisher mit eigenem Login. Keine Änderungen am bestehenden Verhalten.

### Features

- **3-Schritt-Login**: E-Mail → Passwort → 2FA (TOTP / Passkey / E-Mail-Code)
- **Registrierung**: Mit E-Mail-Bestätigung und optionalem TOTP-Setup
- **Passwort-Reset**: Per E-Mail-Code
- **App-Auswahl**: Nach Login ohne Redirect-Parameter
- **Responsive**: Optimiert für Desktop und Mobile
- **Dark Mode**: Automatisch via `prefers-color-scheme`
- **Vereinsbranding**: Übernimmt Logo und Farben aus den Einstellungen
