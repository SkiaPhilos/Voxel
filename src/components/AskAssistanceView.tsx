import React, { useState, useEffect, useMemo } from 'react';
import {
  Handshake,
  Layers,
  Scale,
  Briefcase,
  Globe,
  Sparkles,
  Send,
  Loader2,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  RefreshCw,
  Search,
  ExternalLink,
  Users,
  ShieldCheck,
} from 'lucide-react';
import type { Lead, User, AssistanceTicket, AssistanceReason } from '../types';
import { api } from '../lib/api';
import { formatFriendlyTime } from '../lib/dateUtils';

interface AskAssistanceViewProps {
  currentUser: User;
  leads: Lead[];
  onOpenLeadDetail?: (lead: Lead) => void;
  onTicketCreated?: (ticket: AssistanceTicket) => void;
}

const REASONS: Array<{
  id: AssistanceReason;
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: 'high_workload',
    title: 'High Workload / Capacity',
    desc: 'Under heavy lead load; need a colleague to take over outreach.',
    icon: Layers,
  },
  {
    id: 'bad_match',
    title: 'Lead Mismatch',
    desc: 'Not a good fit for this prospect; a different tone/approach would convert better.',
    icon: Scale,
  },
  {
    id: 'domain_expertise',
    title: 'Need Domain Expertise',
    desc: 'Prospect has specialized technical or industry requirements.',
    icon: Briefcase,
  },
  {
    id: 'language_fit',
    title: 'Language or Regional Fit',
    desc: 'Prospect prefers a specific language or localized timezone coverage.',
    icon: Globe,
  },
  {
    id: 'other',
    title: 'Other Reason',
    desc: 'General assistance or requested handover.',
    icon: Sparkles,
  },
];

