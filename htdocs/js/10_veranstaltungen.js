// ── VERANSTALTUNGEN ────────────────────────────────────────

var setVeranstSuche = debounce(function(val) {
  state.veranstSuche = (val||'').trim();
  state.veranstPage = 1;
  renderVeranstaltungen();
}, 300);

// state.veranstView    = 'liste' | 'serie-detail'
// state.veranstSubTab  = 'serien' | 'letzte'
// state.serieId        = ID der aktuell angezeigten Serie
// state.serieView      = 'jahre' | 'bestleistungen'
// state.serieDisz      = aktuell gewählte Disziplin im Bestleistungen-View
// state.serieMappingId = mapping_id der Disziplin

function _veranstSubtabs(active) {
  function btn(id, label) {
    return '<button class="subtab' + (active === id ? ' active' : '') + '" onclick="navVeranstTab(\'' + id + '\')">' + label + '</button>';
  }
  return '<div class="subtabs" style="margin-bottom:20px">' +
    btn('serien',  '🔄 Regelmäßige Veranstaltungen') +
    btn('letzte',  '📅 Letzte Veranstaltungen') +
  '</div>';
}

function navVeranstTab(tab) {
  state.veranstSubTab = tab;
  state.veranstPage   = 1;
  state.veranstSuche  = '';
  syncHash();
  renderVeranstaltungen();
}

// Direkt zum Hauptmenüpunkt "Meine Ergebnisse" (z.B. aus dem Dashboard-Widget)
function openMeineErgebnisse() {
  state.tab             = 'meine-ergebnisse';
  state.veranstView     = 'list';
  state.serieId         = null;
  state.serieView       = null;
  state.veranstaltungId = null;
  syncHash();
  buildNav();
  renderPage();
}

function switchVeranstView(to) {
  // Compat: 'serien' → Sub-Tab wechseln, nicht separate View
  if (to === 'serien') { navVeranstTab('serien'); return; }
  state.veranstView = to;
  renderVeranstaltungen();
}

async function renderVeranstaltungen() {
  document.body.classList.remove('page-wide');
  if ((state.veranstView || 'liste') === 'serie-detail') { await renderSerieDetail(state.serieId); return; }
  var el = document.getElementById('main-content');
  var tab = state.veranstSubTab === 'serien' ? 'serien' : 'letzte';

  // Äußere Shell einmalig aufbauen
  if (!document.getElementById('veranst-subtabs')) {
    el.innerHTML = '<div id="veranst-subtabs"></div><div id="veranst-view"></div>';
  }
  document.getElementById('veranst-subtabs').innerHTML = _veranstSubtabs(tab);

  if      (tab === 'serien') await _renderVeranstSerien();
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
      var _ePace = diszKm(e2.disziplin, e2.disziplin_mapping_id) >= 1 ? calcPace(e2.disziplin, e2.resultat, e2.disziplin_mapping_id) : '';
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

// ── MEINE ERGEBNISSE (eigener Hauptmenüpunkt) ──────────────
// Container ist die Hauptseite; die Seite braucht die volle Fensterbreite.
function _mvViewEl() { return document.getElementById('mv-view'); }

async function renderMeineVeranstaltungen() {
  var el = document.getElementById('main-content');
  if (!document.getElementById('mv-view')) el.innerHTML = '<div id="mv-view"></div>';
  document.body.classList.add('page-wide');
  var viewEl = _mvViewEl();
  if (!currentUser || !currentUser.athlet_id) {
    viewEl.innerHTML =
      '<div class="empty"><div class="empty-icon">🔒</div>' +
      '<div class="empty-text">Kein Athletenprofil verknüpft.<br>' +
      '<small style="color:var(--text2)">Bitte unter <em>Konto</em> ein Athletenprofil zuordnen.</small></div></div>';
    return;
  }
  viewEl.innerHTML = '<div class="loading"><div class="spinner"></div>Laden&hellip;</div>';

  // Ergebnisse und die Stammdaten fuers Profil-Kopfteil parallel holen.
  // Der Kopf ist Beiwerk – schlaegt er fehl, wird die Liste trotzdem angezeigt.
  var athletId = currentUser.athlet_id;
  var erg = await Promise.all([
    apiGet('meine-veranstaltungen'),
    apiGet('athleten/' + athletId).catch(function() { return null; }),
    apiGet('athleten/' + athletId + '/auszeichnungen').catch(function() { return null; }),
  ]);
  var r = erg[0];
  window._meinAthlet = {
    athlet: (erg[1] && erg[1].ok && erg[1].data) ? erg[1].data.athlet : null,
    ausz:   (erg[2] && erg[2].ok) ? erg[2].data : null,
  };
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
      var _km = diszKm ? diszKm(e.disziplin, e.disziplin_mapping_id) : 0;
      var pace = (_km >= 1 && fmt !== 'm' && fmt !== 's' && calcPace) ? calcPace(e.disziplin, e.resultat, e.disziplin_mapping_id) : '';
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
        disz_km:               diszKm(e.disziplin, e.disziplin_mapping_id),
        altersklasse:          e.altersklasse || '',
        resultat:              e.resultat || '',
        resultat_num:          e.resultat_num != null ? parseFloat(e.resultat_num) : null,
        fmt:                   fmt,
        pace:                  pace,
        pace_num:              (function() { if (!pace || pace === '00:00') return null; var p = pace.split(':'); return parseInt(p[0]) * 60 + parseInt(p[1] || 0); })(),
        ak_platzierung:        parseInt(e.ak_platzierung) || 0,
        meisterschaft:         e.meisterschaft || '',
        ak_platz_meisterschaft: parseInt(e.ak_platz_meisterschaft) || 0,
        verein:                e.verein || '',
        extern:                e.extern ? 1 : 0,
        startnummer:           e.startnummer || '',
        pos_gesamt:            parseInt(e.pos_gesamt) || 0,
        pos_geschlecht:        parseInt(e.pos_geschlecht) || 0,
        schuh:                 e.schuh || '',
        bemerkungen:           e.bemerkungen || '',
        loeschantrag:          parseInt(e.loeschantrag) > 0 ? 1 : 0,
        aenderungsantrag:      parseInt(e.aenderungsantrag) > 0 ? 1 : 0,
      });
    }
  }
  // Wettkämpfe durchnummerieren – ältester Wettkampf bekommt die 1
  var wkSeen = {}, wkList = [];
  allRows.forEach(function(r) {
    if (!wkSeen[r.veranst_id]) { wkSeen[r.veranst_id] = 1; wkList.push({ id: r.veranst_id, datum: r.datum }); }
  });
  wkList.sort(function(a, b) {
    return a.datum === b.datum ? (a.id - b.id) : a.datum.localeCompare(b.datum);
  });
  var wkNr = {};
  wkList.forEach(function(w, i) { wkNr[w.id] = i + 1; });
  allRows.forEach(function(r) { r.wk_nr = wkNr[r.veranst_id] || 0; });

  // Disziplinkategorie aus der Disziplinliste auflösen (Fallback: tbl_key der Zeile)
  // und dabei gleich merken, ob die Disziplin als Favorit hinterlegt ist.
  var diszAlle = (state && state.disziplinen) || [];
  var favIds = {};
  try {
    ((appConfig && appConfig.top_disziplinen) ? JSON.parse(appConfig.top_disziplinen) : [])
      .forEach(function(id) { favIds[id] = 1; });
  } catch (e) {}
  allRows.forEach(function(r) {
    var d = null;
    if (r.disziplin_mapping_id) d = diszAlle.find(function(x) { return x.id == r.disziplin_mapping_id; });
    if (!d && r.disziplin)      d = diszAlle.find(function(x) { return x.disziplin === r.disziplin; });
    r.kategorie    = (d && d.kategorie) || r.tbl_key || '';
    r.ist_favorit  = !!(d && favIds[d.id]);
  });

  // "#km" chronologisch durchzählen (ältester Start = 1). Gezählt wird je
  // Kategorie UND Disziplin, damit gleiche Disziplinnamen aus verschiedenen
  // Kategorien nicht vermischt werden. Für die in der Einstellung
  // `zaehlung_pro_kategorie` hinterlegten Kategorien (z.B. Cross, Firmenlauf,
  // Trail) zählt dagegen die Kategorie allein – dort sind die Strecken nicht
  // vergleichbar, die Disziplin also kein sinnvoller Zählschlüssel.
  var nurKategorie = {};
  try {
    ((appConfig && appConfig.zaehlung_pro_kategorie) ? JSON.parse(appConfig.zaehlung_pro_kategorie) : [])
      .forEach(function(k) { nurKategorie[String(k).toLowerCase()] = 1; });
  } catch (e) {}
  function _zaehlSchluessel(r) {
    var tk  = String(r.tbl_key   || '').toLowerCase();
    var kat = String(r.kategorie || '').toLowerCase();
    // Konfiguration darf den tbl_key oder den Anzeigenamen nennen
    if (nurKategorie[tk] || nurKategorie[kat]) return 'K:' + (kat || tk);
    return 'D:' + (kat || tk) + '|' + (r.disziplin || '');
  }
  var chrono = allRows.slice().sort(function(a, b) {
    return a.datum === b.datum ? (a.erg_id - b.erg_id) : a.datum.localeCompare(b.datum);
  });
  var diszZaehler = {};
  chrono.forEach(function(r) {
    var k = _zaehlSchluessel(r);
    diszZaehler[k] = (diszZaehler[k] || 0) + 1;
    r.wk_nr_disz = diszZaehler[k];
  });

  window._meinVeranstRows = allRows;
  if (!state.meine) state.meine = { sort: { col: 'datum', dir: 'desc' }, filter: { suche: '', jahr: '', disziplin: '' } };
  _renderMeineTabelle();
}

