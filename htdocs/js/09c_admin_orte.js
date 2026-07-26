// ── Admin: Orte-Verwaltung ────────────────────────────────────────────────
var _orteCache = [];
var _orteFilter = '';
var _orteNominatimTimer = null;

function _ortEsc(s) {
  return (s == null ? '' : String(s))
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

async function renderAdminOrte() {
  var el = document.getElementById('main-content');
  el.innerHTML = adminSubtabs() + '<div class="loading"><div class="spinner"></div>Laden&hellip;</div>';
  var r = await apiGet('orte?limit=500');
  if (!r || !r.ok) {
    el.innerHTML = adminSubtabs() + '<div class="panel" style="padding:24px;color:var(--accent)">Fehler beim Laden.</div>';
    return;
  }
  _orteCache = r.data || [];
  el.innerHTML = adminSubtabs() + _renderOrteUI();
}

function _renderOrteUI() {
  return (
    '<div class="panel" style="padding:0">' +
      '<div class="panel-header" style="padding:14px 16px;display:flex;gap:12px;align-items:center;flex-wrap:wrap">' +
        '<div class="panel-title" style="margin:0">&#x1F4CD; Orte</div>' +
        '<input type="text" placeholder="Suchen…" value="' + _ortEsc(_orteFilter) + '" oninput="_orteFilter=this.value;document.getElementById(\'orte-tbody-wrap\').innerHTML=_renderOrteTableInner()" style="flex:1;min-width:160px;max-width:280px;padding:7px 10px;border:1px solid var(--border);border-radius:7px;background:var(--surface);color:var(--text)"/>' +
        '<div style="flex:1"></div>' +
        '<button class="btn btn-ghost btn-sm" onclick="_orteImportFromVeranstaltungen()" title="Bestehende Veranstaltungs-Orte als Orte-Einträge importieren">&#x1F4E5; Aus Veranstaltungen importieren</button>' +
        '<button class="btn btn-ghost btn-sm" onclick="_orteEnrichAll()" title="Alle Orte ohne Koordinaten via OpenStreetMap anreichern">&#x1F30D; Alle anreichern</button>' +
        '<button class="btn btn-primary btn-sm" onclick="_ortAdd()">+ Neuer Ort</button>' +
      '</div>' +
      '<div id="orte-tbody-wrap">' + _renderOrteTableInner() + '</div>' +
    '</div>'
  );
}

function _renderOrteTableInner(prebuiltRows) {
  if (typeof prebuiltRows !== 'string') {
    var f = (_orteFilter || '').toLowerCase();
    var filtered = _orteCache.filter(function(o) {
      if (!f) return true;
      var hay = (o.name || '') + ' ' + (o.region || '') + ' ' + (o.land || '') + ' ' + (o.land_code || '') +
                ' ' + (o.aliase || []).join(' ');
      return hay.toLowerCase().indexOf(f) >= 0;
    });
    filtered.sort(function(a, b) { return (a.name || '').localeCompare(b.name || ''); });
    prebuiltRows = '';
    if (!filtered.length) {
      prebuiltRows = '<tr><td colspan="5" style="padding:18px;text-align:center;color:var(--text2)">Keine Orte gefunden.</td></tr>';
    } else {
      for (var i = 0; i < filtered.length; i++) {
        var o = filtered[i];
        var flag = flagEmoji(o.land_code);
        var sub = [];
        if (o.region) sub.push(_ortEsc(o.region));
        if (o.land) sub.push(_ortEsc(o.land));
        var subTxt = sub.length ? '<div style="font-size:11px;color:var(--text2)">' + sub.join(' · ') + '</div>' : '';
        var aliasTxt = (o.aliase && o.aliase.length)
          ? '<div style="font-size:11px;color:var(--text2)" title="Aliase f&uuml;r den Bulk-Import">&#x21B3; ' + _ortEsc(o.aliase.join(', ')) + '</div>'
          : '';
        var coords = (o.lat != null && o.lon != null)
          ? '<a href="https://www.openstreetmap.org/?mlat=' + o.lat + '&mlon=' + o.lon + '#map=12/' + o.lat + '/' + o.lon + '" target="_blank" rel="noopener" style="font-size:12px;color:var(--text2)">' + (Number(o.lat).toFixed(3)) + ', ' + (Number(o.lon).toFixed(3)) + '</a>'
          : '<span style="color:var(--text2);font-size:12px">—</span>';
        prebuiltRows +=
          '<tr>' +
            '<td style="padding:8px 10px;font-size:18px;text-align:center">' + (flag || '') + '</td>' +
            '<td style="padding:8px 10px"><div style="font-weight:600">' + _ortEsc(o.name) + '</div>' + subTxt + aliasTxt + '</td>' +
            '<td style="padding:8px 10px">' + coords + '</td>' +
            '<td style="padding:8px 10px;text-align:right;color:var(--text2);font-variant-numeric:tabular-nums">' + (o.anz_veranstaltungen || 0) + '</td>' +
            '<td style="padding:8px 10px;text-align:right;white-space:nowrap">' +
              '<button class="btn btn-ghost btn-sm" title="Bearbeiten" onclick="_ortEdit(' + o.id + ')">&#x270F;&#xFE0F;</button> ' +
              '<button class="btn btn-ghost btn-sm" title="Zusammenführen" onclick="_ortMerge(' + o.id + ')">&#x1F517;</button> ' +
              '<button class="btn btn-danger btn-sm" title="Löschen" onclick="_ortDelete(' + o.id + ')">&#x1F5D1;&#xFE0F;</button>' +
            '</td>' +
          '</tr>';
      }
    }
  }
  return (
    '<div class="table-scroll"><table class="data-table" style="width:100%;border-collapse:collapse">' +
      '<thead><tr>' +
        '<th style="width:50px;text-align:center">Land</th>' +
        '<th style="text-align:left;padding:8px 10px">Name</th>' +
        '<th style="text-align:left;padding:8px 10px;width:200px">Koordinaten</th>' +
        '<th style="text-align:right;padding:8px 10px;width:90px">Veranst.</th>' +
        '<th style="text-align:right;padding:8px 10px;width:160px"></th>' +
      '</tr></thead>' +
      '<tbody>' + prebuiltRows + '</tbody>' +
    '</table></div>'
  );
}

function _ortFormHtml(o) {
  o = o || {};
  return (
    '<div class="form-grid">' +
      '<div class="form-group full">' +
        '<label>Suche (OpenStreetMap)</label>' +
        '<input type="text" id="ort-nom-q" placeholder="z.B. Düsseldorf, Venlo, Brüssel…" oninput="_ortNominatim(this.value)" autocomplete="off"/>' +
        '<div id="ort-nom-results" style="margin-top:6px;max-height:220px;overflow:auto;border:1px solid var(--border);border-radius:7px;display:none"></div>' +
      '</div>' +
      '<div class="form-group full"><label>Name *</label><input type="text" id="ort-name" value="' + _ortEsc(o.name || '') + '"/></div>' +
      '<div class="form-group full">' +
        '<label>Aliase <span style="font-weight:400;color:var(--text2);font-size:11px">(eine Schreibweise pro Zeile – beim Bulk-Import gefundene Orte werden diesem Ort zugeordnet)</span></label>' +
        '<textarea id="ort-aliase" rows="3" placeholder="z.B. Grefrath" style="width:100%;padding:9px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text);font-family:inherit;font-size:13px">' + _ortEsc((o.aliase || []).join('\n')) + '</textarea>' +
      '</div>' +
      '<div class="form-group"><label>Region/Bundesland</label><input type="text" id="ort-region" value="' + _ortEsc(o.region || '') + '"/></div>' +
      '<div class="form-group"><label>Land</label><input type="text" id="ort-land" value="' + _ortEsc(o.land || '') + '"/></div>' +
      '<div class="form-group"><label>ISO-Code (2)</label><input type="text" id="ort-landcode" maxlength="2" style="text-transform:uppercase" value="' + _ortEsc(o.land_code || '') + '"/></div>' +
      '<div class="form-group"><label>Flagge</label><div id="ort-flag-preview" style="font-size:24px;padding:6px 0">' + (flagEmoji(o.land_code) || '<span style="color:var(--text2);font-size:13px">—</span>') + '</div></div>' +
      '<div class="form-group"><label>Latitude</label><input type="text" id="ort-lat" oninput="_ortLatLonInput()" value="' + (o.lat != null ? o.lat : '') + '"/></div>' +
      '<div class="form-group"><label>Longitude</label><input type="text" id="ort-lon" oninput="_ortLatLonInput()" value="' + (o.lon != null ? o.lon : '') + '"/></div>' +
      '<input type="hidden" id="ort-osmid" value="' + _ortEsc(o.osm_id || '') + '"/>' +
      '<input type="hidden" id="ort-osmtyp" value="' + _ortEsc(o.osm_typ || '') + '"/>' +
      '<input type="hidden" id="ort-display" value="' + _ortEsc(o.display_name || '') + '"/>' +
      '<div class="form-group full"><label>Karte <span style="font-weight:400;color:var(--text2);font-size:11px">(Klick = Pin setzen, Pin verschiebbar)</span></label>' +
        '<div id="ort-map" style="height:240px;border:1px solid var(--border);border-radius:7px;overflow:hidden;background:var(--surf2)"></div>' +
      '</div>' +
    '</div>'
  );
}

function _ortAdd() {
  showModal(
    modalH2('&#x1F4CD; Neuer Ort') +
    _ortFormHtml({}) +
    '<div class="modal-actions">' +
      '<button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button>' +
      '<button class="btn btn-primary" onclick="_ortSave(0)">Anlegen</button>' +
    '</div>',
    true, true
  );
  setTimeout(function() {
    var i = document.getElementById('ort-nom-q'); if (i) i.focus();
    var lc = document.getElementById('ort-landcode');
    if (lc) lc.addEventListener('input', _ortFlagPreview);
    _ortInitMap(null, null);
  }, 80);
}

function _ortEdit(id) {
  var o = null;
  for (var i = 0; i < _orteCache.length; i++) if (_orteCache[i].id == id) { o = _orteCache[i]; break; }
  if (!o) return;
  showModal(
    modalH2('&#x270F;&#xFE0F; Ort bearbeiten') +
    _ortFormHtml(o) +
    '<div class="modal-actions">' +
      '<button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button>' +
      '<button class="btn btn-primary" onclick="_ortSave(' + id + ')">Speichern</button>' +
    '</div>',
    true, true
  );
  setTimeout(function() {
    var lc = document.getElementById('ort-landcode');
    if (lc) lc.addEventListener('input', _ortFlagPreview);
    _ortInitMap(o.lat, o.lon);
  }, 80);
}

function _ortFlagPreview() {
  var lc = (document.getElementById('ort-landcode').value || '').toUpperCase();
  document.getElementById('ort-landcode').value = lc;
  var fp = document.getElementById('ort-flag-preview');
  if (fp) fp.innerHTML = flagEmoji(lc) || '<span style="color:var(--text2);font-size:13px">—</span>';
}

function _ortNominatim(q) {
  clearTimeout(_orteNominatimTimer);
  var box = document.getElementById('ort-nom-results');
  if (!q || q.length < 2) { if (box) { box.style.display = 'none'; box.innerHTML = ''; } return; }
  _orteNominatimTimer = setTimeout(async function() {
    if (box) box.innerHTML = '<div style="padding:8px;color:var(--text2);font-size:12px">Suche…</div>';
    if (box) box.style.display = 'block';
    var r = await apiGet('orte/nominatim?q=' + encodeURIComponent(q));
    if (!box) return;
    if (!r || !r.ok) {
      var msg = (r && r.fehler) ? r.fehler : 'Nominatim nicht erreichbar.';
      box.innerHTML = '<div style="padding:8px;color:var(--accent);font-size:12px">' + _ortEsc(msg) + '</div>';
      return;
    }
    var list = r.data || [];
    if (!list.length) { box.innerHTML = '<div style="padding:8px;color:var(--text2);font-size:12px">Keine Treffer.</div>'; return; }
    var html = '';
    for (var i = 0; i < list.length; i++) {
      var d = list[i];
      var fl = flagEmoji(d.land_code);
      html +=
        '<div onclick="_ortNominatimPick(' + i + ')" style="padding:8px 10px;cursor:pointer;border-bottom:1px solid var(--border)" onmouseover="this.style.background=\'var(--surf2)\'" onmouseout="this.style.background=\'transparent\'">' +
          '<div style="font-weight:600">' + (fl ? fl + ' ' : '') + _ortEsc(d.name || '') + '</div>' +
          '<div style="font-size:11px;color:var(--text2)">' + _ortEsc(d.display_name || '') + '</div>' +
        '</div>';
    }
    box.innerHTML = html;
    window._ortNominatimList = list;
  }, 350);
}

function _ortNominatimPick(idx) {
  var list = window._ortNominatimList || [];
  var d = list[idx];
  if (!d) return;
  document.getElementById('ort-name').value = d.name || '';
  document.getElementById('ort-region').value = d.region || '';
  document.getElementById('ort-land').value = d.land || '';
  document.getElementById('ort-landcode').value = (d.land_code || '').toUpperCase();
  document.getElementById('ort-lat').value = d.lat != null ? d.lat : '';
  document.getElementById('ort-lon').value = d.lon != null ? d.lon : '';
  document.getElementById('ort-osmid').value = d.osm_id || '';
  document.getElementById('ort-osmtyp').value = d.osm_typ || '';
  document.getElementById('ort-display').value = d.display_name || '';
  _ortFlagPreview();
  if (d.lat != null && d.lon != null) _ortMapSetMarker(parseFloat(d.lat), parseFloat(d.lon), 12);
  var box = document.getElementById('ort-nom-results');
  if (box) { box.style.display = 'none'; box.innerHTML = ''; }
}

async function _ortSave(id) {
  var body = {
    name:         (document.getElementById('ort-name').value || '').trim(),
    region:       (document.getElementById('ort-region').value || '').trim(),
    land:         (document.getElementById('ort-land').value || '').trim(),
    land_code:    (document.getElementById('ort-landcode').value || '').trim().toUpperCase(),
    lat:          (document.getElementById('ort-lat').value || '').trim(),
    lon:          (document.getElementById('ort-lon').value || '').trim(),
    osm_id:       (document.getElementById('ort-osmid').value || '').trim(),
    osm_typ:      (document.getElementById('ort-osmtyp').value || '').trim(),
    display_name: (document.getElementById('ort-display').value || '').trim(),
    aliase:       ((document.getElementById('ort-aliase') || {}).value || '')
                    .split(/[\r\n,;]+/)
                    .map(function(s) { return s.trim(); })
                    .filter(function(s) { return !!s; }),
  };
  if (!body.name) { notify('Name erforderlich.', 'err'); return; }
  var r = id ? await apiPut('orte/' + id, body) : await apiPost('orte', body);
  if (r && r.ok) {
    closeModal();
    notify(id ? 'Gespeichert.' : 'Angelegt.', 'ok');
    await renderAdminOrte();
  } else {
    notify((r && r.fehler) || 'Fehler', 'err');
  }
}

async function _ortDelete(id) {
  var o = null;
  for (var i = 0; i < _orteCache.length; i++) if (_orteCache[i].id == id) { o = _orteCache[i]; break; }
  if (!o) return;
  var anz = parseInt(o.anz_veranstaltungen || 0, 10);
  if (anz > 0) {
    if (!await confirmModal('Ort "' + o.name + '" wird von ' + anz + ' Veranstaltung(en) verwendet. Trotzdem löschen?\n\nDie Veranstaltungen behalten den Freitext-Ort, verlieren aber Geo-Daten.')) return;
    var r = await apiDel('orte/' + id + '?force=1');
  } else {
    if (!await confirmModal('Ort "' + o.name + '" löschen?')) return;
    var r = await apiDel('orte/' + id);
  }
  if (r && r.ok) { notify('Gelöscht.', 'ok'); await renderAdminOrte(); }
  else notify((r && r.fehler) || 'Fehler', 'err');
}

function _ortMerge(id) {
  var o = null;
  for (var i = 0; i < _orteCache.length; i++) if (_orteCache[i].id == id) { o = _orteCache[i]; break; }
  if (!o) return;
  var opts = '<option value="">— Ziel-Ort wählen —</option>';
  var sorted = _orteCache.slice().sort(function(a,b){ return (a.name||'').localeCompare(b.name||''); });
  for (var i = 0; i < sorted.length; i++) {
    if (sorted[i].id == id) continue;
    var label = sorted[i].name + (sorted[i].land_code ? ' (' + sorted[i].land_code + ')' : '');
    opts += '<option value="' + sorted[i].id + '">' + _ortEsc(label) + '</option>';
  }
  showModal(
    modalH2('&#x1F517; Ort zusammenführen') +
    '<p style="margin:0 0 12px;font-size:13px">Alle Veranstaltungen von <b>' + _ortEsc(o.name) + '</b> werden auf den ausgewählten Ziel-Ort umgehängt. Anschließend wird "' + _ortEsc(o.name) + '" gelöscht.</p>' +
    '<div class="form-group full"><label>Ziel-Ort</label><select id="ort-merge-ziel">' + opts + '</select></div>' +
    '<div class="modal-actions">' +
      '<button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button>' +
      '<button class="btn btn-primary" onclick="_ortMergeDo(' + id + ')">Zusammenführen</button>' +
    '</div>'
  );
}

async function _ortMergeDo(id) {
  var ziel = parseInt(document.getElementById('ort-merge-ziel').value, 10);
  if (!ziel) { notify('Bitte Ziel-Ort wählen.', 'err'); return; }
  var r = await apiPost('orte/' + id, { action: 'merge', ziel_id: ziel });
  if (r && r.ok) { closeModal(); notify('Zusammengeführt.', 'ok'); await renderAdminOrte(); }
  else notify((r && r.fehler) || 'Fehler', 'err');
}

async function _orteImportFromVeranstaltungen() {
  if (!await confirmModal('Bestehende Veranstaltungs-Orte (Freitext) als Orte-Einträge importieren? Dies betrifft nur Veranstaltungen, denen noch kein Ort zugeordnet ist.')) return;
  var r = await apiPost('orte/import-from-veranstaltungen', {});
  if (r && r.ok) {
    notify('Import: ' + (r.data.angelegt || 0) + ' neu angelegt, ' + (r.data.verknuepft || 0) + ' Veranstaltungen verknüpft.', 'ok');
    await renderAdminOrte();
  } else {
    notify((r && r.fehler) || 'Fehler', 'err');
  }
}

// ── Wiederverwendbarer Ort-Picker (für Veranstaltungs-Edit-Formulare) ─────
// Erzeugt ein Input mit Autocomplete aus _orteCache. Aufrufer muss zuvor
// `await ortePickerLoad()` aufrufen, damit der Cache befüllt ist.
async function ortePickerLoad() {
  if (_orteCache && _orteCache.length) return;
  var r = await apiGet('orte?limit=500');
  if (r && r.ok) _orteCache = r.data || [];
}

function ortePickerHtml(opts) {
  opts = opts || {};
  var inputId    = opts.inputId    || 'ort-picker-name';
  var hiddenId   = opts.hiddenId   || 'ort-picker-id';
  var valueOrtId = opts.ortId      || '';
  var valueText  = opts.text       || '';
  return (
    '<div style="position:relative">' +
      '<input type="hidden" id="' + hiddenId + '" value="' + _ortEsc(valueOrtId) + '"/>' +
      '<input type="text" id="' + inputId + '" value="' + _ortEsc(valueText) + '" autocomplete="off" placeholder="Ort suchen…" oninput="_ortePickerSearch(\'' + inputId + '\',\'' + hiddenId + '\',this.value)" onfocus="_ortePickerSearch(\'' + inputId + '\',\'' + hiddenId + '\',this.value)" onblur="setTimeout(function(){var b=document.getElementById(\'' + inputId + '-drop\');if(b)b.style.display=\'none\'},200)" style="width:100%"/>' +
      '<div id="' + inputId + '-drop" style="display:none;position:absolute;top:100%;left:0;right:0;z-index:100;max-height:240px;overflow:auto;background:var(--surface);border:1px solid var(--border);border-radius:7px;box-shadow:0 4px 12px rgba(0,0,0,.12)"></div>' +
    '</div>'
  );
}

function _ortePickerSearch(inputId, hiddenId, q) {
  var box = document.getElementById(inputId + '-drop');
  if (!box) return;
  var ql = (q || '').toLowerCase().trim();
  var hits = _orteCache.filter(function(o) {
    if (!ql) return true;
    return ((o.name || '') + ' ' + (o.region || '') + ' ' + (o.land || '') + ' ' + (o.aliase || []).join(' '))
             .toLowerCase().indexOf(ql) >= 0;
  });
  hits.sort(function(a, b) { return (a.name || '').localeCompare(b.name || ''); });
  hits = hits.slice(0, 50);
  var html = '';
  for (var i = 0; i < hits.length; i++) {
    var o = hits[i];
    var fl = flagEmoji(o.land_code);
    var sub = [o.region, o.land].filter(Boolean).join(' · ');
    html +=
      '<div onmousedown="_ortePickerPick(\'' + inputId + '\',\'' + hiddenId + '\',' + o.id + ')" style="padding:7px 10px;cursor:pointer;border-bottom:1px solid var(--border)" onmouseover="this.style.background=\'var(--surf2)\'" onmouseout="this.style.background=\'transparent\'">' +
        '<div>' + (fl ? fl + ' ' : '') + _ortEsc(o.name) + '</div>' +
        (sub ? '<div style="font-size:11px;color:var(--text2)">' + _ortEsc(sub) + '</div>' : '') +
      '</div>';
  }
  html +=
    '<div onmousedown="_ortePickerNew(\'' + inputId + '\',\'' + hiddenId + '\')" style="padding:8px 10px;cursor:pointer;color:var(--primary);font-weight:600;background:var(--surf2)">' +
      '+ Neuer Ort…' +
    '</div>';
  box.innerHTML = html;
  box.style.display = 'block';
}

function _ortePickerPick(inputId, hiddenId, ortId) {
  var o = null;
  for (var i = 0; i < _orteCache.length; i++) if (_orteCache[i].id == ortId) { o = _orteCache[i]; break; }
  if (!o) return;
  var inp = document.getElementById(inputId);
  var hid = document.getElementById(hiddenId);
  if (inp) inp.value = o.name + (o.land_code ? ' (' + o.land_code + ')' : '');
  if (hid) hid.value = o.id;
  var box = document.getElementById(inputId + '-drop');
  if (box) box.style.display = 'none';
}

function _ortePickerNew(inputId, hiddenId) {
  var initial = (document.getElementById(inputId).value || '').trim();
  showModal(
    modalH2('&#x1F4CD; Neuer Ort') +
    _ortFormHtml({ name: initial }) +
    '<div class="modal-actions">' +
      '<button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button>' +
      '<button class="btn btn-primary" onclick="_ortePickerNewSave(\'' + inputId + '\',\'' + hiddenId + '\')">Anlegen &amp; übernehmen</button>' +
    '</div>',
    true, true
  );
  setTimeout(function() {
    var nq = document.getElementById('ort-nom-q');
    if (nq) { nq.value = initial; if (initial) _ortNominatim(initial); nq.focus(); }
    var lc = document.getElementById('ort-landcode');
    if (lc) lc.addEventListener('input', _ortFlagPreview);
    _ortInitMap(null, null);
  }, 80);
}

async function _ortePickerNewSave(inputId, hiddenId) {
  var body = {
    name:         (document.getElementById('ort-name').value || '').trim(),
    region:       (document.getElementById('ort-region').value || '').trim(),
    land:         (document.getElementById('ort-land').value || '').trim(),
    land_code:    (document.getElementById('ort-landcode').value || '').trim().toUpperCase(),
    lat:          (document.getElementById('ort-lat').value || '').trim(),
    lon:          (document.getElementById('ort-lon').value || '').trim(),
    osm_id:       (document.getElementById('ort-osmid').value || '').trim(),
    osm_typ:      (document.getElementById('ort-osmtyp').value || '').trim(),
    display_name: (document.getElementById('ort-display').value || '').trim(),
    aliase:       ((document.getElementById('ort-aliase') || {}).value || '')
                    .split(/[\r\n,;]+/)
                    .map(function(s) { return s.trim(); })
                    .filter(function(s) { return !!s; }),
  };
  if (!body.name) { notify('Name erforderlich.', 'err'); return; }
  var r = await apiPost('orte', body);
  if (!r || !r.ok) { notify((r && r.fehler) || 'Fehler', 'err'); return; }
  var newOrt = r.data;
  _orteCache.push(newOrt);
  closeModal();
  _ortePickerPick(inputId, hiddenId, newOrt.id);
}

// ── Karte (Leaflet) ─────────────────────────────────────────────────────────
function _ortEnsureLeaflet() {
  return new Promise(function(resolve) {
    if (window.L) { resolve(); return; }
    if (!document.getElementById('leaflet-css')) {
      var link = document.createElement('link');
      link.id = 'leaflet-css'; link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
    if (document.getElementById('leaflet-js')) {
      var iv = setInterval(function() { if (window.L) { clearInterval(iv); resolve(); } }, 50);
      return;
    }
    var s = document.createElement('script');
    s.id = 'leaflet-js';
    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.onload = function() { resolve(); };
    s.onerror = function() { resolve(); };
    document.head.appendChild(s);
  });
}

async function _ortInitMap(initialLat, initialLon) {
  await _ortEnsureLeaflet();
  if (!window.L) return;
  var el = document.getElementById('ort-map');
  if (!el) return;
  if (window._ortMap) {
    try { window._ortMap.remove(); } catch (e) {}
    window._ortMap = null;
    window._ortMapMarker = null;
  }
  var lat = parseFloat(initialLat);
  var lon = parseFloat(initialLon);
  var hasCoords = !isNaN(lat) && !isNaN(lon);
  var map = L.map(el, { scrollWheelZoom: false }).setView(
    hasCoords ? [lat, lon] : [51.0, 10.0],
    hasCoords ? 11 : 4
  );
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap',
    maxZoom: 19,
  }).addTo(map);
  window._ortMap = map;
  window._ortMapMarker = null;
  if (hasCoords) _ortMapAddMarker(lat, lon);
  map.on('click', function(e) {
    var p = e.latlng;
    document.getElementById('ort-lat').value = p.lat.toFixed(6);
    document.getElementById('ort-lon').value = p.lng.toFixed(6);
    _ortMapSetMarker(p.lat, p.lng, null);
  });
  // Reverse-Geocoding-Hinweis: scroll-to-zoom only after click
  map.on('focus', function() { map.scrollWheelZoom.enable(); });
  map.on('blur',  function() { map.scrollWheelZoom.disable(); });
  setTimeout(function() { try { map.invalidateSize(); } catch (e) {} }, 120);
}

