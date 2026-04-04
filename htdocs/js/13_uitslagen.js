
// ── AK-Mapping: Niederländische Kategorienamen → DLV-Kürzel ──────
function uitsAKFromCat(catRaw) {
  // catRaw z.B. "MSEN, LANGE CROSS" oder "M45, KORTE CROSS" oder "VU16, VROUWEN U16"
  var first = (catRaw || '').split(',')[0].trim().toUpperCase();
  // Geschlecht: M=Männer, V=Frauen (Niederländisch: Vrouwen)
  if (first === 'MSEN') return 'MHK';
  if (first === 'VSEN') return 'WHK';
  // Senioren mit AK: M40, M45, V35, V45 etc.
  var senM = first.match(/^M(\d{2})$/);
  if (senM) return 'M' + senM[1];
  var senV = first.match(/^V(\d{2})$/);
  if (senV) return 'W' + senV[1];
  // Jugend männlich: MU20, MU18, MU16, MU14, MU12, MU10, MU9, MU8
  var jugM = first.match(/^MU(\d{1,2})$/);
  if (jugM) return 'MU' + jugM[1];
  // Jugend weiblich: VU20, VU18, VU16, VU14, VU12, VU10, VU9, VU8
  var jugV = first.match(/^VU(\d{1,2})$/);
  if (jugV) return 'WU' + jugV[1];
  // Gehandicapt (MVG, VVG) → leer lassen
  if (first.indexOf('VG') >= 0) return '';
  // Gemischt U10 etc. → kein AK
  return '';
}

// ── Geschlecht aus Kategorie ────────────────────────────────────
function uitsGeschlechtFromCat(catRaw) {
  var first = (catRaw || '').split(',')[0].trim().toUpperCase();
  if (first.charAt(0) === 'M') return 'MHK';
  if (first.charAt(0) === 'V') return 'WHK';
  return '';
}

// ── Disziplinname aus Kategorie ─────────────────────────────────
function uitsDiszFromCat(catRaw) {
  // "MSEN, LANGE CROSS" → "Lange Cross"
  // "M45, KORTE CROSS" → "Korte Cross"
  // "VU16, VROUWEN U16" → "" (keine klare Disziplin)
  var rest = (catRaw || '').split(',').slice(1).join(',').trim();
  if (!rest) return '';
  // Bekannte Disziplinen mappen
  var lower = rest.toLowerCase();
  if (lower.includes('lange cross'))   return 'Lange Cross';
  if (lower.includes('korte cross'))   return 'Korte Cross';
  if (lower.includes('cross'))         return 'Cross';
  if (lower.includes('marathon'))      return 'Marathon';
  if (lower.includes('halve marathon') || lower.includes('halbmarathon')) return 'Halbmarathon';
  if (lower.includes('10 km') || lower.includes('10km')) return '10km';
  if (lower.includes('5 km') || lower.includes('5km'))   return '5km';
  // Fallback: Rest-Text
  return rest.replace(/MANNEN|VROUWEN|U\d+\/U\d+|U\d+/gi, '').trim() || '';
}

// ── Verein-Match: prüft ob dieser Eintrag zum eigenen Verein gehört ─
function uitsIstEigenerVerein(vereinText) {
  var vereinCfg = (appConfig.verein_kuerzel || appConfig.verein_name || '').toLowerCase().trim();
  if (!vereinCfg) return false;
  var v = (vereinText || '').toLowerCase();
  // TuS Oedt → auch "Tus Oedt" oder Teilmatches
  var parts = vereinCfg.split(/\s+/);
  return parts.every(function(p) { return p.length < 2 || v.indexOf(p) >= 0; });
}

// ── Kategorie-Auswahl: Button aktivieren ────────────────────────
function uitsKatChanged() {
  var kat = ((document.getElementById('uits-kat') || {}).value || '').trim();
  var btn = document.getElementById('uits-load-btn');
  if (btn) btn.disabled = !kat;
}

// ── Hauptfunktion: URL laden + parsen ───────────────────────────
async function uitsFetch() {
  var urlInput = ((document.getElementById('uits-url') || {}).value || '').trim();
  if (!urlInput) { notify('Bitte uitslagen.nl-URL eingeben.', 'err'); return; }

  // Event-ID aus URL extrahieren
  var idMatch = urlInput.match(/[?&]id=([^&]+)/);
  if (!idMatch) { notify('Keine Event-ID in der URL gefunden (erwartet: ?id=XXXXX).', 'err'); return; }
  var eventId = idMatch[1];

  var preview = document.getElementById('uits-preview');
  preview.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text2)">&#x23F3; Lade Ergebnisse&hellip;</div>';

  // Proxy: PHP-Seite via mika-fetch-Proxy (wir nutzen denselben cURL-Proxy)
  var fetchUrl = 'https://uitslagen.nl/uitslag?id=' + encodeURIComponent(eventId);
  var r = await apiGet('uits-fetch?url=' + encodeURIComponent(fetchUrl));
  if (!r || !r.ok) {
    preview.innerHTML = '<div style="background:var(--surf2);border-radius:10px;padding:16px"><strong>&#x274C; Fehler:</strong> ' + ((r && r.fehler) || 'Seite konnte nicht geladen werden') + '</div>';
    return;
  }

  var html = r.data && r.data.html;
  if (!html) {
    preview.innerHTML = '<div style="background:var(--surf2);border-radius:10px;padding:16px">&#x274C; Keine HTML-Daten vom Server.</div>';
    return;
  }

  // HTML parsen
  var parsed = uitsParseHTML(html, eventId);
  if (!parsed.eventName) {
    preview.innerHTML = '<div style="background:var(--surf2);border-radius:10px;padding:16px">&#x274C; Konnte keine Veranstaltung aus der Seite lesen.</div>';
    return;
  }

  window._uitsState = parsed;
  uitsRenderPreview(parsed);
}

