// Fokus eines Eingabefelds sichern/wiederherstellen (verhindert Fokusverlust bei innerHTML-Ersatz)
function _saveFocus() {
  var ae = document.activeElement;
  if (!ae || !ae.id) return null;
  return { id: ae.id, s: ae.selectionStart, e: ae.selectionEnd };
}
function _restoreFocus(saved) {
  if (!saved) return;
  var el = document.getElementById(saved.id);
  if (!el) return;
  el.focus();
  try { if (saved.s !== null) el.setSelectionRange(saved.s, saved.e); } catch(e) {}
}

function debounce(fn, delay) {
  var timer = null;
  return function() {
    var args = arguments;
    clearTimeout(timer);
    timer = setTimeout(function() { fn.apply(null, args); }, delay || 300);
  };
}

function normalizeUmlauts(s) {
  return (s||'')
    .replace(/ß/g,'ss').replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue')
    .replace(/Ä/g,'Ae').replace(/Ö/g,'Oe').replace(/Ü/g,'Ue')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/ø/g,'o').replace(/Ø/g,'O')
    .replace(/æ/g,'ae').replace(/Æ/g,'Ae')
    .replace(/œ/g,'oe').replace(/Œ/g,'Oe')
    .replace(/ð/g,'d').replace(/Ð/g,'D')
    .replace(/þ/g,'th').replace(/Þ/g,'Th');
}

function setSubTab(t) { state.subTab = t; state.page = 1; state.filters = {}; state.diszFilter = null; syncHash(); renderPage(); }
function setDiszFilter(d) { state.diszFilter = d; state.page = 1; loadErgebnisseData(); }
function setDiszTabFilter(cat, disz) { state.subTab = cat; state.diszFilter = disz; state.page = 1; state.filters = {}; syncHash(); loadErgebnisseData(); }

var _athSucheTimer = null;
function setAthletSuche(v) {
  state.filters.suche = v;
  clearTimeout(_athSucheTimer);
  _athSucheTimer = setTimeout(async function() {
    // Suche ist serverseitig → neu laden, dann rendern
    var s = state.filters.suche || '';
    var rA = await apiGet(s ? 'athleten?suche=' + encodeURIComponent(s) : 'athleten');
    if (rA && rA.ok) { _athLetenCache.alleAthleten = rA.data; }
    _renderAthletenTable();
    // Suchfeld-Fokus erhalten
    var sf = document.getElementById('athlet-suche');
    if (sf) sf.focus();
  }, 250);
}

function setFilter(k, v) {
  state.filters[k] = v; state.page = 1;
  if (state.tab === 'ergebnisse') loadErgebnisseData();
  else if (state.tab === 'athleten') renderAthleten();
  else if (state.tab === 'rekorde') renderRekorde();
}

function clearFilters() { state.filters = {}; state.page = 1; loadErgebnisseData(); }

function buildPagination(page, totalPages, total, callbackFn) {
  if (totalPages <= 1) return '';
  callbackFn = callbackFn || 'goPage';
  var pages = [];
  var s = Math.max(1, page-2), e = Math.min(totalPages, page+2);
  if (s > 1) { pages.push(1); pages.push('...'); }
  for (var i = s; i <= e; i++) pages.push(i);
  if (e < totalPages) { pages.push('...'); pages.push(totalPages); }
  var btns = '';
  for (var i = 0; i < pages.length; i++) {
    var p = pages[i];
    if (p === '...') btns += '<button class="page-btn" disabled>&hellip;</button>';
    else btns += '<button class="page-btn ' + (p === page ? 'active' : '') + '" onclick="' + callbackFn + '(' + p + ')">' + p + '</button>';
  }
  return '<div class="pagination">' +
    '<div class="page-info">Seite ' + page + ' von ' + totalPages + ' &middot; ' + total + ' Eintr&auml;ge</div>' +
    '<div class="page-btns">' +
      '<button class="page-btn" ' + (page===1?'disabled':'') + ' onclick="' + callbackFn + '(' + (page-1) + ')">&#x2190;</button>' +
      btns +
      '<button class="page-btn" ' + (page===totalPages?'disabled':'') + ' onclick="' + callbackFn + '(' + (page+1) + ')">&#x2192;</button>' +
    '</div>' +
  '</div>';
}

