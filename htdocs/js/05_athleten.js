function _mkDelBtn(id) {
  return '<button class="btn btn-danger btn-sm" onclick="deleteAthletById(' + id + ')" title="Löschen">&#x1F5D1;&#xFE0F;</button>';
}

function deleteAthletById(id) {
  var cached = _athLetenCache.alleAthleten || [];
  var name = '';
  for (var i = 0; i < cached.length; i++) { if (cached[i].id == id) { name = cached[i].name_nv || ''; break; } }
  deleteAthlet(id, name);
}

function _normN(s) {
  return normalizeUmlauts(s).toLowerCase()
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
  var selTh = _athCanMerge()
    ? '<th style="width:32px;text-align:center"><input type="checkbox" id="athCheckAll" onchange="_athToggleAll(this.checked)" style="cursor:pointer" title="Alle auswählen"></th>'
    : '';
  return selTh + cols.map(function(c) {
    if (!c.key) return '<th></th>';
    var arrow = _athSort.col === c.key ? (_athSort.dir === 1 ? ' ▲' : ' ▼') : '';
    var style = 'cursor:pointer;user-select:none;white-space:nowrap' + (_athSort.col === c.key ? ';color:var(--primary)' : '');
    return '<th style="' + style + '" onclick="_athSetSort(\'' + c.key + '\')">' + c.label + arrow + '</th>';
  }).join('');
}

// ── Mehrfachauswahl + Zusammenführen (nur Admin) ─────────────
var _athSel = {};

function _athCanMerge() { return !!(currentUser && currentUser.rolle === 'admin'); }

function _athToggleAll(checked) {
  var sorted = _athLetenCache._lastSorted || [];
  if (!checked) _athSel = {};
  else for (var i = 0; i < sorted.length; i++) _athSel[sorted[i].id] = true;
  _renderAthletenTable();
}

function _athToggle(id) {
  if (_athSel[id]) delete _athSel[id];
  else _athSel[id] = true;
  _athUpdateBulkBar();
  var tr = document.querySelector('#athlet-tabelle tbody tr[data-aid="' + id + '"]');
  if (tr) {
    var chk = tr.querySelector('input[type=checkbox]');
    if (chk) chk.checked = !!_athSel[id];
    tr.style.background = _athSel[id] ? 'var(--surf2)' : '';
  }
  var allChk = document.getElementById('athCheckAll');
  if (allChk) {
    var sel = _athSelIds().length;
    var total = (_athLetenCache._lastSorted || []).length;
    allChk.checked = sel > 0 && sel >= total;
    allChk.indeterminate = sel > 0 && sel < total;
  }
}

// Nur IDs zurückgeben, die aktuell auch sichtbar sind (Filter/Suche könnten sie entfernt haben)
function _athSelIds() {
  var sichtbar = {};
  var sorted = _athLetenCache._lastSorted || [];
  for (var i = 0; i < sorted.length; i++) sichtbar[sorted[i].id] = true;
  return Object.keys(_athSel).map(Number).filter(function(id) { return sichtbar[id]; });
}

function _athUpdateBulkBar() {
  var bar = document.getElementById('ath-bulk-bar');
  if (!bar) return;
  var n = _athSelIds().length;
  bar.style.display = n > 0 ? 'flex' : 'none';
  var cnt = document.getElementById('ath-bulk-count');
  if (cnt) cnt.textContent = n + ' ausgewählt';
  var btn = document.getElementById('ath-merge-btn');
  if (btn) btn.disabled = n < 2;
}

function _athClearSel() { _athSel = {}; _renderAthletenTable(); }

