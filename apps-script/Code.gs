/**
 * WHISTLE 2026 – Digital Scoring, Championship & Live Information System
 * =======================================================================
 * Google Apps Script backend.
 *
 * Recommended: a standalone Apps Script project with Script Property
 * SPREADSHEET_ID = the WHISTLE registration spreadsheet's ID (keeps the
 * registration system's own script untouched). A script bound to the sheet
 * also works if the sheet has no other script. See README.md.
 *
 *   Registrations   ← existing registration system — READ ONLY here
 *   Score_Events    ← normalised event catalogue (Section + Event)
 *   Scores          ← one row per awarded position (never cumulative totals)
 *   Score_Audit     ← every create / update / delete / restore / sheet edit
 *
 * Deployed as a web app it is a JSON API only (see doGet / doPost). The
 * dashboard and admin pages live in web/ and are hosted on Cloudflare Pages.
 *
 * NOTE: top-level declarations use `var` on purpose so the local preview
 * harness (preview/) can load this file unchanged.
 */

var CONFIG = {
  EVENT_TITLE: 'WHISTLE 2026',
  EVENT_SUBTITLE: 'ANNUAL SPORTS MEET',

  // Leave blank when the script is bound to the registration spreadsheet.
  // Can also be supplied as Script Property SPREADSHEET_ID.
  SPREADSHEET_ID: '',

  SHEETS: {
    REG: 'Registrations',
    EVENTS: 'Score_Events',
    SCORES: 'Scores',
    AUDIT: 'Score_Audit'
  },

  // Points for 1st, 2nd, 3rd … (extra positions default to 0, editable in the portal)
  DEFAULT_POINTS: [5, 3, 1],

  // Display order. Houses/sections not listed are appended alphabetically.
  HOUSE_ORDER: ['RED', 'BLUE', 'GREEN', 'YELLOW'],
  SECTION_ORDER: ['KIDDIES', 'LP KIDDIES', 'UP KIDDIES', 'SUB JUNIOR', 'JUNIOR', 'SENIOR', 'SUPER SENIOR', 'OPEN'],

  // Optional explicit colours, e.g. { 'TAGORE': '#E53935' }
  HOUSE_COLOR_OVERRIDES: {},

  CACHE_SECONDS: 15,     // dashboard payload cache (cleared on every write)
  RECENT_LIMIT: 15,      // recent results shown on the dashboard
  AUDIT_LIMIT: 500       // audit rows returned to the portal
};

var HEADERS = {
  EVENTS: ['Event Key', 'Section', 'Event', 'Order', 'Status', 'Source', 'Created At'],
  SCORES: ['Result ID', 'Declaration ID', 'Timestamp', 'Section', 'Event', 'Event Key', 'House',
           'Position', 'Points', 'Status', 'Remarks', 'Entered By', 'Updated At', 'Updated By'],
  AUDIT: ['Timestamp', 'Action', 'Result ID', 'Declaration ID', 'Previous Value', 'New Value', 'User', 'Source']
};

var STATUS = { ACTIVE: 'ACTIVE', DELETED: 'DELETED', HIDDEN: 'HIDDEN' };
var DASH_CACHE_KEY = 'whistle_dashboard_v1';

var HOUSE_COLORS = [
  ['RED', '#E53935'], ['BLUE', '#1E6FE0'], ['GREEN', '#2E9E4F'], ['YELLOW', '#F7C600'],
  ['ORANGE', '#F57C00'], ['SAFFRON', '#FF9933'], ['PURPLE', '#7E3FBF'], ['VIOLET', '#7B4BD6'],
  ['PINK', '#E0457B'], ['MAROON', '#8E1B2B'], ['INDIGO', '#3949AB'], ['WHITE', '#E8ECEF'],
  ['BLACK', '#37474F'], ['GOLD', '#D4A017'], ['SILVER', '#9EA7B0'], ['BROWN', '#795548'],
  ['AQUA', '#00ACC1'], ['CYAN', '#00ACC1']
];
var FALLBACK_COLORS = ['#E53935', '#1E6FE0', '#2E9E4F', '#F7C600', '#7E3FBF', '#F57C00', '#00ACC1', '#E0457B'];


/* =========================================================================
 *  JSON API (the web pages are hosted separately, e.g. Cloudflare Pages)
 *
 *   GET  <exec-url>?api=dashboard            → dashboard payload (public)
 *   POST <exec-url>  body {fn, args:[...]}   → admin functions (PIN is args[0])
 *
 * POST bodies are sent as text/plain so browsers skip the CORS preflight.
 * ========================================================================= */

var API_FUNCTIONS = {
  getDashboardData: getDashboardData,
  getAdminBootstrap: getAdminBootstrap,
  getAdminState: getAdminState,
  saveResult: saveResult,
  updateResult: updateResult,
  setResultStatus: setResultStatus,
  getAudit: getAudit,
  syncEvents: syncEvents,
  addEvent: addEvent,
  setEventStatus: setEventStatus
};

