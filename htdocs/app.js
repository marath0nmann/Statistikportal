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
function diszMitKat(disziplin) {
  if ((appConfig.disziplin_kategorie_suffix || '1') !== '1') return disziplin;
  // Kategoriename aus state.disziplinen nachschlagen
  var list = state.disziplinen || [];
  for (var _i = 0; _i < list.length; _i++) {
    if (list[_i].disziplin === disziplin && list[_i].kategorie) {
      return disziplin + ' <span style="font-size:0.85em;opacity:0.6">(' + list[_i].kategorie + ')</span>';
    }
  }
  return disziplin;
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
    var diszLink = '<span class="athlet-link" style="color:var(--text);font-weight:600;cursor:pointer" data-rek-disz="' + rek.disziplin.replace(/"/g,'&quot;') + '" onclick="navigateToDisz(this.dataset.rekDisz)">' + diszMitKat(rek.disziplin) + '</span>';
    timelineHtml += '<div class="timeline-disz">' + diszLink + ' <span class="' + labelCls + '">' + lbl + '</span></div>';
    timelineHtml += '<div class="timeline-athlet">' + athLink + '</div>';
    timelineHtml += '<div class="timeline-result">' + res + vorherHtml + '</div>';
    timelineHtml += '</div></div>';
  }
  if (!timelineHtml) timelineHtml = '<div class="empty"><div class="empty-icon">&#x1F3C6;</div><div class="empty-text">Noch keine Bestleistungen erfasst</div></div>';

  // Letzte 5 Veranstaltungen
  var veranstHtml = '';
  var rv = await apiGet('veranstaltungen?limit=5&offset=0');
  var veranst = (rv && rv.ok && rv.data.veranst) ? rv.data.veranst : [];
  for (var vi = 0; vi < veranst.length; vi++) {
    var v = veranst[vi];
    var vname = v.name || (v.kuerzel || '').split(' ').slice(1).join(' ') || v.kuerzel || '';
    var vrows = '';
    var byDisz = {}; var diszOrder = [];
    for (var ei = 0; ei < v.ergebnisse.length; ei++) {
      var e = v.ergebnisse[ei];
      if (!byDisz[e.disziplin]) { byDisz[e.disziplin] = []; diszOrder.push(e.disziplin); }
      byDisz[e.disziplin].push(e);
    }
    for (var di = 0; di < diszOrder.length; di++) {
      var disz = diszOrder[di];
      var ergs = byDisz[disz];
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
          var fDiszLink = '<span class="athlet-link" style="color:var(--text);font-weight:600;cursor:pointer" data-rek-disz="' + fItem.disziplin.replace(/"/g,'&quot;') + '" onclick="navigateToDisz(this.dataset.rekDisz)">' + diszMitKat(fItem.disziplin) + '</span>';
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
        var avatarSize = 64;
        var hAvatar = ha.avatar
          ? '<img src="' + ha.avatar + '" style="width:' + avatarSize + 'px;height:' + avatarSize + 'px;border-radius:50%;object-fit:cover;">'
          : '<div style="width:' + avatarSize + 'px;height:' + avatarSize + 'px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--accent));color:var(--on-primary);display:flex;align-items:center;justify-content:center;font-family:Barlow Condensed,sans-serif;font-size:24px;font-weight:700;">' + nameInitials(ha.name||'?') + '</div>';

        var groupMap = {}, groupOrder = [];
        var diszKeys = Object.keys(ha.disziplinen);
        for (var hdi = 0; hdi < diszKeys.length; hdi++) {
          var hd = diszKeys[hdi];
          var htitels = ha.disziplinen[hd];
          var gesamt  = htitels.filter(function(t){ return t.label === 'Gesamtbestleistung'; });
          var maenner = htitels.filter(function(t){ return t.label === 'Bestleistung Männer'; });
          var frauen  = htitels.filter(function(t){ return t.label === 'Bestleistung Frauen'; });
          var mhk     = htitels.filter(function(t){ return t.label === 'Bestleistung MHK'; });
          var whk     = htitels.filter(function(t){ return t.label === 'Bestleistung WHK'; });
          var akM     = htitels.filter(function(t){ return /^Bestleistung M\d/.test(t.label); });
          var akW     = htitels.filter(function(t){ return /^Bestleistung W\d/.test(t.label); });
          var akMNums = akM.map(function(t){ return t.label.replace('Bestleistung ',''); });
          var akWNums = akW.map(function(t){ return t.label.replace('Bestleistung ',''); });
          var parts = [];
          if (gesamt.length) parts.push('Gesamtbestleistung');
          var mParts = [];
          if (maenner.length || mhk.length) mParts.push('Männer');
          if (akMNums.length) mParts = mParts.concat(akMNums);
          if (mParts.length) { var mStr = mParts.length===1?mParts[0]:mParts.slice(0,-1).join(', ')+' und '+mParts[mParts.length-1]; parts.push('Bestleistung '+mStr); }
          var wParts = [];
          if (frauen.length || whk.length) wParts.push('Frauen');
          if (akWNums.length) wParts = wParts.concat(akWNums);
          if (wParts.length) { var wStr = wParts.length===1?wParts[0]:wParts.slice(0,-1).join(', ')+' und '+wParts[wParts.length-1]; parts.push('Bestleistung '+wStr); }
          var sentence  = parts.join(' \u00b7 ');
          var lineClass = gesamt.length ? 'badge badge-gold' : 'badge badge-silver';
          if (!groupMap[sentence]) { groupMap[sentence] = { lineClass: lineClass, disz: [] }; groupOrder.push(sentence); }
          groupMap[sentence].disz.push(hd);
        }

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
          '<div style="text-align:center;padding:20px 16px;'+(hi<displayData.length-1?'border-bottom:1px solid var(--border);':'')+'">'+
            hRankHtml+
            '<div style="display:flex;justify-content:center;margin-bottom:10px">'+hAvatar+'</div>'+
            '<div style="font-weight:700;font-size:15px;margin-bottom:2px">'+
              '<span class="athlet-link" onclick="openAthletById('+ha.id+')">'+ha.name+'</span>'+
            '</div>'+
            '<div style="font-size:12px;color:var(--text2);margin-bottom:10px">'+ha.titelCount+' Titel</div>'+
            '<div style="display:flex;flex-wrap:wrap;justify-content:center;gap:2px">'+hBadgesHtml+'</div>'+
          '</div>';
      }