function showAthletMergeModal() {
  var ids = _athSelIds();
  if (ids.length < 2) { notify('Bitte mindestens 2 Athleten auswählen.', 'err'); return; }
  var alle = _athLetenCache.alleAthleten || [];
  var sel = [];
  for (var i = 0; i < alle.length; i++) { if (ids.indexOf(alle[i].id) >= 0) sel.push(alle[i]); }
  // Vorauswahl: Athlet mit den meisten Ergebnissen ist das sinnvollste Ziel
  var zielId = sel[0].id, maxErg = -1;
  for (var i = 0; i < sel.length; i++) {
    var n = parseInt(sel[i].anz_ergebnisse) || 0;
    if (n > maxErg) { maxErg = n; zielId = sel[i].id; }
  }
  var rows = sel.map(function(a) {
    var g = a.geschlecht === 'M' ? '♂' : a.geschlecht === 'W' ? '♀' : a.geschlecht === 'D' ? '⚧' : '–';
    var status = a.aktiv ? 'Aktiv' : (a.orga ? 'Orga' : 'Inaktiv');
    return '<tr>' +
      '<td style="text-align:center;padding:6px 8px"><input type="radio" name="ath-merge-ziel" value="' + a.id + '"' + (a.id === zielId ? ' checked' : '') + ' onchange="_athMergePreview()" style="cursor:pointer"></td>' +
      '<td style="padding:6px 8px"><strong>' + _esc(a.nachname || '') + '</strong>' + (a.vorname ? ', ' + _esc(a.vorname) : '') + '</td>' +
      '<td style="padding:6px 8px;text-align:center;color:var(--text2)">' + (a.geburtsjahr || '–') + '</td>' +
      '<td style="padding:6px 8px;text-align:center">' + g + '</td>' +
      '<td style="padding:6px 8px;text-align:center"><span class="badge badge-platz">' + (parseInt(a.anz_ergebnisse) || 0) + '</span></td>' +
      '<td style="padding:6px 8px;text-align:center;font-size:12px;color:var(--text2)">' + status + '</td>' +
    '</tr>';
  }).join('');

  showModal(
    modalH2('&#x1F517; Athleten zusammenf&uuml;hren') +
    '<p style="font-size:13px;color:var(--text2);margin:0 0 12px">W&auml;hlen Sie den <strong>Ziel-Athleten</strong>. Alle Ergebnisse, Gruppen und alternativen Namen der &uuml;brigen Athleten werden auf ihn &uuml;bertragen; die anderen wandern in den Papierkorb.</p>' +
    '<div class="table-scroll"><table style="width:100%;border-collapse:collapse;font-size:13px">' +
      '<thead><tr style="border-bottom:1px solid var(--border)">' +
        '<th style="padding:6px 8px;font-size:11px;color:var(--text2)">Ziel</th>' +
        '<th style="padding:6px 8px;font-size:11px;color:var(--text2);text-align:left">Name</th>' +
        '<th style="padding:6px 8px;font-size:11px;color:var(--text2)">Jahrgang</th>' +
        '<th style="padding:6px 8px;font-size:11px;color:var(--text2)">♂♀</th>' +
        '<th style="padding:6px 8px;font-size:11px;color:var(--text2)">Erg.</th>' +
        '<th style="padding:6px 8px;font-size:11px;color:var(--text2)">Status</th>' +
      '</tr></thead><tbody>' + rows + '</tbody>' +
    '</table></div>' +
    '<div id="ath-merge-preview" style="margin-top:12px;padding:10px 12px;background:var(--surf2);border-radius:6px;font-size:13px"></div>' +
    '<div class="modal-actions">' +
      '<button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button>' +
      '<button class="btn btn-primary" onclick="doAthletMerge()">&#x1F517; Zusammenf&uuml;hren</button>' +
    '</div>'
  , true, true);
  _athMergePreview();
}

function _athMergePreview() {
  var el = document.getElementById('ath-merge-preview');
  if (!el) return;
  var sel = document.querySelector('input[name="ath-merge-ziel"]:checked');
  if (!sel) { el.innerHTML = ''; return; }
  var zielId = parseInt(sel.value);
  var alle = _athLetenCache.alleAthleten || [];
  var ids = _athSelIds();
  var ziel = null, quellen = [], erg = 0;
  for (var i = 0; i < alle.length; i++) {
    var a = alle[i];
    if (ids.indexOf(a.id) < 0) continue;
    if (a.id === zielId) ziel = a;
    else { quellen.push(a); erg += parseInt(a.anz_ergebnisse) || 0; }
  }
  if (!ziel) { el.innerHTML = ''; return; }
  var namen = quellen.map(function(q) { return _esc((q.nachname||'') + (q.vorname ? ', ' + q.vorname : '')); }).join(' &middot; ');
  el.innerHTML =
    '<div style="margin-bottom:4px">&#x2192; Ziel: <strong>' + _esc((ziel.nachname||'') + (ziel.vorname ? ', ' + ziel.vorname : '')) + '</strong> ' +
    'erh&auml;lt <strong>' + erg + '</strong> zus&auml;tzliche Ergebnisse (neu gesamt: <strong>' + ((parseInt(ziel.anz_ergebnisse)||0) + erg) + '</strong>)</div>' +
    '<div style="color:var(--text2);font-size:12px">In den Papierkorb: ' + namen + '</div>' +
    '<div style="color:var(--text2);font-size:12px;margin-top:4px">Deren Namen werden als alternative Namen beim Ziel hinterlegt, damit Bulk-Importe sie weiterhin zuordnen.</div>';
}