function doGet(e) {
  var p = (e && e.parameter) || {};
  try {
    if (p.api === 'dashboard') {
      return ContentService.createTextOutput(getDashboardData()).setMimeType(ContentService.MimeType.JSON);
    }
    return json_({ ok: true, service: CONFIG.EVENT_TITLE + ' API' });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var fn = API_FUNCTIONS.hasOwnProperty(body.fn) ? API_FUNCTIONS[body.fn] : null;
    if (!fn) throw new Error('Unknown API function: ' + body.fn);
    return json_({ ok: true, result: fn.apply(null, Array.isArray(body.args) ? body.args : []) });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}


/* =========================================================================
 *  One-time setup (run from the Apps Script editor)
 * ========================================================================= */

/** Creates the score tabs, generates an admin PIN and builds the event catalogue. */
function setup() {
  var ss = ss_();
  ensureSheet_(ss, CONFIG.SHEETS.EVENTS, HEADERS.EVENTS);
  ensureSheet_(ss, CONFIG.SHEETS.SCORES, HEADERS.SCORES);
  ensureSheet_(ss, CONFIG.SHEETS.AUDIT, HEADERS.AUDIT);

  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('ADMIN_PIN')) {
    var pin = String(Math.floor(100000 + Math.random() * 900000));
    props.setProperty('ADMIN_PIN', pin);
    Logger.log('Admin PIN generated: ' + pin + '   (change it under Project Settings → Script Properties → ADMIN_PIN)');
  } else {
    Logger.log('Admin PIN already set (Project Settings → Script Properties → ADMIN_PIN).');
  }

  var r = withLock_(syncEvents_);
  invalidate_();
  Logger.log('Setup complete. Event catalogue: ' + r.total + ' events (' + r.added + ' new).');
  return r;
}

/** Generates a fresh random admin PIN and prints it to the execution log. */
function resetAdminPin() {
  var pin = String(Math.floor(100000 + Math.random() * 900000));
  PropertiesService.getScriptProperties().setProperty('ADMIN_PIN', pin);
  Logger.log('New admin PIN: ' + pin);
}

/** Editor helper: prints the dashboard payload so you can inspect calculations. */
function debugDashboard() {
  Logger.log(JSON.stringify(buildDashboard_(), null, 2));
}


/* =========================================================================
 *  PUBLIC DASHBOARD API (no PIN — read only)
 * ========================================================================= */

/** Returns the dashboard payload as a JSON string (cached for a few seconds). */
function getDashboardData() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get(DASH_CACHE_KEY);
  if (hit) return hit;
  var json = JSON.stringify(buildDashboard_());
  try { cache.put(DASH_CACHE_KEY, json, CONFIG.CACHE_SECONDS); } catch (e) { /* >100KB – skip cache */ }
  return json;
}


/* =========================================================================
 *  ADMIN API (every call requires the PIN)
 * ========================================================================= */

function getAdminBootstrap(pin) {
  auth_(pin);
  var ss = ss_();
  ensureSheet_(ss, CONFIG.SHEETS.EVENTS, HEADERS.EVENTS);
  ensureSheet_(ss, CONFIG.SHEETS.SCORES, HEADERS.SCORES);
  ensureSheet_(ss, CONFIG.SHEETS.AUDIT, HEADERS.AUDIT);
  var sync = withLock_(syncEvents_);
  if (sync.added) invalidate_();
  var state = adminSnapshot_();
  state.user = activeEmail_();
  state.synced = sync;
  return state;
}

function getAdminState(pin) {
  auth_(pin);
  return adminSnapshot_();
}

/**
 * payload = {
 *   section, event,
 *   entries: [{ house, position, points }],
 *   remarks, official,
 *   mode: '' | 'append' | 'replace'   // only needed when the event already has a result
 * }
 */
function saveResult(pin, payload) {
  auth_(pin);
  payload = payload || {};
  return withLock_(function () {
    var cat = readCatalogue_();
    var key = eventKey_(payload.section, payload.event);
    var ev = findBy_(cat, 'key', key);
    var section = ev ? ev.section : clean_(payload.section);
    var event = ev ? ev.event : clean_(payload.event);
    if (!section || !event) throw new Error('Select a section and an event first.');

    var scores = readScores_();
    var houseSet = houseSet_(houseList_(readRegistrations_(), scores));
    var entries = validateEntries_(payload.entries, houseSet);
    var remarks = clean_(payload.remarks);

    var existing = scores.filter(function (s) { return s.key === key && s.status === STATUS.ACTIVE; });
    var mode = String(payload.mode || '');
    if (existing.length && mode !== 'append' && mode !== 'replace') {
      return { status: 'EXISTS', existing: existing.map(publicResult_) };
    }

    var user = actor_(payload.official);
    var now = new Date();
    var sh = sheet_(CONFIG.SHEETS.SCORES, HEADERS.SCORES);
    var logs = [];

    if (existing.length && mode === 'replace') {
      var cols = colMap_(sh);
      existing.forEach(function (s) {
        setCells_(sh, cols, s._row, { 'Status': STATUS.DELETED, 'Updated At': now, 'Updated By': user });
        var after = shallow_(s); after.status = STATUS.DELETED;
        logs.push({ action: 'DELETE', id: s.id, decl: s.decl, prev: describe_(s), next: describe_(after) + ' | replaced by new declaration' });
      });
    }

    var rSeq = maxSeq_(scores, 'id', 'R');
    var dSeq = maxSeq_(scores, 'decl', 'D');
    var declId = fmtId_('D', dSeq + 1);
    var rows = entries.map(function (e) {
      rSeq += 1;
      var id = fmtId_('R', rSeq);
      var rec = { id: id, decl: declId, section: section, event: event, house: e.house, position: e.position, points: e.points, status: STATUS.ACTIVE };
      logs.push({ action: 'CREATE', id: id, decl: declId, prev: '', next: describe_(rec) });
      return [id, declId, now, section, event, key, e.house, e.position, e.points, STATUS.ACTIVE, remarks, user, now, user];
    });
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, HEADERS.SCORES.length).setValues(rows);

    audit_(logs, user);
    invalidate_();
    return {
      status: 'SAVED',
      declarationId: declId,
      message: section + ' › ' + event + ': ' + rows.length + ' position(s) saved' + (mode === 'replace' ? ' (previous result replaced)' : ''),
      state: adminSnapshot_()
    };
  });
}

