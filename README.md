# WHISTLE 2026 – Digital Scoring & Live Dashboard

A Google Sheets + Apps Script backend with web pages hosted on Cloudflare Pages:

| Part | URL | Who |
|---|---|---|
| **Live Dashboard** | `https://<your-site>/` | TV / projector |
| **Score Admin portal** | `https://<your-site>/admin` | Officials (PIN protected) |
| **Poster & Reports** | `https://<your-site>/share.html` | Officials / social media team |
| API (Apps Script) | `https://script.google.com/macros/s/…/exec` | used by the pages only |

It reads the existing **Registrations** tab and never writes to it. It keeps its own tabs:

| Tab | Purpose |
|---|---|
| `Score_Events` | Event catalogue (Section + Event), built automatically from Registrations. You can edit `Order` to change the display order, or rename an event without losing its scores. |
| `Scores` | **One row per awarded position.** House totals are always calculated from this tab, so no cumulative numbers are stored anywhere. Deleted rows stay here with `Status = DELETED`. |
| `Score_Audit` | Every create / update / delete / restore / event change and every manual edit to the score tabs, with previous and new values, the user and the time. |

## Files

```
apps-script/         → pasted into Google Apps Script (the backend / API)
  Code.gs
  appsscript.json
web/                 → hosted on Cloudflare Pages (build output directory)
  index.html         TV dashboard
  admin.html         officials' portal
  share.html         Poster & Reports (self-contained module, see below)
  config.js          ← the Apps Script /exec URL goes here
  _headers           noindex + no-cache headers
preview/             local test harness only
```

## Deploy

### Part A – Apps Script backend (Google)
1. <https://script.google.com> → **New project** → name it *WHISTLE Scoring*. (A standalone project keeps the registration system's own script untouched.)
2. Replace `Code.gs` with `apps-script/Code.gs`. ⚙ Project Settings → tick *Show "appsscript.json" manifest file* → paste `apps-script/appsscript.json`.
3. ⚙ Project Settings → **Script Properties** → add `SPREADSHEET_ID` = the part of the registration sheet URL between `/d/` and `/edit`.
4. Select **`setup`** → **Run** → approve the permissions. The execution log shows the **admin PIN** (change it under Script Properties → `ADMIN_PIN`).
5. Select **`installSheetEditAudit`** → **Run** (audits manual edits to the score tabs).
6. **Deploy → New deployment** → ⚙ type **Web app** → Execute as **Me**, Who has access **Anyone** → **Deploy** → copy the URL ending in `/exec`.

### Part B – GitHub
7. Put the `/exec` URL into `web/config.js`, then commit and push the project to your GitHub repo.

### Part C – Cloudflare Pages
8. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git** → pick the repo.
9. Build settings: Framework preset **None**, Build command **empty**, Build output directory **`web`** → **Save and Deploy**.
10. You get `https://<project>.pages.dev` (dashboard) and `https://<project>.pages.dev/admin` (portal).

### Part D – make it private (Cloudflare Access)
11. **Zero Trust → Access → Applications → Add → Self-hosted**. Domain: `<project>.pages.dev` (leave the path blank to protect everything, or `admin` to protect only the portal). Session duration: e.g. 1 month.
12. Add a policy: Action **Allow**, Include **Emails** → the officials' / organisers' emails (login method: One-time PIN by email).
13. Pages project → Settings → **Enable access policy** for preview deployments too.

