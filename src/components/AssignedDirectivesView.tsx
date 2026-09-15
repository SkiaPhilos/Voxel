import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Pin,
  CheckCircle2,
  AlertCircle,
  Clock,
  Search,
  Filter,
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
} from 'lucide-react';
import type { Lead, PinnedComment, PinnedCommentStatus, User } from '../types';
import { api } from '../lib/api';
import { UserAvatar } from './UserAvatar';

interface AssignedDirectivesViewProps {
  currentUser: User;
  leads: Lead[];
  onSelectLead?: (lead: Lead) => void;
  onOpenLeadDetail?: (lead: Lead) => void;
  onReviewAgent?: (agent: User) => void;
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
  onSelectLead,
  onOpenLeadDetail,
  onReviewAgent,
}) => {
  const [comments, setComments] = useState<PinnedComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'unacknowledged' | 'acknowledged' | 'done'>('all');
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [scopeFilter, setScopeFilter] = useState<'my' | 'all'>('my');
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

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
      // If scopeFilter is 'my', filter by current user's authored directives
      // If scopeFilter is 'all' (for admin or manager viewing team), authorId is 'all'
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

  // Distinct agent names for filter dropdown
  const uniqueAgents = useMemo(() => {
    const set = new Set<string>();
    comments.forEach((c) => {
      if (c.agent_name) set.add(c.agent_name);
    });
    return Array.from(set).sort();
  }, [comments]);

  // Filtered comments
  const filteredComments = useMemo(() => {
    return comments.filter((c) => {
      // Status filter
      if (statusFilter !== 'all' && c.status !== statusFilter) {
        return false;
      }
      // Agent filter
      if (agentFilter !== 'all' && c.agent_name !== agentFilter) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchLeadName = c.lead_name?.toLowerCase().includes(q);
        const matchLeadPhone = c.lead_phone?.toLowerCase().includes(q);
        const matchAgentName = c.agent_name?.toLowerCase().includes(q);
        const matchContent = c.content.toLowerCase().includes(q);
        const matchCallSnippet = c.call_log_snippet?.toLowerCase().includes(q);
        if (!matchLeadName && !matchLeadPhone && !matchAgentName && !matchContent && !matchCallSnippet) {
          return false;
        }
      }
      return true;
    });
  }, [comments, statusFilter, agentFilter, searchQuery]);

  // Metrics
  const totalCount = comments.length;
  const doneCount = comments.filter((c) => c.status === 'done').length;
  const ackCount = comments.filter((c) => c.status === 'acknowledged').length;
  const unackCount = comments.filter((c) => c.status === 'unacknowledged').length;
  const notDoneCount = totalCount - doneCount;
  const completionRate = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Toast Feedback Notification */}
      {feedbackMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-stone-900 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-xl border border-stone-700 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{feedbackMsg}</span>
        </div>
      )}

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
                  Track instructions you wrote on specific leads and monitor whether assigned agents have executed them.
                </p>
              </div>
            </div>
          </div>

          {/* Top Controls: Scope Toggle + Refresh */}
          <div className="flex items-center gap-2 self-start md:self-auto">
            {currentUser.role === 'admin' && (
              <div className="flex items-center bg-[#FAF8F5] p-1 rounded-xl border border-stone-200 text-xs font-semibold">
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
                <button
                  type="button"
                  onClick={() => setScopeFilter('all')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    scopeFilter === 'all'
                      ? 'bg-white text-stone-900 shadow-2xs font-bold'
                      : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  All Managers
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
                placeholder="Search lead, directive, agent..."
                className="w-full sm:w-60 pl-8 pr-3 py-1.5 bg-[#FAF8F5] border border-stone-200 rounded-xl text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-amber-700 focus:bg-white transition-all"
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
                : "You haven't assigned any directives yet. You can pin directives to leads while reviewing agent pipelines."}
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
            const isPending = comment.status === 'unacknowledged';
            const matchedLead = comment.lead_id ? leadMap.get(comment.lead_id) : undefined;
            const isAuthor = comment.author_id === currentUser.id;

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
                  {/* Lead Target Context ("on x lead") */}
                  <div className="flex items-start justify-between gap-3 p-3 rounded-xl bg-[#FAF8F5] border border-stone-200/90">
                    <div className="space-y-0.5 min-w-0">
                      <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Target Lead</div>
                      <div className="font-bold text-stone-900 text-sm truncate flex items-center gap-2">
                        <span>{comment.lead_name || matchedLead?.name || 'Unspecified Lead'}</span>
                        {comment.lead_phone && (
                          <span className="text-xs text-stone-500 font-mono font-normal">
                            {comment.lead_phone}
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
                        <div className="text-[11px] text-stone-600 italic bg-white px-2 py-1 rounded border border-stone-200 mt-1.5 flex items-center gap-1.5">
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

                  {/* The Directive Message You Wrote */}
                  <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/90 space-y-1.5 shadow-2xs relative">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-amber-900 flex items-center gap-1">
                        <Pin className="w-3 h-3 fill-amber-700 text-amber-700" />
                        <span>
                          {isAuthor ? 'You wrote:' : `${comment.author_name || 'Manager'} wrote:`}
                        </span>
                      </span>
                      <span className="text-stone-400 font-mono">
                        {comment.created_at ? new Date(comment.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                    <p className={`text-xs text-stone-900 font-medium leading-relaxed ${isDone ? 'line-through text-stone-500' : ''}`}>
                      {comment.content}
                    </p>
                  </div>

                  {/* Assigned Agent Details */}
                  <div className="flex items-center justify-between pt-1 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-stone-200 text-stone-700 flex items-center justify-center font-bold text-xs shrink-0">
                        {comment.agent_name ? comment.agent_name.charAt(0).toUpperCase() : 'A'}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">Assigned Agent</div>
                        <div className="font-bold text-stone-900 truncate">
                          {comment.agent_name || 'Assigned Agent'}
                        </div>
                      </div>
                    </div>

                    {/* Delete Directive Action */}
                    <button
                      type="button"
                      onClick={() => handleDelete(comment)}
                      disabled={deletingId === comment.id}
                      className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
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

                {/* Bottom Footer Action: Direct Phone Call or Jump to Pipeline */}
                {matchedLead && (
                  <div className="px-4 py-2.5 bg-[#FAF8F5] border-t border-stone-100 flex items-center justify-between text-xs">
                    <a
                      href={`tel:${matchedLead.phone}`}
                      className="text-stone-600 hover:text-amber-800 font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <Phone className="w-3 h-3 text-stone-400" />
                      <span>Call {matchedLead.phone}</span>
                    </a>

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
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
