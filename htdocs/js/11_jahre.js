// ── JAHRES-BESTLEISTUNGEN ──────────────────────────────────
// Jahresrückblick: Meisterschafts-Titel und Podestplätze sowie neue
// Vereinsrekorde und Bestleistungen. Die Bestleistungs-Ereignisse stammen aus
// derselben Quelle wie das Dashboard-Widget „Neueste Bestleistungen" und lassen
// sich mit denselben Label-Typen filtern (siehe TIMELINE_TYPE_DEFS).

var JAHR_TYP_DEFS = [
  { id: 'gesamt', label: 'Vereinsrekorde',      icon: '&#x1F947;' },
  { id: 'gender', label: 'Bestleistung M / W',  icon: '&#x1F3C6;' },
  { id: 'ak',     label: 'Bestleistung AK',     icon: '&#x1F3C5;' },
  { id: 'pb',     label: 'PB / Deb&uuml;t',     icon: '&#x2B50;'  },
];

var JAHR_MONATE = ['Januar','Februar','März','April','Mai','Juni',
                   'Juli','August','September','Oktober','November','Dezember'];

function _jahrState() {
  if (!state.jahrState) {
    var _up = state.userPrefs || {};
    state.jahrState = {
      jahr:  null,
      typen: (_up.jahr_typen && _up.jahr_typen.length) ? _up.jahr_typen.slice() : ['gesamt','gender','ak'],
      fav:   !!_up.jahr_fav,
    };
  }
  return state.jahrState;
}

// Ergebnis gemäß fmt formatieren (identisch zu Dashboard/Timeline)
function _jahrRes(resultat, fmt) {
  if (fmt === 'm') return fmtMeter(resultat);
  return fmtTime(resultat, fmt === 's' ? 's' : (fmt === 'min_h' ? 'min_h' : undefined));
}

