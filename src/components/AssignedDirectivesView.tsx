import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Pin,
  CheckCircle2,
  AlertCircle,
  Clock,
  Search,
  Users,
  RefreshCw,
  Trash2,
  RotateCcw,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Phone,
  MessageSquareQuote,
  Check,
  ShieldCheck,
  UserCheck,
  Ticket,
  Handshake,
  ArrowRight,
  Layers,
  Scale,
  Briefcase,
  Globe,
  Loader2,
} from 'lucide-react';
import type { Lead, PinnedComment, PinnedCommentStatus, User, AssistanceTicket } from '../types';
import { api } from '../lib/api';
import { UserAvatar } from './UserAvatar';

interface AssignedDirectivesViewProps {
  currentUser: User;
  leads: Lead[];
  teamMembers?: User[];
  onSelectLead?: (lead: Lead) => void;
  onOpenLeadDetail?: (lead: Lead) => void;
  onReviewAgent?: (agent: User) => void;
  onLeadReassigned?: (lead: Lead) => void;
  initialSubTab?: 'directives' | 'tickets';
}

function formatFriendlyTime(isoString?: string): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

export const AssignedDirectivesView: React.FC<AssignedDirectivesViewProps> = ({
  currentUser,
  leads,
  teamMembers = [],
  onSelectLead,
  onOpenLeadDetail,
  onReviewAgent,
  onLeadReassigned,
  initialSubTab = 'directives',
}) => {
  const [activeToggle, setActiveToggle] = useState<'directives' | 'tickets'>(initialSubTab);
  const [comments, setComments] = useState<PinnedComment[]>([]);
  const [tickets, setTickets] = useState<AssistanceTicket[]>([]);
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);
  const [ticketFilter, setTicketFilter] = useState<'open' | 'all' | 'accepted_by_me'>('open');
  const [ticketSearchQuery, setTicketSearchQuery] = useState('');
  const [acceptingTicketId, setAcceptingTicketId] = useState<string | null>(null);

  const [userRoster, setUserRoster] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'unacknowledged' | 'acknowledged' | 'done'>('all');
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [scopeFilter, setScopeFilter] = useState<'my' | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Load complete user roster (admin or manager team) to hydrate names reliably
  useEffect(() => {
    let isMounted = true;
    const loadUsers = async () => {
      try {
        if (currentUser.role === 'admin') {
          const res = await api.getUsers().catch(() => null);
          if (res?.users && isMounted) {
            setUserRoster(res.users);
            return;
          }
        }
        const teamRes = await api.getManagerTeam().catch(() => null);
        if (teamRes?.teamMembers && isMounted) {
          setUserRoster(teamRes.teamMembers);
        }
      } catch (err) {
        console.warn('Failed to load user roster:', err);
      }
    };
    loadUsers();
    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  // Unified Map of Users for robust ID -> User lookup
  const userMap = useMemo(() => {
    const map = new Map<string, User>();
    map.set(currentUser.id, currentUser);
    teamMembers.forEach((u) => map.set(u.id, u));
    userRoster.forEach((u) => map.set(u.id, u));
    return map;
  }, [currentUser, teamMembers, userRoster]);

  // Map of leads by id for fast lookup
  const leadMap = useMemo(() => {
    const map = new Map<string, Lead>();
    leads.forEach((l) => map.set(l.id, l));
    return map;
  }, [leads]);

  const fetchDirectives = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const params: any = {};
      if (currentUser.role === 'admin' || currentUser.role === 'manager') {
        params.authorId = scopeFilter === 'my' ? currentUser.id : 'all';
      }
      const res = await api.getPinnedComments(params);
      setComments(res.comments || []);
    } catch (err) {
      console.error('Failed to load assigned directives:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [currentUser, scopeFilter]);

  useEffect(() => {
    fetchDirectives();
  }, [fetchDirectives]);

  const showFeedback = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  const handleToggleStatus = async (comment: PinnedComment) => {
    const newStatus: PinnedCommentStatus = comment.status === 'done' ? 'unacknowledged' : 'done';
    setUpdatingId(comment.id);
    try {
      const res = await api.updatePinnedCommentStatus(comment.id, newStatus);
      setComments((prev) =>
        prev.map((c) => (c.id === comment.id ? { ...c, ...res.comment } : c))
      );
      showFeedback(
        newStatus === 'done'
          ? `Directive on ${comment.lead_name || 'Lead'} marked as completed.`
          : `Directive on ${comment.lead_name || 'Lead'} reopened as pending.`
      );
    } catch (err: any) {
      console.error('Failed to update status:', err);
      showFeedback('Failed to update directive status.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (comment: PinnedComment) => {
    if (!window.confirm(`Are you sure you want to remove this directive for ${comment.lead_name || 'this lead'}?`)) {
      return;
    }
    setDeletingId(comment.id);
    try {
      await api.deletePinnedComment(comment.id);
      setComments((prev) => prev.filter((c) => c.id !== comment.id));
      showFeedback('Directive removed successfully.');
    } catch (err: any) {
      console.error('Failed to delete directive:', err);
      showFeedback('Failed to remove directive.');
    } finally {
      setDeletingId(null);
    }
  };

  // Helper to resolve the assigned agent's display name accurately
  const getResolvedAgentName = useCallback((comment: PinnedComment): string => {
    const lead = comment.lead_id ? leadMap.get(comment.lead_id) : undefined;
    const effectiveAgentId = comment.agent_id || lead?.assigned_to;
    const agentUser = effectiveAgentId ? userMap.get(effectiveAgentId) : undefined;

    if (comment.agent_name && comment.agent_name !== 'Assigned Agent') {
      return comment.agent_name;
    }
    if (lead?.assigned_to_name) {
      return lead.assigned_to_name;
    }
    if (agentUser?.name) {
      return agentUser.name;
    }
    if (lead?.assigned_to) {
      const matched = userMap.get(lead.assigned_to);
      if (matched?.name) return matched.name;
    }
    return 'Agent Alpha';
  }, [leadMap, userMap]);

  // Helper to resolve the author (manager/admin) display name and role
  const getResolvedAuthor = useCallback((comment: PinnedComment): {
    name: string;
    role: 'admin' | 'manager' | 'agent';
    isCurrentUser: boolean;
    avatarUrl?: string;
    email?: string;
  } => {
    const isCurrentUser = comment.author_id === currentUser.id;
    const authorUser = comment.author_id ? userMap.get(comment.author_id) : undefined;

    let name = comment.author_name;
    if (!name || name === 'Manager' || name === 'Admin') {
      name = authorUser?.name || (isCurrentUser ? currentUser.name : 'Manager');
    }

    const role = (comment.author_role || authorUser?.role || (isCurrentUser ? currentUser.role : 'manager')) as 'admin' | 'manager' | 'agent';
    const avatarUrl = comment.author_avatar_url || authorUser?.avatarUrl || (isCurrentUser ? currentUser.avatarUrl : undefined);
    const email = authorUser?.email || (isCurrentUser ? currentUser.email : undefined);

    return { name, role, isCurrentUser, avatarUrl, email };
  }, [currentUser, userMap]);

  // Distinct agent names for filter dropdown
  const uniqueAgents = useMemo(() => {
    const set = new Set<string>();
    comments.forEach((c) => {
      const name = getResolvedAgentName(c);
      if (name) set.add(name);
    });
    return Array.from(set).sort();
  }, [comments, getResolvedAgentName]);

  // Filtered comments
  const filteredComments = useMemo(() => {
    return comments.filter((c) => {
      const lead = c.lead_id ? leadMap.get(c.lead_id) : undefined;
      const agentName = getResolvedAgentName(c);
      const author = getResolvedAuthor(c);

      // If user is an agent, show only directives on their leads or assigned to them
      if (currentUser.role === 'agent') {
        const isMyDirective =
          c.agent_id === currentUser.id ||
          lead?.assigned_to === currentUser.id ||
          lead?.assigned_to === currentUser.email ||
          (agentName && agentName.toLowerCase() === currentUser.name.toLowerCase());
        if (!isMyDirective) {
          return false;
        }
      }

      // Status filter
      if (statusFilter !== 'all' && c.status !== statusFilter) {
        return false;
      }
      // Agent filter
      if (agentFilter !== 'all' && agentName !== agentFilter) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchLeadName = (c.lead_name || lead?.name || '').toLowerCase().includes(q);
        const matchLeadPhone = (c.lead_phone || lead?.phone || '').toLowerCase().includes(q);
        const matchAgentName = agentName.toLowerCase().includes(q);
        const matchAuthorName = author.name.toLowerCase().includes(q);
        const matchAuthorRole = author.role.toLowerCase().includes(q);
        const matchContent = c.content.toLowerCase().includes(q);
        const matchCallSnippet = (c.call_log_snippet || '').toLowerCase().includes(q);
        if (
          !matchLeadName &&
          !matchLeadPhone &&
          !matchAgentName &&
          !matchAuthorName &&
          !matchAuthorRole &&
          !matchContent &&
          !matchCallSnippet
        ) {
          return false;
        }
      }
      return true;
    });
  }, [comments, statusFilter, agentFilter, searchQuery, leadMap, getResolvedAgentName, getResolvedAuthor, currentUser]);

  // Ticket fetching and acceptance
  const fetchTickets = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoadingTickets(true);
    try {
      const res = await api.getAssistanceTickets({ scope: 'all' });
      setTickets(res.tickets || []);
    } catch (err) {
      console.error('Failed to load assistance tickets:', err);
    } finally {
      setIsLoadingTickets(false);
    }
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const handleAcceptTicket = async (ticket: AssistanceTicket) => {
    setAcceptingTicketId(ticket.id);
    try {
      const res = await api.acceptAssistanceTicket(ticket.id);
      setTickets((prev) =>
        prev.map((t) => (t.id === ticket.id ? res.ticket : t))
      );
      showFeedback(`Lead ${res.lead.name} successfully taken over! Assigned to you.`);
      if (onLeadReassigned) {
        onLeadReassigned(res.lead);
      }
    } catch (err: any) {
      console.error('Failed to accept assistance ticket:', err);
      showFeedback(err?.message || 'Failed to accept takeover ticket');
    } finally {
      setAcceptingTicketId(null);
    }
  };

  // Filtered tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      // If targeted to a specific colleague, only show if target matches current user
      if (t.target_agent_id && t.target_agent_id !== currentUser.id && t.target_agent_id !== currentUser.email) {
        return false;
      }

      if (ticketFilter === 'open') {
        if (t.status !== 'pending') return false;
        // Don't show current user's own outgoing tickets here (they are under Ask Assistance)
        if (t.requested_by_id === currentUser.id) return false;
      } else if (ticketFilter === 'accepted_by_me') {
        if (t.status !== 'accepted' || t.accepted_by_id !== currentUser.id) return false;
      }

      if (ticketSearchQuery.trim()) {
        const q = ticketSearchQuery.toLowerCase();
        const matchLead = (t.lead_name || '').toLowerCase().includes(q);
        const matchPhone = (t.lead_phone || '').toLowerCase().includes(q);
        const matchCompany = (t.lead_company || '').toLowerCase().includes(q);
        const matchRequester = (t.requested_by_name || '').toLowerCase().includes(q);
        const matchReason = (t.reason_label || '').toLowerCase().includes(q);
        const matchNotes = (t.notes || '').toLowerCase().includes(q);
        if (!matchLead && !matchPhone && !matchCompany && !matchRequester && !matchReason && !matchNotes) {
          return false;
        }
      }
      return true;
    });
  }, [tickets, ticketFilter, ticketSearchQuery, currentUser]);

  // Metrics
  const totalCount = filteredComments.length;
  const doneCount = filteredComments.filter((c) => c.status === 'done').length;
  const ackCount = filteredComments.filter((c) => c.status === 'acknowledged').length;
  const unackCount = filteredComments.filter((c) => c.status === 'unacknowledged').length;
  const notDoneCount = totalCount - doneCount;
  const completionRate = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  const openTicketsCount = tickets.filter(
    (t) =>
      t.status === 'pending' &&
      t.requested_by_id !== currentUser.id &&
      (!t.target_agent_id || t.target_agent_id === currentUser.id || t.target_agent_id === currentUser.email)
  ).length;

  const acceptedByMeCount = tickets.filter(
    (t) => t.status === 'accepted' && t.accepted_by_id === currentUser.id
  ).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Toast Feedback Notification */}
      {feedbackMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-stone-900 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-xl border border-stone-700 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* Top Toggle Switcher: Directives vs Tickets */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center bg-[#FAF8F5] p-1.5 rounded-2xl border border-stone-200/90 shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveToggle('directives')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeToggle === 'directives'
                ? 'bg-white text-stone-900 shadow-xs border border-stone-200/70 font-black'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            <Pin className={`w-3.5 h-3.5 ${activeToggle === 'directives' ? 'text-amber-700 fill-amber-700' : 'text-stone-400'}`} />
            <span>Directives</span>
            {notDoneCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                {notDoneCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveToggle('tickets')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeToggle === 'tickets'
                ? 'bg-white text-stone-900 shadow-xs border border-stone-200/70 font-black'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            <Ticket className={`w-3.5 h-3.5 ${activeToggle === 'tickets' ? 'text-amber-700' : 'text-stone-400'}`} />
            <span>Tickets</span>
            {openTicketsCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-amber-950 animate-pulse">
                {openTicketsCount}
              </span>
            )}
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            if (activeToggle === 'directives') fetchDirectives(true);
            else fetchTickets(true);
          }}
          disabled={isRefreshing || isLoading || isLoadingTickets}
          className="p-2.5 px-3.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing || isLoadingTickets ? 'animate-spin text-amber-700' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* TOGGLE 1: DIRECTIVES */}
      {activeToggle === 'directives' && (
        <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-stone-200/90 p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-700 text-white flex items-center justify-center shadow-xs">
                <Pin className="w-5 h-5 fill-white" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-stone-900 flex items-center gap-2">
                  <span>Assigned Directives &amp; Tasks</span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                    {totalCount} Total
                  </span>
                </h1>
                <p className="text-xs text-stone-500">
                  Track instructions written by Managers and Admins on leads, and monitor whether assigned agents have executed them.
                </p>
              </div>
            </div>
          </div>

          {/* Top Controls: Scope Toggle + Refresh */}
          <div className="flex items-center gap-2 self-start md:self-auto">
            {(currentUser.role === 'admin' || currentUser.role === 'manager') && (
              <div className="flex items-center bg-[#FAF8F5] p-1 rounded-xl border border-stone-200 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setScopeFilter('all')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    scopeFilter === 'all'
                      ? 'bg-white text-stone-900 shadow-2xs font-bold'
                      : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  All Directives
                </button>
                <button
                  type="button"
                  onClick={() => setScopeFilter('my')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    scopeFilter === 'my'
                      ? 'bg-white text-stone-900 shadow-2xs font-bold'
                      : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  My Directives
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => fetchDirectives(true)}
              disabled={isRefreshing || isLoading}
              className="p-2.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              title="Refresh directives and statuses"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-amber-700' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* KPI Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-stone-100">
          <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-stone-200/80 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">Not Done / Pending</span>
              <AlertCircle className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-black text-amber-900">{notDoneCount}</div>
            <p className="text-[11px] text-stone-400">
              {unackCount} unread &bull; {ackCount} in progress
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-stone-200/80 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">Completed (Done)</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-emerald-800">{doneCount}</div>
            <p className="text-[11px] text-stone-400">Executed by target agents</p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-stone-200/80 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">In Progress</span>
              <Clock className="w-4 h-4 text-sky-600" />
            </div>
            <div className="text-2xl font-black text-sky-900">{ackCount}</div>
            <p className="text-[11px] text-stone-400">Acknowledged by agent</p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-stone-200/80 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">Completion Rate</span>
              <Sparkles className="w-4 h-4 text-teal-600" />
            </div>
            <div className="text-2xl font-black text-stone-900">{completionRate}%</div>
            <div className="w-full bg-stone-200 rounded-full h-1.5 mt-1 overflow-hidden">
              <div
                className="bg-emerald-600 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${completionRate}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Status Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-amber-700 text-white shadow-2xs font-bold'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200/70'
              }`}
            >
              All ({totalCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('unacknowledged')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'unacknowledged'
                  ? 'bg-amber-600 text-white shadow-2xs font-bold'
                  : 'bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-200/80'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Pending Action ({unackCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('acknowledged')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'acknowledged'
                  ? 'bg-sky-700 text-white shadow-2xs font-bold'
                  : 'bg-sky-50 text-sky-900 hover:bg-sky-100 border border-sky-200/80'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Acknowledged ({ackCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('done')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'done'
                  ? 'bg-emerald-700 text-white shadow-2xs font-bold'
                  : 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100 border border-emerald-200/80'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Completed / Done ({doneCount})</span>
            </button>
          </div>

          {/* Search Input & Agent Dropdown */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {uniqueAgents.length > 0 && (
              <div className="flex items-center gap-1.5 bg-[#FAF8F5] border border-stone-200 rounded-xl px-2.5 py-1.5">
                <Users className="w-3.5 h-3.5 text-stone-500" />
                <select
                  value={agentFilter}
                  onChange={(e) => setAgentFilter(e.target.value)}
                  className="bg-transparent text-xs text-stone-800 font-semibold focus:outline-none cursor-pointer"
                >
                  <option value="all">All Agents ({uniqueAgents.length})</option>
                  {uniqueAgents.map((agent) => (
                    <option key={agent} value={agent}>
                      Agent: {agent}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search lead, directive, agent, or manager..."
                className="w-full sm:w-64 pl-8 pr-3 py-1.5 bg-[#FAF8F5] border border-stone-200 rounded-xl text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-amber-700 focus:bg-white transition-all"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Directives List */}
      {isLoading ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-amber-700 animate-spin mx-auto" />
          <p className="text-xs font-bold text-stone-600">Loading assigned directives...</p>
        </div>
      ) : filteredComments.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-stone-200 p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center mx-auto">
            <Pin className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-stone-900">No matching directives found</h3>
            <p className="text-xs text-stone-500 max-w-sm mx-auto mt-1">
              {searchQuery || statusFilter !== 'all' || agentFilter !== 'all'
                ? 'Try clearing your filters or search query to view other directives.'
                : "No directives currently in this view. You can pin directives to leads while reviewing agent pipelines."}
            </p>
          </div>
          {(searchQuery || statusFilter !== 'all' || agentFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setStatusFilter('all');
                setAgentFilter('all');
                setSearchQuery('');
              }}
              className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-xs font-bold text-stone-700 transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredComments.map((comment) => {
            const isDone = comment.status === 'done';
            const isAck = comment.status === 'acknowledged';
            const matchedLead = comment.lead_id ? leadMap.get(comment.lead_id) : undefined;
            const author = getResolvedAuthor(comment);
            const resolvedAgentName = getResolvedAgentName(comment);
            const effectiveAgentId = comment.agent_id || matchedLead?.assigned_to;
            const agentUser = effectiveAgentId ? userMap.get(effectiveAgentId) : undefined;

            return (
              <div
                key={comment.id}
                className={`bg-white rounded-2xl border transition-all duration-200 shadow-2xs hover:shadow-xs flex flex-col justify-between overflow-hidden ${
                  isDone
                    ? 'border-emerald-200/90 bg-emerald-50/10'
                    : isAck
                    ? 'border-sky-200 bg-sky-50/10'
                    : 'border-amber-300 bg-amber-50/15'
                }`}
              >
                {/* Top Status Header Banner */}
                <div
                  className={`px-4 py-2.5 flex items-center justify-between border-b text-xs font-semibold ${
                    isDone
                      ? 'bg-emerald-50/80 border-emerald-100 text-emerald-900'
                      : isAck
                      ? 'bg-sky-50/80 border-sky-100 text-sky-900'
                      : 'bg-amber-100/70 border-amber-200 text-amber-950'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isDone ? (
                      <span className="inline-flex items-center gap-1.5 font-bold text-emerald-800">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Done by Agent</span>
                      </span>
                    ) : isAck ? (
                      <span className="inline-flex items-center gap-1.5 font-bold text-sky-800">
                        <Clock className="w-4 h-4 text-sky-600 shrink-0" />
                        <span>In Progress (Acknowledged)</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 font-bold text-amber-900">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 animate-pulse" />
                        <span>Not Done (Pending Agent Action)</span>
                      </span>
                    )}

                    <span className="text-[11px] text-stone-400">&bull;</span>
                    <span className="text-[11px] font-normal text-stone-500">
                      {isDone
                        ? `Done ${formatFriendlyTime(comment.done_at)}`
                        : isAck
                        ? `Seen ${formatFriendlyTime(comment.acknowledged_at)}`
                        : `Assigned ${formatFriendlyTime(comment.created_at)}`}
                    </span>
                  </div>

                  {/* Quick Action: Toggle Done / Reopen */}
                  <button
                    type="button"
                    onClick={() => handleToggleStatus(comment)}
                    disabled={updatingId === comment.id}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                      isDone
                        ? 'bg-white hover:bg-stone-100 text-stone-700 border border-stone-200'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs'
                    } disabled:opacity-50`}
                    title={isDone ? 'Reopen this directive as pending' : 'Mark this directive as completed'}
                  >
                    {updatingId === comment.id ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : isDone ? (
                      <>
                        <RotateCcw className="w-3 h-3" />
                        <span>Reopen</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3 h-3" />
                        <span>Mark Done</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Card Body */}
                <div className="p-4 sm:p-5 space-y-4 flex-1">
                  {/* STAKEHOLDERS: WHO ISSUED DIRECTIVE (Manager/Admin) & WHO IS ASSIGNED (Agent) */}
                  <div className="p-3 rounded-xl bg-stone-50/90 border border-stone-200 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Left: Issued By (Manager / Admin) */}
                      <div className="flex items-start gap-2.5 min-w-0">
                        <UserAvatar
                          user={{
                            id: comment.author_id || 'author',
                            name: author.name,
                            email: author.email || '',
                            role: author.role,
                            avatarUrl: author.avatarUrl,
                            created_at: '',
                          }}
                          size="sm"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-[10px] text-stone-400 font-bold uppercase tracking-wider flex items-center gap-1.5 flex-wrap">
                            <span>Directive Given By</span>
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.2 rounded-sm uppercase tracking-wider ${
                                author.role === 'admin'
                                  ? 'bg-purple-100 text-purple-900 border border-purple-200'
                                  : 'bg-amber-100 text-amber-900 border border-amber-200'
                              }`}
                            >
                              {author.role === 'admin' ? 'Admin' : 'Manager'}
                            </span>
                          </div>
                          <div className="font-bold text-stone-900 text-xs truncate flex items-center gap-1 mt-0.5">
                            <span className="truncate">{author.name}</span>
                            {author.isCurrentUser && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-amber-200 text-amber-900 shrink-0">
                                You
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-stone-400 font-mono">
                            {comment.created_at
                              ? new Date(comment.created_at).toLocaleDateString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : ''}
                          </div>
                        </div>
                      </div>

                      {/* Right: Assigned Agent (Lead Owner) */}
                      <div className="flex items-start justify-between gap-2 min-w-0 pt-2 sm:pt-0 border-t sm:border-t-0 sm:border-l border-stone-200 sm:pl-3">
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <UserAvatar
                            user={
                              agentUser || {
                                id: effectiveAgentId || 'agent',
                                name: resolvedAgentName,
                                email: comment.agent_email || '',
                                role: 'agent',
                                created_at: '',
                              }
                            }
                            size="sm"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-[10px] text-stone-400 font-bold uppercase tracking-wider flex items-center gap-1.5 flex-wrap">
                              <span>Assigned Agent</span>
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-sm bg-sky-100 text-sky-900 border border-sky-200">
                                Lead Owner
                              </span>
                            </div>
                            <div className="font-bold text-stone-900 text-xs truncate mt-0.5">
                              {resolvedAgentName}
                            </div>
                            <div className="text-[10px] text-stone-500 truncate">
                              {comment.agent_email || agentUser?.email || 'Sales Agent'}
                            </div>
                          </div>
                        </div>

                        {agentUser && onReviewAgent && (
                          <button
                            type="button"
                            onClick={() => onReviewAgent(agentUser)}
                            className="px-2 py-1 bg-white hover:bg-stone-100 text-stone-700 hover:text-amber-800 rounded-lg border border-stone-200 text-[10px] font-bold transition-colors shrink-0 cursor-pointer flex items-center gap-1 shadow-2xs"
                            title={`Review ${resolvedAgentName}'s pipeline`}
                          >
                            <span>Pipeline</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Target Lead Context Box */}
                  <div className="flex items-start justify-between gap-3 p-3 rounded-xl bg-[#FAF8F5] border border-stone-200/90">
                    <div className="space-y-0.5 min-w-0">
                      <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                        Target Lead
                      </div>
                      <div className="font-bold text-stone-900 text-xs sm:text-sm truncate flex items-center gap-2">
                        <span>{comment.lead_name || matchedLead?.name || 'Unspecified Lead'}</span>
                        {(comment.lead_phone || matchedLead?.phone) && (
                          <span className="text-xs text-stone-500 font-mono font-normal">
                            {comment.lead_phone || matchedLead?.phone}
                          </span>
                        )}
                      </div>
                      {matchedLead?.status && (
                        <div className="pt-0.5">
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-stone-200/70 text-stone-700">
                            Status: {matchedLead.status}
                          </span>
                        </div>
                      )}
                      {comment.call_log_snippet && (
                        <div className="text-[11px] text-stone-600 italic bg-white px-2.5 py-1.5 rounded-lg border border-stone-200 mt-1.5 flex items-center gap-1.5">
                          <MessageSquareQuote className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                          <span className="truncate">Call note: &ldquo;{comment.call_log_snippet}&rdquo;</span>
                        </div>
                      )}
                    </div>

                    {/* Button to jump to/inspect lead */}
                    {matchedLead && (
                      <button
                        type="button"
                        onClick={() => {
                          if (onOpenLeadDetail) onOpenLeadDetail(matchedLead);
                          else if (onSelectLead) onSelectLead(matchedLead);
                        }}
                        className="p-2 rounded-xl bg-white hover:bg-stone-100 text-stone-700 border border-stone-200 shadow-2xs transition-colors cursor-pointer shrink-0"
                        title="View Lead Details & History"
                      >
                        <ExternalLink className="w-4 h-4 text-stone-600" />
                      </button>
                    )}
                  </div>

                  {/* The Directive Note Box (Yellow Sticky / Amber Note) */}
                  <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 space-y-1.5 shadow-2xs relative">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-amber-900 flex items-center gap-1.5">
                        <Pin className="w-3.5 h-3.5 fill-amber-700 text-amber-700" />
                        <span>Directive / Task Instruction:</span>
                      </span>
                    </div>
                    <p className={`text-xs text-stone-900 font-medium leading-relaxed whitespace-pre-wrap ${isDone ? 'line-through text-stone-500' : ''}`}>
                      {comment.content}
                    </p>
                  </div>
                </div>

                {/* Bottom Footer: Lead Dial & Actions */}
                <div className="px-4 py-2.5 bg-[#FAF8F5] border-t border-stone-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3 min-w-0">
                    {matchedLead?.phone ? (
                      <a
                        href={`tel:${matchedLead.phone}`}
                        className="text-stone-600 hover:text-amber-800 font-semibold flex items-center gap-1.5 transition-colors"
                      >
                        <Phone className="w-3 h-3 text-stone-400" />
                        <span className="truncate">Call {matchedLead.phone}</span>
                      </a>
                    ) : (
                      <span className="text-stone-400 text-[11px]">No phone number</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {matchedLead && (
                      <button
                        type="button"
                        onClick={() => {
                          if (onOpenLeadDetail) onOpenLeadDetail(matchedLead);
                          else if (onSelectLead) onSelectLead(matchedLead);
                        }}
                        className="font-bold text-amber-800 hover:text-amber-950 flex items-center gap-1 cursor-pointer"
                      >
                        <span>Open Lead</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Delete Directive Action */}
                    <button
                      type="button"
                      onClick={() => handleDelete(comment)}
                      disabled={deletingId === comment.id}
                      className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer ml-1"
                      title="Delete directive"
                    >
                      {deletingId === comment.id ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
        </div>
      )}

      {/* TOGGLE 2: TICKETS (COLLEAGUE ASSISTANCE REQUESTS) */}
      {activeToggle === 'tickets' && (
        <div className="space-y-6">
          {/* Tickets Header Banner */}
          <div className="bg-white rounded-2xl border border-stone-200/90 p-5 sm:p-6 shadow-2xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-700 text-white flex items-center justify-center shadow-xs">
                    <Ticket className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h1 className="text-lg sm:text-xl font-bold text-stone-900 flex items-center gap-2">
                      <span>Colleague Assistance Requests</span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                        {openTicketsCount} Open for Takeover
                      </span>
                    </h1>
                    <p className="text-xs text-stone-500">
                      Requests from fellow agents needing someone to take over outreach due to workload or fit. Accepting a ticket reassigns the lead directly to you.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* KPI Metrics Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-6 pt-5 border-t border-stone-100">
              <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-stone-200/80 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">Open for Takeover</span>
                  <Ticket className="w-4 h-4 text-amber-600" />
                </div>
                <div className="text-2xl font-black text-amber-900">{openTicketsCount}</div>
                <p className="text-[11px] text-stone-400">Available to accept now</p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-stone-200/80 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">Taken Over by You</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-2xl font-black text-emerald-800">{acceptedByMeCount}</div>
                <p className="text-[11px] text-stone-400">Leads transferred to your pipeline</p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-stone-200/80 space-y-1 col-span-2 sm:col-span-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">Total Team Tickets</span>
                  <Handshake className="w-4 h-4 text-stone-600" />
                </div>
                <div className="text-2xl font-black text-stone-900">{tickets.length}</div>
                <p className="text-[11px] text-stone-400">All colleague assistance requests</p>
              </div>
            </div>
          </div>

          {/* Ticket Filter and Search Bar */}
          <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-2xs space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Filter Tabs */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setTicketFilter('open')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                    ticketFilter === 'open'
                      ? 'bg-amber-700 text-white shadow-2xs font-bold'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200/70'
                  }`}
                >
                  <Ticket className="w-3.5 h-3.5" />
                  <span>Open for Takeover ({openTicketsCount})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTicketFilter('accepted_by_me')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                    ticketFilter === 'accepted_by_me'
                      ? 'bg-emerald-700 text-white shadow-2xs font-bold'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200/70'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Taken Over by Me ({acceptedByMeCount})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTicketFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                    ticketFilter === 'all'
                      ? 'bg-stone-800 text-white shadow-2xs font-bold'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200/70'
                  }`}
                >
                  All Tickets ({tickets.length})
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative w-full md:w-72">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search requests, leads, notes..."
                  value={ticketSearchQuery}
                  onChange={(e) => setTicketSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 rounded-xl border border-stone-200 bg-[#FAF8F5] text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-700/20 focus:border-amber-700"
                />
              </div>
            </div>
          </div>

          {/* Tickets Cards Grid */}
          {isLoadingTickets ? (
            <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center space-y-3">
              <Loader2 className="w-8 h-8 text-amber-700 animate-spin mx-auto" />
              <p className="text-xs font-bold text-stone-600">Loading colleague assistance tickets...</p>
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-stone-200 p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center mx-auto">
                <Handshake className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-stone-900">No colleague requests found</h3>
                <p className="text-xs text-stone-500 max-w-sm mx-auto mt-1">
                  {ticketSearchQuery || ticketFilter !== 'open'
                    ? 'Try clearing your filters or search query.'
                    : 'No fellow agents currently have open takeover requests. When an agent requests assistance with a lead, it will appear here.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredTickets.map((t) => {
                const matchedLead = leadMap.get(t.lead_id);
                const isPending = t.status === 'pending';
                const isAcceptedByMe = t.status === 'accepted' && t.accepted_by_id === currentUser.id;
                const isAccepting = acceptingTicketId === t.id;

                return (
                  <div
                    key={t.id}
                    className={`bg-white rounded-2xl border transition-all duration-200 shadow-2xs hover:shadow-xs flex flex-col justify-between overflow-hidden p-5 space-y-4 ${
                      isPending
                        ? 'border-amber-300 bg-amber-50/10'
                        : isAcceptedByMe
                        ? 'border-emerald-200 bg-emerald-50/10'
                        : 'border-stone-200'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <UserAvatar
                          name={t.requested_by_name}
                          avatarUrl={t.requested_by_avatar_url}
                          size="md"
                        />
                        <div>
                          <div className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                            <span>{t.requested_by_name}</span>
                            <span className="text-[10px] text-stone-400 font-normal">&bull; {formatFriendlyTime(t.created_at)}</span>
                          </div>
                          <div className="text-[11px] text-stone-500 font-medium">
                            Requesting Lead Takeover
                          </div>
                        </div>
                      </div>

                      {/* Status Pill */}
                      {isPending ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                          <Ticket className="w-3 h-3 text-amber-700" />
                          Open for Takeover
                        </span>
                      ) : t.status === 'accepted' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                          <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                          Taken Over
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">
                          Withdrawn
                        </span>
                      )}
                    </div>

                    {/* Reason Tag */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-stone-100 text-stone-800 border border-stone-200/80">
                        <span>Reason:</span>
                        <strong className="text-amber-900">{t.reason_label || t.reason}</strong>
                      </span>
                      {t.target_agent_name && (
                        <span className="text-[11px] font-semibold text-stone-500">
                          Targeted for: {t.target_agent_name}
                        </span>
                      )}
                    </div>

                    {/* Lead Preview Box */}
                    <div className="p-3 bg-[#FAF8F5] rounded-xl border border-stone-200/80 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-black text-stone-900 flex items-center gap-1.5">
                          <span>{t.lead_name}</span>
                          {t.lead_company && (
                            <span className="text-[11px] font-normal text-stone-500">({t.lead_company})</span>
                          )}
                        </div>
                        {t.lead_priority && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            String(t.lead_priority).toLowerCase() === 'urgent'
                              ? 'bg-rose-100 text-rose-800 border border-rose-300'
                              : String(t.lead_priority).toLowerCase() === 'high'
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : 'bg-stone-200 text-stone-700'
                          }`}>
                            {t.lead_priority}
                          </span>
                        )}
                      </div>
                      {t.lead_phone && (
                        <div className="text-[11px] text-stone-600 flex items-center gap-1">
                          <Phone className="w-3 h-3 text-stone-400" />
                          <span>{t.lead_phone}</span>
                        </div>
                      )}
                    </div>

                    {/* Handover Notes Box */}
                    {t.notes && (
                      <div className="p-3 rounded-xl bg-amber-50/40 border border-amber-200/70 text-xs text-stone-700 space-y-1">
                        <div className="text-[11px] font-bold text-amber-900 flex items-center gap-1">
                          <MessageSquareQuote className="w-3.5 h-3.5 text-amber-700" />
                          <span>Handover Notes from Colleague:</span>
                        </div>
                        <p className="italic text-stone-800 leading-relaxed">&ldquo;{t.notes}&rdquo;</p>
                      </div>
                    )}

                    {/* Action Bar */}
                    <div className="pt-2 border-t border-stone-100 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {isPending && t.requested_by_id !== currentUser.id && (
                          <button
                            type="button"
                            onClick={() => handleAcceptTicket(t)}
                            disabled={isAccepting}
                            className="px-3.5 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 active:scale-98 text-white text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                          >
                            {isAccepting ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Reassigning...</span>
                              </>
                            ) : (
                              <>
                                <Handshake className="w-4 h-4" />
                                <span>Accept &amp; Take Over Lead</span>
                              </>
                            )}
                          </button>
                        )}

                        {isAcceptedByMe && (
                          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span>Reassigned to You</span>
                          </div>
                        )}

                        {!isPending && !isAcceptedByMe && (
                          <div className="text-xs font-semibold text-stone-500">
                            {t.status === 'accepted' ? `Taken over by ${t.accepted_by_name}` : 'Request closed'}
                          </div>
                        )}
                      </div>

                      {matchedLead ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (onOpenLeadDetail) onOpenLeadDetail(matchedLead);
                            else if (onSelectLead) onSelectLead(matchedLead);
                          }}
                          className="px-3 py-1.5 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <span>Open Lead</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