**Updating later:** web changes → push to GitHub (Cloudflare redeploys automatically). `Code.gs` changes → paste in Apps Script → Deploy → *Manage deployments* → ✎ → *New version* (URL stays the same, so `config.js` doesn't change).

> The `/exec` API URL itself is not behind Cloudflare Access. Reads are harmless; every write needs the admin PIN. Never commit the PIN to GitHub.

### Recommended sheet protection
Protect the `Scores`, `Score_Events` and `Score_Audit` tabs (Data → Protect sheets and ranges) so only the organisers can edit them by hand. All normal corrections should go through the portal.

## Using it

**Officials:** Section → Event → tap a house for each position → **Save**.
- 1st / 2nd / 3rd are pre-filled with 5 / 3 / 1 points. Points can be changed with − / + or by typing.
- **+ ADD POSITION** adds more rows (4th, 5th …). You can also set a row's position to *3rd* again for a tie; the points follow the position unless you edited them.
- The same house can take more than one position (e.g. 1st and 2nd).
- Events that already have a result show *✓ Declared*. Saving again asks you to **Replace** (the old rows are soft-deleted) or **Add** to them.
- **Results** tab: search, filter by section / event / house / status, and **Edit**, **Delete** (with a reason, optionally the whole declaration) or **Restore**.
- **Audit Trail** tab: the full change history. **Events** tab: sync new events from registrations, add a manual event, or hide/show events.

**Dashboard:** open the URL on the TV, then press **F** or double-click for full screen. No further interaction is needed:
- It refreshes every 15 s. If a refresh fails it keeps showing the last data, the status pill shows *RECONNECTING* / *OFFLINE*, and it retries on its own.
- It rotates Main scoreboard → Latest → Section championship → Main → Race → Medals → Main → Live updates → Progress → Main → House performance → Participation. The main scoreboard appears every 2–3 screens.
- A newly declared result takes over the screen as **NEW RESULT** for 15 s, then the rotation returns to the main scoreboard.
- Sections with many events are split into several cards automatically, and pages flip every 10 s.
- Optional keys: → next screen, ← main scoreboard, **P** pause, **F** full screen.

Timings, the rotation order and the points scheme are at the top of `web/index.html` (`CFG`) and `Code.gs` (`CONFIG`).

**Poster & Reports (`web/share.html`):** a self-contained module, linked from the admin portal's top bar (*Poster & Reports ↗*), that turns the live scoreboard data into shareable output. It reads the same public `getDashboardData` endpoint the TV dashboard uses (no PIN needed, no writes), so it is always in sync with whatever has been declared — nothing here is typed in by hand.
- **Content basis:** choose what the poster/text is about — the latest declared result (auto-updates), a specific event, overall house standings, one section's championship, or a progress/race update. Each basis computes a "trigger" headline (who's leading, by how much, or how many points are still up for grabs).
- **Poster Card:** a 1080×1350 canvas-rendered poster (crest, event branding, ranked house/points list, highlight banner, updated timestamp, social icons) — **Download poster (PNG)** saves it, no server round-trip.
- **WhatsApp Text:** the same content as ready-to-send WhatsApp-formatted text (bold/italic, medal emoji, hashtags, updated time, social handles) with a **Copy text** button. Send it together with the downloaded poster.
- **PDF Report:** a full consolidated report (overall standings, every section's results table, participation summary) opened as a print-ready page — use the browser's **Save as PDF** in the print dialog. No PDF library is used, so it works offline.
- **Branding tab:** institution name, tagline, logo (defaults to `web/logo.png`, or upload your own), poster colours and social links (Facebook/Instagram/WhatsApp/LinkedIn). This is saved in that browser's `localStorage` only — set it once per device used for exporting.

## Registration data assumptions

Columns are matched by header name, and case or punctuation doesn't matter: `Section`, `House`, `Events`, `Class`, `Name`.
`Events` may list several items separated by `,` `;` `|` or new lines. House values like `Red House` are treated as `RED`.
Houses are taken from the registrations. To force a list, set Script Property `HOUSES` = `RED,BLUE,GREEN,YELLOW`.

## Test locally without Google

```bash
python -m http.server 8765
```

Then open <http://localhost:8765/preview/>. The harness runs the real `Code.gs` in the browser against demo data: 420 athletes, 48 events, about 65% declared.
Admin portal: <http://localhost:8765/preview/admin.html> (PIN **1234**). The top bar has buttons to simulate a new result, a network failure, or to reset the data.
Poster & Reports: <http://localhost:8765/preview/share.html> (no PIN — it only reads the public dashboard feed).
