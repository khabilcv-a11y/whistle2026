/* Language switch (English / മലയാളം) for the application page.
 * The Malayalam wording lives in lang-ml.js: one line per English phrase, easy to correct.
 * Texts on the page are swapped in place (nothing is reloaded), phrases built in code go through DCIPLang.t(). */
(function (w) {
  'use strict';
  var KEY = 'dcip_lang_v1', DICT = w.DCIP_ML || {}, lang = 'en', listeners = [], busy = false;
  var texts = [], htmls = [], attrs = [], ATTR = ['placeholder', 'aria-label', 'title', 'alt'];
  var EN_MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var ML_MON = ['ജനു', 'ഫെബ്രു', 'മാർ', 'ഏപ്രി', 'മേയ്', 'ജൂൺ', 'ജൂലൈ', 'ഓഗ', 'സെപ്റ്റം', 'ഒക്ടോ', 'നവം', 'ഡിസം'];
  try { var saved = localStorage.getItem(KEY); if (saved) lang = saved === 'ml' ? 'ml' : 'en'; else if (/^ml/i.test(navigator.language || '')) lang = 'ml'; } catch (e) {}

  function norm(s) { return String(s).replace(/\s+/g, ' ').trim(); }
  /* Entries written with {name} stand for any text in that place, e.g. "Hello {name} · applied on {date}". */
  var pats = null;
  function patterns() {
    if (pats) return pats; pats = [];
    Object.keys(DICT).forEach(function (k) {
      if (k.indexOf('{') < 0) return;
      var names = [], re = k.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{(\w+)\}/g, function (m, n) { names.push(n); return '(.+?)'; });
      pats.push({ re: new RegExp('^' + re + '$'), names: names, to: DICT[k] });
    });
    pats.sort(function (a, b) { return b.re.source.length - a.re.source.length; });
    return pats;
  }
  function months(v) { return String(v).replace(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/g, function (m) { return ML_MON[EN_MON.indexOf(m)]; }); }
  /** A piece of text inside a pattern: a phrase from the dictionary, or a date with its month in Malayalam. */
  function part(v) { var m = match(norm(v)); return m != null ? m : months(v); }
  function match(k) {
    if (DICT[k] != null) return DICT[k];
    if (k.length > 400 || !/[A-Za-z]/.test(k)) return null;
    var p = patterns();
    for (var i = 0; i < p.length; i++) {
      var m = p[i].re.exec(k); if (!m) continue;
      var vars = {}; p[i].names.forEach(function (n, j) { vars[n] = part(m[j + 1]); });
      return p[i].to.replace(/\{(\w+)\}/g, function (x, n) { return vars[n] != null ? vars[n] : x; });
    }
    return null;
  }
  /** Phrase in the current language. {name} placeholders are filled from vars. */
  function t(s, vars) {
    var out = lang === 'ml' ? match(norm(s)) : null; if (out == null) out = s;
    return vars ? String(out).replace(/\{(\w+)\}/g, function (m, k) { return vars[k] != null ? (lang === 'ml' ? months(vars[k]) : vars[k]) : m; }) : out;
  }
  var seen = null;          // collecting mode (used to build the dictionary)
  function look(key) { if (seen) { seen[key] = 1; return null; } return match(key); }

  function skip(el) { return /^(SCRIPT|STYLE|NOSCRIPT|SVG)$/i.test(el.tagName) || el.hasAttribute('data-noi18n') || (el.classList && el.classList.contains('sky')); }
  function inner(el) { return /^(TEXTAREA|SELECT)$/i.test(el.tagName); }   // their own attributes are translated, what is typed or chosen inside is left alone
  function tx(node) {
    if (node.nodeType === 3) {
      var k = norm(node.nodeValue), m = k && look(k);
      if (m != null) { var raw = node.nodeValue; texts.push([node, raw]); node.nodeValue = raw.match(/^\s*/)[0] + m + raw.match(/\s*$/)[0]; }
      return;
    }
    if (node.nodeType !== 1 || skip(node)) return;
    ATTR.forEach(function (a) {
      if (!node.hasAttribute(a)) return; var v = node.getAttribute(a), m = look(norm(v));
      if (m != null) { attrs.push([node, a, v]); node.setAttribute(a, m); }
    });
    if (inner(node)) return;
    if (node.children.length && node.textContent.length < 1200) {
      var hk = norm(node.innerHTML), hm = hk.length < 1500 ? look(hk) : null;
      if (hm != null) { htmls.push([node, node.innerHTML]); node.innerHTML = hm; return; }
    }
    for (var c = node.firstChild; c; c = c.nextSibling) tx(c);
  }
  function run(root) { busy = true; try { tx(root || document.body); } finally { busy = false; } }
  function restore() {
    busy = true;
    try {
      htmls.forEach(function (r) { if (r[0].isConnected) r[0].innerHTML = r[1]; });
      texts.forEach(function (r) { if (r[0].isConnected) r[0].nodeValue = r[1]; });
      attrs.forEach(function (r) { if (r[0].isConnected) r[0].setAttribute(r[1], r[2]); });
    } finally { busy = false; }
    texts = []; htmls = []; attrs = [];
  }
  var mo = new MutationObserver(function (list) {
    if (busy || lang !== 'ml') return;
    busy = true;
    try { list.forEach(function (m) { [].forEach.call(m.addedNodes, function (n) { if (n.isConnected) tx(n); }); }); } finally { busy = false; }
  });
  function font() {
    if (document.getElementById('mlFont')) return;
    var l = document.createElement('link'); l.id = 'mlFont'; l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+Malayalam:wght@400;500;600;700;800&display=swap'; document.head.appendChild(l);
  }
  function set(l, quiet) {
    l = l === 'ml' ? 'ml' : 'en';
    if (l === lang && quiet !== 'init') return;
    if (lang === 'ml') restore();
    lang = l; document.documentElement.lang = l === 'ml' ? 'ml' : 'en';
    try { if (quiet !== 'init') localStorage.setItem(KEY, l); } catch (e) {}
    if (w.DCIP && w.DCIP.setMonths) w.DCIP.setMonths(l === 'ml' ? ML_MON : EN_MON);
    if (l === 'ml') { font(); run(document.body); }
    var b = document.getElementById('langBtn'); if (b) { b.textContent = l === 'ml' ? 'English' : 'മലയാളം'; b.setAttribute('aria-label', l === 'ml' ? 'Switch to English' : 'മലയാളത്തിലേക്ക് മാറ്റുക'); b.lang = l === 'ml' ? 'en' : 'ml'; }
    listeners.forEach(function (f) { try { f(l); } catch (e) {} });
  }
  function init() {
    mo.observe(document.body, { childList: true, subtree: true });
    var b = document.getElementById('langBtn'); if (b) b.onclick = function () { set(lang === 'ml' ? 'en' : 'ml'); };
    set(lang, 'init');
  }
  w.DCIPLang = { t: t, set: set, get: function () { return lang; }, onChange: function (f) { listeners.push(f); }, run: run,
    collect: function (root) { seen = {}; var d = DICT; DICT = {}; try { run(root || document.body); } finally { DICT = d; } var r = Object.keys(seen); seen = null; return r; } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(window);