/** changes = { house?, position?, points?, remarks? } */
function updateResult(pin, resultId, changes, official) {
  auth_(pin);
  changes = changes || {};
  return withLock_(function () {
    var scores = readScores_();
    var s = findBy_(scores, 'id', clean_(resultId));
    if (!s) throw new Error('Result ' + resultId + ' not found.');
    if (s.status !== STATUS.ACTIVE) throw new Error('Result ' + s.id + ' is deleted. Restore it before editing.');

    var houseSet = houseSet_(houseList_(readRegistrations_(), scores));
    var next = validateEntries_([{
      house: changes.house != null ? changes.house : s.house,
      position: changes.position != null ? changes.position : s.position,
      points: changes.points != null ? changes.points : s.points
    }], houseSet)[0];
    var remarks = changes.remarks != null ? clean_(changes.remarks) : s.remarks;

    if (next.house === s.house && next.position === s.position && next.points === s.points && remarks === s.remarks) {
      return { ok: true, message: 'No changes to save.', state: adminSnapshot_() };
    }

    var user = actor_(official);
    var now = new Date();
    var sh = sheet_(CONFIG.SHEETS.SCORES, HEADERS.SCORES);
    setCells_(sh, colMap_(sh), s._row, {
      'House': next.house, 'Position': next.position, 'Points': next.points,
      'Remarks': remarks, 'Updated At': now, 'Updated By': user
    });
    var after = shallow_(s);
    after.house = next.house; after.position = next.position; after.points = next.points; after.remarks = remarks;
    audit_([{ action: 'UPDATE', id: s.id, decl: s.decl, prev: describe_(s), next: describe_(after) }], user);
    invalidate_();
    return { ok: true, message: 'Result ' + s.id + ' updated.', state: adminSnapshot_() };
  });
}

/** status = 'DELETED' (soft delete) or 'ACTIVE' (restore). */
function setResultStatus(pin, resultIds, status, reason, official) {
  auth_(pin);
  status = key_(status);
  if (status !== STATUS.ACTIVE && status !== STATUS.DELETED) throw new Error('Invalid status.');
  var ids = [].concat(resultIds || []).map(clean_).filter(Boolean);
  if (!ids.length) throw new Error('No results selected.');
  return withLock_(function () {
    var scores = readScores_();
    var user = actor_(official);
    var now = new Date();
    var sh = sheet_(CONFIG.SHEETS.SCORES, HEADERS.SCORES);
    var cols = colMap_(sh);
    var logs = [];
    ids.forEach(function (id) {
      var s = findBy_(scores, 'id', id);
      if (!s) throw new Error('Result ' + id + ' not found.');
      if (s.status === status) return;
      setCells_(sh, cols, s._row, { 'Status': status, 'Updated At': now, 'Updated By': user });
      var after = shallow_(s); after.status = status;
      logs.push({
        action: status === STATUS.DELETED ? 'DELETE' : 'RESTORE',
        id: s.id, decl: s.decl, prev: describe_(s),
        next: describe_(after) + (clean_(reason) ? ' | reason: ' + clean_(reason) : '')
      });
    });
    audit_(logs, user);
    invalidate_();
    var verb = status === STATUS.DELETED ? 'deleted' : 'restored';
    return { ok: true, message: logs.length + ' result(s) ' + verb + '.', state: adminSnapshot_() };
  });
}

function getAudit(pin, limit) {
  auth_(pin);
  limit = Math.min(Number(limit) || CONFIG.AUDIT_LIMIT, 5000);
  var rows = readObjects_(ss_().getSheetByName(CONFIG.SHEETS.AUDIT));
  return rows.slice(-limit).reverse().map(function (r) {
    return {
      ts: toMs_(r['Timestamp']), action: clean_(r['Action']), id: clean_(r['Result ID']),
      decl: clean_(r['Declaration ID']), prev: clean_(r['Previous Value']), next: clean_(r['New Value']),
      user: clean_(r['User']), source: clean_(r['Source'])
    };
  });
}

function syncEvents(pin, official) {
  auth_(pin);
  return withLock_(function () {
    var r = syncEvents_();
    if (r.added) {
      audit_([{ action: 'EVENT_SYNC', next: r.added + ' event(s) added from Registrations' }], actor_(official));
      invalidate_();
    }
    return { ok: true, message: r.added ? r.added + ' new event(s) added from registrations.' : 'Event catalogue is already up to date.', state: adminSnapshot_() };
  });
}

