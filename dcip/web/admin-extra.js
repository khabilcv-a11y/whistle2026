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
})(window);
