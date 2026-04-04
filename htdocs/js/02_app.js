// ── GLOBALER ZUSTAND ────────────────────────────────────────
var currentUser = null;
var state = {
  tab: 'dashboard', subTab: null,
  page: 1, limit: 100,
  veranstPage: 1,
  filters: {}, sortCol: null, sortDir: 'asc',
  diszFilter: null,
  allDisziplinen: null,
  rekState: { kat: 'strasse', disz: null, view: 'gesamt' },
  data: {}, athleten: [], disziplinen: [], filterOptions: {},
};

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
// Erzeugt Avatar-HTML mit optionalem Online-Indikator-Punkt
// onlineStatus: null/undefined = kein Punkt, 'online' = grün, 'aktiv' = akzent, 'inaktiv' = gedämpft
function avatarHtml(avatarPfad, name, size, fontSize, onlineStatus, initialsOverride) {
  size = size || 28; fontSize = fontSize || Math.round(size * 0.45);
  var initials = initialsOverride || nameInitials(name || '?');
  var dot = onlineStatus ? _avatarDot(onlineStatus, size) : '';
  var wrap = '<span style="position:relative;display:inline-flex;flex-shrink:0;width:' + size + 'px;height:' + size + 'px;overflow:visible">';
  if (avatarPfad) {
    return wrap +
      '<img src="' + avatarPfad + '" style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;object-fit:cover;" onerror="this.style.display=&quot;none&quot;;this.parentNode.style.background=&quot;var(--accent)&quot;">' +
      dot + '</span>';
  }
  return wrap + avatarFallback(initials, size, fontSize) + dot + '</span>';
}

// Überlappender Online-Punkt am Avatar (nur für eingeloggte User)
function _avatarDot(status, size) {
  if (status !== 'online') return ''; // nur eingeloggt zeigt Punkt
  size = size || 28;
  var dotSize = Math.max(10, Math.round(size * 0.38)); // 38% des Avatars
  var border = Math.max(2, Math.round(dotSize * 0.2));
  // bottom:0;right:0 → genau in der Ecke, transform verschiebt 40% nach außen
  return '<span title="Online" style="position:absolute;bottom:0;right:0;' +
    'width:' + dotSize + 'px;height:' + dotSize + 'px;border-radius:50%;' +
    'background:#22c55e;border:' + border + 'px solid var(--surface);' +
    'transform:translate(35%,35%);z-index:2"></span>';
}
function nameInitials(name) {
  if (!name) return '?';
  var parts = name.trim().split(/[\s,]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0][0].toUpperCase();
}

function avatarFallback(initials, size, fontSize) {
  var fs = fontSize || Math.round((size || 28) * 0.38);
  return '<span style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--accent));color:var(--on-primary);display:inline-flex;align-items:center;justify-content:center;font-family:Barlow Condensed,sans-serif;font-size:' + fs + 'px;font-weight:700;letter-spacing:.5px">' + initials + '</span>';
}

var FOOTER_DEFAULT_DS  = "# Datenschutzerkl\u00e4rung\n\n**Stand: 2026**\n\n## 1. Verantwortlicher\nVerantwortlich f\u00fcr diese Anwendung ist der Verein [Vereinsname]\n\n## 2. Erhobene Daten\nDiese Anwendung verarbeitet ausschlie\u00dflich Daten, die zur Darstellung von Leichtathletik-Ergebnissen und Vereinsstatistiken erforderlich sind:\n- Athleten-Namen und Wettkampfergebnisse (\u00f6ffentlich zug\u00e4nglich)\n- Benutzerdaten registrierter Nutzer (Name, E-Mail-Adresse) zur Authentifizierung\n\n## 3. Keine Weitergabe an Dritte\nPersonenbezogene Daten werden nicht an Dritte weitergegeben.\n\n## 4. Hosting\nDie Anwendung wird auf Servern von all-inkl.com (ALL-INKL.COM \u2013 Neue Medien M\u00fcnnich) in Deutschland betrieben.\n\n## 5. Kontakt\nBei Fragen zur Datenverarbeitung wenden Sie sich bitte an die Vereinsverantwortlichen.";
var FOOTER_DEFAULT_NU  = "# Nutzungsbedingungen\n\n**Stand: 2026**\n\n## 1. Nutzung\nDiese Anwendung dient der internen Vereinsstatistik des [Vereinsname] Die Nutzung ist Vereinsmitgliedern und autorisierten Personen vorbehalten.\n\n## 2. Inhalte\nDie dargestellten Ergebnisse und Athletendaten sind vereinseigene Daten. Eine Weiterverwendung oder Ver\u00f6ffentlichung bedarf der Genehmigung des Vereins.\n\n## 3. Technische Verf\u00fcgbarkeit\nDer Betreiber \u00fcbernimmt keine Gew\u00e4hr f\u00fcr die st\u00e4ndige Verf\u00fcgbarkeit der Anwendung.\n\n## 4. \u00c4nderungen\nDiese Nutzungsbedingungen k\u00f6nnen jederzeit angepasst werden.";
var FOOTER_DEFAULT_IMP = "# Impressum\n\n**Angaben gem\u00e4\u00df \u00a7 5 TMG**\n\n[Vereinsname] \u2013 Leichtathletik-Abteilung\n\n*Bitte vervollst\u00e4ndigen Sie das Impressum mit Ihrer Vereinsanschrift und einem Verantwortlichen.*\n\n## Kontakt\nE-Mail: [Ihre E-Mail-Adresse]\n\n## Vereinsregister\nEingetragen im Vereinsregister.\nRegistergericht: [Ihr Registergericht]\n\n## Inhaltlich Verantwortlicher\n[Name des Verantwortlichen gem\u00e4\u00df \u00a7 55 Abs. 2 RStV]";

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
// Globale Hilfsfunktion: AK-Array → lesbarer Range-String (W45–W65, W35–W45 und W55–W65, …)
function compressAKList(aks) {
  var seen = {}, unique = [];
  for (var _i = 0; _i < aks.length; _i++) { if (!seen[aks[_i]]) { seen[aks[_i]] = true; unique.push(aks[_i]); } }
  aks = unique;
  if (aks.length <= 2) return aks.join(' und ');
  var prefix = aks[0].replace(/\d+/, '');
  var nums = aks.map(function(a) { return parseInt(a.replace(/\D/g, ''), 10); });
  nums.sort(function(a, b) { return a - b; });
  var allConsec = true;
  for (var _ci = 1; _ci < nums.length; _ci++) {
    if (nums[_ci] - nums[_ci - 1] !== 5) { allConsec = false; break; }
  }
  if (allConsec) return prefix + nums[0] + '\u2013' + prefix + nums[nums.length - 1];
  var groups = [[nums[0]]];
  for (var _gi = 1; _gi < nums.length; _gi++) {
    if (nums[_gi] - nums[_gi - 1] === 5) groups[groups.length - 1].push(nums[_gi]);
    else groups.push([nums[_gi]]);
  }
  var gparts = groups.map(function(g) {
    if (g.length >= 3) return prefix + g[0] + '\u2013' + prefix + g[g.length - 1];
    return g.map(function(n) { return prefix + n; }).join(', ');
  });
  return gparts.slice(0, -1).join(', ') + ' und ' + gparts[gparts.length - 1];
}

function medalBadge(n) {
  if (!n) return '';
  n = parseInt(n, 10);
  var cls = n === 1 ? 'gold' : n === 2 ? 'silver' : n === 3 ? 'bronze' : 'rank';
  return '<span class="medal-badge ' + cls + '">' + n + '</span>';
}
// Alias für AK-Platzierungen
function medalBadge(platz) { return medalBadge(platz); }

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
  // Rollennamen aus Konfiguration laden (ueberschreibt Hardcoded-Fallback)
  if (cfg && cfg.rollen_labels && cfg.rollen_labels.length) {
    window._rollenMap = window._rollenMap || {};
    cfg.rollen_labels.forEach(function(r) { window._rollenMap[r.name] = r; });
  }

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
  apiGet('ping').catch(function(){}); // Seitenaufruf tracken

  var r = await apiGet('auth/me');
  if (r && r.ok) {
    currentUser = r.data;
    showApp();
  } else {
    currentUser = null;
    showApp();
  }
}

