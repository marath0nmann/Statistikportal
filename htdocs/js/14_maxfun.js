// ── MaxFun Sports (maxfunsports.com) ─────────────────────────────────────────
//
// Copy-&-Paste-Importer. Ein automatischer Abruf ist hier NICHT moeglich:
// maxfunsports.com liegt hinter einer Cloudflare Managed Challenge (jede
// serverseitige Anfrage bekommt HTTP 403 + JS-Challenge), und die robots.txt
// untersagt Crawler ausdruecklich. Der Nutzer kopiert die Ergebnistabelle
// daher im Browser und fuegt sie in das Einlesen-Feld ein.
//
// Tabellenaufbau (12 Spalten, erste Spalte leer):
//   | Pos | Stnr | Vorname | Nachname | Nation | Club / Team | Kategorie |
//   GPos | KPos | TPos | Zeit
// Beispielzeile (Chrome kopiert Zellen Tab-getrennt):
//   \t13.\t7067\tDominik\tHirczy\tAUT\tLauftreff Nussdorf\tM AK\t13\t1\t-\t01:06:47
//
// Tipp fuer den Nutzer: Die Ergebnisseite laesst sich per URL nach Verein
// filtern, dann sind es nur wenige Zeilen zum Kopieren:
//   /result/competition?id=<ID>&ResultSearch[clubTeam]=<Verein>
// (per-page wird serverseitig auf 50 gedeckelt, daher immer seitenweise.)

var MFS_URL_RE = /^https?:\/\/(www\.)?maxfunsports\.com\//i;

// Kategorie-Spalte → DLV-Altersklasse.
// MaxFun (AT) nutzt "Elite M"/"M AK" fuer die Hauptklasse und sonst M40/W35/…
// Fein-Zuordnung uebernimmt ohnehin der DLV-Angleich aus dem Geburtsjahr.
function mfsAk(raw) {
  var s = String(raw || '').trim();
  if (!s) return '';
  var m = s.match(/^(?:Elite\s+)?([MW])(?:\s*AK)?$/i);
  if (m) return m[1].toUpperCase() + 'HK';
  m = s.match(/^([MW])\s*U\s*(\d{1,2})$/i);
  if (m) return m[1].toUpperCase() + 'U' + m[2];
  m = s.match(/^([MW])\s*(\d{2})$/i);
  if (m) return m[1].toUpperCase() + m[2];
  return (typeof normalizeAK === 'function') ? normalizeAK(s) : s;
}

// Disziplin-Hinweis aus dem mitkopierten Wettkampfnamen
function mfsDiszHint(text) {
  var t = String(text || '');
  if (/halb\s*marathon|halbmarathon|half\s*marathon|21[,.]0?9?7?\s*km/i.test(t)) return 'Halbmarathon';
  if (/marathon/i.test(t)) return 'Marathon';
  var km = t.match(/(\d{1,3}(?:[,.]\d)?)\s*km\b/i);
  if (km) return km[1].replace(',', '.') + ' km';
  var me = t.match(/\b(\d{3,5})\s*m\b/i);
  if (me) return me[1] + ' m';
  return null;
}

function mfsFindDisz(hint, kat) {
  if (!hint) return { disz: '', diszMid: null };
  var aliases = { 'halbmarathon': 'Halbmarathon', '21.1 km': 'Halbmarathon', '21.097 km': 'Halbmarathon',
                  'marathon': 'Marathon', '42.2 km': 'Marathon' };
  var target = aliases[hint.toLowerCase()] || hint;
  function norm(x) { return String(x || '').toLowerCase().replace(/,/g, '.').replace(/\s/g, ''); }
  var tl = norm(target);
  var dl = (state.disziplinen || []).filter(function(d) { return !kat || d.tbl_key === kat; });
  function n(d) { return norm(d.disziplin); }
  var found = dl.find(function(d) { return n(d) === tl; });
  if (!found) found = dl.find(function(d) { return n(d).indexOf(tl) === 0 || tl.indexOf(n(d)) === 0; });
  if (!found) return { disz: '', diszMid: null };
  return { disz: found.disziplin, diszMid: found.id || found.mapping_id };
}

