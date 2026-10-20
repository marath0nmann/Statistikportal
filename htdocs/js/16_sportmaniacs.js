// ── Sportmaniacs (sportmaniacs.com, Spanien) ─────────────────────────────────
//
// Veranstaltungsseiten wie
//   https://sportmaniacs.com/es/races/tui-palma-marathon-mallorca-2026
//   https://sportmaniacs.com/es/races/<slug>/<eventId>/rankings   (nur diese Strecke)
// Die Daten liefert die JSON-API api-aws.sportmaniacs.com (CORS offen → Abruf
// direkt im Browser):
//   races/<slug>                 → Veranstaltung (id, name, date, city)
//   events?race=<raceId>         → Strecken (name, distanceInMeters)
//   rankings?event=<id>&page=N   → Gesamtliste, 25 je Seite (totalPages), mit Verein
//   athletes?event=<id>&dorsal=D → Einzelergebnis: Geschlecht, Kategorie, Netto-Zeit, AK-Platz
// Die Liste wird komplett geladen, damit Vereinsstarter (jede Schreibweise) und
// bekannte Athleten mit fremdem Verein (→ externes Ergebnis) gefunden werden;
// Details werden nur fuer diese Treffer nachgeladen.

var SPM_URL_RE = /^https?:\/\/(www\.)?sportmaniacs\.com\//i;
var SPM_API = 'https://api-aws.sportmaniacs.com/api/';

// GET mit Wiederholung: die API laesst einzelne Anfragen gelegentlich haengen.
// Liefert data-Feld samt totalPages oder null (auch bei status "ko" = kein Treffer).
async function spmGet(pfad) {
  for (var versuch = 0; versuch < 3; versuch++) {
    try {
      var ctrl = new AbortController();
      var timer = setTimeout(function() { ctrl.abort(); }, 15000);
      var r = await fetch(SPM_API + pfad, { signal: ctrl.signal });
      clearTimeout(timer);
      if (r.status === 404) return null;
      if (r.ok) {
        var j = await r.json();
        return j && j.status === 'ok' ? j : null;
      }
    } catch(e) {}
    await new Promise(function(res) { setTimeout(res, 800 * (versuch + 1)); });
  }
  throw new Error('Sportmaniacs antwortet nicht (' + pfad.split('?')[0] + ')');
}

// Fuehrt fn(item) fuer alle items mit hoechstens n gleichzeitigen Anfragen aus
async function spmPool(items, n, fn) {
  var i = 0;
  async function worker() { while (i < items.length) { var k = i++; await fn(items[k], k); } }
  var ws = [];
  for (var w = 0; w < Math.min(n, items.length); w++) ws.push(worker());
  await Promise.all(ws);
}

// Strecke → Disziplin-Hinweis fuer mfsFindDisz(): erst ueber die Laenge, sonst der Name
function spmDiszHint(ev) {
  var m = parseInt(ev.distanceInMeters, 10);
  if (m >= 42150 && m <= 42250) return 'Marathon';
  if (m >= 21050 && m <= 21150) return 'Halbmarathon';
  var hint = enduDiszHint(ev.name) || enduDiszHint(ev.distance);
  if (hint) return hint;
  if (m >= 1000 && m % 100 === 0) return String(m / 1000) + ' km';
  return m > 0 ? m + ' m' : null;
}

// Spanische Kategorie (M35, F SEN, M SUB 23, …) → DLV-AK, sonst ''
function spmAk(kat, geschlecht) {
  var s = String(kat || '').toUpperCase().replace(/\s+/g, ' ').trim();
  var g = geschlecht || (/^F/.test(s) ? 'W' : 'M');
  var ak = '';
  var m = s.match(/^[MFHW]\s?(\d{2})$/);
  if (m) ak = g + m[1];
  else if (/\bSEN(IOR)?\b|\bABS(OLUTA?)?\b/.test(s)) ak = g + 'HK';
  else if ((m = s.match(/\b(?:SUB|U)\s?(\d{2})\b/))) ak = g + 'U' + m[1];
  return isValidDlvAK(ak) ? ak : '';
}

function spmGeschlecht(gender, kat) {
  var s = String(gender || '').toLowerCase();
  if (/^(fem|muj|wom|f$)/.test(s)) return 'W';
  if (/^(mas|hom|male|m$)/.test(s)) return 'M';
  if (/^F/i.test(kat || '')) return 'W';
  if (/^M/i.test(kat || '')) return 'M';
  return '';
}

