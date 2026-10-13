/* CV auto-fill: read the uploaded CV in the browser (PDF / DOCX), pull out the details we can recognise,
 * and (optionally) let the server's AI refine them. Nothing here is stored; the applicant checks every value. */
(function (w) {
  'use strict';

  /* ------------------------------ detail extraction (pure) ------------------------------ */
  var QUAL_B = "Bachelor's Degree (completed)", QUAL_BP = "Bachelor's Degree (final year – results pending)", QUAL_M = "Master's Degree (completed)";
  var MONTHS = { jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12 };
  var MONTH_RE = '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
  var DISTRICT_ALIASES = { 'Kozhikode': ['kozhikode', 'calicut'], 'Thiruvananthapuram': ['thiruvananthapuram', 'trivandrum'], 'Ernakulam': ['ernakulam', 'kochi', 'cochin'], 'Thrissur': ['thrissur', 'trichur'],
    'Kollam': ['kollam', 'quilon'], 'Pathanamthitta': ['pathanamthitta'], 'Alappuzha': ['alappuzha', 'alleppey'], 'Kottayam': ['kottayam'], 'Idukki': ['idukki'], 'Palakkad': ['palakkad', 'palghat'],
    'Malappuram': ['malappuram'], 'Wayanad': ['wayanad'], 'Kannur': ['kannur', 'cannanore'], 'Kasaragod': ['kasaragod', 'kasargod'] };
  var STATE_ALIASES = { 'Karnataka': ['karnataka', 'bengaluru', 'bangalore', 'mysuru', 'mysore', 'mangaluru', 'mangalore', 'hubballi', 'belagavi'], 'Tamil Nadu': ['tamil nadu', 'tamilnadu', 'chennai', 'coimbatore', 'madurai', 'tiruchirappalli', 'trichy', 'nilgiris', 'ooty'],
    'Delhi': ['new delhi', 'delhi'], 'Maharashtra': ['maharashtra', 'mumbai', 'pune', 'nagpur', 'thane'], 'Telangana': ['telangana', 'hyderabad', 'secunderabad'], 'Andhra Pradesh': ['andhra pradesh', 'vijayawada', 'visakhapatnam', 'guntur', 'tirupati'],
    'West Bengal': ['west bengal', 'kolkata', 'calcutta'], 'Gujarat': ['gujarat', 'ahmedabad', 'surat', 'vadodara'], 'Uttar Pradesh': ['uttar pradesh', 'lucknow', 'noida', 'kanpur', 'varanasi', 'ghaziabad'], 'Rajasthan': ['rajasthan', 'jaipur', 'jodhpur', 'udaipur'],
    'Haryana': ['haryana', 'gurugram', 'gurgaon', 'faridabad'], 'Punjab': ['punjab', 'ludhiana', 'amritsar'], 'Madhya Pradesh': ['madhya pradesh', 'bhopal', 'indore'], 'Bihar': ['bihar', 'patna'], 'Odisha': ['odisha', 'orissa', 'bhubaneswar'],
    'Assam': ['assam', 'guwahati'], 'Goa': ['panaji', 'goa'], 'Jammu and Kashmir': ['jammu', 'kashmir', 'srinagar'], 'Chandigarh': ['chandigarh'], 'Puducherry': ['puducherry', 'pondicherry'], 'Lakshadweep': ['lakshadweep', 'kavaratti'],
    'Uttarakhand': ['uttarakhand', 'dehradun'], 'Jharkhand': ['jharkhand', 'ranchi'], 'Chhattisgarh': ['chhattisgarh', 'raipur'], 'Himachal Pradesh': ['himachal', 'shimla'], 'Outside India': ['dubai', 'abu dhabi', 'sharjah', 'saudi', 'riyadh', 'doha', 'qatar', 'kuwait', 'oman', 'muscat', 'bahrain', 'u.a.e', 'uae', 'united kingdom', 'usa', 'canada', 'australia'] };

  /* bachelor's streams: abbreviations are matched case-sensitively so ordinary words ("be", "ba") are never mistaken for a degree */
  var B_STREAMS = [
    ['B.Sc', /\bB\.?\s?Sc\.?\s?\(?\s?(?:Hons\.?\s*\)?\s*)?\s*Nursing\b/, 'MBBS / BDS / Nursing'], ['MBBS / BDS / Nursing', /\b(?:MBBS|BDS|BAMS|BHMS|BUMS)\b|\bbachelor of (?:medicine|dental)/i],
    ['B.Pharm', /\bB\.?\s?Pharm\b|\bbachelor of pharmacy\b/i], ['B.Arch', /\bB\.?\s?Arch\b|\bbachelor of architecture\b/i],
    ['LL.B', /\b(?:B\.?\s?A\.?\s?)?LL\.?\s?B\b|\bbachelor of laws?\b/], ['B.Tech / B.E', /\bB\.?\s?Tech\b|\bBTECH\b|\bB\.\s?E\b\.?|\bBE\b|\bbachelor of (?:technology|engineering)\b/i],
    ['BBA / BBM', /\b(?:BBA|BBM|BBS)\b|\bbachelor of business (?:administration|management|studies)\b/i], ['BCA', /\bBCA\b|\bbachelor of computer applications?\b/i],
    ['B.Com', /\bB\.\s?Com\b|\bBCom\b|\bB\.?COM\b|\bbachelor of commerce\b/i], ['B.Sc', /\bB\.\s?Sc\b|\bBSc\b|\bB\.?SC\b|\bbachelor of science\b/i],
    ['B.Ed', /\bB\.\s?Ed\b|\bBEd\b|\bbachelor of education\b/i], ['B.Voc', /\bB\.?\s?Voc\b|\bbachelor of vocation/i], ['BSW', /\bBSW\b|\bbachelor of social work\b/i],
    ['B.A', /\bB\.\s?A\b|\bBA\b|\bbachelor(?:'s)? (?:of|in) arts\b/i]
  ];
  var B_OTHER = /\bbachelor(?:'s)?\s+(?:of|in)\s+([A-Za-z&]+(?:\s+[A-Za-z&]+){0,3})|\b(BFA|B\.?\s?Des|BHM|BPEd|B\.?\s?P\.?\s?Ed|BMS|BSS|BJMC|BMM|BTTM|BHMCT)\b/;
  var M_PATTERN = /\bM\.\s?(?:A|Sc|Com|Tech|Ed|Phil|SW|Arch|Pharm|Des|Voc)\b|\b(?:MA|MSc|MCom|MBA|MCA|MSW|MTech|MEd|MPhil|MPA|LLM|LL\.M|MS|MFA|MDes|MHRM|MLIS)\b|\bmaster(?:'s)?\s+(?:of|in|degree)\b|\bpost[- ]?graduat(?:e|ion)\b|\bPG\s+(?:in|degree|diploma)\b/;
  var PLUS_TWO = /\b(?:plus\s*two|\+2|higher\s+secondary|hsc|12th|xii|sslc|10th|class\s*x|cbse|icse|vhse|schooling)\b/i;
  var HEADING = /^[\s#•▪●■◆\-_=*|]*(personal\s*(?:details|information|profile|data|particulars)|contact(?:\s*(?:details|information|me|info))?|education(?:al)?(?:\s*(?:qualifications?|background|details|history))?|academics?(?:\s*(?:qualifications?|background|details|profile))?|academic\s*(?:qualifications?|background|details|profile)|qualifications?|work\s*experience|professional\s*experience|experience|employment(?:\s*history)?|internships?|projects?|(?:technical\s*|key\s*|core\s*|soft\s*)?skills?|achievements?|awards?(?:\s*(?:and|&)\s*honou?rs)?|certifications?|courses?|languages?(?:\s*known)?|hobbies|interests|references?|referees?|declaration|extra[\s-]*curricular(?:\s*activities)?|volunteer(?:ing)?(?:\s*experience)?|summary|(?:career\s*)?objective|profile(?:\s*summary)?|about\s*me|positions?\s*of\s*responsibility|publications?|activities)[\s:\-_=*|]*$/i;
  var NOT_NAME = /resume|curriculum|vitae|\bcv\b|profile|contact|e-?mail|phone|mobile|address|objective|summary|education|experience|skills?\b|references?|declaration|personal|details|bio-?data|career|internship|programme|project|engineer|developer|manager|student|intern\b|analyst|executive|officer|assistant|designer|teacher|college|university|school|institute|kerala|india\b|road|street|nagar|house|post\b|district|calicut|kozhikode|bachelor|master|degree|science|arts\b|commerce|technology|administration|management|economics|english|history|physics|chemistry|mathematics|computer|social\b|work\b|volunteer|leadership|communication|languages?|hobbies|interests|achievements?|awards?|certificat|date of|birth|gender|nationality|marital|father|mother|guardian|hereby|signature|place\b|page\b|linkedin|github/i;

  function pad(n) { return ('0' + n).slice(-2); }
  function validDate(y, m, d) { var x = new Date(Date.UTC(y, m - 1, d)); return y >= 1950 && x.getUTCFullYear() === y && x.getUTCMonth() === m - 1 && x.getUTCDate() === d; }
  function iso(y, m, d) { return validDate(y, m, d) ? y + '-' + pad(m) + '-' + pad(d) : ''; }
  function parseDate(s, today) {
    s = String(s || '').trim(); var m, r = '';
    if ((m = /(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/.exec(s))) r = iso(+m[1], +m[2], +m[3]);
    else if ((m = /(\d{1,2})[-\/.\s](\d{1,2})[-\/.\s](\d{4})/.exec(s))) r = iso(+m[3], +m[2], +m[1]);                       // Indian order: dd/mm/yyyy
    else if ((m = /(\d{1,2})(?:st|nd|rd|th)?[\s,.-]+([A-Za-z]{3,9})\.?[\s,.-]+(\d{4})/.exec(s)) && MONTHS[m[2].toLowerCase()]) r = iso(+m[3], MONTHS[m[2].toLowerCase()], +m[1]);
    else if ((m = /([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/.exec(s)) && MONTHS[m[1].toLowerCase()]) r = iso(+m[3], MONTHS[m[1].toLowerCase()], +m[2]);
    else if ((m = /(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2})(?!\d)/.exec(s))) { var cur = today ? +today.slice(2, 4) : 26, yy = +m[3]; r = iso(yy <= cur ? 2000 + yy : 1900 + yy, +m[2], +m[1]); }
    if (r && today) { var age = +today.slice(0, 4) - +r.slice(0, 4); if (age < 16 || age > 60) r = ''; }
    return r;
  }
  function titleCase(s) { return (/[a-z]/.test(s) && !/^[a-z]/.test(s) ? s : s.toLowerCase().replace(/(^|[\s.'-])([a-z])/g, function (x, a, b) { return a + b.toUpperCase(); })).replace(/\s+/g, ' ').trim(); }
  function normWords(s) { return String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim(); }
  function escRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

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
      var head = ' ' + normWords(c.split(',')[0]) + ' ';
      if (['university', 'college', 'institute'].some(function (g) { return head.indexOf(' ' + g + ' ') >= 0 && t.indexOf(' ' + g) < 0; })) return;
      var frac = all.filter(function (x) { return t.indexOf(' ' + x) >= 0; }).length / all.length;
      if (frac < 0.6) return;
      var key = frac * 100 + all.length;
      if (key > bestKey) { best = c.split('|')[0]; bestKey = key; }
    });
    return best;
  }
  /** Local body (panchayat / municipality) named in an address: the longest listed name (or alternative spelling) found as whole words. */
  function findBody(text, bodies) {
    var t = ' ' + normWords(text) + ' ', best = null, len = 0;
    (bodies || []).forEach(function (e) {
      var names = e.split('|'); names.forEach(function (n) {
        var k = normWords(n.replace(/\b(panchayat|municipality|corporation)\b/ig, '')); if (!k || !/panchayat|municipal|corporation/i.test(n) && k.length < 4) return;
        if (/corporation/i.test(n) && !/corporation/i.test(text)) return;
        if (t.indexOf(' ' + k + ' ') >= 0 && k.length > len) { best = names[0]; len = k.length; }
      });
    });
    return best;
  }

  function sections(lines) {
    var heads = []; lines.forEach(function (l, i) { if (l === '\u0001') heads.push({ i: i, name: 'break' }); else if (l.length <= 40 && HEADING.test(l)) heads.push({ i: i, name: HEADING.exec(l)[1].toLowerCase().replace(/\s+/g, ' ') }); });
    return heads;
  }
  function sectionRange(lines, heads, test) {
    for (var h = 0; h < heads.length; h++) if (test(heads[h].name)) return { start: heads[h].i + 1, end: h + 1 < heads.length ? heads[h + 1].i : lines.length };
    return null;
  }
  function wordsOf(l) { return l.split(/\s+/).filter(Boolean); }
  function nameLike(l) {
    if (!l || l.length < 3 || l.length > 50 || /[\d@:\/\\|_]/.test(l) || !/^[A-Za-z][A-Za-z .'’-]+$/.test(l) || NOT_NAME.test(l)) return false;
    var w = wordsOf(l); if (w.length < 2 || w.length > 5) return false;
    var up = w.filter(function (x) { return /^[A-Z]/.test(x); }).length; return up / w.length >= 0.6 || l === l.toUpperCase();
  }
  function emailTokens(email) { return String(email || '').split('@')[0].toLowerCase().replace(/\d+/g, ' ').split(/[._\-\s]+/).filter(function (x) { return x.length >= 3; }); }

  function degreeOn(line) {
    var l = line.replace(/\s+/g, ' ');
    if (M_PATTERN.test(l) && !/\bbachelor\b/i.test(l) && !B_STREAMS.some(function (b) { return b[1].test(l) && /\b(?:BA|B\.A|BSc|B\.Sc|BCom|B\.Com|BTech|B\.Tech|BBA|BCA)\b/.test(l); })) return { level: 'M', line: l };
    for (var i = 0; i < B_STREAMS.length; i++) if (B_STREAMS[i][1].test(l)) return { level: 'B', stream: B_STREAMS[i][2] || B_STREAMS[i][0], match: B_STREAMS[i][1].exec(l), line: l };
    var o = B_OTHER.exec(l); if (o) return { level: 'B', stream: 'Other', other: (o[1] ? 'Bachelor of ' + o[1] : o[2]).trim(), match: o, line: l };
    return null;
  }
  /** The end of a study period in a few lines of text: { y, m, ongoing } */
  function periodEnd(text, todayY, todayM) {
    var t = text.replace(/\s+/g, ' '), m, y = 0, mo = 0, ongoing = false;
    var rng = new RegExp('((?:' + MONTH_RE + '\\.?,?\\s+)?(?:19|20)\\d\\d)\\s*(?:[-–—]|to|till|until)\\s*((?:' + MONTH_RE + '\\.?,?\\s+)?(?:19|20)\\d\\d|\\d\\d(?!\\d)|present|ongoing|current(?:ly)?|pursuing|continuing)', 'i');
    if ((m = rng.exec(t))) {
      var e = m[2];
      if (/^(present|ongoing|current|pursuing|continuing)/i.test(e)) ongoing = true;
      else {
        var ym = /((?:19|20)\d\d)/.exec(e), mm = new RegExp('(' + MONTH_RE + ')', 'i').exec(e);
        if (ym) y = +ym[1]; else if (/^\d\d$/.test(e)) y = 2000 + +e;
        if (mm) mo = MONTHS[mm[1].toLowerCase().slice(0, 3)] || 0;
      }
    } else {
      var one = new RegExp('(?:expected|pursuing|graduat\\w*|passed(?:\\s*out)?|completed|year\\s+of\\s+(?:passing|completion)|class\\s+of|batch|completion)[^\\d]{0,24}?((?:' + MONTH_RE + '\\.?,?\\s+)?(?:19|20)\\d\\d)', 'i').exec(t) || /\(\s*((?:19|20)\d\d)\s*\)/.exec(t);
      if (one) { var y2 = /((?:19|20)\d\d)/.exec(one[1]); y = +y2[1]; var m2 = new RegExp('(' + MONTH_RE + ')', 'i').exec(one[1]); if (m2) mo = MONTHS[m2[1].toLowerCase().slice(0, 3)] || 0; }
    }
    if (/\b(expected|pursuing|final\s*year|currently|ongoing|\d(?:st|nd|rd|th)\s*(?:year|sem)|semester)\b/i.test(t)) ongoing = true;
    if (y && todayY && (y > todayY || (y === todayY && mo && todayM && mo > todayM))) ongoing = true;
    return { y: y, m: mo, ongoing: ongoing };
  }
  var ACR = /\b((?:NIT|IIT|IIM|IISER|NIFT|NLU|IIIT|BITS|NLSIU|IIFT|TISS|JNU|BHU|AMU|DU)\s*,?\s*[A-Z][A-Za-z]+)/;
  var INS = /([A-Z][\w.'’&-]*(?:\s+[A-Za-z][\w.'’&-]*){0,6}\s+(?:College|University|Institute|Academy|Campus)(?:\s*,?\s*[A-Z][\w.'’&-]*(?:\s+[A-Z][\w.'’&-]*){0,3})?)/;
  function findInstitution(text, colleges) {
    var c = findCollege(text, colleges); if (c) return c;
    var m = INS.exec(text); if (m) return m[1].trim();
    m = ACR.exec(text); return m ? m[1].replace(/\s*,\s*/, ' ') : '';
  }
  function subjectAfter(line, endAt) {
    var rest = line.slice(endAt).replace(/^[\s.]*(?:\(?\s*hons?\.?\s*\)?)?\s*(?:degree)?\s*(?:in|of|[-–—:,(|])+\s*/i, '');
    rest = rest.replace(/^(?:hons?\.?\s*(?:in)?\s*)/i, '');
    var cut = rest.split(/\s*(?:[|,;(]|\s[-–—]\s|\s{2,}|\b(?:college|university|institute|institution|school|campus|vidyapeetham|vidyalaya|mahavidyalaya|polytechnic|cgpa|gpa|grade|percentage|marks|from|at|affiliated|with|under)\b|\d{2,}|%)/i)[0].trim();
    cut = cut.replace(/[.\-–—:)\s]+$/, '').trim();
    var w = wordsOf(cut); if (w.length > 5) cut = w.slice(0, 5).join(' ');
    return cut.length >= 3 && cut.length <= 60 && /^[A-Za-z][A-Za-z &.'-]+$/.test(cut) && !/^(of|in|the|and|degree|bachelor|master|science|arts)$/i.test(cut) ? cut : '';
  }

  /**
   * text → { fullName, dob, gender, email, mobile, altMobile, district, state, localBody, qual, stream, streamOther, specialisation, institution, mastersInstitution, completionYM, completionYear }
   * Only fields that were recognised are present. opts: { districts, colleges, localBodies, today, big }
   */
  function extractLocal(text, opts) {
    opts = opts || {}; var out = {}, raw = String(text || '').replace(/\r/g, '\n').replace(/ /g, ' ').replace(/[\u200b\u00ad]/g, '');
    var lines = raw.split('\n').map(function (l) { return l.replace(/[ \t]{2,}/g, '  ').replace(/^[•▪●■◆►➢❖\-*·]+\s*/, '').trim(); }).filter(Boolean), flat = lines.join('\n');
    if (!flat) return out;
    var today = opts.today || '', tY = today ? +today.slice(0, 4) : new Date().getFullYear(), tM = today ? +today.slice(5, 7) : new Date().getMonth() + 1;
    var heads = sections(lines), refR = sectionRange(lines, heads, function (n) { return /^(references?|referees?)$/.test(n); });
    var limit = lines.length;
    var main = refR ? lines.filter(function (l, i) { return i < refR.start - 1 || i >= Math.min(refR.end, refR.start + 9); }) : lines;   // referees' details are left out

    /* e-mail: labelled or near the top, never a referee's */
    var emails = [];
    main.forEach(function (l, i) { var re = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, m; while ((m = re.exec(l))) { if (/^(example|yourname|name|email|abc|xyz)@/i.test(m[0])) continue; emails.push({ v: m[0].toLowerCase().replace(/\.$/, ''), r: (/e-?mail|mail\s*id/i.test(l) ? 3 : 0) + (i < 15 ? 2 : 0) + 1 - (/\b(?:dr|prof|mr|mrs|ms|hod|principal|director|supervisor|guide|referee)\b\.?/i.test(l) ? 4 : 0), i: i }); } });
    emails.sort(function (a, b) { return b.r - a.r || a.i - b.i; });
    if (emails[0]) out.email = emails[0].v;

    /* phones: a mobile number is never an ID, PIN or year; labelled numbers and the header come first */
    var phones = [];
    main.forEach(function (l, i) {
      if (/aadhaar|aadhar|pin\s*code|pincode|passport|reg(?:ister)?\.?\s*(?:no|number)|roll\s*no|uan|pan\b|licen[cs]e/i.test(l)) return;
      var re = /(?:\+?\s*91[\s.\-]*)?\(?([6-9](?:[\s.\-]?\d){9})(?!\d)(?![\s.\-]\d{3})/g, m;
      while ((m = re.exec(l))) {
        var before = l.charAt(m.index - 1); if (/\d/.test(before || '')) continue;
        var d = m[1].replace(/\D/g, ''); if (d.length !== 10 || phones.some(function (p) { return p.v === d; })) continue;
        var alt = /alt(?:ernate|ernative)?|secondary|other|emergency|parent|father|mother|guardian|home/i.test(l.slice(Math.max(0, m.index - 24), m.index));
        phones.push({ v: d, r: (/mobile|phone|\bph\b|\bph:|tel|cell|whats\s?app|contact|call|\bmob\b/i.test(l) ? 3 : 0) + (i < 15 ? 2 : 0) + 1 - (alt ? 2 : 0) - (/\b(?:dr|prof|mr|mrs|ms|hod|principal|director|supervisor|guide|referee)\b\.?/i.test(l) ? 4 : 0), i: i, alt: alt });
      }
    });
    var prime = phones.filter(function (p) { return !p.alt; }).sort(function (a, b) { return b.r - a.r || a.i - b.i; });
    if (prime[0]) out.mobile = prime[0].v;
    var other = phones.filter(function (p) { return p.v !== out.mobile; }).sort(function (a, b) { return b.r - a.r || a.i - b.i; });
    if (other[0] && other[0].r >= 3) out.altMobile = other[0].v;

    /* date of birth: only after a label (the value may be on the next line) */
    for (var i = 0; i < main.length; i++) {
      var dm = /(?:d\.?\s?o\.?\s?b\.?|date\s+of\s+birth|birth\s*date|born(?:\s+on)?|birthday)\s*[:\-–|]?\s*(.*)$/i.exec(main[i]);
      if (!dm) continue;
      var dd = parseDate(dm[1], today) || parseDate((main[i + 1] || ''), today);
      if (dd) { out.dob = dd; break; }
    }

    var g = /\b(?:gender|sex)\s*[:\-–|]?\s*(female|male|transgender|other|f|m)\b/i.exec(main.join('\n'));
    if (g) { var gv = g[1].toLowerCase(); out.gender = gv === 'f' || gv === 'female' ? 'Female' : gv === 'm' || gv === 'male' ? 'Male' : 'Other'; }
    else { var ps = sectionRange(lines, heads, function (n) { return /personal/.test(n); }); if (ps) lines.slice(ps.start, Math.min(ps.end, ps.start + 12)).forEach(function (l) { if (!out.gender && /^(female|male)$/i.test(l)) out.gender = l[0].toUpperCase() + l.slice(1).toLowerCase(); }); }

    /* name: a "Name:" label, the largest text of the page, or a name-like line near the top that matches the e-mail address */
    var nm = null;
    for (var n = 0; n < Math.min(main.length, 40) && !nm; n++) {
      var lab = /^(?:[A-Za-z ]{0,25}\s{2,})?(?:(?:full|candidate'?s?|applicant'?s?)\s+)?name\s*(?:[:\-–|]|\s{2,})\s*(.+)$/i.exec(main[n]);
      if (lab) { var cand = lab[1].replace(/\s{2,}.*$/, '').trim(); if (/^[A-Za-z][A-Za-z .'’-]{2,50}$/.test(cand) && wordsOf(cand).length >= 1 && !NOT_NAME.test(cand)) nm = cand; }
    }
    if (!nm) {
      var toks = emailTokens(out.email), cands = [];
      if (opts.big && nameLike(String(opts.big).trim())) cands.push({ v: String(opts.big).trim(), s: 3 });
      for (var q = 0; q < Math.min(main.length, 14); q++) main[q].split(/\s{2,}|\s\|\s/).forEach(function (seg) { seg = seg.trim(); if (nameLike(seg)) cands.push({ v: seg, s: q < 3 ? 2 : 1 }); });
      cands.forEach(function (c) { var lc = c.v.toLowerCase(); toks.forEach(function (t) { if (lc.indexOf(t) >= 0 || t.indexOf(lc.replace(/[^a-z]/g, '').slice(0, 5)) === 0) c.s += 3; }); });
      cands.sort(function (a, b) { return b.s - a.s; });
      if (cands[0]) nm = cands[0].v;
    }
    if (nm) out.fullName = titleCase(nm);

    /* address: lines that follow an address label, or the contact block at the top. A college's town is never used. */
    var addr = [];
    main.forEach(function (l, idx) {
      if (/\b(address|permanent|present\s+addr|residen|native|hometown|home\s*town|place\s+of\s+(?:residence|stay)|location)\b/i.test(l) && !/e-?mail|website|college|university|office\s+address/i.test(l.replace(/^[^:]*$/, '')))
        addr.push(/^[A-Za-z ]{0,25}(address|location)\s*:?\s*$/i.test(l) ? main.slice(idx, idx + 4).join(' ') : l + ' ' + (main[idx + 1] && !HEADING.test(main[idx + 1]) && !/:/.test(main[idx + 1]) ? main[idx + 1] : ''));
    });
    if (!addr.length) main.slice(0, 16).forEach(function (l, idx) { if (/\b[1-9]\d{5}\b|\bkerala\b|\bpin\b/i.test(l) && !/college|university|school/i.test(l)) addr.push(main.slice(Math.max(0, idx - 2), idx + 1).join(' ')); });
    var addrText = addr.join(' ').toLowerCase(), bestAt = -1;
    Object.keys(DISTRICT_ALIASES).forEach(function (dist) {
      DISTRICT_ALIASES[dist].forEach(function (a) { var at = addrText.search(new RegExp('\\b' + a + '\\b')); if (at >= 0 && (bestAt < 0 || at < bestAt)) { bestAt = at; out.district = dist; } });
    });
    if (!out.district && addrText && !/\bkerala\b/.test(addrText)) {
      var st = null, stAt = -1; Object.keys(STATE_ALIASES).forEach(function (S) { STATE_ALIASES[S].forEach(function (a) { var at = addrText.search(new RegExp('\\b' + escRe(a) + '\\b')); if (at >= 0 && (stAt < 0 || at < stAt)) { stAt = at; st = S; } }); });
      if (st) { out.district = 'Outside Kerala'; out.state = st; }
    }
    if (out.district === 'Kozhikode') { var lb = findBody(addrText, opts.localBodies); if (lb) out.localBody = lb; }

    /* education: the bachelor's entry (first in the education section, else anywhere before the referees) */
    var edu = sectionRange(lines, heads, function (n) { return /education|academic|qualification/.test(n); });
    var scan = edu ? lines.slice(edu.start, edu.end).filter(function (l) { return main.indexOf(l) >= 0; }) : main;
    if (scan.length < 2) scan = main;
    var entries = []; scan.forEach(function (l, idx) { var dg = degreeOn(l); if (dg && !PLUS_TWO.test(l.replace(/b\.?\s?(?:sc|a|com)/ig, ''))) { dg.idx = idx; entries.push(dg); } });
    var bach = entries.filter(function (e) { return e.level === 'B'; })[0], mast = entries.filter(function (e) { return e.level === 'M'; })[0];
    function windowFor(e) {
      var next = entries.filter(function (x) { return x.idx > e.idx; })[0], stop = next ? next.idx : e.idx + 4;
      return scan.slice(Math.max(0, e.idx - 1 === (entries.filter(function (x) { return x.idx < e.idx; }).slice(-1)[0] || { idx: -9 }).idx ? e.idx : e.idx - 1), Math.min(stop, e.idx + 4));
    }
    var mEnd = null;
    if (mast) {
      var mw = windowFor(mast).join(' '); mEnd = periodEnd(mw, tY, tM);
      var mc = findInstitution(mw, opts.colleges);
      if (mc && !mEnd.ongoing) out.mastersInstitution = mc;
    }
    if (bach) {
      out.stream = bach.stream; if (bach.other) out.streamOther = bach.other;
      var win = windowFor(bach), wtext = win.join(' '), end = bach.match ? bach.match.index + bach.match[0].length : 0;
      var sub = bach.other ? '' : subjectAfter(bach.line, end);
      if (!sub) { for (var w = 0; w < win.length && !sub; w++) { var sl = /(?:specialisation|specialization|major|subject|branch|discipline|stream|course)\s*[:\-–]\s*([A-Za-z][A-Za-z &.'-]{2,60})/i.exec(win[w]); if (sl) sub = sl[1].replace(/\s+(college|university).*$/i, '').trim(); } }
      var col = findInstitution(wtext, opts.colleges);
      if (col) out.institution = col;
      if (sub && /^(?:BCA|BBA \/ BBM|LL\.B|B\.Ed|BSW)$/.test(bach.stream) && /^(?:computer applications?|business|law|education|social work)$/i.test(sub)) sub = sub;
      var sameLine = col && (' ' + normWords(bach.line) + ' ').indexOf(' ' + normWords(col).split(' ')[0] + ' ') >= 0;
      if (sub && col && sameLine) { var cw0 = ' ' + normWords(col) + ' ', sw0 = sub.split(' '); while (sw0.length > 1 && cw0.indexOf(' ' + normWords(sw0[sw0.length - 1]) + ' ') >= 0) sw0.pop(); sub = sw0.join(' '); }
      if (sub && col && sameLine) { var sw = normWords(sub).split(' '), cw = ' ' + normWords(col) + ' '; if (sw.filter(function (x) { return cw.indexOf(' ' + x + ' ') >= 0; }).length / sw.length >= 0.5) sub = ''; }
      if (sub && /college|university|institute|school|vidyapeetham|academy/i.test(sub)) sub = '';
      if (sub) out.specialisation = sub;
      var pe = periodEnd(wtext, tY, tM);
      if (pe.y) { out.completionYear = String(pe.y); if (pe.m) out.completionYM = pe.y + '-' + pad(pe.m); }
      var masterDone = mast && mEnd && !mEnd.ongoing;
      out.qual = masterDone ? QUAL_M : pe.ongoing ? QUAL_BP : QUAL_B;
    } else if (mast && mEnd && !mEnd.ongoing) out.qual = QUAL_M;
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
    function get(u) { return fetch(u).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); }); }
    /* the site's own copy first, then the CDNs; the whole round is repeated once before giving up */
    function fetchAny() {
      var urls = [el && el.dataset.src].concat(el && el.dataset.alt ? el.dataset.alt.split(/\s+/) : []).filter(Boolean), n = 0;
      function next() { if (n >= urls.length) return Promise.reject(new Error('Reader not available')); return get(urls[n++]).then(function (t) { if (t.length < 5000 || /^\s*</.test(t)) throw new Error('bad file'); return t; }).catch(next); }
      return next();
    }
    libs[id] = (el && el.textContent.trim().length > 50 ? Promise.resolve(el.textContent)
      : el ? fetchAny().catch(function () { return new Promise(function (r) { setTimeout(r, 1500); }).then(fetchAny); })
      : Promise.reject(new Error('Reader not available')))
      .then(function (code) { return URL.createObjectURL(new Blob([code], { type: 'text/javascript' })); });
    libs[id].catch(function () { delete libs[id]; });
    return libs[id];
  }
  function runScript(id) {
    return loadLib(id).then(function (url) { return new Promise(function (res, rej) { var s = document.createElement('script'); s.src = url; s.onload = res; s.onerror = function () { rej(new Error('Could not start the reader')); }; document.head.appendChild(s); }); });
  }

  /** Rebuilds reading order from positioned PDF text: two-column layouts are read column by column, and each line is put together left to right. */
  function layoutPage(items, width) {
    var narrow = items.filter(function (it) { return it.w < width * 0.55; }), BUCKET = 4, nb = Math.ceil(width / BUCKET), cov = new Array(nb).fill(0);
    narrow.forEach(function (it) { for (var b = Math.floor(it.x / BUCKET); b <= Math.min(nb - 1, Math.floor((it.x + it.w) / BUCKET)); b++) cov[b]++; });
    var best = null, run = null;
    for (var b = Math.floor(nb * 0.15); b <= Math.ceil(nb * 0.85); b++) {
      if (cov[b] === 0) { if (!run) run = { s: b, e: b }; run.e = b; } else { if (run && (!best || run.e - run.s > best.e - best.s)) best = run; run = null; }
    }
    if (run && (!best || run.e - run.s > best.e - best.s)) best = run;
    var cols = [items];
    if (best && best.e - best.s >= 2) {
      var cut = ((best.s + best.e + 1) / 2) * BUCKET, left = items.filter(function (it) { return it.x < cut; }), right = items.filter(function (it) { return it.x >= cut; });
      if (left.length >= narrow.length * 0.2 && right.length >= narrow.length * 0.2) cols = [left, right];
    }
    var all = [], bigText = '', bigH = 0;
    cols.forEach(function (col) {
      var rows = [];
      col.slice().sort(function (a, b) { return b.y - a.y || a.x - b.x; }).forEach(function (it) {
        var row = rows.filter(function (r) { return Math.abs(r.y - it.y) <= Math.max(2.5, it.h * 0.4); })[0];
        if (row) row.items.push(it); else rows.push({ y: it.y, items: [it] });
      });
      rows.sort(function (a, b) { return b.y - a.y; }).forEach(function (r) {
        r.items.sort(function (a, b) { return a.x - b.x; });
        var line = '', prevEnd = null, h = 0;
        r.items.forEach(function (it) {
          if (prevEnd !== null) { var gap = it.x - prevEnd; line += gap > it.h * 0.9 ? '  ' : gap > it.h * 0.12 ? ' ' : ''; }
          line += it.s; prevEnd = it.x + it.w; h = Math.max(h, it.h);
        });
        all.push(line);
        if (h > bigH && /[A-Za-z]{3}/.test(line)) { bigH = h; bigText = line; }
      });
      all.push('\u0001');
    });
    return { text: all.join('\n'), big: bigText, bigH: bigH };
  }
  function pdfText(file) {
    return Promise.all([runScript('pdfjs'), loadLib('pdfworker')]).then(function (r) {
      w.pdfjsLib.GlobalWorkerOptions.workerSrc = r[1];
      return file.arrayBuffer();
    }).then(function (buf) { return w.pdfjsLib.getDocument({ data: buf }).promise; }).then(function (pdf) {
      var pages = [], big = '', n = Math.min(pdf.numPages, 4);
      function page(i) {
        return pdf.getPage(i).then(function (p) {
          var vw = p.getViewport({ scale: 1 }).width;
          return p.getTextContent().then(function (tc) {
            var items = tc.items.filter(function (it) { return it.str && it.str.trim(); }).map(function (it) {
              return { s: it.str, x: it.transform[4], y: it.transform[5], w: it.width || it.str.length * 4, h: Math.abs(it.transform[3]) || it.height || 10 };
            });
            var lay = layoutPage(items, vw); pages.push(lay.text);
            if (i === 1) big = lay.big;
          });
        });
      }
      var chain = Promise.resolve(); for (var i = 1; i <= n; i++) (function (i) { chain = chain.then(function () { return page(i); }); })(i);
      return chain.then(function () { return { text: pages.join('\n'), big: big }; });
    });
  }
  function docxText(file) {
    return runScript('jszip').then(function () { return file.arrayBuffer(); }).then(function (buf) { return w.JSZip.loadAsync(buf); }).then(function (zip) {
      var f = zip.file('word/document.xml'); if (!f) throw new Error('Not a Word document');
      var heads = Object.keys(zip.files).filter(function (n) { return /^word\/header\d*\.xml$/.test(n); });
      return Promise.all([f.async('string')].concat(heads.map(function (n) { return zip.file(n).async('string'); })));
    }).then(function (xmls) {
      var body = xmls[0], extra = xmls.slice(1).join('\n');
      function clean(x) { return x.replace(/<\/w:tc>/g, '  ').replace(/<\/w:tr>/g, '\n').replace(/<\/w:p>/g, '\n').replace(/<w:tab\/>/g, '  ').replace(/<w:br[^>]*\/>/g, '\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'"); }
      var big = '', bigSz = 0;
      (body.split('</w:p>').slice(0, 25)).forEach(function (p) {
        var t = clean(p).trim(), sz = Math.max.apply(null, [0].concat((p.match(/<w:sz w:val="(\d+)"/g) || []).map(function (x) { return +/(\d+)/.exec(x)[1]; })));
        if (t && sz > bigSz && /[A-Za-z]{3}/.test(t) && t.length < 60) { bigSz = sz; big = t; }
      });
      return { text: clean(extra) + '\n' + clean(body), big: big };
    });
  }
  function readText(file) {
    var ext = (file.name.split('.').pop() || '').toLowerCase();
    if (ext === 'pdf') return pdfText(file);
    if (ext === 'docx') return docxText(file);
    return Promise.reject(new Error('This file type cannot be read automatically'));
  }

  /** The AI's answer is only trusted where the CV text backs it up (it must not invent a number, address or name). */
  function verifyAi(f, text) {
    var low = text.toLowerCase(), digits = text.replace(/\D/g, ''), norm = ' ' + normWords(text) + ' ', out = {};
    Object.keys(f).forEach(function (k) {
      var v = f[k]; if (!v) return;
      if (k === 'email' && low.indexOf(String(v).toLowerCase()) < 0) return;
      if ((k === 'mobile' || k === 'altMobile') && digits.indexOf(String(v)) < 0) return;
      if (k === 'fullName' && !normWords(v).split(' ').every(function (x) { return norm.indexOf(' ' + x + ' ') >= 0; })) return;
      if (k === 'institution' || k === 'mastersInstitution') { var sig = normWords(v).split(' ').filter(function (x) { return x.length > 3; }); if (sig.length && sig.filter(function (x) { return norm.indexOf(' ' + x) >= 0; }).length / sig.length < 0.6) return; }
      if (k === 'specialisation' && !normWords(v).split(' ').every(function (x) { return norm.indexOf(' ' + x) >= 0; })) return;
      out[k] = v;
    });
    return out;
  }

  /**
   * Reads a CV file and resolves to { fields, text, source: 'ai'|'basic' }. Never rejects for unreadable files: it resolves with empty fields.
   * ctx: { districts, colleges, localBodies, today, ai: boolean, askServer: function(text) → Promise<{ai, fields}> }
   */
  /** Quietly fetches the readers in the background a few seconds after the page is up, so the first CV opens fast (skipped on data-saver connections). */
  w.DCIPCv.prefetch = function () {
    var c = navigator.connection; if (c && (c.saveData || /2g/.test(c.effectiveType || ''))) return;
    loadLib('pdfjs').catch(function () {}); loadLib('pdfworker').catch(function () {}); loadLib('jszip').catch(function () {});
  };
  w.DCIPCv.read = function (file, ctx) {
    return readText(file).then(function (res) {
      var text = String(res.text || '').trim();
      if (text.length < 30) return { fields: {}, text: text, source: 'none' };
      var local = extractLocal(text, { colleges: ctx.colleges, localBodies: ctx.localBodies, today: ctx.today, big: res.big });
      if (!ctx.ai || !ctx.askServer) return { fields: local, text: text, source: 'basic' };
      return ctx.askServer(text).then(function (r) {
        if (!r || !r.ai) return { fields: local, text: text, source: 'basic' };
        var ai = verifyAi(r.fields, text), merged = {};
        Object.keys(ai).forEach(function (k) { merged[k] = ai[k]; });
        Object.keys(local).forEach(function (k) {                       // labelled contact details found in the text beat a guess
          if (k === 'email' || k === 'mobile' || k === 'dob' || merged[k] === undefined) merged[k] = local[k];
        });
        return { fields: merged, text: text, source: 'ai' };
      }, function () { return { fields: local, text: text, source: 'basic' }; });
    }, function (e) { return { fields: {}, text: '', source: 'none', readerFailed: /Reader not available|Could not start/.test(String(e && e.message)) }; });
  };
})(typeof window !== 'undefined' ? window : this);
