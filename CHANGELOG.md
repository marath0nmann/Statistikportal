# Changelog – TuS Oedt Leichtathletik Statistik

Alle wesentlichen Änderungen werden hier dokumentiert.  
Format: `vXXX – Kurzbeschreibung` mit Details zu Features, Fixes und Änderungen.

---

## v204 – Git-Integration
- `.gitignore`: `config.php`, `uploads/*`, `paket_v*/`, `.DS_Store` ausgeschlossen
- `CHANGELOG.md`: Versionshistorie eingeführt
- `commit.sh`: Schnell-Commit-Skript mit Bestätigungsdialog
- `.git/COMMIT_EDITMSG`: wird künftig von Claude vorausgefüllt

## v203 – Adressleiste Gradient-Endfarbe
- Safari iOS: `body background-color` = Header-Gradient-Endfarbe (Light: `--primary3`, Dark: `--primary-dark`)
- `_updateBodyThemeColor()`: wird bei `applyConfig()` und Theme-Wechsel aufgerufen

## v202 – Safari-Adressleiste einfärben
- `theme-color` Meta-Tag + `body background-color`-Trick für iOS Safari
- `html` und `#app-screen` erhalten Hintergrundfarbe damit nur die Adressleiste eingefärbt wird

## v201 – theme-color Meta-Tag
- `<meta name="theme-color">` für Chrome Android
- Wird in `applyConfig()` dynamisch auf Primärfarbe gesetzt

## v200 – AK-Platzierung wie Bestleistungen
- `platzBadge()`: Platz 1–3 in Gold/Silber/Bronze, ab 4 in `--text`
- Kein grüner Badge und kein `#`-Präfix mehr
- Ersetzt in Dashboard, Ergebnisse und Veranstaltungen

## v199 – Mobile Tabellenoptimierung
- Auf Smartphones (≤600px): Pace- und Meisterschaft-Spalten ausgeblendet
- Verbleibende 4 Spalten neu verteilt, Schrift + Padding kompakter
- Zusätzlicher Breakpoint für ≤400px

## v198 – Nav-Icons, Pace, Bearbeiten-Hover
- Nav-Icons: Unicode Variation Selector-15 (`\uFE0E`) für Text-Rendering in Safari
- Pace für alle Disziplinen ≥1km (nicht nur Straße): `calcPace()` als Fallback überall
- `btn-ghost:hover`: leichter Hintergrund mit `color-mix` in Akzentfarbe

## v197 – UI-Polishing (mehrere Bereiche)
- Nav aktiv: `--primary-dark` statt Accent-Unterstrich
- Rang 4–10 in Bestleistungen: `--text` statt `--text2`
- Veranstaltungen-Tab: einheitliche Spaltenbreiten (`veranst-dash-table`)
- Admin-Subtabs: Papierkorb ans Ende verschoben
- Papierkorb: Icon-only-Buttons mit `title`-Tooltip

## v196 – Nav-Icons, Dashboard-Tabelle, Aktivfarbe
- Nav-Buttons: Icon (`<span class="nav-icon">`) und Label getrennt
- Dashboard Veranstaltungen: Spaltenheader „Meisterschaft" ergänzt, Breiten angepasst
- Nav aktiver Tab: Hintergrund statt Accent2-Unterstrich

## v195 – Meisterschaften konfigurierbar
- Admin-Sub-Tab „🏅 Meisterschaften" zum Verwalten der Meisterschaftsarten
- `MSTR_LIST` und `MSTR_MAP` dynamisch aus `einstellungen`-Tabelle
- `mstrOptions()` für Dropdown-Felder, `_mstrSave()` für persistente Speicherung
- Edit-Dialog: Zahlenfeld → Dropdown mit konfigurierten Labels

