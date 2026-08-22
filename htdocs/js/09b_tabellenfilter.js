// ── Generische Tabellen-Filterleiste ──────────────────────────────────────
// Vorbild ist die Leiste aus "Meine Ergebnisse": ein Freitext-Suchfeld plus
// beliebig viele Regeln der Form { key, wert }. Die Werteliste einer Regel
// zeigt nur Werte, die mit den *uebrigen* Regeln noch erreichbar sind – jeweils
// mit Trefferzahl. Am Ende steht immer eine leere Zeile "+ Filter…", darueber
// kommt ein weiterer Filter dazu.
//
// Registrieren:
//   tfInit('orte', {
//     spalten:  [{ key: 'land', label: 'Land', wert: function(o) { return o.land || ''; } }],
//     suche:    function(o) { return [o.name, o.region, o.land]; },  // durchsuchte Felder
//     rows:     function() { return _orteCache; },                   // Grunddaten (ungefiltert)
//     onChange: function() { _renderOrte(); },                       // neu zeichnen
//     platzhalter: 'Ort, Region, Land…'
//   });
//
// Einbauen:
//   HTML:    tfBarHtml('orte')      → einmalig in die Seite setzen
//   Filtern: tfFilter('orte', rows) → gefilterte Zeilen
//
// Wichtig: Beim Neuzeichnen nach einer Filteraenderung darf das Suchfeld nicht
// ersetzt werden, sonst verliert es nach jedem Tastendruck den Fokus. tfBarHtml
// deshalb nur einmal einsetzen; onChange ersetzt ausschliesslich den Tabellen-
// teil und ruft danach tfRefresh(id) fuer die Regelzeilen auf.

var _tfCfg   = {};   // id → Konfiguration
var _tfState = {};   // id → { suche: '', regeln: [{ key, wert }] }

function tfInit(id, cfg) {
  _tfCfg[id] = cfg || {};
  if (!_tfState[id]) _tfState[id] = { suche: '', regeln: [] };
  return _tfState[id];
}

function tfState(id) {
  if (!_tfState[id]) _tfState[id] = { suche: '', regeln: [] };
  return _tfState[id];
}