function goPage(p) { state.page = p; loadErgebnisseData(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
function goPageVeranst(p) { state.veranstPage = p; renderVeranstaltungen(); window.scrollTo({ top: 0, behavior: 'smooth' }); }

function formatDate(d) {
  if (!d) return '&ndash;';
  var p = String(d).slice(0,10).split('-');
  return p.length === 3 ? p[2] + '.' + p[1] + '.' + p[0] : d;
}

function fmtTime(t, unit) {
  if (!t || t === 'null' || t === 'None') return '&ndash;';
  var str = String(t).trim();

  // Wenn der Wert ein HH:MM:SS-String ist (enthält ':'), immer als Zeit formatieren –
  // egal was unit sagt. Verhindert falsche 's'-Interpretation bei Bahnzeiten.
  var isTimeString = str.indexOf(':') >= 0;

  // Minuten mit Hundertstel, z.B. 2730.99s -> "45:30,99 min"
  if (unit === 'min_h') {
    var cent2, secInt2, totalMins2;
    if (isTimeString) {
      // "M:SS.cc" oder "H:MM:SS.cc" – parseFloat würde am ':' abbrechen
      var _tp = str.replace(',', '.').split(':');
      var _secRaw = parseFloat(_tp[_tp.length - 1]) || 0;
      secInt2   = Math.floor(_secRaw);
      cent2     = Math.round((_secRaw - secInt2) * 100);
      totalMins2 = _tp.length >= 3
        ? (parseInt(_tp[0], 10) || 0) * 60 + (parseInt(_tp[1], 10) || 0)
        : (parseInt(_tp[0], 10) || 0);
    } else {
      var num2 = parseFloat(str.replace(',', '.'));
      if (isNaN(num2)) return str + '<span style="font-size:.75em;opacity:.7;margin-left:1px">min</span>';
      var totalSecs2 = Math.floor(num2);
      cent2      = Math.round((num2 - totalSecs2) * 100);
      secInt2    = totalSecs2 % 60;
      totalMins2 = Math.floor(totalSecs2 / 60);
    }
    var centStr2 = String(cent2).padStart(2, '0');
    return totalMins2 + ':' + String(secInt2).padStart(2, '0') + ',' + centStr2 + '<span style="font-size:.75em;opacity:.7;margin-left:1px">min</span>';
  }

  // Sprint-Modus: Sekunden mit Hundertstel, z.B. "10.45" -> "10,45s"
  // Aber NUR wenn es kein HH:MM:SS-String ist
  if (unit === 's' && !isTimeString) {
    var num = parseFloat(str.replace(',', '.'));
    if (isNaN(num)) return str + '<span style="font-size:.75em;opacity:.7;margin-left:1px">s</span>';
    var sInt = Math.floor(num);
    var cent = Math.round((num - sInt) * 100);
    var centStr = String(cent).padStart(2, '0');
    return sInt + ',' + centStr + '<span style="font-size:.75em;opacity:.7;margin-left:1px">s</span>';
  }

  // Normale Zeitformatierung
  // Millisekunden/Mikrosekunden abschneiden: "04.100000" -> "04"
  str = str.replace(/(\.\d+)(?=\s*$|:)/, '').replace(/\.\d+$/, '');
  var parts;
  if (/^\d+$/.test(str)) {
    var secs = parseInt(str, 10);
    var h = Math.floor(secs / 3600);
    var m = Math.floor((secs % 3600) / 60);
    var s = secs % 60;
    parts = h > 0 ? [h, m, s] : [m, s];
  } else {
    parts = str.split(':').map(function(p) { return parseInt(p, 10); });
    while (parts.length > 2 && parts[0] === 0) parts.shift();
  }
  var result = parts.map(function(p, i) {
    return i === 0 ? String(p) : String(p).padStart(2, '0');
  }).join(':');
  var u = (!isTimeString && unit === 's') ? 's' : (unit && unit !== 's' ? unit : (parts.length >= 3 ? 'h' : 'min'));
  return result + '<span style="font-size:.75em;opacity:.7;margin-left:1px">' + u + '</span>';
}

function fmtMeter(v) {
  if (!v || v === 'null' || v === 'None') return '&ndash;';
  return String(v).replace(/\.0+$/, '') + '<span style="font-size:.75em;opacity:.7;margin-left:1px">m</span>';
}

// Formatiert einen numerischen Vorher-Wert (Sekunden oder Meter) aus der API
function fmtValNum(val, fmt) {
  if (val === null || val === undefined) return null;
  val = parseFloat(val);
  if (isNaN(val)) return null;
  if (fmt === 'm') {
    var m = Math.round(val * 100) / 100;
    return String(m).replace(/\.0+$/, '').replace('.', ',') + '<span style="font-size:.75em;opacity:.7;margin-left:1px">m</span>';
  }
  if (fmt === 's') {
    var sInt = Math.floor(val);
    var cent = Math.round((val - sInt) * 100);
    return sInt + ',' + String(cent).padStart(2, '0') + '<span style="font-size:.75em;opacity:.7;margin-left:1px">s</span>';
  }
  if (fmt === 'min_h') {
    var totalSecs = Math.floor(val);
    var h3 = Math.floor(totalSecs / 3600);
    var m3 = Math.floor((totalSecs % 3600) / 60);
    var s3 = totalSecs % 60;
    var cent3 = Math.round((val - totalSecs) * 100);
    var parts3 = h3 > 0 ? [h3, m3, s3] : [m3, s3];
    var result3 = parts3.map(function(p, i) { return i === 0 ? String(p) : String(p).padStart(2, '0'); }).join(':');
    return result3 + ',' + String(cent3).padStart(2, '0') + '<span style="font-size:.75em;opacity:.7;margin-left:1px">min</span>';
  }
  // Zeitformat (Sekunden → h:mm:ss oder m:ss)
  var secs = Math.round(val);
  var h = Math.floor(secs / 3600);
  var m = Math.floor((secs % 3600) / 60);
  var s = secs % 60;
  var parts = h > 0 ? [h, m, s] : [m, s];
  var result = parts.map(function(p, i) { return i === 0 ? String(p) : String(p).padStart(2, '0'); }).join(':');
  var unit = h > 0 ? 'h' : 'min';
  return result + '<span style="font-size:.75em;opacity:.7;margin-left:1px">' + unit + '</span>';
}

function renderGruppenInline(gruppen) {
  if (!gruppen || !gruppen.length) return '<span style="color:var(--text2)">&ndash;</span>';
  var html = '';
  for (var i = 0; i < gruppen.length; i++) {
    html += '<span class="badge badge-ak" style="margin-right:3px">' + gruppen[i].name + '</span>';
  }
  return html;
}

function akBadge(ak) {
  if (!ak) return '&ndash;';
  var cls = /^W/i.test(ak) ? 'badge-w' : /^[MHD]/i.test(ak) ? 'badge-m' : '';
  return '<span class="badge ' + cls + '">' + ak + '</span>';
}

function notify(msg, type) {
  var el = document.createElement('div');
  el.className = 'notification notif-' + (type || 'ok');
  el.textContent = msg;
  document.getElementById('notification-container').appendChild(el);
  setTimeout(function() { el.remove(); }, 3500);
}

function showModal(html, wide, noClose) {
  var cls = wide === 'profile' ? 'modal modal-profile' : (wide ? 'modal modal-wide' : 'modal');
  var overlayClick = noClose ? '' : ' onclick="if(event.target===this)closeModal()"';
  document.getElementById('modal-container').innerHTML =
    '<div class="modal-overlay"' + overlayClick + '>' +
      '<div class="' + cls + '">' + html + '</div>' +
    '</div>';
}

function closeModal() { document.getElementById('modal-container').innerHTML = ''; }

// ── THEME ─────────────────────────────────────────────────
function getThemePref() {
  return localStorage.getItem('theme') || 'auto';
}

function applyTheme() {
  var pref = getThemePref();
  var root = document.documentElement;
  if (pref === 'dark') {
    root.setAttribute('data-theme', 'dark');
  } else if (pref === 'light') {
    root.setAttribute('data-theme', 'light');
  } else {
    // auto: entferne data-theme, OS-Einstellung greift über media query
    root.removeAttribute('data-theme');
  }
}

function setTheme(pref) {
  localStorage.setItem('theme', pref);
  applyTheme();
  // Adressleiste neu einfärben nach Theme-Wechsel
  _updateBodyThemeColor();
  if (window.appConfig) applyConfig(window.appConfig);
  // Buttons im Modal aktualisieren falls geöffnet
  var container = document.getElementById('theme-btns');
  if (container) {
    var btns = container.querySelectorAll('button');
    var prefs = ['auto', 'light', 'dark'];
    for (var i = 0; i < btns.length; i++) {
      btns[i].className = 'btn btn-sm ' + (pref === prefs[i] ? 'btn-primary' : 'btn-ghost');
    }
  }
}

// ── START ──────────────────────────────────────────────────
applyTheme();
init();
document.addEventListener('click', function(ev) {
  var el = ev.target;
  while (el && el !== document.body) {
    if (el.getAttribute && el.getAttribute('data-athlet-id')) {
      openAthletById(parseInt(el.getAttribute('data-athlet-id'), 10));
      return;
    }
    el = el.parentNode;
  }
});

// ── VERANSTALTUNGEN ────────────────────────────────────────


// Meisterschaft-Spalten ein-/ausblenden + Wert sofort auf alle setzen
function importToggleMstr(prefix, show, mstrVal) {
  // Header-Spalten
  document.querySelectorAll('.' + prefix + '-mstr-th').forEach(function(th) {
    th.style.display = show ? '' : 'none';
  });
  // Zeilen-Zellen
  document.querySelectorAll('.' + prefix + '-mstr').forEach(function(td) {
    td.style.display = show ? '' : 'none';
  });
  // Wert sofort auf alle Selects setzen
  document.querySelectorAll('.' + prefix + '-mstr-sel').forEach(function(s) {
    s.value = show ? (mstrVal || '') : '';
  });
  // MS-Platz-Felder: beim Einblenden AK-Platz der jeweiligen Zeile übernehmen
  document.querySelectorAll('.' + prefix + '-mstr-platz').forEach(function(inp) {
    if (show) {
      // AK-Platz aus derselben Tabellenzeile lesen
      var tr = inp.closest('tr');
      var akPlatz = tr ? (tr.querySelector('.' + prefix + '-platz') || {}).value : '';
      inp.value = akPlatz || inp.defaultValue || '';
    } else {
      inp.value = '';
    }
  });
}

// ── Ergebnis-Formatierung ────────────────────────────────────────────────────

// Für Anzeige in Input-Feldern: Punkt → Komma (z.B. "6.93" → "6,93")
function fmtRes(v) {
  if (v === null || v === undefined) return '';
  return String(v).replace('.', ',');
}

// Für Datenbank / Berechnungen: Komma → Punkt (z.B. "6,93" → "6.93")
function dbRes(v) {
  if (v === null || v === undefined) return '';
  return String(v).replace(',', '.');
}
