/* Admin portal: sign-in, loading, live refresh, tab navigation. */
(function (w) {
  'use strict';
  var A = w.A, D = w.DCIP, S = A.S, $ = A.$, esc = D.esc;
  var KEY = 'dcip_admin_session', pollTimer = null, lastCount = null, failures = 0;

  /* ---------- session ---------- */
  function saveSession() { try { sessionStorage.setItem(KEY, JSON.stringify({ token: S.token, user: S.user, tab: S.tab })); } catch (e) {} }
  A.logout = function (msg) {
    S.token = ''; try { sessionStorage.removeItem(KEY); } catch (e) {}
    clearInterval(pollTimer); A.closeDrawer(); A.closeModal();
    $('#app').classList.add('hidden'); $('#login').classList.remove('hidden');
    $('#lerr').textContent = msg || ''; $('#lpin').value = '';
  };
  $('#loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var btn = $('#lbtn'); btn.disabled = true; btn.textContent = 'Signing in…'; $('#lerr').textContent = '';
    D.call('adminLogin', $('#lname').value, $('#lpin').value).then(function (r) { S.token = r.token; S.user = r.name; saveSession(); start(); },
      function (err) { $('#lerr').textContent = err.message; }).then(function () { btn.disabled = false; btn.textContent = 'Sign in'; });
  });
  $('#btnLogout').onclick = function () { A.logout(); };
  $('#btnRefresh').onclick = function () { A.loadState(true); };

  /* ---------- state ---------- */
  A.loadState = function (manual) {
    return A.api('getAdminState').then(function (st) {
      var firstLoad = lastCount === null;
      S.apps = st.applications; S.sessions = st.sessions; S.settings = st.settings; S.meta = st.settingsMeta; S.config = st.config; S.statuses = st.statuses;
      S.stamp = st.stamp; S.mailQuota = st.mailQuota; S.cvFolder = st.cvFolder;
      if (!firstLoad && st.applications.length > lastCount) D.toast((st.applications.length - lastCount) + ' new application' + (st.applications.length - lastCount > 1 ? 's' : '') + ' received', 'ok');
      lastCount = st.applications.length; failures = 0; live(true);
      $('#hTitle').textContent = 'DCIP ' + (S.settings.BATCH_LABEL || ''); document.title = 'DCIP ' + (S.settings.BATCH_LABEL || '') + ' · Admin';
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
    $('#who').textContent = S.user;
    $('#tabs').innerHTML = A.TABS.map(function (t) { return '<button role="tab" aria-selected="' + (S.tab === t[0]) + '" data-tab="' + t[0] + '">' + esc(t[1]) + badge(t[0]) + '</button>'; }).join('');
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
  if (saved && saved.token) { S.token = saved.token; S.user = saved.user; if (saved.tab && A.TABS.some(function (t) { return t[0] === saved.tab; })) S.tab = saved.tab; start(); }
  else $('#login').classList.remove('hidden');
})(window);
