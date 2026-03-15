// ============================================================
// TuS Oedt Leichtathletik-Statistik – Frontend
// ============================================================

const API = 'api/index.php';
let currentUser = null;
let state = {
  tab: 'dashboard', subTab: 'strasse',
  page: 1, limit: 100,
  veranstPage: 1,
  filters: {}, sortCol: null, sortDir: 'asc',
  diszFilter: null,
  allDisziplinen: null,
  rekState: { kat: 'strasse', disz: null, view: 'gesamt' },
  data: {}, athleten: [], disziplinen: [], filterOptions: {},
};

// ── API ────────────────────────────────────────────────────

/* ── 01_api.js ── */
async function api(method, path, body) {
  const opts = {
    method: method,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const parts = path.split('?');
  const route = parts[0];
  const qs    = parts[1] ? '&' + parts[1] : '';
  const url   = API + '?_route=' + encodeURIComponent(route) + qs;
  try {
    const r    = await fetch(url, opts);
    const text = await r.text();
    if (!r.ok && !text) {
      return { ok: false, fehler: 'HTTP ' + r.status };
    }
    try { return JSON.parse(text); }
    catch(e) {
      console.error('Kein JSON von:', url, text.slice(0,200));
      return { ok: false, fehler: 'Server-Fehler: ' + text.slice(0,150) };
    }
  } catch(e) {
    console.error('Fetch-Fehler:', url, e.message);
    return { ok: false, fehler: 'Verbindungsfehler: ' + e.message };
  }
}
function apiGet(path)        { return api('GET',    path); }
function apiPost(path, body) { return api('POST',   path, body); }
function apiPut(path, body)  { return api('PUT',    path, body); }
function apiDel(path)        { return api('DELETE', path); }

async function apiUpload(path, formData) {
  var url = API + '?_route=' + encodeURIComponent(path);
  try {
    var r    = await fetch(url, { method: 'POST', body: formData });
    var text = await r.text();
    try { return JSON.parse(text); }
    catch(e) { return { ok: false, fehler: 'Server-Fehler: ' + text.slice(0,150) }; }
  } catch(e) {
    return { ok: false, fehler: 'Verbindungsfehler: ' + e.message };
  }
}

// ── INIT ───────────────────────────────────────────────────

/* ── 02_app.js ── */
// ── KONFIGURATION ───────────────────────────────────────────
var appConfig = {};

function applyVersionVisibility() {
  var el = document.getElementById('header-version');
  if (!el) return;
  var nurAdmins = (appConfig.version_nur_admins === '1' || appConfig.version_nur_admins === 1);
  var isAdmin   = currentUser && currentUser.rolle === 'admin';
  el.style.display = (nurAdmins && !isAdmin) ? 'none' : '';
}

// ── FARBBERECHNUNG ─────────────────────────────────────────
// Hex → {r,g,b}
function _hexToRgb(hex) {
  hex = hex.replace(/^#/, '');
  if (hex.length === 3) hex = hex.split('').map(function(c){ return c+c; }).join('');
  var n = parseInt(hex, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
// {r,g,b} → hex
function _rgbToHex(r, g, b) {
  return '#' + [r,g,b].map(function(v){
    return Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0');
  }).join('');
}
// Farbe aufhellen (factor 0–1, 1 = weiß)
function _lighten(hex, factor) {
  var c = _hexToRgb(hex);
  return _rgbToHex(c.r+(255-c.r)*factor, c.g+(255-c.g)*factor, c.b+(255-c.b)*factor);
}
// Farbe abdunkeln (factor 0–1, 1 = schwarz)
function _darken(hex, factor) {
  var c = _hexToRgb(hex);
  return _rgbToHex(c.r*(1-factor), c.g*(1-factor), c.b*(1-factor));
}

// Relative Luminanz nach WCAG 2.1
function _luminance(hex) {
  var c = _hexToRgb(hex);
  return [c.r, c.g, c.b].reduce(function(lum, v, i) {
    var s = v / 255;
    s = s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    return lum + s * [0.2126, 0.7152, 0.0722][i];
  }, 0);
}
// Gibt '#111111' oder '#ffffff' zurück je nach Kontrast zur Hintergrundfarbe
// Meisterschafts-Lookup: wird aus Einstellungen befüllt
// Avatar-Rendering: gibt <img> oder Initialen-Div zurück
function avatarHtml(avatarPfad, name, size, fontSize) {
  size = size || 28; fontSize = fontSize || Math.round(size * 0.45);
  var initial = (name || '?')[0].toUpperCase();
  if (avatarPfad) {
    return '<span style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;flex-shrink:0;overflow:hidden;display:inline-flex;align-items:center;justify-content:center;">' +
      '<img src="' + avatarPfad + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.style.display=&quot;none&quot;;this.parentNode.style.background=&quot;var(--accent)&quot;">' +
      '</span>';
  }
  return avatarFallback(initial, size, fontSize);
}
function nameInitials(name) {
  if (!name) return '?';
  var parts = name.trim().split(/[\s,]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0][0].toUpperCase();
}

function avatarFallback(initial, size, fontSize) {
  var fs = fontSize || Math.round((size || 28) * 0.38);
  return '<span style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;flex-shrink:0;background:var(--accent);color:var(--on-accent);display:inline-flex;align-items:center;justify-content:center;font-family:Barlow Condensed,sans-serif;font-size:' + fs + 'px;font-weight:600;">' + initial + '</span>';
}

var FOOTER_DEFAULT_DS  = "# Datenschutzerkl\u00e4rung\n\n**Stand: 2026**\n\n## 1. Verantwortlicher\nVerantwortlich f\u00fcr diese Anwendung ist der Verein TuS Oedt e.V.\n\n## 2. Erhobene Daten\nDiese Anwendung verarbeitet ausschlie\u00dflich Daten, die zur Darstellung von Leichtathletik-Ergebnissen und Vereinsstatistiken erforderlich sind:\n- Athleten-Namen und Wettkampfergebnisse (\u00f6ffentlich zug\u00e4nglich)\n- Benutzerdaten registrierter Nutzer (Name, E-Mail-Adresse) zur Authentifizierung\n\n## 3. Keine Weitergabe an Dritte\nPersonenbezogene Daten werden nicht an Dritte weitergegeben.\n\n## 4. Hosting\nDie Anwendung wird auf Servern von all-inkl.com (ALL-INKL.COM \u2013 Neue Medien M\u00fcnnich) in Deutschland betrieben.\n\n## 5. Kontakt\nBei Fragen zur Datenverarbeitung wenden Sie sich bitte an die Vereinsverantwortlichen.";
var FOOTER_DEFAULT_NU  = "# Nutzungsbedingungen\n\n**Stand: 2026**\n\n## 1. Nutzung\nDiese Anwendung dient der internen Vereinsstatistik des TuS Oedt e.V. Die Nutzung ist Vereinsmitgliedern und autorisierten Personen vorbehalten.\n\n## 2. Inhalte\nDie dargestellten Ergebnisse und Athletendaten sind vereinseigene Daten. Eine Weiterverwendung oder Ver\u00f6ffentlichung bedarf der Genehmigung des Vereins.\n\n## 3. Technische Verf\u00fcgbarkeit\nDer Betreiber \u00fcbernimmt keine Gew\u00e4hr f\u00fcr die st\u00e4ndige Verf\u00fcgbarkeit der Anwendung.\n\n## 4. \u00c4nderungen\nDiese Nutzungsbedingungen k\u00f6nnen jederzeit angepasst werden.";
var FOOTER_DEFAULT_IMP = "# Impressum\n\n**Angaben gem\u00e4\u00df \u00a7 5 TMG**\n\nTuS Oedt e.V. \u2013 Leichtathletik-Abteilung\n\n*Bitte vervollst\u00e4ndigen Sie das Impressum mit Ihrer Vereinsanschrift und einem Verantwortlichen.*\n\n## Kontakt\nE-Mail: [Ihre E-Mail-Adresse]\n\n## Vereinsregister\nEingetragen im Vereinsregister.\nRegistergericht: [Ihr Registergericht]\n\n## Inhaltlich Verantwortlicher\n[Name des Verantwortlichen gem\u00e4\u00df \u00a7 55 Abs. 2 RStV]";

// Kategorie-Suffix: ob "(Bahn)" etc. hinter Disziplinname angezeigt wird
// Wird aus appConfig.disziplin_kategorie_suffix gelesen (Standard: '1')
function diszMitKat(disziplin, mappingId) {
  var list = state.disziplinen || [];
  // Wenn mapping_id bekannt: exakten Eintrag suchen
  if (mappingId) {
    for (var _j = 0; _j < list.length; _j++) {
      if (list[_j].disziplin === disziplin && list[_j].id == mappingId) {
        var e2 = list[_j];
        var ov2 = e2.kat_suffix_override || '';
        var show2 = ov2 === 'ja' ? true : ov2 === 'nein' ? false : (appConfig.disziplin_kategorie_suffix || '1') === '1';
        return show2 && e2.kategorie ? disziplin + ' <span style="font-size:0.85em;opacity:0.6">(' + e2.kategorie + ')</span>' : disziplin;
      }
    }
  }
  // Ohne mapping_id: nur anzeigen wenn Disziplinname eindeutig
  var matches = list.filter(function(x) { return x.disziplin === disziplin; });
  if (matches.length !== 1) return disziplin; // mehrdeutig → kein Suffix
  var entry = matches[0];
  var override = entry.kat_suffix_override || '';
  var showSuffix = override === 'ja' ? true : override === 'nein' ? false : (appConfig.disziplin_kategorie_suffix || '1') === '1';
  return showSuffix && entry.kategorie ? disziplin + ' <span style="font-size:0.85em;opacity:0.6">(' + entry.kategorie + ')</span>' : disziplin;
}

// Disziplin-Name sortierbar machen: "5.000m" → 5000, "10km" → 10000
function diszSortKey(s) {
  var n = (s || '').replace(/\.(?=\d{3}(?:\D|$))/g, '');
  var m = n.match(/^([\d]+(?:[.,]\d+)?)\s*(km|m)/i);
  if (m) {
    var num = parseFloat(m[1].replace(',', '.'));
    return m[2].toLowerCase() === 'km' ? num * 1000 : num;
  }
  return Infinity;
}

function sortDisziplinen(arr, key) {
  key = key || 'disziplin';
  arr.sort(function(a, b) {
    var ka = diszSortKey(typeof a === 'string' ? a : a[key]);
    var kb = diszSortKey(typeof b === 'string' ? b : b[key]);
    if (ka !== kb) return ka - kb;
    var sa = typeof a === 'string' ? a : (a[key] || '');
    var sb = typeof b === 'string' ? b : (b[key] || '');
    return sa.localeCompare(sb, 'de');
  });
  return arr;
}

// Eindeutiger Gruppenkey für ein Ergebnis: mapping_id wenn vorhanden, sonst disziplin-Name
function ergDiszKey(e) {
  return e.disziplin_mapping_id ? 'm' + e.disziplin_mapping_id : 'd_' + e.disziplin;
}
// Anzeigename für einen Gruppenkey aus einem Ergebnis-Objekt
function ergDiszLabel(e) {
  if (e.kategorie_name) {
    var showSuffix;
    var disz = e.disziplin;
    // Per-Disziplin-Override aus state.disziplinen prüfen
    var list = state.disziplinen || [];
    var override = '';
    for (var _i = 0; _i < list.length; _i++) {
      if (list[_i].disziplin === disz && e.disziplin_mapping_id && list[_i].id == e.disziplin_mapping_id) {
        override = list[_i].kat_suffix_override || ''; break;
      }
    }
    if (override === 'ja') showSuffix = true;
    else if (override === 'nein') showSuffix = false;
    else showSuffix = (appConfig.disziplin_kategorie_suffix || '1') === '1';
    if (showSuffix) return disz + ' <span style="font-size:0.85em;opacity:0.6">(' + e.kategorie_name + ')</span>';
  }
  return e.disziplin;
}

var MSTR_MAP = {};
var MSTR_LIST = []; // [{id, label}, ...]

function mstrLoadFromConfig(cfg) {
  var raw = cfg && cfg.meisterschaften_liste;
  if (!raw) return;
  try {
    var list = JSON.parse(raw);
    MSTR_MAP = {};
    MSTR_LIST = list;
    for (var i = 0; i < list.length; i++) {
      MSTR_MAP[parseInt(list[i].id, 10)] = list[i].label;
    }
  } catch(e) {}
}
function mstrLabel(val) {
  var n = parseInt(val, 10);
  return MSTR_MAP[n] || ('MS ' + val);
}
function medalBadge(n) {
  if (!n) return '';
  n = parseInt(n, 10);
  var cls = n === 1 ? 'gold' : n === 2 ? 'silver' : n === 3 ? 'bronze' : 'rank';
  return '<span class="medal-badge ' + cls + '">' + n + '</span>';
}
// Alias für AK-Platzierungen
function platzBadge(platz) { return medalBadge(platz); }

function mstrBadge(val) {
  if (!val) return '';
  return '<span class="badge badge-ms">' + mstrLabel(val) + '</span>';
}
// Optionen für Select-Felder
function mstrOptions(selected) {
  var html = '<option value="">– keine –</option>';
  for (var i = 0; i < MSTR_LIST.length; i++) {
    var m = MSTR_LIST[i];
    html += '<option value="' + m.id + '"' + (selected == m.id ? ' selected' : '') + '>' + m.label + '</option>';
  }
  return html;
}

function _onColor(bgHex) {
  var lum = _luminance(bgHex);
  // Kontrastverhältnis gegen Weiß vs. Schwarz – WCAG empfiehlt ≥ 4.5:1
  var contrastWhite = (1 + 0.05) / (lum + 0.05);
  var contrastBlack = (lum + 0.05) / (0 + 0.05);
  return contrastWhite >= contrastBlack ? '#ffffff' : '#111111';
}

function _updateBodyThemeColor() {
  var pref = (window.appConfig && window.appConfig.adressleiste_farbe) || 'aus';
  var metaTheme = document.getElementById('meta-theme-color');
  if (pref === 'aus') {
    // Inline-Style entfernen → CSS-Hintergrund (--bg) greift wieder
    document.body.style.removeProperty('background-color');
    if (metaTheme) metaTheme.removeAttribute('content');
    return;
  }
  var style = getComputedStyle(document.documentElement);
  var isDark = document.documentElement.getAttribute('data-theme') === 'dark' ||
               (!document.documentElement.getAttribute('data-theme') &&
                window.matchMedia('(prefers-color-scheme: dark)').matches);
  var color;
  if (pref === 'primary') {
    color = isDark
      ? style.getPropertyValue('--primary-dark').trim()
      : style.getPropertyValue('--primary3').trim();
  } else if (pref === 'accent') {
    color = style.getPropertyValue('--accent').trim();
  }
  if (!color) return;
  document.body.style.backgroundColor = color;
  if (metaTheme) metaTheme.setAttribute('content', color);
}

function applyConfig(cfg) {
  appConfig = cfg || {};

  // ── CSS-Farben setzen – abgeleitete Farben berechnen ──
  var root = document.documentElement;
  var p  = cfg.farbe_primary || '#cc0000';
  var a  = cfg.farbe_accent  || '#003087';
  var p2 = _lighten(p, 0.12);
  var p3 = _lighten(p, 0.28);
  var a2 = _lighten(a, 0.18);
  // Dunkle Variante für Dark-Mode-Header-Gradient
  var pDark  = _darken(p, 0.35);
  // Helle Varianten für Ergebnis-Texte im Dark Mode
  var pLight = _lighten(p, 0.45);
  var aLight = _lighten(a, 0.45);
  // RGB-Werte für rgba()-Nutzung in Hover-Effekten
  var aRgb = _hexToRgb(a);
  var aRgbStr = aRgb ? aRgb.r + ',' + aRgb.g + ',' + aRgb.b : '0,48,135';

  root.style.setProperty('--primary',      p);
  root.style.setProperty('--primary2',     p2);
  root.style.setProperty('--primary3',     p3);
  root.style.setProperty('--primary-dark', pDark);
  root.style.setProperty('--primary-light',pLight);
  root.style.setProperty('--accent',       a);
  root.style.setProperty('--accent2',      a2);
  root.style.setProperty('--accent-light', aLight);
  root.style.setProperty('--accent-rgb',   aRgbStr);
  root.style.setProperty('--btn-bg',       a);
  root.style.setProperty('--btn-bg2',      a2);
  // Textfarbe auf farbigen Flächen (schwarz oder weiß je nach Kontrast)
  root.style.setProperty('--on-primary', _onColor(p));
  root.style.setProperty('--on-accent',  _onColor(a));
  root.style.setProperty('--on-btn',     _onColor(a));
  // Safari iOS / Chrome Android: Adressleiste in Header-Gradient-Endfarbe
  _updateBodyThemeColor();

  // Meisterschafts-Liste laden
  mstrLoadFromConfig(cfg);

  // ── Texte ──
  var name      = cfg.verein_name    || 'Mein Verein e.V.';
  var kuerzel   = cfg.verein_kuerzel || name;
  var untertitel= cfg.app_untertitel || 'Leichtathletik-Statistik';
  var logoFile  = cfg.logo_datei || '';
  var logoUrl   = logoFile
    ? (logoFile.startsWith('http') ? logoFile : '/' + logoFile)
    : '';

  document.title = name + ' – ' + untertitel;

  // Header
  var elMain = document.querySelector('.logo-main span');
  if (elMain) elMain.textContent = kuerzel;
  var elSub = document.querySelector('.logo-sub span:first-child');
  if (elSub) elSub.textContent = untertitel;

  // Login-Screen
  var elLT = document.querySelector('.login-title');
  if (elLT) elLT.textContent = name;
  var elLS = document.querySelector('.login-sub');
  if (elLS) elLS.textContent = untertitel + ' · Bitte einloggen';

  // Mobile Drawer
  var elMob = document.querySelector('.mobile-nav-logo-text');
  if (elMob) elMob.textContent = kuerzel;
  var elFoot = document.querySelector('.mobile-nav-footer');
  if (elFoot) elFoot.textContent = untertitel;

  // Logos – src immer setzen; bei leer ausblenden, sonst einblenden
  document.querySelectorAll('.logo-img, .login-logo, .mobile-nav-logo img').forEach(function(img) {
    if (logoUrl) {
      img.src = logoUrl;
      img.alt = name;
      img.style.display = '';
    } else {
      img.src = '';
      img.style.display = 'none';
    }
  });
  applyVersionVisibility();
}

async function init() {
  // Setup-Check: Wenn keine Config oder keine Tabellen → Setup-Wizard
  var setupR = await fetch('api/setup.php?action=check').then(r => r.json()).catch(() => null);
  if (setupR && setupR.ok && setupR.data && setupR.data.setup_needed) {
    showSetup(setupR.data);
    return;
  }

  // Erst Config laden (kein Auth nötig), dann User
  var cfgR = await apiGet('einstellungen');
  if (cfgR && cfgR.ok) applyConfig(cfgR.data);

  var r = await apiGet('auth/me');
  if (r && r.ok) {
    currentUser = r.data;
    showApp();
  } else {
    currentUser = null;
    showApp();
  }
}

// ── SETUP-WIZARD ─────────────────────────────────────────────
var _setup = { step: 1, reason: '', hasConfig: false,
               host:'localhost', port:3306, name:'', user:'', pass:'', prefix:'',
               adminPw:'', adminPw2:'',
               vereinName:'Mein Verein e.V.', vereinKuerzel:'Mein Verein', appUntertitel:'Leichtathletik-Statistik',
               farbePrimary:'#cc0000', farbenAccent:'#003087',
               emailDomain:'vy99.de', noreplEmail:'noreply@vy99.de' };

function showSetup(info) {
  _setup.reason    = info.reason    || '';
  _setup.hasConfig = !!info.has_config;
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-screen').style.display   = 'none';
  document.getElementById('setup-screen').style.display = 'flex';
  renderSetup();
}

function renderSetup() {
  var s   = _setup;
  var box = document.getElementById('setup-box');
  if (!box) return;

  // Wenn config existiert, aber nur Tabellen fehlen → direkt anlegen
  if (s.hasConfig && s.reason === 'no_tables') {
    box.innerHTML =
      '<div class="setup-header"><div class="setup-logo">⚙️</div>' +
        '<h2>Datenbanktabellen fehlen</h2>' +
        '<p>Die Konfigurationsdatei ist vorhanden, aber die Datenbanktabellen wurden noch nicht angelegt.</p>' +
      '</div>' +
      '<div class="setup-body">' +
        '<button class="btn btn-primary" style="width:100%" onclick="setupCreateTables()">🗄️ Tabellen jetzt anlegen</button>' +
        '<div id="setup-msg" style="margin-top:12px"></div>' +
      '</div>';
    return;
  }

  var steps = ['Datenbank', 'Prefix & Admin', 'Verein & Darstellung', 'Fertig'];
  var stepBar = '<div class="setup-steps">' +
    steps.map((l,i) =>
      '<div class="setup-step ' + (s.step===i+1?'active':s.step>i+1?'done':'') + '">' +
        '<span class="setup-step-num">' + (s.step>i+1?'✓':i+1) + '</span>' +
        '<span class="setup-step-label">' + l + '</span>' +
      '</div>'
    ).join('<div class="setup-step-line"></div>') +
  '</div>';

  function field(label, id, val, ph, hint) {
    return '<div class="setup-field">' +
      '<label class="setup-label">' + label + '</label>' +
      (hint ? '<div class="setup-field-hint">' + hint + '</div>' : '') +
      '<input class="setup-input" id="' + id + '" value="' + (val||'') + '" placeholder="' + (ph||'') + '">' +
    '</div>';
  }
  function pwField(label, id) {
    return '<div class="setup-field">' +
      '<label class="setup-label">' + label + '</label>' +
      '<input class="setup-input" type="password" id="' + id + '">' +
    '</div>';
  }
  function colorField(label, id, val, hint) {
    return '<div class="setup-field">' +
      '<label class="setup-label">' + label + '</label>' +
      (hint ? '<div class="setup-field-hint">' + hint + '</div>' : '') +
      '<div style="display:flex;gap:8px;align-items:center">' +
        '<input type="color" id="' + id + '-picker" value="' + (val||'#000000') + '" ' +
          'oninput="document.getElementById(\'' + id + '\').value=this.value" ' +
          'style="width:44px;height:36px;padding:2px;border-radius:6px;border:1.5px solid var(--border);cursor:pointer;background:var(--surface)">' +
        '<input class="setup-input" id="' + id + '" value="' + (val||'') + '" placeholder="#rrggbb" ' +
          'oninput="var p=document.getElementById(\'' + id + '-picker\');if(/^#[0-9a-fA-F]{6}$/.test(this.value))p.value=this.value" ' +
          'style="flex:1;font-family:monospace">' +
      '</div>' +
    '</div>';
  }

  var body = '';
  if (s.step === 1) {
    body =
      '<p class="setup-hint">Bitte gib die Datenbank-Zugangsdaten ein. Diese findest du im Verwaltungs-Panel deines Hosters (z.B. KAS bei all-inkl).</p>' +
      field('DB-Host',     'setup-host', s.host, 'localhost') +
      field('DB-Port',     'setup-port', s.port, '3306') +
      field('DB-Name',     'setup-name', s.name, 'p12345_statistik') +
      field('DB-Benutzer', 'setup-user', s.user, 'p12345_statistik') +
      pwField('DB-Passwort', 'setup-pass') +
      '<div id="setup-msg" style="margin-top:12px"></div>' +
      '<div class="setup-btn-row">' +
        '<button class="btn btn-ghost" onclick="setupTestDb()" id="setup-test-btn">🔌 Verbindung testen</button>' +
        '<button class="btn btn-primary" onclick="setupStep2()">Weiter →</button>' +
      '</div>';

  } else if (s.step === 2) {
    body =
      '<p class="setup-hint">Wähle einen Tabellen-Prefix wenn du mehrere Instanzen in einer Datenbank betreiben möchtest (z.B. <code>stat1_</code>). Leer lassen wenn nicht benötigt.</p>' +
      field('Tabellen-Prefix', 'setup-prefix', s.prefix, 'z.B. stat1_ (optional)') +
      '<div class="setup-divider"></div>' +
      '<p class="setup-hint">Lege das Passwort für den <strong>Admin-Account</strong> fest (Benutzername: <code>admin</code>):</p>' +
      pwField('Admin-Passwort (min. 8 Zeichen)', 'setup-adminpw') +
      pwField('Passwort wiederholen', 'setup-adminpw2') +
      '<div id="setup-msg" style="margin-top:12px"></div>' +
      '<div class="setup-btn-row">' +
        '<button class="btn btn-ghost" onclick="_setup.step=1;renderSetup()">← Zurück</button>' +
        '<button class="btn btn-primary" onclick="setupStep3()">Weiter →</button>' +
      '</div>';

  } else if (s.step === 3) {
    body =
      '<p class="setup-hint">Diese Einstellungen können jederzeit im Admin-Bereich geändert werden. Standardwerte sind vorausgefüllt.</p>' +
      '<div class="setup-section-title">🏟️ Verein</div>' +
      field('Vereinsname',       'setup-verein-name',     s.vereinName,      'z.B. TuS Oedt 1953 e.V.') +
      field('Kurzbezeichnung',   'setup-verein-kuerzel',  s.vereinKuerzel,   'z.B. TuS Oedt', 'Wird im Header angezeigt') +
      field('App-Untertitel',    'setup-app-untertitel',  s.appUntertitel,   'z.B. Leichtathletik-Statistik') +
      '<div class="setup-divider"></div>' +
      '<div class="setup-section-title">🎨 Vereinsfarben</div>' +
      colorField('Hauptfarbe',  'setup-farbe-primary', s.farbePrimary, 'Header-Hintergrund, Buttons, Badges') +
      colorField('Akzentfarbe', 'setup-farbe-accent',  s.farbenAccent, 'Navigation, sekundäre Elemente') +
      '<div class="setup-divider"></div>' +
      '<div class="setup-section-title">📧 E-Mail & Registrierung</div>' +
      field('Zugelassene E-Mail-Domain', 'setup-email-domain',  s.emailDomain,  'z.B. meinverein.de', 'Nur Adressen dieser Domain dürfen sich registrieren') +
      field('Absender-E-Mail',           'setup-noreply-email', s.noreplEmail,  'z.B. noreply@meinverein.de') +
      '<div id="setup-msg" style="margin-top:12px"></div>' +
      '<div class="setup-btn-row">' +
        '<button class="btn btn-ghost" onclick="_setup.step=2;renderSetup()">← Zurück</button>' +
        '<button class="btn btn-primary" onclick="setupInstall()">🚀 Installation starten</button>' +
      '</div>';

  } else if (s.step === 4) {
    body =
      '<div style="text-align:center;padding:24px 0">' +
        '<div style="font-size:56px;margin-bottom:12px">✅</div>' +
        '<h3 style="margin:0 0 8px">Installation abgeschlossen!</h3>' +
        '<p>Datenbank, Tabellen und Grundkonfiguration wurden eingerichtet.</p>' +
        '<p>Melde dich jetzt mit dem Benutzer <strong>admin</strong> und dem gewählten Passwort an.</p>' +
        '<button class="btn btn-primary" style="margin-top:16px" onclick="location.reload()">Zur Anwendung →</button>' +
      '</div>';
  }

  box.innerHTML =
    '<div class="setup-header">' +
      '<div class="setup-logo">⚙️</div>' +
      '<h2>Ersteinrichtung</h2>' +
    '</div>' +
    stepBar +
    '<div class="setup-body">' + body + '</div>';
}

function setupMsg(msg, type) {
  var el = document.getElementById('setup-msg');
  if (!el) return;
  el.innerHTML = '<div class="notify notify-' + (type||'err') + '" style="position:static;transform:none;margin:0">' + msg + '</div>';
}

async function setupTestDb() {
  var btn = document.getElementById('setup-test-btn');
  if (btn) btn.disabled = true;
  var r = await fetch('api/setup.php', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ action:'test_db',
      db_host: document.getElementById('setup-host').value,
      db_port: +document.getElementById('setup-port').value,
      db_name: document.getElementById('setup-name').value,
      db_user: document.getElementById('setup-user').value,
      db_pass: document.getElementById('setup-pass').value,
    })
  }).then(r=>r.json()).catch(()=>null);
  if (btn) btn.disabled = false;
  if (r && r.ok) setupMsg('✓ Verbindung erfolgreich!', 'ok');
  else setupMsg(r ? r.fehler : 'Netzwerkfehler', 'err');
}

function setupStep2() {
  _setup.host = document.getElementById('setup-host').value.trim();
  _setup.port = +document.getElementById('setup-port').value || 3306;
  _setup.name = document.getElementById('setup-name').value.trim();
  _setup.user = document.getElementById('setup-user').value.trim();
  _setup.pass = document.getElementById('setup-pass').value;
  if (!_setup.name || !_setup.user) { setupMsg('DB-Name und Benutzer sind erforderlich.'); return; }
  _setup.step = 2;
  renderSetup();
}

function setupStep3() {
  _setup.prefix   = (document.getElementById('setup-prefix').value || '').replace(/[^a-zA-Z0-9_]/g,'');
  _setup.adminPw  = document.getElementById('setup-adminpw').value;
  _setup.adminPw2 = document.getElementById('setup-adminpw2').value;
  if (_setup.adminPw !== _setup.adminPw2) { setupMsg('Passwörter stimmen nicht überein.'); return; }
  if (_setup.adminPw.length < 8) { setupMsg('Admin-Passwort muss mindestens 8 Zeichen haben.'); return; }
  _setup.step = 3;
  renderSetup();
}

async function setupInstall() {
  // Schritt-3-Werte lesen
  _setup.vereinName     = document.getElementById('setup-verein-name').value.trim();
  _setup.vereinKuerzel  = document.getElementById('setup-verein-kuerzel').value.trim();
  _setup.appUntertitel  = document.getElementById('setup-app-untertitel').value.trim() || 'Leichtathletik-Statistik';
  _setup.farbePrimary   = document.getElementById('setup-farbe-primary').value.trim() || '#cc0000';
  _setup.farbenAccent   = document.getElementById('setup-farbe-accent').value.trim()  || '#003087';
  _setup.emailDomain    = document.getElementById('setup-email-domain').value.trim();
  _setup.noreplEmail    = document.getElementById('setup-noreply-email').value.trim();

  // Farbvalidierung
  var farbFehler = [
    _validateFarbe(_setup.farbePrimary, 'Hauptfarbe'),
    _validateFarbe(_setup.farbenAccent, 'Akzentfarbe'),
  ].filter(Boolean);
  if (farbFehler.length) { setupMsg(farbFehler.join('<br>'), 'err'); return; }

  setupMsg('Installation läuft…', 'ok');
  var r = await fetch('api/setup.php', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({
      action:          'install',
      db_host:         _setup.host,         db_port:    _setup.port,
      db_name:         _setup.name,         db_user:    _setup.user,
      db_pass:         _setup.pass,         table_prefix: _setup.prefix,
      admin_password:  _setup.adminPw,
      verein_name:     _setup.vereinName    || 'Mein Verein e.V.',
      verein_kuerzel:  _setup.vereinKuerzel || _setup.vereinName || 'Mein Verein',
      app_untertitel:  _setup.appUntertitel,
      farbe_primary:   _setup.farbePrimary,
      farbe_accent:    _setup.farbenAccent,
      email_domain:    _setup.emailDomain   || 'vy99.de',
      noreply_email:   _setup.noreplEmail   || 'noreply@vy99.de',
    })
  }).then(r=>r.json()).catch(()=>null);

  if (r && r.ok) {
    _setup.step = 4;
    renderSetup();
  } else {
    setupMsg(r ? r.fehler : 'Installationsfehler – bitte Log prüfen.', 'err');
  }
}

