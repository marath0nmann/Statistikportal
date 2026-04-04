var _veranstSucheTimer = null;
function setVeranstSuche(val) {
  clearTimeout(_veranstSucheTimer);
  _veranstSucheTimer = setTimeout(function() {
    state.veranstSuche = val.trim();
    state.veranstPage = 1;
    renderVeranstaltungen();
  }, 300);
}

async function renderVeranstaltungen() {
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
  var total = r.data.total || 0;
  window._lastVeranstList = veranst;
  window._lastVeranstList = veranst; // Cache fuer shareVeranstaltung
  // Cache für Edit-Modal
  state._veranstMap = {};
  for (var ci = 0; ci < veranst.length; ci++) state._veranstMap[veranst[ci].id] = veranst[ci];
  var html = '';
  for (var vi = 0; vi < veranst.length; vi++) {
    var v = veranst[vi];
    var name = v.name || (v.kuerzel || '').split(' ').slice(1).join(' ') || v.kuerzel || '';
    var rows = '';
    // Gruppiere nach Disziplin
    var byDisz = {};
    var diszOrder = [];
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
      // ergDiszLabel gibt bereits HTML mit Kategorie zurück — nicht nochmal durch diszMitKat
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
    html +=
      '<div class="panel" style="margin-bottom:16px">' +
        '<div class="panel-header">' +
          '<div>' +
            '<div class="panel-title" style="cursor:pointer" onclick="window.open(location.origin+location.pathname+\'#veranstaltung/' + v.id + '\',\'_blank\')">' + name + '</div>' +
            '<div style="font-size:12px;color:var(--text2);margin-top:2px">' + formatDate(v.datum) + (v.ort ? ' &middot; ' + v.ort : '') + '</div>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:10px">' +
            '<span style="font-size:13px;color:var(--text2)">' + v.anz_ergebnisse + ' Ergebnisse &middot; ' + v.anz_athleten + ' Athleten</span>' +
            (currentUser && (currentUser.rolle === 'admin' || currentUser.rolle === 'editor') ?
              '<button class="btn btn-ghost btn-sm" onclick="showVeranstEditModal(' + v.id + ')">&#x270F;&#xFE0F;</button>' : '') +
            (v.datenquelle ? '<a href="' + v.datenquelle.replace(/"/g,'&quot;') + '" target="_blank" class="btn btn-ghost btn-sm" title="Ergebnisquelle">\uD83C\uDF10</a>' : '') +
            '<button class="btn btn-ghost btn-sm" title="Teilen" onclick="shareVeranstaltung(' + v.id + ')">\uD83D\uDCE4</button>' +
                        (_canVeranstaltungLoeschen() ?
              '<button class="btn btn-danger btn-sm" onclick="deleteVeranstaltung(' + v.id + ',\'' + name.replace(/'/g, "\\'") + '\')">&#x2715;</button>' : '') +
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
  el.innerHTML = searchBar + html + buildPagination(state.veranstPage, Math.ceil(total/10), total, 'goPageVeranst');
  _restoreFocus(_vFoc);
}


function showVeranstEditModal(id) {
  var v = state._veranstMap && state._veranstMap[id];
  if (!v) return;
  var curName = v.name || '';
  var curDatum = (v.datum || '').slice(0, 10);
  var curOrt = v.ort || '';
  showModal(
    '<h2>&#x270F;&#xFE0F; Veranstaltung bearbeiten <button class="modal-close" onclick="closeModal()">&#x2715;</button></h2>' +
    '<div class="form-grid">' +
      '<div class="form-group full"><label>Name (optional)</label>' +
        '<input type="text" id="ve-name" value="' + curName + '" placeholder="z.B. 44. Stra&szlig;enlauf Rund um das Bayer-Kreuz"/></div>' +
      '<div class="form-group"><label>Datum</label>' +
        '<input type="date" id="ve-datum" value="' + curDatum + '"/></div>' +
      '<div class="form-group"><label>Ort</label>' +
        '<input type="text" id="ve-ort" value="' + curOrt + '" placeholder="z.B. Leverkusen"/></div>' +
    '</div>' +
    '<div class="modal-actions">' +
      '<button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button>' +
      '<button class="btn btn-primary" onclick="saveVeranstaltung(' + id + ')">Speichern</button>' +
    '</div>'
  );
}

async function saveVeranstaltung(id) {
  var body = {
    name:  document.getElementById('ve-name').value.trim() || null,
    datum: document.getElementById('ve-datum').value,
    ort:   document.getElementById('ve-ort').value.trim() || null,
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