function _ortMapAddMarker(lat, lon) {
  if (!window._ortMap || !window.L) return;
  var marker = L.marker([lat, lon], { draggable: true }).addTo(window._ortMap);
  marker.on('dragend', function(e) {
    var p = e.target.getLatLng();
    document.getElementById('ort-lat').value = p.lat.toFixed(6);
    document.getElementById('ort-lon').value = p.lng.toFixed(6);
  });
  window._ortMapMarker = marker;
}

function _ortMapSetMarker(lat, lon, zoom) {
  if (!window._ortMap || !window.L) return;
  if (window._ortMapMarker) {
    window._ortMapMarker.setLatLng([lat, lon]);
  } else {
    _ortMapAddMarker(lat, lon);
  }
  var z = zoom != null ? zoom : Math.max(window._ortMap.getZoom(), 11);
  window._ortMap.setView([lat, lon], z);
}

function _ortLatLonInput() {
  var lat = parseFloat(document.getElementById('ort-lat').value);
  var lon = parseFloat(document.getElementById('ort-lon').value);
  if (isNaN(lat) || isNaN(lon)) return;
  _ortMapSetMarker(lat, lon, null);
}

// ── Bulk-Anreicherung via Nominatim (clientseitig, 1 req/s) ─────────────────
var _orteEnrichCancel = false;

