// Node tests for apps-script/Code.gs against the mock Apps Script services.   Run: node preview/test.js
const vm = require('vm'), fs = require('fs'), path = require('path'), assert = require('assert');
const { createGasEnv } = require('./mock-gas.js');

let clock = Date.parse('2026-10-05T12:00:00+05:30');
const env = createGasEnv({ now: () => clock });
class D extends Date { constructor(...a) { a.length ? super(...a) : super(clock); } static now() { return clock; } }
const ctx = vm.createContext(Object.assign({ Date: D, console }, env.globals));
vm.runInContext(fs.readFileSync(path.join(__dirname, '../apps-script/Code.gs'), 'utf8'), ctx);
vm.runInContext('setup()', ctx);
const pin = env.store.props.ADMIN_PIN;

const call = (fn, ...args) => {
  const out = JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify({ fn, args }) } }).getContent());
  if (!out.ok) throw new Error(out.error);
  return out.result;
};
const fails = (fn, re, ...args) => { try { call(fn, ...args); } catch (e) { assert.match(e.message, re, fn + ': ' + e.message); return; } assert.fail(fn + ' should have failed'); };
const lastMail = () => env.store.mails[env.store.mails.length - 1];
let n = 0;
const base = (o = {}) => Object.assign({
  fullName: 'Asha Menon', dob: '2002-04-10', gender: 'Female', email: 'asha@example.com', mobile: '98470 12345', altMobile: '',
  district: 'Kozhikode', localBody: 'Kozhikode Corporation', qual: "Bachelor's Degree (completed)", stream: 'B.A',
  specialisation: 'Political Science', institution: 'Devagiri College', completion: '2025-05-20',
  motivation: 'I want to understand how district administration works on the ground.',
  cv: { name: 'cv.pdf', data: Buffer.from('%PDF-1.4 test').toString('base64') }
}, o);
function verifiedSubmit(over) { return call('submitApplication', base(over)); }
const test = (name, fn) => { fn(); n++; console.log('  ✓ ' + name); };

test('public config exposes the rules', () => {
  const c = JSON.parse(ctx.doGet({ parameter: { api: 'config' } }).getContent()).result;
  assert.equal(c.open, true); assert.equal(c.maxAge, 30); assert.equal(c.intakeEnd, '2027-01-31'); assert.equal(c.ageAsOn, '2026-11-01');
});

test('valid application is stored, CV saved to Drive, confirmation e-mail sent', () => {
  const r = verifiedSubmit();
  assert.equal(r.id, 'DCIP34-0001'); assert.equal(r.mailed, true);
  const mail = lastMail();
  assert.equal(mail.to, 'asha@example.com'); assert.match(mail.subject, /Application received – DCIP34-0001/);
  assert.match(mail.html, /9847012345/); assert.match(mail.html, /All further communication/);
  assert.equal(Object.keys(env.store.files).length, 1);
  const st = call('adminLogin', 'Tester', pin);
  const s = call('getAdminState', st.token);
  const a = s.applications[0];
  assert.equal(a.age, 24); assert.equal(a.screening, 'Eligible'); assert.equal(a.status, 'Received'); assert.equal(a.mobile, '9847012345');
  assert.equal(a.location, 'Kozhikode, Kozhikode Corporation'); assert.ok(a.cv.includes('drive.google.com')); assert.equal(a.cvFileId, undefined);
});

test('duplicate e-mail refused', () => fails('submitApplication', /already been received/, base()));

test('age limit: 30 on 1 Nov 2026 is OK, 31 is refused', () => {
  verifiedSubmit({ email: 'a30@example.com', mobile: '9000000030', dob: '1996-11-01', fullName: 'Thirty Year' });      // turns 30 on the reference date
  const p = base({ email: 'a31@example.com', mobile: '9000000031', dob: '1995-10-31', fullName: 'Thirtyone Year' });     // turned 31 the day before
  fails('submitApplication', /limit is 30/, p);
});

