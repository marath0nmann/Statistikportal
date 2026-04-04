
function mikaKatChanged() {
  var kat = (document.getElementById('mika-kat') || {}).value || '';
  var url = ((document.getElementById('mika-url') || {}).value || '').trim();
  var btn = document.getElementById('mika-load-btn');
  if (btn) btn.disabled = !(kat && url);
}

function mikaUrlChanged() {
  mikaKatChanged();
}

async function mikaFetch() {
  var rawUrl = ((document.getElementById('mika-url') || {}).value || '').trim();
  if (!rawUrl) { notify('Bitte MikaTiming-URL eingeben.', 'err'); return; }

  var preview = document.getElementById('mika-preview');
  preview.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text2)">&#x23F3; Lade Ergebnisse&hellip;</div>';

  // Basis-URL extrahieren: https://muenchen.r.mikatiming.com/2025/
  var baseUrl = rawUrl.split('?')[0].replace(/\/?$/, '/');

  // Vereinsname für Suche
  var vereinRaw = (appConfig.verein_kuerzel || appConfig.verein_name || '').trim();

  // PHP-Proxy: Suche per Vereinsname
  var r = await apiGet('mika-fetch?base_url=' + encodeURIComponent(baseUrl) + '&club=' + encodeURIComponent(vereinRaw));
  if (!r || !r.ok) {
    preview.innerHTML = '<div style="background:var(--surf2);border-radius:10px;padding:16px"><strong>&#x274C; Fehler:</strong> ' + ((r && r.fehler) || 'Kein Ergebnis') + '</div>';
    return;
  }

  var data = r.data;
  var eventName = data.eventName || '';
  var eventDate = data.eventDate || '';
  var eventOrt  = data.eventOrt  || '';
  var results   = data.results   || [];
  var diszList  = (state.disziplinen || []).map(function(d) { return d.disziplin; }).filter(function(v,i,a){return a.indexOf(v)===i;});
  sortDisziplinen(diszList);

  if (!results.length) {
    preview.innerHTML = '<div style="background:var(--surf2);border-radius:10px;padding:16px"><strong>&#x274C; Keine Vereins-Ergebnisse gefunden.</strong><br><div style="font-size:12px;color:var(--text2);margin-top:8px">Vereinssuche: &ldquo;' + vereinRaw + '&rdquo;<br>Debug: ' + JSON.stringify(data.debug||{}).slice(0,300) + '</div></div>';
    return;
  }

  // Event-Datum + Ort aus Proxy
  window._mikaState = { results: results, baseUrl: baseUrl, eventDate: eventDate, eventOrt: eventOrt, eventName: eventName };

  // Felder auto-befüllen
  var datEl = document.getElementById('mika-datum');
  if (datEl && !datEl.value && eventDate) {
    var _dp = eventDate.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (_dp) datEl.value = _dp[3] + '.' + _dp[2] + '.' + _dp[1];
  }

  // Preview-Tabelle aufbauen
  var rows = '';
  for (var i = 0; i < results.length; i++) {
    var res = results[i];
    var athletId = '';
    var name = res.name || '';
    var nNorm = _normN(name);
    for (var ai = 0; ai < state.athleten.length && !athletId; ai++) {
      if (_normN(state.athleten[ai].name_nv || '') === nNorm) athletId = state.athleten[ai].id;
    }
    if (!athletId) {
      var parts = nNorm.split(' ').filter(function(p){return p.length>=3;});
      for (var ai2 = 0; ai2 < state.athleten.length && !athletId; ai2++) {
        var aNorm = _normN(state.athleten[ai2].name_nv || '');
        if (parts.length > 0 && parts.every(function(p){return aNorm.indexOf(p)>=0;})) athletId = state.athleten[ai2].id;
      }
    }
    results[i].athletId = athletId;

    var athOpts = '<option value="">– manuell –</option>';
    (state.athleten || []).forEach(function(a) {
      athOpts += '<option value="' + a.id + '"' + (a.id == athletId ? ' selected' : '') + '>' + a.name_nv + '</option>';
    });

    var disz = rrBestDisz(res.contest || res.disziplin || '', diszList);
    var diszOpts = '<option value="">' + (disz ? '' : '– bitte wählen –') + '</option>';
    diszList.forEach(function(d){ diszOpts += '<option value="' + d + '"' + (d===disz?' selected':'') + '>' + d + '</option>'; });

    rows +=
      '<tr class="rr-preview-row" style="border-bottom:1px solid var(--border)">' +
        '<td style="padding:6px"><input type="checkbox" class="mika-chk" data-idx="' + i + '" checked style="width:14px;height:14px;cursor:pointer"/></td>' +
        '<td style="padding:4px 6px"><select class="mika-athlet">' + athOpts + '</select></td>' +
        '<td style="padding:4px 6px;font-size:12px;color:var(--text2)">' + name + '</td>' +
        '<td style="padding:4px 6px"><select class="mika-disz">' + diszOpts + '</select></td>' +
        '<td style="padding:4px 6px;font-family:\'Barlow Condensed\',sans-serif;font-weight:700;font-size:14px;color:var(--result-color)">' + (res.netto || res.zeit || '') + '</td>' +
        '<td style="padding:4px 6px;font-size:12px;color:var(--text2)">' + (res.ak || '') + '</td>' +
        '<td style="padding:4px 6px;font-size:12px;color:var(--text2)">' + (res.platz_ak || '') + '</td>' +
        '<td class="mika-mstr" style="padding:4px 6px;display:none">' +
          '<select class="mika-mstr-sel" style="padding:5px 7px;border:1px solid var(--border);border-radius:6px;font-size:12px;background:var(--surface);color:var(--text);min-width:90px">' +
            mstrOptions(0) +
          '</select>' +
        '</td>' +
        '<td class="mika-mstr" style="padding:4px 6px;display:none">' +
          '<input type="number" class="mika-mstr-platz" min="1" placeholder="Platz" value="' + (res.platz_ak||'') + '" style="width:60px;padding:5px 7px;border:1px solid var(--border);border-radius:6px;font-size:12px;background:var(--surface);color:var(--text)">' +
        '</td>' +
      '</tr>';
  }

  preview.innerHTML =
    '<div style="font-size:13px;font-weight:600;margin-bottom:12px">&#x2705; ' + results.length + ' Vereins-Ergebnis(se) &bull; ' + eventName + '</div>' +
    '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px">' +
      '<div><label style="font-size:11px;color:var(--text2);display:block;margin-bottom:4px">Veranstaltungsname</label><input id="mika-evname" value="' + (eventName||'').replace(/"/g,'&quot;') + '" style="padding:7px 10px;border:1px solid var(--border);border-radius:7px;font-size:13px;background:var(--surface);color:var(--text);min-width:300px"/></div>' +
      '<div><label style="font-size:11px;color:var(--text2);display:block;margin-bottom:4px">Datum</label><input id="mika-datum" value="' + (eventDate ? (function(d){var p=d.match(/(\d{4})-(\d{2})-(\d{2})/);return p?p[3]+'.'+p[2]+'.'+p[1]:'';})(eventDate) : '') + '" placeholder="TT.MM.JJJJ" style="padding:7px 10px;border:1px solid var(--border);border-radius:7px;font-size:13px;background:var(--surface);color:var(--text);width:120px"/></div>' +
      '<div><label style="font-size:11px;color:var(--text2);display:block;margin-bottom:4px">Ort</label><input id="mika-ort" value="' + (eventOrt||'') + '" placeholder="Ort" style="padding:7px 10px;border:1px solid var(--border);border-radius:7px;font-size:13px;background:var(--surface);color:var(--text);width:140px"/></div>' +
      '<label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;white-space:nowrap;align-self:flex-end;padding-bottom:8px">' +
        '<input type="checkbox" id="mika-mstr-toggle" onchange="importToggleMstr(\'mika\',this.checked,document.getElementById(\'mika-mstr-global\').value)" style="width:15px;height:15px;accent-color:var(--btn-bg)">' +
        'Meisterschaft' +
      '</label>' +
      '<select id="mika-mstr-global" onchange="if(document.getElementById(\'mika-mstr-toggle\').checked)importToggleMstr(\'mika\',true,this.value)" style="padding:5px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px;background:var(--surface);color:var(--text);align-self:flex-end;margin-bottom:7px">' +
        mstrOptions(0) +
      '</select>' +
    '</div>' +
    '<table style="width:100%;border-collapse:collapse">' +
      '<thead><tr style="border-bottom:2px solid var(--border)">' +
        '<th style="padding:6px;width:30px"><input type="checkbox" checked onchange="document.querySelectorAll(\'.mika-chk\').forEach(function(c){c.checked=this.checked;})" title="Alle"/></th>' +
        '<th style="padding:6px;text-align:left;font-size:11px">ATHLET (SYSTEM)</th>' +
        '<th style="padding:6px;text-align:left;font-size:11px">NAME</th>' +
        '<th style="padding:6px;text-align:left;font-size:11px">DISZIPLIN</th>' +
        '<th style="padding:6px;text-align:left;font-size:11px">NETTO-ZEIT</th>' +
        '<th style="padding:6px;text-align:left;font-size:11px">AK</th>' +
        '<th style="padding:6px;text-align:left;font-size:11px">PLATZ AK</th>' +
        '<th class="mika-mstr-th" style="padding:6px;text-align:left;font-size:11px;display:none">MEISTERSCHAFT</th>' +
        '<th class="mika-mstr-th" style="padding:6px;text-align:left;font-size:11px;display:none">PLATZ MS</th>' +
      '</tr></thead>' +
      '<tbody>' + rows + '</tbody>' +
    '</table>' +
    '<div style="margin-top:16px"><button class="btn btn-primary" onclick="mikaImport()">&#x1F4BE; Ausgew\u00e4hlte importieren</button></div>';

  // Duplikat-Check
  mikaCheckDuplicates(results);
}

