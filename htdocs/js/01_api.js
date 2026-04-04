var API = 'api/index.php';

async function api(method, path, body, signal) {
  const opts = {
    method: method,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
  };
  if (body)   opts.body   = JSON.stringify(body);
  if (signal) opts.signal = signal;
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
