function _mkDelBtn(id) {
  return '<button class="btn btn-danger btn-sm" onclick="deleteAthletById(' + id + ')" title="Löschen">&#x2715;</button>';
}

function deleteAthletById(id) {
  var cached = _athLetenCache.alleAthleten || [];
  var name = '';
  for (var i = 0; i < cached.length; i++) { if (cached[i].id == id) { name = cached[i].name_nv || ''; break; } }
  deleteAthlet(id, name);
}

function _normN(s) {
  return s.toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
    .replace(/[,.\-]/g, ' ').replace(/\s+/g, ' ').trim();
}

async function showGeburtjahrImportModal() {
  // Athleten vorladen damit Vorschau und Import funktionieren
  if (!state._athletenMap || Object.keys(state._athletenMap).length === 0) {
    var rA = await apiGet('athleten');
    if (rA && rA.ok) {
      state._athletenMap = {};
      for (var ai = 0; ai < rA.data.length; ai++) {
        state._athletenMap[rA.data[ai].id] = rA.data[ai];
      }
    }
  }
  showModal(
    '<h2>&#x1F4C5; Geburtsjahr-Import <button class="modal-close" onclick="closeModal()">&#x2715;</button></h2>' +
    '<p style="font-size:13px;color:var(--text2);margin-bottom:8px">CSV mit Semikolon, erste Zeile = Header. Spalten: <code>Athlet NV;Geburtsdatum</code><br>' +
    'Geburtsdatum als Excel-Seriennummer (z.B. <code>40179</code>) oder TT.MM.JJJJ oder JJJJ-MM-TT.</p>' +
    '<textarea id="gj-csv" style="width:100%;height:220px;font-family:monospace;font-size:12px;box-sizing:border-box;padding:8px;background:var(--surface);color:var(--text);border:1px solid var(--border);border-radius:var(--radius)" placeholder="Athlet NV;Geburtsdatum\nMustermann, Erika;40179\nMuster, Max;1988-05-12"></textarea>' +
    '<div id="gj-preview" style="margin-top:10px;font-size:12px;max-height:180px;overflow-y:auto"></div>' +
    '<div class="modal-actions">' +
      '<button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button>' +
      '<button class="btn btn-primary" id="gj-import-btn">&#x1F4BE; Importieren</button>' +
    '</div>'
  );
  document.getElementById('gj-csv').addEventListener('input', _gjPreview);
  document.getElementById('gj-import-btn').addEventListener('click', doGeburtjahrImport);
}

function _excelDateToYear(val) {
  var s = String(val).trim();
  // Reine Zahl → Excel-Seriennummer
  if (/^\d{4,6}$/.test(s)) {
    var n = parseInt(s);
    // Excel-Epoch: 30.12.1899
    var d = new Date(Date.UTC(1899, 11, 30) + n * 86400000);
    return d.getUTCFullYear();
  }
  // TT.MM.JJJJ
  var m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) return parseInt(m[3]);
  // JJJJ-MM-TT oder JJJJ/MM/TT
  var m2 = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
  if (m2) return parseInt(m2[1]);
  // Nur Jahreszahl
  if (/^\d{4}$/.test(s)) return parseInt(s);
  return null;
}

function _gjParseCSV(raw) {
  var lines = raw.trim().split(/\r?\n/);
  var rows = [];
  var start = 0;
  // Header überspringen wenn erste Zeile kein Datum enthält
  if (lines.length > 0 && /athlet|name|geburt/i.test(lines[0])) start = 1;
  for (var i = start; i < lines.length; i++) {
    var parts = lines[i].split(';');
    if (parts.length < 2) continue;
    var nv = parts[0].trim();
    var rawDate = parts[1].trim();
    if (!nv || !rawDate) continue;
    var jahr = _excelDateToYear(rawDate);
    rows.push({ nv: nv, rawDate: rawDate, jahr: jahr });
  }
  return rows;
}

function _gjPreview() {
  var raw = document.getElementById('gj-csv').value;
  var rows = _gjParseCSV(raw);
  if (!rows.length) { document.getElementById('gj-preview').innerHTML = ''; return; }
  var html = '<table style="width:100%;border-collapse:collapse;font-size:12px">' +
    '<thead><tr style="border-bottom:1px solid var(--border)"><th style="text-align:left;padding:2px 6px">Athlet NV</th><th style="padding:2px 6px">Roh</th><th style="padding:2px 6px">Jahrgang</th><th style="padding:2px 6px">Match</th></tr></thead><tbody>';
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    // Besten Athleten-Match finden
    var match = _gjFindAthlet(r.nv);
    var matchCell = match
      ? '<span style="color:var(--green)">\u2713 ' + match.name_nv + '</span>'
      : '<span style="color:var(--accent)">? nicht gefunden</span>';
    var jahrCell = r.jahr
      ? '<strong>' + r.jahr + '</strong>'
      : '<span style="color:var(--accent)">?</span>';
    html += '<tr style="border-bottom:1px solid var(--border)"><td style="padding:2px 6px">' + r.nv + '</td><td style="padding:2px 6px;color:var(--text2)">' + r.rawDate + '</td><td style="text-align:center;padding:2px 6px">' + jahrCell + '</td><td style="padding:2px 6px">' + matchCell + '</td></tr>';
  }
  html += '</tbody></table>';
  document.getElementById('gj-preview').innerHTML = html;
}

function _gjFindAthlet(nv) {
  if (!state._athletenMap) return null;
  var norm = _normN(nv);
  var best = null;
  var ids = Object.keys(state._athletenMap);
  for (var i = 0; i < ids.length; i++) {
    var a = state._athletenMap[ids[i]];
    if (_normN(a.name_nv || '') === norm) return a;
    // Teilmatch als Fallback
    if (!best && _normN(a.name_nv || '').indexOf(norm) >= 0) best = a;
  }
  return best;
}

async function doGeburtjahrImport() {
  var raw = document.getElementById('gj-csv').value;
  var rows = _gjParseCSV(raw);
  if (!rows.length) { notify('Keine Daten gefunden.', 'err'); return; }
  // Athleten laden falls _athletenMap noch nicht befüllt
  if (!state._athletenMap || Object.keys(state._athletenMap).length === 0) {
    var rA = await apiGet('athleten');
    if (rA && rA.ok) {
      state._athletenMap = {};
      for (var ai = 0; ai < rA.data.length; ai++) {
        state._athletenMap[rA.data[ai].id] = rA.data[ai];
      }
    }
  }
  var ok = 0, skip = 0, err = 0;
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (!r.jahr) { skip++; continue; }
    var ath = _gjFindAthlet(r.nv);
    if (!ath) { skip++; continue; }
    var res = await apiPut('athleten/' + ath.id, { geburtsjahr: r.jahr });
    if (res && res.ok) ok++; else err++;
  }
  var msg = ok + ' aktualisiert';
  if (skip) msg += ', ' + skip + ' übersprungen';
  if (err)  msg += ', ' + err + ' Fehler';
  notify(msg, err ? 'err' : 'ok');
  if (ok > 0) { closeModal(); await loadAthleten(); await renderAthleten(); }
}


