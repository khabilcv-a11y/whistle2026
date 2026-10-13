/* Public registration form: one continuous page */
(function () {
  'use strict';
  var D = window.DCIP, esc = D.esc, $ = function (s, r) { return (r || document).querySelector(s); }, $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var C = null, draftKey = 'dcip_draft_v3';
  var STREAMS = ['B.A', 'B.Sc', 'B.Com', 'B.Tech / B.E', 'BBA / BBM', 'BCA', 'LL.B', 'B.Ed', 'B.Voc', 'BSW', 'B.Arch', 'B.Pharm', 'MBBS / BDS / Nursing', 'Other'];
  var HEARD = ['Instagram', 'Facebook', 'LinkedIn', 'College / University', 'DCIP Alumni', 'Friend / Family', 'DCIP Website', 'Newspaper / Media', 'WhatsApp', 'Other'];
  var WA_YES = 'Yes, it is', WA_NO = 'No, I use a different number', MAX_WORDS = 1000;
  var pickers = {};

  D.getConfig().then(function (c) {
    C = c; render(); heroFx(); renderBanners(c.banners || []); countdown();
    if (window.DCIPSkyline) window.DCIPSkyline.mount($('.hero'));
    if (window.DCIPChat && window.DCIPChat.init) window.DCIPChat.init(c);
  }, function (e) {
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

  /** Time left to apply: shown in the header and, once the header has scrolled away, in a slim bar at the top. */
  function countdown() {
    if (!C.deadline || !C.open) return;
    var end = new Date(String(C.deadline).replace(' ', 'T') + (String(C.deadline).length <= 16 ? ':00' : '') + '+05:30').getTime();
    if (isNaN(end)) return;
    var box = $('#dl'), t = $('#dlT'), bar = $('#dlBar'), top = $('#dlbar'), topT = $('#dlbarT'), hero = $('.hero'), WINDOW = 30 * 86400000;
    box.hidden = false; top.hidden = false;
    $('#dlWhen').textContent = 'Last date: ' + new Date(end).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }) + ' IST';
    function tick() {
      var left = end - Date.now();
      if (left <= 0) { clearInterval(iv); location.reload(); return; }
      var d = Math.floor(left / 86400000), h = Math.floor(left % 86400000 / 3600000), m = Math.floor(left % 3600000 / 60000), s = Math.floor(left % 60000 / 1000);
      t.innerHTML = [[d, 'days'], [h, 'hrs'], [m, 'min'], [s, 'sec']].map(function (x) { return '<div><b>' + ('0' + x[0]).slice(-2) + '</b><span>' + x[1] + '</span></div>'; }).join('');
      topT.textContent = (d ? d + 'd ' : '') + ('0' + h).slice(-2) + 'h ' + ('0' + m).slice(-2) + 'm' + (d ? '' : ' ' + ('0' + s).slice(-2) + 's');
      bar.style.width = Math.max(2, Math.min(100, (1 - left / WINDOW) * 100)) + '%';
      var urgent = left < 2 * 86400000; box.classList.toggle('urgent', urgent); top.classList.toggle('urgent', urgent);
      top.classList.toggle('show', window.scrollY > (hero ? hero.offsetHeight - 40 : 400));
    }
    var iv = setInterval(tick, 1000); tick();
    window.addEventListener('scroll', function () { top.classList.toggle('show', window.scrollY > (hero ? hero.offsetHeight - 40 : 400)); }, { passive: true });
  }

  /** The slider turns by itself: no buttons. A picture that cannot be loaded is skipped quietly. */
  function renderBanners(list) {
    var box = $('#banners'); if (!box || !list.length) return;
    box.innerHTML = '<div class="bn" id="bn">' + list.map(function (b, i) {
      return '<figure class="slide" style="margin:0"><img src="' + esc(b.url) + '" alt="' + esc(b.caption || 'DCIP highlight ' + (i + 1)) + '" referrerpolicy="no-referrer" decoding="async">' + (b.caption ? '<figcaption class="cap">' + esc(b.caption) + '</figcaption>' : '') + '</figure>';
    }).join('') + '<div class="dots" aria-hidden="true"></div></div>';
    var slides = $$('.slide', box), at = -1, timer = null, loaded = 0;
    function dots() { var d = $('.dots', box); d.innerHTML = slides.map(function (s, i) { return '<span aria-current="' + (i === at) + '"></span>'; }).join(''); d.style.display = slides.length > 1 ? '' : 'none'; }
    function show(n) {
      if (!slides.length) return; at = (n + slides.length) % slides.length;
      slides.forEach(function (s, i) { s.classList.toggle('on', i === at); });
      var cur = slides[at].querySelector('img'), nx = slides[(at + 1) % slides.length].querySelector('img'); if (nx) nx.loading = 'eager';
      dots();
    }
    function start() { clearInterval(timer); if (slides.length > 1 && !calm()) timer = setInterval(function () { if (!document.hidden) show(at + 1); }, 5200); }
    $$('img', box).forEach(function (im) {
      im.addEventListener('load', function () { loaded++; if (loaded === 1) { box.hidden = false; show(Math.max(0, slides.indexOf(im.closest('.slide')))); start(); } });
      im.addEventListener('error', function () {
        var sl = im.closest('.slide'), was = slides[at] === sl; slides = slides.filter(function (x) { return x !== sl; }); sl.remove();
        if (!slides.length) { box.hidden = true; return; } if (was) show(0); else dots();
      });
    });
    document.addEventListener('visibilitychange', function () { if (!document.hidden) start(); });
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
    $('#facts').innerHTML = facts.map(function (x) { return '<div class="fact"><span>' + esc(x[0]) + '</span>' + esc(x[1]) + '</div>'; }).join('');
    if (!C.open) {
      $('#badge').classList.add('closed'); $('#badgeText').textContent = 'Applications closed';
      $('#main').innerHTML = '<h2>Registration is closed</h2><p>The registration for the DCIP ' + esc(C.batch) + ' is not open at the moment. Thank you for your interest.</p>';
      return;
    }
    $('#main').removeAttribute('style');
    var states = C.states || [];
    $('#main').innerHTML =
      '<form id="form" novalidate autocomplete="on">' +
      '<div class="formhead"><h2>Apply for the ' + esc(C.batch) + '</h2><p>It takes about 5 minutes. Upload your CV and we\'ll fill in what we can. You only check it and complete the rest.</p></div>' +
      '<div class="grid">' +
      '<div class="full"><div class="field" id="fld-cv"><label class="drop" for="cv" id="drop"><span class="drop-ic" aria-hidden="true">📄</span><b id="dropTitle">Choose your CV</b><span class="muted" id="dropSub">or drop it here · PDF, DOC or DOCX · up to ' + (C.cvMaxBytes / 1048576) + ' MB</span>' +
        '<input type="file" id="cv" class="sr" accept=".pdf,.doc,.docx,application/pdf"></label><div class="err"></div>' +
        '<div id="cvStatus" role="status" aria-live="polite"></div>' +
        '<p class="hint">' + (C.cvAi ? 'To pre-fill the form, the text of your CV is read automatically and processed by an AI service. It is not stored, and your CV file goes only to the DCIP team.' : 'Your CV is read in your browser to pre-fill the form. It goes only to the DCIP team.') + '</p></div></div>' +
      f('fullName', 'Full name', '<input type="text" id="fullName" autocomplete="name" maxlength="100">', 'full', 'Use your name as it is on your certificates.') +
      f('dob', 'Date of birth', '<input type="hidden" id="dob">', '', '<span id="ageNote"></span>') +
      f('gender', 'Gender', choice('gender', C.genders)) +
      f('email', 'E-mail address', '<input type="email" id="email" autocomplete="email" maxlength="120">', 'full', 'We will send your confirmation here, and <b>all further updates</b> too. Please double-check the spelling.') +
      f('mobile', 'Mobile number', '<input type="tel" id="mobile" inputmode="numeric" autocomplete="tel-national" maxlength="14" placeholder="10-digit number">', '') +
      f('altMobile', 'Another number <span class="muted">(optional)</span>', '<input type="tel" id="altMobile" inputmode="numeric" maxlength="14">', '', null, true) +
      '<div class="field full wa hidden" id="fld-waSame"><span class="q" id="lbl-waSame">Is this number on WhatsApp? <span class="req">*</span></span>' + choice('waSame', [WA_YES, WA_NO]) + '<div class="err"></div></div>' +
      f('whatsapp', 'Your WhatsApp number', '<input type="tel" id="whatsapp" inputmode="numeric" maxlength="14" placeholder="10-digit WhatsApp number">', 'full hidden', 'We may send interview updates on WhatsApp.') +
      f('district', 'District of residence', choice('district', C.districts, false, 'dense'), 'full', 'You can be from anywhere, as long as you can do the internship in Kozhikode.') +
      f('state', 'Which state?', '<div class="acwrap"><input type="text" id="state" autocomplete="off" maxlength="60" placeholder="Start typing, then pick your state from the list"></div>', 'full hidden') +
      f('lbName', 'Local body', '<div class="acwrap"><input type="text" id="lbName" autocomplete="off" maxlength="80" placeholder="Start typing your panchayat / municipality / corporation"></div>', 'full hidden',
        'Type a few letters and pick your local body from the list that appears.') +
      f('qual', 'Highest educational qualification', choice('qual', C.quals), 'full') +
      f('mastersInstitution', 'Where did you complete your master\'s degree?', '<div class="acwrap"><input type="text" id="mastersInstitution" autocomplete="off" maxlength="150" placeholder="Start typing the college / university"></div>', 'full hidden', 'Tell us the college or university for your master\'s.') +
      f('stream', 'UG / bachelor\'s degree stream', choice('stream', C.streams || STREAMS, false, 'dense') + '<input type="text" id="streamOther" class="other-in hidden" maxlength="80" placeholder="Please tell us your degree, e.g. Bachelor of Fine Arts" aria-label="Your degree">', 'full') +
      f('specialisation', 'UG subject / specialisation', '<input type="text" id="specialisation" maxlength="100" placeholder="e.g. Political Science, Economics">') +
      f('institution', 'Name of UG institution', '<div class="acwrap"><input type="text" id="institution" autocomplete="off" maxlength="150" placeholder="Start typing your college / university"></div>', '', 'Pick from the list if you see your college; otherwise type its full name.') +
      f('completion', 'UG completion month', '<input type="hidden" id="completion">', 'full',
        '<span id="compNote">The month you completed your degree, or the <b>expected month</b> if you are in your final year. It must be on or before ' + esc(D.fmtDate(C.ugBy)) + '.</span>') +
      f('motivation', 'What made you decide to apply to DCIP this year?', '<textarea id="motivation" rows="6" maxlength="9000" spellcheck="true" placeholder="Write in your own words"></textarea><div class="wcount"><span id="pasteNote">Please type your answer yourself; pasting is switched off.</span><span><b id="mcount">0</b> / ' + MAX_WORDS + ' words</span></div>', 'full') +
      f('heardFrom', 'How did you hear about DCIP?', choice('heardFrom', C.heardFrom || HEARD, true, 'dense') + '<input type="text" id="heardOther" class="other-in hidden" maxlength="80" placeholder="Please tell us where you heard about DCIP" aria-label="Where you heard about DCIP">', 'full', 'Select all that apply.') +
      '<div class="full"><label class="declare"><input type="checkbox" id="declare"><span>I declare that the information given is true and complete. I understand that false information will lead to disqualification, and that all further communication will be through the e-mail address and mobile numbers given above.</span></label><div class="field" id="fld-declare"><div class="err">Please accept the declaration.</div></div></div>' +
      '</div>' +
      '<div class="hp" aria-hidden="true"><label>Website <input type="text" id="website" tabindex="-1" autocomplete="off"></label></div>' +
      '<div id="formAlert" role="alert"></div>' +
      '<div class="nav"><span class="grow muted" id="submitNote" style="font-size:13px"></span><button type="submit" class="btn submit" id="submit">Submit application</button></div>' +
      '</form>';
    pickers.dob = window.DCIPDate.date($('#dob'), { min: '1960-01-01', max: D.addDays(C.today, -365 * 15), startYear: +C.today.slice(0, 4) - 22 });
    pickers.completion = window.DCIPDate.month($('#completion'), { min: '1985-01', max: (+C.today.slice(0, 4) + 8) + '-12', startYear: +C.today.slice(0, 4) });
    $('.dp-in', $('#fld-dob')).id = 'dob-in'; $('.dp-in', $('#fld-completion')).id = 'completion-in';
    $('#lbl-dob').setAttribute('for', 'dob-in'); $('#lbl-completion').setAttribute('for', 'completion-in');
    bind(); bindChoices(); restoreDraft(); syncChoices(); updateAll(); liveChecks();
    var L = window.DCIP_LISTS || {};
    typeahead($('#lbName'), L.kozhikodeLocalBodies || []);
    typeahead($('#institution'), L.colleges || []);
    typeahead($('#mastersInstitution'), L.colleges || []);
    typeahead($('#state'), states, { all: true });
    bindCv();
  }

  /* ------------------------------------- button choices instead of dropdowns ------------------------------------- */
  function choice(id, list, multi, cls) {
    return '<input type="hidden" id="' + id + '" data-options="' + esc(JSON.stringify(list)) + '"><div class="opts ' + (cls || '') + '" id="opts-' + id + '" role="' + (multi ? 'group' : 'radiogroup') + '" aria-labelledby="lbl-' + id + '" data-for="' + id + '"' + (multi ? ' data-multi="1"' : '') + '>' +
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

  /* ----------------------------------------------- CV auto-fill ----------------------------------------------- */
  var applying = false, cvBusy = false, autoIds = {};
  var MAP = { fullName: 'fullName', dob: 'dob', gender: 'gender', email: 'email', mobile: 'mobile', altMobile: 'altMobile', district: 'district', state: 'state', localBody: 'lbName', qual: 'qual', mastersInstitution: 'mastersInstitution',
    stream: 'stream', streamOther: 'streamOther', specialisation: 'specialisation', institution: 'institution', completionYM: 'completion' };
  var NICE = { fullName: 'name', dob: 'date of birth', gender: 'gender', email: 'e-mail', mobile: 'mobile number', altMobile: 'second mobile', district: 'district', state: 'state', localBody: 'local body', qual: 'qualification', mastersInstitution: 'master\'s college',
    stream: 'degree stream', streamOther: 'degree', specialisation: 'subject', institution: 'college', completionYM: 'completion month' };
  function mark(id) { var f = $('#fld-' + id); if (f) f.classList.add('autofilled'); }
  function unmark(id) { delete autoIds[id]; var f = $('#fld-' + id); if (f) f.classList.remove('autofilled'); }

  /** Puts CV details into the empty fields (never over something the applicant typed) and marks them so they get checked. */
  function applyFields(f) {
    var filled = []; applying = true;
    if (f.completion && !f.completionYM && /^\d{4}-\d{2}/.test(f.completion)) f.completionYM = f.completion.slice(0, 7);
    Object.keys(MAP).forEach(function (k) {
      var id = MAP[k], v = f[k], el = $('#' + id); if (!v || !el) return;
      if (id === 'lbName' && val('district') !== 'Kozhikode') return;
      if (id === 'state' && val('district') !== 'Outside Kerala') return;
      if (id === 'mastersInstitution' && !/^master/i.test(val('qual'))) return;
      if (id === 'streamOther' && val('stream') !== 'Other') return;
      if (id === 'completion') { var m = /^(\d{4})-(\d{2})/.exec(v); if (!m) return; v = m[1] + '-' + m[2] + '-' + ('0' + D.lastDay(+m[1], +m[2])).slice(-2); }
      var cur = String(el.value || '').trim(); if (cur && !autoIds[id]) return;
      if (el.dataset && el.dataset.options) { var opts = []; try { opts = JSON.parse(el.dataset.options); } catch (x) {} if (opts.indexOf(v) < 0) return; }
      if (id === 'state' && (C.states || []).indexOf(v) < 0) return;
      el.value = v; autoIds[id] = true; mark(id); filled.push(k);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    applying = false;
    if (f.completionYear && !f.completionYM && !val('completion') && $('#compNote')) $('#compNote').innerHTML = 'Your CV mentions <b>' + esc(f.completionYear) + '</b>. Please pick the month (the expected month if you are in your final year).';
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
      if (ext === 'doc') { cvStatus('✓ CV attached. We can only read <b>PDF</b> and <b>DOCX</b> files for auto-fill, so please fill in the form yourself.', 'info'); return; }
      cvBusy = true; cvStatus('<span class="spin"></span> Reading your CV…', 'busy');
      w_read(file).then(function (res) {
        cvBusy = false;
        var filled = applyFields(res.fields || {});
        if (filled.length) {
          cvStatus('✨ We found <b>' + filled.length + ' detail' + (filled.length > 1 ? 's' : '') + '</b> in your CV: ' + filled.map(function (k) { return esc(NICE[k]); }).join(', ') + '. They are filled in below – <b>please check each one</b> and complete the rest.', 'ok');
          liveChecks();
        } else cvStatus('✓ CV attached. We could not read details from it (that happens with scanned or image-only files) – no problem, please fill in the form below yourself.', 'info');
      }, function () { cvBusy = false; cvStatus('✓ CV attached. Please fill in the form below yourself.', 'info'); });
    }
    inp.addEventListener('change', chosen);
    ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
    drop.addEventListener('drop', function (e) { if (e.dataTransfer && e.dataTransfer.files.length) { try { inp.files = e.dataTransfer.files; } catch (x) { return; } chosen(); } });
  }
  function w_read(file) {
    var L = window.DCIP_LISTS || {};
    return window.DCIPCv.read(file, { colleges: L.colleges, localBodies: L.kozhikodeLocalBodies, districts: C.districts, today: C.today, ai: !!C.cvAi,
      askServer: function (text) { return D.call('parseCv', text); } });
  }

  function f(id, label, control, cls, hint, optional) {
    return '<div class="field ' + (cls || '') + '" id="fld-' + id + '"><label class="f" id="lbl-' + id + '" for="' + id + '">' + label + (optional ? '' : ' <span class="req">*</span>') + '</label>' + control +
      '<div class="err"></div>' + (hint ? '<div class="hint">' + hint + '</div>' : '') + '<div id="live-' + id + '"></div></div>';
  }

  /* in the order they appear on the page (the first mistake is scrolled to) */
  var FIELDS = ['fullName', 'dob', 'gender', 'email', 'mobile', 'altMobile', 'waSame', 'whatsapp', 'district', 'state', 'lbName', 'qual', 'mastersInstitution', 'stream', 'streamOther', 'specialisation', 'institution', 'completion', 'motivation', 'heardFrom', 'heardOther'];
  function val(id) { var e = $('#' + id); return e ? String(e.value).replace(/\s+/g, ' ').trim() : ''; }
  function words(s) { return String(s || '').trim().split(/\s+/).filter(Boolean); }

  function bind() {
    FIELDS.forEach(function (id) {
      var e = $('#' + id); if (!e) return;
      ['input', 'change'].forEach(function (ev) { e.addEventListener(ev, function () {
        if (!applying) unmark(id); clearErr(id); saveDraft();
        if (id === 'district') updateLocalBody(); if (id === 'mobile' || id === 'waSame') updateWa(); if (id === 'qual') updateMasters(); if (id === 'stream') updateStream(); if (id === 'heardFrom') updateHeard();
        liveChecks();
      }); });
    });
    var mo = $('#motivation'), noted = false;
    function count() {
      var w = words(mo.value); if (w.length > MAX_WORDS) { mo.value = mo.value.split(/(\s+)/).slice(0, MAX_WORDS * 2 - 1).join(''); w = words(mo.value); }
      $('#mcount').textContent = w.length; $('#mcount').className = w.length >= MAX_WORDS ? 'warn' : '';
    }
    mo.addEventListener('input', count); count();
    function noPaste(e) { e.preventDefault(); if (!noted) { noted = true; $('#pasteNote').style.color = 'var(--red)'; $('#pasteNote').style.fontWeight = '700'; } }
    ['paste', 'drop'].forEach(function (ev) { mo.addEventListener(ev, noPaste); });
    mo.addEventListener('beforeinput', function (e) { if (/^insertFrom(Paste|Drop|PasteAsQuotation)$/.test(e.inputType || '')) noPaste(e); });
    mo.addEventListener('dragover', function (e) { e.preventDefault(); });
    $('#declare').addEventListener('change', function () { clearErr('declare'); });
    $('#form').addEventListener('submit', function (ev) { ev.preventDefault(); submit(); });
  }

  /* ---------- draft (kept in this browser only; never the CV) ---------- */
  function saveDraft() { try { var o = {}; FIELDS.forEach(function (id) { if ($('#' + id)) o[id] = $('#' + id).value; }); localStorage.setItem(draftKey, JSON.stringify(o)); } catch (e) {} }
  function restoreDraft() {
    try {
      var o = JSON.parse(localStorage.getItem(draftKey) || 'null');
      if (o) FIELDS.forEach(function (id) { if (o[id] != null && $('#' + id)) $('#' + id).value = o[id]; });
      pickers.dob.show(); pickers.completion.show(); $('#motivation').dispatchEvent(new Event('input'));
    } catch (e) {}
  }

  /* ---------- conditional parts ---------- */
  function showIf(id, on, clear) { var fld = $('#fld-' + id) || $('#' + id); fld.classList.toggle('hidden', !on); if (!on && clear) { var e = $('#' + id); if (e) e.value = ''; clearErr(id); } }
  function updateLocalBody() { showIf('lbName', val('district') === 'Kozhikode', true); showIf('state', val('district') === 'Outside Kerala', true); }
  function localBody() { return val('district') === 'Kozhikode' ? val('lbName') : ''; }
  function phoneOk(s) { var d = String(s || '').replace(/\D/g, ''); if (d.length === 12 && d.indexOf('91') === 0) d = d.slice(2); if (d.length === 11 && d[0] === '0') d = d.slice(1); return /^[6-9]\d{9}$/.test(d); }
  /** The WhatsApp question appears as soon as a valid 10-digit number has been entered. */
  function updateWa() {
    var ok = phoneOk(val('mobile')), same = val('waSame');
    $('#fld-waSame').classList.toggle('hidden', !ok);
    $('#fld-whatsapp').classList.toggle('hidden', !(ok && same === WA_NO));
    if (same !== WA_NO) $('#whatsapp').value = '';
  }
  function updateMasters() { showIf('mastersInstitution', /^master/i.test(val('qual')), true); }
  function updateStream() { showIf('streamOther', val('stream') === 'Other', true); }
  function updateHeard() { showIf('heardOther', chosenList('heardFrom').indexOf('Other') >= 0, true); }
  function updateAll() { updateLocalBody(); updateWa(); updateMasters(); updateStream(); updateHeard(); }
  function stateName() {
    var v = val('state').toLowerCase(), m = (C.states || []).filter(function (x) { return x.toLowerCase() === v; })[0];
    return m || '';
  }

  /* ---------- type-ahead: a list that appears only while the typed text matches ---------- */
  function typeahead(input, entries, opt) {
    opt = opt || {};
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
      if (!q) { if (opt.all && document.activeElement === input) { shown = parsed.map(function (e) { return { label: e.label }; }); } else { close(); return; } }
      else {
        var words = q.split(' '), hits = [];
        parsed.forEach(function (e) {
          for (var k = 0; k < e.keys.length; k++) {
            var key = e.keys[k];
            if (words.every(function (w) { return key.indexOf(w) >= 0; })) { hits.push({ label: e.label, rank: key.indexOf(q) === 0 ? 0 : key.indexOf(' ' + q) >= 0 ? 1 : 2 }); return; }
          }
        });
        hits.sort(function (a, b) { return a.rank - b.rank || a.label.length - b.label.length; });
        shown = hits.slice(0, opt.all ? 40 : 8);
        if (!shown.length || (shown.length === 1 && norm(shown[0].label) === q)) { close(); return; }
      }
      box.innerHTML = shown.map(function (h, i) { return '<li role="option" data-i="' + i + '">' + esc(h.label) + '</li>'; }).join('');
      box.hidden = false; idx = -1; input.setAttribute('aria-expanded', 'true');
    }
    input.addEventListener('input', search);
    if (opt.all) input.addEventListener('focus', search);
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
    var out = { age: null, ageBlock: null, ageWarn: null, compBlock: null, compWarn: null, compNote: null };
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
      else if (q && !pending && comp.slice(0, 7) > C.today.slice(0, 7)) out.compBlock = 'You have chosen "completed", so the month cannot be in the future. If you are in your final year, choose "final year – results pending".';
      else if (pending && comp < D.addDays(C.today, -180)) out.compWarn = 'You have chosen "results pending" but the month is long past. Please check the qualification and the month.';
      else if (pending) out.compNote = 'UG completes in ' + D.fmtMonthYear(comp) + '. Your final result will need to be confirmed.';
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
  var ALIAS = { streamOther: 'stream', heardOther: 'heardFrom' };
  function setErr(id, msg) { var fld = $('#fld-' + (ALIAS[id] || id)); if (!fld) return; fld.classList.add('invalid'); var e = $('.err', fld); if (e) e.textContent = msg; }
  function clearErr(id) { var fld = $('#fld-' + (ALIAS[id] || id)); if (fld) fld.classList.remove('invalid'); }

  function validate() {
    var errs = {}, r = check();
    if (val('fullName').length < 3) errs.fullName = 'Please enter your full name.';
    if (!D.isIso(val('dob'))) errs.dob = 'Please enter your date of birth.'; else if (r.ageBlock) errs.dob = r.ageBlock;
    if (!val('gender')) errs.gender = 'Please choose one.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val('email'))) errs.email = 'Please enter a valid e-mail address.';
    if (!phoneOk(val('mobile'))) errs.mobile = 'Enter a valid 10-digit mobile number.';
    else if (!val('waSame')) errs.waSame = 'Please tell us whether this number is on WhatsApp.';
    else if (val('waSame') === WA_NO && !phoneOk(val('whatsapp'))) errs.whatsapp = 'Enter your 10-digit WhatsApp number.';
    if (val('altMobile') && !phoneOk(val('altMobile'))) errs.altMobile = 'Enter a valid 10-digit mobile number or leave it blank.';
    if (!val('district')) errs.district = 'Please choose your district.';
    if (val('district') === 'Outside Kerala' && !stateName()) errs.state = 'Please pick your state from the list.';
    if (val('district') === 'Kozhikode' && !val('lbName')) errs.lbName = 'Please enter your local body.';
    if (!val('qual')) errs.qual = 'Please choose one.';
    if (/^master/i.test(val('qual')) && !val('mastersInstitution')) errs.mastersInstitution = 'Please enter where you completed your master\'s degree.';
    if (!val('stream')) errs.stream = 'Please choose one.';
    else if (val('stream') === 'Other' && val('streamOther').length < 3) errs.streamOther = 'Please tell us your degree.';
    ['specialisation', 'institution'].forEach(function (k) { if (!val(k)) errs[k] = 'This is required.'; });
    if (!D.isIso(val('completion'))) errs.completion = 'Please pick the completion month.'; else if (r.compBlock) errs.completion = r.compBlock;
    var wc = words(val('motivation')).length;
    if (val('motivation').length < 30) errs.motivation = 'Please write at least 30 characters.'; else if (wc > MAX_WORDS) errs.motivation = 'Please keep your answer within ' + MAX_WORDS + ' words.';
    if (!chosenList('heardFrom').length) errs.heardFrom = 'Please choose at least one option.';
    else if (chosenList('heardFrom').indexOf('Other') >= 0 && val('heardOther').length < 2) errs.heardOther = 'Please tell us where you heard about DCIP.';
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
    if (cvBusy) { $('#formAlert').innerHTML = '<div class="alert warn">One moment – we are still reading your CV…</div>'; return; }
    var errs = validate(), order = ['cv'].concat(FIELDS, ['declare']), keys = order.filter(function (k) { return errs[k]; });
    if (keys.length) {
      keys.forEach(function (k) { setErr(k, errs[k]); });
      var first = $('#fld-' + (ALIAS[keys[0]] || keys[0])); if (first) first.scrollIntoView({ behavior: calm() ? 'auto' : 'smooth', block: 'center' });
      $('#formAlert').innerHTML = '<div class="alert bad">Please correct the highlighted field' + (keys.length > 1 ? 's' : '') + ' (' + keys.length + ').</div>';
      return;
    }
    var btn = $('#submit'); btn.disabled = true; btn.textContent = 'Submitting…';
    var file = $('#cv').files[0];
    (file ? readFile(file) : Promise.resolve(null)).then(function (cv) {
      return D.call('submitApplication', {
        fullName: val('fullName'), dob: val('dob'), gender: val('gender'), email: val('email').toLowerCase(), mobile: val('mobile'),
        whatsappSame: val('waSame') === WA_YES, whatsapp: val('whatsapp'), altMobile: val('altMobile'),
        district: val('district'), state: val('district') === 'Outside Kerala' ? stateName() : '', localBody: localBody(), qual: val('qual'), mastersInstitution: val('mastersInstitution'),
        stream: val('stream') === 'Other' ? 'Other: ' + val('streamOther') : val('stream'), specialisation: val('specialisation'),
        institution: val('institution'), completion: val('completion'), motivation: String($('#motivation').value).trim(),
        heardFrom: chosenList('heardFrom').map(function (x) { return x === 'Other' ? 'Other: ' + val('heardOther') : x; }), cv: cv,
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
                : '<p>Your application is safely recorded. The confirmation e-mail could not be sent just now; we will send it shortly.</p>') +
      '<div class="next"><b>What happens next</b><ol style="margin:0;padding-left:20px"><li>Every application is reviewed as a whole: your responses, CV and details together.</li><li>Shortlisted applicants are contacted on this e-mail address and on WhatsApp / mobile.</li><li>Interview, document verification and final selection follow.</li></ol></div></div>';
    $('#apply').scrollIntoView({ behavior: calm() ? 'auto' : 'smooth', block: 'start' });
  }
})();
