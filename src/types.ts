export type UserRole = 'admin' | 'manager' | 'agent';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl?: string | null;
  managerId?: string | null; // For Agents: assigned manager ID
  managerName?: string | null;
  firstLoginAt?: string;
  createdAt: string;
  lastLoginAt?: string;
}

export type OutcomeTag =
  | "Couldn't Connect"
  | 'Busy'
  | 'Interested'
  | 'Call Back Later'
  | 'Closed/Matured'
  | 'Service Denied'
  | 'Other';

export type LeadStatus =
  | 'Active'
  | 'Follow-up Scheduled'
  | 'Matured (Closed)'
  | 'Service Denied'
  | 'Archived';

export type Priority = 'Normal' | 'High';

export interface CallLog {
  id: string;
  timestamp: string; // ISO string
  summary: string;
  full_notes: string;
  outcome_tag: OutcomeTag;
  business_info?: string;
  logged_by?: string;
  logged_by_name?: string;
}

export interface Lead {
  id: string;
  phone: string; // required, unique
  name: string;
  business_notes: string;
  source?: string;
  email?: string;
  created_at: string; // auto timestamp, immutable
  updated_at: string; // auto timestamp
  status: LeadStatus;
  priority: Priority;
  next_action_at: string | null; // ISO datetime string or null
  last_notified_at?: string | null; // ISO datetime string or null
  call_logs: CallLog[];
  business_info?: string;
  archived_at?: string | null;
  archive_reason?: string;
  assigned_to?: string | null; // current active owner user ID
  assigned_to_name?: string;
  original_owner_id?: string | null; // previous owner if reassigned
  original_owner_name?: string;
  reassigned_at?: string | null;
  reassigned_by?: string | null;
}

export interface PotentialCustomer {
  id: string;
  name: string;
  phone: string;
  product_interest: string; // What They Bought/Were Interested In
  notes?: string;
  email?: string;
  source?: string;
  created_by?: string | null;
  created_by_name?: string | null;
  created_at: string;
  updated_at: string;
}

export type PinnedCommentStatus = 'unacknowledged' | 'acknowledged' | 'done';

export interface PinnedComment {
  id: string;
  target_type?: 'lead' | 'call_log';
  lead_id?: string | null;
  lead_name?: string;
  lead_phone?: string;
  call_log_id?: string | null;
  call_log_snippet?: string;
  author_id: string;
  author_name: string;
  author_avatar_url?: string | null;
  author_role?: 'admin' | 'manager' | 'agent';
  agent_id?: string | null; // agent receiving the pinned comment
  agent_name?: string | null;
  agent_email?: string | null;
  content: string;
  status: PinnedCommentStatus;
  acknowledged_at?: string | null;
  done_at?: string | null;
  created_at: string;
}

export interface NewsletterLog {
  id: string;
  subject: string;
  message: string;
  recipient_count: number;
  recipient_type: string;
  recipients?: Array<{ name: string; email?: string; phone?: string }>;
  sent_by?: string | null;
  sent_by_name?: string | null;
  sent_at: string;
  status: 'sent' | 'partial' | 'failed' | 'simulated';
  error_message?: string | null;
}

export interface AuthState {
  user: User | null;
  token: string | null;
}
