/* DCIP helper: floating chat for applicant questions.
 * 1. Buttons: topics → questions → answer → related questions (instant, from the FAQ sheet).
 * 2. Typing: keyword matching against the FAQ (instant).
 * 3. Only when nothing matches: the server asks Groq (the API key stays on the server). */
(function (w) {
  'use strict';

  /* ------------------------------ keyword matching (pure, testable) ------------------------------ */
  var STOP = {};
  'a an the is are am i me my we you your to of for in on at and or do does did can could should would will be it this that with about what how when where why who which please tell any there get have has had if so as by from am im ill ive need want like know'.split(' ').forEach(function (x) { STOP[x] = 1; });
  var SYN = { old: 'age', aged: 'age', yrs: 'age', birthday: 'age', dob: 'age', born: 'age', salary: 'stipend', paid: 'stipend', unpaid: 'stipend', remuneration: 'stipend', honorarium: 'stipend',
    closing: 'deadline', due: 'deadline', resume: 'cv', biodata: 'cv', mail: 'email', mails: 'email', gmail: 'email', register: 'apply', registration: 'apply', join: 'apply', enroll: 'apply', enrol: 'apply',
    graduate: 'degree', graduation: 'degree', btech: 'degree', ba: 'degree', bsc: 'degree', bcom: 'degree', pg: 'degree', postgraduate: 'degree', passed: 'complet', pass: 'complet', finish: 'complet', finished: 'complet',
    phone: 'contact', call: 'contact', whatsapp: 'contact', reach: 'contact', helpline: 'contact', callback: 'contact' };

  function stem(t) {
    if (t.length > 3) {
      if (/ies$/.test(t)) t = t.slice(0, -3) + 'y';
      else if (/(sses|xes|ches|shes)$/.test(t)) t = t.slice(0, -2);
      else if (/[^s]s$/.test(t)) t = t.slice(0, -1);
    }
    if (t.length > 6 && /(ing|ed)$/.test(t)) t = t.replace(/(ing|ed)$/, '');
    return t;
  }
  function tokens(s) {
    return String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean).map(function (t) { return SYN[t] || t; }).map(stem);
  }
  function prep(item) {
    if (item._p) return item._p;
    item._p = { qt: tokens(item.question).filter(function (t) { return !STOP[t]; }),
      kw: String(item.keywords || '').split(',').map(function (k) { return tokens(k).join(' '); }).filter(Boolean) };
    return item._p;
  }

  /** Returns FAQ items sorted by relevance: [{item, score}] (score 0 items dropped). */
  function match(faq, query) {
    var qt = tokens(query), q = ' ' + qt.join(' ') + ' ', content = qt.filter(function (t) { return !STOP[t]; });
    if (!content.length) return [];
    var out = [];
    faq.forEach(function (item) {
      var p = prep(item), score = 0;
      p.kw.forEach(function (k) {
        if (q.indexOf(' ' + k + ' ') >= 0) { var words = k.split(' ').length; score += words > 1 ? 3 + words : 2.5; }
      });
      var seen = {};
      p.qt.forEach(function (t) { if (!seen[t] && content.indexOf(t) >= 0) { seen[t] = 1; score += 1; } });
      if (score > 0) out.push({ item: item, score: score });
    });
    return out.sort(function (a, b) { return b.score - a.score; });
  }
  var THRESHOLD = 2.5;
  var GREET = /^\s*(hi+|hello+|hey+|hai|hii+|namaste|namaskaram|good\s*(morning|afternoon|evening)|yo)\b/i;
  var THANKS = /^\s*(thanks?|thank you|thx|ok(ay)?(\s+thanks?)?|got it|great|nice|cool|perfect)\W*$/i;

  var api = { match: match, tokens: tokens, THRESHOLD: THRESHOLD, GREET: GREET, THANKS: THANKS };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  w.DCIPChat = api;

  /* ------------------------------------------ widget ------------------------------------------ */
  var D = w.DCIP, esc = D.esc, $ = function (s, r) { return (r || document).querySelector(s); };
  var faq = [], byId = {}, topics = [], history = [], opened = false, busy = false, applyOpen = true;
  var session = Math.random().toString(36).slice(2, 10) + Date.now().toString(36), queue = [], flushTimer = null;
  /** Conversations are reported to the server so officials can see what applicants ask (shown to the applicant in the footer note). */
  function logMsg(r, t, s) { queue.push({ r: r, t: String(t || '').slice(0, 400), s: s }); clearTimeout(flushTimer); flushTimer = setTimeout(flush, 1500); }
  function flush() {
    clearTimeout(flushTimer); if (!queue.length) return;
    var batch = queue.splice(0, 12); D.call('chatLog', session, batch).catch(function () {});
    if (queue.length) flushTimer = setTimeout(flush, 500);
  }
  document.addEventListener('visibilitychange', function () { if (document.hidden) flush(); });

  function fmt(text) {
    var h = esc(text).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/(https?:\/\/[^\s<]+|www\.[^\s<]+)/g, function (u) { return '<a href="' + (u.indexOf('http') === 0 ? u : 'https://' + u) + '" target="_blank" rel="noopener">' + u + '</a>'; })
      .replace(/([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g, function (m, e, off, str) { return str.charAt(off - 1) === '>' || str.charAt(off - 1) === '/' ? m : '<a href="mailto:' + m + '">' + m + '</a>'; })
      .replace(/^- /gm, '• ').replace(/\n/g, '<br>');
    return h;
  }

  function build() {
    var logo = ($('.hero .logo') || {}).src || '';
    var root = document.createElement('div');
    root.innerHTML =
      '<button id="chatFab" class="chat-fab" type="button" aria-haspopup="dialog" aria-expanded="false"><span class="chat-fab-ic" aria-hidden="true">💬</span><span class="chat-fab-tx">Have a question?</span></button>' +
      '<section id="chatPanel" class="chat-panel" role="dialog" aria-label="DCIP helper" hidden>' +
        '<header class="chat-head">' + (logo ? '<img src="' + logo + '" alt="" class="chat-logo">' : '') + '<div><b>DCIP Helper</b><small>Ask about the internship</small></div>' +
        '<button type="button" class="chat-x" id="chatClose" aria-label="Close chat">✕</button></header>' +
        '<div class="chat-log" id="chatLog" role="log" aria-live="polite"></div>' +
        '<div class="chat-chips" id="chatChips"></div>' +
        '<form class="chat-form" id="chatForm" autocomplete="off"><input type="text" id="chatIn" maxlength="200" placeholder="Type your question…" aria-label="Type your question"><button type="submit" class="chat-send" aria-label="Send">➤</button></form>' +
        '<div class="chat-note">Chats are saved to improve our answers. Please don\'t share personal details.</div>' +
      '</section>';
    document.body.appendChild(root);
    $('#chatFab').onclick = toggle; $('#chatClose').onclick = toggle;
    $('#chatForm').onsubmit = function (e) { e.preventDefault(); var v = $('#chatIn').value.trim(); if (v && !busy) { $('#chatIn').value = ''; ask(v); } };
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && opened) toggle(); });
    setTimeout(function () { try { if (!opened && !sessionStorage.getItem('dcip_chat_nudge')) { $('#chatFab').classList.add('nudge'); sessionStorage.setItem('dcip_chat_nudge', '1'); } } catch (e) {} }, 7000);
  }

  function toggle() {
    opened = !opened;
    $('#chatPanel').hidden = !opened; $('#chatFab').classList.toggle('hidden', opened); $('#chatFab').classList.remove('nudge'); $('#chatFab').setAttribute('aria-expanded', opened);
    document.body.classList.toggle('chat-open', opened);
    if (opened) {
      if (!$('#chatLog').children.length) greet();
      if (w.matchMedia('(min-width: 700px)').matches) $('#chatIn').focus();
    } else { flush(); $('#chatFab').focus(); }
  }

  function scroll() { var l = $('#chatLog'); l.scrollTop = l.scrollHeight; }
  function say(who, html) {
    var d = document.createElement('div'); d.className = 'msg ' + who; d.innerHTML = html; $('#chatLog').appendChild(d); scroll(); return d;
  }
  function chips(list) {
    var box = $('#chatChips'); box.innerHTML = '';
    list.forEach(function (c) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'cchip' + (c.kind ? ' ' + c.kind : ''); b.textContent = c.label;
      b.onclick = function () { if (!busy) { if (c.say !== false) say('user', esc(c.label)); c.run(); } }; box.appendChild(b);
    });
    scroll();
  }

  function topicChips() {
    return topics.map(function (t) { return { label: t, run: function () { showTopic(t); } }; });
  }
  function menu(text) {
    say('bot', esc(text || 'What would you like to know?'));
    chips(topicChips());
  }
  function greet() {
    say('bot', 'Hi! 👋 I\'m the DCIP helper. Tap a topic below, or type your question.');
    chips(topicChips());
  }
  function showTopic(t) {
    var qs = faq.filter(function (f) { return f.topic === t; });
    say('bot', 'Popular questions about <b>' + esc(t) + '</b>:');
    chips(qs.map(function (f) { return { label: f.question, run: function () { showAnswer(f); } }; }).concat([{ label: '← All topics', kind: 'ghost', run: function () { menu(); } }]));
  }
  function related(item) {
    var ids = String(item.related || '').split(',').map(function (x) { return x.trim(); }).filter(function (x) { return byId[x] && x !== item.id; });
    faq.forEach(function (f) { if (ids.length < 3 && f.topic === item.topic && f.id !== item.id && ids.indexOf(f.id) < 0) ids.push(f.id); });
    return ids.slice(0, 3).map(function (id) { return byId[id]; });
  }
  function answer(text, extra) {
    var wantsApply = /\[\[apply\]\]/.test(text); text = text.replace(/\s*\[\[apply\]\]\s*/g, '');
    say('bot', fmt(text)); history.push({ r: 'b', t: text.slice(0, 400) });
    var list = (extra || []).slice();
    if (wantsApply && applyOpen) list.unshift({ label: 'Start application →', kind: 'go', say: false, run: function () { toggle(); var a = document.getElementById('apply'); if (a) a.scrollIntoView({ behavior: 'smooth' }); var f = document.getElementById('fullName'); if (f) setTimeout(function () { f.focus({ preventScroll: true }); }, 500); } });
    list.push({ label: '☰ Other topics', kind: 'ghost', run: function () { menu(); } });
    chips(list);
  }
  function showAnswer(item) {
    history.push({ r: 'u', t: item.question }); logMsg('u', item.question, 'button'); logMsg('b', 'FAQ: ' + item.question, 'faq:' + item.id);
    answer(item.answer, related(item).map(function (f) { return { label: f.question, run: function () { showAnswer(f); } }; }));
  }

  function ask(q) {
    say('user', esc(q)); history.push({ r: 'u', t: q.slice(0, 300) });
    var greeting = GREET.test(q) && q.split(/\s+/).length <= 4;
    if (!greeting && !THANKS.test(q)) logMsg('u', q, 'typed');
    if (GREET.test(q) && q.split(/\s+/).length <= 4) { menu('Hello! What would you like to know?'); return; }
    if (THANKS.test(q)) { say('bot', 'You\'re welcome! 😊 Good luck with your application.'); chips([{ label: '☰ Other topics', kind: 'ghost', run: function () { menu(); } }]); return; }
    var hits = match(faq, q);
    if (hits.length && hits[0].score >= THRESHOLD) {
      var best = hits[0].item, more = hits.slice(1, 3).filter(function (h) { return h.score >= 2; }).map(function (h) { return h.item; });
      var rel = related(best), extra = [];
      more.concat(rel).forEach(function (f) { if (f.id !== best.id && !extra.some(function (e) { return e.label === f.question; }) && extra.length < 3) extra.push({ label: f.question, run: function () { showAnswer(f); } }); });
      logMsg('b', 'FAQ: ' + best.question, 'faq:' + best.id); answer(best.answer, extra); return;
    }
    // no confident keyword match: ask the server (AI)
    busy = true; $('#chatChips').innerHTML = '';
    var typing = say('bot typing', '<span></span><span></span><span></span>');
    D.call('chatAsk', q, history.slice(-6, -1)).then(function (r) {
      typing.remove(); busy = false;
      var contact = faq.filter(function (f) { return /contact/i.test(f.topic); })[0];
      logMsg('b', r.answer, r.source === 'ai' ? 'ai' : 'none');
      answer(r.answer, (r.source === 'none' && contact ? [{ label: contact.question, run: function () { showAnswer(contact); } }] : []));
    }, function () {
      typing.remove(); busy = false; logMsg('b', 'Error: could not reach the helper', 'none');
      var contact = faq.filter(function (f) { return /contact/i.test(f.topic); })[0];
      say('bot', 'Sorry, I couldn\'t find that. Try one of the topics below' + (contact ? ' or contact the team.' : '.'));
      chips((contact ? [{ label: contact.question, run: function () { showAnswer(contact); } }] : []).concat(topicChips()));
    });
  }

  function init(config) {
    applyOpen = !config || config.open !== false;
    D.call('chatInit').then(function (d) {
      faq = d.faq || []; if (!faq.length) return;
      faq.forEach(function (f) { byId[f.id] = f; if (topics.indexOf(f.topic) < 0) topics.push(f.topic); });
      build();
    }, function () { /* backend unreachable: no chat */ });
  }
  w.DCIPChat.init = init;
})(typeof window !== 'undefined' ? window : this);