// ── HTML parsen ─────────────────────────────────────────────────
function uitsParseHTML(html, eventId) {
  // DOM-Parser
  var parser = new DOMParser();
  var doc = parser.parseFromString(html, 'text/html');

  // Veranstaltungsinfo
  var titleEl = doc.querySelector('h1, .title, .event-title');
  var eventName = '';
  var eventDate = '';
  var eventOrt  = '';
  // Titel aus <title>-Tag
  var pageTitle = doc.title || '';
  if (pageTitle) {
    eventName = pageTitle.replace('Uitslagenlijst', '').replace('- Uitslagen.nl', '').trim();
    if (eventName.startsWith('-')) eventName = eventName.slice(1).trim();
  }
  // Datum + Ort aus .caption oder h2 (z.B. "Venlo - Zondag 9 november 2025")
  var subtitleEl = doc.querySelector('.uitslag > .caption, h2');
  if (subtitleEl) {
    var subText = subtitleEl.textContent.trim();
    // "Venlo - Zondag 9 november 2025" oder "9 november 2025 - Venlo"
    var dateMatch = subText.match(/(\d{1,2})\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+(\d{4})/i);
    if (dateMatch) {
      var maanden = {januari:1,februari:2,maart:3,april:4,mei:5,juni:6,juli:7,augustus:8,september:9,oktober:10,november:11,december:12};
      var m = maanden[(dateMatch[2]||'').toLowerCase()] || 1;
      eventDate = dateMatch[3] + '-' + String(m).padStart(2,'0') + '-' + dateMatch[1].padStart(2,'0');
      eventOrt = subText.replace(dateMatch[0],'').replace(/[-–,\s]+$/,'').replace(/^[-–,\s]+/,'').replace(/\w+dag/i,'').trim();
    }
  }
  // Zweites .caption als Untertitel (Datum/Ort)
  var captions = Array.from(doc.querySelectorAll('.uitslag > .caption, .uitslagen > .caption'));
  // Erstes caption könnte schon eine Kategorie sein — wir suchen das Datum anders
  if (!eventDate) {
    // In plaintext der Seite suchen
    var bodyText = doc.body ? doc.body.textContent : '';
    var dm = bodyText.match(/(\d{1,2})\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+(\d{4})/i);
    if (dm) {
      var maanden2 = {januari:1,februari:2,maart:3,april:4,mei:5,juni:6,juli:7,augustus:8,september:9,oktober:10,november:11,december:12};
      var m2 = maanden2[(dm[2]||'').toLowerCase()] || 1;
      eventDate = dm[3] + '-' + String(m2).padStart(2,'0') + '-' + dm[1].padStart(2,'0');
    }
  }

  // Alle Ergebnis-Container (je einer pro Kategorie)
  var containers = doc.querySelectorAll('.uitslagen');
  if (!containers.length) {
    return { eventName, eventDate, eventOrt, eventId, kategorien: [], rows: [] };
  }

  var rows = [];
  var currentCat = '';
  var rowNr = 0;

  // Alle Container durchlaufen
  Array.from(containers).forEach(function(container) {
    Array.from(container.children).forEach(function(el) {
    var cls = el.className || '';

    if (cls.includes('caption')) {
      currentCat = el.textContent.trim();
      return;
    }
    if (!cls.includes('tr') || cls.includes('thead')) return;

    // Felder extrahieren
    var platzEl  = el.querySelector('.td.bold');
    var nameEl   = el.querySelector('.naam');
    var vereinEl = el.querySelector('.wpl');
    var zeitEls  = Array.from(el.querySelectorAll('.td.tijd'));
    // Zweites tijd-Element ist die tatsächliche Zeit
    var zeitEl   = zeitEls.find(function(e){ return e.textContent.trim().match(/^\d{1,2}:\d{2}/); });

    if (!nameEl || !zeitEl) return;

    var platz  = platzEl  ? parseInt(platzEl.textContent.trim()) || 0 : 0;
    var name   = nameEl.textContent.trim();
    var verein = vereinEl ? vereinEl.textContent.trim() : '';
    var zeit   = zeitEl.textContent.trim();

    // Gehandicapt überspringen
    var catFirst = currentCat.split(',')[0].toUpperCase().trim();
    if (catFirst.indexOf('VG') >= 0 || catFirst.indexOf('(G)') >= 0) return;

    var ak         = uitsAKFromCat(currentCat);
    var geschlecht = uitsGeschlechtFromCat(currentCat);
    var ownClub    = uitsIstEigenerVerein(verein);

    rows.push({
      nr:        ++rowNr,
      kategorie: currentCat,
      platz:     platz,
      name:      name,
      verein:    verein,
      zeit:      zeit,
      ak:        ak,
      geschlecht: geschlecht,
      ownClub:   ownClub,
    });
    }); // inner forEach (container.children)
  }); // outer forEach (containers)

  return { eventName, eventDate, eventOrt, eventId, rows };
}

