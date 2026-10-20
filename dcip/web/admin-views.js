/* Admin portal tabs */
(function (w) {
  'use strict';
  var A = w.A, D = w.DCIP, esc = D.esc, $ = A.$, $$ = A.$$, V = A.views;
  var S = A.S;
  S.scope = 'all'; S.f = { q: '', pill: '', district: '', session: '', sort: 'submittedAt', dir: -1, limit: 60 };
  S.sel = {}; S.callSel = {}; S.onlyConf = true; S.isSess = ''; S.isTab = 'score'; S.shLimit = 80;

  A.TABS = [
    ['overview', 'Overview'], ['applications', 'Applications'], ['screening', 'Screening'], ['shortlist', 'Shortlist'],
    ['interviews', 'Interviews'], ['panel', 'Interview scores'], ['callers', 'Callers'], ['selection', 'Selection'], ['reports', 'Reports'], ['banners', 'Banners'], ['social', 'Instagram'], ['settings', 'Settings'],
    ['chats', 'Chats'], ['users', 'Users'], ['logs', 'Logs'], ['mycalls', 'My calls']
  ];
  function dl(rep, label) { return '<button class="btn small" data-dl="xlsx">Excel</button><button class="btn small" data-dl="pdf">PDF</button>'; }
  function bindDl(root, makeRep) { $$('[data-dl]', root).forEach(function (b) { b.onclick = function () { A.download(makeRep(), b.dataset.dl); }; }); }
  function head(title, sub, right) { return '<div class="toolbar"><div><h2>' + esc(title) + '</h2><p class="sub" style="margin:0">' + sub + '</p></div><span class="grow"></span>' + (right || '') + '</div>'; }
  function selIds() { return Object.keys(S.sel).filter(function (k) { return S.sel[k] && A.byId(k); }); }
  function debounce(fn, ms) { var t; return function () { var a = arguments, c = this; clearTimeout(t); t = setTimeout(function () { fn.apply(c, a); }, ms); }; }
  function scoreInput(a, key) { return '<input type="number" class="score" step="0.5" min="0" max="1000" data-id="' + esc(a.id) + '" data-k="' + key + '" value="' + esc(a[key]) + '" aria-label="' + (key === 'screenScore' ? 'Screen' : 'Interview') + ' score for ' + esc(a.fullName) + '">'; }
  /** Inline fields: any <input|select data-id data-k> inside root saves on change. */
  function bindInline(root) {
    $$('[data-id][data-k]', root).forEach(function (el) {
      if (el.type === 'number' || el.type === 'text') el.addEventListener('keydown', function (e) { if (e.key === 'Enter') el.blur(); });
      el.addEventListener('change', function () {
        var ch = {}; ch[el.dataset.k] = el.value;
        A.save([el.dataset.id], ch).catch(function () { el.value = A.byId(el.dataset.id)[el.dataset.k]; });
      });
    });
  }

  /* ============================== Overview ============================== */
  V.overview = function (el) {
    var scopes = w.Insights.SCOPES; if (A.syncRanked) A.syncRanked();
    el.innerHTML = head('Insights', 'Live counts. Refreshes whenever an application arrives or changes.',
      '<div class="seg" role="group" aria-label="Insight scope">' + Object.keys(scopes).map(function (k) { return '<button aria-pressed="' + (S.scope === k) + '" data-scope="' + k + '">' + esc(scopes[k].label) + '</button>'; }).join('') + '</div>' + dl()) +
      '<div id="insBody"></div>';
    var data = w.Insights.compute(S.apps, S.scope, S.settings);
    w.Insights.render($('#insBody', el), data);
    $$('[data-scope]', el).forEach(function (b) { b.onclick = function () { S.scope = b.dataset.scope; A.render(); }; });
    bindDl(el, function () { return A.reports.insights(S.scope); });
  };

  /* ============================ Applications ============================ */
  function pills() {
    var cnt = function (f) { return S.apps.filter(f).length; };
    var list = [['', 'All', S.apps.length], ['screen', 'Needs screening', cnt(A.needsScreening)], ['flag', 'Flagged', cnt(function (a) { return a.flagged === 'Yes'; })]]
      .concat(S.statuses.map(function (s) { return [s, s, cnt(function (a) { return (a.status || 'Received') === s; })]; }));
    return list;
  }
  function filtered() {
    var f = S.f, q = f.q.trim().toLowerCase();
    var l = S.apps.filter(function (a) {
      if (f.pill === 'screen' && !A.needsScreening(a)) return false;
      if (f.pill === 'flag' && a.flagged !== 'Yes') return false;
      if (f.pill && f.pill !== 'screen' && f.pill !== 'flag' && (a.status || 'Received') !== f.pill) return false;
      if (f.district && a.district !== f.district) return false;
      if (f.session && a.session !== f.session) return false;
      if (q && [a.id, a.fullName, a.email, a.mobile, a.altMobile, a.institution, a.location, a.specialisation, a.stream].join(' ').toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    var k = f.sort, num = ['age', 'screenScore', 'interviewScore'].indexOf(k) >= 0;
    l.sort(function (a, b) {
      var x = a[k], y = b[k];
      if (num) { x = A.num(x); y = A.num(y); x = x == null ? -1e9 : x; y = y == null ? -1e9 : y; return (x - y) * f.dir; }
      return String(x == null ? '' : x).localeCompare(String(y == null ? '' : y)) * f.dir;
    });
    return l;
  }
  V.applications = function (el) {
    var f = S.f, districts = S.config.districts;
    el.innerHTML = head('Applications', '<span id="appCount"></span>', dl()) +
      '<div class="toolbar"><input type="search" id="q" placeholder="Search name, ID, e-mail, mobile, college…" value="' + esc(f.q) + '" aria-label="Search">' +
      '<select id="fDistrict" aria-label="District">' + A.opts(districts, f.district, 'All districts') + '</select>' +
      '<select id="fSession" aria-label="Session">' + A.sessionOpts(f.session, 'Any session') + '</select></div>' +
      '<div class="pills" id="pills"></div><div class="tw"><table class="t"><thead><tr id="thead"></tr></thead><tbody id="tbody"></tbody></table></div><div id="more" class="more"></div><div id="bulkHost"></div>';
    $('#q', el).oninput = debounce(function () { f.q = this.value; f.limit = 60; paint(); }, 200);
    $('#fDistrict', el).onchange = function () { f.district = this.value; f.limit = 60; paint(); };
    $('#fSession', el).onchange = function () { f.session = this.value; f.limit = 60; paint(); };
    bindDl(el, function () { return A.reports.applications(filtered(), 'Applications' + (f.pill ? ' – ' + f.pill : '')); });
    paint();
    function paint() {
      var list = filtered(), shown = list.slice(0, f.limit);
      $('#appCount', el).textContent = list.length + ' of ' + S.apps.length + ' applications';
      $('#pills', el).innerHTML = pills().map(function (p) { return '<button aria-pressed="' + (f.pill === p[0]) + '" data-pill="' + esc(p[0]) + '">' + esc(p[1]) + '<b>' + p[2] + '</b></button>'; }).join('');
      $$('[data-pill]', el).forEach(function (b) { b.onclick = function () { f.pill = b.dataset.pill; f.limit = 60; paint(); }; });
      var cols = [['', ''], ['id', 'ID'], ['fullName', 'Name'], ['age', 'Age'], ['district', 'Location'], ['institution', 'UG'], ['screenScore', 'Score'], ['status', 'Status'], ['screening', 'Screening'], ['submittedAt', 'Submitted']];
      var allSel = list.length && list.every(function (a) { return S.sel[a.id]; });
      $('#thead', el).innerHTML = '<th><input type="checkbox" id="selAll" aria-label="Select all"' + (allSel ? ' checked' : '') + '></th>' + cols.slice(1).map(function (c) {
        return '<th class="sort' + (c[0] === 'age' || c[0] === 'screenScore' ? ' num' : '') + '" data-sort="' + c[0] + '">' + c[1] + (f.sort === c[0] ? (f.dir > 0 ? ' ▲' : ' ▼') : '') + '</th>'; }).join('');
      $('#selAll', el).onchange = function () { var on = this.checked; list.forEach(function (a) { S.sel[a.id] = on; }); paint(); };
      $$('[data-sort]', el).forEach(function (th) { th.onclick = function () { var k = th.dataset.sort; if (f.sort === k) f.dir = -f.dir; else { f.sort = k; f.dir = k === 'submittedAt' || k === 'screenScore' ? -1 : 1; } paint(); }; });
      $('#tbody', el).innerHTML = shown.map(function (a) {
        return '<tr class="click' + (S.sel[a.id] ? ' sel' : '') + '" data-id="' + esc(a.id) + '"><td><input type="checkbox" data-chk="' + esc(a.id) + '"' + (S.sel[a.id] ? ' checked' : '') + ' aria-label="Select ' + esc(a.fullName) + '"></td>' +
          '<td class="nowrap">' + esc(a.id) + '</td><td><b>' + esc(a.fullName) + '</b>' + (a.flagged === 'Yes' ? ' <span class="flagicon" title="' + esc(a.flagNote || 'Flagged') + '">⚑</span>' : '') + '<small>' + esc(a.email) + '</small></td>' +
          '<td class="num">' + esc(a.age) + '</td><td>' + esc(a.district) + '<small>' + esc(a.localBody) + '</small></td><td>' + esc([a.stream, a.specialisation].filter(Boolean).join(' ')) + '<small>' + esc(a.institution) + '</small></td>' +
          '<td class="num">' + esc(a.screenScore) + '</td><td>' + A.statusChip(a) + '</td><td>' + A.screenChip(a) + '</td><td class="nowrap"><small style="display:inline">' + esc(D.fmtDate(String(a.submittedAt).slice(0, 10))) + '</small></td></tr>';
      }).join('') || '<tr><td colspan="10" class="empty">No applications match.</td></tr>';
      $$('#tbody tr[data-id]', el).forEach(function (tr) { tr.onclick = function (e) {
        if (e.target.matches('[data-chk]')) { S.sel[e.target.dataset.chk] = e.target.checked; tr.classList.toggle('sel', e.target.checked); A.bulkBar($('#bulkHost', el), selIds(), bulkOpts()); return; }
        A.openDrawer(tr.dataset.id); }; });
      $('#more', el).innerHTML = list.length > shown.length ? '<button class="btn" id="btnMore">Show more (' + (list.length - shown.length) + ' remaining)</button>' : '';
      if ($('#btnMore', el)) $('#btnMore', el).onclick = function () { f.limit += 100; paint(); };
      A.bulkBar($('#bulkHost', el), selIds(), bulkOpts());
    }
    function bulkOpts() { return { after: function () { paint(); }, clear: function () { S.sel = {}; paint(); } }; }
  };

  /* ============================== Screening ============================== */
  V.screening = function (el) {
    var todo = S.apps.filter(A.needsScreening), dq = todo.filter(function (a) { return a.screening === 'Suggest Disqualify'; }), rev = todo.filter(function (a) { return a.screening === 'Review'; });
    var flagged = S.apps.filter(function (a) { return a.flagged === 'Yes' && !A.needsScreening(a); });
    var s = S.settings, c = S.config;
    function card(a, cls) {
      return '<div class="sc ' + cls + '"><div class="info"><b>' + esc(a.fullName) + '</b> <span class="muted">' + esc(a.id) + ' · age ' + esc(a.age) + ' · ' + esc(a.location) + '</span>' + (a.flagged === 'Yes' ? ' <span class="chip bad">⚑ ' + esc(a.flagNote || 'Flagged') + '</span>' : '') +
        '<div class="muted" style="font-size:13px">' + esc(a.qual) + ' · UG completion ' + esc(D.fmtMonthYear(a.completion)) + '</div>' +
        (a.screeningNotes ? '<ul>' + a.screeningNotes.split(' | ').map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul>' : '') + '</div>' +
        '<div class="acts"><button class="btn small" data-open="' + esc(a.id) + '">Open</button>' + (a.cv ? '<a class="btn small" target="_blank" rel="noopener" href="' + esc(a.cv) + '">CV ↗</a>' : '') +
        '<button class="btn small" data-clear="' + esc(a.id) + '">Clear – eligible</button><button class="btn small danger" data-dq="' + esc(a.id) + '">Disqualify</button>' + (A.isSuper() ? '<button class="btn small danger" data-del="' + esc(a.id) + '">Delete</button>' : '') + '</div></div>';
    }
    el.innerHTML = head('Application screening', 'The system checks the basics for you: age ' + esc(c.minAge ? c.minAge + ' to ' + c.maxAge : 'up to ' + c.maxAge) + ' on ' + esc(D.fmtDate(c.ageAsOn)) + ', UG degree completed by <b>' + esc(D.fmtDate(c.ugBy)) + '</b> (' + esc(s.ENFORCE_COMPLETION === 'FLAG' ? 'flagged' : 'blocked at submission') + '), repeat applications. Beyond that, read each applicant\'s answers and CV, then clear, flag or disqualify. Scoring is done in the Shortlist tab.',
      '<button class="btn" id="btnRescreen">Re-screen all</button><button class="btn small" data-dl="xlsx">Excel</button><button class="btn small" data-dl="pdf">PDF</button>') +
      (dq.length ? '<div class="toolbar"><h3 style="font-size:16px">Suggested to disqualify (' + dq.length + ')</h3><span class="grow"></span><button class="btn danger" id="btnDqAll">Disqualify all ' + dq.length + '</button></div><div class="cards">' + dq.map(function (a) { return card(a, 'bad'); }).join('') + '</div>' : '') +
      (rev.length ? '<h3 style="font-size:16px;margin:18px 0 8px">Needs review (' + rev.length + ')</h3><div class="cards">' + rev.map(function (a) { return card(a, ''); }).join('') + '</div>' : '') +
      (flagged.length ? '<h3 style="font-size:16px;margin:18px 0 8px">Flagged by officials (' + flagged.length + ')</h3><div class="cards">' + flagged.map(function (a) { return card(a, ''); }).join('') + '</div>' : '') +
      (!todo.length && !flagged.length ? '<div class="empty">✓ Nothing needs screening right now.</div>' : '');
    bindDl(el, A.reports.screening);
    $$('[data-open]', el).forEach(function (b) { b.onclick = function () { A.openDrawer(b.dataset.open); }; });
    $$('[data-clear]', el).forEach(function (b) { b.onclick = function () { A.save(b.dataset.clear, { screening: 'Cleared', flagged: '', flagNote: '' }, 'Screening').then(function () { D.toast('Cleared', 'ok'); }); }; });
    $$('[data-dq]', el).forEach(function (b) { b.onclick = function () { A.save(b.dataset.dq, { status: 'Disqualified' }, 'Screening').then(function () { D.toast('Disqualified', 'ok'); }); }; });
    $$('[data-del]', el).forEach(function (b) { b.onclick = function () { A.deleteApps(b.dataset.del); }; });
    if ($('#btnDqAll', el)) $('#btnDqAll', el).onclick = function () {
      A.confirm('Disqualify ' + dq.length + ' applications?', 'All applications marked <b>Suggest disqualify</b> will be set to Disqualified. You can reverse any of them later from the Applications tab.', 'Disqualify all', true).then(function (ok) {
        if (ok) A.save(dq.map(function (a) { return a.id; }), { status: 'Disqualified' }, 'Screening – bulk').then(function (r) { D.toast(r.changed + ' disqualified', 'ok'); });
      });
    };
    $('#btnRescreen', el).onclick = function () {
      A.confirm('Re-screen all applications?', 'Age, location and screening results are recalculated with the current Settings (applications you marked <b>Cleared</b> are left alone).', 'Re-screen').then(function (ok) {
        if (ok) A.api('rescreenAll').then(function (r) { D.toast(r.checked + ' checked, ' + r.changed + ' updated', 'ok'); return A.refresh(); }, function (e) { D.toast(e.message, 'err'); });
      });
    };
  };

  /* ============================== Shortlist ============================== */
  V.shortlist = function (el) {
    var n = Math.min(5000, Math.max(1, Math.floor(Number(S.shN || S.settings.SHORTLIST_SIZE) || 30)));   // the officials can type how many to shortlist this time
    var pool = S.apps.filter(function (a) { return A.eligible(a) && ['Received', 'Shortlisted'].indexOf(a.status || 'Received') >= 0 || a.shortlisted === 'Yes' && A.eligible(a); });
    var scored = pool.filter(function (a) { return A.num(a.screenScore) != null; }).sort(function (a, b) { return A.num(b.screenScore) - A.num(a.screenScore) || String(a.submittedAt).localeCompare(b.submittedAt); });
    var unscored = pool.filter(function (a) { return A.num(a.screenScore) == null; }).sort(function (a, b) { return String(a.id).localeCompare(b.id); });
    var tie = scored.length > n && A.num(scored[n].screenScore) === A.num(scored[n - 1].screenScore);
    var shortlisted = S.apps.filter(function (a) { return a.shortlisted === 'Yes'; }).length;
    var rows = scored.concat(unscored), shown = rows.slice(0, S.shLimit);
    el.innerHTML = head('Shortlist – top ' + n, '<b>Screen score</b> = the marks <i>you</i> give each candidate after reading their answers and CV (nothing is scored automatically; use any scale you like, e.g. out of 10). The top <b>' + n + '</b> by score are shortlisted for interview (change the number below any time).',
      '<button class="btn small" data-dl="xlsx">Excel rank list</button><button class="btn small" data-dl="pdf">PDF</button><label class="inl" style="display:inline-flex;align-items:center;gap:6px;font-weight:700">How many to shortlist <input type="number" id="nShort" min="1" max="5000" value="' + n + '" style="width:84px;display:inline-block"></label><button class="btn accent" id="btnShort">Shortlist top ' + n + '</button>') +
      '<div class="kv"><div><b>' + shortlisted + ' / ' + n + '</b>shortlisted</div><div><b>' + scored.length + '</b>scored</div><div><b>' + unscored.length + '</b>awaiting score</div></div>' +
      (tie ? '<div class="alert warn" style="margin:0 0 12px;padding:10px 14px;background:var(--warn-bg);color:var(--warn);border-radius:8px;font-weight:600">Tie at the cut-off: ranks ' + n + ' and ' + (n + 1) + ' both have a score of ' + esc(scored[n - 1].screenScore) + '. Only the earlier application will be shortlisted – decide the tie manually (change a score) before shortlisting.</div>' : '') +
      '<div class="tw"><table class="t"><thead><tr><th class="num">Rank</th><th>ID</th><th>Name</th><th class="num">Age</th><th>UG</th><th>Screen score</th><th>Status</th><th></th></tr></thead><tbody>' +
      shown.map(function (a) {
        var rk = scored.indexOf(a) + 1;
        return '<tr' + (rk === n ? ' class="cut"' : '') + '><td class="num">' + (rk || '–') + '</td><td class="nowrap">' + esc(a.id) + '</td><td><b>' + esc(a.fullName) + '</b>' + (a.flagged === 'Yes' ? ' <span class="flagicon">⚑</span>' : '') + '<small>' + esc(a.location) + '</small></td><td class="num">' + esc(a.age) + '</td>' +
          '<td>' + esc(A.ugText(a)) + '</td><td>' + scoreInput(a, 'screenScore') + '</td><td>' + A.statusChip(a) + (a.screening === 'Review' ? ' ' + A.screenChip(a) : '') + '</td><td><button class="btn small" data-open="' + esc(a.id) + '">Open</button></td></tr>';
      }).join('') + '</tbody></table></div>' +
      (rows.length > shown.length ? '<div class="more"><button class="btn" id="btnMore">Show more</button></div>' : '') +
      (!rows.length ? '<div class="empty">No eligible applications yet.</div>' : '');
    bindInline(el); bindDl(el, A.reports.rankScreen);
    $$('[data-open]', el).forEach(function (b) { b.onclick = function () { A.openDrawer(b.dataset.open); }; });
    if ($('#btnMore', el)) $('#btnMore', el).onclick = function () { S.shLimit += 100; A.render(); };
    $('#nShort', el).onchange = function () { var v = Math.floor(Number(this.value)); if (v >= 1) { S.shN = v; A.render(); } else { this.value = n; D.toast('Enter how many applicants to shortlist.', 'err'); } };
    $('#btnShort', el).onclick = function () {
      if (!scored.length) { D.toast('Enter some screen scores first.', 'err'); return; }
      A.confirm('Shortlist the top ' + n + '?', 'The ' + Math.min(n, scored.length) + ' highest-scoring eligible applications (cut-off score <b>' + esc(scored[Math.min(n, scored.length) - 1].screenScore) + '</b>) will be marked <b>Shortlisted</b>.' +
        (shortlisted ? ' <br>' + shortlisted + ' already shortlisted stay shortlisted.' : '') + (tie ? '<br><b>Note: there is a tie at the cut-off.</b>' : ''), 'Shortlist').then(function (ok) {
        if (ok) A.api('shortlistTop', n).then(function (r) { D.toast(r.shortlisted + ' shortlisted' + (r.tieAtCutoff ? ' (tie at cut-off!)' : ''), r.tieAtCutoff ? 'err' : 'ok'); return A.refresh(); }, function (e) { D.toast(e.message, 'err'); });
      });
    };
  };

  /* =============================== Interviews =============================== */
  function sessionForm(s) {
    s = s || {}; var slots = ['Forenoon', 'Afternoon', 'Evening', 'Full day'];
    var m = A.modal('<h3>' + (s.id ? 'Edit session' : 'Add interview session') + '</h3><div class="fgrid">' +
      '<div><label class="f">Date</label><input type="date" id="sDate" value="' + esc(s.date || '') + '"></div>' +
      '<div><label class="f">Slot</label><select id="sSlot">' + A.opts(slots, s.slot || 'Forenoon') + '</select></div>' +
      '<div><label class="f">Mode</label><select id="sMode">' + A.opts(['In person', 'Online'], s.mode || 'In person') + '</select></div>' +
      '<div><label class="f">Map / meeting link</label><input type="url" id="sLink" placeholder="https://" value="' + esc(s.link || '') + '"></div>' +
      '<div class="full"><label class="f">Venue</label><input type="text" id="sVenue" value="' + esc(s.venue || '') + '"></div>' +
      '<div><label class="f">Interviewer / panel</label><input type="text" id="sIv" value="' + esc(s.interviewer || '') + '"></div>' +
      '<div><label class="f">Capacity</label><input type="number" id="sCap" min="0" value="' + esc(s.capacity === undefined ? 25 : s.capacity) + '"></div>' +
      '<div class="full"><label class="f">Notes</label><input type="text" id="sNotes" value="' + esc(s.notes || '') + '"></div></div>' +
      '<div class="acts"><button class="btn" id="cNo">Cancel</button><button class="btn primary" id="cYes">Save</button></div>');
    $('#cNo', m).onclick = A.closeModal;
    $('#cYes', m).onclick = function () {
      A.api('saveSession', { originalId: s.id || '', date: $('#sDate', m).value, slot: $('#sSlot', m).value, venue: $('#sVenue', m).value, mode: $('#sMode', m).value, link: $('#sLink', m).value, interviewer: $('#sIv', m).value, capacity: $('#sCap', m).value, notes: $('#sNotes', m).value })
        .then(function (r) { A.closeModal(); if (!S.isSess || S.isSess === s.id) S.isSess = r.id; D.toast('Session saved', 'ok'); return A.refresh(); }, function (e) { D.toast(e.message, 'err'); });
    };
  }
  function autoAssign() {
    var sessions = A.sortSessions(S.sessions);
    if (!sessions.length) { D.toast('Add at least one session first.', 'err'); return; }
    var pool = A.sessionApps('__none');
    if (!pool.length) { D.toast('Every shortlisted candidate already has a session.', 'ok'); return; }
    var m = A.modal('<h3>Assign sessions automatically</h3><p>' + pool.length + ' shortlisted candidate(s) have no session. They will fill the sessions in date order, up to each session\'s capacity (25 if blank), counting those already assigned.</p>' +
      '<div class="field"><label class="f">Order</label><select id="aoOrder"><option value="name">Alphabetical (easier for the attendance sheet)</option><option value="rank">Screen score, highest first</option></select></div><div id="aoPrev" class="note-box"></div>' +
      '<div class="acts"><button class="btn" id="cNo">Cancel</button><button class="btn primary" id="cYes">Assign</button></div>');
    function plan() {
      var list = pool.slice(); if ($('#aoOrder', m).value === 'rank') list.sort(function (a, b) { return (A.num(b.screenScore) || 0) - (A.num(a.screenScore) || 0); });
      var map = {}, i = 0, lines = [];
      sessions.forEach(function (s) {
        var cap = Number(s.capacity) || 25, have = S.apps.filter(function (a) { return a.session === s.id; }).length, free = Math.max(0, cap - have), take = list.slice(i, i + free);
        take.forEach(function (a) { map[a.id] = s.id; }); i += take.length; if (take.length) lines.push(A.sessionLabel(s) + ': +' + take.length + ' (total ' + (have + take.length) + '/' + cap + ')');
      });
      if (i < list.length) lines.push('⚠ ' + (list.length - i) + ' candidate(s) will remain unassigned – add another session.');
      $('#aoPrev', m).innerHTML = lines.map(esc).join('<br>') || 'No free places.'; return map;
    }
    $('#aoOrder', m).onchange = plan; plan();
    $('#cNo', m).onclick = A.closeModal;
    $('#cYes', m).onclick = function () {
      var map = plan(); if (!Object.keys(map).length) return;
      A.api('assignSessions', map).then(function (r) { A.closeModal(); D.toast(r.changed + ' assigned', 'ok'); return A.refresh(); }, function (e) { D.toast(e.message, 'err'); });
    };
  }

  V.interviews = function (el) {
    var sessions = A.sortSessions(S.sessions);
    if (!S.isSess || (['__all', '__none'].indexOf(S.isSess) < 0 && !sessions.some(function (s) { return s.id === S.isSess; }))) S.isSess = sessions.length ? sessions[0].id : '__all';
    var sid = S.isSess, tab = S.isTab, list = tab === 'call' ? A.sessionApps(sid) : A.docApps(sid), unassigned = A.sessionApps('__none').length;
    var sel = sessions.filter(function (s) { return s.id === sid; })[0];
    el.innerHTML = head('Interview day', 'Sessions, score sheets, attendance, call chart and document verification.',
      '<button class="btn" id="btnAuto"' + (unassigned ? '' : ' disabled') + '>Auto-assign (' + unassigned + ' unassigned)</button><button class="btn primary" id="btnAddS">+ Add session</button>') +
      (sessions.length ? '<div class="tw" style="margin-bottom:16px"><table class="t"><thead><tr><th>Session</th><th>Mode</th><th>Venue</th><th>Interviewer</th><th class="num">Capacity</th><th class="num">Assigned</th><th class="num">Present</th><th></th></tr></thead><tbody>' + sessions.map(function (s) {
        var l = A.sessionApps(s.id);
        return '<tr><td><b>' + esc(A.sessionLabel(s)) + '</b></td><td>' + esc(s.mode || 'In person') + '</td><td>' + esc(s.venue) + '</td><td>' + esc(s.interviewer) + '</td><td class="num">' + esc(s.capacity) + '</td><td class="num">' + l.length + '</td><td class="num">' + l.filter(function (a) { return a.attendance === 'Present'; }).length + '</td>' +
          '<td class="nowrap"><button class="btn small" data-es="' + esc(s.id) + '">Edit</button> <button class="btn small danger" data-ds="' + esc(s.id) + '">Delete</button></td></tr>';
      }).join('') + '</tbody></table></div>' : '<div class="empty">No sessions yet. Add a session (date, slot, venue, interviewer), then assign the shortlisted candidates.</div>') +
      '<div class="toolbar"><select id="isSel" style="max-width:300px" aria-label="Session">' + sessions.map(function (s) { return '<option value="' + esc(s.id) + '"' + (s.id === sid ? ' selected' : '') + '>' + esc(A.sessionLabel(s)) + '</option>'; }).join('') +
      '<option value="__all"' + (sid === '__all' ? ' selected' : '') + '>All shortlisted candidates</option><option value="__none"' + (sid === '__none' ? ' selected' : '') + '>Not yet assigned (' + unassigned + ')</option></select>' +
      '<div class="seg" role="group">' + [['score', 'Score sheet'], ['attendance', 'Attendance'], ['call', 'Call chart'], ['docs', 'Doc verification']].map(function (t) { return '<button aria-pressed="' + (tab === t[0]) + '" data-tab="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>' +
      '<span class="grow"></span>' + dl() + '<button class="btn small" id="btnMailS">E-mail all</button></div>' +
      (tab !== 'call' ? '<label class="chk"><input type="checkbox" id="onlyConf"' + (S.onlyConf ? ' checked' : '') + '> Only candidates <b>confirmed on the call</b> (' + A.sessionApps(sid).filter(function (a) { return a.callStatus === 'Confirmed'; }).length + ' of ' + A.sessionApps(sid).length + ')</label>' : '') + '<div id="isBody"></div>';
    if ($('#onlyConf', el)) $('#onlyConf', el).onchange = function () { S.onlyConf = this.checked; A.render(); };
    $('#btnAddS', el).onclick = function () { sessionForm(); };
    $('#btnAuto', el).onclick = autoAssign;
    $$('[data-es]', el).forEach(function (b) { b.onclick = function () { sessionForm(sessions.filter(function (s) { return s.id === b.dataset.es; })[0]); }; });
    $$('[data-ds]', el).forEach(function (b) { b.onclick = function () { A.confirm('Delete session?', esc(b.dataset.ds) + ' will be removed. (Sessions with assigned candidates cannot be deleted.)', 'Delete', true).then(function (ok) { if (ok) A.api('deleteSession', b.dataset.ds).then(function () { D.toast('Deleted', 'ok'); return A.refresh(); }, function (e) { D.toast(e.message, 'err'); }); }); }; });
    $('#isSel', el).onchange = function () { S.isSess = this.value; A.render(); };
    $$('[data-tab]', el).forEach(function (b) { b.onclick = function () { S.isTab = b.dataset.tab; A.render(); }; });
    $('#btnMailS', el).onclick = function () { A.compose(list.map(function (a) { return a.id; }), 'interview'); };
    var maker = { score: A.reports.scoreSheet, attendance: A.reports.attendance, call: A.reports.callChart, docs: A.reports.docVerification }[tab];
    bindDl(el, function () { return maker(sid); });

    var body = $('#isBody', el), hdr = sel ? '<div class="kv"><div><b>' + esc(sel.interviewer || '—') + '</b>Interviewer</div><div><b>' + esc(sel.venue || '—') + '</b>Venue</div><div><b>' + list.length + '</b>Candidates</div><div><b>' + list.filter(function (a) { return a.attendance === 'Present'; }).length + '</b>Present</div></div>' : '';
    var rows, thead;
    if (tab === 'score') {
      thead = '<th class="num">#</th><th>Name</th><th class="num">Age</th><th>District, local body</th><th>Qualification</th><th>UG</th><th>Score</th><th>Remarks</th>';
      rows = list.map(function (a, i) { return '<tr><td class="num">' + (i + 1) + '</td><td><b>' + esc(a.fullName) + '</b></td><td class="num">' + esc(a.age) + '</td><td>' + esc(a.location) + '</td><td>' + esc(a.qual) + '</td><td>' + esc(A.ugText(a)) + '</td><td>' + scoreInput(a, 'interviewScore') + '</td><td><input type="text" data-id="' + esc(a.id) + '" data-k="remarks" value="' + esc(a.remarks) + '" aria-label="Remarks"></td></tr>'; });
    } else if (tab === 'attendance') {
      thead = '<th class="num">#</th><th>Name</th><th>Contact</th><th>Location</th><th>Attendance</th><th>Reporting time</th><th></th>';
      rows = list.map(function (a, i) { return '<tr><td class="num">' + (i + 1) + '</td><td><b>' + esc(a.fullName) + '</b></td><td>' + esc(A.phones(a)) + '</td><td>' + esc(a.location) + '</td>' +
        '<td><select data-id="' + esc(a.id) + '" data-k="attendance"><option value="">—</option>' + A.opts(['Present', 'Absent'], a.attendance) + '</select></td><td><input type="time" data-id="' + esc(a.id) + '" data-k="reportingTime" value="' + esc(a.reportingTime) + '"></td>' +
        '<td><button class="btn small" data-now="' + esc(a.id) + '">Mark present now</button></td></tr>'; });
    } else if (tab === 'call') {
      thead = '<th><input type="checkbox" id="callAll" aria-label="Select all"></th><th class="num">#</th><th>Name</th><th>Contact</th><th>Session</th><th>Mode</th><th>Caller</th><th>Call status</th><th>Note</th>';
      rows = list.map(function (a, i) { return '<tr><td><input type="checkbox" data-cc="' + esc(a.id) + '"' + (S.callSel[a.id] ? ' checked' : '') + ' aria-label="Select ' + esc(a.fullName) + '"></td><td class="num">' + (i + 1) + '</td><td><b>' + esc(a.fullName) + '</b><small>' + esc(a.location) + '</small></td><td class="nowrap">' + [a.mobile, a.altMobile].filter(Boolean).map(function (p) { return '<a href="tel:' + esc(p) + '">' + esc(p) + '</a>'; }).join('<br>') + (a.whatsapp && a.whatsapp !== a.mobile ? '<small>WhatsApp ' + esc(a.whatsapp) + '</small>' : '') + '</td>' +
        '<td><select data-id="' + esc(a.id) + '" data-k="session" title="Move to another session">' + A.sessionOpts(a.session) + '</select></td>' +
        '<td><select data-id="' + esc(a.id) + '" data-k="interviewMode" title="Change to online / in person">' + A.opts(['In person', 'Online'], a.interviewMode, '(' + esc((sel && sel.mode) || 'per session') + ')') + '</select></td>' +
        '<td><select data-id="' + esc(a.id) + '" data-k="caller">' + A.callerOpts(a.caller, '— none —') + '</select></td>' +
        '<td><select data-id="' + esc(a.id) + '" data-k="callStatus"><option value="">—</option>' + A.opts(A.CALL.slice(1), a.callStatus) + '</select></td><td><input type="text" data-id="' + esc(a.id) + '" data-k="callNote" value="' + esc(a.callNote) + '"></td></tr>'; });
    } else {
      thead = '<th class="num">#</th><th>Name</th><th>UG</th><th>UG certificate</th><th>Other documents presented</th><th>Remarks</th>';
      rows = list.map(function (a, i) { return '<tr><td class="num">' + (i + 1) + '</td><td><b>' + esc(a.fullName) + '</b><small>' + esc(A.phones(a)) + '</small></td><td>' + esc(A.ugText(a)) + '</td>' +
        '<td><select data-id="' + esc(a.id) + '" data-k="docCert"><option value="">—</option>' + A.opts(A.DOC_CERT.slice(1), a.docCert) + '</select></td><td><input type="text" data-id="' + esc(a.id) + '" data-k="docOther" value="' + esc(a.docOther) + '"></td><td><input type="text" data-id="' + esc(a.id) + '" data-k="docRemarks" value="' + esc(a.docRemarks) + '"></td></tr>'; });
    }
    body.innerHTML = hdr + (tab === 'call' && list.length ? '<div class="bulk" id="callBar"></div>' : '') + (list.length ? '<div class="tw"><table class="t"><thead><tr>' + thead + '</tr></thead><tbody>' + rows.join('') + '</tbody></table></div>' : '<div class="empty">No candidates in this view. Shortlist candidates and assign them to a session.</div>');
    bindInline(body);
    if (tab === 'call' && list.length) {
      var chosen = function () { return list.filter(function (a) { return S.callSel[a.id]; }).map(function (a) { return a.id; }); };
      var bar = function () {
        var ids = chosen(), act = (S.callers || []).filter(function (c) { return c.active === 'Yes'; });
        $('#callBar', body).innerHTML = '<b>' + ids.length + ' selected</b><select id="ccWho" aria-label="Caller">' + A.callerOpts('', 'Choose caller…') + '</select><button class="btn small primary" id="ccGo"' + (ids.length ? '' : ' disabled') + '>Assign to caller</button>' +
          '<button class="btn small" id="ccSpread"' + (ids.length && act.length > 1 ? '' : ' disabled') + ' title="Share the selected candidates equally among all active callers">Spread evenly among ' + act.length + ' callers</button><button class="btn small" id="ccNone"' + (ids.length ? '' : ' disabled') + ' title="Remove the caller from the selected candidates">Unassign</button>' +
          '<span class="grow"></span><button class="btn small" id="ccUnset" title="Select every candidate who has no caller yet">Select unassigned</button>';
        $('#ccGo', body).onclick = function () { var who = $('#ccWho', body).value; if (!who) { D.toast('Choose a caller first.', 'err'); return; } A.save(ids, { caller: who }, 'Call chart').then(function (r) { D.toast(r.changed + ' assigned', 'ok'); S.callSel = {}; A.render(); }); };
        $('#ccNone', body).onclick = function () { A.save(ids, { caller: '' }, 'Call chart').then(function (r) { D.toast(r.changed + ' unassigned', 'ok'); S.callSel = {}; A.render(); }); };
        $('#ccSpread', body).onclick = function () {
          var groups = {}; act.forEach(function (c) { groups[c.username] = []; }); ids.forEach(function (id, i) { groups[act[i % act.length].username].push(id); });
          Promise.all(Object.keys(groups).filter(function (u) { return groups[u].length; }).map(function (u) { return A.save(groups[u], { caller: u }, 'Call chart – spread'); })).then(function () { D.toast(ids.length + ' shared among ' + act.length + ' callers', 'ok'); S.callSel = {}; A.render(); });
        };
        $('#ccUnset', body).onclick = function () { list.forEach(function (a) { if (!a.caller) S.callSel[a.id] = true; }); A.render(); };
      };
      $$('[data-cc]', body).forEach(function (c) { c.onchange = function () { S.callSel[c.dataset.cc] = c.checked; bar(); $('#callAll', body).checked = chosen().length === list.length; }; });
      $('#callAll', body).checked = chosen().length === list.length;
      $('#callAll', body).onchange = function () { var on = this.checked; list.forEach(function (a) { S.callSel[a.id] = on; }); A.render(); };
      bar();
    }
    $$('[data-now]', body).forEach(function (b) { b.onclick = function () { var d = new Date(), t = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); A.save(b.dataset.now, { attendance: 'Present', reportingTime: t }, 'Attendance').then(function () { D.toast('Marked present at ' + t, 'ok'); }); }; });
  };

  /* =============================== Selection =============================== */
  V.selection = function (el) {
    var target = Number(S.settings.SELECTION_SIZE) || 25, cnt = function (st) { return S.apps.filter(function (a) { return a.status === st; }).length; };
    var pool = S.apps.filter(function (a) { return a.shortlisted === 'Yes' || ['Selected', 'Confirmed', 'Waitlisted', 'Not Selected'].indexOf(a.status) >= 0; })
      .sort(function (a, b) { var x = A.num(a.interviewScore), y = A.num(b.interviewScore); return (y == null ? -1e9 : y) - (x == null ? -1e9 : x) || A.nameCmp(a, b); });
    var ready = pool.filter(function (a) { return a.status === 'Shortlisted' && A.num(a.interviewScore) != null; });
    el.innerHTML = head('Selection', 'Rank by interview score, mark selections, then confirm after document verification.',
      '<button class="btn small" data-dl="xlsx">Excel rank list</button><button class="btn small" data-dl="pdf">PDF</button>') +
      '<div class="kv"><div><b>' + (cnt('Selected') + cnt('Confirmed')) + ' / ' + target + '</b>selected or confirmed</div><div><b>' + cnt('Confirmed') + '</b>confirmed</div><div><b>' + cnt('Selected') + '</b>selected – docs pending</div><div><b>' + cnt('Waitlisted') + '</b>waitlisted</div><div><b>' + cnt('Not Selected') + '</b>not selected</div></div>' +
      '<div class="toolbar"><label>Select top <input type="number" id="nSel" min="1" value="' + Math.max(1, target - cnt('Selected') - cnt('Confirmed')) + '" style="width:80px;display:inline-block"></label><button class="btn accent" id="btnSel">Mark as Selected</button>' +
      '<label style="margin-left:10px">then waitlist next <input type="number" id="nWait" min="0" value="5" style="width:80px;display:inline-block"></label><button class="btn" id="btnWait">Mark as Waitlisted</button></div>' +
      '<p class="hint" style="margin:-4px 0 10px">Applies to shortlisted candidates (status <i>Shortlisted</i>) who have an interview score, highest first. ' + ready.length + ' ready.</p>' +
      '<div class="tw"><table class="t"><thead><tr><th><input type="checkbox" id="selAll" aria-label="Select all"></th><th class="num">Rank</th><th>Name</th><th>UG</th><th class="num">Screen</th><th>Interview score</th><th>Status</th><th>UG certificate</th><th></th></tr></thead><tbody>' +
      pool.map(function (a, i) {
        return '<tr><td><input type="checkbox" data-chk="' + esc(a.id) + '"' + (S.sel[a.id] ? ' checked' : '') + '></td><td class="num">' + (A.num(a.interviewScore) != null ? i + 1 : '–') + '</td><td><b>' + esc(a.fullName) + '</b><small>' + esc(a.location) + '</small></td><td>' + esc(A.ugText(a)) + '</td><td class="num">' + esc(a.screenScore) + '</td>' +
          '<td>' + scoreInput(a, 'interviewScore') + '</td><td><select data-id="' + esc(a.id) + '" data-k="status">' + A.opts(S.statuses, a.status) + '</select></td><td>' + (a.docCert ? '<span class="chip ' + (a.docCert === 'Verified' ? 'ok' : a.docCert === 'Mismatch' ? 'bad' : 'warn') + '">' + esc(a.docCert) + '</span>' : '<span class="muted">—</span>') + '</td><td><button class="btn small" data-open="' + esc(a.id) + '">Open</button></td></tr>';
      }).join('') + '</tbody></table></div>' + (!pool.length ? '<div class="empty">Shortlist candidates first.</div>' : '') + '<div id="bulkHost"></div>';
    bindInline(el); bindDl(el, A.reports.interviewRank);
    $$('[data-open]', el).forEach(function (b) { b.onclick = function () { A.openDrawer(b.dataset.open); }; });
    function bulk() { A.bulkBar($('#bulkHost', el), selIds(), { after: function () { A.render(); }, clear: function () { S.sel = {}; A.render(); } }); }
    $$('[data-chk]', el).forEach(function (c) { c.onchange = function () { S.sel[c.dataset.chk] = c.checked; bulk(); }; });
    $('#selAll', el).onchange = function () { var on = this.checked; pool.forEach(function (a) { S.sel[a.id] = on; }); A.render(); };
    bulk();
    function mark(count, status, input) {
      var n = Math.floor(Number($(input, el).value)); if (!(n > 0)) { D.toast('Enter a number.', 'err'); return; }
      var offset = status === 'Waitlisted' ? 0 : 0, list = ready.slice(0, n);
      if (!list.length) { D.toast('No shortlisted candidates with interview scores are waiting.', 'err'); return; }
      var tie = ready.length > n && A.num(ready[n].interviewScore) === A.num(ready[n - 1].interviewScore);
      A.confirm('Mark ' + list.length + ' as ' + status + '?', esc(list.slice(0, 5).map(function (a) { return a.fullName; }).join(', ')) + (list.length > 5 ? ' and ' + (list.length - 5) + ' more' : '') + '. Lowest score included: <b>' + esc(list[list.length - 1].interviewScore) + '</b>.' + (tie ? '<br><b>Tie at the cut-off score – check manually.</b>' : ''), 'Mark ' + status).then(function (ok) {
        if (ok) A.save(list.map(function (a) { return a.id; }), { status: status }, 'Selection').then(function (r) { D.toast(r.changed + ' marked ' + status, 'ok'); });
      });
    }
    $('#btnSel', el).onclick = function () { mark(0, 'Selected', '#nSel'); };
    $('#btnWait', el).onclick = function () { mark(0, 'Waitlisted', '#nWait'); };
  };

  /* ================================ Reports ================================ */
  V.reports = function (el) {
    var cat = A.reports.catalogue(), groups = {};
    cat.forEach(function (r) { (groups[r.group] = groups[r.group] || []).push(r); });
    el.innerHTML = head('Reports & downloads', 'Every sheet downloads as a formatted Excel file or a print-ready PDF. Per-session score sheets, attendance sheets, call charts and document-verification sheets are on the <b>Interviews</b> tab.') +
      Object.keys(groups).map(function (g) {
        return '<h3 style="margin:18px 0 8px;font-size:15px">' + esc(g) + '</h3><div class="rep">' + groups[g].map(function (r) {
          return '<div class="r"><b>' + esc(r.title) + '</b><p>' + esc(r.desc) + '</p><div class="acts"><button class="btn small" data-r="' + cat.indexOf(r) + '" data-t="xlsx">Excel</button><button class="btn small" data-r="' + cat.indexOf(r) + '" data-t="pdf">PDF</button>' + (r.n != null ? '<span class="cnt">' + r.n + ' rows</span>' : '') + '</div></div>';
        }).join('') + '</div>';
      }).join('');
    $$('[data-r]', el).forEach(function (b) { b.onclick = function () { A.download(cat[b.dataset.r].make(), b.dataset.t); }; });
  };

  /* ================================ Settings ================================ */
  V.settings = function (el) {
    var s = S.settings, sel = { REG_OPEN: ['TRUE', 'FALSE'], CV_REQUIRED: ['TRUE', 'FALSE'], CV_AUTOFILL_AI: ['TRUE', 'FALSE'], ADMIN_CAN_VIEW_CHATS: ['TRUE', 'FALSE'], ENFORCE_AGE: ['BLOCK', 'FLAG'], ENFORCE_COMPLETION: ['BLOCK', 'FLAG'] };
    function ctl(k) {
      var v = s[k] == null ? '' : s[k];
      if (sel[k]) return '<select data-s="' + k + '">' + A.opts(sel[k], String(v).toUpperCase()) + '</select>';
      if (/^(INTAKE_START|INTAKE_END|UG_COMPLETE_BY|AGE_AS_ON)$/.test(k)) return '<input type="date" data-s="' + k + '" value="' + esc(v) + '">';
      if (k === 'REG_DEADLINE') return '<input type="datetime-local" data-s="' + k + '" value="' + esc(v) + '">';
      if (/^(MAX_AGE|MIN_AGE|SHORTLIST_SIZE|SELECTION_SIZE|INTERVIEW_MAX_MARK)$/.test(k)) return '<input type="number" data-s="' + k + '" value="' + esc(v) + '">';
      return '<input type="text" data-s="' + k + '" value="' + esc(v) + '">';
    }
    var PUB = [['Received', 'Application received'], ['Shortlisted', 'Shortlisted for interview'], ['Selected', 'Selected'], ['Confirmed', 'Selection confirmed'], ['Waitlisted', 'On the waiting list'], ['Not Selected', 'Not selected this time'], ['Disqualified', 'Not eligible this time'], ['Withdrawn', 'Withdrawn']];
    function statusPanel() {
      var pub = String(s.STATUS_PUBLISHED || '').split(',').map(function (x) { return x.trim(); });
      return '<section class="card" style="margin:16px 0"><h3 style="font-size:16px;margin-bottom:4px">What applicants see in “Check application status”</h3>' +
        '<p class="sub" style="margin:0 0 10px">Applicants look themselves up with their e-mail or mobile number. They see the status you set for them (in the Applications tab, the application drawer, or the bulk bar). <b>Tick “Show” only for statuses you are ready to announce.</b> Any status left unticked shows applicants “Under review” instead. Edit the wording of each message if you like, then press <b>Save settings</b>.</p>' +
        '<input type="hidden" data-s="STATUS_PUBLISHED" id="s_STATUS_PUBLISHED" value="' + esc(s.STATUS_PUBLISHED || '') + '">' +
        '<div class="tw"><table class="t"><thead><tr><th>Status you set</th><th>Show it?</th><th>Applicants see</th><th>Message shown</th></tr></thead><tbody>' + PUB.map(function (p) {
          var key = 'STATUS_MSG_' + p[0].toUpperCase().replace(/ /g, '_');
          return '<tr><td><b>' + esc(p[0]) + '</b></td><td><label class="chk" style="margin:0"><input type="checkbox" data-pub="' + esc(p[0]) + '"' + (pub.indexOf(p[0]) >= 0 ? ' checked' : '') + '> Show</label></td><td>' + esc(p[1]) + '</td><td style="min-width:340px"><textarea rows="2" data-s="' + key + '" aria-label="Message for ' + esc(p[0]) + '">' + esc(s[key] || '') + '</textarea></td></tr>';
        }).join('') + '<tr><td><i>Anything not shown</i></td><td></td><td>Under review</td><td><textarea rows="2" data-s="STATUS_MSG_HIDDEN" aria-label="Message for hidden statuses">' + esc(s.STATUS_MSG_HIDDEN || '') + '</textarea></td></tr></tbody></table></div>' +
        '<p class="hint">Shortlisted applicants who have an interview session also see its date, slot, venue and mode.</p></section>';
    }
    var base = (location.origin + location.pathname.replace(/admin(\.html)?$/, '')).replace(/\/$/, '/');
    el.innerHTML = head('Settings', 'Registration rules and event details. Changes apply immediately to the public form.', '<button class="btn primary" id="btnSaveS">Save settings</button>') +
      '<div class="kv"><div><b>' + (S.mailQuota == null ? '—' : S.mailQuota) + '</b>e-mails left today</div><div><b>' + S.apps.length + '</b>applications</div>' +
      '<div>Public form<b style="font-size:14px"><a href="' + esc(base) + '" target="_blank" rel="noopener">' + esc(base) + '</a></b></div>' +
      (S.cvFolder ? '<div>CV folder<b style="font-size:14px"><a href="' + esc(S.cvFolder) + '" target="_blank" rel="noopener">Open in Google Drive ↗</a></b></div>' : '') + '</div>' +
      statusPanel() + '<h3 style="margin:22px 0 8px;font-size:16px">All settings</h3><div class="setgrid">' + S.meta.filter(function (m) { return !/^STATUS_(PUBLISHED|MSG_)/.test(m.key) && (m.key !== 'ADMIN_CAN_VIEW_CHATS' || (S.me && S.me.role === 'super')); }).map(function (m) { return '<label for="s_' + m.key + '">' + esc(m.key) + '</label><div>' + ctl(m.key).replace('data-s=', 'id="s_' + m.key + '" data-s=') + '<div class="d">' + esc(m.desc) + '</div></div>'; }).join('') + '</div>' +
      '<div class="toolbar" style="margin-top:18px"><button class="btn" id="btnRescreen2">Re-screen all applications</button><span class="muted">After changing the age limit or intake dates, re-screen so existing applications are re-checked.</span></div>';
    $$('[data-pub]', el).forEach(function (c) { c.onchange = function () { $('#s_STATUS_PUBLISHED', el).value = $$('[data-pub]', el).filter(function (x) { return x.checked; }).map(function (x) { return x.dataset.pub; }).join(','); }; });
    $('#btnSaveS', el).onclick = function () {
      var vals = {}; $$('[data-s]', el).forEach(function (i) { var v = i.value; if (String(v) !== String(s[i.dataset.s] == null ? '' : s[i.dataset.s])) vals[i.dataset.s] = v; });
      if (!Object.keys(vals).length) { D.toast('No changes.'); return; }
      A.api('saveSettings', vals).then(function () { D.toast('Settings saved', 'ok'); return A.refresh(); }, function (e) { D.toast(e.message, 'err'); });
    };
    $('#btnRescreen2', el).onclick = function () { A.api('rescreenAll').then(function (r) { D.toast(r.checked + ' checked, ' + r.changed + ' updated', 'ok'); return A.refresh(); }, function (e) { D.toast(e.message, 'err'); }); };
  };
  /* ================================== Users ================================== */
  function genPassword() {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789', out = '', buf = new Uint32Array(12);
    (window.crypto || window.msCrypto).getRandomValues(buf);
    for (var i = 0; i < 12; i++) out += chars.charAt(buf[i] % chars.length);
    return out;
  }
  function copy(text) {
    function old() { try { var t = document.createElement('textarea'); t.value = text; t.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(t); t.select(); var ok = document.execCommand('copy'); t.remove(); D.toast(ok ? 'Copied' : 'Press the Copy button to copy', ok ? 'ok' : ''); } catch (e) { D.toast('Press the Copy button to copy', ''); } }
    try { navigator.clipboard.writeText(text).then(function () { D.toast('Copied', 'ok'); }, old); } catch (e) { old(); }
  }
  function loginUrl() { return location.origin + location.pathname; }
  function shareText(name, username, password, role) {
    return 'Hello' + (name ? ' ' + name : '') + ',\n\nYour ' + (role === 'caller' ? 'caller' : role === 'super' ? 'super admin' : 'admin') + ' login for DCIP Application Processing & Management:\n\nLink: ' + loginUrl() + '\nUsername: ' + username + '\nPassword: ' + password +
      '\n\nPlease sign in and change your password under "My account".\n\nTeam DCIP';
  }
  function credentialsDialog(title, username, password, name, role) {
    var txt = shareText(name, username, password, role);
    var m = A.modal('<h3>' + esc(title) + '</h3><p>The message is already copied. Paste it into WhatsApp or an e-mail. They can change the password under <b>My account</b>.</p>' +
      '<div class="note-box" style="white-space:pre-wrap;font-size:14px">' + esc(txt) + '</div>' +
      '<p class="hint">Keep this window open until you have sent it. The password cannot be shown again afterwards; use <b>Copy login</b> on the Users list to issue a fresh one.</p>' +
      '<div class="acts"><button class="btn" id="cCopyPw">Copy password only</button><button class="btn" id="cCopy">Copy message again</button><button class="btn primary" id="cYes">Done</button></div>');
    copy(txt);
    $('#cCopy', m).onclick = function () { copy(txt); };
    $('#cCopyPw', m).onclick = function () { copy(password); };
    $('#cYes', m).onclick = A.closeModal;
  }
  function userDialog() {
    var m = A.modal('<h3>Add a user</h3><div class="fgrid">' +
      '<div><label class="f">Username</label><input type="text" id="nuUser" autocapitalize="none" spellcheck="false" placeholder="e.g. meera.k"><div class="hint">Letters, numbers, dot, dash, underscore</div></div>' +
      '<div><label class="f">Full name</label><input type="text" id="nuName"></div>' +
      '<div><label class="f">Role</label><select id="nuRole" ' + '>' + ((S.me || {}).role === 'super' ? '<option value="admin">Admin – manages applications</option><option value="super">Super admin – also users, logs, chats</option>' : '') + '<option value="caller">Caller – sees only the call list given to them</option></select></div>' +
      '<div><label class="f">Password</label><div style="display:flex;gap:6px"><input type="text" id="nuPass" autocomplete="off" spellcheck="false"><button type="button" class="btn small" id="nuGen">Generate</button></div><div class="hint">At least 8 characters</div></div></div>' +
      '<div class="acts"><button class="btn" id="cNo">Cancel</button><button class="btn primary" id="cYes">Create user</button></div>');
    $('#nuPass', m).value = genPassword();
    $('#nuGen', m).onclick = function () { $('#nuPass', m).value = genPassword(); };
    $('#cNo', m).onclick = A.closeModal;
    $('#cYes', m).onclick = function () {
      var u = $('#nuUser', m).value, pw = $('#nuPass', m).value, nm = $('#nuName', m).value, role = $('#nuRole', m).value;   // read before the window is closed
      A.api('createUser', u, nm, pw, role).then(function () { A.closeModal(); credentialsDialog('User created', u.trim().toLowerCase(), pw, nm.trim(), role); V.users($('#view')); }, function (e) { D.toast(e.message, 'err'); });
    };
  }
  V.users = function (el) {
    el.innerHTML = head('Users', 'Create accounts for admins and callers. People sign in with their own username and password.' + ((S.me || {}).role === 'super' ? '' : ' You can manage caller accounts.'), '<button class="btn primary" id="uAdd">+ Add user</button>') +
      '<div class="tw"><table class="t"><thead><tr><th>Username</th><th>Name</th><th>Role</th><th>Status</th><th>Last sign-in</th><th>Created</th><th></th></tr></thead><tbody id="uBody"><tr><td colspan="7" class="muted">Loading…</td></tr></tbody></table></div>' +
      '<p class="hint" style="margin-top:12px"><b>Admin</b>: everything in the portal except Users, Logs and (unless allowed in Settings) Chats. <b>Super admin</b>: everything, including all logs. <b>Caller</b>: sees only the candidates assigned to them (name, basic profile and contact details) and marks call status and remarks.</p><p class="hint">Passwords are stored scrambled, so nobody (including you) can look one up later. If someone forgets theirs, or you need the login message again, use <b>Copy login</b>: it sets a fresh password and copies a ready-to-send message.</p>';
    $('#uAdd', el).onclick = userDialog;
    var rowsByUser = {};
    A.api('listUsers').then(function (rows) {
      rows.forEach(function (u) { rowsByUser[u.username] = u; });
      var b = $('#uBody', el); if (!b) return;
      b.innerHTML = rows.map(function (u) {
        var me = S.me && S.me.user === u.username;
        return '<tr><td><b>' + esc(u.username) + '</b>' + (me ? ' <span class="chip info">you</span>' : '') + '</td><td>' + esc(u.name) + '</td><td><span class="chip ' + (u.role === 'super' ? 'warn' : '') + '">' + (u.role === 'super' ? 'Super admin' : u.role === 'caller' ? 'Caller' : 'Admin') + '</span></td>' +
          '<td>' + (u.active === 'Yes' ? '<span class="chip ok">Active</span>' : '<span class="chip bad">Disabled</span>') + '</td><td class="nowrap">' + esc(u.lastLogin ? D.fmtDateTime(u.lastLogin) : '—') + '</td><td class="nowrap"><small style="display:inline">' + esc(D.fmtDate(String(u.created).slice(0, 10))) + ' · ' + esc(u.createdBy) + '</small></td>' +
          '<td class="nowrap"><button class="btn small primary" data-copylogin="' + esc(u.username) + '" title="Sets a fresh password and copies the login message">Copy login</button> <button class="btn small" data-reset="' + esc(u.username) + '">Reset password</button> ' + (me ? '' : '<button class="btn small" data-tog="' + esc(u.username) + '" data-on="' + (u.active === 'Yes' ? '0' : '1') + '">' + (u.active === 'Yes' ? 'Disable' : 'Enable') + '</button> <button class="btn small danger" data-del="' + esc(u.username) + '">Delete</button>') + '</td></tr>';
      }).join('');
      $$('[data-reset]', b).forEach(function (x) { x.onclick = function () {
        var u = x.dataset.reset, pw = genPassword();
        var m = A.modal('<h3>Reset password for ' + esc(u) + '</h3><div class="field"><label class="f">New password</label><div style="display:flex;gap:6px"><input type="text" id="rpPass" autocomplete="off" spellcheck="false"><button type="button" class="btn small" id="rpGen">Generate</button></div><div class="hint">At least 8 characters</div></div><div class="acts"><button class="btn" id="cNo">Cancel</button><button class="btn primary" id="cYes">Reset</button></div>');
        $('#rpPass', m).value = pw; $('#rpGen', m).onclick = function () { $('#rpPass', m).value = genPassword(); }; $('#cNo', m).onclick = A.closeModal;
        $('#cYes', m).onclick = function () { var np = $('#rpPass', m).value; A.api('setUserPassword', u, np).then(function () { A.closeModal(); credentialsDialog('Password reset', u, np, (rowsByUser[u] || {}).name, (rowsByUser[u] || {}).role); }, function (e) { D.toast(e.message, 'err'); }); };
      }; });
      $$('[data-copylogin]', b).forEach(function (x) { x.onclick = function () {
        var u = x.dataset.copylogin, row = rowsByUser[u] || {};
        A.confirm('Copy login for ' + u + '?', 'Passwords are stored scrambled and cannot be looked up, so this sets a <b>new password</b> for <b>' + esc(row.name || u) + '</b> (the old one stops working) and copies a ready-to-send message.', 'Set new password and copy').then(function (ok) {
          if (!ok) return; var np = genPassword();
          A.api('setUserPassword', u, np).then(function () { credentialsDialog('Login details', u, np, row.name, row.role); }, function (e) { D.toast(e.message, 'err'); });
        });
      }; });
      $$('[data-tog]', b).forEach(function (x) { x.onclick = function () { A.api('setUserActive', x.dataset.tog, x.dataset.on === '1').then(function () { D.toast('Updated', 'ok'); V.users(el); }, function (e) { D.toast(e.message, 'err'); }); }; });
      $$('[data-del]', b).forEach(function (x) { x.onclick = function () { A.confirm('Delete ' + x.dataset.del + '?', 'The account is removed for good. (Consider <b>Disable</b> instead, which keeps it on record.) Their past actions stay in the logs.', 'Delete', true).then(function (ok) { if (ok) A.api('deleteUser', x.dataset.del).then(function () { D.toast('Deleted', 'ok'); V.users(el); }, function (e) { D.toast(e.message, 'err'); }); }); }; });
    }, function (e) { D.toast(e.message, 'err'); });
  };

  /* ================================== Logs =================================== */
  S.logTab = 'audit'; S.logQ = '';
  V.logs = function (el) {
    var tab = S.logTab;
    el.innerHTML = head('Logs', 'Everything that happens in the portal, kept in the Google Sheet as well.', '<button class="btn small" data-dl="xlsx">Excel</button><button class="btn small" data-dl="pdf">PDF</button>') +
      '<div class="toolbar"><div class="seg" role="group">' + [['audit', 'Activity (audit trail)'], ['logins', 'Sign-ins']].map(function (t) { return '<button aria-pressed="' + (tab === t[0]) + '" data-lt="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>' +
      '<input type="search" id="logQ" placeholder="Search…" value="' + esc(S.logQ) + '" style="max-width:260px"></div><div class="tw"><table class="t" id="logTable"><tbody><tr><td class="muted">Loading…</td></tr></tbody></table></div>';
    $$('[data-lt]', el).forEach(function (b) { b.onclick = function () { S.logTab = b.dataset.lt; S.logQ = ''; V.logs(el); }; });
    var rows = [], cols;
    function paint() {
      var q = S.logQ.toLowerCase(), list = rows.filter(function (r) { return !q || JSON.stringify(r).toLowerCase().indexOf(q) >= 0; });
      cols = tab === 'audit' ? [['Time', 'time'], ['User', 'user'], ['Action', 'action'], ['App', 'id'], ['Details', 'details']] : [['Time', 'time'], ['Username', 'user'], ['Result', 'result'], ['Role', 'role'], ['Note', 'note']];
      $('#logTable', el).innerHTML = '<thead><tr>' + cols.map(function (c) { return '<th>' + c[0] + '</th>'; }).join('') + '</tr></thead><tbody>' + list.map(function (r) {
        return '<tr>' + cols.map(function (c) {
          var x = r[c[1]];
          if (c[1] === 'time') return '<td class="nowrap">' + esc(D.fmtDateTime(x)) + '</td>';
          if (c[1] === 'action' || c[1] === 'result') return '<td><span class="chip ' + (/FAIL|LOCK|DELETE|DISABLE/.test(x) ? 'bad' : x === 'OK' ? 'ok' : '') + '">' + esc(x) + '</span></td>';
          return '<td' + (c[1] === 'details' ? ' style="max-width:560px;overflow-wrap:anywhere"' : '') + '>' + esc(x) + '</td>';
        }).join('') + '</tr>';
      }).join('') + (list.length ? '' : '<tr><td colspan="5" class="muted">Nothing found.</td></tr>') + '</tbody>';
      bindDl(el, function () { return { filename: 'DCIP_Log_' + tab, orientation: 'landscape', sheets: [{ name: 'Log', title: tab === 'audit' ? 'Activity log' : 'Sign-in log', rowHeight: 20, fontSize: 8, noBands: false,
        columns: cols.map(function (c, i) { return { h: c[0], w: c[1] === 'details' ? 60 : c[1] === 'time' ? 18 : 16 }; }),
        rows: list.map(function (r) { return cols.map(function (c) { return String(r[c[1]] == null ? '' : r[c[1]]).replace('T', ' '); }); }) }] }; });
    }
    $('#logQ', el).oninput = debounce(function () { S.logQ = this.value; paint(); }, 200);
    A.api(tab === 'audit' ? 'getAudit' : 'getLoginLog', 1000).then(function (r) { rows = r; paint(); }, function (e) { D.toast(e.message, 'err'); });
  };

  /* ================================== Chats ================================== */
  V.chats = function (el) {
    el.innerHTML = head('Chats', 'What applicants ask the chat helper. Use the unanswered questions to improve the FAQ sheet.', '<button class="btn small" data-dl="xlsx">Excel</button><button class="btn small" data-dl="pdf">PDF</button>') +
      '<div id="chatBody"><div class="muted">Loading…</div></div>';
    A.api('chatSessions').then(function (d) {
      var st = d.stats, body = $('#chatBody', el); if (!body) return;
      var q = S.chatQ || '';
      body.innerHTML = '<div class="tiles">' + [['Conversations', d.total], ['Questions asked', st.messages], ['Answered from FAQ', st.faq], ['Answered by AI', st.ai], ['Not answered', st.unanswered, st.unanswered ? 'warn' : '']].map(function (t) { return '<div class="tile ' + (t[2] || '') + '"><div class="tv">' + t[1] + '</div><div class="tl">' + t[0] + '</div></div>'; }).join('') + '</div>' +
        (d.unanswered.length ? '<section class="ins" style="margin-bottom:14px"><h3>Questions the helper could not answer <span class="tot">' + d.unanswered.length + '</span></h3><table class="bars"><tbody>' + d.unanswered.map(function (u) { return '<tr><th scope="row" style="width:80%">' + esc(u.q) + '</th><td class="n">' + u.n + '×</td></tr>'; }).join('') + '</tbody></table><p class="hint">Add answers for these to the <b>FAQ</b> tab of the Google Sheet.</p></section>' : '') +
        '<div class="toolbar"><h3 style="font-size:16px">Conversations</h3><span class="grow"></span><input type="search" id="chatQ" placeholder="Search first question…" value="' + esc(q) + '" style="max-width:260px"></div><div class="tw"><table class="t"><thead><tr><th>When</th><th>First question</th><th class="num">Messages</th><th>Outcome</th></tr></thead><tbody id="chatRows"></tbody></table></div>';
      function paint() {
        var list = d.sessions.filter(function (s) { return !S.chatQ || s.first.toLowerCase().indexOf(S.chatQ.toLowerCase()) >= 0; });
        $('#chatRows', body).innerHTML = list.map(function (s) {
          return '<tr class="click sessrow" data-s="' + esc(s.id) + '"><td class="nowrap">' + esc(D.fmtDateTime(s.start)) + '</td><td>' + esc(s.first || '—') + '</td><td class="num">' + s.count + '</td><td>' +
            (s.outcomes.faq ? '<span class="chip ok">FAQ ' + s.outcomes.faq + '</span> ' : '') + (s.outcomes.ai ? '<span class="chip info">AI ' + s.outcomes.ai + '</span> ' : '') + (s.outcomes.none ? '<span class="chip warn">No answer ' + s.outcomes.none + '</span>' : '') + '</td></tr>';
        }).join('') || '<tr><td colspan="4" class="muted">No conversations yet.</td></tr>';
        $$('[data-s]', body).forEach(function (tr) { tr.onclick = function () {
          A.api('chatTranscript', tr.dataset.s).then(function (rows) {
            var m = A.modal('<h3>Conversation · ' + esc(D.fmtDateTime(rows[0] ? rows[0].time : '')) + '</h3><div>' + rows.map(function (r) { return '<div class="bubble ' + (r.role === 'User' ? 'u' : 'b') + '">' + esc(r.text) + '<small>' + (r.role === 'User' ? 'Applicant' : 'Helper · ' + esc(r.source)) + '</small></div>'; }).join('') + '</div><div class="acts"><button class="btn primary" id="cYes">Close</button></div>');
            $('#cYes', m).onclick = A.closeModal;
          }, function (e) { D.toast(e.message, 'err'); });
        }; });
      }
      paint();
      $('#chatQ', body).oninput = debounce(function () { S.chatQ = this.value; paint(); }, 200);
      bindDl(el, function () {
        return { filename: 'DCIP_Chat_Conversations', orientation: 'landscape', sheets: [{ name: 'Conversations', title: 'Chat helper conversations', rowHeight: 22, fontSize: 8,
          columns: [{ h: 'When', w: 18 }, { h: 'First question', w: 60 }, { h: 'Messages', w: 10, align: 'center' }, { h: 'FAQ', w: 8, align: 'center' }, { h: 'AI', w: 8, align: 'center' }, { h: 'No answer', w: 10, align: 'center' }],
          rows: d.sessions.map(function (s) { return [s.start.replace('T', ' '), s.first, s.count, s.outcomes.faq, s.outcomes.ai, s.outcomes.none]; }) },
          { name: 'Unanswered', title: 'Questions with no answer', rowHeight: 20, columns: [{ h: 'Question', w: 70 }, { h: 'Times asked', w: 12, align: 'center' }], rows: d.unanswered.map(function (u) { return [u.q, u.n]; }) }] };
      });
    }, function (e) { var b = $('#chatBody', el); if (b) b.innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; });
  };
})(window);
