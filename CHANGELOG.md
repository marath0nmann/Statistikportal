## v1529
- **Beide Scanner melden jetzt laufend ihren Fortschritt.** Bisher wurde erst am Ende eines Laufs etwas geschrieben (`rr_scan_letzter_lauf`/`-status`) – während der minutenlangen Laufzeit war nirgends zu sehen, wo der Scanner steht, und ein abgebrochener Lauf hinterließ überhaupt keine Spur. `Scanner::fortschritt()` schreibt jetzt nach jedem Wettkampf bzw. Suchbegriff Phase, Position, aktuellen Wettkampf und Fundzahl in die Einstellungen; ein UPDATE gegenüber ~11 s Netzwerkarbeit je Wettkampf.
- Das Admin-Panel zeigt daraus einen Fortschrittsbalken samt aktuellem Wettkampf – auch für Läufe, die der Cronjob angestoßen hat. Meldet sich ein Lauf über drei Minuten nicht, weist das Panel ihn als vermutlich abgebrochen aus (`Scanner::fortschrittLesen()`).
- **„Jetzt scannen" blockiert nicht mehr.** Der Knopf wartete bisher die volle Laufzeit auf die Antwort (bis zu 120 s ohne jede Rückmeldung). Er startet den Lauf jetzt und pollt den Fortschritt alle 3 s; beim Verlassen des Panels endet das Pollen, der Lauf serverseitig nicht. Der Admin-Lauf darf dadurch 240 s statt 120 s nutzen.
- Dafür geben beide Scan-Routen die Session frei (`session_write_close()`), sobald die Rechte geprüft sind – sonst hätte die gehaltene Session-Sperre jede Fortschrittsabfrage derselben Sitzung bis zum Ende des Laufs blockiert.
- **Suchbegriffe werden für die Abfrage reduziert.** Jeder Begriff kostet pro Wettkampf und Liste einen eigenen Abruf; da beide Dienste als Teilstring suchen, ist ein Begriff überflüssig, sobald ein kürzerer in ihm steckt („Oedt" deckt „TuS Oedt" ab). `Scanner::sucheBegriffe()` fragt deshalb nur noch den jeweils kürzesten ab – nachkontrolliert wird weiterhin gegen die vollständige Liste, damit kein fremder Verein mit ähnlichem Namen durchrutscht.
- Greift die Reduktion nicht, weil die Begriffe einander nicht enthalten („TuS Oedt" + „TuS 1911 Oedt"), schlägt das Panel das längste gemeinsame Wort vor („Oedt") und beziffert die Ersparnis. `Scanner::begriffVorschlag()`, ab 4 Zeichen.
- Der Fortschritt wird nicht über die öffentliche Einstellungsroute ausgeliefert (`Settings::GEHEIM`) – er enthält Wettkampfnamen.

## v1528
- Doku: Beide Scanner-Panels liegen unter **Admin → ⚙️ Einstellungen** (`renderAdminDarstellung()`), nicht unter Admin → System. Die Angabe „Admin → System" stand seit v1466 falsch im Changelog und war in v1527 übernommen worden; `CLAUDE.md` nennt den Ort jetzt ausdrücklich.

## v1527
- **uitslagen.nl-Scanner** (neu): Meldet Starts unseres Vereins bei niederländischen Wettkämpfen auf der Eintragen-Seite – analog zum RaceResult-Scanner, aber ohne Wettkampf-Discovery. uitslagen.nl hat eine seitenweite Volltextsuche über alle veröffentlichten Ergebnisse (`GET /results.php?naam=…&gbjr=&exct=&next=` → `{html, next}`), die Name, Woonplaats **und** Vereniging durchsucht. Ein einziger Abruf je Suchbegriff liefert damit alle Treffer, nach Wettkampf gruppiert und absteigend nach Datum; ein Wettkampfkalender und eine Warteschlange je Wettkampf werden nicht gebraucht.
- Neue Bibliothek `includes/uitslagen.php` mit Tabelle `uits_funde` (Wettkampfdaten stehen am Fund, dedupliziert über `fund_key`). Das Wettkampfdatum kommt aus den ersten acht Stellen der Wettkampf-ID (`2025110916317` → 09.11.2025), Rückfall ist die niederländische Langform („Zondag 9 november 2025").
- Rückblick-Fenster (Default 30 Tage): Die Suche liefert die gesamte Historie bis 2003 zurück – ohne Fenster würde der erste Lauf jahrealte Ergebnisse melden. Da die Treffer absteigend nach Datum kommen, endet das Blättern beim ersten zu alten Wettkampf.
- Wie bei RaceResult trifft die Suche auch Namen und Wohnorte („Oedt" ist auch ein Ort) – gemeldet werden deshalb nur Zeilen, deren Feld Woonplaats/Vereniging wirklich einen der Suchbegriffe enthält.
- Neue Endpunkte: `GET uits-scan?token=…` (Cronjob; Token nur über `uits-scan-status` einsehbar, nie über die öffentliche Einstellungsroute), `GET uits-scan-status` (Admin), `GET uits-funde`, `POST uits-funde` (erledigt/ignoriert).
- Eintragen-Seite: neues Panel „🔎 Neue Ergebnisse bei uitslagen.nl"; „📥 Ergebnisse importieren" belegt Veranstaltung/Datum/Ort vor und startet den bestehenden uitslagen.nl-Importer. Admin → Einstellungen: Panel „uitslagen.nl-Scanner" mit An/Aus, Suchbegriffen, Rückblick-Fenster, Cron-URL, Statistik und „Jetzt scannen" – direkt unter dem RaceResult-Panel. Das Nav-Badge zählt jetzt offene Wettkämpfe + RaceResult-Funde + uitslagen.nl-Funde (`_eintragenBadgeSumme()`).
- Die Suchbegriffe fallen auf die des RaceResult-Scanners zurück, sodass nur an einer Stelle gepflegt werden muss.
- Gemeinsame Teile beider Scanner zusammengeführt: `includes/scanner.php` (`Scanner::gruppiere()`) übernimmt Athletenzuordnung, Abgleich gegen bereits erfasste Ergebnisse und Gruppierung nach Wettkampf – rund 60 Zeilen, die sonst in `rr-funde` und `uits-funde` doppelt lägen. Im Frontend rendert `_bkFundePanelHtml()` beide Panels; die Fund-Kacheln zeigen dadurch auch bei RaceResult zusätzlich die Altersklasse.

## v1526
- Teilen: „Bestleistung M60" heißt jetzt in allen drei Formaten „Vereins-Bestleistung M60" – macht deutlich, dass es die vereinsinterne Altersklassen-Bestzeit ist und kein Wettkampftitel
- WhatsApp: Leerzeile vor dem Link zur Vereinsbestenliste, damit er sich vom Ergebnisblock absetzt

## v1525
- WhatsApp-Teilen: Zählt eine ganze Disziplin zu einer Meisterschaft, steht diese jetzt in der Überschrift („*Nordrhein-Meisterschaften 5km*"); in den Zeilen genügt dann die Kurzform „Nordrhein – 2. Platz" statt der vollen Wiederholung
- WhatsApp-Teilen: Bei Vereins- oder Altersklassen-Bestleistungen wird die passende Bestenliste je Disziplin verlinkt (`📈 Vereinsbestenliste 5km: …#rekorde/strasse/5km`)

## v1524
- Rekorde-Deep-Link nutzt jetzt den Disziplinnamen statt der internen ID: `#rekorde/strasse/5km` statt `#rekorde/strasse/12`. Neue Helfer `diszSlug()` (Umlaute, Tausendertrennpunkt, Sonderzeichen) und `diszBySlug()`; die Kategorie im Pfad trennt gleichnamige Disziplinen (`#rekorde/bahn/800m` vs. `#rekorde/strasse/800m`). Alte Links mit numerischer ID funktionieren weiterhin.

## v1523
- Rekorde: Deep-Link `#rekorde/<kategorie>/<mapping_id>` führt jetzt direkt zur Bestenliste einer Disziplin. Bisher setzte der Hash nur `state.subTab`, das die Rekorde-Seite gar nicht auswertet – ein Link auf eine bestimmte Disziplin war nicht möglich.
- Teilen: Meisterschaften werden ausgeschrieben („Nordrhein" + Disziplin → „Nordrhein-Meisterschaften 5km – 1. Platz") statt nur mit dem Kürzel
- Claude-Prompt: Meisterschaften sollen eine eigene Zwischenüberschrift bekommen und den übrigen Ergebnissen vorangestellt werden; Legende erklärt „Bestleistung M60" ausdrücklich als vereinsinterne Altersklassen-Bestzeit und verlinkt die passende Bestenliste per Deep-Link

## v1522
- Fix Teilen: Meisterschaftswertungen fehlten in den Ausgaben. WordPress- und WhatsApp-Format haben `meisterschaft` gar nicht ausgewertet, der Claude-Prompt zeigte nur ein generisches „Meisterschaft" statt des Namens. Alle drei nutzen jetzt die gemeinsame Funktion `_shareAllBadges()`, die Bestleistungen und Meisterschaftswertung zusammenführt und den echten Namen samt Meisterschaftsplatz ausgibt (z. B. „Nordrhein-Meisterschaft (2. Platz)")
- Claude-Prompt: Anweisung ergänzt, Meisterschaften im Fließtext eigens hervorzuheben und den Meisterschaftsplatz höher zu gewichten als den AK-Platz im Gesamtfeld; Legende erklärt die Klammer-Angabe

## v1521
- Nav-Leiste kompakter: `letter-spacing` der Tab-Beschriftungen von 1px auf 0.4px, horizontales Padding von 16px auf 11px reduziert. Rein typografisch – gleiche Tabs, gleiche Optik, rund 15 % weniger Breitenbedarf, damit die volle Navigation auf schmaleren Desktop-Fenstern ohne Horizontal-Scroll passt

## v1513
- **Filterleiste: Spalten mit Mehrfachzuordnung.** Gibt eine Spalte ein Array zurück, zählt jeder Eintrag einzeln in der Auswahlliste und die Zeile passt, sobald einer davon zutrifft. Konkret der Gruppen-Filter der Athleten-Tabelle: Athlet\*innen in mehreren Gruppen erschienen bisher unter der zusammengesetzten Bezeichnung („Senioren, Masters") statt unter jeder Gruppe einzeln.

## v1520
- RaceResult-Event-ID wird jetzt auch aus Anmelde-Links erkannt (`RRRegStart(...)`-Widget, z.B. `cologne-timing.de/anmeldung/eschweiler-1`), nicht nur aus Ergebnis-Seiten (`RRPublish(...)`). Registrierung und Ergebnisse teilen dieselbe Event-ID – verifiziert an Event 402257 (Eschweiler Citylauf)

## v1519
- Fix RaceResult: AK-Platz-Felder mit regionalem/Meisterschafts-Präfix (z.B. `AKLVNPlp` bei Landesverbands-Meisterschaften) wurden fälschlich als Gesamt-Platz erkannt, da „akpl" dort kein zusammenhängendes Substring ist. Neue Erkennung via Platzhalter-Präfix `[ak`, in allen 5 Kalibrierungs-Blöcken. Behebt falsche Platzierungen (Gesamt- statt AK-Platz) bei Events mit Landesverbands-Meisterschaftswertung
- Fix: `isAkList`-Listenname-Erkennung erkennt jetzt „AK" auch als eigenständiges, leerzeichengetrenntes Wort (z.B. „Ergebnisliste AK LVN"), nicht nur mit Unterstrich
- Neu: RaceResult-Contests/Listen mit „LVN" (Landesverband Nordrhein) oder „Meisterschaft" im Namen werden automatisch als Meisterschafts-Wertung erkannt und ins Meisterschafts-Feld übernommen (Label + Platz), mit Fallback auf den rohen Contest-Namen falls keine passende Meisterschaft konfiguriert ist – nutzt die bereits vorhandene Zuordnungs-Logik (`_bkMstrIdFromLabel`)

## v1518
- Debug: `rr-fetch?proxy_url=` liefert bei „keine Event-ID gefunden" jetzt HTTP-Status, Antwortlänge und einen Seitenausschnitt zurück – sichtbar im Debug-Log. Diagnose für Fälle, in denen die Ziel-Domain den Hosting-Server blockiert (Bot-Schutz/WAF), obwohl die Seite von außen normal erreichbar ist (z.B. cologne-timing.de)

## v1517
- RaceResult White-Label-Erkennung erweitert: Domains ohne `/{id}/results`-Pfad oder `#N_HEX`-Hash in der URL (z.B. `cologne-timing.de/ergebnisse/eschweiler-2026`) werden jetzt per Namens-Heuristik ("ergebnis"/"result"/"timing" in der URL) erkannt und serverseitig auf RRPublish geprüft. Verifiziert: Eschweiler Citylauf (Event 402257)

## v1516
- Meine Ergebnisse: Auch die Kachelmaße der Bestzeiten-Buttons sind wieder wie vor v1513 (`min-width: 80px`, `padding: 8px 14px`). Damit entspricht die Kachel selbst wieder der Vorversion; übernommen aus dem Dashboard bleiben die Gruppierung nach Kategorie und die farbige Bestzeit.

## v1515
- Meine Ergebnisse: Die Bestzeiten-Kacheln haben wieder die Schriftgrößen der Vorversion – Disziplinname aus der Klasse `.rek-top-name` statt fest 12px, Bestzeit 13px statt 14px. Gruppierung nach Kategorie und die farbige Bestzeit aus v1513 bleiben.

## v1514
- **Regelmäßige Veranstaltungen: Der Veranstaltungsort lässt sich jetzt fest hinterlegen.** Im Bearbeiten-Dialog wird ein Ort aus der Ortsverwaltung (Admin → Orte) ausgewählt; bleibt das Feld leer, gilt wie bisher der Ort der letzten Austragung.
- Optional lässt sich zusätzlich der genaue Punkt auf der Karte setzen (Klick oder Marker ziehen, alternativ Koordinaten eintippen). Ohne eigene Koordinaten werden die des gewählten Ortes verwendet.
- Der festgelegte Ort erscheint in der Serien-Tabelle, in der Filterleiste (Ort/Land) und auf der Detailseite samt Karte.

## v1513
- **Meine Ergebnisse: Die Bestzeiten-Kacheln übernehmen die Optik des Dashboard-Widgets „Persönliche Bestleistungen".** Sie sind jetzt nach Kategorie gruppiert – je Gruppe eine kleine Überschrift („STRASSE", „BAHN") – und die Bestzeit ist farbig hervorgehoben: Vereinsergebnisse in der Hauptfarbe, extern erzielte Bestleistungen neutral.
- Die Kategorien erscheinen in der Reihenfolge der Disziplinverwaltung (`disziplin_kategorien.reihenfolge`) statt alphabetisch – dieselbe Sortierung wie im Dashboard. Das gilt auch für die Kategorie-Chips darüber.
- Die Kacheln bleiben Filter: Klick filtert die Liste auf die Disziplin, die Trefferzahl steht weiterhin hinter dem Namen.

## v1512
- **Veranstaltungen → Regelmäßige Veranstaltungen** hat jetzt ebenfalls die dynamische Filterleiste: Suche über Name, Kürzel und Ort, dazu Filter nach Ort, Land, Monat und Jahr der letzten Austragung, erster Austragung, Anzahl Austragungen sowie Status (laufend/ruht).
- **Strg+F (bzw. ⌘F) springt jetzt direkt ins Suchfeld der Seite** statt die Browsersuche zu öffnen – die findet bei seitenweise geladenen Tabellen ohnehin nur, was gerade sichtbar ist. Das Kürzel steht als Hinweis an der Beschriftung. Gibt es auf der Seite kein Suchfeld, bleibt die Browsersuche wie gewohnt; bei geöffnetem Dialog zählt dessen eigenes Suchfeld.
- Fix: Das Sortieren der Serien-Tabelle per Klick auf die Spaltenköpfe hatte ins Leere gegriffen (der angesprochene Container existierte nicht mehr) und funktioniert wieder.
- Fix: Nach dem Umbenennen einer regelmäßigen Veranstaltung wurde die veraltete Kachel-Ansicht ohne Unter-Tabs gerendert; jetzt wird die reguläre Seite neu geladen. Die tote Kachel-Ansicht ist entfallen.

## v1511
- Dokumentation: `CLAUDE.md` beschreibt das gemeinsame Filtermodul und die API-Seite (`f[spalte]=wert`, `facetten=…`).

## v1510
- **„Meine Ergebnisse" nutzt jetzt selbst das gemeinsame Filtermodul.** Die Filterleiste dieser Seite war die Vorlage für alle anderen; ihre Logik lag bisher doppelt vor. Verhalten und Bedienung bleiben unverändert (inklusive Kategorie-Chips und Disziplin-Kacheln als Filter), es entfallen rund 90 Zeilen doppelter Code.

## v1509
- **Veranstaltungsliste mit dynamischer Filterleiste.** Neben der Suche (Name, Kürzel, Ort) lässt sich jetzt nach Jahr, Monat, Ort, Land und regelmäßiger Veranstaltung filtern – jeder Wert mit Trefferzahl. Die Auswahllisten liefert die API mit, da die Liste serverseitig gefiltert und seitenweise geladen wird.

## v1508
- **Ergebnisse-Seite mit dynamischer Filterleiste.** Die festen Dropdowns Kategorie/Disziplin/Altersklasse/Jahr sind durch frei kombinierbare Filterregeln ersetzt: filterbar sind Jahr, Monat, Kategorie, Disziplin, Altersklasse, Athlet*in, Ort, Veranstaltung, Platz AK, Meisterschaft und Verein.
- Da die Ergebnisse serverseitig gefiltert und seitenweise geladen werden, liefert die API die Auswahllisten mit (`facetten=…`) – jeder Wert mit Trefferzahl, berechnet nur für die gerade geöffneten Filterzeilen. Die Meisterschafts-Checkboxen und die Umschaltung „Externe Ergebnisse" bleiben unverändert.

## v1507
- **Athleten-Tabelle mit dynamischer Filterleiste.** Zusätzlich zur Suche (Nachname, Vorname, Gruppe) lässt sich nach Geschlecht, Jahrgang, Altersklasse, Gruppe und – mit entsprechendem Recht – nach Status, Ergebnissen und letzter Aktivität filtern.
- Die Suche läuft jetzt clientseitig auf der vollständigen Athletenliste statt über die API. Dadurch reagiert sie ohne Verzögerung und die Filter-Auswahllisten zeigen korrekte Trefferzahlen.

## v1506
- **Admin → Veranstaltungen nutzt die dynamische Filterleiste.** Statt der festen Dropdowns „Jahr" und „Status" lässt sich jetzt nach Jahr, Monat, Ort, Serie, Status sowie Vorhandensein interner/externer Ergebnisse filtern – jeder Wert mit Trefferzahl. Die Suche (Name, Kürzel, Ort) beherrscht weiterhin die Platzhalter `*` und `?`.

## v1505
- **Die dynamische Filterleiste aus „Meine Ergebnisse" ist jetzt ein wiederverwendbares Modul** (`js/09b_tabellenfilter.js`): Suchfeld plus beliebig viele Filterregeln „Spalte + Wert", deren Auswahllisten nur noch erreichbare Werte samt Trefferzahl zeigen.
- Admin → Orte nutzt die neue Leiste: zusätzlich zur Suche (Name, Region, Land, Alias) lässt sich nach Land, Region, Koordinaten, Aliasen und Verwendung filtern.

## v1504
- Meine Ergebnisse: Die grüne „PB"-Pille steht jetzt links vom Ergebnis statt rechts. Da die Spalte rechtsbündig ist, bleiben die Ergebniszahlen dadurch sauber untereinander.

## v1503
- **Meine Ergebnisse: persönliche Bestleistungen sind jetzt markiert** – für die favorisierten Disziplinen (Admin → Disziplinen, Sternchen). Jedes Ergebnis, das zum Zeitpunkt des Wettkampfs eine Verbesserung war, trägt hinter dem Ergebnis eine grüne „PB"-Pille; das erste Ergebnis einer Disziplin zählt als Debüt-PB.
- Die aktuell gültige Bestleistung jeder Disziplin ist zusätzlich als grün hinterlegte Zeile hervorgehoben (auch im Dunkelmodus und beim Überfahren mit der Maus).
- Gezählt wird je Disziplin-Zuordnung, ersatzweise Kategorie + Disziplinname – anders als bei „#km" gibt es hier keine reine Kategoriezählung, da die Strecken einer Kategorie nicht vergleichbar sind. Bei Weiten und Höhen gilt der größere Wert als besser, bei Zeiten der kleinere; ein exakt gleiches Ergebnis ist keine neue PB.

## v1502
- **Fix: In Modal-Formularen saß die rechte Spalte 12px tiefer als die linke.** Ursache war die Regel `.modal .form-group + .form-group { margin-top: 12px }`, gedacht für untereinander gestapelte Felder (Passwort-Wiederholung). Im zweispaltigen `.form-grid` trifft sie jedoch jede Gruppe außer der ersten – also auch die rechte Spalte, die dadurch nach unten rutschte und die Zeile aufblähte. Im Raster ist der Abstand jetzt zurückgenommen, dort regelt ihn `gap`.
- Das betraf nicht nur „Ergebnis bearbeiten", sondern jedes Modal mit `form-grid` – etwa das Modal für externe Ergebnisse und die Admin-Dialoge.

## v1501
- **Ergebnis bearbeiten: Formular neu gegliedert.** Statt einer durchlaufenden Feldliste gibt es jetzt die Abschnitte „Disziplin" (Kategorie, Disziplin), „Ergebnis" (Ergebnis, Altersklasse, Startnummer), „Platzierungen" (Pos AK / m,w / gesamt), „Meisterschaft" (Meisterschaft, Pos) und „Sonstiges" (Verein, Schuh, Bemerkungen). Die Reihenfolge entspricht der Tabelle, das Modal ist dafür breiter.
- **Der Verein ist jetzt änderbar** – als Textfeld mit den bereits verwendeten Vereinen zur Auswahl (eigener Verein zuerst). Ein Hinweis unter dem Feld erklärt die Bedeutung: eigener Vereinsname = für den eigenen Verein gestartet, leer = ohne Vereinsbindung.
- Serverseitig wird das Flag `extern` beim Speichern aus dem Vereinsnamen abgeleitet – dieselbe Regel wie beim Anlegen. Ohne das entstünden widersprüchliche Datensätze (Vereinsname gesetzt, aber `extern=0`), die in der Vereinsspalte falsch dargestellt würden.

## v1500
- **Meine Ergebnisse: dynamische Filter statt fester Dropdowns.** Die drei Auswahlfelder Jahr/Disziplin/Verein sind ersetzt durch beliebig viele Filterregeln „Spalte + Wert". Über das Feld „Weiterer Filter" kommt eine Regel dazu, das ✕ entfernt sie wieder; mehrere Regeln wirken zusammen (UND). Das Suchfeld bleibt daneben bestehen.
- Filterbar sind alle Spalten – Datum, Veranstaltung, Ort, Kategorie, Disziplin, StNr, AK, alle Platzierungen, Meisterschaft, Ergebnis, Pace, Schuh, Verein und Bemerkungen – dazu „Jahr", das keine eigene Spalte ist. Die Meisterschaft wird mit ihrem Namen statt der internen ID angeboten, der Verein nach derselben Regel wie in der Tabelle (`extern`-Flag).
- Die Werteliste zeigt nur Werte, die mit den übrigen Filtern noch erreichbar sind, jeweils mit Trefferzahl – Filterkombinationen mit null Ergebnissen lassen sich so gar nicht erst zusammenklicken. Jede Spalte kann nur einmal gefiltert werden; nach der Spaltenwahl springt der Fokus direkt in die Wertauswahl.
- Die Kategorie-Chips und Disziplin-Kacheln im Kopf schreiben in dieselben Regeln und erscheinen dadurch auch in der Filterleiste.

## v1499
- **Die getrennten Kategorietabellen sind aus der API entfernt.** `ergebnisse_strasse`, `ergebnisse_sprint`, `ergebnisse_mittelstrecke` und `ergebnisse_sprungwurf` wurden seit der Zusammenführung in `ergebnisse` nur noch in toten `else`-Zweigen angesprochen: 46 `$unified`-Verzweigungen, 33 Zeilen mit Legacy-Tabellennamen. Sie waren zudem nicht mehr gepflegt – die alten INSERT-Zweige kannten `startnummer`, `pos_gesamt`, `pos_geschlecht`, `schuh` und `bemerkungen` gar nicht und hätten diese Daten verworfen.
- An ihre Stelle tritt die Hilfsfunktion `ergTbl()`. Sie berücksichtigt anders als die frühere Erkennung den `TABLE_PREFIX`; bisher wurde `table_name='ergebnisse'` ohne Präfix geprüft, wodurch eine Installation mit Präfix stillschweigend in den Legacy-Pfad gefallen wäre.
- Fehlt die Tabelle `ergebnisse`, meldet die API das jetzt beim Start klar und verständlich, statt in Folgefehlern einzelner Endpunkte zu enden.
- Der Umbau selbst ist bereits mit v1497 ausgeliefert worden (siehe Hinweis dort); dieser Eintrag dokumentiert ihn nach.

## v1498
- **Fix: „Call to undefined function eigenerAthletId()" beim Speichern im Bearbeiten-Modal.** Die Hilfsfunktion war innerhalb des globalen Routing-`try`-Blocks definiert (Zeile ~7085) und damit erst ab dieser Stelle im Skriptablauf bekannt. Der Ergebnis-PUT-Handler (Zeile ~2920) läuft aber deutlich früher und beendet die Anfrage vorher – die Funktion existierte dort nie. Sie steht jetzt bei den globalen Helferfunktionen ganz oben (echte Top-Level-Deklaration, wird beim Kompilieren registriert). Bearbeiten von Ergebnissen funktioniert wieder.

## v1497
- **Ergebnisse-Filter: Das Feld „Athlet" ist jetzt ein multifunktionales Suchfeld.** Gesucht wird gleichzeitig über Athletenname, Veranstaltungsname und -kürzel, Ort (inkl. normalisiertem Ortsnamen aus der Orte-Verwaltung) und Disziplin – z.B. findet „Venlo" alle Ergebnisse dieser Veranstaltung. Gilt für die Ergebnisse-Seite und Admin → Ergebnisse, inklusive der externen Ergebnisse (Filter „Mit externen" / „Nur externe").
- Die Filter-Dropdowns (Disziplin, AK, Jahr) und die Trefferzahl berücksichtigen die Suche weiterhin korrekt (Orte-Join in Zähl- und Dropdown-Abfragen ergänzt).

## v1496
- Fix Bulk-Import: Disziplin-Erkennung (RaceResult, MikaTiming) filterte die Vergleichsliste bisher nicht nach Importkategorie – eine gleichlautende Disziplin aus einer anderen Kategorie (z.B. „6,6km" unter Straße) konnte fälschlich als Treffer geloggt werden, obwohl die Zielkategorie (z.B. Cross) eine andere Benennung nutzt (`X.XXXm`). `findDiszObj` filterte danach korrekt nach Kategorie und lehnte den Treffer ab → leeres Disziplin-Feld trotz „erkannt" im Log. `diszList` wird jetzt konsistent auf die Importkategorie (+ Gruppen-Partner) eingeschränkt, wie schon bei der Dropdown-Befüllung.

## v1495
- Fix Bulk-Import: unbekannte Disziplinen (existieren noch nicht im System, z.B. „6,6km" bei Cross) erschienen bisher stillschweigend als leeres Feld – ohne Hinweis, dass etwas fehlt. Das „Neu anlegen…"-Banner (bereits für Seltec/PDF-Import vorhanden) wird jetzt auch nach RaceResult-, MikaTiming- und evenementen.uitslagen.nl-Import angezeigt; ein Klick legt die fehlende Disziplin an und füllt alle passenden Zeilen automatisch nach.
- Zusätzlich: das Disziplin-Suchfeld zeigt den erkannten Rohtext an (statt leer zu bleiben), auch wenn noch keine System-Disziplin zugeordnet ist – macht sichtbar, was der Import erkannt hat.

## v1494
- **Bearbeiten-Modal: Die Disziplinkategorie ist jetzt änderbar.** Neues Auswahlfeld „Kategorie"; die Disziplin-Auswahl zeigt nur noch die Disziplinen der gewählten Kategorie und wird beim Wechsel neu aufgebaut. Gespeichert wird die `disziplin_mapping_id`, wodurch die neue Kategorie eindeutig ankommt. Eine Disziplin ohne Mapping bleibt als Eintrag „(ohne Zuordnung)" erhalten und geht nicht verloren.
- Serverseitig wandert beim Disziplinwechsel die gespeicherte `distanz` mit (aus dem Disziplin-Mapping) – sonst hätte die Pace weiter mit der alten Strecke gerechnet.
- Schuh bleibt ein Textfeld, schlägt aber die bereits verwendeten Schuhmodelle als Auswahl vor (`datalist`, dedupliziert und alphabetisch).
- **Fix: Anführungszeichen in Freitexten wurden als `&quot;` angezeigt.** `sanitize()` speichert `"` serverseitig als `&quot;`; die Tabelle escapte das erneut zu `&amp;quot;`. Bemerkungen, Schuh, Verein, Kategorie, Startnummer und die Tooltips werden jetzt vor der Ausgabe dekodiert und dann sauber escapt – ebenso die Felder im Bearbeiten-Modal.

## v1493
- **Bearbeiten und Löschen folgen jetzt derselben Berechtigungsregel.** Beim Ändern eines Ergebnisses zählte bisher nur, wer den Datensatz angelegt hat (`erstellt_von`) – importierte eigene Ergebnisse liefen dadurch in „Keine Berechtigung", obwohl sie löschbar waren. Jetzt zählt wie beim Löschen zusätzlich das eigene Athletenprofil. Fremde Ergebnisse bleiben unverändert gesperrt.
- Offene Änderungsanträge sind in „Meine Ergebnisse" sichtbar: Die Zeile trägt das Kennzeichen „✏️ beantragt", und das Bearbeiten-Modal weist darauf hin, dass bereits ein Antrag vorliegt.
- Mehrfaches Speichern erzeugt keine Antragsflut mehr: Ein offener Änderungsantrag zum selben Ergebnis wird mit den neuen Werten fortgeschrieben statt ein zweiter angelegt. Die Meldung lautet dann „Änderungsantrag aktualisiert".
- Nebenbei: Die Server-Antwort enthielt bei Änderungsanträgen die literalen Zeichen `Änderungsantrag` statt „Änderungsantrag" – die Escapes standen in einfachen Anführungszeichen und wurden nie aufgelöst.

## v1492
- Meine Ergebnisse: Die Spalte „StNr" sortiert jetzt numerisch statt alphabetisch – vorher stand „10" vor „2". Startnummern dürfen laut Datenmodell Buchstaben enthalten, deshalb wird numerische Collation verwendet: „9" vor „10", „A2" vor „A12", leere Felder immer am Ende. Die Spalte ist außerdem rechtsbündig wie die übrigen Zahlenspalten.

## v1491
- **„Meine Ergebnisse" ist jetzt ein eigener Hauptmenüpunkt** – im Menü zwischen „Veranstaltungen" und „Athleten", sichtbar nur mit verknüpftem Athletenprofil. Unter Veranstaltungen bleiben die beiden Sub-Tabs „Regelmäßige Veranstaltungen" und „Letzte Veranstaltungen".
- Alte Links auf `#veranstaltungen/meine` landen weiterhin richtig: Sie werden beim Aufruf auf `#meine-ergebnisse` umgeleitet, auch der Hash wird entsprechend normalisiert. Das Dashboard-Widget („62 Ergebnisse") springt ebenfalls auf den neuen Menüpunkt.
- Die Seite rendert jetzt direkt in den Hauptinhalt statt in den Veranstaltungs-Container und behält ihre volle Fensterbreite.

## v1490
- Die Option „Wettkampfzählung #km" sitzt jetzt dort, wo sie hingehört: im Einstellungen-Bereich der jeweiligen Kategorie (Admin → Disziplinen → Kategorie → ⚙️ Einstellungen), als Häkchen „Nur je Kategorie zählen (Disziplin ignorieren)". Das eigene Panel unter den Kategorie-Gruppen entfällt.
- Gespeichert wird zusammen mit dem vorhandenen „Speichern"-Button der Kategorie – die Einstellung `zaehlung_pro_kategorie` wird dabei nur geschrieben, wenn das Häkchen tatsächlich geändert wurde.

## v1489
- Die Einstellung zur Wettkampfzählung „#km" sitzt jetzt unter Admin → Disziplinen (eigenes Panel unter den Kategorie-Gruppen) statt unter Einstellungen → Darstellung. Dort stehen die Kategorien ohnehin im Kontext; die Häkchen speichern sofort, ohne den „Speichern"-Button der Einstellungsseite.

## v1488
- Meine Ergebnisse: Die Spalte „Disziplinkategorie" heißt jetzt schlicht „Kategorie".
- **Die Zählung „#km" vermischt keine Disziplinen mehr.** Gezählt wird je Kategorie *und* Disziplin – „5km Straße" und „5km Cross" haben damit getrennte Zählungen. Vorher zählte allein der Disziplinname.
- Für Kategorien, in denen die Strecken nicht vergleichbar sind, zählt stattdessen die Kategorie allein (Disziplin egal). Welche das sind, steht in der neuen Einstellung `zaehlung_pro_kategorie` – vorbelegt mit Cross, Firmenlauf und Trail – und ist unter Admin → Einstellungen → Darstellung als Kategorie-Auswahl pflegbar, also nicht fest im Code. Die Konfiguration akzeptiert `tbl_key` wie Anzeigenamen; bereits gespeicherte Kategorien bleiben in der Auswahl sichtbar, auch wenn es sie nicht mehr gibt.

## v1487
- **Meine Ergebnisse: Löschanträge sind jetzt sichtbar und nicht mehr doppelt möglich.** Athlet*innen und Trainer*innen löschen nicht direkt – ihr Klick erzeugt einen Antrag, den ein Editor prüft. Bisher blieb die Zeile danach unverändert stehen, sodass mehrfaches Klicken mehrere identische Anträge erzeugte.
- `meine-veranstaltungen` liefert je Ergebnis, ob ein offener Löschantrag existiert. Solche Zeilen werden gedämpft dargestellt und tragen das Kennzeichen „🗑️ beantragt"; im Bearbeiten-Modal steht statt des Buttons der Hinweis „Löschung bereits beantragt".
- Serverseitig wird ein zweiter Antrag zum selben Ergebnis abgewiesen (Antwort `bereits: true`), auch wenn der Aufruf an der Oberfläche vorbei erfolgt. Der Abgleich berücksichtigt die Ergebnistabelle, damit in Setups mit getrennten Tabellen keine gleichen IDs kollidieren.
- Der Button heißt für Rollen ohne Direktlöschrecht jetzt „🗑️ Löschen beantragen", und die Rückfrage sagt, dass das Ergebnis bis zur Prüfung in der Liste bleibt. Für Admin und Editor bleibt es beim sofortigen Verschieben in den Papierkorb.

## v1486
- Meine Ergebnisse: Die Disziplin-Kacheln zeigen zunächst nur die favorisierten Disziplinen (Admin → Darstellung, `top_disziplinen`). Erst ein Klick auf eine Kategorie blendet alle Disziplinen dieser Kategorie ein. Eine per Dropdown gewählte, nicht favorisierte Disziplin bleibt als Kachel sichtbar, damit sie abwählbar ist; sind gar keine Favoriten hinterlegt, werden weiterhin alle Disziplinen angezeigt.

## v1485
- Meine Ergebnisse: Die Zählerzeile kürzt nicht mehr ab – statt „151 Wettkampfauftr." steht dort jetzt „151 Wettkampfauftritten" (bzw. „1 Wettkampfauftritt").

## v1484
- Meine Ergebnisse: Der Button „⚙️ Spalten" sitzt jetzt wieder an der Kante der Ergebnisbox – Zählerzeile und Tabelle liegen dafür gemeinsam im Block `#mv-box`, der als Ganzes mitwächst.
- Die Untermenüleiste (Regelmäßige Veranstaltungen / Letzte Veranstaltungen / Meine Ergebnisse) wird wie Kopf und Filterleiste in der Standardbreite angezeigt und bleibt damit an derselben Stelle wie auf den anderen Unterseiten.

## v1483
- **Fix Meine Ergebnisse: Kopf, Filterleiste und Zählerzeile stehen jetzt fest.** Sie behalten die Standardbreite der übrigen Seiten (1440px, jetzt als CSS-Variable `--seiten-breite`) und damit unabhängig vom Tabelleninhalt dieselbe Position – vorher wanderten Chips, Kacheln und Buttons bei jedem Filterklick mit der Tabellenbreite. Nur die Ergebnisbox selbst wächst noch über die Standardbreite hinaus, wenn die Spalten es verlangen.
- Getestet bei 700 / 1100 / 2000px Fensterbreite mit 5, 12 und 19 Spalten: Filterleiste und Zählerzeile sind in jeder Kombination exakt gleich breit und gleich positioniert, die Ergebnisbox verbreitert sich nur im 19-Spalten-Fall.

## v1482
- **Meine Ergebnisse: Profilkopf wie im Athletenprofil.** Avatar, Name, Gruppen-Tags und Badges (Anzahl Ergebnisse und Wettkämpfe, Geschlecht, Jahrgang, aktuelle Altersklasse) stehen jetzt über der Liste, dazu die Zeile mit Titeln und Bestleistungen samt Aufschlüsselung im Tooltip. Die Stammdaten kommen aus `athleten/{id}` und `athleten/{id}/auszeichnungen`; schlägt einer der beiden Aufrufe fehl, wird die Liste trotzdem angezeigt.
- Die Kategorie-Chips („Straße (123)") und Disziplin-Kacheln („5km (21) 17:55") filtern die Gesamtliste: Klick setzt den Filter, erneuter Klick hebt ihn auf. Die Kacheln zeigen nur die Disziplinen der gewählten Kategorie und darunter jeweils die Bestleistung; eine Disziplinauswahl, die nicht zur neu gewählten Kategorie passt, wird verworfen. Das Disziplin-Dropdown der Filterleiste bleibt mit den Kacheln synchron.
- Die Seite ist wieder horizontal zentriert, wenn die Tabelle schmaler als das Fenster ist (`#mv-wrap { margin: 0 auto }`).

## v1481
- **Meine Ergebnisse: Die Ergebnisbox hat keine feste Breitengrenze mehr.** Sie ist genau so breit wie ihr Inhalt und darf bis zur Fensterbreite wachsen – auf einem 2560px-Monitor passen damit alle 19 Spalten ohne Kürzen und ohne Scrollen nebeneinander, bei wenigen Spalten schrumpft sie auf die tatsächlich benötigte Breite.
- Reicht der Platz nicht, greift zuerst die schonendste Einschränkung: Der Veranstaltungsname wird mit „…" gekürzt (bis minimal 120px, voller Name als Tooltip). Erst wenn auch das nicht genügt, scrollt die Tabelle horizontal. Die Breite wird nach jedem Rendern und beim Ändern der Fenstergröße neu bestimmt (`_mvBreiteAnpassen`).
- Getestet bei 600 / 1024 / 1280 / 2560px Fensterbreite mit 6, 12 und 19 Spalten: Die Seite selbst scrollt in keinem Fall horizontal.

## v1480
- Jahresübersicht, Ansicht „Nach Athlet\*in": Die Ereignisse stehen nicht mehr chronologisch, sondern nach Bedeutung. Zuerst die Podestplätze – sortiert nach Platzierung, bei gleicher Platzierung nach Wertigkeit der Meisterschaft (Deutsche oben, Regio unten, gemäß Reihenfolge in Admin → Meisterschaftsarten). Darunter die allein stehenden Vereinsrekorde, Bestleistungen und PBs, ebenfalls nach Wertigkeit. Innerhalb einer Stufe bleibt es chronologisch.

## v1479
- Jahresübersicht: „Nur Favoriten" ist jetzt standardmäßig aktiv (weiterhin pro Person änderbar und gespeichert).
- Die Kennzahlenleiste zeigt wieder alle sechs Karten – und zwar die **vollen Zahlen des Jahres**: Titel, zweite und dritte Plätze, Vereinsrekorde, Bestleistungen AK und persönliche Bestleistungen bleiben stehen, egal welche Ereignistypen gerade eingeblendet sind und ob auf Favoriten eingeschränkt wird. Ebenso zählen die Jahres-Chips jetzt sämtliche Ereignisse eines Jahrgangs.

## v1478
- **Jahresübersicht: neuer Standard.** Die Seite startet jetzt ohne aktivierte Ereignistypen – zu sehen sind zunächst nur Titel und Podestplätze. Die Bestleistungs-Ereignisse (Vereinsrekorde, Bestleistung M/W, Bestleistung AK, PB & Debüt) lassen sich wie bisher einzeln dazuschalten.
- **Fix: Eine leere Filterauswahl wurde nicht gemerkt.** Wer alle vier Ereignistypen abwählte, sah nach dem nächsten Aufruf wieder die alte Vorauswahl – eine leere Liste galt fälschlich als „nichts gespeichert". Jede Auswahl bleibt jetzt pro Person erhalten, auch die leere.
- Die Kennzahlenleiste zeigt nur noch Karten zu Ereignistypen, die der Filter auch durchlässt – statt „0 Vereinsrekorde" bei abgeschaltetem Filter.
- **Doppelte Zeilen zusammengefasst:** War ein Ergebnis zugleich Podestplatz und Rekord bzw. Bestleistung (z. B. Hochsprung 0,80 m als 2. Platz *und* als erste Leistung M75), stand es in der Ansicht „Nach Athlet\*in" zweimal untereinander. Jetzt ist es eine Zeile, die Medaille, Meisterschaft und Rekord-Badge nebeneinander zeigt. Gezählt wird beides weiterhin getrennt.

## v1477
- **Fix Jahresübersicht: Der Ereignis-Filter griff manchmal nicht.** Nach dem Abwählen von z. B. „Bestleistung AK" blieben „Bestleistung W45" oder „Erste Leistung M75" stehen. Ursache war ein Wettlauf der Anfragen: Jeder Filterklick löste eine neue Abfrage aus, und weil der Endpunkt die komplette Timeline über alle Jahre berechnet, konnte die verspätete Antwort der vorigen (ungefilterten) Anfrage die bereits gefilterte Ansicht wieder überschreiben – die Buttons zeigten korrekt „aus", die Liste aber noch die alten Ereignisse.
- Die Ereignisse werden jetzt einmal je Jahr vollständig geladen und clientseitig gefiltert. Ein Filterklick und der Wechsel zwischen „Nach Athlet\*in" und „Chronologisch" wirken damit sofort und ohne Anfrage; ein Jahreswechsel wird zwischengespeichert. Zusätzlich verwerfen überholte Anfragen ihre Antwort.
- Sind alle Ereignistypen abgewählt, sagt das auch die Ansicht „Nach Athlet\*in" – bisher tat das nur die chronologische.

## v1476
- Die Seite heißt jetzt **„Jahresübersicht"** (vorher „Jahres-Bestleistungen") – der Name passt besser, da dort nicht nur Bestleistungen, sondern auch Titel und Podestplätze stehen.

## v1475
- **Meine Ergebnisse: Spalten neu geordnet und frei konfigurierbar.** Die Tabelle folgt jetzt der Reihenfolge # · #km · Datum · Veranstaltung · Ort · Disziplinkategorie · Disziplin · StNr · AK · Pos (AK) · Pos (m/w) · Pos (ges.) · Meisterschaft · Pos (MS) · Ergebnis · Pace · Schuh · Verein · Bemerkungen. Standardmäßig sichtbar sind davon #, Datum, Veranstaltung, Ort, Disziplin, AK, Pos (AK) und Ergebnis – der Rest ist ausgeblendet.
- Neues Modal „⚙️ Spalten": Reihenfolge per Pfeiltasten ändern, Sichtbarkeit per Häkchen, „Standard" setzt zurück. Die Auswahl wird pro Person am Benutzerkonto gespeichert (`auth/prefs` → `mv_spalten`) und überlebt spätere Updates: unbekannte Spalten werden verworfen, neu hinzugekommene hängen mit ihrer Standard-Sichtbarkeit hinten an.
- Neue Spalte „#km": zählt, der wievielte Wettkampf in genau dieser Disziplin es war (ältester = 1). Neue Spalten für Disziplinkategorie, getrennte Positionen (m/w bzw. gesamt), Pos (MS) und Bemerkungen; alle Spalten außer Meisterschaft und Bemerkungen sind sortierbar.
- Die Buttons „Bearbeiten" und „Löschen" am Zeilenende sind weg. Stattdessen erscheint ein ✏️ hinter dem Veranstaltungsnamen, sobald die Maus über der Zeile steht – das 🔄 der regelmäßigen Veranstaltungen wird genauso ein- und ausgeblendet. Gelöscht wird jetzt im Bearbeiten-Modal; auf Touch-Geräten (`hover: none`) sind die Symbole dauerhaft sichtbar.
- Ist die Spalte „Veranstaltung" ausgeblendet, wandert das ✏️ in die erste sichtbare Spalte, damit der Zugang zum Bearbeiten nie verloren geht.

## v1474
- Fix Veranstaltungen → Meine Ergebnisse: Das Suchfeld verlor nach jedem Tastendruck den Fokus. Beim Filtern und Sortieren wird jetzt nur noch der Ergebnisteil der Seite neu gezeichnet, die Filterleiste bleibt stehen – ihre Auswahllisten (Jahr, Disziplin, Verein) hängen ohnehin nur an den Rohdaten, nicht am aktiven Filter.

## v1473
- Veranstaltungen → Meine Ergebnisse: Mehrfachauswahl entfernt (Checkbox-Spalte, „Alle auswählen“, Bulk-Leiste mit Bulk-Bearbeiten/-Löschen). Gelöscht wird jetzt einzeln über einen Papierkorb-Button neben dem Bearbeiten-Button jeder Zeile – inkl. Löschantrag, wenn das Recht fehlt.
- Neue Spalte „#“: Die Wettkämpfe sind chronologisch durchnummeriert, der älteste bekommt die 1. Alle Ergebnisse desselben Wettkampfs teilen sich die Nummer; die Spalte ist sortierbar.
- Nur diese Seite nutzt jetzt bis zu 1920px Breite (CSS-Klasse `body.page-wide`, wird in `renderPage()` grundsätzlich zurückgesetzt), damit alle Spalten ohne Quetschen passen.

## v1472
- **Jahres-Bestleistungen: neue Ansicht „Nach Athlet\*in".** Alle Ereignisse eines Jahres – Titel, zweite und dritte Plätze, Vereinsrekorde, Bestleistungen und PBs – stehen jetzt gebündelt pro Athlet\*in, mit Avatar und Kurzbilanz („2 Titel · 1x 2. Platz · 3 Vereinsrekorde"). Sortiert nach Wertigkeit: erst Titel, dann Podeste, dann Rekorde.
- Umschalter „Nach Athlet\*in / Chronologisch" – die bisherige Ansicht (Podeste nach Meisterschaftsart, Ereignisliste nach Monaten) bleibt erhalten. Die Auswahl wird am Benutzerkonto gemerkt.

## v1471
- Fix „Jahres-Bestleistungen": Die Seite brach mit `Can't find variable: timelineBadges` ab. `timelineBadges()` und `_rekLabel()` lagen im Rumpf von `renderDashboard()` und waren dadurch nur dort sichtbar – beide sind jetzt auf Dateiebene definiert.

## v1470
- **Neue Seite „Jahres-Bestleistungen".** Pro Jahr sind alle relevanten Ereignisse des Vereins abrufbar – über eine Jahresauswahl mit Ereigniszähler.
- Meisterschaften: Titel sowie zweite und dritte Plätze, gruppiert nach Meisterschaftsart (Reihenfolge = Wertigkeit aus Admin → Meisterschaftsarten). Maßgeblich ist die Platzierung in der Meisterschaftswertung (`ak_platz_meisterschaft`), ersatzweise die AK-Platzierung.
- Neue Vereinsrekorde und Bestleistungen des Jahres – aus derselben Quelle wie das Dashboard-Widget „Neueste Bestleistungen", mit demselben Filter (Vereinsrekord / Bestleistung M/W / Bestleistung AK / PB & Debüt) und optional nur für favorisierte Disziplinen. Die Filterauswahl wird am Benutzerkonto gemerkt.
- Kennzahlen-Leiste (Titel, zweite/dritte Plätze, Vereinsrekorde, Bestleistungen) und Monatsgliederung der Ereignisliste.
- Die Timeline-Berechnung des Dashboards liegt jetzt in `berechneTimelineEvents()` und wird von beiden Seiten genutzt – bisher war sie fest im Dashboard-Endpunkt verdrahtet.

## v1469
- **Auch das Leeren des Papierkorbs ist kein Datenverlust mehr.** Ergebnisse, Athleten, Veranstaltungen und Benutzerkonten werden beim endgültigen Löschen vorher vollständig als JSON in die neue Tabelle `archiv_geloescht` geschrieben – mit Zeitpunkt und auslösendem Admin. Im Portal ist der Eintrag weg, per Datenbank bleibt er wiederherstellbar.
- Passkeys eines Kontos gingen bisher per `ON DELETE CASCADE` still mit; sie werden jetzt mitarchiviert.
- `athlet_id` wird beim endgültigen Löschen eines Kontos **nicht mehr auf NULL gesetzt**: Die Verknüpfung zum Athletenprofil steckt damit in der archivierten Zeile und überlebt eine Wiederherstellung. Vorher war sie auch aus einem Backup nicht mehr zu rekonstruieren.
- Schlägt das Archivieren fehl, wird nicht gelöscht.
- Die Bestätigungsdialoge im Papierkorb sagen jetzt, was tatsächlich passiert – „unwiderruflich" stimmte nicht mehr.

## v1468
- **Benutzer löschen im Admin-Panel geht jetzt in den Papierkorb.** Bisher war `DELETE benutzer/{id}` ein echtes `DELETE FROM benutzer` – ohne Rückweg, und per `ON DELETE CASCADE` wurden die Passkeys des Kontos gleich mit entfernt. Das stand im Widerspruch zum Selbstlöschen („Konto löschen"), das schon immer `aktiv=0, geloescht_am=NOW()` gesetzt hat. Der Admin-Pfad setzt jetzt dasselbe; der Papierkorb listete Benutzer bereits auf und konnte sie wiederherstellen, und die Benutzerliste filtert ohnehin auf `geloescht_am IS NULL`.
- Login und bestehende Sessions bleiben durch `aktiv=0` blockiert (`auth.php` prüft `aktiv=1` sowohl beim Login als auch bei jeder Session-Prüfung). `athlet_id` und die `erstellt_von`-Referenzen der Ergebnisse bleiben bis zur endgültigen Löschung aus dem Papierkorb erhalten – die Autorenzuordnung überlebt das Löschen damit.
- Bestätigungsdialog und Erfolgsmeldung im Admin-Panel benennen den Papierkorb.

## v1467
- Fix RaceResult-Scanner: Listen sind bei vielen Events an einen **Contest** gebunden (`"Contest":"1"`). Der Abruf mit `contest=0` antwortet dort mit HTTP 404 `list not found` – betroffen war rund ein Drittel aller Wettkämpfe (z.B. 379346, 380828, 396418), die dadurch nie durchsucht wurden. `config()` liefert jetzt Name **und** Contest je Liste, und pro Contest wird genau eine Liste abgefragt (bevorzugt Ergebnis-/Zieleinlauflisten, max. 4). Meldet eine Liste selbst Contest 0, deckt sie weiterhin alle Wettbewerbe mit einem einzigen Abruf ab.
- `config()` liest `lists` jetzt in beiden von RaceResult gelieferten Formen: als Objekt (Name → Contest) und als Liste von Objekten mit `Name`/`Contest`. Vorher lieferte die Listen-Form nur die numerischen Indizes 0–5 als „Listennamen".
- Einzelne nicht abrufbare Listen brechen den Wettkampf nicht mehr ab, solange eine andere antwortet. Ist gar keine Liste abrufbar, greift dieselbe Abbruchregel wie bei fehlender Ergebnisseite (6 Versuche bzw. 21 Tage) – vorher wären solche Wettkämpfe dauerhaft in der Warteschlange geblieben.

## v1466
- **RaceResult-Scanner** (neu): Sucht wettkampfübergreifend nach Ergebnissen des eigenen Vereins und meldet Funde auf der Eintragen-Seite. my.raceresult.com hat keinen Endpunkt dafür – die neue Bibliothek `includes/raceresult.php` kombiniert deshalb zwei vorhandene: **Discovery** über `GET /RREvents/list?country=<numISO>&dateFrom=&dateTo=` (alle gezeiteten Wettkämpfe eines Landes im Zeitraum, DE+NL+BE ≈ 80/Woche) und pro Wettkampf die **serverseitige Volltextsuche** `GET /{id}/results/list?key=…&contest=0&r=search&term=<Verein>` (Schlüssel/Listenname aus `/{id}/results/config`, Fallback `/{id}/RRPublish/data/config`). Alle Abrufe laufen streng seriell mit 1,15 s Abstand – RaceResult antwortet sonst mit HTTP 429.
- Neue Tabellen `rr_events` (Warteschlange je Wettkampf mit Status `offen`/`fertig`/`ohne_ergebnis`) und `rr_funde` (Treffer, dedupliziert über `fund_key`). Jeder Wettkampf wird nach dem Termin zweimal im Abstand von ≥ 20 h geprüft, dann geschlossen; ohne erreichbare Ergebnisseite nach 6 Versuchen bzw. 21 Tagen. Da die Volltextsuche auch Namen und Startnummern trifft, wird jede Zeile gegen das Vereinsfeld nachkontrolliert.
- Neue Endpunkte: `GET rr-scan?token=…` (Cronjob; Token nur über `rr-scan-status` einsehbar, nie über die öffentliche Einstellungsroute), `GET rr-scan-status` (Admin), `GET rr-funde` (nach Wettkampf gruppiert, mit Athletenzuordnung und Abgleich gegen bereits erfasste Ergebnisse), `POST rr-funde` (erledigt/ignoriert).
- Eintragen-Seite: neues Panel „🔎 Neue Ergebnisse bei RaceResult" analog zu „Ergebnisse ausstehend". „📥 Ergebnisse importieren" belegt Veranstaltung/Datum/Ort vor und startet den bestehenden RaceResult-Importer – der Scanner meldet nur, der Import bleibt unverändert. Das Nav-Badge zählt offene Wettkämpfe und RaceResult-Funde zusammen.
- Admin → System: Panel „RaceResult-Scanner" mit An/Aus, Ländern, Suchbegriffen, Rückblick-Fenster, Budget pro Lauf, Cron-URL, Statistik und „Jetzt scannen".
- Sicherheit: `GET einstellungen` ist öffentlich – `github_token` (und das neue `rr_scan_token`) werden für Nicht-Admins jetzt aus der Antwort entfernt.

## v1465
- Fix „Ergebnisse ausstehend": Die `import_kategorie` wird jetzt aus `training_wettkampf_planung` gelesen (pro Serie), nicht mehr aus `training_wettkampf_ergebnis` (pro Ausgabe) – das Trainingsportal hat die Quelle für dieses Feld geändert. `ergebnis_url` bleibt unverändert aus `training_wettkampf_ergebnis` per `serie_id + jahr`.

## v1464
- Direkt-Import „Ergebnisse ausstehend": Die Übernahme der Importkategorie aus dem Trainingsportal toleriert jetzt sowohl den `tbl_key` (Dropdown-value) als auch den Kategorie-Namen (Label), jeweils case-insensitiv. So greift die Auto-Auswahl unabhängig davon, ob das Trainingsportal `strasse` oder `Straße` liefert. Maßgeblich bleiben ausschließlich die real existierenden Importkategorien aus `disziplin_kategorien` (Endpunkt `disziplinen`).

## v1463
- „Ergebnisse ausstehend": Ist im Trainingsportal für eine Ausgabe eine **Ergebnis-URL** hinterlegt (neue Tabelle `training_wettkampf_ergebnis`, Schlüssel `serie_id + jahr`), erscheint der Button **„📥 Ergebnisse direkt importieren"**. Er bereitet Veranstaltung/Serie/Datum vor, füllt die URL ins Bulk-Feld und startet den Import (RaceResult etc.). Die mitgelieferte `import_kategorie` (Slugs `strasse`, `bahn`, `cross`, `trail`, `sprint`, `mehrkampf`) wird automatisch gesetzt, sofern eine passende Kategorie existiert – sonst öffnet sich wie gewohnt der Kategorie-Selektor. Die API (`offene-wettkaempfe`) liest die neue Tabelle mit (graceful, falls nicht vorhanden).

## v1462
- Fix RaceResult: Listen-Abruf nutzt jetzt `/results/list` statt `/RRPublish/data/list` – wie beim Config-Endpoint (v1461) sind manche Events über den RRPublish-Datenpfad nicht erreichbar (404), über `/results/list` (dem von der Website selbst genutzten Pfad) aber schon. Betrifft beide Import-Pfade (Haupt-Loop + `rrFetch`). Behebt 0 Treffer beim Allgäu Panorama Marathon 413893

## v1461
- Fix RaceResult: Config-Abruf mit Fallback auf `/results/config`, wenn `/RRPublish/data/config` 404 liefert (manche Events sind nur über diesen Endpoint erreichbar, z.B. Allgäu Panorama Marathon 413893). Beide Endpunkte liefern dasselbe Feldformat (`key`, `eventname`, `contests`); der Fallback wird zusätzlich für `TabConfig.Lists` genutzt.

## v1460
- Bulk-Eintragen „Ergebnisse ausstehend": Wettkämpfe mit Trainingsportal-Anmeldungen erscheinen jetzt bereits **am Wettkampftag** statt erst am Folgetag. Die Datumsprüfung schließt das heutige Datum ein (`> heute` statt `>= heute`). Betrifft auch den Nav-Badge, da beide dieselbe API (`offene-wettkaempfe`) nutzen.

## v1459
- **Lauf-Disziplinen wurden nicht gefunden, wenn Liste und Datenbank verschiedene Einheiten benutzen.** Stand im Lauftitel eine Meter-Distanz („1000-m-Schüler/innen (1000m)"), wurde nur nach „1000m"/„1000 m" gesucht – ist die Disziplin als „1km" oder „1.000m" hinterlegt, blieb die Disziplin-Spalte leer. Gesucht wird jetzt in beiden Einheiten und mit Tausenderpunkt; dasselbe gilt für Walking-Disziplinen („5km Walking" wurde bei „(5000m)" nicht gefunden).
- Findet sich über den Namen nichts, wird zusätzlich über die an der Disziplin hinterlegte Distanz gesucht (innerhalb der Kategorien, die die Zeile auch zur Auswahl anbietet). Bei Walking/Nordic bewusst nicht, sonst landet ein 5-km-Walking auf dem 5-km-Lauf.
- Debug-Log: Disziplinen, die keiner Disziplin der gewählten Kategorie zugeordnet werden konnten, werden jetzt mit Zeilenzahl aufgeführt.

## v1458
- **Seltec-Listen aus Word-Exporten werden jetzt gelesen** (z.B. `04_01102011.htm`). Word verpackt jede Tabellenzelle zusätzlich in `<p>`/`<span>`; deren Endtags haben die Zeile umgebrochen, sodass jede Zelle als eigene Zeile ankam und keine einzige Ergebniszeile erkannt wurde (0 Sektionen). Innerhalb einer Tabellenzeile brechen jetzt nur noch `<br>` um.
- HTML-Import: Mehrfach-Leerzeichen werden zusammengezogen – Word trennt die Zellen durch lange Leerzeichenketten, was u.a. die Spaltenüberschrift „Rg. StNr. Name, Vorname" unlesbar machte. Die Überschrift wird zusätzlich mit Leerzeichen vor dem Punkt erkannt („Rg . StNr .").
- Straßenlauf-Import: Trägt ein Bewerb ein Datum, das mehr als eine Woche vom Datum im Listenkopf abweicht (Listen, die aus der Vorjahresdatei erzeugt wurden – im Beispiel „Datum: 03.10.2009" im Lauf gegen „Grefrath, am 01.10.2011" im Kopf), gilt das Kopfdatum. Das Debug-Log weist darauf hin.

## v1457
- **Serie-Detail „Meine Teilnahmen": Starts ohne Verein wurden dem eigenen Verein zugeschrieben.** Die Verein-Spalte fiel bei leerem Vereinsnamen unbesehen auf den eigenen Verein zurück (`r.verein || ownClub`) und ignorierte dabei das `extern`-Flag. Ergebnisse, die bewusst ohne Vereinsbindung eingetragen wurden, erschienen dadurch als Start für den Hausverein. Die Spalte nutzt jetzt dieselbe Hilfsfunktion wie „Meine Veranstaltungen"; der Fallback auf den eigenen Verein greift nur noch bei Vereinsergebnissen (`extern=0`). Die maßgebliche Regel ist an der Hilfsfunktion dokumentiert: Über die Vereinszugehörigkeit entscheidet ausschließlich `extern`, nie der Textwert `verein`.

## v1455
- **Hall of Fame: die im Vereinsrekord aufgegangene AK-Bestleistung verschwindet jetzt auch aus dem Badge.** Bisher wurde pro Gold-Disziplin pauschal eine AK-Bestleistung von der Zählung abgezogen, ohne sie aus dem Badge-Text zu entfernen. Dadurch war die Zeile mal zu niedrig (Badge nannte „Bestleistung M45", gezählt wurde sie nicht), mal schien sie zu hoch (Badge nannte M40–M60, gezählt wurden nur vier davon). Der Vereinsrekord wird jetzt über sein Datum der Altersklasse zugeordnet, in der er gelaufen wurde, und genau diese eine AK-Bestleistung entfällt in Badge und Zählung. Aus „Vereinsrekord über 800m – dazu Bestleistung M40–M60" wird damit „… – dazu Bestleistung M45–M60", und die Badges lassen sich wieder von Hand nachzählen. Die Score-Berechnung nutzt dieselbe Zuordnung.

## v1453
- **Hall of Fame: Gold-Badge trennt Vereinsrekord und Altersklassen sprachlich.** „Vereinsrekord und Bestleistung M40–M60 über 800m und 1.500m" ließ sich so lesen, als sei der Vereinsrekord in jeder der genannten Altersklassen aufgestellt worden – tatsächlich gilt er je Disziplin, die Altersklassen gehören nur zu den Bestleistungen. Das Badge lautet jetzt „Vereinsrekord über 800m und 1.500m – dazu Bestleistung M40–M60". Silber-Badges bleiben unverändert; an der Zählung ändert sich nichts.

## v1451
- **Hall of Fame: Vereinsrekord und die zugehörige AK-Bestleistung zählen als eine Leistung.** Ein Vereinsrekord ist zwangsläufig auch die Bestleistung der Altersklasse, in der er aufgestellt wurde – das Gold-Badge weist beides gemeinsam aus („Vereinsrekord und Bestleistung M45 über 800m"). In der Aufstellung unter dem Namen wurde die Altersklasse trotzdem zusätzlich gezählt, sodass dort z.B. „5 AK-Bestleistungen" stand, obwohl nur 4 silberne Badges zu sehen waren. Pro Disziplin mit Vereinsrekord geht jetzt genau eine AK-Bestleistung im Vereinsrekord auf. Die bisherige Sonderbehandlung der Hauptklasse (MHK/WHK) ist damit ein Spezialfall derselben Regel; die Score-Berechnung folgt wieder derselben Zählweise.

## v1449
- **Hall of Fame: Aufstellung zählt exakt das, was in Medaillen und Badges steht.** Die Zeile unter dem Athletennamen wurde bisher unabhängig von den Badges aus den Roh-Titeln berechnet – Titel, die in keinem Badge dargestellt werden, konnten dadurch in der Zählung auftauchen. Sie wird jetzt in derselben Schleife gefüllt, die die Badges baut, und kann deshalb gar nichts mehr ausweisen, das nicht sichtbar ist. Die Score-Berechnung im Ranking folgt derselben Auswahl.
- **Hall of Fame: Aufstellung bricht nur noch an den Trennpunkten um.** „5 Titel · 1 Vereinsrekord · 5 AK-Bestleistungen" wurde bei schmalen Widgets mitten in einem Abschnitt getrennt. Jeder Abschnitt bleibt jetzt als Ganzes zusammen, das „·" hängt am vorangehenden Abschnitt.

## v1447
- **Hall of Fame: Aufstellung unter dem Namen führt Vereinsrekorde nicht mehr doppelt.** Wer einen Vereinsrekord hält, ist zwangsläufig auch Bestleistungshalter seiner Hauptklasse (MHK/WHK) – dieser Titel wurde in der Zeile unter dem Athletennamen zusätzlich als Bestleistung gezählt, obwohl er bei den Badges bewusst ausgeblendet wird. Aus „6 Vereinsrekorde · 6 Bestleistungen" wird damit korrekt „6 Vereinsrekorde". „Bestleistungen" heißt jetzt „AK-Bestleistungen", passend zu den silbernen Badges. Die Score-Berechnung im Ranking nutzt dieselbe Zählweise, sodass Aufstellung, Badges und Platzierung übereinstimmen.

## v1445
- **Hall of Fame: neue Gewichtung des Rankings.** Bisher zählte jeder Meisterschaftstitel pauschal 3 Punkte und jede Bestleistung 1 Punkt – Vereinsrekordhalter landeten dadurch weit hinten. Neu: Ein Meisterschaftstitel ist so viel wert, wie seine Meisterschaftsart unter Admin → Meisterschaftsarten oben steht (oberster Eintrag = Anzahl der Arten, unterster = 1 Punkt; bei 8 Arten also Olympia 8, Kreis 1). Ein Vereinsrekord (goldenes Badge, identisch zur Seite „Vereinsrekorde") zählt 5 Punkte, eine Altersklassen-Bestleistung (silbernes Badge) 3 Punkte. Die Reihenfolge der Meisterschaftsarten wirkt damit direkt aufs Ranking, ohne dass Punktwerte separat gepflegt werden müssen.

## v1443
- **MikaTiming-Import übernimmt Startnummer und Platzierung M/W.** Beide Felder gehören zur persönlichen Statistik, wurden bisher aber nicht befüllt: Die Startnummer fehlte in der Vereinssuche ganz, die Geschlechtsplatzierung steht bei MikaTiming grundsätzlich nur auf der Detailseite eines Ergebnisses. Die Startnummer wird jetzt auch aus der Ergebnisliste gelesen; für die Platzierung M/W lädt der Import über den neuen Endpunkt `GET /mika-detail` gezielt die Detailseiten nach – erst nachdem feststeht, welche Zeilen übernommen werden, damit es bei wenigen Abrufen bleibt und nicht bei einem pro Roh-Treffer der Namenssuche. Fehlende Gesamt-/AK-Plätze und Zielzeiten werden dabei gleich mit ergänzt. Das Debug-Log weist Startnummer, Platz M/W und Gesamtplatz je Zeile aus.

## v1442
- **MikaTiming-Import: Zielzeit fehlte bzw. war die Bruttozeit.** Die Zeitfelder wurden über exakte Label-Vergleiche (`Netto`, `Brutto`, `Ziel`, `Zeit`) gelesen. Veranstaltungen mit ausführlicheren Labels – z.B. „Zielzeit (Netto)" / „Zielzeit (Brutto)" bei der adidas Runners City Night Berlin – passten in kein Muster: In der Vereinssuche blieb die Zeit ganz leer, in der Namenssuche wurde über den „letzte Zeit"-Fallback still die Bruttozeit übernommen. Die Labels werden jetzt inhaltlich ausgewertet (Netto/Chip vor neutral vor Brutto/Gun) – zentral in `mikaZeitAusLi()` statt in vier Kopien über die API verteilt.

## v1440
- **leichtathletik.de-Import: bekannte Athlet:innen unter anderem Verein werden gefunden.** Der Importer verwarf jede Ergebniszeile, deren Vereinsangabe nicht exakt alle Bestandteile des Vereinsnamens enthielt – Startgemeinschaften, Schul-/Zweitvereine oder abweichende Schreibweisen fielen dadurch stillschweigend aus dem Import. Fremde Vereine werden jetzt gesammelt und gegen die Athletenstammdaten abgeglichen (wie schon bei RaceResult und Seltec); Treffer landen als externe Ergebnisse mit Vereinsangabe in der Vorschau. Zum Schutz vor Fehltreffern bei häufigen Namen muss der Jahrgang zum Stammsatz passen, sofern beide ihn führen.
- **leichtathletik.de-Import: aussagekräftigeres Debug-Log.** Zeilen des eigenen Vereins ohne verwertbares Ergebnis (DNF/DNS/o. Wertung) werden gezählt, die externen Treffer einzeln mit Verein ausgewiesen und – wenn kein einziger Treffer bleibt – die häufigsten Fremdvereine gelistet.
- **Importe gleichen die Veranstaltung vorab mit der Datenbank ab.** Nach jedem Bulk-Import prüft das Formular über den neuen Endpunkt `GET /veranstaltungen/match`, ob zu Datum, Name und Ort bereits eine Veranstaltung existiert. Bei eindeutigem Treffer (gleiches Datum + klare Namens-/Ortsübereinstimmung, kein zweiter gleichwertiger Kandidat) schaltet die Ansicht automatisch auf „Bestehende wählen" um und wählt die Veranstaltung vor – das verhindert Dubletten. Uneindeutige Kandidaten werden nur im Debug-Log genannt, die Auswahl bleibt dann beim Nutzer.

## v1437
- **Seltec-Straßenlauf-Import: Staffelwertungen werden übersprungen.** Läufe wie „4 x 1,2 km" listen Mannschaften statt Athleten – deren Zeilen landeten als Ergebnisse ohne Athlet in der Vorschau. Titel mit „4 x …", „Staffel" oder „Mannschaftswertung" werden jetzt ausgelassen und im Debug-Log als übersprungen ausgewiesen.
- **Fehlende Altersklassen werden aus dem Jahrgang berechnet.** Bambini-, Schüler- und Jedermannläufe führen keine Klasse-Spalte, sodass Zeilen ohne Altersklasse blieben. Das Geschlecht wird jetzt aus dem Athletenstammsatz ergänzt und die AK daraus per DLV-System bestimmt; zusätzlich wird die Klassenangabe `MHK`/`WHK` erkannt.
- **Bekannte Athleten, die für einen anderen Verein oder eine Schule gestartet sind, werden als externe Ergebnisse übernommen.** Bisher lief der Namensabgleich nur, wenn *kein* Vereinstreffer in der Liste stand – Starts für z.B. Oedter Schulen fielen dadurch aus dem Import. Zum Schutz vor Fehltreffern bei häufigen Namen muss der Jahrgang zum Stammsatz passen. Das Debug-Log listet die externen Treffer mit Verein.

## v1435
- **Fix: „Ergebnisse ausstehend" zeigte Anmeldungen für noch nicht stattgefundene Ausgaben.** Das Jahr einer Trainingsportal-Anmeldung wurde aus `naechstes_datum` der Serie bzw. dem laufenden Jahr abgeleitet, obwohl die Anmeldung selbst eine Spalte `jahr` mitbringt. Eine Anmeldung für die Ausgabe 2027 landete dadurch im Jahr 2026, dessen Termin bereits vorbei war – und wurde als fehlendes Ergebnis gemeldet. Maßgeblich ist jetzt die Spalte `jahr` der Anmeldung; der alte Weg greift nur noch, wenn die Spalte fehlt oder leer ist.

## v1434
- **Fix: Verrutschte Vorschau-Tabelle, wenn nur ein Teil der Ergebnisse zu einer Meisterschaft gehört.** Die Spalten „Meisterschaft" und „Platz MS" wurden nur in den Zeilen mit Meisterschaft eingeblendet – allen anderen Zeilen fehlten damit zwei Zellen, sodass Datum und Verein unter die falschen Überschriften rutschten. Die Spalten werden jetzt in allen Zeilen eingeblendet, ebenso in nachträglich über „+ Zeile hinzufügen" erzeugten Zeilen.

## v1430
- **Meisterschaften im Seltec-Import werden automatisch erkannt.** Wird ein Bewerb zusätzlich als Meisterschaft gewertet, wiederholt Seltec dieselben Ergebnisse in einem eigenen Block, der statt der Datumszeile die Bezeichnung trägt („Kreismeisterschaft Kreis Kleve", „Kreismeisterschaft Kreis Niederrhein-West"). Diese Zeile wird jetzt gelesen und der Meisterschaft der jeweiligen Sektion zugeordnet – in Bahn-Listen (PDF + HTML) und in Straßenlauf-Listen („10 km Straßenlauf Kreismeisterschaft 10 km").
- Die doppelten Ergebnisse werden weiterhin zu **einer** Vorschauzeile zusammengeführt, aber nicht mehr einfach verworfen: Aus dem regulären Bewerb kommen Altersklasse und AK-Platz, aus dem Meisterschaftsblock Meisterschaft und MS-Platz. Listet die Meisterschaft sowohl eine Geschlechts- als auch eine Altersklassenwertung, zählt der Platz aus der Wertung, deren Altersklasse zur Zeile passt.
- Die Vorschau blendet die Spalten „Meisterschaft" und „Platz MS" automatisch ein und füllt sie. Die erkannte Bezeichnung wird der konfigurierten Meisterschaftsliste zugeordnet (auch bei Ein-/Mehrzahl-Abweichung); fehlt sie dort, weist eine Meldung darauf hin und die Auswahl bleibt offen. Das Debug-Log listet alle gefundenen Meisterschaften mit Ergebniszahl.

## v1429
- **Straßenlauf-Import: Geschlecht wird aus dem Lauftitel abgeleitet** („ca. 600m Bambini-Lauf Mädchen" → W). Bei Bambini- und Jedermannläufen steht in der Klasse-Spalte keine Altersklasse (`BAM-J`, `BAM-M`), sodass die betroffenen Athleten ohne Geschlecht im Dialog „Neue Athleten gefunden" landeten – und das Anlegen fehlschlug.
- Dialog „Neue Athleten gefunden": Die Fehlermeldung nennt jetzt den Grund vom Server statt nur „Fehler beim Anlegen von …". Meldet der Server „bereits vorhanden", wird die Athletenliste neu geladen und der vorhandene Athlet zugeordnet, statt den ganzen Import abzubrechen.
- `POST athleten` meldete jeden Datenbankfehler als „Athlet bereits vorhanden." – jetzt wird nur ein echter Dublettenfehler (SQLSTATE 23000) so gemeldet, andere Fehler mit ihrer Ursache.

## v1428
- **Seltec-Straßenlauf-Ergebnislisten werden jetzt importiert** (z.B. `2013_10_05_strassenlauf.pdf`). Das Format (`Rg. StNr. Name, Vorname … Zeit Diff Klasse`) unterscheidet sich komplett von den Bahn-Listen und wurde bisher gar nicht erkannt. Der Parser liest Lauf-Überschriften mit Distanz in Klammern („10 km Straßenlauf (10 km)"), dreht „Nachname, Vorname" um, übernimmt Altersklasse und AK-Platz aus der Klasse-Spalte und ordnet die Disziplin über die Distanz zu. Er greift für PDF- und HTML-Quellen.
- Straßenlauf: „Mannschaftswertung"-Abschnitte (Teamzeiten statt Einzelergebnissen) werden übersprungen; Meisterschafts-Wertungen desselben Laufs („10 km Straßenlauf Kreismeisterschaft 10 km") laufen unter demselben Lauftitel, sodass die wiederholten Ergebnisse als Doppelnennungen erkannt und nur einmal übernommen werden.
- **Seltec-Import: Vereinsnamen wurden am Anfang abgeschnitten** – jedes 2–3-stellige Großbuchstaben-Präfix galt als Nationalitätskürzel, also wurde aus „OSC Waldniel" das Vereins-Feld „Waldniel", aus „DJK Kempener LC" wurde „Kempener LC". Jetzt entscheidet eine feste Liste echter Nat-/Kreiskürzel (KNW, GER, NED, …). Betrifft Bahn- und Straßenlauf-Listen gleichermaßen.
- Volkslauf/Straßenlauf: Distanzen mit vier oder fünf Ziffern wurden falsch gelesen („5000m" → „000m").

## v1427
- Fix: Klick auf die neue Athleten-Auswahl-Checkbox (Admin → Athleten) öffnete versehentlich das Athletenprofil – das Zeilen-Attribut kollidierte mit dem globalen `data-athlet-id`-Click-Handler; Zeilen nutzen jetzt `data-aid`.

## v1426
- Bulk-Eintragen: Die Checkbox „Auch inaktive Athleten" wird jetzt aus dem gespeicherten Zustand gerendert. Bisher stand sie nach einem Seitenwechsel wieder auf „an", obwohl weiterhin ohne inaktive Athleten gematcht wurde.

## v1425
- **Seltec-HTML-Import: zweite Export-Variante mit Ergebnis-Tabellen unterstützt.** Manche Dateien (z.B. `2013_06_26.htm`) legen die Ergebnisse nicht in `<pre>`-Blöcke, sondern in Tabellenzellen (`<td class="hdPos/hdName/hdPerf">`) – jede Zelle steht dort im Quelltext auf einer eigenen Zeile, wodurch keine einzige Ergebniszeile erkannt wurde (96 Sektionen, 0 Athleten). Umbrüche innerhalb einer `<tr>` werden jetzt entfernt, `<pre>`-Inhalte bleiben davon unberührt.
- Seltec-Import: Vereinsname aus „Lizenziert für …" wird von angehängter Seltec-URL und Mehrfach-Leerzeichen befreit.

## v1424
- **Admin → Athleten: Mehrfachauswahl + Zusammenführen** – Checkbox-Spalte (nur Admin) zum Markieren mehrerer Athleten; Bulk-Leiste mit „🔗 Zusammenführen". Im Dialog wird der Ziel-Athlet gewählt; alle Ergebnisse (intern + extern), Gruppen und alternativen Namen der übrigen Athleten werden übernommen, deren Hauptnamen als alternative Namen hinterlegt (damit Bulk-Importe die alte Schreibweise weiter zuordnen), leere Stammdaten (Jahrgang/Geschlecht) aufgefüllt und die Quell-Athleten in den Papierkorb verschoben. Neuer Endpunkt `POST athleten/merge`.

## v1423
- **Seltec-HTML-Ergebnislisten (ältere Darstellung als `.htm`/`.html`) können jetzt importiert werden** – URL ins Eingabefeld einfügen oder die Datei auf das Feld ziehen (z.B. `.../2013_05_22.htm`). Der Textinhalt entspricht dem Seltec-PDF-Format 2018, daher wird derselbe Parser genutzt: Navigation und Klassenmenü werden entfernt, `<pre>`-Blöcke zeilenweise gelesen, Entities dekodiert und windows-1252-kodierte Dateien korrekt umgewandelt.
- Der Datei-Proxy (`api/pdf-fetch`) akzeptiert zusätzlich `.htm`/`.html` und liefert HTML unverändert als Bytes aus, damit das Frontend die Zeichenkodierung selbst bestimmen kann.
- Seltec-Parser: AK-Untersektionen ohne „Rk. StNr."-Kopfzeile werden erkannt (HTML-Export), auf 30 Zeichen gekürzte Titel wie „… - Zeitläu" ebenfalls.
- Seltec-Parser: Feldwettkämpfe ohne Wind-Spalte (z.B. Weitsprung im HTML-Export) wurden komplett übersprungen, weil die Leistung als Windwert gelesen wurde. Jetzt gilt die letzte Spalte nur dann als Wind, wenn sie ein Vorzeichen hat oder davor bereits eine Leistung steht.
- Seltec-Parser: „aufg.", „zurückgez." und „o.g.V." werden wie DNS/DSQ als „kein Ergebnis" behandelt.
- Seltec-Import: Meisterschafts-Wertungen wiederholen dieselben Ergebnisse (z.B. „Kreismeisterschaft Niederrhein-West" nach dem regulären Bewerb) – identische Zeilen werden nur noch einmal in die Vorschau übernommen und im Debug-Log gezählt.

## v1422
- **Dashboard → „Mein Athletenprofil": Der Ergebnis-Zähler zählt jetzt alle Ergebnisse.** Bisher waren nur Vereinsergebnisse enthalten – die externen Ergebnisse (`extern=1`) wurden ausgelassen, weil sie zum Zeitpunkt der Zählung noch nicht in die Kategorien eingebettet waren.
- Das Ergebnis-Badge im Widget ist jetzt anklickbar und führt direkt zu **Veranstaltungen → Meine Ergebnisse** (`openMeineErgebnisse()`).
- Der Veranstaltungen-Untertab steht jetzt im URL-Hash (`#veranstaltungen/meine`, `/letzte`, `/serien`) und wird beim Neuladen bzw. Zurück-Button wiederhergestellt.

## v1421
- **Dashboard → „Persönliche Bestleistungen": Disziplinen mit „Aus Hall of Fame ausschließen" werden jetzt ebenfalls ausgeblendet.** Bisher wirkte das Häkchen (Admin → Disziplinen → Disziplin bearbeiten) nur auf die Hall of Fame; das eigene PB-Widget zeigte auch Firmenläufe & Co. Die API (`athleten/{id}`) liefert `hof_exclude` jetzt sowohl für Vereins- als auch für externe Ergebnisse mit, das Widget filtert entsprechend.
- Admin → Disziplinen: Hinweistext unter der Checkbox ergänzt (Anlegen- und Bearbeiten-Dialog), dass die Einstellung auch das Dashboard-Widget betrifft.

## v1420
- **Fix: Doppelt kodierte Namen in der Datenbank („Run&amp;Fun" statt „Run&Fun").** `sanitize()` hat jedes `&` beim Speichern zu `&amp;` gemacht – bei jedem weiteren Speichern wuchs die Kette (`&amp;amp;`). Dadurch fand die Suche nach „Run&Fun" nur einen Teil der Einträge. `sanitize()` löst vorhandene Entities jetzt zuerst auf und lässt `&` unangetastet; `<`, `>`, `"` und `'` bleiben wie bisher maskiert. Die Funktion ist damit idempotent – mehrfaches Speichern verändert den Wert nicht mehr.
- Einmalige Datenbereinigung beim ersten Aufruf nach dem Deploy: `&amp;`/`&#38;` werden in Veranstaltungen (Name, Kürzel, Ort), Serien, Orten, Ergebnissen (Disziplin, Verein, Schuh, Bemerkungen), Athleten, Disziplinen, Kategorien und Gruppen aufgelöst (mehrfach, damit auch `&amp;amp;` verschwindet). `&lt;`/`&gt;` bleiben bewusst maskiert.
- Suche findet beide Schreibweisen: Der Suchbegriff wird zusätzlich in der kodierten Variante geprüft (Veranstaltungssuche, Ergebnissuche inkl. Veranstaltungsname), sodass „Run&Fun" auch verbliebene Altdaten mit „Run&amp;Fun" trifft.

## v1419
- **Admin → Wartung → Duplikate zeigt den echten Veranstaltungsnamen.** Angezeigt wurde bisher nur `kuerzel` ohne führendes Datum – und da `kuerzel` das Format „dd.mm.yyyy Ort" hat, blieb nur der Ort übrig. Jetzt wird `veranstaltungen.name` verwendet (Rückfall auf das Kürzel, wenn kein eigener Name hinterlegt ist), der Ort steht als Unterzeile darunter. Veranstaltungsnamen werden dabei HTML-escaped.

## v1418
- Admin → Wartung → Duplikate nennt zu jeder Disziplin zusätzlich die **Disziplin-Kategorie** (aus `disziplin_kategorien.name`) – in der Tabelle als Unterzeile, in der Kopfzeile in Klammern. Unterscheiden sich zwei Ergebnisse nur in der Kategorie (abweichende `disziplin_mapping_id`), gilt das jetzt ebenfalls als Abweichung und wird farbig hervorgehoben.

## v1417
- Admin → Wartung → Duplikate zeigt die **Disziplin je Ergebnis** in einer eigenen Tabellenspalte. Weichen die beiden Disziplinen voneinander ab (mehrfach importierter Lauf), werden sie farbig hervorgehoben und in der Kopfzeile als „100 m / 110 m Hürden" nebeneinandergestellt. Der Bearbeiten-Dialog übernimmt jetzt die Disziplin der jeweiligen Zeile statt immer der des ersten Ergebnisses.

## v1416
- **Fix: Ergebnisse eigener Disziplin-Kategorien ließen sich nicht löschen oder bearbeiten.** Die API bediente nur die sieben eingebauten Kategorie-Keys (`strasse`, `sprint`, …); Ergebnisse aus selbst angelegten Kategorien (z.B. „Firmenlauf") liefen beim Speichern/Löschen in einen 404. Jetzt werden alle in der Datenbank hinterlegten `tbl_key` bedient, zusätzlich gibt es den kategorieunabhängigen Endpunkt `DELETE ergebnisse/{id}`, den „Meine Ergebnisse" nun verwendet.
- **Fix: Mehrfachimport desselben Laufs mit unterschiedlicher Disziplin.** Der Dubletten-Abgleich lief bisher nur innerhalb derselben Disziplin – wurde dieselbe CSV-Zeile mit einer anderen Disziplin erneut importiert, entstand ein weiteres Ergebnis. Beim Speichern wird jetzt zusätzlich über Athlet + Datum + Ergebnis geprüft (disziplinübergreifend); nur ein ausdrückliches „Trotzdem anlegen" legt noch ein zweites Ergebnis an.
- CSV-Vorschau zeigt jetzt an, welcher **bestehenden** Veranstaltung eine Zeile zugeordnet wird, wenn deren Name vom CSV-Namen abweicht (`↳ Firmenlauf "Rund und Fun"`). Über „trennen" lässt sich die automatische Zuordnung aufheben und eine eigene Veranstaltung anlegen.
- Admin → Duplikate findet zusätzlich Ergebnisse derselben Veranstaltung mit identischem Ergebnis, aber unterschiedlicher Disziplin – damit lassen sich versehentlich mehrfach importierte Läufe aufräumen.

## v1415
- CSV-Import: Fehlt der Ort, schlägt das Portal ihn aus früheren Austragungen desselben Wettkampfs vor (Namensähnlichkeit, jüngste Austragung mit hinterlegtem Ort gewinnt). Der Vorschlag ist vorausgewählt und mit Quelle gekennzeichnet („💡 Run&Fun Krefeld 2023").
- Fehlt die Disziplin, wird die vorgeschlagen, die der Athlet bei früheren Austragungen dieses Wettkampfs am häufigsten gelaufen ist – inklusive Kategorie und Häufigkeit („💡 Straße · 3× dort gelaufen").
- Disziplin-Auswahl ist jetzt nach Kategorie gruppiert (`optgroup`) und innerhalb der Kategorie konsequent nach Distanz sortiert (hinterlegte Distanz, sonst aus dem Namen gelesen; Halbmarathon/Marathon korrekt einsortiert, Disziplinen ohne Distanz ans Ende).
- Bearbeiten-Dialog und Einzelformular: Schuh und Verein bieten die bereits verwendeten eigenen Werte als Auswahlliste an (häufigste zuerst), freie Eingabe bleibt möglich. Neuer Endpunkt `GET ergebnisse/eigene-werte`.

## v1414
- CSV-Import: Bereits gespeicherte Ergebnisse landen beim erneuten Einlesen derselben Datei nicht mehr unter „Unvollständig". Der Dubletten-Abgleich greift jetzt auch ohne zugeordnete Disziplin bzw. ohne Ort – erkannt über Athlet + Datum + Ergebnis (Zeitformat-unabhängig über `resultat_num`). Solche Zeilen stehen in der Duplikat-Gruppe mit dem Hinweis „bereits gespeichert" und stehen standardmäßig auf „Überspringen".
- Einmal gewählte Zuordnungen werden gemerkt: die Disziplin je CSV-Wettbewerbsbezeichnung (z.B. „Firmenlauf" → 4,9km) und der Ort je Wettkampfnamen. Beim nächsten Import derselben Datei sind sie automatisch gesetzt – auch für neu angelegte Orte.

## v1413
- Fehlende Altersklassen im Import: Die DLV-AK wurde bisher nur berechnet, wenn am Athleten ein Jahrgang hinterlegt war. Jetzt dient der Jahrgang aus dem Import (Jg.-Spalte des PDF) als Ersatz, und die AK-Angleichung läuft nach jedem Import automatisch über alle Zeilen.
- Neu: Fehlt der Jahrgang in den Stammdaten und liefert der Wettkampf einen, wird er automatisch am Athleten nachgetragen (nur Editor/Admin, widersprüchliche Angaben innerhalb eines Imports werden ausgelassen). Die Ergänzungen stehen im Import-Debug-Log und werden als Hinweis gemeldet.
- Seltec-Import: Disziplinnamen mit Dezimalkomma wurden am Komma abgeschnitten – aus „2,2-km-Jugendlauf, WM Jugend" wurde die Disziplin „2". Ein Komma zwischen Ziffern trennt jetzt nicht mehr.

## v1412
- Unbekannte Import-Disziplinen lassen sich jetzt auch **korrigieren**, nicht nur neu anlegen: Ein Klick auf den Chip öffnet „Disziplin zuordnen" mit Suchfeld und Liste aller Disziplinen (inkl. Kategorie). Nach dem Zuordnen werden alle betroffenen Vorschauzeilen gesetzt.
- Automatischer Vorschlag im Dialog: Zusätze wie „ca.", „circa", „etwa", „~" oder ein angehängter Klammerzusatz werden ignoriert, sodass z.B. „ca. 400m" direkt „400m" vorschlägt. Treffer in der aktiven Importkategorie (inkl. Kategoriegruppen) haben Vorrang.
- „Neu anlegen…" bleibt als zweite Option im Dialog (nur Admins) und legt die Disziplin mit bereinigtem Namen an; die Zeilen werden trotzdem über den Rohnamen aus dem Import zugeordnet.
- Der Hinweis ist jetzt auch für Nicht-Admins anklickbar, da das Zuordnen zu bestehenden Disziplinen keine Adminrechte braucht.

## v1411
- Import-Disziplinsuche berücksichtigt jetzt die Kategoriegruppen: Disziplinen aus Partner-Kategorien (z.B. „Weitsprung" aus Sprung & Wurf beim Sportfest in der Kategorie Bahn) werden korrekt zugeordnet statt nur über den Namensvergleich in die Zeile zu rutschen. Gesucht wird zuerst in der gewählten Kategorie, dann in den Gruppenpartnern – Kategorien außerhalb der Gruppe bleiben ausgeschlossen.
- Der Hinweis auf unbekannte Disziplinen wird jetzt aus den tatsächlich leer gebliebenen Vorschauzeilen gebildet. Dadurch erscheint er nicht mehr für Disziplinen, die über eine Kategoriegruppe sauber gesetzt wurden.

## v1410
- Import: Disziplinen werden wieder ausschließlich innerhalb der gewählten Importkategorie zugeordnet (Rücknahme aus v1409) – ein 400-m-Bambinilauf auf der Straße darf nicht auf die Bahn-Disziplin „400m" gebucht werden.
- Neu: Nach dem Import erscheint unter dem Einlesen-Feld ein Hinweis mit allen nicht zugeordneten Disziplinen (z.B. „400m", „5km Walking"). Admins können sie per Klick direkt anlegen – das bekannte „Neue Disziplin"-Formular öffnet sich mit vorausgefülltem Namen und der aktiven Kategorie. Nach dem Speichern werden alle betroffenen Importzeilen automatisch auf die neue Disziplin gesetzt, ohne den Import zu wiederholen.
- Nicht-Admins sehen die unbekannten Disziplinen als Hinweis, aber ohne Anlege-Button.

## v1409
- Volkslauf-PDF-Import: Disziplinen, die nicht in der aktiven Importkategorie liegen, blieben leer (z.B. „400m" beim Bambinilauf, während die Kategorie auf Straße stand). Es wird jetzt zuerst in der aktiven Kategorie und danach kategorieübergreifend gesucht – die Zeile wechselt die Kategorie automatisch mit.

## v1408
- Bulk-Eintragen: Neues PDF-Format „Ergebnisliste AK" (Volkslauf-Listen mit den Spalten AKPl / Startnr. / Name / Jahrg. / m/w / Verein / Zeit) wird erkannt und importiert – Läufe (z.B. „Jugendlauf 2 km", „Bambinilauf 400 m") werden als Disziplin, die Zwischenüberschriften als Altersklasse (WU14, MU12, W, M …) übernommen. Getestet mit dem Burg-Uda-Nettolauf 2015 (88 von 88 Zeilen, davon 21 Vereinsergebnisse).
- Enthält das PDF kein Datum, wird es aus Dateiname bzw. URL gelesen (z.B. `2015_09_05_…pdf` → 05.09.2015).
- Nordic-Walking-Läufe werden nicht mehr auf die gleich lange Laufdisziplin gemappt; ohne passende Walking-Disziplin bleibt die Auswahl offen.
- PDF-Textextraktion: Wörter, die vom PDF ohne Leerzeichen geliefert werden, werden anhand der Abstände wieder getrennt – vorher konnten Spalten zusammenkleben.

## v1407
- Seltec-Import: Einstellige Altersklassen (z.B. W9, M7, W5) wurden aus den Sektions-Titeln nicht erkannt, weil das Muster zwingend zwei Ziffern erwartete – betroffene Ergebnisse kamen ohne Altersklasse in die Vorschau (z.B. „Kinder W9 - Zeitläufe"). Jetzt werden ein- und zweistellige Altersklassen gelesen.

## v1406
- CSV-Import: Auswahl-Häkchen entfernt. Stattdessen lässt sich jeder Wettkampf einzeln über „⬇ Import" in seiner Zeile importieren, zusätzlich gibt es „Gruppe importieren" je Statusgruppe und „Alle importieren". Importierte Zeilen wandern in die Gruppe „Bereits importiert" und werden nicht erneut gesendet; die API meldet jetzt pro Zeile Status und Meldung zurück.
- Ort wird nur noch aus den im System hinterlegten Orten gewählt (Vorschau, Zeilen-Editor und Einzelformular) – inklusive Option „+ Neuen Ort anlegen…". Beim Anlegen einer Veranstaltung wird die `ort_id` mitgespeichert, sodass Ortsdaten (z.B. Landesflagge) direkt verknüpft sind. Orte aus der CSV werden über Name oder Alias aufgelöst, unbekannte Schreibweisen bleiben leer und müssen ausgewählt werden.

## v1405
- CSV-Vorschau ist jetzt nach Status gruppiert: „Unvollständig", „Duplikate mit abweichenden Feldwerten", „Duplikate ohne Konflikt" und „Neu – werden importiert". Jede Gruppe ist auf-/zuklappbar, zeigt ihre Anzahl und hat Sammelaktionen (alle zusammenführen / überspringen / trotzdem anlegen). Die Kopfzeile fasst weiterhin importierbar, Duplikate, abweichende Feldwerte und unvollständige Zeilen zusammen.
- Neuer Zeilen-Editor (✏️ bzw. „Details"): **alle** Felder einer Importzeile sind editierbar – auch leere wie Schuh, Startnummer, Bemerkungen, Positionen, Verein oder Meisterschaft. Änderungen an Datum, Ort, Wettkampf oder Disziplin lösen automatisch eine erneute Veranstaltungs- und Dublettenprüfung aus.
- Bei Duplikaten wird pro abweichendem Feld entschieden, welcher Wert gilt („Gespeicherten behalten" / „Import übernehmen"). Zusammenführen ergänzt weiterhin alle leeren Felder, überschreibt aber genau die ausgewählten Felder – inklusive Ergebnis (mit neu berechnetem `resultat_num`) und Verein (setzt die Extern-Kennzeichnung passend).
- Manuell gewählte Aktionen bleiben bei einer erneuten Prüfung erhalten.

## v1404
- CSV-Import/eigenes Ergebnis: Eine leere Vereinsangabe bleibt jetzt wirklich leer und wird nicht mehr durch den eigenen Verein ersetzt. Ohne Vereinsangabe zählt das Ergebnis als externes Ergebnis; in „Meine Ergebnisse" wird der eigene Verein nur noch bei echten Vereinsergebnissen als Fallback angezeigt.
- Dubletten-Erkennung greift jetzt auch bei abweichender Wettkampfbezeichnung oder fehlendem Ort: Ein vorhandenes Ergebnis desselben Athleten am selben Tag in derselben Disziplin gilt als Duplikat, unabhängig von der Veranstaltungszuordnung (z.B. „Bottroper Herbstwaldlauf" ↔ „Herbstwaldlauf"). Die Veranstaltung des vorhandenen Ergebnisses wird übernommen, sodass keine zweite Veranstaltung angelegt wird.
- Veranstaltungs-Zuordnung vergleicht Namen tolerant (Umlaute, Bindestriche, Wortstämme, Wortreihenfolge) und prüft zusätzlich den Ort – „Bottroper Herbstwaldlauf" findet „Herbstwaldlauf Bottrop".
- Konflikte werden klar angezeigt: Vergleichstabelle Gespeichert ↔ Import mit Kennzeichnung je Feld (Konflikt / wird ergänzt / identisch), Badges und Klartext-Abweichungen direkt in der CSV-Vorschau sowie ein Detail-Dialog je Zeile. Unterschiedliche Schreibweisen derselben Zeit (`00:40:58` ↔ `40:58`) gelten nicht als Konflikt.

## v1403
- Claude-Prompt auf die Newsblog-Konventionen von tus-oedt.de umgestellt: Gutenberg-Aufbau (h2-Titel, Datum am Anfang der Einleitung, More-Block, h3-Disziplinen), Ergebnisse als Absatzzeilen statt Tabelle, festes Zeilenformat mit Altersklasse vor dem Medaillen-Emoji, Korrekturregeln (Komposita, Dezimalkomma) und Sonderfall für heimische Veranstaltungen
- Längenbegrenzung entfernt – nur die Einleitung bleibt bewusst kurz (More-Block), der Bericht selbst darf ausführlich sein
- Externe Starts (anderer Verein) werden aus den Daten gefiltert und die Anzahl gemeldet
- Leistungen werden im Prompt fertig formatiert übergeben (`16,55 sec`, `3:00,95 min`, `4,57 m`, `3:36:19 h`) – deutsches Dezimalkomma und Einheit kommen aus dem Code, nicht vom Modell

## v1402
- Claude-Prompt überarbeitet: Einstieg und Tonalität wie im bisher manuell genutzten Prompt („lebhafter Text für den Newsblog"), Länge auf 250–400 Wörter erhöht
- Neuer Abschnitt „Ergebnisliste auswerten": Claude wird angewiesen, die hinterlegte Ergebnisquelle zu öffnen und Teilnehmerzahl, Gesamtplatzierungen, Siegerzeiten und Auffälligkeiten zu ermitteln – mit ausdrücklichem Hinweis, bei fehlenden Angaben nicht zu raten. Ohne hinterlegte Quelle erscheint stattdessen ein Hinweis, entsprechende Angaben wegzulassen.
- Legende stellt klar, dass „Platz AK" der Altersklassen- und nicht der Gesamtplatz ist

## v1401
- Teilen: dritter Tab „🤖 Claude-Prompt" – fertiger Auftrag mit Aufgabenstellung, Vorgaben (Tonalität, Länge, Aufbau, Gutenberg-Ausgabe), Veranstaltungs-Metadaten, Ergebnistabellen je Disziplin inkl. Pace und Auszeichnungen sowie einer Legende. Button „Kopieren & Claude öffnen" legt den Prompt in die Zwischenablage und öffnet claude.ai in einem neuen Tab.

## v1400
- Ergebnisse haben neue optionale Felder: `startnummer`, `pos_geschlecht` (Pos m/w), `pos_gesamt`, `schuh`, `bemerkungen` (Migration per `ADD COLUMN IF NOT EXISTS`).
- Eintragen → „Eigenes Ergebnis eintragen": neuer **CSV-Bulk-Import** (Datei wählen oder per Drag&Drop). Erkennt die Spalten `Datum, Wettkampf, Wettbewerb, Startnummer, AK, Pos (AK), Pos (m/w), Pos, Endzeit, Schuh, Verein / Team, Bemerkungen, Sonderwertung, Pos (Sonderwertung)`, versteht deutsche Datumsangaben („4. Januar 2026"), Komma-Zeiten („19:25,64") und quotierte Felder. Vorschau-Tabelle mit editierbarem Ort und Disziplin-Auswahl je Zeile; bestehende Veranstaltungen werden über Datum+Ort bzw. Datum+Name erkannt, der Ort wird aus der Orte-/Alias-Liste vorgeschlagen.
- Dubletten-Abgleich für eigene Ergebnisse: gleicher Athlet + gleiche Veranstaltung + gleiche Disziplin gilt als Duplikat (offene Anträge werden mitgeprüft). Pro Zeile wählbar: Zusammenführen (füllt nur leere Felder), Überspringen oder trotzdem anlegen. Auch beim Einzelformular erscheint jetzt ein Dialog statt eines doppelten Eintrags; Zeilen ohne erkanntes Duplikat werden beim Speichern serverseitig erneut geprüft.
- Eigenes Ergebnis eintragen: optionale Felder Startnummer, Pos (AK), Pos (m/w), Pos (gesamt), Schuh und Bemerkungen ergänzt; Verein/extern, AK-Platz und Meisterschaft werden beim eigenen Ergebnis jetzt tatsächlich gespeichert.
- Bulk-Importe übernehmen Startnummer und Gesamtplatzierung, soweit die Quelle sie liefert: RaceResult (BIB + Gesamtrang), MikaTiming (Startnummer + Platz gesamt), ACN Timing/Chronorace (BIB-Spalte + Gesamtrang). Duplikate beim Bulk-Import werden nicht mehr nur übersprungen, sondern um fehlende Zusatzangaben ergänzt.
- Veranstaltungen → „Meine Ergebnisse": neue Spalten Pl. m/w · ges., StNr und Schuh (nur wenn Daten vorhanden), Bemerkungen als Tooltip; die Felder sind im Bearbeiten-Dialog editierbar.

## v1399
- Veranstaltungen: Der Sub-Tab „Meine Veranstaltungen" heißt jetzt „Meine Ergebnisse".

## v1398
- Ergebnisse: Orte aus der Datenbank werden jetzt mit Landesflagge angezeigt (`🇩🇪 Düsseldorf`), Orts-Freitexte aus Importen bleiben ohne Flagge – so ist sofort erkennbar, ob ein Ort verknüpft ist. API-Queries für Ergebnisse, Athletenprofil und externe Ergebnisse joinen jetzt `orte` und liefern `ort_land_code`; `fmtVeranstName` nutzt die Flagge.

## v1397
- Admin → Orte: Aliase je Ort definierbar (eine Schreibweise pro Zeile). Beim Bulk-Import gefundene Ortsnamen werden darüber automatisch dem richtigen Ort zugeordnet und auf den kanonischen Namen normalisiert – z.B. „Grefrath" → „Grefrath-Oedt". Aliase werden auch in der Ortssuche (Admin, Bulk-Import, Ort-Picker) berücksichtigt; beim Zusammenführen zweier Orte wird der Name des aufgelösten Ortes automatisch zum Alias des Ziel-Ortes. Serverseitig löst auch `ergebnisse/bulk` Aliase auf, falls das Frontend keine `ort_id` mitschickt.

## v1396
- Fix: Bei der Veranstaltungssuche fehlte manchmal das Serien-Badge („🔄 Name der regelmäßigen Veranstaltung"). Die Serienliste wurde ausschließlich nach dem Suchbegriff gefiltert – passte der Begriff nur auf den Veranstaltungsnamen, nicht auf den Seriennamen, fand das Frontend die Serie nicht. Jetzt werden zusätzlich immer die Serien der gefundenen Veranstaltungen mitgeliefert.

## v1395
- Eintragen: Externe PDF-Links werden jetzt direkt unterstützt – eine `.pdf`-URL im Textarea-Feld wird erkannt und über einen serverseitigen Proxy (`api/pdf-fetch`) geladen und geparst (Seltec/Track&Field-Format). Kein lokales Hochladen oder Herunterladen nötig.

## v1394
- WhatsApp-Teilen: Platzierung jetzt immer als Zahl am Zeilenanfang, Medaille ans Zeilenende (`2. Simon Heiß (M35) – 39:57 🥈`). Vorher ersetzte das Emoji die Platzziffer, wodurch bei Podestplätzen die Nummer fehlte.

## v1393
- Fix: Ergebnisquelle (`datenquelle`) wurde beim Bulk-Import nie gespeichert – das Frontend sendete das Feld je Zeile, die API las es aber nirgends aus. Jetzt beim Anlegen mitgeschrieben und bei bestehenden Veranstaltungen nachgetragen (nur wenn noch leer, überschreibt also nichts).
- Veranstaltung bearbeiten: neues Feld „🌐 Ergebnisquelle (URL)" – damit lassen sich Altbestände ohne Quelle nachpflegen. `datenquelle` wird im PUT-Handler unterstützt.

## v1392
- Fix Papierkorb „Alles löschen": FK-Fehler `ergebnisse_ibfk_1` (Cannot delete or update a parent row) – gelöschte Veranstaltungen/Athleten wurden gelöscht, obwohl noch aktive (nicht gelöschte) Ergebnisse darauf verwiesen. Jetzt werden solche Einträge übersprungen und im Ergebnis-Hinweis gezählt; Benutzer-Löschung trennt zusätzlich `erstellt_von`-Referenzen. Einzel-Löschung von Veranstaltung/Athlet gibt statt eines SQL-Fehlers eine verständliche Meldung aus.

## v1391
- Fix RaceResult: AK-Platz statt Gesamtplatz wird importiert, wenn eine Liste den AK-Platz enthält (z.B. „Ergebnisliste MW+AK" mit `AKPlp`). Priorität ist jetzt reihenfolge-unabhängig (Flag `platzIsAk`) – vorher gewann der zuerst verarbeitete Gesamtplatz, weil „MW+AK" nicht als AK-Liste erkannt wurde (Rheinuferlauf Duisburg: Nina Mayer AK-Platz 4 statt Gesamt 83)

## v1390
- Fix: Teilen-Button ohne Funktion – `_rekLabel` ist in `03_dashboard.js` nicht global (in eine Funktion verschachtelt), der Aufruf aus `02_app.js` warf einen ReferenceError, der als unbehandelte Promise-Rejection verpuffte. Eigene Label-Funktion `_shareRekLabel` ergänzt; Dashboard-Abruf zusätzlich in try/catch, damit ein Fehler dort das Modal nicht mehr blockiert.

## v1389
- Teilen-Dialog überarbeitet: Markdown entfällt, stattdessen zwei Formate – **WordPress** (Gutenberg-Blöcke mit Tabellen, Link zur offiziellen Ergebnisliste des Veranstalters) und **WhatsApp** (kompakter Text mit Medaillen-Emojis, direkter „In WhatsApp öffnen"-Button)
- Beide Formate enthalten jetzt die Bestleistungs-Auszeichnungen aus „Neueste Bestleistungen" (PB, Debüt, Vereinsrekord, Bestleistung AK/Männer/Frauen)
- API: Dashboard-Timeline-Events liefern `veranstaltung_id`, neuer Filter `?tl_veranstaltung_id=` für veranstaltungsbezogene Bestleistungen

## v1388
- Fix: Nav-Badges (Admin + Eintragen) stehen jetzt NEBEN dem Text statt darunter. Nav-Buttons sind `flex-column`, wodurch Text und Badge-Span als getrennte Flex-Items untereinander umbrachen – jetzt in einen Inline-Wrapper (`white-space:nowrap`) gepackt.

## v1387
- Fix: Top-Bar-Badge „Admin" spiegelt jetzt tatsächlich die Summe aller Subtab-Badges (inkl. Benutzer ohne Athletenprofil). Ursache: `_patchAdminNavBadge()` schrieb in ein nicht existierendes `.nav-label`-Element; jetzt wird – analog zum „Eintragen"-Badge – der komplette Button-Inhalt gesetzt.

## v1386
- Fix: Badge „Benutzer ohne Athletenprofil" zählt jetzt auch Benutzer mit verwaister `athlet_id` (Athlet gelöscht → keine Zuordnung mehr auflösbar), nicht nur solche mit `athlet_id = NULL`. Neuer Helper `_userOhneAthlet()`.

## v1385
- Admin → Benutzer: Notification-Badge zeigt jetzt die Anzahl aktiver Benutzer **ohne zugeordnetes Athletenprofil** (kombiniert mit ausstehenden Registrierungen).
- Top-Bar „Admin": Badge summiert nun **alle** Notification-Badges (Anträge + Registrierungen + Veranstaltungs-Freigaben + Papierkorb + Benutzer ohne Athletenprofil) statt nur einiger davon.

## v1384
- Login: E-Mail-Code ist jetzt der automatische 2FA-Fallback. Benutzer ohne TOTP und ohne Passkey werden nicht mehr zum Setup gezwungen, sondern bekommen beim Login automatisch einen E-Mail-Code (der explizite Flag `email_login_bevorzugt` ist damit optional). Admin → Benutzer zeigt bei diesen Benutzern konsequent das „📧 E-Mail"-Badge in der 2FA-Spalte.

## v1383
- Fix RaceResult: benannte Standarddistanzen werden distanzbasiert erkannt – Contest „21,1 Km Rheinuferlauf" → Halbmarathon, „42,195 km" → Marathon. `rrBestDisz` mappt ~21,1 km auf „Halbmarathon" und ~42,2 km auf „Marathon", auch wenn die System-Disziplin keine Ziffern enthält (behebt fehlende Disziplin bei Nina Mayer, Rheinuferlauf Duisburg)

## v1383
- Navigation: Zahl-Badge am Tab „Eintragen" zeigt, wie viele Wettkämpfe aus dem Trainingsportal auf die Ergebnis-Erfassung warten (analog zum Admin-Badge). Aktualisiert sich beim Öffnen des Tabs und nach dem Speichern.

## v1382
- Bulk-Eintragen: Panel „Ergebnisse ausstehend" – Wettkämpfe mit Anmeldungen aus dem Trainingsportal, deren Termin vorbei ist und für die noch kein Ergebnis erfasst wurde. Ein Klick füllt Veranstaltung, Serie, Ort, Datum und je eine Zeile pro angemeldeter Athlet:in/Disziplin vor.
- Neuer Endpunkt `GET offene-wettkaempfe` (liest die gemeinsam genutzten `training_wettkampf_*`-Tabellen)

## v1381
- Aktivste Athleten: Jahreszahl-Hinweis jetzt immer anzeigen (auch 5 J.)

## v1380
- Aktivste Athleten: Ranking-Fix – Floating-Point-Vergleich auf Integer×10 umgestellt; weniger aktive Jahre bei gleichem Ø korrekt vor mehr Jahren

## v1379
- Aktivste Athleten: Olympisches Ranking – Gleichstand zeigt gleiche Platznummer, kein Platz für gebundene Folgeeinträge

## v1378
- Aktivste Athleten: Ø basiert auf tatsächlich aktiven Jahren (nicht immer ÷5); Ranking nach Ø; Jahreszahl-Hinweis bei <5 aktiven Jahren

## v1377
- Aktivste Athleten: Platzierung (1., 2., ...) vor dem Namen

## v1376
- Athleten: "Aktivste Athleten der letzten 5 Jahre" – aggregiertes Ranking statt Jahres-Split; Ø Wettkämpfe pro Jahr; mind. 2 Wettkämpfe

## v1375
- Aktivste Athleten pro Jahr: kein Top-N-Limit mehr, Mindest-Filter ≥2 Wettkämpfe; externe Ergebnisse ausgeschlossen (e.extern=0)

## v1374
- Fix RaceResult: Zeitfelder `BruttozeitMitStatus`/`NettozeitMitStatus` wurden als Platz-Feld fehlerkannt (`zeit` nicht an Position 0 wegen Präfix) → landeten im `mitstatus`-Zweig → `iZeit=-1` → alle Zeilen ohne Zeit gefiltert → 0 Treffer. Zeit-Erkennung jetzt `indexOf('zeit')>=0` (statt `===0`) in allen 5 Kalibrierungs-Blöcken. Behebt Hennefer Europalauf (TuS-Athleten wie Maren Klinkenberg/Guido Wender wurden nicht gefunden)

## v1373
- Athleten-Seite: Neuer Abschnitt „Aktivste Athleten pro Jahr" – Balkendiagramm (Top 10 je Jahr, letzte 6 Jahre) aus API-Endpunkt `athleten-wettkampfe-pro-jahr`

## v1372
- RaceResult White-Label-Domains importierbar (z.B. `portal.run-timing.de/977/results`): Frontend erkennt das RR-Muster (`/{id}/results` bzw. Hash `#N_HEX`) und lässt die echte RaceResult-Event-ID serverseitig aus dem `RRPublish(...)`-Aufruf auflösen
- Fix: `rr-fetch?proxy_url=`-Regex im Backend erkannte `RRPublish(document.getElementById(...), ID, ...)` nicht (geschachtelte Klammer brach `[^,)]+` ab) → jetzt `[^;]*?`

## v1371
- Feature: Alternative Athleten-Namen (Namensänderungen, Schreibweisen) – Admin → Athleten → Bearbeiten; werden in allen Bulk-Import-Matchern berücksichtigt

## v1370
- Fix: „Letzte Aktivität" in Athleten-Tabelle berücksichtigt nur eigene Vereinsergebnisse (extern=0), keine fremden Vereinsergebnisse mehr

## v1369
- MikaTiming: alternativer Vereinsname externer Teilnehmer wird jetzt ins „Verein"-Feld übernommen (`mikaExtractRowsForBulk` gibt `verein` zurück) — z.B. Thorsten Peil „Volksbank im Rheinland"

## v1368
- MikaTiming: Namens-Suche stark entlastet — schlanker Backend-Pfad postet direkt an die (vom Frontend übergebenen) echten Events, ohne pro Name die 39-KB-Hauptseite zu laden. Der Such-POST braucht keinen Session-Cookie. Behebt das Rate-Limit (vorher ~2900 Requests/Import → einzelne Namens-Suchen wie „Peil" scheiterten still → externer Teilnehmer Thorsten Peil fehlte)
- MikaTiming: contest-ID der Namens-Treffer wird im Frontend via dynContest gemappt (z.B. „5" → „5km")

## v1367
- MikaTiming Debug: Roh-Namen werden jetzt immer angezeigt (vorher nur bei 0 Treffern) mit Match-Status (✓/✗) und Verein — Diagnose für fehlende externe Teilnehmer (z.B. Thorsten Peil unter Firmenteam)

## v1366
- MikaTiming: dynContest war leer bei numerischen Event-IDs — Off-by-one in der `$opAll`-Array-Struktur (Keys lagen auf Index 0/1 statt 1/2, wodurch `$val`/`$txt` vertauscht waren und der km-Match nie griff). Jetzt korrekt `[0]=Voll, [1]=Wert, [2]=Label`. Disziplin (`10km`/`5km`/`3km`) wird endlich gemappt (Citylauf Erkelenz).

## v1365
- MikaTiming: Disziplin-Matching bei numerischen Event-IDs gefixt — `array_merge` nummerierte die numerischen contestMap-Keys (10/5/3) neu, wodurch `contest` nicht von `"10"` → `"10km"` umgeschrieben wurde und die Disziplin leer blieb (Citylauf Erkelenz). Jetzt Union-Operator (`+`), der Keys erhält. Betrifft new- und old-Interface-Pfad.
- MikaTiming Debug: `eventOptions` + `dynContest` wieder sichtbar (wurden vom `$debug`-Reset überschrieben)

## v1364
- MikaTiming: Event-IDs jetzt direkt aus `<select name="event">` gelesen — erfasst auch rein numerische IDs wie `5`/`10`/`3` (Citylauf Erkelenz: 5km/10km-Läufe wurden komplett übersehen, weil die alte Regex einen Buchstaben am Anfang verlangte → Vereinssuche fand 0 obwohl 8 TuS-Oedt-Läufer in 5km/10km starteten)
- MikaTiming: contestMap (`dynContest`) ebenfalls aus `<select name="event">` → numerische Events erhalten korrekten Namen (`10`→`10km` usw.)

## v1363
- MikaTiming Debug: Roh-Namen zeigen jetzt zusätzlich das Vereinsfeld `[Verein]` (Diagnose ob Namens-Treffer wirklich TuS-Oedt-Mitglieder sind, Citylauf Erkelenz)

## v1362
- MikaTiming: Kurzname-Fallback bei 0 Treffern — wenn "TuS Oedt" keinen Treffer gibt, nochmal mit letztem Nicht-Abkürzungs-Wort suchen (z.B. "Oedt")
- MikaTiming Debug: Roh-Namen bei Namens-Treffer=0 anzeigen (welche Namen gefunden aber nicht gematcht wurden)

## v1361
- Fix RaceResult: echte Listennamen aus `TabConfig.Lists` (`/results/config`) lesen – das Top-Level `lists` kann veraltete interne Namen liefern (z.B. "Online|Final" statt fetchbarem "Online|Online Ergebnisse" beim Fründe-Lauf → vorher 0 Treffer trotz vorhandener Ergebnisse)

## v1360
- Fix RaceResult: Pipe-Zeichen im Listennamen nicht URL-encodieren ("Online|Final" statt "Online%7CFinal"); Fallback auf Teil nach letztem Pipe ("Final") für contest-spezifische Versuche

## v1359
- Fix RaceResult: wenn contest=0 → HTTP 404, werden jetzt alle spezifischen Contest-IDs einzeln versucht (Events mit einer kombinierten Liste für mehrere Läufe, z.B. Fründe-Lauf "Online|Final")

## v1358
- Debug: RaceResult Objekt-listSource wird im Debug-Log angezeigt; Contest-ID wird jetzt aus dem Wert gelesen (statt immer '0') – Diagnose Fründe-Lauf "Online|Final"

## v1357
- Debug: RaceResult-Listen die keinen Payload liefern zeigen jetzt Grund im Debug-Log (search/all Fehlercode, HTTP-Status, Exception)

## v1356
- Fix RaceResult: Disziplin-Erkennung für "5er"-Schreibweise (z.B. "Speira-Jedermann 5er" → "5km") – `\b(\d+)er\b` wird in `rrBestDisz` zu `N km` normalisiert

## v1355
- Shared Helper: `DB::insert(table, data)` und `DB::deleteById(table, id, col='id')` – ergänzen die bestehende `DB::updateById()`. Neuer Code kann sie nutzen, bestehende SQL-Statements bleiben unverändert.
- Shared Helper: neue Klasse `Migrations` in `includes/migrate.php` – ersetzt den ~25-LOC-Boilerplate-Migrationsläufer in Planung/Training durch `Migrations::run(versionKey, [num=>stmts])`. Unterstützt SQL-Listen und Closures, mit eingebautem static-done-Guard pro Versionskey.

## v1354
- Modernisierung (PHP 8): `strpos(...) !== false` → `str_contains(...)` und `strpos(...) === 0` → `str_starts_with(...)` an 14 Stellen in `api/index.php`. Identisches Verhalten, lesbarer.

## v1353
- Refactor: `includes/db.php` lädt `config.php` nur noch, wenn `DB_NAME` nicht bereits gesetzt ist – ermöglicht den Stub-Mechanismus in Login/Planung/Training
- Refactor: `favicon.php` auto-detektiert `STATISTIKPORTAL_PATH` (falls definiert) oder fällt auf `__DIR__` zurück – damit byteweise identisch in allen vier Portalen
- `htdocs/js/Statistikportal.code-workspace` ins Repo-Root verschoben (gehörte nicht in den Deploy)

## v1352
- Fix: RaceResult-Import erkennt `ZeitMitStatus`-Felder jetzt korrekt als Zeitfeld – alle Felder die mit `zeit` beginnen werden vor dem `mitstatus`-Check geprüft (verhinderte 0 Treffer bei TV Schwafheim / Volkslauf 2026)

## v1351
- Debug: RaceResult Extern-Suche zeigt DataFields + iName/iFirstname/iClub-Indices + erste Roh-Namen wenn 0 Einträge gefunden – erleichtert Diagnose bei fehlendem Vorname-Feld

## v1350
- Feature: Orga-Flag für Athleten – kennzeichnet inaktive Mitglieder, die in der Organisation mithelfen (z.B. Sportfest-Planung); Badge 🧩 Orga in Athleten-Tabelle; Toggle-Button und Checkbox im Bearbeiten-Modal

## v1347
- favicon.ico via .htaccess auf favicon.php?size=32 umgeleitet; ICO-Link aus index.html entfernt
- Favicon: dynamisches `favicon.php` (identische Logik wie Trainingsportal/Planungstool) ersetzt statische `favicon.svg`/`apple-touch-icon.png`; Fallback-Buchstabe aus `login_portal_apps`
- Menü-Buttons (Haupt-Navigation + Mobile-Drawer) ohne Icons – einheitliche reine Text-Darstellung wie im Trainingsportal

## v1345
- Admin/Benutzer: Rollen-Dropdown (Anlegen + Bearbeiten) zeigt jetzt alle definierten Rollen aus der `rollen`-Tabelle – inkl. Trainingsportal-Rollen wie „Trainer*in“ – statt nur leser/athlet/editor/admin

## v1344
- Meine Veranstaltungen: Disziplin-Spalte sortiert nach Distanz (km) statt alphabetisch; gleiche Distanz → alphabetischer Fallback

## v1343
- Meine Veranstaltungen: Ergebnis-Sortierung korrigiert (NULL→Infinity, nicht→0); Pace als sortierbare Spalte; pace_num (Sekunden/km) in Zeilendaten

## v1342
- Fix: API /disziplinen liefert jetzt dm.distanz mit – diszKm() konnte distanz nie finden weil das Feld fehlte

## v1341
- diszKm/calcPace: Regex-Parsing des Disziplinnamens entfernt – Distanz kommt ausschließlich aus state.disziplinen[].distanz (lookup per mapping_id bevorzugt, Fallback per Name); alle Aufrufer übergeben jetzt disziplin_mapping_id

## v1340
- Fix: Pace für Bahn-Disziplinen mit deutschem Tausendertrennpunkt (z.B. „5.000m", „10.000m") wird jetzt korrekt berechnet – _parseDiszNum erkennt X.XXX als Tausender, nicht als Dezimalzahl

## v1339
- Fix: RaceResult Post-Dedup entfernt TuS-Eintrag eines Athleten jetzt nur noch wenn ein Extern-Eintrag mit **identischer Zeit** existiert – Athleten die TuS-intern UND extern verschiedene Strecken laufen (z.B. Gottschalk: 10km TuS + 5km extern) werden jetzt beide angezeigt

## v1338
- Fix: RaceResult-Import erkennt separates FIRSTNAME/VORNAME-Feld und kombiniert es mit LASTNAME zu „Nachname, Vorname" – Events ohne kombiniertes FLNAME-Feld (z.B. 8. Ra(h)ser-Run) zeigen jetzt vollständige Namen

## v1337
- Bulk-Bearbeitung: Feld „Verein" ergänzt; API-PUT-Handler akzeptiert jetzt verein-Feld für Ergebnisse

## v1336
- Meine Veranstaltungen: Verein-Filterdropdown (erscheint nur wenn mind. 2 verschiedene Vereine vorhanden); leerer Verein wird als eigener Vereinsname behandelt

## v1335
- Meine Veranstaltungen: Bulk-Edit-Modal – Felder einzeln per Checkbox aktivierbar (Disziplin, AK, Pl. AK, Meisterschaft, Pl. MS); nur aktivierte Felder werden auf alle ausgewählten Ergebnisse angewendet

## v1334
- Meine Veranstaltungen: Zähler außerhalb Panel; Edit-Button pro Zeile (Modal mit Disziplin/Ergebnis/AK/Platz/Meisterschaft, Athleten-Rolle stellt Änderungsantrag); Bulk-Select+Löschen; leerer Verein zeigt eigenen Vereinsnamen; gleicher Fallback in Meine Teilnahmen (Serie-Detail); API liefert tbl_key für Ergebnisse

## v1333
- Meine Veranstaltungen: Spalte „Verein" eingeblendet wenn mind. ein Ergebnis einen Vereinsnamen trägt; Meisterschaft/Pl.MS nur bei vorhandenen Werten; API liefert e.verein

## v1332
- Meine Teilnahmen: Abschnitt (Überschrift + Tabelle) wird nur angezeigt, wenn eigene Ergebnisse vorhanden

## v1331
- Meine Teilnahmen (Serie-Detail): Zähler mit mehr Rand (außerhalb Tabelle im Panel); Meisterschaft/Pl.MS-Spalten nur bei vorhandenen Werten; Verein-Spalte nur bei externen Ergebnissen; API liefert e.verein für externe Ergebnisse

## v1330
- Serie-Detail: neuer Abschnitt „Meine Teilnahmen" (nur für eingeloggte Nutzer mit Athletenprofil) zeigt eigene Ergebnisse der Veranstaltungsreihe als Tabelle mit Datum, Disziplin, AK, Ergebnis, Pace, Platzierungen

## v1329
- Meine Veranstaltungen: einzelne Tabelle statt Panels; sortierbar (Datum, Veranstaltung, Disziplin, AK, Ergebnis, Pl. AK); filterbar nach Freitext, Jahr und Disziplin; API liefert jetzt resultat_num für korrekte numerische Sortierung

## v1328
- Veranstaltungen → Regelmäßige Veranstaltungen: Serien mit 0 Austragungen ausgeblendet

## v1327
- Veranstaltungen: Sub-Tab-Navigation mit „Regelmäßige Veranstaltungen", „Letzte Veranstaltungen" und „Meine Veranstaltungen"; neuer API-Endpoint meine-veranstaltungen liefert alle Wettkämpfe des eingeloggten Athleten mit Ergebnissen und Platzierungen

## v1326
- Athleten-Karten: Mobile Breakpoints korrigiert (!important gegen Inline-Style-Spezifität)

## v1325
- Fix: athlet/index.php robusteres Fehler-Handling (DB-Fehler, fehlende geloescht_am-Spalte, Settings-Fehler → alle im globalen try-catch; kein PHP-Absturz mehr)

## v1324
- Fix: `/athlet/slug` landete auf Startseite – statt .htaccess-Rewrite jetzt echtes Verzeichnis `athlet/` mit eigenem `.htaccess` + `index.php` (liest Slug aus REQUEST_URI, kein mod_rewrite im Root nötig)

## v1323
- Athlet-Profil-Link: `athlet.php` mit korrekten Open-Graph-Tags (og:title, og:description) für WhatsApp/Telegram/Twitter-Vorschau; `.htaccess`-Rewrite für `/athlet/slug`; kopierter Link nutzt Pfad-URL statt Hash

## v1322
- Fix: Athlet-Vollseite per Direktlink (#athlet/slug) konnte Athlet nicht finden – API-Suche trifft name_nv-Format nicht; jetzt alle Athleten laden und client-seitig per Slug abgleichen

## v1321
- Athletenprofil: Vollseiten-Ansicht mit Share-Button und kopierbarem Direktlink (`#athlet/vorname-nachname`); Seitentitel „Verein – Statistik – Vorname Nachname"; öffentlich aufrufbar ohne Login

## v1320
- API: Veranstaltungen-Endpoint extern-Ergebnisse wurden doppelt geliefert (vereinErg-Query fehlte extern=0-Filter)

## v1319
- RaceResult-Import: Athlet intern+extern doppelt gefunden → Duplikat entfernen, Extern-Eintrag gewinnt

## v1318
- RaceResult-Import: Bindestriche in Disziplin-Erkennung normalisieren ("5-km-Lauf" → "5km" wird jetzt korrekt erkannt)

## v1317
- RaceResult-Import: Listenname (le.name) als zusätzlicher Disziplin-Kandidat (behebt "(keine)" wenn Distanz im Listennamen statt Contestnamen steht)
- RaceResult-Import: Debug-Log zeigt jetzt cnD-Quelle + erkannte Disziplin für ersten Treffer pro Liste

## v1316
- Neue Berechtigung `trainingsplan_bearbeiten` für Trainer-Rolle (Trainingsportal): Trainingspläne erstellen und ändern

## v1315
- Docs: Claude-Workflow um Auto-Merge + PR-Monitoring erweitert (CLAUDE.md)

## v1314
- Neue Systemrolle „Trainer": gleiche Rechte wie Athlet im Statistikportal, für Trainingsportal-Erweiterungen vorbereitet (isTrainer(), ENUM-Migration, Rollen-Manager)

## v1313
- Fix: Bestleistungen-Seite zeigt keine externen Ergebnisse mehr (extern=1 aus rekorde-Endpunkt gefiltert)

## v1312
- Athletenprofil: „Externes Ergebnis bearbeiten"-Modal verwendet jetzt Veranstaltungs-Picker statt Freitext-Felder (Datum/Wettkampf); Veranstaltung ist Pflichtfeld

## v1311
- Admin Veranstaltungen: Neue Veranstaltung anlegen (Button im Panel-Header, POST /veranstaltungen in API)

## v1310
- Fix: Externe Ergebnisse (extern=1) erscheinen nicht mehr in Timeline, Bestleistungen, Vereinsrekorden, Hall of Fame, Meisterschaftstiteln und Serien-Ranglisten

## v1309
- Externe Ergebnisse: strukturell in `ergebnisse`-Tabelle vereint (neues Feld `extern=1`), Datenmigration aus `athlet_pb` automatisch beim ersten Start
- Externe Ergebnisse erfordern zwingend eine Veranstaltung – Freitext `wettkampf` entfällt
- Edit-Modal externe Ergebnisse: Veranstaltung ist Pflichtfeld, Lösch-Button für Veranstaltungsbezug entfernt
- Vereinsname-Feld (`verein`) für externe Ergebnisse bleibt erhalten
- Soft-Delete für externe Ergebnisse (wie interne)
- Bestleistungen-Timeline: vereinfachte Abfrage ohne UNION

## v1308
- Fix: RaceResult-Import entfernt Jahrgang in Klammern am Namensende (z.B. „Schulte, Julius (2001)") – verhindert Duplikate wenn dieselbe Person in Ziel- und Altersklassenliste unterschiedlich formatiert ist

## v1307
- Bulk-Eintragen: „Unbekannte Altersklassen"-Dialog – Default-Auswahl von „DLV-AK zuordnen" auf „So übernehmen" geändert

## v1306
- Bulk-Eintragen: „Laufserie erkannt"-Dialog entfernt – mehrere Ergebnisse pro Athlet/Disziplin in einer Veranstaltung sind normal und kein Indiz für eine Laufserie

## v1305
- Fix: RaceResult-Import übernimmt Disziplin beim Dedup-Treffer wenn bisher leer – Läufer aus Allgemein-Gesamtliste (ohne Distanz) bekommen nachträglich die Disziplin aus der distanzspezifischen Liste (z.B. „10 km DeBeukelaer Hauptlauf A")

## v1304
- Fix: `_cleanEventName` schneidet Namen mit Bindestrich (z.B. „Griesson-de Beukelaer-Altstadtlauf") nicht mehr vorzeitig ab – einfache Städtenamen (nur Kleinbuchstaben, kein Bindestrich) werden korrekt erkannt

## v1303
- Fix: Bulk-Import ersetzt jetzt alle bestehenden Zeilen statt sie zu ergänzen – verhindert Verdoppelung bei erneutem Import

## v1302
- Revert v1301: Name-Dedup in Extern-Suche entfernt – dieselbe Person kann legitim mehrere Distanzen haben (z.B. 5km + 10km)

## v1301
- Fix: RaceResult-Extern-Suche dedupliziert jetzt nach Name (nicht Name+Zeit) – verhindert, dass dieselbe Person für mehrere Distanzen doppelt auftaucht

## v1300
- Fix: RaceResult-Import „Auch inaktive Athleten"-Schalter löst jetzt auch Extern-Suche aus wenn bereits TuS-Einträge gefunden wurden (z.B. Daniel Weyers unter ASV Süchteln)

## v1299
- Fix: RaceResult-Import erkennt Zeitfeld aus RaceResult-Formel-Ausdrücken (z.B. choose([STATUS]+1;[TIMETEXT1];…)) – ältere Events (z.B. 2018) wurden mit 0 Treffern abgebrochen

## v1298
- Debug: RaceResult-Import zeigt DataFields + erste Row der ersten Liste (Diagnose 2018-Event)

## v1297
- Debug: RaceResult-Import zeigt pro Liste payload-Infos + Rohdaten bei 0 Rows (Diagnose ältere Events)

## v1296
- Veranstaltungen: "Teilnehmer*innen" → "Teilnehmende"

## v1295
- Seltec PDF: AK-Header über mehrere Zeilen gebrochen werden zusammengefügt (z.B. "weibliche Jugend U18 -\nZeitläufe" → WU18)
- Seltec PDF: Feldwettkämpfe (Weitsprung etc.) als Hauptsektion erkannt (Komma-Regel statt Ziffernanfang)
- Seltec PDF: Disziplin-Normalisierung "1500m" ↔ "1.500m" für DB-Tausenderpunkt

## v1294
- Seltec PDF: Format 2018 unterstützt (Datum:/Beginn:-Zeile, AK-Unter-Sektionen "X – Zeitläufe", opt. Nationalität, Wind-Suffix bei Feldwettkämpfen)

## v1293
- Seltec PDF: Hauptdatum wird jetzt immer aus der PDF gesetzt (nicht vom vorausgefüllten Tagesdatum blockiert)

## v1292
- Seltec PDF: Event-Name, Datum, Ort und leere Disziplinen gefixt (Safari/PDF.js y-Gruppen-Problem); AK aus Sub-Sektionen extrahiert

## v1291
- Bulk-Eintragen: Seltec/Track&Field PDF per Drag &amp; Drop auf das Eingabefeld importieren (PDF.js, filtert auf eigenen Verein); Safari-Fix für dragover

## v1290
- Fix: leichtathletik.de-Import verwendet bei Sprint-Läufen mit Vorläufen jetzt den Gesamtplatz (col-1) statt den Laufplatz "6./IV" (col-6); col-6 bleibt Fallback für Masters-AK-Plätze

## v1289
- MikaTiming: Debug-Snippets für Datumsdiagnose entfernt (nicht benötigt)

## v1288
- MikaTiming: Netto-Zeit korrekt importiert — alle type-time Elemente durchlaufen, "Netto"-Label bevorzugen, sonst letzte Zeit (Brutto zuerst, Netto zuletzt bei MikaTiming)
- MikaTiming: list-field-Loop ignoriert "Brutto"/"Zeit"-Label beim Zeitimport

## v1287
- MikaTiming: Datum-Extraktion erweitert um `<time datetime>`, `<meta content>`, Wochentag-Prefix ("Sonntag, 10. Mai 2026") und ISO-Fallback (`\bYYYY-MM-DD\b`)
- MikaTiming Debug: `listGet_date_snippet` zeigt ersten 800 Zeichen des listGet-HTML zur Datumsdiagnose

## v1286
- MikaTiming GET-Listings: Position-basierter Platz-Parser (1. type-place = Gesamt, 2. = AK) — Duisburg-Format
- MikaTiming GET-Listings: iteriert alle `list-field`-Elemente und klassifiziert per Label oder Inhalts-Muster (Zeit/AK/Verein)
- MikaTiming: Datums-Fallback aus listGet-HTML wenn mainHtml kein Datum hat
- MikaTiming Debug: LI-Dump verlängert auf 4000 Zeichen

## v1285
- MikaTiming: mainHtml-Fetch mit Retry (bis zu 3× bei leerer/zu kleiner Antwort) — verhindert dass eventName/Ort/Datum verloren gehen
- MikaTiming OLD-Interface: DNS-Filter im Hauptlist-Parser (Daams wurde durchgelassen, jetzt geblockt)
- MikaTiming OLD-Interface: AK-Text-Bereinigung (`MM45` → `M45`) via Regex auf `[MW]\d{2,3}`

## v1284
- MikaTiming GET-Listings: Plaintext-Fallbacks für Zeit/AK/Platz AK/Verein, wenn die typed-Klassen (`type-time`, `type-field`) fehlen
- MikaTiming Debug: erste LI wird vollständig gedumped (`listGet_firstLi_html`/`classes`/`text`) zur Diagnose der Struktur

## v1283
- MikaTiming: Event-ID-Extraktion vereinfacht (nutzt jetzt zuverlässig die gleiche Regex wie `allOptionValues`) — `M` (Marathon) wird jetzt erkannt
- MikaTiming: GET-Listings-URL ohne `lang`/`num_results` (exakt wie Form-Submit der Webseite)
- MikaTiming Debug: `listGet_sample_*` zeigt Struktur der Antwort (Table/List-Group/Idp-Treffer) zur Diagnose

## v1282
- MikaTiming Bulk-Import: Namens-Suche nur noch als Fallback (wenn Vereins-Suche 0 Treffer); neue Checkbox „Namens-Suche erzwingen" zum manuellen Aktivieren — spart ~80 API-Calls und verhindert Rate-Limit-403

## v1281
- MikaTiming: Anzahl Event-IDs limitiert (20→8) und GET-Listings auf 6 Events beschränkt, um Rate-Limit-403 zu vermeiden

## v1280
- MikaTiming: GET-Listings-URL nutzt `pid=search` (statt `pid=list&pidp=ranking`) — entspricht exakt der vom Browser nach Form-Submit verwendeten URL
- MikaTiming: Event-ID-Extraktion robuster (auch single-letter wie `M` für Marathon); Limit von 16 → 20
- MikaTiming Debug: `allOptionValues` (alle option-values aus mainHtml) zur Event-ID-Diagnose

## v1279
- MikaTiming: GET-Listings-URL (`pid=list&pidp=ranking`) als primärer Pfad für Vereins-Suche (wie echte Webseite); parsed sowohl list-group-items als auch Tabellen-Zeilen
- MikaTiming Debug: `listGet_*`-Felder pro Event zur Diagnose

## v1278
- MikaTiming: Pagination-Limit erhöht (num_results=1000, mehrere Feldnamen-Varianten); DNS-Filter im Event-Loop-Fallback ergänzt
- MikaTiming Debug: `formTopFields` listet auch Nicht-`search[]`-Form-Felder (Anzahl Ergebnisse etc.)

## v1277
- MikaTiming: DNS-Filter jetzt auch im alten Interface (Daams kam dort durch)
- MikaTiming Debug: `apiVersion`-Marker und `formSearchFields` werden korrekt gesetzt (waren zuvor durch `$debug = [...]`-Reset überschrieben)

## v1276
- MikaTiming: Wildcards für nation/sex/age_class beim Form-POST (komplette Ergebnislisten)
- MikaTiming Bulk-Import: Checkbox „Auch inaktive Athleten" wirkt jetzt auch auf die Namens-Suche (vorher wurden alle Nachnamen gesucht)
- MikaTiming Debug: API-Version-Marker `apiVersion` zur OPcache-Diagnose

## v1275
- MikaTiming Debug: erweiterter Feldnamen-Regex + HTML-Dump um Verein-Label (Feldnamen-Erkennung)

## v1274
- MikaTiming Debug: extrahiert alle `search[*]`-Feldnamen aus dem Formular (Diagnose Verein-vs-Team-Feld)

## v1273
- MikaTiming: DNS-Filter über fehlende Platzierung+Zeit (statt Textsuche „DNS"); erkennt Em-Dash-Anzeige
- MikaTiming Debug: zeigt für nicht-gematchte Roh-Treffer die rohen MikaTiming-Namen (max. 3 pro Suchbegriff)

## v1272
- MikaTiming: DNS/DNF/DQ-Einträge werden serverseitig herausgefiltert (type-time-Feld)
- MikaTiming Debug: zeigt welche Athleten-Namen Roh-Treffer hatten (Diagnose fehlender Athleten)

## v1271
- „Teilnehmer*innen"/„Teilnehmer*in" → „Teilnehmenden"/„Teilnehmende" (2 Stellen in Veranstaltungs-Detailansicht)

## v1270
- Bulk-Eintragen: Seltec/Track&Field PDF per Drag &amp; Drop auf das Eingabefeld importieren (PDF.js, filtert auf eigenen Verein)

## v1269
- Admin Veranstaltungen: Bulk-Ort-Edit verwendet identischen ortePickerHtml-Picker wie Einzeledit (Autocomplete aus Orte-Tabelle, inkl. ort_id)

## v1268
- Veranstaltung bearbeiten: Ort ist jetzt Pflichtfeld (muss aus Orte-Tabelle gewählt werden, kein Freitext-Fallback mehr)

## v1267
- Admin Veranstaltungen: Bulk-Ort-Edit zeigt Auswahlliste statt Freitext; Filterfeld über der Liste

## v1266
- Fix: leichtathletik.de-Import erkennt "5km" jetzt korrekt als "5.000m Bahn" (diszList auf gewählte Importkategorie eingeschränkt, verhindert Exact-Match auf falsche Kategorie)

## v1265
- Fix: Karte bei regelmäßigen Veranstaltungen nicht verschiebbar/zoombar; Karte überlagert Header beim Scrollen nicht mehr

## v1264
- Fix: RaceResult-Import erkennt Namens-Spalte "FLNAME" (RaceResult-Standard-Feldname für Vollständigen Namen); alle 4 Kalibrierungs-Stellen vereinheitlicht

## v1262
- Bulk-Eintragen: Ort-Feld als Autocomplete gegen Admin-Orte-Liste (Auswahl setzt ort_id, „Neuer Ort"-Option, API speichert ort_id bei Veranstaltungsanlage)
- Bulk-Eintragen: Serie-Autoerkennung jetzt auch bei RaceResult-, Leichtathletik.de-, ACN- und Text-Paste-Import (war nur MikaTiming + Uitslagen)
- Bulk-Eintragen: Ort aus Importer-Daten setzt ebenfalls ort_id wenn Ort-Name in Orte-Liste gefunden

## v1261
- Papierkorb-Symbol: noch fehlende Stellen in Benutzer, Orte, Athleten (Athlet löschen + PB-Löschen) nachgezogen

## v1260
- Fix: RaceResult-Import erkennt Namens-Spalte jetzt auch bei DataFields "Name", "Lastname", "Nachname", "Surname" (vorher: iName blieb auf Default-Index 3 → Zeit oder Platz als Name)

## v1259
- Fix: Ort-Spalte in Serien-Tabelle fehlte – Datenquelle war GET /veranstaltungen (nicht /veranstaltung-serien), dort ort_letzte/ort_land_code ergänzt

## v1258
- Lösch-Buttons: X-Symbol durch Papierkorb-Symbol (🗑️) ersetzt; Modal-Close-Buttons und Status-Badges unverändert

## v1257
- Regelmäßige Veranstaltungen: neue Spalte „Ort" (Flagge + Name aus letzter Austragung der Serie)
- Serien-Detailseite: Ort-Zeile mit Flagge im Info-Panel + schreibgeschützte Leaflet-Karte mit Pin

## v1256
- Fix: „Veranstaltung bearbeiten" auf der Detailseite öffnete kein Modal – `state._veranstMap` wurde dort nicht befüllt; jetzt zusätzlich defensiver Fallback (apiGet bei Cache-Miss)

## v1255
- Orte-Modal: Leaflet-Kartenausschnitt mit Pin – Pin per Drag verschiebbar, Klick auf Karte setzt neuen Pin, Lat/Lon-Felder sind synchron

## v1254
- Admin Orte: Button „🌍 Alle anreichern" – ruft für jeden Ort ohne Koordinaten Nominatim auf (1 req/s gemäß OSM-Richtlinie), Fortschrittsanzeige + Live-Log + abbrechbar

## v1253
- Fix: GET orte/nominatim landete fälschlich im GET orte/{id}-Handler („Ort nicht gefunden") – ID-Match nur noch für numerische IDs

## v1252
- Orte-Modale: Klick außerhalb schließt nicht mehr (noClose=true)
- Nominatim-Fehler: detaillierte Server-Meldung wird jetzt im Dropdown angezeigt
- Veranstaltungs-Edit-Modal: Klick außerhalb schließt nicht mehr

## v1251
- Orte/Nominatim-Proxy: cURL statt file_get_contents (kompatibler mit Shared Hosting), detaillierte Fehlermeldung bei Fehlschlag

## v1250
- Neuer Admin-Tab „Orte": zentrale Verwaltung mit OpenStreetMap/Nominatim-Anbindung (Flagge, Land, Koordinaten); Veranstaltungs-Edit nutzt Ort-Picker statt Freitext; Veranstaltungslisten zeigen Länderflagge
## v1249
- Disziplin + Kategorie (z.B. „3.000m (Bahn)"): kein Zeilenumbruch mehr dazwischen

## v1248
- Fix: showModal() – fehlende `overlayClick`-Variable führte zu ReferenceError bei jedem Modal-Aufruf (alle Buttons kaputt)

## v1247
- Admin Veranstaltungen: Aktions-Spalte von 5% auf 10% vergrößert; Name auf 42%; overflow:hidden auf Aktions-td

## v1246
- Admin Veranstaltungen: Name-Spalte fix 44% mit text-overflow:ellipsis; table-layout:fixed; border-collapse:collapse

## v1245
- Athleten-Karten: „Letztes Ergebnis" nur bei inaktiven Athleten anzeigen

## v1244
- Athleten-Karten: Sektion „Inaktive Athleten" umbenannt in „Inaktive Athleten mit bestehenden Bestleistungen"
- Athleten-Karten: „Letztes Ergebnis: JJJJ" unter den Stats anzeigen

## v1243
- Admin Veranstaltungen: Colgroup-Breiten reduziert; Ort/Serie overflow:hidden; Paginierung-Bar Padding

## v1242
- Admin Veranstaltungen: Paginierung (50 pro Seite, Vor/Zurück + Seitenauswahl)

## v1241
- Admin Veranstaltungen: Delete-Button onclick quot fix (&quot; statt \\"); Edit-Modal _vaDec; Colgroup px statt %

## v1240
- Admin Veranstaltungen: HTML-Entities in Seriennamen dekodieren; &quot; im Delete-Button bricht onclick nicht mehr

## v1239
- Veranstaltungen: Serien-Tabelle im Panel-/Box-Design (wie Admin-Bereich); Spaltenköpfe mit farbigen Sortierpfeilen; „+ Neue"-Button im Panel-Header für Admin/Editor

## v1238
- Admin Veranstaltungen: table-layout:fixed + colgroup-Breiten → Name kürzt korrekt, Tabelle läuft nicht mehr über

## v1237
- Admin Veranstaltungen: Name-Spalte kürzt mit Ellipsis (kein Rechts-Abschneiden); doppeltes HTML-Escaping (&amp;amp;) behoben

## v1236
- Admin Veranstaltungen: Serien-Symbol auf 🔄 angeglichen; Serie als eigene sortierbare Spalte

## v1235
- Admin Veranstaltungen: Serien-Zugehörigkeit als Tag unter dem Namen; Bulk-Aktion „Serie" (bestehend zuweisen, neue anlegen, entfernen)

## v1234
- Admin Veranstaltungen: Startnummer-Eingabefeld an Modal-Optik angepasst (form-group)

## v1233
- Fix: Admin Veranstaltungen – athlet_pb hat kein geloescht_am (Hard-Delete), JOIN-Bedingung entfernt

## v1232
- Admin Veranstaltungen: Bulk-Name – Option „Durchnumerieren" (Startnummer + Sortierung alt→neu)

## v1231
- Admin Veranstaltungen: Externe Ergebnisse (athlet_pb) separat zählen und als +N-Badge anzeigen

## v1230
- Admin Veranstaltungen: Kürzel nicht mehr in der Liste anzeigen (nur noch Fallback wenn kein Name)

## v1229
- Admin Veranstaltungen: Fix Bulk-Ort-Umbenennung (leerer Wert wurde als null gesendet → PHP isset() schlug fehl); Fehlernotification bei API-Fehler; klarere Meldung bei Keine-Änderungen

## v1228
- Admin Veranstaltungen: Bulk-Bar „Ort" – Ort für ausgewählte Einträge per Suchen & Ersetzen (mit Wildcard) oder direkt setzen

## v1227
- Admin Veranstaltungen: Wildcard-Suche in Filter und Umbenennen (* = beliebig, ? = ein Zeichen)

## v1226
- Admin Veranstaltungen: Fix Namenskonflikt (showVeranstEditModal → _vaEditModal/_vaSave/_vaDelete); Bulk-Bar: Umbenennen (Suchen & Ersetzen im Namen aller ausgewählten Einträge)

## v1225
- Admin: neuer Tab „Veranstaltungen" – Übersicht aller Veranstaltungen inkl. Ergebnisanzahl, Suche, Jahr-/Status-Filter, Sortierung, Editieren, Einzellöschen, Multiselect + Bulk-Genehmigen/Sperren/Löschen

## v1224
- Athletenprofil: Ergebnisanzahl als „(N)" in Disziplin-Beschriftung (wie Kategorien); kein farbiger Border mehr für Favoriten

## v1223
- Athletenprofil: Favorisierte Disziplinen werden zuerst angezeigt (hervorgehoben mit Primärfarbe); Disziplin-Buttons zeigen jetzt die Ergebnisanzahl

## v1222
- Eigenes Ergebnis eintragen: Buttons „Reset" und „Speichern & Neues" ergänzt
- Eigenes Ergebnis eintragen: „Bestehende wählen" nutzt jetzt Filter-Dropdown (wie Bulk-Eintragen)
- Admin → Einstellungen: Prüfen-Toggles für neue Veranstaltungen und eigene Ergebnisse (auto-approve)

## v1221
- Admin → Disziplinen: Button „Anlegen & Nächste" im Neue-Disziplin-Modal

## v1220
- Fix: Distanz-Ableitung aus Namen mit deutschem Tausenderpunkt (z.B. „3.800m" → 3800 statt 3,8)

## v1219
- Admin → Disziplinen: Sortierung der Tabelle per Klick auf Spaltenkopf (Disziplin, Format, Distanz, Ergebnisse); Pfeilindikator zeigt aktive Spalte und Richtung

## v1218
- Admin → Disziplinen: Distanz wird automatisch aus dem Disziplinnamen abgeleitet (z.B. „5km" → 5000, „Halbmarathon" → 21097.5), wenn das Feld noch leer ist; für Sprung/Wurf-Kategorien (fmt=m) ist das Feld gesperrt

## v1217
- Admin → Disziplinen: Distanz-Spalte in Tabelle anzeigen; Distanz-Feld in „Neue Disziplin"-Dialog ergänzt; Bug behoben (Distanz beim Anlegen wurde nie gespeichert)

## v1216
- Admin → Disziplinen: „Aus Hall of Fame ausschließen" als Toggle-Button (🏆) direkt in der Tabellenzeile; bei neuen Disziplinen standardmäßig aktiviert

## v1215
- Veranstaltungen: Regelmäßige Veranstaltungen als sortierbare Tabelle statt Buttons; neuer MMDD-Sortierschlüssel (nächste anstehende Veranstaltung oben); Überschriften „Regelmäßige Veranstaltungen" und „Letzte Veranstaltungen"; API liefert datum_letzte pro Serie

## v1214
- Bestleistungen/Veranstaltungen: „WJg A" und „WJg B" werden korrekt als Frauen-AKs sortiert und eingefärbt (nicht mehr unter den männlichen AKs)

## v1213
- Bestleistungen + Veranstaltungen: Abschnitts-Header „Frauen / Männer" in „Gesamt" umbenannt

## v1212
- Bestleistungen: Fix „Can't find variable: sectionHtml" nach Entfernen der Gesamt-Ansicht

## v1210
- Jährliche Veranstaltungen/Bestleistungen: Ansicht „Gesamt" entfernt; nur noch „Frauen / Männer" und „Nach Altersklasse"

## v1209
- HoF/Athleten: Kein Zeilenumbruch mehr zwischen Zahl und Begriff in der Statistikzeile (z. B. „51 Bestleistungen")

## v1208
- HoF/Athleten: Teile eines Badges werden mit „und" statt „·" verbunden (z. B. „Vereinsrekord und Bestleistung W45 und W55")

## v1207
- HoF/Athleten: „Bestleistung WHK/MHK" wird nicht mehr redundant neben „Vereinsrekord" angezeigt – wird stattdessen mit numerischen AK-Bestleistungen gruppiert (z. B. „Bestleistung WHK, W45 und W55")

## v1206
- Refactor: `modalH2(title)`-Helper in 09_utils.js – 24 wiederholte Modal-Header (`<h2>… <button class="modal-close" onclick="closeModal()">✕</button></h2>`) zentralisiert
- API: `jsonErr()` loggt 5xx-Fehler jetzt via `error_log()` (REQUEST_METHOD + URI + Message) – vorher gingen Server-Fehler ohne Spur unter

## v1205
- Refactor: `finalizeRegistration()`-Helper – TOTP- und E-Mail-2FA-Endpunkte teilen sich jetzt Auto-Freigabe + Mailversand (~50 Zeilen Copy-Paste entfernt)
- Refactor: Ergebnisse-Endpoint nutzt eine einheitliche `$buildWhere`-Closure für Hauptquery und Dropdown-Subqueries (vorher zwei parallele Filter-Implementierungen, die bei Filter-Erweiterungen leicht auseinanderlaufen)
- Cleanup: doppelt definierte `uitsEvenementenDiszFromStrecke` in 07_eintragen.js entfernt – Funktion wird in 13_uitslagen.js definiert (lädt nach 07, überschrieb 07-Variante zur Laufzeit)

## v1204
- Refactor: `DB::updateById()`-Helper – 9 dynamische UPDATEs in api/index.php abstrahiert (Benutzer, Ergebnisse, Athleten, Disziplin-Kategorien/Mapping, Serien, Veranstaltungen, athlet_pb)
- Refactor: `findDiszObj()`-Helper in 09_utils.js – 4 dupliziertes Disziplin-Matching in 07_eintragen.js + 13_uitslagen.js zentralisiert
- Refactor: `sendMail()`-Helper in api/index.php – 12 wiederholte `@mail()`-Aufrufe konsolidiert (gleicher From/Content-Type-Header)
- Doku: veraltete `.claude/CLAUDE.md` (sprach noch von monolithischer app.js, v941) entfernt – Hauptdatei `CLAUDE.md` ist Single Source of Truth

## v1203
- RaceResult-Importer: Extern-Suche nach TuS-Athleten unter anderem Verein (Name-Matching gegen DB, kein Extra-Request – gecachte Listendaten werden erneut durchsucht)

## v1202
- HOF/API: Meisterschaftstitel-Deduplizierung nach (Label + AK + Jahr) – verhindert doppelte Medaillen bei gleichem Meisterschaftstyp in Indoor- und Outdoor-Veranstaltungen desselben Jahres

## v1201
- HOF/API: Fallback WHK/MHK-Bestleistung für Gesamtbestleistung-Inhaber auch dann, wenn ein anderer Athlet das Tier-3-WHK/MHK-Titel hält (z.B. AK NULL bei Vereinsrekord-Inhaber, aber gemappte AK bei anderem Athleten)

## v1200
- HOF/API: Fallback WHK/MHK für Vereinsrekord-Inhaber wenn Tier-3 keine AK-Bestleistung liefert (z.B. bei NULL-Altersklassen in der DB)

## v1199
- HOF/Athleten-Karten: Medaillen-Deduplizierung aufgehoben – jeder Titel erscheint als einzelnes Emoji mit Tooltip (AK + Jahr)
- HOF/Athleten-Karten: Badge zeigt bei Frauen-/Männer-Vereinsrekord auch die zugehörige MHK/WHK-Bestleistung an (war wegen else-if übersprungen)
- Athleten-Karten: Ergebnis-Badge Zeilenabstand nach oben korrigiert (margin-top:6px wenn kein statsHtml)

## v1195
- Athleten-Karten: Ergebnis-Badge jetzt im gleichen Look wie Vereinsrekord/Bestleistung (grün mit Border, badge-pb)
- Athleten-Karten: nur Athleten mit ≥1 Ergebnis anzeigen; Aufteilung in „Aktive Athleten" (Ergebnis in diesem/letztem Jahr) und „Inaktive Athleten" (älter, aber mit VR/Bestleistung); grünes „X Ergebnisse"-Badge wenn keine Vereinsrekorde oder Bestleistungen vorhanden
- Navigation: "Ergebnisse" und "Athleten" (Tabellen-Verwaltung) in Admin-Bereich verschoben (nur Admins)
- Neue öffentliche Athleten-Seite im Karten-Layout (Hall-of-Fame-Stil, 5 Spalten Desktop), zeigt alle aktiven Mitglieder inkl. Vereinsrekord-/Bestleistungs-Badges
- HOF/Athleten: AK-Bestleistungen werden jetzt auch für Vereinsrekord-Inhaber angezeigt (Tier-3-Unterdrückung entfernt)
- HOF/Athleten: Tier-3-Tracking nutzt SQL-CASE-Expression (inkl. ak_mapping-Kette, z.B. M6→MU8→MHK)
- Deploy: GitHub Actions leert OPcache automatisch nach FTP-Upload
- HOF/Athleten: Jugend-AK-Merge-Konfiguration explizit angewendet — alle konfigurierten AKs (MU18, MU20, …) erscheinen als „Bestleistung MHK/WHK"

---

## v1181
- Bestleistungen: Kategorie-Tabs sortiert nach Ergebnisanzahl absteigend (statt manueller Reihenfolge)
- Admin: Reihenfolge-Feld bei neuer Kategorie entfernt
- Admin: Disziplin-Kategorie-Wechsel verschiebt bestehende Mapping-Row statt neue anzulegen (fix: 0 Ergebnisse nach Kategorie-Umbenennung)

---

## v1180
- Mobile Header: Vereinslogo/-name + Versionsnummer (wenn konfiguriert) + aktiver Seitentitel (außer Dashboard); Burger-Drawer ohne Logo/Name, startet unterhalb des Headers
- Vereinsrekorde: Mobile-optimierte Karten-Ansicht (≤700 px) – Frauen/Männer gestapelt statt nebeneinander in 9-Spalten-Tabelle
- Externe Ergebnisse: Vereinsname (verein) jetzt im Edit-Modal pflegbar und wird korrekt gespeichert
- Externe Ergebnisse: Wettkampf-Freitext entfernt – Veranstaltungsbezug erfolgt ausschließlich über Veranstaltungssuche; API synchronisiert wettkampf-Feld automatisch
- Externe Ergebnisse: API GET gibt jetzt pb.verein zurück; API PUT unterstützt verein-Update
- Fix: Admin → Wartung → Verwaiste Veranstaltungen: Veranstaltungen mit ausschließlich externen Ergebnissen (athlet_pb) werden nicht mehr als verwaist angezeigt
- Vereinsrekorde: Ergebnisformat verwendet jetzt COALESCE(fmt_override, kat.fmt) – disziplinspezifische Formate (z. B. min_h) werden korrekt dargestellt
- Vereinsrekorde: table-layout:fixed für exakt gleiche Frauen/Männer-Breite und Veranstaltungsname-Kürzung per ellipsis
- Dashboard: „Bestleistung Männer/Frauen" und „Gesamtbestleistung [Männer/Frauen]" → „Vereinsrekord ♂/♀" in Timeline-Badges und Hall of Fame
- Admin → Disziplinen: Favorit-Stern direkt in Tabelle integriert; separates Favoriten-Panel entfernt
- Admin → Disziplinen: Sortierung nach Ergebnisanzahl absteigend
- Admin → Disziplinkategorien: Sortierung nach Disziplinenanzahl absteigend
- Admin → Disziplinkategorien: Löschen von Legacy-Kategorien (Sprint, Mittelstrecke) entsperrt; Auto-Seed nur noch bei leerer Tabelle
- Athletenprofil-Modal: „Wettkämpfe" → „Ergebnisse" (mit korrekter Einzahl)
- Dashboard-Widget „mein Athletenprofil": „Wettkämpfe" → „Ergebnisse" (mit korrekter Einzahl)

## v1163

## v1163
- Dashboard: Badge-Vorgängerwerte mit „war" kennzeichnen (war 2:37:42h)

## v1163
- Dashboard: „Neueste Bestleistungen" zeigt nur noch Vereinsergebnisse (keine externen); „Gesamtbestleistung" → „Vereinsrekord"
- Dashboard: „Letzte Veranstaltungen" kennzeichnet externe Ergebnisse mit (ext.); Zusammenfassung mit korrekter Einzahl/Mehrzahl und Extern-Anteil
- Config: Hook für automatisches Merge nach main + Versionsnummer-Erhöhung nach jedem Push
- Fix: Auto-Match (uitsAutoMatch) – strikter Vergleich nach Umlaut-/Akzent-Normalisierung; frühere 80%-Präfix-Regel matchte fälschlich "Andrea" mit "Andreas" und "Kraus" mit "Krause" und führte zu falschen Treffern bei Bulk-Importen (MikaTiming, uitsslagen.nl, RaceResult)
- Fix: MikaTiming – Datum aus Hamburg-style JSON `"date":"YYYY-MM-DD..."` extrahiert (häufigstes Datum = Renntag) wenn weder Title noch JSON-LD ein Datum liefern
- Fix: MikaTiming – Disziplin-Map jetzt dynamisch aus `<option>`-Texten der Hauptseite + Heuristik (HML/M→Marathon, HHML/HM→Halbmarathon bei Marathon-Title, *km, Staffel, Rollstuhl, Handbike)
- Fix: MikaTiming – Zeit/Verein/AK jetzt mit Regex-Fallback direkt auf rohem li-HTML (bypasses DOMDocument-XPath bei Hamburg-style `type-time`/`type-field`/`type-age_class`); gleicher Fallback auf Detailseite
- Perf: MikaTiming – Detail-Fetch wird übersprungen wenn netto+ak bereits aus Suchliste vorhanden (spart bei Hamburg-style Sites N parallele HTTP-Requests)
- Fix: MikaTiming-Import – gematchte Athleten ohne Zeit nicht mehr aus den Einträgen geworfen ("Keine TuS-Einträge gefunden" trotz Match)
- UX: MikaTiming-Import – Debug-Ausgabe verschlankt (keine Per-Query-Tabelle und kein Roh-Dump mehr)
- UX: Bulk-Import – Veranstaltungsname wird automatisch bereinigt: trailing Jahreszahl + freistehender Ortsname werden entfernt – auch bei Auswahl einer regelmäßigen Veranstaltung
- Perf: MikaTiming-Import – Old-Interface-Fallback (Event-ID-Loop + Detailseiten) jetzt parallel via curl_multi statt sequenziell (~10–26× schneller)
- Fix: MikaTiming – Garbage-Event-IDs (25/50/100/ASC/DESC/name/club) werden nicht mehr als Event-IDs gesucht
- Fix: MikaTiming – Standard-Event-IDs (HM/M/10L/5L/10K/5K) immer im New-Interface-Batch enthalten (vorher fehlte z.B. HM beim Hamburg Marathon 2019)
- Fix: Admin → System → Letzte Logins – "undefined totp" behoben (TOTP fehlte in der Emoji-Map)
- Feature: Bulk-Eintragen – "Bestehende Veranstaltung wählen" jetzt als Suchfeld mit Live-Filterung über alle Veranstaltungen (statt statischer Liste der letzten 50)
- Fix: Klick auf Veranstaltung im Dropdown wurde nicht übernommen (JSON.stringify-Anführungszeichen brachen das onmousedown-Attribut)
- Fix: Dropdown wurde von übergeordnetem overflow-Container abgeschnitten – jetzt position:fixed im Body mit getBoundingClientRect-Positionierung
- Feature: Bulk-Eintragen – Athlet und Disziplin als Suchfelder mit Live-Filterung (wie Veranstaltungssuche), kein statisches Dropdown mehr
- Feature: Bulk-Eintragen – "Regelmäßige Veranstaltung" ebenfalls als Suchfeld (inkl. "＋ Neue anlegen" im Dropdown)
- Feature: Bulk-Eintragen – Checkbox "Nicht für Verein" ersetzt durch Vereinsname-Textfeld (vorausgefüllt mit eigenem Verein; leer oder anderer Verein → externes Ergebnis mit Vereinszuordnung)
- UX: Bulk-Eintragen – "Regelmäßige Veranstaltung" steht jetzt über "Datum"; Auswahl belegt Ort (immer) und Veranstaltungsname (wenn leer) automatisch vor
- UX: Bulk-Eintragen – Importkategorie-Auswahl synchronisiert sofort das Kategorie-Feld

## v1163
- Fix: Registrierung mit E-Mail eines soft-gelöschten Accounts schlug beim Genehmigen mit Duplicate-Entry-Fehler fehl – UPDATE statt INSERT für wiederbelebte Accounts
- Feature: Admin-Panel zeigt alle Registrierungen (auch approved/rejected) mit Löschen-Button für Altlasten

- Feature: Admin kann Passkeys und TOTP einzelner Benutzer zurücksetzen (Benutzer bearbeiten → 2FA-Sektion)
- Fix: Passkey löschen zeigt jetzt die genaue Fehlermeldung vom Server
- Fix: Passkey-Sperre im Profil greift nicht mehr wenn passkey_rp_id gesetzt ist
- Feature: Passkey RP-ID konfigurierbar (Admin → System → Login-Portal) – ermöglicht portalübergreifende Passkeys via gemeinsamer Parent-Domain (z. B. tus-oedt.de)

## v1129
- Fix: Serien-Buttons – SQL-Fehler bei anz_athleten (korrelierte UNION-Unterabfrage) behoben

## v1121
- Admin-Tab "Darstellung" in "Einstellungen" umbenannt

## v1121
- Fix: Zeitanzeige normalisiert – "64:30" (MM≥60) wird als "1:04:30" dargestellt (`fmtTime`); `normalizeResultat` speichert künftige Importe direkt korrekt; DB-Migration normalisiert bestehende Einträge in `ergebnisse` + `athlet_pb`

## v1121
- Refactoring: `_buildVeranstErgTable` extrahiert – identischer Veranstaltungs-Tabellen-Render-Block aus `renderVeranstaltungenListe` und `_buildSerieJahreHtml` in einen Helper zusammengeführt (~70 duplizierte Zeilen → 1 Aufruf je Stelle); `buildSelectOptions`, `debounce`, `normalizeUmlauts` als Utilities in `09_utils.js` zentralisiert

## v1121
- Admin-Dashboard: "Ergebnisse/Veranstaltungen pro Tag" → "pro Jahr" (API + Label)

## v1121
- Fix: Paste-Parser – kompletter Umbau auf token-basierten Ansatz: Name/Disziplin/AK/Platz/Datum werden unabhängig von Reihenfolge erkannt; Schlüssel-Token: Zeit = Ankerpunkt; `beforeZeit` enthält Name+Disz+AK+Platz, `afterZeit` enthält Datum+Einheit+Kontext; PB/SB/NB-Labels werden ignoriert; AK-Regex auf echte Altersklassen-Codes beschränkt (M50/W65/MÜ40/Msen/MHK etc.) damit Namen wie "Wender" nicht fälschlich als AK erkannt werden; "Frank Pesch Marathon M50 127 3:57:16 Enschede Marathon 12.04.2026" → name=Frank Pesch, disz=Marathon, ak=M50, platz=127, datum=2026-04-12 ✅

## v1121
- Fix: Paste-Parser – Inline-Format `Name Disziplin AK Platz Zeit Event Datum` (z.B. "Frank Pesch Marathon M50 127 3:57:16 Enschede Marathon 12.04.2026") wurde zwar als 1 Ergebnis eingelesen, aber Name enthielt Disziplin/AK/Platz, AK/Platz/Datum wurden falsch oder gar nicht extrahiert; Parser erkennt jetzt: AK (`M50`, `W65` etc.) per Inline-Regex in `beforeTime`, Platz als Zahl zwischen AK und Zeit, Disziplin als letztes Wort vor AK via Disziplin-Liste, Datum per `DD.MM.JJJJ`-Regex in `afterTime` (statt erste Zahl in afterTime als Platz zu werten)

## v1121
- Fix: `evenementen.uitslagen.nl` – 0 Strecken trotz 6446 Byte `zoek.html`-Response: `uitsEvenementenParseMenu` suchte nach `catg=` im Option-Value, aber `zoek.html` enthält `<select name="catg">` mit **rohen Kategorie-Codes** als Values (`1-Msen`, `2-M40`, `10-Vsen` etc.) ohne Prefix; Parser erkennt jetzt `select[name="catg"]` als primäre Quelle und matched Raw-Codes via `/^\d+-[A-Za-z]/.test(val)`; Suchfeld-Werte (`naam`, `wnpl`, `vern`, `land`, `gesl`) werden übersprungen; alle 59 Kategorien für Venloop 2025 gefunden (live getestet)

## v1121
- Fix (Versuch): `evenementen.uitslagen.nl` TLS-Fingerprinting – PHP-curl sendet HTTP/2 (`CURL_HTTP_VERSION_2_0`, ändert ALPN-Extension im TLS-Handshake → anderer JA3-Hash); wenn curl-Response >50 KB ohne `<option>`-Elemente (= SPA-Shell erkannt), Fallback auf PHP-Streams (`file_get_contents` mit SSL-Context) — PHP-Streams nutzen OpenSSL-Wrapper mit anderem JA3 als libcurl; wenn Streams echte Daten liefern (<50 KB mit `<option>` oder `<tr>`), werden diese statt der curl-Antwort verwendet

## v1121
- Fix: `evenementen.uitslagen.nl` – keine manuelle Konsolen-Eingabe mehr nötig. Ursache: Server nutzt TLS-Fingerprinting (JA3), liefert `menu.php` und `menu.html` via PHP-Proxy als SPA-Shell (67 KB, 0 `<option>`-Elemente). **Lösung**: `zoek.html` ist eine vollständig statische HTML-Datei ohne JavaScript — sie enthält alle Kategorien mit `catg`-Parametern (Format `1-Msen`, `2-M40`, `3-Vsen` etc.) und kommt unverändert durch den Proxy. Der Importer nutzt jetzt `zoek.html` als primäre Strecken-Quelle, fällt erst danach auf `menu.php` / `menu.html` zurück. Die Seiten-URLs werden je nach Quelle korrekt gebaut (`uitslag.php?catg=X` oder `?on=N`). `uitsEvenementenParseMenu` unterstützt jetzt beide Formate. Browser-Extraktor-Modal (v1108–v1110) entfernt. Live getestet: Enschede Marathon 2026 + Venloop 2025 liefern korrekte Strecken.

## v1121
- Fix: `evenementen.uitslagen.nl` – TLS-Fingerprinting (JA3): Server liefert PHP-curl eine 67 KB SPA-Shell ohne `<option>`-Elemente, während der Browser 1955 Byte echtes Menü bekommt; keine Header-Anpassung hilft. Lösung: **Browser-Extraktor via Modal**: wenn `menu.php` >5000 Byte ohne Options zurückkommt, zeigt der Importer ein Modal mit einem automatisch generierten JS-Skript (Token eingebettet); der User öffnet die evenementen-Seite in einem anderen Tab, öffnet die Konsole (F12) und fügt das Skript ein; das Skript fetcht alle `uitslag.php?on=N`-Seiten direkt vom Browser (funktioniert, da same-origin) und postet die Ergebnisse (13000+ Zeilen) an den neuen `uits-receive`-Endpunkt (`Access-Control-Allow-Origin: *`); das Portal pollt alle 2s und importiert die Daten automatisch sobald sie ankommen; neue API-Endpunkte: `uits-token` (GET, generiert 32-char Hex-Token), `uits-receive` (POST mit CORS und GET zum Abfragen, temp-file Cache, TTL 10 min)

## v1121
- Fix: `evenementen.uitslagen.nl` – "❌ Keine Strecken gefunden" endgültig behoben: der Server nutzt **TLS-Fingerprinting** (JA3-Hash), erkennt PHP-curl als nicht-Browser und liefert dem Proxy einen 67237-Byte-SPA-Shell ohne `<option>`-Tags; Header-Tweaks und Cookies helfen nicht; Lösung: **Browser-Extraktion via Modal** — wenn `menu.php` einen SPA-Shell liefert (>5000 Byte, 0 Strecken), öffnet sich ein Modal mit einem kopierbaren Extraktor-Skript das der User in der Browser-Konsole auf der evenementen-Seite ausführt; das Skript fetcht alle Strecken und Ergebnisse (live getestet: 13518 Zeilen Enschede Marathon 2026 in ~10s) und sendet sie per CORS-POST an neue Backend-Endpunkte `uits-receive` (speichert, CORS-Header) + `uits-token` (Einmal-Token); das Portal pollt alle 2s auf Daten und setzt den Import automatisch fort sobald die Daten eintreffen; Token läuft nach 10 Minuten ab

## v1121
- Fix: `evenementen.uitslagen.nl` – TLS-Fingerprinting-Problem: Server erkennt PHP-Proxy via JA3-Fingerprint und liefert 67KB SPA-Shell statt 2KB echtem Menu-HTML mit `<option>`-Tags. Lösung: **Browser-seitiger Extraktor** via Token+CORS: (1) neuer `uits-token`-Endpunkt erzeugt Einmal-Token, (2) neuer `uits-receive`-Endpunkt nimmt Cross-Origin-POST entgegen (`Access-Control-Allow-Origin: *`) und speichert JSON per Temp-Datei, (3) Frontend erkennt SPA-Shell (>5000 Byte ohne Option-Tags), zeigt Modal mit kopierbarem Extraktor-Skript + Polling alle 2s bis Daten ankommen, dann direktes `bulkFillFromImport`; CORS-OPTIONS-Präflight vorgezogen vor `Content-Type`-Header

## v1121
- Fix: `evenementen.uitslagen.nl` – "❌ Keine Strecken gefunden": `uits-fetch`-Endpunkt fetcht Unterseiten (`menu.php`, `uitslag.php`) ohne Session-Cookie; der Server liefert ohne Session eine abgespeckte Antwort ohne `<option>`-Elemente, `uitsEvenementenParseMenu()` liefert daher immer `[]`; Fix: `uits-fetch` führt jetzt zuerst einen Pre-Fetch der Basis-URL durch (`evenementen.uitslagen.nl/JJJJ/slug/`), speichert den Session-Cookie in einem temporären Cookie-Jar, und fetcht dann die eigentliche Unterseite mit diesem Cookie + Referer-Header; `@unlink` bereinigt den Temp-Jar; Debug-Zeile für `menu.php`-Ergebnis hinzugefügt

## v1121
- Fix: `evenementen.uitslagen.nl`-Importer – Datum und Ort wurden nicht erkannt: Ort aus URL-Slug (enschedemarathon → Enschede), Datum 3-stufiger Fallback (kop.html/kop.php → voet.php → details.php erster Läufer "Gelopen op"), Auto-Serie auch im evenementen-Pfad aktiv, Stopword-Liste um Sponsor-Namen erweitert

## v1121
- Feature+Fix: MikaTiming-Importer – mehrere kleinere Verbesserungen für die Übernahme von Meta-Daten:
  - **Datum-Parser** erweitert um deutsches Textformat „19. April 2026" (mika:timing-Seitenheader). Vorher wurde das Datum auf solchen Seiten nicht erkannt, weil nur Digital-Formate `DD.MM.YYYY` / `YYYY-MM-DD` geprüft wurden.
  - **Ort-Erkennung**: Städteliste um niederrheinische Orte erweitert (Tönisvorst, Oedt, Kempen, Grefrath, Willich, Meerbusch, Erkelenz, Mettmann, Nettetal, Geldern, Goch, Xanten, Wesel, Emmerich, Bocholt, Dorsten, Gladbeck, Marl, Recklinghausen, Herne, Witten, Iserlohn, Hamm); zusätzlich Fallback per **Subdomain→Stadt-Mapping** (`apfelbluetenlauf.r.mikatiming.com` → Tönisvorst, `vienna` → Wien, `linzmarathon` → Linz, `boston` → Boston etc.) für Fälle, in denen der Event-Name die Stadt nicht enthält.
  - **Accent-Toleranz** beim Athleten-Matching (`uitsAutoMatch`, `_normUmlauts`, `_bulkFindAthlet`, `_normN` in `05_athleten.js`): via NFD-Unicode-Normalisierung werden Akzente wie é/è/à/ô/ñ/ç entfernt; damit matcht „Leichsenring, Andre" auch den Datenbankeintrag „Leichsenring, André". Gleiches gilt für François/Francois, Rüdiger/Ruediger, Søren/Soren etc.
  - **Regelmäßige Veranstaltung automatisch vorausgewählt**: Neue Frontend-Funktion `_bkMatchSerie()` vergleicht den importierten Event-Namen token-weise gegen die gespeicherten Serien. Ein Treffer setzt das Serien-Dropdown automatisch und leitet den **Ort aus der letzten Austragung** der Serie ab, wenn MikaTiming keinen Ort geliefert hat. Scoring bestraft generische Matches (z.B. „Marathon"), sodass passgenaue Serien bevorzugt werden.
  - **Backend**: `GET veranstaltung-serien` liefert zusätzlich `ort_letzte` und `name_letzte` für Ort-Ableitung und UI-Anzeigen.

## v1121
- Perf: MikaTiming-Importer – **parallele Event-POSTs via `curl_multi_exec`** statt sequenzieller `foreach`-Schleife; pro Athleten-/Vereins-Suche werden die 6 Event-Anfragen (HM/10L/5L/BL/KL/JL1) jetzt gleichzeitig ausgeführt statt nacheinander; reduziert Wartezeit von ~6×RTT auf ~1×RTT pro API-Call (~6× schneller); Namens-Suche in großen Vereinen (50+ Athleten) damit wieder in akzeptabler Zeit; neue Helper-Funktion `mikaPostCurlMulti()` kapselt die Parallelisierung (read-only Cookie-Jar gegen Race-Condition)

## v1121
- Fix: MikaTiming-Importer – **Ursache der seit Wochen leeren Responses live im Browser identifiziert**: der mika:timing-Server (r.mikatiming.com) liefert nur dann echte Ergebnisdaten, wenn ALLE versteckten Form-Felder im POST mitgeschickt werden (`lang=DE`, `startpage=start_responsive`, `startpage_type=search`, `event=<EVID>`). Alle bisherigen Code-Pfade (v1095-v1102) haben diese Felder gar nicht gesendet und bekamen HTTP 200 mit einem leeren HTML-Gerüst zurück — die `<li class="list-active">`-Zeilen waren leer, weil das Framework sie nicht befüllte ohne die vollständigen Context-Felder; **newInterface-POST** entsprechend umgebaut (pro Event ein POST mit korrekter Form-Struktur); **v2-JSON-API-Pfad** (der seit v1095 dauerhaft 0 Byte lieferte) deaktiviert — `SearchProvider.js` war kein v2-Marker, sondern nur das Autosuggest-Script; Interface-Erkennung umgebaut (newInterface ist wieder der Haupt-Pfad, oldInterface als Fallback); Name-Parser um `.type-fullname` erweitert; im Browser gegen Apfelblütenlauf 2026 verifiziert (Goraus/Daams HM, Wender 10L etc.)

## v1121
- Diagnose+Fix: MikaTiming – Debug-Limit im Frontend von 300 auf 3000 Zeichen erhöht (v2_fallback und newInterface-Durchlauf wurden abgeschnitten und waren daher nicht sichtbar); Backend-Debug erweitert um `mainHtmlLen`, `mainHtmlHead`, `htmlHead` (erste 300 Byte der Server-Response); **2. Fallback newInterface → oldInterface** eingebaut, wenn auch der POST-Pfad 0 Treffer liefert (damit greift am Ende immer irgendein Pfad)

## v1121
- Fix: MikaTiming-Importer – v2-SPA-Interface (SearchProvider.js) lieferte dauerhaft 0 Ergebnisse (HTTP 200, response_len 0), da der Server den JSON-POST ohne Grund still mit leerem Body beantwortet; **automatischer Fallback auf den POST-basierten newInterface-Pfad** eingebaut, wenn v2 keine Treffer liefert; v2-POST-Body zusätzlich um `fpid=search`, `pidp=start`, `nation=%`, `firstname=''`, `start_no=''` ergänzt (näher am echten Browser-Request) — damit greift der Importer wieder für Apfelblütenlauf 2026 und andere neue r.mikatiming.com-Sites

## v1121
- Fix: MikaTiming-Importer – v2-SPA-Interface: `getList` per POST statt GET (gemäß SearchProvider.js); Parameter-Format angepasst (`options[string]`, `options[b][lists]`, `options[b][search]` kombiniert); lieferte zuvor 0 Ergebnisse (HTTP 200, leerer Body)
- Fix: ACN-Importer – LIVE-Strecken lieferten 0 Zeilen und keine AK-Platzierung: Spalten (#NAME/#GENDER/#CAT) dynamisch per Spaltenname statt hardcodiertem Index; `parseInt` statt `Number` beim Zeit-Parsen (ignoriert trailing `km/h`-Anteil); `replace(/<[^>]*>/g,'')` statt `replace(/<.*$/,'')` für in HTML eingewickelte Zeiten
- Feature: Alle Admins werden per E-Mail benachrichtigt sobald sich ein neuer User registriert (beide 2FA-Wege, auch bei Auto-Freigabe)
- UX: Admin → Benutzer – Spalte "Registriert am" in Benutzerverwaltung hinzugefügt
- UX: Admin – Registrierungen-Tab entfernt; E-Mail-Einstellungen → Darstellung; ausstehende Registrierungen (inkl. Genehmigen/Ablehnen) → Benutzer-Tab; Badge-Zähler am Benutzer-Button
- Fix: Athletenprofil – Ergebnisformat 'min_h' wurde ignoriert; _apFmtRes übergab fmtTime kein unit-Argument → Anzeige immer als 'min' statt mit Hundertstel

## v1121
- Fix: Format min_h – Zeitstrings wie "3:40,37" wurden falsch als "0:03,00" angezeigt; parseFloat brach am ':' ab; fmtTime erkennt jetzt isTimeString und parst M:SS,cc und H:MM:SS,cc korrekt

## v1121
- UX: Admin → Disziplinen – Kategorien als klickbare Liste; Detailansicht mit Toggle Disziplinen/Einstellungen; Kategorie-Einstellungen inline bearbeitbar; Disziplin-Tabelle nach Kategorie gefiltert; Spalte "Quelle/Format" → "Format", immer sichtbar, normale Schriftart; Kategorie-Auswahl ohne Seiten-Reload (nur Teilaktualisierung der betroffenen Bereiche)

## v1082
- Feature: Ergebnisformat 'min_h' – Zeit (min) mit Hundertstel-Sekunden, z.B. 45:30,99 min; fmtTime/fmtValNum in 09_utils.js erweitert; Admin-Dropdowns ergänzt; alle Aufrufstellen aktualisiert

## v1082
- Feature: Zentrales Login-Portal – Voraussetzungen im Statistikportal geschaffen; config.sample.php um COOKIE_DOMAIN erweitert; auth.php Session-Start mit optionaler Cookie-Domain; neue Einstellungen login_portal_aktiv, login_portal_url, login_portal_apps; Admin → Darstellung: Login-Portal-Konfigurationspanel; 02_app.js showLogin() leitet zum Portal weiter wenn aktiviert; Statistikportal bleibt standalone nutzbar wenn login_portal_aktiv=0; Login-Portal selbst ist ein eigenständiges Projekt

## v1082
- Fix: Admin → System – Neuester Benutzer wurde nie angezeigt; Ursache: SQL-Query selektierte nicht-existente Spalten `vorname`/`nachname` → stiller try/catch-Fehler → immer null; Query auf vorhandene Spalten `benutzername`/`email` korrigiert

## v1082
- Fix: rek-table Mobile – rek-name-cell div fuer zuverlässige Namenstruncation; max-width:140px; Ergebnis rechtsbündig

## v1082
- Fix: Bestleistungen/AK-Tabellen Mobile – eigentliche Ursache: display:block-Regel hat rek-tables zerstoert; Regel auf Admin-Tabellen eingeschraenkt

## v1082
- Fix: rek-table Mobile – table-layout:fixed + feste Spaltenbreiten (Badge 38px, Ergebnis 72px); damit funktioniert overflow:hidden/ellipsis auf td in WebKit/Safari korrekt; Floating-Zeilen-Problem in AK-Karten behoben; rek-ak-card overflow:hidden wiederhergestellt

## v1082
- Fix: Bestleistungen & Regelmäßige Veranstaltungen – Mobile-Layout: Datum-Spalte (letzte Spalte) auf Smartphones ausgeblendet; Athletennamen auf max-width:130px mit Ellipsis begrenzt; overflow:hidden auf rek-Panels und rek-ak-card durch overflow-x:auto ersetzt

## v1082
- Fix: Favicon – wird jetzt beim Logo-Upload automatisch als favicon.ico + apple-touch-icon.png (180×180 für Safari) erzeugt; SVG-Logos werden als favicon.svg kopiert; index.html: korrekte Link-Tags (svg-first, apple-touch-icon auf PNG); beim Logo-Löschen werden alle Favicon-Dateien mitentfernt; generierte Dummy-Dateien aus v1074a entfernt

## v1082
- Fix: Favicon – favicon.ico, favicon.svg (SVG-first für moderne Browser) und apple-touch-icon.png (180×180) neu erstellt; fehlende Dateien waren Ursache des leeren Safari-Favoriten-Icons; `<link>`-Tags in index.html korrigiert

## v1082
- Fix: Admin → Rollen & Rechte – responsives Card-Layout statt starrer Tabelle; Rechte als einzelne Tags dargestellt; kein horizontaler Überlauf mehr auf iPhone

## v1082
- Feature: TOTP-Setup – kopierbarer Secret-String mit „📋 Kopieren"-Button neben dem QR-Code (Registrierung, Admin-Setup, Profil-Modal); Hilfsfunktionen `_totpSecretHtml()` und `_copyTotpSecret()` zentralisieren die Darstellung

## v1082
- Fix: MikaTiming altes Interface – Namensuche sucht zuerst ohne Event-Filter (funktioniert für 2023 etc.); Event-ID-Loop nur als Fallback wenn kein Ergebnis (für 2016 etc.)

## v1082
- Fix: MikaTiming Interface-Erkennung – nur noch "simple-search-name" als Merkmal für neues Interface; zweite Bedingung entfernt die 2023er und ähnliche Sites fälschlicherweise als neu klassifizierte

## v1082
- Fix: F5-Refresh – validAdmin-Liste um "wartung" und "system" ergänzt; doppelter veranstaltung-Block entfernt; deckt alle syncHash-Fälle vollständig ab

## v1082
- Fix: Regelmäßige Veranstaltung – Browser-Refresh auf #veranstaltungen/serie/ID öffnet jetzt korrekt die Serie-Detail-Seite (restoreFromHash kannte den Serie-Pfad nicht)

## v1082
- Fix: Teilnahmen-Tabelle – erstes Jahr auf Mobile weiterhin ausgeblendet durch globale CSS-Regel table:not(.veranst-dash-table) nth-child(4); serie-teilnahmen-table jetzt auch dort ausgeschlossen

## v1082
- Fix: Teilnahmen-Tabelle – erstes Jahr auf Mobile nicht mehr ausgeblendet (rek-table CSS hatte nth-child(4){display:none} für Mobile); eigene Klasse serie-teilnahmen-table

## v1082
- Fix: Teilnahmen-Tabelle – erstes Jahr auf Mobile nicht mehr abgeschnitten (display:inline-block → overflow-x:auto;width:100%)

## v1082
- Fix: MikaTiming – DNS-Filter nutzt jetzt res.name statt res.idp/netto; neues Interface markiert Ergebnisse mit _fromNewInterface für korrekten DNS-Filter

## v1061
- Fix: MikaTiming altes Interface – Namensuche nutzt jetzt feste Liste gängiger Event-IDs (HM/10L/5L/M/10K/5K etc.) statt nur HTML-Options die oft JS-gerendert fehlen

## v1082
- Fix: MikaTiming – DNS-Filter entfernt für Ergebnisse mit IDP (MikaTiming zeigt DNS nicht in Suchergebnissen); Detail-Fetch-URL für Namensuche ohne Club-Parameter

## v1082
- Fix: MikaTiming altes Interface – Detail-Fetch (Zeit/AK) läuft jetzt auch für Namens-Such-Ergebnisse (war fälschlich im else-Block eingeschlossen → netto leer → DNS-Filter)

## v1082
- Fix: MikaTiming altes Interface – Namensuche durchsucht jetzt alle Event-IDs (HM/10L/5L etc.) statt nur dem ersten; findet jetzt auch 5km-Teilnehmer

## v1082
- Fix: Regelmäßige Veranstaltungen – URL-Anzeige/Kopieren-Button entfernt; stattdessen aktualisiert openSerieDetail() die Browser-URL per syncHash()

## v1082
- Feature: Veranstaltungen-Tab jetzt auch für Leser und nicht eingeloggte Nutzer sichtbar
- Feature: Regelmäßige Veranstaltungen – kopierbare Deep-Link-URL (#veranstaltungen/serie/ID); URL wird in Adressleiste aktualisiert
- Fix: Teilnahmen-Ranking – eine Teilnahme pro Jahr, auch wenn mehrere Distanzen absolviert wurden

## v1082
- Perf: MikaTiming neues Interface – statt 3 sequenzielle POSTs (je Event HM/10L/5L) jetzt eine einzige POST-Anfrage ohne Event-Filter; ~3x schneller

## v1082
- Feature: Bulk-Import – Checkbox "AK nach DLV-System angleichen" (default: an); sofortiger Effekt per Klick; speichert Import-AK als Fallback

## v1082
- Fix: PHP Fatal Error – kaputte Regex mit gemischten Anführungszeichen in og:description-Extraktion behoben

## v1082
- Fix: PHP Fatal Error – mikaCurl und mikaPostCurl auf Top-Level verschoben (PHP erlaubt keine Funktionsdeklarationen in if-Blöcken)

## v1082
- Fix: MikaTiming – DNS/DNF überspringen (kein Resultat = nicht importieren)
- Fix: MikaTiming – Veranstaltungsname und Ort werden jetzt aus API-Response vorbelegt
- Fix: MikaTiming neues Interface – Ort aus og:description extrahiert

## v1050
- Fix: MikaTiming neues Interface – Zeit (type-time/Label "Ziel"), AK und Verein (type-field/list-label) korrekt extrahiert

## v1049
- Fix: MikaTiming neu – Zeit/Verein/AK direkt aus Listenzeilen parsen; Fallback H:MM:SS-Regex; Detail-Debug

## v1082
- Fix: MikaTiming neues Interface – Zeit/AK/Verein direkt aus List-Item geparst; kein Detail-Seiten-Fetch mehr (JS-gerendert, war immer leer)

## v1082
- Feature: MikaTiming – automatische Erkennung neuer Interface (POST, kein club-Feld); sucht pro Event-Typ (HM/10L/5L) via POST search[name]; Detail-Seiten für Zeit+AK

## v1082
- Perf: MikaTiming Athleten-Namenssuche – parallele Requests (5 gleichzeitig per Promise.all) statt sequentiell; ca. 5× schneller

## v1082
- Feature: MikaTiming – "Nicht für Verein"-Checkbox wird automatisch gesetzt wenn Vereinsname leer oder kein Treffer mit eigenem Verein; tatsächlicher Clubname aus HTML extrahiert

## v1082
- Feature: MikaTiming – Athleten-Namenssuche läuft jetzt IMMER (nicht nur als Fallback); Ergebnisse werden mit Vereinssuche zusammengeführt (dedup per idp); alle Athleten werden berücksichtigt (nicht nur aktive)

## v1082
- Feature: MikaTiming-Importer – Fallback-Suche nach bekannten Athleten-Namen wenn Vereinssuche 0 Ergebnisse liefert (wie bei uitslagen.nl)

## v1082
- Fix: Veranstaltung bearbeiten – Serien-Dropdown lädt jetzt immer ungefiltert (nicht aus gefiltertem Such-Cache)
- Feature: Veranstaltungen-Suche – Button "Alle X Veranstaltungen ohne Serie zu regelmäßiger Veranstaltung hinzufügen" (Admin/Editor); Sicherheits-Modal mit Liste + Serie-Auswahl

## v1082
- Feature: Admin "Duplikate" → "Wartung" mit Sub-Tabs: "Duplikate" (bisheriger Inhalt) + "Verwaiste Veranstaltungen" (0 Ergebnisse, löschbar)

## v1082
- Feature: Bulk-Eintragen – neue Option "＋ Neue regelmäßige Veranstaltung" im Serien-Dropdown; öffnet Modal zum Anlegen, wählt neue Serie direkt aus

## v1082
- UX: Veranstaltungen – Serien-Buttons zeigen jetzt auch Anzahl Austragungen und Jahreszeitraum (z.B. "163 Ergebnisse · 16 Austragungen · 2009–2026")

## v1082
- UX: Veranstaltungen – Serien-Buttons zwischen Suche und Ergebnisliste; Optik wie Disziplin-Buttons (rek-top-btn); Ergebnisanzahl; Sortierung absteigend; Überschrift entfernt; bei Suche mitgefiltert

## v1082
- Feature: Admin Duplikate – "✅ Kein Duplikat"-Button ignoriert ein Paar dauerhaft (gespeichert in duplikate_ignoriert-Tabelle)

## v1082
- Fix: Admin Duplikate – PUT-Route erkennt jetzt auch bahn, cross, halle als gültige Kategorie-Routen

## v1082
- Fix: Admin Duplikate – Edit-Route nutzt jetzt tbl_key-Fallback "strasse" statt "ergebnisse" (behob "Unbekannte Route")

## v1082
- Feature: Admin Duplikate – ✏️-Button öffnet Standard-Bearbeiten-Dialog (wie unter Ergebnisse)

## v1082
- Feature: Admin Duplikate – Veranstaltungsname ist jetzt ein klickbarer Link zur Veranstaltungsseite

## v1082
- Fix: Admin Duplikate – "Eingetragen von" nutzt jetzt benutzer.benutzername + athleten.vorname/nachname via athlet_id

## v1082
- Fix: Admin Duplikate – Spalte "Eingetragen von" nutzt jetzt korrekte benutzer-Felder (vorname+nachname statt name_nv)

## v1082
- Feature: Admin Duplikate – Spalte "Eingetragen von" (Benutzername oder Import-Quelle)

## v1082
- UX: Admin Duplikate – ein Panel pro Paar, Ergebnisse untereinander, AK angezeigt, Datum als hartes Kriterium (nur gleicher Tag)

## v1082
- Feature: Admin-Tab "Duplikate" – findet Ergebnis-Duplikate (gleicher Athlet+Disziplin, Toleranz ±2s/m, ohne AK/Platzierung); einzeln oder per ↓ in Papierkorb verschieben

## v1082
- Fix: Bulk-Import Duplikatprüfung – externe Ergebnisse prüfen jetzt auch gegen interne (ergebnisse), interne auch gegen externe (athlet_pb)

## v1082
- Fix: evenementen.uitslagen.nl – ältere Jahrgänge (2011/2012) nutzen table.u; Parser erkennt jetzt table.uitslag, table.i und table.u

## v1082
- Feature: Bulk-Import – Checkbox "Auch inaktive Athleten" (default: an); steuert window._bkMatchInaktive in uitsAutoMatch

## v1082
- Fix: uits-fetch Proxy – PHP-Parse-Fehler behoben; Charset-Erkennung jetzt via mb_detect_encoding statt fehleranfälliger Regex

## v1082
- Fix: uits-fetch Proxy – PHP-Syntaxfehler in Charset-Erkennung behoben (Anführungszeichen-Konflikt in Regex)

## v1082
- Fix: uits-fetch Proxy – Charset wird jetzt aus HTML-Meta erkannt (z.B. windows-1252) und korrekt zu UTF-8 konvertiert; behebt fehlende Umlaute wie ü in "Rüdiger"

## v1082
- Fix: bkSyncDatum – AK-Neuberechnung nutzt jetzt tr.querySelector(".bk-ak") statt falschem Index-Mapping (verhinderte falsche AKs wie WU20 statt M45)

## v1082
- Fix: AK-Berechnung beim Import – bkUpdateAK überschreibt Website-AK nur wenn Datum bekannt; bkSyncDatum berechnet alle Zeilen-AKs neu wenn Datum nachträglich eingegeben wird

## v1082
- Fix: evenementen.uitslagen.nl – ältere Events (z.B. 2017) nutzen table.i statt table.uitslag; Parser erkennt jetzt beide Varianten

## v1082
- Fix: Teilnahmen-Ranking in reg. Veranstaltungen – bei gleicher Gesamtanzahl werden Vereinsteilnahmen höher gewichtet als externe

## v1082
- Fix: Serie-Bestleistungen – pbDedup im richtigen Endpoint mit use($unique) versehen (vorher wurde immer dedupliciert)

## v1082
- Fix: Top-10-Limit wiederhergestellt; bei unique=OFF können Athleten mehrfach in den Top 10 erscheinen

## v1082
- Revert: athlet_pb UNION in Serie-Bestleistungen entfernt (nur interne Ergebnisse)
- Fix: unique=OFF zeigt jetzt alle Ergebnisse je Athlet (TOP-Limit aufgehoben, Server liefert bis 500)

## v1082
- Fix: Serie-Bestleistungen – externe Ergebnisse (athlet_pb mit veranstaltung_id) werden jetzt per UNION einbezogen
- Fix: Sortierung korrekt über Subquery (sort_val als berechnete Spalte)

## v1082
- Fix: Reg. Veranstaltungen – Schalter jetzt unten im grauen Ergebnis-Panel (wie Bestleistungen-Tab)
- Fix: "Jede*r Athlet*in nur einmal" wird jetzt server-seitig per unique-Param korrekt respektiert

## v1082
- Feature: Regelmäßige Veranstaltungen – Bestleistungen-Schalter (Jugend-AK, nur einmal, Jahres-Highlight) direkt im View; teilen state.rekState mit Bestleistungen-Tab

## v1082
- Fix: Disziplin-Buttons Bestleistungen – Sortierung nach Ergebnisanzahl korrigiert (Feld war "cnt" nicht "anz_ergebnisse")

## v1082
- UX: Regelmäßige Veranstaltungen – Disziplin-Buttons bei Bestleistungen absteigend nach Ergebnisanzahl sortiert

## v1082
- Fix: Veranstaltungen-Suche – Suchfeld bleibt beim Tippen im DOM (kein innerHTML-Reset), Fokus auf Mobile stabil

## v1082
- UX: Veranstaltungen – Button-Menü entfernt; regelmäßige Veranstaltungen erscheinen jetzt als Chips direkt oberhalb der Veranstaltungsliste

## v1082
- Fix: Dashboard-Widget "Mein Athletenprofil" – "Wettkampfe" → "Wettkämpfe"
- Fix: Wettkampf-Zähler (Dashboard-Widget + Athletenprofil) zählt jetzt auch externe Ergebnisse (athlet_pb)

## v1082
- Fix: Dashboard-Fehler "Unknown column pb.resultat_num" – athlet_pb hat kein resultat_num, wird jetzt als NULL behandelt

## v1082
- Build: README.md, COMMIT_EDITMSG und CHANGELOG.md werden jetzt automatisch von build.sh aktualisiert
- Fix: Neueste Bestleistungen – Debüt und PB korrekt aus externen Ergebnissen (athlet_pb per UNION)

## v1004
- Fix: Neueste Bestleistungen – externe Ergebnisse (athlet_pb) werden jetzt per UNION in Phase 1 einbezogen → Debüt und PB korrekt berechnet (statt pauschal "PB")

## v1003
- Fix: Athletenprofil – Ergebnisliste nach Datum sortiert (intern + extern gemischt, neueste zuerst)

## v1002 – Bugfix: Veranstaltungen-Tab zeigt zuletzt besuchte Unterseite

- Klick auf Veranstaltungen im Hauptmenu setzt jetzt veranstView, serieId und veranstaltungId zurück
- Ergebnis: immer die Hauptliste der Veranstaltungen statt der zuletzt besuchten Detailseite

---

## v1001 – Bugfix: Veranstaltungslinks funktionierten nur für die neuesten 200 Events

- renderVeranstaltungDetail() lud bisher limit=200 Veranstaltungen und suchte dann nach der ID
- Events älter als Platz 200 wurden nicht gefunden
- Fix: API-Endpunkt ?id=N gibt direkt genau eine Veranstaltung zurück
- API: neuer id-Filter für GET veranstaltungen

---

## v1000 – Externe Ergebnisse: Drei Fixes

- Verlinkung: Veranstaltungsname jetzt in Primärfarbe + unterstrichen
- Modal-Backdrop: Klick außerhalb schließt das Bearbeiten-Modal nicht mehr
- Suche: Serverseitige Volltextsuche statt clientseitigem Filter (kein Limit mehr durch vorab geladene Liste)

---

## v998 – Externe Ergebnisse: Veranstaltungszuordnung im Bearbeiten-Modal

- Suchfeld im Edit-Modal: Veranstaltung eintippen, Treffer auswaehlen
- Zuordnung entfernen per Frei-Button
- API PUT: veranstaltung_id wird gesetzt oder auf NULL gesetzt

---

## v998 – Externe Ergebnisse: Veranstaltungszuordnung im Bearbeiten-Modal

- Neues Suchfeld im Edit-Modal: Veranstaltung tippen, Treffer auswählen
- Zuordnung entfernen per X Frei-Button
- Aktuell verknüpfte Veranstaltung wird angezeigt
- API PUT externe-ergebnisse: veranstaltung_id wird gespeichert/gelöscht

---

## v997 – Ergebnisse: Link zur Veranstaltungsseite

- Alle Ergebnisse mit veranstaltung_id verlinken direkt auf die Veranstaltungsseite (#veranstaltung/ID)
- Betrifft Vereins- und externe Ergebnisse gleichermassen
- Nur freie externe Ergebnisse (athlet_pb ohne veranstaltung_id) zeigen weiterhin frei-Badge
- Kein Link mehr zur Veranstaltungsserie, sondern direkt zur Veranstaltung

---

## v996 – Ergebnisse: Serie-Link fuer alle Ergebnisse

- Serie-Verknuepfung war bisher nur bei externen Ergebnissen sichtbar
- Jetzt zeigt jedes Ergebnis in der Veranstaltungs-Spalte einen Link zur Serie, wenn die Veranstaltung einer regelmaessigen Veranstaltung angehoert
- API: regulaere Ergebnisse liefern jetzt ebenfalls serie_id

---

## v995 – Externe Ergebnisse: Verknuepfungs-Status in der Liste

- Spalte Veranstaltung zeigt bei externen Ergebnissen:
  - Verknuepft: Link-Icon + Name der Veranstaltung, klickbar oeffnet die Serie unter Regelmaessige Veranstaltungen
  - Frei: Badge frei + Wettkampfname, Hinweis dass kein Serienbezug besteht
- API: serie_id und Veranstaltungsname werden jetzt mitgeliefert

---

## v994 – Externe Ergebnisse: Eingetragen-von wird gespeichert

- Neue Spalte `erstellt_von` in `athlet_pb` (auto-Migration)
- Beim Eintragen via Athletenprofil oder Bulk-Import wird der eingeloggte Benutzer gesetzt
- Spalte Eingetragen von zeigt jetzt den Namen; aeltere Eintrage ohne Zuordnung zeigen -

---

## v993 – Bugfix: Externe Ergebnisse zeigen "Excel-Import" unter Eingetragen von

- Externe Ergebnisse haben kein `eingetragen_von`-Feld → zeigt jetzt `–` statt `Excel-Import`

---

## v992 – Bugfix: Auth::getUserRechte() existiert nicht

- `Auth::getUserRechte()` durch `Auth::requireRecht('externe_ergebnisse_sehen')` ersetzt

---

## v991 – Deploy-Fix: opcache-clear.php

- `opcache-clear.php` hinzugefügt: einmalig nach dem Deploy aufrufen → leert PHP OPcache
- Erklärt das wiederkehrende Problem, dass erst der zweite Deploy wirkt
- **Nach dem Aufruf bitte löschen** (oder via .htaccess schützen)
- Workflow: ZIP deployen → https://statistik.tus-oedt.de/opcache-clear.php aufrufen → fertig

---

## v989 – Ergebnisse: Externe Ergebnisse als Dropdown statt Checkbox

- Dropdown „Externe Ergebnisse" mit drei Optionen:
  - **Keine** (Standard) – nur Vereinsergebnisse
  - **Mit externen** – Vereins- und externe Ergebnisse zusammen
  - **Nur externe** – ausschließlich externe Ergebnisse
- Dropdown erscheint als eigenes Filter-Feld (nicht mehr neben Meisterschaften)

---

## v988 – Rebuild (Deploy-Fix)

- Identisch mit v987; zweite Version wegen konsistentem Deploy-Problem

---

## v987 – Rebuild: v986-Änderungen sichergestellt

- Externe Ergebnisse in Ergebnisse-Seite (war in v986-ZIP korrekt, Server veraltet)

---

## v986 – Ergebnisse: Externe Ergebnisse mit Rollen-Recht

### Neues Rollen-Recht: `externe_ergebnisse_sehen`
- Standardmäßig aktiv für Admin und Editor (nicht für Athlet/Leser)
- Migration aktiviert das Recht automatisch in bestehenden Rollen

### Ergebnisse-Seite
- Neue Checkbox „Externe Ergebnisse" in der Filterbar (nur sichtbar wenn Recht vorhanden)
- Externe Ergebnisse erscheinen leicht gedimmt mit `ext.`-Badge beim Athleten-Namen
- Edit-Modal: Disziplin, Ergebnis, AK, Datum, Wettkampf bearbeitbar
- Delete: sauberes Bestätigungs-Modal (kein `confirm()`)

### API
- Neuer Endpunkt `GET externe-ergebnisse` mit denselben Filtern wie reguläre Ergebnisse
- `PUT externe-ergebnisse/{id}` – bearbeiten
- `DELETE externe-ergebnisse/{id}` – löschen (Auth: Editor)

---

## v985 – Rebuild: confirm()-Fix aus v984 sichergestellt

- confirm() → Modal war in v984-ZIP korrekt, aber Server hatte alte Datei

---

## v984 – Athletenprofil: Externes Ergebnis löschen – Modal + Listener-Loop-Fix

- **Modal statt `confirm()`**: Löschen-Dialog öffnet jetzt ein sauberes Modal mit Abbrechen/Löschen-Buttons, das man normal schließen kann
- **Dauerschleife behoben**: `_apRender()` registrierte bei jedem Aufruf einen neuen Click-Listener auf `#modal-container` → N Renders = N Listener. Fix: Guard `_apListener1` verhindert Mehrfachregistrierung

---

## v983 – Externe Ergebnisse gehören zur Veranstaltung

### Datenbankstruktur
- Neue Spalte `veranstaltung_id` in `athlet_pb` (nullable, Migration auto)
- Beim Bulk-Import mit „Nicht für Verein"-Checkbox wird die `veranstaltung_id` automatisch gesetzt

### Teilnahmen-Ranking (regelmäßige Veranstaltungen)
- Externe Starts werden in der Zeitstrahl-Tabelle berücksichtigt
- **Voller Kreis** = für den Verein gestartet; **Kreis mit Rand, gedimmt** = extern gestartet; **leerer Kreis** = nicht gestartet
- Athleten mit externen UND Vereinsstarts: Gesamtsumme + `(+N ext.)` Hinweis
- Reine Extern-Athleten tauchen ebenfalls im Ranking auf

### Ergebnisse nach Jahr (regelmäßige Veranstaltungen)
- Externe Ergebnisse erscheinen in der Jahrestabelle, markiert mit `(ext.)`
- Vereinsrekord-Abfragen bleiben vollständig unverändert (athlet_pb ausgeschlossen)

---

## v982 – Zeitstrahl-Tabelle: Breite passt sich dem Inhalt an

- Container auf `display:inline-block` gesetzt → Tabelle wächst/schrumpft mit den Spalten
- Kein `min-width:100%` mehr → Tabelle ist genau so breit wie Athleten-Namen + Jahres-Spalten

---

## v981 – Zeitstrahl: Tooltip-Text + Tabellen-Breite

- **Tooltip**: `fmtTime()` gibt HTML zurück (`<span style="...">h</span>`) → erschien als Rohtag im Tooltip; eigene Klartextformatierung (`1:47min`, `1:29h`) ohne HTML-Tags
- **Tabellen-Breite**: Tabelle passt sich jetzt an den Inhalt an (`width:auto`) statt immer 100% zu belegen → kein unnötiger Leerraum in der Mitte mehr

---

## v980 – Regelmäßige Veranstaltungen: Detailseite ohne Tabs, alles auf einer Seite

- Tab-Buttons (Ergebnisse nach Jahr / Bestleistungen / Anzahl Teilnahmen) entfernt
- Alle drei Sektionen werden auf einmal angezeigt, von oben nach unten:
  1. 📊 Anzahl Teilnahmen (mit Zeitstrahl)
  2. 🏆 Bestleistungen
  3. 📅 Ergebnisse nach Jahr

---

## v979 – Fix Deploy: safeTitle in v978-ZIP war korrekt, aber Server hatte alte Version

- Rebuild mit identischem Fix (safeTitle HTML-Escape im Zeitstrahl-Tooltip)

---

## v978 – Bugfix: Zeitstrahl-Darstellung (title-Attribut HTML-escaped)

- Ursache: `fmtTime()` gibt Ergebnisse wie `1:29h` zurück — das `"` in `h"` schloss das HTML-`title`-Attribut vorzeitig, der Rest wurde als CSS-Text dargestellt
- Fix: `title`-Inhalt wird vor der Einbettung HTML-escaped (`"` → `&quot;`, `&` → `&amp;`, `<` → `&lt;`)

---

## v977 – Teilnahmen-Zeitstrahl: UI-Verbesserungen

- **Einheitliche Farbe**: alle gefüllten Punkte in Primärfarbe (kein Geschlechter-Farbunterschied mehr)
- **Fortschrittsbalken entfernt**
- **Gleichstand**: bei identischer Startzahl erscheint kein Medaillen-Badge (zeigt klar, dass mehrere Athleten gleichauf liegen)
- **Tooltip-Inhalt**: zeigt jetzt Disziplin + Ergebnis statt Jahreszahl; bei mehreren Starts pro Veranstaltung alle Ergebnisse mit `|` getrennt

---

## v976 – Teilnahmen-Zeitstrahl

- Im Tab „Anzahl Teilnahmen" erscheint jetzt rechts neben Name und Starts-Anzahl ein **Zeitstrahl** über alle Austragungsjahre der Serie
- Gefüllter Kreis = Athlet war dabei; leerer Kreis = nicht gestartet
- Farbe: Frauen = Primärfarbe, Männer = Sekundärfarbe
- Tooltip bei Hover zeigt Jahr + Status
- API `?teilnahmen=1` gibt jetzt zusätzlich `jahre`-Array pro Athlet zurück (genaue Teilnahmejahre)
- Legende unterhalb der Tabelle

---

## v975 – Neue regelmäßige Veranstaltung: Vorschlagsliste bestehender Veranstaltungen

- Beim Anlegen einer neuen regelmäßigen Veranstaltung erscheint eine dynamische Vorschlagsliste
- Beim Tippen des Namens werden passende Veranstaltungen gefiltert (Jahreszahlen und Ordinalzahlen werden ignoriert)
- Alle gefundenen Veranstaltungen sind per Checkbox vorausgewählt
- Beim „Anlegen" werden die ausgewählten Veranstaltungen automatisch der neuen Serie zugeordnet
- Nur Veranstaltungen ohne bestehende Serienzuordnung erscheinen in der Liste

---

## v974 – Regelmäßige Veranstaltungen: Kürzel entfernt

- Kürzel-Feld aus „Neue regelmäßige Veranstaltung" und „Bearbeiten"-Modal entfernt
- Kürzel wird serverseitig automatisch aus dem Namen generiert (für DB-Kompatibilität intern weiter gespeichert)
- Kürzel-Anzeige aus Kacheln und Detailseite entfernt

---

## v973 – Passwort vergessen: Login wiederhergestellt + Reset-Flow korrekt

- **Kritischer Bugfix**: v972 hatte versehentlich die Login-Kernfunktionen gelöscht (`_loginCard`, `renderLoginStep1/2/3`, `doLoginStep1/2`) — Wiederherstellung aus paket_v970.zip
- Reset-Flow neu implementiert: Anhang am Ende der Datei, kein Überschreiben des Login-Codes
- Verhalten wie beschrieben:
  - Klick auf „Passwort vergessen?" in Schritt 2 (E-Mail bekannt) → Code direkt senden, weiter zu Code-Eingabe
  - Klick in Schritt 1 (kein E-Mail-Wert) → E-Mail-Eingabe im Login-Screen
  - Alle Schritte rendern im Login-Screen (kein separates Modal)
  - „← Zurück" bringt zu Schritt 1 zurück

---

## v972 – Passwort vergessen: kein separates Modal mehr

- Reset-Flow rendert jetzt im Login-Screen selbst (identisch zu den Login-Schritten)
- Wenn E-Mail bereits aus Schritt 2 bekannt: Code wird sofort angefordert, kein Zwischenschritt
- Wenn E-Mail noch unbekannt (Klick in Schritt 1 ohne Eingabe): E-Mail-Feld erscheint im Login-Screen
- Navigation: „← Zurück" bringt zurück zu Schritt 1

---

## v971 – Passwort vergessen

- Neuer Link „Passwort vergessen?" unter dem Anmelden-Button in Schritt 1 und 2 des Login-Flows
- **Schritt 1**: E-Mail eingeben → Code wird per Mail gesendet (gültig 15 Min.)
- **Schritt 2**: 6-stelligen Code + neues Passwort (min. 12 Zeichen) + Wiederholung → Passwort wird gesetzt
- Sicherheit: API verrät nicht ob ein Konto existiert (neutrale Bestätigungsmeldung)
- DB: neue Spalten `reset_code_hash` + `reset_code_expires` in `benutzer`-Tabelle (auto-migriert)

---

## v970 – Auto-Rollenwechsel bei Athleten-Zuordnung

- **Admin → Registrierungen**: Athlet beim Genehmigen zuordnen → Rolle wird automatisch auf „Athlet" gesetzt (statt „Leser")
- **Admin → Benutzer**: Athleten-Dropdown im Edit-Modal ändert Rolle-Feld sofort live:
  - Athlet ausgewählt → Rolle springt auf „Athlet"
  - Athlet entfernt → Rolle springt auf „Leser"
  - Admin/Editor-Rollen werden nicht automatisch geändert
- PHP (`benutzer PUT`): wenn `athlet_id` ohne explizite `rolle` geändert wird, passt die API die Rolle serverseitig an (Leser↔Athlet)
- Tooltip auf dem Athlet-Dropdown in der Registrierungs-Karte

---

## v969 – Bugfix: Auto-Freigabe zeigt falsche Meldung

- Ursache: PHP gab `jsonOk('string')` zurück statt `jsonOk(['auto_freigabe' => true])` → JS konnte `r.data.auto_freigabe` nicht lesen → zeigte immer „wartet auf Admin-Freigabe"
- Fix: Beide Registration-Endpunkte (`register-totp-confirm`, `register-email-2fa`) geben bei Auto-Freigabe jetzt `{'auto_freigabe': true}` zurück
- JS: `_regState.autoFreigabe` wird korrekt gesetzt → Modal zeigt „Sofort freigeschaltet. Jetzt einloggen."

---

## v968 – Bugfix: Neu-Registrierung nach Konto-Löschung + UI

### Bug: „wartet auf Admin-Freigabe" nach Konto-Löschung
- Wurzel: `approved`-Eintrag in `registrierungen` blieb nach Admin-Genehmigung erhalten
- v965-Fix war unvollständig: prüfte `hatKonto` ohne `geloescht_am`-Filter → funktionierte nicht bei hart-gelöschten Konten (aus Papierkorb)
- Neue Lösung: Da kein aktives Konto mehr existiert (erste Prüfung), werden `registrierungen`-Altlasten **immer** bereinigt bevor eine neue Registrierung angelegt wird

### UI: Registrierungs-Abstände
- Abstand E-Mail → Passwort: 28px (inline style, zielgenau)
- Abstand Passwort → Passwort wiederholen: 12px (kleiner, gehört zusammen)
- CSS-Regel: `.modal .form-group + .form-group { margin-top: 12px }` als Default

---

## v967 – Bugfix: Abstand E-Mail/Passwort wirkt jetzt

- CSS-Selektor von `#modal-body .form-group + .form-group` auf `.modal .form-group + .form-group` korrigiert (Modal hat keine ID `modal-body`)

---

## v966 – Registrierung: Mehr Abstand über Passwort-Feld

- `margin-top` zwischen E-Mail- und Passwort-Block von 20px auf 32px erhöht

---

## v965 – Bugfixes: Registrierung nach Kontolöschung + UI

### Bug: „wartet bereits auf Admin-Freigabe"
- Ursache: Eintrag in `registrierungen` mit `status='approved'` blieb nach Admin-Genehmigung erhalten → blockierte Neu-Registrierung mit gleicher E-Mail
- Fix: Prüft nun ob tatsächlich noch *kein aktives Konto* vorhanden ist; wenn Konto bereits existiert → alter approved-Eintrag wird bereinigt
- Zusätzlich: `benutzer`-Check prüft jetzt nur nicht-gelöschte Konten (`geloescht_am IS NULL`)

### UI: Registrierungs-Modal
- Abstand zwischen E-Mail- und Passwort-Block vergrößert
- „Abbrechen" und „Weiter" jetzt gleiche Höhe, Schriftgröße und Stil (Barlow Condensed, Uppercase)

---

## v964 – Admin: Registrierung – automatische Freigabe konfigurierbar

- Neues Setting in Admin → Registrierungen → E-Mail-Einstellungen: **„Registrierung – Freigabe"**
  - 🔐 Manuelle Bestätigung durch Admin (Standard, bisheriges Verhalten)
  - ✅ Sofort aktiv nach E-Mail-Bestätigung (kein Admin-Eingriff nötig)
- Bei Auto-Freigabe: Benutzerkonto wird direkt nach Abschluss von Schritt 3 (TOTP oder E-Mail-Code) angelegt
- Erfolgsmeldung im Registrierungs-Modal passt sich an: „Jetzt einloggen" statt „Warte auf Admin-Freigabe"
- Admin-Benachrichtigungs-Mail wird nur bei manueller Freigabe verschickt
- Einstellung wird in `settings`-Tabelle als `registrierung_auto_freigabe` gespeichert

---

## v963 – Konto löschen: Papierkorb + Athlet-Trennung erst bei endgültiger Löschung

- **Self-Deletion**: `athlet_id` bleibt beim Löschen erhalten (nicht mehr sofort getrennt)
- **Benutzer-Liste** (Admin): gelöschte Konten erscheinen nicht mehr als „Inaktiv", sondern werden ausgeblendet
- **Papierkorb**: neuer Abschnitt „🔑 Benutzerkonten" mit gelöschten Konten
  - Wiederherstellen: Konto reaktiviert, `athlet_id` bleibt zugeordnet
  - Endgültig löschen: erst jetzt wird `athlet_id` getrennt, dann Konto aus DB gelöscht
- „Alles löschen" im Papierkorb berücksichtigt jetzt auch Benutzerkonten

---

## v962 – Bugfix: evenementen.uitslagen.nl ältere Events (menu.html + 404)

- **`menu.html` Fallback**: Ältere Veranstaltungen (z.B. 2018) liefern `menu.html` statt `menu.php` → Importer versucht jetzt erst `menu.php`, dann `menu.html`
- **Datum-Lookup entfernt**: `uitslagen.nl/evenementen.php?zoek=…` existiert nicht und gab HTTP 404 → der fehlerhafte Request wurde entfernt; Datum-Feld zeigt Notification zur manuellen Eingabe

---

## v961 – Regelmäßige Veranstaltungen + Teilnahmen-Ranking + Bulk-Zuordnung

### Umbenennung
- „Veranstaltungsserien" → **„Regelmäßige Veranstaltungen"** (alle UI-Labels, Buttons, Modals)

### Neuer Tab: Anzahl Teilnahmen
- Dritter Tab in der Detailseite einer regelmäßigen Veranstaltung
- Ranking der Athleten nach Anzahl Teilnahmen (aus allen zugeordneten Veranstaltungen)
- Zeigt Platzierung (Medaillen), Name, Anzahl Starts, Jahreszeitraum, farbiger Balken
- Klick auf Athletenname → Athletenprofil
- Neuer API-Endpunkt: `GET veranstaltung-serien/{id}?teilnahmen=1`

### Bulk-Eintragen: Zuordnung zu regelmäßiger Veranstaltung
- Neues Dropdown „Regelmäßige Veranstaltung (optional)" im Veranstaltungsformular
- Wird per `serie_id` an die Veranstaltung beim Speichern übertragen
- Bei neuer Veranstaltung: `serie_id` wird direkt gesetzt; bei bestehender: wird nachgetragen sofern noch leer

---

## v960 – Bulk-Eintragen: Checkbox „Nicht für Verein" → externes Ergebnis

- Neue Spalte in der Bulk-Ergebnistabelle: Checkbox „Nicht für Verein"
- Wenn angehakt → Ergebnis wird als **externes Ergebnis** (`athlet_pb`) gespeichert statt als Vereinsergebnis (`ergebnisse`)
- Wird z.B. benötigt wenn ein Athlet bei einem anderen Verein oder privat gestartet ist
- API `ergebnisse/bulk`: `extern: true` → `INSERT INTO athlet_pb` (Wettkampfname aus Veranstaltungsfeldern)
- Feld `bulkFillFromImport`: `row.extern = true` setzt Checkbox automatisch

---

## v959 – Datum: Suche via uitslagen.nl

- Datum wird jetzt über `uitslagen.nl/evenementen.php?zoek=SLUG&jaar=YEAR` gesucht
- `uitslagen.nl`-Eventseiten enthalten immer das Datum im Format `DD-MM-YYYY`
- Debug-Log zeigt Suchergebnis und gefundenes Datum

---

## v958 – Datum: Klare Fehlermeldung + Diagnose kop.html/voet.php

- Wenn kein Datum gefunden: Datum-Feld wird geleert + rote Notification „Datum bitte manuell eingeben"
- Debug-Log zeigt jetzt Inhalt von `kop.html` und `voet.php` für spätere Analyse der Datumsquelle
- MAX_PAGES-Fix aus v957 bestätigt: Halbmarathon Venloop 2023 jetzt 7823 Einträge (vorher 5000 abgeschnitten)

---

## v957 – Bugfixes: Seitenlimit, URL/Quelle, Datum-Diagnose

- **5000-Einträge-Limit**: `MAX_PAGES` für evenementen.uitslagen.nl von 50 → 200 (20.000 Einträge/Strecke)
- **URL/Quelle „nicht verfügbar"**: Import-URL wird jetzt beim Start in `window._bkLastImportUrl` gesichert → auch nach Tab-Wechsel verfügbar
- **Datum**: Erweiterte Diagnose — zeigt im Debug-Log den HTML-Textsnippet wenn kein Datum gefunden wird, damit die Quelle identifiziert werden kann; zusätzlich DD-MM-YYYY und DD.MM.YYYY Formate unterstützt

---

## v956 – Eintragen: Button-UX + Melde-Vorschau + Datum-Fix

### Einlesen-Button
- Während Import läuft: Button „Einlesen" wird ausgeblendet und Status als nicht-klickbarer Text angezeigt
- Nach Abschluss: Button wieder sichtbar

### Schlechten Import melden
- Klick öffnet jetzt zunächst eine **Vorschau** des zu erstellenden GitHub-Issues
- Zeigt: Issue-Titel, gemeldete Version, URL/Quelle, Debug-Log (aufklappbar)
- **Kommentarfeld** (Freitext): „Was stimmt nicht?"
- Erst nach Bestätigung wird das Issue tatsächlich erstellt

### Datum (evenementen.uitslagen.nl)
- Datum-Extraktion jetzt aus `uitslag.php?on=1&p=1` (erste geladene Ergebnisseite) statt nur aus `kop.html`/`voet.php`
- Unterstützt nl. Format (`26 maart 2023`) und numerisch (`26-3-2023`, `26.3.2023`)
- Bug: `!datEl.value`-Bedingung verhinderte Überschreiben des Default-Datums (bereits in v955 behoben)

---

## v955 – evenementen.uitslagen.nl: Datum-Feld korrekt befüllen

- Bug: `!datEl.value` war immer `false`, da Datum-Feld standardmäßig den heutigen Tag enthält → Datum wurde nie überschrieben
- Fix: Bedingung entfernt, Datum wird jetzt immer gesetzt wenn gefunden
- Zusätzliche Datum-Quelle: `voet.php` (Footer der Seite) wird nach Datumsangabe durchsucht
- Unterstützt nl. Format (`26 maart 2023`) und numerisch (`26.03.2023`)

---

## v953 – evenementen.uitslagen.nl: Korrekte Disziplin, Ort und Veranstaltungsname

- **Disziplin**: `uitsEvenementenDiszFromStrecke()` leitet Distanz aus Streckenname ab (Halbmarathon, 10km, 5km, 1km, 500m…) statt aus dem nutzlosen Kategorie-Code → passende Disziplin aus DB
- **Veranstaltungsname**: aus URL-Slug und Jahr abgeleitet (z.B. "Venloop 2023"), nicht mehr als lange Streckenliste
- **Ort**: aus Streckenname-Häufigkeitsanalyse extrahiert (häufigstes großes Wort = Stadt) als Fallback; kop.html-Parsing als Primärquelle
- Datum-Parsing aus kop.html bleibt erhalten

---

## v953 – evenementen.uitslagen.nl: Korrekte Disziplin, Ort und Veranstaltungsname

- **Disziplin**: Neue Funktion `uitsEvenementenDiszFromStrecke()` wertet den Streckennamen aus (z.B. `"Seacon Logistics 10 kilometer"` → `10km`) statt der Kategorie (`Msen` → früher `300m`)
- **Veranstaltungsname**: Aus `<title>` der Frameset-Seite (z.B. `"Weir Venloop 2023"`) statt allen Streckennamen concateniert
- **Ort**: aus `kop.html` extrahiert; Fallback: häufigstes Großwort in Streckennamen
- **Datum**: aus `kop.html` (niederländisches Datumsformat → ISO) automatisch vorbelegt
- Debug-Output bereinigt: nur noch relevante Zusammenfassung pro Strecke

---

## v952 – Bugfix: evenementen.uitslagen.nl JSON-Encoding-Fehler

- **Ursache**: PHP's `json_encode()` gibt bei ungültigen UTF-8-Bytes `false` zurück → leere HTTP-Antwort → JS meldet „Server-Fehler: " (leer)
- Betroffen: halve marathon / 10km / 5km mit internationalen Teilnehmern (tschechische, polnische Sonderzeichen in Namen)
- **Fix 1**: `jsonOk()` nutzt jetzt `JSON_INVALID_UTF8_SUBSTITUTE` als Flag; mit mb_convert_encoding-Fallback
- **Fix 2**: `uits-fetch`-Proxy bereinigt HTML vor der Rückgabe via `mb_convert_encoding`

---

## v951 – evenementen.uitslagen.nl: Detaillierter Debug pro Strecke/Seite

- Debug-Log zeigt jetzt pro Strecke und Seite: Zeilenanzahl, hasMore-Status, Fetch-Fehler
- Ermöglicht genaue Diagnose wo Zeilen verloren gehen (hasMore-Bug, Spalten-Mismatch etc.)

---

## v950 – evenementen.uitslagen.nl: Debug-Ausgabe für Namens-Matching

- Debug-Log zeigt jetzt: Anzahl Athleten in DB, erste 5 geladene Namen
- Ermöglicht Diagnose warum uitsAutoMatch() 0 Treffer liefert

---

## v949 – evenementen.uitslagen.nl: Alle Strecken automatisch laden

- Kein „Strecke wählen"-Modal mehr: alle Strecken werden automatisch nacheinander geladen
- Kein Vereinsname-Filter: `evenementen.uitslagen.nl` enthält keinen Vereinsnamen → Matching ausschließlich via `uitsAutoMatch()` gegen Athleten-DB
- Streckenname wird im Debug-Log als Kontext je Ergebnis angezeigt
- Veranstaltungsname wird aus allen geladenen Streckennamen zusammengesetzt

---

## v946 – Bugfix: JS-Cache-Busting und evenementen.uitslagen.nl-Import

- **Hauptursache des „Keine Ergebnisse"-Fehlers**: `build.sh` aktualisierte die Versionsnummer nur im `<span id="header-version">`, aber nicht in den `?v=NNN`-Cache-Busting-Parametern der `<script>`- und `<link>`-Tags → Browser luden seit v942 immer noch v941-JavaScript
- `build.sh` ersetzt jetzt zusätzlich alle `?v=[0-9]+` → `?v=NEWVER` in `index.html`, sodass Browser bei jedem Deploy frische JS/CSS-Dateien laden
- Damit lädt ab v946 der korrekte Code für `evenementen.uitslagen.nl`-Importe (v943-Fix wirkt jetzt endlich)

---

## v945 – Build-Prozess: Automatische Versionsnummerierung

- Neues `build.sh`: liest Version aus `index.html`, erhöht um 1, baut `paket_vXXX.zip`
- `commit.sh`: macOS-Duplikat-Suffix `_1`, `_2` … wird beim ZIP-Namen automatisch abgeschnitten
- Version wird bei jedem Build automatisch hochgezählt – keine manuellen Namenskonflikte mehr

---

## v943 – evenementen.uitslagen.nl Importer

- Neue URL-Erkennung: `evenementen.uitslagen.nl/JJJJ/event-slug/` wird jetzt korrekt verarbeitet
- PHP-Proxy: Regex erweitert um `evenementen.uitslagen.nl`-Subdomain
- JS: Vollständig neuer Importpfad für das Frameset-basierte Altsystem:
  - Lädt `menu.php` und zeigt Strecken-Dropdown (Halbe Marathon, 10 km, 5 km etc.)
  - Holt alle Seiten `uitslag.php?on=N&p=P` sequentiell (max. 50 Seiten / 5.000 Einträge)
  - Fortschrittsanzeige während des Ladens
  - Parst `table.uitslag`-Spaltenstruktur: [2]=Name, [3]=Verein, [5]=Kat-Platz, [6]=Kategorie, [8]=Nettozeit
  - AK-Mapping für evenementen-Kategorie-Codes: Msen→MHK, Wsen→WHK, M35→M35 usw.
  - Filterung und Preview-UI identisch zum bestehenden uitslagen.nl-Importer
- Defekter table-basierter Fallback in `uitsParseHTML()` entfernt

---

## v942 – Jährliche Veranstaltungsserien

- Neue Tabelle `veranstaltung_serien`: Gruppen für jährlich wiederkehrende Veranstaltungen (Name + Kürzel)
- Neues Feld `serie_id` in `veranstaltungen`: Zuordnung einer Veranstaltung zu einer Serie
- Veranstaltungen-Tab: Toggle zwischen „Alle Veranstaltungen" und „Veranstaltungsserien"
- Serien-Übersicht: Karten mit Anzahl Austragungen und Jahreszeitraum
- Serien-Detailseite mit zwei Ansichten:
  - **Ergebnisse nach Jahr**: alle Austragungen chronologisch (neueste zuerst), jeweils mit Ergebnistabelle
  - **Bestleistungen**: Disziplinauswahl → Gesamt, Frauen/Männer, AK-Grid (identische Logik wie Bestleistungen-Tab)
- Veranstaltung-Bearbeiten-Modal: Dropdown zur Serienzuordnung
- Serien-Verwaltung (Admin/Editor): anlegen, bearbeiten, löschen (Veranstaltungen bleiben erhalten)
- Serienname als klickbares Badge in der Veranstaltungsliste sichtbar
- API: neue Endpunkte `veranstaltung-serien` (GET/POST/PUT/DELETE) inkl. Bestleistungen- und Disziplinenliste-Abfrage

---

## v941 – Teilen: Link als klickbarer Markdown-Link

- Beim „Veranstaltung teilen"-Dialog wird der Link im Markdown-Block jetzt als klickbarer Link formatiert (`[Name](URL)` statt reiner URL)

---

## v940 – Bugfix: Dashboard-Fehler „Maximum call stack size exceeded"

- Doppelte `medalBadge`-Definition in `02_app.js` entfernt (selbst-aufrufender Alias verursachte infinite Rekursion)
- Admin Gäste-Tabelle: „Aufrufe"-Spaltentitel rechtsbündig (passend zu den Werten)
- Admin Gäste-Tabelle: Leerzeilen-`colspan` auf 5 korrigiert (war 4)
- Admin Letzte Logins: Spaltenbreiten explizit verteilt, „Benutzer" erhält ausreichend Platz

---

## v939 – Admin: Spaltenausrichtung Gäste/Letzte Logins korrigiert

- Gäste-Tabelle: „Aufrufe"-Spaltentitel jetzt rechtsbündig (passend zu den Werten)
- Letzte-Logins-Tabelle: Spaltenbreiten explizit verteilt, „Benutzer" erhält ausreichend Platz

---

## v937 – Einheitliche AK-Range-Darstellung in HoF und Athletenprofil

- `compressAKList` als globale Funktion extrahiert (war lokal nur in HoF)
- Athletenprofil-Tooltip nutzt jetzt dieselbe Logik wie HoF: konsekutive Teil-Ranges werden zu W35–W45 und W55–W65 zusammengefasst

---

## v936 – Bugfix: Athletenprofil Tooltips nach v935-Regression

- ORDER BY-Alias `kat_sort` in DISTINCT-Query durch direkte COALESCE-Expression ersetzt → SQL-Fehler auf MariaDB behoben

---

## v935 – Athletenprofil: Bestleistungen nach Disziplinkategorie gruppiert

- API gibt `kat_name` für jede Bestleistung zurück (Straße, Halle, Sprint, …)
- Tooltip "Bestleistungen" im Athletenprofil zeigt Kategorien als Abschnitte mit ▸-Header

---

## v934 – Bugfix: Fokusverlust in Ergebnisse- und Veranstaltungssuche

- Fokus bleibt beim Tippen im Suchfeld erhalten, auch wenn sich die Ergebnisse live aktualisieren
- Hilfsfunktionen `_saveFocus` / `_restoreFocus` sichern Fokus und Cursorposition vor jedem innerHTML-Ersatz

---

## v933 – Hall of Fame: Medaillen bei >9 auf gleichmäßige Zeilen aufteilen

- Mehr als 9 Meisterschafts-Medaillen werden gleichmäßig auf mehrere Zeilen verteilt (max. 9 pro Zeile)

---

## v932 – Bugfix: Jugend-AK-Merge-Priorität gegenüber ak_mapping

- `jugend_aks` IN-Clauses kommen jetzt vor `ak_mapping` im SQL-CASE → AKs in `ak_mapping` (z.B. auf sich selbst gemappt) blockieren den Jugend-Merge nicht mehr
- `ak_mapping`-Einträge, deren Ziel in `jugend_aks` liegt, werden direkt zu MHK/WHK aufgelöst

---

## v931 – Admin Altersklassen: Jugend-AK-Merge-Konfiguration

- Neuer Abschnitt "Jugend-AK-Merge-Konfiguration" in Admin → Altersklassen
- Checkboxen für alle Standard-AKs: welche werden bei "Jugend-AK zu MHK/WHK zusammenfassen" einbezogen?
- Speichert Konfiguration in der `jugend_aks`-Einstellung; Buttons "Alle" / "Keine"

---

## v930 – System-Dashboard: Layout Aktiv/Letzte Logins 30/70

- Spaltenbreite der Tabellen "Aktiv" und "Letzte Logins" von 50/50 auf 30/70 angepasst

---

## v929 – Bugfix: Veranstaltungssuche SQL-Fehler (fehlender Alias)

- **Bugfix**: COUNT-Query für Paginierung fehlte Tabellen-Alias `v` → `Unknown column 'v.name' in WHERE`

---

## v928 – Veranstaltungen: Suche nach Name/Kürzel/Ort

- Suchfeld über der Veranstaltungsliste; filtert nach Name, Kürzel und Ort (300ms Debounce)
- API: `?suche=` Parameter an `/veranstaltungen` – serverseitiges LIKE-Filter, Paginierung bleibt korrekt

---

## v927 – Bugfix: Athleten-Tabelle Status-Spaltenüberschrift fehlte

- **Bugfix**: Tabellenüberschrift „Status" fehlte, weil Header und Zeilen unterschiedliche Bedingungen hatten (`_canSeeInaktiveAthleten()` nur im Header) – jetzt einheitlich an `showDetails` geknüpft

---

## v926 – Athleten-Menü für alle eingeloggten Mitglieder sichtbar

- Athleten-Tab wird jetzt für alle eingeloggten Benutzer angezeigt, nicht mehr nur für Nutzer mit dem Recht `personenbezogene_daten`

---

## v925 – Bugfix: Konto-Seite 3-spaltiges Layout wiederhergestellt

- **Bugfix**: `style="konto-grid"` korrigiert auf `class="konto-grid"` – dadurch greift das CSS-Grid wieder korrekt

---

## v924 – Bugfix: Konto-Seite lädt nicht (pb is not defined)

- **Bugfix**: In `_renderKontoPage()` wurde fälschlicherweise `pb.verein` referenziert – korrigiert auf `currentUser.verein`

---

## v923 – System-Dashboard Tabellen mobil verbessert

- **Alle Spalten sichtbar**: Gäste-Tabelle (Browser) und Letzte-Logins-Tabelle (IP, Zeitpunkt) blenden Spalten auf Mobilgeräten nicht mehr aus
- **100% Tabellenbreite**: Globales `display:block` auf `<table>`-Elementen wird für System-Dashboard-Tabellen überschrieben → Zellen füllen nun die volle Breite
- **Persönliche Bestleistungen Dashboard**: Kategorien (Straße, Bahn etc.) werden nebeneinander angezeigt, solange Platz vorhanden

---

## v922 – Admin System-Dashboard responsive

- **phpBB-Statistiktabellen**: `border`/`border-radius`/`overflow` vom `<table>`-Element in einen Wrapper-`<div>` verschoben → Tabelle füllt nun zuverlässig die volle Breite
- **Gäste-Tabelle**: Browser-Spalte auf Mobilgeräten (≤600px) ausgeblendet
- **Letzte Logins**: IP- und Zeitpunkt-Spalten auf Mobilgeräten ausgeblendet; Tabelle in `table-scroll` eingebettet
- Verbleibende Spalten füllen die volle Panel-Breite auf iPhone

---

## v921 – Hall of Fame – Medaillen-Zeile kompakter

- **Hall of Fame Widget**: Medaillen-Emojis sitzen enger zusammen (`gap:1px`, kein `margin`) – einzelne Medaille in zweiter Zeile tritt nicht mehr auf

---

## v920 – Dashboard-Widget „Persönliche Bestleistungen" mobil

- **iPhone/Smartphone**: Disziplin-Kacheln innerhalb einer Kategorie (z. B. Straße) umbrechen jetzt in die nächste Zeile statt seitlich abgeschnitten zu werden
- `flex-wrap:nowrap` → `flex-wrap:wrap` im Button-Container; Kategorie-Sektion nimmt volle Breite ein (`flex:1 1 100%`)

---

## v919 – Dashboard-Layout iPad

- **Dashboard „Letzte Veranstaltungen"**: AK-Badge (z. B. „M45") wird auf iPad nicht mehr mit „…" abgeschnitten
- **CSS**: AK-Spalte auf Tablet-Breakpoint von 11 % → 15 % verbreitert, Athlet-Spalte von 42 % → 38 % angepasst
- **Badge-Padding**: Im AK-Feld der Dashboard-Tabelle von `8 px` auf `5 px` reduziert

---

## v918 – Wartungsmodus

- **Admin → Darstellung → Wartungsmodus**: Checkbox zum Aktivieren/Deaktivieren (sofortige Wirkung)
- **Wartungsseite**: Nicht eingeloggte Besucher sehen statt aller Inhalte eine konfigurierbare Wartungsmeldung
- **Login gesperrt**: Im Wartungsmodus können sich nur Administratoren anmelden; alle anderen erhalten eine Fehlermeldung
- **Rollen & Rechte**: Neues Recht „Im Wartungsmodus einloggen" – damit können einzelne Rollen (z. B. Editoren) gezielt auch im Wartungsmodus zugelassen werden
- **Backend**: Wartungsprüfung in `finalizeLogin()` mit HTTP 503

---

## v917 – Athleten: Überschrift zeigt aktive Gruppe

- Panel-Titel wechselt von „Alle Athleten" zum Namen der gewählten Gruppe (z. B. „Senioren")
- Ohne Gruppenfilter bleibt der Titel „Alle Athleten"

---

## v916 – Athleten: Tabellensortierung repariert

- **Alle Athleten**: Spaltenköpfe waren nicht klickbar (onclick-Attribut hatte fehlende schließende Klammer)
- Sortierung nach Name, Vorname, Jahrgang, AK, Ergebnisse etc. funktioniert wieder

---

## v915 – System-Dashboard: Zweispaltiges Layout wiederhergestellt

- **System-Dashboard** (Admin → System): Grid-Layout war defekt durch doppeltes `style`-Attribut
- Fix: `style="admin-sys-grid"` → `class="admin-sys-grid"` auf beiden Grid-Containern
- Statistik-Tabellen und Aktiv/Logins-Bereich werden wieder zweispaltig dargestellt
- Responsiv: auf iPhone/iPad (≤ 1024 px) weiterhin einspaltig

---

## v914 – Veranstaltung-Detailseite: Navigation

- **Zurück-Button** entfernt (macht keinen Sinn bei extern geteilten Links)
- **Veranstaltungsliste**: Klick auf Event-Titel öffnet Detailseite in neuem Tab
- **Share-Modal**: „Seite öffnen" öffnet ebenfalls in neuem Tab

---

## v913 – Veranstaltungen: Icons & Darstellung

- **Veranstaltungskarten**: Kaputten Text-Link (Datenquelle unter Datum) entfernt
- **Ergebnisquelle-Button**: Icon geändert zu 🌐 (Weltkugel)
- **Teilen-Button**: Icon geändert zu 📤 (Apple-Style Share)

---

## v912 – API: Datenquelle in Veranstaltungsliste

- **API**: `v.datenquelle` im GET-Endpunkt `veranstaltungen` ergänzt – wird nun an das Frontend übergeben und als Link in den Veranstaltungskarten angezeigt

---

## v911 – Bugfixes Veranstaltungen & Admin

- **Veranstaltungen**: Doppelter „Teilen"-Button in Veranstaltungskarten entfernt
- **Veranstaltungen**: Fehlender Datenquelle-Link als Button in der Aktionsleiste ergänzt (erscheint nur wenn Datenquelle gesetzt)
- **Admin**: Abgebrochene Zeile (`'<button class+`) aus Freigabe-Tab-Bereinigung (v910) entfernt – verhinderte JS-Ausführung

---

## v910

- Separaten 'Freigabe'-Tab entfernt
- Ausstehende Veranstaltungen (unveroeff. + geloescht mit Ergebnissen) erscheinen als Block im 'Antraege'-Tab
- Antraege-Badge zaehlt beides
- 'Freigeben'- und 'Wiederherstellen'-Buttons unveraendert

---

## v909

- Separaten 'Freigabe'-Tab entfernt
- Ausstehende Veranstaltungen (unveroeffenlicht / geloescht mit Ergebnissen) erscheinen jetzt als Block im 'Antraege'-Tab
- Antraege-Badge zaehlt beides
- 'Freigeben'- und 'Wiederherstellen'-Buttons funktionieren unveraendert

---

## v908

- **Tabs zusammengefasst**: 'Freigabe' ist jetzt Teil des 'Antraege'-Tabs. Kein separater Tab mehr.
- Antraege-Badge zeigt jetzt kombinierte Anzahl (offene Antraege + ausstehende Veranstaltungen)
- Ausstehende Veranstaltungen erscheinen als eigener Block zwischen 'Offene Antraege' und 'Zuletzt bearbeitet'

---

## v907

- **Venloop wiederherstellbar**: Freigabe-Tab zeigt jetzt auch soft-geloeschte Veranstaltungen die noch Ergebnisse haben (='versehentlich geloescht'). Gekennzeichnet mit '(geloescht)' und 'Wiederherstellen'-Button statt 'Freigeben'
- PUT veranstaltungen/{id}: neuer Parameter 'restore:1' setzt geloescht_am=NULL
- ARROW Venloop (id=589) erscheint damit im Freigabe-Tab -> Wiederherstellen -> sichtbar unter #veranstaltungen

---

## v906

- **Freigabe-Tab zeigte immer 'Keine ausstehenden'**: der ?pending=1-Request wurde vom allgemeinen GET-Handler (ohne pending-Check) abgefangen, der jsonOk()+exit aufruft. Fix: pending-Handler vor den allgemeinen GET-Handler verschoben. Venloop (genehmigt=0) wird jetzt korrekt angezeigt.

---

## v905

### Admin -> Freigabe
- Neuer Subtab 'Freigabe' (Klemmbrett-Icon) in der Admin-Navigation
- Zeigt alle Veranstaltungen mit genehmigt=0 (werden unter #veranstaltungen nicht angezeigt)
- 'Freigeben'-Button setzt genehmigt=1 per PUT veranstaltungen/{id}
- Badge zeigt Anzahl ausstehender Veranstaltungen (wie Antraege-Badge)
- PHP: PUT veranstaltungen/{id} unterstuetzt jetzt genehmigt-Feld; GET veranstaltungen?pending=1 gibt alle pending zurueck

---

## v904

- **AK-Platz 1 fuer alle behoben**: _toSec() entfernte HTML-Tags mit replace(/<[^>]+>/g,'') -> '0:14:43  20.4 km/h' -> letztes Segment '43  20.4 km/h' -> NaN -> alle hatten den gleichen Key -> Rang 1. Fix: replace(/<.*$\/,'') schneidet ab dem ersten '<' ab -> '0:14:43' -> korrekte Sekundenumrechnung

---

## v903

- **AK-Platzierung (5km)**: wird jetzt aus ALLEN geladenen Teilnehmern (pageSize=12000) berechnet, nicht nur aus den gematchten TuS-Athleten. Alle Zeilen werden nach AK gruppiert und nach Nettozeit sortiert -> korrekter Rang im gesamten Teilnehmerfeld. Beispiel: Oliver Marissen 5km -> rank unter allen M55-Teilnehmern der LIVEC3

---

## v902

- **AK-Platzierung (5km)**: Wo keine Categorie-Pos-Spalte vorhanden (LIVEC3), wird der AK-Rang aus allen geparsten Zeilen berechnet: alle Zeilen mit gleicher AK+Disziplin nach Zeit sortieren, Rang = Position in dieser Gruppe. Gilt nur als Fallback wenn akPlatzIdx=-1 (kein Wert aus API)

---

## v901

- **AK-Platzierung**: LIVEC3 (5km) hat keine 'Pos'-Spalte in der Categorie-Gruppe -> akPlatzIdx=-1 -> Fallback war bisher der Gesamtrang (rankRaw). Fix: leerer String wenn kein AK-Platz vorhanden

---

## v900

- **5km fehlte**: RowAction-Suffix '_3' bedeutet NICHT 'Teamresultaten' – der Suffix entspricht einfach der Ziffer im Race-ID (LIVEC3 -> _3, aber individuelles 5km-Rennen). Echter Indikator: leere Nettozeit-Spalte. LIVEA3/LIVEB3 haben keine Nettozeit -> Teamresultaten. LIVEC3 hat 0:14:43 -> Individual. RowAction-Check vollstaendig entfernt.

---

## v899

- **Teamresultaten-Erkennung**: pruefte nur rows[0] -> LIVEC3 (5km) hatte zufaellig '_3' in Zeile 0 und wurde gefiltert. Fix: erste 10 Zeilen werden geprueft; nur wenn ALLE _3-Links haben wird als Teamresultaten eingestuft

---

## v898

- **uitsAutoMatch**: Athleten mit aktiv=false werden beim Bulk-Import-Matching uebersprungen (Daniela Frenzel trifft nicht mehr Daniel Frenzel)

---

## v897

- **Datum-Fix**: bk-datum ist type='date' und hat immer today als Defaultwert -> !datEl.value war immer false -> Datum wurde nie ueberschrieben -> Venloop: 30.03.2026 statt 29.03.2026. Fix: datEl.value wird jetzt immer auf evDate gesetzt (aus ctx: 20260329_venlo -> 2026-03-29)

---

## v896

- **Einzelseite Veranstaltung**: komplett auf dieselben Hilfsfunktionen wie Veranstaltungsseite
  - akBadge() fuer AK (dunkelblaue Pill), platzBadge() fuer Platzierung (Kreis-Badge)
  - class='result' fuer Zeiten (Primaerfarbe), class='ort-text' fuer Pace
  - calcPace()/diszKm() fuer Pace; veranst-dash-table + vcol-* fuer gleiche Spaltenbreiten
- Rebuild: v895 hatte Datei-Truncation-Bug, vollstaendig auf v892-Basis neu aufgebaut

---

## v895

- **Hotfix**: 'veranstaltung' fehlte in validTabs -> restoreFromHash ignorierte den Hash -> Startseite. Behoben.
- Anonyme Nutzer duerfen die Veranstaltungs-Einzelseite jetzt ebenfalls aufrufen (kein Login erforderlich fuer geteilte Links)

---

## v894

- Zurueck-Button auf der Veranstaltungs-Einzelseite entfernt (Seite wird direkt verlinkt, kein Browserverlauf garantiert). Nur noch Teilen-Button oben rechts.

---

## v893

### Neue Funktion: Veranstaltung teilen
- **Teilen-Button** (🔗) auf jeder Veranstaltungskarte
- **Teilen-Modal**: Direktlink zum Kopieren + Markdown-Text zum Kopieren (mit Tabellen je Disziplin + Link am Ende)
- **Einzelseite** #veranstaltung/{id}: zeigt Veranstaltungsdaten exakt wie auf der Veranstaltungsseite, incl. Datenquellenlink. Aufrufbar per direktem Link (auch ohne Login, wenn Portal oeffentlich)

---

## v892

- **Hotfix**: _athSortHeader() verwendete die lokale Variable 'canSeeInaktive' aus _renderAthletenTable() – ausserhalb ihres Scope. Fix: ersetzt durch _canSeeInaktiveAthleten() (die globale Hilfsfunktion)

---

## v891

### Datenquelle
- **Bulk-Formular**: neues Feld 'Datenquelle (URL)' wird automatisch mit der eingelesenen URL befüllt
- **Veranstaltung**: datenquelle wird beim Anlegen gespeichert (DB-Migration: ALTER TABLE ADD COLUMN)
- **Veranstaltungsseite**: Datenquelle als klickbarer Link in der Veranstaltungskarte angezeigt
- Reset leert auch das Datenquelle-Feld

### Datum
- Das Datum-Feld (type=date) wird vom ACN-Importer korrekt mit '2026-03-29' (ISO) befüllt; bulkAddRow konvertiert zu 'DD.MM.YYYY' fuer jede Zeile. Falls das Venloop-Datum falsch war, wurde es mit einer alten Version importiert – bitte Veranstaltungsdatum manuell korrigieren.

---

## v890

- **ACN AK-Platzierung**: col[17] (GroupDisplayName='Categorie') enthaelt die AK-Platzierung ('97/634' -> '97'). Vorher wurde col[0] (Gesamtrang '2343.') verwendet
- **'Schlechten Import melden'**: Button von Post-Import-Actions (nach Einlesen) nach unten neben 'Alle speichern' verschoben – immer sichtbar wenn GitHub konfiguriert; Reset bleibt alleine in der Post-Import-Leiste

---

## v889

- Syntax-Fehler in _PREPS-Objekt behoben ('dos:1' hatte fehlendes Abschluss-Quote)

---

## v888

### ACN Importer
- **10km fehlte**: LIVEB2 hat RowAction-Spalte mit '_2'-Links (Individual-Detail, OK) – nur '_3'-Links sind Teamresultaten. Filter jetzt korrekt
- **Veranstaltungsname**: prod.chronorace.be/api/Event/view/{uuid} liefert Title ('ARROW Venloop') – wird ins bk-evname-Feld eingetragen

### uitsAutoMatch
- **Praepositionsfilter**: von/van/de/der/den/des/ter/ten etc. werden aus Nachnamen-Tokens herausgefiltert. 'Gitta VAN DER MOLEN' trifft nicht mehr 'von der Burg-Hellermann, Gitta'
- **Umlaut-Normalisierung auf BEIDEN Seiten** jetzt konsequent in _un()

---

## v887

- **Matching verschaerft**: Nachname UND mindestens ein Vorname-Token muessen uebereinstimmen
- **Umlaute**: beide Seiten normalisiert (Heiss=Heiß)
- **Bindestrichnamen**: 'Burg-Hellermann' -> ['burg','hellermann']
- **Falsch-Treffer behoben**: 'Gitta WOLTERS' != Burg-Hellermann; 'Thomas BURG' != Gitta

---

## v886

### Admin responsive
- **Subtabs**: scrollen horizontal auf Smartphone, kleinere Schrift
- **Konto**: 3-spaltig (200px/1fr/1fr) -> 1-spaltig auf Tablet/Smartphone (konto-grid Klasse)
- **Admin System**: 2-spaltige Uebersicht -> 1-spaltig auf Smartphone (admin-sys-grid)
- **Darstellung/Einstellungen**: settings-input volle Breite auf Tablet+Smartphone
- **Datentabellen**: overflow-x:auto + min-width fuer horizontales Scrollen
- **Antraege 'Zuletzt bearbeitet'**: done-table-wrap mit overflow
- **Benutzer-Zeilen**: flex-wrap fuer Aktions-Buttons
- **Bulk-Tabelle**: overflow-x:auto
- **iOS zoom fix**: 16px Fontgrösse fuer alle Inputs im Admin

---

## v885

- **Falsch-Treffer behoben**: 'Alex ALEX WOLTERS' hat Giozis, Alexander getroffen weil startsWith('alex') == true. Neue Regel: Prefix-Match nur erlaubt wenn beide Token >= 5 Zeichen UND kuerzerer >= 80% des laengeren abdeckt. 'Alex' (4 Zeichen) matcht 'Alexander' (9 Zeichen) nicht mehr
- Umlaute (Heiss/Heiß) und echte Abkuerzungen (Thomas/Tom ab 5+4 Zeichen) bleiben erhalten

---

## v884

- **Disziplin-Matching**: uitsAutoDiszMatchKat kennt NL-Namen ('Halve Marathon') nicht -> gab 300m zurueck -> beide Eintraege hatten disziplin='' -> Laufserie-Dialog. Fix: acnFindDisz() sucht direkt per Namen inkl. NL/DE-Aliase (Halve Marathon=Halbmarathon, 21km=Halbmarathon, 42km=Marathon)
- Oliver Marissen: 1x Halbmarathon + 1x 5km = zwei verschiedene Disziplinen = kein Laufserie-Dialog

---

## v883

- **Laufserie Marissen behoben**: LIVEC3 (5km) hat keine Split-Spalten -> diszHint war leer -> AK-Fallback ergab '300m'. Fix: Disziplin wird jetzt aus der Siegerzeit abgeleitet (<20min=5km, 20-45min=10km, >45min=Halve Marathon)
- Kids Runs (Siegerzeit <5min) werden weiterhin uebersprungen

---

## v882

- **Hotfix**: Variablenname-Tippfehler 'ni' statt 'nettoIdx' in der Zeitvalidierung -> sampleNet war immer leer -> alle Rennen wurden uebersprungen

---

## v881

- **Laufserie-Dialog**: LIVEA3/LIVEB3/LIVEC3 sind Teamresultaten (enthalten 'RowAction'-Spalte und 'detail:...' statt Zeiten) – werden jetzt erkannt und uebersprungen
- Zusaetzliche Pruefung: Rennen ohne gueltige Nettozeit im ersten Datensatz werden ebenfalls uebersprungen

---

## v880

### ACN Timing Importer v3
- **NaN-Zeiten behoben**: Netto-Spaltenindex wird dynamisch aus TableDefinition.Columns ermittelt (col 16 fuer HM, col 12 fuer 10km, col 11 fuer Kids Runs) – nicht mehr hardcodiert
- **Disziplin aus Split-Namen**: Splits '20km' -> 'Halve Marathon', '5km' (einzig) -> '10km'; kein Fallback mehr auf AK ('M55' -> '300m')
- **Kids Runs gefiltert**: Rennen ohne Disziplin-Hinweis und sehr kurze Zeiten (<5min) werden uebersprungen; AK 'J'/'B'/'P'/'K' wird ignoriert
- Deduplizierung per Name+Zeit+RaceID

---

## v879

- **ACN Label**: zeigte 'uitslagen.nl' nach URL-Eingabe -> zeigt jetzt 'ACN Timing'
- **ACN /cms/CAP**: alle /cms/-Pfade (CG_1, CAP, etc.) loesen Auto-Discovery aus – nur /home/LIVE... wird als einzelne Strecke behandelt
- Die Fehlermeldung 'Keine Race-URL' kam vom alten Importer (v877) – v878 hat das bereits behoben, aber das Deploy fehlte

---

## v878

### ACN Timing Importer – Auto-Discovery
- Uebersichts-URL (/cms/CG_1) funktioniert jetzt direkt – kein Klick auf 'Resultaten' noetig
- Importer probt alle 90 moeglichen Race-IDs (LIVE{A-K}{1-9}) parallel in einem Schritt
- Alle gefundenen Strecken werden gleichzeitig (parallel) geladen und zusammengefuehrt
- Duplikate (z.B. Einzel vs. Team-Ergebnisse) werden per Name+Zeit dedupliziert
- Debug-Log zeigt gefundene Strecken mit Teilnehmerzahl
- Einzelne Strecken-URL funktioniert weiterhin

---

## v877

### Neuer Importer: ACN Timing (acn-timing.com)
- URL-Erkennung fuer acn-timing.com
- API: results.chronorace.be/api/results/table/search/{ctx}/{raceId}?pageSize=12000
- Kein Vereinsname in den Daten -> Matching per Athletenname (_normUmlauts, uitsAutoMatch)
- AK-Mapping: Msen/Vsen -> Msen/Wsen, M35/V35 -> M35/W35 usw.
- Datum + Ort werden automatisch aus dem ctx-Parameter (YYYYMMDD_ort) befuellt
- Debug-Log zeigt alle Schritte inkl. Probe-Namen wenn kein Treffer
- Bitte Ergebnisseite einer Strecke verwenden (nach Klick auf 'Resultaten')

---

## v876

- **Hotfix**: GitHub-Token-Ablaufdatum wurde zwar berechnet aber nie in das System-Dashboard-Template eingefuegt. Jetzt korrekt nach PHP-Version angezeigt.

---

## v875

- **Admin -> Darstellung -> GitHub**: neues Feld 'Token laeuft ab am' (Datumseingabe)
- **System-Dashboard**: zeigt Ablaufdatum + verbleibende Tage; rot + fett wenn < 14 Tage
- Hintergrund: GitHub-API liefert den Expiry-Header nicht fuer alle Token-Typen; manuelles Datum ist zuverlaessiger

---

## v874

- **System-Dashboard**: zeigt Ablaufdatum des GitHub-PAT (via api.github.com/rate_limit Header 'github-authentication-token-expiration')
- Bei weniger als 14 Tagen Restlaufzeit: roter Text + fett
- Nur sichtbar wenn github_repo + github_token konfiguriert sind

---

## v873

- **rolleLabel**: 'admin' zeigte internen Namen statt 'Administrator' wenn label=null. Fix: rd.label || m[r] || r
- **GitHub Issue Modal**: nach Issue-Erstellung oeffnet sich ein Modal (Issue-Nr. + Link) statt window.open
- **Bulk Reset**: leert jetzt vollstaendig (Debug-Log, Veranstaltungsfelder, _bkDbgLines)
- **Umlaut-Matching**: _normUmlauts() - Heiss=Heis, ae/oe/ue bidirektional

---

## v872

- **rolleLabel**: rd.label war null fuer 'admin' → zeigte 'admin'. Fix: Fallback-Reihenfolge ist jetzt rd.label → m[r] → r, d.h. bei null wird 'Administrator' aus der Hardcode-Map verwendet
- **Schlechten Import melden**: oeffnet jetzt ein Modal mit Bestaetigung statt window.open. Das Modal zeigt Issue-Nummer und -Titel; optionaler Link zum Issue-Ansehen bleibt verfuegbar

---

## v871

- **Bulk Reset**: leert jetzt auch Debug-Log, Veranstaltungsfelder (Datum/Ort/Name), Importkategorie-Auswahl und _bkDbgLines-Array
- **Umlaut-Matching**: neue Funktion _normUmlauts() normalisiert ß→ss, ä→ae, ö→oe, ü→ue (und umgekehrt) vor dem Vergleich – 'Heiss, Theo' findet jetzt 'Heiß, Theo' in der DB

---

## v870

- **rolleLabel**: admin-Label war null in _rollenMap → zeigte 'admin' statt 'Administrator'. Fix: Fallback-Map wird nach _rollenMap geprüft
- **PB-Farben Athletenprofil**: Vereins-Ergebnisse in var(--primary), externe PBs (verein gesetzt) in var(--text)
- **Anträge Zuletzt bearbeitet**: Antragsteller zeigt Athletenname statt E-Mail; Header korrekt (6 Spalten)
- **System-Dashboard**: Portal-Version als erste Zeile

---

## v869

- **Hotfix**: Funktion _renderHeaderAvatar() fehlte seit v863 → Safari ReferenceError 'Can't find variable: _renderHeaderAvatar' / weisse Seite
- Funktion aus v849 exakt wiederhergestellt

---

## v868

- **Hotfix**: Funktion _renderHeaderAvatar() fehlte seit v863 (durch Merge-Fehler entfernt) → Safari ReferenceError und weisse Seite
- Funktion wiederhergestellt aus v849

---

## v867

- **Hotfix**: rolleLabel()-Funktion war durch Merge-Fehler in v865 korrumpiert (Avatar-Code eingebettet) -> weisse Seite. Behoben.
- **Schlechten Import melden**: Issue enthaelt jetzt das komplette Import-Debug-Log (_bkDbgLines) plus Rohtext, Version und User als Kontext

---

## v866

### GitHub-Integration
- **Admin → Darstellung**: neue Sektion 'GitHub-Integration' mit Repository (owner/repo) und Personal Access Token
- Daten werden in einstellungen gespeichert

### Bulk-Eintragen
- Nach dem Einlesen: Einlesen-Button verschwindet, stattdessen erscheinen:
  - **Reset**: leert die Tabelle, zeigt Einlesen-Button wieder
  - **Schlechten Import melden** (nur wenn GitHub konfiguriert): erstellt automatisch ein GitHub Issue mit URL, eingelesenen Daten, Rohtext, Version und Zeitstempel – öffnet Issue direkt im Browser

---

## v865

- **Athlet*in → Athlet**: 10 Stellen hardcodiert auf 'Athlet' (Spaltenheader, Labels, Buttons)
- **Ergebnisse 'Eingetragen'**: Spalte heißt 'Eingetragen von'; zeigt Vor+Nachname aus Athletenprofil (LEFT JOIN athleten)
- **Athleten Status-Spalte**: bereits korrekt – nur sichtbar wenn canSeeInaktive
- **System-Dashboard**: Portal-Version (aus app.js?v=X) als erste Zeile
- **Anträge Zuletzt-Tabelle**: Header korrigiert (7 Spalten), Kommentar entfernt
- **Externe Ergebnisse**: isExternal-Pfad geht jetzt auch durch ergebnisse/eigenes → Antrag statt sofort freischalten
- **Athletenprofil PB-Farben**: Externe PBs (pb.verein gesetzt) in var(--text), Vereins-PBs in var(--primary)
- **GitHub Issues**: native Schnittstelle nicht verfügbar (erfordert OAuth-Token) – kein sinnvoller Quick-Fix möglich

---

## v864

- **Veranstaltung pending**: genehmigt=0 Veranstaltungen (von Athleten eingereicht) sind erst nach Genehmigung in der Veranstaltungsliste und im Dashboard sichtbar (WHERE genehmigt=1)
- **Badge-Farbe**: Admin-Nav-Badge und Admin-Subtab-Badges verwenden jetzt var(--accent) statt hartem Rot – auf der roten Navigationsleiste deutlich besser erkennbar

---

## v863

- **Antragsteller**: Athletenname (vorname+nachname) statt benutzername/E-Mail in offenen Anträgen und 'Zuletzt bearbeitet'
- **Veranstaltung**: Spalte mit Datum + Name in 'Zuletzt bearbeitet'; im offenen Antrag bereits vorhanden
- **Bearbeitet von**: neue Spalte in 'Zuletzt bearbeitet' mit Athletenname des bearbeitenden Admins
- **Ergebnis-ID**: bei typ='insert' leer (macht Sinn – Ergebnis existiert erst nach Genehmigung); nach v861-Approval wird ID gespeichert

---

## v862

- **Sicherheit**: canEdit war true für Rolle 'athlet' → Edit/Delete-Buttons und Spalte 'Eingetragen von' für Athleten sichtbar. Fix: canEdit nur für admin/editor
- **Spalte 'Eingetragen'**: nur sichtbar wenn canEdit (admin/editor)
- **F5 auf #ergebnisse**: state.subTab war null → API-Route 'null?limit=...' → 404. Fix: restoreFromHash setzt subTab='strasse' wenn kein Sub im Hash

---

## v861

- **Root cause**: Beide Marathon-Anträge wurden genehmigt bevor v858 deployed war – der INSERT-Code fehlte noch, ergebnis_id blieb NULL, kein Ergebnis wurde angelegt
- **Migration**: Beim ersten API-Aufruf nach v861-Deploy werden alle approved insert-Anträge mit ergebnis_id=NULL automatisch nachverarbeitet (Ergebnis anlegen, Veranstaltung genehmigen)
- **Going forward**: Approval-Handler speichert jetzt auch die neue ergebnis_id im Antrag

---

## v860

- **Externes PB eintragen (Athlet)**: /athleten/{id}/pb erforderte requireEditor() → Athleten bekamen 'Keine Berechtigung'. Fix: requireLogin() + Prüfung ob eigenes Profil
- **Veranstaltung löschen (FK-Fehler)**: Beim endgültigen Löschen aus Papierkorb wurde ergebnisse-Tabelle nicht berücksichtigt → SQLSTATE[23000] FK-Constraint. Fix: DELETE aus ergebnisse UND Legacy-Tabelle vor DELETE aus veranstaltungen
- **Soft-Delete**: UPDATE geloescht_am jetzt auf ergebnisse UND Legacy-Tabelle bei Veranstaltung in Papierkorb verschieben

---

## v859

- **Root cause Menü-Flackern**: buildNav() rief _ladeAntraegeBadge() per setTimeout auf; _ladeAntraegeBadge() rief am Ende buildNav() auf → Endlosschleife, die Nav re-rendert sich hunderte Male pro Sekunde
- **Fix**: _ladeAntraegeBadge() ruft NICHT mehr buildNav() auf, sondern aktualisiert den Admin-Nav-Button direkt per querySelector auf .nav-label → kein Re-Render, kein Loop

---

## v858

- **Bugfix**: Beim Genehmigen eines Antrags (typ='insert') wurde kein Ergebnis angelegt
- Der Approval-Handler behandelte nur 'delete' und 'update' – 'insert' wurde stillschweigend ignoriert
- Fix: neuer elseif-Zweig für typ='insert': legt das Ergebnis in ergebnisse an und setzt genehmigt=1 auf der Veranstaltung

---

## v857

- **Admin-Nav-Badge**: Zähler wird jetzt direkt beim Aufbau der Nav in buildNav() aus window._adminPendingAntraege + window._adminPendingRegs gelesen und in das Label eingebettet – kein nachträgliches querySelector-Patching mehr
- Nach dem ersten Laden ruft _ladeAntraegeBadge() buildNav() neu auf → Badge aktualisiert sich konsistent
- Prinzip identisch zu Subtab-Badges: gecachte window-Variablen, direkt im HTML-String

---

## v856

- **Bugfix**: adminSubtabs() hatte \\U0001f4dd / \\u270b als literal Python-Unicode-Escapes statt echte UTF-8-Bytes → Browser zeigte 'U0001F4DD REGISTRIERUNGEN' statt '📝 Registrierungen'
- Fix: echte UTF-8-Bytes ✋ 📝 🗑️ direkt in den JS-String-Literalen

---

## v855

- **Root cause**: _ladeAntraegeBadge() setzte Badges per querySelector auf die Buttons – aber bei jedem Subtab-Wechsel rendert adminSubtabs() die Buttons neu als statisches HTML ohne Badges → Badges verschwinden
- **Fix**: adminSubtabs() liest window._adminPendingAntraege / _adminPendingRegs / _adminPendingPapierkorb direkt aus und bettet die Badges in die HTML-Strings ein
- Badges bleiben jetzt bei jedem Re-Render erhalten

---

## v854

- **Farbe**: Admin-Badges jetzt hart rot (#e53935) statt blau
- **Nav-Badge**: Registrierungen + Anträge werden als kombinierter Badge direkt am 'Admin'-Nav-Button angezeigt – auch von anderen Seiten aus sichtbar
- **Sofortiges Laden**: _ladeAntraegeBadge() wird auch in buildNav() aufgerufen (150ms verzögert, nicht blockend) – kein Warten mehr bis Admin-Tab geöffnet wird
- Zähler werden in window._adminPendingAntraege / _adminPendingRegs zwischengespeichert

---

## v853

- **Initial State**: subTab startet jetzt als null statt 'strasse' – kein falscher Wert beim Seitenstart
- **Hard Guard** (direkt vor var isBulk): if (!_canBulkEintragen()) → immer zu eigenes/keine Berechtigung
- **restoreFromHash**: eintragen-Tab setzt subTab=null (kein URL-Hash-Bypass mehr)
- **Backend**: requireEditor() auf POST ergebnisse/bulk (seit v850)

Vierfach abgesichert – kein Pfad führt mehr zu Bulk-Inhalt für Athleten

---

## v852

- **1. restoreFromHash**: 'bulk' aus validEint entfernt – URL #eintragen/bulk setzt state.subTab nicht mehr direkt
- **2. Hard Guard**: Unmittelbar vor dem Bulk-Content ein expliziter _canBulkEintragen()-Check mit return – egal wie state.subTab gesetzt wurde
- **3. Backend**: requireEditor() auf POST ergebnisse/bulk (seit v850)

Kein Code-Pfad kann mehr Bulk-Inhalt für einen Athleten rendern.

---

## v851

- **Root cause**: state.subTab ist initial 'strasse'. restoreFromHash() setzte bei #eintragen ohne Sub nur state.tab, nie state.subTab. renderEintragen() prüfte nur auf null und 'bulk' – 'strasse' passierte den Check, und der Code fiel durch zur Bulk-Darstellung.
- **Fix 1**: restoreFromHash() setzt state.subTab = null wenn tab='eintragen', bevor ein etwaiges Sub gesetzt wird
- **Fix 2**: renderEintragen() prüft jetzt ob subTab in ['bulk','eigenes'] ist – jeder andere Wert (auch 'strasse') löst den Permission-Reset aus

---

## v850

- **Sicherheit Backend**: POST ergebnisse/bulk nutzte requireAthlet() → jeder eingeloggte Athlet konnte Bulk-Ergebnisse eintragen. Fix: requireEditor()
- **Sicherheit Frontend**: currentUser bei Login hatte kein rechte-Feld → _canBulkEintragen() konnte in Timing-Window fehlerhaft auswerten. Fix: alle 8 Login-Pfade setzen jetzt rechte: (r.data.rechte || [])

---

## v849

- **Root cause**: Handler für POST ergebnisse/eigenes lag im $res==='benutzer'-Block → Unbekannte Route
- Fix: Handler als eigener Top-Level-Block if ($res==='ergebnisse' && $id==='eigenes')

---

## v848

- **Ursache**: CONCAT(a.vorname, a.nachname) ohne GROUP BY / Aggregat → auf all-inkl.com (MySQL strict mode ONLY_FULL_GROUP_BY) SQL-Error → Max Mustermann verschwand
- Fix: MAX(a.vorname), MAX(a.nachname) – da jeder Benutzer max. ein Athletenprofil hat, ist MAX() identisch mit dem direkten Wert

---

## v847

- Aktive Benutzer: Athleten-Name (vorname+nachname) wird jetzt für ALLE Benutzer im seitenaufrufe-JOIN via LEFT JOIN auf athleten geladen
- Vorher: nur der aktuelle Admin bekam den Athleten-Namen; andere Benutzer sahen nur E-Mail

---

## v846

- **Aktiv root cause**: SELECT enthielt b.vorname/b.nachname – diese Spalten existieren in der benutzer-Tabelle nicht → stille Exception → leeres Array. Fix: Name kommt aus verknüpftem Athletenprofil via separatem JOIN
- **Doppelte Login-Einträge**: loginStep1 schrieb Row bei Passworterfolg, dann schrieb email-code-verify nochmal. Eintrag aus loginStep1 entfernt → 1 Zeile pro Login
- **TOTP-Login**: login_versuche-Eintrag mit methode='totp' in loginStep2 ergänzt

---

## v845

- **Root cause**: $_SESSION['user_id'] war zum Zeitpunkt des admin-dashboard-Handlers möglicherweise nicht mehr verfügbar (Session-State unklar auf all-inkl.com)
- **Fix**: requireAdmin() gibt das User-Array zurück – $adminUser['id'] ist garantiert gesetzt wenn der Code erreicht wird

---

## v844

- **Aktiv**: Wer admin-dashboard aufruft, erscheint jetzt IMMER in 'Aktiv' (direkte DB-Abfrage mit Session-User-ID)
- Weitere aktive Benutzer kommen weiterhin aus seitenaufrufe JOIN
- Hintergrund: benutzer_id im ping-Call ist auf dem Live-Server aus ungeklärtem Grund NULL

---

## v843

- **Aktiv**: Abfrage nutzt seitenaufrufe JOIN statt letzter_aktivitaet-Spalte (die auf dem Live-Server nicht existiert)
- **Login-Methode**: login_versuche hat neue Spalte 'methode' (password/email/passkey), Badge im Login-Log
- **Doppelter Name**: Untertitel wird nur angezeigt wenn benutzername != anzeigeName

---

## v842

- **Aktiv**: try/catch um aktive-Abfrage – wenn letzter_aktivitaet-Spalte fehlt, leeres Array statt Crash
- **Letzte Logins**: Lookup-Map enthält jetzt auch Vorname als Key (z.B. 'Daniel') → historische login_versuche-Einträge vor der E-Mail-Migration werden korrekt aufgelöst

---

## v841

- **Letzte Logins**: login_versuche-Eintrag fehlte bei E-Mail-Code- und Passkey-Login
  - loginStep1 (Passwort) schrieb schon → war bekannt
  - email-code-verify und passkey-auth-verify riefen nur finalizeLogin auf → kein Eintrag
  - Fix: beide Pfade schreiben jetzt ebenfalls IP + E-Mail in login_versuche
- **Aktiv**: letzter_aktivitaet-Update läuft bereits korrekt – nach erstem Deploy und API-Call sollte es erscheinen

---

## v840 – Hotfix

- **Ursache v839-Bug**: Block-Ersetzung via Python hat \u00e4 zu \\u00e4 verdoppelt → Vergleiche wie 'Gesamtbestleistung Männer' schlugen fehl, Regex /\d/ matchte nicht mehr auf Ziffern
- Alle betroffenen Strings und Regex-Patterns im HoF-Badge-Renderer auf korrekte Escapes zurückgesetzt
- gesamtAll-Logik für 'Gesamtbestleistung' (ohne Geschlecht) bleibt erhalten

---

## v839

- **Root cause**: HoF-Karte prüfte nur 'Gesamtbestleistung Männer' / 'Gesamtbestleistung Frauen' als gold-Flag
- Athleten mit 'Gesamtbestleistung' (Tier 1, bestes über alle) wurden nicht als gesamt erkannt
- Folge: Knipper's 7 Gesamtbestleistungs-Disziplinen wurden nicht zu einer Gruppe zusammengefasst
- Fix: gesamtAll-Flag für 'Gesamtbestleistung' (ohne Geschlecht), gesamt = gesamtM || gesamtW || gesamtAll
- Alle 7 Disziplinen gruppieren jetzt zu einer Zeile 'Gesamtbestleistung über 100m Hürden, Diskuswurf, ...'

---

## v838

- **Root cause**: auszeichnungen-Endpoint rief buildAkCaseExpr() in jeder Disziplin-Iteration neu auf statt einmalig vor der Schleife
- **Fix**: $akExprAusz wird einmalig vor dem Disziplin-Loop gebaut und überall wiederverwendet
- **Params-Fix**: myAKs-Query hatte 4 Params für 2 Platzhalter – korrigiert auf 2
- Resultat: Epanda/Hückelhoven AKs werden jetzt korrekt zusammengeführt (W11+W12→WU12 etc.)

---

## v837

**Root cause**: auszeichnungen-Endpoint hatte 'continue' nach Tier 1 (Gesamtbestleistung) → übersprung alle AK-Checks für diese Disziplin. HoF-Endpoint prüft AK immer.

**Fix**: Kein 'continue' nach Tier 1. Tier 3 (AK) läuft immer. Ausnahme: AK-Wert identisch mit dem bereits gezählten Gesamtbestleistungs-Wert → wird übersprungen (wäre Doppelzählung).

Beispiel Meyer 800m: Gesamtbestleistung aus M65-Jahr → erscheint als 'Gesamtbestleistung'. M45/M50/M55-Rekorde aus früheren Jahren → eigene Werte → erscheinen als separate 'Bestleistung M45' etc.

---

## v836

**Root cause**: HoF-Endpoint fehlte Tier 1 (Gesamtbestleistung über alle Geschlechter/AKs)

**3-Tier-System (jetzt identisch zu auszeichnungen):**
- Tier 1: Gesamtbestleistung (bestes über ALLE) → 'Gesamtbestleistung', Tier 2+3 übersprungen
- Tier 2: Geschlechts-Bestleistung (nur wenn nicht Tier 1) → 'Gesamtbestleistung Männer/Frauen'
- Tier 3: AK-Bestleistung (immer, unabhängig von Tier 2; nur übersprungen wenn identisch mit Tier 1)

**Ergebnis**: Simons 300m Hürden = Gesamtbestleistung → 1 Eintrag (nicht 2); W45/15km = Tier 2 + Tier 3 separat

---

## v835

- **Rückgängig v834-Überfixing**: hasGenderBest hat AK-Titel zu aggressiv übersprungen
- **Korrekte Logik**: AK-Titel wird nur übersprungen wenn (a) Athlet bereits Geschlechts-Bestleistung hält UND (b) der Wert identisch ist (= dieselbe Leistung, nur in anderer AK gewertet)
- Beispiel W35: Rekord in 15km kann identisch mit Gesamtbestleistung Frauen sein → kein Doppel; W40, W55, W60-Rekorde sind eigene Leistungen → bleiben erhalten
- Beispiel Simons: M75-Rekord identisch mit Männer-Bestleistung → kein Doppel

---

## v834

- **Ursache**: Ein Athlet der Geschlechts-Bestleistung hält (z.B. Bestleistung Männer 300m Hürden) bekam zusätzlich die AK-Bestleistung (Bestleistung M75) → Doppelzählung
- **Fix**: HoF-Endpoint überspringt AK-Titel wenn Athlet in dieser Disziplin bereits Geschlechts-Bestleistung hat (identische Logik wie auszeichnungen-Endpoint)
- **JS**: Gold-Erkennung erweitert auf 'Bestleistung Männer'/'Bestleistung Frauen' (Labels vom auszeichnungen-Endpoint)

---

## v833

- **Athletenprofil**: Badge zeigte Anzahl der Titelgruppen (15) statt Einzeltitel (20)
- Tooltip gruppiert weiterhin nach Label+Jahre (korrekte Darstellung)
- Zähler nutzt jetzt ausz.meisterschaften.length (= alle Einzeltitel)

---

## v832

- **Migration**: benutzername wird auf email gesetzt für alle Accounts die noch den alten internen Namen haben
- **Migration**: inaktive_athleten_sehen wird automatisch zu admin- und editor-Rollen in der Datenbank hinzugefügt (idempotent)
- Standard-Rollen (Neuinstallationen) enthalten inaktive_athleten_sehen für admin und editor

---

## v831 – Neues Recht

- **inaktive_athleten_sehen**: steuert ob inaktive Athleten in der Athletenliste angezeigt werden
- Vorher: an 'athleten_details' gekoppelt (semantisch falsch)
- Jetzt: eigenes Recht, standardmäßig admin + editor; Athlet-Rolle bekommt es nicht
- Migration: bestehende admin/editor-Rollen erhalten das Recht automatisch

---

## v830

- **Aktive Benutzer**: Primärquelle jetzt seitenaufrufe-Tabelle (benutzer_id JOIN) – funktioniert unabhängig von letzter_aktivitaet-Spalte
- **E-Mail als Login-Kennung**: Session, login_versuche, Benutzertabelle UI (v828/v829 akkumuliert)
- **Login-Versuche**: anzeigeName aus Athletenprofil, Benutzername-Untertitel
- **Neuer Benutzer**: benutzername = email automatisch

---

## v829

- Login-Formular bereits E-Mail-basiert ✓
- Neuer-Benutzer-Modal: benutzername = email (keine separate Eingabe mehr)
- Benutzer-Edit-Modal: zeigt nur noch E-Mail in der Überschrift
- deleteBenutzer: Bestätigungsdialog zeigt E-Mail statt benutzername
- Aktive Benutzer: name/email statt benutzername
- Login-Versuche: benutzername-Untertitel mit email-Fallback

---

## v828

- **auth.php**: Session und login_versuche speichern E-Mail statt benutzername
- **GET /benutzer**: name = vorname+nachname (Athletenprofil) oder E-Mail-Fallback
- **Admin-Dashboard aktive Benutzer**: E-Mail statt benutzername

---

## v827

- **Erklärung**: Bei erfolgreichen Logins speichert auth.php den internen benutzername (z.B. 'Daniel'), nicht die eingetippte E-Mail
- Anzeige: Name + Rolle (groß), darunter kleiner der rohe Login-Benutzername ('Daniel', 'dw@vy99.de')
- Damit ist sofort erkennbar, welcher Login zu welchem Account gehört

---

## v826

- **letzteLogins**: JOIN entfernt → einfache Abfrage auf login_versuche, Benutzerauflösung separat und try/catch-geschützt
- **aktiveBenutzer**: JOIN auf seitenaufrufe entfernt (konnte fehlschlagen), nur noch letzter_aktivitaet
- **letzter_aktivitaet Update**: nach $body-Parsing platziert (DB ist dann sicher initialisiert)

---

## v825

- **Fix**: Beim Umordnen der Sektionen wurde ein Semikolon mitten in den el.innerHTML-String gesetzt → el.innerHTML endete nach der Gäste-Tabelle, Aktiv + Logins wurden nie gerendert

---

## v824

- Gäste-Tabelle erscheint jetzt vor den Aktiv/Login-Tabellen

---

## v823

- Login-Versuche zeigen jetzt aufgelösten Namen (Vor-/Nachname) statt rohem Benutzernamen
- Rolle als Badge in der Benutzerspalte
- Tooltip: roher Login-Name + E-Mail falls abweichend
- JOIN auf benutzer-Tabelle über benutzername ODER email (deckt beide Login-Methoden ab)
- Erklärung: 'dw@vy99.de' = Testbenutzer Max Mustermann, 'Daniel' = daniel.weyers@tus-oedt.de

---

## v822

- Nur letzte 5 Tage anzeigen (vorher 20 Einträge ohne Zeitlimit)
- IP immer in eigener Spalte (nicht mehr im Tooltip)
- Fehlgeschlagene Logins: harte Rotfärbung (#c0392b) statt Akzentfarbe, Zeile rötlich hinterlegt
- Tabelle: 5 Spalten (Benutzer, Status, Land, IP, Zeitpunkt)

---

## v821

- **Aktiv**: letzter_aktivitaet wird jetzt direkt am Anfang des admin-dashboard Requests gesetzt; JOIN mit seitenaufrufe als Fallback; 10-Min-Fenster
- **Letzte Login-Versuche**: Statt 'letzter Login pro User' jetzt chronologische Liste aus login_versuche mit Status (Erfolg/Fehlschlag), IP, Land-Emoji

---

## v820

- **letzter_aktivitaet**: Update jetzt bei JEDEM API-Request (nicht nur auth/me)
- **letzteLogins**: Fallback wenn vorname/nachname-Spalten fehlen
- **Land**: Emoji-Flagge aus countryCode (\xf0\x9f\x87\xa9\xf0\x9f\x87\xaa Billerbeck, Deutschland)

---

## v819

- GeoIP jetzt serverseitig: PHP ruft ip-api.com per HTTP auf (Free-Tier blockiert HTTPS im Browser)
- Stadt + Land wird mit den Gäste-Daten aus der API geliefert und direkt in der Tabelle angezeigt

---

## v818

- **letzter_aktivitaet**: wird jetzt bei jedem auth/me-Call aktualisiert → Aktive Benutzer funktioniert
- **Letzte Logins**: WHERE-Bedingung bereinigt (geloescht_am fehlt auf manchen Instanzen)
- **GeoIP**: Jede Gast-IP wird async via ip-api.com aufgelöst → Flagge + Stadt, Land in eigener Spalte

---

## v817

- **Fehlende Statistiken**: Ein einziger try/catch-Block für alle Abfragen – erste Fehler (z.B. fehlende Spalte) hat alle folgenden Werte auf 0 gesetzt. Jetzt hat jede Abfrage ihren eigenen try/catch
- **Umlaute**: Rohe UTF-8-Bytes in renderAdminSystem durch HTML-Entities ersetzt

---

## v816

- Admin-Menü öffnet jetzt direkt das System-Dashboard (statt Benutzer)
- System-Button steht an erster Stelle in den Subtabs
- adminSubtabs() komplett neu geschrieben (bereinigt falsch insertierten Button)

---

## v815

- **Fix**: catch (\\Exception \\) statt catch (\\Exception $e) in CREATE TABLE seitenaufrufe – hat alle API-Requests mit 500 gecrasht

---

## v814

- **Fix**: Python-Escaping hatte \$method statt $method erzeugt → PHP-Syntaxfehler → 500 auf allen Requests
- ping-Endpoint und seitenaufrufe-INSERT jetzt mit korrekten PHP-Variablen

---

## v813 – Admin System-Dashboard

- **phpBB-Stil**: Zwei Spalten mit Statistik/Wert-Tabellen mit farbigen Abschnittsköpfen
- **Links**: System (Portal seit, DB-Server, DB-Größe, PHP), Benutzer, Seitenaufrufe
- **Rechts**: Ergebnisse + pro Tag, erstes Ergebnis-Datum, Veranstaltungen + pro Tag, Athleten, externe PBs, Importe, Disziplinen, Wartungswerte
- Aktive Benutzer und letzte Logins bleiben als Tabellen darunter

---

## v812 – Admin System-Dashboard

- **Neuer Subtab '🖥 System'** im Admin-Menü
- **System-Info**: PHP-Version, Datenbank-Version, DB-Größe in MB
- **Statistik-Karten**: Benutzer, Athleten, Ergebnisse, Veranstaltungen, offene Anträge/Registrierungen, Papierkorb
- **Aktive Benutzer**: Wer war in den letzten 5 Minuten aktiv (Name, Rolle, seit wann)
- **Letzte 10 Logins**: Wer hat sich wann eingeloggt
- **Gäste**: IP, User-Agent, letzter Besuch, Anzahl Aufrufe – letzte 15 Minuten
- **Seitenaufrufe**: Heute / Gestern / 7 Tage
- Neue seitenaufrufe-Tabelle wird automatisch angelegt
- Ping-Tracking bei jedem App-Start

---

## v811 – Fix Timeline Auto-Fill

- **Ursache**: Flexbox streckt alle Spalten auf die gleiche Höhe → Geschwister hatten auch 12837px
- **Fix**: Spalte wird kurz auf height:0/align-self:flex-start gesetzt, Reflow erzwungen, dann Geschwisterhöhe gemessen (= natürliche Inhaltshöhe, z.B. 3300px), dann Spalte wiederhergestellt

---

## v810 – Fix Timeline Auto-Fill

- **Neuer Ansatz**: Misst die Höhe der größten Nachbarspalte in der Zeile (statt window.innerHeight)
- Die Zeile wächst durch den höchsten Inhalt (z.B. Hall of Fame) – die Timeline füllt genau diese Höhe
- Verfügbar = tallestSibling.offsetHeight - panelHeader; passendeItems = ⌊verfügbar / itemHeight⌋

---

## v809

- **Fix $prevByG**: Wenn eine neue Gesamtbestleistung gesetzt wird, wurde bisher der vorherige Frauen/Männer-Wert nicht gesichert → "Bestleistung Frauen" ohne Vorgänger. Jetzt wird $prevByG[$g] korrekt gesichert bevor $bestByG[$g] überschrieben wird
- **Fix Auto-Fill**: _limitedTimeline nutzte document.createElement() beim Rendern. Ersetzt durch String-Split auf '.timeline-item'

---

## v808 – Fix Timeline Auto-Fill

- **Ursache**: renderDashboard() ignoriert Parameter; _auto_fill_limit landete nie in wcfg
- **Fix**: _tlAutoFillLimits['ri-ci'] als globaler Cache; renderDashboard() liest daraus
- renderDashboard() ist jetzt async (war nötig für den über-fetch await)

---

## v807 – Fix Timeline Auto-Fill

- **Ursache**: Panel wächst mit dem Inhalt – offsetHeight lieferte nie die begrenzte Höhe
- **Fix**: Verfügbare Höhe = `window.innerHeight - Header - Tab-Bar - Panel-Header`
- Damit passt die Anzahl Einträge exakt in den Viewport

---

## v806 – Neueste Bestleistungen: Auto-Fill

- Neue Option im Widget-Config: **"Box automatisch füllen"**
- Wenn gesetzt: misst nach dem Rendern die verfügbare Höhe, berechnet wie viele Items passen, und re-rendert mit exakt dieser Anzahl
- Anzahl-Eingabefeld wird dabei deaktiviert
- Fetcht bis zu 200 Einträge vom Server als Puffer

---

## v805

**Neueste Bestleistungen**: Wenn Filter aktiv (hidden_types, nur Favoriten), wird jetzt 4× so viel vom Server geladen und danach client-seitig auf das konfigurierte Limit geschnitten – kein Zählen vor dem Filtern mehr

**Mein Athletenprofil-Widget**: Zeigt jetzt wie das Athletenprofil-Modal: Wettkämpfe-Badge, AK-Badge, Jg. sowie 🥇 N Titel · 🏆 N Bestleistungen mit Tooltip

---

## v804 – Athletenprofil Auszeichnungen

- **Titel-Tooltip**: je Meisterschaft+Disziplin eine Zeile mit Jahreszahlen (wie HoF-Medals)
- **Bestleistungs-Tooltip**: exakt gleiche Gruppierung wie HoF-Badges (Gesamtbestleistung Frauen · Bestleistung W45–W65 über 1.500m)
- **Zwei separate Spans**: 🥇 N Titel und 🏆 N Bestleistungen mit eigenem Tooltip
- PHP: kat_name zu bestleistungen ergänzt

---

## v803 – Athletenprofil Auszeichnungen

- Zwei separate Spans: '🥇 N Titel' und '🏆 N Bestleistungen' mit je eigenem Tooltip
- Titel-Tooltip: wie HoF (label + Jahreszahlen)
- Bestleistungen-Tooltip: wie HoF gruppiert (Gesamt/Geschlecht über Disziplinen; komprimierte AK-Ranges)

---

## v802

- **border-top** der Auszeichnungen-Zeile entfernt (erschien als Strich unter den Wettkämpfe-Badges)
- **border-bottom dotted** des Auszeichnungen-Span entfernt

---

## v801

- PB-Badge zeigt vorherigen Wert immer an – keine Unterdrückung mehr
- Beispiel: "Bestleistung Frauen (73,81s) PB (73,81s)" statt "Bestleistung Frauen (73,81s) PB"

---

## v800 – Fix Neueste Bestleistungen

- **Ursache**: Wenn Club-Vorgänger = persönlicher PB-Vorgänger (häufigster Fall), hat `bothSame=true` den Wert im PB-Badge unterdrückt
- **Fix**: PB-Badge zeigt seinen Vorgänger immer, außer ein Club-Badge ist vorhanden und zeigt bereits denselben Wert
- Resultat: z.B. "Bestleistung Frauen (73,81s) PB (73,81s)" wenn beide Badges separate Labels haben, oder nur Club zeigt (73,81s) wenn PB-Vorgänger identisch

---

## v799

- "Deutsche-Meisterin" → "Deutsche Meisterin" (Leerzeichen statt Bindestrich)
- Regel: endet der Meisterschaftsname auf 'e' (Deutsche, Europäische…), wird ein Leerzeichen gesetzt; sonst Bindestrich (NRW-Meisterin, Nordrhein-Meisterin…)
- Fix in JS (HoF-Tooltip) und PHP (/auszeichnungen-Endpoint)

---

## v798

- **Athletenprofil**: Titel/Bestleistungen jetzt korrekt auf eigener Zeile mit Trennlinie (war noch innerhalb der Badges-Flex-Row)
- **Timeline**: Club-Badge (Bestleistung Frauen/Männer/AK) zeigt jetzt immer den Vorgängerwert – auch wenn er identisch mit dem persönlichen PB ist. PB-Badge zeigt nur dann einen Wert wenn er sich vom Club-Vorgänger unterscheidet

---

## v797

- **HoF**: Medaillen-Emojis 20px → 15px, Abstand 3px → 1px
- **Athletenprofil**: Titel/Bestleistungen durch Trennlinie auf eigener Zeile

---

## v796

- **Ursache**: /auszeichnungen prüfte nur Gesamt- und Geschlechts-Bestleistung, nicht AK-Bestleistungen
- **Fix**: Gleiche Logik wie HoF – prüft alle drei Ebenen: Gesamt, Geschlecht, alle AKs

---

## v795 – Athletenprofil Auszeichnungen

- Statt vieler Emojis und Badges: kompakte Zeile "🥇 20 Titel · 🏆 57 Bestleistungen"
- Tooltip (hover) listet alle einzelnen Titel und Bestleistungen auf
- Unterstrichen mit gestrichelter Linie als Hover-Hinweis

---

## v794 – Fix Athletenprofil Auszeichnungen

- **Ursache**: `GET athleten/{id}/auszeichnungen` wurde nach dem generischen `GET athleten/{id}`-Handler platziert – dieser rief `jsonOk()` auf bevor der Sub-Ressource-Check greifen konnte
- **Fix**: auszeichnungen-Check vor den generischen Handler verschoben

---

## v793 – Fixes

- **Divers** in allen verbleibenden Geschlecht-Dropdowns (Bulk-Eintragen neue Athleten, Registrierungen-Modal)
- Alle fehlenden D-Optionen ergänzt

---

## v792 – Athletenprofil: Auszeichnungen

- Neuer API-Endpoint: `GET athleten/{id}/auszeichnungen`
- Athletenprofil-Header zeigt jetzt:
  - 🥇-Emoji mit Tooltip pro Meistertitel (z.B. "NRW-Meisterin 10km (Straße) 2021, 2023")
  - Gold/Silber-Badges für Vereinsbestleistungen

---

## v791 – Fix Hall of Fame Medaillen

- **Ursache**: Emoji als rohe UTF-8-Bytes im JS-String → 4 Hieroglyphen statt 🥇
- **Fix**: `&#x1F947;` (HTML-Entity) → wird korrekt als Goldmedaille gerendert
- Tooltip: z.B. "Nordrhein-Meisterin 1.500m (Bahn) 2021, 2024"

---

## v790 – Hall of Fame Meisterschafts-Titel

- **Kein ×N** mehr neben dem Emoji
- **Tooltip**: "NRW-Meisterin 10km (Straße) 2021, 2023" – Jahreszahlen statt Anzahl
- **Geschlecht**: -Meister (M), -Meisterin (W), -Meister/in (D/unbekannt)

---

## v789 – Hall of Fame Meisterschafts-Titel

- **Format**: Kein Badge mehr – stattdessen 🥇-Emoji mit Tooltip
- **Tooltip**: z.B. "🥇 NRW 10km (Straße) ×3" – ohne AK, mit Kategorie und Anzahl
- **API**: Label enthält Meisterschaft + Disziplin (ohne AK), Kategorie separat

---

## v788 – Hall of Fame

- Meisterschafts-Titel werden jetzt nach Disziplin und Kategorie gruppiert (statt nach AK)
- Format: `10km: 🥇 NRW W60, 🥇 Nordrhein W60 (Straße)`
- API gibt nun `disziplin` und `kat_name` pro Meisterschafts-Titel zurück

---

## v787 – Fix Hall of Fame Meisterschafts-Titel

- **Ursache**: `$tbl` ist im HoF-Endpunkt nicht definiert (wird nur in anderen Endpunkten lokal gesetzt)
- **Fix**: Explizit `DB::tbl('ergebnisse')` für unified-Modus, Legacy-Tabellen für nicht-unified

---

## v786 – Fix HoF Meisterschafts-Titel

- **Ursache**: Code prüfte `ak_platz_meisterschaft = 1` (überall NULL), statt `ak_platzierung = 1 AND meisterschaft IS NOT NULL`
- **Fix**: Query korrigiert → Athleten haben z.B. Nordrhein-, NRW- und Regio-Meisterschaften (mstr=5,6,7) mit Platz 1

---

## v785 – Hall of Fame: Meisterschafts-Titel

- **Neue Datenquelle**: Erste Plätze in Meisterschaften (`ak_platz_meisterschaft = 1`) werden als Titel gewertet
- **Anzeige**: 🥇-Badges in Gold vor den Bestleistungs-Badges; mehrfache Titel mit ×N
- **Gesamtanzahl**: "3 Titel · 12 Bestleistungen" statt nur "15 Bestleistungen"
- **Ranking**: Meisterschafts-Titel zählen 3× (Faktor gegenüber Bestleistungen), Reihenfolge nach Score

---

## v784

- **Ursache**: Delete-Button war hartkodiert auf `currentUser.rolle === 'admin'` statt auf das Recht zu prüfen
- **Fix**: Button-Sichtbarkeit jetzt über `_canVeranstaltungLoeschen()`

---

## v783 – Neue Berechtigungen

- **`veranstaltung_eintragen`**: Steuert PUT /veranstaltungen/{id} (Bearbeiten) – vorher fest auf Editor/Admin
- **`veranstaltung_loeschen`**: Steuert DELETE /veranstaltungen/{id} – vorher fest auf Admin
- PHP: `Auth::requireRecht()` + `Auth::hasRecht()` – prüft Recht direkt aus rollen-Tabelle
- Migration: beide Rechte automatisch zu admin und editor hinzugefügt

---

## v782

- **Neuer Schalter** im Timeline-Widget-Config: "Nur favorisierte Disziplinen anzeigen"
- Filtert die Timeline auf Disziplinen, die unter Admin → Darstellung → Favorisierte Disziplinen gesetzt wurden
- Gespeichert als `tl_nur_favoriten` im Dashboard-Layout

---

## v781 – Fix Disziplin-Verlinkung aus Timeline

- **Ursache**: `state.disziplinen`-Einträge haben das Feld `id` (= mapping_id), nicht `mapping_id` – der Lookup fand nie eine Kategorie
- **Folge 1**: Falscher Kategorie-Tab aktiv
- **Folge 2**: Falsches Format (`0:00 min` statt `0,00 s`) weil `catMeta.fmt` vom alten Kategorie-State genommen wurde
- **Fix**: `d.mapping_id` → `d.id` im Lookup

---

## v780

- **Vorige Werte im Badge**: `Bestleistung Frauen (73,81s)` statt separatem "vorher: ..."-Text
- Bei zwei unterschiedlichen Vorgängern: Club-Badge bekommt Vereins-Vorgänger, PB-Badge den persönlichen Vorgänger
- Bei gleichem Vorgänger: nur einmal im PB-Badge
- Keine separate vorher-Zeile mehr

---

## v779 – Neueste Bestleistungen

- Neue API-Felder: `vorher_club` und `vorher_pers` separat vom gemeinsamen `vorher_val`
- Wenn Vereinsrekord UND persönlicher Rekord gleichzeitig gebrochen werden und die Vorgänger unterschiedlich sind: beide werden angezeigt
  - z.B. "Vereins vorher: 19:30 · PB vorher: 18:44"
- Wenn nur ein Vorgänger oder beide gleich: wie bisher "vorher: X"

---

## v778

- Kategorien: `flex:0 0 auto` → nehmen nur so viel Platz wie nötig
- Buttons innerhalb einer Kategorie: `flex-wrap:nowrap` → bleiben immer in einer Zeile
- Gesamter Umbruch passiert nur auf Kategorie-Ebene

---

## v777

- **Kategorien nebeneinander**: Jede Kategorie bekommt `flex:1; min-width:160px` → bei genug Breite stehen sie nebeneinander, bei wenig Platz stapeln sie sich vertikal
- Rein CSS-basiert, kein JS nötig

---

## v776

- **Datenbank**: `geschlecht ENUM('M','W','D','')` – 'D' war nicht im ENUM, daher wurde es silently verworfen
- **Migration**: `MODIFY COLUMN` passt bestehende Installationen automatisch an
- **Validierung**: `in_array` prüft jetzt auch 'D'

---

## v775 – Konto

- **Konto löschen**: Für Administratoren deaktiviert – Hinweis statt Button
- **Athletenprofil**: Editor und Admin speichern direkt ohne Genehmigung; Antrag-Hinweis nur für andere Rollen

---

## v774

- Widget gibt `''` zurück (keine Rollenberechtigung) → Spalten-Wrapper wird komplett übersprungen
- Zeile mit nur noch 1 sichtbarem Widget → kein `dash-row-wrap` mehr, nur noch einzelner Div
- Komplett leere Zeilen werden ebenfalls nicht gerendert

---

## v773

- Stat-Karten wechseln automatisch auf vertikale Anordnung wenn Höhe > Breite
- Implementierung via `ResizeObserver` → reagiert auf tatsächliche Größe, nicht auf Viewport
- Kein hartkodiertes vertikales Layout mehr

---

## v772 – Dashboard Statistik-Karten

- `.dash-row-wrap`: `align-items:stretch` + `.dash-row-wrap > div { height:100% }` → alle Spalten wachsen auf Zeilenhöhe
- `.stats-bar` in Mehrspalt-Zeilen: `grid-template-columns:1fr` (vertikal statt horizontal), `height:100%`, Karten verteilen sich gleichmäßig
- `.stat-card`: `display:flex; justify-content:center` → Inhalt vertikal zentriert

---

## v771

- Nav-Icons: `filter: grayscale(0)` bei Hover und aktivem Tab → farbig; inaktiv bleiben sie graustufen

---

## v770

- Nav-Icons: `filter: grayscale(1)` in CSS statt Unicode-Variation-Selektor (zuverlässig in allen Browsern)

---

## v769

- Nav-Emojis zurück auf `\uFE0E` (Text-Variation = mono/gedämpft) – passt besser zur Menüleiste
- Widget-Titel-Emojis bleiben farbig (`\uFE0F`)

---

## v768

- Navigation: Emojis hatten `\uFE0E` (Text-Variation = mono/gedämpft), jetzt `\uFE0F` (Emoji-Variation = farbig) für alle 7 Nav-Icons

---

## v767

- **Eigenes Athletenprofil** + **Persönliche Bestleistungen**: `height:100%` → Höhe passt sich der Zeile an wie die anderen Widgets
- **Stoppuhr-Emoji**: `&#x23F1;&#xFE0E;` (Text-Variation) → `⏱️` (Emoji-Variation) → farbig wie bei anderen Widget-Titeln

---

## v766

- **3-spaltig**: Links Avatar/Erscheinungsbild/Konto-löschen | Mitte Passwort+2FA | Rechts Athletenprofil
- **Divers** überall: Konto-Athletenprofil-Form, Athlet-Edit-Modal, Neuer-Athlet-Modal, Athletenliste-Symbol (⚧), akBadge für D-AK

---

## v765

- 2FA-Hinweistext: "Mindestens eine Methode muss aktiv sein, ansonsten erhältst du bei jedem Login eine E-Mail zur Bestätigung deiner Identität."

---

## v764 – Konto: Athletenprofil bearbeiten

- Neue Karte in der rechten Spalte (nur wenn Athletenprofil verknüpft)
- Felder: Vorname, Nachname, Geschlecht, Geburtsjahr
- Änderungen landen als Antrag in `ergebnis_aenderungen` (Typ: update, Tabelle: athleten)
- Admin/Editor sieht Antrag in Admin → Anträge und kann genehmigen oder ablehnen
- Genehmigung schreibt direkt in `athleten`-Tabelle (inkl. `name_nv`-Update)

---

## v763 – Fix Hash-Routing für Konto

- `konto` war nicht in `validTabs` in `restoreFromHash()` → F5 auf `#konto` landete auf Startseite
- Fix: `konto` zu `validTabs` hinzugefügt

---

## v762 – Konto-Seite Redesign

**Zwei-Spalten-Layout (220px + 1fr):**
- Links: Avatar-Karte, Erscheinungsbild-Karte, Konto-löschen-Karte
- Rechts: Passwort-Karte, 2FA-Karte

Alles in Panel-Karten strukturiert – kein auseinandergezogenes Single-Column-Layout mehr

---

## v761 – Konto-Seite

- **Trennstrich**: HR oberhalb von "Konto löschen" trennt den Bereich klar von der 2FA
- **Farbe**: Alle roten Elemente in "Konto löschen" jetzt hartkodiert `#cc0000` statt `var(--accent)`

---

## v760 – Konto-Seite

- **Abstand**: Mehr Platz zwischen "Passwort wiederholen" und "Passwort ändern"-Button (margin-top:16px)
- **Abmelden entfernt**: Kein Abmelden-Button auf der Konto-Seite mehr
- **Konto löschen**: Neuer Bereich mit roter Warnung, Beschreibung und Button
  - Dialog mit Pflichtfeld: User muss "KONTO LÖSCHEN" eintippen
  - Backend: `DELETE auth/konto` → trennt Athletenprofil, setzt `aktiv=0` und `geloescht_am=NOW()`
  - User wird abgemeldet; Konto bleibt 30 Tage im Papierkorb wiederherstellbar (via Admin)

---

## v759 – Konto Passwort-Bereich

- **Placeholder**: "min. 8 Zeichen" → "min. 12 Zeichen"
- **Passwortstärke-Anzeige**: Identisch zur Registrierung – Balken + Gruppen-Checkboxen (Großbuchstaben, Kleinbuchstaben, Zahlen, Sonderzeichen, 12+ Zeichen)
- **Passwort ändern**-Button direkt unter den Passwort-Feldern statt in der Footer-Leiste
- **Trennlinie** (HR) oberhalb von "Zwei-Faktor-Authentifizierung" mit mehr Abstand → klare Trennung

---

## v758 – Konto

- **Konto als Seite**: Kein Modal mehr – kein Scrollbalken-Problem
- **Passwort-Regeln**: Min. 12 Zeichen + 3/4 Zeichengruppen – identisch zur Registrierung

---

## v757 – Eintragen Fixes

- **Sicherheit**: Navigation zu 'Eintragen' setzte `subTab='bulk'` hart – jetzt `null`, wird in `renderEintragen()` permissions-basiert gesetzt
- **Fallback**: Wer nur `eigene_ergebnisse` hat und `subTab='bulk'` ist (z.B. nach Speichern), wird automatisch auf `eigenes` umgeleitet
- **Kein Zugriff**: Wer weder `bulk_eintragen` noch `eigene_ergebnisse` hat, sieht Hinweis statt Formular
- **Aktiver Button**: Korrekter Tab ist beim ersten Laden farbig hinterlegt

---

## v756 – Eintragen

**Bulk-Eintragen:** Wird zum Button; neues Recht `bulk_eintragen` (Admin+Editor)

**Eigenes Ergebnis eintragen:**
- Kategorie/Disziplin-Dropdown, Ergebnis, AK (auto), Verein (vorausgefüllt)
- Anderer Verein → externes Ergebnis; eigener Verein → Antrag (pending Review)
- Neue Veranstaltung mit Hinweis auf Genehmigungspflicht
- Backend: `POST ergebnisse/eigenes` → `ergebnis_aenderungen` Tabelle
- Migration: `veranstaltungen.genehmigt`-Spalte

---

## v755

- **"+ Externes Ergebnis"** im Athletenprofil nur sichtbar wenn `alle_ergebnisse`-Recht aktiv (oder Admin)

---

## v754 – Athleten-Liste

- **AK als Badge** (Pillow-Darstellung via `akBadge()`)
- **Geschlecht als Symbol** (♂/♀ statt M/W-Badge)
- **Neues Recht `athleten_details`**: Geschlecht, Anzahl Ergebnisse, Letzte Aktivität, Status (inkl. inaktive Athleten) nur sichtbar wenn Recht aktiv
- **Neues Recht `athleten_editieren`**: Bearbeiten-Buttons nur wenn Recht aktiv
- **Migration**: Rechte werden automatisch zu admin, editor, athlet und leser hinzugefügt

---

## v753 – Fix Personenbezogene Daten

- **Ursache**: `GET rollen` ist admin-only → Athlet-User bekamen 403, `_rollenMap` blieb leer
- **Fix**: `auth/me` gibt jetzt `rechte` der eigenen Rolle mit zurück
- `_canSeePersoenlicheDaten()` liest direkt aus `currentUser.rechte` – kein extra API-Call nötig

---

## v752 – Fix Personenbezogene Daten für Athlet-Rolle

- **Ursache**: `_rollenMap` wurde nur in der Admin-Benutzerverwaltung befüllt – bei normalen Usern war sie leer → `_canSeePersoenlicheDaten()` immer `false`
- **Fix**: `_rollenMap` wird jetzt beim App-Start parallel zu `auth/me` geladen → Rechte stehen sofort zur Verfügung

---

## v751 – Fix Gruppen-Anzeige

- **Ursache**: Beim Refactoring v748 blieb die alte, bedingungslose Gruppen-Zeile zusätzlich zur neuen konditionalen stehen – daher waren Gruppen immer sichtbar
- **Fix**: Doppelte Zeile entfernt → Gruppen nur noch sichtbar wenn `personenbezogene_daten`-Recht aktiv

---

## v750 – Systemrollen: personenbezogene_daten aktiv

- **Migration**: Fügt `personenbezogene_daten`-Recht automatisch zu admin, athlet und leser hinzu (auch bei bestehenden Installationen)
- **Default-Rechte** beim Erstsetup ebenfalls ergänzt
- Recht ist in der Rollen-UI sichtbar aber ausgegraut (Systemrollen = unveränderbar)

---

## v749 – Personenbezogene Daten als Recht

- **Neues Recht**: `personenbezogene_daten` in _RECHTE_LISTE: "Personenbezogene Daten sehen (Athleten-Seite, Gruppen, Jahrgang)"
- Pro Rolle konfigurierbar wie alle anderen Rechte (Rollen & Rechte → Rolle bearbeiten)
- Admin hat immer Zugriff, alle anderen nur wenn Recht aktiv
- Darstellungs-Einstellung entfernt (war Missverständnis)

---

## v748 – Rollen & Sichtbarkeit

**Pseudo-Rolle "nicht-eingeloggt":**
- Erscheint am Ende der Rollen-Liste als Systemrolle (🔐, nicht editierbar, nicht löschbar)
- Beschreibt Besucher ohne Login

**Personenbezogene Daten (Darstellung-Einstellungen):**
- Neuer Schalter: Athleten-Seite, Gruppen und Jahrgang im Athletenprofil ab welcher Rolle sichtbar
- Optionen: Nicht eingeloggt (alle) | Leser (eingeloggt) | Athlet+
- Athleten-Tab verschwindet aus der Navigation für nicht-berechtigte Rollen
- Gruppen und Jahrgang im Athletenprofil-Modal werden entsprechend ausgeblendet

**Widget-Rollen-Sichtbarkeit (Dashboard-Layout-Editor):**
- Jedes Widget hat eine Checkbox-Liste "Sichtbar für:"
- Alle Rollen inkl. nicht-eingeloggt wählbar
- Leeres Auswahl = Widget für alle sichtbar
- Widget wird in renderWidget() geprüft und ausgeblendet wenn Rolle nicht in der Liste

---

## v747 – Login E-Mail-Code Fix

- **Ursache**: `auth/login`-API übergab `email_login_bevorzugt` nicht an den Client → Frontend konnte Auto-Send nie auslösen
- **Fix**: `email_login_bevorzugt` wird jetzt im `totp_required`-Response mitgesendet → Auto-Send greift korrekt
- **Bonus**: Kaputten Emoji-Codepoint (`\u1F4E7`) im Send-Button-Reset korrigiert

---

## v746

- **Widget "Eigene persönliche Bestleistungen"**: zeigt nur PB-Buttons, kein Athletenprofil-Header
- **Umbenennung**: "persönliche Bestzeiten" → "persönliche Bestleistungen" (Label + Standardtitel)

---

## v745 – Dashboard-Widgets getrennt

- **"🏃 Eigenes Athletenprofil"**: Zeigt nur Avatar, Name, AK-Badge – keine Ergebnisse
- **"⏱️ Eigene persönliche Bestzeiten"** (neu): Zeigt PB-Buttons je Disziplin, nach Kategorien gruppiert
- Option "Ergebnisse anzeigen" entfernt (nicht mehr nötig)

---

## v744 – Eigenes Athletenprofil Widget

- PBs werden als `.rek-top-btn`-Buttons dargestellt (wie Bestleistungen), nicht als Tabelle
- Gruppiert nach Kategorie mit kleinem Kategorie-Label darüber
- Intern = primärfarben, extern = schwarz
- Klick auf Button öffnet Athletenprofil-Modal

---

## v743 – Dashboard-Widget: Eigenes Athletenprofil

**Neues Widget** `eigenes-profil` im Dashboard-Layout-Editor:

- Zeigt Avatar (mit Online-Dot), Name, AK-Badge, Jahrgang
- Klick auf Avatar/Name öffnet das Athletenprofil-Modal
- **Option "Ergebnisse anzeigen"**: Zeigt PBs je Disziplin (intern rot, extern schwarz) gruppiert nach Kategorie
- Nur sichtbar wenn eingeloggter User ein verknüpftes Athletenprofil hat
- Konfigurierbar: Titel + Checkbox 'Ergebnisse anzeigen'

---

## v742 – Athletenprofil Button-Optik

- **Kategorie-Tabs**: Nutzen jetzt `.rek-cat-btn` / `.rek-cat-btn.active` → gleiche rote Pille wie Bestleistungen
- **Disziplin-Buttons**: Nutzen jetzt `.rek-top-btn` / `.rek-top-btn.active` → gleiche Karte mit accent-Füllung, shadow und outline wie Bestleistungen
- Alle inline-Styles entfernt

---

## v741 – PB im Button: korrekter Vergleich

- **Ursache**: `_apBestOf` verglich Zeitstrings lexikographisch – `"2:57:53"` (ohne führende Null) ist lexikographisch größer als `"03:14:13"` weil `'2' > '0'` → externes Ergebnis wurde fälschlich als schlechter eingestuft
- **Fix**: Zeitstrings werden in Sekunden umgerechnet (`H:MM:SS → Sekunden`) bevor verglichen wird → `2:57:53` (10673s) < `03:14:13` (11653s) → korrekt

---

## v740 – Externe Ergebnisse

- **Zeitformat**: Externe Ergebnisse rufen jetzt `_apFmtRes(p, fmt)` auf statt `p.resultat` roh auszugeben → 'h'-Suffix, Minuten-Suffix etc. korrekt
- **PB im Button**: `_apBestOf` berücksichtigt jetzt interne UND externe Ergebnisse → zeigt das tatsächliche PB

---

## v739 – Externe Ergebnisse: 3 Fixes

- **Eigene Tabs**: Internes Ergebnisse-Query liefert jetzt `disziplin_mapping_id` → `ergDiszKey` erzeugt `m5` statt `d_Marathon` → ext + intern landen im selben Button
- **AK**: AK-Zelle war hartkodiert auf `&ndash;`, zeigt jetzt `p.altersklasse`
- **Button-Label**: Ext-only Disziplinen (kein internes Ergebnis) nutzen `disziplin_mapped` aus dem PB statt des rohen Keys (`m5` → `Marathon`)

---

## v738 – Externe Ergebnisse: 3 Fixes

**Eigene Tabs**: Externe PBs nutzen jetzt denselben Disziplin-Key wie interne Ergebnisse (`m{mapping_id}`) → landen im selben Button, kein doppelter Tab

**AK-Anzeige**: Externe Ergebnisse zeigen `altersklasse` in der AK-Spalte

**Pace-Anzeige**: Pace wird für externe Ergebnisse berechnet (via `diszKm()` + `calcPace()`) wenn die Disziplin ≥1km ist

**Auto-AK im Modal**: Nach Auswahl des Datums wird die Altersklasse automatisch vorgeschlagen (Geburtsjahr des Athleten + Wettkampfjahr → `calcDlvAK()`), nur wenn das Feld noch leer ist

---

## v737

- **"+ Externes Ergebnis"** links, **"Schließen"** rechts im Modal-Footer (`justify-content:space-between`)
- **"← Zurück"** öffnet das Athleten-Profil wieder (`openAthletById(_apState.athletId)`) statt das Modal zu schließen

---

## v736 – Externes Ergebnis Modal

- "Abbrechen" → "← Zurück" im Modal zum Eintragen/Bearbeiten externer Ergebnisse

---

## v735 – Externes Ergebnis Modal

- **Titel**: "Externes Ergebnis eintragen" statt "Externer PB eintragen"
- **Optik**: Modal nutzt jetzt `form-group`/`form-grid`-Klassen – konsistent mit dem Rest der Seite
- **Kategorie-Dropdown**: befüllt aus `state.disziplinen` nach `tbl_key` (war fehlerhaft: nutzte `kategorie_id` das in `state.disziplinen` nicht existiert)
- **Disziplin-Dropdown**: wird nach Kategorie-Auswahl korrekt befüllt
- **Validierung**: Fehlermeldung wenn Disziplin nicht ausgewählt

---

## v734 – Externe Ergebnisse: Vollständige Disziplin-Integration

**DB-Änderungen (Auto-Migration):**
- `athlet_pb`: neue Spalten `disziplin_mapping_id`, `altersklasse`

**Backend:**
- Externe PBs werden über `disziplin_mapping` + `disziplin_kategorien` gejoint → liefern `kat_name`, `kat_sort`, `fmt`, `disziplin_mapped`
- Beim Speichern wird `disziplin_mapping_id` gesetzt

**Frontend:**
- Externe PBs werden in die Kategorien-Struktur eingebettet (gleiche Sortierung wie interne Ergebnisse)
- Matching per `disziplin_mapping_id` statt Fuzzy-String-Vergleich
- Modal: Kategorie-Dropdown + Disziplin-Dropdown (aus `state.disziplinen`) statt Freitext
- Neues Feld: Altersklasse
- Externe Disziplinen ohne interne Ergebnisse erscheinen als eigene Disziplin-Buttons

---

## v733 – Athletenprofil: Ergebnisse + Externe PBs zusammengeführt

- **Tab entfernt**: Kein separater "Externe PBs"-Tab mehr
- **Gemischte Tabelle**: Interne Ergebnisse (farbig) und externe PBs (normales Schwarz) erscheinen in derselben Tabelle; externe erkennbar an farbloser Ergebnisdarstellung
- **Verein-Spalte**: Erscheint automatisch wenn externe Einträge in der gewählten Disziplin vorhanden sind; interne Ergebnisse zeigen den eigenen Vereinsnamen, externe den eingetragenen Verein
- **Neues Feld "Verein"** im PB-Modal (DB-Migration auto)
- **"+ Externes Ergebnis"**-Button neben "Schließen" im Modal-Footer
- Edit/Delete für externe PBs direkt aus der Ergebnistabelle

---

## v732 – Fix HTTP 500

- **Ursache**: Tippfehler im catch-Block von `auth/online-status`: `'athlet_ids']=[])` statt `'athlet_ids'=>[])` → PHP-Parse-Error → 500 auf allen Endpoints

---

## v731 – Online-Status in Benutzerverwaltung für alle User

- **Ursache**: Benutzerverwaltung prüfte `currentUser.id === b.id` → nur der eigene User wurde als online markiert
- **Fix**: Vor dem Rendern der Tabelle wird `GET auth/online-status` aufgerufen; alle User mit `user_id` in der Antwort werden als online markiert
- **Backend**: `auth/online-status` gibt jetzt `{ user_ids: [...], athlet_ids: [...] }` zurück – `user_ids` für Benutzerverwaltung, `athlet_ids` für Athletenprofil

---

## v730 – Fix Header-Avatar Initialen

- **Ursache**: `_renderHeaderAvatar` rief `nameInitials(vorname)` auf → nur ein Buchstabe
- **Fix**: `auth/me` gibt jetzt auch `nachname` zurück; `_renderHeaderAvatar` nutzt Vorname[0]+Nachname[0] wenn beide vorhanden (DW für Daniel Weyers)

---

## v729 – Online-Dot: Sichtbarkeit + Tooltip

- **Nur für eingeloggte User**: `GET auth/online-status` gibt 401 zurück wenn nicht eingeloggt; JS-Aufruf wird zusätzlich durch `if (!currentUser)` geblockt
- **Tooltip**: Dot zeigt `title="Online"` → Browser-Tooltip bei Hover

---

## v728 – Online-Dot für alle sichtbar

**Konzept**: Echter Server-seitiger Online-Status statt Client-Vergleich

- **`letzter_aktivitaet`-Spalte**: Neue DB-Spalte (Auto-Migration) – wird bei jedem API-Request aktualisiert (max. 1x/60s per Session)
- **`GET auth/online-status`**: Neuer Endpunkt – gibt Liste aller Athleten-IDs zurück deren verknüpfter User in den letzten 5 Minuten aktiv war
- **Athletenprofil**: Ruft `auth/online-status` asynchron ab → Dot erscheint wenn die `athlet_id` in der Liste ist – **für alle eingeloggten User sichtbar**
- **Auth::check()**: Schreibt `letzter_aktivitaet = NOW()` throttled (max 1x/min) in die DB

---

## v727 – Fix Online-Dot im Athletenprofil

- **Ursache**: `auth/me` gab `athlet_id` nicht zurück → `currentUser.athlet_id` blieb immer `undefined` → `isMyProfile` immer `false`
- **Fix Backend**: `athlet_id` wird jetzt in der `auth/me`-Response mitgeliefert
- **Fix Frontend**: `!= null`-Check statt Truthy-Check (damit `athlet_id: 0` nicht ignoriert wird)

---

## v726 – Athletenprofil

- **Online-Dot**: Prüfung ob der Athlet dem eingeloggten User gehört jetzt robuster – nutzt `currentUser.athlet_id` UND als Fallback `_adminBenutzerMap` (falls Benutzerverwaltung schon geladen war)
- **AK-Badge**: Zeigt nur noch "M40" statt "M40 2026", verwendet `akBadge()` → korrekte Farbe (blau für M-AK, etc.) statt manuellem primary-Background

---

## v725 – Online-Dot systemweit

- **Header (oben rechts)**: Avatar zeigt grünen Dot wenn eingeloggt; `_renderHeaderAvatar()` für alle Avatar-Updates
- **Athletenprofil**: Dot wenn der angezeigte Athlet dem eigenen Account zugeordnet ist
- **CSS**: `.user-avatar` → `overflow:visible; position:relative` + Gradient
- **auth/me**: gibt `athlet_id` mit → wird auf `currentUser` gespeichert

---

## v724 – Fix Avatar-Dot Überlappung

- **Ursache**: `bottom:-7px; right:-7px` funktioniert mit `position:absolute` in `inline-flex`-Containern nicht zuverlässig – der Dot landete unten-links statt unten-rechts
- **Fix**: `bottom:0; right:0; transform:translate(35%,35%)` → Dot sitzt exakt in der unteren-rechten Ecke und ragt 35% nach außen über den Kreisrand

---

## v723 – Fixes Benutzertabelle

- **Initialen**: `avatarHtml()` nimmt jetzt optionalen `initialsOverride`-Parameter → VN-Schema (Vorname[0]+Nachname[0]) wird korrekt angezeigt (DW, MM, …)
- **Dot**: `overflow:visible` war schon seit v720 gesetzt – bitte v722+ deployen
- **2FA-Spalte**: Breite von 120px auf 160px erhöht → alle drei Badges (TOTP + Passkey + E-Mail) passen nebeneinander

---

## v722 – Adressleiste zurück auf --primary3

- Adressleisten-Farbe verwendet wieder `--primary3` (aufgehellte Primärfarbe) statt `--primary`

---

## v721 – Drei Fixes

- **Avatar-Dot Überlappung**: `overflow:visible` auf der Avatar-`<td>` → Dot wird nicht mehr durch table-cell-clipping abgeschnitten
- **Initialen VN-Schema**: Benutzer mit Athlet-Zuweisung zeigen korrekt Vorname[0]+Nachname[0] (z.B. DW für Daniel Weyers, MM für Max Mustermann)
- **Adressleisten-Farbe**: Verwendet jetzt `--primary` (#cc0000) statt `--primary3` (#da4747 – aufgehellter Gradient-Wert)

---

## v720 – Fix Avatar-Dot Überlappung

- **Problem**: Der Dot-Container hatte kein `overflow:visible` – der Browser hat den außerhalb ragenden Dot abgeschnitten
- **Fix**: `overflow:visible` am Wrapper-`<span>`
- Dot-Mittelpunkt liegt jetzt exakt auf dem Kreisrand → echter Überlappungseffekt (50% innerhalb, 50% außerhalb)

---

## v719 – Benutzerverwaltung Polishing

- **Avatar-Dot**: Nur für eingeloggte User (grün, größer: 38% des Avatar-Durchmessers, stärkere Überlappung mit 45% negativem Offset)
- **Kein Dot** für aktive/inaktive User ohne Session
- **Rolle als plain text** statt Badge – sauberer, weniger visuelles Rauschen
- **Sortierbare Spalten**: Benutzer, Athlet, Rolle, Status, Letzter Login – Klick auf Spaltenheader sortiert auf-/absteigend, aktive Spalte in Primärfarbe mit Pfeil ↑↓

---

## v718 – Fix tfaBadges

- `var tfaBadges =`-Deklaration wurde beim Zeilenersatz in v717 abgeschnitten → ReferenceError beim Laden der Benutzerverwaltung

---

## v717 – Avatar-Dot + Status-Badges

**Avatar-Dot:**
- Grüner Punkt überlappt jetzt den Avatar-Kreis (position:absolute, nach außen versetzt)
- Gilt systemweit: Benutzerverwaltung, Header, Hall of Fame
- Dot-Farbe: grün (eingeloggt), akzent-blau (aktiv), grau (inaktiv)

**Status-Badges (3 Stufen):**
- 🔵 **Eingeloggt** (grün) – neuer Badge für aktuell eingeloggten User
- 🔷 **Aktiv** (Akzentfarbe/Sekundärfarbe) – statt bisherigem Grün
- 🔴 **Inaktiv** (Primärfarbe) – statt bisherigem Rot

**Zeilen-Highlight + Text-Label entfernt** – Info nur noch über Dot + Badge

**avatarHtml()** zentralisiert: HoF + alle Avatare nutzen dieselbe Funktion mit optionalem Dot-Parameter

**avatarFallback()** vereinheitlicht: Gradient + Barlow Condensed + 2 Initialen überall

---

## v716 – Benutzerverwaltung Redesign

- **Tabellenstruktur**: Benutzerverwaltung jetzt als Tabelle mit Spalten: Avatar | Benutzer | Athlet | Rolle | Status | 2FA | Letzter Login | Aktionen
- **Rollen & Rechte** unterhalb der Benutzerverwaltung (volle Breite, kein Grid mehr)
- **Eingeloggt-Anzeige**: Aktuell eingeloggter User bekommt grünen Punkt am Avatar und "● Eingeloggt"-Label, Zeile leicht eingefärbt
- **Rollenbeschriftung**: Zeigt jetzt die konfigurierte Bezeichnung (z. B. "Administrator") statt internen Rollennamen

---

## v715 – 2FA-Status in Benutzerverwaltung

- **📱 TOTP**-Badge: wenn TOTP aktiviert
- **🔑 N**-Badge: Anzahl registrierter Passkeys (z.B. 🔑 2)
- **📧 E-Mail-Code**-Badge: wenn E-Mail-Login bevorzugt und kein anderes 2FA aktiv
- API: `totp_aktiv` und `passkey_count` werden jetzt im GET /benutzer mitgeliefert

---

## v714 – Fix E-Mail-Verifizierungsdialog

**Problem**: Der neue Dialog (ohne Code-senden-Button, Präteritum) erschien nicht, weil `email_login_bevorzugt` für bestehende Benutzer in der DB auf 0 stand.

**Fix:**
- Admin → Benutzer bearbeiten: neue Checkbox "📧 Anmeldung per E-Mail-Code (statt TOTP / Passkey)"
- API GET /benutzer liefert `email_login_bevorzugt` mit
- API PUT /benutzer speichert `email_login_bevorzugt`
- Damit kann der Admin für jeden User den E-Mail-Code-Flow aktivieren

---

## v713 – Fix E-Mail-Code Auto-Versand

- **Ursache**: Bei `autoSend=true` wurde das neue Dialog korrekt gerendert (Text im Präteritum, kein Send-Button), aber `doEmailCodeSend()` wurde nie aufgerufen → kein Code versendet
- **Fix**: Nach dem Rendern des Dialogs wird `doEmailCodeSend()` mit 300ms Verzögerung aufgerufen wenn `autoSend=true` und aktiver Tab = 'email'

---

## v712 – Rollen-Bezeichnungen konfigurierbar

**Rollen & Rechte:**
- Neue Spalte "Bezeichnung" in Tabelle mit 👁️/🙈-Icon für öffentliche Sichtbarkeit
- Edit-Modal: Felder "Bezeichnung" (öffentlich sichtbar, z.B. "Administrator") und Checkbox "öffentlich anzeigen"
- Bezeichnung wird im Menü (oben rechts) und Athletenprofil nur angezeigt wenn öffentlich = ja
- DB: neue Spalten `label` und `oeffentlich` in `rollen`-Tabelle (Auto-Migration)

**Fix E-Mail-Verifizierung:**
- `autoSend`-Parameter wurde in `renderLoginStep3` nicht an `_loginStep3ShowMethod` weitergegeben → alter Dialog erschien

---

## v711 – E-Mail-Verifizierung: Auto-Versand

- Wenn nur E-Mail-Code als 2FA verfügbar ist: Code wird sofort gesendet, Text lautet "Wir haben dir... gesendet" (Vergangenheit), kein "Code senden"-Button
- Stattdessen unauffälliger "Code erneut senden"-Link am unteren Rand
- Wenn E-Mail einer von mehreren 2FA-Tabs ist: bisheriges Verhalten mit manuellem Button bleibt erhalten

---

## v710 – Fix Avatar-Initialen in Benutzerverwaltung

- **Schema**: Wenn ein Athlet zugewiesen ist, werden die Initialen als **VN** (Vorname[0] + Nachname[0]) berechnet
- Beispiel: Athlet "Mustermann, Max" → Initialen "MM" statt bisher "M"
- Ohne Athlet-Zuweisung: weiterhin `nameInitials(email)`

---

## v709 – Fix Favorisierte Disziplinen: Doppel-Matching

- **Ursache**: Favoriten wurden als Disziplin-Namen gespeichert → "800m" (Bahn) und "800m" (Halle) wurden beide als Favorit markiert wenn einer davon ausgewählt war
- **Fix**: Favoriten werden jetzt als **mapping_id-Array** (Integer) gespeichert → jede Disziplin-Kategorie-Kombination ist eindeutig identifiziert
- **Admin-Panel**: Checkboxen verwenden `mapping_id` als Wert; nicht gemappte Disziplinen (ohne mapping_id) erscheinen nicht in der Favoriten-Auswahl
- **Backend**: Matching per `mapping_id` statt per Name
- **Migration**: Alte Name-basierte Favoriten-Listen werden beim nächsten Speichern überschrieben (einmalig neu auswählen)

---

## v708 – Benutzerverwaltung Avatar-Stil

- Initialen-Avatare in der Benutzerliste nutzen jetzt denselben Stil wie die Hall of Fame: Farbverlauf (primary → accent), Barlow Condensed Bold, 2 Buchstaben
- CSS-Klasse `.user-row-avatar` entsprechend aktualisiert

---

## v707 – Benutzerverwaltung + Rollen

**Benutzerverwaltung:**
- Avatar (Foto oder Initialen) wird jetzt in der Benutzerliste angezeigt
- Anzeigename: Vorname aus verknüpftem Athletenprofil, sonst E-Mail
- API-Query ergänzt um `athlet_vorname` und `avatar_pfad`

**Systemrollen (admin/athlet/leser) – vereinheitlicht:**
- Alle drei erhalten identische Lock-Ebene 🔐: Name editierbar, Rechte gesperrt, nicht löschbar
- Im Edit-Modal sind Checkboxen für alle Systemrollen deaktiviert
- Backend und Frontend konsistent

---

## v706 – Rollen-Schutz

- **athlet**: Komplett unveränderbar und nicht löschbar (🔒) – Berechtigungen und Name sind fest
- **leser**: Ebenfalls komplett unveränderbar und nicht löschbar (🔒)
- **admin**: Nur der Name ist editierbar, Berechtigungen sind gesperrt (🔐) – Checkboxen im Modal deaktiviert mit Hinweis
- **Backend**: Dieselben Regeln serverseitig durchgesetzt (kein Bypass via API möglich)

---

## v705 – Fix Passkey Conditional UI Verifizierung

- **Ursache**: `authVerifyStateless` rief `self::coseKeyToPem()` auf – eine Methode die nicht existiert
- **Fix**: Ersetzt durch die vorhandenen Methoden `self::decodeKeyBytesFromStorage()` + `self::verifySignature()` (identisch zu `authVerify`)

---

## v704 – Fix Vorname nach Login

- **Ursache (im Browser debuggt)**: Zwei `GET auth/me`-Handler hintereinander – der erste antwortete immer zuerst und gab kein `vorname`-Feld zurück; der zweite Handler war dead code
- **Fix**: Beide Handler zu einem zusammengeführt – gibt jetzt `name`, `vorname`, `email`, `avatar`, `totp_aktiv`, `has_passkey` in einer Response zurück
- **JS**: `currentUser.name` wird nach `auth/me` ebenfalls aktualisiert

---

## v703 – Fix: renderLoginStep2 fehlte

- **Ursache (live im Browser debuggt)**: `renderLoginStep2` wurde bei den Refactorings v694–v702 entfernt aber weiter aufgerufen → `ReferenceError` im async-Kontext wurde lautlos geschluckt → "Weiter"-Button tat nichts
- **Fix**: `renderLoginStep2` wiederhergestellt (zeigt Passwort-Feld + optionalen Passkey-Button wenn Passkey vorhanden)
- **Fix**: `doLoginPasskeyStep2` neu hinzugefügt (Passkey-Flow aus Step 2 mit `allowCredentials` für bekannten User)

---

## v702 – Fix Login ohne Passkey (Session-Lock endgültig gelöst)

**Eigentliche Ursache**: Solange `passkey-auth-challenge-discover` die PHP-Session schreibt, belegt der Server-seitige PHP-Prozess die Session-Datei – auch wenn der Client den Fetch abbricht. Der nächste Request (`auth/identify`) wartet auf den Lock.

**Lösung: Stateless Discover-Challenge**
- `passkey-auth-challenge-discover` schreibt **nichts** mehr in die Session, gibt stattdessen ein HMAC-signiertes Token zurück: `HMAC-SHA256(SESSION_NAME, challenge|timestamp)`
- Client speichert `{token, ts, challenge}` im Speicher und schickt sie beim Verify mit
- `passkey-auth-verify` prüft HMAC + Timestamp (max. 2 Min.) und verifiziert die Assertion direkt – ohne Session-Lookup
- Neue Methode `Passkey::authVerifyStateless()` für diesen Pfad
- Globales `session_write_close()` aus v700 wieder entfernt (war Workaround, nicht Fix)

---

## v701 – Fix weißer Bildschirm

- **Syntaxfehler**: In v700 eingeführtes Avatar-HTML hatte unescapte einfache Anführungszeichen im `onerror`-Attribut → JS-Parse-Fehler → kompletter Ladeausfall
- Fix: `onerror="this.style.display=\\'none\\'"` korrekt escaped

---

## v700 – Fix Login hängt (Session-Lock, Take 2)

**Eigentliche Ursache**: `AbortController` wurde erst nach dem `apiPost`-Aufruf erstellt → ein Klick auf "Weiter" während des laufenden Requests konnte den Fetch nicht abbrechen → Session blieb gesperrt → `auth/identify` wartete.

**Fixes:**
- **`api()`**: Nimmt jetzt optionalen `signal`-Parameter entgegen und gibt ihn an `fetch()` weiter
- **`_startConditionalPasskey`**: `AbortController` wird VOR dem ersten `apiPost` erstellt → Abort greift sofort auch auf den laufenden Fetch
- **`api/index.php`**: `session_write_close()` direkt nach `Auth::startSession()` → Session ist global read-only; nur schreibende Routes rufen `Auth::sessionWriteStart()` explizit auf
- **`Auth::sessionWriteStart()`**: Neue Hilfsmethode öffnet Session bei Bedarf neu
- Alle schreibenden Auth-Routen (`identify`, `login`, `logout`, `passkey-*`, `email-code-*`, `totp-verify`) rufen `sessionWriteStart()` vor dem ersten Session-Zugriff auf

---

## v699 – Fix Avatar direkt nach Login

- **Ursache**: `auth/me` wurde zwar abgewartet und `currentUser.avatar` gesetzt, aber der Header-DOM wurde danach nicht aktualisiert (nur `renderPage()` folgte, das den Header nicht neu aufbaut)
- **Fix**: Nach `auth/me`-Response wird `#user-avatar` und `#user-name-disp` direkt im DOM aktualisiert → Avatar erscheint ohne F5

---

## v698 – Fix Login hängt ohne Passkey

- **Ursache**: PHP-Session-Lock-Konflikt – `auth/passkey-auth-challenge-discover` (Conditional UI) und `auth/identify` (Weiter-Klick) liefen gleichzeitig, zweiter Request wartete auf Session-Freigabe
- **Fix 1**: `session_write_close()` nach Session-Schreibvorgängen in `passkey-auth-challenge-discover` und `identify` → Session-Lock wird sofort freigegeben
- **Fix 2**: `_abortConditionalPasskey()` wird jetzt VOR dem `identify`-Request aufgerufen statt danach
- **Fix 3**: `_startConditionalPasskey()` startet mit 500ms Verzögerung → kein sofortiger Konflikt bei schnellem Weiter-Klick

---

## v697 – Fix Passkey Conditional UI

- **authVerify**: `empty(passkey_auth_user_id)` schlug bei Discoverable-Flow fehl weil userId=0 als empty gilt → separate Prüfung für Discoverable-Flag
- **DB-Suche**: Bei Discoverable-Flow wird Passkey nur per `credential_id` gesucht (ohne `AND user_id=0`)
- **Session**: Nach erfolgreichem Verify wird `user_id` aus dem gefundenen Passkey-Eintrag in die Session geschrieben → api/index.php findet den User korrekt

---

## v696 – Login: 2-Schritt-Flow + Passkey Conditional UI

- **2-Schritt wiederhergestellt**: Schritt 1 fragt nur E-Mail ab → Weiter → Schritt 2 zeigt Passwort + 2FA-Optionen
- **Conditional UI**: `autocomplete="username webauthn"` am E-Mail-Feld + stiller Hintergrund-`credentials.get({ mediation: 'conditional' })` → Passwort-Manager/Browser zeigt Passkey-Vorschläge direkt im Eingabefeld an
- **Kein extra Button nötig**: Passkey wird automatisch angeboten, wenn der Cursor ins Feld kommt
- **AbortController**: Conditional-UI-Request wird sauber abgebrochen wenn der Nutzer auf "Weiter" klickt

---

## v695 – Passkey-First Login

- **Discoverable Credentials**: Passkey-Button oben im Login-Dialog — kein Benutzername nötig, Browser zeigt direkt alle gespeicherten Passkeys für die Domain
- **Layout**: Passkey-Button prominent oben, Trennlinie "oder mit Passwort", darunter E-Mail + Passwort-Felder
- **Backend**: Neuer Endpunkt `auth/passkey-auth-challenge-discover` mit leerem `allowCredentials`-Array; `authVerify` sucht User jetzt per `credential_id` wenn kein Session-User vorhanden
- **Passkey.php**: Neue Methode `authChallengeDiscover()`

---

## v694 – Login: E-Mail und Passwort kombiniert

- **Schritt 1 + 2 zusammengeführt**: E-Mail und Passwort werden jetzt auf einem Bildschirm eingegeben (wie bei den meisten Websites)
- **Enter-Taste**: Im E-Mail-Feld springt Enter zum Passwort-Feld, im Passwort-Feld löst Enter den Login aus
- **Passkey-Button**: Expliziter Button "🔑 Mit Passkey anmelden" statt automatischem Dialog — fragt zuerst nach E-Mail, startet dann den Passkey-Flow
- **Zurück in 2FA (Schritt 3)**: Führt wieder zum kombinierten Formular zurück

---

## v693 – Veranstaltungen-Tabelle: iPad-Layout

- **Tablet-Breakpoint (601–1100px)**: Pace- und Meisterschaft-Spalten werden ausgeblendet – wie bereits auf dem Smartphone
- **Spaltenbreiten Tablet**: Athlet 42 %, AK 11 %, Ergebnis 27 %, Platz AK 20 % → kein Ellipsis mehr zwischen AK und Ergebnis
- **white-space: nowrap** auf allen Zellen → kein ungewollter Zeilenumbruch innerhalb einer Zelle

---

## v692 – Fix Cache-Buster

- **build.py**: `?v=XXX` Query-Strings in `index.html` werden jetzt bei jedem Build mitgebumt → Browser lädt `app.js` und `app.css` nach jedem Deploy frisch

---

## v691 – GitHub-Metadaten & Build-Skript

- **CHANGELOG.md**: Einheitliches Format (`## vXXX – Titel` + `---`-Trennlinie), doppelter v689-Eintrag bereinigt
- **README.md**: Auf v690-Featurestand aktualisiert; Setup-Anleitung, API-Tabelle und Auto-Migrationen überarbeitet
- **build.py**: Neues Build-Skript pflegt COMMIT_EDITMSG, CHANGELOG und README automatisch bei jedem Build

---

## v690 – Favorisierte Disziplinen: Ergebnisanzahl + Sortierung

- **Ergebnisanzahl-Badge**: Jede Disziplin zeigt einen Badge mit der Anzahl vorliegender Ergebnisse
- **Sortierung**: Disziplinen innerhalb jeder Kategorie nach Ergebnisanzahl absteigend sortiert (bei Gleichstand alphabetisch)

---

## v689 – Mehrere Fixes

- **Registrierungen-Badge**: `.filter()` schlug fehl weil API-Response jetzt Objekt (nicht Array) → korrigiert
- **Vorname nach Login**: `auth/me` wird jetzt vor `renderPage()` abgewartet → Vorname sofort im Header
- **Footer-Links**: `footerLink()` nutzt `onclick=navigate()` statt `href` → internes Routing greift korrekt
- **Favorisierte Disziplinen**: Checkboxen nach Kategorie gruppiert (mit Kategorie-Überschrift)
- **Favorisierte Disziplinen**: Feldname `kategorie` statt `kategorie_name` korrigiert
- **Bestleistungen Top-Reiter**: wenn Favoriten konfiguriert → NUR diese anzeigen (nach Ergebnisanzahl sortiert), keine weiteren Disziplinen
- **Rollen-Buttons**: `display:flex` von `<td>` in umschließendes `<div>` verschoben → Edit/Löschen-Buttons erscheinen korrekt
- **Rollen-Tabelle**: `table-layout:fixed` + `<colgroup>` → kein Überlauf mehr; Rechte-Spalte mit `word-break:break-word`

---

## v687 – Mehrere Features & Fixes

**Avatar:**
- Athletenprofil zeigt jetzt Avatar des verknüpften Benutzerkontos
- Hall of Fame: Avatar war bereits vorhanden (JOIN mit benutzer-Tabelle)
- GET /athleten und GET /athleten/{id}: avatar_pfad via LEFT JOIN

**Footer & Rechtliches:**
- Externe URL-Felder entfernt – nur noch eigene Markdown-Texte bearbeitbar

**Admin → Benutzer:**
- Datenbankinfo-Panel entfernt
- Statische Rechte-Übersicht durch dynamischen Rollen-Manager ersetzt

**Rollen-Manager (Admin → Benutzer):**
- Neue DB-Tabelle `rollen` mit JSON-Rechte-Spalte (Auto-Migration, Standard-Rollen angelegt)
- Rechte: vollzugriff, benutzer_verwalten, rekorde_bearbeiten, einstellungen_aendern, alle_ergebnisse, eigene_ergebnisse, lesen
- Rollen umbenennen, neu anlegen, löschen (admin/leser geschützt)
- GET/POST/DELETE /rollen Endpoints

**Favorisierte Disziplinen (Admin → Disziplinen):**
- Neues Panel „⭐ Favorisierte Disziplinen"
- Checkboxen für alle vorhandenen Disziplinen
- Favoriten erscheinen in Bestleistungen als erste Reiter
- Gespeichert in `top_disziplinen` (Einstellungen)

**Admin → Registrierungen (Meisterschaften-Fix):**
- `meisterschaften_liste` und `top_disziplinen` in erlaubt-Liste eingetragen

---

## v686 – Mehrere Fixes

**Admin → Registrierungen:**
- Genehmigen/Ablehnen: Route-Bug behoben (war: "Unbekannte Route")
- Bereits zugeordnete Athleten werden im Dropdown ausgeblendet
- Badge-Höhe einheitlich (inline-flex, align-items:center)
- Badges + Athlet-Auswahl + Genehmigen/Ablehnen in einer Zeile
- Neues API-Format: gibt zugeordnete Athleten-IDs mit zurück

**Anmeldung:**
- Schritt 1: Text lautet jetzt „E-Mail-Adresse eingeben" (kein Benutzername mehr)
- Avatar + Vorname werden sofort nach Login über `auth/me` nachgeladen (kein F5 nötig)

**Neuer Athlet:**
- Jahrgang-Feld im Formular ergänzt

---

## v685 – Fix Admin Registrierungen-Karte

- **2FA-Badge**: `email_login_bevorzugt` fehlte im API-SELECT → jetzt korrekt „📧 E-Mail-Code"
- **Benutzername entfernt**: Karte zeigt nur noch E-Mail-Adresse (kein separater Name)
- **Layout**: Athlet-Dropdown + Genehmigen + Ablehnen in einer Zeile

---

## v684 – Benutzername abgeschafft + Registrierung Fixes

**Benutzername abgeschafft:**
- Registrierungsformular: Nickname-Feld entfernt
- Login: nur noch E-Mail-Adresse als Kennung
- Anzeige: Vorname aus Athletenprofil wenn vorhanden, sonst E-Mail
- `finalizeLogin` gibt jetzt `email` und `vorname` zurück
- Admin: Benutzer anlegen ohne Pflicht-Benutzername (Fallback: E-Mail)
- Bei Admin-Genehmigung: `benutzername = email` (statt Lokalpart)

**Registrierungs-Fixes:**
- Athlet-Dropdown: `name_nv` statt `name` (war `undefined`)
- `_adminAthleten` wird in `renderAdminRegistrierungen` geladen falls noch nicht vorhanden
- 2FA-Badge: erkennt jetzt `email_login_bevorzugt` → zeigt „📧 E-Mail-Code" statt „2FA ausstehend"

---

## v683 – Fix: Nickname-Check ignoriert pending-Einträge

- Gleiche Ursache wie v682: alter pending-Eintrag blockierte Nickname
- Nur noch aktive Benutzer und approved-Einträge blockieren den Nickname

---

## v682 – Fix: pending-Eintrag blockiert Registrierung nicht mehr

- pending-Einträge (abgebrochene Versuche) blockieren jetzt keine Neu-Registrierung mehr
- Nur aktive Benutzer (benutzer-Tabelle) und approved-Einträge blockieren
- pending + rejected werden beim nächsten Versuch gelöscht und neu angelegt

---

## v681 – Fix: Registrierung durch alten pending-Eintrag blockiert

- Problem: abgebrochene Registrierung hinterließ pending-Eintrag → neue Registrierung dauerhaft blockiert
- Fix: pending-Einträge älter als 48h blockieren nicht mehr
- Beim erneuten Versuch: abgelaufener pending-Eintrag wird gelöscht und neu angelegt
- Fehlermeldung unterscheidet jetzt: "bereits registriert" vs. "in Bearbeitung"

---

## v680 – Feature: E-Mail-Code als 2FA-Alternative bei Registrierung

- Schritt 3 (TOTP-Setup): neuer Button "📧 Stattdessen immer einen Code per E-Mail erhalten"
- Wahl gespeichert in `registrierungen.email_login_bevorzugt` + `benutzer.email_login_bevorzugt`
- Kein TOTP-Geheimnis wird gespeichert; totp_aktiv = 0
- Beim Login: wenn email_login_bevorzugt → Schritt 3 mit E-Mail-Tab, Code wird sofort gesendet
- Migration: neue Spalte in registrierungen + benutzer (automatisch)

---

## v679 – Fix: Registrierung ohne Domain-Filter

- regEmailCheck zeigte "✗ Nur @-Adressen sind zugelassen" wenn kein Domain-Filter aktiv
- Fix: wenn email_domain leer → jede gültige E-Mail akzeptieren

---

## v678 – Fix: vy99.de-Hardcoding entfernt + Domain-Check konditionalisiert

- `vy99.de` war als Fallback-Default in settings.php, app.js, api/index.php und setup.php hinterlegt
- Alle Fallbacks auf leeren String geändert
- Domain-Prüfung beim Registrieren (PHP + JS) läuft jetzt **nur noch wenn email_domain gesetzt ist**
- Registrierungsformular zeigt ohne Domain-Einschränkung „📧 Bitte eine gültige E-Mail-Adresse eingeben"

---

# Changelog – Statistikportal Leichtathletik

Alle wesentlichen Änderungen werden hier dokumentiert.  
Format: `vXXX – Kurzbeschreibung` mit Details zu Features, Fixes und Änderungen.

---

## v677 – Admin-Badges: Registrierungen + einheitlich Rot

- Badge-Zähler für Tab „📝 Registrierungen" (ausstehende Anträge)
- Alle drei Admin-Badges (Registrierungen, Anträge, Papierkorb) einheitlich in Rot (`var(--accent)`)
- Hilfsfunktion `_adminBadge(n)` für einheitliches Badge-Rendering

---

## v676 – Admin-Badge: Papierkorb-Zähler

- Papierkorb-Tab zeigt Anzahl der Einträge als Badge
- Zählt Ergebnisse + Athleten + Veranstaltungen zusammen

---

## v675 – Rollensystem: Athlet + Genehmigungsqueue

- Neue Rolle `athlet`: eigene Ergebnisse eintragen; Änderungen/Löschungen als Antrag
- Auto-Upgrade: `leser` → `athlet` wenn Athletenprofil zugewiesen wird (und zurück)
- Neue DB-Tabelle `ergebnis_aenderungen` (Genehmigungssystem)
- Admin-Tab „✋ Anträge" mit Badge-Zähler: offene Anträge genehmigen/ablehnen
- `leser` zurück auf Nur-Ansicht-Rolle
- ENUM `rolle` um `athlet` erweitert (Migration automatisch)

---

## v674 – Rollensystem: leser/editor/athlet (v673-Korrekturen)

- `leser`: Nur Ansicht (wie ursprünglich)
- `editor`: alle Ergebnisse sofort bearbeiten/löschen
- Rollenbeschreibungen und Dropdowns aktualisiert
- `badge-athlet` CSS (grün)

---

## v673 – Rollensystem-Anpassung (teilweise, revidiert in v674)

- Rollenbeschreibungen im Admin-UI aktualisiert

---

## v672 – Favicon aus Vereinslogo generieren

- Logo-Upload erzeugt automatisch `favicon.ico` (16×16 + 32×32 + 48×48, PNG-in-ICO)
- `generateIco()` PHP-Funktion (pure GD, kein Imagick)
- Beim Logo-Löschen wird `favicon.ico` ebenfalls entfernt
- `<link rel="icon">` und `<link rel="apple-touch-icon">` in `index.html`

---

## v671 – Fix: Prefs vor renderPage() abwarten (Race Condition)

- `apiGet('auth/prefs')` wurde async gestartet, `renderPage()` lief sofort durch
- Fix: `await apiGet('auth/prefs')` vor `renderPage()`

---

## v670 – Fix: rekState beim Logout zurücksetzen

- rekState-Filter beim Logout auf `undefined` → nächster Login lädt Prefs neu
- Login: Prefs immer in rekState schreiben (nicht nur wenn `undefined`)

---

## v669 – Bestleistungen-Filter pro Benutzer speichern

- Neue DB-Spalte `benutzer.prefs` (JSON, Auto-Migration)
- `GET/PUT auth/prefs` Endpoints
- Filter (mergeAK, unique, hlCur, hlPrev) werden beim Login geladen und bei Änderung gespeichert
- Nicht eingeloggte User: Hard-coded Defaults

---

## v668 – Fix: E-Mail-Einstellungen speichern

- POST-Format war falsch (`key/value` statt direkte Keys)
- Ein einziger POST mit `{email_domain, noreply_email}`

---

## v667 – Fix: Registrierungen-Tab Reihenfolge

- Subtab-Navigation war unterhalb des E-Mail-Panels
- Fix: adminSubtabs() → E-Mail-Panel → Registrierungsliste

---

## v666 – Fix: Papierkorb-Funktionen wiederhergestellt

- `renderPapierkorb` + `pkLeeren/pkDelete/pkRestore/pkLeerenBestaetigt` nach Refactoring-Fehler wiederhergestellt
- `renderAdminRegistrierungen` als korrekte Top-Level-Funktion

---

## v665 – Fix: emailSettingsHtml Scope-Bug

- Variable war in falscher Funktion definiert → ReferenceError
- Korrekt in `renderAdminRegistrierungen` verschoben

---

## v664 – Admin: E-Mail-Einstellungen in Registrierungen-Tab

- Panel aus „Darstellung" entfernt, jetzt oben im „Registrierungen"-Tab
- Zugelassene E-Mail-Domain: Checkbox-Toggle (deaktiviert = kein Domain-Filter)

---

---

## v671 – Fix Bestleistungen-Prefs Race Condition

- apiGet("auth/prefs") wurde async gestartet, renderPage() lief aber sofort durch
- Prefs kamen erst nach dem ersten Render an → F5 nötig
- Fix: await apiGet("auth/prefs") vor renderPage()
  Prefs-Fehler blockieren Login nicht (try/catch)

---


## v670 – Fix Bestleistungen-Filter Persistenz

- Beim Logout: mergeAK/unique/highlightCurYear/highlightPrevYear auf undefined
  → nächster Login lädt Prefs aus DB ohne alten State im Weg
- Beim Login: Prefs werden immer in rekState geschrieben (nicht nur wenn undefined)
- state.userPrefs beim Logout geleert

---


## v669 – Bestleistungen-Filter persistieren

- Neue DB-Spalte: benutzer.prefs (JSON) via Auto-Migration
- Neuer API-Endpoint: GET/PUT auth/prefs (nur eingeloggte User)
- Beim Login: Prefs laden → sofort in rekState anwenden
- Bei Toggle-Änderung: _saveRekPrefs() speichert async in DB
- Nicht eingeloggte Benutzer: Hard-coded Defaults unverändert
  (mergeAK=true, unique=true, hlCur=true, hlPrev=false)

---


## v668 – Fix E-Mail-Einstellungen speichern

- apiPost("einstellungen", {key:..., value:...}) war falsch
  API erwartet {email_domain:..., noreply_email:...} direkt
- Ein einziger POST statt zwei separate Requests

---


## v667 – Fix Registrierungen-Tab Reihenfolge

- Subtab-Navigation war unterhalb des E-Mail-Panels
- Fix: adminSubtabs() → E-Mail-Panel → Registrierungsliste

---


## v666 – Fix Papierkorb + Registrierungen-Tab

- renderPapierkorb-Body + pkLeeren/pkDelete/pkRestore/pkLeerenBestaetigt
  wurden beim v664/v665-Refactoring versehentlich gelöscht
- Alle Funktionen wiederhergestellt
- getDarstellungSettings/saveDarstellungSettings ebenfalls wiederhergestellt
- renderAdminRegistrierungen ist jetzt korrekt Top-Level-Funktion

---


## v665 – Fix E-Mail-Einstellungen im Registrierungen-Tab

- emailSettingsHtml war in falscher Funktion definiert → ReferenceError
- Variable jetzt korrekt innerhalb renderAdminRegistrierungen
- Fehlende schließende } ergänzt

---


## v664 – Admin: E-Mail-Einstellungen in Registrierungen-Tab

- Panel "Registrierung & E-Mail" aus Darstellung entfernt
- Neu oben im Registrierungen-Tab als "E-Mail-Einstellungen"
- "Zugelassene E-Mail-Domain": Checkbox-Toggle — deaktiviert wenn leer/aus
  → Domain-Feld disabled, Wert wird beim Speichern als leer gesetzt
- Eigener Speichern-Button für E-Mail-Einstellungen

---


## v663 – Fix TOTP-Bestätigung

- doTotpVerify suchte #totp-err — im neuen Step-3-Layout heißt es #login-err
  → errEl war null → TypeError → Button reagierte nicht
- Fix: getElementById("login-err") || getElementById("totp-err") + null-safe

---


## v662 – Login Schritt 2: Passkey automatisch + parallel

- Passkey-Dialog wird sofort beim Laden von Schritt 2 ausgelöst
- Passwortfeld bleibt gleichzeitig aktiv (parallele Eingabe möglich)
- Passkey-Abbruch durch Nutzer: stille Ausblendung des Hinweises
- Passkey-Fehler: Hinweistext, Passwort weiterhin nutzbar
- Passkey-Erfolg: direkte Anmeldung, Passwortfeld wird ignoriert

---


## v661 – Neuer Login-Flow: 3 Schritte

Schritt 1: Nur Benutzername oder E-Mail-Adresse
Schritt 2: Passwort ODER Passkey-Button (wenn vorhanden)
Schritt 3: TOTP-Code, Passkey oder NEU: Verifizierung per E-Mail-Code (6-stellig, 5 Min.)
Backend: auth/identify, auth/email-code-send, auth/email-code-verify
Passkey-Auth jetzt auch in Schritt 2 möglich (identify_user_id Session)

---


## v660 – Fix RR-Import: isAkList Regex

- /_ak_/i matchte nur wenn Unterstrich auf BEIDEN Seiten
  "Ergebnisse_AK" endete mit _AK ohne trailing _ → kein Match → Gesamtplatz 195
- Fix: /_ak(?:_|$)/i matcht auch am Ende des Listennamens

---


## v659 – Fix leichtathletik.de: Datum/Eventname bei DM-Events

- "06. - 08. MRZ 2026" wurde nicht erkannt: MRZ statt MÄR für März
- Regex erweitert: MRZ als gültige März-Abkürzung
- Mehrtägiges Format "DD. - DD. MMM YYYY" wird jetzt korrekt geparst
  (letztes Datum = Endtag wird verwendet)

---


## v657 – Fix RR-Import Fallback + Debug

- clubPhrase ist String (nicht Array) → clubPhrase.join() war Bug
- Debug-Output im Fallback zeigt ak= und year= für gefundene Athleten

---


## v657 – Fix RR-Import: AK aus Jahrgang berechnen

- Problem: DataFields ohne AK-Feld → akFG="MHK"/"WHK" aus Gruppenname (Männlich/Weiblich)
  calcDlvAK lief nicht weil rAK bereits gesetzt war
- Fix: wenn rAK nur generisches MHK/WHK (kein Jahrgangsspezifisch) und Jahrgang bekannt
  → calcDlvAK aufrufen → Kebeck 1971, Event 2026 → M55 ✓
- Geschlecht wird auch aus akFG abgeleitet wenn rGschl leer

---


## v656 – Fix RR-Import: f-Filter nur als Fallback

- v655 war zu aggressiv: expandierte immer bei Contest=0 → brach Winterlaufserie
- Neues Konzept: normaler Durchlauf zuerst (unverändert)
  Nur wenn 0 Ergebnisse + Contest=0-Listen + mehrere Contests →
  Fallback mit f=ContestName\x0C\x0C<Ignore> Parameter (neues RR-API-Format)
- Bestehende Strukturen (Winterlaufserie, normale Events) unverändert
- Crosslauf mit Mittelstrecke/Langstrecke findet jetzt alle 4 Athleten

---


## v655 – Fix RR-Import: Contest-Filter via f-Parameter

- Problem: "Online|Final" mit Contest=0 lieferte nur Contest 1
  Contest 2/3 über contest=2 gab "list not found"
- Root cause: neues RR-API-Format nutzt f=ContestName\x0C\x0C<Ignore>
  als Filter-Parameter statt contest=ID
- Fix: bei Contest=0 + mehrere Contests → Liste pro Contest-Namen expandiert
  mit f=Mittelstrecke\x0C\x0C<Ignore> etc.
- Alle 4 TuS-Oedt-Athleten (Kebeck, Walter, Chmielewski, Bauer) werden gefunden

---


## v654 – Fix RR-Import: Mehrere Contests pro Liste

- Problem: "Online|Final" mit Contest=0 liefert nur Contest 1 (Lauf der Jüngsten)
  Mittelstrecke (2) und Langstrecke (3) wurden nie abgerufen
- Fix: Wenn Contest=0 und mehrere spezifische Contests (1,2,3...) existieren,
  wird die Liste einmal pro Contest expandiert
  "Online|Final" → Contest 1 + Contest 2 + Contest 3

---


## v653 – Fix Hall of Fame: Jugend-AK-Badges

- Regex /^Bestleistung W\d/ matchte nur W30, W45 etc.
  WU14, WU16, WU18, MU12 etc. wurden nicht erkannt → Badge blieb leer
- Fix: /^Bestleistung W(?:\d|U\d)/ matcht jetzt beide Formate

---


## v652 – Fix leichtathletik.de: Platz aus AK-Block col-1

- col-6 ("8./I") ist der Laufplatz, nicht der AK-Platz
- Im AK-Block (Männer, Frauen, Weibliche Jugend U18, Senioren M60...)
  wird col-1 direkt als AK-Platz genutzt
- Außerhalb (Gesamtergebnis): col-6 für Masters-Layout ("1./III")
- AK-Block-Regex erweitert: Weibliche Jugend, Männliche Jugend, Senioren

---


## v650 – Fix leichtathletik.de: AK-Platz korrekt

- Root cause: Zeitlauf-Listen haben mehrere runblock-Sektionen:
  1. Gesamtergebnis (col-1 = 27, alle Klassen gemischt)
  2. Männer/MHK (col-1 = 14, AK-Platz) ← korrekt
  3. Zeitlauf 1/2/3 (col-6 = 8./I, nur Laufplatz)
- Importer las erste Fundstelle (Gesamtergebnis) und übersprang Rest
- Fix: runblock-Name wird ausgelesen; Blöcke wie "Männer", "Frauen",
  "MHK", "WHK", "M45" etc. gelten als AK-Blöcke und überschreiben
  den Gesamtergebnis-Platz

---


## v649 – Fix _proc: rekursive Gruppenverarbeitung

- Root cause: AK_Tag_N-Listen haben 4 Ebenen (Realer Lauf > 5km > Männlich > M60)
  _proc iterierte nur 2 Ebenen (k + k2) → AK-Listen wurden komplett ignoriert
  Ergebnis: nur Ges/MW-Listen mit Gesamtplatz wurden verarbeitet
- Fix: _proc nutzt jetzt rekursive _walkGroups() für beliebige Tiefe
  _processRows() verarbeitet die gefundenen Row-Arrays
- AK-Listen werden jetzt korrekt verarbeitet → AK-Platz statt Gesamtplatz

---


## v648 – Fix Laufserie: AK-Platz korrekt

- Statt aggressivem Ges/MW-Filter: isAkList-Flag pro Liste
- Beim Duplikat-Check: Platz aus AK-Listen überschreibt Gesamtplatz
  Nicht-AK-Listen setzen Platz nur wenn noch 0
- Alle Listen werden weiterhin importiert (kein r=search-Problem)

---


## v647 – Fix: Laufserie AK-Platz

- Wenn AK-Listen (_AK_Tag_N) vorhanden: Ges- und MW-Listen überspringen
  (Ges/MW enthalten Gesamtplatz wie 81, AK-Liste hat AK-Platz wie 1)
- Debug-Log entfernt

---


## v645 – Fix Laufserie-Datum

- _datumOverride wurde im falschen Loop (parsed.forEach statt rows.forEach) gesucht
- Fix: Datum-Setzen jetzt im rows.forEach-Loop am Ende von bulkFillFromImport

---


## v644 – Laufserie-Verbesserungen

── Gesamtzeiten rausfiltern ──
- Listen mit "_Serie_" im Namen werden übersprungen (Akkumulations-Zeiten)
  z.B. "Ergebnisliste_Serie_AK" → wird nicht importiert
── Tag-Datum-Dialog ──
- Tag-Nummer wird aus Listennamen extrahiert (_Tag_1, _Tag_2, _Tag_3)
- Nach dem Import: wenn mehrere Tags → Dialog für Datum pro Lauf
  Vorausgefüllt mit dem Hauptveranstaltungsdatum
- Datum wird als Zeilen-Datum (_datumOverride) in die Tabelle eingetragen
── Zusammenspiel mit bestehenden Dialogen ──
- Reihenfolge: Tag-Datum → Laufserie-Dialog → Neue-Athleten-Dialog

---


## v643 – Laufserie-Dialog beim Bulk-Import

- Erkennung: gleicher Name + gleiche Disziplin mehrfach → Laufserie
- Dialog zeigt alle Läufe pro Athlet mit Ergebnis, AK und Platz
- Alle Läufe sind vorausgewählt; einzelne können abgewählt werden
- "Alle" / "Keine" Buttons für Schnellauswahl
- Nicht-Serien-Einträge werden immer übernommen
- Dialog erscheint VOR dem Neue-Athleten-Dialog

---


## v642 – Cleanup v642

- Debug-Logging aus 14_leichtathletik.js entfernt (window._laDebugPlatz)
- Debug-Parameter aus la-fetch PHP-Handler entfernt
- Hinweis: FLVW Masters Zeitläufe haben keinen AK-Platz in den Listen
  wenn der Athlet keinen Windwert hat (kein Eintrag in der Ergebnisspalte)
  → rPlatz=0 ist korrekt, kein Code-Bug

---


## v639 – Fix la-fetch + AK-Platz LA-Import

- Doppelter la-fetch Handler: file_get_contents-Variante (Zeile 3200) entfernt
  lieferte leeres HTML für viele URLs; curl-Handler (Zeile 3248) bleibt aktiv
- AK-Platz: robustere Spalten-Erkennung für verschiedene LA-Layouts
  Prüft col-6 (FLVW Masters: "1./III"), col-5, col-1 in Prioritätsreihenfolge
  parseInt("1./III") = 1 ✓

---


## v638 – Fix leichtathletik.de: AK-Platz korrekt auslesen

- FLVW Hallenmeisterschaften Masters: col-1 = Gesamtplatz, col-6 = AK-Platz
  col-6 firstline hat Format "1./III" (AK-Platz/Laufnummer)
- Fix: col-6 wird bevorzugt wenn erstes Zeichen eine Zahl ist
  parseInt("1./III") = 1 ✓
- Fallback auf col-1 wenn col-6 kein Platz enthält

---


## v637 – Fix: Jahrgang/Geschlecht im Neue-Athleten-Dialog

- RR-Import (_proc): year und geschlecht werden jetzt in allResults gespeichert
- LA-Import: Jahrgang aus col-3 und Geschlecht aus Listenname in allResults
- bulkFillFromImport: Geschlecht aus AK ableiten wenn nicht direkt vorhanden
  (W65 → W, M40 → M, F → W)

---


## v636 – Bulk-Import: Neue-Athleten-Dialog

- Nach URL-Import (LA, RaceResult, Mika, Uits): nicht erkannte Athleten
  werden gesammelt und in einem Dialog angezeigt
- Für jeden neuen Athleten: "Neu anlegen" (mit Vorname/Nachname/G./Jahrgang
  vorausgefüllt), "Vorhandenen zuordnen" oder "Überspringen"
- Beim Anlegen wird der Athlet sofort in state.athleten eingefügt
- Nach dem Dialog: Tabelle wird mit den neuen IDs korrekt befüllt
- Gilt für alle URL-Import-Quellen (bulkFillFromImport ist jetzt async)

---


## v635 – Fix Altersklassen-Admin: Route-Reihenfolge

- ak-standard und ak-mapping Endpunkte standen nach dem 404-Handler
- Jetzt korrekt vor jsonErr("Unbekannte Route") platziert

---


## v634 – Admin Altersklassen komplett neu

── Konzept ──
- Abschnitt 1: Standard-AKs (DLV) definieren — vorbelegt mit MHK/WHK, M30-M85, W30-W85,
  MU8-MU23, WU8-WU23; per + Hinzufügen / × Löschen pflegbar
- Abschnitt 2: Nicht-Standard AKs zuordnen — alle AKs aus Ergebnissen die kein Standard sind
  können einer Standard-AK zugeordnet werden (z.B. wjA→WHK, F→WHK, MJU20→MU20)
- Vorschläge werden automatisch berechnet (akAutoSuggest)
- "Alle Vorschläge übernehmen" füllt leere Zuordnungen aus
── Backend ──
- Neue Tabellen: ak_standard (DLV-Standard-AKs), ak_mapping (Nicht-Standard→Standard)
- buildAkCaseExpr: berücksichtigt ak_mapping vor den alten jugend_aks
- Neue Endpunkte: ak-standard (GET/POST/DELETE), ak-mapping (GET/POST)

---


## v633 – Fix ergebnisse/bulk: richtiger Handler gefixt

- Root cause: der tatsächlich aktive res="ergebnisse" bulk-Handler (ab ~Zeile 2773)
  ignorierte $item["disziplin_mapping_id"] komplett
  und suchte immer per WHERE dm.disziplin=? → lieferte erste ID (oft Bahn/Straße)
- Vorherige Fixes (v629-v632) hatten einen ANDEREN Code-Pfad (Zeile ~786) gefixt
  der für legacy-Kategorien gedacht war, aber nicht für "ergebnisse"
- Fix: $midFromClient = $item["disziplin_mapping_id"] wenn vorhanden
  Lookup dann per dm.id=? statt dm.disziplin=?
  200m+mid=33 → Halle ✓, 800m+mid=70 → Halle ✓
- Auch: $pace aus INSERT entfernt (war undefinierte Variable)

---


## v632 – DB-Migration: Hallen-Ergebnisse korrigiert

- Bestehende Einträge aus Hallen-Veranstaltungen hatten falsche mapping_ids
  (800m→id=17 Straße statt id=70 Halle, 200m→id=35 Bahn statt id=33 Halle, etc.)
- Auto-Migration beim App-Start korrigiert alle betroffenen Einträge:
  JOIN veranstaltungen WHERE name LIKE "%Halle%" + falsche mapping_id → richtige
- Betrifft: 800m, 200m, 400m, 1.500m, 3.000m, 50m mit Bahn/Straße-Mapping
  in Veranstaltungen deren Name "Halle" enthält

---


## v631 – Fix Kategorie-Bugs v631

── Bug 1: 800m landet in Straße statt Halle ──
- PHP: wenn dmMid vom Client → disziplin-Name NICHT aus Mapping überschreiben
  (DB hat id=70 mit disziplin="800m" wie id=17 Straße und id=64 Bahn)
  Nur distanz aus Mapping holen; Kategorie läuft ausschließlich über disziplin_mapping_id
── Bug 2: fehlende Kategorien in Klammern ──
- Veranstaltungen-API: kategorie_name + tbl_key fehlten im ergebnisse-SELECT
- Dashboard-API: gleiches Fix für recent-Ergebnisse
- 11_veranstaltungen.js: diszMitKat(ergDiszLabel(...)) war Doppel-Lookup → ersetzt durch ergDiszLabel direkt
- 04_ergebnisse.js: diszMitKat(rr.disziplin) → ergDiszLabel(rr) wenn mapping_id vorhanden

---


## v630 – DB-Normalisierung v630

── disziplin_mapping.distanz (neu) ──
- Neue Spalte distanz FLOAT in disziplin_mapping (Meter)
- Auto-Migration beim App-Start befüllt alle 67 bekannten Disziplinen
- ergebnisse.distanz wird daraus synchronisiert (konsistente Quelle)
- ergebnisse.disziplin wird aus mapping normalisiert
── INSERT-Logik ──
- bulk INSERT: distanz aus disziplin_mapping statt aus Client-Body
- single INSERT: distanz aus disziplin_mapping statt aus Client-Body
- disziplin_mapping_id vom Client hat Priorität (v629)
── pace deprecated ──
- ergebnisse.pace wird nicht mehr befüllt (on-the-fly berechnet)
- Auto-Migration: bestehende pace-Werte bleiben (nicht gelöscht)
── Admin-UI ──
- Disziplin-Editier-Dialog: neues Feld "Strecke (Meter)"
- POST/PATCH disziplin_mapping überträgt distanz
- GET disziplin_mapping liefert distanz zurück
── JS ──
- diszKm(): nutzt distanz aus state.disziplinen, Namens-Parser als Fallback

---


## v629 – Fix Kategorie-Speicherung: disziplin_mapping_id vom Client

- Root cause gefunden via DB-Dump: PHP ignorierte $item["disziplin_mapping_id"]
  komplett und machte eigenen Lookup: SELECT id WHERE disziplin="800m"
  → erster Treffer = id=64 (bahn), nicht id=70 (halle) → falsche Kategorie
- Fix: $item["disziplin_mapping_id"] vom Client verwenden wenn vorhanden
  → JS sendet diszMid=70 (halle) → wird korrekt gespeichert
- Disziplin-Name wird aus mapping normalisiert (z.B. "800m" → "800m Halle")
- Fallback nur wenn kein disziplin_mapping_id vorhanden: Name-Lookup

---


## v628 – Fix Kategorie-Zuweisung: robuste diszMid-Setzung

- data-mid Attribut auf bk-disz speichert mapping_id → bleibt bei bkKatChanged erhalten
- bkKatChanged: data-mid bevorzugt vor prev-Value beim Wiederherstellen
- Fallback: wenn diszMid nicht im Dropdown → bk-kat temporär auf korrekte kat setzen
  → Option erzwingen → kein stiller Fallback auf falschen Kategorie-Eintrag

---


## v626 – Fix Kategorie-Zuordnung: bkKatChanged() nach bk-kat

- Root cause: bk-kat wurde auf "halle" gesetzt, aber bkKatChanged() nicht
  aufgerufen → bulkAddRow() baute Dropdown mit altem Wert ("strasse")
  → nur Straße-800m (id=17) sichtbar → diszMid=70 (halle) kein Match
  → Name-Fallback "800m" trifft erste Option = Straße
- Fix: bkKatChanged() direkt nach bk-kat = kat aufrufen
  → Disziplin-Dropdown zeigt halle-Optionen → diszMid=70 matcht korrekt

---


## v625 – Fix: Disziplin landet in richtiger Kategorie

- 800m Halle wurde als 800m Straße gespeichert weil bk-disz nur den Namen
  als Value hatte und der Bulk-Endpoint per Name suchte (erste Kategorie gewinnt)
- Fix 1: bkDiszOpts nutzt mapping_id als Option-Value (wenn vorhanden)
- Fix 2: bulkFillFromImport matcht zuerst per diszMid, dann per Name
- Fix 3: bulkSubmit trennt Value in mapping_id + Disziplin-Name auf
- Fix 4: PHP Bulk-Endpoint nutzt disziplin_mapping_id direkt aus Item

---


## v625 – Fix Import-Kategorie: exakter kat-Treffer bevorzugen

- Problem: bkKatMitGruppen("halle") enthält auch "strasse" bei Gruppen-Konfiguration
  → disziplinen.find() nimmt ersten Treffer = 800m Straße statt 800m Halle
- Fix: zuerst exakten kat-Match suchen, erst dann Gruppen-Fallback
  Gilt für: 14_leichtathletik.js, 07_eintragen.js (Mika+Uits)

---


## v624 – Eintragen: Formular-Reset nach Speichern

- Nach erfolgreichem Speichern: renderEintragen() setzt alle Felder zurück
  (Tabelle, Datum, Ort, Veranstaltung, Kategorie, Paste-Feld)
- Statusmeldung "✅ 8 gespeichert" bleibt erhalten

---


## v623 – Fix leichtathletik.de: Details-URL akzeptiert

- URL /Competitions/Details/18052 wurde nicht als gültige Event-ID erkannt
- Fix: "Details" zur Regex-Gruppe hinzugefügt

---


## v622 – Fix Bestleistungen: korrekte Zeitumrechnung

- MySQL TIME_TO_SEC("16:07") = 58020s (HH:MM-Interpretation!)
  statt 967s (MM:SS) → alle alten Ergebnisse wurden falsch sortiert
- Fix: TIME_TO_SEC(CONCAT("00:", resultat)) → "16:07" → "00:16:07" → 967s
- $sortCol nutzt jetzt denselben CASE-Ausdruck wie die Timeline-Query
- COALESCE(resultat_num, ...) behält korrekte Werte für neue Einträge

---


## v621 – Fix Bestleistungen-Reihenfolge: einfache Lösung

- SQL-Subquery-Ansatz (v617-v620) hatte Alias-Probleme und GROUP BY-Tücken
- Neue Strategie: SQL liefert ALLE Ergebnisse sortiert nach Ergebnis (ASC/DESC)
  PHP nimmt pro athlet_id den ersten Eintrag = Bestleistung
- $pbDedup(): iteriert einmal über sortierte Rows, behält ersten Treffer je Athlet
- Kein GROUP BY, kein Subquery, keine Alias-Probleme
- M/W/AK-Splits werden aus demselben $all_rows-Array gefiltert (ein DB-Call)

---


## v620 – Fix Bestleistungen SQL: pbAkExpr

- $akExpr enthält "e.altersklasse" → im AK-Subquery pb_e-Alias nötig
- Fix: $pbAkExpr = str_replace("e.", "pb_e.", $akExpr)

---


## v619 – Fix Bestleistungen SQL: pbDiszCond

- $diszCond enthält "e.disziplin_mapping_id" → im Subquery pb_e-Alias nötig
- Fix: $pbDiszCond = str_replace("e.", "pb_e.", $diszCond)

---


## v618 – Fix Bestleistungen SQL: Subquery-Alias

- $sortCol enthält "e.resultat_num" → im Subquery-Alias "pb_e" → Fehler
- Fix: $pbSortCol = str_replace("e.", "pb_e.", $sortCol)

---


## v617 – Fix Bestleistungen-Reihenfolge

- Problem: LIMIT 50 auf allen Ergebnissen → JS-seitige Deduplizierung
  → ältere Nicht-PBs eines Athleten füllten den Pool und verdängten
  andere Athleten (z.B. Kiekhöfel 2021+2022+2023 vor Koppers 2024)
- Fix: SQL-Subquery berechnet MIN/MAX per athlet_id (je nach sort_dir)
  JOIN auf dieses PB-Ergebnis → genau 1 Ergebnis pro Athlet, nach PB sortiert
- Gilt für gesamt, Männer, Frauen und alle AK-Kacheln

---


## v616 – Fix RR-Import: RANK1p/RANK3p Feldnamen

- Hülskens Marathon: DataFields "RANK1p" (Gesamtplatz) und "RANK3p" (AK-Platz)
  wurden nicht erkannt → Default iPlatz=2 (BIB) → falsche Platzierung
- Fix: /^rank\dp$/-Muster: rank1p → iPlatz, rankNp (N>1) → iAKPlatz
- Gilt für alle _cal-Blöcke in 07_eintragen.js, 08_raceresult.js, template

---


## v615 – Fix _calibrateDF (kompakt): AK-Erkennung korrekt

- Die kompakte _cal-Funktion in _proc (Bulk-Import) war nie aktualisiert worden
- Alle Fixes aus v613/v614 galten nur für die Spaced-Variante in rrFetch()
- Fix: Platz-Felder (withstatus/overallrank/agegrouprank) VOR agegroup prüfen
- Fix: AgeGroup-Erkennung mit &&f.indexOf("rank")<0 Guard
- Fix: agegroupname-Feldname hinzugefügt
- "WithStatus([AgeGroupRankp])" → iAKPlatz, nicht mehr iAK
- "AgeGroupName1" → iAK (korrekt, weil indexOf("rank")<0)

---


## v613 – Fix RaceResult-Import: AK aus Sub-Gruppen-Key

- 2019er Event: "Age Group Results" hat kein AK-Feld in DataFields
  AK steckt im Sub-Gruppen-Key: "#5_Jedermann Frauen" → WHK, "#3_W30" → W30
- akFG: k2clean aus Sub-Key via normalizeAK auflösen
- normalizeAK: Fallback wenn Männer/Frauen-Text ohne Jugend-Zahl → MHK/WHK
  "Jedermann Frauen" → WHK, "Jedermann Männer" → MHK
- calcDlvAK: "F" als Geschlecht erkannt (wie "W") via /^[WwFf]/

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
  (z.B. Swift Cross: "Willich" statt Vereinsname) → 0 Treffer
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