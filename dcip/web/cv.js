/* CV auto-fill: read the uploaded CV in the browser (PDF / DOCX), pull out the details we can recognise,
 * and (optionally) let the server's AI refine them. Nothing here is stored; the applicant checks every value. */
(function (w) {
  'use strict';

  /* ------------------------------ detail extraction (pure) ------------------------------ */
  var MONTHS = { jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12 };
  var DISTRICT_ALIASES = { 'Kozhikode': ['kozhikode', 'calicut'], 'Thiruvananthapuram': ['thiruvananthapuram', 'trivandrum'], 'Ernakulam': ['ernakulam', 'kochi', 'cochin'], 'Thrissur': ['thrissur', 'trichur'],
    'Kollam': ['kollam', 'quilon'], 'Pathanamthitta': ['pathanamthitta'], 'Alappuzha': ['alappuzha', 'alleppey'], 'Kottayam': ['kottayam'], 'Idukki': ['idukki'], 'Palakkad': ['palakkad', 'palghat'],
    'Malappuram': ['malappuram'], 'Wayanad': ['wayanad'], 'Kannur': ['kannur', 'cannanore'], 'Kasaragod': ['kasaragod', 'kasargod'] };
  var STREAM_PATTERNS = [
    ['B.Tech / B.E', /\b(b\.?\s?tech|bachelor of technology|bachelor of engineering|b\.?\s?e\.?)(?=[\s,.(\-–:]|$)/i], ['B.Sc', /\b(b\.?\s?sc\.?|bachelor of science)(?=[\s,.(\-–:]|$)/i],
    ['B.Com', /\b(b\.?\s?com\.?|bachelor of commerce)(?=[\s,.(\-–:]|$)/i], ['BBA / BBM', /\b(bba|bbm|bachelor of business (administration|management))\b/i], ['BCA', /\b(bca|bachelor of computer applications?)\b/i],
    ['LL.B', /\b(ll\.?\s?b|bachelor of laws?)\b/i], ['B.Ed', /\b(b\.?\s?ed\.?|bachelor of education)(?=[\s,.(\-–:]|$)/i], ['B.Voc', /\b(b\.?\s?voc\.?|bachelor of vocation)/i], ['BSW', /\b(bsw|bachelor of social work)\b/i],
    ['B.Arch', /\b(b\.?\s?arch\.?|bachelor of architecture)/i], ['B.Pharm', /\b(b\.?\s?pharm\.?|bachelor of pharmacy)/i], ['MBBS / BDS / Nursing', /\b(mbbs|bds|b\.?\s?sc\.?\s?nursing)\b/i],
    ['B.A', /\b(b\.?\s?a\.?|bachelor of arts)(?=[\s,.(\-–:]|$)/i]
  ];
  var MASTERS = /\b(m\.?\s?a\.?|m\.?\s?sc\.?|m\.?\s?com\.?|msw|mba|m\.?\s?tech\.?|m\.?\s?phil|master'?s?\s+(of|in|degree)|post[- ]?graduat(e|ion))(?=[\s,.(\-–:]|$)/i;
  var NOT_NAME = /resume|curriculum|vitae|\bcv\b|profile|contact|e-?mail|phone|mobile|address|objective|summary|education|experience|skills|references|declaration|personal|details|bio-?data|career/i;

  function pad(n) { return ('0' + n).slice(-2); }
  function validDate(y, m, d) { var x = new Date(Date.UTC(y, m - 1, d)); return y >= 1950 && x.getUTCFullYear() === y && x.getUTCMonth() === m - 1 && x.getUTCDate() === d; }
  function iso(y, m, d) { return validDate(y, m, d) ? y + '-' + pad(m) + '-' + pad(d) : ''; }
  function parseDate(s, today) {
    s = String(s || '').trim(); var m, r = '';
    if ((m = /(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/.exec(s))) r = iso(+m[1], +m[2], +m[3]);
    else if ((m = /(\d{1,2})[-\/.\s](\d{1,2})[-\/.\s](\d{4})/.exec(s))) r = iso(+m[3], +m[2], +m[1]);                       // Indian order: dd/mm/yyyy
    else if ((m = /(\d{1,2})(?:st|nd|rd|th)?[\s,.-]+([A-Za-z]{3,9})\.?[\s,.-]+(\d{4})/.exec(s)) && MONTHS[m[2].toLowerCase()]) r = iso(+m[3], MONTHS[m[2].toLowerCase()], +m[1]);
    else if ((m = /([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/.exec(s)) && MONTHS[m[1].toLowerCase()]) r = iso(+m[3], MONTHS[m[1].toLowerCase()], +m[2]);
    if (r && today) { var age = +today.slice(0, 4) - +r.slice(0, 4); if (age < 16 || age > 60) r = ''; }
    return r;
  }
  function titleCase(s) { return /[a-z]/.test(s) ? s : s.toLowerCase().replace(/(^|[\s.'-])([a-z])/g, function (x, a, b) { return a + b.toUpperCase(); }); }
  function normWords(s) { return String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim(); }

  /** Best matching college from the known list: the words of its name must appear in the text (a short name alone is not enough when the full entry has more words). */
  function findCollege(text, colleges) {
    var t = ' ' + normWords(text) + ' ', best = null, bestKey = 0;
    var skip = { the: 1, and: 1, of: 1, college: 1, university: 1, for: 1, st: 1, autonomous: 1 };
    (colleges || []).forEach(function (c) {
      var sig = function (str) { return normWords(str).split(' ').filter(function (x) { return x.length > 1 && !skip[x]; }); };
      var first = sig(c.split(',')[0]), all = sig(c);
      if (!first.length) return;
      var firstHit = first.every(function (x) { return t.indexOf(' ' + x) >= 0; });
      if (!firstHit) return;
      var frac = all.filter(function (x) { return t.indexOf(' ' + x) >= 0; }).length / all.length;
      if (frac < 0.6) return;
      var key = frac * 100 + all.length;
      if (key > bestKey) { best = c; bestKey = key; }
    });
    return best;
  }

  /**
   * text → { fullName, dob, gender, email, mobile, altMobile, district, qual, stream, specialisation, institution, completionYear }
   * Only fields that were recognised are present. opts: { districts, colleges, today }
   */
  function extractLocal(text, opts) {
    opts = opts || {}; var out = {}, raw = String(text || '').replace(/\r/g, '\n').replace(/ /g, ' ');
    var lines = raw.split('\n').map(function (l) { return l.replace(/\s+/g, ' ').trim(); }).filter(Boolean), flat = lines.join('\n');
    if (!flat) return out;

    var em = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.exec(flat); if (em) out.email = em[0].toLowerCase();

    var phones = [], re = /(?:\+?91[\s-]?)?([6-9]\d{4}[\s-]?\d{5})(?!\d)/g, m;
    while ((m = re.exec(flat))) { var d = m[1].replace(/\D/g, ''); if (phones.indexOf(d) < 0) phones.push(d); }
    if (phones[0]) out.mobile = phones[0]; if (phones[1]) out.altMobile = phones[1];

    var dobLine = /(?:d\.?\s?o\.?\s?b\.?|date\s+of\s+birth|birth\s*date|born(?:\s+on)?)\s*[:\-–]?\s*([^\n]{6,32})/i.exec(flat);
    if (dobLine) { var dd = parseDate(dobLine[1], opts.today); if (dd) out.dob = dd; }

    var g = /\b(?:gender|sex)\s*[:\-–]?\s*(female|male|other)\b/i.exec(flat); if (g) out.gender = g[1][0].toUpperCase() + g[1].slice(1).toLowerCase();

    for (var i = 0; i < Math.min(lines.length, 8); i++) {
      var ln = lines[i].replace(/^(name|full name)\s*[:\-–]\s*/i, '');
      if (ln.length >= 3 && ln.length <= 60 && /^[A-Za-z][A-Za-z .'-]+$/.test(ln) && !NOT_NAME.test(ln) && ln.split(' ').length >= 2 && ln.split(' ').length <= 5) { out.fullName = titleCase(ln); break; }
    }

    // district: only from an address block (a college's town is not where the applicant lives)
    var addr = [];
    lines.forEach(function (l, idx) {
      if (!/address|permanent|present\s+addr|residen|native|hometown/i.test(l)) return;
      addr.push(/^(permanent|present|current|communication)?\s*address\s*:?\s*$/i.test(l) ? lines.slice(idx, idx + 3).join(' ') : l);   // a bare "Address" heading: look at the lines under it
    });
    var addrText = addr.join(' ').toLowerCase(), bestAt = -1;
    Object.keys(DISTRICT_ALIASES).forEach(function (dist) {
      DISTRICT_ALIASES[dist].forEach(function (a) { var at = addrText.search(new RegExp('\\b' + a + '\\b')); if (at >= 0 && (bestAt < 0 || at < bestAt)) { bestAt = at; out.district = dist; } });
    });

    // education: the bachelor's line
    var eduStart = lines.findIndex(function (l) { return /^(educational?\s+qualifications?|education|academic\s+(qualifications?|background|details)|qualifications?)\b/i.test(l); });
    var scan = eduStart >= 0 ? lines.slice(eduStart, eduStart + 18) : lines, bIdx = -1, stream = '';
    for (var k = 0; k < scan.length && bIdx < 0; k++) {
      if (MASTERS.test(scan[k]) && !/bachelor|b\.?\s?(a|sc|com|tech|e)\b/i.test(scan[k])) continue;
      for (var s = 0; s < STREAM_PATTERNS.length; s++) { if (STREAM_PATTERNS[s][1].test(scan[k])) { stream = STREAM_PATTERNS[s][0]; bIdx = k; break; } }
    }
    var hasMasters = scan.some(function (l) { return MASTERS.test(l) && !/bachelor/i.test(l); });
    if (stream) {
      out.stream = stream;
      var near = scan.slice(bIdx, bIdx + 3).join(' ');
      var sub = /\b(?:bachelor of [a-z]+|b\.?\s?a|b\.?\s?sc|b\.?\s?com|b\.?\s?tech|b\.?\s?e|bba|bbm|bca|ll\.?\s?b|b\.?\s?ed|bsw)(?![a-z])\.?\s*(?:\(\s*hons?\.?\s*\))?\s*(?:hons\.?)?\s*(?:in|[-–:,(])?\s*([A-Za-z][A-Za-z&]*(?:\s+[A-Za-z&]+){0,4})/i.exec(scan[bIdx]);
      if (sub) { var sj = sub[1].replace(/\s+(College|University|Institute|School|Academy).*$/i, '').trim(); if (sj.length >= 3 && !/^(College|University|Institute|School)$/i.test(sj) && sj.length <= 60) out.specialisation = sj; }
      var col = findCollege(near, opts.colleges);
      if (col) out.institution = col;
      else { var ins = /([A-Z][\w.'’&-]*(?:\s+[A-Za-z][\w.'’&-]*){0,6}\s+(?:College|University|Institute|Academy)(?:\s*,?\s*[A-Z][\w.'’&-]*(?:\s+[A-Z][\w.'’&-]*){0,3})?)/.exec(near); if (ins) out.institution = ins[1].trim(); }
      var yr = /((?:19|20)\d\d)\s*(?:[-–—]|to)\s*((?:19|20)\d\d|present|ongoing|current|pursuing)/i.exec(near) || /(?:expected|pursuing|graduat\w+|passed|completed|year of passing)[^\d]{0,15}((?:19|20)\d\d)/i.exec(near);
      var endYear = yr ? (yr[2] && /^\d/.test(yr[2]) ? +yr[2] : (yr[2] ? '' : +yr[1])) : '';   // "2023 – Present" gives no year
      var ongoing = /present|ongoing|current|pursuing|expected|final year/i.test(near) || (yr && yr[2] && /[a-z]/i.test(yr[2]));
      if (endYear) out.completionYear = String(endYear);
      out.qual = hasMasters ? "Master's Degree" : ongoing ? "Bachelor's Degree (final year – results pending)" : "Bachelor's Degree (completed)";
    }
    return out;
  }

  var api = { extractLocal: extractLocal, parseDate: parseDate, findCollege: findCollege };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  w.DCIPCv = api;

  /* --------------------------- reading the file (browser only) --------------------------- */
  var libs = {};
  /** Libraries are embedded in the page as inert <script type="text/plain"> blocks (or fetched in development) and only started when a CV is chosen. */
  function loadLib(id) {
    if (libs[id]) return libs[id];
    var el = document.getElementById('lib-' + id);
    libs[id] = (el && el.textContent.trim().length > 50 ? Promise.resolve(el.textContent) : el && el.dataset.src ? fetch(el.dataset.src).then(function (r) { return r.text(); }) : Promise.reject(new Error('Reader not available')))
      .then(function (code) { return URL.createObjectURL(new Blob([code], { type: 'text/javascript' })); });
    return libs[id];
  }
  function runScript(id) {
    return loadLib(id).then(function (url) { return new Promise(function (res, rej) { var s = document.createElement('script'); s.src = url; s.onload = res; s.onerror = function () { rej(new Error('Could not start the reader')); }; document.head.appendChild(s); }); });
  }

  function pdfText(file) {
    return Promise.all([runScript('pdfjs'), loadLib('pdfworker')]).then(function (r) {
      w.pdfjsLib.GlobalWorkerOptions.workerSrc = r[1];
      return file.arrayBuffer();
    }).then(function (buf) { return w.pdfjsLib.getDocument({ data: buf }).promise; }).then(function (pdf) {
      var pages = [], n = Math.min(pdf.numPages, 4);
      function page(i) {
        return pdf.getPage(i).then(function (p) { return p.getTextContent(); }).then(function (tc) {
          var out = '', lastY = null;
          tc.items.forEach(function (it) { var y = it.transform ? Math.round(it.transform[5]) : 0; if (lastY !== null && Math.abs(y - lastY) > 3) out += '\n'; else if (out && !/\s$/.test(out)) out += ' '; out += it.str; lastY = y; if (it.hasEOL) { out += '\n'; lastY = null; } });
          pages.push(out);
        });
      }
      var chain = Promise.resolve(); for (var i = 1; i <= n; i++) (function (i) { chain = chain.then(function () { return page(i); }); })(i);
      return chain.then(function () { return pages.join('\n'); });
    });
  }
  function docxText(file) {
    return runScript('jszip').then(function () { return file.arrayBuffer(); }).then(function (buf) { return w.JSZip.loadAsync(buf); }).then(function (zip) {
      var f = zip.file('word/document.xml'); if (!f) throw new Error('Not a Word document');
      return f.async('string');
    }).then(function (xml) {
      return xml.replace(/<\/w:p>/g, '\n').replace(/<w:tab\/>/g, ' ').replace(/<w:br[^>]*\/>/g, '\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
    });
  }
  function readText(file) {
    var ext = (file.name.split('.').pop() || '').toLowerCase();
    if (ext === 'pdf') return pdfText(file);
    if (ext === 'docx') return docxText(file);
    return Promise.reject(new Error('This file type cannot be read automatically'));
  }

  /**
   * Reads a CV file and resolves to { fields, text, source: 'ai'|'basic' }. Never rejects for unreadable files: it resolves with empty fields.
   * ctx: { districts, colleges, today, ai: boolean, askServer: function(text) → Promise<{ai, fields}> }
   */
  w.DCIPCv.read = function (file, ctx) {
    return readText(file).then(function (text) {
      text = String(text || '').trim();
      if (text.length < 30) return { fields: {}, text: text, source: 'none' };
      var local = extractLocal(text, ctx);
      if (!ctx.ai || !ctx.askServer) return { fields: local, text: text, source: 'basic' };
      return ctx.askServer(text).then(function (r) {
        if (!r || !r.ai) return { fields: local, text: text, source: 'basic' };
        var merged = {}; Object.keys(local).forEach(function (k) { merged[k] = local[k]; }); Object.keys(r.fields).forEach(function (k) { if (r.fields[k]) merged[k] = r.fields[k]; });
        return { fields: merged, text: text, source: 'ai' };
      }, function () { return { fields: local, text: text, source: 'basic' }; });
    }, function () { return { fields: {}, text: '', source: 'none' }; });
  };
})(typeof window !== 'undefined' ? window : this);
