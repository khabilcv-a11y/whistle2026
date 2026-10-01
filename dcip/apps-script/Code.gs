/**
 * DCIP – District Collector's Internship Programme · Registration & Selection System
 * ================================================================================
 * Google Apps Script backend (JSON API). Data lives in a Google Sheet; CVs go to a
 * private Google Drive folder. The public form and the admin portal are static pages
 * (web/) hosted on Cloudflare Pages that call this API.
 *
 *   Applications  ← one row per applicant (all columns of the registration form + management columns)
 *   Sessions      ← interview sessions (date, slot, venue, interviewer)
 *   Settings      ← intake dates, age limit, shortlist size, registration open/close …  (editable)
 *   Audit         ← every change made through the portal
 *
 *   GET  <exec-url>?api=config            → public settings for the registration form
 *   POST <exec-url>  body {fn, args:[…]}  → public functions (e-mail OTP, submit) and admin functions
 *                                            (admin functions take the session token as args[0])
 *
 * NOTE: top-level declarations use `var` so the local preview/test harness can load this file unchanged.
 */

var APP = {
  TIMEZONE: 'Asia/Kolkata',
  ID_PREFIX: 'DCIP34-',
  SHEETS: { APPS: 'Applications', SESSIONS: 'Sessions', SETTINGS: 'Settings', AUDIT: 'Audit' },
  CV_MAX_BYTES: 3 * 1024 * 1024,
  CV_EXT: ['pdf', 'doc', 'docx'],
  OTP_TTL_S: 600,            // code valid 10 min
  OTP_MAX_TRIES: 5,
  OTP_MAX_SENDS_PER_HOUR: 4,
  VERIFY_TTL_S: 3600,        // e-mail verification is valid for 1 hour
  ADMIN_TTL_S: 12 * 3600,    // admin session length
  AUDIT_LIMIT: 600
};

/** Default settings, written to the Settings sheet by setup() (only keys that are missing). */
var DEFAULT_SETTINGS = [
  ['BATCH_LABEL', '34th Batch', 'Shown on the form, e-mails and every printed sheet.'],
  ['PROGRAMME', "District Collector's Internship Programme", 'Programme name.'],
  ['REG_OPEN', 'TRUE', 'TRUE / FALSE – master switch for accepting applications.'],
  ['REG_DEADLINE', '', 'Optional. yyyy-mm-ddThh:mm (IST). Registration closes automatically after this time.'],
  ['INTAKE_START', '2026-11-01', 'First day of the internship period (yyyy-mm-dd).'],
  ['INTAKE_END', '2027-01-31', 'Last day of the internship period. The UG course must be completed on or before this date.'],
  ['MAX_AGE', '30', 'Maximum age (completed years) on AGE_AS_ON.'],
  ['MIN_AGE', '18', 'Minimum age. Mainly catches mistyped birth years. 0 = no minimum.'],
  ['AGE_AS_ON', '', 'Date on which age is calculated (yyyy-mm-dd). Blank = INTAKE_START.'],
  ['ENFORCE_AGE', 'BLOCK', 'BLOCK = the form refuses over-age applicants.  FLAG = accept, mark "Suggest Disqualify".'],
  ['ENFORCE_COMPLETION', 'BLOCK', 'BLOCK = the form refuses a UG completion date after INTAKE_END.  FLAG = accept, mark "Suggest Disqualify".'],
  ['SHORTLIST_SIZE', '30', 'Number of top-scoring applicants shortlisted for interview.'],
  ['SELECTION_SIZE', '25', 'Target number of interns in the batch.'],
  ['CV_REQUIRED', 'TRUE', 'TRUE / FALSE – is the CV upload compulsory?'],
  ['SENDER_NAME', 'DCIP Kozhikode', 'Name shown as the e-mail sender.'],
  ['CONTACT_EMAIL', '', 'Reply-to address for all e-mails (blank = the account that owns this script).'],
  ['CONTACT_PHONE', '', 'Shown in e-mails and on the form (optional).']
];

var FIELDS = [
  // ---- the registration form (same headings as the 33rd-batch form so old exports still line up) ----
  { k: 'id', h: 'App ID' },
  { k: 'submittedAt', h: 'Submitted At' },
  { k: 'fullName', h: 'Full Name' },
  { k: 'dob', h: 'Date of Birth', text: true },
  { k: 'gender', h: 'Gender' },
  { k: 'email', h: 'Email ID' },
  { k: 'mobile', h: 'Primary Mobile Number', text: true },
  { k: 'district', h: 'District of Residence' },
  { k: 'localBody', h: 'Local Body' },
  { k: 'qual', h: 'Highest Educational Qualification' },
  { k: 'stream', h: 'UG / Bachelor’s Degree Stream' },
  { k: 'specialisation', h: 'Undergraduate Specialisation / Subject' },
  { k: 'institution', h: 'Name of UG Institution' },
  { k: 'completion', h: 'UG Degree Completion Date', text: true },
  { k: 'motivation', h: 'What made you decide to apply to DCIP this year?' },
  { k: 'cv', h: 'Upload Your CV' },
  { k: 'altMobile', h: 'Alternate Mobile Number', text: true },
  { k: 'status', h: 'Selection status' },
  { k: 'remarks', h: 'Remarks' },
  { k: 'age', h: 'Age' },
  { k: 'location', h: 'Location' },
  // ---- management columns ----
  { k: 'emailVerified', h: 'Email Verified' },
  { k: 'screening', h: 'Screening' },
  { k: 'screeningNotes', h: 'Screening Notes' },
  { k: 'flagged', h: 'Flagged' },
  { k: 'flagNote', h: 'Flag Note' },
  { k: 'screenScore', h: 'Screen Score' },
  { k: 'interviewScore', h: 'Interview Score' },
  { k: 'shortlisted', h: 'Shortlisted' },
  { k: 'session', h: 'Session' },
  { k: 'attendance', h: 'Attendance' },
  { k: 'reportingTime', h: 'Reporting Time', text: true },
  { k: 'callStatus', h: 'Call Status' },
  { k: 'callNote', h: 'Call Note' },
  { k: 'docCert', h: 'Doc UG Certificate' },
  { k: 'docOther', h: 'Doc Other Documents' },
  { k: 'docRemarks', h: 'Doc Remarks' },
  { k: 'cvFileId', h: 'CV File ID' },
  { k: 'updatedAt', h: 'Updated At' },
  { k: 'updatedBy', h: 'Updated By' }
];

var SESSION_FIELDS = [
  { k: 'id', h: 'Session ID' }, { k: 'date', h: 'Date', text: true }, { k: 'slot', h: 'Slot' },
  { k: 'venue', h: 'Venue' }, { k: 'interviewer', h: 'Interviewer' }, { k: 'capacity', h: 'Capacity' }, { k: 'notes', h: 'Notes' }
];
var AUDIT_HEADERS = ['Timestamp', 'User', 'Action', 'App ID', 'Details'];

