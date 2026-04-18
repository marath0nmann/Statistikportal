
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
    srow('Ergebnisse pro Tag', s.ergebnisseProTag || 0) +
    srow('Erstes Ergebnis', fmtDateOnly(s.erstesErgebnisDatum)) +
    srow('Anzahl Veranstaltungen', s.veranstaltungen || 0) +
    srow('Veranstaltungen pro Tag', s.veranstaltungenProTag || 0) +
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
        (l.methode ? ' <span style="font-size:10px;opacity:.7;margin-left:4px">' + {'password':'&#x1F511;','email':'&#x1F4E7;','passkey':'&#x1F5DD;\uFE0F'}[l.methode] + ' ' + l.methode + '</span>' : '') +
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
        '<div class="table-scroll"><table class="admin-login-table" style="width:100%;table-layout:fixed"><thead><tr>' + thStyle('Benutzer', ';width:28%') + thStyle('Status', ';width:22%') + thStyle('Land', ';width:14%') + thStyle('IP', ';width:16%') + thStyle('Zeitpunkt', ';width:20%') + '</tr></thead>' +
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
  // Admin-Nav-Button: kombinierter Badge (Registrierungen + Anträge)
  try {
    window._adminNavBadgeCount = (window._adminPendingAntraege || 0) + (window._adminPendingRegs || 0);
    // Admin-Nav-Button direkt aktualisieren (KEIN buildNav() - das erzeugt einen Loop)
    var _totalN = (window._adminPendingAntraege||0) + (window._adminPendingRegs||0);
    var _adminBtns = document.querySelectorAll('#main-nav button, #mobile-nav-items button');
    for (var _bi = 0; _bi < _adminBtns.length; _bi++) {
      var _btn = _adminBtns[_bi];
      if (_btn.getAttribute('onclick') && _btn.getAttribute('onclick').indexOf('admin') >= 0) {
        var _lbl = _btn.querySelector('.nav-label');
        if (_lbl) _lbl.innerHTML = 'Admin' + (_totalN > 0 ? ' <span style="background:var(--accent);color:#fff;border-radius:10px;padding:1px 5px;font-size:10px;font-weight:700;vertical-align:middle;line-height:1.4">' + _totalN + '</span>' : '');
      }
    }
  } catch(e) {}
  // Ausstehende Veranstaltungen: zum Antraege-Badge addieren
  try {
    var _rfr = await apiGet('veranstaltungen?pending=1');
    window._adminPendingFreigabe = (_rfr && _rfr.ok && _rfr.data.pending) ? _rfr.data.pending.length : 0;
  } catch(e) {}
}

