/* Local preview: runs the real Code.gs in the browser against an in-memory/localStorage Google stand-in.
 * Open preview/index.html?p=index.html (public form) or ?p=admin.html (admin, PIN shown in the bar). */
(function () {
  'use strict';
  var KEY = 'dcip_preview_store_v1', stored = null;
  try { stored = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
  var fresh = !stored;
  var env = createGasEnv({ fetch: function (u, o) { return window.DCIP_MOCK_FETCH ? window.DCIP_MOCK_FETCH(u, o) : { code: 200, body: { choices: [{ message: { content: 'Demo AI answer.' } }] } }; }, load: stored || undefined, save: function (s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }, log: function (m) { console.log('[gas]', m); } });

  var xhr = new XMLHttpRequest(); xhr.open('GET', '../apps-script/Code.gs', false); xhr.send();
  var names = Object.keys(env.globals);
  var api = new Function(names.join(','), xhr.responseText + '\nreturn { doGet: doGet, doPost: doPost, setup: setup, internals: { findUser_: findUser_, setPasswordRow_: setPasswordRow_, insertUser_: insertUser_, FIELDS: FIELDS, sheet_: sheet_, appendRow_: appendRow_, recomputeDerived_: recomputeDerived_, screen_: screen_, applyScreening_: applyScreening_, settings_: settings_, readObjects_: readObjects_, nextId_: nextId_, APP: APP, audit_: audit_ } };')
    .apply(null, names.map(function (n) { return env.globals[n]; }));
  if (fresh || !env.store.props.TOKEN_SECRET) {
    api.setup(); var I = api.internals;
    I.setPasswordRow_(I.findUser_('superadmin'), 'Super@1234'); I.insertUser_('officer1', 'Officer One', 'admin', 'Officer@123', 'demo'); I.insertUser_('caller1', 'Caller One', 'caller', 'Caller@123', 'demo');
    if (window.seedDemo) window.seedDemo(api.internals, env);
    [['demo1', [['u', 'is there any stipend?', 'typed'], ['b', 'FAQ: Will I get a stipend?', 'faq:F31'], ['u', 'what about hostel', 'typed'], ['b', 'FAQ: Will I be provided lodging during the internship?', 'faq:F33']]],
     ['demo2', [['u', 'can i apply with a diploma', 'typed'], ['b', 'I do not have that information yet.', 'none'], ['u', 'is it ok to apply in my final year', 'typed'], ['b', 'FAQ: I am in my final year. Can I apply?', 'faq:F08']]],
     ['demo3', [['u', 'do you give a letter of recommendation', 'typed'], ['b', 'I do not have that information yet.', 'none']]]].forEach(function (c) {
      api.doPost({ postData: { contents: JSON.stringify({ fn: 'chatLog', args: [c[0], c[1].map(function (e) { return { r: e[0], t: e[1], s: e[2] }; })] }) } });
    });
  }

  window.DCIP_PREVIEW = { env: env, api: api, reset: function () { localStorage.removeItem(KEY); location.reload(); } };
  window.DCIP_CONFIG = { apiUrl: '' };
  window.DCIP_TRANSPORT = function (fn, args) {
    return new Promise(function (resolve, reject) {
      setTimeout(function () {
        try {
          var out = fn === '__config' ? JSON.parse(api.doGet({ parameter: { api: 'config' } }).getContent())
            : JSON.parse(api.doPost({ postData: { contents: JSON.stringify({ fn: fn, args: args }) } }).getContent());
          if (out.ok) resolve(out.result); else reject(new Error(out.error));
        } catch (e) { reject(e); }
      }, 120);
    });
  };

  /* floating preview bar: sent e-mails (so the OTP can be read) + reset */
  window.addEventListener('DOMContentLoaded', function () {
    var bar = document.createElement('div');
    bar.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:9999;font:12px system-ui;background:#111827;color:#e5e7eb;border-radius:8px;padding:6px 10px;max-width:430px;box-shadow:0 4px 18px rgba(0,0,0,.4)';
    bar.innerHTML = '<b style="color:#facc15">PREVIEW</b> super admin <b>superadmin / Super@1234</b> · admin <b>officer1 / Officer@123</b> · caller <b>caller1 / Caller@123</b> · <a href="#" id="pvMail" style="color:#93c5fd">inbox (<span id="pvN">0</span>)</a> · <a href="#" id="pvReset" style="color:#fca5a5">reset</a><div id="pvBox" style="display:none;max-height:50vh;overflow:auto;margin-top:6px"></div>';
    document.body.appendChild(bar);
    var box = bar.querySelector('#pvBox');
    function paint() {
      bar.querySelector('#pvN').textContent = env.store.mails.length;
      box.innerHTML = env.store.mails.slice().reverse().map(function (m, i) { return '<details style="margin:4px 0;background:#1f2937;border-radius:6px;padding:4px 8px"><summary>' + m.subject.replace(/</g, '&lt;') + '<br><span style="opacity:.7">to ' + m.to + '</span></summary><div style="background:#fff;color:#111;padding:8px;border-radius:6px;margin-top:4px">' + m.html + '</div></details>'; }).join('') || 'No e-mails yet.';
    }
    setInterval(paint, 700); paint();
    bar.querySelector('#pvMail').onclick = function (e) { e.preventDefault(); box.style.display = box.style.display === 'none' ? 'block' : 'none'; };
    bar.querySelector('#pvReset').onclick = function (e) { e.preventDefault(); if (confirm('Reset preview data?')) window.DCIP_PREVIEW.reset(); };
  });
})();
