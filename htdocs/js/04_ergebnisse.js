// ── ERGEBNISSE ─────────────────────────────────────────────
async function renderErgebnisse() {

  if (!state.allDisziplinen) {
    state.allDisziplinen = {};
  }
  await loadErgebnisseData();
}
var _ergSort = { col: 'datum', dir: 'DESC' };
var _ergAthletTimer = null;

function _buildMstrFilterHtml() {
  if (!MSTR_LIST || !MSTR_LIST.length) return '';
  var active = state.filters.meisterschaften || {};  // { id: true }
  var boxes = '';
  for (var i = 0; i < MSTR_LIST.length; i++) {
    var m = MSTR_LIST[i];
    var chk = active[String(m.id)] ? ' checked' : '';
    boxes += '<label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-size:13px;white-space:nowrap">' +
      '<input type="checkbox" value="' + m.id + '"' + chk + ' onchange="_mstrFilterToggle(' + m.id + ',this.checked)">' +
      m.label + '</label>';
  }
  return '<div class="fg" style="min-width:0"><label>Meisterschaften</label>' +
    '<div style="display:flex;flex-wrap:wrap;gap:6px 12px;padding:6px 0">' + boxes + '</div></div>';
}

function _ergExternToggle(val) {
  state.filters.extern_modus = val; // 'aus' | 'mit' | 'nur'
  state.page = 1;
  loadErgebnisseData();
}

function _mstrFilterToggle(id, checked) {
  if (!state.filters.meisterschaften) state.filters.meisterschaften = {};
  if (checked) state.filters.meisterschaften[String(id)] = true;
  else delete state.filters.meisterschaften[String(id)];
  state.page = 1;
  loadErgebnisseData();
}
function _ergAthletFilter(v) {
  clearTimeout(_ergAthletTimer);
  _ergAthletTimer = setTimeout(function() {
    state.filters.athlet = v;
    state.page = 1;
    loadErgebnisseData();
  }, 300);
}

function _ergSetSort(col) {
  if (_ergSort.col === col) {
    _ergSort.dir = _ergSort.dir === 'ASC' ? 'DESC' : 'ASC';
  } else {
    _ergSort.col = col;
    // Ergebnisse standardmäßig absteigend, außer Athlet/Disziplin
    _ergSort.dir = (col === 'athlet' || col === 'disziplin' || col === 'ak') ? 'ASC' : 'DESC';
  }
  state.page = 1;
  loadErgebnisseData();
}