var GENDERS = ['Female', 'Male', 'Other'];
var QUALS = ["Bachelor's Degree (completed)", "Bachelor's Degree (final year – results pending)", "Master's Degree"];
var STATUSES = ['Received', 'Shortlisted', 'Selected', 'Confirmed', 'Waitlisted', 'Not Selected', 'Disqualified', 'Withdrawn'];
var DISTRICTS = ['Thiruvananthapuram', 'Kollam', 'Pathanamthitta', 'Alappuzha', 'Kottayam', 'Idukki', 'Ernakulam', 'Thrissur',
  'Palakkad', 'Malappuram', 'Kozhikode', 'Wayanad', 'Kannur', 'Kasaragod', 'Outside Kerala'];
var SCREENINGS = ['Eligible', 'Review', 'Suggest Disqualify', 'Cleared'];   // 'Cleared' = an official reviewed it and overrides the automatic result
var ADMIN_EDITABLE = ['status', 'screening', 'remarks', 'flagged', 'flagNote', 'screenScore', 'interviewScore', 'shortlisted', 'session',
  'attendance', 'reportingTime', 'callStatus', 'callNote', 'docCert', 'docOther', 'docRemarks',
  // corrections to what the applicant typed (age / location / screening are recalculated)
  'fullName', 'dob', 'gender', 'email', 'mobile', 'altMobile', 'district', 'localBody', 'qual', 'stream',
  'specialisation', 'institution', 'completion', 'motivation'];
var RESCREEN_ON = ['dob', 'district', 'localBody', 'qual', 'completion', 'mobile', 'altMobile', 'email', 'fullName'];


/* =========================================================================
 *  JSON API
 * ========================================================================= */

var PUBLIC_API = {
  sendEmailCode: sendEmailCode,
  verifyEmailCode: verifyEmailCode,
  submitApplication: submitApplication,
  adminLogin: adminLogin
};
var ADMIN_API = {   // first argument is always the session token
  ping: ping,
  getAdminState: getAdminState,
  updateApplications: updateApplications,
  shortlistTop: shortlistTop,
  assignSessions: assignSessions,
  saveSession: saveSession,
  deleteSession: deleteSession,
  rescreenAll: rescreenAll,
  saveSettings: saveSettings,
  sendEmails: sendEmails,
  resendConfirmation: resendConfirmation,
  getAudit: getAudit
};

function doGet(e) {
  var p = (e && e.parameter) || {};
  try {
    if (p.api === 'config') return json_({ ok: true, result: publicConfig_() });
    return json_({ ok: true, service: 'DCIP registration API' });
  } catch (err) {
    return json_({ ok: false, error: msg_(err) });
  }
}

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var args = Array.isArray(body.args) ? body.args : [];
    var fn = PUBLIC_API.hasOwnProperty(body.fn) ? PUBLIC_API[body.fn] : null;
    if (!fn && ADMIN_API.hasOwnProperty(body.fn)) {
      fn = ADMIN_API[body.fn];
      args[0] = adminFromToken_(args[0]);          // replaces the token with the signed-in official's name
    }
    if (!fn) throw new Error('Unknown API function: ' + body.fn);
    return json_({ ok: true, result: fn.apply(null, args) });
  } catch (err) {
    return json_({ ok: false, error: msg_(err) });
  }
}

function json_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function msg_(err) { return String(err && err.message || err); }


/* =========================================================================
 *  One-time setup (run from the Apps Script editor)
 * ========================================================================= */

function setup() {
  var ss = ss_();
  sheet_(APP.SHEETS.APPS, FIELDS);
  sheet_(APP.SHEETS.SESSIONS, SESSION_FIELDS);
  sheet_(APP.SHEETS.AUDIT, AUDIT_HEADERS);
  settingsSheet_();
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('ADMIN_PIN')) props.setProperty('ADMIN_PIN', String(100000 + Math.floor(Math.random() * 900000)));
  if (!props.getProperty('TOKEN_SECRET')) props.setProperty('TOKEN_SECRET', Utilities.getUuid() + Utilities.getUuid());
  cvFolder_();
  Logger.log('Setup complete for spreadsheet: ' + ss.getUrl());
  Logger.log('ADMIN PIN: ' + props.getProperty('ADMIN_PIN') + '   (change it under Project Settings → Script Properties → ADMIN_PIN)');
  Logger.log('CV folder: ' + cvFolder_().getUrl());
}

function resetAdminPin() {
  var pin = String(100000 + Math.floor(Math.random() * 900000));
  PropertiesService.getScriptProperties().setProperty('ADMIN_PIN', pin);
  Logger.log('New ADMIN PIN: ' + pin);
}


/* =========================================================================
 *  Public API
 * ========================================================================= */

function publicConfig_() {
  var s = settings_();
  return {
    batch: s.BATCH_LABEL, programme: s.PROGRAMME,
    open: regOpen_(s), deadline: s.REG_DEADLINE || '',
    intakeStart: s.INTAKE_START, intakeEnd: s.INTAKE_END,
    maxAge: num_(s.MAX_AGE, 30), minAge: num_(s.MIN_AGE, 0), ageAsOn: ageAsOn_(s),
    enforceAge: s.ENFORCE_AGE === 'FLAG' ? 'FLAG' : 'BLOCK',
    enforceCompletion: s.ENFORCE_COMPLETION === 'FLAG' ? 'FLAG' : 'BLOCK',
    cvRequired: truthy_(s.CV_REQUIRED), cvMaxBytes: APP.CV_MAX_BYTES, cvExt: APP.CV_EXT,
    contactEmail: s.CONTACT_EMAIL, contactPhone: s.CONTACT_PHONE,
    districts: DISTRICTS, quals: QUALS, genders: GENDERS, today: today_()
  };
}

/** Step 1 of e-mail verification: mail a 6-digit code. */
function sendEmailCode(email) {
  var s = settings_();
  if (!regOpen_(s)) throw new Error('Registration is closed.');
  email = normEmail_(email);
  if (!validEmail_(email)) throw new Error('Please enter a valid e-mail address.');
  var cache = CacheService.getScriptCache();
  var hk = hash_(email);
  var sendKey = 'otps:' + hk;
  var sends = Number(cache.get(sendKey) || 0);
  if (sends >= APP.OTP_MAX_SENDS_PER_HOUR) throw new Error('Too many codes requested for this address. Please try again in an hour.');
  var code = String(100000 + Math.floor(Math.random() * 900000));
  cache.put('otp:' + hk, hash_(code + ':' + email), APP.OTP_TTL_S);
  cache.put('otpt:' + hk, '0', APP.OTP_TTL_S);
  cache.put(sendKey, String(sends + 1), 3600);
  var html = emailShell_(s, 'Verify your e-mail',
    '<p>Your verification code for the <b>' + esc_(s.PROGRAMME) + ' – ' + esc_(s.BATCH_LABEL) + '</b> registration is:</p>' +
    '<p style="font-size:30px;letter-spacing:8px;font-weight:700;margin:18px 0">' + code + '</p>' +
    '<p>The code is valid for ' + (APP.OTP_TTL_S / 60) + ' minutes. If you did not request it, you can ignore this e-mail.</p>');
  sendMail_(s, email, 'Your DCIP verification code: ' + code, html,
    'Your DCIP verification code is ' + code + ' (valid ' + (APP.OTP_TTL_S / 60) + ' minutes).');
  return { sent: true, ttlSeconds: APP.OTP_TTL_S };
}

