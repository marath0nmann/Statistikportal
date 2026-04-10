// ── VERANSTALTUNGEN ────────────────────────────────────────

var _veranstSucheTimer = null;
function setVeranstSuche(val) {
  clearTimeout(_veranstSucheTimer);
  _veranstSucheTimer = setTimeout(function() {
    state.veranstSuche = val.trim();
    state.veranstPage = 1;
    renderVeranstaltungen();
  }, 300);
}

// state.veranstView  = 'liste' | 'serien' | 'serie-detail'
// state.serieId      = ID der aktuell angezeigten Serie
// state.serieView    = 'jahre' | 'bestleistungen'
// state.serieDisz    = aktuell gewählte Disziplin im Bestleistungen-View
// state.serieMappingId = mapping_id der Disziplin

function _veranstViewToggleHtml() {
  var v = state.veranstView || 'liste';
  return '<div style="display:flex;gap:8px;margin-bottom:16px">' +
    '<button class="btn' + (v === 'liste'  ? ' btn-primary' : ' btn-ghost') + '" onclick="switchVeranstView(\'liste\')">\uD83D\uDCCD Alle Veranstaltungen</button>' +
    '<button class="btn' + (v === 'serien' || v === 'serie-detail' ? ' btn-primary' : ' btn-ghost') + '" onclick="switchVeranstView(\'serien\')">\uD83D\uDD04 Regelmäßige Veranstaltungen</button>' +
  '</div>';
}

function switchVeranstView(v) {
  state.veranstView = v;
  state.serieId = null;
  state.serieView = 'jahre';
  state.serieDisz = null;
  state.serieMappingId = null;
  renderVeranstaltungen();
}

async function renderVeranstaltungen() {
  var view = state.veranstView || 'liste';
  if (view === 'serien')       { await renderSerienListe(); return; }
  if (view === 'serie-detail') { await renderSerieDetail(state.serieId); return; }
  await renderVeranstaltungenListe();
}