async function loadErgebnisseData() {
  var params = 'limit=' + state.limit + '&offset=' + ((state.page - 1) * state.limit);
  params += '&sort=' + _ergSort.col + '&dir=' + _ergSort.dir;
  for (var k in state.filters) {
    if (k === 'meisterschaften') continue; // separat behandelt
    if (state.filters[k]) params += '&' + k + '=' + encodeURIComponent(state.filters[k]);
  }
  // Meisterschafts-Checkboxen: kommagetrennte IDs
  var mstrIds = Object.keys(state.filters.meisterschaften || {});
  if (mstrIds.length) params += '&meisterschaft=' + encodeURIComponent(mstrIds.join(','));
  var _canSeeExtern = currentUser && currentUser.rechte && currentUser.rechte.indexOf('externe_ergebnisse_sehen') >= 0;
  var _externModus = _canSeeExtern ? (state.filters.extern_modus || 'aus') : 'aus';
  // 'nur': externe Ergebnisse direkt laden ohne Vereinsergebnisse
  var rows, total, r;
  if (_externModus === 'nur') {
    var rExt = await apiGet('externe-ergebnisse?' + params);
    if (!rExt || !rExt.ok) {
      var el = document.getElementById('main-content');
      if (el) el.innerHTML = '<div class="panel" style="padding:24px;color:var(--accent)"><strong>Fehler:</strong> ' + (rExt && rExt.fehler || 'Unbekannt') + '</div>';
      return;
    }
    rows = rExt.data.rows; total = rExt.data.total;
    // Für Dropdowns trotzdem Basisdaten laden
    r = rExt;
  } else {
    r = await apiGet(state.subTab + '?' + params);
    if (!r || !r.ok) {
      var el = document.getElementById('main-content');
      if (el) el.innerHTML = '<div class="panel" style="padding:24px;color:var(--accent)"><strong>Fehler beim Laden der Ergebnisse:</strong><br><code>' + (r && r.fehler ? r.fehler : 'Unbekannter Fehler') + '</code></div>';
      return;
    }
    rows = r.data.rows; total = r.data.total;
    // 'mit': externe Ergebnisse zusätzlich anhängen
    if (_externModus === 'mit') {
      var rExt2 = await apiGet('externe-ergebnisse?' + params);
      if (rExt2 && rExt2.ok && rExt2.data && rExt2.data.rows && rExt2.data.rows.length) {
        rows = rows.concat(rExt2.data.rows);
        total += (rExt2.data.total || 0);
      }
    }
  }
  var disziplinen = r.data.disziplinen || []; var aks = r.data.aks || []; var jahre = r.data.jahre || [];
  var kategorien = r.data.kategorien || [];

  var diszOptHtml = '<option value="">Alle</option>';
  for (var i = 0; i < disziplinen.length; i++) {
    var _d = disziplinen[i];
    var _dVal  = _d.disziplin_mapping_id ? String(_d.disziplin_mapping_id) : _d.disziplin;
    var _dLabel = _d.disziplin + (_d.kategorie_name ? ' (' + _d.kategorie_name + ')' : '');
    var _sel = (state.filters.disziplin_mapping_id === _dVal || state.filters.disziplin === _d.disziplin) ? ' selected' : '';
    diszOptHtml += '<option value="' + _dVal + '"' + _sel + '>' + _dLabel + '</option>';
  }
  var akOptHtml = '<option value="">Alle AK</option>';
  for (var i = 0; i < aks.length; i++) {
    akOptHtml += '<option value="' + aks[i] + '"' + (state.filters.ak === aks[i] ? ' selected' : '') + '>' + aks[i] + '</option>';
  }
  var jahrOptHtml = '<option value="">Alle Jahre</option>';
  for (var i = 0; i < jahre.length; i++) {
    jahrOptHtml += '<option value="' + jahre[i] + '"' + (state.filters.jahr == jahre[i] ? ' selected' : '') + '>' + jahre[i] + '</option>';
  }

  var katOptHtml = '<option value="">Alle Kategorien</option>';
  for (var ki = 0; ki < kategorien.length; ki++) {
    katOptHtml += '<option value="' + kategorien[ki].tbl_key + '"' + (state.filters.kategorie === kategorien[ki].tbl_key ? ' selected' : '') + '>' + kategorien[ki].name + '</option>';
  }

  var canEdit = currentUser && (currentUser.rolle === 'admin' || currentUser.rolle === 'editor');
  var totalPages = Math.ceil(total / state.limit);
  var tableHtml = buildErgebnisseTable(state.subTab, rows, canEdit);

  var _ergFoc = _saveFocus();
  document.getElementById('main-content').innerHTML =
    '<div class="filter-bar">' +
      '<div class="fg"><label>Athlet</label><input type="text" id="erg-athlet-filter" placeholder="Name…" value="' + (state.filters.athlet||'') + '" oninput="_ergAthletFilter(this.value)" style="min-width:0;width:100%"/></div>' +
      '<div class="fg"><label>Kategorie</label><select onchange="setFilter(\'kategorie\',this.value)">' + katOptHtml + '</select></div>' +
      '<div class="fg"><label>Disziplin</label><select onchange="setFilter(\'disziplin_mapping_id\',this.value)">' + diszOptHtml + '</select></div>' +
      '<div class="fg"><label>Altersklasse</label><select onchange="setFilter(\'ak\',this.value)">' + akOptHtml + '</select></div>' +
      '<div class="fg"><label>Jahr</label><select onchange="setFilter(\'jahr\',this.value)">' + jahrOptHtml + '</select></div>' +
      _buildMstrFilterHtml() +
      ((_canSeeExtern = currentUser && currentUser.rechte && currentUser.rechte.indexOf('externe_ergebnisse_sehen') >= 0) ?
        '<div class="fg"><label>Externe Ergebnisse</label>' +
          '<select onchange="_ergExternToggle(this.value)">' +
            '<option value="aus"' + (!state.filters.extern_modus || state.filters.extern_modus === 'aus' ? ' selected' : '') + '>Keine</option>' +
            '<option value="mit"' + (state.filters.extern_modus === 'mit' ? ' selected' : '') + '>Mit externen</option>' +
            '<option value="nur"' + (state.filters.extern_modus === 'nur' ? ' selected' : '') + '>Nur externe</option>' +
          '</select>' +
        '</div>' : '') +
      '<button class="btn btn-ghost btn-sm" onclick="clearFilters()">&#x21BA; Reset</button>' +
    '</div>' +
    '<div class="panel">' +
      '<div class="panel-header"><div class="panel-title">' + (state.diszFilter || 'Alle Ergebnisse') + '</div><div class="panel-count">' + total + ' Ergebnisse</div></div>' +
      '<div class="table-scroll">' + tableHtml + '</div>' +
      buildPagination(state.page, totalPages, total) +
    '</div>';

  _restoreFocus(_ergFoc);

  // Event-Delegation für Edit + Delete (muss nach DOM-Insertion passieren)
  var tbl = document.getElementById('ergebnisse-table');
  if (tbl) {
    tbl.addEventListener('click', function(e) {
      var editBtn = e.target.closest('[data-edit-id]');
      var delBtn  = e.target.closest('[data-del-id]');
      if (editBtn) {
        openEditErgebnis(
          editBtn.dataset.editId,
          editBtn.dataset.editTab,
          editBtn.dataset.editDisz,
          editBtn.dataset.editRes,
          editBtn.dataset.editAk,
          editBtn.dataset.editAkp,
          editBtn.dataset.editMstr,
          editBtn.dataset.editFmt,
          editBtn.dataset.editAthletId,
          editBtn.dataset.editAthletName,
          editBtn.dataset.editMappingId,
          editBtn.dataset.editMstrPlatz
        );
      }
      if (delBtn) deleteErgebnis(delBtn.dataset.delTab, delBtn.dataset.delId);
      // Externe Ergebnisse
      var extEditBtn = e.target.closest('[data-ext-edit-id]');
      var extDelBtn  = e.target.closest('[data-ext-del-id]');
      if (extEditBtn) openEditExternErgebnis(extEditBtn.dataset);
      if (extDelBtn)  deleteExternErgebnis(extDelBtn.dataset.extDelId);
    });
  }
}