/** Step 2: check the code; returns a signed token the form sends with the application. */
function verifyEmailCode(email, code) {
  email = normEmail_(email);
  var cache = CacheService.getScriptCache();
  var hk = hash_(email);
  var expected = cache.get('otp:' + hk);
  if (!expected) throw new Error('That code has expired. Please request a new one.');
  var tries = Number(cache.get('otpt:' + hk) || 0) + 1;
  if (tries > APP.OTP_MAX_TRIES) { cache.remove('otp:' + hk); throw new Error('Too many wrong attempts. Please request a new code.'); }
  cache.put('otpt:' + hk, String(tries), APP.OTP_TTL_S);
  if (hash_(String(code || '').replace(/\D/g, '') + ':' + email) !== expected) throw new Error('Incorrect code. Please check and try again.');
  cache.remove('otp:' + hk);
  return { verified: true, token: sign_('v|' + email + '|' + (nowS_() + APP.VERIFY_TTL_S)) };
}

function submitApplication(p) {
  p = p || {};
  if (p.website) throw new Error('Submission rejected.');                   // honeypot field
  var s = settings_();
  if (!regOpen_(s)) throw new Error('Registration is closed.');
  var d = cleanApplication_(p, s);
  assertVerified_(p.verifyToken, d.email);

  var cvFile = null;
  if (p.cv && p.cv.data) cvFile = checkCv_(p.cv);
  else if (truthy_(s.CV_REQUIRED)) throw new Error('Please upload your CV.');

  var result = withLock_(function () {
    var sh = sheet_(APP.SHEETS.APPS, FIELDS);
    var rows = readObjects_(sh, FIELDS);
    var dup = rows.filter(function (r) { return normEmail_(r.email) === d.email; })[0];
    if (dup) throw new Error('An application with this e-mail address has already been received (reference ' + dup.id + '). Please write to us if you need to change something.');

    var scr = screen_(d, rows, s);
    var blocks = scr.issues.filter(function (i) { return i.block; });
    if (blocks.length) throw new Error(blocks.map(function (i) { return i.msg; }).join(' '));

    d.id = nextId_(rows);
    if (cvFile) {
      var f = cvFolder_().createFile(Utilities.newBlob(Utilities.base64Decode(cvFile.data), cvFile.mime, d.id + '_' + safeName_(d.fullName) + '.' + cvFile.ext));
      d.cv = f.getUrl(); d.cvFileId = f.getId();
      scr = screen_(d, rows, s);                                              // re-run now that a CV exists
    }
    d.submittedAt = nowIso_();
    d.status = 'Received';
    d.emailVerified = 'Yes';
    applyScreening_(d, scr);
    d.updatedAt = d.submittedAt; d.updatedBy = 'Applicant';
    appendRow_(sh, FIELDS, d);
    audit_('Applicant', 'SUBMIT', d.id, d.fullName + ' · ' + scr.label);
    return d;
  });

  var mailed = true;
  try { sendConfirmation_(result, s); } catch (err) { mailed = false; audit_('System', 'MAIL_FAILED', result.id, msg_(err)); }
  return { id: result.id, email: result.email, mailed: mailed };
}


/* =========================================================================
 *  Admin API
 * ========================================================================= */

function adminLogin(name, pin) {
  var cache = CacheService.getScriptCache();
  var fails = Number(cache.get('loginfail') || 0);
  if (fails >= 6) throw new Error('Too many wrong PIN attempts. Try again in 10 minutes.');
  name = clean_(name);
  var real = PropertiesService.getScriptProperties().getProperty('ADMIN_PIN');
  if (!real || String(pin) !== String(real)) {
    cache.put('loginfail', String(fails + 1), 600);
    throw new Error('Incorrect PIN.');
  }
  if (!name) throw new Error('Please enter your name (it is recorded in the audit trail).');
  cache.remove('loginfail');
  return { token: sign_('a|' + name + '|' + (nowS_() + APP.ADMIN_TTL_S)), name: name, expiresIn: APP.ADMIN_TTL_S };
}

function adminFromToken_(token) {
  var parts = verify_(token);
  if (!parts || parts[0] !== 'a' || Number(parts[2]) < nowS_()) throw new Error('SESSION_EXPIRED');
  return parts[1];
}

/** Very cheap call the portal polls every few seconds; the full state is only fetched when `stamp` changes. */
function ping(user) {
  return { stamp: PropertiesService.getScriptProperties().getProperty('LAST_CHANGE') || '0' };
}

function getAdminState(user) {
  var s = settings_();
  var quota = null;
  try { quota = MailApp.getRemainingDailyQuota(); } catch (e) { /* scope not granted */ }
  return {
    user: user, stamp: PropertiesService.getScriptProperties().getProperty('LAST_CHANGE') || '0',
    settings: s, settingsMeta: DEFAULT_SETTINGS.map(function (d) { return { key: d[0], desc: d[2] }; }), config: publicConfig_(), statuses: STATUSES,
    applications: readObjects_(sheet_(APP.SHEETS.APPS, FIELDS), FIELDS).map(publicApp_),
    sessions: readObjects_(sheet_(APP.SHEETS.SESSIONS, SESSION_FIELDS), SESSION_FIELDS),
    mailQuota: quota, cvFolder: safe_(function () { return cvFolder_().getUrl(); })
  };
}

/**
 * changes: { <field>: value } applied to every id. Only ADMIN_EDITABLE fields are accepted.
 * Setting status Shortlisted also sets Shortlisted = Yes; clearing shortlisting (status Received) clears it.
 */
