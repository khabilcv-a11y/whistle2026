/* Admin portal: caller dashboard, banners and the caller's own "My calls" screen. */
(function (w) {
  'use strict';
  var A = w.A, D = w.DCIP, esc = D.esc, $ = A.$, $$ = A.$$, V = A.views, S = A.S;
  function head(title, sub, right) { return '<div class="toolbar"><div><h2>' + esc(title) + '</h2><p class="sub" style="margin:0">' + sub + '</p></div><span class="grow"></span>' + (right || '') + '</div>'; }
  var STATES = ['Confirmed', 'Not reachable', 'Call back', 'Wants online', 'Reschedule requested', 'Declined'];
  function tone(st) { return st === 'Confirmed' ? 'ok' : st === 'Declined' || st === 'Not reachable' ? 'bad' : st ? 'warn' : ''; }

  /* ============================ Callers dashboard (admins) ============================ */
  S.cFilter = '';
  V.callers = function (el) {
    var pool = S.apps.filter(function (a) { return a.shortlisted === 'Yes' && ['Disqualified', 'Withdrawn'].indexOf(a.status) < 0; });
    var callers = S.callers || [], unassigned = pool.filter(function (a) { return !a.caller; });
    function stat(list) {
      var o = { total: list.length, pending: 0 }; STATES.forEach(function (k) { o[k] = 0; });
      list.forEach(function (a) { if (o[a.callStatus] != null) o[a.callStatus]++; else o.pending++; }); return o;
    }
    var tot = stat(pool);
    el.innerHTML = head('Callers', 'Callers see only their own list (basic profile and contact details). Create caller logins in the <b>Users</b> tab, then assign candidates here, in <b>Interviews → Call chart</b>, or in bulk from the Applications tab.',
      '<button class="btn" id="cAuto"' + (unassigned.length && callers.some(function (c) { return c.active === 'Yes'; }) ? '' : ' disabled') + '>Share ' + unassigned.length + ' unassigned equally</button>') +
      '<div class="kv"><div><b>' + pool.length + '</b>shortlisted to call</div><div><b>' + tot.Confirmed + '</b>confirmed</div><div><b>' + tot.pending + '</b>not yet called</div><div><b>' + unassigned.length + '</b>no caller yet</div></div>' +
      (callers.length ? '<div class="tw"><table class="t"><thead><tr><th>Caller</th><th class="num">Assigned</th><th class="num">Done</th><th>Progress</th>' + STATES.map(function (k) { return '<th class="num">' + esc(k) + '</th>'; }).join('') + '<th>Last sign-in</th></tr></thead><tbody>' + callers.map(function (c) {
        var mine = pool.filter(function (a) { return a.caller === c.username; }), st = stat(mine), done = mine.length - st.pending, pct = mine.length ? Math.round(done * 100 / mine.length) : 0;
        return '<tr class="click" data-c="' + esc(c.username) + '"><td><b>' + esc(c.name) + '</b>' + (c.active === 'Yes' ? '' : ' <span class="chip bad">Disabled</span>') + '<small>' + esc(c.username) + '</small></td><td class="num">' + mine.length + '</td><td class="num">' + done + '</td>' +
          '<td style="min-width:120px"><div class="pbar"><i style="width:' + pct + '%"></i></div><small>' + pct + '%</small></td>' + STATES.map(function (k) { return '<td class="num">' + st[k] + '</td>'; }).join('') + '<td class="nowrap">' + esc(c.lastLogin ? D.fmtDateTime(c.lastLogin) : '—') + '</td></tr>';
      }).join('') + '</tbody></table></div>' : '<div class="empty">No callers yet. Add one in the <b>Users</b> tab (role: Caller).</div>') +
      '<div id="cDetail"></div>';
    $$('[data-c]', el).forEach(function (tr) { tr.onclick = function () { S.cFilter = S.cFilter === tr.dataset.c ? '' : tr.dataset.c; detail(); }; });
    function detail() {
      var box = $('#cDetail', el), u = S.cFilter; if (!u) { box.innerHTML = ''; return; }
      var list = pool.filter(function (a) { return a.caller === u; }).sort(A.nameCmp), c = callers.filter(function (x) { return x.username === u; })[0] || {};
      box.innerHTML = '<h3 style="margin:18px 0 8px;font-size:16px">' + esc(c.name || u) + ' – assigned candidates</h3>' + (list.length ? '<div class="tw"><table class="t"><thead><tr><th>Name</th><th>Contact</th><th>Session</th><th>Call status</th><th>Remarks from caller</th></tr></thead><tbody>' + list.map(function (a) {
        return '<tr><td><b>' + esc(a.fullName) + '</b></td><td>' + esc(A.phones(a)) + '</td><td>' + esc(a.session || '—') + '</td><td><span class="chip ' + tone(a.callStatus) + '">' + esc(a.callStatus || 'Not called') + '</span></td><td>' + esc(a.callNote) + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<div class="empty">Nothing assigned.</div>');
    }
    detail();
    if ($('#cAuto', el)) $('#cAuto', el).onclick = function () {
      var act = callers.filter(function (c) { return c.active === 'Yes'; });
      A.confirm('Share ' + unassigned.length + ' candidates equally?', 'They will be divided among ' + act.length + ' active caller(s): ' + esc(act.map(function (c) { return c.name; }).join(', ')) + '. You can move any of them later.', 'Assign').then(function (ok) {
        if (!ok) return;
        var by = {}; unassigned.sort(A.nameCmp).forEach(function (a, i) { var u = act[i % act.length].username; (by[u] = by[u] || []).push(a.id); });
        Promise.all(Object.keys(by).map(function (u) { return A.save(by[u], { caller: u }, 'Caller assignment'); })).then(function () { D.toast('Assigned', 'ok'); });
      });
    };
  };

  /* ================================ Banners (admins) ================================ */
  var draft = null;
  V.banners = function (el) {
    el.innerHTML = head('Landing-page banners', 'Images shown one after another at the top of the application page. Paste a direct image link for each.',
      '<button class="btn" id="bAdd">+ Add image</button><button class="btn primary" id="bSave">Save banners</button>') +
      '<div class="note-box" style="margin-bottom:14px"><b>Best image size:</b> 1600 × 600 px (8:3 landscape), JPG, WebP, PNG or <b>animated GIF</b>, ideally under 300 KB each (GIFs under 1 MB). Only <b>links</b> are accepted. Nothing is uploaded to this portal, which keeps it light. Keep the important part (text, faces) inside the central 1000 × 600 px, because phones crop the sides. Up to 20 images.<br>' +
      '<b>Where to host:</b> upload the image to the same GitHub repository (e.g. a <code>banners</code> folder) and use its raw link, or use any public image link. A Google Drive file must be shared as <i>Anyone with the link</i>; paste the normal Drive link and it is converted automatically.</div>' +
      '<div id="bList"><div class="muted">Loading…</div></div>';
    function paint() {
      $('#bList', el).innerHTML = draft.length ? draft.map(function (b, i) {
        return '<div class="brow"><div class="bthumb">' + (b.url ? '<img src="' + esc(b.url) + '" alt="" onerror="this.style.opacity=.2">' : '') + '</div><div class="bf">' +
          '<input type="url" data-b="url" data-i="' + i + '" placeholder="https://… image link" value="' + esc(b.url) + '" aria-label="Image link ' + (i + 1) + '">' +
          '<input type="text" data-b="caption" data-i="' + i + '" placeholder="Caption (optional)" maxlength="120" value="' + esc(b.caption) + '" aria-label="Caption ' + (i + 1) + '">' +
          '<label class="chk"><input type="checkbox" data-b="active" data-i="' + i + '"' + (b.active === 'Yes' ? ' checked' : '') + '> Show on page</label></div>' +
          '<div class="bact"><button class="btn small" data-up="' + i + '"' + (i ? '' : ' disabled') + ' aria-label="Move up">↑</button><button class="btn small" data-dn="' + i + '"' + (i < draft.length - 1 ? '' : ' disabled') + ' aria-label="Move down">↓</button><button class="btn small danger" data-rm="' + i + '">Remove</button></div></div>';
      }).join('') : '<div class="empty">No banners yet. Click <b>+ Add image</b>.</div>';
      $$('[data-b]', el).forEach(function (x) { x.onchange = x.oninput = function () { var b = draft[+x.dataset.i]; b[x.dataset.b] = x.type === 'checkbox' ? (x.checked ? 'Yes' : 'No') : x.value; }; });
      $$('[data-b="url"]', el).forEach(function (x) { x.onchange = function () { draft[+x.dataset.i].url = x.value.trim(); paint(); }; });
      $$('[data-rm]', el).forEach(function (x) { x.onclick = function () { draft.splice(+x.dataset.rm, 1); paint(); }; });
      $$('[data-up]', el).forEach(function (x) { x.onclick = function () { var i = +x.dataset.up, t = draft[i]; draft[i] = draft[i - 1]; draft[i - 1] = t; paint(); }; });
      $$('[data-dn]', el).forEach(function (x) { x.onclick = function () { var i = +x.dataset.dn, t = draft[i]; draft[i] = draft[i + 1]; draft[i + 1] = t; paint(); }; });
    }
    function open() { paint(); }
    if (draft) open(); else A.api('getBanners').then(function (r) { draft = r; open(); }, function (e) { D.toast(e.message, 'err'); });
    $('#bAdd', el).onclick = function () { if (!draft) return; draft.push({ url: '', caption: '', active: 'Yes' }); paint(); };
    $('#bSave', el).onclick = function () {
      var list = draft.filter(function (b) { return b.url.trim(); });
      A.api('saveBanners', list).then(function (r) { draft = r; D.toast('Banners saved. They appear on the form within a few minutes.', 'ok'); paint(); }, function (e) { D.toast(e.message, 'err'); });
    };
  };


  /* ============================== Instagram preview card (admins) ============================== */
  var sdraft = null;
  V.social = function (el) {
    var page = (S.settings || {}).INSTAGRAM_URL || '';
    el.innerHTML = head('Instagram preview card', 'The card beside the application form (below it on phones). Add up to 3 recent posts or reels; people who tap it land on your Instagram.',
      '<button class="btn" id="sAdd">+ Add post</button><button class="btn primary" id="sSave">Save</button>') +
      '<div class="note-box" style="margin-bottom:14px"><b>Instagram page:</b> ' + (page ? '<a href="' + esc(page) + '" target="_blank" rel="noopener">' + esc(page) + '</a>' : 'not set') + ' (change it under Settings → INSTAGRAM_URL).<br>' +
      '<b>For each post:</b> just paste the post or reel link. When you save, the system fetches the post\'s <b>official Instagram picture</b> by itself. If Instagram does not hand it over, the card shows a designed DCIP tile instead; you can also paste your own <b>picture link</b> (ImgBB, GitHub or Drive) at any time, and it is always used first. Short caption optional. Until a post is added, only the small “Follow on Instagram” link shows.</div>' +
      '<div id="sList"><div class="muted">Loading…</div></div>';
    function paint() {
      $('#sList', el).innerHTML = sdraft.length ? sdraft.map(function (b, i) {
        return '<div class="brow"><div class="bthumb" style="aspect-ratio:4/5;max-width:110px">' + (b.thumb ? '<img src="' + esc(b.thumb) + '" alt="" onerror="this.style.opacity=.2">' : '') + '</div><div class="bf">' +
          '<input type="url" data-s="url" data-i="' + i + '" placeholder="https://www.instagram.com/reel/…" value="' + esc(b.url) + '" aria-label="Post link ' + (i + 1) + '">' +
          '<input type="url" data-s="thumb" data-i="' + i + '" placeholder="Picture link (optional – the official picture is fetched when left empty)" value="' + esc(b.thumb) + '" aria-label="Picture link ' + (i + 1) + '">' +
          '<input type="text" data-s="caption" data-i="' + i + '" placeholder="Caption (optional)" maxlength="80" value="' + esc(b.caption) + '" aria-label="Caption ' + (i + 1) + '">' +
          '<label class="chk"><input type="checkbox" data-s="active" data-i="' + i + '"' + (b.active === 'Yes' ? ' checked' : '') + '> Show</label></div>' +
          '<div class="bact"><button class="btn small danger" data-rm="' + i + '">Remove</button></div></div>';
      }).join('') : '<div class="empty">No posts yet. Click <b>+ Add post</b>.</div>';
      $$('[data-s]', el).forEach(function (x) { x.onchange = x.oninput = function () { var b = sdraft[+x.dataset.i]; b[x.dataset.s] = x.type === 'checkbox' ? (x.checked ? 'Yes' : 'No') : x.value; }; });
      $$('[data-s="thumb"]', el).forEach(function (x) { x.onchange = function () { sdraft[+x.dataset.i].thumb = x.value.trim(); paint(); }; });
      $$('[data-rm]', el).forEach(function (x) { x.onclick = function () { sdraft.splice(+x.dataset.rm, 1); paint(); }; });
    }
    if (sdraft) paint(); else A.api('getSocial').then(function (r) { sdraft = r; paint(); }, function (e) { D.toast(e.message, 'err'); });
    $('#sAdd', el).onclick = function () { if (!sdraft) return; if (sdraft.length >= 3) { D.toast('Up to 3 posts.', 'err'); return; } sdraft.push({ url: '', thumb: '', caption: '', active: 'Yes' }); paint(); };
    $('#sSave', el).onclick = function () {
      A.api('saveSocial', sdraft.filter(function (b) { return b.url.trim() || b.thumb.trim(); })).then(function (r) { sdraft = r; D.toast('Saved. The card appears on the form within a few minutes.', 'ok'); paint(); }, function (e) { D.toast(e.message, 'err'); });
    };
  };

  /* ========================== My calls (caller accounts) ========================== */
  S.myF = 'todo';
  V.mycalls = function (el) {
    var my = S.my; if (!my) { el.innerHTML = '<div class="muted">Loading…</div>'; return; }
    var calls = my.calls, statuses = (my.statuses || []).filter(function (x) { return x !== 'Not called'; });
    var left = calls.filter(function (c) { return !c.callStatus || c.callStatus === 'Not called'; }).length, ok = calls.filter(function (c) { return c.callStatus === 'Confirmed'; }).length;
    var list = calls.filter(function (c) { var pend = !c.callStatus || c.callStatus === 'Not called'; return S.myF === 'all' || (S.myF === 'todo' ? pend : !pend); });
    el.innerHTML = head('My calls', 'Welcome, <b>' + esc(my.name) + '</b>. Call each candidate, check the details, then mark the outcome.', '<div class="seg" role="group">' + [['todo', 'To call (' + left + ')'], ['done', 'Called (' + (calls.length - left) + ')'], ['all', 'All (' + calls.length + ')']].map(function (t) { return '<button aria-pressed="' + (S.myF === t[0]) + '" data-f="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>') +
      '<div class="kv"><div><b>' + calls.length + '</b>assigned to me</div><div><b>' + ok + '</b>confirmed</div><div><b>' + left + '</b>still to call</div></div>' +
      (list.length ? '<div class="cards">' + list.map(function (c) {
        var wa = String(c.whatsapp || c.mobile).replace(/\D/g, ''); if (wa.length === 10) wa = '91' + wa;
        return '<div class="sc callcard" data-id="' + esc(c.id) + '"><div class="info"><b>' + esc(c.fullName) + '</b> <span class="muted">' + esc(c.age) + ' yrs · ' + esc(c.gender) + ' · ' + esc(c.location) + '</span>' +
          '<div class="muted" style="font-size:13px">' + esc(c.qual) + (c.mastersInstitution ? ' · ' + esc(c.mastersInstitution) : '') + '<br>' + esc(c.ug) + '</div>' +
          '<div style="margin-top:6px"><b>Interview:</b> ' + esc(c.sessionDate ? D.fmtDate(c.sessionDate) + ' · ' + c.sessionSlot : 'Not assigned yet') + ' · ' + esc(c.mode) + (c.venue ? ' · ' + esc(c.venue) : '') + (c.link ? ' · <a href="' + esc(c.link) + '" target="_blank" rel="noopener">link</a>' : '') + '</div>' +
          '<div class="callbtns"><a class="btn small primary" href="tel:' + esc(c.mobile) + '">📞 ' + esc(c.mobile) + '</a>' + (c.altMobile ? '<a class="btn small" href="tel:' + esc(c.altMobile) + '">📞 ' + esc(c.altMobile) + '</a>' : '') + '<a class="btn small" target="_blank" rel="noopener" href="https://wa.me/' + esc(wa) + '">WhatsApp ' + esc(c.whatsapp || c.mobile) + '</a></div></div>' +
          '<div class="acts callform"><div class="opts compact" role="radiogroup" aria-label="Call status">' + statuses.map(function (st) { return '<button type="button" class="opt" role="radio" aria-checked="' + (c.callStatus === st) + '" data-st="' + esc(st) + '">' + esc(st) + '</button>'; }).join('') + '</div>' +
          '<input type="text" class="cnote" maxlength="300" placeholder="Remarks (e.g. will attend, call after 6 pm…)" value="' + esc(c.callNote) + '" aria-label="Remarks for ' + esc(c.fullName) + '"><button class="btn small primary csave">Save</button></div></div>';
      }).join('') + '</div>' : '<div class="empty">' + (calls.length ? 'Nothing in this list.' : 'No candidates have been assigned to you yet.') + '</div>');
    $$('[data-f]', el).forEach(function (b) { b.onclick = function () { S.myF = b.dataset.f; A.render(); }; });
    $$('.callcard', el).forEach(function (card) {
      var id = card.dataset.id, c = calls.filter(function (x) { return x.id === id; })[0], pick = c.callStatus;
      $$('[data-st]', card).forEach(function (b) { b.onclick = function () { pick = b.dataset.st; $$('[data-st]', card).forEach(function (x) { x.setAttribute('aria-checked', x === b); }); }; });
      $('.csave', card).onclick = function () {
        var note = $('.cnote', card).value;
        if (!pick) { D.toast('Choose the call status first.', 'err'); return; }
        A.api('updateMyCall', id, { callStatus: pick, callNote: note }).then(function (r) { c.callStatus = r.callStatus; c.callNote = r.callNote; D.toast('Saved', 'ok'); A.renderSoft(); }, function (e) { D.toast(e.message, 'err'); });
      };
    });
  };

  /* ============================ Interview board: scores per member, totals and rank list ============================ */
  var CUT_KEY = 'SELECTION_SIZE';
  function cutSize() { return Math.max(1, Math.floor(Number((S.settings || {})[CUT_KEY]) || 25)); }
  function maxScore() { return Number(S.maxScore) || 10; }
  function fmtNum(n) { return n == null || n === '' ? '' : String(Math.round(Number(n) * 100) / 100); }
  /** Candidates on the rank list with every board member's score, the total and the rank (equal totals share a rank). */
  A.panelRows = function () {
    var members = S.board || [], by = {};
    (S.scores || []).forEach(function (r) { (by[r.appId] = by[r.appId] || {})[r.member] = r.score; });
    var pool = S.apps.filter(function (a) { return a.shortlisted === 'Yes' && ['Disqualified', 'Withdrawn'].indexOf(a.status) < 0; });
    var rows = pool.map(function (a) {
      var sc = by[a.id] || {}, n = 0, t = 0; members.forEach(function (m) { if (sc[m.id] != null) { n++; t += sc[m.id]; } });
      return { a: a, sc: sc, n: n, total: n ? Math.round(t * 100) / 100 : null };
    }).sort(function (x, y) { return (y.total == null ? -1e9 : y.total) - (x.total == null ? -1e9 : x.total) || A.nameCmp(x.a, y.a); });
    var rank = 0, prev = null, pos = 0;
    rows.forEach(function (r) { if (r.total == null) { r.rank = null; return; } pos++; if (r.total !== prev) { rank = pos; prev = r.total; } r.rank = rank; });
    var cut = cutSize();
    rows.forEach(function (r) { r.top = r.rank != null && r.rank <= cut; });
    return { members: members, rows: rows, max: maxScore(), cut: cut, scored: rows.filter(function (r) { return r.total != null; }).length };
  };
  /** Tells the insights which candidates are in the top of the rank list. */
  A.syncRanked = function () {
    var P = A.panelRows(), ids = {}, k = 0;
    P.rows.forEach(function (r) { if (r.rank != null && k < P.cut) { ids[r.a.id] = 1; k++; } });
    w.Insights.setRanked(ids, P.cut);
    return P;
  };
  /** A short read-only line inside a candidate's drawer. */
  A.panelBlock = function (a) {
    if (a.shortlisted !== 'Yes' && a.interviewScore === '') return '';
    var P = A.panelRows(), r = P.rows.filter(function (x) { return x.a.id === a.id; })[0];
    if (!r || r.total == null) return '<h4>Interview board</h4><p class="muted" style="margin:0">No scores entered yet. Enter them under <b>Interview scores</b>.</p>';
    return '<h4>Interview board · total ' + esc(fmtNum(r.total)) + (r.rank ? ' · rank ' + r.rank : '') + '</h4><div class="tw"><table class="t"><thead><tr>' + P.members.map(function (m) { return '<th class="num">' + esc(m.name) + '</th>'; }).join('') + '<th class="num">Total</th></tr></thead><tbody><tr>' +
      P.members.map(function (m) { return '<td class="num">' + (r.sc[m.id] != null ? esc(fmtNum(r.sc[m.id])) : '<span class="muted">–</span>') + '</td>'; }).join('') + '<td class="num"><b>' + esc(fmtNum(r.total)) + '</b></td></tr></tbody></table></div>';
  };
  function boardDialog() {
    var list = (S.board || []).map(function (m) { return { id: m.id, name: m.name }; });
    if (!list.length) list = [{ id: '', name: '' }, { id: '', name: '' }, { id: '', name: '' }];
    function draw() {
      var m = A.modal('<h3>Interview board members</h3><p class="muted" style="margin:0 0 10px">Name the members of the board. Each gets a column in the score table. They do not need a login.</p><div id="bdList">' +
        list.map(function (x, i) { return '<div class="bdrow" style="display:flex;gap:6px;margin-bottom:8px"><input type="text" data-bd="' + i + '" maxlength="60" placeholder="Member ' + (i + 1) + ' (e.g. Dr. Asha Nair)" value="' + esc(x.name) + '" aria-label="Board member ' + (i + 1) + '"><button class="btn small danger" data-rm="' + i + '" title="Remove this member" aria-label="Remove member ' + (i + 1) + '">✕</button></div>'; }).join('') + '</div>' +
        '<button class="btn small" id="bdAdd"' + (list.length >= 12 ? ' disabled' : '') + '>+ Add member</button><p class="hint" style="margin-top:10px">Removing a member also removes the scores entered under their name, and the totals are recalculated.</p>' +
        '<div class="acts"><button class="btn" id="cNo">Cancel</button><button class="btn primary" id="cYes">Save board</button></div>');
      $$('[data-bd]', m).forEach(function (inp) { inp.oninput = function () { list[+inp.dataset.bd].name = inp.value; }; });
      $$('[data-rm]', m).forEach(function (b) { b.onclick = function () { var x = list[+b.dataset.rm]; if (x.id && (S.scores || []).some(function (r) { return r.member === x.id; })) { if (!window.confirm('Remove ' + (x.name || 'this member') + ' and the scores entered for them?')) return; } list.splice(+b.dataset.rm, 1); draw(); }; });
      $('#bdAdd', m).onclick = function () { list.push({ id: '', name: '' }); draw(); var all = $$('[data-bd]', $('#modal')); if (all.length) all[all.length - 1].focus(); };
      $('#cNo', m).onclick = A.closeModal;
      $('#cYes', m).onclick = function () {
        var names = list.filter(function (x) { return x.name.trim(); }); if (!names.length) { D.toast('Add at least one board member.', 'err'); return; }
        A.api('saveBoard', names).then(function () { A.closeModal(); D.toast('Board saved', 'ok'); return A.refresh(); }, function (e) { D.toast(e.message, 'err'); });
      };
    }
    draw();
  }
  function topInsights() {
    A.syncRanked(); var data = w.Insights.compute(S.apps, 'ranked', S.settings);
    var m = A.modal('<h3>' + esc(data.label) + '</h3><p class="muted" style="margin:0 0 10px">Who is in the top ' + esc(cutSize()) + ' of the interview rank list: district, gender, education, age, college, stream, subject and local body.</p><div id="insTop"></div><div class="acts"><button class="btn" id="insX">Excel</button><button class="btn" id="insP">PDF</button><button class="btn primary" id="cYes">Close</button></div>');
    m.classList.add('wide'); w.Insights.render($('#insTop', m), data);
    $('#cYes', m).onclick = A.closeModal; $('#insX', m).onclick = function () { A.download(A.reports.insights('ranked'), 'xlsx'); }; $('#insP', m).onclick = function () { A.download(A.reports.insights('ranked'), 'pdf'); };
  }
  S.pF = { sess: '', q: '' };
  V.panel = function (el) {
    var P = A.syncRanked(), f = S.pF, sessions = A.sortSessions(S.sessions), mx = P.max, cols = P.members;
    var q = f.q.trim().toLowerCase();
    var rows = P.rows.filter(function (r) { return (!f.sess || (f.sess === '__none' ? !r.a.session : r.a.session === f.sess)) && (!q || (r.a.fullName + ' ' + r.a.id).toLowerCase().indexOf(q) >= 0); });
    el.innerHTML = head('Interview scores', 'Type each board member\'s score for every candidate (0 to <b>' + esc(mx) + '</b>). The total and rank update by themselves, and the rank list is built on the total. The top <b>' + esc(P.cut) + '</b> (selection size) are highlighted.',
      '<button class="btn" id="bdEdit">Board members (' + cols.length + ')</button><button class="btn" id="insBtn"' + (P.scored ? '' : ' disabled') + '>Insights – top ' + esc(P.cut) + '</button><button class="btn small" data-dl="xlsx">Excel</button><button class="btn small" data-dl="pdf">PDF</button>') +
      '<div class="kv"><div><b>' + cols.length + '</b>board members</div><div><b>' + P.scored + ' / ' + P.rows.length + '</b>candidates scored</div><div><b>' + P.rows.filter(function (r) { return r.n && r.n < cols.length; }).length + '</b>with a score still missing</div></div>' +
      (!cols.length ? '<div class="alert warn" style="padding:10px 14px;border-radius:8px;background:var(--warn-bg);color:var(--warn);font-weight:600;margin-bottom:12px">Start by naming the board: click <b>Board members</b> and add the people who interview. Each gets a column here.</div>' : '') +
      '<div class="toolbar"><input type="search" id="pQ" placeholder="Find a candidate…" value="' + esc(f.q) + '" style="max-width:240px" aria-label="Find a candidate"><select id="pSess" aria-label="Session" style="max-width:320px"><option value="">All sessions</option>' + sessions.map(function (s) { return '<option value="' + esc(s.id) + '"' + (f.sess === s.id ? ' selected' : '') + '>' + esc(A.sessionLabel(s)) + '</option>'; }).join('') + '<option value="__none"' + (f.sess === '__none' ? ' selected' : '') + '>Not yet assigned</option></select></div>' +
      (rows.length ? '<div class="tw"><table class="t" id="pTbl"><thead><tr><th class="num">Rank</th><th>Candidate</th><th>Session</th>' + cols.map(function (m) { return '<th class="num">' + esc(m.name) + '</th>'; }).join('') + '<th class="num">Total</th></tr></thead><tbody>' +
        rows.map(function (r) {
          var s = S.sessions.filter(function (x) { return x.id === r.a.session; })[0];
          return '<tr class="' + (r.top ? 'toprow' : '') + '"><td class="num">' + (r.rank == null ? '–' : r.rank) + '</td><td><a href="#" data-open="' + esc(r.a.id) + '"><b>' + esc(r.a.fullName) + '</b></a><small>' + esc(r.a.id) + ' · ' + esc(r.a.status) + (r.top ? ' · <b style="color:var(--ok)">Top ' + esc(P.cut) + '</b>' : '') + '</small></td><td class="nowrap">' + esc(s ? A.sessionLabel(s) : '—') + '</td>' +
            cols.map(function (m, ci) { return '<td class="num"><input type="number" class="score" step="0.5" min="0" max="' + esc(mx) + '" data-a="' + esc(r.a.id) + '" data-m="' + esc(m.id) + '" data-c="' + ci + '" value="' + (r.sc[m.id] != null ? esc(r.sc[m.id]) : '') + '" aria-label="' + esc(m.name) + ' – ' + esc(r.a.fullName) + '"></td>'; }).join('') +
            '<td class="num"><b>' + (r.total == null ? '–' : esc(fmtNum(r.total))) + '</b></td></tr>';
        }).join('') + '</tbody></table></div>' : '<div class="empty">No shortlisted candidates in this view.</div>');
    bindDlLocal(el, function () { return A.reports.panelScores(); });
    $('#bdEdit', el).onclick = boardDialog; $('#insBtn', el).onclick = topInsights;
    $('#pSess', el).onchange = function () { f.sess = this.value; A.render(); };
    $('#pQ', el).onchange = function () { f.q = this.value; A.render(); };
    $$('[data-open]', el).forEach(function (b) { b.onclick = function (e) { e.preventDefault(); A.openDrawer(b.dataset.open); }; });
    $$('input[data-a]', el).forEach(function (inp) {
      inp.onkeydown = function (e) { if (e.key !== 'Enter') return; e.preventDefault(); var all = $$('input[data-c="' + inp.dataset.c + '"]', el), i = all.indexOf(inp); this.blur(); setTimeout(function () { var n = $$('input[data-c="' + inp.dataset.c + '"]', $('#view'))[i + 1]; if (n) n.focus(); }, 160); };
      inp.onchange = function () {
        var v = inp.value.trim(), num = Number(v);
        if (v !== '' && (isNaN(num) || num < 0 || num > mx)) { D.toast('The score must be between 0 and ' + mx + '.', 'err'); inp.value = ''; v = ''; }
        A.api('saveBoardScore', inp.dataset.a, inp.dataset.m, v).then(function (r) {
          S.scores = (S.scores || []).filter(function (x) { return !(x.appId === inp.dataset.a && x.member === inp.dataset.m); });
          if (v !== '') S.scores.push({ appId: inp.dataset.a, member: inp.dataset.m, score: Math.round(Number(v) * 100) / 100 });
          var app = A.byId(inp.dataset.a); if (app) app.interviewScore = r.total;
          A.renderSoft();
        }, function (e) { D.toast(e.message, 'err'); });
      };
    });
  };
  function bindDlLocal(root, make) { $$('[data-dl]', root).forEach(function (b) { b.onclick = function () { A.download(make(), b.dataset.dl); }; }); }

})(window);