function addEvent(pin, section, event, official) {
  auth_(pin);
  section = clean_(section); event = clean_(event);
  if (!section || !event) throw new Error('Section and event name are required.');
  return withLock_(function () {
    var sh = sheet_(CONFIG.SHEETS.EVENTS, HEADERS.EVENTS);
    var cat = readCatalogue_();
    var key = eventKey_(section, event);
    var user = actor_(official);
    var found = findBy_(cat, 'key', key);
    if (found) {
      if (found.status === STATUS.ACTIVE) throw new Error(found.section + ' › ' + found.event + ' already exists.');
      setCells_(sh, colMap_(sh), found._row, { 'Status': STATUS.ACTIVE });
      audit_([{ action: 'EVENT_SHOW', prev: found.section + ' › ' + found.event + ' | HIDDEN', next: 'ACTIVE' }], user);
    } else {
      // Reuse the canonical spelling of an existing section if the key matches.
      var sec = findBy_(cat.map(function (c) { return { k: key_(c.section), name: c.section }; }), 'k', key_(section));
      if (sec) section = sec.name;
      var maxOrder = cat.reduce(function (m, c) { return c.order < 9999 ? Math.max(m, c.order) : m; }, 0);
      sh.appendRow([key, section, event, maxOrder + 1, STATUS.ACTIVE, 'MANUAL', new Date()]);
      audit_([{ action: 'EVENT_ADD', next: section + ' › ' + event }], user);
    }
    invalidate_();
    return { ok: true, message: section + ' › ' + event + ' is now active.', state: adminSnapshot_() };
  });
}

function setEventStatus(pin, eventKey, status, official) {
  auth_(pin);
  status = key_(status);
  if (status !== STATUS.ACTIVE && status !== STATUS.HIDDEN) throw new Error('Invalid status.');
  return withLock_(function () {
    var sh = sheet_(CONFIG.SHEETS.EVENTS, HEADERS.EVENTS);
    var ev = findBy_(readCatalogue_(), 'key', clean_(eventKey));
    if (!ev) throw new Error('Event not found.');
    if (ev.status !== status) {
      setCells_(sh, colMap_(sh), ev._row, { 'Status': status });
      audit_([{ action: status === STATUS.HIDDEN ? 'EVENT_HIDE' : 'EVENT_SHOW', prev: ev.section + ' › ' + ev.event + ' | ' + ev.status, next: status }], actor_(official));
      invalidate_();
    }
    return { ok: true, message: ev.section + ' › ' + ev.event + (status === STATUS.HIDDEN ? ' hidden.' : ' shown.'), state: adminSnapshot_() };
  });
}


/* =========================================================================
 *  Audit manual edits made directly in the score tabs
 *  - Bound script: the simple onEdit trigger below handles it automatically.
 *  - Standalone script (SPREADSHEET_ID): run installSheetEditAudit() once.
 * ========================================================================= */

function onEdit(e) {
  try {
    if (CONFIG.SPREADSHEET_ID || PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID')) return;
  } catch (x) { /* ignore */ }
  auditSheetEdit(e);
}

/** Standalone projects only: installs an edit trigger on the WHISTLE spreadsheet. */
function installSheetEditAudit() {
  var ss = ss_();
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'auditSheetEdit') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('auditSheetEdit').forSpreadsheet(ss).onEdit().create();
  Logger.log('Sheet-edit audit trigger installed for ' + ss.getName());
}

function auditSheetEdit(e) {
  try {
    if (!e || !e.range) return;
    var sheet = e.range.getSheet();
    var name = sheet.getName();
    if (name !== CONFIG.SHEETS.SCORES && name !== CONFIG.SHEETS.EVENTS) return;
    var single = e.range.getNumRows() === 1 && e.range.getNumColumns() === 1;
    var resultId = '';
    if (name === CONFIG.SHEETS.SCORES && e.range.getRow() > 1) {
      resultId = String(sheet.getRange(e.range.getRow(), 1).getValue() || '');
    }
    var user = '';
    try { user = e.user ? e.user.getEmail() : ''; } catch (x) { /* ignore */ }
    var audit = e.source.getSheetByName(CONFIG.SHEETS.AUDIT);
    if (audit) {
      audit.appendRow([new Date(), 'SHEET_EDIT', resultId, '',
        single ? (e.oldValue === undefined ? '' : String(e.oldValue)) : '(multi-cell edit)',
        single ? (e.value === undefined ? '' : String(e.value)) : '',
        user || 'Sheet editor', name + '!' + e.range.getA1Notation()]);
    }
    CacheService.getScriptCache().remove(DASH_CACHE_KEY);
  } catch (err) { /* never block the editor */ }
}


/* =========================================================================
 *  Dashboard aggregation — everything is derived from `Scores`
 * ========================================================================= */