function updateApplications(user, ids, changes, note) {
  ids = [].concat(ids || []);
  if (!ids.length) throw new Error('Nothing selected.');
  Object.keys(changes || {}).forEach(function (k) { if (ADMIN_EDITABLE.indexOf(k) < 0) throw new Error('Field not editable: ' + k); });
  var s = settings_();
  return withLock_(function () {
    var sh = sheet_(APP.SHEETS.APPS, FIELDS);
    var rows = readObjects_(sh, FIELDS);
    var changed = 0, out = [];
    ids.forEach(function (id) {
      var row = rows.filter(function (r) { return r.id === id; })[0];
      if (!row) return;
      var before = shallow_(row), c = shallow_(changes);
      if (c.status !== undefined) {
        if (STATUSES.indexOf(c.status) < 0) throw new Error('Unknown status: ' + c.status);
        if (c.status === 'Shortlisted') c.shortlisted = 'Yes';
        if (c.status === 'Received') c.shortlisted = '';
      }
      if (c.shortlisted !== undefined) c.shortlisted = truthy_(c.shortlisted) ? 'Yes' : '';
      if (c.flagged !== undefined) c.flagged = truthy_(c.flagged) ? 'Yes' : '';
      if (c.session !== undefined && c.session) {
        var known = readObjects_(sheet_(APP.SHEETS.SESSIONS, SESSION_FIELDS), SESSION_FIELDS).some(function (x) { return x.id === c.session; });
        if (!known) throw new Error('Unknown session: ' + c.session);
      }
      var cleaned = cleanEdits_(c, row);
      var diffs = [];
      Object.keys(cleaned).forEach(function (k) {
        if (String(row[k] == null ? '' : row[k]) !== String(cleaned[k])) { diffs.push(label_(k) + ': ' + show_(row[k]) + ' → ' + show_(cleaned[k])); row[k] = cleaned[k]; }
      });
      if (!diffs.length) return;
      if (Object.keys(cleaned).some(function (k) { return RESCREEN_ON.indexOf(k) >= 0; })) {
        recomputeDerived_(row, s);
        if (cleaned.screening === undefined) applyScreening_(row, screen_(row, rows, s));
      }
      row.updatedAt = nowIso_(); row.updatedBy = user;
      writeRow_(sh, FIELDS, row);
      audit_(user, 'UPDATE', row.id, (note ? note + ' · ' : '') + diffs.join('; '));
      changed++; out.push(publicApp_(row));
    });
    return { changed: changed, applications: out };
  });
}

/** Marks the top-N applicants by Screen Score as Shortlisted (eligible, not disqualified, not already decided). */
function shortlistTop(user, n) {
  var s = settings_();
  n = Math.max(1, Math.floor(Number(n) || num_(s.SHORTLIST_SIZE, 30)));
  var rows = readObjects_(sheet_(APP.SHEETS.APPS, FIELDS), FIELDS);
  var pool = rows.filter(function (r) {
    return r.screenScore !== '' && !isNaN(Number(r.screenScore)) && ['Received', 'Shortlisted'].indexOf(r.status || 'Received') >= 0 && r.screening !== 'Suggest Disqualify';
  }).sort(function (a, b) { return Number(b.screenScore) - Number(a.screenScore) || String(a.submittedAt).localeCompare(String(b.submittedAt)); });
  var cut = pool.slice(0, n);
  var tie = (pool.length > n && cut.length && Number(pool[n].screenScore) === Number(cut[cut.length - 1].screenScore));
  if (!cut.length) throw new Error('No scored applications to shortlist. Enter Screen Scores first.');
  var res = updateApplications(user, cut.map(function (r) { return r.id; }), { status: 'Shortlisted' }, 'Top ' + n + ' shortlist');
  return { shortlisted: cut.length, changed: res.changed, tieAtCutoff: tie, cutoffScore: Number(cut[cut.length - 1].screenScore) };
}

/** map: { appId: sessionId | '' } */
function assignSessions(user, map) {
  var groups = {};
  Object.keys(map || {}).forEach(function (id) { (groups[map[id] || ''] = groups[map[id] || ''] || []).push(id); });
  var total = 0;
  Object.keys(groups).forEach(function (sid) { total += updateApplications(user, groups[sid], { session: sid }, 'Session assignment').changed; });
  return { changed: total };
}

function saveSession(user, sess) {
  sess = sess || {};
  var date = clean_(sess.date), slot = clean_(sess.slot) || 'Forenoon';
  if (!isIso_(date)) throw new Error('Session date must be a valid date.');
  var id = date + ' ' + slot;
  return withLock_(function () {
    var sh = sheet_(APP.SHEETS.SESSIONS, SESSION_FIELDS);
    var rows = readObjects_(sh, SESSION_FIELDS);
    var orig = clean_(sess.originalId);
    var existing = rows.filter(function (r) { return r.id === (orig || id); })[0];
    if (!existing && rows.some(function (r) { return r.id === id; })) throw new Error('That session already exists.');
    if (existing && orig && orig !== id) {               // date/slot changed: keep applicants attached
      if (rows.some(function (r) { return r.id === id; })) throw new Error('That session already exists.');
      var ash = sheet_(APP.SHEETS.APPS, FIELDS), arows = readObjects_(ash, FIELDS);
      arows.forEach(function (a) { if (a.session === orig) { a.session = id; writeRow_(ash, FIELDS, a); } });
    }
    var rec = { id: id, date: date, slot: slot, venue: clean_(sess.venue), interviewer: clean_(sess.interviewer),
      capacity: sess.capacity === '' || sess.capacity == null ? '' : Number(sess.capacity) || '', notes: clean_(sess.notes) };
    if (existing) { rec._row = existing._row; writeRow_(sh, SESSION_FIELDS, rec); }
    else appendRow_(sh, SESSION_FIELDS, rec);
    audit_(user, existing ? 'SESSION_UPDATE' : 'SESSION_ADD', '', id);
    return rec;
  });
}

function deleteSession(user, id) {
  return withLock_(function () {
    var ash = sheet_(APP.SHEETS.APPS, FIELDS);
    var used = readObjects_(ash, FIELDS).filter(function (a) { return a.session === id; });
    if (used.length) throw new Error(used.length + ' applicant(s) are assigned to this session. Move them first.');
    var sh = sheet_(APP.SHEETS.SESSIONS, SESSION_FIELDS);
    var row = readObjects_(sh, SESSION_FIELDS).filter(function (r) { return r.id === id; })[0];
    if (!row) throw new Error('Session not found.');
    sh.deleteRow(row._row);
    audit_(user, 'SESSION_DELETE', '', id);
    touch_();
    return { deleted: id };
  });
}

/** Recalculates Age / Location / Screening for every application with the current Settings. */
function rescreenAll(user) {
  var s = settings_();
  return withLock_(function () {
    var sh = sheet_(APP.SHEETS.APPS, FIELDS);
    var rows = readObjects_(sh, FIELDS), changed = 0;
    rows.forEach(function (r) {
      if (r.screening === 'Cleared') { recomputeDerived_(r, s); return; }   // an official's decision stands
      var before = [r.age, r.location, r.screening, r.screeningNotes].join('|');
      recomputeDerived_(r, s);
      applyScreening_(r, screen_(r, rows, s));
      if ([r.age, r.location, r.screening, r.screeningNotes].join('|') !== before) { writeRow_(sh, FIELDS, r); changed++; }
    });
    audit_(user, 'RESCREEN', '', rows.length + ' checked, ' + changed + ' changed');
    touch_();
    return { checked: rows.length, changed: changed };
  });
}