async function doAthletMerge() {
  var sel = document.querySelector('input[name="ath-merge-ziel"]:checked');
  if (!sel) { notify('Bitte Ziel-Athlet wählen.', 'err'); return; }
  var zielId = parseInt(sel.value);
  var quellIds = _athSelIds().filter(function(id) { return id !== zielId; });
  if (!quellIds.length) { notify('Keine Quell-Athleten übrig.', 'err'); return; }
  var r = await apiPost('athleten/merge', { ziel_id: zielId, quell_ids: quellIds });
  if (r && r.ok) {
    closeModal();
    notify((r.data && r.data.msg) || 'Zusammengeführt.', 'ok');
    _athSel = {};
    await loadAthleten();
    await renderAthleten();
  } else {
    notify((r && r.fehler) || 'Fehler beim Zusammenführen', 'err');
  }
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
  var showDetails = _canSeeAthletenDetails();
  var canEdit    = _canEditAthleten();
  var isAdmin    = currentUser && currentUser.rolle === 'admin';
  var canMerge   = _athCanMerge();
  var jetzt = new Date().getFullYear();

  // Inaktive Athleten nur mit spezifischem Recht sichtbar
  _athFilterInit();
  var athleten = tfFilter('athleten', _athSichtbareAthleten());
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
    var selTd = canMerge
      ? '<td style="width:32px;text-align:center"><input type="checkbox"' + (_athSel[a.id] ? ' checked' : '') + ' onchange="_athToggle(' + a.id + ')" style="cursor:pointer"></td>'
      : '';
    rows +=
      '<tr data-aid="' + a.id + '"' + (canMerge && _athSel[a.id] ? ' style="background:var(--surf2)"' : '') + '>' +
        selTd +
        '<td><span class="athlet-link" onclick="openAthletById(' + a.id + ')">' + a.nachname + '</span></td>' +
        '<td>' + (a.vorname || '') + '</td>' +
        (showDetails ? '<td style="text-align:center">' + gSymbol + '</td>' : '') +
        '<td style="color:var(--text2);font-size:13px">' + (a.geburtsjahr || '') + '</td>' +
        '<td>' + (aktuellAK ? akBadge(aktuellAK) : '') + '</td>' +
        '<td>' + renderGruppenInline(a.gruppen) + '</td>' +
        (showDetails ? '<td><span class="badge badge-platz">' + a.anz_ergebnisse + '</span></td>' : '') +
        (showDetails ? '<td data-letzte style="color:var(--text2);font-size:13px;text-align:center">' + (a.letzte_aktivitaet || '–') + '</td>' : '') +
        (showDetails ? '<td>' + (a.aktiv ? '<span class="badge badge-aktiv">Aktiv</span>' : (a.orga ? '<span class="badge" style="background:#fff3e0;color:#e65100;border:1px solid #ffcc80" title="Inaktiv, aber in der Organisation aktiv">&#x1F9E9; Orga</span>' : '<span class="badge badge-inaktiv">Inaktiv</span>')) + '</td>' : '') +
        (canEdit || isAdmin ? '<td style="white-space:nowrap">' +
          (canEdit ? '<button class="btn btn-ghost btn-sm" onclick="showAthletEditModal(' + a.id + ')">&#x270F;&#xFE0E;</button>' : '') +
          (isAdmin && a.aktiv ? '<button class="btn btn-ghost btn-sm" title="Deaktivieren" style="color:var(--text2)" onclick="toggleAthletAktiv(' + a.id + ',0)">&#x23FC;&#xFE0E;</button>' : '') +
          (isAdmin && !a.aktiv ? '<button class="btn btn-ghost btn-sm" title="Aktivieren" style="color:var(--green)" onclick="toggleAthletAktiv(' + a.id + ',1)">&#x23FB;&#xFE0E;</button>' : '') +
          (isAdmin && !a.aktiv ? '<button class="btn btn-ghost btn-sm" title="' + (a.orga ? 'Orga-Markierung entfernen' : 'Als Orga-Mitglied markieren') + '" style="color:#e65100" onclick="toggleAthletOrga(' + a.id + ',' + (a.orga ? 0 : 1) + ')">&#x1F9E9;</button>' : '') +
          (canDel ? _mkDelBtn(a.id) : '') +
        '</td>' : '') +
      '</tr>';
  }
  var tbody = document.querySelector('#athlet-tabelle tbody');
  var count = document.getElementById('athlet-count');
  if (tbody) tbody.innerHTML = rows;
  if (count) count.textContent = athleten.length + ' Athleten';
  if (canMerge) {
    _athUpdateBulkBar();
    var allChk = document.getElementById('athCheckAll');
    if (allChk) {
      var selN = _athSelIds().length;
      allChk.checked = selN > 0 && selN >= sorted.length;
      allChk.indeterminate = selN > 0 && selN < sorted.length;
    }
  }
}

// Dynamische Filterleiste der Athleten-Tabelle. Gefiltert wird clientseitig auf
// der vollstaendigen Athletenliste – die Werteauswahl kennt so alle Treffer.
function _athFilterInit() {
  var jetzt = new Date().getFullYear();
  var details = _canSeeAthletenDetails();
  var spalten = [
    { key: 'geschlecht', label: 'Geschlecht', wert: function(a) {
        return a.geschlecht === 'M' ? 'M\u00e4nnlich' : a.geschlecht === 'W' ? 'Weiblich'
             : a.geschlecht === 'D' ? 'Divers' : ''; } },
    { key: 'jahrgang', label: 'Jahrgang', absteigend: true,
      wert: function(a) { return a.geburtsjahr ? String(a.geburtsjahr) : ''; } },
    { key: 'ak', label: 'Altersklasse', wert: function(a) {
        return (a.geschlecht && a.geburtsjahr) ? calcDlvAK(a.geburtsjahr, a.geschlecht, jetzt) : ''; } },
    // Mehrfachzuordnung: jede Gruppe zaehlt einzeln
    { key: 'gruppe', label: 'Gruppe', wert: function(a) {
        return (a.gruppen || []).map(function(g) { return g.name; }); } }
  ];
  if (details) spalten.push(
    { key: 'status', label: 'Status', wert: function(a) {
        return a.aktiv ? 'Aktiv' : (a.orga ? 'Orga' : 'Inaktiv'); } },
    { key: 'ergebnisse', label: 'Ergebnisse', wert: function(a) {
        return parseInt(a.anz_ergebnisse) > 0 ? 'vorhanden' : 'keine'; } },
    { key: 'letzte', label: 'Letzte Aktivit\u00e4t', absteigend: true, wert: function(a) {
        return a.letzte_aktivitaet ? String(a.letzte_aktivitaet) : ''; } }
  );
  tfInit('athleten', {
    platzhalter: 'Name, Vorname, Gruppe\u2026',
    rows: function() { return _athSichtbareAthleten(); },
    suche: function(a) {
      return [a.nachname, a.vorname, a.name_nv,
              (a.gruppen || []).map(function(g) { return g.name; }).join(' ')];
    },
    spalten: spalten,
    onChange: function() { _renderAthletenTable(); }
  });
}

