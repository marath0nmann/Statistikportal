// ── VERANSTALTUNGEN ────────────────────────────────────────

var setVeranstSuche = debounce(function(val) {
  state.veranstSuche = (val||'').trim();
  state.veranstPage = 1;
  renderVeranstaltungen();
}, 300);

// state.veranstView    = 'liste' | 'serie-detail'
// state.veranstSubTab  = 'serien' | 'letzte' | 'meine'
// state.serieId        = ID der aktuell angezeigten Serie
// state.serieView      = 'jahre' | 'bestleistungen'
// state.serieDisz      = aktuell gewählte Disziplin im Bestleistungen-View
// state.serieMappingId = mapping_id der Disziplin

function _veranstSubtabs(active) {
  var hasMeine = !!(currentUser && currentUser.athlet_id);
  function btn(id, label) {
    return '<button class="subtab' + (active === id ? ' active' : '') + '" onclick="navVeranstTab(\'' + id + '\')">' + label + '</button>';
  }
  return '<div class="subtabs" style="margin-bottom:20px">' +
    btn('serien',  '🔄 Regelmäßige Veranstaltungen') +
    btn('letzte',  '📅 Letzte Veranstaltungen') +
    (hasMeine ? btn('meine', '🏃 Meine Veranstaltungen') : '') +
  '</div>';
}

function navVeranstTab(tab) {
  state.veranstSubTab = tab;
  state.veranstPage   = 1;
  state.veranstSuche  = '';
  renderVeranstaltungen();
}

function switchVeranstView(to) {
  // Compat: 'serien' → Sub-Tab wechseln, nicht separate View
  if (to === 'serien') { navVeranstTab('serien'); return; }
  state.veranstView = to;
  renderVeranstaltungen();
}

async function renderVeranstaltungen() {
  if ((state.veranstView || 'liste') === 'serie-detail') { await renderSerieDetail(state.serieId); return; }
  var el = document.getElementById('main-content');
  var tab = state.veranstSubTab || 'letzte';

  // Äußere Shell einmalig aufbauen
  if (!document.getElementById('veranst-subtabs')) {
    el.innerHTML = '<div id="veranst-subtabs"></div><div id="veranst-view"></div>';
  }
  document.getElementById('veranst-subtabs').innerHTML = _veranstSubtabs(tab);

  if      (tab === 'serien') await _renderVeranstSerien();
  else if (tab === 'meine')  await renderMeineVeranstaltungen();
  else                       await renderVeranstaltungenListe();
}

function _buildVeranstErgTable(ergebnisse) {
  if (!ergebnisse || !ergebnisse.length) {
    return '<div class="empty" style="padding:16px">Keine Ergebnisse</div>';
  }
  var byDisz = {}; var diszOrder = [];
  for (var ei = 0; ei < ergebnisse.length; ei++) {
    var e = ergebnisse[ei];
    var _dk = ergDiszKey(e);
    if (!byDisz[_dk]) { byDisz[_dk] = []; diszOrder.push(_dk); }
    byDisz[_dk].push(e);
  }
  var hasMstr = ergebnisse.some(function(e) { return !!e.meisterschaft; });
  sortDisziplinen(diszOrder);
  var rows = '';
  for (var di = 0; di < diszOrder.length; di++) {
    var _dKey = diszOrder[di];
    var _df = byDisz[_dKey][0];
    var diszLabel = _df ? ergDiszLabel(_df) : _dKey;
    var ergs = byDisz[_dKey];
    rows += '<tr class="disz-header-row"><td colspan="' + (hasMstr ? '7' : '5') + '" class="disziplin-text" style="background:var(--surf2);font-weight:600;padding:6px 12px">' + diszLabel + '</td></tr>';
    for (var ei2 = 0; ei2 < ergs.length; ei2++) {
      var e2 = ergs[ei2];
      var fmt = e2.fmt || '';
      var res = fmt === 'm' ? fmtMeter(e2.resultat) : fmtTime(e2.resultat, fmt === 's' ? 's' : (fmt === 'min_h' ? 'min_h' : undefined));
      var _ePace = diszKm(e2.disziplin) >= 1 ? calcPace(e2.disziplin, e2.resultat) : '';
      var showPace = _ePace && _ePace !== '00:00' && fmt !== 'm' && fmt !== 's';
      rows +=
        '<tr>' +
          '<td><span class="athlet-link" onclick="openAthletById(' + e2.athlet_id + ')">' + e2.athlet + '</span>' + (e2.extern ? ' <span title="Externes Ergebnis" style="font-size:10px;color:var(--text2);opacity:.7">(ext.)</span>' : '') + '</td>' +
          '<td>' + akBadge(e2.altersklasse) + '</td>' +
          '<td class="result">' + res + '</td>' +
          '<td class="ort-text">' + (showPace ? fmtTime(_ePace, 'min/km') : '') + '</td>' +
          '<td>' + medalBadge(e2.ak_platzierung) + '</td>' +
          (hasMstr ? '<td>' + mstrBadge(e2.meisterschaft) + '</td>' : '') +
          (hasMstr ? '<td class="ort-text" style="font-size:12px">' + (e2.meisterschaft && e2.ak_platz_meisterschaft ? medalBadge(e2.ak_platz_meisterschaft) : '') + '</td>' : '') +
        '</tr>';
    }
  }
  return '<div class="table-scroll"><table class="veranst-dash-table">' +
    '<colgroup><col class="vcol-athlet"><col class="vcol-ak"><col class="vcol-result"><col class="vcol-pace"><col class="vcol-platz">' + (hasMstr ? '<col class="vcol-ms"><col class="vcol-ms-platz">' : '') + '</colgroup>' +
    '<thead><tr><th>Athlet*in</th><th>AK</th><th>Ergebnis</th><th>Pace</th><th>Pl. AK</th>' + (hasMstr ? '<th>Meisterschaft</th><th>Pl. MS</th>' : '') + '</tr></thead>' +
    '<tbody>' + rows + '</tbody>' +
    '</table></div>';
}