function saveSettings(user, values) {
  var sh = settingsSheet_();
  return withLock_(function () {
    var data = sh.getRange(1, 1, Math.max(sh.getLastRow(), 1), 3).getValues();
    var lines = [];
    Object.keys(values || {}).forEach(function (k) {
      var i = -1;
      for (var r = 1; r < data.length; r++) if (data[r][0] === k) i = r;
      if (i < 0) throw new Error('Unknown setting: ' + k);
      var v = String(values[k] == null ? '' : values[k]).trim();
      if (/^(MAX_AGE|MIN_AGE|SHORTLIST_SIZE|SELECTION_SIZE)$/.test(k) && v !== '' && isNaN(Number(v))) throw new Error(k + ' must be a number.');
      if (/^(INTAKE_START|INTAKE_END|AGE_AS_ON)$/.test(k) && v !== '' && !isIso_(v)) throw new Error(k + ' must be a date (yyyy-mm-dd).');
      if (/^ENFORCE_/.test(k) && ['BLOCK', 'FLAG'].indexOf(v) < 0) throw new Error(k + ' must be BLOCK or FLAG.');
      if (/^(REG_OPEN|CV_REQUIRED)$/.test(k)) v = truthy_(v) ? 'TRUE' : 'FALSE';
      if (String(data[i][1]) !== v) { sh.getRange(i + 1, 2).setValue(v); lines.push(k + ': ' + show_(data[i][1]) + ' → ' + show_(v)); }
    });
    _settingsCache = null;
    if (lines.length) { audit_(user, 'SETTINGS', '', lines.join('; ')); touch_(); }
    return settings_();
  });
}

/** Bulk e-mail. Placeholders: {{name}} {{id}} {{session}} {{date}} {{slot}} {{venue}} {{status}} {{batch}} {{programme}} */
function sendEmails(user, ids, subject, body) {
  ids = [].concat(ids || []);
  subject = clean_(subject);
  if (!ids.length) throw new Error('No recipients selected.');
  if (!subject || !String(body || '').trim()) throw new Error('Subject and message are required.');
  var s = settings_();
  var rows = readObjects_(sheet_(APP.SHEETS.APPS, FIELDS), FIELDS);
  var sessions = readObjects_(sheet_(APP.SHEETS.SESSIONS, SESSION_FIELDS), SESSION_FIELDS);
  var targets = ids.map(function (id) { return rows.filter(function (r) { return r.id === id; })[0]; }).filter(function (r) { return r && validEmail_(r.email); });
  var quota = safe_(function () { return MailApp.getRemainingDailyQuota(); });
  if (quota != null && quota < targets.length) throw new Error('Daily e-mail quota is ' + quota + ' but ' + targets.length + ' e-mails were requested. Send in smaller batches tomorrow.');
  var sent = 0, failed = [];
  targets.forEach(function (r) {
    var sess = sessions.filter(function (x) { return x.id === r.session; })[0] || {};
    var vars = { name: r.fullName, id: r.id, session: r.session || '', date: sess.date || '', slot: sess.slot || '', venue: sess.venue || '',
      status: r.status, batch: s.BATCH_LABEL, programme: s.PROGRAMME };
    var text = fill_(String(body), vars);
    try {
      sendMail_(s, r.email, fill_(subject, vars), emailShell_(s, fill_(subject, vars), textToHtml_(text)), text);
      sent++;
    } catch (err) { failed.push(r.id + ': ' + msg_(err)); }
  });
  audit_(user, 'EMAIL', '', 'Subject "' + subject + '" → ' + sent + ' sent' + (failed.length ? ', ' + failed.length + ' failed' : '') + ' [' + targets.map(function (r) { return r.id; }).join(',') + ']');
  return { sent: sent, failed: failed, skipped: ids.length - targets.length };
}

function resendConfirmation(user, id) {
  var row = readObjects_(sheet_(APP.SHEETS.APPS, FIELDS), FIELDS).filter(function (r) { return r.id === id; })[0];
  if (!row) throw new Error('Application not found.');
  sendConfirmation_(row, settings_());
  audit_(user, 'CONFIRMATION_RESENT', id, row.email);
  return { sent: true };
}

function getAudit(user, limit) {
  var sh = sheet_(APP.SHEETS.AUDIT, AUDIT_HEADERS);
  var last = sh.getLastRow();
  if (last < 2) return [];
  var n = Math.min(last - 1, limit || APP.AUDIT_LIMIT);
  return sh.getRange(last - n + 1, 1, n, AUDIT_HEADERS.length).getValues().reverse().map(function (r) {
    return { time: r[0] instanceof Date ? iso_(r[0], true) : String(r[0]), user: r[1], action: r[2], id: r[3], details: r[4] };
  });
}


/* =========================================================================
 *  Cleaning, validation and screening
 * ========================================================================= */

function cleanApplication_(p, s) {
  var d = {};
  d.fullName = clean_(p.fullName);
  if (d.fullName.length < 3 || !/[A-Za-z]/.test(d.fullName)) throw new Error('Please enter your full name.');
  d.dob = clean_(p.dob);
  if (!isIso_(d.dob)) throw new Error('Please enter a valid date of birth.');
  d.gender = pick_(p.gender, GENDERS, 'gender');
  d.email = normEmail_(p.email);
  if (!validEmail_(d.email)) throw new Error('Please enter a valid e-mail address.');
  d.mobile = phone_(p.mobile);
  if (!d.mobile) throw new Error('Please enter a valid 10-digit primary mobile number.');
  d.altMobile = clean_(p.altMobile) ? phone_(p.altMobile) : '';
  if (clean_(p.altMobile) && !d.altMobile) throw new Error('The alternate mobile number is not valid.');
  d.district = pick_(p.district, DISTRICTS, 'district');
  d.localBody = clean_(p.localBody);
  if (!d.localBody) throw new Error('Please enter your local body (panchayat / municipality / corporation).');
  d.qual = pick_(p.qual, QUALS, 'qualification');
  d.stream = clean_(p.stream);
  d.specialisation = clean_(p.specialisation);
  d.institution = clean_(p.institution);
  if (!d.stream || !d.specialisation || !d.institution) throw new Error('Please complete the UG details (stream, subject and institution).');
  d.completion = clean_(p.completion);
  if (!isIso_(d.completion)) throw new Error('Please enter the UG degree completion date.');
  d.motivation = clean_(p.motivation);
  if (d.motivation.length < 30) throw new Error('Please tell us in a few lines why you want to join DCIP (at least 30 characters).');
  if (d.motivation.length > 1500) throw new Error('Your answer is too long (maximum 1500 characters).');
  if (d.altMobile && d.altMobile === d.mobile) d.altMobile = '';
  d.cv = ''; d.cvFileId = '';
  recomputeDerived_(d, s);
  return d;
}