function mfsZeit(raw) {
  var s = String(raw || '').replace(/\s+/g, ' ').trim();
  if (/^(DNS|DNF|DQ|DSQ)$/i.test(s)) return { zeit: '', status: s.toUpperCase() };
  var m = s.match(/^(\d{1,2}:)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?$/);
  return m ? { zeit: s.replace(',', '.'), status: '' } : { zeit: '', status: '' };
}

// Erkennt eingefuegten MaxFun-Tabellentext. Bewusst streng: der generische
// Freitext-Parser (bulkParsePaste) darf nicht faelschlich uebersprungen werden.
function mfsIstPaste(text) {
  var lines = String(text || '').split(/\r?\n/);
  if (/Pos\s*\t?\s*Stnr/i.test(text) && /Vorname/i.test(text) && /Nachname/i.test(text)) return true;
  var treffer = 0;
  var max = Math.min(lines.length, 40); // laeuft bei jedem oninput – nicht ueber alles pruefen
  for (var i = 0; i < max; i++) {
    if (mfsParseZeile(lines[i], null)) treffer++;
    if (treffer >= 2) return true;
  }
  return false;
}

// Eine Ergebniszeile parsen. idx = aus der Kopfzeile abgeleitete Spaltenindizes
// (oder null → Struktur wird aus der Zeile selbst erkannt).
// Liefert null, wenn die Zeile keine Ergebniszeile ist.
function mfsParseZeile(line, idx) {
  var roh = String(line || '').replace(/ /g, ' ');
  if (!roh.trim()) return null;

  if (roh.indexOf('\t') >= 0) {
    var c = roh.split('\t').map(function(x) { return x.trim(); });
    while (c.length && c[0] === '') c.shift();
    while (c.length && c[c.length - 1] === '') c.pop();
    if (c.length < 8) return null;
    if (!/^\d{1,6}\.?$/.test(c[0])) return null;

    var iNat;
    if (idx && idx.nation != null) {
      iNat = idx.nation;
    } else {
      iNat = -1;
      for (var k = 2; k < c.length && k <= 6; k++) {
        if (/^[A-Z]{3}$/.test(c[k])) { iNat = k; break; }
      }
      if (iNat < 0) iNat = 4; // Nation leer → Standardaufbau annehmen
    }
    var vor  = c[iNat - 2] || '';
    var nach = c[iNat - 1] || '';
    if (!vor && !nach) return null;
    var z = mfsZeit(c[c.length - 1]);
    return {
      posGesamt:   parseInt(c[0], 10) || null,
      startnummer: /^\d{1,7}$/.test(c[iNat - 3] || '') ? c[iNat - 3] : null,
      name:        (vor + ' ' + nach).replace(/\s+/g, ' ').trim(),
      verein:      c[iNat + 1] || '',
      kategorie:   c[iNat + 2] || '',
      kPos:        /^\d{1,5}$/.test(c[iNat + 4] || '') ? c[iNat + 4] : '',
      zeit:        z.zeit,
      status:      z.status
    };
  }

  // Fallback ohne Tabs (z.B. aus PDF/E-Mail kopiert): Anker sind Nation (3
  // Grossbuchstaben), die drei Positionsspalten und die Zeit am Zeilenende.
  var m = roh.trim().match(
    /^(\d{1,6})\.?\s+(\S+)\s+(.+?)\s+([A-Z]{3})\s+(.*?)\s+(\d{1,5})\s+(\d{1,5}|-)\s+(\d{1,5}|-)\s+((?:\d{1,2}:)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?|DNS|DNF|DQ|DSQ)$/
  );
  if (!m) return null;
  var rest = m[5].trim();                       // Club + Kategorie zusammen
  var kat  = '';
  var km   = rest.match(/(?:^|\s)((?:Elite\s+)?[MW](?:\s*AK|\s*U\s*\d{1,2}|\s*\d{2})?)$/i);
  if (km) { kat = km[1].trim(); rest = rest.slice(0, rest.length - km[1].length).trim(); }
  var z2 = mfsZeit(m[9]);
  return {
    posGesamt:   parseInt(m[1], 10) || null,
    startnummer: /^\d{1,7}$/.test(m[2]) ? m[2] : null,
    name:        m[3].replace(/\s+/g, ' ').trim(),
    verein:      rest,
    kategorie:   kat,
    kPos:        m[7] === '-' ? '' : m[7],
    zeit:        z2.zeit,
    status:      z2.status
  };
}