async function _orteEnrichAll() {
  // Nur Orte ohne Koordinaten verarbeiten
  var todo = _orteCache.filter(function(o) { return o.lat == null || o.lon == null; });
  if (!todo.length) {
    notify('Alle Orte haben bereits Koordinaten.', 'ok');
    return;
  }
  var estSec = Math.ceil(todo.length * 1.1);
  var estMin = Math.ceil(estSec / 60);
  if (!await confirmModal(todo.length + ' Ort(e) ohne Koordinaten gefunden.\n\nAlle via OpenStreetMap-Nominatim anreichern? Dauert ca. ' + (estMin > 1 ? estMin + ' Min.' : estSec + ' Sek.') + ' (1 Anfrage pro Sekunde gemäß OSM-Richtlinien).')) return;

  _orteEnrichCancel = false;
  showModal(
    modalH2('&#x1F30D; Orte anreichern') +
    '<div id="enrich-status" style="font-size:13px;line-height:1.6">' +
      '<div id="enrich-progress-text">Starte&hellip;</div>' +
      '<div style="background:var(--surf2);border-radius:8px;height:10px;margin:10px 0;overflow:hidden">' +
        '<div id="enrich-bar" style="background:var(--primary);height:100%;width:0%;transition:width .25s"></div>' +
      '</div>' +
      '<div id="enrich-log" style="max-height:240px;overflow:auto;font-size:12px;font-family:monospace;background:var(--surf2);border:1px solid var(--border);border-radius:7px;padding:8px;margin-top:8px"></div>' +
    '</div>' +
    '<div class="modal-actions">' +
      '<button class="btn btn-ghost" onclick="_orteEnrichStop()">Abbrechen</button>' +
      '<button id="enrich-close-btn" class="btn btn-primary" onclick="closeModal();renderAdminOrte()" style="display:none">Fertig</button>' +
    '</div>',
    false, true
  );

  var ok = 0, miss = 0, err = 0;
  var bar = function() { return document.getElementById('enrich-bar'); };
  var txt = function() { return document.getElementById('enrich-progress-text'); };
  var log = function() { return document.getElementById('enrich-log'); };
  var addLog = function(html) {
    var l = log(); if (!l) return;
    l.innerHTML += html + '<br>';
    l.scrollTop = l.scrollHeight;
  };

  for (var i = 0; i < todo.length; i++) {
    if (_orteEnrichCancel) break;
    var o = todo[i];
    var pct = Math.round((i / todo.length) * 100);
    if (bar()) bar().style.width = pct + '%';
    if (txt()) txt().textContent = (i + 1) + ' / ' + todo.length + ' – ' + o.name;

    var query = o.name;
    if (o.region) query += ', ' + o.region;
    if (o.land) query += ', ' + o.land;

    try {
      var r = await apiGet('orte/nominatim?q=' + encodeURIComponent(query));
      if (!r || !r.ok) {
        err++;
        addLog('<span style="color:var(--accent)">✗ ' + _ortEsc(o.name) + ' – ' + _ortEsc((r && r.fehler) || 'Fehler') + '</span>');
      } else {
        var hits = r.data || [];
        if (!hits.length) {
          miss++;
          addLog('<span style="color:var(--text2)">⚠ ' + _ortEsc(o.name) + ' – kein Treffer</span>');
        } else {
          var d = hits[0];
          var upd = {
            land:         d.land || null,
            land_code:    d.land_code || null,
            lat:          d.lat,
            lon:          d.lon,
            osm_id:       d.osm_id || null,
            osm_typ:      d.osm_typ || null,
            display_name: d.display_name || null,
          };
          // Region nur setzen wenn noch keine
          if (!o.region && d.region) upd.region = d.region;
          var u = await apiPut('orte/' + o.id, upd);
          if (u && u.ok) {
            ok++;
            // Cache aktualisieren
            for (var c = 0; c < _orteCache.length; c++) {
              if (_orteCache[c].id === o.id) {
                Object.assign(_orteCache[c], u.data);
                break;
              }
            }
            var fl = flagEmoji(d.land_code);
            addLog('<span style="color:var(--ok,#3a8)">✓ ' + (fl ? fl + ' ' : '') + _ortEsc(o.name) + ' → ' + _ortEsc(d.display_name || '') + '</span>');
          } else {
            err++;
            addLog('<span style="color:var(--accent)">✗ ' + _ortEsc(o.name) + ' – Speichern fehlgeschlagen</span>');
          }
        }
      }
    } catch (e) {
      err++;
      addLog('<span style="color:var(--accent)">✗ ' + _ortEsc(o.name) + ' – ' + _ortEsc(e.message || 'Exception') + '</span>');
    }

    // Rate Limit: 1 Anfrage pro Sekunde (OSM-Richtlinie)
    if (i < todo.length - 1 && !_orteEnrichCancel) {
      await new Promise(function(res) { setTimeout(res, 1100); });
    }
  }

  if (bar()) bar().style.width = '100%';
  var summary = (_orteEnrichCancel ? 'Abgebrochen. ' : 'Fertig. ') +
    ok + ' angereichert, ' + miss + ' ohne Treffer, ' + err + ' Fehler.';
  if (txt()) txt().textContent = summary;
  var btn = document.getElementById('enrich-close-btn');
  if (btn) btn.style.display = '';
  notify(summary, ok > 0 ? 'ok' : (err > 0 ? 'err' : 'info'));
}

function _orteEnrichStop() {
  _orteEnrichCancel = true;
}
