# Changelog – TuS Oedt Leichtathletik Statistik

Alle wesentlichen Änderungen werden hier dokumentiert.  
Format: `vXXX – Kurzbeschreibung` mit Details zu Features, Fixes und Änderungen.

---

## v612 – Fix RaceResult-Import: ältere Feldnamen erkannt

- 49. Forstwalder Silvesterlauf 2019: DataFields nutzt englische Feldnamen
  "DisplayName" → iName war 3 (BIB-Default), Name zeigte Startnummern
  "GenderMF" → iGeschlecht nicht gesetzt
  "WithStatus([OverallRankp])" → iPlatz nicht gesetzt
  "AgeGroupName1" → bereits erkannt via indexOf("agegroup") ✓
- _calibrateDF erweitert: DisplayName/FullName, GenderMF/Gender/Sex,
  OverallRank/WithStatus, AgeGroupName
- Alle Vorkommen in 07_eintragen.js, 08_raceresult.js, template (11+8+3)

---


## v611 – DLV-Standard: WHK/MHK statt W/M

- `calcDlvAK()`: Hauptklasse (23-29 Jahre) → MHK/WHK statt M/W
- `normalizeAK()`: "M"/"W" → MHK/WHK; Männer/Frauen-Texte → MHK/WHK
- `isValidDlvAK()`: MHK/WHK als gültige AKs anerkannt
- `uitsAKFromCat()`: MSEN → MHK, VSEN → WHK
- Bestehende DB-Einträge mit "M"/"W" werden per PHP-CASE-Merge weiterhin
  korrekt als MHK/WHK angezeigt (keine Datenmigration nötig)
- Änderungen in: 07_eintragen.js, 08_raceresult.js, 13_uitslagen.js

---


## v610 – Fix RaceResult-Import: Disziplin-Quellenauswahl

- v609-Fix griff nicht: contestName="Ergebnislisten|Zieleinlaufliste" war truthy
  → kClean mit Distanz wurde nie als Fallback genutzt
- Fix: alle Kandidaten (contestName, kClean, gk) in Reihenfolge prüfen,
  erste Quelle die rrBestDisz-Treffer liefert gewinnt

---


## v609 – Fix RaceResult-Import: Disziplin bei Contest=0

- Forstwalder Silvesterlauf: alle Listen haben Contest="0" (alle zusammen)
  contestObj["0"] = undefined → contestName leer → keine Distanz für rrBestDisz
- Top-Level-Key der Datenstruktur enthält Contest-Name mit Distanz:
  "#1_Jedermann-Lauf, 4.100m" → kClean = "Jedermann-Lauf, 4.100m"
- Fix: cnD = contestName || kClean || gk
  rrBestDisz("Jedermann-Lauf, 4.100m") → "4,1km" ✓

---


## v608 – Fix RaceResult-Import: AK-Platz statt Gesamtplatz

- Problem: "detaillierte Einlaufliste" hat Gesamtplatz (166, 559, 690),
  "Ergebnisliste AK" hat AK-Platz (7, 6, 16) — kommt aber später
- Duplikat-Check übersprang die AK-Liste vollständig
- Fix: bei Duplikat (gleicher Name + Zeit) wird der Platz aktualisiert,
  wenn der neue Wert kleiner und > 0 ist (AK-Platz < Gesamtplatz)
- Außerdem: fehlende AK aus späterer Liste ergänzen

---


## v607 – Fix RaceResult-Import: TIME1 nicht erkannt

- 62. Winterlauf Aachen: DataField heißt "TIME1" statt "TIME"/"NETTO"/"GUN"
  → _calibrateDF() setzte iZeit=-1 → alle Zeilen verworfen (0 Treffer)
- Fix: f==='time' || f.indexOf('time')===0 ergänzt (TIME, TIME1, TIME_NET etc.)
- Fix in: 07_eintragen.js, 08_raceresult.js, new_bulkRR_template.js

---


## v606 – Fix Timeline: Co-Debüt alle Athleten am ersten Tag

- Problem: Julia/Maren/Guido debütieren alle am gleichen Tag in 5.200m Cross
  Guido (bestes Ergebnis) → "Erste Gesamtleistung" ✓
  Julia (schlechter als Guido) → fiel durch auf Geschlechts-Ebene → "Erstes Ergebnis Frauen"
  Maren (besser als Julia) → "Bestleistung WHK" (v605-Fix griff, aber falsche Ebene)
