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
  audio_url?: string | null;
  audio_duration?: number | null;
  audio_name?: string | null;
}

export interface Lead {
  id: string;
  phone: string; // required, unique
  name: string;
  business_notes: string;
  business_info?: string;
  company?: string;
  source?: string;
  email?: string;
  created_at: string; // auto timestamp, immutable
  updated_at: string; // auto timestamp
  status: LeadStatus;
  priority: Priority;
  next_action_at: string | null; // ISO datetime string or null
  last_notified_at?: string | null; // ISO datetime string or null
  call_logs: CallLog[];
  archived_at?: string | null;
  archive_reason?: string;
  assigned_to?: string | null; // current active owner user ID
  assigned_to_name?: string;
  original_owner_id?: string | null; // previous owner if reassigned
  original_owner_name?: string;
  reassigned_at?: string | null;
  reassigned_by?: string | null;
  ai_health?: LeadHealthAssessment;
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

export type AssistanceReason =
  | 'high_workload'
  | 'bad_match'
  | 'domain_expertise'
  | 'language_fit'
  | 'other';

export interface AssistanceTicket {
  id: string;
  lead_id: string;
  lead_name: string;
  lead_phone: string;
  lead_company?: string;
  lead_status?: string;
  lead_priority?: Priority;
  requested_by_id: string;
  requested_by_name: string;
  requested_by_email: string;
  requested_by_avatar_url?: string | null;
  target_agent_id?: string | null;
  target_agent_name?: string | null;
  reason: AssistanceReason;
  reason_label: string;
  notes: string;
  status: 'pending' | 'accepted' | 'cancelled';
  accepted_by_id?: string | null;
  accepted_by_name?: string | null;
  accepted_by_email?: string | null;
  accepted_at?: string | null;
  created_at: string;
  updated_at?: string;
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

export type ObjectionCategory = 'pricing' | 'timing' | 'competition' | 'gatekeeper' | 'authority' | 'general';

export interface ObjectionBattleCard {
  id: string;
  category: ObjectionCategory;
  objection: string;
  rebuttal: string;
  talking_points?: string[];
  follow_up_question?: string;
  created_at: string;
  updated_at?: string;
  is_custom?: boolean;
}

export interface CallScript {
  id: string;
  title: string;
  category: 'cold_intro' | 'discovery' | 'gatekeeper' | 'voicemail' | 'closing' | 'custom';
  content: string; // supports {{name}}, {{company}}, {{notes}}
  created_at: string;
  updated_at?: string;
}

export type CadenceIntervalUnit = 'hours' | 'days';

export interface OutcomeCadenceRule {
  outcome: OutcomeTag;
  delayValue: number; // e.g., 2, 24, 48
  delayUnit: CadenceIntervalUnit; // 'hours' | 'days'
  preferredHour?: number; // e.g., 10 for 10:00 AM, undefined for exactly +delayValue
  defaultPriority?: Priority;
  autoArchive?: boolean;
  notesSnippet?: string;
}

export type OutcomeCadenceConfig = Record<OutcomeTag, OutcomeCadenceRule>;

export interface EnhancedCallNotes {
  cleanSummary: string;
  coreTakeaways: string[];
  painPoints: string[];
  sentiment: 'Positive' | 'Neutral' | 'Skeptical' | 'Frustrated';
  nextActions: string[];
  formattedNotes: string;
}

export type FollowUpTone = 'professional' | 'warm_casual' | 'urgent_direct' | 'value_focused';

export interface FollowUpComposerResult {
  whatsapp: string;
  emailSubject: string;
  emailBody: string;
  sms: string;
}

export interface LeadHealthAssessment {
  leadId: string;
  healthScore: number; // 0 to 100
  category: 'Hot' | 'Warm' | 'Cooling' | 'At-Risk';
  churnRisk: 'Low' | 'Medium' | 'High' | 'Critical';
  riskDiagnosis: string;
  recommendedTactic: string;
  decayFactors: string[];
  assessedAt: string;
  isAiPowered?: boolean;
  provider?: 'gemini' | 'heuristic';
  modelUsed?: string;
}

export interface AdminGeminiConfig {
  hasApiKey: boolean;
  keyPreview: string;
  configured?: boolean;
  maskedKey?: string;
  model: string;
  source: 'admin' | 'env' | 'none';
  availableModels: Array<{ id: string; name: string; description: string; isDefault?: boolean }>;
}

export interface LeaderboardMember {
  userId: string;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string | null;
  dialsCount: number;
  connectsCount: number;
  meetingsCount: number;
  closedCount: number;
  directivesCompleted: number;
  score: number;
  rank?: number;
}

export interface ActivityFeedItem {
  id: string;
  type: 'call' | 'directive_completed' | 'lead_created' | 'closed_deal';
  userId: string;
  userName: string;
  userAvatar?: string | null;
  leadId?: string;
  leadName?: string;
  outcomeTag?: OutcomeTag;
  summary?: string;
  timestamp: string;
  audioUrl?: string | null;
  audioDuration?: number | null;
}

export interface LeaderboardStats {
  period: 'today' | 'week' | 'month' | 'all';
  leaderboard: LeaderboardMember[];
  activityFeed: ActivityFeedItem[];
  totals: {
    totalDials: number;
    totalConnects: number;
    totalMeetings: number;
    totalClosed: number;
  };
}

