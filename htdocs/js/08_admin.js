
async function renderAdminSystem() {
  var el = document.getElementById('main-content');
  el.innerHTML = adminSubtabs() + '<div class="loading" style="padding:32px;text-align:center"><div class="spinner"></div> Lade System-Informationen&hellip;</div>';
  var r = await apiGet('admin-dashboard');
  if (!r || !r.ok) { el.innerHTML = adminSubtabs() + '<div style="color:var(--accent);padding:20px">Fehler beim Laden.</div>'; return; }
  var d = r.data;
  var s = d.stats || {};
  // GitHub-Token Ablaufdatum aus Einstellungen lesen
  var ghExpiry = null;
  var daysLeft = null;
  var _ghExpStr = (appConfig && appConfig.github_token_expires) ? appConfig.github_token_expires.trim() : '';
  if (appConfig && appConfig.github_repo && appConfig.github_token && _ghExpStr) {
    ghExpiry = _ghExpStr;
    daysLeft = Math.ceil((new Date(_ghExpStr) - new Date()) / 86400000);
  }

  function fmtDate(iso) {
    if (!iso) return '\u2013';
    return new Date(iso).toLocaleString('de-DE', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
  }
  function fmtDateOnly(iso) {
    if (!iso) return '\u2013';
    return new Date(iso).toLocaleDateString('de-DE', {day:'2-digit',month:'2-digit',year:'numeric'});
  }
  function timeSince(iso) {
    if (!iso) return '\u2013';
    var diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60) return 'gerade eben';
    if (diff < 3600) return Math.floor(diff/60) + ' Min. her';
    if (diff < 86400) return Math.floor(diff/3600) + ' Std. her';
    return new Date(iso).toLocaleDateString('de-DE');
  }
  function badge(rolle) {
    var colors = { admin: 'var(--accent)', editor: 'var(--primary)', athlet: '#2ecc71', leser: 'var(--text2)' };
    var c = colors[rolle] || 'var(--text2)';
    return '<span style="display:inline-block;padding:1px 7px;border-radius:10px;font-size:11px;font-weight:600;background:' + c + '22;color:' + c + '">' + (rolle||'\u2013') + '</span>';
  }

  // phpBB-style stat row
  function srow(label, val, bold) {
    return '<tr>' +
      '<td style="padding:7px 12px;border-bottom:1px solid var(--border);color:var(--text2);font-size:13px">' + label + '</td>' +
      '<td style="padding:7px 12px;border-bottom:1px solid var(--border);font-size:13px;' + (bold!==false?'font-weight:700':'') + '">' + val + '</td>' +
    '</tr>';
  }
  function shead(label) {
    return '<tr><th colspan="2" style="padding:8px 12px;background:var(--primary);color:#fff;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px">' + label + '</th></tr>';
  }
  function stable(rows) {
    return '<div style="border:1px solid var(--border);border-radius:8px;overflow:hidden"><table class="admin-phpbb-table" style="width:100%;border-collapse:collapse"><colgroup><col><col></colgroup>' + rows + '</table></div>';
  }

  // Left column
  var leftRows =
    shead('System') +
    srow('Portal-Version', (function(){ var s2 = document.querySelector('script[src*="app.js"]'); if (!s2) return '–'; var m = s2.src.match(/v=(\d+)/); return m ? 'v' + m[1] : '–'; })()) +
    srow('Portal in Betrieb seit', fmtDate(s.portalSeit)) +
    srow('Datenbank-Server', d.dbVersion || '\u2013') +
    srow('Datenbank-Gr&ouml;&szlig;e', d.dbSize !== null ? d.dbSize + ' MB' : '\u2013') +
    srow('PHP-Version', d.phpVersion || '\u2013') +
    (ghExpiry ? srow('GitHub-Token l\u00e4uft ab', (function(){
      var expDate = new Date(ghExpiry);
      var dl = Math.ceil((expDate - new Date()) / 86400000);
      var dateStr = expDate.toLocaleDateString('de-DE');
      var suffix = dl > 0 ? ' (noch ' + dl + ' Tag' + (dl === 1 ? '' : 'e') + ')' : ' (\u26a0\ufe0e abgelaufen!)';
      var style = dl <= 14 ? 'color:#e53935;font-weight:700' : '';
      return style ? '<span style="' + style + '">' + dateStr + suffix + '</span>' : dateStr + suffix;
    })()) : '') +
    shead('Benutzer') +
    srow('Anzahl Benutzer (aktiv)', s.benutzer || 0) +
    srow('Neuester Benutzer', (s.neusterBenutzer || '\u2013') + (s.neusterBenutzerDatum ? ' <span style="font-weight:400;color:var(--text2);font-size:11px">(' + fmtDateOnly(s.neusterBenutzerDatum) + ')</span>' : '')) +
    shead('Seitenaufrufe') +
    srow('Heute', d.aufrufe.heute || 0) +
    srow('Gestern', d.aufrufe.gestern || 0) +
    srow('Letzte 7 Tage', d.aufrufe['7tage'] || 0);

  // Right column
  var rightRows =
    shead('Ergebnisse & Veranstaltungen') +
    srow('Anzahl Ergebnisse', (s.ergebnisse||0).toLocaleString('de-DE')) +
    srow('Ergebnisse pro Jahr', s.ergebnisseProJahr || 0) +
    srow('Erstes Ergebnis', fmtDateOnly(s.erstesErgebnisDatum)) +
    srow('Anzahl Veranstaltungen', s.veranstaltungen || 0) +
    srow('Veranstaltungen pro Jahr', s.veranstaltungenProJahr || 0) +
    shead('Athleten & Daten') +
    srow('Anzahl Athleten', s.athleten || 0) +
    srow('Davon aktiv', s.athletenAktiv || 0) +
    srow('Externe PBs', s.externePBs || 0) +
    srow('Importierte Ergebnisse', (s.importiert||0).toLocaleString('de-DE')) +
    srow('Gemappte Disziplinen', s.disziplinen || 0) +
    shead('Wartung') +
    srow('Papierkorb (Ergebnisse)', s.papierkorb || 0) +
    srow('Offene Antr&auml;ge', s.antraege ? '<span style="color:var(--accent);font-weight:700">' + s.antraege + '</span>' : 0, false) +
    srow('Ausstehende Registrierungen', s.registrierungen ? '<span style="color:var(--accent);font-weight:700">' + s.registrierungen + '</span>' : 0, false);

  // Active users table
  var aktiveRows = (d.aktiveBenutzer || []).map(function(u) {
    var av = avatarHtml(u.avatar, u.name || '?', 32, 12);
    return '<tr><td style="padding:7px 10px"><div style="display:flex;align-items:center;gap:8px">' + av +
      '<span style="font-weight:600">' + (u.name||u.email||'?') + '</span></div></td>' +
      '<td style="padding:7px 10px">' + badge(u.rolle) + '</td>' +
      '<td style="padding:7px 10px;font-size:12px;color:var(--text2)">' + timeSince(u.seit) + '</td></tr>';
  }).join('') || '<tr><td colspan="3" style="padding:14px;text-align:center;color:var(--text2);font-size:13px">Niemand aktiv</td></tr>';

  var loginRows = (d.letzteLogins || []).map(function(l) {
    var cc = (l.countryCode || '').toUpperCase();
    var flag = cc.length===2 ? String.fromCodePoint(0x1F1E6+cc.charCodeAt(0)-65)+String.fromCodePoint(0x1F1E6+cc.charCodeAt(1)-65) : '';
    var geoStr = (flag?flag+' ':'') + (l.country || '');
    var ok = l.erfolg;
    var failRed = '#c0392b';
    return '<tr style="' + (ok?'':'background:rgba(192,57,43,.07)') + '">' +
      '<td style="padding:6px 10px">' +
      '<span style="font-weight:600">' + (l.anzeigeName || l.benutzername || '\u2013') + '</span>' +
      (l.rolle ? ' ' + badge(l.rolle) : '') +
      ((l.benutzername && l.benutzername !== l.anzeigeName) ? '<br><span style="font-size:11px;color:var(--text2)">' + l.benutzername + '</span>' : '') +
    '</td>' +
      '<td style="padding:6px 10px;font-size:12px;white-space:nowrap">' +
        '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:'+(ok?'#27ae60':failRed)+';margin-right:5px"></span>' +
        '<span style="color:'+(ok?'inherit':failRed)+';font-weight:'+(ok?'400':'700')+'">' + (ok?'Erfolg':'Fehlschlag') + '</span>' +
        (l.methode ? ' <span style="font-size:10px;opacity:.7;margin-left:4px">' + ({'password':'&#x1F511;','email':'&#x1F4E7;','passkey':'&#x1F5DD;\uFE0F','totp':'&#x1F4F1;'}[l.methode] || '') + ' ' + l.methode + '</span>' : '') +
      '</td>' +
      '<td style="padding:6px 10px;font-size:11px;color:var(--text2)">' + (geoStr||'\u2013') + '</td>' +
      '<td style="padding:6px 10px;font-size:11px;font-family:monospace;color:var(--text2)">' + (l.ip||'\u2013') + '</td>' +
      '<td style="padding:6px 10px;font-size:11px;color:var(--text2)">' + fmtDate(l.datum) + '</td>' +
    '</tr>';
  }).join('') || '<tr><td colspan="5" style="padding:14px;text-align:center;color:var(--text2);font-size:13px">Keine Eintr&auml;ge</td></tr>';

  var gaesteRows = (d.gaeste || []).map(function(g) {
    return '<tr>' +
      '<td style="padding:6px 10px;font-family:monospace;font-size:12px">' + (g.ip||'\u2013') + '</td>' +
      '<td style="padding:6px 10px;font-size:12px;color:var(--text2)">' + (g.countryCode ? String.fromCodePoint(0x1F1E6+g.countryCode.charCodeAt(0)-65)+String.fromCodePoint(0x1F1E6+g.countryCode.charCodeAt(1)-65)+' ' : '') + (g.country || '\u2013') + '</td>' +
      '<td style="padding:6px 10px;font-size:11px;color:var(--text2);max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (g.user_agent||'').replace(/^Mozilla\/5\.0 /,'').slice(0,70) + '</td>' +
      '<td style="padding:6px 10px;font-size:12px;color:var(--text2)">' + timeSince(g.zuletzt) + '</td>' +
      '<td style="padding:6px 10px;font-size:12px;text-align:right">' + g.aufrufe + '</td>' +
    '</tr>';
  }).join('') || '<tr><td colspan="5" style="padding:14px;text-align:center;color:var(--text2);font-size:13px">Keine Gast-Besucher</td></tr>';

  function thStyle(t, extra) { return '<th style="padding:7px 10px;text-align:left;font-size:11px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:.4px' + (extra||'') + '">' + t + '</th>'; }

  el.innerHTML = adminSubtabs() +
    '<h2 style="margin-bottom:18px">&#x1F5A5;&#xFE0E; System-Dashboard</h2>' +

    // phpBB-style two-column stat tables
    '<div class="admin-sys-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px">' +
      '<div>' + stable(leftRows) + '</div>' +
      '<div>' + stable(rightRows) + '</div>' +
    '</div>' +



    // G&auml;ste
    '<div class="panel" style="margin-bottom:24px"><div class="panel-header"><div class="panel-title">&#x1F465; G&auml;ste <span style="font-size:12px;font-weight:400;opacity:.6">(letzte 15 Min.)</span></div></div>' +
      '<div class="table-scroll"><table class="admin-gaeste-table" style="width:100%"><thead><tr>' +
        thStyle('IP-Adresse') + thStyle('Land') + thStyle('Browser') + thStyle('Zuletzt') + thStyle('Aufrufe', ';text-align:right') +
      '</tr></thead><tbody>' + gaesteRows + '</tbody></table></div></div>' +

    // Aktive Benutzer + Letzte Logins
    '<div class="admin-sys-grid" style="display:grid;grid-template-columns:3fr 7fr;gap:16px;margin-bottom:24px">' +
      '<div class="panel"><div class="panel-header"><div class="panel-title">&#x1F7E2; Aktiv <span style="font-size:12px;font-weight:400;opacity:.6">(letzte 5 Min.)</span></div></div>' +
        '<table class="admin-aktiv-table" style="width:100%"><thead><tr>' + thStyle('Benutzer') + thStyle('Rolle') + thStyle('Aktiv seit') + '</tr></thead>' +
        '<tbody>' + aktiveRows + '</tbody></table></div>' +
      '<div class="panel"><div class="panel-header"><div class="panel-title">&#x1F550; Letzte Logins</div></div>' +
        '<div class="table-scroll"><table class="admin-login-table" style="width:100%;table-layout:fixed;border-collapse:collapse"><thead><tr>' + thStyle('Benutzer', ';width:28%') + thStyle('Status', ';width:22%') + thStyle('Land', ';width:14%') + thStyle('IP', ';width:16%') + thStyle('Zeitpunkt', ';width:20%') + '</tr></thead>' +
        '<tbody>' + loginRows + '</tbody></table></div></div>' +
    '</div>';

}
async function renderAdminAntraege() {
  var el = document.getElementById('main-content');
  el.innerHTML = adminSubtabs() + '<div class="loading"><div class="spinner"></div>Laden&hellip;</div>';

  var r = await apiGet('ergebnis-aenderungen?status=pending');
  if (!r || !r.ok) { el.innerHTML = adminSubtabs() + '<div style="color:var(--accent);padding:20px">Fehler beim Laden.</div>'; return; }

  var pending = r.data || [];

  // Auch bereits bearbeitete laden
  var rDone = await apiGet('ergebnis-aenderungen?status=approved');
  var rRej  = await apiGet('ergebnis-aenderungen?status=rejected');
  var done  = ((rDone&&rDone.ok?rDone.data:[])||[]).concat((rRej&&rRej.ok?rRej.data:[])||[])
                .sort(function(a,b){ return b.id - a.id; }).slice(0, 20);

  var html = adminSubtabs();

  // Pending
  html += '<div class="panel" style="margin-bottom:20px">' +
    '<div class="panel-header">' +
      '<div class="panel-title">✋ Offene Antr&auml;ge (' + pending.length + ')</div>' +
    '</div>';

  if (!pending.length) {
    html += '<div style="padding:32px;text-align:center;color:var(--text2)"><div style="font-size:32px;margin-bottom:8px">✅</div>Keine offenen Antr&auml;ge</div>';
  } else {
    html += '<div style="padding:16px;display:flex;flex-direction:column;gap:12px">';
    for (var i = 0; i < pending.length; i++) {
      var a = pending[i];
      var typBadge = a.typ === 'delete'
        ? '<span class="badge badge-inaktiv">🗑️ L&ouml;schen</span>'
        : a.typ === 'update'
          ? '<span class="badge badge-editor">✏️ &Auml;ndern</span>'
          : '<span class="badge badge-aktiv">➕ Eintragen</span>';

      var werte = '';
      if (a.neue_werte) {
        try {
          var v = typeof a.neue_werte === 'string' ? JSON.parse(a.neue_werte) : a.neue_werte;
          var vArr = [];
          if (v.resultat)     vArr.push('<strong>Ergebnis:</strong> ' + v.resultat);
          if (v.altersklasse) vArr.push('<strong>AK:</strong> ' + v.altersklasse);
          if (v.disziplin)    vArr.push('<strong>Disziplin:</strong> ' + v.disziplin);
          if (vArr.length) werte = '<div style="font-size:12px;color:var(--text2);margin-top:4px">' + vArr.join(' &middot; ') + '</div>';
        } catch(e) {}
      }

      html +=
        '<div style="border:1px solid var(--border);border-radius:8px;padding:14px;background:var(--surface)">' +
          '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px">' +
            typBadge +
            '<span style="font-weight:600">' + (a.beantragt_von_athlet && a.beantragt_von_athlet.trim() ? a.beantragt_von_athlet.trim() : (a.beantragt_von_name || 'Unbekannt')) + '</span>' +
            '<span style="font-size:12px;color:var(--text2)">' + (a.beantragt_am ? a.beantragt_am.slice(0,16).replace('T',' ') : '') + '</span>' +
            (a.veranstaltung_name ? '<span style="font-size:12px;color:var(--text2)">📍 ' + a.veranstaltung_name + (a.veranstaltung_datum ? ' &middot; ' + a.veranstaltung_datum.slice(0,10).split('-').reverse().join('.') : '') + (a.veranstaltung_ort ? ', ' + a.veranstaltung_ort : '') + '</span>' : '') +
          (a.typ !== 'insert' && a.ergebnis_id ? '<span style="font-size:11px;color:var(--text2)">Ergebnis #' + a.ergebnis_id + '</span>' : '') +
          '</div>' +
          werte +
          '<div style="display:flex;gap:8px;margin-top:12px">' +
            '<input type="text" id="antrag-kommentar-' + a.id + '" placeholder="Kommentar (optional)" style="flex:1;padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:13px">' +
            '<button class="btn btn-primary btn-sm" onclick="bearbeiteAntrag(' + a.id + ',\'approve\')">✓ Genehmigen</button>' +
            '<button class="btn btn-danger btn-sm" onclick="bearbeiteAntrag(' + a.id + ',\'reject\')">✗ Ablehnen</button>' +
          '</div>' +
        '</div>';
    }
    html += '</div>';
  }
  html += '</div>';

  // Ausstehende Veranstaltungen (genehmigt=0 oder geloescht mit Ergebnissen)
  var rFreigabe = await apiGet('veranstaltungen?pending=1');
  var pendingVeranst = (rFreigabe && rFreigabe.ok && rFreigabe.data.pending) ? rFreigabe.data.pending : [];
  if (pendingVeranst.length) {
    html += '<div class="panel" style="margin-bottom:20px">' +
      '<div class="panel-header">' +
        '<div class="panel-title">\ud83d\udccb Ausstehende Veranstaltungen (' + pendingVeranst.length + ')</div>' +
      '</div>' +
      '<div style="padding:16px;display:flex;flex-direction:column;gap:10px">';
    pendingVeranst.forEach(function(v) {
      var vname = v.name || v.kuerzel;
      var vdate = v.datum ? v.datum.split('-').reverse().join('.') : '';
      var isGeloescht = v.geloescht == 1;
      html += '<div style="border:1px solid var(--border);border-radius:8px;padding:14px;background:var(--surface);display:flex;align-items:center;gap:12px;flex-wrap:wrap">' +
        '<span style="font-weight:600">' + vname + '</span>' +
        (isGeloescht ? '<span class="badge badge-inaktiv">gel\u00f6scht</span>' : '<span class="badge badge-editor">unverf\u00f6fentlicht</span>') +
        '<span style="font-size:12px;color:var(--text2)">' + vdate + (v.ort ? ' \u00b7 ' + v.ort : '') + '</span>' +
        '<span style="font-size:12px;color:var(--text2);margin-left:auto">' + v.anz_ergebnisse + ' Ergebnisse</span>' +
        '<button class="btn btn-primary btn-sm" onclick="adminFreigebenVeranst(' + v.id + ',this,' + (isGeloescht?'true':'false') + ')">' +
          (isGeloescht ? '\u21a9 Wiederherstellen' : 'Freigeben') +
        '</button>' +
      '</div>';
    });
    html += '</div></div>';
  }

  // Zuletzt bearbeitete
  if (done.length) {
    html += '<div class="panel">' +
      '<div class="panel-header"><div class="panel-title">📋 Zuletzt bearbeitet</div></div>' +
      '<div class="done-table-wrap" style="overflow-x:auto"><table class="data-table" style="width:100%">' +
        '<thead><tr><th>Typ</th><th>Antragsteller</th><th>Veranstaltung</th><th>Eingereicht</th><th>Status</th><th>Bearbeitet von</th></tr></thead>' +
        '<tbody>';
    for (var j = 0; j < done.length; j++) {
      var d = done[j];
      var statusBadge = d.status === 'approved'
        ? '<span class="badge badge-aktiv">Genehmigt</span>'
        : '<span class="badge badge-inaktiv">Abgelehnt</span>';
      var typLabel = d.typ === 'delete' ? '🗑️ Löschen' : d.typ === 'update' ? '✏️ Ändern' : '➕ Eintragen';
      html += '<tr>' +
        '<td>' + typLabel + '</td>' +
        '<td>' + (d.beantragt_von_athlet && d.beantragt_von_athlet.trim() ? d.beantragt_von_athlet.trim() : (d.beantragt_von_name || '–')) + '</td>' +
        '<td style="color:var(--text2);font-size:12px">' + (d.veranstaltung_name ? (d.veranstaltung_datum ? d.veranstaltung_datum.slice(0,10).split('-').reverse().join('.') + ' ' : '') + d.veranstaltung_name : '–') + '</td>' +
        '<td style="color:var(--text2);font-size:12px">' + (d.beantragt_am ? d.beantragt_am.slice(0,16).replace('T',' ') : '–') + '</td>' +
        '<td>' + statusBadge + '</td>' +
        '<td style="color:var(--text2);font-size:12px">' + (d.bearbeitet_von_athlet && d.bearbeitet_von_athlet.trim() ? d.bearbeitet_von_athlet.trim() : (d.bearbeitet_von_name || '–')) + '</td>' +
        '<td style="color:var(--text2);font-size:12px">' + (d.kommentar || '–') + '</td>' +
      '</tr>';
    }
    html += '</tbody></table></div></div>';
  }

  el.innerHTML = html;
}

async function bearbeiteAntrag(id, action) {
  var kommentar = (document.getElementById('antrag-kommentar-' + id)||{}).value || '';
  var r = await apiPost('ergebnis-aenderungen/' + id, { action: action, kommentar: kommentar });
  if (r && r.ok) {
    notify(action === 'approve' ? '✅ Genehmigt.' : '❌ Abgelehnt.', action === 'approve' ? 'ok' : 'err');
    await renderAdminAntraege();
  } else {
    notify('Fehler: ' + ((r&&r.fehler)||'Unbekannt'), 'err');
  }
}


// Anträge-Zähler für Subtab-Badge aktualisieren
function _adminBadge(n) {
  return n > 0 ? ' <span style="background:var(--accent);color:#fff;border-radius:10px;padding:1px 6px;font-size:11px;margin-left:4px;font-weight:700">' + n + '</span>' : '';
}
async function _ladeAntraegeBadge() {
  if (!currentUser || currentUser.rolle === 'leser' || currentUser.rolle === 'athlet') return;
  try {
    // Anträge-Badge
    var r = await apiGet('ergebnis-aenderungen?status=pending');
    var n = r && r.ok ? (r.data||[]).length : 0;
    window._adminPendingAntraege = n;
    var btn = document.querySelector('.subtab[onclick*=\'antraege\']');
    if (btn) btn.innerHTML = '\u270B Antr\u00e4ge' + _adminBadge(n);
  } catch(e) {}
  try {
    // Registrierungen-Badge (ausstehende)
    var rr = await apiGet('auth/registrierungen');
    var _rrData = rr && rr.ok ? (Array.isArray(rr.data) ? rr.data : (rr.data.registrierungen||[])) : [];
    var nr = _rrData.filter(function(x){ return x.status==='pending'; }).length;
    window._adminPendingRegs = nr;
    var regBtn = document.querySelector('.subtab[onclick*=\'registrierungen\']');
    if (regBtn) regBtn.innerHTML = '\uD83D\uDCDD Registrierungen' + _adminBadge(nr);
  } catch(e) {}
  try {
    // Papierkorb-Badge
    var rp = await apiGet('papierkorb');
    var np = 0;
    if (rp && rp.ok) {
      var pd = rp.data || {};
      np = (pd.ergebnisse||[]).length + (pd.athleten||[]).length + (pd.veranstaltungen||[]).length;
    }
    window._adminPendingPapierkorb = np;
    var pkBtn = document.querySelector('.subtab[onclick*=\'papierkorb\']');
    if (pkBtn) pkBtn.innerHTML = '\uD83D\uDDD1\uFE0F Papierkorb' + _adminBadge(np);
  } catch(e) {}
  // Ausstehende Veranstaltungen (Freigabe)
  try {
    var _rfr = await apiGet('veranstaltungen?pending=1');
    window._adminPendingFreigabe = (_rfr && _rfr.ok && _rfr.data.pending) ? _rfr.data.pending.length : 0;
  } catch(e) {}
  // Benutzer ohne zugeordnetes Athletenprofil (nur Admin sieht die Liste)
  try {
    if (currentUser.rolle === 'admin') {
      var _rb = await apiGet('benutzer');
      var _bl = _rb && _rb.ok ? (_rb.data.benutzer || _rb.data || []) : [];
      window._adminUsersOhneAthlet = _bl.filter(function(u){ return u.aktiv && _userOhneAthlet(u); }).length;
    }
  } catch(e) {}
  _patchAdminNavBadge();
}

// Benutzer gilt als „ohne zugeordnetes Athletenprofil", wenn keine athlet_id
// gesetzt ist ODER die athlet_id auf keinen (mehr existierenden) Athleten auflöst
// (dangling – Athlet gelöscht). Dann ist auch athlet_name leer.
function _userOhneAthlet(u) {
  return !u.athlet_id || !String(u.athlet_name || '').trim();
}

// Benutzer-Subtab + kombinierten Top-Bar-„Admin"-Badge patchen –
// ohne buildNav()/Re-Render (das würde einen Loop erzeugen).
function _patchAdminNavBadge() {
  var ohne = (window._adminUsersOhneAthlet||0);
  // Benutzer-Subtab: ausstehende Registrierungen + Benutzer ohne Athletenprofil
  var benBtn = document.querySelector('.subtab[onclick*=\'benutzer\']');
  if (benBtn) benBtn.innerHTML = '👥 Benutzer' + _adminBadge((window._adminPendingRegs||0) + ohne);
  // Top-Bar „Admin": Summe ALLER Notification-Badges
  var _total = (window._adminPendingAntraege||0) + (window._adminPendingRegs||0)
    + (window._adminPendingFreigabe||0) + (window._adminPendingPapierkorb||0) + ohne;
  window._adminNavBadgeCount = _total;
  var _badge = _total > 0 ? ' <span style="background:var(--accent);color:#fff;border-radius:10px;padding:1px 5px;font-size:10px;font-weight:700;vertical-align:middle;line-height:1.4">' + _total + '</span>' : '';
  var _adminBtns = document.querySelectorAll('#main-nav button, #mobile-nav-items button');
  for (var _bi = 0; _bi < _adminBtns.length; _bi++) {
    var _oc = _adminBtns[_bi].getAttribute('onclick') || '';
    // Desktop: navigate('admin'), Mobile: mobileNavTo('admin') – Label steht direkt im Button.
    // Nav-Buttons sind flex-column → Text + Badge in einen Inline-Wrapper packen,
    // damit die Zahl NEBEN „Admin" steht und nicht darunter umbricht.
    if (_oc.indexOf('\'admin\'') >= 0) _adminBtns[_bi].innerHTML = '<span style="white-space:nowrap">Admin' + _badge + '</span>';
  }
}

function adminSubtabs() {
  var t = state.adminTab || 'system';
  return '<div class="subtabs" style="margin-bottom:20px">' +
    '<button class="subtab' + (t==='system'         ? ' active' : '') + '" onclick="navAdmin(\'system\')">&#x1F5A5;&#xFE0E; System</button>' +
    '<button class="subtab' + (t==='benutzer'       ? ' active' : '') + '" onclick="navAdmin(\'benutzer\')">&#x1F465; Benutzer' + _adminBadge((window._adminPendingRegs||0)+(window._adminUsersOhneAthlet||0)) + '</button>' +
    '<button class="subtab' + (t==='disziplinen'    ? ' active' : '') + '" onclick="navAdmin(\'disziplinen\')">&#x1F3F7;&#xFE0F; Disziplinen</button>' +
    '<button class="subtab' + (t==='altersklassen'  ? ' active' : '') + '" onclick="navAdmin(\'altersklassen\')">&#x1F464; Altersklassen</button>' +
    '<button class="subtab' + (t==='meisterschaften'? ' active' : '') + '" onclick="navAdmin(\'meisterschaften\')">&#x1F3C5; Meisterschaften</button>' +
    '<button class="subtab' + (t==='orte'           ? ' active' : '') + '" onclick="navAdmin(\'orte\')">&#x1F4CD; Orte</button>' +
    '<button class="subtab' + (t==='darstellung'    ? ' active' : '') + '" onclick="navAdmin(\'darstellung\')">&#x2699;&#xFE0F; Einstellungen</button>' +
    '<button class="subtab' + (t==='dashboard_cfg'  ? ' active' : '') + '" onclick="navAdmin(\'dashboard_cfg\')">&#x1F4CA;&#xFE0E; Dashboard</button>' +
    '<button class="subtab' + (t==='antraege'       ? ' active' : '') + '" onclick="navAdmin(\'antraege\')">✋ Anträge' + _adminBadge((window._adminPendingAntraege||0)+(window._adminPendingFreigabe||0)) + '</button>' +
    '<button class="subtab' + (t==='wartung'        ? ' active' : '') + '" onclick="navAdmin(\'wartung\')">🔧 Wartung</button>' +
    '<button class="subtab' + (t==='papierkorb'     ? ' active' : '') + '" onclick="navAdmin(\'papierkorb\')">🗑️ Papierkorb' + _adminBadge(window._adminPendingPapierkorb||0) + '</button>' +
    '<button class="subtab' + (t==='ergebnisse'     ? ' active' : '') + '" onclick="navAdmin(\'ergebnisse\')">&#x1F4CB;&#xFE0E; Ergebnisse</button>' +
    '<button class="subtab' + (t==='athleten'       ? ' active' : '') + '" onclick="navAdmin(\'athleten\')">&#x1F464; Athleten</button>' +
    '<button class="subtab' + (t==='veranstaltungen'? ' active' : '') + '" onclick="navAdmin(\'veranstaltungen\')">&#x1F4C5; Veranstaltungen</button>' +
  '</div>';
}

// ── Benutzertabelle Sort ─────────────────────────────────────
var _bSort = { col: 'name', dir: 1 };
function _bSortTh(label, col) {
  var active = _bSort.col === col;
  var arrow = active ? (_bSort.dir === 1 ? ' ↑' : ' ↓') : '';
  return '<th style="padding:8px 10px;text-align:left;font-size:12px;font-weight:600;cursor:pointer;user-select:none;' +
    (active ? 'color:var(--primary)' : 'color:var(--text2)') + '"' +
    ' onclick="sortBenutzerTabelle(\'' + col + '\')">' + label + arrow + '</th>';
}
function sortBenutzerTabelle(col) {
  if (_bSort.col === col) _bSort.dir *= -1; else { _bSort.col = col; _bSort.dir = 1; }
  var tbody = document.querySelector('#benutzer-tbody');
  if (!tbody) return;
  var rows = Array.from(tbody.querySelectorAll('tr'));
  rows.sort(function(a, b) {
    var av = a.dataset['sort' + col.charAt(0).toUpperCase() + col.slice(1)] || '';
    var bv = b.dataset['sort' + col.charAt(0).toUpperCase() + col.slice(1)] || '';
    return av < bv ? -_bSort.dir : av > bv ? _bSort.dir : 0;
  });
  rows.forEach(function(r) { tbody.appendChild(r); });
  // Spaltenheader neu rendern
  var thead = tbody.parentNode.querySelector('thead tr');
  if (!thead) return;
  var ths = thead.querySelectorAll('th[onclick]');
  var cols = ['name','athlet','rolle','status','login'];
  ths.forEach(function(th, i) {
    var c = cols[i];
    var active = _bSort.col === c;
    var arrow = active ? (_bSort.dir === 1 ? ' ↑' : ' ↓') : '';
    th.style.color = active ? 'var(--primary)' : 'var(--text2)';
    th.textContent = th.textContent.replace(/ [↑↓]$/, '') + arrow;
  });
}

