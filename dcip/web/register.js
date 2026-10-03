/* Public registration form */
(function () {
  'use strict';
  var D = window.DCIP, esc = D.esc, $ = function (s, r) { return (r || document).querySelector(s); };
  var C = null, draftKey = 'dcip34_draft_v1';
  var LB_TYPES = ['Grama Panchayat', 'Municipality', 'Corporation'];
  var KOZ_MUNICIPALITIES = ['Koyilandy', 'Vadakara', 'Payyoli', 'Ramanattukara', 'Koduvally', 'Mukkam', 'Feroke'];
  var STREAMS = ['B.A', 'B.Sc', 'B.Com', 'B.Tech / B.E', 'BBA / BBM', 'BCA', 'LL.B', 'B.Ed', 'B.Voc', 'BSW', 'B.Arch', 'B.Pharm', 'MBBS / BDS / Nursing', 'Other'];

  D.getConfig().then(function (c) { C = c; render(); }, function (e) {
    $('#main').innerHTML = '<div class="card"><div class="alert bad">' + esc(e.message) + '</div></div>';
  });

  function render() {
    $('#title').textContent = C.batch + ' · Registration';
    document.title = 'DCIP ' + C.batch + ' Registration';
    if (C.contactEmail || C.contactPhone) $('#contact').textContent = 'Contact: ' + [C.contactEmail, C.contactPhone].filter(Boolean).join(' · ');
    if (!C.open) {
      $('#main').innerHTML = '<div class="card"><h2>Registration is closed</h2><p>The registration for the DCIP ' + esc(C.batch) + ' is not open at the moment. Thank you for your interest.</p></div>';
      return;
    }
    $('#main').innerHTML =
      '<div class="card"><h2>Before you apply</h2><ul class="rules">' +
      '<li><b class="ic">1</b><span>Internship period: <b>' + D.fmtDate(C.intakeStart) + ' to ' + D.fmtDate(C.intakeEnd) + '</b>.</span></li>' +
      '<li><b class="ic">2</b><span>Age limit: <b>' + C.maxAge + ' years or below</b> on ' + D.fmtDate(C.ageAsOn) + '.</span></li>' +
      '<li><b class="ic">3</b><span>You must have a bachelor\'s degree, and the <b>UG course must be completed on or before ' + D.fmtDate(C.intakeEnd) + '</b> (the end of the internship period).</span></li>' +
      '<li><b class="ic">4</b><span>Enter your e-mail address <b>carefully</b>. <b>All further communication will be sent to this e-mail</b> and your mobile numbers, so use ones you check regularly.</span></li>' +
      (C.deadline ? '<li><b class="ic">5</b><span>Last date to apply: <b>' + D.fmtDateTime(C.deadline.replace(' ', 'T')) + '</b>.</span></li>' : '') +
      '</ul></div>' +
      '<form id="form" novalidate autocomplete="on">' +
      section(1, 'Personal details',
        f('fullName', 'Full name', '<input type="text" id="fullName" autocomplete="name" maxlength="100">', 'full', 'As in your certificates.') +
        f('dob', 'Date of birth', '<input type="date" id="dob" min="1950-01-01" max="' + D.addDays(C.today, -365 * 15) + '" autocomplete="bday">', '', '<span id="ageNote"></span>') +
        f('gender', 'Gender', select('gender', C.genders, 'Select')) +
        f('email', 'E-mail address', '<input type="email" id="email" autocomplete="email" maxlength="120">', 'full', 'Your confirmation will be sent here. Please double-check the spelling.') +
        f('mobile', 'Primary mobile number', '<input type="tel" id="mobile" inputmode="numeric" autocomplete="tel-national" maxlength="14" placeholder="10-digit number">') +
        f('altMobile', 'Alternate mobile number <span class="muted">(optional)</span>', '<input type="tel" id="altMobile" inputmode="numeric" maxlength="14">', '', null, true)) +
      section(2, 'Where do you live?',
        f('district', 'District of residence', select('district', C.districts, 'Select')) +
        f('lbType', 'Local body type', select('lbType', LB_TYPES.concat(['Other / outside Kerala']), 'Select')) +
        f('lbName', 'Local body name', '<input type="text" id="lbName" list="lbList" maxlength="80" placeholder="e.g. Atholi, Vadakara, Kozhikode"><datalist id="lbList"></datalist>', 'full',
          'Your Grama Panchayat, Municipality or Corporation. For outside Kerala, enter your town / place and state.')) +
      section(3, 'Education',
        f('qual', 'Highest educational qualification', select('qual', C.quals, 'Select'), 'full') +
        f('stream', 'UG / bachelor\'s degree stream', select('stream', STREAMS, 'Select')) +
        f('specialisation', 'UG specialisation / subject', '<input type="text" id="specialisation" maxlength="100" placeholder="e.g. Political Science, Economics, Computer Science">') +
        f('institution', 'Name of UG institution', '<input type="text" id="institution" maxlength="150" placeholder="College, University">', 'full') +
        f('completion', 'UG degree completion date', '<input type="date" id="completion" min="1980-01-01" max="2040-12-31">', 'full',
          '<span id="compNote">Actual date if completed; <b>expected date</b> if your final-year results are pending.</span>')) +
      section(4, 'About you',
        f('motivation', 'What made you decide to apply to DCIP this year?', '<textarea id="motivation" maxlength="1500" rows="5"></textarea><div class="hint"><span id="mcount">0</span>/1500 characters (minimum 30)</div>', 'full') +
        f('cv', 'Upload your CV', '<input type="file" id="cv" accept=".pdf,.doc,.docx,application/pdf">', 'full',
          'PDF, DOC or DOCX, up to ' + (C.cvMaxBytes / 1048576) + ' MB.' + (C.cvRequired ? '' : ' (optional)'))) +
      '<div class="hp" aria-hidden="true"><label>Website <input type="text" id="website" tabindex="-1" autocomplete="off"></label></div>' +
      '<div class="card"><label style="display:flex;gap:10px;align-items:flex-start;cursor:pointer"><input type="checkbox" id="declare" style="margin-top:4px;width:18px;height:18px"><span>I declare that the information given is true and complete. I understand that false information will lead to disqualification, and that all further communication will be through the e-mail address and mobile numbers given above.</span></label><div class="field" id="fld-declare"><div class="err">Please accept the declaration.</div></div></div>' +
      '<div id="formAlert"></div>' +
      '<div class="submit"><button type="submit" class="btn primary" id="submit">Submit application</button><span class="muted" id="submitNote"></span></div>' +
      '</form>';
    bind(); restoreDraft(); updateLocalBody(); liveChecks();
  }

  function section(n, title, body) { return '<div class="card"><h2><span class="n">' + n + '</span>' + title + '</h2><div class="grid">' + body + '</div></div>'; }
  function f(id, label, control, cls, hint, optional) {
    return '<div class="field ' + (cls || '') + '" id="fld-' + id + '"><label class="f" for="' + id + '">' + label + (optional ? '' : ' <span class="req">*</span>') + '</label>' + control +
      '<div class="err"></div>' + (hint ? '<div class="hint">' + hint + '</div>' : '') + '<div id="live-' + id + '"></div></div>';
  }
  function select(id, list, ph) { return '<select id="' + id + '"><option value="">' + ph + '</option>' + list.map(function (x) { return '<option>' + esc(x) + '</option>'; }).join('') + '</select>'; }

  var FIELDS = ['fullName', 'dob', 'gender', 'mobile', 'altMobile', 'email', 'district', 'lbType', 'lbName', 'qual', 'stream', 'specialisation', 'institution', 'completion', 'motivation'];
  function val(id) { var e = $('#' + id); return e ? String(e.value).replace(/\s+/g, ' ').trim() : ''; }

  function bind() {
    FIELDS.forEach(function (id) {
      var e = $('#' + id); if (!e) return;
      ['input', 'change'].forEach(function (ev) { e.addEventListener(ev, function () { clearErr(id); saveDraft(); if (id === 'district' || id === 'lbType') updateLocalBody(); liveChecks(); }); });
    });
    $('#motivation').addEventListener('input', function () { $('#mcount').textContent = this.value.length; });
    $('#form').addEventListener('submit', function (ev) { ev.preventDefault(); submit(); });
  }

  /* ---------- draft (kept in this browser only; never the CV or the verification) ---------- */
  function saveDraft() { try { var o = {}; FIELDS.forEach(function (id) { o[id] = $('#' + id).value; }); localStorage.setItem(draftKey, JSON.stringify(o)); } catch (e) {} }
  function restoreDraft() {
    try { var o = JSON.parse(localStorage.getItem(draftKey) || 'null'); if (o) FIELDS.forEach(function (id) { if (o[id] != null) $('#' + id).value = o[id]; }); $('#mcount').textContent = $('#motivation').value.length; } catch (e) {}
  }

  /* ---------- local body ---------- */
  function updateLocalBody() {
    var d = val('district'), t = $('#lbType');
    if (d === 'Outside Kerala') { if (t.value !== 'Other / outside Kerala') t.value = 'Other / outside Kerala'; }
    var dl = $('#lbList'); dl.innerHTML = '';
    if (d === 'Kozhikode' && val('lbType') === 'Municipality') dl.innerHTML = KOZ_MUNICIPALITIES.map(function (m) { return '<option value="' + m + '">'; }).join('');
    if (d === 'Kozhikode' && val('lbType') === 'Corporation' && !val('lbName')) $('#lbName').value = 'Kozhikode';
  }
  function localBody() {
    var t = val('lbType'), n = val('lbName');
    if (!n) return '';
    if (t === 'Other / outside Kerala' || !t) return n;
    return new RegExp(t.split(' ').pop() + '|panchayat|panchayath', 'i').test(n) ? n : n + ' ' + t;
  }

  /* ---------- live eligibility feedback (the server re-checks everything) ---------- */
  function check() {
    var out = { age: null, ageBlock: null, ageWarn: null, comp: null, compBlock: null, compWarn: null };
    var dob = val('dob');
    if (D.isIso(dob)) {
      var a = D.ageOn(dob, C.ageAsOn); out.age = a;
      if (a > C.maxAge) { var m = 'You will be ' + a + ' on ' + D.fmtDate(C.ageAsOn) + '. The age limit is ' + C.maxAge + ' years.'; if (C.enforceAge === 'BLOCK') out.ageBlock = m; else out.ageWarn = m + ' You may apply, but the application will be marked for review.'; }
      else if (C.minAge && a < C.minAge) out.ageBlock = 'Please check the date of birth. The minimum age is ' + C.minAge + ' years.';
    }
    var comp = val('completion'), q = val('qual'), pending = /pending/i.test(q);
    if (D.isIso(comp)) {
      if (comp > C.intakeEnd) { var m2 = 'The UG course must be completed by ' + D.fmtDate(C.intakeEnd) + ', the end of the internship period.'; if (C.enforceCompletion === 'BLOCK') out.compBlock = m2; else out.compWarn = m2 + ' You may apply, but the application will be marked for review.'; }
      else if (q && !pending && comp > C.today) out.compBlock = 'You have chosen "completed", so the completion date cannot be in the future. If your results are pending, choose "final year – results pending".';
      else if (pending && comp < D.addDays(C.today, -180)) out.compWarn = 'You have chosen "results pending" but the date is long past. Please check the qualification and the date.';
      else if (pending) out.compNote = 'UG completes on ' + D.fmtDate(comp) + ' – within the internship period. Your final result will need to be confirmed.';
    }
    return out;
  }
  function liveChecks() {
    var r = check();
    live('dob', r.age != null && !r.ageBlock && !r.ageWarn ? 'ok' : r.ageWarn ? 'warnmsg' : '', r.age != null && !r.ageBlock ? (r.ageWarn ? r.ageWarn : 'Age on ' + D.fmtDate(C.ageAsOn) + ': ' + r.age + ' ✓') : '');
    live('completion', r.compWarn ? 'warnmsg' : r.compNote ? 'okmsg' : '', r.compWarn || r.compNote || '');
    if (r.ageBlock) setErr('dob', r.ageBlock); if (r.compBlock) setErr('completion', r.compBlock);
    var blocked = !!(r.ageBlock || r.compBlock);
    $('#submit').disabled = blocked;
    $('#submitNote').textContent = blocked ? 'You are not eligible to apply based on the details entered.' : '';
  }
  function live(id, cls, text) { var e = $('#live-' + id); if (e) e.innerHTML = text ? '<div class="' + (cls === 'ok' ? 'okmsg' : cls) + '">' + esc(text) + '</div>' : ''; }

  /* ---------- validation + submit ---------- */
  function setErr(id, msg) { var fld = $('#fld-' + id); if (!fld) return; fld.classList.add('invalid'); var e = $('.err', fld); if (e) e.textContent = msg; }
  function clearErr(id) { var fld = $('#fld-' + id); if (fld) fld.classList.remove('invalid'); }

  function validate() {
    var errs = {}, r = check();
    if (val('fullName').length < 3) errs.fullName = 'Please enter your full name.';
    if (!D.isIso(val('dob'))) errs.dob = 'Please enter your date of birth.'; else if (r.ageBlock) errs.dob = r.ageBlock;
    if (!val('gender')) errs.gender = 'Please select.';
    var m = val('mobile').replace(/\D/g, ''); if (m.length === 12 && m.indexOf('91') === 0) m = m.slice(2); if (m.length === 11 && m[0] === '0') m = m.slice(1);
    if (!/^[6-9]\d{9}$/.test(m)) errs.mobile = 'Enter a valid 10-digit mobile number.';
    if (val('altMobile')) { var a = val('altMobile').replace(/\D/g, ''); if (a.length === 12 && a.indexOf('91') === 0) a = a.slice(2); if (!/^[6-9]\d{9}$/.test(a)) errs.altMobile = 'Enter a valid 10-digit mobile number or leave it blank.'; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val('email'))) errs.email = 'Please enter a valid e-mail address.';
    ['district', 'qual', 'stream'].forEach(function (k) { if (!val(k)) errs[k] = 'Please select.'; });
    if (!val('lbType')) errs.lbType = 'Please select.';
    if (!val('lbName')) errs.lbName = 'Please enter your local body.';
    ['specialisation', 'institution'].forEach(function (k) { if (!val(k)) errs[k] = 'This is required.'; });
    if (!D.isIso(val('completion'))) errs.completion = 'Please enter the completion date.'; else if (r.compBlock) errs.completion = r.compBlock;
    if (val('motivation').length < 30) errs.motivation = 'Please write at least 30 characters.';
    var file = $('#cv').files[0];
    if (!file) { if (C.cvRequired) errs.cv = 'Please upload your CV.'; }
    else {
      var ext = file.name.split('.').pop().toLowerCase();
      if (C.cvExt.indexOf(ext) < 0) errs.cv = 'The CV must be a PDF, DOC or DOCX file.';
      else if (file.size > C.cvMaxBytes) errs.cv = 'The file is larger than ' + (C.cvMaxBytes / 1048576) + ' MB.';
    }
    if (!$('#declare').checked) errs.declare = 'Please accept the declaration.';
    return errs;
  }

  function readFile(file) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onload = function () { res({ name: file.name, data: String(fr.result).split(',')[1] }); };
      fr.onerror = function () { rej(new Error('Could not read the CV file.')); };
      fr.readAsDataURL(file);
    });
  }

  function submit() {
    FIELDS.concat(['cv', 'declare']).forEach(clearErr);
    $('#formAlert').innerHTML = '';
    var errs = validate(), keys = Object.keys(errs);
    if (keys.length) {
      keys.forEach(function (k) { setErr(k, errs[k]); });
      var first = $('#fld-' + keys[0]); if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      $('#formAlert').innerHTML = '<div class="alert bad">Please correct the ' + keys.length + ' highlighted field' + (keys.length > 1 ? 's' : '') + '.</div>';
      return;
    }
    var btn = $('#submit'); btn.disabled = true; btn.textContent = 'Submitting…';
    var file = $('#cv').files[0];
    (file ? readFile(file) : Promise.resolve(null)).then(function (cv) {
      return D.call('submitApplication', {
        fullName: val('fullName'), dob: val('dob'), gender: val('gender'), email: val('email').toLowerCase(), mobile: val('mobile'), altMobile: val('altMobile'),
        district: val('district'), localBody: localBody(), qual: val('qual'), stream: val('stream'), specialisation: val('specialisation'),
        institution: val('institution'), completion: val('completion'), motivation: val('motivation'), cv: cv,
        website: val('website')
      });
    }).then(done, function (e) {
      btn.disabled = false; btn.textContent = 'Submit application';
      $('#formAlert').innerHTML = '<div class="alert bad">' + esc(e.message) + '</div>';
      $('#formAlert').scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  function done(r) {
    try { localStorage.removeItem(draftKey); } catch (e) {}
    $('#main').innerHTML = '<div class="card done"><div class="tick">✓</div><h2 style="justify-content:center;font-size:22px">Application received</h2>' +
      '<div class="ref">' + esc(r.id) + '</div><p>Please note your reference number.</p>' +
      (r.mailed ? '<p>A confirmation with the details you submitted has been sent to <b>' + esc(r.email) + '</b>. Please check it, and look in your spam folder if you do not see it.</p>'
                : '<p>We could not send the confirmation e-mail right now, but your application is recorded. Keep your reference number safe.</p>') +
      '<p><b>All further communication will be sent to this e-mail address and your mobile numbers.</b></p></div>';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
})();
