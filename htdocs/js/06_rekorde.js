// ── REKORDE ────────────────────────────────────────────────
var REK_CATS = []; // wird dynamisch geladen

async function renderRekorde() {
  var rs = state.rekState;
  // Defaults: erst aus gespeicherten User-Prefs, dann hard-coded Defaults
  var _up = state.userPrefs || {};
  if (rs.unique           === undefined) rs.unique           = _up.rek_unique   !== undefined ? !!_up.rek_unique   : true;
  if (rs.highlightCurYear === undefined) rs.highlightCurYear = _up.rek_hl_cur   !== undefined ? !!_up.rek_hl_cur   : true;
  if (rs.highlightPrevYear=== undefined) rs.highlightPrevYear= _up.rek_hl_prev  !== undefined ? !!_up.rek_hl_prev  : false;
  if (rs.mergeAK          === undefined) rs.mergeAK          = _up.rek_merge_ak !== undefined ? !!_up.rek_merge_ak : true;
  var el = document.getElementById('main-content');

  // Kategorien dynamisch laden (nur mit Einträgen)
  if (!REK_CATS.length) {
    el.innerHTML = '<div class="loading"><div class="spinner"></div>Laden&hellip;</div>';
    var rk = await apiGet('kategorien');
    if (rk && rk.ok) {
      REK_CATS = rk.data
        .filter(function(k) { return parseInt(k.disz_anzahl) > 0; })
        .sort(function(a,b) { return a.reihenfolge - b.reihenfolge; })
        .map(function(k) { return { id: k.tbl_key, label: k.name, fmt: k.fmt === 'm' ? 'm' : k.fmt === 's' ? 's' : undefined }; });
    }
    if (!REK_CATS.length) {
      el.innerHTML = '<div class="empty"><div class="empty-icon">&#x1F3C6;</div><div class="empty-text">Keine Kategorien mit Ergebnissen vorhanden</div></div>';
      return;
    }
    if (!rs.kat) rs.kat = REK_CATS[0].id;
  }
  // Sicherstellen dass kat noch gültig ist
  var katValid = false;
  for (var ci = 0; ci < REK_CATS.length; ci++) { if (REK_CATS[ci].id === rs.kat) { katValid = true; break; } }
  if (!katValid) rs.kat = REK_CATS[0].id;

  if (!state.allDisziplinen) state.allDisziplinen = {};
  if (!state.topDisziplinen) state.topDisziplinen = {};

  if (!state.allDisziplinen[rs.kat] || !state.topDisziplinen[rs.kat]) {
    el.innerHTML = '<div class="loading"><div class="spinner"></div>Laden&hellip;</div>';
    var p1 = apiGet('rekorde/disziplinen?kat=' + rs.kat).then(function(r) {
      if (!r || !r.ok) { console.error('disziplinen Fehler:', r && r.fehler, r && r.trace); }
      state.allDisziplinen[rs.kat] = (r && r.ok) ? r.data : [];
    });
    var p2 = apiGet('rekorde/top-disziplinen?kat=' + rs.kat).then(function(r) {
      if (!r || !r.ok) { console.error('top-disziplinen Fehler:', r && r.fehler, r && r.trace); }
      state.topDisziplinen[rs.kat] = (r && r.ok) ? r.data : [];
    });
    await Promise.all([p1, p2]);
    // Diagnose: zeige Fehler im UI falls leer
    if (!state.allDisziplinen[rs.kat] || !state.allDisziplinen[rs.kat].length) {
      el.innerHTML = '<div class="panel" style="padding:24px;color:var(--accent)"><strong>Disziplinen konnten nicht geladen werden.</strong><br>Kategorie: <code>' + rs.kat + '</code><br>Bitte die Browser-Konsole (F12) prüfen.</div>';
      return;
    }
  }

  var diszList = state.allDisziplinen[rs.kat] || [];
  var topDisz  = state.topDisziplinen[rs.kat] || [];
  var topNames = topDisz.map(function(t) { return t.disziplin; });
  if (!rs.disz && topNames.length) { rs.disz = topNames[0]; rs.mapping_id = topDisz[0] ? (topDisz[0].mapping_id || null) : null; }
  else if (!rs.disz && diszList.length) { rs.disz = diszList[0].disziplin || diszList[0]; rs.mapping_id = diszList[0].mapping_id || null; }

  // Kategorie-Tabs
  var catHtml = '<div class="rek-cat-tabs">';
  for (var ci = 0; ci < REK_CATS.length; ci++) {
    var cat = REK_CATS[ci];
    catHtml += '<button class="rek-cat-btn' + (rs.kat === cat.id ? ' active' : '') + '" data-kat="' + cat.id + '" onclick="setRekKat(this.dataset.kat)">' + cat.label + '</button>';
  }
  catHtml += '</div>';

  // Top-5 prominent
  var topHtml = '<div class="rek-top-disz">';
  for (var ti = 0; ti < topNames.length; ti++) {
    var td = topNames[ti];
    var cnt = topDisz[ti].cnt;
    topHtml += '<button class="rek-top-btn' + (rs.disz === td ? ' active' : '') + '" data-disz="' + td.replace(/"/g, '&quot;') + '" onclick="setRekDisz(this.dataset.disz, this.dataset.mid)">' +
      '<span class="rek-top-name">' + td + '</span>' +
      '<span class="rek-top-cnt">' + cnt + (cnt === 1 ? ' Ergebnis' : ' Ergebnisse') + '</span>' +
    '</button>';
  }
  topHtml += '</div>';

  // Weitere Disziplinen
  // Weitere Disziplinen
  var restDisz = diszList.filter(function(d) { return topNames.indexOf(typeof d === 'object' ? d.disziplin : d) < 0; });
  var diszHtml = '';
  if (restDisz.length) {
    diszHtml += '<div style="font-size:11px;font-weight:600;text-transform:uppercase;color:var(--text2);letter-spacing:.06em;margin:4px 0 6px">Weitere Disziplinen</div>';
    diszHtml += '<div class="rek-top-disz" style="margin-top:0">';
    for (var di = 0; di < restDisz.length; di++) {
      var dd = typeof restDisz[di] === 'object' ? restDisz[di].disziplin : restDisz[di];
      var ddcnt = typeof restDisz[di] === 'object' ? (restDisz[di].cnt || 0) : 0;
      var ddmid = typeof restDisz[di] === 'object' ? (restDisz[di].mapping_id || '') : '';
      diszHtml += '<button class="rek-top-btn rek-top-btn--sm' + (rs.disz === dd ? ' active' : '') + '" data-disz="' + dd.replace(/"/g, '&quot;') + '" data-mid="' + ddmid + '" onclick="setRekDisz(this.dataset.disz, this.dataset.mid)">' +
        '<span class="rek-top-name">' + dd + '</span>' +
        '<span class="rek-top-cnt">' + ddcnt + (ddcnt === 1 ? ' Ergebnis' : ' Ergebnisse') + '</span>' +
      '</button>';
    }
    diszHtml += '</div>';
  } else {
    diszHtml = '<div style="height:8px"></div>';
  }
  if (!rs.disz) {
    el.innerHTML = catHtml + topHtml + diszHtml + '<div class="empty"><div class="empty-icon">&#x1F50D;</div><div class="empty-text">Keine Disziplinen vorhanden</div></div>';
    return;
  }

  el.innerHTML = catHtml + topHtml + diszHtml + '<div class="loading" style="padding:32px"><div class="spinner"></div>Lade Rekorde&hellip;</div>';

  var _midParam = rs.mapping_id ? '&mapping_id=' + rs.mapping_id : '';
  var r = await apiGet('rekorde?kat=' + rs.kat + '&disz=' + encodeURIComponent(rs.disz) + _midParam + '&merge_ak=' + (rs.mergeAK ? '1' : '0'));
  if (!r || !r.ok) {
    el.innerHTML = catHtml + topHtml + diszHtml + '<div class="panel" style="padding:24px;text-align:center;color:var(--accent)">' + (r && r.fehler ? r.fehler : 'Fehler') + '</div>';
    return;
  }
  var d = r.data;
  var catMeta = null;
  for (var ci = 0; ci < REK_CATS.length; ci++) { if (REK_CATS[ci].id === rs.kat) { catMeta = REK_CATS[ci]; break; } }
  var fmt = catMeta ? catMeta.fmt : undefined;

  var TOP = 10;
  function uniqueRows(rows) {
    if (!rs.unique) return rows.slice(0, TOP);
    var seen = {}; var out = [];
    for (var i = 0; i < rows.length && out.length < TOP; i++) {
      var key = rows[i].athlet_id || rows[i].athlet;
      if (!seen[key]) { seen[key] = true; out.push(rows[i]); }
    }
    return out;
  }

  var titleHtml = '<div class="rek-disz-title">' + rs.disz + '</div>';

  // ── 1. GESAMT ─────────────────────────────────────────────
  var sectionHtml = rekSectionHead('Gesamt');
  sectionHtml += '<div class="panel" style="overflow-x:auto;margin-bottom:28px">' + buildRekTable(uniqueRows(d.gesamt || []), fmt, false, rs.kat === 'strasse', 'Athlet*in') + '</div>';

  // ── 2. MÄNNER / FRAUEN ────────────────────────────────────
  var mRows = uniqueRows(d.maenner || []);
  var wRows = uniqueRows(d.frauen  || []);
  sectionHtml += rekSectionHead('Frauen / M&auml;nner');
  sectionHtml +=
    '<div class="mw-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:28px">' +
      '<div class="rek-ak-card">' +
        '<div class="rek-ak-header" style="background:var(--primary);color:var(--on-primary)">Frauen</div>' +
        buildRekTable(wRows, fmt, false, rs.kat === 'strasse', 'Athletin') +
      '</div>' +
      '<div class="rek-ak-card">' +
        '<div class="rek-ak-header">M&auml;nner</div>' +
        buildRekTable(mRows, fmt, false, rs.kat === 'strasse', 'Athlet') +
      '</div>' +
    '</div>';

  // ── 3. NACH AK ────────────────────────────────────────────
  var byAk = d.by_ak || {};
  var akKeys = Object.keys(byAk);
  akKeys.sort(function(a, b) {
    // Gibt einen sortierbaren String zurück
    // Reihenfolge: W-Jugend, W-Senior (aufsteigend), wjB, wjA, WU23, WU18, WHK, W30+
    //              M-Jugend, M-Senior (aufsteigend), mjB, mjA, MHK, M30+
    function rank(k) {
      // Numerische AK extrahieren: M35 → 35, W10 → 10
      var numMatch = k.match(/^([MW])(\d+)$/);
      if (numMatch) {
        var g = numMatch[1] === 'W' ? '1' : '2';
        var n = parseInt(numMatch[2], 10);
        // Jugend (< 20) vor HK-Bereich (20-29) vor Masters (30+)
        // Jugend: 0100–0119, HK-Bereich (MHK-Slot): 0120–0129, Masters: 0130+
        var slot = n < 20 ? (100 + n) : n < 30 ? (200 + n) : (300 + n);
        return g + '_' + String(slot).padStart(4, '0');
      }
      // Sonderfälle Frauen
      if (k === 'WU8')      return '1_0108';
      if (k === 'WU10-U12') return '1_0110';
      if (k === 'WU18')     return '1_0118';
      if (k === 'WU23')     return '1_0123';
      if (k === 'wjB')      return '1_0214'; // vor mjA/MHK-Slot
      if (k === 'wjA')      return '1_0215';
      if (k === 'WHK')      return '1_0220';
      if (k === 'F' || k === 'W') return '1_0221';
      // Sonderfälle Männer
      if (k === 'MU8')      return '2_0108';
      if (k === 'MU10-12')  return '2_0110';
      if (k === 'MU18')     return '2_0118';
      if (k === 'MU20')     return '2_0120';
      if (k === 'MU23')     return '2_0123';
      if (k === 'mjB')      return '2_0214';
      if (k === 'mjA')      return '2_0215';
      if (k === 'MHK' || k === 'M') return '2_0220';
      if (k === 'U18')      return '1_0118'; // unklar → W-Seite
      // Unbekannte hinten
      return '9_' + k;
    }
    var ra = rank(a), rb = rank(b);
    return ra < rb ? -1 : ra > rb ? 1 : 0;
  });

  sectionHtml += rekSectionHead('Nach Altersklasse');

  if (!akKeys.length) {
    sectionHtml += '<div class="empty" style="margin-bottom:28px"><div class="empty-text">Keine AK-Daten vorhanden</div></div>';
  } else {
    var prevGender = null;
    var grids = [[]];
    for (var aki = 0; aki < akKeys.length; aki++) {
      var ak = akKeys[aki];
      var isW = /^W/.test(ak) || ak === 'WHK' || ak === 'wjA' || ak === 'wjB';
      var curGender = isW ? 'w' : 'm';
      if (prevGender !== null && prevGender !== curGender) { grids.push([]); }
      grids[grids.length - 1].push({ ak: ak, isW: isW });
      prevGender = curGender;
    }
    for (var gi = 0; gi < grids.length; gi++) {
      if (gi > 0) sectionHtml += '<div style="height:14px"></div>';
      sectionHtml += '<div class="rek-ak-grid">';
      for (var ai = 0; ai < grids[gi].length; ai++) {
        var item = grids[gi][ai];
        var ak = item.ak; var isW = item.isW;
        var rows = uniqueRows(byAk[ak] || []);
        sectionHtml += '<div class="rek-ak-card">';
        sectionHtml += '<div class="rek-ak-header" style="' + (isW ? 'background:var(--primary);color:var(--on-primary)' : '') + '">' + ak + '</div>';
        sectionHtml += buildRekTable(rows, fmt, true, false);
        sectionHtml += '</div>';
      }
      sectionHtml += '</div>';
    }
  }

  // Optionen-Leiste
  var curYear = new Date().getFullYear();
  var uniqueHtml =
    '<div style="margin-top:24px;padding-top:14px;border-top:1px solid var(--border);display:flex;flex-wrap:wrap;gap:16px;align-items:center">' +
      '<label style="display:flex;align-items:center;gap:7px;cursor:pointer;font-size:13px;font-weight:600;color:var(--text2)">' +
        '<input type="checkbox" id="rek-merge-ak"' + (rs.mergeAK ? ' checked' : '') + ' onchange="toggleRekMergeAK(this.checked)" style="width:15px;height:15px;accent-color:var(--btn-bg);cursor:pointer">' +
        'Jugend-AK zu MHK/WHK zusammenfassen' +
      '</label>' +
      '<label style="display:flex;align-items:center;gap:7px;cursor:pointer;font-size:13px;font-weight:600;color:var(--text2)">' +
        '<input type="checkbox" id="rek-unique"' + (rs.unique ? ' checked' : '') + ' onchange="toggleRekUnique(this.checked)" style="width:15px;height:15px;accent-color:var(--btn-bg);cursor:pointer">' +
        'Jede*r Athlet*in nur einmal (beste Leistung)' +
      '</label>' +
      '<label style="display:flex;align-items:center;gap:7px;cursor:pointer;font-size:13px;font-weight:600;color:#b03020">' +
        '<input type="checkbox" id="rek-hl-cur"' + (rs.highlightCurYear ? ' checked' : '') + ' onchange="toggleRekHl(\'cur\',this.checked)" style="width:15px;height:15px;accent-color:#e05040;cursor:pointer">' +
        curYear + ' hervorheben' +
      '</label>' +
      '<label style="display:flex;align-items:center;gap:7px;cursor:pointer;font-size:13px;font-weight:600;color:#205090">' +
        '<input type="checkbox" id="rek-hl-prev"' + (rs.highlightPrevYear ? ' checked' : '') + ' onchange="toggleRekHl(\'prev\',this.checked)" style="width:15px;height:15px;accent-color:#4070c0;cursor:pointer">' +
        (curYear - 1) + ' hervorheben' +
      '</label>' +
    '</div>';

  el.innerHTML = catHtml + topHtml + diszHtml +
    '<div class="panel" style="padding:20px 24px 20px">' +
      titleHtml + sectionHtml + uniqueHtml +
    '</div>';
}

function rekSectionHead(label) {
  return '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:18px;font-weight:600;' +
         'color:var(--text);border-bottom:2px solid var(--border);padding-bottom:6px;margin:20px 0 14px">' +
         label + '</div>';
}

function _saveRekPrefs() {
  if (!currentUser) return; // Nicht eingeloggt → nicht speichern
  var rs = state.rekState;
  var prefs = { rek_merge_ak: !!rs.mergeAK, rek_unique: !!rs.unique,
                rek_hl_cur: !!rs.highlightCurYear, rek_hl_prev: !!rs.highlightPrevYear };
  // Prefs im lokalen State cachen
  if (!state.userPrefs) state.userPrefs = {};
  Object.assign(state.userPrefs, prefs);
  // Asynchron in DB speichern (Fehler ignorieren)
  apiPut('auth/prefs', prefs).catch(function(){});
}
function _syncSerieToggles() {
  var rs = state.rekState || {};
  var m = { mergeAK: 'serie-merge-ak', unique: 'serie-unique', highlightCurYear: 'serie-hl-cur', highlightPrevYear: 'serie-hl-prev' };
  Object.keys(m).forEach(function(k) { var el = document.getElementById(m[k]); if (el) el.checked = !!rs[k]; });
  if (state.serieDisz && state.serieId) _loadSerieBestleistungen(state.serieId, state.serieDisz, state.serieMappingId);
}
function toggleRekMergeAK(val) {
  state.rekState.mergeAK = val;
  _saveRekPrefs();
  _syncSerieToggles();
  renderRekorde();
}
function toggleRekUnique(val) {
  state.rekState.unique = val;
  _saveRekPrefs();
  _syncSerieToggles();
  renderRekorde();
}
function toggleRekHl(which, val) {
  if (which === 'cur')  state.rekState.highlightCurYear  = val;
  if (which === 'prev') state.rekState.highlightPrevYear = val;
  _saveRekPrefs();
  _syncSerieToggles();
  renderRekorde();
}

function buildRekTable(rows, fmt, compact, showPace, athletLabel, disz) {
  var _disz = disz || (state.rekState && state.rekState.disz) || '';
  if (!rows || !rows.length) return '<div class="empty" style="padding:16px"><div class="empty-text">Keine Eintr&auml;ge</div></div>';
  var html = '<table class="rek-table">';
  if (!compact) {
    html += '<thead><tr><th></th><th>' + (athletLabel || 'Athlet') + '</th><th>Ergebnis</th>';
    if (showPace) html += '<th>Pace /km</th>';
    html += '<th>AK</th><th>Datum</th></tr></thead>';
  }
  html += '<tbody>';
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var rankCls = i===0 ? 'gold' : i===1 ? 'silver' : i===2 ? 'bronze' : '';
    var result = fmt === 'm' ? fmtMeter(r.resultat) : fmtTime(r.resultat, fmt);
    var curYear2 = new Date().getFullYear();
    var rowYear  = r.datum ? parseInt(r.datum.substr(0,4), 10) : 0;
    var rowCls   = '';
    var rs2 = state.rekState;
    if (rs2.highlightCurYear  && rowYear === curYear2)     rowCls = ' hl-cur-year';
    if (rs2.highlightPrevYear && rowYear === curYear2 - 1) rowCls = ' hl-prev-year';
    html += '<tr class="' + rowCls.trim() + '">';
    html += '<td>' + medalBadge(i + 1) + '</td>';
    var _fullName = r.athlet || '';
    var _dispName = shortenName(_fullName, compact ? 20 : 25);
    var _titleAttr = _dispName !== _fullName ? ' title="' + _fullName.replace(/"/g, '&quot;') + '"' : '';
    var athletInner = r.athlet_id
      ? '<span class="athlet-link" data-athlet-id="' + r.athlet_id + '"' + _titleAttr + '>' + (_dispName || '&ndash;') + '</span>'
      : '<span' + _titleAttr + '>' + (_dispName || '&ndash;') + '</span>';
    html += '<td style="font-weight:600"><div class="rek-name-cell">' + athletInner + '</div></td>';
    html += '<td class="result">' + result + '</td>';
    if (showPace) html += '<td class="ort-text">' + (diszKm(_disz) >= 1 && calcPace(_disz, r.resultat) ? fmtTime(calcPace(_disz, r.resultat), 'min/km') : '&ndash;') + '</td>';
    if (!compact) html += '<td>' + akBadge(r.altersklasse) + '</td>';
    html += '<td class="ort-text">' + formatDate(r.datum) + '</td>';
    html += '</tr>';
  }
  html += '</tbody></table>';
  return html;
}


function setRekKat(kat) {
  state.rekState.kat  = kat;
  state.rekState.disz = null;
  state.rekState.view = 'gesamt';
  renderRekorde();
}
function setRekDisz(disz, mid) {
  state.rekState.disz = disz;
  state.rekState.mapping_id = mid ? parseInt(mid) : null;
  state.rekState.view = 'gesamt';
  renderRekorde();
}
function navigateToDisz(disz, mappingId) {
  // Kategorie + mapping_id der Disziplin ermitteln
  // state.disziplinen hat Feld "id" (= mapping_id), nicht "mapping_id"
  var kat = null; var mid = mappingId ? parseInt(mappingId) : null;
  var diszArr = state.disziplinen || [];
  for (var i = 0; i < diszArr.length; i++) {
    var d = diszArr[i];
    if (mid && d.id == mid) { kat = d.tbl_key; break; }
    if (!mid && d.disziplin === disz && d.tbl_key) { kat = d.tbl_key; mid = d.id || null; break; }
  }
  if (kat) state.rekState.kat = kat;
  state.rekState.disz = disz;
  state.rekState.mapping_id = mid || null;
  state.rekState.view = 'gesamt';
  navigate('rekorde');
}
function setRekView(v) {
  state.rekState.view = v;
  renderRekorde();
}

// ── EINTRAGEN ──────────────────────────────────────────────