// ── LISTE ──────────────────────────────────────────────────
async function renderVeranstaltungenListe() {
  var el = document.getElementById('main-content');
  var _vFoc = _saveFocus();
  el.innerHTML = '<div class="loading"><div class="spinner"></div>Laden&hellip;</div>';
  var sucheParam = state.veranstSuche ? '&suche=' + encodeURIComponent(state.veranstSuche) : '';
  var r = await apiGet('veranstaltungen?limit=10&offset=' + ((state.veranstPage-1)*10) + sucheParam);
  if (!r || !r.ok) {
    el.innerHTML = '<div class="panel" style="padding:24px;color:var(--accent)"><strong>Fehler:</strong> ' + (r && r.fehler ? r.fehler : 'Unbekannt') + '</div>';
    return;
  }
  var veranst = r.data.veranst || [];
  var total   = r.data.total  || 0;
  var serien  = r.data.serien || [];
  window._lastVeranstList = veranst;
  window._lastSerienList  = serien;
  state._veranstMap = {};
  for (var ci = 0; ci < veranst.length; ci++) state._veranstMap[veranst[ci].id] = veranst[ci];

  var html = '';
  for (var vi = 0; vi < veranst.length; vi++) {
    var v = veranst[vi];
    var name = v.name || (v.kuerzel || '').split(' ').slice(1).join(' ') || v.kuerzel || '';
    var rows = '';
    var byDisz = {}; var diszOrder = [];
    for (var ei = 0; ei < v.ergebnisse.length; ei++) {
      var e = v.ergebnisse[ei];
      var _dk = ergDiszKey(e);
      if (!byDisz[_dk]) { byDisz[_dk] = []; diszOrder.push(_dk); }
      byDisz[_dk].push(e);
    }
    var _hasMstr = v.ergebnisse.some(function(e3){ return !!e3.meisterschaft; });
    var _colspan = _hasMstr ? '7' : '5';
    sortDisziplinen(diszOrder);
    for (var di = 0; di < diszOrder.length; di++) {
      var _dKey = diszOrder[di];
      var _diszFirstErg = byDisz[_dKey][0];
      var disz = _diszFirstErg ? ergDiszLabel(_diszFirstErg) : _dKey;
      var ergs = byDisz[_dKey];
      rows += '<tr class="disz-header-row"><td colspan="' + _colspan + '" class="disziplin-text" style="background:var(--surf2);font-weight:600;padding:6px 12px">' + disz + '</td></tr>';
      for (var ei2 = 0; ei2 < ergs.length; ei2++) {
        var e2 = ergs[ei2];
        var fmt = e2.fmt || '';
        var res = fmt === 'm' ? fmtMeter(e2.resultat) : fmtTime(e2.resultat, fmt === 's' ? 's' : undefined);
        var _ePace = diszKm(e2.disziplin) >= 1 ? calcPace(e2.disziplin, e2.resultat) : '';
        var showPace = _ePace && _ePace !== '00:00' && fmt !== 'm' && fmt !== 's';
        rows +=
          '<tr>' +
            '<td><span class="athlet-link" onclick="openAthletById(' + e2.athlet_id + ')">' + e2.athlet + '</span></td>' +
            '<td>' + akBadge(e2.altersklasse) + '</td>' +
            '<td class="result">' + res + '</td>' +
            '<td class="ort-text">' + (showPace ? fmtTime(_ePace, 'min/km') : '') + '</td>' +
            '<td>' + medalBadge(e2.ak_platzierung) + '</td>' +
            (_hasMstr ? '<td>' + mstrBadge(e2.meisterschaft) + '</td>' : '') +
            (_hasMstr ? '<td class="ort-text" style="font-size:12px">' + (e2.meisterschaft && e2.ak_platz_meisterschaft ? medalBadge(e2.ak_platz_meisterschaft) : '') + '</td>' : '') +
          '</tr>';
      }
    }
    // Serie-Badge
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
            '<div style="font-size:12px;color:var(--text2);margin-top:2px">' + formatDate(v.datum) + (v.ort ? ' &middot; ' + v.ort : '') + '</div>' +
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
        (rows ? '<div class="table-scroll"><table class="veranst-dash-table"><colgroup><col class="vcol-athlet"><col class="vcol-ak"><col class="vcol-result"><col class="vcol-pace"><col class="vcol-platz">' + (_hasMstr ? '<col class="vcol-ms"><col class="vcol-ms-platz">' : '') + '</colgroup><thead><tr><th>Athlet*in</th><th>AK</th><th>Ergebnis</th><th>Pace</th><th>Pl. AK</th>' + (_hasMstr ? '<th>Meisterschaft</th><th>Pl. MS</th>' : '') + '</tr></thead><tbody>' + rows + '</tbody></table></div>' :
                '<div class="empty" style="padding:16px">Keine Ergebnisse</div>') +
      '</div>';
  }
  if (!html) html = '<div class="empty"><div class="empty-icon">&#x1F4CD;</div><div class="empty-text">Keine Veranstaltungen gefunden</div></div>';

  var searchBar = '<div class="filter-bar" style="margin-bottom:16px">' +
    '<div class="fg"><label>Suche</label><input type="search" id="veranst-suche" placeholder="Veranstaltung suchen&hellip;" value="' + (state.veranstSuche || '').replace(/"/g,'&quot;') + '" oninput="setVeranstSuche(this.value)" style="min-width:0;width:100%"/></div>' +
  '</div>';

  el.innerHTML = _veranstViewToggleHtml() + searchBar + html + buildPagination(state.veranstPage, Math.ceil(total/10), total, 'goPageVeranst');
  _restoreFocus(_vFoc);
}

// ── SERIEN-LISTE ───────────────────────────────────────────
async function renderSerienListe() {
  var el = document.getElementById('main-content');
  el.innerHTML = '<div class="loading"><div class="spinner"></div>Laden&hellip;</div>';
  var r = await apiGet('veranstaltung-serien');
  if (!r || !r.ok) {
    el.innerHTML = _veranstViewToggleHtml() + '<div class="panel" style="padding:24px;color:var(--accent)">Fehler: ' + (r && r.fehler ? r.fehler : 'Unbekannt') + '</div>';
    return;
  }
  var serien = r.data || [];
  var canEdit = currentUser && (currentUser.rolle === 'admin' || currentUser.rolle === 'editor');

  var html = _veranstViewToggleHtml();
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

  var view    = state.serieView || 'jahre';
  var canEdit = currentUser && (currentUser.rolle === 'admin' || currentUser.rolle === 'editor');

  var jahre = veranst.map(function(v){ return parseInt(v.jahr); });
  var jahrMin = jahre.length ? Math.min.apply(null, jahre) : null;
  var jahrMax = jahre.length ? Math.max.apply(null, jahre) : null;

  var html = _serieBackBtn();
  html += '<div class="panel" style="margin-bottom:16px;padding:18px 22px">';
  html += '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap">';
  html += '<div>';
  html += '<div style="font-size:22px;font-weight:700;line-height:1.2">' + serie.name + '</div>';
  html += '<div style="font-size:13px;color:var(--text2);margin-top:3px">';
  html += veranst.length + ' Austragung' + (veranst.length != 1 ? 'en' : '');
  if (jahrMin) html += ' &middot; ' + (jahrMin === jahrMax ? jahrMin : jahrMin + '&ndash;' + jahrMax);
  html += '</div>';
  html += '</div>';
  if (canEdit) {
    html += '<button class="btn btn-ghost btn-sm" onclick="showSerieEditModal(' + serie.id + ',\'' + serie.name.replace(/'/g,"\\'") + '\')">&#x270F;&#xFE0F; Bearbeiten</button>';
  }
  html += '</div></div>';

  // Sub-Tabs
  html += '<div style="display:flex;gap:8px;margin-bottom:16px">' +
    '<button class="btn' + (view === 'jahre' ? ' btn-primary' : ' btn-ghost') + '" onclick="setSerieView(\'jahre\')">\uD83D\uDCC5 Ergebnisse nach Jahr</button>' +
    '<button class="btn' + (view === 'bestleistungen' ? ' btn-primary' : ' btn-ghost') + '" onclick="setSerieView(\'bestleistungen\')">\uD83C\uDFC6 Bestleistungen</button>' +
    '<button class="btn' + (view === 'teilnahmen' ? ' btn-primary' : ' btn-ghost') + '" onclick="setSerieView(\'teilnahmen\')">\uD83D\uDCCA Anzahl Teilnahmen</button>' +
  '</div>';

  if (view === 'jahre') {
    html += _buildSerieJahreHtml(veranst);
  } else if (view === 'teilnahmen') {
    html += '<div id="serie-teilnahmen-content"><div class="loading" style="padding:32px"><div class="spinner"></div>Lade Teilnahmen&hellip;</div></div>';
  } else {
    html += _buildSerieBestleistungenShell(disziplinen, id);
  }

  el.innerHTML = html;

  if (view === 'bestleistungen') {
    var toLoad = state.serieDisz ? { disziplin: state.serieDisz, disziplin_mapping_id: state.serieMappingId } : disziplinen[0];
    if (toLoad) {
      state.serieDisz = toLoad.disziplin;
      state.serieMappingId = toLoad.disziplin_mapping_id || null;
      _highlightSerieDiszBtn(state.serieDisz, state.serieMappingId);
      _loadSerieBestleistungen(id, state.serieDisz, state.serieMappingId);
    }
  } else if (view === 'teilnahmen') {
    _loadSerieTeilnahmen(id);
  }
}

function _serieBackBtn() {
  return '<button class="btn btn-ghost btn-sm" style="margin-bottom:14px" onclick="switchVeranstView(\'serien\')">&larr; Alle regelmäßigen Veranstaltungen</button> ';
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
    var rows = '';
    var byDisz = {}; var diszOrder = [];
    for (var ei = 0; ei < v.ergebnisse.length; ei++) {
      var e = v.ergebnisse[ei];
      var _dk = ergDiszKey(e);
      if (!byDisz[_dk]) { byDisz[_dk] = []; diszOrder.push(_dk); }
      byDisz[_dk].push(e);
    }
    var _hasMstr = v.ergebnisse.some(function(e3){ return !!e3.meisterschaft; });
    sortDisziplinen(diszOrder);
    for (var di = 0; di < diszOrder.length; di++) {
      var _dKey = diszOrder[di];
      var _df = byDisz[_dKey][0];
      var diszLabel = _df ? ergDiszLabel(_df) : _dKey;
      var ergs = byDisz[_dKey];
      rows += '<tr class="disz-header-row"><td colspan="' + (_hasMstr ? '7' : '5') + '" class="disziplin-text" style="background:var(--surf2);font-weight:600;padding:6px 12px">' + diszLabel + '</td></tr>';
      for (var ei2 = 0; ei2 < ergs.length; ei2++) {
        var e2 = ergs[ei2];
        var fmt = e2.fmt || '';
        var res = fmt === 'm' ? fmtMeter(e2.resultat) : fmtTime(e2.resultat, fmt === 's' ? 's' : undefined);
        var _ePace = diszKm(e2.disziplin) >= 1 ? calcPace(e2.disziplin, e2.resultat) : '';
        var showPace = _ePace && _ePace !== '00:00' && fmt !== 'm' && fmt !== 's';
        rows +=
          '<tr>' +
            '<td><span class="athlet-link" onclick="openAthletById(' + e2.athlet_id + ')">' + e2.athlet + '</span></td>' +
            '<td>' + akBadge(e2.altersklasse) + '</td>' +
            '<td class="result">' + res + '</td>' +
            '<td class="ort-text">' + (showPace ? fmtTime(_ePace, 'min/km') : '') + '</td>' +
            '<td>' + medalBadge(e2.ak_platzierung) + '</td>' +
            (_hasMstr ? '<td>' + mstrBadge(e2.meisterschaft) + '</td>' : '') +
            (_hasMstr ? '<td class="ort-text" style="font-size:12px">' + (e2.meisterschaft && e2.ak_platz_meisterschaft ? medalBadge(e2.ak_platz_meisterschaft) : '') + '</td>' : '') +
          '</tr>';
      }
    }
    html +=
      '<div class="panel" style="margin-bottom:16px">' +
        '<div class="panel-header">' +
          '<div>' +
            '<div class="panel-title" style="cursor:pointer" onclick="window.open(location.origin+location.pathname+\'#veranstaltung/' + v.id + '\',\'_blank\')">' +
              '<span style="font-size:20px;font-weight:800;color:var(--primary);margin-right:10px">' + v.jahr + '</span>' + name +
            '</div>' +
            '<div style="font-size:12px;color:var(--text2);margin-top:2px">' + formatDate(v.datum) + (v.ort ? ' &middot; ' + v.ort : '') + '</div>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:8px">' +
            '<span style="font-size:13px;color:var(--text2)">' + v.anz_ergebnisse + ' Ergebnisse &middot; ' + v.anz_athleten + ' Athleten</span>' +
            (v.datenquelle ? '<a href="' + v.datenquelle.replace(/"/g,'&quot;') + '" target="_blank" class="btn btn-ghost btn-sm" title="Ergebnisquelle">\uD83C\uDF10</a>' : '') +
          '</div>' +
        '</div>' +
        (rows ?
          '<div class="table-scroll"><table class="veranst-dash-table"><colgroup><col class="vcol-athlet"><col class="vcol-ak"><col class="vcol-result"><col class="vcol-pace"><col class="vcol-platz">' + (_hasMstr ? '<col class="vcol-ms"><col class="vcol-ms-platz">' : '') + '</colgroup>' +
          '<thead><tr><th>Athlet*in</th><th>AK</th><th>Ergebnis</th><th>Pace</th><th>Pl. AK</th>' + (_hasMstr ? '<th>Meisterschaft</th><th>Pl. MS</th>' : '') + '</tr></thead>' +
          '<tbody>' + rows + '</tbody></table></div>' :
          '<div class="empty" style="padding:16px">Keine Ergebnisse</div>') +
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

async function _loadSerieBestleistungen(serieId, disz, mappingId) {
  var container = document.getElementById('serie-best-content');
  if (!container) return;
  container.innerHTML = '<div class="loading" style="padding:32px"><div class="spinner"></div>Lade&hellip;</div>';
  var params = 'disz=' + encodeURIComponent(disz);
  if (mappingId) params += '&mapping_id=' + mappingId;
  var r = await apiGet('veranstaltung-serien/' + serieId + '?' + params);
  if (!r || !r.ok) {
    container.innerHTML = '<div style="color:var(--accent);padding:16px">Fehler: ' + (r && r.fehler ? r.fehler : 'Unbekannt') + '</div>';
    return;
  }
  var d   = r.data;
  var fmt = d.fmt || 'min';
  var TOP = 10;

  function pbDedup(rows) {
    var seen = {}; var out = [];
    for (var i = 0; i < rows.length && out.length < TOP; i++) {
      var key = rows[i].athlet_id || rows[i].athlet;
      if (!seen[key]) { seen[key] = true; out.push(rows[i]); }
    }
    return out;
  }

  var showPace = diszKm(disz) >= 1 && fmt !== 'm' && fmt !== 's';
  var fakeRekState = { highlightCurYear: false, highlightPrevYear: false, disz: disz, rekState: state.rekState || {} };

  function sectionHead(label) {
    return '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:18px;font-weight:600;color:var(--text);border-bottom:2px solid var(--border);padding-bottom:6px;margin:0 0 14px">' + label + '</div>';
  }

  var shtml = sectionHead('Gesamt');
  shtml += '<div class="panel" style="overflow:hidden;margin-bottom:28px">' + buildRekTable(pbDedup(d.gesamt || []), fmt, false, showPace, 'Athlet*in', disz) + '</div>';

  shtml += sectionHead('Frauen / M&auml;nner');
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
      var isW = /^W/.test(ak) || ak === 'WHK';
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

  container.innerHTML = '<div class="panel" style="padding:20px 24px">' + shtml + '</div>';
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
    '<h2>\uD83D\uDD04 Neue regelmäßige Veranstaltung <button class="modal-close" onclick="closeModal()">&#x2715;</button></h2>' +
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
    '<h2>&#x270F;&#xFE0F; Serie bearbeiten <button class="modal-close" onclick="closeModal()">&#x2715;</button></h2>' +
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
  if (!confirm('Serie "' + name + '" l\u00f6schen?\nDie Veranstaltungen selbst bleiben erhalten, werden aber keiner Serie mehr zugeordnet.')) return;
  var r = await api('DELETE', 'veranstaltung-serien/' + id);
  if (r && r.ok) { notify('Gel\u00f6scht.', 'ok'); switchVeranstView('serien'); }
  else notify((r && r.fehler) || 'Fehler', 'err');
}

// ── Veranstaltung-Edit (mit Serie-Zuweisung) ──────────────
function showVeranstEditModal(id) {
  var v = state._veranstMap && state._veranstMap[id];
  if (!v) return;
  var serien   = window._lastSerienList || [];
  var curName  = v.name  || '';
  var curDatum = (v.datum || '').slice(0, 10);
  var curOrt   = v.ort   || '';
  var curSerie = v.serie_id || '';

  var serieOptHtml = '<option value="">&#8212; Keine Serie &#8212;</option>';
  for (var i = 0; i < serien.length; i++) {
    serieOptHtml += '<option value="' + serien[i].id + '"' + (String(serien[i].id) === String(curSerie) ? ' selected' : '') + '>' + serien[i].name + '</option>';
  }

  showModal(
    '<h2>&#x270F;&#xFE0F; Veranstaltung bearbeiten <button class="modal-close" onclick="closeModal()">&#x2715;</button></h2>' +
    '<div class="form-grid">' +
      '<div class="form-group full"><label>Name (optional)</label>' +
        '<input type="text" id="ve-name" value="' + curName.replace(/"/g,'&quot;') + '" placeholder="z.B. 44. Stra&szlig;enlauf Rund um das Bayer-Kreuz"/></div>' +
      '<div class="form-group"><label>Datum</label>' +
        '<input type="date" id="ve-datum" value="' + curDatum + '"/></div>' +
      '<div class="form-group"><label>Ort</label>' +
        '<input type="text" id="ve-ort" value="' + curOrt.replace(/"/g,'&quot;') + '" placeholder="z.B. Leverkusen"/></div>' +
      '<div class="form-group full"><label>\uD83D\uDD04 Serie (optional)</label>' +
        '<select id="ve-serie">' + serieOptHtml + '</select></div>' +
    '</div>' +
    '<div class="modal-actions">' +
      '<button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button>' +
      '<button class="btn btn-primary" onclick="saveVeranstaltung(' + id + ')">Speichern</button>' +
    '</div>'
  );
}

async function saveVeranstaltung(id) {
  var serieEl = document.getElementById('ve-serie');
  var body = {
    name:     document.getElementById('ve-name').value.trim() || null,
    datum:    document.getElementById('ve-datum').value,
    ort:      document.getElementById('ve-ort').value.trim() || null,
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
    if (!confirm('Veranstaltung "' + name + '" und ' + anz + ' Ergebnisse in den Papierkorb verschieben?')) return;
    var r = await api('DELETE', 'veranstaltungen/' + id + '?force=1');
  } else {
    if (!confirm('Veranstaltung "' + name + '" in den Papierkorb verschieben?')) return;
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
  container.innerHTML = '<div class="loading" style="padding:32px"><div class="spinner"></div>Lade\u2026</div>';

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

  // Alle Austragungsjahre chronologisch
  var serieJahre = [];
  var ergMap = {}; // ergMap[athlet_id][jahr] = [{disziplin, resultat}, ...]
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

  // Gleichstand ermitteln
  var counts = rows.map(function(r){return r.teilnahmen;});

  var html = '<div class="panel" style="padding:20px 24px">';
  html += '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:18px;font-weight:600;color:var(--text);border-bottom:2px solid var(--border);padding-bottom:6px;margin-bottom:16px">Teilnahmen-Ranking</div>';

  var tlHeader = serieJahre.map(function(j) {
    return '<th style="text-align:center;width:38px;min-width:38px;font-size:11px;font-weight:600;color:var(--text2);padding:4px 2px">' + j + '</th>';
  }).join('');

  html += '<div class="table-scroll"><table class="rek-table" style="width:100%">';
  html += '<thead><tr>' +
    '<th style="width:34px"></th>' +
    '<th style="text-align:left;min-width:140px">Athlet*in</th>' +
    '<th style="text-align:right;width:44px">&#x2211;</th>' +
    tlHeader +
    '</tr></thead><tbody>';

  var rank = 1;
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    // Gleichstand: gleiche Startzahl wie Vorgänger → kein Badge
    if (i > 0 && rows[i].teilnahmen === rows[i-1].teilnahmen) {
      rank = rank; // bleibt gleich, Badge leer
    } else {
      rank = i + 1;
    }
    var showBadge = (i === 0 || rows[i].teilnahmen !== rows[i-1].teilnahmen);
    var jahrSet = {};
    (row.jahre || []).forEach(function(j){ jahrSet[j] = true; });

    var erId = row.athlet_id;
    var tlCells = serieJahre.map(function(j) {
      var present = !!jahrSet[j];
      var tipText = '';
      if (present && ergMap[erId] && ergMap[erId][j]) {
        tipText = ergMap[erId][j].map(function(e){
          var res = typeof fmtTime === 'function' ? fmtTime(e.resultat) : e.resultat;
          return e.disziplin + ': ' + res;
        }).join(' | ');
      }
      return '<td style="text-align:center;padding:6px 2px">' +
        '<div title="' + (tipText || (present ? j : '\u2013')) + '" style="width:20px;height:20px;border-radius:50%;margin:0 auto;cursor:' + (present?'default':'default') + ';' +
          (present
            ? 'background:var(--primary);box-shadow:0 1px 3px rgba(0,0,0,.2)'
            : 'background:transparent;border:1.5px solid var(--border)') +
        '"></div></td>';
    }).join('');

    html += '<tr style="border-bottom:1px solid var(--border)">' +
      '<td style="padding:6px 4px">' + (showBadge ? medalBadge(rank) : '') + '</td>' +
      '<td style="font-weight:600;padding:6px 8px 6px 4px;font-size:13px"><span class="athlet-link" data-athlet-id="' + row.athlet_id + '">' + row.athlet + '</span></td>' +
      '<td style="text-align:right;font-family:\'Barlow Condensed\',sans-serif;font-size:17px;font-weight:700;color:var(--primary);padding:6px 8px 6px 4px">' + row.teilnahmen + '</td>' +
      tlCells +
      '</tr>';
  }

  html += '</tbody></table></div>';
  html += '<div style="display:flex;gap:18px;margin-top:12px;font-size:11px;color:var(--text2);align-items:center">' +
    '<div style="display:flex;align-items:center;gap:5px"><div style="width:13px;height:13px;border-radius:50%;background:var(--primary)"></div>Gestartet</div>' +
    '<div style="display:flex;align-items:center;gap:5px"><div style="width:13px;height:13px;border-radius:50%;border:1.5px solid var(--border)"></div>Nicht gestartet</div>' +
  '</div>';
  html += '</div>';
  container.innerHTML = html;

  container.addEventListener('click', function(ev) {
    var al = ev.target.closest('.athlet-link[data-athlet-id]');
    if (al) openAthletById(parseInt(al.dataset.athletId));
  });
}
