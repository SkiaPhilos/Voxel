-- ==============================================================================
-- ColdCall CRM - Supabase (PostgreSQL) Complete Schema & Seed Script
-- ==============================================================================
-- WHERE TO RUN THIS:
-- 1. Log in to https://supabase.com and select your project.
-- 2. In the left sidebar, click "SQL Editor" (the icon with '>_').
-- 3. Click "New Query".
-- 4. Copy and paste this ENTIRE file into the editor.
-- 5. Click "Run" (or press Ctrl+Enter / Cmd+Enter).
-- ==============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. USERS TABLE
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY DEFAULT ('usr_' || substring(replace(uuid_generate_v4()::text, '-', ''), 1, 16)),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'agent')),
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(LOWER(email));

-- 3. LEADS TABLE
CREATE TABLE IF NOT EXISTS public.leads (
  id TEXT PRIMARY KEY DEFAULT ('lead_' || substring(replace(uuid_generate_v4()::text, '-', ''), 1, 16)),
  phone TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  business_notes TEXT DEFAULT '',
  source TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Follow-up Scheduled', 'Matured (Closed)', 'Service Denied', 'Archived')),
  priority TEXT NOT NULL DEFAULT 'Normal' CHECK (priority IN ('Normal', 'High')),
  next_action_at TIMESTAMPTZ,
  last_notified_at TIMESTAMPTZ,
  business_info TEXT DEFAULT '',
  archived_at TIMESTAMPTZ,
  archive_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_phone ON public.leads(phone);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_priority ON public.leads(priority);
CREATE INDEX IF NOT EXISTS idx_leads_next_action ON public.leads(next_action_at) WHERE status IN ('Active', 'Follow-up Scheduled');
CREATE INDEX IF NOT EXISTS idx_leads_updated_at ON public.leads(updated_at DESC);

-- 4. CALL LOGS TABLE (Relational with Foreign Key)
CREATE TABLE IF NOT EXISTS public.call_logs (
  id TEXT PRIMARY KEY DEFAULT ('call_' || substring(replace(uuid_generate_v4()::text, '-', ''), 1, 16)),
  lead_id TEXT NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  summary TEXT NOT NULL,
  full_notes TEXT DEFAULT '',
  outcome_tag TEXT NOT NULL CHECK (outcome_tag IN ('Couldn''t Connect', 'Busy', 'Interested', 'Call Back Later', 'Closed/Matured', 'Service Denied', 'Other')),
  business_info TEXT,
  logged_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_call_logs_lead_id ON public.call_logs(lead_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_timestamp ON public.call_logs(timestamp DESC);

-- 5. NOTIFICATIONS LOG TABLE
CREATE TABLE IF NOT EXISTS public.notifications_log (
  id TEXT PRIMARY KEY DEFAULT ('notif_' || substring(replace(uuid_generate_v4()::text, '-', ''), 1, 16)),
  lead_id TEXT REFERENCES public.leads(id) ON DELETE SET NULL,
  lead_name TEXT,
  recipient_email TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'email',
  status TEXT NOT NULL DEFAULT 'sent',
  dispatched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. PUSH SUBSCRIPTIONS TABLE (Web Push PWA)
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id TEXT PRIMARY KEY DEFAULT ('psub_' || substring(replace(uuid_generate_v4()::text, '-', ''), 1, 16)),
  user_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
  endpoint TEXT UNIQUE NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subs_user_id ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subs_endpoint ON public.push_subscriptions(endpoint);

-- 7. PASSWORD RESET OTPS TABLE (Email OTP verification)
CREATE TABLE IF NOT EXISTS public.password_reset_otps (
  id TEXT PRIMARY KEY DEFAULT ('otp_' || substring(replace(uuid_generate_v4()::text, '-', ''), 1, 16)),
  email TEXT NOT NULL,
  otp TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reset_otps_email ON public.password_reset_otps(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_reset_otps_created ON public.password_reset_otps(created_at DESC);

-- ==============================================================================
-- 8. ROW LEVEL SECURITY (RLS) CONFIGURATION
-- ==============================================================================
-- IMPORTANT: This CRM uses application-level authentication (bcrypt passwords + JWT).
-- The backend server handles all authentication and authorized queries.
-- Therefore, we DISABLE RLS on these tables so queries from both service_role and anon keys work.
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_reset_otps DISABLE ROW LEVEL SECURITY;

-- If you prefer or are required to keep RLS ENABLED in your organization,
-- uncomment the following policies to permit full access:
-- ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.notifications_log ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow all access to users" ON public.users FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY "Allow all access to leads" ON public.leads FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY "Allow all access to call_logs" ON public.call_logs FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY "Allow all access to notifications_log" ON public.notifications_log FOR ALL USING (true) WITH CHECK (true);

-- ==============================================================================
-- 7. CLEAN DATABASE STATE (ZERO SEED ROWS)
-- ==============================================================================
-- This database schema starts completely clean with 0 users, 0 leads, and 0 call logs.
-- 
-- HOW TO INITIALIZE YOUR FIRST ADMIN ACCOUNT:
-- When you deploy the application to Vercel and open it in your browser for the
-- first time, the CRM automatically detects an uninitialized workspace and presents
-- the "Initial Workspace Setup" wizard where you input your own Name, Work Email,
-- and secure Password. It then hashes your password using bcrypt and registers you
-- as the Master Administrator.
--
-- OPTIONAL MANUAL ALTERNATIVE (Only if you prefer inserting via SQL):
-- If you have the 'pgcrypto' extension enabled and prefer inserting an admin manually:
-- CREATE EXTENSION IF NOT EXISTS "pgcrypto";
-- INSERT INTO public.users (email, name, role, password_hash)
-- VALUES ('admin@yourcompany.com', 'Your Name', 'admin', crypt('YourPasswordHere', gen_salt('bf')));

-- 8. Force Supabase PostgREST API to instantly reload its schema cache
NOTIFY pgrst, 'reload schema';