function _tfEsc(s) {
  return (s == null ? '' : String(s))
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function tfRegeln(id) {
  var st = tfState(id);
  if (!Array.isArray(st.regeln)) st.regeln = [];
  return st.regeln;
}

function tfSuchtext(id) { return tfState(id).suche || ''; }

// Ist ueberhaupt ein Filter aktiv? (fuer Reset-Buttons und Zaehlerzeilen)
function tfAktiv(id) {
  if (tfSuchtext(id)) return true;
  return tfRegeln(id).some(function(g) { return g && g.key && g.wert !== '' && g.wert != null; });
}

function tfReset(id) {
  var st = tfState(id);
  st.suche = '';
  st.regeln = [];
  var feld = document.getElementById('tf-' + id + '-suche');
  if (feld) feld.value = '';
  _tfChanged(id);
}

// Klartextwert einer Zeile fuer eine Filterspalte – identisch fuer Werteliste
// und Vergleich beim Filtern.
function tfWert(id, row, key) {
  var cfg = _tfCfg[id] || {};
  var sp  = (cfg.spalten || []).find(function(c) { return c.key === key; });
  var v   = sp && sp.wert ? sp.wert(row) : row[key];
  return v == null ? '' : String(v);
}

// Trifft eine Zeile alle Regeln? `ausser` blendet eine Regel aus – so enthaelt
// die Auswahlliste einer Spalte alle Werte, die mit den uebrigen Filtern noch
// erreichbar sind.
function tfTrifftRegeln(id, row, ausser) {
  var regeln = tfRegeln(id);
  for (var i = 0; i < regeln.length; i++) {
    if (i === ausser) continue;
    var g = regeln[i];
    if (!g || !g.key || g.wert === '' || g.wert == null) continue;
    if (tfWert(id, row, g.key) !== g.wert) return false;
  }
  return true;
}

function tfTrifftSuche(id, row) {
  var q = tfSuchtext(id).toLowerCase().trim();
  if (!q) return true;
  var cfg = _tfCfg[id] || {};
  var felder = cfg.suche
    ? cfg.suche(row)
    : (cfg.spalten || []).map(function(c) { return tfWert(id, row, c.key); });
  if (!Array.isArray(felder)) felder = [felder];
  for (var i = 0; i < felder.length; i++) {
    if (felder[i] != null && String(felder[i]).toLowerCase().indexOf(q) >= 0) return true;
  }
  return false;
}

// Zeilen nach Suche + allen Regeln filtern
function tfFilter(id, rows) {
  if (!rows || !rows.length) return rows || [];
  return rows.filter(function(r) { return tfTrifftSuche(id, r) && tfTrifftRegeln(id, r, -1); });
}

// ── Leiste ────────────────────────────────────────────────
// opts: { suchbreite: CSS-flex des Suchfelds, extra: HTML rechts der Regeln }
function tfBarHtml(id, opts) {
  opts = opts || {};
  var cfg = _tfCfg[id] || {};
  var st  = tfState(id);
  return '<div class="filter-bar" id="tf-' + id + '-bar" style="margin-bottom:16px;flex-wrap:wrap;align-items:flex-end">' +
      '<div class="fg" style="flex:' + (opts.suchbreite || '2') + ';min-width:160px"><label>Suche</label>' +
        '<input type="search" id="tf-' + id + '-suche" placeholder="' + _tfEsc(cfg.platzhalter || 'Suchen…') + '"' +
        ' value="' + _tfEsc(st.suche || '') + '" oninput="tfSuche(\'' + id + '\', this.value)" style="width:100%;min-width:0"/></div>' +
      '<div id="tf-' + id + '-regeln" style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end">' + tfRegelnHtml(id) + '</div>' +
      (opts.extra || '') +
    '</div>';
}

// Nur die Regelzeilen neu zeichnen – das Suchfeld bleibt unberuehrt und behaelt
// damit den Fokus.
function tfRefresh(id) {
  var el = document.getElementById('tf-' + id + '-regeln');
  if (el) el.innerHTML = tfRegelnHtml(id);
}

function tfRegelnHtml(id) {
  var cfg     = _tfCfg[id] || {};
  var spalten = (cfg.spalten || []).filter(function(c) { return !c.keinFilter; });
  var regeln  = tfRegeln(id);
  var zeilen  = regeln.concat([{ key: '', wert: '' }]);

  return zeilen.map(function(g, i) {
    var istNeu = i === regeln.length;
    var spaltenOpts = '<option value="">' + (istNeu ? '+ Filter&hellip;' : '&mdash;') + '</option>' +
      spalten.map(function(c) {
        // Eine Spalte nur einmal filtern
        var belegt = regeln.some(function(x, xi) { return xi !== i && x.key === c.key; });
        if (belegt && g.key !== c.key) return '';
        return '<option value="' + _tfEsc(c.key) + '"' + (g.key === c.key ? ' selected' : '') + '>' + _tfEsc(c.label) + '</option>';
      }).join('');

    var wertSel = '';
    if (g.key) {
      var zaehler = tfWerteliste(id, g.key, i);
      var werte = Object.keys(zaehler).sort(function(a, b) {
        return a.localeCompare(b, 'de', { numeric: true });
      });
      var sp = spalten.find(function(c) { return c.key === g.key; });
      if (sp && sp.absteigend) werte.reverse(); // z.B. Jahr/Datum: neueste zuerst
      wertSel = '<select onchange="tfRegelWert(\'' + id + '\', ' + i + ', this.value)" style="min-width:120px">' +
        '<option value="">Alle</option>' +
        werte.map(function(w) {
          return '<option value="' + _tfEsc(w) + '"' + (g.wert === w ? ' selected' : '') + '>' +
                 _tfEsc(w) + ' (' + zaehler[w] + ')</option>';
        }).join('') +
        (g.wert && !zaehler[g.wert]
          ? '<option value="' + _tfEsc(g.wert) + '" selected>' + _tfEsc(g.wert) + ' (0)</option>' : '') +
      '</select>';
    }

    return '<div class="fg" style="flex:0 0 auto">' +
      '<label>' + (istNeu ? 'Weiterer Filter' : 'Filter ' + (i + 1)) + '</label>' +
      '<div style="display:flex;gap:6px;align-items:center">' +
        '<select onchange="tfRegelSpalte(\'' + id + '\', ' + i + ', this.value)" style="min-width:130px">' + spaltenOpts + '</select>' +
        wertSel +
        (istNeu ? '' : '<button class="btn btn-ghost btn-sm" title="Filter entfernen" onclick="tfRegelWeg(\'' + id + '\', ' + i + ')">&#x2715;</button>') +
      '</div>' +
    '</div>';
  }).join('');
}

// Erreichbare Werte einer Spalte mit Trefferzahl. Serverseitig paginierte
// Tabellen liefern die Liste ueber cfg.facetten(key) selbst; sonst wird sie aus
// den Grunddaten (cfg.rows()) berechnet.
function tfWerteliste(id, key, ausser) {
  var cfg = _tfCfg[id] || {};
  if (cfg.facetten) {
    var f = cfg.facetten(key, ausser);
    if (f) return f;
  }
  var alle = (cfg.rows ? cfg.rows() : []) || [];
  var zaehler = {};
  alle.forEach(function(r) {
    if (!tfTrifftSuche(id, r) || !tfTrifftRegeln(id, r, ausser)) return;
    var w = tfWert(id, r, key);
    if (w === '') return;
    zaehler[w] = (zaehler[w] || 0) + 1;
  });
  return zaehler;
}

function _tfChanged(id) {
  var cfg = _tfCfg[id] || {};
  if (cfg.onChange) cfg.onChange();
  tfRefresh(id);
}

function tfSuche(id, wert) {
  tfState(id).suche = wert;
  if (_tfCfg[id] && _tfCfg[id].entprellung) {
    clearTimeout(_tfState[id]._timer);
    _tfState[id]._timer = setTimeout(function() { _tfChanged(id); }, _tfCfg[id].entprellung);
    return;
  }
  _tfChanged(id);
}

function tfRegelSpalte(id, i, key) {
  var regeln = tfRegeln(id);
  if (i >= regeln.length) { if (key) regeln.push({ key: key, wert: '' }); }
  else if (!key) regeln.splice(i, 1);
  else if (regeln[i].key !== key) { regeln[i].key = key; regeln[i].wert = ''; }
  _tfChanged(id);
  // Direkt zur Wertauswahl derselben Zeile springen
  if (key) setTimeout(function() {
    var zeile = document.querySelectorAll('#tf-' + id + '-regeln .fg')[i];
    var sel   = zeile ? zeile.querySelectorAll('select')[1] : null;
    if (sel) sel.focus();
  }, 0);
}

function tfRegelWert(id, i, wert) {
  var regeln = tfRegeln(id);
  if (regeln[i]) regeln[i].wert = wert;
  _tfChanged(id);
}

function tfRegelWeg(id, i) {
  tfRegeln(id).splice(i, 1);
  _tfChanged(id);
}

// Regel von aussen setzen/entfernen (z.B. Kategorie-Chips ueber der Tabelle)
function tfSetzeRegel(id, key, wert) {
  var regeln = tfRegeln(id);
  var i = regeln.findIndex(function(g) { return g.key === key; });
  if (wert === '' || wert == null) { if (i >= 0) regeln.splice(i, 1); }
  else if (i >= 0) regeln[i].wert = wert;
  else regeln.push({ key: key, wert: wert });
}

function tfRegelWertVon(id, key) {
  var g = tfRegeln(id).find(function(x) { return x.key === key; });
  return g ? g.wert : '';
}
