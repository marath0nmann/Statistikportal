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
    document.getElementById('user-avatar').textContent     = name[0].toUpperCase();
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
      '<div class="profile-avatar" style="width:64px;height:64px;font-size:24px;margin:0 auto 12px">' + name[0].toUpperCase() + '</div>' +
      '<div style="font-size:18px;font-weight:600">' + name + '</div>' +
      '<div style="color:var(--text2);font-size:13px;margin-top:4px">' + rolleLabel(currentUser.rolle) + '</div>' +
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

function navigate(tab) {
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
  if (r && r.ok) state.athleten = r.data;
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
  var timelineLimit = ds.timelineLimit || 20;
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
    var labelCls = rek.extern ? 'badge badge-blue' :
                   (lbl.indexOf('Gesamtbestleistung') >= 0 || lbl.indexOf('Erste Gesamtleistung') >= 0) ? 'badge badge-gold' :
                   (lbl.indexOf('nner') >= 0 || lbl.indexOf('Frauen') >= 0) ? 'badge badge-blue' : 'badge badge-ak';
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
    var diszLink = '<span class="athlet-link" style="color:var(--text);font-weight:600;cursor:pointer" data-rek-disz="' + rek.disziplin.replace(/"/g,'&quot;') + '" onclick="navigateToDisz(this.dataset.rekDisz)">' + rek.disziplin + '</span>';
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
      vrows += '<tr class="disz-header-row"><td colspan="6" class="disziplin-text" style="background:var(--surf2);font-weight:600;padding:6px 12px">' + disz + '</td></tr>';
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

  // ── Layout aus Config rendern ──
  var layout = [];
  try { layout = JSON.parse(appConfig.dashboard_layout || ''); } catch(e) {}
  if (!layout || !layout.length) {
    layout = [
      { cols: [{ widget: 'stat-ergebnisse' }, { widget: 'stat-athleten' }, { widget: 'stat-rekorde' }] },
      { cols: [{ widget: 'timeline', w: 340 }, { widget: 'veranstaltungen' }] }
    ];
  }

  function renderWidget(wcfg) {
    var w = wcfg.widget;
    if (w === 'stat-ergebnisse') {
      return statCard(statErgebnisse, '&#x1F3C3;', 'Ergebnisse gesamt');
    }
    if (w === 'stat-athleten') {
      return statCard(statAthleten, '&#x1F465;', 'Athleten');
    }
    if (w === 'stat-rekorde') {
      return statCard(statRekorde, '&#x1F3C6;', 'Vereinsrekorde');
    }
    if (w === 'timeline') {
      return '<div class="panel" style="height:100%">' +
        '<div class="panel-header"><div class="panel-title">&#x1F3C6; Neueste Bestleistungen</div></div>' +
        '<div class="timeline">' + timelineHtml + '</div>' +
      '</div>';
    }
    if (w === 'veranstaltungen') {
      return '<div class="panel" style="height:100%">' +
        '<div class="panel-header"><div class="panel-title">&#x1F4CD; Letzte Veranstaltungen</div></div>' +
        veranstHtml +
      '</div>';
    }
    return '';
  }

  var layoutHtml = '';
  for (var ri = 0; ri < layout.length; ri++) {
    var row = layout[ri];
    var cols = row.cols || [];
    if (!cols.length) continue;
    if (cols.length === 1) {
      layoutHtml += '<div style="margin-bottom:20px">' + renderWidget(cols[0]) + '</div>';
    } else {
      // Mehrspaltig: Breiten berechnen
      var colsHtml = '';
      var gtc = '';
      for (var ci = 0; ci < cols.length; ci++) {
        var col = cols[ci];
        gtc += (col.w ? col.w + 'px' : '1fr') + (ci < cols.length - 1 ? ' ' : '');
        colsHtml += '<div>' + renderWidget(col) + '</div>';
      }
      layoutHtml += '<div style="display:grid;grid-template-columns:' + gtc + ';gap:20px;margin-bottom:20px">' + colsHtml + '</div>';
    }
  }

  document.getElementById('main-content').innerHTML = layoutHtml;
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
async function loadErgebnisseData() {
  var params = 'limit=' + state.limit + '&offset=' + ((state.page - 1) * state.limit);
  if (state.diszFilter) params += '&disziplin=' + encodeURIComponent(state.diszFilter);
  for (var k in state.filters) {
    if (state.filters[k]) params += '&' + k + '=' + encodeURIComponent(state.filters[k]);
  }
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
    diszOptHtml += '<option value="' + disziplinen[i] + '"' + (state.filters.disziplin === disziplinen[i] ? ' selected' : '') + '>' + disziplinen[i] + '</option>';
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
      '<div class="fg"><label>Kategorie</label><select onchange="setFilter(\'kategorie\',this.value)">' + katOptHtml + '</select></div>' +
      '<div class="fg"><label>Disziplin</label><select onchange="setFilter(\'disziplin\',this.value)">' + diszOptHtml + '</select></div>' +
      '<div class="fg"><label>Altersklasse</label><select onchange="setFilter(\'ak\',this.value)">' + akOptHtml + '</select></div>' +
      '<div class="fg"><label>Jahr</label><select onchange="setFilter(\'jahr\',this.value)">' + jahrOptHtml + '</select></div>' +
      '<div class="fg"><label>Nur Meisterschaften</label><select onchange="setFilter(\'meisterschaft\',this.value)"><option value="">Alle</option><option value="1"' + (state.filters.meisterschaft ? ' selected' : '') + '>Nur Meisterschaften</option></select></div>' +
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
          editBtn.dataset.editFmt
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

  var thead = '<tr>';
  for (var i = 0; i < headers.length; i++) thead += '<th>' + headers[i] + '</th>';
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
      '<td class="disziplin-text">' + rr.disziplin + '</td>' +
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
          '<button class="btn btn-ghost btn-sm" style="margin-right:4px" data-edit-id="' + rr.id + '" data-edit-tab="' + subTab + '" data-edit-disz="' + (rr.disziplin||'') + '" data-edit-res="' + (rr.resultat||'') + '" data-edit-ak="' + (rr.altersklasse||'') + '" data-edit-akp="' + (rr.ak_platzierung||'') + '" data-edit-mstr="' + (rr.meisterschaft||'') + '" data-edit-fmt="' + (rr.fmt||'') + '">&#x270E;</button>' +
          '<button class="btn btn-danger btn-sm" data-del-id="' + rr.id + '" data-del-tab="' + subTab + '">&#x2715;</button>' +
        '</td>';
    }
    tbody += '<tr' + (rr.meisterschaft ? ' class="champ-row"' : '') + '>' + cells + '</tr>';
  }
  return '<table id="ergebnisse-table"><thead>' + thead + '</thead><tbody>' + tbody + '</tbody></table>';
}

