/* Accessibility options: text size, high contrast, calmer motion. Remembered in this browser. */
(function (w) {
  'use strict';
  var KEY = 'dcip_a11y_v1', root = document.documentElement, st = { size: 0, hc: false, calm: false };
  try { var s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s) st = { size: s.size | 0, hc: !!s.hc, calm: !!s.calm }; } catch (e) {}
  if (!localStorage.getItem(KEY) && w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches) st.calm = true;
  function apply() {
    root.classList.toggle('a11y-lg', st.size === 1); root.classList.toggle('a11y-xl', st.size === 2);
    root.classList.toggle('a11y-hc', st.hc); root.classList.toggle('a11y-calm', st.calm);
    try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {}
    [].forEach.call(document.querySelectorAll('[data-a11y]'), function (b) {
      var k = b.dataset.a11y, on = k.indexOf('size') === 0 ? st.size === +k.slice(4) : st[k]; b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
  apply();
  function build() {
    var d = document.createElement('div');
    d.innerHTML = '<button type="button" class="a11y-fab" id="a11yFab" aria-haspopup="dialog" aria-expanded="false" aria-label="Accessibility options" title="Accessibility options"><svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="10.2" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="6.9" r="1.7" fill="currentColor"/><path d="M6.6 9.4l5.4 1 5.4-1M12 10.4v3.6M12 14l-2.7 4.4M12 14l2.7 4.4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
      '<div class="a11y-panel" id="a11yPanel" role="dialog" aria-label="Accessibility options" hidden><h2>Accessibility</h2>' +
      '<div class="row"><b>Text size</b><button type="button" class="o" data-a11y="size0">Normal</button><button type="button" class="o" data-a11y="size1">Large</button><button type="button" class="o" data-a11y="size2">Extra large</button></div>' +
      '<div class="row"><b>Display</b><button type="button" class="o" data-a11y="hc">High contrast</button><button type="button" class="o" data-a11y="calm">Calm motion</button></div>' +
      '<div class="row"><button type="button" class="o" id="a11yReset">Reset</button></div></div>';
    document.body.appendChild(d);
    var fab = document.getElementById('a11yFab'), panel = document.getElementById('a11yPanel');
    fab.onclick = function () { var open = panel.hidden; panel.hidden = !open; fab.setAttribute('aria-expanded', open); if (open) panel.querySelector('button').focus(); };
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) { panel.hidden = true; fab.setAttribute('aria-expanded', 'false'); fab.focus(); } });
    [].forEach.call(panel.querySelectorAll('[data-a11y]'), function (b) { b.onclick = function () { var k = b.dataset.a11y; if (k.indexOf('size') === 0) st.size = +k.slice(4); else st[k] = !st[k]; apply(); }; });
    document.getElementById('a11yReset').onclick = function () { st = { size: 0, hc: false, calm: false }; apply(); };
    apply();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
  w.DCIPA11y = { isCalm: function () { return st.calm; } };
})(window);