// Spaltenindizes aus einer mitkopierten Kopfzeile ableiten
function mfsKopfIdx(line) {
  if (!line || line.indexOf('\t') < 0) return null;
  var c = line.split('\t').map(function(x) { return x.trim(); });
  // Gleiche Normalisierung wie in mfsParseZeile, sonst passen die Indizes nicht:
  // Kopf- und Datenzeile haben ein fuehrendes Leerfeld (Aufklapp-Spalte), die
  // Kopfzeile zusaetzlich ein leeres Endfeld (Zeit-Spalte ohne Ueberschrift).
  while (c.length && c[0] === '') c.shift();
  while (c.length && c[c.length - 1] === '') c.pop();
  var i = -1;
  for (var k = 0; k < c.length; k++) { if (/^Nation$/i.test(c[k])) { i = k; break; } }
  if (i < 3) return null;
  return { nation: i };
}

async function bulkImportFromMaxFun(raw, kat, statusEl) {
  var lines = String(raw).split(/\r?\n/);
  var idx = null, kopfZeile = -1;
  for (var i = 0; i < lines.length; i++) {
    var ki = mfsKopfIdx(lines[i]);
    if (ki) { idx = ki; kopfZeile = i; break; }
  }
  _bkDbgLine('Kopfzeile', kopfZeile >= 0 ? 'Zeile ' + (kopfZeile + 1) + ' (Nation = Spalte ' + idx.nation + ')' : 'nicht gefunden – Struktur wird je Zeile erkannt');

  // Alles oberhalb der ersten Ergebniszeile ist Kopftext (Wettkampfname, Datum)
  var parsed = [], kopfText = [], ersteDaten = -1;
  for (var j = 0; j < lines.length; j++) {
    var r = mfsParseZeile(lines[j], idx);
    if (r) { if (ersteDaten < 0) ersteDaten = j; parsed.push(r); }
    else if (ersteDaten < 0 && j !== kopfZeile) kopfText.push(lines[j].replace(/\t/g, ' ').trim());
  }
  var titel = kopfText.filter(function(l) { return l.length > 3; }).join(' | ');
  _bkDbgLine('Kopftext', titel || '–');
  _bkDbgLine('Geparste Zeilen', parsed.length);

  if (!parsed.length) {
    if (statusEl) statusEl.textContent = '❌ Keine MaxFun-Ergebniszeilen erkannt';
    _bkDbgLine('Fehler', 'Keine Zeile passte auf das MaxFun-Format');
    _bkDbgFlush();
    return;
  }

  // Datum aus dem Kopftext (falls mitkopiert)
  var dm = titel.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (dm) {
    var iso = dm[3] + '-' + String(dm[2]).padStart(2, '0') + '-' + String(dm[1]).padStart(2, '0');
    var dEl = document.getElementById('bk-datum');
    if (dEl) { dEl.value = iso; if (typeof bkSyncDatum === 'function') bkSyncDatum(iso); }
    _bkDbgLine('Datum', iso + ' (aus Kopftext)');
  }

  // Serie/Ort wie bei den uebrigen Importern automatisch zuordnen
  if (titel) {
    var serie = _bkMatchSerie(titel);
    if (serie) {
      bkSerieSetById(serie.id);
      _bkDbgLine('Serie', serie.name + ' (auto-erkannt)');
      if (!((document.getElementById('bk-ort') || {}).value) && serie.ort_letzte) {
        _bkAutoSetOrt(serie.ort_letzte);
        _bkDbgLine('Ort', serie.ort_letzte + ' (aus letzter Austragung)');
      }
    }
  }

  var hint = mfsDiszHint(titel);
  _bkDbgLine('Disziplin-Hinweis', hint || '– (bitte manuell setzen)');

  // Nur Vereinsathleten uebernehmen
  var athleten = state.athleten || [];
  var treffer = parsed.filter(function(r) { return r.name && uitsAutoMatch(r.name, athleten) !== null; });
  _bkDbgLine('Treffer (Name-Match)', treffer.length);

  if (!treffer.length) {
    _bkDbgLine('Hinweis', 'Keine Vereinsathleten gefunden. Erste 20 Namen:');
    parsed.slice(0, 20).forEach(function(r) { _bkDbgLine('  Name', r.name + '  [' + r.verein + ']'); });
    if (statusEl) statusEl.textContent = '❌ Keine Vereinsathleten gefunden – Debug-Log prüfen';
    _bkDbgFlush();
    return;
  }

  var ohneZeit = treffer.filter(function(r) { return !r.zeit; });
  ohneZeit.forEach(function(r) { _bkDbgLine('Ohne Wertung', r.name + ' (' + (r.status || 'keine Zeit') + ') – übersprungen'); });

  var d = mfsFindDisz(hint, kat);
  if (hint && !d.disz) _bkDbgLine('Disziplin', 'Kein Treffer für "' + hint + '" in Kategorie ' + (kat || '?'));

  var bulkRows = treffer.filter(function(r) { return r.zeit; }).map(function(r) {
    return { name: r.name, resultat: r.zeit, ak: mfsAk(r.kategorie), platz: r.kPos,
             disziplin: d.disz, diszMid: d.diszMid,
             startnummer: r.startnummer, posGesamt: r.posGesamt };
  });
  _bkDbgLine('Übernommen', bulkRows.length + ' von ' + treffer.length + ' Treffern');
  _bkDbgFlush();

  if (!bulkRows.length) {
    if (statusEl) statusEl.textContent = '⚠ Treffer gefunden, aber ohne Zeit (DNS/DNF/DQ)';
    return;
  }
  bulkFillFromImport(bulkRows, statusEl);
}