async function renderAdmin() {
  if (!state.adminTab) state.adminTab = 'system';
  _ladeAntraegeBadge();
  if (state.adminTab === 'system')          { await renderAdminSystem(); return; }
  if (state.adminTab === 'disziplinen')    { await renderAdminDisziplinen(); return; }
  if (state.adminTab === 'altersklassen')  { await renderAdminAltersklassen(); return; }
  if (state.adminTab === 'meisterschaften'){ await renderAdminMeisterschaften(); return; }
  if (state.adminTab === 'orte')           { await renderAdminOrte(); return; }
  if (state.adminTab === 'antraege')        { await renderAdminAntraege(); return; }
  if (state.adminTab === 'wartung')        { await renderAdminWartung(); return; }
  if (state.adminTab === 'papierkorb')     { await renderPapierkorb(); return; }
  if (state.adminTab === 'darstellung')    { renderAdminDarstellung(); return; }
  if (state.adminTab === 'dashboard_cfg')  { await renderAdminDashboard(); return; }
  if (state.adminTab === 'ergebnisse')     { if (!state.subTab) state.subTab = 'strasse'; await renderErgebnisse(); return; }
  if (state.adminTab === 'athleten')       { await renderAthleten(); return; }
  if (state.adminTab === 'veranstaltungen'){ await renderAdminVeranstaltungen(); return; }
  var r = await apiGet('benutzer');
  if (!r || !r.ok) return;
  var benutzer = r.data.benutzer || r.data; // Rückwärtskompatibel
  state._adminAthleten = r.data.athleten || [];
  // Benutzer ohne zugeordnetes Athletenprofil zählen (aktive Benutzer) → Badge
  window._adminUsersOhneAthlet = benutzer.filter(function(u){ return u.aktiv && _userOhneAthlet(u); }).length;

  // Rollen laden (inkl. Trainingsportal-Rollen wie trainer) für Dropdowns + rolleLabel()
  try {
    var _rolR = await apiGet('rollen');
    if (_rolR && _rolR.ok && _rolR.data) {
      state._adminRollen = _rolR.data;
      window._rollenMap = {};
      state._adminRollen.forEach(function(ro) { window._rollenMap[ro.name] = ro; });
    }
  } catch(e) {}

  state._adminBenutzerMap = {};
  // Server-seitiger Online-Status für alle User laden
  var _onlineUserIds = [];
  try {
    var _onR = await apiGet('auth/online-status');
    if (_onR && _onR.ok && _onR.data) _onlineUserIds = _onR.data.user_ids || [];
  } catch(e) {}

  // Ausstehende Registrierungen laden
  var _pendingRegs = [];
  var _allRegs = [];
  try {
    var _regR = await apiGet('auth/registrierungen');
    if (_regR && _regR.ok) {
      var _regData = Array.isArray(_regR.data) ? { registrierungen: _regR.data, zugeordnete_athleten: [] } : _regR.data;
      _allRegs = _regData.registrierungen || _regR.data || [];
      window._zugeordneteAthleten = _regData.zugeordnete_athleten || [];
      _pendingRegs = _allRegs.filter(function(x) { return x.status === 'pending'; });
    }
  } catch(e) {}
  var tbody = '';
  for (var i = 0; i < benutzer.length; i++) {
    var b = benutzer[i];
    state._adminBenutzerMap[b.id] = b;
    var isOnline = _onlineUserIds.indexOf(b.id) >= 0 || _onlineUserIds.indexOf(String(b.id)) >= 0;
    var dispName = (b.athlet_vorname && b.athlet_vorname.trim()) ? b.athlet_vorname : b.email;
    // VN-Schema: Vorname[0] + Nachname[0] wenn Athlet zugewiesen
    // athlet_name = 'Nachname, Vorname' → erster Buchstabe ist Nachname
    var initials = (b.athlet_vorname && b.athlet_name)
      ? (b.athlet_vorname.trim()[0]||'').toUpperCase() + (b.athlet_name.trim()[0]||'').toUpperCase()
      : nameInitials(b.email);
    // Avatar mit überlappenden Dot
    var dotStatus = isOnline ? 'online' : null; // Punkt nur für eingeloggte User
    var avatarCell = avatarHtml(b.avatar_pfad, dispName, 36, 14, dotStatus, initials);
    var rolleText = '<span style="font-size:13px;color:var(--text)">' + rolleLabel(b.rolle) + '</span>';
    // 3-stufiger Status: Eingeloggt (grün) > Aktiv (akzent) > Inaktiv (gedämpft)
    var statusBadge = isOnline
      ? '<span class="badge badge-eingeloggt">Eingeloggt</span>'
      : (b.aktiv ? '<span class="badge badge-aktiv">Aktiv</span>' : '<span class="badge badge-inaktiv">Inaktiv</span>');
    var tfaBadges =
      (b.totp_aktiv ? '<span class="badge" style="background:#e3f2fd;color:#1565c0;border:1px solid #90caf9;font-size:11px" title="TOTP aktiv">&#x1F4F1; TOTP</span>' : '') +
      (b.passkey_count > 0 ? '<span class="badge" style="background:#e8f5e9;color:#1b5e20;border:1px solid #a5d6a7;font-size:11px" title="' + b.passkey_count + ' Passkey(s)">&#x1F511; ' + b.passkey_count + '</span>' : '') +
      (!b.totp_aktiv && !(b.passkey_count > 0) ? '<span class="badge" style="background:#fff3e0;color:#e65100;border:1px solid #ffcc80;font-size:11px" title="Anmeldung per E-Mail-Code (automatischer Fallback)">&#x1F4E7; E-Mail</span>' : '');
    var athletCell = b.athlet_id
      ? '<span style="font-size:12px">&#x1F3C3; ' + (b.athlet_name||'') + '</span>'
      : '<span style="color:var(--text2);font-size:12px">\u2013</span>';
    tbody += '<tr' +
      ' data-sort-name="' + dispName.toLowerCase() + '"' +
      ' data-sort-athlet="' + (b.athlet_name||'').toLowerCase() + '"' +
      ' data-sort-rolle="' + b.rolle + '"' +
      ' data-sort-status="' + (isOnline ? '0' : (b.aktiv ? '1' : '2')) + '"' +
      ' data-sort-login="' + (b.letzter_login || '0000') + '"' +
      '>' +
      '<td style="padding:8px 10px;overflow:visible">' + avatarCell + '</td>' +
      '<td style="padding:8px 10px">' +
        '<div style="font-weight:600;font-size:14px">' + dispName + '</div>' +
        '<div style="font-size:11px;color:var(--text2)">' + b.email + '</div>' +
      '</td>' +
      '<td style="padding:8px 10px">' + athletCell + '</td>' +
      '<td style="padding:8px 10px">' + rolleText + '</td>' +
      '<td style="padding:8px 10px">' + statusBadge + '</td>' +
      '<td style="padding:8px 10px"><div style="display:flex;gap:3px;flex-wrap:wrap">' +
        (tfaBadges || '<span style="color:var(--text2);font-size:12px">\u2013</span>') +
      '</div></td>' +
      '<td style="padding:8px 10px;font-size:11px;color:var(--text2);white-space:nowrap">' +
        (b.letzter_login ? formatDate(b.letzter_login.slice(0,10)) : 'Noch nie') +
      '</td>' +
      '<td style="padding:8px 10px;font-size:11px;color:var(--text2);white-space:nowrap">' +
        (b.erstellt_am ? formatDate(b.erstellt_am.slice(0,10)) : '–') +
      '</td>' +
      '<td style="padding:8px 8px;text-align:right">' +
        '<div style="display:flex;gap:4px;justify-content:flex-end">' +
          '<button class="btn btn-ghost btn-sm" onclick="showBenutzerEditModal(' + b.id + ')" title="Bearbeiten">\u270f\ufe0f</button>' +
          '<button class="btn btn-danger btn-sm" onclick="deleteBenutzer(' + b.id + ',\'' + b.email + '\')" title="L\xf6schen">&#x1F5D1;&#xFE0F;</button>' +
        '</div>' +
      '</td>' +
    '</tr>';
  }

  document.getElementById('main-content').innerHTML =
    adminSubtabs() +
    '<div class="panel" style="margin-bottom:20px">' +
      '<div class="panel-header"><div class="panel-title">&#x1F465; Benutzerverwaltung</div><button class="btn btn-primary btn-sm" onclick="showNeuerBenutzerModal()">+ Neuer Benutzer</button></div>' +
      '<div class="table-scroll"><table style="width:100%;border-collapse:collapse;table-layout:fixed">' +
        '<colgroup><col style="width:44px"><col><col style="width:150px"><col style="width:100px"><col style="width:80px"><col style="width:160px"><col style="width:105px"><col style="width:105px"><col style="width:78px"></colgroup>' +
        '<thead><tr style="border-bottom:2px solid var(--border)">' +
          '<th style="padding:8px 10px"></th>' +
          _bSortTh('Benutzer','name') +
          _bSortTh('Athlet','athlet') +
          _bSortTh('Rolle','rolle') +
          _bSortTh('Status','status') +
          '<th style="padding:8px 10px;text-align:left;font-size:12px;font-weight:600;color:var(--text2)">2FA</th>' +
          _bSortTh('Letzter Login','login') +
          '<th style="padding:8px 10px;text-align:left;font-size:12px;font-weight:600;color:var(--text2)">Registriert am</th>' +
          '<th></th>' +
        '</tr></thead>' +
        '<tbody id="benutzer-tbody">' + tbody + '</tbody>' +
      '</table></div>' +
    '</div>' +
    '<div class="panel" style="padding:20px">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">' +
        '<div class="panel-title">&#x2139;&#xFE0F; Rollen &amp; Rechte</div>' +
        '<button class="btn btn-primary btn-sm" onclick="showNeueRolleModal()">+ Neue Rolle</button>' +
      '</div>' +
      '<div id="rollen-manager-wrap"><div class="loading"><div class="spinner"></div></div></div>' +
    '</div>' +
    (function() {
      var _otherRegs = _allRegs.filter(function(x) { return x.status !== 'pending'; });
      var regHtml = '<div class="panel" style="margin-top:20px">' +
        '<div class="panel-header"><div class="panel-title">📝 Ausstehende Registrierungen' + (_pendingRegs.length ? ' (' + _pendingRegs.length + ')' : '') + '</div></div>';
      if (!_pendingRegs.length) {
        regHtml += '<div style="padding:20px;color:var(--text2);font-size:13px">Keine ausstehenden Registrierungen.</div>';
      } else {
        regHtml += '<div style="padding:16px;display:flex;flex-direction:column;gap:10px">';
        for (var _ri = 0; _ri < _pendingRegs.length; _ri++) {
          regHtml += _regCard(_pendingRegs[_ri], true);
        }
        regHtml += '</div>';
      }
      if (_otherRegs.length) {
        regHtml += '<div style="border-top:1px solid var(--border);padding:10px 16px 4px">' +
          '<div style="font-size:12px;font-weight:600;color:var(--text2);margin-bottom:8px">Abgeschlossene / abgelehnte Einträge</div>' +
          '<div style="display:flex;flex-direction:column;gap:8px">';
        for (var _ri2 = 0; _ri2 < _otherRegs.length; _ri2++) {
          regHtml += _regCard(_otherRegs[_ri2], false);
        }
        regHtml += '</div></div>';
      }
      regHtml += '</div>';
      return regHtml;
    })();
  _ladeRollenManager();
}

var _RECHTE_LISTE = [
  { key: 'vollzugriff',          label: 'Vollzugriff' },
  { key: 'benutzer_verwalten',   label: 'Benutzer verwalten' },
  { key: 'rekorde_bearbeiten',   label: 'Rekorde bearbeiten' },
  { key: 'einstellungen_aendern',label: 'Einstellungen ändern' },
  { key: 'alle_ergebnisse',      label: 'Alle Ergebnisse eintragen/ändern/löschen' },
  { key: 'eigene_ergebnisse',    label: 'Eigene Ergebnisse eintragen/ändern/löschen (nach Genehmigung)' },
  { key: 'bulk_eintragen',              label: 'Bulk-Eintragen (mehrere Ergebnisse auf einmal)' },
  { key: 'veranstaltung_eintragen',     label: 'Veranstaltung eintragen / ändern' },
  { key: 'veranstaltung_loeschen',      label: 'Veranstaltung löschen' },
  { key: 'lesen',                label: 'Lesen' },
  { key: 'personenbezogene_daten', label: 'Personenbezogene Daten sehen (Athleten-Seite, Gruppen, Jahrgang)' },
  { key: 'athleten_details',       label: 'Athleten-Details sehen (Geschlecht, Anzahl Ergebnisse)' },
  { key: 'inaktive_athleten_sehen', label: 'Inaktive Athleten sehen' },
  { key: 'athleten_editieren',     label: 'Athleten editieren' },
  { key: 'wartung_login',          label: 'Im Wartungsmodus einloggen' },
  { key: 'trainingsplan_bearbeiten', label: 'Trainingsplan erstellen / ändern (Trainingsportal)' },
];

async function _ladeRollenManager() {
  var r = await apiGet('rollen');
  var wrap = document.getElementById('rollen-manager-wrap');
  if (!wrap) return;
  if (!r || !r.ok) { wrap.innerHTML = '<div style="color:var(--accent);padding:12px">Fehler beim Laden.</div>'; return; }
  var rollen = r.data || [];
  // Globale Map für rolleLabel()
  window._rollenMap = {};
  rollen.forEach(function(ro) { window._rollenMap[ro.name] = ro; });
  function _rolleCard(name, lockIcon, labelDisp, pubIcon, rechteLabels, actionHtml, dimmed) {
    var rechteTags = rechteLabels
      ? rechteLabels.split(', ').map(function(l) {
          return '<span style="display:inline-block;background:var(--surface2,rgba(255,255,255,.07));' +
            'border:1px solid var(--border);border-radius:4px;font-size:11px;padding:1px 6px;margin:2px 2px 2px 0;' +
            'white-space:normal;word-break:break-word;line-height:1.4">' + l + '</span>';
        }).join('')
      : '<span style="opacity:.4">–</span>';
    return '<div style="border-bottom:1px solid var(--border);padding:10px 10px;' + (dimmed ? 'opacity:.7;' : '') + '">' +
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;flex-wrap:wrap">' +
        '<div style="min-width:0">' +
          '<div style="font-weight:700;font-size:13px;margin-bottom:2px">' + name + lockIcon + '</div>' +
          '<div style="font-size:12px;color:var(--text2);margin-bottom:6px">' + labelDisp + pubIcon + '</div>' +
          '<div style="line-height:1.6">' + rechteTags + '</div>' +
        '</div>' +
        '<div style="display:flex;gap:4px;flex-shrink:0;align-self:flex-start">' + actionHtml + '</div>' +
      '</div>' +
    '</div>';
  }

  var html = '<div>';
  // Header-Zeile (nur auf größeren Screens sinnvoll → als Tabellenkopf-Optik)
  html += '<div style="display:flex;padding:6px 10px;border-bottom:2px solid var(--border);font-size:11px;' +
    'font-weight:700;text-transform:uppercase;letter-spacing:.5px;opacity:.6">' +
    '<span style="flex:1">Rolle / Bezeichnung / Rechte</span></div>';

  rollen.forEach(function(rolle) {
    var rechteLabels = (rolle.rechte || []).map(function(k) {
      var r2 = _RECHTE_LISTE.find(function(x){ return x.key===k; });
      return r2 ? r2.label : k;
    }).join(', ');
    var sysRolle = (rolle.name === 'admin' || rolle.name === 'athlet' || rolle.name === 'leser' || rolle.name === 'trainer' || rolle.name === 'nicht-eingeloggt');
    var lockIcon = sysRolle ? ' <span title="Systemrolle: Name änderbar, Rechte gesperrt" style="font-size:11px;opacity:.5">🔐</span>' : '';
    var labelDisp = (rolle.label && rolle.label !== rolle.name) ? rolle.label : '<span style="opacity:.4;font-style:italic">—</span>';
    var pubIcon = rolle.oeffentlich ? '<span title="Öffentlich sichtbar" style="font-size:11px;margin-left:4px">👁️</span>' : '<span title="Nicht öffentlich" style="font-size:11px;margin-left:4px;opacity:.4">🙈</span>';
    var actionHtml =
      '<button class="btn btn-ghost btn-sm" onclick="showRolleEditModal(' + rolle.id + ')" title="Bearbeiten">✏️</button>' +
      (!sysRolle ? '<button class="btn btn-danger btn-sm" onclick="deleteRolle(' + rolle.id + ',\'' + rolle.name + '\')" title="Löschen">&#x1F5D1;&#xFE0F;</button>' : '');
    html += _rolleCard(rolle.name, lockIcon, labelDisp, pubIcon, rechteLabels, actionHtml, false);
  });
  // Pseudo-Rolle "Nicht eingeloggt"
  html += _rolleCard(
    'nicht-eingeloggt',
    ' <span title="Systemrolle: nicht editierbar" style="font-size:11px;opacity:.5">🔐</span>',
    'Nicht eingeloggt <span style="font-size:10px;color:var(--text2)">(Gäste)</span>',
    '', '', '', true
  );
  html += '</div>';
  wrap.innerHTML = html;
}

function _rolleModal(titel, rolle) {
  var r = rolle || { id: null, name: '', rechte: [], label: '', oeffentlich: 1 };
  var isAdmin = (r.name === 'admin' || r.name === 'athlet' || r.name === 'leser' || r.name === 'trainer'); // Systemrollen: Rechte gesperrt
  var checkboxes = _RECHTE_LISTE.map(function(re) {
    var checked = (r.rechte || []).indexOf(re.key) >= 0;
    var disabledAttr = isAdmin ? ' disabled' : '';
    var opacity = isAdmin ? 'opacity:.45;' : '';
    return '<label style="display:flex;align-items:center;gap:8px;padding:5px 0;' + (isAdmin ? 'cursor:default;' : 'cursor:pointer;') + 'font-size:13px">' +
      '<input type="checkbox" data-recht="' + re.key + '" ' + (checked ? 'checked' : '') + disabledAttr + ' style="width:15px;height:15px;' + opacity + '"> ' +
      re.label + '</label>';
  }).join('');
  var rechteSection = isAdmin
    ? '<div style="margin:12px 0 4px;font-weight:600;font-size:13px">Rechte</div>' +
      '<div style="font-size:12px;color:var(--text2);margin-bottom:6px">🔐 Rechte der Systemrolle sind unveränderbar.</div>' +
      '<div style="display:flex;flex-direction:column;gap:2px;max-height:200px;overflow-y:auto;padding:8px;background:var(--surf2);border-radius:8px;opacity:.7">' + checkboxes + '</div>'
    : '<div style="margin:12px 0 4px;font-weight:600;font-size:13px">Rechte</div>' +
      '<div style="display:flex;flex-direction:column;gap:2px;max-height:200px;overflow-y:auto;padding:8px;background:var(--surf2);border-radius:8px">' + checkboxes + '</div>';
  var oeffentlichChecked = (r.oeffentlich === 1 || r.oeffentlich === true) ? 'checked' : '';
  showModal(
    modalH2('' + titel + '') +
    '<div class="form-group"><label>Rollenname * <span style="font-size:11px;color:var(--text2)">(intern)</span></label><input type="text" id="rm-name" value="' + (r.name||'') + '"/></div>' +
    '<div class="form-group"><label>Bezeichnung <span style="font-size:11px;color:var(--text2)">(öffentlich sichtbar, z. B. "Administrator")</span></label><input type="text" id="rm-label" placeholder="' + (r.name||'') + '" value="' + (r.label||'') + '"/></div>' +
    '<label style="display:flex;align-items:center;gap:8px;margin-bottom:16px;cursor:pointer;font-size:13px">' +
      '<input type="checkbox" id="rm-oeffentlich" ' + oeffentlichChecked + ' style="width:15px;height:15px"> ' +
      'Bezeichnung öffentlich anzeigen (Menü, Athletenprofil)</label>' +
    rechteSection +
    '<div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button>' +
    '<button class="btn btn-primary" onclick="saveRolle(' + (r.id||'null') + ')">Speichern</button></div>'
  );
}

function showNeueRolleModal() { _rolleModal('Neue Rolle'); }

async function showRolleEditModal(id) {
  var r = await apiGet('rollen');
  var rolle = (r && r.ok) ? (r.data||[]).find(function(x){return x.id===id;}) : null;
  if (!rolle) return;
  _rolleModal('Rolle bearbeiten', rolle);
}

async function saveRolle(id) {
  var name       = (document.getElementById('rm-name').value || '').trim();
  var label      = (document.getElementById('rm-label').value || '').trim();
  var oeffentlich = document.getElementById('rm-oeffentlich').checked ? 1 : 0;
  var rechte     = Array.from(document.querySelectorAll('[data-recht]:checked')).map(function(cb){ return cb.dataset.recht; });
  var url        = id ? 'rollen/' + id : 'rollen';
  var r = await apiPost(url, { name: name, rechte: rechte, label: label, oeffentlich: oeffentlich });
  if (r && r.ok) { closeModal(); notify('Gespeichert.', 'ok'); _ladeRollenManager(); }
  else notify((r && r.fehler) || 'Fehler', 'err');
}

async function deleteRolle(id, name) {
  if (!await confirmModal('Rolle "' + name + '" wirklich löschen?')) return;
  var r = await apiDel('rollen/' + id);
  if (r && r.ok) { notify('Gelöscht.', 'ok'); _ladeRollenManager(); }
  else notify((r && r.fehler) || 'Fehler', 'err');
}

// Baut <option>-Liste für Rollen-Dropdowns aus allen vorhandenen Rollen (inkl. Trainingsportal-Rollen)
function _rolleOptions(selected) {
  var rollen = state._adminRollen;
  if (!rollen || !rollen.length) {
    // Fallback, falls Rollen (noch) nicht geladen
    rollen = [{name:'leser'},{name:'athlet'},{name:'editor'},{name:'admin'}];
  }
  var esc = function(s) { return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); };
  return rollen.map(function(ro) {
    var label = (ro.label && ro.label !== ro.name) ? ro.label : rolleLabel(ro.name);
    return '<option value="' + esc(ro.name) + '"' + (ro.name === selected ? ' selected' : '') + '>' + esc(label) + '</option>';
  }).join('');
}

function showNeuerBenutzerModal() {
  showModal(
    modalH2('&#x1F464; Neuer Benutzer') +
    '<div class="form-grid">' +
      '<div style="display:none"><input type="text" id="nb-user" value=""/></div>' +
      '<div class="form-group"><label>E-Mail *</label><input type="email" id="nb-email" placeholder="max@example.com"/></div>' +
      '<div class="form-group"><label>Passwort * (min. 8 Zeichen)</label><input type="password" id="nb-pw"/></div>' +
      '<div class="form-group"><label>Rolle</label><select id="nb-rolle">' + _rolleOptions('leser') + '</select></div>' +
    '</div>' +
    '<div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button><button class="btn btn-primary" onclick="createBenutzer()">Erstellen</button></div>'
  );
}

async function createBenutzer() {
  var r = await apiPost('benutzer', {
    benutzername: document.getElementById('nb-email').value, // E-Mail = Login-Kennung
    email:        document.getElementById('nb-email').value,
    passwort:     document.getElementById('nb-pw').value,
    rolle:        document.getElementById('nb-rolle').value,
  });
  if (r && r.ok) { closeModal(); notify('Benutzer erstellt.', 'ok'); await renderAdmin(); }
  else notify((r && r.fehler) || 'Fehler', 'err');
}

function _ebAthletChanged(sel, origRolle) {
  var rolleEl = document.getElementById('eb-rolle');
  if (!rolleEl) return;
  // Nur Leser/Athlet automatisch umstellen (admin/editor nicht anfassen)
  if (origRolle === 'admin' || origRolle === 'editor') return;
  rolleEl.value = sel.value ? 'athlet' : 'leser';
}

function showBenutzerEditModal(id) {
  var b = state._adminBenutzerMap[id];
  if (!b) return;
  var athleten = state._adminAthleten || [];
  var athletOpts = '<option value="">-- Kein Athlet --</option>';
  for (var i = 0; i < athleten.length; i++) {
    var a = athleten[i];
    athletOpts += '<option value="' + a.id + '"' + (b.athlet_id === a.id ? ' selected' : '') + '>' + a.name_nv + '</option>';
  }
  showModal(
    modalH2('&#x270F;&#xFE0F; Benutzer bearbeiten') +
    '<div style="color:var(--text2);margin-bottom:16px">' + b.email + '</div>' +
    '<div class="form-grid">' +
      '<div class="form-group"><label>E-Mail</label><input type="email" id="eb-email" value="' + b.email + '"/></div>' +
      '<div class="form-group"><label>Rolle</label><select id="eb-rolle">' + _rolleOptions(b.rolle) + '</select></div>' +
      '<div class="form-group"><label>Status</label><select id="eb-aktiv"><option value="1"' + (b.aktiv?' selected':'') + '>Aktiv</option><option value="0"' + (!b.aktiv?' selected':'') + '>Inaktiv</option></select></div>' +
      '<div class="form-group"><label>Neues Passwort (leer = unver&auml;ndert)</label><input type="password" id="eb-pw"/></div>' +
      '<div class="form-group full"><label>&#x1F3C3; Verkn&uuml;pftes Athletenprofil</label>' +
        '<select id="eb-athlet" style="width:100%" onchange="_ebAthletChanged(this,\'' + b.rolle + '\')">' + athletOpts + '</select>' +
        '<div style="font-size:11px;color:var(--text2);margin-top:4px">Wenn zugeordnet, kann sich der Athlet sp&auml;ter mit eigenen Daten anmelden. Die Rolle wird automatisch angepasst.</div>' +
      '</div>' +
    '</div>' +
    '<label style="display:flex;align-items:center;gap:8px;margin:4px 0 16px;cursor:pointer;font-size:13px">' +
      '<input type="checkbox" id="eb-email-login" ' + (b.email_login_bevorzugt ? 'checked' : '') + ' style="width:15px;height:15px"> ' +
      '&#x1F4E7; Anmeldung per E-Mail-Code (statt TOTP / Passkey)</label>' +
    '<div style="border-top:1px solid var(--border);margin:16px 0 12px"></div>' +
    '<div style="font-size:13px;font-weight:700;margin-bottom:10px">&#x1F512; 2-Faktor-Authentifizierung</div>' +
    '<div style="display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap">' +
      '<div style="flex:1;min-width:200px">' +
        '<div style="font-size:12px;color:var(--text2);margin-bottom:6px">TOTP (Authenticator-App)</div>' +
        '<div style="font-size:13px;margin-bottom:8px">' + (b.totp_aktiv ? '&#x2705; Aktiv' : '<span style="color:var(--text2)">Nicht aktiv</span>') + '</div>' +
        (b.totp_aktiv ? '<button class="btn btn-sm" style="color:#cc0000;border-color:#cc0000" onclick="adminResetTotp(' + b.id + ')">TOTP zurücksetzen</button>' : '') +
      '</div>' +
      '<div style="flex:2;min-width:220px">' +
        '<div style="font-size:12px;color:var(--text2);margin-bottom:6px">Passkeys</div>' +
        '<div id="eb-passkeys-list"><span style="color:var(--text2);font-size:12px">&#x23F3; Lade&hellip;</span></div>' +
      '</div>' +
    '</div>' +
    '<div style="border-top:1px solid var(--border);margin:16px 0 0"></div>' +
    '<div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button><button class="btn btn-primary" onclick="updateBenutzer(' + b.id + ')">Speichern</button></div>',
    true
  );
  _loadAdminPasskeys(b.id);
}

async function _loadAdminPasskeys(userId) {
  var el = document.getElementById('eb-passkeys-list');
  if (!el) return;
  var r = await apiGet('benutzer/' + userId + '/passkeys');
  var pks = (r && r.ok && r.data) ? r.data : [];
  if (!pks.length) {
    el.innerHTML = '<span style="color:var(--text2);font-size:12px;font-style:italic">Keine Passkeys registriert.</span>';
    return;
  }
  el.innerHTML = pks.map(function(pk) {
    var datum = pk.letzter_login ? new Date(pk.letzter_login).toLocaleDateString('de-DE') : '–';
    return '<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--border)">' +
      '<span>&#x1F511;</span>' +
      '<div style="flex:1;font-size:12px"><strong>' + pk.name + '</strong><br><span style="color:var(--text2)">Zuletzt: ' + datum + '</span></div>' +
      '<button class="btn btn-danger btn-sm" onclick="adminDeletePasskey(' + userId + ',' + pk.id + ')">&#x1F5D1;&#xFE0F;</button>' +
    '</div>';
  }).join('');
}

async function adminDeletePasskey(userId, pkId) {
  if (!await confirmModal('Passkey wirklich löschen?')) return;
  var r = await apiDel('benutzer/' + userId + '/passkeys/' + pkId);
  if (r && r.ok) { notify('Passkey gelöscht.', 'ok'); _loadAdminPasskeys(userId); }
  else notify((r && r.fehler) || 'Fehler', 'err');
}

async function adminResetTotp(userId) {
  if (!await confirmModal('TOTP für diesen Benutzer wirklich zurücksetzen?')) return;
  var r = await apiDel('benutzer/' + userId + '/totp');
  if (r && r.ok) { notify('TOTP zurückgesetzt.', 'ok'); closeModal(); await renderAdmin(); }
  else notify((r && r.fehler) || 'Fehler', 'err');
}

async function updateBenutzer(id) {
  var body = {
    email:     document.getElementById('eb-email').value,
    rolle:     document.getElementById('eb-rolle').value,
    aktiv:     parseInt(document.getElementById('eb-aktiv').value),
    athlet_id: document.getElementById('eb-athlet').value ? parseInt(document.getElementById('eb-athlet').value) : null,
    email_login_bevorzugt: document.getElementById('eb-email-login').checked ? 1 : 0,
  };
  var pw = document.getElementById('eb-pw').value;
  if (pw) body.passwort = pw;
  var r = await apiPut('benutzer/' + id, body);
  if (r && r.ok) { closeModal(); notify('Gespeichert.', 'ok'); await renderAdmin(); }
  else notify((r && r.fehler) || '', 'err');
}

async function deleteBenutzer(id, name) {
  if (!await confirmModal('Benutzer "' + name + '" wirklich l\u00f6schen?\nDas Konto wandert in den Papierkorb und kann dort wiederhergestellt werden.')) return;
  var r = await apiDel('benutzer/' + id);
  if (r && r.ok) { notify('In Papierkorb verschoben.', 'ok'); await renderAdmin(); }
  else notify((r && r.fehler) || '', 'err');
}

function showNeuerAthletModal() {
  showModal(
    modalH2('&#x1F464; Neuer Athlet') +
    '<div class="form-grid">' +
      '<div class="form-group"><label>Nachname *</label><input type="text" id="na-nn"/></div>' +
      '<div class="form-group"><label>Vorname *</label><input type="text" id="na-vn"/></div>' +
      '<div class="form-group"><label>Geschlecht</label><select id="na-g"><option value="">&#x2013;</option><option value="M">M&auml;nnlich</option><option value="W">Weiblich</option><option value="D">Divers</option></select></div>' +
      '<div class="form-group"><label>Geburtsjahr</label><input type="number" id="na-gebj" min="1930" max="2020" placeholder="z.B. 1988" style="width:130px"/></div>' +
      '<div class="form-group full"><label>Gruppen <span style="font-size:11px;color:var(--text2)">(kommagetrennt)</span></label><input type="text" id="na-gr" placeholder="z.B. Senioren, Masters"/></div>' +
    '</div>' +
    '<div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button><button class="btn btn-primary" onclick="createAthlet()">Erstellen</button></div>'
  , false, true);
}

async function createAthlet() {
  var nn = document.getElementById('na-nn').value.trim();
  var vn = document.getElementById('na-vn').value.trim();
  if (!nn) { notify('Nachname erforderlich.', 'err'); return; }
  var name_nv = nn + (vn ? ', ' + vn : '');
  var r = await apiPost('athleten', {
    name_nv: name_nv, nachname: nn, vorname: vn,
    geschlecht: document.getElementById('na-g').value,
    geburtsjahr: parseInt(document.getElementById('na-gebj').value) || null,
    gruppen:    document.getElementById('na-gr').value.split(',').map(function(s){return s.trim();}).filter(function(s){return s.length>0;}),
  });
  if (r && r.ok) { closeModal(); notify('Athlet erstellt.', 'ok'); await loadAthleten(); await renderAthleten(); }
  else notify((r && r.fehler) || '', 'err');
}