async function bulkImportFromSportmaniacs(url, kat, statusEl) {
  _bkDbgHeader('sportmaniacs.com');
  var pm = url.match(/\/races\/([^\/?#]+)(?:\/([0-9a-f]{8}-[0-9a-f-]{27}))?/i);
  if (!pm) {
    if (statusEl) statusEl.textContent = '❌ Keine Sportmaniacs-Veranstaltung in der URL (…/races/<name>)';
    return;
  }
  if (statusEl) statusEl.textContent = '⏳ Lade Sportmaniacs-Veranstaltung…';
  var race = ((await spmGet('races/' + encodeURIComponent(pm[1]))) || {}).data;
  if (!race || !race.id) {
    _bkDbgLine('Fehler', 'Veranstaltung „' + pm[1] + '“ nicht gefunden');
    _bkDbgFlush();
    if (statusEl) statusEl.textContent = '❌ Veranstaltung bei Sportmaniacs nicht gefunden';
    return;
  }
  var datum = race.end_date || race.date || '';
  _bkDbgLine('Veranstaltung', race.name || '–');
  _bkDbgLine('Datum / Ort', (datum || '?') + ' / ' + (race.city || '?') + (race.country ? ' (' + race.country + ')' : ''));

  if (race.name) {
    var evnEl = document.getElementById('bk-evname');
    if (evnEl && !evnEl.value) evnEl.value = _cleanEventName(race.name);
    var serie = _bkMatchSerie(race.name);
    if (serie) {
      bkSerieSetById(serie.id);
      _bkDbgLine('Serie', serie.name + ' (auto-erkannt)');
    }
  }
  if (datum) {
    var datEl = document.getElementById('bk-datum');
    if (datEl) { datEl.value = datum; bkSyncDatum(datum); }
  }
  if (race.city && !((document.getElementById('bk-ort') || {}).value)) _bkAutoSetOrt(race.city);

  var events = ((await spmGet('events?race=' + race.id)) || {}).data || [];
  if (pm[2]) events = events.filter(function(e) { return e.id === pm[2]; });
  events = events.filter(function(e) { return e.ranking !== false; });
  if (!events.length) {
    _bkDbgLine('Fehler', 'Keine Strecken mit Ergebnisliste');
    _bkDbgFlush();
    if (statusEl) statusEl.textContent = '❌ Keine Ergebnislisten gefunden';
    return;
  }

  var athleten = state.athleten || [];
  var treffer = [], eigene = 0, extern = [], fremdVereine = {};

  for (var ei = 0; ei < events.length; ei++) {
    var ev = events[ei];
    var hint = spmDiszHint(ev);
    var dz = mfsFindDisz(hint, kat);
    var label = (ev.name || 'Strecke') + ' (' + (ei + 1) + '/' + events.length + ')';
    if (statusEl) statusEl.textContent = '⏳ ' + label + ': Seite 1…';
    var first = await spmGet('rankings?event=' + ev.id);
    var seiten = first ? (parseInt(first.totalPages, 10) || 1) : 0;
    var zeilen = first ? (first.data || []).slice() : [];
    var geladen = 1, rest = [];
    for (var p = 2; p <= seiten; p++) rest.push(p);
    await spmPool(rest, 4, async function(seite) {
      var r = await spmGet('rankings?event=' + ev.id + '&page=' + seite);
      if (r && r.data) zeilen = zeilen.concat(r.data);
      geladen++;
      if (statusEl) statusEl.textContent = '⏳ ' + label + ': Seite ' + geladen + '/' + seiten + '…';
    });
    _bkDbgLine('Strecke', (ev.name || '?') + ' – ' + zeilen.length + ' Zeilen → ' + (dz.disz || hint || '?'));

    zeilen.forEach(function(z) {
      var name = enduName(z.name, '');
      if (!name || !z.dorsal) return;
      var eigen = enduIstEigenerVerein(z.club);
      if (!eigen) {
        // Bekannter Athlet fuer anderen/keinen Verein → externes Ergebnis
        if (!uitsAutoMatch(name, athleten)) {
          // Nur "Oedt": "TuS" allein trifft hier Dutzende fremde deutsche Vereine
          if (/oedt/i.test(z.club || '')) fremdVereine[z.club] = (fremdVereine[z.club] || 0) + 1;
          return;
        }
        extern.push(name + ' [' + (z.club || 'ohne Verein') + ']');
      } else eigene++;
      treffer.push({ z: z, ev: ev, name: name, eigen: eigen, hint: hint, dz: dz });
    });
  }

  // Details (Geschlecht, Kategorie, Netto-Zeit, AK-Platz) nur fuer die Treffer
  var alle = [];
  if (treffer.length && statusEl) statusEl.textContent = '⏳ Lade ' + treffer.length + ' Einzelergebnisse…';
  await spmPool(treffer, 4, async function(t) {
    var det = null;
    try { det = ((await spmGet('athletes?event=' + t.ev.id + '&dorsal=' + encodeURIComponent(t.z.dorsal))) || {}).data; }
    catch(e) { _bkDbgLine('Details fehlen', t.name + ' – ' + e.message); }
    var meta = (det && det.Meta) || {};
    var katName = det && det.Category ? det.Category.name : '';
    var zeit = enduZeit(meta.splitTimeNet) || enduZeit(meta.splitTime) || enduZeit(t.z.officialTime);
    if (!zeit) { _bkDbgLine('Ohne Zeit', t.name + ' – übersprungen'); return; }
    var geschlecht = spmGeschlecht(det && det.gender, katName);
    var ak = spmAk(katName, geschlecht);
    var akPlatz = String(meta.categoryPosition || '');
    var gesamt = String(meta.overallPosition || t.z.pos || '');
    alle.push({
      name: t.name, year: '', geschlecht: geschlecht,
      resultat: zeit, ak: ak, platz: ak && /^[1-9]\d{0,5}$/.test(akPlatz) ? parseInt(akPlatz, 10) : '',
      disziplin: t.dz.disz || t.hint || '', diszMid: t.dz.diszMid,
      extern: !t.eigen, verein: t.eigen ? '' : (t.z.club || ''),
      startnummer: /^\d{1,7}$/.test(t.z.dorsal) ? t.z.dorsal : null,
      posGesamt: /^[1-9]\d{0,5}$/.test(gesamt) ? parseInt(gesamt, 10) : null
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