function cleanEdits_(c, row) {
  var out = {};
  Object.keys(c).forEach(function (k) {
    var v = c[k];
    switch (k) {
      case 'email': v = normEmail_(v); if (!validEmail_(v)) throw new Error('Invalid e-mail.'); break;
      case 'mobile': v = phone_(v); if (!v) throw new Error('Invalid primary mobile number.'); break;
      case 'altMobile': v = clean_(v) ? phone_(v) : ''; break;
      case 'dob': case 'completion': v = clean_(v); if (!isIso_(v)) throw new Error('Invalid date for ' + label_(k)); break;
      case 'screenScore': case 'interviewScore':
        v = String(v == null ? '' : v).trim();
        if (v !== '' && (isNaN(Number(v)) || Number(v) < 0 || Number(v) > 1000)) throw new Error('Score must be a number.');
        break;
      case 'screening': v = pick_(v, SCREENINGS, 'screening result'); break;
      case 'gender': v = pick_(v, GENDERS, 'gender'); break;
      case 'district': v = pick_(v, DISTRICTS, 'district'); break;
      case 'qual': v = pick_(v, QUALS, 'qualification'); break;
      default: v = (v == null ? '' : String(v)).replace(/[ \t]+/g, ' ').trim();
    }
    out[k] = v;
  });
  return out;
}

function recomputeDerived_(d, s) {
  d.age = isIso_(d.dob) ? ageOn_(d.dob, ageAsOn_(s)) : '';
  d.location = clean_(d.district) + (d.localBody ? ', ' + clean_(d.localBody) : '');
}

/**
 * Screening rules. Returns { label: 'Eligible'|'Review'|'Suggest Disqualify', issues:[{code,msg,level,block}] }.
 * `block` = the public form refuses the submission (only when the matching ENFORCE_* setting is BLOCK).
 */
function screen_(d, all, s) {
  var issues = [], today = today_();
  function add(code, msg, level, block) { issues.push({ code: code, msg: msg, level: level, block: !!block }); }
  var asOn = ageAsOn_(s), maxAge = num_(s.MAX_AGE, 30), minAge = num_(s.MIN_AGE, 0);
  var age = isIso_(d.dob) ? ageOn_(d.dob, asOn) : null;
  var blockAge = s.ENFORCE_AGE !== 'FLAG', blockComp = s.ENFORCE_COMPLETION !== 'FLAG';

  if (age == null) add('DOB', 'Date of birth missing or invalid.', 'review');
  else if (age > maxAge) add('AGE_OVER', 'Age is ' + age + ' on ' + fmtDate_(asOn) + '; the limit is ' + maxAge + ' years.', 'disq', blockAge);
  else if (minAge && age < minAge) add('AGE_UNDER', 'Age is ' + age + ' on ' + fmtDate_(asOn) + '; the minimum is ' + minAge + ' years.', 'disq', blockAge);

  var pending = /pending/i.test(d.qual || '');
  if (!isIso_(d.completion)) add('COMPLETION_MISSING', 'UG completion date missing or invalid.', 'review');
  else {
    if (d.completion > s.INTAKE_END) add('COMPLETION_LATE', 'UG course completes on ' + fmtDate_(d.completion) + ', after the internship period ends (' + fmtDate_(s.INTAKE_END) + ').', 'disq', blockComp);
    else if (!pending && d.completion > today) add('COMPLETION_FUTURE', 'Marked as completed but the completion date (' + fmtDate_(d.completion) + ') is in the future.', 'review');
    else if (pending && d.completion < addDays_(today, -180)) add('COMPLETION_STALE', 'Marked as results pending but the completion date (' + fmtDate_(d.completion) + ') is long past – verify.', 'review');
    else if (pending && d.completion > today && d.completion > s.INTAKE_START) add('COMPLETION_IN_PERIOD', 'UG completes during the internship period (' + fmtDate_(d.completion) + ') – confirm the final result.', 'info');
  }
  if (!d.cv && !d.cvFileId) add('NO_CV', 'No CV uploaded.', 'review');
  if (!phone_(d.mobile)) add('MOBILE', 'Primary mobile number is not a valid 10-digit number.', 'review');

  (all || []).forEach(function (o) {
    if (o.id && d.id && o.id === d.id) return;
    if (d.mobile && (o.mobile === d.mobile || o.altMobile === d.mobile)) add('DUP_MOBILE', 'Mobile number also used by ' + o.id + ' (' + o.fullName + ').', 'review');
    else if (d.fullName && isIso_(d.dob) && key_(o.fullName) === key_(d.fullName) && o.dob === d.dob) add('DUP_PERSON', 'Same name and date of birth as ' + o.id + '.', 'review');
  });

  var label = issues.some(function (i) { return i.level === 'disq'; }) ? 'Suggest Disqualify'
    : issues.some(function (i) { return i.level === 'review'; }) ? 'Review' : 'Eligible';
  return { label: label, issues: issues };
}

function applyScreening_(d, scr) {
  d.screening = scr.label;
  d.screeningNotes = scr.issues.map(function (i) { return i.msg; }).join(' | ');
}

function checkCv_(cv) {
  var name = String(cv.name || ''), ext = (name.split('.').pop() || '').toLowerCase();
  if (APP.CV_EXT.indexOf(ext) < 0) throw new Error('The CV must be a PDF, DOC or DOCX file.');
  var data = String(cv.data || '').replace(/^data:[^,]*,/, '');
  if (Math.floor(data.length * 3 / 4) > APP.CV_MAX_BYTES + 1024) throw new Error('The CV is larger than ' + (APP.CV_MAX_BYTES / 1048576) + ' MB.');
  var mime = ext === 'pdf' ? 'application/pdf' : ext === 'doc' ? 'application/msword' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  return { data: data, ext: ext, mime: mime };
}


/* =========================================================================
 *  E-mail
 * ========================================================================= */