## v194 – Meisterschaften als Tags
- DB-Werte 1–7 werden auf Labels gemappt: Olympia, WM, EM, DM, NRW, NR, Regio
- `mstrBadge()` und `mstrLabel()` als zentrale Hilfsfunktionen
- Badge-Design: goldbraun (Light) / helles Gold (Dark)
- Edit-Dialog: `input[number]` → `<select>` mit allen Optionen

## v193 – Dashboard Veranstaltungen: einheitliche Spalten
- `veranst-dash-table` mit `table-layout: fixed` und `<colgroup>`
- Spalten: Athlet 30%, AK 9%, Ergebnis 15%, Pace 13%, Platz AK 14%, Meisterschaft 19%

## v192 – Timeline-Punkt entfernt
- `timeline-dot` aus „Neueste Bestleistungen" entfernt

## v191 – `!important` aus Badges entfernt
- Alle `!important` aus `.badge-gold`, `.badge-blue`, `.badge-ak` entfernt
- Inline-`style="color:var(--text2)"` auf „Kein Athlet"-Badge im JS beseitigt

## v190 – Lösch-Button und Badge Dark Mode
- `btn-danger`: sieht wie `btn-ghost` aus, hover = hartes `#c0392b`
- Badge Dark Mode: stark abgedunkelte Hintergründe für gold/blue/ak

## v189 – Dark Mode Polishing
- Header-Gradient: Dark Mode läuft von `--primary` nach `--primary-dark`
- Ergebnisfarben: `--result-color` / `--result-accent-color` im Dark Mode aufgehellt
- `rekSectionHead`: `--btn-bg` → `--text`
- Jahres-Hervorhebung: Inline-Styles → CSS-Klassen `.hl-cur-year` / `.hl-prev-year`
- Tabellen-Hover: `#f5f7fd` → `var(--surf2)` überall
- Placeholder Dark Mode: globale Regel, Farbe = `var(--border)`

## v188 – Default-Vereinslogo
- `logo_datei` Default: `uploads/logo_default.png` (Beispiel-Logo)
- Normaler Lösch-Flow über Admin-Bereich

## v187 – Beispiel-Logo
- `htdocs/uploads/logo_default.png` als initiales Vereinslogo
- `onerror`-Handler blendet `<img>` bei fehlendem Logo still aus

## v186 – Generische Default-Werte
- `verein_name` → `'Mein Verein e.V.'`
- `verein_kuerzel` → `'Mein Verein'`
- `email_domain` / `noreply_email` → `vy99.de`

## v185 – Setup-Wizard + Tabellen-Prefix
- `htdocs/api/setup.php`: check / test_db / install / create_tables
- `includes/config.sample.php`: Vorlage für manuelles Setup
- `TABLE_PREFIX` in `config.php` für mehrere Instanzen in einer DB
- `DB::tbl()`: prepended Prefix vor alle Tabellennamen
- PHP-String-Parser für korrekte Quote-Behandlung bei der Ersetzung

## v184 – UX Vereinsfarben
- „↺ Zurücksetzen" in Panel-Header verschoben
- `rek-top-btn.active`: Outline für Dark-Mode-Erkennbarkeit
- `rek-disz-title`: `--text` + `border-bottom: 3px solid var(--accent)`

## v183 – Dark Mode Button-Fixes
- `rek-cat-btn`, `rek-top-btn`: hardcoded Weiß → `var(--surface)` / `var(--surf2)`
- Hover und Active-States mit CSS-Variablen

## v182 – Farbvalidierung
- `_validateFarbe()`: prüft Kontrast gegen hellen + dunklen Hintergrund
- Aufgerufen in `saveAllSettings()` vor dem Speichern

## v181 – Farben zurücksetzen
- Button „↺ Farben zurücksetzen" setzt auf `#cc0000` / `#003087` zurück

## v180 – Dynamische Akzentfarbe
- `--btn-bg` und `--btn-bg2` werden dynamisch auf `--accent`/`--accent2` gesetzt
- Logo-löschen-Button: inline Rot → `.btn-danger`

---

*Ältere Versionen (vor v180) sind nicht dokumentiert.*