- Fix: $firstEverDatum trackt das Datum des ersten jemals gespeicherten Ergebnisses
  Alle Ergebnisse mit $datum === $firstEverDatum bekommen "Erste Gesamtleistung"
  unabhängig davon ob sie besser/schlechter als das bisherige Tages-Beste sind

---


## v605 – Fix Timeline/PB: Co-Debüt am gleichen Tag

- Problem: Julia und Maren debütieren am selben Tag; Maren bekam "Bestleistung WHK"
  statt "Erstes Ergebnis Frauen", weil Julias Ergebnis als Vorgänger galt
- Fix: Datum des bisherigen Bestwerts wird mitgetrackt
  ($bestGesamtDatum, $bestByGDatum, $bestByAKDatum)
- Wenn vorheriger Bestwert am gleichen Datum: Co-Debüt → $isFirst = true,
  $vorher = null → kein "verbessert von X auf Y" wird angezeigt
- Gilt für alle drei Ebenen: Gesamt, Geschlecht/HK, AK

---


## v604 – Fix uitslagen.nl: Fallback filtert per Athleten-Name

- Statt alle 420 Einträge: `uitsAutoMatch()` gegen Athleten-DB vorab filtern
- Nur Zeilen mit Namens-Treffer werden in die Bulk-Tabelle übertragen

---


## v603 – Fix uitslagen.nl Import: Fallback bei fehlendem Vereinsnamen

- Bei manchen Events trägt der Veranstalter nur Ort/Kürzel statt Vereinsname ein
  (z.B. Swift Cross: "Willich" statt "TuS Oedt") → 0 Treffer
- Fallback: wenn 0 Vereinstreffer, alle Einträge übergeben
  bulkFillFromImport matcht dann per Athleten-Name gegen die DB
  → nur echte TuS-Athleten bekommen einen Treffer im Dropdown

---


## v602 – Ergebnis-Format: Komma in UI, Punkt für DB

- `fmtRes(v)`: Punkt→Komma für Input-Felder (Anzeige)
- `dbRes(v)`: Komma→Punkt für DB-Übertragung und Berechnungen
- Alle Importer (RR, LA, Mika, Uits): Ergebnisse werden mit Komma angezeigt
- `bulkSubmit`: `dbRes()` vor dem API-Call
- `saveEditErgebnis`: `dbRes()` vor dem Speichern
- "Ergebnis bearbeiten"-Dialog: `fmtRes()` beim Befüllen
- `calcPace()`: `dbRes()` intern für Berechnung

---


## v601 – Kat-Gruppen: in Admin › Disziplinen integriert

- Kein eigener Sub-Tab mehr — Kategorie-Gruppen als drittes Panel im Disziplinen-Tab
- `renderAdminDisziplinen()`: lädt Einstellungen und rendert Gruppen-Panel inline
- Standalone `renderAdminKategorieGruppen()` entfernt

---


## v599 – Kategorie-Gruppen: Sprung&Wurf-Disziplinen bei Bahn/Halle

- Neue Einstellung `kategoriegruppen` (JSON) in einstellungen-Tabelle
- `bkKatMitGruppen(kat)`: gibt alle tbl_keys zurück die für eine Kat. angezeigt werden
  z.B. bahn → [bahn, sprung_wurf] wenn so konfiguriert
- `bkDiszOpts()`: zeigt Gruppen-Disziplinen mit Kategoriesuffix "(Sprung & Wurf)"
- diszObj-Suche in allen Importern berücksichtigt Gruppen-Kategorien
- `editKatChanged()` in Ergebnis-Bearbeiten-Dialog ebenfalls erweitert
- Admin-Sub-Tab "🔗 Kat.-Gruppen": Gruppen per Checkbox-Modal konfigurieren
- tbl_key der Disziplin bleibt unverändert → Bestenlisten nicht betroffen

---


## v598 – Neu: leichtathletik.de Import

- URL-Erkennung: `ergebnisse.leichtathletik.de` → Typ "leichtathletik"
- PHP-Proxy `la-fetch`: lädt HTML von ergebnisse.leichtathletik.de
- `bulkImportFromLA()` in `14_leichtathletik.js`:
  1. Resultoverview laden → Eventname, Datum, Ort + alle CurrentList-Links
  2. Jede Disziplin-Liste laden + .entryline parsen
     col-2 firstline=Name, secondline=Verein
     col-4[0] firstline=Ergebnis, col-4[last] firstline=AK
     col-1 firstline=AK-Platz
  3. Vereins-Filter, Disziplin via rrBestDisz(Listenname)