function buildErgebnisseTable(subTab, rows, canEdit) {
  if (!rows.length) return '<div class="empty"><div class="empty-icon">&#x1F50D;</div><div class="empty-text">Keine Ergebnisse gefunden</div></div>';
  var headers = ['Datum','Athlet*in','AK','Disziplin','Ergebnis'];
  var hasPace = (subTab === 'strasse' || subTab === 'mittelstrecke' || subTab === 'sprint');
  if (hasPace) headers.push('Pace /km');
  headers.push('Platz AK');
  if (subTab !== 'mittelstrecke') { headers.push('Meisterschaft'); headers.push('Platz MS'); }
  headers.push('Veranstaltung');
  if (canEdit) headers.push('Eingetragen von');
  if (canEdit) headers.push('');

  // Sortierbare Spalten: key → API-sort-Parameter
  var sortKeys = { 'Datum': 'datum', 'Athlet*in': 'athlet', 'AK': 'ak', 'Disziplin': 'disziplin', 'Ergebnis': 'resultat', 'Platz AK': 'platz' };
  var thead = '<tr>';
  for (var i = 0; i < headers.length; i++) {
    var sk = sortKeys[headers[i]];
    if (sk) {
      var arrow = _ergSort.col === sk ? (_ergSort.dir === 'ASC' ? ' ▲' : ' ▼') : '';
      var active = _ergSort.col === sk ? ';color:var(--primary)' : '';
      thead += '<th style="cursor:pointer;user-select:none;white-space:nowrap' + active + '" onclick="_ergSetSort(\'' + sk + '\')">'+headers[i]+arrow+'</th>';
    } else {
      thead += '<th>' + headers[i] + '</th>';
    }
  }
  thead += '</tr>';

  var tbody = '';
  for (var i = 0; i < rows.length; i++) {
    var rr = rows[i];
    var ergebnis = (rr.fmt || (subTab === 'sprungwurf' ? 'm' : '')) === 'm' ? fmtMeter(rr.resultat) : fmtTime(rr.resultat, (rr.fmt === 's' || (!rr.fmt && subTab === 'sprint')) ? 's' : undefined);
    var ort = fmtVeranstName(rr);
    var cells =
      '<td class="ort-text">' + formatDate(rr.datum) + '</td>' +
      '<td><span class="athlet-link" onclick="openAthletById(' + rr.athlet_id + ')">' + rr.athlet + '</span>' + (rr.extern ? ' <span style="font-size:10px;color:var(--text2);background:var(--surf2);border-radius:3px;padding:1px 4px">ext.</span>' : '') + '</td>' +
      '<td>' + akBadge(rr.altersklasse) + '</td>' +
      '<td class="disziplin-text">' + (rr.disziplin_mapping_id ? ergDiszLabel(rr) : diszMitKat(rr.disziplin)) + '</td>' +
      '<td class="result">' + ergebnis + '</td>';
    var paceVal = diszKm(rr.disziplin) >= 1 ? calcPace(rr.disziplin, rr.resultat) : '';
    if (hasPace) cells += '<td class="ort-text">' + (paceVal ? fmtTime(paceVal, 'min/km') : '') + '</td>';
    cells += '<td>' + medalBadge(rr.ak_platzierung) + '</td>';
    if (subTab !== 'mittelstrecke') {
      cells += '<td>' + (rr.meisterschaft ? mstrBadge(rr.meisterschaft) : '') + '</td>';
      cells += '<td class="ort-text" style="font-size:12px">' + (rr.meisterschaft && rr.ak_platz_meisterschaft ? medalBadge(rr.ak_platz_meisterschaft) : '') + '</td>';
    }
    var ortCell;
    if (rr.extern) {
      if (rr.verknuepfte_serie_id) {
        // Verlinkt mit einer Serie → klickbarer Link
        ortCell = '<td class="ort-text">' +
          '<span class="athlet-link" style="font-size:12px" onclick="_openSerieFromErg(' + rr.verknuepfte_serie_id + ')" title="In Regelmäßigen Veranstaltungen öffnen">' +
            '&#x1F517; ' + (rr.verknuepfte_veranstaltung_name || rr.veranstaltung || '') +
          '</span>' +
        '</td>';
      } else {
        // Freies Ergebnis – nicht in einer Serie
        ortCell = '<td class="ort-text"><span style="font-size:11px;color:var(--text2);background:var(--surf2);border:1px solid var(--border);border-radius:4px;padding:1px 6px" title="Nicht mit einer regelmäßigen Veranstaltung verknüpft">frei</span>' +
          (rr.veranstaltung ? ' <span style="font-size:12px;color:var(--text2)">' + rr.veranstaltung + '</span>' : '') +
        '</td>';
      }
    } else {
      ortCell = '<td class="ort-text">' + ort + '</td>';
    }
    cells += ortCell;
    if (canEdit) cells += '<td class="ort-text">' + (rr.extern ? (rr.eingetragen_von || '–') : (rr.eingetragen_von || 'Excel-Import')) + '</td>';
    if (canEdit) {
      if (rr.extern) {
        // Externes Ergebnis: eigene Edit/Delete Buttons
        cells +=
          '<td style="white-space:nowrap">' +
            '<button class="btn btn-ghost btn-sm" style="margin-right:4px" data-ext-edit-id="' + rr.id + '" data-ext-disz="' + (rr.disziplin||'').replace(/"/g,'&quot;') + '" data-ext-res="' + (rr.resultat||'') + '" data-ext-ak="' + (rr.altersklasse||'') + '" data-ext-wettkampf="' + (rr.veranstaltung||'').replace(/"/g,'&quot;') + '" data-ext-datum="' + (rr.datum||'').slice(0,10) + '" data-ext-athlet-id="' + (rr.athlet_id||'') + '">&#x270E;</button>' +
            '<button class="btn btn-danger btn-sm" data-ext-del-id="' + rr.id + '">&#x2715;</button>' +
          '</td>';
      } else {
        cells +=
          '<td style="white-space:nowrap">' +
            '<button class="btn btn-ghost btn-sm" style="margin-right:4px" data-edit-id="' + rr.id + '" data-edit-tab="' + subTab + '" data-edit-disz="' + (rr.disziplin||'') + '" data-edit-mapping-id="' + (rr.disziplin_mapping_id||'') + '" data-edit-res="' + (rr.resultat||'') + '" data-edit-ak="' + (rr.altersklasse||'') + '" data-edit-akp="' + (rr.ak_platzierung||'') + '" data-edit-mstr="' + (rr.meisterschaft||'') + '" data-edit-mstr-platz="' + (rr.ak_platz_meisterschaft||'') + '" data-edit-fmt="' + (rr.fmt||'') + '" data-edit-athlet-id="' + (rr.athlet_id||'') + '" data-edit-athlet-name="' + (rr.athlet||'').replace(/"/g,'&quot;') + '">&#x270E;</button>' +
            '<button class="btn btn-danger btn-sm" data-del-id="' + rr.id + '" data-del-tab="' + subTab + '">&#x2715;</button>' +
          '</td>';
      }
    }
    tbody += '<tr' + (rr.extern ? ' style="opacity:.75"' : '') + (rr.meisterschaft ? ' class="champ-row"' : '') + '>' + cells + '</tr>';
  }
  return '<table id="ergebnisse-table"><thead>' + thead + '</thead><tbody>' + tbody + '</tbody></table>';
}

var _editAthletTimer = null;
function _editAthletSearch(val) {
  clearTimeout(_editAthletTimer);
  var box = document.getElementById('edit-athlet-suggestions');
  if (!box) return;
  if (!val || val.length < 2) { box.innerHTML = ''; return; }
  _editAthletTimer = setTimeout(async function() {
    var r = await apiGet('autocomplete/athleten?q=' + encodeURIComponent(val));
    if (!r || !r.ok) return;
    var items = r.data || [];
    if (!items.length) { box.innerHTML = '<div style="padding:6px 10px;color:var(--text2);font-size:13px">Keine Treffer</div>'; return; }
    var html = '<div style="position:absolute;z-index:100;background:var(--surface);border:1px solid var(--border);border-radius:8px;box-shadow:var(--shadow);width:100%;max-height:200px;overflow-y:auto;margin-top:2px">';
    for (var i = 0; i < items.length; i++) {
      var a = items[i];
      html += '<div style="padding:8px 12px;cursor:pointer;font-size:14px;border-bottom:1px solid var(--border)" onmousedown="_editAthletPick(' + a.id + ',\'' + (a.name_nv||'').replace(/'/g, "\\'") + '\')">' + a.name_nv + '</div>';
    }
    html += '</div>';
    box.innerHTML = html;
  }, 200);
}
function _editAthletPick(id, name) {
  var inp = document.getElementById('edit-athlet-name');
  var hid = document.getElementById('edit-athlet-id');
  var box = document.getElementById('edit-athlet-suggestions');
  if (inp) inp.value = name;
  if (hid) hid.value = id;
  if (box) box.innerHTML = '';
}

async function openEditErgebnis(id, subTab, disz, res, ak, akp, mstr, fmt, athletId, athletName, mappingId, mstrPlatz) {
  mstr = parseInt(mstr, 10) || '';
  // Kategorie aus der Disziplin des Ergebnisses ableiten
  var _diszKat = '';
  if (mappingId) {
    var _diszMatch = (state.disziplinen || []).find(function(d) { return d.id == mappingId; });
    if (_diszMatch) _diszKat = _diszMatch.tbl_key || '';
  }
  // Fallback: subTab (aktueller Ergebnisse-Tab)
  var _activeKat = _diszKat || subTab || '';
  // Kategorie-Optionen aufbauen
  var katSeen = {}, katOpts = '<option value="">Alle Kategorien</option>';
  (state.disziplinen || []).forEach(function(d) {
    if (d.tbl_key && !katSeen[d.tbl_key]) {
      katSeen[d.tbl_key] = true;
      var sel = d.tbl_key === _activeKat ? ' selected' : '';
      katOpts += '<option value="' + d.tbl_key + '"' + sel + '>' + d.kategorie + '</option>';
    }
  });

  function buildEditDiszOpts(filterKat) {
    var diszObjs = (state.disziplinen || [])
      .filter(function(d) { return !filterKat || d.tbl_key === filterKat; });
    // Deduplizieren nach mapping_id (bevorzugt) oder disziplin
    var seen = {}, list = [];
    diszObjs.forEach(function(d) {
      var key = d.id ? String(d.id) : d.disziplin;
      if (!seen[key]) { seen[key] = true; list.push(d); }
    });
    list.sort(function(a,b){ return diszSortKey(a.disziplin) - diszSortKey(b.disziplin) || a.disziplin.localeCompare(b.disziplin); });
    var html = '', found = false;
    for (var i = 0; i < list.length; i++) {
      var d = list[i];
      // value = mapping_id (für eindeutige Identifikation von 800m Bahn vs Straße)
      var val = d.id ? String(d.id) : d.disziplin;
      // Label mit Kategorie-Suffix via diszMitKat
      var label = diszMitKat(d.disziplin, d.id);
      // Auswahl: mapping_id oder disziplin-Fallback
      var isSel = (mappingId && val === String(mappingId)) ||
                  (!mappingId && d.disziplin === disz && !found);
      if (isSel) found = true;
      html += '<option value="' + val + '"' + (isSel ? ' selected' : '') + '>' + label + '</option>';
    }
    if (!found && disz) html = '<option value="' + (mappingId||disz) + '" selected>' + diszMitKat(disz, mappingId) + '</option>' + html;
    return html;
  }
  var diszOptHtml = buildEditDiszOpts(subTab);

  var isAdmin = currentUser && currentUser.rolle === 'admin';
  var athletSelectHtml = '';
  if (isAdmin) {
    var rAth = await apiGet('athleten');
    var athList = (rAth && rAth.ok) ? rAth.data : [];
    var opts = '';
    for (var ai = 0; ai < athList.length; ai++) {
      var sel = String(athList[ai].id) === String(athletId) ? ' selected' : '';
      opts += '<option value="' + athList[ai].id + '"' + sel + '>' + athList[ai].name_nv + '</option>';
    }
    athletSelectHtml = '<div class="form-group full"><label>Athlet*in</label><select id="edit-athlet-id" style="width:100%;padding:9px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text)">' + opts + '</select></div>';
  }
  var html =
    '<h3 style="margin:0 0 20px;font-size:17px">Ergebnis bearbeiten</h3>' +
    '<div class="form-grid">' +
      athletSelectHtml +
      '<div class="form-group full">' +
        '<div style="display:flex;gap:8px;align-items:flex-end;margin-bottom:6px">' +
          '<div style="flex:0 0 auto">' +
            '<label style="display:block;margin-bottom:4px">Kategorie</label>' +
            '<select id="edit-kat" onchange="editKatChanged()" style="padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text);font-size:13px">' + katOpts + '</select>' +
          '</div>' +
          '<div style="flex:1">' +
            '<label style="display:block;margin-bottom:4px">Disziplin *</label>' +
            '<select id="edit-disz" style="width:100%;padding:9px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text)">' + diszOptHtml + '</select>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="form-group"><label>Ergebnis</label><input type="text" id="edit-res" value="' + fmtRes(res||'') + '" placeholder="z.B. 01:45:30"/></div>' +
      '<div class="form-group"><label>Altersklasse</label><input type="text" id="edit-ak" value="' + (ak||'') + '" placeholder="z.B. M40"/></div>' +
      '<div class="form-group"><label>Platz AK</label><input type="number" id="edit-akp" value="' + (akp||'') + '" min="1"/></div>' +
      '<div class="form-group"><label>Meisterschaft</label><select id="edit-mstr">' + mstrOptions(mstr) + '</select></div>' +
      '<div class="form-group"><label>Platz MS</label><input type="number" id="edit-mstr-platz" value="' + (mstrPlatz||'') + '" min="1" placeholder="–"/></div>' +
    '</div>' +
    '<div style="display:flex;gap:10px;margin-top:20px;justify-content:flex-end">' +
      '<button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button>' +
      '<button class="btn btn-primary" id="edit-save-btn">&#x1F4BE; Speichern</button>' +
    '</div>';

  showModal(html);

  document.getElementById('edit-save-btn').addEventListener('click', function() {
    saveEditErgebnis(id, subTab);
  });
}

async function saveEditErgebnis(id, subTab) {
  var editDiszVal = (document.getElementById('edit-disz') || {}).value || '';
  // Prüfen ob value eine mapping_id (numerisch) oder Disziplinname ist
  var editMappingId = /^\d+$/.test(editDiszVal) ? parseInt(editDiszVal) : null;
  var disz = editMappingId
    ? ((state.disziplinen||[]).find(function(d){return d.id===editMappingId;})||{}).disziplin || editDiszVal
    : editDiszVal;
  var res  = dbRes(((document.getElementById('edit-res') || {}).value || '').trim());
  var ak   = ((document.getElementById('edit-ak') || {}).value || '').trim();
  var akp  = ((document.getElementById('edit-akp') || {}).value || '').trim();
  var mstr = ((document.getElementById('edit-mstr') || {}).value || '').trim();
  var mstrPlatz = ((document.getElementById('edit-mstr-platz') || {}).value || '').trim();
  if (!disz || !res) { notify('Disziplin und Ergebnis sind Pflicht!', 'err'); return; }
  // Unbekannte AK prüfen
  if (ak && !isValidDlvAK(ak)) {
    var _akMap = {}; _akMap[ak] = null;
    var _resolved = await rrUnknownAKModal(_akMap);
    if (!_resolved) return;
    ak = _resolved[ak] || ak;
  }
  var newAthletId = ((document.getElementById('edit-athlet-id') || {}).value || '').trim();
  var body = { disziplin: disz, resultat: res, altersklasse: ak, pace: calcPace(disz, res) };
  if (editMappingId) body.disziplin_mapping_id = editMappingId;
  if (akp)  body.ak_platzierung = parseInt(akp);
  if (mstr) body.meisterschaft = parseInt(mstr);
  body.ak_platz_meisterschaft = mstrPlatz ? parseInt(mstrPlatz) : null;
  if (newAthletId) body.athlet_id = parseInt(newAthletId);
  var r = await apiPut(subTab + '/' + id, body);
  if (r && r.ok) {
    closeModal();
    notify('Ergebnis gespeichert.', 'ok');
    loadErgebnisseData();
  } else {
    notify((r && r.fehler) ? r.fehler : 'Fehler beim Speichern', 'err');
  }
}

// ── ATHLETEN ───────────────────────────────────────────────


function editKatChanged() {
  var kat = (document.getElementById('edit-kat') || {}).value || '';
  var diszSel = document.getElementById('edit-disz');
  if (!diszSel) return;
  var prevVal = diszSel.value; // mapping_id oder disziplin-name
  var seen = {}, list = [];
  (state.disziplinen || [])
    .filter(function(d) { return !kat || (bkKatMitGruppen(kat)||[kat]).indexOf(d.tbl_key) >= 0; })
    .forEach(function(d) {
      var key = d.id ? String(d.id) : d.disziplin;
      if (!seen[key]) { seen[key] = true; list.push(d); }
    });
  list.sort(function(a,b){ return diszSortKey(a.disziplin) - diszSortKey(b.disziplin) || a.disziplin.localeCompare(b.disziplin); });
  var html = '';
  for (var i = 0; i < list.length; i++) {
    var d = list[i];
    var val = d.id ? String(d.id) : d.disziplin;
    var label = diszMitKat(d.disziplin, d.id);
    html += '<option value="' + val + '"' + (val === prevVal ? ' selected' : '') + '>' + label + '</option>';
  }
  diszSel.innerHTML = html;
}


// ── Externe Ergebnisse: Edit + Delete ────────────────────────────────────────
function openEditExternErgebnis(ds) {
  showModal(
    '<h2>&#x270E; Externes Ergebnis bearbeiten <button class="modal-close" onclick="closeModal()">&#x2715;</button></h2>' +
    '<div class="form-grid">' +
      '<div class="form-group"><label>Disziplin</label><input type="text" id="ext-disz" value="' + (ds.extDisz||'').replace(/"/g,'&quot;') + '"/></div>' +
      '<div class="form-group"><label>Ergebnis</label><input type="text" id="ext-res" value="' + (ds.extRes||'') + '"/></div>' +
      '<div class="form-group"><label>Altersklasse</label><input type="text" id="ext-ak" value="' + (ds.extAk||'') + '" placeholder="z.B. M40"/></div>' +
      '<div class="form-group"><label>Datum</label><input type="date" id="ext-datum" value="' + (ds.extDatum||'') + '"/></div>' +
      '<div class="form-group full"><label>Wettkampf</label><input type="text" id="ext-wettkampf" value="' + (ds.extWettkampf||'').replace(/"/g,'&quot;') + '"/></div>' +
    '</div>' +
    '<div class="modal-actions">' +
      '<button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button>' +
      '<button class="btn btn-primary" onclick="_saveExternErgebnis(' + ds.extEditId + ')">Speichern</button>' +
    '</div>'
  );
}

async function _saveExternErgebnis(id) {
  var body = {
    disziplin:  (document.getElementById('ext-disz')     || {}).value || '',
    resultat:   (document.getElementById('ext-res')      || {}).value || '',
    altersklasse: (document.getElementById('ext-ak')     || {}).value || null,
    datum:      (document.getElementById('ext-datum')    || {}).value || null,
    wettkampf:  (document.getElementById('ext-wettkampf')|| {}).value || '',
  };
  var r = await apiPut('externe-ergebnisse/' + id, body);
  if (r && r.ok) { closeModal(); notify('Gespeichert.', 'ok'); loadErgebnisseData(); }
  else notify('\u274C ' + ((r&&r.fehler)||'Fehler'), 'err');
}

function deleteExternErgebnis(id) {
  showModal(
    '<h2>Externes Ergebnis löschen <button class="modal-close" onclick="closeModal()">&#x2715;</button></h2>' +
    '<p style="font-size:14px;color:var(--text2);margin:8px 0 20px">Dieses externe Ergebnis wirklich löschen?</p>' +
    '<div class="modal-actions">' +
      '<button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button>' +
      '<button class="btn btn-danger" onclick="_doDeleteExternErgebnis(' + id + ')">Löschen</button>' +
    '</div>'
  );
}

async function _doDeleteExternErgebnis(id) {
  closeModal();
  var r = await apiDel('externe-ergebnisse/' + id);
  if (r && r.ok) { notify('Gelöscht.', 'ok'); loadErgebnisseData(); }
  else notify('\u274C ' + ((r&&r.fehler)||'Fehler'), 'err');
}

function _openSerieFromErg(serieId) {
  state.tab = 'veranstaltungen';
  state.veranstView = 'serie-detail';
  state.serieId = serieId;
  renderPage();
}