var _athLetenCache = { alleAthleten: [], alleGruppen: [] };
var _athSort = { col: 'name', dir: 1 }; // col: 'name'|'vorname'|'geschlecht'|'jahrgang'|'ak'|'ergebnisse'|'aktiv'|'letzte', dir: 1|-1

function _athSortHeader() {
  var showD = _canSeeAthletenDetails();
  var showE = _canEditAthleten() || (currentUser && currentUser.rolle === 'admin');
  var cols = [
    { key: 'name', label: 'Name' },
    { key: 'vorname', label: 'Vorname' },
  ];
  if (showD) cols.push({ key: 'geschlecht', label: '♂♀' });
  cols.push({ key: 'jahrgang', label: 'Jahrgang' }, { key: 'ak', label: 'AK' }, { key: 'gruppen', label: 'Gruppen' });
  if (showD) { cols.push({ key: 'ergebnisse', label: 'Erg.' }, { key: 'letzte', label: 'Letzte Akt.' }, { key: 'aktiv', label: 'Status' }); }
  if (showE) cols.push({ key: '', label: '' });
  return cols.map(function(c) {
    if (!c.key) return '<th></th>';
    var arrow = _athSort.col === c.key ? (_athSort.dir === 1 ? ' ▲' : ' ▼') : '';
    var style = 'cursor:pointer;user-select:none;white-space:nowrap' + (_athSort.col === c.key ? ';color:var(--primary)' : '');
    return '<th style="' + style + '" onclick="_athSetSort(\'' + c.key + '\')">' + c.label + arrow + '</th>';
  }).join('');
}

function _athSetSort(col) {
  if (_athSort.col === col) _athSort.dir *= -1;
  else { _athSort.col = col; _athSort.dir = 1; }
  // thead aktualisieren (Pfeile)
  var thead = document.querySelector('#athlet-tabelle thead tr');
  if (thead) thead.innerHTML = _athSortHeader();
  _renderAthletenTable();
}

function _athSortRows(athleten, jetzt) {
  var col = _athSort.col, dir = _athSort.dir;
  return athleten.slice().sort(function(a, b) {
    var va, vb;
    if (col === 'name')       { va = (a.nachname||'').toLowerCase(); vb = (b.nachname||'').toLowerCase(); }
    else if (col === 'vorname')    { va = (a.vorname||'').toLowerCase(); vb = (b.vorname||'').toLowerCase(); }
    else if (col === 'geschlecht') { va = a.geschlecht||''; vb = b.geschlecht||''; }
    else if (col === 'jahrgang')   { va = a.geburtsjahr||0; vb = b.geburtsjahr||0; }
    else if (col === 'ak')         { va = (a.geschlecht&&a.geburtsjahr)?calcDlvAK(a.geburtsjahr,a.geschlecht,jetzt):''; vb = (b.geschlecht&&b.geburtsjahr)?calcDlvAK(b.geburtsjahr,b.geschlecht,jetzt):''; }
    else if (col === 'ergebnisse') { va = parseInt(a.anz_ergebnisse)||0; vb = parseInt(b.anz_ergebnisse)||0; }
    else if (col === 'letzte')     { va = parseInt(a.letzte_aktivitaet)||0; vb = parseInt(b.letzte_aktivitaet)||0; }
    else if (col === 'aktiv')      { va = a.aktiv?1:0; vb = b.aktiv?1:0; }
    else                           { va = (a.name_nv||'').toLowerCase(); vb = (b.name_nv||'').toLowerCase(); }
    if (va < vb) return -dir;
    if (va > vb) return dir;
    return 0;
  });
}


function _renderAthletenTable() {
  var aktGruppe = state.filters.gruppe || '';
  var alleAthleten = _athLetenCache.alleAthleten || [];
  var showDetails = _canSeeAthletenDetails();
  var canEdit    = _canEditAthleten();
  var isAdmin    = currentUser && currentUser.rolle === 'admin';
  var jetzt = new Date().getFullYear();

  // Inaktive Athleten nur mit spezifischem Recht sichtbar
  var canSeeInaktive = _canSeeInaktiveAthleten();
  var athleten = alleAthleten.filter(function(a) {
    if (!canSeeInaktive && !a.aktiv) return false;
    return true;
  });
  if (aktGruppe) {
    athleten = athleten.filter(function(a) {
      var gs = a.gruppen || [];
      for (var gi = 0; gi < gs.length; gi++) { if (gs[gi].name === aktGruppe) return true; }
      return false;
    });
  }
  state._athletenMap = {};
  for (var i = 0; i < athleten.length; i++) state._athletenMap[athleten[i].id] = athleten[i];
  var sorted = _athSortRows(athleten, jetzt);
  _athLetenCache._lastSorted = sorted;
  var rows = '';
  for (var i = 0; i < sorted.length; i++) {
    var a = sorted[i];
    var canDel = isAdmin && parseInt(a.anz_ergebnisse) === 0;
    var aktuellAK = (a.geschlecht && a.geburtsjahr) ? calcDlvAK(a.geburtsjahr, a.geschlecht, jetzt) : '';
    var gSymbol = a.geschlecht === 'M' ? '<span title="Männlich" style="font-size:15px">♂</span>'
                : a.geschlecht === 'W' ? '<span title="Weiblich" style="font-size:15px">♀</span>'
                : a.geschlecht === 'D' ? '<span title="Divers" style="font-size:15px">⚧</span>' : '';
    rows +=
      '<tr>' +
        '<td><span class="athlet-link" onclick="openAthletById(' + a.id + ')">' + a.nachname + '</span></td>' +
        '<td>' + (a.vorname || '') + '</td>' +
        (showDetails ? '<td style="text-align:center">' + gSymbol + '</td>' : '') +
        '<td style="color:var(--text2);font-size:13px">' + (a.geburtsjahr || '') + '</td>' +
        '<td>' + (aktuellAK ? akBadge(aktuellAK) : '') + '</td>' +
        '<td>' + renderGruppenInline(a.gruppen) + '</td>' +
        (showDetails ? '<td><span class="badge badge-platz">' + a.anz_ergebnisse + '</span></td>' : '') +
        (showDetails ? '<td style="color:var(--text2);font-size:13px;text-align:center">' + (a.letzte_aktivitaet || '–') + '</td>' : '') +
        (showDetails ? '<td>' + (a.aktiv ? '<span class="badge badge-aktiv">Aktiv</span>' : '<span class="badge badge-inaktiv">Inaktiv</span>') + '</td>' : '') +
        (canEdit || isAdmin ? '<td style="white-space:nowrap">' +
          (canEdit ? '<button class="btn btn-ghost btn-sm" onclick="showAthletEditModal(' + a.id + ')">&#x270F;&#xFE0E;</button>' : '') +
          (isAdmin && a.aktiv ? '<button class="btn btn-ghost btn-sm" title="Deaktivieren" style="color:var(--text2)" onclick="toggleAthletAktiv(' + a.id + ',0)">&#x23FC;&#xFE0E;</button>' : '') +
          (isAdmin && !a.aktiv ? '<button class="btn btn-ghost btn-sm" title="Aktivieren" style="color:var(--green)" onclick="toggleAthletAktiv(' + a.id + ',1)">&#x23FB;&#xFE0E;</button>' : '') +
          (canDel ? _mkDelBtn(a.id) : '') +
        '</td>' : '') +
      '</tr>';
  }
  var tbody = document.querySelector('#athlet-tabelle tbody');
  var count = document.getElementById('athlet-count');
  if (tbody) tbody.innerHTML = rows;
  if (count) count.textContent = athleten.length + ' Athleten';
}

