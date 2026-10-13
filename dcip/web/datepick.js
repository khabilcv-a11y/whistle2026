/* Friendly date pickers for the form.
 *  DCIPDate.date(hiddenInput, {min, max, startYear})   – a day picker with month and year selectors (and typing as dd/mm/yyyy)
 *  DCIPDate.month(hiddenInput, {min, max})              – a month + year picker; stores the last day of the month (yyyy-mm-dd)
 * The hidden input keeps the ISO value, so the rest of the form reads it as before. */
(function (w) {
  'use strict';
  var MON_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var MON_ML = ['ജനുവരി', 'ഫെബ്രുവരി', 'മാർച്ച്', 'ഏപ്രിൽ', 'മേയ്', 'ജൂൺ', 'ജൂലൈ', 'ഓഗസ്റ്റ്', 'സെപ്റ്റംബർ', 'ഒക്ടോബർ', 'നവംബർ', 'ഡിസംബർ'];
  var WK_EN = ['S', 'M', 'T', 'W', 'T', 'F', 'S'], WK_ML = ['ഞാ', 'തി', 'ചൊ', 'ബു', 'വ്യാ', 'വെ', 'ശ'];
  function isMl() { return window.DCIPLang && window.DCIPLang.get() === 'ml'; }
  var MON = { get length() { return 12; }, map: function (f) { return (isMl() ? MON_ML : MON_EN).map(f); } };
  function mon(i) { return (isMl() ? MON_ML : MON_EN)[i]; }
  var SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function pad(n) { return ('0' + n).slice(-2); }
  function ld(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
  function iso(y, m, d) { return y + '-' + pad(m) + '-' + pad(d); }
  function ok(y, m, d) { var x = new Date(Date.UTC(y, m - 1, d)); return x.getUTCFullYear() === y && x.getUTCMonth() === m - 1 && x.getUTCDate() === d; }
  var openPop = null;
  function closeAll() { if (openPop) { openPop.close(); openPop = null; } }
  document.addEventListener('click', function (e) { if (openPop && (e.composedPath ? e.composedPath() : []).indexOf(openPop.root) < 0 && !openPop.root.contains(e.target)) closeAll(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && openPop) { var f = openPop.focusBack; closeAll(); if (f) f.focus(); } });

  function shell(hidden, kind, placeholder) {
    var wrap = document.createElement('div'); wrap.className = 'dp';
    wrap.innerHTML = '<input type="text" class="dp-in" autocomplete="off" inputmode="' + (kind === 'date' ? 'numeric' : 'none') + '" placeholder="' + placeholder + '"' + (kind === 'month' ? ' readonly' : '') + ' aria-haspopup="dialog" aria-expanded="false">' +
      '<button type="button" class="dp-btn" aria-label="Open calendar" tabindex="-1"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M3.5 10h17M8 3v4M16 3v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>';
    hidden.parentNode.insertBefore(wrap, hidden.nextSibling);
    return wrap;
  }
  function emit(hidden) { hidden.dispatchEvent(new Event('input', { bubbles: true })); }
  function place(pop, anchor) {
    document.body.appendChild(pop);
    var r = anchor.getBoundingClientRect(), small = window.innerWidth < 600;
    if (small) { pop.classList.add('sheet'); pop.style.left = pop.style.top = ''; return; }
    var top = r.bottom + 6, ph = pop.offsetHeight;
    if (top + ph > window.innerHeight - 8 && r.top - ph - 6 > 8) top = r.top - ph - 6;
    pop.style.left = Math.max(8, Math.min(r.left + window.scrollX, window.innerWidth - pop.offsetWidth - 8)) + 'px'; pop.style.top = (top + window.scrollY) + 'px';
  }

  /* ---------------------------------------------- day picker ---------------------------------------------- */
  function date(hidden, o) {
    o = o || {}; var min = o.min || '1950-01-01', max = o.max || '2100-12-31', wrap = shell(hidden, 'date', 'DD / MM / YYYY'), inp = wrap.querySelector('.dp-in'), btn = wrap.querySelector('.dp-btn');
    var view = null;
    function show() { var v = hidden.value; inp.value = /^\d{4}-\d{2}-\d{2}$/.test(v) ? v.slice(8) + ' / ' + v.slice(5, 7) + ' / ' + v.slice(0, 4) : ''; }
    function set(v) { if (hidden.value === v) { show(); return; } hidden.value = v; show(); emit(hidden); }
    hidden.addEventListener('input', show); show();
    function parseTyped() {
      var m = /^\s*(\d{1,2})\D+(\d{1,2})\D+(\d{4})\s*$/.exec(inp.value) || /^\s*(\d{2})(\d{2})(\d{4})\s*$/.exec(inp.value);
      if (!inp.value.trim()) { set(''); return; }
      if (m && ok(+m[3], +m[2], +m[1])) { var v = iso(+m[3], +m[2], +m[1]); if (v >= min && v <= max) { set(v); return; } }
      show();
    }
    inp.addEventListener('change', parseTyped);
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); parseTyped(); } else if (e.key === 'ArrowDown') { e.preventDefault(); open(); } });
    function open() {
      closeAll();
      var cur = /^\d{4}-\d{2}-\d{2}$/.test(hidden.value) ? hidden.value : '';
      var base = cur || iso((o.startYear || (+max.slice(0, 4) - 22)), 6, 1);
      view = { y: +base.slice(0, 4), m: +base.slice(5, 7) };
      var pop = document.createElement('div'); pop.className = 'dp-pop'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Choose a date');
      function paint() {
        var y0 = +min.slice(0, 4), y1 = +max.slice(0, 4), first = new Date(Date.UTC(view.y, view.m - 1, 1)).getUTCDay(), n = ld(view.y, view.m), cells = '';
        for (var i = 0; i < first; i++) cells += '<span></span>';
        for (var d = 1; d <= n; d++) { var v = iso(view.y, view.m, d), dis = v < min || v > max; cells += '<button type="button" class="dp-d' + (v === cur ? ' sel' : '') + '"' + (dis ? ' disabled' : '') + ' data-v="' + v + '" aria-label="' + d + ' ' + mon(view.m - 1) + ' ' + view.y + '">' + d + '</button>'; }
        var yrs = ''; for (var y = y1; y >= y0; y--) yrs += '<option' + (y === view.y ? ' selected' : '') + '>' + y + '</option>';
        pop.innerHTML = '<div class="dp-head"><button type="button" class="dp-nav" data-n="-1" aria-label="Previous month">‹</button>' +
          '<select class="dp-m" aria-label="Month">' + MON.map(function (m, i) { return '<option value="' + (i + 1) + '"' + (i + 1 === view.m ? ' selected' : '') + '>' + m + '</option>'; }).join('') + '</select>' +
          '<select class="dp-y" aria-label="Year">' + yrs + '</select><button type="button" class="dp-nav" data-n="1" aria-label="Next month">›</button></div>' +
          '<div class="dp-wk">' + (isMl() ? WK_ML : WK_EN).map(function (x) { return '<span>' + x + '</span>'; }).join('') + '</div><div class="dp-grid">' + cells + '</div>' +
          '<div class="dp-foot"><button type="button" class="dp-link" data-clear>Clear</button><button type="button" class="dp-link" data-close>Close</button></div>';
        pop.querySelector('.dp-m').onchange = function () { view.m = +this.value; paint(); focusDay(); };
        pop.querySelector('.dp-y').onchange = function () { view.y = +this.value; paint(); focusDay(); };
        [].forEach.call(pop.querySelectorAll('.dp-nav'), function (b) { b.onclick = function () { view.m += +b.dataset.n; if (view.m < 1) { view.m = 12; view.y--; } if (view.m > 12) { view.m = 1; view.y++; } view.y = Math.max(y0, Math.min(y1, view.y)); paint(); }; });
        [].forEach.call(pop.querySelectorAll('.dp-d'), function (b) { b.onclick = function () { set(b.dataset.v); closeAll(); inp.focus(); }; });
        pop.querySelector('[data-clear]').onclick = function () { set(''); closeAll(); inp.focus(); };
        pop.querySelector('[data-close]').onclick = function () { closeAll(); inp.focus(); };
      }
      function focusDay() { var s = pop.querySelector('.dp-d.sel') || pop.querySelector('.dp-d:not([disabled])'); if (s && window.innerWidth >= 600) s.focus(); }
      paint(); place(pop, inp);
      inp.setAttribute('aria-expanded', 'true');
      openPop = { root: pop, close: function () { pop.remove(); inp.setAttribute('aria-expanded', 'false'); }, focusBack: inp };
      pop.addEventListener('mousedown', function (e) { e.stopPropagation(); });
      pop.addEventListener('keydown', function (e) {
        var b = document.activeElement; if (!b || !b.classList.contains('dp-d')) return;
        var step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key]; if (!step) return;
        e.preventDefault(); var all = [].slice.call(pop.querySelectorAll('.dp-d:not([disabled])')), i = all.indexOf(b) + step;
        if (all[i]) all[i].focus();
      });
    }
    btn.addEventListener('click', function (e) { e.stopPropagation(); if (openPop && openPop.root.isConnected && openPop.focusBack === inp) closeAll(); else open(); });
    inp.addEventListener('focus', function () { if (window.innerWidth < 600) inp.blur(), open(); });
    return { set: set, show: show };
  }

  /* --------------------------------------------- month picker --------------------------------------------- */
  function month(hidden, o) {
    o = o || {}; var min = o.min || '1980-01', max = o.max || '2035-12', wrap = shell(hidden, 'month', 'Select month and year'), inp = wrap.querySelector('.dp-in'), btn = wrap.querySelector('.dp-btn');
    function show() { var v = hidden.value; inp.value = /^\d{4}-\d{2}/.test(v) ? mon(+v.slice(5, 7) - 1) + ' ' + v.slice(0, 4) : ''; }
    function set(y, m) { var v = y ? iso(y, m, ld(y, m)) : ''; if (hidden.value === v) { show(); return; } hidden.value = v; show(); emit(hidden); }
    hidden.addEventListener('input', show); show();
    function open() {
      closeAll();
      var cur = /^\d{4}-\d{2}/.test(hidden.value) ? { y: +hidden.value.slice(0, 4), m: +hidden.value.slice(5, 7) } : null;
      var y = cur ? cur.y : Math.min(+max.slice(0, 4), Math.max(+min.slice(0, 4), +(o.startYear || new Date().getFullYear())));
      var pop = document.createElement('div'); pop.className = 'dp-pop dp-month'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Choose a month and year');
      function paint() {
        var y0 = +min.slice(0, 4), y1 = +max.slice(0, 4), cells = SHORT.map(function (s, i) {
          var key = y + '-' + pad(i + 1), dis = key < min || key > max;
          return '<button type="button" class="dp-mo' + (cur && cur.y === y && cur.m === i + 1 ? ' sel' : '') + '"' + (dis ? ' disabled' : '') + ' data-m="' + (i + 1) + '" aria-label="' + mon(i) + ' ' + y + '">' + s + '</button>';
        }).join('');
        pop.innerHTML = '<div class="dp-head"><button type="button" class="dp-nav" data-n="-1" aria-label="Previous year"' + (y <= y0 ? ' disabled' : '') + '>‹</button><b class="dp-year" aria-live="polite">' + y + '</b><button type="button" class="dp-nav" data-n="1" aria-label="Next year"' + (y >= y1 ? ' disabled' : '') + '>›</button></div>' +
          '<div class="dp-months">' + cells + '</div><div class="dp-foot"><button type="button" class="dp-link" data-clear>Clear</button><button type="button" class="dp-link" data-close>Close</button></div>';
        [].forEach.call(pop.querySelectorAll('.dp-nav'), function (b) { b.onclick = function () { y += +b.dataset.n; paint(); }; });
        [].forEach.call(pop.querySelectorAll('.dp-mo'), function (b) { b.onclick = function () { set(y, +b.dataset.m); closeAll(); btn.focus(); }; });
        pop.querySelector('[data-clear]').onclick = function () { set(0, 0); closeAll(); };
        pop.querySelector('[data-close]').onclick = function () { closeAll(); };
      }
      paint(); place(pop, inp);
      inp.setAttribute('aria-expanded', 'true');
      openPop = { root: pop, close: function () { pop.remove(); inp.setAttribute('aria-expanded', 'false'); }, focusBack: inp };
      pop.addEventListener('mousedown', function (e) { e.stopPropagation(); });
    }
    function toggle(e) { e.stopPropagation(); if (openPop && openPop.root.isConnected && openPop.focusBack === inp) closeAll(); else open(); }
    btn.addEventListener('click', toggle); inp.addEventListener('click', toggle);
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') { e.preventDefault(); open(); } });
    return { set: set, show: show };
  }

  w.DCIPDate = { date: date, month: month };
})(window);
