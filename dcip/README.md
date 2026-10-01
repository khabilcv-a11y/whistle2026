# DCIP 34th Batch – Registration & Selection System

Public registration form + admin portal. **Google Sheets** is the database, **Apps Script** is the API, **Cloudflare Pages** hosts the pages, **Google Drive** holds the CVs, **GitHub** holds the code.

| Page | URL | Who |
|---|---|---|
| Registration form | `https://<site>/` | public |
| Admin portal | `https://<site>/admin.html` | officials (name + PIN) |

> **Why CVs are not in GitHub:** CVs contain personal data. A GitHub repo (even private) is the wrong place for them and Apps Script cannot write to it safely. CVs are saved to a private Drive folder created automatically; the sheet stores the link. GitHub holds only this code.

## What it does
- **Form**: all 19 columns of the 33rd-batch sheet. Live age/eligibility feedback, e-mail OTP verification, CV upload (PDF/DOC/DOCX ≤ 3 MB), draft kept in the browser, spam honeypot.
- **Screening rules** (Settings tab / `Settings` sheet):
  - Age ≤ `MAX_AGE` (30) on `AGE_AS_ON` (default = `INTAKE_START`).
  - UG completion date ≤ `INTAKE_END`. Later → cannot submit (`ENFORCE_COMPLETION=BLOCK`) or accepted but marked **Suggest Disqualify** (`FLAG`). Same switch for age (`ENFORCE_AGE`).
  - Also flagged for review: completed-but-future date, stale "results pending", duplicate mobile / name+DOB, missing CV.
- **Confirmation e-mail** with every detail received and a note that all further communication is through this address (resend any time).
- **Admin**: live insights (all applications / shortlisted / selected-confirmed: district, gender, education, age, college, stream, subject, LSGD within Kozhikode, funnel, per-day trend); applications table with search, filters, bulk actions, flag, status; screening queue; screen scores → **shortlist top 30** (tie warning); sessions + auto-assign; **score sheet, attendance, call chart, document verification** per session; selection by interview rank; bulk e-mail with templates; settings; audit trail. Everything downloads as **Excel or PDF**.
- Status flow: Received → Shortlisted → Selected → Confirmed (also Waitlisted, Not Selected, Disqualified, Withdrawn). The portal polls every 6 s and updates when anything changes.

## Deploy
1. **Sheet**: create an empty Google Sheet; copy its ID (between `/d/` and `/edit`).
2. **Apps Script**: script.google.com → New project. Paste `apps-script/Code.gs`; enable the manifest and paste `apps-script/appsscript.json`. Project Settings → Script Properties → `SPREADSHEET_ID`.
3. Run **`setup`** (approve Sheets, Drive and Mail permissions). The log shows the **admin PIN**; it creates the tabs and the CV folder.
4. **Deploy → New deployment → Web app**, Execute as *Me*, access *Anyone* → copy the `/exec` URL into `web/config.js`.
5. Push to GitHub. Cloudflare → Workers & Pages → Connect to Git → framework *None*, no build command, output directory **`web`**.
6. Recommended: protect `/admin*` with Cloudflare Access (Zero Trust → Access → Self-hosted → emails). Share the CV Drive folder with the officials who need to open CVs.
7. Code changes later: paste `Code.gs` → Deploy → Manage deployments → New version (URL unchanged).

## Things to know
- **Mail quota**: each application sends 2 e-mails (OTP + confirmation). Consumer Gmail allows ~100/day (≈50 applications/day); Google Workspace ~1,500/day. Run the script from a Workspace account if you expect more. The portal shows the remaining quota.
- **Dates assumed**: intake **1 Nov 2026 – 31 Jan 2027** (Settings → `INTAKE_START/END`). Age is counted on 1 Nov 2026.
- Highest-qualification options are the three used last year; the completion rule is applied to the **UG completion date**.
- Malayalam text is not rendered in PDFs (shows `?`); Excel is fine.
- Dropping a crest at `web/logo.png` shows it on the form.

## Local preview / tests
```bash
python3 -m http.server 8765      # from this folder
# form:  http://localhost:8765/preview/index.html?p=index.html     (OTP appears in the "inbox" at bottom-left)
# admin: http://localhost:8765/preview/index.html?p=admin.html     (PIN 1234, 120 demo applications)
node preview/test.js             # backend tests against a mock of the Google services
```