async function mikaCheckDuplicates(results) {
  var athIds = {};
  results.forEach(function(r){ if(r.athletId) athIds[r.athletId]=1; });
  var existMap = {};
  for (var _aid in athIds) {
    try {
      var _r = await apiGet('ergebnisse?limit=2000&offset=0&athlet_id=' + _aid);
      if (_r && _r.ok) (_r.data.rows||[]).forEach(function(e){ existMap[_aid+'|'+e.disziplin+'|'+e.resultat]=true; });
    } catch(e) {}
  }
  var rows = document.querySelectorAll('.rr-preview-row');
  var dupCount = 0;
  for (var i = 0; i < rows.length; i++) {
    var chk = rows[i].querySelector('.mika-chk');
    var idx = chk ? parseInt(chk.dataset.idx) : -1;
    if (idx < 0 || !window._mikaState) continue;
    var res = window._mikaState.results[idx];
    if (!res || !res.athletId) continue;
    var diszEl = rows[i].querySelector('.mika-disz');
    var disz = diszEl ? diszEl.value : '';
    var zeit = res.netto || res.zeit || '';
    if (existMap[res.athletId+'|'+disz+'|'+zeit]) {
      dupCount++;
      rows[i].style.opacity = '0.45';
      rows[i].title = 'Duplikat – bereits im System vorhanden';
      if (chk) { chk.checked = false; chk.disabled = true; }
      var firstTd = rows[i].querySelector('td:first-child');
      if (firstTd) firstTd.innerHTML += ' <span class="badge" style="background:var(--accent);color:#fff;font-size:10px">\u2715 Dup</span>';
    }
  }
  if (dupCount > 0) {
    var status = document.getElementById('mika-status');
    if (status) status.innerHTML = '<span style="color:var(--text2);font-size:12px">&#x26A0;\uFE0E ' + dupCount + ' Duplikat(e) erkannt und abgew\u00e4hlt</span>';
  }
}