function buildDashboard_() {
  var regs = readRegistrations_();
  var active = readScores_().filter(function (s) { return s.status === STATUS.ACTIVE; });
  var houses = houseList_(regs, active);
  var houseNames = houses.map(function (h) { return h.name; });
  var zero = function () { var o = {}; houseNames.forEach(function (n) { o[n] = 0; }); return o; };

  // ---- event catalogue (falls back to registrations if Score_Events is empty)
  var cat = readCatalogue_();
  if (!cat.length) cat = catalogueFromRegs_(regs);
  var catByKey = {};
  cat.forEach(function (c) { catByKey[c.key] = c; });

  var evByKey = {}, evList = [];
  function addEv(c) {
    var e = { key: c.key, section: c.section, event: c.event, order: c.order, points: zero(), positions: {}, declared: false, lastTs: 0, entries: [] };
    evByKey[c.key] = e; evList.push(e);
    return e;
  }
  cat.forEach(function (c) { if (c.status === STATUS.ACTIVE) addEv(c); });

  // ---- house statistics
  var stats = {};
  houseNames.forEach(function (h) { stats[h] = { points: 0, first: 0, second: 0, third: 0, other: 0, scored: {} }; });

  active.forEach(function (s) {
    var e = evByKey[s.key] || addEv(catByKey[s.key] || { key: s.key, section: s.section, event: s.event, order: 99999 });
    e.declared = true;
    e.lastTs = Math.max(e.lastTs, s.ts);
    e.points[s.house] = (e.points[s.house] || 0) + s.points;
    (e.positions[s.house] = e.positions[s.house] || []).push(s.position);
    e.entries.push({ house: s.house, position: s.position, points: s.points });

    var st = stats[s.house];
    st.points += s.points;
    if (s.position === 1) st.first++;
    else if (s.position === 2) st.second++;
    else if (s.position === 3) st.third++;
    else st.other++;
    if (s.points > 0) st.scored[s.key] = true;
  });

  // ---- sections
  var secMap = {}, sections = [];
  evList.forEach(function (e) {
    var k = key_(e.section);
    if (!secMap[k]) { secMap[k] = { name: e.section, events: [], totals: zero() }; sections.push(secMap[k]); }
    secMap[k].events.push(e);
  });
  sections.sort(function (a, b) { return compareSections_(a.name, b.name); });
  sections.forEach(function (sec) {
    sec.events.sort(function (a, b) { return (a.order - b.order) || naturalCompare_(a.event, b.event); });
    sec.events.forEach(function (e) {
      houseNames.forEach(function (h) { sec.totals[h] += e.points[h] || 0; });
    });
  });

  // ---- standings (ties share a rank)
  var standings = houses.map(function (h, i) {
    var st = stats[h.name];
    return {
      house: h.name, points: r2_(st.points), first: st.first, second: st.second, third: st.third,
      other: st.other, eventsScored: Object.keys(st.scored).length, _i: i
    };
  });
  standings.sort(function (a, b) {
    return (b.points - a.points) || (b.first - a.first) || (b.second - a.second) || (b.third - a.third) || (a._i - b._i);
  });
  var leaderPts = standings.length ? standings[0].points : 0;
  standings.forEach(function (s, i) {
    s.rank = (i > 0 && s.points === standings[i - 1].points) ? standings[i - 1].rank : i + 1;
    s.gapToLeader = r2_(leaderPts - s.points);
    s.gapToNext = i === 0 ? 0 : r2_(standings[i - 1].points - s.points);
    delete s._i;
  });

  // ---- latest / recent (grouped per event, newest first)
  var declared = evList.filter(function (e) { return e.declared; });
  var recent = declared.slice().sort(function (a, b) { return b.lastTs - a.lastTs; })
    .slice(0, CONFIG.RECENT_LIMIT)
    .map(function (e) {
      return {
        sig: e.key + '@' + e.lastTs, ts: e.lastTs, section: e.section, event: e.event,
        entries: e.entries.slice().sort(function (a, b) { return (a.position - b.position) || (b.points - a.points); })
      };
    });

  // ---- progress
  var totalEvents = evList.length;
  var declaredCount = declared.length;
  var pointsPerEvent = CONFIG.DEFAULT_POINTS.reduce(function (a, b) { return a + b; }, 0);
  var awarded = r2_(standings.reduce(function (a, s) { return a + s.points; }, 0));

  var sectionOut = sections.map(function (sec) {
    var dec = sec.events.filter(function (e) { return e.declared; }).length;
    var totals = {};
    houseNames.forEach(function (h) { totals[h] = r2_(sec.totals[h]); });
    return {
      name: sec.name, total: sec.events.length, declared: dec, totals: totals,
      events: sec.events.map(function (e) {
        var pts = {};
        houseNames.forEach(function (h) { if (e.points[h]) pts[h] = r2_(e.points[h]); });
        return { name: e.event, declared: e.declared, points: pts, positions: e.positions };
      })
    };
  });

  return {
    meta: {
      title: CONFIG.EVENT_TITLE, subtitle: CONFIG.EVENT_SUBTITLE,
      generatedAt: Date.now(), pointsScheme: CONFIG.DEFAULT_POINTS
    },
    houses: houses,
    standings: standings,
    sections: sectionOut,
    latest: recent[0] || null,
    recent: recent,
    progress: { total: totalEvents, declared: declaredCount, remaining: totalEvents - declaredCount },
    race: {
      awarded: awarded,
      pointsPerEvent: pointsPerEvent,
      remainingEvents: totalEvents - declaredCount,
      pointsRemaining: (totalEvents - declaredCount) * pointsPerEvent,
      lead: standings.length > 1 ? r2_(standings[0].points - standings[1].points) : 0
    },
    participation: participation_(regs, houseNames)
  };
}