// ── LETZTE VERANSTALTUNGEN ─────────────────────────────────
async function renderVeranstaltungenListe() {
  var viewEl = document.getElementById('veranst-view');
  if (!viewEl) return;

  // Shell (Suchfeld) nur einmalig rendern – nie beim Suchen ersetzen
  var shellEl = document.getElementById('veranst-shell');
  if (!shellEl) {
    viewEl.innerHTML =
      '<div id="veranst-shell"></div>' +
      '<div id="veranst-results"><div class="loading"><div class="spinner"></div>Laden&hellip;</div></div>';
    shellEl = document.getElementById('veranst-shell');
  }
  var resultsEl = document.getElementById('veranst-results');
  resultsEl.innerHTML = '<div class="loading"><div class="spinner"></div>Laden&hellip;</div>';

  var sucheParam = state.veranstSuche ? '&suche=' + encodeURIComponent(state.veranstSuche) : '';
  var r = await apiGet('veranstaltungen?limit=10&offset=' + ((state.veranstPage-1)*10) + sucheParam);
  if (!r || !r.ok) {
    resultsEl.innerHTML = '<div class="panel" style="padding:24px;color:var(--accent)"><strong>Fehler:</strong> ' + (r && r.fehler ? r.fehler : 'Unbekannt') + '</div>';
    return;
  }
  var veranst = r.data.veranst || [];
  var total   = r.data.total  || 0;
  var serien  = r.data.serien || [];
  window._lastVeranstList = veranst;
  window._lastSerienList  = serien;
  state._veranstMap = {};
  for (var ci = 0; ci < veranst.length; ci++) state._veranstMap[veranst[ci].id] = veranst[ci];

  // Suchleiste (einmalig)
  if (!shellEl.dataset.built) {
    shellEl.innerHTML = '<div class="filter-bar" style="margin-bottom:16px">' +
      '<div class="fg"><label>Suche</label><input type="search" id="veranst-suche" placeholder="Veranstaltung suchen&hellip;" value="' + (state.veranstSuche || '').replace(/"/g,'&quot;') + '" oninput="setVeranstSuche(this.value)" style="min-width:0;width:100%"/></div>' +
    '</div>';
    shellEl.dataset.built = '1';
  }

  var html = '';
  for (var vi = 0; vi < veranst.length; vi++) {
    var v = veranst[vi];
    var name = v.name || (v.kuerzel || '').split(' ').slice(1).join(' ') || v.kuerzel || '';
    var serieBadge = '';
    if (v.serie_id) {
      var _sv = serien.find(function(s){ return String(s.id) === String(v.serie_id); });
      if (_sv) {
        serieBadge = '<span style="font-size:11px;background:var(--surf2);color:var(--text2);border-radius:10px;padding:2px 8px;cursor:pointer;margin-left:6px" title="Regelmäßige Veranstaltung anzeigen" onclick="event.stopPropagation();openSerieDetail(' + _sv.id + ')">\uD83D\uDD04 ' + _sv.name + '</span>';
      }
    }
    html +=
      '<div class="panel" style="margin-bottom:16px">' +
        '<div class="panel-header">' +
          '<div>' +
            '<div class="panel-title" style="cursor:pointer" onclick="window.open(location.origin+location.pathname+\'#veranstaltung/' + v.id + '\',\'_blank\')">' + name + serieBadge + '</div>' +
            '<div style="font-size:12px;color:var(--text2);margin-top:2px">' + formatDate(v.datum) + (v.ort ? ' &middot; ' + (flagEmoji(v.ort_land_code) ? flagEmoji(v.ort_land_code) + ' ' : '') + v.ort : '') + '</div>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:10px">' +
            '<span style="font-size:13px;color:var(--text2)">' + v.anz_ergebnisse + ' Ergebnisse &middot; ' + v.anz_athleten + ' Athleten</span>' +
            (currentUser && (currentUser.rolle === 'admin' || currentUser.rolle === 'editor') ?
              '<button class="btn btn-ghost btn-sm" onclick="showVeranstEditModal(' + v.id + ')">&#x270F;&#xFE0F;</button>' : '') +
            (v.datenquelle ? '<a href="' + v.datenquelle.replace(/"/g,'&quot;') + '" target="_blank" class="btn btn-ghost btn-sm" title="Ergebnisquelle">\uD83C\uDF10</a>' : '') +
            '<button class="btn btn-ghost btn-sm" title="Teilen" onclick="shareVeranstaltung(' + v.id + ')">\uD83D\uDCE4</button>' +
            (_canVeranstaltungLoeschen() ?
              '<button class="btn btn-danger btn-sm" onclick="deleteVeranstaltung(' + v.id + ',\'' + name.replace(/'/g, "\\'") + '\')">&times;</button>' : '') +
          '</div>' +
        '</div>' +
        _buildVeranstErgTable(v.ergebnisse) +
      '</div>';
  }
  if (!html) html = '<div class="empty"><div class="empty-icon">&#x1F4CD;</div><div class="empty-text">Keine Veranstaltungen gefunden</div></div>';

  // Massen-Zuordnung Button (Admin/Editor, nur bei aktiver Suche mit Ergebnissen)
  var massenbtn = '';
  var canEdit = currentUser && (currentUser.rolle === 'admin' || currentUser.rolle === 'editor');
  if (canEdit && state.veranstSuche && veranst.length > 0) {
    // Nur Veranstaltungen ohne Serie
    var ohneSerieAnz = veranst.filter(function(v) { return !v.serie_id; }).length;
    if (ohneSerieAnz > 0) {
      massenbtn = '<div style="margin-bottom:12px;display:flex;align-items:center;gap:10px">' +
        '<button class="btn btn-ghost btn-sm" onclick="showMassenSerieModal()" style="font-size:13px">' +
          '🔄 Alle ' + ohneSerieAnz + ' Veranstaltung' + (ohneSerieAnz===1?'':'en') + ' ohne Serie zu regelmäßiger Veranstaltung hinzufügen&hellip;' +
        '</button>' +
      '</div>';
    }
  }
  var secStyleR = 'font-family:\'Barlow Condensed\',sans-serif;font-size:16px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text2);margin:0 0 12px';
  var letzteHeading = veranst.length ? '<div style="' + secStyleR + '">📅 Letzte Veranstaltungen</div>' : '';
  resultsEl.innerHTML = massenbtn + letzteHeading + html + buildPagination(state.veranstPage, Math.ceil(total/10), total, 'goPageVeranst');
}

// ── REGELMÄSSIGE VERANSTALTUNGEN (Sub-Tab) ─────────────────
async function _renderVeranstSerien() {
  var viewEl = document.getElementById('veranst-view');
  viewEl.innerHTML = '<div class="loading"><div class="spinner"></div>Laden&hellip;</div>';
  // veranstaltungen?limit=0 liefert leere Veranst-Liste, aber vollständige Serien-Daten
  var r = await apiGet('veranstaltungen?limit=0');
  if (!r || !r.ok) {
    viewEl.innerHTML = '<div class="panel" style="padding:24px;color:var(--accent)">Fehler: ' + (r && r.fehler || 'Unbekannt') + '</div>';
    return;
  }
  var serien = r.data.serien || [];
  window._lastSerienList = serien;
  viewEl.innerHTML = serien.length ? _serienTabelle(serien)
    : '<div class="empty"><div class="empty-icon">🔄</div><div class="empty-text">Noch keine regelmäßigen Veranstaltungen angelegt.</div></div>';
}

// ── MEINE VERANSTALTUNGEN (Sub-Tab) ────────────────────────
async function renderMeineVeranstaltungen() {
  var viewEl = document.getElementById('veranst-view');
  if (!currentUser || !currentUser.athlet_id) {
    viewEl.innerHTML =
      '<div class="empty"><div class="empty-icon">🔒</div>' +
      '<div class="empty-text">Kein Athletenprofil verknüpft.<br>' +
      '<small style="color:var(--text2)">Bitte unter <em>Konto</em> ein Athletenprofil zuordnen.</small></div></div>';
    return;
  }
  viewEl.innerHTML = '<div class="loading"><div class="spinner"></div>Laden&hellip;</div>';

  var r = await apiGet('meine-veranstaltungen');
  if (!r || !r.ok) {
    viewEl.innerHTML = '<div class="panel" style="padding:24px;color:var(--accent)">Fehler: ' + (r && r.fehler || 'Unbekannt') + '</div>';
    return;
  }
  var veranst = r.data || [];
  if (!veranst.length) {
    viewEl.innerHTML = '<div class="empty"><div class="empty-icon">🏃</div>' +
      '<div class="empty-text">Noch keine Wettkämpfe erfasst.</div></div>';
    return;
  }

  // Flache Zeilen-Liste aufbauen (eine Zeile pro Ergebnis)
  var allRows = [];
  for (var vi = 0; vi < veranst.length; vi++) {
    var v = veranst[vi];
    var vName = v.name || (v.kuerzel || '').split(' ').slice(1).join(' ') || v.kuerzel || '';
    var ergs = v.ergebnisse || [];
    for (var ei = 0; ei < ergs.length; ei++) {
      var e = ergs[ei];
      var fmt = e.fmt || 'min';
      var _km = diszKm ? diszKm(e.disziplin) : 0;
      var pace = (_km >= 1 && fmt !== 'm' && fmt !== 's' && calcPace) ? calcPace(e.disziplin, e.resultat) : '';
      allRows.push({
        erg_id:                e.id,
        tbl_key:               e.tbl_key || 'strasse',
        disziplin_mapping_id:  e.disziplin_mapping_id || null,
        veranst_id:            v.id,
        veranst_name:          vName,
        datum:                 v.datum || '',
        ort:                   v.ort || '',
        ort_land_code:         v.ort_land_code || '',
        datenquelle:           v.datenquelle || '',
        serie_id:              v.serie_id || null,
        serie_name:            v.serie_name || '',
        disziplin:             e.disziplin || '',
        altersklasse:          e.altersklasse || '',
        resultat:              e.resultat || '',
        resultat_num:          parseFloat(e.resultat_num) || 0,
        fmt:                   fmt,
        pace:                  pace,
        ak_platzierung:        parseInt(e.ak_platzierung) || 0,
        meisterschaft:         e.meisterschaft || '',
        ak_platz_meisterschaft: parseInt(e.ak_platz_meisterschaft) || 0,
        verein:                e.verein || '',
      });
    }
  }
  window._meinVeranstRows = allRows;
  if (!state.meine) state.meine = { sort: { col: 'datum', dir: 'desc' }, filter: { suche: '', jahr: '', disziplin: '' } };
  _renderMeineTabelle();
}

function _renderMeineTabelle() {
  var viewEl = document.getElementById('veranst-view');
  if (!viewEl || !window._meinVeranstRows) return;

  var allRows = window._meinVeranstRows;
  var sf = state.meine ? state.meine.filter : {};
  var ss = state.meine ? state.meine.sort   : { col: 'datum', dir: 'desc' };
  var ownClub = (appConfig && (appConfig.verein_name || appConfig.verein_kuerzel)) || '';

  // Zeilenindex für Edit-Zugriff
  window._meineTblRowMap = {};
  allRows.forEach(function(r) { window._meineTblRowMap[r.erg_id] = r; });

  // ── Filter ──────────────────────────────────────────────
  var rows = allRows.filter(function(r) {
    if (sf.jahr && r.datum.slice(0, 4) !== sf.jahr) return false;
    if (sf.disziplin && r.disziplin !== sf.disziplin) return false;
    if (sf.suche) {
      var q = sf.suche.toLowerCase();
      if (r.veranst_name.toLowerCase().indexOf(q) < 0 &&
          r.disziplin.toLowerCase().indexOf(q) < 0 &&
          r.ort.toLowerCase().indexOf(q) < 0) return false;
    }
    return true;
  });

  // ── Sortierung ───────────────────────────────────────────
  rows.sort(function(a, b) {
    var av, bv, d = ss.dir === 'asc' ? 1 : -1;
    switch (ss.col) {
      case 'datum':        return d * a.datum.localeCompare(b.datum);
      case 'veranst_name': return d * a.veranst_name.localeCompare(b.veranst_name);
      case 'disziplin':    return d * a.disziplin.localeCompare(b.disziplin);
      case 'altersklasse': return d * a.altersklasse.localeCompare(b.altersklasse);
      case 'resultat':     return d * (a.resultat_num - b.resultat_num);
      case 'ak_platzierung':
        av = a.ak_platzierung || 9999; bv = b.ak_platzierung || 9999;
        return d * (av - bv);
      default: return 0;
    }
  });

  // ── Dropdown-Optionen ────────────────────────────────────
  var jahre = [], jahreSet = {}, diszMap = {}, diszList = [];
  for (var ri = 0; ri < allRows.length; ri++) {
    var yr = allRows[ri].datum.slice(0, 4);
    if (yr && !jahreSet[yr]) { jahreSet[yr] = 1; jahre.push(yr); }
    if (allRows[ri].disziplin && !diszMap[allRows[ri].disziplin]) { diszMap[allRows[ri].disziplin] = 1; diszList.push(allRows[ri].disziplin); }
  }
  jahre.sort(function(a, b) { return b - a; });
  diszList.sort();
  function selOpts(arr, cur) {
    return '<option value="">Alle</option>' +
      arr.map(function(v) { return '<option value="' + v.replace(/"/g,'&quot;') + '"' + (cur === v ? ' selected' : '') + '>' + v + '</option>'; }).join('');
  }

  // ── Sortierpfeil ─────────────────────────────────────────
  function th(col, label, alignRight) {
    var active = ss.col === col;
    var arrow  = active ? ' <span style="color:var(--primary)">' + (ss.dir === 'asc' ? '↑' : '↓') + '</span>'
                        : ' <span style="opacity:.3;font-size:10px">↕</span>';
    var base = 'cursor:pointer;user-select:none;white-space:nowrap;padding:8px 10px;font-size:12px;font-weight:600;color:var(--text2);text-align:' + (alignRight ? 'right' : 'left');
    return '<th style="' + base + '" onclick="_sortMeine(\'' + col + '\')">' + label + arrow + '</th>';
  }

  // Bedingte Spalten (aus Gesamtdaten)
  var hasVerein = allRows.some(function(r) { return !!r.verein; });
  var hasMstr   = allRows.some(function(r) { return !!r.meisterschaft; });

  var td   = 'padding:7px 10px;border-bottom:1px solid var(--border);vertical-align:middle';
  var tdR  = td + ';text-align:right;font-variant-numeric:tabular-nums';
  var tdCb = 'padding:7px 8px 7px 10px;border-bottom:1px solid var(--border);vertical-align:middle;width:32px';

  var tableRows = rows.map(function(r) {
    var fmt = r.fmt;
    var res = fmt === 'm' ? fmtMeter(r.resultat) : fmtTime(r.resultat, fmt === 's' ? 's' : (fmt === 'min_h' ? 'min_h' : undefined));
    var showPace = r.pace && r.pace !== '00:00';
    var ortText  = r.ort ? (r.ort_land_code && flagEmoji ? flagEmoji(r.ort_land_code) + ' ' + r.ort : r.ort) : '';
    var vereinText = r.verein || ownClub;
    return '<tr onmouseover="this.style.background=\'var(--surf2)\'" onmouseout="this.style.background=\'\'">' +
      '<td style="' + tdCb + '">' +
        '<input type="checkbox" class="mv-row-cb" value="' + r.erg_id + '" onchange="_meineRowCbChange()" style="width:14px;height:14px;cursor:pointer">' +
      '</td>' +
      '<td style="' + td + ';white-space:nowrap">' + formatDate(r.datum) + '</td>' +
      '<td style="' + td + ';font-weight:600;cursor:pointer" onclick="window.open(location.origin+location.pathname+\'#veranstaltung/' + r.veranst_id + '\',\'_blank\')">' + r.veranst_name +
        (r.serie_id ? ' <span style="font-size:11px;background:var(--surf2);color:var(--text2);border-radius:10px;padding:1px 6px;cursor:pointer" onclick="event.stopPropagation();openSerieDetail(' + r.serie_id + ')">🔄</span>' : '') +
      '</td>' +
      '<td style="' + td + ';font-size:12px;color:var(--text2)">' + ortText + '</td>' +
      (hasVerein ? '<td style="' + td + ';font-size:12px;color:var(--text2)">' + vereinText + '</td>' : '') +
      '<td style="' + td + '">' + r.disziplin + '</td>' +
      '<td style="' + td + '">' + akBadge(r.altersklasse) + '</td>' +
      '<td style="' + tdR + '" class="result">' + res + '</td>' +
      '<td style="' + tdR + ';font-size:12px;color:var(--text2)">' + (showPace ? fmtTime(r.pace, 'min/km') : '') + '</td>' +
      '<td style="' + td + ';text-align:center">' + medalBadge(r.ak_platzierung) + '</td>' +
      (hasMstr ? '<td style="' + td + '">' + (r.meisterschaft ? mstrBadge(r.meisterschaft) : '') + '</td>' : '') +
      (hasMstr ? '<td style="' + td + ';text-align:center">' + (r.meisterschaft && r.ak_platz_meisterschaft ? medalBadge(r.ak_platz_meisterschaft) : '') + '</td>' : '') +
      '<td style="' + td + ';white-space:nowrap">' +
        '<button class="btn btn-ghost btn-sm" title="Bearbeiten" onclick="_openMeineErgEdit(' + r.erg_id + ')">&#x270F;&#xFE0F;</button>' +
      '</td>' +
    '</tr>';
  }).join('');

  var total = allRows.length;
  var totalWettkampfe = Object.keys(allRows.reduce(function(m,r){ m[r.veranst_id]=1; return m; }, {})).length;
  var countHtml =
    '<div style="font-size:13px;color:var(--text2);margin-bottom:12px">' +
    (rows.length < total
      ? rows.length + ' von ' + total + ' Ergebnis' + (total !== 1 ? 'sen' : '')
      : total + ' Ergebnis' + (total !== 1 ? 'se' : '')) +
    ' in ' + totalWettkampfe + ' Wettkampf' + (totalWettkampfe !== 1 ? 'auftr.' : 'auftritt') +
    '</div>';

  var bulkBar =
    '<div id="mv-bulk-bar" style="display:none;margin-bottom:10px;padding:10px 14px;background:var(--surf2);border-radius:8px;display:none;align-items:center;gap:12px">' +
      '<span id="mv-bulk-count" style="font-size:13px;font-weight:600"></span>' +
      '<button class="btn btn-danger btn-sm" onclick="_bulkDeleteMeine()">&#x1F5D1;&#xFE0F; L&ouml;schen</button>' +
      '<button class="btn btn-ghost btn-sm" onclick="_meineDeselectAll()">Auswahl aufheben</button>' +
    '</div>';

  var thCb = 'padding:8px 8px 8px 10px;width:32px';
  var thAct = 'padding:8px 10px;width:60px';

  var table = rows.length
    ? '<div class="table-scroll"><table style="width:100%;border-collapse:collapse">' +
        '<thead><tr style="border-bottom:2px solid var(--border)">' +
          '<th style="' + thCb + '"><input type="checkbox" id="mv-select-all" onchange="_meineSelectAll(this)" style="width:14px;height:14px;cursor:pointer"></th>' +
          th('datum',        'Datum',         false) +
          th('veranst_name', 'Veranstaltung', false) +
          '<th style="padding:8px 10px;font-size:12px;font-weight:600;color:var(--text2)">Ort</th>' +
          (hasVerein ? '<th style="padding:8px 10px;font-size:12px;font-weight:600;color:var(--text2)">Verein</th>' : '') +
          th('disziplin',     'Disziplin',    false) +
          th('altersklasse',  'AK',           false) +
          th('resultat',      'Ergebnis',     true)  +
          '<th style="padding:8px 10px;font-size:12px;font-weight:600;color:var(--text2);text-align:right">Pace</th>' +
          th('ak_platzierung','Pl. AK',       false) +
          (hasMstr ? '<th style="padding:8px 10px;font-size:12px;font-weight:600;color:var(--text2)">Meisterschaft</th>' : '') +
          (hasMstr ? '<th style="padding:8px 10px;font-size:12px;font-weight:600;color:var(--text2);text-align:center">Pl. MS</th>' : '') +
          '<th style="' + thAct + '"></th>' +
        '</tr></thead>' +
        '<tbody>' + tableRows + '</tbody>' +
      '</table></div>'
    : '<div class="empty" style="padding:20px"><div class="empty-text">Keine Ergebnisse f&uuml;r diesen Filter.</div></div>';

  var filterBar =
    '<div class="filter-bar" style="margin-bottom:16px;flex-wrap:wrap">' +
      '<div class="fg" style="flex:2;min-width:160px"><label>Suche</label>' +
        '<input type="search" id="mv-suche" placeholder="Veranstaltung, Disziplin, Ort&hellip;" value="' + (sf.suche || '').replace(/"/g,'&quot;') + '" oninput="_filterMeine()" style="width:100%;min-width:0"/></div>' +
      '<div class="fg" style="flex:0 0 auto;min-width:90px"><label>Jahr</label>' +
        '<select id="mv-jahr" onchange="_filterMeine()">' + selOpts(jahre, sf.jahr) + '</select></div>' +
      '<div class="fg" style="flex:0 0 auto;min-width:130px"><label>Disziplin</label>' +
        '<select id="mv-disz" onchange="_filterMeine()">' + selOpts(diszList, sf.disziplin) + '</select></div>' +
    '</div>';

  viewEl.innerHTML = filterBar + countHtml + bulkBar + '<div class="panel">' + table + '</div>';
}

function _sortMeine(col) {
  if (!state.meine) state.meine = { sort: { col: 'datum', dir: 'desc' }, filter: {} };
  var cur = state.meine.sort;
  state.meine.sort = { col: col, dir: cur.col === col && cur.dir === 'asc' ? 'desc' : 'asc' };
  _renderMeineTabelle();
}

function _filterMeine() {
  if (!state.meine) state.meine = { sort: { col: 'datum', dir: 'desc' }, filter: {} };
  state.meine.filter = {
    suche:     (document.getElementById('mv-suche') || {}).value || '',
    jahr:      (document.getElementById('mv-jahr')  || {}).value || '',
    disziplin: (document.getElementById('mv-disz')  || {}).value || '',
  };
  _renderMeineTabelle();
}

// ── Checkbox-Handling ────────────────────────────────────
function _meineRowCbChange() {
  var cbs  = document.querySelectorAll('.mv-row-cb:checked');
  var all  = document.querySelectorAll('.mv-row-cb');
  var bar  = document.getElementById('mv-bulk-bar');
  var cnt  = document.getElementById('mv-bulk-count');
  var sa   = document.getElementById('mv-select-all');
  if (bar)  { bar.style.display  = cbs.length ? 'flex' : 'none'; }
  if (cnt)  { cnt.textContent    = cbs.length + ' Ergebnis' + (cbs.length !== 1 ? 'se' : '') + ' ausgewählt'; }
  if (sa)   { sa.indeterminate   = cbs.length > 0 && cbs.length < all.length; sa.checked = cbs.length === all.length && all.length > 0; }
}
function _meineSelectAll(cb) {
  document.querySelectorAll('.mv-row-cb').forEach(function(c) { c.checked = cb.checked; });
  _meineRowCbChange();
}
function _meineDeselectAll() {
  document.querySelectorAll('.mv-row-cb').forEach(function(c) { c.checked = false; });
  _meineRowCbChange();
}

// ── Einzelnes Ergebnis bearbeiten ────────────────────────
function _openMeineErgEdit(ergId) {
  var r = window._meineTblRowMap && window._meineTblRowMap[ergId];
  if (!r) return;
  var mstrOpts = buildSelectOptions(
    (window._mstrList || []), '— keine —',
    function(m) { return m.id; }, function(m) { return m.label; },
    function(m) { return String(m.id) === String(r.meisterschaft); }
  );
  showModal(
    modalH2('&#x270F;&#xFE0F; Ergebnis bearbeiten') +
    '<div style="font-size:12px;color:var(--text2);margin:-6px 0 14px">' +
      r.veranst_name + ' &middot; ' + formatDate(r.datum) +
    '</div>' +
    '<div class="form-grid">' +
      '<div class="form-group full"><label>Disziplin</label>' +
        '<input type="text" id="mee-disz" value="' + r.disziplin.replace(/"/g,'&quot;') + '" list="disz-list"/></div>' +
      '<div class="form-group"><label>Ergebnis</label>' +
        '<input type="text" id="mee-res" value="' + r.resultat.replace(/"/g,'&quot;') + '" placeholder="z.B. 00:40:08 oder 8,45"/></div>' +
      '<div class="form-group"><label>Altersklasse</label>' +
        '<input type="text" id="mee-ak" value="' + (r.altersklasse || '').replace(/"/g,'&quot;') + '" placeholder="z.B. M40"/></div>' +
      '<div class="form-group"><label>Platz AK</label>' +
        '<input type="number" id="mee-akp" value="' + (r.ak_platzierung || '') + '" min="1" placeholder="—"/></div>' +
      '<div class="form-group"><label>Meisterschaft</label>' +
        '<select id="mee-mstr">' + mstrOpts + '</select></div>' +
      '<div class="form-group"><label>Platz MS</label>' +
        '<input type="number" id="mee-mstr-platz" value="' + (r.ak_platz_meisterschaft || '') + '" min="1" placeholder="—"/></div>' +
    '</div>' +
    '<div class="modal-actions">' +
      '<button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button>' +
      '<button class="btn btn-primary" onclick="_saveMeineErgEdit(' + ergId + ',\'' + (r.tbl_key || 'strasse') + '\')">Speichern</button>' +
    '</div>'
  );
}

async function _saveMeineErgEdit(ergId, tblKey) {
  var disz  = (document.getElementById('mee-disz')       || {}).value.trim();
  var res   = (document.getElementById('mee-res')        || {}).value.trim();
  var ak    = (document.getElementById('mee-ak')         || {}).value.trim();
  var akp   = (document.getElementById('mee-akp')        || {}).value.trim();
  var mstr  = (document.getElementById('mee-mstr')       || {}).value.trim();
  var mstrP = (document.getElementById('mee-mstr-platz') || {}).value.trim();
  if (!disz || !res) { notify('Disziplin und Ergebnis sind Pflicht!', 'err'); return; }
  var body = { disziplin: disz, resultat: res, altersklasse: ak };
  if (akp)   body.ak_platzierung = parseInt(akp);
  if (mstr)  body.meisterschaft = parseInt(mstr);
  body.ak_platz_meisterschaft = mstrP ? parseInt(mstrP) : null;
  var r = await apiPut((tblKey || 'strasse') + '/' + ergId, body);
  if (r && r.ok) {
    closeModal();
    if (r.data && r.data.pending) {
      notify('Änderungsantrag gestellt. Ein Editor wird ihn prüfen.', 'ok');
    } else {
      notify('Ergebnis gespeichert.', 'ok');
    }
    window._meinVeranstRows = null;
    await renderMeineVeranstaltungen();
  } else {
    notify((r && r.fehler) || 'Fehler beim Speichern', 'err');
  }
}

// ── Bulk-Löschen ─────────────────────────────────────────
async function _bulkDeleteMeine() {
  var cbs = Array.from(document.querySelectorAll('.mv-row-cb:checked'));
  if (!cbs.length) return;
  var n = cbs.length;
  if (!await confirmModal(n + ' Ergebnis' + (n !== 1 ? 'se' : '') + ' in den Papierkorb verschieben?')) return;
  var ok = 0, fail = 0, pending = 0;
  for (var i = 0; i < cbs.length; i++) {
    var eid = parseInt(cbs[i].value);
    var row = window._meineTblRowMap && window._meineTblRowMap[eid];
    var tbl = (row && row.tbl_key) || 'strasse';
    var r = await api('DELETE', tbl + '/' + eid);
    if (r && r.ok) {
      if (r.data && r.data.pending) pending++; else ok++;
    } else fail++;
  }
  var msg = [];
  if (ok)      msg.push(ok + ' gelöscht');
  if (pending) msg.push(pending + ' Löschantrag' + (pending > 1 ? 'anträge' : '') + ' gestellt');
  if (fail)    msg.push(fail + ' Fehler');
  notify(msg.join(', ') + '.', fail ? 'err' : 'ok');
  window._meinVeranstRows = null;
  await renderMeineVeranstaltungen();
}

// ── SERIEN-TABELLE ─────────────────────────────────────────
function _serienTabelle(serien) {
  serien = serien.filter(function(s) { return Number(s.anz_austragungen) > 0; });
  var today = new Date();
  var todayMmdd = (today.getMonth() + 1) * 100 + today.getDate();

  function getMmdd(s) {
    if (!s.datum_letzte) return 9999;
    var d = new Date(s.datum_letzte);
    return (d.getMonth() + 1) * 100 + d.getDate();
  }

  function mmddDiff(mmdd) {
    return (mmdd - todayMmdd + 10000) % 10000;
  }

  var sort = state.serienSort || { col: 'mmdd', dir: 'asc' };

  var sorted = serien.slice().sort(function(a, b) {
    var av, bv;
    switch (sort.col) {
      case 'name':
        av = (a.name || '').toLowerCase(); bv = (b.name || '').toLowerCase();
        return sort.dir === 'asc' ? (av < bv ? -1 : av > bv ? 1 : 0) : (bv < av ? -1 : bv > av ? 1 : 0);
      case 'datum_letzte':
        av = a.datum_letzte || ''; bv = b.datum_letzte || '';
        return sort.dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      case 'anz_austragungen':
        av = Number(a.anz_austragungen || 0); bv = Number(b.anz_austragungen || 0);
        return sort.dir === 'asc' ? av - bv : bv - av;
      case 'anz_ergebnisse':
        av = Number(a.anz_ergebnisse || 0); bv = Number(b.anz_ergebnisse || 0);
        return sort.dir === 'asc' ? av - bv : bv - av;
      case 'anz_athleten':
        av = Number(a.anz_athleten || 0); bv = Number(b.anz_athleten || 0);
        return sort.dir === 'asc' ? av - bv : bv - av;
      case 'jahre':
        av = Number(a.jahr_bis || 0); bv = Number(b.jahr_bis || 0);
        return sort.dir === 'asc' ? av - bv : bv - av;
      case 'mmdd':
      default:
        av = mmddDiff(getMmdd(a)); bv = mmddDiff(getMmdd(b));
        return sort.dir === 'asc' ? av - bv : bv - av;
    }
  });

  function thClick(col) {
    return 'onclick="_sortSerien(\'' + col + '\')"';
  }

  function thArrow(col) {
    if (sort.col !== col) return ' <span style="opacity:.3;font-size:10px">↕</span>';
    return ' <span style="color:var(--primary)">' + (sort.dir === 'asc' ? '↑' : '↓') + '</span>';
  }

  var thBase = 'cursor:pointer;user-select:none;white-space:nowrap;padding:8px 10px;text-align:left;font-size:12px;font-weight:600;color:var(--text2)';
  var thR    = thBase + ';text-align:right';
  var td     = 'padding:8px 10px;border-bottom:1px solid var(--border);vertical-align:middle';
  var tdR    = td + ';text-align:right;font-variant-numeric:tabular-nums';

  var rows = sorted.map(function(s) {
    var jahrRange = s.jahr_von
      ? (String(s.jahr_von) === String(s.jahr_bis) ? String(s.jahr_von) : s.jahr_von + '–' + s.jahr_bis)
      : '–';
    var datumLetzte = s.datum_letzte ? formatDate(s.datum_letzte) : '–';
    var ortFlag = s.ort_land_code ? (flagEmoji(s.ort_land_code) + ' ') : '';
    var ortText = s.ort_letzte ? (ortFlag + s.ort_letzte) : '<span style="color:var(--text3)">–</span>';
    return '<tr style="cursor:pointer" onclick="openSerieDetail(' + s.id + ')" ' +
      'onmouseover="this.style.background=\'var(--surf2)\'" onmouseout="this.style.background=\'\'">' +
      '<td style="' + td + ';font-weight:600">' + (s.name || s.kuerzel || '') + '</td>' +
      '<td style="' + td + '">' + ortText + '</td>' +
      '<td style="' + td + '">' + datumLetzte + '</td>' +
      '<td style="' + tdR + '">' + (Number(s.anz_austragungen) || 0) + '</td>' +
      '<td style="' + td + '">' + jahrRange + '</td>' +
      '<td style="' + tdR + '">' + Number(s.anz_ergebnisse || 0).toLocaleString('de-DE') + '</td>' +
      '<td style="' + tdR + '">' + (Number(s.anz_athleten) || 0) + '</td>' +
    '</tr>';
  }).join('');

  var canEdit = currentUser && (currentUser.rolle === 'admin' || currentUser.rolle === 'editor');

  return '<div class="panel" style="margin-bottom:24px">' +
    '<div class="panel-header">' +
      '<div class="panel-title">🔄 Regelmäßige Veranstaltungen</div>' +
      (canEdit ? '<button class="btn btn-primary btn-sm" onclick="showSerieCreateModal()">&#x2795; Neue</button>' : '') +
    '</div>' +
    '<div class="table-scroll"><table style="width:100%;border-collapse:collapse">' +
    '<thead><tr style="border-bottom:2px solid var(--border)">' +
    '<th style="' + thBase + '" ' + thClick('name') + '>Name' + thArrow('name') + '</th>' +
    '<th style="' + thBase + '">Ort</th>' +
    '<th style="' + thBase + '" ' + thClick('datum_letzte') + '>Letzte Austragung' + thArrow('datum_letzte') + '</th>' +
    '<th style="' + thR + '" '   + thClick('anz_austragungen') + '>Austragungen' + thArrow('anz_austragungen') + '</th>' +
    '<th style="' + thBase + '" ' + thClick('jahre') + '>Jahre' + thArrow('jahre') + '</th>' +
    '<th style="' + thR + '" '   + thClick('anz_ergebnisse') + '>Ergebnisse' + thArrow('anz_ergebnisse') + '</th>' +
    '<th style="' + thR + '" '   + thClick('anz_athleten') + '>Athleten' + thArrow('anz_athleten') + '</th>' +
    '</tr></thead>' +
    '<tbody>' + rows + '</tbody>' +
    '</table></div>' +
  '</div>';
}

function _sortSerien(col) {
  var cur = state.serienSort || { col: 'mmdd', dir: 'asc' };
  state.serienSort = { col: col, dir: cur.col === col && cur.dir === 'asc' ? 'desc' : 'asc' };
  var serienEl = document.getElementById('veranst-serien');
  if (serienEl && window._lastSerienList) {
    serienEl.innerHTML = _serienTabelle(window._lastSerienList);
  }
}

// ── SERIEN-LISTE ───────────────────────────────────────────
async function renderSerienListe() {
  var el = document.getElementById('main-content');
  el.innerHTML = '<div class="loading"><div class="spinner"></div>Laden&hellip;</div>';
  var r = await apiGet('veranstaltung-serien');
  if (!r || !r.ok) {
    el.innerHTML = '<div class="panel" style="padding:24px;color:var(--accent)">Fehler: ' + (r && r.fehler ? r.fehler : 'Unbekannt') + '</div>';
    return;
  }
  var serien = r.data || [];
  var canEdit = currentUser && (currentUser.rolle === 'admin' || currentUser.rolle === 'editor');

  var html = '';
  if (canEdit) {
    html += '<div style="margin-bottom:16px"><button class="btn btn-primary" onclick="showSerieCreateModal()">&#x2795; Neue regelmäßige Veranstaltung</button></div>';
  }

  if (!serien.length) {
    html += '<div class="empty"><div class="empty-icon">\uD83D\uDD04</div>' +
      '<div class="empty-text">Noch keine regelmäßigen Veranstaltungen angelegt.<br><small style="color:var(--text2)">Lege eine an und ordne wiederkehrende Veranstaltungen (z.B. jährliche Läufe) zu.</small></div></div>';
    el.innerHTML = html;
    return;
  }

  html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px">';
  for (var i = 0; i < serien.length; i++) {
    var s = serien[i];
    var jahrRange = s.jahr_von
      ? (String(s.jahr_von) === String(s.jahr_bis) ? s.jahr_von : s.jahr_von + '&ndash;' + s.jahr_bis)
      : '&ndash;';
    html +=
      '<div class="panel" style="cursor:pointer;transition:box-shadow .15s" onclick="openSerieDetail(' + s.id + ')" onmouseover="this.style.boxShadow=\'0 4px 18px rgba(0,0,0,.13)\'" onmouseout="this.style.boxShadow=\'\'">' +
        '<div class="panel-header" style="padding-bottom:8px">' +
          '<div>' +
            '<div class="panel-title" style="font-size:16px">' + s.name + '</div>' +
      
          '</div>' +
          (canEdit ?
            '<div style="display:flex;gap:6px" onclick="event.stopPropagation()">' +
              '<button class="btn btn-ghost btn-sm" onclick="showSerieEditModal(' + s.id + ',\'' + s.name.replace(/'/g,"\\'") + '\')">&#x270F;&#xFE0F;</button>' +
              '<button class="btn btn-danger btn-sm" onclick="deleteSerieConfirm(' + s.id + ',\'' + s.name.replace(/'/g,"\\'") + '\')">&times;</button>' +
            '</div>' : '') +
        '</div>' +
        '<div style="display:flex;gap:20px;font-size:13px;color:var(--text2);padding:0 0 4px">' +
          '<span>\uD83C\uDFC6 ' + s.anz_veranstaltungen + ' Austragung' + (s.anz_veranstaltungen != 1 ? 'en' : '') + '</span>' +
          '<span>\uD83D\uDCC5 ' + jahrRange + '</span>' +
        '</div>' +
      '</div>';
  }
  html += '</div>';
  el.innerHTML = html;
}

function openSerieDetail(id) {
  state.veranstView = 'serie-detail';
  state.serieId = id;
  state.serieView = 'jahre';
  state.serieDisz = null;
  state.serieMappingId = null;
  syncHash();
  renderVeranstaltungen();
}

// ── SERIE-DETAIL ───────────────────────────────────────────
async function renderSerieDetail(id) {
  var el = document.getElementById('main-content');
  el.innerHTML = '<div class="loading"><div class="spinner"></div>Laden&hellip;</div>';

  var r = await apiGet('veranstaltung-serien/' + id);
  if (!r || !r.ok) {
    el.innerHTML = _serieBackBtn() + '<div class="panel" style="padding:24px;color:var(--accent)">Fehler: ' + (r && r.fehler ? r.fehler : 'Unbekannt') + '</div>';
    return;
  }
  var serie   = r.data.serie;
  var veranst = r.data.veranst || [];

  var rd = await apiGet('veranstaltung-serien/' + id + '?disziplinen=1');
  var disziplinen = (rd && rd.ok) ? (rd.data || []) : [];
  disziplinen.sort(function(a, b) { return (b.cnt || 0) - (a.cnt || 0); });

  var view    = state.serieView || 'jahre';
  var canEdit = currentUser && (currentUser.rolle === 'admin' || currentUser.rolle === 'editor');

  var jahre = veranst.map(function(v){ return parseInt(v.jahr); });
  var jahrMin = jahre.length ? Math.min.apply(null, jahre) : null;
  var jahrMax = jahre.length ? Math.max.apply(null, jahre) : null;

  var gesamtErg = 0, externErg = 0;
  var athletenSet = {};
  veranst.forEach(function(v) {
    (v.ergebnisse || []).forEach(function(e) {
      gesamtErg++;
      if (e.extern) externErg++;
      if (e.athlet_id) athletenSet[e.athlet_id] = 1;
    });
  });
  var uniqueAthlets = Object.keys(athletenSet).length;

  var html = _serieBackBtn();
  html += '<div class="panel" style="margin-bottom:16px;padding:18px 22px">';
  html += '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap">';
  html += '<div>';
  html += '<div style="font-size:22px;font-weight:700;line-height:1.2">' + serie.name + '</div>';
  html += '<div style="font-size:13px;color:var(--text2);margin-top:3px">';
  if (gesamtErg) {
    html += gesamtErg + ' Ergebnis' + (gesamtErg !== 1 ? 'se' : '');
    if (externErg) html += ' (davon ' + externErg + ' nicht f&uuml;r den Verein)';
    html += ' von ' + uniqueAthlets + ' Teilnehmenden';
    html += ' in ';
  }
  html += veranst.length + ' Austragung' + (veranst.length != 1 ? 'en' : '');
  if (jahrMin) html += ' (' + (jahrMin === jahrMax ? jahrMin : jahrMin + '&ndash;' + jahrMax) + ')';
  html += '</div>';
  if (serie.ort_letzte) {
    var ortFlag = serie.ort_land_code ? (flagEmoji(serie.ort_land_code) + ' ') : '';
    html += '<div style="font-size:14px;margin-top:6px">&#x1F4CD; ' + ortFlag + serie.ort_letzte + '</div>';
  }
  html += '</div>';
  if (canEdit) {
    html += '<button class="btn btn-ghost btn-sm" onclick="showSerieEditModal(' + serie.id + ',\'' + serie.name.replace(/'/g,"\\'") + '\')">&#x270F;&#xFE0F; Bearbeiten</button>';
  }
  html += '</div>';
  if (serie.ort_lat && serie.ort_lon) {
    html += '<div id="serie-ort-map" style="height:220px;border-radius:6px;margin-top:14px;border:1px solid var(--border);isolation:isolate"></div>';
  }
  html += '</div>';

  var secStyle = 'font-family:\'Barlow Condensed\',sans-serif;font-size:16px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text2)';
  html += '<div style="' + secStyle + ';margin:0 0 10px">&#x1F4CA; Anzahl Teilnahmen</div>';
  html += '<div class="panel" style="padding:20px 24px;display:inline-block;width:auto;max-width:100%"><div id="serie-teilnahmen-content"><div class="loading" style="padding:8px"><div class="spinner"></div>Lade…</div></div></div>';

  if (currentUser && currentUser.athlet_id) {
    html += '<div id="serie-meine-section" style="display:none">' +
      '<div style="' + secStyle + ';margin:32px 0 10px">&#x1F3C3; Meine Teilnahmen</div>' +
      '<div id="serie-meine-content"></div>' +
    '</div>';
  }

  html += '<div style="' + secStyle + ';margin:32px 0 10px">&#x1F3C6; Bestleistungen</div>';
  html += _buildSerieBestleistungenShell(disziplinen, id);

  html += '<div style="' + secStyle + ';margin:32px 0 10px">&#x1F4C5; Ergebnisse nach Jahr</div>';
  html += _buildSerieJahreHtml(veranst);

  el.innerHTML = html;

  // Karte für Ort
  if (serie.ort_lat && serie.ort_lon) {
    _ortEnsureLeaflet().then(function() {
      var mapEl = document.getElementById('serie-ort-map');
      if (!mapEl || !window.L) return;
      var m = L.map(mapEl, { scrollWheelZoom: false, dragging: false, zoomControl: false, touchZoom: false, doubleClickZoom: false, keyboard: false, boxZoom: false })
        .setView([parseFloat(serie.ort_lat), parseFloat(serie.ort_lon)], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19
      }).addTo(m);
      L.marker([parseFloat(serie.ort_lat), parseFloat(serie.ort_lon)]).addTo(m);
    });
  }

  // Bestleistungen laden
  var toLoad = state.serieDisz ? { disziplin: state.serieDisz, disziplin_mapping_id: state.serieMappingId } : disziplinen[0];
  if (toLoad) {
    state.serieDisz = toLoad.disziplin;
    state.serieMappingId = toLoad.disziplin_mapping_id || null;
    _highlightSerieDiszBtn(state.serieDisz, state.serieMappingId);
    _loadSerieBestleistungen(id, state.serieDisz, state.serieMappingId);
  }
  _loadSerieTeilnahmen(id);
  if (currentUser && currentUser.athlet_id) _buildSerieMeineTeilnahmen(veranst);
}


function _serieBackBtn() {
  return '<button class="btn btn-ghost btn-sm" style="margin-bottom:14px" onclick="navigate(\'veranstaltungen\')">&larr; Veranstaltungen</button> ';
}

function setSerieView(v) {
  state.serieView = v;
  renderVeranstaltungen();
}

// ── Ergebnisse nach Jahr ───────────────────────────────────
function _buildSerieJahreHtml(veranst) {
  if (!veranst.length) {
    return '<div class="empty"><div class="empty-icon">\uD83D\uDCC5</div><div class="empty-text">Noch keine Veranstaltungen in dieser Serie</div></div>';
  }
  var html = '';
  for (var vi = 0; vi < veranst.length; vi++) {
    var v = veranst[vi];
    var name = v.name || (v.kuerzel || '').split(' ').slice(1).join(' ') || v.kuerzel || '';
    html +=
      '<div class="panel" style="margin-bottom:16px">' +
        '<div class="panel-header">' +
          '<div>' +
            '<div class="panel-title" style="cursor:pointer" onclick="window.open(location.origin+location.pathname+\'#veranstaltung/' + v.id + '\',\'_blank\')">' +
              '<span style="font-size:20px;font-weight:800;color:var(--primary);margin-right:10px">' + v.jahr + '</span>' + name +
            '</div>' +
            '<div style="font-size:12px;color:var(--text2);margin-top:2px">' + formatDate(v.datum) + (v.ort ? ' &middot; ' + (flagEmoji(v.ort_land_code) ? flagEmoji(v.ort_land_code) + ' ' : '') + v.ort : '') + '</div>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:8px">' +
            '<span style="font-size:13px;color:var(--text2)">' + v.anz_ergebnisse + ' Ergebnisse &middot; ' + v.anz_athleten + ' Athleten</span>' +
            (v.datenquelle ? '<a href="' + v.datenquelle.replace(/"/g,'&quot;') + '" target="_blank" class="btn btn-ghost btn-sm" title="Ergebnisquelle">\uD83C\uDF10</a>' : '') +
          '</div>' +
        '</div>' +
        _buildVeranstErgTable(v.ergebnisse) +
      '</div>';
  }
  return html;
}

// ── Bestleistungen Shell ───────────────────────────────────
function _buildSerieBestleistungenShell(disziplinen, serieId) {
  if (!disziplinen.length) {
    return '<div class="empty"><div class="empty-icon">\uD83C\uDFC6</div><div class="empty-text">Keine Ergebnisse in dieser Serie</div></div>';
  }
  var byKat = {}; var katOrder = [];
  for (var i = 0; i < disziplinen.length; i++) {
    var d = disziplinen[i];
    var kat = d.kategorie_name || 'Weitere';
    if (!byKat[kat]) { byKat[kat] = []; katOrder.push(kat); }
    byKat[kat].push(d);
  }
  var html = '<div style="margin-bottom:16px">';
  for (var ki = 0; ki < katOrder.length; ki++) {
    var kat = katOrder[ki];
    if (katOrder.length > 1) {
      html += '<div style="font-size:11px;font-weight:600;text-transform:uppercase;color:var(--text2);letter-spacing:.06em;margin:12px 0 6px">' + kat + '</div>';
    }
    html += '<div class="rek-top-disz" style="margin-top:0">';
    var disz_in_kat = byKat[kat];
    for (var di = 0; di < disz_in_kat.length; di++) {
      var d2 = disz_in_kat[di];
      var dLabel = d2.anzeige_name || d2.disziplin;
      var isActive = state.serieDisz === d2.disziplin && String(state.serieMappingId || '') === String(d2.disziplin_mapping_id || '');
      html += '<button class="rek-top-btn rek-top-btn--sm' + (isActive ? ' active' : '') + '" ' +
        'data-disz="' + d2.disziplin.replace(/"/g,'&quot;') + '" ' +
        'data-mid="' + (d2.disziplin_mapping_id || '') + '" ' +
        'data-serie-id="' + serieId + '" ' +
        'onclick="selectSerieDisz(this.dataset.disz,this.dataset.mid,this.dataset.serieId)">' +
        '<span class="rek-top-name">' + dLabel + '</span>' +
        '<span class="rek-top-cnt">' + d2.cnt + (d2.cnt == 1 ? ' Ergebnis' : ' Ergebnisse') + '</span>' +
        '</button>';
    }
    html += '</div>';
  }
  html += '</div>';
  html += '<div id="serie-best-content"><div class="loading" style="padding:32px"><div class="spinner"></div>Lade Bestleistungen&hellip;</div></div>';
  return html;
}

function _highlightSerieDiszBtn(disz, mid) {
  document.querySelectorAll('.rek-top-btn[data-serie-id]').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.disz === disz && String(btn.dataset.mid || '') === String(mid || ''));
  });
}

function selectSerieDisz(disz, mid, serieId) {
  state.serieDisz = disz;
  state.serieMappingId = mid ? parseInt(mid) : null;
  _highlightSerieDiszBtn(disz, mid);
  _loadSerieBestleistungen(parseInt(serieId), disz, mid ? parseInt(mid) : null);
}

function toggleSerieRekOpt(key, val) {
  if (!state.rekState) state.rekState = {};
  state.rekState[key] = val;
  _saveRekPrefs();
  // Checkbox im Rekorde-Tab synchronisieren (falls sichtbar)
  var idMap = { mergeAK: 'rek-merge-ak', unique: 'rek-unique', highlightCurYear: 'rek-hl-cur', highlightPrevYear: 'rek-hl-prev' };
  var el = document.getElementById(idMap[key]);
  if (el) el.checked = val;
  // Bestleistungen neu laden
  if (state.serieDisz) {
    _loadSerieBestleistungen(state.serieId, state.serieDisz, state.serieMappingId);
  }
}

async function _loadSerieBestleistungen(serieId, disz, mappingId) {
  var container = document.getElementById('serie-best-content');
  if (!container) return;
  container.innerHTML = '<div class="loading" style="padding:32px"><div class="spinner"></div>Lade&hellip;</div>';
  var rs2 = state.rekState || {};
  var params = 'disz=' + encodeURIComponent(disz);
  if (mappingId) params += '&mapping_id=' + mappingId;
  params += '&merge_ak=' + (rs2.mergeAK !== false ? '1' : '0');
  params += '&unique=' + (rs2.unique !== false ? '1' : '0');
  var r = await apiGet('veranstaltung-serien/' + serieId + '?' + params);
  if (!r || !r.ok) {
    container.innerHTML = '<div style="color:var(--accent);padding:16px">Fehler: ' + (r && r.fehler ? r.fehler : 'Unbekannt') + '</div>';
    return;
  }
  var d   = r.data;
  var fmt = d.fmt || 'min';
  var TOP = 10; // Top 10 – bei unique=OFF können Athleten mehrfach erscheinen

  function pbDedup(rows) {
    return rows.slice(0, TOP); // dedup happens server-side based on unique param
  }

  var showPace = diszKm(disz) >= 1 && fmt !== 'm' && fmt !== 's';
  var rs2 = rs2 || state.rekState || {}; // already declared above

  function sectionHead(label) {
    return '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:18px;font-weight:600;color:var(--text);border-bottom:2px solid var(--border);padding-bottom:6px;margin:0 0 14px">' + label + '</div>';
  }

  var shtml = sectionHead('Gesamt');
  shtml +=
    '<div class="mw-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:28px">' +
      '<div class="rek-ak-card"><div class="rek-ak-header" style="background:var(--primary);color:var(--on-primary)">Frauen</div>' +
        buildRekTable(pbDedup(d.frauen || []), fmt, false, showPace, 'Athletin', disz) + '</div>' +
      '<div class="rek-ak-card"><div class="rek-ak-header">M&auml;nner</div>' +
        buildRekTable(pbDedup(d.maenner || []), fmt, false, showPace, 'Athlet', disz) + '</div>' +
    '</div>';

  var byAk = d.by_ak || {};
  var akKeys = Object.keys(byAk);
  akKeys.sort(function(a, b) {
    function rank(k) {
      var nm = k.match(/^([MW])(\d+)$/);
      if (nm) { var g=nm[1]==='W'?'1':'2'; var n=parseInt(nm[2],10); var slot=n<20?(100+n):n<30?(200+n):(300+n); return g+'_'+String(slot).padStart(4,'0'); }
      if (k==='WHK') return '1_0220'; if (k==='MHK'||k==='M') return '2_0220';
      if (k==='wjB'||k==='WJg B') return '1_0214';
      if (k==='wjA'||k==='WJg A') return '1_0215';
      if (k==='mjB') return '2_0214'; if (k==='mjA') return '2_0215';
      if (/^WU/.test(k)) return '1_0'+String(parseInt(k.replace('WU',''))).padStart(4,'0');
      if (/^MU/.test(k)) return '2_0'+String(parseInt(k.replace('MU',''))).padStart(4,'0');
      return '9_'+k;
    }
    var ra=rank(a), rb=rank(b); return ra<rb?-1:ra>rb?1:0;
  });

  shtml += sectionHead('Nach Altersklasse');
  if (!akKeys.length) {
    shtml += '<div class="empty" style="margin-bottom:28px"><div class="empty-text">Keine AK-Daten vorhanden</div></div>';
  } else {
    var prevGender = null; var grids = [[]];
    for (var aki = 0; aki < akKeys.length; aki++) {
      var ak = akKeys[aki];
      var isW = /^W/.test(ak) || ak === 'WHK' || ak === 'wjA' || ak === 'wjB' || ak === 'WJg A' || ak === 'WJg B';
      var curG = isW ? 'w' : 'm';
      if (prevGender !== null && prevGender !== curG) grids.push([]);
      grids[grids.length-1].push({ ak: ak, isW: isW });
      prevGender = curG;
    }
    for (var gi = 0; gi < grids.length; gi++) {
      if (gi > 0) shtml += '<div style="height:14px"></div>';
      shtml += '<div class="rek-ak-grid">';
      for (var ai = 0; ai < grids[gi].length; ai++) {
        var item = grids[gi][ai];
        shtml += '<div class="rek-ak-card">';
        shtml += '<div class="rek-ak-header"' + (item.isW ? ' style="background:var(--primary);color:var(--on-primary)"' : '') + '>' + item.ak + '</div>';
        shtml += buildRekTable(pbDedup(byAk[item.ak] || []), fmt, true, false, '', disz);
        shtml += '</div>';
      }
      shtml += '</div>';
    }
  }

  var rs3 = state.rekState || {};
  var cyear = new Date().getFullYear();
  var optsHtml =
    '<div style="margin-top:24px;padding-top:18px;border-top:1px solid var(--border);display:flex;flex-wrap:wrap;gap:12px 20px;align-items:center">' +
      '<label style="display:flex;align-items:center;gap:7px;cursor:pointer;font-size:13px;font-weight:600;color:var(--text2)">' +
        '<input type="checkbox" id="serie-merge-ak"' + (rs3.mergeAK !== false ? ' checked' : '') + ' onchange="toggleSerieRekOpt(\'mergeAK\',this.checked)" style="width:15px;height:15px;accent-color:var(--btn-bg);cursor:pointer">' +
        'Jugend-AK zu MHK/WHK zusammenfassen' +
      '</label>' +
      '<label style="display:flex;align-items:center;gap:7px;cursor:pointer;font-size:13px;font-weight:600;color:var(--text2)">' +
        '<input type="checkbox" id="serie-unique"' + (rs3.unique !== false ? ' checked' : '') + ' onchange="toggleSerieRekOpt(\'unique\',this.checked)" style="width:15px;height:15px;accent-color:var(--btn-bg);cursor:pointer">' +
        'Jede*r Athlet*in nur einmal (beste Leistung)' +
      '</label>' +
      '<label style="display:flex;align-items:center;gap:7px;cursor:pointer;font-size:13px;font-weight:600;color:#b03020">' +
        '<input type="checkbox" id="serie-hl-cur"' + (rs3.highlightCurYear ? ' checked' : '') + ' onchange="toggleSerieRekOpt(\'highlightCurYear\',this.checked)" style="width:15px;height:15px;accent-color:#e05040;cursor:pointer">' +
        cyear + ' hervorheben' +
      '</label>' +
      '<label style="display:flex;align-items:center;gap:7px;cursor:pointer;font-size:13px;font-weight:600;color:#205090">' +
        '<input type="checkbox" id="serie-hl-prev"' + (rs3.highlightPrevYear ? ' checked' : '') + ' onchange="toggleSerieRekOpt(\'highlightPrevYear\',this.checked)" style="width:15px;height:15px;accent-color:#4070c0;cursor:pointer">' +
        (cyear - 1) + ' hervorheben' +
      '</label>' +
    '</div>';
  container.innerHTML = '<div class="panel" style="padding:20px 24px">' + shtml + optsHtml + '</div>';
}

// ── Meine Teilnahmen in einer Serie ───────────────────────
function _buildSerieMeineTeilnahmen(veranst) {
  var container = document.getElementById('serie-meine-content');
  if (!container || !currentUser || !currentUser.athlet_id) return;
  var myId = parseInt(currentUser.athlet_id);

  // Flache Zeilen: eine pro eigenes Ergebnis, mit Veranstaltungs-Kontext
  var rows = [];
  for (var vi = 0; vi < veranst.length; vi++) {
    var v = veranst[vi];
    var vName = v.name || (v.kuerzel || '').split(' ').slice(1).join(' ') || v.kuerzel || '';
    var ergs = v.ergebnisse || [];
    for (var ei = 0; ei < ergs.length; ei++) {
      var e = ergs[ei];
      if (parseInt(e.athlet_id) !== myId) continue;
      var fmt = e.fmt || 'min';
      var _km = diszKm ? diszKm(e.disziplin) : 0;
      var pace = (_km >= 1 && fmt !== 'm' && fmt !== 's' && calcPace) ? calcPace(e.disziplin, e.resultat) : '';
      rows.push({
        veranst_id: v.id, veranst_name: vName, datum: v.datum || '', jahr: v.jahr || '',
        disziplin: e.disziplin || '', altersklasse: e.altersklasse || '',
        resultat: e.resultat || '', fmt: fmt, pace: pace,
        ak_platzierung: e.ak_platzierung || null,
        meisterschaft: e.meisterschaft || '',
        ak_platz_meisterschaft: e.ak_platz_meisterschaft || null,
        extern: parseInt(e.extern) === 1,
        verein: e.verein || '',
      });
    }
  }

  if (!rows.length) return; // Section bleibt versteckt

  var section = document.getElementById('serie-meine-section');
  if (section) section.style.display = '';

  // Bedingte Spalten
  var hasMstr   = rows.some(function(r) { return !!r.meisterschaft; });
  var hasExtern = rows.some(function(r) { return r.extern; });
  var ownClubSerie = (appConfig && (appConfig.verein_name || appConfig.verein_kuerzel)) || '';

  var td  = 'padding:7px 10px;border-bottom:1px solid var(--border);vertical-align:middle';
  var tdR = td + ';text-align:right;font-variant-numeric:tabular-nums';

  var tableRows = rows.map(function(r) {
    var res = r.fmt === 'm' ? fmtMeter(r.resultat) : fmtTime(r.resultat, r.fmt === 's' ? 's' : (r.fmt === 'min_h' ? 'min_h' : undefined));
    var showPace = r.pace && r.pace !== '00:00';
    return '<tr onmouseover="this.style.background=\'var(--surf2)\'" onmouseout="this.style.background=\'\'">' +
      '<td style="' + td + ';white-space:nowrap">' + formatDate(r.datum) + '</td>' +
      '<td style="' + td + ';font-weight:600;cursor:pointer" onclick="window.open(location.origin+location.pathname+\'#veranstaltung/' + r.veranst_id + '\',\'_blank\')">' +
        r.veranst_name +
      '</td>' +
      (hasExtern ? '<td style="' + td + ';font-size:12px;color:var(--text2)">' + (r.verein || ownClubSerie) + '</td>' : '') +
      '<td style="' + td + '">' + r.disziplin + '</td>' +
      '<td style="' + td + '">' + akBadge(r.altersklasse) + '</td>' +
      '<td style="' + tdR + '" class="result">' + res + '</td>' +
      '<td style="' + tdR + ';font-size:12px;color:var(--text2)">' + (showPace ? fmtTime(r.pace, 'min/km') : '') + '</td>' +
      '<td style="' + td + ';text-align:center">' + medalBadge(r.ak_platzierung) + '</td>' +
      (hasMstr ? '<td style="' + td + '">' + (r.meisterschaft ? mstrBadge(r.meisterschaft) : '') + '</td>' : '') +
      (hasMstr ? '<td style="' + td + ';text-align:center">' + (r.meisterschaft && r.ak_platz_meisterschaft ? medalBadge(r.ak_platz_meisterschaft) : '') + '</td>' : '') +
    '</tr>';
  }).join('');

  var thS = 'padding:8px 10px;text-align:left;font-size:12px;font-weight:600;color:var(--text2)';
  var thR = thS + ';text-align:right';

  var anzJahre = Object.keys(rows.reduce(function(m,r){ m[r.datum.slice(0,4)]=1; return m; }, {})).length;
  var countHtml = '<div style="font-size:13px;color:var(--text2);margin-bottom:12px">' +
    rows.length + ' Ergebnis' + (rows.length !== 1 ? 'se' : '') + ' in ' +
    anzJahre + ' Austragung' + (anzJahre !== 1 ? 'en' : '') + '</div>';

  container.innerHTML =
    '<div class="panel">' +
      '<div style="padding:16px 18px 0">' + countHtml + '</div>' +
      '<div class="table-scroll"><table style="width:100%;border-collapse:collapse">' +
        '<thead><tr style="border-bottom:2px solid var(--border)">' +
          '<th style="' + thS + '">Datum</th>' +
          '<th style="' + thS + '">Veranstaltung</th>' +
          (hasExtern ? '<th style="' + thS + '">Verein</th>' : '') +
          '<th style="' + thS + '">Disziplin</th>' +
          '<th style="' + thS + '">AK</th>' +
          '<th style="' + thR + '">Ergebnis</th>' +
          '<th style="' + thR + '">Pace</th>' +
          '<th style="' + thS + ';text-align:center">Pl. AK</th>' +
          (hasMstr ? '<th style="' + thS + '">Meisterschaft</th>' : '') +
          (hasMstr ? '<th style="' + thS + ';text-align:center">Pl. MS</th>' : '') +
        '</tr></thead>' +
        '<tbody>' + tableRows + '</tbody>' +
      '</table></div>' +
    '</div>';
}

// ── Modale: Serie anlegen / bearbeiten ────────────────────
async function showSerieCreateModal() {
  // Alle Veranstaltungen ohne Serie laden für Vorschlagsliste
  var rV = await apiGet('veranstaltungen?limit=500');
  window._srAllVeranst = ((rV && rV.data && rV.data.veranst) || [])
    .filter(function(v){ return !v.serie_id; })
    .map(function(v){ return { id: v.id, name: v.name || (v.kuerzel||'').split(' ').slice(1).join(' ') || v.kuerzel || '' }; })
    .filter(function(v){ return v.name; });

  showModal(
    modalH2('\uD83D\uDD04 Neue regelmäßige Veranstaltung') +
    '<div class="form-group full" style="margin-bottom:16px">' +
      '<label>Name *</label>' +
      '<input type="text" id="sr-name" placeholder="z.B. Venloop" autofocus ' +
             'oninput="_srFilterVeranst(this.value)"/>' +
    '</div>' +
    '<div class="form-group full" style="margin-bottom:4px">' +
      '<label style="font-size:12px;color:var(--text2)">Passende Veranstaltungen zuordnen <span id="sr-match-count" style="opacity:.6"></span></label>' +
      '<div id="sr-veranst-list" style="max-height:220px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;background:var(--surf2);padding:4px 0">' +
        '<div style="padding:10px 14px;color:var(--text2);font-size:13px">Tippe oben einen Namen ein\u2026</div>' +
      '</div>' +
    '</div>' +
    '<div class="modal-actions" style="margin-top:16px">' +
      '<button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button>' +
      '<button class="btn btn-primary" onclick="saveSerieCreate()">Anlegen</button>' +
    '</div>'
  );
}

function _srNorm(s) {
  // Jahreszahlen, Ordinalzahlen, Sonderzeichen entfernen für Vergleich
  return (s || '').toLowerCase()
    .replace(/\d{4}/g, '').replace(/\d+\./g, '').replace(/[^a-z\u00e4\u00f6\u00fc\u00df\s]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function _srFilterVeranst(query) {
  var list = document.getElementById('sr-veranst-list');
  var cntEl = document.getElementById('sr-match-count');
  if (!list) return;
  var q = _srNorm(query);
  var words = q.split(' ').filter(function(w){ return w.length >= 3; });
  var all = window._srAllVeranst || [];
  var matched = !words.length ? [] : all.filter(function(v){
    var n = _srNorm(v.name);
    return words.some(function(w){ return n.indexOf(w) >= 0; });
  });
  if (cntEl) cntEl.textContent = matched.length ? '(' + matched.length + ' gefunden)' : '';
  if (!words.length) {
    list.innerHTML = '<div style="padding:10px 14px;color:var(--text2);font-size:13px">Tippe oben einen Namen ein\u2026</div>';
    return;
  }
  if (!matched.length) {
    list.innerHTML = '<div style="padding:10px 14px;color:var(--text2);font-size:13px">Keine passenden Veranstaltungen gefunden</div>';
    return;
  }
  list.innerHTML = matched.map(function(v){
    return '<label style="display:flex;align-items:center;gap:10px;padding:7px 12px;cursor:pointer;border-bottom:1px solid var(--border)">' +
      '<input type="checkbox" class="sr-veranst-chk" value="' + v.id + '" checked style="width:15px;height:15px;cursor:pointer;flex-shrink:0"/>' +
      '<span style="font-size:13px">' + v.name + '</span>' +
    '</label>';
  }).join('');
}

async function saveSerieCreate() {
  var name = (document.getElementById('sr-name') || {}).value || '';
  if (!name.trim()) { notify('Name erforderlich.', 'err'); return; }
  var r = await apiPost('veranstaltung-serien', { name: name.trim() });
  if (!r || !r.ok) { notify((r && r.fehler) || 'Fehler', 'err'); return; }
  var newId = r.data && r.data.id;
  // Ausgewählte Veranstaltungen zuordnen
  if (newId) {
    var chks = document.querySelectorAll('.sr-veranst-chk:checked');
    for (var i = 0; i < chks.length; i++) {
      await apiPut('veranstaltungen/' + chks[i].value, { serie_id: newId });
    }
  }
  closeModal();
  notify('Serie angelegt' + (newId && document.querySelectorAll ? '' : '') + '.', 'ok');
  switchVeranstView('serien');
}

function showSerieEditModal(id, curName) {
  showModal(
    modalH2('&#x270F;&#xFE0F; Serie bearbeiten') +
    '<div class="form-grid">' +
      '<div class="form-group full"><label>Name</label>' +
        '<input type="text" id="sr-name" value="' + (curName || '').replace(/"/g,'&quot;') + '"/></div>' +

    '</div>' +
    '<div class="modal-actions">' +
      '<button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button>' +
      '<button class="btn btn-primary" onclick="saveSerie(' + id + ')">Speichern</button>' +
    '</div>'
  );
}

async function saveSerie(id) {
  var name    = (document.getElementById('sr-name')    || {}).value || '';
  var r = await apiPut('veranstaltung-serien/' + id, { name: name.trim() });
  if (r && r.ok) {
    closeModal(); notify('Gespeichert.', 'ok');
    if (state.veranstView === 'serie-detail') renderSerieDetail(id);
    else renderSerienListe();
  } else notify((r && r.fehler) || 'Fehler', 'err');
}

async function deleteSerieConfirm(id, name) {
  if (!await confirmModal('Serie "' + name + '" l\u00f6schen?\nDie Veranstaltungen selbst bleiben erhalten, werden aber keiner Serie mehr zugeordnet.')) return;
  var r = await api('DELETE', 'veranstaltung-serien/' + id);
  if (r && r.ok) { notify('Gel\u00f6scht.', 'ok'); switchVeranstView('serien'); }
  else notify((r && r.fehler) || 'Fehler', 'err');
}

// ── Veranstaltung-Edit (mit Serie-Zuweisung) ──────────────
async function showVeranstEditModal(id) {
  var v = state._veranstMap && state._veranstMap[id];
  if (!v) {
    var rv = await apiGet('veranstaltungen?id=' + id);
    v = (rv && rv.ok && rv.data && (rv.data.veranst || [])[0]) || null;
    if (v) {
      if (!state._veranstMap) state._veranstMap = {};
      state._veranstMap[id] = v;
    }
  }
  if (!v) { notify('Veranstaltung nicht gefunden.', 'err'); return; }
  // Serien immer ungefiltert laden (nicht aus gefiltertem Cache)
  var _sr = await apiGet('veranstaltung-serien');
  var serien = (_sr && _sr.ok) ? (_sr.data || []) : (window._lastSerienList || []);
  var curName  = v.name  || '';
  var curDatum = (v.datum || '').slice(0, 10);
  var curOrt   = v.ort   || '';
  var curOrtId = v.ort_id || '';
  var curSerie = v.serie_id || '';

  var serieOptHtml = buildSelectOptions(serien, '&#8212; Keine Serie &#8212;',
    function(s) { return s.id; },
    function(s) { return s.name; },
    function(s) { return String(s.id) === String(curSerie); });

  if (typeof ortePickerLoad === 'function') await ortePickerLoad();
  var pickerText = curOrtId
    ? (function(){ for (var i=0;i<(_orteCache||[]).length;i++){ var o=_orteCache[i]; if (o.id==curOrtId) return o.name + (o.land_code?' ('+o.land_code+')':''); } return curOrt; })()
    : curOrt;

  showModal(
    modalH2('&#x270F;&#xFE0F; Veranstaltung bearbeiten') +
    '<div class="form-grid">' +
      '<div class="form-group full"><label>Name (optional)</label>' +
        '<input type="text" id="ve-name" value="' + curName.replace(/"/g,'&quot;') + '" placeholder="z.B. 44. Stra&szlig;enlauf Rund um das Bayer-Kreuz"/></div>' +
      '<div class="form-group"><label>Datum</label>' +
        '<input type="date" id="ve-datum" value="' + curDatum + '"/></div>' +
      '<div class="form-group"><label>Ort</label>' +
        ortePickerHtml({ inputId: 've-ort', hiddenId: 've-ort-id', ortId: curOrtId, text: pickerText }) +
      '</div>' +
      '<div class="form-group full"><label>\uD83D\uDD04 Serie (optional)</label>' +
        '<select id="ve-serie">' + serieOptHtml + '</select></div>' +
    '</div>' +
    '<div class="modal-actions">' +
      '<button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button>' +
      '<button class="btn btn-primary" onclick="saveVeranstaltung(' + id + ')">Speichern</button>' +
    '</div>',
    false, true
  );
}

async function saveVeranstaltung(id) {
  var serieEl = document.getElementById('ve-serie');
  var ortIdEl = document.getElementById('ve-ort-id');
  var ortInpEl = document.getElementById('ve-ort');
  var ortId = ortIdEl && ortIdEl.value ? parseInt(ortIdEl.value) : null;
  // Wenn ort_id gesetzt \u2192 Freitext aus Orte-Tabelle, sonst fallback auf Eingabe
  var ortFreitext = null;
  if (ortId) {
    for (var i = 0; i < (_orteCache || []).length; i++) {
      if (_orteCache[i].id == ortId) { ortFreitext = _orteCache[i].name; break; }
    }
  } else if (ortInpEl) {
    ortFreitext = ortInpEl.value.trim() || null;
  }
  var body = {
    name:     document.getElementById('ve-name').value.trim() || null,
    datum:    document.getElementById('ve-datum').value,
    ort:      ortFreitext,
    ort_id:   ortId,
    serie_id: serieEl ? (serieEl.value ? parseInt(serieEl.value) : null) : undefined,
  };
  var r = await apiPut('veranstaltungen/' + id, body);
  if (r && r.ok) { closeModal(); notify('Gespeichert.', 'ok'); await renderVeranstaltungen(); }
  else notify((r && r.fehler) || 'Fehler', 'err');
}

async function deleteVeranstaltung(id, name) {
  var v = state._veranstMap && state._veranstMap[id];
  var anz = v ? parseInt(v.anz_ergebnisse) : 0;
  if (anz > 0) {
    if (!await confirmModal('Veranstaltung "' + name + '" und ' + anz + ' Ergebnisse in den Papierkorb verschieben?')) return;
    var r = await api('DELETE', 'veranstaltungen/' + id + '?force=1');
  } else {
    if (!await confirmModal('Veranstaltung "' + name + '" in den Papierkorb verschieben?')) return;
    var r = await apiDel('veranstaltungen/' + id);
  }
  if (r && r.ok) { notify('Gel\u00f6scht.', 'ok'); await renderVeranstaltungen(); }
  else notify((r && r.fehler) || 'Fehler', 'err');
}

function openAthletByName(name) {
  renderPage();
}

// ── Teilnahmen-Ranking ─────────────────────────────────────────────────────
async function _loadSerieTeilnahmen(serieId) {
  var container = document.getElementById('serie-teilnahmen-content');
  if (!container) return;
  container.innerHTML = '<div class="loading" style="padding:24px"><div class="spinner"></div>Lade\u2026</div>';

  var rT = await apiGet('veranstaltung-serien/' + serieId + '?teilnahmen=1');
  var rS = await apiGet('veranstaltung-serien/' + serieId);
  if (!rT || !rT.ok) {
    container.innerHTML = '<div style="color:var(--accent);padding:16px">Fehler: ' + (rT && rT.fehler || 'Unbekannt') + '</div>';
    return;
  }
  var rows = rT.data || [];
  if (!rows.length) {
    container.innerHTML = '<div class="empty"><div class="empty-icon">&#x1F4CA;</div><div class="empty-text">Noch keine Teilnahmen erfasst</div></div>';
    return;
  }

  // Austragungsjahre + Ergebnismap
  var serieJahre = [];
  var ergMap = {}; // [athlet_id][jahr] = [{disziplin, resultat}]
  if (rS && rS.ok && rS.data && rS.data.veranst) {
    rS.data.veranst.forEach(function(v) {
      if (v.jahr) serieJahre.push(parseInt(v.jahr));
      (v.ergebnisse || []).forEach(function(e) {
        if (!ergMap[e.athlet_id]) ergMap[e.athlet_id] = {};
        if (!ergMap[e.athlet_id][v.jahr]) ergMap[e.athlet_id][v.jahr] = [];
        ergMap[e.athlet_id][v.jahr].push({ disziplin: e.disziplin, resultat: e.resultat });
      });
    });
    serieJahre.sort(function(a,b){return a-b;});
    serieJahre = serieJahre.filter(function(v,i,a){return a.indexOf(v)===i;});
  }

  var maxT = rows[0].teilnahmen || 1;

  // Gesamtteilnehmer + Teilnehmer pro Jahr
  var gesamtTeilnehmer = rows.length;
  var perJahrMap = {};
  rows.forEach(function(row) {
    (row.jahre || []).forEach(function(j) {
      if (j) perJahrMap[j] = (perJahrMap[j] || 0) + 1;
    });
  });

  var tlHeader = serieJahre.map(function(j) {
    return '<th style="text-align:center;width:38px;min-width:38px;font-size:11px;font-weight:600;color:var(--text2);padding:4px 2px">' + j + '</th>';
  }).join('');

  var html = '<div class="table-scroll" style="overflow-x:auto;width:100%"><table class="serie-teilnahmen-table" style="width:auto;min-width:max-content;border-collapse:collapse;font-size:13px">';
  var _thBase = 'padding:7px 10px;color:var(--text2);font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;white-space:nowrap;border-bottom:2px solid var(--border)';
  var _tdBase = 'padding:7px 10px;border-bottom:1px solid var(--border)';
  html += '<thead><tr>' +
    '<th style="' + _thBase + ';width:34px"></th>' +
    '<th style="' + _thBase + ';text-align:left;min-width:140px">Athlet*in</th>' +
    '<th style="' + _thBase + ';text-align:right;width:44px">&#x2211;</th>' +
    tlHeader +
    '</tr></thead><tbody>';

  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var showBadge = i === 0 || rows[i].teilnahmen !== rows[i-1].teilnahmen;
    var rank = i + 1;
    // Jahres-Maps
    var jahrArr  = row.jahre       || [];
    var externArr = row.jahre_extern || [];
    var jahrSet = {}; // {jahr: 'verein'|'extern'}
    jahrArr.forEach(function(j, idx) {
      jahrSet[j] = externArr[idx] ? 'extern' : 'verein';
    });

    var erId = row.athlet_id;
    var tlCells = serieJahre.map(function(j) {
      var status = jahrSet[j]; // 'verein', 'extern', undefined
      // Tooltip
      var tipText = '';
      if (status && ergMap[erId] && ergMap[erId][j]) {
        tipText = ergMap[erId][j].map(function(e){
          var raw = e.resultat || '';
          var parts = raw.replace(/\.\d+$/, '').split(':').map(Number).filter(function(n){return !isNaN(n);});
          while (parts.length > 2 && parts[0] === 0) parts.shift();
          var resPlain = parts.map(function(p,idx2){return idx2===0?String(p):String(p).padStart(2,'0');}).join(':');
          var unit = parts.length >= 3 ? 'h' : 'min';
          return e.disziplin + ': ' + resPlain + unit;
        }).join(' | ');
      }
      if (status === 'extern' && !tipText) tipText = 'Externes Ergebnis';
      var safeTitle = (tipText || (status ? String(j) : '\u2013')).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
      var dotStyle;
      if (status === 'verein') {
        dotStyle = 'background:var(--primary);box-shadow:0 1px 3px rgba(0,0,0,.2)';
      } else if (status === 'extern') {
        dotStyle = 'background:transparent;border:2px solid var(--primary);opacity:.5';
      } else {
        dotStyle = 'background:transparent;border:1.5px solid var(--border)';
      }
      return '<td style="text-align:center;padding:6px 2px">' +
        '<div title="' + safeTitle + '" style="width:20px;height:20px;border-radius:50%;margin:0 auto;' + dotStyle + '"></div>' +
        '</td>';
    }).join('');

    html += '<tr style="border-bottom:1px solid var(--border)">' +
      '<td style="padding:6px 4px">' + (showBadge ? medalBadge(rank) : '') + '</td>' +
      '<td style="font-weight:600;padding:6px 8px 6px 4px;font-size:13px">' +
        '<span class="athlet-link" data-athlet-id="' + row.athlet_id + '">' + row.athlet + '</span>' +
        (row.extern_teilnahmen ? '<span style="font-size:10px;color:var(--text2);margin-left:5px" title="davon ' + row.extern_teilnahmen + ' extern">(+' + row.extern_teilnahmen + ' ext.)</span>' : '') +
      '</td>' +
      '<td style="text-align:right;font-family:\'Barlow Condensed\',sans-serif;font-size:17px;font-weight:700;color:var(--primary);padding:6px 8px 6px 4px">' + row.teilnahmen + '</td>' +
      tlCells +
      '</tr>';
  }

  var perJahrCells = serieJahre.map(function(j) {
    var n = perJahrMap[j] || 0;
    return '<td style="text-align:center;padding:6px 2px;font-family:\'Barlow Condensed\',sans-serif;font-size:17px;font-weight:700;color:var(--primary)">' + (n || '–') + '</td>';
  }).join('');
  html += '</tbody><tfoot><tr style="border-top:2px solid var(--border)">' +
    '<td></td>' +
    '<td colspan="2" style="padding:6px 8px 6px 4px;font-family:\'Barlow Condensed\',sans-serif;font-size:17px;font-weight:700;color:var(--primary);white-space:nowrap">' + gesamtTeilnehmer + ' Teilnehmende</td>' +
    perJahrCells +
    '</tr></tfoot></table></div>';
  html += '<div style="display:flex;gap:18px;margin-top:10px;font-size:11px;color:var(--text2);align-items:center">' +
    '<div style="display:flex;align-items:center;gap:5px"><div style="width:13px;height:13px;border-radius:50%;background:var(--primary)"></div>Für den Verein gestartet</div>' +
    '<div style="display:flex;align-items:center;gap:5px"><div style="width:13px;height:13px;border-radius:50%;border:2px solid var(--primary);opacity:.6"></div>Extern gestartet</div>' +
    '<div style="display:flex;align-items:center;gap:5px"><div style="width:13px;height:13px;border-radius:50%;border:1.5px solid var(--border)"></div>Nicht gestartet</div>' +
  '</div>';

  container.innerHTML = html;
  container.addEventListener('click', function(ev) {
    var al = ev.target.closest('.athlet-link[data-athlet-id]');
    if (al) openAthletById(parseInt(al.dataset.athletId));
  });
}

// ── Massen-Zuordnung: Alle Veranstaltungen ohne Serie zu einer Serie hinzufügen ──
async function showMassenSerieModal() {
  var veranst = (window._lastVeranstList || []).filter(function(v) { return !v.serie_id; });
  if (!veranst.length) { notify('Keine Veranstaltungen ohne Serie gefunden.', 'err'); return; }

  // Serien ungefiltert laden
  var _sr = await apiGet('veranstaltung-serien');
  var serien = (_sr && _sr.ok) ? (_sr.data || []) : [];

  var serieOpts = '<option value="">– Serie wählen –</option>' +
    serien.map(function(s) { return '<option value="' + s.id + '">' + s.name + '</option>'; }).join('') +
    '<option value="__neu__">＋ Neue regelmäßige Veranstaltung…</option>';

  var listHtml = veranst.map(function(v) {
    var name = v.name || (v.kuerzel||'').split(' ').slice(1).join(' ') || v.kuerzel || '?';
    return '<li style="padding:4px 0;font-size:13px;border-bottom:1px solid var(--border)">' +
      '<span style="font-weight:600">' + name + '</span>' +
      ' <span style="color:var(--text2)">' + formatDate(v.datum) + (v.ort ? ' · ' + (flagEmoji(v.ort_land_code) ? flagEmoji(v.ort_land_code) + ' ' : '') + v.ort : '') + '</span>' +
    '</li>';
  }).join('');

  showModal(
    '<h2>🔄 Zu regelmäßiger Veranstaltung hinzufügen <button class="modal-close" onclick="closeModal()">✕</button></h2>' +
    '<p style="font-size:13px;color:var(--text2);margin-bottom:12px">Folgende Veranstaltungen (ohne bestehende Serie-Zuordnung) werden hinzugefügt:</p>' +
    '<ul style="list-style:none;margin:0 0 16px;padding:0;max-height:280px;overflow-y:auto">' + listHtml + '</ul>' +
    '<div class="form-group full" style="margin-bottom:16px">' +
      '<label>Regelmäßige Veranstaltung *</label>' +
      '<select id="massen-serie-sel" style="width:100%;padding:9px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text)">' + serieOpts + '</select>' +
    '</div>' +
    '<div class="modal-actions">' +
      '<button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button>' +
      '<button class="btn btn-primary" onclick="massenSerieZuordnen()">Zuordnen</button>' +
    '</div>',
    true
  );
}

async function massenSerieZuordnen() {
  var sel = document.getElementById('massen-serie-sel');
  var serieId = sel ? sel.value : '';

  // Neue Serie anlegen falls gewünscht
  if (serieId === '__neu__') {
    var name = (window.prompt('Name der neuen regelmäßigen Veranstaltung:') || '').trim();
    if (!name) return;
    var rc = await apiPost('veranstaltung-serien', { name: name });
    if (!rc || !rc.ok) { notify('Fehler beim Anlegen: ' + (rc&&rc.fehler||'?'), 'err'); return; }
    serieId = rc.data && rc.data.id;
  }

  if (!serieId) { notify('Bitte eine Serie wählen.', 'err'); return; }

  var veranst = (window._lastVeranstList || []).filter(function(v) { return !v.serie_id; });
  var btn = document.querySelector('.modal-actions .btn-primary');
  if (btn) btn.disabled = true;

  var ok = 0, fail = 0;
  for (var i = 0; i < veranst.length; i++) {
    var r = await apiPut('veranstaltungen/' + veranst[i].id, { serie_id: parseInt(serieId) });
    if (r && r.ok) ok++; else fail++;
  }

  closeModal();
  notify(ok + ' Veranstaltung' + (ok===1?'':'en') + ' zugeordnet' + (fail ? ', ' + fail + ' Fehler' : '') + '.', fail ? 'err' : 'ok');
  renderVeranstaltungen();
}