- Unterstützt: /Resultoverview/, /Competitoroverview/, /CurrentList/ URLs

---


## v598 – Neuer Import: leichtathletik.de

- `14_leichtathletik.js`: neues Modul für ergebnisse.leichtathletik.de
- PHP-Proxy `la-fetch`: HTML-Proxy nur für ergebnisse.leichtathletik.de URLs
- Ablauf: Resultoverview → alle CurrentList-Links → pro Liste .entryline parsen
- DOM-Struktur: col-2›secondline=Verein, col-2›firstline=Name,
  col-4[0]›firstline=Ergebnis, col-4[last]›firstline=AK, col-1›firstline=Rang
- Disziplin via rrBestDisz(linkText) — Links enthalten vollen Namen (z.B. "60m Männer Finale")
- AK-Fallback via calcDlvAK(Jahrgang, Geschlecht, EventJahr)
- URL-Erkennung: ergebnisse.leichtathletik.de/* → urlType "leichtathletik"
- Alle URL-Varianten akzeptiert: Resultoverview, Competitoroverview, CurrentList

---


## v597 – Fix RaceResult-Import: Key-Rotation + Contest-IDs aus Listen

- RaceResult rotiert `cfg.key` alle ~30s → "key invalid" bei Listen-Requests
  Fix: Key bei "key invalid" sofort erneuern + Retry; alle 30s proaktiv erneuern
- Neusser Erftlauf hatte keinen Contest 0 → alle Requests schlugen fehl
  Fix: Contest-ID direkt aus `cfg.lists[].Contest` nehmen (nicht cfg.contests)
- Gleiche Liste+Contest-Kombination wird nur einmal abgefragt (Deduplication)
- `_freshCfg()` Hilfsfunktion für wiederholte Config-Requests

---


## v596 – RaceResult-Import: vollständige rrFetch-Logik

- `bulkImportFromRR` nutzt jetzt denselben erprobten Parsing-Ansatz wie `rrFetch()`
- `_calibrateDF()`: DataFields-Kalibrierung für alle bekannten Feldnamen
  (AnzeigeName, VereinSchule, AGEGROUP1.NAMESHORT, MitStatus([AKPl.p]), ...)
- `r=search` zuerst, `r=all` als Fallback (Suchfunktion manchmal defekt)
- Alle Contests einzeln durchlaufen (nicht mehr alle Listen)
- Listen-Fallback: andere Kandidaten-Listen wenn Contest 0 leer
- AK aus DataFields, Gruppen-Key oder Jahrgang+Geschlecht
- AK-Platz via iAKPlatz-Index
- Disziplin via rrBestDisz(contestName, diszList)

---


## v595 – Fix RaceResult-Import: verschiedene DataFields-Varianten

- Neusser Erftlauf: DataFields nutzt "AnzeigeName", "VereinSchule", "AGEGROUP1.NAMESHORT"
  statt FIRSTNAME/LASTNAME/CLUB/AGECLASS → 0 Treffer
- _rrProcessRow: erweiterte Feldnamen-Erkennung:
  Name: ANZEIGENAME | DISPLAYNAME | FULLNAME
  Verein: CLUB | VEREIN | VEREINSCHULE | TEAM | ORGANISATION
  AK: AGECLASS | AGEGROUP* | *NAMESHORT
  Zeit: TIME | NETTO | BRUTTO | ZEIT
- Vereins-Check via Club-Feld (präziser als rowStr-Suche)

---


## v594 – Fix Import-Datum wird korrekt übernommen

- `bk-datum` hat `value=today` als Standardwert beim Rendern
- Bedingung `!datEl.value` verhinderte das Überschreiben → immer heutiges Datum
- Fix: Import-Datum überschreibt immer das vorausgefüllte heute-Datum
- `bkSyncDatum()` wird nach dem Setzen aufgerufen → Zeilendaten synchronisiert
- Gilt für RaceResult, MikaTiming und uitslagen.nl

---


## v593 – Fix "Ergebnis bearbeiten": richtige Kategorie vorausgewählt

- Kategorie wurde immer auf den aktuellen Ergebnisse-Tab (z.B. "Straße") gesetzt
- Fix: Kategorie aus `mapping_id` des Ergebnisses via `state.disziplinen` ermitteln
- Fallback: subTab wenn keine mapping_id vorhanden

---


## v592 – Fix "Ergebnis bearbeiten": AK-Validierung

- `saveEditErgebnis()`: fehlende AK-Prüfung ergänzt
- Unbekannte AKs (z.B. M51, M52) → `rrUnknownAKModal()` öffnet sich
- Aufgelöste AK wird vor dem Speichern übernommen

---


## v591 – Fix isValidDlvAK: nur echte DLV-Altersklassen

- Regex `[0-9]{2}` erlaubte beliebige Zahlen (M51, M99 waren "gültig")
- Fix: nur tatsächliche DLV-Senioren-AKs: 30|35|40|45|50|55|60|65|70|75|80|85
- Jugend unverändert: MU/WU + 12|14|16|18|20|23
- Hauptklasse M/W weiterhin gültig
- Fix in beiden Modulen: 07_eintragen.js + 08_raceresult.js

---


## v590 – Meisterschaft: AK-Platz → MS-Platz

- `importToggleMstr()`: beim Einblenden der Meisterschafts-Spalten
  wird der AK-Platz der jeweiligen Zeile in das MS-Platz-Feld kopiert
  (gilt für alle Import-Quellen: Bulk, RaceResult, MikaTiming, uitslagen)

---


## v589 – Fix Bulk-Submit: unbekannte AKs werden abgefragt

- `bulkSubmit()`: fehlende AK-Validierung ergänzt
- Unbekannte AKs (z.B. "M51") → `rrUnknownAKModal()` öffnet sich
  (identisch zum RaceResult-Import: hinzufügen oder korrigieren)
- Aufgelöste AKs werden in alle betroffenen Items übernommen
- Abbrechen im Dialog → kein Speichern

---


## v588 – Fix RaceResult-Import: Disziplin-Match robuster

- Beide Wege funktionieren jetzt:
  1. Contest-Name mit Distanz (z.B. "M50 - 3500m" → "3.500m") — Cross/NRW
  2. Listennamen direkt (z.B. "02-ERGEBNISSE|Marathon") — Straße/Bahn
  3. Sub-Key-Namen mit Distanz (z.B. "#2_400m Lauf") — Bahn
- _rrWalkData: Sub-Key als Disziplin-Quelle wenn er Meter/km enthält,
  sonst Contest-Name von oben beibehalten
- Top-Level-Dispatch: keyName || listName als Fallback-Kette

---


## v587 – Fix RaceResult-Import: Disziplin + Kategorie

- Disziplin war immer "(keine)": Listennamen enthalten keine Meter,
  aber Top-Level-Gruppen-Key enthält Contest-Name mit Distanz
  z.B. "#1_MJU18 / M50 bis 80 - 3500m" → rrBestDisz findet "3.500m"
- _rrWalkData: Top-Level-Keys als contestName übergeben
- Importkategorie wird beim Import auch in bk-kat (Tabellen-Kategorie) gesetzt

---


## v586 – Fix: Zeilennumerierung nach Import

- Leerzeile wurde entfernt (v585), aber Nummern blieben fix im HTML
- `bulkFillFromImport()`: Nummern nach dem Einfügen neu durchzählen (1, 2, 3...)

---


## v585 – Fix: leere erste Zeile beim Import

- `renderEintragen()` fügt beim Start automatisch eine leere Zeile ein
- `bulkFillFromImport()`: leere Zeilen (kein Athlet, kein Ergebnis)
  werden vor dem Befüllen entfernt

---


## v584 – Bulk-Eintragen: Textarea + AK-Feld verbessert

- Textarea "Ergebnisse einfügen": `rows=4` → `rows=10`
- AK-Feld: `<select>` → `<input type="text">` (freie Eingabe, Placeholder "z.B. M45")
- `bkUpdateAK()`: befüllt Text-Input statt Select
- Validierung beim Speichern bleibt: `isValidDlvAK()` prüft weiterhin
  ob die AK bekannt ist (rrUnknownAKModal bei unbekannten AKs)

---


## v583 – Fix RaceResult-Import: DataFields-Parser + AK-Platz

- Response-Struktur ist dreistufig: data → {Gruppe → {AK-Gruppe → [[Zeilen]]}}
- DataFields auslesen: FIRSTNAME+LASTNAME → "Nachname, Vorname"
  YEAR+SEX → AK-Berechnung via calcDlvAK() als Fallback
  MitStatus([AKPl.p]) → AK-Platz (ohne Gesamtplatz)
- AK aus Sub-Gruppen-Key: "#3_M50 - Kurze Cross" → "M50"
- _rrWalkData(): rekursiv alle Ebenen durchsuchen
- Leere erste Zeile: war ein falscher Treffer ohne Name/Zeit, jetzt gefiltert

---


## v582 – Fix RaceResult-Import: Listen direkt im Browser fetchen

- PHP-Proxy lieferte nur HTML-Metadaten, ignorierte `r=`-Parameter komplett
- Fix: Listen-Requests direkt im Browser von `RRPublish/data/list?key=...` holen
  (RaceResult erlaubt Cross-Origin, kein PHP-Proxy nötig)
- Datum/Ort weiterhin per PHP-Proxy (HTML-Parser)
- Contest-ID aus `cfg.lists[].Contest` korrekt übergeben
- `__`-Prefix-Listen (interne) werden übersprungen

---


## v581 – Fix RaceResult-Import im Bulk-Eintragen

- `bulkImportFromRR`: PHP-Proxy lieferte nur Metadaten (title/date/location),
  nie `cfg.lists` → 0 Listen, 0 Ergebnisse
- Fix: Config direkt via Browser-Fetch von `RRPublish/data/config` (wie `rrFetch()`)
- Datum + Ort werden weiterhin per PHP-Proxy befüllt
- Ergebnis-Listen per PHP-Proxy geladen (unveränderter Mechanismus)
- Blacklist für interne Listen (`__PARTICIPANTS`, `TEILNEHMER` etc.)
- Debug-Log: API-Key (gekürzt), Datum, Ort, Listen gesamt/durchsucht

---


## v580 – Build-Sicherheit: Syntax-Check + jstools.py

- `build.sh`: Pflicht-Syntax-Check vor jedem Build — bricht bei Fehler ab
  - Standalone-Module einzeln geprüft
  - Split-Module (03–09) kombiniert geprüft
  - Kein ZIP wird gebaut wenn Syntax-Fehler vorhanden
- `jstools.py`: Python-Hilfsbibliothek für sichere JS-Änderungen
  - `replace_in_file()`: str_replace mit automatischem Rollback bei Syntax-Fehler
  - `insert_before/after()`: sichere Einfüge-Operationen
  - `check_all_modules()`: vollständiger Modul-Check
  - `add_changelog()`, `set_commit_msg()`: Docs-Helfer

---


## v579 – Import-Debug erweitert (Fix weißer Bildschirm v578)

v578 hatte einen Syntax-Fehler durch `'` in Regex-Zeichenklasse sowie
fehlerhafte Klammern in neu eingefügten Template-Strings → weiße Seite.

Neuimplementierung mit zuverlässigem `str_replace`-Ansatz:
- **Header:** Version + Verein, Zeitstempel, URL, Quelle, Importkategorie
- **RaceResult:** Event-ID, Eventname, Listen-Anzahl, TuS-Einträge
- **MikaTiming:** Verein, Basis-URL, TuS-Einträge
- **uitslagen.nl:** Eventname, Datum, Ort, Gesamt, TuS-Einträge
- **Ergebnisliste** je Import: Nr. / Name / AK / Zeit / Platz / → Disziplin
- Neue Helfer: `_bkDebugInit`, `_bkDbgHeader`, `_bkDbgLine`, `_bkDbgSep`

---


## v578 – Import-Debug stark erweitert

Strukturiertes Debug-Log mit Kopieren-Button:
- **Header:** App-Version + Verein, Zeitstempel, URL, Quelle, Importkategorie
- **RaceResult:** Event-ID, Eventname, Listen-Anzahl, gefundene TuS-Einträge
- **MikaTiming:** Verein, Basis-URL, gefundene Einträge
- **uitslagen.nl:** Eventname, Datum, Ort, Gesamt-Einträge, TuS-Einträge
- **Ergebnisse-Liste:** Nr. · Name · AK · Zeit · Platz · → Disziplin
- Neue Helfer: `_bkDebugInit`, `_bkDebugHeader`, `_bkDebugLine`, `_bkDebugSep`

---


## v577 – Eintragen: „Ergebnisse einfügen" nach oben

- Import-Block (Textarea + Einlesen) steht jetzt ganz oben
- Veranstaltungsfelder (Datum, Ort, Name, Kategorie) folgen danach
- Logik: Veranstaltungsname und Ort werden meist aus dem Import befüllt

---


## v576 – Eintragen UI aufgeräumt

- **Doppeltes "Kategorie"** behoben: obere Kategorie bleibt für Disziplin-Zuordnung
  in der Bulk-Tabelle; untere heißt jetzt "Importkategorie" und erscheint nur
  wenn eine URL erkannt wurde
- **"Einlesen" + "Import starten"** zu einem Button zusammengefasst:
  URL im Textarea → Import wird gestartet; Text → Smart-Paste-Parser
- **Debug-Ausgabe** als `<details>`-Panel mit `📋 Kopieren`-Button (identisch zu RaceResult)
- `_bkDebugSet`, `_bkDebugAppend`, `_bkDebugClear` als zentrale Helfer
- `bulkEinlesen()` als neuer Einstiegspunkt für den Einlesen-Button

---


## v574 – Fix Syntax-Fehler: nackter Block in `renderEintragen`

- In v570: `if (isBulk) {` → `var content = ''; {` → nie geschlossener Block
- `Unexpected end of input` ließ gesamte Seite leer (seit v570)
- Fix: nackten Block-Öffner entfernt

---


## v573 – Docs-Pflege + Build-Script Erinnerung

- CHANGELOG.md: rückwirkend alle Versionen v533–v572 dokumentiert
- README.md: vollständig aktualisiert (Dateistruktur, Features v572, API-Endpunkte)
- build.sh: CHANGELOG-Prüfung + Erinnerung nach jedem Build

---


## v572 – Fix Syntax-Fehler in bulkImportFromMika/Uits (literal Newlines)

- JS-Strings enthielten unescapte `\n` → Syntax-Fehler → leere Seite
- Korrigiert in `bulkImportFromMika` und `bulkImportFromUits`

---

## v571 – Fix Syntax-Fehler in bulkImportFromRR

- Literal Newlines in Debug-String behoben

---

## v570 – Eintragen: SubTabs entfernt, URL-Import in Bulk integriert

- `renderEintragen`: kein SubTab-Menü mehr — alles in einem Panel
- URL-Erkennung im Smart-Paste-Feld: RaceResult / MikaTiming / uitslagen.nl
- Kategorie-Dropdown erscheint automatisch bei erkannter URL
- `bulkImportFromRR`: vollständiger RR-Parser mit Listen-Iteration, AK-Normalisierung, Disziplin-Matching
- `bulkImportFromMika`, `bulkImportFromUits`: integriert
- Debug-Fenster zeigt Event-Name, Listen-Anzahl, gefundene Einträge
- Hash-Route: nur noch `#eintragen`

---

## v569 – uitslagen.nl: `eintraege` → `items` (Bulk-Endpunkt)

- Bulk-Endpunkt erwartet `items`, Import schickte `eintraege` → keine Einträge
- Fix: korrekter Key im API-Call

---

## v568 – uitslagen.nl: Disziplin-Dropdown auf Kategorie filtern

- `uitsDiszOptHtml(disziplinen, selectedMid, filterKat)`: nur Disziplinen der gewählten Kategorie
- `uitsRenderPreview`: `_uitsKat` beim Render übergeben

---

## v567 – uitslagen.nl: Feldnamen `id`/`kategorie` statt `mapping_id`/`kategorie_name`

- `state.disziplinen` nutzt `id` (nicht `mapping_id`) und `kategorie` (nicht `kategorie_name`)
- Auto-Match fand keine Cross-Disziplinen, Dropdowns zeigten `undefined`

---

## v566 – uitslagen.nl: Kategorie-Auswahl + Disziplin-Auto-Match

- Kategorie-Dropdown (wie RaceResult/MikaTiming) vor URL-Feld
- Laden-Button erst aktiv wenn Kategorie gewählt
- `uitsAutoDiszMatchKat()`: Disziplin-Match innerhalb gewählter Kategorie
- `uitslagen` in Hash-Route-Liste

---

## v565 – uitslagen.nl: alle Kategorie-Container iterieren

- Seite hat 30 `.uitslagen`-Divs (je einer pro Kategorie)
- Parser iterierte nur ersten Container (21 statt 527 Einträge)
- Fix: `querySelectorAll('.uitslagen')` + äußeres `forEach`

---

## v564 – uitslagen.nl: Content vor innerHTML gesetzt

- `isUits`-Block setzte Content nach dem `innerHTML`-Aufruf → leere Seite

---

## v563 – uitslagen.nl Import

- Neuer Import-Tab in Eintragen (später in Bulk integriert)
- `13_uitslagen.js`: HTML-Scraper, DOM-Parsing, AK-Mapping (MSEN→M, VSEN→W, M45→M45 etc.)
- `api/index.php`: `uits-fetch` Proxy (cURL, nur uitslagen.nl-URLs)

---

## v562 – Timeline: Gesamtrekord aktualisiert `bestByG` mit

- Wenn Athlet X Gesamtrekord bricht, wurde `bestByG[g]` nicht gesetzt
- Folge: nächste Athletin bekam fälschlich "Bestleistung Frauen"
- Fix: `bestByG[g] = val` beim Gesamtrekord-Update

---

## v561 – Fix `vorher_val`: `TIME_TO_SEC('13:48,49')` → 49680s statt 828s

- MySQL `TIME_TO_SEC('13:48,49')` interpretiert als `HH:MM` (13h 48min)
- Fix: `CONCAT('00:', REPLACE(resultat, ',', '.'))` vor `TIME_TO_SEC`
- Gilt für Legacy-Tabellen (ohne `resultat_num`)

---

## v560 – Hall of Fame: "Bestleistung WHK/MHK" statt "Frauen/Männer"

- Bei `merge_ak=1` werden Jugend-AKs zu WHK/MHK zusammengefasst
- Label zeigte trotzdem "Bestleistung Frauen" weil `$g=geschlecht` unabhängig von AK
- API: `$ak === 'WHK'` → Label "Bestleistung WHK"
- Dashboard HoF: tatsächlichen Label-Text verwenden statt hartkodiert

---

## v559 – Rekorde `by_ak`: `e.disziplin=?` → `$diszCond`

- `by_ak`-Query filterte per Name statt per `mapping_id` → Kategorien gemischt
- Fix: `$diszCond` + `$diszParam` konsistent wie `gesamt`/`maenner`/`frauen`

---

## v558 – Rekorde: `mapping_id` Fallback aus `(kat, disz)` nachschlagen

- Wenn keine `mapping_id` übergeben → automatisch aus `(kat, disz)` ermitteln
- Verhindert Mischung bei gleichnamigen Disziplinen ohne Frontend-Fix

---

## v557 – Disziplin `mapping_id` durchgängig verwenden

- Rekorde API-Call schickt `mapping_id` mit
- `navigateToDisz(disz, mappingId)`: zweites Argument
- Dashboard-Links: `data-rek-mid` Attribut
- Auto-Migration: nur bei eindeutigen Disziplin-Namen (1 Mapping)

---

## v556 – RaceResult Import: `normalizeAK()` im Import-Loop

- `normalizeAK()` nur beim Anzeigen aufgerufen, nicht beim Import
- „Seniorinnen W40" kam roh in `isValidDlvAK()` → unbekannte AK Dialog

---

## v555 – `normalizeAK`: Regex-Korruption behoben

- Python `\b` als Backspace-Byte (0x08) in JS-Datei geschrieben → Regex kaputt
- Neuschreiben mit `(?:^|\s)..(?:\s|$)` statt `\b`

---

## v554 – RaceResult: AK-Normalisierung (`normalizeAK`)

- Neue Funktion extrahiert DLV-Kürzel aus RaceResult-Labels
- "Seniorinnen W40" → "W40", "Senioren M50" → "M50", "Männliche Jugend U16" → "MU16"

---

## v553 – RaceResult: Disziplin-Match "3000m" ↔ "3.000m" repariert

- Regex `\b` matcht nicht vor `m` → `3.000m` wurde nicht zu `3000m` normalisiert
- Fix: `\b` → `(?!\d)` in `qNorm` und `diszToMeters`

---

## v552 – Fix Disziplin-Mapping: UNIQUE auf `(disziplin, kategorie_id)`

- UNIQUE KEY war `(disziplin)` → gleicher Name in verschiedenen Kategorien überschrieb sich
- `ON DUPLICATE KEY UPDATE` entfernt
- Neue Disziplin hängt keine bestehenden Ergebnisse um
- Datenbankkorrektur: `UPDATE ergebnisse SET disziplin_mapping_id=67 WHERE disziplin_mapping_id=138`

---

## v551 – Fix Hash-Routing: `restoreFromHash()` vor `buildNav()`

- `buildNav()` rendert aktiven Tab-Highlight → muss nach `restoreFromHash()` kommen

---

## v550 – Vollständiges Hash-Routing

- URL-Schema: `#dashboard`, `#ergebnisse/sprint`, `#admin/disziplinen`, `#eintragen`
- `syncHash()`, `restoreFromHash()`, `popstate` für Back/Forward
- `navAdmin()` ersetzt inline `state.adminTab`

---

## v549 – URL-Hash Navigation (Basis)

- Tab-Wechsel: `history.replaceState` → F5 stellt aktiven Tab wieder her

---

## v548 – Fix Syntax-Fehler in `showTotpSetupInProfile`

- Unescapte einfache Anführungszeichen in `onkeydown`

---

## v547 – TOTP-Setup im Profil: eigenes Modal

- `showTotpSetupInProfile` öffnet Modal statt Login-Screen zu überschreiben

---

## v546 – Passkey-Löschen: zwei Bugs gefixt

- `apiDelete()` → `apiDel()` (Funktion existiert nicht)
- `$path[2]` → `$parts[2]` (war Zeichen-Index statt Pfad-Segment)

---

## v545 – Passkey: COSE-Key Binary-Bytes korrekt in JSON speichern

- `json_encode()` gab `null` für rohe Byte-Strings → kaputte DB-Einträge
- Byte-Strings werden base64-kodiert (`__b64__` Marker), beim Lesen wiederhergestellt
- Kaputte Passkeys werden automatisch gelöscht

---

## v544–v543 – Passkey: CBOR-Decoder Fixes

- CBOR Map-Keys als Strings speichern (negative Integers: `-2` → `"-2"`)
- Major Type 6 (Tag) ignorieren, Major Type 7 korrekt

---

## v542 – Fix Login-Response: `has_totp` + `has_passkey` weitergegeben

- `api/index.php`: `jsonOk()` enthielt nur `totp_required/totp_setup`
- `has_totp` und `has_passkey` aus `loginStep1` wurden ignoriert

---

## v541 – passkey.php: PHP 7.x Kompatibilität

- Arrow Functions `fn()` → klassische `function($r) { return ...; }`

---

## v533–v540 – Passkey / WebAuthn 2FA

- `includes/passkey.php`: vollständiger WebAuthn-Stack ohne externe Libraries
- ES256 (ECDSA P-256) + RS256 (RSASSA-PKCS1-v1_5), CBOR-Decoder, DER-Encoding
- Login-Flow: Passwort → `show2FAChoice()` → TOTP oder Passkey
- Profil: Passkey-Verwaltung (hinzufügen/löschen) für alle User
- 2FA für alle User, nicht nur Admins

---



## v504 – RaceResult: String-Array-Listen + Siegerliste-Blacklist

- `cfg.lists` als String-Array wird korrekt ausgewertet (war bisher nicht implementiert)
- Blacklist erweitert um: `SIEGER`, `WINNER`, `PARTICIPANTS`, `STATISTIC`
- Prio-Suche wählt `Zieleinlaufliste netto` statt `Siegerliste`
- Rückwärtskompatibel: Events mit Array-of-Objects oder Object-Listen unverändert

---

## v503 – RaceResult Build (v501-Inhalte)

---

## v502 – Timeline: „Vorname Nachname · Disziplin"

- Name in Vorname-Nachname-Reihenfolge (war Nachname, Vorname)
- Name und Disziplin in einer Zeile mit `·` als Trennpunkt
- Gilt für Haupt-Timeline und gefilterte Timeline

---

## v501 – Build (v499-Inhalte)

---

## v500 – Veranstaltungsanzeige: live aus DB

- API ergebnisse: `v.ort AS veranstaltung_ort` + `v.name AS veranstaltung_name` im SELECT
- `fmtVeranstName()` nutzt aktuellen Ort/Name aus DB statt Snapshot-`kuerzel`
- Admin → Darstellung: Einstellung „Veranstaltungsanzeige" (Ort / Name) war bereits vorhanden

---

## v499 – Build (s.o.)

---

## v498 – Fix Veranstaltungen: colspan 6→7

- Disziplin-Trennbalken hat `colspan="7"` (war 6)

---

## v497 – Fix Veranstaltungen-Spaltenheader + API ak_platz_meisterschaft

- API: unified-Tabelle gibt `e.ak_platz_meisterschaft` zurück (war `NULL`)
- Veranstaltungen-Header: „Platz AK"→„Pl. AK", „Platz MS"→„Pl. MS"
- CSS: `white-space:nowrap` für th der veranst-dash-table

---

## v496 – Fix Veranstaltungen-Tabelle: vcol-ms-platz

- `col style="width:70px"` → `col class="vcol-ms-platz"` mit CSS-Klasse
- Breiten neu verteilt für 7 Spalten (28+8+14+12+12+15+11=100%)
- Mobile: 7. Spalte ebenfalls ausgeblendet

---

## v495 – Meisterschafts-Platzierung in Veranstaltungen + Ergebnisse

- Veranstaltungen + Ergebnisse: neue Spalte „Pl. MS"
- Ergebnis bearbeiten: Feld „Platz MS" im Dialog
- API: `ak_platz_meisterschaft` in allen SELECT-Queries + PUT-Handler

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