async function renderAthleten() {
  var s = state.filters.suche || '';
  var aktGruppe = state.filters.gruppe || '';
  var rA = await apiGet(s ? 'athleten?suche=' + encodeURIComponent(s) : 'athleten');
  var rG = await apiGet('gruppen');
  if (!rA || !rA.ok) return;
  var alleAthleten = rA.data;
  var alleGruppen = (rG && rG.ok) ? rG.data : [];
  var canEdit = _canEditAthleten();
  // Cache befüllen für _renderAthletenTable
  _athLetenCache.alleAthleten = alleAthleten;
  _athLetenCache.alleGruppen = alleGruppen;

  // Gruppen-Buttons
  var gruppenBtns = '<button class="rek-cat-btn' + (!aktGruppe ? ' active' : '') + '" onclick="state.filters.gruppe=\'\';renderAthleten()">Alle</button>';
  for (var gi = 0; gi < alleGruppen.length; gi++) {
    var g = alleGruppen[gi];
    gruppenBtns += '<button class="rek-cat-btn' + (aktGruppe === g.name ? ' active' : '') + '" onclick="state.filters.gruppe=\'' + g.name.replace(/'/g,"\\'") + '\';renderAthleten()">' + g.name + ' <span style="font-size:10px;opacity:.7">(' + g.anz_athleten + ')</span></button>';
  }

  document.getElementById('main-content').innerHTML =
    '<div class="rek-cat-tabs" style="margin-bottom:16px">' + gruppenBtns + '</div>' +
    '<div class="filter-bar">' +
      '<div class="fg"><label>Suche</label><input type="text" id="athlet-suche" placeholder="Name suchen&hellip;" value="' + s + '" oninput="setAthletSuche(this.value)" style="min-width:0;width:100%"/></div>' +
      (canEdit ? '<button class="btn btn-primary btn-sm" onclick="showNeuerAthletModal()">+ Neuer Athlet</button>' : '') +
      (canEdit ? '<button class="btn btn-ghost btn-sm" onclick="showGeburtjahrImportModal()" title="Geburtsjahr-Bulk-Import">&#x1F4C5; Geburtsjahr importieren</button>' : '') +
    '</div>' +
    '<div class="panel">' +
      '<div class="panel-header"><div class="panel-title">&#x1F464; ' + (aktGruppe || 'Alle Athleten') + '</div><div class="panel-count" id="athlet-count"></div></div>' +
      '<div class="table-scroll"><table id="athlet-tabelle">' +
        '<thead><tr>' + _athSortHeader() + '</tr></thead>' +
        '<tbody></tbody>' +
      '</table></div>' +
    '</div>';
  _renderAthletenTable();
  // letzte_aktivitaet asynchron nachladen (separater Query, hält Hauptliste nicht auf)
  _loadLetzteAktivitaet();
}

async function _loadLetzteAktivitaet() {
  var r = await apiGet('athleten-aktivitaet');
  if (!r || !r.ok) return;
  var map = r.data; // { athlet_id: jahr } — Keys kommen als Strings aus JSON
  // Cache aktualisieren (String-Key-Lookup mit explizitem Cast)
  var arr = _athLetenCache.alleAthleten || [];
  for (var i = 0; i < arr.length; i++) {
    var val = map[String(arr[i].id)];
    if (val !== undefined) arr[i].letzte_aktivitaet = val;
  }
  // DOM aktualisieren: jede tr per data-athlet-id zuordnen statt per Index
  var tbody = document.querySelector('#athlet-tabelle tbody');
  if (!tbody) return;
  var trs = tbody.querySelectorAll('tr');
  for (var i = 0; i < trs.length; i++) {
    // athlet-id aus dem Link im ersten td lesen
    var link = trs[i].querySelector('.athlet-link[onclick]');
    if (!link) continue;
    var m = (link.getAttribute('onclick') || '').match(/openAthletById\((\d+)\)/);
    if (!m) continue;
    var aid = m[1]; // String
    var val = map[aid];
    var td = trs[i].querySelectorAll('td')[7];
    if (td) td.textContent = val || '–';
  }
}

// Athletenprofil State
var _apState = { kategorien: [], pbs: [], selKat: 0, selDisz: null, tab: 'ergebnisse', athletId: null };

function _apFmtRes(e, fallbackFmt) {
  var f = e.fmt || fallbackFmt || 'min';
  if (f === 'm') return fmtMeter(e.resultat);
  var isTStr = e.resultat && e.resultat.indexOf(':') >= 0;
  return fmtTime(e.resultat, (f === 's' && !isTStr) ? 's' : undefined);
}

function _apDiszSortKey(name) {
  // Benannte Distanzen
  var s = (name || '').toLowerCase().trim();
  var named = {
    'marathon': 42195, 'halbmarathon': 21098, 'halbmarathon straße': 21098,
    'marathon straße': 42195, 'ultramarathon': 80000,
    'dreisprung': -4, 'weitsprung': -3, 'hochsprung': -2, 'stabhochsprung': -1,
    'kugelstoß': -10, 'hammerwurf': -11, 'diskuswurf': -12, 'speerwurf': -13,
    'gewichtwurf': -14, 'ballwurf 200g': -15, 'schlagballwurf 80g': -16,
    'walking': 99000, '7km walking': 7000
  };
  for (var k in named) { if (s === k || s.indexOf(k) === 0) return named[k]; }
  // Zentrale Sortierfunktion (kennt Tausenderpunkte)
  return diszSortKey(name);
}

function _apBestOf(ergs, fmt) {
  var dir = (fmt === 'm') ? 'DESC' : 'ASC';
  // Zeitstring HH:MM:SS oder M:SS in Sekunden umrechnen für zuverlässigen Vergleich
  function toSec(s) {
    if (!s) return Infinity;
    var p = String(s).split(':');
    if (p.length === 3) return parseInt(p[0])*3600 + parseInt(p[1])*60 + parseFloat(p[2]);
    if (p.length === 2) return parseInt(p[0])*60 + parseFloat(p[1]);
    return parseFloat(s);
  }
  var best = null;
  for (var i = 0; i < ergs.length; i++) {
    var e = ergs[i];
    var v = (fmt === 'm') ? parseFloat(e.resultat) : toSec(e.resultat);
    if (best === null) { best = e; continue; }
    var bv = (fmt === 'm') ? parseFloat(best.resultat) : toSec(best.resultat);
    if (dir === 'ASC' ? v < bv : v > bv) best = e;
  }
  return best;
}

function _apRender() {
  var kat = _apState.kategorien[_apState.selKat] || {};
  var ergs = kat.ergebnisse || [];
  var fmt = kat.fmt || 'min';

  // Disziplinen ermitteln (sortiert, mit PB)
  var diszMap = {};
  for (var i = 0; i < ergs.length; i++) {
    var _ek = ergDiszKey(ergs[i]);
    if (!diszMap[_ek]) diszMap[_ek] = [];
    diszMap[_ek].push(ergs[i]);
  }
  // Externe PBs: gleicher Key wie internal (m+mapping_id), sonst Name
  var _extKeyMap = {}; // key -> repr. pb (for label when no internal ergs)
  (kat.pbs || []).forEach(function(p) {
    var key = p.disziplin_mapping_id ? 'm' + p.disziplin_mapping_id : 'd_' + (p.disziplin_mapped || p.disziplin);
    if (!diszMap[key]) diszMap[key] = [];
    if (!_extKeyMap[key]) _extKeyMap[key] = p;
  });
  var diszList = Object.keys(diszMap).sort(function(a, b) {
    var ea = diszMap[a][0] || _extKeyMap[a], eb = diszMap[b][0] || _extKeyMap[b];
    var ka = _apDiszSortKey(ea ? (ea.disziplin_mapped || ea.disziplin) : a);
    var kb = _apDiszSortKey(eb ? (eb.disziplin_mapped || eb.disziplin) : b);
    return ka !== kb ? ka - kb : (ea ? (ea.disziplin_mapped||ea.disziplin) : a).localeCompare(eb ? (eb.disziplin_mapped||eb.disziplin) : b);
  });
  if (!_apState.selDisz || diszMap[_apState.selDisz] === undefined) {
    _apState.selDisz = diszList[0] || null;
  }

  // Kategorie-Tabs
  var katTabs = '';
  for (var ki = 0; ki < _apState.kategorien.length; ki++) {
    var k = _apState.kategorien[ki];
    var isActive = ki === _apState.selKat;
    var ergCount = (k.ergebnisse||[]).length + (k.pbs||[]).length;
    katTabs += '<button class="rek-cat-btn' + (isActive ? ' active' : '') + '" ' +
      'style="font-size:13px;padding:7px 16px;margin:0 6px 6px 0" ' +
      'data-ap-kat="' + ki + '">' + k.name + ' <span style="opacity:.7">(' + ergCount + ')</span></button>';
  }

  // Disziplin-Buttons mit PB
  var diszBtns = '';
  for (var di = 0; di < diszList.length; di++) {
    var disz = diszList[di];
    var dErgs = diszMap[disz];
    var _repr = dErgs[0] || _extKeyMap[disz];
    var diszLabel = _repr ? (dErgs[0] ? ergDiszLabel(dErgs[0]) : (_repr.disziplin_mapped || _repr.disziplin)) : disz;
    // PB aus internen UND externen Ergebnissen
    var _allForPb = dErgs.concat((kat.pbs || []).filter(function(p) {
      var pKey = p.disziplin_mapping_id ? 'm' + p.disziplin_mapping_id : 'd_' + (p.disziplin_mapped || p.disziplin);
      return pKey === disz;
    }));
    var pb = _apBestOf(_allForPb, fmt);
    var pbStr = pb ? _apFmtRes(pb, fmt) : '';
    var isActive2 = disz === _apState.selDisz;
    diszBtns += '<button class="rek-top-btn' + (isActive2 ? ' active' : '') + '" ' +
      'style="min-width:80px;padding:8px 14px;margin:0 6px 6px 0" ' +
      'data-ap-disz="' + disz.replace(/"/g,'&quot;') + '">' +
      '<span class="rek-top-name">' + diszLabel + '</span>' +
      (pbStr ? '<span class="rek-top-cnt" style="font-family:Barlow Condensed,sans-serif;font-size:13px;font-weight:700;margin-top:2px">' + pbStr + '</span>' : '') +
    '</button>';
  }

  // Ergebnisse der gewählten Disziplin (intern)
  var filteredErgs = _apState.selDisz ? (diszMap[_apState.selDisz] || []) : [];
  var showPace = (fmt !== 'm' && fmt !== 's');
  // Externe PBs: aus kat.pbs, gefiltert nach mapping_id oder Disziplinname
  var selMappingId = filteredErgs.length ? (filteredErgs[0].disziplin_mapping_id || null) : null;
  var selDiszName = _apState.selDisz ? _apState.selDisz.replace(/ .*/, '') : '';
  // Match per mapping_id (selDisz = 'm123') oder per name
  var extPbs = (kat.pbs || []).filter(function(p) {
    var pKey = p.disziplin_mapping_id ? 'm' + p.disziplin_mapping_id : 'd_' + (p.disziplin_mapped || p.disziplin);
    return pKey === _apState.selDisz;
  });
  var hasExt = extPbs.length > 0;
  var clubName = (appConfig && appConfig.verein_name) ? appConfig.verein_name : 'TuS Oedt';
  var canEdit = currentUser && (currentUser.rolle === 'admin' || currentUser.rolle === 'editor' || currentUser.rolle === 'athlet');

  // Interne + externe Ergebnisse zusammenführen und nach Datum sortieren (neueste zuerst)
  var _allRows = filteredErgs.map(function(e) { return { _type: 'int', d: e }; })
    .concat(extPbs.map(function(p) { return { _type: 'ext', d: p }; }));
  _allRows.sort(function(a, b) {
    var da = a.d.datum || ''; var db = b.d.datum || '';
    return da < db ? 1 : da > db ? -1 : 0;
  });
  var rows = '';
  for (var _ri = 0; _ri < _allRows.length; _ri++) {
    if (_allRows[_ri]._type === 'int') {
      var e = _allRows[_ri].d;
      var resStr = _apFmtRes(e, fmt);
      var paceStr = (showPace && diszKm(e.disziplin) >= 1) ? fmtTime(calcPace(e.disziplin, e.resultat), 'min/km') : '';
      var ort = fmtVeranstName(e);
      rows += '<tr>' +
        '<td style="padding:4px 6px">' + formatDate(e.datum) + '</td>' +
        '<td style="padding:4px 6px">' + (e.altersklasse || '&ndash;') + '</td>' +
        '<td style="padding:4px 6px" class="result">' + resStr + '</td>' +
        (showPace ? '<td style="padding:4px 6px" class="ort-text">' + paceStr + '</td>' : '') +
        '<td style="padding:4px 6px;color:var(--text2);font-size:12px">' + ort + '</td>' +
        (hasExt ? '<td style="padding:4px 6px;font-size:11px;color:var(--text2)">' + clubName + '</td>' : '') +
      '</tr>';
    } else {
      var p = _allRows[_ri].d;
    var editBtns = canEdit
      ? '<span style="margin-left:6px;white-space:nowrap">' +
          '<button class="btn btn-ghost btn-sm" style="padding:1px 5px;font-size:10px" data-pb-edit="' + p.id + '">✏️</button> ' +
          '<button class="btn btn-danger btn-sm" style="padding:1px 5px;font-size:10px" data-pb-del="' + p.id + '" data-pb-disz="' + (p.disziplin||'').replace(/"/g,'&quot;') + '">✕</button>' +
        '</span>'
      : '';
    rows += '<tr style="color:var(--text)">' +
      '<td style="padding:4px 6px;color:var(--text2)">' + (p.datum ? formatDate(p.datum) : '&ndash;') + '</td>' +
      '<td style="padding:4px 6px;color:var(--text2)">' + (p.altersklasse || '&ndash;') + '</td>' +
      '<td style="padding:4px 6px;font-family:Barlow Condensed,sans-serif;font-size:15px;font-weight:700;color:var(--text)">' + _apFmtRes(p, fmt) + '</td>' +
      (showPace ? (function(){
        var _dm = p.disziplin_mapped || p.disziplin || '';
        var _km = diszKm(_dm);
        var _pace = (_km >= 1) ? fmtTime(calcPace(_dm, p.resultat), 'min/km') : '';
        return '<td style="padding:4px 6px" class="ort-text">' + _pace + '</td>';
      })() : '') +
      '<td style="padding:4px 6px;font-size:12px;color:var(--text2)">' + (p.wettkampf || '&ndash;') + editBtns + '</td>' +
      (hasExt ? '<td style="padding:4px 6px;font-size:11px;color:var(--text2)">' + (p.verein || '') + '</td>' : '') +
    '</tr>';
    } // end else (externe PBs)
  } // end _allRows loop
  var paceHeader = showPace ? '<th style="padding:4px 6px;text-align:left">Pace /km</th>' : '';
  var vereinHeader = hasExt ? '<th style="padding:4px 6px;text-align:left">Verein</th>' : '';
  var tableHtml = rows ?
    '<table style="width:100%;font-size:12px;border-collapse:collapse">' +
      '<thead><tr style="color:var(--text2);border-bottom:2px solid var(--border)">' +
        '<th style="padding:4px 6px;text-align:left">Datum</th>' +
        '<th style="padding:4px 6px;text-align:left">AK</th>' +
        '<th style="padding:4px 6px;text-align:left">Ergebnis</th>' +
        paceHeader +
        '<th style="padding:4px 6px;text-align:left">Veranstaltung</th>' +
        vereinHeader +
      '</tr></thead><tbody>' + rows + '</tbody></table>' :
    '<div style="color:var(--text2);padding:12px 0;font-size:13px">Keine Einträge.</div>';

  document.getElementById('_ap-kat-tabs').innerHTML = katTabs;
  document.getElementById('_ap-disz-btns').innerHTML = diszBtns;
  document.getElementById('_ap-table').innerHTML = tableHtml;
}

async function openAthletById(id) {
  var [r, rAusz] = await Promise.all([apiGet('athleten/' + id), apiGet('athleten/' + id + '/auszeichnungen')]);
  if (!r || !r.ok) return;
  var athlet = r.data.athlet;
  var kategorien = r.data.kategorien || [];
  var initials = ((athlet.vorname || '')[0] || '') + ((athlet.nachname || '')[0] || '');
  var totalErg = 0;
  for (var ki = 0; ki < kategorien.length; ki++) totalErg += (kategorien[ki].ergebnisse || []).length + (kategorien[ki].pbs || []).length;

  // Externe PBs in kategorien einbetten
  var rawPbs = r.data.pbs || [];
  rawPbs.forEach(function(pb) {
    var kn = pb.kat_name || 'Sonstige';
    var found = false;
    for (var ki = 0; ki < kategorien.length; ki++) {
      if (kategorien[ki].name === kn) {
        if (!kategorien[ki].pbs) kategorien[ki].pbs = [];
        kategorien[ki].pbs.push(pb);
        found = true; break;
      }
    }
    if (!found) {
      kategorien.push({ name: kn, fmt: pb.fmt || 'min', ergebnisse: [], pbs: [pb], kat_sort: pb.kat_sort || 99 });
    }
  });
  // Kategorien nach Reihenfolge sortieren
  kategorien.sort(function(a,b){ return (a.kat_sort||99)-(b.kat_sort||99); });
  _apState.kategorien = kategorien;
  _apState.pbs = rawPbs;
  _apState.selKat = 0;
  _apState.selDisz = null;
  _apState.tab = 'ergebnisse';
  _apState.athletId = id;

  var canEdit = !!(currentUser && (function() {
    if (currentUser.rolle === 'admin') return true;
    var r = currentUser.rechte || [];
    return r.indexOf('vollzugriff') >= 0 || r.indexOf('alle_ergebnisse') >= 0;
  }()));

  var gruppen = athlet.gruppen || [];
  var gruppenTags = '';
  for (var gi = 0; gi < gruppen.length; gi++) {
    gruppenTags += '<span class="rek-cat-btn" style="font-size:12px;padding:3px 10px;cursor:default">' + gruppen[gi].name + '</span>';
  }

  showModal(
    '<h2 style="margin-bottom:12px">Athletenprofil <button class="modal-close" onclick="closeModal()">&#x2715;</button></h2>' +
    '<div class="profile-header" style="margin-bottom:12px">' +
      (function(){
        // Online-Status: dot wird asynchron gesetzt nach API-Abfrage
        var _profAvId = 'prof-av-' + athlet.id;
        var _profAvatarHtml = '<div class="profile-avatar" style="overflow:visible;position:relative;padding:0;' + (athlet.avatar_pfad ? 'background:none;' : '') + '" id="' + _profAvId + '">' +
          (athlet.avatar_pfad
            ? '<img src="' + athlet.avatar_pfad + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">'
            : initials.toUpperCase()) +
          '</div>';
        // Async: Online-Status nur für eingeloggte User laden
        if (!currentUser) { return _profAvatarHtml; }
        apiGet('auth/online-status').then(function(r) {
          var onlineIds = (r && r.ok && r.data) ? (r.data.athlet_ids || r.data) : [];
          if (onlineIds.indexOf(athlet.id) >= 0 || onlineIds.indexOf(String(athlet.id)) >= 0) {
            var el = document.getElementById(_profAvId);
            if (el) { el.style.overflow = 'visible'; el.style.position = 'relative'; el.innerHTML += _avatarDot('online', 64); }
          }
        });
        return _profAvatarHtml;
      })() +
      '<div>' +
        '<div style="font-size:20px;font-weight:700">' + (athlet.vorname || '') + ' ' + (athlet.nachname || '') + '</div>' +
        (gruppenTags && _canSeePersoenlicheDaten() ? '<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:6px">' + gruppenTags + '</div>' : '') +
        '<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:6px;align-items:center">' +
          '<span class="badge badge-ak">' + totalErg + ' ' + (totalErg === 1 ? 'Wettkampf' : 'Wettkämpfe') + '</span>' +
          (athlet.geschlecht ? '<span class="badge" style="background:var(--surf2);color:var(--text)">' + (athlet.geschlecht === 'M' ? '♂ Männlich' : athlet.geschlecht === 'W' ? '♀ Weiblich' : '⚧ Divers') + '</span>' : '') +
          (_canSeePersoenlicheDaten() && athlet.geburtsjahr ? '<span class="badge" style="background:var(--surf2);color:var(--text2)">Jahrgang ' + athlet.geburtsjahr + '</span>' : '') +
          (function(){ var _ak = (athlet.geschlecht && athlet.geburtsjahr) ? calcDlvAK(athlet.geburtsjahr, athlet.geschlecht, new Date().getFullYear()) : ''; return _ak ? akBadge(_ak) : ''; })() +
        '</div>' +
        (function() {
            var ausz = (rAusz && rAusz.ok) ? rAusz.data : null;
            if (!ausz || (!ausz.meisterschaften.length && !ausz.bestleistungen.length)) return '';
            var haGeschlecht = athlet.geschlecht || '';
            var mSuffix = haGeschlecht === 'M' ? 'Meister' : haGeschlecht === 'W' ? 'Meisterin' : 'Meister/in';

            // Meisterschafts-Titel: gleiche Gruppierung wie HoF
            var mParts = [];
            if (ausz.meisterschaften.length) {
              var mGrp = {}, mOrd = [];
              (ausz.meisterschaften || []).forEach(function(mt) {
                var k = mt.label;
                if (!mGrp[k]) { mGrp[k] = { label: mt.label, jahre: [] }; mOrd.push(k); }
                if (mt.jahr && mGrp[k].jahre.indexOf(mt.jahr) < 0) mGrp[k].jahre.push(mt.jahr);
              });
              mOrd.forEach(function(k) {
                var mg = mGrp[k]; mg.jahre.sort();
                mParts.push(mg.label + (mg.jahre.length ? ' ' + mg.jahre.join(', ') : ''));
              });
            }

            // Vereinsbestleistungen: nach Disziplinkategorie gruppiert
            var bParts = [];
            if (ausz.bestleistungen.length) {
              // 1. Nach Kategorie aufteilen (Reihenfolge bleibt wie API-Sortierung)
              var bByKat = {}, bKatOrder = [];
              (ausz.bestleistungen || []).forEach(function(b) {
                var kat = b.kat_name || 'Sonstige';
                if (!bByKat[kat]) { bByKat[kat] = []; bKatOrder.push(kat); }
                bByKat[kat].push(b);
              });

              bKatOrder.forEach(function(kat) {
                var katItems = bByKat[kat];
                var katLines = [];

                // 2. Innerhalb Kategorie: gleiche Gruppierung wie bisher
                var byDisz = {};
                katItems.forEach(function(b) {
                  if (!byDisz[b.disziplin]) byDisz[b.disziplin] = { gold: [], ak: [] };
                  var isGold = b.label.indexOf('Gesamt') >= 0 || b.label.indexOf('M\u00e4nner') >= 0 || b.label.indexOf('Frauen') >= 0;
                  if (isGold) byDisz[b.disziplin].gold.push(b.label);
                  else byDisz[b.disziplin].ak.push(b.label.replace('Bestleistung ', ''));
                });
                var gesamtLines = {}, gesamtOrd = [];
                var akMap = {};
                Object.keys(byDisz).forEach(function(disz) {
                  var d = byDisz[disz];
                  d.gold.forEach(function(lbl) {
                    if (!gesamtLines[lbl]) { gesamtLines[lbl] = []; gesamtOrd.push(lbl); }
                    gesamtLines[lbl].push(disz);
                  });
                  if (d.ak.length) {
                    var sortedAK = d.ak.slice().sort();
                    var akKey = sortedAK.join('|');
                    if (!akMap[akKey]) { akMap[akKey] = { aks: sortedAK, disz: [] }; }
                    akMap[akKey].disz.push(disz);
                  }
                });
                gesamtOrd.forEach(function(lbl) {
                  var dl = gesamtLines[lbl];
                  var dStr = dl.length === 1 ? dl[0] : dl.slice(0,-1).join(', ') + ' und ' + dl[dl.length-1];
                  katLines.push(lbl + ' \u00fcber ' + dStr);
                });
                Object.keys(akMap).forEach(function(k) {
                  var entry = akMap[k];
                  var dl = entry.disz;
                  var akStr = compressAKList(entry.aks);
                  var dStr = dl.length === 1 ? dl[0] : dl.slice(0,-1).join(', ') + ' und ' + dl[dl.length-1];
                  katLines.push('Bestleistung ' + akStr + ' \u00fcber ' + dStr);
                });

                // Kategorie-Header + eingerückte Zeilen
                if (katLines.length) {
                  bParts.push('\u25b8 ' + kat);
                  katLines.forEach(function(l) { bParts.push('  ' + l); });
                }
              });
            }

            var html = '<div style="margin-top:6px;display:flex;gap:12px">';
            if (mParts.length) {
              var mTip = mParts.join('&#10;');
              html += '<span title="' + mTip + '" style="font-size:13px;color:var(--text2);cursor:help">&#x1F947; ' + ausz.meisterschaften.length + ' Titel</span>';
            }
            if (bParts.length) {
              var bTip = bParts.join('&#10;');
              html += '<span title="' + bTip + '" style="font-size:13px;color:var(--text2);cursor:help">&#x1F3C6; ' + ausz.bestleistungen.length + ' Bestleistungen</span>';
            }
            html += '</div>';
            return html;
          }()) +

      '</div>' +
    '</div>' +
    '<div id="_ap-kat-tabs" style="margin-bottom:12px"></div>' +
    '<div id="_ap-disz-btns" style="margin-bottom:12px;display:flex;flex-wrap:wrap"></div>' +
    '<div id="_ap-table" style="flex:1;overflow-y:auto;min-height:0"></div>' +
    '<div class="modal-actions" style="justify-content:space-between">' +
      (canEdit ? '<button class="btn btn-primary btn-sm" onclick="showPbModal(' + athlet.id + ',null)">+ Externes Ergebnis</button>' : '<span></span>') +
      '<button class="btn btn-ghost" onclick="closeModal()">Schlie&szlig;en</button>' +
    '</div>',
    'profile'
  );

  _apRender();

  // Event-Delegation im Modal (nur einmal registrieren)
  var _mc1 = document.getElementById('modal-container');
  if (_mc1 && !_mc1._apListener1) {
    _mc1._apListener1 = true;
    _mc1.addEventListener('click', function(ev) {
      var el = ev.target;
      while (el && el.id !== 'modal-container') {
        if (el.getAttribute && el.getAttribute('data-ap-kat') !== null) {
          _apState.selKat = parseInt(el.getAttribute('data-ap-kat'), 10);
          _apState.selDisz = null;
          _apRender(); return;
        }
        if (el.getAttribute && el.getAttribute('data-ap-disz') !== null) {
          _apState.selDisz = el.getAttribute('data-ap-disz');
          _apRender(); return;
        }
        // Externe PB Edit/Delete aus der Ergebnistabelle
        if (el.getAttribute && el.getAttribute('data-pb-edit')) {
          showPbModal(_apState.athletId, el.getAttribute('data-pb-edit')); return;
        }
        if (el.getAttribute && el.getAttribute('data-pb-del')) {
          deletePb(_apState.athletId, el.getAttribute('data-pb-del'), el.getAttribute('data-pb-disz')); return;
        }
        el = el.parentNode;
      }
    });
  }
}

function _apSetTab(tab) {
  _apState.tab = tab;
  var btnErg = document.getElementById('_ap-tab-ergebnisse');
  var btnPb  = document.getElementById('_ap-tab-pb');
  var aktStyle   = 'background:none;border:none;border-bottom:2px solid var(--btn-bg);margin-bottom:-2px;padding:6px 14px;font-weight:700;color:var(--btn-bg);cursor:pointer;font-size:13px';
  var inaktStyle = 'background:none;border:none;border-bottom:2px solid transparent;margin-bottom:-2px;padding:6px 14px;font-weight:600;color:var(--text2);cursor:pointer;font-size:13px';
  if (btnErg) btnErg.setAttribute('style', tab === 'ergebnisse' ? aktStyle : inaktStyle);
  if (btnPb)  btnPb.setAttribute('style',  tab === 'pb'         ? aktStyle : inaktStyle);
  var ergEls = ['_ap-kat-tabs', '_ap-disz-btns', '_ap-table'];
  for (var i = 0; i < ergEls.length; i++) {
    var el = document.getElementById(ergEls[i]);
    if (el) el.style.display = tab === 'ergebnisse' ? '' : 'none';
  }
  var pbPanel = document.getElementById('_ap-pb-panel');
  if (pbPanel) pbPanel.style.display = tab === 'pb' ? '' : 'none';
  if (tab === 'pb') _apRenderPb();
}

async function _apRenderPb() {
  var panel = document.getElementById('_ap-pb-panel');
  if (!panel) return;
  panel.innerHTML = '<div class="loading"><div class="spinner"></div>Laden&hellip;</div>';
  var r = await apiGet('athleten/' + _apState.athletId + '/pb');
  if (!r || !r.ok) { panel.innerHTML = '<div style="color:var(--accent)">Fehler beim Laden.</div>'; return; }
  var pbs = r.data || [];
  var canEdit = currentUser && (currentUser.rolle === 'admin' || currentUser.rolle === 'editor' || currentUser.rolle === 'athlet');

  var rows = '';
  for (var i = 0; i < pbs.length; i++) {
    var pb = pbs[i];
    rows += '<tr>' +
      '<td style="padding:6px 8px">' + diszMitKat(pb.disziplin) + '</td>' +
      '<td style="padding:6px 8px;font-family:\'Barlow Condensed\',sans-serif;font-weight:700;font-size:15px;color:' + (pb.verein ? 'var(--text)' : 'var(--primary)') + '">' + (pb.resultat || '') + '</td>' +
      '<td style="padding:6px 8px;color:var(--text2);font-size:12px">' + (pb.wettkampf || '&ndash;') + '</td>' +
      '<td style="padding:6px 8px;color:var(--text2);font-size:12px">' + (pb.datum ? formatDate(pb.datum) : '&ndash;') + '</td>' +
      (canEdit ?
        '<td style="padding:6px 8px;white-space:nowrap">' +
          '<button class="btn btn-ghost btn-sm" data-pb-edit="' + pb.id + '">&#x270F;&#xFE0F;</button> ' +
          '<button class="btn btn-danger btn-sm" data-pb-del="' + pb.id + '" data-pb-disz="' + pb.disziplin.replace(/"/g,'&quot;') + '">&#x2715;</button>' +
        '</td>' : '<td></td>') +
    '</tr>';
  }

  var addBtn = canEdit ?
    '<button class="btn btn-primary btn-sm" style="margin-bottom:12px" onclick="showPbModal(' + _apState.athletId + ',null)">+ Externer PB</button>' : '';

  panel.innerHTML = addBtn +
    (rows ?
      '<table style="width:100%;font-size:13px;border-collapse:collapse">' +
        '<thead><tr style="color:var(--text2);border-bottom:2px solid var(--border)">' +
          '<th style="padding:6px 8px;text-align:left">Disziplin</th>' +
          '<th style="padding:6px 8px;text-align:left">Ergebnis</th>' +
          '<th style="padding:6px 8px;text-align:left">Wettkampf</th>' +
          '<th style="padding:6px 8px;text-align:left">Datum</th>' +
          '<th style="padding:6px 8px"></th>' +
        '</tr></thead><tbody>' + rows + '</tbody></table>' :
      '<div style="color:var(--text2);padding:20px 0;text-align:center;font-size:13px">Noch keine externen PBs eingetragen.</div>'
    );

  // Event-Delegation für Edit/Delete
  panel.addEventListener('click', function(ev) {
    var el = ev.target;
    while (el && el !== panel) {
      if (el.getAttribute && el.getAttribute('data-pb-edit')) {
        var pbId = el.getAttribute('data-pb-edit');
        showPbModal(_apState.athletId, pbId); return;
      }
      if (el.getAttribute && el.getAttribute('data-pb-del')) {
        var pbId2 = el.getAttribute('data-pb-del');
        var disz  = el.getAttribute('data-pb-disz');
        deletePb(_apState.athletId, pbId2, disz); return;
      }
      el = el.parentNode;
    }
  });
}

// Auto-füllt Altersklasse basierend auf Geburtsjahr des Athleten + Wettkampfdatum
function _pbAutoAk(athletId) {
  var datVal = document.getElementById('_pb-datum') ? document.getElementById('_pb-datum').value : '';
  var akEl = document.getElementById('_pb-ak');
  if (!datVal || !akEl || akEl.value) return; // nicht überschreiben wenn schon gefüllt
  // Athleten-Daten aus API oder state
  apiGet('athleten/' + athletId).then(function(r) {
    if (!r || !r.ok) return;
    var a = r.data.athlet;
    if (!a || !a.geburtsjahr || !a.geschlecht) return;
    var year = parseInt(datVal.slice(0, 4));
    var ak = calcDlvAK(a.geburtsjahr, a.geschlecht, year);
    if (ak && akEl && !akEl.value) akEl.value = ak;
  });
}

// Füllt Disziplin-Dropdown basierend auf gewählter Kategorie (tbl_key)
function _pbUpdateDiszDropdown() {
  var katKey = document.getElementById('_pb-kat') ? document.getElementById('_pb-kat').value : '';
  var sel = document.getElementById('_pb-disz');
  if (!sel) return;
  var disz = (state.disziplinen || []).filter(function(d) { return d.tbl_key === katKey; });
  sel.innerHTML = '<option value="">-- Disziplin wählen --</option>' +
    disz.map(function(d) {
      return '<option value="' + d.id + '">' + d.disziplin + '</option>';
    }).join('');
}

function showPbModal(athletId, pbId) {
  var isEdit = !!pbId;

  // Kategorie-Optionen aus state.disziplinen
  var katsSeen = {};
  var katOpts = '<option value="">-- Kategorie wählen --</option>';
  (state.disziplinen || []).forEach(function(d) {
    if (d.tbl_key && !katsSeen[d.tbl_key]) {
      katsSeen[d.tbl_key] = true;
      katOpts += '<option value="' + d.tbl_key + '">' + d.kategorie + '</option>';
    }
  });

  var html =
    '<h2 style="margin:0 0 20px">' + (isEdit ? 'Externes Ergebnis bearbeiten' : 'Externes Ergebnis eintragen') +
      ' <button class="modal-close" onclick="closeModal()">&#x2715;</button></h2>' +

    '<div class="form-grid">' +
      '<div class="form-group">' +
        '<label>Kategorie <span style="color:var(--accent)">*</span></label>' +
        '<select id="_pb-kat" onchange="_pbUpdateDiszDropdown()">' + katOpts + '</select>' +
      '</div>' +
      '<div class="form-group">' +
        '<label>Disziplin <span style="color:var(--accent)">*</span></label>' +
        '<select id="_pb-disz"><option value="">-- erst Kategorie wählen --</option></select>' +
      '</div>' +
      '<div class="form-group">' +
        '<label>Ergebnis <span style="color:var(--accent)">*</span></label>' +
        '<input id="_pb-res" type="text" placeholder="z.B. 38:12 oder 7,42">' +
      '</div>' +
      '<div class="form-group">' +
        '<label>Altersklasse</label>' +
        '<input id="_pb-ak" type="text" placeholder="z.B. M40">' +
      '</div>' +
      '<div class="form-group">' +
        '<label>Datum</label>' +
        '<input id="_pb-datum" type="date" onchange="_pbAutoAk(' + athletId + ')">' +
      '</div>' +
      '<div class="form-group">' +
        '<label>Wettkampf</label>' +
        '<input id="_pb-wk" type="text" placeholder="z.B. Berlin-Marathon">' +
      '</div>' +
      '<div class="form-group full">' +
        '<label>Verein <span style="font-size:11px;color:var(--text2)">(leer = kein Verein angegeben)</span></label>' +
        '<input id="_pb-verein" type="text" placeholder="Vereinsname (optional)">' +
      '</div>' +
    '</div>' +

    '<div id="_pb-err" style="color:var(--accent);font-size:13px;min-height:18px;margin-bottom:8px"></div>' +
    '<div class="modal-actions">' +
      '<button class="btn btn-ghost" onclick="openAthletById(_apState.athletId)">&#x2190; Zurück</button>' +
      '<button class="btn btn-primary" onclick="savePb(' + athletId + ',' + (pbId || 'null') + ')">Speichern</button>' +
    '</div>';

  showModal(html);

  if (isEdit) {
    apiGet('athleten/' + athletId + '/pb').then(function(r2) {
      if (!r2 || !r2.ok) return;
      var list = r2.data || [];
      for (var i = 0; i < list.length; i++) {
        if (String(list[i].id) === String(pbId)) {
          document.getElementById('_pb-res').value   = list[i].resultat   || '';
          document.getElementById('_pb-datum').value = list[i].datum      || '';
          document.getElementById('_pb-wk').value    = list[i].wettkampf  || '';
          if (document.getElementById('_pb-verein')) document.getElementById('_pb-verein').value = list[i].verein || '';
          if (document.getElementById('_pb-ak')) document.getElementById('_pb-ak').value = list[i].altersklasse || '';
          // Kategorie + Disziplin-Dropdown vorbelegen
          if (list[i].disziplin_mapping_id) {
            var dm2 = (state.disziplinen||[]).find(function(d){ return d.id == list[i].disziplin_mapping_id; });
            if (dm2) {
              var katEl = document.getElementById('_pb-kat');
              if (katEl) { katEl.value = dm2.tbl_key; _pbUpdateDiszDropdown(); }
              var diszEl2 = document.getElementById('_pb-disz');
              if (diszEl2) setTimeout(function(){ diszEl2.value = dm2.id; }, 50);
            }
          }
          break;
        }
      }
    });
  }
}

async function savePb(athletId, pbId) {
  var disz = (document.getElementById('_pb-disz').value || '').trim();
  var res  = (document.getElementById('_pb-res').value  || '').trim();
  var dat  = (document.getElementById('_pb-datum').value || '').trim();
  var wk   = (document.getElementById('_pb-wk').value   || '').trim();
  var err  = document.getElementById('_pb-err');
  if (!disz || !res) { err.textContent = 'Disziplin und Ergebnis sind Pflichtfelder.'; return; }
  var vr   = (document.getElementById('_pb-verein') ? document.getElementById('_pb-verein').value.trim() : '') || '';
  var ak   = (document.getElementById('_pb-ak') ? document.getElementById('_pb-ak').value.trim() : '') || '';
  var dmId = null;
  var diszEl = document.getElementById('_pb-disz');
  var diszOpt = diszEl ? diszEl.options[diszEl.selectedIndex] : null;
  if (diszOpt && diszOpt.value) {
    dmId = parseInt(diszOpt.value);
    var dm = (state.disziplinen||[]).find(function(d){ return d.id == dmId; });
    if (dm) disz = dm.disziplin;
  }
  if (!dmId) { err.textContent = 'Bitte Kategorie und Disziplin wählen.'; return; }
  var body = { disziplin: disz, resultat: res, datum: dat || null, wettkampf: wk || null, verein: vr || null, altersklasse: ak || null, disziplin_mapping_id: dmId };
  var r = pbId ? await apiPut('athleten/' + athletId + '/pb/' + pbId, body)
               : await apiPost('athleten/' + athletId + '/pb', body);
  if (!r || !r.ok) { err.textContent = r ? r.fehler : 'Fehler'; return; }
  // Pbs neu laden und Tabelle aktualisieren
  var reloaded = await apiGet('athleten/' + athletId + '/pb');
  _apState.pbs = (reloaded && reloaded.ok) ? (reloaded.data || []) : _apState.pbs;
  closeModal();
  _apRender();
}

function deletePb(athletId, pbId, disz) {
  showModal(
    '<h2>Externes Ergebnis löschen <button class="modal-close" onclick="closeModal()">&#x2715;</button></h2>' +
    '<p style="font-size:14px;color:var(--text2);margin:8px 0 20px">Externes Ergebnis <strong>' + (disz || '') + '</strong> wirklich löschen?</p>' +
    '<div class="modal-actions">' +
      '<button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button>' +
      '<button class="btn btn-danger" onclick="_doDeletePb(' + athletId + ',' + pbId + ')">Löschen</button>' +
    '</div>'
  );
}

async function _doDeletePb(athletId, pbId) {
  closeModal();
  var r = await apiDel('athleten/' + athletId + '/pb/' + pbId);
  if (!r || !r.ok) { notify('Fehler beim Löschen.', 'err'); return; }
  var reloaded2 = await apiGet('athleten/' + athletId + '/pb');
  _apState.pbs = (reloaded2 && reloaded2.ok) ? (reloaded2.data || []) : _apState.pbs;
  _apRender();
}