function adminSubtabs() {
  var t = state.adminTab || 'system';
  return '<div class="subtabs" style="margin-bottom:20px">' +
    '<button class="subtab' + (t==='system'         ? ' active' : '') + '" onclick="navAdmin(\'system\')">&#x1F5A5;&#xFE0E; System</button>' +
    '<button class="subtab' + (t==='benutzer'       ? ' active' : '') + '" onclick="navAdmin(\'benutzer\')">&#x1F465; Benutzer</button>' +
    '<button class="subtab' + (t==='registrierungen'? ' active' : '') + '" onclick="navAdmin(\'registrierungen\')">📝 Registrierungen' + _adminBadge(window._adminPendingRegs||0) + '</button>' +
    '<button class="subtab' + (t==='disziplinen'    ? ' active' : '') + '" onclick="navAdmin(\'disziplinen\')">&#x1F3F7;&#xFE0F; Disziplinen</button>' +
    '<button class="subtab' + (t==='altersklassen'  ? ' active' : '') + '" onclick="navAdmin(\'altersklassen\')">&#x1F464; Altersklassen</button>' +
    '<button class="subtab' + (t==='meisterschaften'? ' active' : '') + '" onclick="navAdmin(\'meisterschaften\')">&#x1F3C5; Meisterschaften</button>' +
    '<button class="subtab' + (t==='darstellung'    ? ' active' : '') + '" onclick="navAdmin(\'darstellung\')">&#x1F3A8; Darstellung</button>' +
    '<button class="subtab' + (t==='dashboard_cfg'  ? ' active' : '') + '" onclick="navAdmin(\'dashboard_cfg\')">&#x1F4CA;&#xFE0E; Dashboard</button>' +
    '<button class="subtab' + (t==='antraege'       ? ' active' : '') + '" onclick="navAdmin(\'antraege\')">✋ Anträge' + _adminBadge((window._adminPendingAntraege||0)+(window._adminPendingFreigabe||0)) + '</button>' +
    '<button class="subtab' + (t==='wartung'        ? ' active' : '') + '" onclick="navAdmin(\'wartung\')">🔧 Wartung</button>' +
    '<button class="subtab' + (t==='papierkorb'     ? ' active' : '') + '" onclick="navAdmin(\'papierkorb\')">🗑️ Papierkorb' + _adminBadge(window._adminPendingPapierkorb||0) + '</button>' +
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
  if (state.adminTab === 'antraege')        { await renderAdminAntraege(); return; }
  if (state.adminTab === 'wartung')        { await renderAdminWartung(); return; }
  if (state.adminTab === 'papierkorb')     { await renderPapierkorb(); return; }
  if (state.adminTab === 'darstellung')    { renderAdminDarstellung(); return; }
  if (state.adminTab === 'dashboard_cfg')  { await renderAdminDashboard(); return; }
  if (state.adminTab === 'registrierungen'){ await renderAdminRegistrierungen(); return; }
  var r = await apiGet('benutzer');
  if (!r || !r.ok) return;
  var benutzer = r.data.benutzer || r.data; // Rückwärtskompatibel
  state._adminAthleten = r.data.athleten || [];

  state._adminBenutzerMap = {};
  // Server-seitiger Online-Status für alle User laden
  var _onlineUserIds = [];
  try {
    var _onR = await apiGet('auth/online-status');
    if (_onR && _onR.ok && _onR.data) _onlineUserIds = _onR.data.user_ids || [];
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
      (b.email_login_bevorzugt && !b.totp_aktiv && !(b.passkey_count > 0) ? '<span class="badge" style="background:#fff3e0;color:#e65100;border:1px solid #ffcc80;font-size:11px" title="Anmeldung per E-Mail-Code">&#x1F4E7; E-Mail</span>' : '');
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
      '<td style="padding:8px 8px;text-align:right">' +
        '<div style="display:flex;gap:4px;justify-content:flex-end">' +
          '<button class="btn btn-ghost btn-sm" onclick="showBenutzerEditModal(' + b.id + ')" title="Bearbeiten">\u270f\ufe0f</button>' +
          '<button class="btn btn-danger btn-sm" onclick="deleteBenutzer(' + b.id + ',\'' + b.email + '\')" title="L\xf6schen">\u2715</button>' +
        '</div>' +
      '</td>' +
    '</tr>';
  }

  document.getElementById('main-content').innerHTML =
    adminSubtabs() +
    '<div class="panel" style="margin-bottom:20px">' +
      '<div class="panel-header"><div class="panel-title">&#x1F465; Benutzerverwaltung</div><button class="btn btn-primary btn-sm" onclick="showNeuerBenutzerModal()">+ Neuer Benutzer</button></div>' +
      '<div class="table-scroll"><table style="width:100%;border-collapse:collapse;table-layout:fixed">' +
        '<colgroup><col style="width:44px"><col><col style="width:150px"><col style="width:100px"><col style="width:80px"><col style="width:160px"><col style="width:105px"><col style="width:78px"></colgroup>' +
        '<thead><tr style="border-bottom:2px solid var(--border)">' +
          '<th style="padding:8px 10px"></th>' +
          _bSortTh('Benutzer','name') +
          _bSortTh('Athlet','athlet') +
          _bSortTh('Rolle','rolle') +
          _bSortTh('Status','status') +
          '<th style="padding:8px 10px;text-align:left;font-size:12px;font-weight:600;color:var(--text2)">2FA</th>' +
          _bSortTh('Letzter Login','login') +
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
    '</div>';
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
    var sysRolle = (rolle.name === 'admin' || rolle.name === 'athlet' || rolle.name === 'leser' || rolle.name === 'nicht-eingeloggt');
    var lockIcon = sysRolle ? ' <span title="Systemrolle: Name änderbar, Rechte gesperrt" style="font-size:11px;opacity:.5">🔐</span>' : '';
    var labelDisp = (rolle.label && rolle.label !== rolle.name) ? rolle.label : '<span style="opacity:.4;font-style:italic">—</span>';
    var pubIcon = rolle.oeffentlich ? '<span title="Öffentlich sichtbar" style="font-size:11px;margin-left:4px">👁️</span>' : '<span title="Nicht öffentlich" style="font-size:11px;margin-left:4px;opacity:.4">🙈</span>';
    var actionHtml =
      '<button class="btn btn-ghost btn-sm" onclick="showRolleEditModal(' + rolle.id + ')" title="Bearbeiten">✏️</button>' +
      (!sysRolle ? '<button class="btn btn-danger btn-sm" onclick="deleteRolle(' + rolle.id + ',\'' + rolle.name + '\')" title="Löschen">✕</button>' : '');
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
  var isAdmin = (r.name === 'admin' || r.name === 'athlet' || r.name === 'leser'); // Systemrollen: Rechte gesperrt
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
    '<h2>' + titel + ' <button class="modal-close" onclick="closeModal()">&#x2715;</button></h2>' +
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
  if (!confirm('Rolle "' + name + '" wirklich löschen?')) return;
  var r = await apiDel('rollen/' + id);
  if (r && r.ok) { notify('Gelöscht.', 'ok'); _ladeRollenManager(); }
  else notify((r && r.fehler) || 'Fehler', 'err');
}

function showNeuerBenutzerModal() {
  showModal(
    '<h2>&#x1F464; Neuer Benutzer <button class="modal-close" onclick="closeModal()">&#x2715;</button></h2>' +
    '<div class="form-grid">' +
      '<div style="display:none"><input type="text" id="nb-user" value=""/></div>' +
      '<div class="form-group"><label>E-Mail *</label><input type="email" id="nb-email" placeholder="max@example.com"/></div>' +
      '<div class="form-group"><label>Passwort * (min. 8 Zeichen)</label><input type="password" id="nb-pw"/></div>' +
      '<div class="form-group"><label>Rolle</label><select id="nb-rolle"><option value="leser">Leser</option><option value="athlet">Athlet</option><option value="editor">Editor</option><option value="admin">Admin</option></select></div>' +
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
    '<h2>&#x270F;&#xFE0F; Benutzer bearbeiten <button class="modal-close" onclick="closeModal()">&#x2715;</button></h2>' +
    '<div style="color:var(--text2);margin-bottom:16px">' + b.email + '</div>' +
    '<div class="form-grid">' +
      '<div class="form-group"><label>E-Mail</label><input type="email" id="eb-email" value="' + b.email + '"/></div>' +
      '<div class="form-group"><label>Rolle</label><select id="eb-rolle"><option value="leser"' + (b.rolle==='leser'?' selected':'') + '>Leser</option><option value="athlet"' + (b.rolle==='athlet'?' selected':'') + '>Athlet</option><option value="editor"' + (b.rolle==='editor'?' selected':'') + '>Editor</option><option value="admin"' + (b.rolle==='admin'?' selected':'') + '>Admin</option></select></div>' +
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
    '<div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button><button class="btn btn-primary" onclick="updateBenutzer(' + b.id + ')">Speichern</button></div>'
  );
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
  if (!confirm('Benutzer "' + name + '" wirklich l\u00f6schen?')) return;
  var r = await apiDel('benutzer/' + id);
  if (r && r.ok) { notify('Gel\u00f6scht.', 'ok'); await renderAdmin(); }
  else notify((r && r.fehler) || '', 'err');
}