function _jahrEsc(s) {
  return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// „Nachname, Vorname" → „Vorname Nachname" (Timeline liefert die Sortierform)
function _jahrNameVN(name) {
  var p = String(name || '').split(', ');
  return p.length >= 2 ? (p.slice(1).join(' ') + ' ' + p[0]).trim() : String(name || '');
}

function _jahrAthLink(id, name) {
  var n = _jahrEsc(name);
  if (!id) return '<span style="font-weight:700">' + n + '</span>';
  return '<span class="athlet-link" style="color:var(--primary);font-weight:700" onclick="openAthletById(' + id + ')">' + n + '</span>';
}

async function renderJahresBestleistungen() {
  var js = _jahrState();
  var el = document.getElementById('main-content');
  el.innerHTML = '<div class="loading"><div class="spinner"></div>Lade Jahres&uuml;bersicht&hellip;</div>';

  var q = 'jahres-bestleistungen?typen=' + encodeURIComponent(js.typen.join(','))
        + '&fav=' + (js.fav ? '1' : '0');
  if (js.jahr) q += '&jahr=' + js.jahr;
  var r = await apiGet(q);
  if (!r || !r.ok) {
    el.innerHTML = '<div class="panel" style="padding:24px;text-align:center;color:var(--accent)">' +
      _jahrEsc((r && r.fehler) || 'Fehler beim Laden.') + '</div>';
    return;
  }
  var d = r.data;
  js.jahr = d.jahr;
  syncHash();

  el.innerHTML = _jahrHeader(d, js) + _jahrStatsBar(d) + _jahrMeisterschaften(d) + _jahrTimeline(d, js);
}

// ── Jahresauswahl + Filter ──────────────────────────────────
function _jahrHeader(d, js) {
  var jahre = d.jahre || [];
  var chips = '';
  for (var i = 0; i < jahre.length; i++) {
    var j = jahre[i];
    var n = (j.titel || 0) + (j.podest || 0) + (j.rekorde || 0) + (j.bestleistungen || 0);
    chips += '<button class="jahr-chip' + (j.jahr === d.jahr ? ' active' : '') + '" onclick="setJahr(' + j.jahr + ')">' +
      '<span class="jahr-chip-jahr">' + j.jahr + '</span>' +
      '<span class="jahr-chip-cnt">' + n + (n === 1 ? ' Ereignis' : ' Ereignisse') + '</span>' +
    '</button>';
  }
  if (!chips) chips = '<div style="color:var(--text2);font-size:13px;padding:8px 0">Keine Jahrg&auml;nge vorhanden.</div>';

  var filter = '';
  for (var t = 0; t < JAHR_TYP_DEFS.length; t++) {
    var td = JAHR_TYP_DEFS[t];
    var on = js.typen.indexOf(td.id) >= 0;
    filter += '<button class="rek-cat-btn jahr-filter-btn' + (on ? ' active' : '') + '" onclick="toggleJahrTyp(\'' + td.id + '\')">' +
      td.icon + ' ' + td.label + '</button>';
  }
  filter += '<button class="rek-cat-btn jahr-filter-btn' + (js.fav ? ' active' : '') + '" onclick="toggleJahrFav()" ' +
    'title="Nur die unter Admin &rarr; Disziplinen favorisierten Disziplinen">&#x2764;&#xFE0F; Nur Favoriten</button>';

  return '<div class="jahr-chips">' + chips + '</div>' +
         '<div class="rek-cat-tabs" style="padding-top:4px">' + filter + '</div>';
}

function setJahr(j) {
  _jahrState().jahr = j;
  renderJahresBestleistungen();
}

function toggleJahrTyp(id) {
  var js = _jahrState();
  var i = js.typen.indexOf(id);
  if (i >= 0) js.typen.splice(i, 1); else js.typen.push(id);
  _saveJahrPrefs();
  renderJahresBestleistungen();
}

function toggleJahrFav() {
  var js = _jahrState();
  js.fav = !js.fav;
  _saveJahrPrefs();
  renderJahresBestleistungen();
}

// Filtereinstellungen am Benutzerkonto merken (wie _saveRekPrefs)
function _saveJahrPrefs() {
  if (!currentUser) return;
  var js = _jahrState();
  var prefs = { jahr_typen: js.typen.slice(), jahr_fav: !!js.fav };
  if (!state.userPrefs) state.userPrefs = {};
  Object.assign(state.userPrefs, prefs);
  apiPut('auth/prefs', prefs).catch(function(){});
}

// ── Kennzahlen ──────────────────────────────────────────────
function _jahrStatsBar(d) {
  var titel = 0, silber = 0, bronze = 0;
  var ms = d.meisterschaften || [];
  for (var i = 0; i < ms.length; i++) {
    if (ms[i].platz === 1) titel++;
    else if (ms[i].platz === 2) silber++;
    else if (ms[i].platz === 3) bronze++;
  }
  var rek = 0, best = 0, pb = 0;
  var tl = d.timeline || [];
  for (var t = 0; t < tl.length; t++) {
    if (tl[t].typ === 'gesamt' || tl[t].typ === 'gender') rek++;
    else if (tl[t].typ === 'ak') best++;
    else pb++;
  }
  function card(num, icon, label) {
    return '<div class="stat-card"><div class="stat-num">' + num + '</div>' +
           '<div class="stat-label">' + icon + ' ' + label + '</div></div>';
  }
  var html = card(titel, '&#x1F947;', 'Titel') +
             card(silber, '&#x1F948;', 'Zweite Pl&auml;tze') +
             card(bronze, '&#x1F949;', 'Dritte Pl&auml;tze') +
             card(rek, '&#x1F3C6;', 'Vereinsrekorde');
  if (best) html += card(best, '&#x1F3C5;', 'Bestleistungen AK');
  if (pb)   html += card(pb, '&#x2B50;', 'Pers&ouml;nliche Bestleistungen');
  return '<div class="stats-bar" style="margin-bottom:16px">' + html + '</div>';
}

// ── Meisterschaften: Titel und Podestplätze ─────────────────
function _jahrMeisterschaften(d) {
  var ms = d.meisterschaften || [];
  var head = '<div class="panel" style="margin-bottom:16px">' +
    '<div class="panel-header"><div class="panel-title">&#x1F947; Titel &amp; Podestpl&auml;tze ' + d.jahr + '</div>' +
    '<div class="panel-count">' + ms.length + (ms.length === 1 ? ' Platzierung' : ' Platzierungen') + '</div></div>';
  if (!ms.length) {
    return head + '<div class="empty"><div class="empty-icon">&#x1F947;</div>' +
      '<div class="empty-text">Keine Meisterschafts-Platzierungen in ' + d.jahr + '</div></div></div>';
  }

  // Nach Meisterschaftsart gruppieren – Reihenfolge kommt bereits sortiert (mstr_rang, platz, datum)
  var grp = {}, order = [];
  for (var i = 0; i < ms.length; i++) {
    var k = ms[i].mstr_label || '';
    if (!grp[k]) { grp[k] = []; order.push(k); }
    grp[k].push(ms[i]);
  }

  var body = '';
  for (var g = 0; g < order.length; g++) {
    var name = order[g];
    var rows = grp[name];
    var nTitel = rows.filter(function(x) { return x.platz === 1; }).length;
    body += '<div class="jahr-ms-group">' +
      '<div class="jahr-ms-head">' + _jahrEsc(name) +
        '<span class="jahr-ms-cnt">' + rows.length + 'x Podest' + (nTitel ? ' &middot; ' + nTitel + 'x Titel' : '') + '</span>' +
      '</div>' +
      '<div class="table-scroll"><table class="veranst-dash-table jahr-ms-table"><thead><tr>' +
        '<th style="width:56px">Platz</th><th>Athlet*in</th><th style="width:70px">AK</th>' +
        '<th>Disziplin</th><th style="width:110px">Ergebnis</th><th>Veranstaltung</th>' +
      '</tr></thead><tbody>';
    for (var ri = 0; ri < rows.length; ri++) {
      var e = rows[ri];
      var vname = e.veranstaltung || e.kuerzel || '';
      var vLink = e.veranstaltung_id
        ? '<span class="athlet-link" onclick="navigate(\'veranstaltung/' + e.veranstaltung_id + '\')">' + _jahrEsc(vname) + '</span>'
        : _jahrEsc(vname);
      body += '<tr' + (e.platz === 1 ? ' class="jahr-titel-row"' : '') + '>' +
        '<td>' + medalBadge(e.platz) + '</td>' +
        '<td>' + _jahrAthLink(e.athlet_id, e.athlet) + '</td>' +
        '<td>' + (e.altersklasse ? akBadge(e.altersklasse) : '') + '</td>' +
        '<td class="disziplin-text">' + ergDiszLabel(e) + '</td>' +
        '<td class="result">' + _jahrRes(e.resultat, e.fmt) + '</td>' +
        '<td class="ort-text" style="font-size:12px">' + vLink +
          '<span style="color:var(--text2)"> &middot; ' + formatDate(e.datum) + '</span></td>' +
      '</tr>';
    }
    body += '</tbody></table></div></div>';
  }
  return head + body + '</div>';
}

// ── Bestleistungen / Vereinsrekorde des Jahres ──────────────
function _jahrTimeline(d, js) {
  var tl = d.timeline || [];
  var head = '<div class="panel">' +
    '<div class="panel-header"><div class="panel-title">&#x1F3C6; Rekorde &amp; Bestleistungen ' + d.jahr + '</div>' +
    '<div class="panel-count">' + tl.length + (tl.length === 1 ? ' Ereignis' : ' Ereignisse') + '</div></div>';
  if (!js.typen.length) {
    return head + '<div class="empty"><div class="empty-icon">&#x1F50D;</div>' +
      '<div class="empty-text">Kein Ereignistyp ausgew&auml;hlt</div></div></div>';
  }
  if (!tl.length) {
    return head + '<div class="empty"><div class="empty-icon">&#x1F3C6;</div>' +
      '<div class="empty-text">Keine Ereignisse in ' + d.jahr + ' f&uuml;r diese Auswahl</div></div></div>';
  }

  var html = '<div class="timeline">';
  var lastMonat = -1;
  for (var i = 0; i < tl.length; i++) {
    var ev = tl[i];
    var monat = parseInt(String(ev.datum).substr(5, 2), 10) - 1;
    if (monat !== lastMonat) {
      lastMonat = monat;
      html += '<div class="jahr-monat">' + (JAHR_MONATE[monat] || '') + '</div>';
    }
    var res = _jahrRes(ev.resultat, ev.fmt);
    var diszLink = '<span class="athlet-link" style="color:var(--text2);font-size:13px;cursor:pointer" ' +
      'data-rek-disz="' + _jahrEsc(ev.disziplin) + '" data-rek-mid="' + (ev.disziplin_mapping_id || '') + '" ' +
      'onclick="navigateToDisz(this.dataset.rekDisz,this.dataset.rekMid)">' + ergDiszLabel(ev) + '</span>';
    html += '<div class="timeline-item">' +
        '<div class="timeline-date">' + formatDate(ev.datum) + '</div>' +
        '<div class="timeline-body">' +
          '<div class="timeline-athlet-disz">' + _jahrAthLink(ev.athlet_id, _jahrNameVN(ev.athlet)) +
            '<span style="color:var(--text2);margin:0 4px">&middot;</span>' + diszLink +
            (ev.altersklasse ? ' ' + akBadge(ev.altersklasse) : '') +
          '</div>' +
          '<div class="timeline-result">' + res + '</div>' +
          '<div class="timeline-badges">' + timelineBadges(ev) + '</div>' +
        '</div>' +
      '</div>';
  }
  return head + html + '</div></div>';
}