// ── Preview rendern ─────────────────────────────────────────────
function uitsRenderPreview(parsed) {
  var _uitsKat = ((document.getElementById('uits-kat') || {}).value || '');
  var preview = document.getElementById('uits-preview');
  var ownRows = parsed.rows.filter(function(r){ return r.ownClub; });
  var allCount = parsed.rows.length;

  if (!ownRows.length) {
    preview.innerHTML =
      '<div style="background:var(--surf2);border-radius:10px;padding:16px">' +
        '<strong>&#x26A0;&#xFE0E; Keine TuS&nbsp;Oedt-Athleten gefunden</strong>' +
        '<div style="font-size:13px;color:var(--text2);margin-top:6px">' +
          allCount + ' Gesamteinträge geladen. Vereinsname: „' + (appConfig.verein_kuerzel || appConfig.verein_name || '?') + '"' +
        '</div>' +
      '</div>';
    return;
  }

  // Athleten-Matching: Namen aus DB
  var athOptHtml = '<option value="">– Athlet wählen –</option>';
  var athleten = state.athleten || [];
  athleten.forEach(function(a) {
    athOptHtml += '<option value="' + a.id + '">' + a.name_nv + '</option>';
  });

  // Disziplinen
  var disziplinen = state.disziplinen || [];
  var diszOptHtml = '<option value="">– Disziplin wählen –</option>';
  disziplinen.forEach(function(d) {
    var label = d.disziplin + (d.kategorie_name ? ' (' + d.kategorie_name + ')' : '');
    diszOptHtml += '<option value="' + d.mapping_id + '">' + label + '</option>';
  });

  // Event-Header
  var headerHtml =
    '<div style="background:var(--surf2);border-radius:10px;padding:16px;margin-bottom:16px">' +
      '<div style="font-weight:700;font-size:15px;margin-bottom:6px">&#x1F3C1; ' + (parsed.eventName || 'Veranstaltung') + '</div>' +
      '<div style="display:flex;gap:16px;flex-wrap:wrap;font-size:13px;color:var(--text2)">' +
        '<span>&#x1F4C5; <input type="date" id="uits-datum" value="' + (parsed.eventDate || '') + '" style="padding:4px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px;background:var(--surface);color:var(--text)"/></span>' +
        '<span>&#x1F4CD; <input type="text" id="uits-ort" value="' + (parsed.eventOrt || '') + '" placeholder="Ort" style="padding:4px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px;background:var(--surface);color:var(--text);width:140px"/></span>' +
        '<span>&#x1F3F7; <input type="text" id="uits-evname" value="' + (parsed.eventName || '') + '" placeholder="Veranstaltungsname" style="padding:4px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px;background:var(--surface);color:var(--text);width:240px"/></span>' +
      '</div>' +
      '<div style="font-size:12px;color:var(--text2);margin-top:8px">' + ownRows.length + ' TuS&nbsp;Oedt-Starter aus ' + allCount + ' Gesamteinträgen</div>' +
    '</div>';

  // Tabelle
  var tableHtml =
    '<div style="overflow-x:auto">' +
    '<table style="width:100%;border-collapse:collapse;font-size:13px">' +
    '<thead><tr style="border-bottom:2px solid var(--border);color:var(--text2)">' +
      '<th style="padding:6px 8px;text-align:left;font-weight:600">&#x2714;</th>' +
      '<th style="padding:6px 8px;text-align:left;font-weight:600">Name</th>' +
      '<th style="padding:6px 8px;text-align:left;font-weight:600">Athlet DB</th>' +
      '<th style="padding:6px 8px;text-align:left;font-weight:600">Kategorie</th>' +
      '<th style="padding:6px 8px;text-align:left;font-weight:600">AK</th>' +
      '<th style="padding:6px 8px;text-align:left;font-weight:600">Disziplin</th>' +
      '<th style="padding:6px 8px;text-align:right;font-weight:600">Platz</th>' +
      '<th style="padding:6px 8px;text-align:right;font-weight:600">Zeit</th>' +
    '</tr></thead><tbody>';

  ownRows.forEach(function(row, i) {
    // Auto-Match: Name in DB suchen (Nachname, Vorname)
    var bestMatch = uitsAutoMatch(row.name, athleten);
    var _uitsKat = ((document.getElementById('uits-kat') || {}).value || '');
    var diszMatch = uitsAutoDiszMatchKat(row.kategorie, disziplinen, _uitsKat);

    tableHtml +=
      '<tr style="border-bottom:1px solid var(--border)">' +
        '<td style="padding:6px 8px"><input type="checkbox" class="uits-chk" data-idx="' + i + '" checked/></td>' +
        '<td style="padding:6px 8px;font-weight:600">' + row.name + '<div style="font-size:11px;color:var(--text2)">' + row.verein + '</div></td>' +
        '<td style="padding:6px 8px"><select class="uits-athlet" data-idx="' + i + '" style="padding:5px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px;background:var(--surface);color:var(--text);min-width:140px">' +
          uitsAthOptHtml(athleten, bestMatch) +
        '</select></td>' +
        '<td style="padding:6px 8px;font-size:12px;color:var(--text2)">' + row.kategorie + '</td>' +
        '<td style="padding:6px 8px"><input type="text" class="uits-ak" data-idx="' + i + '" value="' + (row.ak || '') + '" style="width:60px;padding:4px 6px;border:1px solid var(--border);border-radius:6px;font-size:12px;background:var(--surface);color:var(--text)"/></td>' +
        '<td style="padding:6px 8px"><select class="uits-disz" data-idx="' + i + '" style="padding:5px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px;background:var(--surface);color:var(--text);min-width:160px">' +
          uitsDiszOptHtml(disziplinen, diszMatch, _uitsKat) +
        '</select></td>' +
        '<td style="padding:6px 8px;text-align:right;color:var(--text2)">' + (row.platz || '–') + '</td>' +
        '<td style="padding:6px 8px;text-align:right;font-family:\'Barlow Condensed\',sans-serif;font-weight:700;font-size:15px;color:var(--result-color)">' + row.zeit + '</td>' +
      '</tr>';
  });

  tableHtml += '</tbody></table></div>';

  var importBtn =
    '<div style="margin-top:16px;display:flex;gap:10px;align-items:center">' +
      '<button class="btn btn-primary" onclick="uitsImport()">&#x2705; Ausgewählte importieren</button>' +
      '<div id="uits-status" style="font-size:13px;color:var(--text2)"></div>' +
    '</div>';

  preview.innerHTML = headerHtml + tableHtml + importBtn;
}