// Grundmenge der Tabelle: was der angemeldete Benutzer ueberhaupt sehen darf.
// Basis fuer Filterung und fuer die Werteauswahl der Filterleiste.
function _athSichtbareAthleten() {
  var alle = _athLetenCache.alleAthleten || [];
  if (_canSeeInaktiveAthleten()) return alle;
  return alle.filter(function(a) { return !!a.aktiv; });
}

async function renderAthleten() {
  var aktGruppe = state.filters.gruppe || '';
  var rA = await apiGet('athleten');
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

  _athFilterInit();
  document.getElementById('main-content').innerHTML =
    (state.tab === 'admin' && typeof adminSubtabs === 'function' ? adminSubtabs() : '') +
    '<div class="rek-cat-tabs" style="margin-bottom:16px">' + gruppenBtns + '</div>' +
    tfBarHtml('athleten', { suchbreite: '1 1 220px', extra:
      (canEdit ? '<button class="btn btn-primary btn-sm" onclick="showNeuerAthletModal()">+ Neuer Athlet</button>' : '') +
      (canEdit ? '<button class="btn btn-ghost btn-sm" onclick="showGeburtjahrImportModal()" title="Geburtsjahr-Bulk-Import">&#x1F4C5; Geburtsjahr importieren</button>' : '') }) +
    (_athCanMerge()
      ? '<div id="ath-bulk-bar" style="display:none;align-items:center;gap:10px;flex-wrap:wrap;background:var(--surf2);border:1px solid var(--primary);border-radius:8px;padding:10px 14px;margin-bottom:12px">' +
          '<span id="ath-bulk-count" style="font-weight:600;font-size:13px"></span>' +
          '<button class="btn btn-sm btn-primary" id="ath-merge-btn" onclick="showAthletMergeModal()">&#x1F517; Zusammenf&uuml;hren</button>' +
          '<button class="btn btn-sm btn-ghost" onclick="_athClearSel()">Auswahl aufheben</button>' +
          '<span style="font-size:12px;color:var(--text2)">Mindestens 2 Athleten ausw&auml;hlen</span>' +
        '</div>'
      : '') +
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
  // DOM aktualisieren: jede tr per data-aid zuordnen statt per Index
  var tbody = document.querySelector('#athlet-tabelle tbody');
  if (!tbody) return;
  var trs = tbody.querySelectorAll('tr');
  for (var i = 0; i < trs.length; i++) {
    var aid = trs[i].getAttribute('data-aid');
    if (!aid) continue;
    var td = trs[i].querySelector('td[data-letzte]');
    if (td) td.textContent = map[aid] || '–';
  }
}

// Athletenprofil State
var _apState = { kategorien: [], pbs: [], selKat: 0, selDisz: null, tab: 'ergebnisse', athletId: null };

function _apFmtRes(e, fallbackFmt) {
  var f = e.fmt || fallbackFmt || 'min';
  if (f === 'm') return fmtMeter(e.resultat);
  var isTStr = e.resultat && e.resultat.indexOf(':') >= 0;
  var unit = (f === 's' && !isTStr) ? 's' : (f === 'min_h' ? 'min_h' : undefined);
  return fmtTime(e.resultat, unit);
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

// ── Athlet Vollseite / Link teilen ──────────────────────────────────────────
function _athSlug(vorname, nachname) {
  var s = ((vorname||'')+'-'+(nachname||'')).toLowerCase();
  s = s.replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss');
  return s.replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
}
function _athCopyLink(slug) {
  // Pfad-basierte URL (/athlet/slug) – Messenger, Crawler und KI-Assistenten lesen
  // dort OG-Tags und eine Textfassung des Profils (athlet/index.php)
  var url = seitenUrl('athlet/' + slug);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(function(){ notify('Link kopiert!','ok'); });
  } else {
    var ta = document.createElement('textarea');
    ta.value = url; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta); notify('Link kopiert!','ok');
  }
}