// MaxFun-URL eingefuegt: Abruf ist nicht moeglich → Copy-&-Paste erklaeren und
// die nach dem eigenen Verein gefilterte Ergebnisseite direkt anbieten.
function bulkMaxFunHinweis(url) {
  var u = String(url || '').trim();
  var verein = (typeof appConfig !== 'undefined' && appConfig &&
                (appConfig.verein_name || appConfig.verein_kuerzel)) || '';
  var gefiltert = u;
  if (verein) {
    gefiltert = u + (u.indexOf('?') >= 0 ? '&' : '?') +
                'ResultSearch%5BclubTeam%5D=' + encodeURIComponent(verein);
  }
  var esc = function(x) { return String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); };
  var html =
    '<h3 style="margin:0 0 10px">⛰︎ MaxFun Sports</h3>' +
    '<p style="margin:0 0 12px;font-size:13px;line-height:1.55;color:var(--text2)">' +
    'maxfunsports.com kann nicht automatisch abgerufen werden – die Seite ist durch eine ' +
    'Cloudflare-Prüfung geschützt und untersagt Crawler. Die Ergebnisse lassen sich aber ' +
    'in zwei Schritten übernehmen:</p>' +
    '<ol style="margin:0 0 14px;padding-left:20px;font-size:13px;line-height:1.75">' +
    '<li>Ergebnisseite öffnen' + (verein ? ' – der Filter auf <b>' + esc(verein) + '</b> ist bereits gesetzt' : '') + '</li>' +
    '<li>Tabelle mit der Maus markieren (Kopfzeile mitnehmen) und kopieren <span style="opacity:.7">(Strg/Cmd + C)</span></li>' +
    '<li>Hier ins Einlesen-Feld einfügen und auf <b>▶ Einlesen</b> klicken</li>' +
    '</ol>' +
    '<p style="margin:0 0 14px;font-size:12px;color:var(--text2)">' +
    'Die Liste zeigt maximal 50 Zeilen pro Seite. Mit gesetztem Vereinsfilter passt sie ' +
    'in aller Regel auf eine Seite; sonst Seite für Seite einfügen.</p>' +
    '<div style="display:flex;gap:8px;justify-content:flex-end">' +
    '<a class="btn btn-primary btn-sm" target="_blank" rel="noopener" href="' + esc(gefiltert) + '">Ergebnisseite öffnen ↗</a>' +
    '<button class="btn btn-sm" onclick="closeModal()">Schließen</button>' +
    '</div>';
  showModal(html);
}
