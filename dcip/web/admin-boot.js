/* Admin portal: sign-in, loading, live refresh, tab navigation. */
(function (w) {
  'use strict';
  var A = w.A, D = w.DCIP, S = A.S, $ = A.$, esc = D.esc;
  if (w.DCIPSkyline) w.DCIPSkyline.mount($('#login'));
  var KEY = 'dcip_admin_session', pollTimer = null, lastCount = null, failures = 0;

  /* ---------- session ---------- */
  function saveSession() { try { sessionStorage.setItem(KEY, JSON.stringify({ token: S.token, user: S.user, tab: S.tab, me: S.me })); } catch (e) {} }
  A.logout = function (msg) {
    S.token = ''; try { sessionStorage.removeItem(KEY); } catch (e) {}
    clearInterval(pollTimer); A.closeDrawer(); A.closeModal();
    $('#app').classList.add('hidden'); $('#login').classList.remove('hidden');
    $('#lerr').textContent = msg || ''; $('#lpass').value = '';
  };
  $('#loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var btn = $('#lbtn'); btn.disabled = true; btn.textContent = 'Signing in…'; $('#lerr').textContent = '';
    D.call('adminLogin', $('#luser').value, $('#lpass').value).then(function (r) { S.token = r.token; S.user = r.user; S.me = { user: r.user, name: r.name, role: r.role }; S.tab = r.role === 'caller' ? 'mycalls' : 'overview'; saveSession(); start(); },
      function (err) { $('#lerr').textContent = err.message; }).then(function () { btn.disabled = false; btn.textContent = 'Sign in'; });
  });
  $('#btnLogout').onclick = function () { A.logout(); };
  $('#btnRefresh').onclick = function () { A.loadState(true); };
  $('#btnAccount').onclick = function () { A.changePasswordDialog(); };
  A.tabAllowed = function (id) {
    var role = (S.me || {}).role;
    if (role === 'caller') return id === 'mycalls';
    if (id === 'mycalls') return false;
    if (id === 'logs') return role === 'super';
    if (id === 'chats') return role === 'super' || !!S.canChats;
    return true;
  };

  /* ---------- state ---------- */
  A.loadState = function (manual) {
    if ((S.me || {}).role === 'caller') return A.api('getMyCalls').then(function (r) {
      S.my = r; S.stamp = r.stamp; failures = 0; live(true);
      $('#hTitle').textContent = 'DCIP APPLICATION PROCESSING & MANAGEMENT'; $('#hSub').textContent = 'Caller · ' + (r.name || S.user);
      A.renderSoft(); if (manual) D.toast('Refreshed', 'ok');
    }, function (e) { if (e.message !== 'SESSION_EXPIRED') { failures++; live(false); if (manual) D.toast(e.message, 'err'); } });
    return A.api('getAdminState').then(function (st) {
      var firstLoad = lastCount === null;
      S.apps = st.applications; S.sessions = st.sessions; S.settings = st.settings; S.meta = st.settingsMeta; S.config = st.config; S.statuses = st.statuses;
      S.stamp = st.stamp; S.mailQuota = st.mailQuota; S.cvFolder = st.cvFolder; S.me = st.me; S.canChats = st.canChats; S.callers = st.callers || []; S.callStatuses = (st.config || {}).callStatuses;
      if (!firstLoad && st.applications.length > lastCount) D.toast((st.applications.length - lastCount) + ' new application' + (st.applications.length - lastCount > 1 ? 's' : '') + ' received', 'ok');
      lastCount = st.applications.length; failures = 0; live(true);
      $('#hTitle').textContent = 'DCIP APPLICATION PROCESSING & MANAGEMENT'; $('#hSub').textContent = S.settings.BATCH_LABEL || ''; document.title = 'DCIP ' + (S.settings.BATCH_LABEL || '') + ' · Admin';
      A.renderSoft(); A.refreshDrawer(); if (manual) D.toast('Refreshed', 'ok');
    }, function (e) { if (e.message !== 'SESSION_EXPIRED') { failures++; live(false); if (manual) D.toast(e.message, 'err'); } });
  };
  function live(ok) { $('#live').classList.toggle('off', !ok); $('#liveText').textContent = ok ? 'Live · ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Offline – retrying'; }
  function poll() {
    if (document.hidden || !S.token) return;
    A.api('ping').then(function (p) { if (p.stamp !== S.stamp) return A.loadState(); live(true); failures = 0; }, function (e) { if (e.message !== 'SESSION_EXPIRED') { failures++; live(false); } });
  }

  /* ---------- rendering ---------- */
  function badge(k) {
    if (k === 'screening') { var n = S.apps.filter(A.needsScreening).length; return n ? '<span class="badge">' + n + '</span>' : ''; }
    return '';
  }
  A.render = function () {
    A.pendingRender = false;
    var me = S.me || { user: S.user, name: S.user, role: 'admin' };
    $('#who').innerHTML = esc(me.name || me.user) + ' <span class="rolechip ' + me.role + '">' + (me.role === 'super' ? 'Super admin' : me.role === 'caller' ? 'Caller' : 'Admin') + '</span>';
    var tabs = A.TABS.filter(function (t) { return A.tabAllowed(t[0]); });
    if (!tabs.some(function (t) { return t[0] === S.tab; })) S.tab = tabs[0][0];
    $('#tabs').innerHTML = tabs.map(function (t) { return '<button role="tab" aria-selected="' + (S.tab === t[0]) + '" data-tab="' + t[0] + '">' + esc(t[1]) + badge(t[0]) + '</button>'; }).join('');
    A.$$('#tabs button').forEach(function (b) { b.onclick = function () { S.tab = b.dataset.tab; saveSession(); window.scrollTo(0, 0); A.render(); }; });
    var v = $('#view'), top = window.scrollY;
    A.views[S.tab](v);
    window.scrollTo(0, top);
  };
  /** Re-renders unless the user is typing in a field (it re-renders when the field loses focus). */
  A.renderSoft = function () {
    var ae = document.activeElement;
    if (ae && /INPUT|SELECT|TEXTAREA/.test(ae.tagName) && $('#view').contains(ae)) { A.pendingRender = true; return; }
    A.render();
  };
  document.addEventListener('focusout', function () { setTimeout(function () { if (A.pendingRender && !(document.activeElement && /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName))) A.render(); }, 120); });

  function start() {
    $('#login').classList.add('hidden'); $('#app').classList.remove('hidden');
    lastCount = null; A.loadState();
    clearInterval(pollTimer); pollTimer = setInterval(poll, 6000);
  }

  var saved = null; try { saved = JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch (e) {}
  if (saved && saved.token) { S.token = saved.token; S.user = saved.user; S.me = saved.me || null; if (saved.tab && A.TABS.some(function (t) { return t[0] === saved.tab; })) S.tab = saved.tab; start(); }
  else $('#login').classList.remove('hidden');
})(window);
