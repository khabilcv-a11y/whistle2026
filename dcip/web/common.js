/* Shared helpers: API client, formatting, toasts. Used by the registration form and the admin portal. */
(function (w) {
  'use strict';
  var CFG = w.DCIP_CONFIG || {};

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /** POST {fn,args} as text/plain (no CORS preflight). In the local preview a mock transport is used instead. */
  function call(fn) {
    var args = Array.prototype.slice.call(arguments, 1);
    if (w.DCIP_TRANSPORT) return w.DCIP_TRANSPORT(fn, args);
    if (!CFG.apiUrl) return Promise.reject(new Error('The server address is not configured (web/config.js).'));
    return fetch(CFG.apiUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ fn: fn, args: args }), redirect: 'follow' })
      .then(parse, function () { throw new Error('Could not reach the server. Please check your internet connection and try again.'); });
  }
  function getConfig() {
    if (w.DCIP_TRANSPORT) return w.DCIP_TRANSPORT('__config', []);
    if (!CFG.apiUrl) return Promise.reject(new Error('The server address is not configured (web/config.js).'));
    return fetch(CFG.apiUrl + '?api=config', { redirect: 'follow' }).then(parse, function () { throw new Error('Could not reach the server. Please check your internet connection.'); });
  }
  function parse(res) {
    return res.json().then(function (j) { if (!j.ok) throw new Error(j.error || 'Server error'); return j.result; },
      function () { throw new Error('Unexpected response from the server.'); });
  }

  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function isIso(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '')); if (!m) return false;
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
  }
  function fmtDate(iso) { if (!isIso(iso)) return iso || ''; var p = iso.split('-'); return +p[2] + ' ' + MON[+p[1] - 1] + ' ' + p[0]; }
  function fmtDateTime(s) {
    var m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(String(s || '')); if (!m) return s || '';
    var h = +m[2], ap = h >= 12 ? 'pm' : 'am'; h = h % 12 || 12;
    return fmtDate(m[1]) + ', ' + h + ':' + m[3] + ' ' + ap;
  }
  function ageOn(dob, asOn) {
    var a = dob.split('-').map(Number), b = asOn.split('-').map(Number), age = b[0] - a[0];
    if (b[1] < a[1] || (b[1] === a[1] && b[2] < a[2])) age--; return age;
  }
  function addDays(iso, n) {
    var p = iso.split('-').map(Number), d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n));
    return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2);
  }

  function toast(msg, kind) {
    var wrap = document.querySelector('.toast-wrap');
    if (!wrap) { wrap = document.createElement('div'); wrap.className = 'toast-wrap'; wrap.setAttribute('role', 'status'); document.body.appendChild(wrap); }
    var t = document.createElement('div'); t.className = 'toast ' + (kind || ''); t.textContent = msg; wrap.appendChild(t);
    setTimeout(function () { t.remove(); }, kind === 'err' ? 7000 : 3500);
  }

  w.DCIP = { call: call, getConfig: getConfig, esc: esc, isIso: isIso, fmtDate: fmtDate, fmtDateTime: fmtDateTime, ageOn: ageOn, addDays: addDays, toast: toast };
})(window);