function participation_(regs, houseNames) {
  var byHouse = {}, bySection = {}, byClass = {}, byEvent = {};
  houseNames.forEach(function (h) { byHouse[h] = { athletes: 0, entries: 0 }; });
  var entries = 0;
  regs.forEach(function (r) {
    entries += r.events.length;
    if (r.house) {
      var h = byHouse[r.house] = byHouse[r.house] || { athletes: 0, entries: 0 };
      h.athletes++; h.entries += r.events.length;
    }
    if (r.section) {
      var sk = key_(r.section);
      var s = bySection[sk] = bySection[sk] || { name: r.section, athletes: 0, entries: 0 };
      s.athletes++; s.entries += r.events.length;
    }
    if (r.cls) byClass[r.cls] = (byClass[r.cls] || 0) + 1;
    r.events.forEach(function (ev) {
      var k = eventKey_(r.section, ev);
      var e = byEvent[k] = byEvent[k] || { section: r.section, event: ev, count: 0 };
      e.count++;
    });
  });
  var sections = Object.keys(bySection).map(function (k) { return bySection[k]; })
    .sort(function (a, b) { return compareSections_(a.name, b.name); });
  var classes = Object.keys(byClass).sort(naturalCompare_).map(function (c) { return { name: c, athletes: byClass[c] }; });
  var events = Object.keys(byEvent).map(function (k) { return byEvent[k]; });
  var top = events.slice().sort(function (a, b) { return b.count - a.count; }).slice(0, 8);
  return {
    athletes: regs.length,
    entries: entries,
    eventsOffered: events.length,
    avgEvents: regs.length ? r2_(entries / regs.length) : 0,
    byHouse: Object.keys(byHouse).map(function (h) { return { house: h, athletes: byHouse[h].athletes, entries: byHouse[h].entries }; }),
    bySection: sections,
    byClass: classes,
    topEvents: top
  };
}


/* =========================================================================
 *  Admin snapshot
 * ========================================================================= */

function adminSnapshot_() {
  var regs = readRegistrations_();
  var scores = readScores_();
  var houses = houseList_(regs, scores.filter(function (s) { return s.status === STATUS.ACTIVE; }));
  var cat = readCatalogue_();

  var activeCount = {};
  scores.forEach(function (s) { if (s.status === STATUS.ACTIVE) activeCount[s.key] = (activeCount[s.key] || 0) + 1; });
  var regCount = {};
  regs.forEach(function (r) { r.events.forEach(function (ev) { var k = eventKey_(r.section, ev); regCount[k] = (regCount[k] || 0) + 1; }); });

  var secMap = {}, sections = [];
  cat.forEach(function (c) {
    var k = key_(c.section);
    if (!secMap[k]) { secMap[k] = { name: c.section, events: [] }; sections.push(secMap[k]); }
    secMap[k].events.push(c);
  });
  sections.sort(function (a, b) { return compareSections_(a.name, b.name); });

  return {
    title: CONFIG.EVENT_TITLE,
    defaultPoints: CONFIG.DEFAULT_POINTS,
    houses: houses,
    sections: sections.map(function (sec) {
      return {
        name: sec.name,
        events: sec.events
          .sort(function (a, b) { return (a.order - b.order) || naturalCompare_(a.event, b.event); })
          .map(function (c) {
            return { key: c.key, section: c.section, name: c.event, status: c.status, source: c.source, results: activeCount[c.key] || 0, registrations: regCount[c.key] || 0 };
          })
      };
    }),
    results: scores.map(publicResult_).sort(function (a, b) { return (b.ts - a.ts) || (b.id < a.id ? -1 : 1); }),
    registrations: regs.length,
    serverTime: Date.now()
  };
}


/* =========================================================================
 *  Sheet access
 * ========================================================================= */

function ss_() {
  var id = CONFIG.SPREADSHEET_ID || PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  var ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Spreadsheet not found. Bind the script to the WHISTLE sheet or set SPREADSHEET_ID.');
  return ss;
}

function ensureSheet_(ss, name, headers) {
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  var first = sh.getRange(1, 1, 1, headers.length).getValues()[0];
  var empty = first.every(function (v) { return v === '' || v === null; });
  if (empty) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers])
      .setFontWeight('bold').setBackground('#111827').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  }
  return sh;
}

function sheet_(name, headers) {
  var ss = ss_();
  return ss.getSheetByName(name) || ensureSheet_(ss, name, headers);
}

/** Reads a sheet into objects keyed by header text. Adds `_row` (1-based). */
function readObjects_(sh) {
  if (!sh) return [];
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0].map(clean_);
  var out = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i], o = { _row: i + 1 }, blank = true;
    for (var j = 0; j < headers.length; j++) {
      if (!headers[j]) continue;
      o[headers[j]] = row[j];
      if (row[j] !== '' && row[j] !== null) blank = false;
    }
    if (!blank) out.push(o);
  }
  return out;
}

function colMap_(sh) {
  var map = {};
  sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].forEach(function (h, i) { map[clean_(h)] = i + 1; });
  return map;
}

function setCells_(sh, cols, row, values) {
  Object.keys(values).forEach(function (h) {
    if (!cols[h]) throw new Error('Column "' + h + '" missing in ' + sh.getName());
    sh.getRange(row, cols[h]).setValue(values[h]);
  });
}

