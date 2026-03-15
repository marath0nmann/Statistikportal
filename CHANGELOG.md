# Changelog – TuS Oedt Leichtathletik Statistik

Alle wesentlichen Änderungen werden hier dokumentiert.  
Format: `vXXX – Kurzbeschreibung` mit Details zu Features, Fixes und Änderungen.

---

## v493 – DB-Migration ak_platz_meisterschaft

### Fixes
- Auto-Migration beim API-Start: `ak_platz_meisterschaft SMALLINT NULL` in allen 5 Ergebnis-Tabellen (`ergebnisse`, `ergebnisse_strasse`, `ergebnisse_sprint`, `ergebnisse_mittelstrecke`, `ergebnisse_sprungwurf`)
- Meisterschafts-Platz beim Aktivieren der Checkbox aus AK-Platz vorausfüllen (`defaultValue`)
- „Name erforderlich"-Fehler im Modal für unbekannte Athleten: `name_nv` + `geburtsjahr` werden nun korrekt mitgeschickt

---

## v492 – Meisterschafts-Platz aus AK-Platz vorausfüllen

- `importToggleMstr`: Platz-Felder werden beim Einblenden auf `inp.defaultValue` (= AK-Platz aus Import-HTML) gesetzt, beim Ausblenden zurückgesetzt

---

## v491 – Meisterschaft: Checkbox + Select inline

- Checkbox „Meisterschaft?" + Select direkt nebeneinander bei Veranstaltungsfeldern
- `onchange` am Select wendet gewählten Wert sofort auf alle Zeilen an
- „Alle setzen"-Bar und „Platz (opt.)"-Feld entfernt
- Gilt für RaceResult, MikaTiming und Bulk-Eintragen

---

## v490 – Fix weißes Bild (Quote-Escaping)

- `importToggleMstr('bk'/'rr'/'mika', ...)` in Inline-Strings: einfache Anführungszeichen korrekt escaped (`\'...'`)

---

## v487–v489 – Meisterschaft-Checkbox + Modal-Fix

### Meisterschaft-Checkbox
- Checkbox + Select bei Veranstaltungsfeldern (Datum/Ort-Bereich) in allen drei Import-Modulen
- Meisterschaft-Spalten + „Alle setzen"-Bar erst sichtbar wenn angehakt
- Platz MS aus AK-Platz vorausgefüllt (RR + MikaTiming)

### Fix „Name erforderlich"
- `rrmConfirm`: `name_nv` (Format `Nachname, Vorname`) und `geburtsjahr` werden an `apiPost('athleten')` übergeben
- API: `geburtsjahr` in `athleten`-INSERT aufgenommen

---

## v486 – Meisterschaft in allen drei Import-Modulen

### Features
- RaceResult: „Alle setzen"-Bar über Tabelle
- MikaTiming: „Alle setzen"-Bar
- Bulk-Eintragen: Meisterschaft + Platz MS Spalten + „Alle setzen"-Bar
- Gemeinsame Hilfsfunktionen: `importSetAllMstr(prefix)`, `importMstrAllBar(prefix)`

---

## v485 – Medal-Badges: Farben getauscht

- Gold/Silber/Bronze: farbiger Hintergrund + weißer Text statt hellem Hintergrund + farbigem Rand
- Ab Platz 4 (`.medal-badge.rank`) unverändert
- Dark Mode ebenfalls angepasst

---

## v484 – Meisterschaft + Platz MS in RaceResult und MikaTiming

- Neue Spalten „Meisterschaft" und „Platz MS" in beiden Import-Previews
- Platz-Feld erscheint nur wenn Meisterschaft gewählt
- Import sendet `meisterschaft` + `ak_platz_meisterschaft`
- Bulk-API speichert `ak_platz_meisterschaft`

---

## v483 – Modal für unbekannte Athleten im RaceResult-Import

- Bei „Ausgewählte importieren" mit `– manuell –` erscheint Modal
- Optionen pro Athlet: Zuordnen (Select), Neu anlegen (Felder vorbelegt aus RR-Daten), Überspringen
- Neu angelegte Athleten werden sofort in `state.athleten` aufgenommen
- Nach dem Modal: Import läuft normal weiter

---

## v482 – Fix RaceResult iNetto=iClub-Kollision

