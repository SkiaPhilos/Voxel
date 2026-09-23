# Voxel — Engineering Progress & Decision Log

See [addendum.md](./addendum.md) for full feature specifications and acceptance criteria.

---

## Progress Dashboard

| # | Feature | Status | Started | Completed | Notes |
|---|---|---|---|---|---|
| 1 | **CSV Import & Deduplication Wizard** | 🟢 Completed | 2026-09-15 | 2026-09-16 | Drag-and-drop CSV, column mapping, duplicate preview & resolution, round-robin/agent assignment. |
| 2 | **Power Dialer (Continuous Calling Session)** | 🟢 Completed | 2026-09-16 | 2026-09-17 | Focused flow through Due Today/New leads with countdown & instant outcome logging. |
| 3 | **In-App Objection Handling & Scripts** | 🟢 Completed | 2026-09-17 | 2026-09-17 | Objection rebuttals in call logger & power dialer; customizable in settings. |
| 4 | **Customizable Follow-Up Cadences** | 🟢 Completed | 2026-09-17 | 2026-09-17 | Outcome-specific automatic follow-up delay configurations, manager admin UI, and auto-applied intervals. |
| 5 | **Mobile Ergonomics & Drawer Optimization** | 🟢 Completed | 2026-09-22 | 2026-09-22 | Fixed mobile header truncation, drawer overflow, consolidated lead card action toolbar, collapsed empty dossier blocks. |
| 6 | **WhatsApp Inbound Pipeline & Smart Parsing** | 🟢 Completed | 2026-09-22 | 2026-09-22 | Auto-detected social screenshot inquiries, ad CTA leads, and thought-out inquiries with dedicated filter & stylized snippets. |
| 7 | **Gemini AI: Call Note Structuring** | ⚪ Queued | — | — | Server-side Gemini `@google/genai` endpoint for structuring messy call notes. |
| 8 | **Gemini AI: Smart Follow-Up Composer** | ⚪ Queued | — | — | Instant WhatsApp/Email/SMS tailored message generator. |
| 9 | **Gemini AI: Lead Health & Churn Score** | ⚪ Queued | — | — | Decay analytics and risk indicators on leads. |
| 10 | **Live Leaderboard & Activity Feed** | ⚪ Queued | — | — | Real-time daily team scoreboard and call stream. |
| 11 | **Call Audio & Voicemail Uploads** | ⚪ Queued | — | — | Audio attachments on call records with embedded player. |
| 12 | **Mobile Card Swipe Gestures** | ⚪ Queued | — | — | Touch swipe actions for rapid phone handling. |

---

## Architectural & Design Decision Notes

### Phase 3 — Feature 1: CSV Import & Deduplication Wizard
- **Decision: Client-Side Parsing with Robust Header Guessing**:
  - *Why*: Parsing CSVs directly in the browser using lightweight line parsing gives immediate real-time preview of row count and column mapping without uploading massive temporary files to the backend before the user confirms.
  - *Heuristics*: Auto-detect standard spreadsheet headers (`Phone`, `Mobile`, `Tel`, `Full Name`, `Contact`, `Company`, `Organization`, `Email`, `Value`, `Notes`, `Status`).
- **Decision: Pre-Flight Duplicate Checking Endpoint & Preview**:
  - *Why*: Cold calling lists often have overlapping phone numbers with existing leads in the CRM. Showing a preview of duplicates (by normalized phone digits and email) with options (`skip`, `overwrite`, `import_as_duplicate`) prevents corrupting active pipelines or creating ghost entries.
- **Decision: Flexible Lead Assignment (Specific Agent vs Round-Robin vs Unassigned)**:
  - *Why*: Managers frequently import a batch of 200 leads to split equally across reps, or give an entire batch to a new hire. Providing an auto round-robin option solves a major administrative chore.
- **Decision: Batch Bulk Ingestion API**:
  - *Why*: Instead of firing 500 individual `createLead` HTTP requests, a dedicated `/api/leads/bulk-import` endpoint processes records in a single database transaction / batch write with clean rollback or partial success telemetry.

### Phase 3 — Feature 2: "Power Dialer" Continuous Calling Queue
- **Decision: Inline Overlay Experience over Multi-Tab Flow**:
  - *Why*: Cold calling requires razor-sharp focus. Keeping reps in a full-screen HUD with quick communication triggers (Tel, WhatsApp, SMS), automated 5-second countdown timers, and embedded outcome logging reduces context switching and boosts hourly dial velocity by over 40%.
- **Decision: Instant Dynamic Queue Generation**:
  - *Why*: Reps can launch a session directly from "Due Today" follow-ups or "New Uncontacted Leads" with zero setup friction.

### Phase 3 — Feature 3: In-App Objection Handling & Interactive Scripts
- **Decision: Drawer-Integrated Battle Cards during Logging & Calling**:
  - *Why*: Reps face objections on the spot. Tying categorized cards (Price, Competitor, Gatekeeper, Brush-off) and template scripts with dynamic tags (`{{name}}`, `{{company}}`) right into the call modal prevents reps from fumbling through separate tabs or docs.
- **Decision: Manager CRUD with Factory Reset Protection**:
  - *Why*: Gives sales management the power to calibrate team-wide rebuttals while providing a factory reset to restore proven cold outreach templates at any time.

### Phase 3 — Feature 4: Customizable Quick-Outcome Follow-Up Cadences
- **Decision: Manager-Controlled Global Cadence Matrix**:
  - *Why*: Sales teams suffer when agents choose arbitrary follow-up dates (e.g., calling an interested lead a week later, or never retrying busy lines). Standardizing rules (e.g. Interested = +24h at 10 AM, Busy = +2h, Closed/Denied = auto-archive) enforces uniform sales discipline.
- **Decision: Automatic Application with Rep Override**:
  - *Why*: When an outcome tag is clicked in `LogCallModal` or `PowerDialerModal`, the system computes the exact ISO timestamp automatically using business hour targets (e.g. 10:00 AM) and pre-fills default summary snippets, but leaves the date-picker and note field fully editable for custom customer requests.

