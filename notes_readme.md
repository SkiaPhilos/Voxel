# Voxel — System Architecture & Build Notes

**Voxel** is a high-velocity, sales-focused CRM built for cold-calling teams, outbound sales representatives, and sales managers. It streamlines the outbound prospecting workflow by combining fast call logging, automated follow-up cadences, manager-to-agent sticky directives, and role-based pipeline oversight into a responsive, single-page application.

---

## 1. Core Purpose & Problem Space

Cold-calling and high-volume outbound sales often fail due to three main operational bottlenecks:
1. **Friction in Call Logging**: When reps must fill out lengthy, complex forms after every 30-second call, logging compliance plummets and lead data goes stale.
2. **Follow-Up Drop-Off**: Reps forget scheduled callbacks or let leads languish without a systematic "Due Today" queue.
3. **Manager Coaching Disconnect**: Managers review calls or lead records after the fact, but instructions given to reps ("offer 15% discount", "probe about their current provider", "dial back at 2 PM") get lost in Slack or verbal chats.

**Voxel solves these problems directly**:
- Reps log calls in 2 clicks with standardized outcome tags and automated next-follow-up scheduling.
- The "Due Today" and "Stale Leads" engines ensure urgent callbacks are worked first.
- Managers pin floating sticky directives directly onto leads and call notes, tracking their lifecycle from unacknowledged to executed.

---

## 2. Key Architectural Decisions

### A. Full-Stack Hybrid Architecture (Express + Vite + React 19)
- **Unified Node.js / Express Server (`server.ts` & `server/app.ts`)**:
  - Serves REST API routes under `/api/*` and integrates Vite middleware in development mode.
  - Bundles into a single, self-contained CommonJS artifact (`dist/server.cjs`) using `esbuild` for production deployment.
  - Keeps all authentication tokens, secrets, and database credentials safely on the backend.
- **Client SPA (`src/App.tsx`)**:
  - React 19 with Vite and Tailwind CSS v4.
  - Fast, optimistic UI updates for pipeline drag-and-drop, call logging, and directive status changes.

### B. Dual Persistence Strategy (Supabase PostgreSQL + In-Memory Fallback)
- **Supabase Integration**: When configured via environment variables (`SUPABASE_URL`, `SUPABASE_KEY` / `SUPABASE_SERVICE_ROLE_KEY`), the app uses PostgreSQL tables (`leads`, `users`, `pinned_comments`, `push_subscriptions`).
- **Resilient Fallback Engine**: If Supabase credentials are not present or during initial prototyping, the server seamlessly switches to a local in-memory store backed by sample data and JSON persistence. The app never crashes or displays blank screens when external database connections are offline.

### C. Role-Based Access Control (RBAC)
The platform is designed around three distinct user roles:
1. **Admin**:
   - Full control over user accounts, team member provisioning, and password resets.
   - Global reassignment capabilities across the entire lead database.
   - Access to all pipelines, manager directives, system configurations, and broadcast newsletters.
2. **Manager**:
   - Team oversight: tracks assigned sales reps, conversion funnels, call volume, and pipeline velocities.
   - Pinned Directives: ability to issue, track, and delete tactical instructions for agents on specific leads.
   - Reassignment of leads within their purview.
3. **Agent**:
   - Streamlined, distraction-free calling interface.
   - Focuses on the "Due Today" queue, active pipeline stages, and sticky manager notes.
   - One-click communication triggers (Tel, WhatsApp, SMS, Email).

---

## 3. Notable Features & Implementation Details

### A. The Directive & Sticky Note Engine
- **Lead & Call Log Anchoring**: Managers can pin a directive to a lead card generally or link it to a specific historical call log entry.
- **Floating Viewport Tracker (`StickyDirectiveIndicator.tsx`)**:
  - Automatically tracks whether the targeted lead card is in the user's viewport.
  - When the card scrolls out of view, the directive neatly docks to the top or bottom edge of the screen, ensuring critical coaching directives are never missed.
- **Accountability Lifecycle**:
  - `unacknowledged` (Red badge / Attention required): Rep hasn't reviewed the directive yet.
  - `acknowledged` (Amber badge): Rep has seen and acknowledged the instruction.
  - `done` (Emerald check / Completed): Rep has carried out the task and marked it resolved.
- **Manager Oversight Hub (`AssignedDirectivesView.tsx`)**:
  - Centralized dashboard for managers and admins to monitor directives across all sales reps, complete with author attribution, lead context, and one-click phone dialing.

### B. Calling & Lead State Machine
- **Stages**:
  - `new` ➔ `attempted` ➔ `connected` ➔ `qualified` ➔ `meeting_scheduled` ➔ `closed_won` / `closed_lost`
- **Call Outcome Tags**:
  - `Interested`, `Follow-up Required`, `Voicemail`, `Meeting Booked`, `Gatekeeper`, `Not Interested`, `Wrong Number`, `Do Not Call`.
- **Automated Cadences**:
  - Selecting "Follow-up Required" automatically prompts next contact scheduling (+1 day, +3 days, next Monday, or custom timestamp).
  - Marking "Wrong Number" or "Do Not Call" flags the lead appropriately to protect team compliance.

### C. Multi-Channel Outreach
- Quick-action buttons directly on cards:
  - **Phone (`tel:`)**: Initiates softphone or mobile dialer immediately.
  - **WhatsApp (`wa.me`)**: Opens pre-configured WhatsApp chat for international and mobile outreach.
  - **SMS (`sms:`)**: Direct SMS composition for quick text follow-ups.
  - **Email (`mailto:`)**: Auto-fills lead name, company, and subject context.

### D. Notifications & Alerting
- **Web Push API**: Native push notification subscriptions via `web-push` and service workers for mobile and desktop PWA installs.
- **In-App Reminder Daemon (`ReminderManager.tsx`)**: Periodically checks for leads with follow-up timestamps that have arrived and triggers native browser notification dialogs.

---

## 4. Database Schema Overview

The database schema is organized across three primary tables:

1. **`users`**:
   - `id`, `name`, `email`, `role` (`admin` | `manager` | `agent`), `avatar_url`, `manager_id`, `created_at`.
2. **`leads`**:
   - `id`, `name`, `company`, `phone`, `email`, `status`, `deal_value`, `source`, `assigned_to`, `assigned_to_name`, `next_follow_up`, `last_contacted_at`, `call_logs` (JSONB array of call records), `tags`, `is_archived`, `created_at`.
3. **`pinned_comments`**:
   - `id`, `lead_id`, `call_log_id`, `author_id`, `author_name`, `author_role`, `agent_id`, `agent_name`, `content`, `status` (`unacknowledged` | `acknowledged` | `done`), `acknowledged_at`, `done_at`, `created_at`.

---

## 5. Build & Dev Scripts

| Command | Description |
|---|---|
| `npm run dev` | Boots `server.ts` with `tsx`, starting Express with Vite SPA middleware on port 3000 |
| `npm run build` | Builds Vite static client into `dist/` and bundles `server.ts` into `dist/server.cjs` via `esbuild` |
| `npm run start` | Runs the compiled CommonJS server via `node dist/server.cjs` |
| `npm run lint` | Runs `tsc --noEmit` to verify strict TypeScript type safety |
