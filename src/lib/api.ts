import type {
  Lead,
  User,
  UserRole,
  OutcomeTag,
  Priority,
  PotentialCustomer,
  PinnedComment,
  PinnedCommentStatus,
  NewsletterLog,
  ObjectionBattleCard,
  CallScript,
  OutcomeCadenceConfig,
  EnhancedCallNotes,
  FollowUpComposerResult,
  FollowUpTone,
  LeadHealthAssessment,
  AdminGeminiConfig,
  LeaderboardStats,
  AssistanceTicket,
  AssistanceReason,
} from '../types';

const TOKEN_KEY = 'coldcrm_auth_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  let data: any = {};
  let rawText = '';
  try {
    rawText = await response.text();
    data = JSON.parse(rawText);
  } catch {
    if (rawText && rawText.length < 250 && !rawText.includes('<html')) {
      data = { error: rawText.trim() };
    }
  }

  if (!response.ok) {
    throw new Error(data.error || data.message || `Request failed with status ${response.status}`);
  }

  return data as T;
}

export const api = {
  // Auth
  async getSetupStatus(): Promise<{ isSetupComplete: boolean; userCount: number }> {
    return request('/api/auth/setup-status');
  },

  async setupFirstAdmin(data: {
    name: string;
    email: string;
    password: string;
  }): Promise<{ user: User; token: string; message: string }> {
    const res = await request<{ user: User; token: string; message: string }>(
      '/api/auth/setup-first-admin',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
    if (res.token) {
      setStoredToken(res.token);
    }
    return res;
  },

  async checkEmail(email: string): Promise<{ exists: boolean; name?: string; email?: string; message?: string }> {
    return request('/api/auth/check-email', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  async login(email: string, password: string): Promise<{ user: User; token: string }> {
    const data = await request<{ user: User; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setStoredToken(data.token);
    return data;
  },

  async forgotPassword(email: string): Promise<{
    success: boolean;
    message: string;
    email: string;
    emailDispatched?: boolean;
    devOtpHint?: string;
  }> {
    return request('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  async verifyResetOtp(data: {
    email: string;
    otp: string;
    newPassword: string;
  }): Promise<{ success: boolean; user: User; token: string; message: string }> {
    const res = await request<{ success: boolean; user: User; token: string; message: string }>(
      '/api/auth/verify-reset-otp',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
    if (res.token) {
      setStoredToken(res.token);
    }
    return res;
  },

  async getMe(): Promise<{ user: User }> {
    return request('/api/auth/me');
  },

  async updateProfile(data: {
    name?: string;
    currentPassword?: string;
    newPassword?: string;
  }): Promise<{ success: boolean; user: User; message: string }> {
    return request('/api/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async logout(): Promise<void> {
    try {
      await request('/api/auth/logout', { method: 'POST' });
    } finally {
      setStoredToken(null);
    }
  },

  // Admin Users
  async getUsers(): Promise<{ users: User[] }> {
    return request('/api/admin/users');
  },

  async grantAccess(userData: {
    email: string;
    password: string;
    name?: string;
    role?: UserRole;
    managerId?: string | null;
  }): Promise<{ user: User; message: string }> {
    return request('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  async revokeAccess(userId: string): Promise<{ success: boolean; message: string }> {
    return request(`/api/admin/users/${userId}`, {
      method: 'DELETE',
    });
  },

  async updateUser(
    userId: string,
    data: { name?: string; password?: string; role?: UserRole; managerId?: string | null }
  ): Promise<{ success: boolean }> {
    return request(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async flushUserData(userIds: string[]): Promise<{
    success: boolean;
    deletedLeadsCount: number;
    deletedCallLogsCount: number;
    deletedDirectivesCount: number;
  }> {
    return request('/api/admin/flush-user-data', {
      method: 'POST',
      body: JSON.stringify({ userIds }),
    });
  },

  // Leads
  async getLeads(
    view?: 'active' | 'closed' | 'archive' | 'all',
    search?: string,
    reviewingAgentId?: string
  ): Promise<{ leads: Lead[] }> {
    const params = new URLSearchParams();
    if (view) params.set('view', view);
    if (search) params.set('search', search);
    if (reviewingAgentId) params.set('reviewingAgentId', reviewingAgentId);
    const qs = params.toString();
    return request(`/api/leads${qs ? `?${qs}` : ''}`);
  },

  async getLead(id: string): Promise<{ lead: Lead }> {
    return request(`/api/leads/${id}`);
  },

  async createLead(data: {
    phone: string;
    name: string;
    business_notes?: string;
    source?: string;
    email?: string;
    priority?: Priority;
    assignedTo?: string;
  }): Promise<{ lead: Lead }> {
    return request('/api/leads', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateLead(
    id: string,
    data: Partial<Lead>
  ): Promise<{ lead: Lead }> {
    return request(`/api/leads/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async updateLeadQA(
    id: string,
    data: {
      qa_data?: Record<string, string>;
      qa_entries?: any[];
      qa_sessions?: any[];
      business_info?: string;
    }
  ): Promise<{ lead: Lead }> {
    return request(`/api/leads/${id}/qa`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async logCall(
    id: string,
    data: {
      outcome_tag: OutcomeTag;
      summary: string;
      full_notes?: string;
      next_action_at?: string | null;
      business_info?: string;
      priority?: Priority;
      audio_url?: string | null;
      audio_duration?: number | null;
      audio_name?: string | null;
    }
  ): Promise<{ lead: Lead }> {
    return request(`/api/leads/${id}/calls`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async archiveLead(id: string, archive: boolean, reason?: string): Promise<{ lead: Lead }> {
    return request(`/api/leads/${id}/archive`, {
      method: 'POST',
      body: JSON.stringify({ archive, reason }),
    });
  },

  async checkLeadDuplicates(leads: Array<{
    phone: string;
    email?: string;
    name?: string;
    company?: string;
  }>): Promise<{
    totalIncoming: number;
    duplicateCount: number;
    cleanCount: number;
    duplicates: Array<{
      rowIndex: number;
      matchedBy: 'phone' | 'email';
      incoming: { name?: string; phone: string; email?: string; company?: string };
      existing: { id: string; name: string; phone: string; email?: string; status: string; assigned_to_name?: string; business_info?: string };
    }>;
  }> {
    return request('/api/leads/check-duplicates', {
      method: 'POST',
      body: JSON.stringify({ leads }),
    });
  },

  async bulkImportLeads(data: {
    leads: Array<{
      phone: string;
      name: string;
      email?: string;
      business_notes?: string;
      source?: string;
      priority?: Priority;
      assignedTo?: string | null;
      business_info?: string;
    }>;
    duplicateHandling?: 'skip' | 'overwrite' | 'import_as_duplicate';
    defaultAssignee?: string | null;
    roundRobinUserIds?: string[];
  }): Promise<{
    success: boolean;
    totalProcessed: number;
    createdCount: number;
    updatedCount: number;
    skippedCount: number;
    createdLeadIds: string[];
    updatedLeadIds: string[];
    errors: string[];
  }> {
    return request('/api/leads/bulk-import', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Notifications
  async testEmailReminder(leadId: string, leadName: string, followUpTime?: string | null): Promise<any> {
    return request('/api/notifications/test-email', {
      method: 'POST',
      body: JSON.stringify({ leadId, leadName, followUpTime }),
    });
  },

  async getVapidPublicKey(): Promise<{ publicKey: string }> {
    return request('/api/notifications/vapid-public-key');
  },

  async savePushSubscription(subscription: any): Promise<{ success: boolean; message: string }> {
    const raw = typeof subscription.toJSON === 'function' ? subscription.toJSON() : subscription;
    return request('/api/notifications/push-subscribe', {
      method: 'POST',
      body: JSON.stringify({
        endpoint: raw.endpoint,
        keys: raw.keys,
        expirationTime: raw.expirationTime,
      }),
    });
  },

  async removePushSubscription(endpoint: string): Promise<{ success: boolean; message: string }> {
    return request('/api/notifications/push-unsubscribe', {
      method: 'POST',
      body: JSON.stringify({ endpoint }),
    });
  },

  async testPushNotification(subscriptionOrEndpoint?: any): Promise<{ success: boolean; message: string; sentCount?: number }> {
    let body: any = {};
    if (typeof subscriptionOrEndpoint === 'string') {
      body = { endpoint: subscriptionOrEndpoint };
    } else if (subscriptionOrEndpoint) {
      const raw = typeof subscriptionOrEndpoint.toJSON === 'function'
        ? subscriptionOrEndpoint.toJSON()
        : subscriptionOrEndpoint;
      body = {
        endpoint: raw.endpoint,
        keys: raw.keys,
      };
    }
    return request('/api/notifications/test-push', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  // Database status
  async getDatabaseStatus(): Promise<{
    connected: boolean;
    type: 'supabase' | 'local';
    tablesExist: boolean;
    userCount?: number;
    leadCount?: number;
    message: string;
    diagnostics?: any;
  }> {
    return request('/api/database/status');
  },

  getExportCsvUrl(type: 'closed' | 'archived' | 'all'): string {
    const token = getStoredToken();
    return `/api/leads/export/csv?type=${type}&token=${token || ''}`;
  },

  getAllDataExportCsvUrl(): string {
    const token = getStoredToken();
    return `/api/admin/export/all-data/csv?token=${token || ''}`;
  },

  async downloadAllDataCsv(): Promise<void> {
    const token = getStoredToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch('/api/admin/export/all-data/csv', { headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to download data' }));
      throw new Error(err.error || 'Failed to download system data');
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `coldcall_crm_all_users_data_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  // ----------------------------------------------------
  // Phase 2: Custom Profile Picture
  // ----------------------------------------------------
  async uploadAvatar(imageBase64: string, mimeType: string = 'image/jpeg'): Promise<{ success: boolean; avatarUrl: string; user: User }> {
    return request('/api/auth/profile/avatar', {
      method: 'POST',
      body: JSON.stringify({ imageBase64, mimeType }),
    });
  },

  async removeAvatar(): Promise<{ success: boolean; user: User }> {
    return request('/api/auth/profile/avatar', {
      method: 'DELETE',
    });
  },

  // ----------------------------------------------------
  // Phase 2: Potential Customers
  // ----------------------------------------------------
  async getPotentialCustomers(search?: string): Promise<{ customers: PotentialCustomer[] }> {
    const qs = search ? `?search=${encodeURIComponent(search)}` : '';
    return request(`/api/potential-customers${qs}`);
  },

  async createPotentialCustomer(data: {
    name: string;
    phone: string;
    product_interest: string;
    notes?: string;
    email?: string;
    source?: string;
  }): Promise<{ customer: PotentialCustomer }> {
    return request('/api/potential-customers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async deletePotentialCustomer(id: string): Promise<{ success: boolean }> {
    return request(`/api/potential-customers/${id}`, {
      method: 'DELETE',
    });
  },

  getPotentialCustomersExportCsvUrl(): string {
    const token = getStoredToken();
    return `/api/potential-customers/export/csv?token=${token || ''}`;
  },

  // ----------------------------------------------------
  // Phase 2: Pinned Comments
  // ----------------------------------------------------
  async getPinnedComments(params?: {
    leadId?: string;
    agentId?: string;
    status?: string;
    authorId?: string;
  }): Promise<{ comments: PinnedComment[] }> {
    const qs = new URLSearchParams();
    if (params?.leadId) qs.set('leadId', params.leadId);
    if (params?.agentId) qs.set('agentId', params.agentId);
    if (params?.status) qs.set('status', params.status);
    if (params?.authorId) qs.set('authorId', params.authorId);
    const query = qs.toString();
    return request(`/api/pinned-comments${query ? `?${query}` : ''}`);
  },

  async createPinnedComment(data: {
    leadId?: string;
    callLogId?: string;
    agentId?: string;
    comment: string;
    leadName?: string;
    leadPhone?: string;
    callLogSnippet?: string;
    agentName?: string;
  }): Promise<{ comment: PinnedComment }> {
    return request('/api/pinned-comments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updatePinnedCommentStatus(
    id: string,
    status: PinnedCommentStatus
  ): Promise<{ comment: PinnedComment }> {
    return request(`/api/pinned-comments/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  async deletePinnedComment(id: string): Promise<{ success: boolean }> {
    return request(`/api/pinned-comments/${id}`, {
      method: 'DELETE',
    });
  },

  // ----------------------------------------------------
  // Phase 2: Lead Reassignment
  // ----------------------------------------------------
  async reassignLead(leadId: string, newOwnerId: string): Promise<{ lead: Lead; message: string }> {
    return request(`/api/leads/${leadId}/reassign`, {
      method: 'POST',
      body: JSON.stringify({ newOwnerId }),
    });
  },

  // ----------------------------------------------------
  // Phase 2: Manager Dashboard & Team
  // ----------------------------------------------------
  async getManagerDashboardStats(): Promise<{
    summary: {
      totalTeamLeads: number;
      maturedCount: number;
      activeCount: number;
      deniedCount: number;
      teamSize: number;
      flaggedCount: number;
    };
    members: Array<{
      user: User;
      leadsCount: number;
      totalCalls: number;
      closedCount: number;
      performance: {
        inGracePeriod: boolean;
        calendarDaysElapsed: number;
        gracePeriodDaysLeft: number;
        workingDaysDenominator: number;
        dailyAverage: number;
        isFlaggedLowVolume: boolean;
        statusLabel: string;
      };
    }>;
  }> {
    return request('/api/manager/dashboard-stats');
  },

  async getManagerTeam(): Promise<{ team: User[]; teamMembers: User[] }> {
    const res = await request<any>('/api/manager/team');
    const members = res.team || res.teamMembers || [];
    return { team: members, teamMembers: members };
  },

  // ----------------------------------------------------
  // Phase 2: Newsletter
  // ----------------------------------------------------
  async getNewsletterRecipientStats(): Promise<{
    stats: {
      potential_customers: { total: number; withEmail: number };
      active_leads: { total: number; withEmail: number };
      closed_leads: { total: number; withEmail: number };
      all_leads: { total: number; withEmail: number };
    };
  }> {
    return request('/api/newsletter/recipient-stats');
  },

  async getNewsletterLogs(): Promise<{ logs: NewsletterLog[] }> {
    return request('/api/newsletter/logs');
  },

  async sendNewsletter(data: {
    subject: string;
    bodyHtml: string;
    recipientCategory: string;
  }): Promise<{
    success: boolean;
    recipientCount: number;
    status: 'sent' | 'failed' | 'simulated';
    message: string;
    log: NewsletterLog;
  }> {
    return request('/api/newsletter/send', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // ----------------------------------------------------
  // Objection Battle Cards & Interactive Call Scripts
  // ----------------------------------------------------
  async getObjectionCards(): Promise<{ cards: ObjectionBattleCard[] }> {
    return request('/api/objection-cards');
  },

  async createObjectionCard(data: {
    category: ObjectionBattleCard['category'];
    objection: string;
    rebuttal: string;
    talking_points?: string[];
    follow_up_question?: string;
  }): Promise<{ card: ObjectionBattleCard }> {
    return request('/api/objection-cards', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateObjectionCard(
    id: string,
    updates: Partial<Omit<ObjectionBattleCard, 'id' | 'created_at'>>
  ): Promise<{ card: ObjectionBattleCard }> {
    return request(`/api/objection-cards/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  async deleteObjectionCard(id: string): Promise<{ success: boolean }> {
    return request(`/api/objection-cards/${id}`, {
      method: 'DELETE',
    });
  },

  async resetDefaultObjectionCards(): Promise<{ cards: ObjectionBattleCard[]; message: string }> {
    return request('/api/objection-cards/reset', {
      method: 'POST',
    });
  },

  async getCallScripts(): Promise<{ scripts: CallScript[] }> {
    return request('/api/call-scripts');
  },

  async createCallScript(data: {
    title: string;
    category: CallScript['category'];
    content: string;
  }): Promise<{ script: CallScript }> {
    return request('/api/call-scripts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateCallScript(
    id: string,
    updates: Partial<Omit<CallScript, 'id' | 'created_at'>>
  ): Promise<{ script: CallScript }> {
    return request(`/api/call-scripts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  async deleteCallScript(id: string): Promise<{ success: boolean }> {
    return request(`/api/call-scripts/${id}`, {
      method: 'DELETE',
    });
  },

  async resetDefaultCallScripts(): Promise<{ scripts: CallScript[]; message: string }> {
    return request('/api/call-scripts/reset', {
      method: 'POST',
    });
  },

  // ----------------------------------------------------
  // Quick-Outcome Cadence Configurations
  // ----------------------------------------------------
  async getCadenceConfig(): Promise<{ cadence: OutcomeCadenceConfig }> {
    return request('/api/cadence');
  },

  async updateCadenceConfig(cadence: OutcomeCadenceConfig): Promise<{ cadence: OutcomeCadenceConfig; message: string }> {
    return request('/api/cadence', {
      method: 'PUT',
      body: JSON.stringify({ cadence }),
    });
  },

  async resetCadenceConfig(): Promise<{ cadence: OutcomeCadenceConfig; message: string }> {
    return request('/api/cadence/reset', {
      method: 'POST',
    });
  },

  // ----------------------------------------------------
  // Gemini AI Features (Server-Side)
  // ----------------------------------------------------
  async enhanceCallNotes(data: {
    leadName: string;
    businessInfo?: string;
    outcomeTag: OutcomeTag | string;
    rawNotes: string;
    previousContext?: string;
  }): Promise<{ enhanced: EnhancedCallNotes }> {
    return request('/api/ai/enhance-call-notes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async composeFollowUp(data: {
    leadName: string;
    businessInfo?: string;
    outcomeTag: OutcomeTag | string;
    callNotes?: string;
    tone?: FollowUpTone;
    agentName?: string;
  }): Promise<{ messages: FollowUpComposerResult }> {
    return request('/api/ai/compose-followup', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getLeadHealth(params: {
    leadId?: string;
    lead?: Lead;
    daysCold?: number;
  }): Promise<{ health: LeadHealthAssessment }> {
    return request('/api/ai/lead-health', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  // ----------------------------------------------------
  // Admin Gemini Configuration
  // ----------------------------------------------------
  async getAdminGeminiConfig(): Promise<{ config: AdminGeminiConfig }> {
    return request('/api/admin/gemini-config');
  },

  async updateAdminGeminiConfig(data: {
    apiKey?: string;
    model?: string;
    verify?: boolean;
  }): Promise<{
    config: AdminGeminiConfig;
    message: string;
    verification?: {
      success: boolean;
      model: string;
      message: string;
      latencyMs: number;
    } | null;
  }> {
    return request('/api/admin/gemini-config', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async testAdminGeminiConfig(data: {
    apiKey?: string;
    model?: string;
  }): Promise<{
    success: boolean;
    model: string;
    message: string;
    latencyMs: number;
  }> {
    return request('/api/admin/gemini-test', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // ----------------------------------------------------
  // Category 3: Manager Leaderboard & Activity Feed
  // ----------------------------------------------------
  async getLeaderboard(period: 'today' | 'week' | 'month' | 'all' = 'today'): Promise<LeaderboardStats> {
    return request(`/api/manager/leaderboard?period=${period}`);
  },

  // ----------------------------------------------------
  // Colleague Assistance Tickets (Lead Takeover)
  // ----------------------------------------------------
  async getAssistanceTickets(params?: {
    scope?: 'incoming' | 'outgoing' | 'my' | 'all';
    status?: 'pending' | 'accepted' | 'cancelled' | 'all';
    leadId?: string;
  }): Promise<{ success: boolean; tickets: AssistanceTicket[] }> {
    const query = new URLSearchParams();
    if (params?.scope) query.set('scope', params.scope);
    if (params?.status) query.set('status', params.status);
    if (params?.leadId) query.set('leadId', params.leadId);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request(`/api/assistance-tickets${qs}`);
  },

  async createAssistanceTicket(data: {
    leadId: string;
    reason: AssistanceReason;
    reasonLabel?: string;
    notes: string;
    targetAgentId?: string | null;
    targetAgentName?: string | null;
  }): Promise<{ success: boolean; ticket: AssistanceTicket }> {
    return request('/api/assistance-tickets', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async acceptAssistanceTicket(ticketId: string): Promise<{
    success: boolean;
    ticket: AssistanceTicket;
    lead: Lead;
    message: string;
  }> {
    return request(`/api/assistance-tickets/${ticketId}/accept`, {
      method: 'POST',
    });
  },

  async cancelAssistanceTicket(ticketId: string): Promise<{
    success: boolean;
    ticket: AssistanceTicket;
  }> {
    return request(`/api/assistance-tickets/${ticketId}/cancel`, {
      method: 'POST',
    });
  },

  async getColleagues(): Promise<{ colleagues: User[]; teamMembers: User[] }> {
    return request('/api/colleagues');
  },
};

