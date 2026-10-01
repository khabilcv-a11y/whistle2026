/* Demo data for the local preview: ~120 realistic applications, some ineligible, a shortlist, two sessions, a few selections. */
(function (w) {
  'use strict';
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  var first = ['Anagha', 'Abhijith', 'Fathima', 'Amna', 'Haroon', 'Hiba', 'Irshad', 'Lameesa', 'Sachidanand', 'Mishab', 'Najiya', 'Navya', 'Nidha', 'Nisna', 'Rasha', 'Rinu', 'Rithin', 'Salihath', 'Sana', 'Saniya', 'Sneha', 'Sreyas', 'Ansina', 'Rishika', 'Vishnu', 'Anadi', 'Ajina', 'Akshaya', 'Anand', 'Devika', 'Gayathri', 'Meera', 'Nandana', 'Arjun', 'Adwaith', 'Aparna', 'Neha', 'Remisha', 'Ritu', 'Varsha', 'Farhana', 'Greeshma', 'Hafiza', 'Mariya', 'Zubair', 'Afnas', 'Khais', 'Najla', 'Shifa', 'Ashmal'];
  var last = ['K', 'P', 'V Nair', 'Menon', 'Thomas', 'C P', 'M U', 'T', 'Warrier', 'Kumar', 'Das', 'Krishnan', 'Mohammed', 'Sheriff', 'Pillai', 'Varghese', 'Jose', 'Rahman', 'S', 'R'];
  var districts = [['Kozhikode', 52], ['Malappuram', 14], ['Ernakulam', 7], ['Kannur', 6], ['Palakkad', 5], ['Wayanad', 4], ['Thrissur', 4], ['Alappuzha', 2], ['Kollam', 2], ['Idukki', 1], ['Outside Kerala', 3]];
  var kozLB = ['Kozhikode Corporation', 'Atholi Grama Panchayat', 'Vadakara Municipality', 'Koyilandy Municipality', 'Unnikulam Panchayat', 'Mavoor panchayat', 'Thikkodi Grama Panchayat', 'Kakkur Grama Panchayat', 'Chathamangalam Grama Panchayat', 'Naduvannur Panchayat', 'Kozhikode Muncipal Corporation', 'Koduvally Municipality', 'Perambra Grama Panchayat'];
  var colleges = ['University of Delhi', 'Farook College', 'Jamia Millia Islamia', 'Devagiri College', 'St Joseph\'s College Devagiri', 'Govt Arts and Science College Meenchanda', 'Kannur University - Payyanur College', 'Mercy College Palakkad', 'Providence Womens College', 'Little Flower Institute of Social Sciences and Health', 'Malabar Christian College', 'Azim Premji University', 'Sir Syed College', 'Kristu Jayanti College Autonomous Bengaluru', 'Hindu College, University of Delhi', 'St Stephen\'s College Delhi'];
  var streams = [['B.A', 'Political Science'], ['B.A', 'Economics'], ['B.A', 'History'], ['B.A', 'Sociology'], ['B.A', 'English Language and Literature'], ['B.A', 'Public Administration'], ['B.Sc', 'Physics'], ['B.Sc', 'Zoology'], ['B.Sc', 'Statistics'], ['B.Com', 'Finance'], ['B.Tech / B.E', 'Agricultural Engineering'], ['BBA / BBM', 'Management'], ['BCA', 'Computer Applications'], ['B.A', 'Psychology']];
  var quals = ["Bachelor's Degree (completed)", "Bachelor's Degree (final year – results pending)", "Master's Degree"];
  var why = ['I want to understand how a district administration works on the ground and contribute to public service.', 'DCIP offers a rare chance to see governance from inside the Collectorate. I want to learn and serve.', 'I am preparing for civil services and want practical exposure to administration and welfare delivery.', 'My studies in public policy made me curious about how schemes reach people. This internship is the best way to learn.'];

  function seedDemo(I, env) {
    var R = rng(34), pick = function (a) { return a[Math.floor(R() * a.length)]; };
    var wpick = function (list) { var t = list.reduce(function (s, x) { return s + x[1]; }, 0), r = R() * t; for (var i = 0; i < list.length; i++) { r -= list[i][1]; if (r <= 0) return list[i][0]; } return list[0][0]; };
    var s = I.settings_(), sh = I.sheet_(I.APP.SHEETS.APPS, I.FIELDS), rows = [], now = Date.now();
    var iso = function (ms) { return new Date(ms + 19800000).toISOString().slice(0, 19); };
    var sessions = [{ id: '2026-11-20 Forenoon', date: '2026-11-20', slot: 'Forenoon', venue: 'Collectorate Conference Hall', interviewer: 'Panel A', capacity: 15, notes: '' }, { id: '2026-11-20 Afternoon', date: '2026-11-20', slot: 'Afternoon', venue: 'Collectorate Conference Hall', interviewer: 'Panel B', capacity: 15, notes: '' }];
    var ssh = I.sheet_(I.APP.SHEETS.SESSIONS, [{ k: 'id', h: 'Session ID' }, { k: 'date', h: 'Date' }, { k: 'slot', h: 'Slot' }, { k: 'venue', h: 'Venue' }, { k: 'interviewer', h: 'Interviewer' }, { k: 'capacity', h: 'Capacity' }, { k: 'notes', h: 'Notes' }]);
    sessions.forEach(function (x, i) { ssh.getRange(2 + i, 1, 1, 7).setValues([[x.id, x.date, x.slot, x.venue, x.interviewer, x.capacity, x.notes]]); });

    for (var i = 0; i < 120; i++) {
      var f = pick(first), d = { fullName: f + ' ' + pick(last), gender: R() < .8 ? 'Female' : 'Male' };
      var yob = 1996 + Math.floor(R() * 8) + (R() < .04 ? -3 : 0), bday = ('0' + (1 + Math.floor(R() * 12))).slice(-2) + '-' + ('0' + (1 + Math.floor(R() * 28))).slice(-2);
      d.dob = yob + '-' + bday; d.email = f.toLowerCase() + i + '@example.com'; d.mobile = '9' + ('000000000' + (100000000 + i * 7919)).slice(-9);
      d.altMobile = R() < .6 ? '8' + ('000000000' + (200000000 + i * 104729)).slice(-9) : '';
      d.district = wpick(districts); d.localBody = d.district === 'Kozhikode' ? pick(kozLB) : d.district === 'Outside Kerala' ? 'New Delhi, Delhi' : pick(['Kizhuparamba Panchayat', 'Municipality', 'Vallikkunnu Grama Panchayat', 'Ramanthali Panchayat', 'Thavinhal Grama Panchayat', 'Koduvayur Panchayat']);
      d.qual = pick(quals); var st = pick(streams); d.stream = st[0]; d.specialisation = st[1]; d.institution = pick(colleges);
      var y = d.qual === quals[1] ? (R() < .1 ? 2027 : 2026) : 2020 + Math.floor(R() * 6);
      d.completion = (d.qual === quals[1] ? (y === 2027 ? '2027-03-31' : (R() < .5 ? '2026-12-15' : '2026-05-30')) : y + '-05-' + ('0' + (10 + Math.floor(R() * 18))).slice(-2));
      if (d.qual === quals[0] && d.completion > '2026-09-30') d.completion = '2026-05-20';
      d.motivation = pick(why); d.cv = R() < .93 ? 'https://drive.google.com/file/d/DEMO' + i + '/view' : ''; d.cvFileId = d.cv ? 'DEMO' + i : '';
      d.id = I.nextId_(rows); d.submittedAt = iso(now - (20 - Math.floor(i / 6)) * 864e5 - Math.floor(R() * 8.64e7)); d.status = 'Received'; d.emailVerified = 'Yes';
      I.recomputeDerived_(d, s); I.applyScreening_(d, I.screen_(d, rows, s));
      d.updatedAt = d.submittedAt; d.updatedBy = 'Applicant'; rows.push(d);
    }
    // management data for the demo: scores, shortlist, sessions, a few decisions
    var ok = rows.filter(function (d) { return d.screening !== 'Suggest Disqualify'; });
    ok.forEach(function (d, i) { if (i < 90) d.screenScore = String(Math.round((55 + R() * 40) * 2) / 2); });
    ok.filter(function (d) { return d.screenScore !== undefined; }).sort(function (a, b) { return b.screenScore - a.screenScore; }).slice(0, 30).forEach(function (d, i) {
      d.shortlisted = 'Yes'; d.status = 'Shortlisted'; d.session = i < 15 ? sessions[0].id : sessions[1].id;
      if (i < 12) { d.attendance = 'Present'; d.reportingTime = '09:' + ('0' + (10 + i)).slice(-2); d.interviewScore = String(Math.round((50 + R() * 45) * 2) / 2); d.callStatus = 'Confirmed'; }
    });
    rows.filter(function (d) { return d.interviewScore; }).sort(function (a, b) { return b.interviewScore - a.interviewScore; }).slice(0, 5).forEach(function (d, i) { d.status = i < 3 ? 'Confirmed' : 'Selected'; if (i < 3) d.docCert = 'Verified'; });
    ok[3].flagged = 'Yes'; ok[3].flagNote = 'Name differs between CV and certificate';
    rows.forEach(function (d) { I.appendRow_(sh, I.FIELDS, d); });
    I.audit_('System', 'DEMO', '', 'Demo data loaded');
  }
  w.seedDemo = seedDemo;
})(window);