- Default `iNetto=7` kollidierte mit `iClub=7` bei Events ohne Chip/Netto-Feld (`Ziel.GUN`)
- Fix: `iNetto` und `iZeit` Default auf `-1`; Fallback `iNetto=iZeit`; Sicherheits-Check `iNetto !== iClub`

---

## v481 – Bulk Datum-Spalte: Textfeld statt Datums-Picker

- `type="date"` → `type="text"` mit Placeholder `TT.MM.JJJJ`
- Kann leer bleiben → globales Datum gilt
- Konvertierung `TT.MM.JJJJ → YYYY-MM-DD` in `bulkSubmit`
- Smart-Paste schreibt ebenfalls im `TT.MM.JJJJ`-Format

---

## v480 – Fix RaceResult Disziplin-Erkennung (groupKey)

- `gk` war immer der **letzte** Teil des Pfades (`#1_Männlich`) statt dem vollen Pfad
- Fix: `gk = vollständiger gkey` (`#1_Halbmarathon/#1_Männlich`), `gkLast` für AK/Geschlecht-Erkennung
- Render-Loop nimmt `gkParts[0]` → `#1_Halbmarathon` → `Halbmarathon` ✓

---

## v479 – Fix Debug-Output contestName/rrBestDisz

- Debug zeigte `rrBestDisz: ""` weil groupKey nicht gesplittet wurde
- Debug-Code nutzt jetzt dieselbe Split-Logik wie die Render-Loop

---

## v478 – Fix Race Condition Disziplin-Kategorie-Suffix

- `loadDisziplinen()` lief parallel zu `navigate()`/`renderDashboard()`
- `showApp()` ist jetzt `async`, `await loadDisziplinen()` vor `navigate()`
- Suffix (`Straße`, `Bahn`) immer korrekt in Timeline + Bestleistungen

---

## v477 – Fix PUT disziplin_mapping_id

- API-PUT nutzte immer ersten DB-Treffer für `WHERE disziplin='800m'` → immer Straße
- Fix: `disziplin_mapping_id` direkt aus Body nutzen wenn vorhanden
- Ermöglicht korrekte Änderung von „800m (Straße)" auf „800m (Bahn)"

---

## v476 – Ergebnis bearbeiten: Disziplin mit Kategorie-Suffix + mapping_id

- Disziplin-Dropdown zeigt immer `diszMitKat()` (z.B. „800m (Bahn)")
- `value` = `disziplin_mapping_id` (eindeutig)
- `data-edit-mapping-id` im Edit-Button
- `saveEditErgebnis` sendet `disziplin_mapping_id` mit

---

## v475 – Ergebnis bearbeiten: Kategorie-Filter

- Kategorie-Select im Bearbeiten-Dialog (vorbelegt mit aktuellem `subTab`)
- Disziplin-Dropdown filtert sich bei Kategoriewechsel
- `editKatChanged()` mit Suffix + mapping_id

---

## v474 – Fix [object Object] im Ergebnis-bearbeiten-Dialog

- `state.disziplinen` ist Objekt-Array; Edit-Dialog verwendete es direkt als String
- Fix: `.map(d => d.disziplin)` + Deduplizierung + Sortierung

---

## v473 – Fix weißes Bild (Placeholder-Newlines)

- Textarea-Placeholder enthielt echte Newlines im JS-String → Syntaxfehler
- Ersetzt durch `&#10;` (HTML-Entity)

---

## v472 – Bulk-Eintragen: Smart-Paste

- Textarea „Ergebnisse einlesen" + „Einlesen"-Button
- Parser erkennt: Veranstaltung + Ort (Semikolon-Trenner), AK, Datum (`TT.MM.JJ`), Disziplin, Name + Zeit + Platz + Emoji-Medaillen
- Athlet-Matching: normalisiert (Umlaute, Vor-/Nachname vertauscht)
- Disziplin-Matching gegen DB-Liste
- Datum-Spalte pro Zeile für verschiedene Wettkampftage

---

## v471 – Fix Pace-Berechnung in Bestleistungen

- `r.disz` war in `buildRekTable` immer `undefined`
- Fix: `_disz` aus `state.rekState.disz` (Closure)

---

## v339–v442 – [Siehe vorherige Session-Transcripts]

Ältere Einträge in früheren CHANGELOG-Versionen dokumentiert.

---

## v204 – Git-Integration
- `.gitignore`, `CHANGELOG.md`, `commit.sh` eingeführt