async function mikaImport() {
  var _datumRaw = ((document.getElementById('mika-datum') || {}).value || '').trim();
  var datum = '';
  if (_datumRaw) {
    var _dp = _datumRaw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (_dp) datum = _dp[3] + '-' + _dp[2].padStart(2,'0') + '-' + _dp[1].padStart(2,'0');
    else datum = _datumRaw;
  }
  var ort    = ((document.getElementById('mika-ort')    || {}).value || '').trim();
  var evname = ((document.getElementById('mika-evname') || {}).value || '').trim();
  var kat    = ((document.getElementById('mika-kat')    || {}).value || '').trim();
  if (!datum) { notify('Bitte Datum ausfüllen!', 'err'); return; }
  if (!ort)   { notify('Bitte Ort ausfüllen!',   'err'); return; }

  var chks  = document.querySelectorAll('.mika-chk');
  var aths  = document.querySelectorAll('.mika-athlet');
  var diszs = document.querySelectorAll('.mika-disz');
  var items = [];
  var ms = window._mikaState;

  for (var i = 0; i < chks.length; i++) {
    if (!chks[i].checked) continue;
    var idx = parseInt(chks[i].getAttribute('data-idx'), 10);
    var res = ms.results[idx];
    var athletId = aths[i] ? parseInt(aths[i].value) || null : null;
    var disziplin = diszs[i] ? diszs[i].value.trim() : '';
    if (!athletId || !disziplin) continue;
    items.push({
      datum: datum, ort: ort, veranstaltung_name: evname,
      athlet_id: athletId, disziplin: disziplin,
      resultat: res.netto || res.zeit || '',
      altersklasse: res.ak || '',
      ak_platzierung: res.platz_ak ? parseInt(res.platz_ak) : null,
      meisterschaft: (function(){ var s=document.querySelectorAll('.mika-mstr-sel')[i]; return s&&s.value?parseInt(s.value)||null:null; })(),
      ak_platz_meisterschaft: (function(){ var s=document.querySelectorAll('.mika-mstr-platz')[i]; return s&&s.value?parseInt(s.value)||null:null; })(),
      import_quelle: 'mikatiming:' + (ms.baseUrl || '')
    });
  }

  if (!items.length) { notify('Keine gültigen Einträge (Athlet + Disziplin benötigt).', 'err'); return; }
  document.getElementById('mika-status').innerHTML = '&#x23F3; Importiere ' + items.length + ' Ergebnis(se)&hellip;';
  var r2 = await apiPost('ergebnisse/bulk', { items: items });
  if (r2 && r2.ok) {
    var msg = r2.data.imported + ' importiert';
    if (r2.data.skipped) msg += ', ' + r2.data.skipped + ' Duplikate übersprungen';
    notify(msg, 'ok');
    document.getElementById('mika-status').innerHTML = '&#x2705; ' + msg;
  } else {
    notify((r2 && r2.fehler) ? r2.fehler : 'Fehler', 'err');
    document.getElementById('mika-status').innerHTML = '';
  }
}

function mikaMstrChanged(sel) {
  // kein extra Toggle nötig
}
