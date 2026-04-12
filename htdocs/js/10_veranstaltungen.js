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

async function renderVeranstaltungen() {
  if ((state.veranstView || 'liste') === 'serie-detail') { await renderSerieDetail(state.serieId); return; }
  await renderVeranstaltungenListe();
}

// ── LISTE ──────────────────────────────────────────────────
async function renderVeranstaltungenListe() {
  var el = document.getElementById('main-content');

  // Shell (Serien + Suchfeld) nur einmalig rendern – nie beim Suchen ersetzen
  var shellEl = document.getElementById('veranst-shell');
  if (!shellEl) {
    el.innerHTML =
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

  // Shell befüllen (nur wenn leer oder Serien sich geändert haben)
  var serienHtml = '';
  if (serien && serien.length) {
    serienHtml = '<div style="margin-bottom:16px">' +
      '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text2);margin-bottom:8px">🔄 Regelmäßige Veranstaltungen</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:8px">';
    for (var si = 0; si < serien.length; si++) {
      var s = serien[si];
      serienHtml += '<button class="btn btn-ghost btn-sm" style="font-size:13px" onclick="openSerieDetail(' + s.id + ')">' + (s.name || s.kuerzel || 'Serie') + '</button>';
    }
    serienHtml += '</div></div>';
  }
  var searchBar = '<div class="filter-bar" style="margin-bottom:16px">' +
    '<div class="fg"><label>Suche</label><input type="search" id="veranst-suche" placeholder="Veranstaltung suchen&hellip;" value="' + (state.veranstSuche || '').replace(/"/g,'&quot;') + '" oninput="setVeranstSuche(this.value)" style="min-width:0;width:100%"/></div>' +
  '</div>';
  if (!shellEl.dataset.built) {
    shellEl.innerHTML = serienHtml + searchBar;
    shellEl.dataset.built = '1';
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
            '<td><span class="athlet-link" onclick="openAthletById(' + e2.athlet_id + ')">' + e2.athlet + '</span>' + (e2.extern ? ' <span title="Externes Ergebnis" style="font-size:10px;color:var(--text2);opacity:.7">(ext.)</span>' : '') + '</td>' +
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

  resultsEl.innerHTML = html + buildPagination(state.veranstPage, Math.ceil(total/10), total, 'goPageVeranst');
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

  // Alle Sektionen auf einer Seite: Teilnahmen → Bestleistungen → Ergebnisse nach Jahr
  var secStyle = 'font-family:\'Barlow Condensed\',sans-serif;font-size:16px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text2)';
  html += '<div style="' + secStyle + ';margin:0 0 10px">&#x1F4CA; Anzahl Teilnahmen</div>';
  html += '<div id="serie-teilnahmen-content"><div class="loading" style="padding:24px"><div class="spinner"></div>Lade…</div></div>';

  html += '<div style="' + secStyle + ';margin:32px 0 10px">&#x1F3C6; Bestleistungen</div>';
  html += _buildSerieBestleistungenShell(disziplinen, id);

  html += '<div style="' + secStyle + ';margin:32px 0 10px">&#x1F4C5; Ergebnisse nach Jahr</div>';
  html += _buildSerieJahreHtml(veranst);

  el.innerHTML = html;

  // Bestleistungen laden
  var toLoad = state.serieDisz ? { disziplin: state.serieDisz, disziplin_mapping_id: state.serieMappingId } : disziplinen[0];
  if (toLoad) {
    state.serieDisz = toLoad.disziplin;
    state.serieMappingId = toLoad.disziplin_mapping_id || null;
    _highlightSerieDiszBtn(state.serieDisz, state.serieMappingId);
    _loadSerieBestleistungen(id, state.serieDisz, state.serieMappingId);
  }
  _loadSerieTeilnahmen(id);
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
            '<td><span class="athlet-link" onclick="openAthletById(' + e2.athlet_id + ')">' + e2.athlet + '</span>' + (e2.extern ? ' <span title="Externes Ergebnis" style="font-size:10px;color:var(--text2);opacity:.7">(ext.)</span>' : '') + '</td>' +
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
  var TOP = 10;

  function pbDedup(rows) {
    return rows.slice(0, TOP); // dedup happens server-side based on unique param
  }

  var showPace = diszKm(disz) >= 1 && fmt !== 'm' && fmt !== 's';
  var rs2 = rs2 || state.rekState || {}; // already declared above

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

  var tlHeader = serieJahre.map(function(j) {
    return '<th style="text-align:center;width:38px;min-width:38px;font-size:11px;font-weight:600;color:var(--text2);padding:4px 2px">' + j + '</th>';
  }).join('');

  var html = '<div class="table-scroll" style="display:inline-block;max-width:100%"><table class="rek-table" style="width:auto">';
  html += '<thead><tr>' +
    '<th style="width:34px"></th>' +
    '<th style="text-align:left;min-width:140px">Athlet*in</th>' +
    '<th style="text-align:right;width:44px">&#x2211;</th>' +
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

  html += '</tbody></table></div>';
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
