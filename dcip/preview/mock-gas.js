/*
 * Stand-in for Google Apps Script services, used by the local preview (browser) and by test.js (Node).
 * Loads ../apps-script/Code.gs unchanged. NOT deployed to Apps Script.
 *
 *   var env = createGasEnv({ now: fn, load: obj, save: fn });
 *   env.globals  → SpreadsheetApp, Utilities, CacheService, PropertiesService, LockService, MailApp, DriveApp, ContentService, Logger
 *   env.store    → { sheets, props, cache, mails, files } (inspect in tests)
 */
(function (root) {
  'use strict';

  // ---------- pure-JS SHA-256 / HMAC (so the same code runs in Node and in the browser) ----------
  var K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
  function sha256(bytes) {
    var h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var len = bytes.length, m = bytes.slice();
    m.push(0x80);
    while (m.length % 64 !== 56) m.push(0);
    var bits = len * 8;
    for (var i = 7; i >= 0; i--) m.push(i > 3 ? 0 : (bits >>> (i * 8)) & 255);
    for (var o = 0; o < m.length; o += 64) {
      var w = [];
      for (var t = 0; t < 16; t++) w[t] = (m[o + t * 4] << 24) | (m[o + t * 4 + 1] << 16) | (m[o + t * 4 + 2] << 8) | m[o + t * 4 + 3];
      for (t = 16; t < 64; t++) {
        var s0 = rr(w[t - 15], 7) ^ rr(w[t - 15], 18) ^ (w[t - 15] >>> 3), s1 = rr(w[t - 2], 17) ^ rr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
        w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
      }
      var a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
      for (t = 0; t < 64; t++) {
        var S1 = rr(e, 6) ^ rr(e, 11) ^ rr(e, 25), ch = (e & f) ^ (~e & g), t1 = (hh + S1 + ch + K[t] + w[t]) | 0;
        var S0 = rr(a, 2) ^ rr(a, 13) ^ rr(a, 22), mj = (a & b) ^ (a & c) ^ (b & c), t2 = (S0 + mj) | 0;
        hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0;
      h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + hh) | 0;
    }
    var out = [];
    h.forEach(function (x) { out.push((x >>> 24) & 255, (x >>> 16) & 255, (x >>> 8) & 255, x & 255); });
    return out;
  }
  function rr(x, n) { return (x >>> n) | (x << (32 - n)); }
  function hmac(key, msg) {
    if (key.length > 64) key = sha256(key);
    while (key.length < 64) key.push(0);
    var ip = key.map(function (b) { return b ^ 0x36; }), op = key.map(function (b) { return b ^ 0x5c; });
    return sha256(op.concat(sha256(ip.concat(msg))));
  }
  function utf8(s) {
    var out = [];
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c >= 0xd800 && c < 0xdc00 && i + 1 < s.length) { c = 0x10000 + ((c - 0xd800) << 10) + (s.charCodeAt(++i) - 0xdc00); }
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return out;
  }
  function fromUtf8(b) {
    var s = '', i = 0;
    while (i < b.length) {
      var c = b[i++] & 255;
      if (c < 0x80) s += String.fromCharCode(c);
      else if (c < 0xe0) s += String.fromCharCode(((c & 31) << 6) | (b[i++] & 63));
      else if (c < 0xf0) { s += String.fromCharCode(((c & 15) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63)); }
      else { var cp = ((c & 7) << 18) | ((b[i++] & 63) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63); cp -= 0x10000; s += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 1023)); }
    }
    return s;
  }
  var B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  function b64enc(bytes, web) {
    var s = '';
    for (var i = 0; i < bytes.length; i += 3) {
      var n = ((bytes[i] & 255) << 16) | (((bytes[i + 1] || 0) & 255) << 8) | ((bytes[i + 2] || 0) & 255);
      s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < bytes.length ? B64[(n >> 6) & 63] : '=') + (i + 2 < bytes.length ? B64[n & 63] : '=');
    }
    return web ? s.replace(/\+/g, '-').replace(/\//g, '_') : s;
  }
  function b64dec(s) {
    s = String(s).replace(/-/g, '+').replace(/_/g, '/').replace(/[^A-Za-z0-9+/]/g, '');
    var out = [];
    for (var i = 0; i < s.length; i += 4) {
      var n = (B64.indexOf(s[i]) << 18) | (B64.indexOf(s[i + 1]) << 12) | ((s[i + 2] ? B64.indexOf(s[i + 2]) : 0) << 6) | (s[i + 3] ? B64.indexOf(s[i + 3]) : 0);
      out.push((n >> 16) & 255);
      if (s[i + 2]) out.push((n >> 8) & 255);
      if (s[i + 3]) out.push(n & 255);
    }
    return out;
  }
  function signed(b) { return b.map(function (x) { return x > 127 ? x - 256 : x; }); }
  function toBytes(v) { return typeof v === 'string' ? utf8(v) : v.map(function (x) { return x & 255; }); }

  // ------------------------------------------------------------------------------------------------
  function createGasEnv(opts) {
    opts = opts || {};
    var now = opts.now || function () { return Date.now(); };
    var store = opts.load || { sheets: {}, props: {}, cache: {}, mails: [], files: {}, folders: {} };
    var save = function () { if (opts.save) opts.save(store); };
    var seq = 0;

    function colName(c) { var s = ''; while (c > 0) { var m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); } return s; }

    function Range(sh, row, col, nr, nc) { this.sh = sh; this.row = row; this.col = col; this.nr = nr || 1; this.nc = nc || 1; }
    Range.prototype.getValues = function () {
      var d = store.sheets[this.sh.name], out = [];
      for (var r = 0; r < this.nr; r++) {
        var src = d[this.row - 1 + r] || [], row = [];
        for (var c = 0; c < this.nc; c++) { var v = src[this.col - 1 + c]; row.push(v === undefined || v === null ? '' : v); }
        out.push(row);
      }
      return out;
    };
    Range.prototype.setValues = function (vals) {
      if (vals.length !== this.nr || vals.some(function (r) { return r.length !== this.nc; }, this)) throw new Error('The number of rows or columns in the data does not match the range.');
      var d = store.sheets[this.sh.name];
      for (var r = 0; r < this.nr; r++) {
        var i = this.row - 1 + r;
        while (d.length <= i) d.push([]);
        for (var c = 0; c < this.nc; c++) d[i][this.col - 1 + c] = vals[r][c];
      }
      save();
      return this;
    };
    Range.prototype.setValue = function (v) { return this.setValues([[v]]); };
    ['setNumberFormat', 'setFontWeight', 'setBackground', 'setFontColor'].forEach(function (m) { Range.prototype[m] = function () { return this; }; });

    function Sheet(name) { this.name = name; }
    Sheet.prototype.getLastRow = function () { var d = store.sheets[this.name]; var n = d.length; while (n > 0 && (d[n - 1] || []).every(function (c) { return c === '' || c == null; })) n--; return n; };
    Sheet.prototype.getLastColumn = function () { var m = 0; store.sheets[this.name].forEach(function (r) { m = Math.max(m, r.length); }); return m; };
    Sheet.prototype.getRange = function (r, c, nr, nc) { return new Range(this, r, c, nr, nc); };
    Sheet.prototype.setFrozenRows = function () {};
    Sheet.prototype.deleteRow = function (r) { store.sheets[this.name].splice(r - 1, 1); save(); };

    var spreadsheet = {
      getSheetByName: function (n) { return store.sheets[n] ? new Sheet(n) : null; },
      insertSheet: function (n) { store.sheets[n] = []; save(); return new Sheet(n); },
      getUrl: function () { return 'https://docs.google.com/spreadsheets/d/MOCK/edit'; }
    };
    var SpreadsheetApp = { getActiveSpreadsheet: function () { return spreadsheet; }, openById: function () { return spreadsheet; } };

    function pad(n) { return ('0' + n).slice(-2); }
    var Utilities = {
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      getUuid: function () { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }); },
      formatDate: function (d, tz, fmt) {
        var t = new Date(d.getTime() + (tz === 'Asia/Kolkata' ? 19800000 : 0));
        var map = { yyyy: t.getUTCFullYear(), MM: pad(t.getUTCMonth() + 1), dd: pad(t.getUTCDate()), HH: pad(t.getUTCHours()), mm: pad(t.getUTCMinutes()), ss: pad(t.getUTCSeconds()) };
        return fmt.replace(/'([^']*)'|yyyy|MM|dd|HH|mm|ss/g, function (m, lit) { return lit !== undefined ? lit : map[m]; });
      },
      base64Encode: function (v) { return b64enc(toBytes(v)); },
      base64EncodeWebSafe: function (v) { return b64enc(toBytes(v), true); },
      base64Decode: function (s) { return signed(b64dec(s)); },
      base64DecodeWebSafe: function (s) { return signed(b64dec(s)); },
      computeDigest: function (alg, v) { return signed(sha256(toBytes(v))); },
      computeHmacSha256Signature: function (v, key) { return signed(hmac(toBytes(key), toBytes(v))); },
      newBlob: function (data, mime, name) {
        var bytes = toBytes(data);
        return { getBytes: function () { return signed(bytes); }, getDataAsString: function () { return fromUtf8(bytes); }, getName: function () { return name || ''; }, getContentType: function () { return mime || ''; } };
      }
    };

    var CacheService = {
      getScriptCache: function () {
        return {
          get: function (k) { var e = store.cache[k]; if (!e) return null; if (e.exp <= now()) { delete store.cache[k]; return null; } return e.v; },
          put: function (k, v, ttl) { store.cache[k] = { v: String(v), exp: now() + (ttl || 600) * 1000 }; save(); },
          remove: function (k) { delete store.cache[k]; save(); }
        };
      }
    };
    var PropertiesService = {
      getScriptProperties: function () {
        return {
          getProperty: function (k) { return store.props[k] === undefined ? null : store.props[k]; },
          setProperty: function (k, v) { store.props[k] = String(v); save(); }
        };
      }
    };
    var LockService = { getScriptLock: function () { return { waitLock: function () {}, releaseLock: function () {} }; } };
    var MailApp = {
      sendEmail: function (o) {
        if (store.mails.length >= (opts.mailQuota || 100)) throw new Error('Service invoked too many times for one day: email.');
        store.mails.push({ to: o.to, subject: o.subject, html: o.htmlBody, text: o.body, replyTo: o.replyTo, name: o.name, at: now() }); save();
      },
      getRemainingDailyQuota: function () { return (opts.mailQuota || 100) - store.mails.length; }
    };
    function folderObj(id) {
      return {
        getId: function () { return id; }, getUrl: function () { return 'https://drive.google.com/drive/folders/' + id; },
        createFile: function (blob) {
          var fid = 'FILE' + (++seq) + '_' + Math.random().toString(36).slice(2, 7);
          store.files[fid] = { name: blob.getName(), mime: blob.getContentType(), size: blob.getBytes().length, folder: id };
          save();
          return { getId: function () { return fid; }, getUrl: function () { return 'https://drive.google.com/file/d/' + fid + '/view'; } };
        }
      };
    }
    var DriveApp = {
      createFolder: function (name) { var id = 'FOLDER' + (++seq); store.folders[id] = name; return folderObj(id); },
      getFolderById: function (id) { if (!store.folders[id]) throw new Error('No folder'); return folderObj(id); }
    };
    var ContentService = {
      MimeType: { JSON: 'JSON' },
      createTextOutput: function (s) { return { setMimeType: function () { return this; }, getContent: function () { return s; } }; }
    };
    var Logger = { log: function (s) { if (opts.log) opts.log(s); } };

    return {
      store: store,
      globals: { SpreadsheetApp: SpreadsheetApp, Utilities: Utilities, CacheService: CacheService, PropertiesService: PropertiesService,
        LockService: LockService, MailApp: MailApp, DriveApp: DriveApp, ContentService: ContentService, Logger: Logger }
    };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { createGasEnv: createGasEnv };
  else root.createGasEnv = createGasEnv;
})(typeof window !== 'undefined' ? window : this);
