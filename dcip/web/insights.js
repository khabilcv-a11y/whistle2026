/* Insights: counts by district, gender, qualification, age, college, stream, subject and LSGD (within Kozhikode).
 * Computed in the browser from the application list, so they are always live. */
(function (w) {
  'use strict';
  var esc = w.DCIP.esc;

  function normKey(s) {
    return String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/\bgovt\b\.?/g, 'government').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').replace(/^the /, '').trim();
  }
  function lbKey(s) {
    var x = String(s || '').toLowerCase().replace(/[^a-z ]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (/corp/.test(x)) return 'kozhikode corporation';
    return x.replace(/\b(grama|gram|panchayat|panchayath|panchayathu|panchayt|pnchayat|muncipality|municipality|muncipal|municipal|mun)\b/g, '').replace(/\s+/g, ' ').trim();
  }
  function pretty(s) {
    s = String(s || '').trim();
    if (s && (s === s.toUpperCase() || s === s.toLowerCase())) return s.toLowerCase().replace(/(^|[\s(\-/.])([a-z])/g, function (m, a, b) { return a + b.toUpperCase(); });
    return s;
  }
  /** Groups raw strings by key and labels each group with its most frequent spelling. */
  function group(list, keyFn, labelFn) {
    var g = {};
    list.forEach(function (raw) {
      var k = keyFn(raw); if (!k) k = '__none';
      var e = g[k] || (g[k] = { n: 0, spell: {} }); e.n++; e.spell[raw] = (e.spell[raw] || 0) + 1;
    });
    return Object.keys(g).map(function (k) {
      var best = Object.keys(g[k].spell).sort(function (a, b) { return g[k].spell[b] - g[k].spell[a]; })[0];
      return [k === '__none' ? '(not given)' : (labelFn || pretty)(best), g[k].n];
    }).sort(function (a, b) { return b[1] - a[1] || a[0].localeCompare(b[0]); });
  }
  function simple(list) {
    var g = {}; list.forEach(function (v) { v = v || '(not given)'; g[v] = (g[v] || 0) + 1; });
    return Object.keys(g).map(function (k) { return [k, g[k]]; }).sort(function (a, b) { return b[1] - a[1] || a[0].localeCompare(b[0]); });
  }
  function qualGroup(q) { return /^master/i.test(q) ? 'PG' : /pending/i.test(q) ? 'UG – results pending' : /bachelor/i.test(q) ? 'UG – completed' : (q || '(not given)'); }

  var SCOPES = {
    all: { label: 'All applications', pick: function (a) { return true; } },
    shortlisted: { label: 'Shortlisted', pick: function (a) { return a.shortlisted === 'Yes'; } },
    selected: { label: 'Selected / Confirmed', pick: function (a) { return a.status === 'Selected' || a.status === 'Confirmed'; } }
  };

  function compute(allApps, scope, settings) {
    var apps = allApps.filter(SCOPES[scope].pick), n = apps.length;
    var koz = apps.filter(function (a) { return a.district === 'Kozhikode'; });
    var ages = {}; apps.forEach(function (a) { var k = a.age === '' ? '(not given)' : String(a.age); ages[k] = (ages[k] || 0) + 1; });
    var ageRows = Object.keys(ages).sort(function (a, b) { return (parseFloat(a) || 999) - (parseFloat(b) || 999); }).map(function (k) { return [k, ages[k]]; });
    var facets = [
      { id: 'district', title: 'District', rows: simple(apps.map(function (a) { return a.district; })) },
      { id: 'gender', title: 'Gender', rows: simple(apps.map(function (a) { return a.gender; })) },
      { id: 'qual', title: 'Education', rows: simple(apps.map(function (a) { return qualGroup(a.qual); })) },
      { id: 'age', title: 'Age wise', rows: ageRows, noSort: true },
      { id: 'college', title: 'College', rows: group(apps.map(function (a) { return a.institution; }), normKey), top: 12 },
      { id: 'stream', title: 'UG stream', rows: group(apps.map(function (a) { return a.stream; }), normKey) },
      { id: 'subject', title: 'Subject', rows: group(apps.map(function (a) { return a.specialisation; }), normKey), top: 12 },
      { id: 'lsgd', title: 'LSGD wise within Kozhikode', rows: group(koz.map(function (a) { return a.localBody; }), lbKey), top: 12, count: koz.length }
    ];
    var out = { scope: scope, label: SCOPES[scope].label, total: n, facets: facets, tiles: [] };

    var fem = apps.filter(function (a) { return a.gender === 'Female'; }).length, mal = apps.filter(function (a) { return a.gender === 'Male'; }).length;
    if (scope === 'all') {
      var today = new Date().toISOString().slice(0, 10), actionable = apps.filter(function (a) { return a.status === 'Received' && (a.screening === 'Review' || a.screening === 'Suggest Disqualify'); }).length;
      out.tiles = [
        ['Applications received', n], ['Received today', apps.filter(function (a) { return String(a.submittedAt).slice(0, 10) === today; }).length],
        ['Need screening', actionable, actionable ? 'warn' : ''], ['Flagged', apps.filter(function (a) { return a.flagged === 'Yes'; }).length],
        ['Shortlisted', apps.filter(function (a) { return a.shortlisted === 'Yes'; }).length, '', 'of ' + (settings.SHORTLIST_SIZE || 30)],
        ['Selected / confirmed', apps.filter(function (a) { return a.status === 'Selected' || a.status === 'Confirmed'; }).length, '', 'of ' + (settings.SELECTION_SIZE || 25)]
      ];
      var c = function (f) { return apps.filter(f).length; };
      out.funnel = [
        ['Received', n], ['Eligible (auto-screened or cleared)', c(function (a) { return a.screening === 'Eligible' || a.screening === 'Cleared'; })],
        ['Needs review', c(function (a) { return a.screening === 'Review'; })], ['Suggested to disqualify', c(function (a) { return a.screening === 'Suggest Disqualify'; })],
        ['Disqualified', c(function (a) { return a.status === 'Disqualified'; })], ['Shortlisted', c(function (a) { return a.shortlisted === 'Yes'; })],
        ['Interview score entered', c(function (a) { return a.interviewScore !== ''; })], ['Selected', c(function (a) { return a.status === 'Selected'; })],
        ['Confirmed', c(function (a) { return a.status === 'Confirmed'; })], ['Waitlisted', c(function (a) { return a.status === 'Waitlisted'; })],
        ['Withdrawn', c(function (a) { return a.status === 'Withdrawn'; })]
      ];
      var days = {}; apps.forEach(function (a) { var d = String(a.submittedAt).slice(0, 10); if (d) days[d] = (days[d] || 0) + 1; });
      var keys = Object.keys(days).sort();
      if (keys.length) {
        var first = new Date(keys[0] + 'T00:00:00Z'), last = new Date(Math.max(new Date(keys[keys.length - 1] + 'T00:00:00Z'), new Date(today + 'T00:00:00Z')));
        var series = [], span = Math.min(45, Math.round((last - first) / 864e5) + 1);
        for (var i = span - 1; i >= 0; i--) { var d = new Date(last.getTime() - i * 864e5).toISOString().slice(0, 10); series.push([d, days[d] || 0]); }
        out.timeline = series;
      }
    } else {
      var pg = apps.filter(function (a) { return /^master/i.test(a.qual); }).length;
      out.tiles = [
        [scope === 'shortlisted' ? 'Shortlisted' : 'Selected / confirmed', n], ['Female', fem], ['Male', mal],
        ['Districts', new Set(apps.map(function (a) { return a.district; })).size], ['Colleges', facets[4].rows.filter(function (r) { return r[0] !== '(not given)'; }).length],
        ['Post-graduates', pg]
      ];
    }
    return out;
  }

  /* ------------------------------ rendering ------------------------------ */
  var expanded = {};
  function bars(f, total) {
    var rows = f.rows, limit = f.top && !expanded[f.id] ? f.top : rows.length, shown = rows.slice(0, limit), max = Math.max.apply(null, [1].concat(rows.map(function (r) { return r[1]; })));
    var sum = rows.reduce(function (s, r) { return s + r[1]; }, 0);
    var html = '<table class="bars"><caption class="sr">' + esc(f.title) + '</caption><tbody>' + shown.map(function (r) {
      return '<tr title="' + esc(r[0]) + ': ' + r[1] + ' (' + (sum ? Math.round(r[1] * 100 / sum) : 0) + '%)"><th scope="row">' + esc(r[0]) + '</th><td class="bw"><span class="b" style="width:' + Math.max(2, r[1] / max * 100) + '%"></span></td><td class="n">' + r[1] + '</td></tr>';
    }).join('') + '</tbody></table>';
    if (!rows.length) html = '<div class="muted" style="padding:8px 0">No data yet.</div>';
    if (f.top && rows.length > f.top) html += '<button class="btn small" data-expand="' + f.id + '">' + (expanded[f.id] ? 'Show top ' + f.top : 'Show all ' + rows.length) + '</button>';
    return html;
  }

  function render(el, data) {
    var h = '<div class="tiles">' + data.tiles.map(function (t) {
      return '<div class="tile ' + (t[2] || '') + '"><div class="tv">' + t[1] + (t[3] ? '<small> ' + esc(t[3]) + '</small>' : '') + '</div><div class="tl">' + esc(t[0]) + '</div></div>';
    }).join('') + '</div>';
    if (!data.total) h += '<div class="empty">No applications in this view yet.</div>';
    h += '<div class="ins-grid">';
    if (data.funnel) h += '<section class="ins"><h3>Selection funnel</h3>' + bars({ id: 'funnel', title: 'Funnel', rows: data.funnel }, data.total) + '</section>';
    if (data.timeline) {
      var max = Math.max.apply(null, [1].concat(data.timeline.map(function (d) { return d[1]; }))), bw = 100 / data.timeline.length;
      h += '<section class="ins wide"><h3>Applications per day <small>(last ' + data.timeline.length + ' days)</small></h3><svg viewBox="0 0 100 34" preserveAspectRatio="none" class="spark" role="img" aria-label="Applications per day">' +
        data.timeline.map(function (d, i) { var hh = d[1] / max * 28; return '<rect x="' + (i * bw + bw * .12) + '" y="' + (30 - hh) + '" width="' + bw * .76 + '" height="' + Math.max(hh, d[1] ? .6 : 0) + '" rx=".5"><title>' + d[0] + ': ' + d[1] + '</title></rect>'; }).join('') +
        '<line x1="0" y1="30.2" x2="100" y2="30.2" /></svg><div class="axis"><span>' + w.DCIP.fmtDate(data.timeline[0][0]) + '</span><span>peak ' + max + '/day</span><span>' + w.DCIP.fmtDate(data.timeline[data.timeline.length - 1][0]) + '</span></div></section>';
    }
    data.facets.forEach(function (f) {
      var sum = f.rows.reduce(function (s, r) { return s + r[1]; }, 0);
      h += '<section class="ins"><h3>' + esc(f.title) + ' <span class="tot">' + (f.count != null ? f.count : sum) + '</span></h3>' + bars(f, data.total) + '</section>';
    });
    el.innerHTML = h + '</div>';
    el.querySelectorAll('[data-expand]').forEach(function (b) { b.onclick = function () { expanded[b.dataset.expand] = !expanded[b.dataset.expand]; render(el, data); }; });
  }

  function toReport(data, batch, programme) {
    var sheets = [{ name: 'Summary', title: 'Insights – ' + data.label, columns: [{ h: 'Measure', w: 40 }, { h: 'Count', w: 12, align: 'center' }],
      rows: data.tiles.map(function (t) { return [t[0], t[1]]; }).concat(data.funnel ? [['', ''], ['SELECTION FUNNEL', '']].concat(data.funnel) : []), rowHeight: 20 }];
    data.facets.forEach(function (f) {
      var sum = f.rows.reduce(function (s, r) { return s + r[1]; }, 0);
      sheets.push({ name: f.title, title: f.title + ' · ' + data.label, columns: [{ h: f.title, w: 44 }, { h: 'Count', w: 10, align: 'center' }, { h: '%', w: 10, align: 'center' }],
        rows: f.rows.map(function (r) { return [r[0], r[1], sum ? Math.round(r[1] * 1000 / sum) / 10 : 0]; }).concat([['Total', sum, '']]), rowHeight: 20, big: false });
    });
    return { filename: 'DCIP_Insights_' + data.label, orientation: 'portrait', batch: batch, programme: programme, sheets: sheets };
  }

  w.Insights = { compute: compute, render: render, toReport: toReport, SCOPES: SCOPES, normKey: normKey };
})(window);
