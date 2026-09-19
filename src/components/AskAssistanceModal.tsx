import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Handshake,
  X,
  AlertCircle,
  CheckCircle2,
  Users,
  Send,
  Loader2,
  Briefcase,
  Layers,
  Scale,
  Sparkles,
  Globe,
} from 'lucide-react';
import type { Lead, User, AssistanceReason, AssistanceTicket } from '../types';
import { api } from '../lib/api';

interface AskAssistanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  lead?: Lead | null;
  initialLead?: Lead | null;
  myLeads?: Lead[];
  availableLeads?: Lead[];
  teamMembers?: User[];
  onTicketCreated?: (ticket?: AssistanceTicket) => void;
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

export const AskAssistanceModal: React.FC<AskAssistanceModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  lead: propLead,
  initialLead,
  myLeads = [],
  availableLeads = [],
  teamMembers = [],
  onTicketCreated,
}) => {
  const activeLead = propLead || initialLead;
  const leadOptions = myLeads.length > 0 ? myLeads : availableLeads;

  const [selectedLeadId, setSelectedLeadId] = useState<string>('');
  const [selectedReason, setSelectedReason] = useState<AssistanceReason>('high_workload');
  const [notes, setNotes] = useState('');
  const [targetAgentId, setTargetAgentId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [allTeammates, setAllTeammates] = useState<User[]>([]);

  useEffect(() => {
    if (activeLead) {
      setSelectedLeadId(activeLead.id);
    } else if (leadOptions.length > 0 && !selectedLeadId) {
      setSelectedLeadId(leadOptions[0].id);
    }
  }, [activeLead, leadOptions, selectedLeadId]);

  // Load teammates if not provided
  useEffect(() => {
    let isMounted = true;
    if (teamMembers.length > 0) {
      setAllTeammates(teamMembers.filter((u) => u.id !== currentUser.id));
      return;
    }
    const loadTeam = async () => {
      try {
        const res = await api.getManagerTeam().catch(() => null);
        if (res?.teamMembers && isMounted) {
          setAllTeammates(res.teamMembers.filter((u: User) => u.id !== currentUser.id));
        }
      } catch {
        // ignore
      }
    };
    loadTeam();
    return () => {
      isMounted = false;
    };
  }, [teamMembers, currentUser.id]);

  if (!isOpen) return null;

  const currentLead = propLead || myLeads.find((l) => l.id === selectedLeadId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!selectedLeadId) {
      setErrorMsg('Please select a lead to hand over.');
      return;
    }

    const reasonObj = REASONS.find((r) => r.id === selectedReason);
    const targetTeammate = allTeammates.find((u) => u.id === targetAgentId);

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

      setSuccessMsg('Assistance ticket issued! Fellow agents will see it in their Tickets tab.');
      if (onTicketCreated) {
        onTicketCreated(res.ticket);
      }

      setTimeout(() => {
        setSuccessMsg(null);
        setNotes('');
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error('Failed to create assistance ticket:', err);
      setErrorMsg(err?.message || 'Failed to submit assistance ticket.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-[#FAF8F5] border border-stone-200 rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-stone-200 bg-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-700 text-white flex items-center justify-center shadow-xs">
              <Handshake className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900">Request Lead Takeover</h3>
              <p className="text-xs text-stone-500">Ask a fellow agent to take over this prospect</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Lead Selection */}
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1.5">
              Prospect / Lead to Hand Over <span className="text-red-500">*</span>
            </label>
            {activeLead ? (
              <div className="p-3 rounded-xl bg-white border border-stone-200 shadow-2xs flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-stone-900">{activeLead.name}</div>
                  <div className="text-[11px] text-stone-500">
                    {activeLead.company || activeLead.business_info || 'Direct Contact'} • {activeLead.phone}
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 border border-stone-200">
                  {activeLead.status}
                </span>
              </div>
            ) : (
              <select
                value={selectedLeadId}
                onChange={(e) => setSelectedLeadId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-amber-700 shadow-2xs"
                required
              >
                <option value="">-- Select a Lead --</option>
                {leadOptions.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} {l.company || l.business_info ? `(${l.company || l.business_info})` : ''} - {l.phone}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Reason Selection */}
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1.5">
              Primary Reason for Handover <span className="text-red-500">*</span>
            </label>
            <div className="space-y-1.5">
              {REASONS.map((r) => {
                const IconComponent = r.icon;
                const isSelected = selectedReason === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelectedReason(r.id)}
                    className={`w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer flex items-start gap-2.5 ${
                      isSelected
                        ? 'bg-amber-50/70 border-amber-600/70 shadow-2xs ring-1 ring-amber-600/30'
                        : 'bg-white border-stone-200 hover:border-stone-300 shadow-2xs'
                    }`}
                  >
                    <div
                      className={`p-1.5 rounded-lg shrink-0 ${
                        isSelected ? 'bg-amber-700 text-white' : 'bg-stone-100 text-stone-600'
                      }`}
                    >
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-stone-900">{r.title}</div>
                      <div className="text-[11px] text-stone-500 leading-snug">{r.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Handover Context & Notes */}
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1.5">
              Context &amp; Handover Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="E.g., Spoke to the lead once. Interested in our enterprise tier, but wants deep tech discussion. Needs someone comfortable discussing technical integrations."
              rows={3}
              className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-amber-700 shadow-2xs resize-none"
            />
          </div>

          {/* Target Colleague (Optional) */}
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1.5 flex items-center justify-between">
              <span>Send To (Optional)</span>
              <span className="text-[10px] text-stone-400 font-normal">Leave as open to let anyone accept</span>
            </label>
            <div className="relative">
              <select
                value={targetAgentId}
                onChange={(e) => setTargetAgentId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-amber-700 shadow-2xs"
              >
                <option value="">Open to Any Fellow Agent</option>
                {allTeammates.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Submit Actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-stone-200">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !selectedLeadId}
              className="px-4 py-2 bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Submit Assistance Ticket</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
