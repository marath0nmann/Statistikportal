async function _loadEigenesProfilWidget(elId, showErg) {
  var el = document.getElementById(elId);
  if (!el) return;
  // Nur für eingeloggte User mit verknüpftem Athlet
  if (!currentUser || !currentUser.athlet_id) {
    el.innerHTML = el.innerHTML.replace(
      '<div class="loading" style="padding:24px"><div class="spinner"></div></div>',
      '<div style="padding:20px;text-align:center;color:var(--text2);font-size:13px">Kein Athletenprofil verknüpft.</div>'
    );
    return;
  }
  var r = await apiGet('athleten/' + currentUser.athlet_id);
  if (!r || !r.ok) {
    el.innerHTML = el.innerHTML.replace(
      '<div class="loading" style="padding:24px"><div class="spinner"></div></div>',
      '<div style="padding:20px;text-align:center;color:var(--accent);font-size:13px">Fehler beim Laden.</div>'
    );
    return;
  }
  var athlet = r.data.athlet;
  var kategorien = r.data.kategorien || [];
  var rawPbs = r.data.pbs || [];
  var clubName = (appConfig && appConfig.verein_name) ? appConfig.verein_name : '';

  // Initialen
  var initials = ((athlet.vorname||'')[0]||'').toUpperCase() + ((athlet.nachname||'')[0]||'').toUpperCase();
  var avatarHtml2 = avatarHtml(athlet.avatar_pfad, initials, 48, 18, currentUser ? 'online' : null, initials);

  // AK
  var akBadgeHtml = '';
  if (athlet.geschlecht && athlet.geburtsjahr) {
    var _ak = calcDlvAK(athlet.geburtsjahr, athlet.geschlecht, new Date().getFullYear());
    if (_ak) akBadgeHtml = akBadge(_ak);
  }

  // Header
  // Wettkampf-Anzahl
  var totalErg2 = 0;
  for (var _ki=0;_ki<kategorien.length;_ki++) totalErg2 += (kategorien[_ki].ergebnisse||[]).length + (kategorien[_ki].pbs||[]).length;

  // Auszeichnungen laden
  var rAusz2 = await apiGet('athleten/' + currentUser.athlet_id + '/auszeichnungen');

  var headerHtml =
    '<div style="display:flex;align-items:center;gap:14px;padding:14px 18px 10px">' +
      '<div style="cursor:pointer" onclick="openAthletById(' + athlet.id + ')" title="Profil öffnen">' + avatarHtml2 + '</div>' +
      '<div style="flex:1;min-width:0">' +
        '<div style="font-weight:700;font-size:16px;cursor:pointer" onclick="openAthletById(' + athlet.id + ')">' +
          (athlet.vorname||'') + ' ' + (athlet.nachname||'') +
        '</div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px;align-items:center">' +
          '<span class="badge badge-ak">' + totalErg2 + ' ' + (totalErg2 === 1 ? 'Ergebnis' : 'Ergebnisse') + '</span>' +
          akBadgeHtml +
          (athlet.geburtsjahr ? '<span style="font-size:11px;color:var(--text2)">Jahrgang ' + athlet.geburtsjahr + '</span>' : '') +
        '</div>' +
        (function(){
          var ausz = (rAusz2 && rAusz2.ok) ? rAusz2.data : null;
          if (!ausz || (!ausz.meisterschaften.length && !ausz.bestleistungen.length)) return '';
          var parts2 = [];
          if (ausz.meisterschaften.length) parts2.push('&#x1F947; ' + ausz.meisterschaften.length + ' Titel');
          if (ausz.bestleistungen.length) parts2.push('&#x1F3C6; ' + ausz.bestleistungen.length + ' Bestleistungen');
          if (!parts2.length) return '';
          // Titel-Tooltip
          var mGrp2={}, mOrd2=[];
          (ausz.meisterschaften||[]).forEach(function(mt){
            if(!mGrp2[mt.label]){mGrp2[mt.label]={jahre:[]};mOrd2.push(mt.label);}
            if(mt.jahr&&mGrp2[mt.label].jahre.indexOf(mt.jahr)<0)mGrp2[mt.label].jahre.push(mt.jahr);
          });
          var mTip2=mOrd2.map(function(k){var g=mGrp2[k];g.jahre.sort();return k+(g.jahre.length?' '+g.jahre.join(', '):'')} ).join('&#10;');
          // Bestleistungs-Tooltip (vereinfacht: je Label eine Zeile)
          var bTip2=(ausz.bestleistungen||[]).map(function(b){return b.label+' über '+b.disziplin;}).join('&#10;');
          return '<div style="margin-top:5px;display:flex;gap:10px">' +
            (ausz.meisterschaften.length&&mTip2 ? '<span title="'+mTip2+'" style="font-size:12px;color:var(--text2);cursor:help">&#x1F947; '+ausz.meisterschaften.length+' Titel</span>' : '') +
            (ausz.bestleistungen.length&&bTip2 ? '<span title="'+bTip2+'" style="font-size:12px;color:var(--text2);cursor:help">&#x1F3C6; '+ausz.bestleistungen.length+' Bestleistungen</span>' : '') +
            '</div>';
        }()) +
      '</div>' +
    '</div>';

  if (!showErg) {
    // Eigenes Athletenprofil-Widget: nur Header
    el.innerHTML = el.innerHTML.replace(
      '<div class="loading" style="padding:24px"><div class="spinner"></div></div>',
      headerHtml
    );
    return;
  }
  // Eigene Bestleistungen-Widget: NUR PB-Buttons, kein Header

  // PBs je Kategorie berechnen
  // Externe PBs in kategorien einbetten
  rawPbs.forEach(function(pb) {
    var kn = pb.kat_name || 'Sonstige';
    var found = false;
    for (var ki2 = 0; ki2 < kategorien.length; ki2++) {
      if (kategorien[ki2].name === kn) {
        if (!kategorien[ki2].pbs) kategorien[ki2].pbs = [];
        kategorien[ki2].pbs.push(pb);
        found = true; break;
      }
    }
    if (!found) {
      kategorien.push({ name: kn, fmt: pb.fmt||'min', ergebnisse: [], pbs: [pb], kat_sort: pb.kat_sort||99 });
    }
  });
  kategorien.sort(function(a,b){ return (a.kat_sort||99)-(b.kat_sort||99); });

  // PB-Buttons je Disziplin (kombiniert intern+extern), als rek-top-btn
  var pbSections = '';
  for (var ki3 = 0; ki3 < kategorien.length; ki3++) {
    var kat = kategorien[ki3];
    var ergs = kat.ergebnisse || [];
    var fmt = kat.fmt || 'min';
    var diszMap2 = {};
    ergs.forEach(function(e) {
      var key = e.disziplin_mapping_id ? 'm'+e.disziplin_mapping_id : 'd_'+e.disziplin;
      if (!diszMap2[key]) diszMap2[key] = { ergs: [], pbs: [], fmt: fmt, label: e.disziplin };
      diszMap2[key].ergs.push(e);
    });
    (kat.pbs||[]).forEach(function(p) {
      var key = p.disziplin_mapping_id ? 'm'+p.disziplin_mapping_id : 'd_'+(p.disziplin_mapped||p.disziplin);
      if (!diszMap2[key]) diszMap2[key] = { ergs: [], pbs: [], fmt: p.fmt||fmt, label: p.disziplin_mapped||p.disziplin };
      diszMap2[key].pbs.push(p);
    });
    var keys = Object.keys(diszMap2);
    if (!keys.length) continue;
    keys.sort(function(a,b) {
      var la = diszMap2[a].label, lb = diszMap2[b].label;
      return _apDiszSortKey(la) - _apDiszSortKey(lb) || la.localeCompare(lb);
    });
    var btns = '';
    for (var di2 = 0; di2 < keys.length; di2++) {
      var dk = diszMap2[keys[di2]];
      var allForPb = dk.ergs.concat(dk.pbs);
      var pb2 = _apBestOf(allForPb, dk.fmt);
      if (!pb2) continue;
      var pbFmt = _apFmtRes(pb2, dk.fmt);
      var isExt = !pb2.veranstaltung;
      var pbColor = isExt ? 'color:var(--text)' : 'color:var(--primary)';
      btns += '<button class="rek-top-btn" style="min-width:70px;padding:7px 12px;cursor:pointer" ' +
        'onclick="openAthletById(' + athlet.id + ')" title="Profil öffnen">' +
        '<span class="rek-top-name" style="font-size:12px">' + dk.label + '</span>' +
        '<span class="rek-top-cnt" style="font-family:Barlow Condensed,sans-serif;font-size:14px;font-weight:700;margin-top:1px;' + pbColor + '">' + pbFmt + '</span>' +
      '</button>';
    }
    if (!btns) continue;
    pbSections +=
      '<div class="pb-kat-section" style="flex:1 1 auto;min-width:180px">' +
        '<div style="padding:8px 14px 4px;font-size:10px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.6px">' + kat.name + '</div>' +
        '<div style="padding:0 14px 10px;display:flex;flex-wrap:wrap;gap:6px">' + btns + '</div>' +
      '</div>';
  }
  if (!pbSections) pbSections = '<div style="padding:16px 18px;color:var(--text2);font-size:13px">Noch keine Ergebnisse.</div>';

  el.innerHTML = el.innerHTML.replace(
    '<div class="loading" style="padding:24px"><div class="spinner"></div></div>',
    '<div style="display:flex;flex-wrap:wrap;align-items:flex-start;padding-bottom:6px">' + pbSections + '</div>'
  );
}