async function setupCreateTables() {
  setupMsg('Tabellen werden angelegt…', 'ok');
  var r = await fetch('api/setup.php', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ action:'create_tables' })
  }).then(r=>r.json()).catch(()=>null);
  if (r && r.ok) {
    setupMsg('✓ Tabellen angelegt. Seite wird neu geladen…', 'ok');
    setTimeout(() => location.reload(), 1500);
  } else {
    setupMsg(r ? r.fehler : 'Fehler beim Anlegen der Tabellen.', 'err');
  }
}

// ── LOGIN / LOGOUT ──────────────────────────────────────────
function showLogin() {
  var scr = document.getElementById('login-screen');
  scr.style.display = 'flex';
  var cancelBtn = scr.querySelector('.btn-login-cancel');
  if (cancelBtn) cancelBtn.style.display = 'block';
  setTimeout(function() {
    var el = document.getElementById('login-user');
    if (el) el.focus();
  }, 100);
}

function hideLogin() {
  document.getElementById('login-screen').style.display = 'none';
}

// ── REGISTRIERUNG ───────────────────────────────────────────
var _regState = { step: 1, email: '', name: '', pw: '', totpSecret: '', totpDone: false };


// ── Passwort-Score ──────────────────────────────────────────
function _pwScore(pw) {
  var groups = 0;
  if (/[A-Z]/.test(pw)) groups++;
  if (/[a-z]/.test(pw)) groups++;
  if (/[0-9]/.test(pw)) groups++;
  if (/[^A-Za-z0-9]/.test(pw)) groups++;
  var lengthOk = pw.length >= 12;
  var score = 0;
  if (pw.length >= 8)  score++;
  if (pw.length >= 12) score++;
  if (pw.length >= 16) score++;
  score += groups;
  return { groups: groups, lengthOk: lengthOk, score: Math.min(score, 5) };
}

function regEmailCheck() {
  var email = (document.getElementById('reg-email').value || '').trim().toLowerCase();
  var hint  = document.getElementById('reg-email-hint');
  if (!hint) return;
  // Erst auswerten wenn es wie eine echte E-Mail aussieht: *@*.*
  var emailDomain = appConfig.email_domain || 'vy99.de';
  var looksLikeEmail = /^[^@]+@[^@]+\.[^@]+$/.test(email);
  if (!email || !looksLikeEmail) {
    hint.className = 'reg-email-hint';
    hint.innerHTML = '🔒 Nur <strong>@' + emailDomain + '</strong>-E-Mail-Adressen sind zugelassen.';
    return;
  }
  if (email.endsWith('@' + emailDomain)) {
    hint.className = 'reg-email-hint reg-email-ok';
    hint.innerHTML = '✓ Gültige ' + (appConfig.verein_name || 'Mein Verein e.V.') + ' E-Mail-Adresse';
  } else {
    hint.className = 'reg-email-hint reg-email-err';
    hint.innerHTML = '✗ Nur <strong>@' + emailDomain + '</strong>-Adressen sind zugelassen';
  }
}

function regPwCheck() {
  var pw   = document.getElementById('reg-pw').value;
  var wrap = document.getElementById('reg-pw-strength');
  var bar  = document.getElementById('reg-pw-bar');
  var grps = document.getElementById('reg-pw-groups');
  if (!wrap) return;
  if (!pw) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'block';
  var s = _pwScore(pw);
  // Grün nur wenn BEIDE Bedingungen erfüllt: 12 Zeichen UND 3+ Gruppen
  var fullyOk = s.lengthOk && s.groups >= 3;
  var pct   = Math.min((pw.length / 12) * 60 + (s.groups / 4) * 40, 100);
  var color = fullyOk          ? '#16a34a'
            : s.groups >= 3    ? '#eab308'
            : s.groups >= 2    ? '#f97316'
            :                    '#ef4444';
  bar.style.width      = pct + '%';
  bar.style.background = color;
  // Gruppen-Checkboxen
  var labels = [
    { key: /[A-Z]/, label: 'Großbuchstaben' },
    { key: /[a-z]/, label: 'Kleinbuchstaben' },
    { key: /[0-9]/, label: 'Zahlen' },
    { key: /[^A-Za-z0-9]/, label: 'Sonderzeichen' },
  ];
  var html = '';
  for (var i = 0; i < labels.length; i++) {
    var ok = labels[i].key.test(pw);
    html += '<span class="pw-group ' + (ok ? 'ok' : 'missing') + '">' +
            (ok ? '✓' : '○') + ' ' + labels[i].label + '</span>';
  }
  // Länge
  var lenOk = pw.length >= 12;
  html += '<span class="pw-group ' + (lenOk ? 'ok' : 'missing') + '">' +
          (lenOk ? '✓' : '○') + ' 12+ Zeichen (' + pw.length + ')</span>';
  grps.innerHTML = html;
}

function showRegister() {
  hideLogin();
  _regState = { step: 1, email: '', name: '', pw: '', totpSecret: '', totpDone: false };
  _renderRegModal();
}

function _renderRegModal() {
  var s = _regState.step;
  var stepsHtml = _regProgress(s, 4);

  var body = '';
  if (s === 1) {
    body =
      '<div class="form-group">' +
        '<label style="color:var(--text2)">E-Mail-Adresse</label>' +
        '<input type="email" id="reg-email" placeholder="" autocomplete="email" ' +
               'style="font-size:16px" oninput="regEmailCheck()" onkeydown="if(event.key===\'Enter\')regStep1()"/>' +
        '<div class="reg-email-hint" id="reg-email-hint">' +
          '🔒 Nur <strong>@' + (appConfig.email_domain || 'vy99.de') + '</strong>-E-Mail-Adressen sind zugelassen.' +
        '</div>' +
      '</div>' +
      '<div class="form-group">' +
        '<label style="color:var(--text2)">Nickname</label>' +
        '<input type="text" id="reg-name" placeholder="" autocomplete="nickname" ' +
               'style="font-size:16px" onkeydown="if(event.key===\'Enter\')regStep1()"/>' +
      '</div>' +
      '<div class="form-group">' +
        '<label style="color:var(--text2)">Passwort <span style="font-weight:400;font-size:11px">(min. 12 Zeichen, 3 von 4 Gruppen)</span></label>' +
        '<input type="password" id="reg-pw" placeholder="" autocomplete="new-password" style="font-size:16px" oninput="regPwCheck()"/>' +
        '<div id="reg-pw-strength" class="pw-strength-wrap" style="display:none">' +
          '<div class="pw-strength-bar"><div id="reg-pw-bar" class="pw-strength-fill"></div></div>' +
          '<div id="reg-pw-groups" class="pw-groups"></div>' +
        '</div>' +
      '</div>' +
      '<div class="form-group">' +
        '<label style="color:var(--text2)">Passwort wiederholen</label>' +
        '<input type="password" id="reg-pw2" placeholder="" autocomplete="new-password" style="font-size:16px" onkeydown="if(event.key===\'Enter\')regStep1()"/>' +
      '</div>' +
      '<div id="reg-err" class="reg-err-box" style="display:none"></div>' +
      '<div class="reg-btn-row">' +
        '<button class="btn-login-cancel reg-btn" onclick="hideRegister()">Abbrechen</button>' +
        '<button class="btn-login reg-btn" onclick="regStep1()">Weiter →</button>' +
      '</div>';
  } else if (s === 2) {
    body =
      '<div class="reg-info-box">📧 Wir haben eine Bestätigungs-E-Mail an <strong>' + _regState.email + '</strong> gesendet.<br>Bitte klicke auf den Link in der E-Mail, um fortzufahren.</div>' +
      '<div class="form-group">' +
        '<label style="color:var(--text2)">Bestätigungscode aus der E-Mail</label>' +
        '<input type="text" id="reg-vcode" placeholder="6-stelliger Code" maxlength="6" ' +
               'style="font-size:20px;letter-spacing:6px;text-align:center" onkeydown="if(event.key===\'Enter\')regStep2()"/>' +
      '</div>' +
      '<div id="reg-err" class="reg-err-box" style="display:none"></div>' +
      '<div class="reg-btn-row">' +
        '<button class="btn-login-cancel reg-btn" onclick="regResendCode()">Code erneut senden</button>' +
        '<button class="btn-login reg-btn" onclick="regStep2()">E-Mail bestätigen →</button>' +
      '</div>';
  } else if (s === 3) {
    body =
      '<div class="reg-info-box">🔐 Richte jetzt die Zwei-Faktor-Authentifizierung ein. Scanne den QR-Code mit deiner Authenticator-App (z.B. Google Authenticator).</div>' +
      '<div id="reg-qr-wrap" style="text-align:center;margin:16px 0">' +
        '<div class="spinner" style="margin:0 auto"></div>' +
      '</div>' +
      '<div class="form-group">' +
        '<label style="color:var(--text2)">Code aus der App</label>' +
        '<input type="text" id="reg-totp" placeholder="000000" maxlength="6" inputmode="numeric" ' +
               'style="font-size:20px;letter-spacing:6px;text-align:center" onkeydown="if(event.key===\'Enter\')regStep3()"/>' +
      '</div>' +
      '<div id="reg-err" style="color:var(--accent);font-size:13px;margin-bottom:12px;display:none"></div>' +
      '<button class="btn-login" style="width:100%" onclick="regStep3()">2FA bestätigen →</button>';
  } else if (s === 4) {
    body =
      '<div style="text-align:center;padding:10px 0 20px">' +
        '<div style="font-size:48px;margin-bottom:12px">✅</div>' +
        '<div style="font-size:18px;font-weight:700;color:var(--text);margin-bottom:8px">Registrierung abgeschlossen!</div>' +
        '<div style="font-size:13px;color:var(--text2);line-height:1.6">' +
          'Dein Konto wartet nun auf die Freigabe durch einen Administrator.<br>' +
          'Du wirst per E-Mail benachrichtigt, sobald dein Konto freigeschaltet wurde.' +
        '</div>' +
      '</div>' +
      '<button class="btn-login" style="width:100%" onclick="hideRegister();showLogin()">Zum Login</button>';
  }

  showModal(
    '<div style="background:linear-gradient(135deg,var(--primary) 0%,var(--primary2) 100%);margin:-20px -20px 20px;padding:20px 24px 16px;border-radius:12px 12px 0 0">' +
      '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:22px;font-weight:700;color:#fff;margin-bottom:14px">' +
        '📝 Registrierung' +
        '<button class="modal-close" onclick="hideRegister()" style="float:right;color:rgba(255,255,255,.7)">✕</button>' +
      '</div>' +
      stepsHtml +
    '</div>' +
    body
  , false, true);

  // QR-Code für Schritt 3 laden
  if (s === 3 && !_regState.totpSecret) _regLoadTotp();
}

function _regProgress(current, total) {
  var html = '<div class="reg-progress">';
  for (var i = 1; i <= total; i++) {
    var cls = i < current ? 'done' : (i === current ? 'active' : '');
    html += '<div class="reg-step-dot ' + cls + '">' + (i < current ? '✓' : i) + '</div>';
    if (i < total) html += '<div class="reg-step-line ' + (i < current ? 'done' : '') + '"></div>';
  }
  return html + '</div>';
}

function _regErr(msg) {
  var el = document.getElementById('reg-err');
  if (el) {
    el.textContent = msg;
    el.style.display = msg ? 'block' : 'none';
    if (msg) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } else if (msg) {
    // Fallback falls das Modal-DOM nicht bereit ist
    notify(msg, 'err');
  }
}

async function regStep1() {
  _regErr('');
  var email = (document.getElementById('reg-email').value || '').trim().toLowerCase();
  var name  = (document.getElementById('reg-name').value  || '').trim();
  var pw    = document.getElementById('reg-pw').value;
  var pw2   = document.getElementById('reg-pw2').value;

  var _dom = appConfig.email_domain || 'vy99.de';
  if (!email.endsWith('@' + _dom)) return _regErr('Nur @' + _dom + ' E-Mail-Adressen sind zugelassen.');
  if (!name || name.length < 2)        return _regErr('Bitte gib einen Nickname ein (min. 2 Zeichen).');
  var pwScore = _pwScore(pw);
  if (pw.length < 12)   return _regErr('Passwort muss mindestens 12 Zeichen haben.');
  if (pwScore.groups < 3) return _regErr('Passwort muss mindestens 3 von 4 Zeichengruppen enthalten (Großbuchstaben, Kleinbuchstaben, Zahlen, Sonderzeichen).');
  if (pw !== pw2)        return _regErr('Passwörter stimmen nicht überein.');

  _regState.email = email;
  _regState.name  = name;
  _regState.pw    = pw;

  var r = await apiPost('auth/register-start', { email, name, passwort: pw });
  if (!r || !r.ok) return _regErr((r && r.fehler) || 'Fehler bei der Registrierung.');

  _regState.step = 2;
  _renderRegModal();
}

async function regStep2() {
  _regErr('');
  var code = (document.getElementById('reg-vcode').value || '').trim();
  if (!code || code.length < 4) return _regErr('Bitte gib den Code aus der E-Mail ein.');

  var r = await apiPost('auth/register-verify-email', { email: _regState.email, code });
  if (!r || !r.ok) return _regErr((r && r.fehler) || 'Ungültiger oder abgelaufener Code.');

  _regState.step = 3;
  _renderRegModal();
}

async function _regLoadTotp() {
  var r = await apiPost('auth/register-totp-init', { email: _regState.email });
  if (!r || !r.ok) return;
  _regState.totpSecret = r.data.secret;
  var wrap = document.getElementById('reg-qr-wrap');
  if (wrap) wrap.innerHTML = '<img src="' + r.data.qr_url + '" style="width:160px;height:160px;border-radius:10px;border:1px solid rgba(255,255,255,.2)"/>' +
    '<div style="font-size:11px;color:rgba(255,255,255,.5);margin-top:8px;word-break:break-all">' + r.data.secret + '</div>';
}

async function regStep3() {
  _regErr('');
  var code = (document.getElementById('reg-totp').value || '').trim();
  if (!code || code.length !== 6) return _regErr('Bitte gib den 6-stelligen Code ein.');

  var r = await apiPost('auth/register-totp-confirm', { email: _regState.email, code, secret: _regState.totpSecret });
  if (!r || !r.ok) return _regErr((r && r.fehler) || 'Ungültiger Code. Bitte erneut versuchen.');

  _regState.step = 4;
  _renderRegModal();
}

async function regResendCode() {
  var r = await apiPost('auth/register-resend', { email: _regState.email });
  notify(r && r.ok ? 'Code wurde erneut gesendet.' : ((r && r.fehler) || 'Fehler'), r && r.ok ? 'ok' : 'err');
}

function hideRegister() { closeModal(); }


function loginBackdropClick(e) {
  // Klick auf Overlay (nicht auf die Karte selbst) → schließen
  if (e.target === document.getElementById('login-screen')) {
    hideLogin();
  }
}

var _loginPendingName = '';

async function doLogin() {
  var benutzername = document.getElementById('login-user').value.trim();
  var passwort     = document.getElementById('login-pw').value;
  var errEl        = document.getElementById('login-err');
  errEl.style.display = 'none'; errEl.textContent = '';
  if (!benutzername || !passwort) {
    errEl.textContent = 'Bitte Benutzername und Passwort eingeben.';
    errEl.style.display = 'block'; return;
  }
  var btn = document.querySelector('.btn-login');
  btn.textContent = '...'; btn.disabled = true;
  var r = await apiPost('auth/login', { benutzername: benutzername, passwort: passwort });
  btn.textContent = 'Anmelden'; btn.disabled = false;
  if (r && r.ok) {
    if (r.data && r.data.totp_required) {
      _loginPendingName = benutzername;
      if (r.data.totp_setup) await showTotpSetup();
      else                   showTotpVerify();
    } else {
      currentUser = { name: benutzername, rolle: r.data.rolle };
      showApp();
    }
  } else {
    var msg = (r && r.fehler) ? r.fehler : ('Unbekannter Fehler: ' + JSON.stringify(r));
    errEl.textContent = '\u274C ' + msg;
    errEl.style.display = 'block';
  }
}

function showTotpVerify() {
  document.getElementById('login-screen').innerHTML =
    '<div class="login-card">' +
    '<div style="text-align:center;margin-bottom:20px"><img src="' + (appConfig.logo_datei ? '/' + appConfig.logo_datei : '') + '" style="height:60px;object-fit:contain" onerror="this.style.display=\'none\'"/></div>' +
    '<h2 style="font-size:18px;font-weight:700;margin:0 0 6px">&#x1F512; Zwei-Faktor-Authentifizierung</h2>' +
    '<p style="color:var(--text2);font-size:13px;margin:0 0 20px">Bitte den 6-stelligen Code aus deiner Authenticator-App eingeben.</p>' +
    '<div class="form-group" style="margin-bottom:16px"><label>Authenticator-Code</label>' +
    '<input type="text" id="totp-code" inputmode="numeric" autocomplete="one-time-code" maxlength="9" placeholder="000 000"' +
    ' style="letter-spacing:4px;font-size:24px;text-align:center;font-weight:700"' +
    ' onkeydown="if(event.key===\'Enter\')doTotpVerify()"/></div>' +
    '<p style="color:var(--text2);font-size:12px;margin:0 0 16px">Oder einen <strong>Backup-Code</strong> (8 Zeichen) eingeben.</p>' +
    '<div id="totp-err" style="display:none;background:#fde8e8;color:#cc0000;padding:8px 12px;border-radius:7px;font-size:13px;font-weight:600;margin-bottom:12px"></div>' +
    '<button class="btn btn-primary" style="width:100%" onclick="doTotpVerify()">Best\u00e4tigen</button>' +
    '<button class="btn btn-ghost" style="width:100%;margin-top:8px" onclick="location.reload()">Zur\u00fcck</button></div>';
  setTimeout(function() { var el = document.getElementById('totp-code'); if (el) el.focus(); }, 100);
}

async function doTotpVerify() {
  var code  = (document.getElementById('totp-code').value || '').replace(/\s+/g, '');
  var errEl = document.getElementById('totp-err');
  errEl.style.display = 'none';
  if (!code) { errEl.textContent = 'Bitte Code eingeben.'; errEl.style.display = 'block'; return; }
  var btn = document.querySelector('#login-screen .btn-primary');
  btn.textContent = '...'; btn.disabled = true;
  var r = await apiPost('auth/totp-verify', { code: code });
  btn.textContent = 'Best\u00e4tigen'; btn.disabled = false;
  if (r && r.ok) {
    currentUser = { name: _loginPendingName, rolle: r.data.rolle };
    _loginPendingName = '';
    showApp();
  } else {
    errEl.textContent = '\u274C ' + ((r && r.fehler) || 'Ung\u00fcltiger Code.');
    errEl.style.display = 'block';
    document.getElementById('totp-code').value = '';
    document.getElementById('totp-code').focus();
  }
}

async function showTotpSetup() {
  document.getElementById('login-screen').innerHTML =
    '<div class="login-card" style="max-width:420px">' +
    '<div style="text-align:center;margin-bottom:16px"><img src="' + (appConfig.logo_datei ? '/' + appConfig.logo_datei : '') + '" style="height:50px;object-fit:contain" onerror="this.style.display=\'none\'"/></div>' +
    '<h2 style="font-size:17px;font-weight:700;margin:0 0 8px">&#x1F512; 2FA einrichten</h2>' +
    '<p style="color:var(--text2);font-size:13px;margin:0 0 16px">Als Admin muss die Zwei-Faktor-Authentifizierung eingerichtet werden. Scanne den QR-Code mit Google/Microsoft Authenticator oder einer anderen TOTP-App.</p>' +
    '<div id="totp-setup-body" style="text-align:center;padding:10px 0">Wird geladen&#x2026;</div></div>';
  var r = await apiGet('auth/totp-setup');
  if (!r || !r.ok) {
    document.getElementById('totp-setup-body').innerHTML = '<p style="color:#cc0000">Fehler: ' + ((r && r.fehler) || 'Unbekannt') + '</p>';
    return;
  }
  var d = r.data;
  document.getElementById('totp-setup-body').innerHTML =
    '<img src="' + d.qr_url + '" style="width:180px;height:180px;border-radius:12px;margin-bottom:12px;border:1px solid var(--border)"/>' +
    '<p style="font-size:11px;color:var(--text2);margin:0 0 4px">Oder manuell eingeben:</p>' +
    '<code style="font-size:12px;letter-spacing:1px;font-weight:700;background:var(--surface2);padding:6px 12px;border-radius:6px;display:inline-block;margin-bottom:16px;word-break:break-all">' + d.secret + '</code>' +
    '<div class="form-group" style="text-align:left;margin-bottom:12px"><label>Code aus der App</label>' +
    '<input type="text" id="totp-setup-code" inputmode="numeric" maxlength="9" placeholder="000 000"' +
    ' style="letter-spacing:4px;font-size:22px;text-align:center;font-weight:700"' +
    ' onkeydown="if(event.key===\'Enter\')doTotpSetupConfirm()"/></div>' +
    '<div id="totp-setup-err" style="display:none;background:#fde8e8;color:#cc0000;padding:8px 12px;border-radius:7px;font-size:13px;font-weight:600;margin-bottom:12px;text-align:left"></div>' +
    '<button class="btn btn-primary" style="width:100%" onclick="doTotpSetupConfirm()">Einrichten &amp; Anmelden</button>' +
    '<button class="btn btn-ghost" style="width:100%;margin-top:8px" onclick="location.reload()">Abbrechen</button>';
  setTimeout(function() { var el = document.getElementById('totp-setup-code'); if (el) el.focus(); }, 200);
}

async function doTotpSetupConfirm() {
  var code  = (document.getElementById('totp-setup-code').value || '').replace(/\s+/g, '');
  var errEl = document.getElementById('totp-setup-err');
  errEl.style.display = 'none';
  if (!code) { errEl.textContent = 'Bitte Code eingeben.'; errEl.style.display = 'block'; return; }
  var btn = document.querySelector('#login-screen .btn-primary');
  btn.textContent = '...'; btn.disabled = true;
  var r = await apiPost('auth/totp-setup', { code: code });
  btn.textContent = 'Einrichten & Anmelden'; btn.disabled = false;
  if (r && r.ok) {
    currentUser = { name: _loginPendingName, rolle: r.data.rolle };
    _loginPendingName = '';
    showBackupCodes(r.data.backup_codes);
  } else {
    errEl.textContent = '\u274C ' + ((r && r.fehler) || 'Ung\u00fcltiger Code.');
    errEl.style.display = 'block';
    document.getElementById('totp-setup-code').value = '';
    document.getElementById('totp-setup-code').focus();
  }
}

function showBackupCodes(codes) {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-screen').style.display   = 'block';
  var grid = '';
  for (var i = 0; i < (codes || []).length; i++) {
    grid += '<code style="background:var(--surface2);padding:8px 12px;border-radius:6px;font-size:14px;font-weight:700;letter-spacing:2px;text-align:center">' + codes[i] + '</code>';
  }
  showModal(
    '<h2>Backup-Codes <button class="modal-close" onclick="closeModal();showApp()">&#x2715;</button></h2>' +
    '<div style="background:#fff8e1;border:1px solid #ffe082;border-radius:8px;padding:14px 16px;margin-bottom:16px;font-size:13px">' +
    '<strong>&#x26A0;&#xFE0F; Wichtig:</strong> Speichere diese Codes sicher (z.B. Passwort-Manager). ' +
    'Jeder Code ist nur einmal verwendbar und kann nicht wiederhergestellt werden!</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:20px">' + grid + '</div>' +
    '<div class="modal-actions">' +
    '<button class="btn btn-ghost" id="backup-copy-btn" onclick="copyBackupCodes()">Kopieren</button>' +
    '<button class="btn btn-primary" onclick="closeModal();showApp()">Verstanden &amp; App \u00f6ffnen</button>' +
    '</div>'
  );
}

function copyBackupCodes() {
  var codes = document.querySelectorAll('.modal code');
  var text  = (appConfig.verein_name || 'Mein Verein e.V.') + ' - 2FA Backup-Codes:\n';
  for (var i = 0; i < codes.length; i++) text += codes[i].textContent + '\n';
  navigator.clipboard.writeText(text).then(function() {
    var btn = document.getElementById('backup-copy-btn');
    if (btn) { btn.textContent = '\u2705 Kopiert!'; setTimeout(function() { btn.textContent = 'Kopieren'; }, 2500); }
  });
}

function logout() {
  showModal(
    '<h2>Abmelden <button class="modal-close" onclick="closeModal()">&#x2715;</button></h2>' +
    '<p style="margin:8px 0 24px;color:var(--text2)">Möchtest du dich wirklich abmelden?</p>' +
    '<div class="modal-actions">' +
      '<button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button>' +
      '<button class="btn btn-primary" style="background:var(--accent);border-color:var(--accent)" onclick="doLogout()">Ja, abmelden</button>' +
    '</div>'
  );
}

async function doLogout() {
  closeModal();
  await apiPost('auth/logout');
  currentUser = null;
  showApp();
}

function showApp() {
  document.getElementById('login-screen').style.display = 'none';
  // app-screen ist immer sichtbar (kein display toggle nötig)
  // Anon-Login-Button aufräumen falls vorhanden
  var anonBtn = document.getElementById('anon-login-btn');
  if (anonBtn) anonBtn.parentNode.removeChild(anonBtn);

  if (currentUser) {
    var name = currentUser.name || '?';
    var avatarEl = document.getElementById('user-avatar');
    if (currentUser.avatar) {
      avatarEl.innerHTML = '<img src="' + currentUser.avatar + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">'
    } else {
      avatarEl.textContent = nameInitials(name);
    }
    document.getElementById('user-name-disp').textContent  = name;
    document.getElementById('user-rolle-disp').textContent = rolleLabel(currentUser.rolle);
    document.getElementById('user-btn').style.display = '';
  } else {
    document.getElementById('user-btn').style.display = 'none';
    // Login-Button einfügen falls noch nicht da (nur Desktop, Mobile nutzt Burger-Drawer)
    var hdr = document.querySelector('.header-right');
    if (hdr && !document.getElementById('anon-login-btn')) {
      var wrap = document.createElement('div');
      wrap.id = 'anon-login-btn';
      wrap.className = 'anon-btn-wrap';
      wrap.innerHTML =
        '<button class="btn btn-primary btn-sm" onclick="showLogin()">Anmelden</button>' +
        '<button class="btn btn-ghost btn-sm anon-reg-btn" onclick="showRegister()">Registrieren</button>';
      hdr.insertBefore(wrap, hdr.firstChild);
    }
  }
  applyVersionVisibility();
  buildNav();
  buildFooter();
  navigate(currentUser ? 'dashboard' : 'dashboard');
  loadDisziplinen();
  if (currentUser) loadAthleten();
}

function showUserMenu() {
  if (!currentUser) { showLogin(); return; }
  var name = currentUser.name || '?';
  showModal(
    '<h2>Konto <button class="modal-close" onclick="closeModal()">&#x2715;</button></h2>' +
    '<div style="text-align:center;padding:10px 0 20px">' +
      '<div style="position:relative;width:64px;margin:0 auto 12px;cursor:pointer" onclick="document.getElementById(\'avatar-file-input\').click()" title="Avatar ändern">' +
        '<div class="profile-avatar" style="width:64px;height:64px;font-size:24px;overflow:hidden;padding:0;' + (currentUser.avatar ? 'background:none;' : '') + '">' +
          (currentUser.avatar
            ? '<img id="konto-avatar-img" src="' + currentUser.avatar + '" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:50%;">'
            : nameInitials(name)) +
        '</div>' +
        '<div style="position:absolute;bottom:0;right:0;background:var(--primary);color:var(--on-primary);border-radius:50%;width:20px;height:20px;display:flex;align-items:center;justify-content:center;font-size:12px;">&#x1F4F7;</div>' +
      '</div>' +
      '<input type="file" id="avatar-file-input" accept="image/png,image/jpeg,image/webp" style="display:none" onchange="uploadAvatar(this)">' +
      '<div style="font-size:18px;font-weight:600">' + name + '</div>' +
      '<div style="color:var(--text2);font-size:13px;margin-top:4px">' + rolleLabel(currentUser.rolle) + '</div>' +
      (currentUser.avatar ? '<button class="btn btn-ghost btn-sm" style="margin-top:6px;font-size:11px;color:var(--text2)" onclick="deleteAvatar()">&#x2715; Avatar entfernen</button>' : '') +
    '</div>' +
    '<hr style="border:none;border-top:1px solid var(--border);margin:0 0 16px"/>' +
    '<div class="form-grid" style="margin-bottom:8px">' +
      '<div class="form-group full">' +
        '<label>&#x1F319; Erscheinungsbild</label>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px" id="theme-btns">' +
          '<button class="btn btn-sm ' + (getThemePref()==='auto'  ? 'btn-primary' : 'btn-ghost') + '" onclick="setTheme(\'auto\')" >&#x1F4BB; Automatisch</button>' +
          '<button class="btn btn-sm ' + (getThemePref()==='light' ? 'btn-primary' : 'btn-ghost') + '" onclick="setTheme(\'light\')">&#x2600;&#xFE0F; Hell</button>' +
          '<button class="btn btn-sm ' + (getThemePref()==='dark'  ? 'btn-primary' : 'btn-ghost') + '" onclick="setTheme(\'dark\')" >&#x1F319; Dunkel</button>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<hr style="border:none;border-top:1px solid var(--border);margin:0 0 16px"/>' +
    '<div class="form-grid">' +
      '<div class="form-group full"><label>Aktuelles Passwort</label><input type="password" id="pw-alt" placeholder=""/></div>' +
      '<div class="form-group"><label>Neues Passwort</label><input type="password" id="pw-neu" placeholder="min. 8 Zeichen"/></div>' +
      '<div class="form-group"><label>Wiederholen</label><input type="password" id="pw-neu2" placeholder="Wiederholen"/></div>' +
    '</div>' +
    '<div id="pw-msg" style="display:none;margin:10px 0;padding:8px 12px;border-radius:7px;font-size:13px;font-weight:600"></div>' +
     (currentUser.rolle === 'admin' ?
       '<hr style="border:none;border-top:1px solid var(--border);margin:0 0 16px"/>' +
       '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">' +
       '<div><strong>&#x1F512; 2FA</strong>' +
       '<div style="font-size:12px;color:var(--text2);margin-top:2px">TOTP aktiv &ndash; Authenticator-App</div></div>' +
       '<button class="btn btn-sm btn-ghost" style="color:#cc0000" onclick="disableTotp()">Deaktivieren</button></div>'
     : '') +
    '<div class="modal-actions">' +
      '<button class="btn btn-ghost" style="color:var(--accent)" onclick="closeModal();logout()">Abmelden</button>' +
      '<button class="btn btn-ghost" onclick="closeModal()">Schlie&#xDF;en</button>' +
      '<button class="btn btn-primary" onclick="changePasswort()">Passwort &#xe4;ndern</button>' +
    '</div>'
  );
}