test('UG completion after the internship period is refused; inside the period is allowed and noted', () => {
  const late = base({ email: 'late@example.com', mobile: '9000000041', fullName: 'Late Finisher', qual: "Bachelor's Degree (final year – results pending)", completion: '2027-03-31' });
  fails('submitApplication', /after the internship period/, late);
  verifiedSubmit({ email: 'ok@example.com', mobile: '9000000042', fullName: 'Final Year', qual: "Bachelor's Degree (final year – results pending)", completion: '2026-12-15' });
  const a = call('getAdminState', call('adminLogin', 'T', pin).token).applications.find(x => x.email === 'ok@example.com');
  assert.equal(a.screening, 'Eligible'); assert.match(a.screeningNotes, /during the internship period/);
});

test('FLAG mode accepts but marks Suggest Disqualify; rescreen applies new rules to old rows', () => {
  const tok = call('adminLogin', 'T', pin).token;
  call('saveSettings', tok, { ENFORCE_AGE: 'FLAG' });
  verifiedSubmit({ email: 'old@example.com', mobile: '9000000051', fullName: 'Older Person', dob: '1990-01-01' });
  let s = call('getAdminState', tok);
  const old = s.applications.find(x => x.email === 'old@example.com');
  assert.equal(old.screening, 'Suggest Disqualify'); assert.match(old.screeningNotes, /limit is 30/);
  call('saveSettings', tok, { ENFORCE_AGE: 'BLOCK', MAX_AGE: '37' });
  const r = call('rescreenAll', tok);
  assert.ok(r.changed >= 1);
  assert.equal(call('getAdminState', tok).applications.find(x => x.email === 'old@example.com').screening, 'Eligible');
  call('saveSettings', tok, { MAX_AGE: '30' }); call('rescreenAll', tok);
});

test('duplicate mobile is flagged for review', () => {
  verifiedSubmit({ email: 'dup@example.com', mobile: '9847012345', fullName: 'Another Person' });
  const a = call('getAdminState', call('adminLogin', 'T', pin).token).applications.find(x => x.email === 'dup@example.com');
  assert.equal(a.screening, 'Review'); assert.match(a.screeningNotes, /also used by DCIP34-0001/);
});

test('CV rules: required, type and size', () => {
  const p = base({ email: 'nocv@example.com', mobile: '9000000061', fullName: 'No Cv', cv: null });
  fails('submitApplication', /upload your CV/, p);
  p.cv = { name: 'cv.exe', data: 'AAAA' }; fails('submitApplication', /PDF, DOC or DOCX/, p);
  p.cv = { name: 'cv.pdf', data: 'A'.repeat(5 * 1024 * 1024) }; fails('submitApplication', /larger than/, p);
});

test('admin: login, bad PIN, expired/forged token', () => {
  fails('adminLogin', /Incorrect PIN/, 'x', '000');
  fails('getAdminState', /SESSION_EXPIRED/, 'forged.token');
  const tok = call('adminLogin', 'Tester', pin).token;
  clock += 13 * 3600 * 1000;
  fails('getAdminState', /SESSION_EXPIRED/, tok);
  clock -= 13 * 3600 * 1000;
});

test('admin: score, shortlist top N, status, flag, audit', () => {
  const tok = call('adminLogin', 'Meera', pin).token;
  const apps = call('getAdminState', tok).applications;
  apps.forEach((a, i) => call('updateApplications', tok, [a.id], { screenScore: String(90 - i * 5) }));
  const r = call('shortlistTop', tok, 3);
  assert.equal(r.shortlisted, 3); assert.equal(r.cutoffScore, 80);
  const s = call('getAdminState', tok).applications;
  assert.equal(s.filter(a => a.shortlisted === 'Yes').length, 3);
  assert.equal(s.filter(a => a.status === 'Shortlisted').length, 3);
  call('updateApplications', tok, [apps[0].id], { flagged: true, flagNote: 'Check CV' });
  call('updateApplications', tok, [apps[0].id], { status: 'Selected' });
  const a0 = call('getAdminState', tok).applications.find(a => a.id === apps[0].id);
  assert.equal(a0.flagged, 'Yes'); assert.equal(a0.status, 'Selected'); assert.equal(a0.shortlisted, 'Yes'); assert.equal(a0.updatedBy, 'Meera');
  fails('updateApplications', /not editable/, tok, [apps[0].id], { id: 'X' });
  fails('updateApplications', /Unknown status/, tok, [apps[0].id], { status: 'Winner' });
  const audit = call('getAudit', tok);
  assert.ok(audit.some(x => x.action === 'UPDATE' && /Selection status: Shortlisted → Selected/.test(x.details) && x.user === 'Meera'));
});