function sendConfirmation_(d, s) {
  var rows = [
    ['Reference number', '<b>' + esc_(d.id) + '</b>'],
    ['Full name', esc_(d.fullName)], ['Date of birth', esc_(fmtDate_(d.dob)) + ' (age ' + esc_(d.age) + ' on ' + esc_(fmtDate_(ageAsOn_(s))) + ')'],
    ['Gender', esc_(d.gender)], ['E-mail', esc_(d.email) + ' (verified)'],
    ['Primary mobile', esc_(d.mobile)], ['Alternate mobile', esc_(d.altMobile || '—')],
    ['District', esc_(d.district)], ['Local body', esc_(d.localBody)],
    ['Highest qualification', esc_(d.qual)], ['UG stream', esc_(d.stream)], ['UG subject', esc_(d.specialisation)],
    ['UG institution', esc_(d.institution)], ['UG completion date', esc_(fmtDate_(d.completion))],
    ['CV', d.cv || d.cvFileId ? 'Received' : 'Not uploaded'],
    ['Your answer', esc_(d.motivation)]
  ];
  var table = '<table style="border-collapse:collapse;width:100%;font-size:14px">' + rows.map(function (r) {
    return '<tr><td style="padding:7px 10px;border:1px solid #e3e6ec;background:#f6f7fa;width:38%;vertical-align:top">' + r[0] + '</td><td style="padding:7px 10px;border:1px solid #e3e6ec;vertical-align:top">' + r[1] + '</td></tr>';
  }).join('') + '</table>';
  var contact = s.CONTACT_PHONE ? ' or call ' + esc_(s.CONTACT_PHONE) : '';
  var html = emailShell_(s, 'Application received',
    '<p>Dear ' + esc_(d.fullName) + ',</p>' +
    '<p>Thank you for applying to the <b>' + esc_(s.PROGRAMME) + ' – ' + esc_(s.BATCH_LABEL) + '</b> (internship period ' + esc_(fmtDate_(s.INTAKE_START)) + ' to ' + esc_(fmtDate_(s.INTAKE_END)) + '). Your application has been received. This is what we recorded:</p>' +
    table +
    '<p style="margin-top:18px"><b>Please read this carefully</b></p><ul>' +
    '<li>Check every detail above. If something is wrong, reply to this e-mail with the correction and your reference number' + contact + '.</li>' +
    '<li><b>All further communication – shortlisting, interview schedule, document verification and results – will be sent to this e-mail address and the mobile numbers above.</b> Please keep them active and check your spam folder.</li>' +
    '<li>Receipt of this e-mail is not a guarantee of shortlisting or selection. Applications are screened for eligibility (age limit, completion of the UG course within the internship period) before shortlisting.</li></ul>' +
    '<p>Regards,<br>' + esc_(s.SENDER_NAME) + '</p>');
  var text = 'Application received – ' + d.id + '\n\n' + rows.map(function (r) { return r[0] + ': ' + String(r[1]).replace(/<[^>]+>/g, ''); }).join('\n') +
    '\n\nAll further communication will be sent to this e-mail address. Reply with your reference number if any detail is wrong.\n' + s.SENDER_NAME;
  sendMail_(s, d.email, '[DCIP ' + s.BATCH_LABEL + '] Application received – ' + d.id, html, text);
}

function emailShell_(s, title, inner) {
  return '<div style="font-family:Arial,Helvetica,sans-serif;color:#1c2333;max-width:640px;margin:0 auto;line-height:1.5">' +
    '<div style="background:#14213d;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0"><div style="font-size:12px;letter-spacing:1.5px;opacity:.8">' + esc_(s.PROGRAMME).toUpperCase() + '</div>' +
    '<div style="font-size:20px;font-weight:700">DCIP · ' + esc_(s.BATCH_LABEL) + ' · ' + esc_(title) + '</div></div>' +
    '<div style="border:1px solid #e3e6ec;border-top:0;padding:20px;border-radius:0 0 8px 8px">' + inner + '</div>' +
    '<div style="font-size:11px;color:#6b7280;margin-top:10px">This is an automated message from the ' + esc_(s.PROGRAMME) + ' registration system.</div></div>';
}

function sendMail_(s, to, subject, html, text) {
  var opts = { to: to, subject: subject, htmlBody: html, body: text || '', name: s.SENDER_NAME || 'DCIP' };
  if (s.CONTACT_EMAIL) opts.replyTo = s.CONTACT_EMAIL;
  MailApp.sendEmail(opts);
}

function textToHtml_(t) {
  return String(t).split(/\n{2,}/).map(function (p) { return '<p>' + esc_(p).replace(/\n/g, '<br>') + '</p>'; }).join('');
}
function fill_(t, vars) { return String(t).replace(/\{\{\s*(\w+)\s*\}\}/g, function (m, k) { return vars[k] != null ? vars[k] : m; }); }


/* =========================================================================
 *  Sheets, settings, audit
 * ========================================================================= */

function ss_() {
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  var ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Set Script Property SPREADSHEET_ID to the ID of the DCIP spreadsheet.');
  return ss;
}

function sheet_(name, fields) {
  var ss = ss_(), sh = ss.getSheetByName(name);
  var headers = fields.map(function (f) { return f.h || f; });
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#14213d').setFontColor('#ffffff');
    sh.setFrozenRows(1);
    fields.forEach(function (f, i) { if (f.text) sh.getRange(2, i + 1, 1, 1).setNumberFormat('@'); });
  } else if (sh.getLastColumn() < headers.length) {              // new columns added in a later version
    var have = sh.getLastColumn() ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0] : [];
    if (have.length && have.join() !== headers.slice(0, have.length).join()) throw new Error('Unexpected headers in sheet "' + name + '".');
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  return sh;
}

function settingsSheet_() {
  var ss = ss_(), sh = ss.getSheetByName(APP.SHEETS.SETTINGS);
  if (!sh) {
    sh = ss.insertSheet(APP.SHEETS.SETTINGS);
    sh.getRange(1, 1, 1, 3).setValues([['Key', 'Value', 'Description']]).setFontWeight('bold').setBackground('#14213d').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  }
  var have = {};
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().forEach(function (r) { have[r[0]] = true; });
  var missing = DEFAULT_SETTINGS.filter(function (d) { return !have[d[0]]; });
  if (missing.length) {
    var start = Math.max(sh.getLastRow(), 1) + 1;
    sh.getRange(start, 2, missing.length, 1).setNumberFormat('@');
    sh.getRange(start, 1, missing.length, 3).setValues(missing);
  }
  return sh;
}

var _settingsCache = null;
function settings_() {
  if (_settingsCache) return _settingsCache;
  var sh = settingsSheet_(), out = {};
  DEFAULT_SETTINGS.forEach(function (d) { out[d[0]] = d[1]; });
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues().forEach(function (r) {
    if (r[0]) out[r[0]] = r[1] instanceof Date ? iso_(r[1]) : String(r[1] == null ? '' : r[1]).trim();
  });
  return (_settingsCache = out);
}

function readObjects_(sh, fields) {
  var last = sh.getLastRow();
  if (last < 2) return [];
  var vals = sh.getRange(2, 1, last - 1, fields.length).getValues(), out = [];
  vals.forEach(function (row, i) {
    if (row.every(function (c) { return c === '' || c == null; })) return;
    var o = { _row: i + 2 };
    fields.forEach(function (f, c) {
      var v = row[c];
      if (v instanceof Date) v = f.k === 'submittedAt' || f.k === 'updatedAt' ? iso_(v, true) : iso_(v);
      o[f.k] = v == null ? '' : v;
    });
    ['mobile', 'altMobile'].forEach(function (k) { if (o[k] !== undefined && o[k] !== '') o[k] = String(o[k]).replace(/\D/g, ''); });
    out.push(o);
  });
  return out;
}