function readRegistrations_() {
  var sh = ss_().getSheetByName(CONFIG.SHEETS.REG);
  if (!sh) return [];
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  var idx = {};
  values[0].forEach(function (h, i) { var n = norm_(h); if (idx[n] === undefined) idx[n] = i; });
  var col = function (names) { for (var i = 0; i < names.length; i++) if (idx[names[i]] !== undefined) return idx[names[i]]; return -1; };
  var cSection = col(['section', 'category']);
  var cHouse = col(['house', 'housename']);
  var cEvents = col(['events', 'event', 'items', 'item']);
  var cClass = col(['class', 'std', 'standard', 'grade']);
  var cName = col(['name', 'studentname']);
  var get = function (row, c) { return c < 0 ? '' : row[c]; };

  var out = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var rec = {
      section: clean_(get(row, cSection)),
      house: houseKey_(get(row, cHouse)),
      cls: clean_(get(row, cClass)),
      events: splitEvents_(get(row, cEvents))
    };
    if (!rec.section && !rec.house && !rec.events.length && !clean_(get(row, cName))) continue;
    out.push(rec);
  }
  return out;
}

function readCatalogue_() {
  return readObjects_(ss_().getSheetByName(CONFIG.SHEETS.EVENTS)).map(function (r) {
    var section = clean_(r['Section']), event = clean_(r['Event']);
    return {
      key: clean_(r['Event Key']) || eventKey_(section, event),
      section: section, event: event,
      order: r['Order'] === '' || r['Order'] === null || isNaN(Number(r['Order'])) ? 9999 : Number(r['Order']),
      status: key_(r['Status']) || STATUS.ACTIVE,
      source: clean_(r['Source']),
      _row: r._row
    };
  }).filter(function (e) { return e.section && e.event; });
}

function readScores_() {
  return readObjects_(ss_().getSheetByName(CONFIG.SHEETS.SCORES)).map(function (r) {
    return {
      id: clean_(r['Result ID']),
      decl: clean_(r['Declaration ID']),
      ts: toMs_(r['Timestamp']),
      section: clean_(r['Section']),
      event: clean_(r['Event']),
      key: clean_(r['Event Key']) || eventKey_(r['Section'], r['Event']),
      house: houseKey_(r['House']),
      position: Number(r['Position']) || 0,
      points: Number(r['Points']) || 0,
      status: key_(r['Status']) || STATUS.ACTIVE,
      remarks: clean_(r['Remarks']),
      by: clean_(r['Entered By']),
      updatedAt: toMs_(r['Updated At']),
      updatedBy: clean_(r['Updated By']),
      _row: r._row
    };
  }).filter(function (s) { return s.id && s.house; });
}

function registrationPairs_(regs) {
  var map = {};
  regs.forEach(function (r) {
    if (!r.section) return;
    r.events.forEach(function (ev) {
      var k = eventKey_(r.section, ev);
      if (!map[k]) map[k] = { key: k, section: r.section, event: ev };
    });
  });
  return Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, b) {
    return compareSections_(a.section, b.section) || naturalCompare_(a.event, b.event);
  });
}

function catalogueFromRegs_(regs) {
  return registrationPairs_(regs).map(function (p, i) {
    return { key: p.key, section: p.section, event: p.event, order: i + 1, status: STATUS.ACTIVE, source: 'REGISTRATIONS' };
  });
}

/** Adds (section, event) pairs found in Registrations that are missing from Score_Events. Never removes. */
function syncEvents_() {
  var sh = sheet_(CONFIG.SHEETS.EVENTS, HEADERS.EVENTS);
  var existing = readCatalogue_();
  var have = {}, maxOrder = 0;
  existing.forEach(function (e) { have[e.key] = true; if (e.order < 9999) maxOrder = Math.max(maxOrder, e.order); });
  var now = new Date();
  var rows = registrationPairs_(readRegistrations_())
    .filter(function (p) { return !have[p.key]; })
    .map(function (p) { maxOrder += 1; return [p.key, p.section, p.event, maxOrder, STATUS.ACTIVE, 'REGISTRATIONS', now]; });
  if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, HEADERS.EVENTS.length).setValues(rows);
  return { added: rows.length, total: existing.length + rows.length };
}

function audit_(entries, user) {
  if (!entries || !entries.length) return;
  var sh = sheet_(CONFIG.SHEETS.AUDIT, HEADERS.AUDIT);
  var now = new Date();
  var rows = entries.map(function (a) {
    return [now, a.action, a.id || '', a.decl || '', a.prev || '', a.next || '', user || 'Admin Portal', a.source || 'ADMIN_PORTAL'];
  });
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, HEADERS.AUDIT.length).setValues(rows);
}


/* =========================================================================
 *  Houses
 * ========================================================================= */

function houseList_(regs, scores) {
  var set = {};
  var override = PropertiesService.getScriptProperties().getProperty('HOUSES');
  if (override) {
    override.split(',').map(houseKey_).filter(Boolean).forEach(function (h) { set[h] = true; });
  } else {
    regs.forEach(function (r) { if (r.house) set[r.house] = true; });
  }
  (scores || []).forEach(function (s) { if (s.house) set[s.house] = true; });
  var names = Object.keys(set);
  if (!names.length) names = CONFIG.HOUSE_ORDER.slice();
  var rank = function (n) { var i = CONFIG.HOUSE_ORDER.indexOf(n); return i < 0 ? 100 : i; };
  names.sort(function (a, b) { return (rank(a) - rank(b)) || naturalCompare_(a, b); });
  return names.map(function (n, i) {
    var color = houseColor_(n, i);
    return { name: n, color: color, ink: inkFor_(color) };
  });
}