async function uploadAvatar(input) {
  var file = input.files[0];
  if (!file) return;
  var allowed = ['image/png','image/jpeg','image/webp','image/gif'];
  if (allowed.indexOf(file.type) < 0) { notify('Nur PNG, JPG, WebP oder GIF erlaubt.', 'err'); return; }
  if (file.size > 10 * 1024 * 1024) { notify('Datei zu groß (max. 10 MB).', 'err'); return; }
  // Crop-Dialog öffnen
  var reader = new FileReader();
  reader.onload = function(e) { showAvatarCropModal(e.target.result, file); };
  reader.readAsDataURL(file);
}

function showAvatarCropModal(dataUrl, file) {
  showModal(
    '<h2>Avatar zuschneiden <button class="modal-close" onclick="closeModal()">&#x2715;</button></h2>' +
    '<p style="font-size:13px;color:var(--text2);margin:0 0 12px">Verschiebe und vergrößere den Ausschnitt, dann speichern.</p>' +
    '<div style="position:relative;overflow:hidden;background:#111;border-radius:8px;margin-bottom:14px;touch-action:none" id="crop-wrap">' +
      '<img id="crop-img" src="' + dataUrl + '" style="display:block;max-width:100%;max-height:340px;margin:0 auto;user-select:none;-webkit-user-drag:none">' +
      '<div id="crop-box" style="position:absolute;border:3px solid #fff;box-shadow:0 0 0 9999px rgba(0,0,0,.55);box-sizing:border-box;cursor:move;border-radius:50%"></div>' +
    '</div>' +
    '<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">' +
      '<span style="font-size:12px;color:var(--text2)">Größe</span>' +
      '<input type="range" id="crop-size" min="40" max="100" value="80" style="flex:1" oninput="_cropResize()">' +
    '</div>' +
    '<div class="modal-actions">' +
      '<button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button>' +
      '<button class="btn btn-primary" onclick="_cropSave()">&#x1F4BE; Speichern</button>' +
    '</div>'
  , false, true);
  // Crop-Logik initialisieren nach DOM-Ready
  requestAnimationFrame(function() { _cropInit(file); });
}

var _cropFile = null;
var _cropState = { x: 0, y: 0, size: 0, imgW: 0, imgH: 0, scaleX: 1, scaleY: 1 };

function _cropInit(file) {
  _cropFile = file;
  var img = document.getElementById('crop-img');
  var box = document.getElementById('crop-box');
  var wrap = document.getElementById('crop-wrap');
  if (!img || !box || !wrap) return;
  img.onload = function() {};
  // Natürliche vs. angezeigte Größe
  var r = img.getBoundingClientRect();
  var s = _cropState;
  s.imgW = r.width; s.imgH = r.height;
  s.scaleX = img.naturalWidth / r.width;
  s.scaleY = img.naturalHeight / r.height;
  // Startgröße: 80% der kleineren Seite
  s.size = Math.round(Math.min(r.width, r.height) * 0.8);
  s.x = Math.round((r.width  - s.size) / 2);
  s.y = Math.round((r.height - s.size) / 2);
  _cropDraw();
  // Drag
  var dragging = false, startX, startY, startCX, startCY;
  box.addEventListener('pointerdown', function(e) {
    dragging = true; startX = e.clientX; startY = e.clientY;
    startCX = s.x; startCY = s.y; e.preventDefault();
    box.setPointerCapture(e.pointerId);
  });
  window.addEventListener('pointermove', function(e) {
    if (!dragging) return;
    s.x = Math.max(0, Math.min(startCX + (e.clientX - startX), s.imgW - s.size));
    s.y = Math.max(0, Math.min(startCY + (e.clientY - startY), s.imgH - s.size));
    _cropDraw();
  });
  window.addEventListener('pointerup', function() { dragging = false; });
}

function _cropDraw() {
  var box = document.getElementById('crop-box');
  var img = document.getElementById('crop-img');
  if (!box || !img) return;
  var r = img.getBoundingClientRect();
  var wrapR = document.getElementById('crop-wrap').getBoundingClientRect();
  var s = _cropState;
  box.style.left   = (r.left - wrapR.left + s.x) + 'px';
  box.style.top    = (r.top  - wrapR.top  + s.y) + 'px';
  box.style.width  = s.size + 'px';
  box.style.height = s.size + 'px';
}

function _cropResize() {
  var slider = document.getElementById('crop-size');
  var img = document.getElementById('crop-img');
  if (!slider || !img) return;
  var s = _cropState;
  var pct = parseInt(slider.value) / 100;
  var newSize = Math.round(Math.min(s.imgW, s.imgH) * pct);
  s.x = Math.max(0, Math.min(s.x + (s.size - newSize) / 2, s.imgW - newSize));
  s.y = Math.max(0, Math.min(s.y + (s.size - newSize) / 2, s.imgH - newSize));
  s.size = newSize;
  _cropDraw();
}