function showNeuerAthletModal() {
  showModal(
    '<h2>&#x1F464; Neuer Athlet <button class="modal-close" onclick="closeModal()">&#x2715;</button></h2>' +
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
    '<h2>&#x270F;&#xFE0F; Athlet bearbeiten <button class="modal-close" onclick="closeModal()">&#x2715;</button></h2>' +
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
      '<div class="form-group"><label>Status</label><select id="ea-aktiv">' +
        '<option value="1"' + (a.aktiv?' selected':'') + '>Aktiv</option>' +
        '<option value="0"' + (!a.aktiv?' selected':'') + '>Inaktiv</option>' +
      '</select></div>' +
    '</div>' +
    '<div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button><button class="btn btn-primary" onclick="saveAthlet(' + id + ')">Speichern</button></div>'
  , false, true);
}

async function saveAthlet(id) {
  var nn = document.getElementById('ea-nn').value.trim();
  var vn = document.getElementById('ea-vn').value.trim();
  if (!nn) { notify('Nachname erforderlich.', 'err'); return; }
  var grStr = document.getElementById('ea-gr').value;
  var gruppen = grStr.split(',').map(function(s) { return s.trim(); }).filter(function(s) { return s.length > 0; });
  var r = await apiPut('athleten/' + id, {
    nachname:    nn,
    vorname:     vn,
    name_nv:     nn + (vn ? ', ' + vn : ''),
    geschlecht:  document.getElementById('ea-g').value,
    geburtsjahr: document.getElementById('ea-gebj').value ? parseInt(document.getElementById('ea-gebj').value) : null,
    gruppen:     gruppen,
    aktiv:       parseInt(document.getElementById('ea-aktiv').value),
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

async function deleteAthlet(id, name) {
  if (!confirm('Athlet "' + name + '" in den Papierkorb verschieben?\n\nDer Athlet kann dort wiederhergestellt oder endg\u00fcltig gel\u00f6scht werden.')) return;
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
    '<h2>&#x1F3C6; Neuer Vereinsrekord <button class="modal-close" onclick="closeModal()">&#x2715;</button></h2>' +
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
            '<button class="btn btn-danger btn-sm" title="Endgültig löschen" onclick="pkDelete(\'' + typ + '\',' + it.id + ')">&#x2715;</button>' +
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
    ? 'Benutzerkonto endgültig löschen?\nDas Konto wird dauerhaft gelöscht und vom Athletenprofil getrennt.'
    : 'Eintrag endgültig löschen? Dies kann nicht rückgängig gemacht werden.';
  if (!confirm(msg)) return;
  var r = await api('DELETE', 'papierkorb/' + typ + '/' + id);
  if (r && r.ok) { notify('Endgültig gelöscht.', 'ok'); await renderPapierkorb(); }
  else notify((r && r.fehler) || 'Fehler', 'err');
}

function pkLeeren(total) {
  showModal(
    '<h2>Papierkorb leeren <button class="modal-close" onclick="closeModal()">&#x2715;</button></h2>' +
    '<div style="background:#fde8e8;border:1px solid #f5b0b0;border-radius:8px;padding:14px 16px;margin-bottom:20px;font-size:13px">' +
      '<strong>&#x26A0;&#xFE0F; Achtung:</strong> Alle <strong>' + total + ' Eintr\u00e4ge</strong> im Papierkorb werden unwiderruflich gel\u00f6scht.' +
    '</div>' +
    '<p style="font-size:13px;color:var(--text2);margin:0 0 20px">Dieser Vorgang kann nicht r\u00fcckg\u00e4ngig gemacht werden.</p>' +
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

async function renderAdminRegistrierungen() {
  var el = document.getElementById('main-content');
  el.innerHTML = adminSubtabs() + '<div class="loading"><div class="spinner"></div>Laden&hellip;</div>';

  // Athleten laden falls noch nicht vorhanden
  if (!state._adminAthleten || !state._adminAthleten.length) {
    var ra = await apiGet('athleten?limit=9999');
    if (ra && ra.ok) state._adminAthleten = ra.data.athleten || ra.data || [];
  }

  var r = await apiGet('auth/registrierungen');
  if (!r || !r.ok) { el.innerHTML += '<div style="color:var(--accent)">Fehler beim Laden.</div>'; return; }

  // API gibt {registrierungen: [], zugeordnete_athleten: []} zurück
  var _regData = Array.isArray(r.data) ? { registrierungen: r.data, zugeordnete_athleten: [] } : r.data;
  var regs = _regData.registrierungen || r.data || [];
  var _zugeordnet = _regData.zugeordnete_athleten || [];
  window._zugeordneteAthleten = _zugeordnet; // für _regCard zugänglich
  var pending = regs.filter(function(x) { return x.status === 'pending'; });
  var other   = regs.filter(function(x) { return x.status !== 'pending'; });

  var _emailDomain  = (appConfig && appConfig.email_domain)  || '';
  var _noreplyEmail = (appConfig && appConfig.noreply_email) || '';
  var _domainEnabled = !!_emailDomain;
  var emailSettingsHtml =
    '<div class="panel" style="margin-bottom:20px">' +
    '<div class="panel-header"><div class="panel-title">📧 E-Mail-Einstellungen</div></div>' +
    '<div class="settings-panel-body">' +
      '<div class="settings-row">' +
        '<div class="settings-row-label">' +
          '<div style="font-weight:600">Zugelassene E-Mail-Domain</div>' +
          '<div style="font-size:12px;color:var(--text2)">Nur Adressen mit dieser Domain dürfen sich registrieren</div>' +
        '</div>' +
        '<div class="settings-row-input" style="display:flex;align-items:center;gap:10px">' +
          '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;flex-shrink:0">' +
            '<input type="checkbox" id="cfg-email_domain_aktiv" ' + (_domainEnabled ? 'checked' : '') + ' style="width:16px;height:16px;cursor:pointer"' +
              ' onchange="document.getElementById(\'cfg-email_domain\').disabled=!this.checked">' +
            '<span style="font-size:12px;color:var(--text2)">Aktiv</span>' +
          '</label>' +
          '<input type="text" id="cfg-email_domain" value="' + _emailDomain.replace(/"/g,'&quot;') + '" placeholder="meinverein.de"' +
            ' class="settings-input"' + (_domainEnabled ? '' : ' disabled') + '/>' +
        '</div>' +
      '</div>' +
      '<div class="settings-row">' +
        '<div class="settings-row-label">' +
          '<div style="font-weight:600">Absender-E-Mail</div>' +
          '<div style="font-size:12px;color:var(--text2)">Von-Adresse f\u00fcr System-Mails</div>' +
        '</div>' +
        '<div class="settings-row-input">' +
          '<input type="text" id="cfg-noreply_email" value="' + _noreplyEmail.replace(/"/g,'&quot;') + '" placeholder="noreply@..." class="settings-input"/>' +
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
              '<input type="radio" name="cfg-auto_freigabe" id="cfg-auto_freigabe_0" value="0" ' + ((appConfig && appConfig.registrierung_auto_freigabe) || '0' !== '1' ? 'checked' : '') + ' style="cursor:pointer">' +
              '<span style="font-size:13px">🔐 Manuelle Bestätigung durch Admin (Standard)</span>' +
            '</label>' +
            '<label style="display:flex;align-items:center;gap:8px;cursor:pointer">' +
              '<input type="radio" name="cfg-auto_freigabe" id="cfg-auto_freigabe_1" value="1" ' + ((appConfig && appConfig.registrierung_auto_freigabe) || '0' === '1' ? 'checked' : '') + ' style="cursor:pointer">' +
              '<span style="font-size:13px">✅ Sofort aktiv nach E-Mail-Bestätigung</span>' +
            '</label>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div style="padding:0 16px 16px;display:flex;justify-content:flex-end">' +
        '<button class="btn btn-primary btn-sm" onclick="saveEmailSettings()">Speichern</button>' +
      '</div>' +
    '</div>' +
    '</div>';

  var html = '';

  if (!regs.length) {
    html += '<div class="empty"><div class="empty-icon">📝</div><div class="empty-text">Keine offenen Registrierungen</div></div>';
  } else {
    if (pending.length) {
      html += '<div class="panel" style="margin-bottom:20px">' +
        '<div class="panel-header"><div class="panel-title">⏳ Ausstehend (' + pending.length + ')</div></div>' +
        '<div style="padding:16px;display:flex;flex-direction:column;gap:10px">';
      for (var i = 0; i < pending.length; i++) {
        html += _regCard(pending[i], true);
      }
      html += '</div></div>';
    }
    if (other.length) {
      html += '<div class="panel">' +
        '<div class="panel-header"><div class="panel-title">✅ Bearbeitet (' + other.length + ')</div></div>' +
        '<div style="padding:16px;display:flex;flex-direction:column;gap:10px">';
      for (var i = 0; i < other.length; i++) {
        html += _regCard(other[i], false);
      }
      html += '</div></div>';
    }
  }
  el.innerHTML = adminSubtabs() + emailSettingsHtml + html;
}

async function saveEmailSettings() {
  var aktiv   = document.getElementById('cfg-email_domain_aktiv').checked;
  var domain  = aktiv ? (document.getElementById('cfg-email_domain').value || '').trim() : '';
  var noreply = (document.getElementById('cfg-noreply_email').value || '').trim();
  // POST einstellungen erwartet Keys direkt als Body: { email_domain: '...', noreply_email: '...' }
  var autoFreigabe = document.querySelector('input[name="cfg-auto_freigabe"]:checked');
  var freigabe = autoFreigabe ? autoFreigabe.value : '0';
  var r = await apiPost('einstellungen', { email_domain: domain, noreply_email: noreply, registrierung_auto_freigabe: freigabe });
  if (r && r.ok) {
    if (appConfig) { appConfig.email_domain = domain; appConfig.noreply_email = noreply; appConfig.registrierung_auto_freigabe = freigabe; }
    notify('E-Mail-Einstellungen gespeichert.', 'ok');
  } else { notify('\u274C ' + ((r&&r.fehler)||'Fehler beim Speichern.'), 'err'); }
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
          '</div>' : '') +
      '</div>' +
    '</div>' +
  '</div>';
}

async function regGenehmigen(regId) {
  var athEl = document.getElementById('reg-athlet-' + regId);
  var athletId = athEl ? (athEl.value || null) : null;
  var r = await apiPost('auth/registrierungen/' + regId + '/genehmigen', { athlet_id: athletId });
  if (r && r.ok) { notify('Registrierung genehmigt.', 'ok'); await renderAdminRegistrierungen(); }
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
  if (r && r.ok) { notify('Abgelehnt.', 'ok'); await renderAdminRegistrierungen(); }
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
  { id: 'gesamt',  label: 'Gesamtbestleistung',            desc: 'Beste Leistung aller Athleten in einer Disziplin (Gold)',      prio: 0 },
  { id: 'gender',  label: 'Bestleistung M / W',            desc: 'Beste Leistung je Geschlecht (Gold)',                          prio: 1 },
  { id: 'ak',      label: 'Bestleistung / Erste Leis. AK', desc: 'Beste oder erste Leistung je Altersklasse (Silber)',           prio: 2 },
  { id: 'pb',      label: 'PB / Debüt',                    desc: 'Persönliche Bestleistung oder erstes Ergebnis (Grün)',         prio: 3 },
];

function timelineLabelType(lbl) {
  if (!lbl) return null;
  if (lbl === 'Gesamtbestleistung' || lbl === 'Erste Gesamtleistung') return 'gesamt';
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
              ? '<button class="btn btn-ghost btn-sm" title="Spalte entfernen" onclick="dashRemoveCol(' + ri + ',' + ci + ')">✕</button>'
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
          '<button class="btn btn-danger btn-sm" onclick="dashRemoveRow(' + ri + ')">✕ Zeile</button>' +
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

    // ── Footer-Links ──
    '<div class="panel">' +
      '<div class="panel-header"><div class="panel-title">&#x1F4CB; Footer &amp; Rechtliches</div></div>' +
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
  ];
  var payload = {};
  for (var i = 0; i < keys.length; i++) {
    var el = document.getElementById('cfg-' + keys[i]);
    if (el) payload[keys[i]] = el.value;
  }
  // Checkboxen separat (checked → '1', unchecked → '0')
  var cbKeys = ['version_nur_admins', 'wartung_aktiv', 'login_portal_aktiv'];

  for (var j = 0; j < cbKeys.length; j++) {
    var cb = document.getElementById('cfg-' + cbKeys[j]);
    if (cb) payload[cbKeys[j]] = cb.checked ? '1' : '0';
  }

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
          '<button class="btn btn-danger btn-sm" onclick="mstrDelete(' + i + ')">&#x2715;</button>' +
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
function mstrDelete(idx) {
  var m = MSTR_LIST[idx];
  if (!confirm('\'' + m.label + '\' wirklich löschen?')) return;
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

async function deleteDisziplin(disz) {
  if (!confirm('Disziplin \u201e' + disz + '\u201c wirklich l\u00f6schen?')) return;
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

  // Sub-Tab-Leiste
  var subTabs = adminSubtabs();

  // Kategorien-Panel
  var katRows = '';
  for (var i = 0; i < kategorien.length; i++) {
    var k = kategorien[i];
    var canDel = k.disz_anzahl === 0 || k.disz_anzahl === '0';
    katRows +=
      '<div class="user-row" style="gap:10px">' +
        '<div style="flex:1;font-weight:600;font-size:14px">' + k.name + '</div>' +
        '<span class="badge" style="background:var(--surf2);color:var(--text2);font-size:11px">' + k.tbl_key + '</span>' +
        '<span class="badge" style="background:var(--surf2);color:var(--text2);font-size:11px">' + k.fmt + '</span>' +
        '<span class="badge badge-aktiv">' + k.disz_anzahl + ' Disziplinen</span>' +
        '<div style="display:flex;gap:6px">' +
          '<button class="btn btn-ghost btn-sm" data-kid="' + k.id + '" data-kname="' + k.name.replace(/"/g,'&quot;') + '" data-kfmt="' + k.fmt + '" data-kdir="' + k.sort_dir + '" onclick="showKatEditModal(this)">&#x270F;&#xFE0F;</button>' +
          (canDel ? '<button class="btn btn-danger btn-sm" data-kid="' + k.id + '" data-kname="' + k.name.replace(/"/g,'&quot;') + '" onclick="deleteKat(parseInt(this.dataset.kid),this.dataset.kname)">&#x2715;</button>' : '<button class="btn btn-ghost btn-sm" disabled title="Systemkategorie">&#x1F512;</button>') +
        '</div>' +
      '</div>';
  }

  // Mapping-Tabelle: Disziplinen gruppiert nach Quelle
  var katOptHtml = '';
  for (var i = 0; i < kategorien.length; i++) {
    katOptHtml += '<option value="' + kategorien[i].id + '">' + kategorien[i].name + '</option>';
  }

  var mapRows = '';
  for (var i = 0; i < disziplinen.length; i++) {
    var d = disziplinen[i];
    var fmtLabel = d.fmt_override ? '<span class="badge" style="background:var(--surf2);color:var(--btn-bg);font-size:11px">' + d.fmt_override + '</span>' : '';
    var selHtml = '<select class="disz-map-sel" data-disz="' + d.disziplin.replace(/"/g,'&quot;') + '" onchange="setDiszMapping(this)" style="font-size:12px;padding:4px 6px;border:1px solid var(--border);border-radius:6px;background:var(--surface)">';
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
      ? '<button class="btn btn-danger btn-sm" title="Disziplin l\u00f6schen" data-disz="' + d.disziplin.replace(/"/g,'&quot;') + '" onclick="deleteDisziplin(this.dataset.disz)">&#x2715;</button>'
      : '<button class="btn btn-ghost btn-sm" disabled title="' + anz + ' Ergebnis(se) vorhanden">&#x1F512;</button>';
    mapRows +=
      '<tr>' +
        '<td style="font-weight:600">' + (function() {
          // Kategorie-Suffix direkt aus d.kategorie_name lesen (nicht aus state.disziplinen)
          // Berücksichtigt per-Disziplin-Override und globale Einstellung
          var showSuffix;
          var override = d.kat_suffix_override || '';
          if (override === 'ja')   showSuffix = true;
          else if (override === 'nein') showSuffix = false;
          else showSuffix = (appConfig.disziplin_kategorie_suffix || '1') === '1';
          if (showSuffix && d.kategorie_name) {
            return d.disziplin + ' <span style="font-size:0.85em;opacity:0.6">(' + d.kategorie_name + ')</span>';
          }
          return d.disziplin;
        })() + '</td>' +
        '<td><span class="badge" style="background:var(--surf2);color:var(--text2);font-size:11px">' + (d.quelle_tbl || '') + '</span> ' + fmtLabel + '</td>' +
        '<td>' + selHtml + '</td>' +
        '<td style="text-align:right;padding-right:12px">' + anzBadge + '</td>' +
        '<td style="white-space:nowrap;display:flex;gap:4px">' + editBtn + delBtn + '</td>' +
      '</tr>';
  }

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
        '<button class="btn btn-danger btn-sm" onclick="katGruppeDelete(' + i + ')">&#x2715;</button>' +
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

  el.innerHTML =
    subTabs +
    '<div class="admin-grid">' +
      '<div class="panel">' +
        '<div class="panel-header"><div class="panel-title">&#x1F3F7;&#xFE0F; Kategorien</div>' +
          '<button class="btn btn-primary btn-sm" onclick="showNeueKatModal()">+ Neue Kategorie</button>' +
        '</div>' +
        katRows +
      '</div>' +
      '<div class="panel">' +
        '<div class="panel-header"><div class="panel-title">&#x1F4CB; Disziplin-Zuordnung</div>' +
          '<button class="btn btn-primary btn-sm" onclick="showNeueDiszModal()">+ Neue Disziplin</button>' +
        '</div>' +
        '<div style="font-size:12px;color:var(--text2);padding:0 20px 12px">Weise jeder Disziplin eine Kategorie zu. Die Zuordnung beeinflusst die Anzeige unter Ergebnisse &amp; Rekorde.</div>' +
        '<div class="table-scroll">' +
          '<table><thead><tr><th>Disziplin</th><th>Quelle / Format</th><th>Kategorie</th><th style="text-align:right">Ergebnisse</th><th></th></tr></thead>' +
          '<tbody>' + mapRows + '</tbody></table>' +
        '</div>' +
      '</div>' +
      katGruppenPanel +
    '</div>';

  // Favorisierte Disziplinen nachladen + Panel rendern
  var _allDisz = [];
  if (rMap && rMap.ok) {
    rMap.data.forEach(function(m) { if (m.disziplin && _allDisz.indexOf(m.disziplin) < 0) _allDisz.push(m.disziplin); });
    _allDisz.sort();
  }
  var _favRaw  = (appConfig && appConfig.top_disziplinen) || '';
  var _favListRaw = _favRaw ? (JSON.parse(_favRaw) || []) : [];
  // mapping_id-Array: Zahlen oder Strings normalisieren (Migration: alte Name-Arrays ignorieren)
  var _favList = _favListRaw.filter(function(x){ return typeof x === 'number' || (typeof x === 'string' && /^\d+$/.test(x)); }).map(Number);
  // Disziplinen nach Kategorie gruppieren (mit Ergebnis-Anzahl)
  var _katMap = {};   // kat -> [{disziplin, count}]
  var _katOrder = [];
  var _diszCount = {}; // disziplin -> count
  if (rMap && rMap.ok) {
    rMap.data.forEach(function(m) {
      var kat = m.kategorie || m.kategorie_name || m.kat_name || 'Sonstige';
      if (!_katMap[kat]) { _katMap[kat] = []; _katOrder.push(kat); }
      if (m.disziplin && m.id) { // nur gemappte Disziplinen (id = mapping_id)
        if (!_katMap[kat].find(function(x){ return x.mid === m.id; })) {
          _katMap[kat].push({ d: m.disziplin, mid: m.id, n: m.ergebnis_anzahl || 0 });
        }
      }
    });
    // Innerhalb jeder Kategorie nach Ergebnisanzahl absteigend sortieren
    _katOrder.forEach(function(kat) {
      _katMap[kat].sort(function(a, b) { return b.n - a.n || a.d.localeCompare(b.d); });
    });
  }
  var _favKatHtml = _katOrder.map(function(kat) {
    var disz = _katMap[kat];
    return '<div style="margin-bottom:14px">' +
      '<div style="font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">' + kat + '</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:6px">' +
      disz.map(function(item) {
        var d = item.d, mid = item.mid, n = item.n;
        var sel = _favList.indexOf(mid) >= 0 || _favList.indexOf(String(mid)) >= 0;
        var countBadge = '<span style="font-size:10px;background:var(--surf3,var(--surf2));color:var(--text2);border-radius:10px;padding:1px 5px;margin-left:2px;line-height:1.6">' + n + '</span>';
        return '<label style="display:inline-flex;align-items:center;gap:5px;background:var(--surf2);border-radius:6px;padding:4px 9px;cursor:pointer;font-size:13px;' + (sel ? 'outline:2px solid var(--accent);background:var(--primary-faint,var(--surf2));' : '') + '">' +
          '<input type="checkbox" data-fav-disz="' + mid + '" ' + (sel ? 'checked' : '') + ' style="width:13px;height:13px"> ' + d + countBadge + '</label>';
      }).join('') +
      '</div></div>';
  }).join('');
  var _favPanel = '<div class="panel" style="margin-top:16px">' +
    '<div class="panel-header"><div class="panel-title">⭐ Favorisierte Disziplinen (Bestleistungen)</div></div>' +
    '<div class="settings-panel-body">' +
      '<div style="font-size:13px;color:var(--text2);margin-bottom:16px">Diese Disziplinen erscheinen in Bestleistungen immer zuerst. Alle anderen werden dahinter sortiert.</div>' +
      _favKatHtml +
      '<button class="btn btn-primary btn-sm" style="margin-top:8px" onclick="saveFavDisziplinen()">&#x1F4BE; Favoriten speichern</button>' +
    '</div>' +
  '</div>';
  el.innerHTML += _favPanel;
}

async function saveFavDisziplinen() {
  var checked = Array.from(document.querySelectorAll('[data-fav-disz]:checked')).map(function(cb){ return parseInt(cb.dataset.favDisz, 10); }).filter(function(x){ return !isNaN(x); });
  var r = await apiPost('einstellungen', { top_disziplinen: JSON.stringify(checked) });
  if (r && r.ok) {
    if (appConfig) appConfig.top_disziplinen = JSON.stringify(checked);
    state.topDisziplinen = {}; // Cache leeren
    notify('Favoriten gespeichert.', 'ok');
  } else notify('Fehler beim Speichern.', 'err');
}

async function setDiszMapping(sel) {
  var disz = sel.dataset.disz;
  var katId = sel.value;
  if (!katId) {
    var r = await apiDel('disziplin-mapping/' + encodeURIComponent(disz));
    if (r && r.ok) notify('Zuordnung entfernt.', 'ok');
    else notify((r && r.fehler) || 'Fehler', 'err');
  } else {
    var r = await apiPost('disziplin-mapping', { disziplin: disz, kategorie_id: parseInt(katId) });
    if (r && r.ok) notify('Zugeordnet.', 'ok');
    else notify((r && r.fehler) || 'Fehler', 'err');
  }
}

function showNeueKatModal() {
  showModal(
    '<h2>&#x1F3F7;&#xFE0F; Neue Kategorie <button class="modal-close" onclick="closeModal()">&#x2715;</button></h2>' +
    '<div class="form-grid">' +
      '<div class="form-group"><label>Name *</label><input type="text" id="nk-name" placeholder="z.B. Mehrkampf"/></div>' +
      '<div class="form-group"><label>Schlüssel * <span style="font-size:11px;color:var(--text2)">(a-z, 0-9, _)</span></label><input type="text" id="nk-key" placeholder="z.B. mehrkampf"/></div>' +
      '<div class="form-group"><label>Ergebnisformat</label><select id="nk-fmt"><option value="min">Zeit (min)</option><option value="min_h">Zeit (min) mit Hundertstel</option><option value="s">Zeit (s / Sekunden)</option><option value="m">Weite (m)</option></select></div>' +
      '<div class="form-group"><label>Sortierung</label><select id="nk-dir"><option value="ASC">Aufsteigend (Zeit)</option><option value="DESC">Absteigend (Weite)</option></select></div>' +
      '<div class="form-group"><label>Reihenfolge</label><input type="number" id="nk-ord" value="99" min="1"/></div>' +
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
    reihenfolge: parseInt(document.getElementById('nk-ord').value),
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
    '<h2>&#x270F;&#xFE0F; Kategorie bearbeiten <button class="modal-close" onclick="closeModal()">&#x2715;</button></h2>' +
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
  if (!confirm('Kategorie "' + name + '" wirklich löschen?')) return;
  var r = await apiDel('kategorien/' + id);
  if (r && r.ok) { REK_CATS = []; notify('Gelöscht.', 'ok'); await renderAdminDisziplinen(); }
  else notify((r && r.fehler) || 'Fehler', 'err');
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
    '<h2>&#x270F;&#xFE0E; Disziplin bearbeiten <button class="modal-close" onclick="closeModal()">&#x2715;</button></h2>' +
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
      '</div>' +
    '</div>' +
    '<div class="modal-actions">' +
      '<button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button>' +
      '<button class="btn btn-primary" data-disz="' + disz.replace(/"/g,'&quot;') + '" data-mappingid="' + mappingId + '" onclick="updateDisz(this)">Speichern</button>' +
    '</div>'
  , false, true);
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


async function showNeueDiszModal() {
  // Kategorien frisch per API laden → liefert id, name, tbl_key
  var rKat = await apiGet('kategorien');
  var kats = (rKat && rKat.ok && rKat.data) ? rKat.data : [];

  var katSel = '<select id="nd-kat" style="width:100%" required>';
  katSel += '<option value="">– Kategorie wählen –</option>';
  kats.forEach(function(k) { katSel += '<option value="' + k.id + '">' + k.name + '</option>'; });
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
    '<h2>&#x2795; Neue Disziplin <button class="modal-close" onclick="closeModal()">&#x2715;</button></h2>' +
    '<div class="form-grid">' +
      '<div class="form-group full"><label>Disziplinname *</label>' +
        '<input type="text" id="nd-name" placeholder="z.B. Crosslauf, 3000m Hindernis \u2026" autofocus/>' +
      '</div>' +
      '<div class="form-group full"><label>Kategorie *</label>' + katSel + '</div>' +
      '<div class="form-group"><label>Ergebnisformat</label>' + fmtSel + '</div>' +
      '<div class="form-group"><label>Kategorie-Suffix</label>' + katSuffixSel + '</div>' +
      '<div class="form-group full">' +
        '<label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:13px">' +
          '<input type="checkbox" id="nd-hofexclude" style="width:16px;height:16px;cursor:pointer">' +
          '<span>Diese Disziplin aus der <strong>Hall of Fame</strong> ausschlie&szlig;en</span>' +
        '</label>' +
      '</div>' +
    '</div>' +
    '<div class="modal-actions">' +
      '<button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button>' +
      '<button class="btn btn-primary" onclick="saveNeueDisziplin()">&#x1F4BE; Anlegen</button>' +
    '</div>'
  , false, true);

  setTimeout(function() {
    var el = document.getElementById('nd-name');
    if (el) el.focus();
  }, 100);
}

async function saveNeueDisziplin() {
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
    distanz:            (function(){ var el=document.getElementById('ad-distanz'); return el&&el.value.trim()!==''?parseFloat(el.value):null; })(),
  });

  if (r && r.ok) {
    closeModal();
    notify('Disziplin \u201e' + name + '\u201c angelegt.', 'ok');
    state.disziplinen = null;
    await loadDisziplinen();
    var scrollY = window.scrollY || document.documentElement.scrollTop || 0;
    await renderAdminDisziplinen();
    window.scrollTo(0, scrollY);
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

function katGruppeDelete(idx) {
  var g = window._katGruppen[idx] || {};
  if (!confirm('Gruppe "' + (g.mitglieder||[]).join(' + ') + '" wirklich löschen?')) return;
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

  function fmtV(kuerzel) {
    return kuerzel ? (kuerzel.split(' ').slice(1).join(' ') || kuerzel) : '–';
  }

  window._dupData = dups;
  var pairsHtml = '';
  if (!dups.length) {
    pairsHtml = '<div class="empty"><div class="empty-icon">✅</div><div class="empty-text">Keine Duplikate gefunden</div></div>';
  } else {
    dups.forEach(function(d, i) {
      var veranstName = fmtV(d.veranst1); // datum is identical (hard criterion)
      var rows =
        '<tr style="border-bottom:1px solid var(--border)">' +
          '<td style="padding:6px 10px;font-family:Barlow Condensed,sans-serif;font-size:15px;font-weight:700">' + (d.res1||'–') + '</td>' +
          '<td style="padding:6px 10px">' + (d.ak1 ? '<span class="badge badge-ak">' + d.ak1 + '</span>' : '–') + '</td>' +
          '<td style="padding:6px 10px;font-size:12px">' +
            '<a href="#veranstaltung/' + d.vid1 + '" style="color:var(--primary)" onclick="navigate(\'veranstaltung/' + d.vid1 + '\')">' +
              (d.vid1 !== d.vid2 ? fmtV(d.veranst1) : veranstName) +
            '</a>' +
          '</td>' +
          '<td style="padding:6px 10px;font-size:12px;color:var(--text2)">' + (d.eingetragen_von1||'–') + '</td>' +
          '<td style="padding:6px 10px;white-space:nowrap">' +
            '<button class="btn btn-ghost btn-sm" title="Bearbeiten" onclick="dupEditErgebnis(' + i + ',1)">&#x270E;</button> ' +
            '<button class="btn btn-ghost btn-sm" title="In Papierkorb" onclick="dupDelete(' + d.id1 + ',this)">🗑️</button>' +
          '</td>' +
        '</tr>' +
        '<tr>' +
          '<td style="padding:6px 10px;font-family:Barlow Condensed,sans-serif;font-size:15px;font-weight:700">' + (d.res2||'–') + '</td>' +
          '<td style="padding:6px 10px">' + (d.ak2 ? '<span class="badge badge-ak">' + d.ak2 + '</span>' : '–') + '</td>' +
          '<td style="padding:6px 10px;font-size:12px">' +
            '<a href="#veranstaltung/' + d.vid2 + '" style="color:var(--primary)" onclick="navigate(\'veranstaltung/' + d.vid2 + '\')">' +
              (d.vid1 !== d.vid2 ? fmtV(d.veranst2) : veranstName) +
            '</a>' +
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
            '<span style="color:var(--text2);font-size:13px">' + (d.disziplin||'–') + '</span>' +
            '<span style="font-size:12px;color:var(--text2)">📅 ' + formatDate(d.dat1) + '</span>' +
            (d.vid1 === d.vid2 ? '<span style="font-size:12px;color:var(--text2)">🏟 ' + veranstName + '</span>' : '') +
            '<button class="btn btn-ghost btn-sm" style="margin-left:auto;font-size:12px" title="Als kein Duplikat markieren" onclick="dupIgnore(' + d.id1 + ',' + d.id2 + ',this)">✅ Kein Duplikat</button>' +
          '</div>' +
          '<table style="width:100%;border-collapse:collapse">' +
            '<thead><tr style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text2)">' +
              '<th style="padding:6px 10px;text-align:left">Ergebnis</th>' +
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
    d.disziplin,
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
