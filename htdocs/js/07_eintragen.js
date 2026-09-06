// ── Eigenes Ergebnis eintragen ────────────────────────────
var _eeSelectedVeranst = null;
var _eeVeranstSearchTimer = null;
var _eeVeranstResults = [];

function renderEigenesEintragen() {
  var el = document.getElementById('main-content');
  var clubName = (appConfig && appConfig.verein_name) ? appConfig.verein_name : '';
  var katOpts = '<option value="">-- Kategorie wählen --</option>';
  var seen = {};
  (state.disziplinen || []).forEach(function(d) {
    if (d.tbl_key && !seen[d.tbl_key]) { seen[d.tbl_key] = true; katOpts += '<option value="' + d.tbl_key + '">' + d.kategorie + '</option>'; }
  });

  var veranstPruefen = !appConfig || appConfig.eigenes_veranst_prufen !== '0';
  var ergebnisPruefen = !appConfig || appConfig.eigenes_ergebnis_prufen !== '0';

  el.innerHTML += (
    '<div class="panel" style="max-width:560px;padding:24px">' +
      '<div class="panel-title" style="margin-bottom:4px">&#x1F3C3;&#xFE0E; Eigenes Ergebnis eintragen</div>' +
      '<div style="color:var(--text2);font-size:13px;margin-bottom:16px">Ergebnis für dein eigenes Athletenprofil eintragen.</div>' +

      '<div style="display:flex;gap:8px;margin-bottom:16px">' +
        '<button id="ee-toggle-neu" class="btn btn-primary btn-sm" onclick="eeBkToggle(\'neu\')">+ Neue Veranstaltung</button>' +
        '<button id="ee-toggle-best" class="btn btn-ghost btn-sm" onclick="eeBkToggle(\'best\')">&#x1F4C5; Bestehende wählen</button>' +
      '</div>' +

      '<div id="ee-neu-form" class="form-grid" style="margin-bottom:16px">' +
        '<div class="form-group">' +
          '<label>Datum *</label>' +
          '<input type="date" id="ee-datum" value="' + new Date().toISOString().slice(0,10) + '" onchange="_eeAutoAk()"/>' +
        '</div>' +
        '<div class="form-group">' +
          '<label>Ort *</label>' +
          '<select id="ee-ort" onchange="eeOrtChanged(this)"><option value="">– wird geladen –</option></select>' +
        '</div>' +
        '<div class="form-group full">' +
          '<label>Veranstaltungsname</label>' +
          '<input type="text" id="ee-evname" placeholder="z.B. Düsseldorf Marathon"/>' +
        '</div>' +
        (veranstPruefen ? '<div class="form-group full" style="background:color-mix(in srgb,var(--accent) 6%,transparent);border-radius:8px;padding:10px 12px">' +
          '<div style="font-size:12px;color:var(--accent);font-weight:600">&#x2139;&#xFE0E; Neue Veranstaltungen werden von einem Editor oder Admin geprüft.</div>' +
        '</div>' : '') +
      '</div>' +

      '<div id="ee-best-form" style="display:none;margin-bottom:16px">' +
        '<label style="font-size:12px;font-weight:600;color:var(--text2);display:block;margin-bottom:6px">Veranstaltung *</label>' +
        '<input id="ee-veranst-search" type="text" placeholder="Name, Kürzel oder Ort suchen…" autocomplete="off"' +
          ' style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--surface);color:var(--text);box-sizing:border-box"' +
          ' oninput="eeVeranstSearch(this.value)" onfocus="eeVeranstSearch(this.value)" onblur="setTimeout(eeVeranstHideDropdown,200)">' +
      '</div>' +

      '<div class="form-grid" style="margin-bottom:16px">' +
        '<div class="form-group">' +
          '<label>Kategorie *</label>' +
          '<select id="ee-kat" onchange="_eeUpdateDisz()">' + katOpts + '</select>' +
        '</div>' +
        '<div class="form-group">' +
          '<label>Disziplin *</label>' +
          '<select id="ee-disz"><option value="">-- erst Kategorie wählen --</option></select>' +
        '</div>' +
        '<div class="form-group">' +
          '<label>Ergebnis *</label>' +
          '<input type="text" id="ee-res" placeholder="z.B. 38:12 oder 7,42"/>' +
        '</div>' +
        '<div class="form-group">' +
          '<label>Altersklasse</label>' +
          '<input type="text" id="ee-ak" placeholder="z.B. M40"/>' +
        '</div>' +
        '<div class="form-group full">' +
          '<label>Verein <span style="font-size:11px;font-weight:400;color:var(--text2)">(anderer Verein = externes Ergebnis)</span></label>' +
          '<input type="text" id="ee-verein" list="ee-verein-list" value="' + clubName.replace(/"/g,'&quot;') + '"/>' +
          '<span id="ee-verein-list-wrap"></span>' +
        '</div>' +
        '<div class="form-group full" style="margin-top:2px">' +
          '<div style="font-size:12px;font-weight:600;color:var(--text2)">Optionale Angaben</div>' +
        '</div>' +
        '<div class="form-group">' +
          '<label>Startnummer</label>' +
          '<input type="text" id="ee-startnr" maxlength="20" placeholder="z.B. 758"/>' +
        '</div>' +
        '<div class="form-group">' +
          '<label>Pos (AK)</label>' +
          '<input type="number" min="1" id="ee-pos-ak" placeholder="z.B. 5"/>' +
        '</div>' +
        '<div class="form-group">' +
          '<label>Pos (m/w)</label>' +
          '<input type="number" min="1" id="ee-pos-mw" placeholder="z.B. 23"/>' +
        '</div>' +
        '<div class="form-group">' +
          '<label>Pos (gesamt)</label>' +
          '<input type="number" min="1" id="ee-pos-ges" placeholder="z.B. 25"/>' +
        '</div>' +
        '<div class="form-group full">' +
          '<label>Schuh</label>' +
          '<input type="text" id="ee-schuh" list="ee-schuh-list" maxlength="120" placeholder="z.B. Adidas Adios Pro 3"/>' +
          '<span id="ee-schuh-list-wrap"></span>' +
        '</div>' +
        '<div class="form-group full">' +
          '<label>Bemerkungen</label>' +
          '<input type="text" id="ee-bemerkungen" maxlength="500" placeholder="frei"/>' +
        '</div>' +
      '</div>' +

      (ergebnisPruefen ? '<div class="panel" style="background:color-mix(in srgb,var(--primary) 5%,transparent);border:none;padding:10px 14px;margin-bottom:16px;font-size:13px">' +
        '&#x23F3;&#xFE0E; Dein Ergebnis wird vor der Veröffentlichung von einem Editor oder Admin geprüft.' +
      '</div>' : '') +

      '<div id="ee-err" style="color:var(--accent);font-size:13px;min-height:18px;margin-bottom:8px"></div>' +
      '<div class="modal-actions" style="justify-content:flex-start;gap:8px">' +
        '<button class="btn btn-ghost" onclick="resetEigenesErgebnis()">&#x21BA; Reset</button>' +
        '<div style="flex:1"></div>' +
        '<button class="btn btn-ghost" onclick="saveEigenesErgebnis(true)">&#x1F4BE; Speichern &amp; Neues</button>' +
        '<button class="btn btn-primary" onclick="saveEigenesErgebnis(false)">&#x1F4BE; Speichern</button>' +
      '</div>' +
    '</div>' +
    _eeCsvPanelHtml()
  );
  _eeSelectedVeranst = null;
  _eeCsvRows = [];
  // Ortsauswahl aus den hinterlegten Orten befüllen
  (async function() {
    if (!window._bkOrte) await _bkLoadOrte();
    eeOrtSelectFuellen();
    // Bekannte eigene Schuhe/Vereine als Vorschlagsliste
    var w = await _eeLadeEigeneWerte();
    var sw = document.getElementById('ee-schuh-list-wrap');
    if (sw) sw.innerHTML = _eeDatalist('ee-schuh-list', w.schuhe);
    var vw = document.getElementById('ee-verein-list-wrap');
    if (vw) vw.innerHTML = _eeDatalist('ee-verein-list', w.vereine);
  })();
}

// Ort-Dropdown des Einzelformulars befüllen (nur hinterlegte Orte + Anlegen)
function eeOrtSelectFuellen(selectedId) {
  var sel = document.getElementById('ee-ort');
  if (!sel) return;
  var orte = window._bkOrte || [];
  var cur = selectedId !== undefined ? String(selectedId || '') : String(sel.value || '');
  sel.innerHTML = '<option value="">– Ort wählen –</option>' +
    orte.map(function(o) {
      return '<option value="' + o.id + '"' + (String(o.id) === cur ? ' selected' : '') + '>' + _owEsc(o.name) + '</option>';
    }).join('') +
    '<option value="__neu__">+ Neuen Ort anlegen…</option>';
}

function eeOrtChanged(sel) {
  if (sel.value !== '__neu__') return;
  sel.value = '';
  showModal(
    '<div class="modal-header"><div class="modal-title">&#x1F4CD; Neuer Ort</div></div>' +
    '<div class="form-group full" style="margin-bottom:16px">' +
      '<label>Name *</label>' +
      '<input type="text" id="ee-neuer-ort-name" placeholder="z.B. Bottrop" style="width:100%;padding:9px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text)"/>' +
    '</div>' +
    '<div class="modal-actions">' +
      '<button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button>' +
      '<button class="btn btn-primary" onclick="eeOrtAnlegenEinzel()">Anlegen &amp; ausw&auml;hlen</button>' +
    '</div>', false);
  setTimeout(function() { var el = document.getElementById('ee-neuer-ort-name'); if (el) el.focus(); }, 50);
}

async function eeOrtAnlegenEinzel() {
  var name = ((document.getElementById('ee-neuer-ort-name') || {}).value || '').trim();
  if (!name) { notify('Name erforderlich.', 'err'); return; }
  var r = await apiPost('orte', { name: name });
  if (!r || !r.ok) { notify((r && r.fehler) || 'Ort konnte nicht angelegt werden.', 'err'); return; }
  if (!window._bkOrte) window._bkOrte = [];
  window._bkOrte.push(r.data);
  window._bkOrte.sort(function(a, b) { return (a.name || '').localeCompare(b.name || ''); });
  closeModal();
  eeOrtSelectFuellen(r.data.id);
  notify('Ort „' + r.data.name + '" angelegt.', 'ok');
}

function resetEigenesErgebnis() {
  var clubName = (appConfig && appConfig.verein_name) ? appConfig.verein_name : '';
  var fields = ['ee-datum','ee-evname','ee-res','ee-ak',
                'ee-startnr','ee-pos-ak','ee-pos-mw','ee-pos-ges','ee-schuh','ee-bemerkungen'];
  fields.forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) return;
    if (id === 'ee-datum') el.value = new Date().toISOString().slice(0,10);
    else el.value = '';
  });
  var vereinEl = document.getElementById('ee-verein');
  if (vereinEl) vereinEl.value = clubName;
  eeOrtSelectFuellen('');
  var katEl = document.getElementById('ee-kat');
  if (katEl) { katEl.value = ''; _eeUpdateDisz(); }
  var searchEl = document.getElementById('ee-veranst-search');
  if (searchEl) searchEl.value = '';
  _eeSelectedVeranst = null;
  var errEl = document.getElementById('ee-err');
  if (errEl) errEl.textContent = '';
  if (_eeVeranstModus === 'neu') eeBkToggle('neu');
}

function _eeVeranstGetOrCreateDropdown() {
  var drop = document.getElementById('ee-veranst-dropdown');
  if (!drop) {
    drop = document.createElement('div');
    drop.id = 'ee-veranst-dropdown';
    drop.style.cssText = 'display:none;position:fixed;background:var(--surface);border:1px solid var(--border);border-radius:8px;z-index:9999;max-height:320px;overflow-y:auto;box-shadow:0 4px 16px rgba(0,0,0,.22)';
    document.body.appendChild(drop);
  }
  return drop;
}

function eeVeranstSearch(val) {
  clearTimeout(_eeVeranstSearchTimer);
  _eeVeranstSearchTimer = setTimeout(async function() {
    var inp = document.getElementById('ee-veranst-search');
    if (!inp) return;
    var drop = _eeVeranstGetOrCreateDropdown();
    var q = val.trim();
    if (_eeSelectedVeranst && inp.value !== _eeVeranstLabel(_eeSelectedVeranst)) _eeSelectedVeranst = null;
    var url = q ? 'veranstaltungen?limit=20&suche=' + encodeURIComponent(q) : 'veranstaltungen?limit=20';
    var r = await apiGet(url);
    _eeVeranstResults = (r && r.ok && r.data.veranst) ? r.data.veranst : [];
    if (!_eeVeranstResults.length) {
      drop.innerHTML = '<div style="padding:10px 12px;font-size:13px;color:var(--text2)">Keine Veranstaltung gefunden</div>';
    } else {
      drop.innerHTML = _eeVeranstResults.map(function(v, i) {
        var label = _eeVeranstLabel(v);
        return '<div style="padding:9px 12px;font-size:13px;cursor:pointer;border-bottom:1px solid var(--border)"' +
          ' onmousedown="eeVeranstSelect(' + i + ')"' +
          ' onmouseover="this.style.background=\'var(--surf2)\'" onmouseout="this.style.background=\'\'">' +
          label.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</div>';
      }).join('');
    }
    var rect = inp.getBoundingClientRect();
    drop.style.left  = rect.left + 'px';
    drop.style.top   = (rect.bottom + 2) + 'px';
    drop.style.width = rect.width + 'px';
    drop.style.display = '';
  }, 250);
}

function _eeVeranstLabel(v) {
  return (v.name || v.kuerzel) + ' (' + formatDate(v.datum) + (v.ort ? ', ' + v.ort : '') + ')';
}

function eeVeranstSelect(idx) {
  var v = _eeVeranstResults[idx];
  if (!v) return;
  _eeSelectedVeranst = v;
  var inp = document.getElementById('ee-veranst-search');
  if (inp) inp.value = _eeVeranstLabel(v);
  eeVeranstHideDropdown();
}

function eeVeranstHideDropdown() {
  var drop = document.getElementById('ee-veranst-dropdown');
  if (drop) drop.style.display = 'none';
}

var _eeVeranstModus = 'neu';
function eeBkToggle(modus) {
  _eeVeranstModus = modus;
  var nF = document.getElementById('ee-neu-form'), bF = document.getElementById('ee-best-form');
  var bN = document.getElementById('ee-toggle-neu'), bB = document.getElementById('ee-toggle-best');
  if (modus === 'best') {
    if (nF) nF.style.display = 'none'; if (bF) bF.style.display = '';
    if (bN) bN.className = 'btn btn-ghost btn-sm'; if (bB) bB.className = 'btn btn-primary btn-sm';
    var inp = document.getElementById('ee-veranst-search');
    if (inp && !inp.value) eeVeranstSearch('');
  } else {
    if (nF) nF.style.display = ''; if (bF) bF.style.display = 'none';
    if (bN) bN.className = 'btn btn-primary btn-sm'; if (bB) bB.className = 'btn btn-ghost btn-sm';
  }
}
function _eeUpdateDisz() {
  var katKey = document.getElementById('ee-kat') ? document.getElementById('ee-kat').value : '';
  var sel = document.getElementById('ee-disz');
  if (!sel) return;
  var disz = (state.disziplinen || []).filter(function(d) { return d.tbl_key === katKey; });
  sel.innerHTML = '<option value="">-- Disziplin wählen --</option>' +
    disz.map(function(d) { return '<option value="' + d.id + '" data-name="' + d.disziplin.replace(/"/g,'&quot;') + '">' + d.disziplin + '</option>'; }).join('');
}
async function _eeAutoAk() {
  var datVal = document.getElementById('ee-datum') ? document.getElementById('ee-datum').value : '';
  var akEl = document.getElementById('ee-ak');
  if (!datVal || !akEl || akEl.value) return;
  if (!currentUser || !currentUser.athlet_id) return;
  var r = await apiGet('athleten/' + currentUser.athlet_id);
  if (!r || !r.ok) return;
  var a = r.data.athlet;
  if (!a || !a.geburtsjahr || !a.geschlecht) return;
  var ak = calcDlvAK(a.geburtsjahr, a.geschlecht, parseInt(datVal.slice(0,4)));
  if (ak && !akEl.value) akEl.value = ak;
}
async function saveEigenesErgebnis(andNew) {
  var errEl = document.getElementById('ee-err');
  if (errEl) errEl.textContent = '';
  var clubName = (appConfig && appConfig.verein_name) ? appConfig.verein_name : '';
  var verein = (document.getElementById('ee-verein') ? document.getElementById('ee-verein').value.trim() : '');
  var diszEl = document.getElementById('ee-disz');
  var diszOpt = diszEl ? diszEl.options[diszEl.selectedIndex] : null;
  var diszName = diszOpt && diszOpt.value ? diszOpt.getAttribute('data-name') : '';
  var diszMappingId = diszOpt && diszOpt.value ? parseInt(diszOpt.value) : null;
  var res = document.getElementById('ee-res') ? document.getElementById('ee-res').value.trim() : '';
  var ak = document.getElementById('ee-ak') ? document.getElementById('ee-ak').value.trim() : '';

  if (!diszMappingId || !res) {
    if (errEl) errEl.textContent = 'Bitte Disziplin und Ergebnis ausfüllen.';
    return;
  }

  var datum = '', ort = '', evname = '', veranstId = null;
  if (_eeVeranstModus === 'best') {
    veranstId = _eeSelectedVeranst ? _eeSelectedVeranst.id : null;
    if (!veranstId) { if (errEl) errEl.textContent = 'Bitte Veranstaltung auswählen.'; return; }
  } else {
    datum = document.getElementById('ee-datum') ? document.getElementById('ee-datum').value : '';
    var _ortSel = document.getElementById('ee-ort');
    var _ortId  = _ortSel && _ortSel.value && _ortSel.value !== '__neu__' ? parseInt(_ortSel.value, 10) : null;
    var _ortObj = _ortId ? (window._bkOrte || []).find(function(o) { return o.id === _ortId; }) : null;
    ort = _ortObj ? _ortObj.name : '';
    evname = document.getElementById('ee-evname') ? document.getElementById('ee-evname').value.trim() : '';
    if (!datum || !ort) { if (errEl) errEl.textContent = 'Datum und Ort sind Pflichtfelder – bitte einen hinterlegten Ort wählen.'; return; }
  }

  // Anderer Verein → externes Ergebnis
  var isExternal = verein && verein.toLowerCase() !== clubName.toLowerCase();
  var _v = function(id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; };
  var _n = function(id) { var s = _v(id); return s ? (parseInt(s, 10) || null) : null; };
  var body = {
    disziplin: diszName, disziplin_mapping_id: diszMappingId,
    resultat: res, altersklasse: ak || null,
    startnummer: _v('ee-startnr') || null,
    ak_platzierung: _n('ee-pos-ak'),
    pos_geschlecht: _n('ee-pos-mw'),
    pos_gesamt: _n('ee-pos-ges'),
    schuh: _v('ee-schuh') || null,
    bemerkungen: _v('ee-bemerkungen') || null,
  };
  if (isExternal) { body.externer_verein = verein; body.verein = verein; }
  if (veranstId) body.veranstaltung_id = veranstId;
  else { body.datum = datum; body.ort = ort; body.ort_id = (typeof _ortId !== 'undefined' ? _ortId : null); body.veranstaltung_name = evname; }

  var r = await apiPost('ergebnisse/eigenes', body);
  // Dublette → Nachfragen (zusammenführen / trotzdem anlegen / abbrechen)
  if (r && r.ok && r.data && r.data.status === 'dublette') {
    var aktion = await eeDublettenDialog(r.data, body);
    if (!aktion) { if (errEl) errEl.textContent = 'Abgebrochen – nichts gespeichert.'; return; }
    body.aktion = aktion;
    r = await apiPost('ergebnisse/eigenes', body);
  }
  if (r && r.ok) {
    var st = (r.data && r.data.status) || '';
    var msg = st === 'gemergt' ? ('Vorhandenes Ergebnis ergänzt. ' + ((r.data && r.data.msg) || ''))
            : (r.data && r.data.pending) ? 'Ergebnis eingereicht – wird geprüft.' : 'Gespeichert.';
    notify(msg, 'ok');
    if (andNew) {
      resetEigenesErgebnis();
    } else {
      state.subTab = null; renderEintragen();
    }
  } else if (errEl) {
    errEl.textContent = (r && r.fehler) ? r.fehler : 'Fehler beim Speichern.';
  }
}

// Dialog bei erkanntem Duplikat – liefert 'merge' | 'insert' | null (Abbruch)
// ── Vergleich gespeichertes ↔ zu importierendes Ergebnis ────────────────────
function _eeDecode(v) {
  if (v === null || v === undefined) return '';
  var t = document.createElement('textarea');
  t.innerHTML = String(v);
  return t.value.trim();
}

// Zeiten vergleichbar machen: "00:40:58" und "40:58" sind dasselbe Ergebnis
function _eeWertNorm(v) {
  var s = _eeDecode(v).toLowerCase().replace(',', '.');
  var m = s.match(/^(\d+):(\d{2}):(\d{2}(?:\.\d+)?)$/);
  if (m) return String(parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60 + parseFloat(m[3]));
  m = s.match(/^(\d+):(\d{2}(?:\.\d+)?)$/);
  if (m) return String(parseInt(m[1], 10) * 60 + parseFloat(m[2]));
  return s;
}

// Liefert [{label, alt, neu, art}] – art: 'konflikt' | 'ergaenzung' | 'gleich'
function _eeVergleich(dup, neu) {
  var felder = [
    ['Ergebnis',     dup.resultat,               neu.resultat],
    ['Altersklasse', dup.altersklasse,           neu.altersklasse],
    ['Startnummer',  dup.startnummer,            neu.startnummer],
    ['Pos (AK)',     dup.ak_platzierung,         neu.ak_platzierung],
    ['Pos (m/w)',    dup.pos_geschlecht,         neu.pos_geschlecht],
    ['Pos (gesamt)', dup.pos_gesamt,             neu.pos_gesamt],
    ['Schuh',        dup.schuh,                  neu.schuh],
    ['Bemerkungen',  dup.bemerkungen,            neu.bemerkungen],
    ['Verein',       dup.verein,                 neu.verein],
    ['Meisterschaft', dup.meisterschaft ? mstrLabel(dup.meisterschaft) : '', neu.meisterschaft ? mstrLabel(neu.meisterschaft) : ''],
    ['Platz MS',     dup.ak_platz_meisterschaft, neu.ak_platz_meisterschaft],
  ];
  var out = [];
  felder.forEach(function(f) {
    var alt = _eeDecode(f[1]), nv = _eeDecode(f[2]);
    if (!alt && !nv) return;
    var art = (!alt && nv) ? 'ergaenzung'
            : (alt && nv && _eeWertNorm(alt) !== _eeWertNorm(nv)) ? 'konflikt'
            : 'gleich';
    out.push({ label: f[0], alt: alt, neu: nv, art: art });
  });
  return out;
}

function _eeVergleichZaehler(dup, neu) {
  var v = _eeVergleich(dup, neu);
  return {
    konflikte:   v.filter(function(x) { return x.art === 'konflikt'; }).length,
    ergaenzungen:v.filter(function(x) { return x.art === 'ergaenzung'; }).length,
    liste: v,
  };
}

function _eeVergleichTabelle(dup, neu) {
  var v = _eeVergleich(dup, neu);
  if (!v.length) return '';
  var zeilen = v.map(function(x) {
    var farbe = x.art === 'konflikt'   ? 'var(--accent)'
              : x.art === 'ergaenzung' ? 'var(--primary)' : 'var(--text2)';
    var hinweis = x.art === 'konflikt'   ? '&#x26A0;&#xFE0F; bleibt gespeichert'
                : x.art === 'ergaenzung' ? '&#x2795; wird ergänzt' : 'identisch';
    return '<tr style="border-bottom:1px solid var(--border)' + (x.art === 'konflikt' ? ';background:color-mix(in srgb,var(--accent) 8%,transparent)' : '') + '">' +
      '<td style="padding:5px 8px;color:var(--text2);font-size:12px;white-space:nowrap">' + _owEsc(x.label) + '</td>' +
      '<td style="padding:5px 8px;font-size:13px">' + (x.alt ? _owEsc(x.alt) : '<span style="color:var(--text2)">– leer –</span>') + '</td>' +
      '<td style="padding:5px 8px;font-size:13px' + (x.art === 'konflikt' ? ';font-weight:600;color:var(--accent)' : '') + '">' +
        (x.neu ? _owEsc(x.neu) : '<span style="color:var(--text2)">– leer –</span>') + '</td>' +
      '<td style="padding:5px 8px;font-size:11px;color:' + farbe + ';white-space:nowrap">' + hinweis + '</td>' +
    '</tr>';
  }).join('');
  return '<table style="width:100%;border-collapse:collapse;margin-bottom:14px">' +
      '<tr style="border-bottom:1px solid var(--border)">' +
        '<th style="text-align:left;padding:5px 8px;font-size:11px;color:var(--text2)">Feld</th>' +
        '<th style="text-align:left;padding:5px 8px;font-size:11px;color:var(--text2)">Gespeichert</th>' +
        '<th style="text-align:left;padding:5px 8px;font-size:11px;color:var(--text2)">Import</th>' +
        '<th style="text-align:left;padding:5px 8px;font-size:11px;color:var(--text2)">Beim Zusammenführen</th>' +
      '</tr>' + zeilen +
    '</table>';
}

function eeDublettenDialog(data, neu) {
  return new Promise(function(resolve) {
    var d = data.dublette;
    var rowsHtml = d ? _eeVergleichTabelle(d, neu) : '';
    var z = d ? _eeVergleichZaehler(d, neu) : { konflikte: 0, ergaenzungen: 0 };
    var kopf = d
      ? 'Für <strong>' + _owEsc((d.veranstaltung || '') + (d.datum ? ' (' + formatDate(d.datum) + ')' : '')) + '</strong> ist bereits ein Ergebnis in <strong>' + _owEsc(d.disziplin || '') + '</strong> gespeichert.' +
        (z.konflikte ? ' <span style="color:var(--accent);font-weight:600">' + z.konflikte + ' abweichende(s) Feld(er).</span>' : '') +
        (z.ergaenzungen ? ' <span style="color:var(--primary)">' + z.ergaenzungen + ' Feld(er) können ergänzt werden.</span>' : '')
      : 'Für diese Veranstaltung und Disziplin liegt bereits ein noch nicht geprüfter Antrag vor.';
    window._eeDupResolve = function(val) {
      window._eeDupResolve = null;
      closeModal();
      resolve(val);
    };
    showModal(
      '<div class="modal-header"><div class="modal-title">&#x26A0;&#xFE0F; Ergebnis bereits vorhanden</div></div>' +
      '<div style="font-size:13px;margin-bottom:12px">' + kopf + '</div>' +
      rowsHtml +
      '<div style="font-size:12px;color:var(--text2);margin-bottom:14px">Beim Zusammenführen werden nur bisher <em>leere</em> Felder ergänzt – vorhandene Werte bleiben unverändert.</div>' +
      '<div class="modal-actions" style="gap:8px">' +
        '<button class="btn btn-ghost" onclick="_eeDupResolve(null)">Abbrechen</button>' +
        '<div style="flex:1"></div>' +
        (d ? '<button class="btn btn-ghost" onclick="_eeDupResolve(\'insert\')">Trotzdem neu anlegen</button>' : '') +
        (d ? '<button class="btn btn-primary" onclick="_eeDupResolve(\'merge\')">&#x1F517; Zusammenf&uuml;hren</button>'
           : '<button class="btn btn-primary" onclick="_eeDupResolve(\'insert\')">Trotzdem einreichen</button>') +
      '</div>', true);
  });
}

// ── CSV-Bulk-Import für eigene Ergebnisse ────────────────────────────────────
var _eeCsvRows = [];      // gemappte Zeilen inkl. Prüfergebnis
var _eeCsvGeprueft = false;

function _eeCsvPanelHtml() {
  return '<div class="panel" style="padding:24px;margin-top:20px">' +
    '<div class="panel-title" style="margin-bottom:4px">&#x1F4C4; CSV-Import (mehrere eigene Ergebnisse)</div>' +
    '<div style="color:var(--text2);font-size:13px;margin-bottom:14px">' +
      'CSV-Datei mit den Spalten <code>Datum, Wettkampf, Wettbewerb, Startnummer, AK, Pos (AK), Pos (m/w), Pos, Endzeit, Schuh, Verein / Team, Bemerkungen, Sonderwertung, Pos (Sonderwertung)</code> hochladen. ' +
      'Alle Zeilen werden deinem eigenen Athletenprofil zugeordnet.' +
    '</div>' +
    '<div id="ee-csv-drop" ondragover="eeCsvDragOver(event)" ondragleave="eeCsvDragLeave(event)" ondrop="eeCsvDrop(event)"' +
      ' style="border:2px dashed var(--border);border-radius:10px;padding:18px;text-align:center;color:var(--text2);font-size:13px;margin-bottom:12px">' +
      'CSV-Datei hierher ziehen oder ' +
      '<label style="color:var(--primary);cursor:pointer;text-decoration:underline">ausw&auml;hlen' +
        '<input type="file" accept=".csv,text/csv" style="display:none" onchange="eeCsvFileChosen(this)">' +
      '</label>' +
    '</div>' +
    '<div id="ee-csv-status" style="font-size:13px;color:var(--text2);min-height:18px;margin-bottom:8px"></div>' +
    '<div id="ee-csv-preview"></div>' +
  '</div>';
}

function eeCsvDragOver(e) { e.preventDefault(); var d = document.getElementById('ee-csv-drop'); if (d) d.style.borderColor = 'var(--primary)'; }
function eeCsvDragLeave(e) { e.preventDefault(); var d = document.getElementById('ee-csv-drop'); if (d) d.style.borderColor = 'var(--border)'; }
function eeCsvDrop(e) {
  e.preventDefault(); eeCsvDragLeave(e);
  var f = e.dataTransfer && e.dataTransfer.files ? e.dataTransfer.files[0] : null;
  if (f) _eeCsvReadFile(f);
}
function eeCsvFileChosen(inp) { if (inp.files && inp.files[0]) _eeCsvReadFile(inp.files[0]); }

function _eeCsvReadFile(file) {
  var statusEl = document.getElementById('ee-csv-status');
  if (!/\.csv$/i.test(file.name) && file.type !== 'text/csv') {
    if (statusEl) statusEl.textContent = '❌ Bitte eine CSV-Datei wählen.';
    return;
  }
  var reader = new FileReader();
  reader.onload = function() {
    var txt = String(reader.result || '');
    if (txt.charCodeAt(0) === 0xFEFF) txt = txt.slice(1); // BOM
    _eeCsvVerarbeiten(txt, file.name);
  };
  reader.onerror = function() { if (statusEl) statusEl.textContent = '❌ Datei konnte nicht gelesen werden.'; };
  reader.readAsText(file, 'utf-8');
}

// CSV in Zellen zerlegen (RFC4180: Anführungszeichen, eingebettete Zeilenumbrüche, "" als Escape)
function _eeCsvSplit(text, sep) {
  var rows = [], row = [], cell = '', inQ = false;
  for (var i = 0; i < text.length; i++) {
    var c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i+1] === '"') { cell += '"'; i++; } else inQ = false; }
      else cell += c;
      continue;
    }
    if (c === '"') { inQ = true; continue; }
    if (c === sep) { row.push(cell); cell = ''; continue; }
    if (c === '\r') continue;
    if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; continue; }
    cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(function(r) { return r.some(function(c) { return String(c).trim() !== ''; }); });
}

var _EE_MONATE = { 'januar':1,'februar':2,'märz':3,'maerz':3,'april':4,'mai':5,'juni':6,'juli':7,
                   'august':8,'september':9,'oktober':10,'november':11,'dezember':12 };

function _eeCsvDatum(raw) {
  var s = String(raw || '').trim();
  if (!s) return '';
  var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[1] + '-' + m[2] + '-' + m[3];
  m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (m) { var y = parseInt(m[3], 10); if (y < 100) y += 2000; return y + '-' + m[2].padStart(2,'0') + '-' + m[1].padStart(2,'0'); }
  // "4. Januar 2026"
  m = s.match(/^(\d{1,2})\.?\s+([A-Za-zäöüÄÖÜ]+)\s+(\d{4})$/);
  if (m) {
    var mon = _EE_MONATE[m[2].toLowerCase()];
    if (mon) return m[3] + '-' + String(mon).padStart(2,'0') + '-' + m[1].padStart(2,'0');
  }
  return '';
}

// Disziplin aus der CSV-Spalte "Wettbewerb" auf ein Disziplin-Mapping abbilden
function _eeCsvDisz(raw) {
  var s = String(raw || '').trim();
  if (!s) return null;
  var norm = function(x) { return String(x || '').toLowerCase().replace(/\s|\.|-/g, '').replace(/straße|strasse/g, '').replace(/,/g, '.'); };
  var ziel = norm(s);
  var disz = state.disziplinen || [];
  var treffer = disz.find(function(d) { return norm(d.disziplin) === ziel; });
  if (!treffer) treffer = disz.find(function(d) { var n = norm(d.disziplin); return n && (n === ziel.replace(/bahn/g, '') || ziel === n.replace(/bahn/g, '')); });
  if (!treffer) treffer = disz.find(function(d) { var n = norm(d.disziplin); return n.length > 2 && (ziel.indexOf(n) >= 0 || n.indexOf(ziel) >= 0); });
  return treffer || null;
}

function _eeCsvMstr(raw) {
  var s = String(raw || '').trim().toLowerCase();
  if (!s) return null;
  for (var i = 0; i < (MSTR_LIST || []).length; i++) {
    var lbl = String(MSTR_LIST[i].label || '').toLowerCase();
    if (lbl === s || (lbl && (lbl.indexOf(s) >= 0 || s.indexOf(lbl) >= 0))) return parseInt(MSTR_LIST[i].id, 10) || null;
  }
  return null;
}

function _eeCsvInt(raw) {
  var s = String(raw || '').trim().replace(/\.$/, '');
  if (!/^\d+$/.test(s)) return null;
  var n = parseInt(s, 10);
  return n > 0 ? n : null;
}

async function _eeCsvVerarbeiten(text, dateiname) {
  var statusEl = document.getElementById('ee-csv-status');
  // Ortsliste wird für die Zuordnung benötigt
  if (!window._bkOrte) await _bkLoadOrte();
  var erste = text.split('\n')[0] || '';
  var sep = (erste.split(';').length > erste.split(',').length) ? ';' : ',';
  var raw = _eeCsvSplit(text, sep);
  if (raw.length < 2) { if (statusEl) statusEl.textContent = '❌ Keine Datenzeilen gefunden.'; return; }

  var head = raw[0].map(function(h) { return String(h || '').trim().toLowerCase(); });
  function col(names) {
    for (var i = 0; i < names.length; i++) { var idx = head.indexOf(names[i]); if (idx >= 0) return idx; }
    return -1;
  }
  var iDatum  = col(['datum','date']);
  var iWk     = col(['wettkampf','veranstaltung','event']);
  var iWb     = col(['wettbewerb','disziplin','strecke']);
  var iSnr    = col(['startnummer','startnr','stnr','bib']);
  var iAk     = col(['ak','altersklasse']);
  var iPosAk  = col(['pos (ak)','pos ak','platz (ak)','ak-platz']);
  var iPosMw  = col(['pos (m/w)','pos m/w','pos (mw)','geschlechtsplatz']);
  var iPosGes = col(['pos','pos (gesamt)','gesamtplatz','platz']);
  var iZeit   = col(['endzeit','ergebnis','zeit','resultat','leistung']);
  var iSchuh  = col(['schuh','schuhe']);
  var iVerein = col(['verein / team','verein/team','verein','team']);
  var iBem    = col(['bemerkungen','bemerkung','notiz']);
  var iSw     = col(['sonderwertung','meisterschaft']);
  var iSwPos  = col(['pos (sonderwertung)','pos sonderwertung','platz (sonderwertung)']);
  var iOrt    = col(['ort','stadt']);

  if (iDatum < 0 || iZeit < 0) {
    if (statusEl) statusEl.textContent = '❌ Spalten „Datum" und „Endzeit" werden benötigt. Gefunden: ' + head.join(', ');
    return;
  }

  var zeilen = [];
  for (var r = 1; r < raw.length; r++) {
    var c = raw[r];
    var get = function(idx) { return idx >= 0 && idx < c.length ? String(c[idx] || '').trim() : ''; };
    var datum = _eeCsvDatum(get(iDatum));
    var zeit  = get(iZeit);
    if (!datum && !zeit) continue;
    var diszObj = _eeCsvDisz(get(iWb)) || _eeMerkDisz(get(iWb));
    var evname  = get(iWk);
    var ortRaw  = get(iOrt);
    var ortId   = null;
    // Nur hinterlegte Orte zulassen: Name/Alias in der Orte-Liste suchen
    var ortTreffer = ortRaw ? _bkOrtFindByNameOrAlias(ortRaw) : null;
    // Ort aus dem Veranstaltungsnamen erraten (Orte-Liste inkl. Aliase)
    if (!ortTreffer && evname) {
      var teile = evname.split(/[\s\-–]+/);
      for (var t = teile.length - 1; t >= 0 && !ortTreffer; t--) {
        ortTreffer = _bkOrtFindByNameOrAlias(teile[t]);
      }
    }
    // Zuletzt für diesen Wettkampf gewählter Ort
    if (!ortTreffer && evname) ortTreffer = _eeMerkOrt(evname);
    if (ortTreffer) { ortRaw = ortTreffer.name; ortId = ortTreffer.id; }
    else ortRaw = '';
    // Leere Vereinsangabe bleibt leer (kein Vorbelegen mit dem eigenen Verein)
    var verein = get(iVerein);
    zeilen.push({
      datum: datum,
      veranstaltung_name: evname,
      ort: ortRaw,
      ort_id: ortId,
      wettbewerb: get(iWb),
      disziplin: diszObj ? diszObj.disziplin : '',
      disziplin_mapping_id: diszObj ? (diszObj.id || diszObj.mapping_id) : null,
      resultat: dbRes(zeit),
      altersklasse: get(iAk),
      startnummer: get(iSnr),
      ak_platzierung: _eeCsvInt(get(iPosAk)),
      pos_geschlecht: _eeCsvInt(get(iPosMw)),
      pos_gesamt: _eeCsvInt(get(iPosGes)),
      schuh: get(iSchuh),
      bemerkungen: get(iBem),
      verein: verein,
      meisterschaft: _eeCsvMstr(get(iSw)),
      ak_platz_meisterschaft: _eeCsvInt(get(iSwPos)),
      _aktion: 'insert',
      _check: null,
      _zeile: r + 1,
    });
  }
  _eeCsvRows = zeilen;
  _eeCsvGeprueft = false;
  if (statusEl) statusEl.textContent = '⏳ ' + zeilen.length + ' Zeilen aus „' + dateiname + '" gelesen – prüfe auf Duplikate…';
  await eeCsvPruefen();
}

// Phase 1: Veranstaltungs-Zuordnung + Dubletten-Abgleich beim Server anfragen
async function eeCsvPruefen() {
  var statusEl = document.getElementById('ee-csv-status');
  if (!_eeCsvRows.length) return;
  var items = _eeCsvRows.map(_eeCsvItem);
  var r = await apiPost('ergebnisse/eigenes-bulk', { pruefen: true, items: items });
  if (!r || !r.ok) {
    if (statusEl) statusEl.textContent = '❌ ' + ((r && r.fehler) || 'Prüfung fehlgeschlagen.');
    return;
  }
  (r.data.rows || []).forEach(function(chk) {
    var row = _eeCsvRows[chk.idx];
    if (!row) return;
    row._check = chk;
    if (chk.veranstaltung_id && !row._veranstGetrennt) {
      row.veranstaltung_id = chk.veranstaltung_id;
      row._veranstTreffer  = chk.veranstaltung_name || '';
      row._veranstTrefferArt = chk.treffer || '';
      if (!row.ort && chk.veranstaltung_ort) row.ort = chk.veranstaltung_ort;
    } else {
      row.veranstaltung_id = null;
      row._veranstTreffer  = '';
      row._veranstTrefferArt = '';
    }
    // Ortsvorschlag aus früheren Austragungen desselben Wettkampfs
    if (!row.ort_id && chk.ort_vorschlag) {
      row.ort_id = chk.ort_vorschlag.ort_id;
      row.ort    = chk.ort_vorschlag.ort;
      row._ortVorschlag = chk.ort_vorschlag.quelle || '';
    }
    // Disziplinvorschlag: was der Athlet dort bisher gelaufen ist
    if (!row.disziplin_mapping_id && chk.disziplin_vorschlag) {
      row.disziplin_mapping_id = chk.disziplin_vorschlag.disziplin_mapping_id;
      row.disziplin            = chk.disziplin_vorschlag.disziplin;
      row._diszVorschlag       = (chk.disziplin_vorschlag.kategorie || '') +
        (chk.disziplin_vorschlag.anzahl ? ' · ' + chk.disziplin_vorschlag.anzahl + '× dort gelaufen' : '');
    }
    // Standardaktion: Duplikate zusammenführen statt doppelt anzulegen –
    // eine vom Benutzer gewählte Aktion bleibt bei erneuter Prüfung erhalten
    if (!row._aktionManuell) {
      row._aktion = (chk.dublette || chk.antrag) ? 'merge' : 'insert';
      if (chk.antrag && !chk.dublette) row._aktion = 'skip';
      // Duplikat ohne vollständige Zeile: nichts tun (Merge bräuchte eine Disziplin)
      if (chk.dublette && _eeCsvProblem(row)) row._aktion = 'skip';
    }
  });
  _eeCsvGeprueft = true;
  _eeCsvRenderPreview();
}

function _eeCsvItem(row) {
  var it = {
    datum: row.datum,
    veranstaltung_name: row.veranstaltung_name,
    ort: row.ort,
    disziplin: row.disziplin,
    disziplin_mapping_id: row.disziplin_mapping_id,
    resultat: row.resultat,
    altersklasse: row.altersklasse,
    startnummer: row.startnummer,
    ak_platzierung: row.ak_platzierung,
    pos_geschlecht: row.pos_geschlecht,
    pos_gesamt: row.pos_gesamt,
    schuh: row.schuh,
    bemerkungen: row.bemerkungen,
    verein: row.verein,
    meisterschaft: row.meisterschaft,
    ak_platz_meisterschaft: row.ak_platz_meisterschaft,
  };
  if (row.ort_id) it.ort_id = row.ort_id;
  if (row.veranstaltung_id) it.veranstaltung_id = row.veranstaltung_id;
  // Zuordnung wurde bewusst gelöst → eigene Veranstaltung anlegen
  if (row._veranstGetrennt && !row.veranstaltung_id) it.neue_veranstaltung = 1;
  return it;
}

// ── Gemerkte Zuordnungen: einmal gewählte Disziplin/Ort je CSV-Bezeichnung ──
// So landen bereits zugeordnete Wettbewerbe („Firmenlauf") beim erneuten Einlesen
// derselben Datei nicht wieder unter „Unvollständig".
var _EE_MERK_DISZ = 'ee_csv_disz_map';
var _EE_MERK_ORT  = 'ee_csv_ort_map';

function _eeMerkKey(text) { return String(text || '').trim().toLowerCase(); }

function _eeMerkLesen(key) {
  try { return JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch (e) { return {}; }
}
function _eeMerkSchreiben(key, text, wert) {
  if (!_eeMerkKey(text) || !wert) return;
  try {
    var m = _eeMerkLesen(key);
    m[_eeMerkKey(text)] = wert;
    localStorage.setItem(key, JSON.stringify(m));
  } catch (e) {}
}

// Gemerkte Disziplin – nur zurückgeben, wenn das Mapping noch existiert
function _eeMerkDisz(text) {
  var mid = _eeMerkLesen(_EE_MERK_DISZ)[_eeMerkKey(text)];
  if (!mid) return null;
  return (state.disziplinen || []).find(function(d) { return String(d.id || d.mapping_id) === String(mid); }) || null;
}
// Gemerkter Ort – nur zurückgeben, wenn der Ort noch existiert
function _eeMerkOrt(text) {
  var oid = _eeMerkLesen(_EE_MERK_ORT)[_eeMerkKey(text)];
  if (!oid) return null;
  return (window._bkOrte || []).find(function(o) { return String(o.id) === String(oid); }) || null;
}

// Ortsauswahl: ausschließlich im System hinterlegte Orte + Anlegen-Option
function _eeCsvOrtOptions(row) {
  var orte = window._bkOrte || [];
  var opts = '<option value="">– Ort wählen –</option>';
  var gewaehlt = row.ort_id ? String(row.ort_id) : '';
  // Ort aus dem Namen auflösen, falls nur ein Name aus der CSV bekannt ist
  if (!gewaehlt && row.ort) {
    var t = _bkOrtFindByNameOrAlias(row.ort);
    if (t) { row.ort_id = t.id; row.ort = t.name; gewaehlt = String(t.id); }
  }
  for (var i = 0; i < orte.length; i++) {
    opts += '<option value="' + orte[i].id + '"' + (String(orte[i].id) === gewaehlt ? ' selected' : '') + '>' +
      _owEsc(orte[i].name) + '</option>';
  }
  opts += '<option value="__neu__">+ Neuen Ort anlegen…</option>';
  return opts;
}

function _eeCsvDiszOptions(row) {
  var disz = (state.disziplinen || []).slice();
  // Nach Kategorie gruppieren, innerhalb der Kategorie nach Distanz/Wert sortieren
  var gruppen = [], nach = {};
  disz.forEach(function(d) {
    var kat = d.kategorie || 'Sonstige';
    if (!nach[kat]) { nach[kat] = []; gruppen.push(kat); }
    nach[kat].push(d);
  });
  var mid = row.disziplin_mapping_id;
  var opts = '<option value="">– Disziplin wählen –</option>';
  gruppen.forEach(function(kat) {
    var liste = nach[kat].slice().sort(function(a, b) {
      var da = _eeDiszWert(a), db = _eeDiszWert(b);
      if (da !== db) return da - db;
      return String(a.disziplin || '').localeCompare(String(b.disziplin || ''));
    });
    opts += '<optgroup label="' + _owEsc(kat) + '">' +
      liste.map(function(d) {
        var v = d.id || d.mapping_id;
        return '<option value="' + v + '"' + (String(v) === String(mid) ? ' selected' : '') + '>' + _owEsc(d.disziplin) + '</option>';
      }).join('') +
    '</optgroup>';
  });
  return opts;
}

// Sortierwert einer Disziplin: hinterlegte Distanz, sonst aus dem Namen gelesen
function _eeDiszWert(d) {
  if (d.distanz && parseFloat(d.distanz) > 0) return parseFloat(d.distanz);
  var n = String(d.disziplin || '').toLowerCase().replace(/\./g, '').replace(',', '.');
  var m = n.match(/^([\d.]+)\s*km/);
  if (m) return parseFloat(m[1]) * 1000;
  m = n.match(/^([\d.]+)\s*m\b/);
  if (m) return parseFloat(m[1]);
  if (n.indexOf('halbmarathon') >= 0) return 21097;
  if (n.indexOf('marathon') >= 0) return 42195;
  return 9e6; // Namen ohne Distanz ans Ende
}

// Fehlende Pflichtangaben einer Zeile (leerer String = vollständig)
function _eeCsvProblem(row) {
  return !row.datum ? 'Datum unlesbar'
       : !row.disziplin_mapping_id ? 'Disziplin fehlt'
       : !row.resultat ? 'Ergebnis fehlt'
       : (!row.veranstaltung_id && !row.ort) ? 'Ort fehlt'
       : '';
}

// Gruppe einer Zeile: 'importiert' | 'konflikt' | 'duplikat' | 'unvollstaendig' | 'neu'
// Bereits gespeicherte Ergebnisse gelten als Duplikat – auch wenn Disziplin oder Ort
// in der CSV-Zeile fehlen. Sonst landeten schon importierte Zeilen wieder in „Unvollständig".
function _eeCsvGruppe(row) {
  if (row._importiert) return 'importiert';
  var chk = row._check || {};
  if (chk.dublette) return _eeVergleichZaehler(chk.dublette, row).konflikte ? 'konflikt' : 'duplikat';
  if (chk.antrag) return 'duplikat';
  if (_eeCsvProblem(row)) return 'unvollstaendig';
  return 'neu';
}

function _eeCsvRenderPreview() {
  var wrap = document.getElementById('ee-csv-preview');
  var statusEl = document.getElementById('ee-csv-status');
  if (!wrap) return;
  var fld = 'box-sizing:border-box;height:30px;padding:4px 7px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:12px;width:100%';
  var dubletten = 0, fehlend = 0, aktiv = 0, konflikte = 0;
  var gruppen = { neu: [], konflikt: [], duplikat: [], unvollstaendig: [], importiert: [] };

  var zeilenHtml = _eeCsvRows.map(function(row, i) {
    var chk = row._check || {};
    var problem = _eeCsvProblem(row);
    var gruppe = _eeCsvGruppe(row);
    if (!row._importiert) {
      if (gruppe === 'unvollstaendig') fehlend++;
      if (chk.dublette || chk.antrag) dubletten++;
      if (!problem && row._aktion !== 'skip') aktiv++;
    }
    gruppen[gruppe].push(i);

    var statusHtml;
    if (row._importiert) {
      statusHtml = '<span style="color:var(--primary);font-size:12px">&#x2713; ' + _owEsc(row._importMsg || 'importiert') + '</span>';
    } else if (chk.dublette && problem) {
      // Bereits gespeichert, aber die CSV-Zeile ist unvollständig → nichts zu tun
      statusHtml = '<div style="font-size:12px;color:var(--text2)">&#x2713; bereits gespeichert' +
          (chk.dublette_art === 'datum_ergebnis' ? ' <span style="font-size:11px">(über Datum + Ergebnis erkannt)</span>' : '') +
        '</div>' +
        '<div style="font-size:11px;color:var(--text2)">' + _owEsc(problem) + ' – für ein Zusammenführen per ✏️ ergänzen</div>';
    } else if (problem) {
      statusHtml = '<span style="color:var(--accent);font-size:12px">⚠︎ ' + _owEsc(problem) + '</span>';
    } else if (chk.dublette) {
      var z = _eeVergleichZaehler(chk.dublette, row);
      konflikte += z.konflikte;
      var badges = '';
      if (z.konflikte) badges += '<span style="display:inline-block;background:color-mix(in srgb,var(--accent) 18%,transparent);color:var(--accent);border-radius:9px;padding:1px 7px;font-size:11px;font-weight:600;margin-right:4px">' + z.konflikte + ' Konflikt' + (z.konflikte !== 1 ? 'e' : '') + '</span>';
      if (z.ergaenzungen) badges += '<span style="display:inline-block;background:color-mix(in srgb,var(--primary) 16%,transparent);color:var(--primary);border-radius:9px;padding:1px 7px;font-size:11px;font-weight:600;margin-right:4px">+' + z.ergaenzungen + '</span>';
      if (!z.konflikte && !z.ergaenzungen) badges += '<span style="font-size:11px;color:var(--text2)">identisch</span>';
      // Abweichende Felder direkt im Klartext zeigen (max. 2, Rest im Detail-Dialog)
      var kListe = z.liste.filter(function(x) { return x.art === 'konflikt'; }).slice(0, 2).map(function(x) {
        return '<div style="font-size:11px;color:var(--accent);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px">' +
          _owEsc(x.label) + ': ' + _owEsc(x.alt) + ' &rarr; ' + _owEsc(x.neu) + '</div>';
      }).join('');
      statusHtml = '<div style="margin-bottom:3px">' + badges +
          '<a href="#" onclick="eeCsvZeileModal(' + i + ');return false;" style="font-size:11px;color:var(--text2);text-decoration:underline">Details</a>' +
        '</div>' + kListe +
        '<select onchange="eeCsvSetAktion(' + i + ',this.value)" style="' + fld + ';margin-top:3px">' +
          '<option value="merge"' + (row._aktion === 'merge' ? ' selected' : '') + '>Zusammenführen (leere Felder)</option>' +
          '<option value="skip"' + (row._aktion === 'skip' ? ' selected' : '') + '>Überspringen</option>' +
          '<option value="insert"' + (row._aktion === 'insert' ? ' selected' : '') + '>Trotzdem anlegen</option>' +
        '</select>';
    } else if (chk.antrag) {
      statusHtml = '<div style="font-size:11px;color:var(--text2);margin-bottom:3px">Antrag offen</div>' +
        '<select onchange="eeCsvSetAktion(' + i + ',this.value)" style="' + fld + '">' +
          '<option value="skip"' + (row._aktion === 'skip' ? ' selected' : '') + '>Überspringen</option>' +
          '<option value="insert"' + (row._aktion === 'insert' ? ' selected' : '') + '>Trotzdem einreichen</option>' +
        '</select>';
    } else if (row.veranstaltung_id) {
      statusHtml = '<span style="color:var(--text2);font-size:12px">✓ bestehende Veranstaltung</span>';
    } else {
      statusHtml = '<span style="color:var(--text2);font-size:12px">neu</span>';
    }

    return '<tr style="border-bottom:1px solid var(--border)' + (problem ? ';background:color-mix(in srgb,var(--accent) 6%,transparent)' : '') + '">' +
      '<td style="padding:4px 6px;font-size:12px;white-space:nowrap">' + _owEsc(row.datum ? formatDate(row.datum) : (row._zeile + ': ?')) + '</td>' +
      '<td style="padding:4px 6px;font-size:12px">' + _owEsc(row.veranstaltung_name || '–') +
        (row._veranstTreffer && _eeWertNorm(row._veranstTreffer) !== _eeWertNorm(row.veranstaltung_name || '')
          ? '<div style="font-size:10px;color:var(--accent)" title="Diese Zeile wird der bereits vorhandenen Veranstaltung zugeordnet">' +
              '&#x21B3; ' + _owEsc(row._veranstTreffer) +
              ' <a href="#" onclick="eeCsvVeranstLoesen(' + i + ');return false;" style="color:var(--text2);text-decoration:underline">trennen</a>' +
            '</div>'
          : '') +
      '</td>' +
      '<td style="padding:4px 6px;min-width:140px">' +
        (row.veranstaltung_id
          ? '<span style="font-size:12px;color:var(--text2)">' + _owEsc(row.ort || '–') + '</span>'
          : '<select onchange="eeCsvSetOrt(' + i + ',this.value)" style="' + fld + '">' + _eeCsvOrtOptions(row) + '</select>' +
            (row._ortVorschlag ? '<div style="font-size:10px;color:var(--primary)" title="Vorschlag aus früherer Austragung">&#x1F4A1; ' + _owEsc(row._ortVorschlag) + '</div>' : '')) +
      '</td>' +
      '<td style="padding:4px 6px;min-width:160px">' +
        '<select onchange="eeCsvSetDisz(' + i + ',this.value)" style="' + fld + '">' + _eeCsvDiszOptions(row) + '</select>' +
        (row._diszVorschlag ? '<div style="font-size:10px;color:var(--primary)" title="Vorschlag aus früheren Austragungen">&#x1F4A1; ' + _owEsc(row._diszVorschlag) + '</div>' : '') +
      '</td>' +
      '<td style="padding:4px 6px;font-size:12px;white-space:nowrap">' + _owEsc(fmtRes(row.resultat)) + '</td>' +
      '<td style="padding:4px 6px;font-size:12px">' + _owEsc(row.altersklasse || '–') + '</td>' +
      '<td style="padding:4px 6px;font-size:12px">' + _owEsc(row.startnummer || '–') + '</td>' +
      '<td style="padding:4px 6px;font-size:12px;white-space:nowrap">' +
        _owEsc((row.ak_platzierung || '–') + ' / ' + (row.pos_geschlecht || '–') + ' / ' + (row.pos_gesamt || '–')) + '</td>' +
      '<td style="padding:4px 6px;font-size:12px" title="' + _owEsc(row.bemerkungen || '') + '">' + _owEsc(row.schuh || '–') + '</td>' +
      '<td style="padding:4px 6px;font-size:12px">' + (row.verein ? _owEsc(row.verein) :
        '<span style="color:var(--text2)" title="Keine Vereinsangabe – wird ohne Verein als externes Ergebnis gespeichert">– ohne –</span>') + '</td>' +
      '<td style="padding:4px 6px;min-width:150px">' + statusHtml + '</td>' +
      '<td style="padding:4px 6px;white-space:nowrap;text-align:right">' +
        '<button class="btn btn-ghost btn-sm" title="Alle Felder dieser Zeile bearbeiten" onclick="eeCsvZeileModal(' + i + ')">&#x270F;&#xFE0F;</button>' +
        (row._importiert ? ''
          : '<button class="btn btn-primary btn-sm" style="margin-left:4px" title="Nur diesen Wettkampf importieren"' +
            (problem ? ' disabled' : '') + ' onclick="eeCsvZeileImport(' + i + ')">&#x2B07;&#xFE0E; Import</button>') +
      '</td>' +
    '</tr>';
  });

  // ── Gruppierte Ausgabe ────────────────────────────────────────────────────
  var kopf = ['Datum', 'Wettkampf', 'Ort', 'Disziplin', 'Ergebnis', 'AK', 'StNr', 'Pos AK/mw/ges', 'Schuh', 'Verein', 'Status / Aktion', '']
    .map(function(h) { return '<th style="text-align:left;padding:6px;font-size:11px;color:var(--text2);white-space:nowrap">' + h + '</th>'; }).join('');

  function gruppeHtml(key, titel, farbe, hinweis, sammelAktionen, importierbar) {
    var idxs = gruppen[key];
    if (!idxs.length) return '';
    var sammel = '';
    if (sammelAktionen || importierbar) {
      sammel = '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;padding:8px 10px;background:var(--surf2);font-size:12px;color:var(--text2)">' +
        'Alle Zeilen dieser Gruppe:' +
        (sammelAktionen || []).map(function(a) {
          return '<button class="btn btn-ghost btn-sm" onclick="eeCsvGruppenAktion(\'' + key + '\',\'' + a[0] + '\')">' + a[1] + '</button>';
        }).join('') +
        (importierbar ? '<div style="flex:1"></div>' +
          '<button class="btn btn-primary btn-sm" onclick="eeCsvGruppeImport(\'' + key + '\')">&#x2B07;&#xFE0E; Gruppe importieren</button>' : '') +
      '</div>';
    }
    return '<details ' + (key === 'importiert' ? '' : 'open') + ' style="border:1px solid var(--border);border-radius:10px;margin-bottom:12px;overflow:hidden">' +
      '<summary style="cursor:pointer;padding:10px 12px;background:var(--surf2);font-size:13px;font-weight:600;color:' + farbe + '">' +
        titel + ' <span style="color:var(--text2);font-weight:400">(' + idxs.length + ')</span>' +
        (hinweis ? '<div style="font-size:11px;font-weight:400;color:var(--text2);margin-top:2px">' + hinweis + '</div>' : '') +
      '</summary>' +
      sammel +
      '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;min-width:1050px">' +
        '<thead><tr style="background:var(--surface)">' + kopf + '</tr></thead>' +
        '<tbody>' + idxs.map(function(i) { return zeilenHtml[i]; }).join('') + '</tbody>' +
      '</table></div>' +
    '</details>';
  }

  wrap.innerHTML =
    gruppeHtml('unvollstaendig', '&#x26A0;&#xFE0F; Unvollst&auml;ndig', 'var(--accent)',
      'Noch nicht gespeichert und unvollst&auml;ndig: Datum, Disziplin, Ergebnis oder Ort fehlen &ndash; per &#x270F;&#xFE0F; erg&auml;nzen. ' +
      'Einmal gew&auml;hlte Disziplinen und Orte werden f&uuml;r den n&auml;chsten Import gemerkt.') +
    gruppeHtml('konflikt', '&#x26A1;&#xFE0E; Duplikate mit abweichenden Feldwerten', 'var(--accent)',
      'Gespeicherter und importierter Wert unterscheiden sich. Unter &#x270F;&#xFE0F; l&auml;sst sich je Feld entscheiden, welcher Wert gilt.',
      [['merge','Zusammenf&uuml;hren'],['skip','&Uuml;berspringen'],['insert','Trotzdem anlegen']], true) +
    gruppeHtml('duplikat', '&#x1F501;&#xFE0E; Duplikate ohne Konflikt', 'var(--text)',
      'Bereits gespeichert &ndash; auch Zeilen, deren Disziplin oder Ort in der CSV fehlt. Zusammenf&uuml;hren erg&auml;nzt nur bisher leere Felder.',
      [['merge','Zusammenf&uuml;hren'],['skip','&Uuml;berspringen'],['insert','Trotzdem anlegen']], true) +
    gruppeHtml('neu', '&#x2705;&#xFE0E; Neu &ndash; noch nicht importiert', 'var(--primary)',
      'Pro Wettkampf einzeln mit &#x2B07;&#xFE0E; Import oder alle zusammen.', null, true) +
    gruppeHtml('importiert', '&#x2714;&#xFE0E; Bereits importiert', 'var(--primary)',
      'In dieser Sitzung gespeichert &ndash; werden nicht erneut importiert.') +
    '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">' +
      '<button class="btn btn-ghost btn-sm" onclick="eeCsvAbbrechen()">&#x21BA; Verwerfen</button>' +
      '<div style="flex:1"></div>' +
      (aktiv ? '<button class="btn btn-primary" onclick="eeCsvImport()">&#x2B07;&#xFE0E; Alle ' + aktiv + ' importieren</button>' : '') +
    '</div>';

  if (statusEl) {
    var teile = [
      '<strong>' + aktiv + '</strong> importierbar',
      gruppen.importiert.length ? '<span style="color:var(--primary)">' + gruppen.importiert.length + ' importiert</span>' : '',
      gruppen.duplikat.length + gruppen.konflikt.length ? (gruppen.duplikat.length + gruppen.konflikt.length) + ' Duplikat(e)' : '',
      konflikte ? '<span style="color:var(--accent)">' + konflikte + ' abweichende Feldwerte</span>' : '',
      fehlend ? '<span style="color:var(--accent)">' + fehlend + ' unvollständig</span>' : '',
    ].filter(Boolean);
    statusEl.innerHTML = _eeCsvRows.length + ' Zeilen – ' + teile.join(', ');
  }
}

// Zuordnung zu einer bestehenden Veranstaltung lösen (eigene Veranstaltung anlegen)
function eeCsvVeranstLoesen(i) {
  var row = _eeCsvRows[i];
  if (!row) return;
  row.veranstaltung_id = null;
  row._veranstTreffer = '';
  row._veranstTrefferArt = '';
  row._veranstGetrennt = true;   // Prüfung soll nicht erneut automatisch zuordnen
  _eeCsvRenderPreview();
}

// Sammelaktion für eine ganze Gruppe
function eeCsvGruppenAktion(gruppe, aktion) {
  _eeCsvRows.forEach(function(row) {
    if (_eeCsvGruppe(row) !== gruppe) return;
    row._aktion = aktion;
    row._aktionManuell = true;
  });
  _eeCsvRenderPreview();
}

// Bereits verwendete eigene Werte (Schuhe, Vereine) für Auswahllisten
async function _eeLadeEigeneWerte() {
  if (window._eeEigeneWerte) return window._eeEigeneWerte;
  var r = await apiGet('ergebnisse/eigene-werte');
  window._eeEigeneWerte = (r && r.ok && r.data) ? r.data : { schuhe: [], vereine: [] };
  return window._eeEigeneWerte;
}

// Auswahlliste (datalist) – freie Eingabe bleibt möglich
function _eeDatalist(id, werte) {
  return '<datalist id="' + id + '">' +
    (werte || []).map(function(w) { return '<option value="' + _owEsc(w) + '"></option>'; }).join('') +
  '</datalist>';
}

// ── Zeilen-Editor: alle Felder bearbeiten + Konflikte feldweise entscheiden ──
// Feldliste des Editors: [Schlüssel, Beschriftung, Typ, vergleichbar mit Duplikat?]
function _eeCsvFelder() {
  return [
    ['datum',                  'Datum',            'date',   false],
    ['veranstaltung_name',     'Wettkampf',        'text',   false],
    ['ort',                    'Ort',              'ort',    false],
    ['disziplin_mapping_id',   'Disziplin',        'disz',   false],
    ['resultat',               'Ergebnis',         'text',   true],
    ['altersklasse',           'Altersklasse',     'text',   true],
    ['startnummer',            'Startnummer',      'text',   true],
    ['ak_platzierung',         'Pos (AK)',         'number', true],
    ['pos_geschlecht',         'Pos (m/w)',        'number', true],
    ['pos_gesamt',             'Pos (gesamt)',     'number', true],
    ['schuh',                  'Schuh',            'liste',  true],
    ['bemerkungen',            'Bemerkungen',      'text',   true],
    ['verein',                 'Verein',           'liste',  true],
    ['meisterschaft',          'Meisterschaft',    'mstr',   true],
    ['ak_platz_meisterschaft', 'Platz MS',         'number', true],
  ];
}

async function eeCsvZeileModal(i) {
  var row = _eeCsvRows[i];
  if (!row) return;
  var werte = await _eeLadeEigeneWerte();
  var d = (row._check || {}).dublette || null;
  var inp = 'box-sizing:border-box;width:100%;padding:6px 9px;border:1px solid var(--border);border-radius:7px;background:var(--surface);color:var(--text);font-size:13px';
  row._ueberschreiben = row._ueberschreiben || [];

  var zeilen = _eeCsvFelder().map(function(f) {
    var key = f[0], label = f[1], typ = f[2], vergleichbar = f[3];
    var wert = row[key];
    var feld;
    if (typ === 'disz') {
      feld = '<select id="eecf-' + key + '" style="' + inp + '">' + _eeCsvDiszOptions(row) + '</select>';
    } else if (typ === 'ort') {
      feld = '<select id="eecf-' + key + '" onchange="if(this.value===\'__neu__\'){closeModal();eeCsvOrtNeu(' + i + ');}" style="' + inp + '">' +
        _eeCsvOrtOptions(row) + '</select>';
    } else if (typ === 'mstr') {
      feld = '<select id="eecf-' + key + '" style="' + inp + '">' + mstrOptions(wert || 0) + '</select>';
    } else if (typ === 'date') {
      feld = '<input type="date" id="eecf-' + key + '" value="' + _owEsc(wert || '') + '" style="' + inp + '">';
    } else if (typ === 'liste') {
      // Bekannte eigene Werte als Vorschlag, freie Eingabe weiterhin möglich
      var lid = 'eecl-' + key;
      feld = '<input type="text" list="' + lid + '" id="eecf-' + key + '" value="' + _owEsc(wert || '') +
        '" placeholder="– leer – (eigene Werte als Vorschlag)" style="' + inp + '">' +
        _eeDatalist(lid, key === 'schuh' ? werte.schuhe : werte.vereine);
    } else {
      feld = '<input type="' + (typ === 'number' ? 'number' : 'text') + '"' + (typ === 'number' ? ' min="1"' : '') +
        ' id="eecf-' + key + '" value="' + _owEsc(wert === null || wert === undefined ? '' : (key === 'resultat' ? fmtRes(wert) : wert)) +
        '" placeholder="– leer –" style="' + inp + '">';
    }

    // Gespeicherter Wert + Entscheidung, falls Duplikat und Feld vergleichbar
    var altWert = '', aktion = '', altRoh = '';
    if (d && vergleichbar) {
      altRoh = key === 'meisterschaft'
        ? (d.meisterschaft ? mstrLabel(d.meisterschaft) : '')
        : _eeDecode(d[key]);
      var neuRoh = key === 'meisterschaft' ? (wert ? mstrLabel(wert) : '') : _eeDecode(wert);
      var konflikt = altRoh && neuRoh && _eeWertNorm(altRoh) !== _eeWertNorm(neuRoh);
      altWert = altRoh
        ? '<span style="font-size:13px' + (konflikt ? ';color:var(--accent);font-weight:600' : '') + '">' + _owEsc(altRoh) + '</span>'
        : '<span style="font-size:12px;color:var(--text2)">– leer –</span>';
      if (konflikt) {
        var ueb = row._ueberschreiben.indexOf(key) >= 0;
        aktion = '<select id="eeca-' + key + '" style="' + inp + ';font-size:12px;padding:4px 7px">' +
            '<option value="alt"' + (ueb ? '' : ' selected') + '>Gespeicherten behalten</option>' +
            '<option value="neu"' + (ueb ? ' selected' : '') + '>Import übernehmen</option>' +
          '</select>';
      } else if (!altRoh && neuRoh) {
        aktion = '<span style="font-size:11px;color:var(--primary)">&#x2795; wird ergänzt</span>';
      } else if (altRoh && neuRoh) {
        aktion = '<span style="font-size:11px;color:var(--text2)">identisch</span>';
      }
    }

    return '<tr style="border-bottom:1px solid var(--border)' + (aktion.indexOf('eeca-') >= 0 ? ';background:color-mix(in srgb,var(--accent) 7%,transparent)' : '') + '">' +
      '<td style="padding:6px 8px;font-size:12px;color:var(--text2);white-space:nowrap">' + label + '</td>' +
      (d ? '<td style="padding:6px 8px;min-width:120px">' + altWert + '</td>' : '') +
      '<td style="padding:6px 8px;min-width:180px">' + feld + '</td>' +
      (d ? '<td style="padding:6px 8px;min-width:160px">' + aktion + '</td>' : '') +
    '</tr>';
  }).join('');

  var kopfZeile = '<tr style="border-bottom:1px solid var(--border)">' +
      '<th style="text-align:left;padding:5px 8px;font-size:11px;color:var(--text2)">Feld</th>' +
      (d ? '<th style="text-align:left;padding:5px 8px;font-size:11px;color:var(--text2)">Gespeichert</th>' : '') +
      '<th style="text-align:left;padding:5px 8px;font-size:11px;color:var(--text2)">Import (bearbeitbar)</th>' +
      (d ? '<th style="text-align:left;padding:5px 8px;font-size:11px;color:var(--text2)">Bei Konflikt gilt</th>' : '') +
    '</tr>';

  showModal(
    '<div class="modal-header"><div class="modal-title">&#x270F;&#xFE0F; Zeile ' + (row._zeile || (i + 1)) + ' bearbeiten</div></div>' +
    (d ? '<div style="font-size:12px;color:var(--text2);margin-bottom:10px">Gespeichertes Ergebnis: „' +
          _owEsc(d.veranstaltung || '') + '" &middot; ' + _owEsc(d.disziplin || '') +
          (d.datum ? ' &middot; ' + formatDate(d.datum) : '') + '</div>'
       : '<div style="font-size:12px;color:var(--text2);margin-bottom:10px">Neuer Eintrag &ndash; alle Felder frei bearbeitbar.</div>') +
    '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;margin-bottom:14px">' + kopfZeile + zeilen + '</table></div>' +
    (d ? '<div style="font-size:12px;color:var(--text2);margin-bottom:14px">„Import übernehmen" ersetzt den gespeicherten Wert beim Zusammenführen. Leere gespeicherte Felder werden immer ergänzt.</div>' : '') +
    '<div class="modal-actions" style="gap:8px">' +
      '<button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button>' +
      '<div style="flex:1"></div>' +
      '<button class="btn btn-primary" onclick="eeCsvZeileSpeichern(' + i + ')">&#x2713; &Uuml;bernehmen</button>' +
    '</div>', true);
}

async function eeCsvZeileSpeichern(i) {
  var row = _eeCsvRows[i];
  if (!row) return;
  var vorher = { datum: row.datum, disziplin_mapping_id: row.disziplin_mapping_id, ort: row.ort, veranstaltung_name: row.veranstaltung_name };
  var ueberschreiben = [];
  _eeCsvFelder().forEach(function(f) {
    var key = f[0], typ = f[2];
    var el = document.getElementById('eecf-' + key);
    if (!el) return;
    var v = String(el.value || '').trim();
    if (typ === 'number' || typ === 'mstr') {
      row[key] = v ? (parseInt(v, 10) || null) : null;
    } else if (typ === 'disz') {
      var dz = (state.disziplinen || []).find(function(x) { return String(x.id || x.mapping_id) === v; });
      row.disziplin_mapping_id = dz ? (dz.id || dz.mapping_id) : null;
      row.disziplin = dz ? dz.disziplin : '';
      if (dz) _eeMerkSchreiben(_EE_MERK_DISZ, row.wettbewerb, dz.id || dz.mapping_id);
    } else if (typ === 'ort') {
      var ot = (window._bkOrte || []).find(function(x) { return String(x.id) === v; });
      row.ort_id = ot ? ot.id : null;
      row.ort    = ot ? ot.name : '';
      if (ot) _eeMerkSchreiben(_EE_MERK_ORT, row.veranstaltung_name, ot.id);
    } else if (key === 'resultat') {
      row.resultat = dbRes(v);
    } else {
      row[key] = v;
    }
    var aktEl = document.getElementById('eeca-' + key);
    if (aktEl && aktEl.value === 'neu') ueberschreiben.push(key);
  });
  row._ueberschreiben = ueberschreiben;
  // Wenn Konflikte übernommen werden sollen, ist „Zusammenführen" die passende Aktion
  if (ueberschreiben.length && row._aktion === 'skip') { row._aktion = 'merge'; row._aktionManuell = true; }
  closeModal();
  // Datum/Disziplin/Ort geändert → Veranstaltungs- und Dublettenprüfung wiederholen
  if (vorher.datum !== row.datum || vorher.disziplin_mapping_id !== row.disziplin_mapping_id ||
      vorher.ort !== row.ort || vorher.veranstaltung_name !== row.veranstaltung_name) {
    row.veranstaltung_id = null;
    await eeCsvPruefen();
  } else {
    _eeCsvRenderPreview();
  }
}

function eeCsvSetAktion(i, val) {
  if (!_eeCsvRows[i]) return;
  _eeCsvRows[i]._aktion = val;
  _eeCsvRows[i]._aktionManuell = true;
  _eeCsvRenderPreview();
}
function eeCsvSetOrt(i, val) {
  var row = _eeCsvRows[i];
  if (!row) return;
  if (val === '__neu__') { eeCsvOrtNeu(i); return; }
  var ort = (window._bkOrte || []).find(function(o) { return String(o.id) === String(val); });
  row.ort_id = ort ? ort.id : null;
  row.ort    = ort ? ort.name : '';
  if (ort) _eeMerkSchreiben(_EE_MERK_ORT, row.veranstaltung_name, ort.id);
  row._ortVorschlag = '';
  _eeCsvRenderPreview();
}

// Neuen Ort anlegen und der Zeile zuweisen
function eeCsvOrtNeu(i) {
  var row = _eeCsvRows[i] || {};
  var vorschlag = row.ort || '';
  showModal(
    '<div class="modal-header"><div class="modal-title">&#x1F4CD; Neuer Ort</div></div>' +
    '<div class="form-group full" style="margin-bottom:16px">' +
      '<label>Name *</label>' +
      '<input type="text" id="ee-neuer-ort-name" value="' + _owEsc(vorschlag) + '" placeholder="z.B. Bottrop" style="width:100%;padding:9px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text)"/>' +
    '</div>' +
    '<div class="modal-actions">' +
      '<button class="btn btn-ghost" onclick="closeModal();_eeCsvRenderPreview()">Abbrechen</button>' +
      '<button class="btn btn-primary" onclick="eeCsvOrtAnlegen(' + i + ')">Anlegen &amp; ausw&auml;hlen</button>' +
    '</div>', false);
  setTimeout(function() { var el = document.getElementById('ee-neuer-ort-name'); if (el) el.focus(); }, 50);
}

async function eeCsvOrtAnlegen(i) {
  var name = ((document.getElementById('ee-neuer-ort-name') || {}).value || '').trim();
  if (!name) { notify('Name erforderlich.', 'err'); return; }
  var r = await apiPost('orte', { name: name });
  if (!r || !r.ok) { notify((r && r.fehler) || 'Ort konnte nicht angelegt werden.', 'err'); return; }
  var neu = r.data;
  if (!window._bkOrte) window._bkOrte = [];
  window._bkOrte.push(neu);
  window._bkOrte.sort(function(a, b) { return (a.name || '').localeCompare(b.name || ''); });
  closeModal();
  var row = _eeCsvRows[i];
  if (row) { row.ort_id = neu.id; row.ort = neu.name; _eeMerkSchreiben(_EE_MERK_ORT, row.veranstaltung_name, neu.id); }
  notify('Ort „' + neu.name + '" angelegt.', 'ok');
  _eeCsvRenderPreview();
}
function eeCsvSetDisz(i, val) {
  var row = _eeCsvRows[i];
  if (!row) return;
  var d = (state.disziplinen || []).find(function(x) { return String(x.id || x.mapping_id) === String(val); });
  row.disziplin_mapping_id = d ? (d.id || d.mapping_id) : null;
  row.disziplin = d ? d.disziplin : '';
  if (d) _eeMerkSchreiben(_EE_MERK_DISZ, row.wettbewerb, d.id || d.mapping_id);
  row._diszVorschlag = '';
  _eeCsvRenderPreview();
}
function eeCsvAbbrechen() {
  _eeCsvRows = []; _eeCsvGeprueft = false;
  var w = document.getElementById('ee-csv-preview'); if (w) w.innerHTML = '';
  var s = document.getElementById('ee-csv-status'); if (s) s.textContent = '';
}

// ── Phase 2: Import ausführen ───────────────────────────────────────────────
// Baut das API-Item einer Zeile inkl. gewählter Aktion
function _eeCsvImportItem(row) {
  var it = _eeCsvItem(row);
  var hatteDup = !!(row._check && (row._check.dublette || row._check.antrag));
  // Ohne erkanntes Duplikat keine Aktion mitschicken → Server prüft erneut
  // (fängt auch Duplikate innerhalb derselben CSV ab)
  if (row._aktion === 'merge') {
    it.aktion = 'merge';
    // Feldweise Entscheidung „Import übernehmen" aus dem Zeilen-Editor
    if (row._ueberschreiben && row._ueberschreiben.length) it.felder_ueberschreiben = row._ueberschreiben;
  } else if (hatteDup) it.aktion = 'insert';
  return it;
}

function _eeCsvStatusText(stats) {
  var teile = [];
  if (stats.gespeichert)   teile.push(stats.gespeichert + ' gespeichert');
  if (stats.pending)       teile.push(stats.pending + ' zur Prüfung eingereicht');
  if (stats.gemergt)       teile.push(stats.gemergt + ' zusammengeführt');
  if (stats.uebersprungen) teile.push(stats.uebersprungen + ' übersprungen');
  if (stats.fehler)        teile.push(stats.fehler + ' fehlerhaft');
  return teile.join(', ');
}

// Importiert die übergebenen Zeilenindizes (Einzelzeile, Gruppe oder alles)
async function _eeCsvImportIndizes(indizes, label) {
  var statusEl = document.getElementById('ee-csv-status');
  var items = [], rowIdx = [];
  indizes.forEach(function(i) {
    var row = _eeCsvRows[i];
    if (!row || row._importiert || _eeCsvProblem(row) || row._aktion === 'skip') return;
    items.push(_eeCsvImportItem(row));
    rowIdx.push(i);
  });
  if (!items.length) { if (statusEl) statusEl.textContent = '⚠︎ Nichts zu importieren.'; return; }
  if (statusEl) statusEl.textContent = '⏳ Importiere ' + label + '…';
  var r = await apiPost('ergebnisse/eigenes-bulk', { items: items });
  if (!r || !r.ok) {
    if (statusEl) statusEl.textContent = '❌ ' + ((r && r.fehler) || 'Import fehlgeschlagen.');
    return;
  }
  // Rückmeldung je Zeile übernehmen
  (r.data.zeilen || []).forEach(function(z) {
    var row = _eeCsvRows[rowIdx[z.idx]];
    if (!row) return;
    if (z.status === 'fehler') { row._importFehler = z.msg || 'Fehler'; return; }
    row._importiert = true;
    row._importMsg = z.status === 'pending' ? 'eingereicht – wird geprüft'
                   : z.status === 'gemergt' ? (z.msg || 'zusammengeführt')
                   : z.status === 'uebersprungen' ? (z.msg || 'übersprungen')
                   : 'importiert';
    if (z.status === 'uebersprungen') row._importiert = true;
  });
  var txt = _eeCsvStatusText(r.data.stats || {});
  notify(txt || 'Fertig.', (r.data.stats && r.data.stats.fehler) ? 'err' : 'ok');
  if (statusEl) statusEl.innerHTML = '✅ ' + _owEsc(txt);
  if (r.data.meldungen && r.data.meldungen.length) console.warn('CSV-Import:', r.data.meldungen);
  _eeCsvRenderPreview();
}

// Einzelnen Wettkampf importieren
async function eeCsvZeileImport(i) {
  var row = _eeCsvRows[i];
  if (!row) return;
  var problem = _eeCsvProblem(row);
  if (problem) { notify(problem + ' – Zeile zuerst über ✏️ vervollständigen.', 'err'); return; }
  await _eeCsvImportIndizes([i], 'Zeile ' + (row._zeile || (i + 1)));
}

// Alle Zeilen einer Gruppe importieren
async function eeCsvGruppeImport(gruppe) {
  var idxs = [];
  _eeCsvRows.forEach(function(row, i) { if (_eeCsvGruppe(row) === gruppe) idxs.push(i); });
  await _eeCsvImportIndizes(idxs, idxs.length + ' Zeile(n)');
}

// Alle importierbaren Zeilen importieren
async function eeCsvImport() {
  var idxs = _eeCsvRows.map(function(_, i) { return i; });
  await _eeCsvImportIndizes(idxs, 'alle offenen Zeilen');
}

function renderEintragen() {
  // Standardtab: bulk wenn berechtigt, sonst eigenes
  // Sicherheitscheck: kein Zugriff auf bulk ohne Berechtigung
  var _validEintSubTabs = ['bulk', 'eigenes'];
  if (!state.subTab || _validEintSubTabs.indexOf(state.subTab) < 0 ||
      (state.subTab === 'bulk' && !_canBulkEintragen())) {
    state.subTab = _canBulkEintragen() ? 'bulk' : (_canEigenesEintragen() ? 'eigenes' : '');
  }
  if (!state.subTab) {
    document.getElementById('main-content').innerHTML = '<div class="panel" style="padding:32px;text-align:center;color:var(--text2)">Keine Berechtigung zum Eintragen.</div>';
    return;
  }
  var sub = state.subTab;

  // Subtab-Buttons
  var tabHtml = '<div style="display:flex;gap:8px;margin-bottom:20px">';
  if (_canBulkEintragen())
    tabHtml += '<button class="btn ' + (sub==='bulk' ? 'btn-primary' : 'btn-ghost') + '" onclick="state.subTab=\'bulk\';renderEintragen()">&#x1F4CB; Bulk-Eintragen</button>';
  if (_canEigenesEintragen())
    tabHtml += '<button class="btn ' + (sub==='eigenes' ? 'btn-primary' : 'btn-ghost') + '" onclick="state.subTab=\'eigenes\';renderEintragen()">&#x1F3C3;&#xFE0E; Eigenes Ergebnis eintragen</button>';
  tabHtml += '</div>';

  if (sub === 'eigenes') {
    document.getElementById('main-content').innerHTML = tabHtml;
    renderEigenesEintragen();
    return;
  }

  // Absoluter Sicherheitscheck: Bulk-Inhalt nur für berechtigte User
  if (!_canBulkEintragen()) {
    state.subTab = _canEigenesEintragen() ? 'eigenes' : '';
    if (!state.subTab) {
      document.getElementById('main-content').innerHTML = '<div class="panel" style="padding:32px;text-align:center;color:var(--text2)">Keine Berechtigung.</div>';
      return;
    }
    document.getElementById('main-content').innerHTML = tabHtml;
    renderEigenesEintragen();
    return;
  }

  var isBulk = true;

  var today = new Date().toISOString().slice(0, 10);

  var content = '';
  content =
      '<div class="panel" style="padding:24px">' +
        '<div class="panel-title" style="margin-bottom:4px">&#x1F4CB; Bulk-Eintragen</div>' +
        '<div style="color:var(--text2);font-size:13px;margin-bottom:16px">Mehrere Ergebnisse auf einmal eintragen &ndash; alle geh&ouml;ren zur selben Veranstaltung.</div>' +
        '<div id="bk-offene-wk"></div>' +
        '<div id="bk-rr-funde"></div>' +
        '<div id="bk-uits-funde"></div>' +
        '<div id="bk-la-funde"></div>' +
        '<div style="margin-bottom:14px">' +
          '<label style="font-size:12px;font-weight:600;color:var(--text2);display:block;margin-bottom:6px">Ergebnisse einf&uuml;gen</label>' +
          '<textarea id="bk-paste-area" rows="10" oninput="bulkPasteInput()" ondragover="bulkPdfDragOver(event)" ondragleave="bulkPdfDragLeave(event)" ondrop="bulkPdfDrop(event)" placeholder="URL oder Ergebnisse eingeben:&#10;&#10;RaceResult:   https://my.raceresult.com/354779/&#10;MikaTiming:   https://muenchen.r.mikatiming.com/2025/?pid=search&amp;pidp=start&#10;uitslagen.nl:     https://uitslagen.nl/uitslag?id=2025110916317&#10;evenementen:      https://evenementen.uitslagen.nl/2023/venloop/&#10;leichtathletik.de: https://ergebnisse.leichtathletik.de/Competitions/Resultoverview/18010&#10;Ergebnis-PDF/HTML URL: https://example.com/ergebnisse.pdf&#10;&#10;MaxFun Sports: Ergebnistabelle kopieren und hier einf&uuml;gen&#10;&#10;Oder direkte Ergebnisse:&#10;W65 / 11.10.25 / 400m / Max Mustermann  1:43:15  7&#10;&#10;Ergebnis-PDF oder Seltec-HTML (.htm) hierher ziehen" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:8px;font-size:12px;font-family:monospace;background:var(--surface);color:var(--text);resize:vertical"></textarea>' +
          '<div id="bk-import-kat-wrap" style="display:none;margin-top:8px;padding:10px 12px;background:var(--surf2);border-radius:8px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">' +
            '<span id="bk-import-source-label" style="font-size:12px;font-weight:600;color:var(--text2)"></span>' +
            '<label style="font-size:12px;color:var(--text2);white-space:nowrap">Importkategorie:</label>' +
            '<select id="bk-import-kat" onchange="bulkImportKatChanged()" style="padding:5px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px;background:var(--surface);color:var(--text)">' +
              '<option value="">&#x2013; bitte w&auml;hlen &#x2013;</option>' +
              (function() {
                var seen={}, opts='', disz=state.disziplinen||[], kats=[];
                for (var i=0;i<disz.length;i++){var d=disz[i];if(d.tbl_key&&!seen[d.tbl_key]){seen[d.tbl_key]=true;kats.push({key:d.tbl_key,name:d.kategorie});}}
                for (var ki=0;ki<kats.length;ki++){opts+='<option value="'+kats[ki].key+'">'+kats[ki].name+'</option>';}
                return opts;
              })() +
            '</select>' +
            '<label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text2);cursor:pointer;margin-left:8px">' +
              // Zustand aus der Variablen rendern – sonst zeigt die Box nach einem
              // Seitenwechsel wieder "an", obwohl weiterhin ohne Inaktive gematcht wird
              '<input type="checkbox" id="bk-match-inaktive"' + (window._bkMatchInaktive === false ? '' : ' checked') + ' onchange="window._bkMatchInaktive=this.checked" style="width:13px;height:13px;cursor:pointer">' +
              'Auch inaktive Athleten' +
            '</label>' +
          '</div>' +
          '<div style="display:flex;gap:8px;margin-top:8px;align-items:center">' +
            '<button class="btn btn-primary btn-sm" id="bk-einlesen-btn" onclick="bulkEinlesen()">&#x25B6; Einlesen</button>' +
            '<div id="bk-post-import-actions" style="display:none;gap:8px;align-items:center">' +
              '<button class="btn btn-ghost btn-sm" onclick="bulkReset()">&#x21BA; Reset</button>' +
            '</div>' +
            '<div id="bk-import-status" style="font-size:12px;color:var(--text2)"></div>' +
          '</div>' +
          '<div id="bk-unknown-disz" style="display:none;margin-top:8px"></div>' +
          '<details id="bk-import-debug-wrap" style="display:none;margin-top:8px">' +
            '<summary style="cursor:pointer;font-size:12px;color:var(--text2);padding:4px 0">&#x1F50D; Import-Debug</summary>' +
            '<div style="position:relative">' +
              '<button onclick="(function(){var el=document.getElementById(\'bk-import-debug\');var txt=el.innerText||el.textContent;if(navigator.clipboard){navigator.clipboard.writeText(txt).then(function(){var b=el.parentNode.querySelector(\'button\');var old=b.textContent;b.textContent=\'\u2713 Kopiert!\';setTimeout(function(){b.textContent=old;},2000);});}else{var r=document.createRange();r.selectNode(el);window.getSelection().removeAllRanges();window.getSelection().addRange(r);}})()" style="position:absolute;top:6px;right:6px;font-size:11px;padding:3px 8px;border-radius:5px;border:1px solid var(--border);background:var(--surface);color:var(--text2);cursor:pointer">&#x1F4CB; Kopieren</button>' +
              '<pre id="bk-import-debug" style="font-size:10px;overflow-x:auto;background:var(--surf2);padding:8px;padding-right:80px;border-radius:6px;white-space:pre-wrap;color:var(--text2);max-height:300px;overflow-y:auto"></pre>' +
            '</div>' +
          '</details>' +
        '</div>' +
        '<div style="display:flex;gap:8px;margin-bottom:16px">' +
          '<button id="bk-toggle-neu" class="btn btn-primary btn-sm" onclick="bkToggleVeranst(\'neu\')">+ Neue Veranstaltung</button>' +
          '<button id="bk-toggle-best" class="btn btn-ghost btn-sm" onclick="bkToggleVeranst(\'best\')">&#x1F4C5; Bestehende w&auml;hlen</button>' +
        '</div>' +
        '<div id="bk-neu-form" style="margin-bottom:16px">' +
          '<div class="form-group" style="margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid var(--border)">' +
            '<label>Regelmäßige Veranstaltung <span style="font-size:11px;color:var(--text2);font-weight:400">(optional)</span></label>' +
            '<input type="text" id="bk-serie-search" placeholder="Serie suchen…" autocomplete="off" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--surface);color:var(--text);box-sizing:border-box"' +
              ' oninput="bkSerieSearch(this.value)" onfocus="bkSerieSearch(this.value)" onblur="setTimeout(bkSerieHideDropdown,200)">' +
          '</div>' +
          '<div class="form-grid">' +
          '<div class="form-group"><label>Datum *</label><input type="date" id="bk-datum" value="' + today + '" onchange="bkSyncDatum(this.value)"/></div>' +
          '<div class="form-group"><label>Kategorie</label><select id="bk-kat" style="width:100%" onchange="bkKatChanged()">' + (function(){
            var seen={}, opts='<option value="">Alle Kategorien</option>';
            var disz=state.disziplinen||[];
            var kats=[];
            for(var i=0;i<disz.length;i++){var d=disz[i];if(d.tbl_key&&!seen[d.tbl_key]){seen[d.tbl_key]=true;kats.push({key:d.tbl_key,name:d.kategorie});}}
            for(var ki=0;ki<kats.length;ki++){opts+='<option value="'+kats[ki].key+'">'+kats[ki].name+'</option>';}
            return opts;
          })() + '</select></div>' +
          '<div class="form-group"><label>Veranstaltungsname</label><input type="text" id="bk-evname" placeholder="z.B. Düsseldorf Marathon"/></div>' +
          '<div class="form-group"><label>Ort *</label><input type="text" id="bk-ort" placeholder="z.B. D&uuml;sseldorf" autocomplete="off" oninput="bkOrtSearch(this.value)" onfocus="bkOrtSearch(this.value)" onblur="setTimeout(bkOrtHideDropdown,200)"/></div>' +
          '<div class="form-group"><label>Meisterschaft</label>' +
            '<select id="bk-mstr-global" style="width:100%" onchange="importToggleMstr(\'bk\',!!this.value,this.value)">' +
              mstrOptions(0) +
            '</select>' +
          '</div>' +
          '<div class="form-group"><label>Datenquelle (URL)</label><input type="url" id="bk-quelle" placeholder="z.B. https://my.raceresult.com/..." style="font-size:12px"/></div>' +
          '</div>' +
        '</div>' +
        '<div id="bk-best-form" style="display:none;margin-bottom:16px">' +
          '<label style="font-size:12px;font-weight:600;color:var(--text2);display:block;margin-bottom:6px">Veranstaltung *</label>' +
          '<div style="max-width:500px">' +
            '<input id="bk-veranst-search" type="text" placeholder="Name, Kürzel oder Ort suchen…" autocomplete="off"' +
              ' style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--surface);color:var(--text);box-sizing:border-box"' +
              ' oninput="bkVeranstSearch(this.value)" onfocus="bkVeranstSearch(this.value)" onblur="setTimeout(bkVeranstHideDropdown,200)">' +
          '</div>' +
        '</div>' +

        '<div style="margin-bottom:8px;display:flex;align-items:center;gap:16px;flex-wrap:wrap">' +
          '<label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text2);cursor:pointer">' +
            '<input type="checkbox" id="bk-ak-angleichen" checked onchange="bkToggleAkAngleichen(this.checked)" style="width:13px;height:13px;cursor:pointer">' +
            'AK nach DLV-System angleichen (aus Athlet + Datum berechnen)' +
          '</label>' +
        '</div>' +
        '<div style="overflow-x:auto">' +
          '<table style="width:100%;border-collapse:collapse;font-size:13px" id="bulk-table">' +
            '<thead><tr style="background:var(--surf2);color:var(--text2)">' +
              '<th style="padding:8px 6px;text-align:left;font-weight:600">#</th>' +
              '<th style="padding:8px 6px;text-align:left;font-weight:600">Athlet*in *</th>' +
              '<th style="padding:8px 6px;text-align:left;font-weight:600">Disziplin *</th>' +
              '<th style="padding:8px 6px;text-align:left;font-weight:600">Ergebnis *</th>' +
              '<th style="padding:8px 6px;text-align:left;font-weight:600">AK</th>' +
              '<th style="padding:8px 6px;text-align:left;font-weight:600">Platz AK</th>' +
              '<th class="bk-mstr-th" style="padding:8px 6px;text-align:left;font-weight:600;display:none">Meisterschaft</th>' +
              '<th class="bk-mstr-th" style="padding:8px 6px;text-align:left;font-weight:600;display:none">Platz MS</th>' +
              '<th style="padding:8px 6px;text-align:left;font-weight:600">Datum</th>' +
              '<th style="padding:8px 6px;text-align:left;font-weight:600;font-size:11px" title="Vereinsname: leer oder anderer Verein → externes Ergebnis">Verein</th>' +
              '<th style="padding:8px 6px;width:36px"></th>' +
            '</tr></thead>' +
            '<tbody id="bulk-rows"></tbody>' +
          '</table>' +
        '</div>' +
        '<div style="margin-top:12px;display:flex;gap:10px;align-items:center">' +
          '<button class="btn btn-ghost btn-sm" onclick="bulkAddRow()">+ Zeile hinzuf&uuml;gen</button>' +
          '<button class="btn btn-primary" onclick="bulkSubmit()">&#x1F4BE; Alle speichern</button>' +
          (appConfig && appConfig.github_repo ? '<button class="btn btn-ghost btn-sm" style="color:#e53935;border-color:#e53935;margin-left:4px" onclick="bulkMeldeImport()">&#x26A0;&#xFE0F; Schlechten Import melden</button>' : '') +
          '<span id="bulk-status" style="font-size:13px;color:var(--text2)"></span>' +
        '</div>' +
      '</div>';

  document.getElementById('main-content').innerHTML = tabHtml + content;
  _bkLoadSerien();
  _bkLoadOrte();
  _bkLoadOffeneWK();
  _bkLadeRrFunde();
  _bkLadeUitsFunde();
  _bkLadeLaFunde();
  _bkSelectedOrtId = null;

  if (isBulk) {
    bulkAddRow();
    _bkSelectedVeranst = null;
  }
}

var _bkVeranstModus = 'neu'; // 'neu' oder 'best'

function bkToggleVeranst(modus) {
  _bkVeranstModus = modus;
  var neuForm  = document.getElementById('bk-neu-form');
  var bestForm = document.getElementById('bk-best-form');
  var btnNeu   = document.getElementById('bk-toggle-neu');
  var btnBest  = document.getElementById('bk-toggle-best');
  if (!neuForm || !bestForm) return;
  if (modus === 'best') {
    neuForm.style.display  = 'none';
    bestForm.style.display = '';
    if (btnNeu)  { btnNeu.className  = 'btn btn-ghost btn-sm'; }
    if (btnBest) { btnBest.className = 'btn btn-primary btn-sm'; }
  } else {
    neuForm.style.display  = '';
    bestForm.style.display = 'none';
    if (btnNeu)  { btnNeu.className  = 'btn btn-primary btn-sm'; }
    if (btnBest) { btnBest.className = 'btn btn-ghost btn-sm'; }
  }
}

var _bkSelectedVeranst = null;
var _bkVeranstSearchTimer = null;
var _bkVeranstResults = [];

function _bkVeranstGetOrCreateDropdown() {
  var drop = document.getElementById('bk-veranst-dropdown');
  if (!drop) {
    drop = document.createElement('div');
    drop.id = 'bk-veranst-dropdown';
    drop.style.cssText = 'display:none;position:fixed;background:var(--surface);border:1px solid var(--border);border-radius:8px;z-index:9999;max-height:320px;overflow-y:auto;box-shadow:0 4px 16px rgba(0,0,0,.22)';
    document.body.appendChild(drop);
  }
  return drop;
}

function bkVeranstSearch(val) {
  clearTimeout(_bkVeranstSearchTimer);
  _bkVeranstSearchTimer = setTimeout(async function() {
    var inp = document.getElementById('bk-veranst-search');
    if (!inp) return;
    var drop = _bkVeranstGetOrCreateDropdown();
    var q = val.trim();
    if (_bkSelectedVeranst && inp.value !== _bkVeranstLabel(_bkSelectedVeranst)) {
      _bkSelectedVeranst = null;
    }
    var url = q ? 'veranstaltungen?limit=20&suche=' + encodeURIComponent(q) : 'veranstaltungen?limit=20';
    var r = await apiGet(url);
    _bkVeranstResults = (r && r.ok && r.data.veranst) ? r.data.veranst : [];
    if (!_bkVeranstResults.length) {
      drop.innerHTML = '<div style="padding:10px 12px;font-size:13px;color:var(--text2)">Keine Veranstaltung gefunden</div>';
    } else {
      drop.innerHTML = _bkVeranstResults.map(function(v, i) {
        var label = _bkVeranstLabel(v);
        return '<div style="padding:9px 12px;font-size:13px;cursor:pointer;border-bottom:1px solid var(--border)" ' +
          'onmousedown="bkVeranstSelect(' + i + ')" ' +
          'onmouseover="this.style.background=\'var(--surf2)\'" onmouseout="this.style.background=\'\'">' +
          label.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</div>';
      }).join('');
    }
    var rect = inp.getBoundingClientRect();
    drop.style.left  = rect.left + 'px';
    drop.style.top   = (rect.bottom + 2) + 'px';
    drop.style.width = rect.width + 'px';
    drop.style.display = '';
  }, 250);
}

function _bkVeranstLabel(v) {
  return (v.name || v.kuerzel) + ' (' + formatDate(v.datum) + (v.ort ? ', ' + v.ort : '') + ')';
}

function bkVeranstSelect(idx) {
  var v = _bkVeranstResults[idx];
  if (!v) return;
  _bkSelectedVeranst = v;
  var inp = document.getElementById('bk-veranst-search');
  if (inp) inp.value = _bkVeranstLabel(v);
  bkVeranstHideDropdown();
}

function bkVeranstHideDropdown() {
  var drop = document.getElementById('bk-veranst-dropdown');
  if (drop) drop.style.display = 'none';
}

// Nach einem Import prüfen, ob die Veranstaltung schon in der Datenbank steht.
// Bei eindeutigem Treffer auf „Bestehende wählen" umschalten und vorauswählen,
// damit keine Dublette angelegt wird.
async function bkAutoSelectVeranstaltung() {
  if (_bkSelectedVeranst) return;          // Nutzer hat bereits selbst gewählt
  var datum = ((document.getElementById('bk-datum')  || {}).value || '').trim();
  var name  = ((document.getElementById('bk-evname') || {}).value || '').trim();
  var ort   = ((document.getElementById('bk-ort')    || {}).value || '').trim();
  if (!datum && !name) return;

  var r;
  try {
    r = await apiGet('veranstaltungen/match?datum=' + encodeURIComponent(datum) +
                     '&name=' + encodeURIComponent(name) +
                     '&ort='  + encodeURIComponent(ort));
  } catch (e) { return; }
  if (!r || !r.ok || !r.data) return;

  var best    = r.data.best || null;
  var treffer = r.data.treffer || [];

  if (!best) {
    if (treffer.length) {
      _bkDbgLine('Veranstaltung', 'kein eindeutiger Treffer – ' + treffer.length +
        ' ähnliche: ' + treffer.slice(0, 3).map(_bkVeranstLabel).join(' | '));
    } else {
      _bkDbgLine('Veranstaltung', 'noch nicht in der Datenbank → neue Veranstaltung');
    }
    return;
  }

  bkToggleVeranst('best');
  _bkSelectedVeranst = best;
  var inp = document.getElementById('bk-veranst-search');
  if (inp) inp.value = _bkVeranstLabel(best);
  notify('Veranstaltung existiert bereits: „' + _bkVeranstLabel(best) +
         '" – „Bestehende wählen" wurde vorausgewählt.', 'ok');
  _bkDbgLine('Veranstaltung erkannt', _bkVeranstLabel(best) + ' (ID ' + best.id + ')');
}

// ── Row-Dropdown (Athlet / Disziplin) ────────────────────────
var _bkRowDropType = null;
var _bkRowDropTr   = null;
var _bkRowDropResults = [];

function _bkRowGetOrCreateDropdown() {
  var drop = document.getElementById('bk-row-dropdown');
  if (!drop) {
    drop = document.createElement('div');
    drop.id = 'bk-row-dropdown';
    drop.style.cssText = 'display:none;position:fixed;background:var(--surface);border:1px solid var(--border);border-radius:8px;z-index:9999;max-height:280px;overflow-y:auto;box-shadow:0 4px 16px rgba(0,0,0,.22)';
    document.body.appendChild(drop);
  }
  return drop;
}

function _bkRowShowDrop(inp, items, renderFn) {
  var drop = _bkRowGetOrCreateDropdown();
  _bkRowDropResults = items;
  if (!items.length) {
    drop.innerHTML = '<div style="padding:10px 12px;font-size:13px;color:var(--text2)">Keine Treffer</div>';
  } else {
    drop.innerHTML = items.map(function(item, i) {
      return '<div style="padding:8px 12px;font-size:13px;cursor:pointer;border-bottom:1px solid var(--border)"' +
        ' onmousedown="bkRowSelectItem(' + i + ')"' +
        ' onmouseover="this.style.background=\'var(--surf2)\'" onmouseout="this.style.background=\'\'">' +
        renderFn(item) + '</div>';
    }).join('');
  }
  var rect = inp.getBoundingClientRect();
  drop.style.left  = rect.left + 'px';
  drop.style.top   = (rect.bottom + 2) + 'px';
  drop.style.width = rect.width + 'px';
  drop.style.display = '';
}

function bkRowSelectItem(i) {
  var item = _bkRowDropResults[i];
  if (!item) return;
  if (_bkRowDropType === 'athlet') _bkRowAthletSelect(item);
  else _bkRowDiszSelect(item);
  bkRowHideDropdown();
}

function bkRowHideDropdown() {
  var drop = document.getElementById('bk-row-dropdown');
  if (drop) drop.style.display = 'none';
}

function bkRowAthletSearch(inp) {
  var tr = inp.closest('tr');
  _bkRowDropTr   = tr;
  _bkRowDropType = 'athlet';
  var q = inp.value.toLowerCase().trim();
  var list = state.athleten || [];
  var filtered = (q ? list.filter(function(a) { return a.name_nv.toLowerCase().indexOf(q) >= 0; }) : list).slice(0, 25);
  _bkRowShowDrop(inp, filtered, function(a) {
    var info = (a.geschlecht || '') + (a.geburtsjahr ? (a.geschlecht ? ', ' : '') + a.geburtsjahr : '');
    return (a.name_nv || '').replace(/&/g,'&amp;').replace(/</g,'&lt;') + (info ? ' <span style="color:var(--text2);font-size:11px">(' + info + ')</span>' : '');
  });
}

function _bkRowAthletSelect(a) {
  var tr = _bkRowDropTr;
  if (!tr) return;
  var hidden = tr.querySelector('.bk-athlet');
  var search = tr.querySelector('.bk-athlet-search');
  if (hidden) {
    hidden.value = a.id;
    hidden.dataset.g    = a.geschlecht     || '';
    hidden.dataset.gebj = a.geburtsjahr ? String(a.geburtsjahr) : '';
  }
  if (search) search.value = a.name_nv || '';
  var rowId = tr.id;
  var idx = rowId ? parseInt(rowId.replace('bkrow-', '')) : -1;
  if (idx >= 0 && hidden) bkUpdateAK(hidden, idx);
}

function bkAthletSetById(tr, id) {
  if (!tr || !id) return;
  var a = (state.athleten || []).find(function(x) { return String(x.id) === String(id); });
  var hidden = tr.querySelector('.bk-athlet');
  var search = tr.querySelector('.bk-athlet-search');
  if (!hidden) return;
  hidden.value = id;
  if (a) {
    hidden.dataset.g    = a.geschlecht || '';
    hidden.dataset.gebj = a.geburtsjahr ? String(a.geburtsjahr) : '';
    if (search) search.value = a.name_nv || '';
  }
  var idx = tr.id ? parseInt(tr.id.replace('bkrow-', '')) : -1;
  if (idx >= 0) bkUpdateAK(hidden, idx);
}

function bkRowDiszSearch(inp) {
  var tr = inp.closest('tr');
  _bkRowDropTr   = tr;
  _bkRowDropType = 'disz';
  var q   = inp.value.toLowerCase().trim();
  var kat = (document.getElementById('bk-kat') || {}).value || '';
  var erlaubt = kat ? bkKatMitGruppen(kat) : null;
  var list = (state.disziplinen || []).filter(function(item) {
    if (erlaubt && item.tbl_key && erlaubt.indexOf(item.tbl_key) < 0) return false;
    if (q && item.disziplin.toLowerCase().indexOf(q) < 0) return false;
    return true;
  }).slice(0, 30);
  _bkRowShowDrop(inp, list, function(item) {
    return (item.disziplin || '').replace(/&/g,'&amp;').replace(/</g,'&lt;');
  });
}

function _bkRowDiszSelect(item) {
  var tr = _bkRowDropTr;
  if (!tr) return;
  var mid = item.id || item.mapping_id || '';
  var val = mid || item.disziplin;
  var sel = tr.querySelector('.bk-disz');
  var inp = tr.querySelector('.bk-disz-search');
  if (sel) {
    sel.value = String(val);
    if (mid) sel.setAttribute('data-mid', String(mid));
  }
  if (inp) inp.value = item.disziplin || '';
}

function bkSyncDiszDisplay(tr) {
  var sel = tr && tr.querySelector('.bk-disz');
  var inp = tr && tr.querySelector('.bk-disz-search');
  if (!sel || !inp) return;
  var opt = sel.options[sel.selectedIndex];
  inp.value = (opt && opt.value) ? opt.text : '';
}

// Gibt alle tbl_keys zurück die für eine gewählte Kategorie angezeigt werden sollen
// inkl. Gruppen-Partner aus appConfig.kategoriegruppen
function bkKatMitGruppen(kat) {
  if (!kat) return null; // null = alle
  var erlaubt = [kat];
  var gruppen = [];
  try { gruppen = JSON.parse(appConfig.kategoriegruppen || '[]'); } catch(e) {}
  for (var gi = 0; gi < gruppen.length; gi++) {
    var g = gruppen[gi].mitglieder || [];
    if (g.indexOf(kat) >= 0) {
      for (var mi = 0; mi < g.length; mi++) {
        if (erlaubt.indexOf(g[mi]) < 0) erlaubt.push(g[mi]);
      }
    }
  }
  return erlaubt;
}

function bkDiszOpts(kat) {
  var erlaubt = bkKatMitGruppen(kat); // null = alle, sonst Array
  var opts = '<option value="">– wählen –</option>';
  var list = state.disziplinen || [];
  for (var i = 0; i < list.length; i++) {
    var item = list[i];
    var d = (typeof item === 'object') ? item.disziplin : item;
    var k = (typeof item === 'object') ? item.tbl_key : '';
    if (erlaubt && k && erlaubt.indexOf(k) < 0) continue;
    // Kategoriesuffix zeigen wenn Gruppe aktiv (z.B. 'Weitsprung (Sprung&Wurf)')
    var label = d;
    if (erlaubt && erlaubt.length > 1 && k && k !== kat) {
      var katObj = (state.disziplinen || []).find(function(x) { return x.tbl_key === k && x.kategorie; });
      if (katObj) label = d + ' (' + katObj.kategorie + ')';
    }
    // mapping_id als Value wenn vorhanden (ermöglicht exakten Kategorie-Match via diszMid)
    var mid = (typeof item === 'object') ? (item.id || item.mapping_id || '') : '';
    var val = mid || d;
    opts += '<option value="' + val + '">' + label + '</option>';
  }
  return opts;
}

async function _bkLoadSerien() {
  var r = await apiGet('veranstaltung-serien');
  if (!r || !r.ok) return;
  window._bkSerien = r.data || [];
}

var _bkSelectedSerie = null;
var _bkSerieSearchTimer = null;

function bkSerieSearch(val) {
  clearTimeout(_bkSerieSearchTimer);
  _bkSerieSearchTimer = setTimeout(function() {
    var inp = document.getElementById('bk-serie-search');
    if (!inp) return;
    var drop = _bkSerieGetOrCreateDropdown();
    var q = (val || '').toLowerCase().trim();
    if (_bkSelectedSerie && inp.value !== _bkSelectedSerie.name) _bkSelectedSerie = null;
    var serien = window._bkSerien || [];
    var filtered = q ? serien.filter(function(s) { return s.name.toLowerCase().indexOf(q) >= 0; }) : serien;
    filtered = filtered.slice(0, 25);
    var html = '';
    if (!q) {
      html += '<div style="padding:8px 12px;font-size:13px;cursor:pointer;border-bottom:1px solid var(--border);color:var(--text2)"' +
        ' onmousedown="bkSerieSelectNone()"' +
        ' onmouseover="this.style.background=\'var(--surf2)\'" onmouseout="this.style.background=\'\'">' +
        '– keine Zuordnung –</div>';
    }
    html += filtered.map(function(s, i) {
      return '<div style="padding:8px 12px;font-size:13px;cursor:pointer;border-bottom:1px solid var(--border)"' +
        ' onmousedown="bkSerieSelectIdx(' + i + ')"' +
        ' onmouseover="this.style.background=\'var(--surf2)\'" onmouseout="this.style.background=\'\'">' +
        (s.name || '').replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</div>';
    }).join('');
    html += '<div style="padding:8px 12px;font-size:13px;cursor:pointer;color:var(--accent)"' +
      ' onmousedown="bkSerieNeu()"' +
      ' onmouseover="this.style.background=\'var(--surf2)\'" onmouseout="this.style.background=\'\'">' +
      '＋ Neue regelmäßige Veranstaltung…</div>';
    drop.innerHTML = html;
    // filtered für bkSerieSelectIdx merken
    drop._filteredSerien = filtered;
    var rect = inp.getBoundingClientRect();
    drop.style.left  = rect.left + 'px';
    drop.style.top   = (rect.bottom + 2) + 'px';
    drop.style.width = rect.width + 'px';
    drop.style.display = '';
  }, 150);
}

function _bkSerieGetOrCreateDropdown() {
  var drop = document.getElementById('bk-serie-dropdown');
  if (!drop) {
    drop = document.createElement('div');
    drop.id = 'bk-serie-dropdown';
    drop.style.cssText = 'display:none;position:fixed;background:var(--surface);border:1px solid var(--border);border-radius:8px;z-index:9999;max-height:280px;overflow-y:auto;box-shadow:0 4px 16px rgba(0,0,0,.22)';
    document.body.appendChild(drop);
  }
  return drop;
}

function bkSerieSelectIdx(i) {
  var drop = document.getElementById('bk-serie-dropdown');
  var s = drop && drop._filteredSerien && drop._filteredSerien[i];
  if (!s) return;
  _bkSelectedSerie = s;
  var inp = document.getElementById('bk-serie-search');
  if (inp) inp.value = s.name;
  if (s.ort_letzte && !((document.getElementById('bk-ort')||{}).value)) _bkAutoSetOrt(s.ort_letzte);
  var evEl = document.getElementById('bk-evname');
  if (evEl && !evEl.value) evEl.value = _cleanEventName(s.name);
  bkSerieHideDropdown();
}

function bkSerieSelectNone() {
  _bkSelectedSerie = null;
  var inp = document.getElementById('bk-serie-search');
  if (inp) inp.value = '';
  bkSerieHideDropdown();
}

function bkSerieNeu() {
  bkSerieHideDropdown();
  bkNeueSerieModal();
}

function bkSerieSetById(id) {
  var s = (window._bkSerien || []).find(function(x) { return String(x.id) === String(id); });
  if (!s) return;
  _bkSelectedSerie = s;
  var inp = document.getElementById('bk-serie-search');
  if (inp) inp.value = s.name;
}

function bkSerieHideDropdown() {
  var drop = document.getElementById('bk-serie-dropdown');
  if (drop) drop.style.display = 'none';
}

/**
 * v1105: Passende regelmäßige Veranstaltung zum Event-Namen finden.
 * Tokenisiert Name + Kürzel der Serien, matcht mit dem importierten Event-Namen.
 * Rückgabe: bestes Serie-Objekt (mit id, name, kuerzel, ort_letzte) oder null.
 *
 * Beispiele die matchen:
 *   "Apfelblütenlauf 2026"         → Serie "Apfelblütenlauf"
 *   "Venloop 2025 - 10 km"          → Serie "Venloop"
 *   "Düsseldorf Marathon"           → Serie "Düsseldorf Marathon" oder "Marathon"
 *   "40. Berliner Halbmarathon"    → Serie "Berliner Halbmarathon"
 */
function _bkMatchSerie(eventName) {
  if (!eventName) return null;
  var serien = window._bkSerien || [];
  if (!serien.length) return null;

  // Normalizer: lowercase, Umlaute/Accents entfernen, Jahr/Zahlen weg, Sonderzeichen weg
  function norm(s) {
    return (s||'').toLowerCase()
      .replace(/ß/g,'ss').replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue')
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .replace(/[.,:;!?()\/|&-]/g,' ')
      .replace(/\s+/g,' ').trim();
  }
  function tokens(s) {
    return norm(s).split(/\s+/).filter(function(t){
      // Stopwords raus: Jahre (4-stellig), reine Zahlen, triviale Wörter
      if (/^\d{4}$/.test(t)) return false;
      if (/^\d+$/.test(t)) return false;
      if (/^(der|die|das|am|in|im|zu|auf|von|vom|und|oder|km|mi|m|lauf|laufen|run)$/.test(t)) return false;
      return t.length >= 3;
    });
  }

  var evTok = tokens(eventName);
  if (!evTok.length) return null;

  var best = null;
  var bestScore = 0;

  serien.forEach(function(s) {
    // Matchen gegen Serie-Name UND Kürzel (beides zählt)
    var sTokSet = {};
    tokens(s.name).forEach(function(t){ sTokSet[t] = 1; });
    if (s.kuerzel) tokens(s.kuerzel).forEach(function(t){ sTokSet[t] = 1; });
    var sTok = Object.keys(sTokSet);
    if (!sTok.length) return;

    // Score: wieviele Event-Tokens sind in Serie-Tokens (Substring-Match für Toleranz)
    var hits = 0;
    evTok.forEach(function(et) {
      var matched = sTok.some(function(st) {
        if (st === et) return true;
        // Substring in beide Richtungen, ab 5 Zeichen (vermeidet falsche Mini-Matches)
        if (et.length >= 5 && st.indexOf(et) === 0) return true;
        if (st.length >= 5 && et.indexOf(st) === 0) return true;
        return false;
      });
      if (matched) hits++;
    });

    // Score normalisieren: relativer Anteil der Serien-Tokens getroffen
    // (verhindert dass eine sehr generische Serie wie "Marathon" fälschlich alle matcht)
    var coverage = hits / sTok.length; // wieviel der Serie wurde getroffen
    var evCoverage = hits / evTok.length; // wieviel vom Event wurde als Serie erkannt
    // Kombinierter Score: beide müssen halbwegs gut sein
    var score = (coverage + evCoverage) / 2;

    // Mindestanforderung: mindestens 1 Token-Hit und Score ≥ 0.5
    if (hits >= 1 && score > bestScore && score >= 0.5) {
      bestScore = score;
      best = s;
    }
  });
  return best;
}


async function bkNeueSerieModal() {
  showModal(
    modalH2('&#x1F504; Neue regelmäßige Veranstaltung') +
    '<div class="form-group full" style="margin-bottom:16px">' +
      '<label>Name *</label>' +
      '<input type="text" id="bk-neue-serie-name" placeholder="z.B. Venloop" autofocus style="width:100%;padding:9px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text)"/>' +
    '</div>' +
    '<div class="modal-actions">' +
      '<button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button>' +
      '<button class="btn btn-primary" onclick="bkNeueSerieAnlegen()">Anlegen &amp; auswählen</button>' +
    '</div>'
  );
  setTimeout(function() {
    var inp = document.getElementById('bk-neue-serie-name');
    // Vorbelegen aus Veranstaltungsname falls vorhanden
    var evEl = document.getElementById('bk-evname');
    if (inp && evEl && evEl.value) inp.value = evEl.value;
    if (inp) inp.focus();
  }, 50);
}

async function bkNeueSerieAnlegen() {
  var name = ((document.getElementById('bk-neue-serie-name') || {}).value || '').trim();
  if (!name) { notify('Name erforderlich.', 'err'); return; }
  var r = await apiPost('veranstaltung-serien', { name: name });
  if (!r || !r.ok) { notify('Fehler: ' + (r&&r.fehler||'?'), 'err'); return; }
  var newId = r.data && r.data.id;
  closeModal();
  // Zur Liste hinzufügen und auswählen
  if (newId) {
    if (!window._bkSerien) window._bkSerien = [];
    window._bkSerien.push({ id: newId, name: name });
    bkSerieSetById(newId);
  }
  notify('Regelmäßige Veranstaltung "' + name + '" angelegt.', 'ok');
}

// ── Orte-Autocomplete ────────────────────────────────────────────────────────

var _bkSelectedOrtId = null;
var _bkOrtSearchTimer = null;

async function _bkLoadOrte() {
  var r = await apiGet('orte?limit=500');
  if (!r || !r.ok) return;
  window._bkOrte = r.data || [];
}

// Sucht einen Ort per Name oder hinterlegtem Alias (Admin → Orte).
// z.B. Alias "Grefrath" → Ort "Grefrath-Oedt"
function _bkOrtFindByNameOrAlias(name) {
  var n = (name || '').toLowerCase().trim();
  if (!n) return null;
  var orte = window._bkOrte || [];
  var oi, ai;
  for (oi = 0; oi < orte.length; oi++) {
    if ((orte[oi].name || '').toLowerCase().trim() === n) return orte[oi];
  }
  for (oi = 0; oi < orte.length; oi++) {
    var al = orte[oi].aliase || [];
    for (ai = 0; ai < al.length; ai++) {
      if ((al[ai] || '').toLowerCase().trim() === n) return orte[oi];
    }
  }
  return null;
}

function _bkAutoSetOrt(name) {
  if (!name) return;
  _bkSelectedOrtId = null;
  var match = _bkOrtFindByNameOrAlias(name);
  var ortEl = document.getElementById('bk-ort');
  // Alias-Treffer: kanonischen Ortsnamen übernehmen
  if (ortEl) ortEl.value = match ? match.name : name;
  if (match) _bkSelectedOrtId = match.id;
}

function _bkOrtNameById(id) {
  var orte = window._bkOrte || [];
  for (var i = 0; i < orte.length; i++) { if (orte[i].id == id) return orte[i].name; }
  return '';
}

function _bkOrtGetOrCreateDropdown() {
  var drop = document.getElementById('bk-ort-dropdown');
  if (!drop) {
    drop = document.createElement('div');
    drop.id = 'bk-ort-dropdown';
    drop.style.cssText = 'display:none;position:fixed;background:var(--surface);border:1px solid var(--border);border-radius:8px;z-index:9999;max-height:280px;overflow-y:auto;box-shadow:0 4px 16px rgba(0,0,0,.22)';
    document.body.appendChild(drop);
  }
  return drop;
}

function bkOrtSearch(val) {
  clearTimeout(_bkOrtSearchTimer);
  _bkOrtSearchTimer = setTimeout(function() {
    var inp = document.getElementById('bk-ort');
    if (!inp) return;
    var drop = _bkOrtGetOrCreateDropdown();
    var q = (val || '').toLowerCase().trim();
    if (_bkSelectedOrtId !== null && inp.value !== _bkOrtNameById(_bkSelectedOrtId)) _bkSelectedOrtId = null;
    var orte = window._bkOrte || [];
    var filtered = q ? orte.filter(function(o) {
      return (o.name || '').toLowerCase().indexOf(q) >= 0 ||
             (o.region && o.region.toLowerCase().indexOf(q) >= 0) ||
             (o.aliase || []).some(function(a) { return (a || '').toLowerCase().indexOf(q) >= 0; });
    }) : orte;
    filtered = filtered.slice(0, 25);
    var html = filtered.map(function(o, i) {
      var extra = o.region ? ' (' + o.region + (o.land_code ? ', ' + o.land_code : '') + ')' : (o.land_code ? ' (' + o.land_code + ')' : '');
      var aliasHit = q ? (o.aliase || []).filter(function(a) { return (a || '').toLowerCase().indexOf(q) >= 0; }) : [];
      if (aliasHit.length && (o.name || '').toLowerCase().indexOf(q) < 0) extra += ' · Alias: ' + aliasHit.join(', ');
      return '<div style="padding:8px 12px;font-size:13px;cursor:pointer;border-bottom:1px solid var(--border)"' +
        ' onmousedown="bkOrtSelectIdx(' + i + ')"' +
        ' onmouseover="this.style.background=\'var(--surf2)\'" onmouseout="this.style.background=\'\'">' +
        (o.name || '').replace(/&/g,'&amp;').replace(/</g,'&lt;') +
        (extra ? '<span style="color:var(--text2);font-size:11px"> ' + extra.replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</span>' : '') +
        '</div>';
    }).join('');
    html += '<div style="padding:8px 12px;font-size:13px;cursor:pointer;color:var(--accent)"' +
      ' onmousedown="bkOrtNeu()"' +
      ' onmouseover="this.style.background=\'var(--surf2)\'" onmouseout="this.style.background=\'\'">' +
      '&#xFF0B; Neuer Ort&hellip;</div>';
    drop.innerHTML = html;
    drop._filteredOrte = filtered;
    var rect = inp.getBoundingClientRect();
    drop.style.left  = rect.left + 'px';
    drop.style.top   = (rect.bottom + 2) + 'px';
    drop.style.width = rect.width + 'px';
    drop.style.display = '';
  }, 150);
}

function bkOrtSelectIdx(i) {
  var drop = document.getElementById('bk-ort-dropdown');
  var o = drop && drop._filteredOrte && drop._filteredOrte[i];
  if (!o) return;
  _bkSelectedOrtId = o.id;
  var inp = document.getElementById('bk-ort');
  if (inp) inp.value = o.name;
  bkOrtHideDropdown();
}

function bkOrtHideDropdown() {
  var drop = document.getElementById('bk-ort-dropdown');
  if (drop) drop.style.display = 'none';
}

function bkOrtNeu() {
  bkOrtHideDropdown();
  var curName = ((document.getElementById('bk-ort') || {}).value || '').trim();
  showModal(
    modalH2('&#x1F4CD; Neuer Ort') +
    '<div class="form-group full" style="margin-bottom:16px">' +
      '<label>Name *</label>' +
      '<input type="text" id="bk-neuer-ort-name" value="' + curName.replace(/"/g,'&quot;') + '" placeholder="z.B. Düsseldorf" autofocus style="width:100%;padding:9px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text)"/>' +
    '</div>' +
    '<div class="modal-actions">' +
      '<button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button>' +
      '<button class="btn btn-primary" onclick="bkNeuerOrtAnlegen()">Anlegen &amp; auswählen</button>' +
    '</div>'
  );
  setTimeout(function() {
    var inp = document.getElementById('bk-neuer-ort-name');
    if (inp) inp.focus();
  }, 50);
}

async function bkNeuerOrtAnlegen() {
  var name = ((document.getElementById('bk-neuer-ort-name') || {}).value || '').trim();
  if (!name) { notify('Name erforderlich.', 'err'); return; }
  var r = await apiPost('orte', { name: name });
  if (!r || !r.ok) { notify('Fehler: ' + (r && r.fehler || '?'), 'err'); return; }
  var newOrt = r.data;
  closeModal();
  if (!window._bkOrte) window._bkOrte = [];
  window._bkOrte.push(newOrt);
  window._bkOrte.sort(function(a, b) { return (a.name||'').localeCompare(b.name||''); });
  _bkSelectedOrtId = newOrt.id;
  var inp = document.getElementById('bk-ort');
  if (inp) inp.value = newOrt.name;
  notify('Ort „' + newOrt.name + '“ angelegt.', 'ok');
}

function bkKatChanged() {
  var kat = (document.getElementById('bk-kat') || {}).value || '';
  document.querySelectorAll('#bulk-rows .bk-disz').forEach(function(sel) {
    var prev = sel.value;
    var prevMid = sel.getAttribute('data-mid') || '';
    sel.innerHTML = bkDiszOpts(kat);
    // Erst per data-mid (exakte mapping_id), dann per prev value
    var _restored = false;
    if (prevMid) { for (var i = 0; i < sel.options.length; i++) { if (String(sel.options[i].value) === String(prevMid)) { sel.value = sel.options[i].value; _restored = true; break; } } }
    if (!_restored && prev) { for (var i = 0; i < sel.options.length; i++) { if (sel.options[i].value === prev) { sel.value = prev; break; } } }
    bkSyncDiszDisplay(sel.closest('tr'));
  });
}

// Pace berechnen: Disziplin-Name → Distanz in km → min:sec/km
// Liefert die Streckenlänge in km anhand mapping_id (bevorzugt) oder Disziplin-Name.
// Nutzt ausschließlich den konfigurierten distanz-Wert aus state.disziplinen –
// kein Regex-Parsing des Namens.
function diszKm(disz, mappingId) {
  var disziplinen = (state && state.disziplinen) || [];
  // 1. Prio: exakte Suche per mapping_id
  if (mappingId) {
    var dById = disziplinen.find(function(d) { return d.id == mappingId; });
    if (dById && dById.distanz) return dById.distanz / 1000;
  }
  // 2. Suche per Disziplin-Name
  if (disz) {
    var dByName = disziplinen.find(function(d) { return d.disziplin === disz; });
    if (dByName && dByName.distanz) return dByName.distanz / 1000;
  }
  return 0;
}

function calcPace(disz, resultat, mappingId) {
  if (!resultat) return '';
  resultat = dbRes(resultat); // Komma→Punkt für Berechnung
  var km = diszKm(disz, mappingId);
  if (km < 1) return ''; // unter 1 km keine Pace
  // Zeit in Sekunden
  var secs = 0;
  var parts = resultat.split(':');
  if (parts.length === 3) secs = parseInt(parts[0])*3600 + parseInt(parts[1])*60 + parseFloat(parts[2]);
  else if (parts.length === 2) secs = parseInt(parts[0])*60 + parseFloat(parts[1]);
  else secs = parseFloat(resultat);
  if (!secs) return '';
  var paceS = secs / km;
  var pm = Math.floor(paceS / 60);
  var ps = Math.round(paceS % 60);
  if (ps === 60) { pm++; ps = 0; }
  return pm + ':' + (ps < 10 ? '0' : '') + ps;
}

function bulkRowHtml(idx) {
  var fld = 'box-sizing:border-box;height:34px;padding:6px 10px;border:1.5px solid var(--border);border-radius:7px;background:var(--surf2);color:var(--text);font-family:Barlow,sans-serif;font-size:13px;outline:none;width:100%';
  var kat = (document.getElementById('bk-kat')||{}).value||'';
  return '<tr id="bkrow-' + idx + '" style="border-bottom:1px solid var(--border)">' +
    '<td style="padding:6px;color:var(--text2);font-size:12px">' + (idx+1) + '</td>' +
    '<td style="padding:4px 6px">' +
      '<input type="hidden" class="bk-athlet">' +
      '<input type="text" class="bk-athlet-search" placeholder="Athlet suchen…" autocomplete="off" style="' + fld + '"' +
        ' oninput="bkRowAthletSearch(this)" onfocus="bkRowAthletSearch(this)" onblur="setTimeout(bkRowHideDropdown,200)">' +
    '</td>' +
    '<td style="padding:4px 6px">' +
      '<select class="bk-disz" style="display:none">' + bkDiszOpts(kat) + '</select>' +
      '<input type="text" class="bk-disz-search" placeholder="Disziplin suchen…" autocomplete="off" style="' + fld + '"' +
        ' oninput="bkRowDiszSearch(this)" onfocus="bkRowDiszSearch(this)" onblur="setTimeout(bkRowHideDropdown,200)">' +
    '</td>' +
    '<td style="padding:4px 6px"><input class="bk-res" type="text" placeholder="00:45:00" style="' + fld + '"/></td>' +
    '<td style="padding:4px 6px"><input type="text" class="bk-ak" id="bk-ak-' + idx + '" placeholder="z.B. M45" maxlength="8" style="' + fld + '"/></td>' +
    '<td style="padding:4px 6px"><input class="bk-platz" type="number" placeholder="1" min="1" style="' + fld + '"/>' +
      // Zusatzfelder aus dem Import (nicht editierbar, werden mitgespeichert)
      '<input type="hidden" class="bk-startnr"><input type="hidden" class="bk-pos-ges"><input type="hidden" class="bk-pos-mw"></td>' +
    '<td class="bk-mstr" style="padding:4px 6px;display:none">' +
      '<select class="bk-mstr-sel" style="' + fld + '">' + mstrOptions(0) + '</select>' +
    '</td>' +
    '<td class="bk-mstr" style="padding:4px 6px;display:none">' +
      '<input type="number" class="bk-mstr-platz" min="1" placeholder="Platz" style="' + fld + ';width:80px">' +
    '</td>' +
    '<td style="padding:4px 6px"><input class="bk-zeilendatum" type="text" placeholder="TT.MM.JJJJ" style="' + fld + ';min-width:110px" title="Datum dieser Zeile (überschreibt globales Datum)"/></td>' +
    '<td style="padding:4px 6px">' +
      '<input type="text" class="bk-verein" value="' + ((appConfig && appConfig.verein_name) || '').replace(/"/g, '&quot;') + '" title="Vereinsname: leer oder anderer Verein → externes Ergebnis" style="' + fld + ';min-width:100px"/>' +
    '</td>' +
    '<td style="padding:4px 6px;text-align:center"><button onclick="bulkRemoveRow(' + idx + ')" style="background:none;border:none;cursor:pointer;color:var(--text2);font-size:16px;padding:2px 4px" title="Zeile entfernen">&#x1F5D1;&#xFE0F;</button></td>' +
  '</tr>';
}

var _bulkRowCount = 0;
// Jahrgang + Geschlecht einer Zeile: bevorzugt aus dem Athletenstammsatz,
// ersatzweise aus dem Import (viele Athleten haben keinen Jahrgang hinterlegt)
function _bkRowGebjG(tr) {
  var athSel = tr ? tr.querySelector('.bk-athlet') : null;
  var akInp  = tr ? tr.querySelector('.bk-ak')     : null;
  return {
    g:    (athSel && athSel.dataset.g)    || (akInp && akInp.dataset.importG)    || '',
    gebj: (athSel && athSel.dataset.gebj) || (akInp && akInp.dataset.importJahr) || ''
  };
}

function bkUpdateAK(athHidden, idx) {
  var akInp = document.getElementById('bk-ak-' + idx);
  if (!akInp) return;
  var _gg  = _bkRowGebjG(akInp.closest('tr'));
  var g    = (athHidden && athHidden.dataset.g)    || _gg.g    || '';
  var gebj = (athHidden && athHidden.dataset.gebj) || _gg.gebj || '';
  if (g && gebj) {
    var datEl = document.getElementById('bk-datum');
    var hasDatum = datEl && datEl.value;
    if (hasDatum) {
      // Datum bekannt → DLV-AK berechnen und setzen
      var eventJahr = _bkEventJahr();
      var ak = calcDlvAK(parseInt(gebj), g, eventJahr);
      if (ak) { akInp.value = ak; return; }
    }
    // Kein Datum → AK nicht überschreiben (Website-AK oder manueller Wert bleibt)
  }
}

function _bkEventJahr() {
  // Datum aus "neue Veranstaltung"-Formular oder heutigem Jahr
  if (_bkVeranstModus === 'best') {
    if (_bkSelectedVeranst && _bkSelectedVeranst.datum) return parseInt(_bkSelectedVeranst.datum.substring(0, 4));
  }
  var datEl = document.getElementById('bk-datum');
  if (datEl && datEl.value) return parseInt(datEl.value.substring(0, 4));
  return new Date().getFullYear();
}
function bulkAddRow() {
  var tbody = document.getElementById('bulk-rows');
  if (!tbody) return;
  var div = document.createElement('tbody');
  div.innerHTML = bulkRowHtml(_bulkRowCount);
  var newRow = div.firstChild;
  tbody.appendChild(newRow);
  // Meisterschafts-Spalten: Sichtbarkeit der Kopfzeile übernehmen, sonst hätte
  // die neue Zeile zwei Zellen weniger als die Tabelle Spalten hat
  var _mstrTh = document.querySelector('.bk-mstr-th');
  if (_mstrTh && _mstrTh.style.display !== 'none') {
    newRow.querySelectorAll('.bk-mstr').forEach(function(td) { td.style.display = ''; });
  }
  // Zeilen-Datum aus globalem Datum vorausfüllen (TT.MM.JJJJ)
  var gd = (document.getElementById('bk-datum') || {}).value || '';
  if (gd) {
    var zdEl = newRow.querySelector('.bk-zeilendatum');
    if (zdEl && !zdEl.value) {
      var m = gd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      zdEl.value = m ? m[3] + '.' + m[2] + '.' + m[1] : gd;
    }
  }
  _bulkRowCount++;
}
function bulkRemoveRow(idx) {
  var row = document.getElementById('bkrow-' + idx);
  if (row) row.parentNode.removeChild(row);
}

async function bulkSubmit() {
  var datum, ort, evname, veranstId;

  if (_bkVeranstModus === 'best') {
    if (!_bkSelectedVeranst) { notify('Bitte eine Veranstaltung w&auml;hlen!', 'err'); return; }
    veranstId = _bkSelectedVeranst.id;
    datum  = _bkSelectedVeranst.datum   || '';
    ort    = _bkSelectedVeranst.ort     || '';
    evname = _bkSelectedVeranst.kuerzel || '';
  } else {
    var _globalDatum = (document.getElementById('bk-datum') || {}).value;
    datum  = _globalDatum;
    ort    = ((document.getElementById('bk-ort') || {}).value || '').trim();
    evname = ((document.getElementById('bk-evname') || {}).value || '').trim();
    if (!datum || !ort) { notify('Datum und Ort sind Pflichtfelder!', 'err'); return; }
    veranstId = null;
    var _ortId = _bkSelectedOrtId || null;
  }

  var rows = document.querySelectorAll('#bulk-rows tr');
  var items = [];
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var athlet_id = row.querySelector('.bk-athlet') ? row.querySelector('.bk-athlet').value : '';
    var _diszVal  = row.querySelector('.bk-disz') ? row.querySelector('.bk-disz').value.trim() : '';
    // Value ist mapping_id (numerisch) oder Disziplin-Name
    var _diszMid  = /^\d+$/.test(_diszVal) ? parseInt(_diszVal) : null;
    var _diszObj  = _diszMid ? (state.disziplinen||[]).find(function(d){return (d.id||d.mapping_id)==_diszMid;}) : null;
    var disziplin = _diszObj ? _diszObj.disziplin : _diszVal;
    var resultat  = row.querySelector('.bk-res')    ? row.querySelector('.bk-res').value.trim()   : '';
    if (!athlet_id && !disziplin && !resultat) continue; // leere Zeile
    items.push({
      datum: (function() {
        var zd = row.querySelector('.bk-zeilendatum') ? row.querySelector('.bk-zeilendatum').value.trim() : '';
        if (!zd) return datum;
        var m = zd.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
        if (m) { var y = parseInt(m[3]); if (y < 100) y += 2000; return y + '-' + m[2].padStart(2,'0') + '-' + m[1].padStart(2,'0'); }
        return zd;
      })(),
      meisterschaft: (function(){ var s=row.querySelector('.bk-mstr-sel'); return s&&s.value?parseInt(s.value)||null:null; })(),
      ak_platz_meisterschaft: (function(){ var s=row.querySelector('.bk-mstr-platz'); return s&&s.value?parseInt(s.value)||null:null; })(),
      ort: ort, ort_id: (typeof _ortId !== 'undefined' ? _ortId : null), veranstaltung_name: evname,
      datenquelle: ((document.getElementById('bk-quelle') || {}).value || '') || null,
      veranstaltung_id: veranstId ? parseInt(veranstId) : null,
      serie_id: _bkSelectedSerie ? parseInt(_bkSelectedSerie.id) : null,
      athlet_id: parseInt(athlet_id) || null,
      disziplin: disziplin, disziplin_mapping_id: _diszMid || null, resultat: dbRes(resultat),
      altersklasse: row.querySelector('.bk-ak') ? row.querySelector('.bk-ak').value.trim() : '',
      _zeilendatum: row.querySelector('.bk-zeilendatum') ? row.querySelector('.bk-zeilendatum').value.trim() : '',
      ak_platzierung: row.querySelector('.bk-platz') && row.querySelector('.bk-platz').value ? parseInt(row.querySelector('.bk-platz').value) : null,
      startnummer:    (function(){ var e = row.querySelector('.bk-startnr'); return e && e.value ? e.value : null; })(),
      pos_gesamt:     (function(){ var e = row.querySelector('.bk-pos-ges'); return e && e.value ? (parseInt(e.value) || null) : null; })(),
      pos_geschlecht: (function(){ var e = row.querySelector('.bk-pos-mw');  return e && e.value ? (parseInt(e.value) || null) : null; })(),
      verein: (function(){ var v = row.querySelector('.bk-verein'); return v ? v.value.trim() : ''; })(),
      extern: (function(){ var v = row.querySelector('.bk-verein'); var val = v ? v.value.trim() : ''; var club = (appConfig && appConfig.verein_name) || ''; return !val || val.toLowerCase() !== club.toLowerCase(); })(),
    });
  }
  if (!items.length) { notify('Keine Eintr&auml;ge zum Speichern!', 'err'); return; }

  // Unbekannte AKs prüfen und Dialog anzeigen (wie im RaceResult-Import)
  var _unknownAKs = {};
  items.forEach(function(it) {
    if (it.altersklasse && !isValidDlvAK(it.altersklasse)) {
      _unknownAKs[it.altersklasse] = null;
    }
  });
  if (Object.keys(_unknownAKs).length > 0) {
    var _akResolved = await rrUnknownAKModal(_unknownAKs);
    if (!_akResolved) return; // Abgebrochen
    // Aufgelöste AKs in items übernehmen
    items.forEach(function(it) {
      if (it.altersklasse && _akResolved[it.altersklasse] !== undefined) {
        it.altersklasse = _akResolved[it.altersklasse] || it.altersklasse;
      }
    });
  }

  document.getElementById('bulk-status').innerHTML = '&#x23F3; Speichert ' + items.length + ' Eintr&auml;ge&hellip;';
  var r = await apiPost('ergebnisse/bulk', { items: items });
  if (r && r.ok) {
    var msg = r.data.imported + ' gespeichert';
    if (r.data.skipped) msg += ', ' + r.data.skipped + ' &uuml;bersprungen';
    notify(msg, 'ok');
    if (r.data.errors && r.data.errors.length) console.warn('Bulk-Fehler:', r.data.errors);
    // Alle Formulare zurücksetzen, nur Statusmeldung bleibt
    var _savedMsg = '&#x2705; ' + msg;
    renderEintragen();
    var _st = document.getElementById('bulk-status');
    if (_st) _st.innerHTML = _savedMsg;
    // Nav-Badge „offene Wettkämpfe" neu berechnen (gerade erfasste fallen ggf. weg)
    if (typeof _ladeEintragenBadge === 'function') _ladeEintragenBadge(true);
  } else {
    notify((r && r.fehler) ? r.fehler : 'Fehler', 'err');
    document.getElementById('bulk-status').innerHTML = '';
  }
}

// ── URL-Erkennung ───────────────────────────────────────────────────────────

// ── Debug-Helfer für Bulk-Import ─────────────────────────────────────────────
var _bkDbgLines = [];

function _bkDbgFlush() {
  var wrap = document.getElementById('bk-import-debug-wrap');
  var pre  = document.getElementById('bk-import-debug');
  if (wrap) { wrap.style.display = ''; wrap.open = true; }
  if (pre)  pre.textContent = _bkDbgLines.join('\n');
}
function _bkDbgLine(label, val) {
  _bkDbgLines.push((label + ':').padEnd(16, ' ') + (val !== undefined ? val : ''));
  _bkDbgFlush();
}
// Bereinigt Veranstaltungsnamen: entfernt trailing Jahr und ggf. freistehenden Ortsname davor
function _cleanEventName(name) {
  if (!name) return name;
  name = name.trim();
  var m = name.match(/^(.*?)\s+(\d{4})$/);
  if (!m) return name;
  var withoutYear = m[1].trim();
  // Freistehenden Ortsnamen (einzelnes Wort, Großbuchstabe, nur Buchstaben) direkt vor dem Jahr entfernen
  // Nur einfache Ortsnamen entfernen (kein Bindestrich, keine Event-Begriffe wie -lauf, -run etc.)
  var cityM = withoutYear.match(/^([\s\S]*\S)\s+([A-ZÄÖÜ][a-zäöüß]+)$/);
  if (cityM && cityM[1].length > 0 && !/lauf|run|race|trail|marathon/i.test(cityM[2])) {
    return cityM[1].trim();
  }
  return withoutYear;
}

function _bkDbgHeader(title) {
  var s = '\u2500\u2500 ' + title + ' ';
  while (s.length < 52) { s += '\u2500'; }
  _bkDbgLines.push(s);
  _bkDbgFlush();
}
function _bkDbgSep() {
  _bkDbgLines.push('');
  _bkDbgFlush();
}
function _bkDebugInit(url, quelle, kat) {
  _bkDbgLines = [];
  var now   = new Date();
  var p2    = function(n) { return String(n).padStart(2, '0'); };
  var zeit  = p2(now.getDate()) + '.' + p2(now.getMonth() + 1) + '.' + now.getFullYear() +
              '  ' + p2(now.getHours()) + ':' + p2(now.getMinutes()) + ':' + p2(now.getSeconds());
  var ver   = ((document.getElementById('header-version') || {}).textContent || '?').replace(/^v/, 'v');
  var club  = (appConfig && (appConfig.verein_name || appConfig.verein_kuerzel)) || '?';
  var sep   = '';
  for (var si = 0; si < 52; si++) { sep += '\u2550'; }
  _bkDbgLines.push(sep);
  _bkDbgLine('App',       ver + '  |  ' + club);
  _bkDbgLine('Zeit',      zeit);
  _bkDbgLine('URL',       url || '\u2013');
  _bkDbgLine('Quelle',    quelle || '\u2013');
  _bkDbgLine('Kategorie', kat || '\u2013');
  _bkDbgLines.push(sep);
  _bkDbgLines.push('');
  _bkDbgFlush();
}

function bulkDetectUrl(text) {
  var t = text.trim();
  if (/^https?:\/\/my\.raceresult\.com\//i.test(t))   return 'raceresult';
  if (/^https?:\/\/[^\/]*\.mikatiming\.(com|de|net)/i.test(t)) return 'mikatiming';
  if (/^https?:\/\/uitslagen\.nl\//i.test(t))          return 'uitslagen';
  if (/^https?:\/\/evenementen\.uitslagen\.nl\//i.test(t)) return 'evenementen';
  if (/^https?:\/\/ergebnisse\.leichtathletik\.de\//i.test(t)) return 'leichtathletik';
  if (/^https?:\/\/(www\.)?acn-timing\.com/i.test(t)) return 'acn';
  // maxfunsports.com: nur Copy-&-Paste (Cloudflare-Challenge blockt jeden Abruf).
  // Muss vor dem generischen /result|timing/-Fallback stehen, sonst greift RaceResult.
  if (MFS_URL_RE.test(t)) return 'maxfun';
  if (/^https?:\/\/.+\.pdf(\?[^#]*)?$/i.test(t))      return 'pdf';
  // RaceResult White-Label (eigene Domain, aber RRPublish): /{id}/results oder RR-Hash #N_HEX
  // z.B. https://portal.run-timing.de/977/results#8_D13BA9 → echte RR-Event-ID wird serverseitig aufgelöst
  if (/^https?:\/\//i.test(t) && (/\/\d+\/results\b/i.test(t) || /#\d+_[0-9A-Fa-f]{4,}/.test(t))) return 'raceresult';
  // Seltec/Track&Field HTML-Export (ältere Darstellung als .htm/.html-Datei)
  if (/^https?:\/\/.+\.html?(\?[^#]*)?$/i.test(t))    return 'html';
  // Letzter Fallback: unbekannte Domain mit "Ergebnis/Result/Timing/Anmeldung/Register"-
  // typischem Namen → serverseitig auf RaceResult-White-Label (RRPublish/RRRegStart im
  // Quelltext) prüfen lassen. z.B. cologne-timing.de/ergebnisse/eschweiler-2026 → RR-Event
  // 402257, oder frielingsdorf-datenservice.de/anmeldung/... → RR-Event 367288 (weder
  // /{id}/results-Pfad noch #Hash in der URL, daher ohne diesen Fallback nicht erkennbar).
  // Falscher Verdacht ist ungefährlich: der Proxy meldet einfach "keine Event-ID gefunden".
  if (/^https?:\/\//i.test(t) && /(ergebnis|result|timing|anmeldung|register)/i.test(t)) return 'raceresult';
  return null;
}

function bulkPasteInput() {
  var raw = ((document.getElementById('bk-paste-area') || {}).value || '').trim();
  var katWrap = document.getElementById('bk-import-kat-wrap');
  var srcLabel = document.getElementById('bk-import-source-label');
  var statusEl = document.getElementById('bk-import-status');
  if (!katWrap) return;
  var urlType = bulkDetectUrl(raw);
  if (urlType) {
    katWrap.style.display = 'flex';
    var srcText = urlType === 'raceresult'      ? '🌍︎ RaceResult' :
                  urlType === 'mikatiming'      ? '⌛︎ MikaTiming' :
                  urlType === 'leichtathletik'  ? '🏃︎ leichtathletik.de' :
                  urlType === 'acn'             ? '🇳🇱 ACN Timing' :
                  urlType === 'maxfun'          ? '⛰︎ MaxFun Sports (nur Einfügen)' :
                  urlType === 'evenementen'     ? '🇳🇱 evenementen.uitslagen.nl' :
                  urlType === 'pdf'             ? '📄 Ergebnis-PDF (URL)' :
                  urlType === 'html'            ? '📄 Seltec HTML-Ergebnisse (URL)' : '🇳🇱 uitslagen.nl';
    if (srcLabel) srcLabel.textContent = srcText;
    if (statusEl) statusEl.textContent = '';
  } else if (typeof mfsIstPaste === 'function' && mfsIstPaste(raw)) {
    // Eingefuegte MaxFun-Ergebnistabelle: Kategorie-Auswahl anbieten (fuer die Disziplin)
    katWrap.style.display = 'flex';
    if (srcLabel) srcLabel.textContent = '⛰︎ MaxFun Sports (eingefügte Tabelle)';
    if (statusEl) statusEl.textContent = '';
  } else {
    katWrap.style.display = 'none';
    if (srcLabel) srcLabel.textContent = '';
    if (statusEl) statusEl.textContent = '';
  }
}

function bulkImportKatChanged() {
  var kat = (document.getElementById('bk-import-kat') || {}).value || '';
  var katEl = document.getElementById('bk-kat');
  if (katEl && kat) { katEl.value = kat; bkKatChanged(); }
}

async function bulkImportUrl() {
  var raw = ((document.getElementById('bk-paste-area') || {}).value || '').trim();
  var kat = ((document.getElementById('bk-import-kat') || {}).value || '').trim();
  var statusEl = document.getElementById('bk-import-status');
  var urlType = bulkDetectUrl(raw);
  if (!urlType) return;

  // PDF-/HTML-URL: kein Kat-Selector erforderlich – direkt über Proxy laden
  if (urlType === 'pdf' || urlType === 'html') {
    var _istHtml = urlType === 'html';
    window._bkLastImportUrl = raw;
    var einlesenBtn = document.getElementById('bk-einlesen-btn');
    if (einlesenBtn) einlesenBtn.style.display = 'none';
    if (statusEl) { statusEl.style.display = 'inline-flex'; statusEl.textContent = _istHtml ? '⏳ Lade Ergebnisseite…' : '⏳ Lade PDF…'; }
    var _quelleElPdf = document.getElementById('bk-quelle');
    if (_quelleElPdf && !_quelleElPdf.value) _quelleElPdf.value = raw;
    _bkDebugInit(raw, _istHtml ? 'Seltec HTML (URL)' : 'Ergebnis-PDF (URL)', '');
    try {
      if (_istHtml) await bulkImportFromSeltecHtmlUrl(raw, statusEl);
      else          await bulkImportFromSeltecPdfUrl(raw, statusEl);
    } catch(e) {
      if (statusEl) statusEl.textContent = '❌ ' + e.message;
    } finally {
      if (einlesenBtn) einlesenBtn.style.display = '';
    }
    return;
  }

  // MaxFun Sports laesst sich nicht abrufen (Cloudflare Managed Challenge + robots.txt).
  // Statt eines fehlschlagenden Ladeversuchs die Copy-&-Paste-Anleitung zeigen.
  if (urlType === 'maxfun') {
    bulkMaxFunHinweis(raw);
    return;
  }

  if (!kat) return;

  // Einlesen-Button ausblenden, Status-Button anzeigen
  window._bkLastImportUrl = raw; // für "Schlechten Import melden"
  var einlesenBtn = document.getElementById('bk-einlesen-btn');
  if (einlesenBtn) einlesenBtn.style.display = 'none';
  if (statusEl) {
    statusEl.style.display = 'inline-flex';
    statusEl.textContent = '⏳ Lade…';
  }
  var _bkQuelle = urlType === 'raceresult'     ? 'RaceResult' :
                  urlType === 'mikatiming'     ? 'MikaTiming' :
                  urlType === 'leichtathletik' ? 'leichtathletik.de' :
                  urlType === 'acn'            ? 'ACN Timing' :
                  urlType === 'evenementen'    ? 'evenementen.uitslagen.nl' : 'uitslagen.nl';

  // Datenquelle-Feld mit der eingelesenen URL vorbelegen
  var _quelleEl = document.getElementById('bk-quelle');
  if (_quelleEl && !_quelleEl.value) _quelleEl.value = raw;
  // Importkategorie in bk-kat setzen + Disziplin-Dropdowns aktualisieren
  var _bkKatEl = document.getElementById('bk-kat');
  if (_bkKatEl && kat) { _bkKatEl.value = kat; bkKatChanged(); }
  _bkDebugInit(raw, _bkQuelle, kat);

  try {
    if (urlType === 'raceresult') {
      await bulkImportFromRR(raw, kat, statusEl);
    } else if (urlType === 'leichtathletik') {
      await bulkImportFromLA(raw, kat, statusEl);
    } else if (urlType === 'mikatiming') {
      await bulkImportFromMika(raw, kat, statusEl);
    } else if (urlType === 'uitslagen') {
      await bulkImportFromUits(raw, kat, statusEl);
    } else if (urlType === 'evenementen') {
      await bulkImportFromEvenementenUits(raw, kat, statusEl);
    } else if (urlType === 'acn') {
      await bulkImportFromAcn(raw, kat, statusEl);
    }
  } catch(e) {
    if (statusEl) statusEl.textContent = '❌ ' + e.message;
  } finally {
    // Einlesen-Button wieder einblenden
    if (einlesenBtn) einlesenBtn.style.display = '';
  }
}

// ── RR → Bulk ────────────────────────────────────────────────────────────────────────────
async function bulkImportFromRR(url, kat, statusEl) {
  var eid = null;
  var _eidM = url.match(/raceresult\.com\/(\d+)/i);
  if (_eidM) {
    eid = _eidM[1];
  } else {
    // White-Label-Domain (z.B. portal.run-timing.de): echte RaceResult-Event-ID
    // serverseitig aus dem RRPublish(...)-Aufruf im Seitenquelltext aufl\u00f6sen
    if (statusEl) statusEl.textContent = '\u23f3 L\u00f6se RaceResult-Event-ID auf\u2026';
    try {
      var _pr = await apiGet('rr-fetch?proxy_url=' + encodeURIComponent(url));
      if (_pr && _pr.ok && _pr.data && _pr.data.event_id) eid = String(_pr.data.event_id);
      else if (_pr && _pr.data && _pr.data.debug) {
        var _dbg = _pr.data.debug;
        _bkDbgLine('Proxy-Fehler', 'HTTP ' + (_dbg.http_status||'?') + ' | L\u00e4nge ' + _dbg.html_len + ' | RRPublish gefunden: ' + (_dbg.has_RRPublish?'ja':'nein'));
        _bkDbgLine('Seiten-Ausschnitt', _dbg.html_sample||'');
      } else if (_pr && !_pr.ok) {
        _bkDbgLine('Proxy-Fehler', _pr.fehler || JSON.stringify(_pr));
      }
    } catch(e) { _bkDbgLine('Proxy-Fehler', 'Exception: ' + e.message); }
  }
  if (!eid) { if (statusEl) statusEl.textContent = '\u274c Keine RaceResult-Event-ID gefunden'; _bkDbgFlush(); return; }
  if (statusEl) statusEl.textContent = '\u23f3 Lade RaceResult-Konfiguration\u2026';

  async function _freshCfg() {
    var c = null, primaryErr = null;
    try {
      var r = await fetch(
        'https://my.raceresult.com/' + eid + '/RRPublish/data/config?lang=de&page=results&noVisitor=1'
      );
      if (r.ok) c = await r.json();
      else primaryErr = 'Config HTTP ' + r.status;
    } catch(e) { primaryErr = 'Config ex: ' + e.message; }

    // /results/config liefert dasselbe Feldformat (key, contests, eventname, ...) +
    // TabConfig.Lists mit den echten, abrufbaren Listennamen. Manche Events liefern
    // an /RRPublish/data/config 404, sind über /results/config aber erreichbar.
    var rt2 = null;
    try {
      var rt = await fetch('https://my.raceresult.com/' + eid + '/results/config?lang=de&noVisitor=1&oldFavs=');
      if (rt.ok) rt2 = await rt.json();
    } catch(e) {}

    if (!c) {
      if (!rt2) throw new Error(primaryErr || 'Config nicht erreichbar');
      c = rt2; // Fallback: /results/config als Haupt-Config verwenden
    }
    if (rt2 && rt2.TabConfig && Array.isArray(rt2.TabConfig.Lists)) c._tabLists = rt2.TabConfig.Lists;
    return c;
  }

  var cfg;
  try { cfg = await _freshCfg(); }
  catch(e) {
    if (statusEl) statusEl.textContent = '\u274c Config-Fehler: ' + e.message;
    _bkDbgLine('Fehler', String(e)); return;
  }

  var eventName  = _rrResolveMultilang(cfg.EventName || cfg.Name || cfg.eventname || '');
  var contestObj = cfg.contests  || cfg.Contests || {};
  // Datum pro Contest-ID aus Config extrahieren
  var contestDateMap = {};
  var contestRaw = cfg.ContestInfo || cfg.contestInfo || cfg.contest_info || {};
  Object.keys(contestRaw).forEach(function(cid) {
    var ci = contestRaw[cid];
    var d = ci.Date || ci.date || ci.EventDate || '';
    if (d) contestDateMap[cid] = d;
  });
  // Alternativ: Contests-Array mit Date-Feld
  var contestsArr = cfg.Contests_arr || cfg.contests_arr || [];
  if (Array.isArray(contestsArr)) {
    contestsArr.forEach(function(c) {
      var cid = String(c.ID || c.id || c.ContestID || '');
      var d = c.Date || c.date || '';
      if (cid && d) contestDateMap[cid] = d;
    });
  }
  var clubPhrase  = (appConfig.verein_kuerzel || appConfig.verein_name || '').toLowerCase().trim();

  _bkDbgHeader('RaceResult');
  _bkDbgLine('Event-ID',  eid);
  _bkDbgLine('Eventname', eventName || '\u2013');
  _bkDbgLine('API-Key',   (cfg.key || '').slice(0, 8) + '\u2026');

  var prxResp = await apiGet('rr-fetch?event_id=' + encodeURIComponent(eid));
  if (prxResp && prxResp.ok && prxResp.data) {
    var pd = prxResp.data;
    var datEl = document.getElementById('bk-datum');
    var evEl  = document.getElementById('bk-evname');
    if (pd.date     && datEl) { datEl.value = pd.date; bkSyncDatum(pd.date); }
    if (pd.location && !((document.getElementById('bk-ort')||{}).value)) _bkAutoSetOrt(pd.location);
    if (eventName   && evEl  && !evEl.value)  evEl.value  = _cleanEventName(eventName);
    _bkDbgLine('Datum', pd.date     || '–');
    _bkDbgLine('Ort',   pd.location || '–');
  }
  if (eventName) {
    var _rrSerie = _bkMatchSerie(eventName);
    if (_rrSerie) {
      bkSerieSetById(_rrSerie.id);
      _bkDbgLine('Serie', _rrSerie.name + ' (auto-erkannt)');
      if (!((document.getElementById('bk-ort')||{}).value) && _rrSerie.ort_letzte) {
        _bkAutoSetOrt(_rrSerie.ort_letzte);
        _bkDbgLine('Ort', _rrSerie.ort_letzte + ' (aus letzter Austragung)');
      }
    }
  }


  var listSource = cfg.list || cfg.lists || {};
  var listArr    = Array.isArray(listSource) ? listSource.slice()
    : Object.keys(listSource).map(function(k) {
        var v = listSource[k]; var c = '0';
        if (typeof v === 'string' || typeof v === 'number') c = String(v);
        else if (v && typeof v === 'object') c = String(v.Contest || v.contest || v.ContestID || v.id || '0');
        return { Name: k, Contest: c };
      });
  // TabConfig.Lists voranstellen: enthält die echten abrufbaren Listennamen
  // (Top-Level "lists" kann veraltete interne Namen liefern). Dedup folgt unten.
  if (Array.isArray(cfg._tabLists) && cfg._tabLists.length) {
    listArr = cfg._tabLists.concat(listArr);
    _bkDbgLine('TabConfig.Lists', cfg._tabLists.map(function(l){return (l.Name||'')+'@'+(l.Contest||'0');}).join(' | ').slice(0,400));
  }

  var _bl = ['STAFF','RELAY','KING','QUEEN','AGGREGATE','OVERALL RANKING',
    'MANNSCHAFT','TEAM RANKING','LIVE','TOP10','TOP 10','LEADERBOARD',
    'SIEGER','WINNER','PARTICIPANTS','STATISTIC','TEILNEHMER','ALPHABET','STADTMEISTER'];
  function _blocked(name) {
    var n = (name||'').toUpperCase();
    if (n.startsWith('Z_')||n.startsWith('__')) return true;
    for (var i=0;i<_bl.length;i++){if(n.indexOf(_bl[i])>=0)return true;}
    return false;
  }

  var _specificContestIds = Object.keys(contestObj).filter(function(k){return k!=='0';});
  var _seen={}, validLists=[];
  for (var li=0;li<listArr.length;li++){
    var le=listArr[li], ln=le.Name||le.name||'', lc=String(le.Contest||le.contest||'0');
    if(!ln||_blocked(ln))continue;
    // Laufserie: *_Serie_* Listen enthalten kumulierte Gesamtzeiten → überspringen
    if(/_serie_/i.test(ln))continue;
    // Ges/MW-Listen: importieren, aber Platz nur wenn kein AK-Platz gesetzt (isAkList-Prio)
    // Erkennt "AK" als eigenständiges Wort, egal ob mit Unterstrich oder Leerzeichen umgeben
    // (z.B. Ergebnisse_AK, Ergebnisliste_AK_Tag_1, "Ergebnisliste AK LVN")
    var _isAkList = /(^|[^a-z])ak([^a-z]|$)/i.test(ln);
    var lkey=ln+'|'+lc;
    if(_seen[lkey])continue;
    _seen[lkey]=true;
    // Tag-Nummer aus Listenname extrahieren (_Tag_1, _Tag_2, _Tag_3)
    var _tagMatch=ln.match(/_Tag_(\d+)/i);
    var _tagNr=_tagMatch?parseInt(_tagMatch[1]):0;
    validLists.push({name:ln,contest:lc,tagNr:_tagNr,isAkList:_isAkList});
  }

  _bkDbgLine('Listen gesamt', listArr.length);
  _bkDbgLine('Davon gepr\u00fcft', validLists.length);
  _bkDbgSep();

  var disziplinen = state.disziplinen||[];
  // Nur Disziplinen der Importkategorie (+ Gruppen-Partner) für die Erkennung zulassen –
  // sonst matcht z.B. ein gleichlautendes "6,6km" aus Straße auf einen Cross-Import,
  // obwohl Cross eine eigene "X.XXXm"-Benennung nutzt (findDiszObj lehnt das später zwar
  // korrekt ab, aber der Rohtext landet dann trotzdem falsch/leer im UI-Feld)
  var _diszKatErlaubt = bkKatMitGruppen(kat);
  var diszList    = disziplinen
    .filter(function(d){return !_diszKatErlaubt||!d.tbl_key||_diszKatErlaubt.indexOf(d.tbl_key)>=0;})
    .map(function(d){return d.disziplin;}).filter(function(v,i,a){return a.indexOf(v)===i;});
  var allResults  = [], listsChecked = 0, _externPayloads = [];
  // /results/list statt /RRPublish/data/list: einige Events sind über den RRPublish-Datenpfad
  // nicht erreichbar (404), obwohl die Website selbst (die intern /results/list nutzt) läuft
  // (z.B. Allgäu Panorama Marathon 413893). /results/list funktioniert für beide Fälle.
  var base        = 'https://my.raceresult.com/' + eid + '/results/list';
  var hdrs        = {'Origin':'https://my.raceresult.com','Referer':'https://my.raceresult.com/'};
  var iName=3,iClub=6,iAK=-1,iZeit=8,iNetto=7,iPlatz=2,iYear=-1,iGeschlecht=-1,iAKPlatz=-1,iFirstname=-1;

  function _cal(df) {
    iAK=-1;iYear=-1;iGeschlecht=-1;iAKPlatz=-1;iName=3;iClub=6;iNetto=-1;iZeit=-1;iPlatz=2;iFirstname=-1;
    var _hnf=false;
    for(var fi=0;fi<df.length;fi++){
      var f=df[fi].toLowerCase();
      if(f.indexOf('anzeigename')>=0||f.indexOf('flname')>=0||f.indexOf('lfname')>=0||f==='displayname'||f==='fullname'||f==='name'||f.indexOf('es_name')>=0){iName=fi;_hnf=true;}
      else if((f.indexOf('lastname')>=0||f.indexOf('nachname')>=0||f.indexOf('surname')>=0)&&!_hnf)iName=fi;
      else if(f.indexOf('firstname')>=0||f.indexOf('vorname')>=0||f==='first')iFirstname=fi;
      else if(f.indexOf('club')>=0||f.indexOf('verein')>=0)iClub=fi;
      // "ZeitMitStatus"/"BruttozeitMitStatus"/"NettozeitMitStatus" → Zeitfeld (vor dem mitstatus-Check!)
      else if(f.indexOf('zeit') >= 0){if(f.indexOf('netto')>=0)iNetto=fi;else iZeit=fi;}
      // "[AKPlp]"/"[AKLVNPlp]"/"[AKMSTRPlp]" – Platzhalter-Name beginnt mit "ak" (regionale/Meisterschafts-
      // Varianten wie AKLVN haben "akpl" nicht als zusammenhängendes Substring, daher zusätzlich "[ak"-Check)
      else if(f.indexOf('autorankp')>=0||f.indexOf('overallrank')>=0||f.indexOf('withstatus')>=0||f.indexOf('mitstatus')>=0||f.indexOf('statusplatz')>=0||f.indexOf('agegrouprank')>=0){if(f.indexOf('akpl')>=0||f.indexOf('[ak')>=0||f.indexOf('agegrouprank')>=0)iAKPlatz=fi;else iPlatz=fi;}
      else if(f.indexOf('akpl')>=0||f.indexOf('[ak')>=0)iAKPlatz=fi;
      else if(/^rank\dp$/.test(f)){if(f==='rank1p')iPlatz=fi;else iAKPlatz=fi;}
      else if((f.indexOf('agegroup')>=0||f==='[agegroup1.nameshort]'||f.indexOf('akabk')>=0||f.indexOf('ak_abk')>=0||f.indexOf('es_akabkürzung')>=0||f.indexOf('agegroupname')>=0)&&f.indexOf('rank')<0)iAK=fi;
      else if(f==='year'||f==='yob'||f==='birthyear'||f.indexOf('es_jahrgang')>=0)iYear=fi;
      else if(f.indexOf('geschlechtmw')>=0||f.indexOf('es_geschlecht')>=0||f==='gendermf'||f==='gender'||f==='sex')iGeschlecht=fi;
      else if(f.indexOf('chip')>=0||f.indexOf('netto')>=0)iNetto=fi;
      else if(f.indexOf('gun')>=0||f.indexOf('brutto')>=0||f==='ziel'||f.indexOf('ziel')>=0||f.indexOf('finish')>=0)iZeit=fi;
      // Fängt auch Formel-Felder wie "choose([STATUS]+1;[TIME1];...)" ab, bei denen
      // "time" nicht am Feldnamen-Anfang steht (RaceResult-Idiom für "Zeit mit Status")
      else if(f.indexOf('time')>=0)iZeit=fi;
    }
    if(_hnf)iFirstname=-1; // Vollname-Feld gefunden → kein separates Vorname-Feld nötig
    if(iNetto>=0&&iZeit<0)iZeit=iNetto;
    if(iNetto<0&&iZeit>=0)iNetto=iZeit;
    if(iNetto>=0&&iNetto===iClub)iNetto=(iZeit>=0&&iZeit!==iClub)?iZeit:-1;
  }

  function _proc(payload, contestName, le, externMode) { le = le || {}; var _cnDLogged = false;
    var _rrMstr = _rrDetectMeisterschaft(contestName, le.name);
    var df=payload.DataFields||[];
    if(Array.isArray(df)&&df.length>0)_cal(df);
    // Debug: DataFields + Namens-Indices beim ersten Extern-Aufruf pro Liste
    if(externMode && !_proc._dfLogged){
      _proc._dfLogged=true;
      _bkDbgLine('DF['+contestName+']','iName='+iName+' iFirst='+iFirstname+' iClub='+iClub+' | '+df.join(', '));
      // Erste 3 Roh-Namen aus den Daten zeigen
      var _dRawE=payload.data||{};
      var _rSamples=[];
      (function _walk(o){if(_rSamples.length>=3||!o||typeof o!=='object')return;if(Array.isArray(o)){if(o.length>0&&Array.isArray(o[0])){o.slice(0,3).forEach(function(r){if(_rSamples.length<3&&Array.isArray(r)&&r.length>iName)_rSamples.push('"'+(r[iName]||'')+(iFirstname>=0?' / '+(r[iFirstname]||''):'')+'" club='+(iClub>=0?r[iClub]:'?')+' zeit='+(r[Math.max(iNetto,iZeit)]||'?'));});}else{o.forEach(function(x){_walk(x);});}}else{Object.values(o).forEach(function(v){_walk(v);});}})(_dRawE);
      if(_rSamples.length)_bkDbgLine('Roh-Namen',_rSamples.join(' | '));
    }
    var dRaw=payload.data||{};
    // Rekursiv beliebig tief verschachtelte Gruppen abarbeiten
    function _walkGroups(obj, path) {
      if (!obj || typeof obj !== 'object') return;
      Object.keys(obj).forEach(function(k) {
        var v = obj[k];
        var gk = (path ? path + '/' + k : k).replace(/^#\d+_/g,'').replace(/\/#\d+_/g,'/');
        if (Array.isArray(v)) {
          // Prüfen ob es ein Array von Rows (flat) oder ein Array von Gruppen ist
          if (v.length > 0 && Array.isArray(v[0])) {
            // v ist ein Array von Row-Arrays → direkt verarbeiten
            _processRows(v, gk);
          } else if (v.length > 0 && typeof v[0] === 'object' && !Array.isArray(v[0])) {
            // Array von Objekten → weiter rekursieren
            v.forEach(function(sub) { _walkGroups(sub, gk); });
          } else if (v.length > 0) {
            // Einzelne Row? Nur wenn length >= 3
            if (v.length >= 3) _processRows([v], gk);
          }
        } else if (v && typeof v === 'object') {
          _walkGroups(v, gk);
        }
      });
    }
    function _processRows(rowsArr, gk) {
      var kClean = gk; // gk enthält bereits den bereinigten Pfad
      var k2 = gk.indexOf('/') >= 0 ? gk.split('/').pop() : gk;
      var k = gk.indexOf('/') >= 0 ? gk.split('/')[0] : gk;
        var akFG='';
        if(iAK<0){
          // AK aus Sub-Gruppen-Key: '#5_Jedermann Frauen' → WHK, '#3_W30' → W30
          var k2clean=k2.replace(/^#\d+_/,'');
          var _m=k2clean.match(/^([MW](?:HK|U\d{1,2}|\d{2}))$/i);
          if(_m){akFG=normalizeAK(_m[1]);}
          else{akFG=normalizeAK(k2clean)||'';}
        }
        // Disziplin-Name: beste Quelle mit Distanz-Treffer wählen
        // Kandidaten-Reihenfolge: contestName, le.name (Listenname, enthält oft Distanz), kClean, gk
        var cnD=(function(){
          var cands=[contestName, le.name||'', kClean, gk].filter(Boolean);
          for(var ci=0;ci<cands.length;ci++){
            if(rrBestDisz(cands[ci],diszList))return cands[ci];
          }
          return contestName||le.name||kClean||gk;
        })();
        var _cnDDisz = rrBestDisz(cnD, diszList);
        if (!_cnDLogged) {
          _bkDbgLines.push('  cnD: "' + cnD + '" → "' + (_cnDDisz||'(keine)') + '"' +
            (cnD !== contestName ? ' [via List: ' + (le.name||'') + ']' : ''));
          _cnDLogged = true;
        }
        rowsArr.forEach(function(row){
          if(!Array.isArray(row)||row.length<3)return;
          var club=iClub>=0?String(row[iClub]||'').trim():'';
          if(!externMode){if(clubPhrase&&club.toLowerCase().indexOf(clubPhrase)<0)return;}
          var rName=String(row[iName]||'').trim().replace(/\s*\(\d{4}\)\s*$/,''); // "(2001)" am Namensende entfernen
          if(iFirstname>=0){var _rFn=String(row[iFirstname]||'').trim();if(_rFn&&rName)rName=rName+', '+_rFn;}
          var rZeit=String(row[iNetto>=0?iNetto:iZeit]||'').trim();
          if(!rZeit||!/\d{1,2}:\d{2}|\d+[,.]\d+/.test(rZeit))return;
          rZeit=fmtRes(rZeit); // Komma als Dezimaltrennzeichen für Anzeige
          var rAK='';
          if(iAK>=0){var ar=String(row[iAK]||'').trim(),as=ar.match(/^(\d+)\.?\s*(.+)$/);if(as)ar=as[2].trim();rAK=normalizeAK(ar);}
          if(!rAK)rAK=akFG;
          var rYear=iYear>=0?parseInt(String(row[iYear]||'').trim())||0:0;
          var rGschl=iGeschlecht>=0?String(row[iGeschlecht]||'').trim():'';
          // Geschlecht aus akFG ableiten wenn rGschl leer
          if(!rGschl&&rAK){rGschl=/^W/i.test(rAK)?'W':/^[MFm]/.test(rAK)?'M':'';}
          // calcDlvAK wenn kein AK oder nur generisches MHK/WHK (kein Jahrgangs-AK)
          var _needCalcAK = !rAK || rAK==='MHK' || rAK==='WHK';
          if(_needCalcAK&&rYear>1900){var ey=parseInt(((document.getElementById('bk-datum')||{}).value||'').slice(0,4))||new Date().getFullYear();var _calc=calcDlvAK(rYear,/^[WwFf]/.test(rGschl)?'W':'M',ey)||'';if(_calc)rAK=_calc;}
          var _pIsAk=iAKPlatz>=0; // Platz stammt aus AK-Platz-Feld (AKPlp) → hat Vorrang vor Gesamt/MW-Platz
          var rP=0,pi=_pIsAk?iAKPlatz:iPlatz;
          if(pi>=0){var pr=String(row[pi]||'').trim().replace(/\.$/,'');if(/^\d+$/.test(pr))rP=parseInt(pr)||0;}
          if(!rName)return;
          // Extern-Modus: Vereinsname darf nicht eigener Verein sein, Name muss bekanntem Athleten entsprechen
          if(externMode){
            if(clubPhrase&&club.toLowerCase().indexOf(clubPhrase)>=0)return;
            if(!uitsAutoMatch(rName,state.athleten||[]))return;
          }
          var disz=rrBestDisz(cnD,diszList);
          var dObj=findDiszObj(disz,kat,disziplinen);
          var _dup=allResults.find(function(r){return r.name===rName&&r.resultat===rZeit;});
          if(_dup){
            // Platz: AK-Platz hat Vorrang (reihenfolge-unabhängig via platzIsAk). Übernehmen wenn
            // noch kein Platz ODER dieser ist ein AK-Platz und der gespeicherte war keiner.
            var _canUpdatePlatz = rP>0 && (_dup.platz===0 || (_pIsAk && !_dup.platzIsAk) || (le && le.isAkList && !_dup.isAkList));
            if(_canUpdatePlatz){_dup.platz=rP; _dup.platzIsAk=_pIsAk; if(le&&le.isAkList)_dup.isAkList=true;}
            // AK übernehmen wenn besser (echter Wert > Punkt/leer)
            var _dupAkOk = _dup.ak && _dup.ak !== '.' && _dup.ak.length > 1;
            if(rAK && rAK !== '.' && rAK.length > 1 && !_dupAkOk) _dup.ak = rAK;
            // Disziplin übernehmen wenn bisher leer (z.B. Allgemein-Gesamtliste vor distanzspez. Liste verarbeitet)
            if(!_dup.disziplin && disz){_dup.disziplin=dObj?dObj.disziplin:disz;_dup.diszMid=dObj?(dObj.id||dObj.mapping_id):null;}
            // Meisterschaft: übernehmen wenn bisher leer; Platz analog zu platzIsAk bevorzugt AK-Quelle
            if(_rrMstr && !_dup.meisterschaft){_dup.meisterschaft=_rrMstr;_dup.mstrPlatz=rP;_dup.mstrPlatzIsAk=_pIsAk;}
            else if(_rrMstr && _dup.meisterschaft && _pIsAk && !_dup.mstrPlatzIsAk){_dup.mstrPlatz=rP;_dup.mstrPlatzIsAk=_pIsAk;}
          } else {
            allResults.push({name:rName,resultat:rZeit,ak:rAK,platz:rP,platzIsAk:_pIsAk,
              disziplin:dObj?dObj.disziplin:disz,diszMid:dObj?(dObj.id||dObj.mapping_id):null,
              year:rYear||'',geschlecht:rGschl||'',
              contestId:String(le ? le.contest : ''),
              contestName:contestName||'',
              tagNr:le ? (le.tagNr||0) : 0,
              isAkList:le ? !!le.isAkList : false,
              extern:externMode?true:false,
              verein:externMode?club:'',
              meisterschaft:_rrMstr||'', mstrPlatz:_rrMstr?rP:0, mstrPlatzIsAk:_rrMstr?_pIsAk:false});
          }
        });
    }
    _walkGroups(dRaw, '');
  }

  var currentKey=cfg.key||'', keyAt=Date.now();

  for(var li=0;li<validLists.length;li++){
    var le=validLists[li];
    var cname=contestObj[le.contest]||le.name;
    if(statusEl)statusEl.textContent='\u23f3 '+(li+1)+'/'+validLists.length+': '+cname+'\u2026';

    // Key > 30s alt: erneuern
    if(Date.now()-keyAt>30000){
      try{var fc=await _freshCfg();currentKey=fc.key||currentKey;keyAt=Date.now();}catch(e){}
    }

    var payload=null; var _dbgSkipReason='';
    // Pipe-Zeichen NICHT url-encodieren – RaceResult erwartet "Online|Final" literal
    var _encName=encodeURIComponent(le.name).replace(/%7C/gi,'|');

    // r=search zuerst
    try{
      var rs=await fetch(base+'?key='+currentKey+'&listname='+_encName+'&page=results&contest='+le.contest+'&r=search&l=9999&term=',{headers:hdrs});
      if(rs.ok){var ps=await rs.json();if(!ps.error&&(ps.DataFields||[]).length>0)payload=ps;else _dbgSkipReason='search: '+(ps.error||'kein DF');}
      else _dbgSkipReason='search HTTP '+rs.status;
    }catch(e){_dbgSkipReason='search ex: '+e.message;}

    // r=all als Fallback
    if(!payload){
      try{
        var ra=await fetch(base+'?key='+currentKey+'&listname='+_encName+'&page=results&contest='+le.contest+'&r=all&l=de&_=1',{headers:hdrs});
        if(ra.ok){
          var pa=await ra.json();
          if(!pa.error)payload=pa;
          else if(pa.error==='key invalid'){
            _dbgSkipReason='key invalid – erneuern…';
            // Key erneuern + sofort nochmal
            try{var fc2=await _freshCfg();currentKey=fc2.key||currentKey;keyAt=Date.now();
              var rr=await fetch(base+'?key='+currentKey+'&listname='+_encName+'&page=results&contest='+le.contest+'&r=all&l=de&_=1',{headers:hdrs});
              if(rr.ok){var pr=await rr.json();if(!pr.error)payload=pr;else _dbgSkipReason='all(retry) err: '+pr.error;}
            }catch(e2){_dbgSkipReason='all retry ex: '+e2.message;}
          } else { _dbgSkipReason+=' | all: '+pa.error; }
        } else { _dbgSkipReason+=' | all HTTP '+ra.status; }
      }catch(e){_dbgSkipReason+=' | all ex: '+e.message;}
    }

    if(!payload){
      // contest=0 → 404: spezifische Contest-IDs einzeln versuchen
      // (Events mit einer einzigen Gesamtliste, gruppiert nach Contest)
      if(le.contest==='0' && _specificContestIds.length>0){
        // Auch Teil nach letztem Pipe versuchen (z.B. "Online|Final" → "Final")
        var _nameParts=[_encName];
        if(le.name.indexOf('|')>=0){var _pip=le.name.split('|');_nameParts.push(encodeURIComponent(_pip[_pip.length-1]));}
        for(var _ci=0;_ci<_specificContestIds.length;_ci++){
          var _cid=_specificContestIds[_ci];
          var _cle=Object.assign({},le,{contest:_cid});
          var _cname2=contestObj[_cid]||cname;
          var _cpayload=null;
          for(var _ni=0;_ni<_nameParts.length&&!_cpayload;_ni++){
            var _nEnc=_nameParts[_ni];
            try{
              var _cr=await fetch(base+'?key='+currentKey+'&listname='+_nEnc+'&page=results&contest='+_cid+'&r=search&l=9999&term=',{headers:hdrs});
              if(_cr.ok){var _cps=await _cr.json();if(!_cps.error&&(_cps.DataFields||[]).length>0)_cpayload=_cps;}
            }catch(e){}
            if(!_cpayload){
              try{
                var _cra=await fetch(base+'?key='+currentKey+'&listname='+_nEnc+'&page=results&contest='+_cid+'&r=all&l=de&_=1',{headers:hdrs});
                if(_cra.ok){var _cpa=await _cra.json();if(!_cpa.error)_cpayload=_cpa;}
              }catch(e){}
            }
          }
          if(_cpayload){
            listsChecked++;
            _externPayloads.push({payload:_cpayload,cname:_cname2,le:_cle});
            _proc(_cpayload,_cname2,_cle);
          }
        }
        if(listsChecked===0)_bkDbgLines.push('  skip: "'+le.name+'" (contest=0+spezifisch → alle 404)');
      } else {
        _bkDbgLines.push('  skip: "'+le.name+'" contest='+le.contest+' → '+_dbgSkipReason);
      }
      continue;
    }
    listsChecked++;
    _externPayloads.push({payload:payload,cname:cname,le:le});
    _proc(payload, cname, le);
  }

  // Fallback: wenn 0 Ergebnisse + Contest=0-Listen + mehrere Contests →
  // erneut mit f=ContestName-Filter (neues RR-API-Format)
  if (allResults.length === 0 && _specificContestIds.length > 0) {
    var _hasContest0List = validLists.some(function(vl){ return vl.contest === '0'; });
    if (_hasContest0List) {
      for (var _fi = 0; _fi < _specificContestIds.length; _fi++) {
        var _fcid = _specificContestIds[_fi];
        var _fname = contestObj[_fcid] || '';
        if (!_fname) continue;
        var _fParam = '&f=' + encodeURIComponent(_fname + '\x0C\x0C<Ignore>');
        for (var _fli = 0; _fli < validLists.length; _fli++) {
          var _fle = validLists[_fli];
          if (_fle.contest !== '0') continue;
          if (statusEl) statusEl.textContent = '\u23f3 Fallback ' + _fname + '\u2026';
          var _fpayload = null;
          try {
            var _frs = await fetch(base+'?key='+currentKey+'&listname='+encodeURIComponent(_fle.name)+'&page=results&contest=0&r=search&l=9999&term='+_fParam, {headers:hdrs});
            if (_frs.ok) { var _fps = await _frs.json(); if (!_fps.error && (_fps.DataFields||[]).length > 0) _fpayload = _fps; }
          } catch(e) {}
          if (!_fpayload) {
            try {
              var _fra = await fetch(base+'?key='+currentKey+'&listname='+encodeURIComponent(_fle.name)+'&page=results&contest=0&r=all&l=de'+_fParam, {headers:hdrs});
              if (_fra.ok) { var _fpa = await _fra.json(); if (!_fpa.error) _fpayload = _fpa; }
            } catch(e) {}
          }
          if (_fpayload) {
            listsChecked++;
            var _prevLen = allResults.length;
            _proc(_fpayload, _fname, _fle);
            // Debug: zeige was der Fallback gefunden hat
            var _newRows = allResults.slice(_prevLen);
            _newRows.forEach(function(r){ _bkDbgLines.push('  [Fallback '+_fname+'] '+r.name+' ak='+r.ak+' year='+r.year); });
          }
        }
      }
    }
  }
  _bkDbgLine('Listen durchsucht', listsChecked);
  _bkDbgLine('Gefunden', allResults.length+' TuS-Eintr\u00e4ge');

  // Extern-Suche: TuS-Athleten die unter anderem Verein gestartet sind
  // L\u00e4uft bei 0 TuS-Treffern ODER wenn "Auch inaktive Athleten" aktiv ist
  if((allResults.length===0 || window._bkMatchInaktive) && _externPayloads.length && (state.athleten||[]).length){
    var _externPre = allResults.length;
    _bkDbgSep();
    _bkDbgLine('Extern-Suche','TuS-Athleten unter anderem Verein\u2026');
    _externPayloads.forEach(function(cp){ _proc(cp.payload,cp.cname,cp.le,true); });
    _bkDbgLine('Extern-Gefunden',(allResults.length-_externPre)+' Eintr\u00e4ge');
  }

  // Post-Dedup: Athlet in Allgemein-Liste als TuS UND in distanzspez. Liste unter anderem Verein
  // \u2192 TuS-Eintrag nur entfernen wenn ein Extern-Eintrag mit IDENTISCHER Zeit existiert (= selber Lauf)
  // Achtung: selber Athlet kann legitim mehrere Strecken laufen (z.B. TuS 10km + extern 5km)!
  (function(){
    var _byName = {};
    allResults.forEach(function(r){ var k=(r.name||'').toLowerCase(); if(!_byName[k])_byName[k]=[];_byName[k].push(r); });
    allResults = allResults.filter(function(r){
      var k=(r.name||'').toLowerCase();
      var g=_byName[k];
      if(g.length>1 && !r.extern) {
        // TuS-Eintrag nur streichen wenn exakt gleiche Zeit extern vorhanden (selber Lauf, anderer Verein)
        return !g.some(function(x){return x.extern && x.resultat===r.resultat;});
      }
      return true;
    });
  })();

  if(allResults.length){
    _bkDbgSep();
    _bkDbgHeader('Ergebnisse');
    for(var _di=0;_di<allResults.length;_di++){
      var _dr=allResults[_di];
      _bkDbgLines.push(String(_di+1).padStart(2,' ')+'.  '+(_dr.name||'?').padEnd(22,' ')+(_dr.ak||'  ').padEnd(6,' ')+(_dr.resultat||'').padEnd(10,' ')+(_dr.platz?'Platz\u00a0'+_dr.platz:'').padEnd(9,' ')+'\u2192 '+(_dr.disziplin||'(keine)'));
    }
    _bkDbgFlush();
  }

  // Tag-Datum-Dialog: wenn mehrere Tag-Nummern vorhanden
  var _tagNrs = {};
  allResults.forEach(function(r){ if(r.tagNr>0) _tagNrs[r.tagNr]=true; });
  var _tagNrList = Object.keys(_tagNrs).map(Number).sort();
  if(_tagNrList.length > 1) {
    var _tagDates = await rrTagDatumDialog(_tagNrList, (document.getElementById('bk-datum')||{}).value||'');
    if(_tagDates === null) { if(statusEl) statusEl.textContent=''; return; }
    allResults.forEach(function(r) {
      if(r.tagNr > 0 && _tagDates[r.tagNr]) r._datumOverride = _tagDates[r.tagNr];
    });
  }
  await bulkFillFromImport(allResults, statusEl);
  // Hinweis-Banner für Disziplinen, die keiner System-Disziplin zugeordnet werden
  // konnten (z.B. "6,6km" existiert noch nicht) – sonst bleibt das Feld stumm leer
  bkRenderUnknownDisz(bkCollectUnknownDisz(), kat);
}

// ── MikaTiming → Bulk ───────────────────────────────────────────────────────
async function bulkImportFromMika(url, kat, statusEl) {
  if (statusEl) statusEl.textContent = '⏳ Lade MikaTiming-Daten…';
  var baseUrl = url.split('?')[0].replace(/\/?$/, '/');
  var vereinRaw = (appConfig.verein_kuerzel || appConfig.verein_name || '').trim();
  var r = await apiGet('mika-fetch?base_url=' + encodeURIComponent(baseUrl) + '&club=' + encodeURIComponent(vereinRaw));
  if (!r || !r.ok) { if(statusEl) statusEl.textContent = '❌ ' + (r && r.fehler || 'Fehler'); return; }

  _bkDbgHeader('MikaTiming');
  _bkDbgLine('Verein',    vereinRaw);
  _bkDbgLine('Basis-URL', baseUrl);

  if (r.data && r.data.debug) _bkDbgLine('API-Debug', JSON.stringify(r.data.debug).slice(0,3000));
  var rows = mikaExtractRowsForBulk(r.data, kat);
  _bkDbgLine('Vereins-Treffer', rows.length + ' Einträge');

  // Zusätzliche Suche nach bekannten Athleten-Namen (immer, nicht nur als Fallback)
  if (true) {
    _bkDbgLine('Athleten-Suche', 'Suche nach bekannten Athleten-Namen…');
    // v1368: echte Events + Disziplin-Map aus der Vereinssuche übernehmen → schlanker
    // Namens-Such-Pfad (ohne 181× mainHtml-Ladung). dynContest mappt Event-ID → "10km".
    var _dbg = (r.data && r.data.debug) || {};
    var _realEvents = _dbg.eventOptions ? Object.keys(_dbg.eventOptions) : [];
    var _dynContest = _dbg.dynContest || {};
    var _eventsParam = _realEvents.join(',');
    var _athleten = state.athleten || [];
    var _activeAth = _athleten;  // alle Athleten, nicht nur aktive
    // Einzigartige Nachnamen sammeln (aus name_nv: "Nachname, Vorname")
    var _seenNamen = {};
    var _nachnamen = [];
    _activeAth.forEach(function(a) {
      var nn = (a.name_nv||'').split(',')[0].trim();
      if (nn && nn.length >= 3 && !_seenNamen[nn.toLowerCase()]) {
        _seenNamen[nn.toLowerCase()] = true;
        _nachnamen.push(nn);
      }
    });
    var _idpSeen = {};
    var _nameRows = [];
    var _allMikaResults = []; // Debug: alle Treffer (auch nicht-gematchte)
    var _searchedNames = [];  // Debug: alle gesuchten Nachnamen
    // Parallele Requests in Batches (5 gleichzeitig) für ~5× Speedup
    var _BATCH = 5;
    for (var _ni = 0; _ni < _nachnamen.length; _ni += _BATCH) {
      var _batch = _nachnamen.slice(_ni, _ni + _BATCH);
      if (statusEl) statusEl.textContent = '⏳ Athleten-Suche ' + Math.min(_ni + _BATCH, _nachnamen.length) + '/' + _nachnamen.length + '…';
      var _batchResults = await Promise.all(_batch.map(function(_nn) {
        _searchedNames.push(_nn);
        return apiGet('mika-fetch?base_url=' + encodeURIComponent(baseUrl) + '&club=' + encodeURIComponent(vereinRaw) + '&name=' + encodeURIComponent(_nn)
          + (_eventsParam ? '&events=' + encodeURIComponent(_eventsParam) : ''))
          .then(function(_r) { return { name: _nn, r: _r }; });
      }));
      _batchResults.forEach(function(_wrap) {
        var _nn = _wrap.name; var _nr = _wrap.r;
        if (!_nr || !_nr.ok || !_nr.data.results) {
          if (_nr && _nr.data && _nr.data.debug && !_bkDbgLines._namDebugShown) {
            var _d = _nr.data.debug;
            _bkDbgLine('Name-API-Debug', ['noEventResults','noEventIdpRaw','noEventFirstLiSample','detailHasTime','detailLen'].filter(function(k){return _d[k]!==undefined;}).map(function(k){return k+'='+JSON.stringify(_d[k]).slice(0,120);}).join(' | '));
            _bkDbgLines._namDebugShown = true;
          }
          return;
        }
        // Debug: Roh-Treffer zählen
        _allMikaResults.push.apply(_allMikaResults, (_nr.data.results || []).map(function(res) { return { q: _nn, name: res.name, club: res.club || '' }; }));
        if (!_bkDbgLines._namDebugShown && _nr.data.debug) {
          var _d = _nr.data.debug;
          _bkDbgLine('Name-API-Debug', ['noEventResults','noEventIdpRaw','noEventFirstLiSample','detailHasTime','detailLen'].filter(function(k){return _d[k]!==undefined;}).map(function(k){return k+'='+JSON.stringify(_d[k]).slice(0,120);}).join(' | '));
          _bkDbgLines._namDebugShown = true;
        }
        _nr.data.results.forEach(function(res) {
          if (_idpSeen[res.idp]) return;
          if (uitsAutoMatch(res.name, _athleten) !== null) {
            _idpSeen[res.idp] = true;
            // v1368: contest-ID (z.B. "5") via dynContest → "5km" mappen (schlanker Pfad liefert roh)
            if (res.contest && _dynContest[res.contest]) res.contest = _dynContest[res.contest];
            _nameRows.push(res);
          }
        });
      });
    }
    _bkDbgLine('Namens-Treffer', _nameRows.length + ' Athleten gefunden (' + _searchedNames.length + ' Namen gesucht, ' + _allMikaResults.length + ' Roh-Treffer)');
    if (_allMikaResults.length > 0) {
      // Roh-Treffer mit Match-Status (✓=gematcht, ✗=verworfen) — Diagnose für fehlende Externe
      _bkDbgLine('Roh-Namen', _allMikaResults.slice(0, 25).map(function(r){
        var matched = uitsAutoMatch(r.name, _athleten) !== null;
        return (matched ? '✓' : '✗') + r.q + '→' + r.name + ' [' + (r.club || '?') + ']';
      }).join(', '));
    }
    _bkDbgFlush();
    // Vereins-Ergebnisse mit Namens-Ergebnissen zusammenführen (dedup via idp)
    var _clubIdps = {};
    (r.data.results || []).forEach(function(res) { if (res.idp) _clubIdps[res.idp] = true; });
    var _combined = (r.data.results || []).concat(
      _nameRows.filter(function(res) { return !_clubIdps[res.idp]; })
    );
    // Startnummer + Platzierung M/W stehen nur auf den Detailseiten. Erst jetzt
    // nachladen, wenn feststeht welche Zeilen übernommen werden – so bleibt es
    // bei wenigen Requests statt einem pro Roh-Treffer der Namenssuche.
    await mikaDetailsNachladen(_combined, baseUrl, statusEl);

    rows = mikaExtractRowsForBulk({ results: _combined }, kat);
    // Debug: Diagnose warum rows leer sein könnte trotz Matches
    _bkDbgLine('Pipeline', 'club=' + (r.data.results||[]).length + ' nameMatches=' + _nameRows.length + ' combined=' + _combined.length + ' → rows=' + rows.length);
  }

  if (rows.length) {
    _bkDbgSep();
    _bkDbgHeader('Ergebnisse');
    for (var _mi = 0; _mi < rows.length; _mi++) {
      var _mr = rows[_mi];
      _bkDbgLines.push(
        String(_mi+1).padStart(2,' ') + '.  ' +
        (_mr.name||'?').padEnd(22,' ') +
        (_mr.ak||'  ').padEnd(6,' ') +
        (_mr.resultat||'').padEnd(10,' ') +
        (_mr.platz ? 'Platz\u00a0' + _mr.platz : '').padEnd(9,' ') +
        '\u2192 ' + (_mr.disziplin||'(keine)') +
        (_mr.startnummer ? '  Nr.\u00a0' + _mr.startnummer : '') +
        (_mr.posGeschlecht ? '  M/W\u00a0' + _mr.posGeschlecht : '') +
        (_mr.posGesamt ? '  Ges.\u00a0' + _mr.posGesamt : '')
      );
    }
    _bkDbgFlush();
  }
  // AK angleichen wenn Checkbox aktiv
  var akAnglEl = document.getElementById('bk-ak-angleichen');
  if (!akAnglEl || akAnglEl.checked) bkApplyDlvAK(true);

  // Veranstaltungsname und Ort aus API-Response vorbelegen
  var _evData = r.data || {};
  var _mikaEvName = _evData.eventName || '';
  if (_mikaEvName) {
    var evEl = document.getElementById('bk-evname');
    if (evEl && !evEl.value) evEl.value = _cleanEventName(_mikaEvName);
  }
  if (_evData.eventOrt && !((document.getElementById('bk-ort')||{}).value)) {
    _bkAutoSetOrt(_evData.eventOrt);
  }
  if (_evData.eventDate) {
    var datEl = document.getElementById('bk-datum');
    if (datEl && !datEl.value) datEl.value = _evData.eventDate;
  }

  // v1105: Regelmäßige Veranstaltung automatisch erkennen & vorauswählen
  //        Nutzt Event-Name → Fuzzy-Match gegen gespeicherte Serien → setzt Dropdown
  //        Zusätzlich Ort aus letzter Austragung der Serie ableiten (falls Mika keinen lieferte)
  if (_mikaEvName) {
    var _matchedSerie = _bkMatchSerie(_mikaEvName);
    if (_matchedSerie) {
      bkSerieSetById(_matchedSerie.id);
      _bkDbgLine('Serie', _matchedSerie.name + ' (auto-erkannt)');
      // Ort aus letzter Austragung ableiten, wenn MikaTiming keinen lieferte
      if (!_evData.eventOrt && _matchedSerie.ort_letzte && !((document.getElementById('bk-ort')||{}).value)) {
        _bkAutoSetOrt(_matchedSerie.ort_letzte);
        _bkDbgLine('Ort', _matchedSerie.ort_letzte + ' (aus letzter Austragung)');
      }
    }
  }

  await bulkFillFromImport(rows, statusEl);
  bkRenderUnknownDisz(bkCollectUnknownDisz(), kat);
}

// ── Uitslagen → Bulk ────────────────────────────────────────────────────────
async function bulkImportFromUits(url, kat, statusEl) {
  if (statusEl) statusEl.textContent = '⏳ Lade uitslagen.nl-Daten…';
  var idMatch = url.match(/[?&]id=([^&]+)/);
  if (!idMatch) { if(statusEl) statusEl.textContent = '❌ Keine Event-ID'; return; }

  var r = await apiGet('uits-fetch?url=' + encodeURIComponent('https://uitslagen.nl/uitslag?id=' + idMatch[1]));
  if (!r || !r.ok) { if(statusEl) statusEl.textContent = '❌ ' + (r && r.fehler || 'Fehler'); return; }

  var parsed = uitsParseHTML(r.data.html, idMatch[1]);
  var _uOwn = parsed.rows.filter(function(r){return r.ownClub;});
  _bkDbgHeader('uitslagen.nl');
  _bkDbgLine('Eventname',  parsed.eventName || '–');
  _bkDbgLine('Datum',      parsed.eventDate || '–');
  _bkDbgLine('Ort',        parsed.eventOrt  || '–');
  _bkDbgLine('Gesamt',     parsed.rows.length + ' Einträge');
  _bkDbgLine('Gefunden',   _uOwn.length + ' TuS-Einträge');
  if (_uOwn.length) {
    _bkDbgSep();
    _bkDbgHeader('Ergebnisse');
    for (var _ui = 0; _ui < _uOwn.length; _ui++) {
      var _ur = _uOwn[_ui];
      var _umid = uitsAutoDiszMatchKat(_ur.kategorie, state.disziplinen||[], kat);
      var _udn = _umid ? ((state.disziplinen||[]).find(function(d){return (d.id||d.mapping_id)==_umid;})||{}).disziplin||'?' : '(keine)';
      _bkDbgLines.push(
        String(_ui+1).padStart(2,' ') + '.  ' +
        (_ur.name||'?').padEnd(22,' ') +
        (_ur.ak||'  ').padEnd(6,' ') +
        (_ur.zeit||'').padEnd(10,' ') +
        (_ur.platz ? 'Platz\u00a0' + _ur.platz : '').padEnd(9,' ') +
        '\u2192 ' + _udn + '  [' + _ur.kategorie + ']'
      );
    }
    _bkDbgFlush();
  }

  // Veranstaltungsfelder vorausfüllen
  if (parsed.eventDate) {
    var datEl = document.getElementById('bk-datum');
    if (datEl) { datEl.value = parsed.eventDate; bkSyncDatum(parsed.eventDate); }
  }
  if (parsed.eventOrt && !((document.getElementById('bk-ort')||{}).value)) {
    _bkAutoSetOrt(parsed.eventOrt);
  }
  if (parsed.eventName) {
    var evEl = document.getElementById('bk-evname');
    if (evEl && !evEl.value) evEl.value = _cleanEventName(parsed.eventName);
    var _laSerie = _bkMatchSerie(parsed.eventName);
    if (_laSerie) {
      bkSerieSetById(_laSerie.id);
      _bkDbgLine('Serie', _laSerie.name + ' (auto-erkannt)');
      if (!((document.getElementById('bk-ort')||{}).value) && _laSerie.ort_letzte) {
        _bkAutoSetOrt(_laSerie.ort_letzte);
        _bkDbgLine('Ort', _laSerie.ort_letzte + ' (aus letzter Austragung)');
      }
    }
  }

  var ownRows = parsed.rows.filter(function(row) { return row.ownClub; });
  // Fallback: Vereinsname nicht erkannt → per Athleten-Name filtern
  var rowsToImport = ownRows;
  if (ownRows.length === 0 && parsed.rows.length > 0) {
    var _athleten = state.athleten || [];
    rowsToImport = parsed.rows.filter(function(row) {
      return uitsAutoMatch(row.name, _athleten) !== null;
    });
    _bkDbgLine('Hinweis', 'Kein Vereinstreffer – ' + rowsToImport.length + ' Namens-Treffer in Athleten-DB');
  }
  var bulkRows = rowsToImport.map(function(row) {
    // Disziplin aus Kategorie + gewähltem kat
    var diszObj = uitsAutoDiszMatchKat(row.kategorie, state.disziplinen, kat);
    var disz = diszObj ? ((state.disziplinen||[]).find(function(d){return (d.id||d.mapping_id)==diszObj;}) || {}).disziplin || '' : '';
    return {
      name:      row.name,
      resultat:  row.zeit,
      ak:        row.ak,
      platz:     row.platz,
      disziplin: disz,
      diszMid:   diszObj,
    };
  });

  bulkFillFromImport(bulkRows, statusEl);
}

// ── Bulk-Tabelle füllen ──────────────────────────────────────────────────────

// ── RaceResult → Bulk-Zeilen extrahieren ────────────────────────
function rrExtractRowsForBulk(data, vereinCfg, kat) {
  // data ist die rr-fetch r=all Response — flaches Objekt mit gruppierten Rows
  // Wir iterieren alle Keys und suchen nach Vereins-Matches
  var disziplinen = state.disziplinen || [];
  var _diszKatErlaubt = bkKatMitGruppen(kat);
  var diszList = disziplinen
    .filter(function(d){return !_diszKatErlaubt||!d.tbl_key||_diszKatErlaubt.indexOf(d.tbl_key)>=0;})
    .map(function(d){ return d.disziplin; }).filter(function(v,i,a){ return a.indexOf(v)===i; });
  var rows = [];
  var vereinLower = vereinCfg.toLowerCase();

  function processRows(rowArr, contestName) {
    if (!Array.isArray(rowArr)) return;
    rowArr.forEach(function(row) {
      if (!Array.isArray(row)) return;
      // Vereins-Check: irgendein Feld enthält den Vereinsnamen
      var rowStr = row.join(' ').toLowerCase();
      if (!rowStr.includes(vereinLower)) return;
      // Name: letztes nicht-numerisches, nicht-Zeit Feld
      var name = '', zeit = '', ak = '', platz = 0;
      row.forEach(function(cell) {
        var s = String(cell || '').trim();
        if (s.match(/^\d+\.?$/) && !platz) { platz = parseInt(s) || 0; return; }
        if (s.match(/^\d{1,2}:\d{2}[,.]?/)) { if (!zeit) zeit = s; return; }
        if (s.match(/^[MW]\d{2}$/) || s.match(/^[MW]U\d{1,2}$/)) { ak = s; return; }
        if (s.length > 3 && !s.match(/^[0-9:.,']+$/) && !s.toLowerCase().includes(vereinLower)) { name = s; }
      });
      if (!name || !zeit) return;
      var disz = rrBestDisz(contestName || '', diszList);
      var diszObj = findDiszObj(disz, kat, disziplinen);
      // Feld 0 ist bei RaceResult die Startnummer (BIB)
      var bib = String(row[0] || '').trim();
      rows.push({ name: name, resultat: zeit, ak: ak, platz: platz,
                  startnummer: /^\d{1,7}$/.test(bib) ? bib : null,
                  disziplin: diszObj ? diszObj.disziplin : disz,
                  diszMid: diszObj ? (diszObj.id || diszObj.mapping_id) : null });
    });
  }

  // data kann verschiedene Strukturen haben
  if (data && typeof data === 'object') {
    Object.keys(data).forEach(function(key) {
      var val = data[key];
      if (Array.isArray(val)) {
        // Direkte Row-Arrays
        if (val.length && Array.isArray(val[0])) {
          processRows(val, key);
        } else {
          processRows(val, key);
        }
      } else if (val && typeof val === 'object') {
        // Verschachtelt: { contestName: [rows] }
        Object.keys(val).forEach(function(subKey) {
          if (Array.isArray(val[subKey])) processRows(val[subKey], subKey || key);
        });
      }
    });
  }
  return rows;
}

// ── MikaTiming → Bulk-Zeilen extrahieren ─────────────────────────
// Startnummer und Geschlechtsplatzierung von den MikaTiming-Detailseiten
// nachladen und in die bereits gefundenen Ergebnisse mischen. Die Suchliste
// führt nur Gesamt- und AK-Platz, deshalb der zusätzliche Schritt.
async function mikaDetailsNachladen(results, baseUrl, statusEl) {
  var offen = (results || []).filter(function(res) {
    if (!res.idp) return false;
    return !res.platz_mw || !res.startnr;   // schon vollständig → nicht erneut laden
  });
  if (!offen.length) return;

  if (statusEl) statusEl.textContent = '⏳ Details (Startnr./Platz M-W) für ' + offen.length + ' Ergebnisse…';
  var items = offen.map(function(res) { return { idp: res.idp, event: res.event_id || '' }; });

  var dr;
  try {
    dr = await apiGet('mika-detail?base_url=' + encodeURIComponent(baseUrl) +
                      '&items=' + encodeURIComponent(JSON.stringify(items)));
  } catch (e) { dr = null; }

  var details = (dr && dr.ok && dr.data && dr.data.details) || {};
  var uebernommen = 0;
  offen.forEach(function(res) {
    var d = details[res.idp];
    if (!d) return;
    if (!res.startnr   && d.startnr)   res.startnr   = d.startnr;
    if (!res.platz_mw  && d.platz_mw)  res.platz_mw  = d.platz_mw;
    if (!res.platz_ges && d.platz_ges) res.platz_ges = d.platz_ges;
    if (!res.platz_ak  && d.platz_ak)  res.platz_ak  = d.platz_ak;
    if (!res.netto     && d.netto)     res.netto     = d.netto;
    uebernommen++;
  });
  _bkDbgLine('Detail-Nachladung', offen.length + ' angefragt, ' + uebernommen + ' ergänzt (Startnr./Platz M-W)');
}

function mikaExtractRowsForBulk(data, kat) {
  var results = data && data.results ? data.results : [];
  var disziplinen = state.disziplinen || [];
  var _diszKatErlaubt = bkKatMitGruppen(kat);
  var diszList = disziplinen
    .filter(function(d){return !_diszKatErlaubt||!d.tbl_key||_diszKatErlaubt.indexOf(d.tbl_key)>=0;})
    .map(function(d){ return d.disziplin; }).filter(function(v,i,a){ return a.indexOf(v)===i; });
  var vereinRaw = (appConfig.verein_kuerzel || appConfig.verein_name || '').trim().toLowerCase();

  return results.filter(function(res) {
    // Nur Einträge mit Name behalten. Auch ohne Zeit zulassen (User kann manuell ergänzen);
    // früher hatten wir hier "_fromNewInterface && !netto → raus", was bei Hamburg-2019-artigen
    // Sites zu "Keine TuS-Einträge gefunden" führte, obwohl Athleten gematcht wurden.
    if (!res.name) return false;
    return true;
  }).map(function(res) {
    var contestName = res.contest || res.disziplin || '';
    var disz = rrBestDisz(contestName, diszList);
    var diszObj = findDiszObj(disz, kat, disziplinen);
    // Extern wenn Vereinsname leer oder nicht zum eigenen Verein passt
    var resClub = (res.club || '').trim().toLowerCase();
    var isExtern = !resClub || (vereinRaw && resClub.indexOf(vereinRaw) === -1 && vereinRaw.indexOf(resClub) === -1);
    return {
      name:      res.name || '',
      resultat:  res.netto || res.zeit || '',
      ak:        res.ak || '',
      platz:     parseInt(res.platz_ak) || 0,
      posGesamt:  parseInt(res.platz_ges) || null,
      posGeschlecht: parseInt(res.platz_mw) || null,
      startnummer: (res.startnr || '').toString().trim() || null,
      disziplin: diszObj ? diszObj.disziplin : disz,
      diszMid:   diszObj ? (diszObj.id || diszObj.mapping_id) : null,
      extern:    isExtern,
      verein:    isExtern ? (res.club || '') : '',
    };
  });
}

// ── evenementen.uitslagen.nl → Bulk ─────────────────────────────────────────
async function bulkImportFromEvenementenUits(url, kat, statusEl) {
  var pathMatch = url.match(/evenementen\.uitslagen\.nl(\/(\.?\d{4})\/([^\/?\ s]+)\/)/i);
  // Also handle without trailing slash
  if (!pathMatch) pathMatch = url.match(/evenementen\.uitslagen\.nl\/(\/(\d{4})\/([^\/?\ s]+))/i);
  if (!pathMatch) pathMatch = (function() {
    var m = url.match(/evenementen\.uitslagen\.nl\/((\d{4})\/([^\/?\ s]+))/i);
    if (m) return [m[0], '/' + m[1] + '/', m[2], m[3]]; return null;
  })();
  if (!pathMatch) { if (statusEl) statusEl.textContent = '\u274c Ungültige evenementen.uitslagen.nl-URL'; return; }
  var baseUrl = 'https://evenementen.uitslagen.nl/' + pathMatch[2] + '/' + pathMatch[3] + '/';
  var evYear  = pathMatch[2] || '';
  var evSlug  = pathMatch[3] || '';

  // Fallback-Eventname aus URL-Slug
  var evName = evSlug.charAt(0).toUpperCase() + evSlug.slice(1).replace(/-/g, ' ') + (evYear ? ' ' + evYear : '');
  var evOrt  = '';

  // Frameset-Seite → Titel holen
  var rIdx = await apiGet('uits-fetch?url=' + encodeURIComponent(baseUrl));
  if (rIdx && rIdx.ok && rIdx.data && rIdx.data.html) {
    var idxDoc = (new DOMParser()).parseFromString(rIdx.data.html, 'text/html');
    var pageTitle = idxDoc.title || '';
    if (pageTitle) evName = pageTitle.replace(/^Uitslagen\s+/i, '').trim() || evName;
  }

  // Ort-Versuch 1: direkt aus URL-Slug ableiten
  // "enschedemarathon" → strip bekannte Suffixe → "enschede" → "Enschede"
  var slugOrt = (function(slug) {
    var s = slug.toLowerCase()
      .replace(/[-_]/g, '')
      .replace(/(marathon|halve|loop|run|race|sprint|event|challenge|cup|triathlon|duathlon|city|classic|trail|night|half|relay|team|walk|walk|lauf|km\d+|\d+km)$/g, '')
      .replace(/(marathon|halve|loop|run|race|sprint|event|challenge|cup|classic|night|relay|team|walk|lauf)$/g, '')
      .trim();
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
  })(evSlug);
  if (slugOrt && slugOrt.length >= 3) {
    evOrt = slugOrt;
    _bkDbgLine('Ort', evOrt + ' (aus URL-Slug)');
  }

  // kop.html → Ort und Datum (ältere Events) — zusätzlich kop.php versuchen
  var rKop = await apiGet('uits-fetch?url=' + encodeURIComponent(baseUrl + 'kop.html'));
  var _kopTried = ['kop.html'];
  // kop.html oft leer auf neueren Sites → kop.php probieren
  if (!rKop || !rKop.ok || !(rKop.data && rKop.data.html && rKop.data.html.length > 200)) {
    rKop = await apiGet('uits-fetch?url=' + encodeURIComponent(baseUrl + 'kop.php'));
    _kopTried.push('kop.php');
  }
  if (rKop && rKop.ok && rKop.data && rKop.data.html) {
    var kopDoc = (new DOMParser()).parseFromString(rKop.data.html, 'text/html');
    var kopText = kopDoc.body ? kopDoc.body.textContent.trim() : '';
    _bkDbgLine(_kopTried[_kopTried.length-1], kopText.slice(0,200) || '(leer)');
    var mDat = kopText.match(/(\d{1,2})\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+(\d{4})/i);
    if (mDat) {
      var _mn = {januari:1,februari:2,maart:3,april:4,mei:5,juni:6,juli:7,augustus:8,september:9,oktober:10,november:11,december:12};
      var _m = _mn[(mDat[2]||'').toLowerCase()] || 1;
      var datumIso = mDat[3] + '-' + String(_m).padStart(2,'0') + '-' + String(parseInt(mDat[1])).padStart(2,'0');
      var datEl = document.getElementById('bk-datum');
      if (datEl) { datEl.value = datumIso; if (typeof bkSyncDatum === 'function') bkSyncDatum(datumIso); }
      _bkDbgLine('Datum', datumIso + ' (aus ' + _kopTried[_kopTried.length-1] + ')');
    }
    // Ort aus kop-Text überschreibt Slug-Ort wenn explizit genannt
    var mOrt = kopText.match(/[-\u2013]\s*([A-Z][a-zA-Z\u00c0-\u00ff\-]+(\s+[A-Z][a-zA-Z\u00c0-\u00ff]+)?)\s*[,(\d]/);
    if (mOrt && mOrt[1] && mOrt[1].length >= 3) { evOrt = mOrt[1].trim(); _bkDbgLine('Ort', evOrt + ' (aus kop)'); }
  }

  // Datum-Fallback: voet.php (Footer enthält manchmal Datum)
  var _datumGefunden = !!(document.getElementById('bk-datum') && document.getElementById('bk-datum').value && document.getElementById('bk-datum').value !== new Date().toISOString().slice(0,10));
  if (!_datumGefunden) {
    var rVoet = await apiGet('uits-fetch?url=' + encodeURIComponent(baseUrl + 'voet.php'));
    if (rVoet && rVoet.ok && rVoet.data && rVoet.data.html) {
      var voetDoc = (new DOMParser()).parseFromString(rVoet.data.html, 'text/html');
      var voetText = voetDoc.body ? voetDoc.body.textContent : '';
      _bkDbgLine('voet.php', voetText.slice(0,200) || '(leer)');
      var mDat2 = voetText.match(/(\d{1,2})\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+(\d{4})/i);
      if (!mDat2) mDat2 = voetText.match(/(\d{1,2})[-.\/](\d{1,2})[-.\/](\d{4})/);
      if (mDat2) {
        var _mn2 = {januari:1,februari:2,maart:3,april:4,mei:5,juni:6,juli:7,augustus:8,september:9,oktober:10,november:11,december:12};
        var _m2, _d2, _y2;
        if (/[a-z]/i.test(mDat2[2]||'')) {
          _m2 = _mn2[(mDat2[2]||'').toLowerCase()] || 1; _d2 = mDat2[1]; _y2 = mDat2[3];
        } else {
          _d2 = mDat2[1]; _m2 = parseInt(mDat2[2]); _y2 = mDat2[3];
        }
        var datumIso2 = _y2 + '-' + String(_m2).padStart(2,'0') + '-' + String(parseInt(_d2)).padStart(2,'0');
        var datEl2 = document.getElementById('bk-datum');
        if (datEl2) { datEl2.value = datumIso2; if (typeof bkSyncDatum === 'function') bkSyncDatum(datumIso2); }
        _bkDbgLine('Datum', datumIso2 + ' (aus voet.php)');
        _datumGefunden = true;
      }
    }
  }

  // Datum-Fallback 2: details.php des ersten Läufers (enthält "Gelopen op DD-MM-JJJJ")
  // Wird nach dem Menu-Load ausgeführt (braucht erste StNr aus uitslag.php?on=1)
  window._evenementenDatumNochNötig = !_datumGefunden;
  window._evenementenBaseUrl = baseUrl;

  if (statusEl) statusEl.textContent = '\u23f3 Lade Strecken\u2026';
  // v1111: zoek.html (statisch, keine TLS-Filterung) als primäre Menu-Quelle
  // Fallback: menu.php → menu.html
  var rMenu = await apiGet('uits-fetch?url=' + encodeURIComponent(baseUrl + 'zoek.html'));
  if (!rMenu || !rMenu.ok || !(rMenu.data && rMenu.data.html && rMenu.data.html.length > 500)) {
    rMenu = await apiGet('uits-fetch?url=' + encodeURIComponent(baseUrl + 'menu.php'));
  }
  if (!rMenu || !rMenu.ok || !(rMenu.data && rMenu.data.html)) {
    rMenu = await apiGet('uits-fetch?url=' + encodeURIComponent(baseUrl + 'menu.html'));
  }
  if (!rMenu || !rMenu.ok) { if (statusEl) statusEl.textContent = '\u274c ' + (rMenu && rMenu.fehler || 'Fehler'); return; }

  var races = uitsEvenementenParseMenu(rMenu.data.html || '');
  _bkDbgLine('menu', races.length + ' Strecken | Quelle-Len: ' + (rMenu.data.html||'').length + ' | catg: ' + races.filter(function(r){return r.catg;}).length + ' on: ' + races.filter(function(r){return r.on;}).length);

  if (!races.length) { if (statusEl) statusEl.textContent = '\u274c Keine Strecken gefunden'; return; }

  // Ort-Fallback: häufigstes Großwort in Streckennamen (Sponsor-Namen herausfiltern)
  if (!evOrt) {
    var stopWords = /^(van|der|de|het|den|een|voor|uit|met|bij|hotel|logistics|kilometer|marathon|halve|loop|run|kids|baby|bambino|kidzbase|rabobank|scelta|mushrooms|viking|seacon|valk|elektramat|forvis|mazars|rosen|siebert|wassink|johnson|controls|univé|univé|enschede)$/i;
    var ortCandidates = {};
    races.forEach(function(rc) {
      rc.text.split(/\s+/).forEach(function(w) {
        if (w.length >= 4 && /^[A-Z]/.test(w) && !stopWords.test(w) && !/\d/.test(w)) {
          ortCandidates[w] = (ortCandidates[w] || 0) + 1;
        }
      });
    });
    var sortedOrt = Object.keys(ortCandidates).sort(function(a,b){ return ortCandidates[b]-ortCandidates[a]; });
    if (sortedOrt[0]) evOrt = sortedOrt[0];
  }

  // Ort-Fallback: Auto-Serie-Match → ort_letzte aus letzter Austragung (v1105)
  var _evNameForSerie = evName;
  if (typeof _bkMatchSerie === 'function') {
    var _matchedSerieEv = _bkMatchSerie(_evNameForSerie);
    if (_matchedSerieEv) {
      bkSerieSetById(_matchedSerieEv.id);
      _bkDbgLine('Serie', _matchedSerieEv.name + ' (auto-erkannt)');
      if (!evOrt && _matchedSerieEv.ort_letzte) {
        evOrt = _matchedSerieEv.ort_letzte;
        _bkDbgLine('Ort', evOrt + ' (aus letzter Austragung der Serie)');
      }
    }
  }

  // Alle Strecken laden
  var allRows = [];
  var rowNr   = 0;
  var MAX_PAGES = 200;

  for (var ri = 0; ri < races.length; ri++) {
    var race = races[ri];
    var page = 1;
    var raceRows = 0;
    while (page <= MAX_PAGES) {
      if (statusEl) statusEl.textContent = '\u23f3 ' + race.text + ' – Seite ' + page + '\u2026';
      var pageUrl = race.catg
        ? baseUrl + 'uitslag.php?catg=' + encodeURIComponent(race.catg) + '&p=' + page
        : baseUrl + 'uitslag.php?on=' + encodeURIComponent(race.on) + '&p=' + page;
      var rPage = await apiGet('uits-fetch?url=' + encodeURIComponent(pageUrl));
      if (!rPage || !rPage.ok) { _bkDbgLine(race.text, 'S.' + page + ' Fehler: ' + (rPage && rPage.fehler || '?')); break; }
      // Datum-Fallback 3: details.php des ersten Läufers nach erster Seite
      if (ri === 0 && page === 1 && window._evenementenDatumNochNötig && rPage.data && rPage.data.html) {
        var _pageDoc = new DOMParser().parseFromString(rPage.data.html, 'text/html');
        var _pageHtml = rPage.data.html;
        // Direkt im HTML nach Datum suchen
        var _nlMp = {januari:1,februari:2,maart:3,april:4,mei:5,juni:6,juli:7,augustus:8,september:9,oktober:10,november:11,december:12};
        var _datPat = /(\d{1,2})\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+(\d{4})/i;
        var _mDp = _pageHtml.match(_datPat);
        if (!_mDp) _mDp = _pageHtml.match(/(\d{2})-(\d{2})-(20\d\d)/);
        if (!_mDp) _mDp = _pageHtml.match(/(\d{2})\.(\d{2})\.(20\d\d)/);
        if (_mDp) {
          var _pd, _pm, _py;
          if (/[a-z]/i.test(_mDp[2]||'')) {
            _pd = parseInt(_mDp[1]); _pm = _nlMp[(_mDp[2]||'').toLowerCase()]||1; _py = parseInt(_mDp[3]);
          } else {
            _pd = parseInt(_mDp[1]); _pm = parseInt(_mDp[2]); _py = parseInt(_mDp[3]);
          }
          var _dIso = _py + '-' + String(_pm).padStart(2,'0') + '-' + String(_pd).padStart(2,'0');
          var _dEl = document.getElementById('bk-datum');
          if (_dEl) { _dEl.value = _dIso; if (typeof bkSyncDatum === 'function') bkSyncDatum(_dIso); }
          _bkDbgLine('Datum', _dIso + ' (uitslag.php)');
          window._evenementenDatumNochNötig = false;
        } else {
          // details.php des ersten Läufers holen → "Gelopen op DD-MM-JJJJ"
          var _firstStNrEl = _pageDoc.querySelector('tr:nth-child(2) td:nth-child(2)');
          var _firstStNr = _firstStNrEl ? _firstStNrEl.textContent.trim() : '';
          if (_firstStNr) {
            var _rDet = await apiGet('uits-fetch?url=' + encodeURIComponent(window._evenementenBaseUrl + 'details.php?s=' + encodeURIComponent(_firstStNr) + '&t=nr'));
            if (_rDet && _rDet.ok && _rDet.data && _rDet.data.html) {
              var _detTxt = _rDet.data.html.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');
              // "Gelopen op 12-04-2026" oder "12 april 2026"
              var _mDet = _detTxt.match(/Gelopen op\s+(\d{1,2})-(\d{1,2})-(\d{4})/i) ||
                          _detTxt.match(/(\d{1,2})-(\d{2})-(20\d\d)/) ||
                          _detTxt.match(_datPat);
              if (_mDet) {
                var _dpd, _dpm, _dpy;
                if (/[a-z]/i.test(_mDet[2]||'')) {
                  _dpd = parseInt(_mDet[1]); _dpm = _nlMp[(_mDet[2]||'').toLowerCase()]||1; _dpy = parseInt(_mDet[3]);
                } else {
                  _dpd = parseInt(_mDet[1]); _dpm = parseInt(_mDet[2]); _dpy = parseInt(_mDet[3]);
                }
                var _detIso = _dpy + '-' + String(_dpm).padStart(2,'0') + '-' + String(_dpd).padStart(2,'0');
                var _dEl2 = document.getElementById('bk-datum');
                if (_dEl2) { _dEl2.value = _detIso; if (typeof bkSyncDatum === 'function') bkSyncDatum(_detIso); }
                _bkDbgLine('Datum', _detIso + ' (details.php)');
                window._evenementenDatumNochNötig = false;
              }
            }
          }
          // Immer noch nicht gefunden → Warning
          if (window._evenementenDatumNochNötig) {
            _bkDbgLine('Datum', '⚠ nicht gefunden – bitte manuell eingeben (' + evYear + ')');
            var _dEl3 = document.getElementById('bk-datum');
            if (_dEl3) { _dEl3.value = ''; if (typeof bkSyncDatum === 'function') bkSyncDatum(''); }
            notify('📅 Datum nicht automatisch gefunden – bitte manuell eingeben!', 'err');
          }
        }
      }
      var parsed = uitsEvenementenParsePage(rPage.data.html || '');
      if (!parsed.rows.length) break;
      parsed.rows.forEach(function(tr) {
        var row = uitsEvenementenParseRow(Array.from(tr.querySelectorAll('td')), ++rowNr);
        if (row) { row.strecke = race.text; allRows.push(row); raceRows++; }
      });
      if (!parsed.hasMore) break;
      page++;
    }
    _bkDbgLine(race.text, raceRows + ' Eintr\u00e4ge');
  }

  _bkDbgHeader('evenementen.uitslagen.nl');
  _bkDbgLine('Event',    evName + (evOrt ? ', ' + evOrt : ''));
  _bkDbgLine('Strecken', races.length);
  _bkDbgLine('Gesamt',   allRows.length + ' Eintr\u00e4ge');

  // Athleten-Name-Match
  var athleten = state.athleten || [];
  var ownRows = allRows.filter(function(r) { return uitsAutoMatch(r.name, athleten) !== null; });
  _bkDbgLine('Gefunden', ownRows.length + ' Treffer');

  if (ownRows.length) {
    _bkDbgSep(); _bkDbgHeader('Ergebnisse');
    ownRows.forEach(function(r, i) {
      var mid = uitsEvenementenDiszFromStrecke(r.strecke, state.disziplinen || [], kat);
      var dn  = mid ? ((state.disziplinen||[]).find(function(d){return (d.id||d.mapping_id)==mid;})||{}).disziplin||'?' : '(keine)';
      _bkDbgLines.push(String(i+1).padStart(2)+'.  '+(r.name||'?').padEnd(22)+(r.ak||'').padEnd(6)+r.zeit.padEnd(10)+(r.platz?'Platz\u00a0'+r.platz:'').padEnd(9)+'\u2192 '+dn);
    });
    _bkDbgFlush();
  }

  // Felder vorausfüllen
  var evEl  = document.getElementById('bk-evname');
  var ortEl = document.getElementById('bk-ort');
  if (evEl  && !evEl.value)  evEl.value  = _cleanEventName(evName);
  if (evOrt && !((document.getElementById('bk-ort')||{}).value)) _bkAutoSetOrt(evOrt);

  var bulkRows = ownRows.map(function(row) {
    var mid  = uitsEvenementenDiszFromStrecke(row.strecke, state.disziplinen, kat);
    var disz = mid ? ((state.disziplinen||[]).find(function(d){return (d.id||d.mapping_id)==mid;})||{}).disziplin||'' : '';
    return { name: row.name, resultat: row.zeit, ak: row.ak, platz: row.platz, disziplin: disz, diszMid: mid };
  });

  await bulkFillFromImport(bulkRows, statusEl);
  bkRenderUnknownDisz(bkCollectUnknownDisz(), kat);
}
// ── Disziplin aus Streckenname (evenementen.uitslagen.nl) ────────────────────
// Streckenname enthält Distanz: "halve marathon", "10 kilometer", "5 kilometer", "1 km", "500 m"
// uitsEvenementenDiszFromStrecke wird in 13_uitslagen.js definiert (lädt nach 07).

// ── ACN Timing importer ──────────────────────────────────────────────────────

async function bulkImportFromAcn(url, kat, statusEl) {
  var ctxMatch   = url.match(/#.*?ctx\/([^\/]+)/);
  var raceMatch  = url.match(/\/home\/([A-Z0-9]+)/);
  var eventMatch = url.match(/#.*?events\/(\d+)/);
  var ctx        = ctxMatch  ? ctxMatch[1]  : null;

  if (!ctx) {
    _bkDbgLine('Fehler', 'Kein ctx in URL gefunden');
    if (statusEl) statusEl.textContent = '\u274c Keine ACN-URL erkannt';
    return;
  }
  _bkDbgLine('ACN ctx', ctx);

  // Datum + Ort aus ctx (Format: YYYYMMDD_ort)
  var ctxParts = ctx.match(/^(\d{4})(\d{2})(\d{2})_(.+)$/);
  if (ctxParts) {
    var evDate = ctxParts[1] + '-' + ctxParts[2] + '-' + ctxParts[3];
    var evOrt  = ctxParts[4].charAt(0).toUpperCase() + ctxParts[4].slice(1);
    var datEl  = document.getElementById('bk-datum');
    var ortEl  = document.getElementById('bk-ort');
    if (datEl) { datEl.value = evDate; bkSyncDatum(evDate); }
    if (!((document.getElementById('bk-ort')||{}).value)) _bkAutoSetOrt(evOrt);
    _bkDbgLine('Datum', evDate);
    _bkDbgLine('Ort',   evOrt);
  }

  // Veranstaltungsname via prod.chronorace.be/api/Event/view/{eventId}
  if (eventMatch && eventMatch[1]) {
    try {
      var evR = await fetch('https://prod.chronorace.be/api/Event/view/' + eventMatch[1]);
      if (evR.ok) {
        var evD = await evR.json();
        var evName = evD.Title || evD.name || '';
        if (evName) {
          _bkDbgLine('Veranstaltung', evName);
          var evnEl = document.getElementById('bk-evname');
          if (evnEl && !evnEl.value) evnEl.value = _cleanEventName(evName);
          var _acnSerie = _bkMatchSerie(evName);
          if (_acnSerie) {
            bkSerieSetById(_acnSerie.id);
            _bkDbgLine('Serie', _acnSerie.name + ' (auto-erkannt)');
            if (!((document.getElementById('bk-ort')||{}).value) && _acnSerie.ort_letzte) {
              _bkAutoSetOrt(_acnSerie.ort_letzte);
              _bkDbgLine('Ort', _acnSerie.ort_letzte + ' (aus letzter Austragung)');
            }
          }
        }
      }
    } catch(e) { _bkDbgLine('Event-Name Fehler', e.message); }
  }

  // Race-IDs ermitteln
  var raceIds = [];
  if (raceMatch && raceMatch[1]) {
    raceIds = [raceMatch[1]];
    _bkDbgLine('Modus', 'Einzelne Strecke: ' + raceIds[0]);
  } else {
    if (statusEl) statusEl.textContent = '\u23f3 Entdecke Strecken\u2026';
    _bkDbgLine('Modus', 'Auto-Discovery');
    var candidates = [];
    var letters = ['A','B','C','D','E','F','G','H','J','K'];
    for (var li = 0; li < letters.length; li++) {
      for (var n = 1; n <= 9; n++) candidates.push('LIVE' + letters[li] + n);
    }
    var probeResults = await Promise.all(candidates.map(async function(id) {
      try {
        var r = await fetch('https://results.chronorace.be/api/results/table/search/' + ctx + '/' + id + '?srch=&pageSize=1');
        if (!r.ok) return null;
        var d = await r.json();
        return (d.Count || 0) > 0 ? { id: id, count: d.Count } : null;
      } catch(e) { return null; }
    }));
    raceIds = probeResults.filter(Boolean).map(function(r) { return r.id; });
    var foundInfo = probeResults.filter(Boolean);
    _bkDbgLine('Gefundene Strecken', raceIds.length);
    foundInfo.forEach(function(r) { _bkDbgLine('  ' + r.id, r.count + ' Teilnehmer'); });
  }

  if (!raceIds.length) {
    _bkDbgLine('Fehler', 'Keine Strecken gefunden');
    if (statusEl) statusEl.textContent = '\u274c Keine Strecken gefunden';
    return;
  }

  // Hilfsfunktionen
  function acnParseName(html) {
    var m = html.match(/<b>([^<]+)<\/b>/);
    return m ? m[1].trim() : '';
  }
  function acnParseAk(akRaw, gender) {
    var a   = (akRaw || '').trim();
    var isF = a.charAt(0) === 'V' || gender === 'F';
    var pfx = isF ? 'W' : 'M';
    if (a === 'Msen' || a === 'Vsen') return pfx + 'sen';
    var num = a.match(/\d+/);
    return num ? pfx + num[0] : a;
  }
  function acnDiszFromSplits(splitCols) {
    if (!splitCols || !splitCols.length) return null;
    var lastSplit = splitCols[splitCols.length - 1].toLowerCase();
    if (lastSplit === '20km') return 'Halve Marathon';
    if (lastSplit === '5km' && splitCols.length === 1) return '10km';
    return null;
  }

  // Alle Strecken laden
  if (statusEl) statusEl.textContent = '\u23f3 Lade ' + raceIds.length + ' Strecke(n)\u2026';
  var allFetched = await Promise.all(raceIds.map(async function(id) {
    try {
      var r = await fetch('https://results.chronorace.be/api/results/table/search/' + ctx + '/' + id + '?srch=&pageSize=12000');
      if (!r.ok) return null;
      var d = await r.json();
      var cols    = (d.TableDefinition && d.TableDefinition.Columns) ? d.TableDefinition.Columns : [];
      var rows    = (d.Groups && d.Groups[0]) ? d.Groups[0].SlaveRows || [] : [];

      // Teamresultaten: werden durch leere Nettozeit unten erkannt (kein separater RowAction-Check)

      // Spaltenindizes dynamisch ermitteln
      var nettoIdx = -1;
      var akPlatzIdx = -1;
      var nameIdx   = 2; // Fallback: historische Position
      var genderIdx = 3;
      var akIdx     = 8;
      var bibIdx    = -1;
      for (var ci2 = 0; ci2 < cols.length; ci2++) {
        var cName2 = (cols[ci2].Name || '');
        var dn2 = (cols[ci2].DisplayName || '').toLowerCase();
        var gd2 = (cols[ci2].GroupDisplayName || '').toLowerCase();
        var fi2 = cols[ci2].FieldIdx !== undefined ? cols[ci2].FieldIdx : ci2;
        if (dn2.indexOf('netto') >= 0 || cName2.toLowerCase().indexOf('netto') >= 0) nettoIdx = fi2;
        // AK-Platzierung: Spalte 'Pos' in Gruppe 'Categorie'
        if (dn2 === 'pos' && gd2.indexOf('categ') >= 0) akPlatzIdx = fi2;
        // Name, Geschlecht, AK-Kategorie (Spaltenname kann Präfix haben wie sH_#GENDER)
        if (cName2.indexOf('#NAME')   >= 0) nameIdx   = fi2;
        if (cName2.indexOf('#GENDER') >= 0) genderIdx = fi2;
        if (cName2.indexOf('#CAT')    >= 0) akIdx     = fi2;
        // Startnummer (BIB / Dossard / Nr.)
        if (cName2.indexOf('#BIB') >= 0 || dn2 === 'bib' || dn2 === 'nr' || dn2 === 'nr.' ||
            dn2.indexOf('dossard') >= 0 || dn2.indexOf('startnummer') >= 0) bibIdx = fi2;
      }
      if (nettoIdx < 0) {
        var sample = rows[0] || [];
        for (var si = sample.length - 1; si >= 0; si--) {
          if (typeof sample[si] === 'string' && sample[si].indexOf('<br/>') >= 0 && sample[si].indexOf('km/h') >= 0) {
            nettoIdx = si; break;
          }
        }
      }

      // Zeitvalidierung
      var sampleNet = (nettoIdx >= 0 && rows[0]) ? (rows[0][nettoIdx] || '').toString() : '';
      if (!sampleNet || sampleNet.indexOf('detail:') >= 0 || !sampleNet.match(/\d+:\d+/)) {
        _bkDbgLine(id, 'Uebersprungen (keine gueltigen Zeiten: ' + sampleNet.slice(0,20) + ')');
        return null;
      }

      // Split-Spalten fuer Disziplin
      var splitNames = [];
      for (var ci3 = 0; ci3 < cols.length; ci3++) {
        var dn = (cols[ci3].DisplayName || '');
        if (/^\d+(\.\d+)?km$/i.test(dn)) splitNames.push(dn);
      }
      var diszHint = acnDiszFromSplits(splitNames);

      // Kein Split -> aus Siegerzeit ableiten
      if (!diszHint) {
        var cleanNet = sampleNet.replace(/<[^>]*>/g, '').trim();
        var tm2 = cleanNet.match(/^(\d+):(\d+)/);
        if (!tm2) { _bkDbgLine(id, 'Uebersprungen (keine Siegerzeit: ' + cleanNet.slice(0,20) + ')'); return null; }
        var totalMin = parseInt(tm2[1]) * 60 + parseInt(tm2[2]);
        if (totalMin < 5) { _bkDbgLine(id, 'Uebersprungen (Kids Run, ' + sampleNet.slice(0,8) + ')'); return null; }
        if      (totalMin < 20) diszHint = '5km';
        else if (totalMin < 45) diszHint = '10km';
        else                    diszHint = 'Halve Marathon';
        _bkDbgLine(id, 'Disz aus Siegerzeit ' + sampleNet.slice(0,8) + ' -> ' + diszHint);
      } else {
        _bkDbgLine(id, rows.length + ' Zeilen | Netto-Col:' + nettoIdx + ' | Disz:' + diszHint);
      }

      // AK-Rang-Tabelle aus ALLEN Zeilen aufbauen (fuer Rennen ohne Categorie-Pos-Spalte)
      var akRankMap = {}; // 'AK|zeit_sek' -> rank (1-based)
      if (akPlatzIdx < 0) {
        function _toSec(t) {
          if (!t) return 999999;
          var s = t.toString().replace(/<[^>]*>/g,'').trim();
          var p = s.split(':').map(function(x){return parseInt(x,10);});
          if (p.length===3 && !isNaN(p[2])) return p[0]*3600+p[1]*60+p[2];
          if (p.length===2 && !isNaN(p[1])) return p[0]*60+p[1];
          return 999999;
        }
        // Gruppiere alle Zeilen nach AK, sortiere nach Nettozeit
        var _akGroups = {};
        for (var _ri = 0; _ri < rows.length; _ri++) {
          var _row = rows[_ri];
          var _ak = (_row[akIdx] || '').trim();
          if (!_ak || _ak === '-') continue;
          var _net = (nettoIdx >= 0 && nettoIdx < _row.length) ? (_row[nettoIdx] || '').toString() : '';
          var _sec = _toSec(_net);
          if (_sec >= 999999) continue;
          if (!_akGroups[_ak]) _akGroups[_ak] = [];
          _akGroups[_ak].push(_sec);
        }
        // Sortiere jede Gruppe und erstelle Lookup: 'AK|sek' -> rank
        Object.keys(_akGroups).forEach(function(ak) {
          var sorted = _akGroups[ak].slice().sort(function(a,b){return a-b;});
          sorted.forEach(function(sec, i) {
            var key = ak + '|' + sec;
            if (!akRankMap[key]) akRankMap[key] = i + 1; // erste Eintrag gewinnt bei Zeitgleichheit
          });
        });
        _bkDbgLine(id + ' AK-Rang', Object.keys(_akGroups).length + ' AK-Gruppen berechnet');
      }
      return { id: id, rows: rows, nettoIdx: nettoIdx, akPlatzIdx: akPlatzIdx, akRankMap: akRankMap, diszHint: diszHint, nameIdx: nameIdx, genderIdx: genderIdx, akIdx: akIdx, bibIdx: bibIdx };
    } catch(e) {
      _bkDbgLine(id + ' Fehler', e.message);
      return null;
    }
  }));

  // Zeilen parsen + deduplizieren
  var seen = {};
  var parsedRows = [];
  for (var fi = 0; fi < allFetched.length; fi++) {
    var race = allFetched[fi];
    if (!race) continue;
    for (var ri = 0; ri < race.rows.length; ri++) {
      var row    = race.rows[ri];
      var name   = acnParseName(row[race.nameIdx] || '');
      if (!name) continue;
      var gender = (row[race.genderIdx] || '').toString().replace(/<[^>]*>/g,'').trim();
      var akRaw  = (row[race.akIdx] || '').toString().replace(/<[^>]*>/g,'').trim();
      if (akRaw === 'J' || akRaw === 'B' || akRaw === 'P' || akRaw === 'K') continue;
      var rankRaw= (row[0] || '').replace(/\.$/, '').trim();
      var netHtml = (race.nettoIdx >= 0 && race.nettoIdx < row.length) ? (row[race.nettoIdx] || '') : '';
      var ztM = netHtml.toString().replace(/<[^>]*>/g,' ').match(/\d+:\d+:\d+|\d+:\d+/);
      var zeit = ztM ? ztM[0] : '';
      if (!zeit) continue;
      var key = name + '|' + zeit + '|' + race.id;
      if (seen[key]) continue;
      seen[key] = true;
      // AK-Platzierung aus Categorie-Spalte oder berechnet aus akRankMap
      var akPlatzRaw = (race.akPlatzIdx >= 0 && race.akPlatzIdx < row.length) ? (row[race.akPlatzIdx] || '').toString() : '';
      var akPlatz = '';
      if (akPlatzRaw) {
        akPlatz = akPlatzRaw.split('/')[0].trim();
      } else if (race.akRankMap && Object.keys(race.akRankMap).length) {
        // Rang aus vorberechneter Map: 'AK|sek' -> rank
        function _toSec2(t) {
          if (!t) return 999999;
          var s = t.toString().replace(/<[^>]*>/g,'').trim();
          var p = s.split(':').map(function(x){return parseInt(x,10);});
          if (p.length===3 && !isNaN(p[2])) return p[0]*3600+p[1]*60+p[2];
          if (p.length===2 && !isNaN(p[1])) return p[0]*60+p[1];
          return 999999;
        }
        var _akRaw = (row[race.akIdx] || '').toString().replace(/<[^>]*>/g,'').trim();
        var _netRaw = (race.nettoIdx >= 0 && race.nettoIdx < row.length) ? (row[race.nettoIdx] || '').toString() : '';
        var _sec2 = _toSec2(_netRaw);
        var _rk = race.akRankMap[_akRaw + '|' + _sec2];
        if (_rk) akPlatz = String(_rk);
      }
      // Startnummer + Gesamtplatzierung (Spalte 0 = Gesamtrang)
      var bibRaw = (race.bibIdx >= 0 && race.bibIdx < row.length) ? (row[race.bibIdx] || '').toString().replace(/<[^>]*>/g, '').trim() : '';
      parsedRows.push({ name: name, zeit: zeit, ak: acnParseAk(akRaw, gender), platz: akPlatz, diszHint: race.diszHint,
                        startnummer: /^\d{1,7}$/.test(bibRaw) ? bibRaw : null,
                        posGesamt: /^\d{1,6}$/.test(rankRaw) ? parseInt(rankRaw, 10) : null });
    }
  }
  _bkDbgLine('Geparste Zeilen (dedup)', parsedRows.length);

  // Name-Matching
  var _athleten = state.athleten || [];
  var rowsToImport = parsedRows.filter(function(row) {
    return uitsAutoMatch(row.name, _athleten) !== null;
  });
  _bkDbgLine('Treffer (Name-Match)', rowsToImport.length);

  if (!rowsToImport.length) {
    _bkDbgLine('Hinweis', 'Keine Vereinsathleten gefunden. Erste 20 Namen:');
    parsedRows.slice(0, 20).forEach(function(r) { _bkDbgLine('  Name', r.name); });
    if (statusEl) statusEl.textContent = '\u274c Keine Vereinsathleten gefunden \u2013 Debug-Log pruefen';
    return;
  }

  // Disziplin-Lookup
  function acnFindDisz(hint, kat2) {
    if (!hint) return { disz: '', diszMid: null };
    var hl = hint.toLowerCase().replace(/[\s-]/g, '');
    var aliases = {
      'halvemarathon': 'Halbmarathon', 'halfmarathon': 'Halbmarathon', 'halbmarathon': 'Halbmarathon',
      '21km': 'Halbmarathon', '21,1km': 'Halbmarathon',
      'marathon': 'Marathon', '42km': 'Marathon', '42,2km': 'Marathon',
    };
    var target = aliases[hl] || hint;
    var tl = target.toLowerCase();
    var dl = (state.disziplinen || []).filter(function(d2) { return !kat2 || d2.tbl_key === kat2; });
    var found = dl.find(function(d2) { return (d2.disziplin || '').toLowerCase() === tl; });
    if (!found) found = dl.find(function(d2) { return (d2.disziplin || '').toLowerCase().startsWith(tl) || tl.startsWith((d2.disziplin || '').toLowerCase()); });
    if (!found) return { disz: '', diszMid: null };
    return { disz: found.disziplin, diszMid: found.id || found.mapping_id };
  }

  var bulkRows = rowsToImport.map(function(row) {
    var r2 = acnFindDisz(row.diszHint, kat);
    return { name: row.name, resultat: row.zeit, ak: row.ak, platz: row.platz, disziplin: r2.disz, diszMid: r2.diszMid,
             startnummer: row.startnummer || null, posGesamt: row.posGesamt || null };
  });

  bulkFillFromImport(bulkRows, statusEl);
}

// Bezeichnung aus der Ergebnisliste ("Kreismeisterschaft Kreis Kleve") einem
// Eintrag der konfigurierten Meisterschaftsliste zuordnen
function _bkMstrIdFromLabel(label) {
  var list = (typeof MSTR_LIST !== 'undefined' && MSTR_LIST) || [];
  if (!label || !list.length) return null;
  function norm(s) { return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim(); }
  var l = norm(label);
  var hit = list.find(function(m) { return norm(m.label) === l; });
  if (!hit) hit = list.find(function(m) { var n = norm(m.label); return n && (l.indexOf(n) === 0 || n.indexOf(l) === 0); });
  if (!hit) hit = list.find(function(m) { var n = norm(m.label); return n && (l.indexOf(n) >= 0 || n.indexOf(l) >= 0); });
  // Erstes Wort vergleichen – fängt Ein-/Mehrzahl ab ("Kreismeisterschaft" ↔ "Kreismeisterschaften")
  if (!hit) {
    var l0 = l.split(' ')[0];
    if (l0.length >= 8) hit = list.find(function(m) {
      var n0 = norm(m.label).split(' ')[0];
      return n0.length >= 8 && (n0.indexOf(l0) === 0 || l0.indexOf(n0) === 0);
    });
  }
  return hit ? hit.id : null;
}

// RaceResult-Contest/Liste als Meisterschafts-Wertung erkennen und passendes Label
// liefern (leer = keine Meisterschaft). "LVN" = Landesverband Nordrhein, RaceResults
// stehende Abkürzung für regionale Leichtathletik-Meisterschaften (z.B. Contest-Name
// "5-km-Meisterschaftslauf" + Listen-Ordner "02-ERGEBNISSE-LVN|Ergebnisliste AK LVN").
function _rrDetectMeisterschaft(contestName, listName) {
  var cn = (contestName || '').toLowerCase();
  var ln = (listName || '').toLowerCase();
  var _hasLvn = /(^|[^a-z])lvn([^a-z]|$)/.test(cn) || /(^|[^a-z])lvn([^a-z]|$)/.test(ln);
  var _hasMstr = cn.indexOf('meisterschaft') >= 0 || ln.indexOf('meisterschaft') >= 0;
  if (!_hasLvn && !_hasMstr) return '';
  if (_hasLvn) {
    var _lvnMid = _bkMstrIdFromLabel('Nordrhein-Meisterschaft');
    if (_lvnMid) return mstrLabel(_lvnMid);
  }
  return contestName || listName || '';
}

async function bulkFillFromImport(rows, statusEl) {
  if (!rows.length) {
    if (statusEl) statusEl.textContent = '⚠ Keine TuS-Einträge gefunden';
    return;
  }
  // ── Neue Athleten erkennen und Dialog zeigen ──────────────
  var athleten = state.athleten || [];
  var newCandidates = [];
  rows.forEach(function(row) {
    if (!row.name) return;
    var matched = uitsAutoMatch(row.name, athleten);
    if (!matched) {
      // Prüfen ob dieser Name schon in newCandidates
      var already = newCandidates.some(function(c) { return c.name === row.name; });
      if (!already) {
        // Geschlecht aus AK ableiten wenn nicht direkt vorhanden
        var _g = row.geschlecht || '';
        if (!_g && row.ak) {
          if (/^[WwFf]/.test(row.ak)) _g = 'W';
          else if (/^M/.test(row.ak)) _g = 'M';
        }
        if (_g === 'F') _g = 'W';
        newCandidates.push({ name: row.name, year: row.year || '', geschlecht: _g });
      }
    }
  });
  var _bnadNameMap = {};
  if (newCandidates.length > 0) {
    var _bnadResult = await bulkNewAthleteDialog(newCandidates);
    if (_bnadResult === null) { if (statusEl) statusEl.textContent = ''; return; } // Abgebrochen
    _bnadNameMap = _bnadResult || {};
  }
  // Fehlende Jahrgänge aus dem Import in die Stammdaten nachtragen
  await bkNachtragenJahrgang(rows, _bnadNameMap);

  var tbody = document.getElementById('bulk-rows');
  if (!tbody) return;

  // Alle bestehenden Zeilen entfernen (Import ersetzt vorherige Einträge)
  tbody.innerHTML = '';

  rows.forEach(function(row) {
    bulkAddRow();
    var tr = tbody.lastElementChild;
    if (!tr) return;

    // Athlet per Name matchen: 1. uitsAutoMatch, 2. nameMap aus Dialog
    if (row.name) {
      var matched = uitsAutoMatch(row.name, state.athleten || []);
      if (!matched && _bnadNameMap[row.name]) matched = String(_bnadNameMap[row.name]);
      if (matched) bkAthletSetById(tr, matched);
    }
    // Disziplin setzen
    var diszSel = tr.querySelector('.bk-disz');
    if (diszSel && (row.disziplin || row.diszMid)) {
      var _matched = false;
      // Rohnamen aus dem Import merken → nachträglich angelegte Disziplinen zuordenbar
      if (row.disziplin) diszSel.setAttribute('data-import-disz', row.disziplin);
      // 1. Prio: diszMid (mapping_id) → exakter Kategorie-Treffer
      if (row.diszMid) {
        diszSel.setAttribute('data-mid', String(row.diszMid));
        for (var i = 0; i < diszSel.options.length; i++) {
          if (String(diszSel.options[i].value) === String(row.diszMid)) {
            diszSel.value = diszSel.options[i].value; _matched = true; break;
          }
        }
        // Fallback: Option noch nicht im Dropdown → kat wechseln und nochmal
        if (!_matched) {
          var _dObj = (state.disziplinen||[]).find(function(d){return (d.id||d.mapping_id)==row.diszMid;});
          if (_dObj) {
            var _bkk = document.getElementById('bk-kat');
            if (_bkk && _dObj.tbl_key) { _bkk.value = _dObj.tbl_key; diszSel.innerHTML = bkDiszOpts(_dObj.tbl_key); }
            for (var i = 0; i < diszSel.options.length; i++) {
              if (String(diszSel.options[i].value) === String(row.diszMid)) {
                diszSel.value = diszSel.options[i].value; _matched = true; break;
              }
            }
          }
        }
      }
      // 2. Fallback: Namens-Match (nur wenn diszMid nicht gefunden)
      if (!_matched && row.disziplin) {
        for (var i = 0; i < diszSel.options.length; i++) {
          if (diszSel.options[i].text.indexOf(row.disziplin) >= 0 ||
              diszSel.options[i].value === row.disziplin) {
            diszSel.value = diszSel.options[i].value; _matched = true; break;
          }
        }
      }
      bkSyncDiszDisplay(tr);
      // Keine System-Disziplin gefunden (z.B. "6,6km" existiert noch nicht) → Rohtext
      // trotzdem im Suchfeld anzeigen statt leer zu lassen, damit sichtbar bleibt was
      // erkannt wurde und die Disziplin bei Bedarf neu angelegt werden kann.
      if (!_matched && row.disziplin) {
        var _diszInp = tr.querySelector('.bk-disz-search');
        if (_diszInp) _diszInp.value = row.disziplin;
      }
    }
    // Ergebnis
    var resEl = tr.querySelector('.bk-res');
    if (resEl && row.resultat) resEl.value = fmtRes(row.resultat);
    // AK
    var akSel = tr.querySelector('.bk-ak');
    if (akSel && row.ak) { akSel.value = row.ak; akSel.dataset.importAk = row.ak; }
    // Jahrgang/Geschlecht aus dem Import merken → DLV-AK auch ohne Jahrgang am Athleten
    if (akSel) {
      if (row.year) akSel.dataset.importJahr = String(row.year);
      var _impG = row.geschlecht || (row.ak && /^[MWF]/i.test(row.ak) ? row.ak.charAt(0) : '');
      if (_impG) akSel.dataset.importG = (/^[WF]/i.test(_impG) ? 'W' : 'M');
    }
    // Platz
    var platzEl = tr.querySelector('.bk-platz');
    if (platzEl && row.platz) platzEl.value = row.platz;
    // Zusatzfelder aus dem Import (Startnummer, Gesamt-/Geschlechtsplatzierung)
    var snrEl = tr.querySelector('.bk-startnr');
    if (snrEl && row.startnummer) snrEl.value = row.startnummer;
    var pgEl = tr.querySelector('.bk-pos-ges');
    if (pgEl && row.posGesamt) pgEl.value = row.posGesamt;
    var pmEl = tr.querySelector('.bk-pos-mw');
    if (pmEl && row.posGeschlecht) pmEl.value = row.posGeschlecht;
    // Datum pro Zeile (_datumOverride aus Tag-Dialog, sonst row.datum)
    var _rowDatum = row._datumOverride || row.datum || '';
    if (_rowDatum) {
      var zdEl = tr.querySelector('.bk-zeilendatum');
      if (zdEl) {
        var _dm = _rowDatum.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        zdEl.value = _dm ? _dm[3] + '.' + _dm[2] + '.' + _dm[1] : _rowDatum;
      }
    }
    // Meisterschaft aus dem Import (Bezeichnung → Eintrag der Meisterschaftsliste)
    if (row.meisterschaft) {
      var _mid = _bkMstrIdFromLabel(row.meisterschaft);
      var mSel = tr.querySelector('.bk-mstr-sel');
      if (mSel && _mid) mSel.value = String(_mid);
      var mPl = tr.querySelector('.bk-mstr-platz');
      if (mPl && row.mstrPlatz) mPl.value = row.mstrPlatz;
    }

    // Extern-Checkbox
    var vereinInp = tr.querySelector('.bk-verein');
    if (vereinInp && row.extern) vereinInp.value = row.verein || '';
  });

  // Meisterschafts-Spalten einblenden, sobald mindestens eine Zeile eine trägt
  var _mstrRows = rows.filter(function(r) { return !!r.meisterschaft; });
  if (_mstrRows.length) {
    // Spalten immer in *allen* Zeilen einblenden – sonst fehlen den Zeilen ohne
    // Meisterschaft zwei Zellen und die restlichen Spalten verrutschen
    document.querySelectorAll('.bk-mstr-th').forEach(function(th) { th.style.display = ''; });
    document.querySelectorAll('#bulk-rows .bk-mstr').forEach(function(td) { td.style.display = ''; });
    var _unbekannt = {}, _erkannt = {};
    _mstrRows.forEach(function(r) {
      var id = _bkMstrIdFromLabel(r.meisterschaft);
      if (id) _erkannt[r.meisterschaft] = id; else _unbekannt[r.meisterschaft] = true;
    });
    // Steht nur eine Meisterschaft im Import, auch das globale Feld setzen
    var _ids = Object.keys(_erkannt).map(function(k) { return _erkannt[k]; });
    var _gSel = document.getElementById('bk-mstr-global');
    if (_gSel && _ids.length === 1 && Object.keys(_unbekannt).length === 0) _gSel.value = String(_ids[0]);
    Object.keys(_erkannt).forEach(function(n) {
      notify('Meisterschaft erkannt: ' + n + ' → „' + mstrLabel(_erkannt[n]) + '"', 'ok');
    });
    Object.keys(_unbekannt).forEach(function(n) {
      notify('Meisterschaft „' + n + '" ist nicht in der Meisterschaftsliste – bitte in der Vorschau auswählen.', 'err');
      _bkDbgLine('Meisterschaft unbekannt', n);
    });
  }

  // Zeilennummern neu durchzählen
  var allRows = tbody.querySelectorAll('tr');
  for (var ni = 0; ni < allRows.length; ni++) {
    var numCell = allRows[ni].querySelector('td:first-child');
    if (numCell) numCell.textContent = ni + 1;
  }

  // AK nach DLV-System angleichen wenn Checkbox aktiv (nutzt Jahrgang aus
  // Athletenstammsatz oder ersatzweise aus dem Import)
  var akAnglEl2 = document.getElementById('bk-ak-angleichen');
  if (!akAnglEl2 || akAnglEl2.checked) bkApplyDlvAK(true);

  if (statusEl) statusEl.textContent = '✅ ' + rows.length + ' Zeilen eingefügt';
  // Einlesen-Button verstecken, Aktions-Buttons zeigen
  var einlesenBtn = document.getElementById('bk-einlesen-btn');
  if (einlesenBtn) einlesenBtn.style.display = 'none';
  var actionDiv = document.getElementById('bk-post-import-actions');
  if (actionDiv) actionDiv.style.display = 'flex';
  // Paste-Feld leeren
  var pasteEl = document.getElementById('bk-paste-area');
  if (pasteEl) pasteEl.value = '';
  var katWrap = document.getElementById('bk-import-kat-wrap');
  if (katWrap) katWrap.style.display = 'none';

  // Zum Schluss gegen die Datenbank abgleichen: existiert die Veranstaltung schon?
  await bkAutoSelectVeranstaltung();
}


// Athleten ohne Jahrgang: Jahrgang aus dem Import (Jg.-Spalte) in die Stammdaten
// übernehmen. Widersprüchliche Angaben innerhalb eines Imports werden ausgelassen.
async function bkNachtragenJahrgang(rows, nameMap) {
  if (!currentUser || (currentUser.rolle !== 'admin' && currentUser.rolle !== 'editor')) return;
  var athleten = state.athleten || [];
  var maxJahr  = new Date().getFullYear();
  var kandidaten = {};   // athlet_id → Jahrgang (null = widersprüchlich)

  rows.forEach(function(row) {
    if (!row.name || !row.year) return;
    var jahr = parseInt(row.year, 10);
    if (!jahr || jahr < 1900 || jahr > maxJahr) return;
    var id = uitsAutoMatch(row.name, athleten);
    if (!id && nameMap && nameMap[row.name]) id = nameMap[row.name];
    if (!id) return;
    var a = athleten.find(function(x) { return String(x.id) === String(id); });
    if (!a || a.geburtsjahr) return;   // schon gepflegt → nichts anfassen
    if (kandidaten[id] === undefined) kandidaten[id] = jahr;
    else if (kandidaten[id] !== jahr) kandidaten[id] = null;
  });

  var ids = Object.keys(kandidaten).filter(function(id) { return !!kandidaten[id]; });
  if (!ids.length) return;

  var namen = [];
  for (var i = 0; i < ids.length; i++) {
    var r = await apiPut('athleten/' + ids[i], { geburtsjahr: kandidaten[ids[i]] });
    if (r && r.ok) {
      var a2 = athleten.find(function(x) { return String(x.id) === String(ids[i]); });
      if (a2) a2.geburtsjahr = kandidaten[ids[i]];
      if (a2) namen.push((a2.name_nv || '?') + ' (' + kandidaten[ids[i]] + ')');
      _bkDbgLine('Jahrgang ergänzt', (a2 ? a2.name_nv : ids[i]) + ' → ' + kandidaten[ids[i]]);
    }
  }
  if (namen.length) {
    notify('Jahrgang aus dem Import ergänzt: ' + namen.slice(0, 5).join(', ') +
           (namen.length > 5 ? ' und ' + (namen.length - 5) + ' weitere' : ''), 'ok');
  }
}

// ── Seltec / Track&Field PDF Importer ────────────────────────────────────────

function bulkPdfDragOver(e) {
  // Safari liefert dataTransfer.items während dragover nicht → types prüfen
  var types = e.dataTransfer && e.dataTransfer.types;
  var hasFiles = types && (typeof types.contains === 'function' ? types.contains('Files') : Array.prototype.indexOf.call(types, 'Files') >= 0);
  if (!hasFiles) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
  var ta = document.getElementById('bk-paste-area');
  if (ta) ta.style.borderColor = 'var(--primary, #1976d2)';
}

function bulkPdfDragLeave(e) {
  var ta = document.getElementById('bk-paste-area');
  if (ta) ta.style.borderColor = '';
}

function bulkPdfDrop(e) {
  e.preventDefault(); // immer zuerst – verhindert Safari-Default (Pfad als Text einfügen)
  var ta = document.getElementById('bk-paste-area');
  if (ta) ta.style.borderColor = '';
  var files = e.dataTransfer ? Array.from(e.dataTransfer.files || []) : [];
  var statusEl = document.getElementById('bk-import-status');
  var htmlFile = files.find(function(f) { return /\.html?$/i.test(f.name) || f.type === 'text/html'; });
  if (htmlFile) {
    _bkDebugInit(htmlFile.name, 'Seltec HTML', '');
    htmlFile.arrayBuffer().then(function(buf) {
      return _seltecProcessHtml(_seltecDecodeHtmlBytes(buf), htmlFile.name, statusEl);
    }).catch(function(err) {
      if (statusEl) statusEl.textContent = '❌ ' + err.message;
      _bkDbgLine('Fehler', err.message);
    });
    return;
  }
  var file = files.find(function(f) {
    return f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
  });
  if (!file) return;
  _bkDebugInit(file.name, 'Ergebnis-PDF', '');
  bulkImportFromSeltecPdf(file, statusEl);
}

async function _seltecLoadPdfJs() {
  if (window.pdfjsLib) return window.pdfjsLib;
  return new Promise(function(resolve, reject) {
    var s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    s.crossOrigin = 'anonymous';
    s.onload = function() {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      resolve(window.pdfjsLib);
    };
    s.onerror = function() { reject(new Error('PDF.js konnte nicht geladen werden')); };
    document.head.appendChild(s);
  });
}

async function bulkImportFromSeltecPdf(file, statusEl) {
  var einlesenBtn = document.getElementById('bk-einlesen-btn');
  if (einlesenBtn) einlesenBtn.style.display = 'none';
  try {
    if (statusEl) statusEl.textContent = '⏳ Lade PDF.js…';
    var pdfjs = await _seltecLoadPdfJs();

    if (statusEl) statusEl.textContent = '⏳ Lese PDF…';
    var arrayBuffer = await file.arrayBuffer();
    await _seltecProcessArrayBuffer(arrayBuffer, file.name, pdfjs, statusEl);
  } catch(e) {
    if (statusEl) statusEl.textContent = '❌ ' + e.message;
    _bkDbgLine('Fehler', e.message);
  } finally {
    if (einlesenBtn) einlesenBtn.style.display = '';
  }
}

async function bulkImportFromSeltecPdfUrl(url, statusEl) {
  if (statusEl) statusEl.textContent = '⏳ Lade PDF.js…';
  var pdfjs = await _seltecLoadPdfJs();
  if (statusEl) statusEl.textContent = '⏳ Lade PDF…';
  var resp = await fetch('api/?_route=pdf-fetch&url=' + encodeURIComponent(url));
  if (!resp.ok) {
    var errData = await resp.json().catch(function() { return {}; });
    throw new Error(errData.fehler || 'HTTP ' + resp.status);
  }
  var arrayBuffer = await resp.arrayBuffer();
  await _seltecProcessArrayBuffer(arrayBuffer, url, pdfjs, statusEl);
}

// ── Seltec / Track&Field HTML-Export (ältere Darstellung, .htm) ──────────────
// Aufbau: Kopf-Tabelle (Veranstaltung + "Ort, am DD.MM.YYYY"), danach je Bewerb
// ein <p class="ev1"> mit "50m, weibliche Kinder U10 - Zeitläufe" und <pre>-Blöcke
// mit den AK-Untersektionen ("Kinder W9 - Zeitläufe") und Ergebniszeilen.
// Der Textinhalt entspricht dem PDF-Format 2018 → gleicher Parser, nur ohne
// "Rk. StNr."-Kopfzeilen und mit auf 30 Zeichen gekürzten AK-Titeln.

var _SELTEC_ENTITIES = {
  nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  auml: 'ä', ouml: 'ö', uuml: 'ü', Auml: 'Ä', Ouml: 'Ö', Uuml: 'Ü',
  szlig: 'ß', eacute: 'é', egrave: 'è', agrave: 'à', ccedil: 'ç',
  ndash: '–', mdash: '—', shy: '', laquo: '«', raquo: '»'
};

function _seltecDecodeEntities(s) {
  return s.replace(/&(#x?[0-9A-Fa-f]+|[A-Za-z]+);/g, function(all, ent) {
    if (ent.charAt(0) === '#') {
      var code = ent.charAt(1) === 'x' || ent.charAt(1) === 'X'
        ? parseInt(ent.slice(2), 16) : parseInt(ent.slice(1), 10);
      return isNaN(code) ? all : String.fromCharCode(code);
    }
    return _SELTEC_ENTITIES[ent] !== undefined ? _SELTEC_ENTITIES[ent] : all;
  });
}

function _seltecHtmlToLines(html) {
  var h = html;
  h = h.replace(/<head[\s\S]*?<\/head>/gi, '');
  h = h.replace(/<script[\s\S]*?<\/script>/gi, '');
  h = h.replace(/<style[\s\S]*?<\/style>/gi, '');
  h = h.replace(/<!--[\s\S]*?-->/g, '');
  // Navigation: Klassen-Menü und Menüleiste enthalten Disziplin-Namen ohne
  // Ergebnisse und würden sonst als Sektions-Header gelesen
  h = h.replace(/<div[^>]*class="menu"[^>]*>[\s\S]*?<\/div>/gi, '');
  h = h.replace(/<td[^>]*class="tdMBar"[^>]*>[\s\S]*?<\/td>/gi, '');
  // <pre>-Inhalte sichern – dort sind Zeilenumbrüche echte Trennzeichen
  var pres = [];
  h = h.replace(/<pre\b[^>]*>([\s\S]*?)<\/pre>/gi, function(all, inner) {
    pres.push(inner);
    return '\n@@SELTECPRE' + (pres.length - 1) + '@@\n';
  });
  // Manche Exporte legen die Ergebnisse nicht in <pre>, sondern in Tabellen
  // (<td class="hdPos/hdName/hdPerf">) – dort steht jede Zelle im Quelltext auf
  // einer eigenen Zeile. Innerhalb einer <tr> sind Umbrüche daher reine
  // Formatierung und werden entfernt, damit die Zeile zusammenbleibt.
  // Word-Exporte packen jede Zelle zusätzlich in <p>/<span> – deren Ende darf
  // die Zeile ebenfalls nicht umbrechen (nur <br> bleibt ein echter Umbruch)
  h = h.replace(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi, function(all, inner) {
    return '\n' + inner.replace(/<\/(p|span|div|li|h[1-6])\s*>/gi, ' ')
                       .replace(/[\r\n\t]+/g, ' ') + '\n';
  });
  h = h.replace(/<br\s*\/?>/gi, '\n');
  h = h.replace(/<\/(td|th)>/gi, ' ');
  h = h.replace(/<\/(p|div|tr|table|h1|h2|h3|span|li)>/gi, '\n');
  h = h.replace(/<[^>]*>/g, '');
  h = h.replace(/@@SELTECPRE(\d+)@@/g, function(all, idx) {
    return pres[+idx].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '');
  });
  h = _seltecDecodeEntities(h);
  return h.split(/\r?\n/).map(function(l) {
    // Mehrfach-Leerzeichen zusammenziehen – Word-Exporte trennen die Zellen
    // durch etliche Leerzeichen und Tabulatoren
    return l.replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
  }).filter(function(l) { return !!l; });
}

function _seltecIsHtml(text) {
  return /<\s*(html|body|pre|table)\b/i.test(text || '');
}

// HTML-Bytes dekodieren – ältere Seltec-Exporte sind windows-1252 kodiert
function _seltecDecodeHtmlBytes(buf) {
  var bytes = new Uint8Array(buf);
  var utf8 = new TextDecoder('utf-8').decode(bytes);
  var metaM = utf8.match(/charset\s*=\s*["']?\s*([\w-]+)/i);
  var cs = (metaM ? metaM[1] : '').toLowerCase();
  var isLatin = cs === 'windows-1252' || cs === 'iso-8859-1' || cs === 'iso-8859-15';
  if (!isLatin && utf8.indexOf('�') < 0) return utf8;
  try { return new TextDecoder(isLatin ? cs : 'windows-1252').decode(bytes); }
  catch(e) { return utf8; }
}

async function bulkImportFromSeltecHtmlUrl(url, statusEl) {
  if (statusEl) statusEl.textContent = '⏳ Lade Ergebnisseite…';
  var resp = await fetch('api/?_route=pdf-fetch&url=' + encodeURIComponent(url));
  if (!resp.ok) {
    var errData = await resp.json().catch(function() { return {}; });
    throw new Error(errData.fehler || 'HTTP ' + resp.status);
  }
  var buf = await resp.arrayBuffer();
  await _seltecProcessHtml(_seltecDecodeHtmlBytes(buf), url, statusEl);
}

async function _seltecProcessHtml(html, sourceLabel, statusEl) {
  if (statusEl) statusEl.textContent = '⏳ Lese Ergebnisse…';
  var allLines = _seltecHtmlToLines(html);
  var _istStr = _seltecStrIsListe(allLines);
  _bkDbgLine('HTML-Zeilen', allLines.length);
  _bkDbgLine('Format', _istStr ? 'Seltec Straßenlauf-Ergebnisliste (HTML-Export)'
                               : 'Seltec / Track&Field (HTML-Export)');
  // Der HTML-Export hat keine "Rk. StNr."-Kopfzeilen → Ergebniszeilen folgen
  // direkt auf den Sektions-Titel
  var parsed = _istStr ? _parseSeltecStrassenLines(allLines)
                       : _parseSeltecLines(allLines, { autoResults: true });
  await _seltecFinishImport(parsed, sourceLabel, statusEl);
}

async function _seltecProcessArrayBuffer(arrayBuffer, sourceLabel, pdfjs, statusEl) {
    var pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;

    if (statusEl) statusEl.textContent = '⏳ Extrahiere Text (' + pdf.numPages + ' Seiten)…';

    var allLines = [];
    for (var p = 1; p <= pdf.numPages; p++) {
      var page = await pdf.getPage(p);
      var tc = await page.getTextContent();
      var yGroups = {};
      tc.items.forEach(function(item) {
        if (!item.str) return;
        var y = Math.round(item.transform[5] / 2) * 2;
        if (!yGroups[y]) yGroups[y] = [];
        yGroups[y].push({ x: item.transform[4], str: item.str, w: item.width || 0 });
      });
      var ys = Object.keys(yGroups).map(Number).sort(function(a, b) { return b - a; });
      ys.forEach(function(y) {
        var items = yGroups[y].sort(function(a, b) { return a.x - b.x; });
        // Manche PDFs liefern jedes Wort als eigenes Item ohne Leerzeichen →
        // bei sichtbarer Lücke zwischen zwei Items ein Leerzeichen einfügen
        var line = '';
        items.forEach(function(it, idx) {
          if (idx > 0) {
            var prev = items[idx - 1];
            var gap = it.x - (prev.x + prev.w);
            if (gap > 1 && !/\s$/.test(line) && !/^\s/.test(it.str)) line += ' ';
          }
          line += it.str;
        });
        line = line.replace(/\s+/g, ' ').trim();
        if (line) allLines.push(line);
      });
    }

    // Volkslauf-Ergebnisliste (Spalten AKPl/Startnr./Name/Jahrg./m/w/Verein/Zeit) –
    // eigenes Format, nicht Seltec → eigener Parser ohne Header-Merge
    var isVolks = _volksIsListe(allLines);
    // Seltec-Straßenlauf ("Rg. StNr. Name, Vorname … Zeit Diff Klasse") – ebenfalls
    // ohne Header-Merge, da die Sektionstitel einzeilig sind
    var isStr = !isVolks && _seltecStrIsListe(allLines);

    // Mehrzeilige Abschnitts-Header zusammenfügen (PDF bricht Zeilen oft um, z.B.
    // "weibliche Jugend U18 -" + "Zeitläufe" oder "männliche" + "Jugend" + "U18 -" + "Zeitläufe")
    var _changed = !isVolks && !isStr;
    while (_changed) {
      _changed = false;
      var _merged = [];
      for (var _mi = 0; _mi < allLines.length; _mi++) {
        var _l = allLines[_mi];
        if (_merged.length > 0) {
          var _prev = _merged[_merged.length - 1];
          var _lkw = /^(Zeitl[äa]ufe|Finale|Vorlauf|Zeitlauf|Endkampf|Endlauf)\b/i;
          var _zkw = /- ?(Zeitl[äa]ufe|Finale|Vorlauf|Zeitlauf|Endkampf|Endlauf)/i;
          // A: "... U18 -" + "Zeitläufe"
          if (/[-–]\s*$/.test(_prev) && _lkw.test(_l)) {
            _merged[_merged.length - 1] = _prev.replace(/\s*[-–]\s*$/, '') + ' - ' + _l.trim();
            _changed = true; continue;
          }
          // B: "...Jugend" + "U18 - Zeitläufe" oder "U18"
          if (!/\d{2}\.\d{2}/.test(_prev) && /^U\d+/.test(_l) && (_zkw.test(_l) || _lkw.test(_l))) {
            _merged[_merged.length - 1] = _prev.trim() + ' ' + _l.trim();
            _changed = true; continue;
          }
          // C: "männliche"/"weibliche" allein + "Jugend..."
          if (/^(männliche?|weibliche?)\s*$/i.test(_prev) && /^Jugend\b/i.test(_l)) {
            _merged[_merged.length - 1] = _prev.trim() + ' ' + _l.trim();
            _changed = true; continue;
          }
        }
        _merged.push(_l);
      }
      allLines = _merged;
    }

    _bkDbgLine('PDF-Zeilen', allLines.length);
    _bkDbgLine('Format', isVolks ? 'Volkslauf-Ergebnisliste'
                       : isStr   ? 'Seltec Straßenlauf-Ergebnisliste'
                                 : 'Seltec / Track&Field');

    var parsed = isVolks ? _parseVolkslaufLines(allLines, sourceLabel)
               : isStr   ? _parseSeltecStrassenLines(allLines)
                         : _parseSeltecLines(allLines);

    await _seltecFinishImport(parsed, sourceLabel, statusEl);
}

// Gemeinsamer Abschluss für PDF- und HTML-Import: Debug-Ausgabe, Event-Felder
// vorbelegen, Athleten sammeln, auf eigenen Verein filtern und Vorschau füllen.
async function _seltecFinishImport(parsed, sourceLabel, statusEl) {
    _bkDbgLine('Event', parsed.eventName || '(keiner)');
    _bkDbgLine('Datum', parsed.date || '(keins)');
    _bkDbgLine('Ort', parsed.location || '(keiner)');
    _bkDbgLine('Eigener Verein', parsed.ownClub || '(unbekannt)');
    if (parsed.dateWarn) {
      _bkDbgLine('Abweichendes Bewerbsdatum ignoriert', parsed.dateWarn + ' → ' + parsed.date + ' (aus dem Listenkopf)');
    }
    _bkDbgLine('Sektionen', parsed.sections.length);
    parsed.sections.forEach(function(s) {
      _bkDbgLine('  ' + s.disziplin, s.athletes.length + ' Zeilen, ' + s.date);
    });

    if (!parsed.sections.length) {
      if (statusEl) statusEl.textContent = '❌ Kein bekanntes Ergebnis-Format erkannt';
      return;
    }

    // Auto-fill event fields
    var datEl = document.getElementById('bk-datum');
    if (datEl && parsed.date) { datEl.value = parsed.date; bkSyncDatum(parsed.date); }
    var evnEl = document.getElementById('bk-evname');
    if (evnEl && !evnEl.value && parsed.eventName) evnEl.value = parsed.eventName;
    var quelleEl = document.getElementById('bk-quelle');
    if (quelleEl && !quelleEl.value) quelleEl.value = sourceLabel;
    if (parsed.location) {
      // Ersten Teil vor Komma als Ort (z.B. "Grefrath, Nierskampfbahn" → "Grefrath")
      _bkAutoSetOrt(parsed.location.split(',')[0].trim());
    }

    var kat = ((document.getElementById('bk-kat') || {}).value || '');

    // Collect all athletes across sections
    var allAthletes = [];
    var _diszOffen = {};
    parsed.sections.forEach(function(sec) {
      var dResult = sec.diszCands ? _volksFindDisz(sec.diszCands, kat, sec.diszExact)
                                  : _seltecFindDisz(sec.disziplin, kat);
      if (!dResult.diszMid) {
        var _k = (dResult.disz || sec.disziplin || '?');
        _diszOffen[_k] = (_diszOffen[_k] || 0) + sec.athletes.length;
      }
      sec.athletes.forEach(function(ath) {
        allAthletes.push({
          name:      ath.name,
          year:      ath.year,
          geschlecht: ath.geschlecht,
          resultat:  ath.resultat,
          datum:     sec.date || parsed.date,
          disziplin: dResult.disz || sec.disziplin,
          diszMid:   dResult.diszMid,
          platz:     ath.platz,
          verein:    ath.verein,
          ownClub:   ath.ownClub,
          ak:        ath.ak || sec.ak || '',
          meisterschaft: sec.meisterschaft || '',
          mstrPlatz: sec.meisterschaft ? ath.platz : 0
        });
      });
    });

    Object.keys(_diszOffen).forEach(function(d) {
      _bkDbgLine('Disziplin nicht zugeordnet', d + ' (' + _diszOffen[d] + ' Zeilen) – in den Disziplinen der gewählten Kategorie nicht gefunden');
    });

    // Meisterschafts-Wertungen wiederholen dieselben Ergebnisse ein zweites Mal
    // (z.B. "Kreismeisterschaft Niederrhein-West" nach dem regulären Bewerb) →
    // identische Zeilen (Name/Disziplin/Datum/Leistung) nur einmal übernehmen
    // Wird ein Bewerb zusätzlich als Meisterschaft gewertet, stehen dieselben
    // Ergebnisse zweimal in der Liste – einmal mit AK-Platz, einmal mit
    // Meisterschafts-Platz. Beides wird in einer Zeile zusammengeführt.
    var _gesehen = {}, _dubl = 0;
    allAthletes = allAthletes.filter(function(a) {
      var key = [a.name, a.disziplin, a.datum, a.resultat].join('|').toLowerCase();
      var keep = _gesehen[key];
      if (keep) {
        _dubl++;
        // Meisterschaften listen die Ergebnisse oft zweimal: einmal je Geschlecht
        // und einmal je Altersklasse. Für den MS-Platz zählt die Wertung, deren
        // Altersklasse zur Zeile passt.
        var _akGenau = !!(a.ak && keep.ak && a.ak.toUpperCase() === keep.ak.toUpperCase());
        if (a.meisterschaft && !keep.meisterschaft) {
          keep.meisterschaft = a.meisterschaft;
          keep.mstrPlatz = a.platz;
          keep._mstrAkGenau = _akGenau;
        } else if (a.meisterschaft && keep.meisterschaft && _akGenau && !keep._mstrAkGenau) {
          keep.mstrPlatz = a.platz;
          keep._mstrAkGenau = true;
        } else if (keep.meisterschaft && !a.meisterschaft) {
          // Meisterschafts-Block kam zuerst → AK-Platz und -Klasse nachtragen
          keep.mstrPlatz = keep.mstrPlatz || keep.platz;
          keep.platz = a.platz;
          if (a.ak) keep.ak = a.ak;
        }
        return false;
      }
      _gesehen[key] = a;
      return true;
    });

    _bkDbgLine('Athleten gesamt', allAthletes.length + (_dubl ? ' (' + _dubl + ' Doppelnennungen entfernt)' : ''));

    // Jedermann-, Bambini- und Schülerläufe führen keine Klasse-Spalte → weder
    // Geschlecht noch AK. Geschlecht aus dem Athletenstammsatz holen und die AK
    // aus Jahrgang + Veranstaltungsjahr berechnen.
    var _athListe = state.athleten || [];
    function _athZuName(name) {
      if (!_athListe.length || !name) return null;
      var id = uitsAutoMatch(name, _athListe);
      if (!id) return null;
      return _athListe.find(function(x) { return String(x.id) === String(id); }) || null;
    }
    var _akErg = 0;
    allAthletes.forEach(function(a) {
      if (!a.geschlecht) {
        var _a = _athZuName(a.name);
        if (_a && _a.geschlecht) a.geschlecht = _a.geschlecht;
      }
      if (!a.ak && a.year && a.geschlecht) {
        var _evJahr = parseInt(String(a.datum || parsed.date || '').slice(0, 4), 10);
        var _ak = _evJahr ? calcDlvAK(parseInt(a.year, 10), a.geschlecht, _evJahr) : '';
        if (_ak) { a.ak = _ak; _akErg++; }
      }
    });
    if (_akErg) _bkDbgLine('AK berechnet', _akErg + ' Zeilen aus Jahrgang');

    var _mstrNamen = {};
    allAthletes.forEach(function(a) { if (a.meisterschaft) _mstrNamen[a.meisterschaft] = (_mstrNamen[a.meisterschaft] || 0) + 1; });
    Object.keys(_mstrNamen).forEach(function(n) {
      _bkDbgLine('Meisterschaft', n + ' (' + _mstrNamen[n] + ' Ergebnisse)');
    });

    // Vereinsathleten übernehmen – dazu bekannte Athleten, die für einen anderen
    // Verein oder eine Schule gestartet sind (→ externes Ergebnis). Damit ein
    // häufiger Name nicht auf einen fremden Läufer anschlägt, muss der Jahrgang
    // passen, sofern er in Stammsatz und Ergebnisliste steht.
    allAthletes.forEach(function(a) {
      if (a.ownClub) return;
      var _a = _athZuName(a.name);
      if (!_a) return;
      if (_a.geburtsjahr && a.year && String(_a.geburtsjahr) !== String(a.year)) return;
      a._externTreffer = true;
    });
    var ownRows    = allAthletes.filter(function(a) { return a.ownClub; });
    var externRows = allAthletes.filter(function(a) { return !a.ownClub && a._externTreffer; });
    var rowsToImport = allAthletes.filter(function(a) { return a.ownClub || a._externTreffer; });
    _bkDbgLine('Vereinstreffer', ownRows.length);
    if (externRows.length) {
      _bkDbgLine('Extern-Treffer', externRows.length + ' (bekannte Athleten für anderen Verein)');
      externRows.forEach(function(a) { _bkDbgLine('  ' + a.name, a.verein || '(ohne Verein)'); });
    }

    if (!rowsToImport.length) {
      _bkDbgLine('Hinweis', 'Keine Treffer. Erste 20 Athleten:');
      allAthletes.slice(0, 20).forEach(function(a) { _bkDbgLine('  ' + a.name, a.verein); });
      if (statusEl) statusEl.textContent = '❌ Keine Vereinsathleten gefunden – Debug-Log prüfen';
      return;
    }

    var bulkRows = rowsToImport.map(function(row) {
      return {
        name:      row.name,
        year:      row.year,
        geschlecht: row.geschlecht,
        resultat:  row.resultat,
        ak:        row.ak || '',
        platz:     row.platz,
        disziplin: row.disziplin,
        diszMid:   row.diszMid,
        datum:     row.datum,
        extern:    !row.ownClub,
        verein:    row.ownClub ? '' : row.verein,
        meisterschaft: row.meisterschaft || '',
        mstrPlatz: row.mstrPlatz || (row.meisterschaft ? row.platz : 0)
      };
    });

    await bulkFillFromImport(bulkRows, statusEl);

    // Hinweis auf Disziplinen, die in der Vorschau wirklich leer geblieben sind
    bkRenderUnknownDisz(bkCollectUnknownDisz(), kat);
}

// ── Unbekannte Disziplinen aus einem Import ─────────────────────────────────

// Rohnamen der Importzeilen, deren Disziplin-Auswahl leer geblieben ist
function bkCollectUnknownDisz() {
  var namen = [];
  Array.prototype.forEach.call(document.querySelectorAll('#bulk-rows .bk-disz'), function(sel) {
    var imp = sel.getAttribute('data-import-disz');
    if (!sel.value && imp && namen.indexOf(imp) < 0) namen.push(imp);
  });
  return namen;
}

function bkRenderUnknownDisz(namen, kat) {
  var box = document.getElementById('bk-unknown-disz');
  if (!box) return;
  namen = (namen || []).filter(function(n) { return !!n; });
  if (!namen.length) { box.style.display = 'none'; box.innerHTML = ''; return; }

  var chips = namen.map(function(n) {
    return '<button class="btn btn-ghost btn-sm" style="border-radius:20px" title="Zuordnen oder anlegen" ' +
           'onclick="bkUnknownDiszModal(' + JSON.stringify(n).replace(/"/g, '&quot;') + ',' + JSON.stringify(kat || '').replace(/"/g, '&quot;') + ')">' +
           '&#x270E; <strong>' + _esc(n) + '</strong></button>';
  }).join(' ');

  box.innerHTML =
    '<div style="padding:10px 12px;background:var(--surf2);border:1px solid var(--border);border-radius:8px">' +
      '<div style="font-size:12px;color:var(--text2);margin-bottom:8px">' +
        '&#x26A0;&#xFE0F; ' + namen.length + ' Disziplin' + (namen.length === 1 ? '' : 'en') + ' konnte' + (namen.length === 1 ? '' : 'n') +
        ' nicht zugeordnet werden. Die betroffenen Zeilen haben kein Disziplinfeld. ' +
        'Zum Zuordnen oder Anlegen anklicken:' +
      '</div>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">' + chips + '</div>' +
    '</div>';
  box.style.display = '';
}

// Name aus dem Import säubern: "ca. 400m" → "400m", "400 m (Bahn)" → "400 m"
function bkDiszCleanName(name) {
  return String(name || '')
    .replace(/^\s*(ca\.?|circa|etwa|ungef[äa]hr|approx\.?|~)\s*/i, '')
    .replace(/\s*\([^)]*\)\s*$/, '')
    .trim();
}

// Bester Vorschlag für einen unbekannten Rohnamen
function bkDiszVorschlag(name, kat) {
  var norm = function(s) { return String(s || '').toLowerCase().replace(/[\s.]/g, ''); };
  var ziel = norm(bkDiszCleanName(name));
  if (!ziel) return null;
  var alle = state.disziplinen || [];
  var erlaubt = bkKatMitGruppen(kat);
  // Treffer in der aktiven Kategorie (inkl. Gruppenpartner) bevorzugen
  var sortiert = alle.slice().sort(function(a, b) {
    var ain = erlaubt && erlaubt.indexOf(a.tbl_key) >= 0 ? 0 : 1;
    var bin = erlaubt && erlaubt.indexOf(b.tbl_key) >= 0 ? 0 : 1;
    return ain - bin;
  });
  return sortiert.find(function(d) { return norm(d.disziplin) === ziel; }) ||
         sortiert.find(function(d) { var n = norm(d.disziplin); return n && (n.indexOf(ziel) === 0 || ziel.indexOf(n) === 0); }) ||
         null;
}

function bkUnknownDiszModal(name, kat) {
  var istAdmin = currentUser && currentUser.rolle === 'admin';
  var alle = (state.disziplinen || []);
  var vorschlag = bkDiszVorschlag(name, kat);
  var vorschlagMid = vorschlag ? (vorschlag.id || vorschlag.mapping_id) : 0;

  var opts = '';
  alle.forEach(function(d) {
    var mid = d.id || d.mapping_id;
    opts += '<option value="' + mid + '"' + (String(mid) === String(vorschlagMid) ? ' selected' : '') + '>' +
            _esc(d.disziplin) + ' (' + _esc(d.kategorie || d.tbl_key || '') + ')</option>';
  });

  showModal(
    modalH2('&#x270E; Disziplin zuordnen') +
    '<div style="font-size:13px;color:var(--text2);margin-bottom:12px">' +
      'Aus dem Import kam <strong>' + _esc(name) + '</strong>. ' +
      'Wähle die passende Disziplin &ndash; alle betroffenen Zeilen werden gesetzt.' +
    '</div>' +
    (vorschlag
      ? '<div style="font-size:12px;color:var(--text2);margin-bottom:8px">Vorschlag: <strong>' + _esc(vorschlag.disziplin) + '</strong> (' + _esc(vorschlag.kategorie || '') + ')</div>'
      : '') +
    '<div class="form-group full" style="margin-bottom:12px">' +
      '<input type="text" id="bk-ud-filter" placeholder="&#x1F50D; Disziplin suchen&hellip;" oninput="bkUnknownDiszFilter(this.value)" ' +
        'style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px;background:var(--surface);color:var(--text);margin-bottom:6px"/>' +
      '<select id="bk-ud-sel" size="10" style="width:100%;padding:4px;border:1px solid var(--border);border-radius:6px;font-size:13px;background:var(--surface);color:var(--text)">' +
        opts +
      '</select>' +
    '</div>' +
    '<div class="modal-actions">' +
      '<button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button>' +
      (istAdmin
        ? '<button class="btn btn-ghost" onclick="bkUnknownDiszNeu(' + JSON.stringify(name).replace(/"/g, '&quot;') + ',' + JSON.stringify(kat || '').replace(/"/g, '&quot;') + ')">&#x2795; Neu anlegen&hellip;</button>'
        : '') +
      '<button class="btn btn-primary" onclick="bkUnknownDiszZuordnen(' + JSON.stringify(name).replace(/"/g, '&quot;') + ')">&#x2714; Zuordnen</button>' +
    '</div>'
  );

  setTimeout(function() {
    var sel = document.getElementById('bk-ud-sel');
    if (sel && sel.selectedIndex >= 0 && sel.options[sel.selectedIndex]) {
      sel.options[sel.selectedIndex].scrollIntoView({ block: 'center' });
    }
    var f = document.getElementById('bk-ud-filter');
    if (f) f.focus();
  }, 100);
}

function bkUnknownDiszFilter(q) {
  var sel = document.getElementById('bk-ud-sel');
  if (!sel) return;
  var ql = (q || '').toLowerCase().trim();
  for (var i = 0; i < sel.options.length; i++) {
    var o = sel.options[i];
    o.hidden = !!ql && o.text.toLowerCase().indexOf(ql) < 0;
  }
}

function bkUnknownDiszZuordnen(name) {
  var sel = document.getElementById('bk-ud-sel');
  var mid = sel ? sel.value : '';
  if (!mid) { notify('Bitte eine Disziplin wählen.', 'err'); return; }
  closeModal();
  bkDiszNachtragen(name, mid);
}

function bkUnknownDiszNeu(name, kat) {
  closeModal();
  bkNeueDiszAusImport(name, kat, bkDiszCleanName(name) || name);
}

// rawName = Name aus dem Import (Zuordnung der Zeilen), preName = Vorbelegung im Formular
async function bkNeueDiszAusImport(rawName, kat, preName) {
  // Kategorie-ID zur aktiven Importkategorie ermitteln (tbl_key → id)
  var katId = 0;
  try {
    var r = await apiGet('kategorien');
    if (r && r.ok) {
      var k = (r.data || []).find(function(x) { return x.tbl_key === kat; });
      if (k) katId = k.id;
    }
  } catch(e) {}
  showNeueDiszModal(katId, preName || rawName, function(neuMid) { bkDiszNachtragen(rawName, neuMid); });
}

// Nach dem Anlegen einer Disziplin: alle passenden Importzeilen nachträglich füllen
function bkDiszNachtragen(importName, mid) {
  if (!mid) return;
  var dObj = (state.disziplinen || []).find(function(d) { return (d.id || d.mapping_id) == mid; });
  var trs = document.querySelectorAll('#bulk-rows tr');
  var n = 0;
  Array.prototype.forEach.call(trs, function(tr) {
    var sel = tr.querySelector('.bk-disz');
    if (!sel || sel.value) return;
    if (sel.getAttribute('data-import-disz') !== importName) return;
    if (dObj && dObj.tbl_key) sel.innerHTML = bkDiszOpts(dObj.tbl_key);
    sel.value = String(mid);
    bkSyncDiszDisplay(tr);
    n++;
  });

  // Chip aus dem Hinweis entfernen
  var box = document.getElementById('bk-unknown-disz');
  if (box && box.style.display !== 'none') {
    bkRenderUnknownDisz(bkCollectUnknownDisz(), (document.getElementById('bk-kat') || {}).value || '');
  }
  if (n) notify(n + ' Zeile' + (n === 1 ? '' : 'n') + ' auf „' + (dObj ? dObj.disziplin : importName) + '“ gesetzt.', 'ok');
}

// opts.autoResults: Ergebniszeilen folgen direkt auf den Sektions-Titel, ohne
// dass eine "Rk. StNr."-Kopfzeile den Ergebnisteil einleitet (HTML-Export)
function _parseSeltecLines(lines, opts) {
  var autoRes = !!(opts && opts.autoResults);
  var eventName = '', location = '', date = '', ownClub = '';
  var sections = [];
  var akMap = {};          // name → AK-Code (aus "aus gemeinsamem Bewerb"-Sektionen)
  var currentSection = null;
  var currentDisziplin = '';   // Format 2018: Disziplin aus Haupt-Sektions-Titel
  var currentSectionDate = ''; // Format 2018: Datum aus "Datum:"-Zeile
  var inResults = false;
  var headerParsed = false;
  var isFieldEvent = false;
  var inSubSection = false; // gerade in einer "aus gemeinsamem Bewerb"-Sektion (Format 2019)
  var subSectionAk = '';
  var prevTitleLine = '';   // letzte Zeile vor einer Datumszeile (für geteilte Header)
  var currentMstr = '';     // Meisterschafts-Bezeichnung des aktuellen Blocks

  var ownVerL = ((appConfig && (appConfig.verein_name || appConfig.verein_kuerzel)) || '').toLowerCase();

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line) continue;

    // Footer – beide Formate
    var licM = line.match(/lizenziert f[üu]r\s+(.+)/i);
    if (licM) {
      // "Lizenziert für TuS Oedt   www.seltec.at" → nur der Vereinsname
      ownClub = licM[1].replace(/\s+Seite\s+\d+\s*$/, '')
                       .replace(/\s*(https?:\/\/)?www\..*$/i, '')
                       .replace(/\s+/g, ' ').trim();
      continue;
    }
    if (/^Dataservice by/i.test(line) || /^Gedruckt am /i.test(line)) continue;
    if (/^Erstellt durch SELTEC/i.test(line) || /^www\.seltec\./i.test(line)) continue;
    if (/^Rang\s+(StNr|Name)\b/i.test(line)) { inResults = true; continue; }
    if (/^Rk\.\s+StNr\b/i.test(line)) { inResults = true; continue; }
    if (/^Wind:/i.test(line)) continue;

    // Event-Header (erste zwei inhaltliche Zeilen auf Seite 1)
    // PDF.js kann "ERGEBNISSE" auf dieselbe y-Zeile wie den Ort legen →
    // "ERGEBNISSE" aus der Zeile entfernen, dann prüfen ob Datum vorhanden
    if (!headerParsed) {
      var stripped = line.replace(/\s*\bERGEBNISSE\b\s*/g, ' ').trim().replace(/\s+/g, ' ');
      // Format 2018: "<Ort>, am DD.MM.YYYY"
      var hdrDateAmM = stripped.match(/^(.+),\s*am\s*(\d{2})\.(\d{2})\.(\d{4})(?:\s|$)/);
      if (hdrDateAmM && !date) {
        date = hdrDateAmM[4] + '-' + hdrDateAmM[3] + '-' + hdrDateAmM[2];
        location = hdrDateAmM[1].trim();
        headerParsed = true;
        continue;
      }
      // Format 2019: "<Ort>, DD.MM.YYYY" (kein Uhrzeitanteil)
      var hdrDateM = stripped.match(/^(.+),\s*(\d{2})\.(\d{2})\.(\d{4})$/);
      if (hdrDateM && !date) {
        date = hdrDateM[4] + '-' + hdrDateM[3] + '-' + hdrDateM[2];
        location = hdrDateM[1].trim();
        headerParsed = true;
        continue;
      }
      // Veranstaltungsname: erste nicht-leere, nicht-numerische Zeile
      if (!eventName && stripped && !/^\d/.test(stripped)) {
        // Trailing-Jahr abschneiden ("Bahneröffnung 2019" → "Bahneröffnung")
        eventName = stripped.replace(/\s+\d{4}$/, '').trim();
      }
      // Kein continue – Zeile kann gleichzeitig Sektions-Header sein
    }

    // Format 2019: Sektions-Header mit Datum + Uhrzeit (DD.MM.YYYY / HH:MM)
    var sdM = line.match(/(\d{2})\.(\d{2})\.(\d{4})\s*\/\s*\d{2}:\d{2}/);
    if (sdM) {
      var sDate = sdM[3] + '-' + sdM[2] + '-' + sdM[1];
      var sTitle = line.replace(/\s*\d{2}\.\d{2}\.\d{4}\s*\/\s*\d{2}:\d{2}\s*/, '').trim();

      // PDF.js trennt manchmal Disziplinname und Datum in zwei y-Gruppen →
      // sTitle leer? → Vorherige Zeile als Titel verwenden
      if (!sTitle && prevTitleLine) sTitle = prevTitleLine;

      prevTitleLine = '';

      if (/aus gemeinsamem Bewerb/i.test(sTitle)) {
        // Sub-Sektion: nur AK-Mapping aufbauen, keine Zeilen hinzufügen
        inSubSection = true;
        inResults = false;
        currentSection = null;
        subSectionAk = _seltecAkFromTitle(sTitle);
        continue;
      }

      inSubSection = false; subSectionAk = '';

      var isCont = /[-–]\s*Fortsetzung/i.test(sTitle);
      sTitle = sTitle.replace(/\s*[-–]\s*Fortsetzung\s*/i, '').trim();
      var disziplin = _seltecDiszAusTitel(sTitle);

      if (/^\d+\s*x\s*\d+/i.test(disziplin)) { currentSection = null; inResults = false; continue; }

      isFieldEvent = _seltecIsField(disziplin);

      if (isCont && currentSection) {
        currentSection.date = currentSection.date || sDate;
        inResults = autoRes;
      } else {
        currentSection = { disziplin: disziplin, date: sDate, athletes: [], meisterschaft: currentMstr };
        sections.push(currentSection);
        inResults = autoRes;
      }
      continue;
    }

    // Format 2018: "Datum: DD.MM.YYYY  Beginn: HH:MM" – separate Datumszeile
    var datumLineM = line.match(/^Datum:\s*(\d{2})\.(\d{2})\.(\d{4})/);
    if (datumLineM) {
      currentSectionDate = datumLineM[3] + '-' + datumLineM[2] + '-' + datumLineM[1];
      if (!date) date = currentSectionDate;
      if (currentSection && !currentSection.date) currentSection.date = currentSectionDate;
      currentMstr = '';   // regulärer Bewerb – Datumszeile statt Meisterschafts-Zeile
      inResults = autoRes;
      continue;
    }

    // Format 2018: Sektions-Header endet mit "- Zeitläufe" / "- Finale" / "- Vorlauf" etc.
    // Wind-Info auf derselben Zeile abschneiden bevor der Titel verglichen wird
    var lineNoWind = line.replace(/\s*Wind:.*$/i, '').trim();
    // Der HTML-Export kürzt die Titelspalte auf 30 Zeichen ("... - Zeitläu") →
    // Schlüsselwörter auch abgeschnitten akzeptieren
    var ztM = lineNoWind.match(/^(.+?)\s*-\s*(Zeitl[äa]u\w*|Zeitlauf|Final\w*|Vorlauf|Endkampf|Endlauf)\s*$/i);
    if (ztM) {
      var ztTitle = ztM[1].trim();
      if (/,/.test(ztTitle)) {
        // Haupt-Sektions-Titel enthält Komma (z.B. "75m, weibliche Jugend U14" oder "Weitsprung, WMU18/20,...")
        var diszHaupt = _seltecDiszAusTitel(ztTitle);
        if (/^\d+\s*x\s*\d+/i.test(diszHaupt)) {
          // Staffel – überspringen
          currentDisziplin = ''; currentSection = null; inResults = false;
        } else {
          currentDisziplin = diszHaupt;
          isFieldEvent = _seltecIsField(diszHaupt);
          currentSection = null; // Athleten kommen in AK-Unter-Sektionen
          inResults = false;
          // Neuer Bewerb: die Meisterschafts-Zeile steht erst danach
          currentMstr = '';
        }
      } else if (currentDisziplin) {
        // AK-Unter-Sektion (z.B. "Jugend W12", "männliche Jugend U18", "Männer M45")
        var ak2018 = _seltecAkFromTitle(ztTitle);
        currentSection = { disziplin: currentDisziplin, date: currentSectionDate || date,
                           athletes: [], ak: ak2018, meisterschaft: currentMstr };
        sections.push(currentSection);
        inResults = autoRes;
      }
      continue;
    }

    // Meisterschafts-Zeile statt Datumszeile ("Kreismeisterschaft Kreis Kleve").
    // Seltec wiederholt die Ergebnisse eines Bewerbs in einem eigenen Block, wenn
    // daraus zusätzlich eine Meisterschaft gewertet wird.
    if (/meisterschaft/i.test(line) && line.length < 90 && !/^\d/.test(line)) {
      currentMstr = line.replace(/\s+/g, ' ').trim();
      currentSection = null;
      inResults = false;
      continue;
    }

    if (/^Finale/i.test(line)) { inResults = true; continue; }

    // Letzte nicht-spezielle Zeile merken (für geteilte Sektions-Header, Format 2019)
    if (!/^\d/.test(line)) prevTitleLine = line;

    if (!inResults) continue;

    var rM = line.match(/^(\d+)\.?\s+(\d+)\s+(.+)$/);
    if (!rM) continue;

    if (inSubSection && subSectionAk) {
      // Nur AK-Map befüllen
      var subAth = _parseSeltecAthRow(rM[3], false);
      if (subAth) akMap[subAth.name] = subSectionAk;
    } else if (currentSection) {
      var ath = _parseSeltecAthRow(rM[3], isFieldEvent);
      if (ath) {
        ath.platz = parseInt(rM[1]);
        var verL = ath.verein.toLowerCase();
        ath.ownClub = (ownVerL && verL.indexOf(ownVerL) >= 0) ||
                      (ownClub && verL.indexOf(ownClub.toLowerCase()) >= 0);
        currentSection.athletes.push(ath);
      }
    }
  }

  // AK aus Sub-Sektionen auf Hauptsektions-Athleten übertragen
  sections.forEach(function(sec) {
    sec.athletes.forEach(function(ath) {
      if (!ath.ak && akMap[ath.name]) ath.ak = akMap[ath.name];
    });
  });

  return { eventName: eventName, location: location, date: date, ownClub: ownClub, sections: sections };
}

// ── Seltec Straßenlauf-Ergebnisliste ────────────────────────────────────────
// Beispiel: "31. Oedter Straßenlauf" → "Grefrath, am 05.10.2013"
//   5-km-Jedermannlauf (5 km)              ← Lauf mit Distanz in Klammern
//   Datum: 05.10.2013 Beginn: 14:15
//   Rg. StNr. Name, Vorname  Jg. Nat.  Verein   Zeit Diff  Klasse
//   1. 311 Fröhling, Luca    1999      KSV Kevelaer  16:59        1. M14
// Die Klasse-Spalte liefert AK-Platz + Altersklasse; "Mannschaftswertung"-
// Abschnitte enthalten Teamzeiten und werden übersprungen.

// Word-Exporte setzen die Punkte in eigene Elemente ("Rg . StNr . Name")
var _SELTECSTR_HDR = /^Rg\s*\.\s*StNr\s*\.?\s*Name/i;
var _SELTECSTR_ROW = /^(\d{1,3})\.\s+(\d{1,6})\s+(.+)$/;

function _seltecStrIsListe(lines) {
  return lines.some(function(l) { return _SELTECSTR_HDR.test(l.trim()); }) &&
         lines.some(function(l) {
           var t = l.trim();
           return _SELTECSTR_ROW.test(t) && /\b(19|20)\d{2}\b/.test(t);
         });
}

function _parseSeltecStrassenLines(lines) {
  var eventName = '', location = '', date = '', ownClub = '';
  var sections = [];
  var currentSection = null;
  var currentRace = '', currentDist = '', currentDate = '', currentAk = '', currentGesch = '';
  var currentMstr = '';   // Meisterschafts-Bezeichnung aus dem Lauftitel
  var dateWarn = [];      // Bewerbsdaten, die nicht zum Kopfdatum passen
  var skipRace = false;   // Mannschaftswertung o.ä. → Zeilen ignorieren
  var headerParsed = false;

  var ownVerL = ((appConfig && (appConfig.verein_name || appConfig.verein_kuerzel)) || '').toLowerCase();

  function newSection() {
    currentSection = {
      disziplin: currentRace,
      diszCands: _volksDiszCands(currentDist || currentRace),
      diszExact: /walking|nordic/i.test(currentRace),
      date: currentDate || date,
      ak: currentAk,
      meisterschaft: currentMstr,
      athletes: []
    };
    sections.push(currentSection);
  }

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line) continue;

    var licM = line.match(/lizenziert f[üu]r\s+(.+)/i);
    if (licM) {
      ownClub = licM[1].replace(/\s+Seite\s+\d+\s*$/, '')
                       .replace(/\s*(https?:\/\/)?www\..*$/i, '')
                       .replace(/\s+/g, ' ').trim();
      continue;
    }
    if (/^Erstellt durch SELTEC/i.test(line) || /^www\.seltec\./i.test(line)) continue;
    if (/^Dataservice by/i.test(line) || /^Gedruckt am /i.test(line)) continue;
    if (/^\d+$/.test(line)) continue;                    // Seitenzahl
    if (/^ERGEBNISLISTE\b/i.test(line)) continue;
    if (/^Anzahl\s+Teilnehmer/i.test(line)) continue;

    // Kopf: "<Ort>, am DD.MM.YYYY"
    if (!headerParsed) {
      var stripped = line.replace(/\s*\bERGEBNISLISTE\b\s*/gi, ' ').trim().replace(/\s+/g, ' ');
      var hdrM = stripped.match(/^(.+),\s*am\s*(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s|$)/);
      if (hdrM) {
        date = hdrM[4] + '-' + _p2(hdrM[3]) + '-' + _p2(hdrM[2]);
        location = hdrM[1].trim();
        headerParsed = true;
        continue;
      }
      if (!eventName && stripped) { eventName = stripped; continue; }
    }

    // Spaltenüberschrift der Einzelwertung bzw. der Mannschaftswertung
    if (_SELTECSTR_HDR.test(line)) continue;
    if (/^Rg\.\s+Verein\b/i.test(line)) { skipRace = true; currentSection = null; continue; }

    var datumM = line.match(/^Datum:\s*(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (datumM) {
      var dSek = datumM[3] + '-' + _p2(datumM[2]) + '-' + _p2(datumM[1]);
      // Manche Listen sind aus der Vorjahresdatei erzeugt und tragen in den
      // Bewerben noch das alte Datum. Liegt es weit weg vom Datum im Kopf,
      // gilt das Kopfdatum (es passt zum Veranstaltungsnamen und Dateinamen).
      if (date && Math.abs(new Date(dSek) - new Date(date)) > 7 * 86400000) {
        if (dateWarn.indexOf(dSek) < 0) dateWarn.push(dSek);
        currentDate = date;
      } else {
        currentDate = dSek;
        if (!date) date = currentDate;
      }
      currentSection = null;
      continue;
    }

    // Lauf-Überschrift: "<Name> (<Distanz>)"
    var raceM = line.match(/^(.+?)\s*\(([^()]*\d[^()]*)\)\s*$/);
    if (raceM && !_SELTECSTR_ROW.test(line)) {
      var raceTitel = raceM[1].trim();
      // Mannschaftswertungen und Staffeln ("4 x 1,2 km") enthalten Teamzeiten
      // statt Einzelergebnissen – die Zeilen sind Mannschaften, keine Athleten
      var istTeam = /Mannschafts?wertung|Teamwertung/i.test(raceTitel) ||
                    /(?:^|\s)\d+\s*[x×]\s*\d/i.test(raceTitel) ||
                    /\bStaffel/i.test(raceTitel);
      if (istTeam) _bkDbgLine('  übersprungen', raceTitel + ' (Mannschafts-/Staffelwertung)');
      skipRace = istTeam;
      // Meisterschafts-Wertungen wiederholen denselben Lauf ("10 km Straßenlauf
      // Kreismeisterschaft 10 km") → gleicher Lauftitel, damit die doppelten
      // Ergebnisse später als solche erkannt werden
      currentRace = raceTitel.replace(/\s+\S*[Mm]eisterschaft\b.*$/, '').trim() || raceTitel;
      // Meisterschafts-Bezeichnung merken ("… Kreismeisterschaft 10 km" → "Kreismeisterschaft")
      var mstrM = raceTitel.match(/(\S*[Mm]eisterschaft\w*\b.*)$/);
      currentMstr = mstrM ? mstrM[1].replace(/\s*\d+(?:[.,]\d+)?\s*(?:km|m)\s*$/i, '').trim() : '';
      currentDist = raceM[2].trim();
      currentAk = '';
      // Geschlecht aus dem Lauftitel ("Bambini-Lauf Mädchen") – die Klasse-Spalte
      // führt bei Bambini-/Jedermannläufen keine Altersklasse
      currentGesch = /\b(M[äa]dchen|weiblich\w*|Frauen)\b/i.test(currentRace) ? 'W'
                   : /\b(Jungen|Knaben|m[äa]nnlich\w*|M[äa]nner)\b/i.test(currentRace) ? 'M' : '';
      currentSection = null;
      continue;
    }

    var rowM = line.match(_SELTECSTR_ROW);
    if (rowM && currentRace && !skipRace) {
      var ath = _parseSeltecStrRow(rowM[3]);
      if (ath) {
        if (!currentSection) newSection();
        ath.platz = ath.akPlatz || parseInt(rowM[1], 10) || 0;
        if (!ath.ak) ath.ak = currentAk;
        if (!ath.geschlecht) ath.geschlecht = currentGesch || (ath.ak ? ath.ak.charAt(0) : '');
        var verL = ath.verein.toLowerCase();
        ath.ownClub = !!((ownVerL && verL.indexOf(ownVerL) >= 0) ||
                         (ownClub && verL.indexOf(ownClub.toLowerCase()) >= 0));
        currentSection.athletes.push(ath);
      }
      continue;
    }
    if (rowM) continue;

    // Geschlechts-/Klassen-Zwischenüberschrift ("Frauen", "Männer", "Männer M50/55")
    var ak = _seltecAkFromTitle(line);
    if (ak && line.length < 40) { currentAk = ak; currentSection = null; }
  }

  sections = sections.filter(function(s) { return s.athletes.length; });
  return { eventName: eventName, location: location, date: date, ownClub: ownClub,
           sections: sections, dateWarn: dateWarn.join(', ') };
}

function _parseSeltecStrRow(rest) {
  var yM = rest.match(/^(.+?)\s+((?:19|20)\d{2})\s+(.*)$/);
  if (!yM) return null;
  var namePart = yM[1].trim(), year = yM[2], tail = yM[3].trim();

  // "Nachname, Vorname" → "Vorname Nachname"
  var name = namePart;
  var kM = namePart.match(/^([^,]+),\s*(.+)$/);
  if (kM) name = kM[2].trim() + ' ' + kM[1].trim();
  name = name.replace(/\s+/g, ' ').trim();
  if (!name) return null;

  // Nationalitäts-Kürzel ist optional
  var natM = tail.match(/^([A-Z]{2,3})\s+(.+)$/);
  if (natM && _seltecIstNat(natM[1])) tail = natM[2];

  // "<Verein> <Zeit> [+ <Diff>] [<AK-Platz>. <Klasse>]"
  var tM = tail.match(/^(.*?)\s+(\d{1,2}(?::\d{2}){1,2}(?:[.,]\d{1,2})?)(?:\s*\+\s*[\d:.,]+)?(?:\s+(\d{1,3})\.\s*([A-Za-zÄÖÜäöüß][A-Za-z0-9ÄÖÜäöüß\-\/]*))?\s*$/);
  if (!tM) return null;

  var verein = tM[1].trim();
  var klasse = (tM[4] || '').trim();
  var ak = '', gesch = '';
  if (/^[MW](?:\d{1,2}|U\d{1,2}|HK)$/i.test(klasse)) ak = klasse.toUpperCase();
  else if (/^(M[äa]|M|Herren)$/i.test(klasse)) ak = 'M';
  else if (/^(F|W|Fr|Frauen)$/i.test(klasse))  ak = 'W';
  if (ak) gesch = ak.charAt(0);

  return {
    name: name, year: year, geschlecht: gesch, verein: verein,
    resultat: _volksNormZeit(tM[2]), platz: 0, akPlatz: parseInt(tM[3], 10) || 0,
    ownClub: false, ak: ak
  };
}

// ── Volkslauf-Ergebnisliste (AKPl / Startnr. / Name / Jahrg. / m/w / Verein / Zeit) ──
// Beispiel: "Burg Uda Nettolauf – Ergebnisliste AK"
//   Jugendlauf 2 km            ← Lauf (Disziplin)
//   w                          ← Geschlechts-Trenner
//   weibliche Jugend U 14      ← Altersklasse
//   1.  392  Anna Bommes  2002  w  OSC Waldniel  0:08:01,7

var _VOLKS_HDR = /(AKPl|Ges\.?\s?Pl\.?|Platz)\b[^\n]*Startnr/i;
var _VOLKS_ROW = /^(\d{1,3})\.?\s+(\d{1,6})\s+(.+?)\s+((?:19|20)\d{2})\s+([mwMW])\s+(.*?)\s*(\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,2})?)$/;

function _volksIsListe(lines) {
  return lines.some(function(l) { return _VOLKS_HDR.test(l); }) &&
         lines.some(function(l) { return _VOLKS_ROW.test(l.trim()); });
}

function _parseVolkslaufLines(lines, sourceLabel) {
  var eventName = '', date = '';
  var sections = [];
  var currentRace = '', currentAk = '', currentGender = '';
  var currentSection = null;

  var ownVerL = ((appConfig && (appConfig.verein_name || appConfig.verein_kuerzel)) || '').toLowerCase();

  // Veranstaltungsname = erste Zeile vor der Spaltenüberschrift
  for (var h = 0; h < lines.length; h++) {
    var hl = lines[h].trim();
    if (_VOLKS_HDR.test(hl)) break;
    if (hl && !/^Ergebnislisten?\b/i.test(hl) && !/^\d+$/.test(hl)) { eventName = hl; break; }
  }

  // Datum: bevorzugt aus dem PDF-Text, sonst aus Dateiname/URL
  for (var d = 0; d < Math.min(lines.length, 40) && !date; d++) {
    var dm = lines[d].match(/\b(\d{1,2})\.(\d{1,2})\.((?:19|20)\d{2})\b/);
    if (dm) date = dm[3] + '-' + _p2(dm[2]) + '-' + _p2(dm[1]);
  }
  if (!date) date = _volksDateFromSource(sourceLabel || '');

  function newSection() {
    currentSection = {
      disziplin: currentRace || '',
      diszCands: _volksDiszCands(currentRace),
      diszExact: /walking|nordic/i.test(currentRace || ''),
      date: date,
      ak: currentAk,
      athletes: []
    };
    sections.push(currentSection);
  }

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line) continue;

    // Ergebniszeile
    var rM = line.match(_VOLKS_ROW);
    if (rM) {
      if (!currentSection) newSection();
      var gesch = rM[5].toUpperCase();
      var verein = rM[6].trim();
      var verL = verein.toLowerCase();
      currentSection.athletes.push({
        name:       rM[3].trim(),
        year:       rM[4],
        geschlecht: gesch,
        verein:     verein,
        resultat:   _volksNormZeit(rM[7]),
        platz:      parseInt(rM[1], 10) || 0,
        ownClub:    !!(ownVerL && verL.indexOf(ownVerL) >= 0),
        ak:         currentSection.ak || (gesch === 'W' ? 'W' : 'M')
      });
      continue;
    }

    // Kopf-/Fußzeilen und Wiederholungen auf Folgeseiten
    if (_VOLKS_HDR.test(line)) continue;
    if (/^\d+$/.test(line)) continue;                       // Seitenzahl
    if (/^Ergebnislisten?\b/i.test(line)) continue;
    if (/^Seite\s+\d+/i.test(line)) continue;
    if (/^Anzahl\s+Teilnehmer/i.test(line)) continue;
    if (eventName && line === eventName) continue;

    // Geschlechts-Trenner ("w" / "m" allein auf einer Zeile)
    if (/^[mw]$/i.test(line)) { currentGender = line.toUpperCase(); currentSection = null; continue; }

    // Lauf-Überschrift (enthält eine Distanz, z.B. "Bambinilauf 400 m", "Burg Uda 5 km Lauf")
    if (_volksDistFromTitle(line)) {
      currentRace = line;
      currentAk = '';
      currentSection = null;
      continue;
    }

    // sonst: Altersklassen-Überschrift ("Frauen", "Bambini W", "Kinder (weiblich) U12")
    currentAk = _volksAkFromTitle(line, currentGender);
    currentSection = null;
  }

  // Leere Sektionen entfernen
  sections = sections.filter(function(s) { return s.athletes.length; });

  return { eventName: eventName, location: '', date: date, ownClub: '', sections: sections };
}

function _p2(n) { return String(n).padStart(2, '0'); }

function _volksNormZeit(z) {
  // "0:08:01,7" → "8:01,7" (führende Null-Stunden und Minuten-Null entfernen)
  var t = z.replace(/^0:(?=\d{1,2}:)/, '');
  return t.replace(/^0(\d:)/, '$1');
}

function _volksDateFromSource(src) {
  var m = src.match(/(20\d{2}|19\d{2})[-_.](\d{2})[-_.](\d{2})/);
  if (m) return m[1] + '-' + m[2] + '-' + m[3];
  m = src.match(/(\d{2})[-_.](\d{2})[-_.]((?:19|20)\d{2})/);
  if (m) return m[3] + '-' + m[2] + '-' + m[1];
  return '';
}

function _volksAkFromTitle(title, gender) {
  // "weibliche Jugend U 14" → "WU14", "Kinder (weiblich) U12" → "WU12",
  // "Frauen" → "W", "m Jugend" / "Bambini M" → "M"
  var t = title.replace(/\bU\s+(\d+)/gi, 'U$1');
  if (/\(weiblich\)?/i.test(t))  t = t.replace(/\(weiblich\)?/i, 'weibliche');
  if (/\(männlich\)?/i.test(t))  t = t.replace(/\(männlich\)?/i, 'männliche');
  var ak = _seltecAkFromTitle(t);
  if (ak) return ak;
  var uM = t.match(/U(\d+)/i);
  var g = /\bW\b|weiblich|mädchen/i.test(t) ? 'W' : (/\bM\b|männlich|jungen/i.test(t) ? 'M' : gender);
  if (uM && g) return g + 'U' + uM[1];
  return g || '';
}

function _volksDistFromTitle(title) {
  // "Jugendlauf 2 km" → { val: 2, unit: 'km' }; "Bambinilauf 400 m" → { val: 400, unit: 'm' }
  // Ziffernfolge vollständig lesen – sonst wird aus "5000m" die Distanz "000m"
  var m = title.match(/(?:^|[^\d.,])(\d{1,5}(?:[.,]\d{1,3})?)\s*(km|m)\b/i);
  if (!m) return null;
  return { val: m[1].replace(',', '.'), unit: m[2].toLowerCase() };
}

function _volksDiszCands(raceTitle) {
  var d = _volksDistFromTitle(raceTitle || '');
  if (!d) return raceTitle ? [raceTitle] : [];
  var cands = [];
  // Walking/Nordic ist keine Laufdisziplin → nur passende Walking-Disziplinen suchen,
  // sonst Rohtitel (Nutzer wählt die Disziplin selbst)
  // Meter- und Kilometer-Schreibweise derselben Distanz (die Disziplin kann in
  // der Datenbank als "1km", "1.000m" oder "1000m" hinterlegt sein)
  function beideEinheiten(meter) {
    var out = [meter + 'm', meter + ' m'];
    if (meter >= 1000) {
      out.push(String(meter).replace(/(\d)(\d{3})$/, '$1.$2') + 'm');
      var kmS = String(meter / 1000).replace('.', ',');
      out.push(kmS + 'km', kmS + ' km');
    }
    return out;
  }

  if (/walking|nordic/i.test(raceTitle)) {
    var mW = d.unit === 'km' ? Math.round(parseFloat(d.val) * 1000) : Math.round(parseFloat(d.val));
    var wCands = [];
    beideEinheiten(mW).forEach(function(dist) {
      wCands.push(dist + ' Walking', 'Walking ' + dist, dist + ' Nordic Walking');
    });
    wCands.push(raceTitle);
    return wCands;
  }
  if (d.unit === 'km') {
    var kmInt = parseFloat(d.val);
    var kmStr = String(d.val).replace('.', ',');
    cands.push(kmStr + 'km', kmStr + ' km');
    if (Number.isInteger(kmInt)) {
      cands.push(kmInt + 'km', kmInt + ' km');
      cands = cands.concat(beideEinheiten(kmInt * 1000));
    }
  } else {
    cands = cands.concat(beideEinheiten(Math.round(parseFloat(d.val))));
  }
  if (raceTitle) cands.push(raceTitle);
  return cands;
}

function _volksFindDisz(cands, kat, exactOnly) {
  // Bewusst nur innerhalb der Importkategorie suchen: ein 400-m-Bambinilauf auf der
  // Straße darf nicht auf die Bahn-Disziplin "400m" gemappt werden. Bleibt eine
  // Disziplin unbekannt, wird sie nach dem Import zum Anlegen angeboten.
  for (var i = 0; i < cands.length; i++) {
    if (exactOnly) {
      // Walking/Nordic: nur exakter Treffer – sonst würde "5km Walking" auf "5km" (Lauf) fallen
      var cl = cands[i].toLowerCase().trim();
      var erlaubt = bkKatMitGruppen(kat); // null = alle Kategorien
      var hit = (state.disziplinen || []).find(function(d) {
        return (!erlaubt || erlaubt.indexOf(d.tbl_key) >= 0) && (d.disziplin || '').toLowerCase() === cl;
      });
      if (hit) return { disz: hit.disziplin, diszMid: hit.id || hit.mapping_id };
    } else {
      var r = _seltecFindDisz(cands[i], kat);
      if (r.diszMid) return r;
    }
  }
  // Kein Namenstreffer: über die an der Disziplin hinterlegte Distanz suchen –
  // damit werden auch abweichende Schreibweisen gefunden. Bei Walking/Nordic
  // bewusst nicht, sonst landet "5km Walking" auf dem 5-km-Lauf.
  if (!exactOnly) {
    var meter = _volksMeterAus(cands);
    var erlaubtD = bkKatMitGruppen(kat); // null = alle Kategorien
    if (meter) {
      var hitD = (state.disziplinen || []).find(function(d) {
        return (!erlaubtD || erlaubtD.indexOf(d.tbl_key) >= 0) && Number(d.distanz) === meter;
      });
      if (hitD) return { disz: hitD.disziplin, diszMid: hitD.id || hitD.mapping_id };
    }
  }
  return { disz: cands[0] || '', diszMid: null };
}

// Distanz in Metern aus der ersten auswertbaren Kandidatenschreibweise
function _volksMeterAus(cands) {
  for (var i = 0; i < (cands || []).length; i++) {
    var d = _volksDistFromTitle(cands[i]);
    if (d) return d.unit === 'km' ? Math.round(parseFloat(d.val) * 1000) : Math.round(parseFloat(d.val));
  }
  return 0;
}

// Disziplin aus einem Sektions-Titel: alles bis zum ersten Trennkomma.
// Ein Dezimalkomma zwischen Ziffern trennt nicht ("2,2-km-Jugendlauf, WM Jugend").
function _seltecDiszAusTitel(titel) {
  var m = String(titel || '').match(/^((?:[^,]|,(?=\d))+)/);
  return (m ? m[1] : String(titel || '')).trim();
}

function _seltecAkFromTitle(title) {
  // "75m, Jugend W12 (aus gemeinsamem Bewerb)"           → "W12"
  // "50m, Kinder W9 - Zeitläufe"                          → "W9"
  // "800m, Seniorinnen W45 (aus gemeinsamem Bewerb)"     → "W45"
  // "100m, Weibliche Jugend U18 (aus gemeinsamem Bewerb)"→ "WU18"
  // "800m, Männliche Jugend U20 (aus gemeinsamem Bewerb)"→ "MU20"
  // "100m, Frauen (aus gemeinsamem Bewerb)"              → "W"
  // "100m, Männer (aus gemeinsamem Bewerb)"              → "M"
  var m;
  if ((m = title.match(/\b([MW]\d{1,2})\b/))) return m[1];
  if ((m = title.match(/Weibliche?\s+Jugend\s+U(\d+)/i))) return 'WU' + m[1];
  if ((m = title.match(/Männliche?\s+Jugend\s+U(\d+)/i))) return 'MU' + m[1];
  if ((m = title.match(/U(\d+)/i))) {
    if (/weiblich|frauen|seniorinnen/i.test(title)) return 'WU' + m[1];
    if (/männlich|herren|senioren/i.test(title))    return 'MU' + m[1];
  }
  if (/\bFrauen?\b|\bSeniorinnen?\b/i.test(title))  return 'W';
  if (/\bMänner\b|\bHerren\b|\bSenioren?\b/i.test(title)) return 'M';
  return '';
}

// Nationalitäts-/Kreiskürzel der Nat.-Spalte. Ohne feste Liste würden Vereins-
// präfixe wie "OSC", "DJK", "LAV" oder "VT" als Nat gelesen und aus dem
// Vereinsnamen entfernt ("OSC Waldniel" → "Waldniel").
var _SELTEC_NAT = /^(KNW|NRW|GER|AUT|SUI|NED|BEL|LUX|FRA|ITA|ESP|POR|GBR|IRL|DEN|SWE|NOR|FIN|ISL|POL|CZE|SVK|HUN|SLO|CRO|SRB|BIH|ROU|BUL|GRE|TUR|RUS|UKR|BLR|LTU|LAT|EST|USA|CAN|BRA|JPN|CHN|KEN|ETH|MAR|RSA|AUS|NZL)$/;

function _seltecIstNat(tok) { return !!tok && _SELTEC_NAT.test(tok); }

function _parseSeltecAthRow(rest, isFieldEvent) {
  var tokens = rest.split(/\s+/);
  if (tokens.length < 4) return null;

  var yearIdx = -1;
  for (var i = 1; i < tokens.length - 1; i++) {
    if (/^(19|20)\d{2}$/.test(tokens[i])) { yearIdx = i; break; }
  }
  if (yearIdx < 0) return null;

  // Nationalitäts-Code optional (Format 2018: Deutsche Athleten ohne Nat-Kürzel)
  var nat = tokens[yearIdx + 1];
  var hasNat = _seltecIstNat(nat);
  var afterNatIdx = hasNat ? yearIdx + 2 : yearIdx + 1;

  var year = tokens[yearIdx];
  var nameParts = tokens.slice(0, yearIdx);
  if (!nameParts.length) return null;
  var firstname = nameParts[nameParts.length - 1];
  var lastname  = nameParts.slice(0, nameParts.length - 1).join(' ');
  var fullName  = lastname ? firstname + ' ' + lastname : firstname;

  var afterNat = tokens.slice(afterNatIdx);
  if (!afterNat.length) return null;

  var last = afterNat[afterNat.length - 1];
  var prev = afterNat.length >= 2 ? afterNat[afterNat.length - 2] : '';

  var _noRes = /^(abg|aufg|zur[üu]ckgez)\.?$|^DSQ$|^DNS$|^DNF$|^n\.a\.?$|^o\.g\.V\.?$/i;
  if (_noRes.test(last) || _noRes.test(prev)) return null;

  var result, clubEnd;
  if (/^[\d\-]+\.\/[IVX]+$/.test(last)) {
    // Lauf: Lauf-/Platznummer am Ende (z.B. "2./I")
    result = prev; clubEnd = afterNat.length - 2;
  } else if (isFieldEvent && /^\([+\-]?\d+[,.]?\d*\)$/.test(last)) {
    // Feldwettkampf: Wind in Klammern am Ende (z.B. "(0,0)" oder "(-1,2)")
    result = prev; clubEnd = afterNat.length - 2;
  } else if (isFieldEvent && /^[+\-]?\d+[,.]?\d*$/.test(last) &&
             (/^[+\-]/.test(last) || /^\d+[,.]\d+$/.test(prev))) {
    // Feldwettkampf: Windwert ohne Klammern – nur wenn er ein Vorzeichen trägt
    // oder das Feld davor die eigentliche Leistung ist. Sonst ist die letzte
    // Spalte selbst die Leistung (HTML-Export ohne Wind-Spalte).
    result = prev; clubEnd = afterNat.length - 2;
  } else {
    result = last; clubEnd = afterNat.length - 1;
  }

  if (!result || !/\d/.test(result)) return null;

  var verein = afterNat.slice(0, clubEnd).join(' ');

  return { name: fullName, year: year, geschlecht: '', verein: verein, resultat: result, platz: 0, ownClub: false, ak: '' };
}

function _seltecIsField(disziplin) {
  return /weitsprung|hochsprung|dreisprung|kugel|diskus|speer|hammer|stab|gewicht/i.test(disziplin);
}

function _seltecFindDisz(rawDisz, kat) {
  if (!rawDisz) return { disz: '', diszMid: null };
  var rl = rawDisz.toLowerCase().trim();

  function suche(list) {
    var found = list.find(function(d) { return (d.disziplin || '').toLowerCase() === rl; });
    if (!found) found = list.find(function(d) {
      var dl2 = (d.disziplin || '').toLowerCase();
      return dl2.startsWith(rl) || rl.startsWith(dl2);
    });
    // Normalisierter Vergleich: "1500m" ↔ "1.500m" (Tausenderpunkt im DB-Eintrag)
    if (!found) {
      var rlN = rl.replace(/\./g, '');
      found = list.find(function(d) { return (d.disziplin || '').toLowerCase().replace(/\./g, '') === rlN; });
    }
    return found;
  }

  var alle = state.disziplinen || [];
  // 1. Prio: exakt die gewählte Importkategorie
  var found = suche(kat ? alle.filter(function(d) { return d.tbl_key === kat; }) : alle);
  // 2. Prio: Partner-Kategorien aus den Kategoriegruppen (z.B. Weitsprung erscheint
  //    beim Sportfest im Bahn-Dropdown) – genau die Auswahl, die die Zeile auch anbietet
  if (!found && kat) {
    var erlaubt = bkKatMitGruppen(kat) || [];
    if (erlaubt.length > 1) {
      found = suche(alle.filter(function(d) { return d.tbl_key !== kat && erlaubt.indexOf(d.tbl_key) >= 0; }));
    }
  }
  if (!found) return { disz: rawDisz, diszMid: null };
  return { disz: found.disziplin, diszMid: found.id || found.mapping_id };
}

// ── Smart-Paste Parser ──────────────────────────────────────────────────────

function bulkReset() {
  // Einlesen-Button wieder zeigen, Aktions-Buttons verstecken
  var einlesenBtn = document.getElementById('bk-einlesen-btn');
  if (einlesenBtn) einlesenBtn.style.display = '';
  var actionDiv = document.getElementById('bk-post-import-actions');
  if (actionDiv) actionDiv.style.display = 'none';
  var statusEl = document.getElementById('bk-import-status');
  if (statusEl) statusEl.textContent = '';
  // Hinweis auf unbekannte Disziplinen weg
  var unkEl = document.getElementById('bk-unknown-disz');
  if (unkEl) { unkEl.style.display = 'none'; unkEl.innerHTML = ''; }
  // Tabellen-Zeilen leeren
  var tbody = document.getElementById('bulk-rows');
  if (tbody) tbody.innerHTML = '';
  // Paste-Feld leeren
  var pasteEl = document.getElementById('bk-paste-area');
  if (pasteEl) { pasteEl.value = ''; pasteEl.focus(); }
  // Debug-Log leeren
  var dbgWrap = document.getElementById('bk-import-debug-wrap');
  if (dbgWrap) { dbgWrap.style.display = 'none'; dbgWrap.open = false; }
  var dbgPre = document.getElementById('bk-import-debug');
  if (dbgPre) dbgPre.textContent = '';
  if (typeof _bkDbgLines !== 'undefined') _bkDbgLines = [];
  // Veranstaltungsfelder leeren
  ['bk-datum','bk-ort','bk-evname','bk-quelle'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.value = '';
  });
  _bkSelectedOrtId = null;
  // Importkategorie-Wrapper verstecken
  var katWrap = document.getElementById('bk-import-kat-wrap');
  if (katWrap) katWrap.style.display = 'none';
  // Bestehende-Veranstaltung-Auswahl weg
  var veranstSel = document.getElementById('bk-veranst-existing');
  if (veranstSel) veranstSel.value = '';
}

async function bulkMeldeImport() {
  var repo  = (appConfig && appConfig.github_repo)   ? appConfig.github_repo.trim()   : '';
  var token = (appConfig && appConfig.github_token)  ? appConfig.github_token.trim()  : '';
  if (!repo || !token) {
    notify('GitHub-Einstellungen nicht konfiguriert (Admin \u2192 Einstellungen).', 'err');
    return;
  }

  // Debug-Log + Rohdaten sammeln
  var raw = window._bkLastImportUrl || (document.getElementById('bk-paste-area') || {}).value || '[nicht verf\u00fcgbar]';
  var debugLog = (typeof _bkDbgLines !== 'undefined' && _bkDbgLines.length) ? _bkDbgLines.join('\n') : '(kein Debug-Log)';
  var _vEl = document.querySelector('script[src*="02_app.js"]');
  var _vm = _vEl ? (_vEl.src||'').match(/v=(\d+)/) : null;
  var vNum = _vm ? _vm[1] : '?';
  var wer = currentUser ? (currentUser.benutzername || currentUser.email || '?') : '?';

  // Vorschau-Modal mit Kommentarfeld
  showModal(
    modalH2('&#x26A0;&#xFE0F; Schlechten Import melden') +
    '<div style="font-size:13px;color:var(--text2);margin-bottom:12px">Das folgende GitHub-Issue wird erstellt. Bitte erg\u00e4nze einen Kommentar was falsch importiert wurde.</div>' +
    '<div style="background:var(--surf2);border-radius:8px;padding:12px 16px;font-size:12px;margin-bottom:12px">' +
      '<div><strong>Titel:</strong> [Import-Fehler] v' + vNum + ' &ndash; ' + new Date().toLocaleDateString('de-DE') + '</div>' +
      '<div style="color:var(--text2);margin-top:4px"><strong>Von:</strong> ' + wer + '</div>' +
      '<div style="color:var(--text2);margin-top:4px"><strong>URL/Quelle:</strong> ' + (raw.slice(0,120) || '&ndash;') + '</div>' +
      '<details style="margin-top:8px"><summary style="cursor:pointer;color:var(--text2)">Debug-Log (' + (debugLog.split('\n').length) + ' Zeilen)</summary>' +
        '<pre style="font-size:10px;overflow:auto;max-height:150px;background:var(--surface);padding:6px;border-radius:4px;margin-top:4px;white-space:pre-wrap">' + debugLog.slice(0,2000) + '</pre>' +
      '</details>' +
    '</div>' +
    '<div class="form-group full" style="margin-bottom:12px">' +
      '<label style="font-size:13px;font-weight:600">Kommentar (was stimmt nicht?)</label>' +
      '<textarea id="bk-melde-kommentar" rows="4" placeholder="z.B. Disziplin falsch erkannt, Athlet nicht gefunden, Zeiten fehlerhaft..." ' +
        'style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px;background:var(--surface);color:var(--text);resize:vertical;margin-top:4px"></textarea>' +
    '</div>' +
    '<div class="modal-actions">' +
      '<button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button>' +
      '<button class="btn btn-primary" onclick="_bulkMeldeImportSend(' + JSON.stringify(repo) + ',' + JSON.stringify(token) + ',\'' + vNum + '\',\'' + wer + '\')">' +
        '&#x26A0;&#xFE0F; Issue erstellen' +
      '</button>' +
    '</div>'
  );
  setTimeout(function(){ var ta=document.getElementById('bk-melde-kommentar'); if(ta) ta.focus(); }, 100);
}

async function _bulkMeldeImportSend(repo, token, vNum, wer) {
  var kommentar = (document.getElementById('bk-melde-kommentar') || {}).value || '';
  closeModal();

  var raw = window._bkLastImportUrl || (document.getElementById('bk-paste-area') || {}).value || '[nicht verf\u00fcgbar]';
  var debugLog = (typeof _bkDbgLines !== 'undefined' && _bkDbgLines.length) ? _bkDbgLines.join('\n') : '(kein Debug-Log)';

  var issueBody =
    '## Gemeldeter Import-Fehler\n\n' +
    '| Feld | Wert |\n|---|---|\n' +
    '| Gemeldet von | ' + wer + ' |\n' +
    '| Zeitstempel | ' + new Date().toISOString() + ' |\n' +
    '| Portal-Version | v' + vNum + ' |\n\n' +
    '### Kommentar\n' + (kommentar || '_kein Kommentar_') + '\n\n' +
    '### Import-Debug-Log\n```\n' + debugLog + '\n```\n\n' +
    '### Rohtext / URL\n```\n' + raw.slice(0,3000) + (raw.length>3000?'\n...[gek\u00fcrzt]':'') + '\n```\n';

  var payload = {
    title: '[Import-Fehler] v' + vNum + ' \u2013 ' + new Date().toLocaleDateString('de-DE'),
    body: issueBody,
    labels: ['import-fehler']
  };
  var btn = document.querySelector('[onclick*="bulkMeldeImport"]');
  if (btn) { btn.textContent = '\u23F3 Melde...'; btn.disabled = true; }
  try {
    var r = await fetch('https://api.github.com/repos/' + repo + '/issues', {
      method: 'POST',
      headers: { 'Authorization': 'token ' + token, 'Content-Type': 'application/json', 'Accept': 'application/vnd.github.v3+json' },
      body: JSON.stringify(payload)
    });
    var d = await r.json();
    if (r.ok && d.html_url) {
      showModal(
        modalH2('&#x2705; Import gemeldet') +
        '<p style="color:var(--text2);font-size:14px;margin:8px 0 16px">Das Issue wurde erfolgreich bei GitHub erstellt.</p>' +
        '<div style="background:var(--surf2);border-radius:8px;padding:12px 16px;font-size:13px;margin-bottom:16px">' +
          '<div><strong>Issue #' + d.number + '</strong></div>' +
          '<div style="color:var(--text2);margin-top:4px">' + d.title + '</div>' +
        '</div>' +
        '<div class="modal-actions">' +
          '<a href="' + d.html_url + '" target="_blank" class="btn btn-ghost btn-sm">&#x1F517; Issue ansehen</a>' +
          '<button class="btn btn-primary btn-sm" onclick="closeModal()">OK</button>' +
        '</div>'
      );
    } else {
      notify('\u274C GitHub-Fehler: ' + (d.message || r.status), 'err');
    }
  } catch(e) {
    notify('\u274C Fehler: ' + e.message, 'err');
  } finally {
    if (btn) { btn.innerHTML = '&#x26A0;&#xFE0F; Schlechten Import melden'; btn.disabled = false; }
  }
}
window._bkMatchInaktive = true; // Default: auch inaktive Athleten matchen

function bulkEinlesen() {
  var raw = ((document.getElementById('bk-paste-area') || {}).value || '').trim();
  if (!raw) return;
  var urlType = bulkDetectUrl(raw);
  if (urlType) {
    if (urlType !== 'pdf' && urlType !== 'html' && urlType !== 'maxfun') {
      var kat = ((document.getElementById('bk-import-kat') || {}).value || '');
      if (!kat) {
        notify('Bitte Importkategorie wählen.', 'err');
        var katWrap = document.getElementById('bk-import-kat-wrap');
        if (katWrap) katWrap.style.display = 'flex';
        return;
      }
    }
    bulkImportUrl();
  } else {
    bulkParsePaste();
  }
}

function bulkParsePaste() {
  var raw = (document.getElementById('bk-paste-area') || {}).value || '';
  if (!raw.trim()) return;

  // URL-Erkennung: wenn URL → Import starten
  var urlType = bulkDetectUrl(raw.trim());
  if (urlType) {
    if (urlType !== 'pdf' && urlType !== 'html' && urlType !== 'maxfun') {
      var kat = ((document.getElementById('bk-import-kat') || {}).value || '');
      if (!kat) {
        notify('Bitte Importkategorie wählen.', 'err');
        var katWrap = document.getElementById('bk-import-kat-wrap');
        if (katWrap) katWrap.style.display = 'flex';
        return;
      }
    }
    bulkImportUrl();
    return;
  }

  // Eingefuegte MaxFun-Ergebnistabelle: eigener Parser statt des Freitext-Parsers
  if (typeof mfsIstPaste === 'function' && mfsIstPaste(raw)) {
    var _mfKat = ((document.getElementById('bk-import-kat') || {}).value || '').trim();
    var _mfStatus = document.getElementById('bk-import-status');
    var _mfBtn = document.getElementById('bk-einlesen-btn');
    window._bkLastImportUrl = 'MaxFun Sports (eingef\u00fcgte Tabelle)';
    var _mfQuelle = document.getElementById('bk-quelle');
    if (_mfQuelle && !_mfQuelle.value) _mfQuelle.value = 'maxfunsports.com';
    var _mfKatEl = document.getElementById('bk-kat');
    if (_mfKatEl && _mfKat) { _mfKatEl.value = _mfKat; bkKatChanged(); }
    if (_mfBtn) _mfBtn.style.display = 'none';
    if (_mfStatus) { _mfStatus.style.display = 'inline-flex'; _mfStatus.textContent = '\u23f3 Lese MaxFun-Tabelle\u2026'; }
    _bkDebugInit('(eingef\u00fcgte Tabelle)', 'MaxFun Sports', _mfKat);
    bulkImportFromMaxFun(raw, _mfKat, _mfStatus)
      .catch(function(e) { if (_mfStatus) _mfStatus.textContent = '\u274c ' + e.message; })
      .then(function() { if (_mfBtn) _mfBtn.style.display = ''; });
    return;
  }

  var lines = raw.split(/\r?\n/).map(function(l) { return l.trim(); }).filter(function(l) { return l; });
  if (!lines.length) return;

  // Erkennungs-Patterns
  var reDate   = /^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/;              // 11.10.25 oder 11.10.2025
  var reAK     = /^([MW][A-Za-z0-9\-]+|[MW]HK|WHK|MHK)$/;          // W65, M30, WHK …
  var reResult = /(\d+[:\.,]\d+(?:[:\.,]\d+)?)/;                     // Zeitformat 1:43:15 oder 7:48:42
  var reDisz   = /^\d+[,\.]?\d*\s*(m|km|[*x]\d)/i;                  // 400 m, 1.500 m, 4*400 m
  var rePlatz  = /(?:^|\s)(\d+)\s*[🥇🥈🥉]?\s*$/;                   // Platzzahl am Ende

  // Disziplin-Liste für Matching
  var diszList = (state.disziplinen || []).map(function(d) { return d.disziplin; })
    .filter(function(v, i, a) { return a.indexOf(v) === i; });

  // Kontextvariablen
  var curDate  = '';
  var curAK    = '';
  var curDisz  = '';
  var evName   = '';
  var evOrt    = '';
  var parsed   = [];  // { athlet, disz, resultat, ak, platz, datum }

  // Erste Zeile: oft Veranstaltung + Ort (Semikolon oder Komma als Trenner)
  var firstLine = lines[0];
  var evSplit = firstLine.match(/^(.+?)[;,]\s*(.+)$/);
  if (evSplit && !reDate.test(firstLine) && !reAK.test(firstLine)) {
    evName = evSplit[1].trim();
    evOrt  = evSplit[2].trim();
    lines = lines.slice(1);
  } else if (!reDate.test(firstLine) && !reAK.test(firstLine) && !reResult.test(firstLine) && !reDisz.test(firstLine)) {
    // Einzeilige Veranstaltung ohne Ort
    evName = firstLine;
    lines  = lines.slice(1);
  }

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];

    // Datum erkennen: 11.10.25 → 2025-10-11
    var mDate = line.match(reDate);
    if (mDate) {
      var y = parseInt(mDate[3]); if (y < 100) y += 2000;
      curDate = y + '-' + mDate[2].padStart(2,'0') + '-' + mDate[1].padStart(2,'0');
      continue;
    }

    // AK erkennen: W65, M30 etc.
    if (reAK.test(line) && line.length <= 5) {
      curAK = line;
      continue;
    }

    // Disziplin erkennen: entweder reDisz-Pattern oder aus diszList
    var isDiszLine = reDisz.test(line) && !reResult.test(line);
    if (!isDiszLine) {
      // Abgleich gegen bekannte Disziplinen (normalisiert)
      var lineNorm = line.replace(/[.,]/g,'').replace(/\s+/g,' ').toLowerCase();
      for (var di = 0; di < diszList.length; di++) {
        var dn = diszList[di].replace(/[.,]/g,'').replace(/\s+/g,' ').toLowerCase();
        if (lineNorm === dn || lineNorm.indexOf(dn) === 0) { isDiszLine = true; break; }
      }
    }
    if (isDiszLine) {
      // Disziplinname normalisieren und gegen DB matchen
      curDisz = _bulkMatchDisz(line, diszList);
      continue;
    }

    // Ergebnis-Zeile: enthält Zeitformat
    var mRes = line.match(reResult);
    if (mRes) {
      // Token-basierter Parser: erkennt Name/Disziplin/AK/Platz/Datum/Zeit unabhängig von Reihenfolge
      var timeStr  = mRes[1];
      var zeitIdx  = line.indexOf(mRes[0]);
      var beforeZeit = line.slice(0, zeitIdx).trim();
      var afterZeit  = line.slice(zeitIdx + mRes[0].length).trim();
      var reAKPat  = /^[MW]\d{2}$|^[MW][\u00dc\u00fc]\d{2}$|^[MW](?:sen|jun|HK|u\d{2}|U\d{2})$/i;
      var reAKFull = /\b([MW]\d{2}|[MW][\u00dc\u00fc]\d{2}|[MW](?:sen|jun|HK|u\d{2}|U\d{2}))\b/i;
      var normS    = function(s){ return (s||'').replace(/[.,*×x]/g,'').replace(/\s+/g,' ').trim().toLowerCase(); };

      // 1. Einheit direkt nach Zeit (h/min/s) aus afterZeit
      afterZeit = afterZeit.replace(/^\s*(h|min|sek|s)\b\.?\s*/i, '');

      // 2. Datum aus afterZeit
      var lineDatum = curDate;
      var mDat = afterZeit.match(/\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})\b/);
      if (mDat) {
        var _y = parseInt(mDat[3]); if (_y < 100) _y += 2000;
        lineDatum = _y + '-' + mDat[2].padStart(2,'0') + '-' + String(parseInt(mDat[1])).padStart(2,'0');
        afterZeit = afterZeit.replace(mDat[0], '').trim();
      }

      // 3. PB/SB/NB-Labels und Emojis aus afterZeit
      afterZeit = afterZeit.replace(/\b(PB|SB|NB|WR|CR)\b/gi, '').replace(/[🥇🥈🥉🏅]/g, '').replace(/\s+/g, ' ').trim();

      // 4. Platz aus afterZeit: trailing Zahl (mit opt. Punkt) ODER "Platz N"
      var linePlatz = null;
      var mPlatzKw = afterZeit.match(/\bPlatz\s+(\d{1,4})\b/i);
      var mPlatzTrail = afterZeit.match(/(?:^|\s)(\d{1,4})\.?\s*$/);
      if (mPlatzKw) linePlatz = parseInt(mPlatzKw[1]);
      else if (mPlatzTrail) linePlatz = parseInt(mPlatzTrail[1]);

      // 5. beforeZeit aufräumen: Einheit am Ende
      beforeZeit = beforeZeit.replace(/\s+(h|min|sek|s)\s*$/i, '').trim();

      // 6. Token-Satz für Klassifizierung:
      //    Falls beforeZeit kurz/leer → Zeit stand am Anfang, afterZeit enthält den Rest
      var tokenStr = beforeZeit.length >= 2 ? beforeZeit : afterZeit;

      // 7. AK
      var lineAK = curAK;
      var mAK = tokenStr.match(reAKFull);
      if (mAK && reAKPat.test(mAK[1]) && !/^\d+$/.test(mAK[1])) {
        lineAK = mAK[1];
        tokenStr = tokenStr.replace(mAK[0], ' ').replace(/\s+/g, ' ').trim();
      }

      // 8. Platz aus tokenStr (Zahl allein, falls noch nicht aus afterZeit)
      if (linePlatz === null) {
        var tWords = tokenStr.split(/\s+/);
        for (var ti = tWords.length - 1; ti >= 0; ti--) {
          if (/^\d{1,4}\.?$/.test(tWords[ti])) {
            linePlatz = parseInt(tWords[ti]);
            tWords.splice(ti, 1);
            tokenStr = tWords.join(' ').trim();
            break;
          }
        }
      } else {
        // Platz-Zahl aus tokenStr entfernen (damit sie nicht im Namen landet)
        tokenStr = tokenStr.replace(new RegExp('(?:^|\\s)' + linePlatz + '\\.?(?=\\s|$)'), ' ').replace(/\s+/g, ' ').trim();
      }

      // 9. Disziplin: letzte 1-4 Wörter von tokenStr prüfen
      var lineDiszStr = '';
      var toks = tokenStr.split(/\s+/).filter(Boolean);
      for (var wi = Math.min(toks.length, 4); wi >= 1; wi--) {
        var cand = toks.slice(toks.length - wi).join(' ');
        var n = normS(cand);
        for (var di = 0; di < diszList.length; di++) {
          if (normS(diszList[di]) === n) { lineDiszStr = diszList[di]; toks = toks.slice(0, toks.length - wi); break; }
        }
        if (lineDiszStr) break;
      }

      // 10. Name = verbleibende Tokens
      var namePart = toks.join(' ').trim();
      if (!namePart && beforeZeit.length < 2) {
        // Letzter Versuch: Event-Kontext aus afterZeit nach Datum/Platz entfernen
        // (passiert wenn Zeit am Anfang und Kontext nach Zeit nicht strukturiert)
      }

      if (namePart) {
        parsed.push({
          athlet:   namePart,
          disz:     lineDiszStr || curDisz,
          resultat: timeStr,
          ak:       lineAK,
          platz:    linePlatz,
          datum:    lineDatum,
        });
      }
      continue;
    }
  }

  if (!parsed.length) {
    notify('Keine Ergebnisse erkannt. Bitte Format prüfen.', 'err');
    return;
  }

  // Veranstaltungsfelder befüllen wenn erkannt
  if (evName) { var ef = document.getElementById('bk-evname'); if (ef) ef.value = _cleanEventName(evName); }
  if (evOrt) _bkAutoSetOrt(evOrt);
  if (evName) {
    var _pasteSerie = _bkMatchSerie(evName);
    if (_pasteSerie) {
      bkSerieSetById(_pasteSerie.id);
      if (!((document.getElementById('bk-ort')||{}).value) && _pasteSerie.ort_letzte) {
        _bkAutoSetOrt(_pasteSerie.ort_letzte);
      }
    }
  }

  // Vorhandene Zeilen leeren, dann neue anlegen
  var tbody = document.getElementById('bulk-rows');
  if (tbody) tbody.innerHTML = '';
  _bulkRowCount = 0;

  parsed.forEach(function(p) {
    bulkAddRow();
    var idx = _bulkRowCount - 1;

    // Zeilen-Datum setzen (als TT.MM.JJJJ für Textfeld)
    // _datumOverride aus Tag-Datum-Dialog hat Priorität
    var _pDatum = p._datumOverride || p.datum || '';
    if (_pDatum) {
      var zdEl = tbody.querySelectorAll('.bk-zeilendatum')[idx];
      if (zdEl) {
        var _dm = _pDatum.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        zdEl.value = _dm ? _dm[3] + '.' + _dm[2] + '.' + _dm[1] : _pDatum;
      }
    }

    // Athlet
    var _pasteRow = document.getElementById('bkrow-' + (_bulkRowCount - parsed.length + idx));
    if (!_pasteRow) _pasteRow = tbody.querySelectorAll('tr')[idx];
    var athId = _bulkFindAthlet(p.athlet);
    if (athId && _pasteRow) bkAthletSetById(_pasteRow, athId);

    // Disziplin
    var diszSel = tbody.querySelectorAll('.bk-disz')[idx];
    if (diszSel && p.disz) { diszSel.value = p.disz; if (_pasteRow) bkSyncDiszDisplay(_pasteRow); }

    // Ergebnis
    var resEl = tbody.querySelectorAll('.bk-res')[idx];
    if (resEl) resEl.value = fmtRes(p.resultat);

    // AK
    var akEl = tbody.querySelectorAll('.bk-ak')[idx];
    if (akEl) akEl.value = p.ak || '';

    // Platz
    var plEl = tbody.querySelectorAll('.bk-platz')[idx];
    if (plEl && p.platz) plEl.value = p.platz;
  });

  // Datum: erstes Datum global setzen, bei mehreren Daten hinweis
  var datenSet = parsed.map(function(p){return p.datum;}).filter(function(d,i,a){return d && a.indexOf(d)===i;});
  var dateEl2 = document.getElementById('bk-datum');
  if (dateEl2 && datenSet.length >= 1) dateEl2.value = datenSet[0];
  if (datenSet.length > 1) {
    // Mehrere Daten → in bk-status anzeigen
    var st = document.getElementById('bulk-status');
    if (st) st.textContent = '⚠︎ ' + datenSet.length + ' verschiedene Daten erkannt – bitte pro Zeile prüfen';
  }

  notify(parsed.length + ' Ergebnis(se) eingelesen', 'ok');

  // Paste-Textarea leeren
  var pa = document.getElementById('bk-paste-area');
  if (pa) pa.value = '';
}

function _bulkMatchDisz(line, diszList) {
  var norm = function(s) { return s.replace(/[.,*×x]/g,'').replace(/\s+/g,' ').trim().toLowerCase(); };
  var lineN = norm(line);
  // Exakter Match
  for (var i = 0; i < diszList.length; i++) {
    if (norm(diszList[i]) === lineN) return diszList[i];
  }
  // Partieller Match (Zahl + Einheit)
  var mNum = line.match(/(\d+[,.]?\d*)\s*(m|km)/i);
  if (mNum) {
    var num  = mNum[1].replace(',','.').replace(/\.0$/,'');
    var unit = mNum[2].toLowerCase();
    for (var j = 0; j < diszList.length; j++) {
      var dn = norm(diszList[j]);
      if (dn.indexOf(norm(num + unit)) >= 0 || dn.indexOf(norm(num + ' ' + unit)) >= 0) return diszList[j];
    }
  }
  return line; // Fallback: Original
}

function _bulkFindAthlet(name) {
  if (!name || !state.athleten) return '';
  var norm = function(s) {
    // v1105: Umlaute + diakritische Zeichen (é/à/ñ etc.) via NFD entfernen
    return (s||'').toLowerCase()
      .replace(/ß/g,'ss').replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue')
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .replace(/[^a-z0-9\s]/g,'').replace(/\s+/g,' ').trim();
  };
  var nN = norm(name);
  // Exakter Match (Nachname, Vorname)
  for (var i = 0; i < state.athleten.length; i++) {
    var a = state.athleten[i];
    if (norm(a.name_nv || '') === nN) return a.id;
  }
  // Vorname Nachname → Nachname, Vorname
  var parts = nN.split(' ');
  if (parts.length >= 2) {
    var swapped = parts.slice(1).join(' ') + ' ' + parts[0];
    for (var j = 0; j < state.athleten.length; j++) {
      if (norm(state.athleten[j].name_nv || '') === swapped) return state.athleten[j].id;
    }
    // Alle Namensteile enthalten
    for (var k = 0; k < state.athleten.length; k++) {
      var aN = norm(state.athleten[k].name_nv || '');
      if (parts.every(function(p) { return aN.indexOf(p) >= 0; })) return state.athleten[k].id;
    }
  }
  return '';
}
function bkToggleAkAngleichen(checked) {
  bkApplyDlvAK(checked);
}

function bkApplyDlvAK(useCalculated) {
  var tbody = document.getElementById('bulk-rows');
  if (!tbody) return;
  var eventJahr = _bkEventJahr();
  Array.from(tbody.querySelectorAll('tr')).forEach(function(tr) {
    var akInp = tr.querySelector('.bk-ak');
    if (!akInp) return;
    if (!useCalculated) {
      // Zurück auf Import-Wert
      akInp.value = akInp.dataset.importAk || '';
      return;
    }
    var _gg  = _bkRowGebjG(tr);
    if (_gg.g && _gg.gebj) {
      var ak = calcDlvAK(parseInt(_gg.gebj), _gg.g, eventJahr);
      if (ak) akInp.value = ak;
    }
  });
}

function bkSyncDatum(val) {
  // Globales Datum auf alle Zeilen übertragen
  if (!val) return;
  var m = val.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  var formatted = m ? m[3] + '.' + m[2] + '.' + m[1] : val;
  document.querySelectorAll('#bulk-rows .bk-zeilendatum').forEach(function(el) {
    el.value = formatted;
  });
  // AKs für alle Zeilen neu berechnen (jetzt wo Datum bekannt ist)
  var tbody = document.getElementById('bulk-rows');
  if (!tbody) return;
  var eventJahr = _bkEventJahr();
  Array.from(tbody.querySelectorAll('tr')).forEach(function(tr) {
    var akInp = tr.querySelector('.bk-ak');
    if (!akInp) return;
    var _gg = _bkRowGebjG(tr);
    if (_gg.g && _gg.gebj) {
      var ak = calcDlvAK(parseInt(_gg.gebj), _gg.g, eventJahr);
      if (ak) akInp.value = ak;
    }
  });
}
// ── RACERESULT-IMPORT ──────────────────────────────────────
function rrKatChanged() {
  var kat = (document.getElementById('rr-kat') || {}).value || '';
  var btn = document.getElementById('rr-load-btn');
  if (btn) btn.disabled = !kat;
  // Gewählte Kategorie merken für Disziplin-Filterung in der Preview
  window._rrKat = kat;
}

async function rrFetch() {
  var raw = ((document.getElementById('rr-url') || {}).value || '').trim();
  if (!raw) { notify('Bitte URL oder Event-ID eingeben.', 'err'); return; }

  var preview = document.getElementById('rr-preview');
  preview.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text2)">&#x23F3; Lade&hellip;</div>';

  // Wenn URL nicht raceresult.com → serverseitig auf RRPublish prüfen
  if (raw.indexOf('raceresult.com') < 0 && raw.match(/^https?:\/\//)) {
    preview.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text2)">&#x23F3; Suche RaceResult-Quelle\u2026</div>';
    var foundId = null;
    try {
      var proxyResp = await apiGet('rr-fetch?proxy_url=' + encodeURIComponent(raw));
      if (proxyResp && proxyResp.ok && proxyResp.data && proxyResp.data.event_id) {
        foundId = proxyResp.data.event_id;
      }
    } catch(ep) {}

    if (foundId) {
      raw = 'https://my.raceresult.com/' + foundId + '/';
      notify('RaceResult Event-ID ' + foundId + ' gefunden \u2192 ' + raw, 'ok');
      document.getElementById('rr-url').value = raw;
    } else {
      preview.innerHTML =
        '<div style="padding:20px;color:var(--text2);font-size:13px">' +
          '<strong>Keine RaceResult-Event-ID gefunden.</strong><br><br>' +
          'Diese Seite l\u00e4dt die Ergebnisse dynamisch \u2013 der Server-Proxy kann sie nicht auslesen.<br><br>' +
          'Bitte \u00f6ffne die Ergebnisseite, schaue im Browser-Entwicklertool (Netzwerk-Tab) nach ' +
          'einem Request an <code>my.raceresult.com/<strong>XXXXX</strong>/</code> und trage ' +
          'diese URL direkt ein.' +
        '</div>';
      return;
    }
  }

  var eventId = (raw.match(/(\d{4,7})/) || [])[1];
  if (!eventId) { notify('Keine g\u00fcltige Event-ID gefunden.', 'err'); return; }

  var _rrDebug = { totalRows: 0, clubSamples: [], dataFields: [], iClub: 7, cfgKeys: [], cfgKey: '', errors: [] };
  window._rrDebug = _rrDebug;
  try {
    var cfgResp = await fetch('https://my.raceresult.com/' + eventId + '/RRPublish/data/config?lang=de&page=results&noVisitor=1');
    if (!cfgResp.ok) throw new Error('HTTP ' + cfgResp.status + ' bei config');
    var cfgText = await cfgResp.text();
    var cfg;
    try { cfg = JSON.parse(cfgText); } catch(e) { throw new Error('Config kein JSON: ' + cfgText.slice(0, 200)); }
    if (!cfg || typeof cfg !== 'object') throw new Error('Config ungültig: ' + cfgText.slice(0, 200));

    _rrDebug.cfgRaw = JSON.stringify(cfg).slice(0, 800);
    var apiKey     = cfg.key || cfg.Key || cfg.apikey || cfg.APIKey || '';
    var eventName  = _rrResolveMultilang(cfg.EventName || cfg.Name || cfg.eventname || '');
    var _cfgDateRaw = cfg.EventDate || cfg.Date || cfg.eventdate || cfg.eventDatum || cfg.StartDate || cfg.start_date || cfg.datestring || cfg.Datestring || '';
    var eventDate = '';
    if (_cfgDateRaw) {
      var _ds = String(_cfgDateRaw).trim();
      // ISO oder YYYY-MM-DD?
      if (/^\d{4}-\d{2}-\d{2}/.test(_ds)) {
        eventDate = _ds.slice(0,10);
      // DD.MM.YYYY?
      } else if (/^\d{2}\.\d{2}\.\d{4}/.test(_ds)) {
        var _p = _ds.match(/(\d{2})\.(\d{2})\.(\d{4})/);
        eventDate = _p[3]+'-'+_p[2]+'-'+_p[1];
      // Unix-Timestamp (Sekunden, 9-10 Stellen)?
      } else if (/^\d{9,10}$/.test(_ds)) {
        var _d = new Date(parseInt(_ds) * 1000);
        eventDate = _d.toISOString().slice(0,10);
      }
    }
    var eventOrtCfg = cfg.City || cfg.city || cfg.Location || cfg.location || cfg.Place || cfg.place || cfg.Venue || cfg.venue || cfg.Ort || cfg.ort || '';

    // Datum aus cfg.infotext extrahieren (enthält manchmal HTML mit Datum)
    if (!_cfgDateRaw) {
      var _infoRaw = String(cfg.infotext || cfg.InfoText || '');
      // DD.MM.YYYY oder YYYY-MM-DD im Infotext suchen
      var _infoDateM = _infoRaw.match(/(\d{2})\.(\d{2})\.(\d{4})/) || _infoRaw.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (_infoDateM) _cfgDateRaw = _infoDateM[0];
      _rrDebug.infotext = _infoRaw.replace(/<[^>]+>/g,'').slice(0, 200);
    }
    // Datum aus ListSelector / lists-Keys extrahieren
    if (!_cfgDateRaw) {
      var _lsRaw = String(cfg.ListSelector || '');
      var _lsDateM = _lsRaw.match(/(\d{2})\.(\d{2})\.(\d{4})/);
      if (_lsDateM) _cfgDateRaw = _lsDateM[0];
    }
    // Datum aus cfg (alle Keys) nach DD.MM.YYYY suchen
    if (!_cfgDateRaw) {
      var _cfgStr = JSON.stringify(cfg);
      var _anyDateM = _cfgStr.match(/"(\d{2})\.(\d{2})\.(\d{4})"/);
      if (_anyDateM) _cfgDateRaw = _anyDateM[1] + '.' + _anyDateM[2] + '.' + _anyDateM[3];
      if (!_cfgDateRaw) {
        var _anyIsoM = _cfgStr.match(/"(\d{4}-\d{2}-\d{2})"/);
        if (_anyIsoM) _cfgDateRaw = _anyIsoM[1];
      }
      _rrDebug.cfgStrDateSearch = _cfgStr.slice(0, 500);
    }
    // Komma und Land abschneiden: "Wachtendonk, Deutschland" → "Wachtendonk"
    if (eventOrtCfg) eventOrtCfg = eventOrtCfg.split(',')[0].trim();

    // Datum-Fallback: PHP-Proxy fetcht HTML-Titel (enthält Datum bei den meisten Events)
    if (!eventDate) {
      try {
        var _prx = await apiGet('rr-fetch?event_id=' + encodeURIComponent(eventId));
        if (_prx && _prx.ok) {
          if (_prx.data.date) eventDate = _prx.data.date;
          if (_prx.data.location) window._rrProxyLocation = _prx.data.location;
          _rrDebug.titleFetch = _prx.data.title + ' → Datum:' + (eventDate||'?') + ' Ort:' + (_prx.data.location||'?');
          if (_prx.data.htmlSnippet) _rrDebug.htmlSnippet = _prx.data.htmlSnippet;
        } else {
          _rrDebug.titleFetch = 'Fetch fehlgeschlagen';
        }
      } catch(e) { _rrDebug.titleFetch = 'Fehler: ' + String(e); }
    }
    var contestObj = cfg.contests || cfg.Contests || {};
    _rrDebug.cfgKeys = Object.keys(cfg).slice(0, 20);
    // listname aus Config ermitteln
    // lists kann sein: Array [{Name:"01_Ergebnislisten|Final", Contest:"0", ...}]
    //                  oder Objekt {"02-ERGEBNISSE|xyz": {...}}
    var listName = '';
    var listContest = null; // Contest-Einschränkung aus List-Eintrag ("0" = alle)
    var listSource = cfg.list || cfg.lists || {};
    var _listCandidates = []; // alle nicht-geblacklisteten Listen für Fallback
    var _contestListMap = {}; // contestId → spezifische listName
    var listPrio = ['ERGEBNIS','RESULT','GESAMT','FINISH','ZIEL','EINZEL','FINAL','WERTUNG','RANKING','OVERALL'];
    // Listen die keine Einzelergebnisse enthalten und übersprungen werden sollen
    var _listBlacklist = ['STAFF','RELAY','KING','QUEEN','AGGREGATE','OVERALL RANKING','OVERALL-RANKING','MANNSCHAFT','TEAM RANKING','SPECIAL','LIVE','TOP10','TOP 10','TOP5','TOP 5','LEADERBOARD','SCHNELLSTE','FASTEST','SIEGER','WINNER','PARTICIPANTS','STATISTIC','TEILNEHMER','ALPHABET','STADTMEISTER'];
    function _listIsBlacklisted(entry) {
      var ename = (entry.Name || entry.name || entry.listname || '').toUpperCase();
      var showAs = (entry.ShowAs || entry.showAs || '').toUpperCase();
      // z_-Prefix = interne/Spezial-Liste
      if ((entry.Name||'').startsWith('z_') || (entry.Name||'').startsWith('Z_')) return true;
      for (var bi = 0; bi < _listBlacklist.length; bi++) {
        if (ename.indexOf(_listBlacklist[bi]) >= 0 || showAs.indexOf(_listBlacklist[bi]) >= 0) return true;
      }
      return false;
    }
    if (Array.isArray(listSource)) {
      // Prüfen: Array of Objects oder String-Array?
      var _isStrArr = listSource.length > 0 && typeof listSource[0] === 'string';
      if (_isStrArr) {
        // String-Array: ["Ergebnislisten|Siegerliste", "Ergebnislisten|1.2 Zieleinlaufliste netto", ...]
        var _strListBlacklisted = function(s) {
          var u = s.toUpperCase();
          if (u.startsWith('__') || u.startsWith('Z_')) return true;
          for (var bi = 0; bi < _listBlacklist.length; bi++) {
            if (u.indexOf(_listBlacklist[bi]) >= 0) return true;
          }
          return false;
        };
        // Alle nicht-geblacklisteten als Kandidaten sammeln (dedupliziert)
        var _seenLists = {};
        for (var lk2 = 0; lk2 < listSource.length; lk2++) {
          var ls = listSource[lk2];
          if (!_strListBlacklisted(ls) && !_seenLists[ls]) { _seenLists[ls]=1; _listCandidates.push(ls); }
        }
        // Prio-Suche
        for (var lp2 = 0; lp2 < listPrio.length && !listName; lp2++) {
          for (var lk2 = 0; lk2 < _listCandidates.length && !listName; lk2++) {
            if (_listCandidates[lk2].toUpperCase().indexOf(listPrio[lp2]) >= 0) listName = _listCandidates[lk2];
          }
        }
        if (!listName && _listCandidates.length) listName = _listCandidates[0];
        if (!listName && listSource.length) listName = listSource[0];
        _rrDebug.listsRaw = JSON.stringify(listSource).slice(0, 400);
      } else {
      // Array of Objects
      for (var lk = 0; lk < listSource.length && !listName; lk++) {
        var entry = listSource[lk];
        var ename = entry.Name || entry.name || entry.listname || '';
        var lkey = ename.toUpperCase();
        if (_listIsBlacklisted(entry)) continue;
        for (var lp = 0; lp < listPrio.length; lp++) {
          if (lkey.indexOf(listPrio[lp]) >= 0) {
            listName = ename;
            listContest = entry.Contest !== undefined ? String(entry.Contest) : null;
            break;
          }
        }
      }
      // Fallback: ersten nicht-geblacklisteten Eintrag nehmen
      if (!listName) {
        for (var lk = 0; lk < listSource.length; lk++) {
          var entry = listSource[lk];
          var ename = entry.Name || entry.name || entry.listname || '';
          if (!_listIsBlacklisted(entry)) {
            listName = ename;
            listContest = entry.Contest !== undefined ? String(entry.Contest) : null;
            break;
          }
        }
      }
      if (!listName && listSource.length) {
        var e0 = listSource[0];
        listName = e0.Name || e0.name || e0.listname || '';
        listContest = e0.Contest !== undefined ? String(e0.Contest) : null;
      }
      _rrDebug.listsRaw = JSON.stringify(listSource.map(function(e){return e.Name||e.name||'';}));
      // Contest→ListName-Map: jeder Contest bekommt seine spezifische Liste
      for (var _clj = 0; _clj < listSource.length; _clj++) {
        var _cle = listSource[_clj];
        var _clName = _cle.Name || _cle.name || '';
        var _clContest = String(_cle.Contest !== undefined ? _cle.Contest : '');
        if (_clName && _clContest && !_listIsBlacklisted(_cle)) {
          if (!_contestListMap[_clContest]) _contestListMap[_clContest] = _clName;
        }
      }
      _rrDebug.contestListMap = _contestListMap;
      } // end Array of Objects
    } else if (listSource && typeof listSource === 'object') {
      var listKeys = Object.keys(listSource);
      for (var lk = 0; lk < listKeys.length && !listName; lk++) {
        var lkey = listKeys[lk].toUpperCase();
        if (lkey.indexOf('STAFF') >= 0 || lkey.indexOf('RELAY') >= 0) continue;
        for (var lp = 0; lp < listPrio.length; lp++) {
          if (lkey.indexOf(listPrio[lp]) >= 0) { listName = listKeys[lk]; break; }
        }
      }
      if (!listName && listKeys.length) listName = listKeys[0];
      _rrDebug.listsRaw = JSON.stringify(Object.keys(listSource)).slice(0, 200);
    }
    if (!listName) listName = '02-ERGEBNISSE|Ergebnisse_Ges';

    // Contest=0 bedeutet: Liste gilt für alle Contests auf einmal → erst Contest 0 versuchen
    var contestIds = Object.keys(contestObj);
    if (!contestIds.length) contestIds = ['1'];
    if (listContest === '0') {
      // Erst Contest 0 versuchen; nur auf einzelne Contests ausweichen wenn Contest 0 leer
      contestIds = ['0']; // _fallbackIds werden unten bei Bedarf nachgeladen
      window._rrFallbackIds = Object.keys(contestObj).filter(function(k){ return k !== '0'; });
    } else {
      window._rrFallbackIds = [];
    }

    _rrDebug.cfgOrt = eventOrtCfg;
    _rrDebug.cfgKey = apiKey;
    _rrDebug.cfgDateRaw = _cfgDateRaw + (_rrDebug.titleFetch ? ' | Titel-Fetch: ' + _rrDebug.titleFetch : '');
    _rrDebug.cfgAllKeys = JSON.stringify(Object.keys(cfg)).slice(0, 300);
    _rrDebug.cfgTime = cfg.Time !== undefined ? String(cfg.Time) : '–'; // dynamischer Serverwert, kein Datum
    // Datum ins Eingabefeld übernehmen wenn per Proxy gefunden
    if (eventDate) {
      var _datEl = document.getElementById('rr-datum');
      if (_datEl && !_datEl.value) {
        var _dp = eventDate.match(/(\d{4})-(\d{2})-(\d{2})/);
        if (_dp) _datEl.value = _dp[3] + '.' + _dp[2] + '.' + _dp[1];
      }
    }

    _rrDebug.eventDate = eventDate;
    _rrDebug.cfgEventName = cfg.eventname || '';
    _rrDebug.contestSample = JSON.stringify(contestObj).slice(0, 150);
    _rrDebug.listName = listName;
    _rrDebug.listContest = listContest;

    // Spaltenindizes: Defaults, werden per DataFields überschrieben
    var iName=3; var iClub=6; var iAK=-1; var iZeit=8; var iNetto=7; var iPlatz=2;
    var iYear=-1; var iGeschlecht=-1; var iFirstname=-1;

    // /results/list statt /RRPublish/data/list: manche Events sind über den RRPublish-Datenpfad
    // nicht erreichbar (404), obwohl die Website (die intern /results/list nutzt) funktioniert.
    var base4 = 'https://my.raceresult.com/' + eventId + '/results/list';
    var hdrs  = { 'Origin': 'https://my.raceresult.com', 'Referer': 'https://my.raceresult.com/' };
    var allResults = [];
    var allRowsForAK = [];
    window._rrAllRowsForAK = allRowsForAK;
    // eventOrt HIER deklarieren (vor dem Extraktionsblock der weiter oben steht → wird durch Hoisting korrekt)
    var eventOrt = window._rrProxyLocation || eventOrtCfg || '';
    window._rrProxyLocation = null; // Reset
    // Ort aus Veranstaltungsname wenn noch leer
    if (!eventOrt && eventName) {
      var _enWords = eventName.trim().split(/\s+/);
      if (_enWords.length > 1) eventOrt = _enWords[_enWords.length - 1];
    }

    // clubPhrase vor dem Loop definieren damit es im URL-Build verfügbar ist
    var vereinRawGlobal = (appConfig.verein_kuerzel || appConfig.verein_name || '');
    var clubPhrase = vereinRawGlobal.toLowerCase().trim();

    for (var ci = 0; ci < contestIds.length; ci++) {
      var cid   = contestIds[ci];
      var cname = contestObj[cid] || (cid === '0' ? '' : ('Contest ' + cid));
      preview.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text2)">&#x23F3; ' + (ci+1) + '/' + contestIds.length + ': ' + cname + '&hellip;</div>';
      try {
        var url = base4 +
          '?key='      + apiKey +
          '&listname=' + encodeURIComponent(_contestListMap[cid] || listName) +
          '&page=results&contest=' + cid +
          '&r=search&l=9999&term=';
        var _ac = new AbortController();
        var _t  = setTimeout(function(){ _ac.abort(); }, 12000);
        var resp;
        try { resp = await fetch(url, { headers: hdrs, signal: _ac.signal }); }
        catch(fe) { clearTimeout(_t); continue; }
        clearTimeout(_t);
        if (!resp.ok) continue;

        var payload = JSON.parse(await resp.text());
        _rrDebug.topKeys = Object.keys(payload);

        // cname für contest=0 aus groupFilters aktiven Filter ableiten
        if (!cname) {
          var _gfActive = (payload.groupFilters || []).filter(function(g){ return g.Type === 1 && g.Value; });
          cname = _gfActive.length ? _gfActive[0].Value : ('Contest ' + cid);
        }

        // DataFields immer frisch aus Response — nicht Contest-übergreifend wiederverwenden
        var df = payload.DataFields || [];
        if (!Array.isArray(df) || df.length === 0) {
          // Keine DataFields im r=search → r=all versuchen (Suchfunktion ggf. defekt)
          var _acPre = new AbortController(); var _tPre = setTimeout(function(){ _acPre.abort(); }, 15000);
          try {
            var _respPre = await fetch(base4 + '?key=' + apiKey + '&listname=' + encodeURIComponent(_contestListMap[cid] || listName) + '&page=results&contest=' + cid + '&r=all&l=de&_=1', { headers: hdrs, signal: _acPre.signal });
            clearTimeout(_tPre);
            if (_respPre.ok) {
              var _payPre = JSON.parse(await _respPre.text());
              if ((_payPre.DataFields || []).length > 0) {
                payload = _payPre;
                df = _payPre.DataFields;
              }
            }
          } catch(ePre) { clearTimeout(_tPre); }
          if (!df.length) {
            _rrDebug.errors = _rrDebug.errors || [];
            _rrDebug.errors.push('Contest ' + cid + ': keine DataFields, Liste übersprungen');
            continue;
          }
        }
        // Immer zurücksetzen — auch wenn df leer (wird dann mit Defaults gespeichert)
        iAK = -1; iYear = -1; iGeschlecht = -1; var iAKPlatz = -1;
        iName = 3; iClub = 6; iNetto = -1; iZeit = -1; iPlatz = 2; iFirstname = -1;
        if (Array.isArray(df) && df.length > 0) {
          var _hnf2 = false;
          for (var fi = 0; fi < df.length; fi++) {
            var f = df[fi].toLowerCase();
            if (f.indexOf('anzeigename') >= 0 || f.indexOf('flname') >= 0 || f.indexOf('lfname') >= 0 || f === 'displayname' || f === 'fullname' || f === 'name' || f.indexOf('es_name') >= 0) { iName = fi; _hnf2 = true; }
            else if ((f.indexOf('lastname') >= 0 || f.indexOf('nachname') >= 0 || f.indexOf('surname') >= 0) && !_hnf2) iName = fi;
            else if (f.indexOf('firstname') >= 0 || f.indexOf('vorname') >= 0 || f === 'first') iFirstname = fi;
            else if (f.indexOf('club') >= 0 || f.indexOf('verein') >= 0) iClub = fi;
            else if (f.indexOf('zeit') >= 0) { if (f.indexOf('netto') >= 0) iNetto = fi; else iZeit = fi; } // "ZeitMitStatus" vor mitstatus-Check!
            else if ((f.indexOf('agegroup') >= 0 || f === '[agegroup1.nameshort]' || f.indexOf('akabk') >= 0 || f.indexOf('ak_abk') >= 0 || f.indexOf('es_akabkürzung') >= 0 || f.indexOf('agegroupname') >= 0) && f.indexOf('rank') < 0) iAK = fi;
            else if (f.indexOf('flag') >= 0 || f.indexOf('nation') >= 0) { /* skip */ }
            else if (f === 'year' || f === 'yob' || f === 'birthyear' || f.indexOf('es_jahrgang') >= 0) iYear = fi;
            else if (f.indexOf('geschlechtmw') >= 0 || f.indexOf('es_geschlecht') >= 0 || f === 'gendermf' || f === 'gender' || f === 'sex') iGeschlecht = fi;
            else if (f.indexOf('chip') >= 0 || f.indexOf('netto') >= 0) iNetto = fi;
            else if (f.indexOf('gun') >= 0 || f.indexOf('brutto') >= 0 || f === 'ziel' || f.indexOf('ziel') >= 0 || f.indexOf('finish') >= 0) iZeit = fi;
            else if (f.indexOf('time') >= 0) iZeit = fi;  // fängt auch "choose([STATUS]+1;[TIME1];...)" ab
            else if (/^rank\dp$/.test(f)) { if (f === 'rank1p') iPlatz = fi; else iAKPlatz = fi; }
            else if (f.indexOf('akpl') >= 0 || f.indexOf('[ak') >= 0) iAKPlatz = fi;  // AKPlp, AKPl.P, AKLVNPlp direkt
            else if (f.indexOf('autorankp') >= 0 || f.indexOf('overallrank') >= 0 || f.indexOf('withstatus') >= 0 || f.indexOf('mitstatus') >= 0 || f.indexOf('statusplatz') >= 0) { // withstatus BEFORE agegroup check
              // MitStatus([AKPlp]) / StatusPlatz([AKPl.P]) / MitStatus([AKLVNPlp]) = AK-Platz
              if (f.indexOf('akpl') >= 0 || f.indexOf('[ak') >= 0) iAKPlatz = fi;
              else iPlatz = fi;
            }
          }
          if (_hnf2) iFirstname = -1; // Vollname-Feld gefunden → kein separates Vorname-Feld nötig
          if (iNetto >= 0 && iZeit < 0) iZeit = iNetto;
          // Kein Netto-Feld gefunden: iZeit als Netto verwenden (Brutto als Fallback)
          if (iNetto < 0 && iZeit >= 0) iNetto = iZeit;
          // Sicherheits-Check: iNetto und iClub dürfen nicht gleich sein
          if (iNetto >= 0 && iNetto === iClub) iNetto = iZeit >= 0 && iZeit !== iClub ? iZeit : -1;
          _rrDebug.iClub = iClub; _rrDebug.dfLog = df.join(', ');
        }

        // Wenn r=search keine Zeilen liefert aber DataFields vorhanden: r=all laden
        var _searchRows = Object.values(payload.data || {}).reduce(function(n,v){
          return n + (Array.isArray(v) ? v.length : Object.values(v||{}).reduce(function(m,r){ return m+(Array.isArray(r)?r.length:0); }, 0));
        }, 0);
        // r=all Fallback: wenn r=search 0 Zeilen liefert (Suchfunktion defekt) oder keine DataFields
        if (_searchRows === 0) {
          var _acAll = new AbortController(); var _tAll = setTimeout(function(){ _acAll.abort(); }, 15000);
          try {
            var _respAll = await fetch(base4 + '?key=' + apiKey + '&listname=' + encodeURIComponent(_contestListMap[cid] || listName) + '&page=results&contest=' + cid + '&r=all&l=de&_=1', { headers: hdrs, signal: _acAll.signal });
            clearTimeout(_tAll);
            if (_respAll.ok) {
              payload = JSON.parse(await _respAll.text());
              // DataFields neu kalibrieren wenn jetzt vorhanden
              var _dfAll = payload.DataFields || [];
              if (_dfAll.length > 0) {
                df = _dfAll;
                _rrDebug.dataFields = _dfAll;
                // Kalibrierung wiederholen
                iAK = -1; iYear = -1; iGeschlecht = -1; var iAKPlatz = -1;
                iName = 3; iClub = 6; iNetto = -1; iZeit = -1; iPlatz = 2; iFirstname = -1;
                var _hnf3 = false;
                for (var _fai = 0; _fai < _dfAll.length; _fai++) {
                  var _fa = _dfAll[_fai].toLowerCase();
                  if (_fa.indexOf('anzeigename') >= 0 || _fa.indexOf('flname') >= 0 || _fa.indexOf('lfname') >= 0 || _fa === 'displayname' || _fa === 'fullname' || _fa === 'name' || _fa.indexOf('es_name') >= 0) { iName = _fai; _hnf3 = true; }
                  else if ((_fa.indexOf('lastname') >= 0 || _fa.indexOf('nachname') >= 0 || _fa.indexOf('surname') >= 0) && !_hnf3) iName = _fai;
                  else if (_fa.indexOf('firstname') >= 0 || _fa.indexOf('vorname') >= 0 || _fa === 'first') iFirstname = _fai;
                  else if (_fa.indexOf('club') >= 0 || _fa.indexOf('verein') >= 0) iClub = _fai;
                  else if (_fa.indexOf('zeit') >= 0) { if (_fa.indexOf('netto') >= 0) iNetto = _fai; else iZeit = _fai; }
                  else if ((_fa.indexOf('agegroup') >= 0 || _fa.indexOf('akabk') >= 0 || _fa.indexOf('agegroupname') >= 0) && _fa.indexOf('rank') < 0) iAK = _fai;
                  else if (_fa === 'year' || _fa === 'yob') iYear = _fai;
                  else if (_fa.indexOf('geschlechtmw') >= 0 || _fa === 'gendermf' || _fa === 'gender') iGeschlecht = _fai;
                  else if (_fa.indexOf('chip') >= 0 || _fa.indexOf('netto') >= 0) iNetto = _fai;
                  else if (_fa.indexOf('gun') >= 0 || _fa.indexOf('brutto') >= 0 || _fa === 'ziel' || _fa.indexOf('finish') >= 0 || _fa.indexOf('ziel') >= 0) iZeit = _fai;
                  else if (_fa.indexOf('time') >= 0) iZeit = _fai;  // fängt auch "choose([STATUS]+1;[TIME1];...)" ab
                  else if (_fa.indexOf('akpl') >= 0 || _fa.indexOf('[ak') >= 0) iAKPlatz = _fai;
                  else if (_fa.indexOf('mitstatus') >= 0 || _fa.indexOf('statusplatz') >= 0) { if (_fa.indexOf('akpl') >= 0 || _fa.indexOf('[ak') >= 0) iAKPlatz = _fai; else iPlatz = _fai; }
                }
                if (_hnf3) iFirstname = -1;
                if (iNetto < 0 && iZeit >= 0) iNetto = iZeit;
                if (iNetto >= 0 && iNetto === iClub) iNetto = (iZeit >= 0 && iZeit !== iClub) ? iZeit : -1;
                _rrDebug.iClub = iClub; _rrDebug.dfLog = _dfAll.join(', ');
              }
            }
          } catch(eAll) { clearTimeout(_tAll); }
        }

        // Daten flachmachen: {Contest: {Gruppe: [rows]}} -> {Contest/Gruppe: [rows]}
        var dRaw = payload.data || {};
        var _dks = Object.keys(dRaw);
        if (!_rrDebug.dataKeys) _rrDebug.dataKeys = JSON.stringify(_dks).slice(0, 200);
        var gf = payload.groupFilters || [];
        if (!_rrDebug.groupFilters) _rrDebug.groupFilters = JSON.stringify(gf).slice(0, 200);

        _dks.forEach(function(k) {
          var v = dRaw[k];
          // Struktur-Erkennung:
          // A) v ist direkt eine Row: ["BIB","ID",...] → Array dessen erster Eintrag kein Array ist
          // B) v ist Array von Rows: [["BIB",...],["BIB",...]] → Array von Arrays
          // C) v ist Objekt mit Gruppen-Keys: {"Gruppe1": [rows], ...}
          var groups;
          if (Array.isArray(v)) {
            if (v.length > 0 && Array.isArray(v[0])) {
              groups = { '': v };          // B: Array von Rows
            } else if (v.length > 0 && !Array.isArray(v[0])) {
              groups = { '': [v] };        // A: v ist selbst eine Row
            } else {
              groups = { '': v };
            }
          } else if (v && typeof v === 'object') {
            groups = v;                    // C: Gruppen-Objekt
          } else {
            groups = {};
          }
          Object.keys(groups).forEach(function(k2) {
            var rows = groups[k2];
            if (!Array.isArray(rows)) return;
            rows.forEach(function(row) {
              if (!Array.isArray(row) || row.length < 4) return;
              _rrDebug.totalRows++;
              var clubVal = iClub >= 0 ? String(row[iClub] || '').trim() : '';
              if (clubVal && _rrDebug.clubSamples.indexOf(clubVal) < 0 && _rrDebug.clubSamples.length < 20)
                _rrDebug.clubSamples.push(clubVal);
              // Alle Rows für AK-Platz-Berechnung speichern (Zeit + AK oder Jahr+Geschlecht)
              var gkey = k2 ? (k + '/' + k2) : k;
              var gParts = gkey.split('/');
              // Gruppen-Keys für Debug sammeln
              if (!_rrDebug.groupKeysSample) _rrDebug.groupKeysSample = {};
              if (Object.keys(_rrDebug.groupKeysSample).length < 10) _rrDebug.groupKeysSample[gkey] = 1;
              var _akFromGroup = '';
              // gk: vollen Pfad speichern für Disziplin-Erkennung
              // Letzter Teil für AK/Geschlecht-Erkennung
              var gk = gkey; // vollständiger Pfad z.B. "#1_Halbmarathon/#1_Männlich"
              var gkLast = gParts[gParts.length-1]; // letzter Teil für AK-Erkennung
              if (iAK < 0 && gParts.length > 1) {
                var _gkClean = gkLast.replace(/^#[0-9]+_/, '').trim();
                if (/männl|male|herren|männlich/i.test(_gkClean)) _akFromGroup = 'M';
                else if (/weibl|female|frauen|weiblich/i.test(_gkClean)) _akFromGroup = 'W';
                // AK direkt aus Gruppen-Key lesen (z.B. "M35", "W45")
                var _akMatch = _gkClean.match(/^([MW]\d{2}|[MW]U\d{2}|[MW])$/i);
                if (_akMatch) _akFromGroup = normalizeAK(_akMatch[1].toUpperCase());
              }
              var _zeit4ak = String(row[iNetto] || row[iZeit] || '').trim();
              if (_zeit4ak) {
                var _ak4 = iAK >= 0 ? String(row[iAK]||'').trim() : '';
                var _yr4 = iYear >= 0 ? String(row[iYear]||'').trim() : '';
                var _gs4 = iGeschlecht >= 0 ? String(row[iGeschlecht]||'').toUpperCase().trim() : '';
                // Geschlecht aus Gruppen-Key als Fallback
                if (!_gs4 && _akFromGroup) _gs4 = _akFromGroup[0]; // 'M' oder 'W'
                allRowsForAK.push({ ak: _ak4, zeit: _zeit4ak, year: _yr4, geschlecht: _gs4 });
              }
              if (clubPhrase && clubVal.toLowerCase().indexOf(clubPhrase) < 0) return;
              var _akRaw4 = iAK >= 0 ? String(row[iAK]||'').trim() : '';
              var _akPlatzFromRow = ''; // Platz aus kombiniertem AK-Feld "74. M35"
              if (_akRaw4 && /^\d+\.?\s*[A-Z]/.test(_akRaw4)) {
                var _akSplit = _akRaw4.match(/^(\d+)\.?\s*(.+)$/);
                if (_akSplit) { _akPlatzFromRow = _akSplit[1]; _akRaw4 = _akSplit[2].trim(); }
              }
              // iAKPlatz direkt aus Daten lesen wenn vorhanden
              if (iAKPlatz >= 0 && !_akPlatzFromRow) {
                var _akpRaw = String(row[iAKPlatz]||'').trim().replace(/\./,'');
                if (_akpRaw && /^\d+$/.test(_akpRaw)) _akPlatzFromRow = _akpRaw;
              }
              allResults.push({ raw: row, contestName: cname, groupKey: gk, akFromGroup: _akFromGroup, akPlatzFromRow: _akPlatzFromRow, iAKPlatz: iAKPlatz,
                iYear: iYear, iGeschlecht: iGeschlecht,
                iName: iName, iFirstname: iFirstname, iClub: iClub, iAK: iAK, iZeit: iZeit, iNetto: iNetto, iPlatz: iPlatz });
            });
          });
        });
      } catch(e2) { continue; }
    }
    // Fallback: wenn Contest 0 keine Treffer → einzelne Contests probieren
    if (!allResults.length && window._rrFallbackIds && window._rrFallbackIds.length) {
      contestIds = window._rrFallbackIds;
      for (var ci2 = 0; ci2 < contestIds.length; ci2++) {
        var cid2 = contestIds[ci2];
        var cname2 = contestObj[cid2] || ('Contest ' + cid2);
        var _ac2 = new AbortController(); var _t2 = setTimeout(function(){ _ac2.abort(); }, 12000);
        try {
          var resp2 = await fetch(base4 + '?key=' + apiKey + '&listname=' + encodeURIComponent(_contestListMap[cid] || listName) + '&page=results&contest=' + cid2 + '&r=all&l=de&_=1', { headers: hdrs, signal: _ac2.signal });
          clearTimeout(_t2);
          if (!resp2.ok) continue;
          var payload2 = JSON.parse(await resp2.text());
          var df2 = payload2.DataFields || [];
          if (Array.isArray(df2) && df2.length > 0) {
            iAK = -1; iYear = -1; iGeschlecht = -1; iAKPlatz = -1;
            iName = 3; iClub = 6; iNetto = -1; iZeit = -1; iPlatz = 2; iFirstname = -1;
            var _hnf4 = false;
            for (var fi2 = 0; fi2 < df2.length; fi2++) {
              var f2 = df2[fi2].toLowerCase();
              if (f2.indexOf('anzeigename') >= 0 || f2.indexOf('flname') >= 0 || f2.indexOf('lfname') >= 0 || f2 === 'displayname' || f2 === 'fullname' || f2 === 'name' || f2.indexOf('es_name') >= 0) { iName = fi2; _hnf4 = true; }
              else if ((f2.indexOf('lastname') >= 0 || f2.indexOf('nachname') >= 0 || f2.indexOf('surname') >= 0) && !_hnf4) iName = fi2;
              else if (f2.indexOf('firstname') >= 0 || f2.indexOf('vorname') >= 0 || f2 === 'first') iFirstname = fi2;
              else if (f2.indexOf('club') >= 0 || f2.indexOf('verein') >= 0) iClub = fi2;
              else if (f2.indexOf('zeit') >= 0) { if (f2.indexOf('netto') >= 0) iNetto = fi2; else iZeit = fi2; }
              else if ((f2.indexOf('agegroup') >= 0 || f2.indexOf('akabk') >= 0 || f2.indexOf('ak_abk') >= 0 || f2.indexOf('es_akabkürzung') >= 0) && f2.indexOf('rank') < 0) iAK = fi2;
              else if (f2 === 'year' || f2 === 'yob' || f2.indexOf('es_jahrgang') >= 0) iYear = fi2;
              else if (f2.indexOf('geschlechtmw') >= 0 || f2.indexOf('es_geschlecht') >= 0) iGeschlecht = fi2;
              else if (f2.indexOf('chip') >= 0 || f2.indexOf('netto') >= 0) iNetto = fi2;
              else if (f2.indexOf('gun') >= 0 || f2.indexOf('brutto') >= 0 || f2 === 'ziel' || f2.indexOf('finish') >= 0) iZeit = fi2;
              else if (f2.indexOf('time') >= 0) iZeit = fi2;  // fängt auch "choose([STATUS]+1;[TIME1];...)" ab
              else if (f2.indexOf('akpl') >= 0 || f2.indexOf('[ak') >= 0) iAKPlatz = fi2;  // AKPlp, AKPl.P, AKLVNPlp direkt
              else if (f2.indexOf('autorankp') >= 0 || f2.indexOf('mitstatus') >= 0 || f2.indexOf('statusplatz') >= 0) {
                if (f2.indexOf('akpl') >= 0 || f2.indexOf('[ak') >= 0) iAKPlatz = fi2;
                else iPlatz = fi2;
              }
            }
            if (_hnf4) iFirstname = -1;
            if (iNetto >= 0 && iZeit < 0) iZeit = iNetto;
            if (iNetto < 0 && iZeit >= 0) iNetto = iZeit;
            if (iNetto >= 0 && iNetto === iClub) iNetto = iZeit >= 0 && iZeit !== iClub ? iZeit : -1;
          }
          var dRaw2 = payload2.data || {};
          Object.keys(dRaw2).forEach(function(k) {
            var v = dRaw2[k]; var groups = Array.isArray(v) ? (v.length>0&&Array.isArray(v[0]) ? {"":v} : {"": [v]}) : (v&&typeof v==="object"?v:{});
            Object.keys(groups).forEach(function(k2) {
              var rows2 = groups[k2]; if (!Array.isArray(rows2)) return;
              var gk2 = k2 ? (k + '/' + k2) : k;
              var gkClean2 = gk2.replace(/^#[0-9]+_/,'').trim();
              rows2.forEach(function(row) {
                if (!Array.isArray(row) || row.length < 4) return;
                var clubVal2 = iClub >= 0 ? String(row[iClub]||'').trim() : '';
                if (!clubPhrase || clubVal2.toLowerCase().indexOf(clubPhrase) >= 0) {
                  allResults.push({ raw: row, contestName: cname2, groupKey: gkClean2, akFromGroup: '',
                    iYear: iYear, iGeschlecht: iGeschlecht,
                    iName: iName, iFirstname: iFirstname, iClub: iClub, iAK: iAK, iZeit: iZeit, iNetto: iNetto, iPlatz: iPlatz });
                }
              });
            });
          });
        } catch(e3) { clearTimeout(_t2); continue; }
      }
    }
    // Listen-Fallback: wenn keine Ergebnisse, nächste Kandidaten-Liste versuchen
    var _listFallbackIdx = _listCandidates.indexOf(listName) + 1;
    while (!allResults.length && _listFallbackIdx < _listCandidates.length) {
      var _fbListName = _listCandidates[_listFallbackIdx++];
      _rrDebug.listName = _fbListName;
      preview.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text2)">&#x23F3; Liste \"' + _fbListName + '\" versuchen…</div>';
      for (var _fci = 0; _fci < contestIds.length; _fci++) {
        var _fcid = contestIds[_fci];
        var _fac = new AbortController(); var _ft = setTimeout(function(){ _fac.abort(); }, 12000);
        try {
          var _fr = await fetch(base4 + '?key=' + apiKey + '&listname=' + encodeURIComponent(_fbListName) + '&page=results&contest=' + _fcid + '&r=all&l=de&_=1', { headers: hdrs, signal: _fac.signal });
          clearTimeout(_ft);
          if (!_fr.ok) continue;
          var _fp = JSON.parse(await _fr.text());
          var _fdf = _fp.DataFields || [];
          if (!Array.isArray(_fdf) || _fdf.length === 0) continue;
          // Kalibrieren
          iAK = -1; iYear = -1; iGeschlecht = -1; var _fiAKPlatz = -1;
          iName = 3; iClub = 6; iNetto = -1; iZeit = -1; iPlatz = 2; iFirstname = -1;
          var _hnf5 = false;
          for (var _ffi = 0; _ffi < _fdf.length; _ffi++) {
            var _ff = _fdf[_ffi].toLowerCase();
            if (_ff.indexOf('anzeigename') >= 0 || _ff.indexOf('flname') >= 0 || _ff.indexOf('lfname') >= 0 || _ff === 'displayname' || _ff === 'fullname' || _ff === 'name' || _ff.indexOf('es_name') >= 0) { iName = _ffi; _hnf5 = true; }
            else if ((_ff.indexOf('lastname') >= 0 || _ff.indexOf('nachname') >= 0 || _ff.indexOf('surname') >= 0) && !_hnf5) iName = _ffi;
            else if (_ff.indexOf('firstname') >= 0 || _ff.indexOf('vorname') >= 0 || _ff === 'first') iFirstname = _ffi;
            else if (_ff.indexOf('club') >= 0 || _ff.indexOf('verein') >= 0) iClub = _ffi;
            else if (_ff.indexOf('zeit') >= 0) { if (_ff.indexOf('netto') >= 0) iNetto = _ffi; else iZeit = _ffi; }
            else if ((_ff.indexOf('agegroup') >= 0 || _ff.indexOf('akabk') >= 0 || _ff.indexOf('es_akabkürzung') >= 0) && _ff.indexOf('rank') < 0) iAK = _ffi;
            else if (_ff === 'year' || _ff === 'yob' || _ff.indexOf('es_jahrgang') >= 0) iYear = _ffi;
            else if (_ff.indexOf('geschlechtmw') >= 0 || _ff.indexOf('es_geschlecht') >= 0) iGeschlecht = _ffi;
            else if (_ff.indexOf('chip') >= 0 || _ff.indexOf('netto') >= 0) iNetto = _ffi;
            else if (_ff.indexOf('gun') >= 0 || _ff.indexOf('brutto') >= 0 || _ff.indexOf('ziel') >= 0) iZeit = _ffi;
            else if (_ff.indexOf('time') >= 0) iZeit = _ffi;  // fängt auch "choose([STATUS]+1;[TIME1];...)" ab
            else if (_ff.indexOf('mitstatus') >= 0 || _ff.indexOf('statusplatz') >= 0) { if (_ff.indexOf('akpl') >= 0 || _ff.indexOf('[ak') >= 0) _fiAKPlatz = _ffi; else iPlatz = _ffi; }
          }
          if (_hnf5) iFirstname = -1;
          if (iNetto < 0 && iZeit >= 0) iNetto = iZeit;
          if (iNetto >= 0 && iNetto === iClub) iNetto = (iZeit >= 0 && iZeit !== iClub) ? iZeit : -1;
          _rrDebug.iClub = iClub; _rrDebug.dfLog = _fdf.join(', ');
          _rrDebug.dataFields = _fdf;
          // Rows verarbeiten
          var _fdRaw = _fp.data || {};
          var _fDks = Object.keys(_fdRaw);
          _fDks.forEach(function(k) {
            var v = _fdRaw[k];
            var groups = Array.isArray(v) ? (v.length>0&&Array.isArray(v[0]) ? {"":v} : {"": [v]}) : (v&&typeof v==="object"?v:{});
            Object.keys(groups).forEach(function(k2) {
              var rows = groups[k2];
              if (!Array.isArray(rows)) return;
              rows.forEach(function(row) {
                if (!Array.isArray(row) || row.length < 4) return;
                _rrDebug.totalRows++;
                var clubVal = iClub >= 0 ? String(row[iClub] || '').trim() : '';
                if (clubVal && _rrDebug.clubSamples.indexOf(clubVal) < 0 && _rrDebug.clubSamples.length < 20) _rrDebug.clubSamples.push(clubVal);
                if (clubPhrase && clubVal.toLowerCase().indexOf(clubPhrase) < 0) return;
                var gkey = k2 ? (k + '/' + k2) : k;
                var gk = gkey;
                allResults.push({ raw: row, contestName: _fdf[0] || _fbListName, groupKey: gk, akFromGroup: '', akPlatzFromRow: '', iAKPlatz: _fiAKPlatz,
                  iYear: iYear, iGeschlecht: iGeschlecht, iName: iName, iFirstname: iFirstname, iClub: iClub, iAK: iAK, iZeit: iZeit, iNetto: iNetto, iPlatz: iPlatz });
              });
            });
          });
        } catch(e) { clearTimeout(_ft); }
      }
      if (allResults.length) {
        listName = _fbListName;
        _rrDebug.listName = _fbListName;
      }
    }

    if (!allResults.length) {
      var dbgClubs = _rrDebug.clubSamples.length ? _rrDebug.clubSamples.slice(0,10).join(', ') : '(keine)';
      var vereinRaw2 = (appConfig.verein_kuerzel || appConfig.verein_name || '').toLowerCase().trim();
      var _noResVer = (document.getElementById('header-version') || {}).textContent || '';
      var _noResText = [
        'Keine Vereins-Ergebnisse gefunden.',
        'App: ' + _noResVer + ' | ' + new Date().toLocaleString('de-DE'),
        'URL: https://my.raceresult.com/' + eventId + '/',
        contestIds.length + ' Contest(s) | Listname: ' + listName,
        'Gesamt-Zeilen: ' + _rrDebug.totalRows,
        'DataFields: ' + (_rrDebug.dataFields.join(', ') || '(keine)'),
        'iClub-Index: ' + _rrDebug.iClub,
        'Suchbegriff: "' + vereinRaw2 + '"',
        'Club-Werte (Sample): ' + dbgClubs,
        'Top-Level Keys: ' + ((_rrDebug.topKeys||[]).join(', ')||'?'),
        'Config-Keys: ' + ((_rrDebug.cfgKeys||[]).join(', ')||'?'),
        'API-Key: "' + (_rrDebug.cfgKey||'leer') + '" | Datum-Raw: ' + JSON.stringify(_rrDebug.cfgDateRaw||'(leer)') + ' → ' + (_rrDebug.eventDate||'leer') + ' | cfg.eventname: ' + (_rrDebug.cfgEventName||'–'),
        'Fehler: ' + ((_rrDebug.errors||[]).join('; ')||'keine'),
        'contestListMap: ' + JSON.stringify(_rrDebug.contestListMap||{}),
        'Contests: ' + (_rrDebug.contestSample||'?'),
        'groupFilters: ' + (_rrDebug.groupFilters||'–'),
        'data-Keys: ' + (_rrDebug.dataKeys||'–'),
        'ListName: ' + (_rrDebug.listName||'?') + (_rrDebug.listContest !== undefined ? ' (Contest=' + _rrDebug.listContest + ')' : ''),
        'lists-Raw: ' + (_rrDebug.listsRaw||'?'),
      ].join('\n');
      preview.innerHTML =
        '<div style="background:var(--surf2);border-radius:10px;padding:16px">' +
          '<strong>&#x274C; Keine Vereins-Ergebnisse gefunden.</strong>' +
          '<div style="position:relative;margin-top:10px">' +
            '<button onclick="(function(){var el=document.getElementById(\'rr-nores-dbg\');var txt=el.innerText||el.textContent;if(navigator.clipboard){navigator.clipboard.writeText(txt).then(function(){var b=el.parentNode.querySelector(\'button\');var old=b.textContent;b.textContent=\'\u2713 Kopiert!\';setTimeout(function(){b.textContent=old;},2000);});}else{var r=document.createRange();r.selectNode(el);window.getSelection().removeAllRanges();window.getSelection().addRange(r);}})();" style="position:absolute;top:6px;right:6px;font-size:11px;padding:3px 8px;border-radius:5px;border:1px solid var(--border);background:var(--surface);color:var(--text2);cursor:pointer">&#x1F4CB; Kopieren</button>' +
            '<pre id="rr-nores-dbg" style="font-size:11px;overflow-x:auto;background:var(--surface);padding:10px;padding-right:80px;border-radius:6px;white-space:pre-wrap;color:var(--text2);margin:0">' + _noResText.replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</pre>' +
          '</div>' +
        '</div>';
      return;
    }
    _rrDebug.resolvedDate = eventDate;
    // Bestehende Ergebnisse für gematchte Athleten laden (Duplikat-Check)
    var _matchedIds = {};
    allResults.forEach(function(r){ if(r.athletId) _matchedIds[r.athletId]=1; });
    var _existingMap = {}; // athletId → [{disziplin, resultat}]
    var _aidList = Object.keys(_matchedIds);
    if (_aidList.length) {
      try {
        var _er = await apiGet('ergebnisse?limit=9999&offset=0&athlet_id=' + _aidList[0] + '&sort=datum&dir=DESC');
        // Für alle Athleten auf einmal ist komplex — lade pro Athlet lazy in rrRenderPreview
      } catch(e) {}
    }
    rrRenderPreview(allResults, eventId, eventName, eventDate, contestObj, eventOrt, allRowsForAK);
    // Duplikat-Check: vorhandene Ergebnisse pro Athlet laden und Zeilen markieren
    rrCheckDuplicates(allResults);

  } catch(e) {
    preview.innerHTML =
      '<div style="background:#fff0ee;border-radius:10px;padding:16px;color:#b03020">&#x274C; Fehler: ' + e.message + '</div>';
  }
}

// Mehrsprachiges RaceResult-Format auflösen: "{DE:Köln Marathon|EN:Cologne Marathon}" → "Köln Marathon"
// (bevorzugt Deutsch, sonst erste vorhandene Sprache). Betrifft Contest-/Event-Namen gleichermaßen.
function _rrResolveMultilang(name) {
  var _ml = (name||'').match(/\{DE:([^|}]+)/i);
  if (_ml) return _ml[1].trim();
  var _mlen = (name||'').match(/\{[A-Z]{2}:([^|}]+)/i);
  if (_mlen) return _mlen[1].trim();
  return name;
}

function rrBestDisz(rrName, diszList) {
  rrName = _rrResolveMultilang(rrName);
  // Extrahiert Schlüsselbegriffe aus dem RR-Namen und sucht besten Treffer in System-Disziplinen
  var q = rrName.toLowerCase()
    .replace(/^#\d+_/, '')  // "#1_STADTWERKE Halbmarathon" → "stadtwerke halbmarathon"
    .replace(/lauf|rennen|wettbewerb|gesamt|einzel|lauf-/gi, '')
    .replace(/-/g, ' ')     // "5-km-Lauf" → "5 km " (Bindestriche normalisieren)
    .replace(/\s+/g, ' ').trim();

  // Zahl + Einheit extrahieren und in Meter normalisieren
  var qNorm = q.replace(/(\d)\.(\d{3})(?!\d)/g, '$1$2') // 5.000 → 5000
               .replace(/\b(\d+)er\b/g, '$1 km'); // "5er" → "5 km", "10er" → "10 km"
  var numMatch = qNorm.match(/(\d+[,.]?\d*)\s*(km|m\b)/);
  var numKey = ''; var numMeters = null;
  if (numMatch) {
    var numVal = parseFloat(numMatch[1].replace(',','.'));
    var numUnit = numMatch[2];
    numMeters = numUnit === 'km' ? numVal * 1000 : numVal;
    // Kanonische Darstellung: >= 1000m als km
    if (numMeters >= 1000) { numKey = (numMeters / 1000) + 'km'; }
    else { numKey = numMeters + 'm'; }
  }

  // Hilfsfunktion: Meterzahl aus Disziplin-String extrahieren
  function diszToMeters(s) {
    var m = s.replace(/(\d)\.(\d{3})(?!\d)/g, '$1$2').match(/(\d+[,.]?\d*)\s*(km|m\b)/);
    if (!m) return null;
    var v = parseFloat(m[1].replace(',','.'));
    return m[2] === 'km' ? v * 1000 : v;
  }

  // Benannte Standarddistanzen: "Halbmarathon" (~21,1 km) / "Marathon" (~42,2 km)
  // haben in den System-Disziplinen keine Ziffern → per Distanz auf den Namen mappen
  // (z.B. Contest "21,1 Km Rheinuferlauf" → Halbmarathon)
  var _named = '';
  if (numMeters !== null) {
    if (numMeters >= 20900 && numMeters <= 21300) _named = 'halb';
    else if (numMeters >= 41900 && numMeters <= 42500) _named = 'full';
  }

  var best = ''; var bestScore = -1;
  for (var i = 0; i < diszList.length; i++) {
    var d = diszList[i]; var dl = d.toLowerCase(); var score = 0;
    // Exakter Treffer
    if (dl === q) return d;
    // Meter-Vergleich: 300m == 0,3km
    if (numMeters !== null) {
      var dMeters = diszToMeters(dl);
      if (dMeters !== null && Math.abs(dMeters - numMeters) < 0.01) {
        score += (dl === numKey) ? 20 : 15;
      }
    }
    // Distanz → benannte Disziplin (Halbmarathon/Marathon ohne Ziffern)
    if (_named === 'halb' && dl.indexOf('halbmara') >= 0) score += 20;
    else if (_named === 'full' && dl.indexOf('marathon') >= 0 && dl.indexOf('halb') < 0 && dl.indexOf('drittel') < 0) score += 20;
    // Einzelne Wörter matchen
    var words = q.split(/\s+/);
    for (var w = 0; w < words.length; w++) {
      if (words[w].length > 2 && dl.indexOf(words[w]) >= 0) score += 2;
    }
    // Keyword-Bonus — Marathon vs Halb-/Drittelmarathon präzise unterscheiden.
    // "Drittelmarathon" enthält "marathon" als Substring → ohne diesen Check gleiche
    // Punktzahl wie "Marathon" selbst, Gewinner dann zufällig per Listenreihenfolge
    // (z.B. "Generali Köln Marathon" → fälschlich "Drittelmarathon" statt "Marathon").
    var _qHalb = q.indexOf('halb') >= 0 || q.indexOf('half') >= 0;
    var _dHalb = dl.indexOf('halb') >= 0;
    var _qDrittel = q.indexOf('drittel') >= 0 || q.indexOf('third') >= 0;
    var _dDrittel = dl.indexOf('drittel') >= 0;
    if (q.indexOf('marathon') >= 0 && dl.indexOf('marathon') >= 0) {
      var _qualMatch = (_qHalb === _dHalb) && (_qDrittel === _dDrittel);
      score += _qualMatch ? 10 : -5; // Match: +10, Mismatch: -5
    }
    if (_qHalb && _dHalb) score += 5;
    if (_qDrittel && _dDrittel) score += 5;
    if (q.indexOf('walking') >= 0 && dl.indexOf('walk') >= 0) score += 5;
    if (score > bestScore) { bestScore = score; best = d; }
  }
  return bestScore > 0 ? best : '';
}

function normalizeAK(raw) {
  if (!raw) return '';
  var s = raw.trim();
  // Bereits DLV-Format: MHK, WHK, M40, W65, MU16
  if (/^[MW]HK$/.test(s)) return s;
  if (/^[MW]U?\d{0,2}$/.test(s)) return /^[MW]$/.test(s) ? s + 'HK' : s;
  // "W 40" / "M 50" → "W40" / "M50"
  var sm = s.match(/^([MW])\s+(\d{2})$/i);
  if (sm) return sm[1].toUpperCase() + sm[2];
  // Kern-Match: [MW] gefolgt von optionalem U und 2 Ziffern irgendwo im String
  // z.B. "Seniorinnen W40" → "W40", "AK M35" → "M35", "Senior W65" → "W65"
  var dm = s.match(/(?:^|\s)([MW]U?\d{2})(?:\s|$)/i);
  if (dm) return dm[1].toUpperCase();
  // Jugend mit Geschlecht im Text: "Männliche Jugend U16" → "MU16"
  if (/m.nnl|male|herren|m.nner/i.test(s)) {
    var ju = s.match(/U\s*(\d{1,2})/i);
    if (ju) return 'MU' + ju[1];
    return 'MHK'; // kein Jugend-Match → Hauptklasse Männer
  }
  if (/weibl|female|frauen|damen/i.test(s)) {
    var jw = s.match(/U\s*(\d{1,2})/i);
    if (jw) return 'WU' + jw[1];
    return 'WHK'; // kein Jugend-Match → Hauptklasse Frauen
  }
  // Nur Geschlecht
  if (/^(m.nner|herren|male|men)$/i.test(s))    return 'MHK';
  if (/^(frauen|damen|female|women)$/i.test(s))  return 'WHK';
  return s;
}

function calcDlvAK(jahrgang, geschlecht, eventJahr) {
  var alter = eventJahr - parseInt(jahrgang);
  if (isNaN(alter) || alter < 5) return '';
  var g = /^[WwFf]/.test(geschlecht || '') ? 'W' : 'M';
  if (alter < 13) return g + 'U12';
  if (alter < 15) return g + 'U14';
  if (alter < 17) return g + 'U16';
  if (alter < 19) return g + 'U18';
  if (alter < 21) return g + 'U20';
  if (alter < 23) return g + 'U23';
  if (alter < 30) return g + 'HK';  // Hauptklasse: MHK / WHK
  var stufe = Math.floor(alter / 5) * 5;
  if (stufe > 75) stufe = 75;
  return g + stufe;
}

// Prüft ob ein AK-Wert dem DLV-Standard entspricht
function isValidDlvAK(ak) {
  if (!ak || ak === '') return true; // leer ist ok
  return /^[MW](HK|U(12|14|16|18|20|23)|(30|35|40|45|50|55|60|65|70|75|80|85))$/.test(ak);
}

function _rrRefreshAKPlatz() {
  // Nur AK-Platz-Spalten neu berechnen ohne das Datum-Feld zu überschreiben
  var s = window._rrState;
  if (!s || !s.results) return;
  var _datumFeld = ((document.getElementById('rr-datum') || {}).value || '').trim();
  var _dpf = _datumFeld.match(/(\d{4})/);
  var _jahr = _dpf ? parseInt(_dpf[1]) : new Date().getFullYear();
  // Warnhinweis ausblenden wenn Datum gesetzt
  var warnEl = document.getElementById('rr-datum-warn');
  if (warnEl) warnEl.style.display = _datumFeld ? 'none' : '';
  // AK-Platz-Zellen (7. td, Index 6) in jeder Tabellenzeile aktualisieren
  var trs = document.querySelectorAll('#rr-tabelle tbody tr');
  for (var i = 0; i < trs.length; i++) {
    var r = s.results[i];
    if (!r) continue;
    var raw = r.raw;
    var netto = String(raw[r.iNetto] || raw[r.iZeit] || '').trim();
    var _jahrgang = r.iYear >= 0 ? String(raw[r.iYear] || '').trim() : '';
    var _geschlecht = '';
    var selEl = trs[i].querySelector('.rr-athlet');
    var _athId = selEl ? parseInt(selEl.value) || 0 : 0;
    if (_athId) {
      var _ath = state._athletenMap && state._athletenMap[_athId];
      if (_ath) _geschlecht = _ath.geschlecht || '';
    }
    if (!_geschlecht) _geschlecht = r.akFromGroup === 'W' ? 'W' : r.akFromGroup === 'M' ? 'M' : '';
    var ak = '';
    if (r.iAK >= 0) {
      ak = String(raw[r.iAK] || '').trim();
    } else if (_jahrgang && _geschlecht) {
      ak = calcDlvAK(_jahrgang, _geschlecht, _jahr);
    } else {
      ak = r.akFromGroup || '';
    }
    var platz = calcAKPlatz(ak, netto, _jahr) || '–';
    // AK = 6. td (Index 5), Platz = 7. td (Index 6)
    var tds = trs[i].querySelectorAll('td');
    if (tds[5]) tds[5].textContent = ak;
    if (tds[6]) tds[6].textContent = platz;
  }
}

function calcAKPlatz(ak, zeitStr, eventJahr) {
  var allRowsForAK = window._rrAllRowsForAK || [];
  if (!ak || !zeitStr || !allRowsForAK.length) return null;
  function toSec(s) {
    var p = s.replace(/[^0-9:]/g, '').split(':').map(Number);
    if (p.length === 3) return p[0]*3600 + p[1]*60 + p[2];
    if (p.length === 2) return p[0]*60 + p[1];
    return p[0] || 0;
  }
  var eigeneZeit = toSec(zeitStr);
  if (!eigeneZeit) return null;
  var besser = 0;
  for (var _i = 0; _i < allRowsForAK.length; _i++) {
    var r = allRowsForAK[_i];
    // AK aus Feld oder aus Jahr+Geschlecht berechnen
    var rAk = r.ak;
    if (!rAk && r.year && r.geschlecht && eventJahr) {
      rAk = calcDlvAK(r.year, r.geschlecht, eventJahr);
    }
    if (rAk !== ak) continue;
    var rZeit = toSec(r.zeit);
    if (rZeit > 0 && rZeit < eigeneZeit) besser++;
  }
  return besser + 1;
}

function rrRenderPreview(results, eventId, eventName, eventDate, contestObj, eventOrt, allRowsForAK) {
  // allRowsForAK auch auf window setzen damit calcAKPlatz es findet
  if (allRowsForAK) window._rrAllRowsForAK = allRowsForAK;
  var preview = document.getElementById('rr-preview');
  var today = new Date().toISOString().slice(0,10);
  var guessDate = eventDate ? eventDate.slice(0,10) : '';
  // rr-datum-Feld auslesen falls bereits manuell befüllt (Format TT.MM.JJJJ oder YYYY-MM-DD)
  var _datumFeld = ((document.getElementById('rr-datum') || {}).value || '').trim();
  if (_datumFeld && !guessDate) {
    var _dpf = _datumFeld.match(/(\d{4})/);
    if (_dpf) guessDate = _dpf[1] + '-01-01';
  }
  var _rrEventJahr = parseInt((guessDate || '').slice(0,4)) || new Date().getFullYear();
  window._rrState = { results: results, eventId: eventId, eventName: eventName, contestObj: contestObj, eventOrt: eventOrt };

  // System-Disziplinen aus datalist lesen
  // Disziplinen aus state (von API)
  var _kat = window._rrKat || '';
  var diszList = (state.disziplinen || [])
    .filter(function(d) { return !_kat || d.tbl_key === _kat; })
    .map(function(d) { return typeof d === 'object' ? d.disziplin : d; })
    .filter(Boolean);
  if (!diszList.length) {
    var dlOpts = document.querySelectorAll("#disz-list option");
    for (var di = 0; di < dlOpts.length; di++) diszList.push(dlOpts[di].value);
  }

  // Debug
  var _dbgFirst = results.length ? results[0] : null;
  var _dbgRaw = _dbgFirst ? JSON.stringify(_dbgFirst.raw) : '(leer)';
  var _dbg = window._rrDebug || {};
  var _dbgLines = [];
  var _appVer = (document.getElementById('header-version') || {}).textContent || '';
  _dbgLines.push('App: ' + _appVer + ' | ' + new Date().toLocaleString('de-DE'));
  // Spaltenindizes
  if (_dbgFirst) {
    _dbgLines.push('Spalten: iName='+_dbgFirst.iName+' iClub='+_dbgFirst.iClub+' iAK='+_dbgFirst.iAK+' iNetto='+_dbgFirst.iNetto+' iPlatz='+_dbgFirst.iPlatz+' iYear='+_dbgFirst.iYear+' iGeschlecht='+_dbgFirst.iGeschlecht);
    _dbgLines.push('DataFields: ' + (_dbg.dfLog || '–'));
  }
  // Event-Metadaten
  _dbgLines.push('eventName: ' + (eventName||'–') + ' | eventDate: ' + (eventDate||'leer') + ' | eventOrt: ' + (eventOrt||'leer'));
  _dbgLines.push('cfgDateRaw: ' + JSON.stringify(_dbg.cfgDateRaw||'') + ' | cfg.eventname: ' + (_dbg.cfgEventName||'–'));

  _dbgLines.push('cfg-Keys: ' + (_dbg.cfgAllKeys||'–'));
  _dbgLines.push('cfg (roh): ' + (_dbg.cfgRaw||'–'));
  // Contest-Infos
  _dbgLines.push('contests: ' + JSON.stringify(contestObj).slice(0,200));
  _dbgLines.push('listName: ' + (_dbg.listName||'–') + ' | listContest: ' + (_dbg.listContest||'–'));
  // Disziplin-Mapping
  _dbgLines.push('diszList ('+diszList.length+'): ' + diszList.slice(0,20).join(', ') + (diszList.length>20?' …':''));
  if (_dbgFirst) {
    var _cname = _dbgFirst.contestName || '';
    var _cnResolved = _cname;
    if (!_cnResolved || _cnResolved.match(/^Contest \d+$/i)) {
      // Gleiche Logik wie Render-Loop: groupKey splitten
      var _gkP = (_dbgFirst.groupKey || '').split('/');
      var _gkN = (_gkP[0] || '').replace(/^#\d+_/, '');
      if (_gkN && !_gkN.match(/^(M[aä]nner|Frauen|Weiblich|M[aä]nnlich|Male|Female|mixed)$/i))
        _cnResolved = _gkN;
      else if (_gkP.length > 1) _cnResolved = _gkP[1].replace(/^#\d+_/, '');
    }
    _dbgLines.push('contestName[0]: "' + _cname + '" groupKey: "' + (_dbgFirst.groupKey||'') + '" → rrBestDisz: "' + rrBestDisz(_cnResolved, diszList) + '"');
    // Alle einzigartigen contestNames
    var _cnames = {}; results.forEach(function(r){ if(r.contestName) _cnames[r.contestName]=1; });
    _dbgLines.push('alle contestNames: ' + Object.keys(_cnames).join(', '));
  }
  // Club-Samples
  _dbgLines.push('clubSamples (' + (_dbg.clubSamples||[]).length + '): ' + (_dbg.clubSamples||[]).slice(0,10).join(', '));
  _dbgLines.push('totalRows: ' + (_dbg.totalRows||0) + ' | Treffer: ' + results.length);
  var _ak4debug = window._rrAllRowsForAK || [];
  var _ak4sample = _ak4debug.length ? JSON.stringify(_ak4debug[0]) + ' … (' + _ak4debug.length + ' rows)' : '(leer!)';
  var _akPlatzTest = '';
  if (results.length) {
    var _r0 = results[0]; var _raw0 = _r0.raw;
    var _netto0 = String(_raw0[_r0.iNetto]||'').trim();
    var _yr0 = _r0.iYear >= 0 ? String(_raw0[_r0.iYear]||'').trim() : '';
    var _g0 = '';
    // Geschlecht aus Athletenprofil des gematchten Athleten
    var _chk0 = document.querySelector('.rr-chk[data-idx="0"]');
    var _ath0 = _chk0 ? _chk0.closest('tr').querySelector('.rr-athlet') : null;
    var _athId0 = _ath0 ? parseInt(_ath0.value)||0 : 0;
    if (_athId0) { var _dbgA0 = state._athletenMap && state._athletenMap[_athId0]; if (_dbgA0) _g0 = _dbgA0.geschlecht||''; }
    var _ak0 = (_yr0 && _g0) ? calcDlvAK(_yr0, _g0, _rrEventJahr) : '(kein Jahr/Geschlecht: yr='+_yr0+' g='+_g0+')';
    var _platz0 = calcAKPlatz(_ak0, _netto0, _rrEventJahr);
    var _gs0sample = _ak4debug.length ? _ak4debug.filter(function(x){return !!x.geschlecht;}).length : 0;
    _akPlatzTest = 'AK-Test[0]: year=' + _yr0 + ' g=' + _g0 + ' → ak=' + _ak0 + ' netto=' + _netto0 + ' → Platz ' + _platz0 + ' | rows mit g: ' + _gs0sample;
    // Test für zweiten Treffer (Tanja)
    if (results.length > 1) {
      var _r1 = results[1]; var _raw1 = _r1.raw;
      var _netto1 = String(_raw1[_r1.iNetto]||'').trim();
      var _yr1 = _r1.iYear >= 0 ? String(_raw1[_r1.iYear]||'').trim() : '';
      var _g1 = '';
      var _chk1 = document.querySelector('.rr-chk[data-idx="1"]');
      var _ath1 = _chk1 ? _chk1.closest('tr').querySelector('.rr-athlet') : null;
      var _athId1 = _ath1 ? parseInt(_ath1.value)||0 : 0;
      if (_athId1) { var _dbgA1 = state._athletenMap && state._athletenMap[_athId1]; if (_dbgA1) _g1 = _dbgA1.geschlecht||''; }
      var _ak1 = (_yr1 && _g1) ? calcDlvAK(_yr1, _g1, _rrEventJahr) : '(fehlt: yr='+_yr1+' g='+_g1+')';
      var _platz1 = calcAKPlatz(_ak1, _netto1, _rrEventJahr);
      // Wie viele W45-Rows gibt es?
      var _w45count = _ak4debug.filter(function(x){ return x.geschlecht==='W' && x.year && (_rrEventJahr-parseInt(x.year))>=45 && (_rrEventJahr-parseInt(x.year))<50; }).length;
      _akPlatzTest += '\nAK-Test[1]: year=' + _yr1 + ' g=' + _g1 + ' → ak=' + _ak1 + ' netto=' + _netto1 + ' → Platz ' + _platz1 + ' | W45-Rows(2026): ' + _w45count;
    }
  }
  // Erste 5 eindeutige Gruppen-Keys aus den rohen Daten
  var _gkSample = Object.keys((window._rrDebug||{}).groupKeysSample||{}).slice(0,8).join(' | ');
  _dbgLines.push('allRowsForAK[0]: ' + _ak4sample + ' | Gruppen-Keys: ' + (_gkSample||'–'));
  _dbgLines.push(_akPlatzTest);
  // Rohdaten erster Treffer
  if (_dbgFirst) _dbgLines.push('raw[0]: ' + _dbgRaw);
  var _dbgIdx = _dbgLines.join('\n');

  var rows = '';
  for (var i = 0; i < results.length; i++) {
    var r = results[i];
    var raw = r.raw;
    var name  = String(raw[r.iName]  || '').trim().replace(/\s*\(\d{4}\)\s*$/, '');
    // Separates Vorname-Feld kombinieren (LASTNAME + FIRSTNAME → "Nachname, Vorname")
    if ((r.iFirstname || -1) >= 0) { var _fn2 = String(raw[r.iFirstname]||'').trim(); if (_fn2 && name) name = name + ', ' + _fn2; }
    // "Nachname, Vorname" (LFNAME-Format) → "Vorname Nachname"
    if (name.indexOf(',') > 0) { var _np = name.split(','); name = (_np[1]||'').trim() + ' ' + (_np[0]||'').trim(); name = name.trim(); }
    var club  = String(raw[r.iClub]  || '').trim();
    var ak = '';
    if (r.iAK >= 0 && String(raw[r.iAK] || '').trim()) {
      ak = normalizeAK(String(raw[r.iAK] || '').trim()); // AK normalisieren: "Seniorinnen W40" → "W40"
      if (/^\d+\.?\s*[A-Z]/.test(ak)) { var _aksp3 = ak.match(/^(\d+)\.?\s*(.+)$/); if (_aksp3) ak = normalizeAK(_aksp3[2].trim()); }
    } else {
      var _jahrgang = r.iYear >= 0 ? String(raw[r.iYear] || '').trim() : '';
      var _geschlecht = '';
      if (athletId) {
        // _athletenMap bevorzugen (aktueller als state.athleten-Cache)
        var _ath = (state._athletenMap && state._athletenMap[athletId]);
        if (_ath) {
          _geschlecht = _ath.geschlecht || '';
        } else {
          for (var _si=0; _si<state.athleten.length; _si++) {
            if (state.athleten[_si].id == athletId) { _geschlecht = state.athleten[_si].geschlecht || ''; break; }
          }
        }
      }
      if (!_geschlecht && r.iGeschlecht >= 0) {
        var _gv = String(raw[r.iGeschlecht] || '').toUpperCase();
        _geschlecht = (_gv === 'W' || _gv === 'F' || _gv === 'FEMALE') ? 'W' : (_gv === 'M' || _gv === 'MALE') ? 'M' : '';
      }
      if (!_geschlecht) _geschlecht = r.akFromGroup === 'W' ? 'W' : r.akFromGroup === 'M' ? 'M' : '';
      if (_jahrgang && _geschlecht) {
        ak = calcDlvAK(_jahrgang, _geschlecht, _rrEventJahr);
      } else {
        ak = r.akFromGroup || '';
      }
    }
    var zeit  = String(raw[r.iZeit]  || '').trim();
    var netto = String(raw[r.iNetto] || '').trim();
    // iPlatz zeigt auf AUTORANKP (Gesamtplatz) — AK-Platz selbst berechnen
    var platzAKnum = r.akPlatzFromRow || calcAKPlatz(ak, netto || zeit, _rrEventJahr) || '';
    var _cn = r.contestName || '';
    // Contest 0 / "Contest N" → Disziplin aus groupKey oder cfg.contests
    if (!_cn || _cn.match(/^Contest \d+$/i)) {
      // groupKey z.B. "#2_Westenergie Marathon/#4_Weiblich" → ersten Teil nutzen
      var _gkParts = (r.groupKey || '').split('/');
      var _gkFirst = _gkParts[0] || '';
      var _gkName = _gkFirst.replace(/^#\d+_/, '');
      if (_gkName && !_gkName.match(/^(M[aä]nner|Frauen|Weiblich|M[aä]nnlich|Male|Female|mixed)$/i))
        _cn = _gkName;
      else if (_gkParts.length > 1)
        _cn = _gkParts[1].replace(/^#\d+_/, '');
    }
    var disz  = rrBestDisz(_cn, diszList);

    // Athlet-Matching: Name normalisieren (SS↔ß, Umlaute, Komma, Groß/Klein)
    var athletId = '';
    var nNorm = _normN(name);
    var parts = nNorm.split(' ').filter(function(p) { return p.length >= 3; });
    // Exakter Treffer (nach Normalisierung)
    for (var ai = 0; ai < state.athleten.length && !athletId; ai++) {
      var a = state.athleten[ai];
      if (!a.name_nv) continue;
      if (_normN(a.name_nv) === nNorm) { athletId = a.id; }
    }
    // Fallback: alle Namensteile vorhanden (Wortgrenze)
    if (!athletId) {
      for (var ai = 0; ai < state.athleten.length && !athletId; ai++) {
        var a = state.athleten[ai];
        if (!a.name_nv) continue;
        var aNorm = _normN(a.name_nv);
        var allMatch = parts.length > 0 && parts.every(function(p) {
          return aNorm.indexOf(p) >= 0;
        });
        if (allMatch) { athletId = a.id; }
      }
    }

    var athOptHtml = '<option value="">&#x2013; manuell &#x2013;</option>';
    for (var ai = 0; ai < state.athleten.length; ai++) {
      var a = state.athleten[ai];
      athOptHtml += '<option value="' + a.id + '"' + (a.id == athletId ? ' selected' : '') + '>' + a.name_nv + '</option>';
    }

    rows +=
      '<tr class="rr-preview-row" data-athlet="' + (athletId||'') + '" data-disz="' + disz + '" data-zeit="' + (netto||zeit) + '" data-datum="' + (window._rrState&&window._rrState.eventDatum||'') + '" style="border-bottom:1px solid var(--border)">' +
        '<td style="padding:6px"><input type="checkbox" class="rr-chk" data-idx="' + i + '" checked style="width:14px;height:14px;cursor:pointer"/></td>' +
        '<td style="padding:4px 6px"><select class="rr-athlet" class="bk-input-sel">' + athOptHtml + '</select></td>' +
        '<td style="padding:4px 6px;font-size:12px;color:var(--text2)">' + name + '</td>' +
        '<td style="padding:4px 6px">' + (function(sel){ var s = '<select class="rr-disz" class="bk-input-sel">';s += '<option value="">' + (sel ? '' : '\u2013 bitte w\u00e4hlen \u2013') + '</option>';for(var oi=0;oi<diszList.length;oi++){s += '<option value="'+diszList[oi]+'"'+(diszList[oi]===sel?' selected':'')+'>'+diszList[oi]+'</option>';}s += '</select>'; return s; })(disz) + '</td>' +
        '<td style="padding:4px 6px;font-family:\'Barlow Condensed\',sans-serif;font-weight:700;font-size:14px;color:var(--result-color)">' + (netto || zeit) + '</td>' +
        (function() {
          var _akOk = isValidDlvAK(ak);
          var _akStyle = _akOk ? 'padding:4px 6px;font-size:12px;color:var(--text2)' : 'padding:4px 6px;font-size:12px;font-weight:600;color:var(--accent);cursor:pointer;title="Unbekannte AK – klicken zum Bearbeiten"';
          return '<td style="' + _akStyle + '" class="rr-ak-cell' + (_akOk ? '' : ' rr-ak-unknown') + '" data-ak="' + ak.replace(/"/g,'&quot;') + '" title="' + (_akOk ? 'Altersklasse' : '⚠ Unbekannte AK – wird nicht blind übernommen') + '">' + (ak || '–') + (_akOk ? '' : ' ⚠') + '</td>';
        })() +
        '<td style="padding:4px 6px;font-size:12px;color:var(--text2)">' + (platzAKnum || '–') + '</td>' +
        '<td class="rr-mstr" style="padding:4px 6px;display:none">' +
          '<select class="rr-mstr-sel" onchange="rrMstrChanged(this)" style="padding:5px 7px;border:1px solid var(--border);border-radius:6px;font-size:12px;background:var(--surface);color:var(--text);min-width:90px">' +
            mstrOptions(0) +
          '</select>' +
        '</td>' +
        '<td class="rr-mstr rr-mstr-platz-td" style="padding:4px 6px;display:none">' +
          '<input type="number" class="rr-mstr-platz" min="1" placeholder="Platz" value="' + (platzAKnum||'') + '" style="width:60px;padding:5px 7px;border:1px solid var(--border);border-radius:6px;font-size:12px;background:var(--surface);color:var(--text)">' +
        '</td>' +
        '<td style="padding:4px 6px;font-size:11px;color:var(--text2)">' + club + '</td>' +
      '</tr>';
  }

  preview.innerHTML =
    '<details style="margin-bottom:12px"><summary style="cursor:pointer;font-size:12px;color:var(--text2);padding:4px 0">&#x1F50D; Spalten-Debug</summary>' +
      '<div style="position:relative">' +
        '<button onclick="(function(){var el=document.getElementById(\'rr-dbg-pre\');var txt=el.innerText||el.textContent;if(navigator.clipboard){navigator.clipboard.writeText(txt).then(function(){var b=el.parentNode.querySelector(\'button\');var old=b.textContent;b.textContent=\'&#x2713; Kopiert!\';setTimeout(function(){b.textContent=old;},2000);});}else{var r=document.createRange();r.selectNode(el);window.getSelection().removeAllRanges();window.getSelection().addRange(r);}})()" style="position:absolute;top:6px;right:6px;font-size:11px;padding:3px 8px;border-radius:5px;border:1px solid var(--border);background:var(--surface);color:var(--text2);cursor:pointer">&#x1F4CB; Kopieren</button>' +
        '<pre id="rr-dbg-pre" style="font-size:10px;overflow-x:auto;background:var(--surf2);padding:8px 8px 8px 8px;padding-right:80px;border-radius:6px;white-space:pre-wrap;color:var(--text2)">' + _dbgIdx + '\n' + _dbgRaw + '</pre>' +
      '</div></details>' +
    '<div style="background:var(--surf2);border-radius:10px;padding:14px 18px;margin-bottom:14px;display:flex;flex-wrap:wrap;gap:14px;align-items:flex-end">' +
      '<div style="flex:1;min-width:200px"><div style="font-size:11px;font-weight:600;color:var(--text2);margin-bottom:4px">Veranstaltungsname</div>' +
        '<input id="rr-evname" type="text" value="' + _cleanEventName(eventName) + '" style="padding:7px 10px;border:1px solid var(--border);border-radius:7px;font-size:16px;background:var(--surface);color:var(--text);width:100%"/></div>' +
      '<div><div style="font-size:11px;font-weight:600;color:var(--text2);margin-bottom:4px">Datum</div>' +
        '<input id="rr-datum" type="text" value="' + (guessDate ? guessDate.split('-').reverse().join('.') : '') + '" placeholder="TT.MM.JJJJ" onchange="_rrRefreshAKPlatz()" style="padding:7px 10px;border:1px solid var(--border);border-radius:7px;font-size:13px;background:var(--surface);color:var(--text);width:120px"/></div>' +
      '<div><div style="font-size:11px;font-weight:600;color:var(--text2);margin-bottom:4px">Ort</div>' +
        '<input id="rr-ort" type="text" value="' + (eventOrt||'') + '" placeholder="z.B. D\u00fcsseldorf" style="padding:7px 10px;border:1px solid var(--border);border-radius:7px;font-size:16px;background:var(--surface);color:var(--text);width:min(150px,100%)"/></div>' +
      '<span style="font-size:12px;color:var(--text2);align-self:center">&#x2705; ' + results.length + ' Vereins-Ergebnis(se) &bull; Event ' + eventId + '</span>' +
      '<label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;white-space:nowrap;align-self:center">' +
        '<input type="checkbox" id="rr-mstr-toggle" onchange="importToggleMstr(\'rr\',this.checked,document.getElementById(\'rr-mstr-global\').value)" style="width:15px;height:15px;accent-color:var(--btn-bg)">' +
        'Meisterschaft' +
      '</label>' +
      '<select id="rr-mstr-global" onchange="if(document.getElementById(\'rr-mstr-toggle\').checked)importToggleMstr(\'rr\',true,this.value)" style="padding:5px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px;background:var(--surface);color:var(--text)">' +
        mstrOptions(0) +
      '</select>' +
    '</div>' +
    (!guessDate ? '<div id="rr-datum-warn" style="margin-bottom:10px;padding:8px 12px;background:#7c3a00;color:#ffb347;border-radius:7px;font-size:13px;font-weight:600">&#x26A0;&#xFE0E; Bitte Datum eintragen — es beeinflusst die AK-Platzierung!</div>' : '<div id="rr-datum-warn" style="display:none"></div>') +
    '<div id="rr-tabelle" style="overflow-x:auto;margin-bottom:12px">' +
      '<table style="width:100%;border-collapse:collapse;font-size:13px">' +
        '<thead><tr style="color:var(--text2);border-bottom:2px solid var(--border)">' +
          '<th style="padding:6px;width:30px"><input type="checkbox" checked onclick="rrToggleAll(this.checked)" style="cursor:pointer"/></th>' +
          '<th style="padding:6px;text-align:left">Athlet (System)</th>' +
          '<th style="padding:6px;text-align:left">Name (RR)</th>' +
          '<th style="padding:6px;text-align:left">Disziplin</th>' +
          '<th style="padding:6px;text-align:left">Netto-Zeit</th>' +
          '<th style="padding:6px;text-align:left">AK</th>' +
          '<th style="padding:6px;text-align:left">Platz AK</th>' +
          '<th class="rr-mstr-th" style="padding:6px;text-align:left;display:none">Meisterschaft</th>' +
          '<th class="rr-mstr-th" style="padding:6px;text-align:left;display:none">Platz MS</th>' +
          '<th style="padding:6px;text-align:left">Verein</th>' +
        '</tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table>' +
    '</div>' +
    '<div style="display:flex;gap:10px;align-items:center">' +
      '<button class="btn btn-primary" onclick="rrImport()">&#x1F4BE; Ausgew\u00e4hlte importieren</button>' +
      '<span id="rr-status" style="font-size:13px;color:var(--text2)"></span>' +
    '</div>';
}

function rrToggleAll(val) {
  var chks = document.querySelectorAll('.rr-chk');
  for (var i = 0; i < chks.length; i++) chks[i].checked = val;
}

async function rrCheckDuplicates(results) {
  // Sammle alle gematchten Athlet-IDs
  var athIds = {};
  results.forEach(function(r){ if(r.athletId) athIds[r.athletId] = 1; });
  if (!Object.keys(athIds).length) return;

  // Lade Ergebnisse für diese Athleten (alle auf einmal per bulk-Query nicht möglich → einzeln)
  var existMap = {}; // "athletId|disziplin|resultat" → true
  for (var _aid in athIds) {
    try {
      var _r = await apiGet('ergebnisse?limit=2000&offset=0&athlet_id=' + _aid);
      if (_r && _r.ok) {
        (_r.data.rows || []).forEach(function(e) {
          existMap[_aid + '|' + e.disziplin + '|' + e.resultat] = true;
        });
      }
    } catch(e) {}
  }

  // Preview-Zeilen markieren
  var rows = document.querySelectorAll('.rr-preview-row');
  var dupCount = 0;
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var aId  = row.dataset.athlet;
    var disz = row.dataset.disz;
    var zeit = row.dataset.zeit;
    if (!aId || !disz || !zeit) continue;
    var key  = aId + '|' + disz + '|' + zeit;
    if (existMap[key]) {
      dupCount++;
      row.style.opacity = '0.45';
      row.title = 'Duplikat – bereits im System vorhanden';
      // Checkbox deaktivieren
      var chk = row.querySelector('.rr-chk');
      if (chk) { chk.checked = false; chk.disabled = true; }
      // Badge
      var firstTd = row.querySelector('td:first-child');
      if (firstTd) firstTd.innerHTML += ' <span class="badge" style="background:var(--accent);color:#fff;font-size:10px">✕ Dup</span>';
    }
  }
  if (dupCount > 0) {
    var status = document.getElementById('rr-status');
    if (status) status.innerHTML = '<span style="color:var(--text2);font-size:12px">&#x26A0;︎ ' + dupCount + ' Duplikat(e) erkannt und abgewählt</span>';
  }
}

function rrMstrChanged(sel) {
  // kein extra Toggle nötig — beide Zellen immer sichtbar wenn Meisterschaft aktiv
}

async function rrImport() {
  var _datumRaw = ((document.getElementById('rr-datum') || {}).value || '').trim();
  // TT.MM.JJJJ → YYYY-MM-DD
  var datum = '';
  if (_datumRaw) {
    var _dp = _datumRaw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (_dp) datum = _dp[3] + '-' + _dp[2].padStart(2,'0') + '-' + _dp[1].padStart(2,'0');
    else datum = _datumRaw; // bereits YYYY-MM-DD oder ähnlich
  }
  var ort    = ((document.getElementById('rr-ort')    || {}).value || '').trim();
  var evname = ((document.getElementById('rr-evname') || {}).value || '').trim();
  if (!datum) { notify("Bitte Datum ausfüllen!", "err"); return; }
  if (!ort)   { notify("Bitte Ort ausfüllen!", "err"); return; }

  var rrState = window._rrState;
  var eventId = (rrState && rrState.eventId) || "";
  var rrKatKey = (window._rrState && window._rrState.rrKatKey) || '';
  var chks = document.querySelectorAll('.rr-chk');
  var aths = document.querySelectorAll('.rr-athlet');
  var diszInputs = document.querySelectorAll('.rr-disz');

  // Unzugeordnete Athleten sammeln (ausgewählt, aber kein Athlet gesetzt)
  var unmatched = [];
  for (var _ui = 0; _ui < chks.length; _ui++) {
    if (!chks[_ui].checked) continue;
    var _uidx = parseInt(chks[_ui].getAttribute('data-idx'), 10);
    var _ur = rrState.results[_uidx];
    var _uAthId = aths[_ui] ? parseInt(aths[_ui].value) || 0 : 0;
    if (!_uAthId) {
      unmatched.push({ rowIdx: _ui, dataIdx: _uidx, name: _ur ? (String(_ur.raw[_ur.iName]||'').trim()) : '', year: _ur && _ur.iYear>=0 ? String(_ur.raw[_ur.iYear]||'').trim() : '', geschlecht: _ur && _ur.iGeschlecht>=0 ? String(_ur.raw[_ur.iGeschlecht]||'').trim() : '', athSel: aths[_ui] });
    }
  }
  if (unmatched.length > 0) {
    var _resolved = await rrUnmatchedModal(unmatched);
    if (_resolved === null) return; // Abgebrochen
  }

  var items = [];
  var gjUpdates = []; // { athletId, name, jahrRR } — Geburtsjahr-Vorschläge

  for (var i = 0; i < chks.length; i++) {
    if (!chks[i].checked) continue;
    var idx = parseInt(chks[i].getAttribute('data-idx'), 10);
    var r   = rrState.results[idx];
    var raw = r.raw;
    var athletId = aths[i] ? parseInt(aths[i].value) || null : null;
    var disziplin = diszInputs[i] ? diszInputs[i].value.trim() : '';
    if (!athletId || !disziplin) continue;

    // Geburtsjahr aus RR-Daten — prüfen ob DB-Athlet noch keines hat
    var _rrYear = r.iYear >= 0 ? parseInt(String(raw[r.iYear] || '').trim()) : 0;
    if (_rrYear > 1900 && _rrYear < 2020) {
      var _dbAthlet = state._athletenMap && state._athletenMap[athletId];
      if (_dbAthlet && !_dbAthlet.geburtsjahr) {
        // Noch nicht in gjUpdates?
        var _alreadyQueued = gjUpdates.some(function(u) { return u.athletId === athletId; });
        if (!_alreadyQueued) {
          gjUpdates.push({ athletId: athletId, name: _dbAthlet.name_nv || '', jahrRR: _rrYear });
        }
      }
    }
    var zeit     = String(raw[r.iNetto] || raw[r.iZeit] || '').trim();
    var ak = '';
    if (r.iAK >= 0) {
      ak = String(raw[r.iAK] || '').trim();
      // Kombiniertes AK+Platz-Feld aufsplitten: "74. M35" → ak=M35
      if (/^\d+\.?\s*[A-Z]/.test(ak)) { var _aksp4 = ak.match(/^(\d+)\.?\s*(.+)$/); if (_aksp4) ak = _aksp4[2].trim(); }
      ak = normalizeAK(ak); // "Seniorinnen W40" → "W40" etc.
    } else {
      var _jahrgang2 = r.iYear >= 0 ? String(raw[r.iYear] || '').trim() : '';
      var _geschlecht2 = '';
      var _selAthlet = document.querySelectorAll('.rr-athlet')[i];
      var _athId2 = _selAthlet ? parseInt(_selAthlet.value) || 0 : 0;
      if (_athId2) {
        var _ath2 = (state._athletenMap && state._athletenMap[_athId2]);
        if (_ath2) {
          _geschlecht2 = _ath2.geschlecht || '';
        } else {
          for (var _si2=0; _si2<state.athleten.length; _si2++) {
            if (state.athleten[_si2].id == _athId2) { _geschlecht2 = state.athleten[_si2].geschlecht || ''; break; }
          }
        }
      }
      if (!_geschlecht2 && r.iGeschlecht >= 0) {
        var _gv2 = String(raw[r.iGeschlecht] || '').toUpperCase();
        _geschlecht2 = (_gv2 === 'W' || _gv2 === 'F') ? 'W' : (_gv2 === 'M') ? 'M' : '';
      }
      if (!_geschlecht2) _geschlecht2 = r.akFromGroup === 'W' ? 'W' : r.akFromGroup === 'M' ? 'M' : '';
      if (_jahrgang2 && _geschlecht2) {
        var _datum = ((document.getElementById('rr-datum') || {}).value || '').trim();
        var _dp2 = _datum.match(/(\d{4})/); // Jahr aus beliebigem Format
        var _eventJahr2 = _dp2 ? parseInt(_dp2[1]) : new Date().getFullYear();
        ak = calcDlvAK(_jahrgang2, _geschlecht2, _eventJahr2);
      } else {
        ak = r.akFromGroup || '';
      }
    }
    var platzAKv = r.akPlatzFromRow ? parseInt(r.akPlatzFromRow) : (calcAKPlatz(ak, String(raw[r.iNetto] || raw[r.iZeit] || '').trim(), _eventJahr2) || null);
    // Meisterschaft + Platz MS
    var _mstrSel = document.querySelectorAll('.rr-mstr-sel')[i];
    var _mstrVal = _mstrSel ? (parseInt(_mstrSel.value) || null) : null;
    var _mstrPlatzEl = document.querySelectorAll('.rr-mstr-platz')[i];
    var _mstrPlatz = (_mstrPlatzEl && _mstrPlatzEl.value) ? (parseInt(_mstrPlatzEl.value) || null) : null;
    // Startnummer (Feld 0 = BIB) + Gesamtplatzierung (iPlatz = AUTORANKP)
    var _bibRaw = String(raw[0] || '').trim();
    var _posGesRaw = (r.iPlatz >= 0) ? String(raw[r.iPlatz] || '').trim().replace(/\.$/, '') : '';
    items.push({
      datum: datum, ort: ort, veranstaltung_name: evname,
      athlet_id: athletId, disziplin: disziplin,
      resultat: zeit, altersklasse: ak,
      ak_platzierung: platzAKv,
      meisterschaft: _mstrVal,
      ak_platz_meisterschaft: _mstrPlatz,
      startnummer: /^\d{1,7}$/.test(_bibRaw) ? _bibRaw : null,
      pos_gesamt: /^\d{1,6}$/.test(_posGesRaw) ? parseInt(_posGesRaw, 10) : null,
      import_quelle: 'raceresult:' + eventId
    });
  }

  if (!items.length) { notify('Keine gültigen Einträge (Athlet + Disziplin benötigt).', 'err'); return; }

  // Unbekannte AK auflösen: alle eindeutigen unbekannten AK sammeln
  var _unknownAKs = {};
  items.forEach(function(it) { if (it.altersklasse && !isValidDlvAK(it.altersklasse)) _unknownAKs[it.altersklasse] = null; });
  if (Object.keys(_unknownAKs).length > 0) {
    var _akResolved = await rrUnknownAKModal(_unknownAKs);
    if (_akResolved === null) return; // Abgebrochen
    // Auflösung auf items anwenden
    items.forEach(function(it) {
      if (it.altersklasse && _akResolved.hasOwnProperty(it.altersklasse)) {
        it.altersklasse = _akResolved[it.altersklasse] || '';
      }
    });
  }

  document.getElementById('rr-status').innerHTML = '&#x23F3; Importiere ' + items.length + ' Ergebnis(se)\u2026';
  var r2 = await apiPost('ergebnisse/bulk', { items: items });
  if (r2 && r2.ok) {
    var msg = r2.data.imported + ' importiert';
    if (r2.data.skipped) msg += ', ' + r2.data.skipped + ' Duplikate \u00fcbersprungen';
    notify(msg, 'ok');
    document.getElementById('rr-status').innerHTML = '&#x2705; ' + msg;
    // Geburtsjahr-Vorschläge anzeigen falls vorhanden
    if (gjUpdates.length > 0) {
      setTimeout(function() { _rrShowGjModal(gjUpdates); }, 400);
    }
  } else {
    notify((r2 && r2.fehler) ? r2.fehler : 'Fehler', 'err');
    document.getElementById('rr-status').innerHTML = '';
  }
}

function _rrShowGjModal(updates) {
  var rows = '';
  for (var i = 0; i < updates.length; i++) {
    var u = updates[i];
    rows +=
      '<tr style="border-bottom:1px solid var(--border)">' +
        '<td style="padding:6px 8px">' + u.name + '</td>' +
        '<td style="padding:6px 8px;text-align:center;font-weight:700;color:var(--primary)">' + u.jahrRR + '</td>' +
        '<td style="padding:6px 8px;text-align:center">' +
          '<input type="checkbox" data-gj-id="' + u.athletId + '" data-gj-year="' + u.jahrRR + '" checked style="width:15px;height:15px;cursor:pointer"/>' +
        '</td>' +
      '</tr>';
  }
  showModal(
    modalH2('&#x1F382; Geburtsjahr übernehmen?') +
    '<p style="font-size:13px;color:var(--text2);margin-bottom:10px">' +
      'Für folgende Athleten wurde in den RaceResult-Daten ein Geburtsjahr gefunden, ' +
      'das noch nicht in der Datenbank hinterlegt ist. Welche sollen übernommen werden?' +
    '</p>' +
    '<div class="table-scroll" style="margin-bottom:12px">' +
      '<table style="width:100%;border-collapse:collapse;font-size:13px">' +
        '<thead><tr style="border-bottom:2px solid var(--border)">' +
          '<th style="text-align:left;padding:6px 8px">Athlet</th>' +
          '<th style="padding:6px 8px">Jahrgang</th>' +
          '<th style="padding:6px 8px">&#x2713; Übern.</th>' +
        '</tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table>' +
    '</div>' +
    '<div class="modal-actions">' +
      '<button class="btn btn-ghost" onclick="closeModal()">Überspringen</button>' +
      '<button class="btn btn-primary" onclick="_rrSaveGj()">&#x1F4BE; Geburtsjahr speichern</button>' +
    '</div>'
  );
}

async function _rrSaveGj() {
  var chks = document.querySelectorAll('[data-gj-id]');
  var ok = 0;
  for (var i = 0; i < chks.length; i++) {
    if (!chks[i].checked) continue;
    var aid  = parseInt(chks[i].getAttribute('data-gj-id'));
    var jahr = parseInt(chks[i].getAttribute('data-gj-year'));
    var res = await apiPut('athleten/' + aid, { geburtsjahr: jahr });
    if (res && res.ok) ok++;
  }
  closeModal();
  if (ok > 0) {
    notify(ok + ' Geburtsjahr' + (ok > 1 ? 'e' : '') + ' gespeichert.', 'ok');
    await loadAthleten();
  }
}

async function deleteErgebnis(subTab, id) {
  if (!await confirmModal('Ergebnis in den Papierkorb verschieben?')) return;
  var r = await apiDel(subTab + '/' + id);
  if (r && r.ok) { notify('Gel\u00f6scht.', 'ok'); await loadErgebnisseData(); }
  else notify('Fehler: ' + ((r && r.fehler) || ''), 'err');
}
// ── ADMIN ──────────────────────────────────────────────────

// ── Modal für unzugeordnete Athleten ────────────────────────────────────────
async function rrUnmatchedModal(unmatched) {
  return new Promise(function(resolve) {
    // Athleten-Optionen
    var athOpts = '<option value="">– zuordnen –</option>';
    (state.athleten || []).forEach(function(a) {
      athOpts += '<option value="' + a.id + '">' + a.name_nv + '</option>';
    });

    // Zeilen aufbauen
    var rows = '';
    unmatched.forEach(function(u, i) {
      var nameNorm = u.name.replace(/^([^,]+),\s*(.+)$/, '$2 $1'); // "Nachname, Vorname" → "Vorname Nachname"
      rows +=
        '<tr style="border-bottom:1px solid var(--border)" id="rrm-row-' + i + '">' +
          '<td style="padding:8px 10px;font-weight:600;font-size:13px">' + (u.name || '–') + '</td>' +
          '<td style="padding:8px 10px;font-size:12px;color:var(--text2)">' + (u.year || '–') + (u.geschlecht ? ' · ' + u.geschlecht : '') + '</td>' +
          '<td style="padding:6px 10px">' +
            '<div style="display:flex;gap:6px;align-items:center">' +
              '<label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer">' +
                '<input type="radio" name="rrm-action-' + i + '" value="zuordnen" checked onchange="rrmToggle(' + i + ',\'zuordnen\')"> Zuordnen' +
              '</label>' +
              '<label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer">' +
                '<input type="radio" name="rrm-action-' + i + '" value="neu" onchange="rrmToggle(' + i + ',\'neu\')"> Neu anlegen' +
              '</label>' +
              '<label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer">' +
                '<input type="radio" name="rrm-action-' + i + '" value="skip" onchange="rrmToggle(' + i + ',\'skip\')"> Überspringen' +
              '</label>' +
            '</div>' +
            '<div id="rrm-zuordnen-' + i + '" style="margin-top:6px">' +
              '<select id="rrm-sel-' + i + '" style="width:100%;padding:7px 10px;border:1px solid var(--border);border-radius:7px;font-size:13px;background:var(--surface);color:var(--text)">' + athOpts + '</select>' +
            '</div>' +
            '<div id="rrm-neu-' + i + '" style="margin-top:6px;display:none">' +
              '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
                '<input id="rrm-vorname-' + i + '" type="text" placeholder="Vorname" value="' + (nameNorm.split(' ')[0]||'') + '" style="flex:1;min-width:100px;padding:7px 10px;border:1px solid var(--border);border-radius:7px;font-size:13px;background:var(--surface);color:var(--text)">' +
                '<input id="rrm-nachname-' + i + '" type="text" placeholder="Nachname" value="' + (nameNorm.split(' ').slice(1).join(' ')||'') + '" style="flex:1;min-width:100px;padding:7px 10px;border:1px solid var(--border);border-radius:7px;font-size:13px;background:var(--surface);color:var(--text)">' +
                '<select id="rrm-geschlecht-' + i + '" style="width:80px;padding:7px 10px;border:1px solid var(--border);border-radius:7px;font-size:13px;background:var(--surface);color:var(--text)">' +
                  '<option value="">G.</option><option value="M"' + (u.geschlecht==='M'?' selected':'') + '>M</option><option value="W"' + (u.geschlecht==='W'?' selected':'') + '>W</option><option value="D"' + (u.geschlecht==='D'?' selected':'') + '>D</option>' +
                '</select>' +
                '<input id="rrm-gebj-' + i + '" type="number" placeholder="Jahrg." value="' + (u.year||'') + '" min="1920" max="2020" style="width:90px;padding:7px 10px;border:1px solid var(--border);border-radius:7px;font-size:13px;background:var(--surface);color:var(--text)">' +
              '</div>' +
            '</div>' +
          '</td>' +
        '</tr>';
    });

    var html =
      '<h3 style="margin:0 0 16px;font-size:17px">⚠︎ Unbekannte Athleten</h3>' +
      '<p style="color:var(--text2);font-size:13px;margin:0 0 16px">' + unmatched.length + ' Athlet(en) konnten nicht automatisch zugeordnet werden. Bitte für jeden Athleten eine Aktion wählen:</p>' +
      '<div style="overflow-x:auto;margin-bottom:20px">' +
        '<table style="width:100%;border-collapse:collapse;font-size:13px">' +
          '<thead><tr style="background:var(--surf2)">' +
            '<th style="padding:8px 10px;text-align:left;font-size:11px;color:var(--text2);text-transform:uppercase">Name (RR)</th>' +
            '<th style="padding:8px 10px;text-align:left;font-size:11px;color:var(--text2);text-transform:uppercase">Jahrg./G.</th>' +
            '<th style="padding:8px 10px;text-align:left;font-size:11px;color:var(--text2);text-transform:uppercase">Aktion</th>' +
          '</tr></thead>' +
          '<tbody>' + rows + '</tbody>' +
        '</table>' +
      '</div>' +
      '<div style="display:flex;gap:10px;justify-content:flex-end">' +
        '<button class="btn btn-ghost" onclick="closeModal();window._rrmResolve(null)">Abbrechen</button>' +
        '<button class="btn btn-primary" onclick="rrmConfirm(' + unmatched.length + ')">Weiter →</button>' +
      '</div>';

    window._rrmResolve = resolve;
    window._rrmUnmatched = unmatched;
    showModal(html, true); // true = breit
  });
}

function rrmToggle(i, action) {
  document.getElementById('rrm-zuordnen-' + i).style.display = action === 'zuordnen' ? 'block' : 'none';
  document.getElementById('rrm-neu-' + i).style.display = action === 'neu' ? 'block' : 'none';
}

async function rrmConfirm(count) {
  var unmatched = window._rrmUnmatched || [];
  // Für jeden Athleten die gewählte Aktion ausführen
  for (var i = 0; i < count; i++) {
    var u = unmatched[i];
    if (!u) continue;
    var radios = document.querySelectorAll('input[name="rrm-action-' + i + '"]');
    var action = 'skip';
    radios.forEach(function(r) { if (r.checked) action = r.value; });

    if (action === 'zuordnen') {
      var selVal = (document.getElementById('rrm-sel-' + i) || {}).value;
      if (selVal && u.athSel) u.athSel.value = selVal;

    } else if (action === 'neu') {
      var vn = ((document.getElementById('rrm-vorname-' + i) || {}).value || '').trim();
      var nn = ((document.getElementById('rrm-nachname-' + i) || {}).value || '').trim();
      var g  = ((document.getElementById('rrm-geschlecht-' + i) || {}).value || '').trim();
      var gj = ((document.getElementById('rrm-gebj-' + i) || {}).value || '').trim();
      if (!vn || !nn) { notify('Bitte Vor- und Nachname angeben.', 'err'); return; }
      var r2 = await apiPost('athleten', { name_nv: nn + ', ' + vn, vorname: vn, nachname: nn, geschlecht: g, geburtsjahr: gj ? parseInt(gj) : null });
      if (r2 && r2.ok && r2.data && r2.data.id) {
        // state.athleten aktualisieren
        var newAth = { id: r2.data.id, name_nv: nn + ', ' + vn, vorname: vn, nachname: nn, geschlecht: g, geburtsjahr: gj ? parseInt(gj) : null };
        state.athleten.push(newAth);
        if (state._athletenMap) state._athletenMap[newAth.id] = newAth;
        if (u.athSel) {
          var opt = document.createElement('option');
          opt.value = newAth.id; opt.text = newAth.name_nv; opt.selected = true;
          u.athSel.appendChild(opt);
          u.athSel.value = newAth.id;
        }
        notify('Athlet "' + newAth.name_nv + '" angelegt.', 'ok');
      } else {
        notify((r2 && r2.fehler) ? r2.fehler : 'Fehler beim Anlegen.', 'err');
        return;
      }

    } else {
      // skip: Checkbox deaktivieren
      if (u.athSel) {
        var row = u.athSel.closest('tr');
        if (row) {
          var chk = row.querySelector('.rr-chk');
          if (chk) chk.checked = false;
        }
      }
    }
  }
  closeModal();
  if (window._rrmResolve) window._rrmResolve(true);
}

// ── Unbekannte AK auflösen ──────────────────────────────────────────────────

async function rrUnknownAKModal(unknownAKs) {
  // DLV-AK-Optionen für Dropdown
  var dlvAKs = [
    'M','W',
    'MU12','WU12','MU14','WU14','MU16','WU16','MU18','WU18','MU20','WU20','MU23','WU23',
    'M30','W30','M35','W35','M40','W40','M45','W45','M50','W50',
    'M55','W55','M60','W60','M65','W65','M70','W70','M75','W75'
  ];
  var dlvOpts = '<option value="">– leer lassen –</option>';
  dlvAKs.forEach(function(a) { dlvOpts += '<option value="' + a + '">' + a + '</option>'; });

  var rows = '';
  Object.keys(unknownAKs).forEach(function(rawAK, i) {
    rows +=
      '<tr style="border-bottom:1px solid var(--border)">' +
        '<td style="padding:10px 12px;font-weight:600;font-size:13px;color:var(--accent)">' + rawAK + '</td>' +
        '<td style="padding:6px 12px">' +
          '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">' +
            '<label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer">' +
              '<input type="radio" name="rruk-action-' + i + '" value="map" onchange="rrukToggle(' + i + ',\'map\')"> DLV-AK zuordnen' +
            '</label>' +
            '<label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer">' +
              '<input type="radio" name="rruk-action-' + i + '" value="keep" checked onchange="rrukToggle(' + i + ',\'keep\')"> So übernehmen' +
            '</label>' +
            '<label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer">' +
              '<input type="radio" name="rruk-action-' + i + '" value="empty" onchange="rrukToggle(' + i + ',\'empty\')"> Leer lassen' +
            '</label>' +
          '</div>' +
          '<div id="rruk-map-' + i + '" style="margin-top:6px;display:none">' +
            '<select id="rruk-sel-' + i + '" style="padding:5px 8px;border:1px solid var(--border);border-radius:6px;font-size:13px;background:var(--surface);color:var(--text);width:120px">' +
              dlvOpts +
            '</select>' +
          '</div>' +
        '</td>' +
      '</tr>';
  });

  var html =
    '<h2>\u26A0\uFE0E Unbekannte Altersklassen <button class="modal-close" onclick="rrukCancel()">\u2715</button></h2>' +
    '<p style="font-size:13px;color:var(--text2);margin-bottom:12px">' +
      'Die folgenden Altersklassen entsprechen nicht dem DLV-Standard. Bitte f\u00fcr jede AK w\u00e4hlen wie sie \u00fcbernommen werden soll.' +
    '</p>' +
    '<div class="table-scroll" style="max-height:50vh">' +
      '<table style="width:100%;border-collapse:collapse">' +
        '<thead><tr style="background:var(--surf2)">' +
          '<th style="padding:8px 12px;text-align:left;font-size:12px">Roher AK-Wert</th>' +
          '<th style="padding:8px 12px;text-align:left;font-size:12px">Behandlung</th>' +
        '</tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table>' +
    '</div>' +
    '<div class="modal-actions">' +
      '<button class="btn btn-ghost" onclick="rrukCancel()">Abbrechen</button>' +
      '<button class="btn btn-primary" onclick="rrukConfirm()">&#x1F4BE; Weiter</button>' +
    '</div>';

  return new Promise(function(resolve) {
    window._rrukResolve = resolve;
    window._rrukKeys = Object.keys(unknownAKs);
    showModal(html, true);
  });
}

function rrukToggle(i, action) {
  var mapDiv = document.getElementById('rruk-map-' + i);
  if (mapDiv) mapDiv.style.display = action === 'map' ? 'block' : 'none';
}

function rrukCancel() {
  closeModal();
  if (window._rrukResolve) { window._rrukResolve(null); window._rrukResolve = null; }
}

function rrukConfirm() {
  var keys = window._rrukKeys || [];
  var resolved = {};
  keys.forEach(function(rawAK, i) {
    var action = 'map';
    var radios = document.querySelectorAll('input[name="rruk-action-' + i + '"]');
    radios.forEach(function(r) { if (r.checked) action = r.value; });
    if (action === 'map') {
      var sel = document.getElementById('rruk-sel-' + i);
      resolved[rawAK] = sel ? (sel.value || '') : '';
    } else if (action === 'keep') {
      resolved[rawAK] = rawAK; // unverändert
    } else {
      resolved[rawAK] = ''; // leer
    }
  });
  closeModal();
  if (window._rrukResolve) { window._rrukResolve(resolved); window._rrukResolve = null; }
}

// ── Neue-Athleten-Dialog (für alle URL-Imports) ──────────────
async function bulkNewAthleteDialog(candidates) {
  return new Promise(function(resolve) {
    var athOpts = '<option value="">– vorhandenen Athleten zuordnen –</option>';
    (state.athleten || []).forEach(function(a) {
      athOpts += '<option value="' + a.id + '">' + a.name_nv + '</option>';
    });

    var rows = '';
    candidates.forEach(function(c, i) {
      // Name aufteilen: "Nachname, Vorname" oder "Vorname Nachname"
      var vn = '', nn = '';
      var commaMatch = c.name.match(/^([^,]+),\s*(.+)$/);
      if (commaMatch) { nn = commaMatch[1].trim(); vn = commaMatch[2].trim(); }
      else { var parts = c.name.trim().split(/\s+/); vn = parts[0] || ''; nn = parts.slice(1).join(' ') || ''; }

      // Geschlecht aus AK ableiten falls nicht gesetzt
      var g = c.geschlecht || '';
      if (!g && c.ak) g = /^W/i.test(c.ak) ? 'W' : /^M/i.test(c.ak) ? 'M' : '';
      if (g === 'F') g = 'W';

      rows +=
        '<tr style="border-bottom:1px solid var(--border)" id="bnad-row-' + i + '">' +
          '<td style="padding:10px;font-weight:600;font-size:13px;white-space:nowrap">' + (c.name || '–') + '</td>' +
          '<td style="padding:10px;font-size:12px;color:var(--text2);white-space:nowrap">' +
            (c.year || '–') + (g ? ' · ' + g : '') +
          '</td>' +
          '<td style="padding:8px 10px">' +
            '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
              '<label style="display:flex;align-items:center;gap:5px;font-size:13px;cursor:pointer">' +
                '<input type="radio" name="bnad-' + i + '" value="neu" checked onchange="bnadToggle(' + i + ',\'neu\')"> Neu anlegen' +
              '</label>' +
              '<label style="display:flex;align-items:center;gap:5px;font-size:13px;cursor:pointer">' +
                '<input type="radio" name="bnad-' + i + '" value="zuordnen" onchange="bnadToggle(' + i + ',\'zuordnen\')"> Vorhandenen zuordnen' +
              '</label>' +
              '<label style="display:flex;align-items:center;gap:5px;font-size:13px;cursor:pointer">' +
                '<input type="radio" name="bnad-' + i + '" value="skip" onchange="bnadToggle(' + i + ',\'skip\')"> Überspringen' +
              '</label>' +
            '</div>' +
            // Neu-anlegen Felder (default)
            '<div id="bnad-neu-' + i + '" style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">' +
              '<input id="bnad-vn-' + i + '" type="text" placeholder="Vorname" value="' + vn.replace(/"/g,'&quot;') + '" ' +
                'style="flex:1;min-width:90px;padding:6px 10px;border:1px solid var(--border);border-radius:7px;font-size:13px;background:var(--surface);color:var(--text)">' +
              '<input id="bnad-nn-' + i + '" type="text" placeholder="Nachname" value="' + nn.replace(/"/g,'&quot;') + '" ' +
                'style="flex:1;min-width:90px;padding:6px 10px;border:1px solid var(--border);border-radius:7px;font-size:13px;background:var(--surface);color:var(--text)">' +
              '<select id="bnad-g-' + i + '" style="width:70px;padding:6px 10px;border:1px solid var(--border);border-radius:7px;font-size:13px;background:var(--surface);color:var(--text)">' +
                '<option value="">G.</option>' +
                '<option value="M"' + (g==='M'?' selected':'') + '>M</option>' +
                '<option value="W"' + (g==='W'?' selected':'') + '>W</option>' +
                '<option value="D"' + (g==='D'?' selected':'') + '>D</option>' +
              '</select>' +
              '<input id="bnad-gj-' + i + '" type="number" placeholder="Jahrg." value="' + (c.year||'') + '" min="1920" max="2025" ' +
                'style="width:85px;padding:6px 10px;border:1px solid var(--border);border-radius:7px;font-size:13px;background:var(--surface);color:var(--text)">' +
            '</div>' +
            // Zuordnen-Dropdown (versteckt)
            '<div id="bnad-zuordnen-' + i + '" style="margin-top:8px;display:none">' +
              '<select id="bnad-sel-' + i + '" style="width:100%;padding:6px 10px;border:1px solid var(--border);border-radius:7px;font-size:13px;background:var(--surface);color:var(--text)">' + athOpts + '</select>' +
            '</div>' +
          '</td>' +
        '</tr>';
    });

    var html =
      '<h3 style="margin:0 0 4px;font-size:17px">\u2795\ufe0e Neue Athleten gefunden</h3>' +
      '<p style="color:var(--text2);font-size:13px;margin:0 0 18px">' +
        candidates.length + ' Athlet' + (candidates.length>1 ? 'en' : '') +
        ' aus dem Import konnten keinem vorhandenen Profil zugeordnet werden. ' +
        'Bitte für jeden eine Aktion wählen.' +
      '</p>' +
      '<div style="overflow-x:auto;margin-bottom:20px">' +
        '<table style="width:100%;border-collapse:collapse;font-size:13px">' +
          '<thead><tr style="background:var(--surf2)">' +
            '<th style="padding:8px 10px;text-align:left;font-size:11px;color:var(--text2);text-transform:uppercase;letter-spacing:.5px">Name (Import)</th>' +
            '<th style="padding:8px 10px;text-align:left;font-size:11px;color:var(--text2);text-transform:uppercase;letter-spacing:.5px">Jahrg./G.</th>' +
            '<th style="padding:8px 10px;text-align:left;font-size:11px;color:var(--text2);text-transform:uppercase;letter-spacing:.5px">Aktion</th>' +
          '</tr></thead>' +
          '<tbody>' + rows + '</tbody>' +
        '</table>' +
      '</div>' +
      '<div style="display:flex;gap:10px;justify-content:flex-end">' +
        '<button class="btn btn-ghost" onclick="closeModal();window._bnadResolve(null)">Abbrechen</button>' +
        '<button class="btn btn-primary" onclick="bnadConfirm(' + candidates.length + ')">Weiter \u2192</button>' +
      '</div>';

    window._bnadResolve = resolve;
    window._bnadCandidates = candidates;
    showModal(html, true);
  });
}

function bnadToggle(i, action) {
  document.getElementById('bnad-neu-' + i).style.display      = action === 'neu'      ? 'flex' : 'none';
  document.getElementById('bnad-zuordnen-' + i).style.display = action === 'zuordnen' ? 'block' : 'none';
}

async function bnadConfirm(count) {
  var candidates = window._bnadCandidates || [];
  // name → athletId Mapping aufbauen
  var nameMap = {}; // name → athletId (oder null = skip)

  for (var i = 0; i < count; i++) {
    var c = candidates[i];
    if (!c) continue;
    var radios = document.querySelectorAll('input[name="bnad-' + i + '"]');
    var action = 'neu';
    radios.forEach(function(r) { if (r.checked) action = r.value; });

    if (action === 'skip') {
      nameMap[c.name] = null;

    } else if (action === 'zuordnen') {
      var selVal = (document.getElementById('bnad-sel-' + i)||{}).value;
      nameMap[c.name] = selVal ? parseInt(selVal) : null;

    } else { // neu
      var vn = ((document.getElementById('bnad-vn-' + i)||{}).value||'').trim();
      var nn = ((document.getElementById('bnad-nn-' + i)||{}).value||'').trim();
      var g  = ((document.getElementById('bnad-g-'  + i)||{}).value||'').trim();
      var gj = ((document.getElementById('bnad-gj-' + i)||{}).value||'').trim();
      if (!vn || !nn) { notify('Bitte Vor- und Nachname für "' + c.name + '" angeben.', 'err'); return; }
      var r2 = await apiPost('athleten', { name_nv: nn+', '+vn, vorname: vn, nachname: nn, geschlecht: g, geburtsjahr: gj ? parseInt(gj) : null });
      if (r2 && r2.ok && r2.data && r2.data.id) {
        var newAth = { id: r2.data.id, name_nv: nn+', '+vn, vorname: vn, nachname: nn, geschlecht: g };
        state.athleten.push(newAth);
        if (state._athletenMap) state._athletenMap[newAth.id] = newAth;
        notify('Athlet "' + newAth.name_nv + '" angelegt.', 'ok');
        nameMap[c.name] = newAth.id;
      } else {
        // "Bereits vorhanden" ist kein Abbruchgrund: Liste neu laden und den
        // vorhandenen Athleten zuordnen (z.B. veraltete Athletenliste im Browser)
        var _fehler = (r2 && r2.fehler) ? r2.fehler : 'unbekannter Fehler';
        if (/vorhanden/i.test(_fehler) && typeof loadAthleten === 'function') {
          await loadAthleten();
          var _nv = (nn + ', ' + vn).toLowerCase();
          var _da = (state.athleten || []).find(function(a) {
            return (a.name_nv || '').toLowerCase() === _nv;
          });
          if (_da) {
            notify('Athlet "' + _da.name_nv + '" war bereits vorhanden – Ergebnisse werden ihm zugeordnet.', 'ok');
            nameMap[c.name] = _da.id;
            continue;
          }
        }
        notify('Fehler beim Anlegen von "' + c.name + '": ' + _fehler, 'err');
        return;
      }
    }
  }

  closeModal();
  window._bnadResolve(nameMap);
}

// ── Tag-Datum-Dialog für RaceResult-Serien ───────────────────
async function rrTagDatumDialog(tagNrs, baseDate) {
  return new Promise(function(resolve) {
    // Datumsfelder pro Tag — vorausgefüllt mit baseDatum wenn vorhanden
    var rows = '';
    tagNrs.forEach(function(nr) {
      rows +=
        '<tr style="border-bottom:1px solid var(--border)">' +
          '<td style="padding:10px;font-weight:600;font-size:14px;white-space:nowrap">Lauf ' + nr + '</td>' +
          '<td style="padding:8px 10px">' +
            '<input id="rrtd-datum-' + nr + '" type="date" value="' + (baseDate||'') + '" ' +
            'style="padding:6px 10px;border:1px solid var(--border);border-radius:7px;font-size:14px;' +
            'background:var(--surface);color:var(--text);width:160px">' +
          '</td>' +
        '</tr>';
    });

    var html =
      '<h3 style="margin:0 0 6px;font-size:17px">📅\ufe0e Datum pro Lauf</h3>' +
      '<p style="color:var(--text2);font-size:13px;margin:0 0 18px">' +
        'Die Laufserie hat ' + tagNrs.length + ' Läufe. Bitte das Datum für jeden Lauf angeben.' +
      '</p>' +
      '<table style="border-collapse:collapse;margin-bottom:20px">' +
        '<thead><tr style="background:var(--surf2)">' +
          '<th style="padding:6px 10px;text-align:left;font-size:11px;color:var(--text2);text-transform:uppercase;letter-spacing:.5px">Lauf</th>' +
          '<th style="padding:6px 10px;text-align:left;font-size:11px;color:var(--text2);text-transform:uppercase;letter-spacing:.5px">Datum</th>' +
        '</tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table>' +
      '<div style="display:flex;gap:10px;justify-content:flex-end">' +
        '<button class="btn btn-ghost" onclick="closeModal();window._rrtdResolve(null)">Abbrechen</button>' +
        '<button class="btn btn-primary" onclick="rrtdConfirm()">Weiter →</button>' +
      '</div>';

    window._rrtdResolve = resolve;
    window._rrtdTagNrs = tagNrs;
    showModal(html, false);
  });
}

function rrtdConfirm() {
  var tagNrs = window._rrtdTagNrs || [];
  var dates = {};
  tagNrs.forEach(function(nr) {
    var el = document.getElementById('rrtd-datum-' + nr);
    dates[nr] = el ? el.value : '';
  });
  closeModal();
  window._rrtdResolve(dates);
}


// ═══════════════════════════════════════════════════════════════
// Offene Wettkämpfe aus dem Trainingsportal
// ---------------------------------------------------------------
// Zeigt oben auf der Bulk-Seite alle Wettkämpfe, für die sich im
// Trainingsportal (https://training.tus-oedt.de/#wettkampfplanung)
// Athlet:innen angemeldet haben, deren Termin vorbei ist und für die
// hier noch kein Ergebnis erfasst wurde. Ein Klick füllt Veranstaltung
// und Athletenzeilen vor.
// ═══════════════════════════════════════════════════════════════

var _owItems = [];

function _owEsc(s) {
  return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

async function _bkLoadOffeneWK() {
  var box = document.getElementById('bk-offene-wk');
  if (!box) return;
  var r = await apiGet('offene-wettkaempfe');
  _owItems = (r && r.ok && Array.isArray(r.data)) ? r.data : [];
  // Nav-Badge synchron halten (spart einen separaten Request beim Tab-Öffnen)
  window._eintragenOffeneWK = _owItems.length;
  if (typeof _patchEintragenNavBadge === 'function' && typeof _eintragenBadgeSumme === 'function')
    _patchEintragenNavBadge(_eintragenBadgeSumme());
  box = document.getElementById('bk-offene-wk');
  if (!box) return;
  if (!_owItems.length) { box.innerHTML = ''; return; }

  var html =
    '<div style="margin-bottom:18px;border:1px solid var(--border);border-left:3px solid var(--primary);border-radius:8px;padding:14px 16px;background:var(--surf2)">' +
      '<div style="font-size:13px;font-weight:700;margin-bottom:2px">&#x1F4CC; Ergebnisse ausstehend</div>' +
      '<div style="font-size:12px;color:var(--text2);margin-bottom:12px">' +
        _owItems.length + ' Wettkampf' + (_owItems.length !== 1 ? 'e' : '') +
        ' mit Anmeldungen aus dem Trainingsportal, aber noch ohne Ergebnis. ' +
        '<a href="#" onclick="owArchiv();return false" style="color:var(--text2);text-decoration:underline">' +
        '&#x1F5C2;&#xFE0F; Abgehakte Anmeldungen</a>' +
      '</div>';

  for (var i = 0; i < _owItems.length; i++) {
    var it = _owItems[i];
    var athHtml = it.athleten.map(function(a) {
      var disz = (a.disziplinen || []).map(function(d) { return d.disziplin; }).filter(Boolean);
      return '<span style="display:inline-block;padding:3px 4px 3px 9px;border-radius:12px;background:var(--surface);' +
        'border:1px solid var(--border);font-size:12px;margin:2px 4px 2px 0"' +
        (a.athlet_id ? '' : ' title="Kein Athletenprofil verkn&uuml;pft"') + '>' +
        (a.athlet_id ? '' : '&#x26A0;&#xFE0F; ') + _owEsc(a.name) +
        (disz.length ? '<span style="color:var(--text2)"> &middot; ' + _owEsc(disz.join(', ')) + '</span>' : '') +
        '<button onclick="owAbhaken(' + i + ',' + a.benutzer_id + ')" ' +
          'title="Nicht gestartet \u2013 nicht mehr melden" ' +
          'style="border:0;background:none;color:var(--text2);cursor:pointer;font-size:12px;padding:0 4px;line-height:1">' +
          '&#x2715;</button>' +
        '</span>';
    }).join('');

    html +=
      '<div style="display:flex;gap:12px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;' +
        'padding:10px 0' + (i ? ';border-top:1px solid var(--border)' : '') + '">' +
        '<div style="flex:1;min-width:240px">' +
          '<div style="font-size:14px;font-weight:600">' + _owEsc(it.name || it.serie_name) + '</div>' +
          '<div style="font-size:12px;color:var(--text2);margin:2px 0 6px">' +
            formatDate(it.datum) +
            (it.datum_quelle === 'prognose' ? ' <span title="Termin gesch&auml;tzt – bitte pr&uuml;fen">(gesch&auml;tzt)</span>' : '') +
            (it.ort ? ' &middot; ' + _owEsc(it.ort) : '') +
            (it.veranstaltung_id ? ' &middot; Veranstaltung bereits angelegt' : '') +
          '</div>' +
          '<div>' + athHtml + '</div>' +
        '</div>' +
        '<div style="display:flex;gap:6px;align-items:center">' +
          (it.url ? '<a href="' + _owEsc(it.url) + '" target="_blank" rel="noopener" class="btn btn-ghost btn-sm" title="Website der Veranstaltung">&#x1F310;</a>' : '') +
          '<a href="#veranstaltungen/serie/' + it.serie_id + '" class="btn btn-ghost btn-sm" title="Zur Serie">&#x1F4CA;</a>' +
          '<button class="btn btn-ghost btn-sm" onclick="owAbhaken(' + i + ')" title="Niemand aus der Liste ist gestartet bzw. es kommt kein Ergebnis mehr">&#x2715; Erledigt</button>' +
          '<button class="btn btn-' + (it.ergebnis_url ? 'ghost' : 'primary') + ' btn-sm" onclick="owPrefill(' + i + ')">&#x270D;&#xFE0F; Ergebnisse eintragen</button>' +
          (it.ergebnis_url ? '<button class="btn btn-primary btn-sm" onclick="owImportUrl(' + i + ')" title="' + _owEsc(it.ergebnis_url) + '">&#x1F4E5; Ergebnisse direkt importieren</button>' : '') +
        '</div>' +
      '</div>';
  }

  box.innerHTML = html + '</div>';
}

// Anmeldung(en) abhaken: ohne benutzerId der ganze Wettkampf, sonst nur diese
// Person. Beides landet in offene_wk_erledigt und wird nicht mehr gemeldet.
async function owAbhaken(i, benutzerId) {
  var it = _owItems[i];
  if (!it) return;
  var uids = benutzerId ? [benutzerId]
                        : it.athleten.map(function(a) { return a.benutzer_id; });
  var r = await apiPost('offene-wettkaempfe/erledigt', {
    serie_id:     it.serie_id,
    jahr:         it.jahr,
    benutzer_ids: uids,
    grund:        benutzerId ? 'nicht_gelaufen' : 'erledigt'
  });
  if (r && r.ok) {
    notify(benutzerId ? 'Anmeldung abgehakt – wird nicht mehr gemeldet.'
                      : 'Wettkampf abgehakt – wird nicht mehr gemeldet.', 'ok');
    _bkLoadOffeneWK();
  } else notify((r && r.fehler) || 'Fehler beim Speichern.', 'err');
}

// Archiv der abgehakten Anmeldungen – je Zeile wieder in die Meldung holbar.
async function owArchiv() {
  var r = await apiGet('offene-wettkaempfe/erledigt');
  var rows = (r && r.ok && Array.isArray(r.data)) ? r.data : [];
  var html = '<h3 style="margin:0 0 6px;font-size:17px">🗂️ Abgehakte Anmeldungen</h3>' +
    '<p style="color:var(--text2);font-size:13px;margin:0 0 16px">' +
      'Anmeldungen aus dem Trainingsportal, die hier abgehakt wurden.</p>';

  if (!rows.length) {
    html += '<div style="color:var(--text2);font-size:13px;padding:8px 0">Nichts abgehakt.</div>';
  } else {
    html += '<table style="border-collapse:collapse;width:100%;font-size:13px">';
    for (var i = 0; i < rows.length; i++) {
      var w = rows[i];
      html +=
        '<tr style="border-bottom:1px solid var(--border)">' +
          '<td style="padding:8px 10px">' + _owEsc(w.name || ('#' + w.benutzer_id)) + '</td>' +
          '<td style="padding:8px 10px">' + _owEsc(w.serie_name || ('Serie ' + w.serie_id)) +
            ' <span style="color:var(--text2)">' + w.jahr + '</span></td>' +
          '<td style="padding:8px 10px;color:var(--text2)">' +
            (w.grund === 'erledigt' ? 'erledigt' : 'nicht gestartet') + '</td>' +
          '<td style="padding:8px 10px;text-align:right">' +
            '<button class="btn btn-ghost btn-sm" onclick="owArchivZurueck(' +
              w.serie_id + ',' + w.jahr + ',' + w.benutzer_id + ')">↩︎ Wieder melden</button>' +
          '</td>' +
        '</tr>';
    }
    html += '</table>';
  }
  html += '<div style="display:flex;justify-content:flex-end;margin-top:18px">' +
    '<button class="btn btn-ghost" onclick="closeModal()">Schließen</button></div>';
  showModal(html, true);
}

async function owArchivZurueck(serieId, jahr, benutzerId) {
  var r = await apiPost('offene-wettkaempfe/erledigt', {
    serie_id: serieId, jahr: jahr, benutzer_ids: [benutzerId], aktion: 'zurueck'
  });
  if (r && r.ok) {
    notify('Anmeldung wird wieder gemeldet.', 'ok');
    _bkLoadOffeneWK();
    owArchiv();
  } else notify((r && r.fehler) || 'Fehler beim Speichern.', 'err');
}


// ═══════════════════════════════════════════════════════════════
// Scanner-Funde (RaceResult + uitslagen.nl)
// ═══════════════════════════════════════════════════════════════

var _rrFunde   = [];
var _uitsFunde = [];
var _laFunde   = [];

// ── Gemeinsame Darstellung beider Scanner-Panels ───────────────────────
// evs: Wettkämpfe mit .funde (siehe Scanner::gruppiere in PHP).
// cfg: { titel, hinweis, linkTitel, importFn, ignorierFn }
function _bkFundePanelHtml(evs, cfg) {
  var html =
    '<div style="margin-bottom:18px;border:1px solid var(--border);border-left:3px solid var(--accent);border-radius:8px;padding:14px 16px;background:var(--surf2)">' +
      '<div style="font-size:13px;font-weight:700;margin-bottom:2px">&#x1F50E; ' + cfg.titel + '</div>' +
      '<div style="font-size:12px;color:var(--text2);margin-bottom:12px">' +
        evs.length + ' Wettkampf' + (evs.length !== 1 ? 'e' : '') + cfg.hinweis +
      '</div>';

  for (var i = 0; i < evs.length; i++) {
    var ev = evs[i];
    var chips = (ev.funde || []).map(function(f) {
      var detail = [f.altersklasse, f.wettbewerb, f.zeit].filter(Boolean).join(' · ');
      return '<span style="display:inline-block;padding:3px 9px;border-radius:12px;' +
        'background:var(--surface);border:1px solid var(--border);font-size:12px;margin:2px 4px 2px 0' +
        (f.bekannt ? ';opacity:.5' : '') + '"' +
        (f.athlet_id ? '' : ' title="Kein Athletenprofil gefunden"') + '>' +
        (f.bekannt ? '✅ ' : (f.athlet_id ? '' : '⚠️ ')) + _owEsc(f.name) +
        (detail ? '<span style="color:var(--text2)"> · ' + _owEsc(detail) + '</span>' : '') +
        '</span>';
    }).join('');

    html +=
      '<div style="display:flex;gap:12px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;' +
        'padding:10px 0' + (i ? ';border-top:1px solid var(--border)' : '') + '">' +
        '<div style="flex:1;min-width:240px">' +
          '<div style="font-size:14px;font-weight:600">' + _owEsc(ev.name) + '</div>' +
          '<div style="font-size:12px;color:var(--text2);margin:2px 0 6px">' +
            formatDate(ev.datum) +
            (ev.ort ? ' · ' + _owEsc(ev.ort) : '') +
            (ev.land ? ' · ' + _owEsc(ev.land) : '') +
          '</div>' +
          '<div>' + chips + '</div>' +
        '</div>' +
        '<div style="display:flex;gap:6px;align-items:center">' +
          '<a href="' + _owEsc(ev.url) + '" target="_blank" rel="noopener" class="btn btn-ghost btn-sm" title="' + cfg.linkTitel + '">&#x1F310;</a>' +
          '<button class="btn btn-ghost btn-sm" onclick="' + cfg.ignorierFn + '(' + i + ')" title="Nicht mehr melden">&#x2715; Ignorieren</button>' +
          '<button class="btn btn-primary btn-sm" onclick="' + cfg.importFn + '(' + i + ')">&#x1F4E5; Ergebnisse importieren</button>' +
        '</div>' +
      '</div>';
  }
  return html + '</div>';
}

// Wettkampf in den passenden Importer übergeben: Veranstaltung vorbelegen,
// Event-URL ins Paste-Feld, Quellenerkennung anstoßen.
function _bkFundImport(ev, quelle) {
  if (!ev) return;

  bkToggleVeranst('neu');
  var datEl = document.getElementById('bk-datum');
  if (datEl) { datEl.value = ev.datum; bkSyncDatum(ev.datum); }
  var nEl = document.getElementById('bk-evname');
  if (nEl) nEl.value = ev.name || '';
  if (ev.ort) _bkAutoSetOrt(ev.ort);
  var qEl = document.getElementById('bk-quelle');
  if (qEl) qEl.value = ev.url;

  var ta = document.getElementById('bk-paste-area');
  if (ta) ta.value = ev.url;
  bulkPasteInput();

  notify(quelle + '-Wettkampf vorbereitet – Importkategorie wählen und einlesen.', 'ok');
  if (ta) ta.scrollIntoView({ behavior: 'smooth', block: 'start' });
}


// ═══════════════════════════════════════════════════════════════
// RaceResult-Funde
// ---------------------------------------------------------------
// Der Scanner (includes/raceresult.php) durchsucht nächtlich alle von
// RaceResult gezeiteten Wettkämpfe in DE/NL/BE nach Starts unseres
// Vereins. Hier werden die Funde gemeldet; der Import selbst läuft
// über den bestehenden RaceResult-Importer.
// ═══════════════════════════════════════════════════════════════

async function _bkLadeRrFunde() {
  var box = document.getElementById('bk-rr-funde');
  if (!box) return;
  var r = await apiGet('rr-funde');
  _rrFunde = (r && r.ok && Array.isArray(r.data)) ? r.data : [];
  window._eintragenRrFunde = _rrFunde.length;
  if (typeof _patchEintragenNavBadge === 'function' && typeof _eintragenBadgeSumme === 'function')
    _patchEintragenNavBadge(_eintragenBadgeSumme());

  box = document.getElementById('bk-rr-funde');
  if (!box) return;
  if (!_rrFunde.length) { box.innerHTML = ''; return; }

  box.innerHTML = _bkFundePanelHtml(_rrFunde, {
    titel:       'Neue Ergebnisse bei RaceResult',
    hinweis:     ' mit Starts unseres Vereins, die hier noch nicht erfasst sind.',
    linkTitel:   'Bei RaceResult ansehen',
    importFn:    'rrFundImport',
    ignorierFn:  'rrFundIgnorieren'
  });
}

function rrFundImport(i) { _bkFundImport(_rrFunde[i], 'RaceResult'); }

async function rrFundIgnorieren(i) {
  var ev = _rrFunde[i];
  if (!ev) return;
  var r = await apiPost('rr-funde', { event_id: ev.event_id, status: 'ignoriert' });
  if (r && r.ok) { notify('Wettkampf wird nicht mehr gemeldet.', 'ok'); _bkLadeRrFunde(); }
  else notify((r && r.fehler) || 'Fehler beim Speichern.', 'err');
}


// ═══════════════════════════════════════════════════════════════
// uitslagen.nl-Funde
// ---------------------------------------------------------------
// Der Scanner (includes/uitslagen.php) nutzt die seitenweite Volltext-
// suche von uitslagen.nl – ein Abruf je Suchbegriff liefert alle Starts
// unseres Vereins. Der Import läuft über den bestehenden
// uitslagen.nl-Importer.
// ═══════════════════════════════════════════════════════════════

async function _bkLadeUitsFunde() {
  var box = document.getElementById('bk-uits-funde');
  if (!box) return;
  var r = await apiGet('uits-funde');
  _uitsFunde = (r && r.ok && Array.isArray(r.data)) ? r.data : [];
  window._eintragenUitsFunde = _uitsFunde.length;
  if (typeof _patchEintragenNavBadge === 'function' && typeof _eintragenBadgeSumme === 'function')
    _patchEintragenNavBadge(_eintragenBadgeSumme());

  box = document.getElementById('bk-uits-funde');
  if (!box) return;
  if (!_uitsFunde.length) { box.innerHTML = ''; return; }

  box.innerHTML = _bkFundePanelHtml(_uitsFunde, {
    titel:       'Neue Ergebnisse bei uitslagen.nl',
    hinweis:     ' mit Starts unseres Vereins, die hier noch nicht erfasst sind.',
    linkTitel:   'Bei uitslagen.nl ansehen',
    importFn:    'uitsFundImport',
    ignorierFn:  'uitsFundIgnorieren'
  });
}

function uitsFundImport(i) { _bkFundImport(_uitsFunde[i], 'uitslagen.nl'); }

async function uitsFundIgnorieren(i) {
  var ev = _uitsFunde[i];
  if (!ev) return;
  var r = await apiPost('uits-funde', { event_id: ev.event_id, status: 'ignoriert' });
  if (r && r.ok) { notify('Wettkampf wird nicht mehr gemeldet.', 'ok'); _bkLadeUitsFunde(); }
  else notify((r && r.fehler) || 'Fehler beim Speichern.', 'err');
}


// ═══════════════════════════════════════════════════════════════
// leichtathletik.de-Funde
// ---------------------------------------------------------------
// Der Scanner (includes/leichtathletik.php) prüft die Teilnehmerlisten
// des DLV-Ergebnisportals. Anders als bei den beiden anderen Quellen
// ist das eine Meldeliste: der Fund sagt, wer gemeldet war – die
// Ergebnisse holt der bestehende leichtathletik.de-Importer.
// ═══════════════════════════════════════════════════════════════

async function _bkLadeLaFunde() {
  var box = document.getElementById('bk-la-funde');
  if (!box) return;
  var r = await apiGet('la-funde');
  _laFunde = (r && r.ok && Array.isArray(r.data)) ? r.data : [];
  window._eintragenLaFunde = _laFunde.length;
  if (typeof _patchEintragenNavBadge === 'function' && typeof _eintragenBadgeSumme === 'function')
    _patchEintragenNavBadge(_eintragenBadgeSumme());

  box = document.getElementById('bk-la-funde');
  if (!box) return;
  if (!_laFunde.length) { box.innerHTML = ''; return; }

  box.innerHTML = _bkFundePanelHtml(_laFunde, {
    titel:       'Neue Meldungen bei leichtathletik.de',
    hinweis:     ' mit Meldungen unseres Vereins, die hier noch nicht erfasst sind.',
    linkTitel:   'Ergebnisübersicht bei leichtathletik.de',
    importFn:    'laFundImport',
    ignorierFn:  'laFundIgnorieren'
  });
}

function laFundImport(i) { _bkFundImport(_laFunde[i], 'leichtathletik.de'); }

async function laFundIgnorieren(i) {
  var ev = _laFunde[i];
  if (!ev) return;
  var r = await apiPost('la-funde', { event_id: ev.event_id, status: 'ignoriert' });
  if (r && r.ok) { notify('Wettkampf wird nicht mehr gemeldet.', 'ok'); _bkLadeLaFunde(); }
  else notify((r && r.fehler) || 'Fehler beim Speichern.', 'err');
}


// Disziplin einer Bulk-Zeile über den Anzeigenamen setzen.
function _owSetDisz(tr, name) {
  if (!tr || !name) return;
  var n = String(name).toLowerCase().trim();
  var list = state.disziplinen || [];
  var hit = null;
  for (var i = 0; i < list.length; i++) {
    if ((list[i].disziplin || '').toLowerCase().trim() === n) { hit = list[i]; break; }
  }
  var sel = tr.querySelector('.bk-disz');
  var inp = tr.querySelector('.bk-disz-search');
  if (hit && sel) {
    var mid = hit.id || hit.mapping_id || '';
    sel.value = String(mid || hit.disziplin);
    if (mid) sel.setAttribute('data-mid', String(mid));
    if (inp) inp.value = hit.disziplin;
  } else if (inp) {
    // Unbekannte Disziplin (z.B. Admin-Extra aus dem Trainingsportal) → nur als Text
    inp.value = name;
  }
}

// Athlet einer Bulk-Zeile aus den Trainingsportal-Daten setzen.
// Unabhängig von state.athleten, damit auch inaktive Athlet:innen funktionieren.
function _owSetAthlet(tr, a) {
  var hidden = tr.querySelector('.bk-athlet');
  var search = tr.querySelector('.bk-athlet-search');
  if (search) search.value = a.name_nv || a.name || '';
  if (!hidden || !a.athlet_id) return;
  hidden.value = a.athlet_id;
  hidden.dataset.g    = a.geschlecht || '';
  hidden.dataset.gebj = a.geburtsjahr ? String(a.geburtsjahr) : '';
  var idx = tr.id ? parseInt(tr.id.replace('bkrow-', '')) : -1;
  if (idx >= 0) bkUpdateAK(hidden, idx);
}

function owPrefill(i) {
  var it = _owItems[i];
  if (!it) return;

  // ── Veranstaltung ──
  var datEl = document.getElementById('bk-datum');
  if (datEl) datEl.value = it.datum;

  if (it.veranstaltung_id) {
    // Veranstaltung existiert schon → bestehende auswählen
    bkToggleVeranst('best');
    _bkSelectedVeranst = { id: it.veranstaltung_id, name: it.name || it.serie_name, datum: it.datum, ort: it.ort };
    var vInp = document.getElementById('bk-veranst-search');
    if (vInp) vInp.value = _bkVeranstLabel(_bkSelectedVeranst);
  } else {
    bkToggleVeranst('neu');
    var nEl = document.getElementById('bk-evname');
    if (nEl) nEl.value = it.name || it.serie_name || '';
    if (it.ort) _bkAutoSetOrt(it.ort);
    if (it.ort_id) {
      _bkSelectedOrtId = it.ort_id;
      var oEl = document.getElementById('bk-ort');
      var oName = _bkOrtNameById(it.ort_id);
      if (oEl && oName) oEl.value = oName;
    }
    var qEl = document.getElementById('bk-quelle');
    if (qEl && it.url && !qEl.value) qEl.value = it.url;
    bkSerieSetById(it.serie_id);
  }

  // ── Zeilen: eine je Athlet × angemeldeter Disziplin ──
  var tbody = document.getElementById('bulk-rows');
  if (tbody) tbody.innerHTML = '';
  var plan = [];
  (it.athleten || []).forEach(function(a) {
    var disz = (a.disziplinen || []).map(function(d) { return d.disziplin; }).filter(Boolean);
    if (disz.length) disz.forEach(function(d) { plan.push({ a: a, d: d }); });
    else plan.push({ a: a, d: null });
  });
  if (!plan.length) plan.push({ a: null, d: null });

  plan.forEach(function(p) {
    bulkAddRow();
    var tb = document.getElementById('bulk-rows');
    var tr = tb && tb.lastElementChild;
    if (!tr) return;
    if (p.a) _owSetAthlet(tr, p.a);
    if (p.d) _owSetDisz(tr, p.d);
  });

  bkSyncDatum(it.datum);

  var fehlend = (it.athleten || []).filter(function(a) { return !a.athlet_id; }).length;
  notify(
    plan.length + ' Zeile' + (plan.length !== 1 ? 'n' : '') + ' vorbelegt' +
    (fehlend ? ' – ' + fehlend + ' ohne verknüpftes Athletenprofil' : '') + '.',
    fehlend ? 'err' : 'ok'
  );
  var paste = document.getElementById('bk-paste-area');
  if (paste) paste.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Direkt-Import aus der im Trainingsportal hinterlegten Ergebnis-URL (pro Ausgabe).
// Bereitet die Veranstaltung wie owPrefill vor (die Athletenzeilen ersetzt der Import),
// füllt die URL ins Bulk-Feld, übernimmt – falls möglich – die Importkategorie aus dem
// Trainingsportal-Slug und startet den Import. Passt kein Kategorie-Slug auf die hier
// vorhandenen Kategorien, fordert bulkEinlesen wie gewohnt zur manuellen Auswahl auf.
function owImportUrl(i) {
  var it = _owItems[i];
  if (!it || !it.ergebnis_url) return;

  // Veranstaltung/Serie/Datum/Ort vorbereiten
  owPrefill(i);

  // Ergebnis-URL als Datenquelle bevorzugen (statt der Website-URL)
  var qEl = document.getElementById('bk-quelle');
  if (qEl) qEl.value = it.ergebnis_url;

  // URL ins Paste-Feld → Quellen-Erkennung + Importkategorie-Selektor
  var ta = document.getElementById('bk-paste-area');
  if (ta) ta.value = it.ergebnis_url;
  bulkPasteInput();

  // Importkategorie aus dem Trainingsportal übernehmen, sofern eine passende
  // Kategorie existiert. Toleriert sowohl den tbl_key (Option-value) als auch
  // den Kategorie-Namen (Option-Label), jeweils case-insensitiv – so ist es egal,
  // ob das Trainingsportal z.B. "strasse" oder "Straße" liefert.
  if (it.import_kategorie) {
    var katSel = document.getElementById('bk-import-kat');
    if (katSel) {
      var want = String(it.import_kategorie).trim().toLowerCase();
      for (var o = 0; o < katSel.options.length; o++) {
        var opt = katSel.options[o];
        if (!opt.value) continue;
        if (opt.value.toLowerCase() === want || (opt.textContent || '').trim().toLowerCase() === want) {
          katSel.value = opt.value;
          bulkImportKatChanged();
          break;
        }
      }
    }
  }

  // Import starten
  bulkEinlesen();
}