// ── Auto-Match Athlet ────────────────────────────────────────────
function _normUmlauts(s) {
  // Umlaute normalisieren: ß/ss, ae/ä, oe/ö, ue/ü und umgekehrt
  return s
    .replace(/ß/g, 'ss').replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
    .replace(/Ä/g, 'ae').replace(/Ö/g, 'oe').replace(/Ü/g, 'ue')
    .replace(/\xe9|\xe8|\xea/g, 'e').replace(/\xe0|\xe2/g, 'a').replace(/\xfc/g, 'ue');
}
var _PREPS = {von:1,van:1,'de':1,der:1,den:1,des:1,ter:1,ten:1,zum:1,zur:1,im:1,am:1,an:1,'in':1,zu:1,the:1,of:1,le:1,la:1,les:1,du:1,di:1,del:1,della:1,und:1,en:1,'do':1,'da':1,dos:1,das:1};
function uitsAutoMatch(name, athleten) {
  if (!name || !athleten.length) return null;

  function _un(s) {
    return (s||'').toLowerCase()
      .replace(/ß/g,'ss').replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue')
      .replace(/Ä/g,'ae').replace(/Ö/g,'oe').replace(/Ü/g,'ue')
      .replace(/[-]/g,' ').trim();
  }
  function _toks(s, noPreps) {
    var t = _un(s).split(/[\s,]+/).filter(function(x){return x.length>=3;});
    return noPreps ? t.filter(function(x){return !_PREPS[x];}) : t;
  }
  function _tokEq(a,b) {
    var an=_un(a), bn=_un(b);
    if (an===bn) return true;
    var sh=an.length<bn.length?an:bn, lo=an.length<bn.length?bn:an;
    return sh.length>=5 && lo.indexOf(sh)===0 && sh.length>=lo.length*0.8;
  }

  for (var i=0; i<athleten.length; i++) {
    var a = athleten[i];
    var cp = (a.name_nv||'').split(',');
    // Surname-Tokens: Praepositionsfilter (von/van/de/der etc. werden ignoriert)
    var surTok   = _toks(cp[0]||'', true);
    var firstTok = _toks((cp.slice(1).join(' '))||'', false);
    if (!surTok.length) continue;
    if (a.aktiv === false || a.aktiv === 0) continue; // Inaktive Athleten nicht matchen

    var inTok = _toks(name, false);
    if (!inTok.length) continue;

    var surOk = surTok.some(function(st){ return inTok.some(function(it){ return _tokEq(it,st); }); });
    if (!surOk) continue;
    if (!firstTok.length) return a.id;
    var firstOk = firstTok.some(function(ft){ return inTok.some(function(it){ return _tokEq(it,ft); }); });
    if (firstOk) return a.id;
  }
  return null;
}
function uitsAthOptHtml(athleten, selectedId) {
  var html = '<option value="">– Athlet wählen –</option>';
  athleten.forEach(function(a) {
    html += '<option value="' + a.id + '"' + (a.id == selectedId ? ' selected' : '') + '>' + a.name_nv + '</option>';
  });
  return html;
}