function houseSet_(houses) {
  var s = {};
  houses.forEach(function (h) { s[h.name] = true; });
  return s;
}

function houseColor_(name, i) {
  if (CONFIG.HOUSE_COLOR_OVERRIDES[name]) return CONFIG.HOUSE_COLOR_OVERRIDES[name];
  for (var k = 0; k < HOUSE_COLORS.length; k++) {
    if (name.indexOf(HOUSE_COLORS[k][0]) >= 0) return HOUSE_COLORS[k][1];
  }
  return FALLBACK_COLORS[i % FALLBACK_COLORS.length];
}

function inkFor_(hex) {
  var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '');
  if (!m) return '#ffffff';
  var b = (parseInt(m[1], 16) * 299 + parseInt(m[2], 16) * 587 + parseInt(m[3], 16) * 114) / 1000;
  return b > 150 ? '#111111' : '#ffffff';
}


/* =========================================================================
 *  Helpers
 * ========================================================================= */

function auth_(pin) {
  var expected = PropertiesService.getScriptProperties().getProperty('ADMIN_PIN');
  if (!expected) throw new Error('Admin PIN is not configured. Run setup() in the Apps Script editor.');
  if (String(pin == null ? '' : pin).trim() !== String(expected).trim()) throw new Error('Invalid PIN');
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function invalidate_() {
  try { CacheService.getScriptCache().remove(DASH_CACHE_KEY); } catch (e) { /* ignore */ }
}

function activeEmail_() {
  try { return Session.getActiveUser().getEmail() || ''; } catch (e) { return ''; }
}

function actor_(official) {
  var parts = [clean_(official), activeEmail_()].filter(Boolean);
  return parts.length ? parts.join(' / ') : 'Admin Portal';
}

function validateEntries_(list, houseSet) {
  if (!Array.isArray(list) || !list.length) throw new Error('Assign at least one house to a position.');
  return list.map(function (e) {
    var house = houseKey_(e && e.house);
    var pos = Number(e && e.position);
    var pts = Number(e && e.points);
    if (!houseSet[house]) throw new Error('Unknown house: ' + (e && e.house));
    if (!(pos >= 1 && pos <= 99 && Math.floor(pos) === pos)) throw new Error('Invalid position for ' + house + '.');
    if (e.points === '' || e.points === null || !isFinite(pts) || pts < 0 || pts > 1000) throw new Error('Invalid points for ' + house + '.');
    return { house: house, position: pos, points: r2_(pts) };
  });
}

function publicResult_(s) {
  return {
    id: s.id, decl: s.decl, ts: s.ts, section: s.section, event: s.event, key: s.key,
    house: s.house, position: s.position, points: s.points, status: s.status,
    remarks: s.remarks, by: s.by, updatedAt: s.updatedAt, updatedBy: s.updatedBy
  };
}

function describe_(s) {
  return s.section + ' › ' + s.event + ' | ' + s.house + ' | Pos ' + s.position + ' | ' + s.points + ' pts | ' + s.status;
}

function maxSeq_(list, field, prefix) {
  var re = new RegExp('^' + prefix + '-(\\d+)$');
  return list.reduce(function (m, o) { var x = re.exec(o[field] || ''); return x ? Math.max(m, Number(x[1])) : m; }, 0);
}

function fmtId_(prefix, n) {
  var s = String(n);
  while (s.length < 4) s = '0' + s;
  return prefix + '-' + s;
}

function findBy_(list, field, value) {
  for (var i = 0; i < list.length; i++) if (list[i][field] === value) return list[i];
  return null;
}

function shallow_(o) {
  var c = {};
  Object.keys(o).forEach(function (k) { c[k] = o[k]; });
  return c;
}

function clean_(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
function key_(s) { return clean_(s).toUpperCase(); }
function norm_(s) { return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, ''); }
function houseKey_(s) { return key_(s).replace(/\s+HOUSE$/, ''); }
function eventKey_(section, event) { return key_(section) + '||' + key_(event); }
function r2_(n) { return Math.round(Number(n) * 100) / 100; }

function splitEvents_(s) {
  return String(s == null ? '' : s).split(/[,;\n|]+/).map(clean_).filter(Boolean);
}

function toMs_(v) {
  if (v instanceof Date) return v.getTime();
  if (v === '' || v === null || v === undefined) return 0;
  var d = new Date(v);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

function naturalCompare_(a, b) {
  var ax = String(a).toUpperCase().match(/\d+(?:\.\d+)?|\D+/g) || [];
  var bx = String(b).toUpperCase().match(/\d+(?:\.\d+)?|\D+/g) || [];
  for (var i = 0; i < Math.min(ax.length, bx.length); i++) {
    var x = ax[i], y = bx[i];
    var nx = /^\d/.test(x), ny = /^\d/.test(y);
    if (nx && ny) { var d = parseFloat(x) - parseFloat(y); if (d) return d; }
    else if (x !== y) return x < y ? -1 : 1;
  }
  return ax.length - bx.length;
}

function sectionRank_(name) {
  var n = norm_(name);
  for (var i = 0; i < CONFIG.SECTION_ORDER.length; i++) if (norm_(CONFIG.SECTION_ORDER[i]) === n) return i;
  return 100;
}

function compareSections_(a, b) {
  return (sectionRank_(a) - sectionRank_(b)) || naturalCompare_(a, b);
}