// Athletenlinks fuehren direkt auf die Profil-Vollseite (#athlet/<slug>) –
// das fruehere Profil-Modal gibt es nicht mehr. Den Slug setzt die Seite
// nach dem Laden selbst (_mvLaden).
function openAthletById(id) {
  if (!id) return;
  closeModal();
  state.tab = 'athlet';
  state.athletId = id;
  state.athletSlug = null;
  buildNav();
  renderPage();
  window.scrollTo(0, 0);
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
  window._pbVid = null;
  window._pbVname = '';

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
      '<div class="form-group full">' +
        '<label>Veranstaltung <span style="color:var(--accent)">*</span></label>' +
        '<input type="text" id="_pb-veranst-search" placeholder="Name suchen…" oninput="_pbVeranstSearch(this.value)" autocomplete="off"/>' +
        '<div id="_pb-veranst-results" style="margin-top:4px"></div>' +
        '<div id="_pb-veranst-current" style="font-size:12px;color:var(--text2);margin-top:4px">' +
          '<span style="color:var(--accent)">Pflichtfeld – bitte Veranstaltung auswählen</span>' +
        '</div>' +
      '</div>' +
      '<div class="form-group full">' +
        '<label>Verein <span style="font-size:11px;color:var(--text2)">(leer = kein Verein angegeben)</span></label>' +
        '<input id="_pb-verein" type="text" placeholder="Vereinsname (optional)">' +
      '</div>' +
    '</div>' +

    '<div id="_pb-err" style="color:var(--accent);font-size:13px;min-height:18px;margin-bottom:8px"></div>' +
    '<div class="modal-actions">' +
      '<button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button>' +
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
          if (list[i].veranstaltung_id) {
            var vname = (list[i].wettkampf || '') + (list[i].datum ? ' (' + list[i].datum.slice(0,4) + ')' : '');
            _pbVeranstSelect(list[i].veranstaltung_id, vname);
            var pbSearchInp = document.getElementById('_pb-veranst-search');
            if (pbSearchInp) pbSearchInp.value = window._pbVname;
          }
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
  var vid  = window._pbVid || null;
  var err  = document.getElementById('_pb-err');
  if (!disz || !res) { err.textContent = 'Disziplin und Ergebnis sind Pflichtfelder.'; return; }
  if (!vid) { err.textContent = 'Bitte eine Veranstaltung auswählen.'; return; }
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
  var body = { disziplin: disz, resultat: res, veranstaltung_id: vid, verein: vr || null, altersklasse: ak || null, disziplin_mapping_id: dmId };
  var r = pbId ? await apiPut('athleten/' + athletId + '/pb/' + pbId, body)
               : await apiPost('athleten/' + athletId + '/pb', body);
  if (!r || !r.ok) { err.textContent = r ? r.fehler : 'Fehler'; return; }
  // Pbs neu laden und Tabelle aktualisieren
  var reloaded = await apiGet('athleten/' + athletId + '/pb');
  _apState.pbs = (reloaded && reloaded.ok) ? (reloaded.data || []) : _apState.pbs;
  closeModal();
  _apNachPbAenderung();
}

// Externe Ergebnisse geaendert: Profilseite (Engine aus 10_veranstaltungen.js) neu laden
function _apNachPbAenderung() {
  if (state.tab === 'athlet' && typeof _mvNeuLaden === 'function') _mvNeuLaden();
}

