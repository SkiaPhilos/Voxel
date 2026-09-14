import React, { useState } from 'react';
import { X, PhoneCall, Calendar, Clock, Check, Building2, Flame } from 'lucide-react';
import type { Lead, OutcomeTag, Priority } from '../types';
import { getQuickPresets, toDatetimeLocal, fromDatetimeLocal } from '../lib/dateUtils';
import { ContactActionMenu } from './ContactActionMenu';

interface LogCallModalProps {
  lead: Lead;
  isOpen: boolean;
  onClose: () => void;
  onSave: (callData: {
    outcome_tag: OutcomeTag;
    summary: string;
    full_notes: string;
    next_action_at?: string | null;
    business_info?: string;
    priority?: Priority;
  }) => Promise<void>;
}

const OUTCOME_OPTIONS: Array<{
  tag: OutcomeTag;
  label: string;
  color: string;
  badgeClass: string;
}> = [
  { tag: 'Interested', label: 'Interested', color: 'emerald', badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200' },
  { tag: 'Call Back Later', label: 'Call Back Later', color: 'amber', badgeClass: 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200' },
  { tag: 'Busy', label: 'Line Busy', color: 'stone', badgeClass: 'bg-stone-100 text-stone-700 border-stone-300 hover:bg-stone-200' },
  { tag: "Couldn't Connect", label: "Couldn't Connect", color: 'stone', badgeClass: 'bg-stone-100 text-stone-700 border-stone-300 hover:bg-stone-200' },
  { tag: 'Closed/Matured', label: 'Closed / Matured 🎉', color: 'teal', badgeClass: 'bg-teal-100 text-teal-900 border-teal-400 hover:bg-teal-200' },
  { tag: 'Service Denied', label: 'Service Denied (Archive)', color: 'rose', badgeClass: 'bg-rose-100 text-rose-800 border-rose-300 hover:bg-rose-200' },
  { tag: 'Other', label: 'Other Outcome', color: 'slate', badgeClass: 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200' },
];

export const LogCallModal: React.FC<LogCallModalProps> = ({ lead, isOpen, onClose, onSave }) => {
  const [outcome, setOutcome] = useState<OutcomeTag>('Interested');
  const [summary, setSummary] = useState('');
  const [fullNotes, setFullNotes] = useState('');
  const [businessInfo, setBusinessInfo] = useState('');
  const [priority, setPriority] = useState<Priority>(lead.priority || 'Normal');
  const [nextActionAt, setNextActionAt] = useState<string | null>(lead.next_action_at || null);
  const [customDatetime, setCustomDatetime] = useState<string>(toDatetimeLocal(lead.next_action_at));
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const presets = getQuickPresets();

  const handleOutcomeSelect = (tag: OutcomeTag) => {
    setOutcome(tag);
    if (!summary) {
      if (tag === 'Interested') setSummary('Prospect interested in demo and overview.');
      if (tag === 'Call Back Later') setSummary('Prospect requested follow-up call.');
      if (tag === 'Busy') setSummary('Line was busy. Re-dial required.');
      if (tag === "Couldn't Connect") setSummary('Rang through / left voicemail.');
      if (tag === 'Closed/Matured') setSummary('Deal closed and finalized!');
      if (tag === 'Service Denied') setSummary('Prospect declined service. Requested removal.');
    }

    // Default next action suggestions based on outcome
    if (tag === 'Call Back Later' && !nextActionAt) {
      setNextActionAt(presets[1].value); // Tomorrow 10am
      setCustomDatetime(toDatetimeLocal(presets[1].value));
    } else if (tag === 'Closed/Matured' || tag === 'Service Denied') {
      setNextActionAt(null);
      setCustomDatetime('');
    }
  };

  const handleApplyPreset = (isoVal: string) => {
    setNextActionAt(isoVal);
    setCustomDatetime(toDatetimeLocal(isoVal));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await onSave({
        outcome_tag: outcome,
        summary: summary.trim() || `Outcome: ${outcome}`,
        full_notes: fullNotes.trim(),
        next_action_at: outcome === 'Closed/Matured' || outcome === 'Service Denied' ? null : nextActionAt,
        business_info: businessInfo.trim() || undefined,
        priority,
      });
      onClose();
    } catch (err) {
      console.error('Failed to log call', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-xl my-6 bg-[#FAF8F5] border border-stone-200 rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-stone-200 bg-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-700 text-amber-50 flex items-center justify-center">
              <PhoneCall className="w-4.5 h-4.5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-bold text-stone-900">Log Call</h3>
                <ContactActionMenu
                  contact={{
                    name: lead.name,
                    phone: lead.phone,
                    business_notes: lead.business_notes,
                    business_info: lead.business_info,
                    source: lead.source,
                  }}
                  size="sm"
                />
              </div>
              <p className="text-xs text-stone-500">{lead.name} {lead.business_notes ? `• ${lead.business_notes.slice(0, 45)}...` : ''}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-5 overflow-y-auto">
          {/* 1. Pick Outcome Tag */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-2 uppercase tracking-wider">
              Outcome Tag <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {OUTCOME_OPTIONS.map((item) => {
                const isSelected = outcome === item.tag;
                return (
                  <button
                    key={item.tag}
                    type="button"
                    onClick={() => handleOutcomeSelect(item.tag)}
                    className={`p-2.5 text-xs font-semibold rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                      isSelected
                        ? `${item.badgeClass} ring-2 ring-amber-700/30 font-bold shadow-xs`
                        : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                    }`}
                  >
                    <span>{item.label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Outcome banner reminder */}
          {outcome === 'Closed/Matured' && (
            <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl text-xs text-teal-900 flex items-start gap-2">
              <span className="font-bold">Deal Closing:</span>
              <span>This lead will be moved to "Closed Deals" view and removed from active dials.</span>
            </div>
          )}

          {outcome === 'Service Denied' && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 flex items-start gap-2">
              <span className="font-bold">Immediate Archive:</span>
              <span>This lead will be archived, suppressed from reminders, and stored in Archive.</span>
            </div>
          )}

          {/* 2. Call Summary & Full Notes */}
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1 uppercase tracking-wider">
                Call Summary <span className="text-stone-400 font-normal normal-case">(Short snippet for cards)</span>
              </label>
              <input
                id="call-summary-input"
                type="text"
                required
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="e.g. Discussed pricing tiers, requested proposal deck"
                className="w-full px-3.5 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-700 focus:border-amber-700 shadow-2xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1 uppercase tracking-wider">
                Full Notes <span className="text-stone-400 font-normal normal-case">(Detailed context, objections, conversation)</span>
              </label>
              <textarea
                id="call-notes-input"
                rows={3}
                value={fullNotes}
                onChange={(e) => setFullNotes(e.target.value)}
                placeholder="Spoke with owner. Current software is clunky, renewal in 3 weeks. Willing to switch if migration is handled..."
                className="w-full px-3.5 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-700 focus:border-amber-700 shadow-2xs resize-y"
              />
            </div>
          </div>

          {/* 3. Structured Business Info Field */}
          <div className="p-3.5 bg-stone-100/70 border border-stone-200 rounded-xl">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-800 mb-1">
              <Building2 className="w-3.5 h-3.5 text-stone-500" />
              <span>Structured Business / Customer Info</span>
            </div>
            <p className="text-[11px] text-stone-500 mb-2">
              Captured company size, decision maker names, budget, or tool stack. Stored for instant future querying and CSV export.
            </p>
            <input
              id="call-business-info-input"
              type="text"
              value={businessInfo}
              onChange={(e) => setBusinessInfo(e.target.value)}
              placeholder="e.g. Budget: $500/mo | Tech stack: Excel + QuickBooks | Decision Maker: VP Operations"
              className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-stone-900 text-xs focus:outline-hidden focus:ring-2 focus:ring-amber-700"
            />
          </div>

          {/* 4. Scheduling Follow-up Next Action */}
          {outcome !== 'Closed/Matured' && outcome !== 'Service Denied' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-amber-700" />
                  <span>Next Action Follow-Up</span>
                </label>
                {nextActionAt && (
                  <button
                    type="button"
                    onClick={() => {
                      setNextActionAt(null);
                      setCustomDatetime('');
                    }}
                    className="text-[11px] text-stone-500 hover:text-stone-800 underline cursor-pointer"
                  >
                    Clear schedule
                  </button>
                )}
              </div>

              {/* Quick Presets */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-2.5">
                {presets.map((p) => {
                  const active = nextActionAt === p.value;
                  return (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => handleApplyPreset(p.value)}
                      className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                        active
                          ? 'bg-amber-100 border-amber-400 text-amber-900 font-bold shadow-2xs'
                          : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                      }`}
                    >
                      <div>{p.label}</div>
                      <div className="text-[10px] text-stone-500 font-normal">{p.preview}</div>
                    </button>
                  );
                })}
              </div>

              {/* Custom Datetime Input */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Clock className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="call-custom-datetime"
                    type="datetime-local"
                    value={customDatetime}
                    onChange={(e) => {
                      setCustomDatetime(e.target.value);
                      const iso = fromDatetimeLocal(e.target.value);
                      setNextActionAt(iso);
                    }}
                    className="w-full pl-9 pr-3 py-1.5 bg-white border border-stone-300 rounded-lg text-stone-900 text-xs focus:outline-hidden focus:ring-2 focus:ring-amber-700"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 5. Priority Setting */}
          <div className="flex items-center justify-between pt-2 border-t border-stone-200">
            <span className="text-xs font-medium text-stone-700 flex items-center gap-1.5">
              <Flame className={`w-4 h-4 ${priority === 'High' ? 'text-amber-600' : 'text-stone-400'}`} />
              <span>Lead Priority:</span>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPriority('Normal')}
                className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                  priority === 'Normal'
                    ? 'bg-stone-800 text-white border-stone-800 font-semibold'
                    : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                }`}
              >
                Normal
              </button>
              <button
                type="button"
                onClick={() => setPriority('High')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                  priority === 'High'
                    ? 'bg-amber-700 text-white border-amber-700 shadow-2xs'
                    : 'bg-white text-amber-800 border-amber-300 hover:bg-amber-50'
                }`}
              >
                🔥 High Priority
              </button>
            </div>
          </div>

          {/* Footer Action Buttons */}
          <div className="pt-4 border-t border-stone-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-stone-600 hover:bg-stone-100 text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="submit-log-call-btn"
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 active:scale-[0.98] text-white text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center gap-2"
            >
              {isSubmitting ? (
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <span>Save Call Outcome</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
