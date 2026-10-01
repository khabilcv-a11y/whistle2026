/* Admin portal tabs */
(function (w) {
  'use strict';
  var A = w.A, D = w.DCIP, esc = D.esc, $ = A.$, $$ = A.$$, V = A.views;
  var S = A.S;
  S.scope = 'all'; S.f = { q: '', pill: '', district: '', session: '', sort: 'submittedAt', dir: -1, limit: 60 };
  S.sel = {}; S.isSess = ''; S.isTab = 'score'; S.shLimit = 80;

  A.TABS = [
    ['overview', 'Overview'], ['applications', 'Applications'], ['screening', 'Screening'], ['shortlist', 'Shortlist'],
    ['interviews', 'Interviews'], ['selection', 'Selection'], ['reports', 'Reports'], ['settings', 'Settings & audit']
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
    var scopes = w.Insights.SCOPES;
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
        '<div class="muted" style="font-size:13px">' + esc(a.qual) + ' · UG completion ' + esc(D.fmtDate(a.completion)) + '</div>' +
        (a.screeningNotes ? '<ul>' + a.screeningNotes.split(' | ').map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul>' : '') + '</div>' +
        '<div class="acts"><button class="btn small" data-open="' + esc(a.id) + '">Open</button>' + (a.cv ? '<a class="btn small" target="_blank" rel="noopener" href="' + esc(a.cv) + '">CV ↗</a>' : '') +
        '<button class="btn small" data-clear="' + esc(a.id) + '">Clear – eligible</button><button class="btn small danger" data-dq="' + esc(a.id) + '">Disqualify</button></div></div>';
    }
    el.innerHTML = head('Application screening', 'Rules: age up to <b>' + esc(s.MAX_AGE) + '</b> on ' + esc(D.fmtDate(c.ageAsOn)) + ' · UG course completed on or before <b>' + esc(D.fmtDate(s.INTAKE_END)) + '</b> (' + esc(s.ENFORCE_COMPLETION === 'FLAG' ? 'flagged' : 'blocked at submission') + ').',
      '<button class="btn" id="btnRescreen">Re-screen all</button><button class="btn small" data-dl="xlsx">Excel</button><button class="btn small" data-dl="pdf">PDF</button>') +
      (dq.length ? '<div class="toolbar"><h3 style="font-size:16px">Suggested to disqualify (' + dq.length + ')</h3><span class="grow"></span><button class="btn danger" id="btnDqAll">Disqualify all ' + dq.length + '</button></div><div class="cards">' + dq.map(function (a) { return card(a, 'bad'); }).join('') + '</div>' : '') +
      (rev.length ? '<h3 style="font-size:16px;margin:18px 0 8px">Needs review (' + rev.length + ')</h3><div class="cards">' + rev.map(function (a) { return card(a, ''); }).join('') + '</div>' : '') +
      (flagged.length ? '<h3 style="font-size:16px;margin:18px 0 8px">Flagged by officials (' + flagged.length + ')</h3><div class="cards">' + flagged.map(function (a) { return card(a, ''); }).join('') + '</div>' : '') +
      (!todo.length && !flagged.length ? '<div class="empty">✓ Nothing needs screening right now.</div>' : '');
    bindDl(el, A.reports.screening);
    $$('[data-open]', el).forEach(function (b) { b.onclick = function () { A.openDrawer(b.dataset.open); }; });
    $$('[data-clear]', el).forEach(function (b) { b.onclick = function () { A.save(b.dataset.clear, { screening: 'Cleared', flagged: '', flagNote: '' }, 'Screening').then(function () { D.toast('Cleared', 'ok'); }); }; });
    $$('[data-dq]', el).forEach(function (b) { b.onclick = function () { A.save(b.dataset.dq, { status: 'Disqualified' }, 'Screening').then(function () { D.toast('Disqualified', 'ok'); }); }; });
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
    var n = Number(S.settings.SHORTLIST_SIZE) || 30;
    var pool = S.apps.filter(function (a) { return A.eligible(a) && ['Received', 'Shortlisted'].indexOf(a.status || 'Received') >= 0 || a.shortlisted === 'Yes' && A.eligible(a); });
    var scored = pool.filter(function (a) { return A.num(a.screenScore) != null; }).sort(function (a, b) { return A.num(b.screenScore) - A.num(a.screenScore) || String(a.submittedAt).localeCompare(b.submittedAt); });
    var unscored = pool.filter(function (a) { return A.num(a.screenScore) == null; }).sort(function (a, b) { return String(a.id).localeCompare(b.id); });
    var tie = scored.length > n && A.num(scored[n].screenScore) === A.num(scored[n - 1].screenScore);
    var shortlisted = S.apps.filter(function (a) { return a.shortlisted === 'Yes'; }).length;
    var rows = scored.concat(unscored), shown = rows.slice(0, S.shLimit);
    el.innerHTML = head('Shortlist – top ' + n, 'Enter a screen score for each eligible application. The top ' + n + ' by score are shortlisted for interview.',
      '<button class="btn small" data-dl="xlsx">Excel rank list</button><button class="btn small" data-dl="pdf">PDF</button><button class="btn accent" id="btnShort">Shortlist top ' + n + '</button>') +
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
      '<div class="full"><label class="f">Venue</label><input type="text" id="sVenue" value="' + esc(s.venue || '') + '"></div>' +
      '<div><label class="f">Interviewer / panel</label><input type="text" id="sIv" value="' + esc(s.interviewer || '') + '"></div>' +
      '<div><label class="f">Capacity</label><input type="number" id="sCap" min="0" value="' + esc(s.capacity === undefined ? 25 : s.capacity) + '"></div>' +
      '<div class="full"><label class="f">Notes</label><input type="text" id="sNotes" value="' + esc(s.notes || '') + '"></div></div>' +
      '<div class="acts"><button class="btn" id="cNo">Cancel</button><button class="btn primary" id="cYes">Save</button></div>');
    $('#cNo', m).onclick = A.closeModal;
    $('#cYes', m).onclick = function () {
      A.api('saveSession', { originalId: s.id || '', date: $('#sDate', m).value, slot: $('#sSlot', m).value, venue: $('#sVenue', m).value, interviewer: $('#sIv', m).value, capacity: $('#sCap', m).value, notes: $('#sNotes', m).value })
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
    var sid = S.isSess, list = A.sessionApps(sid), tab = S.isTab, unassigned = A.sessionApps('__none').length;
    var sel = sessions.filter(function (s) { return s.id === sid; })[0];
    el.innerHTML = head('Interview day', 'Sessions, score sheets, attendance, call chart and document verification.',
      '<button class="btn" id="btnAuto"' + (unassigned ? '' : ' disabled') + '>Auto-assign (' + unassigned + ' unassigned)</button><button class="btn primary" id="btnAddS">+ Add session</button>') +
      (sessions.length ? '<div class="tw" style="margin-bottom:16px"><table class="t"><thead><tr><th>Session</th><th>Venue</th><th>Interviewer</th><th class="num">Capacity</th><th class="num">Assigned</th><th class="num">Present</th><th></th></tr></thead><tbody>' + sessions.map(function (s) {
        var l = A.sessionApps(s.id);
        return '<tr><td><b>' + esc(A.sessionLabel(s)) + '</b></td><td>' + esc(s.venue) + '</td><td>' + esc(s.interviewer) + '</td><td class="num">' + esc(s.capacity) + '</td><td class="num">' + l.length + '</td><td class="num">' + l.filter(function (a) { return a.attendance === 'Present'; }).length + '</td>' +
          '<td class="nowrap"><button class="btn small" data-es="' + esc(s.id) + '">Edit</button> <button class="btn small danger" data-ds="' + esc(s.id) + '">Delete</button></td></tr>';
      }).join('') + '</tbody></table></div>' : '<div class="empty">No sessions yet. Add a session (date, slot, venue, interviewer), then assign the shortlisted candidates.</div>') +
      '<div class="toolbar"><select id="isSel" style="max-width:300px" aria-label="Session">' + sessions.map(function (s) { return '<option value="' + esc(s.id) + '"' + (s.id === sid ? ' selected' : '') + '>' + esc(A.sessionLabel(s)) + '</option>'; }).join('') +
      '<option value="__all"' + (sid === '__all' ? ' selected' : '') + '>All shortlisted candidates</option><option value="__none"' + (sid === '__none' ? ' selected' : '') + '>Not yet assigned (' + unassigned + ')</option></select>' +
      '<div class="seg" role="group">' + [['score', 'Score sheet'], ['attendance', 'Attendance'], ['call', 'Call chart'], ['docs', 'Doc verification']].map(function (t) { return '<button aria-pressed="' + (tab === t[0]) + '" data-tab="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>' +
      '<span class="grow"></span>' + dl() + '<button class="btn small" id="btnMailS">E-mail all</button></div>' + '<div id="isBody"></div>';
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
      thead = '<th class="num">#</th><th>Name</th><th>Contact</th><th>Session</th><th>Call status</th><th>Note</th>';
      rows = list.map(function (a, i) { return '<tr><td class="num">' + (i + 1) + '</td><td><b>' + esc(a.fullName) + '</b><small>' + esc(a.location) + '</small></td><td class="nowrap">' + [a.mobile, a.altMobile].filter(Boolean).map(function (p) { return '<a href="tel:' + esc(p) + '">' + esc(p) + '</a>'; }).join('<br>') + '</td><td>' + esc(a.session) + '</td>' +
        '<td><select data-id="' + esc(a.id) + '" data-k="callStatus"><option value="">—</option>' + A.opts(A.CALL.slice(1), a.callStatus) + '</select></td><td><input type="text" data-id="' + esc(a.id) + '" data-k="callNote" value="' + esc(a.callNote) + '"></td></tr>'; });
    } else {
      thead = '<th class="num">#</th><th>Name</th><th>UG</th><th>UG certificate</th><th>Other documents presented</th><th>Remarks</th>';
      rows = list.map(function (a, i) { return '<tr><td class="num">' + (i + 1) + '</td><td><b>' + esc(a.fullName) + '</b><small>' + esc(A.phones(a)) + '</small></td><td>' + esc(A.ugText(a)) + '</td>' +
        '<td><select data-id="' + esc(a.id) + '" data-k="docCert"><option value="">—</option>' + A.opts(A.DOC_CERT.slice(1), a.docCert) + '</select></td><td><input type="text" data-id="' + esc(a.id) + '" data-k="docOther" value="' + esc(a.docOther) + '"></td><td><input type="text" data-id="' + esc(a.id) + '" data-k="docRemarks" value="' + esc(a.docRemarks) + '"></td></tr>'; });
    }
    body.innerHTML = hdr + (list.length ? '<div class="tw"><table class="t"><thead><tr>' + thead + '</tr></thead><tbody>' + rows.join('') + '</tbody></table></div>' : '<div class="empty">No candidates in this view. Shortlist candidates and assign them to a session.</div>');
    bindInline(body);
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

  /* ============================ Settings & audit ============================ */
  V.settings = function (el) {
    var s = S.settings, sel = { REG_OPEN: ['TRUE', 'FALSE'], CV_REQUIRED: ['TRUE', 'FALSE'], ENFORCE_AGE: ['BLOCK', 'FLAG'], ENFORCE_COMPLETION: ['BLOCK', 'FLAG'] };
    function ctl(k) {
      var v = s[k] == null ? '' : s[k];
      if (sel[k]) return '<select data-s="' + k + '">' + A.opts(sel[k], String(v).toUpperCase()) + '</select>';
      if (/^(INTAKE_START|INTAKE_END|AGE_AS_ON)$/.test(k)) return '<input type="date" data-s="' + k + '" value="' + esc(v) + '">';
      if (k === 'REG_DEADLINE') return '<input type="datetime-local" data-s="' + k + '" value="' + esc(v) + '">';
      if (/^(MAX_AGE|MIN_AGE|SHORTLIST_SIZE|SELECTION_SIZE)$/.test(k)) return '<input type="number" data-s="' + k + '" value="' + esc(v) + '">';
      return '<input type="text" data-s="' + k + '" value="' + esc(v) + '">';
    }
    var base = (location.origin + location.pathname.replace(/admin(\.html)?$/, '')).replace(/\/$/, '/');
    el.innerHTML = head('Settings & audit', 'Registration rules and event details. Changes apply immediately to the public form.', '<button class="btn primary" id="btnSaveS">Save settings</button>') +
      '<div class="kv"><div><b>' + (S.mailQuota == null ? '—' : S.mailQuota) + '</b>e-mails left today</div><div><b>' + S.apps.length + '</b>applications</div>' +
      '<div>Public form<b style="font-size:14px"><a href="' + esc(base) + '" target="_blank" rel="noopener">' + esc(base) + '</a></b></div>' +
      (S.cvFolder ? '<div>CV folder<b style="font-size:14px"><a href="' + esc(S.cvFolder) + '" target="_blank" rel="noopener">Open in Google Drive ↗</a></b></div>' : '') + '</div>' +
      '<div class="setgrid">' + S.meta.map(function (m) { return '<label for="s_' + m.key + '">' + esc(m.key) + '</label><div>' + ctl(m.key).replace('data-s=', 'id="s_' + m.key + '" data-s=') + '<div class="d">' + esc(m.desc) + '</div></div>'; }).join('') + '</div>' +
      '<div class="toolbar" style="margin-top:18px"><button class="btn" id="btnRescreen2">Re-screen all applications</button><span class="muted">After changing the age limit or intake dates, re-screen so existing applications are re-checked.</span></div>' +
      '<h3 style="margin:22px 0 8px">Audit trail</h3><div class="tw"><table class="t"><thead><tr><th>Time</th><th>User</th><th>Action</th><th>App</th><th>Details</th></tr></thead><tbody id="auditBody"><tr><td colspan="5" class="muted">Loading…</td></tr></tbody></table></div>';
    $('#btnSaveS', el).onclick = function () {
      var vals = {}; $$('[data-s]', el).forEach(function (i) { var v = i.value; if (String(v) !== String(s[i.dataset.s] == null ? '' : s[i.dataset.s])) vals[i.dataset.s] = v; });
      if (!Object.keys(vals).length) { D.toast('No changes.'); return; }
      A.api('saveSettings', vals).then(function () { D.toast('Settings saved', 'ok'); return A.refresh(); }, function (e) { D.toast(e.message, 'err'); });
    };
    $('#btnRescreen2', el).onclick = function () { A.api('rescreenAll').then(function (r) { D.toast(r.checked + ' checked, ' + r.changed + ' updated', 'ok'); return A.refresh(); }, function (e) { D.toast(e.message, 'err'); }); };
    A.api('getAudit', 300).then(function (rows) {
      var b = $('#auditBody'); if (!b) return;
      b.innerHTML = rows.map(function (r) { return '<tr><td class="nowrap">' + esc(D.fmtDateTime(r.time)) + '</td><td>' + esc(r.user) + '</td><td><span class="chip">' + esc(r.action) + '</span></td><td class="nowrap">' + esc(r.id) + '</td><td style="max-width:560px;overflow-wrap:anywhere">' + esc(r.details) + '</td></tr>'; }).join('') || '<tr><td colspan="5" class="muted">No entries yet.</td></tr>';
    }, function () {});
  };
})(window);
