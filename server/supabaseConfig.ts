// server/supabaseConfig.ts
// Server-only Supabase configuration.
// Prioritizes runtime process.env, with default server credentials for seamless Git/Vercel exports.

export const DEFAULT_SUPABASE_URL = 'https://uisiuhgvesyueuxcbdvf.supabase.co';

export const DEFAULT_SUPABASE_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVpc2l1aGd2ZXN5dWV1eGNiZHZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTE1ODM4MywiZXhwIjoyMTA0NzM0MzgzfQ.pA69UTxyogbViGcLYDqXyJlxv-WBziy8yKoxw21OBPE';

export const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVpc2l1aGd2ZXN5dWV1eGNiZHZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxNTgzODMsImV4cCI6MjEwNDczNDM4M30.zAKm4iY-V-UNkoaJeIjeI1iKa8OCfsJVer1qWKx0ytU';

export const DEFAULT_RESEND_API_KEY = 're_AjFdurNh_P4fMmmGawnVbJjZ8LgnxFnUE';

export const DEFAULT_JWT_SECRET = 'coldcall-crm-jwt-secret-replace-in-production';

export const DEFAULT_CRON_SECRET = 'WV0KJ3AEBu3AOXAafagJh3na8cNdKNn7DALNUPDCPfc=';

export const DEFAULT_VAPID_PUBLIC_KEY =
  'BIwZZrjPRVhPEZFpbGHCXsGaVbwUfhyyjIE1rMTwYRjRHhhasVOS-VmgrxqKDVo3iLj6EuYjgNeckAsNoETSk9s';

export const DEFAULT_VAPID_PRIVATE_KEY =
  'cF-RflD43vs98GvH5iEpzEWl2JUWX5s0MM8mmfzJXKw';

export const DEFAULT_VAPID_SUBJECT = 'mailto:admin@coldcrm.internal';