function rowValues_(fields, o) { return fields.map(function (f) { return o[f.k] == null ? '' : o[f.k]; }); }
function appendRow_(sh, fields, o) {
  var r = Math.max(sh.getLastRow(), 1) + 1;
  fields.forEach(function (f, i) { if (f.text) sh.getRange(r, i + 1, 1, 1).setNumberFormat('@'); });
  sh.getRange(r, 1, 1, fields.length).setValues([rowValues_(fields, o)]);
  touch_();
}
function writeRow_(sh, fields, o) {
  sh.getRange(o._row, 1, 1, fields.length).setValues([rowValues_(fields, o)]);
  touch_();
}
function touch_() { PropertiesService.getScriptProperties().setProperty('LAST_CHANGE', String(Date.now())); }

function audit_(user, action, id, details) {
  try {
    var sh = sheet_(APP.SHEETS.AUDIT, AUDIT_HEADERS);
    sh.getRange(Math.max(sh.getLastRow(), 1) + 1, 1, 1, AUDIT_HEADERS.length).setValues([[nowIso_(), user, action, id || '', String(details || '').slice(0, 2000)]]);
  } catch (e) { /* auditing must never break the operation */ }
}

function cvFolder_() {
  var props = PropertiesService.getScriptProperties(), id = props.getProperty('CV_FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { /* recreate below */ } }
  var f = DriveApp.createFolder('DCIP ' + settings_().BATCH_LABEL + ' – CVs (private)');
  props.setProperty('CV_FOLDER_ID', f.getId());
  return f;
}

function nextId_(rows) {
  var props = PropertiesService.getScriptProperties();
  var max = Number(props.getProperty('APP_SEQ') || 0);
  rows.forEach(function (r) { var m = String(r.id).match(/(\d+)$/); if (m) max = Math.max(max, Number(m[1])); });
  max++;
  props.setProperty('APP_SEQ', String(max));
  return APP.ID_PREFIX + ('0000' + max).slice(-4);
}


/* =========================================================================
 *  Helpers
 * ========================================================================= */

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try { return fn(); } finally { lock.releaseLock(); }
}
function safe_(fn) { try { return fn(); } catch (e) { return null; } }

function publicApp_(r) { var o = shallow_(r); delete o._row; delete o.cvFileId; return o; }
function shallow_(o) { var c = {}; Object.keys(o).forEach(function (k) { c[k] = o[k]; }); return c; }
function label_(k) { var f = FIELDS.filter(function (x) { return x.k === k; })[0]; return f ? f.h : k; }
function show_(v) { return v === '' || v == null ? '∅' : String(v); }

function sign_(payload) {
  var secret = PropertiesService.getScriptProperties().getProperty('TOKEN_SECRET');
  if (!secret) throw new Error('Run setup() first.');
  var body = Utilities.base64EncodeWebSafe(payload);
  var sig = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(body, secret));
  return body + '.' + sig;
}
/** Returns the payload split on '|' or null when invalid. Expiry is checked by the callers. */
function verify_(token) {
  var t = String(token || '').split('.');
  if (t.length !== 2) return null;
  var secret = PropertiesService.getScriptProperties().getProperty('TOKEN_SECRET');
  var sig = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(t[0], secret));
  if (sig !== t[1]) return null;
  return Utilities.newBlob(Utilities.base64DecodeWebSafe(t[0])).getDataAsString().split('|');
}
function assertVerified_(token, email) {
  var p = verify_(token);
  if (!p || p[0] !== 'v' || p[1] !== email || Number(p[2]) < nowS_()) throw new Error('Please verify your e-mail address again (the verification expired or the e-mail was changed).');
}
function hash_(s) {
  return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s))).slice(0, 32);
}

function nowS_() { return Math.floor(Date.now() / 1000); }
function nowIso_() { return Utilities.formatDate(new Date(), APP.TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss"); }
function today_() { return Utilities.formatDate(new Date(), APP.TIMEZONE, 'yyyy-MM-dd'); }
function iso_(d, withTime) { return Utilities.formatDate(d, APP.TIMEZONE, withTime ? "yyyy-MM-dd'T'HH:mm:ss" : 'yyyy-MM-dd'); }
function ageAsOn_(s) { return isIso_(s.AGE_AS_ON) ? s.AGE_AS_ON : s.INTAKE_START; }
function regOpen_(s) {
  if (!truthy_(s.REG_OPEN)) return false;
  if (s.REG_DEADLINE) return Utilities.formatDate(new Date(), APP.TIMEZONE, "yyyy-MM-dd'T'HH:mm") <= s.REG_DEADLINE;
  return true;
}

function isIso_(s) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
  if (!m) return false;
  var y = +m[1], mo = +m[2], d = +m[3], dt = new Date(Date.UTC(y, mo - 1, d));
  return y >= 1950 && y <= 2100 && dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}
function ageOn_(dob, asOn) {
  var a = dob.split('-').map(Number), b = asOn.split('-').map(Number);
  var age = b[0] - a[0];
  if (b[1] < a[1] || (b[1] === a[1] && b[2] < a[2])) age--;
  return age;
}
function addDays_(iso, n) {
  var p = iso.split('-').map(Number), d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n));
  return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2);
}
function fmtDate_(iso) {
  if (!isIso_(iso)) return iso || '';
  var p = iso.split('-');
  return Number(p[2]) + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(p[1]) - 1] + ' ' + p[0];
}

function clean_(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
function key_(s) { return clean_(s).toUpperCase(); }
function num_(v, dflt) { var n = Number(v); return v === '' || v == null || isNaN(n) ? dflt : n; }
function truthy_(v) { return /^(true|yes|y|1)$/i.test(String(v == null ? '' : v).trim()); }
function esc_(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function normEmail_(s) { return String(s == null ? '' : s).trim().toLowerCase(); }
function validEmail_(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) && s.length <= 254; }
function phone_(s) {
  var d = String(s == null ? '' : s).replace(/\D/g, '');
  if (d.length === 12 && d.indexOf('91') === 0) d = d.slice(2);
  if (d.length === 11 && d.charAt(0) === '0') d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? d : '';
}
function pick_(v, list, what) {
  var x = clean_(v);
  for (var i = 0; i < list.length; i++) if (list[i].toLowerCase() === x.toLowerCase()) return list[i];
  throw new Error('Please choose a valid ' + what + '.');
}
function safeName_(s) { return clean_(s).replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || 'applicant'; }