var _tlAutoFillLimits = {};
async function renderDashboard() {
  var ds = getDarstellungSettings();
  // timeline_limit: erst aus Widget-Config, dann appConfig, dann Default
  var timelineLimit = 20;
  try {
    var _lay = JSON.parse(appConfig.dashboard_layout || '[]');
    for (var _tli = 0; _tli < _lay.length; _tli++) {
      for (var _tlj = 0; _tlj < (_lay[_tli].cols||[]).length; _tlj++) {
        var _tlc = _lay[_tli].cols[_tlj];
        if (_tlc.widget === 'timeline') {
        if (_tlc.tl_auto_fill) { timelineLimit = 200; }
        else if (_tlc.tl_limit) { timelineLimit = parseInt(_tlc.tl_limit); }
        break;
      }
      }
    }
  } catch(e) {}
  if (timelineLimit < 5) timelineLimit = parseInt(appConfig.dashboard_timeline_limit || 20) || 20;
  // merge_ak_tl: aus erster Timeline-Widget-Config lesen
  var mergeAKTl = true;
  for (var _tlc2 of (appConfig.dashboard_layout || [])) {
    for (var _col2 of (_tlc2.cols || [])) {
      if (_col2.widget === 'timeline') { mergeAKTl = _col2.tl_merge_ak !== false; break; }
    }
  }
  // Over-fetch when filters may reduce count; slice client-side after filtering
  var _tlFetchLimit = timelineLimit;
  try {
    var _layout2 = JSON.parse(appConfig.dashboard_layout || '[]');
    for (var _rr=0;_rr<_layout2.length;_rr++) for (var _cc=0;_cc<(_layout2[_rr].cols||[]).length;_cc++) {
      var _wc = _layout2[_rr].cols[_cc];
      if (_wc.widget === 'timeline' && (_wc.hidden_types?.length || _wc.tl_nur_favoriten)) {
        _tlFetchLimit = Math.min(timelineLimit * 4, 200); break;
      }
    }
  } catch(e) {}
  var r = await apiGet('dashboard?timeline_limit=' + _tlFetchLimit + '&merge_ak_tl=' + (mergeAKTl ? '1' : '0'));
  if (!r || !r.ok) {
    document.getElementById('main-content').innerHTML =
      '<div class="panel" style="padding:32px;text-align:center">' +
        '<div style="color:var(--accent);font-weight:600">Dashboard konnte nicht geladen werden.</div>' +
        '<div style="color:var(--text2);font-size:13px;margin-top:8px">' + (r && r.fehler ? r.fehler : '') + '</div>' +
      '</div>';
    return;
  }
  var d = r.data;
  var stats = d.stats;
  var rekordeTimeline = d.rekordeTimeline || [];
  var recent = d.recent || [];

  // Einzel-Stat-Werte für Widget-Rendering
  var statErgebnisse = stats.gesamt !== undefined ? stats.gesamt
    : (stats.strasse||0)+(stats.sprint||0)+(stats.mittelstrecke||0)+(stats.sprungwurf||0);
  var statAthleten = stats.athleten;
  var statRekorde  = stats.rekorde;

  function statCard(num, icon, label) {
    return '<div class="stat-card" style="width:100%"><div class="stat-num">' + num + '</div><div class="stat-label">' + icon + ' ' + label + '</div></div>';
  }

// Label-Transformation: Bestleistung Männer/Frauen → Vereinsrekord ♂/♀
function _rekLabel(lbl) {
  if (!lbl) return lbl;
  if (lbl === 'Bestleistung Männer' || lbl === 'Gesamtbestleistung Männer') return 'Vereinsrekord ♂';
  if (lbl === 'Bestleistung Frauen' || lbl === 'Gesamtbestleistung Frauen') return 'Vereinsrekord ♀';
  if (lbl === 'Gesamtbestleistung') return 'Vereinsrekord';
  return lbl;
}

// Hilfsfunktion: bis zu zwei Timeline-Badges rendern (club + persönlich)
function timelineBadges(rek) {
  var lc = rek.label_club || null;
  var lp = rek.label_pers || null;
  var fmt = rek.fmt || '';
  var _fmtV = function(v) {
    if (v === null || v === undefined) return '';
    return fmtValNum(v, fmt === 's' ? 's' : (fmt === 'm' ? 'm' : (fmt === 'min_h' ? 'min_h' : 'min')));
  };
  var vcFmt = _fmtV(rek.vorher_club);
  var vpFmt = _fmtV(rek.vorher_pers);
  // Wenn beide gleich: nur einmal zeigen; wenn unterschiedlich: je Badge zuordnen
  var bothSame = vcFmt && vpFmt && vcFmt === vpFmt;
  var singleVorher = bothSame ? vcFmt : '';

  var html = '';
  if (lc) {
    var isGold = lc === 'Vereinsrekord' || lc.indexOf('Gesamt') >= 0 || lc.indexOf('Männer') >= 0 || lc.indexOf('Frauen') >= 0 || lc.indexOf('Ergebnis M') >= 0 || lc.indexOf('Ergebnis W') >= 0;
    var vcSuffix = (!rek.extern && vcFmt) ? ' <span style="opacity:.75;font-weight:400">(war ' + vcFmt + ')</span>' : '';
    html += '<span class="badge ' + (isGold ? 'badge-gold' : 'badge-silver') + '">' + _rekLabel(lc) + vcSuffix + '</span> ';
  }
  if (lp) {
    // PB-Badge: Vorgaenger zeigen, ausser er wird schon im Club-Badge angezeigt (bothSame + lc vorhanden)
    var vpSuffix = (!rek.extern && vpFmt) ? ' <span style="opacity:.75;font-weight:400">(war ' + vpFmt + ')</span>' : '';
    html += '<span class="badge badge-pb">' + _rekLabel(lp) + vpSuffix + '</span>';
  }
  // Fallback für ältere Daten ohne label_club/label_pers
  if (!lc && !lp && rek.label) {
    var lbl = rek.label;
    var cls = (lbl === 'Vereinsrekord' || lbl.indexOf('Gesamtbestleistung') >= 0 || lbl.indexOf('Erste Gesamtleistung') >= 0 || lbl === 'Bestleistung Männer' || lbl === 'Bestleistung Frauen') ? 'badge-gold'
            : (lbl === 'PB' || lbl === 'Débüt') ? 'badge-pb' : 'badge-silver';
    var fallbackV = _fmtV(rek.vorher_val);
    var fbSuffix = (!rek.extern && fallbackV) ? ' <span style="opacity:.75;font-weight:400">(war ' + fallbackV + ')</span>' : '';
    html += '<span class="badge ' + cls + '">' + _rekLabel(lbl) + fbSuffix + '</span>';
  }
  return html.trim();
}

  // Rekord-Timeline
  var timelineHtml = '';
  var timelineMax = rekordeTimeline.length;
  for (var i = 0; i < timelineMax; i++) {
    var rek = rekordeTimeline[i];
    if (rek.extern) continue;
    var fmt = rek.fmt || '';
    var res = fmt === 'm' ? fmtMeter(rek.resultat) : fmtTime(rek.resultat, fmt === 's' ? 's' : (fmt === 'min_h' ? 'min_h' : undefined));
    var lbl = rek.label || '';
    var athletName = rek.athlet || '';
    var badgesHtml = timelineBadges(rek);
    if (!athletName) continue;
    // "Nachname, Vorname" → "Vorname Nachname"
    var _nvParts = athletName.split(', ');
    var athletNameVN = _nvParts.length >= 2 ? (_nvParts.slice(1).join(' ') + ' ' + _nvParts[0]).trim() : athletName;
    var athLink = rek.athlet_id ? '<span class="athlet-link" style="color:var(--primary);font-weight:700" data-athlet-id="' + rek.athlet_id + '">' + athletNameVN + '</span>' : '<span style="color:var(--primary);font-weight:700">' + athletNameVN + '</span>';

    var vorherHtml = ''; // vorher-Werte sind jetzt in den Badges integriert

    timelineHtml += '<div class="timeline-item">';
    timelineHtml += '<div class="timeline-date">' + formatDate(rek.datum) + '</div>';
    timelineHtml += '<div class="timeline-body">';
    var diszLink = '<span class="athlet-link" style="color:var(--text2);font-size:13px;cursor:pointer" data-rek-disz="' + rek.disziplin.replace(/"/g,'&quot;') + '" data-rek-mid="' + (rek.disziplin_mapping_id||'') + '" onclick="navigateToDisz(this.dataset.rekDisz,this.dataset.rekMid)">' + ergDiszLabel(rek) + '</span>';
    timelineHtml += '<div class="timeline-athlet-disz">' + athLink + '<span style="color:var(--text2);margin:0 4px">&middot;</span>' + diszLink + '</div>';
    timelineHtml += '<div class="timeline-result">' + res + vorherHtml + '</div>';
    timelineHtml += (badgesHtml ? '<div class="timeline-badges">' + badgesHtml + '</div>' : '');
    timelineHtml += '</div></div>';
  }
  if (!timelineHtml) timelineHtml = '<div class="empty"><div class="empty-icon">&#x1F3C6;</div><div class="empty-text">Noch keine Bestleistungen erfasst</div></div>';

  // Letzte Veranstaltungen: Limit aus Widget-Config
  var veranstHtml = '';
  var _vLimit = 5;
  try {
    var _vLay = JSON.parse(appConfig.dashboard_layout || '[]');
    for (var _vri=0;_vri<_vLay.length;_vri++) { for (var _vci=0;_vci<(_vLay[_vri].cols||[]).length;_vci++) { var _vc=_vLay[_vri].cols[_vci]; if (_vc.widget==='veranstaltungen' && _vc.veranst_limit) { _vLimit=parseInt(_vc.veranst_limit)||5; break; } } }
  } catch(e) {}
  var rv = await apiGet('veranstaltungen?limit=' + _vLimit + '&offset=0');
  var veranst = (rv && rv.ok && rv.data.veranst) ? rv.data.veranst : [];
  for (var vi = 0; vi < veranst.length; vi++) {
    var v = veranst[vi];
    var vname = v.name || (v.kuerzel || '').split(' ').slice(1).join(' ') || v.kuerzel || '';
    var vrows = '';
    var byDisz = {}; var diszOrder = [];
    for (var ei = 0; ei < v.ergebnisse.length; ei++) {
      var e = v.ergebnisse[ei];
      var _dk = ergDiszKey(e);
      if (!byDisz[_dk]) { byDisz[_dk] = []; diszOrder.push(_dk); }
      byDisz[_dk].push(e);
    }
    sortDisziplinen(diszOrder);
    for (var di = 0; di < diszOrder.length; di++) {
      var _dKey = diszOrder[di];
      var disz = byDisz[_dKey][0] ? ergDiszLabel(byDisz[_dKey][0]) : _dKey;
      var ergs = byDisz[_dKey];
      vrows += '<tr class="disz-header-row"><td colspan="6" class="disziplin-text" style="background:var(--surf2);font-weight:600;padding:6px 12px">' + diszMitKat(disz) + '</td></tr>';
      for (var ei2 = 0; ei2 < ergs.length; ei2++) {
        var e2 = ergs[ei2];
        var vfmt = e2.fmt || '';
        var vres = vfmt === 'm' ? fmtMeter(e2.resultat) : fmtTime(e2.resultat, vfmt === 's' ? 's' : (vfmt === 'min_h' ? 'min_h' : undefined));
        var _vPace = diszKm(e2.disziplin) >= 1 ? calcPace(e2.disziplin, e2.resultat) : '';
        var vShowPace = _vPace && _vPace !== '00:00' && vfmt !== 'm' && vfmt !== 's';
        vrows +=
          '<tr>' +
            '<td><span class="athlet-link" onclick="openAthletById(' + e2.athlet_id + ')">' + e2.athlet + '</span>' + (parseInt(e2.extern) ? ' <span title="Externes Ergebnis" style="font-size:10px;color:var(--text2);opacity:.7">(ext.)</span>' : '') + '</td>' +
            '<td>' + akBadge(e2.altersklasse) + '</td>' +
            '<td class="result">' + vres + '</td>' +
            '<td class="ort-text">' + (vShowPace ? fmtTime(_vPace, 'min/km') : '') + '</td>' +
            '<td>' + medalBadge(e2.ak_platzierung) + '</td>' +
            '<td>' + mstrBadge(e2.meisterschaft) + '</td>' +
          '</tr>';
      }
    }
    var _vErgs = v.ergebnisse || [];
    var _vExtErgs = _vErgs.filter(function(e){return parseInt(e.extern);});
    var _vExtErgCount = _vExtErgs.length;
    var _vTotalErg = _vErgs.length;
    var _vClubIds = _vErgs.filter(function(e){return !parseInt(e.extern);}).map(function(e){return e.athlet_id;});
    var _vAllIds = _vErgs.map(function(e){return e.athlet_id;});
    var _vUniqIds = _vAllIds.filter(function(id,i,a){return a.indexOf(id)===i;});
    var _vTotalAth = _vUniqIds.length;
    var _vExtOnlyAth = _vUniqIds.filter(function(id){return _vClubIds.indexOf(id)<0;}).length;
    var _vErgStr = _vTotalErg === 1 ? '1 Ergebnis' : _vTotalErg + ' Ergebnisse';
    if (_vExtErgCount > 0) _vErgStr += ' (' + _vExtErgCount + ' extern)';
    var _vAthStr = _vTotalAth === 1 ? '1 Athlet*in' : _vTotalAth + ' Athlet*innen';
    if (_vExtOnlyAth > 0) _vAthStr += ' (' + _vExtOnlyAth + ' extern)';
    var isLast = (vi === veranst.length - 1);
    veranstHtml +=
      '<div class="veranst-dash-block" style="' + (isLast ? 'padding:14px 20px 4px' : 'border-bottom:1px solid var(--border);padding:14px 20px') + '">' +
        '<div class="veranst-meta" style="display:flex;justify-content:space-between;align-items:baseline;gap:4px;margin-bottom:6px">' +
          '<div>' +
            '<div style="font-weight:700;font-size:16px;color:var(--primary)">' + vname + '</div>' +
            '<div style="font-size:12px;color:var(--text2);margin-top:2px">' + formatDate(v.datum) + (v.ort ? ' &middot; ' + v.ort : '') + '</div>' +
          '</div>' +
          '<div style="font-size:12px;color:var(--text2);white-space:nowrap">' + _vErgStr + ' &middot; ' + _vAthStr + '</div>' +
        '</div>' +
        (vrows ? '<div class="table-scroll" style="margin-bottom:8px"><table class="veranst-dash-table"><colgroup><col class="vcol-athlet"><col class="vcol-ak"><col class="vcol-result"><col class="vcol-pace"><col class="vcol-platz"><col class="vcol-ms"></colgroup><thead><tr><th>Athlet*in</th><th>AK</th><th>Ergebnis</th><th>Pace</th><th>Platz AK</th><th>Meisterschaft</th></tr></thead><tbody>' + vrows + '</tbody></table></div>' :
                 '<div style="color:var(--text2);font-size:13px;padding:4px 0 8px">Keine Ergebnisse</div>') +
      '</div>';
  }
  if (!veranstHtml) veranstHtml = '<div class="empty"><div class="empty-icon">&#x1F4CD;</div><div class="empty-text">Noch keine Veranstaltungen</div></div>';

  // ── Hall of Fame Daten: Cache pro Widget-Konfiguration ──
  var _hofCache = {};

  function _hofCacheKey(wcfg) {
    var merge = (wcfg && wcfg.hof_merge_ak !== false) ? '1' : '0';
    var kats  = (wcfg && wcfg.hof_kats && wcfg.hof_kats.length) ? wcfg.hof_kats.slice().sort().join(',') : '';
    return merge + '|' + kats;
  }

  async function _loadHofWidget(wcfg) {
    var key = _hofCacheKey(wcfg);
    if (_hofCache[key]) return _hofCache[key];
    var merge = (wcfg && wcfg.hof_merge_ak !== false);
    var kats  = (wcfg && wcfg.hof_kats && wcfg.hof_kats.length) ? wcfg.hof_kats : [];
    var params = 'hall-of-fame?merge_ak=' + (merge ? '1' : '0');
    if (kats.length) params += '&kat=' + encodeURIComponent(kats.join(','));
    var rh = await apiGet(params);
    _hofCache[key] = (rh && rh.ok) ? rh.data : [];
    return _hofCache[key];
  }

  // ── Layout aus Config rendern ──
  var layout = [];
  try { layout = JSON.parse(appConfig.dashboard_layout || ''); } catch(e) {}
  if (!layout || !layout.length) {
    layout = [
      { cols: [{ widget: 'stats', cards: ['ergebnisse','athleten','rekorde'] }] },
      { cols: [{ widget: 'timeline', w: 340 }, { widget: 'veranstaltungen' }] }
    ];
  }

  function widgetTitle(wcfg, defaultTitle) {
    return (wcfg.title && wcfg.title.trim()) ? wcfg.title.trim() : defaultTitle;
  }

  function renderWidget(wcfg) {
    var w = wcfg.widget;
    // Sichtbarkeit: welche Rollen dürfen dieses Widget sehen?
    var sf = wcfg.sichtbar_fuer;
    if (sf && sf.length) {
      var myRolle = currentUser ? (currentUser.rolle || 'leser') : 'nicht-eingeloggt';
      if (sf.indexOf(myRolle) < 0) return '';
    }
    if (w === 'stats') {
      // cfg.cards: Array von IDs in gewünschter Reihenfolge, z.B. ['ergebnisse','athleten','rekorde']
      var cardIds = (wcfg.cards && wcfg.cards.length) ? wcfg.cards
        : ['ergebnisse', 'athleten', 'rekorde'];
      var cardsHtml = '';
      var vals = { ergebnisse: statErgebnisse, athleten: statAthleten, rekorde: statRekorde };
      for (var si = 0; si < STAT_CARD_DEFS.length; si++) {
        var sc = STAT_CARD_DEFS[si];
        if (cardIds.indexOf(sc.id) < 0) continue;
        cardsHtml += statCard(vals[sc.id], sc.icon, sc.label);
      }
      // Reihenfolge gemäß cardIds
      var ordered = '';
      for (var oi = 0; oi < cardIds.length; oi++) {
        for (var si2 = 0; si2 < STAT_CARD_DEFS.length; si2++) {
          if (STAT_CARD_DEFS[si2].id === cardIds[oi]) {
            ordered += statCard(vals[cardIds[oi]], STAT_CARD_DEFS[si2].icon, STAT_CARD_DEFS[si2].label);
            break;
          }
        }
      }
      return '<div class="stats-bar">' + ordered + '</div>';
    }
    // Legacy: Einzelwidgets (Rückwärtskompatibilität)
    if (w === 'stat-ergebnisse') return statCard(statErgebnisse, '&#x1F3C3;', 'Ergebnisse gesamt');
    if (w === 'stat-athleten')   return statCard(statAthleten,   '&#x1F465;', 'Athleten');
    if (w === 'stat-rekorde')    return statCard(statRekorde,    '&#x1F3C6;', 'Vereinsrekorde');
    if (w === 'timeline') {
      // Filtern nach hidden_types und Sortieren nach prio_order
      var hiddenTypes = wcfg.hidden_types || [];
      var prioOrder   = wcfg.prio_order  || ['gesamt','gender','ak','pb'];
      var nurFavoriten = !!wcfg.tl_nur_favoriten;
      var _favMids = [];
      if (nurFavoriten) {
        try { _favMids = JSON.parse(appConfig.top_disziplinen || '[]').map(Number); } catch(e) { _favMids = []; }
      }
      var filteredTimeline = timelineHtml;
      if (hiddenTypes.length || prioOrder.join(',') !== 'gesamt,gender,ak,pb' || (nurFavoriten && _favMids.length)) {
        // Timeline-Items neu rendern mit Filterung + Priorisierung
        var filtItems = [];
        for (var ti = 0; ti < rekordeTimeline.length; ti++) {
          var rek2 = rekordeTimeline[ti];
          if (!rek2.athlet) continue;
          if (rek2.extern) continue;
          // Favoriten-Filter: Disziplin muss in Favoritenliste sein
          if (nurFavoriten && _favMids.length) {
            var _m2 = rek2.disziplin_mapping_id ? parseInt(rek2.disziplin_mapping_id) : null;
            if (!_m2 || _favMids.indexOf(_m2) < 0) continue;
          }
          // Beide Labels auf Sichtbarkeit prüfen
          var lc2 = rek2.label_club || null;
          var lp2 = rek2.label_pers || null;
          var lcVisible = lc2 && hiddenTypes.indexOf(timelineLabelType(lc2)) < 0;
          var lpVisible = lp2 && hiddenTypes.indexOf(timelineLabelType(lp2)) < 0;
          // Fallback für alte Daten
          if (!lc2 && !lp2) {
            var t0 = timelineLabelType(rek2.label || '');
            lcVisible = false; lpVisible = hiddenTypes.indexOf(t0) < 0;
          }
          if (!lcVisible && !lpVisible) continue;
          // Prio: club-Label bestimmt Prio, sonst pb
          var bestPrio = lcVisible ? (rek2.priority !== undefined ? rek2.priority : 3) : 3;
          var visLabel = (lcVisible ? lc2 : '') + (lcVisible && lpVisible ? ' + ' : '') + (lpVisible ? lp2 : '');
          filtItems.push({ rek: rek2, label: visLabel, prio: bestPrio });
        }
        // Sortieren: Datum desc, dann prio asc
        filtItems.sort(function(a,b) {
          var dc = b.rek.datum < a.rek.datum ? -1 : (b.rek.datum > a.rek.datum ? 1 : 0);
          return dc !== 0 ? dc : a.prio - b.prio;
        });
        filteredTimeline = '';
        filtItems = filtItems.slice(0, timelineLimit);
        for (var fi = 0; fi < filtItems.length; fi++) {
          var fItem = filtItems[fi].rek;
          var fLbl  = filtItems[fi].label;
          var fRek  = filtItems[fi].rek;
          var fFmt  = fItem.fmt || '';
          var fRes  = fFmt === 'm' ? fmtMeter(fItem.resultat) : fmtTime(fItem.resultat, fFmt === 's' ? 's' : (fFmt === 'min_h' ? 'min_h' : undefined));
          var fLblCls = (fLbl === 'Vereinsrekord' || fLbl.indexOf('Gesamtbestleistung') >= 0 || fLbl.indexOf('Erste Gesamtleistung') >= 0 || fLbl === 'Bestleistung Männer' || fLbl === 'Bestleistung Frauen') ? 'badge badge-gold' :
                        (fLbl === 'PB' || fLbl === 'Debüt') ? 'badge badge-pb' : 'badge badge-silver';
          var fBadgesHtml = timelineBadges(Object.assign({}, fRek, {
            label_club: hiddenTypes.indexOf(timelineLabelType(fRek.label_club)) < 0 ? fRek.label_club : null,
            label_pers: hiddenTypes.indexOf(timelineLabelType(fRek.label_pers)) < 0 ? fRek.label_pers : null,
          }));
          var _fNvP = (fItem.athlet || '').split(', ');
          var fAthletNameVN = _fNvP.length >= 2 ? (_fNvP.slice(1).join(' ') + ' ' + _fNvP[0]).trim() : (fItem.athlet || '');
          var fAthLink = fItem.athlet_id
            ? '<span class="athlet-link" style="color:var(--primary);font-weight:700" data-athlet-id="' + fItem.athlet_id + '">' + fAthletNameVN + '</span>'
            : '<span style="color:var(--primary);font-weight:700">' + fAthletNameVN + '</span>';
          var fVorher = '';
          var fVorher = ''; // vorher-Werte sind in Badges integriert
          var fDiszLink = '<span class="athlet-link" style="color:var(--text2);font-size:13px;cursor:pointer" data-rek-disz="' + fItem.disziplin.replace(/"/g,'&quot;') + '" data-rek-mid="' + (fItem.disziplin_mapping_id||'') + '" onclick="navigateToDisz(this.dataset.rekDisz,this.dataset.rekMid)">' + ergDiszLabel(fItem) + '</span>';
          filteredTimeline +=
            '<div class="timeline-item">' +
              '<div class="timeline-date">' + formatDate(fItem.datum) + '</div>' +
              '<div class="timeline-body">' +
                '<div class="timeline-athlet-disz">' + fAthLink + '<span style="color:var(--text2);margin:0 4px">&middot;</span>' + fDiszLink + '</div>' +
                '<div class="timeline-result">' + fRes + fVorher + '</div>' +
                (fBadgesHtml ? '<div class="timeline-badges">' + fBadgesHtml + '</div>' : '') +
              '</div>' +
            '</div>';
        }
        if (!filteredTimeline) filteredTimeline = '<div class="empty"><div class="empty-icon">&#x1F3C6;</div><div class="empty-text">Keine Einträge für diese Auswahl</div></div>';
      }
      var _tlId = 'tl-widget-' + ri + '-' + ci;
    if (wcfg.tl_auto_fill) {
      // Measure sibling natural height by temporarily collapsing this column
      setTimeout(function(_id, _ri2, _ci2) {
        var _panel = document.getElementById(_id);
        if (!_panel) return;
        var _items = _panel.querySelectorAll('.timeline-item');
        if (!_items.length) return;
        var _col = _panel.parentElement;
        var _row = _col ? _col.parentElement : null;
        if (!_row) return;
        // Temporarily collapse this column so siblings show their natural height
        var _origCss = _col.style.cssText;
        _col.style.alignSelf = 'flex-start';
        _col.style.height = '0px';
        var _reflow = _row.offsetHeight; // force reflow
        var _maxSiblingH = 0;
        Array.from(_row.children).forEach(function(c) {
          if (c !== _col) _maxSiblingH = Math.max(_maxSiblingH, c.offsetHeight);
        });
        _col.style.cssText = _origCss; // restore
        if (!_maxSiblingH) return;
        var _panelHeaderH = (_panel.querySelector('.panel-header') || {}).offsetHeight || 44;
        var _availH = _maxSiblingH - _panelHeaderH;
        var _itemH  = _items[0].offsetHeight || 60;
        var _fitsCount = Math.max(1, Math.floor(_availH / _itemH));
        var _key3 = _ri2 + '-' + _ci2;
        if (_tlAutoFillLimits[_key3] === _fitsCount) return;
        _tlAutoFillLimits[_key3] = _fitsCount;
        renderDashboard();
      }, 80, _tlId, ri, ci);
    }
    // Use _auto_fill_limit if set (post-measure render)
    var _displayLimit = _tlAutoFillLimits[ri + '-' + ci] || null;
    // Slice filteredTimeline to _displayLimit items via regex split on timeline-item divs
    var _limitedTimeline = (function(){
      if (!_displayLimit) return filteredTimeline;
      var _parts = filteredTimeline.split('<div class="timeline-item">');
      if (_parts.length <= _displayLimit + 1) return filteredTimeline;
      return _parts.slice(0, _displayLimit + 1).join('<div class="timeline-item">');
    }());
    return '<div class="panel" style="height:100%" id="' + _tlId + '">' +
        '<div class="panel-header"><div class="panel-title">&#x1F3C6; ' + widgetTitle(wcfg, 'Neueste Bestleistungen') + '</div></div>' +
        '<div class="timeline" style="overflow:hidden">' + _limitedTimeline + '</div>' +
      '</div>';
    }
    if (w === 'veranstaltungen') {
      // Spalten-Konfiguration anwenden
      var vColOrder  = (wcfg.col_order  && wcfg.col_order.length)  ? wcfg.col_order  : VERANST_COL_DEFS.map(function(c){return c.id;});
      var vHiddenCols= wcfg.hidden_cols || [];
      var visibleCols = vColOrder.filter(function(id){ return vHiddenCols.indexOf(id) < 0; });
      // veranstHtml neu aufbauen wenn Spalten abweichen
      var vHtml = veranstHtml;
      var defaultOrder = VERANST_COL_DEFS.map(function(c){return c.id;});
      var changed = vHiddenCols.length > 0 || visibleCols.join(',') !== defaultOrder.join(',');
      if (changed) {
        vHtml = '';
        for (var vvi = 0; vvi < veranst.length; vvi++) {
          var vv = veranst[vvi];
          var vvname = vv.name || (vv.kuerzel||'').split(' ').slice(1).join(' ') || vv.kuerzel || '';
          var vvrows = '';
          var vvByDisz = {}; var vvDiszOrder = [];
          for (var vei = 0; vei < vv.ergebnisse.length; vei++) {
            var ve = vv.ergebnisse[vei];
            if (!vvByDisz[ve.disziplin]) { vvByDisz[ve.disziplin]=[]; vvDiszOrder.push(ve.disziplin); }
            vvByDisz[ve.disziplin].push(ve);
          }
          for (var vdi = 0; vdi < vvDiszOrder.length; vdi++) {
            var vdisz = vvDiszOrder[vdi];
            var vergs = vvByDisz[vdisz];
            vvrows += '<tr class="disz-header-row"><td colspan="' + visibleCols.length + '" class="disziplin-text" style="background:var(--surf2);font-weight:600;padding:6px 12px">' + diszMitKat(vdisz) + '</td></tr>';
            for (var vei2 = 0; vei2 < vergs.length; vei2++) {
              var ve2 = vergs[vei2];
              var vvfmt = ve2.fmt || '';
              var vvres = vvfmt === 'm' ? fmtMeter(ve2.resultat) : fmtTime(ve2.resultat, vvfmt === 's' ? 's' : (vvfmt === 'min_h' ? 'min_h' : undefined));
              var vvpace = diszKm(ve2.disziplin) >= 1 ? calcPace(ve2.disziplin, ve2.resultat) : '';
              var vvShowPace = vvpace && vvpace !== '00:00' && vvfmt !== 'm' && vvfmt !== 's';
              var vvCells = { athlet: '<td><span class="athlet-link" onclick="openAthletById('+ve2.athlet_id+')">'+ve2.athlet+'</span>'+(parseInt(ve2.extern)?' <span title="Externes Ergebnis" style="font-size:10px;color:var(--text2);opacity:.7">(ext.)</span>':'')+'</td>', ak: '<td>'+akBadge(ve2.altersklasse)+'</td>', result: '<td class="result">'+vvres+'</td>', pace: '<td class="ort-text">'+(vvShowPace?fmtTime(vvpace,'min/km'):'')+'</td>', platz: '<td>'+medalBadge(ve2.ak_platzierung)+'</td>', ms: '<td>'+mstrBadge(ve2.meisterschaft)+'</td>' };
              var vvRow = '<tr>';
              for (var vci = 0; vci < visibleCols.length; vci++) vvRow += vvCells[visibleCols[vci]] || '<td></td>';
              vvrows += vvRow + '</tr>';
            }
          }
          // colgroup + thead
          var vvColgroup = '<colgroup>';
          var vvThead = '<tr>';
          for (var vci2 = 0; vci2 < visibleCols.length; vci2++) {
            var vdef = null;
            for (var di2=0;di2<VERANST_COL_DEFS.length;di2++){if(VERANST_COL_DEFS[di2].id===visibleCols[vci2]){vdef=VERANST_COL_DEFS[di2];break;}}
            vvColgroup += '<col' + (vdef?' class="'+vdef.css+'"':'') + '>';
            vvThead += '<th>' + (vdef?vdef.label:visibleCols[vci2]) + '</th>';
          }
          vvColgroup += '</colgroup>'; vvThead += '</tr>';
          var _vvErgs = vv.ergebnisse || [];
          var _vvExtErgCount = _vvErgs.filter(function(e){return parseInt(e.extern);}).length;
          var _vvTotalErg = _vvErgs.length;
          var _vvClubIds = _vvErgs.filter(function(e){return !parseInt(e.extern);}).map(function(e){return e.athlet_id;});
          var _vvAllIds = _vvErgs.map(function(e){return e.athlet_id;});
          var _vvUniqIds = _vvAllIds.filter(function(id,i,a){return a.indexOf(id)===i;});
          var _vvTotalAth = _vvUniqIds.length;
          var _vvExtOnlyAth = _vvUniqIds.filter(function(id){return _vvClubIds.indexOf(id)<0;}).length;
          var _vvErgStr = _vvTotalErg === 1 ? '1 Ergebnis' : _vvTotalErg + ' Ergebnisse';
          if (_vvExtErgCount > 0) _vvErgStr += ' (' + _vvExtErgCount + ' extern)';
          var _vvAthStr = _vvTotalAth === 1 ? '1 Athlet*in' : _vvTotalAth + ' Athlet*innen';
          if (_vvExtOnlyAth > 0) _vvAthStr += ' (' + _vvExtOnlyAth + ' extern)';
          var isLast2 = (vvi === veranst.length - 1);
          vHtml += '<div class="veranst-dash-block" style="' + (isLast2?'padding:14px 20px 4px':'border-bottom:1px solid var(--border);padding:14px 20px') + '">' +
            '<div class="veranst-meta" style="display:flex;justify-content:space-between;align-items:baseline;gap:4px;margin-bottom:6px">' +
              '<div><div style="font-weight:700;font-size:16px;color:var(--primary)">' + vvname + '</div>' +
              '<div style="font-size:12px;color:var(--text2);margin-top:2px">' + formatDate(vv.datum) + (vv.ort?' &middot; '+vv.ort:'') + '</div></div>' +
              '<div style="font-size:12px;color:var(--text2);white-space:nowrap">' + _vvErgStr + ' &middot; ' + _vvAthStr + '</div>' +
            '</div>' +
            (vvrows ? '<div class="table-scroll" style="margin-bottom:8px"><table class="veranst-dash-table">' + vvColgroup + '<thead>' + vvThead + '</thead><tbody>' + vvrows + '</tbody></table></div>'
                    : '<div style="color:var(--text2);font-size:13px;padding:4px 0 8px">Keine Ergebnisse</div>') +
          '</div>';
        }
        if (!vHtml) vHtml = '<div class="empty"><div class="empty-icon">&#x1F4CD;</div><div class="empty-text">Noch keine Veranstaltungen</div></div>';
      }
      return '<div class="panel" style="height:100%">' +
        '<div class="panel-header"><div class="panel-title">&#x1F4CD; ' + widgetTitle(wcfg, 'Letzte Veranstaltungen') + '</div></div>' +
        vHtml +
      '</div>';
    }
    if (w === 'hall-of-fame') {
      var _hKey = _hofCacheKey(wcfg);
      var hofData = _hofCache[_hKey] || null;
      if (!hofData) return '<div class="panel" style="height:100%"><div class="panel-header"><div class="panel-title">&#x1F3C6; ' + widgetTitle(wcfg,'Hall of Fame') + '</div></div><div style="padding:24px;text-align:center;color:var(--text2)">&#x23F3; Laden&hellip;</div></div>';
      if (!hofData.length) return '<div class="panel" style="height:100%"><div class="panel-header"><div class="panel-title">&#x1F3C6; ' + widgetTitle(wcfg,'Hall of Fame') + '</div></div><div class="empty"><div class="empty-icon">&#x1F3C6;</div><div class="empty-text">Noch keine Daten</div></div></div>';
      var hofLimit      = wcfg.hof_limit ? parseInt(wcfg.hof_limit) : 0;
      var hofLeaderboard = !!wcfg.hof_leaderboard;
      var displayData = hofLimit ? hofData.slice(0, hofLimit) : hofData;
      var hofHtml = '';
      for (var hi = 0; hi < displayData.length; hi++) {
        var ha = displayData[hi];
        var hAvatar = avatarHtml(ha.avatar, ha.name||'?', 64, 24);

        // Gruppierung: gleiche AK-Kombination → eine Box, Disziplinen zusammenfassen.
        // Zusätzlich: konsekutive AK-Ranges komprimieren (W45,W50,W55,W60,W65 → W45–W65)

        function joinList(arr) {
          if (arr.length === 0) return '';
          if (arr.length === 1) return arr[0];
          return arr.slice(0,-1).join(', ') + ' und ' + arr[arr.length-1];
        }

        var diszKeys = Object.keys(ha.disziplinen);
        var groupMap = {}, groupOrder = [];

        for (var hdi = 0; hdi < diszKeys.length; hdi++) {
          var hd = diszKeys[hdi];
          var htitels = ha.disziplinen[hd];
          var gesamtM   = htitels.some(function(t){ return t.label === 'Gesamtbestleistung M\u00e4nner'; });
          var gesamtW   = htitels.some(function(t){ return t.label === 'Gesamtbestleistung Frauen'; });
          var gesamtAll = htitels.some(function(t){ return t.label === 'Gesamtbestleistung'; });
          var gesamt    = gesamtM || gesamtW || gesamtAll;
          var _mhnLabel = htitels.find(function(t){ return t.label === 'Bestleistung M\u00e4nner' || t.label === 'Bestleistung MHK'; });
          var _whnLabel = htitels.find(function(t){ return t.label === 'Bestleistung Frauen'  || t.label === 'Bestleistung WHK'; });
          var hasMaenner = !!_mhnLabel;
          var hasFrauen  = !!_whnLabel;
          // Label aus tatsächlichem Titel übernehmen (WHK/MHK statt Frauen/Männer)
          var mhnText = _mhnLabel ? _mhnLabel.label.replace('Bestleistung ', '') : 'M\u00e4nner';
          var whnText = _whnLabel ? _whnLabel.label.replace('Bestleistung ', '') : 'Frauen';
          var akM = htitels.filter(function(t){ return /^Bestleistung M(?:\d|U\d)/.test(t.label); }).map(function(t){ return t.label.replace('Bestleistung ',''); });
          var akW = htitels.filter(function(t){ return /^Bestleistung W(?:\d|U\d)/.test(t.label); }).map(function(t){ return t.label.replace('Bestleistung ',''); });

          var parts = [];
          if (gesamtAll) parts.push('Vereinsrekord');
          if (gesamtM || hasMaenner) parts.push('Vereinsrekord \u2642');
          if (akM.length) parts.push('Bestleistung ' + compressAKList(akM));
          if (gesamtW || hasFrauen) parts.push('Vereinsrekord \u2640');
          if (akW.length) parts.push('Bestleistung ' + compressAKList(akW));

          var sentence  = parts.join(' \u00b7 ');
          var lineClass = gesamt ? 'badge badge-gold' : 'badge badge-silver';
          if (!groupMap[sentence]) { groupMap[sentence] = { lineClass: lineClass, disz: [], isGold: gesamt }; groupOrder.push(sentence); }
          groupMap[sentence].disz.push(hd);
        }

        // Gold-Badges vor Silber sortieren
        groupOrder.sort(function(a, b) {
          return (groupMap[b].isGold ? 1 : 0) - (groupMap[a].isGold ? 1 : 0);
        });

        // Badges rendern
        var hBadgesHtml = '';
        // Meisterschaften: Emoji-Medaillen mit Tooltip
        var mTitel = ha.meisterschaftsTitel || [];
        var haGeschlecht = ha.geschlecht || '';
        var mSuffix = haGeschlecht === 'M' ? '-Meister' : haGeschlecht === 'W' ? '-Meisterin' : '-Meister/in';
        if (mTitel.length) {
          var mGroups = {}, mOrder = [];
          for (var mi = 0; mi < mTitel.length; mi++) {
            var mt = mTitel[mi];
            var mgKey = mt.label + '|' + (mt.kat_name || '');
            if (!mGroups[mgKey]) { mGroups[mgKey] = { label: mt.label, kat: mt.kat_name, jahre: [] }; mOrder.push(mgKey); }
            if (mt.jahr && mGroups[mgKey].jahre.indexOf(mt.jahr) < 0) mGroups[mgKey].jahre.push(mt.jahr);
          }
          var mMedalSpans = [];
          mOrder.forEach(function(key) {
            var mg = mGroups[key];
            // label: "🥇 Nordrhein 1.500m" – alles nach erstem Leerzeichen
            var afterEmoji = mg.label.indexOf(' ') >= 0 ? mg.label.slice(mg.label.indexOf(' ') + 1) : mg.label;
            // Ersten Token = Meisterschaftsname, Rest = Disziplin
            var sp2 = afterEmoji.indexOf(' ');
            var mstrName = sp2 > 0 ? afterEmoji.slice(0, sp2) : afterEmoji;
            var diszPart  = sp2 > 0 ? afterEmoji.slice(sp2 + 1) : '';
            var katStr = mg.kat && mg.kat !== 'Sonstige' ? ' (' + mg.kat + ')' : '';
            mg.jahre.sort();
            var jahreStr = mg.jahre.length ? ' ' + mg.jahre.join(', ') : '';
            var _sep = /e$/i.test(mstrName) ? ' ' : '-';
            var tooltip = mstrName + _sep + mSuffix.replace(/^-/, '') + ' ' + diszPart + katStr + jahreStr;
            mMedalSpans.push('<span title="' + tooltip.replace(/"/g, '&quot;') + '" style="font-size:15px;display:inline-block;cursor:default;line-height:1">&#x1F947;</span>');
          });
          if (mMedalSpans.length > 9) {
            var _mNumRows = Math.ceil(mMedalSpans.length / 9);
            var _mPerRow  = Math.ceil(mMedalSpans.length / _mNumRows);
            var _mRowsHtml = '';
            for (var _mri = 0; _mri < mMedalSpans.length; _mri += _mPerRow) {
              _mRowsHtml += '<div style="display:flex;justify-content:center;gap:1px">' + mMedalSpans.slice(_mri, _mri + _mPerRow).join('') + '</div>';
            }
            hBadgesHtml += '<div style="width:100%;display:flex;flex-direction:column;align-items:center;gap:2px;margin-bottom:2px">' + _mRowsHtml + '</div>';
          } else {
            hBadgesHtml += mMedalSpans.join('');
          }
        }
                for (var gi = 0; gi < groupOrder.length; gi++) {
          var gKey = groupOrder[gi], gData = groupMap[gKey], dl = gData.disz;
          var diszStr = dl.length===1 ? diszMitKat(dl[0]) : dl.slice(0,-1).map(function(d){ return diszMitKat(d); }).join(', ')+' und '+diszMitKat(dl[dl.length-1]);
          hBadgesHtml += '<span class="'+gData.lineClass+'" style="display:inline-block;margin:3px 4px 3px 0;line-height:1.4">'+gKey+' \u00fcber '+diszStr+'</span>';
        }

        var hRank = hi + 1;
        var hRankHtml = '';
        if (hofLeaderboard) {
          var medals = ['&#x1F947;','&#x1F948;','&#x1F949;'];
          var hRankStyle = hRank<=3?(hRank===1?'font-size:22px;color:#f5a623':hRank===2?'font-size:20px;color:#aaa':'font-size:18px;color:#cd7f32'):'font-size:14px;color:var(--text2)';
          hRankHtml = '<div style="'+hRankStyle+';font-weight:700;margin-bottom:6px">'+(hRank<=3?medals[hRank-1]:hRank+'.')+'</div>';
        }
        hofHtml +=
          '<div style="text-align:center;padding:20px 16px;'+(hi<displayData.length-1?'border-bottom:1px solid var(--border);':'')+'">' +
            hRankHtml +
            '<div style="display:flex;justify-content:center;margin-bottom:10px">' + hAvatar + '</div>' +
            '<div style="font-weight:700;font-size:15px;margin-bottom:2px">' +
              '<span class="athlet-link" onclick="openAthletById(' + ha.id + ')">' + ha.name + '</span>' +
            '</div>' +
            (function(){
            var _mCnt = (ha.meisterschaftsTitel || []).length;
            var _bCnt = ha.titelCount - _mCnt;
            var _parts = [];
            if (_mCnt) _parts.push(_mCnt + ' ' + (_mCnt === 1 ? 'Titel' : 'Titel'));
            if (_bCnt) _parts.push(_bCnt + ' ' + (_bCnt === 1 ? 'Bestleistung' : 'Bestleistungen'));
            return '<div style="font-size:12px;color:var(--text2);margin-bottom:10px">' + _parts.join(' · ') + '</div>';
          }()) +
            '<div style="display:flex;flex-wrap:wrap;justify-content:center;gap:1px">' + hBadgesHtml + '</div>' +
          '</div>';
      }
      var hofPanelTitle = widgetTitle(wcfg, 'Hall of Fame');
      return '<div class="panel" style="height:100%">' +
        '<div class="panel-header"><div class="panel-title">&#x1F3C6; ' + hofPanelTitle + '</div></div>' +
        hofHtml +
      '</div>';
    }
    if (w === 'eigenes-profil') {
      var epId = 'ep-widget-' + Math.random().toString(36).slice(2,8);
      setTimeout(function(_id) { return function() { _loadEigenesProfilWidget(_id, false); }; }(epId), 0);
      return '<div class="panel" id="' + epId + '" style="height:100%">' +
        '<div class="panel-header"><div class="panel-title">&#x1F3C3;&#xFE0E; ' + widgetTitle(wcfg, 'Mein Athletenprofil') + '</div></div>' +
        '<div class="loading" style="padding:24px"><div class="spinner"></div></div>' +
      '</div>';
    }
    if (w === 'eigene-bestzeiten') {
      var ebId = 'eb-widget-' + Math.random().toString(36).slice(2,8);
      setTimeout(function(_id) { return function() { _loadEigenesProfilWidget(_id, true); }; }(ebId), 0);
      return '<div class="panel" id="' + ebId + '" style="height:100%">' +
        '<div class="panel-header"><div class="panel-title">⏱️ ' + widgetTitle(wcfg, 'Persönliche Bestleistungen') + '</div></div>' +
        '<div class="loading" style="padding:24px"><div class="spinner"></div></div>' +
      '</div>';
    }
    return '';
  }

  // Hall-of-Fame vorläufig laden wenn Widget im Layout
  var hasHof = false;
  for (var _ri = 0; _ri < layout.length; _ri++) {
    for (var _ci = 0; _ci < (layout[_ri].cols||[]).length; _ci++) {
      if ((layout[_ri].cols[_ci].widget||'') === 'hall-of-fame') hasHof = true;
    }
  }
  var hofWcfg = null;
  for (var _ri2 = 0; _ri2 < layout.length; _ri2++) {
    for (var _ci2 = 0; _ci2 < (layout[_ri2].cols||[]).length; _ci2++) {
      if ((layout[_ri2].cols[_ci2].widget||'') === 'hall-of-fame') hofWcfg = layout[_ri2].cols[_ci2];
    }
  }
  if (hasHof) {
    var _hofWidgets = [];
    for (var _hri = 0; _hri < layout.length; _hri++) {
      for (var _hci = 0; _hci < (layout[_hri].cols||[]).length; _hci++) {
        if ((layout[_hri].cols[_hci].widget||'') === 'hall-of-fame') {
          _hofWidgets.push(layout[_hri].cols[_hci]);
        }
      }
    }
    await Promise.all(_hofWidgets.map(function(w) { return _loadHofWidget(w); }));
  }

  var layoutHtml = '';
  for (var ri = 0; ri < layout.length; ri++) {
    var row = layout[ri];
    var cols = row.cols || [];
    if (!cols.length) continue;
    if (cols.length === 1) {
      var _w1 = renderWidget(cols[0]);
      if (_w1) layoutHtml += '<div style="margin-bottom:20px">' + _w1 + '</div>';
    } else {
      // Mehrspaltig: explizite Breiten + CSS-Custom-Properties für responsives Umbrechen
      var colsHtml = '';
      var gtcParts = [];
      var totalMin = 0;
      for (var ci = 0; ci < cols.length; ci++) {
        var col = cols[ci];
        var _wHtml = renderWidget(col);
        if (!_wHtml) continue; // Widget nicht sichtbar – Spalte komplett weglassen
        var colMin = col.w ? col.w : 280;
        totalMin += colMin;
        colsHtml += '<div class="' + (col.w ? '' : 'dash-col-auto') + '" style="min-width:' + colMin + 'px;flex:' + (col.w ? '0 0 ' + col.w + 'px' : '1') + ';height:100%">' + _wHtml + '</div>';
        gtcParts.push(col.w ? col.w + 'px' : '1fr');
      }
      if (colsHtml) {
        var gtc = gtcParts.join(' ');
        // dash-row-wrap: umbrechen wenn Viewport < Summe der Mindestbreiten + gaps
        layoutHtml += '<div class="dash-row-wrap" style="--dash-gtc:' + gtc + ';--dash-min-total:' + (totalMin + (gtcParts.length-1)*20) + 'px;margin-bottom:20px">' + colsHtml + '</div>';
      }
    }
  }

  document.getElementById('main-content').innerHTML = layoutHtml;
  // Stat-Karten: layout-vertical wenn Höhe > Breite
  requestAnimationFrame(function() {
    document.querySelectorAll('.stats-bar').forEach(function(el) {
      var ro = new ResizeObserver(function(entries) {
        for (var e of entries) {
          var r = e.contentRect;
          el.classList.toggle('layout-vertical', r.height > r.width);
        }
      });
      ro.observe(el);
    });
  });
  // Responsive: .stacked wenn Container schmaler als Summe der Mindestbreiten
  requestAnimationFrame(function() {
    var rows = document.querySelectorAll('.dash-row-wrap');
    for (var i = 0; i < rows.length; i++) {
      (function(row) {
        var minTotal = parseInt(row.style.getPropertyValue('--dash-min-total')) || 600;
        function check() { row.classList.toggle('stacked', row.offsetWidth < minTotal); }
        check();
        if (window.ResizeObserver) {
          new ResizeObserver(check).observe(row);
        }
      })(rows[i]);
    }
  });
}


// ── ERGEBNISSE ─────────────────────────────────────────────
