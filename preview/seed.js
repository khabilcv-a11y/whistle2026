/* Demo data for the local preview: fake registrations + partly declared results. */
(function (global) {
  'use strict';
  var PIN = '1234';

  var EVENTS = {
    'UP KIDDIES': ['50M', '100M', 'SACK RACE', 'LEMON & SPOON', 'FROG JUMP', 'BALL THROW', 'STANDING BROAD JUMP', '4X50M RELAY'],
    'SUB-JUNIOR': ['100M', '200M', '400M', '600M', '80M HURDLES', 'LONG JUMP', 'HIGH JUMP', 'SHOT PUT', 'SOFTBALL THROW', 'STANDING BROAD JUMP', 'SKIPPING', '4X100M RELAY'],
    'JUNIOR': ['100M', '200M', '400M', '800M', '1500M', '100M HURDLES', 'LONG JUMP', 'TRIPLE JUMP', 'HIGH JUMP', 'SHOT PUT', 'DISCUS THROW', 'JAVELIN THROW', '4X100M RELAY', '4X400M RELAY'],
    'SENIOR': ['100M', '200M', '400M', '800M', '1500M', '3000M', '110M HURDLES', 'LONG JUMP', 'TRIPLE JUMP', 'HIGH JUMP', 'SHOT PUT', 'DISCUS THROW', 'JAVELIN THROW', '4X100M RELAY']
  };
  var CLASSES = { 'UP KIDDIES': ['5', '6'], 'SUB-JUNIOR': ['6', '7', '8'], 'JUNIOR': ['8', '9', '10'], 'SENIOR': ['11', '12'] };
  var BIRTH = { 'UP KIDDIES': [2015, 2016], 'SUB-JUNIOR': [2013, 2014], 'JUNIOR': [2011, 2012], 'SENIOR': [2008, 2009, 2010] };
  var HOUSES = ['Red', 'Blue', 'Green', 'Yellow'];
  var FIRST = ['Aarav', 'Aditi', 'Akhil', 'Ananya', 'Arjun', 'Devika', 'Gautham', 'Irfan', 'Jyothi', 'Karthik', 'Lakshmi', 'Meera', 'Nikhil', 'Nivedita', 'Pranav', 'Riya', 'Rohan', 'Sana', 'Sreya', 'Tanvi', 'Varun', 'Vishnu', 'Zara', 'Abhinav', 'Fathima', 'Hari', 'Joel', 'Keerthana', 'Neha', 'Sidharth'];
  var LAST = ['K', 'M', 'R', 'S', 'P', 'V', 'Nair', 'Menon', 'Joseph', 'Thomas', 'Pillai', 'Varghese', 'Das', 'Ali'];

  var seed = 26;
  function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
  function pick(a) { return a[Math.floor(rnd() * a.length)]; }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  function weightedHouses() {
    // Slight bias so the standings are not a four-way tie.
    var w = { RED: 1.35, BLUE: 1.2, GREEN: 1.0, YELLOW: 0.85 };
    return Object.keys(w).map(function (h) { return { h: h, k: Math.pow(rnd(), 1 / w[h]) }; })
      .sort(function (a, b) { return b.k - a.k; }).map(function (x) { return x.h; });
  }

  global.seedDemo = function () {
    seed = 26;
    MockGAS.resetStore();
    var store = MockGAS.store();
    store.props.ADMIN_PIN = PIN;

    var rows = [['Timestamp', 'Chest No', 'Entry ID', 'Name', 'Class', 'Division', 'Year of Birth', 'Section', 'House', 'Events', 'No. of Events']];
    var n = 0, t0 = Date.now() - 20 * 86400000;
    Object.keys(EVENTS).forEach(function (sec) {
      var count = { 'UP KIDDIES': 80, 'SUB-JUNIOR': 110, 'JUNIOR': 130, 'SENIOR': 100 }[sec];
      for (var i = 0; i < count; i++) {
        n++;
        var evs = shuffle(EVENTS[sec]).slice(0, 1 + Math.floor(rnd() * 3));
        rows.push([new Date(t0 + n * 3600000), 1000 + n, 'WH26-' + ('000' + n).slice(-4), pick(FIRST) + ' ' + pick(LAST),
          pick(CLASSES[sec]), pick(['A', 'B', 'C', 'D']), pick(BIRTH[sec]), sec, pick(HOUSES) + ' House', evs.join(', '), evs.length]);
      }
    });
    store.sheets.Registrations = rows;
    store.order.push('Registrations');

    setup();

    // Declare ~65% of events, spread over the last few hours.
    var all = [];
    Object.keys(EVENTS).forEach(function (sec) { EVENTS[sec].forEach(function (e) { all.push({ section: sec, event: e }); }); });
    var chosen = shuffle(all).slice(0, Math.round(all.length * 0.65));
    chosen.forEach(function (ev, i) {
      var order = weightedHouses();
      var entries = [
        { house: order[0], position: 1, points: 5 },
        { house: order[1], position: 2, points: 3 },
        { house: order[2], position: 3, points: 1 }
      ];
      if (i % 9 === 4) entries.push({ house: order[3], position: 3, points: 1 });   // tie for 3rd
      saveResult(PIN, { section: ev.section, event: ev.event, entries: entries, official: 'Demo Seeder' });
    });

    // Back-date the seeded results so "recent" has a realistic timeline.
    var sc = store.sheets.Scores, now = Date.now(), decl = {}, k = 0;
    for (var r = 1; r < sc.length; r++) { if (!(sc[r][1] in decl)) decl[sc[r][1]] = k++; }
    for (var q = 1; q < sc.length; q++) {
      var ts = new Date(now - (k - decl[sc[q][1]]) * 5 * 60000 - 20 * 60000);
      sc[q][2] = ts; sc[q][12] = ts;
    }
    store.cache = {};
    MockGAS.saveStore();
    console.log('[seed] demo data ready — admin PIN ' + PIN);
  };

  /** Declares a random undeclared event — used by the "simulate" button. */
  global.simulateResult = function () {
    MockGAS.loadStore();
    var dash = JSON.parse(getDashboardData());
    var open = [];
    dash.sections.forEach(function (s) { s.events.forEach(function (e) { if (!e.declared) open.push({ section: s.name, event: e.name }); }); });
    if (!open.length) return 'Every event is already declared.';
    var ev = open[Math.floor(Math.random() * open.length)];
    var order = weightedHouses();
    var res = saveResult(PIN, { section: ev.section, event: ev.event, official: 'Simulator',
      entries: [{ house: order[0], position: 1, points: 5 }, { house: order[1], position: 2, points: 3 }, { house: order[2], position: 3, points: 1 }] });
    MockGAS.saveStore();
    return res.message;
  };
})(window);
