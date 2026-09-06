// ============================================================
// Gemeinsame Basis-Helfer (Statistik- und Trainingsportal)
// ------------------------------------------------------------
// Portal-neutrale Bausteine ohne Abhaengigkeit zu `state`,
// `appConfig` oder einer bestimmten Seite. Das Trainingsportal
// liest diese Datei ueber `shared.php?file=js/09a_utils_shared.js`
// aus diesem Verzeichnis – eine Quelle fuer beide Portale.
//
// Wer hier etwas ergaenzt, muss ohne Statistikportal-Globals
// auskommen; alles Portal-Spezifische gehoert nach 09_utils.js.
// ============================================================

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

// Standard-Modal-Header: `<h2>title <close-x></h2>`. Spart das Inline-Markup
// bei den ~24 showModal()-Aufrufen mit einfachem closeModal()-Schließer.
function modalH2(titleHtml) {
  return '<h2>' + titleHtml + ' <button class="modal-close" onclick="closeModal()">&#x2715;</button></h2>';
}
function buildSelectOptions(items, emptyLabel, getVal, getLabel, isSelected) {
  var html = '<option value="">' + (emptyLabel || '') + '</option>';
  for (var _i = 0; _i < items.length; _i++) {
    var _item = items[_i];
    var _v = getVal ? getVal(_item) : String(_item);
    var _l = getLabel ? getLabel(_item) : String(_item);
    html += '<option value="' + _v + '"' + (isSelected(_item, _v) ? ' selected' : '') + '>' + _l + '</option>';
  }
  return html;
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
function formatDate(d) {
  if (!d) return '&ndash;';
  var p = String(d).slice(0,10).split('-');
  return p.length === 3 ? p[2] + '.' + p[1] + '.' + p[0] : d;
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
  var overlayClick = '';
  document.getElementById('modal-container').innerHTML =
    '<div class="modal-overlay"' + overlayClick + '>' +
      '<div class="' + cls + '">' + html + '</div>' +
    '</div>';
}

function closeModal() { document.getElementById('modal-container').innerHTML = ''; }

/**
 * Eigenes Overlay fuer Rueckfragen und Eingaben – bewusst NICHT ueber
 * showModal().
 *
 * showModal() ersetzt den Inhalt von #modal-container. Eine Rueckfrage aus
 * einem offenen Formular heraus ("Diese Einheit wirklich loeschen?") wuerde
 * dieses Formular damit ueberschreiben, und nach "Abbrechen" waere es weg.
 * Diese Dialoge haengen sich deshalb als eigenes Overlay an <body> und legen
 * sich mit hoeherem z-index darueber; darunter bleibt alles unberuehrt.
 */
function _dialogOverlay(innerHtml) {
  var ov = document.createElement('div');
  ov.className = 'modal-overlay';
  ov.style.zIndex = '3000';
  ov.innerHTML = '<div class="modal">' + innerHtml + '</div>';
  document.body.appendChild(ov);
  return ov;
}

function _htmlEsc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function confirmModal(msg) {
  return new Promise(function(resolve) {
    var ov = _dialogOverlay(
      '<p style="margin:0 0 20px;white-space:pre-wrap">' + _htmlEsc(msg) + '</p>' +
      '<div class="modal-actions">' +
        '<button class="btn btn-ghost" data-cm="0">Abbrechen</button>' +
        '<button class="btn btn-danger" data-cm="1">OK</button>' +
      '</div>'
    );
    function fertig(wert) {
      document.removeEventListener('keydown', beiTaste, true);
      ov.remove();
      resolve(wert);
    }
    function beiTaste(ev) {
      if (ev.key === 'Escape') { ev.stopPropagation(); fertig(false); }
    }
    ov.querySelector('[data-cm="0"]').addEventListener('click', function() { fertig(false); });
    ov.querySelector('[data-cm="1"]').addEventListener('click', function() { fertig(true); });
    document.addEventListener('keydown', beiTaste, true);
    ov.querySelector('[data-cm="1"]').focus();
  });
}

/**
 * Texteingabe im Portal-Design – der Ersatz fuer window.prompt().
 * Loest mit dem eingegebenen Text auf, oder mit null bei Abbruch.
 *
 * promptModal('Neuer Name:', 'alter Name').then(function(wert) { … });
 *
 * `mehrzeilig` schaltet auf ein Textfeld um; `readonly` zeigt einen Wert nur
 * zum Kopieren an (dann gibt es keinen Abbrechen-Knopf, nur Schliessen).
 */
function promptModal(msg, vorgabe, opt) {
  opt = opt || {};
  return new Promise(function(resolve) {
    var wert = (vorgabe === undefined || vorgabe === null) ? '' : String(vorgabe);
    var attr = 'class="settings-input" style="width:100%"' + (opt.readonly ? ' readonly' : '');
    var feld = opt.mehrzeilig
      ? '<textarea ' + attr + ' rows="4">' + _htmlEsc(wert) + '</textarea>'
      : '<input type="text" ' + attr + ' value="' +
        _htmlEsc(wert).replace(/"/g, '&quot;') + '">';

    var ov = _dialogOverlay(
      '<p style="margin:0 0 12px;white-space:pre-wrap">' + _htmlEsc(msg) + '</p>' +
      feld +
      '<div class="modal-actions">' +
        (opt.readonly
          ? '<button class="btn btn-primary" data-pm="cancel">Schließen</button>'
          : '<button class="btn btn-ghost" data-pm="cancel">Abbrechen</button>' +
            '<button class="btn btn-primary" data-pm="ok">OK</button>') +
      '</div>'
    );

    var el = ov.querySelector('input, textarea');
    function fertig(wert) {
      document.removeEventListener('keydown', beiTaste, true);
      ov.remove();
      resolve(wert);
    }
    function beiTaste(ev) {
      if (ev.key === 'Escape') { ev.stopPropagation(); fertig(null); }
    }
    ov.querySelector('[data-pm="cancel"]').addEventListener('click', function() { fertig(null); });
    var okBtn = ov.querySelector('[data-pm="ok"]');
    if (okBtn) okBtn.addEventListener('click', function() { fertig(el ? el.value : null); });

    document.addEventListener('keydown', beiTaste, true);
    if (el) {
      el.focus();
      el.select();
      // Enter bestaetigt – aber nicht im mehrzeiligen Feld, dort ist er ein Zeilenumbruch.
      el.addEventListener('keydown', function(ev) {
        if (ev.key === 'Enter' && !opt.mehrzeilig && !opt.readonly) {
          ev.preventDefault();
          fertig(el.value);
        }
      });
    }
  });
}

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