// Veranstaltungsname aus Ergebnis-Objekt je nach Admin-Einstellung
function fmtVeranstName(e) {
  var pref = (window.appConfig && window.appConfig.veranstaltung_anzeige) || 'ort';
  if (pref === 'name' && e.veranstaltung_name) return e.veranstaltung_name;
  // Fallback: ort aus veranstaltung_ort, dann aus kuerzel
  return e.veranstaltung_ort || (e.veranstaltung || '').split(' ').slice(1).join(' ') || e.veranstaltung_name || '';
}
// ── SETUP-WIZARD ─────────────────────────────────────────────
var _setup = { step: 1, reason: '', hasConfig: false,
               host:'localhost', port:3306, name:'', user:'', pass:'', prefix:'',
               adminPw:'', adminPw2:'',
               vereinName:'Mein Verein e.V.', vereinKuerzel:'Mein Verein', appUntertitel:'Leichtathletik-Statistik',
               farbePrimary:'#cc0000', farbenAccent:'#003087',
               emailDomain:'', noreplEmail:'' };

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
      field('Vereinsname',       'setup-verein-name',     s.vereinName,      'z.B. Muster-Verein 1953 e.V.') +
      field('Kurzbezeichnung',   'setup-verein-kuerzel',  s.vereinKuerzel,   'z.B. Musterverein', 'Wird im Header angezeigt') +
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
      email_domain:    _setup.emailDomain   || '',
      noreply_email:   _setup.noreplEmail   || '',
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
  _loginState = { step: 1, ident: '', name: '', has_passkey: false };
  renderLoginStep1();
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
  var emailDomain = appConfig.email_domain || '';
  var looksLikeEmail = /^[^@]+@[^@]+\.[^@]+$/.test(email);
  if (!email || !looksLikeEmail) {
    hint.className = 'reg-email-hint';
    hint.innerHTML = emailDomain ? '🔒 Nur <strong>@' + emailDomain + '</strong>-E-Mail-Adressen sind zugelassen.' : '📧 Bitte eine gültige E-Mail-Adresse eingeben.';
    return;
  }
  if (!emailDomain) {
    // Kein Domain-Filter → jede gültige E-Mail akzeptieren
    hint.className = 'reg-email-hint reg-email-ok';
    hint.innerHTML = '✓ Gültige E-Mail-Adresse';
  } else if (email.endsWith('@' + emailDomain)) {
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
          (appConfig.email_domain ? '🔒 Nur <strong>@' + appConfig.email_domain + '</strong>-E-Mail-Adressen sind zugelassen.' : '📧 Bitte eine gültige E-Mail-Adresse eingeben.') +
        '</div>' +
      '</div>' +
      // Kein Nickname-Feld – E-Mail wird als Anzeigename verwendet
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
      '<button class="btn-login" style="width:100%" onclick="regStep3()">2FA bestätigen →</button>' +
      '<div style="text-align:center;margin-top:16px;padding-top:14px;border-top:1px solid rgba(255,255,255,.15)">' +
        '<button class="btn-login-cancel" style="font-size:12px;opacity:.8" onclick="regSkipTotp()">' +
          '📧 Stattdessen immer einen Code per E-Mail erhalten' +
        '</button>' +
      '</div>';
  } else if (s === 4) {
    body =
      '<div style="max-width:560px">' +
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
  var pw    = document.getElementById('reg-pw').value;
  var pw2   = document.getElementById('reg-pw2').value;

  var _dom = appConfig.email_domain || '';
  if (_dom && !email.endsWith('@' + _dom)) return _regErr('Nur @' + _dom + ' E-Mail-Adressen sind zugelassen.');
  var pwScore = _pwScore(pw);
  if (pw.length < 12)   return _regErr('Passwort muss mindestens 12 Zeichen haben.');
  if (pwScore.groups < 3) return _regErr('Passwort muss mindestens 3 von 4 Zeichengruppen enthalten (Großbuchstaben, Kleinbuchstaben, Zahlen, Sonderzeichen).');
  if (pw !== pw2)        return _regErr('Passwörter stimmen nicht überein.');

  _regState.email = email;
  _regState.pw    = pw;

  var r = await apiPost('auth/register-start', { email: email, passwort: pw });
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

async function regSkipTotp() {
  _regErr('');
  var r = await apiPost('auth/register-email-2fa', { email: _regState.email });
  if (!r || !r.ok) return _regErr((r && r.fehler) || 'Fehler.');
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

// ── Dreistufiger Login-State ────────────────────────────────
var _loginState = { step: 1, ident: '', name: '', has_passkey: false };

function _loginLogoHtml() {
  return appConfig.logo_datei
    ? '<div style="text-align:center;margin-bottom:16px"><img src="/' + appConfig.logo_datei + '" style="height:52px;object-fit:contain" onerror="this.style.display=\'none\'"/></div>'
    : '';
}

function _loginCard(inner) {
  return '<div class="login-card">' + _loginLogoHtml() + inner + '</div>';
}

// Schritt 1: Benutzername / E-Mail
// ── Passkey Conditional UI ────────────────────────────────
// Läuft still im Hintergrund auf Step-1; der Browser zeigt Passkey-Vorschläge
// direkt im E-Mail-Feld an (autocomplete="username webauthn").
var _conditionalPasskeyAbort = null;

async function _startConditionalPasskey() {
  _abortConditionalPasskey();
  if (!window.PublicKeyCredential ||
      !PublicKeyCredential.isConditionalMediationAvailable ||
      !(await PublicKeyCredential.isConditionalMediationAvailable())) return;
  // AbortController VOR dem Fetch anlegen, damit _abortConditionalPasskey()
  // auch einen in-flight Request abbrechen kann
  _conditionalPasskeyAbort = new AbortController();
  try {
    var optR = await api('POST', 'auth/passkey-auth-challenge-discover', {}, _conditionalPasskeyAbort.signal);
    if (!optR || !optR.ok) { _conditionalPasskeyAbort = null; return; }
    var opts = optR.data;
    // Token für stateless Verify merken
    var _discoverToken     = opts.token;
    var _discoverTs        = opts.ts;
    var _discoverChallenge = opts.challenge;
    var assertion = await navigator.credentials.get({
      signal: _conditionalPasskeyAbort.signal,
      mediation: 'conditional',
      publicKey: {
        challenge:        _b64urlToBuffer(opts.challenge),
        timeout:          opts.timeout || 60000,
        rpId:             opts.rpId,
        userVerification: opts.userVerification || 'preferred',
        allowCredentials: [],
      }
    });
    // Nutzer hat Passkey über Autofill ausgewählt
    var cred = {
      id: assertion.id, type: assertion.type,
      response: {
        authenticatorData: _bufferToB64url(assertion.response.authenticatorData),
        clientDataJSON:    _bufferToB64url(assertion.response.clientDataJSON),
        signature:         _bufferToB64url(assertion.response.signature),
        userHandle:        assertion.response.userHandle ? _bufferToB64url(assertion.response.userHandle) : null,
      }
    };
    var verR = await apiPost('auth/passkey-auth-verify', {
      credential: cred,
      discover_token: _discoverToken,
      discover_ts:    _discoverTs,
      discover_challenge: _discoverChallenge,
    });
    if (!verR || !verR.ok) {
      var errEl = document.getElementById('login-err');
      if (errEl) { errEl.textContent = '❌ Passkey-Verifizierung fehlgeschlagen.'; errEl.style.display='block'; }
      return;
    }
    currentUser = { name: verR.data.name || '', email: verR.data.email || '', vorname: verR.data.vorname || '', rolle: verR.data.rolle, rechte: (verR.data.rechte || []) };
    showApp();
  } catch(e) {
    // AbortError = wir haben selbst abgebrochen → still
    // NotAllowedError = Nutzer hat abgebrochen → still
  }
}

function _abortConditionalPasskey() {
  if (_conditionalPasskeyAbort) { try { _conditionalPasskeyAbort.abort(); } catch(e){} _conditionalPasskeyAbort = null; }
}

function renderLoginStep1() {
  document.getElementById('login-screen').innerHTML = _loginCard(
    '<h2 style="font-size:20px;font-weight:700;margin:0 0 6px">&#x1F512; Anmelden</h2>' +
    '<p style="color:var(--text2);font-size:13px;margin:0 0 20px">E-Mail-Adresse eingeben.</p>' +
    '<div class="form-group" style="margin-bottom:16px">' +
      '<label>E-Mail-Adresse</label>' +
      '<input type="email" id="login-ident" autocomplete="username webauthn" style="font-size:16px"' +
        ' onkeydown="if(event.key===\'Enter\')doLoginStep1()"/>' +
    '</div>' +
    '<div id="login-err" style="display:none;background:#fde8e8;color:#cc0000;padding:8px 12px;border-radius:7px;font-size:13px;font-weight:600;margin-bottom:12px"></div>' +
    '<button class="btn btn-primary" style="width:100%" onclick="doLoginStep1()">Weiter &#x2192;</button>' +
    '<button class="btn btn-ghost btn-login-cancel" style="width:100%;margin-top:8px" onclick="hideLogin()">Abbrechen</button>'
  );
  setTimeout(function(){ var el=document.getElementById('login-ident'); if(el) el.focus(); }, 100);
  // Kurze Verzögerung: erst starten wenn der Nutzer vermutlich noch tippt,
  // nicht sofort beim Rendern (vermeidet Session-Lock-Konflikt mit schnellem Weiter-Klick)
  setTimeout(_startConditionalPasskey, 500);
}

async function doLoginStep1() {
  var ident = (document.getElementById('login-ident').value || '').trim();
  var errEl = document.getElementById('login-err');
  errEl.style.display = 'none';
  if (!ident) { errEl.textContent = 'Bitte E-Mail-Adresse eingeben.'; errEl.style.display='block'; return; }
  var btn = document.querySelector('#login-screen .btn-primary');
  btn.textContent = '...'; btn.disabled = true;
  _abortConditionalPasskey(); // Conditional UI sofort abbrechen (Session-Lock freigeben)
  var r = await apiPost('auth/identify', { benutzername: ident });
  btn.textContent = 'Weiter →'; btn.disabled = false;
  if (!r || !r.ok) { errEl.textContent = '❌ ' + ((r&&r.fehler)||'Fehler'); errEl.style.display='block'; return; }
  _loginState.ident = ident;
  _loginState.name  = ident;
  _loginState.has_passkey = !!(r.data && r.data.has_passkey);
  renderLoginStep2();
}
// Schritt 2: Passwort (+ optionaler Passkey-Button wenn Passkey vorhanden)
function renderLoginStep2() {
  var passkeyHint = _loginState.has_passkey
    ? '<button class="btn btn-ghost" style="width:100%;margin-bottom:10px;font-size:13px" onclick="doLoginPasskeyStep2()">&#x1F511; Mit Passkey anmelden</button>'
    : '';
  document.getElementById('login-screen').innerHTML = _loginCard(
    '<h2 style="font-size:20px;font-weight:700;margin:0 0 6px">&#x1F512; Anmelden</h2>' +
    '<p style="color:var(--text2);font-size:13px;margin:0 0 16px">Als <strong>' + _loginState.ident + '</strong></p>' +
    passkeyHint +
    '<div class="form-group" style="margin-bottom:16px">' +
      '<label>Passwort</label>' +
      '<input type="password" id="login-pw" autocomplete="current-password" style="font-size:16px"' +
        ' onkeydown="if(event.key===\'Enter\')doLoginStep2()"/>' +
    '</div>' +
    '<div id="login-err" style="display:none;background:#fde8e8;color:#cc0000;padding:8px 12px;border-radius:7px;font-size:13px;font-weight:600;margin-bottom:12px"></div>' +
    '<button class="btn btn-primary" style="width:100%" onclick="doLoginStep2()">Anmelden</button>' +
    '<button class="btn btn-ghost" style="width:100%;margin-top:4px;opacity:.7;font-size:12px" onclick="renderLoginStep1()">&#x2190; Zurück</button>'
  );
  setTimeout(function(){ var el=document.getElementById('login-pw'); if(el) el.focus(); }, 100);
}

// Passkey-Button in Step 2 (User bekannt, challenge mit allowCredentials)
async function doLoginPasskeyStep2() {
  var errEl = document.getElementById('login-err');
  errEl.style.display = 'none';
  try {
    var optR = await apiPost('auth/passkey-auth-challenge', {});
    if (!optR || !optR.ok) { errEl.textContent = '❌ Passkey-Challenge fehlgeschlagen.'; errEl.style.display='block'; return; }
    var opts = optR.data;
    var allowCreds = (opts.allowCredentials || []).map(function(c) {
      return { type: 'public-key', id: _b64urlToBuffer(c.id) };
    });
    var assertion = await navigator.credentials.get({ publicKey: {
      challenge: _b64urlToBuffer(opts.challenge), timeout: opts.timeout || 60000,
      rpId: opts.rpId, userVerification: opts.userVerification || 'preferred',
      allowCredentials: allowCreds,
    }});
    var cred = {
      id: assertion.id, type: assertion.type,
      response: {
        authenticatorData: _bufferToB64url(assertion.response.authenticatorData),
        clientDataJSON:    _bufferToB64url(assertion.response.clientDataJSON),
        signature:         _bufferToB64url(assertion.response.signature),
        userHandle:        assertion.response.userHandle ? _bufferToB64url(assertion.response.userHandle) : null,
      }
    };
    var verR = await apiPost('auth/passkey-auth-verify', { credential: cred });
    if (!verR || !verR.ok) { errEl.textContent = '❌ ' + ((verR&&verR.fehler)||'Passkey fehlgeschlagen.'); errEl.style.display='block'; return; }
    currentUser = { name: verR.data.name||'', email: verR.data.email||'', vorname: verR.data.vorname||'', rolle: verR.data.rolle, rechte: (verR.data.rechte || []) };
    showApp();
  } catch(e) {
    if (e && e.name !== 'NotAllowedError') { errEl.textContent = '⚠️ Passkey-Dialog fehlgeschlagen.'; errEl.style.display='block'; }
  }
}

async function doLoginStep2() {
  var passwort = (document.getElementById('login-pw').value || '');
  var errEl = document.getElementById('login-err');
  errEl.style.display = 'none';
  if (!passwort) { errEl.textContent = 'Bitte Passwort eingeben.'; errEl.style.display='block'; return; }
  var btn = document.querySelector('#login-screen .btn-primary');
  btn.textContent = '...'; btn.disabled = true;
  var r = await apiPost('auth/login', { benutzername: _loginState.ident, passwort: passwort });
  btn.textContent = 'Weiter \u2192'; btn.disabled = false;
  if (r && r.ok) {
    if (r.data && r.data.totp_required) {
      if (r.data.totp_setup) await showTotpSetup();
      else if (r.data.email_login_bevorzugt && !r.data.has_totp && !r.data.has_passkey) {
        // User bevorzugt E-Mail-Code → Schritt 3 mit E-Mail-Tab + sofort Code senden
        renderLoginStep3(false, false, true); // autoSend=true
      } else renderLoginStep3(r.data.has_totp !== false, r.data.has_passkey !== false);
    } else {
      currentUser = { name: r.data.name || _loginState.ident, email: r.data.email || _loginState.ident, vorname: r.data.vorname || '', rolle: r.data.rolle, rechte: (r.data.rechte || []) };
      showApp();
    }
  } else {
    errEl.textContent = '\u274C ' + ((r&&r.fehler)||'Unbekannter Fehler');
    errEl.style.display = 'block';
    document.getElementById('login-pw').value = '';
    document.getElementById('login-pw').focus();
  }
}

// Schritt 3: TOTP oder E-Mail-Code
function renderLoginStep3(hasTotp, hasPasskey, autoSend) {
  var methods = [];
  if (hasTotp)    methods.push('totp');
  if (hasPasskey) methods.push('passkey');
  methods.push('email'); // immer verfügbar
  _loginStep3ShowMethod(methods[0], methods, autoSend);
}

function _loginStep3ShowMethod(active, methods, autoSend) {
  var tabs = '';
  if (methods.indexOf('totp') >= 0)
    tabs += '<button class="btn btn-' + (active==='totp'?'primary':'ghost') + ' btn-sm" onclick="_loginStep3ShowMethod(\'totp\',[' + methods.map(function(m){return '\''+m+'\''}).join(',') + '])">&#x1F4F1; App</button> ';
  if (methods.indexOf('passkey') >= 0)
    tabs += '<button class="btn btn-' + (active==='passkey'?'primary':'ghost') + ' btn-sm" onclick="_loginStep3ShowMethod(\'passkey\',[' + methods.map(function(m){return '\''+m+'\''}).join(',') + '])">&#x1F511; Passkey</button> ';
  tabs += '<button class="btn btn-' + (active==='email'?'primary':'ghost') + ' btn-sm" onclick="_loginStep3ShowMethod(\'email\',[' + methods.map(function(m){return '\''+m+'\''}).join(',') + '])">&#x1F4E7; E-Mail</button>';

  var body = '';
  if (active === 'totp') {
    body =
      '<p style="color:var(--text2);font-size:13px;margin:12px 0 16px">6-stelligen Code aus der Authenticator-App eingeben. Alternativ einen 8-stelligen Backup-Code.</p>' +
      '<div class="form-group" style="margin-bottom:16px">' +
        '<label>Authenticator-Code</label>' +
        '<input type="text" id="totp-code" inputmode="numeric" autocomplete="one-time-code" maxlength="9" placeholder="000 000"' +
          ' style="letter-spacing:4px;font-size:24px;text-align:center;font-weight:700"' +
          ' onkeydown="if(event.key===\'Enter\')doTotpVerify()"/>' +
      '</div>' +
      '<div id="login-err" style="display:none;background:#fde8e8;color:#cc0000;padding:8px 12px;border-radius:7px;font-size:13px;font-weight:600;margin-bottom:12px"></div>' +
      '<button class="btn btn-primary" style="width:100%" onclick="doTotpVerify()">Best\u00e4tigen</button>';
  } else if (active === 'passkey') {
    body =
      '<p style="color:var(--text2);font-size:13px;margin:12px 0 20px">Bestätige die Anmeldung mit deinem Passkey.</p>' +
      '<div id="login-err" style="display:none;background:#fde8e8;color:#cc0000;padding:8px 12px;border-radius:7px;font-size:13px;font-weight:600;margin-bottom:12px"></div>' +
      '<button class="btn btn-primary" style="width:100%" onclick="doPasskeyAuth()">&#x1F511; Passkey verwenden</button>';
  } else { // email
    if (autoSend) {
      // Nur E-Mail möglich: Code wird automatisch gesendet
      body =
        '<p style="color:var(--text2);font-size:13px;margin:12px 0 8px">Wir haben dir einen 6-stelligen Code an deine hinterlegte E-Mail-Adresse gesendet.</p>' +
        '<div id="email-code-sent" style="color:var(--green,#2e7d32);font-size:12px;margin-bottom:14px">&#x2705; Bitte prüfe dein Postfach.</div>' +
        '<div id="login-err" style="display:none;background:#fde8e8;color:#cc0000;padding:8px 12px;border-radius:7px;font-size:13px;font-weight:600;margin-bottom:12px"></div>' +
        '<div class="form-group" style="margin-bottom:16px">' +
          '<label>Code aus E-Mail</label>' +
          '<input type="text" id="email-code" inputmode="numeric" maxlength="6" placeholder="000000"' +
            ' style="letter-spacing:6px;font-size:24px;text-align:center;font-weight:700"' +
            ' onkeydown="if(event.key===\'Enter\')doEmailCodeVerify()"/>' +
        '</div>' +
        '<button class="btn btn-primary" style="width:100%" onclick="doEmailCodeVerify()">Best\u00e4tigen</button>' +
        '<button class="btn btn-ghost btn-sm" style="width:100%;margin-top:8px;opacity:.6" id="email-send-btn" onclick="doEmailCodeSend()">&#x1F4E7; Code erneut senden</button>';
    } else {
      // Einer von mehreren 2FA-Tabs: manueller Send-Button
      body =
        '<p style="color:var(--text2);font-size:13px;margin:12px 0 16px">Wir senden dir einen 6-stelligen Code an deine hinterlegte E-Mail-Adresse.</p>' +
        '<div id="email-code-sent" style="display:none;color:var(--green,#2e7d32);font-size:13px;margin-bottom:12px">&#x2705; Code gesendet! Bitte prüfe dein Postfach.</div>' +
        '<div id="login-err" style="display:none;background:#fde8e8;color:#cc0000;padding:8px 12px;border-radius:7px;font-size:13px;font-weight:600;margin-bottom:12px"></div>' +
        '<button class="btn btn-ghost" style="width:100%;margin-bottom:12px" id="email-send-btn" onclick="doEmailCodeSend()">&#x1F4E7; Code senden</button>' +
        '<div class="form-group" style="margin-bottom:16px">' +
          '<label>Code aus E-Mail</label>' +
          '<input type="text" id="email-code" inputmode="numeric" maxlength="6" placeholder="000000"' +
            ' style="letter-spacing:6px;font-size:24px;text-align:center;font-weight:700"' +
            ' onkeydown="if(event.key===\'Enter\')doEmailCodeVerify()"/>' +
        '</div>' +
        '<button class="btn btn-primary" style="width:100%" onclick="doEmailCodeVerify()">Best\u00e4tigen</button>';
    }
  }

  document.getElementById('login-screen').innerHTML = _loginCard(
    '<h2 style="font-size:20px;font-weight:700;margin:0 0 6px">&#x1F512; Verifizierung</h2>' +
    '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:4px">' + tabs + '</div>' +
    body +
    '<button class="btn btn-ghost" style="width:100%;margin-top:8px;opacity:.7;font-size:12px" onclick="renderLoginStep1()">&#x2190; Zur\u00fcck</button>'
  );
  setTimeout(function(){
    var el = document.getElementById('totp-code') || document.getElementById('email-code');
    if (el) el.focus();
  }, 100);
  // autoSend: Code sofort absenden (nur wenn einzige 2FA-Methode)
  if (autoSend && active === 'email') {
    setTimeout(doEmailCodeSend, 300);
  }
}

async function doEmailCodeSend() {
  var btn = document.getElementById('email-send-btn');
  var errEl = document.getElementById('login-err');
  if (btn) { btn.textContent = '...'; btn.disabled = true; }
  errEl.style.display = 'none';
  var r = await apiPost('auth/email-code-send', {});
  if (btn) { btn.textContent = '\uD83D\uDCE7 Code erneut senden'; btn.disabled = false; }
  if (r && r.ok) {
    var sentEl = document.getElementById('email-code-sent');
    if (sentEl) sentEl.style.display = 'block';
    var codeEl = document.getElementById('email-code');
    if (codeEl) codeEl.focus();
  } else {
    errEl.textContent = '\u274C ' + ((r&&r.fehler)||'Fehler beim Senden');
    errEl.style.display = 'block';
  }
}

async function doEmailCodeVerify() {
  var code = (document.getElementById('email-code').value || '').trim();
  var errEl = document.getElementById('login-err');
  errEl.style.display = 'none';
  if (!code || code.length !== 6) { errEl.textContent = 'Bitte 6-stelligen Code eingeben.'; errEl.style.display='block'; return; }
  var btn = document.querySelector('#login-screen .btn-primary');
  btn.textContent = '...'; btn.disabled = true;
  var r = await apiPost('auth/email-code-verify', { code: code });
  btn.textContent = 'Best\u00e4tigen'; btn.disabled = false;
  if (r && r.ok) {
    currentUser = { name: r.data.name || _loginState.ident, email: r.data.email || _loginState.ident, vorname: r.data.vorname || '', rolle: r.data.rolle, rechte: (r.data.rechte || []) };
    showApp();
  } else {
    errEl.textContent = '\u274C ' + ((r&&r.fehler)||'Ung\u00fcltiger Code.');
    errEl.style.display = 'block';
    document.getElementById('email-code').value = '';
    document.getElementById('email-code').focus();
  }
}

// Legacy-Compat: doLogin() → renderLoginStep1()
function doLogin() { renderLoginStep1(); }
var _loginPendingName = '';

// doLogin() → renderLoginStep1() (Schritt 1)

function show2FAChoice(hasTotp, hasPasskey) {
  if (hasTotp && hasPasskey) {
    // Beide verfügbar → Auswahl anbieten
    document.getElementById('login-screen').innerHTML =
      '<div class="login-card">' +
      '<div style="text-align:center;margin-bottom:20px"><img src="' + (appConfig.logo_datei ? '/' + appConfig.logo_datei : '') + '" style="height:60px;object-fit:contain" onerror="this.style.display=\'none\'"/></div>' +
      '<h2 style="font-size:18px;font-weight:700;margin:0 0 6px">&#x1F512; Zwei-Faktor-Authentifizierung</h2>' +
      '<p style="color:var(--text2);font-size:13px;margin:0 0 24px">Wähle deine 2FA-Methode:</p>' +
      '<button class="btn btn-primary" style="width:100%;margin-bottom:12px;font-size:15px;padding:14px" onclick="doPasskeyAuth()">' +
        '&#x1F511; Mit Passkey anmelden' +
      '</button>' +
      '<button class="btn btn-ghost" style="width:100%;margin-bottom:12px" onclick="showTotpVerify()">' +
        '&#x1F4F1; Authenticator-App verwenden' +
      '</button>' +
      '<button class="btn btn-ghost" style="width:100%;opacity:.6;font-size:12px" onclick="location.reload()">Zurück</button>' +
      '</div>';
  } else if (hasPasskey) {
    doPasskeyAuth();
  } else {
    showTotpVerify();
  }
}

async function doPasskeyAuth() {
  document.getElementById('login-screen').innerHTML =
    '<div class="login-card" style="text-align:center">' +
    '<div style="margin-bottom:20px"><img src="' + (appConfig.logo_datei ? '/' + appConfig.logo_datei : '') + '" style="height:60px;object-fit:contain" onerror="this.style.display=\'none\'"/></div>' +
    '<div style="font-size:48px;margin:16px 0">&#x1F511;</div>' +
    '<h2 style="font-size:18px;font-weight:700;margin:0 0 8px">Passkey-Anmeldung</h2>' +
    '<p style="color:var(--text2);font-size:13px;margin:0 0 20px">Bitte bestätige die Anmeldung in deinem Gerät&hellip;</p>' +
    '<div id="passkey-err" style="display:none;background:#fde8e8;color:#cc0000;padding:8px 12px;border-radius:7px;font-size:13px;font-weight:600;margin-bottom:12px"></div>' +
    '<button class="btn btn-ghost" style="width:100%;margin-top:8px" onclick="location.reload()">Zurück</button>' +
    '</div>';
  try {
    var optR = await apiPost('auth/passkey-auth-challenge', {});
    if (!optR || !optR.ok) throw new Error((optR && optR.fehler) || 'Challenge fehlgeschlagen');
    var opts = optR.data;
    // allowCredentials: base64url → ArrayBuffer
    var allowCreds = (opts.allowCredentials || []).map(function(c) {
      return { type: 'public-key', id: _b64urlToBuffer(c.id) };
    });
    var assertOpts = {
      challenge:        _b64urlToBuffer(opts.challenge),
      timeout:          opts.timeout || 60000,
      rpId:             opts.rpId,
      userVerification: opts.userVerification || 'preferred',
      allowCredentials: allowCreds,
    };
    var assertion = await navigator.credentials.get({ publicKey: assertOpts });
    var cred = {
      id:   assertion.id,
      type: assertion.type,
      response: {
        authenticatorData: _bufferToB64url(assertion.response.authenticatorData),
        clientDataJSON:    _bufferToB64url(assertion.response.clientDataJSON),
        signature:         _bufferToB64url(assertion.response.signature),
        userHandle:        assertion.response.userHandle ? _bufferToB64url(assertion.response.userHandle) : null,
      }
    };
    var verR = await apiPost('auth/passkey-auth-verify', { credential: cred });
    if (!verR || !verR.ok) throw new Error((verR && verR.fehler) || 'Verifikation fehlgeschlagen');
    currentUser = { name: verR.data.name || _loginState.ident || _loginPendingName, email: verR.data.email || _loginState.ident, vorname: verR.data.vorname || '', rolle: verR.data.rolle, rechte: (verR.data.rechte || []) };
    showApp();
  } catch(e) {
    var errEl = document.getElementById('passkey-err');
    if (errEl) {
      errEl.textContent = '❌ ' + (e.message || String(e));
      errEl.style.display = 'block';
    }
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
  var errEl = document.getElementById('login-err') || document.getElementById('totp-err');
  if (errEl) errEl.style.display = 'none';
  if (!code) { if(errEl){errEl.textContent='Bitte Code eingeben.';errEl.style.display='block';} return; }
  var btn = document.querySelector('#login-screen .btn-primary');
  if (btn) { btn.textContent = '...'; btn.disabled = true; }
  var r = await apiPost('auth/totp-verify', { code: code });
  if (btn) { btn.textContent = 'Best\u00e4tigen'; btn.disabled = false; }
  if (r && r.ok) {
    currentUser = { name: r.data.name || _loginState.ident || _loginPendingName, email: r.data.email || _loginState.ident, vorname: r.data.vorname || '', rolle: r.data.rolle, rechte: (r.data.rechte || []) };
    _loginPendingName = '';
    showApp();
  } else {
    if(errEl){errEl.textContent='\u274C '+((r&&r.fehler)||'Ung\u00fcltiger Code.');errEl.style.display='block';}
    var tcEl = document.getElementById('totp-code'); if(tcEl){tcEl.value='';tcEl.focus();}
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
    currentUser = { name: _loginPendingName, rolle: r.data.rolle, rechte: (r.data.rechte || []) };
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
  // rekState-Filter zurücksetzen damit beim nächsten Login Prefs neu geladen werden
  if (state.rekState) {
    delete state.rekState.mergeAK;
    delete state.rekState.unique;
    delete state.rekState.highlightCurYear;
    delete state.rekState.highlightPrevYear;
  }
  state.userPrefs = {};
  showApp();
}

async function showApp() {
  document.getElementById('login-screen').style.display = 'none';
  // app-screen ist immer sichtbar (kein display toggle nötig)
  // Anon-Login-Button aufräumen falls vorhanden
  var anonBtn = document.getElementById('anon-login-btn');
  if (anonBtn) anonBtn.parentNode.removeChild(anonBtn);

  if (currentUser) {
    var name = (currentUser.vorname && currentUser.vorname.trim()) ? currentUser.vorname : (currentUser.email || currentUser.name || '?');
    var avatarEl = document.getElementById('user-avatar');
    _renderHeaderAvatar(avatarEl, currentUser.avatar, name, true);
    // Anzeige: Vorname aus Athletenprofil wenn vorhanden, sonst E-Mail
    var _dispName = (currentUser.vorname && currentUser.vorname.trim()) ? currentUser.vorname : (currentUser.email || name);
    document.getElementById('user-name-disp').textContent  = _dispName;
    document.getElementById('user-rolle-disp').textContent = rolleLabel(currentUser.rolle, true);
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
  restoreFromHash();  // Tab aus URL-Hash wiederherstellen — VOR buildNav!
  buildNav();
  buildFooter();
  await loadDisziplinen();
  if (currentUser) {
    loadAthleten();  // parallel, nicht abwarten nötig
    // Avatar + Vorname ABWARTEN (muss vor renderPage sein damit Header korrekt)
    try {
      var _meR = await apiGet('auth/me');
      if (_meR && _meR.ok && _meR.data) {
        if (_meR.data.avatar)    currentUser.avatar    = _meR.data.avatar;
        if (_meR.data.vorname)   currentUser.vorname   = _meR.data.vorname;
        if (_meR.data.email)     currentUser.email     = _meR.data.email;
        if (_meR.data.name)      currentUser.name      = _meR.data.name;
        if (_meR.data.athlet_id != null) currentUser.athlet_id = _meR.data.athlet_id;
        if (_meR.data.rechte)    currentUser.rechte    = _meR.data.rechte;
        if (_meR.data.nachname)  currentUser.nachname  = _meR.data.nachname;
        // Header-Avatar sofort aktualisieren
        var _avatarEl = document.getElementById('user-avatar');
        if (_avatarEl) {
          var _n = (currentUser.vorname && currentUser.vorname.trim()) ? currentUser.vorname : (currentUser.email || currentUser.name || '?');
          _renderHeaderAvatar(_avatarEl, currentUser.avatar, _n, true);
        }
        var _nameEl = document.getElementById('user-name-disp');
        if (_nameEl) {
          var _dn = (currentUser.vorname && currentUser.vorname.trim()) ? currentUser.vorname : (currentUser.email || currentUser.name || '?');
          _nameEl.textContent = _dn;
        }
      }
    } catch(e) {}
    // User-Präferenzen ABWARTEN bevor renderPage() — sonst werden Defaults gerendert
    try {
      var _prefsR = await apiGet('auth/prefs');
      if (_prefsR && _prefsR.ok) {
        state.userPrefs = _prefsR.data || {};
        var up = state.userPrefs;
        state.rekState.mergeAK           = up.rek_merge_ak   !== undefined ? !!up.rek_merge_ak   : true;
        state.rekState.unique            = up.rek_unique     !== undefined ? !!up.rek_unique     : true;
        state.rekState.highlightCurYear  = up.rek_hl_cur     !== undefined ? !!up.rek_hl_cur     : true;
        state.rekState.highlightPrevYear = up.rek_hl_prev    !== undefined ? !!up.rek_hl_prev    : false;
      }
    } catch(e) {} // Prefs-Fehler darf Login nicht blockieren
  } else {
    state.userPrefs = {};
  }
  renderPage();
}

function showUserMenu() {
  navigate('konto');
}

async function _ladeKontoAthletPanel() {
  var panel = document.getElementById('konto-athlet-panel');
  if (!panel || !currentUser.athlet_id) return;
  var r = await apiGet('athleten/' + currentUser.athlet_id);
  if (!r || !r.ok) { panel.innerHTML = panel.innerHTML.replace('<div class="loading"><div class="spinner"></div></div>', '<div style="color:var(--accent);font-size:13px">Fehler beim Laden.</div>'); return; }
  var a = r.data.athlet;

  var geschlechtOpts = [
    '<option value="">-- wählen --</option>',
    '<option value="M"' + (a.geschlecht === 'M' ? ' selected' : '') + '>♂ Männlich</option>',
    '<option value="W"' + (a.geschlecht === 'W' ? ' selected' : '') + '>♀ Weiblich</option>',
    '<option value="D"' + (a.geschlecht === 'D' ? ' selected' : '') + '>⚧ Divers</option>',
  ].join('');

  var formHtml =
    '<div class="form-grid">' +
      '<div class="form-group">' +
        '<label>Vorname</label>' +
        '<input type="text" id="ka-vorname" value="' + (a.vorname||'').replace(/"/g,'&quot;') + '"/>' +
      '</div>' +
      '<div class="form-group">' +
        '<label>Nachname</label>' +
        '<input type="text" id="ka-nachname" value="' + (a.nachname||'').replace(/"/g,'&quot;') + '"/>' +
      '</div>' +
      '<div class="form-group">' +
        '<label>Geschlecht</label>' +
        '<select id="ka-geschlecht">' + geschlechtOpts + '</select>' +
      '</div>' +
      '<div class="form-group">' +
        '<label>Geburtsjahr</label>' +
        '<input type="number" id="ka-geburtsjahr" value="' + (a.geburtsjahr||'') + '" min="1900" max="' + new Date().getFullYear() + '" placeholder="z.B. 1990"/>' +
      '</div>' +
    '</div>' +
    '<div id="ka-err" style="color:var(--accent);font-size:13px;min-height:18px;margin-bottom:8px"></div>' +
    '<div style="display:flex;align-items:center;gap:10px">' +
      '<button class="btn btn-primary btn-sm" onclick="saveKontoAthletDaten(' + currentUser.athlet_id + ')">' + ((currentUser.rolle === 'admin' || currentUser.rolle === 'editor') ? 'Speichern' : 'Antrag stellen') + '</button>' +
      ((currentUser.rolle === 'admin' || currentUser.rolle === 'editor') ? '' : '<span style="font-size:12px;color:var(--text2)">&#x23F3;&#xFE0E; Wird vor Veröffentlichung geprüft</span>') +
    '</div>';

  panel.innerHTML = panel.innerHTML.replace(
    '<div class="loading"><div class="spinner"></div></div>',
    formHtml
  );
}

async function saveKontoAthletDaten(athletId) {
  var errEl = document.getElementById('ka-err');
  if (errEl) errEl.textContent = '';

  var changes = {};
  var vn = document.getElementById('ka-vorname') ? document.getElementById('ka-vorname').value.trim() : null;
  var nn = document.getElementById('ka-nachname') ? document.getElementById('ka-nachname').value.trim() : null;
  var gs = document.getElementById('ka-geschlecht') ? document.getElementById('ka-geschlecht').value : null;
  var gj = document.getElementById('ka-geburtsjahr') ? document.getElementById('ka-geburtsjahr').value.trim() : null;

  if (vn !== null) changes.vorname = vn;
  if (nn !== null) changes.nachname = nn;
  if (gs !== null) changes.geschlecht = gs;
  if (gj !== null) changes.geburtsjahr = gj ? parseInt(gj) : null;

  // Admin/Editor: direkt speichern (kein Antrag)
  var directSave = currentUser && (currentUser.rolle === 'admin' || currentUser.rolle === 'editor');
  if (directSave) {
    var r = await apiPut('athleten/' + athletId, changes);
    if (r && r.ok) {
      notify('✅ Athletenprofil gespeichert.', 'ok');
      if (currentUser) {
        if (changes.vorname) currentUser.vorname = changes.vorname;
        if (changes.nachname) currentUser.nachname = changes.nachname;
      }
    } else {
      if (errEl) errEl.textContent = '❌ ' + ((r && r.fehler) || 'Fehler beim Speichern.');
    }
    return;
  }

  // Alle anderen: Antrag stellen
  var r2 = await apiPost('athleten/' + athletId + '/profil-antrag', changes);
  if (r2 && r2.ok) {
    notify('✅ Änderungsantrag gestellt – wird geprüft.', 'ok');
    if (errEl) errEl.textContent = '';
  } else {
    if (errEl) errEl.textContent = '❌ ' + ((r2 && r2.fehler) || 'Fehler beim Senden.');
  }
}

function _renderKontoPage() {
  if (!currentUser) { showLogin(); return; }
  var name = (currentUser.vorname && currentUser.vorname.trim()) ? currentUser.vorname : (currentUser.email || currentUser.name || '?');
  var el = document.getElementById('main-content');

  var avatarInner = currentUser.avatar
    ? '<img id="konto-avatar-img" src="' + currentUser.avatar + '" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:50%;">'
    : nameInitials(name);

  el.innerHTML =
    '<h1 style="font-size:22px;font-weight:700;color:var(--primary);margin-bottom:20px">&#x1F512; Konto</h1>' +

    // Two-column grid
    '<div class="konto-grid" style="display:grid;grid-template-columns:200px 1fr 1fr;gap:20px;align-items:start;max-width:1100px">' +

    // ── Left column ──
    '<div>' +

      // Avatar card
      '<div class="panel" style="padding:20px;text-align:center;margin-bottom:16px">' +
        '<div style="position:relative;width:72px;margin:0 auto 10px;cursor:pointer" onclick="document.getElementById(\'avatar-file-input\').click()" title="Avatar ändern">' +
          '<div class="profile-avatar" style="width:72px;height:72px;font-size:26px;overflow:hidden;padding:0;' + (currentUser.avatar ? 'background:none;' : '') + '">' + avatarInner + '</div>' +
          '<div style="position:absolute;bottom:0;right:0;background:var(--primary);color:var(--on-primary);border-radius:50%;width:20px;height:20px;display:flex;align-items:center;justify-content:center;font-size:11px;">&#x1F4F7;</div>' +
        '</div>' +
        '<input type="file" id="avatar-file-input" accept="image/png,image/jpeg,image/webp" style="display:none" onchange="uploadAvatar(this)">' +
        '<div style="font-weight:700;font-size:15px;'+( currentUser.verein ? 'color:var(--text)' : 'color:var(--primary)')+'">' + name + '</div>' +
        '<div style="color:var(--text2);font-size:12px;margin-top:3px">' + rolleLabel(currentUser.rolle) + '</div>' +
        (currentUser.avatar ? '<button class="btn btn-ghost btn-sm" style="margin-top:8px;font-size:11px;color:var(--text2)" onclick="deleteAvatar()">&#x2715; Avatar entfernen</button>' : '') +
      '</div>' +

      // Theme card
      '<div class="panel" style="padding:16px;margin-bottom:16px">' +
        '<div style="font-size:12px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">&#x1F319; Erscheinungsbild</div>' +
        '<div style="display:flex;flex-direction:column;gap:6px" id="theme-btns">' +
          '<button class="btn btn-sm ' + (getThemePref()==='auto'  ? 'btn-primary' : 'btn-ghost') + '" onclick="setTheme(\'auto\')" style="justify-content:flex-start">&#x1F4BB; Automatisch</button>' +
          '<button class="btn btn-sm ' + (getThemePref()==='light' ? 'btn-primary' : 'btn-ghost') + '" onclick="setTheme(\'light\')" style="justify-content:flex-start">&#x2600;&#xFE0F; Hell</button>' +
          '<button class="btn btn-sm ' + (getThemePref()==='dark'  ? 'btn-primary' : 'btn-ghost') + '" onclick="setTheme(\'dark\')" style="justify-content:flex-start">&#x1F319; Dunkel</button>' +
        '</div>' +
      '</div>' +

      // Konto löschen card
      (currentUser.rolle !== 'admin' ?
      '<div class="panel" style="padding:16px;border:1px solid #ffcdd2">' +
        '<div style="font-size:12px;font-weight:700;color:#cc0000;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">&#x26A0;&#xFE0E; Konto löschen</div>' +
        '<div style="font-size:12px;color:var(--text2);margin-bottom:12px;line-height:1.5">Konto wird vom Athletenprofil getrennt und 30 Tage lang in den Papierkorb verschoben.</div>' +
        '<button class="btn btn-ghost btn-sm" style="color:#cc0000;border-color:#cc0000;width:100%" onclick="showKontoLoeschenDialog()">Konto löschen…</button>' +
      '</div>'
      : '<div class="panel" style="padding:16px;border:1px solid var(--border)">' +
          '<div style="font-size:12px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">&#x26A0;&#xFE0E; Konto löschen</div>' +
          '<div style="font-size:12px;color:var(--text2);font-style:italic">Administratoren-Konten können nicht gelöscht werden.</div>' +
        '</div>') +

    '</div>' +

    // ── Middle column: Passwort + 2FA ──
    '<div>' +

      // Password card
      '<div class="panel" style="padding:20px;margin-bottom:16px">' +
        '<div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:14px">&#x1F511; Passwort ändern</div>' +
        '<div class="form-grid">' +
          '<div class="form-group full"><label>Aktuelles Passwort</label><input type="password" id="pw-alt" placeholder="" autocomplete="current-password"/></div>' +
          '<div class="form-group full"><label>Neues Passwort</label><input type="password" id="pw-neu" placeholder="min. 12 Zeichen" autocomplete="new-password" oninput="kontoNewPwCheck()"/>' +
            '<div id="konto-pw-strength" class="pw-strength-wrap" style="display:none">' +
              '<div class="pw-strength-bar"><div id="konto-pw-bar" class="pw-strength-fill"></div></div>' +
              '<div id="konto-pw-groups" class="pw-groups"></div>' +
            '</div>' +
          '</div>' +
          '<div class="form-group full"><label>Neues Passwort wiederholen</label><input type="password" id="pw-neu2" placeholder="Wiederholen" autocomplete="new-password"/></div>' +
        '</div>' +
        '<div id="pw-msg" style="display:none;margin:8px 0;padding:8px 12px;border-radius:7px;font-size:13px;font-weight:600"></div>' +
        '<button class="btn btn-primary btn-sm" style="margin-top:12px" onclick="changePasswort()">Passwort ändern</button>' +
      '</div>' +

      // 2FA card
      '<div class="panel" style="padding:20px">' +
        '<div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:4px">&#x1F512; Zwei-Faktor-Authentifizierung</div>' +
        '<div style="font-size:12px;color:var(--text2);margin-bottom:14px">Mindestens eine Methode muss aktiv sein, ansonsten erhältst du bei jedem Login eine E-Mail zur Bestätigung deiner Identität.</div>' +
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border)">' +
          '<span style="font-size:13px">&#x1F4F1; Authenticator-App (TOTP)</span>' +
          (currentUser.totp_aktiv
            ? '<button class="btn btn-sm btn-ghost" style="color:#cc0000" onclick="disableTotp()">Deaktivieren</button>'
            : '<button class="btn btn-sm btn-primary" onclick="showTotpSetupInProfile()">Einrichten</button>') +
        '</div>' +
        '<div style="padding:10px 0">' +
          '<div style="font-size:13px;margin-bottom:8px">&#x1F511; Passkeys</div>' +
          '<div id="passkey-section-profil"></div>' +
        '</div>' +
      '</div>' +

    '</div>' +

    // ── Right column: Athletenprofil ──
    (currentUser.athlet_id ?
      '<div><div class="panel" style="padding:20px" id="konto-athlet-panel">' +
        '<div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:4px">&#x1F3C3;&#xFE0E; Athletenprofil</div>' +
        (((currentUser && (currentUser.rolle === 'admin' || currentUser.rolle === 'editor')) ? '' : '<div style="font-size:12px;color:var(--text2);margin-bottom:14px">Änderungen werden von einem Editor oder Admin geprüft.</div>')) +
        '<div class="loading"><div class="spinner"></div></div>' +
      '</div></div>'
    : '') +

    '</div>'; // end grid

  setTimeout(function() { renderPasskeySection('passkey-section-profil'); }, 50);
  if (currentUser.athlet_id) { _ladeKontoAthletPanel(); }
}

async function showTotpSetupInProfile() {
  // TOTP-Setup für bereits eingeloggte User — läuft im Modal, nicht im Login-Screen
  var r = await apiGet('auth/totp-setup');
  if (!r || !r.ok) { notify('Fehler: ' + ((r && r.fehler) || 'Unbekannt'), 'err'); return; }
  var d = r.data;
  showModal(
    '<h2>&#x1F512; 2FA einrichten <button class="modal-close" onclick="closeModal()">&#x2715;</button></h2>' +
    '<p style="color:var(--text2);font-size:13px;margin:0 0 16px">Scanne den QR-Code mit einer Authenticator-App (z.B. Google/Microsoft Authenticator).</p>' +
    '<div style="text-align:center;margin-bottom:16px">' +
      '<img src="' + d.qr_url + '" style="width:180px;height:180px;border-radius:12px;border:1px solid var(--border)"/>' +
      '<p style="font-size:11px;color:var(--text2);margin:8px 0 4px">Oder manuell eingeben:</p>' +
      '<code style="font-size:12px;font-weight:700;background:var(--surf2);padding:6px 12px;border-radius:6px;display:inline-block;word-break:break-all">' + d.secret + '</code>' +
    '</div>' +
    '<div class="form-group" style="margin-bottom:12px"><label>Code aus der App bestätigen</label>' +
      '<input type="text" id="totp-profil-code" inputmode="numeric" maxlength="9" placeholder="000 000"' +
        ' style="letter-spacing:4px;font-size:22px;text-align:center;font-weight:700"' +
        ' onkeydown="if(event.key===\'Enter\')doTotpSetupInProfile()"/>' +
    '</div>' +
    '<div id="totp-profil-err" style="display:none;background:#fde8e8;color:#cc0000;padding:8px 12px;border-radius:7px;font-size:13px;font-weight:600;margin-bottom:12px"></div>' +
    '<div class="modal-actions">' +
      '<button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button>' +
      '<button class="btn btn-primary" onclick="doTotpSetupInProfile()">Aktivieren</button>' +
    '</div>'
  , false, true);
  setTimeout(function() { var el = document.getElementById('totp-profil-code'); if (el) el.focus(); }, 100);
}

async function doTotpSetupInProfile() {
  var code  = (document.getElementById('totp-profil-code').value || '').replace(/\s+/g, '');
  var errEl = document.getElementById('totp-profil-err');
  errEl.style.display = 'none';
  if (!code) { errEl.textContent = 'Bitte Code eingeben.'; errEl.style.display = 'block'; return; }
  var r = await apiPost('auth/totp-setup', { code: code });
  if (r && r.ok) {
    closeModal();
    if (currentUser) currentUser.totp_aktiv = true;
    notify('✅ TOTP aktiviert!', 'ok');
    if (r.data && r.data.backup_codes) showBackupCodes(r.data.backup_codes);
  } else {
    errEl.textContent = '❌ ' + ((r && r.fehler) || 'Ungültiger Code.');
    errEl.style.display = 'block';
    document.getElementById('totp-profil-code').value = '';
    document.getElementById('totp-profil-code').focus();
  }
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
      if (avatarEl) _renderHeaderAvatar(avatarEl, currentUser.avatar + '?v=' + Date.now(), currentUser.name||'?', true);
      // reload konto page
if(state.tab==='konto')_renderKontoPage();
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
      if (avatarEl) _renderHeaderAvatar(avatarEl, null, currentUser.name||'?', false);
      // reload konto page
if(state.tab==='konto')_renderKontoPage();
    } else { notify(data.fehler || 'Fehler.', 'err'); }
  } catch(e) { notify('Fehler.', 'err'); }
}

function kontoNewPwCheck() {
  var pw   = document.getElementById('pw-neu') ? document.getElementById('pw-neu').value : '';
  var wrap = document.getElementById('konto-pw-strength');
  var bar  = document.getElementById('konto-pw-bar');
  var grps = document.getElementById('konto-pw-groups');
  if (!wrap) return;
  if (!pw) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'block';
  var s = _pwScore(pw);
  var fullyOk = s.lengthOk && s.groups >= 3;
  var pct   = Math.min((pw.length / 12) * 60 + (s.groups / 4) * 40, 100);
  var color = fullyOk ? '#16a34a' : s.groups >= 3 ? '#eab308' : s.groups >= 2 ? '#f97316' : '#ef4444';
  bar.style.width = pct + '%';
  bar.style.background = color;
  var labels = [
    { key: /[A-Z]/, label: 'Großbuchstaben' },
    { key: /[a-z]/, label: 'Kleinbuchstaben' },
    { key: /[0-9]/, label: 'Zahlen' },
    { key: /[^A-Za-z0-9]/, label: 'Sonderzeichen' },
  ];
  var html = '';
  for (var i = 0; i < labels.length; i++) {
    var ok = labels[i].key.test(pw);
    html += '<span class="pw-group ' + (ok ? 'ok' : 'missing') + '">' + (ok ? '✓' : '○') + ' ' + labels[i].label + '</span>';
  }
  var lenOk = pw.length >= 12;
  html += '<span class="pw-group ' + (lenOk ? 'ok' : 'missing') + '">' + (lenOk ? '✓' : '○') + ' 12+ Zeichen (' + pw.length + ')</span>';
  grps.innerHTML = html;
}

function showKontoLoeschenDialog() {
  showModal(
    '<h2 style="color:#cc0000">&#x26A0;&#xFE0E; Konto löschen <button class="modal-close" onclick="closeModal()">&#x2715;</button></h2>' +
    '<p style="font-size:13px;color:var(--text2);margin:0 0 16px">Das Benutzerkonto wird vom Athletenprofil getrennt und gelöscht.<br>' +
    'Das Athletenprofil bleibt erhalten. Innerhalb von <strong>30 Tagen</strong> kann das Konto wiederhergestellt werden.</p>' +
    '<div class="form-group" style="margin-bottom:16px">' +
      '<label style="font-weight:600">Bitte tippe <strong style="font-family:monospace;background:var(--surf2);padding:1px 6px;border-radius:4px">KONTO LÖSCHEN</strong> ein um fortzufahren:</label>' +
      '<input type="text" id="kl-bestaetigung" placeholder="KONTO LÖSCHEN" style="margin-top:6px;font-family:monospace"/>' +
    '</div>' +
    '<div id="kl-err" style="color:#cc0000;font-size:13px;min-height:18px;margin-bottom:8px"></div>' +
    '<div class="modal-actions">' +
      '<button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button>' +
      '<button class="btn btn-ghost btn-sm" style="color:#cc0000;border-color:#cc0000" onclick="doKontoLoeschen()">Unwiderruflich löschen</button>' +
    '</div>'
  );
}

async function doKontoLoeschen() {
  var input = (document.getElementById('kl-bestaetigung') ? document.getElementById('kl-bestaetigung').value.trim() : '');
  var errEl = document.getElementById('kl-err');
  if (input !== 'KONTO LÖSCHEN') {
    if (errEl) errEl.textContent = 'Bitte genau "KONTO LÖSCHEN" eingeben.';
    return;
  }
  var r = await apiDel('auth/konto');
  if (r && r.ok) {
    closeModal();
    notify('Konto gelöscht. Du wirst abgemeldet.', 'ok');
    setTimeout(function() { currentUser = null; showApp(); }, 1500);
  } else {
    if (errEl) errEl.textContent = '❌ ' + ((r && r.fehler) || 'Fehler beim Löschen.');
  }
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
  if (!alt || !neu || !neu2) { showMsg('Bitte alle Felder ausfüllen.', false); return; }
  if (neu.length < 12) { showMsg('Neues Passwort muss mindestens 12 Zeichen haben.', false); return; }
  var _score = _pwScore(neu);
  if (_score.groups < 3) { showMsg('Passwort muss mindestens 3 von 4 Zeichengruppen enthalten (Großbuchstaben, Kleinbuchstaben, Zahlen, Sonderzeichen).', false); return; }
  if (neu !== neu2) { showMsg('Neue Passwörter stimmen nicht überein.', false); return; }
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
  var hasPasskey = currentUser && currentUser.has_passkey;
  if (!hasPasskey) {
    notify('⚠︎ Kein Passkey registriert – bitte zuerst einen Passkey hinzufügen.', 'err');
    return;
  }
  if (!confirm('TOTP deaktivieren? Du kannst dich weiterhin per Passkey anmelden.')) return;
  var r = await apiDel('auth/totp-setup');
  if (r && r.ok) {
    currentUser.totp_aktiv = false;
    closeModal();
    notify('✅ TOTP deaktiviert. Ab jetzt nur noch Passkey als 2FA.', 'ok');
  } else if (r && r.status === 409) {
    notify('⚠︎ Passkey nicht in DB gefunden. Passkey neu hinzufügen und erneut versuchen.', 'err');
  } else {
    notify('Fehler: ' + ((r && r.fehler) || 'Unbekannt'), 'err');
  }
}

function rolleLabel(r, oeffentlichOnly) {
  var m = { admin: 'Administrator', editor: 'Editor', athlet: 'Athlet', leser: 'Leser' };
  if (window._rollenMap) {
    var rd = window._rollenMap[r];
    if (rd) {
      if (oeffentlichOnly && !rd.oeffentlich) return r;
      // rd.label kann null sein (wenn nicht konfiguriert) -> auf Fallback-Map zugreifen
      return rd.label || m[r] || r;
    }
  }
  return m[r] || r;
}

function _renderHeaderAvatar(el, avatarPfad, name, isOnline) {
  if (!el) return;
  el.style.overflow = 'visible';
  el.style.position = 'relative';
  var dotHtml = isOnline ? _avatarDot('online', 28) : '';
  if (avatarPfad) {
    el.innerHTML = '<img src="' + avatarPfad + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.style.display=\'none\'">' + dotHtml;
  } else {
    // VN-Schema: Vorname[0] + Nachname[0] wenn beide auf currentUser vorhanden
    var initials = (currentUser && currentUser.vorname && currentUser.nachname)
      ? (currentUser.vorname.trim()[0] + currentUser.nachname.trim()[0]).toUpperCase()
      : nameInitials(name || '?');
    el.innerHTML = '<span style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-family:Barlow Condensed,sans-serif;font-weight:700;font-size:13px">' + initials + '</span>' + dotHtml;
  }
}

// ── NAVIGATION ─────────────────────────────────────────────

// ── Veranstaltung teilen ────────────────────────────────────────────────────

function _veranstFormatResult(e) {
  var res = e.resultat || '';
  // Strip leading zeros: 00:18:26 -> 18:26
  res = res.replace(/^0+:?/, '').replace(/^:/, '');
  return res;
}

function _veranstMarkdown(v) {
  var url  = location.origin + location.pathname + '#veranstaltung/' + v.id;
  var date = v.datum ? v.datum.split('-').reverse().join('.') : v.kuerzel?.split(' ')[0] || '';
  var header = '## ' + (v.name || v.kuerzel) + '\n';
  header += '\u{1F4CD} ' + date + (v.ort ? ' \u00b7 ' + v.ort : '') + '\n\n';

  // Group by disziplin
  var ergs = v.ergebnisse || [];
  var byDisz = {}, diszOrder = [];
  ergs.forEach(function(e) {
    var d = e.disziplin || '?';
    if (!byDisz[d]) { byDisz[d] = []; diszOrder.push(d); }
    byDisz[d].push(e);
  });

  var body = '';
  diszOrder.forEach(function(disz) {
    body += '### ' + disz + '\n';
    body += '| Athlet | AK | Zeit | Platz AK |\n';
    body += '|--------|----|----- |---------|\n';
    byDisz[disz].forEach(function(e) {
      var name = (e.athlet || '').split(', ').reverse().join(' ');
      body += '| ' + name + ' | ' + (e.altersklasse || '') + ' | ' + _veranstFormatResult(e) + ' | ' + (e.ak_platzierung || '') + ' |\n';
    });
    body += '\n';
  });

  return header + body + '\u{1F517} ' + url;
}

async function shareVeranstaltung(vid) {
  // Load veranstaltung data
  var r = await apiGet('veranstaltungen?limit=1&offset=0&id=' + vid);
  // veranstaltungen endpoint doesn't filter by id - find from list or use inline data
  // Try to get from current rendered data
  var v = null;
  // Search in the page's rendered veranst cards
  if (window._lastVeranstList) {
    v = window._lastVeranstList.find(function(x) { return x.id == vid; });
  }
  if (!v) {
    // Fallback: load fresh
    var r2 = await apiGet('veranstaltungen?limit=200&offset=0');
    if (r2 && r2.ok) {
      window._lastVeranstList = r2.data.veranst || [];
      v = window._lastVeranstList.find(function(x) { return x.id == vid; });
    }
  }
  if (!v) { notify('Veranstaltung nicht gefunden.', 'err'); return; }

  var url  = location.origin + location.pathname + '#veranstaltung/' + vid;
  var md   = _veranstMarkdown(v);
  var date = v.datum ? v.datum.split('-').reverse().join('.') : '';

  showModal(
    '<h2 style="margin-bottom:16px">\u{1F517} Veranstaltung teilen' +
    ' <button class="modal-close" onclick="closeModal()">&#x2715;</button></h2>' +

    '<div style="margin-bottom:16px">' +
      '<div style="font-size:12px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Direktlink</div>' +
      '<div style="display:flex;gap:8px;align-items:center">' +
        '<input type="text" id="share-url-input" value="' + url.replace(/"/g,'&quot;') + '"' +
          ' readonly style="flex:1;padding:8px 10px;border:1.5px solid var(--border);border-radius:7px;' +
          'background:var(--surf2);color:var(--text);font-size:13px;font-family:monospace"/>' +
        '<button class="btn btn-primary btn-sm" onclick="' +
          'navigator.clipboard.writeText(document.getElementById(\'share-url-input\').value).then(function(){' +
          'var b=this;b.textContent=\'\\u2705 Kopiert!\';setTimeout(function(){b.textContent=\'Kopieren\'},2000)}.bind(this))"' +
          '>Kopieren</button>' +
      '</div>' +
    '</div>' +

    '<div>' +
      '<div style="font-size:12px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Markdown</div>' +
      '<textarea id="share-md-area" readonly style="width:100%;height:240px;box-sizing:border-box;padding:10px 12px;' +
        'border:1.5px solid var(--border);border-radius:7px;background:var(--surf2);color:var(--text);' +
        'font-size:12px;font-family:monospace;resize:vertical;line-height:1.5">' +
        md.replace(/</g,'&lt;').replace(/>/g,'&gt;') +
      '</textarea>' +
      '<div style="display:flex;gap:8px;margin-top:8px;justify-content:flex-end">' +
        '<button class="btn btn-ghost btn-sm" onclick="' +
          'navigator.clipboard.writeText(document.getElementById(\'share-md-area\').value).then(function(){' +
          'var b=this;b.textContent=\'\\u2705 Kopiert!\';setTimeout(function(){b.textContent=\'Markdown kopieren\'},2000)}.bind(this))"' +
          '>Markdown kopieren</button>' +
        '<button class="btn btn-primary btn-sm" onclick="closeModal();window.open(location.origin+location.pathname+\'#veranstaltung/' + vid + '\',\'_blank\')">Seite \u00f6ffnen &#x2192;</button>' +
      '</div>' +
    '</div>'
  , false, true);
}

// ── Einzelseite: Veranstaltung ──────────────────────────────────────────────

async function renderVeranstaltungDetail(vid) {
  var el = document.getElementById('main-content');
  el.innerHTML = '<div class="loading"><div class="spinner"></div>Laden&hellip;</div>';

  var r = await apiGet('veranstaltungen?limit=200&offset=0');
  if (!r || !r.ok) {
    el.innerHTML = '<div class="panel" style="padding:32px;text-align:center;color:var(--accent)">Fehler beim Laden.</div>';
    return;
  }
  window._lastVeranstList = r.data.veranst || [];
  state._veranstMap = {};
  for (var ci = 0; ci < window._lastVeranstList.length; ci++) state._veranstMap[window._lastVeranstList[ci].id] = window._lastVeranstList[ci];
  var v = window._lastVeranstList.find(function(x) { return x.id == vid; });
  if (!v) {
    el.innerHTML = '<div class="panel" style="padding:32px;text-align:center">Veranstaltung nicht gefunden.</div>';
    return;
  }

  var name = v.name || (v.kuerzel || '').split(' ').slice(1).join(' ') || v.kuerzel || '';
  var ergs = v.ergebnisse || [];

  // Group by discipline – same logic as renderVeranstaltungen
  var byDisz = {}, diszOrder = [];
  for (var ei = 0; ei < ergs.length; ei++) {
    var e = ergs[ei];
    var _dk = ergDiszKey(e);
    if (!byDisz[_dk]) { byDisz[_dk] = []; diszOrder.push(_dk); }
    byDisz[_dk].push(e);
  }
  var _hasMstr = ergs.some(function(e3){ return !!e3.meisterschaft; });
  var _colspan = _hasMstr ? '7' : '5';
  sortDisziplinen(diszOrder);

  var rows = '';
  for (var di = 0; di < diszOrder.length; di++) {
    var _dKey = diszOrder[di];
    var _diszFirstErg = byDisz[_dKey][0];
    var disz = _diszFirstErg ? ergDiszLabel(_diszFirstErg) : _dKey;
    var dErgs = byDisz[_dKey];
    rows += '<tr class="disz-header-row"><td colspan="' + _colspan + '" class="disziplin-text" style="background:var(--surf2);font-weight:600;padding:6px 12px">' + disz + '</td></tr>';
    for (var ei2 = 0; ei2 < dErgs.length; ei2++) {
      var e2 = dErgs[ei2];
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
          '<td>' + medalBadge(e2.ak_platzierung) + '</td>' +
          (_hasMstr ? '<td>' + mstrBadge(e2.meisterschaft) + '</td>' : '') +
          (_hasMstr ? '<td class="ort-text" style="font-size:12px">' + (e2.meisterschaft && e2.ak_platz_meisterschaft ? medalBadge(e2.ak_platz_meisterschaft) : '') + '</td>' : '') +
        '</tr>';
    }
  }

  el.innerHTML =
    '<div class="panel" style="margin-bottom:0">' +
      '<div class="panel-header">' +
        '<div>' +
          '<div class="panel-title">' + name + '</div>' +
          '<div style="font-size:12px;color:var(--text2);margin-top:2px">' + formatDate(v.datum) + (v.ort ? ' &middot; ' + v.ort : '') + '</div>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:10px">' +
          '<span style="font-size:13px;color:var(--text2)">' + v.anz_ergebnisse + ' Ergebnisse &middot; ' + v.anz_athleten + ' Athleten</span>' +
          (currentUser && (currentUser.rolle === 'admin' || currentUser.rolle === 'editor') ?
            '<button class="btn btn-ghost btn-sm" onclick="showVeranstEditModal(' + v.id + ')">&#x270F;&#xFE0F;</button>' : '') +
          (v.datenquelle ? '<a href="' + v.datenquelle.replace(/"/g,'&quot;') + '" target="_blank" class="btn btn-ghost btn-sm" title="Ergebnisquelle">\uD83C\uDF10</a>' : '') +
          '<button class="btn btn-ghost btn-sm" title="Teilen" onclick="shareVeranstaltung(' + v.id + ')">\uD83D\uDCE4</button>' +
          (_canVeranstaltungLoeschen() ?
            '<button class="btn btn-danger btn-sm" onclick="deleteVeranstaltung(' + v.id + ',\'' + name.replace(/'/g, "\\'") + '\')">&#x2715;</button>' : '') +
        '</div>' +
      '</div>' +
      (rows ? '<div class="table-scroll"><table class="veranst-dash-table"><colgroup><col class="vcol-athlet"><col class="vcol-ak"><col class="vcol-result"><col class="vcol-pace"><col class="vcol-platz">' + (_hasMstr ? '<col class="vcol-ms"><col class="vcol-ms-platz">' : '') + '</colgroup><thead><tr><th>Athlet*in</th><th>AK</th><th>Ergebnis</th><th>Pace</th><th>Pl. AK</th>' + (_hasMstr ? '<th>Meisterschaft</th><th>Pl. MS</th>' : '') + '</tr></thead><tbody>' + rows + '</tbody></table></div>' :
              '<div class="empty" style="padding:16px">Keine Ergebnisse</div>') +
    '</div>';
}

async function renderAdminVeranstFreigabe() {
  var el = document.getElementById('main-content');
  el.innerHTML = adminSubtabs() + '<div class="loading"><div class="spinner"></div>Lade ausstehende Veranstaltungen\u2026</div>';

  var r = await apiGet('veranstaltungen?pending=1');
  if (!r || !r.ok) { el.innerHTML = adminSubtabs() + '<div style="color:var(--accent);padding:20px">Fehler beim Laden.</div>'; return; }
  var pending = r.data.pending || [];

  var html = adminSubtabs();
  html += '<div class="panel" style="padding:24px">';
  html += '<h2 style="margin:0 0 6px;font-size:18px">\uD83D\uDCCB Veranstaltungen freigeben</h2>';
  html += '<p style="color:var(--text2);font-size:13px;margin:0 0 20px">Veranstaltungen mit <code>genehmigt=0</code> erscheinen nicht unter \u201eVeranstaltungen\u201c. Diese entstehen z.B. wenn Athleten Ergebnisse selbst eintragen oder ein Freigabe-Workflow aktiv ist.</p>';

  if (!pending.length) {
    html += '<div style="text-align:center;padding:32px;color:var(--text2)">\u2705 Keine ausstehenden Veranstaltungen.</div>';
  } else {
    html += '<table style="width:100%;border-collapse:collapse">';
    html += '<thead><tr style="border-bottom:2px solid var(--border)">';
    html += '<th style="text-align:left;padding:8px 12px;font-size:12px;color:var(--text2)">Veranstaltung</th>';
    html += '<th style="text-align:left;padding:8px 12px;font-size:12px;color:var(--text2)">Datum</th>';
    html += '<th style="text-align:left;padding:8px 12px;font-size:12px;color:var(--text2)">Ort</th>';
    html += '<th style="text-align:right;padding:8px 12px;font-size:12px;color:var(--text2)">Ergebnisse</th>';
    html += '<th style="padding:8px 12px"></th>';
    html += '</tr></thead><tbody>';

    pending.forEach(function(v) {
      var name = v.name || v.kuerzel;
      var date = v.datum ? v.datum.split('-').reverse().join('.') : '';
      html += '<tr style="border-bottom:1px solid var(--border)">';
      html += '<td style="padding:10px 12px;font-weight:600">' + name +
        (v.geloescht ? ' <span style="font-size:11px;color:var(--accent);font-weight:400">(gel\u00f6scht)</span>' : '') + '</td>';
      html += '<td style="padding:10px 12px;color:var(--text2)">' + date + '</td>';
      html += '<td style="padding:10px 12px;color:var(--text2)">' + (v.ort || '') + '</td>';
      html += '<td style="padding:10px 12px;text-align:right;color:var(--text2)">' + v.anz_ergebnisse + '</td>';
      html += '<td style="padding:10px 12px;text-align:right">';
      if (v.geloescht) {
        html += '<button class="btn btn-warning btn-sm" onclick="adminFreigebenVeranst(' + v.id + ',this,true)">\u21a9 Wiederherstellen</button>';
      } else {
        html += '<button class="btn btn-primary btn-sm" onclick="adminFreigebenVeranst(' + v.id + ',this,false)">Freigeben</button>';
      }
      html += '</td></tr>';
    });
    html += '</tbody></table>';
  }
  html += '</div>';
  el.innerHTML = html;
}

async function adminFreigebenVeranst(vid, btn, restore) {
  btn.disabled = true; btn.textContent = '\u23f3';
  var payload = restore ? { genehmigt: 1, restore: 1 } : { genehmigt: 1 };
  var r = await apiPut('veranstaltungen/' + vid, payload);
  if (r && r.ok) {
    var row = btn.closest('tr');
    if (row) {
      row.style.opacity = '0.4';
      btn.textContent = restore ? '\u2705 Wiederhergestellt' : '\u2705 Freigegeben';
      btn.className = 'btn btn-ghost btn-sm';
    }
    window._adminPendingFreigabe = Math.max(0, (window._adminPendingFreigabe||1) - 1);
    _ladeAntraegeBadge();
  } else {
    btn.disabled = false; btn.textContent = 'Freigeben';
    notify('Fehler beim Freigeben.', 'err');
  }
}

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
    if (url) {
      return '<a href="' + url + '" target="_blank" style="' + linkStyle + '">' + label + '</a>';
    }
    // Interne Route: navigate() aufrufen statt href (damit Hash-Routing greift)
    var route = internalRoute.replace(/^#\//, '');
    return '<a href="javascript:void(0)" onclick="navigate(\''+route+'\')"; style="' + linkStyle + '">' + label + '</a>';
  }
  var legalLine = footerLink(dsUrl,  '#/datenschutz', 'Datenschutz') + ' &nbsp;&middot;&nbsp; ' +
                  footerLink(nuUrl,  '#/nutzung',     'Nutzungsbedingungen') + ' &nbsp;&middot;&nbsp; ' +
                  footerLink(impUrl, '#/impressum',   'Impressum');
  el.innerHTML =
    '<div>Powered by <a href="' + ghUrl + '" target="_blank" style="' + linkStyle + '">Statistikportal</a> &copy; 2026 <a href="' + authorUrl + '" target="_blank" style="' + linkStyle + '">Daniel Weyers</a></div>' +
    '<div>' + legalLine + '</div>';
}

// Ist der aktuelle User berechtigt, personenbezogene Daten zu sehen?
function _canSeeAthletenDetails() {
  if (!currentUser) return false;
  if (currentUser.rolle === 'admin') return true;
  var rechte = currentUser.rechte || [];
  return rechte.indexOf('vollzugriff') >= 0 || rechte.indexOf('athleten_details') >= 0;
}
function _canEditAthleten() {
  if (!currentUser) return false;
  if (currentUser.rolle === 'admin') return true;
  var rechte = currentUser.rechte || [];
  return rechte.indexOf('vollzugriff') >= 0 || rechte.indexOf('athleten_editieren') >= 0;
}
function _canVeranstaltungLoeschen() {
  if (!currentUser) return false;
  if (currentUser.rolle === 'admin') return true;
  var r = currentUser.rechte || [];
  return r.indexOf('vollzugriff') >= 0 || r.indexOf('veranstaltung_loeschen') >= 0;
}

function _canSeeInaktiveAthleten() {
  if (!currentUser) return false;
  if (currentUser.rolle === 'admin') return true;
  var r = currentUser.rechte || [];
  return r.indexOf('vollzugriff') >= 0 || r.indexOf('inaktive_athleten_sehen') >= 0;
}

function _canBulkEintragen() {
  if (!currentUser) return false;
  if (currentUser.rolle === 'admin') return true;
  var r = currentUser.rechte || [];
  return r.indexOf('vollzugriff') >= 0 || r.indexOf('bulk_eintragen') >= 0;
}
function _canEigenesEintragen() {
  if (!currentUser) return false;
  if (currentUser.rolle === 'admin') return true;
  var r = currentUser.rechte || [];
  return r.indexOf('vollzugriff') >= 0 || r.indexOf('alle_ergebnisse') >= 0 || r.indexOf('eigene_ergebnisse') >= 0;
}

function _canSeePersoenlicheDaten() {
  if (!currentUser) return false;
  if (currentUser.rolle === 'admin') return true;
  // Rechte direkt aus currentUser.rechte (kommt von auth/me)
  var rechte = currentUser.rechte || [];
  return rechte.indexOf('vollzugriff') >= 0 || rechte.indexOf('personenbezogene_daten') >= 0;
}

function buildNav() {
  var tabs = [
    { id: 'dashboard',       icon: '📊️', label: 'Dashboard' },
    { id: 'rekorde',         icon: '🏆️', label: 'Bestleistungen' },
    { id: 'veranstaltungen', icon: '📍️', label: 'Veranstaltungen' },
    { id: 'ergebnisse',      icon: '📋️', label: 'Ergebnisse' },
    { id: 'athleten',        icon: '👤️', label: 'Athleten' },
  ];
  if (!currentUser) {
    var allowPD = _canSeePersoenlicheDaten();
    var visibleTabs = tabs.filter(function(t) {
      if (t.id === 'athleten' && !allowPD) return false;
      return t.id === 'dashboard' || t.id === 'rekorde' || (t.id === 'athleten' && allowPD);
    });
    _renderNavTabs(visibleTabs);
    return;
  }
  // Eingeloggte User: Athleten-Tab immer sichtbar
  if (currentUser.rolle === 'editor' || currentUser.rolle === 'admin' || currentUser.rolle === 'athlet')
    tabs.push({ id: 'eintragen', icon: '➕️', label: 'Eintragen' });
  if (currentUser.rolle === 'admin') {
    var _adminN = (window._adminPendingAntraege||0) + (window._adminPendingRegs||0) + (window._adminPendingFreigabe||0);
    var _adminLabel = 'Admin' + (_adminN > 0 ? ' <span style="background:var(--accent);color:#fff;border-radius:10px;padding:1px 5px;font-size:10px;font-weight:700;vertical-align:middle;line-height:1.4">' + _adminN + '</span>' : '');
    tabs.push({ id: 'admin', icon: '⚙️️', label: _adminLabel, rawLabel: true });
  }
  _renderNavTabs(tabs);
  if (currentUser && currentUser.rolle === 'admin') setTimeout(function(){ _ladeAntraegeBadge(); }, 150);
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
    mhtml += '<button onclick="mobileNavClose();navigate(\'konto\')">🔑 Konto / Passwort</button>';
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
  // veranstaltung/123 -> tab=veranstaltung, veranstaltungId=123
  if (tab.startsWith('veranstaltung/')) {
    state.veranstaltungId = parseInt(tab.split('/')[1]) || null;
    state.tab = 'veranstaltung';
    syncHash(); buildNav(); renderPage();
    return;
  }
  if (tab.startsWith('veranstaltung/')) {
    state.veranstaltungId = parseInt(tab.split('/')[1]) || null;
    state.tab = 'veranstaltung';
    syncHash(); buildNav(); renderPage();
    return;
  }
  state.tab    = tab;
  state.page   = 1;
  state.veranstPage = 1;
  state.veranstSuche = '';
  syncHash();
  // subTab nur für Tabs mit eigenen Sub-Tabs zurücksetzen
  if (tab === 'ergebnisse') state.subTab = 'strasse';
  else if (tab === 'eintragen') state.subTab = null; // wird in renderEintragen() permissionsbasiert gesetzt
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
  // Wartungsmodus: Nicht eingeloggte Besucher sehen Wartungsseite
  if (!currentUser && (appConfig.wartung_aktiv === '1' || appConfig.wartung_aktiv === 1)) {
    var el = document.getElementById('main-content');
    var msg = appConfig.wartung_nachricht || 'Das Portal befindet sich derzeit in Wartung. Bitte sp\u00e4ter erneut versuchen.';
    el.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:center;min-height:60vh;padding:24px">' +
        '<div class="panel" style="max-width:480px;width:100%;padding:48px 36px;text-align:center">' +
          '<div style="font-size:48px;margin-bottom:16px">&#x1F6E0;&#xFE0E;</div>' +
          '<div style="font-size:22px;font-weight:700;margin-bottom:12px">Wartungsmodus</div>' +
          '<div style="font-size:14px;color:var(--text2);line-height:1.6;margin-bottom:28px">' + msg + '</div>' +
          '<button class="btn btn-primary" onclick="showLogin()">&#x1F511; Als Administrator anmelden</button>' +
        '</div>' +
      '</div>';
    return;
  }
  // Anonyme User dürfen Dashboard und Bestleistungen sehen
  if (!currentUser && state.tab !== 'rekorde' && state.tab !== 'dashboard' && state.tab !== 'veranstaltung') {
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
    else if (state.tab === 'veranstaltung') { await renderVeranstaltungDetail(state.veranstaltungId); }
    else if (state.tab === 'veranstaltung') { await renderVeranstaltungDetail(state.veranstaltungId); }
    else if (state.tab === 'eintragen')  { renderEintragen(); }
    else if (state.tab === 'konto')       { _renderKontoPage(); }
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

// ── Hash-Routing ─────────────────────────────────────────────
function syncHash() {
  if (!history.replaceState) return;
  var hash = state.tab;
  if (state.tab === 'veranstaltung' && state.veranstaltungId) hash += '/' + state.veranstaltungId;
  else if (state.tab === 'admin' && state.adminTab) hash += '/' + state.adminTab;
  else if (state.tab === 'ergebnisse' && state.subTab) hash += '/' + state.subTab;
  else if (state.tab === 'rekorde'    && state.subTab) hash += '/' + state.subTab;
  else if (state.tab === 'eintragen'  && state.subTab) hash += '/' + state.subTab;
  history.replaceState(null, '', '#' + hash);
}

function restoreFromHash() {
  var hash = window.location.hash.replace('#', '');
  if (!hash) return;
  var parts  = hash.split('/');
  var tab    = parts[0].toLowerCase();
  var sub    = parts[1] ? parts[1].toLowerCase() : '';
  var validTabs = ['dashboard','veranstaltungen','ergebnisse','athleten','rekorde','eintragen','admin','konto','veranstaltung'];
  if (validTabs.indexOf(tab) < 0) return;

  state.tab = tab;

  if (tab === 'admin' && sub) {
    var validAdmin = ['benutzer','registrierungen','disziplinen','altersklassen',
                      'meisterschaften','darstellung','dashboard_cfg','antraege','papierkorb'];
    if (validAdmin.indexOf(sub) >= 0) state.adminTab = sub;
  } else if (tab === 'veranstaltung' && sub) {
    state.veranstaltungId = parseInt(sub) || null;
  } else if (tab === 'veranstaltung' && sub) {
    state.veranstaltungId = parseInt(sub) || null;
  } else if (tab === 'ergebnisse') {
    state.subTab = sub || 'strasse';
  } else if (tab === 'rekorde' && sub) {
    state.subTab = sub;
  } else if (tab === 'eintragen') {
    state.subTab = null;
    var validEint = ['bulk'];
    if (sub && validEint.indexOf(sub) >= 0) state.subTab = sub;
  }
}

// Browser Back/Forward
window.addEventListener('popstate', function() {
  restoreFromHash();
  renderPage();
});