// ── Auto-Match Disziplin mit Kategorie-Vorauswahl ─────────────────
function uitsAutoDiszMatchKat(catRaw, disziplinen, selectedKat) {
  var diszName = uitsDiszFromCat(catRaw);
  var dl = (diszName || '').toLowerCase();
  // state.disziplinen nutzt 'id' als mapping_id und 'tbl_key' als Kategorie-Key
  var katDisz = selectedKat
    ? disziplinen.filter(function(d){ return d.tbl_key === selectedKat; })
    : disziplinen;
  if (!katDisz.length) return null;
  // Disziplinname-Match innerhalb der Kategorie
  for (var i = 0; i < katDisz.length; i++) {
    var d = katDisz[i];
    var dn = (d.disziplin || '').toLowerCase();
    var mid = d.mapping_id || d.id; // beide Feldnamen abfangen
    if (!dl) return mid; // keine Disziplin ermittelbar → erster Eintrag
    if (dl.indexOf('lange') >= 0 && (dn.indexOf('lang') >= 0 || dn === 'lange cross')) return mid;
    if (dl.indexOf('korte') >= 0 && (dn.indexOf('kort') >= 0 || dn === 'korte cross')) return mid;
    if (dl === 'cross' && dn === 'cross') return mid;
    if (dl.indexOf('marathon') >= 0 && dn.indexOf('marathon') >= 0 && dn.indexOf('halb') < 0) return mid;
    if (dl.indexOf('10km') >= 0 && dn.indexOf('10') >= 0) return mid;
    if (dl.indexOf('5km') >= 0 && (dn === '5km' || dn === '5.000m')) return mid;
  }
  // Fallback: erster Eintrag in Kategorie
  return katDisz[0].mapping_id || katDisz[0].id;
}

function uitsAutoDiszMatch(catRaw, disziplinen) {
  var diszName = uitsDiszFromCat(catRaw);
  if (!diszName) return null;
  var dl = diszName.toLowerCase();
  // Cross-Disziplinen suchen
  for (var i = 0; i < disziplinen.length; i++) {
    var d = disziplinen[i];
    var dn = (d.disziplin || '').toLowerCase();
    var kn = (d.kategorie_name || '').toLowerCase();
    if (kn.indexOf('cross') >= 0 && dn.indexOf('cross') >= 0) {
      // Lange vs Korte Cross unterscheiden
      if (dl.indexOf('lange') >= 0 && (dn.indexOf('lang') >= 0 || dn === 'lange cross')) return d.mapping_id;
      if (dl.indexOf('korte') >= 0 && (dn.indexOf('kort') >= 0 || dn === 'korte cross')) return d.mapping_id;
      if (dl === 'cross' && dn === 'cross') return d.mapping_id;
    }
  }
  // Fallback: erster Cross-Eintrag
  for (var j = 0; j < disziplinen.length; j++) {
    if ((disziplinen[j].kategorie_name || '').toLowerCase().indexOf('cross') >= 0) return disziplinen[j].mapping_id;
  }
  return null;
}

function uitsDiszOptHtml(disziplinen, selectedMid, filterKat) {
  // filterKat: wenn gesetzt, nur Disziplinen dieser Kategorie anzeigen
  var list = filterKat
    ? disziplinen.filter(function(d){ return d.tbl_key === filterKat; })
    : disziplinen;
  var html = '<option value="">– Disziplin wählen –</option>';
  list.forEach(function(d) {
    var mid = d.mapping_id || d.id;
    var label = d.disziplin + (d.kategorie ? ' (' + d.kategorie + ')' : (d.kategorie_name ? ' (' + d.kategorie_name + ')' : ''));
    html += '<option value="' + mid + '"' + (mid == selectedMid ? ' selected' : '') + '>' + label + '</option>';
  });
  return html;
}