function showAthletEditModal(id) {
  var a = state._athletenMap && state._athletenMap[id];
  if (!a) return;
  var gebJahr = a.geburtsjahr ? String(a.geburtsjahr) : '';
  var curGruppen = (a.gruppen || []).map(function(g) { return g.name; }).join(', ');
  showModal(
    modalH2('&#x270F;&#xFE0F; Athlet bearbeiten') +
    '<div class="form-grid">' +
      '<div class="form-group"><label>Nachname *</label><input type="text" id="ea-nn" value="' + (a.nachname||'') + '"/></div>' +
      '<div class="form-group"><label>Vorname</label><input type="text" id="ea-vn" value="' + (a.vorname||'') + '"/></div>' +
      '<div class="form-group"><label>Geschlecht</label><select id="ea-g">' +
        '<option value=""' + (!a.geschlecht?' selected':'') + '>&#x2013;</option>' +
        '<option value="M"' + (a.geschlecht==='M'?' selected':'') + '>M\u00e4nnlich</option>' +
        '<option value="W"' + (a.geschlecht==='W'?' selected':'') + '>Weiblich</option>' +
        '<option value="D"' + (a.geschlecht==='D'?' selected':'') + '>Divers</option>' +
      '</select></div>' +
      '<div class="form-group"><label>Geburtsjahr</label><input type="number" id="ea-gebj" value="' + gebJahr + '" min="1930" max="2020" placeholder="z.B. 1988" style="width:120px"/></div>' +
      '<div class="form-group full"><label>Gruppen <span style="font-size:11px;color:var(--text2)">(kommagetrennt)</span></label><input type="text" id="ea-gr" value="' + curGruppen + '" placeholder="z.B. Senioren, Masters"/></div>' +
      '<div class="form-group"><label>Status</label><select id="ea-aktiv" onchange="_eaAktivChanged()">' +
        '<option value="1"' + (a.aktiv?' selected':'') + '>Aktiv</option>' +
        '<option value="0"' + (!a.aktiv?' selected':'') + '>Inaktiv</option>' +
      '</select></div>' +
    '</div>' +
    '<div id="ea-orga-row" style="margin:4px 0 16px;display:' + (a.aktiv ? 'none' : 'block') + '">' +
      '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px">' +
        '<input type="checkbox" id="ea-orga" ' + (a.orga ? 'checked' : '') + ' style="width:15px;height:15px"> ' +
        '&#x1F9E9; Orga-Mitglied (inaktiv, aber in der Organisation aktiv &ndash; z.B. für Sportfest-Planung)' +
      '</label>' +
    '</div>' +
    '<div style="border-top:1px solid var(--border);margin:16px 0 12px"></div>' +
    '<div style="font-size:13px;font-weight:700;margin-bottom:8px">&#x1F4CB; Alternative Namen <span style="font-size:11px;font-weight:400;color:var(--text2)">(nur Backend &ndash; f&uuml;r Namens&auml;nderungen &amp; Schreibweisen)</span></div>' +
    '<div id="ea-altnamen-list" style="margin-bottom:8px"><span style="color:var(--text2);font-size:12px">&#x23F3;</span></div>' +
    '<div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap">' +
      '<div><label style="font-size:12px;display:block;margin-bottom:3px">Nachname *</label><input type="text" id="ea-an-nn" placeholder="z.B. M\u00fcller" style="width:140px"/></div>' +
      '<div><label style="font-size:12px;display:block;margin-bottom:3px">Vorname</label><input type="text" id="ea-an-vn" placeholder="z.B. Anna" style="width:120px"/></div>' +
      '<button class="btn btn-sm" onclick="addAthletAltName(' + id + ')" style="margin-bottom:1px">&#x2795; Hinzuf&uuml;gen</button>' +
    '</div>' +
    '<div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button><button class="btn btn-primary" onclick="saveAthlet(' + id + ')">Speichern</button></div>'
  , false, true);
  _loadAthletAltNamen(id);
}

async function _loadAthletAltNamen(athletId) {
  var el = document.getElementById('ea-altnamen-list');
  if (!el) return;
  var r = await apiGet('athleten/' + athletId + '/altnamen');
  var list = (r && r.ok && r.data) ? r.data : [];
  if (!list.length) {
    el.innerHTML = '<span style="color:var(--text2);font-size:12px;font-style:italic">Keine alternativen Namen eingetragen.</span>';
    return;
  }
  el.innerHTML = list.map(function(an) {
    var label = an.nachname + (an.vorname ? ', ' + an.vorname : '');
    return '<div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid var(--border)">' +
      '<span style="flex:1;font-size:13px">' + label + '</span>' +
      '<button class="btn btn-danger btn-sm" onclick="deleteAthletAltName(' + athletId + ',' + an.id + ')">&#x1F5D1;&#xFE0F;</button>' +
    '</div>';
  }).join('');
}

async function addAthletAltName(athletId) {
  var nn = (document.getElementById('ea-an-nn').value || '').trim();
  var vn = (document.getElementById('ea-an-vn').value || '').trim();
  if (!nn) { notify('Nachname erforderlich.', 'err'); return; }
  var r = await apiPost('athleten/' + athletId + '/altnamen', { nachname: nn, vorname: vn });
  if (r && r.ok) {
    document.getElementById('ea-an-nn').value = '';
    document.getElementById('ea-an-vn').value = '';
    await _loadAthletAltNamen(athletId);
    // state.athleten aktualisieren damit Matching sofort greift
    await loadAthleten();
  } else {
    notify((r && r.fehler) || 'Fehler', 'err');
  }
}

async function deleteAthletAltName(athletId, altnamId) {
  var r = await apiDel('athleten/' + athletId + '/altnamen/' + altnamId);
  if (r && r.ok) {
    await _loadAthletAltNamen(athletId);
    await loadAthleten();
  } else {
    notify((r && r.fehler) || 'Fehler', 'err');
  }
}

function _eaAktivChanged() {
  var aktiv = document.getElementById('ea-aktiv').value === '1';
  var row = document.getElementById('ea-orga-row');
  if (row) row.style.display = aktiv ? 'none' : 'block';
  if (aktiv) { var cb = document.getElementById('ea-orga'); if (cb) cb.checked = false; }
}

async function saveAthlet(id) {
  var nn = document.getElementById('ea-nn').value.trim();
  var vn = document.getElementById('ea-vn').value.trim();
  if (!nn) { notify('Nachname erforderlich.', 'err'); return; }
  var grStr = document.getElementById('ea-gr').value;
  var gruppen = grStr.split(',').map(function(s) { return s.trim(); }).filter(function(s) { return s.length > 0; });
  var aktiv = parseInt(document.getElementById('ea-aktiv').value);
  var orgaCb = document.getElementById('ea-orga');
  var r = await apiPut('athleten/' + id, {
    nachname:    nn,
    vorname:     vn,
    name_nv:     nn + (vn ? ', ' + vn : ''),
    geschlecht:  document.getElementById('ea-g').value,
    geburtsjahr: document.getElementById('ea-gebj').value ? parseInt(document.getElementById('ea-gebj').value) : null,
    gruppen:     gruppen,
    aktiv:       aktiv,
    orga:        (aktiv ? 0 : (orgaCb && orgaCb.checked ? 1 : 0)),
  });
  if (r && r.ok) { closeModal(); notify('Gespeichert.', 'ok'); await loadAthleten(); await renderAthleten(); }
  else notify((r && r.fehler) || 'Fehler', 'err');
}

async function toggleAthletAktiv(id, aktiv) {
  var r = await apiPut('athleten/' + id, { aktiv: aktiv });
  if (r && r.ok) {
    notify('Athlet ' + (aktiv ? 'aktiviert' : 'deaktiviert') + '.', 'ok');
    // Cache direkt aktualisieren – kein vollständiger Rebuild, Sortierung bleibt erhalten
    var cached = _athLetenCache.alleAthleten || [];
    for (var ci = 0; ci < cached.length; ci++) {
      if (cached[ci].id === id) { cached[ci].aktiv = aktiv; break; }
    }
    _renderAthletenTable();
  } else {
    notify((r && r.fehler) || 'Fehler', 'err');
  }
}

async function toggleAthletOrga(id, orga) {
  var r = await apiPut('athleten/' + id, { orga: orga });
  if (r && r.ok) {
    notify('Orga-Markierung ' + (orga ? 'gesetzt' : 'entfernt') + '.', 'ok');
    var cached = _athLetenCache.alleAthleten || [];
    for (var ci = 0; ci < cached.length; ci++) {
      if (cached[ci].id === id) { cached[ci].orga = orga; break; }
    }
    _renderAthletenTable();
  } else {
    notify((r && r.fehler) || 'Fehler', 'err');
  }
}

async function deleteAthlet(id, name) {
  if (!await confirmModal('Athlet "' + name + '" in den Papierkorb verschieben?\n\nDer Athlet kann dort wiederhergestellt oder endg\u00fcltig gel\u00f6scht werden.')) return;
  var r = await apiDel('athleten/' + id);
  if (r && r.ok) { notify('Gel\u00f6scht.', 'ok'); await loadAthleten(); await renderAthleten(); }
  else notify((r && r.fehler) || 'Fehler', 'err');
}



function showNeuerRekordModal() {
  var athOptHtml = '<option value="">&#x2013; bitte w&auml;hlen &#x2013;</option>';
  for (var i = 0; i < state.athleten.length; i++) {
    var a = state.athleten[i];
    athOptHtml += '<option value="' + a.id + '">' + a.name_nv + '</option>';
  }
  showModal(
    modalH2('&#x1F3C6; Neuer Vereinsrekord') +
    '<div class="form-grid">' +
      '<div class="form-group"><label>Disziplin *</label><input type="text" id="nr-disziplin"/></div>' +
      '<div class="form-group"><label>Altersklasse *</label><input type="text" id="nr-ak"/></div>' +
      '<div class="form-group"><label>Athlet*in</label><select id="nr-athlet">' + athOptHtml + '</select></div>' +
      '<div class="form-group"><label>Ergebnis *</label><input type="text" id="nr-resultat"/></div>' +
      '<div class="form-group full"><label>Veranstaltung</label><input type="text" id="nr-veranst"/></div>' +
    '</div>' +
    '<div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button><button class="btn btn-primary" onclick="createRekord()">Speichern</button></div>'
  );
}

async function createRekord() {
  var aid = document.getElementById('nr-athlet').value;
  var athName = '';
  if (aid) {
    for (var i = 0; i < state.athleten.length; i++) {
      if (state.athleten[i].id == aid) { athName = state.athleten[i].name_nv; break; }
    }
  }
  var r = await apiPost('rekorde', {
    disziplin:    document.getElementById('nr-disziplin').value,
    altersklasse: document.getElementById('nr-ak').value,
    athlet_id:    aid ? parseInt(aid) : null,
    athlet_name:  athName,
    veranstaltung: document.getElementById('nr-veranst').value,
    resultat:     document.getElementById('nr-resultat').value,
  });
  if (r && r.ok) { closeModal(); notify('Rekord gespeichert.', 'ok'); await renderRekorde(); }
  else notify((r && r.fehler) || '', 'err');
}


function navAdmin(tab) {
  state.adminTab = tab;
  syncHash();
  renderAdmin();
}
// ── ADMIN: DISZIPLINEN ────────────────────────────────────
async function renderPapierkorb() {
  var el = document.getElementById('main-content');
  el.innerHTML = adminSubtabs() + '<div class="loading"><div class="spinner"></div>Laden&hellip;</div>';

  var r = await apiGet('papierkorb');
  if (!r || !r.ok) { el.innerHTML += '<div style="color:var(--accent)">Fehler beim Laden.</div>'; return; }

  var erg  = r.data.ergebnisse || [];
  var ath  = r.data.athleten || [];
  var ver  = r.data.veranstaltungen || [];
  var ben  = r.data.benutzer || [];
  var total = erg.length + ath.length + ver.length + ben.length;

  function pkRows(items, typ) {
    var html = '';
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var label = it.label || '';
      var detail = it.detail ? ' &middot; ' + it.detail : '';
      var resultat = it.resultat ? ' &middot; <strong>' + it.resultat + '</strong>' : '';
      var veranst = it.veranstaltung ? ' &middot; ' + it.veranstaltung : '';
      var ts = it.geloescht_am ? it.geloescht_am.slice(0,10) : '';
      html +=
        '<tr>' +
          '<td>' + label + detail + resultat + veranst + '</td>' +
          '<td style="color:var(--text2);font-size:12px">' + ts + '</td>' +
          '<td style="white-space:nowrap">' +
            '<button class="btn btn-ghost btn-sm" title="Wiederherstellen" onclick="pkRestore(\'' + typ + '\',' + it.id + ')">&#x21A9;</button> ' +
            '<button class="btn btn-danger btn-sm" title="Endgültig löschen" onclick="pkDelete(\'' + typ + '\',' + it.id + ')">&#x1F5D1;&#xFE0F;</button>' +
          '</td>' +
        '</tr>';
    }
    return html || '<tr><td colspan="3" style="color:var(--text2);padding:12px">Keine Eintr&auml;ge</td></tr>';
  }

  var html = adminSubtabs();
  if (total === 0) {
    html += '<div class="empty"><div class="empty-icon">🗑️</div><div class="empty-text">Papierkorb ist leer</div></div>';
  } else {
    html += '<div style="display:flex;justify-content:flex-end;margin-bottom:12px">' +
      '<button class="btn btn-danger btn-sm" onclick="pkLeeren(' + total + ')">🗑️ Alles löschen (' + total + ')</button></div>';
    if (erg.length) html +=
      '<div class="panel" style="margin-bottom:16px"><div class="panel-header"><div class="panel-title">🏅 Ergebnisse (' + erg.length + ')</div></div>' +
      '<div style="overflow-x:auto"><table class="data-table" style="width:100%"><thead><tr><th>Eintrag</th><th>Gelöscht am</th><th></th></tr></thead>' +
      '<tbody>' + pkRows(erg, 'ergebnis') + '</tbody></table></div></div>';
    if (ath.length) html +=
      '<div class="panel" style="margin-bottom:16px"><div class="panel-header"><div class="panel-title">👤 Athleten (' + ath.length + ')</div></div>' +
      '<div style="overflow-x:auto"><table class="data-table" style="width:100%"><thead><tr><th>Athlet</th><th>Gelöscht am</th><th></th></tr></thead>' +
      '<tbody>' + pkRows(ath, 'athlet') + '</tbody></table></div></div>';
    if (ver.length) html +=
      '<div class="panel" style="margin-bottom:16px"><div class="panel-header"><div class="panel-title">📅 Veranstaltungen (' + ver.length + ')</div></div>' +
      '<div style="overflow-x:auto"><table class="data-table" style="width:100%"><thead><tr><th>Veranstaltung</th><th>Gelöscht am</th><th></th></tr></thead>' +
      '<tbody>' + pkRows(ver, 'veranstaltung') + '</tbody></table></div></div>';
    if (ben.length) html +=
      '<div class="panel"><div class="panel-header"><div class="panel-title">🔑 Benutzerkonten (' + ben.length + ')</div></div>' +
      '<div style="overflow-x:auto"><table class="data-table" style="width:100%"><thead><tr><th>Konto</th><th>Gelöscht am</th><th></th></tr></thead>' +
      '<tbody>' + pkRows(ben, 'benutzer') + '</tbody></table></div></div>';
  }
  el.innerHTML = html;
}

async function pkRestore(typ, id) {
  var r = await api('POST', 'papierkorb/' + typ + '/' + id);
  if (r && r.ok) { notify('Wiederhergestellt.', 'ok'); await renderPapierkorb(); }
  else notify((r && r.fehler) || 'Fehler', 'err');
}

async function pkDelete(typ, id) {
  var msg = typ === 'benutzer'
    ? 'Benutzerkonto endgültig löschen?\nDas Konto verschwindet aus dem Portal. Ein Abzug der Daten bleibt im Archiv und kann per Datenbank wiederhergestellt werden.'
    : 'Eintrag endgültig löschen?\nDer Eintrag verschwindet aus dem Portal. Ein Abzug der Daten bleibt im Archiv und kann per Datenbank wiederhergestellt werden.';
  if (!await confirmModal(msg)) return;
  var r = await api('DELETE', 'papierkorb/' + typ + '/' + id);
  if (r && r.ok) { notify('Endgültig gelöscht.', 'ok'); await renderPapierkorb(); }
  else notify((r && r.fehler) || 'Fehler', 'err');
}

function pkLeeren(total) {
  showModal(
    modalH2('Papierkorb leeren') +
    '<div style="background:#fde8e8;border:1px solid #f5b0b0;border-radius:8px;padding:14px 16px;margin-bottom:20px;font-size:13px">' +
      '<strong>&#x26A0;&#xFE0F; Achtung:</strong> Alle <strong>' + total + ' Eintr\u00e4ge</strong> im Papierkorb werden aus dem Portal entfernt.' +
    '</div>' +
    '<p style="font-size:13px;color:var(--text2);margin:0 0 20px">Im Portal ist der Vorgang nicht r\u00fcckg\u00e4ngig zu machen. Ein vollst\u00e4ndiger Abzug der Daten wird vorher im Archiv gesichert und kann per Datenbank wiederhergestellt werden.</p>' +
    '<div class="modal-actions">' +
      '<button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button>' +
      '<button class="btn btn-danger" onclick="pkLeerenBestaetigt()">Ja, alles endg\u00fcltig l\u00f6schen</button>' +
    '</div>'
  );
}

async function pkLeerenBestaetigt() {
  closeModal();
  var r = await api('DELETE', 'papierkorb/alle');
  if (r && r.ok) { notify('Papierkorb geleert.', 'ok'); await renderPapierkorb(); }
  else notify((r && r.fehler) || 'Fehler', 'err');
}

function getDarstellungSettings() {
  if (appConfig && appConfig.dashboard_timeline_limit) {
    return { timelineLimit: parseInt(appConfig.dashboard_timeline_limit) || 20 };
  }
  try {
    var s = localStorage.getItem('tus_darstellung');
    return s ? JSON.parse(s) : {};
  } catch(e) { return {}; }
}

function saveDarstellungSettings(obj) {
  try { localStorage.setItem('tus_darstellung', JSON.stringify(obj)); } catch(e) {}
}



function _regCard(reg, showActions) {
  var _bs = 'display:inline-flex;align-items:center;line-height:1;';
  var emailBadge = reg.email_verifiziert
    ? '<span class="badge badge-email-ok" style="'+_bs+'">✓ E-Mail bestätigt</span>'
    : '<span class="badge badge-email-no" style="'+_bs+'">✗ E-Mail ausstehend</span>';
  var fa2Badge = reg.totp_aktiv
    ? '<span class="badge badge-email-ok" style="'+_bs+'">✓ Authenticator-App</span>'
    : (reg.email_login_bevorzugt == 1 || reg.email_login_bevorzugt === true || reg.email_login_bevorzugt === '1')
      ? '<span class="badge" style="'+_bs+';background:#e8f0fe;color:#1a56db;border:1px solid #b3c5f5">📧 E-Mail-Code</span>'
      : '<span class="badge" style="'+_bs+';background:var(--surf2);color:var(--text2)">2FA ausstehend</span>';
  var statusBadge = reg.status === 'approved'
    ? '<span class="badge badge-aktiv" style="'+_bs+'">Freigegeben</span>'
    : reg.status === 'rejected'
    ? '<span class="badge badge-inaktiv" style="'+_bs+'">Abgelehnt</span>'
    : '<span class="badge badge-pending" style="'+_bs+'">Ausstehend</span>';

  var actions = '';
  if (showActions) {
    var athOpts = '<option value="">– kein Athlet –</option>';
    var _assigned = (window._zugeordneteAthleten || []);
    var athlList = (state._adminAthleten || []).slice()
      .filter(function(a){ return _assigned.indexOf(a.id) < 0; })
      .sort(function(a,b){return (a.name_nv||'').localeCompare(b.name_nv||'');});
    for (var i = 0; i < athlList.length; i++) {
      athOpts += '<option value="' + athlList[i].id + '">' + (athlList[i].name_nv || athlList[i].name || '?') + '</option>';
    }
    // athOpts wird inline in der Badge-Zeile verwendet
  }

  // Anzeigename: nur E-Mail (kein separater Benutzername mehr)
  return '<div class="reg-pending-card">' +
    '<div class="reg-pending-info">' +
      '<div class="reg-pending-name">' + reg.email + '</div>' +
      '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:6px">' +
        emailBadge + fa2Badge + statusBadge +
        '<span style="font-size:11px;color:var(--text2);align-self:center;white-space:nowrap">Registriert: ' + (reg.erstellt_am ? reg.erstellt_am.slice(0,10) : '–') + '</span>' +
        (showActions ?
          '<div style="display:flex;align-items:center;gap:6px;margin-left:auto;flex-shrink:0">' +
            '<select id="reg-athlet-' + reg.id + '" title="Athlet zuordnen → Rolle wird automatisch auf &lsquo;Athlet&rsquo; gesetzt" style="padding:3px 6px;border:1px solid var(--border);border-radius:5px;font-size:12px;background:var(--surface);color:var(--text)">' + athOpts + '</select>' +
            '<button class="btn btn-primary btn-sm" onclick="regGenehmigen(' + reg.id + ')">✓ Genehmigen</button>' +
            '<button class="btn btn-danger btn-sm" onclick="regAblehnen(' + reg.id + ')">✗ Ablehnen</button>' +
          '</div>' :
          '<div style="margin-left:auto;flex-shrink:0">' +
            '<button class="btn btn-ghost btn-sm" onclick="regLoeschen(' + reg.id + ',\'' + reg.email.replace(/'/g,'\\\'') + '\')" title="Eintrag l\xf6schen">&#x1F5D1;&#xFE0F;</button>' +
          '</div>') +
      '</div>' +
    '</div>' +
  '</div>';
}

async function regGenehmigen(regId) {
  var athEl = document.getElementById('reg-athlet-' + regId);
  var athletId = athEl ? (athEl.value || null) : null;
  var r = await apiPost('auth/registrierungen/' + regId + '/genehmigen', { athlet_id: athletId });
  if (r && r.ok) { notify('Registrierung genehmigt.', 'ok'); await renderAdmin(); }
  else notify((r && r.fehler) || 'Fehler', 'err');
}

async function regAblehnen(regId) {
  showModal(
    '<h2>Registrierung ablehnen <button class="modal-close" onclick="closeModal()">✕</button></h2>' +
    '<p style="font-size:13px;color:var(--text2)">Soll diese Registrierungsanfrage abgelehnt werden?</p>' +
    '<div class="modal-actions">' +
      '<button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button>' +
      '<button class="btn btn-danger" onclick="_doRegAblehnen(' + regId + ')">Ablehnen</button>' +
    '</div>'
  );
}
async function _doRegAblehnen(regId) {
  closeModal();
  var r = await apiPost('auth/registrierungen/' + regId + '/ablehnen', {});
  if (r && r.ok) { notify('Abgelehnt.', 'ok'); await renderAdmin(); }
  else notify((r && r.fehler) || 'Fehler', 'err');
}

async function regLoeschen(regId, email) {
  showModal(
    '<h2>Registrierungseintrag löschen <button class="modal-close" onclick="closeModal()">✕</button></h2>' +
    '<p style="font-size:13px;color:var(--text2)">Eintrag für <strong>' + email + '</strong> endgültig löschen?</p>' +
    '<div class="modal-actions">' +
      '<button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button>' +
      '<button class="btn btn-danger" onclick="_doRegLoeschen(' + regId + ')">Löschen</button>' +
    '</div>'
  );
}
async function _doRegLoeschen(regId) {
  closeModal();
  var r = await apiDel('auth/registrierungen/' + regId);
  if (r && r.ok) { notify('Eintrag gelöscht.', 'ok'); await renderAdmin(); }
  else notify((r && r.fehler) || 'Fehler', 'err');
}
// ── ADMIN: DASHBOARD-LAYOUT ─────────────────────────────────────────────────
var WIDGET_DEFS = [
  { id: 'stats',           label: '📊︎ Statistik-Karten' },
  { id: 'timeline',        label: '🏅 Neueste Bestleistungen' },
  { id: 'veranstaltungen', label: '📍 Letzte Veranstaltungen' },
  { id: 'hall-of-fame',    label: '🏆 Hall of Fame' },
  { id: 'eigenes-profil',  label: '🏃 Eigenes Athletenprofil' },
  { id: 'eigene-bestzeiten', label: '⏱️ Eigene persönliche Bestleistungen' },
];

// Verfügbare Stat-Karten (Reihenfolge und Auswahl konfigurierbar)
// Timeline-Label-Typen (fest, AK-Labels sind dynamisch aber gehören zu Typ 'ak')
var TIMELINE_TYPE_DEFS = [
  { id: 'gesamt',  label: 'Vereinsrekord',                  desc: 'Beste Leistung aller Athleten in einer Disziplin (Gold)',      prio: 0 },
  { id: 'gender',  label: 'Bestleistung M / W',            desc: 'Beste Leistung je Geschlecht (Gold)',                          prio: 1 },
  { id: 'ak',      label: 'Bestleistung / Erste Leis. AK', desc: 'Beste oder erste Leistung je Altersklasse (Silber)',           prio: 2 },
  { id: 'pb',      label: 'PB / Debüt',                    desc: 'Persönliche Bestleistung oder erstes Ergebnis (Grün)',         prio: 3 },
];

function timelineLabelType(lbl) {
  if (!lbl) return null;
  if (lbl === 'Vereinsrekord' || lbl === 'Gesamtbestleistung' || lbl === 'Erste Gesamtleistung') return 'gesamt';
  if (lbl === 'Bestleistung Männer' || lbl === 'Bestleistung Frauen' ||
      lbl === 'Erstes Ergebnis M'   || lbl === 'Erstes Ergebnis W') return 'gender';
  if (lbl === 'PB' || lbl === 'Debüt') return 'pb';
  if (lbl.indexOf('Bestleistung') >= 0 || lbl.indexOf('Erste Leistung') >= 0) return 'ak';
  return 'pb'; // Fallback
}

var VERANST_COL_DEFS = [
  { id: 'athlet',  label: 'Athlet*in',    css: 'vcol-athlet' },
  { id: 'ak',      label: 'AK',           css: 'vcol-ak'     },
  { id: 'result',  label: 'Ergebnis',     css: 'vcol-result' },
  { id: 'pace',    label: 'Pace',         css: 'vcol-pace'   },
  { id: 'platz',   label: 'Platz AK',     css: 'vcol-platz'  },
  { id: 'ms',      label: 'Meisterschaft',css: 'vcol-ms'     },
];

var STAT_CARD_DEFS = [
  { id: 'ergebnisse', icon: '&#x1F3C3;', label: 'Ergebnisse gesamt' },
  { id: 'athleten',   icon: '&#x1F465;', label: 'Athleten' },
  { id: 'rekorde',    icon: '&#x1F3C6;', label: 'Vereinsrekorde' },
];

function widgetLabel(id) {
  for (var i = 0; i < WIDGET_DEFS.length; i++) {
    if (WIDGET_DEFS[i].id === id) return WIDGET_DEFS[i].label;
  }
  return id;
}

function dashLayoutFromConfig() {
  try { return JSON.parse(appConfig.dashboard_layout || ''); } catch(e) {}
  return [
    { cols: [{ widget: 'stats', cards: ['ergebnisse','athleten','rekorde'] }] },
    { cols: [{ widget: 'timeline', w: 340 }, { widget: 'veranstaltungen' }] }
  ];
}

async function renderAdminDashboard() {
  var el = document.getElementById('main-content');
  el.innerHTML = adminSubtabs() + '<div class="loading"><div class="spinner"></div>Laden&hellip;</div>';

  var layout = dashLayoutFromConfig();
  renderAdminDashboardUI(layout);
}

function dashVeranstConfigHtml(ri, ci, col_order, hidden_cols, col) {
  var hidden = hidden_cols || [];
  var order  = col_order && col_order.length === VERANST_COL_DEFS.length
                 ? col_order : VERANST_COL_DEFS.map(function(c){return c.id;});
  // Spalten in konfigurierter Reihenfolge
  var orderedCols = [];
  for (var oi = 0; oi < order.length; oi++) {
    for (var ci2 = 0; ci2 < VERANST_COL_DEFS.length; ci2++) {
      if (VERANST_COL_DEFS[ci2].id === order[oi]) { orderedCols.push(VERANST_COL_DEFS[ci2]); break; }
    }
  }
  for (var ci3 = 0; ci3 < VERANST_COL_DEFS.length; ci3++) {
    if (order.indexOf(VERANST_COL_DEFS[ci3].id) < 0) orderedCols.push(VERANST_COL_DEFS[ci3]);
  }
  var rows = '';
  for (var i = 0; i < orderedCols.length; i++) {
    var c = orderedCols[i];
    var chk = hidden.indexOf(c.id) < 0 ? ' checked' : '';
    rows +=
      '<div style="display:flex;align-items:center;gap:8px;padding:5px 0;' + (i < orderedCols.length-1 ? 'border-bottom:1px solid var(--border);' : '') + '">' +
        '<input type="checkbox" data-vc-id="' + c.id + '" data-ri="' + ri + '" data-ci="' + ci + '"' + chk + ' onchange="dashUpdateLayout()">' +
        '<span style="flex:1;font-size:13px">' + c.label + '</span>' +
        '<span style="display:flex;gap:4px">' +
          (i > 0 ? '<button class="btn btn-ghost btn-sm" style="padding:2px 6px" onclick="dashVcMoveCol(' + ri + ',' + ci + ',' + i + ',-1)">▲</button>' : '<button class="btn btn-ghost btn-sm" style="padding:2px 6px;opacity:.25" disabled>▲</button>') +
          (i < orderedCols.length-1 ? '<button class="btn btn-ghost btn-sm" style="padding:2px 6px" onclick="dashVcMoveCol(' + ri + ',' + ci + ',' + i + ',1)">▼</button>' : '<button class="btn btn-ghost btn-sm" style="padding:2px 6px;opacity:.25" disabled>▼</button>') +
        '</span>' +
      '</div>';
  }
  var veranstLimit = col && col.veranst_limit ? col.veranst_limit : 5;
  return '<div style="padding:2px 0 6px">' +
    '<label style="display:flex;align-items:center;gap:10px;font-size:13px;margin-bottom:12px">' +
      '<span style="min-width:120px;color:var(--text2)">Anzahl Veranstaltungen</span>' +
      '<input type="number" id="veranst-limit-' + ri + '-' + ci + '" value="' + veranstLimit + '" min="1" max="50" ' +
      'class="settings-input" style="width:70px" onchange="dashUpdateLayout()">' +
    '</label>' +
    '<div style="font-size:11px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Spalten</div>' +
    rows +
  '</div>';
}

function dashVcMoveCol(ri, ci, idx, dir) {
  dashUpdateLayout();
  var layout = dashGetLayout();
  var col = layout[ri] && layout[ri].cols[ci];
  if (!col) return;
  var order = col.col_order && col.col_order.length ? col.col_order.slice()
    : VERANST_COL_DEFS.map(function(c){return c.id;});
  var newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= order.length) return;
  var tmp = order[idx]; order[idx] = order[newIdx]; order[newIdx] = tmp;
  col.col_order = order;
  renderAdminDashboardUI(layout);
}

