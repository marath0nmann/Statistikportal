// ── Eigenes Ergebnis eintragen ────────────────────────────
function renderEigenesEintragen() {
  var el = document.getElementById('main-content');
  var clubName = (appConfig && appConfig.verein_name) ? appConfig.verein_name : '';
  var katOpts = '<option value="">-- Kategorie wählen --</option>';
  var seen = {};
  (state.disziplinen || []).forEach(function(d) {
    if (d.tbl_key && !seen[d.tbl_key]) { seen[d.tbl_key] = true; katOpts += '<option value="' + d.tbl_key + '">' + d.kategorie + '</option>'; }
  });

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
          '<input type="text" id="ee-ort" placeholder="z.B. Düsseldorf"/>' +
        '</div>' +
        '<div class="form-group full">' +
          '<label>Veranstaltungsname</label>' +
          '<input type="text" id="ee-evname" placeholder="z.B. Düsseldorf Marathon"/>' +
        '</div>' +
        '<div class="form-group full" style="background:color-mix(in srgb,var(--accent) 6%,transparent);border-radius:8px;padding:10px 12px">' +
          '<div style="font-size:12px;color:var(--accent);font-weight:600">&#x2139;&#xFE0E; Neue Veranstaltungen werden von einem Editor oder Admin geprüft.</div>' +
        '</div>' +
      '</div>' +

      '<div id="ee-best-form" style="display:none;margin-bottom:16px">' +
        '<label style="font-size:12px;font-weight:600;color:var(--text2);display:block;margin-bottom:6px">Veranstaltung *</label>' +
        '<select id="ee-veranst-sel" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--surface);color:var(--text)">' +
          '<option value="">– laden…</option>' +
        '</select>' +
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
          '<input type="text" id="ee-verein" value="' + clubName.replace(/"/g,'&quot;') + '"/>' +
        '</div>' +
      '</div>' +

      '<div class="panel" style="background:color-mix(in srgb,var(--primary) 5%,transparent);border:none;padding:10px 14px;margin-bottom:16px;font-size:13px">' +
        '&#x23F3;&#xFE0E; Dein Ergebnis wird vor der Veröffentlichung von einem Editor oder Admin geprüft.' +
      '</div>' +

      '<div id="ee-err" style="color:var(--accent);font-size:13px;min-height:18px;margin-bottom:8px"></div>' +
      '<div class="modal-actions" style="justify-content:flex-end">' +
        '<button class="btn btn-primary" onclick="saveEigenesErgebnis()">&#x1F4BE; Speichern</button>' +
      '</div>' +
    '</div>'
  );
  _eeLoadVeranstOptions();
}

