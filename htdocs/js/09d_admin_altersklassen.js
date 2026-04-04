
var _akStdData  = null; // [{ak, geschlecht, reihenfolge}]
var _akUsedData = null; // [{ak, anzahl, is_standard, mapped_to}]

async function renderAdminAltersklassen() {
  var el = document.getElementById('main-content');
  el.innerHTML = adminSubtabs() + '<div style="padding:20px;color:var(--text2)">⏳ Lade Altersklassen…</div>';

  var [r1, r2, r3] = await Promise.all([apiGet('ak-standard'), apiGet('ak-mapping'), apiGet('einstellungen')]);
  if (!r1 || !r1.ok || !r2 || !r2.ok) {
    el.innerHTML = adminSubtabs() + '<div class="panel" style="padding:24px">Fehler beim Laden.</div>';
    return;
  }

  _akStdData  = r1.data || [];
  _akUsedData = (r2.data && r2.data.used) ? r2.data.used : [];
  var _jugendAksCurrent = [];
  try { _jugendAksCurrent = JSON.parse((r3 && r3.data && r3.data.jugend_aks) || '[]') || []; } catch(e) {}

  // ── ABSCHNITT 1: Standard-AKs ─────────────────────────────
  var stdByGeschlecht = {M: [], W: [], '': []};
  _akStdData.forEach(function(s) {
    var g = s.geschlecht || '';
    if (!stdByGeschlecht[g]) stdByGeschlecht[g] = [];
    stdByGeschlecht[g].push(s);
  });

  function stdGroup(label, arr, geschlecht) {
    if (!arr.length && !geschlecht) return '';
    var chips = arr.map(function(s) {
      return '<span class="ak-std-chip" style="display:inline-flex;align-items:center;gap:5px;background:var(--surf2);' +
        'border:1px solid var(--border);border-radius:20px;padding:3px 10px 3px 12px;font-size:13px;' +
        'font-family:\'Barlow Condensed\',monospace;font-weight:600">' +
        s.ak +
        '<button onclick="akStdDelete(\'' + s.ak.replace(/\\/g,'\\\\').replace(/'/g,"\\'") + '\')" title="L\u00f6schen" ' +
        'style="background:none;border:none;cursor:pointer;color:var(--text2);padding:0;line-height:1;font-size:14px">\u00d7</button>' +
      '</span>';
    }).join(' ');
    return '<div style="margin-bottom:14px">' +
      '<div style="font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:var(--text2);margin-bottom:6px">' + label + '</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">' +
        chips +
        '<button onclick="akStdAddPrompt(\'' + geschlecht + '\')" class="btn btn-ghost btn-sm" ' +
        'style="border-radius:20px;padding:3px 10px;font-size:12px">+ Hinzuf\u00fcgen</button>' +
      '</div>' +
    '</div>';
  }

  var stdHtml =
    '<div class="panel" style="padding:24px;margin-bottom:20px">' +
      '<div class="panel-title" style="margin-bottom:4px">\ud83d\udccb Standard-Altersklassen (DLV)</div>' +
      '<div style="color:var(--text2);font-size:13px;margin-bottom:18px">Diese AKs gelten als Standard und werden in der Statistik unver\u00e4ndert angezeigt.</div>' +
      stdGroup('M\u00e4nner', stdByGeschlecht['M'] || [], 'M') +
      stdGroup('Frauen', stdByGeschlecht['W'] || [], 'W') +
      (stdByGeschlecht[''].length ? stdGroup('Sonstige', stdByGeschlecht[''], '') : '') +
    '</div>';

  // ── ABSCHNITT 2: Nicht-Standard AKs zuordnen ──────────────
  var nonStd = _akUsedData.filter(function(r) { return !r.is_standard; });

  var stdOpts = '<option value="">\u2014 nicht zuordnen \u2014</option>' +
    _akStdData.map(function(s) {
      return '<option value="' + s.ak + '">' + s.ak + '</option>';
    }).join('');

  var mapRows = '';
  if (!nonStd.length) {
    mapRows = '<tr><td colspan="4" style="padding:16px;color:var(--text2);text-align:center">' +
      '\u2705 Alle verwendeten AKs sind Standard-AKs.</td></tr>';
  } else {
    nonStd.forEach(function(row) {
      // Select mit aktuellem Wert vorausgew\u00e4hlt
      var selHtml = stdOpts.replace(
        'value="' + row.mapped_to + '"',
        'value="' + row.mapped_to + '" selected'
      );
      var auto = akAutoSuggest(row.ak);
      var hintHtml = '';
      if (row.mapped_to) {
        hintHtml = '<span style="font-size:12px;color:var(--green)">\u2192 ' + row.mapped_to + '</span>';
      } else if (auto) {
        hintHtml = '<span style="font-size:12px;color:var(--text2)">Vorschlag: <strong>' + auto + '</strong></span>';
      }
      mapRows +=
        '<tr style="border-bottom:1px solid var(--border)">' +
          '<td style="padding:8px 10px;font-family:\'Barlow Condensed\',monospace;font-weight:600;font-size:15px">' + row.ak + '</td>' +
          '<td style="padding:8px 10px;color:var(--text2);font-size:13px">' + row.anzahl + '</td>' +
          '<td style="padding:8px 10px">' +
            '<select class="ak-map-sel" data-ak="' + row.ak.replace(/"/g,'&quot;') + '" ' +
            'style="padding:4px 8px;font-size:13px;border:1px solid var(--border);border-radius:6px;' +
            'background:var(--surface);color:var(--text);min-width:120px">' + selHtml + '</select>' +
          '</td>' +
          '<td style="padding:8px 10px">' + hintHtml + '</td>' +
        '</tr>';
    });
  }

  var mapHtml =
    '<div class="panel" style="padding:24px">' +
      '<div class="panel-title" style="margin-bottom:4px">\ud83d\udd17 Nicht-Standard AKs zuordnen</div>' +
      '<div style="color:var(--text2);font-size:13px;margin-bottom:16px">' +
        'Diese AKs kommen in Ergebnissen vor, sind aber keine Standard-AKs. ' +
        'Ordne sie einer Standard-AK zu, damit sie in Bestleistungen und Statistiken korrekt zusammengefasst werden.' +
      '</div>' +
      '<table style="width:100%;border-collapse:collapse;max-width:680px">' +
        '<thead><tr style="border-bottom:2px solid var(--border)">' +
          '<th style="padding:6px 10px;text-align:left;font-size:11px;color:var(--text2);text-transform:uppercase;letter-spacing:.5px">AK im System</th>' +
          '<th style="padding:6px 10px;text-align:left;font-size:11px;color:var(--text2);text-transform:uppercase;letter-spacing:.5px">Ergebnisse</th>' +
          '<th style="padding:6px 10px;text-align:left;font-size:11px;color:var(--text2);text-transform:uppercase;letter-spacing:.5px">Wird angezeigt als</th>' +
          '<th style="padding:6px 10px;text-align:left;font-size:11px;color:var(--text2);text-transform:uppercase;letter-spacing:.5px"></th>' +
        '</tr></thead>' +
        '<tbody>' + mapRows + '</tbody>' +
      '</table>' +
      '<div style="margin-top:16px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">' +
        '<button class="btn btn-primary" onclick="akMappingSave()">\ud83d\udcbe Zuordnungen speichern</button>' +
        '<button class="btn btn-ghost" onclick="akMappingAutoFill()">\u2728 Alle Vorschl\u00e4ge \u00fcbernehmen</button>' +
        '<span id="ak-map-status" style="font-size:13px;color:var(--text2)"></span>' +
      '</div>' +
    '</div>';

  // ── ABSCHNITT 3: Jugend-AK-Merge-Konfiguration ───────────────
  // Zeigt alle Standard-AKs als Checkboxen; gecheckte werden bei
  // "Jugend-AK zu MHK/WHK zusammenfassen" zur Hauptklasse zusammengefasst.
  function jugendGroup(label, arr) {
    if (!arr.length) return '';
    return '<div style="margin-bottom:14px">' +
      '<div style="font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:var(--text2);margin-bottom:8px">' + label + '</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:8px">' +
      arr.map(function(s) {
        var checked = _jugendAksCurrent.indexOf(s.ak) !== -1 ? ' checked' : '';
        return '<label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;' +
          'background:var(--surf2);border:1px solid var(--border);border-radius:20px;' +
          'padding:4px 12px;font-size:13px;font-family:\'Barlow Condensed\',monospace;font-weight:600">' +
          '<input type="checkbox" class="ak-jugend-cb" data-ak="' + s.ak.replace(/"/g,'&quot;') + '"' + checked +
          ' style="width:13px;height:13px;accent-color:var(--btn-bg);cursor:pointer">' +
          s.ak + '</label>';
      }).join('') +
      '</div></div>';
  }

  var jugendHtml =
    '<div class="panel" style="padding:24px;margin-bottom:20px">' +
      '<div class="panel-title" style="margin-bottom:4px">&#x1F9EC; Jugend-AK-Merge-Konfiguration</div>' +
      '<div style="color:var(--text2);font-size:13px;margin-bottom:16px">' +
        'Welche Standard-AKs sollen bei \u201eJugend-AK zu MHK/WHK zusammenfassen\u201c einbezogen werden? ' +
        'Gew\u00e4hlte AKs werden in Bestleistungen und Statistiken zur Hauptklasse (MHK/WHK) zusammengefasst.' +
      '</div>' +
      jugendGroup('M\u00e4nner', (_akStdData).filter(function(s){ return s.geschlecht === 'M'; })) +
      jugendGroup('Frauen',   (_akStdData).filter(function(s){ return s.geschlecht === 'W'; })) +
      ((_akStdData).filter(function(s){ return !s.geschlecht; }).length
        ? jugendGroup('Sonstige', (_akStdData).filter(function(s){ return !s.geschlecht; })) : '') +
      '<div style="margin-top:16px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">' +
        '<button class="btn btn-primary" onclick="akJugendSave()">\ud83d\udcbe Konfiguration speichern</button>' +
        '<button class="btn btn-ghost" onclick="akJugendSelectAll(true)">Alle</button>' +
        '<button class="btn btn-ghost" onclick="akJugendSelectAll(false)">Keine</button>' +
        '<span id="ak-jugend-status" style="font-size:13px;color:var(--text2)"></span>' +
      '</div>' +
    '</div>';

  el.innerHTML = adminSubtabs() + stdHtml + mapHtml + jugendHtml;
}

// Auto-Vorschlag f\u00fcr Nicht-Standard AKs
function akAutoSuggest(ak) {
  if (!ak) return '';
  var s = ak.trim();
  if (s === 'M' || s === 'mJB' || s === 'mjA' || s === 'mjB') return 'MHK';
  if (s === 'W' || s === 'F' || s === 'wjA' || s === 'wjB') return 'WHK';
  // MJU20 \u2192 MU20, WJU18 \u2192 WU18
  var mj = s.match(/^([MW])JU(\d{2})$/i);
  if (mj) return mj[1].toUpperCase() + 'U' + mj[2];
  // MU10-12 \u2192 MU10
  var rng = s.match(/^([MW]U?)(\d{1,2})-?U?\d{0,2}$/i);
  if (rng) return rng[1].toUpperCase() + rng[2];
  // M45+ \u2192 M45
  var mp = s.match(/^([MW]\d{2})\+.*$/);
  if (mp) return mp[1];
  // U18 (ohne Geschlecht) \u2192 schwer
  return '';
}

async function akStdAddPrompt(geschlecht) {
  var ak = prompt('Neue Standard-AK' + (geschlecht ? ' (' + geschlecht + ')' : '') + ':');
  if (!ak) return;
  ak = ak.trim().toUpperCase();
  if (!ak) return;
  var r = await apiPost('ak-standard', { ak: ak, geschlecht: geschlecht, reihenfolge: 99 });
  if (r && r.ok) { notify('Standard-AK "' + ak + '" hinzugef\u00fcgt.', 'ok'); renderAdminAltersklassen(); }
  else notify('Fehler: ' + (r && r.fehler ? r.fehler : 'unbekannt'), 'err');
}

async function akStdDelete(ak) {
  if (!confirm('Standard-AK "' + ak + '" l\u00f6schen? Zugeh\u00f6rige Zuordnungen werden ebenfalls entfernt.')) return;
  var r = await apiDel('ak-standard/' + encodeURIComponent(ak));
  if (r && r.ok) { notify('"' + ak + '" gel\u00f6scht.', 'ok'); renderAdminAltersklassen(); }
  else notify('Fehler', 'err');
}

function akMappingAutoFill() {
  document.querySelectorAll('.ak-map-sel').forEach(function(sel) {
    if (!sel.value) {
      var auto = akAutoSuggest(sel.dataset.ak);
      if (auto) sel.value = auto;
    }
  });
}

async function akMappingSave() {
  var st = document.getElementById('ak-map-status');
  if (st) st.textContent = '\u23f3 Speichere\u2026';
  var mappings = [];
  document.querySelectorAll('.ak-map-sel').forEach(function(sel) {
    mappings.push({ ak_roh: sel.dataset.ak, ak_standard: sel.value || '' });
  });
  var r = await apiPost('ak-mapping', { mappings: mappings });
  if (r && r.ok) {
    if (st) st.textContent = '\u2705 Gespeichert';
    setTimeout(function() { if (st) st.textContent = ''; }, 3000);
    notify('Zuordnungen gespeichert.', 'ok');
    renderAdminAltersklassen();
  } else {
    if (st) st.textContent = '\u274c Fehler';
    notify('Fehler beim Speichern', 'err');
  }
}
async function akJugendSave() {
  var st = document.getElementById('ak-jugend-status');
  if (st) st.textContent = '\u23f3 Speichere\u2026';
  var checked = [];
  document.querySelectorAll('.ak-jugend-cb').forEach(function(cb) {
    if (cb.checked) checked.push(cb.dataset.ak);
  });
  var r = await apiPost('einstellungen', { jugend_aks: JSON.stringify(checked) });
  if (r && r.ok) {
    if (st) st.textContent = '\u2705 Gespeichert';
    setTimeout(function() { if (st) st.textContent = ''; }, 3000);
    notify('Jugend-AK-Konfiguration gespeichert.', 'ok');
  } else {
    if (st) st.textContent = '\u274c Fehler';
    notify('Fehler beim Speichern', 'err');
  }
}

function akJugendSelectAll(val) {
  document.querySelectorAll('.ak-jugend-cb').forEach(function(cb) { cb.checked = val; });
}
