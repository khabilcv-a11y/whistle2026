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

  /* ============================ Interviewers: marks per candidate ============================ */
  function mk(n) { return Math.round(n * 2) / 2; }
  function sessLabel(c) { return c.sessionDate ? D.fmtDate(c.sessionDate) + ' · ' + c.sessionSlot : 'Session not set'; }
  S.iF = 'todo'; S.iSess = ''; S.iDraft = {};
  V.myinterviews = function (el) {
    var my = S.myI; if (!my) { el.innerHTML = '<div class="muted">Loading…</div>'; return; }
    var crit = my.criteria, mx = my.maxMark, cands = my.candidates, done = cands.filter(function (c) { return c.myMarks; }).length;
    var sess = []; cands.forEach(function (c) { var k = c.session || ''; if (!sess.some(function (x) { return x.k === k; })) sess.push({ k: k, t: sessLabel(c) }); });
    if (S.iSess && !sess.some(function (x) { return x.k === S.iSess; })) S.iSess = '';
    var list = cands.filter(function (c) { return (!S.iSess || (c.session || '') === S.iSess) && (S.iF === 'all' || (S.iF === 'todo' ? !c.myMarks : !!c.myMarks)); });
    function draft(c) { var d = S.iDraft[c.id]; if (!d) d = S.iDraft[c.id] = { marks: c.myMarks ? c.myMarks.slice() : crit.map(function () { return null; }), remark: c.myRemark || '' }; return d; }
    function total(d) { return d.marks.reduce(function (t, n) { return t + (n == null ? 0 : n); }, 0); }
    el.innerHTML = head('My interviews', 'Welcome, <b>' + esc(my.name) + '</b>. Give each candidate a mark for every item (0 to ' + mx + '), then save. Only you can see your marks; the office combines everyone\'s marks.',
      '<div class="seg" role="group">' + [['todo', 'To score (' + (cands.length - done) + ')'], ['done', 'Scored (' + done + ')'], ['all', 'All (' + cands.length + ')']].map(function (t) { return '<button aria-pressed="' + (S.iF === t[0]) + '" data-f="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>') +
      (sess.length > 1 ? '<div class="toolbar"><select id="iSess" aria-label="Interview session" style="max-width:340px"><option value="">All sessions</option>' + sess.map(function (x) { return '<option value="' + esc(x.k) + '"' + (S.iSess === x.k ? ' selected' : '') + '>' + esc(x.t) + '</option>'; }).join('') + '</select></div>' : '') +
      '<div class="kv"><div><b>' + cands.length + '</b>shortlisted candidates</div><div><b>' + done + '</b>scored by me</div><div><b>' + (cands.length - done) + '</b>still to score</div></div>' +
      (list.length ? '<div class="cards">' + list.map(function (c) {
        var d = draft(c);
        return '<div class="sc icard" data-id="' + esc(c.id) + '"><div class="info"><b>' + esc(c.fullName) + '</b> <span class="muted">' + esc(c.age) + ' yrs · ' + esc(c.gender) + ' · ' + esc(c.location) + '</span>' + (c.myMarks ? ' <span class="chip ok">Scored ' + esc(c.myTotal) + ' / ' + esc(my.max) + '</span>' : '') +
          '<div class="muted" style="font-size:13px">' + esc(c.qual) + (c.mastersInstitution ? ' · ' + esc(c.mastersInstitution) : '') + '<br>' + esc(c.ug) + (c.completion ? ' · ' + esc(D.fmtMonthYear(c.completion)) : '') + '</div>' +
          '<div style="margin-top:4px"><b>' + esc(sessLabel(c)) + '</b> · ' + esc(c.mode) + (c.venue ? ' · ' + esc(c.venue) : '') + (c.attendance ? ' · <span class="chip ' + (c.attendance === 'Present' ? 'ok' : 'bad') + '">' + esc(c.attendance) + '</span>' : '') + '</div>' +
          '<details style="margin-top:8px"><summary style="cursor:pointer;font-weight:700">Read their answers' + (c.cv ? ' and CV' : '') + '</summary>' +
          (c.cv ? '<p><a class="btn small" href="' + esc(c.cv) + '" target="_blank" rel="noopener">Open CV ↗</a></p>' : '') +
          '<label class="f">Why DCIP?</label><div class="note-box">' + esc(c.motivation) + '</div>' + (c.background ? '<label class="f" style="margin-top:8px">Background and influences' + (c.backgroundQ ? ' · question <b>' + esc(c.backgroundQ) + '</b>' : '') + '</label><div class="note-box">' + esc(c.background) + '</div>' : '') + '</details></div>' +
          '<div class="marks">' + crit.map(function (name, i) {
            var chips = ''; for (var n = 0; n <= mx && mx <= 10; n++) chips += '<button type="button" class="mkb" data-i="' + i + '" data-v="' + n + '" aria-pressed="' + (d.marks[i] === n) + '">' + n + '</button>';
            return '<div class="mrow"><div class="mlab">' + esc(name) + '</div>' + (mx <= 10 ? '<div class="mchips" role="group" aria-label="' + esc(name) + '">' + chips + '</div>' : '<input type="number" class="mnum" data-i="' + i + '" min="0" max="' + mx + '" step="0.5" value="' + (d.marks[i] == null ? '' : d.marks[i]) + '" aria-label="' + esc(name) + '">') + '</div>';
          }).join('') + '</div>' +
          '<div class="acts callform"><span class="mtot"><b class="tv">' + total(d) + '</b> / ' + my.max + '</span><input type="text" class="cnote" maxlength="500" placeholder="Remarks (optional)" value="' + esc(d.remark) + '" aria-label="Remarks for ' + esc(c.fullName) + '"><button class="btn small primary csave">' + (c.myMarks ? 'Update marks' : 'Save marks') + '</button></div></div>';
      }).join('') + '</div>' : '<div class="empty">' + (cands.length ? 'Nothing in this list.' : 'No candidates have been shortlisted yet.') + '</div>');
    $$('[data-f]', el).forEach(function (b) { b.onclick = function () { S.iF = b.dataset.f; A.render(); }; });
    if ($('#iSess', el)) $('#iSess', el).onchange = function () { S.iSess = this.value; A.render(); };
    $$('.icard', el).forEach(function (card) {
      var id = card.dataset.id, c = cands.filter(function (x) { return x.id === id; })[0], d = draft(c);
      function sum() { $('.tv', card).textContent = total(d); }
      $$('.mkb', card).forEach(function (b) { b.onclick = function () { var i = +b.dataset.i, v = +b.dataset.v; d.marks[i] = v; $$('.mkb[data-i="' + i + '"]', card).forEach(function (x) { x.setAttribute('aria-pressed', x === b); }); sum(); }; });
      $$('.mnum', card).forEach(function (inp) { inp.oninput = function () { d.marks[+inp.dataset.i] = inp.value === '' ? null : mk(Number(inp.value)); sum(); }; });
      $('.cnote', card).oninput = function () { d.remark = this.value; };
      $('.csave', card).onclick = function () {
        var missing = crit.filter(function (n, i) { return d.marks[i] == null || isNaN(d.marks[i]); });
        if (missing.length) { D.toast('Give a mark for: ' + missing.join(', '), 'err'); return; }
        var btn = this; btn.disabled = true;
        A.api('saveInterviewScore', id, d.marks, d.remark).then(function (r) { c.myMarks = d.marks.slice(); c.myTotal = r.total; c.myRemark = d.remark; delete S.iDraft[id]; D.toast(c.fullName + ': saved ' + r.total + ' / ' + r.max, 'ok'); A.renderSoft(); },
          function (e) { D.toast(e.message, 'err'); }).then(function () { btn.disabled = false; });
      };
    });
  };

  /* ============================ Panel scores (officials) ============================ */
  function scoresOf(id) { return (S.scores || []).filter(function (r) { return r.appId === String(id); }); }
  function names() {
    var m = {}; (S.interviewers || []).forEach(function (u) { m[u.username] = u.name; });
    (S.scores || []).forEach(function (r) { if (!m[r.interviewer]) m[r.interviewer] = r.interviewerName || r.interviewer; });
    return m;
  }
  A.panelRows = function () {
    var nm = names(), users = Object.keys(nm).sort(function (a, b) { return String(nm[a]).localeCompare(String(nm[b])); });
    var pool = S.apps.filter(function (a) { return (a.shortlisted === 'Yes' && ['Disqualified', 'Withdrawn'].indexOf(a.status) < 0) || scoresOf(a.id).length; });
    var rows = pool.map(function (a) {
      var sc = scoresOf(a.id), by = {}; sc.forEach(function (r) { by[r.interviewer] = r; });
      var avg = sc.length ? Math.round(sc.reduce(function (t, r) { return t + r.total; }, 0) / sc.length * 10) / 10 : null;
      return { a: a, by: by, n: sc.length, avg: avg };
    }).sort(function (x, y) { return (y.avg == null ? -1e9 : y.avg) - (x.avg == null ? -1e9 : x.avg) || A.nameCmp(x.a, y.a); });
    return { users: users, names: nm, rows: rows, max: (S.scoring || {}).max || 0, criteria: (S.scoring || {}).criteria || [] };
  };
  /** The marks section shown inside a candidate's drawer. */
  A.panelBlock = function (a) {
    var sc = scoresOf(a.id), cr = (S.scoring || {}).criteria || [], max = (S.scoring || {}).max;
    if (!a.shortlisted && !sc.length) return '';
    if (!sc.length) return '<h4>Interview panel</h4><p class="muted" style="margin:0">No interviewer has entered marks yet.</p>';
    var avg = Math.round(sc.reduce(function (t, r) { return t + r.total; }, 0) / sc.length * 10) / 10;
    return '<h4>Interview panel · average ' + esc(avg) + ' / ' + esc(max) + '</h4><div class="tw"><table class="t"><thead><tr><th>Interviewer</th>' + cr.map(function (c) { return '<th class="num" title="' + esc(c) + '">' + esc(c.length > 14 ? c.slice(0, 13) + '…' : c) + '</th>'; }).join('') + '<th class="num">Total</th><th></th></tr></thead><tbody>' +
      sc.map(function (r) { return '<tr><td><b>' + esc(r.interviewerName || r.interviewer) + '</b>' + (r.remark ? '<small>' + esc(r.remark) + '</small>' : '') + '</td>' + cr.map(function (c, i) { return '<td class="num">' + esc(r.marks[i] == null ? '' : r.marks[i]) + '</td>'; }).join('') + '<td class="num"><b>' + esc(r.total) + '</b></td><td><button class="btn small danger" data-rmscore="' + esc(r.interviewer) + '" title="Remove these marks">✕</button></td></tr>'; }).join('') +
      '</tbody></table></div><p class="hint" style="margin:6px 0 0">The Interview score above is the average of all interviewers\' totals and updates by itself.</p>';
  };
  V.panel = function (el) {
    var P = A.panelRows(), sessions = A.sortSessions(S.sessions);
    var f = S.pF || (S.pF = { sess: '', only: false });
    var rows = P.rows.filter(function (r) { return (!f.sess || (f.sess === '__none' ? !r.a.session : r.a.session === f.sess)) && (!f.only || r.n); });
    var scored = P.rows.filter(function (r) { return r.n; }).length;
    el.innerHTML = head('Panel scores', 'Every interviewer\'s total for each shortlisted candidate. The <b>Interview score</b> used for ranking and selection is the average of these totals. Marks are out of <b>' + esc(P.max) + '</b> (' + esc(P.criteria.length) + ' items, up to ' + esc((S.scoring || {}).maxMark) + ' each; change the items under <b>Settings</b>).',
      '<button class="btn small" data-dl="xlsx">Excel</button><button class="btn small" data-dl="pdf">PDF</button>') +
      '<div class="kv"><div><b>' + (S.interviewers || []).length + '</b>interviewers</div><div><b>' + scored + ' / ' + P.rows.length + '</b>candidates with marks</div><div><b>' + P.rows.filter(function (r) { return r.n && r.n >= Math.max(1, (S.interviewers || []).filter(function (u) { return u.active === 'Yes'; }).length); }).length + '</b>marked by every interviewer</div></div>' +
      '<div class="toolbar"><select id="pSess" aria-label="Session" style="max-width:320px"><option value="">All sessions</option>' + sessions.map(function (s) { return '<option value="' + esc(s.id) + '"' + (f.sess === s.id ? ' selected' : '') + '>' + esc(A.sessionLabel(s)) + '</option>'; }).join('') + '<option value="__none"' + (f.sess === '__none' ? ' selected' : '') + '>Not yet assigned</option></select>' +
      '<label class="chk" style="margin:0"><input type="checkbox" id="pOnly"' + (f.only ? ' checked' : '') + '> Only candidates with marks</label></div>' +
      (!(S.interviewers || []).length ? '<div class="alert warn" style="padding:10px 14px;border-radius:8px;background:var(--warn-bg);color:var(--warn);font-weight:600;margin-bottom:12px">No interviewers yet. Add them under <b>Users</b> (role: Interviewer); each gets their own login.</div>' : '') +
      (rows.length ? '<div class="tw"><table class="t"><thead><tr><th class="num">Rank</th><th>Candidate</th><th>Session</th>' + P.users.map(function (u) { return '<th class="num">' + esc(P.names[u]) + '</th>'; }).join('') + '<th class="num">Marked by</th><th class="num">Average</th></tr></thead><tbody>' +
        rows.map(function (r, i) {
          var rk = r.avg == null ? '–' : P.rows.indexOf(r) + 1, s = S.sessions.filter(function (x) { return x.id === r.a.session; })[0];
          return '<tr><td class="num">' + rk + '</td><td><a href="#" data-open="' + esc(r.a.id) + '"><b>' + esc(r.a.fullName) + '</b></a><small>' + esc(r.a.id) + ' · ' + esc(r.a.status) + '</small></td><td>' + esc(s ? A.sessionLabel(s) : '—') + '</td>' +
            P.users.map(function (u) { var x = r.by[u]; return '<td class="num">' + (x ? '<span title="' + esc((x.remark || '') + ' · marks ' + x.marks.join(', ')) + '">' + esc(x.total) + '</span>' : '<span class="muted">–</span>') + '</td>'; }).join('') +
            '<td class="num">' + r.n + '</td><td class="num"><b>' + (r.avg == null ? '–' : esc(r.avg)) + '</b></td></tr>';
        }).join('') + '</tbody></table></div>' : '<div class="empty">No candidates in this view.</div>');
    bindDlLocal(el, function () { return A.reports.panelScores(); });
    $('#pSess', el).onchange = function () { f.sess = this.value; A.render(); };
    $('#pOnly', el).onchange = function () { f.only = this.checked; A.render(); };
    $$('[data-open]', el).forEach(function (b) { b.onclick = function (e) { e.preventDefault(); A.openDrawer(b.dataset.open); }; });
  };
  function bindDlLocal(root, make) { $$('[data-dl]', root).forEach(function (b) { b.onclick = function () { A.download(make(), b.dataset.dl); }; }); }

})(window);