// ── Import durchführen ───────────────────────────────────────────
async function uitsImport() {
  var parsed = window._uitsState;
  if (!parsed) { notify('Keine Daten geladen.', 'err'); return; }

  var datum   = ((document.getElementById('uits-datum')   || {}).value || '').trim();
  var ort     = ((document.getElementById('uits-ort')     || {}).value || '').trim();
  var evname  = ((document.getElementById('uits-evname')  || {}).value || '').trim();

  if (!datum) { notify('Bitte Datum eingeben.', 'err'); return; }

  var chks    = document.querySelectorAll('.uits-chk');
  var athSels = document.querySelectorAll('.uits-athlet');
  var akInps  = document.querySelectorAll('.uits-ak');
  var diszSels= document.querySelectorAll('.uits-disz');

  var ownRows = parsed.rows.filter(function(r){ return r.ownClub; });
  var items = [];

  for (var i = 0; i < chks.length; i++) {
    if (!chks[i].checked) continue;
    var idx      = parseInt(chks[i].getAttribute('data-idx'), 10);
    var row      = ownRows[idx];
    var athletId = athSels[i] ? parseInt(athSels[i].value) || null : null;
    var mappingId= diszSels[i] ? parseInt(diszSels[i].value) || null : null;
    var ak       = akInps[i]  ? (akInps[i].value || '').trim() : (row.ak || '');

    if (!athletId || !mappingId) continue;

    // Disziplinname aus mapping_id ermitteln
    var diszObj = (state.disziplinen || []).find(function(d){ return (d.mapping_id||d.id) == mappingId; });
    var disziplin = diszObj ? diszObj.disziplin : '';

    items.push({
      datum:            datum,
      ort:              ort,
      veranstaltung_name: evname,
      athlet_id:        athletId,
      disziplin:        disziplin,
      disziplin_mapping_id: mappingId,
      resultat:         row.zeit,
      altersklasse:     ak,
      ak_platzierung:   row.platz || null,
      meisterschaft:    null,
      import_quelle:    'uitslagen:' + parsed.eventId,
    });
  }

  if (!items.length) {
    notify('Keine gültigen Einträge (Athlet + Disziplin benötigt).', 'err');
    return;
  }

  var status = document.getElementById('uits-status');
  if (status) status.textContent = 'Importiere ' + items.length + ' Einträge\u2026';

  var r = await apiPost('ergebnisse/bulk', { items: items });
  if (r && r.ok) {
    var cnt = r.data && r.data.imported !== undefined ? r.data.imported : items.length;
    notify('\u2705 ' + cnt + ' Ergebnis(se) importiert.', 'ok');
    if (status) status.textContent = '\u2705 ' + cnt + ' importiert.';
  } else {
    var msg = (r && r.fehler) || 'Unbekannter Fehler';
    notify('\u274C Import fehlgeschlagen: ' + msg, 'err');
    if (status) status.textContent = '\u274C ' + msg;
  }
}
// ── leichtathletik.de Import ────────────────────────────────────────────────

