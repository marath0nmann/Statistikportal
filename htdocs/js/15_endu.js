// ── ENDU (endu.net, Italien) ─────────────────────────────────────────────────
//
// Ergebnisseiten wie
//   https://www.endu.net/de/events/pisa-half-marathon/results?eventId=102217&raceId=62985&…
// sind eine SPA. Die Daten liefert die JSON-API derselben Domain; da sie kein
// CORS erlaubt, laedt der Server sie ueber `endu-fetch` (api/index.php).
// Eingelesen wird immer die Gesamtliste jeder Strecke, damit sowohl
// Vereinsstarter (jede Schreibweise aus Name/Kuerzel/Aliasen) als auch bekannte
// Athleten mit fremdem Verein (→ externes Ergebnis) gefunden werden.
// Eine raceId in der URL beschraenkt den Import auf diese Strecke.

var ENDU_URL_RE = /^https?:\/\/(www\.)?endu\.net\//i;

// Vereinsangabe → eigener Verein? Wie istEigenerVerein() in der API (Name,
// Kuerzel, Aliase), aber unempfindlich gegen Satzzeichen und Leerraum:
// "TURN-UND SPORTEVEREIN OEDT 1884 E. V." == "Turn- und Sporteverein Oedt 1884 e.V."
function enduIstEigenerVerein(verein) {
  function norm(s) {
    return normalizeUmlauts(String(s || '')).toLowerCase().replace(/[^a-z0-9]+/g, '');
  }
  var v = norm(verein);
  if (!v) return false;
  var namen = [appConfig.verein_name, appConfig.verein_kuerzel]
    .concat(String(appConfig.verein_aliase || '').split(/[,;\n]+/));
  return namen.some(function(n) { var x = norm(n); return x.length >= 3 && x === v; });
}

// Streckenname (italienisch/englisch) → Disziplin-Hinweis fuer mfsFindDisz()
function enduDiszHint(name) {
  var t = String(name || '');
  if (/mezza\s*maratona|half\s*marathon|halb\s*marathon|21[,.]0?9?7?\s*k/i.test(t)) return 'Halbmarathon';
  if (/maratona|marathon/i.test(t)) return 'Marathon';
  var km = t.match(/(\d{1,3}(?:[,.]\d{1,3})?)\s*k(?:m)?\b/i);
  if (km) return km[1].replace(',', '.').replace(/\.0+$/, '') + ' km';
  var me = t.match(/\b(\d{3,5})\s*m\b/i);
  if (me) return me[1] + ' m';
  return null;
}

// Italienische Kategorie (ASSF, SM40, SF35, …) → DLV-AK. FOREIGN o.ae. → ''
function enduAk(kat, geschlecht) {
  var s = String(kat || '').trim().toUpperCase();
  var g = /^[FW]/.test(geschlecht || '') ? 'W' : 'M';
  if (/^(ASS|SEN|PRO|JUN)[MF]?$/.test(s)) return g + 'HK';
  var m = s.match(/^S?([MF])(\d{2})$/);
  if (m) return (m[1] === 'F' ? 'W' : 'M') + m[2];
  return '';
}