function openEditErgebnis(id, subTab, disz, res, ak, akp, mstr, fmt) {
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

  var html =
    '<h3 style="margin:0 0 20px;font-size:17px">Ergebnis bearbeiten</h3>' +
    '<div class="form-grid">' +
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
  var body = { disziplin: disz, resultat: res, altersklasse: ak, pace: calcPace(disz, res) };
  if (akp)  body.ak_platzierung = parseInt(akp);
  if (mstr) body.meisterschaft = parseInt(mstr);
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
async function renderAthleten() {
  var s = state.filters.suche || '';
  var aktGruppe = state.filters.gruppe || '';
  var rA = await apiGet(s ? 'athleten?suche=' + encodeURIComponent(s) : 'athleten');
  var rG = await apiGet('gruppen');
  if (!rA || !rA.ok) return;
  var alleAthleten = rA.data;
  var alleGruppen = (rG && rG.ok) ? rG.data : [];
  var canEdit = currentUser.rolle === 'admin' || currentUser.rolle === 'editor';

  // Gruppen-Filter anwenden
  var athleten = alleAthleten;
  if (aktGruppe) {
    athleten = alleAthleten.filter(function(a) {
      var gs = a.gruppen || [];
      for (var gi = 0; gi < gs.length; gi++) { if (gs[gi].name === aktGruppe) return true; }
      return false;
    });
  }

  var rows = '';
  state._athletenMap = {};
  for (var i = 0; i < athleten.length; i++) {
    var a = athleten[i];
    state._athletenMap[a.id] = a;
    var canDel = currentUser && currentUser.rolle === 'admin' && parseInt(a.anz_ergebnisse) === 0;
    rows +=
      '<tr>' +
        '<td><span class="athlet-link" onclick="openAthletById(' + a.id + ')">' + a.nachname + '</span></td>' +
        '<td>' + (a.vorname || '') + '</td>' +
        '<td>' + akBadge(a.geschlecht) + '</td>' +
        '<td>' + renderGruppenInline(a.gruppen) + '</td>' +
        '<td><span class="badge badge-platz">' + a.anz_ergebnisse + '</span></td>' +
        '<td>' + (a.aktiv ? '<span class="badge badge-aktiv">Aktiv</span>' : '<span class="badge badge-inaktiv">Inaktiv</span>') + '</td>' +
        '<td style="white-space:nowrap">' +
          (canEdit ? '<button class="btn btn-ghost btn-sm" onclick="showAthletEditModal(' + a.id + ')">&#x270F;&#xFE0F;</button>' : '') +
          (canDel ? ' <button class="btn btn-danger btn-sm" onclick="deleteAthlet(' + a.id + ',\'' + (a.name_nv||'').replace(/'/g,"\\'") + '\')">&#x2715;</button>' : '') +
        '</td>' +
      '</tr>';
  }

  // Gruppen-Buttons
  var gruppenBtns = '<button class="rek-cat-btn' + (!aktGruppe ? ' active' : '') + '" onclick="state.filters.gruppe=\'\';renderAthleten()">Alle</button>';
  for (var gi = 0; gi < alleGruppen.length; gi++) {
    var g = alleGruppen[gi];
    gruppenBtns += '<button class="rek-cat-btn' + (aktGruppe === g.name ? ' active' : '') + '" onclick="state.filters.gruppe=\'' + g.name.replace(/'/g,"\\'") + '\';renderAthleten()">' + g.name + ' <span style="font-size:10px;opacity:.7">(' + g.anz_athleten + ')</span></button>';
  }

  document.getElementById('main-content').innerHTML =
    '<div class="rek-cat-tabs" style="margin-bottom:16px">' + gruppenBtns + '</div>' +
    '<div class="filter-bar">' +
      '<div class="fg"><label>Suche</label><input type="text" placeholder="Name suchen&hellip;" value="' + s + '" oninput="setFilter(\'suche\',this.value)" style="min-width:0;width:100%"/></div>' +
      (canEdit ? '<button class="btn btn-primary btn-sm" onclick="showNeuerAthletModal()">+ Neuer Athlet</button>' : '') +
    '</div>' +
    '<div class="panel">' +
      '<div class="panel-header"><div class="panel-title">&#x1F464; Alle Athleten</div><div class="panel-count">' + athleten.length + ' Athleten</div></div>' +
      '<div class="table-scroll"><table>' +
        '<thead><tr><th>Name</th><th>Vorname</th><th>Geschlecht</th><th>Gruppen</th><th>Ergebnisse</th><th>Status</th><th></th></tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table></div>' +
    '</div>';
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
  var s = (name || '').toLowerCase().trim();
  // Bekannte Namen -> feste Meterwerte
  var named = {
    'marathon': 42195, 'halbmarathon': 21098, 'halbmarathon straße': 21098,
    'marathon straße': 42195, 'ultramarathon': 80000,
    'dreisprung': -4, 'weitsprung': -3, 'hochsprung': -2, 'stabhochsprung': -1,
    'kugelstoß': -10, 'hammerwurf': -11, 'diskuswurf': -12, 'speerwurf': -13,
    'gewichtwurf': -14, 'ballwurf 200g': -15, 'schlagballwurf 80g': -16,
    'walking': 99000, '7km walking': 7000
  };
  for (var k in named) { if (s === k || s.indexOf(k) === 0) return named[k]; }
  // Zahl + km -> Meter
  var mKm = s.match(/^(\d+[.,]?\d*)\s*km/);
  if (mKm) return parseFloat(mKm[1].replace(',','.')) * 1000;
  // Zahl + m -> Meter
  var mM = s.match(/^(\d+[.,]?\d*)\s*m/);
  if (mM) return parseFloat(mM[1].replace(',','.'));
  return 999999;
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
    var d = ergs[i].disziplin || '?';
    if (!diszMap[d]) diszMap[d] = [];
    diszMap[d].push(ergs[i]);
  }
  var diszList = Object.keys(diszMap).sort(function(a, b) {
    var ka = _apDiszSortKey(a), kb = _apDiszSortKey(b);
    return ka !== kb ? ka - kb : a.localeCompare(b);
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
    var pb = _apBestOf(dErgs, fmt);
    var pbStr = pb ? _apFmtRes(pb, fmt) : '';
    var active2 = disz === _apState.selDisz ? 'background:var(--accent);color:#fff;border-color:var(--accent);' : 'background:var(--surface);color:var(--text);border-color:var(--border);';
    diszBtns += '<button style="' + active2 + 'border:1px solid;border-radius:10px;padding:6px 12px;font-size:11px;font-weight:600;cursor:pointer;margin:0 6px 6px 0;text-align:left;line-height:1.4" ' +
      'data-ap-disz="' + disz.replace(/"/g,'&quot;') + '">' +
      '<div>' + disz + '</div>' +
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
        '<div style="margin-top:4px"><span class="badge badge-ak">' + totalErg + ' Wettkämpfe</span></div>' +
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
      '<td style="padding:6px 8px">' + pb.disziplin + '</td>' +
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
  if (!rs.disz && topNames.length) rs.disz = topNames[0];
  else if (!rs.disz && diszList.length) rs.disz = diszList[0].disziplin || diszList[0];

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
    topHtml += '<button class="rek-top-btn' + (rs.disz === td ? ' active' : '') + '" data-disz="' + td.replace(/"/g, '&quot;') + '" onclick="setRekDisz(this.dataset.disz)">' +
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
      diszHtml += '<button class="rek-top-btn rek-top-btn--sm' + (rs.disz === dd ? ' active' : '') + '" data-disz="' + dd.replace(/"/g, '&quot;') + '" onclick="setRekDisz(this.dataset.disz)">' +
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
function setRekDisz(disz) {
  state.rekState.disz = disz;
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
          '<div class="form-group full"><label>Veranstaltungsname</label><input type="text" id="bk-evname" placeholder="z.B. D&uuml;sseldorf Marathon"/></div>' +
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
    bulkAddRow();
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
function bkDiszOpts() {
  var opts = '<option value="">– wählen –</option>';
  var list = state.disziplinen || [];
  for (var i = 0; i < list.length; i++) {
    var d = (typeof list[i] === 'object') ? list[i].disziplin : list[i];
    opts += '<option value="' + d + '">' + d + '</option>';
  }
  return opts;
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
    athOptHtml += '<option value="' + a.id + '" data-g="' + g + '">' + a.name_nv + '</option>';
  }
  return '<tr id="bkrow-' + idx + '" style="border-bottom:1px solid var(--border)">' +
    '<td style="padding:6px;color:var(--text2);font-size:12px">' + (idx+1) + '</td>' +
    '<td style="padding:4px 6px"><select class="bk-athlet" onchange="bkUpdateAK(this,' + idx + ')">' + athOptHtml + '</select></td>' +
    '<td style="padding:4px 6px"><select class="bk-disz">' + bkDiszOpts() + '</select></td>' +
    '<td style="padding:4px 6px"><input class="bk-res" type="text" placeholder="00:45:00"/></td>' +
    '<td style="padding:4px 6px"><select class="bk-ak" id="bk-ak-' + idx + '">' + bkAkOpts('') + '</select></td>' +
    '<td style="padding:4px 6px"><input class="bk-platz" type="number" placeholder="1" min="1"/></td>' +
    '<td style="padding:4px 6px"><button onclick="bulkRemoveRow(' + idx + ')" style="background:none;border:none;cursor:pointer;color:var(--text2);font-size:16px;padding:2px 4px" title="Zeile entfernen">&#x2715;</button></td>' +
  '</tr>';
}

var _bulkRowCount = 0;
function bkUpdateAK(athSel, idx) {
  var opt = athSel.options[athSel.selectedIndex];
  var g = opt ? (opt.dataset.g || '') : '';
  var akSel = document.getElementById('bk-ak-' + idx);
  if (!akSel) return;
  var prev = akSel.value;
  akSel.innerHTML = bkAkOpts(g);
  // vorherigen Wert wiederherstellen falls noch passt
  if (prev) { for (var i=0;i<akSel.options.length;i++) { if (akSel.options[i].value===prev) { akSel.value=prev; break; } } }
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
  try {
    var cfgResp = await fetch('https://my.raceresult.com/' + eventId + '/RRPublish/data/config?lang=de&page=results&noVisitor=1');
    if (!cfgResp.ok) throw new Error('HTTP ' + cfgResp.status + ' bei config');
    var cfgText = await cfgResp.text();
    var cfg;
    try { cfg = JSON.parse(cfgText); } catch(e) { throw new Error('Config kein JSON: ' + cfgText.slice(0, 200)); }
    if (!cfg || typeof cfg !== 'object') throw new Error('Config ungültig: ' + cfgText.slice(0, 200));

    var apiKey     = cfg.key || cfg.Key || cfg.apikey || cfg.APIKey || '';
    var eventName  = cfg.EventName || cfg.Name || '';
    var _cfgDateRaw = cfg.EventDate || cfg.Date || cfg.eventdate || cfg.StartDate || cfg.start_date || '';
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
      // Excel-Epoch (Tage seit 1899-12-30, kleine Ganzzahl < 100000)?
      } else if (/^\d{4,6}$/.test(_ds)) {
        var _excelDays = parseInt(_ds);
        var _excelEpoch = new Date(1899, 11, 30); // 1899-12-30
        var _excelDate = new Date(_excelEpoch.getTime() + _excelDays * 86400000);
        eventDate = _excelDate.toISOString().slice(0,10);
      }
    }
    var eventOrtCfg = cfg.City || cfg.city || cfg.Location || cfg.location || cfg.Place || cfg.place || cfg.Venue || cfg.venue || cfg.Ort || cfg.ort || '';
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

    // Contest=0 bedeutet: Liste gilt für alle Contests auf einmal → nur einen Request
    var contestIds = Object.keys(contestObj);
    if (!contestIds.length) contestIds = ['1'];
    if (listContest === '0') contestIds = ['0'];

    _rrDebug.cfgOrt = eventOrtCfg;
    _rrDebug.cfgKey = apiKey;
    _rrDebug.cfgDateRaw = _cfgDateRaw;
    _rrDebug.eventDate = eventDate;
    _rrDebug.cfgEventName = cfg.eventname || '';
    _rrDebug.contestSample = JSON.stringify(contestObj).slice(0, 150);
    _rrDebug.listName = listName;
    _rrDebug.listContest = listContest;

    // Spaltenindizes: bekannte Positionen aus dem echten DataFields-Format
    // ["BIB","ID","MitStatus([GesPlp])","AnzeigeName","YEAR","[GeschlechtMW]","[AGEGROUP1.NAMESHORT]","CLUB","Ziel.GUN","Ziel.CHIP"]
    var iName=5; var iClub=7; var iAK=4; var iZeit=8; var iNetto=8; var iPlatz=3;

    var base4 = 'https://my.raceresult.com/' + eventId + '/RRPublish/data/list';
    var hdrs  = { 'Origin': 'https://my.raceresult.com', 'Referer': 'https://my.raceresult.com/' };
    var allResults = [];
    var eventOrt = eventOrtCfg || "";

    for (var ci = 0; ci < contestIds.length; ci++) {
      var cid   = contestIds[ci];
      var cname = contestObj[cid] || ('Contest ' + cid);
      preview.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text2)">&#x23F3; ' + (ci+1) + '/' + contestIds.length + ': ' + cname + '&hellip;</div>';
      try {
        // term= mit Vereinsname befüllen → server-seitige Suche über alle Gruppen
        var urlSearch = base4 +
          '?key='      + apiKey +
          '&listname=' + encodeURIComponent(listName) +
          '&page=results&contest=' + cid +
          '&r=search&l=9999&term=' + encodeURIComponent(clubPhrase || '');
        var resp = await fetch(urlSearch, { headers: hdrs });
        if (!resp.ok) {
          if (!_rrDebug.errors) _rrDebug.errors = [];
          _rrDebug.errors.push('HTTP ' + resp.status + ' Contest ' + cid);
          if (!_rrDebug.firstVal) _rrDebug.firstVal = 'HTTP ' + resp.status + ' für Contest ' + cid + ' | URL: ' + urlSearch.slice(0,200);
          continue;
        }
        var rawText = await resp.text();
        _rrDebug.searchRaw = 'URL: ' + urlSearch.slice(-120) + ' | Raw: ' + rawText.slice(0, 500);
        var payload;
        try { payload = JSON.parse(rawText); } catch(pe) { _rrDebug.firstVal = 'JSON-Parse-Fehler: ' + pe.message + ' | Raw: ' + rawText.slice(0,300); continue; }

        // Top-Level Keys immer loggen
        _rrDebug.topKeys = Object.keys(payload);
        if (!_rrDebug.groupFilters) _rrDebug.groupFilters = JSON.stringify(payload.groupFilters || payload.GroupFilters || '').slice(0,400);

        // Hilfsfunktion: prüft ob payload Datenzeilen enthält
        function payloadHasRows(p) {
          var d = p.data || p.Data || p.result || p.Result || {};
          if (Array.isArray(d)) return d.length > 0;
          var ks = Object.keys(d);
          for (var i=0; i<ks.length; i++) {
            var v = d[ks[i]];
            if (Array.isArray(v) && v.length) return true;
            // Zwei Ebenen tief: {"#1_Contest": {"#1_Gruppe": [[...]]}}
            if (v && typeof v === 'object' && !Array.isArray(v)) {
              var ks2 = Object.keys(v);
              for (var j=0; j<ks2.length; j++) {
                if (Array.isArray(v[ks2[j]]) && v[ks2[j]].length) return true;
              }
            }
          }
          return false;
        }

        // Wenn r=search keine Daten liefert: r=all als Fallback
        if (!payloadHasRows(payload)) {
          var urlAll = base4 +
            '?key='      + apiKey +
            '&listname=' + encodeURIComponent(listName) +
            '&page=results&contest=' + cid +
            '&r=all&l=9999&splitSearch=0';
          var respAll = await fetch(urlAll, { headers: hdrs });
          if (respAll.ok) {
            var rawAll = await respAll.text();
            _rrDebug.firstVal = 'r=all raw: ' + rawAll.slice(0, 600);
            try {
              var payloadAll = JSON.parse(rawAll);
              _rrDebug.topKeys = Object.keys(payloadAll);
          _rrDebug.groupFilters = JSON.stringify(payloadAll.groupFilters || payloadAll.GroupFilters || '–').slice(0,400);
          // data-Schlüssel zeigen (Gruppen-Namen)
          var _dKeys = payloadAll.data ? Object.keys(payloadAll.data) : [];
          _rrDebug.dataKeys = JSON.stringify(_dKeys).slice(0,600);
          // Erste Gruppe: deren Unter-Keys zeigen
          if (_dKeys.length > 0) {
            var _firstGroup = payloadAll.data[_dKeys[0]];
            _rrDebug.firstGroupKeys = JSON.stringify(typeof _firstGroup === 'object' ? Object.keys(_firstGroup) : _firstGroup).slice(0,400);
          }
              if (payloadHasRows(payloadAll)) {
                payload = payloadAll;
                if (!_rrDebug.fetchMode) _rrDebug.fetchMode = 'r=all';
              } else {
                // Auch r=all hat keine Daten: data-Struktur zeigen
                if (!_rrDebug.fetchMode) _rrDebug.fetchMode = 'r=all (leer)';
                var dRaw = payloadAll.data || payloadAll.Data || {};
                _rrDebug.firstVal = 'r=all data-Key: ' + JSON.stringify(dRaw).slice(0, 800);
              }
            } catch(e) { _rrDebug.firstVal += ' | Parse-Fehler: ' + e.message; }
          }
        }

        // DataFields beim ersten Treffer kalibrieren
        if (payload.DataFields && payload.DataFields.length) {
          var df = payload.DataFields;
          if (!_rrDebug.dataFields.length) _rrDebug.dataFields = df.slice();
          iAK = -1; // Zurücksetzen — nur setzen wenn echtes AK-Feld gefunden
          for (var fi=0; fi<df.length; fi++) {
            var f = df[fi].toLowerCase();
            if (f.indexOf('anzeigename') >= 0 || f === 'name' || f === 'fullname') iName = fi;
            else if (f.indexOf('club') >= 0 || f.indexOf('verein') >= 0) iClub = fi;
            else if (f.indexOf('agegroup') >= 0 || f.indexOf('altersklasse') >= 0 || f === 'ak' || f === '[agegroup1.nameshort]') iAK = fi;
            else if (f.indexOf('flag') >= 0 || f.indexOf('nation') >= 0) { /* überspringen */ }
            else if (f.indexOf('chip') >= 0 || f.indexOf('netto') >= 0) iNetto = fi;
            else if (f.indexOf('gun') >= 0 || f.indexOf('brutto') >= 0) iZeit = fi;
            else if ((f.indexOf('plp') >= 0 && f.indexOf('ges') < 0) || f.indexOf('akplatz') >= 0 || f.indexOf('autorankp') >= 0 || f.indexOf('mitstatus') >= 0) iPlatz = fi;
          }
          if (iNetto >= 0 && iZeit < 0) iZeit = iNetto;
          _rrDebug.iClub = iClub; _rrDebug.iName = iName; _rrDebug.iPlatz = iPlatz;
        }

        // Eventname + Datum aus HeadLine der ersten erfolgreichen Antwort
        if (payload.list && (!eventName || !eventOrt)) {
          var hl = payload.list.HeadLine1 || payload.list.HeadLine2 || "";
          _rrDebug.headLine = hl;
          var dm = hl.match(/(\d{2})\.(\d{2})\.(\d{4})/);
          if (dm) {
            if (!eventDate) eventDate = dm[3] + "-" + dm[2] + "-" + dm[1];
            if (!eventName) {
              eventName = hl.replace(dm[0], "").trim();
              eventName = eventName.replace(/\s+(am|vom|bei|in|-)\s*$/i, "").trim();
            }
          } else {
            if (!eventName) eventName = hl;
          }
          // Letztes Wort des Eventnamens als Ort-Fallback
          if (!eventOrt && eventName) {
            var nameWords = eventName.split(/\s+/);
            eventOrt = nameWords[nameWords.length - 1].replace(/[^\wäöüÄÖÜß]/g, "").trim();
          }
        }
        // cfg.eventname als Fallback für eventName
        if (!eventName && cfg.eventname) eventName = cfg.eventname;


        // firstVal Fallback falls noch nicht gesetzt
        if (!_rrDebug.firstVal) _rrDebug.firstVal = JSON.stringify(payload).slice(0, 600);
        // Wenn DataFields fehlen: Name-Spalte heuristisch aus erster Datenzeile bestimmen
        if (!payload.DataFields || !payload.DataFields.length) {
          var dataObjTmp = payload.data || payload.Data || {};
          if (Array.isArray(dataObjTmp)) dataObjTmp = { '_': dataObjTmp };
          // Zwei-Ebenen flachmachen
          var flatTmp = {};
          Object.keys(dataObjTmp).forEach(function(k) {
            var v = dataObjTmp[k];
            if (Array.isArray(v)) flatTmp[k] = v;
            else if (v && typeof v === 'object') Object.keys(v).forEach(function(k2){ if (Array.isArray(v[k2])) flatTmp[k+'/'+k2] = v[k2]; });
          });
          var dkTmp = Object.keys(flatTmp);
          for (var dkt=0; dkt<dkTmp.length; dkt++) {
            var rowsTmp = flatTmp[dkTmp[dkt]];
            if (!Array.isArray(rowsTmp) || !rowsTmp.length) continue;
            var firstRow = rowsTmp[0];
            if (!Array.isArray(firstRow)) continue;
            var bestLen = 0;
            for (var fj=0; fj<firstRow.length; fj++) {
              var v = String(firstRow[fj] || '');
              if (v.length > bestLen && /[, ]/.test(v) && !/^[\d.:]+$/.test(v)) { bestLen = v.length; iName = fj; }
            }
            for (var fj=firstRow.length-1; fj>=0; fj--) {
              var v = String(firstRow[fj] || '');
              if (/^\d+:\d{2}(:\d{2})?$/.test(v)) { iNetto = fj; iZeit = fj; break; }
            }
            _rrDebug.iName = iName; _rrDebug.iNetto = iNetto;
            break;
          }
        }
        // RaceResult kann data als verschiedene Strukturen liefern:
        // 1. Array [[...], [...]]
        // 2. Objekt {gruppe: [[...], [...]]}
        // 3. Zwei Ebenen: {"#1_Contest": {"#1_Gruppe": [[...], [...]]}}
        var dataObj = payload.data || payload.Data || payload.result || payload.Result || payload.list && payload.list.data || {};
        if (Array.isArray(dataObj)) { var tmp = {}; tmp['_'] = dataObj; dataObj = tmp; }
        // Zwei-Ebenen-Struktur flachmachen
        var flatData = {};
        var dataKeys0 = Object.keys(dataObj);
        for (var dk0=0; dk0<dataKeys0.length; dk0++) {
          var val0 = dataObj[dataKeys0[dk0]];
          if (Array.isArray(val0)) {
            flatData[dataKeys0[dk0]] = val0;
          } else if (val0 && typeof val0 === 'object') {
            var subKeys = Object.keys(val0);
            for (var sk=0; sk<subKeys.length; sk++) {
              if (Array.isArray(val0[subKeys[sk]])) flatData[dataKeys0[dk0] + '/' + subKeys[sk]] = val0[subKeys[sk]];
            }
          }
        }
        var dataKeys = Object.keys(flatData);
        for (var dk=0; dk<dataKeys.length; dk++) {
          var rows = flatData[dataKeys[dk]];
          if (!Array.isArray(rows)) continue;
          // Club-Filter: Vereinsname/Kürzel in Club-Spalte suchen
          var vereinRaw = (appConfig.verein_kuerzel || appConfig.verein_name || '');
          var clubPhrase = vereinRaw.toLowerCase().trim();
          // Sicherheit: wenn kein Vereinsname konfiguriert → nichts durchlassen
          if (!clubPhrase) { _rrDebug.errors.push('Vereinsname nicht konfiguriert'); }
          for (var ri=0; ri<rows.length; ri++) {
            var row = rows[ri];
            if (!Array.isArray(row) || row.length < 4) continue;
            _rrDebug.totalRows++;
            // Club-Samples für Debug
            var clubSample = String(row[iClub] || '').trim();
            if (clubSample && _rrDebug.clubSamples.indexOf(clubSample) < 0 && _rrDebug.clubSamples.length < 50) _rrDebug.clubSamples.push(clubSample);
            if (clubPhrase) {
              var clubVal = clubSample.toLowerCase();
              if (clubVal.indexOf(clubPhrase) < 0) continue;
            }
            // Gruppen-Key auswerten für Disziplin und AK-Geschlecht
            var groupKey = dataKeys[dk];
            var groupParts = groupKey.split('/');
            var _cname = cname !== ('Contest ' + cid) ? cname :
              (groupParts[0] || '').replace(/^#\d+_/, '').trim() || cname;
            var _akFromGroup = '';
            if (iAK < 0 && groupParts.length > 1) {
              var gk = (groupParts[groupParts.length-1] || '').replace(/^#\d+_/, '').trim();
              if (/männl|maennl|male|herren/i.test(gk)) _akFromGroup = 'M';
              else if (/weibl|female|frauen|damen/i.test(gk)) _akFromGroup = 'W';
              else _akFromGroup = gk;
            }
            allResults.push({ raw: row, contestName: _cname, akFromGroup: _akFromGroup,
              iYear: iYear, iGeschlecht: iGeschlecht,
              iName: iName, iClub: iClub, iAK: iAK, iZeit: iZeit, iNetto: iNetto, iPlatz: iPlatz });
          }
        }
      } catch(e2) { continue; }
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
    rrRenderPreview(allResults, eventId, eventName, eventDate, contestObj, eventOrt);

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

function rrRenderPreview(results, eventId, eventName, eventDate, contestObj, eventOrt) {
  var preview = document.getElementById('rr-preview');
  var today = new Date().toISOString().slice(0,10);
  var guessDate = eventDate ? eventDate.slice(0,10) : today;
  window._rrState = { results: results, eventId: eventId };

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
  var _dbgIdx = (_dbgFirst ? ('iName='+_dbgFirst.iName+' iClub='+_dbgFirst.iClub+' iAK='+_dbgFirst.iAK+' iNetto='+_dbgFirst.iNetto+' iPlatz='+_dbgFirst.iPlatz) : '') + (window._rrDebug && window._rrDebug.resolvedDate ? ' | Datum: '+window._rrDebug.resolvedDate+' (Raw: '+JSON.stringify(window._rrDebug.cfgDateRaw||'')+')' : '');

  var rows = '';
  for (var i = 0; i < results.length; i++) {
    var r = results[i];
    var raw = r.raw;
    var name  = String(raw[r.iName]  || '').trim();
    var club  = String(raw[r.iClub]  || '').trim();
    var ak = '';
    if (r.iAK >= 0) {
      ak = String(raw[r.iAK] || '').trim();
    } else {
      var _jahrgang = r.iYear >= 0 ? String(raw[r.iYear] || '').trim() : '';
      var _geschlecht = '';
      if (athletId) {
        for (var _si=0; _si<state.athleten.length; _si++) {
          if (state.athleten[_si].id == athletId) { _geschlecht = state.athleten[_si].geschlecht || ''; break; }
        }
      }
      if (!_geschlecht && r.iGeschlecht >= 0) {
        var _gv = String(raw[r.iGeschlecht] || '').toUpperCase();
        _geschlecht = (_gv === 'W' || _gv === 'F' || _gv === 'FEMALE') ? 'W' : (_gv === 'M' || _gv === 'MALE') ? 'M' : '';
      }
      if (!_geschlecht) _geschlecht = r.akFromGroup === 'W' ? 'W' : r.akFromGroup === 'M' ? 'M' : '';
      if (_jahrgang && _geschlecht) {
        var _eventJahr = parseInt((guessDate || '').slice(0,4)) || new Date().getFullYear();
        ak = calcDlvAK(_jahrgang, _geschlecht, _eventJahr);
      } else {
        ak = r.akFromGroup || '';
      }
    }
    var zeit  = String(raw[r.iZeit]  || '').trim();
    var netto = String(raw[r.iNetto] || '').trim();
    var platzAKraw = r.iPlatz >= 0 ? String(raw[r.iPlatz] || '').trim() : '';
    var platzAKnum = parseInt(platzAKraw) || '';
    var disz  = rrBestDisz(r.contestName || '', diszList);

    // Athlet-Matching: Name aufteilen (Format "Nachname, Vorname" oder "Vorname Nachname")
    var athletId = '';
    var nameLow = name.toLowerCase().replace(/,/g, ' ');
    var parts = nameLow.split(/\s+/).filter(function(p) { return p.length >= 3; });
    // Exakter Treffer zuerst: kompletter name_nv-Vergleich
    for (var ai = 0; ai < state.athleten.length && !athletId; ai++) {
      var a = state.athleten[ai];
      if (!a.name_nv) continue;
      var aNorm = a.name_nv.toLowerCase().replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
      var nNorm = nameLow.replace(/\s+/g, ' ').trim();
      if (aNorm === nNorm) { athletId = a.id; }
    }
    // Fallback: alle Namensteile müssen als ganzes Wort vorkommen
    if (!athletId) {
      for (var ai = 0; ai < state.athleten.length && !athletId; ai++) {
        var a = state.athleten[ai];
        if (!a.name_nv) continue;
        var aNorm = a.name_nv.toLowerCase().replace(/,/g, ' ');
        var allMatch = parts.length > 0 && parts.every(function(p) {
          return new RegExp('\\b' + p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b').test(aNorm);
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
      '<tr style="border-bottom:1px solid var(--border)">' +
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
    '<details style="margin-bottom:12px"><summary style="cursor:pointer;font-size:12px;color:var(--text2);padding:4px 0">&#x1F50D; Spalten-Debug</summary><pre style="font-size:10px;overflow-x:auto;background:var(--surf2);padding:8px;border-radius:6px;white-space:pre-wrap;color:var(--text2)">' + _dbgIdx + '\n' + _dbgRaw + '</pre></details>' +
    '<div style="background:var(--surf2);border-radius:10px;padding:14px 18px;margin-bottom:14px;display:flex;flex-wrap:wrap;gap:14px;align-items:flex-end">' +
      '<div style="flex:1;min-width:200px"><div style="font-size:11px;font-weight:600;color:var(--text2);margin-bottom:4px">Veranstaltungsname</div>' +
        '<input id="rr-evname" type="text" value="' + eventName + '" style="padding:7px 10px;border:1px solid var(--border);border-radius:7px;font-size:16px;background:var(--surface);color:var(--text);width:100%"/></div>' +
      '<div><div style="font-size:11px;font-weight:600;color:var(--text2);margin-bottom:4px">Datum</div>' +
        '<input id="rr-datum" type="date" value="' + guessDate + '" style="padding:7px 10px;border:1px solid var(--border);border-radius:7px;font-size:13px;background:var(--surface);color:var(--text)"/></div>' +
      '<div><div style="font-size:11px;font-weight:600;color:var(--text2);margin-bottom:4px">Ort</div>' +
        '<input id="rr-ort" type="text" value="' + (eventOrt||'') + '" placeholder="z.B. D\u00fcsseldorf" style="padding:7px 10px;border:1px solid var(--border);border-radius:7px;font-size:16px;background:var(--surface);color:var(--text);width:min(150px,100%)"/></div>' +
      '<span style="font-size:12px;color:var(--text2);align-self:center">&#x2705; ' + results.length + ' TuS-Oedt-Ergebnis(se) &bull; Event ' + eventId + '</span>' +
    '</div>' +
    '<div style="overflow-x:auto;margin-bottom:12px">' +
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

async function rrImport() {
  var datum  = ((document.getElementById('rr-datum')  || {}).value || '').trim();
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

  for (var i = 0; i < chks.length; i++) {
    if (!chks[i].checked) continue;
    var idx = parseInt(chks[i].getAttribute('data-idx'), 10);
    var r   = rrState.results[idx];
    var raw = r.raw;
    var athletId = aths[i] ? parseInt(aths[i].value) || null : null;
    var disziplin = diszInputs[i] ? diszInputs[i].value.trim() : '';
    if (!athletId || !disziplin) continue;
    var zeit     = String(raw[r.iNetto] || raw[r.iZeit] || '').trim();
    var ak = '';
    if (r.iAK >= 0) {
      ak = String(raw[r.iAK] || '').trim();
    } else {
      var _jahrgang2 = r.iYear >= 0 ? String(raw[r.iYear] || '').trim() : '';
      var _geschlecht2 = '';
      var _selAthlet = document.querySelectorAll('.rr-athlet')[_idx];
      var _athId2 = _selAthlet ? parseInt(_selAthlet.value) || 0 : 0;
      if (_athId2) {
        for (var _si2=0; _si2<state.athleten.length; _si2++) {
          if (state.athleten[_si2].id == _athId2) { _geschlecht2 = state.athleten[_si2].geschlecht || ''; break; }
        }
      }
      if (!_geschlecht2 && r.iGeschlecht >= 0) {
        var _gv2 = String(raw[r.iGeschlecht] || '').toUpperCase();
        _geschlecht2 = (_gv2 === 'W' || _gv2 === 'F') ? 'W' : (_gv2 === 'M') ? 'M' : '';
      }
      if (!_geschlecht2) _geschlecht2 = r.akFromGroup === 'W' ? 'W' : r.akFromGroup === 'M' ? 'M' : '';
      if (_jahrgang2 && _geschlecht2) {
        var _datum = (document.getElementById('rr-datum') || {}).value || '';
        var _eventJahr2 = parseInt(_datum.slice(0,4)) || new Date().getFullYear();
        ak = calcDlvAK(_jahrgang2, _geschlecht2, _eventJahr2);
      } else {
        ak = r.akFromGroup || '';
      }
    }
    var platzAKv = r.iPlatz >= 0 ? parseInt(String(raw[r.iPlatz] || '')) || null : null;
    items.push({
      datum: datum, ort: ort, veranstaltung_name: evname,
      athlet_id: athletId, disziplin: disziplin,
      resultat: zeit, altersklasse: ak,
      ak_platzierung: platzAKv,
      import_quelle: 'raceresult:' + eventId
    });
  }

  if (!items.length) { notify('Keine g\u00fcltigen Eintr\u00e4ge (Athlet + Disziplin ben\u00f6tigt).', 'err'); return; }
  document.getElementById('rr-status').innerHTML = '&#x23F3; Importiere ' + items.length + ' Ergebnis(se)\u2026';
  var r2 = await apiPost('ergebnisse/bulk', { items: items });
  if (r2 && r2.ok) {
    var msg = r2.data.imported + ' importiert';
    if (r2.data.skipped) msg += ', ' + r2.data.skipped + ' Duplikate \u00fcbersprungen';
    notify(msg, 'ok');
    document.getElementById('rr-status').innerHTML = '&#x2705; ' + msg;
  } else {
    notify((r2 && r2.fehler) ? r2.fehler : 'Fehler', 'err');
    document.getElementById('rr-status').innerHTML = '';
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
        '<div class="user-row-avatar">' + b.benutzername[0].toUpperCase() + '</div>' +
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
  );
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
  var geb = (a.geburtsdatum || '').slice(0, 10);
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
      '<div class="form-group"><label>Geburtsdatum</label><input type="date" id="ea-geb" value="' + geb + '"/></div>' +
      '<div class="form-group full"><label>Gruppen <span style="font-size:11px;color:var(--text2)">(kommagetrennt)</span></label><input type="text" id="ea-gr" value="' + curGruppen + '" placeholder="z.B. Senioren, Masters"/></div>' +
      '<div class="form-group"><label>Status</label><select id="ea-aktiv">' +
        '<option value="1"' + (a.aktiv?' selected':'') + '>Aktiv</option>' +
        '<option value="0"' + (!a.aktiv?' selected':'') + '>Inaktiv</option>' +
      '</select></div>' +
    '</div>' +
    '<div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button><button class="btn btn-primary" onclick="saveAthlet(' + id + ')">Speichern</button></div>'
  );
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
    geburtsdatum:document.getElementById('ea-geb').value || null,
    gruppen:     gruppen,
    aktiv:       parseInt(document.getElementById('ea-aktiv').value),
  });
  if (r && r.ok) { closeModal(); notify('Gespeichert.', 'ok'); await loadAthleten(); await renderAthleten(); }
  else notify((r && r.fehler) || 'Fehler', 'err');
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
  { id: 'stat-ergebnisse', label: '🏃︎ Ergebnisse gesamt' },
  { id: 'stat-athleten',   label: '👥 Athleten' },
  { id: 'stat-rekorde',    label: '🏆 Vereinsrekorde' },
  { id: 'timeline',        label: '🏅 Neueste Bestleistungen' },
  { id: 'veranstaltungen', label: '📍 Letzte Veranstaltungen' },
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
    { cols: [{ widget: 'stats' }] },
    { cols: [{ widget: 'timeline', w: 340 }, { widget: 'veranstaltungen' }] }
  ];
}

async function renderAdminDashboard() {
  var el = document.getElementById('main-content');
  el.innerHTML = adminSubtabs() + '<div class="loading"><div class="spinner"></div>Laden&hellip;</div>';

  var layout = dashLayoutFromConfig();
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
      colsHtml +=
        '<div style="display:flex;flex-direction:column;gap:8px;flex:1;min-width:0;background:var(--surf2);border:1px solid var(--border);border-radius:8px;padding:12px">' +
          '<div style="display:flex;align-items:center;gap:8px">' +
            widgetSelect(ri, ci, col.widget) +
            (cols.length > 1
              ? '<button class="btn btn-ghost btn-sm" title="Spalte entfernen" onclick="dashRemoveCol(' + ri + ',' + ci + ')">✕</button>'
              : '') +
          '</div>' +
          widthInput(ri, ci, col.w) +
        '</div>';
    }
    rowsHtml +=
      '<div style="border:1px solid var(--border);border-radius:10px;padding:16px;background:var(--surface);margin-bottom:12px">' +
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">' +
          '<span style="font-size:12px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:1px">Zeile ' + (ri + 1) + '</span>' +
          '<div style="flex:1"></div>' +
          (ri > 0
            ? '<button class="btn btn-ghost btn-sm" title="Zeile nach oben" onclick="dashMoveRow(' + ri + ',-1)">▲</button>'
            : '<button class="btn btn-ghost btn-sm" disabled style="opacity:.3">▲</button>') +
          (ri < layout.length - 1
            ? '<button class="btn btn-ghost btn-sm" title="Zeile nach unten" onclick="dashMoveRow(' + ri + ',1)">▼</button>'
            : '<button class="btn btn-ghost btn-sm" disabled style="opacity:.3">▼</button>') +
          '<button class="btn btn-ghost btn-sm" title="Spalte hinzufügen" onclick="dashAddCol(' + ri + ')">+ Spalte</button>' +
          '<button class="btn btn-danger btn-sm" title="Zeile entfernen" onclick="dashRemoveRow(' + ri + ')">✕ Zeile</button>' +
        '</div>' +
        '<div style="display:flex;gap:12px;align-items:stretch">' + colsHtml + '</div>' +
      '</div>';
  }

  el.innerHTML = adminSubtabs() +
    '<div style="max-width:800px">' +
      '<div class="panel">' +
        '<div class="panel-header"><div class="panel-title">📊︎ Dashboard-Layout</div></div>' +
        '<div class="settings-panel-body">' +
          '<p style="font-size:13px;color:var(--text2);margin:0 0 16px">Ordne Widgets in Zeilen und Spalten an. Mehrere Spalten in einer Zeile werden nebeneinander angezeigt.</p>' +
          '<div id="dash-rows">' + rowsHtml + '</div>' +
          '<button class="btn btn-ghost btn-sm" onclick="dashAddRow()" style="margin-top:4px">+ Zeile hinzufügen</button>' +
        '</div>' +
      '</div>' +
      '<div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap">' +
        '<button class="btn btn-primary" onclick="dashSaveLayout()">💾 Layout speichern</button>' +
        '<button class="btn btn-ghost" onclick="dashResetLayout()">↺ Zurücksetzen</button>' +
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
  // Werte aus DOM zurücklesen und Layout neu setzen (ohne neu zu rendern)
  var layout = dashGetLayout();
  for (var ri = 0; ri < layout.length; ri++) {
    var cols = layout[ri].cols || [];
    for (var ci = 0; ci < cols.length; ci++) {
      var wEl = document.getElementById('dash-widget-' + ri + '-' + ci);
      var wW  = document.getElementById('dash-w-' + ri + '-' + ci);
      if (wEl) cols[ci].widget = wEl.value;
      if (wW)  { var v = parseInt(wW.value); cols[ci].w = isNaN(v) ? undefined : v; }
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
  } else {
    notify((r && r.fehler) || 'Fehler beim Speichern', 'err');
  }
}

function dashResetLayout() {
  var defaultLayout = [
    { cols: [{ widget: 'stat-ergebnisse' }, { widget: 'stat-athleten' }, { widget: 'stat-rekorde' }] },
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
        row('Dashboard – Neueste Bestleistungen', 'Anzahl Einträge (5–200)', numIn('cfg-dashboard_timeline_limit', cfgVal('dashboard_timeline_limit','20'), 5, 200)) +
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

    '<div style="padding-bottom:8px">' +
      '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding-bottom:8px">' +
        '<button class="btn btn-primary" onclick="saveAllSettings()">💾 Alle Einstellungen speichern</button>' +
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
    'dashboard_timeline_limit',
    'adressleiste_farbe',
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
  // timeline_limit als Zahl validieren
  if (payload.dashboard_timeline_limit) {
    payload.dashboard_timeline_limit = String(Math.max(5, Math.min(200, parseInt(payload.dashboard_timeline_limit) || 20)));
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
    var anzeige = d.anzeige_name ? '<span style="font-size:11px;color:var(--text2);display:block">&rarr; ' + d.anzeige_name + '</span>' : '';
    var fmtLabel = d.fmt_override ? '<span class="badge" style="background:var(--surf2);color:var(--btn-bg);font-size:11px">' + d.fmt_override + '</span>' : '';
    var selHtml = '<select class="disz-map-sel" data-disz="' + d.disziplin.replace(/"/g,'&quot;') + '" onchange="setDiszMapping(this)" style="font-size:12px;padding:4px 6px;border:1px solid var(--border);border-radius:6px;background:var(--surface)">';
    selHtml += '<option value="">– keine –</option>';
    for (var j = 0; j < kategorien.length; j++) {
      selHtml += '<option value="' + kategorien[j].id + '"' + (d.kategorie_id == kategorien[j].id ? ' selected' : '') + '>' + kategorien[j].name + '</option>';
    }
    selHtml += '</select>';
    var editBtn = '<button class="btn btn-ghost btn-sm" style="margin-left:6px" ' +
      'data-disz="' + d.disziplin.replace(/"/g,'&quot;') + '" ' +
      'data-anzeige="' + (d.anzeige_name||'').replace(/"/g,'&quot;') + '" ' +
      'data-fmt="' + (d.fmt_override||'').replace(/"/g,'&quot;') + '" ' +
      'data-katfmt="' + (d.kat_fmt||'').replace(/"/g,'&quot;') + '" ' +
      'onclick="showDiszEditModal(this)">&#x270F;&#xFE0F;</button>';
    var anz = d.ergebnis_anzahl || 0;
    var anzBadge = '<span class="badge" style="background:' + (anz > 0 ? 'var(--surf2);color:var(--text2)' : 'var(--green);color:#fff') + ';font-size:11px">' + anz + '</span>';
    var delBtn = anz === 0
      ? '<button class="btn btn-danger btn-sm" title="Disziplin l\u00f6schen" data-disz="' + d.disziplin.replace(/"/g,'&quot;') + '" onclick="deleteDisziplin(this.dataset.disz)">&#x2715;</button>'
      : '<button class="btn btn-ghost btn-sm" disabled title="' + anz + ' Ergebnis(se) vorhanden">&#x1F512;</button>';
    mapRows +=
      '<tr>' +
        '<td style="font-weight:600">' + d.disziplin + anzeige + '</td>' +
        '<td><span class="badge" style="background:var(--surf2);color:var(--text2);font-size:11px">' + (d.quelle_tbl || '') + '</span> ' + fmtLabel + '</td>' +
        '<td style="white-space:nowrap">' + selHtml + editBtn + '</td>' +
        '<td style="text-align:right;padding-right:12px">' + anzBadge + '</td>' +
        '<td>' + delBtn + '</td>' +
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
          '<table><thead><tr><th>Disziplin</th><th>Quelle / Format</th><th>Kategorie &amp; Aktionen</th><th style="text-align:right">Ergebnisse</th><th></th></tr></thead>' +
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
  var disz    = btn.dataset.disz;
  var anzeige = btn.dataset.anzeige;
  var fmt     = btn.dataset.fmt;
  var katfmt  = btn.dataset.katfmt;
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
  showModal(
    '<h2>&#x270F;&#xFE0F; Disziplin bearbeiten <button class="modal-close" onclick="closeModal()">&#x2715;</button></h2>' +
    '<div style="color:var(--text2);font-size:13px;margin-bottom:16px">Original: <strong>' + disz + '</strong></div>' +
    '<div class="form-grid">' +
      '<div class="form-group full"><label>Umbenennen in</label>' +
        '<input type="text" id="de-name" value="' + disz.replace(/"/g,'&quot;') + '" placeholder="Neuer Name (leer = unverändert)"/>' +
        '<div style="font-size:11px;color:var(--text2);margin-top:4px">&#x26A0;&#xFE0F; Benennt die Disziplin in allen Ergebnistabellen um.</div>' +
      '</div>' +
      '<div class="form-group full"><label>Anzeigename (optional)</label>' +
        '<input type="text" id="de-anzeige" value="' + anzeige.replace(/"/g,'&quot;') + '" placeholder="z.B. Halbmarathon (für 21,1 km)"/>' +
        '<div style="font-size:11px;color:var(--text2);margin-top:4px">Wird zusätzlich zum Disziplinnamen angezeigt.</div>' +
      '</div>' +
      '<div class="form-group full"><label>Ergebnisformat</label>' + fmtSel + '</div>' +
    '</div>' +
    '<div class="modal-actions">' +
      '<button class="btn btn-ghost" onclick="closeModal()">Abbrechen</button>' +
      '<button class="btn btn-primary" data-disz="' + disz.replace(/"/g,'&quot;') + '" onclick="updateDisz(this)">Speichern</button>' +
    '</div>'
  );
}

async function updateDisz(btn) {
  var origDisz  = btn.dataset.disz;
  var neuerName = document.getElementById('de-name').value.trim();
  var anzeige   = document.getElementById('de-anzeige').value.trim();
  var fmt       = document.getElementById('de-fmt').value;
  var body = { anzeige_name: anzeige, fmt_override: fmt };
  if (neuerName && neuerName !== origDisz) body.neuer_name = neuerName;
  var r = await apiPut('disziplin-mapping/' + encodeURIComponent(origDisz), body);
  if (r && r.ok) {
    closeModal();
    notify('Gespeichert.', 'ok');
    // Cache leeren damit Rekorde neu laden
    state.allDisziplinen = {};
    state.topDisziplinen = {};
    await renderAdminDisziplinen();
  } else notify((r && r.fehler) || 'Fehler', 'err');
}

// ── HELPERS ────────────────────────────────────────────────

/* ── 09_utils.js ── */
function setSubTab(t) { state.subTab = t; state.page = 1; state.filters = {}; state.diszFilter = null; renderPage(); }
function setDiszFilter(d) { state.diszFilter = d; state.page = 1; loadErgebnisseData(); }
function setDiszTabFilter(cat, disz) { state.subTab = cat; state.diszFilter = disz; state.page = 1; state.filters = {}; loadErgebnisseData(); }

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
      if (!byDisz[e.disziplin]) { byDisz[e.disziplin] = []; diszOrder.push(e.disziplin); }
      byDisz[e.disziplin].push(e);
    }
    for (var di = 0; di < diszOrder.length; di++) {
      var disz = diszOrder[di];
      var ergs = byDisz[disz];
      rows += '<tr class="disz-header-row"><td colspan="6" class="disziplin-text" style="background:var(--surf2);font-weight:600;padding:6px 12px">' + disz + '</td></tr>';
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