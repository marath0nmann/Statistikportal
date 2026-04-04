
// ── ArrayBuffer ↔ Base64URL Hilfsfunktionen ───────────────────
function _b64urlToBuffer(b64url) {
  var s = b64url.replace(/-/g, '+').replace(/_/g, '/');
  var pad = s.length % 4;
  if (pad) s += '==='.slice(0, 4 - pad);
  var bin = atob(s);
  var buf = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

function _bufferToB64url(buf) {
  var bytes = new Uint8Array(buf);
  var bin = '';
  for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ── Passkey registrieren ───────────────────────────────────────
async function passkeyRegister(keyName) {
  try {
    if (!window.PublicKeyCredential) {
      throw new Error('Dein Browser unterstützt keine Passkeys.');
    }

    // Challenge vom Server holen
    var optR = await apiGet('auth/passkey-reg-challenge');
    if (!optR || !optR.ok) throw new Error((optR && optR.fehler) || 'Challenge fehlgeschlagen');
    var opts = optR.data;

    // Optionen in WebAuthn-Format konvertieren
    var createOpts = {
      rp:      opts.rp,
      user: {
        id:          _b64urlToBuffer(opts.user.id),
        name:        opts.user.name,
        displayName: opts.user.displayName,
      },
      challenge:         _b64urlToBuffer(opts.challenge),
      pubKeyCredParams:  opts.pubKeyCredParams,
      timeout:           opts.timeout || 60000,
      excludeCredentials: (opts.excludeCredentials || []).map(function(c) {
        return { type: 'public-key', id: _b64urlToBuffer(c.id) };
      }),
      authenticatorSelection: opts.authenticatorSelection || {},
      attestation: opts.attestation || 'none',
    };

    // Plattform-Dialog öffnen
    var cred = await navigator.credentials.create({ publicKey: createOpts });

    // Response an Server schicken
    var credData = {
      id:   cred.id,
      type: cred.type,
      response: {
        clientDataJSON:    _bufferToB64url(cred.response.clientDataJSON),
        attestationObject: _bufferToB64url(cred.response.attestationObject),
      }
    };

    var verR = await apiPost('auth/passkey-reg-verify', {
      credential: credData,
      name:       keyName || 'Passkey',
    });
    if (!verR || !verR.ok) throw new Error((verR && verR.fehler) || 'Registrierung fehlgeschlagen');
    return { ok: true, name: verR.data.name };
  } catch(e) {
    return { ok: false, fehler: e.message || String(e) };
  }
}

// ── Passkey löschen ───────────────────────────────────────────
async function passkeyDelete(id) {
  var r = await apiDel('auth/passkeys/' + id);
  return r && r.ok;
}

// ── Passkey-Verwaltungs-UI im Profil ─────────────────────────
async function renderPasskeySection(containerId) {
  var el = document.getElementById(containerId);
  if (!el) return;

  if (!window.PublicKeyCredential) {
    el.innerHTML = '<div style="color:var(--text2);font-size:13px;padding:12px 0">' +
      '&#x26A0;&#xFE0E; Dein Browser unterstützt keine Passkeys (WebAuthn).</div>';
    return;
  }

  el.innerHTML = '<div style="color:var(--text2);font-size:13px;padding:8px 0">&#x23F3; Lade&hellip;</div>';

  var r = await apiGet('auth/passkeys');
  var passkeys = (r && r.ok && r.data) ? r.data : [];

  var rows = '';
  if (passkeys.length === 0) {
    rows = '<div style="color:var(--text2);font-size:13px;padding:8px 0;font-style:italic">Noch keine Passkeys registriert.</div>';
  } else {
    rows = '<div style="margin-bottom:12px">';
    passkeys.forEach(function(pk) {
      var datum = pk.letzter_login
        ? new Date(pk.letzter_login).toLocaleDateString('de-DE')
        : '–';
      rows +=
        '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">' +
          '<span style="font-size:20px">&#x1F511;</span>' +
          '<div style="flex:1">' +
            '<div style="font-weight:600;font-size:13px">' + pk.name + '</div>' +
            '<div style="font-size:11px;color:var(--text2)">Zuletzt verwendet: ' + datum + '</div>' +
          '</div>' +
          '<button class="btn btn-danger btn-sm" onclick="passkeyDeleteAndRefresh(' + pk.id + ',\'' + containerId + '\')" title="Passkey löschen">&#x2715;</button>' +
        '</div>';
    });
    rows += '</div>';
  }

  el.innerHTML =
    rows +
    '<div style="margin-top:12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">' +
      '<input type="text" id="passkey-new-name" placeholder="Name (z.B. MacBook, iPhone)" ' +
        'style="flex:1;min-width:160px;padding:7px 10px;border:1px solid var(--border);border-radius:7px;font-size:13px;background:var(--surface);color:var(--text)" ' +
        'onkeydown="if(event.key===\'Enter\')passkeyRegisterAndRefresh(\'' + containerId + '\')" />' +
      '<button class="btn btn-primary btn-sm" onclick="passkeyRegisterAndRefresh(\'' + containerId + '\')">' +
        '&#x2795; Passkey hinzufügen' +
      '</button>' +
    '</div>' +
    '<div id="passkey-msg-' + containerId + '" style="display:none;margin-top:8px;font-size:13px;font-weight:600;padding:8px 12px;border-radius:7px"></div>';
}

async function passkeyRegisterAndRefresh(containerId) {
  var nameEl = document.getElementById('passkey-new-name');
  var name = nameEl ? nameEl.value.trim() : '';
  var msgEl = document.getElementById('passkey-msg-' + containerId);

  if (msgEl) { msgEl.style.display = 'none'; }

  var result = await passkeyRegister(name || 'Passkey');
  if (result.ok) {
    if (msgEl) {
      msgEl.style.background = '#d4edda';
      msgEl.style.color = '#155724';
      msgEl.textContent = '✓ Passkey „' + result.name + '" erfolgreich registriert!';
      msgEl.style.display = 'block';
    }
    notify('Passkey „' + result.name + '" registriert.', 'ok');
    await renderPasskeySection(containerId);
  } else {
    if (msgEl) {
      msgEl.style.background = '#fde8e8';
      msgEl.style.color = '#cc0000';
      msgEl.textContent = '❌ ' + result.fehler;
      msgEl.style.display = 'block';
    }
  }
}

async function passkeyDeleteAndRefresh(id, containerId) {
  if (!confirm('Passkey wirklich löschen?')) return;
  var ok = await passkeyDelete(id);
  if (ok) {
    notify('Passkey gelöscht.', 'ok');
    await renderPasskeySection(containerId);
  } else {
    notify('Fehler beim Löschen.', 'err');
  }
}