function dashHofConfigHtml(ri, ci, col) {
  var limit       = col.hof_limit || '';
  var leaderboard = !!col.hof_leaderboard;
  var mergeAK     = col.hof_merge_ak !== false; // Standard: true
  var selKats     = col.hof_kats || []; // leeres Array = alle
  return '<div style="padding:2px 0 6px">' +
    '<div style="font-size:11px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">Konfiguration</div>' +
    '<div style="display:flex;flex-direction:column;gap:10px">' +

      '<label style="display:flex;align-items:center;gap:10px;font-size:13px">' +
        '<span style="min-width:140px;color:var(--text2)">Max. Athleten</span>' +
        '<input type="number" id="hof-limit-' + ri + '-' + ci + '" value="' + limit + '" min="1" max="100" placeholder="alle" ' +
        'class="settings-input" style="width:80px" onchange="dashUpdateLayout()">' +
        '<span style="font-size:12px;color:var(--text2)">(leer = alle)</span>' +
      '</label>' +
      '<label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:13px">' +
        '<input type="checkbox" data-hof="leaderboard" data-ri="' + ri + '" data-ci="' + ci + '"' + (leaderboard ? ' checked' : '') + ' onchange="dashUpdateLayout()">' +
        '<span>Als Leaderboard (mit Platzierung)</span>' +
      '</label>' +
      '<label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:13px">' +
        '<input type="checkbox" data-hof="merge_ak" data-ri="' + ri + '" data-ci="' + ci + '"' + (mergeAK ? ' checked' : '') + ' onchange="dashUpdateLayout()">' +
        '<span>Jugend-AK zu MHK/WHK zusammenfassen</span>' +
      '</label>' +
      (function() {
        // Kategorien aus state.disziplinen ableiten (immer verfügbar)
        var _seen = {}, kats = [];
        var _diszArr = state.disziplinen || [];
        for (var _ki = 0; _ki < _diszArr.length; _ki++) {
          var _d = _diszArr[_ki];
          if (_d.tbl_key && !_seen[_d.tbl_key]) {
            _seen[_d.tbl_key] = true;
            kats.push({ tbl_key: _d.tbl_key, name: _d.kategorie || _d.tbl_key });
          }
        }
        if (!kats.length) return '';
        var katBoxes = '<div style="border-top:1px solid var(--border);padding-top:10px;margin-top:2px">' +
          '<div style="font-size:11px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Kategorien (leer = alle)</div>';
        for (var ki = 0; ki < kats.length; ki++) {
          var k = kats[ki];
          var chk = !selKats.length || selKats.indexOf(k.tbl_key) >= 0 ? ' checked' : '';
          katBoxes += '<label style="display:flex;align-items:center;gap:8px;font-size:13px;padding:2px 0;cursor:pointer">' +
            '<input type="checkbox" data-hof-kat="' + k.tbl_key + '" data-ri="' + ri + '" data-ci="' + ci + '"' + chk + ' onchange="dashUpdateLayout()">' +
            k.name + '</label>';
        }
        return katBoxes + '</div>';
      })() +
    '</div>' +
  '</div>';
}

function dashTimelineConfigHtml(ri, ci, hidden_types, prio_order, col) {
  var hidden   = hidden_types || [];
  var mergeAK  = col && col.tl_merge_ak !== false; // Standard: true
  // Prio-Reihenfolge ist fix — nur Ein/Ausblenden konfigurierbar
  var rows = '';
  for (var i = 0; i < TIMELINE_TYPE_DEFS.length; i++) {
    var t = TIMELINE_TYPE_DEFS[i];
    var chk = hidden.indexOf(t.id) < 0 ? ' checked' : '';
    rows +=
      '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;' + (i < TIMELINE_TYPE_DEFS.length-1 ? 'border-bottom:1px solid var(--border);' : '') + '">' +
        '<input type="checkbox" data-tl-id="' + t.id + '" data-ri="' + ri + '" data-ci="' + ci + '"' + chk + ' onchange="dashUpdateLayout()">' +
        '<span style="flex:1;font-size:13px" title="' + t.desc + '">' + t.label + '</span>' +
      '</div>';
  }
  return '<div style="padding:2px 0 6px">' +
    '<div style="font-size:11px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">Neueste Bestleistungen</div>' +
    '<label style="display:flex;align-items:center;gap:10px;font-size:13px;margin-bottom:8px">' +
      '<input type="checkbox" data-tl="auto_fill" data-ri="' + ri + '" data-ci="' + ci + '"' + ((col && col.tl_auto_fill) ? ' checked' : '') + ' onchange="dashUpdateLayout();var _lEl=document.getElementById(\'tl-limit-'+ri+'-'+ci+'\');if(_lEl)_lEl.disabled=this.checked;">' +
      '<span style="color:var(--text2)">Box automatisch füllen</span>' +
    '</label>' +
    '<label style="display:flex;align-items:center;gap:10px;font-size:13px;margin-bottom:12px">' +
      '<span style="min-width:120px;color:var(--text2)">Anzahl Einträge</span>' +
      '<input type="number" id="tl-limit-' + ri + '-' + ci + '" value="' + ((col && col.tl_limit) || appConfig.dashboard_timeline_limit || 20) + '" min="5" max="200" ' +
      'class="settings-input" style="width:70px" onchange="dashUpdateLayout()"' + ((col && col.tl_auto_fill) ? ' disabled' : '') + '>' +
    '</label>' +
    '<label style="display:flex;align-items:center;gap:10px;font-size:13px;margin-bottom:16px">' +
      '<input type="checkbox" data-tl="merge_ak" data-ri="' + ri + '" data-ci="' + ci + '"' + (mergeAK ? ' checked' : '') + ' onchange="dashUpdateLayout()">' +
      '<span style="color:var(--text2)">Jugend-AK zu MHK\uFE0E/WHK\uFE0E zusammenfassen</span>' +
    '</label>' +
    '<label style="display:flex;align-items:center;gap:10px;font-size:13px;margin-bottom:16px">' +
      '<input type="checkbox" data-tl="nur_favoriten" data-ri="' + ri + '" data-ci="' + ci + '"' + ((col && col.tl_nur_favoriten) ? ' checked' : '') + ' onchange="dashUpdateLayout()">' +
      '<span style="color:var(--text2)">Nur favorisierte Disziplinen anzeigen</span>' +
    '</label>' +
    '<div style="font-size:11px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Angezeigte Typen</div>' +
    rows +
  '</div>';
}

function dashStatsConfigHtml(ri, ci, cards) {
  var active = cards && cards.length ? cards : ['ergebnisse', 'athleten', 'rekorde'];
  var rows = '';
  for (var i = 0; i < STAT_CARD_DEFS.length; i++) {
    var sc = STAT_CARD_DEFS[i];
    var checked = active.indexOf(sc.id) >= 0 ? ' checked' : '';
    var pos = active.indexOf(sc.id) + 1; // 0 = nicht aktiv
    rows +=
      '<label style="display:flex;align-items:center;gap:8px;padding:4px 0;cursor:pointer;font-size:13px">' +
        '<input type="checkbox" data-stats-id="' + sc.id + '" data-ri="' + ri + '" data-ci="' + ci + '"' + checked + ' onchange="dashUpdateLayout()">' +
        '<span style="flex:1">' + sc.icon + ' ' + sc.label + '</span>' +
        (active.indexOf(sc.id) >= 0 ?
          '<span style="display:flex;gap:4px">' +
            '<button class="btn btn-ghost btn-sm" title="Nach oben" style="padding:2px 6px" onclick="dashStatsMoveCard(' + ri + ',' + ci + ',\'' + sc.id + '\',-1)">▲</button>' +
            '<button class="btn btn-ghost btn-sm" title="Nach unten" style="padding:2px 6px" onclick="dashStatsMoveCard(' + ri + ',' + ci + ',\'' + sc.id + '\',1)">▼</button>' +
          '</span>'
        : '') +
      '</label>';
  }
  return '<div style="padding:2px 0 6px">' +
    '<div style="font-size:11px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Angezeigte Karten</div>' +
    rows +
  '</div>';
}

function dashStatsMoveCard(ri, ci, cardId, dir) {
  dashUpdateLayout();
  var layout = dashGetLayout();
  var col = layout[ri] && layout[ri].cols[ci];
  if (!col) return;
  var cards = col.cards && col.cards.length ? col.cards.slice() : ['ergebnisse','athleten','rekorde'];
  var idx = cards.indexOf(cardId);
  if (idx < 0) return;
  var newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= cards.length) return;
  var tmp = cards[idx]; cards[idx] = cards[newIdx]; cards[newIdx] = tmp;
  col.cards = cards;
  renderAdminDashboardUI(layout);
}

function dashEigenesProfilConfigHtml(ri, ci, col) {
  return ''; // keine extra Konfiguration
}

function dashSichtbarkeitHtml(ri, ci, selected) {
  // Alle Rollen (inkl. nicht-eingeloggt) für Checkbox-Liste
  var allRollen = [
    { name: 'nicht-eingeloggt', label: 'Nicht eingeloggt' },
    { name: 'leser',   label: 'Leser' },
    { name: 'athlet',  label: 'Athlet' },
    { name: 'editor',  label: 'Editor' },
    { name: 'admin',   label: 'Admin' },
  ];
  // Dynamische Rollen aus _rollenMap
  if (window._rollenMap) {
    Object.keys(_rollenMap).forEach(function(k) {
      if (!allRollen.find(function(r){ return r.name===k; })) {
        allRollen.push({ name: k, label: _rollenMap[k].label || k });
      }
    });
  }
  var noFilter = !selected || selected.length === 0;
  var checkboxes = allRollen.map(function(r) {
    var checked = noFilter || selected.indexOf(r.name) >= 0;
    return '<label style="display:inline-flex;align-items:center;gap:4px;font-size:11px;cursor:pointer;white-space:nowrap">' +
      '<input type="checkbox" data-sf-rolle="' + r.name + '" data-sf-ri="' + ri + '" data-sf-ci="' + ci + '" ' +
      (checked ? 'checked' : '') + ' onchange="dashUpdateLayout()"> ' + r.label + '</label>';
  }).join('');
  return '<div style="margin-top:4px">' +
    '<div style="font-size:11px;font-weight:600;color:var(--text2);margin-bottom:4px">Sichtbar für:</div>' +
    '<div style="display:flex;flex-wrap:wrap;gap:6px 10px">' + checkboxes + '</div>' +
  '</div>';
}