var _eeVeranstModus = 'neu';
function eeBkToggle(modus) {
  _eeVeranstModus = modus;
  var nF = document.getElementById('ee-neu-form'), bF = document.getElementById('ee-best-form');
  var bN = document.getElementById('ee-toggle-neu'), bB = document.getElementById('ee-toggle-best');
  if (modus === 'best') {
    if (nF) nF.style.display = 'none'; if (bF) bF.style.display = '';
    if (bN) bN.className = 'btn btn-ghost btn-sm'; if (bB) bB.className = 'btn btn-primary btn-sm';
  } else {
    if (nF) nF.style.display = ''; if (bF) bF.style.display = 'none';
    if (bN) bN.className = 'btn btn-primary btn-sm'; if (bB) bB.className = 'btn btn-ghost btn-sm';
  }
}
async function _eeLoadVeranstOptions() {
  var sel = document.getElementById('ee-veranst-sel');
  if (!sel) return;
  var r = await apiGet('veranstaltungen?limit=200');
  if (!r || !r.ok) return;
  var veranst = (r.data.veranstaltungen || r.data || []);
  sel.innerHTML = '<option value="">– bitte wählen –</option>' +
    veranst.map(function(v) { return '<option value="' + v.id + '">' + v.kuerzel + '</option>'; }).join('');
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
async function saveEigenesErgebnis() {
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

  // Anderer Verein → externes Ergebnis (athlet_pb)
  var isExternal = verein && verein.toLowerCase() !== clubName.toLowerCase();
  if (isExternal) {
    // Externes Ergebnis ebenfalls per Antrag (muss genehmigt werden)
    var extBody = {
      disziplin: diszName, disziplin_mapping_id: diszMappingId,
      resultat: res, altersklasse: ak || null,
      externer_verein: verein,
      datum: document.getElementById('ee-datum') ? document.getElementById('ee-datum').value : null,
      veranstaltung_name: document.getElementById('ee-evname') ? document.getElementById('ee-evname').value.trim() : ''
    };
    if (veranstId) extBody.veranstaltung_id = veranstId;
    else { extBody.datum = datum; extBody.ort = ort; }
    var r = await apiPost('ergebnisse/eigenes', extBody);
    if (r && r.ok) { notify(r.data && r.data.pending ? 'Ergebnis eingereicht – wird geprüft.' : 'Gespeichert.', 'ok'); state.subTab = null; renderEintragen(); }
    else if (errEl) errEl.textContent = (r && r.fehler) ? r.fehler : 'Fehler beim Speichern.';
    return;
  }

  // Eigener Verein → als Antrag eintragen (pending)
  var datum = '', ort = '', evname = '', veranstId = null;
  if (_eeVeranstModus === 'best') {
    veranstId = document.getElementById('ee-veranst-sel') ? parseInt(document.getElementById('ee-veranst-sel').value) : null;
    if (!veranstId) { if (errEl) errEl.textContent = 'Bitte Veranstaltung wählen.'; return; }
  } else {
    datum = document.getElementById('ee-datum') ? document.getElementById('ee-datum').value : '';
    ort = document.getElementById('ee-ort') ? document.getElementById('ee-ort').value.trim() : '';
    evname = document.getElementById('ee-evname') ? document.getElementById('ee-evname').value.trim() : '';
    if (!datum || !ort) { if (errEl) errEl.textContent = 'Datum und Ort sind Pflichtfelder.'; return; }
  }

  var body = {
    athlet_id: currentUser.athlet_id,
    disziplin: diszName, disziplin_mapping_id: diszMappingId,
    resultat: res, altersklasse: ak || null,
  };
  if (veranstId) body.veranstaltung_id = veranstId;
  else { body.datum = datum; body.ort = ort; body.veranstaltung_name = evname; }

  var r2 = await apiPost('ergebnisse/eigenes', body);
  if (r2 && r2.ok) {
    notify(r2.data && r2.data.pending ? 'Ergebnis eingereicht – wird geprüft.' : 'Gespeichert.', 'ok');
    state.subTab = null; renderEintragen();
  } else if (errEl) {
    errEl.textContent = (r2 && r2.fehler) ? r2.fehler : 'Fehler beim Speichern.';
  }
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
        '<div style="margin-bottom:14px">' +
          '<label style="font-size:12px;font-weight:600;color:var(--text2);display:block;margin-bottom:6px">Ergebnisse einf&uuml;gen</label>' +
          '<textarea id="bk-paste-area" rows="10" oninput="bulkPasteInput()" placeholder="URL oder Ergebnisse eingeben:&#10;&#10;RaceResult:   https://my.raceresult.com/354779/&#10;MikaTiming:   https://muenchen.r.mikatiming.com/2025/?pid=search&amp;pidp=start&#10;uitslagen.nl:     https://uitslagen.nl/uitslag?id=2025110916317&#10;evenementen:      https://evenementen.uitslagen.nl/2023/venloop/&#10;leichtathletik.de: https://ergebnisse.leichtathletik.de/Competitions/Resultoverview/18010&#10;&#10;Oder direkte Ergebnisse:&#10;W65 / 11.10.25 / 400m / Max Mustermann  1:43:15  7" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:8px;font-size:12px;font-family:monospace;background:var(--surface);color:var(--text);resize:vertical"></textarea>' +
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
              '<input type="checkbox" id="bk-match-inaktive" checked onchange="window._bkMatchInaktive=this.checked" style="width:13px;height:13px;cursor:pointer">' +
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
        '<div id="bk-neu-form" class="form-grid" style="margin-bottom:16px">' +
          '<div class="form-group"><label>Datum *</label><input type="date" id="bk-datum" value="' + today + '" onchange="bkSyncDatum(this.value)"/></div>' +
          '<div class="form-group"><label>Ort *</label><input type="text" id="bk-ort" placeholder="z.B. D&uuml;sseldorf"/></div>' +
          '<div class="form-group"><label>Veranstaltungsname</label><input type="text" id="bk-evname" placeholder="z.B. Düsseldorf Marathon"/></div>' +
          '<div class="form-group"><label>Datenquelle (URL)</label><input type="url" id="bk-quelle" placeholder="z.B. https://my.raceresult.com/..." style="font-size:12px"/></div>' +
          '<div class="form-group"><label>Regelmäßige Veranstaltung <span style="font-size:11px;color:var(--text2);font-weight:400">(optional)</span></label>' +
            '<select id="bk-serie" style="width:100%" onchange="bkSerieChanged(this.value)"><option value="">– keine Zuordnung –</option></select>' +
          '</div>' +
          '<div class="form-group" style="display:flex;align-items:flex-end;gap:12px">' +
            '<div style="flex:1"><label>Kategorie</label><select id="bk-kat" style="width:100%" onchange="bkKatChanged()">' + (function(){
            var seen={}, opts='<option value="">Alle Kategorien</option>';
            var disz=state.disziplinen||[];
            var kats=[];
            for(var i=0;i<disz.length;i++){var d=disz[i];if(d.tbl_key&&!seen[d.tbl_key]){seen[d.tbl_key]=true;kats.push({key:d.tbl_key,name:d.kategorie});}}
            for(var ki=0;ki<kats.length;ki++){opts+='<option value="'+kats[ki].key+'">'+kats[ki].name+'</option>';}
            return opts;
          })() + '</select></div>' +
            '<label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;white-space:nowrap;padding-bottom:2px">' +
              '<input type="checkbox" id="bk-mstr-toggle" onchange="importToggleMstr(\'bk\',this.checked,document.getElementById(\'bk-mstr-global\').value)" style="width:15px;height:15px;accent-color:var(--btn-bg)">' +
              'Meisterschaft' +
            '</label>' +
            '<select id="bk-mstr-global" onchange="if(document.getElementById(\'bk-mstr-toggle\').checked)importToggleMstr(\'bk\',true,this.value)" style="padding:5px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px;background:var(--surface);color:var(--text)">' +
              mstrOptions(0) +
            '</select>' +
          '</div>' +
        '</div>' +
        '<div id="bk-best-form" style="display:none;margin-bottom:16px">' +
          '<label style="font-size:12px;font-weight:600;color:var(--text2);display:block;margin-bottom:6px">Veranstaltung *</label>' +
          '<select id="bk-veranst-sel" style="width:100%;max-width:500px;padding:9px 12px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--surface);color:var(--text)">' +
            '<option value="">&#x2013; laden&hellip;</option>' +
          '</select>' +
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
              '<th style="padding:8px 6px;text-align:center;font-weight:600;font-size:11px;max-width:70px" title="Nicht für den Verein gelaufen → externes Ergebnis (athlet_pb)">Nicht für Verein</th>' +
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

  if (isBulk) {
    bulkAddRow();
    bkLoadVeranstOptions();

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

async function bkLoadVeranstOptions() {
  var sel = document.getElementById('bk-veranst-sel');
  if (!sel) return;
  var r = await apiGet('veranstaltungen?limit=50&offset=0');
  if (!r || !r.ok || !r.data.veranst) return;
  var opts = '<option value="">&#x2013; w&auml;hlen &#x2013;</option>';
  var list = r.data.veranst;
  for (var i = 0; i < list.length; i++) {
    var v = list[i];
    var label = (v.name || v.kuerzel) + ' (' + formatDate(v.datum) + (v.ort ? ', ' + v.ort : '') + ')';
    opts += '<option value="' + v.id + '" data-datum="' + v.datum + '" data-ort="' + (v.ort||'') + '" data-kuerzel="' + v.kuerzel + '">' + label + '</option>';
  }
  sel.innerHTML = opts;
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
  var sel = document.getElementById('bk-serie');
  if (!sel) return;
  var r = await apiGet('veranstaltung-serien');
  if (!r || !r.ok) return;
  var serien = r.data || [];
  window._bkSerien = serien;
  sel.innerHTML = '<option value="">– keine Zuordnung –</option>' +
    serien.map(function(s) {
      return '<option value="' + s.id + '">' + s.name + '</option>';
    }).join('') +
    '<option value="__neu__">＋ Neue regelmäßige Veranstaltung…</option>';
}

function bkSerieChanged(serieId) {
  if (serieId === '__neu__') {
    // Zurück auf leer setzen und Modal öffnen
    var sel = document.getElementById('bk-serie');
    if (sel) sel.value = '';
    bkNeueSerieModal();
    return;
  }
  // Wenn Serie gewählt: Veranstaltungsname vorbelegen
  var serien = window._bkSerien || [];
  var s = serien.find(function(x) { return String(x.id) === String(serieId); });
  var evEl = document.getElementById('bk-evname');
  if (s && evEl && !evEl.value) evEl.value = s.name;
}

async function bkNeueSerieModal() {
  showModal(
    '<h2>&#x1F504; Neue regelmäßige Veranstaltung <button class="modal-close" onclick="closeModal()">&#x2715;</button></h2>' +
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
  var sel = document.getElementById('bk-serie');
  if (sel && newId) {
    // __neu__ Option herausnehmen, neue Serie einfügen, __neu__ wieder ans Ende
    var neuOpt = Array.from(sel.options).find(function(o){ return o.value === '__neu__'; });
    var newOpt = document.createElement('option');
    newOpt.value = newId;
    newOpt.textContent = name;
    if (neuOpt) sel.insertBefore(newOpt, neuOpt);
    else sel.appendChild(newOpt);
    sel.value = newId;
    // _bkSerien aktualisieren
    if (!window._bkSerien) window._bkSerien = [];
    window._bkSerien.push({ id: newId, name: name });
  }
  notify('Regelmäßige Veranstaltung "' + name + '" angelegt.', 'ok');
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
  });
}

// Pace berechnen: Disziplin-Name → Distanz in km → min:sec/km
function diszKm(disz) {
  if (!disz) return 0;
  // 1. Prio: distanz aus state.disziplinen (in Metern gespeichert)
  var dObj = (state.disziplinen || []).find(function(d){ return d.disziplin === disz; });
  if (dObj && dObj.distanz) return dObj.distanz / 1000;
  // 2. Fallback: aus Disziplin-Name parsen
  var dl = disz.toLowerCase();
  if (dl.indexOf('marathon') >= 0 && dl.indexOf('halb') >= 0) return 21.0975;
  if (dl.indexOf('marathon') >= 0) return 42.195;
  var m = dl.match(/(\d+[\.,]?\d*)\s*km/);
  if (m) return parseFloat(m[1].replace(',', '.'));
  var mm = dl.match(/(\d+[\.,]?\d*)\s*m\b/);
  if (mm) return parseFloat(mm[1].replace(',', '.')) / 1000;
  return 0;
}

function calcPace(disz, resultat) {
  if (!disz || !resultat) return '';
  resultat = dbRes(resultat); // Komma→Punkt für Berechnung
  // Distanz aus Disziplinname extrahieren (z.B. "Halbmarathon"→21.0975, "10km"→10, "5 km"→5)
  var km = 0;
  var dl = disz.toLowerCase();
  if (dl.indexOf('marathon') >= 0 && dl.indexOf('halb') >= 0) km = 21.0975;
  else if (dl.indexOf('marathon') >= 0) km = 42.195;
  else {
    var m = dl.match(/(\d+[\.,]?\d*)\s*km/);
    if (m) km = parseFloat(m[1].replace(',', '.'));
    else {
      var mm = dl.match(/(\d+[\.,]?\d*)\s*m\b/);
      if (mm) km = parseFloat(mm[1].replace(',', '.')) / 1000;
    }
  }
  if (km < 1) return ''; // unter 1km keine Pace
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
  var athOptHtml = '<option value="">&#x2013; w&auml;hlen &#x2013;</option>';
  for (var i = 0; i < state.athleten.length; i++) {
    var a = state.athleten[i];
    var g = a.geschlecht || '';
    var gebj = a.geburtsjahr ? String(a.geburtsjahr) : '';
    athOptHtml += '<option value="' + a.id + '" data-g="' + g + '" data-gebj="' + gebj + '">' + a.name_nv + '</option>';
  }
  var fld = 'box-sizing:border-box;height:34px;padding:6px 10px;border:1.5px solid var(--border);border-radius:7px;background:var(--surf2);color:var(--text);font-family:Barlow,sans-serif;font-size:13px;outline:none;width:100%';
  return '<tr id="bkrow-' + idx + '" style="border-bottom:1px solid var(--border)">' +
    '<td style="padding:6px;color:var(--text2);font-size:12px">' + (idx+1) + '</td>' +
    '<td style="padding:4px 6px"><select class="bk-athlet" onchange="bkUpdateAK(this,' + idx + ')" style="' + fld + '">' + athOptHtml + '</select></td>' +
    '<td style="padding:4px 6px"><select class="bk-disz" style="' + fld + '">' + bkDiszOpts((document.getElementById('bk-kat')||{}).value||'') + '</select></td>' +
    '<td style="padding:4px 6px"><input class="bk-res" type="text" placeholder="00:45:00" style="' + fld + '"/></td>' +
    '<td style="padding:4px 6px"><input type="text" class="bk-ak" id="bk-ak-' + idx + '" placeholder="z.B. M45" maxlength="8" style="' + fld + '"/></td>' +
    '<td style="padding:4px 6px"><input class="bk-platz" type="number" placeholder="1" min="1" style="' + fld + '"/></td>' +
    '<td class="bk-mstr" style="padding:4px 6px;display:none">' +
      '<select class="bk-mstr-sel" style="' + fld + '">' + mstrOptions(0) + '</select>' +
    '</td>' +
    '<td class="bk-mstr" style="padding:4px 6px;display:none">' +
      '<input type="number" class="bk-mstr-platz" min="1" placeholder="Platz" style="' + fld + ';width:80px">' +
    '</td>' +
    '<td style="padding:4px 6px"><input class="bk-zeilendatum" type="text" placeholder="TT.MM.JJJJ" style="' + fld + ';min-width:110px" title="Datum dieser Zeile (überschreibt globales Datum)"/></td>' +
    '<td style="padding:4px 6px;text-align:center">' +
      '<input type="checkbox" class="bk-extern" title="Nicht für den Verein gelaufen → wird als externes Ergebnis gespeichert" style="width:16px;height:16px;cursor:pointer;accent-color:var(--accent)"/>' +
    '</td>' +
    '<td style="padding:4px 6px;text-align:center"><button onclick="bulkRemoveRow(' + idx + ')" style="background:none;border:none;cursor:pointer;color:var(--text2);font-size:16px;padding:2px 4px" title="Zeile entfernen">&#x2715;</button></td>' +
  '</tr>';
}

var _bulkRowCount = 0;
function bkUpdateAK(athSel, idx) {
  var opt = athSel.options[athSel.selectedIndex];
  var g    = opt ? (opt.dataset.g    || '') : '';
  var gebj = opt ? (opt.dataset.gebj || '') : '';
  var akInp = document.getElementById('bk-ak-' + idx);
  if (!akInp) return;
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
    var sel = document.getElementById('bk-veranst-sel');
    if (sel && sel.value) {
      var opt = sel.options[sel.selectedIndex];
      var d = opt && opt.dataset.datum;
      if (d) return parseInt(d.substring(0, 4));
    }
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
    var sel = document.getElementById('bk-veranst-sel');
    if (!sel || !sel.value) { notify('Bitte eine Veranstaltung w&auml;hlen!', 'err'); return; }
    veranstId = sel.value;
    var opt = sel.options[sel.selectedIndex];
    datum  = opt.dataset.datum  || '';
    ort    = opt.dataset.ort    || '';
    evname = opt.dataset.kuerzel || '';
  } else {
    var _globalDatum = (document.getElementById('bk-datum') || {}).value;
    datum  = _globalDatum;
    ort    = ((document.getElementById('bk-ort') || {}).value || '').trim();
    evname = ((document.getElementById('bk-evname') || {}).value || '').trim();
    if (!datum || !ort) { notify('Datum und Ort sind Pflichtfelder!', 'err'); return; }
    veranstId = null;
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
      ort: ort, veranstaltung_name: evname,
      datenquelle: ((document.getElementById('bk-quelle') || {}).value || '') || null,
      veranstaltung_id: veranstId ? parseInt(veranstId) : null,
      serie_id: (function(){ var s=document.getElementById('bk-serie'); return s&&s.value?parseInt(s.value):null; })(),
      athlet_id: parseInt(athlet_id) || null,
      disziplin: disziplin, disziplin_mapping_id: _diszMid || null, resultat: dbRes(resultat),
      altersklasse: row.querySelector('.bk-ak') ? row.querySelector('.bk-ak').value.trim() : '',
      _zeilendatum: row.querySelector('.bk-zeilendatum') ? row.querySelector('.bk-zeilendatum').value.trim() : '',
      ak_platzierung: row.querySelector('.bk-platz') && row.querySelector('.bk-platz').value ? parseInt(row.querySelector('.bk-platz').value) : null,
      extern: !!(row.querySelector('.bk-extern') && row.querySelector('.bk-extern').checked),
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
        urlType === 'acn'            ? '🇳🇱 ACN Timing' :
                  urlType === 'evenementen'    ? '🇳🇱 evenementen.uitslagen.nl' : '🇳🇱 uitslagen.nl';
    if (srcLabel) srcLabel.textContent = srcText;
    if (statusEl) statusEl.textContent = '';
  } else {
    katWrap.style.display = 'none';
    if (srcLabel) srcLabel.textContent = '';
    if (statusEl) statusEl.textContent = '';
  }
}

function bulkImportKatChanged() {
  // kein separater Import-Button mehr — bulkEinlesen() übernimmt alles
}

async function bulkImportUrl() {
  var raw = ((document.getElementById('bk-paste-area') || {}).value || '').trim();
  var kat = ((document.getElementById('bk-import-kat') || {}).value || '').trim();
  var statusEl = document.getElementById('bk-import-status');
  var urlType = bulkDetectUrl(raw);
  if (!urlType || !kat) return;

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
                  urlType === 'leichtathletik' ? 'leichtathletik.de' : urlType === 'acn' ? 'ACN Timing' : urlType === 'evenementen' ? 'evenementen.uitslagen.nl' : 'uitslagen.nl';

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
    } else if (urlType === 'leichtathletik') {
      await bulkImportFromLA(raw, kat, statusEl);
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
  var _eidM = url.match(/raceresult\.com\/(\d+)/i);
  if (!_eidM) { if (statusEl) statusEl.textContent = '\u274c Keine Event-ID in URL'; return; }
  var eid = _eidM[1];
  if (statusEl) statusEl.textContent = '\u23f3 Lade RaceResult-Konfiguration\u2026';

  async function _freshCfg() {
    var r = await fetch(
      'https://my.raceresult.com/' + eid + '/RRPublish/data/config?lang=de&page=results&noVisitor=1'
    );
    if (!r.ok) throw new Error('Config HTTP ' + r.status);
    return await r.json();
  }

  var cfg;
  try { cfg = await _freshCfg(); }
  catch(e) {
    if (statusEl) statusEl.textContent = '\u274c Config-Fehler: ' + e.message;
    _bkDbgLine('Fehler', String(e)); return;
  }

  var eventName  = cfg.EventName || cfg.Name || cfg.eventname || '';
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
    var ortEl = document.getElementById('bk-ort');
    var evEl  = document.getElementById('bk-evname');
    if (pd.date     && datEl) { datEl.value = pd.date; bkSyncDatum(pd.date); }
    if (pd.location && ortEl && !ortEl.value) ortEl.value = pd.location;
    if (eventName   && evEl  && !evEl.value)  evEl.value  = eventName;
    _bkDbgLine('Datum', pd.date     || '\u2013');
    _bkDbgLine('Ort',   pd.location || '\u2013');
  }

  var listSource = cfg.list || cfg.lists || {};
  var listArr    = Array.isArray(listSource) ? listSource
    : Object.keys(listSource).map(function(k) { return { Name: k, Contest: '0' }; });

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
    var _isAkList = /_ak(?:_|$)/i.test(ln); // z.B. Ergebnisse_AK oder Ergebnisliste_AK_Tag_1
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
  var diszList    = disziplinen.map(function(d){return d.disziplin;}).filter(function(v,i,a){return a.indexOf(v)===i;});
  var allResults  = [], listsChecked = 0;
  var base        = 'https://my.raceresult.com/' + eid + '/RRPublish/data/list';
  var hdrs        = {'Origin':'https://my.raceresult.com','Referer':'https://my.raceresult.com/'};
  var iName=3,iClub=6,iAK=-1,iZeit=8,iNetto=7,iPlatz=2,iYear=-1,iGeschlecht=-1,iAKPlatz=-1;

  function _cal(df) {
    iAK=-1;iYear=-1;iGeschlecht=-1;iAKPlatz=-1;iName=3;iClub=6;iNetto=-1;iZeit=-1;iPlatz=2;
    for(var fi=0;fi<df.length;fi++){
      var f=df[fi].toLowerCase();
      if(f.indexOf('anzeigename')>=0||f.indexOf('lfname')>=0||f==='displayname'||f==='fullname')iName=fi;
      else if(f.indexOf('club')>=0||f.indexOf('verein')>=0)iClub=fi;
      else if(f.indexOf('autorankp')>=0||f.indexOf('overallrank')>=0||f.indexOf('withstatus')>=0||f.indexOf('mitstatus')>=0||f.indexOf('statusplatz')>=0||f.indexOf('agegrouprank')>=0){if(f.indexOf('akpl')>=0||f.indexOf('agegrouprank')>=0)iAKPlatz=fi;else iPlatz=fi;}
      else if(f.indexOf('akpl')>=0)iAKPlatz=fi;
      else if(/^rank\dp$/.test(f)){if(f==='rank1p')iPlatz=fi;else iAKPlatz=fi;}
      else if((f.indexOf('agegroup')>=0||f==='[agegroup1.nameshort]'||f.indexOf('akabk')>=0||f.indexOf('ak_abk')>=0||f==='es_akabkürzung'||f.indexOf('agegroupname')>=0)&&f.indexOf('rank')<0)iAK=fi;
      else if(f==='year'||f==='yob'||f==='birthyear'||f==='es_jahrgang')iYear=fi;
      else if(f.indexOf('geschlechtmw')>=0||f==='es_geschlecht'||f==='gendermf'||f==='gender'||f==='sex')iGeschlecht=fi;
      else if(f.indexOf('chip')>=0||f.indexOf('netto')>=0)iNetto=fi;
      else if(f.indexOf('gun')>=0||f.indexOf('brutto')>=0||f==='ziel'||f.indexOf('ziel')>=0||f.indexOf('finish')>=0)iZeit=fi;
      else if(f==='time'||f.indexOf('time')===0)iZeit=fi;
    }
    if(iNetto>=0&&iZeit<0)iZeit=iNetto;
    if(iNetto<0&&iZeit>=0)iNetto=iZeit;
    if(iNetto>=0&&iNetto===iClub)iNetto=(iZeit>=0&&iZeit!==iClub)?iZeit:-1;
  }

  function _proc(payload, contestName, le) { le = le || {};
    var df=payload.DataFields||[];
    if(Array.isArray(df)&&df.length>0)_cal(df);
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
        var cnD=(function(){
          var cands=[contestName,kClean,gk].filter(Boolean);
          for(var ci=0;ci<cands.length;ci++){
            if(rrBestDisz(cands[ci],diszList))return cands[ci];
          }
          return contestName||kClean||gk;
        })();
        rowsArr.forEach(function(row){
          if(!Array.isArray(row)||row.length<3)return;
          var club=iClub>=0?String(row[iClub]||'').trim():'';
          if(clubPhrase&&club.toLowerCase().indexOf(clubPhrase)<0)return;
          var rName=String(row[iName]||'').trim();
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
          var rP=0,pi=iAKPlatz>=0?iAKPlatz:iPlatz;
          if(pi>=0){var pr=String(row[pi]||'').trim().replace(/\.$/,'');if(/^\d+$/.test(pr))rP=parseInt(pr)||0;}
          if(!rName)return;
          var disz=rrBestDisz(cnD,diszList);
          var dObj=disziplinen.find(function(d){return d.disziplin===disz&&(!kat||(bkKatMitGruppen(kat)||[]).indexOf(d.tbl_key)>=0);});
          var _dup=allResults.find(function(r){return r.name===rName&&r.resultat===rZeit;});
          if(_dup){
            // Platz: AK-Listen haben Priorität (isAkList). Aus Nicht-AK-Listen nur wenn noch kein Platz.
            var _canUpdatePlatz = rP>0 && (_dup.platz===0 || (le && le.isAkList && !_dup.isAkList));
            if(_canUpdatePlatz){_dup.platz=rP; if(le&&le.isAkList)_dup.isAkList=true;}
            // AK übernehmen wenn besser (echter Wert > Punkt/leer)
            var _dupAkOk = _dup.ak && _dup.ak !== '.' && _dup.ak.length > 1;
            if(rAK && rAK !== '.' && rAK.length > 1 && !_dupAkOk) _dup.ak = rAK;
          } else {
            allResults.push({name:rName,resultat:rZeit,ak:rAK,platz:rP,
              disziplin:dObj?dObj.disziplin:disz,diszMid:dObj?(dObj.id||dObj.mapping_id):null,
              year:rYear||'',geschlecht:rGschl||'',
              contestId:String(le ? le.contest : ''),
              contestName:contestName||'',
              tagNr:le ? (le.tagNr||0) : 0,
              isAkList:le ? !!le.isAkList : false});
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

    var payload=null;

    // r=search zuerst
    try{
      var rs=await fetch(base+'?key='+currentKey+'&listname='+encodeURIComponent(le.name)+'&page=results&contest='+le.contest+'&r=search&l=9999&term=',{headers:hdrs});
      if(rs.ok){var ps=await rs.json();if(!ps.error&&(ps.DataFields||[]).length>0)payload=ps;}
    }catch(e){}

    // r=all als Fallback
    if(!payload){
      try{
        var ra=await fetch(base+'?key='+currentKey+'&listname='+encodeURIComponent(le.name)+'&page=results&contest='+le.contest+'&r=all&l=de&_=1',{headers:hdrs});
        if(ra.ok){
          var pa=await ra.json();
          if(!pa.error)payload=pa;
          else if(pa.error==='key invalid'){
            // Key erneuern + sofort nochmal
            try{var fc2=await _freshCfg();currentKey=fc2.key||currentKey;keyAt=Date.now();
              var rr=await fetch(base+'?key='+currentKey+'&listname='+encodeURIComponent(le.name)+'&page=results&contest='+le.contest+'&r=all&l=de&_=1',{headers:hdrs});
              if(rr.ok){var pr=await rr.json();if(!pr.error)payload=pr;}
            }catch(e2){}
          }
        }
      }catch(e){}
    }

    if(!payload)continue;
    listsChecked++;
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

  if (r.debug) _bkDbgLine('API-Debug', JSON.stringify(r.debug).slice(0,300));
  var rows = mikaExtractRowsForBulk(r.data, kat);
  _bkDbgLine('Vereins-Treffer', rows.length + ' Einträge');

  // Zusätzliche Suche nach bekannten Athleten-Namen (immer, nicht nur als Fallback)
  if (true) {
    _bkDbgLine('Athleten-Suche', 'Suche nach bekannten Athleten-Namen…');
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
    // Parallele Requests in Batches (5 gleichzeitig) für ~5× Speedup
    var _BATCH = 5;
    for (var _ni = 0; _ni < _nachnamen.length; _ni += _BATCH) {
      var _batch = _nachnamen.slice(_ni, _ni + _BATCH);
      if (statusEl) statusEl.textContent = '⏳ Athleten-Suche ' + Math.min(_ni + _BATCH, _nachnamen.length) + '/' + _nachnamen.length + '…';
      var _batchResults = await Promise.all(_batch.map(function(_nn) {
        return apiGet('mika-fetch?base_url=' + encodeURIComponent(baseUrl) + '&club=' + encodeURIComponent(vereinRaw) + '&name=' + encodeURIComponent(_nn));
      }));
      _batchResults.forEach(function(_nr) {
        if (!_nr || !_nr.ok || !_nr.data.results) return;
        _nr.data.results.forEach(function(res) {
          if (_idpSeen[res.idp]) return;
          if (uitsAutoMatch(res.name, _athleten) !== null) {
            _idpSeen[res.idp] = true;
            _nameRows.push(res);
          }
        });
      });
    }
    _bkDbgLine('Namens-Treffer', _nameRows.length + ' Athleten gefunden');
    // Vereins-Ergebnisse mit Namens-Ergebnissen zusammenführen (dedup via idp)
    var _clubIdps = {};
    (r.data.results || []).forEach(function(res) { if (res.idp) _clubIdps[res.idp] = true; });
    var _combined = (r.data.results || []).concat(
      _nameRows.filter(function(res) { return !_clubIdps[res.idp]; })
    );
    rows = mikaExtractRowsForBulk({ results: _combined }, kat);
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
        '\u2192 ' + (_mr.disziplin||'(keine)')
      );
    }
    _bkDbgFlush();
  }
  // AK angleichen wenn Checkbox aktiv
  var akAnglEl = document.getElementById('bk-ak-angleichen');
  if (!akAnglEl || akAnglEl.checked) bkApplyDlvAK(true);

  // Veranstaltungsname und Ort aus API-Response vorbelegen
  var _evData = r.data || {};
  if (_evData.eventName) {
    var evEl = document.getElementById('bk-evname');
    if (evEl && !evEl.value) evEl.value = _evData.eventName;
  }
  if (_evData.eventOrt) {
    var ortEl = document.getElementById('bk-ort');
    if (ortEl && !ortEl.value) ortEl.value = _evData.eventOrt;
  }
  if (_evData.eventDate) {
    var datEl = document.getElementById('bk-datum');
    if (datEl && !datEl.value) datEl.value = _evData.eventDate;
  }

  await bulkFillFromImport(rows, statusEl);
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
  if (parsed.eventOrt) {
    var ortEl = document.getElementById('bk-ort');
    if (ortEl && !ortEl.value) ortEl.value = parsed.eventOrt;
  }
  if (parsed.eventName) {
    var evEl = document.getElementById('bk-evname');
    if (evEl && !evEl.value) evEl.value = parsed.eventName;
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
  var diszList = disziplinen.map(function(d){ return d.disziplin; }).filter(function(v,i,a){ return a.indexOf(v)===i; });
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
      var diszObj = (kat ? disziplinen.find(function(d){return d.disziplin===disz&&d.tbl_key===kat;}) : null)
               || disziplinen.find(function(d){ return d.disziplin === disz && (!kat || (bkKatMitGruppen(kat)||[]).indexOf(d.tbl_key) >= 0); });
      rows.push({ name: name, resultat: zeit, ak: ak, platz: platz,
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
function mikaExtractRowsForBulk(data, kat) {
  var results = data && data.results ? data.results : [];
  var disziplinen = state.disziplinen || [];
  var diszList = disziplinen.map(function(d){ return d.disziplin; }).filter(function(v,i,a){ return a.indexOf(v)===i; });
  var vereinRaw = (appConfig.verein_kuerzel || appConfig.verein_name || '').trim().toLowerCase();

  return results.filter(function(res) {
    // Nur Einträge mit Name behalten; DNS/DNF = kein Ergebnis → beim neuen Interface (type-time vorhanden)
    // explizit herausfiltern wenn weder Zeit noch Name; beim alten Interface kommt Zeit per Detail-Fetch
    if (!res.name) return false;
    // Neues Interface: Zeit steht in Liste; wenn keine Zeit → DNS/DNF
    if (res._fromNewInterface && !(res.netto || res.zeit)) return false;
    return true;
  }).map(function(res) {
    var contestName = res.contest || res.disziplin || '';
    var disz = rrBestDisz(contestName, diszList);
    var diszObj = (kat ? disziplinen.find(function(d){return d.disziplin===disz&&d.tbl_key===kat;}) : null)
               || disziplinen.find(function(d){ return d.disziplin === disz && (!kat || (bkKatMitGruppen(kat)||[]).indexOf(d.tbl_key) >= 0); });
    // Extern wenn Vereinsname leer oder nicht zum eigenen Verein passt
    var resClub = (res.club || '').trim().toLowerCase();
    var isExtern = !resClub || (vereinRaw && resClub.indexOf(vereinRaw) === -1 && vereinRaw.indexOf(resClub) === -1);
    return {
      name:      res.name || '',
      resultat:  res.netto || res.zeit || '',
      ak:        res.ak || '',
      platz:     parseInt(res.platz_ak) || 0,
      disziplin: diszObj ? diszObj.disziplin : disz,
      diszMid:   diszObj ? (diszObj.id || diszObj.mapping_id) : null,
      extern:    isExtern,
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

  // kop.html → Ort (und Datum falls vorhanden)
  var rKop = await apiGet('uits-fetch?url=' + encodeURIComponent(baseUrl + 'kop.html'));
  if (rKop && rKop.ok && rKop.data && rKop.data.html) {
    var kopDoc = (new DOMParser()).parseFromString(rKop.data.html, 'text/html');
    var kopText = kopDoc.body ? kopDoc.body.textContent.trim() : '';
    _bkDbgLine('kop.html', kopText.slice(0,200) || '(leer)');
    var mDat = kopText.match(/(\d{1,2})\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+(\d{4})/i);
    if (mDat) {
      var _mn = {januari:1,februari:2,maart:3,april:4,mei:5,juni:6,juli:7,augustus:8,september:9,oktober:10,november:11,december:12};
      var _m = _mn[(mDat[2]||'').toLowerCase()] || 1;
      var datumIso = mDat[3] + '-' + String(_m).padStart(2,'0') + '-' + mDat[1].padStart(2,'0');
      var datEl = document.getElementById('bk-datum');
      if (datEl) { datEl.value = datumIso; if (typeof bkSyncDatum === 'function') bkSyncDatum(datumIso); }
    }
    var mOrt = kopText.match(/[-\u2013]\s*([A-Z][a-zA-Z\u00e4\u00f6\u00fc\u00df\-]+(\s+[A-Z][a-zA-Z\u00e4\u00f6\u00fc]+)?)\s*[,(\d]/);
    if (mOrt && mOrt[1]) evOrt = mOrt[1].trim();
  }

  // Datum-Fallback: voet.php (Footer enthält oft Datum)
  if (!document.getElementById('bk-datum') || !document.getElementById('bk-datum').value || document.getElementById('bk-datum').value === new Date().toISOString().slice(0,10)) {
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
        var datumIso2 = _y2 + '-' + String(_m2).padStart(2,'0') + '-' + String(_d2).padStart(2,'0');
        var datEl2 = document.getElementById('bk-datum');
        if (datEl2) { datEl2.value = datumIso2; if (typeof bkSyncDatum === 'function') bkSyncDatum(datumIso2); }
        _bkDbgLine('Datum', datumIso2 + ' (aus voet.php)');
      }
    }
  }

  if (statusEl) statusEl.textContent = '\u23f3 Lade Strecken\u2026';
  // menu.php (neuere Events) oder menu.html (ältere Events)
  var rMenu = await apiGet('uits-fetch?url=' + encodeURIComponent(baseUrl + 'menu.php'));
  if (!rMenu || !rMenu.ok || !(rMenu.data && rMenu.data.html)) {
    rMenu = await apiGet('uits-fetch?url=' + encodeURIComponent(baseUrl + 'menu.html'));
  }
  if (!rMenu || !rMenu.ok) { if (statusEl) statusEl.textContent = '\u274c ' + (rMenu && rMenu.fehler || 'Fehler'); return; }

  var races = uitsEvenementenParseMenu(rMenu.data.html || '');
  if (!races.length) { if (statusEl) statusEl.textContent = '\u274c Keine Strecken gefunden'; return; }

  // Ort-Fallback: häufigstes Großwort in Streckennamen
  if (!evOrt) {
    var stopWords = /^(van|der|de|het|den|een|voor|uit|met|bij|hotel|logistics|kilometer|marathon|loop|run|kids|baby|bambino|kidzbase|rabobank|scelta|mushrooms|viking|seacon|valk|halve)$/i;
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
      var pageUrl = baseUrl + 'uitslag.php?on=' + encodeURIComponent(race.on) + '&p=' + page;
      var rPage = await apiGet('uits-fetch?url=' + encodeURIComponent(pageUrl));
      if (!rPage || !rPage.ok) { _bkDbgLine(race.text, 'S.' + page + ' Fehler: ' + (rPage && rPage.fehler || '?')); break; }
      // Datum aus erster Seite extrahieren
      if (ri === 0 && page === 1 && rPage.data && rPage.data.html) {
        var _pageHtml = rPage.data.html;
        // Debug: zeige ersten 300 Zeichen des HTML für Datum-Diagnose
        var _nlM = {januari:1,februari:2,maart:3,april:4,mei:5,juni:6,juli:7,augustus:8,september:9,oktober:10,november:11,december:12};
        var _datPat = /(\d{1,2})\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+(\d{4})/i;
        var _mDp = _pageHtml.match(_datPat);
        if (!_mDp) _mDp = _pageHtml.match(/(\d{2})-(\d{2})-(20\d\d)/);
        if (!_mDp) _mDp = _pageHtml.match(/(\d{2})\.(\d{2})\.(20\d\d)/);
        if (_mDp) {
          var _pd, _pm, _py;
          if (/[a-z]/i.test(_mDp[2]||'')) {
            _pd = parseInt(_mDp[1]); _pm = _nlM[(_mDp[2]||'').toLowerCase()]||1; _py = parseInt(_mDp[3]);
          } else {
            _pd = parseInt(_mDp[1]); _pm = parseInt(_mDp[2]); _py = parseInt(_mDp[3]);
          }
          var _dIso = _py + '-' + String(_pm).padStart(2,'0') + '-' + String(_pd).padStart(2,'0');
          var _dEl = document.getElementById('bk-datum');
          if (_dEl) { _dEl.value = _dIso; if (typeof bkSyncDatum === 'function') bkSyncDatum(_dIso); }
          _bkDbgLine('Datum', _dIso + ' (uitslag.php)');
        } else {
          // Kein Datum in uitslag.php → Jahr aus URL, Monat/Tag manuell nötig
          _bkDbgLine('Datum', '⚠ nicht gefunden – bitte manuell eintragen (' + evYear + ')');
          // Datum-Feld leeren damit Nutzer es sieht
          var _dEl2 = document.getElementById('bk-datum');
          if (_dEl2) { _dEl2.value = ''; if (typeof bkSyncDatum === 'function') bkSyncDatum(''); }
          // Notify
          notify('📅 Datum nicht automatisch gefunden – bitte manuell eingeben!', 'err');
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
  if (evEl  && !evEl.value)  evEl.value  = evName;
  if (ortEl && !ortEl.value && evOrt) ortEl.value = evOrt;

  var bulkRows = ownRows.map(function(row) {
    var mid  = uitsEvenementenDiszFromStrecke(row.strecke, state.disziplinen, kat);
    var disz = mid ? ((state.disziplinen||[]).find(function(d){return (d.id||d.mapping_id)==mid;})||{}).disziplin||'' : '';
    return { name: row.name, resultat: row.zeit, ak: row.ak, platz: row.platz, disziplin: disz, diszMid: mid };
  });

  await bulkFillFromImport(bulkRows, statusEl);
}
// ── Disziplin aus Streckenname (evenementen.uitslagen.nl) ────────────────────
// Streckenname enthält Distanz: "halve marathon", "10 kilometer", "5 kilometer", "1 km", "500 m"
function uitsEvenementenDiszFromStrecke(streckeName, disziplinen, kat) {
  var sn = (streckeName || '').toLowerCase();
  var katDisz = kat ? disziplinen.filter(function(d){ return d.tbl_key === kat; }) : disziplinen;
  if (!katDisz.length) katDisz = disziplinen;
  if (!katDisz.length) return null;

  // Distanz in Metern aus Streckenname
  var distM = null;
  if (/halve?\s+marathon/i.test(sn))             distM = 21097;
  else if (/\bmarathon\b/i.test(sn))             distM = 42195;
  else {
    var kmM = sn.match(/(\d+[.,]?\d*)\s*kilometer/i) || sn.match(/(\d+[.,]?\d*)\s*km\b/i);
    if (kmM) distM = Math.round(parseFloat(kmM[1].replace(',', '.')) * 1000);
    else {
      var mM = sn.match(/(\d+)\s*m\b/i);
      if (mM) distM = parseInt(mM[1]);
    }
  }
  if (distM === null) return katDisz[0].mapping_id || katDisz[0].id;

  // 1. Versuch: distanz-Feld (Meter) aus Disziplin-Mapping
  var bestMid = null, bestDiff = Infinity;
  katDisz.forEach(function(d) {
    var dDist = parseFloat(d.distanz) || 0;
    if (dDist > 0) {
      var diff = Math.abs(dDist - distM);
      if (diff < bestDiff) { bestDiff = diff; bestMid = d.mapping_id || d.id; }
    }
  });
  if (bestMid && bestDiff < distM * 0.15) return bestMid;

  // 2. Versuch: Keyword-Match im Disziplinnamen
  var kwMid = null;
  katDisz.forEach(function(d) {
    var dn = (d.disziplin || '').toLowerCase().replace(/[\s.,]/g, '');
    var mid = d.mapping_id || d.id;
    if (distM === 21097 && (dn.includes('21') || dn.includes('halbmarathon') || dn.includes('halvemarathon'))) kwMid = mid;
    else if (distM === 42195 && (dn.includes('42') || dn === 'marathon')) kwMid = mid;
    else if (distM === 10000 && dn.includes('10') && !dn.includes('100')) kwMid = mid;
    else if (distM === 5000  && (dn === '5km' || dn === '5000m' || dn.includes('5km'))) kwMid = mid;
    else if (distM === 3000  && (dn === '3km' || dn === '3000m')) kwMid = mid;
    else if (distM === 1000  && (dn === '1km' || dn === '1000m')) kwMid = mid;
    else if (distM === 500   && (dn === '500m' || dn.includes('500'))) kwMid = mid;
  });
  if (kwMid) return kwMid;

  // 3. Fallback: erste Disziplin der Kategorie
  return katDisz[0].mapping_id || katDisz[0].id;
}

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
    if (ortEl && !ortEl.value) ortEl.value = evOrt;
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
          if (evnEl && !evnEl.value) evnEl.value = evName;
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
      return { id: id, rows: rows, nettoIdx: nettoIdx, akPlatzIdx: akPlatzIdx, akRankMap: akRankMap, diszHint: diszHint, nameIdx: nameIdx, genderIdx: genderIdx, akIdx: akIdx };
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
      parsedRows.push({ name: name, zeit: zeit, ak: acnParseAk(akRaw, gender), platz: akPlatz, diszHint: race.diszHint });
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
    return { name: row.name, resultat: row.zeit, ak: row.ak, platz: row.platz, disziplin: r2.disz, diszMid: r2.diszMid };
  });

  bulkFillFromImport(bulkRows, statusEl);
}

async function bulkFillFromImport(rows, statusEl) {
  if (!rows.length) {
    if (statusEl) statusEl.textContent = '⚠ Keine TuS-Einträge gefunden';
    return;
  }
  // ── Laufserie erkennen: gleicher Name+Disziplin mehrfach ─────────
  var _seriesKey = {};
  rows.forEach(function(r) {
    var k = (r.name||'') + '|' + (r.disziplin||'');
    if (!_seriesKey[k]) _seriesKey[k] = [];
    _seriesKey[k].push(r);
  });
  var _seriesGroups = Object.values(_seriesKey).filter(function(g) { return g.length > 1; });
  if (_seriesGroups.length > 0) {
    var _filtered = await bulkSeriesDialog(rows, _seriesGroups);
    if (_filtered === null) { if (statusEl) statusEl.textContent = ''; return; }
    rows = _filtered;
    if (!rows.length) { if (statusEl) statusEl.textContent = '⚠ Keine Einträge ausgewählt'; return; }
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
  var tbody = document.getElementById('bulk-rows');
  if (!tbody) return;

  // Leere Zeilen entfernen die beim Render automatisch hinzugefügt wurden
  Array.from(tbody.querySelectorAll('tr')).forEach(function(tr) {
    var athVal = (tr.querySelector('.bk-athlet') || {}).value || '';
    var resVal = (tr.querySelector('.bk-res')    || {}).value || '';
    if (!athVal && !resVal) tr.parentNode.removeChild(tr);
  });

  rows.forEach(function(row) {
    bulkAddRow();
    var tr = tbody.lastElementChild;
    if (!tr) return;

    // Athlet per Name matchen: 1. uitsAutoMatch, 2. nameMap aus Dialog
    var athSel = tr.querySelector('.bk-athlet');
    if (athSel && row.name) {
      var matched = uitsAutoMatch(row.name, state.athleten || []);
      if (!matched && _bnadNameMap[row.name]) matched = String(_bnadNameMap[row.name]);
      if (matched) {
        athSel.value = matched;
        var idx = _bulkRowCount - 1;
        bkUpdateAK(athSel, idx);
      }
    }
    // Disziplin setzen
    var diszSel = tr.querySelector('.bk-disz');
    if (diszSel && (row.disziplin || row.diszMid)) {
      var _matched = false;
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
            diszSel.value = diszSel.options[i].value; break;
          }
        }
      }
    }
    // Ergebnis
    var resEl = tr.querySelector('.bk-res');
    if (resEl && row.resultat) resEl.value = fmtRes(row.resultat);
    // AK
    var akSel = tr.querySelector('.bk-ak');
    if (akSel && row.ak) { akSel.value = row.ak; akSel.dataset.importAk = row.ak; }
    // Platz
    var platzEl = tr.querySelector('.bk-platz');
    if (platzEl && row.platz) platzEl.value = row.platz;
    // Datum pro Zeile (_datumOverride aus Tag-Dialog, sonst row.datum)
    var _rowDatum = row._datumOverride || row.datum || '';
    if (_rowDatum) {
      var zdEl = tr.querySelector('.bk-zeilendatum');
      if (zdEl) {
        var _dm = _rowDatum.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        zdEl.value = _dm ? _dm[3] + '.' + _dm[2] + '.' + _dm[1] : _rowDatum;
      }
    }
    // Extern-Checkbox
    var extChk = tr.querySelector('.bk-extern');
    if (extChk && row.extern) extChk.checked = true;
  });

  // Zeilennummern neu durchzählen
  var allRows = tbody.querySelectorAll('tr');
  for (var ni = 0; ni < allRows.length; ni++) {
    var numCell = allRows[ni].querySelector('td:first-child');
    if (numCell) numCell.textContent = ni + 1;
  }

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
    notify('GitHub-Einstellungen nicht konfiguriert (Admin \u2192 Darstellung).', 'err');
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
    '<h2>&#x26A0;&#xFE0F; Schlechten Import melden <button class="modal-close" onclick="closeModal()">&#x2715;</button></h2>' +
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
        '<h2>&#x2705; Import gemeldet <button class="modal-close" onclick="closeModal()">&#x2715;</button></h2>' +
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
    var kat = ((document.getElementById('bk-import-kat') || {}).value || '');
    if (!kat) {
      notify('Bitte Importkategorie wählen.', 'err');
      var katWrap = document.getElementById('bk-import-kat-wrap');
      if (katWrap) katWrap.style.display = 'flex';
      return;
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
    var kat = ((document.getElementById('bk-import-kat') || {}).value || '');
    if (!kat) {
      notify('Bitte Importkategorie wählen.', 'err');
      var katWrap = document.getElementById('bk-import-kat-wrap');
      if (katWrap) katWrap.style.display = 'flex';
      return;
    }
    bulkImportUrl();
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
      // Alles vor dem Zeitwert = Name
      var timeStr   = mRes[1];
      var beforeTime = line.slice(0, line.indexOf(timeStr)).trim();
      var afterTime  = line.slice(line.indexOf(timeStr) + timeStr.length).trim();

      // Name: letztes Wort entfernen wenn es "min", "s", "m" ist
      var namePart = beforeTime.replace(/\s+(min|sek|s|m|h)\s*$/, '').trim();

      // Platz: letzte Zahl in afterTime (Emojis ignorieren)
      var afterClean = afterTime.replace(/[🥇🥈🥉]/g, '').trim();
      var mPlatz = afterClean.match(/\b(\d+)\b/);
      var platz  = mPlatz ? parseInt(mPlatz[1]) : null;

      // Einheit aus afterTime (min, s etc.) → Format
      var unitRaw = afterTime.toLowerCase();

      if (namePart) {
        parsed.push({
          athlet:   namePart,
          disz:     curDisz,
          resultat: timeStr,
          ak:       curAK,
          platz:    platz,
          datum:    curDate,
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
  if (evName) { var ef = document.getElementById('bk-evname'); if (ef) ef.value = evName; }
  if (evOrt)  { var of = document.getElementById('bk-ort');    if (of) of.value = evOrt; }

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

    // Athlet-Select
    var athSel = tbody.querySelectorAll('.bk-athlet')[idx];
    if (athSel) {
      // Name normalisieren und matchen
      var athId = _bulkFindAthlet(p.athlet);
      if (athId) { athSel.value = athId; }
    }

    // Disziplin-Select
    var diszSel = tbody.querySelectorAll('.bk-disz')[idx];
    if (diszSel && p.disz) diszSel.value = p.disz;

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
    return s.toLowerCase()
      .replace(/ß/g,'ss').replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue')
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
    var athSel = tr.querySelector('.bk-athlet');
    var akInp  = tr.querySelector('.bk-ak');
    if (!akInp) return;
    if (!useCalculated) {
      // Zurück auf Import-Wert
      akInp.value = akInp.dataset.importAk || '';
      return;
    }
    if (!athSel || !athSel.value) return;
    var opt  = athSel.options[athSel.selectedIndex];
    var g    = opt ? (opt.dataset.g    || '') : '';
    var gebj = opt ? (opt.dataset.gebj || '') : '';
    if (g && gebj) {
      var ak = calcDlvAK(parseInt(gebj), g, eventJahr);
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
    var athSel = tr.querySelector('.bk-athlet');
    var akInp  = tr.querySelector('.bk-ak');
    if (!athSel || !athSel.value || !akInp) return;
    var opt  = athSel.options[athSel.selectedIndex];
    var g    = opt ? (opt.dataset.g    || '') : '';
    var gebj = opt ? (opt.dataset.gebj || '') : '';
    if (g && gebj) {
      var ak = calcDlvAK(parseInt(gebj), g, eventJahr);
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
    var eventName  = cfg.EventName || cfg.Name || cfg.eventname || '';
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
    var iYear=-1; var iGeschlecht=-1;

    var base4 = 'https://my.raceresult.com/' + eventId + '/RRPublish/data/list';
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
        iName = 3; iClub = 6; iNetto = -1; iZeit = -1; iPlatz = 2;
        if (Array.isArray(df) && df.length > 0) {
          for (var fi = 0; fi < df.length; fi++) {
            var f = df[fi].toLowerCase();
            if (f.indexOf('anzeigename') >= 0 || f.indexOf('lfname') >= 0 || f === 'displayname' || f === 'fullname') iName = fi;
            else if (f.indexOf('club') >= 0 || f.indexOf('verein') >= 0) iClub = fi;
            else if ((f.indexOf('agegroup') >= 0 || f === '[agegroup1.nameshort]' || f.indexOf('akabk') >= 0 || f.indexOf('ak_abk') >= 0 || f === 'es_akabkürzung' || f.indexOf('agegroupname') >= 0) && f.indexOf('rank') < 0) iAK = fi;
            else if (f.indexOf('flag') >= 0 || f.indexOf('nation') >= 0) { /* skip */ }
            else if (f === 'year' || f === 'yob' || f === 'birthyear' || f === 'es_jahrgang') iYear = fi;
            else if (f.indexOf('geschlechtmw') >= 0 || f === 'es_geschlecht' || f === 'gendermf' || f === 'gender' || f === 'sex') iGeschlecht = fi;
            else if (f.indexOf('chip') >= 0 || f.indexOf('netto') >= 0) iNetto = fi;
            else if (f.indexOf('gun') >= 0 || f.indexOf('brutto') >= 0 || f === 'ziel' || f.indexOf('ziel') >= 0 || f.indexOf('finish') >= 0) iZeit = fi;
            else if (f === 'time' || f.indexOf('time') === 0) iZeit = fi; // z.B. TIME1
            else if (/^rank\dp$/.test(f)) { if (f === 'rank1p') iPlatz = fi; else iAKPlatz = fi; }
            else if (f.indexOf('akpl') >= 0) iAKPlatz = fi;  // AKPlp, AKPl.P direkt
            else if (f.indexOf('autorankp') >= 0 || f.indexOf('overallrank') >= 0 || f.indexOf('withstatus') >= 0 || f.indexOf('mitstatus') >= 0 || f.indexOf('statusplatz') >= 0) { // withstatus BEFORE agegroup check
              // MitStatus([AKPlp]) / StatusPlatz([AKPl.P]) = AK-Platz
              if (f.indexOf('akpl') >= 0) iAKPlatz = fi;
              else iPlatz = fi;
            }
          }
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
                iName = 3; iClub = 6; iNetto = -1; iZeit = -1; iPlatz = 2;
                for (var _fai = 0; _fai < _dfAll.length; _fai++) {
                  var _fa = _dfAll[_fai].toLowerCase();
                  if (_fa.indexOf('anzeigename') >= 0 || _fa.indexOf('lfname') >= 0 || _fa === 'displayname' || _fa === 'fullname') iName = _fai;
                  else if (_fa.indexOf('club') >= 0 || _fa.indexOf('verein') >= 0) iClub = _fai;
                  else if ((_fa.indexOf('agegroup') >= 0 || _fa.indexOf('akabk') >= 0 || _fa.indexOf('agegroupname') >= 0) && _fa.indexOf('rank') < 0) iAK = _fai;
                  else if (_fa === 'year' || _fa === 'yob') iYear = _fai;
                  else if (_fa.indexOf('geschlechtmw') >= 0 || _fa === 'gendermf' || _fa === 'gender') iGeschlecht = _fai;
                  else if (_fa.indexOf('chip') >= 0 || _fa.indexOf('netto') >= 0) iNetto = _fai;
                  else if (_fa.indexOf('gun') >= 0 || _fa.indexOf('brutto') >= 0 || _fa === 'ziel' || _fa.indexOf('finish') >= 0 || _fa.indexOf('ziel') >= 0) iZeit = _fai;
                  else if (_fa.indexOf('akpl') >= 0) iAKPlatz = _fai;
                  else if (_fa.indexOf('mitstatus') >= 0 || _fa.indexOf('statusplatz') >= 0) { if (_fa.indexOf('akpl') >= 0) iAKPlatz = _fai; else iPlatz = _fai; }
                }
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
                iName: iName, iClub: iClub, iAK: iAK, iZeit: iZeit, iNetto: iNetto, iPlatz: iPlatz });
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
            iName = 3; iClub = 6; iNetto = -1; iZeit = -1; iPlatz = 2;
            for (var fi2 = 0; fi2 < df2.length; fi2++) {
              var f2 = df2[fi2].toLowerCase();
              if (f2.indexOf('anzeigename') >= 0 || f2.indexOf('lfname') >= 0 || f2 === 'displayname' || f2 === 'fullname') iName = fi2;
              else if (f2.indexOf('club') >= 0 || f2.indexOf('verein') >= 0) iClub = fi2;
              else if ((f2.indexOf('agegroup') >= 0 || f2.indexOf('akabk') >= 0 || f2.indexOf('ak_abk') >= 0 || f2 === 'es_akabkürzung') && f2.indexOf('rank') < 0) iAK = fi2;
              else if (f2 === 'year' || f2 === 'yob' || f2 === 'es_jahrgang') iYear = fi2;
              else if (f2.indexOf('geschlechtmw') >= 0 || f2 === 'es_geschlecht') iGeschlecht = fi2;
              else if (f2.indexOf('chip') >= 0 || f2.indexOf('netto') >= 0) iNetto = fi2;
              else if (f2.indexOf('gun') >= 0 || f2.indexOf('brutto') >= 0 || f2 === 'ziel' || f2.indexOf('finish') >= 0) iZeit = fi2;
              else if (f2.indexOf('akpl') >= 0) iAKPlatz = fi2;  // AKPlp, AKPl.P direkt
              else if (f2.indexOf('autorankp') >= 0 || f2.indexOf('mitstatus') >= 0 || f2.indexOf('statusplatz') >= 0) {
                if (f2.indexOf('akpl') >= 0) iAKPlatz = fi2;
                else iPlatz = fi2;
              }
            }
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
                    iName: iName, iClub: iClub, iAK: iAK, iZeit: iZeit, iNetto: iNetto, iPlatz: iPlatz });
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
          iName = 3; iClub = 6; iNetto = -1; iZeit = -1; iPlatz = 2;
          for (var _ffi = 0; _ffi < _fdf.length; _ffi++) {
            var _ff = _fdf[_ffi].toLowerCase();
            if (_ff.indexOf('anzeigename') >= 0 || _ff.indexOf('lfname') >= 0) iName = _ffi;
            else if (_ff.indexOf('club') >= 0 || _ff.indexOf('verein') >= 0) iClub = _ffi;
            else if ((_ff.indexOf('agegroup') >= 0 || _ff.indexOf('akabk') >= 0 || _ff === 'es_akabkürzung') && _ff.indexOf('rank') < 0) iAK = _ffi;
            else if (_ff === 'year' || _ff === 'yob' || _ff === 'es_jahrgang') iYear = _ffi;
            else if (_ff.indexOf('geschlechtmw') >= 0 || _ff === 'es_geschlecht') iGeschlecht = _ffi;
            else if (_ff.indexOf('chip') >= 0 || _ff.indexOf('netto') >= 0) iNetto = _ffi;
            else if (_ff.indexOf('gun') >= 0 || _ff.indexOf('brutto') >= 0 || _ff.indexOf('ziel') >= 0) iZeit = _ffi;
            else if (_ff.indexOf('mitstatus') >= 0 || _ff.indexOf('statusplatz') >= 0) { if (_ff.indexOf('akpl') >= 0) _fiAKPlatz = _ffi; else iPlatz = _ffi; }
          }
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
                  iYear: iYear, iGeschlecht: iGeschlecht, iName: iName, iClub: iClub, iAK: iAK, iZeit: iZeit, iNetto: iNetto, iPlatz: iPlatz });
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

function rrBestDisz(rrName, diszList) {
  // Mehrsprachiges Format auflösen: "{DE:Köln Marathon|EN:Cologne Marathon}" → "Köln Marathon"
  var _ml = (rrName||'').match(/\{DE:([^|}]+)/i);
  if (_ml) rrName = _ml[1].trim();
  else { var _mlen = (rrName||'').match(/\{[A-Z]{2}:([^|}]+)/i); if (_mlen) rrName = _mlen[1].trim(); }
  // Extrahiert Schlüsselbegriffe aus dem RR-Namen und sucht besten Treffer in System-Disziplinen
  var q = rrName.toLowerCase()
    .replace(/^#\d+_/, '')  // "#1_STADTWERKE Halbmarathon" → "stadtwerke halbmarathon"
    .replace(/lauf|rennen|wettbewerb|gesamt|einzel|lauf-/gi, '')
    .replace(/\s+/g, ' ').trim();

  // Zahl + Einheit extrahieren und in Meter normalisieren
  var qNorm = q.replace(/(\d)\.(\d{3})(?!\d)/g, '$1$2'); // 5.000 → 5000
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
    // Einzelne Wörter matchen
    var words = q.split(/\s+/);
    for (var w = 0; w < words.length; w++) {
      if (words[w].length > 2 && dl.indexOf(words[w]) >= 0) score += 2;
    }
    // Keyword-Bonus — Marathon vs Halbmarathon präzise unterscheiden
    var _qHalb = q.indexOf('halb') >= 0 || q.indexOf('half') >= 0;
    var _dHalb = dl.indexOf('halb') >= 0;
    if (q.indexOf('marathon') >= 0 && dl.indexOf('marathon') >= 0) {
      score += (_qHalb === _dHalb) ? 10 : -5; // Match: +10, Mismatch: -5
    }
    if (_qHalb && _dHalb) score += 5;
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
    var name  = String(raw[r.iName]  || '').trim();
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
        '<input id="rr-evname" type="text" value="' + eventName + '" style="padding:7px 10px;border:1px solid var(--border);border-radius:7px;font-size:16px;background:var(--surface);color:var(--text);width:100%"/></div>' +
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
    items.push({
      datum: datum, ort: ort, veranstaltung_name: evname,
      athlet_id: athletId, disziplin: disziplin,
      resultat: zeit, altersklasse: ak,
      ak_platzierung: platzAKv,
      meisterschaft: _mstrVal,
      ak_platz_meisterschaft: _mstrPlatz,
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
    '<h2>&#x1F382; Geburtsjahr übernehmen? <button class="modal-close" onclick="closeModal()">&#x2715;</button></h2>' +
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
  if (!confirm('Ergebnis in den Papierkorb verschieben?')) return;
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
              '<input type="radio" name="rruk-action-' + i + '" value="map" checked onchange="rrukToggle(' + i + ',\'map\')"> DLV-AK zuordnen' +
            '</label>' +
            '<label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer">' +
              '<input type="radio" name="rruk-action-' + i + '" value="keep" onchange="rrukToggle(' + i + ',\'keep\')"> So übernehmen' +
            '</label>' +
            '<label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer">' +
              '<input type="radio" name="rruk-action-' + i + '" value="empty" onchange="rrukToggle(' + i + ',\'empty\')"> Leer lassen' +
            '</label>' +
          '</div>' +
          '<div id="rruk-map-' + i + '" style="margin-top:6px">' +
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
        notify('Fehler beim Anlegen von "' + c.name + '".', 'err');
        return;
      }
    }
  }

  closeModal();
  window._bnadResolve(nameMap);
}

// ── Laufserie-Dialog ─────────────────────────────────────────
async function bulkSeriesDialog(rows, seriesGroups) {
  return new Promise(function(resolve) {
    // Pro Gruppe: Athlet + Disziplin + alle Läufe
    var sections = '';
    seriesGroups.forEach(function(group, gi) {
      var firstName = group[0].name;
      var disz = group[0].disziplin || '?';
      var opts = group.map(function(r, ri) {
        var key = 'bsd-' + gi + '-' + ri;
        return '<label style="display:flex;align-items:center;gap:8px;padding:6px 10px;' +
          'border:1px solid var(--border);border-radius:7px;cursor:pointer;font-size:13px;' +
          'background:var(--surface)">' +
          '<input type="checkbox" id="' + key + '" value="' + gi + '_' + ri + '" checked ' +
          'style="width:15px;height:15px;accent-color:var(--btn-bg);cursor:pointer">' +
          '<span style="font-family:\'Barlow Condensed\',monospace;font-weight:700;font-size:15px;min-width:80px">' +
            fmtTime(r.resultat) +
          '</span>' +
          '<span style="color:var(--text2);font-size:12px">' +
            (r.ak ? '<span style="background:var(--primary);color:var(--on-primary);border-radius:4px;padding:1px 6px;font-size:11px;margin-right:4px">' + r.ak + '</span>' : '') +
            (r.platz ? 'Platz ' + r.platz : '') +
          '</span>' +
        '</label>';
      }).join('');

      sections +=
        '<div style="margin-bottom:18px">' +
          '<div style="font-weight:600;font-size:14px;margin-bottom:8px">' +
            '<span style="font-family:\'Barlow Condensed\',monospace">' + firstName + '</span>' +
            '<span style="color:var(--text2);font-size:12px;margin-left:8px">' + disz + ' · ' + group.length + ' Läufe</span>' +
          '</div>' +
          '<div style="display:flex;flex-wrap:wrap;gap:6px">' + opts + '</div>' +
        '</div>';
    });

    var html =
      '<h3 style="margin:0 0 6px;font-size:17px">🏃\ufe0e Laufserie erkannt</h3>' +
      '<p style="color:var(--text2);font-size:13px;margin:0 0 20px">' +
        'Einige Athleten erscheinen mehrfach mit der gleichen Disziplin — typisch für eine Laufserie. ' +
        'Bitte wähle welche Läufe eingetragen werden sollen.' +
      '</p>' +
      sections +
      '<div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:4px">' +
        '<button class="btn btn-ghost btn-sm" onclick="bsdSelectAll(true)">Alle</button>' +
        '<button class="btn btn-ghost btn-sm" onclick="bsdSelectAll(false)">Keine</button>' +
        '<button class="btn btn-ghost" onclick="closeModal();window._bsdResolve(null)">Abbrechen</button>' +
        '<button class="btn btn-primary" onclick="bsdConfirm()">Weiter →</button>' +
      '</div>';

    window._bsdResolve = resolve;
    window._bsdRows = rows;
    window._bsdGroups = seriesGroups;
    showModal(html, true);
  });
}

function bsdSelectAll(checked) {
  document.querySelectorAll('[id^="bsd-"]').forEach(function(cb) { cb.checked = checked; });
}

function bsdConfirm() {
  var rows = window._bsdRows || [];
  var groups = window._bsdGroups || [];

  // Baue Set der ausgewählten Einträge (gi_ri Schlüssel)
  var selectedKeys = new Set();
  document.querySelectorAll('[id^="bsd-"]:checked').forEach(function(cb) {
    selectedKeys.add(cb.value);
  });

  // Baue Set der Einträge die durch Laufserie betroffen sind
  var seriesRowSets = {}; // gi → Set von row-Objekten
  groups.forEach(function(group, gi) {
    seriesRowSets[gi] = new Set(group);
  });

  // Filtere: behalte Row wenn entweder nicht in einer Serie, oder in selectedKeys
  var filtered = rows.filter(function(row) {
    // Prüfe ob diese Row in einer Seriengruppe ist
    for (var gi = 0; gi < groups.length; gi++) {
      var group = groups[gi];
      var ri = group.indexOf(row);
      if (ri >= 0) {
        // In Serie → nur wenn ausgewählt
        return selectedKeys.has(gi + '_' + ri);
      }
    }
    // Nicht in Serie → immer behalten
    return true;
  });

  closeModal();
  window._bsdResolve(filtered);
}

// ── Tag-Datum-Dialog für Laufserien ──────────────────────────
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
