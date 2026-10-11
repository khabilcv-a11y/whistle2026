/* Public registration form */
(function () {
  'use strict';
  var D = window.DCIP, esc = D.esc, $ = function (s, r) { return (r || document).querySelector(s); };
  var C = null, draftKey = 'dcip34_draft_v1';
  var STREAMS = ['B.A', 'B.Sc', 'B.Com', 'B.Tech / B.E', 'BBA / BBM', 'BCA', 'LL.B', 'B.Ed', 'B.Voc', 'BSW', 'B.Arch', 'B.Pharm', 'MBBS / BDS / Nursing', 'Other'];

  D.getConfig().then(function (c) { C = c; render(); if (window.DCIPChat && window.DCIPChat.init) window.DCIPChat.init(c); }, function (e) {
    $('#main').innerHTML = '<div class="card"><div class="alert bad">' + esc(e.message) + '</div></div>';
  });

  function render() {
    $('#batchName').textContent = C.batch;
    document.title = 'DCIP ' + C.batch + ' Registration';
    if (C.contactEmail || C.contactPhone) $('#contact').textContent = 'Contact: ' + [C.contactEmail, C.contactPhone].filter(Boolean).join(' · ');
    var facts = [['Internship', D.fmtDate(C.intakeStart) + ' – ' + D.fmtDate(C.intakeEnd)], ['Age', (C.minAge ? C.minAge + ' to ' + C.maxAge : C.maxAge + ' or below') + ' years'], ['Degree', 'UG completed by ' + D.fmtDate(C.intakeEnd)]];
    if (C.deadline) facts.push(['Last date', D.fmtDateTime(C.deadline.replace(' ', 'T'))]);
    $('#facts').innerHTML = facts.map(function (x) { return '<div class="fact"><span>' + esc(x[0]) + '</span>' + esc(x[1]) + '</div>'; }).join('');
    if (!C.open) {
      $('#badge').classList.add('closed'); $('#badgeText').textContent = 'Applications closed'; $('#cta').classList.add('hidden');
      $('#main').innerHTML = '<h2>Registration is closed</h2><p>The registration for the DCIP ' + esc(C.batch) + ' is not open at the moment. Thank you for your interest.</p>';
      return;
    }
    $('#main').removeAttribute('style');
    $('#main').innerHTML =
      '<form id="form" novalidate autocomplete="on">' +
      '<ol class="progress" id="progress"></ol>' +
      step(1, 'About you', 'Let\'s start with you', 'Use your name as it is on your certificates.',
        f('fullName', 'Full name', '<input type="text" id="fullName" autocomplete="name" maxlength="100">', 'full') +
        f('dob', 'Date of birth', '<input type="date" id="dob" min="1950-01-01" max="' + D.addDays(C.today, -365 * 15) + '" autocomplete="bday">', '', '<span id="ageNote"></span>') +
        f('gender', 'Gender', select('gender', C.genders, 'Select')) +
        f('email', 'E-mail address', '<input type="email" id="email" autocomplete="email" maxlength="120">', 'full', 'We will send your confirmation here, and <b>all further updates</b> too. Please double-check the spelling.') +
        f('mobile', 'Mobile number', '<input type="tel" id="mobile" inputmode="numeric" autocomplete="tel-national" maxlength="14" placeholder="10-digit number">') +
        f('altMobile', 'Alternate mobile <span class="muted">(optional)</span>', '<input type="tel" id="altMobile" inputmode="numeric" maxlength="14">', '', null, true)) +
      step(2, 'Home', 'Where are you from?', 'This helps us understand the reach of the programme.',
        f('district', 'District of residence', select('district', C.districts, 'Select')) +
        f('lbName', 'Local body', '<div class="acwrap"><input type="text" id="lbName" autocomplete="off" maxlength="80" placeholder="Start typing your panchayat / municipality / corporation"></div>', 'full',
          'Type a few letters and pick your local body from the list that appears.')) +
      step(3, 'Education', 'Tell us about your studies', 'A bachelor\'s degree is needed, completed by ' + D.fmtDate(C.intakeEnd) + '.',
        f('qual', 'Highest educational qualification', select('qual', C.quals, 'Select'), 'full') +
        f('stream', 'UG / bachelor\'s degree stream', select('stream', STREAMS, 'Select')) +
        f('specialisation', 'UG subject / specialisation', '<input type="text" id="specialisation" maxlength="100" placeholder="e.g. Political Science, Economics">') +
        f('institution', 'Name of UG institution', '<div class="acwrap"><input type="text" id="institution" autocomplete="off" maxlength="150" placeholder="Start typing your college / university"></div>', 'full', 'Pick from the list if you see your college; otherwise type its full name.') +
        f('completion', 'UG degree completion date', '<input type="date" id="completion" min="1980-01-01" max="2040-12-31">', 'full',
          '<span id="compNote">The actual date if completed; the <b>expected date</b> if your final-year results are pending.</span>')) +
      step(4, 'Your story', 'Almost there – tell us why', 'A few honest lines are enough.',
        f('motivation', 'What made you decide to apply to DCIP this year?', '<textarea id="motivation" maxlength="1500" rows="5"></textarea><div class="hint"><span id="mcount">0</span>/1500 characters (minimum 30)</div>', 'full') +
        f('cv', 'Upload your CV', '<input type="file" id="cv" accept=".pdf,.doc,.docx,application/pdf">', 'full',
          'PDF, DOC or DOCX, up to ' + (C.cvMaxBytes / 1048576) + ' MB.' + (C.cvRequired ? '' : ' (optional)')) +
        '<div class="full"><label class="declare"><input type="checkbox" id="declare"><span>I declare that the information given is true and complete. I understand that false information will lead to disqualification, and that all further communication will be through the e-mail address and mobile numbers given above.</span></label><div class="field" id="fld-declare"><div class="err">Please accept the declaration.</div></div></div>') +
      '<div class="hp" aria-hidden="true"><label>Website <input type="text" id="website" tabindex="-1" autocomplete="off"></label></div>' +
      '<div id="formAlert" role="alert"></div>' +
      '<div class="nav"><button type="button" class="btn ghost" id="back">← Back</button><span class="grow"></span>' +
      '<button type="button" class="btn primary" id="next">Next →</button><button type="submit" class="btn submit" id="submit">Submit application</button></div>' +
      '<div class="muted" id="submitNote" style="margin-top:10px;font-size:13px"></div>' +
      '</form>';
    bind(); restoreDraft(); updateLocalBody(); liveChecks();
    typeahead($('#lbName'), (window.DCIP_LISTS || {}).kozhikodeLocalBodies || []);
    typeahead($('#institution'), (window.DCIP_LISTS || {}).colleges || []);
    $('#back').onclick = function () { showStep(cur - 1); };
    $('#next').onclick = next;
    showStep(1, true);
  }

  var cur = 1, LABELS = ['About you', 'Home', 'Education', 'Your story'];
  var STEP_FIELDS = { 1: ['fullName', 'dob', 'gender', 'email', 'mobile', 'altMobile'], 2: ['district', 'lbName'], 3: ['qual', 'stream', 'specialisation', 'institution', 'completion'], 4: ['motivation', 'cv', 'declare'] };
  function step(n, label, title, sub, body) {
    return '<div class="step" data-step="' + n + '"' + (n > 1 ? ' hidden' : '') + '><div class="stephead"><small>Step ' + n + ' of 4 · ' + label + '</small><h2>' + title + '</h2><p>' + sub + '</p></div><div class="grid">' + body + '</div></div>';
  }
  function showStep(n, quiet) {
    cur = Math.max(1, Math.min(4, n));
    [].forEach.call(document.querySelectorAll('.step'), function (s) { s.hidden = +s.dataset.step !== cur; });
    $('#progress').innerHTML = LABELS.map(function (l, i) {
      var go = i + 1 < cur;
      return '<li class="' + (go ? 'done' : i + 1 === cur ? 'now' : '') + '"' + (go ? ' data-go="' + (i + 1) + '" role="button" tabindex="0" aria-label="Go back to step ' + (i + 1) + ': ' + l + '"' : '') + '><div class="bar"></div><div class="lbl">' + l + '</div></li>';
    }).join('');
    [].forEach.call(document.querySelectorAll('[data-go]'), function (b) {
      b.onclick = function () { showStep(+b.dataset.go); };
      b.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showStep(+b.dataset.go); } };
    });
    $('#back').style.visibility = cur === 1 ? 'hidden' : 'visible';
    $('#next').classList.toggle('hidden', cur === 4); $('#submit').classList.toggle('hidden', cur !== 4);
    $('#formAlert').innerHTML = '';
    if (!quiet) { $('#apply').scrollIntoView({ behavior: 'smooth', block: 'start' }); var first = $('.step:not([hidden]) input, .step:not([hidden]) select'); if (first && window.matchMedia('(min-width: 700px)').matches) first.focus({ preventScroll: true }); }
  }
  function next() {
    var errs = validate(), keys = Object.keys(errs).filter(function (k) { return STEP_FIELDS[cur].indexOf(k) >= 0; });
    $('#formAlert').innerHTML = '';
    if (keys.length) {
      keys.forEach(function (k) { setErr(k, errs[k]); });
      var el = $('#fld-' + keys[0]); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    showStep(cur + 1);
  }
  function f(id, label, control, cls, hint, optional) {
    return '<div class="field ' + (cls || '') + '" id="fld-' + id + '"><label class="f" for="' + id + '">' + label + (optional ? '' : ' <span class="req">*</span>') + '</label>' + control +
      '<div class="err"></div>' + (hint ? '<div class="hint">' + hint + '</div>' : '') + '<div id="live-' + id + '"></div></div>';
  }
  function select(id, list, ph) { return '<select id="' + id + '"><option value="">' + ph + '</option>' + list.map(function (x) { return '<option>' + esc(x) + '</option>'; }).join('') + '</select>'; }

  var FIELDS = ['fullName', 'dob', 'gender', 'mobile', 'altMobile', 'email', 'district', 'lbName', 'qual', 'stream', 'specialisation', 'institution', 'completion', 'motivation'];
  function val(id) { var e = $('#' + id); return e ? String(e.value).replace(/\s+/g, ' ').trim() : ''; }

  function bind() {
    FIELDS.forEach(function (id) {
      var e = $('#' + id); if (!e) return;
      ['input', 'change'].forEach(function (ev) { e.addEventListener(ev, function () { clearErr(id); saveDraft(); if (id === 'district') updateLocalBody(); liveChecks(); }); });
    });
    $('#motivation').addEventListener('input', function () { $('#mcount').textContent = this.value.length; });
    $('#form').addEventListener('submit', function (ev) { ev.preventDefault(); if (cur < 4) next(); else submit(); });
  }

  /* ---------- draft (kept in this browser only; never the CV or the verification) ---------- */
  function saveDraft() { try { var o = {}; FIELDS.forEach(function (id) { o[id] = $('#' + id).value; }); localStorage.setItem(draftKey, JSON.stringify(o)); } catch (e) {} }
  function restoreDraft() {
    try { var o = JSON.parse(localStorage.getItem(draftKey) || 'null'); if (o) FIELDS.forEach(function (id) { if (o[id] != null) $('#' + id).value = o[id]; }); $('#mcount').textContent = $('#motivation').value.length; } catch (e) {}
  }

  /* ---------- local body (asked only from Kozhikode residents) ---------- */
  function updateLocalBody() {
    var koz = val('district') === 'Kozhikode', fld = $('#fld-lbName');
    fld.classList.toggle('hidden', !koz);
    if (!koz) { $('#lbName').value = ''; clearErr('lbName'); }
  }
  function localBody() { return val('district') === 'Kozhikode' ? val('lbName') : ''; }

  /* ---------- type-ahead: a list that appears only while the typed text matches ---------- */
  function typeahead(input, entries) {
    var box = document.createElement('ul'), idx = -1, shown = [];
    var parsed = entries.map(function (e) { var p = e.split('|'); return { label: p[0], keys: p.map(norm) }; });
    box.className = 'ac'; box.setAttribute('role', 'listbox'); box.hidden = true; box.id = input.id + '-list';
    input.parentNode.appendChild(box);
    input.setAttribute('role', 'combobox'); input.setAttribute('aria-autocomplete', 'list'); input.setAttribute('aria-controls', box.id); input.setAttribute('aria-expanded', 'false');
    function norm(s) { return String(s).toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim(); }
    function close() { box.hidden = true; idx = -1; input.setAttribute('aria-expanded', 'false'); }
    function choose(i) { input.value = shown[i].label; close(); input.dispatchEvent(new Event('input', { bubbles: true })); }
    function paint() { [].forEach.call(box.children, function (li, i) { li.setAttribute('aria-selected', i === idx); if (i === idx) li.scrollIntoView({ block: 'nearest' }); }); }
    function search() {
      var q = norm(input.value);
      if (!q) { close(); return; }
      var words = q.split(' '), hits = [];
      parsed.forEach(function (e) {
        for (var k = 0; k < e.keys.length; k++) {
          var key = e.keys[k];
          if (words.every(function (w) { return key.indexOf(w) >= 0; })) { hits.push({ label: e.label, rank: key.indexOf(q) === 0 ? 0 : key.indexOf(' ' + q) >= 0 ? 1 : 2 }); return; }
        }
      });
      hits.sort(function (a, b) { return a.rank - b.rank || a.label.length - b.label.length; });
      shown = hits.slice(0, 8);
      if (!shown.length || (shown.length === 1 && norm(shown[0].label) === q)) { close(); return; }
      box.innerHTML = shown.map(function (h, i) { return '<li role="option" data-i="' + i + '">' + esc(h.label) + '</li>'; }).join('');
      box.hidden = false; idx = -1; input.setAttribute('aria-expanded', 'true');
    }
    input.addEventListener('input', search);
    input.addEventListener('blur', function () { setTimeout(close, 150); });
    input.addEventListener('keydown', function (e) {
      if (box.hidden) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); idx = (idx + 1) % shown.length; paint(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); idx = (idx - 1 + shown.length) % shown.length; paint(); }
      else if (e.key === 'Enter' && idx >= 0) { e.preventDefault(); choose(idx); }
      else if (e.key === 'Escape') close();
    });
    box.addEventListener('mousedown', function (e) { e.preventDefault(); var li = e.target.closest('li'); if (li) choose(+li.dataset.i); });
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
    if (val('district') === 'Kozhikode' && !val('lbName')) errs.lbName = 'Please enter your local body.';
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
      for (var s = 1; s <= 4; s++) if (keys.some(function (k) { return STEP_FIELDS[s].indexOf(k) >= 0; })) { if (s !== cur) showStep(s, true); break; }
      keys.forEach(function (k) { setErr(k, errs[k]); });
      var first = $('#fld-' + keys.filter(function (k) { return STEP_FIELDS[cur].indexOf(k) >= 0; })[0]); if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      $('#formAlert').innerHTML = '<div class="alert bad">Please correct the highlighted field' + (keys.length > 1 ? 's' : '') + (cur < 4 ? ' on this step' : '') + '.</div>';
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
    $('#main').innerHTML = '<div class="success"><div class="tick">✓</div><h2>You\'re in! Application received</h2>' +
      '<p>Thank you for applying to DCIP. Please note your reference number:</p><div class="ref">' + esc(r.id) + '</div>' +
      (r.mailed ? '<p>A confirmation with the details you submitted is on its way to <b>' + esc(r.email) + '</b>. Check your spam folder if you don\'t see it.</p>'
                : '<p>We could not send the confirmation e-mail right now, but your application is recorded. Keep your reference number safe.</p>') +
      '<div class="next"><b>What happens next</b><ol style="margin:0;padding-left:20px"><li>We screen applications for eligibility.</li><li>Shortlisted applicants are contacted on this e-mail and mobile number.</li><li>Interview, document verification and final selection follow.</li></ol></div></div>';
    $('#cta').classList.add('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
})();