// Vereinszuordnung eines Ergebnisses – einzige gueltige Regel in der Anwendung:
// Massgeblich ist ausschliesslich das Flag `extern`, nie der Textwert `verein`.
//   extern=0            -> fuer den eigenen Verein gestartet (verein ist dann immer leer)
//   extern=1 + Vereins-  -> fuer diesen fremden Verein gestartet
//   extern=1 ohne Verein -> ohne Vereinsbindung gestartet, NICHT fuer den eigenen Verein
// Ein leerer Vereinsname darf deshalb nur bei extern=0 auf den eigenen Verein
// zurueckfallen. Gegenstueck beim Speichern: index.php:6752 setzt extern=1,
// sobald der Vereinsname leer ist oder vom eigenen Verein abweicht.
function _meinVereinText(r, ownClub) {
  if (r.verein) return r.verein;
  return r.extern ? '' : ownClub;
}

// Freitexte aus der DB sind serverseitig HTML-kodiert (sanitize speichert " als
// &quot;). Vor der Ausgabe deshalb erst dekodieren und dann neu escapen – sonst
// steht in der Tabelle wörtlich &quot; statt eines Anführungszeichens.
function _mvText(v) { return _esc(_eeDecode(v)); }

// ── Profilkopf (wie im Athletenprofil) ─────────────────────
// Die Kategorie-Chips und Disziplin-Kacheln sind zugleich Filter fuer die
// Gesamtliste: ein Klick setzt den Filter, ein erneuter Klick hebt ihn auf.
function _mvKopfHtml(allRows) {
  var info   = window._meinAthlet || {};
  var athlet = info.athlet;
  var sf     = (state.meine && state.meine.filter) || {};

  // ── Kopfzeile mit Avatar, Name und Badges ──
  var kopf = '';
  if (athlet) {
    var initialen = (((athlet.vorname || '')[0] || '') + ((athlet.nachname || '')[0] || '')).toUpperCase();
    var ak = (athlet.geschlecht && athlet.geburtsjahr)
      ? calcDlvAK(athlet.geburtsjahr, athlet.geschlecht, new Date().getFullYear()) : '';
    var gruppen = (athlet.gruppen || []).map(function(g) {
      return '<span class="rek-cat-btn" style="font-size:12px;padding:3px 10px;cursor:default">' + _esc(g.name) + '</span>';
    }).join('');
    var wettkaempfe = Object.keys(allRows.reduce(function(m, r) { m[r.veranst_id] = 1; return m; }, {})).length;

    kopf =
      '<div class="profile-header" style="margin-bottom:14px">' +
        '<div class="profile-avatar" style="' + (athlet.avatar_pfad ? 'background:none;padding:0;' : '') + '">' +
          (athlet.avatar_pfad
            ? '<img src="' + _esc(athlet.avatar_pfad) + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%">'
            : initialen) +
        '</div>' +
        '<div>' +
          '<div style="font-size:20px;font-weight:700">' + _esc((athlet.vorname || '') + ' ' + (athlet.nachname || '')) + '</div>' +
          (gruppen ? '<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:6px">' + gruppen + '</div>' : '') +
          '<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:6px;align-items:center">' +
            '<span class="badge badge-ak">' + allRows.length + ' ' + (allRows.length === 1 ? 'Ergebnis' : 'Ergebnisse') + '</span>' +
            '<span class="badge" style="background:var(--surf2);color:var(--text2)">' + wettkaempfe + ' ' + (wettkaempfe === 1 ? 'Wettkampf' : 'Wettk&auml;mpfe') + '</span>' +
            (athlet.geschlecht ? '<span class="badge" style="background:var(--surf2);color:var(--text)">' +
              (athlet.geschlecht === 'M' ? '♂ Männlich' : athlet.geschlecht === 'W' ? '♀ Weiblich' : '⚧ Divers') + '</span>' : '') +
            (athlet.geburtsjahr ? '<span class="badge" style="background:var(--surf2);color:var(--text2)">Jahrgang ' + _esc(athlet.geburtsjahr) + '</span>' : '') +
            (ak ? akBadge(ak) : '') +
          '</div>' +
          _mvAuszeichnungenHtml() +
        '</div>' +
      '</div>';
  }

  // ── Kategorie-Chips ──
  var katMap = {}, katOrder = [];
  allRows.forEach(function(r) {
    var k = r.kategorie || 'Sonstige';
    if (!katMap[k]) { katMap[k] = 0; katOrder.push(k); }
    katMap[k]++;
  });
  katOrder.sort();
  var katChips = katOrder.map(function(k) {
    var aktiv = sf.kategorie === k;
    return '<button class="rek-cat-btn' + (aktiv ? ' active' : '') + '"' +
      ' style="font-size:13px;padding:7px 16px;margin:0 6px 6px 0"' +
      ' onclick="_mvFilterKategorie(\'' + _esc(k).replace(/'/g, "\\'") + '\')">' +
      _esc(k) + ' <span style="opacity:.7">(' + katMap[k] + ')</span></button>';
  }).join('');

  // ── Disziplin-Kacheln (mit Bestleistung), passend zur gewaehlten Kategorie ──
  var basis = sf.kategorie ? allRows.filter(function(r) { return (r.kategorie || 'Sonstige') === sf.kategorie; }) : allRows;
  var diszMap = {}, diszOrder = [];
  basis.forEach(function(r) {
    var d = r.disziplin || '?';
    if (!diszMap[d]) { diszMap[d] = []; diszOrder.push(d); }
    diszMap[d].push(r);
  });
  diszOrder.sort(function(a, b) {
    var ka = _apDiszSortKey(a), kb = _apDiszSortKey(b);
    return ka !== kb ? ka - kb : a.localeCompare(b);
  });

  // Ohne Kategorieauswahl nur die favorisierten Disziplinen zeigen; ist eine
  // Kategorie gewaehlt, alle Disziplinen dieser Kategorie. Die aktuell
  // gefilterte Disziplin bleibt immer sichtbar, damit sie abwaehlbar ist.
  var nurFavoriten = !sf.kategorie && diszOrder.some(function(d) {
    return diszMap[d].some(function(r) { return r.ist_favorit; });
  });
  if (nurFavoriten) {
    diszOrder = diszOrder.filter(function(d) {
      return d === sf.disziplin || diszMap[d].some(function(r) { return r.ist_favorit; });
    });
  }
  var diszKacheln = diszOrder.map(function(d) {
    var liste = diszMap[d];
    var fmt   = liste[0].fmt || 'min';
    var best  = _apBestOf(liste, fmt);
    var bestStr = best ? _apFmtRes(best, fmt) : '';
    var aktiv = sf.disziplin === d;
    return '<button class="rek-top-btn' + (aktiv ? ' active' : '') + '"' +
      ' style="min-width:80px;padding:8px 14px;margin:0 6px 6px 0"' +
      ' onclick="_mvFilterDisziplin(\'' + _esc(d).replace(/'/g, "\\'") + '\')">' +
      '<span class="rek-top-name">' + _esc(d) + ' <span style="opacity:.7">(' + liste.length + ')</span></span>' +
      (bestStr ? '<span class="rek-top-cnt" style="font-family:Barlow Condensed,sans-serif;font-size:13px;font-weight:700;margin-top:2px">' + bestStr + '</span>' : '') +
    '</button>';
  }).join('');

  return kopf +
    (katChips ? '<div style="margin-bottom:10px">' + katChips + '</div>' : '') +
    (diszKacheln ? '<div style="margin-bottom:14px;display:flex;flex-wrap:wrap">' + diszKacheln + '</div>' : '');
}

// Titel und Bestleistungen wie im Athletenprofil (Tooltip mit der Aufschluesselung)
function _mvAuszeichnungenHtml() {
  var ausz = (window._meinAthlet || {}).ausz;
  if (!ausz || (!(ausz.meisterschaften || []).length && !(ausz.bestleistungen || []).length)) return '';
  var html = '<div style="margin-top:6px;display:flex;gap:12px">';
  if ((ausz.meisterschaften || []).length) {
    var mTip = ausz.meisterschaften.map(function(m) {
      return _esc(m.label + (m.jahr ? ' ' + m.jahr : ''));
    }).join('&#10;');
    html += '<span title="' + mTip + '" style="font-size:13px;color:var(--text2);cursor:help">&#x1F947; ' +
            ausz.meisterschaften.length + ' Titel</span>';
  }
  if ((ausz.bestleistungen || []).length) {
    var bTip = ausz.bestleistungen.map(function(b) {
      return _esc(b.label + ' – ' + b.disziplin);
    }).join('&#10;');
    html += '<span title="' + bTip + '" style="font-size:13px;color:var(--text2);cursor:help">&#x1F3C6; ' +
            ausz.bestleistungen.length + ' Bestleistungen</span>';
  }
  return html + '</div>';
}

// Chip/Kachel als Filter – erneuter Klick auf die aktive Auswahl hebt sie auf
function _mvFilterKategorie(kat) {
  if (!state.meine) state.meine = { sort: { col: 'datum', dir: 'desc' }, filter: {} };
  var f = state.meine.filter;
  f.kategorie = (f.kategorie === kat) ? '' : kat;
  // Disziplinauswahl verwerfen, wenn sie nicht zur neuen Kategorie gehoert
  if (f.kategorie && f.disziplin) {
    var passt = (window._meinVeranstRows || []).some(function(r) {
      return r.disziplin === f.disziplin && (r.kategorie || 'Sonstige') === f.kategorie;
    });
    if (!passt) f.disziplin = '';
  }
  _renderMeineTabelle();
}

function _mvFilterDisziplin(disz) {
  if (!state.meine) state.meine = { sort: { col: 'datum', dir: 'desc' }, filter: {} };
  var f = state.meine.filter;
  f.disziplin = (f.disziplin === disz) ? '' : disz;
  _renderMeineTabelle();
}

// ── Spaltenkatalog "Meine Ergebnisse" ──────────────────────
// key    – interner Schluessel (auch in den Benutzer-Prefs gespeichert)
// std    – standardmaessig sichtbar
// sort   – Feld, nach dem die Spalte sortiert (fehlt = nicht sortierbar)
var MV_SPALTEN = [
  { key: 'wk_nr',        label: '#',                  titel: 'Wievielter Wettkampf insgesamt (ältester = 1)', std: 1, sort: 'wk_nr',       align: 'right' },
  { key: 'wk_nr_disz',   label: '#km',                titel: 'Wievielter Wettkampf in dieser Disziplin (ältester = 1)', std: 0, sort: 'wk_nr_disz', align: 'right' },
  { key: 'datum',        label: 'Datum',              std: 1, sort: 'datum' },
  { key: 'veranstaltung',label: 'Veranstaltung',      std: 1, sort: 'veranst_name' },
  { key: 'ort',          label: 'Ort',                std: 1, sort: 'ort' },
  { key: 'kategorie',    label: 'Kategorie',          std: 0, sort: 'kategorie' },
  { key: 'disziplin',    label: 'Disziplin',          std: 1, sort: 'disziplin' },
  { key: 'startnummer',  label: 'StNr',               titel: 'Startnummer', std: 0, sort: 'startnummer', align: 'right' },
  { key: 'ak',           label: 'AK',                 titel: 'Altersklasse', std: 1, sort: 'altersklasse' },
  { key: 'pos_ak',       label: 'Pos (AK)',           titel: 'Platzierung in der Altersklasse', std: 1, sort: 'ak_platzierung', align: 'center' },
  { key: 'pos_mw',       label: 'Pos (m/w)',          titel: 'Platzierung in der Geschlechterwertung', std: 0, sort: 'pos_geschlecht', align: 'right' },
  { key: 'pos_ges',      label: 'Pos (ges.)',         titel: 'Platzierung gesamt', std: 0, sort: 'pos_gesamt', align: 'right' },
  { key: 'meisterschaft',label: 'Meisterschaft',      std: 0 },
  { key: 'pos_mstr',     label: 'Pos (MS)',           titel: 'Platzierung in der Meisterschaftswertung', std: 0, sort: 'ak_platz_meisterschaft', align: 'center' },
  { key: 'resultat',     label: 'Ergebnis',           std: 1, sort: 'resultat', align: 'right' },
  { key: 'pace',         label: 'Pace',               std: 0, sort: 'pace', align: 'right' },
  { key: 'schuh',        label: 'Schuh',              std: 0, sort: 'schuh' },
  { key: 'verein',       label: 'Verein',             std: 0, sort: 'verein' },
  { key: 'bemerkungen',  label: 'Bemerkungen',        std: 0 },
];

// Spaltenkonfiguration des Benutzers: [{ key, sichtbar }] in Anzeigereihenfolge.
// Unbekannte Keys aus den Prefs werden verworfen, neu hinzugekommene Spalten
// haengen mit ihrer Standard-Sichtbarkeit hinten an – so bleibt eine gespeicherte
// Konfiguration auch nach einem Update gueltig.
function _mvSpaltenKonfig() {
  var prefs = (state.userPrefs && state.userPrefs.mv_spalten) || null;
  var katalog = {}; MV_SPALTEN.forEach(function(c) { katalog[c.key] = c; });
  var konfig = [], gesehen = {};
  if (Array.isArray(prefs)) {
    prefs.forEach(function(p) {
      var key = p && p.key;
      if (!key || !katalog[key] || gesehen[key]) return;
      gesehen[key] = 1;
      konfig.push({ key: key, sichtbar: !!p.sichtbar });
    });
  }
  MV_SPALTEN.forEach(function(c) {
    if (!gesehen[c.key]) konfig.push({ key: c.key, sichtbar: !!c.std });
  });
  return konfig;
}

// Sichtbare Spalten in Anzeigereihenfolge, angereichert um die Katalogdaten
function _mvSichtbareSpalten() {
  var katalog = {}; MV_SPALTEN.forEach(function(c) { katalog[c.key] = c; });
  return _mvSpaltenKonfig().filter(function(k) { return k.sichtbar; })
                           .map(function(k) { return katalog[k.key]; });
}

function _mvSpaltenSpeichern(konfig) {
  if (!state.userPrefs) state.userPrefs = {};
  state.userPrefs.mv_spalten = konfig;
  if (!currentUser) return; // Nicht eingeloggt → nur im State
  apiPut('auth/prefs', { mv_spalten: konfig }).catch(function(){});
}

// ── Einstellungs-Modal: Spalten ein-/ausblenden und sortieren ──
function _openMeineSpaltenModal() {
  window._mvSpaltenEntwurf = _mvSpaltenKonfig();
  showModal(
    modalH2('&#x2699;&#xFE0F; Spalten') +
    '<p style="font-size:12px;color:var(--text2);margin:-4px 0 14px">' +
      'Reihenfolge mit den Pfeilen &auml;ndern, Sichtbarkeit per H&auml;kchen. Gilt nur f&uuml;r dich.' +
    '</p>' +
    '<div id="mv-spalten-liste">' + _mvSpaltenListe() + '</div>' +
    '<div class="modal-actions" style="margin-top:18px">' +
      '<button class="btn btn-ghost" onclick="_mvSpaltenReset()">Standard</button>' +
      '<button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button>' +
      '<button class="btn btn-primary" onclick="_mvSpaltenUebernehmen()">&Uuml;bernehmen</button>' +
    '</div>'
  );
}

function _mvSpaltenListe() {
  var katalog = {}; MV_SPALTEN.forEach(function(c) { katalog[c.key] = c; });
  var entwurf = window._mvSpaltenEntwurf || [];
  return entwurf.map(function(k, i) {
    var c = katalog[k.key] || { label: k.key };
    return '<div style="display:flex;align-items:center;gap:10px;padding:6px 4px;border-bottom:1px solid var(--border)">' +
      '<input type="checkbox" id="mvsp-' + k.key + '"' + (k.sichtbar ? ' checked' : '') +
        ' onchange="_mvSpaltenToggle(\'' + k.key + '\', this.checked)" style="width:15px;height:15px;cursor:pointer">' +
      '<label for="mvsp-' + k.key + '" style="flex:1;cursor:pointer;font-size:13px' + (k.sichtbar ? '' : ';color:var(--text2)') + '">' +
        _esc(c.label) + (c.titel ? ' <span style="font-size:11px;color:var(--text2)">– ' + _esc(c.titel) + '</span>' : '') +
      '</label>' +
      '<button class="btn btn-ghost btn-sm" title="Nach oben" onclick="_mvSpalteVerschieben(' + i + ',-1)"' + (i === 0 ? ' disabled' : '') + '>&#x2191;</button>' +
      '<button class="btn btn-ghost btn-sm" title="Nach unten" onclick="_mvSpalteVerschieben(' + i + ',1)"' + (i === entwurf.length - 1 ? ' disabled' : '') + '>&#x2193;</button>' +
    '</div>';
  }).join('');
}

function _mvSpaltenNeuZeichnen() {
  var el = document.getElementById('mv-spalten-liste');
  if (el) el.innerHTML = _mvSpaltenListe();
}

function _mvSpaltenToggle(key, an) {
  (window._mvSpaltenEntwurf || []).forEach(function(k) { if (k.key === key) k.sichtbar = !!an; });
  _mvSpaltenNeuZeichnen();
}

function _mvSpalteVerschieben(index, richtung) {
  var e = window._mvSpaltenEntwurf || [];
  var ziel = index + richtung;
  if (ziel < 0 || ziel >= e.length) return;
  var tmp = e[index]; e[index] = e[ziel]; e[ziel] = tmp;
  _mvSpaltenNeuZeichnen();
}

function _mvSpaltenReset() {
  window._mvSpaltenEntwurf = MV_SPALTEN.map(function(c) { return { key: c.key, sichtbar: !!c.std }; });
  _mvSpaltenNeuZeichnen();
}

function _mvSpaltenUebernehmen() {
  var entwurf = window._mvSpaltenEntwurf || [];
  if (!entwurf.some(function(k) { return k.sichtbar; })) {
    notify('Mindestens eine Spalte muss sichtbar bleiben.', 'err');
    return;
  }
  _mvSpaltenSpeichern(entwurf.map(function(k) { return { key: k.key, sichtbar: !!k.sichtbar }; }));
  closeModal();
  _renderMeineTabelle();
}

function _renderMeineTabelle() {
  var viewEl = _mvViewEl();
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
    if (sf.kategorie && (r.kategorie || 'Sonstige') !== sf.kategorie) return false;
    if (sf.disziplin && r.disziplin !== sf.disziplin) return false;
    if (sf.verein && _meinVereinText(r, ownClub) !== sf.verein) return false;
    if (sf.suche) {
      var q = sf.suche.toLowerCase();
      if (r.veranst_name.toLowerCase().indexOf(q) < 0 &&
          r.disziplin.toLowerCase().indexOf(q) < 0 &&
          r.ort.toLowerCase().indexOf(q) < 0) return false;
    }
    return true;
  });

  // ── Sortierung ───────────────────────────────────────────
  // Null-safe Zahl: fehlende Werte immer ans Ende
  function _num(v) { return v != null ? v : Infinity; }

  // Zahlenspalten: 0/leer zaehlt als "kein Wert" und landet immer am Ende
  var numSort = { wk_nr:1, wk_nr_disz:1, ak_platzierung:1, pos_geschlecht:1, pos_gesamt:1, ak_platz_meisterschaft:1 };

  rows.sort(function(a, b) {
    var av, bv, d = ss.dir === 'asc' ? 1 : -1;
    switch (ss.col) {
      case 'disziplin':
        av = _num(a.disz_km || null); bv = _num(b.disz_km || null);
        if (av !== bv) return d * (av < bv ? -1 : 1);
        return a.disziplin.localeCompare(b.disziplin); // Gleiche Distanz → alphabetisch
      case 'resultat':
        av = _num(a.resultat_num); bv = _num(b.resultat_num);
        return d * (av === bv ? 0 : av < bv ? -1 : 1);
      case 'pace':
        av = _num(a.pace_num); bv = _num(b.pace_num);
        return d * (av === bv ? 0 : av < bv ? -1 : 1);
      case 'startnummer':
        // Startnummern sind Zahlen, dürfen laut Datenmodell aber Buchstaben
        // enthalten ("A12"). Numerische Collation sortiert beides richtig
        // (9 vor 10, A2 vor A10); leere Felder stehen immer am Ende.
        var as = String(a.startnummer || ''), bs = String(b.startnummer || '');
        if (!as !== !bs) return as ? -1 : 1;
        return d * as.localeCompare(bs, 'de', { numeric: true });
      case 'verein':
        return d * _meinVereinText(a, ownClub).localeCompare(_meinVereinText(b, ownClub));
      default:
        if (numSort[ss.col]) {
          av = _num(a[ss.col] || null); bv = _num(b[ss.col] || null);
          return d * (av === bv ? 0 : av < bv ? -1 : 1);
        }
        return d * String(a[ss.col] == null ? '' : a[ss.col]).localeCompare(String(b[ss.col] == null ? '' : b[ss.col]));
    }
  });

  // ── Dropdown-Optionen ────────────────────────────────────
  var jahre = [], jahreSet = {}, diszMap = {}, diszList = {}, vereinMap = {}, vereinList = [];
  for (var ri = 0; ri < allRows.length; ri++) {
    var _r = allRows[ri];
    var yr = _r.datum.slice(0, 4);
    if (yr && !jahreSet[yr]) { jahreSet[yr] = 1; jahre.push(yr); }
    if (_r.disziplin && !diszMap[_r.disziplin]) { diszMap[_r.disziplin] = 1; }
    var vDisp = _meinVereinText(_r, ownClub);
    if (vDisp && !vereinMap[vDisp]) { vereinMap[vDisp] = 1; vereinList.push(vDisp); }
  }
  jahre.sort(function(a, b) { return b - a; });
  var diszList = Object.keys(diszMap).sort();
  vereinList.sort();
  var hasVerein = allRows.some(function(r) { return !!r.verein; });
  function selOpts(arr, cur) {
    return '<option value="">Alle</option>' +
      arr.map(function(v) { return '<option value="' + v.replace(/"/g,'&quot;') + '"' + (cur === v ? ' selected' : '') + '>' + v + '</option>'; }).join('');
  }

  // ── Spalten (Reihenfolge/Sichtbarkeit aus den Benutzer-Prefs) ──
  var cols = _mvSichtbareSpalten();

  var td   = 'padding:7px 10px;border-bottom:1px solid var(--border);vertical-align:middle';
  var tdDim = td + ';font-size:12px;color:var(--text2)';

  // Zelleninhalt je Spalte
  var cell = {
    wk_nr:        function(r) { return r.wk_nr || ''; },
    wk_nr_disz:   function(r) { return r.wk_nr_disz || ''; },
    datum:        function(r) { return formatDate(r.datum); },
    veranstaltung: function(r) {
      return '<span class="mv-vname" title="' + _mvText(r.veranst_name) + '" style="cursor:pointer" onclick="window.open(location.origin+location.pathname+\'#veranstaltung/' + r.veranst_id + '\',\'_blank\')">' + r.veranst_name + '</span>' +
        (r.serie_id ? ' <span class="mv-hover" title="Regelm&auml;&szlig;ige Veranstaltung" style="font-size:11px;background:var(--surf2);color:var(--text2);border-radius:10px;padding:1px 6px;cursor:pointer" onclick="openSerieDetail(' + r.serie_id + ')">🔄</span>' : '');
    },
    ort:          function(r) { return r.ort ? (r.ort_land_code && flagEmoji ? flagEmoji(r.ort_land_code) + ' ' + r.ort : r.ort) : ''; },
    kategorie:    function(r) { return _mvText(r.kategorie); },
    disziplin:    function(r) { return r.disziplin; },
    startnummer:  function(r) { return _mvText(r.startnummer); },
    ak:           function(r) { return akBadge(r.altersklasse); },
    pos_ak:       function(r) { return medalBadge(r.ak_platzierung); },
    pos_mw:       function(r) { return r.pos_geschlecht || ''; },
    pos_ges:      function(r) { return r.pos_gesamt || ''; },
    meisterschaft: function(r) { return r.meisterschaft ? mstrBadge(r.meisterschaft) : ''; },
    pos_mstr:     function(r) { return r.meisterschaft && r.ak_platz_meisterschaft ? medalBadge(r.ak_platz_meisterschaft) : ''; },
    resultat:     function(r) { return r.fmt === 'm' ? fmtMeter(r.resultat) : fmtTime(r.resultat, r.fmt === 's' ? 's' : (r.fmt === 'min_h' ? 'min_h' : undefined)); },
    pace:         function(r) { return (r.pace && r.pace !== '00:00') ? fmtTime(r.pace, 'min/km') : ''; },
    schuh:        function(r) { return _mvText(r.schuh); },
    verein:       function(r) { return _mvText(_meinVereinText(r, ownClub)); },
    bemerkungen:  function(r) { return _mvText(r.bemerkungen); },
  };
  // Spalten mit gedaempfter Darstellung bzw. Sonderformat
  var dimCols = { wk_nr:1, wk_nr_disz:1, ort:1, kategorie:1, startnummer:1, pos_mw:1, pos_ges:1, pace:1, schuh:1, verein:1, bemerkungen:1 };

  function tdStyle(c) {
    var s = dimCols[c.key] ? tdDim : td;
    if (c.align === 'right')  s += ';text-align:right;font-variant-numeric:tabular-nums';
    if (c.align === 'center') s += ';text-align:center';
    if (c.key === 'datum' || c.key === 'disziplin') s += ';white-space:nowrap';
    if (c.key === 'veranstaltung') s += ';font-weight:600';
    return s;
  }

  // Bearbeiten-Symbol haengt hinter dem Veranstaltungsnamen – ist diese Spalte
  // ausgeblendet, wandert es in die erste sichtbare Spalte, damit der Zugang bleibt.
  var editSpalte = cols.some(function(c) { return c.key === 'veranstaltung'; })
    ? 'veranstaltung' : (cols[0] && cols[0].key);

  var tableRows = rows.map(function(r) {
    // Zeilen mit offenem Antrag sind gedaempft und tragen einen Hinweis
    var hinweis = r.loeschantrag ? 'Löschung beantragt – ein Editor prüft den Antrag.'
                : r.aenderungsantrag ? 'Änderung beantragt – ein Editor prüft den Antrag.' : '';
    var tip = hinweis
      ? hinweis + (r.bemerkungen ? '\n' + r.bemerkungen : '')
      : r.bemerkungen;
    var badge = 'font-size:11px;background:var(--surf2);color:var(--text2);border-radius:10px;padding:1px 6px;cursor:help';
    return '<tr' + (tip ? ' title="' + _mvText(tip) + '"' : '') +
      (r.loeschantrag ? ' style="opacity:.55"' : '') + '>' +
      cols.map(function(c) {
        var inhalt = cell[c.key] ? cell[c.key](r) : '';
        if (c.key === editSpalte) {
          if (r.loeschantrag) {
            inhalt += ' <span title="' + _esc(hinweis) + '" style="' + badge + '">🗑️ beantragt</span>';
          } else if (r.aenderungsantrag) {
            inhalt += ' <span title="' + _esc(hinweis) + '" style="' + badge + '">✏️ beantragt</span>';
          }
          inhalt += ' <span class="mv-hover" title="Ergebnis bearbeiten" style="cursor:pointer;font-size:12px" onclick="_openMeineErgEdit(' + r.erg_id + ')">✏️</span>';
        }
        return '<td style="' + tdStyle(c) + '"' + (c.key === 'resultat' ? ' class="result"' : '') + '>' + inhalt + '</td>';
      }).join('') +
    '</tr>';
  }).join('');

  // ── Sortierpfeil ─────────────────────────────────────────
  function th(c) {
    var basis = 'white-space:nowrap;padding:8px 10px;font-size:12px;font-weight:600;color:var(--text2);text-align:' +
                (c.align === 'right' ? 'right' : c.align === 'center' ? 'center' : 'left');
    var titel = c.titel ? ' title="' + _esc(c.titel) + '"' : '';
    if (!c.sort) return '<th style="' + basis + '"' + titel + '>' + c.label + '</th>';
    var arrow = ss.col === c.sort
      ? ' <span style="color:var(--primary)">' + (ss.dir === 'asc' ? '↑' : '↓') + '</span>'
      : ' <span style="opacity:.3;font-size:10px">↕</span>';
    return '<th style="cursor:pointer;user-select:none;' + basis + '"' + titel +
           ' onclick="_sortMeine(\'' + c.sort + '\')">' + c.label + arrow + '</th>';
  }

  var total = allRows.length;
  var totalWettkampfe = Object.keys(allRows.reduce(function(m,r){ m[r.veranst_id]=1; return m; }, {})).length;
  var countHtml =
    '<div id="mv-zeile" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px">' +
      '<div style="font-size:13px;color:var(--text2)">' +
      (rows.length < total
        ? rows.length + ' von ' + total + ' Ergebnis' + (total !== 1 ? 'sen' : '')
        : total + ' Ergebnis' + (total !== 1 ? 'se' : '')) +
      ' in ' + totalWettkampfe + ' Wettkampfauftritt' + (totalWettkampfe !== 1 ? 'en' : '') +
      '</div>' +
      '<button class="btn btn-ghost btn-sm" style="margin-left:auto" onclick="_openMeineSpaltenModal()">&#x2699;&#xFE0F; Spalten</button>' +
    '</div>';

  var table = rows.length
    ? '<div class="table-scroll"><table style="width:100%;border-collapse:collapse">' +
        '<thead><tr style="border-bottom:2px solid var(--border)">' + cols.map(th).join('') + '</tr></thead>' +
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
      (hasVerein && vereinList.length > 1
        ? '<div class="fg" style="flex:0 0 auto;min-width:130px"><label>Verein</label>' +
            '<select id="mv-verein" onchange="_filterMeine()">' + selOpts(vereinList, sf.verein || '') + '</select></div>'
        : '') +
    '</div>';

  // Filterleiste haengt nur von allRows ab, nie vom aktiven Filter. Beim Filtern/Sortieren
  // deshalb ausschliesslich den Ergebnisteil ersetzen – sonst wird das Suchfeld neu erzeugt
  // und verliert nach jedem Tastendruck den Fokus.
  // Zählerzeile und Tabelle teilen sich einen Block, damit der Spalten-Button
  // immer an der Kante der Ergebnisbox sitzt – auch wenn die breiter wird.
  var bodyHtml = '<div id="mv-box">' + countHtml + '<div class="panel">' + table + '</div></div>';
  var kopfHtml = _mvKopfHtml(allRows);
  var bodyEl = document.getElementById('mv-body');
  if (bodyEl) {
    bodyEl.innerHTML = bodyHtml;
    // Kopf enthaelt die aktiven Filterzustaende, aber keine Eingabefelder → neu zeichnen
    var kopfEl = document.getElementById('mv-kopf');
    if (kopfEl) kopfEl.innerHTML = kopfHtml;
    // Filter kann auch ueber eine Kachel gesetzt worden sein → Dropdown nachziehen
    var diszSel = document.getElementById('mv-disz');
    if (diszSel && diszSel.value !== (sf.disziplin || '')) diszSel.value = sf.disziplin || '';
  } else {
    viewEl.innerHTML = '<div id="mv-wrap">' +
        '<div id="mv-kopf">' + kopfHtml + '</div>' + filterBar +
        '<div id="mv-body">' + bodyHtml + '</div>' +
      '</div>';
  }

  // Nach dem Layout messen: passt die Tabelle nicht, wird zuerst der
  // Veranstaltungsname gekuerzt – horizontal gescrollt wird erst danach.
  requestAnimationFrame(_mvBreiteAnpassen);
  if (!window._mvResizeAktiv) {
    window._mvResizeAktiv = 1;
    window.addEventListener('resize', function() {
      clearTimeout(window._mvResizeTimer);
      window._mvResizeTimer = setTimeout(_mvBreiteAnpassen, 120);
    });
  }
}

// Reihenfolge der Einschraenkungen, wenn die Tabelle breiter ist als das Fenster:
// 1. Veranstaltungsnamen mit "…" kuerzen, 2. erst dann horizontal scrollen.
// Untergrenze, damit vom Namen etwas Erkennbares stehen bleibt:
var MV_VNAME_MIN = 120;

function _mvBreiteAnpassen() {
  var wrap = document.querySelector('#mv-body .table-scroll');
  if (!wrap) return;
  var tabelle = wrap.querySelector('table');
  var namen   = wrap.querySelectorAll('.mv-vname');
  if (!tabelle || !namen.length) return;

  // Erst ungekuerzt messen – sonst wuerde eine fruehere Kuerzung fortgeschrieben
  namen.forEach(function(n) { n.style.maxWidth = ''; });
  var ueberschuss = tabelle.scrollWidth - wrap.clientWidth;
  if (ueberschuss <= 0) return; // passt vollstaendig → nichts kuerzen

  var natuerlich = 0;
  namen.forEach(function(n) { natuerlich = Math.max(natuerlich, n.scrollWidth); });
  var ziel = Math.max(MV_VNAME_MIN, natuerlich - ueberschuss);
  if (ziel >= natuerlich) return; // Kuerzen wuerde nichts bringen
  namen.forEach(function(n) { n.style.maxWidth = ziel + 'px'; });
  // Bleibt danach noch Ueberhang, uebernimmt .table-scroll (overflow-x: auto).
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
    suche:     (document.getElementById('mv-suche')   || {}).value || '',
    jahr:      (document.getElementById('mv-jahr')    || {}).value || '',
    disziplin: (document.getElementById('mv-disz')    || {}).value || '',
    verein:    (document.getElementById('mv-verein')  || {}).value || '',
    kategorie: state.meine.filter.kategorie || '', // nur ueber die Chips im Kopf setzbar
  };
  _renderMeineTabelle();
}

// ── Auswahllisten fuers Bearbeiten-Modal ─────────────────
// tbl_key der Zeile – bevorzugt aus der Disziplinliste, damit auch Zeilen ohne
// eigenen tbl_key der richtigen Kategorie zugeordnet werden.
function _meeKatKey(r) {
  var d = ((state && state.disziplinen) || []).find(function(x) {
    return r.disziplin_mapping_id ? x.id == r.disziplin_mapping_id : x.disziplin === r.disziplin;
  });
  return (d && d.tbl_key) || r.tbl_key || '';
}

function _meeKategorien() {
  var gesehen = {}, kats = [];
  ((state && state.disziplinen) || []).forEach(function(d) {
    if (d.tbl_key && !gesehen[d.tbl_key]) {
      gesehen[d.tbl_key] = 1;
      kats.push({ key: d.tbl_key, name: d.kategorie || d.tbl_key });
    }
  });
  kats.sort(function(a, b) { return a.name.localeCompare(b.name); });
  return kats;
}

function _meeKatOpts(r) {
  var aktiv = _meeKatKey(r);
  return _meeKategorien().map(function(k) {
    return '<option value="' + _esc(k.key) + '"' + (k.key === aktiv ? ' selected' : '') + '>' + _esc(k.name) + '</option>';
  }).join('');
}

// Disziplinen der gewaehlten Kategorie; Wert ist die mapping_id, damit der
// Kategoriewechsel serverseitig eindeutig ankommt.
function _meeDiszOpts(katKey, mappingId, diszName) {
  var liste = ((state && state.disziplinen) || []).filter(function(d) { return d.tbl_key === katKey; });
  liste.sort(function(a, b) {
    var ka = _apDiszSortKey(a.disziplin), kb = _apDiszSortKey(b.disziplin);
    return ka !== kb ? ka - kb : a.disziplin.localeCompare(b.disziplin);
  });
  var opts = liste.map(function(d) {
    var sel = (mappingId && d.id == mappingId) || (!mappingId && d.disziplin === diszName);
    return '<option value="' + d.id + '"' + (sel ? ' selected' : '') + '>' + _esc(d.disziplin) + '</option>';
  }).join('');
  // Nicht zugeordnete Disziplin (kein Mapping) nicht stillschweigend verlieren
  var bekannt = liste.some(function(d) { return d.disziplin === diszName; });
  if (diszName && !bekannt) {
    opts = '<option value="" selected>' + _esc(diszName) + ' (ohne Zuordnung)</option>' + opts;
  }
  return opts;
}

// Kategoriewechsel: Disziplinliste neu aufbauen
function _meeKatWechsel() {
  var katEl  = document.getElementById('mee-kat');
  var diszEl = document.getElementById('mee-disz');
  if (!katEl || !diszEl) return;
  diszEl.innerHTML = _meeDiszOpts(katEl.value, null, null);
}

// Bereits verwendete Schuhmodelle als Vorschlaege (aus den geladenen Zeilen)
function _meeSchuhOpts() {
  var gesehen = {}, schuhe = [];
  (window._meinVeranstRows || []).forEach(function(r) {
    var s = _eeDecode(r.schuh);
    if (s && !gesehen[s]) { gesehen[s] = 1; schuhe.push(s); }
  });
  schuhe.sort(function(a, b) { return a.localeCompare(b, 'de'); });
  return schuhe.map(function(s) { return '<option value="' + _esc(s) + '"></option>'; }).join('');
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
    (r.aenderungsantrag && !r.loeschantrag
      ? '<div style="font-size:12px;background:var(--surf2);border-radius:8px;padding:8px 12px;margin:-6px 0 14px">' +
          '&#x270F;&#xFE0F; F&uuml;r dieses Ergebnis liegt bereits ein &Auml;nderungsantrag vor. ' +
          'Erneutes Speichern aktualisiert diesen Antrag.' +
        '</div>'
      : '') +
    '<div class="form-grid">' +
      '<div class="form-group"><label>Kategorie</label>' +
        '<select id="mee-kat" onchange="_meeKatWechsel()">' + _meeKatOpts(r) + '</select></div>' +
      '<div class="form-group"><label>Disziplin</label>' +
        '<select id="mee-disz">' + _meeDiszOpts(_meeKatKey(r), r.disziplin_mapping_id, r.disziplin) + '</select></div>' +
      '<div class="form-group"><label>Ergebnis</label>' +
        '<input type="text" id="mee-res" value="' + _mvText(r.resultat) + '" placeholder="z.B. 00:40:08 oder 8,45"/></div>' +
      '<div class="form-group"><label>Altersklasse</label>' +
        '<input type="text" id="mee-ak" value="' + _mvText(r.altersklasse) + '" placeholder="z.B. M40"/></div>' +
      '<div class="form-group"><label>Platz AK</label>' +
        '<input type="number" id="mee-akp" value="' + (r.ak_platzierung || '') + '" min="1" placeholder="—"/></div>' +
      '<div class="form-group"><label>Meisterschaft</label>' +
        '<select id="mee-mstr">' + mstrOpts + '</select></div>' +
      '<div class="form-group"><label>Platz MS</label>' +
        '<input type="number" id="mee-mstr-platz" value="' + (r.ak_platz_meisterschaft || '') + '" min="1" placeholder="—"/></div>' +
      '<div class="form-group"><label>Startnummer</label>' +
        '<input type="text" id="mee-snr" maxlength="20" value="' + _mvText(r.startnummer) + '" placeholder="—"/></div>' +
      '<div class="form-group"><label>Pos (m/w)</label>' +
        '<input type="number" id="mee-pos-mw" value="' + (r.pos_geschlecht || '') + '" min="1" placeholder="—"/></div>' +
      '<div class="form-group"><label>Pos (gesamt)</label>' +
        '<input type="number" id="mee-pos-ges" value="' + (r.pos_gesamt || '') + '" min="1" placeholder="—"/></div>' +
      '<div class="form-group"><label>Schuh</label>' +
        '<input type="text" id="mee-schuh" maxlength="120" list="mee-schuh-liste" value="' + _mvText(r.schuh) + '" placeholder="—"/>' +
        '<datalist id="mee-schuh-liste">' + _meeSchuhOpts() + '</datalist></div>' +
      '<div class="form-group full"><label>Bemerkungen</label>' +
        '<input type="text" id="mee-bem" maxlength="500" value="' + _mvText(r.bemerkungen) + '" placeholder="—"/></div>' +
    '</div>' +
    '<div class="modal-actions">' +
      (r.loeschantrag
        ? '<span style="margin-right:auto;font-size:12px;color:var(--text2)">&#x1F5D1;&#xFE0F; L&ouml;schung bereits beantragt</span>'
        : '<button class="btn btn-danger" style="margin-right:auto" onclick="_deleteMeineErg(' + ergId + ', true)">&#x1F5D1;&#xFE0F; ' +
          (_mvDarfDirektLoeschen() ? 'L&ouml;schen' : 'L&ouml;schen beantragen') + '</button>') +
      '<button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button>' +
      '<button class="btn btn-primary" onclick="_saveMeineErgEdit(' + ergId + ',\'' + (r.tbl_key || 'strasse') + '\')">Speichern</button>' +
    '</div>'
  );
}

async function _saveMeineErgEdit(ergId, tblKey) {
  // Die Disziplin-Auswahl liefert die mapping_id – daraus ergeben sich
  // Disziplinname und (neue) Kategorie eindeutig.
  var diszSel = document.getElementById('mee-disz');
  var mapId   = diszSel ? diszSel.value.trim() : '';
  var diszObj = mapId ? ((state && state.disziplinen) || []).find(function(d) { return d.id == mapId; }) : null;
  var disz    = diszObj ? diszObj.disziplin
              : (diszSel && diszSel.selectedOptions && diszSel.selectedOptions[0]
                  ? diszSel.selectedOptions[0].textContent.replace(/ \(ohne Zuordnung\)$/, '').trim() : '');
  var res   = (document.getElementById('mee-res')        || {}).value.trim();
  var ak    = (document.getElementById('mee-ak')         || {}).value.trim();
  var akp   = (document.getElementById('mee-akp')        || {}).value.trim();
  var mstr  = (document.getElementById('mee-mstr')       || {}).value.trim();
  var mstrP = (document.getElementById('mee-mstr-platz') || {}).value.trim();
  if (!disz || !res) { notify('Disziplin und Ergebnis sind Pflicht!', 'err'); return; }
  var body = { disziplin: disz, resultat: res, altersklasse: ak };
  if (mapId) body.disziplin_mapping_id = parseInt(mapId);
  if (akp)   body.ak_platzierung = parseInt(akp);
  if (mstr)  body.meisterschaft = parseInt(mstr);
  body.ak_platz_meisterschaft = mstrP ? parseInt(mstrP) : null;
  var _val = function(id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; };
  body.startnummer    = _val('mee-snr') || null;
  body.pos_geschlecht = _val('mee-pos-mw')  ? parseInt(_val('mee-pos-mw'))  : null;
  body.pos_gesamt     = _val('mee-pos-ges') ? parseInt(_val('mee-pos-ges')) : null;
  body.schuh          = _val('mee-schuh') || null;
  body.bemerkungen    = _val('mee-bem') || null;
  var r = await apiPut((tblKey || 'strasse') + '/' + ergId, body);
  if (r && r.ok) {
    closeModal();
    var d = r.data || {};
    notify(d.aktualisiert ? 'Änderungsantrag aktualisiert. Ein Editor wird ihn prüfen.'
         : d.pending      ? 'Änderungsantrag gestellt. Ein Editor wird ihn prüfen.'
         : 'Ergebnis gespeichert.', 'ok');
    window._meinVeranstRows = null;
    await renderMeineVeranstaltungen();
  } else {
    notify((r && r.fehler) || 'Fehler beim Speichern', 'err');
  }
}

// ── Einzelnes Ergebnis löschen ───────────────────────────
// Admin und Editor loeschen sofort, alle anderen stellen einen Antrag
function _mvDarfDirektLoeschen() {
  return !!(currentUser && (currentUser.rolle === 'admin' || currentUser.rolle === 'editor'));
}

async function _deleteMeineErg(ergId, ausEditModal) {
  var r0 = window._meineTblRowMap && window._meineTblRowMap[ergId];
  if (!r0) return;
  if (r0.loeschantrag) { notify('Für dieses Ergebnis liegt bereits ein Löschantrag vor.', 'err'); return; }
  var direkt = _mvDarfDirektLoeschen();
  var frage = direkt
    ? 'Ergebnis „' + r0.disziplin + '" bei „' + r0.veranst_name + '" in den Papierkorb verschieben?'
    : 'Löschung des Ergebnisses „' + r0.disziplin + '" bei „' + r0.veranst_name + '" beantragen?\n' +
      'Ein Editor prüft den Antrag – bis dahin bleibt das Ergebnis in der Liste.';
  // confirmModal ersetzt ein offenes Modal – nach Abbruch den Editor wieder oeffnen
  if (!await confirmModal(frage)) {
    if (ausEditModal) _openMeineErgEdit(ergId);
    return;
  }
  // Kategorieunabhängiger Endpunkt – funktioniert auch für selbst angelegte Kategorien
  var r = await api('DELETE', 'ergebnisse/' + ergId);
  if (r && r.ok) {
    var d = r.data || {};
    notify(d.bereits ? 'Für dieses Ergebnis liegt bereits ein Löschantrag vor.'
         : d.pending ? 'Löschantrag gestellt. Ein Editor wird ihn prüfen.'
         : 'Ergebnis gelöscht.', d.bereits ? 'err' : 'ok');
    window._meinVeranstRows = null;
    await renderMeineVeranstaltungen();
  } else {
    notify((r && r.fehler) || 'Fehler beim Löschen', 'err');
  }
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

  var showPace = diszKm(disz, state.serieMappingId) >= 1 && fmt !== 'm' && fmt !== 's';
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
      var _km = diszKm ? diszKm(e.disziplin, e.disziplin_mapping_id) : 0;
      var pace = (_km >= 1 && fmt !== 'm' && fmt !== 's' && calcPace) ? calcPace(e.disziplin, e.resultat, e.disziplin_mapping_id) : '';
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
      (hasExtern ? '<td style="' + td + ';font-size:12px;color:var(--text2)">' + _meinVereinText(r, ownClubSerie) + '</td>' : '') +
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
      '<div class="form-group full"><label>\uD83C\uDF10 Ergebnisquelle (URL, optional)</label>' +
        '<input type="url" id="ve-quelle" value="' + (v.datenquelle || '').replace(/"/g,'&quot;') + '" placeholder="z.B. https://my.raceresult.com/..."/></div>' +
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
  var quelleEl = document.getElementById('ve-quelle');
  var body = {
    name:     document.getElementById('ve-name').value.trim() || null,
    datum:    document.getElementById('ve-datum').value,
    ort:      ortFreitext,
    ort_id:   ortId,
    datenquelle: quelleEl ? (quelleEl.value.trim() || null) : undefined,
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