test('admin: sessions, assignment, rename keeps attendees, delete guarded', () => {
  const tok = call('adminLogin', 'T', pin).token;
  call('saveSession', tok, { date: '2026-11-20', slot: 'Forenoon', venue: 'Collectorate', interviewer: 'Panel A', capacity: 25 });
  const ids = call('getAdminState', tok).applications.slice(0, 2).map(a => a.id);
  call('assignSessions', tok, { [ids[0]]: '2026-11-20 Forenoon', [ids[1]]: '2026-11-20 Forenoon' });
  fails('assignSessions', /Unknown session/, tok, { [ids[0]]: 'nope' });
  fails('deleteSession', /assigned/, tok, '2026-11-20 Forenoon');
  call('saveSession', tok, { originalId: '2026-11-20 Forenoon', date: '2026-11-21', slot: 'Afternoon', venue: 'Collectorate' });
  const st = call('getAdminState', tok);
  assert.equal(st.sessions.length, 1); assert.equal(st.applications.filter(a => a.session === '2026-11-21 Afternoon').length, 2);
  call('assignSessions', tok, { [ids[0]]: '', [ids[1]]: '' });
  call('deleteSession', tok, '2026-11-21 Afternoon');
});

test('admin: bulk e-mail with placeholders and quota', () => {
  const tok = call('adminLogin', 'T', pin).token;
  call('saveSession', tok, { date: '2026-11-22', slot: 'Forenoon', venue: 'Hall 2' });
  const a = call('getAdminState', tok).applications[0];
  call('assignSessions', tok, { [a.id]: '2026-11-22 Forenoon' });
  const before = env.store.mails.length;
  const r = call('sendEmails', tok, [a.id], 'Interview – {{id}}', 'Dear {{name}},\n\nYour interview: {{session}} at {{venue}}.');
  assert.equal(r.sent, 1); assert.equal(env.store.mails.length, before + 1);
  assert.match(lastMail().subject, /Interview – DCIP34-0001/); assert.match(lastMail().text, /2026-11-22 Forenoon at Hall 2/);
});

test('settings: validation and registration close/deadline', () => {
  const tok = call('adminLogin', 'T', pin).token;
  fails('saveSettings', /number/, tok, { MAX_AGE: 'abc' });
  fails('saveSettings', /BLOCK or FLAG/, tok, { ENFORCE_AGE: 'MAYBE' });
  call('saveSettings', tok, { REG_DEADLINE: '2026-10-05T11:00' });
  fails('submitApplication', /closed/, base({ email: 'closed@example.com' }));
  call('saveSettings', tok, { REG_DEADLINE: '', REG_OPEN: 'FALSE' });
  fails('submitApplication', /closed/, base({ email: 'closed@example.com' }));
  call('saveSettings', tok, { REG_OPEN: 'TRUE' });
});

test('admin can clear a screening flag; rescreen respects it', () => {
  const tok = call('adminLogin', 'T', pin).token;
  const a = call('getAdminState', tok).applications.find(x => x.screening === 'Review');
  call('updateApplications', tok, [a.id], { screening: 'Cleared' });
  call('rescreenAll', tok);
  assert.equal(call('getAdminState', tok).applications.find(x => x.id === a.id).screening, 'Cleared');
  fails('updateApplications', /valid screening/, tok, [a.id], { screening: 'Great' });
});

test('ping stamp changes on write', () => {
  const tok = call('adminLogin', 'T', pin).token;
  const a = call('ping', tok).stamp; clock += 5; 
  call('updateApplications', tok, [call('getAdminState', tok).applications[1].id], { remarks: 'x' + clock });
  assert.notEqual(call('ping', tok).stamp, a);
});

console.log(`\n${n} tests passed`);
