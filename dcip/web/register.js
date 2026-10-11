/* Public registration form */
(function () {
  'use strict';
  var D = window.DCIP, esc = D.esc, $ = function (s, r) { return (r || document).querySelector(s); }, $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var C = null, draftKey = 'dcip_draft_v2';
  var STREAMS = ['B.A', 'B.Sc', 'B.Com', 'B.Tech / B.E', 'BBA / BBM', 'BCA', 'LL.B', 'B.Ed', 'B.Voc', 'BSW', 'B.Arch', 'B.Pharm', 'MBBS / BDS / Nursing', 'Other'];
  var HEARD = ['Instagram', 'Facebook', 'College / University', 'DCIP Alumni', 'Friend / Family', 'DCIP Website', 'Newspaper / Media', 'WhatsApp', 'Other'];
  var WA_YES = 'Yes, it is', WA_NO = 'No, I use a different number';

  D.getConfig().then(function (c) { C = c; render(); heroFx(); renderBanners(c.banners || []); if (window.DCIPChat && window.DCIPChat.init) window.DCIPChat.init(c); }, function (e) {
    $('#main').innerHTML = '<div class="alert bad">' + esc(e.message) + '</div>';
  });

  function calm() { return document.documentElement.classList.contains('a11y-calm') || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
  function ageText() { return C.minAge ? C.minAge + ' to ' + C.maxAge + ' years' : 'Up to ' + C.maxAge + ' years'; }
  function ageRule() { return C.minAge ? 'between ' + C.minAge + ' and ' + C.maxAge + ' years old' : 'not older than ' + C.maxAge + ' years'; }

  /* ------------------------------------------ landing page ------------------------------------------ */
  function heroFx() {
    var items = $$('#rotor span'), i = 0;
    if (items.length > 1 && !calm()) setInterval(function () { if (calm()) return; items[i].classList.remove('on'); i = (i + 1) % items.length; items[i].classList.add('on'); }, 2800);
    $$('[data-count]').forEach(function (el) {
      var target = +el.dataset.count, plus = el.dataset.plus ? '+' : '';
      if (calm()) { el.textContent = target + plus; return; }
      var t0 = null; el.textContent = '0';
      function tick(t) { if (t0 === null) t0 = t; var p = Math.min(1, (t - t0) / 1400); el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))) + (p === 1 ? plus : ''); if (p < 1) requestAnimationFrame(tick); }
      setTimeout(function () { requestAnimationFrame(tick); }, 1300);
    });
  }

  function renderBanners(list) {
    var box = $('#banners'); if (!box || !list.length) return;
    box.hidden = false;
    box.innerHTML = '<div class="bn" id="bn">' + list.map(function (b, i) {
      return '<figure class="slide' + (i === 0 ? ' on' : '') + '" aria-hidden="' + (i === 0 ? 'false' : 'true') + '" style="margin:0"><img src="' + esc(b.url) + '" alt="' + esc(b.caption || 'DCIP highlight ' + (i + 1)) + '"' + (i ? ' loading="lazy"' : '') + '>' + (b.caption ? '<figcaption class="cap">' + esc(b.caption) + '</figcaption>' : '') + '</figure>';
    }).join('') + (list.length > 1 ? '<button type="button" class="nav prev" aria-label="Previous image">‹</button><button type="button" class="nav next" aria-label="Next image">›</button><div class="dots">' +
      list.map(function (b, i) { return '<button type="button" aria-label="Show image ' + (i + 1) + '" aria-current="' + (i === 0) + '"></button>'; }).join('') + '</div><button type="button" class="pp" id="bnPause">❚❚ Pause</button>' : '') + '</div>';
    var slides = $$('.slide', box), dots = $$('.dots button', box), at = 0, paused = calm(), timer = null;
    // an image that fails to load is dropped quietly
    $$('img', box).forEach(function (im) { im.addEventListener('error', function () { var s = im.closest('.slide'); s.dataset.bad = '1'; s.remove(); slides = $$('.slide', box); if (!slides.length) box.hidden = true; else show(0); }); });
    function show(n) {
      if (!slides.length) return; at = (n + slides.length) % slides.length;
      slides.forEach(function (s, i) { s.classList.toggle('on', i === at); s.setAttribute('aria-hidden', i === at ? 'false' : 'true'); });
      dots.forEach(function (d, i) { d.setAttribute('aria-current', i === at); });
    }
    function play() { clearInterval(timer); if (!paused && slides.length > 1) timer = setInterval(function () { show(at + 1); }, 5000); }
    if (list.length > 1) {
      $('.prev', box).onclick = function () { show(at - 1); play(); }; $('.next', box).onclick = function () { show(at + 1); play(); };
      dots.forEach(function (d, i) { d.onclick = function () { show(i); play(); }; });
      var pp = $('#bnPause'); function label() { pp.textContent = paused ? '▶ Play' : '❚❚ Pause'; }
      pp.onclick = function () { paused = !paused; label(); play(); }; label();
      var bn = $('#bn'), sx = null;
      bn.addEventListener('mouseenter', function () { clearInterval(timer); }); bn.addEventListener('mouseleave', play);
      bn.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; clearInterval(timer); }, { passive: true });
      bn.addEventListener('touchend', function (e) { if (sx !== null) { var dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 40) show(at + (dx < 0 ? 1 : -1)); } sx = null; play(); }, { passive: true });
      play();
    }
  }

  function renderFooter() {
    var phones = String(C.contactPhone || '').split(/[,;\n]/).map(function (x) { return x.trim(); }).filter(Boolean);
    var parts = phones.map(function (p) { return '<a href="tel:' + esc(p.replace(/[^+\d]/g, '')) + '">' + esc(p) + '</a>'; });
    if (C.contactEmail) parts.push('<a href="mailto:' + esc(C.contactEmail) + '">' + esc(C.contactEmail) + '</a>');
    parts.push('<a href="https://www.dcip.co.in" target="_blank" rel="noopener">www.dcip.co.in</a>');
    $('#contact').innerHTML = parts.join('<span class="sep" aria-hidden="true">|</span>');
  }

  /* --------------------------------------------- the form --------------------------------------------- */
  function render() {
    $('#batchName').textContent = C.batch;
    document.title = 'DCIP ' + C.batch + ' Registration';
    renderFooter();
    var facts = [['Internship', C.period], ['Age', ageText()], ['Degree', 'Graduation, completed by ' + D.fmtDate(C.ugBy)]];
    if (C.deadline) facts.push(['Last date', D.fmtDateTime(C.deadline.replace(' ', 'T'))]);
    $('#facts').innerHTML = facts.map(function (x) { return '<div class="fact"><span>' + esc(x[0]) + '</span>' + esc(x[1]) + '</div>'; }).join('');
    if (!C.open) {
      $('#badge').classList.add('closed'); $('#badgeText').textContent = 'Applications closed';
      $('#main').innerHTML = '<h2>Registration is closed</h2><p>The registration for the DCIP ' + esc(C.batch) + ' is not open at the moment. Thank you for your interest.</p>';
      return;
    }
    $('#main').removeAttribute('style');
    $('#main').innerHTML =
      '<form id="form" novalidate autocomplete="on">' +
      '<ol class="progress" id="progress" role="tablist" aria-label="Application steps"></ol>' +
      step(1, 'Your CV', 'Start with your CV', C.cvRequired ? 'Upload your CV and we\'ll fill in what we can. You only check it and complete the rest.' : 'Upload your CV and we\'ll fill in what we can (optional).',
        '<div class="full"><div class="field" id="fld-cv"><label class="drop" for="cv" id="drop"><span class="drop-ic" aria-hidden="true">📄</span><b id="dropTitle">Choose your CV</b><span class="muted" id="dropSub">or drop it here · PDF, DOC or DOCX · up to ' + (C.cvMaxBytes / 1048576) + ' MB</span>' +
        '<input type="file" id="cv" class="sr" accept=".pdf,.doc,.docx,application/pdf"></label><div class="err"></div>' +
        '<div id="cvStatus" role="status" aria-live="polite"></div>' +
        '<p class="hint">' + (C.cvAi ? 'To pre-fill the form, the text of your CV is read automatically and processed by an AI service. It is not stored, and your CV file goes only to the DCIP team.' : 'Your CV is read in your browser to pre-fill the form. It goes only to the DCIP team.') +
        '</p>' + (C.cvRequired ? '' : '<p><button type="button" class="btn ghost" id="skipCv">I\'ll fill in the form myself →</button></p>') + '</div></div>') +
      step(2, 'About you', 'Let\'s start with you', 'Use your name as it is on your certificates.',
        f('fullName', 'Full name', '<input type="text" id="fullName" autocomplete="name" maxlength="100">', 'full') +
        f('dob', 'Date of birth', '<input type="date" id="dob" min="1950-01-01" max="' + D.addDays(C.today, -365 * 15) + '" autocomplete="bday">', '', '<span id="ageNote"></span>') +
        f('gender', 'Gender', choice('gender', C.genders)) +
        f('email', 'E-mail address', '<input type="email" id="email" autocomplete="email" maxlength="120">', 'full', 'We will send your confirmation here, and <b>all further updates</b> too. Please double-check the spelling.') +
        f('mobile', 'Mobile number', '<input type="tel" id="mobile" inputmode="numeric" autocomplete="tel-national" maxlength="14" placeholder="10-digit number">', 'full') +
        '<div class="field full wa hidden" id="fld-waSame"><span class="q" id="lbl-waSame">Is this number on WhatsApp? <span class="req">*</span></span>' + choice('waSame', [WA_YES, WA_NO]) + '<div class="err"></div></div>' +
        f('whatsapp', 'Your WhatsApp number', '<input type="tel" id="whatsapp" inputmode="numeric" maxlength="14" placeholder="10-digit WhatsApp number">', 'full hidden', 'We may send interview updates on WhatsApp.') +
        f('altMobile', 'Another number <span class="muted">(optional)</span>', '<input type="tel" id="altMobile" inputmode="numeric" maxlength="14">', 'full', null, true)) +
      step(3, 'Home', 'Where are you from?', 'You can be from anywhere, as long as you can do the internship in Kozhikode.',
        f('district', 'District of residence', select('district', C.districts, 'Select your district'), 'full') +
        f('lbName', 'Local body', '<div class="acwrap"><input type="text" id="lbName" autocomplete="off" maxlength="80" placeholder="Start typing your panchayat / municipality / corporation"></div>', 'full',
          'Type a few letters and pick your local body from the list that appears.')) +
      step(4, 'Education', 'Tell us about your studies', 'Graduation in any field. Your UG degree must be completed on or before ' + D.fmtDate(C.ugBy) + '.',
        f('qual', 'Highest educational qualification', choice('qual', C.quals), 'full') +
        f('mastersInstitution', 'Where did you complete your master\'s degree?', '<div class="acwrap"><input type="text" id="mastersInstitution" autocomplete="off" maxlength="150" placeholder="Start typing the college / university"></div>', 'full hidden', 'Tell us the college or university for your master\'s.') +
        f('stream', 'UG / bachelor\'s degree stream', choice('stream', C.streams || STREAMS), 'full') +
        f('specialisation', 'UG subject / specialisation', '<input type="text" id="specialisation" maxlength="100" placeholder="e.g. Political Science, Economics">') +
        f('institution', 'Name of UG institution', '<div class="acwrap"><input type="text" id="institution" autocomplete="off" maxlength="150" placeholder="Start typing your college / university"></div>', '', 'Pick from the list if you see your college; otherwise type its full name.') +
        f('completion', 'UG degree completion date', '<input type="date" id="completion" min="1980-01-01" max="2040-12-31">', 'full',
          '<span id="compNote">The actual date if completed; the <b>expected date</b> if you are in your final year (it must be on or before ' + esc(D.fmtDate(C.ugBy)) + ').</span>')) +
      step(5, 'Your story', 'Almost there – tell us why', 'A few honest lines are enough.',
        f('motivation', 'What made you decide to apply to DCIP this year?', '<textarea id="motivation" maxlength="1500" rows="5"></textarea><div class="hint"><span id="mcount">0</span>/1500 characters (minimum 30)</div>', 'full') +
        f('heardFrom', 'How did you hear about DCIP?', choice('heardFrom', C.heardFrom || HEARD, true), 'full', 'Select all that apply.') +
        '<div class="full"><label class="declare"><input type="checkbox" id="declare"><span>I declare that the information given is true and complete. I understand that false information will lead to disqualification, and that all further communication will be through the e-mail address and mobile numbers given above.</span></label><div class="field" id="fld-declare"><div class="err">Please accept the declaration.</div></div></div>') +
      '<div class="hp" aria-hidden="true"><label>Website <input type="text" id="website" tabindex="-1" autocomplete="off"></label></div>' +
      '<div id="formAlert" role="alert"></div>' +
      '<div class="nav"><button type="button" class="btn ghost" id="back">← Back</button><span class="grow"></span>' +
      '<button type="button" class="btn primary" id="next">Next →</button><button type="submit" class="btn submit" id="submit">Submit application</button></div>' +
      '<div class="muted" id="submitNote" style="margin-top:10px;font-size:13px"></div>' +
      '</form>';
    bind(); bindChoices(); restoreDraft(); syncChoices(); updateLocalBody(); updateWa(); updateMasters(); liveChecks();
    typeahead($('#lbName'), (window.DCIP_LISTS || {}).kozhikodeLocalBodies || []);
    typeahead($('#institution'), (window.DCIP_LISTS || {}).colleges || []);
    typeahead($('#mastersInstitution'), (window.DCIP_LISTS || {}).colleges || []);
    $('#back').onclick = function () { showStep(cur - 1); };
    bindCv();
    $('#next').onclick = next;
    showStep(1, true);
  }

  /* ------------------------------------- button choices instead of dropdowns ------------------------------------- */
  function choice(id, list, multi) {
    return '<input type="hidden" id="' + id + '" data-options="' + esc(JSON.stringify(list)) + '"><div class="opts" id="opts-' + id + '" role="' + (multi ? 'group' : 'radiogroup') + '" aria-labelledby="lbl-' + id + '" data-for="' + id + '"' + (multi ? ' data-multi="1"' : '') + '>' +
      list.map(function (o) { return '<button type="button" class="opt" role="' + (multi ? 'checkbox' : 'radio') + '" aria-checked="false" data-v="' + esc(o) + '">' + esc(o) + '</button>'; }).join('') + '</div>';
  }
  function chosenList(id) { var v = ($('#' + id) || {}).value; return v ? String(v).split('|') : []; }
  function syncChoice(id) {
    var g = $('#opts-' + id); if (!g) return; var vals = chosenList(id);
    $$('.opt', g).forEach(function (b) { b.setAttribute('aria-checked', vals.indexOf(b.dataset.v) >= 0 ? 'true' : 'false'); });
  }
  function syncChoices() { $$('.opts').forEach(function (g) { syncChoice(g.dataset.for); }); }
  function bindChoices() {
    $$('.opts').forEach(function (g) {
      var id = g.dataset.for, hid = $('#' + id), multi = !!g.dataset.multi;
      g.addEventListener('click', function (e) {
        var b = e.target.closest('.opt'); if (!b) return;
        if (multi) { var cur = chosenList(id), i = cur.indexOf(b.dataset.v); if (i >= 0) cur.splice(i, 1); else cur.push(b.dataset.v); hid.value = cur.join('|'); } else hid.value = b.dataset.v;
        hid.dispatchEvent(new Event('input', { bubbles: true }));
      });
      hid.addEventListener('input', function () { syncChoice(id); });
    });
  }

  var applying = false, cvBusy = false, autoIds = {};
  var MAP = { fullName: 'fullName', dob: 'dob', gender: 'gender', email: 'email', mobile: 'mobile', altMobile: 'altMobile', district: 'district', localBody: 'lbName', qual: 'qual', stream: 'stream', specialisation: 'specialisation', institution: 'institution', completion: 'completion' };
  var NICE = { fullName: 'name', dob: 'date of birth', gender: 'gender', email: 'e-mail', mobile: 'mobile number', altMobile: 'second mobile', district: 'district', localBody: 'local body', qual: 'qualification', stream: 'degree stream', specialisation: 'subject', institution: 'college', completion: 'completion date' };
  function mark(id) { var f = $('#fld-' + id); if (f) f.classList.add('autofilled'); }
  function unmark(id) { delete autoIds[id]; var f = $('#fld-' + id); if (f) f.classList.remove('autofilled'); }

  /** Puts CV details into the empty fields (never over something the applicant typed) and marks them so they get checked. */
  function applyFields(f) {
    var filled = []; applying = true;
    Object.keys(MAP).forEach(function (k) {
      var id = MAP[k], v = f[k], el = $('#' + id); if (!v || !el) return;
      if (id === 'lbName' && (val('district') !== 'Kozhikode')) return;
      var cur = String(el.value || '').trim(); if (cur && !autoIds[id]) return;
      if (el.tagName === 'SELECT' && ![].some.call(el.options, function (o) { return o.value === v; })) return;
      if (el.dataset && el.dataset.options) { var opts = []; try { opts = JSON.parse(el.dataset.options); } catch (x) {} if (opts.indexOf(v) < 0) return; }
      el.value = v; autoIds[id] = true; mark(id); filled.push(k);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    applying = false;
    if (f.completionYear && !f.completion && !val('completion') && $('#compNote')) $('#compNote').innerHTML = 'Your CV mentions <b>' + esc(f.completionYear) + '</b>. Please enter the exact completion date (the expected date if you are in your final year).';
    return filled;
  }

  function cvStatus(html, cls) { var s = $('#cvStatus'); if (s) s.innerHTML = html ? '<div class="cvmsg ' + (cls || '') + '">' + html + '</div>' : ''; }
  function checkFile(file) {
    var ext = file.name.split('.').pop().toLowerCase();
    if (C.cvExt.indexOf(ext) < 0) return 'The CV must be a PDF, DOC or DOCX file.';
    if (file.size > C.cvMaxBytes) return 'The file is larger than ' + (C.cvMaxBytes / 1048576) + ' MB.';
    return '';
  }
  function bindCv() {
    var inp = $('#cv'), drop = $('#drop'); if (!inp) return;
    function chosen() {
      var file = inp.files[0]; clearErr('cv'); cvStatus('');
      if (!file) { $('#dropTitle').textContent = 'Choose your CV'; drop.classList.remove('has'); return; }
      var bad = checkFile(file); if (bad) { setErr('cv', bad); return; }
      $('#dropTitle').textContent = file.name; drop.classList.add('has'); $('#dropSub').textContent = Math.max(1, Math.round(file.size / 1024)) + ' KB · tap to change';
      var ext = file.name.split('.').pop().toLowerCase();
      if (ext === 'doc') { cvStatus('✓ CV attached. We can only read <b>PDF</b> and <b>DOCX</b> files for auto-fill, so please fill in the next steps yourself.', 'info'); return; }
      cvBusy = true; cvStatus('<span class="spin"></span> Reading your CV…', 'busy');
      w_read(file).then(function (res) {
        cvBusy = false;
        var filled = applyFields(res.fields || {});
        if (filled.length) {
          cvStatus('✨ We found <b>' + filled.length + ' detail' + (filled.length > 1 ? 's' : '') + '</b> in your CV: ' + filled.map(function (k) { return esc(NICE[k]); }).join(', ') + '. They are filled in on the next steps – <b>please check each one</b> and complete the rest.', 'ok');
        } else cvStatus('✓ CV attached. We could not read details from it (that happens with scanned or image-only files) – no problem, please fill in the next steps yourself.', 'info');
      }, function () { cvBusy = false; cvStatus('✓ CV attached. Please fill in the next steps yourself.', 'info'); });
    }
    inp.addEventListener('change', chosen);
    ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
    drop.addEventListener('drop', function (e) { if (e.dataTransfer && e.dataTransfer.files.length) { try { inp.files = e.dataTransfer.files; } catch (x) { return; } chosen(); } });
    var skip = $('#skipCv'); if (skip) skip.onclick = function () { showStep(2); };
  }
  function w_read(file) {
    return window.DCIPCv.read(file, { colleges: (window.DCIP_LISTS || {}).colleges, districts: C.districts, today: C.today, ai: !!C.cvAi,
      askServer: function (text) { return D.call('parseCv', text); } });
  }

  /* ------------------------------------ steps and the clickable tabs ------------------------------------ */
  var cur = 1, LABELS = ['Your CV', 'About you', 'Home', 'Education', 'Your story'];
  var STEP_FIELDS = { 1: ['cv'], 2: ['fullName', 'dob', 'gender', 'email', 'mobile', 'waSame', 'whatsapp', 'altMobile'], 3: ['district', 'lbName'], 4: ['qual', 'mastersInstitution', 'stream', 'specialisation', 'institution', 'completion'], 5: ['motivation', 'heardFrom', 'declare'] };
  function step(n, label, title, sub, body) {
    return '<div class="step" id="step' + n + '" role="tabpanel" data-step="' + n + '"' + (n > 1 ? ' hidden' : '') + '><div class="stephead"><small>Step ' + n + ' of 5 · ' + label + '</small><h2>' + title + '</h2><p>' + sub + '</p></div><div class="grid">' + body + '</div></div>';
  }
  function showStep(n, quiet) {
    cur = Math.max(1, Math.min(5, n));
    $$('.step').forEach(function (s) { s.hidden = +s.dataset.step !== cur; });
    $('#progress').innerHTML = LABELS.map(function (l, i) {
      return '<li role="presentation" class="' + (i + 1 < cur ? 'done' : i + 1 === cur ? 'now' : '') + '"><button type="button" role="tab" id="tab' + (i + 1) + '" aria-controls="step' + (i + 1) + '" aria-selected="' + (i + 1 === cur) + '"' + (i + 1 === cur ? ' aria-current="step"' : '') + ' data-go="' + (i + 1) + '" title="' + l + '"><div class="bar"></div><div class="lbl">' + l + '</div></button></li>';
    }).join('');
    $$('[data-go]').forEach(function (b) { b.onclick = function () { goTo(+b.dataset.go); }; });
    $('#back').style.visibility = cur === 1 ? 'hidden' : 'visible';
    $('#next').classList.toggle('hidden', cur === 5); $('#submit').classList.toggle('hidden', cur !== 5);
    $('#formAlert').innerHTML = '';
    if (!quiet) { $('#apply').scrollIntoView({ behavior: calm() ? 'auto' : 'smooth', block: 'start' }); var first = $('.step:not([hidden]) input:not([type=hidden]), .step:not([hidden]) select'); if (first && window.matchMedia('(min-width: 700px)').matches) first.focus({ preventScroll: true }); }
  }
  /** Tabs: going back is always allowed; going ahead only when every earlier step is filled in correctly. */
  function goTo(n) {
    if (n === cur) return;
    if (n < cur) { showStep(n); return; }
    if (cvBusy) { $('#formAlert').innerHTML = '<div class="alert warn">One moment – we are still reading your CV…</div>'; return; }
    var errs = validate();
    for (var s = 1; s < n; s++) {
      var keys = Object.keys(errs).filter(function (k) { return STEP_FIELDS[s].indexOf(k) >= 0; });
      if (keys.length) {
        showStep(s, true); keys.forEach(function (k) { setErr(k, errs[k]); });
        $('#formAlert').innerHTML = '<div class="alert warn">Please complete this step before moving ahead.</div>';
        var el = $('#fld-' + keys[0]); if (el) el.scrollIntoView({ behavior: calm() ? 'auto' : 'smooth', block: 'center' });
        return;
      }
    }
    showStep(n);
  }
  function next() {
    if (cur === 1 && cvBusy) { $('#formAlert').innerHTML = '<div class="alert warn">One moment – we are still reading your CV…</div>'; return; }
    var errs = validate(), keys = Object.keys(errs).filter(function (k) { return STEP_FIELDS[cur].indexOf(k) >= 0; });
    $('#formAlert').innerHTML = '';
    if (keys.length) {
      keys.forEach(function (k) { setErr(k, errs[k]); });
      var el = $('#fld-' + keys[0]); if (el) el.scrollIntoView({ behavior: calm() ? 'auto' : 'smooth', block: 'center' });
      return;
    }
    showStep(cur + 1);
  }
  function f(id, label, control, cls, hint, optional) {
    return '<div class="field ' + (cls || '') + '" id="fld-' + id + '"><label class="f" id="lbl-' + id + '" for="' + id + '">' + label + (optional ? '' : ' <span class="req">*</span>') + '</label>' + control +
      '<div class="err"></div>' + (hint ? '<div class="hint">' + hint + '</div>' : '') + '<div id="live-' + id + '"></div></div>';
  }
  function select(id, list, ph) { return '<select id="' + id + '"><option value="">' + ph + '</option>' + list.map(function (x) { return '<option>' + esc(x) + '</option>'; }).join('') + '</select>'; }

  var FIELDS = ['fullName', 'dob', 'gender', 'mobile', 'waSame', 'whatsapp', 'altMobile', 'email', 'district', 'lbName', 'qual', 'mastersInstitution', 'stream', 'specialisation', 'institution', 'completion', 'motivation', 'heardFrom'];
  function val(id) { var e = $('#' + id); return e ? String(e.value).replace(/\s+/g, ' ').trim() : ''; }

  function bind() {
    FIELDS.forEach(function (id) {
      var e = $('#' + id); if (!e) return;
      ['input', 'change'].forEach(function (ev) { e.addEventListener(ev, function () {
        if (!applying) unmark(id); clearErr(id); saveDraft();
        if (id === 'district') updateLocalBody(); if (id === 'mobile') updateWa(); if (id === 'waSame') updateWa(); if (id === 'qual') updateMasters();
        liveChecks();
      }); });
    });
    $('#motivation').addEventListener('input', function () { $('#mcount').textContent = this.value.length; });
    $('#form').addEventListener('submit', function (ev) { ev.preventDefault(); if (cur < 5) next(); else submit(); });
  }

  /* ---------- draft (kept in this browser only; never the CV) ---------- */
  function saveDraft() { try { var o = {}; FIELDS.forEach(function (id) { o[id] = $('#' + id).value; }); localStorage.setItem(draftKey, JSON.stringify(o)); } catch (e) {} }
  function restoreDraft() {
    try { var o = JSON.parse(localStorage.getItem(draftKey) || 'null'); if (o) FIELDS.forEach(function (id) { if (o[id] != null && $('#' + id)) $('#' + id).value = o[id]; }); $('#mcount').textContent = $('#motivation').value.length; } catch (e) {}
  }

  /* ---------- conditional parts ---------- */
  function updateLocalBody() {
    var koz = val('district') === 'Kozhikode', fld = $('#fld-lbName');
    fld.classList.toggle('hidden', !koz);
    if (!koz) { $('#lbName').value = ''; clearErr('lbName'); }
  }
  function localBody() { return val('district') === 'Kozhikode' ? val('lbName') : ''; }
  function phoneOk(s) { var d = String(s || '').replace(/\D/g, ''); if (d.length === 12 && d.indexOf('91') === 0) d = d.slice(2); if (d.length === 11 && d[0] === '0') d = d.slice(1); return /^[6-9]\d{9}$/.test(d); }
  /** The WhatsApp question appears as soon as a valid 10-digit number has been entered. */
  function updateWa() {
    var ok = phoneOk(val('mobile')), same = val('waSame');
    $('#fld-waSame').classList.toggle('hidden', !ok);
    $('#fld-whatsapp').classList.toggle('hidden', !(ok && same === WA_NO));
    if (same !== WA_NO) $('#whatsapp').value = '';
  }
  function updateMasters() {
    var m = /^master/i.test(val('qual')), fld = $('#fld-mastersInstitution');
    fld.classList.toggle('hidden', !m); if (!m) { $('#mastersInstitution').value = ''; clearErr('mastersInstitution'); }
  }

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
      var rule = 'Applicants must be ' + ageRule() + ' on ' + D.fmtDate(C.ageAsOn) + '.';
      if (a > C.maxAge || (C.minAge && a < C.minAge)) {
        var m = 'You will be ' + a + ' on ' + D.fmtDate(C.ageAsOn) + '. ' + rule;
        if (C.enforceAge === 'BLOCK') out.ageBlock = m; else out.ageWarn = m + ' You may apply, but the application will be marked for review.';
      }
    }
    var comp = val('completion'), q = val('qual'), pending = /pending/i.test(q);
    if (D.isIso(comp)) {
      if (comp > C.ugBy) { var m2 = 'The UG degree must be completed on or before ' + D.fmtDate(C.ugBy) + '.'; if (C.enforceCompletion === 'BLOCK') out.compBlock = m2; else out.compWarn = m2 + ' You may apply, but the application will be marked for review.'; }
      else if (q && !pending && comp > C.today) out.compBlock = 'You have chosen "completed", so the completion date cannot be in the future. If you are in your final year, choose "final year – results pending".';
      else if (pending && comp < D.addDays(C.today, -180)) out.compWarn = 'You have chosen "results pending" but the date is long past. Please check the qualification and the date.';
      else if (pending) out.compNote = 'UG completes on ' + D.fmtDate(comp) + '. Your final result will need to be confirmed.';
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
    $('#submitNote').textContent = blocked ? 'Based on the details entered, you are not eligible to apply.' : '';
  }
  function live(id, cls, text) { var e = $('#live-' + id); if (e) e.innerHTML = text ? '<div class="' + (cls === 'ok' ? 'okmsg' : cls) + '">' + esc(text) + '</div>' : ''; }

  /* ---------- validation + submit ---------- */
  function setErr(id, msg) { var fld = $('#fld-' + id); if (!fld) return; fld.classList.add('invalid'); var e = $('.err', fld); if (e) e.textContent = msg; }
  function clearErr(id) { var fld = $('#fld-' + id); if (fld) fld.classList.remove('invalid'); }

  function validate() {
    var errs = {}, r = check();
    if (val('fullName').length < 3) errs.fullName = 'Please enter your full name.';
    if (!D.isIso(val('dob'))) errs.dob = 'Please enter your date of birth.'; else if (r.ageBlock) errs.dob = r.ageBlock;
    if (!val('gender')) errs.gender = 'Please choose one.';
    if (!phoneOk(val('mobile'))) errs.mobile = 'Enter a valid 10-digit mobile number.';
    else if (!val('waSame')) errs.waSame = 'Please tell us whether this number is on WhatsApp.';
    else if (val('waSame') === WA_NO && !phoneOk(val('whatsapp'))) errs.whatsapp = 'Enter your 10-digit WhatsApp number.';
    if (val('altMobile') && !phoneOk(val('altMobile'))) errs.altMobile = 'Enter a valid 10-digit mobile number or leave it blank.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val('email'))) errs.email = 'Please enter a valid e-mail address.';
    if (!val('district')) errs.district = 'Please select your district.';
    if (!val('qual')) errs.qual = 'Please choose one.';
    if (/^master/i.test(val('qual')) && !val('mastersInstitution')) errs.mastersInstitution = 'Please enter where you completed your master\'s degree.';
    if (!val('stream')) errs.stream = 'Please choose one.';
    if (val('district') === 'Kozhikode' && !val('lbName')) errs.lbName = 'Please enter your local body.';
    ['specialisation', 'institution'].forEach(function (k) { if (!val(k)) errs[k] = 'This is required.'; });
    if (!D.isIso(val('completion'))) errs.completion = 'Please enter the completion date.'; else if (r.compBlock) errs.completion = r.compBlock;
    if (val('motivation').length < 30) errs.motivation = 'Please write at least 30 characters.';
    if (!chosenList('heardFrom').length) errs.heardFrom = 'Please choose at least one option.';
    var file = $('#cv').files[0];
    if (!file) { if (C.cvRequired) errs.cv = 'Please upload your CV.'; }
    else { var bad = checkFile(file); if (bad) errs.cv = bad; }
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
      for (var s = 1; s <= 5; s++) if (keys.some(function (k) { return STEP_FIELDS[s].indexOf(k) >= 0; })) { if (s !== cur) showStep(s, true); break; }
      keys.forEach(function (k) { setErr(k, errs[k]); });
      var first = $('#fld-' + keys.filter(function (k) { return STEP_FIELDS[cur].indexOf(k) >= 0; })[0]); if (first) first.scrollIntoView({ behavior: calm() ? 'auto' : 'smooth', block: 'center' });
      $('#formAlert').innerHTML = '<div class="alert bad">Please correct the highlighted field' + (keys.length > 1 ? 's' : '') + (cur < 5 ? ' on this step' : '') + '.</div>';
      return;
    }
    var btn = $('#submit'); btn.disabled = true; btn.textContent = 'Submitting…';
    var file = $('#cv').files[0];
    (file ? readFile(file) : Promise.resolve(null)).then(function (cv) {
      return D.call('submitApplication', {
        fullName: val('fullName'), dob: val('dob'), gender: val('gender'), email: val('email').toLowerCase(), mobile: val('mobile'),
        whatsappSame: val('waSame') === WA_YES, whatsapp: val('whatsapp'), altMobile: val('altMobile'),
        district: val('district'), localBody: localBody(), qual: val('qual'), mastersInstitution: val('mastersInstitution'), stream: val('stream'), specialisation: val('specialisation'),
        institution: val('institution'), completion: val('completion'), motivation: val('motivation'), heardFrom: chosenList('heardFrom'), cv: cv,
        website: val('website')
      });
    }).then(done, function (e) {
      btn.disabled = false; btn.textContent = 'Submit application';
      $('#formAlert').innerHTML = '<div class="alert bad">' + esc(e.message) + '</div>';
      $('#formAlert').scrollIntoView({ behavior: calm() ? 'auto' : 'smooth', block: 'center' });
    });
  }

  function done(r) {
    try { localStorage.removeItem(draftKey); } catch (e) {}
    $('#main').innerHTML = '<div class="success"><div class="tick">✓</div><h2>You\'re in! Application received</h2>' +
      '<p>Thank you for applying to DCIP.</p>' +
      (r.mailed ? '<p>A confirmation with the details you submitted is on its way to <b>' + esc(r.email) + '</b>. Check your spam folder if you don\'t see it.</p>'
                : '<p>Your application is safely recorded. The confirmation e-mail could not be sent just now; we will send it shortly. </p>') +
      '<div class="next"><b>What happens next</b><ol style="margin:0;padding-left:20px"><li>Every application is reviewed as a whole: your responses, CV and details together.</li><li>Shortlisted applicants are contacted on this e-mail address and on WhatsApp / mobile.</li><li>Interview, document verification and final selection follow.</li></ol></div></div>';
    window.scrollTo({ top: 0, behavior: calm() ? 'auto' : 'smooth' });
  }
})();