var _pbSearchTimer = null;
function _pbVeranstSearch(q) {
  var box = document.getElementById('_pb-veranst-results');
  if (!box) return;
  if (!q || q.length < 2) { box.innerHTML = ''; return; }
  clearTimeout(_pbSearchTimer);
  box.innerHTML = '<div style="font-size:12px;color:var(--text2);padding:4px 0">Suche…</div>';
  _pbSearchTimer = setTimeout(async function() {
    var r = await apiGet('veranstaltungen?suche=' + encodeURIComponent(q) + '&limit=200');
    var matches = (r && r.ok && r.data && r.data.veranst) ? r.data.veranst : [];
    if (!matches.length) { box.innerHTML = '<div style="font-size:12px;color:var(--text2);padding:4px 0">Keine Treffer</div>'; return; }
    box.innerHTML = '<div style="border:1px solid var(--border);border-radius:6px;overflow:hidden;margin-top:2px;max-height:200px;overflow-y:auto">' +
      matches.map(function(v) {
        var label = (v.name || v.kuerzel || '') + (v.datum ? ' (' + v.datum.slice(0,4) + ')' : '');
        return '<div class="ext-veranst-option" data-vid="' + v.id + '" data-vname="' + label.replace(/"/g,'&quot;') + '" ' +
          'style="padding:7px 12px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--border);background:var(--surf)">' +
          label + '</div>';
      }).join('') +
    '</div>';
    box.addEventListener('click', function(ev) {
      var opt = ev.target.closest('.ext-veranst-option');
      if (opt) _pbVeranstSelect(parseInt(opt.dataset.vid), opt.dataset.vname);
    }, { once: true });
  }, 300);
}

function _pbVeranstSelect(id, name) {
  window._pbVid = id;
  window._pbVname = name;
  var inp = document.getElementById('_pb-veranst-search');
  if (inp) inp.value = name;
  var box = document.getElementById('_pb-veranst-results');
  if (box) box.innerHTML = '';
  var cur = document.getElementById('_pb-veranst-current');
  if (cur) cur.innerHTML = '&#x1F517; ' + name;
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
  _apNachPbAenderung();
}

function _buildAthletCard(a, hof, letzteAkt) {
  var displayName = (a.vorname ? a.vorname + ' ' : '') + a.nachname;
  var av = avatarHtml(a.avatar_pfad, displayName, 72, 27);

  var statsHtml = '', badgesHtml = '', hasVrOrBl = false;
  if (hof) {
    var _mCnt = (hof.meisterschaftsTitel || []).length;
    var _vrCnt = 0, _blCnt = 0;
    var _dkeys = Object.keys(hof.disziplinen || {});
    for (var _di = 0; _di < _dkeys.length; _di++) {
      var _tls = hof.disziplinen[_dkeys[_di]];
      var _gesAll = false, _gesM = false, _gesW = false;
      for (var _ti = 0; _ti < _tls.length; _ti++) {
        var _lbl = _tls[_ti].label || '';
        if (_lbl === 'Gesamtbestleistung') _gesAll = true;
        else if (_lbl === 'Gesamtbestleistung Männer') _gesM = true;
        else if (_lbl === 'Gesamtbestleistung Frauen') _gesW = true;
        else _blCnt++;
      }
      if (_gesAll) { _vrCnt++; }
      else { if (_gesM) _vrCnt++; if (_gesW) _vrCnt++; }
    }
    hasVrOrBl = (_vrCnt > 0 || _blCnt > 0);
    var _parts = [];
    if (_mCnt)  _parts.push(_mCnt  + '\u00a0' + (_mCnt  === 1 ? 'Titel'        : 'Titel'));
    if (_vrCnt) _parts.push(_vrCnt + '\u00a0' + (_vrCnt === 1 ? 'Vereinsrekord' : 'Vereinsrekorde'));
    if (_blCnt) _parts.push(_blCnt + '\u00a0' + (_blCnt === 1 ? 'Bestleistung'  : 'Bestleistungen'));
    if (_parts.length) statsHtml = '<div style="font-size:12px;color:var(--text2);margin-bottom:6px">' + _parts.join(' · ') + '</div>';

    var mTitel = hof.meisterschaftsTitel || [];
    if (mTitel.length) {
      var mSpans = [];
      var haGeschlecht = hof.geschlecht || '';
      var mSuffix = haGeschlecht === 'M' ? '-Meister' : haGeschlecht === 'W' ? '-Meisterin' : '-Meister/in';
      for (var mi = 0; mi < mTitel.length; mi++) {
        var mt = mTitel[mi];
        var afterEmoji = mt.label.indexOf(' ') >= 0 ? mt.label.slice(mt.label.indexOf(' ') + 1) : mt.label;
        var sp2 = afterEmoji.indexOf(' ');
        var mstrName = sp2 > 0 ? afterEmoji.slice(0, sp2) : afterEmoji;
        var diszPart = sp2 > 0 ? afterEmoji.slice(sp2 + 1) : '';
        var _sep = /e$/i.test(mstrName) ? ' ' : '-';
        var tooltip = mstrName + _sep + mSuffix.replace(/^-/, '') + ' ' + diszPart + (mt.ak ? ' (' + mt.ak + ')' : '') + (mt.jahr ? ' ' + mt.jahr : '');
        mSpans.push('<span title="' + tooltip.replace(/"/g, '&quot;') + '" style="font-size:16px;cursor:default;line-height:1">&#x1F947;</span>');
      }
      badgesHtml += '<div style="width:100%;display:flex;justify-content:center;flex-wrap:wrap;gap:1px;margin-bottom:4px">' + mSpans.join('') + '</div>';
    }

    var diszKeys = Object.keys(hof.disziplinen || {});
    var groupMap = {}, groupOrder = [];
    for (var hdi = 0; hdi < diszKeys.length; hdi++) {
      var hd = diszKeys[hdi];
      var htitels = hof.disziplinen[hd];
      var hDiszName = hd.indexOf('|||') >= 0 ? hd.split('|||')[0] : hd;
      var hMappingId = (htitels[0] || {}).mid || null;
      var gesamtAll = htitels.some(function(t) { return t.label === 'Gesamtbestleistung'; });
      var gesamtM   = htitels.some(function(t) { return t.label === 'Gesamtbestleistung Männer'; });
      var gesamtW   = htitels.some(function(t) { return t.label === 'Gesamtbestleistung Frauen'; });
      var gesamt    = gesamtAll || gesamtM || gesamtW;
      var _mhnLabel = htitels.find(function(t) { return t.label === 'Bestleistung Männer'; });
      var _whnLabel = htitels.find(function(t) { return t.label === 'Bestleistung Frauen'; });
      var hasMHK = htitels.some(function(t) { return t.label === 'Bestleistung MHK'; });
      var hasWHK = htitels.some(function(t) { return t.label === 'Bestleistung WHK'; });
      var akM = htitels.filter(function(t) { return /^Bestleistung M(?:\d|U\d)/.test(t.label); }).map(function(t) { return t.label.replace('Bestleistung ', ''); });
      var akW = htitels.filter(function(t) { return /^Bestleistung W(?:\d|U\d)/.test(t.label); }).map(function(t) { return t.label.replace('Bestleistung ', ''); });
      var parts = [];
      if (gesamtAll) {
        parts.push('Vereinsrekord');
      } else {
        if (gesamtM) { parts.push('Vereinsrekord'); }
        else if (_mhnLabel) parts.push('Bestleistung Männer');
        if (gesamtW) { parts.push('Vereinsrekord'); }
        else if (_whnLabel) parts.push('Bestleistung Frauen');
      }
      var showMHK = hasMHK && !gesamtM && !gesamtAll;
      var showWHK = hasWHK && !gesamtW && !gesamtAll;
      if (akM.length || showMHK) {
        var mStr = akM.length ? compressAKList(akM) : '';
        parts.push('Bestleistung ' + (showMHK && mStr ? 'MHK, ' + mStr : showMHK ? 'MHK' : mStr));
      }
      if (akW.length || showWHK) {
        var wStr = akW.length ? compressAKList(akW) : '';
        parts.push('Bestleistung ' + (showWHK && wStr ? 'WHK, ' + wStr : showWHK ? 'WHK' : wStr));
      }
      var sentence = parts.join(' und ');
      if (!sentence) continue;
      var lineClass = gesamt ? 'badge badge-gold' : 'badge badge-silver';
      if (!groupMap[sentence]) { groupMap[sentence] = { lineClass: lineClass, disz: [], isGold: gesamt }; groupOrder.push(sentence); }
      groupMap[sentence].disz.push({name: hDiszName, mid: hMappingId});
    }
    groupOrder.sort(function(a, b) { return (groupMap[b].isGold ? 1 : 0) - (groupMap[a].isGold ? 1 : 0); });
    for (var gi = 0; gi < groupOrder.length; gi++) {
      var gKey = groupOrder[gi], gData = groupMap[gKey], dl = gData.disz;
      var diszStr = dl.length === 1 ? diszMitKat(dl[0].name, dl[0].mid) : dl.slice(0, -1).map(function(d) { return diszMitKat(d.name, d.mid); }).join(', ') + ' und ' + diszMitKat(dl[dl.length - 1].name, dl[dl.length - 1].mid);
      badgesHtml += '<span class="' + gData.lineClass + '" style="display:inline-block;margin:2px 3px 2px 0;font-size:11px;line-height:1.4">' + gKey + ' über ' + diszStr + '</span>';
    }
  }

  var ergBadge = '';
  if (!hasVrOrBl) {
    var anz = parseInt(a.anz_ergebnisse) || 0;
    ergBadge = '<span class="badge badge-pb" style="display:inline-block;margin:2px 3px 2px 0;font-size:11px;line-height:1.4">' + anz + ' ' + (anz === 1 ? 'Ergebnis' : 'Ergebnisse') + '</span>';
  }

  return '<div style="background:var(--surface);text-align:center;padding:24px 14px;cursor:pointer;transition:background .15s" ' +
    'onmouseover="this.style.background=\'var(--surf2)\'" onmouseout="this.style.background=\'var(--surface)\'" ' +
    'onclick="openAthletById(' + a.id + ')">' +
    '<div style="display:flex;justify-content:center;margin-bottom:12px">' + av + '</div>' +
    '<div style="font-weight:700;font-size:14px;margin-bottom:2px"><span class="athlet-link">' + displayName + '</span></div>' +
    statsHtml +
    (letzteAkt ? '<div style="font-size:11px;color:var(--text2);margin-bottom:4px">Letztes Ergebnis: ' + letzteAkt + '</div>' : '') +
    (badgesHtml || ergBadge ? '<div style="display:flex;flex-wrap:wrap;justify-content:center;gap:2px' + (!statsHtml && !letzteAkt ? ';margin-top:6px' : '') + '">' + badgesHtml + ergBadge + '</div>' : '') +
  '</div>';
}

async function renderAthletenKarten() {
  var el = document.getElementById('main-content');
  el.innerHTML = '<div class="loading"><div class="spinner"></div>Laden&hellip;</div>';

  var results = await Promise.all([apiGet('athleten'), apiGet('hall-of-fame?merge_ak=1'), apiGet('athleten-aktivitaet')]);
  var rA = results[0], rH = results[1], rAkt = results[2];
  if (!rA || !rA.ok) { el.innerHTML = '<div class="panel" style="padding:32px;text-align:center;color:var(--text2)">Fehler beim Laden.</div>'; return; }

  var jetzt = new Date().getFullYear();
  var aktMap = (rAkt && rAkt.ok) ? rAkt.data : {};
  var hofData = (rH && rH.ok) ? (rH.data || []) : [];

  var hofMap = {};
  for (var i = 0; i < hofData.length; i++) hofMap[hofData[i].id] = hofData[i];

  // Nur Athleten mit mindestens 1 registriertem Ergebnis
  var alleAthleten = (rA.data || []).filter(function(a) { return parseInt(a.anz_ergebnisse) >= 1; });

  alleAthleten.sort(function(a, b) {
    return (a.nachname || '').localeCompare(b.nachname || '', 'de') || (a.vorname || '').localeCompare(b.vorname || '', 'de');
  });

  if (!alleAthleten.length) {
    el.innerHTML = '<div class="panel"><div class="empty"><div class="empty-icon">&#x1F464;</div><div class="empty-text">Keine Athleten gefunden.</div></div></div>';
    return;
  }

  // Aufteilen: aktiv = Ergebnis in diesem oder letztem Jahr
  var aktiveAthleten = [], inaktiveAthleten = [];
  for (var ci = 0; ci < alleAthleten.length; ci++) {
    var a = alleAthleten[ci];
    var letzteAkt = aktMap[a.id] || aktMap[String(a.id)] || 0;
    if (letzteAkt >= jetzt - 1) {
      aktiveAthleten.push(a);
    } else if (hofMap[a.id]) {
      // Inaktiv aber mit aktuellen Vereinsrekorden oder Bestleistungen
      inaktiveAthleten.push(a);
    }
  }

  var gridStyle = 'display:grid;grid-template-columns:repeat(5,1fr);gap:1px;background:var(--border);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden';

  function buildSection(title, athletes, showLetzteAkt) {
    if (!athletes.length) return '';
    var cards = '';
    for (var si = 0; si < athletes.length; si++) {
      var _a = athletes[si];
      var _letzteAkt = showLetzteAkt ? (aktMap[_a.id] || aktMap[String(_a.id)] || 0) : 0;
      cards += _buildAthletCard(_a, hofMap[_a.id], _letzteAkt);
    }
    return '<div style="font-weight:700;font-size:15px;margin:16px 0 10px;color:var(--text)">' + title + ' <span style="font-size:13px;font-weight:400;color:var(--text2)">(' + athletes.length + ')</span></div>' +
      '<div style="' + gridStyle + '">' + cards + '</div>';
  }

  el.innerHTML =
    buildSection('Aktive Athleten', aktiveAthleten, false) +
    buildSection('Inaktive Athleten mit bestehenden Bestleistungen', inaktiveAthleten, true) +
    '<div id="athleten-wettkampf-chart" style="margin-top:24px"><div class="loading" style="padding:16px"><div class="spinner"></div>Lade Statistik&hellip;</div></div>' +
    '<style>@media(max-width:900px){#main-content>div[style*="repeat(5"]{grid-template-columns:repeat(3,1fr)!important}}' +
    '@media(max-width:560px){#main-content>div[style*="repeat(5"]{grid-template-columns:repeat(2,1fr)!important}}</style>';

  _loadWettkampfChart();
}

async function _loadWettkampfChart() {
  var el = document.getElementById('athleten-wettkampf-chart');
  if (!el) return;
  var r = await apiGet('athleten-wettkampfe-pro-jahr');
  if (!r || !r.ok) { el.innerHTML = ''; return; }
  var athleten = r.data;
  if (!athleten || !athleten.length) { el.innerHTML = ''; return; }

  // Balken-Skalierung auf dem Ø-Wert (= Ranking-Basis)
  var maxAvg = athleten[0].avg || 1;

  var html =
    '<div style="font-weight:700;font-size:15px;margin:0 0 2px;color:var(--text)">&#x1F3C6; Aktivste Athleten der letzten 5 Jahre</div>' +
    '<div style="font-size:12px;color:var(--text2);margin-bottom:14px">mind. 2 Wettkämpfe &middot; Ranking nach Ø Wettkämpfe pro aktivem Jahr</div>';

  var _prevAvg = null, _prevJahre = null, _rankBase = 0;
  for (var i = 0; i < athleten.length; i++) {
    var a = athleten[i];
    var pct = Math.round(a.avg / maxAvg * 100);
    var avgStr = String(a.avg).replace('.', ',');
    var jahrHint = '<span style="opacity:.55;font-size:11px"> (' + a.jahre_aktiv + ' J.)</span>';
    var avgKey = String(a.avg);
    var isTied = (_prevAvg !== null && avgKey === _prevAvg && a.jahre_aktiv === _prevJahre);
    if (!isTied) _rankBase = i + 1;
    _prevAvg = avgKey; _prevJahre = a.jahre_aktiv;
    var rankCell = isTied
      ? '<div style="width:26px;flex-shrink:0"></div>'
      : '<div style="width:26px;text-align:right;color:var(--text2);font-size:12px;flex-shrink:0;font-variant-numeric:tabular-nums">' + _rankBase + '.</div>';
    html +=
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;font-size:13px">' +
        rankCell +
        '<div style="width:130px;min-width:60px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--text);flex-shrink:0;cursor:pointer" onclick="openAthletById(' + a.id + ')">' + a.name + '</div>' +
        '<div style="flex:1;background:var(--surf2);border-radius:3px;overflow:hidden;height:14px">' +
          '<div style="width:' + pct + '%;background:var(--primary);height:100%;border-radius:3px"></div>' +
        '</div>' +
        '<div style="min-width:105px;text-align:right;color:var(--text2);font-size:12px;font-variant-numeric:tabular-nums;flex-shrink:0">' +
          'Ø&thinsp;' + avgStr + '/J.' + jahrHint +
        '</div>' +
      '</div>';
  }

  el.innerHTML = '<div class="panel" style="padding:16px 20px">' + html + '</div>';
}

// ── Athlet-Vollseite ─────────────────────────────────────────────────────────
// Dieselbe Ansicht wie "Meine Ergebnisse" (Engine in 10_veranstaltungen.js),
// fuer fremde Profile und Gaeste mit eingeschraenkten Filter-/Spaltenoptionen.
async function renderAthletDetail(slug) {
  var el = document.getElementById('main-content');
  el.innerHTML = '<div class="loading"><div class="spinner"></div>Laden&hellip;</div>';

  // ID aus State (interne Navigation) oder per Slug-Lookup (Hash-Restore / Direktaufruf)
  // name_nv ist "Nachname, Vorname" → API-suche= trifft nicht; alle laden + client-seitig filtern
  var id = state.athletId || null;
  if (!id && slug) {
    var rList = await apiGet('athleten');
    if (rList && rList.ok && rList.data && rList.data.length) {
      for (var fi = 0; fi < rList.data.length; fi++) {
        if (_athSlug(rList.data[fi].vorname, rList.data[fi].nachname) === slug) { id = rList.data[fi].id; break; }
      }
    }
  }
  if (!id) {
    el.innerHTML = '<div class="panel" style="padding:48px;text-align:center;color:var(--text2)"><div style="font-size:40px;margin-bottom:12px">&#x1F937;</div>Athlet nicht gefunden.</div>';
    return;
  }
  await renderAthletErgebnisse(id);
}
