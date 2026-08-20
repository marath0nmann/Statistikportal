// ── JAHRESÜBERSICHT ────────────────────────────────────────
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

// Standard: nur Titel und Podestplätze, keine Bestleistungs-Ereignisse.
var JAHR_TYPEN_DEFAULT = [];

function _jahrState() {
  if (!state.jahrState) {
    var _up = state.userPrefs || {};
    state.jahrState = {
      jahr:  null,
      // Array.isArray statt .length: eine leere Auswahl ist eine gültige
      // gespeicherte Einstellung und darf nicht auf den Standard zurückfallen.
      typen: Array.isArray(_up.jahr_typen) ? _up.jahr_typen.slice() : JAHR_TYPEN_DEFAULT.slice(),
      // Standard: nur favorisierte Disziplinen
      fav:   _up.jahr_fav === undefined ? true : !!_up.jahr_fav,
      // Standard: nach Athlet*in zusammengefasst; 'chrono' = chronologische Liste
      view:  _up.jahr_view === 'chrono' ? 'chrono' : 'athlet',
    };
  }
  return state.jahrState;
}

// Label-Typ eines Timeline-Labels – identisch zu jahrLabelTyp() in der API
// und zu timelineLabelType() im Admin-Bereich.
function _jahrTypOf(lbl) {
  if (!lbl) return null;
  if (lbl === 'Vereinsrekord' || lbl === 'Gesamtbestleistung' || lbl === 'Erste Gesamtleistung') return 'gesamt';
  if (lbl === 'Bestleistung M\u00e4nner' || lbl === 'Bestleistung Frauen' ||
      lbl === 'Erstes Ergebnis M' || lbl === 'Erstes Ergebnis W') return 'gender';
  if (lbl === 'PB' || lbl === 'Deb\u00fct') return 'pb';
  if (lbl.indexOf('Bestleistung') >= 0 || lbl.indexOf('Erste Leistung') >= 0 ||
      lbl.indexOf('Erstes Ergebnis') === 0) return 'ak';
  return 'pb';
}

