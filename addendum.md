# Voxel — Feature Addendum & Roadmap Specification

This document details the roadmap features planned for Voxel, their scope, user experience requirements, and integration details.

For active execution status, completed milestones, and engineering decision notes, refer to [progress.md](./progress.md).

---

## Roadmap Features

### 1. CSV Import & Deduplication Wizard (High Priority)
- **Goal**: Enable managers and admins (and optionally agents for their own leads) to bulk import cold-calling prospect lists from spreadsheets with zero data corruption.
- **Key Capabilities**:
  - Drag-and-drop CSV / TSV file upload with client-side parsing.
  - Interactive column mapping (Name, Phone, Email, Company, Source, Deal Value, Notes/Tags).
  - Pre-import validation & deduplication preview against existing phone numbers and emails in the database (Skip, Overwrite, or Import as Duplicate).
  - Bulk assignment picker (assign to a specific agent, distribute round-robin across active team members, or leave unassigned).
  - Instant progress bar and summary report (created, skipped, duplicates caught).

---

### 2. "Power Dialer" / Continuous Calling Queue
- **Goal**: Eliminate downtime between dials by creating a focused, high-speed calling flow.
- **Key Capabilities**:
  - "Start Calling Session" button in Due Today and Active Pipeline views.
  - Heads-up calling overlay showing current prospect, one-click tel / WhatsApp / SMS triggers, lead history, and script notes.
  - Built-in call outcome logger right in the dialer overlay.
  - Configurable auto-advance countdown (e.g. 5s delay or manual "Next Lead" click).
  - Session stats banner (Calls completed, connects, voicemails, appointments booked).

---

### 3. In-App Objection Handling & Interactive Call Scripts
- **Goal**: Assist reps during live calls with battle-tested talking points and objection counters.
- **Key Capabilities**:
  - Slide-out drawer / expandable panel integrated directly into `LogCallModal` and the Power Dialer.
  - Categorized objection battle cards (e.g., "Price too high", "Already with competitor", "Send email / not interested", "Gatekeeper brush-off").
  - Customizable script templates with dynamic lead variable interpolation (`{{name}}`, `{{company}}`).
  - Admin/Manager ability to manage and update objection cards in Admin Settings.

---

### 4. Customizable Quick-Outcome Follow-Up Cadences
- **Goal**: Standardize next-action intervals based on call outcomes.
- **Key Capabilities**:
  - Manager-configurable follow-up defaults per outcome tag (e.g. Voicemail ➔ +48h, Interested ➔ +24h, Gatekeeper ➔ +4h).
  - When reps select an outcome tag, the follow-up picker automatically pre-populates with the optimal calculated timestamp while allowing manual overrides.

---

### 5. Gemini AI: Call Note Structuring & Next-Step Extraction
- **Goal**: Convert rapid, shorthand agent notes into structured CRM summaries with extracted action items.
- **Key Capabilities**:
  - Server-side Gemini API route (`/api/ai/enhance-call-notes`) using `@google/genai`.
  - Analyzes messy raw input into: Core Takeaways, Customer Sentiment, Pain Points, and Recommended Next Actions.
  - Seamless "Enhance with AI" button inside call logging modals.

---

### 6. Gemini AI: Smart Contextual Message Composer
- **Goal**: Generate high-converting follow-up messages for WhatsApp, SMS, and Email in 1 click.
- **Key Capabilities**:
  - Generates tailored messages based on the lead's company, industry, previous call history, and selected outcome tag.
  - One-click copy or direct launch into `wa.me`, `mailto:`, or `sms:`.

---

### 7. Gemini AI: Lead Health & Churn Risk Scoring
- **Goal**: Identify leads at risk of going cold before they drop off.
- **Key Capabilities**:
  - Algorithmic + AI assessment based on days since contact, call velocity, outcome trends, and sentiment.
  - Visual health badges (Hot, Warm, Cooling, At-Risk) with AI explanation tooltip.

---

### 8. Live Daily Sales Leaderboard & Activity Feed
- **Goal**: Motivate sales teams with real-time recognition.
- **Key Capabilities**:
  - Live metric trackers: Dials Made, Connects, Deals Closed, Directives Resolved.
  - Real-time activity ticker of calls logged across the team.

---

### 9. Voicemail & Call Audio Recording Attachments
- **Goal**: Enable training, compliance, and quality assurance.
- **Key Capabilities**:
  - Upload or record audio snippets directly linked to specific call log entries.
  - Embedded audio player with playback speed controls in the Lead Detail Drawer.

---

### 10. Mobile Card Gestures & Touch Optimization
- **Goal**: Enable effortless one-handed lead management on phones.
- **Key Capabilities**:
  - Swipe right on a lead card to quick-log / call.
  - Swipe left to reschedule or postpone follow-up.