async function bulkImportFromLA(url, kat, statusEl) {
  // Event-ID aus URL extrahieren
  var eidM = url.match(/leichtathletik\.de\/Competitions\/(?:Resultoverview|Competitoroverview|Details|CurrentList\/\d+)\/(\d+)/i);
  if (!eidM) { if (statusEl) statusEl.textContent = '\u274c Keine Event-ID in URL'; return; }
  var eventId = eidM[1];
  if (statusEl) statusEl.textContent = '\u23f3 Lade Ergebnis\u00fcbersicht\u2026';

  var vereinParts = (appConfig.verein_kuerzel || appConfig.verein_name || '')
    .toLowerCase().trim().split(/\s+/).filter(function(p) { return p.length > 1; });

  async function _laFetch(pageUrl) {
    var r = await apiGet('la-fetch?url=' + encodeURIComponent(pageUrl));
    if (!r || !r.ok) throw new Error('Fetch fehlgeschlagen: ' + pageUrl);
    return r.data.html;
  }

  function _parse(html) {
    var doc = document.implementation.createHTMLDocument('');
    doc.documentElement.innerHTML = html;
    return doc;
  }

  // 1. Ergebnisübersicht laden
  var overviewUrl = 'https://ergebnisse.leichtathletik.de/Competitions/Resultoverview/' + eventId;
  var overviewHtml;
  try { overviewHtml = await _laFetch(overviewUrl); }
  catch(e) { if (statusEl) statusEl.textContent = '\u274c ' + e.message; return; }

  var ovDoc  = _parse(overviewHtml);
  var ovText = ovDoc.body ? ovDoc.body.textContent : '';

  // Eventname + Datum aus Text
  // Formate: '13. DEZ 2025 NAME - ORT' oder '06. - 08. MRZ 2026 NAME - ORT'
  var eventName = '', eventDate = '', eventOrt = '';
  var _monPat = '(?:Jan|Feb|M\u00e4r|Mrz|Apr|Mai|Jun|Jul|Aug|Sep|Okt|Nov|Dez)';
  var _datPat = new RegExp('(?:\\d{1,2}\\.\\s*-\\s*)?(' + '\\d{1,2}' + '\\.\\s*' + _monPat + '\\w*\\.?\\s*\\d{4})\\s+(.+?)(?:\\n|$)', 'i');
  var metaM = ovText.match(_datPat);
  if (metaM) {
    var datM = metaM[1].match(/(\d{1,2})\.\s*(\w+)\.?\s*(\d{4})/);
    if (datM) {
      var monMap = {jan:1,feb:2,'m\u00e4r':3,mrz:3,apr:4,mai:5,jun:6,jul:7,aug:8,sep:9,okt:10,nov:11,dez:12};
      var mon = monMap[datM[2].toLowerCase().slice(0,3)] || 0;
      if (mon) eventDate = datM[3] + '-' + String(mon).padStart(2,'0') + '-' + datM[1].padStart(2,'0');
    }
    var nameOrt = metaM[2].trim(), dashIdx = nameOrt.lastIndexOf(' - ');
    if (dashIdx > 0) { eventName = nameOrt.slice(0, dashIdx).trim(); eventOrt = nameOrt.slice(dashIdx+3).trim(); }
    else eventName = nameOrt;
  }

  _bkDbgHeader('leichtathletik.de');
  _bkDbgLine('Event-ID',  eventId);
  _bkDbgLine('Eventname', eventName || '\u2013');
  _bkDbgLine('Datum',     eventDate || '\u2013');
  _bkDbgLine('Ort',       eventOrt  || '\u2013');

  var datEl = document.getElementById('bk-datum');
  var ortEl = document.getElementById('bk-ort');
  var evEl  = document.getElementById('bk-evname');
  if (eventDate && datEl) { datEl.value = eventDate; bkSyncDatum(eventDate); }
  if (eventOrt  && ortEl && !ortEl.value) ortEl.value = eventOrt;
  if (eventName && evEl  && !evEl.value)  evEl.value  = eventName;

  // Alle CurrentList-Links
  var _seenHref = {};
  var listLinks = Array.from(ovDoc.querySelectorAll('a[href*="/CurrentList/"]'))
    .map(function(a) { return { href: a.getAttribute('href') || a.href, text: (a.textContent||'').trim() }; })
    .filter(function(l) {
      if (!l.href || !l.text) return false;
      // Relative URLs zu absoluten machen
      if (l.href.startsWith('/')) l.href = 'https://ergebnisse.leichtathletik.de' + l.href;
      if (_seenHref[l.href]) return false;
      _seenHref[l.href] = true;
      return true;
    });

  _bkDbgLine('Disziplinen', listLinks.length);
  _bkDbgSep();

  if (!listLinks.length) { if (statusEl) statusEl.textContent = '\u26a0 Keine Ergebnislisten'; return; }

  var disziplinen = state.disziplinen || [];
  var diszList    = disziplinen.map(function(d){return d.disziplin;}).filter(function(v,i,a){return a.indexOf(v)===i;});
  var allResults  = [], listsChecked = 0;

  for (var li = 0; li < listLinks.length; li++) {
    var ll = listLinks[li];
    if (statusEl) statusEl.textContent = '\u23f3 ' + (li+1) + '/' + listLinks.length + ': ' + ll.text + '\u2026';

    var listHtml;
    try { listHtml = await _laFetch(ll.href); } catch(e) { continue; }
    listsChecked++;

    var listDoc = _parse(listHtml);
    var entries = listDoc.querySelectorAll('.entryline');
    if (!entries.length) continue;

    entries.forEach(function(line) {
      // Verein aus col-2 › secondline
      var col2 = line.querySelector('.col-2');
      var verein = col2 ? ((col2.querySelector('.secondline')||{}).textContent||'').trim() : '';
      var vereinLow = verein.toLowerCase();
      if (!vereinParts.every(function(p){return vereinLow.indexOf(p)>=0;})) return;

      // Name aus col-2 › firstline
      var rName = col2 ? ((col2.querySelector('.firstline')||{}).textContent||'').trim() : '';

      // Ergebnis aus erstem col-4
      var col4s = line.querySelectorAll('.col-4');
      var rZeit = col4s.length > 0 ? ((col4s[0].querySelector('.firstline')||{}).textContent||'').trim() : '';
      rZeit = fmtRes(rZeit); // Komma als Dezimaltrennzeichen für Anzeige

      // AK aus letztem col-4
      var rAK = '';
      if (col4s.length > 1) {
        var lastFL = (col4s[col4s.length-1].querySelector('.firstline')||{}).textContent||'';
        rAK = normalizeAK(lastFL.trim());
      }
      // Jahrgang und Geschlecht aus Ergebniszeile
      var col3la = line.querySelector('.col-3');
      var slJG = col3la ? col3la.querySelector('.secondline') : null;
      var rYear = slJG ? parseInt(slJG.textContent.trim()) || 0 : 0;
      var rGschl = /frauen|weiblich|WJU|weibl/i.test(ll.text) ? 'W' :
                   /männl|male|herren|männer/i.test(ll.text) ? 'M' : '';
      if (!rGschl && rAK) rGschl = /^[WwFf]/.test(rAK) ? 'W' : /^M/.test(rAK) ? 'M' : '';
      // Fallback: Jahrgang → AK berechnen
      if (!rAK && rYear > 1900) {
        var evYr = parseInt((eventDate||'').slice(0,4)) || new Date().getFullYear();
        rAK = calcDlvAK(rYear, rGschl || 'M', evYr) || '';
      }

      // AK-Platz: verschiedene Layouts auf leichtathletik.de
      // Im AK-Block (Männer/Frauen/MHK...): col-1 = AK-Platz → direkt nutzen
      // Außerhalb (Gesamtergebnis): col-6 = '1./III' (Masters Laufnr) bevorzugen
      var rPlatz = 0;
      // _isAkBlock wird unten gesetzt — wir berechnen es hier voraus
      var _blockForPlatz = line.closest('.runblock');
      var _blockNameForPlatz = _blockForPlatz ? ((_blockForPlatz.querySelector('.blockname')||{}).textContent||'').trim() : '';
      var _inAkBlock = /^(M\u00e4nner|Frauen|MHK|WHK|[MW]\d{2}|[MW]U\d{1,2}|Weiblich|M\u00e4nnlich|Senioren|Senior|Jugend)/i.test(_blockNameForPlatz);
      // Priorität: im AK-Block col-1; sonst col-6 (Masters '1./III'), col-5, col-1
      var _platzCols = _inAkBlock ? [1] : [6, 5, 1];
      for (var _pci = 0; _pci < _platzCols.length; _pci++) {
        var _pc = line.querySelector('.col-' + _platzCols[_pci]);
        var _pfl = _pc ? _pc.querySelector('.firstline') : null;
        var _ptxt = _pfl ? (_pfl.textContent||'').trim() : '';
        if (_ptxt && /^\d+\.?/.test(_ptxt)) {
          var _pval = parseInt(_ptxt);
          if (_pval > 0) { rPlatz = _pval; break; }
        }
      }

      if (!rName || !rZeit || !/\d/.test(rZeit)) return;

      // Block-Name aus übergeordnetem runblock → AK-Block erkennen
      var _block = line.closest('.runblock');
      var _blockName = _block ? ((_block.querySelector('.blockname')||{}).textContent||'').trim() : '';
      // AK-Block: Männer, Frauen, MHK, WHK, M30-M85, W30-W85, MU*/WU*
      var _isAkBlock = /^(M\u00e4nner|Frauen|MHK|WHK|[MW]\d{2}|[MW]U\d{1,2}|Weiblich|M\u00e4nnlich|Senioren|Senior|Jugend)/i.test(_blockName);


      var disz    = rrBestDisz(ll.text, diszList);
      // Exakten kat-Treffer bevorzugen, dann Gruppen-Fallback
      var diszObj = (kat ? disziplinen.find(function(d){return d.disziplin===disz&&d.tbl_key===kat;}) : null)
                 || disziplinen.find(function(d){return d.disziplin===disz&&(!kat||(bkKatMitGruppen(kat)||[]).indexOf(d.tbl_key)>=0);});

      var _dup = allResults.find(function(r){return r.name===rName&&r.resultat===rZeit;});
      if (_dup) {
        // AK-Block-Platz hat Priorität über Gesamtergebnis-Platz
        if (_isAkBlock && rPlatz > 0) { _dup.platz = rPlatz; _dup._isAkBlock = true; }
        else if (!_dup._isAkBlock && rPlatz > 0 && _dup.platz === 0) _dup.platz = rPlatz;
        if (rAK && !_dup.ak) _dup.ak = rAK;
      } else {
        allResults.push({name:rName, resultat:rZeit, ak:rAK, platz:rPlatz,
          disziplin:diszObj?diszObj.disziplin:disz,
          diszMid:diszObj?(diszObj.id||diszObj.mapping_id):null,
          year:rYear||'', geschlecht:rGschl||'',
          _isAkBlock: _isAkBlock});
      }
    });
  }

  _bkDbgLine('Listen geladen', listsChecked);
  _bkDbgLine('Gefunden', allResults.length + ' TuS-Eintr\u00e4ge');

  if (allResults.length) {
    _bkDbgSep();
    _bkDbgHeader('Ergebnisse');
    for (var _di = 0; _di < allResults.length; _di++) {
      var _dr = allResults[_di];
      _bkDbgLines.push(String(_di+1).padStart(2,' ')+'.  '+(_dr.name||'?').padEnd(22,' ')+(_dr.ak||'  ').padEnd(6,' ')+(_dr.resultat||'').padEnd(10,' ')+(_dr.platz?'Platz\u00a0'+_dr.platz:'').padEnd(9,' ')+'\u2192 '+(_dr.disziplin||'(keine)'));
    }
    _bkDbgFlush();
  }

  await bulkFillFromImport(allResults, statusEl);
}
