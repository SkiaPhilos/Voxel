import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  Users,
  Award,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRightLeft,
  Pin,
  MessageSquare,
  TrendingUp,
  RefreshCw,
  PhoneCall,
  Search,
  Flame,
  ArrowLeft,
  X,
  Filter,
  Check,
  CheckCheck,
} from 'lucide-react';
import type { User, Lead, PinnedComment, PinnedCommentStatus, Priority } from '../types';
import { api } from '../lib/api';
import { UserAvatar } from './UserAvatar';
import { LeadCard } from './LeadCard';
import { StickyDirectiveFloatingLayer } from './StickyDirectiveIndicator';
import { ReassignLeadModal } from './ReassignLeadModal';
import { PinDirectiveModal } from './PinDirectiveModal';
import { formatFriendlyTime } from '../lib/dateUtils';

interface ManagerDashboardViewProps {
  currentUser: User;
  leads: Lead[];
  onLeadUpdated?: (lead: Lead) => void;
  onSelectLead?: (lead: Lead) => void;
  onLogCall?: (lead: Lead) => void;
  onTogglePriority?: (lead: Lead) => void;
}

export const ManagerDashboardView: React.FC<ManagerDashboardViewProps> = ({
  currentUser,
  leads,
  onLeadUpdated,
  onSelectLead,
  onLogCall,
  onTogglePriority,
}) => {
  // Mode: null = Team Overview, or User = Reviewing Agent Pipeline
  const [reviewingAgent, setReviewingAgent] = useState<User | null>(null);

  // Team Overview State
  const [stats, setStats] = useState<any>(null);
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [allPinnedComments, setAllPinnedComments] = useState<PinnedComment[]>([]);
  const [isLoadingTeam, setIsLoadingTeam] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Review Mode State
  const [reviewTab, setReviewTab] = useState<'active' | 'all' | 'closed' | 'archive'>('active');
  const [agentLeads, setAgentLeads] = useState<Lead[]>([]);
  const [agentPinnedComments, setAgentPinnedComments] = useState<PinnedComment[]>([]);
  const [isLoadingAgentLeads, setIsLoadingAgentLeads] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityOnly, setPriorityOnly] = useState(false);
  const [outcomeFilter, setOutcomeFilter] = useState('all');

  // Reassignment Modal State
  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);
  const [leadToReassign, setLeadToReassign] = useState<Lead | null>(null);

  // Pin Directive Modal State
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [leadToPin, setLeadToPin] = useState<Lead | null>(null);
  const [pinCallLogId, setPinCallLogId] = useState<string | undefined>(undefined);
  const [pinCallLogSnippet, setPinCallLogSnippet] = useState<string | undefined>(undefined);

  // Load Team Overview data
  const loadTeamData = async () => {
    setIsLoadingTeam(true);
    setError(null);
    try {
      const [statsRes, teamRes, commentsRes] = await Promise.all([
        api.getManagerDashboardStats().catch(() => null),
        api.getManagerTeam().catch(() => ({ teamMembers: [] })),
        api.getPinnedComments().catch(() => ({ comments: [] })),
      ]);

      if (statsRes) setStats(statsRes);
      if (teamRes?.teamMembers) setTeamMembers(teamRes.teamMembers);
      if (commentsRes?.comments) setAllPinnedComments(commentsRes.comments);
    } catch (err: any) {
      setError(err.message || 'Failed to load team data');
    } finally {
      setIsLoadingTeam(false);
    }
  };

  useEffect(() => {
    loadTeamData();
  }, []);

  // Load Agent Leads when in Review Mode
  const loadAgentLeads = useCallback(
    async (agentId: string, view: 'active' | 'all' | 'closed' | 'archive', search?: string) => {
      setIsLoadingAgentLeads(true);
      try {
        const [leadsRes, commentsRes] = await Promise.all([
          api.getLeads(view, search || undefined, agentId),
          api.getPinnedComments({ agentId }),
        ]);
        setAgentLeads(leadsRes.leads || []);
        setAgentPinnedComments(commentsRes.comments || []);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch agent leads');
      } finally {
        setIsLoadingAgentLeads(false);
      }
    },
    []
  );

  useEffect(() => {
    if (reviewingAgent) {
      loadAgentLeads(reviewingAgent.id, reviewTab, searchQuery);
    }
  }, [reviewingAgent, reviewTab, loadAgentLeads]);

  // Handle lead reassignment complete
  const handleLeadReassigned = (updatedLead: Lead) => {
    if (reviewingAgent) {
      // If we are reviewing an agent and the lead was reassigned away from them, remove it immediately
      if (updatedLead.assigned_to !== reviewingAgent.id) {
        setAgentLeads((prev) => prev.filter((l) => l.id !== updatedLead.id));
      } else {
        setAgentLeads((prev) => prev.map((l) => (l.id === updatedLead.id ? updatedLead : l)));
      }
    }

    if (onLeadUpdated) onLeadUpdated(updatedLead);
    setSuccess(`Lead "${updatedLead.name}" successfully reassigned to ${updatedLead.assigned_to_name || 'new owner'}.`);
    setTimeout(() => setSuccess(null), 5000);
    // Refresh background team stats
    loadTeamData();
  };

  // Handle comment created
  const handleCommentCreated = (newComment: PinnedComment) => {
    setAllPinnedComments((prev) => [newComment, ...prev]);
    setAgentPinnedComments((prev) => [newComment, ...prev]);
    setSuccess('Directive pinned successfully.');
    setTimeout(() => setSuccess(null), 4000);
  };

  // Handle status update of pinned comment
  const handleCommentStatusUpdated = (commentId: string, newStatus: 'acknowledged' | 'done') => {
    const updateFn = (c: PinnedComment) =>
      c.id === commentId
        ? { ...c, status: newStatus, acknowledged_at: newStatus === 'acknowledged' ? new Date().toISOString() : c.acknowledged_at }
        : c;

    setAllPinnedComments((prev) => prev.map(updateFn));
    setAgentPinnedComments((prev) => prev.map(updateFn));
  };

  // Filter agent leads locally for quick search / priority
  const filteredAgentLeads = agentLeads.filter((lead) => {
    if (priorityOnly && lead.priority !== 'High') return false;
    if (outcomeFilter !== 'all') {
      const lastOutcome = lead.call_logs && lead.call_logs.length > 0 ? lead.call_logs[0].outcome_tag : null;
      if (lastOutcome !== outcomeFilter) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const match =
        lead.name.toLowerCase().includes(q) ||
        lead.phone.toLowerCase().includes(q) ||
        (lead.email && lead.email.toLowerCase().includes(q)) ||
        lead.business_notes.toLowerCase().includes(q) ||
        (lead.business_info && lead.business_info.toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  });

  const summary = stats?.summary || {
    totalTeamLeads: leads.length,
    maturedCount: leads.filter((l) => l.status === 'Matured (Closed)').length,
    activeCount: leads.filter((l) => l.status === 'Active' || l.status === 'Follow-up Scheduled').length,
    deniedCount: leads.filter((l) => l.status === 'Service Denied').length,
    teamSize: teamMembers.length,
    flaggedCount: 0,
  };

  const members = stats?.members || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Notifications */}
      {success && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between shadow-2xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{success}</span>
          </div>
          <button onClick={() => setSuccess(null)} className="text-emerald-700 hover:text-emerald-900 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center justify-between shadow-2xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-700 hover:text-rose-900 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 1: REVIEWING SPECIFIC AGENT PIPELINE                                  */}
      {/* ========================================================================= */}
      {reviewingAgent ? (
        <div className="space-y-5">
          {/* Prominent Sticky Persistent Review Banner */}
          <div className="sticky top-0 z-20 bg-stone-900 text-white rounded-2xl p-4 sm:p-5 shadow-lg border border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in slide-in-from-top-2 duration-150">
            <div className="flex items-center gap-3 min-w-0">
              <UserAvatar user={reviewingAgent} size="md" />
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Review Mode
                  </span>
                  <h2 className="text-base sm:text-lg font-bold truncate text-white">
                    Reviewing leads for {reviewingAgent.name}
                  </h2>
                </div>
                <div className="text-xs text-stone-300 font-mono truncate">{reviewingAgent.email}</div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
              <div className="flex items-center gap-2 text-xs bg-stone-800/80 px-3 py-1.5 rounded-xl border border-stone-700">
                <span className="text-stone-400">Pipeline:</span>
                <span className="font-bold text-white">{agentLeads.length} leads</span>
                {agentPinnedComments.filter((c) => c.status !== 'done').length > 0 && (
                  <span className="flex items-center gap-1 text-amber-400 font-bold ml-1">
                    <Pin className="w-3 h-3 fill-amber-400" />
                    <span>{agentPinnedComments.filter((c) => c.status !== 'done').length} pinned</span>
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => setReviewingAgent(null)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 active:bg-amber-900 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Exit Review / Back to Team</span>
              </button>
            </div>
          </div>

          {/* Review Filter Bar & Tabs */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-stone-200 shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-3">
              {/* Status Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                <button
                  onClick={() => setReviewTab('active')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    reviewTab === 'active'
                      ? 'bg-amber-700 text-white shadow-2xs'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  Active Pipeline
                </button>
                <button
                  onClick={() => setReviewTab('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    reviewTab === 'all'
                      ? 'bg-amber-700 text-white shadow-2xs'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  All Leads
                </button>
                <button
                  onClick={() => setReviewTab('closed')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    reviewTab === 'closed'
                      ? 'bg-amber-700 text-white shadow-2xs'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  Closed Deals
                </button>
                <button
                  onClick={() => setReviewTab('archive')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    reviewTab === 'archive'
                      ? 'bg-amber-700 text-white shadow-2xs'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  Archive
                </button>
              </div>

              {/* Priority & Refresh Controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPriorityOnly(!priorityOnly)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-all cursor-pointer ${
                    priorityOnly
                      ? 'bg-amber-100 text-amber-900 border-amber-400 font-bold shadow-2xs'
                      : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                  }`}
                >
                  <Flame className={`w-3.5 h-3.5 ${priorityOnly ? 'text-amber-600' : 'text-stone-400'}`} />
                  <span>High Priority Only</span>
                </button>

                <button
                  onClick={() => loadAgentLeads(reviewingAgent.id, reviewTab, searchQuery)}
                  disabled={isLoadingAgentLeads}
                  title="Refresh agent leads"
                  className="p-2 rounded-xl text-stone-500 hover:text-stone-800 hover:bg-stone-100 border border-stone-200 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAgentLeads ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Search and Outcome Filter Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="sm:col-span-2 relative">
                <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`Search ${reviewingAgent.name}'s leads by name, phone, or notes...`}
                  className="w-full pl-10 pr-4 py-2 bg-[#FAF8F5] border border-stone-200 rounded-xl text-stone-900 text-xs focus:outline-hidden focus:ring-2 focus:ring-amber-700"
                />
              </div>

              <div>
                <select
                  value={outcomeFilter}
                  onChange={(e) => setOutcomeFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FAF8F5] border border-stone-200 rounded-xl text-stone-700 text-xs focus:outline-hidden cursor-pointer"
                >
                  <option value="all">All Outcome Tags</option>
                  <option value="Interested">Interested</option>
                  <option value="Call Back Later">Call Back Later</option>
                  <option value="Busy">Line Busy</option>
                  <option value="Couldn't Connect">Couldn't Connect</option>
                  <option value="Closed/Matured">Closed/Matured</option>
                  <option value="Service Denied">Service Denied</option>
                </select>
              </div>
            </div>
          </div>

          {/* Scroll-Tracking Dock Indicator for Pinned Directives */}
          <StickyDirectiveFloatingLayer
            pinnedComments={agentPinnedComments}
            currentUser={currentUser}
            onStatusUpdated={handleCommentStatusUpdated}
          />

          {/* Leads Cards Grid using the EXISTING LeadCard component */}
          {isLoadingAgentLeads ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-stone-200 shadow-2xs">
              <RefreshCw className="w-6 h-6 text-amber-700 animate-spin mx-auto mb-2" />
              <p className="text-xs text-stone-500 font-medium">Loading {reviewingAgent.name}&apos;s pipeline...</p>
            </div>
          ) : filteredAgentLeads.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-stone-200 shadow-2xs space-y-2">
              <Users className="w-8 h-8 text-stone-300 mx-auto" />
              <h3 className="text-sm font-bold text-stone-800">No leads found in this view</h3>
              <p className="text-xs text-stone-500 max-w-md mx-auto">
                {searchQuery
                  ? `No leads matched "${searchQuery}". Try clearing your search or filter.`
                  : `${reviewingAgent.name} currently has no leads under the "${reviewTab}" tab.`}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAgentLeads.map((lead) => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  currentUser={currentUser}
                  pinnedComments={agentPinnedComments}
                  onLogCall={(l) => onLogCall?.(l)}
                  onOpenDetail={(l) => onSelectLead?.(l)}
                  onTogglePriority={(l) => onTogglePriority?.(l)}
                  onReassign={(l) => {
                    setLeadToReassign(l);
                    setIsReassignModalOpen(true);
                  }}
                  onPinDirective={(l) => {
                    setLeadToPin(l);
                    setPinCallLogId(undefined);
                    setPinCallLogSnippet(undefined);
                    setIsPinModalOpen(true);
                  }}
                  onPinCallLog={(l, callLogId, snippet) => {
                    setLeadToPin(l);
                    setPinCallLogId(callLogId);
                    setPinCallLogSnippet(snippet);
                    setIsPinModalOpen(true);
                  }}
                  onCommentStatusUpdated={handleCommentStatusUpdated}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ========================================================================= */
        /* MODE 2: TEAM OVERVIEW & AGENT MANAGEMENT LIST                             */
        /* ========================================================================= */
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-stone-200">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-700 text-amber-50 flex items-center justify-center shadow-xs">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold text-stone-900 tracking-tight">Manage Agents</h1>
                    <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900">
                      Team Oversight
                    </span>
                  </div>
                  <p className="text-xs text-stone-500">
                    Supervise assigned agents, review individual agent pipelines, reassign leads, and pin directives.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={loadTeamData}
                disabled={isLoadingTeam}
                className="p-2 text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer disabled:opacity-50 border border-stone-200"
                title="Refresh team stats"
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingTeam ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Summary KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-4 bg-white rounded-2xl border border-stone-200 shadow-2xs">
              <div className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Total Leads</div>
              <div className="text-2xl font-black text-stone-900 mt-1">{summary.totalTeamLeads}</div>
              <div className="text-[10px] text-stone-400 mt-0.5">Team pipeline</div>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-stone-200 shadow-2xs">
              <div className="text-[11px] font-bold text-teal-700 uppercase tracking-wider">Matured (Closed)</div>
              <div className="text-2xl font-black text-teal-900 mt-1">{summary.maturedCount}</div>
              <div className="text-[10px] text-teal-600 mt-0.5">Closed deals</div>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-stone-200 shadow-2xs">
              <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Active Pipeline</div>
              <div className="text-2xl font-black text-amber-900 mt-1">{summary.activeCount}</div>
              <div className="text-[10px] text-amber-600 mt-0.5">In follow-up</div>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-stone-200 shadow-2xs">
              <div className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Service Denied</div>
              <div className="text-2xl font-black text-stone-700 mt-1">{summary.deniedCount}</div>
              <div className="text-[10px] text-stone-400 mt-0.5">Declined</div>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-stone-200 shadow-2xs">
              <div className="text-[11px] font-bold text-stone-600 uppercase tracking-wider">Team Size</div>
              <div className="text-2xl font-black text-stone-900 mt-1">{summary.teamSize}</div>
              <div className="text-[10px] text-stone-400 mt-0.5">Assigned agents</div>
            </div>

            <div
              className={`p-4 rounded-2xl border shadow-2xs ${
                summary.flaggedCount > 0 ? 'bg-rose-50 border-rose-200' : 'bg-white border-stone-200'
              }`}
            >
              <div
                className={`text-[11px] font-bold uppercase tracking-wider ${
                  summary.flaggedCount > 0 ? 'text-rose-700' : 'text-stone-500'
                }`}
              >
                Flagged Agents
              </div>
              <div className={`text-2xl font-black mt-1 ${summary.flaggedCount > 0 ? 'text-rose-900' : 'text-stone-900'}`}>
                {summary.flaggedCount}
              </div>
              <div
                className={`text-[10px] mt-0.5 ${
                  summary.flaggedCount > 0 ? 'text-rose-600 font-semibold' : 'text-stone-400'
                }`}
              >
                {summary.flaggedCount > 0 ? 'Averaging < 3 leads/day' : 'All targets healthy'}
              </div>
            </div>
          </div>

          {/* SECTION 1: ASSIGNED AGENTS CARDS (Direct Access to Reviewing Each Agent) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-amber-700" />
                  <span>Assigned Agents &amp; Team Members ({teamMembers.length})</span>
                </h2>
                <p className="text-xs text-stone-500">
                  Click &ldquo;Review Pipeline&rdquo; on any agent to inspect their leads, reassign contacts, or pin directives.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {members.length === 0 ? (
                <div className="col-span-full p-8 text-center bg-white rounded-2xl border border-dashed border-stone-200">
                  <Users className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                  <p className="text-xs text-stone-500">No assigned agents found under your management.</p>
                </div>
              ) : (
                members.map((item: any) => {
                  const memberUser: User = item.user;
                  const isCurrentManager = memberUser.id === currentUser.id;
                  const p = item.performance || {};
                  const isFlagged = p.isFlaggedLowVolume;
                  const inGrace = p.inGracePeriod;

                  return (
                    <div
                      key={memberUser.id}
                      className="p-5 bg-white rounded-2xl border border-stone-200 hover:border-amber-300 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between space-y-4"
                    >
                      {/* Header with Avatar & Details */}
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <UserAvatar user={memberUser} size="md" />
                            <div className="min-w-0">
                              <div className="font-bold text-stone-900 text-sm truncate flex items-center gap-1.5">
                                <span>{memberUser.name}</span>
                                {isCurrentManager && (
                                  <span className="text-[10px] bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded font-normal">
                                    You
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-stone-400 font-mono truncate">{memberUser.email}</div>
                            </div>
                          </div>

                          <span className="px-2 py-0.5 rounded-md text-[10px] uppercase font-bold tracking-wider bg-stone-100 text-stone-700 shrink-0">
                            {memberUser.role}
                          </span>
                        </div>

                        {/* Lead Breakdown Counts */}
                        <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-stone-100 text-center">
                          <div className="p-2 rounded-xl bg-[#FAF8F5]">
                            <div className="text-[10px] font-bold text-stone-400 uppercase">Active</div>
                            <div className="text-base font-black text-amber-900 mt-0.5">
                              {item.activeCount ?? 0}
                            </div>
                          </div>
                          <div className="p-2 rounded-xl bg-[#FAF8F5]">
                            <div className="text-[10px] font-bold text-stone-400 uppercase">Closed</div>
                            <div className="text-base font-black text-teal-900 mt-0.5">
                              {item.closedCount ?? 0}
                            </div>
                          </div>
                          <div className="p-2 rounded-xl bg-[#FAF8F5]">
                            <div className="text-[10px] font-bold text-stone-400 uppercase">Total</div>
                            <div className="text-base font-black text-stone-900 mt-0.5">
                              {item.leadsCount ?? 0}
                            </div>
                          </div>
                        </div>

                        {/* Last Activity & Performance Badge */}
                        <div className="flex items-center justify-between gap-2 mt-3 text-[11px]">
                          <span className="text-stone-400 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-stone-300" />
                            <span>
                              {item.lastActivityAt
                                ? `Active ${formatFriendlyTime(item.lastActivityAt)}`
                                : 'No activity yet'}
                            </span>
                          </span>

                          {inGrace ? (
                            <span className="text-[10px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                              Grace ({p.gracePeriodDaysLeft}d)
                            </span>
                          ) : isFlagged ? (
                            <span className="text-[10px] font-bold text-rose-800 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                              Low Vol Alert
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              Healthy
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Primary CTA: Review Agent Pipeline */}
                      <button
                        type="button"
                        onClick={() => {
                          setReviewingAgent(memberUser);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="w-full py-2.5 px-3 rounded-xl bg-amber-700 hover:bg-amber-800 active:bg-amber-900 text-white text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <span>Review Agent Pipeline</span>
                        <span>&rarr;</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* SECTION 2: PERFORMANCE & INTEGRITY SCORING TABLE */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-2xs overflow-hidden">
            <div className="p-4 bg-[#FAF8F5] border-b border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-700" />
                <h2 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                  Performance &amp; Integrity Audit
                </h2>
              </div>
              <span className="text-[11px] text-stone-500">
                14-day initial grace period excluded &bull; Threshold: &ge; 3 leads / working day
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF8F5] border-b border-stone-200 text-[11px] font-bold text-stone-600 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Team Member</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3 text-center">Leads</th>
                    <th className="px-4 py-3 text-center">Calls</th>
                    <th className="px-4 py-3 text-center">Closed</th>
                    <th className="px-4 py-3">Working Days (Post-Grace)</th>
                    <th className="px-4 py-3">Daily Average</th>
                    <th className="px-4 py-3">Integrity Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {members.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-stone-400">
                        No team members assigned or found under your supervision.
                      </td>
                    </tr>
                  ) : (
                    members.map((item: any) => {
                      const p = item.performance;
                      const isFlagged = p.isFlaggedLowVolume;
                      const inGrace = p.inGracePeriod;

                      return (
                        <tr
                          key={item.user.id}
                          className={`hover:bg-stone-50/80 transition-colors ${
                            isFlagged ? 'bg-rose-50/40' : ''
                          }`}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <UserAvatar user={item.user} size="sm" />
                              <div>
                                <div className="font-bold text-stone-900">{item.user.name}</div>
                                <div className="text-[11px] text-stone-400 font-mono">{item.user.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-stone-100 text-stone-700">
                              {item.user.role}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-stone-900">{item.leadsCount}</td>
                          <td className="px-4 py-3 text-center font-mono text-stone-700">{item.totalCalls}</td>
                          <td className="px-4 py-3 text-center font-bold text-teal-700">{item.closedCount}</td>
                          <td className="px-4 py-3 font-mono text-stone-600">
                            {inGrace ? (
                              <span className="text-stone-400 italic">Grace Period</span>
                            ) : (
                              `${p.workingDaysDenominator} workdays`
                            )}
                          </td>
                          <td className="px-4 py-3 font-bold">
                            {inGrace ? (
                              <span className="text-stone-400">&mdash;</span>
                            ) : (
                              <span className={isFlagged ? 'text-rose-700' : 'text-emerald-700'}>
                                {p.dailyAverage.toFixed(1)} / day
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {inGrace ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                <Clock className="w-3 h-3 text-amber-600" />
                                <span>Grace Period ({p.gracePeriodDaysLeft}d left)</span>
                              </span>
                            ) : isFlagged ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-900 border border-rose-300 animate-pulse">
                                <AlertTriangle className="w-3 h-3 text-rose-700" />
                                <span>Low Volume Alert (&lt; 3/day)</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Healthy (&ge; 3/day)</span>
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => {
                                setReviewingAgent(item.user);
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                              className="text-xs font-bold text-amber-800 hover:text-amber-950 hover:underline cursor-pointer"
                            >
                              Review &rarr;
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION 3: RECENT PINNED DIRECTIVES SUMMARY */}
          <div className="p-5 bg-white rounded-2xl border border-stone-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <Pin className="w-4 h-4 text-amber-700" />
                <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                  Active Team Directives ({allPinnedComments.length})
                </h3>
              </div>
              <span className="text-[11px] text-stone-400">
                Directives pinned to leads or call logs across your supervised agents
              </span>
            </div>

            {allPinnedComments.length === 0 ? (
              <p className="text-xs text-stone-400 italic py-4 text-center">
                No active pinned directives. You can attach directives directly to any lead or call log while reviewing an agent.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-1">
                {allPinnedComments.map((comment) => (
                  <div
                    key={comment.id}
                    className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                      comment.status === 'unacknowledged'
                        ? 'bg-amber-50/70 border-amber-300'
                        : comment.status === 'done'
                        ? 'bg-emerald-50/50 border-emerald-200 opacity-80'
                        : 'bg-[#FAF8F5] border-stone-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-stone-900 truncate">
                        {comment.lead_name ? `Lead: ${comment.lead_name}` : 'General Directive'}
                      </span>
                      <span
                        className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                          comment.status === 'done'
                            ? 'bg-emerald-100 text-emerald-800'
                            : comment.status === 'acknowledged'
                            ? 'bg-sky-100 text-sky-800'
                            : 'bg-amber-200 text-amber-950 animate-pulse'
                        }`}
                      >
                        {comment.status}
                      </span>
                    </div>

                    {comment.agent_name && (
                      <div className="text-[11px] text-stone-500">
                        Target Agent: <strong className="text-stone-800">{comment.agent_name}</strong>
                      </div>
                    )}

                    <p className={`text-stone-700 line-clamp-2 ${comment.status === 'done' ? 'line-through text-stone-400' : ''}`}>
                      {comment.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* REASSIGN LEAD MODAL */}
      <ReassignLeadModal
        isOpen={isReassignModalOpen}
        onClose={() => {
          setIsReassignModalOpen(false);
          setLeadToReassign(null);
        }}
        lead={leadToReassign}
        currentUser={currentUser}
        onReassigned={handleLeadReassigned}
      />

      {/* PIN DIRECTIVE MODAL */}
      <PinDirectiveModal
        isOpen={isPinModalOpen}
        onClose={() => {
          setIsPinModalOpen(false);
          setLeadToPin(null);
          setPinCallLogId(undefined);
          setPinCallLogSnippet(undefined);
        }}
        lead={leadToPin}
        callLogId={pinCallLogId}
        callLogSnippet={pinCallLogSnippet}
        currentUser={currentUser}
        onCommentCreated={handleCommentCreated}
      />
    </div>
  );
};