async function _cropSave() {
  var s = _cropState;
  if (!_cropFile) return;
  var btn = document.querySelector('#modal-container .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = 'Lädt…'; }
  var fd = new FormData();
  fd.append('avatar', _cropFile);
  fd.append('cx', Math.round(s.x * s.scaleX));
  fd.append('cy', Math.round(s.y * s.scaleY));
  fd.append('cw', Math.round(s.size * s.scaleX));
  fd.append('ch', Math.round(s.size * s.scaleY));
  try {
    var resp = await fetch('api/index.php?_route=' + encodeURIComponent('upload/avatar'), { method: 'POST', credentials: 'same-origin', body: fd });
    var data = await resp.json();
    if (data.ok) {
      currentUser.avatar = data.data.pfad;
      var avatarEl = document.getElementById('user-avatar');
      if (avatarEl) avatarEl.innerHTML = '<img src="' + currentUser.avatar + '?v=' + Date.now() + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">';
      closeModal(); showUserMenu();
      notify('Avatar gespeichert.', 'ok');
    } else {
      notify(data.fehler || 'Fehler beim Hochladen.', 'err');
      if (btn) { btn.disabled = false; btn.innerHTML = '&#x1F4BE; Speichern'; }
    }
  } catch(e) {
    notify('Upload fehlgeschlagen.', 'err');
    if (btn) { btn.disabled = false; btn.innerHTML = '&#x1F4BE; Speichern'; }
  }
}

async function deleteAvatar() {
  try {
    var resp = await fetch('api/index.php?_route=' + encodeURIComponent('upload/avatar'), { method: 'DELETE', credentials: 'same-origin' });
    var data = await resp.json();
    if (data.ok) {
      currentUser.avatar = null;
      notify('Avatar entfernt.', 'ok');
      var avatarEl = document.getElementById('user-avatar');
      if (avatarEl) { avatarEl.innerHTML = ''; avatarEl.textContent = nameInitials(currentUser.name||'?'); }
      closeModal(); showUserMenu();
    } else { notify(data.fehler || 'Fehler.', 'err'); }
  } catch(e) { notify('Fehler.', 'err'); }
}

async function changePasswort() {
  var alt  = document.getElementById('pw-alt').value;
  var neu  = document.getElementById('pw-neu').value;
  var neu2 = document.getElementById('pw-neu2').value;
  var msg  = document.getElementById('pw-msg');
  function showMsg(text, ok) {
    msg.textContent = text;
    msg.style.display = 'block';
    msg.style.background = ok ? 'rgba(26,138,58,.12)' : '#fde8e8';
    msg.style.color = ok ? '#1a8a3a' : '#cc0000';
  }
  if (!alt || !neu || !neu2) { showMsg('Bitte alle Felder ausf\u00fcllen.', false); return; }
  if (neu.length < 8)        { showMsg('Neues Passwort muss mindestens 8 Zeichen haben.', false); return; }
  if (neu !== neu2)          { showMsg('Neue Passw\u00f6rter stimmen nicht \u00fcberein.', false); return; }
  var r = await apiPost('auth/passwort', { aktuell: alt, neu: neu });
  if (r && r.ok) {
    showMsg('\u2705 Passwort erfolgreich ge\u00e4ndert!', true);
    document.getElementById('pw-alt').value = '';
    document.getElementById('pw-neu').value = '';
    document.getElementById('pw-neu2').value = '';
  } else {
    showMsg('\u274C ' + ((r && r.fehler) || 'Fehler'), false);
  }
}

async function disableTotp() {
  if (!confirm('2FA wirklich deaktivieren? Beim n\u00e4chsten Admin-Login muss 2FA neu eingerichtet werden.')) return;
  var r = await apiDel('auth/totp-setup');
  if (r && r.ok) { closeModal(); alert('\u2705 2FA deaktiviert.'); }
  else { alert('Fehler: ' + ((r && r.fehler) || 'Unbekannt')); }
}

function rolleLabel(r) {
  var m = { admin: 'Administrator', editor: 'Editor', leser: 'Leser' };
  return m[r] || r;
}

// ── NAVIGATION ─────────────────────────────────────────────
function buildFooter() {
  var el = document.getElementById('app-footer');
  if (!el) return;
  var cfg = appConfig || {};
  var ghUrl = 'https://github.com/marath0nmann/Statistikportal';
  var authorUrl = 'https://webdev.danielweyers.de';
  var dsUrl   = cfg.footer_datenschutz_url   || '';
  var nuUrl   = cfg.footer_nutzung_url        || '';
  var impUrl  = cfg.footer_impressum_url      || '';
  var linkStyle = 'color:inherit;text-decoration:underline;text-underline-offset:2px;opacity:.7;';
  var dimStyle  = 'color:inherit;opacity:.35;cursor:default;';
  // Interne Routen als Fallback wenn keine externe URL konfiguriert
  function footerLink(url, internalRoute, label) {
    var href = url || internalRoute;
    var target = url ? ' target="_blank"' : '';
    return '<a href="' + href + '"' + target + ' style="' + linkStyle + '">' + label + '</a>';
  }
  var legalLine = footerLink(dsUrl,  '#/datenschutz', 'Datenschutz') + ' &nbsp;&middot;&nbsp; ' +
                  footerLink(nuUrl,  '#/nutzung',     'Nutzungsbedingungen') + ' &nbsp;&middot;&nbsp; ' +
                  footerLink(impUrl, '#/impressum',   'Impressum');
  el.innerHTML =
    '<div>Powered by <a href="' + ghUrl + '" target="_blank" style="' + linkStyle + '">Statistikportal</a> &copy; 2026 <a href="' + authorUrl + '" target="_blank" style="' + linkStyle + '">Daniel Weyers</a></div>' +
    '<div>' + legalLine + '</div>';
}

function buildNav() {
  var tabs = [
    { id: 'dashboard',       icon: '📊︎', label: 'Dashboard' },
    { id: 'rekorde',         icon: '🏆︎', label: 'Bestleistungen' },
    { id: 'veranstaltungen', icon: '📍︎', label: 'Veranstaltungen' },
    { id: 'ergebnisse',      icon: '📋︎', label: 'Ergebnisse' },
    { id: 'athleten',        icon: '👤︎', label: 'Athleten' },
  ];
  if (!currentUser) {
    var visibleTabs = tabs.filter(function(t) {
      return t.id === 'dashboard' || t.id === 'rekorde';
    });
    _renderNavTabs(visibleTabs);
    return;
  }
  if (currentUser.rolle === 'editor' || currentUser.rolle === 'admin')
    tabs.push({ id: 'eintragen', icon: '➕︎', label: 'Eintragen' });
  if (currentUser.rolle === 'admin')
    tabs.push({ id: 'admin', icon: '⚙️︎', label: 'Admin' });
  _renderNavTabs(tabs);
}

function _renderNavTabs(tabs) {
  // Desktop nav
  var html = '';
  for (var i = 0; i < tabs.length; i++) {
    var t = tabs[i];
    html += '<button class="' + (state.tab === t.id ? 'active' : '') +
            '" onclick="navigate(\'' + t.id + '\')">' +
            '<span class="nav-icon">' + (t.icon || '') + '</span>' +
            '<span class="nav-label">' + t.label + '</span>' +
            '</button>';
  }
  document.getElementById('main-nav').innerHTML = html;

  // Mobile drawer
  var mhtml = '';
  for (var i = 0; i < tabs.length; i++) {
    var t = tabs[i];
    mhtml += '<button class="' + (state.tab === t.id ? 'active' : '') +
             '" onclick="mobileNavTo(\'' + t.id + '\')">' + (t.icon ? t.icon + ' ' : '') + t.label + '</button>';
  }
  // Divider + Konto-Aktionen im Drawer
  mhtml += '<div class="mobile-nav-divider"></div>';
  if (currentUser) {
    mhtml += '<button onclick="mobileNavClose();showUserMenu()">🔑 Konto / Passwort</button>';
    mhtml += '<button onclick="mobileNavClose();logout()" style="color:rgba(255,150,150,.9)">⏻ Abmelden</button>';
  } else {
    mhtml += '<button onclick="mobileNavClose();showLogin()">🔐 Anmelden</button>';
    mhtml += '<button onclick="mobileNavClose();showRegister()">📝 Registrieren</button>';
  }
  var el = document.getElementById('mobile-nav-items');
  if (el) el.innerHTML = mhtml;
}

function toggleBurgerMenu() {
  var isOpen = document.getElementById('mobile-nav-drawer').classList.contains('open');
  if (isOpen) closeBurgerMenu(); else openBurgerMenu();
}
function openBurgerMenu() {
  var drawer = document.getElementById('mobile-nav-drawer');
  drawer.style.visibility = '';
  drawer.classList.add('open');
  document.getElementById('mobile-nav-overlay').classList.add('open');
  document.getElementById('burger-btn').classList.add('open');
  document.getElementById('burger-btn').setAttribute('aria-expanded', 'true');
  document.body.style.overflow = 'hidden';
}
function closeBurgerMenu() {
  document.getElementById('mobile-nav-drawer').classList.remove('open');
  document.getElementById('mobile-nav-overlay').classList.remove('open');
  document.getElementById('burger-btn').classList.remove('open');
  document.getElementById('burger-btn').setAttribute('aria-expanded', 'false');
  document.body.style.overflow = '';
}
function mobileNavClose() { closeBurgerMenu(); }
function mobileNavTo(tab) { closeBurgerMenu(); navigate(tab); }

function renderLegalPage(type) {
  var cfg = appConfig || {};
  var titles   = { datenschutz: 'Datenschutz', nutzung: 'Nutzungsbedingungen', impressum: 'Impressum' };
  var defaults = { datenschutz: FOOTER_DEFAULT_DS, nutzung: FOOTER_DEFAULT_NU, impressum: FOOTER_DEFAULT_IMP };
  var cfgKeys  = { datenschutz: 'footer_datenschutz_text', nutzung: 'footer_nutzung_text', impressum: 'footer_impressum_text' };
  var text = cfg[cfgKeys[type]] || defaults[type] || '';
  var title = titles[type] || type;
  // Einfaches Markdown → HTML (h1, h2, bold, italic, listen)
  function mdToHtml(md) {
    var lines = md.split('\n');
    var out = [];
    var inUl = false;
    for (var li = 0; li < lines.length; li++) {
      var l = lines[li].replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      if (l.match(/^# /)) {
        if (inUl) { out.push('</ul>'); inUl = false; }
        out.push('<h1 style="font-size:22px;font-weight:700;margin:16px 0 10px;color:var(--primary)">' + l.slice(2) + '</h1>');
      } else if (l.match(/^## /)) {
        if (inUl) { out.push('</ul>'); inUl = false; }
        out.push('<h2 style="font-size:16px;font-weight:700;margin:20px 0 6px;color:var(--text)">' + l.slice(3) + '</h2>');
      } else if (l.match(/^- /)) {
        if (!inUl) { out.push('<ul style="margin:8px 0 8px 20px">'); inUl = true; }
        out.push('<li style="margin:4px 0">' + l.slice(2) + '</li>');
      } else {
        if (inUl) { out.push('</ul>'); inUl = false; }
        out.push(l === '' ? '<br>' : '<p style="margin:6px 0">' + l + '</p>');
      }
    }
    if (inUl) out.push('</ul>');
    return out.join('\n')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>');
  }
  var html = '<p style="margin:8px 0">' + mdToHtml(text) + '</p>';
  var isAdmin = currentUser && currentUser.rolle === 'admin';
  document.getElementById('main-content').innerHTML =
    '<div style="max-width:720px;margin:0 auto">' +
      '<div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">' +
        '<button class="btn btn-ghost btn-sm" onclick="history.back()" style="white-space:nowrap">&#x2190; Zurück</button>' +
        (isAdmin ? '<button class="btn btn-ghost btn-sm" onclick="editLegalPage(&quot;' + type + '&quot;)" style="white-space:nowrap">&#x270F;&#xFE0E; Bearbeiten</button>' : '') +
      '</div>' +
      '<div class="panel" style="padding:28px 32px">' + html + '</div>' +
    '</div>';
}

async function editLegalPage(type) {
  var cfg = appConfig || {};
  var titles   = { datenschutz: 'Datenschutz', nutzung: 'Nutzungsbedingungen', impressum: 'Impressum' };
  var defaults = { datenschutz: FOOTER_DEFAULT_DS, nutzung: FOOTER_DEFAULT_NU, impressum: FOOTER_DEFAULT_IMP };
  var cfgKeys  = { datenschutz: 'footer_datenschutz_text', nutzung: 'footer_nutzung_text', impressum: 'footer_impressum_text' };
  var current = cfg[cfgKeys[type]] || defaults[type] || '';
  showModal(
    '<h2>' + titles[type] + ' bearbeiten <button class="modal-close" onclick="closeModal()">&#x2715;</button></h2>' +
    '<p style="font-size:12px;color:var(--text2);margin:0 0 12px">Markdown wird unterstützt: # Überschrift, ## Unterüberschrift, **fett**, *kursiv*, - Liste</p>' +
    '<textarea id="legal-edit-ta" style="width:100%;height:360px;box-sizing:border-box;padding:12px;border:1.5px solid var(--border);border-radius:8px;font-family:monospace;font-size:13px;background:var(--surf2);color:var(--text);resize:vertical">' + current.replace(/</g,'&lt;') + '</textarea>' +
    '<div class="modal-actions">' +
      '<button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button>' +
      '<button class="btn btn-ghost" onclick="resetLegalPage(&quot;' + type + '&quot;)">&#x21BA; Standard</button>' +
      '<button class="btn btn-primary" onclick="saveLegalPage(&quot;' + type + '&quot;)">&#x1F4BE; Speichern</button>' +
    '</div>'
  , false, true);
}

async function saveLegalPage(type) {
  var cfgKeys = { datenschutz: 'footer_datenschutz_text', nutzung: 'footer_nutzung_text', impressum: 'footer_impressum_text' };
  var ta = document.getElementById('legal-edit-ta');
  if (!ta) return;
  var payload = {}; payload[cfgKeys[type]] = ta.value;
  var r = await apiPost('einstellungen', payload);
  if (r && r.ok) {
    appConfig[cfgKeys[type]] = ta.value;
    closeModal();
    notify('Gespeichert.', 'ok');
    renderLegalPage(type);
  } else notify((r && r.fehler) || 'Fehler', 'err');
}

async function resetLegalPage(type) {
  var defaults = { datenschutz: FOOTER_DEFAULT_DS, nutzung: FOOTER_DEFAULT_NU, impressum: FOOTER_DEFAULT_IMP };
  var ta = document.getElementById('legal-edit-ta');
  if (ta) ta.value = defaults[type] || '';
}

function navigate(tab) {
  // Hash-Routen für Rechtliches (ohne Login nötig)
  if (tab === '#/datenschutz' || tab === 'datenschutz') { renderLegalPage('datenschutz'); return; }
  if (tab === '#/nutzung'     || tab === 'nutzung')     { renderLegalPage('nutzung'); return; }
  if (tab === '#/impressum'   || tab === 'impressum')   { renderLegalPage('impressum'); return; }
  if (tab === 'rekorde') { REK_CATS = []; state.allDisziplinen = {}; state.topDisziplinen = {}; }
  state.tab    = tab;
  state.page   = 1;
  state.veranstPage = 1;
  // subTab nur für Tabs mit eigenen Sub-Tabs zurücksetzen
  if (tab === 'ergebnisse') state.subTab = 'strasse';
  else if (tab === 'eintragen') state.subTab = 'bulk';
  else if (tab === 'admin') { /* subTab bleibt */ }
  else state.subTab = '';
  state.filters = {};
  buildNav();
  renderPage();
}


async function loadDisziplinen() {
  var r = await apiGet("disziplinen");
  if (r && r.ok) {
    state.disziplinen = r.data || [];
    var dl = document.getElementById("disz-list");
    if (dl) {
      dl.innerHTML = "";
      for (var i = 0; i < state.disziplinen.length; i++) {
        var opt = document.createElement("option");
        opt.value = state.disziplinen[i].disziplin;
        dl.appendChild(opt);
      }
    }
  }
}

async function loadAthleten() {
  var r = await apiGet('athleten');
  if (r && r.ok) {
    state.athleten = r.data;
    // _athletenMap synchron halten
    state._athletenMap = {};
    for (var _li = 0; _li < r.data.length; _li++) {
      state._athletenMap[r.data[_li].id] = r.data[_li];
    }
  }
}

// ── PAGE ROUTER ─────────────────────────────────────────────
async function renderPage() {
  // Anonyme User dürfen Dashboard und Bestleistungen sehen
  if (!currentUser && state.tab !== 'rekorde' && state.tab !== 'dashboard') {
    state.tab = 'rekorde';
    buildNav();
  }
  var el = document.getElementById('main-content');
  el.innerHTML = '<div class="loading"><div class="spinner"></div>Laden&hellip;</div>';
  try {
    if (state.tab === 'dashboard')       { await renderDashboard(); }
    else if (state.tab === 'veranstaltungen') { await renderVeranstaltungen(); }
    else if (state.tab === 'ergebnisse') { await renderErgebnisse(); }
    else if (state.tab === 'athleten')   { await renderAthleten(); }
    else if (state.tab === 'rekorde')    { await renderRekorde(); }
    else if (state.tab === 'eintragen')  { renderEintragen(); }
    else if (state.tab === 'admin')      { await renderAdmin(); }
  } catch(e) {
    console.error('renderPage Fehler:', e);
    el.innerHTML =
      '<div class="panel" style="padding:32px;text-align:center">' +
        '<div style="font-size:32px;margin-bottom:12px">&#x26A0;&#xFE0F;</div>' +
        '<div style="font-size:18px;font-weight:600;color:var(--accent);margin-bottom:8px">Fehler beim Laden</div>' +
        '<div style="color:var(--text2);font-size:13px;margin-bottom:20px">' + e.message + '</div>' +
        '<button class="btn btn-primary" onclick="renderPage()">&#x21BA; Erneut versuchen</button>' +
      '</div>';
  }
}

// ── DASHBOARD ──────────────────────────────────────────────

/* ── 03_dashboard.js ── */
async function renderDashboard() {
  var ds = getDarstellungSettings();
  // timeline_limit: erst aus Widget-Config, dann appConfig, dann Default
  var timelineLimit = 20;
  try {
    var _lay = JSON.parse(appConfig.dashboard_layout || '[]');
    for (var _tli = 0; _tli < _lay.length; _tli++) {
      for (var _tlj = 0; _tlj < (_lay[_tli].cols||[]).length; _tlj++) {
        var _tlc = _lay[_tli].cols[_tlj];
        if (_tlc.widget === 'timeline' && _tlc.tl_limit) { timelineLimit = parseInt(_tlc.tl_limit); break; }
      }
    }
  } catch(e) {}
  if (timelineLimit < 5) timelineLimit = parseInt(appConfig.dashboard_timeline_limit || 20) || 20;
  var r = await apiGet('dashboard?timeline_limit=' + timelineLimit);
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

  // Rekord-Timeline
  var timelineHtml = '';
  var timelineMax = rekordeTimeline.length;
  for (var i = 0; i < timelineMax; i++) {
    var rek = rekordeTimeline[i];
    var fmt = rek.fmt || '';
    var res = fmt === 'm' ? fmtMeter(rek.resultat) : fmtTime(rek.resultat, fmt === 's' ? 's' : undefined);
    var lbl = rek.label || '';
    var athletName = rek.athlet || '';
    var labelCls = (lbl.indexOf('Gesamtbestleistung') >= 0 || lbl.indexOf('Erste Gesamtleistung') >= 0) ? 'badge badge-gold' :
                   (lbl === 'PB' || lbl === 'Debüt') ? 'badge badge-pb' :
                   'badge badge-silver';
    var dotStyle = rek.extern ? 'background:var(--accent);' : '';
    if (!athletName) continue;
    var athLink = rek.athlet_id ? '<span class="athlet-link" style="color:var(--primary);font-weight:600" data-athlet-id="' + rek.athlet_id + '">' + athletName + '</span>' : '<span style="color:var(--primary);font-weight:600">' + athletName + '</span>';

    // Vorheriges Ergebnis aufbereiten
    var vorherHtml = '';
    if (rek.vorher_val !== null && rek.vorher_val !== undefined && !rek.extern) {
      var vorherFmt = fmtValNum(rek.vorher_val, fmt === 's' ? 's' : (fmt === 'm' ? 'm' : 'min'));
      if (vorherFmt) {
        vorherHtml = '<span style="color:var(--text2);font-size:12px;margin-left:6px">vorher: ' + vorherFmt + '</span>';
      }
    }

    timelineHtml += '<div class="timeline-item">';
    timelineHtml += '<div class="timeline-date">' + formatDate(rek.datum) + '</div>';
    timelineHtml += '<div class="timeline-body">';
    var diszLink = '<span class="athlet-link" style="color:var(--text);font-weight:600;cursor:pointer" data-rek-disz="' + rek.disziplin.replace(/"/g,'&quot;') + '" onclick="navigateToDisz(this.dataset.rekDisz)">' + ergDiszLabel(rek) + '</span>';
    timelineHtml += '<div class="timeline-disz">' + diszLink + ' <span class="' + labelCls + '">' + lbl + '</span></div>';
    timelineHtml += '<div class="timeline-athlet">' + athLink + '</div>';
    timelineHtml += '<div class="timeline-result">' + res + vorherHtml + '</div>';
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
        var vres = vfmt === 'm' ? fmtMeter(e2.resultat) : fmtTime(e2.resultat, vfmt === 's' ? 's' : undefined);
        var _vPace = diszKm(e2.disziplin) >= 1 ? calcPace(e2.disziplin, e2.resultat) : '';
        var vShowPace = _vPace && _vPace !== '00:00' && vfmt !== 'm' && vfmt !== 's';
        vrows +=
          '<tr>' +
            '<td><span class="athlet-link" onclick="openAthletById(' + e2.athlet_id + ')">' + e2.athlet + '</span></td>' +
            '<td>' + akBadge(e2.altersklasse) + '</td>' +
            '<td class="result">' + vres + '</td>' +
            '<td class="ort-text">' + (vShowPace ? fmtTime(_vPace, 'min/km') : '') + '</td>' +
            '<td>' + platzBadge(e2.ak_platzierung) + '</td>' +
            '<td>' + mstrBadge(e2.meisterschaft) + '</td>' +
          '</tr>';
      }
    }
    var isLast = (vi === veranst.length - 1);
    veranstHtml +=
      '<div class="veranst-dash-block" style="' + (isLast ? 'padding:14px 20px 4px' : 'border-bottom:1px solid var(--border);padding:14px 20px') + '">' +
        '<div class="veranst-meta" style="display:flex;justify-content:space-between;align-items:baseline;gap:4px;margin-bottom:6px">' +
          '<div>' +
            '<div style="font-weight:700;font-size:16px;color:var(--primary)">' + vname + '</div>' +
            '<div style="font-size:12px;color:var(--text2);margin-top:2px">' + formatDate(v.datum) + (v.ort ? ' &middot; ' + v.ort : '') + '</div>' +
          '</div>' +
          '<div style="font-size:12px;color:var(--text2);white-space:nowrap">' + v.anz_ergebnisse + ' Ergebnisse &middot; ' + v.anz_athleten + ' Athleten</div>' +
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
      var filteredTimeline = timelineHtml;
      if (hiddenTypes.length || prioOrder.join(',') !== 'gesamt,gender,ak,pb') {
        // Timeline-Items neu rendern mit Filterung + Priorisierung
        var filtItems = [];
        for (var ti = 0; ti < rekordeTimeline.length; ti++) {
          var rek2 = rekordeTimeline[ti];
          if (!rek2.athlet) continue;
          var lblParts = (rek2.label || '').split(' + ');
          // Alle Label-Teile auf Sichtbarkeit prüfen
          var visibleParts = [];
          for (var lpi = 0; lpi < lblParts.length; lpi++) {
            var t = timelineLabelType(lblParts[lpi]);
            if (hiddenTypes.indexOf(t) < 0) visibleParts.push(lblParts[lpi]);
          }
          if (!visibleParts.length) continue;
          // Prio nach prioOrder berechnen
          var bestPrio = 99;
          for (var vpi = 0; vpi < visibleParts.length; vpi++) {
            var pt = timelineLabelType(visibleParts[vpi]);
            var pi = prioOrder.indexOf(pt);
            if (pi >= 0 && pi < bestPrio) bestPrio = pi;
          }
          filtItems.push({ rek: rek2, label: visibleParts.join(' + '), prio: bestPrio });
        }
        // Sortieren: Datum desc, dann prio asc
        filtItems.sort(function(a,b) {
          var dc = b.rek.datum < a.rek.datum ? -1 : (b.rek.datum > a.rek.datum ? 1 : 0);
          return dc !== 0 ? dc : a.prio - b.prio;
        });
        filteredTimeline = '';
        for (var fi = 0; fi < filtItems.length; fi++) {
          var fItem = filtItems[fi].rek;
          var fLbl  = filtItems[fi].label;
          var fFmt  = fItem.fmt || '';
          var fRes  = fFmt === 'm' ? fmtMeter(fItem.resultat) : fmtTime(fItem.resultat, fFmt === 's' ? 's' : undefined);
          var fLblCls = (fLbl.indexOf('Gesamtbestleistung') >= 0 || fLbl.indexOf('Erste Gesamtleistung') >= 0) ? 'badge badge-gold' :
                        (fLbl === 'PB' || fLbl === 'Debüt') ? 'badge badge-pb' : 'badge badge-silver';
          var fAthLink = fItem.athlet_id
            ? '<span class="athlet-link" style="color:var(--primary);font-weight:600" data-athlet-id="' + fItem.athlet_id + '">' + fItem.athlet + '</span>'
            : '<span style="color:var(--primary);font-weight:600">' + fItem.athlet + '</span>';
          var fVorher = '';
          if (fItem.vorher_val !== null && fItem.vorher_val !== undefined && !fItem.extern) {
            var fVFmt = fmtValNum(fItem.vorher_val, fFmt === 's' ? 's' : (fFmt === 'm' ? 'm' : 'min'));
            if (fVFmt) fVorher = '<span style="color:var(--text2);font-size:12px;margin-left:6px">vorher: ' + fVFmt + '</span>';
          }
          var fDiszLink = '<span class="athlet-link" style="color:var(--text);font-weight:600;cursor:pointer" data-rek-disz="' + fItem.disziplin.replace(/"/g,'&quot;') + '" onclick="navigateToDisz(this.dataset.rekDisz)">' + ergDiszLabel(fItem) + '</span>';
          filteredTimeline +=
            '<div class="timeline-item">' +
              '<div class="timeline-date">' + formatDate(fItem.datum) + '</div>' +
              '<div class="timeline-body">' +
                '<div class="timeline-disz">' + fDiszLink + ' <span class="' + fLblCls + '">' + fLbl + '</span></div>' +
                '<div class="timeline-athlet">' + fAthLink + '</div>' +
                '<div class="timeline-result">' + fRes + fVorher + '</div>' +
              '</div>' +
            '</div>';
        }
        if (!filteredTimeline) filteredTimeline = '<div class="empty"><div class="empty-icon">&#x1F3C6;</div><div class="empty-text">Keine Einträge für diese Auswahl</div></div>';
      }
      return '<div class="panel" style="height:100%">' +
        '<div class="panel-header"><div class="panel-title">&#x1F3C6; ' + widgetTitle(wcfg, 'Neueste Bestleistungen') + '</div></div>' +
        '<div class="timeline">' + filteredTimeline + '</div>' +
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
              var vvres = vvfmt === 'm' ? fmtMeter(ve2.resultat) : fmtTime(ve2.resultat, vvfmt === 's' ? 's' : undefined);
              var vvpace = diszKm(ve2.disziplin) >= 1 ? calcPace(ve2.disziplin, ve2.resultat) : '';
              var vvShowPace = vvpace && vvpace !== '00:00' && vvfmt !== 'm' && vvfmt !== 's';
              var vvCells = { athlet: '<td><span class="athlet-link" onclick="openAthletById('+ve2.athlet_id+')">'+ve2.athlet+'</span></td>', ak: '<td>'+akBadge(ve2.altersklasse)+'</td>', result: '<td class="result">'+vvres+'</td>', pace: '<td class="ort-text">'+(vvShowPace?fmtTime(vvpace,'min/km'):'')+'</td>', platz: '<td>'+platzBadge(ve2.ak_platzierung)+'</td>', ms: '<td>'+mstrBadge(ve2.meisterschaft)+'</td>' };
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
          var isLast2 = (vvi === veranst.length - 1);
          vHtml += '<div class="veranst-dash-block" style="' + (isLast2?'padding:14px 20px 4px':'border-bottom:1px solid var(--border);padding:14px 20px') + '">' +
            '<div class="veranst-meta" style="display:flex;justify-content:space-between;align-items:baseline;gap:4px;margin-bottom:6px">' +
              '<div><div style="font-weight:700;font-size:16px;color:var(--primary)">' + vvname + '</div>' +
              '<div style="font-size:12px;color:var(--text2);margin-top:2px">' + formatDate(vv.datum) + (vv.ort?' &middot; '+vv.ort:'') + '</div></div>' +
              '<div style="font-size:12px;color:var(--text2);white-space:nowrap">' + vv.anz_ergebnisse + ' Ergebnisse &middot; ' + vv.anz_athleten + ' Athleten</div>' +
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
        var hAvatar = ha.avatar
          ? '<img src="' + ha.avatar + '" style="width:64px;height:64px;border-radius:50%;object-fit:cover;">'
          : '<div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--accent));color:var(--on-primary);display:flex;align-items:center;justify-content:center;font-family:Barlow Condensed,sans-serif;font-size:24px;font-weight:700;">' + nameInitials(ha.name||'?') + '</div>';

        // Gruppierung: gleiche AK-Kombination → eine Box, Disziplinen zusammenfassen.
        // Zusätzlich: konsekutive AK-Ranges komprimieren (W45,W50,W55,W60,W65 → W45–W65)

        function compressAKList(aks) {
          // Duplikate entfernen
          var seen = {}, unique = [];
          for (var _di = 0; _di < aks.length; _di++) { if (!seen[aks[_di]]) { seen[aks[_di]] = true; unique.push(aks[_di]); } }
          aks = unique;
          if (aks.length <= 2) return aks.join(' und ');
          var prefix = aks[0].replace(/\d+/,'');
          var nums = aks.map(function(a){ return parseInt(a.replace(/\D/g,''),10); });
          nums.sort(function(a,b){return a-b;});
          var allConsec = true;
          for (var _ci = 1; _ci < nums.length; _ci++) {
            if (nums[_ci] - nums[_ci-1] !== 5) { allConsec = false; break; }
          }
          if (allConsec && nums.length >= 3) {
            return prefix + nums[0] + '\u2013' + prefix + nums[nums.length-1];
          }
          var groups = [[nums[0]]];
          for (var _gi = 1; _gi < nums.length; _gi++) {
            if (nums[_gi] - nums[_gi-1] === 5) groups[groups.length-1].push(nums[_gi]);
            else groups.push([nums[_gi]]);
          }
          var gparts = groups.map(function(g) {
            if (g.length >= 3) return prefix + g[0] + '\u2013' + prefix + g[g.length-1];
            return g.map(function(n){ return prefix+n; }).join(', ');
          });
          return gparts.slice(0,-1).join(', ') + ' und ' + gparts[gparts.length-1];
        }

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
          var gesamtM = htitels.some(function(t){ return t.label === 'Gesamtbestleistung M\u00e4nner'; });
          var gesamtW = htitels.some(function(t){ return t.label === 'Gesamtbestleistung Frauen'; });
          var gesamt  = gesamtM || gesamtW;
          var hasMaenner = htitels.some(function(t){ return t.label === 'Bestleistung M\u00e4nner' || t.label === 'Bestleistung MHK'; });
          var hasFrauen  = htitels.some(function(t){ return t.label === 'Bestleistung Frauen'  || t.label === 'Bestleistung WHK'; });
          var akM = htitels.filter(function(t){ return /^Bestleistung M\d/.test(t.label); }).map(function(t){ return t.label.replace('Bestleistung ',''); });
          var akW = htitels.filter(function(t){ return /^Bestleistung W\d/.test(t.label); }).map(function(t){ return t.label.replace('Bestleistung ',''); });

          var parts = [];
          if (gesamtM) parts.push('Gesamtbestleistung M\u00e4nner');
          if (gesamtW) parts.push('Gesamtbestleistung Frauen');
          var mParts = [];
          if (hasMaenner) mParts.push('M\u00e4nner');
          if (akM.length) mParts.push(compressAKList(akM));
          if (mParts.length) parts.push('Bestleistung ' + joinList(mParts));
          var wParts = [];
          if (hasFrauen) wParts.push('Frauen');
          if (akW.length) wParts.push(compressAKList(akW));
          if (wParts.length) parts.push('Bestleistung ' + joinList(wParts));

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
            '<div style="font-size:12px;color:var(--text2);margin-bottom:10px">' + ha.titelCount + ' ' + (ha.titelCount === 1 ? 'Bestleistung' : 'Bestleistungen') + '</div>' +
            '<div style="display:flex;flex-wrap:wrap;justify-content:center;gap:2px">' + hBadgesHtml + '</div>' +
          '</div>';
      }
      var hofPanelTitle = widgetTitle(wcfg, 'Hall of Fame');
      return '<div class="panel" style="height:100%">' +
        '<div class="panel-header"><div class="panel-title">&#x1F3C6; ' + hofPanelTitle + '</div></div>' +
        hofHtml +
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
      layoutHtml += '<div style="margin-bottom:20px">' + renderWidget(cols[0]) + '</div>';
    } else {
      // Mehrspaltig: explizite Breiten + CSS-Custom-Properties für responsives Umbrechen
      var colsHtml = '';
      var gtcParts = [];
      var totalMin = 0;
      for (var ci = 0; ci < cols.length; ci++) {
        var col = cols[ci];
        var colMin = col.w ? col.w : 280;
        totalMin += colMin;
        // Jede Spalte bekommt ihre eigene --col-w Variable für Responsivness
        colsHtml += '<div style="min-width:' + colMin + 'px;flex:' + (col.w ? '0 0 ' + col.w + 'px' : '1') + '">' + renderWidget(col) + '</div>';
        gtcParts.push(col.w ? col.w + 'px' : '1fr');
      }
      var gtc = gtcParts.join(' ');
      // dash-row-wrap: umbrechen wenn Viewport < Summe der Mindestbreiten + gaps
      layoutHtml += '<div class="dash-row-wrap" style="--dash-gtc:' + gtc + ';--dash-min-total:' + (totalMin + (cols.length-1)*20) + 'px;margin-bottom:20px">' + colsHtml + '</div>';
    }
  }

  document.getElementById('main-content').innerHTML = layoutHtml;
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
// ── ERGEBNISSE ─────────────────────────────────────────────
async function renderErgebnisse() {

/* ── 04_ergebnisse.js ── */
  if (!state.allDisziplinen) {
    state.allDisziplinen = {};
  }
  await loadErgebnisseData();
}
var _ergSort = { col: 'datum', dir: 'DESC' };
var _ergAthletTimer = null;

function _buildMstrFilterHtml() {
  if (!MSTR_LIST || !MSTR_LIST.length) return '';
  var active = state.filters.meisterschaften || {};  // { id: true }
  var boxes = '';
  for (var i = 0; i < MSTR_LIST.length; i++) {
    var m = MSTR_LIST[i];
    var chk = active[String(m.id)] ? ' checked' : '';
    boxes += '<label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-size:13px;white-space:nowrap">' +
      '<input type="checkbox" value="' + m.id + '"' + chk + ' onchange="_mstrFilterToggle(' + m.id + ',this.checked)">' +
      m.label + '</label>';
  }
  return '<div class="fg" style="min-width:0"><label>Meisterschaften</label>' +
    '<div style="display:flex;flex-wrap:wrap;gap:6px 12px;padding:6px 0">' + boxes + '</div></div>';
}

function _mstrFilterToggle(id, checked) {
  if (!state.filters.meisterschaften) state.filters.meisterschaften = {};
  if (checked) state.filters.meisterschaften[String(id)] = true;
  else delete state.filters.meisterschaften[String(id)];
  state.page = 1;
  loadErgebnisseData();
}
function _ergAthletFilter(v) {
  clearTimeout(_ergAthletTimer);
  _ergAthletTimer = setTimeout(function() {
    state.filters.athlet = v;
    state.page = 1;
    loadErgebnisseData();
  }, 300);
}

function _ergSetSort(col) {
  if (_ergSort.col === col) {
    _ergSort.dir = _ergSort.dir === 'ASC' ? 'DESC' : 'ASC';
  } else {
    _ergSort.col = col;
    // Ergebnisse standardmäßig absteigend, außer Athlet/Disziplin
    _ergSort.dir = (col === 'athlet' || col === 'disziplin' || col === 'ak') ? 'ASC' : 'DESC';
  }
  state.page = 1;
  loadErgebnisseData();
}

async function loadErgebnisseData() {
  var params = 'limit=' + state.limit + '&offset=' + ((state.page - 1) * state.limit);
  params += '&sort=' + _ergSort.col + '&dir=' + _ergSort.dir;
  for (var k in state.filters) {
    if (k === 'meisterschaften') continue; // separat behandelt
    if (state.filters[k]) params += '&' + k + '=' + encodeURIComponent(state.filters[k]);
  }
  // Meisterschafts-Checkboxen: kommagetrennte IDs
  var mstrIds = Object.keys(state.filters.meisterschaften || {});
  if (mstrIds.length) params += '&meisterschaft=' + encodeURIComponent(mstrIds.join(','));
  var r = await apiGet(state.subTab + '?' + params);
  if (!r || !r.ok) {
    var el = document.getElementById('main-content');
    if (el) el.innerHTML = '<div class="panel" style="padding:24px;color:var(--accent)"><strong>Fehler beim Laden der Ergebnisse:</strong><br><code>' + (r && r.fehler ? r.fehler : 'Unbekannter Fehler') + '</code></div>';
    return;
  }
  var rows = r.data.rows; var total = r.data.total;
  var disziplinen = r.data.disziplinen || []; var aks = r.data.aks || []; var jahre = r.data.jahre || [];
  var kategorien = r.data.kategorien || [];

  var diszOptHtml = '<option value="">Alle</option>';
  for (var i = 0; i < disziplinen.length; i++) {
    var _d = disziplinen[i];
    var _dVal  = _d.disziplin_mapping_id ? String(_d.disziplin_mapping_id) : _d.disziplin;
    var _dLabel = _d.disziplin + (_d.kategorie_name ? ' (' + _d.kategorie_name + ')' : '');
    var _sel = (state.filters.disziplin_mapping_id === _dVal || state.filters.disziplin === _d.disziplin) ? ' selected' : '';
    diszOptHtml += '<option value="' + _dVal + '"' + _sel + '>' + _dLabel + '</option>';
  }
  var akOptHtml = '<option value="">Alle AK</option>';
  for (var i = 0; i < aks.length; i++) {
    akOptHtml += '<option value="' + aks[i] + '"' + (state.filters.ak === aks[i] ? ' selected' : '') + '>' + aks[i] + '</option>';
  }
  var jahrOptHtml = '<option value="">Alle Jahre</option>';
  for (var i = 0; i < jahre.length; i++) {
    jahrOptHtml += '<option value="' + jahre[i] + '"' + (state.filters.jahr == jahre[i] ? ' selected' : '') + '>' + jahre[i] + '</option>';
  }

  var katOptHtml = '<option value="">Alle Kategorien</option>';
  for (var ki = 0; ki < kategorien.length; ki++) {
    katOptHtml += '<option value="' + kategorien[ki].tbl_key + '"' + (state.filters.kategorie === kategorien[ki].tbl_key ? ' selected' : '') + '>' + kategorien[ki].name + '</option>';
  }

  var canEdit = currentUser && (currentUser.rolle === 'admin' || currentUser.rolle === 'editor');
  var totalPages = Math.ceil(total / state.limit);
  var tableHtml = buildErgebnisseTable(state.subTab, rows, canEdit);

  document.getElementById('main-content').innerHTML =
    '<div class="filter-bar">' +
      '<div class="fg"><label>Athlet</label><input type="text" id="erg-athlet-filter" placeholder="Name…" value="' + (state.filters.athlet||'') + '" oninput="_ergAthletFilter(this.value)" style="min-width:0;width:100%"/></div>' +
      '<div class="fg"><label>Kategorie</label><select onchange="setFilter(\'kategorie\',this.value)">' + katOptHtml + '</select></div>' +
      '<div class="fg"><label>Disziplin</label><select onchange="setFilter(\'disziplin_mapping_id\',this.value)">' + diszOptHtml + '</select></div>' +
      '<div class="fg"><label>Altersklasse</label><select onchange="setFilter(\'ak\',this.value)">' + akOptHtml + '</select></div>' +
      '<div class="fg"><label>Jahr</label><select onchange="setFilter(\'jahr\',this.value)">' + jahrOptHtml + '</select></div>' +
      _buildMstrFilterHtml() +
      '<button class="btn btn-ghost btn-sm" onclick="clearFilters()">&#x21BA; Reset</button>' +
    '</div>' +
    '<div class="panel">' +
      '<div class="panel-header"><div class="panel-title">' + (state.diszFilter || 'Alle Ergebnisse') + '</div><div class="panel-count">' + total + ' Ergebnisse</div></div>' +
      '<div class="table-scroll">' + tableHtml + '</div>' +
      buildPagination(state.page, totalPages, total) +
    '</div>';

  // Event-Delegation für Edit + Delete (muss nach DOM-Insertion passieren)
  var tbl = document.getElementById('ergebnisse-table');
  if (tbl) {
    tbl.addEventListener('click', function(e) {
      var editBtn = e.target.closest('[data-edit-id]');
      var delBtn  = e.target.closest('[data-del-id]');
      if (editBtn) {
        openEditErgebnis(
          editBtn.dataset.editId,
          editBtn.dataset.editTab,
          editBtn.dataset.editDisz,
          editBtn.dataset.editRes,
          editBtn.dataset.editAk,
          editBtn.dataset.editAkp,
          editBtn.dataset.editMstr,
          editBtn.dataset.editFmt,
          editBtn.dataset.editAthletId,
          editBtn.dataset.editAthletName
        );
      }
      if (delBtn) deleteErgebnis(delBtn.dataset.delTab, delBtn.dataset.delId);
    });
  }
}

function buildErgebnisseTable(subTab, rows, canEdit) {
  if (!rows.length) return '<div class="empty"><div class="empty-icon">&#x1F50D;</div><div class="empty-text">Keine Ergebnisse gefunden</div></div>';
  var headers = ['Datum','Athlet*in','AK','Disziplin','Ergebnis'];
  var hasPace = (subTab === 'strasse' || subTab === 'mittelstrecke' || subTab === 'sprint');
  if (hasPace) headers.push('Pace /km');
  headers.push('Platz AK');
  if (subTab !== 'mittelstrecke') headers.push('Meisterschaft');
  headers.push('Veranstaltung','Eingetragen');
  if (canEdit) headers.push('');

  // Sortierbare Spalten: key → API-sort-Parameter
  var sortKeys = { 'Datum': 'datum', 'Athlet*in': 'athlet', 'AK': 'ak', 'Disziplin': 'disziplin', 'Ergebnis': 'resultat', 'Platz AK': 'platz' };
  var thead = '<tr>';
  for (var i = 0; i < headers.length; i++) {
    var sk = sortKeys[headers[i]];
    if (sk) {
      var arrow = _ergSort.col === sk ? (_ergSort.dir === 'ASC' ? ' ▲' : ' ▼') : '';
      var active = _ergSort.col === sk ? ';color:var(--primary)' : '';
      thead += '<th style="cursor:pointer;user-select:none;white-space:nowrap' + active + '" onclick="_ergSetSort(\'' + sk + '\')">'+headers[i]+arrow+'</th>';
    } else {
      thead += '<th>' + headers[i] + '</th>';
    }
  }
  thead += '</tr>';

  var tbody = '';
  for (var i = 0; i < rows.length; i++) {
    var rr = rows[i];
    var ergebnis = (rr.fmt || (subTab === 'sprungwurf' ? 'm' : '')) === 'm' ? fmtMeter(rr.resultat) : fmtTime(rr.resultat, (rr.fmt === 's' || (!rr.fmt && subTab === 'sprint')) ? 's' : undefined);
    var ort = (rr.veranstaltung || '').split(' ').slice(1).join(' ');
    var cells =
      '<td class="ort-text">' + formatDate(rr.datum) + '</td>' +
      '<td><span class="athlet-link" onclick="openAthletById(' + rr.athlet_id + ')">' + rr.athlet + '</span></td>' +
      '<td>' + akBadge(rr.altersklasse) + '</td>' +
      '<td class="disziplin-text">' + diszMitKat(rr.disziplin) + '</td>' +
      '<td class="result">' + ergebnis + '</td>';
    var paceVal = diszKm(rr.disziplin) >= 1 ? calcPace(rr.disziplin, rr.resultat) : '';
    if (hasPace) cells += '<td class="ort-text">' + (paceVal ? fmtTime(paceVal, 'min/km') : '') + '</td>';
    cells += '<td>' + platzBadge(rr.ak_platzierung) + '</td>';
    if (subTab !== 'mittelstrecke') cells += '<td>' + (rr.meisterschaft ? mstrBadge(rr.meisterschaft) : '') + '</td>';
    cells += '<td class="ort-text">' + ort + '</td>';
    cells += '<td class="ort-text">' + (rr.eingetragen_von || 'Excel-Import') + '</td>';
    if (canEdit) {
      cells +=
        '<td style="white-space:nowrap">' +
          '<button class="btn btn-ghost btn-sm" style="margin-right:4px" data-edit-id="' + rr.id + '" data-edit-tab="' + subTab + '" data-edit-disz="' + (rr.disziplin||'') + '" data-edit-res="' + (rr.resultat||'') + '" data-edit-ak="' + (rr.altersklasse||'') + '" data-edit-akp="' + (rr.ak_platzierung||'') + '" data-edit-mstr="' + (rr.meisterschaft||'') + '" data-edit-fmt="' + (rr.fmt||'') + '" data-edit-athlet-id="' + (rr.athlet_id||'') + '" data-edit-athlet-name="' + (rr.athlet||'').replace(/"/g,'&quot;') + '">&#x270E;</button>' +
          '<button class="btn btn-danger btn-sm" data-del-id="' + rr.id + '" data-del-tab="' + subTab + '">&#x2715;</button>' +
        '</td>';
    }
    tbody += '<tr' + (rr.meisterschaft ? ' class="champ-row"' : '') + '>' + cells + '</tr>';
  }
  return '<table id="ergebnisse-table"><thead>' + thead + '</thead><tbody>' + tbody + '</tbody></table>';
}

var _editAthletTimer = null;
function _editAthletSearch(val) {
  clearTimeout(_editAthletTimer);
  var box = document.getElementById('edit-athlet-suggestions');
  if (!box) return;
  if (!val || val.length < 2) { box.innerHTML = ''; return; }
  _editAthletTimer = setTimeout(async function() {
    var r = await apiGet('autocomplete/athleten?q=' + encodeURIComponent(val));
    if (!r || !r.ok) return;
    var items = r.data || [];
    if (!items.length) { box.innerHTML = '<div style="padding:6px 10px;color:var(--text2);font-size:13px">Keine Treffer</div>'; return; }
    var html = '<div style="position:absolute;z-index:100;background:var(--surface);border:1px solid var(--border);border-radius:8px;box-shadow:var(--shadow);width:100%;max-height:200px;overflow-y:auto;margin-top:2px">';
    for (var i = 0; i < items.length; i++) {
      var a = items[i];
      html += '<div style="padding:8px 12px;cursor:pointer;font-size:14px;border-bottom:1px solid var(--border)" onmousedown="_editAthletPick(' + a.id + ',\'' + (a.name_nv||'').replace(/'/g, "\\'") + '\')">' + a.name_nv + '</div>';
    }
    html += '</div>';
    box.innerHTML = html;
  }, 200);
}
function _editAthletPick(id, name) {
  var inp = document.getElementById('edit-athlet-name');
  var hid = document.getElementById('edit-athlet-id');
  var box = document.getElementById('edit-athlet-suggestions');
  if (inp) inp.value = name;
  if (hid) hid.value = id;
  if (box) box.innerHTML = '';
}

async function openEditErgebnis(id, subTab, disz, res, ak, akp, mstr, fmt, athletId, athletName) {
  mstr = parseInt(mstr, 10) || '';
  var diszOptHtml = '';
  var diszList = state.disziplinen || [];
  var found = false;
  for (var i = 0; i < diszList.length; i++) {
    var sel = diszList[i] === disz ? ' selected' : '';
    if (diszList[i] === disz) found = true;
    diszOptHtml += '<option value="' + diszList[i] + '"' + sel + '>' + diszList[i] + '</option>';
  }
  if (!found && disz) diszOptHtml = '<option value="' + disz + '" selected>' + disz + '</option>' + diszOptHtml;

  var isAdmin = currentUser && currentUser.rolle === 'admin';
  var athletSelectHtml = '';
  if (isAdmin) {
    var rAth = await apiGet('athleten');
    var athList = (rAth && rAth.ok) ? rAth.data : [];
    var opts = '';
    for (var ai = 0; ai < athList.length; ai++) {
      var sel = String(athList[ai].id) === String(athletId) ? ' selected' : '';
      opts += '<option value="' + athList[ai].id + '"' + sel + '>' + athList[ai].name_nv + '</option>';
    }
    athletSelectHtml = '<div class="form-group full"><label>Athlet*in</label><select id="edit-athlet-id" style="width:100%;padding:9px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text)">' + opts + '</select></div>';
  }
  var html =
    '<h3 style="margin:0 0 20px;font-size:17px">Ergebnis bearbeiten</h3>' +
    '<div class="form-grid">' +
      athletSelectHtml +
      '<div class="form-group full"><label>Disziplin</label>' +
        '<select id="edit-disz" style="width:100%;padding:9px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text)">' + diszOptHtml + '</select>' +
      '</div>' +
      '<div class="form-group"><label>Ergebnis</label><input type="text" id="edit-res" value="' + (res||'') + '" placeholder="z.B. 01:45:30"/></div>' +
      '<div class="form-group"><label>Altersklasse</label><input type="text" id="edit-ak" value="' + (ak||'') + '" placeholder="z.B. M40"/></div>' +
      '<div class="form-group"><label>Platz AK</label><input type="number" id="edit-akp" value="' + (akp||'') + '" min="1"/></div>' +
      '<div class="form-group"><label>Meisterschaft</label><select id="edit-mstr">' + mstrOptions(mstr) + '</select></div>' +
    '</div>' +
    '<div style="display:flex;gap:10px;margin-top:20px;justify-content:flex-end">' +
      '<button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button>' +
      '<button class="btn btn-primary" id="edit-save-btn">&#x1F4BE; Speichern</button>' +
    '</div>';

  showModal(html);

  document.getElementById('edit-save-btn').addEventListener('click', function() {
    saveEditErgebnis(id, subTab);
  });
}

async function saveEditErgebnis(id, subTab) {
  var disz = (document.getElementById('edit-disz') || {}).value || '';
  var res  = ((document.getElementById('edit-res') || {}).value || '').trim();
  var ak   = ((document.getElementById('edit-ak') || {}).value || '').trim();
  var akp  = ((document.getElementById('edit-akp') || {}).value || '').trim();
  var mstr = ((document.getElementById('edit-mstr') || {}).value || '').trim();
  if (!disz || !res) { notify('Disziplin und Ergebnis sind Pflicht!', 'err'); return; }
  var newAthletId = ((document.getElementById('edit-athlet-id') || {}).value || '').trim();
  var body = { disziplin: disz, resultat: res, altersklasse: ak, pace: calcPace(disz, res) };
  if (akp)  body.ak_platzierung = parseInt(akp);
  if (mstr) body.meisterschaft = parseInt(mstr);
  if (newAthletId) body.athlet_id = parseInt(newAthletId);
  var r = await apiPut(subTab + '/' + id, body);
  if (r && r.ok) {
    closeModal();
    notify('Ergebnis gespeichert.', 'ok');
    loadErgebnisseData();
  } else {
    notify((r && r.fehler) ? r.fehler : 'Fehler beim Speichern', 'err');
  }
}

// ── ATHLETEN ───────────────────────────────────────────────

/* ── 05_athleten.js ── */
function _mkDelBtn(id) {
  return '<button class="btn btn-danger btn-sm" onclick="deleteAthletById(' + id + ')" title="Löschen">&#x2715;</button>';
}

function deleteAthletById(id) {
  var cached = _athLetenCache.alleAthleten || [];
  var name = '';
  for (var i = 0; i < cached.length; i++) { if (cached[i].id == id) { name = cached[i].name_nv || ''; break; } }
  deleteAthlet(id, name);
}

function _normN(s) {
  return s.toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
    .replace(/[,.\-]/g, ' ').replace(/\s+/g, ' ').trim();
}

async function showGeburtjahrImportModal() {
  // Athleten vorladen damit Vorschau und Import funktionieren
  if (!state._athletenMap || Object.keys(state._athletenMap).length === 0) {
    var rA = await apiGet('athleten');
    if (rA && rA.ok) {
      state._athletenMap = {};
      for (var ai = 0; ai < rA.data.length; ai++) {
        state._athletenMap[rA.data[ai].id] = rA.data[ai];
      }
    }
  }
  showModal(
    '<h2>&#x1F4C5; Geburtsjahr-Import <button class="modal-close" onclick="closeModal()">&#x2715;</button></h2>' +
    '<p style="font-size:13px;color:var(--text2);margin-bottom:8px">CSV mit Semikolon, erste Zeile = Header. Spalten: <code>Athlet NV;Geburtsdatum</code><br>' +
    'Geburtsdatum als Excel-Seriennummer (z.B. <code>40179</code>) oder TT.MM.JJJJ oder JJJJ-MM-TT.</p>' +
    '<textarea id="gj-csv" style="width:100%;height:220px;font-family:monospace;font-size:12px;box-sizing:border-box;padding:8px;background:var(--surface);color:var(--text);border:1px solid var(--border);border-radius:var(--radius)" placeholder="Athlet NV;Geburtsdatum\nMustermann, Erika;40179\nMuster, Max;1988-05-12"></textarea>' +
    '<div id="gj-preview" style="margin-top:10px;font-size:12px;max-height:180px;overflow-y:auto"></div>' +
    '<div class="modal-actions">' +
      '<button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button>' +
      '<button class="btn btn-primary" id="gj-import-btn">&#x1F4BE; Importieren</button>' +
    '</div>'
  );
  document.getElementById('gj-csv').addEventListener('input', _gjPreview);
  document.getElementById('gj-import-btn').addEventListener('click', doGeburtjahrImport);
}

function _excelDateToYear(val) {
  var s = String(val).trim();
  // Reine Zahl → Excel-Seriennummer
  if (/^\d{4,6}$/.test(s)) {
    var n = parseInt(s);
    // Excel-Epoch: 30.12.1899
    var d = new Date(Date.UTC(1899, 11, 30) + n * 86400000);
    return d.getUTCFullYear();
  }
  // TT.MM.JJJJ
  var m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) return parseInt(m[3]);
  // JJJJ-MM-TT oder JJJJ/MM/TT
  var m2 = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
  if (m2) return parseInt(m2[1]);
  // Nur Jahreszahl
  if (/^\d{4}$/.test(s)) return parseInt(s);
  return null;
}

function _gjParseCSV(raw) {
  var lines = raw.trim().split(/\r?\n/);
  var rows = [];
  var start = 0;
  // Header überspringen wenn erste Zeile kein Datum enthält
  if (lines.length > 0 && /athlet|name|geburt/i.test(lines[0])) start = 1;
  for (var i = start; i < lines.length; i++) {
    var parts = lines[i].split(';');
    if (parts.length < 2) continue;
    var nv = parts[0].trim();
    var rawDate = parts[1].trim();
    if (!nv || !rawDate) continue;
    var jahr = _excelDateToYear(rawDate);
    rows.push({ nv: nv, rawDate: rawDate, jahr: jahr });
  }
  return rows;
}

function _gjPreview() {
  var raw = document.getElementById('gj-csv').value;
  var rows = _gjParseCSV(raw);
  if (!rows.length) { document.getElementById('gj-preview').innerHTML = ''; return; }
  var html = '<table style="width:100%;border-collapse:collapse;font-size:12px">' +
    '<thead><tr style="border-bottom:1px solid var(--border)"><th style="text-align:left;padding:2px 6px">Athlet NV</th><th style="padding:2px 6px">Roh</th><th style="padding:2px 6px">Jahrgang</th><th style="padding:2px 6px">Match</th></tr></thead><tbody>';
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    // Besten Athleten-Match finden
    var match = _gjFindAthlet(r.nv);
    var matchCell = match
      ? '<span style="color:var(--green)">\u2713 ' + match.name_nv + '</span>'
      : '<span style="color:var(--accent)">? nicht gefunden</span>';
    var jahrCell = r.jahr
      ? '<strong>' + r.jahr + '</strong>'
      : '<span style="color:var(--accent)">?</span>';
    html += '<tr style="border-bottom:1px solid var(--border)"><td style="padding:2px 6px">' + r.nv + '</td><td style="padding:2px 6px;color:var(--text2)">' + r.rawDate + '</td><td style="text-align:center;padding:2px 6px">' + jahrCell + '</td><td style="padding:2px 6px">' + matchCell + '</td></tr>';
  }
  html += '</tbody></table>';
  document.getElementById('gj-preview').innerHTML = html;
}

function _gjFindAthlet(nv) {
  if (!state._athletenMap) return null;
  var norm = _normN(nv);
  var best = null;
  var ids = Object.keys(state._athletenMap);
  for (var i = 0; i < ids.length; i++) {
    var a = state._athletenMap[ids[i]];
    if (_normN(a.name_nv || '') === norm) return a;
    // Teilmatch als Fallback
    if (!best && _normN(a.name_nv || '').indexOf(norm) >= 0) best = a;
  }
  return best;
}

async function doGeburtjahrImport() {
  var raw = document.getElementById('gj-csv').value;
  var rows = _gjParseCSV(raw);
  if (!rows.length) { notify('Keine Daten gefunden.', 'err'); return; }
  // Athleten laden falls _athletenMap noch nicht befüllt
  if (!state._athletenMap || Object.keys(state._athletenMap).length === 0) {
    var rA = await apiGet('athleten');
    if (rA && rA.ok) {
      state._athletenMap = {};
      for (var ai = 0; ai < rA.data.length; ai++) {
        state._athletenMap[rA.data[ai].id] = rA.data[ai];
      }
    }
  }
  var ok = 0, skip = 0, err = 0;
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (!r.jahr) { skip++; continue; }
    var ath = _gjFindAthlet(r.nv);
    if (!ath) { skip++; continue; }
    var res = await apiPut('athleten/' + ath.id, { geburtsjahr: r.jahr });
    if (res && res.ok) ok++; else err++;
  }
  var msg = ok + ' aktualisiert';
  if (skip) msg += ', ' + skip + ' übersprungen';
  if (err)  msg += ', ' + err + ' Fehler';
  notify(msg, err ? 'err' : 'ok');
  if (ok > 0) { closeModal(); await loadAthleten(); await renderAthleten(); }
}


var _athLetenCache = { alleAthleten: [], alleGruppen: [] };
var _athSort = { col: 'name', dir: 1 }; // col: 'name'|'vorname'|'geschlecht'|'jahrgang'|'ak'|'ergebnisse'|'aktiv'|'letzte', dir: 1|-1

function _athSortHeader() {
  var cols = [
    { key: 'name',       label: 'Name' },
    { key: 'vorname',    label: 'Vorname' },
    { key: 'geschlecht', label: 'Gesch.' },
    { key: 'jahrgang',   label: 'Jahrgang' },
    { key: 'ak',         label: 'AK' },
    { key: 'gruppen',    label: 'Gruppen' },
    { key: 'ergebnisse', label: 'Erg.' },
    { key: 'letzte',     label: 'Letzte Akt.' },
    { key: 'aktiv',      label: 'Status' },
    { key: '',           label: '' },
  ];
  return cols.map(function(c) {
    if (!c.key) return '<th></th>';
    var arrow = _athSort.col === c.key ? (_athSort.dir === 1 ? ' ▲' : ' ▼') : '';
    var style = 'cursor:pointer;user-select:none;white-space:nowrap' + (_athSort.col === c.key ? ';color:var(--primary)' : '');
    return '<th style="' + style + '" onclick="_athSetSort(\'' + c.key + '\')">'+c.label+arrow+'</th>';
  }).join('');
}

function _athSetSort(col) {
  if (_athSort.col === col) _athSort.dir *= -1;
  else { _athSort.col = col; _athSort.dir = 1; }
  // thead aktualisieren (Pfeile)
  var thead = document.querySelector('#athlet-tabelle thead tr');
  if (thead) thead.innerHTML = _athSortHeader();
  _renderAthletenTable();
}

function _athSortRows(athleten, jetzt) {
  var col = _athSort.col, dir = _athSort.dir;
  return athleten.slice().sort(function(a, b) {
    var va, vb;
    if (col === 'name')       { va = (a.nachname||'').toLowerCase(); vb = (b.nachname||'').toLowerCase(); }
    else if (col === 'vorname')    { va = (a.vorname||'').toLowerCase(); vb = (b.vorname||'').toLowerCase(); }
    else if (col === 'geschlecht') { va = a.geschlecht||''; vb = b.geschlecht||''; }
    else if (col === 'jahrgang')   { va = a.geburtsjahr||0; vb = b.geburtsjahr||0; }
    else if (col === 'ak')         { va = (a.geschlecht&&a.geburtsjahr)?calcDlvAK(a.geburtsjahr,a.geschlecht,jetzt):''; vb = (b.geschlecht&&b.geburtsjahr)?calcDlvAK(b.geburtsjahr,b.geschlecht,jetzt):''; }
    else if (col === 'ergebnisse') { va = parseInt(a.anz_ergebnisse)||0; vb = parseInt(b.anz_ergebnisse)||0; }
    else if (col === 'letzte')     { va = parseInt(a.letzte_aktivitaet)||0; vb = parseInt(b.letzte_aktivitaet)||0; }
    else if (col === 'aktiv')      { va = a.aktiv?1:0; vb = b.aktiv?1:0; }
    else                           { va = (a.name_nv||'').toLowerCase(); vb = (b.name_nv||'').toLowerCase(); }
    if (va < vb) return -dir;
    if (va > vb) return dir;
    return 0;
  });
}


function _renderAthletenTable() {
  var aktGruppe = state.filters.gruppe || '';
  var alleAthleten = _athLetenCache.alleAthleten || [];
  var canEdit = currentUser && (currentUser.rolle === 'admin' || currentUser.rolle === 'editor');
  var isAdmin = currentUser && currentUser.rolle === 'admin';
  var jetzt = new Date().getFullYear();

  var athleten = alleAthleten;
  if (aktGruppe) {
    athleten = alleAthleten.filter(function(a) {
      var gs = a.gruppen || [];
      for (var gi = 0; gi < gs.length; gi++) { if (gs[gi].name === aktGruppe) return true; }
      return false;
    });
  }
  state._athletenMap = {};
  // Erst _athletenMap befüllen (für AK-Berechnung bei Sortierung)
  for (var i = 0; i < athleten.length; i++) state._athletenMap[athleten[i].id] = athleten[i];
  var sorted = _athSortRows(athleten, jetzt);
  _athLetenCache._lastSorted = sorted;
  var rows = '';
  for (var i = 0; i < sorted.length; i++) {
    var a = sorted[i];
    var canDel = currentUser && currentUser.rolle === 'admin' && parseInt(a.anz_ergebnisse) === 0;
    var aktuellAK = (a.geschlecht && a.geburtsjahr) ? calcDlvAK(a.geburtsjahr, a.geschlecht, jetzt) : '';
    rows +=
      '<tr>' +
        '<td><span class="athlet-link" onclick="openAthletById(' + a.id + ')">' + a.nachname + '</span></td>' +
        '<td>' + (a.vorname || '') + '</td>' +
        '<td>' + akBadge(a.geschlecht) + '</td>' +
        '<td style="color:var(--text2);font-size:13px">' + (a.geburtsjahr || '') + '</td>' +
        '<td><span style="font-size:12px;font-weight:600;color:var(--primary)">' + aktuellAK + '</span></td>' +
        '<td>' + renderGruppenInline(a.gruppen) + '</td>' +
        '<td><span class="badge badge-platz">' + a.anz_ergebnisse + '</span></td>' +
        '<td style="color:var(--text2);font-size:13px;text-align:center">' + (a.letzte_aktivitaet || '–') + '</td>' +
        '<td>' + (a.aktiv ? '<span class="badge badge-aktiv">Aktiv</span>' : '<span class="badge badge-inaktiv">Inaktiv</span>') + '</td>' +
        '<td style="white-space:nowrap">' +
          (canEdit ? '<button class="btn btn-ghost btn-sm" onclick="showAthletEditModal(' + a.id + ')">&#x270F;&#xFE0E;</button>' : '') +
          (isAdmin && a.aktiv ? '<button class="btn btn-ghost btn-sm" title="Deaktivieren" style="color:var(--text2)" onclick="toggleAthletAktiv(' + a.id + ',0)">&#x23FC;&#xFE0E;</button>' : '') +
          (isAdmin && !a.aktiv ? '<button class="btn btn-ghost btn-sm" title="Aktivieren" style="color:var(--green)" onclick="toggleAthletAktiv(' + a.id + ',1)">&#x23FB;&#xFE0E;</button>' : '') +
          (canDel ? _mkDelBtn(a.id) : '') +
        '</td>' +
      '</tr>';
  }
  var tbody = document.querySelector('#athlet-tabelle tbody');
  var count = document.getElementById('athlet-count');
  if (tbody) tbody.innerHTML = rows;
  if (count) count.textContent = athleten.length + ' Athleten';
  // Fokus auf Suchfeld wiederherstellen
  var sf = document.getElementById('athlet-suche');
  if (sf && document.activeElement !== sf) { /* nicht stören */ }
}

async function renderAthleten() {
  var s = state.filters.suche || '';
  var aktGruppe = state.filters.gruppe || '';
  var rA = await apiGet(s ? 'athleten?suche=' + encodeURIComponent(s) : 'athleten');
  var rG = await apiGet('gruppen');
  if (!rA || !rA.ok) return;
  var alleAthleten = rA.data;
  var alleGruppen = (rG && rG.ok) ? rG.data : [];
  var canEdit = currentUser.rolle === 'admin' || currentUser.rolle === 'editor';
  // Cache befüllen für _renderAthletenTable
  _athLetenCache.alleAthleten = alleAthleten;
  _athLetenCache.alleGruppen = alleGruppen;

  // Gruppen-Buttons
  var gruppenBtns = '<button class="rek-cat-btn' + (!aktGruppe ? ' active' : '') + '" onclick="state.filters.gruppe=\'\';renderAthleten()">Alle</button>';
  for (var gi = 0; gi < alleGruppen.length; gi++) {
    var g = alleGruppen[gi];
    gruppenBtns += '<button class="rek-cat-btn' + (aktGruppe === g.name ? ' active' : '') + '" onclick="state.filters.gruppe=\'' + g.name.replace(/'/g,"\\'") + '\';renderAthleten()">' + g.name + ' <span style="font-size:10px;opacity:.7">(' + g.anz_athleten + ')</span></button>';
  }

  document.getElementById('main-content').innerHTML =
    '<div class="rek-cat-tabs" style="margin-bottom:16px">' + gruppenBtns + '</div>' +
    '<div class="filter-bar">' +
      '<div class="fg"><label>Suche</label><input type="text" id="athlet-suche" placeholder="Name suchen&hellip;" value="' + s + '" oninput="setAthletSuche(this.value)" style="min-width:0;width:100%"/></div>' +
      (canEdit ? '<button class="btn btn-primary btn-sm" onclick="showNeuerAthletModal()">+ Neuer Athlet</button>' : '') +
      (canEdit ? '<button class="btn btn-ghost btn-sm" onclick="showGeburtjahrImportModal()" title="Geburtsjahr-Bulk-Import">&#x1F4C5; Geburtsjahr importieren</button>' : '') +
    '</div>' +
    '<div class="panel">' +
      '<div class="panel-header"><div class="panel-title">&#x1F464; Alle Athleten</div><div class="panel-count" id="athlet-count"></div></div>' +
      '<div class="table-scroll"><table id="athlet-tabelle">' +
        '<thead><tr>' + _athSortHeader() + '</tr></thead>' +
        '<tbody></tbody>' +
      '</table></div>' +
    '</div>';
  _renderAthletenTable();
  // letzte_aktivitaet asynchron nachladen (separater Query, hält Hauptliste nicht auf)
  _loadLetzteAktivitaet();
}

async function _loadLetzteAktivitaet() {
  var r = await apiGet('athleten-aktivitaet');
  if (!r || !r.ok) return;
  var map = r.data; // { athlet_id: jahr } — Keys kommen als Strings aus JSON
  // Cache aktualisieren (String-Key-Lookup mit explizitem Cast)
  var arr = _athLetenCache.alleAthleten || [];
  for (var i = 0; i < arr.length; i++) {
    var val = map[String(arr[i].id)];
    if (val !== undefined) arr[i].letzte_aktivitaet = val;
  }
  // DOM aktualisieren: jede tr per data-athlet-id zuordnen statt per Index
  var tbody = document.querySelector('#athlet-tabelle tbody');
  if (!tbody) return;
  var trs = tbody.querySelectorAll('tr');
  for (var i = 0; i < trs.length; i++) {
    // athlet-id aus dem Link im ersten td lesen
    var link = trs[i].querySelector('.athlet-link[onclick]');
    if (!link) continue;
    var m = (link.getAttribute('onclick') || '').match(/openAthletById\((\d+)\)/);
    if (!m) continue;
    var aid = m[1]; // String
    var val = map[aid];
    var td = trs[i].querySelectorAll('td')[7];
    if (td) td.textContent = val || '–';
  }
}

// Athleten-Profil State
var _apState = { kategorien: [], selKat: 0, selDisz: null, tab: 'ergebnisse', athletId: null };

function _apFmtRes(e, fallbackFmt) {
  var f = e.fmt || fallbackFmt || 'min';
  if (f === 'm') return fmtMeter(e.resultat);
  var isTStr = e.resultat && e.resultat.indexOf(':') >= 0;
  return fmtTime(e.resultat, (f === 's' && !isTStr) ? 's' : undefined);
}

function _apDiszSortKey(name) {
  // Benannte Distanzen
  var s = (name || '').toLowerCase().trim();
  var named = {
    'marathon': 42195, 'halbmarathon': 21098, 'halbmarathon straße': 21098,
    'marathon straße': 42195, 'ultramarathon': 80000,
    'dreisprung': -4, 'weitsprung': -3, 'hochsprung': -2, 'stabhochsprung': -1,
    'kugelstoß': -10, 'hammerwurf': -11, 'diskuswurf': -12, 'speerwurf': -13,
    'gewichtwurf': -14, 'ballwurf 200g': -15, 'schlagballwurf 80g': -16,
    'walking': 99000, '7km walking': 7000
  };
  for (var k in named) { if (s === k || s.indexOf(k) === 0) return named[k]; }
  // Zentrale Sortierfunktion (kennt Tausenderpunkte)
  return diszSortKey(name);
}

function _apBestOf(ergs, fmt) {
  var dir = (fmt === 'm') ? 'DESC' : 'ASC';
  var best = null;
  for (var i = 0; i < ergs.length; i++) {
    var e = ergs[i];
    var isTStr = e.resultat && e.resultat.indexOf(':') >= 0;
    var v = (fmt === 'm') ? parseFloat(e.resultat) :
            isTStr ? e.resultat : parseFloat(e.resultat);
    if (best === null) { best = e; continue; }
    var bTStr = best.resultat && best.resultat.indexOf(':') >= 0;
    var bv = (fmt === 'm') ? parseFloat(best.resultat) :
             bTStr ? best.resultat : parseFloat(best.resultat);
    if (dir === 'ASC' ? v < bv : v > bv) best = e;
  }
  return best;
}

function _apRender() {
  var kat = _apState.kategorien[_apState.selKat] || {};
  var ergs = kat.ergebnisse || [];
  var fmt = kat.fmt || 'min';

  // Disziplinen ermitteln (sortiert, mit PB)
  var diszMap = {};
  for (var i = 0; i < ergs.length; i++) {
    var _ek = ergDiszKey(ergs[i]);
    if (!diszMap[_ek]) diszMap[_ek] = [];
    diszMap[_ek].push(ergs[i]);
  }
  var diszList = Object.keys(diszMap).sort(function(a, b) {
    var ea = diszMap[a][0], eb = diszMap[b][0];
    var ka = _apDiszSortKey(ea ? ea.disziplin : a);
    var kb = _apDiszSortKey(eb ? eb.disziplin : b);
    return ka !== kb ? ka - kb : (ea ? ea.disziplin : a).localeCompare(eb ? eb.disziplin : b);
  });
  if (!_apState.selDisz || diszMap[_apState.selDisz] === undefined) {
    _apState.selDisz = diszList[0] || null;
  }

  // Kategorie-Tabs
  var katTabs = '';
  for (var ki = 0; ki < _apState.kategorien.length; ki++) {
    var k = _apState.kategorien[ki];
    var active = ki === _apState.selKat ? 'background:var(--btn-bg);color:#fff;' : 'background:var(--surf2);color:var(--text);';
    katTabs += '<button style="' + active + 'border:none;border-radius:8px;padding:5px 14px;font-size:12px;font-weight:600;cursor:pointer;margin:0 4px 6px 0" ' +
      'data-ap-kat="' + ki + '">' + k.name + ' <span style="opacity:.7">(' + (k.ergebnisse||[]).length + ')</span></button>';
  }

  // Disziplin-Buttons mit PB
  var diszBtns = '';
  for (var di = 0; di < diszList.length; di++) {
    var disz = diszList[di];
    var dErgs = diszMap[disz];
    var diszLabel = dErgs[0] ? ergDiszLabel(dErgs[0]) : disz;
    var pb = _apBestOf(dErgs, fmt);
    var pbStr = pb ? _apFmtRes(pb, fmt) : '';
    var active2 = disz === _apState.selDisz ? 'background:var(--accent);color:#fff;border-color:var(--accent);' : 'background:var(--surface);color:var(--text);border-color:var(--border);';
    diszBtns += '<button style="' + active2 + 'border:1px solid;border-radius:10px;padding:6px 12px;font-size:11px;font-weight:600;cursor:pointer;margin:0 6px 6px 0;text-align:left;line-height:1.4" ' +
      'data-ap-disz="' + disz.replace(/"/g,'&quot;') + '">' +
      '<div>' + diszLabel + '</div>' +
      '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:14px;font-weight:700;opacity:.9">' + pbStr + '</div>' +
    '</button>';
  }

  // Ergebnisse der gewählten Disziplin
  var filteredErgs = _apState.selDisz ? (diszMap[_apState.selDisz] || []) : [];
  var showPace = (fmt !== 'm' && fmt !== 's');
  var rows = '';
  for (var i = 0; i < filteredErgs.length; i++) {
    var e = filteredErgs[i];
    var resStr = _apFmtRes(e, fmt);
    var paceStr = (showPace && diszKm(e.disziplin) >= 1) ? fmtTime(calcPace(e.disziplin, e.resultat), 'min/km') : '';
    var ort = (e.veranstaltung || '').split(' ').slice(1).join(' ');
    rows += '<tr>' +
      '<td>' + formatDate(e.datum) + '</td>' +
      '<td>' + (e.altersklasse || '&ndash;') + '</td>' +
      '<td class="result">' + resStr + '</td>' +
      (showPace ? '<td class="ort-text">' + paceStr + '</td>' : '') +
      '<td class="ort-text">' + ort + '</td>' +
    '</tr>';
  }
  var paceHeader = showPace ? '<th style="padding:4px 6px;text-align:left">Pace /km</th>' : '';
  var tableHtml = rows ?
    '<table style="width:100%;font-size:12px;border-collapse:collapse">' +
      '<thead><tr style="color:var(--text2);border-bottom:2px solid var(--border)">' +
        '<th style="padding:4px 6px;text-align:left">Datum</th>' +
        '<th style="padding:4px 6px;text-align:left">AK</th>' +
        '<th style="padding:4px 6px;text-align:left">Ergebnis</th>' +
        paceHeader +
        '<th style="padding:4px 6px;text-align:left">Veranstaltung</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table>' :
    '<div style="color:var(--text2);padding:12px 0;font-size:13px">Keine Einträge.</div>';

  document.getElementById('_ap-kat-tabs').innerHTML = katTabs;
  document.getElementById('_ap-disz-btns').innerHTML = diszBtns;
  document.getElementById('_ap-table').innerHTML = tableHtml;
}

async function openAthletById(id) {
  var r = await apiGet('athleten/' + id);
  if (!r || !r.ok) return;
  var athlet = r.data.athlet;
  var kategorien = r.data.kategorien || [];
  var initials = ((athlet.vorname || '')[0] || '') + ((athlet.nachname || '')[0] || '');
  var totalErg = 0;
  for (var ki = 0; ki < kategorien.length; ki++) totalErg += (kategorien[ki].ergebnisse || []).length;

  _apState.kategorien = kategorien;
  _apState.selKat = 0;
  _apState.selDisz = null;
  _apState.tab = 'ergebnisse';
  _apState.athletId = id;

  var canEdit = currentUser && (currentUser.rolle === 'admin' || currentUser.rolle === 'editor');

  var gruppen = athlet.gruppen || [];
  var gruppenTags = '';
  for (var gi = 0; gi < gruppen.length; gi++) {
    gruppenTags += '<span class="rek-cat-btn" style="font-size:12px;padding:3px 10px;cursor:default">' + gruppen[gi].name + '</span>';
  }

  showModal(
    '<h2 style="margin-bottom:12px">Athleten-Profil <button class="modal-close" onclick="closeModal()">&#x2715;</button></h2>' +
    '<div class="profile-header" style="margin-bottom:12px">' +
      '<div class="profile-avatar">' + initials.toUpperCase() + '</div>' +
      '<div>' +
        '<div style="font-size:20px;font-weight:700">' + (athlet.vorname || '') + ' ' + (athlet.nachname || '') + '</div>' +
        (gruppenTags ? '<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:6px">' + gruppenTags + '</div>' : '') +
        '<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:6px;align-items:center">' +
          '<span class="badge badge-ak">' + totalErg + ' Wettkämpfe</span>' +
          (athlet.geschlecht ? '<span class="badge" style="background:var(--surf2);color:var(--text)">' + (athlet.geschlecht === 'M' ? '♂ Männlich' : '♀ Weiblich') + '</span>' : '') +
          (athlet.geburtsjahr ? '<span class="badge" style="background:var(--surf2);color:var(--text2)">Jg. ' + athlet.geburtsjahr + '</span>' : '') +
          (function(){ var _ak = (athlet.geschlecht && athlet.geburtsjahr) ? calcDlvAK(athlet.geburtsjahr, athlet.geschlecht, new Date().getFullYear()) : ''; return _ak ? '<span class="badge" style="background:var(--primary);color:var(--on-primary);font-weight:700">' + _ak + ' ' + new Date().getFullYear() + '</span>' : ''; })() +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div style="display:flex;gap:8px;margin-bottom:14px;border-bottom:2px solid var(--border);padding-bottom:0">' +
      '<button id="_ap-tab-ergebnisse" style="background:none;border:none;border-bottom:2px solid var(--btn-bg);margin-bottom:-2px;padding:6px 14px;font-weight:700;color:var(--btn-bg);cursor:pointer;font-size:13px" onclick="_apSetTab(\'ergebnisse\')">&#x1F4CB; Ergebnisse</button>' +
      (canEdit ? '<button id="_ap-tab-pb" style="background:none;border:none;border-bottom:2px solid transparent;margin-bottom:-2px;padding:6px 14px;font-weight:600;color:var(--text2);cursor:pointer;font-size:13px" onclick="_apSetTab(\'pb\')">&#x1F3C5; Externe PBs</button>' : '') +
    '</div>' +
    '<div id="_ap-kat-tabs" style="margin-bottom:12px"></div>' +
    '<div id="_ap-disz-btns" style="margin-bottom:12px;display:flex;flex-wrap:wrap"></div>' +
    '<div id="_ap-table" style="flex:1;overflow-y:auto;min-height:0"></div>' +
    '<div id="_ap-pb-panel" style="display:none;flex:1;overflow-y:auto;min-height:0"></div>' +
    '<div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">Schlie&szlig;en</button></div>',
    'profile'
  );

  _apRender();

  // Event-Delegation im Modal
  document.getElementById('modal-container').addEventListener('click', function(ev) {
    var el = ev.target;
    while (el && el.id !== 'modal-container') {
      if (el.getAttribute && el.getAttribute('data-ap-kat') !== null) {
        _apState.selKat = parseInt(el.getAttribute('data-ap-kat'), 10);
        _apState.selDisz = null;
        _apRender(); return;
      }
      if (el.getAttribute && el.getAttribute('data-ap-disz') !== null) {
        _apState.selDisz = el.getAttribute('data-ap-disz');
        _apRender(); return;
      }
      el = el.parentNode;
    }
  });
}

function _apSetTab(tab) {
  _apState.tab = tab;
  var btnErg = document.getElementById('_ap-tab-ergebnisse');
  var btnPb  = document.getElementById('_ap-tab-pb');
  var aktStyle   = 'background:none;border:none;border-bottom:2px solid var(--btn-bg);margin-bottom:-2px;padding:6px 14px;font-weight:700;color:var(--btn-bg);cursor:pointer;font-size:13px';
  var inaktStyle = 'background:none;border:none;border-bottom:2px solid transparent;margin-bottom:-2px;padding:6px 14px;font-weight:600;color:var(--text2);cursor:pointer;font-size:13px';
  if (btnErg) btnErg.setAttribute('style', tab === 'ergebnisse' ? aktStyle : inaktStyle);
  if (btnPb)  btnPb.setAttribute('style',  tab === 'pb'         ? aktStyle : inaktStyle);
  var ergEls = ['_ap-kat-tabs', '_ap-disz-btns', '_ap-table'];
  for (var i = 0; i < ergEls.length; i++) {
    var el = document.getElementById(ergEls[i]);
    if (el) el.style.display = tab === 'ergebnisse' ? '' : 'none';
  }
  var pbPanel = document.getElementById('_ap-pb-panel');
  if (pbPanel) pbPanel.style.display = tab === 'pb' ? '' : 'none';
  if (tab === 'pb') _apRenderPb();
}

async function _apRenderPb() {
  var panel = document.getElementById('_ap-pb-panel');
  if (!panel) return;
  panel.innerHTML = '<div class="loading"><div class="spinner"></div>Laden&hellip;</div>';
  var r = await apiGet('athleten/' + _apState.athletId + '/pb');
  if (!r || !r.ok) { panel.innerHTML = '<div style="color:var(--accent)">Fehler beim Laden.</div>'; return; }
  var pbs = r.data || [];
  var canEdit = currentUser && (currentUser.rolle === 'admin' || currentUser.rolle === 'editor');

  var rows = '';
  for (var i = 0; i < pbs.length; i++) {
    var pb = pbs[i];
    rows += '<tr>' +
      '<td style="padding:6px 8px">' + diszMitKat(pb.disziplin) + '</td>' +
      '<td style="padding:6px 8px;font-family:\'Barlow Condensed\',sans-serif;font-weight:700;font-size:15px">' + (pb.resultat || '') + '</td>' +
      '<td style="padding:6px 8px;color:var(--text2);font-size:12px">' + (pb.wettkampf || '&ndash;') + '</td>' +
      '<td style="padding:6px 8px;color:var(--text2);font-size:12px">' + (pb.datum ? formatDate(pb.datum) : '&ndash;') + '</td>' +
      (canEdit ?
        '<td style="padding:6px 8px;white-space:nowrap">' +
          '<button class="btn btn-ghost btn-sm" data-pb-edit="' + pb.id + '">&#x270F;&#xFE0F;</button> ' +
          '<button class="btn btn-danger btn-sm" data-pb-del="' + pb.id + '" data-pb-disz="' + pb.disziplin.replace(/"/g,'&quot;') + '">&#x2715;</button>' +
        '</td>' : '<td></td>') +
    '</tr>';
  }

  var addBtn = canEdit ?
    '<button class="btn btn-primary btn-sm" style="margin-bottom:12px" onclick="showPbModal(' + _apState.athletId + ',null)">+ Externer PB</button>' : '';

  panel.innerHTML = addBtn +
    (rows ?
      '<table style="width:100%;font-size:13px;border-collapse:collapse">' +
        '<thead><tr style="color:var(--text2);border-bottom:2px solid var(--border)">' +
          '<th style="padding:6px 8px;text-align:left">Disziplin</th>' +
          '<th style="padding:6px 8px;text-align:left">Ergebnis</th>' +
          '<th style="padding:6px 8px;text-align:left">Wettkampf</th>' +
          '<th style="padding:6px 8px;text-align:left">Datum</th>' +
          '<th style="padding:6px 8px"></th>' +
        '</tr></thead><tbody>' + rows + '</tbody></table>' :
      '<div style="color:var(--text2);padding:20px 0;text-align:center;font-size:13px">Noch keine externen PBs eingetragen.</div>'
    );

  // Event-Delegation für Edit/Delete
  panel.addEventListener('click', function(ev) {
    var el = ev.target;
    while (el && el !== panel) {
      if (el.getAttribute && el.getAttribute('data-pb-edit')) {
        var pbId = el.getAttribute('data-pb-edit');
        showPbModal(_apState.athletId, pbId); return;
      }
      if (el.getAttribute && el.getAttribute('data-pb-del')) {
        var pbId2 = el.getAttribute('data-pb-del');
        var disz  = el.getAttribute('data-pb-disz');
        deletePb(_apState.athletId, pbId2, disz); return;
      }
      el = el.parentNode;
    }
  });
}

function showPbModal(athletId, pbId) {
  var isEdit = !!pbId;
  var pb = null;
  if (isEdit) {
    // pb-Daten aus dem Panel lesen (Button liegt in der Zeile)
    pb = null; // wird per API geladen wenn nötig – für Edit fülllen wir Felder manuell
  }
  var html =
    '<h2 style="margin-bottom:16px">' + (isEdit ? 'Externer PB bearbeiten' : 'Externer PB eintragen') +
      ' <button class="modal-close" onclick="closeModal();_apSetTab(\'pb\')">&#x2715;</button></h2>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">' +
      '<div style="grid-column:1/-1"><label style="font-size:12px;font-weight:600;color:var(--text2)">Disziplin *</label>' +
        '<input id="_pb-disz" class="form-control" type="text" placeholder="z.B. 10 km Straße" style="margin-top:4px"></div>' +
      '<div><label style="font-size:12px;font-weight:600;color:var(--text2)">Ergebnis *</label>' +
        '<input id="_pb-res" class="form-control" type="text" placeholder="z.B. 38:12" style="margin-top:4px"></div>' +
      '<div><label style="font-size:12px;font-weight:600;color:var(--text2)">Datum</label>' +
        '<input id="_pb-datum" class="form-control" type="date" style="margin-top:4px"></div>' +
      '<div style="grid-column:1/-1"><label style="font-size:12px;font-weight:600;color:var(--text2)">Wettkampf</label>' +
        '<input id="_pb-wk" class="form-control" type="text" placeholder="z.B. Berlin-Marathon" style="margin-top:4px"></div>' +
    '</div>' +
    '<div id="_pb-err" style="color:var(--accent);font-size:13px;min-height:18px;margin-bottom:8px"></div>' +
    '<div class="modal-actions">' +
      '<button class="btn btn-ghost" onclick="closeModal();_apSetTab(\'pb\')">Abbrechen</button>' +
      '<button class="btn btn-primary" onclick="savePb(' + athletId + ',' + (pbId || 'null') + ')">Speichern</button>' +
    '</div>';
  showModal(html);

  if (isEdit) {
    // Werte aus Tabellen-Zeile via API nachladen
    apiGet('athleten/' + athletId + '/pb').then(function(r2) {
      if (!r2 || !r2.ok) return;
      var list = r2.data || [];
      for (var i = 0; i < list.length; i++) {
        if (String(list[i].id) === String(pbId)) {
          document.getElementById('_pb-disz').value  = list[i].disziplin  || '';
          document.getElementById('_pb-res').value   = list[i].resultat   || '';
          document.getElementById('_pb-datum').value = list[i].datum      || '';
          document.getElementById('_pb-wk').value    = list[i].wettkampf  || '';
          break;
        }
      }
    });
  }
}

async function savePb(athletId, pbId) {
  var disz = (document.getElementById('_pb-disz').value || '').trim();
  var res  = (document.getElementById('_pb-res').value  || '').trim();
  var dat  = (document.getElementById('_pb-datum').value || '').trim();
  var wk   = (document.getElementById('_pb-wk').value   || '').trim();
  var err  = document.getElementById('_pb-err');
  if (!disz || !res) { err.textContent = 'Disziplin und Ergebnis sind Pflichtfelder.'; return; }
  var body = { disziplin: disz, resultat: res, datum: dat || null, wettkampf: wk || null };
  var r = pbId ? await apiPut('athleten/' + athletId + '/pb/' + pbId, body)
               : await apiPost('athleten/' + athletId + '/pb', body);
  if (!r || !r.ok) { err.textContent = r ? r.fehler : 'Fehler'; return; }
  closeModal();
  _apState.tab = 'pb';
  _apRenderPb();
  // pb-panel wieder anzeigen
  var pbPanel = document.getElementById('_ap-pb-panel');
  if (pbPanel) pbPanel.style.display = '';
}

async function deletePb(athletId, pbId, disz) {
  if (!confirm('Externen PB "' + disz + '" löschen?')) return;
  var r = await apiDel('athleten/' + athletId + '/pb/' + pbId);
  if (!r || !r.ok) { notify('Fehler beim Löschen.', 'error'); return; }
  _apRenderPb();
}

// ── REKORDE ────────────────────────────────────────────────
var REK_CATS = []; // wird dynamisch geladen

/* ── 06_rekorde.js ── */
async function renderRekorde() {
  var rs = state.rekState;
  if (rs.unique === undefined) rs.unique = true;
  if (rs.highlightCurYear  === undefined) rs.highlightCurYear  = true;
  if (rs.highlightPrevYear === undefined) rs.highlightPrevYear = false;
  if (rs.mergeAK           === undefined) rs.mergeAK           = true;
  var el = document.getElementById('main-content');

  // Kategorien dynamisch laden (nur mit Einträgen)
  if (!REK_CATS.length) {
    el.innerHTML = '<div class="loading"><div class="spinner"></div>Laden&hellip;</div>';
    var rk = await apiGet('kategorien');
    if (rk && rk.ok) {
      REK_CATS = rk.data
        .filter(function(k) { return parseInt(k.disz_anzahl) > 0; })
        .sort(function(a,b) { return a.reihenfolge - b.reihenfolge; })
        .map(function(k) { return { id: k.tbl_key, label: k.name, fmt: k.fmt === 'm' ? 'm' : k.fmt === 's' ? 's' : undefined }; });
    }
    if (!REK_CATS.length) {
      el.innerHTML = '<div class="empty"><div class="empty-icon">&#x1F3C6;</div><div class="empty-text">Keine Kategorien mit Ergebnissen vorhanden</div></div>';
      return;
    }
    if (!rs.kat) rs.kat = REK_CATS[0].id;
  }
  // Sicherstellen dass kat noch gültig ist
  var katValid = false;
  for (var ci = 0; ci < REK_CATS.length; ci++) { if (REK_CATS[ci].id === rs.kat) { katValid = true; break; } }
  if (!katValid) rs.kat = REK_CATS[0].id;

  if (!state.allDisziplinen) state.allDisziplinen = {};
  if (!state.topDisziplinen) state.topDisziplinen = {};

  if (!state.allDisziplinen[rs.kat] || !state.topDisziplinen[rs.kat]) {
    el.innerHTML = '<div class="loading"><div class="spinner"></div>Laden&hellip;</div>';
    var p1 = apiGet('rekorde/disziplinen?kat=' + rs.kat).then(function(r) {
      if (!r || !r.ok) { console.error('disziplinen Fehler:', r && r.fehler, r && r.trace); }
      state.allDisziplinen[rs.kat] = (r && r.ok) ? r.data : [];
    });
    var p2 = apiGet('rekorde/top-disziplinen?kat=' + rs.kat).then(function(r) {
      if (!r || !r.ok) { console.error('top-disziplinen Fehler:', r && r.fehler, r && r.trace); }
      state.topDisziplinen[rs.kat] = (r && r.ok) ? r.data : [];
    });
    await Promise.all([p1, p2]);
    // Diagnose: zeige Fehler im UI falls leer
    if (!state.allDisziplinen[rs.kat] || !state.allDisziplinen[rs.kat].length) {
      el.innerHTML = '<div class="panel" style="padding:24px;color:var(--accent)"><strong>Disziplinen konnten nicht geladen werden.</strong><br>Kategorie: <code>' + rs.kat + '</code><br>Bitte die Browser-Konsole (F12) prüfen.</div>';
      return;
    }
  }

  var diszList = state.allDisziplinen[rs.kat] || [];
  var topDisz  = state.topDisziplinen[rs.kat] || [];
  var topNames = topDisz.map(function(t) { return t.disziplin; });
  if (!rs.disz && topNames.length) { rs.disz = topNames[0]; rs.mapping_id = topDisz[0] ? (topDisz[0].mapping_id || null) : null; }
  else if (!rs.disz && diszList.length) { rs.disz = diszList[0].disziplin || diszList[0]; rs.mapping_id = diszList[0].mapping_id || null; }

  // Kategorie-Tabs
  var catHtml = '<div class="rek-cat-tabs">';
  for (var ci = 0; ci < REK_CATS.length; ci++) {
    var cat = REK_CATS[ci];
    catHtml += '<button class="rek-cat-btn' + (rs.kat === cat.id ? ' active' : '') + '" data-kat="' + cat.id + '" onclick="setRekKat(this.dataset.kat)">' + cat.label + '</button>';
  }
  catHtml += '</div>';

  // Top-5 prominent
  var topHtml = '<div class="rek-top-disz">';
  for (var ti = 0; ti < topNames.length; ti++) {
    var td = topNames[ti];
    var cnt = topDisz[ti].cnt;
    topHtml += '<button class="rek-top-btn' + (rs.disz === td ? ' active' : '') + '" data-disz="' + td.replace(/"/g, '&quot;') + '" onclick="setRekDisz(this.dataset.disz, this.dataset.mid)">' +
      '<span class="rek-top-name">' + td + '</span>' +
      '<span class="rek-top-cnt">' + cnt + (cnt === 1 ? ' Ergebnis' : ' Ergebnisse') + '</span>' +
    '</button>';
  }
  topHtml += '</div>';

  // Weitere Disziplinen
  // Weitere Disziplinen
  var restDisz = diszList.filter(function(d) { return topNames.indexOf(typeof d === 'object' ? d.disziplin : d) < 0; });
  var diszHtml = '';
  if (restDisz.length) {
    diszHtml += '<div style="font-size:11px;font-weight:600;text-transform:uppercase;color:var(--text2);letter-spacing:.06em;margin:4px 0 6px">Weitere Disziplinen</div>';
    diszHtml += '<div class="rek-top-disz" style="margin-top:0">';
    for (var di = 0; di < restDisz.length; di++) {
      var dd = typeof restDisz[di] === 'object' ? restDisz[di].disziplin : restDisz[di];
      var ddcnt = typeof restDisz[di] === 'object' ? (restDisz[di].cnt || 0) : 0;
      var ddmid = typeof restDisz[di] === 'object' ? (restDisz[di].mapping_id || '') : '';
      diszHtml += '<button class="rek-top-btn rek-top-btn--sm' + (rs.disz === dd ? ' active' : '') + '" data-disz="' + dd.replace(/"/g, '&quot;') + '" data-mid="' + ddmid + '" onclick="setRekDisz(this.dataset.disz, this.dataset.mid)">' +
        '<span class="rek-top-name">' + dd + '</span>' +
        '<span class="rek-top-cnt">' + ddcnt + (ddcnt === 1 ? ' Ergebnis' : ' Ergebnisse') + '</span>' +
      '</button>';
    }
    diszHtml += '</div>';
  } else {
    diszHtml = '<div style="height:8px"></div>';
  }
  if (!rs.disz) {
    el.innerHTML = catHtml + topHtml + diszHtml + '<div class="empty"><div class="empty-icon">&#x1F50D;</div><div class="empty-text">Keine Disziplinen vorhanden</div></div>';
    return;
  }

  el.innerHTML = catHtml + topHtml + diszHtml + '<div class="loading" style="padding:32px"><div class="spinner"></div>Lade Rekorde&hellip;</div>';

  var r = await apiGet('rekorde?kat=' + rs.kat + '&disz=' + encodeURIComponent(rs.disz) + '&merge_ak=' + (rs.mergeAK ? '1' : '0'));
  if (!r || !r.ok) {
    el.innerHTML = catHtml + topHtml + diszHtml + '<div class="panel" style="padding:24px;text-align:center;color:var(--accent)">' + (r && r.fehler ? r.fehler : 'Fehler') + '</div>';
    return;
  }
  var d = r.data;
  var catMeta = null;
  for (var ci = 0; ci < REK_CATS.length; ci++) { if (REK_CATS[ci].id === rs.kat) { catMeta = REK_CATS[ci]; break; } }
  var fmt = catMeta ? catMeta.fmt : undefined;

  var TOP = 10;
  function uniqueRows(rows) {
    if (!rs.unique) return rows.slice(0, TOP);
    var seen = {}; var out = [];
    for (var i = 0; i < rows.length && out.length < TOP; i++) {
      var key = rows[i].athlet_id || rows[i].athlet;
      if (!seen[key]) { seen[key] = true; out.push(rows[i]); }
    }
    return out;
  }

  var titleHtml = '<div class="rek-disz-title">' + rs.disz + '</div>';

  // ── 1. GESAMT ─────────────────────────────────────────────
  var sectionHtml = rekSectionHead('Gesamt');
  sectionHtml += '<div class="panel" style="overflow:hidden;margin-bottom:28px">' + buildRekTable(uniqueRows(d.gesamt || []), fmt, false, rs.kat === 'strasse', 'Athlet*in') + '</div>';

  // ── 2. MÄNNER / FRAUEN ────────────────────────────────────
  var mRows = uniqueRows(d.maenner || []);
  var wRows = uniqueRows(d.frauen  || []);
  sectionHtml += rekSectionHead('Frauen / M&auml;nner');
  sectionHtml +=
    '<div class="mw-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:28px">' +
      '<div class="rek-ak-card">' +
        '<div class="rek-ak-header" style="background:var(--primary);color:var(--on-primary)">Frauen</div>' +
        buildRekTable(wRows, fmt, false, rs.kat === 'strasse', 'Athletin') +
      '</div>' +
      '<div class="rek-ak-card">' +
        '<div class="rek-ak-header">M&auml;nner</div>' +
        buildRekTable(mRows, fmt, false, rs.kat === 'strasse', 'Athlet') +
      '</div>' +
    '</div>';

  // ── 3. NACH AK ────────────────────────────────────────────
  var byAk = d.by_ak || {};
  var akKeys = Object.keys(byAk);
  akKeys.sort(function(a, b) {
    // Gibt einen sortierbaren String zurück
    // Reihenfolge: W-Jugend, W-Senior (aufsteigend), wjB, wjA, WU23, WU18, WHK, W30+
    //              M-Jugend, M-Senior (aufsteigend), mjB, mjA, MHK, M30+
    function rank(k) {
      // Numerische AK extrahieren: M35 → 35, W10 → 10
      var numMatch = k.match(/^([MW])(\d+)$/);
      if (numMatch) {
        var g = numMatch[1] === 'W' ? '1' : '2';
        var n = parseInt(numMatch[2], 10);
        // Jugend (< 20) vor HK-Bereich (20-29) vor Masters (30+)
        // Jugend: 0100–0119, HK-Bereich (MHK-Slot): 0120–0129, Masters: 0130+
        var slot = n < 20 ? (100 + n) : n < 30 ? (200 + n) : (300 + n);
        return g + '_' + String(slot).padStart(4, '0');
      }
      // Sonderfälle Frauen
      if (k === 'WU8')      return '1_0108';
      if (k === 'WU10-U12') return '1_0110';
      if (k === 'WU18')     return '1_0118';
      if (k === 'WU23')     return '1_0123';
      if (k === 'wjB')      return '1_0214'; // vor mjA/MHK-Slot
      if (k === 'wjA')      return '1_0215';
      if (k === 'WHK')      return '1_0220';
      if (k === 'F' || k === 'W') return '1_0221';
      // Sonderfälle Männer
      if (k === 'MU8')      return '2_0108';
      if (k === 'MU10-12')  return '2_0110';
      if (k === 'MU18')     return '2_0118';
      if (k === 'MU20')     return '2_0120';
      if (k === 'MU23')     return '2_0123';
      if (k === 'mjB')      return '2_0214';
      if (k === 'mjA')      return '2_0215';
      if (k === 'MHK' || k === 'M') return '2_0220';
      if (k === 'U18')      return '1_0118'; // unklar → W-Seite
      // Unbekannte hinten
      return '9_' + k;
    }
    var ra = rank(a), rb = rank(b);
    return ra < rb ? -1 : ra > rb ? 1 : 0;
  });

  sectionHtml += rekSectionHead('Nach Altersklasse');

  if (!akKeys.length) {
    sectionHtml += '<div class="empty" style="margin-bottom:28px"><div class="empty-text">Keine AK-Daten vorhanden</div></div>';
  } else {
    var prevGender = null;
    var grids = [[]];
    for (var aki = 0; aki < akKeys.length; aki++) {
      var ak = akKeys[aki];
      var isW = /^W/.test(ak) || ak === 'WHK' || ak === 'wjA' || ak === 'wjB';
      var curGender = isW ? 'w' : 'm';
      if (prevGender !== null && prevGender !== curGender) { grids.push([]); }
      grids[grids.length - 1].push({ ak: ak, isW: isW });
      prevGender = curGender;
    }
    for (var gi = 0; gi < grids.length; gi++) {
      if (gi > 0) sectionHtml += '<div style="height:14px"></div>';
      sectionHtml += '<div class="rek-ak-grid">';
      for (var ai = 0; ai < grids[gi].length; ai++) {
        var item = grids[gi][ai];
        var ak = item.ak; var isW = item.isW;
        var rows = uniqueRows(byAk[ak] || []);
        sectionHtml += '<div class="rek-ak-card">';
        sectionHtml += '<div class="rek-ak-header" style="' + (isW ? 'background:var(--primary);color:var(--on-primary)' : '') + '">' + ak + '</div>';
        sectionHtml += buildRekTable(rows, fmt, true, false);
        sectionHtml += '</div>';
      }
      sectionHtml += '</div>';
    }
  }

  // Optionen-Leiste
  var curYear = new Date().getFullYear();
  var uniqueHtml =
    '<div style="margin-top:24px;padding-top:14px;border-top:1px solid var(--border);display:flex;flex-wrap:wrap;gap:16px;align-items:center">' +
      '<label style="display:flex;align-items:center;gap:7px;cursor:pointer;font-size:13px;font-weight:600;color:var(--text2)">' +
        '<input type="checkbox" id="rek-merge-ak"' + (rs.mergeAK ? ' checked' : '') + ' onchange="toggleRekMergeAK(this.checked)" style="width:15px;height:15px;accent-color:var(--btn-bg);cursor:pointer">' +
        'Jugend-AK zu MHK/WHK zusammenfassen' +
      '</label>' +
      '<label style="display:flex;align-items:center;gap:7px;cursor:pointer;font-size:13px;font-weight:600;color:var(--text2)">' +
        '<input type="checkbox" id="rek-unique"' + (rs.unique ? ' checked' : '') + ' onchange="toggleRekUnique(this.checked)" style="width:15px;height:15px;accent-color:var(--btn-bg);cursor:pointer">' +
        'Jede*r Athlet*in nur einmal (beste Leistung)' +
      '</label>' +
      '<label style="display:flex;align-items:center;gap:7px;cursor:pointer;font-size:13px;font-weight:600;color:#b03020">' +
        '<input type="checkbox" id="rek-hl-cur"' + (rs.highlightCurYear ? ' checked' : '') + ' onchange="toggleRekHl(\'cur\',this.checked)" style="width:15px;height:15px;accent-color:#e05040;cursor:pointer">' +
        curYear + ' hervorheben' +
      '</label>' +
      '<label style="display:flex;align-items:center;gap:7px;cursor:pointer;font-size:13px;font-weight:600;color:#205090">' +
        '<input type="checkbox" id="rek-hl-prev"' + (rs.highlightPrevYear ? ' checked' : '') + ' onchange="toggleRekHl(\'prev\',this.checked)" style="width:15px;height:15px;accent-color:#4070c0;cursor:pointer">' +
        (curYear - 1) + ' hervorheben' +
      '</label>' +
    '</div>';

  el.innerHTML = catHtml + topHtml + diszHtml +
    '<div class="panel" style="padding:20px 24px 20px">' +
      titleHtml + sectionHtml + uniqueHtml +
    '</div>';
}

function rekSectionHead(label) {
  return '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:18px;font-weight:600;' +
         'color:var(--text);border-bottom:2px solid var(--border);padding-bottom:6px;margin:20px 0 14px">' +
         label + '</div>';
}

function toggleRekMergeAK(val) {
  state.rekState.mergeAK = val;
  renderRekorde();
}
function toggleRekUnique(val) {
  state.rekState.unique = val;
  renderRekorde();
}
function toggleRekHl(which, val) {
  if (which === 'cur')  state.rekState.highlightCurYear  = val;
  if (which === 'prev') state.rekState.highlightPrevYear = val;
  renderRekorde();
}

function buildRekTable(rows, fmt, compact, showPace, athletLabel) {
  if (!rows || !rows.length) return '<div class="empty" style="padding:16px"><div class="empty-text">Keine Eintr&auml;ge</div></div>';
  var html = '<table class="rek-table">';
  if (!compact) {
    html += '<thead><tr><th></th><th>' + (athletLabel || 'Athlet') + '</th><th>Ergebnis</th>';
    if (showPace) html += '<th>Pace /km</th>';
    html += '<th>AK</th><th>Datum</th></tr></thead>';
  }
  html += '<tbody>';
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var rankCls = i===0 ? 'gold' : i===1 ? 'silver' : i===2 ? 'bronze' : '';
    var result = fmt === 'm' ? fmtMeter(r.resultat) : fmtTime(r.resultat, fmt);
    var curYear2 = new Date().getFullYear();
    var rowYear  = r.datum ? parseInt(r.datum.substr(0,4), 10) : 0;
    var rowCls   = '';
    var rs2 = state.rekState;
    if (rs2.highlightCurYear  && rowYear === curYear2)     rowCls = ' hl-cur-year';
    if (rs2.highlightPrevYear && rowYear === curYear2 - 1) rowCls = ' hl-prev-year';
    html += '<tr class="' + rowCls.trim() + '">';
    html += '<td>' + medalBadge(i + 1) + '</td>';
    var athletInner = r.athlet_id ? '<span class="athlet-link" data-athlet-id="' + r.athlet_id + '">' + (r.athlet || '&ndash;') + '</span>' : (r.athlet || '&ndash;');
    html += '<td style="font-weight:600">' + athletInner + '</td>';
    html += '<td class="result">' + result + '</td>';
    if (showPace) html += '<td class="ort-text">' + (diszKm(r.disz) >= 1 && calcPace(r.disz, r.resultat) ? fmtTime(calcPace(r.disz, r.resultat), 'min/km') : '&ndash;') + '</td>';
    if (!compact) html += '<td>' + akBadge(r.altersklasse) + '</td>';
    html += '<td class="ort-text">' + formatDate(r.datum) + '</td>';
    html += '</tr>';
  }
  html += '</tbody></table>';
  return html;
}


function setRekKat(kat) {
  state.rekState.kat  = kat;
  state.rekState.disz = null;
  state.rekState.view = 'gesamt';
  renderRekorde();
}
function setRekDisz(disz, mid) {
  state.rekState.disz = disz;
  state.rekState.mapping_id = mid ? parseInt(mid) : null;
  state.rekState.view = 'gesamt';
  renderRekorde();
}
function navigateToDisz(disz) {
  // Kategorie der Disziplin ermitteln
  var kat = null;
  var diszArr = state.disziplinen || [];
  for (var i = 0; i < diszArr.length; i++) {
    if (diszArr[i].disziplin === disz && diszArr[i].tbl_key) { kat = diszArr[i].tbl_key; break; }
  }
  if (kat) state.rekState.kat = kat;
  state.rekState.disz = disz;
  state.rekState.view = 'gesamt';
  navigate('rekorde');
}
function setRekView(v) {
  state.rekState.view = v;
  renderRekorde();
}

// ── EINTRAGEN ──────────────────────────────────────────────

/* ── 07_eintragen.js ── */
function renderEintragen() {
  var sub = state.subTab || 'bulk';
  var isRR = sub === 'raceresult';
  var isBulk = sub === 'bulk';

  var tabHtml = '<div class="subtabs" style="margin-bottom:20px">' +
    '<button class="subtab' + (sub==='bulk'       ? ' active' : '') + '" onclick="setSubTab(\'bulk\')">📋︎ Bulk-Eintragen</button>' +
    '<button class="subtab' + (sub==='raceresult' ? ' active' : '') + '" onclick="setSubTab(\'raceresult\')">🌍︎ RaceResult-Import</button>' +
  '</div>';

  var today = new Date().toISOString().slice(0, 10);

  var content = '';

  if (isBulk) {
    content =
      '<div class="panel" style="padding:24px">' +
        '<div class="panel-title" style="margin-bottom:4px">&#x1F4CB; Bulk-Eintragen</div>' +
        '<div style="color:var(--text2);font-size:13px;margin-bottom:16px">Mehrere Ergebnisse auf einmal eintragen &ndash; alle geh&ouml;ren zur selben Veranstaltung.</div>' +
        '<div style="display:flex;gap:8px;margin-bottom:16px">' +
          '<button id="bk-toggle-neu" class="btn btn-primary btn-sm" onclick="bkToggleVeranst(\'neu\')">+ Neue Veranstaltung</button>' +
          '<button id="bk-toggle-best" class="btn btn-ghost btn-sm" onclick="bkToggleVeranst(\'best\')">&#x1F4C5; Bestehende w&auml;hlen</button>' +
        '</div>' +
        '<div id="bk-neu-form" class="form-grid" style="margin-bottom:16px">' +
          '<div class="form-group"><label>Datum *</label><input type="date" id="bk-datum" value="' + today + '"/></div>' +
          '<div class="form-group"><label>Ort *</label><input type="text" id="bk-ort" placeholder="z.B. D&uuml;sseldorf"/></div>' +
          '<div class="form-group"><label>Veranstaltungsname</label><input type="text" id="bk-evname" placeholder="z.B. Düsseldorf Marathon"/></div>' +
          '<div class="form-group"><label>Kategorie</label><select id="bk-kat" style="width:100%" onchange="bkKatChanged()">' + (function(){
            var seen={}, opts='<option value="">Alle Kategorien</option>';
            var disz=state.disziplinen||[];
            var kats=[];
            for(var i=0;i<disz.length;i++){var d=disz[i];if(d.tbl_key&&!seen[d.tbl_key]){seen[d.tbl_key]=true;kats.push({key:d.tbl_key,name:d.kategorie});}}
            for(var ki=0;ki<kats.length;ki++){opts+='<option value="'+kats[ki].key+'">'+kats[ki].name+'</option>';}
            return opts;
          })() + '</select></div>' +
        '</div>' +
        '<div id="bk-best-form" style="display:none;margin-bottom:16px">' +
          '<label style="font-size:12px;font-weight:600;color:var(--text2);display:block;margin-bottom:6px">Veranstaltung *</label>' +
          '<select id="bk-veranst-sel" style="width:100%;max-width:500px;padding:9px 12px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--surface);color:var(--text)">' +
            '<option value="">&#x2013; laden&hellip;</option>' +
          '</select>' +
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
              '<th style="padding:8px 6px;width:36px"></th>' +
            '</tr></thead>' +
            '<tbody id="bulk-rows"></tbody>' +
          '</table>' +
        '</div>' +
        '<div style="margin-top:12px;display:flex;gap:10px;align-items:center">' +
          '<button class="btn btn-ghost btn-sm" onclick="bulkAddRow()">+ Zeile hinzuf&uuml;gen</button>' +
          '<button class="btn btn-primary" onclick="bulkSubmit()">&#x1F4BE; Alle speichern</button>' +
          '<span id="bulk-status" style="font-size:13px;color:var(--text2)"></span>' +
        '</div>' +
      '</div>';
  } else if (isRR) {
    content =
      '<div class="panel" style="padding:24px">' +
        '<div class="panel-title" style="margin-bottom:4px">&#x1F30D; RaceResult-Import</div>' +
        '<div style="color:var(--text2);font-size:13px;margin-bottom:20px">Ergebnisse direkt von <strong>my.raceresult.com</strong> importieren. Alle TuS&nbsp;Oedt-Starter werden automatisch gefunden.</div>' +
        '<div style="margin-bottom:14px">' +
          '<label style="font-size:12px;font-weight:600;color:var(--text2);display:block;margin-bottom:6px">Kategorie <span style="color:var(--accent)">*</span></label>' +
          '<select id="rr-kat" onchange="rrKatChanged()" style="padding:9px 12px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--surface);color:var(--text);min-width:220px">' +
            '<option value="">&#x2013; bitte w\u00e4hlen &#x2013;</option>' +
            (function() {
              var seen = {}, opts = '';
              var disz = state.disziplinen || [];
              // Kategorien in ihrer Reihenfolge sammeln
              var kats = [];
              for (var i = 0; i < disz.length; i++) {
                var d = disz[i];
                if (d.tbl_key && !seen[d.tbl_key]) { seen[d.tbl_key] = true; kats.push({ key: d.tbl_key, name: d.kategorie }); }
              }
              for (var ki = 0; ki < kats.length; ki++) {
                opts += '<option value="' + kats[ki].key + '">' + kats[ki].name + '</option>';
              }
              return opts;
            })() +
          '</select>' +
        '</div>' +
        '<div style="display:flex;gap:10px;align-items:flex-end;margin-bottom:20px">' +
          '<div style="flex:1"><label style="font-size:12px;font-weight:600;color:var(--text2);display:block;margin-bottom:6px">RaceResult-URL oder Event-ID</label>' +
            '<input type="text" id="rr-url" placeholder="https://my.raceresult.com/354779/" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--surface);color:var(--text)"/>' +
          '</div>' +
          '<button class="btn btn-primary" id="rr-load-btn" onclick="rrFetch()" style="white-space:nowrap" disabled>&#x1F50D; Ergebnisse laden</button>' +
        '</div>' +
        '<div id="rr-preview"></div>' +
      '</div>';
  }

  document.getElementById('main-content').innerHTML = tabHtml + content;

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

// Disziplin-Optionen für Bulk-Dropdown
function bkAkOpts(geschlecht) {
  var wAKs = ['WHK','W8','W9','W10','W11','W12','W13','W14','W15','WU18','WU23','wjA','wjB','W30','W35','W40','W45','W50','W55','W60','W65','W70','W75','W80'];
  var mAKs = ['MHK','M8','M9','M10','M11','M12','M13','M14','M15','MU18','MU23','mjA','mjB','M30','M35','M40','M45','M50','M55','M60','M65','M70','M75','M80'];
  var list = geschlecht === 'W' ? wAKs : geschlecht === 'M' ? mAKs : wAKs.concat(mAKs);
  var opts = '<option value="">– optional –</option>';
  for (var i = 0; i < list.length; i++) opts += '<option value="' + list[i] + '">' + list[i] + '</option>';
  return opts;
}
function bkDiszOpts(kat) {
  var opts = '<option value="">– wählen –</option>';
  var list = state.disziplinen || [];
  for (var i = 0; i < list.length; i++) {
    var item = list[i];
    var d = (typeof item === 'object') ? item.disziplin : item;
    var k = (typeof item === 'object') ? item.tbl_key : '';
    if (kat && k && k !== kat) continue;
    opts += '<option value="' + d + '">' + d + '</option>';
  }
  return opts;
}

function bkKatChanged() {
  var kat = (document.getElementById('bk-kat') || {}).value || '';
  document.querySelectorAll('#bulk-rows .bk-disz').forEach(function(sel) {
    var prev = sel.value;
    sel.innerHTML = bkDiszOpts(kat);
    if (prev) { for (var i = 0; i < sel.options.length; i++) { if (sel.options[i].value === prev) { sel.value = prev; break; } } }
  });
}

// Pace berechnen: Disziplin-Name → Distanz in km → min:sec/km
function diszKm(disz) {
  if (!disz) return 0;
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
    '<td style="padding:4px 6px"><select class="bk-ak" id="bk-ak-' + idx + '" style="' + fld + '">' + bkAkOpts('') + '</select></td>' +
    '<td style="padding:4px 6px"><input class="bk-platz" type="number" placeholder="1" min="1" style="' + fld + '"/></td>' +
    '<td style="padding:4px 6px;text-align:center"><button onclick="bulkRemoveRow(' + idx + ')" style="background:none;border:none;cursor:pointer;color:var(--text2);font-size:16px;padding:2px 4px" title="Zeile entfernen">&#x2715;</button></td>' +
  '</tr>';
}

var _bulkRowCount = 0;
function bkUpdateAK(athSel, idx) {
  var opt = athSel.options[athSel.selectedIndex];
  var g    = opt ? (opt.dataset.g    || '') : '';
  var gebj = opt ? (opt.dataset.gebj || '') : '';
  var akSel = document.getElementById('bk-ak-' + idx);
  if (!akSel) return;
  var prev = akSel.value;
  akSel.innerHTML = bkAkOpts(g);
  // AK automatisch vorbelegen wenn noch kein Wert gesetzt
  if (!prev && g && gebj) {
    var eventJahr = _bkEventJahr();
    var ak = calcDlvAK(parseInt(gebj), g, eventJahr);
    if (ak) { akSel.value = ak; return; }
  }
  // vorherigen Wert wiederherstellen falls noch passt
  if (prev) { for (var i=0;i<akSel.options.length;i++) { if (akSel.options[i].value===prev) { akSel.value=prev; break; } } }
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
  tbody.appendChild(div.firstChild);
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
    datum  = (document.getElementById('bk-datum') || {}).value;
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
    var disziplin = row.querySelector('.bk-disz')   ? row.querySelector('.bk-disz').value.trim()  : '';
    var resultat  = row.querySelector('.bk-res')    ? row.querySelector('.bk-res').value.trim()   : '';
    if (!athlet_id && !disziplin && !resultat) continue; // leere Zeile
    items.push({
      datum: datum, ort: ort, veranstaltung_name: evname,
      veranstaltung_id: veranstId ? parseInt(veranstId) : null,
      athlet_id: parseInt(athlet_id) || null,
      disziplin: disziplin, resultat: resultat,
      altersklasse: row.querySelector('.bk-ak') ? row.querySelector('.bk-ak').value.trim() : '',
      ak_platzierung: row.querySelector('.bk-platz') && row.querySelector('.bk-platz').value ? parseInt(row.querySelector('.bk-platz').value) : null,
    });
  }
  if (!items.length) { notify('Keine Eintr&auml;ge zum Speichern!', 'err'); return; }

  document.getElementById('bulk-status').innerHTML = '&#x23F3; Speichert ' + items.length + ' Eintr&auml;ge&hellip;';
  var r = await apiPost('ergebnisse/bulk', { items: items });
  if (r && r.ok) {
    var msg = r.data.imported + ' gespeichert';
    if (r.data.skipped) msg += ', ' + r.data.skipped + ' &uuml;bersprungen';
    notify(msg, 'ok');
    document.getElementById('bulk-status').innerHTML = '&#x2705; ' + msg;
    if (r.data.errors && r.data.errors.length) console.warn('Bulk-Fehler:', r.data.errors);
  } else {
    notify((r && r.fehler) ? r.fehler : 'Fehler', 'err');
    document.getElementById('bulk-status').innerHTML = '';
  }
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
  var eventId = (raw.match(/(\d{4,7})/) || [])[1];
  if (!eventId) { notify('Keine g\u00fcltige Event-ID gefunden.', 'err'); return; }

  var preview = document.getElementById('rr-preview');
  preview.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text2)">&#x23F3; Lade Konfiguration&hellip;</div>';

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

    // Zusätzlicher Event-Info-Endpoint für Datum
    if (!_cfgDateRaw) {
      try {
        var _evResp = await fetch('https://my.raceresult.com/' + eventId + '/RRPublish/data/event?lang=de', { headers: hdrs });
        if (_evResp.ok) {
          var _evData = JSON.parse(await _evResp.text());
          _rrDebug.eventEndpoint = JSON.stringify(_evData).slice(0, 300);
          var _evDate = _evData.Date || _evData.EventDate || _evData.date || _evData.StartDate || _evData.start_date || '';
          if (_evDate && !_cfgDateRaw) _cfgDateRaw = String(_evDate);
        }
      } catch(e) { _rrDebug.eventEndpointErr = String(e); }
    }
    // Komma und Land abschneiden: "Wachtendonk, Deutschland" → "Wachtendonk"
    if (eventOrtCfg) eventOrtCfg = eventOrtCfg.split(',')[0].trim();
    var contestObj = cfg.contests || cfg.Contests || {};
    _rrDebug.cfgKeys = Object.keys(cfg).slice(0, 20);
    // listname aus Config ermitteln
    // lists kann sein: Array [{Name:"01_Ergebnislisten|Final", Contest:"0", ...}]
    //                  oder Objekt {"02-ERGEBNISSE|xyz": {...}}
    var listName = '';
    var listContest = null; // Contest-Einschränkung aus List-Eintrag ("0" = alle)
    var listSource = cfg.list || cfg.lists || {};
    var listPrio = ['ERGEBNIS','RESULT','GESAMT','FINISH','ZIEL','OVERALL','EINZEL','FINAL'];
    if (Array.isArray(listSource)) {
      // Prio-Suche: Einzelergebnisse bevorzugen
      for (var lk = 0; lk < listSource.length && !listName; lk++) {
        var entry = listSource[lk];
        var ename = entry.Name || entry.name || entry.listname || '';
        var lkey = ename.toUpperCase();
        // Staffel-Listen überspringen
        if (lkey.indexOf('STAFF') >= 0 || lkey.indexOf('RELAY') >= 0) continue;
        for (var lp = 0; lp < listPrio.length; lp++) {
          if (lkey.indexOf(listPrio[lp]) >= 0) {
            listName = ename;
            listContest = entry.Contest !== undefined ? String(entry.Contest) : null;
            break;
          }
        }
      }
      // Fallback: ersten Nicht-Staffel-Eintrag nehmen
      if (!listName) {
        for (var lk = 0; lk < listSource.length; lk++) {
          var entry = listSource[lk];
          var ename = entry.Name || entry.name || entry.listname || '';
          if (ename.toUpperCase().indexOf('STAFF') < 0 && ename.toUpperCase().indexOf('RELAY') < 0) {
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
      _rrDebug.listsRaw = JSON.stringify(listSource).slice(0, 200);
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
    _rrDebug.cfgDateRaw = _cfgDateRaw;
    _rrDebug.cfgAllKeys = JSON.stringify(Object.keys(cfg)).slice(0, 300);
    var _cfgTimeSec = cfg.Time !== undefined ? parseInt(cfg.Time) : null;
    _rrDebug.cfgTime = _cfgTimeSec !== null ? (String(cfg.Time) + ' (' + Math.floor(_cfgTimeSec/3600) + 'h' + String(Math.floor((_cfgTimeSec%3600)/60)).padStart(2,'0') + 'min Startzeit)') : '–';
    if (_rrDebug.eventEndpoint) _rrDebug.cfgDateRaw += ' | eventEndpoint: ' + _rrDebug.eventEndpoint;
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
    var eventOrt = eventOrtCfg || '';
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
          '&listname=' + encodeURIComponent(listName) +
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

        // DataFields kalibrieren
        var df = payload.DataFields || [];
        if (Array.isArray(df) && df.length > 0) {
          iAK = -1; iYear = -1; iGeschlecht = -1;
          // Alle Spaltenindizes zurücksetzen damit jede Liste frisch kalibriert wird
          iName = 3; iClub = 6; iNetto = 7; iZeit = 8; iPlatz = 2;
          for (var fi = 0; fi < df.length; fi++) {
            var f = df[fi].toLowerCase();
            if (f.indexOf('anzeigename') >= 0 || f.indexOf('lfname') >= 0) iName = fi;
            else if (f.indexOf('club') >= 0 || f.indexOf('verein') >= 0) iClub = fi;
            else if (f.indexOf('agegroup') >= 0 || f === '[agegroup1.nameshort]') iAK = fi;
            else if (f.indexOf('flag') >= 0 || f.indexOf('nation') >= 0) { /* skip */ }
            else if (f === 'year' || f === 'yob' || f === 'birthyear') iYear = fi;
            else if (f.indexOf('geschlechtmw') >= 0) iGeschlecht = fi;
            else if (f.indexOf('chip') >= 0 || f.indexOf('netto') >= 0) iNetto = fi;
            else if (f.indexOf('gun') >= 0 || f.indexOf('brutto') >= 0) iZeit = fi;
            else if (f.indexOf('autorankp') >= 0 || f.indexOf('mitstatus') >= 0) iPlatz = fi;
          }
          if (iNetto >= 0 && iZeit < 0) iZeit = iNetto;
          _rrDebug.iClub = iClub; _rrDebug.dfLog = df.join(', ');
        }

        // Daten flachmachen: {Contest: {Gruppe: [rows]}} -> {Contest/Gruppe: [rows]}
        var dRaw = payload.data || {};
        var _dks = Object.keys(dRaw);
        if (!_rrDebug.dataKeys) _rrDebug.dataKeys = JSON.stringify(_dks).slice(0, 200);
        var gf = payload.groupFilters || [];
        if (!_rrDebug.groupFilters) _rrDebug.groupFilters = JSON.stringify(gf).slice(0, 200);

        _dks.forEach(function(k) {
          var v = dRaw[k];
          var groups = Array.isArray(v) ? { '': v } : (v && typeof v === 'object' ? v : {});
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
              // gk immer aus Gruppen-Key ableiten (für Disziplin-Erkennung)
              var gk = gParts.length > 1 ? gParts[gParts.length-1] : (gParts[0] || '');
              if (iAK < 0 && gParts.length > 1) {
                var _gkClean = gk.replace(/^#[0-9]+_/, '').trim();
                if (/männl|male|herren/i.test(_gkClean)) _akFromGroup = 'M';
                else if (/weibl|female|frauen/i.test(_gkClean)) _akFromGroup = 'W';
                // AK direkt aus Gruppen-Key lesen (z.B. "M35", "W45")
                var _akMatch = _gkClean.match(/^([MW]\d{2}|[MW]U\d{2}|[MW])$/i);
                if (_akMatch) _akFromGroup = _akMatch[1].toUpperCase();
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
              allResults.push({ raw: row, contestName: cname, groupKey: gk, akFromGroup: _akFromGroup,
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
          var resp2 = await fetch(base4 + '?key=' + apiKey + '&listname=' + encodeURIComponent(listName) + '&page=results&contest=' + cid2 + '&r=all&l=de&_=1', { headers: hdrs, signal: _ac2.signal });
          clearTimeout(_t2);
          if (!resp2.ok) continue;
          var payload2 = JSON.parse(await resp2.text());
          var df2 = payload2.DataFields || [];
          if (Array.isArray(df2) && df2.length > 0) {
            iAK = -1; iYear = -1; iGeschlecht = -1;
            iName = 3; iClub = 6; iNetto = 7; iZeit = 8; iPlatz = 2;
            for (var fi2 = 0; fi2 < df2.length; fi2++) {
              var f2 = df2[fi2].toLowerCase();
              if (f2.indexOf('anzeigename') >= 0 || f2.indexOf('lfname') >= 0) iName = fi2;
              else if (f2.indexOf('club') >= 0 || f2.indexOf('verein') >= 0) iClub = fi2;
              else if (f2.indexOf('agegroup') >= 0) iAK = fi2;
              else if (f2 === 'year' || f2 === 'yob') iYear = fi2;
              else if (f2.indexOf('chip') >= 0 || f2.indexOf('netto') >= 0) iNetto = fi2;
              else if (f2.indexOf('gun') >= 0 || f2.indexOf('brutto') >= 0) iZeit = fi2;
              else if (f2.indexOf('autorankp') >= 0 || f2.indexOf('mitstatus') >= 0) iPlatz = fi2;
            }
            if (iNetto >= 0 && iZeit < 0) iZeit = iNetto;
          }
          var dRaw2 = payload2.data || {};
          Object.keys(dRaw2).forEach(function(k) {
            var v = dRaw2[k]; var groups = Array.isArray(v) ? {'':v} : (v&&typeof v==='object'?v:{});
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
    if (!allResults.length) {
      var dbgClubs = _rrDebug.clubSamples.length ? _rrDebug.clubSamples.slice(0,10).join(', ') : '(keine)';
      var vereinRaw2 = (appConfig.verein_kuerzel || appConfig.verein_name || '').toLowerCase().trim();
      preview.innerHTML =
        '<div style="background:var(--surf2);border-radius:10px;padding:16px">' +
          '<strong>&#x274C; Keine TuS-Oedt-Ergebnisse gefunden.</strong><br>' +
          '<div style="font-size:12px;color:var(--text2);margin-top:8px;line-height:1.7">' +
            contestIds.length + ' Contest(s) &bull; Listname: ' + listName + '<br>' +
            'Gesamt-Zeilen geladen: ' + _rrDebug.totalRows + '<br>' +
            'DataFields: ' + (_rrDebug.dataFields.join(', ') || '(keine)') + '<br>' +
            'iClub-Index: ' + _rrDebug.iClub + '<br>' +
            'Suchbegriff: &ldquo;' + vereinRaw2 + '&rdquo;<br>' +
            'Club-Werte in Daten (Sample): ' + dbgClubs + '<br>' +
            'Top-Level Keys: ' + ((_rrDebug.topKeys||[]).join(', ')||'?') + '<br>' +
            'Config-Keys: ' + ((_rrDebug.cfgKeys||[]).join(', ')||'?') + '<br>' +
            'API-Key: &ldquo;' + (_rrDebug.cfgKey||'leer') + '&rdquo; | Datum-Raw: ' + JSON.stringify(_rrDebug.cfgDateRaw||'(leer)') + ' → ' + (_rrDebug.eventDate||'leer') + ' | cfg.eventname: ' + (_rrDebug.cfgEventName||'–') + ' | HeadLine: ' + (_rrDebug.headLine||'–') + '<br>' +
            'Fehler: ' + ((_rrDebug.errors||[]).join('; ')||'keine') + '<br>' +
            'Contests: ' + (_rrDebug.contestSample||'?') + '<br>' +
            'groupFilters: ' + (_rrDebug.groupFilters||'–') + '<br>' +
            'searchRaw: ' + (_rrDebug.searchRaw||'–') + '<br>' +
            'extraContests: ' + JSON.stringify(_rrDebug.extraContests||[]) + '<br>' +
            'data-Keys: ' + (_rrDebug.dataKeys||'–') + '<br>' +
            'firstGroupKeys: ' + (_rrDebug.firstGroupKeys||'–') + '<br>' +
            'ListName aus Config: ' + (_rrDebug.listName||'?') + (_rrDebug.listContest !== undefined ? ' (Contest=' + _rrDebug.listContest + ')' : '') + (_rrDebug.fetchMode ? ' [' + _rrDebug.fetchMode + ']' : '') + '<br>' +
            'lists-Raw: ' + (_rrDebug.listsRaw||'?') + '<br>' +
            '<details><summary style="cursor:pointer">Raw (400 Zeichen)</summary><pre style="font-size:10px;overflow:auto;max-height:120px">' + (_rrDebug.firstVal||'') + '</pre></details>' +
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
  // Extrahiert Schlüsselbegriffe aus dem RR-Namen und sucht besten Treffer in System-Disziplinen
  var q = rrName.toLowerCase()
    .replace(/^#\d+_/, '')  // "#1_STADTWERKE Halbmarathon" → "stadtwerke halbmarathon"
    .replace(/lauf|rennen|wettbewerb|gesamt|einzel|lauf-/gi, '')
    .replace(/\s+/g, ' ').trim();

  // Zahl + Einheit extrahieren und in Meter normalisieren
  var qNorm = q.replace(/(\d)\.(\d{3})\b/g, '$1$2'); // 5.000 → 5000
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
    var m = s.replace(/(\d)\.(\d{3})\b/g, '$1$2').match(/(\d+[,.]?\d*)\s*(km|m\b)/);
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
    // Keyword-Bonus
    if (q.indexOf('marathon') >= 0 && dl.indexOf('marathon') >= 0) score += 5;
    if (q.indexOf('half') >= 0 && dl.indexOf('halb') >= 0) score += 5;
    if (q.indexOf('walking') >= 0 && dl.indexOf('walk') >= 0) score += 5;
    if (score > bestScore) { bestScore = score; best = d; }
  }
  return bestScore > 0 ? best : '';
}

function calcDlvAK(jahrgang, geschlecht, eventJahr) {
  var alter = eventJahr - parseInt(jahrgang);
  if (isNaN(alter) || alter < 5) return '';
  var g = (geschlecht || '').toUpperCase() === 'W' ? 'W' : 'M';
  if (alter < 13) return g + 'U12';
  if (alter < 15) return g + 'U14';
  if (alter < 17) return g + 'U16';
  if (alter < 19) return g + 'U18';
  if (alter < 21) return g + 'U20';
  if (alter < 23) return g + 'U23';
  if (alter < 30) return g;  // Hauptklasse: M / W
  var stufe = Math.floor(alter / 5) * 5;
  if (stufe > 75) stufe = 75;
  return g + stufe;
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
    var _cnResolved = _cname; if (!_cnResolved || _cnResolved.match(/^Contest \d+$/i)) _cnResolved = _dbgFirst.groupKey || _cnResolved;
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
    // Geschlecht aus Athleten-Profil des gematchten Athleten
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
      ak = String(raw[r.iAK] || '').trim(); // AK direkt aus Daten (z.B. M50)
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
    var platzAKnum = calcAKPlatz(ak, netto || zeit, _rrEventJahr) || '';
    var _cn = r.contestName || '';
    if (!_cn || _cn.match(/^Contest \d+$/i)) _cn = r.groupKey || _cn;
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
        '<td style="padding:4px 6px;font-size:12px;color:var(--text2)">' + ak + '</td>' +
        '<td style="padding:4px 6px;font-size:12px;color:var(--text2)">' + (platzAKnum || '–') + '</td>' +
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
      '<span style="font-size:12px;color:var(--text2);align-self:center">&#x2705; ' + results.length + ' TuS-Oedt-Ergebnis(se) &bull; Event ' + eventId + '</span>' +
      '' +
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
    var platzAKv = calcAKPlatz(ak, String(raw[r.iNetto] || raw[r.iZeit] || '').trim(), _eventJahr2) || null;
    items.push({
      datum: datum, ort: ort, veranstaltung_name: evname,
      athlet_id: athletId, disziplin: disziplin,
      resultat: zeit, altersklasse: ak,
      ak_platzierung: platzAKv,
      import_quelle: 'raceresult:' + eventId
    });
  }

  if (!items.length) { notify('Keine gültigen Einträge (Athlet + Disziplin benötigt).', 'err'); return; }
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

async function deleteRekord(id) {
  if (!confirm('Diesen Vereinsrekord wirklich l&ouml;schen?')) return;
  var r = await apiDel('rekorde/' + id);
  if (r && r.ok) { notify('Gel&ouml;scht.', 'ok'); await renderRekorde(); }
  else notify('Fehler: ' + ((r && r.fehler) || ''), 'err');
}

// ── ADMIN ──────────────────────────────────────────────────

/* ── 08_admin.js ── */
function adminSubtabs() {
  var t = state.adminTab || 'benutzer';
  return '<div class="subtabs" style="margin-bottom:20px">' +
    '<button class="subtab' + (t==='benutzer'       ? ' active' : '') + '" onclick="state.adminTab=\'benutzer\';renderAdmin()">👥 Benutzer</button>' +
    '<button class="subtab' + (t==='registrierungen'? ' active' : '') + '" onclick="state.adminTab=\'registrierungen\';renderAdmin()">📝 Registrierungen</button>' +
    '<button class="subtab' + (t==='disziplinen'    ? ' active' : '') + '" onclick="state.adminTab=\'disziplinen\';renderAdmin()">🏷️ Disziplinen</button>' +
    '<button class="subtab' + (t==='meisterschaften' ? ' active' : '') + '" onclick="state.adminTab=\'meisterschaften\';renderAdmin()">🏅 Meisterschaften</button>' +
    '<button class="subtab' + (t==='darstellung'    ? ' active' : '') + '" onclick="state.adminTab=\'darstellung\';renderAdmin()">🎨 Darstellung</button>' +
    '<button class="subtab' + (t==='dashboard_cfg'   ? ' active' : '') + '" onclick="state.adminTab=\'dashboard_cfg\';renderAdmin()">📊︎ Dashboard</button>' +
    '<button class="subtab' + (t==='papierkorb'     ? ' active' : '') + '" onclick="state.adminTab=\'papierkorb\';renderAdmin()">🗑️ Papierkorb</button>' +
  '</div>';
}

async function renderAdmin() {
  if (!state.adminTab) state.adminTab = 'benutzer';
  if (state.adminTab === 'disziplinen')    { await renderAdminDisziplinen(); return; }
  if (state.adminTab === 'meisterschaften'){ await renderAdminMeisterschaften(); return; }
  if (state.adminTab === 'papierkorb')     { await renderPapierkorb(); return; }
  if (state.adminTab === 'darstellung')    { renderAdminDarstellung(); return; }
  if (state.adminTab === 'dashboard_cfg')  { await renderAdminDashboard(); return; }
  if (state.adminTab === 'registrierungen'){ await renderAdminRegistrierungen(); return; }
  var r = await apiGet('benutzer');
  if (!r || !r.ok) return;
  var benutzer = r.data.benutzer || r.data; // Rückwärtskompatibel
  state._adminAthleten = r.data.athleten || [];

  state._adminBenutzerMap = {};
  var userRows = '';
  for (var i = 0; i < benutzer.length; i++) {
    var b = benutzer[i];
    state._adminBenutzerMap[b.id] = b;
    var athletBadge = b.athlet_id
      ? '<span class="badge" style="background:#e8f5e9;color:#2e7d32;border:1px solid #a5d6a7;max-width:160px;overflow:hidden;text-overflow:ellipsis" title="' + (b.athlet_name||'') + '">&#x1F3C3; ' + (b.athlet_name||'') + '</span>'
      : '<span class="badge badge-ak">Kein Athlet</span>';
    userRows +=
      '<div class="user-row">' +
        (b.avatar_pfad
          ? '<div class="user-row-avatar" style="padding:0;overflow:hidden"><img src="' + b.avatar_pfad + '" style="width:100%;height:100%;object-fit:cover;"></div>'
          : '<div class="user-row-avatar">' + nameInitials(b.benutzername) + '</div>') +
        '<div class="user-row-info"><div class="user-row-name">' + b.benutzername + '</div>' +
          '<div class="user-row-email">' + b.email + '</div>' +
          '<div style="margin-top:3px;font-size:11px;color:var(--text2)">Letzter Login: ' + (b.letzter_login ? formatDate(b.letzter_login.slice(0,10)) : 'Noch nie') + '</div>' +
        '</div>' +
        athletBadge +
        '<span class="badge badge-' + b.rolle + '">' + b.rolle + '</span>' +
        (b.aktiv ? '<span class="badge badge-aktiv">Aktiv</span>' : '<span class="badge badge-inaktiv">Inaktiv</span>') +
        '<div style="display:flex;gap:6px;margin-left:8px">' +
          '<button class="btn btn-ghost btn-sm" onclick="showBenutzerEditModal(' + b.id + ')">&#x270F;&#xFE0F;</button>' +
          '<button class="btn btn-danger btn-sm" onclick="deleteBenutzer(' + b.id + ',\'' + b.benutzername + '\')">&#x2715;</button>' +
        '</div>' +
      '</div>';
  }

  document.getElementById('main-content').innerHTML =
    adminSubtabs() +
    '<div class="admin-grid">' +
      '<div class="panel">' +
        '<div class="panel-header"><div class="panel-title">&#x1F465; Benutzerverwaltung</div><button class="btn btn-primary btn-sm" onclick="showNeuerBenutzerModal()">+ Neuer Benutzer</button></div>' +
        userRows +
      '</div>' +
      '<div class="panel" style="padding:20px">' +
        '<div class="panel-title" style="margin-bottom:16px">&#x2139;&#xFE0F; Rollen-&Uuml;bersicht</div>' +
        '<table style="width:100%"><thead><tr><th>Rolle</th><th>Rechte</th></tr></thead><tbody>' +
          '<tr><td><span class="badge badge-admin">admin</span></td><td>Vollzugriff, Benutzer verwalten, Rekorde bearbeiten</td></tr>' +
          '<tr><td><span class="badge badge-editor">editor</span></td><td>Ergebnisse eintragen und l&ouml;schen (nur eigene)</td></tr>' +
          '<tr><td><span class="badge badge-leser">leser</span></td><td>Nur Ansicht, keine Bearbeitung</td></tr>' +
        '</tbody></table>' +
        '<div style="margin-top:24px"><div class="panel-title" style="margin-bottom:12px">&#x1F4CA; Datenbankinfo</div>' +
          '<div style="font-size:13px;color:var(--text2);line-height:2">Athleten: <strong>' + state.athleten.length + '</strong><br>System: MariaDB via PHP PDO<br>Hosting: all-inkl.com</div>' +
        '</div>' +
      '</div>' +
    '</div>';
}

function showNeuerBenutzerModal() {
  showModal(
    '<h2>&#x1F464; Neuer Benutzer <button class="modal-close" onclick="closeModal()">&#x2715;</button></h2>' +
    '<div class="form-grid">' +
      '<div class="form-group"><label>Benutzername *</label><input type="text" id="nb-user" placeholder="max.mustermann"/></div>' +
      '<div class="form-group"><label>E-Mail *</label><input type="email" id="nb-email" placeholder="max@example.com"/></div>' +
      '<div class="form-group"><label>Passwort * (min. 8 Zeichen)</label><input type="password" id="nb-pw"/></div>' +
      '<div class="form-group"><label>Rolle</label><select id="nb-rolle"><option value="leser">Leser</option><option value="editor">Editor</option><option value="admin">Admin</option></select></div>' +
    '</div>' +
    '<div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button><button class="btn btn-primary" onclick="createBenutzer()">Erstellen</button></div>'
  );
}

async function createBenutzer() {
  var r = await apiPost('benutzer', {
    benutzername: document.getElementById('nb-user').value,
    email:        document.getElementById('nb-email').value,
    passwort:     document.getElementById('nb-pw').value,
    rolle:        document.getElementById('nb-rolle').value,
  });
  if (r && r.ok) { closeModal(); notify('Benutzer erstellt.', 'ok'); await renderAdmin(); }
  else notify((r && r.fehler) || 'Fehler', 'err');
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
    '<div style="color:var(--text2);margin-bottom:16px">' + b.benutzername + ' &middot; ' + b.email + '</div>' +
    '<div class="form-grid">' +
      '<div class="form-group"><label>E-Mail</label><input type="email" id="eb-email" value="' + b.email + '"/></div>' +
      '<div class="form-group"><label>Rolle</label><select id="eb-rolle"><option value="leser"' + (b.rolle==='leser'?' selected':'') + '>Leser</option><option value="editor"' + (b.rolle==='editor'?' selected':'') + '>Editor</option><option value="admin"' + (b.rolle==='admin'?' selected':'') + '>Admin</option></select></div>' +
      '<div class="form-group"><label>Status</label><select id="eb-aktiv"><option value="1"' + (b.aktiv?' selected':'') + '>Aktiv</option><option value="0"' + (!b.aktiv?' selected':'') + '>Inaktiv</option></select></div>' +
      '<div class="form-group"><label>Neues Passwort (leer = unver&auml;ndert)</label><input type="password" id="eb-pw"/></div>' +
      '<div class="form-group full"><label>&#x1F3C3; Verkn&uuml;pftes Athletenprofil</label>' +
        '<select id="eb-athlet" style="width:100%">' + athletOpts + '</select>' +
        '<div style="font-size:11px;color:var(--text2);margin-top:4px">Wenn zugeordnet, kann sich der Athlet sp&auml;ter mit eigenen Daten anmelden.</div>' +
      '</div>' +
    '</div>' +
    '<div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button><button class="btn btn-primary" onclick="updateBenutzer(' + b.id + ')">Speichern</button></div>'
  );
}

async function updateBenutzer(id) {
  var body = {
    email:     document.getElementById('eb-email').value,
    rolle:     document.getElementById('eb-rolle').value,
    aktiv:     parseInt(document.getElementById('eb-aktiv').value),
    athlet_id: document.getElementById('eb-athlet').value ? parseInt(document.getElementById('eb-athlet').value) : null,
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
      '<div class="form-group"><label>Geschlecht</label><select id="na-g"><option value="">&#x2013;</option><option value="M">M&auml;nnlich</option><option value="W">Weiblich</option></select></div>' +
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

// ── ADMIN: DISZIPLINEN ────────────────────────────────────
async function renderPapierkorb() {
  var el = document.getElementById('main-content');
  el.innerHTML = adminSubtabs() + '<div class="loading"><div class="spinner"></div>Laden&hellip;</div>';

  var r = await apiGet('papierkorb');
  if (!r || !r.ok) { el.innerHTML += '<div style="color:var(--accent)">Fehler beim Laden.</div>'; return; }

  var erg  = r.data.ergebnisse || [];
  var ath  = r.data.athleten || [];
  var ver  = r.data.veranstaltungen || [];
  var total = erg.length + ath.length + ver.length;

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
    html += '<div class="empty"><div class="empty-icon">&#x1F5D1;&#xFE0F;</div><div class="empty-text">Papierkorb ist leer</div></div>';
  } else {
    html += '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:16px">' +
      '<div style="color:var(--text2);font-size:13px">&#x26A0;&#xFE0F; Endg&uuml;ltig gel&ouml;schte Eintr&auml;ge k&ouml;nnen nicht wiederhergestellt werden.</div>' +
      '<button class="btn btn-danger" onclick="pkLeeren(' + total + ')" style="white-space:nowrap">&#x1F5D1;&#xFE0F; Papierkorb leeren (' + total + ')</button>' +
    '</div>';

    if (erg.length) {
      html += '<div class="panel" style="margin-bottom:16px"><div class="panel-header"><div class="panel-title">Ergebnisse (' + erg.length + ')</div></div>' +
        '<div class="table-scroll"><table><thead><tr><th>Athlet &middot; Disziplin &middot; Ergebnis</th><th>Gel&ouml;scht am</th><th></th></tr></thead><tbody>' +
        pkRows(erg, 'ergebnis') + '</tbody></table></div></div>';
    }
    if (ath.length) {
      html += '<div class="panel" style="margin-bottom:16px"><div class="panel-header"><div class="panel-title">Athleten (' + ath.length + ')</div></div>' +
        '<div class="table-scroll"><table><thead><tr><th>Name</th><th>Gel&ouml;scht am</th><th></th></tr></thead><tbody>' +
        pkRows(ath, 'athlet') + '</tbody></table></div></div>';
    }
    if (ver.length) {
      html += '<div class="panel" style="margin-bottom:16px"><div class="panel-header"><div class="panel-title">Veranstaltungen (' + ver.length + ')</div></div>' +
        '<div class="table-scroll"><table><thead><tr><th>Name</th><th>Gel&ouml;scht am</th><th></th></tr></thead><tbody>' +
        pkRows(ver, 'veranstaltung') + '</tbody></table></div></div>';
    }
  }
  el.innerHTML = html;
}

async function pkRestore(typ, id) {
  var r = await apiPost('papierkorb/' + typ + '/' + id, {});
  if (r && r.ok) { notify('Wiederhergestellt.', 'ok'); await renderPapierkorb(); }
  else notify((r && r.fehler) || 'Fehler', 'err');
}

async function pkDelete(typ, id) {
  if (!confirm('Endg\u00fcltig l\u00f6schen? Dieser Vorgang kann nicht r\u00fcckg\u00e4ngig gemacht werden.')) return;
  var r = await api('DELETE', 'papierkorb/' + typ + '/' + id);
  if (r && r.ok) { notify('Endg\u00fcltig gel\u00f6scht.', 'ok'); await renderPapierkorb(); }
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
  // Primär aus DB-Config (appConfig), localStorage als Legacy-Fallback
  if (appConfig.dashboard_timeline_limit) {
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

  var r = await apiGet('auth/registrierungen');
  if (!r || !r.ok) { el.innerHTML += '<div style="color:var(--accent)">Fehler beim Laden.</div>'; return; }

  var regs = r.data || [];
  var pending = regs.filter(function(x) { return x.status === 'pending'; });
  var other   = regs.filter(function(x) { return x.status !== 'pending'; });

  var html = adminSubtabs();

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
  el.innerHTML = html;
}

function _regCard(reg, showActions) {
  var emailBadge = reg.email_verifiziert
    ? '<span class="badge badge-email-ok">✓ E-Mail bestätigt</span>'
    : '<span class="badge badge-email-no">✗ E-Mail ausstehend</span>';
  var totpBadge = reg.totp_aktiv
    ? '<span class="badge badge-email-ok">✓ 2FA aktiv</span>'
    : '<span class="badge" style="background:var(--surf2);color:var(--text2)">2FA ausstehend</span>';
  var statusBadge = reg.status === 'approved'
    ? '<span class="badge badge-aktiv">Freigegeben</span>'
    : reg.status === 'rejected'
    ? '<span class="badge badge-inaktiv">Abgelehnt</span>'
    : '<span class="badge badge-pending">Ausstehend</span>';

  var actions = '';
  if (showActions) {
    // Athleten-Dropdown für Zuweisung
    var athOpts = '<option value="">– kein Athlet –</option>';
    var athlList = state._adminAthleten || [];
    for (var i = 0; i < athlList.length; i++) {
      athOpts += '<option value="' + athlList[i].id + '">' + athlList[i].name + '</option>';
    }
    actions =
      '<div class="reg-pending-actions" style="margin-top:12px;width:100%;flex-direction:column;align-items:stretch">' +
        '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px">' +
          '<label style="font-size:12px;color:var(--text2);white-space:nowrap">Athlet zuweisen:</label>' +
          '<select id="reg-athlet-' + reg.id + '" style="flex:1;min-width:160px;padding:6px;border:1px solid var(--border);border-radius:6px;font-size:13px;background:var(--surface);color:var(--text)">' + athOpts + '</select>' +
        '</div>' +
        '<div style="display:flex;gap:8px">' +
          '<button class="btn btn-primary btn-sm" style="flex:1" onclick="regGenehmigen(' + reg.id + ')">✓ Genehmigen</button>' +
          '<button class="btn btn-danger btn-sm" onclick="regAblehnen(' + reg.id + ')">✗ Ablehnen</button>' +
        '</div>' +
      '</div>';
  }

  return '<div class="reg-pending-card">' +
    '<div class="reg-pending-info">' +
      '<div class="reg-pending-name">' + (reg.name || reg.benutzername || '–') + '</div>' +
      '<div class="reg-pending-email">' + reg.email + '</div>' +
      '<div class="reg-pending-meta" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">' +
        emailBadge + totpBadge + statusBadge +
        '<span style="font-size:11px;color:var(--text2);align-self:center">Registriert: ' + (reg.erstellt_am ? reg.erstellt_am.slice(0,10) : '–') + '</span>' +
      '</div>' +
      actions +
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
];

// Verfügbare Stat-Karten (Reihenfolge und Auswahl konfigurierbar)
// Timeline-Label-Typen (fest, AK-Labels sind dynamisch aber gehören zu Typ 'ak')
var TIMELINE_TYPE_DEFS = [
  { id: 'gesamt',  label: 'Gesamtbestleistung',  desc: 'Beste Leistung aller Athleten in einer Disziplin',  prio: 0 },
  { id: 'gender',  label: 'Bestleistung M / W',  desc: 'Beste Leistung je Geschlecht',                     prio: 1 },
  { id: 'ak',      label: 'Bestleistung AK',      desc: 'Beste Leistung je Altersklasse',                   prio: 2 },
  { id: 'pb',      label: 'Persönliche Bestleistung (PB)', desc: 'Persönliche Bestleistung / Debüt',        prio: 3 },
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
  var hidden  = hidden_types || [];
  var order   = prio_order && prio_order.length === TIMELINE_TYPE_DEFS.length
                  ? prio_order
                  : TIMELINE_TYPE_DEFS.map(function(t){return t.id;});
  // Typen in Prio-Reihenfolge darstellen
  var orderedTypes = [];
  for (var oi = 0; oi < order.length; oi++) {
    for (var ti = 0; ti < TIMELINE_TYPE_DEFS.length; ti++) {
      if (TIMELINE_TYPE_DEFS[ti].id === order[oi]) { orderedTypes.push(TIMELINE_TYPE_DEFS[ti]); break; }
    }
  }
  // fehlende anhängen
  for (var ti2 = 0; ti2 < TIMELINE_TYPE_DEFS.length; ti2++) {
    if (order.indexOf(TIMELINE_TYPE_DEFS[ti2].id) < 0) orderedTypes.push(TIMELINE_TYPE_DEFS[ti2]);
  }
  var rows = '';
  for (var i = 0; i < orderedTypes.length; i++) {
    var t = orderedTypes[i];
    var chk = hidden.indexOf(t.id) < 0 ? ' checked' : '';
    rows +=
      '<div style="display:flex;align-items:center;gap:8px;padding:5px 0;' + (i < orderedTypes.length-1 ? 'border-bottom:1px solid var(--border);' : '') + '">' +
        '<span style="font-size:11px;font-weight:700;color:var(--text2);min-width:18px;text-align:center">' + (i+1) + '</span>' +
        '<input type="checkbox" data-tl-id="' + t.id + '" data-ri="' + ri + '" data-ci="' + ci + '"' + chk + ' onchange="dashUpdateLayout()">' +
        '<span style="flex:1;font-size:13px" title="' + t.desc + '">' + t.label + '</span>' +
        '<span style="display:flex;gap:4px">' +
          (i > 0 ? '<button class="btn btn-ghost btn-sm" style="padding:2px 6px" onclick="dashTlMovePrio(' + ri + ',' + ci + ',' + i + ',-1)">▲</button>' : '<button class="btn btn-ghost btn-sm" style="padding:2px 6px;opacity:.25" disabled>▲</button>') +
          (i < orderedTypes.length-1 ? '<button class="btn btn-ghost btn-sm" style="padding:2px 6px" onclick="dashTlMovePrio(' + ri + ',' + ci + ',' + i + ',1)">▼</button>' : '<button class="btn btn-ghost btn-sm" style="padding:2px 6px;opacity:.25" disabled>▼</button>') +
        '</span>' +
      '</div>';
  }
  var tlLimit = (typeof hidden_types === 'object' && !Array.isArray(hidden_types)) ? '' : '';
  // hidden_types kann hier noch das alte Format sein; limit kommt aus prio_order[4] wenn gesetzt
  // Wir lesen limit direkt aus den Argumenten nicht – wird über dashUpdateLayout gespeichert
  return '<div style="padding:2px 0 6px">' +
    '<div style="font-size:11px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">Neueste Bestleistungen</div>' +
    '<label style="display:flex;align-items:center;gap:10px;font-size:13px;margin-bottom:12px">' +
      '<span style="min-width:120px;color:var(--text2)">Anzahl Einträge</span>' +
      '<input type="number" id="tl-limit-' + ri + '-' + ci + '" value="' + ((col && col.tl_limit) || (prio_order && prio_order._limit) || appConfig.dashboard_timeline_limit || 20) + '" min="5" max="200" ' +
      'class="settings-input" style="width:70px" onchange="dashUpdateLayout()">' +
    '</label>' +
    '<div style="font-size:11px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Angezeigte Typen &amp; Priorität</div>' +
    '<div style="font-size:12px;color:var(--text2);margin-bottom:8px">Höher = höhere Priorität bei gleichem Datum</div>' +
    rows +
  '</div>';
}

function dashTlMovePrio(ri, ci, idx, dir) {
  dashUpdateLayout();
  var layout = dashGetLayout();
  var col = layout[ri] && layout[ri].cols[ci];
  if (!col) return;
  var order = col.prio_order && col.prio_order.length ? col.prio_order.slice()
    : TIMELINE_TYPE_DEFS.map(function(t){return t.id;});
  var newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= order.length) return;
  var tmp = order[idx]; order[idx] = order[newIdx]; order[newIdx] = tmp;
  col.prio_order = order;
  renderAdminDashboardUI(layout);
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
        // Anzahl Einträge
        var tlLimitEl = document.getElementById('tl-limit-' + ri + '-' + ci);
        if (tlLimitEl) {
          var tlLv = Math.max(5, Math.min(200, parseInt(tlLimitEl.value) || 20));
          if (!cols[ci].prio_order || !Array.isArray(cols[ci].prio_order)) cols[ci].prio_order = TIMELINE_TYPE_DEFS.map(function(t){return t.id;});
          cols[ci].prio_order._limit = tlLv;
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

    // ── Verein ──
    '<div class="panel">' +
      '<div class="panel-header"><div class="panel-title">🏟️ Verein</div></div>' +
      '<div class="settings-panel-body">' +
        row('Vereinsname', 'Vollständiger Name, z.B. in E-Mails', textIn('cfg-verein_name', cfgVal('verein_name','TuS Oedt'))) +
        row('Kurzbezeichnung', 'Im Header und Menü angezeigt', textIn('cfg-verein_kuerzel', cfgVal('verein_kuerzel','TuS Oedt'))) +
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

    // ── Registrierung ──
    '<div class="panel">' +
      '<div class="panel-header"><div class="panel-title">📧 Registrierung &amp; E-Mail</div></div>' +
      '<div class="settings-panel-body">' +
        row('Zugelassene E-Mail-Domain', 'Nur Adressen mit dieser Domain dürfen sich registrieren', textIn('cfg-email_domain', cfgVal('email_domain','tus-oedt.de'), 'meinverein.de')) +
        row('Absender-E-Mail', 'Von-Adresse für System-Mails', textIn('cfg-noreply_email', cfgVal('noreply_email','noreply@tus-oedt.de'), 'noreply@...')) +
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
      '</div>' +
    '</div>' +

    // ── Footer-Links ──
    '<div class="panel">' +
      '<div class="panel-header"><div class="panel-title">&#x1F4CB; Footer &amp; Rechtliches</div></div>' +
      '<div class="settings-panel-body">' +
        '<div style="padding:12px 20px;background:var(--surf2);border-radius:8px;margin:8px 20px 16px;font-size:13px;color:var(--text2)">' +
          'Die Texte für Datenschutz, Nutzungsbedingungen und Impressum sind bereits mit Standardtexten vorbelegt. ' +
          'Klicke im Footer auf einen Link um ihn direkt zu bearbeiten (als Admin). ' +
          'Alternativ kannst du externe URLs hinterlegen – diese haben Vorrang vor den eingebetteten Seiten.' +
        '</div>' +
        row('Datenschutz: externe URL', 'Wenn gesetzt, öffnet sich diese URL statt der eingebetteten Seite', textIn('cfg-footer_datenschutz_url', cfgVal('footer_datenschutz_url',''), 'https://...')) +
        row('Nutzungsbedingungen: externe URL', 'Wenn gesetzt, öffnet sich diese URL statt der eingebetteten Seite', textIn('cfg-footer_nutzung_url', cfgVal('footer_nutzung_url',''), 'https://...')) +
        row('Impressum: externe URL', 'Wenn gesetzt, öffnet sich diese URL statt der eingebetteten Seite', textIn('cfg-footer_impressum_url', cfgVal('footer_impressum_url',''), 'https://...')) +
      '</div>' +
    '</div>' +

    '<div style="padding-bottom:8px">' +
      '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding-bottom:8px">' +
        '<button class="btn btn-primary" onclick="saveAllSettings()">&#x1F4BE; Alle Einstellungen speichern</button>' +
      '</div>' +
    '</div>' +
  '</div>';
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
    'footer_datenschutz_url','footer_nutzung_url','footer_impressum_url',
  ];
  var payload = {};
  for (var i = 0; i < keys.length; i++) {
    var el = document.getElementById('cfg-' + keys[i]);
    if (el) payload[keys[i]] = el.value;
  }
  // Checkboxen separat (checked → '1', unchecked → '0')
  var cbKeys = ['version_nur_admins'];
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
    var canDel = ['strasse','sprint','mittelstrecke','sprungwurf'].indexOf(k.tbl_key) < 0;
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
        '<div class="panel-header"><div class="panel-title">&#x1F4CB; Disziplin-Zuordnung</div></div>' +
        '<div style="font-size:12px;color:var(--text2);padding:0 20px 12px">Weise jeder Disziplin eine Kategorie zu. Die Zuordnung beeinflusst die Anzeige unter Ergebnisse &amp; Rekorde.</div>' +
        '<div class="table-scroll">' +
          '<table><thead><tr><th>Disziplin</th><th>Quelle / Format</th><th>Kategorie</th><th style="text-align:right">Ergebnisse</th><th></th></tr></thead>' +
          '<tbody>' + mapRows + '</tbody></table>' +
        '</div>' +
      '</div>' +
    '</div>';
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
      '<div class="form-group"><label>Ergebnisformat</label><select id="nk-fmt"><option value="min">Zeit (min)</option><option value="s">Zeit (s / Sekunden)</option><option value="m">Weite (m)</option></select></div>' +
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
  var fmtOpts = [
    { v:'',    label:'Standard (Kategorie: ' + (katfmt||'–') + ')' },
    { v:'min', label:'Zeit (min) – z.B. 45:30 min' },
    { v:'s',   label:'Zeit (s) – z.B. 10,45s' },
    { v:'m',   label:'Weite (m) – z.B. 7.85m' },
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
      '<div class="form-group full">' +
        '<label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:13px">' +
          '<input type="checkbox" id="de-hofexclude"' + (hofExclude ? ' checked' : '') + ' style="width:16px;height:16px;cursor:pointer">' +
          '<span>Diese Disziplin aus der <strong>Hall of Fame</strong> ausschließen</span>' +
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
  var body = { fmt_override: fmt, kat_suffix_override: katSuffix, hof_exclude: hofExclude };
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

/* ── 09_utils.js ── */
function setSubTab(t) { state.subTab = t; state.page = 1; state.filters = {}; state.diszFilter = null; renderPage(); }
function setDiszFilter(d) { state.diszFilter = d; state.page = 1; loadErgebnisseData(); }
function setDiszTabFilter(cat, disz) { state.subTab = cat; state.diszFilter = disz; state.page = 1; state.filters = {}; loadErgebnisseData(); }

var _athSucheTimer = null;
function setAthletSuche(v) {
  state.filters.suche = v;
  clearTimeout(_athSucheTimer);
  _athSucheTimer = setTimeout(async function() {
    // Suche ist serverseitig → neu laden, dann rendern
    var s = state.filters.suche || '';
    var rA = await apiGet(s ? 'athleten?suche=' + encodeURIComponent(s) : 'athleten');
    if (rA && rA.ok) { _athLetenCache.alleAthleten = rA.data; }
    _renderAthletenTable();
    // Suchfeld-Fokus erhalten
    var sf = document.getElementById('athlet-suche');
    if (sf) sf.focus();
  }, 250);
}

function setFilter(k, v) {
  state.filters[k] = v; state.page = 1;
  if (state.tab === 'ergebnisse') loadErgebnisseData();
  else if (state.tab === 'athleten') renderAthleten();
  else if (state.tab === 'rekorde') renderRekorde();
}

function clearFilters() { state.filters = {}; state.page = 1; loadErgebnisseData(); }

function buildPagination(page, totalPages, total, callbackFn) {
  if (totalPages <= 1) return '';
  callbackFn = callbackFn || 'goPage';
  var pages = [];
  var s = Math.max(1, page-2), e = Math.min(totalPages, page+2);
  if (s > 1) { pages.push(1); pages.push('...'); }
  for (var i = s; i <= e; i++) pages.push(i);
  if (e < totalPages) { pages.push('...'); pages.push(totalPages); }
  var btns = '';
  for (var i = 0; i < pages.length; i++) {
    var p = pages[i];
    if (p === '...') btns += '<button class="page-btn" disabled>&hellip;</button>';
    else btns += '<button class="page-btn ' + (p === page ? 'active' : '') + '" onclick="' + callbackFn + '(' + p + ')">' + p + '</button>';
  }
  return '<div class="pagination">' +
    '<div class="page-info">Seite ' + page + ' von ' + totalPages + ' &middot; ' + total + ' Eintr&auml;ge</div>' +
    '<div class="page-btns">' +
      '<button class="page-btn" ' + (page===1?'disabled':'') + ' onclick="' + callbackFn + '(' + (page-1) + ')">&#x2190;</button>' +
      btns +
      '<button class="page-btn" ' + (page===totalPages?'disabled':'') + ' onclick="' + callbackFn + '(' + (page+1) + ')">&#x2192;</button>' +
    '</div>' +
  '</div>';
}

function goPage(p) { state.page = p; loadErgebnisseData(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
function goPageVeranst(p) { state.veranstPage = p; renderVeranstaltungen(); window.scrollTo({ top: 0, behavior: 'smooth' }); }

function formatDate(d) {
  if (!d) return '&ndash;';
  var p = String(d).slice(0,10).split('-');
  return p.length === 3 ? p[2] + '.' + p[1] + '.' + p[0] : d;
}

function fmtTime(t, unit) {
  if (!t || t === 'null' || t === 'None') return '&ndash;';
  var str = String(t).trim();

  // Wenn der Wert ein HH:MM:SS-String ist (enthält ':'), immer als Zeit formatieren –
  // egal was unit sagt. Verhindert falsche 's'-Interpretation bei Bahnzeiten.
  var isTimeString = str.indexOf(':') >= 0;

  // Sprint-Modus: Sekunden mit Hundertstel, z.B. "10.45" -> "10,45s"
  // Aber NUR wenn es kein HH:MM:SS-String ist
  if (unit === 's' && !isTimeString) {
    var num = parseFloat(str.replace(',', '.'));
    if (isNaN(num)) return str + '<span style="font-size:.75em;opacity:.7;margin-left:1px">s</span>';
    var sInt = Math.floor(num);
    var cent = Math.round((num - sInt) * 100);
    var centStr = String(cent).padStart(2, '0');
    return sInt + ',' + centStr + '<span style="font-size:.75em;opacity:.7;margin-left:1px">s</span>';
  }

  // Normale Zeitformatierung
  // Millisekunden/Mikrosekunden abschneiden: "04.100000" -> "04"
  str = str.replace(/(\.\d+)(?=\s*$|:)/, '').replace(/\.\d+$/, '');
  var parts;
  if (/^\d+$/.test(str)) {
    var secs = parseInt(str, 10);
    var h = Math.floor(secs / 3600);
    var m = Math.floor((secs % 3600) / 60);
    var s = secs % 60;
    parts = h > 0 ? [h, m, s] : [m, s];
  } else {
    parts = str.split(':').map(function(p) { return parseInt(p, 10); });
    while (parts.length > 2 && parts[0] === 0) parts.shift();
  }
  var result = parts.map(function(p, i) {
    return i === 0 ? String(p) : String(p).padStart(2, '0');
  }).join(':');
  var u = (!isTimeString && unit === 's') ? 's' : (unit && unit !== 's' ? unit : (parts.length >= 3 ? 'h' : 'min'));
  return result + '<span style="font-size:.75em;opacity:.7;margin-left:1px">' + u + '</span>';
}

function fmtMeter(v) {
  if (!v || v === 'null' || v === 'None') return '&ndash;';
  return String(v).replace(/\.0+$/, '') + '<span style="font-size:.75em;opacity:.7;margin-left:1px">m</span>';
}

// Formatiert einen numerischen Vorher-Wert (Sekunden oder Meter) aus der API
function fmtValNum(val, fmt) {
  if (val === null || val === undefined) return null;
  val = parseFloat(val);
  if (isNaN(val)) return null;
  if (fmt === 'm') {
    var m = Math.round(val * 100) / 100;
    return String(m).replace(/\.0+$/, '').replace('.', ',') + '<span style="font-size:.75em;opacity:.7;margin-left:1px">m</span>';
  }
  if (fmt === 's') {
    var sInt = Math.floor(val);
    var cent = Math.round((val - sInt) * 100);
    return sInt + ',' + String(cent).padStart(2, '0') + '<span style="font-size:.75em;opacity:.7;margin-left:1px">s</span>';
  }
  // Zeitformat (Sekunden → h:mm:ss oder m:ss)
  var secs = Math.round(val);
  var h = Math.floor(secs / 3600);
  var m = Math.floor((secs % 3600) / 60);
  var s = secs % 60;
  var parts = h > 0 ? [h, m, s] : [m, s];
  var result = parts.map(function(p, i) { return i === 0 ? String(p) : String(p).padStart(2, '0'); }).join(':');
  var unit = h > 0 ? 'h' : 'min';
  return result + '<span style="font-size:.75em;opacity:.7;margin-left:1px">' + unit + '</span>';
}

function renderGruppenInline(gruppen) {
  if (!gruppen || !gruppen.length) return '<span style="color:var(--text2)">&ndash;</span>';
  var html = '';
  for (var i = 0; i < gruppen.length; i++) {
    html += '<span class="badge badge-ak" style="margin-right:3px">' + gruppen[i].name + '</span>';
  }
  return html;
}

function akBadge(ak) {
  if (!ak) return '&ndash;';
  var cls = /^W/i.test(ak) ? 'badge-w' : /^[MH]/i.test(ak) ? 'badge-m' : '';
  return '<span class="badge ' + cls + '">' + ak + '</span>';
}

function notify(msg, type) {
  var el = document.createElement('div');
  el.className = 'notification notif-' + (type || 'ok');
  el.textContent = msg;
  document.getElementById('notification-container').appendChild(el);
  setTimeout(function() { el.remove(); }, 3500);
}

function showModal(html, wide, noClose) {
  var cls = wide === 'profile' ? 'modal modal-profile' : (wide ? 'modal modal-wide' : 'modal');
  var overlayClick = noClose ? '' : ' onclick="if(event.target===this)closeModal()"';
  document.getElementById('modal-container').innerHTML =
    '<div class="modal-overlay"' + overlayClick + '>' +
      '<div class="' + cls + '">' + html + '</div>' +
    '</div>';
}

function closeModal() { document.getElementById('modal-container').innerHTML = ''; }

// ── THEME ─────────────────────────────────────────────────
function getThemePref() {
  return localStorage.getItem('theme') || 'auto';
}

function applyTheme() {
  var pref = getThemePref();
  var root = document.documentElement;
  if (pref === 'dark') {
    root.setAttribute('data-theme', 'dark');
  } else if (pref === 'light') {
    root.setAttribute('data-theme', 'light');
  } else {
    // auto: entferne data-theme, OS-Einstellung greift über media query
    root.removeAttribute('data-theme');
  }
}

function setTheme(pref) {
  localStorage.setItem('theme', pref);
  applyTheme();
  // Adressleiste neu einfärben nach Theme-Wechsel
  _updateBodyThemeColor();
  if (window.appConfig) applyConfig(window.appConfig);
  // Buttons im Modal aktualisieren falls geöffnet
  var container = document.getElementById('theme-btns');
  if (container) {
    var btns = container.querySelectorAll('button');
    var prefs = ['auto', 'light', 'dark'];
    for (var i = 0; i < btns.length; i++) {
      btns[i].className = 'btn btn-sm ' + (pref === prefs[i] ? 'btn-primary' : 'btn-ghost');
    }
  }
}

// ── START ──────────────────────────────────────────────────
applyTheme();
init();
document.addEventListener('click', function(ev) {
  var el = ev.target;
  while (el && el !== document.body) {
    if (el.getAttribute && el.getAttribute('data-athlet-id')) {
      openAthletById(parseInt(el.getAttribute('data-athlet-id'), 10));
      return;
    }
    el = el.parentNode;
  }
});

// ── VERANSTALTUNGEN ────────────────────────────────────────

/* ── 10_veranstaltungen.js ── */
async function renderVeranstaltungen() {
  var el = document.getElementById('main-content');
  el.innerHTML = '<div class="loading"><div class="spinner"></div>Laden&hellip;</div>';
  var r = await apiGet('veranstaltungen?limit=10&offset=' + ((state.veranstPage-1)*10));
  if (!r || !r.ok) {
    el.innerHTML = '<div class="panel" style="padding:24px;color:var(--accent)"><strong>Fehler:</strong> ' + (r && r.fehler ? r.fehler : 'Unbekannt') + '</div>';
    return;
  }
  var veranst = r.data.veranst || [];
  var total = r.data.total || 0;
  // Cache für Edit-Modal
  state._veranstMap = {};
  for (var ci = 0; ci < veranst.length; ci++) state._veranstMap[veranst[ci].id] = veranst[ci];
  var html = '';
  for (var vi = 0; vi < veranst.length; vi++) {
    var v = veranst[vi];
    var name = v.name || (v.kuerzel || '').split(' ').slice(1).join(' ') || v.kuerzel || '';
    var rows = '';
    // Gruppiere nach Disziplin
    var byDisz = {};
    var diszOrder = [];
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
      rows += '<tr class="disz-header-row"><td colspan="6" class="disziplin-text" style="background:var(--surf2);font-weight:600;padding:6px 12px">' + diszMitKat(disz) + '</td></tr>';
      for (var ei2 = 0; ei2 < ergs.length; ei2++) {
        var e2 = ergs[ei2];
        var fmt = e2.fmt || '';
        var res = fmt === 'm' ? fmtMeter(e2.resultat) : fmtTime(e2.resultat, fmt === 's' ? 's' : undefined);
        var _ePace = diszKm(e2.disziplin) >= 1 ? calcPace(e2.disziplin, e2.resultat) : '';
        var showPace = _ePace && _ePace !== '00:00' && fmt !== 'm' && fmt !== 's';
        rows +=
          '<tr>' +
            '<td><span class="athlet-link" onclick="openAthletById(' + e2.athlet_id + ')">' + e2.athlet + '</span></td>' +
            '<td>' + akBadge(e2.altersklasse) + '</td>' +
            '<td class="result">' + res + '</td>' +
            '<td class="ort-text">' + (showPace ? fmtTime(_ePace, 'min/km') : '') + '</td>' +
            '<td>' + platzBadge(e2.ak_platzierung) + '</td>' +
            '<td>' + mstrBadge(e2.meisterschaft) + '</td>' +
          '</tr>';
      }
    }
    html +=
      '<div class="panel" style="margin-bottom:16px">' +
        '<div class="panel-header">' +
          '<div>' +
            '<div class="panel-title">' + name + '</div>' +
            '<div style="font-size:12px;color:var(--text2);margin-top:2px">' + formatDate(v.datum) + (v.ort ? ' &middot; ' + v.ort : '') + '</div>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:10px">' +
            '<span style="font-size:13px;color:var(--text2)">' + v.anz_ergebnisse + ' Ergebnisse &middot; ' + v.anz_athleten + ' Athleten</span>' +
            (currentUser && (currentUser.rolle === 'admin' || currentUser.rolle === 'editor') ?
              '<button class="btn btn-ghost btn-sm" onclick="showVeranstEditModal(' + v.id + ')">&#x270F;&#xFE0F;</button>' : '') +
            (currentUser && currentUser.rolle === 'admin' ?
              '<button class="btn btn-danger btn-sm" onclick="deleteVeranstaltung(' + v.id + ',\'' + name.replace(/'/g, "\\'") + '\')">&#x2715;</button>' : '') +
          '</div>' +
        '</div>' +
        (rows ? '<div class="table-scroll"><table class="veranst-dash-table"><colgroup><col class="vcol-athlet"><col class="vcol-ak"><col class="vcol-result"><col class="vcol-pace"><col class="vcol-platz"><col class="vcol-ms"></colgroup><thead><tr><th>Athlet*in</th><th>AK</th><th>Ergebnis</th><th>Pace</th><th>Platz AK</th><th>Meisterschaft</th></tr></thead><tbody>' + rows + '</tbody></table></div>' :
                '<div class="empty" style="padding:16px">Keine Ergebnisse</div>') +
      '</div>';
  }
  if (!html) html = '<div class="empty"><div class="empty-icon">&#x1F4CD;</div><div class="empty-text">Noch keine Veranstaltungen</div></div>';
  el.innerHTML = html + buildPagination(state.veranstPage, Math.ceil(total/10), total, 'goPageVeranst');
}


function showVeranstEditModal(id) {
  var v = state._veranstMap && state._veranstMap[id];
  if (!v) return;
  var curName = v.name || '';
  var curDatum = (v.datum || '').slice(0, 10);
  var curOrt = v.ort || '';
  showModal(
    '<h2>&#x270F;&#xFE0F; Veranstaltung bearbeiten <button class="modal-close" onclick="closeModal()">&#x2715;</button></h2>' +
    '<div class="form-grid">' +
      '<div class="form-group full"><label>Name (optional)</label>' +
        '<input type="text" id="ve-name" value="' + curName + '" placeholder="z.B. 44. Stra&szlig;enlauf Rund um das Bayer-Kreuz"/></div>' +
      '<div class="form-group"><label>Datum</label>' +
        '<input type="date" id="ve-datum" value="' + curDatum + '"/></div>' +
      '<div class="form-group"><label>Ort</label>' +
        '<input type="text" id="ve-ort" value="' + curOrt + '" placeholder="z.B. Leverkusen"/></div>' +
    '</div>' +
    '<div class="modal-actions">' +
      '<button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button>' +
      '<button class="btn btn-primary" onclick="saveVeranstaltung(' + id + ')">Speichern</button>' +
    '</div>'
  );
}

async function saveVeranstaltung(id) {
  var body = {
    name:  document.getElementById('ve-name').value.trim() || null,
    datum: document.getElementById('ve-datum').value,
    ort:   document.getElementById('ve-ort').value.trim() || null,
  };
  var r = await apiPut('veranstaltungen/' + id, body);
  if (r && r.ok) { closeModal(); notify('Gespeichert.', 'ok'); await renderVeranstaltungen(); }
  else notify((r && r.fehler) || 'Fehler', 'err');
}

async function deleteVeranstaltung(id, name) {
  var v = state._veranstMap && state._veranstMap[id];
  var anz = v ? parseInt(v.anz_ergebnisse) : 0;
  if (anz > 0) {
    if (!confirm('Veranstaltung "' + name + '" und ' + anz + ' Ergebnisse in den Papierkorb verschieben?')) return;
    var r = await api('DELETE', 'veranstaltungen/' + id + '?force=1');
  } else {
    if (!confirm('Veranstaltung "' + name + '" in den Papierkorb verschieben?')) return;
    var r = await apiDel('veranstaltungen/' + id);
  }
  if (r && r.ok) { notify('Gel\u00f6scht.', 'ok'); await renderVeranstaltungen(); }
  else notify((r && r.fehler) || 'Fehler', 'err');
}


function openAthletByName(name) {
  renderPage();
}