/* Admin portal core: state, API wrapper, shared components (modal, drawer, bulk bar, e-mail composer). */
(function (w) {
  'use strict';
  var D = w.DCIP, esc = D.esc;
  var A = w.A = {
    S: { token: '', user: '', apps: [], sessions: [], settings: {}, meta: [], config: {}, stamp: '', mailQuota: null, cvFolder: '', tab: 'overview' },
    views: {}, TABS: []
  };
  var $ = A.$ = function (s, r) { return (r || document).querySelector(s); };
  A.$$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- API ---------- */
  A.api = function (fn) {
    var args = Array.prototype.slice.call(arguments, 1);
    return D.call.apply(null, [fn, A.S.token].concat(args)).catch(function (e) {
      if (e.message === 'SESSION_EXPIRED') A.logout('Your session expired. Please sign in again.');
      if (/Unknown API function/.test(e.message)) throw new Error('The server (Apps Script) is an older version than this page. Paste the latest Code.gs, run setup once, then Deploy → Manage deployments → New version.');
      throw e;
    });
  };
  A.byId = function (id) { return A.S.apps.filter(function (a) { return a.id === id; })[0]; };
  A.merge = function (list) {
    list.forEach(function (n) { var i = A.S.apps.findIndex(function (a) { return a.id === n.id; }); if (i >= 0) A.S.apps[i] = n; else A.S.apps.push(n); });
  };
  /** Saves changes to many applications at once, updates local state and re-renders. */
  A.save = function (ids, changes, note) {
    return A.api('updateApplications', [].concat(ids), changes, note || '').then(function (r) {
      A.merge(r.applications); A.renderSoft(); A.refreshDrawer(); return r;
    }, function (e) { D.toast(e.message, 'err'); throw e; });
  };

  /* ---------- data helpers ---------- */
  A.ugText = function (a) { return [a.stream, a.specialisation].filter(Boolean).join(' ') + (a.institution ? ', ' + a.institution : ''); };
  A.phones = function (a) { return [a.mobile, a.altMobile].filter(Boolean).join(' / '); };
  A.nameCmp = function (a, b) { return String(a.fullName).localeCompare(String(b.fullName)); };
  A.num = function (v) { return v === '' || v == null || isNaN(Number(v)) ? null : Number(v); };
  A.sessionApps = function (sid) {
    return A.S.apps.filter(function (a) {
      if (sid === '__all') return a.shortlisted === 'Yes' && ['Disqualified', 'Withdrawn'].indexOf(a.status) < 0;
      if (sid === '__none') return a.shortlisted === 'Yes' && !a.session && ['Disqualified', 'Withdrawn'].indexOf(a.status) < 0;
      return a.session === sid;
    }).sort(A.nameCmp);
  };
  /** Documents for the day (score sheet, attendance, document verification): only candidates confirmed on the call, once any call has been confirmed. */
  A.docApps = function (sid) {
    var all = A.sessionApps(sid);
    if (!A.S.onlyConf || !all.some(function (a) { return a.callStatus === 'Confirmed'; })) return all;
    return all.filter(function (a) { return a.callStatus === 'Confirmed'; });
  };
  var SLOT = { Forenoon: 1, Afternoon: 2, Evening: 3, 'Full day': 0 };
  A.sortSessions = function (list) { return list.slice().sort(function (a, b) { return a.date.localeCompare(b.date) || (SLOT[a.slot] || 9) - (SLOT[b.slot] || 9); }); };
  A.sessionLabel = function (s) { return D.fmtDate(s.date) + ' · ' + s.slot; };
  A.eligible = function (a) { return ['Disqualified', 'Withdrawn'].indexOf(a.status) < 0 && a.screening !== 'Suggest Disqualify'; };

  var ST = { Received: '', Shortlisted: 'info', Selected: 'ok', Confirmed: 'ok', Waitlisted: 'warn', 'Not Selected': '', Disqualified: 'bad', Withdrawn: '' };
  A.statusChip = function (a) { return '<span class="chip ' + (ST[a.status] || '') + '">' + esc(a.status || 'Received') + '</span>'; };
  A.screenChip = function (a) {
    var s = a.screening;
    if (s === 'Suggest Disqualify') return '<span class="chip bad" title="' + esc(a.screeningNotes) + '">Suggest disqualify</span>';
    if (s === 'Review') return '<span class="chip warn" title="' + esc(a.screeningNotes) + '">Review</span>';
    if (s === 'Cleared') return '<span class="chip ok" title="Cleared by an official">Cleared</span>';
    return '<span class="chip ok">Eligible</span>';
  };
  A.opts = function (list, cur, blank) { return (blank != null ? '<option value="">' + esc(blank) + '</option>' : '') + list.map(function (x) { return '<option' + (x === cur ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join(''); };
  A.callerOpts = function (cur, blank) { return '<option value="">' + esc(blank || '— none —') + '</option>' + (A.S.callers || []).map(function (c) { return '<option value="' + esc(c.username) + '"' + (c.username === cur ? ' selected' : '') + (c.active === 'Yes' ? '' : ' disabled') + '>' + esc(c.name) + ' (' + esc(c.username) + ')</option>'; }).join(''); };
  A.sessionOpts = function (cur, blank) {
    return '<option value="">' + esc(blank || '— none —') + '</option>' + A.sortSessions(A.S.sessions).map(function (s) { return '<option value="' + esc(s.id) + '"' + (s.id === cur ? ' selected' : '') + '>' + esc(A.sessionLabel(s)) + '</option>'; }).join('');
  };
  A.needsScreening = function (a) { return a.status === 'Received' && (a.screening === 'Review' || a.screening === 'Suggest Disqualify'); };
  A.rep = function () { return { batch: A.S.settings.BATCH_LABEL || '', programme: A.S.settings.PROGRAMME || '' }; };
  A.download = function (rep, type) {
    var b = A.rep(); rep.batch = b.batch; rep.programme = b.programme;
    D.toast('Preparing ' + (type === 'xlsx' ? 'Excel' : 'PDF') + '…');
    return w.Reports.download(rep, type).catch(function (e) { D.toast(e.message, 'err'); });
  };

  /* ---------- modal ---------- */
  A.modal = function (html) { $('#modal').innerHTML = html; $('#modalWrap').classList.remove('hidden'); var f = $('#modal input, #modal textarea, #modal select'); if (f) f.focus(); return $('#modal'); };
  A.closeModal = function () { $('#modalWrap').classList.add('hidden'); $('#modal').innerHTML = ''; };
  A.confirm = function (title, html, okLabel, danger) {
    return new Promise(function (res) {
      var m = A.modal('<h3>' + esc(title) + '</h3><div>' + html + '</div><div class="acts"><button class="btn" id="cNo">Cancel</button><button class="btn ' + (danger ? 'danger' : 'primary') + '" id="cYes">' + esc(okLabel || 'OK') + '</button></div>');
      $('#cNo', m).onclick = function () { A.closeModal(); res(false); };
      $('#cYes', m).onclick = function () { A.closeModal(); res(true); };
    });
  };
  document.addEventListener('click', function (e) { if (e.target.id === 'modalWrap') A.closeModal(); if (e.target.id === 'drawerBg') A.closeDrawer(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { if (!$('#modalWrap').classList.contains('hidden')) A.closeModal(); else A.closeDrawer(); } });

  /* ---------- application drawer ---------- */
  var openId = null;
  var DOC_CERT = ['', 'Verified', 'Pending', 'Not available', 'Mismatch'];
  var CALL = ['', 'Not called', 'Confirmed', 'Not reachable', 'Call back', 'Wants online', 'Reschedule requested', 'Declined'];
  A.DOC_CERT = DOC_CERT; A.CALL = CALL;

  A.openDrawer = function (id) { openId = id; A.refreshDrawer(true); };
  A.closeDrawer = function () { openId = null; $('#drawer').classList.add('hidden'); $('#drawerBg').classList.add('hidden'); };
  A.drawerOpen = function () { return !!openId; };
  A.refreshDrawer = function (show) {
    if (!openId) return;
    var a = A.byId(openId); if (!a) { A.closeDrawer(); return; }
    var d = $('#drawer');
    if (!show && d.contains(document.activeElement) && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;   // do not disturb typing
    var S = A.S, st = S.config.statuses || S.statuses;
    function inp(k, label, type, extra) { return '<div><label class="f">' + label + '</label><input type="' + (type || 'text') + '" data-f="' + k + '" value="' + esc(a[k]) + '" ' + (extra || '') + '></div>'; }
    var issues = a.screeningNotes ? a.screeningNotes.split(' | ').map(function (n) { return '<div class="issue ' + (a.screening === 'Suggest Disqualify' && !/in the internship period/.test(n) ? 'bad' : '') + '">' + esc(n) + '</div>'; }).join('') : '';
    d.innerHTML =
      '<header><div style="flex:1"><h2>' + esc(a.fullName) + '</h2><div class="muted nowrap">' + esc(a.id) + ' · submitted ' + esc(D.fmtDateTime(a.submittedAt)) + '</div>' +
      '<div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">' + A.statusChip(a) + A.screenChip(a) + (a.flagged === 'Yes' ? '<span class="chip bad">⚑ Flagged</span>' : '') + (a.shortlisted === 'Yes' ? '<span class="chip info">Shortlisted</span>' : '') + '</div></div>' +
      '<button class="btn small" id="dClose" aria-label="Close">✕</button></header>' +
      '<div class="body">' +
      (issues ? '<h4 style="margin-top:0">Screening</h4>' + issues : '') +
      '<h4' + (issues ? '' : ' style="margin-top:0"') + '>Quick actions</h4><div style="display:flex;gap:6px;flex-wrap:wrap">' +
      ['Shortlisted', 'Selected', 'Confirmed', 'Waitlisted', 'Not Selected', 'Disqualified', 'Received'].map(function (s) { return '<button class="btn small' + (s === 'Disqualified' ? ' danger' : '') + '" data-quick="' + s + '"' + (a.status === s ? ' disabled' : '') + '>' + (s === 'Received' ? 'Reset to Received' : s === 'Disqualified' ? 'Disqualify' : s) + '</button>'; }).join('') + '</div>' +
      '<h4>Applicant</h4><dl class="dl">' +
      '<dt>E-mail</dt><dd><a href="mailto:' + esc(a.email) + '">' + esc(a.email) + '</a> ' + '' + '</dd>' +
      '<dt>Mobile</dt><dd><a href="tel:' + esc(a.mobile) + '">' + esc(a.mobile) + '</a>' + (a.altMobile ? ' · <a href="tel:' + esc(a.altMobile) + '">' + esc(a.altMobile) + '</a>' : '') + '</dd><dt>WhatsApp</dt><dd>' + esc(a.whatsapp || a.mobile) + (a.whatsapp ? '' : ' <span class="muted">(same as mobile)</span>') + '</dd>' +
      '<dt>Date of birth</dt><dd>' + esc(D.fmtDate(a.dob)) + ' (age ' + esc(a.age) + ')</dd><dt>Gender</dt><dd>' + esc(a.gender) + '</dd>' +
      '<dt>Location</dt><dd>' + esc(a.location) + '</dd><dt>Qualification</dt><dd>' + esc(a.qual) + (a.mastersInstitution ? ' · ' + esc(a.mastersInstitution) : '') + '</dd><dt>Heard about DCIP</dt><dd>' + esc(String(a.heardFrom || '—').replace(/\|/g, ', ')) + '</dd>' +
      '<dt>UG</dt><dd>' + esc(A.ugText(a)) + '</dd><dt>UG completion</dt><dd>' + esc(D.fmtMonthYear(a.completion)) + '</dd>' +
      '<dt>CV</dt><dd>' + (a.cv ? '<a href="' + esc(a.cv) + '" target="_blank" rel="noopener">Open CV ↗</a>' : '<span class="muted">Not uploaded</span>') + '</dd></dl>' +
      '<label class="f">Why DCIP?</label><div class="note-box">' + esc(a.motivation) + '</div>' +
      (a.background ? '<label class="f" style="margin-top:10px">Background and influences</label><div class="note-box">' + esc(a.background) + '</div>' : '') +
      '<h4>Evaluation</h4><div class="fgrid">' +
      '<div><label class="f">Status</label><select data-f="status">' + A.opts(S.statuses, a.status || 'Received') + '</select></div>' +
      '<div><label class="f">Screening result</label><select data-f="screening">' + A.opts(['Eligible', 'Review', 'Suggest Disqualify', 'Cleared'], a.screening) + '</select></div>' +
      inp('screenScore', 'Screen score (marks given by you)', 'number', 'step="0.5" min="0"') + inp('interviewScore', 'Interview score', 'number', 'step="0.5" min="0"') +
      '<div><label class="f"><input type="checkbox" data-f="flagged"' + (a.flagged === 'Yes' ? ' checked' : '') + '> Flagged</label><input type="text" data-f="flagNote" placeholder="Why is this flagged?" value="' + esc(a.flagNote) + '"></div>' +
      '<div><label class="f">Interview session</label><select data-f="session">' + A.sessionOpts(a.session) + '</select></div>' +
      '<div><label class="f">Interview mode</label><select data-f="interviewMode">' + A.opts(['In person', 'Online'], a.interviewMode, '— as per session —') + '</select></div>' +
      '<div><label class="f">Caller</label><select data-f="caller">' + A.callerOpts(a.caller, '— not assigned —') + '</select></div>' +
      '<div class="full"><label class="f">Remarks</label><textarea data-f="remarks" rows="3">' + esc(a.remarks) + '</textarea></div></div>' +
      '<h4>Interview day</h4><div class="fgrid">' +
      '<div><label class="f">Attendance</label><select data-f="attendance">' + A.opts(['Present', 'Absent'], a.attendance, '—') + '</select></div>' + inp('reportingTime', 'Reporting time', 'time') +
      '<div><label class="f">Call status</label><select data-f="callStatus">' + A.opts(CALL.slice(1), a.callStatus, '—') + '</select></div>' + inp('callNote', 'Call note') +
      '<div><label class="f">UG certificate</label><select data-f="docCert">' + A.opts(DOC_CERT.slice(1), a.docCert, '—') + '</select></div>' + inp('docOther', 'Other documents presented') +
      '<div class="full">' + inp('docRemarks', 'Document remarks') + '</div></div>' +
      '<details style="margin-top:18px"><summary style="cursor:pointer;font-weight:700">Correct applicant details</summary><div class="fgrid" style="margin-top:10px">' +
      inp('fullName', 'Full name') + inp('dob', 'Date of birth', 'date') + inp('whatsapp', 'WhatsApp number', 'tel') +
      '<div><label class="f">Gender</label><select data-f="gender">' + A.opts(S.config.genders, a.gender) + '</select></div>' + inp('email', 'E-mail', 'email') + inp('mobile', 'Mobile', 'tel') + inp('altMobile', 'Alternate mobile', 'tel') +
      '<div><label class="f">District</label><select data-f="district">' + A.opts(S.config.districts, a.district) + '</select></div>' + inp('localBody', 'Local body') +
      '<div class="full"><label class="f">Qualification</label><select data-f="qual">' + A.opts(S.config.quals, a.qual) + '</select></div>' +
      inp('stream', 'UG stream') + inp('specialisation', 'Subject') + '<div class="full">' + inp('institution', 'Institution') + '</div>' + inp('completion', 'UG completion (use the last day of the month)', 'date') +
      '<div class="full"><label class="f">Motivation</label><textarea data-f="motivation" rows="4">' + esc(a.motivation) + '</textarea></div><div class="full"><label class="f">Background and influences</label><textarea data-f="background" rows="4">' + esc(a.background) + '</textarea></div></div></details>' +
      '</div>' +
      '<footer><button class="btn primary" id="dSave">Save changes</button><button class="btn" id="dMail">E-mail…</button><button class="btn" id="dResend">Resend confirmation</button></footer>';
    d.classList.remove('hidden'); $('#drawerBg').classList.remove('hidden');
    $('#dClose').onclick = A.closeDrawer;
    A.$$('[data-quick]', d).forEach(function (b) { b.onclick = function () { A.save(a.id, { status: b.dataset.quick }, 'Quick action').then(function () { D.toast(a.fullName + ' → ' + b.dataset.quick, 'ok'); }); }; });
    $('#dSave').onclick = function () {
      var ch = {};
      A.$$('[data-f]', d).forEach(function (el) {
        var k = el.dataset.f, v = el.type === 'checkbox' ? (el.checked ? 'Yes' : '') : el.value;
        if (String(v) !== String(k === 'status' ? a.status || 'Received' : a[k] == null ? '' : a[k])) ch[k] = v;
      });
      if (!Object.keys(ch).length) { D.toast('No changes to save.'); return; }
      A.save(a.id, ch).then(function (r) { D.toast(r.changed ? 'Saved' : 'No changes', 'ok'); });
    };
    $('#dMail').onclick = function () { A.compose([a.id]); };
    $('#dResend').onclick = function () {
      A.confirm('Resend confirmation?', 'The original confirmation e-mail will be sent again to <b>' + esc(a.email) + '</b>.', 'Send').then(function (ok) {
        if (ok) A.api('resendConfirmation', a.id).then(function () { D.toast('Confirmation sent', 'ok'); }, function (e) { D.toast(e.message, 'err'); });
      });
    };
  };

  /* ---------- bulk action bar ---------- */
  /** host: element; getIds: () => array; opts.after: callback after an action. */
  A.bulkBar = function (host, ids, opts) {
    opts = opts || {};
    if (!ids.length) { host.innerHTML = ''; return; }
    host.innerHTML = '<div class="bulk"><b>' + ids.length + ' selected</b>' +
      '<select id="bkStatus"><option value="">Set status…</option>' + A.opts(A.S.statuses, '') + '</select>' +
      '<button class="btn small" id="bkFlag">⚑ Flag</button><button class="btn small" id="bkUnflag">Unflag</button>' +
      '<button class="btn small" id="bkClear" title="Mark the screening result as cleared by an official">Clear screening</button>' +
      '<select id="bkSession">' + A.sessionOpts('', 'Assign session…') + '</select>' +
      '<select id="bkCaller">' + A.callerOpts('', 'Assign caller…') + '</select>' +
      '<button class="btn small" id="bkMail">E-mail…</button><button class="btn small" id="bkX">Excel</button><button class="btn small" id="bkP">PDF</button>' +
      '<span class="grow"></span><button class="btn small" id="bkNone">Clear selection</button></div>';
    var done = function (m) { return function () { D.toast(m, 'ok'); if (opts.after) opts.after(); }; };
    $('#bkStatus', host).onchange = function () {
      var v = this.value; if (!v) return;
      var go = function () { A.save(ids, { status: v }, 'Bulk').then(done(ids.length + ' set to ' + v)); };
      if (v === 'Disqualified' || v === 'Withdrawn') A.confirm('Set ' + ids.length + ' application(s) to ' + v + '?', 'This can be reversed later by changing the status.', 'Yes, continue', true).then(function (ok) { if (ok) go(); else this.value = ''; }.bind(this)); else go();
    };
    $('#bkFlag', host).onclick = function () {
      var m = A.modal('<h3>Flag ' + ids.length + ' application(s)</h3><div class="field"><label class="f">Reason (optional)</label><input type="text" id="fnote" maxlength="200"></div><div class="acts"><button class="btn" id="cNo">Cancel</button><button class="btn primary" id="cYes">Flag</button></div>');
      $('#cNo', m).onclick = A.closeModal; $('#cYes', m).onclick = function () { var n = $('#fnote', m).value; A.closeModal(); A.save(ids, n ? { flagged: 'Yes', flagNote: n } : { flagged: 'Yes' }, 'Bulk').then(done('Flagged')); };
    };
    $('#bkUnflag', host).onclick = function () { A.save(ids, { flagged: '', flagNote: '' }, 'Bulk').then(done('Unflagged')); };
    $('#bkClear', host).onclick = function () { A.save(ids, { screening: 'Cleared' }, 'Bulk').then(done('Screening cleared')); };
    $('#bkSession', host).onchange = function () { if (this.value) A.api('assignSessions', ids.reduce(function (m, id) { m[id] = $('#bkSession', host).value; return m; }, {})).then(function () { return A.refresh(); }).then(done('Session assigned'), function (e) { D.toast(e.message, 'err'); }); };
    $('#bkCaller', host).onchange = function () { var v = this.value; if (v) A.save(ids, { caller: v }, 'Bulk caller').then(done('Assigned to caller')); };
    $('#bkMail', host).onclick = function () { A.compose(ids); };
    $('#bkX', host).onclick = function () { A.download(A.reports.applications(ids.map(A.byId), 'Selected applications'), 'xlsx'); };
    $('#bkP', host).onclick = function () { A.download(A.reports.applications(ids.map(A.byId), 'Selected applications'), 'pdf'); };
    $('#bkNone', host).onclick = function () { if (opts.clear) opts.clear(); };
  };

  /* ---------- e-mail composer ---------- */
  var SIGN = '\n\nWarm regards,\nTeam DCIP';
  A.TEMPLATES = {
    interview: { name: 'Interview schedule', subject: 'DCIP {{batch}} – Interview schedule',
      body: 'Dear Candidate,\n\nCongratulations! You have been shortlisted for the DCIP {{batch}} interview scheduled on {{dateLong}}.\n\nReporting Time: (edit: e.g. 1:00 PM)\nSession: {{slot}}\nMode: {{mode}}\nVenue: {{venue}}\n\nLocation / meeting link: {{link}}\n\nPlease bring your qualifying degree certificates (originals preferred, along with attested copies) and a valid photo identity proof (Aadhaar / Voter ID / Passport).\n\nPlease follow our official website www.dcip.co.in and social media handles of @collectorkkd and DCIP for any updates.\n\nFor any queries, please use the contact details given below.\n\nWe look forward to meeting you and wish you all the best!' + SIGN },
    docs: { name: 'Document verification', subject: 'DCIP {{batch}} – Document verification',
      body: 'Dear Candidate,\n\nYou have been selected for the {{programme}} – {{batch}} subject to verification of your documents.\n\nPlease report with the originals of your educational certificates and a valid photo ID on {{dateLong}} ({{slot}}) at {{venue}}.' + SIGN },
    selected: { name: 'Selected', subject: 'DCIP {{batch}} – Selection',
      body: 'Dear Candidate,\n\nCongratulations.\n\nWe are pleased to inform you that you have been selected for the {{batch}} of the District Collector’s Internship Programme (DCIP).\n\nYour interaction during the selection process reflected clarity of thought, social awareness, and readiness to engage meaningfully with public systems. Among a competitive pool of applicants, you stood out for your perspective and potential to contribute constructively.\n\nThe {{batch}} will commence on (edit: date).\n\n📍 Reporting Time: (edit: e.g. Sharp at 9:30 AM)\n📍 Venue: Mission Room, Collectorate\n\nKindly ensure punctual reporting.\n\n✅ Please confirm your participation by replying to this email at the earliest.\n\nWe look forward to welcoming you.' + SIGN },
    waitlist: { name: 'Waitlisted', subject: 'DCIP {{batch}} – Waiting list',
      body: 'Dear Candidate,\n\nThank you for attending the interview for the {{programme}} – {{batch}}. You are on the waiting list. We will contact you on this e-mail address if a place becomes available.' + SIGN },
    notselected: { name: 'Not selected', subject: 'DCIP {{batch}} – Application outcome',
      body: 'Dear Candidate,\n\nThank you for your interest in the {{programme}} – {{batch}}. We regret that we are unable to offer you a place in this batch. We encourage you to apply again in the future.' + SIGN },
    custom: { name: 'Write my own', subject: '', body: '' }
  };
  A.compose = function (ids, tplKey) {
    var apps = ids.map(A.byId).filter(Boolean), good = apps.filter(function (a) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email); });
    var q = A.S.mailQuota;
    var m = A.modal('<h3>E-mail ' + good.length + ' applicant' + (good.length === 1 ? '' : 's') + '</h3>' +
      '<p class="muted" style="margin:0 0 10px">' + esc(good.slice(0, 3).map(function (a) { return a.fullName; }).join(', ')) + (good.length > 3 ? ' and ' + (good.length - 3) + ' more' : '') + (q != null ? ' · daily e-mail quota left: <b>' + q + '</b>' : '') + '</p>' +
      '<div id="mWarn"></div><div class="field"><label class="f">Template</label><select id="mTpl">' + Object.keys(A.TEMPLATES).map(function (k) { return '<option value="' + k + '"' + (k === (tplKey || 'custom') ? ' selected' : '') + '>' + esc(A.TEMPLATES[k].name) + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label class="f">Subject</label><input type="text" id="mSub"></div>' +
      '<div class="field"><label class="f">Message</label><textarea id="mBody" rows="10"></textarea><div class="hint">Placeholders: {{name}} {{id}} {{session}} {{date}} {{slot}} {{venue}} {{status}} {{batch}} {{programme}} {{dateLong}} {{mode}} {{link}} {{phone}} {{contactEmail}} – filled in separately for every applicant. Review the wording before sending.</div></div>' +
      '<div class="acts"><button class="btn" id="mNo">Cancel</button><button class="btn primary" id="mSend">Send ' + good.length + ' e-mail' + (good.length === 1 ? '' : 's') + '</button></div>');
    var noSess = good.filter(function (x) { return !x.session; }).length;
    function fillTpl() {
      var t = A.TEMPLATES[$('#mTpl', m).value]; $('#mSub', m).value = t.subject; $('#mBody', m).value = t.body;
      $('#mWarn', m).innerHTML = noSess && /\{\{(dateLong|slot|session|venue|date)\}\}/.test(t.body) ? '<div class="alert warn" style="margin:0 0 10px;padding:8px 12px;border-radius:10px;background:var(--warn-bg);color:var(--warn);font-weight:600">' + noSess + ' of ' + good.length + ' have no interview session yet, so their date, session and venue will read “(to be informed)”.</div>' : '';
    }
    $('#mTpl', m).onchange = fillTpl; fillTpl();
    $('#mNo', m).onclick = A.closeModal;
    $('#mSend', m).onclick = function () {
      var sub = $('#mSub', m).value, body = $('#mBody', m).value;
      if (!sub.trim() || !body.trim()) { D.toast('Subject and message are required.', 'err'); return; }
      var btn = this; btn.disabled = true; btn.textContent = 'Sending…';
      A.api('sendEmails', good.map(function (a) { return a.id; }), sub, body).then(function (r) {
        A.closeModal();
        D.toast(r.sent + ' e-mail(s) sent' + (r.failed.length ? ', ' + r.failed.length + ' failed' : ''), r.failed.length ? 'err' : 'ok');
        if (q != null) A.S.mailQuota = Math.max(0, q - r.sent);
      }, function (e) { btn.disabled = false; btn.textContent = 'Send'; D.toast(e.message, 'err'); });
    };
  };

  A.changePasswordDialog = function () {
    var m = A.modal('<h3>Change your password</h3>' +
      '<div class="field"><label class="f">Current password</label><input type="password" id="pwOld" autocomplete="current-password"></div>' +
      '<div class="field"><label class="f">New password</label><input type="password" id="pwNew" autocomplete="new-password"><div class="hint">At least 8 characters.</div></div>' +
      '<div class="field"><label class="f">Repeat new password</label><input type="password" id="pwNew2" autocomplete="new-password"></div>' +
      '<div class="acts"><button class="btn" id="cNo">Cancel</button><button class="btn primary" id="cYes">Change password</button></div>');
    $('#cNo', m).onclick = A.closeModal;
    $('#cYes', m).onclick = function () {
      var o = $('#pwOld', m).value, n = $('#pwNew', m).value;
      if (n !== $('#pwNew2', m).value) { D.toast('The new passwords do not match.', 'err'); return; }
      A.api('changeMyPassword', o, n).then(function () { A.closeModal(); D.toast('Password changed', 'ok'); }, function (e) { D.toast(e.message, 'err'); });
    };
  };

  /* ---------- session / rendering plumbing (implemented in admin-boot.js) ---------- */
  A.refresh = function () { return A.loadState(); };
})(window);
