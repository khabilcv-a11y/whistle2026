# DCIP 34th Batch – Registration & Selection System

Public registration form + admin portal. **Google Sheets** is the database, **Apps Script** is the API, **Cloudflare Pages** hosts the pages, **Google Drive** holds the CVs, **GitHub** holds the code.

| Page | URL | Who |
|---|---|---|
| Registration form | `https://<site>/` | public |
| Admin portal | `https://<site>/admin.html` | officials (name + PIN) |

> **Why CVs are not in GitHub:** CVs contain personal data. A GitHub repo (even private) is the wrong place for them and Apps Script cannot write to it safely. CVs are saved to a private Drive folder created automatically; the sheet stores the link. GitHub holds only this code.

## What it does
- **Form**: all 19 columns of the 33rd-batch sheet. Live age/eligibility feedback, CV upload (PDF/DOC/DOCX ≤ 3 MB), draft kept in the browser, spam honeypot.
- **Screening rules** (Settings tab / `Settings` sheet):
  - Age ≤ `MAX_AGE` (30) on `AGE_AS_ON` (default = `INTAKE_START`).
  - UG completion date ≤ `INTAKE_END`. Later → cannot submit (`ENFORCE_COMPLETION=BLOCK`) or accepted but marked **Suggest Disqualify** (`FLAG`). Same switch for age (`ENFORCE_AGE`).
  - Also flagged for review: completed-but-future date, stale "results pending", duplicate mobile / name+DOB, missing CV.
- **Confirmation e-mail** with every detail received and a note that all further communication is through this address (resend any time).
- **Admin**: live insights (all applications / shortlisted / selected-confirmed: district, gender, education, age, college, stream, subject, LSGD within Kozhikode, funnel, per-day trend); applications table with search, filters, bulk actions, flag, status; screening queue; screen scores → **shortlist top 30** (tie warning); sessions + auto-assign; **score sheet, attendance, call chart, document verification** per session; selection by interview rank; bulk e-mail with templates; settings; audit trail. Everything downloads as **Excel or PDF**.
- Status flow: Received → Shortlisted → Selected → Confirmed (also Waitlisted, Not Selected, Disqualified, Withdrawn). The portal polls every 6 s and updates when anything changes.

## Sign-in, roles and logs
- Everyone signs in to `admin.html` with their **own username and password** (no shared PIN). Roles: **Admin** (applications, screening, shortlist, interviews, selection, reports, settings) and **Super admin** (all of that, plus **Users**, **Logs**, and **Chats**).
- Run `setup` once: the log prints the **super admin** login (`superadmin` + a random password). Change it under *My account*. Forgot it? Run `resetSuperAdminPassword` in the Apps Script editor.
- Super admins create, disable, delete and reset passwords for users (Users tab). Passwords are stored hashed (never in clear). 5 wrong passwords lock an account for 10 minutes. Disabling a user signs them out at once.
- **Logs** tab: activity (audit trail) and sign-in history, searchable, with Excel/PDF export. The same records live in the `Audit` and `Login_Log` sheet tabs.
- **Chats** tab: every chat helper conversation, the questions it could not answer, and transcripts. Super admins always see it; normal admins only if a super admin sets `ADMIN_CAN_VIEW_CHATS = TRUE` in Settings.

## CV auto-fill
Step 1 of the form asks for the CV. PDF and DOCX files are read **in the applicant's browser**; recognised details (name, e-mail, phone, date of birth, district, degree, subject, college…) are filled into the later steps, marked "✨ from your CV", and never overwrite what the applicant typed. If `GROQ_API_KEY` is set and `CV_AUTOFILL_AI = TRUE`, the CV *text* is also sent (through the script, never from the page) to Groq for a more accurate reading; it is not stored. Turn the AI part off in Settings. Scanned/image PDFs and old `.doc` files are attached but not read.

## Chat helper (FAQ bot)
A floating **"Have a question?"** button on the applicant page opens a chat with topic buttons → question buttons → answer → related questions. Typed questions are matched by keywords against the **FAQ** sheet tab (built from the DCIP FAQ document). Only when nothing matches does the server ask **Groq** (AI), which is told to answer from the FAQ only.
- **Edit the answers** any time in the `FAQ` tab (Topic, Question, Answer, Keywords, Related IDs). Changes show within ~5 minutes. Answers can use `{{BATCH}} {{INTAKE_START}} {{INTAKE_END}} {{MIN_AGE}} {{MAX_AGE}} {{AGE_AS_ON}} {{DEADLINE}} {{CONTACT}}` and `[[apply]]` (a "Start application" button).
- **Groq key**: Apps Script → Project Settings → Script Properties → add `GROQ_API_KEY`. *Never* put the key in a web page, `Code.gs` or GitHub. Optional `GROQ_MODEL` (default `llama-3.3-70b-versatile`). Without a key the bot still works from the FAQ and shows the contact details for anything else.
- Conversations are saved in the `Chat_Log` tab and shown in the admin **Chats** tab; use the unanswered questions to improve the FAQ.
- Limits: 20 AI answers/minute and 600/day across all visitors, to protect the key.

## Deploy
1. **Sheet**: create an empty Google Sheet; copy its ID (between `/d/` and `/edit`).
2. **Apps Script**: script.google.com → New project. Paste `apps-script/Code.gs`; enable the manifest and paste `apps-script/appsscript.json`. Project Settings → Script Properties → `SPREADSHEET_ID`.
3. Run **`setup`** (approve Sheets, Drive and Mail permissions). The log shows the **admin PIN**; it creates the tabs and the CV folder.
4. **Deploy → New deployment → Web app**, Execute as *Me*, access *Anyone* → copy the `/exec` URL into `web/config.js`.
5. Push to GitHub. Cloudflare → Workers & Pages → Connect to Git → framework *None*, no build command, output directory **`web`**.
6. Recommended: protect `/admin*` with Cloudflare Access (Zero Trust → Access → Self-hosted → emails). Share the CV Drive folder with the officials who need to open CVs.
7. Code changes later: paste `Code.gs` → Deploy → Manage deployments → New version (URL unchanged).

## Things to know
- **Mail quota**: each application sends 1 confirmation e-mail. Consumer Gmail allows ~100/day; Google Workspace ~1,500/day.
- **No e-mail verification**: a mistyped address means the confirmation never arrives; applicants are told to double-check it, and you can correct the address in the portal and resend. Run the script from a Workspace account if you expect more. The portal shows the remaining quota.
- **Dates assumed**: intake **1 Nov 2026 – 31 Jan 2027** (Settings → `INTAKE_START/END`). Age is counted on 1 Nov 2026.
- Highest-qualification options are the three used last year; the completion rule is applied to the **UG completion date**.
- Malayalam text is not rendered in PDFs (shows `?`); Excel is fine.
- Dropping a crest at `web/logo.png` shows it on the form.

## Local preview / tests
```bash
python3 -m http.server 8765      # from this folder
# form:  http://localhost:8765/preview/index.html?p=index.html    
# admin: http://localhost:8765/preview/index.html?p=admin.html     (PIN 1234, 120 demo applications)
node preview/test.js             # backend tests against a mock of the Google services
```