export const AskAssistanceView: React.FC<AskAssistanceViewProps> = ({
  currentUser,
  leads,
  onOpenLeadDetail,
  onTicketCreated,
}) => {
  // Form state
  const [selectedLeadId, setSelectedLeadId] = useState<string>('');
  const [selectedReason, setSelectedReason] = useState<AssistanceReason>('high_workload');
  const [notes, setNotes] = useState('');
  const [targetAgentId, setTargetAgentId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Teammates state
  const [teammates, setTeammates] = useState<User[]>([]);

  // Outgoing tickets state
  const [myTickets, setMyTickets] = useState<AssistanceTicket[]>([]);
  const [isLoadingTickets, setIsLoadingTickets] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // Filter leads assigned to current user (excluding closed or archived)
  const myAssignableLeads = useMemo(() => {
    return leads.filter((l) => {
      const isMine =
        l.assigned_to === currentUser.id ||
        l.assigned_to === currentUser.email ||
        (!l.assigned_to && currentUser.role === 'admin');
      const isNotClosed = l.status !== 'Closed - Won' && l.status !== 'Closed - Lost' && l.status !== 'Archived';
      return isMine && isNotClosed;
    });
  }, [leads, currentUser]);

  // Load teammates
  useEffect(() => {
    let isMounted = true;
    const loadTeam = async () => {
      try {
        const res = await api.getManagerTeam().catch(() => null);
        if (res?.teamMembers && isMounted) {
          setTeammates(res.teamMembers.filter((u: User) => u.id !== currentUser.id));
        }
      } catch {
        // ignore
      }
    };
    loadTeam();
    return () => {
      isMounted = false;
    };
  }, [currentUser.id]);

  // Load my sent tickets
  const fetchMyTickets = async (isSilent = false) => {
    if (!isSilent) setIsLoadingTickets(true);
    else setIsRefreshing(true);
    try {
      const res = await api.getAssistanceTickets({ scope: 'my' });
      setMyTickets(res.tickets || []);
    } catch (err) {
      console.error('Failed to load my tickets:', err);
    } finally {
      setIsLoadingTickets(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMyTickets();
  }, [currentUser.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!selectedLeadId) {
      setFormError('Please select a lead to hand over.');
      return;
    }

    const reasonObj = REASONS.find((r) => r.id === selectedReason);
    const targetTeammate = teammates.find((u) => u.id === targetAgentId);

    setIsSubmitting(true);
    try {
      const res = await api.createAssistanceTicket({
        leadId: selectedLeadId,
        reason: selectedReason,
        reasonLabel: reasonObj?.title || 'Assistance Request',
        notes: notes.trim(),
        targetAgentId: targetAgentId || null,
        targetAgentName: targetTeammate?.name || null,
      });

      setFormSuccess('Assistance ticket issued! Fellow agents will see it in their Tickets tab.');
      setSelectedLeadId('');
      setNotes('');
      setTargetAgentId('');
      fetchMyTickets(true);

      if (onTicketCreated) {
        onTicketCreated(res.ticket);
      }

      setTimeout(() => setFormSuccess(null), 3500);
    } catch (err: any) {
      console.error('Failed to submit ticket:', err);
      setFormError(err?.message || 'Failed to submit assistance ticket.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelTicket = async (ticketId: string) => {
    setCancellingId(ticketId);
    try {
      await api.cancelAssistanceTicket(ticketId);
      setMyTickets((prev) =>
        prev.map((t) => (t.id === ticketId ? { ...t, status: 'cancelled' } : t))
      );
    } catch (err: any) {
      console.error('Failed to cancel ticket:', err);
    } finally {
      setCancellingId(null);
    }
  };

  const selectedLead = leads.find((l) => l.id === selectedLeadId);

  return (
    <div className="space-y-6 pb-12">
      {/* View Header */}
      <div className="bg-white border border-stone-200/90 rounded-2xl p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-700 text-white flex items-center justify-center shadow-xs">
              <Handshake className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-stone-900 tracking-tight">Ask Assistance</h1>
              <p className="text-xs text-stone-500">
                Request a teammate to take over your lead due to capacity, mismatch, or required expertise.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => fetchMyTickets(true)}
            disabled={isRefreshing}
            className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-xs font-semibold text-stone-600 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh Status</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Left = Issue Ticket, Right = My Active Requests */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Form (7 cols) */}
        <div className="lg:col-span-7 bg-white border border-stone-200/90 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-5">
          <div>
            <h2 className="text-base font-bold text-stone-900">Issue Assistance Ticket</h2>
            <p className="text-xs text-stone-500">
              Colleagues can review and accept your takeover request in their Tickets tab.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {formSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{formSuccess}</span>
              </div>
            )}

            {/* Select Lead */}
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1.5">
                Select Lead to Hand Over <span className="text-red-500">*</span>
              </label>
              {myAssignableLeads.length === 0 ? (
                <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 text-xs text-stone-500 text-center">
                  No active assigned leads available to hand over.
                </div>
              ) : (
                <select
                  value={selectedLeadId}
                  onChange={(e) => setSelectedLeadId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl text-xs text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-amber-700 shadow-2xs"
                  required
                >
                  <option value="">-- Choose from your active leads ({myAssignableLeads.length}) --</option>
                  {myAssignableLeads.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} {l.company ? `• ${l.company}` : ''} • {l.phone} ({l.status})
                    </option>
                  ))}
                </select>
              )}

              {selectedLead && (
                <div className="mt-2 p-3 bg-stone-50 border border-stone-200 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-stone-800">{selectedLead.name}</span>
                    <span className="text-stone-500 ml-2">{selectedLead.company || 'Direct'}</span>
                  </div>
                  {onOpenLeadDetail && (
                    <button
                      type="button"
                      onClick={() => onOpenLeadDetail(selectedLead)}
                      className="text-amber-800 hover:text-amber-900 font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <span>View Lead</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Reason */}
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1.5">
                Reason for Handover <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {REASONS.map((r) => {
                  const Icon = r.icon;
                  const isSelected = selectedReason === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSelectedReason(r.id)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                        isSelected
                          ? 'bg-amber-50 border-amber-600 ring-1 ring-amber-600/30'
                          : 'bg-white border-stone-200 hover:border-stone-300'
                      }`}
                    >
                      <div
                        className={`p-1.5 rounded-lg shrink-0 ${
                          isSelected ? 'bg-amber-700 text-white' : 'bg-stone-100 text-stone-600'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-stone-900">{r.title}</div>
                        <div className="text-[11px] text-stone-500 line-clamp-2 leading-snug">
                          {r.desc}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Handover Notes */}
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1.5">
                Handover Notes for Colleague
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Provide helpful context: conversation history, prospect persona, key concerns, or why you recommend a takeover..."
                rows={3}
                className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl text-xs text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-amber-700 shadow-2xs resize-none"
              />
            </div>

            {/* Send to Teammate (Optional) */}
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1.5 flex items-center justify-between">
                <span>Direct To Colleague (Optional)</span>
                <span className="text-[11px] text-stone-400 font-normal">Leave blank for all fellow agents</span>
              </label>
              <select
                value={targetAgentId}
                onChange={(e) => setTargetAgentId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl text-xs text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-amber-700 shadow-2xs"
              >
                <option value="">Open to Any Fellow Agent (Pool)</option>
                {teammates.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting || !selectedLeadId}
                className="w-full sm:w-auto px-5 py-2.5 bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Submitting Ticket...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Issue Assistance Ticket</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: My Sent Requests History (5 cols) */}
        <div className="lg:col-span-5 bg-white border border-stone-200/90 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-4 flex flex-col">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-stone-900">My Issued Requests</h2>
              <p className="text-xs text-stone-500">Track takeover requests you sent</p>
            </div>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">
              {myTickets.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 max-h-[600px] pr-1">
            {isLoadingTickets ? (
              <div className="py-12 flex flex-col items-center justify-center text-stone-400 gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-amber-700" />
                <span className="text-xs">Loading requests...</span>
              </div>
            ) : myTickets.length === 0 ? (
              <div className="py-12 px-4 rounded-xl border border-dashed border-stone-200 text-center">
                <Handshake className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                <div className="text-xs font-bold text-stone-700">No Assistance Tickets Yet</div>
                <p className="text-[11px] text-stone-400 mt-1">
                  When you issue takeover requests, their live status will appear here.
                </p>
              </div>
            ) : (
              myTickets.map((ticket) => {
                const isPending = ticket.status === 'pending';
                const isAccepted = ticket.status === 'accepted';
                const isCancelled = ticket.status === 'cancelled';

                return (
                  <div
                    key={ticket.id}
                    className={`p-3.5 rounded-xl border transition-all ${
                      isPending
                        ? 'bg-amber-50/40 border-amber-200 shadow-2xs'
                        : isAccepted
                        ? 'bg-emerald-50/30 border-emerald-200'
                        : 'bg-stone-50 border-stone-200 opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                          <span>{ticket.lead_name}</span>
                          {ticket.lead_company && (
                            <span className="text-[11px] text-stone-500 font-normal">
                              ({ticket.lead_company})
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-semibold text-amber-800 mt-0.5">
                          {ticket.reason_label}
                        </div>
                      </div>

                      {/* Status badge */}
                      {isPending && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200 flex items-center gap-1 shrink-0">
                          <Clock className="w-2.5 h-2.5" />
                          <span>Pending Takeover</span>
                        </span>
                      )}
                      {isAccepted && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-200 flex items-center gap-1 shrink-0">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          <span>Accepted</span>
                        </span>
                      )}
                      {isCancelled && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-200 text-stone-600 border border-stone-300 flex items-center gap-1 shrink-0">
                          <XCircle className="w-2.5 h-2.5" />
                          <span>Cancelled</span>
                        </span>
                      )}
                    </div>

                    {ticket.notes && (
                      <div className="mt-2 text-[11px] text-stone-600 bg-white/70 p-2 rounded-lg border border-stone-200/60 leading-relaxed">
                        "{ticket.notes}"
                      </div>
                    )}

                    <div className="mt-2.5 pt-2 border-t border-stone-200/60 flex items-center justify-between text-[10px] text-stone-500">
                      <span>{formatFriendlyTime(ticket.created_at)}</span>

                      {isAccepted && (
                        <span className="text-emerald-800 font-bold">
                          Assigned to: {ticket.accepted_by_name || 'Colleague'}
                        </span>
                      )}

                      {isPending && (
                        <button
                          type="button"
                          onClick={() => handleCancelTicket(ticket.id)}
                          disabled={cancellingId === ticket.id}
                          className="text-stone-400 hover:text-red-700 font-semibold transition-colors cursor-pointer"
                        >
                          {cancellingId === ticket.id ? 'Cancelling...' : 'Withdraw Ticket'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
