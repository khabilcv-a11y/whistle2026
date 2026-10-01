/* Report definitions (printable sheets and exports). Each returns a report for Reports.download(). */
(function (w) {
  'use strict';
  var A = w.A, D = w.DCIP;
  var R = A.reports = {};

  function sess(sid) { return A.S.sessions.filter(function (s) { return s.id === sid; })[0] || null; }
  function sessionTitle(sid) { var s = sess(sid); return s ? A.sessionLabel(s) : sid === '__none' ? 'Not yet assigned to a session' : 'All shortlisted candidates'; }
  function sessionMeta(sid, extra) {
    var s = sess(sid);
    return [[extra || 'Interviewer', s ? s.interviewer : '', ['Session', s ? D.fmtDate(s.date) + ', ' + s.slot : sessionTitle(sid)]]].concat(s && s.venue ? [['Venue', s.venue]] : []);
  }
  function loc(a) { return a.location || [a.district, a.localBody].filter(Boolean).join(', '); }
  function phones(a) { return [a.mobile, a.altMobile].filter(Boolean).join('\n'); }
  function sl(rows) { return rows.map(function (r, i) { return [i + 1].concat(r); }); }
  function byScore(key) { return function (a, b) { var x = A.num(a[key]), y = A.num(b[key]); return (y == null ? -1e9 : y) - (x == null ? -1e9 : x) || A.nameCmp(a, b); }; }
  var SL = { h: 'Sl No', w: 6, align: 'center' };

  R.applications = function (list, title) {
    return { filename: 'DCIP_Applications', orientation: 'landscape', sheets: [{ name: 'Applications', title: title || 'Applications', fontSize: 7, rowHeight: 24,
      columns: [SL, { h: 'App ID', w: 12 }, { h: 'Full Name', w: 20 }, { h: 'DOB', w: 11 }, { h: 'Age', w: 5, align: 'center' }, { h: 'Gender', w: 8 }, { h: 'E-mail', w: 24 }, { h: 'Mobile', w: 12 }, { h: 'Alt. mobile', w: 12 },
        { h: 'District', w: 13 }, { h: 'Local body', w: 18 }, { h: 'Qualification', w: 18 }, { h: 'UG stream', w: 9 }, { h: 'Subject', w: 16 }, { h: 'Institution', w: 24 }, { h: 'UG completion', w: 11 },
        { h: 'Status', w: 11 }, { h: 'Screening', w: 12 }, { h: 'Screening notes', w: 30 }, { h: 'Flagged', w: 7 }, { h: 'Flag note', w: 16 }, { h: 'Screen score', w: 8, align: 'center' }, { h: 'Interview score', w: 8, align: 'center' },
        { h: 'Session', w: 18 }, { h: 'Remarks', w: 22 }, { h: 'Submitted', w: 17 }],
      rows: sl(list.slice().sort(function (a, b) { return String(a.id).localeCompare(String(b.id)); }).map(function (a) {
        return [a.id, a.fullName, a.dob, a.age, a.gender, a.email, a.mobile, a.altMobile, a.district, a.localBody, a.qual, a.stream, a.specialisation, a.institution, a.completion,
          a.status, a.screening, a.screeningNotes, a.flagged, a.flagNote, A.num(a.screenScore), A.num(a.interviewScore), a.session, a.remarks, a.submittedAt.replace('T', ' ')];
      })) }] };
  };

  R.screening = function () {
    var list = A.S.apps.filter(function (a) { return a.screening === 'Review' || a.screening === 'Suggest Disqualify' || a.flagged === 'Yes'; });
    list.sort(function (a, b) { return (a.screening === 'Suggest Disqualify' ? 0 : 1) - (b.screening === 'Suggest Disqualify' ? 0 : 1) || String(a.id).localeCompare(b.id); });
    return { filename: 'DCIP_Screening_Report', orientation: 'landscape', sheets: [{ name: 'Screening', title: 'Application screening – flags and suggested disqualifications', rowHeight: 34, fontSize: 8,
      note: 'Rules: age up to ' + A.S.settings.MAX_AGE + ' on ' + D.fmtDate(A.S.config.ageAsOn) + '; UG course completed on or before ' + D.fmtDate(A.S.settings.INTAKE_END) + '.',
      columns: [SL, { h: 'App ID', w: 11 }, { h: 'Name', w: 20 }, { h: 'Age', w: 5, align: 'center' }, { h: 'UG completion', w: 11 }, { h: 'Screening', w: 14 }, { h: 'Reasons', w: 50 }, { h: 'Flag note', w: 20 }, { h: 'Status', w: 11 }],
      rows: sl(list.map(function (a) { return [a.id, a.fullName, a.age, a.completion, a.screening, (a.screeningNotes || '').replace(/ \| /g, '\n'), a.flagged === 'Yes' ? (a.flagNote || 'Flagged') : '', a.status]; })) }] };
  };

  R.rankScreen = function () {
    var list = A.S.apps.filter(function (a) { return A.num(a.screenScore) != null && A.eligible(a); }).sort(byScore('screenScore')), n = Number(A.S.settings.SHORTLIST_SIZE) || 30;
    return { filename: 'DCIP_Rank_List', orientation: 'portrait', sheets: [{ name: 'Rank list', title: 'Rank list – application screening', rowHeight: 24, note: 'Top ' + n + ' are shortlisted for interview.',
      columns: [{ h: 'Rank', w: 6, align: 'center' }, { h: 'App ID', w: 12 }, { h: 'Name', w: 22 }, { h: 'Age', w: 5, align: 'center' }, { h: 'Location', w: 24 }, { h: 'UG', w: 30 }, { h: 'Score', w: 8, align: 'center' }, { h: 'Status', w: 12 }],
      rows: list.map(function (a, i) { return [i + 1, a.id, a.fullName, a.age, loc(a), A.ugText(a), A.num(a.screenScore), a.status]; }) }] };
  };

  R.shortlist = function () {
    var list = A.S.apps.filter(function (a) { return a.shortlisted === 'Yes'; }).sort(A.nameCmp);
    return { filename: 'DCIP_Shortlisted_Candidates', orientation: 'landscape', sheets: [{ name: 'Shortlisted', title: 'Shortlisted candidates', rowHeight: 26,
      columns: [SL, { h: 'Name', w: 22 }, { h: 'Contact', w: 14 }, { h: 'Age', w: 5, align: 'center' }, { h: 'District, local body', w: 26 }, { h: 'Highest qual.', w: 20 }, { h: 'UG', w: 34 }, { h: 'Screen score', w: 9, align: 'center' }, { h: 'Session', w: 18 }, { h: 'Status', w: 11 }],
      rows: sl(list.map(function (a) { return [a.fullName, phones(a), a.age, loc(a), a.qual, A.ugText(a), A.num(a.screenScore), a.session, a.status]; })) }] };
  };

  R.interviewRank = function () {
    var list = A.S.apps.filter(function (a) { return a.shortlisted === 'Yes' && A.num(a.interviewScore) != null; }).sort(byScore('interviewScore'));
    return { filename: 'DCIP_Interview_Rank_List', orientation: 'portrait', sheets: [{ name: 'Interview rank', title: 'Rank list – interview', rowHeight: 24,
      columns: [{ h: 'Rank', w: 6, align: 'center' }, { h: 'Name', w: 24 }, { h: 'Age', w: 5, align: 'center' }, { h: 'UG', w: 34 }, { h: 'Screen score', w: 9, align: 'center' }, { h: 'Interview score', w: 10, align: 'center' }, { h: 'Status', w: 12 }],
      rows: list.map(function (a, i) { return [i + 1, a.fullName, a.age, A.ugText(a), A.num(a.screenScore), A.num(a.interviewScore), a.status]; }) }] };
  };

  R.interns = function (statuses, title, file) {
    var list = A.S.apps.filter(function (a) { return statuses.indexOf(a.status) >= 0; }).sort(A.nameCmp);
    return { filename: file, orientation: 'landscape', sheets: [{ name: title, title: title, rowHeight: 26,
      columns: [SL, { h: 'Name', w: 22 }, { h: 'Contact', w: 14 }, { h: 'E-mail', w: 26 }, { h: 'Location', w: 26 }, { h: 'UG', w: 34 }, { h: 'Interview score', w: 9, align: 'center' }, { h: 'Status', w: 11 }, { h: 'Remarks', w: 22 }],
      rows: sl(list.map(function (a) { return [a.fullName, phones(a), a.email, loc(a), A.ugText(a), A.num(a.interviewScore), a.status, a.remarks]; })) }] };
  };

  R.scoreSheet = function (sid) {
    var list = A.sessionApps(sid);
    return { filename: 'DCIP_Score_Sheet_' + sessionTitle(sid), orientation: 'landscape', sheets: [{ name: 'Score sheet', title: 'Score sheet', meta: sessionMeta(sid), rowHeight: 34, noBands: true,
      columns: [SL, { h: 'Full Name', w: 22 }, { h: 'Age', w: 5, align: 'center' }, { h: 'District, local body', w: 24 }, { h: 'Highest Edu. Qual.', w: 20 }, { h: 'UG', w: 34 }, { h: 'Score', w: 10 }, { h: 'Remarks', w: 30 }],
      rows: sl(list.map(function (a) { return [a.fullName, a.age, loc(a), a.qual, A.ugText(a), A.num(a.interviewScore), a.remarks]; })) }] };
  };

  R.attendance = function (sid) {
    var list = A.sessionApps(sid);
    return { filename: 'DCIP_Attendance_' + sessionTitle(sid), orientation: 'portrait', sheets: [{ name: 'Attendance', title: 'Attendance', meta: sessionMeta(sid, 'Attendance record'), rowHeight: 40, noBands: true,
      columns: [SL, { h: 'Name', w: 24 }, { h: 'Contact Number', w: 15 }, { h: 'Location', w: 24 }, { h: 'Reporting Time', w: 13 }, { h: 'Signature', w: 20 }],
      rows: sl(list.map(function (a) { return [a.fullName, phones(a), loc(a), a.reportingTime || '', '']; })) }] };
  };

  R.callChart = function (sid) {
    var list = A.sessionApps(sid);
    return { filename: 'DCIP_Call_Chart_' + sessionTitle(sid), orientation: 'landscape', sheets: [{ name: 'Call chart', title: 'Call chart', meta: sessionMeta(sid, 'Called by'), rowHeight: 36, noBands: true,
      columns: [SL, { h: 'Name', w: 22 }, { h: 'Contact Number', w: 14 }, { h: 'Location', w: 24 }, { h: 'Session', w: 18 }, { h: 'Call status', w: 13 }, { h: 'Called by', w: 12 }, { h: 'Time', w: 9 }, { h: 'Response', w: 16 }, { h: 'Remarks', w: 28 }],
      rows: sl(list.map(function (a) { return [a.fullName, phones(a), loc(a), a.session, a.callStatus, '', '', '', a.callNote]; })) }] };
  };

  R.docVerification = function (sid) {
    var list = A.sessionApps(sid);
    return { filename: 'DCIP_Doc_Verification_' + sessionTitle(sid), orientation: 'landscape', sheets: [{ name: 'Doc verification', title: 'Doc. verification', meta: sessionMeta(sid, 'Verified by'), rowHeight: 38, noBands: true,
      columns: [SL, { h: 'Name', w: 22 }, { h: 'Contact Number', w: 14 }, { h: 'Location', w: 22 }, { h: 'UG', w: 34 }, { h: 'UG Certificate', w: 13 }, { h: 'Other Documents Presented', w: 26 }, { h: 'Remarks', w: 26 }],
      rows: sl(list.map(function (a) { return [a.fullName, phones(a), loc(a), A.ugText(a), a.docCert, a.docOther, a.docRemarks]; })) }] };
  };

  R.sessions = function () {
    var ss = A.sortSessions(A.S.sessions);
    return { filename: 'DCIP_Interview_Sessions', orientation: 'landscape', sheets: [{ name: 'Sessions', title: 'Interview sessions', rowHeight: 22,
      columns: [SL, { h: 'Date', w: 14 }, { h: 'Slot', w: 12 }, { h: 'Venue', w: 24 }, { h: 'Interviewer', w: 24 }, { h: 'Capacity', w: 9, align: 'center' }, { h: 'Assigned', w: 9, align: 'center' }, { h: 'Present', w: 9, align: 'center' }],
      rows: sl(ss.map(function (s) { var l = A.sessionApps(s.id); return [D.fmtDate(s.date), s.slot, s.venue, s.interviewer, s.capacity === '' ? '' : Number(s.capacity), l.length, l.filter(function (a) { return a.attendance === 'Present'; }).length]; })) }] };
  };

  R.insights = function (scope) { var b = A.rep(); return w.Insights.toReport(w.Insights.compute(A.S.apps, scope, A.S.settings), b.batch, b.programme); };

  /** Catalogue shown in the Reports tab. */
  R.catalogue = function () {
    var S = A.S.apps, c = function (f) { return S.filter(f).length; };
    return [
      { group: 'Applications', title: 'All applications', desc: 'Every application with all fields, screening result, scores and status.', n: S.length, make: function () { return R.applications(S, 'All applications'); } },
      { group: 'Applications', title: 'Screening report', desc: 'Flagged applications, items needing review and suggested disqualifications, with the reasons.', n: c(function (a) { return a.screening === 'Review' || a.screening === 'Suggest Disqualify' || a.flagged === 'Yes'; }), make: R.screening },
      { group: 'Applications', title: 'Insights – all applications', desc: 'District, gender, education, age, college, stream, subject and LSGD counts.', make: function () { return R.insights('all'); } },
      { group: 'Shortlisting', title: 'Rank list (screening)', desc: 'Eligible applicants ranked by screen score.', n: c(function (a) { return A.num(a.screenScore) != null && A.eligible(a); }), make: R.rankScreen },
      { group: 'Shortlisting', title: 'Shortlisted candidates', desc: 'The candidates called for interview, with contact details.', n: c(function (a) { return a.shortlisted === 'Yes'; }), make: R.shortlist },
      { group: 'Shortlisting', title: 'Insights – shortlisted', desc: 'The same breakdowns for the shortlisted batch.', make: function () { return R.insights('shortlisted'); } },
      { group: 'Interview day', title: 'Interview sessions', desc: 'Sessions with venue, interviewer, assigned and present counts.', n: A.S.sessions.length, make: R.sessions },
      { group: 'Interview day', title: 'Call chart – all shortlisted', desc: 'Calling list with blank columns for the caller to fill. Per-session charts are on the Interviews tab.', n: c(function (a) { return a.shortlisted === 'Yes'; }), make: function () { return R.callChart('__all'); } },
      { group: 'Interview day', title: 'Score sheet – all shortlisted', desc: 'Blank score sheet for every shortlisted candidate. Per-session sheets are on the Interviews tab.', n: c(function (a) { return a.shortlisted === 'Yes'; }), make: function () { return R.scoreSheet('__all'); } },
      { group: 'Selection', title: 'Interview rank list', desc: 'Shortlisted candidates ranked by interview score.', n: c(function (a) { return a.shortlisted === 'Yes' && A.num(a.interviewScore) != null; }), make: R.interviewRank },
      { group: 'Selection', title: 'Selected & confirmed interns', desc: 'Candidates with status Selected or Confirmed.', n: c(function (a) { return a.status === 'Selected' || a.status === 'Confirmed'; }), make: function () { return R.interns(['Selected', 'Confirmed'], 'Selected and confirmed interns', 'DCIP_Selected_Interns'); } },
      { group: 'Selection', title: 'Confirmed interns', desc: 'Candidates whose documents have been verified.', n: c(function (a) { return a.status === 'Confirmed'; }), make: function () { return R.interns(['Confirmed'], 'Confirmed interns list', 'DCIP_Confirmed_Interns'); } },
      { group: 'Selection', title: 'Waiting list', desc: 'Candidates with status Waitlisted.', n: c(function (a) { return a.status === 'Waitlisted'; }), make: function () { return R.interns(['Waitlisted'], 'Waiting list', 'DCIP_Waiting_List'); } },
      { group: 'Selection', title: 'Insights – selected / confirmed', desc: 'Breakdowns for the confirmed batch.', make: function () { return R.insights('selected'); } }
    ];
  };
})(window);
