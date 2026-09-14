-- =============================================================================
-- COLDDIAL CRM PHASE 2 MIGRATION SCRIPT
-- Run this in your Supabase Project -> SQL Editor -> Run
-- =============================================================================

-- 1. Users table updates (Manager/SPOC role, Avatar URL, Manager assignment, First login)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS manager_id TEXT REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS first_login_at TIMESTAMPTZ DEFAULT NOW();

-- Update user role constraint if present
DO $$
BEGIN
  ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
  ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'manager', 'agent'));
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_manager_id ON public.users(manager_id);

-- 2. Leads table updates (Reassignment and Ownership)
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS assigned_to TEXT REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS original_owner_id TEXT REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS reassigned_at TIMESTAMPTZ;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS reassigned_by TEXT REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON public.leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_original_owner ON public.leads(original_owner_id);

-- 3. Potential Customers table (Lightweight reference dataset)
CREATE TABLE IF NOT EXISTS public.potential_customers (
  id TEXT PRIMARY KEY DEFAULT ('pc_' || substring(replace(uuid_generate_v4()::text, '-', ''), 1, 16)),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  product_interest TEXT NOT NULL,
  created_by TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_potential_customers_phone ON public.potential_customers(phone);
CREATE INDEX IF NOT EXISTS idx_potential_customers_name ON public.potential_customers(LOWER(name));
ALTER TABLE public.potential_customers DISABLE ROW LEVEL SECURITY;

-- 4. Pinned Comments table (Manager -> Agent scroll-tracking comments)
CREATE TABLE IF NOT EXISTS public.pinned_comments (
  id TEXT PRIMARY KEY DEFAULT ('pcom_' || substring(replace(uuid_generate_v4()::text, '-', ''), 1, 16)),
  target_type TEXT NOT NULL CHECK (target_type IN ('lead', 'call_log')),
  lead_id TEXT REFERENCES public.leads(id) ON DELETE CASCADE,
  call_log_id TEXT REFERENCES public.call_logs(id) ON DELETE CASCADE,
  author_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  author_avatar_url TEXT,
  agent_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unacknowledged' CHECK (status IN ('unacknowledged', 'acknowledged', 'done')),
  acknowledged_at TIMESTAMPTZ,
  done_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pinned_comments_agent_id ON public.pinned_comments(agent_id);
CREATE INDEX IF NOT EXISTS idx_pinned_comments_lead_id ON public.pinned_comments(lead_id);
CREATE INDEX IF NOT EXISTS idx_pinned_comments_status ON public.pinned_comments(status);
ALTER TABLE public.pinned_comments DISABLE ROW LEVEL SECURITY;

-- 5. Newsletter Send Logs table (Resend email blast audit trail)
CREATE TABLE IF NOT EXISTS public.newsletter_logs (
  id TEXT PRIMARY KEY DEFAULT ('nlog_' || substring(replace(uuid_generate_v4()::text, '-', ''), 1, 16)),
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  recipient_count INTEGER NOT NULL DEFAULT 0,
  recipient_type TEXT NOT NULL,
  recipients JSONB NOT NULL DEFAULT '[]'::jsonb,
  sent_by TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'sent'
);
CREATE INDEX IF NOT EXISTS idx_newsletter_logs_sent_at ON public.newsletter_logs(sent_at DESC);
ALTER TABLE public.newsletter_logs DISABLE ROW LEVEL SECURITY;
