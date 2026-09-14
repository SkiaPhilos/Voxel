-- ==============================================================================
-- ColdCall CRM - Supabase Incremental Migration for Push Notifications & OTPs
-- ==============================================================================
-- If your Supabase database already has users, leads, and call_logs,
-- run this script in your Supabase SQL Editor to add the tables for
-- Web Push Subscriptions and Email OTP Password Resets.
-- ==============================================================================

-- 1. PUSH SUBSCRIPTIONS TABLE (Web Push PWA & Mobile Notifications)
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

-- 2. PASSWORD RESET OTPS TABLE (Agent Password Recovery)
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

-- 3. NOTIFICATIONS LOG TABLE
CREATE TABLE IF NOT EXISTS public.notifications_log (
  id TEXT PRIMARY KEY DEFAULT ('notif_' || substring(replace(uuid_generate_v4()::text, '-', ''), 1, 16)),
  lead_id TEXT REFERENCES public.leads(id) ON DELETE SET NULL,
  lead_name TEXT,
  recipient_email TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'email',
  status TEXT NOT NULL DEFAULT 'sent',
  dispatched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. DISABLE RLS (CRM handles authentication via JWT and bcrypt)
ALTER TABLE public.push_subscriptions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_reset_otps DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications_log DISABLE ROW LEVEL SECURITY;