function enduName(vor, nach) {
  function tc(s) {
    return String(s || '').toLowerCase().replace(/(^|[\s\-'])(\S)/g, function(_, p, c) { return p + c.toUpperCase(); });
  }
  return (tc(vor) + ' ' + tc(nach)).replace(/\s+/g, ' ').trim();
}

// "01:54:11" → "1:54:11", "00:38:05" → "38:05"
function enduZeit(z) {
  var s = String(z || '').trim();
  if (!/^\d{1,2}:\d{2}(:\d{2})?([.,]\d+)?$/.test(s)) return '';
  var p = s.split(':');
  if (p.length === 3 && +p[0] === 0) return String(+p[1]) + ':' + p[2];
  if (p.length === 3) return String(+p[0]) + ':' + p[1] + ':' + p[2];
  return s;
}

async function bulkImportFromEndu(url, kat, statusEl) {
  if (statusEl) statusEl.textContent = '⏳ Lade ENDU-Ergebnisse…';
  _bkDbgHeader('endu.net');
  var r = await apiGet('endu-fetch?url=' + encodeURIComponent(url));
  if (!r || !r.ok) {
    var fehler = (r && (r.fehler || r.error || r.message)) || 'Abruf fehlgeschlagen';
    _bkDbgLine('Fehler', fehler);
    _bkDbgFlush();
    if (statusEl) statusEl.textContent = '❌ ' + fehler;
    return;
  }
  var d = r.data || {};
  _bkDbgLine('Veranstaltung', d.name || '–');
  _bkDbgLine('Datum / Ort', (d.datum || '?') + ' / ' + (d.ort || '?') + (d.land ? ' (' + d.land + ')' : ''));

  if (d.name) {
    var evnEl = document.getElementById('bk-evname');
    if (evnEl && !evnEl.value) evnEl.value = _cleanEventName(d.name);
    var serie = _bkMatchSerie(d.name);
    if (serie) {
      bkSerieSetById(serie.id);
      _bkDbgLine('Serie', serie.name + ' (auto-erkannt)');
    }
  }
  if (d.datum) {
    var datEl = document.getElementById('bk-datum');
    if (datEl) { datEl.value = d.datum; bkSyncDatum(d.datum); }
  }
  if (d.ort && !((document.getElementById('bk-ort') || {}).value)) _bkAutoSetOrt(d.ort);

  var evJahr = parseInt(String(d.datum || '').slice(0, 4), 10) || new Date().getFullYear();
  var athleten = state.athleten || [];
  var alle = [], eigene = 0, extern = [], fremdVereine = {};

  (d.strecken || []).forEach(function(s) {
    var hint = enduDiszHint(s.name);
    var dz = mfsFindDisz(hint, kat);
    _bkDbgLine('Strecke', s.name + ' – ' + s.zeilen.length + ' Zeilen → ' + (dz.disz || hint || '?'));
    s.zeilen.forEach(function(z) {
      var name = enduName(z.vorname, z.nachname);
      if (!name) return;
      var eigen = enduIstEigenerVerein(z.verein);
      if (!eigen) {
        // Bekannter Athlet fuer anderen/keinen Verein → externes Ergebnis,
        // aber nur wenn der Jahrgang passt (haeufige Namen)
        var id = uitsAutoMatch(name, athleten);
        if (!id) {
          if (/oedt|tus/i.test(z.verein)) fremdVereine[z.verein] = (fremdVereine[z.verein] || 0) + 1;
          return;
        }
        var a = athleten.find(function(x) { return String(x.id) === String(id); });
        if (a && a.geburtsjahr && z.jahrgang && String(a.geburtsjahr) !== String(z.jahrgang)) return;
        extern.push(name + ' [' + (z.verein || 'ohne Verein') + ']');
      } else eigene++;

      var zeit = enduZeit(z.netto) || enduZeit(z.brutto);
      if (!zeit) { _bkDbgLine('Ohne Zeit', name + ' – übersprungen'); return; }
      var geschlecht = z.geschlecht === 'F' ? 'W' : (z.geschlecht === 'M' ? 'M' : '');
      var ak = z.jahrgang && geschlecht ? calcDlvAK(parseInt(z.jahrgang, 10), geschlecht, evJahr) : '';
      var akIt = enduAk(z.kategorie, geschlecht);
      if (!ak) ak = akIt;
      // AK-Platz nur uebernehmen, wenn die italienische Kategorie der DLV-AK entspricht
      var platz = (akIt && akIt === ak && /^\d+$/.test(z.platzAk)) ? parseInt(z.platzAk, 10) : '';
      alle.push({
        name: name, year: z.jahrgang || '', geschlecht: geschlecht,
        resultat: zeit, ak: ak, platz: platz,
        disziplin: dz.disz || hint || '', diszMid: dz.diszMid,
        extern: !eigen, verein: eigen ? '' : z.verein,
        startnummer: /^\d{1,7}$/.test(z.startnr) ? z.startnr : null,
        posGesamt: /^\d{1,6}$/.test(z.platz) ? parseInt(z.platz, 10) : null
      });
    });
  });

  _bkDbgLine('Vereinstreffer', eigene);
  if (extern.length) {
    _bkDbgLine('Extern-Treffer', extern.length + ' (bekannte Athleten für anderen Verein)');
    extern.forEach(function(x) { _bkDbgLine('  ', x); });
  }
  var fv = Object.keys(fremdVereine);
  if (fv.length) _bkDbgLine('Nicht erkannte Vereine', fv.join(', ') + ' – ggf. unter Einstellungen → Weitere Schreibweisen eintragen');
  _bkDbgFlush();

  if (!alle.length) {
    if (statusEl) statusEl.textContent = '❌ Keine Vereinsathleten gefunden – Debug-Log prüfen';
    return;
  }
  await bulkFillFromImport(alle, statusEl);
  bkRenderUnknownDisz(bkCollectUnknownDisz(), kat);
}