function renderAdminDashboardUI(layout) {
  var el = document.getElementById('main-content');

  function widgetSelect(rowIdx, colIdx, currentVal) {
    var id = 'dash-widget-' + rowIdx + '-' + colIdx;
    var opts = '<option value="">(leer)</option>';
    for (var i = 0; i < WIDGET_DEFS.length; i++) {
      opts += '<option value="' + WIDGET_DEFS[i].id + '"' + (WIDGET_DEFS[i].id === currentVal ? ' selected' : '') + '>' + WIDGET_DEFS[i].label + '</option>';
    }
    return '<select id="' + id + '" class="settings-input" style="flex:1;min-width:0" onchange="dashUpdateLayout()">' + opts + '</select>';
  }

  function widthInput(rowIdx, colIdx, currentW) {
    var id = 'dash-w-' + rowIdx + '-' + colIdx;
    return '<label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text2);white-space:nowrap">' +
      'Breite: <input type="number" id="' + id + '" value="' + (currentW || '') + '" min="100" max="1200" placeholder="auto" ' +
      'class="settings-input" style="width:80px" onchange="dashUpdateLayout()"/><span style="font-size:11px">px (leer = 1fr)</span>' +
    '</label>';
  }

  var rowsHtml = '';
  for (var ri = 0; ri < layout.length; ri++) {
    var row = layout[ri];
    var cols = row.cols || [];
    var colsHtml = '';
    for (var ci = 0; ci < cols.length; ci++) {
      var col = cols[ci];
      var widgetConfig = '';
      if (col.widget === 'stats')          widgetConfig = dashStatsConfigHtml(ri, ci, col.cards);
      if (col.widget === 'timeline')       widgetConfig = dashTimelineConfigHtml(ri, ci, col.hidden_types, col.prio_order, col);
      if (col.widget === 'veranstaltungen') widgetConfig = dashVeranstConfigHtml(ri, ci, col.col_order, col.hidden_cols, col);
      if (col.widget === 'hall-of-fame')      widgetConfig = dashHofConfigHtml(ri, ci, col);
      if (col.widget === 'eigenes-profil')   widgetConfig = dashEigenesProfilConfigHtml(ri, ci, col);
      // eigene-bestzeiten hat keine extra Konfiguration
      colsHtml +=
        '<div style="display:flex;flex-direction:column;gap:10px;flex:1;min-width:0;background:var(--surf2);border-radius:10px;padding:14px">' +
          '<div style="display:flex;align-items:center;gap:8px">' +
            widgetSelect(ri, ci, col.widget) +
            (cols.length > 1
              ? '<button class="btn btn-ghost btn-sm" title="Spalte entfernen" onclick="dashRemoveCol(' + ri + ',' + ci + ')">&#x1F5D1;&#xFE0F;</button>'
              : '') +
          '</div>' +
          '<label style="display:flex;align-items:center;gap:8px;font-size:12px">' +
            '<span style="color:var(--text2);white-space:nowrap">Titel</span>' +
            '<input type="text" id="dash-title-' + ri + '-' + ci + '" value="' + (col.title || '').replace(/"/g,'&quot;') + '" placeholder="Standard" ' +
            'class="settings-input" style="flex:1" oninput="dashUpdateLayout()">' +
          '</label>' +
          widgetConfig +
          dashSichtbarkeitHtml(ri, ci, col.sichtbar_fuer || []) +
          widthInput(ri, ci, col.w) +
        '</div>';
    }
    rowsHtml +=
      '<div style="padding:16px 0;' + (ri < layout.length - 1 ? 'border-bottom:1px solid var(--border);' : '') + 'margin-bottom:4px">' +
        '<div style="display:flex;align-items:center;gap:6px;margin-bottom:10px">' +
          '<span style="font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:1px">Zeile ' + (ri + 1) + '</span>' +
          '<div style="flex:1"></div>' +
          (ri > 0
            ? '<button class="btn btn-ghost btn-sm" title="Zeile nach oben" onclick="dashMoveRow(' + ri + ',-1)">▲</button>'
            : '<button class="btn btn-ghost btn-sm" disabled style="opacity:.3">▲</button>') +
          (ri < layout.length - 1
            ? '<button class="btn btn-ghost btn-sm" title="Zeile nach unten" onclick="dashMoveRow(' + ri + ',1)">▼</button>'
            : '<button class="btn btn-ghost btn-sm" disabled style="opacity:.3">▼</button>') +
          (cols.length < 4 ? '<button class="btn btn-ghost btn-sm" onclick="dashAddCol(' + ri + ')">+ Spalte</button>' : '') +
          '<button class="btn btn-danger btn-sm" onclick="dashRemoveRow(' + ri + ')">&#x1F5D1;&#xFE0F; Zeile</button>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px">' + colsHtml + '</div>' +
      '</div>';
  }

  el.innerHTML = adminSubtabs() +
    '<div style="max-width:760px">' +
      '<div class="panel">' +
        '<div class="panel-header">' +
          '<div class="panel-title">&#x1F4CA;&#xFE0E; Dashboard-Layout</div>' +
          '<div style="display:flex;gap:8px">' +
            '<button class="btn btn-ghost btn-sm" onclick="dashAddRow()">+ Zeile</button>' +
            '<button class="btn btn-ghost btn-sm" onclick="dashResetLayout()">&#x21BA; Reset</button>' +
            '<button class="btn btn-primary btn-sm" onclick="dashSaveLayout()">&#x1F4BE; Speichern</button>' +
          '</div>' +
        '</div>' +
        '<div class="settings-panel-body">' +
          '<p style="font-size:13px;color:var(--text2);margin:0 0 4px">Widgets in Zeilen und Spalten anordnen.</p>' +
          '<div id="dash-rows">' + rowsHtml + '</div>' +
        '</div>' +
      '</div>' +
    '</div>';

  // layout im DOM speichern für Mutations
  el._dashLayout = layout;
}

function dashGetLayout() {
  var el = document.getElementById('main-content');
  return el._dashLayout || dashLayoutFromConfig();
}

function dashUpdateLayout() {
  var layout = dashGetLayout();
  for (var ri = 0; ri < layout.length; ri++) {
    var cols = layout[ri].cols || [];
    for (var ci = 0; ci < cols.length; ci++) {
      var wEl  = document.getElementById('dash-widget-' + ri + '-' + ci);
      var wW   = document.getElementById('dash-w-'      + ri + '-' + ci);
      var wTit = document.getElementById('dash-title-'  + ri + '-' + ci);
      if (wEl)  cols[ci].widget = wEl.value;
      if (wW)   { var v = parseInt(wW.value); cols[ci].w = isNaN(v) ? undefined : v; }
      if (wTit !== null) { cols[ci].title = wTit.value.trim(); } // nur wenn DOM-Element existiert
      // Stat-Karten: Reihenfolge aus bisherigem cards-Array + Checkbox-Status
      if (cols[ci].widget === 'stats') {
        var prevCards = cols[ci].cards && cols[ci].cards.length ? cols[ci].cards : ['ergebnisse','athleten','rekorde'];
        var boxes = document.querySelectorAll('input[data-stats-id][data-ri="' + ri + '"][data-ci="' + ci + '"]');
        var newCards = [];
        for (var pi = 0; pi < prevCards.length; pi++) {
          for (var bi = 0; bi < boxes.length; bi++) {
            if (boxes[bi].dataset.statsId === prevCards[pi] && boxes[bi].checked) { newCards.push(prevCards[pi]); break; }
          }
        }
        for (var bi2 = 0; bi2 < boxes.length; bi2++) {
          if (boxes[bi2].checked && newCards.indexOf(boxes[bi2].dataset.statsId) < 0) newCards.push(boxes[bi2].dataset.statsId);
        }
        cols[ci].cards = newCards;
      }
      // sichtbar_fuer: Multi-Select Checkboxen
      var sfBoxes = document.querySelectorAll('input[data-sf-rolle][data-sf-ri="' + ri + '"][data-sf-ci="' + ci + '"]');
      if (sfBoxes.length) {
        var sfVals = [];
        sfBoxes.forEach(function(cb) { if (cb.checked) sfVals.push(cb.dataset.sfRolle); });
        cols[ci].sichtbar_fuer = sfVals;
      }
      if (cols[ci].widget === 'hall-of-fame') {
        var hofLimitEl = document.getElementById('hof-limit-' + ri + '-' + ci);
        if (hofLimitEl) {
          var lv = parseInt(hofLimitEl.value);
          cols[ci].hof_limit = isNaN(lv) || lv <= 0 ? 0 : lv;
        }
        var hofBoxes = document.querySelectorAll('input[data-hof][data-ri="' + ri + '"][data-ci="' + ci + '"]');
        for (var hbi = 0; hbi < hofBoxes.length; hbi++) {
          var hkey = hofBoxes[hbi].dataset.hof;
          cols[ci]['hof_' + hkey] = hofBoxes[hbi].checked;
        }
        // merge_ak default true wenn nicht explizit gesetzt
        if (cols[ci].hof_merge_ak === undefined) cols[ci].hof_merge_ak = true;
        // Kategorien-Checkboxen lesen
        var katBoxes = document.querySelectorAll('input[data-hof-kat][data-ri="' + ri + '"][data-ci="' + ci + '"]');
        if (katBoxes.length) {
          var checkedKats = [];
          var allChecked = true;
          for (var kbi = 0; kbi < katBoxes.length; kbi++) {
            if (katBoxes[kbi].checked) checkedKats.push(katBoxes[kbi].dataset.hofKat);
            else allChecked = false;
          }
          cols[ci].hof_kats = allChecked ? [] : checkedKats; // leer = alle
        }
      }
      if (cols[ci].widget === 'veranstaltungen') {
        var vcBoxes = document.querySelectorAll('input[data-vc-id][data-ri="' + ri + '"][data-ci="' + ci + '"]');
        var newHiddenCols = [];
        for (var vbi = 0; vbi < vcBoxes.length; vbi++) {
          if (!vcBoxes[vbi].checked) newHiddenCols.push(vcBoxes[vbi].dataset.vcId);
        }
        cols[ci].hidden_cols = newHiddenCols;
        var veranstLimitEl2 = document.getElementById('veranst-limit-' + ri + '-' + ci);
        if (veranstLimitEl2) { var vl2 = parseInt(veranstLimitEl2.value); cols[ci].veranst_limit = isNaN(vl2)||vl2<1?5:vl2; }
        // col_order bleibt erhalten (wird nur durch dashVcMoveCol geändert)
      }
      if (cols[ci].widget === 'timeline') {
        var tlBoxes = document.querySelectorAll('input[data-tl-id][data-ri="' + ri + '"][data-ci="' + ci + '"]');
        var newHidden = [];
        for (var tbi = 0; tbi < tlBoxes.length; tbi++) {
          if (!tlBoxes[tbi].checked) newHidden.push(tlBoxes[tbi].dataset.tlId);
        }
        cols[ci].hidden_types = newHidden;
        // merge_ak Checkbox
        var tlMergeEl = document.querySelector('input[data-tl="merge_ak"][data-ri="' + ri + '"][data-ci="' + ci + '"]');
        if (tlMergeEl) cols[ci].tl_merge_ak = tlMergeEl.checked;
        // Nur Favoriten Checkbox
        var tlFavEl = document.querySelector('input[data-tl="nur_favoriten"][data-ri="' + ri + '"][data-ci="' + ci + '"]');
        if (tlFavEl) cols[ci].tl_nur_favoriten = tlFavEl.checked;
        // Auto-fill
        var tlAutoFillEl = document.querySelector('input[data-tl="auto_fill"][data-ri="' + ri + '"][data-ci="' + ci + '"]');
        if (tlAutoFillEl) {
          cols[ci].tl_auto_fill = tlAutoFillEl.checked;
          var _limEl = document.getElementById('tl-limit-' + ri + '-' + ci);
          if (_limEl) _limEl.disabled = tlAutoFillEl.checked;
        }
        // Anzahl Einträge
        var tlLimitEl = document.getElementById('tl-limit-' + ri + '-' + ci);
        if (tlLimitEl) {
          var tlLv = Math.max(5, Math.min(200, parseInt(tlLimitEl.value) || 20));
          cols[ci].tl_limit = tlLv;
        }
      }
    }
  }
}

function dashMoveRow(idx, dir) {
  dashUpdateLayout();
  var layout = dashGetLayout();
  var other = idx + dir;
  if (other < 0 || other >= layout.length) return;
  var tmp = layout[idx]; layout[idx] = layout[other]; layout[other] = tmp;
  renderAdminDashboardUI(layout);
}

function dashAddRow() {
  dashUpdateLayout();
  var layout = dashGetLayout();
  layout.push({ cols: [{ widget: '' }] });
  renderAdminDashboardUI(layout);
}

function dashRemoveRow(idx) {
  dashUpdateLayout();
  var layout = dashGetLayout();
  layout.splice(idx, 1);
  renderAdminDashboardUI(layout);
}

function dashAddCol(rowIdx) {
  dashUpdateLayout();
  var layout = dashGetLayout();
  if ((layout[rowIdx].cols || []).length >= 4) return;
  layout[rowIdx].cols.push({ widget: '' });
  renderAdminDashboardUI(layout);
}

function dashRemoveCol(rowIdx, colIdx) {
  dashUpdateLayout();
  var layout = dashGetLayout();
  layout[rowIdx].cols.splice(colIdx, 1);
  if (!layout[rowIdx].cols.length) layout.splice(rowIdx, 1);
  renderAdminDashboardUI(layout);
}

async function dashSaveLayout() {
  dashUpdateLayout();
  var layout = dashGetLayout();
  // Leere Widget-Slots entfernen
  var clean = [];
  for (var ri = 0; ri < layout.length; ri++) {
    var cols = (layout[ri].cols || []).filter(function(c) { return c.widget; });
    if (cols.length) clean.push({ cols: cols });
  }
  var json = JSON.stringify(clean);
  var r = await apiPost('einstellungen', { dashboard_layout: json });
  if (r && r.ok) {
    appConfig.dashboard_layout = json;
    notify('Dashboard-Layout gespeichert.', 'ok');
    // Dashboard-Cache invalidieren damit beim nächsten Aufruf neu geladen wird
    state._dashboardRendered = false;
  } else {
    notify((r && r.fehler) || 'Fehler beim Speichern', 'err');
  }
}

function dashResetLayout() {
  var defaultLayout = [
    { cols: [{ widget: 'stats', cards: ['ergebnisse','athleten','rekorde'] }] },
    { cols: [{ widget: 'timeline', w: 340 }, { widget: 'veranstaltungen' }] }
  ];
  appConfig.dashboard_layout = JSON.stringify(defaultLayout);
  renderAdminDashboardUI(defaultLayout);
  notify('Layout zurückgesetzt – bitte speichern.', 'ok');
}

async function renderAdminDarstellung() {
  var el = document.getElementById('main-content');
  el.innerHTML = adminSubtabs() + '<div class="loading"><div class="spinner"></div>Laden&hellip;</div>';

  var r = await apiGet('einstellungen');
  var cfg = (r && r.ok) ? r.data : appConfig;

  function cfgVal(k, def) {
    if (cfg[k] !== undefined) return cfg[k];
    if (appConfig[k] !== undefined) return appConfig[k];
    return def;
  }
  function row(label, desc, inputHtml) {
    return '<div class="settings-row">' +
      '<div class="settings-row-label">' +
        '<div style="font-size:13px;font-weight:600;color:var(--text)">' + label + '</div>' +
        (desc ? '<div style="font-size:12px;color:var(--text2);margin-top:2px">' + desc + '</div>' : '') +
      '</div>' +
      '<div class="settings-row-input">' + inputHtml + '</div>' +
    '</div>';
  }
  function textIn(id, val, placeholder) {
    return '<input type="text" id="' + id + '" value="' + (val||'').replace(/"/g,'&quot;') + '" placeholder="' + (placeholder||'') + '" class="settings-input"/>';
  }
  function numIn(id, val, min, max) {
    return '<input type="number" id="' + id + '" value="' + (val||'') + '" min="' + min + '" max="' + max + '" class="settings-input" style="width:100px"/>';
  }
  function colorIn(id, val) {
    return '<div style="display:flex;align-items:center;gap:10px">' +
      '<input type="color" id="' + id + '-picker" value="' + (val||'#000000') + '" style="width:42px;height:36px;border:none;background:none;cursor:pointer;padding:0" oninput="document.getElementById(\'' + id + '\').value=this.value"/>' +
      '<input type="text" id="' + id + '" value="' + (val||'') + '" maxlength="7" class="settings-input" style="width:100px;font-family:monospace" oninput="if(this.value.match(/^#[0-9a-fA-F]{6}$/))document.getElementById(\'' + id + '-picker\').value=this.value"/>' +
    '</div>';
  }
  function renderPortalAppRows() {
    var apps = [];
    try { apps = JSON.parse(cfgVal('login_portal_apps','[]')); } catch(e) {}
    if (!apps.length) return '';
    return apps.map(function(a) {
      return '<div class="portal-app-row" style="display:flex;gap:6px;align-items:center;margin-bottom:8px">' +
        '<input type="text" placeholder="Name" value="' + (a.name||'').replace(/"/g,'&quot;') + '" data-pa="name" class="settings-input" style="flex:1;min-width:0"/>' +
        '<input type="text" placeholder="https://..." value="' + (a.url||'').replace(/"/g,'&quot;') + '" data-pa="url" class="settings-input" style="flex:2;min-width:0"/>' +
        '<input type="text" placeholder="📊" value="' + (a.icon||'').replace(/"/g,'&quot;') + '" data-pa="icon" class="settings-input" style="width:44px;text-align:center"/>' +
        '<input type="color" value="' + (a.farbe||'#5b6cf8') + '" data-pa="farbe" title="Farbe" style="width:38px;height:34px;border:none;background:none;cursor:pointer;padding:0"/>' +
        '<button class="btn" style="padding:4px 8px;font-size:16px;line-height:1" onclick="this.closest(\'.portal-app-row\').remove()">&#x00D7;</button>' +
      '</div>';
    }).join('');
  }

  el.innerHTML = adminSubtabs() +
    '<div style="max-width:680px;display:flex;flex-direction:column;gap:20px">' +

    // ── Wartungsmodus ──
    '<div class="panel">' +
      '<div class="panel-header"><div class="panel-title">&#x1F6E0;&#xFE0E; Wartungsmodus</div></div>' +
      '<div class="settings-panel-body">' +
        row('Wartungsmodus', 'Wenn aktiv, k\u00f6nnen sich nur Administratoren (oder Rollen mit dem Recht \u201eIm Wartungsmodus einloggen\u201c) anmelden. Alle anderen Besucher sehen die Wartungsseite.',
          '<label style="display:flex;align-items:center;gap:10px;cursor:pointer">' +
          '<input type="checkbox" id="cfg-wartung_aktiv" ' + (cfgVal('wartung_aktiv','0') === '1' ? 'checked' : '') + ' style="width:18px;height:18px;cursor:pointer" onchange="saveWartungAktiv(this.checked)"/>' +
          '<span style="font-size:13px;color:var(--text2)">Wartungsmodus aktivieren</span>' +
          '</label>') +
        row('Wartungsseite – Nachricht', 'Diese Meldung wird nicht eingeloggten Besuchern angezeigt.',
          '<textarea id="cfg-wartung_nachricht" rows="3" class="settings-input" style="resize:vertical">' + (cfgVal('wartung_nachricht','')||'').replace(/</g,'&lt;') + '</textarea>') +
      '</div>' +
    '</div>' +

    // ── Verein ──
    '<div class="panel">' +
      '<div class="panel-header"><div class="panel-title">🏟️ Verein</div></div>' +
      '<div class="settings-panel-body">' +
        row('Vereinsname', 'Vollständiger Name, z.B. in E-Mails', textIn('cfg-verein_name', cfgVal('verein_name',''))) +
        row('Kurzbezeichnung', 'Im Header und Menü angezeigt', textIn('cfg-verein_kuerzel', cfgVal('verein_kuerzel',''))) +
        row('App-Untertitel', 'Unter dem Vereinsnamen im Header', textIn('cfg-app_untertitel', cfgVal('app_untertitel','Leichtathletik-Statistik'))) +
        row('Vereinslogo', 'PNG, JPG, SVG oder WebP · max. 2 MB',
          '<div style="display:flex;flex-direction:column;gap:12px">' +
          // Vorschau
          '<div id="logo-preview-wrap" style="' + (cfgVal('logo_datei','') ? '' : 'display:none;') + '">' +
            '<img id="logo-preview" src="' + (cfgVal('logo_datei','') ? '/' + cfgVal('logo_datei','') : '') + '" ' +
                 'style="height:56px;object-fit:contain;border-radius:6px;background:var(--surf2);padding:8px;border:1px solid var(--border)" ' +
                 'onerror="this.parentNode.style.display=\'none\'">' +
          '</div>' +
          // Datei wählen + Name
          '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">' +
            '<label class="btn btn-ghost btn-sm" style="cursor:pointer;margin:0">' +
              '📁 Datei wählen' +
              '<input type="file" id="cfg-logo-file" accept="image/png,image/jpeg,image/gif,image/svg+xml,image/webp" style="display:none" onchange="previewLogo(this)">' +
            '</label>' +
            '<span id="cfg-logo-filename" style="font-size:13px;color:var(--text2)">Keine Datei gewählt</span>' +
          '</div>' +
          // Upload- und Löschen-Button
          '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
            '<button id="cfg-logo-upload-btn" class="btn btn-primary btn-sm" onclick="uploadLogo()" style="display:none">⬆️ Logo hochladen</button>' +
            (cfgVal('logo_datei','') ?
              '<button class="btn btn-danger btn-sm" onclick="deleteLogo()">🗑️ Logo löschen</button>' : '') +
          '</div>' +
          '</div>') +
      '</div>' +
    '</div>' +

    // ── E-Mail ──
    '<div class="panel">' +
    '<div class="panel-header"><div class="panel-title">📧 E-Mail-Einstellungen</div></div>' +
    '<div class="settings-panel-body">' +
      '<div class="settings-row">' +
        '<div class="settings-row-label">' +
          '<div style="font-weight:600">Zugelassene E-Mail-Domain</div>' +
          '<div style="font-size:12px;color:var(--text2)">Nur Adressen mit dieser Domain dürfen sich registrieren</div>' +
        '</div>' +
        '<div class="settings-row-input" style="display:flex;align-items:center;gap:10px">' +
          '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;flex-shrink:0">' +
            '<input type="checkbox" id="cfg-email_domain_aktiv" ' + (cfgVal('email_domain','') ? 'checked' : '') + ' style="width:16px;height:16px;cursor:pointer"' +
              ' onchange="document.getElementById(\'cfg-email_domain\').disabled=!this.checked">' +
            '<span style="font-size:12px;color:var(--text2)">Aktiv</span>' +
          '</label>' +
          '<input type="text" id="cfg-email_domain" value="' + (cfgVal('email_domain','')).replace(/"/g,'&quot;') + '" placeholder="meinverein.de"' +
            ' class="settings-input"' + (cfgVal('email_domain','') ? '' : ' disabled') + '/>' +
        '</div>' +
      '</div>' +
      '<div class="settings-row">' +
        '<div class="settings-row-label">' +
          '<div style="font-weight:600">Absender-E-Mail</div>' +
          '<div style="font-size:12px;color:var(--text2)">Von-Adresse für System-Mails</div>' +
        '</div>' +
        '<div class="settings-row-input">' +
          '<input type="text" id="cfg-noreply_email" value="' + (cfgVal('noreply_email','')).replace(/"/g,'&quot;') + '" placeholder="noreply@..." class="settings-input"/>' +
        '</div>' +
      '</div>' +
      '<div class="settings-row">' +
        '<div class="settings-row-label">' +
          '<div style="font-weight:600">Registrierung – Freigabe</div>' +
          '<div style="font-size:12px;color:var(--text2)">Ob neue Benutzer sofort aktiv sind oder erst vom Admin bestätigt werden müssen</div>' +
        '</div>' +
        '<div class="settings-row-input">' +
          '<div style="display:flex;flex-direction:column;gap:8px">' +
            '<label style="display:flex;align-items:center;gap:8px;cursor:pointer">' +
              '<input type="radio" name="cfg-auto_freigabe" id="cfg-auto_freigabe_0" value="0" ' + (cfgVal('registrierung_auto_freigabe','0') !== '1' ? 'checked' : '') + ' style="cursor:pointer">' +
              '<span style="font-size:13px">🔐 Manuelle Bestätigung durch Admin (Standard)</span>' +
            '</label>' +
            '<label style="display:flex;align-items:center;gap:8px;cursor:pointer">' +
              '<input type="radio" name="cfg-auto_freigabe" id="cfg-auto_freigabe_1" value="1" ' + (cfgVal('registrierung_auto_freigabe','0') === '1' ? 'checked' : '') + ' style="cursor:pointer">' +
              '<span style="font-size:13px">✅ Sofort aktiv nach E-Mail-Bestätigung</span>' +
            '</label>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '</div>' +

    // ── Farben ──
    '<div class="panel">' +
      '<div class="panel-header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">' +
        '<div class="panel-title">🎨 Vereinsfarben</div>' +
        '<button class="btn btn-ghost btn-sm" onclick="resetFarben()" title="Haupt- und Akzentfarbe auf #cc0000 / #003087 zurücksetzen" style="font-size:12px">↺ Zurücksetzen</button>' +
      '</div>' +
      '<div class="settings-panel-body">' +
        row('Hauptfarbe', 'Header-Hintergrund, Buttons, Badges', colorIn('cfg-farbe_primary', cfgVal('farbe_primary','#cc0000'))) +
        row('Akzentfarbe', 'Nav-Unterstreichung, Sekundär-Buttons', colorIn('cfg-farbe_accent', cfgVal('farbe_accent','#003087'))) +
      '</div>' +
    '</div>' +


    // ── Darstellung ──
    '<div class="panel">' +
      '<div class="panel-header"><div class="panel-title">📊 Darstellung</div></div>' +
      '<div class="settings-panel-body">' +

        row('Disziplinbezeichnung', 'Kategorie in Klammern hinter den Disziplinnamen stellen, z.B. "10km (Straße)"',
          '<label style="display:flex;align-items:center;gap:10px;cursor:pointer">' +
          '<input type="checkbox" id="cfg-disziplin_kategorie_suffix" ' + (cfgVal('disziplin_kategorie_suffix','1') === '1' ? 'checked' : '') + ' style="width:18px;height:18px;cursor:pointer" onchange="saveDiszKatSuffix(this.checked)"/>' +
          '<span style="font-size:13px;color:var(--text2)">Kategorie hinter Disziplinbezeichnung anzeigen</span>' +
          '</label>') +
        row('Versionsstand im Header', 'Wenn aktiv, wird die Versionsnummer nur eingeloggten Admins angezeigt',
          '<label style="display:flex;align-items:center;gap:10px;cursor:pointer">' +
          '<input type="checkbox" id="cfg-version_nur_admins" ' + (cfgVal('version_nur_admins','1') === '1' ? 'checked' : '') + ' style="width:18px;height:18px;cursor:pointer"/>' +
          '<span style="font-size:13px;color:var(--text2)">Nur für Admins sichtbar</span>' +
          '</label>') +
        row('Safari-Adressleiste einfärben', 'Färbt die Adressleiste im mobilen Safari ein (iOS)',
          '<select id="cfg-adressleiste_farbe" class="settings-input" style="width:auto">' +
            '<option value="aus"'     + (cfgVal('adressleiste_farbe','aus') === 'aus'     ? ' selected' : '') + '>Aus</option>' +
            '<option value="primary"' + (cfgVal('adressleiste_farbe','aus') === 'primary' ? ' selected' : '') + '>Hauptfarbe</option>' +
            '<option value="accent"'  + (cfgVal('adressleiste_farbe','aus') === 'accent'  ? ' selected' : '') + '>Akzentfarbe</option>' +
          '</select>') +
        row('Veranstaltungsname anzeigen als', 'Wie der Wettkampfname in Ergebnissen und Athletenprofil dargestellt wird',
          '<select id="cfg-veranstaltung_anzeige" class="settings-input" style="width:auto">' +
            '<option value="ort"'  + (cfgVal('veranstaltung_anzeige','ort')  === 'ort'  ? ' selected' : '') + '>Ort (z.B. &bdquo;Bergisch-Gladbach&rdquo;)</option>' +
            '<option value="name"' + (cfgVal('veranstaltung_anzeige','ort') === 'name' ? ' selected' : '') + '>Veranstaltungsname (z.B. &bdquo;39. Refrather Herbstlauf&rdquo;)</option>' +
          '</select>') +
      '</div>' +
    '</div>' +

    // ── Eintragen ──
    '<div class="panel">' +
      '<div class="panel-header"><div class="panel-title">&#x1F4DD; Eigenes Ergebnis eintragen</div></div>' +
      '<div class="settings-panel-body">' +
        row('Neue Veranstaltungen prüfen', 'Wenn aktiv, werden neue Veranstaltungen aus „Eigenes Ergebnis eintragen" erst nach Admin-Freigabe veröffentlicht.',
          '<label style="display:flex;align-items:center;gap:10px;cursor:pointer">' +
          '<input type="checkbox" id="cfg-eigenes_veranst_prufen" ' + (cfgVal('eigenes_veranst_prufen','1') !== '0' ? 'checked' : '') + ' style="width:18px;height:18px;cursor:pointer"/>' +
          '<span style="font-size:13px;color:var(--text2)">Neue Veranstaltungen vom Admin prüfen lassen</span>' +
          '</label>') +
        row('Eigene Ergebnisse prüfen', 'Wenn aktiv, werden eingereichte Ergebnisse erst nach Editor-/Admin-Freigabe veröffentlicht.',
          '<label style="display:flex;align-items:center;gap:10px;cursor:pointer">' +
          '<input type="checkbox" id="cfg-eigenes_ergebnis_prufen" ' + (cfgVal('eigenes_ergebnis_prufen','1') !== '0' ? 'checked' : '') + ' style="width:18px;height:18px;cursor:pointer"/>' +
          '<span style="font-size:13px;color:var(--text2)">Ergebnis vom Admin prüfen lassen</span>' +
          '</label>') +
      '</div>' +
    '</div>' +

    // ── Footer-Links ──
    '<div class="panel">' +
      '<div class="panel-header"><div class="panel-title">&#x1F504; Footer &amp; Rechtliches</div></div>' +
      '<div class="settings-panel-body">' +
        '<div style="padding:12px 20px;background:var(--surf2);border-radius:8px;margin:8px 20px 16px;font-size:13px;color:var(--text2)">' +
          'Die Texte f\u00fcr Datenschutz, Nutzungsbedingungen und Impressum k\u00f6nnen direkt im Footer bearbeitet werden (als Admin: auf den Link klicken). ' +
          'Die Texte werden im Markdown-Format gespeichert.' +
        '</div>' +
      '</div>' +
    '</div>' +

    // ── Login-Portal ──
    '<div class="panel" style="padding:20px;margin-bottom:16px">' +
      '<div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:6px">&#x1F511; Zentrales Login-Portal</div>' +
      '<div style="font-size:12px;color:var(--text2);margin-bottom:14px">Wenn aktiviert, werden Logins \u00fcber ein zentrales Portal abgewickelt (z.\u202fB. login.tus-oedt.de). Das Statistikportal leitet dann zum Login-Portal weiter. Voraussetzung: gleiche Datenbank und COOKIE_DOMAIN in der config.php beider Instanzen.</div>' +
      row('Login-Portal aktivieren', 'Logins auf das zentrale Portal umleiten',
        '<label style="display:flex;align-items:center;gap:10px;cursor:pointer">' +
        '<input type="checkbox" id="cfg-login_portal_aktiv" ' + (cfgVal('login_portal_aktiv','0') === '1' ? 'checked' : '') + ' style="width:18px;height:18px;cursor:pointer"/>' +
        '<span style="font-size:13px;color:var(--text2)">Aktiv</span>' +
        '</label>') +
      row('Login-Portal URL', 'Vollst\u00e4ndige URL inkl. https://', textIn('cfg-login_portal_url', cfgVal('login_portal_url',''), 'https://login.tus-oedt.de')) +
      row('Passkey RP-ID', 'Gemeinsame Domain f\u00fcr Passkeys (z.\u202fB. tus-oedt.de). Leer = automatisch (Hostname des jeweiligen Portals). Muss in beiden Portalen identisch gesetzt sein.', textIn('cfg-passkey_rp_id', cfgVal('passkey_rp_id',''), 'tus-oedt.de')) +
      '<div style="margin-top:14px">' +
        '<div style="font-size:12px;font-weight:600;color:var(--text);margin-bottom:6px">Registrierte Anwendungen</div>' +
        '<div style="font-size:11px;color:var(--text2);margin-bottom:10px">Diese Apps d\u00fcrfen das Login-Portal als Redirect-Ziel nutzen. Mindestens diese App muss eingetragen sein.</div>' +
        '<div id="portal-apps-list">' + renderPortalAppRows() + '</div>' +
        '<button class="btn" style="margin-top:8px;font-size:12px" onclick="addPortalAppRow()">+ App hinzuf\u00fcgen</button>' +
      '</div>' +
    '</div>' +

    '<div class="panel" style="padding:20px;margin-bottom:16px">' +
      '<div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:6px">&#x1F50E; RaceResult-Scanner</div>' +
      '<div style="font-size:12px;color:var(--text2);margin-bottom:14px">Durchsucht täglich alle von RaceResult gezeiteten Wettkämpfe der ausgewählten Länder nach Starts unseres Vereins und meldet Funde auf der Eintragen-Seite. Der Lauf selbst wird per Cronjob angestoßen.</div>' +
      row('Scanner aktiv', 'Ohne Häkchen ignoriert die Scan-URL alle Aufrufe',
        '<label style="display:flex;align-items:center;gap:10px;cursor:pointer">' +
        '<input type="checkbox" id="cfg-rr_scan_aktiv" ' + (cfgVal('rr_scan_aktiv','0') === '1' ? 'checked' : '') + ' style="width:18px;height:18px;cursor:pointer"/>' +
        '<span style="font-size:13px;color:var(--text2)">Aktiv</span>' +
        '</label>') +
      row('Länder', 'Numerische ISO-IDs, kommagetrennt: 276 = DE, 528 = NL, 56 = BE, 756 = CH, 40 = AT, 250 = FR, 442 = LU',
        textIn('cfg-rr_scan_laender', cfgVal('rr_scan_laender','276,528,56'), '276,528,56')) +
      row('Suchbegriffe', 'Kommagetrennt. Leer = Vereinsname + Kurzbezeichnung aus den Vereinsdaten',
        textIn('cfg-rr_scan_begriffe', cfgVal('rr_scan_begriffe',''), 'z.B. TuS Oedt, TuS 1911 Oedt')) +
      row('Rückblick (Tage)', 'Wie weit die tägliche Wettkampfsuche zurückreicht',
        numIn('cfg-rr_scan_tage', cfgVal('rr_scan_tage','14'), 1, 60)) +
      row('Wettkämpfe pro Lauf', 'Obergrenze je Cron-Aufruf (ca. 2,5 Sekunden pro Wettkampf)',
        numIn('cfg-rr_scan_budget', cfgVal('rr_scan_budget','60'), 1, 500)) +
      '<div id="rr-scan-status" style="margin-top:14px;font-size:12px;color:var(--text2)">Status wird geladen&hellip;</div>' +
      '<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">' +
        '<button class="btn btn-sm" onclick="rrScanJetzt()">&#x25B6;&#xFE0E; Jetzt scannen</button>' +
      '</div>' +
    '</div>' +

    '<div style="padding-bottom:8px">' +
      '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding-bottom:8px">' +
        '<div class="panel" style="padding:20px;margin-bottom:16px">' +
      '<div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:14px">&#128279; GitHub-Integration</div>' +
      '<div style="font-size:12px;color:var(--text2);margin-bottom:14px">F\xc3\xbcr die Funktion "Schlechten Import melden" im Bulk-Eintragen.</div>' +
      row('Repository', 'Format: owner/repo (z.B. tus-oedt/statistik)', textIn('cfg-github_repo', cfgVal('github_repo',''), 'z.B. tus-oedt/statistik')) +
      row('Personal Access Token', 'GitHub PAT mit Issues-Schreibrecht (Settings \u2192 Developer settings)', '<input type="password" id="cfg-github_token" value="' + (cfgVal('github_token','')||'').replace(/"/g,'&quot;') + '" placeholder="ghp_..." class="settings-input"/>') +
      row('Token l\u00e4uft ab am', 'Optional: Ablaufdatum des PAT (f\u00fcr Warnanzeige im System-Dashboard)', '<input type="date" id="cfg-github_token_expires" value="' + (cfgVal('github_token_expires','')||'') + '" class="settings-input" style="width:180px"/>') +
    '</div>' +
'<button class="btn btn-primary" onclick="saveAllSettings()">&#x1F4BE; Alle Einstellungen speichern</button>' +
      '</div>' +
    '</div>' +
  '</div>';

  _rrScanStatus();
}

// Scanner-Status + Cron-URL nachladen (Token kommt nur über diese Route).
async function _rrScanStatus() {
  var box = document.getElementById('rr-scan-status');
  if (!box) return;
  var r = await apiGet('rr-scan-status');
  if (!r || !r.ok) { box.textContent = 'Status konnte nicht geladen werden.'; return; }
  var d = r.data;
  var st = d.letzter_status || {};
  var esc = function(s) { return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); };
  box.innerHTML =
    '<div style="margin-bottom:6px"><strong>Cron-URL</strong> (z.B. stündlich bei all-inkl aufrufen):</div>' +
    '<code style="display:block;padding:8px 10px;background:var(--surf2);border:1px solid var(--border);' +
      'border-radius:6px;word-break:break-all;font-size:11px;margin-bottom:10px">' + esc(d.scan_url) + '</code>' +
    '<div>Suchbegriffe: <strong>' + esc((d.begriffe || []).join(', ') || '–') + '</strong></div>' +
    '<div>Wettkämpfe: ' + (d.events.gesamt || 0) + ' bekannt · ' + (d.events.offen || 0) + ' offen · ' +
      (d.events.fertig || 0) + ' geprüft · ' + (d.events.ohne || 0) + ' ohne Ergebnisliste</div>' +
    '<div>Funde: ' + (d.funde.gesamt || 0) + ' gesamt · ' + (d.funde.neu || 0) + ' offen</div>' +
    '<div>Letzter Lauf: ' + esc(d.letzter_lauf || '–') +
      (st.gescannt !== undefined
        ? ' (' + st.gescannt + ' Wettkämpfe, ' + st.neue_funde + ' neue Funde, ' +
          st.requests + ' Abrufe, ' + st.dauer + ' s' + (st.abgebrochen ? ', Zeitlimit erreicht' : '') + ')'
        : '') +
    '</div>';
}

async function rrScanJetzt() {
  var box = document.getElementById('rr-scan-status');
  if (box) box.textContent = '⏳ Scan läuft – das kann einige Minuten dauern…';
  var r = await apiGet('rr-scan?force=1&sekunden=120');
  if (r && r.ok) notify('Scan beendet: ' + (r.data.neue_funde || 0) + ' neue Funde.', 'ok');
  else notify((r && r.fehler) || 'Scan fehlgeschlagen.', 'err');
  _rrScanStatus();
}

async function saveWartungAktiv(checked) {
  var val = checked ? '1' : '0';
  var r = await apiPost('einstellungen', { wartung_aktiv: val });
  if (r && r.ok) {
    appConfig.wartung_aktiv = val;
    notify(checked ? 'Wartungsmodus aktiviert.' : 'Wartungsmodus deaktiviert.', checked ? 'err' : 'ok');
  } else {
    notify((r && r.fehler) || 'Fehler beim Speichern.', 'err');
  }
}

function addPortalAppRow() {
  var list = document.getElementById('portal-apps-list');
  if (!list) return;
  var row = document.createElement('div');
  row.className = 'portal-app-row';
  row.style.cssText = 'display:flex;gap:6px;align-items:center;margin-bottom:8px';
  row.innerHTML =
    '<input type="text" placeholder="Name" data-pa="name" class="settings-input" style="flex:1;min-width:0"/>' +
    '<input type="text" placeholder="https://..." data-pa="url" class="settings-input" style="flex:2;min-width:0"/>' +
    '<input type="text" placeholder="📊" data-pa="icon" class="settings-input" style="width:44px;text-align:center"/>' +
    '<input type="color" value="#5b6cf8" data-pa="farbe" title="Farbe" style="width:38px;height:34px;border:none;background:none;cursor:pointer;padding:0"/>' +
    '<button class="btn" style="padding:4px 8px;font-size:16px;line-height:1" onclick="this.closest(\'.portal-app-row\').remove()">&#x00D7;</button>';
  list.appendChild(row);
}

function previewLogo(input) {
  var file = input.files[0];
  if (!file) return;
  document.getElementById('cfg-logo-filename').textContent = file.name;
  // Vorschau anzeigen
  var wrap = document.getElementById('logo-preview-wrap');
  var prev = document.getElementById('logo-preview');
  if (prev) { prev.src = URL.createObjectURL(file); }
  if (wrap) { wrap.style.display = ''; }
  // Upload-Button einblenden
  var btn = document.getElementById('cfg-logo-upload-btn');
  if (btn) btn.style.display = '';
}

async function uploadLogo() {
  var logoFile = document.getElementById('cfg-logo-file');
  if (!logoFile || !logoFile.files[0]) return;
  var btn = document.getElementById('cfg-logo-upload-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Hochladen…'; }
  var fd = new FormData();
  fd.append('logo', logoFile.files[0]);
  var r = await apiUpload('upload/logo', fd);
  if (r && r.ok) {
    appConfig.logo_datei = r.data.pfad;
    applyConfig(appConfig);
    notify('Logo gespeichert.', 'ok');
    // Seite neu rendern damit Löschen-Button erscheint
    await renderAdminDarstellung();
  } else {
    notify((r && r.fehler) || 'Upload fehlgeschlagen', 'err');
    if (btn) { btn.disabled = false; btn.textContent = '⬆️ Logo hochladen'; }
  }
}

async function deleteLogo() {
  var r = await apiPost('einstellungen', { logo_datei: '' });
  if (r && r.ok) {
    // Datei serverseitig löschen
    await apiDel('upload/logo');
    appConfig.logo_datei = '';
    applyConfig(appConfig);
    notify('Logo gelöscht.', 'ok');
    await renderAdminDarstellung();
  } else {
    notify((r && r.fehler) || 'Fehler beim Löschen', 'err');
  }
}

// Prüft ob eine Farbe als UI-Hauptfarbe taugt.
// Kriterien: Kontrast gegen hellen UND dunklen Hintergrund je ≥ 1.5:1,
// damit die Farbe in beiden Themes als Fläche erkennbar ist.
// Außerdem: Kontrast der berechneten Textfarbe (on-color) gegen die Fläche ≥ 3.5:1.
function _validateFarbe(hex, label) {
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) {
    return label + ': Ungültiger Farbwert (Format: #rrggbb).';
  }
  var BG_HELL  = '#f0f2f6';
  var BG_DUNKEL = '#0f1117';
  var MIN_BG_KONTRAST = 1.5;   // Fläche muss vom Seitenhintergrund unterscheidbar sein
  var MIN_TEXT_KONTRAST = 3.5; // Text auf der Fläche muss lesbar sein

  function kontrast(a, b) {
    var la = _luminance(a), lb = _luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  if (kontrast(hex, BG_HELL) < MIN_BG_KONTRAST && kontrast(hex, BG_DUNKEL) < MIN_BG_KONTRAST) {
    return label + ' (' + hex + '): Farbe ist nicht vom Seitenhintergrund unterscheidbar.';
  }
  var onCol = _onColor(hex);
  if (kontrast(onCol, hex) < MIN_TEXT_KONTRAST) {
    return label + ' (' + hex + '): Text auf dieser Fläche wäre nicht lesbar.';
  }
  return null; // OK
}

async function saveAllSettings() {
  var keys = [
    'verein_name','verein_kuerzel','app_untertitel',
    'farbe_primary','farbe_accent',
    'email_domain','noreply_email',
    'adressleiste_farbe',
    'veranstaltung_anzeige',
    'footer_datenschutz_url','footer_nutzung_url','footer_impressum_url',
    'github_repo','github_token','github_token_expires',
    'wartung_nachricht',
    'login_portal_url',
    'passkey_rp_id',
    'rr_scan_laender','rr_scan_begriffe','rr_scan_tage','rr_scan_budget',
  ];
  var payload = {};
  for (var i = 0; i < keys.length; i++) {
    var el = document.getElementById('cfg-' + keys[i]);
    if (el) payload[keys[i]] = el.value;
  }
  // Checkboxen separat (checked → '1', unchecked → '0')
  var cbKeys = ['version_nur_admins', 'wartung_aktiv', 'login_portal_aktiv', 'eigenes_veranst_prufen', 'eigenes_ergebnis_prufen', 'rr_scan_aktiv'];

  for (var j = 0; j < cbKeys.length; j++) {
    var cb = document.getElementById('cfg-' + cbKeys[j]);
    if (cb) payload[cbKeys[j]] = cb.checked ? '1' : '0';
  }

  // Login-Portal Apps aus den Zeilen sammeln
  var appRows = document.querySelectorAll('#portal-apps-list .portal-app-row');
  var portalApps = [];
  for (var k = 0; k < appRows.length; k++) {
    var nameEl = appRows[k].querySelector('[data-pa="name"]');
    var urlEl  = appRows[k].querySelector('[data-pa="url"]');
    var iconEl = appRows[k].querySelector('[data-pa="icon"]');
    var farbeEl= appRows[k].querySelector('[data-pa="farbe"]');
    var urlVal = (urlEl && urlEl.value.trim()) || '';
    if (!urlVal) continue;
    portalApps.push({
      name:  (nameEl && nameEl.value.trim()) || '',
      url:   urlVal,
      icon:  (iconEl && iconEl.value.trim()) || '📊',
      farbe: (farbeEl && farbeEl.value) || '#5b6cf8'
    });
  }
  payload['login_portal_apps'] = JSON.stringify(portalApps);

  // E-Mail-Domain: leer wenn Checkbox deaktiviert
  var emailDomainAktiv = document.getElementById('cfg-email_domain_aktiv');
  if (emailDomainAktiv && !emailDomainAktiv.checked) payload['email_domain'] = '';

  // Registrierung Auto-Freigabe (Radio)
  var autoFreigabe = document.querySelector('input[name="cfg-auto_freigabe"]:checked');
  if (autoFreigabe) payload['registrierung_auto_freigabe'] = autoFreigabe.value;

  // Farbvalidierung
  var farbFehler = [
    _validateFarbe(payload.farbe_primary, 'Hauptfarbe'),
    _validateFarbe(payload.farbe_accent,  'Akzentfarbe'),
  ].filter(Boolean);
  if (farbFehler.length) { notify(farbFehler.join('\n'), 'err'); return; }

  var r = await apiPost('einstellungen', payload);
  if (r && r.ok) {
    Object.assign(appConfig, payload);
    applyConfig(appConfig);
    buildFooter();
    notify('Einstellungen gespeichert.', 'ok');
  } else {
    notify((r && r.fehler) || 'Fehler beim Speichern', 'err');
  }
}

async function resetFarben() {
  var DEFAULT_PRIMARY = '#cc0000';
  var DEFAULT_ACCENT  = '#003087';
  var r = await apiPost('einstellungen', {
    farbe_primary: DEFAULT_PRIMARY,
    farbe_accent:  DEFAULT_ACCENT,
  });
  if (r && r.ok) {
    appConfig.farbe_primary = DEFAULT_PRIMARY;
    appConfig.farbe_accent  = DEFAULT_ACCENT;
    applyConfig(appConfig);
    // Color-Picker in der UI aktualisieren
    var pPicker = document.getElementById('cfg-farbe_primary-picker');
    var pText   = document.getElementById('cfg-farbe_primary');
    var aPicker = document.getElementById('cfg-farbe_accent-picker');
    var aText   = document.getElementById('cfg-farbe_accent');
    if (pPicker) pPicker.value = DEFAULT_PRIMARY;
    if (pText)   pText.value   = DEFAULT_PRIMARY;
    if (aPicker) aPicker.value = DEFAULT_ACCENT;
    if (aText)   aText.value   = DEFAULT_ACCENT;
    notify('Farben auf Standardwerte zurückgesetzt.', 'ok');
  } else {
    notify((r && r.fehler) || 'Fehler beim Zurücksetzen', 'err');
  }
}


// ══════════════════════════════════════════════════════════════════════════════
// ADMIN: MEISTERSCHAFTEN
// ══════════════════════════════════════════════════════════════════════════════
async function renderAdminMeisterschaften() {
  var el = document.getElementById('main-content');
  el.innerHTML = '<div class="loading"><div class="spinner"></div>Laden&hellip;</div>';

  var r = await apiGet('einstellungen');
  if (!r || !r.ok) { el.innerHTML = '<div class="panel" style="padding:24px;color:var(--accent)">Fehler beim Laden.</div>'; return; }
  mstrLoadFromConfig(r.data);

  function renderList() {
    var rows = '';
    for (var i = 0; i < MSTR_LIST.length; i++) {
      var m = MSTR_LIST[i];
      var isFirst = i === 0, isLast = i === MSTR_LIST.length - 1;
      rows +=
        '<div class="user-row" style="gap:8px" data-mstr-idx="' + i + '">' +
          '<div style="display:flex;flex-direction:column;gap:2px">' +
            '<button class="btn btn-ghost btn-sm" style="padding:2px 7px;font-size:11px" ' + (isFirst ? 'disabled' : '') + ' onclick="mstrMoveUp(' + i + ')">▲</button>' +
            '<button class="btn btn-ghost btn-sm" style="padding:2px 7px;font-size:11px" ' + (isLast  ? 'disabled' : '') + ' onclick="mstrMoveDown(' + i + ')">▼</button>' +
          '</div>' +
          '<span class="badge badge-ms" style="min-width:36px;text-align:center">' + m.label + '</span>' +
          '<div style="flex:1;font-size:13px;color:var(--text2)">ID: ' + m.id + '</div>' +
          '<button class="btn btn-ghost btn-sm" onclick="mstrEdit(' + i + ')">&#x270F;&#xFE0F;</button>' +
          '<button class="btn btn-danger btn-sm" onclick="mstrDelete(' + i + ')">&#x1F5D1;&#xFE0F;</button>' +
        '</div>';
    }
    return rows || '<div style="color:var(--text2);padding:12px">Keine Einträge.</div>';
  }

  function buildHtml() {
    return adminSubtabs() +
      '<div class="panel" style="max-width:560px">' +
        '<div class="panel-header">' +
          '<div class="panel-title">🏅 Meisterschaftsarten</div>' +
          '<button class="btn btn-primary btn-sm" onclick="mstrAdd()">+ Hinzufügen</button>' +
        '</div>' +
        '<div class="panel-body" id="mstr-list">' + renderList() + '</div>' +
      '</div>';
  }

  el.innerHTML = buildHtml();

  window._mstrRefresh = function() {
    var listEl = document.getElementById('mstr-list');
    if (listEl) listEl.innerHTML = renderList();
  };
}

function _mstrSave(cb) {
  apiPost('einstellungen', { meisterschaften_liste: JSON.stringify(MSTR_LIST) }).then(function(r) {
    if (r && r.ok) {
      mstrLoadFromConfig({ meisterschaften_liste: JSON.stringify(MSTR_LIST) });
      if (window._mstrRefresh) window._mstrRefresh();
      if (cb) cb();
    } else {
      notify('Fehler beim Speichern.', 'err');
    }
  });
}

function mstrMoveUp(idx) {
  if (idx < 1) return;
  var tmp = MSTR_LIST[idx - 1]; MSTR_LIST[idx - 1] = MSTR_LIST[idx]; MSTR_LIST[idx] = tmp;
  _mstrSave();
}
function mstrMoveDown(idx) {
  if (idx >= MSTR_LIST.length - 1) return;
  var tmp = MSTR_LIST[idx + 1]; MSTR_LIST[idx + 1] = MSTR_LIST[idx]; MSTR_LIST[idx] = tmp;
  _mstrSave();
}
async function mstrDelete(idx) {
  var m = MSTR_LIST[idx];
  if (!await confirmModal('\'' + m.label + '\' wirklich löschen?')) return;
  MSTR_LIST.splice(idx, 1);
  _mstrSave();
}
function mstrAdd() {
  showModal(
    '<h3 style="margin:0 0 16px;font-family:\'Barlow Condensed\',sans-serif;font-size:20px">Meisterschaft hinzufügen</h3>' +
    '<div class="form-group"><label>Bezeichnung</label>' +
      '<input type="text" id="mstr-new-label" placeholder="z.B. Kreismeisterschaft" style="width:100%" /></div>' +
    '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">' +
      '<button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button>' +
      '<button class="btn btn-primary" onclick="mstrAddSave()">Hinzufügen</button>' +
    '</div>'
  );
  setTimeout(function(){ var el=document.getElementById('mstr-new-label'); if(el) el.focus(); }, 80);
}
function mstrAddSave() {
  var lbl = (document.getElementById('mstr-new-label').value || '').trim();
  if (!lbl) { notify('Bitte eine Bezeichnung eingeben.', 'err'); return; }
  var maxId = 0;
  for (var i = 0; i < MSTR_LIST.length; i++) maxId = Math.max(maxId, parseInt(MSTR_LIST[i].id, 10) || 0);
  MSTR_LIST.push({ id: maxId + 1, label: lbl });
  _mstrSave(function() { closeModal(); });
}
function mstrEdit(idx) {
  var m = MSTR_LIST[idx];
  showModal(
    '<h3 style="margin:0 0 16px;font-family:\'Barlow Condensed\',sans-serif;font-size:20px">Meisterschaft bearbeiten</h3>' +
    '<div class="form-group"><label>Bezeichnung</label>' +
      '<input type="text" id="mstr-edit-label" value="' + m.label.replace(/"/g, '&quot;') + '" style="width:100%" /></div>' +
    '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">' +
      '<button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button>' +
      '<button class="btn btn-primary" onclick="mstrEditSave(' + idx + ')">Speichern</button>' +
    '</div>'
  );
  setTimeout(function(){ var el=document.getElementById('mstr-edit-label'); if(el) el.focus(); }, 80);
}
function mstrEditSave(idx) {
  var lbl = (document.getElementById('mstr-edit-label').value || '').trim();
  if (!lbl) { notify('Bitte eine Bezeichnung eingeben.', 'err'); return; }
  MSTR_LIST[idx].label = lbl;
  _mstrSave(function() { closeModal(); });
}

function _buildDiszKatListHtml(kategorien) {
  var sorted = kategorien.slice().sort(function(a,b){ return (b.disz_anzahl||0)-(a.disz_anzahl||0) || a.name.localeCompare(b.name); });
  var html = '';
  for (var i = 0; i < sorted.length; i++) {
    var k = sorted[i];
    var isSel = k.id == window._selKatId;
    html +=
      '<div class="user-row" style="gap:10px;cursor:pointer' + (isSel ? ';outline:2px solid var(--accent);border-radius:8px;background:var(--primary-faint,var(--surf2))' : '') + '" onclick="selectDiszKat(' + k.id + ')">' +
        '<div style="flex:1;font-weight:600;font-size:14px">' + k.name + '</div>' +
        '<span class="badge" style="background:var(--surf2);color:var(--text2);font-size:11px">' + k.fmt + '</span>' +
        '<span class="badge badge-aktiv">' + k.disz_anzahl + ' Disziplinen</span>' +
      '</div>';
  }
  return html;
}

function _buildDiszDetailHtml(kategorien, disziplinen) {
  var selKat = null;
  for (var _ki = 0; _ki < kategorien.length; _ki++) {
    if (kategorien[_ki].id == window._selKatId) { selKat = kategorien[_ki]; break; }
  }
  if (!selKat) {
    return '<div class="panel" style="display:flex;align-items:center;justify-content:center;min-height:220px;color:var(--text2)">' +
      '<div style="text-align:center"><div style="font-size:32px;margin-bottom:8px">&#x1F3F7;&#xFE0F;</div><div>Kategorie aus der Liste ausw&auml;hlen</div></div>' +
    '</div>';
  }
  var isEinst = window._diszDetailView === 'einstellungen';
  var viewToggle =
    '<div style="display:flex;gap:6px">' +
      '<button class="btn btn-sm ' + (!isEinst ? 'btn-primary' : 'btn-ghost') + '" onclick="window._diszDetailView=\'disziplinen\';_renderDiszDetail()">&#x1F504; Disziplinen</button>' +
      '<button class="btn btn-sm ' + (isEinst ? 'btn-primary' : 'btn-ghost') + '" onclick="window._diszDetailView=\'einstellungen\';_renderDiszDetail()">&#x2699;&#xFE0E; Einstellungen</button>' +
    '</div>';
  var panelBody;
  if (isEinst) {
    var _fmt = selKat.fmt || 'min';
    var _dir = selKat.sort_dir || 'ASC';
    var _canDel = selKat.disz_anzahl === 0 || selKat.disz_anzahl === '0';
    var _fmtOpts = [['min','Zeit (min)'],['min_h','Zeit (min) mit Hundertstel'],['s','Zeit (s)'],['m','Weite (m)']];
    var _fmtSel = '<select id="ik-fmt" style="width:100%">';
    _fmtOpts.forEach(function(o) { _fmtSel += '<option value="' + o[0] + '"' + (_fmt === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; });
    _fmtSel += '</select>';
    panelBody =
      '<div class="settings-panel-body">' +
        '<div class="form-grid">' +
          '<div class="form-group full"><label>Name</label><input type="text" id="ik-name" value="' + selKat.name.replace(/"/g,'&quot;') + '"/></div>' +
          '<div class="form-group"><label>Ergebnisformat</label>' + _fmtSel + '</div>' +
          '<div class="form-group"><label>Sortierung</label><select id="ik-dir" style="width:100%">' +
            '<option value="ASC"' + (_dir === 'ASC' ? ' selected' : '') + '>Aufsteigend (Zeit)</option>' +
            '<option value="DESC"' + (_dir === 'DESC' ? ' selected' : '') + '>Absteigend (Weite)</option>' +
          '</select></div>' +
        '</div>' +
        '<div style="display:flex;gap:8px;margin-top:8px">' +
          '<button class="btn btn-primary btn-sm" onclick="updateKatInline(' + selKat.id + ')">&#x1F4BE; Speichern</button>' +
          (_canDel ? '<button class="btn btn-danger btn-sm" data-kid="' + selKat.id + '" data-kname="' + selKat.name.replace(/"/g,'&quot;') + '" onclick="deleteKat(parseInt(this.dataset.kid),this.dataset.kname)">&#x1F5D1;&#xFE0E; L&ouml;schen</button>' : '') +
        '</div>' +
      '</div>';
  } else {
    var _sort = window._diszSort || { col: 'anz', dir: 'desc' };
    var filteredDisz = disziplinen.filter(function(d) { return d.kategorie_id == selKat.id; }).sort(function(a, b) {
      var av, bv;
      if (_sort.col === 'name')    { av = a.disziplin || '';                       bv = b.disziplin || ''; }
      else if (_sort.col === 'fmt')     { av = a.fmt_override || a.kat_fmt || '';  bv = b.fmt_override || b.kat_fmt || ''; }
      else if (_sort.col === 'distanz') { av = a.distanz != null ? a.distanz : -1; bv = b.distanz != null ? b.distanz : -1; }
      else                              { av = a.ergebnis_anzahl || 0;             bv = b.ergebnis_anzahl || 0; }
      var cmp = typeof av === 'string' ? av.localeCompare(bv, 'de') : (av - bv);
      return _sort.dir === 'asc' ? cmp : -cmp;
    });
    var mapRows = '';
    for (var i = 0; i < filteredDisz.length; i++) {
      var d = filteredDisz[i];
      var fmtValue = d.fmt_override || d.kat_fmt || selKat.fmt || '';
      var selHtml = '<select class="disz-map-sel" data-disz="' + d.disziplin.replace(/"/g,'&quot;') + '" data-mappingid="' + (d.id||'') + '" onchange="setDiszMapping(this)" style="font-size:12px;padding:4px 6px;border:1px solid var(--border);border-radius:6px;background:var(--surface)">';
      selHtml += '<option value="">– keine –</option>';
      for (var j = 0; j < kategorien.length; j++) {
        selHtml += '<option value="' + kategorien[j].id + '"' + (d.kategorie_id == kategorien[j].id ? ' selected' : '') + '>' + kategorien[j].name + '</option>';
      }
      selHtml += '</select>';
      var editBtn = '<button class="btn btn-ghost btn-sm" style="margin-left:6px" ' +
        'data-disz="' + d.disziplin.replace(/"/g,'&quot;') + '" ' +
        'data-fmt="' + (d.fmt_override||'').replace(/"/g,'&quot;') + '" ' +
        'data-katfmt="' + (d.kat_fmt||'').replace(/"/g,'&quot;') + '" ' +
        'data-mappingid="' + (d.id||'') + '" ' +
        'data-katsuffix="' + (d.kat_suffix_override||'') + '" ' +
        'data-hofexclude="' + (d.hof_exclude == 1 ? '1' : '0') + '" ' +
        'data-distanz="' + (d.distanz != null ? d.distanz : '') + '" ' +
        'onclick="showDiszEditModal(this)">&#x270F;&#xFE0E;</button>';
      var anz = d.ergebnis_anzahl || 0;
      var anzBadge = '<span class="badge" style="background:' + (anz > 0 ? 'var(--surf2);color:var(--text2)' : 'var(--green);color:#fff') + ';font-size:11px">' + anz + '</span>';
      var delBtn = anz === 0
        ? '<button class="btn btn-danger btn-sm" title="Disziplin l\u00f6schen" data-disz="' + d.disziplin.replace(/"/g,'&quot;') + '" onclick="deleteDisziplin(this.dataset.disz)">&#x1F5D1;&#xFE0F;</button>'
        : '<button class="btn btn-ghost btn-sm" disabled title="' + anz + ' Ergebnis(se) vorhanden">&#x1F512;</button>';
      var isFav = window._favList && window._favList.indexOf(d.id) >= 0;
      var starBtn = '<button class="btn btn-ghost btn-sm" title="Favorit (Bestleistungen)" data-fav-mid="' + d.id + '" onclick="toggleFavDisz(' + d.id + ')" style="color:' + (isFav ? 'var(--warning,#f59e0b)' : 'var(--text3,var(--text2))') + '">' + (isFav ? '&#x2605;' : '&#x2606;') + '</button>';
      var hofExcluded = d.hof_exclude == 1;
      var hofBtn = d.id
        ? '<button class="btn btn-ghost btn-sm" ' +
          'title="' + (hofExcluded ? 'In Hall of Fame einschließen' : 'Aus Hall of Fame ausschließen') + '" ' +
          'data-mapping-id="' + d.id + '" ' +
          'data-hofexclude="' + (hofExcluded ? '1' : '0') + '" ' +
          'onclick="toggleHofExclude(this)" ' +
          'style="' + (hofExcluded ? 'opacity:0.35;text-decoration:line-through' : 'color:var(--warning,#f59e0b)') + '">&#x1F3C6;</button>'
        : '';
      mapRows +=
        '<tr>' +
          '<td style="font-weight:600">' + (function(d) {
            var showSuffix;
            var override = d.kat_suffix_override || '';
            if (override === 'ja')   showSuffix = true;
            else if (override === 'nein') showSuffix = false;
            else showSuffix = (appConfig.disziplin_kategorie_suffix || '1') === '1';
            if (showSuffix && d.kategorie_name) {
              return d.disziplin + '&nbsp;<span style="font-size:0.85em;opacity:0.6;white-space:nowrap">(' + d.kategorie_name + ')</span>';
            }
            return d.disziplin;
          })(d) + '</td>' +
          '<td style="font-size:13px;color:var(--text2)">' + fmtValue + '</td>' +
          '<td style="font-size:13px;color:var(--text2);white-space:nowrap">' + (d.distanz != null ? (d.distanz % 1 === 0 ? d.distanz : d.distanz.toLocaleString('de-DE')) + ' m' : '<span style="opacity:0.4">–</span>') + '</td>' +
          '<td>' + selHtml + '</td>' +
          '<td style="text-align:right;padding-right:12px">' + anzBadge + '</td>' +
          '<td style="white-space:nowrap;display:flex;gap:4px">' + starBtn + hofBtn + editBtn + delBtn + '</td>' +
        '</tr>';
    }
    panelBody = filteredDisz.length
      ? (function() {
          var _s = window._diszSort || { col: 'anz', dir: 'desc' };
          function _th(col, label, align) {
            var active = _s.col === col;
            var arrow = active ? (_s.dir === 'asc' ? ' ↑' : ' ↓') : ' <span style="opacity:0.3">↕</span>';
            return '<th onclick="sortDiszTable(\'' + col + '\')" style="cursor:pointer;user-select:none' + (align ? ';text-align:' + align : '') + '">' + label + arrow + '</th>';
          }
          return '<div class="table-scroll"><table><thead><tr>' +
            _th('name', 'Disziplin') + _th('fmt', 'Format') + _th('distanz', 'Distanz') +
            '<th>Kategorie</th>' + _th('anz', 'Ergebnisse', 'right') + '<th></th>' +
          '</tr></thead><tbody>' + mapRows + '</tbody></table></div>';
        })()
      : '<div style="padding:20px;color:var(--text2);font-size:13px">Keine Disziplinen in dieser Kategorie.</div>';
    panelBody += '<div style="padding:12px 20px"><button class="btn btn-primary btn-sm" onclick="showNeueDiszModal(' + selKat.id + ')">+ Neue Disziplin</button></div>';
  }
  return '<div class="panel"><div class="panel-header"><div class="panel-title">' + selKat.name + '</div>' + viewToggle + '</div>' + panelBody + '</div>';
}

function sortDiszTable(col) {
  var cur = window._diszSort || { col: 'anz', dir: 'desc' };
  var numCols = { anz: true, distanz: true };
  window._diszSort = { col: col, dir: cur.col === col ? (cur.dir === 'asc' ? 'desc' : 'asc') : (numCols[col] ? 'desc' : 'asc') };
  _renderDiszDetail();
}

function _renderDiszDetail() {
  var el = document.getElementById('diszkat-detail-wrap');
  if (!el || !window._adminDiszKategorien) { renderAdminDisziplinen(); return; }
  el.innerHTML = _buildDiszDetailHtml(window._adminDiszKategorien, window._adminDiszMappings || []);
}

function selectDiszKat(id) {
  if (window._selKatId == id) {
    window._selKatId = null;
  } else {
    window._selKatId = id;
    window._diszDetailView = 'disziplinen';
  }
  var listEl = document.getElementById('diszkat-list-body');
  if (listEl && window._adminDiszKategorien) {
    listEl.innerHTML = _buildDiszKatListHtml(window._adminDiszKategorien);
  }
  _renderDiszDetail();
}

async function updateKatInline(id) {
  var r = await apiPut('kategorien/' + id, {
    name:     document.getElementById('ik-name').value.trim(),
    fmt:      document.getElementById('ik-fmt').value,
    sort_dir: document.getElementById('ik-dir').value,
  });
  if (r && r.ok) { REK_CATS = []; notify('Gespeichert.', 'ok'); await renderAdminDisziplinen(); }
  else notify((r && r.fehler) || 'Fehler', 'err');
}

async function deleteDisziplin(disz) {
  if (!await confirmModal('Disziplin \u201e' + disz + '\u201c wirklich l\u00f6schen?')) return;
  var r = await apiDel('disziplin-mapping/' + encodeURIComponent(disz));
  if (r && r.ok) {
    notify('Disziplin gel\u00f6scht.', 'ok');
    state.disziplinen = null;
    await loadDisziplinen();
    await renderAdminDisziplinen();
  } else {
    notify((r && r.fehler) ? r.fehler : 'Fehler beim L\u00f6schen.', 'err');
  }
}

async function saveDiszKatSuffix(checked) {
  var val = checked ? '1' : '0';
  var r = await apiPost('einstellungen', { disziplin_kategorie_suffix: val });
  if (r && r.ok) {
    appConfig.disziplin_kategorie_suffix = val;
    notify('Einstellung gespeichert.', 'ok');
  } else notify((r && r.fehler) || 'Fehler', 'err');
}

async function renderAdminDisziplinen() {
  var el = document.getElementById('main-content');
  el.innerHTML = '<div class="loading"><div class="spinner"></div>Laden&hellip;</div>';

  var rKat = await apiGet('kategorien');
  var rMap = await apiGet('disziplin-mapping');
  if (!rKat || !rKat.ok || !rMap || !rMap.ok) {
    var msg = (!rKat || !rKat.ok) ? ((rKat && rKat.fehler) || 'kategorien: unbekannter Fehler') : ((rMap && rMap.fehler) || 'disziplin-mapping: unbekannter Fehler');
    el.innerHTML = '<div class="panel" style="padding:24px;color:var(--accent)"><strong>Fehler beim Laden:</strong><br><code>' + msg + '</code></div>';
    return;
  }
  var kategorien = rKat.data;
  var disziplinen = rMap.data;
  window._adminDiszKategorien = kategorien;
  window._adminDiszMappings   = disziplinen;

  var subTabs = adminSubtabs();

  if (window._selKatId === undefined) window._selKatId = null;
  if (window._diszDetailView === undefined) window._diszDetailView = 'disziplinen';

  // Kategorie-Gruppen Panel aufbauen
  var _rEin = await apiGet('einstellungen');
  var _katGr = [];
  try { _katGr = JSON.parse((_rEin && _rEin.data && _rEin.data.kategoriegruppen) || '[]'); } catch(e) {}
  window._katGruppen = _katGr;
  var _katMap2 = {};
  for (var _ki = 0; _ki < kategorien.length; _ki++) _katMap2[kategorien[_ki].tbl_key] = kategorien[_ki].name;
  function _katGruppenRows() {
    if (!window._katGruppen.length) return '<div style="color:var(--text2);padding:12px 0;font-size:13px">Keine Gruppen definiert.</div>';
    return window._katGruppen.map(function(g, i) {
      var members = (g.mitglieder || []).map(function(k) { return _katMap2[k] || k; }).join(' + ');
      return '<div class="user-row" style="gap:8px">' +
        '<div style="flex:1;font-size:13px;font-weight:600">' + members + '</div>' +
        '<button class="btn btn-ghost btn-sm" onclick="katGruppeEdit(' + i + ')">&#x270F;&#xFE0E;</button>' +
        '<button class="btn btn-danger btn-sm" onclick="katGruppeDelete(' + i + ')">&#x1F5D1;&#xFE0F;</button>' +
      '</div>';
    }).join('');
  }
  window._katGruppenRefresh = function() {
    var el2 = document.getElementById('kat-gruppe-list');
    if (el2) el2.innerHTML = _katGruppenRows();
  };
  var katGruppenPanel =
    '<div class="panel">' +
      '<div class="panel-header">' +
        '<div class="panel-title">&#x1F517; Kategorie-Gruppen</div>' +
        '<button class="btn btn-primary btn-sm" onclick="katGruppeAdd()">+ Gruppe</button>' +
      '</div>' +
      '<div class="panel-body" id="kat-gruppe-list">' + _katGruppenRows() + '</div>' +
      '<div class="panel-body" style="border-top:1px solid var(--border);padding-top:10px;font-size:12px;color:var(--text2)">' +
        'Gruppen erlauben z.B. Sprung&amp;Wurf-Disziplinen beim Eintragen unter &bdquo;Bahn&ldquo; anzuzeigen. ' +
        'Der gespeicherte <code>tbl_key</code> bleibt unver&auml;ndert &mdash; Bestenlisten sind nicht betroffen.' +
      '</div>' +
    '</div>';

  // ── Panel: Wettkampfzählung "#km" (Einstellung zaehlung_pro_kategorie) ──
  // Frisch geladenen Wert in appConfig spiegeln, damit der Toggle darauf aufsetzt
  if (appConfig && _rEin && _rEin.data && _rEin.data.zaehlung_pro_kategorie !== undefined) {
    appConfig.zaehlung_pro_kategorie = _rEin.data.zaehlung_pro_kategorie;
  }
  var _zpkGewaehlt = {};
  try {
    JSON.parse((_rEin && _rEin.data && _rEin.data.zaehlung_pro_kategorie) || '[]')
      .forEach(function(k) { _zpkGewaehlt[String(k).toLowerCase()] = 1; });
  } catch (e) {}
  var zpkPanel =
    '<div class="panel">' +
      '<div class="panel-header"><div class="panel-title">&#x1F522; Wettkampfz&auml;hlung &bdquo;#km&ldquo;</div></div>' +
      '<div class="panel-body" style="display:flex;flex-wrap:wrap;gap:12px">' +
        kategorien.map(function(k) {
          return '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px">' +
            '<input type="checkbox"' + (_zpkGewaehlt[String(k.tbl_key).toLowerCase()] ? ' checked' : '') +
            ' onchange="toggleZaehlungProKategorie(\'' + String(k.tbl_key).replace(/'/g, "\\'") + '\', this.checked)"' +
            ' style="width:16px;height:16px;cursor:pointer">' + (k.name || k.tbl_key) + '</label>';
        }).join('') +
      '</div>' +
      '<div class="panel-body" style="border-top:1px solid var(--border);padding-top:10px;font-size:12px;color:var(--text2)">' +
        'In &bdquo;Meine Ergebnisse&ldquo; z&auml;hlt die Spalte <code>#km</code> normalerweise je Kategorie <em>und</em> Disziplin. ' +
        'F&uuml;r hier ausgew&auml;hlte Kategorien z&auml;hlt nur die Kategorie &ndash; sinnvoll, wenn die Strecken nicht vergleichbar sind (z.B. Cross, Firmenlauf, Trail).' +
      '</div>' +
    '</div>';

  el.innerHTML =
    subTabs +
    '<div class="admin-grid" style="grid-template-columns:340px 1fr">' +
      '<div class="panel">' +
        '<div class="panel-header"><div class="panel-title">&#x1F3F7;&#xFE0F; Kategorien</div>' +
          '<button class="btn btn-primary btn-sm" onclick="showNeueKatModal()">+ Neue Kategorie</button>' +
        '</div>' +
        '<div id="diszkat-list-body">' + _buildDiszKatListHtml(kategorien) + '</div>' +
      '</div>' +
      '<div id="diszkat-detail-wrap">' + _buildDiszDetailHtml(kategorien, disziplinen) + '</div>' +
    '</div>' +
    katGruppenPanel +
    zpkPanel;

  // Favoriten-Liste global verfügbar machen (für _buildDiszDetailHtml)
  var _favRaw = (appConfig && appConfig.top_disziplinen) || '';
  var _favListRaw = _favRaw ? (JSON.parse(_favRaw) || []) : [];
  window._favList = _favListRaw.filter(function(x){ return typeof x === 'number' || (typeof x === 'string' && /^\d+$/.test(x)); }).map(Number);
  // Detail re-rendern damit Stern-Buttons erscheinen
  _renderDiszDetail();
}

// Kategorie in die Liste "#km zaehlt nur je Kategorie" aufnehmen/entfernen
async function toggleZaehlungProKategorie(tblKey, an) {
  var liste = [];
  try { liste = JSON.parse((appConfig && appConfig.zaehlung_pro_kategorie) || '[]') || []; } catch (e) {}
  liste = liste.filter(function(k) { return String(k).toLowerCase() !== String(tblKey).toLowerCase(); });
  if (an) liste.push(tblKey);
  var r = await apiPost('einstellungen', { zaehlung_pro_kategorie: JSON.stringify(liste) });
  if (r && r.ok) {
    if (appConfig) appConfig.zaehlung_pro_kategorie = JSON.stringify(liste);
    notify('Gespeichert.', 'ok');
  } else {
    notify((r && r.fehler) || 'Fehler beim Speichern.', 'err');
    renderAdminDisziplinen(); // Anzeige auf den gespeicherten Stand zuruecksetzen
  }
}

async function toggleFavDisz(mid) {
  if (!window._favList) window._favList = [];
  var idx = window._favList.indexOf(mid);
  if (idx >= 0) window._favList.splice(idx, 1);
  else window._favList.push(mid);
  var r = await apiPost('einstellungen', { top_disziplinen: JSON.stringify(window._favList) });
  if (r && r.ok) {
    if (appConfig) appConfig.top_disziplinen = JSON.stringify(window._favList);
    state.topDisziplinen = {};
    var isFav = window._favList.indexOf(mid) >= 0;
    var btn = document.querySelector('[data-fav-mid="' + mid + '"]');
    if (btn) {
      btn.innerHTML = isFav ? '&#x2605;' : '&#x2606;';
      btn.style.color = isFav ? 'var(--warning,#f59e0b)' : 'var(--text3,var(--text2))';
    }
  } else {
    // Revert
    if (idx >= 0) window._favList.push(mid); else { var ri = window._favList.indexOf(mid); if (ri >= 0) window._favList.splice(ri, 1); }
    notify('Fehler beim Speichern.', 'err');
  }
}

async function setDiszMapping(sel) {
  var disz = sel.dataset.disz;
  var katId = sel.value;
  var mid = sel.dataset.mappingid ? parseInt(sel.dataset.mappingid) : null;
  if (!katId) {
    var r = await apiDel('disziplin-mapping/' + encodeURIComponent(disz));
    if (r && r.ok) notify('Zuordnung entfernt.', 'ok');
    else notify((r && r.fehler) || 'Fehler', 'err');
  } else {
    var r = await apiPost('disziplin-mapping', { disziplin: disz, kategorie_id: parseInt(katId), mapping_id: mid });
    if (r && r.ok) notify('Zugeordnet.', 'ok');
    else notify((r && r.fehler) || 'Fehler', 'err');
  }
}

function distanzAusName(name) {
  if (!name) return null;
  var s = name.trim();
  if (/halbmarathon|half.?marathon/i.test(s)) return 21097.5;
  if (/\bmarathon\b/i.test(s)) return 42195;
  // Tausendertrenner (Punkt vor genau 3 Ziffern) entfernen, dann Komma→Punkt
  function parseNum(str) { return parseFloat(str.replace(/\.(\d{3})(?!\d)/g, '$1').replace(',', '.')); }
  var mKm = s.match(/(\d[\d.,]*)\s*km/i);
  if (mKm) return Math.round(parseNum(mKm[1]) * 1000 * 10) / 10;
  var mM = s.match(/(\d[\d.,]*)\s*(?:m(?!\w)|meter\b)/i);
  if (mM) return parseNum(mM[1]);
  var mMi = s.match(/(\d[\d.,]*)\s*(?:mile|meile)/i);
  if (mMi) return Math.round(parseNum(mMi[1]) * 1609.344);
  return null;
}

async function toggleHofExclude(btn) {
  var mId = btn.dataset.mappingId;
  if (!mId) return;
  var newVal = btn.dataset.hofexclude === '1' ? 0 : 1;
  var r = await apiPut('disziplin-mapping/' + mId, { hof_exclude: newVal });
  if (!r || !r.ok) { notify((r && r.fehler) || 'Fehler', 'err'); return; }
  var disz = window._adminDiszMappings;
  if (disz) {
    for (var i = 0; i < disz.length; i++) {
      if (String(disz[i].id) === String(mId)) { disz[i].hof_exclude = newVal; break; }
    }
  }
  _renderDiszDetail();
}

function showNeueKatModal() {
  showModal(
    modalH2('&#x1F3F7;&#xFE0F; Neue Kategorie') +
    '<div class="form-grid">' +
      '<div class="form-group"><label>Name *</label><input type="text" id="nk-name" placeholder="z.B. Mehrkampf"/></div>' +
      '<div class="form-group"><label>Schlüssel * <span style="font-size:11px;color:var(--text2)">(a-z, 0-9, _)</span></label><input type="text" id="nk-key" placeholder="z.B. mehrkampf"/></div>' +
      '<div class="form-group"><label>Ergebnisformat</label><select id="nk-fmt"><option value="min">Zeit (min)</option><option value="min_h">Zeit (min) mit Hundertstel</option><option value="s">Zeit (s / Sekunden)</option><option value="m">Weite (m)</option></select></div>' +
      '<div class="form-group"><label>Sortierung</label><select id="nk-dir"><option value="ASC">Aufsteigend (Zeit)</option><option value="DESC">Absteigend (Weite)</option></select></div>' +
    '</div>' +
    '<div style="font-size:12px;color:var(--text2);margin-bottom:16px">&#x26A0;&#xFE0F; Der Schlüssel muss mit einer bestehenden Ergebnistabelle (<code>ergebnisse_[schlüssel]</code>) übereinstimmen oder eine neue Tabelle wird benötigt.</div>' +
    '<div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button><button class="btn btn-primary" onclick="createKat()">Erstellen</button></div>'
  );
}

async function createKat() {
  var r = await apiPost('kategorien', {
    name:        document.getElementById('nk-name').value.trim(),
    tbl_key:     document.getElementById('nk-key').value.trim(),
    fmt:         document.getElementById('nk-fmt').value,
    sort_dir:    document.getElementById('nk-dir').value,
  });
  if (r && r.ok) { closeModal(); REK_CATS = []; notify('Kategorie erstellt.', 'ok'); await renderAdminDisziplinen(); }
  else notify((r && r.fehler) || 'Fehler', 'err');
}

function showKatEditModal(btn) {
  var id   = btn.dataset.kid;
  var name = btn.dataset.kname;
  var fmt  = btn.dataset.kfmt;
  var dir  = btn.dataset.kdir;
  showModal(
    modalH2('&#x270F;&#xFE0F; Kategorie bearbeiten') +
    '<div class="form-grid">' +
      '<div class="form-group full"><label>Name *</label><input type="text" id="ek-name" value="' + name + '"/></div>' +
      '<div class="form-group"><label>Ergebnisformat</label><select id="ek-fmt">' +
        '<option value="min"' + (fmt==='min'?' selected':'') + '>Zeit (min)</option>' +
        '<option value="min_h"' + (fmt==='min_h'?' selected':'') + '>Zeit (min) mit Hundertstel</option>' +
        '<option value="s"' + (fmt==='s'?' selected':'') + '>Zeit (s)</option>' +
        '<option value="m"' + (fmt==='m'?' selected':'') + '>Weite (m)</option>' +
      '</select></div>' +
      '<div class="form-group"><label>Sortierung</label><select id="ek-dir">' +
        '<option value="ASC"' + (dir==='ASC'?' selected':'') + '>Aufsteigend</option>' +
        '<option value="DESC"' + (dir==='DESC'?' selected':'') + '>Absteigend</option>' +
      '</select></div>' +
    '</div>' +
    '<div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button><button class="btn btn-primary" onclick="updateKat(' + id + ')">Speichern</button></div>'
  );
}

async function updateKat(id) {
  var r = await apiPut('kategorien/' + id, {
    name:     document.getElementById('ek-name').value.trim(),
    fmt:      document.getElementById('ek-fmt').value,
    sort_dir: document.getElementById('ek-dir').value,
  });
  if (r && r.ok) { closeModal(); REK_CATS = []; notify('Gespeichert.', 'ok'); await renderAdminDisziplinen(); }
  else notify((r && r.fehler) || 'Fehler', 'err');
}

async function deleteKat(id, name) {
  if (!await confirmModal('Kategorie "' + name + '" wirklich löschen?')) return;
  var r = await apiDel('kategorien/' + id);
  if (r && r.ok) {
    REK_CATS = [];
    if (window._selKatId == id) window._selKatId = null;
    notify('Gelöscht.', 'ok');
    await renderAdminDisziplinen();
  } else notify((r && r.fehler) || 'Fehler', 'err');
}

function showDiszEditModal(btn) {
  var disz      = btn.dataset.disz;
  var fmt       = btn.dataset.fmt;
  var katfmt    = btn.dataset.katfmt;
  var mappingId  = btn.dataset.mappingid || '';
  var katSuffix  = btn.dataset.katsuffix || '';
  var hofExclude = btn.dataset.hofexclude === '1';
  var distanzVal = btn.dataset.distanz !== undefined && btn.dataset.distanz !== '' ? btn.dataset.distanz : '';
  var fmtOpts = [
    { v:'',      label:'Standard (Kategorie: ' + (katfmt||'–') + ')' },
    { v:'min',   label:'Zeit (min) – z.B. 45:30 min' },
    { v:'min_h', label:'Zeit (min) mit Hundertstel – z.B. 45:30,99 min' },
    { v:'s',     label:'Zeit (s) – z.B. 10,45s' },
    { v:'m',     label:'Weite (m) – z.B. 7.85m' },
  ];
  var fmtSel = '<select id="de-fmt" style="width:100%">';
  for (var i = 0; i < fmtOpts.length; i++) {
    fmtSel += '<option value="' + fmtOpts[i].v + '"' + (fmt === fmtOpts[i].v ? ' selected' : '') + '>' + fmtOpts[i].label + '</option>';
  }
  fmtSel += '</select>';
  var katSuffixGlobal = (appConfig.disziplin_kategorie_suffix || '1') === '1';
  var katSuffixSel =
    '<select id="de-katsuffix" style="width:100%">' +
      '<option value=""'     + (!katSuffix           ? ' selected' : '') + '>Global (' + (katSuffixGlobal ? 'an' : 'aus') + ')</option>' +
      '<option value="ja"'   + (katSuffix === 'ja'   ? ' selected' : '') + '>Immer anzeigen</option>' +
      '<option value="nein"' + (katSuffix === 'nein' ? ' selected' : '') + '>Nie anzeigen</option>' +
    '</select>';
  showModal(
    modalH2('&#x270F;&#xFE0E; Disziplin bearbeiten') +
    '<div style="color:var(--text2);font-size:13px;margin-bottom:16px">Original: <strong>' + disz + '</strong></div>' +
    '<div class="form-grid">' +
      '<div class="form-group full"><label>Umbenennen in</label>' +
        '<input type="text" id="de-name" value="' + disz.replace(/"/g,'&quot;') + '" placeholder="Neuer Name (leer = unverändert)"/>' +
        '<div style="font-size:11px;color:var(--text2);margin-top:4px">&#x26A0;&#xFE0E; Benennt die Disziplin in allen Ergebnistabellen um.</div>' +
      '</div>' +

      '<div class="form-group"><label>Ergebnisformat</label>' + fmtSel + '</div>' +
      '<div class="form-group"><label>Kategorie-Suffix</label>' + katSuffixSel + '</div>' +
      '<div class="form-group">' +
        '<label>Strecke (Meter, optional)</label>' +
        '<input type="number" id="de-distanz" value="' + distanzVal + '" placeholder="z.B. 800"/>' +
        '<div style="font-size:11px;color:var(--text2);margin-top:4px">Für Pace-Berechnung bei neuen Disziplinen</div>' +
      '</div>' +
      '<div class="form-group">' +
        '<label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:13px;padding-top:20px">' +
          '<input type="checkbox" id="de-hofexclude"' + (hofExclude ? ' checked' : '') + ' style="width:16px;height:16px;cursor:pointer">' +
          '<span>Aus <strong>Hall of Fame</strong> ausschließen</span>' +
        '</label>' +
        '<div style="font-size:11px;color:var(--text2);margin-top:4px">Blendet die Disziplin auch im Dashboard-Widget „Persönliche Bestleistungen“ aus</div>' +
      '</div>' +
    '</div>' +
    '<div class="modal-actions">' +
      '<button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button>' +
      '<button class="btn btn-primary" data-disz="' + disz.replace(/"/g,'&quot;') + '" data-mappingid="' + mappingId + '" onclick="updateDisz(this)">Speichern</button>' +
    '</div>'
  , false, true);
  setTimeout(function() {
    var distEl = document.getElementById('de-distanz');
    var nameEl = document.getElementById('de-name');
    var isField = katfmt === 'm';
    if (distEl && isField) {
      distEl.disabled = true;
      distEl.value = '';
      distEl.placeholder = 'Nicht relevant (Sprung/Wurf)';
    }
    if (nameEl && distEl && !isField) {
      if (!distEl.value.trim()) {
        var v = distanzAusName(nameEl.value);
        if (v !== null) distEl.value = v;
      }
      nameEl.addEventListener('input', function() {
        if (!distEl.value.trim()) {
          var v = distanzAusName(nameEl.value);
          if (v !== null) distEl.value = v;
        }
      });
    }
  }, 100);
}

async function updateDisz(btn) {
  var origDisz  = btn.dataset.disz;
  var neuerName = document.getElementById('de-name').value.trim();
  var fmt       = document.getElementById('de-fmt').value;
  var katSuffix = document.getElementById('de-katsuffix') ? document.getElementById('de-katsuffix').value : '';
  var hofExclude = document.getElementById('de-hofexclude') ? (document.getElementById('de-hofexclude').checked ? 1 : 0) : 0;
  var distanzEl = document.getElementById('de-distanz');
  var distanzBody = distanzEl && distanzEl.value.trim() !== '' ? parseFloat(distanzEl.value) : null;
  var body = { fmt_override: fmt, kat_suffix_override: katSuffix, hof_exclude: hofExclude, distanz: distanzBody };
  if (neuerName && neuerName !== origDisz) body.neuer_name = neuerName;
  var mId = btn.dataset.mappingid;
  var putPath = mId ? 'disziplin-mapping/' + mId : 'disziplin-mapping/' + encodeURIComponent(origDisz);
  var r = await apiPut(putPath, body);
  if (r && r.ok) {
    closeModal();
    notify('Gespeichert.', 'ok');
    state.allDisziplinen = {};
    state.topDisziplinen = {};
    // Scroll-Position merken und nach Re-Render wiederherstellen
    var scrollY = window.scrollY || document.documentElement.scrollTop || 0;
    await renderAdminDisziplinen();
    window.scrollTo(0, scrollY);
  } else notify((r && r.fehler) || 'Fehler', 'err');
}

// ── HELPERS ────────────────────────────────────────────────


async function showNeueDiszModal(preSelKatId, preName, onSaved) {
  // onSaved: optionaler Callback (mapping_id) – wird z.B. vom Bulk-Import genutzt,
  // um nachträglich angelegte Disziplinen direkt in die Importzeilen zu setzen
  window._ndOnSaved = (typeof onSaved === 'function') ? onSaved : null;
  // Kategorien frisch per API laden → liefert id, name, tbl_key
  var rKat = await apiGet('kategorien');
  var kats = (rKat && rKat.ok && rKat.data) ? rKat.data : [];

  var katSel = '<select id="nd-kat" style="width:100%" required>';
  katSel += '<option value="">– Kategorie wählen –</option>';
  kats.forEach(function(k) { katSel += '<option value="' + k.id + '"' + (preSelKatId && k.id == preSelKatId ? ' selected' : '') + '>' + k.name + '</option>'; });
  katSel += '</select>';

  var katSuffixGlobal = (appConfig.disziplin_kategorie_suffix || '1') === '1';
  var fmtSel =
    '<select id="nd-fmt" style="width:100%">' +
      '<option value="">Standard (aus Kategorie)</option>' +
      '<option value="min">Zeit (min) – z.B. 45:30 min</option>' +
      '<option value="min_h">Zeit (min) mit Hundertstel – z.B. 45:30,99 min</option>' +
      '<option value="s">Zeit (s) – z.B. 10,45s</option>' +
      '<option value="m">Weite (m) – z.B. 7.85m</option>' +
    '</select>';
  var katSuffixSel =
    '<select id="nd-katsuffix" style="width:100%">' +
      '<option value="">Global (' + (katSuffixGlobal ? 'an' : 'aus') + ')</option>' +
      '<option value="ja">Immer anzeigen</option>' +
      '<option value="nein">Nie anzeigen</option>' +
    '</select>';

  showModal(
    modalH2('&#x2795; Neue Disziplin') +
    '<div class="form-grid">' +
      '<div class="form-group full"><label>Disziplinname *</label>' +
        '<input type="text" id="nd-name" value="' + String(preName || '').replace(/"/g, '&quot;') + '" placeholder="z.B. Crosslauf, 3000m Hindernis \u2026" autofocus/>' +
      '</div>' +
      '<div class="form-group full"><label>Kategorie *</label>' + katSel + '</div>' +
      '<div class="form-group"><label>Ergebnisformat</label>' + fmtSel + '</div>' +
      '<div class="form-group"><label>Kategorie-Suffix</label>' + katSuffixSel + '</div>' +
      '<div class="form-group"><label>Distanz (Meter, optional)</label>' +
        '<input type="number" id="nd-distanz" placeholder="z.B. 800"/>' +
        '<div style="font-size:11px;color:var(--text2);margin-top:4px">Für Pace-Berechnung</div>' +
      '</div>' +
      '<div class="form-group">' +
        '<label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:13px;padding-top:20px">' +
          '<input type="checkbox" id="nd-hofexclude" checked style="width:16px;height:16px;cursor:pointer">' +
          '<span>Diese Disziplin aus der <strong>Hall of Fame</strong> ausschlie&szlig;en</span>' +
        '</label>' +
        '<div style="font-size:11px;color:var(--text2);margin-top:4px">Blendet die Disziplin auch im Dashboard-Widget &bdquo;Pers&ouml;nliche Bestleistungen&ldquo; aus</div>' +
      '</div>' +
    '</div>' +
    '<div class="modal-actions">' +
      '<button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button>' +
      '<button class="btn btn-ghost" onclick="saveNeueDisziplin(true)">&#x1F4BE; Anlegen &amp; Nächste</button>' +
      '<button class="btn btn-primary" onclick="saveNeueDisziplin()">&#x1F4BE; Anlegen</button>' +
    '</div>'
  , false, true);

  setTimeout(function() {
    var nameEl = document.getElementById('nd-name');
    var katEl  = document.getElementById('nd-kat');
    var distEl = document.getElementById('nd-distanz');
    function syncDistanzState() {
      if (!distEl || !katEl) return;
      var kats = window._adminDiszKategorien || [];
      var selId = katEl.value;
      var kat = null;
      for (var i = 0; i < kats.length; i++) { if (String(kats[i].id) === String(selId)) { kat = kats[i]; break; } }
      var isField = kat && kat.fmt === 'm';
      distEl.disabled = !!isField;
      distEl.placeholder = isField ? 'Nicht relevant (Sprung/Wurf)' : 'z.B. 800';
      if (isField) distEl.value = '';
    }
    function tryAutoFill() {
      if (!distEl || distEl.disabled || distEl.value.trim() !== '') return;
      var v = distanzAusName(nameEl ? nameEl.value : '');
      if (v !== null) distEl.value = v;
    }
    if (katEl) katEl.addEventListener('change', function() { syncDistanzState(); tryAutoFill(); });
    if (nameEl) nameEl.addEventListener('input', tryAutoFill);
    syncDistanzState();
    tryAutoFill();
    if (nameEl) nameEl.focus();
  }, 100);
}

async function saveNeueDisziplin(andNext) {
  var name      = (document.getElementById('nd-name')?.value || '').trim();
  var katId     = parseInt(document.getElementById('nd-kat')?.value || '') || 0;
  var fmt       = document.getElementById('nd-fmt')?.value || '';
  var katSuffix = document.getElementById('nd-katsuffix')?.value || '';
  var hofExclude = document.getElementById('nd-hofexclude')?.checked ? 1 : 0;

  if (!name)  { notify('Bitte Disziplinname eingeben.', 'err'); return; }
  if (!katId) { notify('Bitte Kategorie wählen.', 'err'); return; }

  var r = await apiPost('disziplin-mapping', {
    disziplin:          name,
    kategorie_id:       katId,
    fmt_override:       fmt,
    kat_suffix_override: katSuffix,
    hof_exclude:        hofExclude,
    distanz:            (function(){ var el=document.getElementById('nd-distanz'); return el&&el.value.trim()!==''?parseFloat(el.value):null; })(),
  });

  if (r && r.ok) {
    notify('Disziplin \u201e' + name + '\u201c angelegt.', 'ok');
    state.disziplinen = null;
    await loadDisziplinen();
    // Aufruf außerhalb des Admin-Bereichs (z.B. Bulk-Import): nur Callback, kein Re-Render
    var _cb = window._ndOnSaved;
    if (_cb) {
      window._ndOnSaved = null;
      closeModal();
      var _mid = (r.data && r.data.id) || null;
      if (!_mid) {
        var _neu = (state.disziplinen || []).find(function(d) { return (d.disziplin || '') === name; });
        _mid = _neu ? (_neu.id || _neu.mapping_id) : null;
      }
      _cb(_mid);
      return;
    }
    var scrollY = window.scrollY || document.documentElement.scrollTop || 0;
    await renderAdminDisziplinen();
    window.scrollTo(0, scrollY);
    if (andNext) {
      showNeueDiszModal(katId);
    } else {
      closeModal();
    }
  } else {
    notify((r && r.fehler) || 'Fehler beim Anlegen.', 'err');
  }
}

function _katGruppenSave(cb) {
  apiPost('einstellungen', { kategoriegruppen: JSON.stringify(window._katGruppen || []) }).then(function(r) {
    if (r && r.ok) {
      appConfig.kategoriegruppen = JSON.stringify(window._katGruppen || []);
      if (window._katGruppenRefresh) window._katGruppenRefresh();
      if (cb) cb();
    } else { notify('Fehler beim Speichern.', 'err'); }
  });
}

function _katGruppeModal(title, existing, onSave) {
  var katMap = {};
  (state.disziplinen || []).forEach(function(d) {
    if (d.tbl_key && d.kategorie) katMap[d.tbl_key] = d.kategorie;
  });
  var allKats = Object.keys(katMap);
  var checkboxes = allKats.map(function(k) {
    var checked = existing.indexOf(k) >= 0 ? ' checked' : '';
    return '<label style="display:flex;align-items:center;gap:8px;padding:6px 0;cursor:pointer">' +
      '<input type="checkbox" value="' + k + '"' + checked + ' style="width:15px;height:15px;accent-color:var(--btn-bg)">' +
      '<span>' + (katMap[k] || k) + ' <code style="font-size:11px;color:var(--text2)">(' + k + ')</code></span>' +
    '</label>';
  }).join('');

  showModal(
    '<h3 style="margin:0 0 16px;font-family:\'Barlow Condensed\',sans-serif;font-size:20px">' + title + '</h3>' +
    '<div style="margin-bottom:8px;font-size:13px;color:var(--text2)">Mindestens 2 Kategorien wählen:</div>' +
    '<div id="kat-gruppe-checks" style="border:1px solid var(--border);border-radius:8px;padding:8px 14px;margin-bottom:16px">' + checkboxes + '</div>' +
    '<div style="display:flex;gap:8px;justify-content:flex-end">' +
      '<button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button>' +
      '<button class="btn btn-primary" onclick="katGruppeModalSave()">Speichern</button>' +
    '</div>'
  );
  window._katGruppeModalCb = onSave;
}

function katGruppeModalSave() {
  var checked = Array.from(document.querySelectorAll('#kat-gruppe-checks input:checked')).map(function(cb) { return cb.value; });
  if (checked.length < 2) { notify('Bitte mindestens 2 Kategorien wählen.', 'err'); return; }
  closeModal();
  if (window._katGruppeModalCb) window._katGruppeModalCb(checked);
}

function katGruppeAdd() {
  _katGruppeModal('Neue Kategorie-Gruppe', [], function(mitglieder) {
    (window._katGruppen = window._katGruppen || []).push({ mitglieder: mitglieder });
    _katGruppenSave();
  });
}

function katGruppeEdit(idx) {
  var g = window._katGruppen[idx] || {};
  _katGruppeModal('Gruppe bearbeiten', g.mitglieder || [], function(mitglieder) {
    window._katGruppen[idx] = { mitglieder: mitglieder };
    _katGruppenSave();
  });
}

async function katGruppeDelete(idx) {
  var g = window._katGruppen[idx] || {};
  if (!await confirmModal('Gruppe "' + (g.mitglieder||[]).join(' + ') + '" wirklich löschen?')) return;
  window._katGruppen.splice(idx, 1);
  _katGruppenSave();
}

// ── Admin: Wartung (Container mit Sub-Tabs) ─────────────────────────────────
var _wartungTab = 'duplikate';
async function renderAdminWartung(subTab) {
  if (subTab) _wartungTab = subTab;
  if (_wartungTab === 'verwaist') { await renderAdminVerwaist(); return; }
  await renderAdminDuplikate();
}

function _wartungSubtabs() {
  return '<div style="display:flex;gap:8px;margin-bottom:20px">' +
    '<button class="btn' + (_wartungTab === 'duplikate' ? ' btn-primary' : ' btn-ghost') + '" onclick="renderAdminWartung(\'duplikate\')">⚠️ Duplikate</button>' +
    '<button class="btn' + (_wartungTab === 'verwaist'  ? ' btn-primary' : ' btn-ghost') + '" onclick="renderAdminWartung(\'verwaist\')">🏚️ Verwaiste Veranstaltungen</button>' +
  '</div>';
}

// ── Admin: Duplikate ──────────────────────────────────────────────────────
async function renderAdminDuplikate() {
  var el = document.getElementById('main-content');
  el.innerHTML = adminSubtabs() + _wartungSubtabs() + '<div class="loading"><div class="spinner"></div>Lade Duplikate&hellip;</div>';

  var r = await apiGet('admin/duplikate');
  if (!r || !r.ok) { el.innerHTML = adminSubtabs() + '<div style="color:var(--accent);padding:20px">Fehler: ' + (r&&r.fehler||'?') + '</div>'; return; }

  var dups = r.data || [];

  // kuerzel hat das Format "dd.mm.yyyy Ort" – der echte Name steht in v.name
  // (beim Anlegen faellt name auf kuerzel zurueck, dann bleibt nur der Ort uebrig)
  function fmtV(kuerzel) {
    return kuerzel ? (kuerzel.split(' ').slice(1).join(' ') || kuerzel) : '–';
  }
  function vName(d, n) {
    var name = d['veranst_name' + n] || '';
    var kuerzel = d['veranst' + n] || '';
    if (name && name !== kuerzel) return name;
    return fmtV(kuerzel);
  }
  function vOrt(d, n) {
    var ort = d['veranst_ort' + n] || '';
    // Ort nur als Zusatz, wenn er nicht schon im angezeigten Namen steckt
    return ort && vName(d, n).indexOf(ort) === -1 ? ort : '';
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  window._dupData = dups;
  var pairsHtml = '';
  if (!dups.length) {
    pairsHtml = '<div class="empty"><div class="empty-icon">✅</div><div class="empty-text">Keine Duplikate gefunden</div></div>';
  } else {
    dups.forEach(function(d, i) {
      var veranstName = vName(d, 1); // datum is identical (hard criterion)
      var dis1 = d.disziplin1 || d.disziplin || '';
      var dis2 = d.disziplin2 || d.disziplin || '';
      var kat1 = d.kategorie1 || '';
      var kat2 = d.kategorie2 || '';
      // Auch eine abweichende Kategorie ist ein Unterschied (andere disziplin_mapping_id)
      var disGleich = dis1 === dis2 && kat1 === kat2;
      // Abweichende Disziplinen hervorheben – sie sind der eigentliche Unterschied
      function disCell(txt, kat) {
        return '<td style="padding:6px 10px;font-size:12px' +
          (disGleich ? ';color:var(--text2)' : ';color:var(--accent);font-weight:700') + '">' +
          esc(txt || '–') +
          (kat ? '<div style="font-size:11px;font-weight:400;color:var(--text2)">' + esc(kat) + '</div>' : '') +
          '</td>';
      }
      function disMitKat(txt, kat) {
        return esc(txt || '–') + (kat ? ' (' + esc(kat) + ')' : '');
      }
      var rows =
        '<tr style="border-bottom:1px solid var(--border)">' +
          '<td style="padding:6px 10px;font-family:Barlow Condensed,sans-serif;font-size:15px;font-weight:700">' + (d.res1||'–') + '</td>' +
          disCell(dis1, kat1) +
          '<td style="padding:6px 10px">' + (d.ak1 ? '<span class="badge badge-ak">' + d.ak1 + '</span>' : '–') + '</td>' +
          '<td style="padding:6px 10px;font-size:12px">' +
            '<a href="#veranstaltung/' + d.vid1 + '" style="color:var(--primary)" onclick="navigate(\'veranstaltung/' + d.vid1 + '\')">' +
              (d.vid1 !== d.vid2 ? esc(vName(d, 1)) : esc(veranstName)) +
            '</a>' +
            (vOrt(d, 1) ? '<div style="font-size:11px;color:var(--text2)">' + esc(vOrt(d, 1)) + '</div>' : '') +
          '</td>' +
          '<td style="padding:6px 10px;font-size:12px;color:var(--text2)">' + (d.eingetragen_von1||'–') + '</td>' +
          '<td style="padding:6px 10px;white-space:nowrap">' +
            '<button class="btn btn-ghost btn-sm" title="Bearbeiten" onclick="dupEditErgebnis(' + i + ',1)">&#x270E;</button> ' +
            '<button class="btn btn-ghost btn-sm" title="In Papierkorb" onclick="dupDelete(' + d.id1 + ',this)">🗑️</button>' +
          '</td>' +
        '</tr>' +
        '<tr>' +
          '<td style="padding:6px 10px;font-family:Barlow Condensed,sans-serif;font-size:15px;font-weight:700">' + (d.res2||'–') + '</td>' +
          disCell(dis2, kat2) +
          '<td style="padding:6px 10px">' + (d.ak2 ? '<span class="badge badge-ak">' + d.ak2 + '</span>' : '–') + '</td>' +
          '<td style="padding:6px 10px;font-size:12px">' +
            '<a href="#veranstaltung/' + d.vid2 + '" style="color:var(--primary)" onclick="navigate(\'veranstaltung/' + d.vid2 + '\')">' +
              (d.vid1 !== d.vid2 ? esc(vName(d, 2)) : esc(veranstName)) +
            '</a>' +
            (vOrt(d, 2) ? '<div style="font-size:11px;color:var(--text2)">' + esc(vOrt(d, 2)) + '</div>' : '') +
          '</td>' +
          '<td style="padding:6px 10px;font-size:12px;color:var(--text2)">' + (d.eingetragen_von2||'–') + '</td>' +
          '<td style="padding:6px 10px;white-space:nowrap">' +
            '<button class="btn btn-ghost btn-sm" title="Bearbeiten" onclick="dupEditErgebnis(' + i + ',2)">&#x270E;</button> ' +
            '<button class="btn btn-ghost btn-sm" title="In Papierkorb" onclick="dupDelete(' + d.id2 + ',this)">🗑️</button>' +
          '</td>' +
        '</tr>';

      pairsHtml +=
        '<div class="panel" style="margin-bottom:12px;padding:0;overflow:hidden" id="dup-pair-' + i + '">' +
          '<div style="padding:10px 14px;background:var(--surf2);display:flex;align-items:center;gap:10px;flex-wrap:wrap">' +
            '<span style="font-weight:700">' + (d.athlet||'–') + '</span>' +
            (disGleich
              ? '<span style="color:var(--text2);font-size:13px">' + disMitKat(dis1, kat1) + '</span>'
              : '<span style="color:var(--accent);font-size:13px;font-weight:700">' + disMitKat(dis1, kat1) + ' / ' + disMitKat(dis2, kat2) + '</span>') +
            '<span style="font-size:12px;color:var(--text2)">📅 ' + formatDate(d.dat1) + '</span>' +
            (d.vid1 === d.vid2 ? '<span style="font-size:12px;color:var(--text2)">🏟 ' + esc(veranstName) + (vOrt(d, 1) ? ' · ' + esc(vOrt(d, 1)) : '') + '</span>' : '') +
            '<button class="btn btn-ghost btn-sm" style="margin-left:auto;font-size:12px" title="Als kein Duplikat markieren" onclick="dupIgnore(' + d.id1 + ',' + d.id2 + ',this)">✅ Kein Duplikat</button>' +
          '</div>' +
          '<table style="width:100%;border-collapse:collapse">' +
            '<thead><tr style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text2)">' +
              '<th style="padding:6px 10px;text-align:left">Ergebnis</th>' +
              '<th style="padding:6px 10px;text-align:left">Disziplin</th>' +
              '<th style="padding:6px 10px;text-align:left">AK</th>' +
              '<th style="padding:6px 10px;text-align:left">Veranstaltung</th>' +
              '<th style="padding:6px 10px;text-align:left">Eingetragen von</th>' +
              '<th style="padding:6px 10px;width:50px"></th>' +
            '</tr></thead>' +
            '<tbody>' + rows + '</tbody>' +
          '</table>' +
        '</div>';
    });
  }

  el.innerHTML = adminSubtabs() + _wartungSubtabs() +
    '<h2 style="margin-bottom:4px">⚠️ Duplikate</h2>' +
    '<p style="color:var(--text2);font-size:13px;margin-bottom:18px">' +
      'Ergebnisse desselben Athleten in derselben Disziplin am selben Datum mit ähnlichem Resultat (Toleranz &plusmn;2 s/m). ' +
      'AK und Platzierung sind kein Kriterium.' +
    '</p>' +
    (dups.length ? '<div style="margin-bottom:12px;display:flex;gap:10px;align-items:center">' +
      '<span style="color:var(--text2);font-size:13px">' + dups.length + ' Duplikat-Paar' + (dups.length===1?'':'e') + ' gefunden</span>' +
      '<button class="btn btn-ghost btn-sm" onclick="renderAdminDuplikate()">↻ Neu laden</button>' +
    '</div>' : '') +
    pairsHtml;
}

function dupEditErgebnis(idx, which) {
  var d = (window._dupData || [])[idx];
  if (!d) return;
  var n = String(which);
  openEditErgebnis(
    d['id'+n],
    d['tbl_key'+n] || 'ergebnisse',
    d['disziplin'+n] || d.disziplin,
    d['res'+n],
    d['ak'+n],
    d['akp'+n],
    d['mstr'+n],
    d['fmt'+n] || 'min',
    d['athlet_id'+n],
    d.athlet,
    d['mid'+n] || null,
    d['mstr_platz'+n]
  );
}

async function dupIgnore(id1, id2, btn) {
  if (btn) btn.disabled = true;
  var r = await apiPost('admin/duplikate/' + Math.min(id1,id2) + '-' + Math.max(id1,id2), {});
  if (r && r.ok) {
    notify('Als kein Duplikat markiert.', 'ok');
    var panel = btn ? btn.closest('.panel') : null;
    if (panel) { panel.style.opacity = '0.3'; panel.style.pointerEvents = 'none'; }
  } else {
    notify('Fehler: ' + (r&&r.fehler||'?'), 'err');
    if (btn) btn.disabled = false;
  }
}

async function dupDelete(id, btn) {
  if (btn) btn.disabled = true;
  var r = await apiDel('admin/duplikate/' + id);
  if (r && r.ok) {
    notify('In Papierkorb verschoben.', 'ok');
    var tr = btn ? btn.closest('tr') : null;
    if (tr) { tr.style.opacity = '0.35'; tr.style.pointerEvents = 'none'; }
  } else {
    notify('Fehler: ' + (r&&r.fehler||'?'), 'err');
    if (btn) btn.disabled = false;
  }
}

// ── Admin: Verwaiste Veranstaltungen ─────────────────────────────────────────
async function renderAdminVerwaist() {
  var el = document.getElementById('main-content');
  el.innerHTML = adminSubtabs() + _wartungSubtabs() + '<div class="loading"><div class="spinner"></div>Lade verwaiste Veranstaltungen&hellip;</div>';

  var r = await apiGet('admin/verwaist');
  if (!r || !r.ok) {
    el.innerHTML = adminSubtabs() + _wartungSubtabs() + '<div style="color:var(--accent);padding:20px">Fehler: ' + (r&&r.fehler||'?') + '</div>';
    return;
  }

  var rows = r.data || [];

  var tableHtml = '';
  if (!rows.length) {
    tableHtml = '<div class="empty"><div class="empty-icon">✅</div><div class="empty-text">Keine verwaisten Veranstaltungen gefunden</div></div>';
  } else {
    tableHtml =
      '<div style="margin-bottom:12px;display:flex;gap:10px;align-items:center">' +
        '<span style="color:var(--text2);font-size:13px">' + rows.length + ' verwaiste Veranstaltung' + (rows.length===1?'':'en') + ' gefunden</span>' +
        '<button class="btn btn-ghost btn-sm" onclick="renderAdminVerwaist()">↻ Neu laden</button>' +
      '</div>' +
      '<div class="table-scroll"><table style="width:100%;border-collapse:collapse">' +
        '<thead><tr style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text2)">' +
          '<th style="padding:6px 10px;text-align:left">Veranstaltung</th>' +
          '<th style="padding:6px 10px;text-align:left">Datum</th>' +
          '<th style="padding:6px 10px;text-align:left">Ort</th>' +
          '<th style="padding:6px 10px;text-align:left">Status</th>' +
          '<th style="padding:6px 10px;width:60px"></th>' +
        '</tr></thead><tbody>' +
      rows.map(function(v) {
        var name = v.name || (v.kuerzel||'').split(' ').slice(1).join(' ') || v.kuerzel || '–';
        var status = v.genehmigt == 1
          ? '<span style="color:#27ae60;font-size:12px">✓ Genehmigt</span>'
          : '<span style="color:var(--accent);font-size:12px">⏳ Ausstehend</span>';
        return '<tr style="border-bottom:1px solid var(--border)">' +
          '<td style="padding:8px 10px;font-weight:600">' +
            '<a href="#veranstaltung/' + v.id + '" style="color:var(--primary)" onclick="navigate(\'veranstaltung/' + v.id + '\')">' + name + '</a>' +
          '</td>' +
          '<td style="padding:8px 10px;color:var(--text2);font-size:13px">' + (v.datum ? formatDate(v.datum) : '–') + '</td>' +
          '<td style="padding:8px 10px;color:var(--text2);font-size:13px">' + (v.ort||'–') + '</td>' +
          '<td style="padding:8px 10px">' + status + '</td>' +
          '<td style="padding:8px 10px;text-align:right">' +
            '<button class="btn btn-ghost btn-sm" title="In Papierkorb" onclick="verwaistDelete(' + v.id + ',this)">🗑️</button>' +
          '</td>' +
        '</tr>';
      }).join('') +
      '</tbody></table></div>';
  }

  el.innerHTML = adminSubtabs() + _wartungSubtabs() +
    '<h2 style="margin-bottom:4px">🏚️ Verwaiste Veranstaltungen</h2>' +
    '<p style="color:var(--text2);font-size:13px;margin-bottom:18px">Veranstaltungen ohne Ergebnisse (intern und extern).</p>' +
    '<div class="panel" style="padding:20px 24px">' + tableHtml + '</div>';
}

async function verwaistDelete(id, btn) {
  if (btn) btn.disabled = true;
  var r = await apiDel('admin/verwaist/' + id);
  if (r && r.ok) {
    notify('In Papierkorb verschoben.', 'ok');
    var tr = btn ? btn.closest('tr') : null;
    if (tr) { tr.style.opacity = '0.35'; tr.style.pointerEvents = 'none'; }
  } else {
    notify('Fehler: ' + (r&&r.fehler||'?'), 'err');
    if (btn) btn.disabled = false;
  }
}

// ── ADMIN: VERANSTALTUNGEN ──────────────────────────────────────────────────
function _vaEsc(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function _vaDec(s) { if (!s) return ''; var t = document.createElement('textarea'); t.innerHTML = s; return t.value; }
function _vaWildcard(pattern) {
  // Wildcard-Pattern → RegExp: * = beliebig, ? = ein Zeichen
  var esc = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
  try { return new RegExp(esc, 'i'); } catch(e) { return null; }
}
var _veranstAdminCache  = { items: [] };
var _veranstAdminSort   = { col: 'datum', dir: -1 };
var _veranstAdminSel    = {};
var _veranstAdminFilter = { suche: '', jahr: '', genehmigt: '' };
var _veranstAdminPage   = 0;
var _veranstAdminPageSz = 50;

function _veranstAdminSortHeader() {
  var cols = [
    { key: 'check',         label: '<input type="checkbox" id="vaCheckAll" onchange="_vaToggleAll(this.checked)" style="cursor:pointer">', w: '3%' },
    { key: 'datum',         label: 'Datum',            w: '9%' },
    { key: 'name',          label: 'Name',             w: '42%' },
    { key: 'ort',           label: 'Ort',              w: '10%' },
    { key: 'serie',         label: '&#x1F504; Serie',  w: '11%' },
    { key: 'anz_ergebnisse',label: 'Erg.',             w: '6%' },
    { key: 'genehmigt',     label: 'Status',           w: '9%' },
    { key: '',              label: '',                  w: '10%' },
  ];
  return cols.map(function(c) {
    var wStyle = c.w ? 'width:' + c.w + ';' : '';
    if (c.key === 'check') return '<th style="' + wStyle + '">' + c.label + '</th>';
    if (!c.key) return '<th style="' + wStyle + '"></th>';
    var arrow = _veranstAdminSort.col === c.key ? (_veranstAdminSort.dir === 1 ? ' ▲' : ' ▼') : '';
    var style = wStyle + 'cursor:pointer;user-select:none;overflow:hidden;text-overflow:ellipsis' + (_veranstAdminSort.col === c.key ? ';color:var(--primary)' : '');
    return '<th style="' + style + '" onclick="_vaSetSort(\'' + c.key + '\')">' + c.label + arrow + '</th>';
  }).join('');
}

function _vaSetSort(col) {
  if (_veranstAdminSort.col === col) _veranstAdminSort.dir *= -1;
  else { _veranstAdminSort.col = col; _veranstAdminSort.dir = -1; }
  var thead = document.querySelector('#veranst-admin-tabelle thead tr');
  if (thead) thead.innerHTML = _veranstAdminSortHeader();
  _renderVeranstAdminTable();
}

function _vaToggleAll(checked) {
  var all = _vaGetFiltered();
  var col2 = _veranstAdminSort.col, dir2 = _veranstAdminSort.dir;
  all = all.slice().sort(function(a,b){
    var va,vb;
    if(col2==='datum'){va=a.datum||'';vb=b.datum||'';}
    else if(col2==='name'){va=(a.name||a.kuerzel||'').toLowerCase();vb=(b.name||b.kuerzel||'').toLowerCase();}
    else if(col2==='ort'){va=(a.ort||'').toLowerCase();vb=(b.ort||'').toLowerCase();}
    else if(col2==='serie'){va=(_veranstAdminCache.serieMap[a.serie_id]||{name:''}).name.toLowerCase();vb=(_veranstAdminCache.serieMap[b.serie_id]||{name:''}).name.toLowerCase();}
    else if(col2==='genehmigt'){va=parseInt(a.genehmigt)||0;vb=parseInt(b.genehmigt)||0;}
    else{va=a.datum||'';vb=b.datum||'';}
    if(va<vb)return -dir2; if(va>vb)return dir2; return 0;
  });
  var page = all.slice(_veranstAdminPage*_veranstAdminPageSz, (_veranstAdminPage+1)*_veranstAdminPageSz);
  if (!checked) { for (var i=0;i<page.length;i++) delete _veranstAdminSel[page[i].id]; }
  else          { for (var i=0;i<page.length;i++) _veranstAdminSel[page[i].id]=true; }
  _renderVeranstAdminTable();
}

function _vaToggle(id) {
  if (_veranstAdminSel[id]) delete _veranstAdminSel[id];
  else _veranstAdminSel[id] = true;
  _vaUpdateBulkBar();
  // Checkbox-State der Zeile + Select-all aktualisieren
  var chk = document.querySelector('#veranst-admin-tabelle tbody tr input[onchange*="' + id + '"]');
  if (chk) chk.checked = !!_veranstAdminSel[id];
  var allChk = document.getElementById('vaCheckAll');
  if (allChk) {
    var sel = Object.keys(_veranstAdminSel).length;
    var total = _vaGetFiltered().length;
    allChk.checked = sel > 0 && sel >= total;
    allChk.indeterminate = sel > 0 && sel < total;
  }
}

function _vaUpdateBulkBar() {
  var n = Object.keys(_veranstAdminSel).length;
  var bar = document.getElementById('va-bulk-bar');
  if (!bar) return;
  bar.style.display = n > 0 ? 'flex' : 'none';
  var countEl = document.getElementById('va-bulk-count');
  if (countEl) countEl.textContent = n + ' ausgewählt';
}

function _vaGetFiltered() {
  var items = _veranstAdminCache.items || [];
  var suche = (_veranstAdminFilter.suche || '').toLowerCase();
  var jahr  = _veranstAdminFilter.jahr ? parseInt(_veranstAdminFilter.jahr) : 0;
  var genF  = _veranstAdminFilter.genehmigt;
  var sucheRx = (suche && (suche.indexOf('*') >= 0 || suche.indexOf('?') >= 0)) ? _vaWildcard(suche) : null;
  return items.filter(function(v) {
    if (suche) {
      var s = ((v.name||'') + ' ' + (v.kuerzel||'') + ' ' + (v.ort||'')).toLowerCase();
      if (sucheRx ? !sucheRx.test(s) : s.indexOf(suche) < 0) return false;
    }
    if (jahr && (!v.datum || parseInt(v.datum.slice(0,4)) !== jahr)) return false;
    if (genF === '1' && !parseInt(v.genehmigt)) return false;
    if (genF === '0' &&  parseInt(v.genehmigt)) return false;
    return true;
  });
}

function _renderVeranstAdminTable() {
  var items = _vaGetFiltered();
  var col = _veranstAdminSort.col, dir = _veranstAdminSort.dir;
  items = items.slice().sort(function(a, b) {
    var va, vb;
    if (col === 'datum')          { va = a.datum||''; vb = b.datum||''; }
    else if (col === 'name')      { va = ((a.name||a.kuerzel||'')).toLowerCase(); vb = ((b.name||b.kuerzel||'')).toLowerCase(); }
    else if (col === 'ort')       { va = (a.ort||'').toLowerCase(); vb = (b.ort||'').toLowerCase(); }
    else if (col === 'anz_ergebnisse') { va = parseInt(a.anz_ergebnisse)||0; vb = parseInt(b.anz_ergebnisse)||0; }
    else if (col === 'serie')      { va = (_veranstAdminCache.serieMap[a.serie_id] || {name:''}).name.toLowerCase(); vb = (_veranstAdminCache.serieMap[b.serie_id] || {name:''}).name.toLowerCase(); }
    else if (col === 'genehmigt') { va = parseInt(a.genehmigt)||0; vb = parseInt(b.genehmigt)||0; }
    else                          { va = a.datum||''; vb = b.datum||''; }
    if (va < vb) return -dir;
    if (va > vb) return dir;
    return 0;
  });

  var totalItems = items.length;
  var totalPages = Math.max(1, Math.ceil(totalItems / _veranstAdminPageSz));
  if (_veranstAdminPage >= totalPages) _veranstAdminPage = totalPages - 1;
  var pageStart = _veranstAdminPage * _veranstAdminPageSz;
  var pageItems = items.slice(pageStart, pageStart + _veranstAdminPageSz);

  var rows = '';
  for (var i = 0; i < pageItems.length; i++) {
    var v = pageItems[i];
    var chk = _veranstAdminSel[v.id] ? ' checked' : '';
    var rowBg = _veranstAdminSel[v.id] ? ' style="background:var(--surf2)"' : '';
    var gBadge = parseInt(v.genehmigt)
      ? '<span class="badge badge-aktiv">Genehmigt</span>'
      : '<span class="badge badge-inaktiv">Gesperrt</span>';
    var datumStr = v.datum ? v.datum.slice(0,10) : '–';
    var _nameRaw = v.name || v.kuerzel || '';
    var _nameTitle = _vaDec(_nameRaw);
    var nameStr = _nameRaw ? _vaEsc(_vaDec(_nameRaw)) : '–';
    var serie = v.serie_id ? (_veranstAdminCache.serieMap[v.serie_id] || null) : null;
    var serieCell = serie ? '<span style="font-size:12px;color:var(--primary)">&#x1F504; ' + _vaEsc(_vaDec(serie.name)) + '</span>' : '<span style="color:var(--text2);font-size:12px">–</span>';
    var anzErg = parseInt(v.anz_ergebnisse)||0;
    var anzExt = parseInt(v.anz_extern)||0;
    var ergCell = '';
    if (anzErg) ergCell += '<span class="badge badge-platz" title="Interne Ergebnisse">' + anzErg + '</span>';
    if (anzExt) ergCell += ' <span class="badge" style="background:var(--surf2);color:var(--text2);border:1px solid var(--border)" title="Externe Ergebnisse">+' + anzExt + '</span>';
    if (!anzErg && !anzExt) ergCell = '<span style="color:var(--text2)">0</span>';
    rows +=
      '<tr' + rowBg + '>' +
        '<td style="width:32px;text-align:center"><input type="checkbox"' + chk + ' onchange="_vaToggle(' + v.id + ')" style="cursor:pointer"></td>' +
        '<td style="white-space:nowrap;font-size:13px">' + datumStr + '</td>' +
        '<td style="overflow:hidden;white-space:nowrap;text-overflow:ellipsis" title="' + _vaEsc(_nameTitle) + '">' + nameStr + '</td>' +
        '<td style="color:var(--text2);font-size:13px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">' + (v.ort ? _vaEsc(_vaDec(v.ort)) : '–') + '</td>' +
        '<td style="overflow:hidden;white-space:nowrap">' + serieCell + '</td>' +
        '<td style="text-align:center;white-space:nowrap">' + ergCell + '</td>' +
        '<td style="white-space:nowrap">' + gBadge + '</td>' +
        '<td style="white-space:nowrap;overflow:hidden;text-align:right">' +
          '<button class="btn btn-ghost btn-sm" onclick="_vaEditModal(' + v.id + ')" title="Bearbeiten">&#x270F;&#xFE0E;</button>' +
          '<button class="btn btn-danger btn-sm" onclick="_vaDelete(' + v.id + ',\'' + _vaDec(v.name||v.kuerzel||'?').replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/"/g,'&quot;') + '\')" title="Löschen">&#x1F5D1;&#xFE0F;</button>' +
        '</td>' +
      '</tr>';
  }

  var tbody = document.querySelector('#veranst-admin-tabelle tbody');
  if (tbody) tbody.innerHTML = rows || '<tr><td colspan="8" style="text-align:center;color:var(--text2);padding:20px">Keine Einträge</td></tr>';

  var countEl = document.getElementById('veranst-admin-count');
  if (countEl) countEl.textContent = totalItems + ' Veranstaltungen';

  // Paginierungs-Bar
  var pagBar = document.getElementById('va-page-bar');
  if (pagBar) {
    if (totalPages <= 1) {
      pagBar.innerHTML = '';
    } else {
      var from = pageStart + 1, to = Math.min(pageStart + _veranstAdminPageSz, totalItems);
      var pHtml = '<div style="display:flex;align-items:center;gap:8px;padding:8px 0;font-size:13px;color:var(--text2)">';
      pHtml += '<button class="btn btn-ghost btn-sm" onclick="_vaPage(-1)" ' + (_veranstAdminPage===0?'disabled':'') + '>&#x276E;</button>';
      pHtml += '<span>' + from + '–' + to + ' von ' + totalItems + '</span>';
      pHtml += '<button class="btn btn-ghost btn-sm" onclick="_vaPage(1)" ' + (_veranstAdminPage>=totalPages-1?'disabled':'') + '>&#x276F;</button>';
      pHtml += '<select onchange="_vaGoPage(this.value)" style="font-size:12px;padding:2px 4px">';
      for (var p = 0; p < totalPages; p++) {
        pHtml += '<option value="' + p + '"' + (p===_veranstAdminPage?' selected':'') + '>Seite ' + (p+1) + '</option>';
      }
      pHtml += '</select></div>';
      pagBar.innerHTML = pHtml;
    }
  }

  var allChk = document.getElementById('vaCheckAll');
  if (allChk) {
    var selN = 0;
    for (var pi = 0; pi < pageItems.length; pi++) { if (_veranstAdminSel[pageItems[pi].id]) selN++; }
    allChk.checked = selN > 0 && selN >= pageItems.length;
    allChk.indeterminate = selN > 0 && selN < pageItems.length;
  }
  _vaUpdateBulkBar();
}

async function renderAdminVeranstaltungen() {
  var el = document.getElementById('main-content');
  el.innerHTML = adminSubtabs() + '<div class="loading"><div class="spinner"></div>Laden…</div>';

  var [r, rs] = await Promise.all([apiGet('veranstaltungen?admin=1'), apiGet('veranstaltung-serien')]);
  if (!r || !r.ok) {
    el.innerHTML = adminSubtabs() + '<div style="color:var(--accent);padding:20px">Fehler beim Laden.</div>';
    return;
  }

  _veranstAdminCache.items = r.data || [];
  _veranstAdminCache.serien = (rs && rs.ok && rs.data) ? rs.data : [];
  _veranstAdminCache.serieMap = {};
  for (var si = 0; si < _veranstAdminCache.serien.length; si++) {
    var s = _veranstAdminCache.serien[si];
    _veranstAdminCache.serieMap[s.id] = s;
  }
  _veranstAdminSel = {};

  // Jahre für Filter
  var jahre = {};
  for (var i = 0; i < _veranstAdminCache.items.length; i++) {
    var d = _veranstAdminCache.items[i].datum;
    if (d) jahre[d.slice(0,4)] = true;
  }
  var jahrArr = Object.keys(jahre).sort().reverse();
  var jahrOpts = '<option value="">Alle Jahre</option>';
  for (var j = 0; j < jahrArr.length; j++) {
    jahrOpts += '<option value="' + jahrArr[j] + '"' + (_veranstAdminFilter.jahr === jahrArr[j] ? ' selected' : '') + '>' + jahrArr[j] + '</option>';
  }

  var html = adminSubtabs() +
    '<div class="filter-bar" style="margin-bottom:12px">' +
      '<div class="fg"><label>Suche</label>' +
        '<input type="text" id="va-suche" placeholder="Name, Ort…" value="' + _vaEsc(_veranstAdminFilter.suche||'') + '" oninput="_vaFilter(\'suche\',this.value)" style="min-width:0;width:100%"/>' +
      '</div>' +
      '<div class="fg" style="max-width:130px"><label>Jahr</label>' +
        '<select onchange="_vaFilter(\'jahr\',this.value)">' + jahrOpts + '</select>' +
      '</div>' +
      '<div class="fg" style="max-width:160px"><label>Status</label>' +
        '<select onchange="_vaFilter(\'genehmigt\',this.value)">' +
          '<option value=""'  + (!_veranstAdminFilter.genehmigt     ? ' selected' : '') + '>Alle</option>' +
          '<option value="1"' + (_veranstAdminFilter.genehmigt==='1' ? ' selected' : '') + '>Genehmigt</option>' +
          '<option value="0"' + (_veranstAdminFilter.genehmigt==='0' ? ' selected' : '') + '>Gesperrt</option>' +
        '</select>' +
      '</div>' +
    '</div>' +
    '<div id="va-bulk-bar" style="display:none;align-items:center;gap:10px;flex-wrap:wrap;background:var(--surf2);border:1px solid var(--primary);border-radius:8px;padding:10px 14px;margin-bottom:12px">' +
      '<span id="va-bulk-count" style="font-weight:600;font-size:13px"></span>' +
      '<button class="btn btn-sm btn-primary" onclick="bulkVeranst(\'genehmigen\')">&#x2713; Genehmigen</button>' +
      '<button class="btn btn-sm btn-ghost" onclick="bulkVeranst(\'sperren\')">&#x23FC; Sperren</button>' +
      '<button class="btn btn-sm btn-ghost" onclick="bulkVeranst(\'umbenennen\')">&#x270F; Name</button>' +
      '<button class="btn btn-sm btn-ghost" onclick="bulkVeranst(\'ort\')">&#x1F4CD; Ort</button>' +
      '<button class="btn btn-sm btn-ghost" onclick="bulkVeranst(\'serie\')">&#x1F504; Serie</button>' +
      '<button class="btn btn-sm btn-danger" onclick="bulkVeranst(\'loeschen\')">&#x1F5D1;&#xFE0F; Löschen</button>' +
    '</div>' +
    '<div class="panel">' +
      '<div class="panel-header">' +
        '<div class="panel-title">&#x1F4C5; Veranstaltungen</div>' +
        '<div class="panel-count" id="veranst-admin-count"></div>' +
        '<button class="btn btn-primary btn-sm" onclick="_vaNewModal()" style="margin-left:auto">+ Neue Veranstaltung</button>' +
      '</div>' +
      '<div class="table-scroll"><table id="veranst-admin-tabelle" class="data-table" style="width:100%;table-layout:fixed;border-collapse:collapse">' +
        '<thead><tr>' + _veranstAdminSortHeader() + '</tr></thead>' +
        '<tbody></tbody>' +
      '</table></div>' +
      '<div id="va-page-bar" style="padding:6px 16px"></div>' +
    '</div>';

  el.innerHTML = html;
  _renderVeranstAdminTable();
}

function _vaFilter(key, val) {
  _veranstAdminFilter[key] = val;
  _veranstAdminPage = 0;
  _veranstAdminSel = {};
  _renderVeranstAdminTable();
}
function _vaPage(dir) { _veranstAdminPage += dir; _renderVeranstAdminTable(); }
function _vaGoPage(p) { _veranstAdminPage = parseInt(p)||0; _renderVeranstAdminTable(); }

async function _vaEditModal(id) {
  var v = null;
  var items = _veranstAdminCache.items || [];
  for (var i = 0; i < items.length; i++) { if (items[i].id == id) { v = items[i]; break; } }
  if (!v) return;
  if (typeof ortePickerLoad === 'function') await ortePickerLoad();
  var curOrtId = v.ort_id || '';
  var pickerText = curOrtId
    ? (function(){ for (var i=0;i<(_orteCache||[]).length;i++){ var o=_orteCache[i]; if (o.id==curOrtId) return o.name + (o.land_code?' ('+o.land_code+')':''); } return _vaDec(v.ort||''); })()
    : _vaDec(v.ort || '');
  showModal(
    modalH2('&#x270F;&#xFE0F; Veranstaltung bearbeiten') +
    '<div class="form-grid">' +
      '<div class="form-group full"><label>Name</label><input type="text" id="ve-name" value="' + _vaEsc(_vaDec(v.name||'')) + '"/></div>' +
      '<div class="form-group"><label>Ort</label>' +
        ortePickerHtml({ inputId: 've-ort', hiddenId: 've-ort-id', ortId: curOrtId, text: pickerText }) +
      '</div>' +
      '<div class="form-group"><label>Datum</label><input type="date" id="ve-datum" value="' + (v.datum ? v.datum.slice(0,10) : '') + '"/></div>' +
      '<div class="form-group"><label>Status</label><select id="ve-genehmigt">' +
        '<option value="1"' + (parseInt(v.genehmigt) ? ' selected' : '') + '>Genehmigt</option>' +
        '<option value="0"' + (!parseInt(v.genehmigt) ? ' selected' : '') + '>Gesperrt</option>' +
      '</select></div>' +
    '</div>' +
    '<div class="modal-actions">' +
      '<button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button>' +
      '<button class="btn btn-primary" onclick="_vaSave(' + id + ')">Speichern</button>' +
    '</div>',
    false, true
  );
}

async function _vaSave(id) {
  var ortIdEl = document.getElementById('ve-ort-id');
  var ortInpEl = document.getElementById('ve-ort');
  var ortId = ortIdEl && ortIdEl.value ? parseInt(ortIdEl.value) : null;
  var ortFreitext = null;
  if (ortId) {
    for (var i = 0; i < (_orteCache || []).length; i++) {
      if (_orteCache[i].id == ortId) { ortFreitext = _orteCache[i].name; break; }
    }
  } else if (ortInpEl) {
    ortFreitext = ortInpEl.value.trim() || null;
  }
  var body = {
    name:      document.getElementById('ve-name').value.trim() || null,
    ort:       ortFreitext,
    ort_id:    ortId,
    datum:     document.getElementById('ve-datum').value || null,
    genehmigt: parseInt(document.getElementById('ve-genehmigt').value),
  };
  var r = await apiPut('veranstaltungen/' + id, body);
  if (r && r.ok) {
    closeModal();
    notify('Gespeichert.', 'ok');
    var items = _veranstAdminCache.items;
    for (var i = 0; i < items.length; i++) {
      if (items[i].id == id) {
        if (body.name  !== null) items[i].name  = body.name;
        if (body.ort   !== null) items[i].ort   = body.ort;
        items[i].ort_id = body.ort_id;
        if (body.datum !== null) items[i].datum = body.datum;
        items[i].genehmigt = body.genehmigt;
        break;
      }
    }
    _renderVeranstAdminTable();
  } else {
    notify((r && r.fehler) || 'Fehler', 'err');
  }
}

async function _vaNewModal() {
  if (typeof ortePickerLoad === 'function') await ortePickerLoad();
  var serieOpts = '<option value="">– keine –</option>';
  var serien = _veranstAdminCache.serien || [];
  for (var i = 0; i < serien.length; i++) {
    serieOpts += '<option value="' + serien[i].id + '">' + _vaEsc(_vaDec(serien[i].name || '')) + '</option>';
  }
  showModal(
    modalH2('&#x1F4C5; Neue Veranstaltung') +
    '<div class="form-grid">' +
      '<div class="form-group full"><label>Name</label><input type="text" id="ve-new-name" placeholder="Veranstaltungsname…"/></div>' +
      '<div class="form-group"><label>Ort <span style="color:var(--accent)">*</span></label>' +
        ortePickerHtml({ inputId: 've-new-ort', hiddenId: 've-new-ort-id' }) +
      '</div>' +
      '<div class="form-group"><label>Datum <span style="color:var(--accent)">*</span></label><input type="date" id="ve-new-datum"/></div>' +
      '<div class="form-group"><label>Status</label><select id="ve-new-genehmigt">' +
        '<option value="1">Genehmigt</option>' +
        '<option value="0">Gesperrt</option>' +
      '</select></div>' +
      '<div class="form-group"><label>Serie</label><select id="ve-new-serie">' + serieOpts + '</select></div>' +
    '</div>' +
    '<div class="modal-actions">' +
      '<button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button>' +
      '<button class="btn btn-primary" onclick="_vaCreate()">Erstellen</button>' +
    '</div>',
    false, true
  );
}

async function _vaCreate() {
  var ortIdEl  = document.getElementById('ve-new-ort-id');
  var ortId    = ortIdEl && ortIdEl.value ? parseInt(ortIdEl.value) : null;
  if (!ortId) { notify('Bitte einen Ort aus der Liste auswählen.', 'err'); return; }
  var ortName  = null;
  for (var i = 0; i < (_orteCache || []).length; i++) {
    if (_orteCache[i].id == ortId) { ortName = _orteCache[i].name; break; }
  }
  var datum = document.getElementById('ve-new-datum').value;
  if (!datum) { notify('Bitte ein Datum angeben.', 'err'); return; }
  var serieEl = document.getElementById('ve-new-serie');
  var body = {
    name:      document.getElementById('ve-new-name').value.trim() || null,
    ort:       ortName,
    ort_id:    ortId,
    datum:     datum,
    genehmigt: parseInt(document.getElementById('ve-new-genehmigt').value),
    serie_id:  serieEl && serieEl.value ? parseInt(serieEl.value) : null,
  };
  var r = await apiPost('veranstaltungen', body);
  if (r && r.ok) {
    closeModal();
    notify('Veranstaltung erstellt.', 'ok');
    var newItem = {
      id:             r.id,
      name:           body.name,
      ort:            body.ort,
      ort_id:         body.ort_id,
      datum:          body.datum,
      genehmigt:      body.genehmigt,
      serie_id:       body.serie_id,
      anz_ergebnisse: 0,
      anz_athleten:   0,
      anz_extern:     0,
    };
    _veranstAdminCache.items.unshift(newItem);
    _veranstAdminPage = 0;
    _renderVeranstAdminTable();
  } else {
    notify((r && r.fehler) || 'Fehler beim Erstellen.', 'err');
  }
}

async function _vaDelete(id, name) {
  if (!await confirmModal('Veranstaltung "' + name + '" in den Papierkorb verschieben?\n\nAlle zugehörigen Ergebnisse werden ebenfalls verschoben.')) return;
  var r = await apiDel('veranstaltungen/' + id);
  if (r && r.ok) {
    notify('Gelöscht.', 'ok');
    _veranstAdminCache.items = _veranstAdminCache.items.filter(function(v){ return v.id != id; });
    delete _veranstAdminSel[id];
    _renderVeranstAdminTable();
  } else {
    notify((r && r.fehler) || 'Fehler', 'err');
  }
}

async function bulkVeranst(action) {
  var ids = Object.keys(_veranstAdminSel).map(Number).filter(function(x){ return x > 0; });
  if (!ids.length) return;

  if (action === 'umbenennen' || action === 'ort') {
    var isOrt = action === 'ort';
    var fieldLabel = isOrt ? 'Ort' : 'Name';
    var numSection = isOrt ? '' :
      '<hr style="margin:14px 0;border:none;border-top:1px solid var(--border)">' +
      '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px">' +
        '<input type="checkbox" id="va-ren-num" onchange="var o=document.getElementById(\'va-ren-num-opts\');if(o)o.style.display=this.checked?\'block\':\'none\'">' +
        'Durchnumerieren (von alt nach neu)' +
      '</label>' +
      '<div id="va-ren-num-opts" style="display:none;margin-top:10px">' +
        '<div class="form-grid">' +
          '<div class="form-group" style="max-width:160px"><label>Startnummer</label><input type="number" id="va-ren-startnum" value="1" min="0"/></div>' +
        '</div>' +
        '<p style="font-size:12px;color:var(--text2);margin:4px 0 0">Sortierung: alt → neu. Beispiel: Startnummer 2 → \"2. Name\", \"3. Name\", …</p>' +
      '</div>';
    showModal(
      modalH2('&#x270F; ' + fieldLabel + ' bearbeiten (' + ids.length + ' Veranstaltung' + (ids.length > 1 ? 'en' : '') + ')') +
      '<p style="font-size:13px;color:var(--text2);margin:0 0 12px">Suchen &amp; Ersetzen im ' + fieldLabel + '. Wildcards: <code>*</code> = beliebig, <code>?</code> = ein Zeichen. Leer lassen = alle auf gleichen Wert setzen.</p>' +
      '<div class="form-grid">' +
        '<div class="form-group full"><label>Suchen (leer = gesamten ' + fieldLabel + ' ersetzen)</label><input type="text" id="va-ren-suche" placeholder="z.B. Stadt* oder leer lassen"/></div>' +
        '<div class="form-group full"><label>Ersetzen durch (leer = bestehenden Namen behalten)</label><input type="text" id="va-ren-ersatz" placeholder="' + (isOrt ? 'z.B. Essen' : 'z.B. Apfelblütenlauf') + '"/></div>' +
      '</div>' +
      numSection +
      '<div class="modal-actions">' +
        '<button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button>' +
        '<button class="btn btn-primary" onclick="_vaBulkRename(\'' + action + '\')">Übernehmen</button>' +
      '</div>'
    );
    return;
  }

  if (action === 'serie') {
    var serien = _veranstAdminCache.serien || [];
    var serieOpts = '<option value="0">— Keine Serie (entfernen)</option>';
    for (var si = 0; si < serien.length; si++) {
      serieOpts += '<option value="' + serien[si].id + '">' + _vaEsc(serien[si].name) + '</option>';
    }
    serieOpts += '<option value="neu">+ Neue Serie anlegen…</option>';
    showModal(
      modalH2('&#x1F504; Serie zuweisen (' + ids.length + ' Veranstaltung' + (ids.length > 1 ? 'en' : '') + ')') +
      '<div class="form-grid">' +
        '<div class="form-group full"><label>Serie</label>' +
          '<select id="va-serie-sel" onchange="var n=document.getElementById(\'va-serie-neu-wrap\');if(n)n.style.display=this.value===\'neu\'?\'block\':\'none\'">' + serieOpts + '</select>' +
        '</div>' +
        '<div class="form-group full" id="va-serie-neu-wrap" style="display:none"><label>Name der neuen Serie</label><input type="text" id="va-serie-neu-name" placeholder="z.B. Apfelblütenlauf"/></div>' +
      '</div>' +
      '<div class="modal-actions">' +
        '<button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button>' +
        '<button class="btn btn-primary" onclick="_vaBulkSerie()">Zuweisen</button>' +
      '</div>'
    );
    return;
  }

  if (action === 'loeschen') {
    if (!await confirmModal(ids.length + ' Veranstaltung(en) in den Papierkorb verschieben?')) return;
    var ok = 0;
    for (var i = 0; i < ids.length; i++) {
      var r = await apiDel('veranstaltungen/' + ids[i]);
      if (r && r.ok) ok++;
    }
    _veranstAdminCache.items = _veranstAdminCache.items.filter(function(v){ return !_veranstAdminSel[v.id]; });
    _veranstAdminSel = {};
    notify(ok + ' Veranstaltung(en) gelöscht.', ok ? 'ok' : 'err');
    _renderVeranstAdminTable();
    return;
  }

  var genehmigt = action === 'genehmigen' ? 1 : 0;
  var ok2 = 0;
  for (var i = 0; i < ids.length; i++) {
    var r2 = await apiPut('veranstaltungen/' + ids[i], { genehmigt: genehmigt });
    if (r2 && r2.ok) {
      ok2++;
      var items = _veranstAdminCache.items;
      for (var j = 0; j < items.length; j++) {
        if (items[j].id == ids[i]) { items[j].genehmigt = genehmigt; break; }
      }
    }
  }
  _veranstAdminSel = {};
  notify(ok2 + ' Veranstaltung(en) ' + (genehmigt ? 'genehmigt' : 'gesperrt') + '.', ok2 ? 'ok' : 'err');
  _renderVeranstAdminTable();
}

async function _vaBulkRename(action) {
  var suche    = (document.getElementById('va-ren-suche')    || {}).value || '';
  var ersatz   = (document.getElementById('va-ren-ersatz')   || {}).value || '';
  var numChk   = document.getElementById('va-ren-num');
  var doNum    = numChk && numChk.checked;
  var startNum = doNum ? (parseInt((document.getElementById('va-ren-startnum') || {}).value) || 1) : 0;
  var isOrt    = action === 'ort';
  var apiField = isOrt ? 'ort' : 'name';
  closeModal();
  var ids = Object.keys(_veranstAdminSel).map(Number).filter(function(x){ return x > 0; });

  // Bei Nummerierung: Items nach Datum aufsteigend (alt → neu) sortieren
  var items = [];
  var arr = _veranstAdminCache.items;
  for (var i = 0; i < ids.length; i++) {
    for (var j = 0; j < arr.length; j++) { if (arr[j].id == ids[i]) { items.push(arr[j]); break; } }
  }
  if (doNum) {
    items.sort(function(a, b) {
      var da = a.datum || '', db = b.datum || '';
      return da < db ? -1 : da > db ? 1 : 0;
    });
  }

  var ok = 0, err = 0;
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var altVal = item[apiField] != null ? String(item[apiField]) : '';
    var neuerVal;
    if (doNum) {
      // Basis: ersatz wenn angegeben, sonst bestehender Wert (nach suche/ersatz)
      var base;
      if (!suche) {
        base = ersatz !== '' ? ersatz : altVal;
      } else {
        var rx0 = (suche.indexOf('*') >= 0 || suche.indexOf('?') >= 0) ? _vaWildcard(suche) : null;
        base = rx0 ? altVal.replace(rx0, ersatz) : altVal.split(suche).join(ersatz);
      }
      neuerVal = (startNum + i) + '. ' + base;
    } else {
      if (!suche) {
        neuerVal = ersatz;
      } else {
        var rx = (suche.indexOf('*') >= 0 || suche.indexOf('?') >= 0) ? _vaWildcard(suche) : null;
        neuerVal = rx ? altVal.replace(rx, ersatz) : altVal.split(suche).join(ersatz);
      }
    }
    if (neuerVal === altVal) continue;
    var body = {};
    body[apiField] = neuerVal !== '' ? neuerVal : '';
    var r = await apiPut('veranstaltungen/' + item.id, body);
    if (r && r.ok) { item[apiField] = neuerVal || null; ok++; }
    else { err++; if (err === 1) notify((r && r.fehler) || 'API-Fehler bei ID ' + item.id, 'err'); }
  }
  _veranstAdminSel = {};
  if (ok > 0) notify(ok + ' Veranstaltung(en) aktualisiert.', 'ok');
  else if (!err) notify('Keine Änderungen (Werte bereits identisch).', 'err');
  _renderVeranstAdminTable();
}

async function _vaBulkSerie() {
  var sel = document.getElementById('va-serie-sel');
  var val = sel ? sel.value : '0';
  var serieId = null;

  if (val === 'neu') {
    var neuName = ((document.getElementById('va-serie-neu-name') || {}).value || '').trim();
    if (!neuName) { notify('Bitte einen Seriennamen eingeben.', 'err'); return; }
    closeModal();
    var cr = await apiPost('veranstaltung-serien', { name: neuName });
    if (!cr || !cr.ok) { notify((cr && cr.fehler) || 'Fehler beim Anlegen der Serie.', 'err'); return; }
    serieId = cr.data && cr.data.id ? cr.data.id : null;
    if (!serieId) { notify('Fehler: keine ID erhalten.', 'err'); return; }
    // In lokalen Cache aufnehmen
    var neuerS = { id: serieId, name: neuName, kuerzel: '' };
    _veranstAdminCache.serien.push(neuerS);
    _veranstAdminCache.serieMap[serieId] = neuerS;
  } else {
    serieId = val === '0' ? null : parseInt(val);
    closeModal();
  }

  var ids = Object.keys(_veranstAdminSel).map(Number).filter(function(x){ return x > 0; });
  var ok = 0, err = 0;
  for (var i = 0; i < ids.length; i++) {
    var r = await apiPut('veranstaltungen/' + ids[i], { serie_id: serieId });
    if (r && r.ok) {
      var arr = _veranstAdminCache.items;
      for (var j = 0; j < arr.length; j++) { if (arr[j].id == ids[i]) { arr[j].serie_id = serieId; break; } }
      ok++;
    } else {
      err++;
      if (err === 1) notify((r && r.fehler) || 'API-Fehler bei ID ' + ids[i], 'err');
    }
  }
  _veranstAdminSel = {};
  if (ok > 0) notify(ok + ' Veranstaltung(en) aktualisiert.', 'ok');
  _renderVeranstAdminTable();
}
