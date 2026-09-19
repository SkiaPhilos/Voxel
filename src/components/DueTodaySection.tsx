import React from 'react';
import { Clock, Phone, AlertTriangle, ArrowRight, Flame, PhoneCall } from 'lucide-react';
import type { Lead } from '../types';
import { formatFriendlyTime } from '../lib/dateUtils';
import { ContactActionMenu } from './ContactActionMenu';

interface DueTodaySectionProps {
  leads: Lead[];
  onLogCall: (lead: Lead) => void;
  onOpenDetail: (lead: Lead) => void;
  onStartPowerDialer?: (leads: Lead[]) => void;
}

export const DueTodaySection: React.FC<DueTodaySectionProps> = ({
  leads,
  onLogCall,
  onOpenDetail,
  onStartPowerDialer,
}) => {
  if (leads.length === 0) return null;

  return (
    <div className="mb-6 rounded-2xl border border-amber-300/80 bg-gradient-to-r from-amber-50/90 via-[#FFFDF9] to-amber-50/70 p-4 sm:p-5 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-600 text-white flex items-center justify-center shadow-xs">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-amber-950 flex items-center gap-2">
              <span>Due Today &amp; Overdue Follow-Ups</span>
              <span className="px-2 py-0.5 rounded-full bg-amber-200/90 text-amber-900 font-bold text-xs">
                {leads.length} Due
              </span>
            </h3>
            <p className="text-xs text-amber-800/80">
              High-intent leads waiting on promised callback.
            </p>
          </div>
        </div>

        {onStartPowerDialer && leads.length > 0 && (
          <button
            type="button"
            onClick={() => onStartPowerDialer(leads)}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold shadow-xs hover:shadow-sm transition-all cursor-pointer shrink-0"
          >
            <PhoneCall className="w-4 h-4" />
            <span>Start Call Session ({leads.length})</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {leads.map((lead) => (
          <div
            key={lead.id}
            className="p-3.5 bg-white rounded-xl border border-amber-200/90 shadow-2xs hover:border-amber-300 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <button
                  onClick={() => onOpenDetail(lead)}
                  className="font-bold text-stone-900 text-sm hover:text-amber-800 text-left truncate cursor-pointer"
                >
                  {lead.name}
                </button>
                {lead.priority === 'High' && (
                  <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 flex items-center gap-0.5">
                    <Flame className="w-3 h-3 text-amber-600" />
                    <span>High</span>
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between text-xs mb-2">
                <ContactActionMenu
                  contact={{
                    name: lead.name,
                    phone: lead.phone,
                    business_notes: lead.business_notes,
                    business_info: lead.business_info,
                    source: lead.source,
                  }}
                />
                <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                  {formatFriendlyTime(lead.next_action_at)}
                </span>
              </div>

              {lead.business_notes && (
                <p className="text-[11px] text-stone-500 line-clamp-1 mb-3">
                  {lead.business_notes}
                </p>
              )}
            </div>

            <div className="pt-2 border-t border-stone-100 flex items-center justify-between gap-2">
              <span className="text-[10px] text-stone-400">
                {lead.call_logs.length > 0 ? lead.call_logs[0].outcome_tag : 'No calls'}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => onOpenDetail(lead)}
                  className="text-xs text-stone-600 hover:text-stone-900 px-2 py-1 rounded hover:bg-stone-100 transition-colors cursor-pointer"
                >
                  Notes
                </button>
                <button
                  id={`due-dial-btn-${lead.id}`}
                  onClick={() => onLogCall(lead)}
                  className="text-xs font-bold bg-amber-700 hover:bg-amber-800 text-white px-2.5 py-1 rounded-lg shadow-2xs transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Phone className="w-3 h-3" />
                  <span>Call &amp; Log</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