// Die Ereignisse werden immer vollständig geladen und hier nach den aktiven
// Label-Typen gefiltert. Ein Filterklick löst dadurch keine neue (langsame)
// Anfrage aus – und eine verspätet eintreffende Antwort kann die Ansicht nicht
// mehr mit Ereignissen überschreiben, die der Filter gerade ausgeschlossen hat.
function _jahrFilterTimeline(d, js) {
  var out = [], all = d.timeline || [];
  for (var i = 0; i < all.length; i++) {
    var ev = all[i];
    var tc = _jahrTypOf(ev.label_club), tp = _jahrTypOf(ev.label_pers);
    var okC = !!tc && js.typen.indexOf(tc) >= 0;
    var okP = !!tp && js.typen.indexOf(tp) >= 0;
    if (!okC && !okP) continue;
    var c = Object.assign({}, ev);
    // Ausgefiltertes Label entfernen, sonst rendert timelineBadges() es trotzdem
    if (!okC) { c.label_club = null; c.vorher_club = null; }
    if (!okP) { c.label_pers = null; c.vorher_pers = null; }
    c.label = c.label_club || c.label_pers || null;
    c.typ   = okC ? tc : tp;
    out.push(c);
  }
  return out;
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

// Rohdaten je Jahr/Favoriten-Auswahl; wird beim Betreten der Seite geleert.
var _jahrCache = {};
var _jahrReqSeq = 0;

function _jahrResetCache() { _jahrCache = {}; }

async function renderJahresBestleistungen() {
  var js = _jahrState();
  var el = document.getElementById('main-content');
  var cacheKey = (js.jahr || 'neuestes') + '|' + (js.fav ? '1' : '0');
  var d = _jahrCache[cacheKey];

  if (!d) {
    var seq = ++_jahrReqSeq;
    el.innerHTML = '<div class="loading"><div class="spinner"></div>Lade Jahres&uuml;bersicht&hellip;</div>';
    // Immer alle Label-Typen laden – gefiltert wird clientseitig
    var q = 'jahres-bestleistungen?typen=gesamt,gender,ak,pb&fav=' + (js.fav ? '1' : '0');
    if (js.jahr) q += '&jahr=' + js.jahr;
    var r = await apiGet(q);
    // Verspätete Antwort einer überholten Anfrage verwerfen
    if (seq !== _jahrReqSeq || state.tab !== 'jahr') return;
    if (!r || !r.ok) {
      el.innerHTML = '<div class="panel" style="padding:24px;text-align:center;color:var(--accent)">' +
        _jahrEsc((r && r.fehler) || 'Fehler beim Laden.') + '</div>';
      return;
    }
    d = r.data;
    _jahrCache[cacheKey] = d;
    // Beim ersten Laden bestimmt der Server das Jahr – unter dem Schlüssel merken
    if (!js.jahr) _jahrCache[d.jahr + '|' + (js.fav ? '1' : '0')] = d;
  }

  js.jahr = d.jahr;
  syncHash();

  // Gefilterte Sicht auf die Rohdaten
  var dv = { jahr: d.jahr, jahre: d.jahre, meisterschaften: d.meisterschaften,
             timeline: _jahrFilterTimeline(d, js) };

  var body = js.view === 'chrono'
    ? (_jahrMeisterschaften(dv) + _jahrTimeline(dv, js))
    : _jahrNachAthlet(dv, js);
  el.innerHTML = _jahrHeader(dv, js) + _jahrStatsBar(dv) + body;
}

// ── Jahresauswahl + Filter ──────────────────────────────────
function _jahrHeader(d, js) {
  var jahre = d.jahre || [];
  var chips = '';
  for (var i = 0; i < jahre.length; i++) {
    var j = jahre[i];
    var n = (j.titel || 0) + (j.silber || 0) + (j.bronze || 0) +
            (j.rekorde || 0) + (j.bestleistungen || 0) + (j.pb || 0);
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

  var view = '<div class="jahr-view-switch">' +
    '<button class="rek-cat-btn jahr-filter-btn' + (js.view === 'athlet' ? ' active' : '') + '" onclick="setJahrView(\'athlet\')">&#x1F464; Nach Athlet*in</button>' +
    '<button class="rek-cat-btn jahr-filter-btn' + (js.view === 'chrono' ? ' active' : '') + '" onclick="setJahrView(\'chrono\')">&#x1F4C6; Chronologisch</button>' +
  '</div>';

  return '<div class="jahr-chips">' + chips + '</div>' +
         '<div class="rek-cat-tabs" style="padding-top:4px">' + filter + view + '</div>';
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

function setJahrView(v) {
  var js = _jahrState();
  if (js.view === v) return;
  js.view = v;
  _saveJahrPrefs();
  renderJahresBestleistungen();
}

// Filtereinstellungen am Benutzerkonto merken (wie _saveRekPrefs)
function _saveJahrPrefs() {
  if (!currentUser) return;
  var js = _jahrState();
  var prefs = { jahr_typen: js.typen.slice(), jahr_fav: !!js.fav, jahr_view: js.view };
  if (!state.userPrefs) state.userPrefs = {};
  Object.assign(state.userPrefs, prefs);
  apiPut('auth/prefs', prefs).catch(function(){});
}

// ── Kennzahlen ──────────────────────────────────────────────
// Bewusst die ungefilterten Jahreszahlen aus d.jahre: die Leiste beschreibt
// das Jahr als Ganzes und ändert sich nicht mit Ereignistyp- oder
// Favoriten-Filter.
function _jahrStatsBar(d) {
  var st = null, jahre = d.jahre || [];
  for (var i = 0; i < jahre.length; i++) { if (jahre[i].jahr === d.jahr) { st = jahre[i]; break; } }
  if (!st) st = { titel: 0, silber: 0, bronze: 0, rekorde: 0, bestleistungen: 0, pb: 0 };
  function card(num, icon, label) {
    return '<div class="stat-card"><div class="stat-num">' + (num || 0) + '</div>' +
           '<div class="stat-label">' + icon + ' ' + label + '</div></div>';
  }
  return '<div class="stats-bar" style="margin-bottom:16px">' +
      card(st.titel,          '&#x1F947;', 'Titel') +
      card(st.silber,         '&#x1F948;', 'Zweite Pl&auml;tze') +
      card(st.bronze,         '&#x1F949;', 'Dritte Pl&auml;tze') +
      card(st.rekorde,        '&#x1F3C6;', 'Vereinsrekorde') +
      card(st.bestleistungen, '&#x1F3C5;', 'Bestleistungen AK') +
      card(st.pb,             '&#x2B50;',  'Pers&ouml;nliche Bestleistungen') +
    '</div>';
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

// ── Nach Athlet*in zusammengefasst ──────────────────────────
// Alle Ereignisse eines Jahres – Podestplätze wie Rekorde – gebündelt pro
// Athlet*in, sortiert nach Wertigkeit (Titel > Podeste > Rekorde > …).
// Podestplatz und Bestleistungs-Ereignis können dasselbe Ergebnis betreffen
// (z.B. Hochsprung 0,80 m: 2. Platz bei der Meisterschaft UND erste Leistung M75).
// Dieser Schlüssel erkennt das, damit beides in einer Zeile landet.
function _jahrEvKey(e) {
  return String(e.datum) + '|' + (e.disziplin_mapping_id || e.disziplin || '') + '|' + String(e.resultat);
}

function _jahrAthletenMap(d) {
  var map = {}, order = [];
  function slot(id, name, avatar) {
    var key = id || ('n_' + name);
    if (!map[key]) {
      map[key] = { id: id || null, name: name, avatar: avatar || null,
                   titel: 0, silber: 0, bronze: 0, rekorde: 0, best: 0, pb: 0,
                   events: [], msKeys: {} };
      order.push(key);
    }
    // Namen/Avatar nachtragen, falls erst eine spätere Quelle sie liefert
    if (!map[key].avatar && avatar) map[key].avatar = avatar;
    if (name && name.indexOf(',') < 0) map[key].name = name;
    return map[key];
  }

  var ms = d.meisterschaften || [];
  for (var i = 0; i < ms.length; i++) {
    var e = ms[i];
    var a = slot(e.athlet_id, e.athlet, e.avatar);
    if (e.platz === 1) a.titel++; else if (e.platz === 2) a.silber++; else if (e.platz === 3) a.bronze++;
    var msItem = { art: 'ms', datum: e.datum, e: e, rek: null };
    a.events.push(msItem);
    a.msKeys[_jahrEvKey(e)] = msItem;
  }

  var tl = d.timeline || [];
  for (var t = 0; t < tl.length; t++) {
    var ev = tl[t];
    var b = slot(ev.athlet_id, _jahrNameVN(ev.athlet), null);
    if (ev.typ === 'gesamt' || ev.typ === 'gender') b.rekorde++;
    else if (ev.typ === 'ak') b.best++;
    else b.pb++;
    // Gehört das Ereignis zu einem bereits gelisteten Podestplatz? → zusammenfassen
    var hit = b.msKeys[_jahrEvKey(ev)];
    if (hit) hit.rek = ev;
    else b.events.push({ art: 'rek', datum: ev.datum, e: ev });
  }

  var list = order.map(function(k) { return map[k]; });
  list.sort(function(x, y) {
    return (y.titel - x.titel) || (y.silber - x.silber) || (y.bronze - x.bronze) ||
           (y.rekorde - x.rekorde) || (y.best - x.best) || (y.pb - x.pb) ||
           String(x.name).localeCompare(String(y.name));
  });
  for (var li = 0; li < list.length; li++) list[li].events.sort(_jahrEvSort);
  return list;
}

// Wertigkeit eines Bestleistungs-Ereignisses (0 = höchste)
function _jahrTypRang(t) {
  return t === 'gesamt' ? 0 : t === 'gender' ? 1 : t === 'ak' ? 2 : 3;
}

// Reihenfolge innerhalb eines Athletenblocks:
//   1. Podestplätze – nach Platzierung, bei gleicher Platzierung nach Wertigkeit
//      der Meisterschaft (mstr_rang aus Admin → Meisterschaftsarten, also
//      Deutsche oben, Regio unten)
//   2. darunter die allein stehenden Rekorde/Bestleistungen/PBs, nach Wertigkeit
// Innerhalb einer Stufe jeweils chronologisch.
function _jahrEvSort(p, q) {
  var pm = (p.art === 'ms'), qm = (q.art === 'ms');
  if (pm !== qm) return pm ? -1 : 1;
  if (pm) {
    return (p.e.platz - q.e.platz) ||
           ((p.e.mstr_rang || 0) - (q.e.mstr_rang || 0)) ||
           String(p.datum).localeCompare(String(q.datum));
  }
  return (_jahrTypRang(p.e.typ) - _jahrTypRang(q.e.typ)) ||
         String(p.datum).localeCompare(String(q.datum));
}

function _jahrNachAthlet(d, js) {
  var list = _jahrAthletenMap(d);
  var head = '<div class="panel">' +
    '<div class="panel-header"><div class="panel-title">&#x1F464; Jahr ' + d.jahr + ' nach Athlet*in</div>' +
    '<div class="panel-count">' + list.length + (list.length === 1 ? ' Athlet*in' : ' Athlet*innen') + '</div></div>';
  if (!js.typen.length && !(d.meisterschaften || []).length) {
    return head + '<div class="empty"><div class="empty-icon">&#x1F50D;</div>' +
      '<div class="empty-text">Kein Ereignistyp ausgew&auml;hlt</div></div></div>';
  }
  if (!list.length) {
    return head + '<div class="empty"><div class="empty-icon">&#x1F464;</div>' +
      '<div class="empty-text">Keine Ereignisse in ' + d.jahr + ' f&uuml;r diese Auswahl</div></div></div>';
  }

  var body = '';
  for (var i = 0; i < list.length; i++) {
    var a = list[i];
    var sum = [];
    if (a.titel)   sum.push('<span class="jahr-sum gold">&#x1F947; ' + a.titel + ' Titel</span>');
    if (a.silber)  sum.push('<span class="jahr-sum">&#x1F948; ' + a.silber + 'x 2. Platz</span>');
    if (a.bronze)  sum.push('<span class="jahr-sum">&#x1F949; ' + a.bronze + 'x 3. Platz</span>');
    if (a.rekorde) sum.push('<span class="jahr-sum gold">&#x1F3C6; ' + a.rekorde + (a.rekorde === 1 ? ' Vereinsrekord' : ' Vereinsrekorde') + '</span>');
    if (a.best)    sum.push('<span class="jahr-sum">&#x1F3C5; ' + a.best + (a.best === 1 ? ' Bestleistung AK' : ' Bestleistungen AK') + '</span>');
    if (a.pb)      sum.push('<span class="jahr-sum">&#x2B50; ' + a.pb + ' PB / Deb&uuml;t</span>');

    var rows = '';
    for (var ei = 0; ei < a.events.length; ei++) {
      var it = a.events[ei], e = it.e;
      var disz = '<span class="athlet-link" style="cursor:pointer" ' +
        'data-rek-disz="' + _jahrEsc(e.disziplin) + '" data-rek-mid="' + (e.disziplin_mapping_id || '') + '" ' +
        'onclick="navigateToDisz(this.dataset.rekDisz,this.dataset.rekMid)">' + ergDiszLabel(e) + '</span>';
      var info, cls;
      if (it.art === 'ms') {
        var vname = e.veranstaltung || e.kuerzel || '';
        cls = e.platz === 1 ? ' jahr-titel-row' : '';
        info = medalBadge(e.platz) + ' <span class="badge badge-ms">' + _jahrEsc(e.mstr_label) + '</span>' +
               // Dasselbe Ergebnis war zugleich ein Rekord/eine Bestleistung
               (it.rek ? ' ' + timelineBadges(it.rek) : '') +
               (e.altersklasse ? ' ' + akBadge(e.altersklasse) : '') +
               (vname ? '<span class="jahr-ev-ort">' + _jahrEsc(vname) + '</span>' : '');
      } else {
        cls = '';
        info = timelineBadges(e) + (e.altersklasse ? ' ' + akBadge(e.altersklasse) : '');
      }
      rows += '<div class="jahr-ev' + cls + '">' +
          '<div class="jahr-ev-datum">' + formatDate(e.datum) + '</div>' +
          '<div class="jahr-ev-disz">' + disz + '</div>' +
          '<div class="jahr-ev-res">' + _jahrRes(e.resultat, e.fmt) + '</div>' +
          '<div class="jahr-ev-info">' + info + '</div>' +
        '</div>';
    }

    body += '<div class="jahr-ath-block">' +
        '<div class="jahr-ath-head">' +
          avatarHtml(a.avatar, a.name, 38, 15) +
          '<div style="min-width:0">' +
            '<div class="jahr-ath-name">' + _jahrAthLink(a.id, a.name) + '</div>' +
            (sum.length ? '<div class="jahr-ath-sum">' + sum.join('') + '</div>' : '') +
          '</div>' +
        '</div>' +
        '<div class="jahr-ath-events">' + rows + '</div>' +
      '</div>';
  }
  return head + body + '</div>';
}
